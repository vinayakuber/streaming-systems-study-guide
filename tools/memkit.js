'use strict';
/*
 * memkit.js — the PROGRAM band engine, factored out of gen_rle_memory.js and
 * gen_segment_memory.js after the third one was needed.
 *
 * A concept's PROGRAM walkthrough is always the same shape: a source listing, a
 * stack of call frames with their locals, a heap of allocated objects with
 * addresses, and a caption per step. Only the listing, the frames and the heap
 * differ. Writing that shell a third time by hand is how the hardcoded-canvas
 * and ambiguous-highlight defects got reintroduced, so it lives here once.
 *
 * WHAT THIS GUARANTEES FOR EVERY CALLER
 *   - canvas height DERIVED from the listing length (R50) — never typed
 *   - highlights addressed by CONTENT, and a needle matching 0 or >1 lines THROWS (R36)
 *   - heap values MEASURED and wrapped, box sized to the wrapped line count
 *   - indentation preserved (xml:space) so a listing looks like code
 *   - static fallback = exactly frame 1 (R39)
 *   - geometry validated per frame before anything is written (R26/R27)
 */
const fs = require('fs'), path = require('path');
const { Canvas, animate, attr } = require('./svgkit.js');

const C = { ink: '#1b2430', line: '#5b6b7f', faint: '#c6d0db', dim: '#8a97a6',
  hot: '#e11d48', hotFill: '#ffe4e6', stack: '#eff6ff', stackEdge: '#2563eb',
  heap: '#f0fdf4', heapEdge: '#16a34a', panel: '#f8fafc' };

/**
 * @param {object} spec
 *   src        {string[]}  the source listing, one entry per line
 *   steps      {object[]}  { t, needles:[...], stack:[{name,locals[]}], heap:[{key,st,hot}], cap }
 *   heap       {object}    key -> { addr, type, val(state) -> string }
 *   title      {string}
 *   subtitle   {string}    top-right, usually the seed
 *   out        {string}    diagrams/anim/<name>
 *   name       {string}    file stem
 *   srcW/stkW/hpW {number} panel widths (default 516/244/280 -> W 1120)
 */
