#!/usr/bin/env node
'use strict';
/* gen_ch02.js — ch02's four concepts, both bands each: the what / where / when /
 * how of one result. Every figure derives from tools/stream_seed.js, and the
 * derivations this chapter needs (sliding-window overlap, trigger sequences, the
 * allowed-lateness threshold, and the three accumulation outcomes) are computed
 * here and asserted. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, GAP, WATERMARKS, WINDOWS, WIN_STARTS, winOf,
        closedAt, LATE, SESSIONS, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
const PERIOD = WIN / 2;                         // sliding windows every 60s, 120s wide
const slidingStarts = (et) => {
  const out = [];
  for (let k = 0; k * PERIOD <= et; k++) { const st = k * PERIOD; if (et < st + WIN) out.push(st); }
  return out;
};
const SLIDE = {};
for (const e of EVENTS) for (const st of slidingStarts(e.et)) (SLIDE[st] = SLIDE[st] || []).push(e.id);
const SLIDE_STARTS = Object.keys(SLIDE).map(Number).sort((a, b) => a - b);
const SLIDE_TOTAL = EVENTS.reduce((s, e) => s + e.v * slidingStarts(e.et).length, 0);
const W0 = WIN_STARTS[0], W0_END = W0 + WIN;
const W0_IDS = WINDOWS[W0], W0_TRUE = SUM(W0_IDS);
const L = LATE[0], LI = EVENTS.indexOf(L);
const ONTIME_I = closedAt(W0);                                  // event index the watermark closes W0 at
const ONTIME_IDS = EVENTS.filter((e, i) => i <= ONTIME_I && winOf(e.et) === W0).map(e => e.id);
const ONTIME = SUM(ONTIME_IDS);
const LATE_DELTA = W0_TRUE - ONTIME;
// a processing-time trigger every PERIOD seconds: what W0 reads at each firing
const PT_FIRES = [];
for (let t = PERIOD; t <= Math.max(...EVENTS.map(e => e.pt)) + PERIOD; t += PERIOD) {
  const ids = EVENTS.filter(e => e.pt <= t && winOf(e.et) === W0).map(e => e.id);
  PT_FIRES.push({ at: t, ids, sum: SUM(ids) });
}
const PT_FIRST_CORRECT = PT_FIRES.find(f => f.sum === W0_TRUE);
// allowed lateness: W0's state survives while watermark < W0_END + allowed, so the
// correction only lands if allowed is large enough AT THE MOMENT id L arrives
const WM_AT_LATE = WATERMARKS[LI];
const ALLOWED_MIN = WM_AT_LATE - W0_END + 1;
// the three accumulation modes, and what a sink that assumes the WRONG one reports
const ACC = {
  discarding:  { panes: [ONTIME, LATE_DELTA],          sink: 'sum' },
  accumulating:{ panes: [ONTIME, W0_TRUE],             sink: 'replace' },
  retracting:  { panes: [ONTIME, -ONTIME, W0_TRUE],    sink: 'sum' },
};
const sinkSum = (panes) => panes.reduce((a, b) => a + b, 0);
const sinkReplace = (panes) => panes[panes.length - 1];
const RIGHT = W0_TRUE;
const WRONG_SUM_ACC = sinkSum(ACC.accumulating.panes);      // sink sums accumulating panes
const WRONG_REPL_DISC = sinkReplace(ACC.discarding.panes);  // sink replaces with discarding panes
const fail = (m) => { throw new Error(`gen_ch02: ${m}`); };
if (SLIDE_TOTAL <= TOTAL) fail(`sliding total ${SLIDE_TOTAL} does not exceed the fixed total ${TOTAL} — the overlap lesson would be invisible`);
if (ONTIME === W0_TRUE) fail(`the on-time pane already equals the truth (${ONTIME}) — there would be no refinement to explain`);
if (LATE_DELTA <= 0) fail('the late pane adds nothing');
if (sinkSum(ACC.discarding.panes) !== RIGHT) fail('discarding + summing sink does not reach the truth');
if (sinkReplace(ACC.accumulating.panes) !== RIGHT) fail('accumulating + replacing sink does not reach the truth');
if (sinkSum(ACC.retracting.panes) !== RIGHT) fail('retracting + summing sink does not reach the truth');
if (WRONG_SUM_ACC === RIGHT || WRONG_REPL_DISC === RIGHT) fail('a mismatched sink still gets the right answer — the "how" question would not matter');
if (ALLOWED_MIN <= 0) fail('the window state is still open with zero allowed lateness — no threshold to teach');
if (SESSIONS.a.length < 3 || SESSIONS.b.length < 2) fail('session counts changed; the windowing comparison needs a >= 3 and b >= 2');
if (!PT_FIRST_CORRECT) fail('a processing-time trigger never reaches the right answer in this seed');

const W = 1140;
const secs = (n) => `${n}s`;
const mm = (sec) => hhmmss(sec).slice(0, 5);

// =========================== CONCEPT 1 — WHAT AND WHERE =====================
const C1 = [
  { t: 'WHAT is one choice: the transformation', draw: (c) =>
      c.panel('WHAT — THE COMPUTATION, WITH THE WINDOW HELD FIXED', 'a')
      + c.mapRows('wt', c.P.main.x + 24, c.P.main.y + 52, [
        [`sum of v over window [${mm(W0)}, ${mm(W0_END)})`, `${W0_TRUE}   (ids ${W0_IDS.join(', ')})`],
        [`count over the same window`, `${W0_IDS.length} events`],
        [`max of v over the same window`, `${Math.max(...W0_IDS.map(i => EVENTS[i].v))}`],
        [`count DISTINCT key over the same window`, `${new Set(W0_IDS.map(i => EVENTS[i].key)).size}   (keys ${[...new Set(W0_IDS.map(i => EVENTS[i].key))].join(', ')})`],
      ], { w: 1040, rh: 34, hot: 0, label: 'four different WHATs, all over the same WHERE' })
      + c.note('w1', c.P.main.x + 24, c.P.main.y + 196, 1040, [
        `Every row reads the same ${W0_IDS.length} events. Only the computation changed, and the window was never mentioned.`,
        `In the Beam model this is a transform in a directed graph: it says what comes out, and nothing about boundaries.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Hold the window still and vary the computation: four answers from the same ${W0_IDS.length} events. That is "what" — a sum, a count, a max, a distinct count. Notice the last row needs the KEY field while the first needs only \`v\`; the transform decides which fields matter, and still says nothing about where a boundary falls.` },
  { t: 'WHERE is a separate choice: the windowing', draw: (c) =>
      c.panel('WHERE — THE SAME SUM, OVER FOUR DIFFERENT WINDOWINGS', 'a')
      + c.mapRows('wh', c.P.main.x + 24, c.P.main.y + 52, [
        [`global window (all of event time)`, `1 result: ${TOTAL}`],
        [`fixed ${secs(WIN)} windows`, `${WIN_STARTS.length} results: ${WIN_STARTS.map(w => SUM(WINDOWS[w])).join(', ')}  (total ${TOTAL})`],
        [`sliding ${secs(WIN)} wide, every ${secs(PERIOD)}`, `${SLIDE_STARTS.length} results, totalling ${SLIDE_TOTAL}`],
        [`session windows, ${secs(GAP)} gap`, `key a: ${SESSIONS.a.length} sessions · key b: ${SESSIONS.b.length} sessions`],
      ], { w: 1040, rh: 36, hot: 2, label: 'one transform (sum of v); four answers to "over what slice?"' })
      + c.note('h1', c.P.main.x + 24, c.P.main.y + 208, 1040, [
        `Read the third row twice: the sliding results total ${SLIDE_TOTAL}, not ${TOTAL}. No data was duplicated — the WINDOWS overlap, so most events are counted in two of them.`,
        `The fixed and global rows both total ${TOTAL} because their windows partition event time. Overlap is a property of the windowing, not of the data.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Same transform throughout — \`sum(v)\` — and four different shapes of answer. The sliding row is the one that surprises people: its results add up to ${SLIDE_TOTAL} against a dataset containing ${TOTAL}, because each event falls in up to ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} overlapping windows. Partitioning windows preserve the total; overlapping ones do not, by design.` },
  { t: 'the two axes really are independent', draw: (c) => {
      let s = c.panel('WHAT x WHERE — EVERY COMBINATION IS LEGAL', 'a');
      const WHATS = ['sum(v)', 'count', 'distinct key'];
      const WHERES = ['global', `fixed ${secs(WIN)}`, `sessions ${secs(GAP)}`];
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'the grid is filled in for key a; no cell is forbidden and no cell is implied by another', { size: 11, weight: 700, fill: c.C.line });
      WHERES.forEach((wh, j) => s += c.cv.text(c.P.main.x + 320 + j * 240, c.P.main.y + 68, wh, { size: 11, weight: 700, mono: false, anchor: 'middle', fill: c.C.line, band: 'gh' + j }));
      const aIds = EVENTS.filter(e => e.key === 'a').map(e => e.id);
      const cell = (wi, wj) => {
        if (wj === 0) return wi === 0 ? String(SUM(aIds)) : wi === 1 ? String(aIds.length) : '1';
        if (wj === 1) { const per = WIN_STARTS.map(w => WINDOWS[w].filter(i => EVENTS[i].key === 'a')); 
          const nz = per.filter(x => x.length); 
          return wi === 0 ? nz.map(x => SUM(x)).join(',') : wi === 1 ? nz.map(x => x.length).join(',') : nz.map(() => 1).join(','); }
        return wi === 0 ? SESSIONS.a.map(x => SUM(x.ids)).join(',') : wi === 1 ? SESSIONS.a.map(x => x.ids.length).join(',') : SESSIONS.a.map(() => 1).join(',');
      };
      WHATS.forEach((wt, i) => {
        const y = c.P.main.y + 78 + i * 38;
        s += c.cv.rect('gr' + i, c.P.main.x + 24, y, 1040, 34, { fill: i % 2 ? c.C.panel : c.C.paper, stroke: c.C.faint, rx: 3 });
        s += c.cv.text(c.P.main.x + 40, y + 22, wt, { size: 11, weight: 700, band: 'gk' + i });
        WHERES.forEach((wh, j) => s += c.cv.text(c.P.main.x + 320 + j * 240, y + 22, cell(i, j), { size: 11, anchor: 'middle', fill: c.C.ink, band: `gv${i}_${j}` }));
      });
      return s + c.note('g1', c.P.main.x + 24, c.P.main.y + 200, 1040, [
        `Nine cells, nine legal pipelines. Changing the row does not constrain the column and the reverse is also true.`,
        `This is why the book asks the two questions separately: a design that answers only one of them is not half-specified, it is unspecified.`,
      ], c.C.good, c.C.goodFill); },
    cap: `Nine cells and every one is a real pipeline you could run. The grid is the argument for separating the questions: "we sum purchases" names a row and leaves the answer undetermined, and "we use session windows" names a column and does the same. Both are needed before any number exists.` },
  { t: 'batch already answers both — implicitly', draw: (c) =>
      c.panel('A MAPREDUCE JOB, IN THESE TERMS', 'p')
      + c.mapRows('bm', c.P.main.x + 24, c.P.main.y + 52, [
        ['WHAT', 'the map and reduce functions — explicit, and the part everyone discusses'],
        ['WHERE', `the input file — ONE implicit window covering all ${TOTAL} of the data`],
        ['WHEN', 'end of input — implicit, and the reason it never comes up'],
        ['HOW', 'nothing to relate: one window emits once, so there are no panes'],
      ], { w: 1040, rh: 36, hot: 1, label: 'the same four questions, answered by a batch job without being asked' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Batch answers all four. It just answers three of them by accident, because the input ended.`,
        `So the streaming model is not four new questions — it is the same four, with the defaults removed.`,
      ], c.C.good, c.C.goodFill),
    cap: `This is why the four questions are not streaming jargon. A MapReduce job over one file answers WHERE with "the file" and WHEN with "when I finish reading it", and both are correct — they are just invisible. Take away the end of the input and all three defaults stop existing at once, which is the whole difficulty.` },
];

// =========================== CONCEPT 2 — WHEN ===============================
const C2 = [
  { t: 'a trigger is the thing that says "emit now"', draw: (c) => {
      let s = c.panel(`A PROCESSING-TIME TRIGGER, EVERY ${secs(PERIOD)} — WHAT WINDOW [${mm(W0)}, ${mm(W0_END)}) READS`, 'a');
      PT_FIRES.slice(0, 6).forEach((f, i) => {
        const y = c.P.main.y + 58 + i * 34, right = f.sum === W0_TRUE;
        s += c.cv.rect('pf' + i, c.P.main.x + 24, y, 1040, 30, { fill: right ? c.C.goodFill : c.C.hotFill, stroke: right ? c.C.good : c.C.hot, rx: 3, sw: 2 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `fires at ${hhmmss(f.at)}`, { size: 11, weight: 700, band: 'pfk' + i });
        s += c.cv.text(c.P.main.x + 260, y + 20, `events in the window that have arrived: ids ${f.ids.join(',') || 'none'}`, { size: 11, band: 'pfv' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 20, `emits ${f.sum}`, { size: 11, anchor: 'end', weight: 700, fill: right ? c.C.good : c.C.hot, band: 'pfs' + i });
      });
      return s + c.note('p1', c.P.main.x + 24, c.P.main.y + 72 + 6 * 34, 1040, [
        `The trigger fires on the CLOCK, so it emits whatever has arrived — ${PT_FIRES.slice(0, 6).map(f => f.sum).join(', then ')}.`,
        `It first reaches the right answer, ${W0_TRUE}, at ${hhmmss(PT_FIRST_CORRECT.at)} — and it has no way to know that firing was the right one.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `A processing-time trigger is the simplest possible "when": fire every ${secs(PERIOD)}. It is never blocked and never wrong about its own rule — and it emits ${PT_FIRES[0].sum}, then ${PT_FIRES[1].sum}, then ${PT_FIRES[2].sum}. The right answer appears at ${hhmmss(PT_FIRST_CORRECT.at)}, indistinguishable from the firings before it.` },
  { t: 'a watermark lets a trigger say "the window is COMPLETE"', draw: (c) =>
      c.panel('THE EVENT-TIME TRIGGER — FIRE WHEN THE WATERMARK PASSES THE WINDOW END', 'a')
      + c.mapRows('et', c.P.main.x + 24, c.P.main.y + 52, EVENTS.slice(0, ONTIME_I + 1).map((e, i) => [
          `after event id ${e.id} (seen ${hhmmss(e.pt)})`,
          `watermark ${WATERMARKS[i] < 0 ? 'none yet' : hhmmss(WATERMARKS[i])} ${WATERMARKS[i] >= W0_END ? `>= ${mm(W0_END)} — FIRE` : `< ${mm(W0_END)} — hold`}`,
        ]), { w: 1040, rh: 32, hot: ONTIME_I, label: `the window ends at ${mm(W0_END)}; the trigger waits for the watermark to pass it` })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 66 + (ONTIME_I + 1) * 32, 1040, [
        `It fires once, after event id ${EVENTS[ONTIME_I].id} at ${hhmmss(EVENTS[ONTIME_I].pt)}, emitting ${ONTIME} from ids ${ONTIME_IDS.join(', ')}.`,
        `That is a claim of COMPLETENESS, not of elapsed time — and it is wrong, because id ${L.id} has not arrived. The claim and the error are the same event.`,
      ], c.C.warn, c.C.warnFill),
    cap: `This trigger waits for a reason rather than a clock: fire when the watermark passes ${mm(W0_END)}. It fires exactly once, at ${hhmmss(EVENTS[ONTIME_I].pt)}, and emits ${ONTIME}. Compare that with the previous step: fewer firings, a meaningful claim attached to each — and still ${ONTIME} rather than ${W0_TRUE}, because the watermark was wrong about completeness.` },
  { t: 'so a pipeline wants THREE triggers, not one', draw: (c) =>
      c.panel('EARLY · ON-TIME · LATE', 'a')
      + c.mapRows('tr', c.P.main.x + 24, c.P.main.y + 52, [
        [`EARLY — every ${secs(PERIOD)} before the watermark`, `speculative: ${PT_FIRES.slice(0, 3).map(f => f.sum).join(', ')} — fast and knowingly incomplete`],
        [`ON-TIME — when the watermark passes ${mm(W0_END)}`, `${ONTIME} at ${hhmmss(EVENTS[ONTIME_I].pt)} — the pipeline's best claim`],
        [`LATE — once per straggler after that`, `${W0_TRUE} at ${hhmmss(L.pt)}, when id ${L.id} lands`],
      ], { w: 1040, rh: 40, hot: 2, label: 'three separate triggers on one window, each answering a different need' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 190, 1040, [
        `These are not alternatives — a real pipeline fires all three on the SAME window, producing ${1 + 1 + 1}+ results for one answer.`,
        `Early serves a dashboard that wants something now; on-time serves a report; late serves correctness. One trigger cannot serve all three.`,
      ], c.C.good, c.C.goodFill),
    cap: `The reason "when" is a question rather than a setting: these three triggers serve three different consumers, and a window fires for all of them. One window, several published results — which is exactly the situation the fourth question ("how") exists to make safe.` },
  { t: `and allowed lateness decides whether the fix ever lands`, draw: (c) =>
      c.panel('ALLOWED LATENESS — GARBAGE COLLECTION FOR WINDOW STATE', 'a')
      + c.mapRows('al', c.P.main.x + 24, c.P.main.y + 52, [
        [`watermark when id ${L.id} arrives`, `${hhmmss(WM_AT_LATE)}  (${WM_AT_LATE}s)`],
        [`state survives while watermark < ${mm(W0_END)} + allowed`, `so allowed must exceed ${WM_AT_LATE - W0_END}s`],
        [`allowed lateness = ${secs(ALLOWED_MIN - 1)}`, `state already dropped — id ${L.id} discarded, ${ONTIME} stands forever`],
        [`allowed lateness = ${secs(ALLOWED_MIN)}`, `state still held — the late trigger fires and corrects to ${W0_TRUE}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one knob, and the exact value at which the answer changes' })
      + c.note('a1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The threshold is ${secs(ALLOWED_MIN)} — not id ${L.id}'s ${secs(L.pt - L.et)} of skew, which is the number a reader would guess.`,
        `It is set by how far the WATERMARK had advanced, which jumped from ${hhmmss(WATERMARKS[ONTIME_I - 1])} to ${hhmmss(WATERMARKS[ONTIME_I])} in one event. The knob is calibrated against the watermark, not against the data.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Allowed lateness is how long a window's state is kept after the watermark passes — it bounds memory, and it decides whether a straggler can still change an answer. Here the threshold is exactly ${secs(ALLOWED_MIN)}: at ${secs(ALLOWED_MIN - 1)} the correction is impossible and at ${secs(ALLOWED_MIN)} it happens. That number comes from the watermark's jump, not from the ${secs(L.pt - L.et)} of skew.` },
];

// =========================== CONCEPT 3 — HOW ================================
const C3 = [
  { t: 'one window emitted twice: now what do the two mean?', draw: (c) =>
      c.panel(`WINDOW [${mm(W0)}, ${mm(W0_END)}) FIRES TWICE`, 'a')
      + c.mapRows('pn', c.P.main.x + 24, c.P.main.y + 52, [
        [`pane 1 — on-time, at ${hhmmss(EVENTS[ONTIME_I].pt)}`, `ids ${ONTIME_IDS.join(', ')} had arrived · the window held ${ONTIME}`],
        [`pane 2 — late, at ${hhmmss(L.pt)}`, `id ${L.id} (v ${L.v}) arrives · the window now holds ${W0_TRUE}`],
        [`the question "how" asks`, `does pane 2 REPLACE pane 1, or ADD to it?`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the same window, two published results' })
      + c.note('n1', c.P.main.x + 24, c.P.main.y + 172, 1040, [
        `Nothing in the numbers ${ONTIME} and ${W0_TRUE} says which. A sink receiving them must already know.`,
        `Get that agreement wrong and the sink is wrong, even though the pipeline computed both panes correctly.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Two panes for one window, both correct at the moment they were produced. The numbers alone do not say whether ${W0_TRUE} is a replacement for ${ONTIME} or an addition to it — and a sink has to decide. "How" is the name of that agreement, and it is the fourth question because it only exists once "when" allows more than one firing.` },
  { t: 'three accumulation modes, three different pane streams', draw: (c) =>
      c.panel('WHAT EACH MODE ACTUALLY EMITS FOR THOSE TWO FIRINGS', 'a')
      + c.mapRows('am', c.P.main.x + 24, c.P.main.y + 52, [
        [`DISCARDING`, `panes: ${ACC.discarding.panes.join(', ')} — each pane is only the NEW data`],
        [`ACCUMULATING`, `panes: ${ACC.accumulating.panes.join(', ')} — each pane is the window's total so far`],
        [`ACCUMULATING & RETRACTING`, `panes: ${ACC.retracting.panes.join(', ')} — the total, preceded by an undo of the old total`],
      ], { w: 1040, rh: 38, hot: 2, label: 'same window, same two firings, same underlying events' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 182, 1040, [
        `Discarding's second pane is ${LATE_DELTA} — the new event's value alone. Accumulating's is ${W0_TRUE} — the whole window.`,
        `Retracting emits BOTH an undo (${-ONTIME}) and the new total (${W0_TRUE}), so a sink that can only add is still correct.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The three modes publish three different streams from identical inputs. Discarding is cheapest — it sends ${LATE_DELTA} rather than ${W0_TRUE} — and requires a sink that sums. Accumulating is simplest to read and requires a sink that overwrites. Retracting is the only one that is safe for a sink which can only append, which is most of them.` },
  { t: 'and a mismatched sink is wrong by a specific amount', draw: (c) =>
      c.panel('THE SAME PANES, INTO THE WRONG KIND OF SINK', 'a')
      + c.mapRows('ms', c.P.main.x + 24, c.P.main.y + 52, [
        [`discarding panes (${ACC.discarding.panes.join(', ')}) into a SUMMING sink`, `${RIGHT} — correct`],
        [`accumulating panes (${ACC.accumulating.panes.join(', ')}) into a REPLACING sink`, `${RIGHT} — correct`],
        [`retracting panes (${ACC.retracting.panes.join(', ')}) into a SUMMING sink`, `${RIGHT} — correct`],
        [`accumulating panes into a SUMMING sink`, `${WRONG_SUM_ACC} — ${Math.round(100 * (WRONG_SUM_ACC - RIGHT) / RIGHT)}% too HIGH (double counted)`],
        [`discarding panes into a REPLACING sink`, `${WRONG_REPL_DISC} — ${Math.round(100 * (RIGHT - WRONG_REPL_DISC) / RIGHT)}% too LOW (lost pane 1)`],
      ], { w: 1040, rh: 36, hot: 3, label: 'three agreements that work, two that silently do not' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 248, 1040, [
        `${RIGHT}, ${WRONG_SUM_ACC} or ${WRONG_REPL_DISC} — from the same window, the same events and the same two firings.`,
        `The pipeline is correct in all five rows. What differs is only whether the sink's assumption matches the mode, and nothing in the data reveals a mismatch.`,
      ], c.C.hot, c.C.hotFill),
    cap: `This is the concrete answer to "why does accumulation mode matter": the same window yields ${RIGHT}, ${WRONG_SUM_ACC} or ${WRONG_REPL_DISC} depending only on an agreement between two systems. The two failing rows are the common bugs — a sink that sums accumulating panes double-counts by ${WRONG_SUM_ACC - RIGHT}, and a sink that overwrites discarding panes throws away ${RIGHT - WRONG_REPL_DISC}.` },
  { t: 'so the four questions are a completeness checklist', draw: (c) =>
      c.panel('ANSWER ALL FOUR, OR THE BEHAVIOUR IS NOT SPECIFIED', 'p')
      + c.mapRows('q4', c.P.main.x + 24, c.P.main.y + 52, [
        [`WHAT`, `sum of v — ${W0_TRUE} over this window`],
        [`WHERE`, `fixed ${secs(WIN)} event-time windows — [${mm(W0)}, ${mm(W0_END)}) is one of ${WIN_STARTS.length}`],
        [`WHEN`, `early every ${secs(PERIOD)} · on-time at the watermark · late per straggler · allowed lateness >= ${secs(ALLOWED_MIN)}`],
        [`HOW`, `accumulating and retracting — panes ${ACC.retracting.panes.join(', ')}`],
      ], { w: 1040, rh: 38, hot: 3, label: 'one fully specified pipeline, for one result' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 216, 1040, [
        `Omit WHEN and you cannot say when the ${W0_TRUE} appears — or that ${ONTIME} is published first.`,
        `Omit HOW and you cannot say whether the sink ends at ${RIGHT}, ${WRONG_SUM_ACC} or ${WRONG_REPL_DISC}. Neither is a detail; each omission removes a guarantee.`,
      ], c.C.good, c.C.goodFill),
    cap: `Four lines fully specify one result's behaviour, and each line was shown to change an observable number. That is the test for whether a question belongs on the list: drop WHEN and the ${secs(ALLOWED_MIN)} threshold disappears along with the ${ONTIME}-then-${W0_TRUE} sequence; drop HOW and the sink's value becomes undetermined among three.` },
];

// =================== CONCEPT 4 — THE PURCHASE COUNTER (systemDesign) ========
const C4 = [
  { t: 'the pipeline, and the one window it is specified for', draw: (c) =>
      c.panel('PURCHASE COUNTING — FOUR STAGES AND FOUR ANSWERS', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`writer (event source)`, `emits a purchase stamped with its event time`],
        [`transport (stream)`, `delays and reorders; also computes the watermark (max seen − ${secs(LAG)})`],
        [`collector (window assigner)`, `assigns by event time to fixed ${secs(WIN)} windows — WHERE`],
        [`aggregator/store (per-window state)`, `running sum per window, held for allowed lateness — WHAT + WHEN + HOW`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the four questions are answered across the last two stages' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Window [${mm(W0)}, ${mm(W0_END)}) is the one this design is specified for: ids ${W0_IDS.join(', ')}, true sum ${W0_TRUE}.`,
        `One of those, id ${L.id}, arrives at ${hhmmss(L.pt)} — ${secs(L.pt - L.et)} after it happened and after the window has already been published.`,
      ], c.C.blue, c.C.blueFill),
    cap: `A deliberately small design, so every number is checkable. The four questions are not spread across the pipeline evenly: WHERE is the collector's single rule, and WHAT, WHEN and HOW all live in the aggregator's state. That is also where every difficulty in this design is, which is why "where is the state?" is the useful first question about any streaming system.` },
  { t: 'the publish sequence, with real times', draw: (c) =>
      c.panel('WHAT A CONSUMER ACTUALLY RECEIVES, IN ORDER', 'a')
      + c.mapRows('sq', c.P.main.x + 24, c.P.main.y + 52, [
        [`${hhmmss(PT_FIRES[0].at)} — EARLY pane`, `${PT_FIRES[0].sum}  (ids ${PT_FIRES[0].ids.join(',') || 'none'} have arrived)`],
        [`${hhmmss(PT_FIRES[1].at)} — EARLY pane`, `${PT_FIRES[1].sum}  (ids ${PT_FIRES[1].ids.join(',')})`],
        [`${hhmmss(EVENTS[ONTIME_I].pt)} — ON-TIME pane`, `${ONTIME}  (watermark passed ${mm(W0_END)}; the pipeline's best claim)`],
        [`${hhmmss(L.pt)} — RETRACTION + LATE pane`, `${-ONTIME}, then ${W0_TRUE}  (id ${L.id} landed)`],
      ], { w: 1040, rh: 36, hot: 3, label: `one window, one result, ${3 + 2} published values` })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A sink that only adds ends at ${sinkSum([PT_FIRES[0].sum, PT_FIRES[1].sum - PT_FIRES[0].sum, ONTIME - PT_FIRES[1].sum, -ONTIME, W0_TRUE])} — correct — because every refinement carries its own undo.`,
        `The "answer" to this query was published ${4} times over ${secs(L.pt - PT_FIRES[0].at)}. That is not a malfunction; it is what answering a question about an unbounded stream looks like.`,
      ], c.C.good, c.C.goodFill),
    cap: `Read the column: ${PT_FIRES[0].sum}, ${PT_FIRES[1].sum}, ${ONTIME}, then ${-ONTIME} and ${W0_TRUE}. One query, one window, five published values across ${secs(L.pt - PT_FIRES[0].at)} — and every one of them was the right answer to "what do you know now?". A consumer that treats the first as final is the bug, not the pipeline.` },
  { t: 'the two settings that decide whether it is ever right', draw: (c) =>
      c.panel('THE TWO KNOBS, AND THEIR EXACT THRESHOLDS', 'a')
      + c.mapRows('kb', c.P.main.x + 24, c.P.main.y + 52, [
        [`allowed lateness < ${secs(ALLOWED_MIN)}`, `id ${L.id} discarded · final answer ${ONTIME} · ${Math.round(100 * (W0_TRUE - ONTIME) / W0_TRUE)}% low, permanently`],
        [`allowed lateness >= ${secs(ALLOWED_MIN)}`, `id ${L.id} accepted · final answer ${W0_TRUE} · state held longer`],
        [`accumulation = discarding, summing sink`, `${RIGHT} — correct, and the cheapest to transmit`],
        [`accumulation = accumulating, summing sink`, `${WRONG_SUM_ACC} — double counted by ${WRONG_SUM_ACC - RIGHT}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'two independent settings; one wrong value in either is enough' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Neither knob is about performance. Allowed lateness decides whether ${W0_TRUE} is reachable at all; accumulation decides whether the sink lands on ${RIGHT} or ${WRONG_SUM_ACC}.`,
        `And they are independent: correct lateness with a mismatched sink still gives ${WRONG_SUM_ACC}.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Two settings, and each has a threshold that is a number rather than a judgement. Allowed lateness must be at least ${secs(ALLOWED_MIN)} — set by the watermark's jump, not by id ${L.id}'s ${secs(L.pt - L.et)} of skew. And the accumulation mode must match what the sink does with a pane. Get either wrong and the pipeline is still "working".` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`Allowed lateness >= ${secs(ALLOWED_MIN)} keeps window state alive longer. With ${WIN_STARTS.length} windows that is cheap; with a million open windows it is the memory bill.`], c.C.warn, c.C.warnFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`Retractions require the sink to accept a negative. A counter in a key-value store usually can; an append-only billing ledger usually cannot.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`The ${secs(ALLOWED_MIN)} threshold was computed from watermarks we can see in full. A live pipeline sets that number before observing them.`], c.C.hot, c.C.hotFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`One window was specified. The window starting ${mm(WIN_STARTS[WIN_STARTS.length - 1])} never closes in this dataset, so it is never published at all — not early, not on-time, not late.`], c.C.blue, c.C.blueFill),
    cap: `The last gap is the sharpest: this chapter fully specified ONE window and the final window of the same dataset is never published by any of the three triggers, because the watermark never passes its end. A complete answer to all four questions still says nothing about a window whose "when" never arrives.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch02-whatwhere', steps: C1,
    title: 'What and Where — the transformation, and the slice it runs over',
    subtitle: `one sum, four windowings: global ${TOTAL} · fixed ${WIN_STARTS.length} windows · sliding totals ${SLIDE_TOTAL} · sessions a=${SESSIONS.a.length} b=${SESSIONS.b.length}`,
    heading: 'Why these are two questions and not one',
    why: [
      `**WHAT is the computation.** A sum, a count, a max, a filter, a join — in the Beam model, a transform in a directed graph. Hold the window fixed at [${mm(W0)}, ${mm(W0_END)}) and vary only the transform: \`sum(v)\` gives **${W0_TRUE}**, \`count\` gives **${W0_IDS.length}**, \`max(v)\` gives **${Math.max(...W0_IDS.map(i => EVENTS[i].v))}**, \`count distinct key\` gives **${new Set(W0_IDS.map(i => EVENTS[i].key)).size}**. Four answers, same ${W0_IDS.length} events, and the window was never mentioned.`, '',
      `**WHERE is the slice of event time** each value covers. Windowing cuts an unbounded stream into finite, event-time-aligned pieces. Hold the transform fixed at \`sum(v)\` and vary only the windowing:`, '',
      `- **global window** — one result: **${TOTAL}**.`,
      `- **fixed ${secs(WIN)} windows** — ${WIN_STARTS.length} results: ${WIN_STARTS.map(w => SUM(WINDOWS[w])).join(', ')}, totalling ${TOTAL}.`,
      `- **sliding, ${secs(WIN)} wide every ${secs(PERIOD)}** — ${SLIDE_STARTS.length} results, totalling **${SLIDE_TOTAL}**.`,
      `- **session windows, ${secs(GAP)} gap** — key \`a\` gets ${SESSIONS.a.length} sessions, key \`b\` gets ${SESSIONS.b.length}.`, '',
      `Read the sliding row twice. Its results sum to ${SLIDE_TOTAL} over a dataset containing ${TOTAL}, because each event falls into up to ${Math.max(...EVENTS.map(e => slidingStarts(e.et).length))} overlapping windows. Nothing was duplicated — **overlap is a property of the windowing**, and partitioning windowings (fixed, global) preserve the total while overlapping ones do not.`, '',
      `**And the two axes are genuinely independent.** Three transforms × three windowings is nine legal pipelines; picking a row constrains no column. So "we sum purchases" leaves the answer undetermined, and so does "we use session windows".`],
    whenHeading: 'When each windowing is the right one, and what batch was doing all along',
    when: [
      `**Global window** when the question has no time boundary — a lifetime total, a running all-time count. On unbounded input this means state that never retires, so it is rarer than it sounds.`, '',
      `**Fixed windows** when the question names a period: purchases per minute, errors per hour. They partition event time, so results sum to the total — which makes them the easy case to reconcile against a batch job.`, '',
      `**Sliding windows** when you want a smooth moving measure — "revenue over the last ${secs(WIN)}, refreshed every ${secs(PERIOD)}". Expect ~${Math.round(WIN / PERIOD)}× the output volume, and never compare their sum to the input total.`, '',
      `**Session windows** when the boundary is defined by the DATA, not the clock: a burst of activity separated from the next by a gap of ${secs(GAP)} or more. Note these are per key — \`a\` has ${SESSIONS.a.length} sessions while \`b\` has ${SESSIONS.b.length} over the same span, because sessions are a fact about each key's own activity.`, '',
      `**What this does not settle:** when any of these results is emitted. All the numbers above are what the windows eventually contain, and nothing here says when a consumer sees them — or that they might be published more than once. That is "when", and it is the next concept.`, '',
      `A MapReduce job answers both of these questions too: WHAT is the map and reduce, WHERE is the input file — one implicit window over everything. The streaming model does not add questions; it removes the defaults.`],
    diagramHeading: 'Visual walkthrough — vary one axis, then the other, then both',
    sub: `The sliding-window total ${SLIDE_TOTAL} and every per-window sum are computed from the seed and asserted against the fixed total ${TOTAL}.` },
  { name: 'ch02-when', steps: C2,
    title: 'When — triggers, watermarks, and allowed lateness',
    subtitle: `processing-time trigger emits ${PT_FIRES.slice(0, 3).map(f => f.sum).join(', ')} · watermark trigger emits ${ONTIME} · threshold for the fix: ${secs(ALLOWED_MIN)}`,
    heading: 'Why "when" is a processing-time decision about an event-time question',
    why: [
      `A window is useless until something decides to emit it. That decision is a **trigger**, and triggers come in kinds that differ in what they are reacting to.`, '',
      `**A processing-time trigger fires on the clock** — every ${secs(PERIOD)}, say. Following window [${mm(W0)}, ${mm(W0_END)})${''}, it emits ${PT_FIRES.slice(0, 4).map(f => f.sum).join(', then ')}: whatever had arrived. It first reaches the right answer, ${W0_TRUE}, at ${hhmmss(PT_FIRST_CORRECT.at)} — and it cannot tell that firing apart from the ones before it.`, '',
      `**A watermark is a completeness signal:** "no event with an event time earlier than *t* will arrive." That lets a trigger make a different kind of claim — fire when the watermark passes ${mm(W0_END)}, because the window is *done*. It fires exactly once, after event id ${EVENTS[ONTIME_I].id} at ${hhmmss(EVENTS[ONTIME_I].pt)}, emitting **${ONTIME}** from ids ${ONTIME_IDS.join(', ')}.`, '',
      `${ONTIME}, not ${W0_TRUE}: id ${L.id} has not arrived. **The claim of completeness and the error are the same event** — the watermark was the pipeline's best estimate and it was wrong.`, '',
      `**So a real pipeline wants three triggers on one window,** not a choice between them: **early** (speculative, before the watermark — ${PT_FIRES.slice(0, 3).map(f => f.sum).join(', ')}), **on-time** (at the watermark — ${ONTIME}), and **late** (once per straggler — ${W0_TRUE} at ${hhmmss(L.pt)}). They serve three different consumers and all three fire.`, '',
      `**Allowed lateness** bounds the waiting: it is how long window state is kept after the watermark passes, which is garbage collection for that state. And it has an exact threshold here. When id ${L.id} arrives, the watermark stands at ${hhmmss(WM_AT_LATE)} (${WM_AT_LATE}s); state survives while the watermark is below ${mm(W0_END)} + allowed, so **allowed lateness must be at least ${secs(ALLOWED_MIN)}** for the correction to land. At ${secs(ALLOWED_MIN - 1)} the state is already gone and ${ONTIME} stands forever.`, '',
      `Note that ${secs(ALLOWED_MIN)} is *not* id ${L.id}'s ${secs(L.pt - L.et)} of skew, which is the number a reader would guess. It comes from how far the watermark had advanced — it jumped from ${hhmmss(WATERMARKS[ONTIME_I - 1])} to ${hhmmss(WATERMARKS[ONTIME_I])} in a single event. **The knob is calibrated against the watermark, not against the data.**`],
    whenHeading: 'When to use each trigger, and what allowed lateness costs',
    when: [
      `**Use a processing-time trigger when a consumer needs a number on a schedule** and can tolerate it being provisional — a live dashboard, a progress bar. It never stalls, which is its real virtue: a watermark that stops advancing stops your output, and a clock does not.`, '',
      `**Use the watermark trigger when the result is meant to be an answer** rather than a status — a report, an hourly figure, anything someone will quote. It fires once per window with a meaningful claim attached.`, '',
      `**Use late triggers whenever correctness outranks simplicity,** and accept that your published numbers will move.`, '',
      `**Set allowed lateness from your skew tail, then price the memory.** It keeps window state alive, so the bill is (open windows × state per window). With ${WIN_STARTS.length} windows that is nothing; with a million open session windows it is the dominant cost of the pipeline.`, '',
      `**What this does not settle:** "when" produced ${PT_FIRES.slice(0, 3).length + 2} separate published values for ONE window, and nothing here says what a consumer should do with the second one. If a sink stored ${ONTIME} and then receives ${W0_TRUE}, does it add or replace? That question is "how", and until it is answered the pipeline's correctness is undefined — not merely unoptimised.`],
    diagramHeading: 'Visual walkthrough — a clock trigger, a watermark trigger, and one threshold',
    sub: `The trigger sequences and the ${secs(ALLOWED_MIN)} threshold are computed from the seed's watermarks and asserted.` },
  { name: 'ch02-how', steps: C3,
    title: 'How — accumulation, retraction, and the arithmetic of refinement',
    subtitle: `the same two panes give ${RIGHT}, ${WRONG_SUM_ACC} or ${WRONG_REPL_DISC}, depending only on the sink's assumption`,
    heading: 'Why a correct pipeline plus a correct sink can still be wrong',
    why: [
      `"When" allowed one window to fire twice. Window [${mm(W0)}, ${mm(W0_END)}) emitted **${ONTIME}** on time at ${hhmmss(EVENTS[ONTIME_I].pt)}, then id ${L.id} arrived at ${hhmmss(L.pt)} and the window held **${W0_TRUE}**. Both panes were correct when produced.`, '',
      `**Nothing in the numbers says what the second one means.** Is ${W0_TRUE} a replacement for ${ONTIME}, or something to add to it? "How" is the name of that agreement, and there are three standard answers:`, '',
      `- **Discarding** — each pane is only the NEW data: panes **${ACC.discarding.panes.join(', ')}**. The second pane is id ${L.id}'s ${L.v} alone. A sink must SUM.`,
      `- **Accumulating** — each pane is the window's total so far: panes **${ACC.accumulating.panes.join(', ')}**. A sink must REPLACE.`,
      `- **Accumulating and retracting** — the new total preceded by an undo of the old one: panes **${ACC.retracting.panes.join(', ')}**. A sink that can only add is still correct.`, '',
      `**Now the part that makes this a correctness question rather than a preference.** Pair each mode with each kind of sink:`, '',
      `- discarding (${ACC.discarding.panes.join(', ')}) into a summing sink → **${RIGHT}** ✓`,
      `- accumulating (${ACC.accumulating.panes.join(', ')}) into a replacing sink → **${RIGHT}** ✓`,
      `- retracting (${ACC.retracting.panes.join(', ')}) into a summing sink → **${RIGHT}** ✓`,
      `- accumulating into a **summing** sink → **${WRONG_SUM_ACC}**, double counted by ${WRONG_SUM_ACC - RIGHT}`,
      `- discarding into a **replacing** sink → **${WRONG_REPL_DISC}**, pane 1 thrown away`, '',
      `${RIGHT}, ${WRONG_SUM_ACC} or ${WRONG_REPL_DISC} — same window, same events, same two firings. **The pipeline is correct in all five rows**, and nothing in the data reveals a mismatch. That is why retractions exist: they make the pane stream correct for the sink that cannot be changed.`],
    whenHeading: 'When each mode is right, and why the four questions are a checklist',
    when: [
      `**Discarding when the sink aggregates and bandwidth matters.** It transmits ${LATE_DELTA} instead of ${W0_TRUE}, which on a wide window is the difference between a delta and a full re-send. Requires that nothing ever re-reads a pane.`, '',
      `**Accumulating when the sink is a keyed store you overwrite** — a cache, a dashboard row, \`SET key value\`. Simplest to reason about, and the mode most people assume is in use.`, '',
      `**Accumulating and retracting when the sink can only append** — a downstream aggregation, an event log, another streaming job. It is the only mode that is safe when you do not control the consumer, and the cost is that the operator must keep the previous pane's value in its keyed state in order to emit the undo.`, '',
      `**And this is why the four questions are a checklist rather than a summary.** Each one was shown to change an observable number: omit WHEN and the ${secs(ALLOWED_MIN)} lateness threshold and the ${ONTIME}-then-${W0_TRUE} sequence both vanish from the spec; omit HOW and the sink's final value is undetermined among ${RIGHT}, ${WRONG_SUM_ACC} and ${WRONG_REPL_DISC}.`, '',
      `**What this does not settle:** retraction assumes the sink accepts a negative value. A counter in a key-value store usually does; an append-only ledger that has already billed on ${ONTIME} usually does not, and no accumulation mode fixes that — it is a conversation about what the downstream system promised.`],
    diagramHeading: 'Visual walkthrough — two panes, three modes, five outcomes',
    sub: `All five mode-and-sink outcomes are computed from the seed and asserted: three reach ${RIGHT}, two do not.` },
  { name: 'ch02-system', steps: C4,
    title: 'System design — a purchase counter, fully specified',
    subtitle: `one window, ${4} published values: ${PT_FIRES[0].sum} → ${PT_FIRES[1].sum} → ${ONTIME} → (${-ONTIME}, ${W0_TRUE})`,
    heading: 'Why one result needs all four answers before it is defined',
    why: [
      `**The question.** Count purchases per window. A purchase arrives late, so the pipeline must close the window on the watermark and let allowed lateness correct the already-emitted count.`, '',
      `**The pipeline:** writer (event source) → transport (stream, which also computes the watermark) → collector (window assigner) → aggregator/store (per-window state).`, '',
      `Note where the four questions live: **WHERE** is the collector's single rule (assign by event time to fixed ${secs(WIN)} windows), and **WHAT, WHEN and HOW all live in the aggregator's state**. That is also where every difficulty is — which is why "where is the state?" is the first useful question about any streaming system.`, '',
      `**The window being specified** is [${mm(W0)}, ${mm(W0_END)}): ids ${W0_IDS.join(', ')}, true sum **${W0_TRUE}**. One of them, id ${L.id}, arrives at ${hhmmss(L.pt)} — ${secs(L.pt - L.et)} after it happened, and after the window has already been published.`, '',
      `**So here is what a consumer actually receives, in order:**`, '',
      `- ${hhmmss(PT_FIRES[0].at)} — early pane **${PT_FIRES[0].sum}** (ids ${PT_FIRES[0].ids.join(', ') || 'none'} had arrived)`,
      `- ${hhmmss(PT_FIRES[1].at)} — early pane **${PT_FIRES[1].sum}**`,
      `- ${hhmmss(EVENTS[ONTIME_I].pt)} — on-time pane **${ONTIME}**, the watermark having passed ${mm(W0_END)}`,
      `- ${hhmmss(L.pt)} — retraction **${-ONTIME}** then late pane **${W0_TRUE}**`, '',
      `Five values for one question, over ${secs(L.pt - PT_FIRES[0].at)}. Every one was the right answer to "what do you know now?", and a consumer that treats the first as final is the bug.`],
    whenHeading: 'When this design is right, the two thresholds, and four gaps',
    when: [
      `**Two settings decide whether it is ever correct, and both have numeric thresholds rather than judgement calls:**`, '',
      `**1. Allowed lateness ≥ ${secs(ALLOWED_MIN)}.** Below that, window state is already collected when id ${L.id} arrives: the event is discarded and ${ONTIME} stands forever, ${Math.round(100 * (W0_TRUE - ONTIME) / W0_TRUE)}% low. At or above it, the late trigger fires and corrects to ${W0_TRUE}. The threshold comes from the watermark's position (${WM_AT_LATE}s) when the straggler lands — **not** from its ${secs(L.pt - L.et)} of skew.`, '',
      `**2. The accumulation mode must match the sink.** Retracting into a summing sink gives ${RIGHT}; accumulating into the same sink gives ${WRONG_SUM_ACC}. These are independent of setting 1 — correct lateness with a mismatched sink still produces ${WRONG_SUM_ACC}.`, '',
      `**Use this design when the consumer can accept a moving number.** A dashboard, a cache, a downstream aggregation: all fine. An append-only ledger that bills on the first value published is not, and that is a contract problem rather than a configuration one.`, '',
      `**What this does NOT settle — four gaps:**`, '',
      `1. **Allowed lateness is memory.** Holding state past the watermark costs (open windows × state per window). With ${WIN_STARTS.length} windows it is free; with a million open windows it is the pipeline's dominant cost.`,
      `2. **Retractions require a sink that accepts negatives.** ${-ONTIME} has to be representable and meaningful downstream.`,
      `3. **The ${secs(ALLOWED_MIN)} threshold was computed from watermarks visible in full.** A live pipeline sets that number before observing them, and is therefore guessing.`,
      `4. **Only one window was specified.** The window starting ${mm(WIN_STARTS[WIN_STARTS.length - 1])} is never published by ANY of the three triggers, because the watermark never passes its end — a complete answer to all four questions still says nothing about a window whose "when" never arrives.`],
    diagramHeading: 'Visual walkthrough — four stages, five published values, two thresholds',
    sub: `The publish sequence, the ${secs(ALLOWED_MIN)} lateness threshold and the ${WRONG_SUM_ACC}-vs-${RIGHT} sink outcomes are all derived from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · window [${mm(W0)}, ${mm(W0_END)}) = ${W0_TRUE}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch02.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch02.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being summed  ·  key = which stream it belongs to',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the late one`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the fixed window width, in seconds of event time.  WIN = ${WIN}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: W0 — the window this chapter specifies.  W0 = ${W0}  ([${mm(W0)}, ${mm(W0_END)}))`,
  '// primitive: winOf(et) — the START of the WIN-second event-time window holding et.',
  `//   winOf(${L.et}) = ${winOf(L.et)}      winOf(${EVENTS[4].et}) = ${winOf(EVENTS[4].et)}`,
  '// primitive: sum(ids) — total v over those event ids.',
  `//   sum([${W0_IDS.join(', ')}]) = ${W0_TRUE}      sum([${ONTIME_IDS.join(', ')}]) = ${ONTIME}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
];
const PROGRAMS = [];

// ---- concept 1: WHAT and WHERE as two independent arguments -----------------
PROGRAMS.push({
  name: 'ch02-whatwhere-memory',
  title: 'What and Where as two arguments — one function, nine pipelines',
  subtitle: `global ${TOTAL} · fixed [${WIN_STARTS.map(w => SUM(WINDOWS[w])).join(', ')}] · sliding totals ${SLIDE_TOTAL}`,
  src: COMMON.concat([
    '',
    'type Result { byWindow }',
    '',
    `// primitive: PERIOD — how often a sliding window starts.  PERIOD = ${PERIOD}`,
    '// primitive: windowsOf(et, where) — EVERY window an event belongs to. Note the',
    '//   return is a LIST: overlapping windowings put one event in more than one.',
    `//   windowsOf(${EVENTS[0].et}, "global")  = [0]`,
    `//   windowsOf(${EVENTS[0].et}, "fixed")   = [${winOf(EVENTS[0].et)}]`,
    `//   windowsOf(${EVENTS[4].et}, "sliding") = [${slidingStarts(EVENTS[4].et).join(', ')}]`,
    '// primitive: apply(what, ids) — run the transform over those event ids.',
    `//   apply("sum", [${W0_IDS.join(', ')}]) = ${W0_TRUE}`,
    `//   apply("count", [${W0_IDS.join(', ')}]) = ${W0_IDS.length}`,
    `//   apply("distinctKey", [${W0_IDS.join(', ')}]) = ${new Set(W0_IDS.map(i => EVENTS[i].key)).size}`,
    '',
    '// function: assign(events, where) — group every event under its window(s).',
    '//   This answers WHERE and nothing else: no transform is named anywhere in it.',
    `//   assign(EVENTS, "fixed").byWindow[${W0}] = [${W0_IDS.join(', ')}]`,
    `//   assign(EVENTS, "sliding").byWindow[${SLIDE_STARTS[1]}] = [${SLIDE[SLIDE_STARTS[1]].join(', ')}]`,
    'fun assign(events, where) {',
    '    var out = {}',
    '    for (e in events) {',
    '        for (w in windowsOf(e.et, where)) {',
    '            out[w] = append(out[w], e.id)',
    '        }',
    '    }',
    '    return Result(out)',
    '}',
    '',
    '// function: compute(grouped, what) — run ONE transform over every group.',
    '//   This answers WHAT and nothing else: no window rule appears in it.',
    `//   compute(assign(EVENTS, "fixed"), "sum").byWindow = {${WIN_STARTS.map(w => `${w}: ${SUM(WINDOWS[w])}`).join(', ')}}`,
    'fun compute(grouped, what) {',
    '    var out = {}',
    '    for (w in grouped.byWindow) {',
    '        out[w] = apply(what, grouped.byWindow[w])',
    '    }',
    '    return Result(out)',
    '}',
    '',
    '// function: totalOf(r) — add up every window\'s result.',
    `//   totalOf(fixedSums) = ${TOTAL}      totalOf(slidingSums) = ${SLIDE_TOTAL}`,
    'fun totalOf(r) {',
    '    var t = 0',
    '    for (w in r.byWindow) { t = t + r.byWindow[w] }',
    '    return t',
    '}',
    '',
    '// function: main() — THE CALLER: two axes, chosen separately.',
    'fun main() {',
    '    val fixedSums   = compute(assign(EVENTS, "fixed"), "sum")',
    '    val slidingSums = compute(assign(EVENTS, "sliding"), "sum")',
    '    val fixedCounts = compute(assign(EVENTS, "fixed"), "count")',
    '    val tFixed   = totalOf(fixedSums)',
    '    val tSliding = totalOf(slidingSums)',
    '}',
  ]),
  heap: {
    fixedSums:   { addr: '0x100', type: 'Result', val: () => WIN_STARTS.map(w => `${w}:${SUM(WINDOWS[w])}`).join(' ') },
    slidingSums: { addr: '0x200', type: 'Result', val: () => SLIDE_STARTS.map(w => `${w}:${SUM(SLIDE[w])}`).join(' ') },
    fixedCounts: { addr: '0x300', type: 'Result', val: () => WIN_STARTS.map(w => `${w}:${WINDOWS[w].length}`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `fixedSums = ${o.fixedSums || '...'}`, `slidingSums = ${o.slidingSums || '...'}`,
      `fixedCounts = ${o.fixedCounts || '...'}`, `tFixed = ${o.tFixed !== undefined ? o.tFixed : '...'}`,
      `tSliding = ${o.tSliding !== undefined ? o.tSliding : '...'}`] });
    return [
      { t: 'WHERE: an event can belong to MORE THAN ONE window', line: at('fun assign(events, where)', 'fun assign(events, where)::for (w in windowsOf(e.et, where)) {'),
        stack: [MAIN({ fixedSums: '@0x100' }), { name: 'assign', locals: ['events = EVENTS', 'where = "sliding"', 'out = @0x200', `e = EVENTS[4]`, `w = ${slidingStarts(EVENTS[4].et)[1]}`] }],
        heap: [{ key: 'fixedSums' }, { key: 'slidingSums', hot: true }],
        cap: `\`windowsOf(${EVENTS[4].et}, "sliding")\` returns [${slidingStarts(EVENTS[4].et).join(', ')}] — ${slidingStarts(EVENTS[4].et).length} windows for ONE event, so the inner loop runs ${slidingStarts(EVENTS[4].et).length} times and id 4's ${EVENTS[4].v} is appended twice. This is the loop that makes the sliding total exceed the data.` },
      { t: 'WHAT: the transform never sees the window rule', line: at('fun compute(grouped, what)', 'out[w] = apply(what, grouped.byWindow[w])'),
        stack: [MAIN({ fixedSums: '@0x100', slidingSums: '@0x200', fixedCounts: '@0x300' }), { name: 'compute', locals: ['grouped = @0x100', 'what = "count"', 'out = @0x300', `w = ${W0}`] }],
        heap: [{ key: 'fixedSums' }, { key: 'fixedCounts', hot: true }],
        cap: `\`compute\` receives an already-grouped Result and a transform name. It has no idea whether those groups came from fixed, sliding or session windows — \`apply("count", [${W0_IDS.join(', ')}])\` = ${W0_IDS.length} would be identical either way. That is what "independent axes" means mechanically.` },
      { t: 'so the sliding total exceeds the data, by construction', line: at('fun totalOf(r)', 't = t + r.byWindow[w]'),
        stack: [MAIN({ fixedSums: '@0x100', slidingSums: '@0x200', fixedCounts: '@0x300', tFixed: TOTAL }), { name: 'totalOf', locals: ['r = @0x200', `t = ${SLIDE_TOTAL}`, `w = ${SLIDE_STARTS[SLIDE_STARTS.length - 1]}`] }],
        heap: [{ key: 'fixedSums' }, { key: 'slidingSums', hot: true }],
        cap: `\`tFixed\` is ${TOTAL} — the dataset's total, because fixed windows partition event time. \`tSliding\` reaches ${SLIDE_TOTAL}, and the extra ${SLIDE_TOTAL - TOTAL} is not an error: step 1's inner loop appended most ids twice. Comparing a sliding total to an input total is the mistake, not the number.` },
      { t: 'and nine combinations, all legal', line: at('    val fixedCounts = compute(assign(EVENTS, "fixed"), "count")'),
        stack: [MAIN({ fixedSums: '@0x100', slidingSums: '@0x200', fixedCounts: '@0x300', tFixed: TOTAL, tSliding: SLIDE_TOTAL })],
        heap: [{ key: 'fixedSums' }, { key: 'slidingSums' }, { key: 'fixedCounts' }],
        cap: `Three calls, three Results, and the two arguments were chosen independently every time. \`fixedSums\` and \`fixedCounts\` share a windowing and differ in transform; \`fixedSums\` and \`slidingSums\` share a transform and differ in windowing. Nothing in the code couples them, which is the chapter's claim stated as a call signature.` },
    ];
  },
  intro: [
    `**What is being answered.** Why "what" and "where" are two questions — as a function that takes them as two arguments.`, '',
    `\`assign(events, where)\` answers WHERE and names no transform. \`compute(grouped, what)\` answers WHAT and contains no window rule. Every pipeline in this concept is one call to each, and swapping either argument leaves the other untouched.`, '',
    `Watch the inner loop in step 1: \`windowsOf\` returns a **list**, so one event can be appended to several windows. That single fact is why \`tSliding\` reaches ${SLIDE_TOTAL} against a dataset of ${TOTAL} — the overlap is in the windowing, not in the data.`],
  sub: `The sliding total and every per-window value are computed from the seed and asserted against the fixed total.` });

// ---- concept 2: triggers, the watermark, and allowed lateness ---------------
PROGRAMS.push({
  name: 'ch02-when-memory',
  title: 'When — three triggers on one window, and the lateness threshold',
  subtitle: `on-time ${ONTIME} at ${hhmmss(EVENTS[ONTIME_I].pt)} · late ${W0_TRUE} at ${hhmmss(L.pt)} · needs allowed >= ${ALLOWED_MIN}s`,
  src: COMMON.concat([
    '',
    'type Pane  { at, value, kind }',
    'type State { ids, panes, open }',
    '',
    `// primitive: PERIOD — the early trigger's firing interval.  PERIOD = ${PERIOD}`,
    `// primitive: ALLOWED — allowed lateness, in seconds of event time.  ALLOWED = ${ALLOWED_MIN}`,
    '// primitive: watermarkAfter(i) — the completeness claim after event i: the',
    '//   highest event time seen through i, minus LAG.',
    `//   watermarkAfter(${ONTIME_I - 1}) = ${WATERMARKS[ONTIME_I - 1]}      watermarkAfter(${ONTIME_I}) = ${WATERMARKS[ONTIME_I]}      watermarkAfter(${LI}) = ${WATERMARKS[LI]}`,
    '',
    '// function: onTimeDue(i) — has the watermark passed the window end yet?',
    `//   onTimeDue(${ONTIME_I - 1}) = false   (watermark ${WATERMARKS[ONTIME_I - 1]} < ${W0_END})`,
    `//   onTimeDue(${ONTIME_I}) = true    (watermark ${WATERMARKS[ONTIME_I]} >= ${W0_END})`,
    'fun onTimeDue(i) {',
    '    return watermarkAfter(i) >= W0 + WIN',
    '}',
    '',
    '// function: stillOpen(i) — is the window\'s STATE still held? This is the only',
    '//   thing that decides whether a straggler can change the answer.',
    `//   stillOpen(${LI}) with ALLOWED = ${ALLOWED_MIN} is true`,
    `//   stillOpen(${LI}) with ALLOWED = ${ALLOWED_MIN - 1} is false   (${WATERMARKS[LI]} >= ${W0_END} + ${ALLOWED_MIN - 1})`,
    'fun stillOpen(i) {',
    '    return watermarkAfter(i) < W0 + WIN + ALLOWED',
    '}',
    '',
    '// function: feed(st, e, i) — one arriving event, through all three triggers.',
    `//   feed(st, EVENTS[${ONTIME_I}], ${ONTIME_I}) appends an ON-TIME pane of ${ONTIME}`,
    `//   feed(st, EVENTS[${L.id}], ${LI}) appends a LATE pane of ${W0_TRUE}`,
    'fun feed(st, e, i) {',
    '    if (winOf(e.et) != W0) { return st }',
    '    if (st.open == false)  { return st }                       // dropped: too late',
    '    st.ids = append(st.ids, e.id)',
    '    if (e.pt % PERIOD == 0)        { st.panes = append(st.panes, Pane(e.pt, sum(st.ids), "EARLY")) }',
    '    if (onTimeDue(i))              { st.panes = append(st.panes, Pane(e.pt, sum(st.ids), "ON-TIME")) }',
    '    if (onTimeDue(i - 1))          { st.panes = append(st.panes, Pane(e.pt, sum(st.ids), "LATE")) }',
    '    st.open = stillOpen(i)',
    '    return st',
    '}',
    '',
    '// function: main() — THE CALLER: replay the stream into one window\'s state.',
    'fun main() {',
    '    var st = State([], [], true)',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        st = feed(st, EVENTS[i], i)',
    '    }',
    '    val final = sum(st.ids)',
    '    val fired = len(st.panes)',
    '}',
  ]),
  heap: {
    st:    { addr: '0x100', type: 'State', val: () => `ids [${W0_IDS.join(',')}] · open ${ALLOWED_MIN > WATERMARKS[LI] - W0_END ? 'true' : 'false'}` },
    panes: { addr: '0x200', type: 'Pane[]', val: () => `ON-TIME ${ONTIME} @${hhmmss(EVENTS[ONTIME_I].pt)} · LATE ${W0_TRUE} @${hhmmss(L.pt)}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: ['st = @0x100',
      `i = ${o.i !== undefined ? o.i : '...'}`, `final = ${o.final !== undefined ? o.final : '...'}`,
      `fired = ${o.fired !== undefined ? o.fired : '...'}`] });
    return [
      { t: `the watermark has not passed ${mm(W0_END)}, so nothing fires`, line: at('fun onTimeDue(i)', 'return watermarkAfter(i) >= W0 + WIN'),
        stack: [MAIN({ i: ONTIME_I - 1 }), { name: 'feed', locals: ['st = @0x100', `e = EVENTS[${EVENTS[ONTIME_I - 1].id}]`, `i = ${ONTIME_I - 1}`] },
                { name: 'onTimeDue', locals: [`i = ${ONTIME_I - 1}`] }],
        heap: [{ key: 'st', hot: true }],
        cap: `\`watermarkAfter(${ONTIME_I - 1})\` is ${WATERMARKS[ONTIME_I - 1]}, and \`W0 + WIN\` is ${W0_END}, so ${WATERMARKS[ONTIME_I - 1]} >= ${W0_END} is false and the window holds. Its state already contains ids ${EVENTS.filter((e, i) => i <= ONTIME_I - 1 && winOf(e.et) === W0).map(e => e.id).join(', ')} — the answer exists, it is just not claimed yet.` },
      { t: 'it passes, and the ON-TIME pane is published', line: at('if (onTimeDue(i))              { st.panes = append(st.panes, Pane(e.pt, sum(st.ids), "ON-TIME")) }'),
        stack: [MAIN({ i: ONTIME_I }), { name: 'feed', locals: ['st = @0x100', `e = EVENTS[${EVENTS[ONTIME_I].id}]`, `i = ${ONTIME_I}`] }],
        heap: [{ key: 'st' }, { key: 'panes', hot: true }],
        cap: `\`watermarkAfter(${ONTIME_I})\` jumped to ${WATERMARKS[ONTIME_I]}, so the trigger fires and publishes \`sum([${ONTIME_IDS.join(', ')}])\` = **${ONTIME}**. The window's true total is ${W0_TRUE}. The pane and the error are produced by the same line, because the watermark's claim was wrong.` },
      { t: `id ${L.id} arrives — and \`open\` is what decides its fate`, line: at('fun stillOpen(i)', 'return watermarkAfter(i) < W0 + WIN + ALLOWED'),
        stack: [MAIN({ i: LI }), { name: 'feed', locals: ['st = @0x100', `e = EVENTS[${L.id}]`, `i = ${LI}`] },
                { name: 'stillOpen', locals: [`i = ${LI}`] }],
        heap: [{ key: 'st' }, { key: 'panes' }],
        cap: `\`watermarkAfter(${LI})\` is ${WATERMARKS[LI]} and the bound is ${W0_END} + ALLOWED. With ALLOWED = ${ALLOWED_MIN} that is ${W0_END + ALLOWED_MIN}, so ${WATERMARKS[LI]} < ${W0_END + ALLOWED_MIN} holds and the state survives. With ALLOWED = ${ALLOWED_MIN - 1} the bound is ${W0_END + ALLOWED_MIN - 1} and the comparison fails — one second of configuration decides between ${W0_TRUE} and ${ONTIME}.` },
      { t: 'so one window published twice, and the second one is right', line: at('    val fired = len(st.panes)'),
        stack: [MAIN({ i: EVENTS.length - 1, final: W0_TRUE, fired: 2 })],
        heap: [{ key: 'st' }, { key: 'panes' }],
        cap: `\`final\` is ${W0_TRUE} and \`fired\` is 2: an ON-TIME pane of ${ONTIME} and a LATE pane of ${W0_TRUE}. The window produced two published values for one question, which is correct behaviour — and it is exactly the situation the next concept, "how", exists to make safe for a consumer.` },
    ];
  },
  intro: [
    `**What is being answered.** What a trigger actually is, and where allowed lateness takes effect — as one \`feed\` function replayed over the stream.`, '',
    `Three predicates do all the work. \`onTimeDue(i)\` asks whether the watermark has passed the window end. \`stillOpen(i)\` asks whether the window's STATE is still held — and that is the only thing that decides whether a straggler can change an answer.`, '',
    `Step 3 is the one to read closely: the comparison is \`watermarkAfter(${LI}) < ${W0_END} + ALLOWED\`, which is ${WATERMARKS[LI]} < ${W0_END + ALLOWED_MIN}. One second lower and it fails. The threshold is ${ALLOWED_MIN}s because of where the **watermark** stood — not because of id ${L.id}'s ${L.pt - L.et}s of skew.`],
  sub: `The trigger firings and the ${ALLOWED_MIN}s threshold are computed from the seed's watermarks and asserted.` });

// ---- concept 3: accumulation, and the sink that disagrees -------------------
PROGRAMS.push({
  name: 'ch02-how-memory',
  title: 'How — the same two panes into three sinks, and three answers',
  subtitle: `correct ${RIGHT} · summing an accumulating stream ${WRONG_SUM_ACC} · replacing a discarding one ${WRONG_REPL_DISC}`,
  src: COMMON.concat([
    '',
    'type Panes { mode, values }',
    '',
    `// primitive: ONTIME — what the window held when the watermark passed.  ONTIME = ${ONTIME}`,
    `// primitive: TRUE_SUM — what the window holds once id ${L.id} lands.  TRUE_SUM = ${W0_TRUE}`,
    `// primitive: DELTA — the late event's own value.  DELTA = TRUE_SUM - ONTIME = ${LATE_DELTA}`,
    '',
    '// function: panesFor(mode) — what the pipeline PUBLISHES for those two firings.',
    `//   panesFor("discarding")   = [${ACC.discarding.panes.join(', ')}]`,
    `//   panesFor("accumulating") = [${ACC.accumulating.panes.join(', ')}]`,
    `//   panesFor("retracting")   = [${ACC.retracting.panes.join(', ')}]`,
    'fun panesFor(mode) {',
    '    if (mode == "discarding")   { return Panes(mode, [ONTIME, DELTA]) }',
    '    if (mode == "accumulating") { return Panes(mode, [ONTIME, TRUE_SUM]) }',
    '    return Panes(mode, [ONTIME, 0 - ONTIME, TRUE_SUM])',
    '}',
    '',
    '// function: sinkSum(p) — a sink that can only ADD what it receives.',
    `//   sinkSum(panesFor("discarding")) = ${sinkSum(ACC.discarding.panes)}`,
    `//   sinkSum(panesFor("accumulating")) = ${WRONG_SUM_ACC}`,
    `//   sinkSum(panesFor("retracting")) = ${sinkSum(ACC.retracting.panes)}`,
    'fun sinkSum(p) {',
    '    var acc = 0',
    '    for (x in p.values) { acc = acc + x }',
    '    return acc',
    '}',
    '',
    '// function: sinkReplace(p) — a sink that OVERWRITES on each pane.',
    `//   sinkReplace(panesFor("accumulating")) = ${sinkReplace(ACC.accumulating.panes)}`,
    `//   sinkReplace(panesFor("discarding")) = ${WRONG_REPL_DISC}`,
    'fun sinkReplace(p) {',
    '    var cur = 0',
    '    for (x in p.values) { cur = x }',
    '    return cur',
    '}',
    '',
    '// function: main() — THE CALLER: every mode against every sink.',
    'fun main() {',
    '    val okDisc   = sinkSum(panesFor("discarding"))',
    '    val okAcc    = sinkReplace(panesFor("accumulating"))',
    '    val okRetr   = sinkSum(panesFor("retracting"))',
    '    val badSum   = sinkSum(panesFor("accumulating"))',
    '    val badRepl  = sinkReplace(panesFor("discarding"))',
    '}',
  ]),
  heap: {
    disc: { addr: '0x100', type: 'Panes', val: () => `discarding [${ACC.discarding.panes.join(', ')}]` },
    acc:  { addr: '0x200', type: 'Panes', val: () => `accumulating [${ACC.accumulating.panes.join(', ')}]` },
    retr: { addr: '0x300', type: 'Panes', val: () => `retracting [${ACC.retracting.panes.join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `okDisc = ${o.okDisc !== undefined ? o.okDisc : '...'}`, `okAcc = ${o.okAcc !== undefined ? o.okAcc : '...'}`,
      `okRetr = ${o.okRetr !== undefined ? o.okRetr : '...'}`, `badSum = ${o.badSum !== undefined ? o.badSum : '...'}`,
      `badRepl = ${o.badRepl !== undefined ? o.badRepl : '...'}`] });
    return [
      { t: 'discarding publishes the DELTA, not the total', line: at('fun panesFor(mode)', 'if (mode == "discarding")   { return Panes(mode, [ONTIME, DELTA]) }'),
        stack: [MAIN(), { name: 'panesFor', locals: ['mode = "discarding"'] }],
        heap: [{ key: 'disc', hot: true }],
        cap: `The second pane is DELTA = ${LATE_DELTA}, which is id ${L.id}'s own \`v\` — not the window's ${W0_TRUE}. Cheapest to transmit, and it only means anything to a sink that adds. Read that pane in isolation and it looks like a window containing ${LATE_DELTA}.` },
      { t: 'a summing sink reaches the right answer from those panes', line: at('fun sinkSum(p)', 'for (x in p.values) { acc = acc + x }'),
        stack: [MAIN({ okDisc: RIGHT }), { name: 'sinkSum', locals: ['p = @0x100', `acc = ${RIGHT}`, `x = ${LATE_DELTA}`] }],
        heap: [{ key: 'disc', hot: true }],
        cap: `\`acc\` goes 0 → ${ONTIME} → ${RIGHT}. Correct — because the sink's behaviour matches the mode. Nothing in \`sinkSum\` knows which mode produced its input, which is precisely why the agreement has to be made outside the code.` },
      { t: 'the SAME sink, given accumulating panes, double counts', line: at('    val badSum   = sinkSum(panesFor("accumulating"))'),
        stack: [MAIN({ okDisc: RIGHT, okAcc: RIGHT, okRetr: RIGHT, badSum: WRONG_SUM_ACC }), { name: 'sinkSum', locals: ['p = @0x200', `acc = ${WRONG_SUM_ACC}`, `x = ${W0_TRUE}`] }],
        heap: [{ key: 'disc' }, { key: 'acc', hot: true }],
        cap: `${ONTIME} + ${W0_TRUE} = **${WRONG_SUM_ACC}** — ${Math.round(100 * (WRONG_SUM_ACC - RIGHT) / RIGHT)}% high, because pane 2 already contained pane 1. The pipeline was right, the sink was right, and the result is wrong by ${WRONG_SUM_ACC - RIGHT}. No error is raised anywhere.` },
      { t: 'which is why retraction exists: an undo makes adding safe', line: at('    return Panes(mode, [ONTIME, 0 - ONTIME, TRUE_SUM])'),
        stack: [MAIN({ okDisc: RIGHT, okAcc: RIGHT, okRetr: RIGHT, badSum: WRONG_SUM_ACC, badRepl: WRONG_REPL_DISC }), { name: 'panesFor', locals: ['mode = "retracting"'] }],
        heap: [{ key: 'disc' }, { key: 'acc' }, { key: 'retr', hot: true }],
        cap: `Retracting emits ${ACC.retracting.panes.join(', ')} — the undo \`0 - ONTIME\` = ${-ONTIME} cancels what the sink already stored, then ${W0_TRUE} replaces it. \`sinkSum\` reaches ${RIGHT} without being changed. Compare \`badRepl\` = ${WRONG_REPL_DISC}: a replacing sink fed discarding panes keeps only ${LATE_DELTA}, losing ${RIGHT - WRONG_REPL_DISC}.` },
    ];
  },
  intro: [
    `**What is being answered.** Why accumulation mode is a correctness setting — as three pane streams and two sinks, all five pairings computed.`, '',
    `\`panesFor(mode)\` is the pipeline: it decides what gets published for the window's two firings. \`sinkSum\` and \`sinkReplace\` are the two things a consumer can do with a pane. Neither sink can see which mode produced its input.`, '',
    `That is the whole lesson. Three pairings reach ${RIGHT}; \`badSum\` reaches **${WRONG_SUM_ACC}** and \`badRepl\` reaches **${WRONG_REPL_DISC}**. Every function in the listing is correct in all five cases, and the only thing that varied was an agreement nobody wrote down.`],
  sub: `All five mode-and-sink outcomes are computed from the seed and asserted: three equal ${RIGHT}, two do not.` });

// ---- concept 4: the fully specified purchase counter -----------------------
PROGRAMS.push({
  name: 'ch02-system-memory',
  title: 'The purchase counter — all four answers, as one loop',
  subtitle: `${PT_FIRES[0].sum} → ${PT_FIRES[1].sum} → ${ONTIME} → (${-ONTIME}, ${W0_TRUE}) · sink lands on ${RIGHT}`,
  src: COMMON.concat([
    '',
    'type Spec  { what, where, whenEarly, allowed, how }',
    'type Dash  { stored, received }',
    '',
    `// primitive: SPEC — the four answers, as data rather than as prose.`,
    `//   SPEC = ("sum", "fixed ${WIN}s", every ${PERIOD}s, allowed ${ALLOWED_MIN}s, "retracting")`,
    `// primitive: ONTIME — the on-time pane's value.  ONTIME = ${ONTIME}`,
    `// primitive: TRUE_SUM — the window's true total.  TRUE_SUM = ${W0_TRUE}`,
    '// primitive: watermarkAfter(i) — the completeness claim after event i.',
    `//   watermarkAfter(${ONTIME_I}) = ${WATERMARKS[ONTIME_I]}      watermarkAfter(${LI}) = ${WATERMARKS[LI]}`,
    '',
    '// function: publish(dash, value) — one pane reaching the consumer. The sink can',
    '//   only ADD, which is the common case and the reason SPEC.how is "retracting".',
    `//   publish(dash, ${ONTIME}) sets stored : 0 -> ${ONTIME}`,
    `//   publish(dash, ${-ONTIME}) sets stored : ${ONTIME} -> 0`,
    'fun publish(dash, value) {',
    '    dash.stored   = dash.stored + value',
    '    dash.received = dash.received + 1',
    '    return dash',
    '}',
    '',
    '// function: refine(dash, oldValue, newValue) — emit a correction under SPEC.how.',
    `//   refine(dash, ${ONTIME}, ${W0_TRUE}) publishes ${-ONTIME} then ${W0_TRUE}, leaving stored = ${W0_TRUE}`,
    'fun refine(dash, oldValue, newValue) {',
    '    if (SPEC.how == "retracting") { dash = publish(dash, 0 - oldValue) }',
    '    if (SPEC.how == "discarding") { return publish(dash, newValue - oldValue) }',
    '    return publish(dash, newValue)',
    '}',
    '',
    '// function: run(events) — the whole pipeline, for window W0.',
    `//   run(EVENTS).stored = ${W0_TRUE}      run(EVENTS).received = 4`,
    'fun run(events) {',
    '    var dash = Dash(0, 0)',
    '    var ids  = []',
    '    var last = NONE',
    '    for (i in 0 .. len(events) - 1) {',
    '        val e = events[i]',
    '        if (winOf(e.et) != W0) { continue }',
    '        if (watermarkAfter(i) >= W0 + WIN + SPEC.allowed) { continue }   // state gone',
    '        ids = append(ids, e.id)',
    '        if (last == NONE) { dash = publish(dash, sum(ids)) }',
    '        if (last != NONE) { dash = refine(dash, last, sum(ids)) }',
    '        last = sum(ids)',
    '    }',
    '    return dash',
    '}',
    '',
    '// function: main() — THE CALLER.',
    'fun main() {',
    '    val dash  = run(EVENTS)',
    '    val final = dash.stored',
    '    val count = dash.received',
    '}',
  ]),
  heap: {
    dash: { addr: '0x100', type: 'Dash', val: () => `stored ${W0_TRUE} · received 4` },
    ids:  { addr: '0x200', type: `int[${W0_IDS.length}]`, val: () => `[${W0_IDS.join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `dash = ${o.dash || '...'}`, `final = ${o.final !== undefined ? o.final : '...'}`,
      `count = ${o.count !== undefined ? o.count : '...'}`] });
    const RUN = (o) => ({ name: 'run', locals: ['events = EVENTS', 'dash = @0x100', 'ids = @0x200',
      `last = ${o.last}`, `i = ${o.i}`, `e = EVENTS[${o.eid}]`] });
    return [
      { t: 'WHERE: anything outside this window is skipped', line: at('fun run(events)', 'if (winOf(e.et) != W0) { continue }'),
        stack: [MAIN(), RUN({ last: 'NONE', i: 3, eid: 3 })],
        heap: [{ key: 'dash' }, { key: 'ids', hot: true }],
        cap: `\`winOf(${EVENTS[3].et})\` = ${winOf(EVENTS[3].et)}, which is not W0 = ${W0}, so event id 3 is skipped entirely. That one line is the whole of the collector's job — the WHERE answer — and it reads \`e.et\`, never the arrival time.` },
      { t: 'WHEN: the allowed-lateness check is what can drop an event', line: at('if (watermarkAfter(i) >= W0 + WIN + SPEC.allowed) { continue }   // state gone'),
        stack: [MAIN(), RUN({ last: ONTIME, i: LI, eid: L.id })],
        heap: [{ key: 'dash' }, { key: 'ids' }],
        cap: `For id ${L.id} this is ${WATERMARKS[LI]} >= ${W0_END} + ${ALLOWED_MIN}, i.e. ${WATERMARKS[LI]} >= ${W0_END + ALLOWED_MIN} — false, so the event is kept. Lower \`SPEC.allowed\` by one second and this \`continue\` fires: the event vanishes and the answer stays ${ONTIME} forever. One line, one config value, two different final numbers.` },
      { t: 'HOW: the refinement emits an undo before the new total', line: at('fun refine(dash, oldValue, newValue)', 'if (SPEC.how == "retracting") { dash = publish(dash, 0 - oldValue) }', '    dash.stored   = dash.stored + value'),
        stack: [MAIN(), RUN({ last: ONTIME, i: LI, eid: L.id }), { name: 'refine', locals: ['dash = @0x100', `oldValue = ${ONTIME}`, `newValue = ${W0_TRUE}`] },
                { name: 'publish', locals: ['dash = @0x100', `value = ${-ONTIME}`] }],
        heap: [{ key: 'dash', hot: true }, { key: 'ids' }],
        cap: `\`publish(dash, ${-ONTIME})\` takes \`stored\` from ${ONTIME} back to 0, then the fall-through publishes ${W0_TRUE}. The sink only ever adds, and still ends up correct. Change \`SPEC.how\` to \`"accumulating"\` and the retraction line is skipped — \`stored\` becomes ${WRONG_SUM_ACC}.` },
      { t: 'WHAT: and the consumer ends on the right number', line: at('    val count = dash.received'),
        stack: [MAIN({ dash: '@0x100', final: W0_TRUE, count: 4 })],
        heap: [{ key: 'dash' }, { key: 'ids' }],
        cap: `\`final\` = ${W0_TRUE} after \`count\` = 4 published values. All four answers were needed to get here: WHERE picked the ${W0_IDS.length} events, WHAT summed them, WHEN decided that ${ONTIME} goes out first and that id ${L.id} is still admissible, and HOW made the correction safe for a sink that can only add.` },
    ];
  },
  intro: [
    `**What is being answered.** The four questions as four lines of one loop, with the real published values.`, '',
    `\`SPEC\` holds the four answers as data: \`"sum"\`, \`"fixed ${WIN}s"\`, early every ${PERIOD}s with allowed lateness ${ALLOWED_MIN}s, and \`"retracting"\`. Each step below highlights the line that implements one of them.`, '',
    `Two lines are worth reading twice. The \`continue\` in step 2 is where allowed lateness takes effect — one second lower and id ${L.id} disappears. The retraction in step 3 is what keeps a sink that can only ADD on the right answer; skip it and \`stored\` ends at ${WRONG_SUM_ACC} instead of ${W0_TRUE}.`],
  sub: `The publish sequence, the lateness comparison and both sink outcomes are derived from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch02.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch02.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
