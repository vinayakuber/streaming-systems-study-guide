#!/usr/bin/env python3
"""deck_gate.py — the narrated-deck test checklist (template section 10), run headless.

For every decks/ch*.html it opens the page in Chromium with a fake speech engine and walks
EVERY slide and EVERY step, failing on:

  console   a page error, a console error, or any "[deck]" warning
  voice     the deck did not pick "Google UK English Male" when that voice exists
  narration the bar's text is not the step's narration line, or it does not fit in the bar
  overflow  any element of the slide reaches past the slide area (into the narration bar or
            off the right edge), or a box clips its own content
  graph     a box overlaps a box, an arrow passes through a box it does not connect, an
            arrow label sits on a box, or a box's own text runs out of the box
  tabs      the tab strip is wider than the header
  links     clicking a source link moves the slide on

The stage is a fixed 1600x900 canvas scaled uniformly to the window, so one pass at
1600x900 measures every window size; a second pass at 1280x720 confirms the scaling.

A deck count of zero is a FAILURE, not a pass (R53): it means nothing was checked.
"""
import glob, json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SETTLE_MS = int(os.environ.get('DECK_SETTLE_MS', '900'))

FAKE_SPEECH = """
(() => {
  const voices = [
    { name: 'Google UK English Male', lang: 'en-GB', localService: false, default: false, voiceURI: 'g' },
    { name: 'Some Default Voice', lang: 'en-US', localService: true, default: true, voiceURI: 'd' }
  ];
  window.__spoken = [];
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    speak(u) { window.__spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null });
               setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 5); },
    cancel() {}, pause() {}, resume() {},
    addEventListener() {}, removeEventListener() {}, onvoiceschanged: null
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""

# Runs inside the page for the current slide and step; returns a list of findings.
MEASURE = r"""
() => {
  const out = [];
  const slide = document.querySelector('.slide.on');
  const deck = document.querySelector('#deck').getBoundingClientRect();
  const stage = document.querySelector('#stage').getBoundingClientRect();
  const s = stage.width / 1600;                       // stage scale, so tolerances stay in stage px
  const tol = 1.5 * s;
  // 1. nothing past the slide area
  for (const el of slide.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;   // SVG content: checked in viewBox units below
    if (el.parentElement && el.parentElement.closest('.codep')) continue;     // lines inside a scrolling listing: the pane itself is measured
    if (r.bottom > deck.bottom + tol || r.right > deck.right + tol || r.left < deck.left - tol || r.top < deck.top - tol)
      out.push(`overflow: <${el.tagName.toLowerCase()} class="${el.className}"> "${(el.textContent||'').trim().slice(0,60)}" reaches past the slide area`);
    const cs = getComputedStyle(el);
    // .codep is a program listing that scrolls on purpose; everything else must fit its box
    if (!el.classList.contains('codep') && (cs.overflow !== 'visible' || cs.overflowY !== 'visible') && el.tagName.toLowerCase() !== 'svg' &&
        (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2))
      out.push(`clipped: <${el.tagName.toLowerCase()} class="${el.className}"> "${(el.textContent||'').trim().slice(0,60)}" clips its own content`);
  }
  // 1a. spilled text: content running out of its own box. A tile's big number never wraps,
  // so "100,000,000" ran into the neighbouring tile without reaching the slide edge.
  const BOX = '.tiles>div, .card, .opt, .am, .tkt, td, th';
  for (const el of slide.querySelectorAll('.v, .d, b, span, p, h3, li, code')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || el.closest('svg') || el.closest('.codep')) continue;
    const box = el.parentElement && el.parentElement.closest(BOX); if (!box) continue;
    const b = box.getBoundingClientRect();
    if (r.right > b.right + tol || r.left < b.left - tol)
      out.push(`spilled: "${(el.textContent || '').trim().slice(0, 40)}" runs out of its box by ${Math.round(Math.max(r.right - b.right, b.left - r.left) / s)}px`);
  }
  // 1a'. content taller than its own box. Cards may shrink to share a column (min-height:0),
  // and then their content runs on into the card below, covering it: the line "The answer
  // is B." vanished under the next card. Nothing left the slide and nothing was "clipped" by
  // an overflow rule, so neither check above saw it; the box's own height is what tells.
  for (const el of slide.querySelectorAll('.card, .tiles>div, .am, .opt')) {
    if (el.classList.contains('codecard') || el.closest('svg')) continue;
    const over = el.scrollHeight - el.clientHeight;
    if (over > 2 && getComputedStyle(el).overflowY === 'visible')
      out.push(`overrun: <${el.tagName.toLowerCase()} class="${el.className}"> "${(el.textContent || '').trim().slice(0, 40)}" is ${Math.round(over / s)}px taller than its box, so it runs into what follows`);
  }
  // 1b. squeezed text: a block forced so narrow it wraps a word or two per line. Caught on a
  // slide whose long heading left its subtitle a sliver — nothing overflowed, it was unreadable.
  for (const el of slide.querySelectorAll('p, li, h1, td, th, .stand')) {
    const t = (el.textContent || '').trim(); if (t.length < 30) continue;
    const r = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) * s || 1;
    const lines = Math.round(r.height / lh);
    if (lines >= 4 && t.length / lines < 14)
      out.push(`squeezed: "${t.slice(0, 50)}" wraps onto ${lines} lines of about ${Math.round(t.length / lines)} characters`);
  }
  // 2. graph geometry, in viewBox units
  const svg = slide.querySelector('svg.g');
  if (svg) {
    const boxes = [...svg.querySelectorAll('g.gnode')].map(g => {
      const r = g.querySelector('rect:not(.hubring)');
      return { id: g.dataset.id, x: +r.getAttribute('x'), y: +r.getAttribute('y'),
               w: +r.getAttribute('width'), h: +r.getAttribute('height'), g };
    });
    const inside = (p, b, m) => p.x > b.x + m && p.x < b.x + b.w - m && p.y > b.y + m && p.y < b.y + b.h - m;
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
      if (hit(boxes[i], boxes[j])) out.push(`graph: box "${boxes[i].id}" overlaps box "${boxes[j].id}"`);
    const vb = svg.viewBox.baseVal;
    for (const b of boxes) {
      if (b.x < vb.x || b.y < vb.y || b.x + b.w > vb.x + vb.width || b.y + b.h > vb.y + vb.height)
        out.push(`graph: box "${b.id}" lies outside the viewBox`);
      for (const t of b.g.querySelectorAll('text')) {
        if (!t.textContent.trim() || t.classList.contains('lnk') || t.classList.contains('unvt')) continue;
        const bb = t.getBBox();
        if (bb.x < b.x + 2 || bb.x + bb.width > b.x + b.w - 2 || bb.y < b.y || bb.y + bb.height > b.y + b.h + 1)
          out.push(`graph: text "${t.textContent.trim()}" runs out of box "${b.id}"`);
      }
    }
    const DATA = JSON.parse(svg.closest('.slide').dataset.edges || '[]');
    for (const p of svg.querySelectorAll('path.gedge')) {
      const e = DATA[+p.dataset.i]; if (!e) continue;
      const L = p.getTotalLength();
      for (let k = 1; k < 20; k++) {
        const pt = p.getPointAtLength(L * k / 20);
        for (const b of boxes) if (b.id !== e.from && b.id !== e.to && inside(pt, b, 2)) {
          out.push(`graph: arrow ${e.from} → ${e.to} passes through box "${b.id}"`); k = 99; break;
        }
      }
    }
    // a box's own texts (title, sub, big value) must not collide with each other
    for (const b of boxes) {
      const ts = [...b.g.querySelectorAll('text')].filter(t => t.textContent.trim() && !t.classList.contains('lnk') && !t.classList.contains('unvt'))
        // Measured as INK, not as getBBox: an SVG text box includes the font's empty ascent and
        // descent, so an ordinary title over a subtitle "overlaps" by box while reading cleanly.
        // Ink runs from cap height (0.72 em above the baseline) to descender (0.22 em below);
        // two lines in one box need at least 1 unit of clear space between their ink.
        .map(t => { const r = t.getBBox(), fs = parseFloat(getComputedStyle(t).fontSize), base = +t.getAttribute('y');
                    return { s: t.textContent.trim(), x: r.x, y: base - 0.72 * fs - 0.5, w: r.width, h: 0.94 * fs + 1 }; });
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++)
        if (hit(ts[i], ts[j])) out.push(`graph: in box "${b.id}", "${ts[i].s}" overlaps "${ts[j].s}"`);
    }
    // arrow labels: never on a box, never on another arrow, never on each other
    const paths = [...svg.querySelectorAll('path.gedge')].map(p => {
      const L = p.getTotalLength(), pts = [];
      for (let k = 0; k <= 60; k++) pts.push(p.getPointAtLength(L * k / 60));
      const e = DATA[+p.dataset.i] || {}; return { i: p.dataset.i, name: `${e.from} → ${e.to}`, pts };
    });
    const lbls = [...svg.querySelectorAll('text.glbl')].map(t => { const r = t.getBBox(); return { i: t.dataset.i, s: t.textContent, x: r.x, y: r.y + 2, w: r.width, h: r.height - 4 }; });
    for (const l of lbls) {
      for (const b of boxes) if (hit(l, b)) out.push(`graph: arrow label "${l.s}" sits on box "${b.id}"`);
      // On its OWN arrow is the template's style (a halo keeps it legible — see its system map).
      // On a DIFFERENT arrow, two lines of meaning cross and the label belongs to neither.
      for (const p of paths) if (p.i !== l.i && p.pts.some(pt => inside(pt, l, -1))) out.push(`graph: arrow label "${l.s}" sits on another arrow, ${p.name}`);
      if (l.x < vb.x || l.x + l.w > vb.x + vb.width) out.push(`graph: arrow label "${l.s}" runs off the diagram`);
    }
    for (let i = 0; i < lbls.length; i++) for (let j = i + 1; j < lbls.length; j++)
      if (hit(lbls[i], lbls[j])) out.push(`graph: arrow labels "${lbls[i].s}" and "${lbls[j].s}" overlap`);
    for (const t of svg.querySelectorAll('text.gcol')) {
      const bb = t.getBBox();
      for (const b of boxes) if (hit({ x: bb.x, y: bb.y, w: bb.width, h: bb.height }, b))
        out.push(`graph: lane label "${t.textContent}" sits on box "${b.id}"`);
    }
  }
  // 3. the narration bar
  const narr = document.querySelector('.narr').getBoundingClientRect();
  const txtBox = document.querySelector('#ntxt').parentElement.getBoundingClientRect();
  if (txtBox.top < narr.top - tol || txtBox.bottom > narr.bottom + tol)
    out.push(`narration: the text does not fit in the bar (${Math.round(txtBox.height / s)}px of ${Math.round(narr.height / s)}px)`);
  const tabs = document.querySelector('#tabs');
  if (tabs.scrollWidth > tabs.clientWidth + 2) out.push(`tabs: the tab strip is ${tabs.scrollWidth - tabs.clientWidth}px wider than the header`);
  return out;
}
"""


def check_deck(page, path, width, height):
    findings, steps = [], 0
    page.set_viewport_size({'width': width, 'height': height})
    console = []
    page.on('console', lambda m: console.append(m) if m.type == 'error' or '[deck]' in m.text else None)
    page.on('pageerror', lambda e: console.append(e))
    page.goto('file://' + os.path.abspath(path))
    page.wait_for_function('window.__deck !== undefined')
    deck = page.evaluate('() => DECK')
    for i, s in enumerate(deck['slides']):
        if s['layout'] == 'graph':   # hand the edge list to the in-page measurer
            page.evaluate('([i, e]) => { document.querySelectorAll(".slide")[i].dataset.edges = JSON.stringify(e); }',
                          [i, s['graph'].get('edges', [])])
    n = page.evaluate('() => window.__deck.slides')
    if n != len(deck['slides']):
        findings.append(f'deck reports {n} slides, DECK has {len(deck["slides"])}')
    for i in range(n):
        lines = page.evaluate(f'() => window.__deck.narrLen({i})')
        for k in range(lines):
            page.evaluate(f'() => window.__deck.go({i}, {k})')
            steps += 1
            where = f'slide {i + 1} "{deck["slides"][i]["title"]}" step {k + 1}/{lines}'
            # The bar fades its text in after ~1s. Measuring before it lands would check the
            # fit of an EMPTY bar and pass — so wait for the exact line, and fail if it never comes.
            want = deck['slides'][i]['narration'][k].strip()
            try:
                page.wait_for_function('w => window.__deck.state().text.trim() === w', arg=want, timeout=6000)
            except Exception:
                state = page.evaluate('() => window.__deck.state()')
                findings.append(f'{where}: the bar never showed this step\'s narration (it shows "{state["text"][:50]}")')
            page.wait_for_timeout(SETTLE_MS)
            state = page.evaluate('() => window.__deck.state()')
            if state['cur'] != i or state['line'] != k:
                findings.append(f'{where}: deck is at slide {state["cur"] + 1} step {state["line"] + 1}')
            for f in page.evaluate(MEASURE):
                findings.append(f'{where}: {f}')
    # questions: the deck must refuse to move on until answered, then explain the answer —
    # checked for a wrong answer and for the right one, with the feedback measured for fit
    for i, sl in enumerate(deck['slides']):
        if not sl.get('question'):
            continue
        q = sl['question']
        right = next(j for j, o in enumerate(q['options']) if o.get('correct'))
        wrongs = [j for j, o in enumerate(q['options']) if not o.get('correct')]
        for pick, verdict in ([(wrongs[0], 'Not quite')] if wrongs else []) + [(right, 'Right')]:
            where = f'slide {i + 1} "{sl["title"]}" question, answer {chr(65 + pick)}'
            page.evaluate(f'() => window.__deck.go({i}, {q["step"]})')
            page.wait_for_function('w => window.__deck.state().text.trim() === w', arg=sl['narration'][q['step']].strip(), timeout=6000)
            page.evaluate('() => window.__deck.next()')
            page.wait_for_timeout(200)
            st = page.evaluate('() => window.__deck.state()')
            if (st['cur'], st['line']) != (i, q['step']):
                findings.append(f'{where}: the deck moved on before the question was answered')
            page.click(f'.slide.on .opt[data-j="{pick}"]')
            page.wait_for_timeout(SETTLE_MS)
            fb = page.inner_text('.slide.on .fb')
            if verdict.lower() not in fb.lower():   # displayed in capitals by the stylesheet
                findings.append(f'{where}: feedback should say "{verdict}", says "{fb[:60]}"')
            for f in page.evaluate(MEASURE):
                findings.append(f'{where}: {f}')
            page.evaluate('() => window.__deck.next()')
            page.wait_for_timeout(200)
            st = page.evaluate('() => window.__deck.state()')
            if (st['cur'], st['line']) == (i, q['step']):
                findings.append(f'{where}: the deck would not move on after the question was answered')
            # the feedback stays on screen while the slide's later cards appear beneath it, so
            # measure every remaining step WITH the answer shown (go() would reset it). A wrong
            # answer's longer feedback plus those cards overflowed while each passed alone.
            last = len(sl['narration']) - 1
            while st['cur'] == i and st['line'] <= last:
                page.wait_for_timeout(SETTLE_MS)
                for f in page.evaluate(MEASURE):
                    findings.append(f'{where}, then step {st["line"] + 1}: {f}')
                if st['line'] == last:
                    break
                page.evaluate('() => window.__deck.next()')
                page.wait_for_timeout(200)
                st = page.evaluate('() => window.__deck.state()')
    # links never move the slide on
    page.evaluate('() => window.__deck.go(0, 0)')
    page.wait_for_timeout(SETTLE_MS)
    link = page.query_selector('.slide.on a.sl')
    if link:
        before = page.evaluate('() => window.__deck.state()')
        with page.context.expect_page() as popup:
            link.click()
        popup.value.close()
        after = page.evaluate('() => window.__deck.state()')
        if (before['cur'], before['line']) != (after['cur'], after['line']):
            findings.append('links: clicking a source link moved the slide on')
    # the voice: turning it on must choose the preferred voice
    page.evaluate('() => window.__deck.toggleVoice()')
    page.wait_for_timeout(300)
    vname = page.evaluate('() => window.__deck.state().voiceName')
    if vname != deck['voice']['preferred']:
        findings.append(f'voice: chose "{vname}", not "{deck["voice"]["preferred"]}"')
    for m in console:
        findings.append(f'console: {getattr(m, "text", m)}')
    return findings, steps


def check_one(path):
    """Every check for one deck, at both window sizes, in this worker's own browser."""
    runs = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, h in ((1600, 900), (1280, 720)):
            ctx = browser.new_context()
            ctx.add_init_script(FAKE_SPEECH)
            page = ctx.new_page()
            findings, steps = check_deck(page, path, w, h)
            ctx.close()
            runs.append(((w, h), findings, steps))
        browser.close()
    return os.path.basename(path), runs


