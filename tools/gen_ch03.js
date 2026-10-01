#!/usr/bin/env node
'use strict';
/* gen_ch03.js — ch03's four concepts, both bands each: what a watermark is, the
 * heuristic and its skew, propagation across inputs, and the generator itself.
 * Every figure derives from tools/stream_seed.js. The derivations this chapter
 * needs — the PERFECT watermark (computable only in hindsight), a lag sweep, the
 * per-source minimum, and the naive formula's backward jumps — are computed here
 * and asserted. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, WINDOWS, WIN_STARTS, winOf, LATE, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const L = LATE[0], LI = EVENTS.indexOf(L);
const W0 = WIN_STARTS[0], W0_END = W0 + WIN, W0_IDS = WINDOWS[W0], W0_TRUE = SUM(W0_IDS);
const maxEtThrough = (i) => Math.max(...EVENTS.slice(0, i + 1).map(e => e.et));
// THE PERFECT WATERMARK: the largest t for which no event with et < t is still to
// come. Only computable with the whole stream in hand, which is the point.
const PERFECT = EVENTS.map((_, i) => {
  const rest = EVENTS.slice(i + 1);
  return rest.length ? Math.min(...rest.map(e => e.et)) : Infinity;
});
const PERF_STALL = PERFECT.filter(w => w === PERFECT[1]).length;           // how long it is stuck
const perfCloses = PERFECT.findIndex(w => w >= W0_END);
const heurCloses = WATERMARKS.findIndex(w => w >= W0_END);
const PERF_VALUE = SUM(EVENTS.filter((e, i) => i <= perfCloses && winOf(e.et) === W0).map(e => e.id));
const HEUR_VALUE = SUM(EVENTS.filter((e, i) => i <= heurCloses && winOf(e.et) === W0).map(e => e.id));
const CORRECT_COST = EVENTS[perfCloses].pt - EVENTS[heurCloses].pt;
// A LAG SWEEP: for each candidate skew bound, when does W0 close, what does it say,
// and how many events are classified late?
const sweep = (lag) => {
  const wm = EVENTS.map((_, i) => maxEtThrough(i) - lag);
  const closes = (w) => { const i = wm.findIndex(x => x >= w + WIN); return i === -1 ? null : i; };
  const ci = closes(W0);
  const value = ci === null ? null : SUM(EVENTS.filter((e, i) => i <= ci && winOf(e.et) === W0).map(e => e.id));
  const late = EVENTS.filter((e, i) => { const c = closes(winOf(e.et)); return c !== null && c < i; }).map(e => e.id);
  return { lag, wm, closeIdx: ci, closeAt: ci === null ? null : EVENTS[ci].pt, value, late };
};
const LAGS = [0, LAG, 2 * LAG, 3 * LAG];
const SWEEP = LAGS.map(sweep);
// the exact lag at which W0's on-time answer becomes correct: the watermark must
// stay below the window END until the straggler has arrived
const LAG_MIN = maxEtThrough(LI - 1) - W0_END + 1;
const CORRECT_SWEEP = sweep(LAG_MIN);
const LAG_PRICE = CORRECT_SWEEP.closeAt - sweep(LAG).closeAt;
// PER-SOURCE watermarks, then their minimum — a stage cannot claim more
// completeness than its least-complete input
const perSource = EVENTS.map((_, i) => {
  const per = {};
  for (const k of KEYS) {
    const seen = EVENTS.filter((e, j) => j <= i && e.key === k);
    per[k] = seen.length ? Math.max(...seen.map(e => e.et)) - LAG : null;
  }
  return per;
});
const MINWM = perSource.map(p => KEYS.some(k => p[k] === null) ? null : Math.min(...KEYS.map(k => p[k])));
const END = EVENTS.length - 1;
const IDLE_KEY = KEYS.reduce((a, b) => (perSource[END][a] < perSource[END][b] ? a : b));
const BUSY_KEY = KEYS.find(k => k !== IDLE_KEY);
const IDLE_GAP = perSource[END][BUSY_KEY] - perSource[END][IDLE_KEY];
// which window closes under the single global watermark but NOT under the minimum
const BLOCKED = WIN_STARTS.filter(w => WATERMARKS[END] >= w + WIN && MINWM[END] < w + WIN);
// the NAIVE formula — this event's own event time minus the lag — goes BACKWARDS
const NAIVE = EVENTS.map(e => e.et - LAG);
const REGRESSIONS = NAIVE.map((v, i) => i > 0 && v < NAIVE[i - 1] ? { i, from: NAIVE[i - 1], to: v } : null).filter(Boolean);
const fail = (m) => { throw new Error(`gen_ch03: ${m}`); };
if (WATERMARKS.some((w, i) => i > 0 && w < WATERMARKS[i - 1])) fail('the seed watermark goes backwards; monotonicity is assumed throughout');
if (PERF_STALL < 3) fail(`the perfect watermark only stalls for ${PERF_STALL} events — the perfect-vs-heuristic contrast needs a visible stall`);
if (perfCloses <= heurCloses) fail('the perfect watermark does not close W0 later than the heuristic; there is no latency price to show');
if (PERF_VALUE !== W0_TRUE) fail(`a perfect watermark should give the true answer, got ${PERF_VALUE} against ${W0_TRUE}`);
if (HEUR_VALUE === W0_TRUE) fail('the heuristic already gives the right answer; the chapter has nothing to compare');
if (new Set(SWEEP.map(s => s.late.length)).size < 2) fail('the lag sweep does not change the late count — "too fast" would be unobservable');
if (CORRECT_SWEEP.value !== W0_TRUE) fail(`lag ${LAG_MIN} does not make W0 correct`);
if (sweep(LAG_MIN - 1).value === W0_TRUE) fail(`lag ${LAG_MIN - 1} is already correct, so ${LAG_MIN} is not the threshold`);
if (LAG_MIN >= L.pt - L.et) fail(`the threshold ${LAG_MIN} is not below the straggler's ${L.pt - L.et}s skew — the surprise is the point`);
if (!BLOCKED.length) fail('no window is blocked by the per-source minimum; propagation would have no observable cost');
if (REGRESSIONS.length < 2) fail(`the naive formula regresses ${REGRESSIONS.length} times — need at least two to show why max() is in the formula`);
if (LAG_PRICE <= 0) fail('the correct lag is not slower than the default');

const W = 1140;
const secs = (n) => `${n}s`;
const mm = (sec) => hhmmss(sec).slice(0, 5);
const wmTxt = (w) => w === null ? 'no claim' : w === Infinity ? 'everything' : w < 0 ? 'none yet' : hhmmss(w);

// ======================== CONCEPT 1 — WHAT A WATERMARK IS ====================
const C1 = [
  { t: 'event times jump around; the watermark only moves forward', draw: (c) => {
      let s = c.panel('EVENT TIME VS WATERMARK, EVENT BY EVENT', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'row 1 = the arriving event  ·  row 2 = its event time  ·  row 3 = the watermark after it (max seen − lag)', { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('id', c.P.main.x + 60, c.P.main.y + 62, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 24, size: 11, fill: c.C.cold });
      s += c.cells('et', c.P.main.x + 60, c.P.main.y + 94, EVENTS.map(e => hhmmss(e.et).slice(3)), { cw: 110, ch: 26, size: 11,
        hotSet: new Set(EVENTS.map((e, i) => i > 0 && e.et < EVENTS[i - 1].et ? i : -1).filter(i => i >= 0)), hotFill: c.C.hotFill, hotEdge: c.C.hot });
      s += c.cells('wm', c.P.main.x + 60, c.P.main.y + 128, WATERMARKS.map(w => wmTxt(w).slice(3) || wmTxt(w)), { cw: 110, ch: 26, size: 11, fill: c.C.goodFill, edge: c.C.good });
      return s + c.note('m1', c.P.main.x + 24, c.P.main.y + 172, 1040, [
        `The highlighted event times go BACKWARDS — id ${EVENTS[6].id} at ${hhmmss(EVENTS[6].et)} after id ${EVENTS[5].id} at ${hhmmss(EVENTS[5].et)}, then id ${L.id} at ${hhmmss(L.et)}.`,
        `The watermark row never does. It is monotonically increasing by construction, because it is computed from the MAXIMUM event time seen, not from the latest one.`,
      ], c.C.good, c.C.goodFill); },
    cap: `A watermark is a single event-time value that only ever moves forward. Compare the two bottom rows: event times arrive out of order ${EVENTS.filter((e, i) => i > 0 && e.et < EVENTS[i - 1].et).length} times, and the watermark still never decreases. That is not luck — \`max(seen)\` cannot shrink, and monotonicity is what lets a window be closed once rather than re-opened.` },
  { t: 'it is a claim about completeness, not a clock reading', draw: (c) =>
      c.panel('WHAT THE WATERMARK ACTUALLY ASSERTS', 'a')
      + c.mapRows('cl', c.P.main.x + 24, c.P.main.y + 52, [
        [`watermark = ${hhmmss(WATERMARKS[heurCloses])} after event id ${EVENTS[heurCloses].id}`, `the claim: "nothing earlier than ${hhmmss(WATERMARKS[heurCloses])} will arrive"`],
        [`the wall clock at that moment`, `${hhmmss(EVENTS[heurCloses].pt)} — a different number, about a different thing`],
        [`what the claim allows`, `every window ending at or before ${hhmmss(WATERMARKS[heurCloses])} may now be emitted`],
        [`whether the claim is TRUE here`, `no — id ${L.id} (${hhmmss(L.et)}) has not arrived yet`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one value, and the four different things people read into it' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A watermark is a PROMISE the pipeline makes so that triggers have something to fire on. It is not a guarantee and it is not the wall clock.`,
        `Here the promise is false at the moment it is made, and nothing in the pipeline can tell. That is the normal condition, not a malfunction.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Two numbers exist at that instant: the watermark (${hhmmss(WATERMARKS[heurCloses])}, in event time) and the wall clock (${hhmmss(EVENTS[heurCloses].pt)}, in processing time). They are not comparable — one is a claim about which events can still arrive, the other is what time it is. The claim here is wrong, which is why "estimate" rather than "guarantee" is the word that matters.` },
  { t: 'a PERFECT watermark exists — and it stalls', draw: (c) => {
      let s = c.panel('PERFECT VS HEURISTIC, SIDE BY SIDE', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'the perfect watermark is the largest time for which no earlier event is still to come — computable only in hindsight', { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('p0', c.P.main.x + 60, c.P.main.y + 62, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 24, size: 11, fill: c.C.cold });
      s += c.cells('p1', c.P.main.x + 60, c.P.main.y + 94, WATERMARKS.map(w => wmTxt(w).replace('12:', '')), { cw: 110, ch: 26, size: 11, fill: c.C.blueFill, edge: c.C.blue });
      s += c.cells('p2', c.P.main.x + 60, c.P.main.y + 128, PERFECT.map(w => wmTxt(w).replace('12:', '')), { cw: 110, ch: 26, size: 11,
        hotSet: new Set(PERFECT.map((w, i) => w === PERFECT[1] ? i : -1).filter(i => i >= 0)), hotFill: c.C.hotFill, hotEdge: c.C.hot });
      s += c.line(c.P.main.x + 60, c.P.main.y + 170, 'heuristic (row 2) advances to ' + hhmmss(WATERMARKS[heurCloses]) + ' by event id ' + EVENTS[heurCloses].id + ' · perfect (row 3) is stuck at ' + hhmmss(PERFECT[1]), { size: 11, weight: 700, fill: c.C.line, band: 'p3' });
      return s + c.note('p4', c.P.main.x + 24, c.P.main.y + 184, 1040, [
        `The perfect watermark cannot pass ${hhmmss(PERFECT[1])} for ${PERF_STALL} consecutive events, because id ${L.id} (${hhmmss(L.et)}) is still to come.`,
        `The heuristic advanced to ${hhmmss(WATERMARKS[heurCloses])} in that same span. It bought ${secs(WATERMARKS[heurCloses] - PERFECT[1])} of apparent progress by being wrong.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is the clearest statement of what a heuristic watermark is FOR. The perfect watermark is correct and useless — it sits at ${hhmmss(PERFECT[1])} for ${PERF_STALL} of the ${EVENTS.length} events, so nothing can be emitted. The heuristic reaches ${hhmmss(WATERMARKS[heurCloses])} in the same span, and every bit of that ${secs(WATERMARKS[heurCloses] - PERFECT[1])} of progress is an unverified guess.` },
  { t: 'and that is exactly the price of the on-time answer', draw: (c) =>
      c.panel('THE SAME WINDOW, UNDER BOTH WATERMARKS', 'p')
      + c.mapRows('pr', c.P.main.x + 24, c.P.main.y + 52, [
        [`window [${mm(W0)}, ${mm(W0_END)})`, `ids ${W0_IDS.join(', ')} · true sum ${W0_TRUE}`],
        [`heuristic: closes after event id ${EVENTS[heurCloses].id}`, `publishes ${HEUR_VALUE} at ${hhmmss(EVENTS[heurCloses].pt)} — ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% low`],
        [`perfect: closes after event id ${EVENTS[perfCloses].id}`, `publishes ${PERF_VALUE} at ${hhmmss(EVENTS[perfCloses].pt)} — correct`],
        [`the price of being right`, `${secs(CORRECT_COST)} later, and it required knowing the future`],
      ], { w: 1040, rh: 36, hot: 3, label: 'perfect and heuristic differ in exactly one way: latency versus truth' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The perfect watermark gives ${PERF_VALUE} because it refused to claim completeness until id ${L.id} had actually landed.`,
        `It could only do that because this generator can read the whole stream. A live pipeline cannot, so a heuristic is not a shortcut — it is the only option.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Both watermarks drive the same on-time trigger, and the window's answer differs: ${HEUR_VALUE} at ${hhmmss(EVENTS[heurCloses].pt)} against ${PERF_VALUE} at ${hhmmss(EVENTS[perfCloses].pt)}. ${secs(CORRECT_COST)} buys ${W0_TRUE - HEUR_VALUE} of the ${W0_TRUE}. And the perfect version is not a design option: it required looking at events that had not arrived.` },
];

// ======================== CONCEPT 2 — HEURISTIC AND SKEW =====================
const C2 = [
  { t: 'the heuristic is one line: max seen, minus a guess', draw: (c) =>
      c.panel(`watermark = max event time seen so far − skew bound (here ${secs(LAG)})`, 'a')
      + c.mapRows('hr', c.P.main.x + 24, c.P.main.y + 52, EVENTS.map((e, i) => [
          `after id ${e.id}: max seen = ${hhmmss(maxEtThrough(i))}`,
          `${maxEtThrough(i)} − ${LAG} = ${WATERMARKS[i]}  (${wmTxt(WATERMARKS[i])})`,
        ]), { w: 1040, rh: 30, hot: heurCloses, label: 'every value is one subtraction; the only judgement in it is the skew bound' })
      + c.note('h1', c.P.main.x + 24, c.P.main.y + 66 + EVENTS.length * 30, 1040, [
        `Nothing here measures anything. The ${secs(LAG)} is an assumption about how out-of-order the input can be.`,
        `Note the stalls: the value repeats whenever an arriving event's time is below the max already seen — the watermark is driven by the maximum, not by arrivals.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The whole heuristic is \`max(seen) − skew\`. The max is free and exact; the skew is a number a human chose. So every watermark in this book is one measured quantity minus one guess, and the next two steps are about what happens when the guess is too small or too large.` },
  { t: 'too FAST: the guess is small, so real events look late', draw: (c) => {
      let s = c.panel('A SWEEP OVER THE SKEW BOUND', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `what each skew bound does to window [${mm(W0)}, ${mm(W0_END)}) — true sum ${W0_TRUE}`, { size: 11, weight: 700, fill: c.C.line });
      SWEEP.concat([CORRECT_SWEEP]).forEach((sw, i) => {
        const y = c.P.main.y + 66 + i * 36, ok = sw.value === W0_TRUE;
        s += c.cv.rect('sw' + i, c.P.main.x + 24, y, 1040, 32, { fill: ok ? c.C.goodFill : c.C.hotFill, stroke: ok ? c.C.good : c.C.hot, rx: 3, sw: 2 });
        s += c.cv.text(c.P.main.x + 40, y + 21, `skew = ${secs(sw.lag)}`, { size: 11, weight: 700, band: 'swk' + i });
        s += c.cv.text(c.P.main.x + 190, y + 21, `closes at ${hhmmss(sw.closeAt)}`, { size: 11, band: 'swc' + i });
        s += c.cv.text(c.P.main.x + 420, y + 21, `publishes ${sw.value}`, { size: 11, weight: 700, fill: ok ? c.C.good : c.C.hot, band: 'swv' + i });
        s += c.cv.text(c.P.main.x + 620, y + 21, `${sw.late.length} event(s) classified LATE${sw.late.length ? `: id ${sw.late.join(', ')}` : ''}`, { size: 11, band: 'swl' + i });
      });
      return s + c.note('s1', c.P.main.x + 24, c.P.main.y + 80 + 5 * 36, 1040, [
        `At skew ${secs(SWEEP[0].lag)} the pipeline calls ${SWEEP[0].late.length} events late; at ${secs(LAG_MIN)} it calls none late and is correct.`,
        `Nothing about the DATA changed between those rows. "Late" is a verdict the watermark passes, not a property of an event.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `Read the last column down the table: ${SWEEP.map(s => s.late.length).join(', ')}, then ${CORRECT_SWEEP.late.length}. The same ${EVENTS.length} events, the same arrival times, and the number of "late" events falls from ${SWEEP[0].late.length} to ${CORRECT_SWEEP.late.length} purely because a configured bound grew. An over-eager watermark does not detect lateness — it creates it.` },
  { t: 'too SLOW: correct, and the answer arrives much later', draw: (c) =>
      c.panel('THE EXACT THRESHOLD, AND WHAT IT COSTS', 'a')
      + c.mapRows('th', c.P.main.x + 24, c.P.main.y + 52, [
        [`skew = ${secs(LAG_MIN - 1)}`, `publishes ${sweep(LAG_MIN - 1).value} at ${hhmmss(sweep(LAG_MIN - 1).closeAt)} — still wrong`],
        [`skew = ${secs(LAG_MIN)}`, `publishes ${CORRECT_SWEEP.value} at ${hhmmss(CORRECT_SWEEP.closeAt)} — correct`],
        [`the latency added`, `${secs(LAG_PRICE)} later than the ${secs(LAG)} default, for every window`],
        [`the straggler's actual skew`, `${secs(L.pt - L.et)} — NOT the threshold, and much larger`],
      ], { w: 1040, rh: 36, hot: 1, label: 'one second of configuration separates the first two rows' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The threshold is ${secs(LAG_MIN)} because the watermark only has to stay below the WINDOW END (${mm(W0_END)}) until id ${L.id} lands — it never has to reach back to ${hhmmss(L.et)}.`,
        `So it is derived from ${hhmmss(maxEtThrough(LI - 1))} − ${mm(W0_END)}: the highest event time seen before the straggler, minus the window's end. Not from the straggler's skew.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The number a reader expects here is ${secs(L.pt - L.et)} — the straggler's skew. The actual threshold is ${secs(LAG_MIN)}, and the derivation is in the note: the watermark only needs to stay below the window's END, not below the late event's event time. Worth knowing, because tuning skew to your worst observed delay over-pays by ${secs(L.pt - L.et - LAG_MIN)} on every window.` },
  { t: 'and per-source tracking beats one global guess', draw: (c) =>
      c.panel('ONE WATERMARK PER SOURCE, THEN THE MINIMUM', 'p')
      + c.mapRows('ps', c.P.main.x + 24, c.P.main.y + 52, [
        [`source "${BUSY_KEY}" after event ${END}`, `${wmTxt(perSource[END][BUSY_KEY])} — it is still producing`],
        [`source "${IDLE_KEY}" after event ${END}`, `${wmTxt(perSource[END][IDLE_KEY])} — its last event was id ${EVENTS.filter(e => e.key === IDLE_KEY).slice(-1)[0].id}`],
        [`the stage's watermark = the MINIMUM`, `${wmTxt(MINWM[END])} — it cannot claim more than its least-complete input`],
        [`a single GLOBAL watermark would say`, `${wmTxt(WATERMARKS[END])} — ${secs(IDLE_GAP)} more completeness than source "${IDLE_KEY}" can back`],
      ], { w: 1040, rh: 36, hot: 2, label: 'two sources, two watermarks, one safe claim' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Per-source is SAFER and slower: window${BLOCKED.length > 1 ? 's' : ''} ${BLOCKED.map(w => `[${mm(w)}, ${mm(w + WIN)})`).join(', ')} would close under the global watermark and stay open under the minimum.`,
        `That is the cost of the correct answer here — ${BLOCKED.map(w => SUM(WINDOWS[w])).join(' + ')} withheld because an idle source cannot vouch for it.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Tracking per source means one idle source holds the whole stage back — source "${IDLE_KEY}" stops at ${wmTxt(perSource[END][IDLE_KEY])} while "${BUSY_KEY}" reaches ${wmTxt(perSource[END][BUSY_KEY])}, and the stage must claim the lower. That is correct and it costs ${BLOCKED.length} window's output (${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}). Real systems add idleness detection precisely to escape this, and that is a decision to declare a source finished.` },
];

// ======================== CONCEPT 3 — PROPAGATION ===========================
const C3 = [
  { t: 'a stage cannot claim more than its least-complete input', draw: (c) => {
      let s = c.panel('PER-SOURCE WATERMARKS AND THEIR MINIMUM, EVENT BY EVENT', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `source "${KEYS[0]}" · source "${KEYS[1]}" · the stage's watermark = min of the two`, { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('i0', c.P.main.x + 60, c.P.main.y + 62, EVENTS.map(e => `id ${e.id}·${e.key}`), { cw: 110, ch: 24, size: 10, fill: c.C.cold });
      s += c.cells('a0', c.P.main.x + 60, c.P.main.y + 94, perSource.map(p => wmTxt(p[KEYS[0]]).replace('12:', '')), { cw: 110, ch: 26, size: 10 });
      s += c.cells('b0', c.P.main.x + 60, c.P.main.y + 126, perSource.map(p => wmTxt(p[KEYS[1]]).replace('12:', '')), { cw: 110, ch: 26, size: 10 });
      s += c.cells('m0', c.P.main.x + 60, c.P.main.y + 158, MINWM.map(w => wmTxt(w).replace('12:', '')), { cw: 110, ch: 26, size: 10, fill: c.C.goodFill, edge: c.C.good });
      return s + c.note('n1', c.P.main.x + 24, c.P.main.y + 202, 1040, [
        `The minimum row is the only safe claim. Until source "${KEYS[1]}" has produced anything, the stage has NO claim at all — not a generous one.`,
        `And at the end the minimum is ${wmTxt(MINWM[END])} while one source has reached ${wmTxt(perSource[END][BUSY_KEY])}: completeness is bounded by the slowest input, always.`,
      ], c.C.good, c.C.goodFill); },
    cap: `Propagation is a one-line rule with a sharp consequence: a stage's watermark is the minimum over its inputs. Read the first two columns — the stage cannot claim anything while source "${KEYS[1]}" is silent, because silence is indistinguishable from "an old event is still coming". Taking the maximum, or ignoring a quiet input, is how a pipeline claims completeness it has no basis for.` },
  { t: 'the watermark passing is a DECISION, not a fact', draw: (c) =>
      c.panel('WHAT "THE WATERMARK PASSED" ACTUALLY MEANS', 'a')
      + c.mapRows('dc', c.P.main.x + 24, c.P.main.y + 52, [
        [`the watermark passed ${mm(W0_END)} after event id ${EVENTS[heurCloses].id}`, `a fact about the pipeline's own arithmetic`],
        [`"no event earlier than ${mm(W0_END)} will arrive"`, `the claim it implies — and it is false here`],
        [`id ${L.id} (${hhmmss(L.et)}) arrives ${LI - heurCloses} events later`, `the counter-example, which no mechanism predicted`],
        [`so the window was not COMPLETE`, `it was CLOSED — the pipeline chose to stop waiting`],
      ], { w: 1040, rh: 36, hot: 3, label: 'four readings of one event, only the last of which is accurate' })
      + c.note('d1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `This distinction is the whole reason allowed lateness exists. If a passed watermark meant completeness, there would be nothing to be late FOR.`,
        `"Closed" is a decision with a cost; "complete" is a property the pipeline cannot observe.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Substituting "complete" for "closed" is the mistake that makes late data feel like a bug. The watermark passing ${mm(W0_END)} was the pipeline deciding to stop waiting, which is a choice with an error attached — here ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% of the answer. Allowed lateness exists precisely because the decision can be wrong.` },
  { t: 'so allowed lateness is the safety net under the estimate', draw: (c) => {
      let s = c.panel('THE THREE MECHANISMS, IN THE ORDER THEY ACT', 'a');
      s += c.mapRows('sf', c.P.main.x + 24, c.P.main.y + 52, [
        [`1. the watermark estimates completeness`, `reaches ${hhmmss(WATERMARKS[heurCloses])} after event id ${EVENTS[heurCloses].id} — and is wrong`],
        [`2. the on-time trigger acts on the estimate`, `publishes ${HEUR_VALUE}, the best answer available then`],
        [`3. allowed lateness keeps the state`, `so id ${L.id} can still correct it to ${W0_TRUE}`],
        [`what allowed lateness does NOT do`, `make the watermark right — it bounds how long being wrong is recoverable`],
      ], { w: 1040, rh: 36, hot: 3, label: 'an estimate, an action on it, and a bounded undo' });
      return s + c.note('f1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Each mechanism exists because the previous one is imperfect. That layering is the design, not a workaround.`,
        `And the horizon is bounded on purpose: unbounded recovery means unbounded state, so "how long can I be wrong for?" is answered in bytes.`,
      ], c.C.blue, c.C.blueFill); },
    cap: `Three mechanisms in sequence, each covering the previous one's failure: the watermark guesses, the trigger acts on the guess, and allowed lateness bounds how long that guess stays correctable. The bound is not timidity — holding window state is memory, so the horizon is where correctness is traded for bytes rather than for latency.` },
  { t: 'and this is what makes an event-time pipeline usable at all', draw: (c) =>
      c.panel('WITHOUT WATERMARKS', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`With no watermark, window [${mm(W0)}, ${mm(W0_END)}) can never be emitted: on an unbounded stream there is no moment at which "everything has arrived" becomes true.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The alternatives are a processing-time trigger (which answers a different question) or waiting forever (which answers none). The watermark is what converts an unbounded stream into one with a notion of PROGRESS.`], c.C.good, c.C.goodFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`The price, stated plainly: every on-time answer in this book is published on an estimate that was ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% wrong for this window, and would have been correct ${secs(CORRECT_COST)} later.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And the per-source minimum shows the structural limit: ${BLOCKED.length} window (${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}) is withheld because one source went quiet, which no amount of skew tuning fixes.`], c.C.blue, c.C.blueFill),
    cap: `The honest summary of the chapter: watermarks do not make event-time processing correct, they make it *possible*. Without one there is no moment to emit [${mm(W0)}, ${mm(W0_END)}) at all. With one, it is emitted ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% wrong and correctable — and that trade is the foundation everything later in the book is built on.` },
];

// ================== CONCEPT 4 — THE GENERATOR (systemDesign) ================
const C4 = [
  { t: 'the generator sits between the sources and the windows', draw: (c) =>
      c.panel('WATERMARK GENERATOR — WHERE IT LIVES AND WHAT IT READS', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`sources (events with event time)`, `${KEYS.length} sources here: "${KEYS.join('", "')}"`],
        [`watermark generator`, `per source: max seen − ${secs(LAG)} · across sources: the minimum`],
        [`window assigner`, `by event time, into ${secs(WIN)} windows — unaffected by the watermark`],
        [`per-window state → trigger/emitter → dashboard`, `the trigger is the ONLY consumer of the watermark`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the generator reads event times and emits one number; nothing else changes' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The assigner does not consult the watermark — bucketing is pure \`winOf(e.et)\`. Only the TRIGGER reads it.`,
        `So a watermark bug cannot put an event in the wrong window. It can only make a window speak too early or too late, which is why its failures look like wrong totals rather than wrong groupings.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Worth being precise about the blast radius: the watermark feeds exactly one consumer, the trigger. Windowing is \`winOf(e.et)\` and never sees it. That is why a mis-tuned skew produces an under-counted window rather than scattered data — and why "my numbers are low" is the symptom to map back to this component.` },
  { t: 'the naive formula goes BACKWARDS — twice', draw: (c) => {
      let s = c.panel('WHY max() IS IN THE FORMULA', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `row 2 = this event's own time − ${secs(LAG)} (naive)  ·  row 3 = max seen − ${secs(LAG)} (correct)`, { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('g0', c.P.main.x + 60, c.P.main.y + 62, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 24, size: 11, fill: c.C.cold });
      s += c.cells('g1', c.P.main.x + 60, c.P.main.y + 94, NAIVE.map(w => wmTxt(w).replace('12:', '')), { cw: 110, ch: 26, size: 10,
        hotSet: new Set(REGRESSIONS.map(r => r.i)), hotFill: c.C.hotFill, hotEdge: c.C.hot });
      s += c.cells('g2', c.P.main.x + 60, c.P.main.y + 126, WATERMARKS.map(w => wmTxt(w).replace('12:', '')), { cw: 110, ch: 26, size: 10, fill: c.C.goodFill, edge: c.C.good });
      return s + c.note('g3', c.P.main.x + 24, c.P.main.y + 170, 1040, [
        `The naive row regresses ${REGRESSIONS.length} times: ${REGRESSIONS.map(r => `${wmTxt(r.from)} → ${wmTxt(r.to)} (−${secs(r.from - r.to)})`).join(' and ')}.`,
        `A watermark that moves backwards would RE-OPEN a window that had already been closed and published, so every downstream guarantee collapses. \`max()\` is what makes that impossible.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `Two formulas differing by one function call. \`e.et − skew\` looks equivalent and is not: it falls back ${secs(REGRESSIONS[0].from - REGRESSIONS[0].to)} at id ${EVENTS[REGRESSIONS[0].i].id} and ${secs(REGRESSIONS[1].from - REGRESSIONS[1].to)} at id ${EVENTS[REGRESSIONS[1].i].id}. Monotonicity is not a nicety — a backwards watermark un-closes a published window, and nothing downstream is prepared for that.` },
  { t: 'the two settings, and their exact thresholds', draw: (c) =>
      c.panel('WHAT THERE IS TO GET WRONG', 'a')
      + c.mapRows('kb', c.P.main.x + 24, c.P.main.y + 52, [
        [`skew bound ${secs(LAG)} (the default)`, `window [${mm(W0)}, ${mm(W0_END)}) publishes ${HEUR_VALUE} at ${hhmmss(EVENTS[heurCloses].pt)} · ${sweep(LAG).late.length} late`],
        [`skew bound ${secs(LAG_MIN)} (the threshold)`, `publishes ${CORRECT_SWEEP.value} at ${hhmmss(CORRECT_SWEEP.closeAt)} · ${CORRECT_SWEEP.late.length} late · ${secs(LAG_PRICE)} slower`],
        [`one global watermark`, `claims ${wmTxt(WATERMARKS[END])} at the end — ${secs(IDLE_GAP)} more than source "${IDLE_KEY}" supports`],
        [`per-source minimum`, `claims ${wmTxt(MINWM[END])} — safe, and withholds ${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}`],
      ], { w: 1040, rh: 36, hot: 1, label: 'two independent choices: how big a skew, and whether to track per source' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Both settings trade the same pair: latency against the number of events the pipeline will mislabel as late.`,
        `Neither has a right answer, and both thresholds (${secs(LAG_MIN)}, and the ${secs(IDLE_GAP)} gap) were computed from a stream this generator can see in full.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Two knobs. The skew bound has a threshold of ${secs(LAG_MIN)} for this window, costing ${secs(LAG_PRICE)} of latency. Per-source tracking is strictly safer and withholds ${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')} when a source goes quiet. Both thresholds are only computable here because the whole stream is in hand — in production they are guesses, and the design has to survive them being wrong.` },
  { t: 'and what the generator does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`The ${secs(LAG)} skew bound is unverifiable from inside the pipeline. Nothing distinguishes "no late events" from "late events we already discarded".`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`Per-source tracking requires knowing the source set. A source that never appears cannot be waited for, and one that disappears pins the watermark at ${wmTxt(perSource[END][IDLE_KEY])} forever without an idleness timeout.`], c.C.warn, c.C.warnFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Monotonicity is enforced here by \`max()\`. A generator that restarts and recomputes from a checkpoint can still emit a lower value than it published before — this design says nothing about that.`], c.C.hot, c.C.hotFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And window [${mm(WIN_STARTS[WIN_STARTS.length - 1])}, …) never closes under ANY skew bound in the sweep, because no event ever pushes the watermark past its end.`], c.C.blue, c.C.blueFill),
    cap: `The second and third gaps are the ones that cause production incidents. An idle source with no timeout pins the watermark forever and every window stops closing — an outage that looks like a stall, not an error. And a restarted generator recomputing from a checkpoint can publish a watermark below one it already published, which breaks the monotonicity every downstream trigger assumes.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch03-watermark', steps: C1,
    title: 'What a watermark is — a monotonic claim about completeness',
    subtitle: `perfect watermark stalls at ${hhmmss(PERFECT[1])} for ${PERF_STALL} events · heuristic reaches ${hhmmss(WATERMARKS[heurCloses])} and publishes ${HEUR_VALUE} instead of ${W0_TRUE}`,
    heading: 'Why a watermark is an estimate, and what a correct one would cost',
    why: [
      `**A watermark is a single event-time value that only moves forward.** Once it advances past a point, the pipeline declares it will not see an event time earlier than that point again.`, '',
      `Monotonicity is not an accident. Event times in this dataset go backwards ${EVENTS.filter((e, i) => i > 0 && e.et < EVENTS[i - 1].et).length} times — id ${EVENTS[6].id} at ${hhmmss(EVENTS[6].et)} arrives after id ${EVENTS[5].id} at ${hhmmss(EVENTS[5].et)}, and id ${L.id} at ${hhmmss(L.et)} arrives last of all. The watermark never decreases, because it is computed from the **maximum** event time seen, which cannot shrink.`, '',
      `**It is a claim about completeness, not a clock reading.** After event id ${EVENTS[heurCloses].id} the watermark is ${hhmmss(WATERMARKS[heurCloses])} while the wall clock says ${hhmmss(EVENTS[heurCloses].pt)}. Those are not comparable numbers: one asserts which events can still arrive, the other says what time it is. And the assertion is **false** — id ${L.id} (${hhmmss(L.et)}) has not arrived.`, '',
      `**A perfect watermark is possible in principle.** Define it as the largest time *t* for which no event with event time below *t* is still to come. Compute it over this stream and it sits at **${hhmmss(PERFECT[1])} for ${PERF_STALL} of the ${EVENTS.length} events**, because id ${L.id} is always still coming. It is correct and useless: nothing can be emitted while it is stalled.`, '',
      `The heuristic reached ${hhmmss(WATERMARKS[heurCloses])} over that same span — **${secs(WATERMARKS[heurCloses] - PERFECT[1])} of apparent progress, all of it an unverified guess.**`, '',
      `**And that is exactly the price of the on-time answer.** Window [${mm(W0)}, ${mm(W0_END)}) holds ids ${W0_IDS.join(', ')}, true sum **${W0_TRUE}**. Under the heuristic it closes after event id ${EVENTS[heurCloses].id} and publishes **${HEUR_VALUE}** at ${hhmmss(EVENTS[heurCloses].pt)} — ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% low. Under the perfect watermark it closes after event id ${EVENTS[perfCloses].id} and publishes **${PERF_VALUE}** at ${hhmmss(EVENTS[perfCloses].pt)} — correct, and **${secs(CORRECT_COST)} later**.`],
    whenHeading: 'When a perfect watermark is actually available, and what to do otherwise',
    when: [
      `**A perfect watermark is available when you know the input is ordered.** Processing a single append-only log by ingestion time is the clean case: the last record's time *is* the completeness bound, with no guess in it. Same for replaying a sorted file.`, '',
      `**It is not available the moment inputs can be out of order** — mobile clients that go offline, multiple partitions merged, retries. Then the only option is a heuristic, which is why this book treats heuristic watermarks as the normal case rather than the fallback.`, '',
      `**The practical consequence: never read "the watermark passed" as "the data is complete."** Read it as "the pipeline decided to stop waiting." The first phrasing makes late data look like a bug; the second makes it a case you design for.`, '',
      `**What this does not settle:** how to pick the skew bound. ${secs(LAG)} was assumed here and produced a ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% error on this window. The next concept sweeps that number and finds the exact value at which the error disappears — which turns out not to be the one you would guess.`],
    diagramHeading: 'Visual walkthrough — monotonicity, the claim, and the perfect alternative',
    sub: `The perfect watermark, its ${PERF_STALL}-event stall and the ${secs(CORRECT_COST)} latency price are computed from the seed and asserted.` },
  { name: 'ch03-skew', steps: C2,
    title: 'Heuristic watermarks and skew — one guess, swept',
    subtitle: `skew ${SWEEP.map(s => `${s.lag}s→${s.value}`).join(' · ')} · correct at ${LAG_MIN}s, costing ${LAG_PRICE}s`,
    heading: 'Why the skew bound is the only judgement in the formula — and what each value buys',
    why: [
      `The common heuristic is one line: **watermark = max event time seen so far − skew**. The max is free and exact. The skew is a bound on out-of-orderness that a human chose, and it is the only judgement in the whole mechanism.`, '',
      `**Sweep it and watch what changes.** For window [${mm(W0)}, ${mm(W0_END)}), true sum ${W0_TRUE}:`, '',
      ...SWEEP.concat([CORRECT_SWEEP]).map(s => `- **skew ${secs(s.lag)}** → closes at ${hhmmss(s.closeAt)}, publishes **${s.value}**, ${s.late.length} event(s) classified late${s.late.length ? ` (id ${s.late.join(', ')})` : ''}`),
      '',
      `**Too fast means real events look late.** At skew ${secs(SWEEP[0].lag)} the pipeline calls ${SWEEP[0].late.length} events late; at ${secs(LAG_MIN)} it calls ${CORRECT_SWEEP.late.length} late. Nothing about the data changed between those rows. **"Late" is a verdict the watermark passes, not a property of an event** — an over-eager watermark does not detect lateness, it creates it.`, '',
      `**Too slow means correct and slow.** The threshold is exactly **${secs(LAG_MIN)}**: at ${secs(LAG_MIN - 1)} the window still publishes ${sweep(LAG_MIN - 1).value}, at ${secs(LAG_MIN)} it publishes ${CORRECT_SWEEP.value}. The cost is **${secs(LAG_PRICE)}** of added latency on every window.`, '',
      `And note the threshold is **not** id ${L.id}'s ${secs(L.pt - L.et)} of skew, which is the number most readers would reach for. It is \`${hhmmss(maxEtThrough(LI - 1))} − ${mm(W0_END)} + 1\` — the highest event time seen before the straggler, minus the **window's end**. The watermark only has to stay below the window boundary until the straggler lands; it never has to reach back to ${hhmmss(L.et)}. Tuning skew to your worst observed delay over-pays by ${secs(L.pt - L.et - LAG_MIN)} per window.`],
    whenHeading: 'When to tune skew up, when to track per source, and what neither fixes',
    when: [
      `**Tune skew up when a late answer is cheaper than a wrong one** — billing, compliance, anything reconciled against another system. You are buying correctness with latency at a measurable rate: here ${secs(LAG_PRICE)} for ${W0_TRUE - HEUR_VALUE} of ${W0_TRUE}.`, '',
      `**Tune skew down when a stale answer is worse than an incomplete one** — an ops dashboard, an autoscaler. Accept that some events will be classified late and make sure something downstream can absorb a correction.`, '',
      `**Track per source when sources have different idleness patterns.** Source "${BUSY_KEY}" reaches ${wmTxt(perSource[END][BUSY_KEY])} by the end of this stream while "${IDLE_KEY}" stops at ${wmTxt(perSource[END][IDLE_KEY])}. A single global watermark would claim ${wmTxt(WATERMARKS[END])} — **${secs(IDLE_GAP)} more completeness than source "${IDLE_KEY}" can back.** Taking the minimum is correct and costs ${BLOCKED.length} window's output (${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}).`, '',
      `**What none of this fixes:** the skew bound is unverifiable from inside the pipeline. A run with zero late events is indistinguishable from a run whose late events were silently discarded, so you cannot tell a well-tuned skew from an over-eager one by looking at the output. And per-source tracking introduces its own failure: a source that goes permanently quiet pins the watermark at ${wmTxt(perSource[END][IDLE_KEY])} forever unless an idleness timeout declares it finished — which is a decision, not a measurement.`],
    diagramHeading: 'Visual walkthrough — the formula, the sweep, and the threshold',
    sub: `The sweep, the ${secs(LAG_MIN)} threshold and the per-source minimum are computed from the seed and asserted; ${secs(LAG_MIN - 1)} is checked to be still wrong.` },
  { name: 'ch03-propagation', steps: C3,
    title: 'Propagation and correctness — the minimum, and what "closed" means',
    subtitle: `per-source min ${wmTxt(MINWM[END])} vs global ${wmTxt(WATERMARKS[END])} · ${BLOCKED.length} window withheld`,
    heading: 'Why a stage takes the minimum, and why "closed" is not "complete"',
    why: [
      `**When a stage has several upstream inputs, its watermark is the minimum of theirs.** The reason is a one-liner: a stage cannot claim more completeness than its least-complete input.`, '',
      `Trace it on this stream, treating the two keys as two sources. Until source "${KEYS[1]}" has produced anything, the stage has **no claim at all** — not a generous one — because silence is indistinguishable from "an old event is still coming". At the end, source "${BUSY_KEY}" has reached ${wmTxt(perSource[END][BUSY_KEY])} and "${IDLE_KEY}" is at ${wmTxt(perSource[END][IDLE_KEY])}, so the stage must claim **${wmTxt(MINWM[END])}**.`, '',
      `**And a passed watermark is a decision, not a fact.** Four readings of the same event, only the last accurate:`, '',
      `- the watermark passed ${mm(W0_END)} after event id ${EVENTS[heurCloses].id} — a fact about the pipeline's arithmetic`,
      `- "no event earlier than ${mm(W0_END)} will arrive" — the claim it implies, and it is false`,
      `- id ${L.id} (${hhmmss(L.et)}) arrives ${LI - heurCloses} events later — the counter-example nothing predicted`,
      `- so the window was not **complete**; it was **closed** — the pipeline chose to stop waiting`, '',
      `Substituting "complete" for "closed" is what makes late data feel like a bug. It is the pipeline having decided, with an error attached: ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% of this window's answer.`, '',
      `**So allowed lateness is the safety net under the estimate**, and the three mechanisms layer in order: the watermark estimates completeness and is wrong; the on-time trigger acts on the estimate and publishes ${HEUR_VALUE}; allowed lateness keeps the state so id ${L.id} can correct it to ${W0_TRUE}. Each exists because the previous one is imperfect — and the horizon is bounded on purpose, because unbounded recovery means unbounded state.`],
    whenHeading: 'When the minimum rule bites, and what watermarks actually buy',
    when: [
      `**The minimum rule bites whenever one input is slower or quieter than the others.** ${BLOCKED.length} window here — ${BLOCKED.map(w => `[${mm(w)}, ${mm(w + WIN)})`).join(', ')}, holding ${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')} — closes under a single global watermark and stays open under the minimum. The data for it has all arrived. It is withheld because one source cannot vouch for the time range.`, '',
      `**That is correct behaviour and it looks like a bug in production.** The symptom is output stopping while the pipeline reports healthy, and the cause is an input nobody is watching. It is the reason real systems add idleness detection — which is a decision to declare a source finished, not a measurement of anything.`, '',
      `**And the thing watermarks actually buy:** without one, window [${mm(W0)}, ${mm(W0_END)}) can **never** be emitted. On an unbounded stream there is no moment at which "everything has arrived" becomes true. The alternatives are a processing-time trigger, which answers a different question, or waiting forever, which answers none.`, '',
      `So watermarks do not make event-time processing *correct* — they make it *possible*. This window is emitted ${Math.round(100 * (W0_TRUE - HEUR_VALUE) / W0_TRUE)}% wrong and correctable, and that trade is the foundation the rest of the book builds on.`, '',
      `**What this does not settle:** ${BLOCKED.length} window stays open because a source went quiet, and no amount of skew tuning fixes it — that is a structural property of taking the minimum. The fix is an idleness timeout, which trades the correctness the minimum was protecting.`],
    diagramHeading: 'Visual walkthrough — the minimum, the decision, and the safety net',
    sub: `The per-source watermarks, their minimum and the withheld window are computed from the seed and asserted.` },
  { name: 'ch03-system', steps: C4,
    title: 'System design — the watermark generator',
    subtitle: `max seen − ${secs(LAG)}, per source, minimum across · naive formula regresses ${REGRESSIONS.length}x`,
    heading: 'Why this component is small, and why its failures look like wrong totals',
    why: [
      `**The question.** Design the watermark generator for an event-time pipeline: it advances as max-seen event time minus a skew bound, so windows close on time and a straggler afterwards is flagged late.`, '',
      `**The pipeline:** sources → **watermark generator** → window assigner → per-window state → trigger/emitter → dashboard.`, '',
      `**First, the blast radius.** The generator emits one number, and exactly one component consumes it: the trigger. The window assigner is pure \`winOf(e.et)\` and never sees the watermark. So a watermark bug **cannot** put an event in the wrong window — it can only make a window speak too early or too late. That is why its failures present as under-counted totals rather than scattered data, and why "our numbers are low" maps back to this component.`, '',
      `**Second, why \`max()\` is in the formula.** The naive version — this event's own time minus the skew — looks equivalent. Compute both and the naive one goes **backwards ${REGRESSIONS.length} times**: ${REGRESSIONS.map(r => `${wmTxt(r.from)} → ${wmTxt(r.to)} (−${secs(r.from - r.to)})`).join(', and ')}.`, '',
      `A watermark that moves backwards **re-opens a window that was already closed and published.** Every downstream guarantee is built on monotonicity, and \`max()\` is the single function call that provides it.`, '',
      `**Third, the two settings.** The skew bound: ${secs(LAG)} publishes ${HEUR_VALUE} at ${hhmmss(EVENTS[heurCloses].pt)} with ${sweep(LAG).late.length} event late; ${secs(LAG_MIN)} publishes ${CORRECT_SWEEP.value} at ${hhmmss(CORRECT_SWEEP.closeAt)} with ${CORRECT_SWEEP.late.length} late, ${secs(LAG_PRICE)} slower. And the scope: one global watermark claims ${wmTxt(WATERMARKS[END])} at the end, which is ${secs(IDLE_GAP)} more than source "${IDLE_KEY}" supports; the per-source minimum claims ${wmTxt(MINWM[END])} and withholds ${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}.`],
    whenHeading: 'When each setting is right, and the four things this does not settle',
    when: [
      `**Use a global watermark when all sources are symmetric and busy** — one Kafka topic read by one consumer group with even traffic. It is simpler and it is not wrong when no input can go quiet relative to the others.`, '',
      `**Use per-source tracking the moment idleness is possible** — per-partition, per-device, per-region. The minimum is the safe claim, and the price is visible: ${BLOCKED.length} window withheld here.`, '',
      `**Pair per-source tracking with an idleness timeout,** always. Without one, a source that disappears pins the watermark at ${wmTxt(perSource[END][IDLE_KEY])} forever and every window stops closing. That is the single most common way this component takes a pipeline down, and it presents as a stall rather than an error.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **The ${secs(LAG)} skew bound is unverifiable from inside.** Nothing distinguishes "no late events arrived" from "late events were already discarded", so the output cannot tell you whether the bound is well tuned.`,
      `2. **Per-source tracking needs to know the source set.** A source that never appears cannot be waited for, and one that disappears needs a timeout — which is a decision to declare it finished, trading away the correctness the minimum was protecting.`,
      `3. **Monotonicity holds only within one run.** \`max()\` guarantees it here, but a generator that restarts and recomputes from a checkpoint can emit a value below one it already published — and nothing downstream is prepared for that.`,
      `4. **Window [${mm(WIN_STARTS[WIN_STARTS.length - 1])}, …) never closes under ANY skew bound in the sweep**, because no event ever pushes the watermark past its end. The generator is working correctly and that window's ${SUM(WINDOWS[WIN_STARTS[WIN_STARTS.length - 1]])} is simply never published.`],
    diagramHeading: 'Visual walkthrough — placement, the max(), and the two knobs',
    sub: `The naive formula's ${REGRESSIONS.length} regressions, both thresholds and the withheld window are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · lag ${secs(LAG)} · window [${mm(W0)}, ${mm(W0_END)}) = ${W0_TRUE}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch03.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch03.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being summed  ·  key = which SOURCE it came from',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the straggler`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the window width, in seconds of event time.  WIN = ${WIN}`,
  `// primitive: LAG — the assumed worst-case skew, in seconds.  LAG = ${LAG}`,
  `// primitive: W0 — the window this chapter follows.  W0 = ${W0}  ([${mm(W0)}, ${mm(W0_END)}))`,
  `// primitive: KEYS — the source names.  KEYS = ["${KEYS.join('", "')}"]`,
  '// primitive: max(xs) — the largest element.  max([1, 3, 2]) = 3',
  '// primitive: min(xs) — the smallest element.  min([1, 3, 2]) = 1',
  '// primitive: winOf(et) — the START of the WIN-second window holding et.',
  `//   winOf(${L.et}) = ${winOf(L.et)}      winOf(${EVENTS[4].et}) = ${winOf(EVENTS[4].et)}`,
  '// primitive: sum(ids) — total v over those event ids.',
  `//   sum([${W0_IDS.join(', ')}]) = ${W0_TRUE}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
];
const PROGRAMS = [];

// ---- concept 1: monotonicity, and the perfect watermark --------------------
PROGRAMS.push({
  name: 'ch03-watermark-memory',
  title: 'The watermark, computed two ways — heuristic and perfect',
  subtitle: `heuristic reaches ${WATERMARKS[heurCloses]} and publishes ${HEUR_VALUE} · perfect stalls at ${PERFECT[1]} and publishes ${PERF_VALUE}`,
  src: COMMON.concat([
    '',
    'type Trace { values, closedAt, published }',
    '',
    '// function: heuristic(events) — max event time seen so far, minus LAG, after',
    '//   each arrival. Monotonic because max() cannot shrink.',
    `//   heuristic(EVENTS).values = [${WATERMARKS.join(', ')}]`,
    'fun heuristic(events) {',
    '    var out  = []',
    '    var seen = NONE',
    '    for (e in events) {',
    '        if (seen == NONE)  { seen = e.et }',
    '        if (e.et > seen)   { seen = e.et }',
    '        out = append(out, seen - LAG)',
    '    }',
    '    return out',
    '}',
    '',
    '// function: perfect(events) — the largest time for which no EARLIER event is',
    '//   still to come. It reads events[i+1 ..], which a live pipeline cannot do.',
    `//   perfect(EVENTS)[1] = ${PERFECT[1]}      perfect(EVENTS)[${perfCloses}] = ${PERFECT[perfCloses]}`,
    'fun perfect(events) {',
    '    var out = []',
    '    for (i in 0 .. len(events) - 1) {',
    '        var smallest = NONE',
    '        for (j in i + 1 .. len(events) - 1) {',
    '            if (smallest == NONE || events[j].et < smallest) { smallest = events[j].et }',
    '        }',
    '        out = append(out, smallest)',
    '    }',
    '    return out',
    '}',
    '',
    '// function: closeW0(wm) — the first index at which a watermark lets W0 fire,',
    '//   and what W0 holds at that moment.',
    `//   closeW0(heuristic(EVENTS)) = (${heurCloses}, ${HEUR_VALUE})`,
    `//   closeW0(perfect(EVENTS))   = (${perfCloses}, ${PERF_VALUE})`,
    'fun closeW0(wm) {',
    '    var ids = []',
    '    for (i in 0 .. len(wm) - 1) {',
    '        if (winOf(EVENTS[i].et) == W0) { ids = append(ids, EVENTS[i].id) }',
    '        if (wm[i] >= W0 + WIN) { return Trace(wm, i, sum(ids)) }',
    '    }',
    '    return Trace(wm, NONE, sum(ids))',
    '}',
    '',
    '// function: main() — THE CALLER: the same window, under both watermarks.',
    'fun main() {',
    '    val h = closeW0(heuristic(EVENTS))',
    '    val p = closeW0(perfect(EVENTS))',
    '    val priceSeconds = EVENTS[p.closedAt].pt - EVENTS[h.closedAt].pt',
    '}',
  ]),
  heap: {
    h: { addr: '0x100', type: 'Trace', val: () => `closedAt ${heurCloses} · published ${HEUR_VALUE}` },
    p: { addr: '0x200', type: 'Trace', val: () => `closedAt ${perfCloses} · published ${PERF_VALUE}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `h = ${o.h || '...'}`, `p = ${o.p || '...'}`,
      `priceSeconds = ${o.price !== undefined ? o.price : '...'}`] });
    return [
      { t: 'the max is what makes the watermark monotonic', line: at('fun heuristic(events)', 'if (e.et > seen)   { seen = e.et }', 'out = append(out, seen - LAG)'),
        stack: [MAIN(), { name: 'heuristic', locals: ['events = EVENTS', 'out = (6 values so far)', `seen = ${maxEtThrough(6)}`, `e = EVENTS[${EVENTS[6].id}]`] }],
        heap: [],
        cap: `Event id ${EVENTS[6].id} has \`et\` = ${EVENTS[6].et}, which is BELOW \`seen\` = ${maxEtThrough(6)}, so the \`if\` does not fire and \`seen\` is unchanged. The appended watermark is ${WATERMARKS[6]} — the same as the previous one. An out-of-order event cannot move the watermark backwards; it simply does not move it.` },
      { t: 'the perfect watermark reads the FUTURE, which is the catch', line: at('fun perfect(events)', 'for (j in i + 1 .. len(events) - 1) {'),
        stack: [MAIN(), { name: 'perfect', locals: ['events = EVENTS', 'out = (2 values so far)', 'i = 1', 'smallest = ' + PERFECT[1], 'j = ' + LI] }],
        heap: [],
        cap: `The inner loop starts at \`i + 1\` — it inspects events that have not arrived. For \`i\` = 1 it finds id ${L.id}'s \`et\` = ${L.et} and so \`smallest\` is ${PERFECT[1]}. That is the correct answer and the reason it is unavailable: a live pipeline has no \`events[j]\` for \`j > i\`.` },
      { t: `so the perfect watermark is stuck at ${PERFECT[1]} for ${PERF_STALL} events`, line: at('if (smallest == NONE || events[j].et < smallest) { smallest = events[j].et }'),
        stack: [MAIN({ h: '@0x100' }), { name: 'perfect', locals: ['events = EVENTS', `out = (${PERF_STALL} values so far)`, `i = ${PERF_STALL - 1}`, `smallest = ${PERFECT[1]}`, `j = ${LI}`] }],
        heap: [{ key: 'h', hot: true }],
        cap: `For every \`i\` from 1 to ${PERF_STALL - 1} this line finds the same event — id ${L.id}, \`et\` = ${L.et} — so \`smallest\` is ${PERFECT[1]} every time. ${PERF_STALL} consecutive values, no progress. The heuristic reached ${WATERMARKS[heurCloses]} over that span, which is ${WATERMARKS[heurCloses] - PERFECT[1]}s of progress it could not justify.` },
      { t: `and the window's answer differs by ${W0_TRUE - HEUR_VALUE}`, line: at('fun closeW0(wm)', 'if (wm[i] >= W0 + WIN) { return Trace(wm, i, sum(ids)) }'),
        stack: [MAIN({ h: '@0x100', p: '@0x200', price: CORRECT_COST }), { name: 'closeW0', locals: [`wm = perfect(EVENTS)`, 'ids = @0x300', `i = ${perfCloses}`] }],
        heap: [{ key: 'h' }, { key: 'p', hot: true }],
        cap: `\`closeW0\` is given a watermark array and nothing else — it does not know which generator produced it. With the heuristic it returns at \`i\` = ${heurCloses} with ${HEUR_VALUE}; with the perfect one at \`i\` = ${perfCloses} with ${PERF_VALUE}. \`priceSeconds\` = ${CORRECT_COST}: that is what the correct answer costs, and it required reading the future.` },
    ];
  },
  intro: [
    `**What is being answered.** What a watermark is, by computing two of them over the same stream and feeding both to the same trigger.`, '',
    `\`heuristic(events)\` reads only \`events[0..i]\`. \`perfect(events)\` has an inner loop starting at \`i + 1\` — it reads events that have not arrived, which is precisely why it is unavailable in production and why step 2 is worth staring at.`, '',
    `\`closeW0(wm)\` takes a watermark array and does not know which generator made it. Same trigger, same window, same events: ${HEUR_VALUE} at index ${heurCloses} against ${PERF_VALUE} at index ${perfCloses}. The ${CORRECT_COST}s difference is the price of the correct answer.`],
  sub: `The ${PERF_STALL}-event stall, both published values and the ${CORRECT_COST}s price are computed from the seed and asserted.` });

// ---- concept 2: the skew sweep ---------------------------------------------
PROGRAMS.push({
  name: 'ch03-skew-memory',
  title: 'Sweeping the skew bound — where "late" comes from',
  subtitle: `${SWEEP.map(s => `${s.lag}s→${s.value}/${s.late.length} late`).join(' · ')} · correct at ${LAG_MIN}s`,
  src: COMMON.concat([
    '',
    'type Verdict { lag, closedAt, published, lateIds }',
    '',
    `// primitive: LAG_MIN — the smallest skew bound that makes W0 correct.  LAG_MIN = ${LAG_MIN}`,
    `//   derived: max event time seen BEFORE the straggler (${maxEtThrough(LI - 1)}) − the window end (${W0_END}) + 1`,
    '// primitive: maxEtThrough(i) — the highest event time in EVENTS[0 .. i].',
    `//   maxEtThrough(${LI - 1}) = ${maxEtThrough(LI - 1)}      maxEtThrough(${EVENTS.length - 1}) = ${maxEtThrough(EVENTS.length - 1)}`,
    '',
    '// function: watermarkAt(i, lag) — the heuristic, parameterised by the bound.',
    `//   watermarkAt(${heurCloses}, ${LAG}) = ${WATERMARKS[heurCloses]}      watermarkAt(${heurCloses}, ${LAG_MIN}) = ${maxEtThrough(heurCloses) - LAG_MIN}`,
    'fun watermarkAt(i, lag) {',
    '    return maxEtThrough(i) - lag',
    '}',
    '',
    '// function: closesAt(winStart, lag) — the first index at which that window fires.',
    `//   closesAt(W0, ${LAG}) = ${heurCloses}      closesAt(W0, ${LAG_MIN}) = ${CORRECT_SWEEP.closeIdx}`,
    'fun closesAt(winStart, lag) {',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAt(i, lag) >= winStart + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: isLate(e, i, lag) — was this event\'s window already closed when it',
    '//   arrived? Note it asks about the WINDOW, never about the event\'s own skew.',
    `//   isLate(EVENTS[${L.id}], ${LI}, ${LAG}) = true      isLate(EVENTS[${L.id}], ${LI}, ${LAG_MIN}) = false`,
    'fun isLate(e, i, lag) {',
    '    val c = closesAt(winOf(e.et), lag)',
    '    if (c == NONE) { return false }',
    '    return c < i',
    '}',
    '',
    '// function: evaluate(lag) — one skew bound, judged on W0 and on lateness.',
    `//   evaluate(${LAG}).published = ${HEUR_VALUE}      evaluate(${LAG_MIN}).published = ${CORRECT_SWEEP.value}`,
    'fun evaluate(lag) {',
    '    val c   = closesAt(W0, lag)',
    '    var ids = []',
    '    var bad = []',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (winOf(EVENTS[i].et) == W0 && i <= c) { ids = append(ids, EVENTS[i].id) }',
    '        if (isLate(EVENTS[i], i, lag))           { bad = append(bad, EVENTS[i].id) }',
    '    }',
    '    return Verdict(lag, c, sum(ids), bad)',
    '}',
    '',
    '// function: main() — THE CALLER: the same stream, four skew bounds.',
    'fun main() {',
    `    val fast    = evaluate(${SWEEP[0].lag})`,
    `    val deflt   = evaluate(${LAG})`,
    `    val justOff = evaluate(${LAG_MIN - 1})`,
    `    val right   = evaluate(${LAG_MIN})`,
    '}',
  ]),
  heap: {
    fast:  { addr: '0x100', type: 'Verdict', val: () => `lag ${SWEEP[0].lag} · published ${SWEEP[0].value} · late [${SWEEP[0].late.join(',')}]` },
    deflt: { addr: '0x200', type: 'Verdict', val: () => `lag ${LAG} · published ${HEUR_VALUE} · late [${sweep(LAG).late.join(',')}]` },
    right: { addr: '0x300', type: 'Verdict', val: () => `lag ${LAG_MIN} · published ${CORRECT_SWEEP.value} · late []` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `fast = ${o.fast || '...'}`, `deflt = ${o.deflt || '...'}`,
      `justOff = ${o.justOff || '...'}`, `right = ${o.right || '...'}`] });
    return [
      { t: 'the whole heuristic is one subtraction', line: at('fun watermarkAt(i, lag)', 'return maxEtThrough(i) - lag'),
        stack: [MAIN(), { name: 'evaluate', locals: [`lag = ${SWEEP[0].lag}`, 'c = ...', 'ids = @0x100', 'bad = []', 'i = 3'] },
                { name: 'closesAt', locals: [`winStart = ${W0}`, `lag = ${SWEEP[0].lag}`, 'i = 3'] },
                { name: 'watermarkAt', locals: ['i = 3', `lag = ${SWEEP[0].lag}`] }],
        heap: [{ key: 'fast', hot: true }],
        cap: `\`maxEtThrough(3)\` is ${maxEtThrough(3)} and \`lag\` is ${SWEEP[0].lag}, so the watermark is ${maxEtThrough(3) - SWEEP[0].lag} — already past ${W0_END}, so W0 fires at index 3. With \`lag\` = ${LAG} it would be ${maxEtThrough(3) - LAG} and the window would hold. One subtraction, and it decides when every window in the pipeline speaks.` },
      { t: '"late" is a verdict about the WINDOW, not about the event', line: at('fun isLate(e, i, lag)', 'return c < i', 'if (isLate(EVENTS[i], i, lag))           { bad = append(bad, EVENTS[i].id) }'),
        stack: [MAIN({ fast: '@0x100', deflt: '@0x200' }), { name: 'evaluate', locals: [`lag = ${LAG}`, `c = ${heurCloses}`, 'ids = @0x200', 'bad = []', `i = ${LI}`] },
                { name: 'isLate', locals: [`e = EVENTS[${L.id}]`, `i = ${LI}`, `lag = ${LAG}`, `c = ${heurCloses}`] }],
        heap: [{ key: 'fast' }, { key: 'deflt', hot: true }],
        cap: `\`isLate\` never looks at \`e.pt\` or \`e.et - e.pt\`. It compares the window's CLOSING index (${heurCloses}) with the event's arrival index (${LI}): ${heurCloses} < ${LI}, so late. Change \`lag\` and \`c\` changes, and the same event stops being late. Lateness is produced by the configuration, not carried by the event.` },
      { t: `one second below the threshold is still wrong`, line: at(`    val justOff = evaluate(${LAG_MIN - 1})`),
        stack: [MAIN({ fast: '@0x100', deflt: '@0x200', justOff: `lag ${LAG_MIN - 1}, published ${sweep(LAG_MIN - 1).value}` })],
        heap: [{ key: 'fast' }, { key: 'deflt' }],
        cap: `\`evaluate(${LAG_MIN - 1})\` publishes ${sweep(LAG_MIN - 1).value}, the same as the default. The watermark reaches ${maxEtThrough(LI - 1) - (LAG_MIN - 1)} before the straggler arrives, which is still ≥ ${W0_END}, so W0 has closed. The threshold is not approximate — it is a single comparison flipping.` },
      { t: 'and at the threshold, nothing is late at all', line: at(`    val right   = evaluate(${LAG_MIN})`),
        stack: [MAIN({ fast: '@0x100', deflt: '@0x200', justOff: `lag ${LAG_MIN - 1}, published ${sweep(LAG_MIN - 1).value}`, right: '@0x300' })],
        heap: [{ key: 'deflt' }, { key: 'right', hot: true }],
        cap: `\`right\` publishes ${CORRECT_SWEEP.value} with an empty \`lateIds\`. Read the three heap rows together: late counts ${SWEEP[0].late.length}, ${sweep(LAG).late.length}, ${CORRECT_SWEEP.late.length} — from identical data. And note ${LAG_MIN} is well below id ${L.id}'s ${L.pt - L.et}s of skew: the watermark only had to stay under ${W0_END}, never reach back to ${L.et}.` },
    ];
  },
  intro: [
    `**What is being answered.** Where "late" comes from — as one function, \`evaluate(lag)\`, run at four different skew bounds over the same ${EVENTS.length} events.`, '',
    `The line to read twice is in \`isLate\`: \`return c < i\`. It compares the **window's closing index** with the **event's arrival index**, and never looks at the event's own skew. That is the mechanical form of "late is a verdict, not a property".`, '',
    `\`LAG_MIN\` = ${LAG_MIN} is derived rather than chosen: the highest event time seen before the straggler (${maxEtThrough(LI - 1)}) minus the window's end (${W0_END}), plus one. It is far below the straggler's ${L.pt - L.et}s of skew, because the watermark only has to stay under the window boundary.`],
  sub: `The sweep, the ${LAG_MIN}s threshold and the ${LAG_MIN - 1}s counter-check are computed from the seed and asserted.` });

// ---- concept 3: propagation -------------------------------------------------
PROGRAMS.push({
  name: 'ch03-propagation-memory',
  title: 'Propagation — the minimum across inputs, and what it withholds',
  subtitle: `source "${BUSY_KEY}" ${perSource[END][BUSY_KEY]} · source "${IDLE_KEY}" ${perSource[END][IDLE_KEY]} · stage claims ${MINWM[END]}`,
  src: COMMON.concat([
    '',
    'type Stage { perSource, claim }',
    '',
    '// function: sourceWatermark(k, i) — one source\'s own watermark after event i,',
    '//   or NONE if that source has produced nothing yet.',
    `//   sourceWatermark("${KEYS[1]}", 0) = NONE      sourceWatermark("${BUSY_KEY}", ${END}) = ${perSource[END][BUSY_KEY]}`,
    'fun sourceWatermark(k, i) {',
    '    var seen = NONE',
    '    for (j in 0 .. i) {',
    '        if (EVENTS[j].key != k) { continue }',
    '        if (seen == NONE || EVENTS[j].et > seen) { seen = EVENTS[j].et }',
    '    }',
    '    if (seen == NONE) { return NONE }',
    '    return seen - LAG',
    '}',
    '',
    '// function: stageWatermark(i) — the MINIMUM over inputs. A source that has said',
    '//   nothing blocks the claim entirely: silence is not completeness.',
    `//   stageWatermark(0) = NONE      stageWatermark(${END}) = ${MINWM[END]}`,
    'fun stageWatermark(i) {',
    '    var lowest = NONE',
    '    for (k in KEYS) {',
    '        val w = sourceWatermark(k, i)',
    '        if (w == NONE) { return NONE }',
    '        if (lowest == NONE || w < lowest) { lowest = w }',
    '    }',
    '    return lowest',
    '}',
    '',
    '// primitive: maxEtThrough(i) — the highest event time in EVENTS[0 .. i].',
    `//   maxEtThrough(${END}) = ${maxEtThrough(END)}      maxEtThrough(0) = ${EVENTS[0].et}`,
    `// primitive: windowStarts() — every window start in this stream.  windowStarts() = [${WIN_STARTS.join(', ')}]`,
    '',
    '// function: globalWatermark(i) — the single-watermark alternative: max over ALL',
    '//   sources, minus LAG. It ignores which source an event came from.',
    `//   globalWatermark(${END}) = ${WATERMARKS[END]}`,
    'fun globalWatermark(i) {',
    '    return maxEtThrough(i) - LAG',
    '}',
    '',
    '// function: withheld(i) — windows the global watermark would close and the',
    '//   per-source minimum will not.',
    `//   withheld(${END}) = [${BLOCKED.join(', ')}]`,
    'fun withheld(i) {',
    '    var out = []',
    '    for (w in windowStarts()) {',
    '        if (globalWatermark(i) >= w + WIN && stageWatermark(i) < w + WIN) { out = append(out, w) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER: the stage\'s claim, and its cost.',
    'fun main() {',
    `    val claim  = stageWatermark(${END})`,
    `    val global = globalWatermark(${END})`,
    `    val held   = withheld(${END})`,
    '    val gap    = global - claim',
    '}',
  ]),
  heap: {
    per:  { addr: '0x100', type: 'Stage', val: () => KEYS.map(k => `${k}:${perSource[END][k]}`).join(' ') + ` · claim ${MINWM[END]}` },
    held: { addr: '0x200', type: `int[${BLOCKED.length}]`, val: () => `[${BLOCKED.join(', ')}] holding ${BLOCKED.map(w => SUM(WINDOWS[w])).join(', ')}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `claim = ${o.claim !== undefined ? o.claim : '...'}`, `global = ${o.global !== undefined ? o.global : '...'}`,
      `held = ${o.held || '...'}`, `gap = ${o.gap !== undefined ? o.gap : '...'}`] });
    return [
      { t: 'a source that has said nothing blocks the claim entirely', line: at('fun stageWatermark(i)', 'if (w == NONE) { return NONE }'),
        stack: [MAIN(), { name: 'stageWatermark', locals: ['i = 0', 'lowest = NONE', `k = "${KEYS[1]}"`, 'w = NONE'] }],
        heap: [],
        cap: `At \`i\` = 0 only source "${KEYS[0]}" has produced anything, so \`sourceWatermark("${KEYS[1]}", 0)\` is NONE and this line returns immediately. The stage makes NO claim — not a generous one. Silence is indistinguishable from "an old event is still coming", so it cannot be treated as completeness.` },
      { t: 'the claim is the lowest of the inputs, never the highest', line: at('if (lowest == NONE || w < lowest) { lowest = lowest }'.replace('lowest = lowest', 'lowest = w')),
        stack: [MAIN(), { name: 'stageWatermark', locals: [`i = ${END}`, `lowest = ${perSource[END][IDLE_KEY]}`, `k = "${IDLE_KEY}"`, `w = ${perSource[END][IDLE_KEY]}`] }],
        heap: [{ key: 'per', hot: true }],
        cap: `Source "${BUSY_KEY}" has reached ${perSource[END][BUSY_KEY]} and "${IDLE_KEY}" is at ${perSource[END][IDLE_KEY]} — its last event was id ${EVENTS.filter(e => e.key === IDLE_KEY).slice(-1)[0].id}. \`lowest\` ends at ${perSource[END][IDLE_KEY]}. The stage cannot claim more completeness than its least-complete input, so the quietest source sets the pace.` },
      { t: 'a single global watermark would over-claim', line: at('fun globalWatermark(i)', 'return maxEtThrough(i) - LAG'),
        stack: [MAIN({ claim: MINWM[END] }), { name: 'globalWatermark', locals: [`i = ${END}`] }],
        heap: [{ key: 'per' }],
        cap: `\`globalWatermark(${END})\` is ${maxEtThrough(END)} − ${LAG} = ${WATERMARKS[END]}, because it takes the max over ALL events and never asks which source they came from. That is ${IDLE_GAP}s more completeness than source "${IDLE_KEY}" can back — and it is the convenient, wrong answer.` },
      { t: 'and the correct claim withholds a window that is actually complete', line: at('fun withheld(i)', 'if (globalWatermark(i) >= w + WIN && stageWatermark(i) < w + WIN) { out = append(out, w) }'),
        stack: [MAIN({ claim: MINWM[END], global: WATERMARKS[END], held: '@0x200', gap: IDLE_GAP }), { name: 'withheld', locals: [`i = ${END}`, 'out = @0x200', `w = ${BLOCKED[0]}`] }],
        heap: [{ key: 'per' }, { key: 'held', hot: true }],
        cap: `Window ${BLOCKED[0]} ([${mm(BLOCKED[0])}, ${mm(BLOCKED[0] + WIN)})) satisfies both halves: the global watermark would close it and the stage's claim will not. Every event in it has arrived — it holds ${SUM(WINDOWS[BLOCKED[0]])} — and it is withheld because one source went quiet. That is correct, and in production it looks like output silently stopping.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a stage takes the minimum over its inputs, and what that costs — as three watermark functions over the same stream, treating the two keys as two sources.`, '',
    `\`stageWatermark(i)\` has the line that matters: \`if (w == NONE) { return NONE }\`. A source that has produced nothing blocks the claim completely, because silence cannot be distinguished from a pending old event.`, '',
    `\`globalWatermark(i)\` is the shortcut — max over everything, ignoring sources — and it claims ${WATERMARKS[END]} where the safe answer is ${MINWM[END]}. Step 4 shows the price of being right: window [${mm(BLOCKED[0])}, ${mm(BLOCKED[0] + WIN)}) holds ${SUM(WINDOWS[BLOCKED[0]])}, has received every one of its events, and is withheld anyway.`],
  sub: `The per-source watermarks, the minimum, and the withheld window list are computed from the seed and asserted.` });

// ---- concept 4: the generator itself ---------------------------------------
PROGRAMS.push({
  name: 'ch03-system-memory',
  title: 'The watermark generator — why max() is load-bearing',
  subtitle: `naive formula regresses ${REGRESSIONS.length}x (${REGRESSIONS.map(r => `−${r.from - r.to}s`).join(', ')}) · correct formula never does`,
  src: COMMON.concat([
    '',
    'type Gen { emitted, regressions }',
    '',
    '// function: naiveWatermark(e) — THE BUG: this event\'s own time, minus LAG.',
    `//   naiveWatermark(EVENTS[${EVENTS[REGRESSIONS[0].i - 1].id}]) = ${NAIVE[REGRESSIONS[0].i - 1]}      naiveWatermark(EVENTS[${EVENTS[REGRESSIONS[0].i].id}]) = ${NAIVE[REGRESSIONS[0].i]}`,
    'fun naiveWatermark(e) {',
    '    return e.et - LAG',
    '}',
    '',
    '// function: correctWatermark(seen, e) — the max so far, then minus LAG.',
    `//   correctWatermark(${maxEtThrough(REGRESSIONS[0].i - 1)}, EVENTS[${EVENTS[REGRESSIONS[0].i].id}]) = ${WATERMARKS[REGRESSIONS[0].i]}`,
    'fun correctWatermark(seen, e) {',
    '    var m = seen',
    '    if (m == NONE || e.et > m) { m = e.et }',
    '    return m - LAG',
    '}',
    '',
    '// function: run(useMax) — generate a watermark per event, counting any value',
    '//   that is lower than the one before it.',
    `//   run(false).regressions = ${REGRESSIONS.length}      run(true).regressions = 0`,
    'fun run(useMax) {',
    '    var out  = []',
    '    var seen = NONE',
    '    var back = 0',
    '    var prev = NONE',
    '    for (e in EVENTS) {',
    '        if (seen == NONE || e.et > seen) { seen = e.et }',
    '        var w = naiveWatermark(e)',
    '        if (useMax) { w = correctWatermark(seen, e) }',
    '        if (prev != NONE && w < prev) { back = back + 1 }',
    '        out  = append(out, w)',
    '        prev = w',
    '    }',
    '    return Gen(out, back)',
    '}',
    '',
    `// primitive: windowStarts() — every window start in this stream.  windowStarts() = [${WIN_STARTS.join(', ')}]`,
    '',
    '// function: reopened(g) — windows a regression would UN-close: already past the',
    '//   watermark once, and below it again afterwards.',
    `//   reopened(run(false)) = [${WIN_STARTS.filter(w => NAIVE.some((v, i) => v >= w + WIN && NAIVE.slice(i + 1).some(x => x < w + WIN))).join(', ') || 'none'}]`,
    'fun reopened(g) {',
    '    var out = []',
    '    for (w in windowStarts()) {',
    '        for (i in 0 .. len(g.emitted) - 1) {',
    '            if (g.emitted[i] >= w + WIN) {',
    '                for (j in i + 1 .. len(g.emitted) - 1) {',
    '                    if (g.emitted[j] < w + WIN) { out = append(out, w) }',
    '                }',
    '            }',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER: both formulas, same stream.',
    'fun main() {',
    '    val naive   = run(false)',
    '    val correct = run(true)',
    '    val broken  = reopened(naive)',
    '}',
  ]),
  heap: {
    naive:   { addr: '0x100', type: 'Gen', val: () => `regressions ${REGRESSIONS.length} · ${REGRESSIONS.map(r => `${r.from}→${r.to}`).join(' ')}` },
    correct: { addr: '0x200', type: 'Gen', val: () => `regressions 0 · monotonic` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `naive = ${o.naive || '...'}`, `correct = ${o.correct || '...'}`, `broken = ${o.broken || '...'}`] });
    const R0 = REGRESSIONS[0], R1 = REGRESSIONS[1];
    return [
      { t: 'the naive formula reads only the CURRENT event', line: at('fun naiveWatermark(e)', 'return e.et - LAG'),
        stack: [MAIN(), { name: 'run', locals: ['useMax = false', 'out = (6 values)', `seen = ${maxEtThrough(R0.i)}`, 'back = 0', `prev = ${R0.from}`, `e = EVENTS[${EVENTS[R0.i].id}]`, `w = ${NAIVE[R0.i]}`] },
                { name: 'naiveWatermark', locals: [`e = EVENTS[${EVENTS[R0.i].id}]`] }],
        heap: [{ key: 'naive', hot: true }],
        cap: `Event id ${EVENTS[R0.i].id} has \`et\` = ${EVENTS[R0.i].et}, so the naive watermark is ${NAIVE[R0.i]}. But \`prev\` is ${R0.from} and \`seen\` is already ${maxEtThrough(R0.i)} — the event is out of order, and the formula has no memory of that. Note \`seen\` is correct and simply unused on this path.` },
      { t: `so it goes BACKWARDS — ${REGRESSIONS.length} times`, line: at('if (prev != NONE && w < prev) { back = back + 1 }'),
        stack: [MAIN(), { name: 'run', locals: ['useMax = false', 'out = (8 values)', `seen = ${maxEtThrough(R1.i)}`, `back = ${REGRESSIONS.length}`, `prev = ${R1.from}`, `e = EVENTS[${EVENTS[R1.i].id}]`, `w = ${R1.to}`] }],
        heap: [{ key: 'naive', hot: true }],
        cap: `\`w\` = ${R1.to} against \`prev\` = ${R1.from}, so \`back\` reaches ${REGRESSIONS.length}: ${REGRESSIONS.map(r => `${r.from} → ${r.to} (−${r.from - r.to}s)`).join(' and ')}. A watermark going backwards is not a cosmetic problem — the next step shows what it does to a window.` },
      { t: 'one line makes it monotonic', line: at('fun correctWatermark(seen, e)', 'if (m == NONE || e.et > m) { m = e.et }'),
        stack: [MAIN({ naive: '@0x100' }), { name: 'run', locals: ['useMax = true', 'out = (6 values)', `seen = ${maxEtThrough(R0.i)}`, 'back = 0', `prev = ${WATERMARKS[R0.i - 1]}`, `e = EVENTS[${EVENTS[R0.i].id}]`, `w = ${WATERMARKS[R0.i]}`] },
                { name: 'correctWatermark', locals: [`seen = ${maxEtThrough(R0.i)}`, `e = EVENTS[${EVENTS[R0.i].id}]`, `m = ${maxEtThrough(R0.i)}`] }],
        heap: [{ key: 'naive' }, { key: 'correct', hot: true }],
        cap: `Same event, and \`m\` stays at ${maxEtThrough(R0.i)} because \`e.et\` (${EVENTS[R0.i].et}) is not greater. The emitted value is ${WATERMARKS[R0.i]} — equal to the previous one, never below it. \`back\` stays 0 for the whole stream: ${REGRESSIONS.length} regressions become 0 by replacing \`e.et\` with \`max(seen, e.et)\`.` },
      { t: 'and a regression would UN-close a published window', line: at('fun reopened(g)', 'if (g.emitted[j] < w + WIN) { out = append(out, w) }'),
        stack: [MAIN({ naive: '@0x100', correct: '@0x200', broken: '@0x300' }), { name: 'reopened', locals: ['g = @0x100', 'out = @0x300', `w = ${W0}`, `i = ${NAIVE.findIndex(v => v >= W0_END)}`, `j = ${REGRESSIONS[REGRESSIONS.length - 1].i}`] }],
        heap: [{ key: 'naive' }, { key: 'correct' }],
        cap: `For window ${W0} the naive watermark reached ${NAIVE[NAIVE.findIndex(v => v >= W0_END)]} at index ${NAIVE.findIndex(v => v >= W0_END)} — past ${W0_END}, so the window fired and published. Then at index ${REGRESSIONS[REGRESSIONS.length - 1].i} it fell to ${REGRESSIONS[REGRESSIONS.length - 1].to}, below ${W0_END} again. The window is now "not yet complete" after having been published. Nothing downstream has a concept for that.` },
    ];
  },
  intro: [
    `**What is being answered.** Why the watermark formula contains \`max()\`, by running both formulas over the same stream and counting what goes wrong.`, '',
    `\`naiveWatermark(e)\` is \`e.et - LAG\` — the version that looks equivalent. \`correctWatermark(seen, e)\` adds one line. \`run(useMax)\` generates both and counts any value lower than its predecessor.`, '',
    `The counts are ${REGRESSIONS.length} and 0. Step 4 then shows why that matters: a regression takes window ${W0}, which had already fired and published, back to "not yet complete". Monotonicity is not tidiness — it is the property every downstream trigger assumes.`],
  sub: `Both formulas' outputs, the ${REGRESSIONS.length} regressions and the re-opened window are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch03.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch03.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
