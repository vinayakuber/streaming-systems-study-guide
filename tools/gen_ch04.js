#!/usr/bin/env node
'use strict';
/* gen_ch04.js — ch04's four concepts, both bands each: the three window shapes,
 * the window lifecycle, session semantics, and session analytics.
 *
 * The honest finding this chapter rests on: whether a session needs a RETRACTION
 * is decided by the gap setting, not by the data. At the book's gap the straggler
 * arrives one event before its session is collected, so no retraction is needed;
 * at a smaller gap the same stream forces one. Both are computed here. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, GAP, WATERMARKS, WINDOWS, WIN_STARTS, winOf, SESSIONS, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const L = EVENTS.find(e => e.id === 7), LI = EVENTS.indexOf(L);
const PERIOD = WIN / 2;
const slidingStarts = (et) => { const o = []; for (let k = 0; k * PERIOD <= et; k++) { const st = k * PERIOD; if (et < st + WIN) o.push(st); } return o; };
// sessions for one key at an arbitrary gap, over a chosen prefix of the stream
const sessionsOf = (key, gap, upto = EVENTS.length - 1) => {
  const es = EVENTS.filter((e, i) => i <= upto && e.key === key).sort((a, b) => a.et - b.et);
  const out = [];
  for (const e of es) {
    const last = out[out.length - 1];
    if (last && e.et - last.end <= gap) { last.end = e.et; last.ids.push(e.id); }
    else out.push({ start: e.et, end: e.et, ids: [e.id] });
  }
  return out;
};
const GAPS = [GAP / 3, GAP, GAP + 10, GAP * 2.5];
const GAP_SWEEP = GAPS.map(g => ({ gap: g, counts: Object.fromEntries(KEYS.map(k => [k, sessionsOf(k, g).length])) }));
// sessions IGNORING the key — the mistake, and what it costs
const sessionsIgnoringKey = (gap) => {
  const es = EVENTS.slice().sort((a, b) => a.et - b.et);
  const out = [];
  for (const e of es) { const last = out[out.length - 1];
    if (last && e.et - last.end <= gap) { last.end = e.et; last.ids.push(e.id); } else out.push({ start: e.et, end: e.et, ids: [e.id] }); }
  return out;
};
const UNKEYED = sessionsIgnoringKey(GAP);
const KEYED_TOTAL = KEYS.reduce((n, k) => n + sessionsOf(k, GAP).length, 0);
// the cross-key near miss: an event of ONE key sitting inside another key's gap
const B_SESS = sessionsOf('b', GAP);
const CROSS = EVENTS.find(e => e.key === 'a' && e.et > B_SESS[0].end && e.et < B_SESS[1].start
                               && e.et - B_SESS[0].end <= GAP);
// MERGES: the session state of one key after each of its arrivals, in PROCESSING order
const MERGE_KEY = 'b';
const mergeTrace = (gap) => EVENTS.map((e, i) => e.key === MERGE_KEY ? { i, e, sess: sessionsOf(MERGE_KEY, gap, i) } : null).filter(Boolean);
const MERGES = mergeTrace(GAP);
const MERGE_EVENTS = MERGES.filter((m, j) => j > 0 && m.sess.some(s => s.ids.includes(m.e.id) && s.ids.length > 1));
// when is a session COLLECTED? when the watermark passes end + gap
const collectedAt = (sess, gap) => { const i = WATERMARKS.findIndex(w => w >= sess.end + gap); return i === -1 ? null : i; };
// RETRACTION: a session needs one iff it was collected BEFORE its final member arrived
const retractionAt = (gap) => {
  const out = [];
  for (const k of KEYS) for (const s of sessionsOf(k, gap)) {
    const lastArrival = Math.max(...s.ids.map(id => EVENTS.indexOf(EVENTS.find(e => e.id === id))));
    // the session as it stood when it was first emitted
    const emitIdx = (() => { for (let i = 0; i < EVENTS.length; i++) {
        const partial = sessionsOf(k, gap, i).find(x => x.ids.some(id => s.ids.includes(id)));
        if (partial && WATERMARKS[i] >= partial.end + gap) return i; } return null; })();
    if (emitIdx !== null && emitIdx < lastArrival) {
      const before = sessionsOf(k, gap, emitIdx).find(x => x.ids.some(id => s.ids.includes(id)));
      out.push({ key: k, gap, emitIdx, lastArrival, before, after: s });
    }
  }
  return out;
};
const RETR_AT_GAP = retractionAt(GAP);
const SMALL_GAP = GAPS[0];
const RETR_SMALL = retractionAt(SMALL_GAP);
const R = RETR_SMALL[0];
const MARGIN = collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP) - LI;
const fail = (m) => { throw new Error(`gen_ch04: ${m}`); };
if (new Set(GAP_SWEEP.map(g => g.counts.a)).size < 3) fail(`the gap sweep gives only ${new Set(GAP_SWEEP.map(g => g.counts.a)).size} distinct session counts for key a — "the gap is the answer" would not be visible`);
if (UNKEYED.length >= KEYED_TOTAL) fail(`ignoring the key gives ${UNKEYED.length} sessions against ${KEYED_TOTAL} keyed — the keying lesson needs a drop`);
if (!CROSS) fail('no event of one key sits inside another key\'s session gap — the cross-key near miss cannot be shown');
if (MERGE_EVENTS.length < 2) fail(`only ${MERGE_EVENTS.length} arrival(s) merge into an existing session — the merge step needs at least two`);
if (RETR_AT_GAP.length !== 0) fail(`gap ${GAP} already forces ${RETR_AT_GAP.length} retraction(s); the chapter's contrast assumes it does not`);
if (RETR_SMALL.length === 0) fail(`gap ${SMALL_GAP} forces no retraction either — there would be no retraction case anywhere in this stream`);
if (MARGIN <= 0) fail('the straggler arrives after its session was collected at the book gap, contradicting the no-retraction finding');
if (SUM(R.after.ids) <= SUM(R.before.ids)) fail('the retraction does not change the value');

const W = 1140;
const secs = (n) => `${n}s`;
const mm = (sec) => hhmmss(sec).slice(0, 5);
const sTxt = (s) => `[${hhmmss(s.start)}, ${hhmmss(s.end)}] ids ${s.ids.join(',')} sum ${SUM(s.ids)}`;

// ======================== CONCEPT 1 — WINDOW SHAPES =========================
const C1 = [
  { t: 'fixed windows partition time: one event, one window', draw: (c) =>
      c.panel(`FIXED (TUMBLING) — ${secs(WIN)} EACH, NO OVERLAP, NO GAPS`, 'a')
      + c.mapRows('fx', c.P.main.x + 24, c.P.main.y + 52, WIN_STARTS.map(w =>
          [`[${mm(w)}, ${mm(w + WIN)})`, `ids ${WINDOWS[w].join(', ')} · sum ${SUM(WINDOWS[w])}`]),
        { w: 1040, rh: 32, label: `every one of the ${EVENTS.length} events is in exactly one row` })
      + c.note('f1', c.P.main.x + 24, c.P.main.y + 66 + WIN_STARTS.length * 32, 1040, [
        `The sums total ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}, which is the whole dataset — because the windows partition event time.`,
        `This is the shape that reconciles against a batch job: "how many per ${secs(WIN)}" has one answer per period and no double counting.`,
      ], c.C.good, c.C.goodFill),
    cap: `Fixed windows are the easy case and the one to reach for by default. Equal length, contiguous, non-overlapping — so each of the ${EVENTS.length} events appears exactly once and the ${WIN_STARTS.length} sums add to ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}. If a question names a period ("per minute", "per hour"), this is the shape, and nothing else needs considering.` },
  { t: 'sliding windows overlap: one event, several windows', draw: (c) => {
      let s = c.panel(`SLIDING — ${secs(WIN)} WIDE, STARTING EVERY ${secs(PERIOD)}`, 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'how many windows each event belongs to, under each shape', { size: 11, weight: 700, fill: c.C.line });
      EVENTS.forEach((e, i) => {
        const y = c.P.main.y + 64 + i * 30, n = slidingStarts(e.et).length;
        s += c.cv.rect('sl' + i, c.P.main.x + 24, y, 1040, 26, { fill: n > 1 ? c.C.warnFill : c.C.paper, stroke: n > 1 ? c.C.warn : c.C.faint, rx: 3, sw: n > 1 ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 18, `id ${e.id} · et ${hhmmss(e.et)} · v ${e.v}`, { size: 11, band: 'slk' + i });
        s += c.cv.text(c.P.main.x + 330, y + 18, `fixed: 1 window (${mm(winOf(e.et))})`, { size: 11, band: 'slf' + i });
        s += c.cv.text(c.P.main.x + 620, y + 18, `sliding: ${n} window${n > 1 ? 's' : ''} (${slidingStarts(e.et).map(mm).join(', ')})`, { size: 11, weight: n > 1 ? 700 : 400, fill: n > 1 ? c.C.warn : c.C.ink, band: 'sls' + i });
      });
      return s + c.note('s1', c.P.main.x + 24, c.P.main.y + 78 + EVENTS.length * 30, 1040, [
        `${EVENTS.filter(e => slidingStarts(e.et).length > 1).length} of the ${EVENTS.length} events land in ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} windows at once, so the sliding results total ${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)} against the dataset's ${EVENTS.reduce((n, e) => n + e.v, 0)}.`,
        `Output volume scales with WIN / PERIOD = ${WIN} / ${PERIOD} = ${WIN / PERIOD}x. That is the cost of a smooth moving measure.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `Sliding windows answer "the rolling ${secs(WIN)} figure, refreshed every ${secs(PERIOD)}". Read the third column: ${EVENTS.filter(e => slidingStarts(e.et).length > 1).length} events are in ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} windows, which is why the totals cannot be compared to the input. The first few events are in one window only because event time starts at ${mm(0)} — there is no window before it.` },
  { t: 'session windows are defined by the DATA, not the clock', draw: (c) =>
      c.panel(`SESSIONS — A BURST, SEPARATED BY ${secs(GAP)} OF SILENCE`, 'a')
      + c.mapRows('se', c.P.main.x + 24, c.P.main.y + 52, KEYS.flatMap(k =>
          sessionsOf(k, GAP).map((s, j) => [`key "${k}" session ${j + 1}`, sTxt(s)])),
        { w: 1040, rh: 32, label: `key a gets ${sessionsOf('a', GAP).length} sessions, key b gets ${sessionsOf('b', GAP).length} — from the same stream` })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 66 + KEYED_TOTAL * 32, 1040, [
        `No session has the same length as any other, and none starts on a round boundary. Both facts follow from the boundaries being set by the DATA.`,
        `Key a gets ${sessionsOf('a', GAP).length} and key b gets ${sessionsOf('b', GAP).length} over the same ${secs(Math.max(...EVENTS.map(e => e.et)))} of event time, because they were active at different moments.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Sessions model behaviour rather than counting. Every boundary here was chosen by a silence of more than ${secs(GAP)}: key a's first session ends at ${hhmmss(sessionsOf('a', GAP)[0].end)} because its next activity is ${secs(sessionsOf('a', GAP)[1].start - sessionsOf('a', GAP)[0].end)} later. That is why two users over one time span get ${sessionsOf('a', GAP).length} and ${sessionsOf('b', GAP).length} sessions, not the same number.` },
  { t: 'and the gap is part of the ANSWER, not a tuning knob', draw: (c) => {
      let s = c.panel('THE SAME STREAM, FOUR GAP SETTINGS', 'p');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'session count per key, as the gap grows', { size: 11, weight: 700, fill: c.C.line });
      GAP_SWEEP.forEach((g, i) => {
        const y = c.P.main.y + 64 + i * 36, book = g.gap === GAP;
        s += c.cv.rect('gs' + i, c.P.main.x + 24, y, 1040, 32, { fill: book ? c.C.goodFill : c.C.paper, stroke: book ? c.C.good : c.C.faint, rx: 3, sw: book ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 21, `gap = ${secs(g.gap)}${book ? '  (this book)' : ''}`, { size: 11, weight: 700, band: 'gsk' + i });
        KEYS.forEach((k, j) => s += c.cv.text(c.P.main.x + 320 + j * 260, y + 21, `key "${k}": ${g.counts[k]} session${g.counts[k] > 1 ? 's' : ''}`, { size: 11, band: `gsv${i}_${j}` }));
      });
      return s + c.note('g1', c.P.main.x + 24, c.P.main.y + 78 + GAP_SWEEP.length * 36, 1040, [
        `Key a goes ${GAP_SWEEP.map(g => g.counts.a).join(' → ')} sessions as the gap grows. The events never change; only the definition of "a visit" does.`,
        `So "how many sessions did this user have?" has no answer until someone states the gap. It is a product definition that happens to be typed into a config file.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is the step that matters most in practice. Key a has ${GAP_SWEEP.map(g => g.counts.a).join(', ')} sessions at gaps of ${GAPS.map(g => secs(g)).join(', ')} — four different answers from identical data. The gap is not a performance setting; it is the operational definition of "a visit", and choosing it is the product decision the engineering work is downstream of.` },
];

// ======================== CONCEPT 2 — THE LIFECYCLE ==========================
const C2 = [
  { t: 'ASSIGN — by event time, and possibly to several windows', draw: (c) =>
      c.panel('STEP 1 OF 4 — ASSIGN', 'a')
      + c.mapRows('as', c.P.main.x + 24, c.P.main.y + 52, [
        [`fixed: id ${EVENTS[4].id} (et ${hhmmss(EVENTS[4].et)})`, `1 window: [${mm(winOf(EVENTS[4].et))}, ${mm(winOf(EVENTS[4].et) + WIN)})`],
        [`sliding: the same event`, `${slidingStarts(EVENTS[4].et).length} windows: ${slidingStarts(EVENTS[4].et).map(w => `[${mm(w)}, ${mm(w + WIN)})`).join(', ')}`],
        [`session: the same event`, `1 window, whose BOUNDS are not known yet`],
        [`what assign reads`, `e.et and the windowing function — never the arrival time`],
      ], { w: 1040, rh: 36, hot: 2, label: 'one event, three windowings, three different assignments' })
      + c.note('a1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The session row is the odd one: an event is assigned to a session whose START and END are still provisional, because a later event can extend either.`,
        `That is the whole reason the next step exists. Fixed and sliding assignments are final at assign time; session assignments are not.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Assign reads \`e.et\` and the windowing rule, and nothing else. For fixed and sliding that settles the question permanently. For a session it does not: id ${EVENTS[4].id} joins a session whose bounds depend on events that have not arrived — so a session assignment is a hypothesis, and the merge step is what revises it.` },
  { t: 'MERGE — a later arrival can absorb an existing session', draw: (c) => {
      let s = c.panel(`STEP 2 OF 4 — MERGE (key "${MERGE_KEY}", in processing order)`, 'a');
      MERGES.forEach((m, j) => {
        const y = c.P.main.y + 58 + j * 40, merged = MERGE_EVENTS.includes(m);
        s += c.cv.rect('mg' + j, c.P.main.x + 24, y, 1040, 36, { fill: merged ? c.C.goodFill : c.C.paper, stroke: merged ? c.C.good : c.C.faint, rx: 3, sw: merged ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 23, `id ${m.e.id} arrives (et ${hhmmss(m.e.et)})`, { size: 11, weight: 700, band: 'mgk' + j });
        s += c.cv.text(c.P.main.x + 300, y + 23, m.sess.map(x => `[${hhmmss(x.start).slice(3)}–${hhmmss(x.end).slice(3)}]`).join('  '), { size: 11, band: 'mgv' + j });
        s += c.cv.text(c.P.main.x + 1050, y + 23, merged ? 'MERGED into a session' : 'new session', { size: 10, anchor: 'end', weight: 700, fill: merged ? c.C.good : c.C.dim, band: 'mgf' + j });
      });
      return s + c.note('m1', c.P.main.x + 24, c.P.main.y + 72 + MERGES.length * 40, 1040, [
        `${MERGE_EVENTS.length} of key "${MERGE_KEY}"'s ${MERGES.length} arrivals merge: id ${MERGE_EVENTS.map(m => m.e.id).join(' and id ')} each arrive OUT OF ORDER and extend a session backwards.`,
        `Note what that means: a session's START moved after the session existed. No other windowing has a boundary that can change.`,
      ], c.C.good, c.C.goodFill); },
    cap: `Watch the second column change shape as events arrive. id ${MERGE_EVENTS[0].e.id} (et ${hhmmss(MERGE_EVENTS[0].e.et)}) arrives after a later event and pulls a session's start backwards; id ${MERGE_EVENTS[1].e.id} does the same to the other one. Merging is what makes sessions dynamic — and it is also why a session's value can change after it has been reported.` },
  { t: 'GROUP and TRIGGER — state per (key, window)', draw: (c) =>
      c.panel('STEP 3 OF 4 — GROUP BY (KEY, WINDOW), THEN TRIGGER', 'a')
      + c.mapRows('gt', c.P.main.x + 24, c.P.main.y + 52, KEYS.flatMap(k =>
          sessionsOf(k, GAP).map(s => {
            const ci = collectedAt(s, GAP);
            return [`("${k}", ${sTxt(s)})`, ci === null ? 'never collected in this stream' : `watermark passes ${hhmmss(s.end + GAP)} at event ${ci}`];
          })), { w: 1040, rh: 32, label: 'one state entry per (key, window) pair — the unit everything downstream works on' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 66 + KEYED_TOTAL * 32, 1040, [
        `There are ${KEYED_TOTAL} state entries here, one per (key, session). The number of them is data-dependent, which fixed windows never are.`,
        `${sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(s => collectedAt(s, GAP) === null).length} of them is never collected in this stream, so its memory is held until the job ends.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The unit of streaming state is the (key, window) pair, and for sessions the NUMBER of those pairs depends on the data. ${KEYED_TOTAL} entries here; a quieter stream would give fewer and a burstier one more. That is the practical difference between sessions and fixed windows: you cannot size the state in advance.` },
  { t: 'ACCUMULATE and GARBAGE-COLLECT — on the watermark', draw: (c) =>
      c.panel('STEP 4 OF 4 — ACCUMULATE, THEN COLLECT', 'a')
      + c.mapRows('gc', c.P.main.x + 24, c.P.main.y + 52, [
        [`a session is NOT done when it looks idle`, `idleness is a fact about arrivals, not about event time`],
        [`it is done when the watermark passes end + gap`, `for key "${L.key}"'s session holding id ${L.id}: ${hhmmss(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).end + GAP)}`],
        [`that happens at event ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)}`, `and id ${L.id} arrived at event ${LI} — ${MARGIN} event${MARGIN > 1 ? 's' : ''} earlier`],
        [`so at gap ${secs(GAP)} no retraction is needed`, `the straggler landed before its session was collected`],
      ], { w: 1040, rh: 36, hot: 2, label: 'collection is a watermark event, and it is what bounds the memory' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The margin is ${MARGIN} event. Shrink the gap to ${secs(SMALL_GAP)} and the same session is collected at event ${R.emitIdx} while id ${L.id} arrives at event ${R.lastArrival} — and a retraction becomes mandatory.`,
        `So "does this pipeline need retractions?" is not answerable from the data alone. It depends on the gap, and here it turns on a single event.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The lifecycle ends where the memory does: a session's state is released when the watermark passes its end plus the gap. In this stream, at gap ${secs(GAP)}, that happens ${MARGIN} event AFTER the straggler arrives — so nothing has to be retracted. At gap ${secs(SMALL_GAP)} the order flips and a retraction is forced. The next concept follows that case all the way through.` },
];

// ======================== CONCEPT 3 — SESSION SEMANTICS =====================
const C3 = [
  { t: `at gap ${secs(SMALL_GAP)}, a late event forces a RETRACTION`, draw: (c) =>
      c.panel(`THE RETRACTION CASE — key "${R.key}", gap ${secs(SMALL_GAP)}`, 'a')
      + c.mapRows('rt', c.P.main.x + 24, c.P.main.y + 52, [
        [`the session as first emitted (event ${R.emitIdx})`, sTxt(R.before)],
        [`id ${EVENTS[R.lastArrival].id} arrives at event ${R.lastArrival} (et ${hhmmss(EVENTS[R.lastArrival].et)})`, `within ${secs(SMALL_GAP)} of the session's start — it belongs`],
        [`the session as it must now be`, sTxt(R.after)],
        [`so the pipeline must publish`, `retract ${SUM(R.before.ids)}, then emit ${SUM(R.after.ids)}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the window was already reported when the event that belongs to it arrived' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Without the retraction a consumer that adds panes reads ${SUM(R.before.ids) + SUM(R.after.ids)} for a session worth ${SUM(R.after.ids)}.`,
        `This is the ch02 accumulation question arriving with no choice attached: a session that changes shape MUST retract, because the old pane described a window that no longer exists.`,
      ], c.C.hot, c.C.hotFill),
    cap: `A session is the one windowing where the published thing can stop existing. At gap ${secs(SMALL_GAP)} the session ${sTxt(R.before)} is emitted at event ${R.emitIdx}; then id ${EVENTS[R.lastArrival].id} arrives and it becomes ${sTxt(R.after)} — a different window, with different bounds. The old pane is not stale, it is about something that is no longer there.` },
  { t: 'sessions are collected by the WATERMARK, not by looking idle', draw: (c) => {
      let s = c.panel('WHEN EACH SESSION IS ACTUALLY DONE', 'a');
      s += c.mapRows('gc', c.P.main.x + 24, c.P.main.y + 52, KEYS.flatMap(k =>
        sessionsOf(k, GAP).map(x => {
          const ci = collectedAt(x, GAP);
          return [`"${k}" ${sTxt(x)}`, ci === null ? `NEVER — watermark never reaches ${hhmmss(x.end + GAP)}` : `event ${ci}, when the watermark reaches ${hhmmss(WATERMARKS[ci])}`];
        })), { w: 1040, rh: 32, label: `a session ends at its last event; it is DONE at end + gap (${secs(GAP)}) in watermark terms` });
      return s + c.note('n1', c.P.main.x + 24, c.P.main.y + 66 + KEYED_TOTAL * 32, 1040, [
        `A session that has been silent for ${secs(GAP)} of WALL CLOCK may still grow — only the watermark passing end + gap rules that out.`,
        `And one session here is never collected at all, because the watermark never reaches ${hhmmss(sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(x => collectedAt(x, GAP) === null).map(x => x.end + GAP)[0])}. Its state is held for the life of the job.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `"Looks idle" and "is done" are different claims, and only the second one lets you free memory. Each row's right-hand column is a watermark event, not an elapsed time — and the last row shows the case that costs: a session nothing ever collects, holding its state until the pipeline stops.` },
  { t: 'sessions are per KEY — and the near miss proves it', draw: (c) =>
      c.panel('THE GAP IS MEASURED WITHIN A KEY', 'a')
      + c.mapRows('kk', c.P.main.x + 24, c.P.main.y + 52, [
        [`key "b" session 1 ends at`, hhmmss(B_SESS[0].end)],
        [`key "b" session 2 starts at`, `${hhmmss(B_SESS[1].start)} — a silence of ${secs(B_SESS[1].start - B_SESS[0].end)}, more than the ${secs(GAP)} gap`],
        [`id ${CROSS.id} (key "${CROSS.key}") has et`, `${hhmmss(CROSS.et)} — only ${secs(CROSS.et - B_SESS[0].end)} after session 1 ended`],
        [`does it join key "b"'s session?`, `NO — different key, so the gap never sees it`],
      ], { w: 1040, rh: 36, hot: 3, label: 'an event that would have merged, if the key were ignored' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Ignore the key and the ${KEYED_TOTAL} keyed sessions collapse to ${UNKEYED.length}, because events from different users fill in each other's silences.`,
        `id ${CROSS.id} is the concrete case: ${secs(CROSS.et - B_SESS[0].end)} after key "b" went quiet, well inside the gap — and correctly invisible to key "b".`,
      ], c.C.good, c.C.goodFill),
    cap: `This is why "sessions are keyed" is a correctness statement rather than an implementation note. id ${CROSS.id} sits ${secs(CROSS.et - B_SESS[0].end)} after key "b"'s first session ended, well within the ${secs(GAP)} gap — and it belongs to key "${CROSS.key}", so it must not extend key "b". Drop the keying and ${KEYED_TOTAL} sessions become ${UNKEYED.length}: users' activity merges into one fictional visit.` },
  { t: 'so the window shape IS part of the answer', draw: (c) =>
      c.panel('MATCH THE SHAPE TO THE QUESTION', 'p')
      + c.mapRows('ms', c.P.main.x + 24, c.P.main.y + 52, [
        [`"how many per ${secs(WIN)}?"`, `fixed — ${WIN_STARTS.length} answers totalling ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}`],
        [`"what is the rolling ${secs(WIN)} figure?"`, `sliding — ${WIN / PERIOD}x the output, totals not comparable to input`],
        [`"how long was each visit?"`, `sessions — ${sessionsOf('a', GAP).length} for key a, ${sessionsOf('b', GAP).length} for key b, at gap ${secs(GAP)}`],
        [`"how many visits did this user have?"`, `unanswerable until the gap is stated: ${GAP_SWEEP.map(g => g.counts.a).join(' / ')}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'four questions, four shapes — and one that needs a definition first' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Only the last row has no answer in the data. ${GAP_SWEEP.map(g => `${g.counts.a} at gap ${secs(g.gap)}`).join(', ')} — all correct, for different definitions of a visit.`,
        `Choosing the window shape is therefore part of specifying the question, which is why it is not an implementation detail.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The shape is chosen by reading the question, and the last row is the one that catches people out. "How many visits?" cannot be answered by any amount of engineering until someone fixes the gap — key a has ${GAP_SWEEP.map(g => g.counts.a).join(', ')} visits at ${GAPS.map(g => secs(g)).join(', ')}, and every one of those answers is right.` },
];

// ================ CONCEPT 4 — SESSION ANALYTICS (systemDesign) ==============
const C4 = [
  { t: 'the pipeline, and the stage that only sessions need', draw: (c) =>
      c.panel('SESSION ANALYTICS — SIX STAGES', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`event source`, `events with event time and a key`],
        [`window assigner`, `assigns to a session whose bounds are PROVISIONAL`],
        [`session merger`, `the stage fixed and sliding windows do not have`],
        [`keyed session state`, `${KEYED_TOTAL} entries here — a data-dependent count`],
        [`trigger / retraction emitter`, `must be able to un-say a published session`],
        [`analytics store`, `must accept a retraction, or the counts drift`],
      ], { w: 1040, rh: 34, hot: 2, label: 'the merger and the retraction emitter exist only because boundaries can move' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 268, 1040, [
        `Two of these six stages exist solely because a session's bounds can change after the fact: the merger and the retraction emitter.`,
        `So "we'll use session windows" is a decision that adds two components and a requirement on the downstream store. It is not a configuration change.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Name what sessions cost before designing with them. The merger and the retraction emitter have no equivalent in a fixed-window pipeline, and the analytics store acquires a hard requirement: it must accept a retraction. A store that can only append is not compatible with session windows at all, and that is discovered late if it is not named here.` },
  { t: 'the retraction, with real values', draw: (c) =>
      c.panel(`WHAT THE STORE RECEIVES — key "${R.key}", gap ${secs(SMALL_GAP)}`, 'a')
      + c.mapRows('sq', c.P.main.x + 24, c.P.main.y + 52, [
        [`event ${R.emitIdx} — session emitted`, `${sTxt(R.before)} → store holds ${SUM(R.before.ids)}`],
        [`event ${R.lastArrival} — id ${EVENTS[R.lastArrival].id} arrives (et ${hhmmss(EVENTS[R.lastArrival].et)})`, `it belongs to that session, which is already published`],
        [`the emitter must send`, `retract ${SUM(R.before.ids)} for ${sTxt(R.before).split(' ids')[0]}, then emit ${SUM(R.after.ids)} for ${sTxt(R.after).split(' ids')[0]}`],
        [`store, if it ignores the retraction`, `${SUM(R.before.ids) + SUM(R.after.ids)} for a session worth ${SUM(R.after.ids)} — ${Math.round(100 * SUM(R.before.ids) / SUM(R.after.ids))}% over`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the window identity changes, not just its value' })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Note the retraction names the OLD BOUNDS. A store keyed by session bounds has a row for ${sTxt(R.before).split(' ids')[0]} that must be deleted, not updated — the new session has a different key.`,
        `That is the practical difference from a fixed window's retraction, where the key stays the same and only the value moves.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The sharp detail is in the note: a fixed window's correction updates a row, and a session's correction **deletes one row and inserts another**, because the session's bounds are its identity. A store keyed by (key, session start) cannot express that as an update — and a pipeline that emits only the new value leaves the old row behind, reading ${SUM(R.before.ids) + SUM(R.after.ids)} where ${SUM(R.after.ids)} is right.` },
  { t: 'the two settings that decide the whole design', draw: (c) =>
      c.panel('GAP AND ALLOWED LATENESS, TOGETHER', 'a')
      + c.mapRows('kb', c.P.main.x + 24, c.P.main.y + 52, [
        [`gap = ${secs(GAP)} (this book)`, `key a: ${sessionsOf('a', GAP).length} sessions · ${RETR_AT_GAP.length} retractions needed`],
        [`gap = ${secs(SMALL_GAP)}`, `key a: ${sessionsOf('a', SMALL_GAP).length} sessions · ${RETR_SMALL.length} retraction needed`],
        [`the gap decides BOTH`, `how many sessions exist, AND whether retraction is required`],
        [`allowed lateness decides`, `how long a collected session can still be revived — i.e. the memory bill`],
      ], { w: 1040, rh: 36, hot: 2, label: 'one setting with two consequences, and one that prices the first' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A smaller gap means more sessions AND earlier collection, which is what creates the retraction: the session was closed before its straggler arrived.`,
        `So tightening the gap to get cleaner "visits" silently turns on the requirement that the store accept deletions. The two consequences are not independent.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The coupling in the note is the thing to take away. Shrinking the gap from ${secs(GAP)} to ${secs(SMALL_GAP)} changes key a from ${sessionsOf('a', GAP).length} to ${sessionsOf('a', SMALL_GAP).length} sessions — and simultaneously makes ${RETR_SMALL.length} retraction mandatory, because sessions now close before the straggler lands. A product decision about what counts as a visit reaches into the storage contract.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`Session state is data-dependent: ${KEYED_TOTAL} entries for ${EVENTS.length} events here, and nothing in this design bounds it for a burstier stream or more keys.`], c.C.warn, c.C.warnFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`One session is never collected, because the watermark never reaches ${hhmmss(sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(x => collectedAt(x, GAP) === null).map(x => x.end + GAP)[0])}. Its memory is held for the life of the job regardless of allowed lateness.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`This stream's late event EXTENDS a session. A late event that BRIDGES two already-emitted sessions would require retracting two panes and emitting one — the same mechanism, twice the bookkeeping, and no event here does it.`], c.C.blue, c.C.blueFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And the gap ${secs(GAP)} is a definition nobody can verify. Every session count in this chapter is correct for that definition and for no other.`], c.C.hot, c.C.hotFill),
    cap: `The third note is worth stating plainly rather than implying: this dataset's straggler extends one session, so the bridge case — one event merging two already-published sessions — is not demonstrated here. It is the same retraction mechanism applied twice, and a design that handles the extension handles it, but no number in this chapter proves that.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch04-shapes', steps: C1,
    title: 'Window shapes — fixed, sliding, and session',
    subtitle: `fixed ${WIN_STARTS.length} windows totalling ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)} · sliding totals ${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)} · sessions ${GAP_SWEEP.map(g => g.counts.a).join('/')} for key a as the gap grows`,
    heading: 'Why there are three shapes, and why one of them has no answer without a setting',
    why: [
      `**Fixed (tumbling) windows** partition event time into equal, contiguous, non-overlapping spans. Every event belongs to exactly one, so the ${WIN_STARTS.length} window sums here (${WIN_STARTS.map(w => SUM(WINDOWS[w])).join(', ')}) add up to ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)} — the whole dataset. They answer "how many per ${secs(WIN)}", and they are the shape that reconciles against a batch job.`, '',
      `**Sliding (hopping) windows** are fixed-length but overlapping, defined by a size and a slide — here ${secs(WIN)} wide starting every ${secs(PERIOD)}. ${EVENTS.filter(e => slidingStarts(e.et).length > 1).length} of the ${EVENTS.length} events land in ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} windows at once, so the results total **${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)}** against a dataset of ${EVENTS.reduce((n, e) => n + e.v, 0)}. Output volume scales as size / slide = ${WIN / PERIOD}×. They answer "what is the rolling ${secs(WIN)} figure, refreshed every ${secs(PERIOD)}".`, '',
      `**Session windows** are data-driven: a session is a burst of activity separated from the next by a gap of inactivity — here ${secs(GAP)}. At that gap key \`a\` gets ${sessionsOf('a', GAP).length} sessions and key \`b\` gets ${sessionsOf('b', GAP).length}, over the same span of event time, because they were active at different moments. No session has the same length as another and none starts on a round boundary; both facts follow from the boundaries being set by the data.`, '',
      `**And here is the part that is easy to miss.** Sweep the gap over the same stream and key \`a\`'s session count goes **${GAP_SWEEP.map(g => g.counts.a).join(' → ')}** at gaps of ${GAPS.map(g => secs(g)).join(', ')}. The events never change. Only the definition of "a visit" does.`, '',
      `So "how many sessions did this user have?" has **no answer in the data** until someone states the gap. It is a product definition that happens to live in a config file — which is why the window shape is part of the answer rather than an implementation detail.`],
    whenHeading: 'When to reach for each shape, and what each one costs',
    when: [
      `**Fixed windows whenever the question names a period.** "Per minute", "per hour", "daily" — the shape is decided and nothing else needs considering. Totals reconcile, state is bounded by (keys × open windows), and a batch job over the same data gives the same answer.`, '',
      `**Sliding windows for a moving measure,** and budget for ${WIN / PERIOD}× the output and ${WIN / PERIOD}× the state. The trap is comparing their total to the input total: ${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)} against ${EVENTS.reduce((n, e) => n + e.v, 0)} here, and the overlap is the intent, not a bug.`, '',
      `**Session windows when the boundary is a property of the user's behaviour,** not of the clock — engagement, a visit, a trip, a conversation. Accept that the number of state entries is data-dependent (${KEYED_TOTAL} for ${EVENTS.length} events here) and cannot be sized in advance.`, '',
      `**Do not reach for sessions to approximate "recent activity".** A sliding window answers that with bounded state and no merging.`, '',
      `**What this does not settle:** session bounds are provisional. A later event can extend a session, which means it can change a value that has already been reported — and at some gap settings that is forced rather than possible. The next concept walks the full lifecycle, and the one after that finds the exact gap at which this stream requires a retraction.`],
    diagramHeading: 'Visual walkthrough — three shapes, and the gap sweep',
    sub: `Every window membership, the sliding total and the four-gap session sweep are computed from the seed and asserted.` },
  { name: 'ch04-lifecycle', steps: C2,
    title: 'The window lifecycle — assign, merge, group and trigger, accumulate and collect',
    subtitle: `${MERGE_EVENTS.length} of key "${MERGE_KEY}"'s arrivals merge · ${KEYED_TOTAL} state entries · the straggler beats collection by ${MARGIN} event`,
    heading: 'Why a session assignment is a hypothesis, and where the memory is released',
    why: [
      `Every windowing goes through the same four steps, and sessions are the only shape where step 2 does anything.`, '',
      `**1. Assign.** Each element is assigned to a set of windows by its event time and the windowing function. For id ${EVENTS[4].id} (et ${hhmmss(EVENTS[4].et)}): fixed gives 1 window, sliding gives ${slidingStarts(EVENTS[4].et).length}, and session gives one window **whose bounds are not known yet**. Assign reads \`e.et\` and the rule, never the arrival time.`, '',
      `That last row is why step 2 exists. A fixed or sliding assignment is final; a session assignment is a hypothesis that a later event can revise.`, '',
      `**2. Merge.** When an event lands within the gap of an existing session, the two collapse. Watch key "${MERGE_KEY}" in processing order: ${MERGE_EVENTS.length} of its ${MERGES.length} arrivals merge — id ${MERGE_EVENTS.map(m => m.e.id).join(' and id ')}, both arriving **out of order** and extending a session *backwards*. A session's start moved after the session existed; no other windowing has a boundary that can do that.`, '',
      `**3. Group and trigger.** Elements are grouped by (key, window) into the state that will be aggregated, then triggers decide when it emits. There are **${KEYED_TOTAL} state entries** here, one per (key, session) — and that count is data-dependent, which fixed windows never are. You cannot size session state in advance.`, '',
      `**4. Accumulate and garbage-collect.** Each pane is accumulated per the accumulation mode, and the state is released when the watermark passes the window end plus allowed lateness. For sessions the relevant bound is end + gap: a session that has been quiet for ${secs(GAP)} of **wall clock** may still grow, and only the watermark rules that out.`, '',
      `For key "${L.key}"'s session holding id ${L.id}, collection happens at event ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)} — and id ${L.id} arrived at event ${LI}, **${MARGIN} event earlier**. So at gap ${secs(GAP)} nothing needs retracting. Shrink the gap to ${secs(SMALL_GAP)} and the order flips.`],
    whenHeading: 'When merging matters, and what collection is actually buying',
    when: [
      `**Merging matters the moment your input can be out of order,** which is always for sessions on real data. Both of this stream's merges were caused by out-of-order arrival, and both moved a session's start backwards — so a pipeline that assumes a session only grows forward is wrong on this dataset.`, '',
      `**Group-and-trigger is where to look when state grows unexpectedly.** The unit is (key, window), so session state scales with keys × bursts, and a stream of short bursts produces far more entries than the same volume arriving steadily.`, '',
      `**Collection is buying memory back, and it is the only thing that does.** ${sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(s => collectedAt(s, GAP) === null).length} session here is never collected — the watermark never reaches its end plus gap — so its state is held for the life of the job. On an unbounded stream with low-traffic keys that is the leak that eventually matters.`, '',
      `**What this does not settle:** whether a retraction is required. At gap ${secs(GAP)} the margin is ${MARGIN} event, and at gap ${secs(SMALL_GAP)} the same stream forces one. "Does my pipeline need retractions?" is therefore not answerable from the data — it depends on a setting, and here it turns on a single event's position in the stream.`],
    diagramHeading: 'Visual walkthrough — the four steps, with the merges traced',
    sub: `The merges, the state-entry count and the ${MARGIN}-event collection margin are computed from the seed and asserted.` },
  { name: 'ch04-semantics', steps: C3,
    title: 'Session semantics and pitfalls — retraction, collection, and keying',
    subtitle: `gap ${secs(SMALL_GAP)} forces retract ${SUM(R.before.ids)} then emit ${SUM(R.after.ids)} · ignoring the key turns ${KEYED_TOTAL} sessions into ${UNKEYED.length}`,
    heading: 'Why a session is the one window whose published result can stop existing',
    why: [
      `**At gap ${secs(SMALL_GAP)}, this stream forces a retraction.** Follow key "${R.key}": the session ${sTxt(R.before)} is emitted at event ${R.emitIdx}, because the watermark has passed its end plus the gap. Then id ${EVENTS[R.lastArrival].id} (et ${hhmmss(EVENTS[R.lastArrival].et)}) arrives at event ${R.lastArrival} and it belongs to that session. The session is now ${sTxt(R.after)}.`, '',
      `So the pipeline must **retract ${SUM(R.before.ids)} and emit ${SUM(R.after.ids)}**. Without the retraction a consumer that adds panes reads ${SUM(R.before.ids) + SUM(R.after.ids)} for a session worth ${SUM(R.after.ids)}.`, '',
      `This is ch02's accumulation question arriving with no choice attached. For a fixed window the old pane was *stale*; for a session the old pane described a **window that no longer exists** — different bounds, different identity.`, '',
      `**Sessions are collected by the watermark, not by looking idle.** A session silent for ${secs(GAP)} of wall clock may still grow; only the watermark passing end + gap rules it out. And ${sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(x => collectedAt(x, GAP) === null).length} session here is **never collected**, because the watermark never reaches ${hhmmss(sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(x => collectedAt(x, GAP) === null).map(x => x.end + GAP)[0])}.`, '',
      `**Sessions are per key, and this stream has a near miss that proves it.** Key "b"'s first session ends at ${hhmmss(B_SESS[0].end)} and its second starts at ${hhmmss(B_SESS[1].start)} — a silence of ${secs(B_SESS[1].start - B_SESS[0].end)}, more than the gap. id ${CROSS.id} has event time ${hhmmss(CROSS.et)}, only **${secs(CROSS.et - B_SESS[0].end)} after key "b" went quiet** and well inside the ${secs(GAP)} gap. It does not join, because it belongs to key "${CROSS.key}" and the gap is measured within a key.`, '',
      `Drop the keying and the ${KEYED_TOTAL} keyed sessions collapse to **${UNKEYED.length}**: users' activity fills in each other's silences and produces one fictional visit.`],
    whenHeading: 'When retraction is unavoidable, and how to choose the shape',
    when: [
      `**Retraction is unavoidable the moment a session can be collected before its last member arrives,** and that is a function of the gap, not of your data. A smaller gap means earlier collection, so tightening the gap to get cleaner "visits" silently turns on a requirement that the downstream store accept deletions.`, '',
      `**So check the store first.** A session retraction **deletes one row and inserts another**, because the bounds are the identity — a store keyed by (key, session start) cannot express it as an update. An append-only analytics store is incompatible with session windows, and that is cheaper to learn here than in production.`, '',
      `**Match the shape to the question:** fixed for periodic aggregates (${WIN_STARTS.length} answers totalling ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}), sliding for moving averages (${WIN / PERIOD}× output), sessions for behaviour. And note the question "how many visits did this user have?" has ${new Set(GAP_SWEEP.map(g => g.counts.a)).size} different correct answers here (${GAP_SWEEP.map(g => g.counts.a).join(', ')}) — it is not answerable until the gap is fixed.`, '',
      `**What this does not settle:** this stream's late event **extends** a session. A late event that **bridges** two already-emitted sessions would retract two panes and emit one — the same mechanism with twice the bookkeeping — and no event here does it, so nothing in this chapter demonstrates that case.`],
    diagramHeading: 'Visual walkthrough — the retraction, the collection, and the near miss',
    sub: `The retraction at gap ${secs(SMALL_GAP)}, the never-collected session and the keyed-vs-unkeyed counts are computed from the seed and asserted.` },
  { name: 'ch04-system', steps: C4,
    title: 'System design — session analytics for user activity',
    subtitle: `two extra stages, a store that must accept deletions, and ${KEYED_TOTAL} data-dependent state entries`,
    heading: 'Why choosing session windows adds two components and a storage requirement',
    why: [
      `**The question.** Design session-window analytics for user activity. A late event can change a session that was already emitted, so the pipeline must retract the stale pane rather than double-count.`, '',
      `**The pipeline:** event source → window assigner → **session merger** → keyed session state → **trigger / retraction emitter** → analytics store.`, '',
      `Two of those six stages exist **only** because a session's bounds can change after the fact: the merger and the retraction emitter. So "we'll use session windows" is not a configuration change — it adds two components and places a hard requirement on the store.`, '',
      `**The requirement, stated precisely.** At gap ${secs(SMALL_GAP)} this stream produces: session ${sTxt(R.before)} emitted at event ${R.emitIdx}, so the store holds ${SUM(R.before.ids)}. Then id ${EVENTS[R.lastArrival].id} arrives at event ${R.lastArrival} and the session becomes ${sTxt(R.after)}. The emitter must retract ${SUM(R.before.ids)} **for the old bounds** and emit ${SUM(R.after.ids)} for the new ones. A store that ignores the retraction reads ${SUM(R.before.ids) + SUM(R.after.ids)} for a session worth ${SUM(R.after.ids)}.`, '',
      `Note what makes this harder than a fixed window's correction: the retraction names the **old bounds**. A fixed window's correction updates a row; a session's correction **deletes one row and inserts another**, because the bounds are the key.`, '',
      `**And the two settings are coupled.** Gap ${secs(GAP)} gives key a ${sessionsOf('a', GAP).length} sessions and needs ${RETR_AT_GAP.length} retractions; gap ${secs(SMALL_GAP)} gives ${sessionsOf('a', SMALL_GAP).length} sessions and needs ${RETR_SMALL.length}. A smaller gap means more sessions **and** earlier collection, and earlier collection is what creates the retraction.`],
    whenHeading: 'When this design is viable, and the four things it does not settle',
    when: [
      `**It is viable when the analytics store can delete a row.** That is the first thing to check, before any of the rest: a key-value store or a warehouse with upsert-and-delete is fine; an append-only event log or a billing ledger is not, and no amount of pipeline work fixes it.`, '',
      `**Choose the gap as a product definition, then accept its consequences.** It decides how many sessions exist AND whether retractions are required. Those are not independent knobs, and the second one reaches into the storage contract.`, '',
      `**Set allowed lateness against the memory, not against the skew.** It is how long a collected session can still be revived, so it is the price of being able to correct — paid in bytes per open (key, session) pair.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **Session state is data-dependent.** ${KEYED_TOTAL} entries for ${EVENTS.length} events here, and nothing bounds it for a burstier stream or a larger key space. Fixed windows can be sized in advance; this cannot.`,
      `2. **One session is never collected**, because the watermark never reaches ${hhmmss(sessionsOf(KEYS[0], GAP).concat(sessionsOf(KEYS[1], GAP)).filter(x => collectedAt(x, GAP) === null).map(x => x.end + GAP)[0])}. Its state is held for the life of the job regardless of allowed lateness — a low-traffic key is a permanent allocation.`,
      `3. **The bridge case is not demonstrated.** This stream's late event extends a session; one that merged two already-published sessions would retract two panes and emit one. Same mechanism, twice the bookkeeping, and no number here proves it works.`,
      `4. **The gap is unverifiable.** Every session count in this chapter is correct for ${secs(GAP)} and for no other definition, and nothing in the data can tell you whether ${secs(GAP)} is the right definition of a visit.`],
    diagramHeading: 'Visual walkthrough — six stages, one retraction, two coupled settings',
    sub: `The retraction sequence, the ${KEYED_TOTAL} state entries and the never-collected session are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · gap ${secs(GAP)} · ${KEYED_TOTAL} sessions`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch04.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch04.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being summed  ·  key = whose activity this is',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the straggler`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: GAP — the session gap: silence longer than this ends a session.  GAP = ${GAP}`,
  `// primitive: WIN — the fixed window width.  WIN = ${WIN}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: KEYS — the keys sessions are tracked per.  KEYS = ["${KEYS.join('", "')}"]`,
  '// primitive: sum(ids) — total v over those event ids.',
  `//   sum([${sessionsOf('b', GAP)[0].ids.join(', ')}]) = ${SUM(sessionsOf('b', GAP)[0].ids)}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  '// primitive: sortByEt(es) — es in ascending event-time order.',
  `//   sortByEt(EVENTS) = [${EVENTS.slice().sort((a, b) => a.et - b.et).map(e => e.id).join(', ')}]   (the ids, in event-time order)`,
  '// primitive: watermarkAfter(i) — highest event time through i, minus LAG.',
  `//   watermarkAfter(4) = ${WATERMARKS[4]}      watermarkAfter(${EVENTS.length - 1}) = ${WATERMARKS[EVENTS.length - 1]}`,
];
const PROGRAMS = [];
const A_SESS = sessionsOf('a', GAP);

// ---- concept 1: one grouping function, three shapes ------------------------
PROGRAMS.push({
  name: 'ch04-shapes-memory',
  title: 'Three window shapes through one assigner',
  subtitle: `fixed 1 window · sliding ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} windows · session bounds decided by the data`,
  src: COMMON.concat([
    '',
    'type Session { start, end, ids }',
    '',
    `// primitive: PERIOD — how often a sliding window starts.  PERIOD = ${PERIOD}`,
    '// primitive: winOf(et) — the START of the fixed window holding et.',
    `//   winOf(${EVENTS[4].et}) = ${winOf(EVENTS[4].et)}      winOf(${L.et}) = ${winOf(L.et)}`,
    '// primitive: slidingStarts(et) — EVERY sliding window start covering et.',
    `//   slidingStarts(${EVENTS[0].et}) = [${slidingStarts(EVENTS[0].et).join(', ')}]      slidingStarts(${EVENTS[4].et}) = [${slidingStarts(EVENTS[4].et).join(', ')}]`,
    '',
    '// function: assign(e, shape) — the windows one event belongs to. Fixed and',
    '//   sliding answer from e.et alone; a session cannot be answered yet at all.',
    `//   assign(EVENTS[4], "fixed")   = [${winOf(EVENTS[4].et)}]`,
    `//   assign(EVENTS[4], "sliding") = [${slidingStarts(EVENTS[4].et).join(', ')}]`,
    '//   assign(EVENTS[4], "session") = NONE   (the bounds depend on events not yet seen)',
    'fun assign(e, shape) {',
    '    if (shape == "fixed")   { return [winOf(e.et)] }',
    '    if (shape == "sliding") { return slidingStarts(e.et) }',
    '    return NONE',
    '}',
    '',
    '// function: sessionize(key, gap) — build that key\'s sessions in EVENT-time order.',
    `//   sessionize("a", ${GAP}) = ${A_SESS.length} sessions · sessionize("b", ${GAP}) = ${sessionsOf('b', GAP).length} sessions`,
    `//   sessionize("a", ${SMALL_GAP}) = ${sessionsOf('a', SMALL_GAP).length} sessions   (same events, smaller gap)`,
    'fun sessionize(key, gap) {',
    '    var out = []',
    '    for (e in sortByEt(EVENTS)) {',
    '        if (e.key != key) { continue }',
    '        val last = out[len(out) - 1]',
    '        if (last != NONE && e.et - last.end <= gap) {',
    '            last.end = e.et',
    '            last.ids = append(last.ids, e.id)',
    '        }',
    '        if (last == NONE || e.et - last.end > gap) {',
    '            out = append(out, Session(e.et, e.et, [e.id]))',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: totalAcross(shape) — add up every window\'s sum, to show which',
    '//   shapes partition event time and which overlap.',
    `//   totalAcross("fixed") = ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}      totalAcross("sliding") = ${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)}`,
    'fun totalAcross(shape) {',
    '    var t = 0',
    '    for (e in EVENTS) { t = t + e.v * len(assign(e, shape)) }',
    '    return t',
    '}',
    '',
    '// function: main() — THE CALLER: three shapes, and two gaps.',
    'fun main() {',
    '    val tFixed   = totalAcross("fixed")',
    '    val tSliding = totalAcross("sliding")',
    `    val wide     = sessionize("a", ${GAP})`,
    `    val tight    = sessionize("a", ${SMALL_GAP})`,
    '}',
  ]),
  heap: {
    wide:  { addr: '0x100', type: `Session[${A_SESS.length}]`, val: () => A_SESS.map(s => `[${s.start}-${s.end}]`).join(' ') },
    tight: { addr: '0x200', type: `Session[${sessionsOf('a', SMALL_GAP).length}]`, val: () => sessionsOf('a', SMALL_GAP).map(s => `[${s.start}-${s.end}]`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `tFixed = ${o.tFixed !== undefined ? o.tFixed : '...'}`, `tSliding = ${o.tSliding !== undefined ? o.tSliding : '...'}`,
      `wide = ${o.wide || '...'}`, `tight = ${o.tight || '...'}`] });
    return [
      { t: 'fixed and sliding differ only in the LENGTH of the answer', line: at('fun assign(e, shape)', 'if (shape == "sliding") { return slidingStarts(e.et) }'),
        stack: [MAIN(), { name: 'totalAcross', locals: ['shape = "sliding"', `t = (partial)`, `e = EVENTS[${EVENTS[4].id}]`] },
                { name: 'assign', locals: [`e = EVENTS[${EVENTS[4].id}]`, 'shape = "sliding"'] }],
        heap: [],
        cap: `For id ${EVENTS[4].id}, \`assign\` returns [${winOf(EVENTS[4].et)}] under "fixed" and [${slidingStarts(EVENTS[4].et).join(', ')}] under "sliding" — a list of ${slidingStarts(EVENTS[4].et).length}. \`totalAcross\` multiplies \`e.v\` by \`len(...)\`, which is why the sliding total reaches ${EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0)} against ${WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0)}. The overlap is in the list length, nowhere else.` },
      { t: 'a session cannot be assigned from one event at all', line: at('fun assign(e, shape)::    return NONE'),
        stack: [MAIN({ tFixed: WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0), tSliding: EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0) }),
                { name: 'assign', locals: [`e = EVENTS[${EVENTS[4].id}]`, 'shape = "session"'] }],
        heap: [],
        cap: `The fall-through returns NONE for "session" — not an oversight. A session's bounds depend on events that have not arrived, so no function of a single event can name them. That is the structural reason sessions need the separate \`sessionize\` pass, and the reason they can be revised later.` },
      { t: 'so sessions are built by comparing CONSECUTIVE event times', line: at('fun sessionize(key, gap)', 'if (last != NONE && e.et - last.end <= gap) {'),
        stack: [MAIN({ tFixed: WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0), tSliding: EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0), wide: '@0x100' }),
                { name: 'sessionize', locals: ['key = "a"', `gap = ${GAP}`, 'out = @0x100', `e = (et ${A_SESS[1].start})`, `last = Session(${A_SESS[0].start}, ${A_SESS[0].end}, ...)`] }],
        heap: [{ key: 'wide', hot: true }],
        cap: `The event at et ${A_SESS[1].start} is compared against \`last.end\` = ${A_SESS[0].end}: the difference is ${A_SESS[1].start - A_SESS[0].end}, which exceeds GAP = ${GAP}, so the \`if\` fails and the next line starts a new session. One subtraction and one comparison decide every session boundary in the book.` },
      { t: 'and the same events give a different number of sessions', line: at(`    val tight    = sessionize("a", ${SMALL_GAP})`),
        stack: [MAIN({ tFixed: WIN_STARTS.reduce((n, w) => n + SUM(WINDOWS[w]), 0), tSliding: EVENTS.reduce((n, e) => n + e.v * slidingStarts(e.et).length, 0), wide: '@0x100', tight: '@0x200' })],
        heap: [{ key: 'wide' }, { key: 'tight', hot: true }],
        cap: `\`wide\` holds ${A_SESS.length} sessions and \`tight\` holds ${sessionsOf('a', SMALL_GAP).length}, from identical events — only \`gap\` differed. Both heap rows are correct answers to "how many visits did key a have?", which means the question is not answerable until the gap is stated. It is a definition, not a tuning parameter.` },
    ];
  },
  intro: [
    `**What is being answered.** Why there are three window shapes — as one \`assign\` function that can answer for two of them and must return NONE for the third.`, '',
    `\`assign(e, shape)\` returns a **list**: one element for fixed, up to ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} for sliding, and NONE for a session. \`totalAcross\` then multiplies \`e.v\` by that list's length, which is the whole mechanism behind the sliding total exceeding the dataset.`, '',
    `Step 2 is the structural point: a session cannot be assigned from a single event, because its bounds depend on events that have not arrived. Step 4 shows the consequence — \`gap\` is the only difference between ${A_SESS.length} sessions and ${sessionsOf('a', SMALL_GAP).length}.`],
  sub: `Every session boundary and both totals are computed from the seed and asserted.` });

// ---- concept 2: the lifecycle, with merging traced -------------------------
PROGRAMS.push({
  name: 'ch04-lifecycle-memory',
  title: 'The lifecycle — a session being merged, then collected',
  subtitle: `key "${MERGE_KEY}": ${MERGE_EVENTS.length} arrivals merge · collection beats the straggler by ${MARGIN} event`,
  src: COMMON.concat([
    '',
    'type Session { start, end, ids, emitted }',
    '',
    `// primitive: indexOf(e) — e's position in PROCESSING order.  indexOf(EVENTS[${L.id}]) = ${LI}`,
    '// primitive: contains(xs, x) — is x in xs?  contains([1,2], 2) = true',
    '',
    '// function: sessionsUpto(key, gap, i) — that key\'s sessions using only the',
    '//   events that have ARRIVED by processing index i. The bounds move as i grows.',
    `//   sessionsUpto("${MERGE_KEY}", ${GAP}, ${MERGES[1].i}) = ${MERGES[1].sess.map(s => `[${s.start}-${s.end}]`).join(' ')}`,
    `//   sessionsUpto("${MERGE_KEY}", ${GAP}, ${MERGES[MERGES.length - 1].i}) = ${MERGES[MERGES.length - 1].sess.map(s => `[${s.start}-${s.end}]`).join(' ')}`,
    'fun sessionsUpto(key, gap, i) {',
    '    var out = []',
    '    for (e in sortByEt(EVENTS)) {',
    '        if (e.key != key || indexOf(e) > i) { continue }',
    '        val last = out[len(out) - 1]',
    '        if (last != NONE && e.et - last.end <= gap) { last.end = e.et · last.ids = append(last.ids, e.id) }',
    '        if (last == NONE || e.et - last.end > gap) { out = append(out, Session(e.et, e.et, [e.id], false)) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: merged(key, gap, i) — did the event arriving at i join an EXISTING',
    '//   session rather than start one? That is the merge step, observed.',
    `//   merged("${MERGE_KEY}", ${GAP}, ${MERGE_EVENTS[0].i}) = true      merged("${MERGE_KEY}", ${GAP}, ${MERGES[0].i}) = false`,
    'fun merged(key, gap, i) {',
    '    for (s in sessionsUpto(key, gap, i)) {',
    '        if (contains(s.ids, EVENTS[i].id) && len(s.ids) > 1) { return true }',
    '    }',
    '    return false',
    '}',
    '',
    '// function: collectedAt(s, gap) — the index at which the watermark passes the',
    '//   session end plus the gap, which is when its STATE can be released.',
    `//   collectedAt(the session holding id ${L.id}, ${GAP}) = ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)}`,
    `//   collectedAt(the never-collected session, ${GAP}) = NONE`,
    'fun collectedAt(s, gap) {',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= s.end + gap) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: needsRetraction(key, gap) — was any session collected BEFORE one of',
    '//   its own members arrived? That is the only thing that forces a retraction.',
    `//   needsRetraction("${R.key}", ${GAP}) = false      needsRetraction("${R.key}", ${SMALL_GAP}) = true`,
    'fun needsRetraction(key, gap) {',
    '    for (s in sessionsUpto(key, gap, len(EVENTS) - 1)) {',
    '        val c = collectedAt(s, gap)',
    '        for (id in s.ids) {',
    '            if (c != NONE && c < indexOf(EVENTS[id])) { return true }',
    '        }',
    '    }',
    '    return false',
    '}',
    '',
    '// function: main() — THE CALLER: the four lifecycle steps, in order.',
    'fun main() {',
    `    val afterFirst = sessionsUpto("${MERGE_KEY}", ${GAP}, ${MERGES[1].i})`,
    `    val afterAll   = sessionsUpto("${MERGE_KEY}", ${GAP}, ${MERGES[MERGES.length - 1].i})`,
    `    val didMerge   = merged("${MERGE_KEY}", ${GAP}, ${MERGE_EVENTS[0].i})`,
    `    val mustRetract = needsRetraction("${R.key}", ${GAP})`,
    '}',
  ]),
  heap: {
    afterFirst: { addr: '0x100', type: `Session[${MERGES[1].sess.length}]`, val: () => MERGES[1].sess.map(s => `[${s.start}-${s.end}] ids ${s.ids.join(',')}`).join(' · ') },
    afterAll:   { addr: '0x200', type: `Session[${MERGES[MERGES.length - 1].sess.length}]`, val: () => MERGES[MERGES.length - 1].sess.map(s => `[${s.start}-${s.end}] ids ${s.ids.join(',')}`).join(' · ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `afterFirst = ${o.afterFirst || '...'}`, `afterAll = ${o.afterAll || '...'}`,
      `didMerge = ${o.didMerge !== undefined ? o.didMerge : '...'}`, `mustRetract = ${o.mustRetract !== undefined ? o.mustRetract : '...'}`] });
    const M0 = MERGE_EVENTS[0];
    return [
      { t: 'ASSIGN and MERGE are the same line, read twice', line: at('fun sessionsUpto(key, gap, i)', 'if (last != NONE && e.et - last.end <= gap) { last.end = e.et · last.ids = append(last.ids, e.id) }'),
        stack: [MAIN(), { name: 'sessionsUpto', locals: [`key = "${MERGE_KEY}"`, `gap = ${GAP}`, `i = ${M0.i}`, 'out = @0x100', `e = EVENTS[${M0.e.id}]`, `last = Session(${M0.sess.find(s => s.ids.includes(M0.e.id)).start}, ...)`] }],
        heap: [{ key: 'afterFirst', hot: true }],
        cap: `This one line does both jobs: if the arriving event is within \`gap\` of \`last.end\`, it is ASSIGNED to that session and the session is simultaneously MERGED — \`last.end\` moves. For id ${M0.e.id} (et ${M0.e.et}) the session's bound changes, which is a window boundary moving after the window existed.` },
      { t: `so ${MERGE_EVENTS.length} out-of-order arrivals each absorb a session`, line: at('fun merged(key, gap, i)', 'if (contains(s.ids, EVENTS[i].id) && len(s.ids) > 1) { return true }'),
        stack: [MAIN({ afterFirst: '@0x100', afterAll: '@0x200', didMerge: true }), { name: 'merged', locals: [`key = "${MERGE_KEY}"`, `gap = ${GAP}`, `i = ${M0.i}`, `s = Session(${M0.sess.find(s => s.ids.includes(M0.e.id)).start}, ...)`] }],
        heap: [{ key: 'afterFirst' }, { key: 'afterAll', hot: true }],
        cap: `\`merged\` returns true when the arriving event ended up in a session with more than one member. Compare the two heap rows: \`afterFirst\` has ${MERGES[1].sess.length} session(s) and \`afterAll\` has ${MERGES[MERGES.length - 1].sess.length}, with starts pulled BACKWARDS by ids ${MERGE_EVENTS.map(m => m.e.id).join(' and ')}.` },
      { t: 'collection is a watermark comparison, not an idle timer', line: at('fun collectedAt(s, gap)', 'if (watermarkAfter(i) >= s.end + gap) { return i }'),
        stack: [MAIN({ afterFirst: '@0x100', afterAll: '@0x200', didMerge: true }), { name: 'collectedAt', locals: [`s = Session(${sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).start}, ${sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).end}, ...)`, `gap = ${GAP}`, `i = ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)}`] }],
        heap: [{ key: 'afterAll' }],
        cap: `The condition is \`watermarkAfter(i) >= s.end + gap\` — ${sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).end} + ${GAP} = ${sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).end + GAP}, first satisfied at index ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)}. Nothing here measures elapsed wall-clock silence. A session quiet for ${GAP}s of real time is still open if the watermark has not moved.` },
      { t: 'and whether a retraction is needed turns on ONE comparison', line: at('fun needsRetraction(key, gap)', 'if (c != NONE && c < indexOf(EVENTS[id])) { return true }'),
        stack: [MAIN({ afterFirst: '@0x100', afterAll: '@0x200', didMerge: true, mustRetract: false }),
                { name: 'needsRetraction', locals: [`key = "${R.key}"`, `gap = ${GAP}`, `s = Session(${sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)).start}, ...)`, `c = ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)}`, `id = ${L.id}`] }],
        heap: [{ key: 'afterAll' }],
        cap: `\`c\` = ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)} and \`indexOf(EVENTS[${L.id}])\` = ${LI}, so ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)} < ${LI} is false — no retraction at gap ${GAP}. Call it with gap ${SMALL_GAP} and \`c\` becomes ${R.emitIdx}, the comparison holds, and a retraction is mandatory. A ${MARGIN}-event margin is the entire difference.` },
    ];
  },
  intro: [
    `**What is being answered.** The four lifecycle steps, as four functions over the same key's arrivals.`, '',
    `The line to look at first is inside \`sessionsUpto\`: \`if (last != NONE && e.et - last.end <= gap)\`. It performs **assign and merge at once** — the event joins the session and the session's bound moves in the same statement. That is why sessions have a merge step and the other shapes do not.`, '',
    `\`needsRetraction(key, gap)\` then reduces the whole retraction question to one comparison: was the session collected at an index below the arrival index of one of its own members? At gap ${GAP} that is ${collectedAt(sessionsOf(L.key, GAP).find(s => s.ids.includes(L.id)), GAP)} < ${LI} — false. At gap ${SMALL_GAP} it is ${R.emitIdx} < ${R.lastArrival} — true.`],
  sub: `The merge trace, the collection index and both retraction verdicts are computed from the seed and asserted.` });

// ---- concept 3: retraction, collection, keying -----------------------------
PROGRAMS.push({
  name: 'ch04-semantics-memory',
  title: 'Session semantics — the retraction, and why keying is correctness',
  subtitle: `retract ${SUM(R.before.ids)} then emit ${SUM(R.after.ids)} at gap ${SMALL_GAP} · unkeyed collapses ${KEYED_TOTAL} sessions to ${UNKEYED.length}`,
  src: COMMON.concat([
    '',
    'type Session { start, end, ids }',
    'type Pane    { bounds, value, kind }',
    '',
    `// primitive: SMALL_GAP — a tighter session gap, for comparison.  SMALL_GAP = ${SMALL_GAP}`,
    '// primitive: sessionsUpto(key, gap, i) — that key\'s sessions from the events',
    '//   that have arrived by processing index i.',
    `//   sessionsUpto("${R.key}", SMALL_GAP, ${R.emitIdx}) = [${sTxt(R.before).split(' sum')[0]}]`,
    `//   sessionsUpto("${R.key}", SMALL_GAP, ${R.lastArrival}) = [${sTxt(R.after).split(' sum')[0]}]`,
    '// primitive: collectedAt(s, gap) — the index at which s\'s state may be released.',
    `//   collectedAt(${sTxt(R.before).split(' ids')[0]}, SMALL_GAP) = ${R.emitIdx}`,
    '',
    '// primitive: finalSession(key, gap, s) — the session s grows into once every',
    '//   event has arrived.',
    `//   finalSession("${R.key}", SMALL_GAP, ${sTxt(R.before).split(' ids')[0]}) = ${sTxt(R.after).split(' sum')[0]}`,
    '',
    '// function: emitPanes(key, gap) — every pane a consumer receives for that key,',
    '//   including any retraction forced by a member arriving after collection.',
    `//   emitPanes("${R.key}", SMALL_GAP) includes Pane(..., ${SUM(R.before.ids)}, "ON-TIME") then Pane(..., ${-SUM(R.before.ids)}, "RETRACT") then Pane(..., ${SUM(R.after.ids)}, "LATE")`,
    'fun emitPanes(key, gap) {',
    '    var out = []',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        for (s in sessionsUpto(key, gap, i)) {',
    '            if (collectedAt(s, gap) != i) { continue }',
    '            out = append(out, Pane(s, sum(s.ids), "ON-TIME"))',
    '            val finalS = finalSession(key, gap, s)',
    '            if (finalS.ids != s.ids) {',
    '                out = append(out, Pane(s, 0 - sum(s.ids), "RETRACT"))',
    '                out = append(out, Pane(finalS, sum(finalS.ids), "LATE"))',
    '            }',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: storeTotal(panes, acceptsRetraction) — what the analytics store ends',
    '//   up holding. A store that drops retractions double-counts.',
    `//   storeTotal(emitPanes("${R.key}", SMALL_GAP), true)  = ${SUM(R.after.ids)}`,
    `//   storeTotal(emitPanes("${R.key}", SMALL_GAP), false) = ${SUM(R.before.ids) + SUM(R.after.ids)}`,
    'fun storeTotal(panes, acceptsRetraction) {',
    '    var t = 0',
    '    for (p in panes) {',
    '        if (p.kind == "RETRACT" && acceptsRetraction == false) { continue }',
    '        t = t + p.value',
    '    }',
    '    return t',
    '}',
    '',
    '// function: sessionsIgnoringKey(gap) — the BUG: one session list for all keys.',
    `//   len(sessionsIgnoringKey(${GAP})) = ${UNKEYED.length}, against ${KEYED_TOTAL} keyed`,
    'fun sessionsIgnoringKey(gap) {',
    '    var out = []',
    '    for (e in sortByEt(EVENTS)) {',
    '        val last = out[len(out) - 1]',
    '        if (last != NONE && e.et - last.end <= gap) { last.end = e.et · last.ids = append(last.ids, e.id) }',
    '        if (last == NONE || e.et - last.end > gap) { out = append(out, Session(e.et, e.et, [e.id])) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER.',
    'fun main() {',
    `    val panes   = emitPanes("${R.key}", SMALL_GAP)`,
    '    val good    = storeTotal(panes, true)',
    '    val bad     = storeTotal(panes, false)',
    `    val unkeyed = sessionsIgnoringKey(${GAP})`,
    '}',
  ]),
  heap: {
    panes:   { addr: '0x100', type: 'Pane[3]', val: () => `ON-TIME ${SUM(R.before.ids)} · RETRACT ${-SUM(R.before.ids)} · LATE ${SUM(R.after.ids)}` },
    unkeyed: { addr: '0x200', type: `Session[${UNKEYED.length}]`, val: () => UNKEYED.map(s => `[${s.start}-${s.end}] ${s.ids.length} ids`).join(' · ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `panes = ${o.panes || '...'}`, `good = ${o.good !== undefined ? o.good : '...'}`,
      `bad = ${o.bad !== undefined ? o.bad : '...'}`, `unkeyed = ${o.unkeyed || '...'}`] });
    return [
      { t: 'the session is emitted, and it is not final', line: at('fun emitPanes(key, gap)', 'out = append(out, Pane(s, sum(s.ids), "ON-TIME"))'),
        stack: [MAIN(), { name: 'emitPanes', locals: [`key = "${R.key}"`, `gap = ${SMALL_GAP}`, 'out = @0x100', `i = ${R.emitIdx}`, `s = Session(${R.before.start}, ${R.before.end}, [${R.before.ids.join(',')}])`] }],
        heap: [{ key: 'panes', hot: true }],
        cap: `At index ${R.emitIdx} the watermark has passed ${R.before.end} + ${SMALL_GAP}, so the session ${sTxt(R.before).split(' sum')[0]} is published with value ${SUM(R.before.ids)}. Everything here is correct. The problem is that id ${EVENTS[R.lastArrival].id} has not arrived yet and belongs to this session.` },
      { t: 'so the pane must be UN-SAID, by its old bounds', line: at('out = append(out, Pane(s, 0 - sum(s.ids), "RETRACT"))', 'out = append(out, Pane(finalS, sum(finalS.ids), "LATE"))'),
        stack: [MAIN({ panes: '@0x100' }), { name: 'emitPanes', locals: [`key = "${R.key}"`, `gap = ${SMALL_GAP}`, 'out = @0x100', `i = ${R.emitIdx}`, `s = Session(${R.before.start}, ${R.before.end}, [${R.before.ids.join(',')}])`, `finalS = Session(${R.after.start}, ${R.after.end}, [${R.after.ids.join(',')}])`] }],
        heap: [{ key: 'panes', hot: true }],
        cap: `Read the two \`Pane\` constructors: the retraction carries \`s\` — the OLD bounds — and the late pane carries \`finalS\`, different bounds. For a fixed window both panes would name the same window and only the value would change. A session's bounds are its identity, so this is a delete and an insert.` },
      { t: 'a store that drops retractions is wrong by the old value', line: at('fun storeTotal(panes, acceptsRetraction)', 'if (p.kind == "RETRACT" && acceptsRetraction == false) { continue }'),
        stack: [MAIN({ panes: '@0x100', good: SUM(R.after.ids), bad: SUM(R.before.ids) + SUM(R.after.ids) }),
                { name: 'storeTotal', locals: ['panes = @0x100', 'acceptsRetraction = false', `t = ${SUM(R.before.ids) + SUM(R.after.ids)}`, `p = Pane(..., ${SUM(R.after.ids)}, "LATE")`] }],
        heap: [{ key: 'panes' }],
        cap: `\`good\` = ${SUM(R.after.ids)} and \`bad\` = ${SUM(R.before.ids) + SUM(R.after.ids)} — ${Math.round(100 * SUM(R.before.ids) / SUM(R.after.ids))}% over, and the error is exactly the retracted value ${SUM(R.before.ids)}. The pipeline emitted all three panes correctly in both cases. The only difference is one \`continue\` in the consumer.` },
      { t: `and ignoring the key collapses ${KEYED_TOTAL} sessions into ${UNKEYED.length}`, line: at('fun sessionsIgnoringKey(gap)', 'fun sessionsIgnoringKey(gap)::    for (e in sortByEt(EVENTS)) {'),
        stack: [MAIN({ panes: '@0x100', good: SUM(R.after.ids), bad: SUM(R.before.ids) + SUM(R.after.ids), unkeyed: '@0x200' }),
                { name: 'sessionsIgnoringKey', locals: [`gap = ${GAP}`, 'out = @0x200', `e = EVENTS[${CROSS.id}]`, `last = Session(${B_SESS[0].start}, ${B_SESS[0].end}, ...)`] }],
        heap: [{ key: 'unkeyed', hot: true }],
        cap: `The loop has no \`if (e.key != key)\` guard, so id ${CROSS.id} (key "${CROSS.key}", et ${CROSS.et}) is compared against key "b"'s session end ${B_SESS[0].end}: ${CROSS.et} − ${B_SESS[0].end} = ${CROSS.et - B_SESS[0].end} ≤ ${GAP}, so it merges. ${KEYED_TOTAL} real sessions become ${UNKEYED.length} fictional ones, because one user's activity filled another's silence.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a session retraction is harder than a fixed window's, and why keying is a correctness property — as panes a consumer actually receives.`, '',
    `In \`emitPanes\`, look at the two \`Pane\` constructors in step 2. The retraction carries \`s\` (the **old** bounds) and the late pane carries \`finalS\` (**different** bounds). A fixed window's correction names one window twice; a session's names two different windows, so a store keyed by session bounds must delete a row and insert another.`, '',
    `\`storeTotal(panes, acceptsRetraction)\` then prices the mistake: ${SUM(R.after.ids)} against ${SUM(R.before.ids) + SUM(R.after.ids)}, and the error is exactly the retracted value. And \`sessionsIgnoringKey\` is the same loop with the key guard removed — ${KEYED_TOTAL} sessions become ${UNKEYED.length}.`],
  sub: `The pane sequence, both store totals and the unkeyed collapse are computed from the seed and asserted.` });

// ---- concept 4: the session analytics pipeline -----------------------------
PROGRAMS.push({
  name: 'ch04-system-memory',
  title: 'Session analytics — the pipeline, and the store contract it implies',
  subtitle: `${KEYED_TOTAL} state entries · 1 never collected · store must DELETE, not update`,
  src: COMMON.concat([
    '',
    'type Session { start, end, ids }',
    'type Store   { rows }',
    '',
    `// primitive: SMALL_GAP — the tighter gap that forces a retraction.  SMALL_GAP = ${SMALL_GAP}`,
    '// primitive: sessionsUpto(key, gap, i) — sessions from arrivals through index i.',
    `//   sessionsUpto("${R.key}", SMALL_GAP, ${R.emitIdx}) = [${sTxt(R.before).split(' sum')[0]}]`,
    '// primitive: collectedAt(s, gap) — the index at which s\'s state may be released.',
    `//   collectedAt(${sTxt(R.before).split(' ids')[0]}, SMALL_GAP) = ${R.emitIdx}      collectedAt(the quiet session, ${GAP}) = NONE`,
    '// primitive: keyOf(s) — the store\'s row key for a session: its KEY and its START.',
    `//   keyOf(${sTxt(R.before).split(' ids')[0]}) = ("${R.key}", ${R.before.start})`,
    `//   keyOf(${sTxt(R.after).split(' ids')[0]}) = ("${R.key}", ${R.after.start})   <- a DIFFERENT row`,
    '',
    '// function: write(store, s) — insert or update one session row.',
    `//   write(store, ${sTxt(R.before).split(' ids')[0]}) sets rows[("${R.key}", ${R.before.start})] = ${SUM(R.before.ids)}`,
    'fun write(store, s) {',
    '    store.rows[keyOf(s)] = sum(s.ids)',
    '    return store',
    '}',
    '',
    '// function: erase(store, s) — remove the row for those bounds. This is the',
    '//   operation a fixed-window pipeline never needs.',
    `//   erase(store, ${sTxt(R.before).split(' ids')[0]}) removes rows[("${R.key}", ${R.before.start})]`,
    'fun erase(store, s) {',
    '    store.rows[keyOf(s)] = NONE',
    '    return store',
    '}',
    '',
    '// primitive: growsInto(key, gap, old, i) — what the session `old` has become by',
    '//   processing index i.',
    `//   growsInto("${R.key}", SMALL_GAP, ${sTxt(R.before).split(' ids')[0]}, ${R.lastArrival}) = ${sTxt(R.after).split(' sum')[0]}`,
    '',
    '// function: run(key, gap, canErase) — the pipeline, writing into the store.',
    `//   run("${R.key}", SMALL_GAP, true).rows  has 1 row holding ${SUM(R.after.ids)}`,
    `//   run("${R.key}", SMALL_GAP, false).rows has 2 rows totalling ${SUM(R.before.ids) + SUM(R.after.ids)}`,
    'fun run(key, gap, canErase) {',
    '    var store = Store({})',
    '    var seen  = []',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        for (s in sessionsUpto(key, gap, i)) {',
    '            if (collectedAt(s, gap) == i) { store = write(store, s) · seen = append(seen, s) }',
    '        }',
    '        for (old in seen) {',
    '            val now = growsInto(key, gap, old, i)',
    '            if (now.start == old.start) { continue }',
    '            if (canErase) { store = erase(store, old) }',
    '            store = write(store, now)',
    '        }',
    '    }',
    '    return store',
    '}',
    '',
    '// function: stateEntries(gap) — how many (key, session) pairs the pipeline holds.',
    `//   stateEntries(${GAP}) = ${KEYED_TOTAL}      stateEntries(${SMALL_GAP}) = ${KEYS.reduce((n, k) => n + sessionsOf(k, SMALL_GAP).length, 0)}`,
    'fun stateEntries(gap) {',
    '    var n = 0',
    '    for (k in KEYS) { n = n + len(sessionsUpto(k, gap, len(EVENTS) - 1)) }',
    '    return n',
    '}',
    '',
    '// function: main() — THE CALLER: both stores, and the state size.',
    'fun main() {',
    `    val correct = run("${R.key}", SMALL_GAP, true)`,
    `    val broken  = run("${R.key}", SMALL_GAP, false)`,
    `    val entries = stateEntries(${GAP})`,
    '}',
  ]),
  heap: {
    correct: { addr: '0x100', type: 'Store', val: () => `1 row: ("${R.key}", ${R.after.start}) = ${SUM(R.after.ids)}` },
    broken:  { addr: '0x200', type: 'Store', val: () => `2 rows: ("${R.key}", ${R.before.start}) = ${SUM(R.before.ids)} · ("${R.key}", ${R.after.start}) = ${SUM(R.after.ids)}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `correct = ${o.correct || '...'}`, `broken = ${o.broken || '...'}`,
      `entries = ${o.entries !== undefined ? o.entries : '...'}`] });
    return [
      { t: 'the row key is the session\'s BOUNDS, which is the whole problem', line: at('fun write(store, s)', 'store.rows[keyOf(s)] = sum(s.ids)'),
        stack: [MAIN(), { name: 'run', locals: [`key = "${R.key}"`, `gap = ${SMALL_GAP}`, 'canErase = true', 'store = @0x100', 'seen = [1 session]', `i = ${R.emitIdx}`, `s = Session(${R.before.start}, ${R.before.end}, ...)`, 'old = ...', 'now = ...'] },
                { name: 'write', locals: [`store = @0x100`, `s = Session(${R.before.start}, ${R.before.end}, ...)`] }],
        heap: [{ key: 'correct', hot: true }],
        cap: `\`keyOf(s)\` is ("${R.key}", ${R.before.start}) — the key includes the session's START. So when the start later moves to ${R.after.start}, the same session needs a DIFFERENT row. That is the structural difference from a fixed window, whose bounds never move.` },
      { t: 'so a correction is an ERASE plus a write', line: at('fun run(key, gap, canErase)', 'if (canErase) { store = erase(store, old) }'),
        stack: [MAIN({ correct: '@0x100' }), { name: 'run', locals: [`key = "${R.key}"`, `gap = ${SMALL_GAP}`, 'canErase = true', 'store = @0x100', 'seen = [1 session]', `i = ${R.lastArrival}`, 's = ...', `old = Session(${R.before.start}, ${R.before.end}, ...)`, `now = Session(${R.after.start}, ${R.after.end}, ...)`] }],
        heap: [{ key: 'correct', hot: true }],
        cap: `At index ${R.lastArrival}, \`now.start\` (${R.after.start}) differs from \`old.start\` (${R.before.start}), so the old row is erased and the new one written. The store ends with ONE row holding ${SUM(R.after.ids)}. Two store operations for one logical correction.` },
      { t: 'without the erase, the old row survives', line: at('fun erase(store, s)', 'store.rows[keyOf(s)] = NONE'),
        stack: [MAIN({ correct: '@0x100', broken: '@0x200' }), { name: 'run', locals: [`key = "${R.key}"`, `gap = ${SMALL_GAP}`, 'canErase = false', 'store = @0x200', 'seen = [1 session]', `i = ${R.lastArrival}`, 's = ...', `old = Session(${R.before.start}, ${R.before.end}, ...)`, `now = Session(${R.after.start}, ${R.after.end}, ...)`] }],
        heap: [{ key: 'correct' }, { key: 'broken', hot: true }],
        cap: `With \`canErase\` false the \`erase\` is skipped and the write still happens, so \`broken\` holds TWO rows: ${SUM(R.before.ids)} and ${SUM(R.after.ids)}, totalling ${SUM(R.before.ids) + SUM(R.after.ids)} for one session worth ${SUM(R.after.ids)}. Nothing errored. The store just has a row for a session that never existed.` },
      { t: 'and the state size is decided by the data, not the schema', line: at('fun stateEntries(gap)', 'for (k in KEYS) { n = n + len(sessionsUpto(k, gap, len(EVENTS) - 1)) }'),
        stack: [MAIN({ correct: '@0x100', broken: '@0x200', entries: KEYED_TOTAL }), { name: 'stateEntries', locals: [`gap = ${GAP}`, `n = ${KEYED_TOTAL}`, `k = "${KEYS[KEYS.length - 1]}"`] }],
        heap: [{ key: 'correct' }, { key: 'broken' }],
        cap: `\`entries\` = ${KEYED_TOTAL} for ${EVENTS.length} events at gap ${GAP}, and ${KEYS.reduce((n, k) => n + sessionsOf(k, SMALL_GAP).length, 0)} at gap ${SMALL_GAP}. There is no expression here that depends only on the schema — the count comes from how bursty the data was. A fixed-window pipeline's state is (keys × open windows) and can be sized in advance; this cannot.` },
    ];
  },
  intro: [
    `**What is being answered.** What choosing session windows actually requires of the analytics store, as a store you can watch fill.`, '',
    `\`keyOf(s)\` is the detail everything turns on: the row key is **("key", session start)**, so when a merge moves the start, the session needs a *different row*. A fixed window's correction is an update; this is an erase plus a write.`, '',
    `\`run(key, gap, canErase)\` is the pipeline, and the \`canErase\` flag is the store's capability. With it, one row holding ${SUM(R.after.ids)}; without it, two rows totalling ${SUM(R.before.ids) + SUM(R.after.ids)} for a session worth ${SUM(R.after.ids)} — and no error anywhere.`],
  sub: `Both store contents and the state-entry counts are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch04.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch04.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