def main():
    decks = sorted(glob.glob(os.path.join(ROOT, 'decks', 'ch*.html')))
    only = sys.argv[1:]
    if only:   # a chapter prefix (ch01) or an explicit file, e.g. the template as a control
        decks = [o for o in only if os.path.isfile(o)] + \
                [d for d in decks if any(os.path.basename(d).startswith(o) for o in only if not os.path.isfile(o))]
    if not decks:
        print('FAIL no decks/ch*.html found — nothing was checked (run tools/build_decks.js)')
        return 1
    # Decks are independent, so they run in parallel, one browser per worker (DECK_JOBS,
    # default 4). Each deck's checks are exactly the same as before; only the scheduling
    # changed — at 87 decks one browser in sequence ran past the 2-hour job limit.
    jobs = max(1, int(os.environ.get('DECK_JOBS', '4')))
    from concurrent.futures import ProcessPoolExecutor
    bad, total_steps = 0, 0
    with ProcessPoolExecutor(max_workers=min(jobs, len(decks))) as ex:
        for name, runs in ex.map(check_one, decks):
            for (w, h), findings, steps in runs:
                total_steps += steps
                if findings:
                    bad += 1
                    print(f'FAIL {name} at {w}x{h}: {len(findings)} finding(s)')
                    for f in findings[:60]:
                        print('  ' + f)
                    if len(findings) > 60: print(f'  … and {len(findings) - 60} more')
                else:
                    print(f'PASS {name} at {w}x{h} ({steps} steps)', flush=True)
    runs = len(decks) * 2
    print(f'{runs - bad}/{runs} deck runs pass · {len(decks)} deck(s) · {total_steps} steps measured')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