function buildMemoryWalkthrough(spec) {
  const { src: SRC, steps: STEPS, heap: HEAP, title, subtitle, out: OUTDIR, name } = spec;
  // The SOURCE panel's WIDTH is measured from the longest listing line, exactly as
  // its height is derived from the line count (R50). A typed 516 was the same
  // defect one axis over: it fit the first listing and clipped the next one.
  const RATIO_MONO = 0.602, SRC_SIZE = 11;
  const widest = SRC.reduce((m, ln, i) =>
    Math.max(m, Math.ceil((String(i + 1).padStart(2, ' ') + '  ' + ln).length * SRC_SIZE * RATIO_MONO)), 0);
  const srcW = spec.srcW || (widest + 28);
  const stkW = spec.stkW || 244, hpW = spec.hpW || 280;
  const W = 24 + srcW + 16 + stkW + 16 + hpW + 24;

  // ---- content addressing. A needle matching zero lines or many lines is a
  // hard error: the first silently highlights nothing, the second silently
  // highlights the wrong line (this shipped once as "step 3 of 16" pointing
  // inside the wrong function).
  // A needle may be SCOPED as "anchor>needle": find `anchor` first, then the next
  // `needle` at or after it. Two functions legitimately contain the same line
  // (`for (c in COLUMNS)`, `return cost`), and without scoping the author must
  // invent a distinguishing comment for each one — friction that recurs for every
  // concept and tempts a weaker, non-throwing lookup. Scoping keeps the hard
  // guarantee (0 or >1 matches is an error) while making the common case easy.
  // The separator is '::', NOT '>'. It was '>' at first, and '>' occurs constantly in
  // the code being matched: a needle like `return watermarkAfter(i) >= W0 + WIN` was
  // silently re-read as scope `return watermarkAfter(i) ` plus needle `= W0 + WIN`.
  // That usually resolved to the right line by luck — both halves come from the same
  // line — so it passed for a long corpus, and then threw AMBIGUOUS on an unrelated
  // listing. A separator must be a string that cannot appear in the input.
  const at = (...needles) => needles.map(spec => {
    if ((spec.match(/::/g) || []).length > 1)
      throw new Error(`[${name}] needle has more than one '::' separator: ${JSON.stringify(spec)}`);
    const i = spec.indexOf('::');
    const [scope, nd] = i === -1 ? [null, spec] : [spec.slice(0, i), spec.slice(i + 2)];
    let from = 0;
    if (scope !== null) {
      const anchors = SRC.map((l, i) => l.includes(scope) ? i : -1).filter(i => i !== -1);
      if (anchors.length === 0) throw new Error(`[${name}] scope not found: "${scope}" (in "${spec}")`);
      if (anchors.length > 1) throw new Error(`[${name}] AMBIGUOUS scope "${scope}" matches lines ${anchors.map(i => i + 1).join(', ')}`);
      from = anchors[0];
    }
    const hits = SRC.map((l, i) => (i >= from && l.includes(nd)) ? i : -1).filter(i => i !== -1);
    if (hits.length === 0) throw new Error(`[${name}] source line not found: "${nd}"${scope ? ` after "${scope}"` : ''}`);
    if (scope !== null) return hits[0];            // first match inside the scope
    if (hits.length > 1)
      throw new Error(`[${name}] AMBIGUOUS needle "${nd}" matches lines ${hits.map(i => i + 1).join(', ')} — make it unique, or scope it as "enclosingFunction::${nd}"`);
    return hits[0];
  });
  const lineOf = (needle) => at(needle)[0] + 1;
  const linesWith = (needle) => SRC.map((l, i) => l.includes(needle) ? i + 1 : 0).filter(Boolean);

  // ---- FIT: every dimension computed from the listing (R50)
  const LH = 17, PAN_Y = 78, CAP_LINES = 4, CAP_LH = 17;
  const PAN_H = SRC.length * LH + 26;
  const Y = { title: 34, step: PAN_Y + PAN_H + 34, cap: PAN_Y + PAN_H + 66 };
  const H = Y.cap + CAP_LINES * CAP_LH + 6;
  // The STACK and HEAP panels are measured from the steps, exactly as the SOURCE
  // panel is measured from the listing. They cannot be measured at construction
  // because the steps arrive at emit(), so `cv` and `P` are rebuilt there — see
  // relayout(). A typed panel width is a latent overflow that only fires when
  // someone writes a longer local, which is the worst time to discover it.
  let cv = Canvas(W, H);
  let P = { src: { x: 24, y: PAN_Y, w: srcW, h: PAN_H },
            stk: { x: 24 + srcW + 16, y: PAN_Y, w: stkW, h: PAN_H },
            hp:  { x: 24 + srcW + 16 + stkW + 16, y: PAN_Y, w: hpW, h: PAN_H } };
  let CW = W;
  function relayout(steps) {
    const probe = Canvas(10, 10);
    let wideLocal = 0, wideFrame = 0;
    for (const st of steps) for (const f of (st.stack || [])) {
      wideFrame = Math.max(wideFrame, probe.textW(f.name, 12, true));
      for (const l of (f.locals || [])) wideLocal = Math.max(wideLocal, probe.textW(String(l), 11, true));
    }
    const needStk = Math.max(stkW, Math.max(wideLocal + 36, wideFrame + 30));
    let wideHead = 0, wideVal = 0;
    for (const k of Object.keys(HEAP)) {
      wideHead = Math.max(wideHead, probe.textW(`${HEAP[k].addr}  ${k} : ${HEAP[k].type}`, 11, true));
    }
    const needHp = Math.max(hpW, wideHead + 28);
    if (needStk === stkW && needHp === hpW) return;
    CW = 24 + srcW + 16 + needStk + 16 + needHp + 24;
    cv = Canvas(CW, H);
    P = { src: { x: 24, y: PAN_Y, w: srcW, h: PAN_H },
          stk: { x: 24 + srcW + 16, y: PAN_Y, w: needStk, h: PAN_H },
          hp:  { x: 24 + srcW + 16 + needStk + 16, y: PAN_Y, w: needHp, h: PAN_H } };
  }

  const panel = (p, t, band) =>
    cv.rect(band, p.x, p.y, p.w, p.h, { fill: C.panel, stroke: C.faint }) +
    cv.text(p.x + 10, p.y - 8, t, { size: 12, weight: 700, mono: false, fill: C.line, band: band + 'h' });

  function drawSource(hot) {
    let s = panel(P.src, 'SOURCE', 'src');
    SRC.forEach((ln, i) => {
      const y = P.src.y + 18 + i * LH;
      if (hot.includes(i)) s += cv.rect('srcHot' + i, P.src.x + 6, y - 12, P.src.w - 12, 16, { fill: C.hotFill, stroke: C.hot, rx: 3 });
      s += cv.text(P.src.x + 12, y, String(i + 1).padStart(2, ' ') + '  ' + ln,
        { size: 11, fill: hot.includes(i) ? C.hot : C.ink, weight: hot.includes(i) ? 700 : 400, band: 'src' + i, preserve: true });
    });
    return s;
  }
  function drawStack(frames) {
    let s = panel(P.stk, 'STACK  (grows downward)', 'stk');
    let y = P.stk.y + 14;
    frames.forEach((f, fi) => {
      // Same rule as the heap items below: a field the renderer never reads is a
      // typo that ships silently, so only the two it reads are allowed.
      for (const k of Object.keys(f))
        if (!['name', 'locals'].includes(k))
          throw new Error(`[${name}] stack frame "${f.name}" has unknown field "${k}" — a frame carries only {name, locals}.`);
      const h = 26 + f.locals.length * 18;
      s += cv.rect('frm' + fi, P.stk.x + 10, y, P.stk.w - 20, h, { fill: C.stack, stroke: C.stackEdge, sw: fi === frames.length - 1 ? 2 : 1 });
      s += cv.text(P.stk.x + 20, y + 17, f.name, { size: 12, weight: 700, band: 'frm' + fi });
      f.locals.forEach((l, li) => { s += cv.text(P.stk.x + 26, y + 34 + li * 18, l, { size: 11, fill: C.ink, band: `frm${fi}l${li}` }); });
      y += h + 10;
    });
    return s;
  }
  function drawHeap(items) {
    let s = panel(P.hp, 'HEAP  (allocated objects)', 'hp');
    let y = P.hp.y + 14;
    const inner = P.hp.w - 36;
    items.forEach((it, i) => {
      const o = HEAP[it.key];
      if (!o) throw new Error(`[${name}] step references heap key "${it.key}" which is not declared`);
      // A MISSPELT STATE KEY IS SILENT, AND THAT IS THE DANGEROUS KIND.
      //   The state selector is `st`. Writing `val: 0` instead (the name used in the
      //   HEAP DECLARATION, which is why the slip is natural) leaves `it.st`
      //   undefined, so val() returns the FULL value while the caption next to it
      //   says the array is empty. Nothing crashes, no gate looks at pixels against
      //   prose, and the frame ships lying. The only cheap defence is to refuse any
      //   key the renderer does not read, so the typo fails loudly at build time.
      for (const k of Object.keys(it))
        if (!['key', 'st', 'hot'].includes(k))
          throw new Error(`[${name}] heap step item {key:"${it.key}"} has unknown field "${k}" — the state selector is "st" (hot is the only other field). A field the renderer ignores would silently show the wrong state.`);
      // A heap value's width is data-dependent, so the box height must be too.
      const lines = cv.wrap(o.val(it.st), inner, 10, true);
      const h = 27 + lines.length * 14;
      s += cv.rect('hp' + i, P.hp.x + 10, y, P.hp.w - 20, h, { fill: it.hot ? C.hotFill : C.heap, stroke: it.hot ? C.hot : C.heapEdge, sw: it.hot ? 2 : 1 });
      s += cv.text(P.hp.x + 18, y + 17, `${o.addr}  ${it.key} : ${o.type}`, { size: 11, weight: 700, band: 'hp' + i });
      lines.forEach((ln, li) => { s += cv.text(P.hp.x + 18, y + 31 + li * 14, ln, { size: 10, fill: C.ink, band: `hpv${i}_${li}` }); });
      y += h + 8;
    });
    return s;
  }

  const render = (s, i) =>
      cv.text(24, Y.title, title, { size: 15, weight: 700, mono: false, band: 'title' })
    + cv.text(CW - 24, Y.title, subtitle, { size: 11, anchor: 'end', fill: C.dim, band: 'seed' })
    + drawSource(s.line) + drawStack(s.stack) + drawHeap(s.heap)
    + cv.text(CW / 2, Y.step, `Step ${i + 1}/${STEPS.length} — ${s.t}`, { size: 15, weight: 700, mono: false, anchor: 'middle', band: 'steplbl' })
    + cv.textBlock(CW / 2, Y.cap, s.cap, { maxLines: CAP_LINES, maxPx: CW - 120 });

  // The steps handed to emit() are remembered, because embed() used to read
  // spec.steps — which a caller that builds its steps AFTER calling the kit
  // passes as []. The result was an embed.md with the animation and zero step
  // stills, which no geometry check can see. Now embed() cannot run without them.
  let EMITTED = null;
  return { at, lineOf, linesWith, W, H, srcW, widest,
    emit(finalSteps) {
      const ST = finalSteps || STEPS;
      if (!ST || !ST.length) throw new Error(`[${name}] emit() got no steps — a walkthrough with zero steps is not a walkthrough`);
      relayout(ST);
      EMITTED = ST;
      fs.mkdirSync(path.join(OUTDIR, 'frames'), { recursive: true });
      let errs = [];
      ST.forEach((s, i) => {
        cv.reset();
        const body = render(s, i);
        errs = errs.concat(cv.validate(`frame ${i + 1}`));
        fs.writeFileSync(path.join(OUTDIR, 'frames', `step-${String(i + 1).padStart(2, '0')}.svg`), cv.head(s.t) + body + '</svg>');
      });
      const a = animate(cv, ST, 5.0, render);
      errs = errs.concat(a.errs);
      fs.writeFileSync(path.join(OUTDIR, `${name}.svg`), a.svg);
      fs.writeFileSync(path.join(OUTDIR, 'source.json'), JSON.stringify({ src: SRC }, null, 2));
      // Publish the STEPS too: tools/stack_gate.js checks that every local the
      // listing declares is actually shown in the frame at that moment, and it
      // cannot check what it cannot see.
      fs.writeFileSync(path.join(OUTDIR, 'steps.json'), JSON.stringify(
        { name, steps: ST.map(s => ({ t: s.t, line: s.line, stack: s.stack })) }, null, 2));
      if (errs.length) { console.error('GEOMETRY FAIL:\n' + errs.slice(0, 10).join('\n')); process.exit(1); }
      return { total: a.total, W: CW, H, steps: ST.length };
    },
    embed(opts) {
      const { heading, intro, sub, rel } = opts;
      if (!EMITTED) throw new Error(`[${name}] embed() called before emit() — there are no steps to write`);
      const ST = EMITTED;
      const md = [`<!-- ${name}:begin — generated by tools/${opts.gen}; do not hand-edit -->`, '',
        `#### ${heading}`, ''].concat(intro, ['',
        'The animation steps through the code, holding each line long enough to read the STACK (call frames and their locals) and the HEAP (allocated arrays and objects) as they are AT THAT MOMENT. Expand any step to study it on its own.', '',
        `<img src="${rel}/${name}.svg" alt="${attr(heading)}, ${attr(ST.length)} steps showing stack and heap" width="980">`, '']);
      ST.forEach((s, i) => {
        md.push('<details>');
        md.push(`<summary><b>Step ${i + 1} of ${ST.length}</b> — ${s.t}</summary>`);
        md.push('');
        md.push(`<img src="${rel}/frames/step-${String(i + 1).padStart(2, '0')}.svg" alt="Step ${attr(i + 1)}: ${attr(s.t)}" width="980">`);
        md.push('');
        md.push(s.cap);
        md.push('');
        md.push('</details>');
      });
      md.push('', `<sub>${sub}</sub>`, '', `<!-- ${name}:end -->`);
      fs.writeFileSync(path.join(OUTDIR, 'embed.md'), md.join('\n') + '\n');
    } };
}
module.exports = { buildMemoryWalkthrough, C };
