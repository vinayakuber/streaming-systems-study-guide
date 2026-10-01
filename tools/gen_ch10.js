#!/usr/bin/env node
'use strict';
/* gen_ch10.js — ch10's four concepts, both bands each: MapReduce to streaming,
 * Lambda and Kappa, the convergence, and the system that survives a bug fix.
 * Every figure derives from tools/stream_seed.js and is asserted. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, WINDOWS, WIN_STARTS, winOf, closedAt, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const mm = (sec) => hhmmss(sec).slice(0, 5);
const secs = (n) => `${n}s`;
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
// the batch answer, and the streaming answer, under the SAME windowing
const bucket = (clock) => { const m = {}; for (const e of EVENTS) { const k = Math.floor(e[clock] / WIN) * WIN; (m[k] = m[k] || []).push(e.id); } return m; };
const BY_ET = bucket('et'), BY_PT = bucket('pt');
const ET_KEYS = Object.keys(BY_ET).map(Number).sort((a, b) => a - b);
// BOUNDED vs STREAMING: identical grouping, different finality
const batchFinalAt = EVENTS.length;                       // end of input closes everything
const FINALITY = ET_KEYS.map(k => ({ k, batch: batchFinalAt, stream: closedAt(k) }));
const NEVER_FINAL = FINALITY.filter(f => f.stream === null);
// LAMBDA: two layers, written separately. The likely divergence is the clock, because
// the speed layer is the one tempted to bucket on arrival.
const LAMBDA_DIFFER = ET_KEYS.filter(k => SUM(BY_ET[k]) !== SUM(BY_PT[k] || []));
const LAMBDA_DRIFT = LAMBDA_DIFFER.reduce((n, k) => n + Math.abs(SUM(BY_ET[k]) - SUM(BY_PT[k] || [])), 0);
// KAPPA: one pipeline, replayed. A bug that halves one key's values, then the fix.
const BUG_KEY = KEYS[0];
const buggy = (e) => e.key === BUG_KEY ? Math.floor(e.v / 2) : e.v;
const BUGGY_TOTAL = EVENTS.reduce((s, e) => s + buggy(e), 0);
const BUGGY_PER_KEY = Object.fromEntries(KEYS.map(k => [k, EVENTS.filter(e => e.key === k).reduce((s, e) => s + buggy(e), 0)]));
const TRUE_PER_KEY = Object.fromEntries(KEYS.map(k => [k, EVENTS.filter(e => e.key === k).reduce((s, e) => s + e.v, 0)]));
const REPLAY_READS = EVENTS.length;
// Lambda would need the fix applied twice; Kappa once. Count the places.
const LAMBDA_FIXES = 2, KAPPA_FIXES = 1;
const fail = (m) => { throw new Error(`gen_ch10: ${m}`); };
if (!LAMBDA_DIFFER.length) fail('the two clocks agree everywhere, so Lambda has no plausible divergence to show');
if (BUGGY_TOTAL >= TOTAL) fail(`the bug does not reduce the total (${BUGGY_TOTAL} vs ${TOTAL})`);
if (BUGGY_PER_KEY[KEYS[1]] !== TRUE_PER_KEY[KEYS[1]]) fail('the bug touches both keys; it should affect exactly one');
if (!NEVER_FINAL.length) fail('every window is eventually final in streaming, so the remaining distinction vanishes');
if (NEVER_FINAL.length === ET_KEYS.length) fail('no window is ever final in streaming; the contrast needs both cases');
if (LAMBDA_FIXES <= KAPPA_FIXES) fail('Lambda does not require more fix sites than Kappa');

const W = 1140;

// ============== CONCEPT 1 — FROM MAPREDUCE TO STREAMING =====================
const C1 = [
  { t: 'MapReduce made batch tractable, and assumed an ending', draw: (c) =>
      c.panel('A BATCH JOB OVER THIS DATASET', 'a')
      + c.mapRows('mr', c.P.main.x + 24, c.P.main.y + 52, [
        [`what it reads`, `all ${EVENTS.length} events, to the end of the input`],
        [`what it computes`, `${ET_KEYS.length} windows: ${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')} · total ${TOTAL}`],
        [`when each result is final`, `at end of input — event ${batchFinalAt} — all of them at once`],
        [`what it never needed`, `a watermark, a trigger, or an accumulation mode`],
      ], { w: 1040, rh: 36, hot: 2, label: 'correct, scalable, fault-tolerant — and it requires the input to stop' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Three of the Beam model's four questions are answered by accident here: WHERE is the input file, WHEN is end of input, HOW has no panes to relate.`,
        `Remove the ending and all three defaults stop existing at once. That is the whole difficulty, and it is not about latency.`,
      ], c.C.good, c.C.goodFill),
    cap: `Start from what batch actually gives you: ${ET_KEYS.length} window results, all final at event ${batchFinalAt}, with no watermark and no triggers needed. It is not that batch lacks these mechanisms — it is that the end of the input answers three of the four questions for free. Take the ending away and all three answers disappear together.` },
  { t: 'early streaming got latency and lost correctness', draw: (c) =>
      c.panel('A PROCESSING-TIME PIPELINE, WHICH IS WHAT EARLY SYSTEMS OFFERED', 'a')
      + c.mapRows('es', c.P.main.x + 24, c.P.main.y + 52, ET_KEYS.map(k =>
          [`window [${mm(k)}, ${mm(k + WIN)})`, `batch (event time): ${SUM(BY_ET[k])} · arrival-time pipeline: ${SUM(BY_PT[k] || [])}`]),
        { w: 1040, rh: 32, hot: ET_KEYS.indexOf(LAMBDA_DIFFER[0]), label: 'low latency, no event time, no watermarks' })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 66 + ET_KEYS.length * 32, 1040, [
        `${LAMBDA_DIFFER.length} of the ${ET_KEYS.length} windows differ, by ${LAMBDA_DRIFT} in total. The pipeline is fast and answering a different question.`,
        `So the early trade was not "streaming is approximate" — it was "streaming had no way to express event time", which is a missing feature, not a law.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Worth being precise about what early streaming systems lacked. They were not approximate by nature; they had no vocabulary for event time, so they bucketed by arrival. That is ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows wrong here, by ${LAMBDA_DRIFT} in total — a missing feature rather than an inherent limit, which is why the model could fix it.` },
  { t: 'the four questions unified them', draw: (c) =>
      c.panel('THE SAME FOUR QUESTIONS, BOTH MODES', 'a')
      + c.mapRows('u4', c.P.main.x + 24, c.P.main.y + 52, [
        [`WHAT`, `batch: the map/reduce · streaming: the aggregation — the SAME`],
        [`WHERE`, `batch: the input file (one implicit window) · streaming: ${ET_KEYS.length} explicit windows`],
        [`WHEN`, `batch: end of input · streaming: when the watermark passes`],
        [`HOW`, `batch: one pane, nothing to relate · streaming: accumulating or retracting`],
      ], { w: 1040, rh: 36, hot: 2, label: 'batch answers all four; it just answers three of them implicitly' })
      + c.note('u1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Read the WHAT row: it is identical. The computation was never the difference between batch and streaming.`,
        `The other three rows are all about TIME — which slice, which moment, and how successive answers relate. Those are the questions an ending used to answer for you.`,
      ], c.C.good, c.C.goodFill),
    cap: `The unification is visible in the first row: WHAT is the same in both modes, and always was. The remaining three rows are all about time, and in batch all three are answered by the input ending. So the model does not add machinery to batch — it names the three answers batch was getting for free, so that a pipeline without an ending can supply them explicitly.` },
  { t: 'so one pipeline can run in both modes', draw: (c) =>
      c.panel('THE SAME PIPELINE, BOUNDED AND UNBOUNDED INPUT', 'p')
      + c.mapRows('bm', c.P.main.x + 24, c.P.main.y + 52, [
        [`grouping, bounded input`, `${ET_KEYS.length} windows: ${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')}`],
        [`grouping, unbounded input`, `${ET_KEYS.length} windows: ${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')} — identical`],
        [`what differs`, `only WHEN each result is final`],
        [`concretely`, `batch: all ${ET_KEYS.length} final at event ${batchFinalAt} · streaming: ${NEVER_FINAL.length} never final`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the computation is the same; the finality is not' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Identical groupings, identical values. The only difference is the last row — and it is a real one, not a formality.`,
        `Window [${mm(NEVER_FINAL[0].k)}, ${mm(NEVER_FINAL[0].k + WIN)}) holds ${SUM(BY_ET[NEVER_FINAL[0].k])} and is final in batch, never final in streaming.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The payoff is concrete: the same pipeline code produces the same ${ET_KEYS.length} windows with the same values in both modes, so backfill and live serving are one codebase. And the honest caveat is in the last row — window [${mm(NEVER_FINAL[0].k)}, ${mm(NEVER_FINAL[0].k + WIN)})'s ${SUM(BY_ET[NEVER_FINAL[0].k])} is final under batch and never final under streaming.` },
];

// ===================== CONCEPT 2 — LAMBDA AND KAPPA =========================
const C2 = [
  { t: 'Lambda: two layers computing the same logic', draw: (c) =>
      c.panel('THE BATCH LAYER AND THE SPEED LAYER', 'a')
      + c.mapRows('la', c.P.main.x + 24, c.P.main.y + 52, [
        [`batch layer`, `re-reads all ${EVENTS.length} events · correct · high latency`],
        [`speed layer`, `incremental over arrivals · low latency · approximate`],
        [`the serving layer`, `merges the two, preferring the batch answer once it lands`],
        [`the same aggregation`, `written TWICE, in two systems, by hand`],
      ], { w: 1040, rh: 36, hot: 3, label: 'two implementations of one specification' })
      + c.note('l1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `There is nothing wrong with the architecture's shape — it genuinely delivers both low latency and eventual correctness.`,
        `The cost is the last row: one specification, two implementations, kept in agreement by discipline rather than by construction.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Lambda's shape is sound: a batch layer for correctness, a speed layer for latency, a serving layer that prefers the batch answer when it arrives. It does deliver both properties. The entire criticism is the last row — the aggregation exists twice, and nothing mechanical keeps the two copies equivalent.` },
  { t: 'and the two codebases drift, in a predictable direction', draw: (c) => {
      let s = c.panel('THE LIKELY DIVERGENCE: THE SPEED LAYER BUCKETS ON ARRIVAL', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'the batch layer has the whole input, so event time is natural; the speed layer sees arrivals', { size: 11, weight: 700, fill: c.C.line });
      ET_KEYS.forEach((k, i) => {
        const y = c.P.main.y + 66 + i * 34, bad = LAMBDA_DIFFER.includes(k);
        s += c.cv.rect('ld' + i, c.P.main.x + 24, y, 1040, 30, { fill: bad ? c.C.hotFill : c.C.paper, stroke: bad ? c.C.hot : c.C.faint, rx: 3, sw: bad ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `window [${mm(k)}, ${mm(k + WIN)})`, { size: 11, weight: 700, band: 'ldk' + i });
        s += c.cv.text(c.P.main.x + 260, y + 20, `batch layer: ${SUM(BY_ET[k])}`, { size: 11, band: 'ldb' + i });
        s += c.cv.text(c.P.main.x + 520, y + 20, `speed layer: ${SUM(BY_PT[k] || [])}`, { size: 11, fill: bad ? c.C.hot : c.C.ink, band: 'lds' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 20, bad ? `off by ${Math.abs(SUM(BY_ET[k]) - SUM(BY_PT[k] || []))}` : 'agrees', { size: 10, anchor: 'end', weight: 700, fill: bad ? c.C.hot : c.C.good, band: 'ldf' + i });
      });
      return s + c.note('d1', c.P.main.x + 24, c.P.main.y + 80 + ET_KEYS.length * 34, 1040, [
        `${LAMBDA_DIFFER.length} of the ${ET_KEYS.length} windows disagree, by ${LAMBDA_DRIFT} in total — and both layers are internally consistent and bug-free.`,
        `The divergence is not carelessness. The batch layer has the whole input so event time is the obvious choice; the speed layer sees arrivals and arrival time is the obvious choice.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `The drift has a direction, which is why it is predictable rather than merely possible. Each layer reaches for the clock its own context makes obvious — the whole input suggests event time, a stream of arrivals suggests arrival time — and the result is ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows disagreeing by ${LAMBDA_DRIFT}, with no bug in either implementation.` },
  { t: 'Kappa: one pipeline, and replay instead of a second layer', draw: (c) =>
      c.panel('THE SAME CORRECTION, UNDER BOTH ARCHITECTURES', 'a')
      + c.mapRows('kp', c.P.main.x + 24, c.P.main.y + 52, [
        [`the bug`, `key "${BUG_KEY}" halved · its total reads ${BUGGY_PER_KEY[BUG_KEY]} instead of ${TRUE_PER_KEY[BUG_KEY]}`],
        [`under Lambda`, `fix it in ${LAMBDA_FIXES} places — batch and speed — and verify both`],
        [`under Kappa`, `fix it in ${KAPPA_FIXES} place, then replay ${REPLAY_READS} events`],
        [`after the replay`, `key "${BUG_KEY}" reads ${TRUE_PER_KEY[BUG_KEY]} · total ${TOTAL}`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the same outcome, one codebase instead of two' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Kappa does not make the fix cheaper to write — it makes it impossible to apply inconsistently, because there is only one place to apply it.`,
        `The replay cost is ${REPLAY_READS} event reads here, and in general the whole retained history. That is what you are buying the single codebase with.`,
      ], c.C.good, c.C.goodFill),
    cap: `The comparison that matters is not latency, it is the number of places a fix must land: ${LAMBDA_FIXES} under Lambda, ${KAPPA_FIXES} under Kappa. Kappa does not make the fix easier to write; it removes the possibility of applying it to one layer and not the other. The price is replaying ${REPLAY_READS} events — in general, the whole history.` },
  { t: 'so Kappa\'s requirement is a retained, replayable log', draw: (c) =>
      c.panel('WHAT KAPPA ASSUMES', 'p')
      + c.mapRows('kr', c.P.main.x + 24, c.P.main.y + 52, [
        [`a replayable log`, `the ${EVENTS.length} events can be re-read from an offset`],
        [`retained long enough`, `to cover the history the new code must reprocess`],
        [`and a deterministic pipeline`, `so the replay produces ${TOTAL}, not merely something plausible`],
        [`if retention is shorter than history`, `the replay is partial, and Kappa silently stops working`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one architecture, three assumptions' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The last row is the assumption that quietly expires. Set a 7-day retention and "we can always replay" acquires a 7-day horizon, with nothing in the running system to announce it.`,
        `Determinism matters too: a pipeline that reads the wall clock or a mutable lookup table does not reproduce ${TOTAL} on replay, however faithful the log is.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Kappa's three assumptions are worth stating separately because they fail separately. The log must be replayable, retained for longer than the history you need, and processed deterministically. The retention one expires silently — "we can always replay" holds exactly as long as the retention window — and determinism is lost the moment a pipeline consults the wall clock.` },
];

// ================== CONCEPT 3 — BATCH AND STREAMING CONVERGE ================
const C3 = [
  { t: 'batch is streaming over a bounded input', draw: (c) =>
      c.panel('THE SAME MACHINERY, WITH AND WITHOUT AN ENDING', 'a')
      + c.mapRows('bs', c.P.main.x + 24, c.P.main.y + 52, [
        [`windows`, `${ET_KEYS.length} either way: ${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')}`],
        [`watermarks`, `bounded: jumps to "everything" at EOF · unbounded: advances with the data`],
        [`triggers`, `bounded: fire once, at EOF · unbounded: early, on-time, late`],
        [`accumulation`, `bounded: one pane, nothing to relate · unbounded: it matters`],
      ], { w: 1040, rh: 36, hot: 1, label: 'all four mechanisms are present in batch; three of them are trivial there' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Batch does not lack watermarks — it has the easiest possible one, which reaches infinity when the file ends and closes every window at once.`,
        `Seeing it that way is what makes one codebase possible: you are not adding streaming machinery to a batch job, you are removing a special case.`,
      ], c.C.good, c.C.goodFill),
    cap: `The reframing is the content of the claim. Batch has a watermark — the simplest one, which jumps to infinity at end of input — and a trigger, which fires once. Three of the four mechanisms are trivial rather than absent, and recognising that is what lets one pipeline serve both modes instead of two pipelines serving one each.` },
  { t: 'so one codebase, and Lambda\'s duplication disappears', draw: (c) =>
      c.panel('THE FIX, APPLIED ONCE', 'a')
      + c.mapRows('oc', c.P.main.x + 24, c.P.main.y + 52, [
        [`the wrong result`, `key "${BUG_KEY}" = ${BUGGY_PER_KEY[BUG_KEY]}, total ${BUGGY_TOTAL}`],
        [`the fix`, `${KAPPA_FIXES} edit, in ${KAPPA_FIXES} pipeline`],
        [`the replay`, `${REPLAY_READS} events through the corrected code`],
        [`the corrected result`, `key "${BUG_KEY}" = ${TRUE_PER_KEY[BUG_KEY]}, total ${TOTAL} — and key "${KEYS[1]}" unchanged at ${TRUE_PER_KEY[KEYS[1]]}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the whole correction, with no second implementation to keep in step' })
      + c.note('o1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Key "${KEYS[1]}" reading ${TRUE_PER_KEY[KEYS[1]]} before and after is the check that the replay was faithful rather than merely different.`,
        `Under Lambda the same fix lands in ${LAMBDA_FIXES} places and the two results have to be reconciled — which is where a second, subtler divergence usually enters.`,
      ], c.C.good, c.C.goodFill),
    cap: `The unaffected key is the useful detail: "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} before and after the replay, which is how you know the replay reproduced history rather than recomputing it differently. Under Lambda there is no such single check, because the two layers' outputs have to be reconciled before anything can be verified.` },
  { t: 'reprocessing becomes a first-class operation', draw: (c) =>
      c.panel('THE LOG IS THE TRUTH; THE PIPELINE IS DISPOSABLE', 'a')
      + c.mapRows('rp', c.P.main.x + 24, c.P.main.y + 52, [
        [`changing business logic`, `deploy the new pipeline, replay ${REPLAY_READS} events`],
        [`fixing a bug`, `the same operation — nothing special about a correction`],
        [`adding a new output`, `also the same operation, over the same log`],
        [`so the pipeline is`, `disposable; the log is what must not be lost`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one mechanism serves logic changes, bug fixes and new consumers' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `This is ch06's duality as an operational practice: the state is a function of the log, so it can be discarded and rebuilt rather than migrated.`,
        `Which inverts the usual anxiety — the risky asset is not the pipeline you are about to replace, it is the log you are assuming is still complete.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Three different kinds of change collapse into one operation, which is what "first-class" means here: a bug fix, a logic change and a new consumer are all "replay the log through new code". The consequence worth internalising is the inversion in the note — the pipeline becomes the cheap, replaceable part, and the log becomes the thing you cannot afford to lose.` },
  { t: 'and what stays distinct: streams do not end', draw: (c) =>
      c.panel('WHAT THE MODEL DOES NOT UNIFY', 'p')
      + c.mapRows('wd', c.P.main.x + 24, c.P.main.y + 52, FINALITY.map(f =>
          [`window [${mm(f.k)}, ${mm(f.k + WIN)})`, f.stream === null
            ? `batch: final at event ${f.batch} · streaming: NEVER final`
            : `batch: final at event ${f.batch} · streaming: final after event ${f.stream}`]),
        { w: 1040, rh: 32, hot: FINALITY.findIndex(f => f.stream === null), label: 'identical values, and one column where they differ' })
      + c.note('w1', c.P.main.x + 24, c.P.main.y + 66 + FINALITY.length * 32, 1040, [
        `${NEVER_FINAL.length} of the ${ET_KEYS.length} windows is final in batch and never final in streaming — holding ${SUM(BY_ET[NEVER_FINAL[0].k])}, with every one of its events already received.`,
        `The model unifies the HOW. It does not make an unbounded input end, and that is not a gap in the model — it is the thing the model is about.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The honest limit of the convergence, with a number on it: window [${mm(NEVER_FINAL[0].k)}, ${mm(NEVER_FINAL[0].k + WIN)}) holds ${SUM(BY_ET[NEVER_FINAL[0].k])}, has received all of its events, and is final under batch while never final under streaming. The model unifies the computation and the vocabulary; it does not give an unbounded stream an ending.` },
];

// ========= CONCEPT 4 — A SYSTEM THAT SURVIVES A BUG FIX (systemDesign) ======
const C4 = [
  { t: 'the pipeline, and the one asset that cannot be lost', draw: (c) =>
      c.panel('A SYSTEM THAT SURVIVES A BUG FIX', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`log (replayable)`, `${EVENTS.length} events, retained and re-readable from an offset`],
        [`one streaming pipeline`, `serves the live result AND the replay — ${KAPPA_FIXES} codebase`],
        [`speed result`, `what consumers read now`],
        [`replay path → same pipeline`, `the corrected result, from the same code`],
      ], { w: 1040, rh: 36, hot: 0, label: 'four boxes, and only the first is irreplaceable' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The pipeline appears twice and is the same code both times. That is the design: there is no second implementation to keep in agreement.`,
        `And the log is the only box that cannot be rebuilt from another box — which makes its retention policy the system's real correctness boundary.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Four boxes, and the asymmetry is the design. The pipeline appears on both paths and is the same code, so there is nothing to keep in sync; every derived result can be thrown away and rebuilt. The log cannot, which means its retention setting — usually chosen for cost — is where this system's correctness actually ends.` },
  { t: 'the bug, the fix, and the replay — with real values', draw: (c) =>
      c.panel(`A BUG THAT HALVES KEY "${BUG_KEY}"`, 'a')
      + c.mapRows('bf', c.P.main.x + 24, c.P.main.y + 52, [
        [`what the wrong pipeline produced`, KEYS.map(k => `"${k}" = ${BUGGY_PER_KEY[k]}`).join(' · ') + ` · total ${BUGGY_TOTAL}`],
        [`what is true`, KEYS.map(k => `"${k}" = ${TRUE_PER_KEY[k]}`).join(' · ') + ` · total ${TOTAL}`],
        [`the deploy`, `${KAPPA_FIXES} edit, then replay ${REPLAY_READS} events from the log`],
        [`after the replay`, KEYS.map(k => `"${k}" = ${TRUE_PER_KEY[k]}`).join(' · ') + ` — and "${KEYS[1]}" never moved`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the whole incident response, in four lines' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Key "${KEYS[1]}" reading ${TRUE_PER_KEY[KEYS[1]]} before and after is the verification that the replay reproduced history rather than recomputing it differently.`,
        `Without an unaffected key to check against, "the numbers changed" and "the numbers are now right" are indistinguishable.`,
      ], c.C.good, c.C.goodFill),
    cap: `The incident response is four lines, and the fourth contains the verification. Key "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} both before and after, so the replay demonstrably reproduced history for the parts it should not have changed. A replay with no invariant to check is just a second computation, and you would have no way to prefer it.` },
  { t: 'what this buys over Lambda, counted', draw: (c) =>
      c.panel('THE SAME INCIDENT, TWO ARCHITECTURES', 'a')
      + c.mapRows('vs', c.P.main.x + 24, c.P.main.y + 52, [
        [`places the fix must land`, `Lambda: ${LAMBDA_FIXES} · this design: ${KAPPA_FIXES}`],
        [`implementations to verify`, `Lambda: ${LAMBDA_FIXES} · this design: ${KAPPA_FIXES}`],
        [`plausible pre-existing drift`, `Lambda: ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows, by ${LAMBDA_DRIFT} · this design: none possible`],
        [`what it costs instead`, `replaying ${REPLAY_READS} events, and retaining them to do so`],
      ], { w: 1040, rh: 36, hot: 2, label: 'fewer places to be wrong, in exchange for retention and replay cost' })
      + c.note('v1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The third row is the one that is structural rather than a matter of effort: with one implementation, layer-to-layer divergence is not a bug you can have.`,
        `The trade is honest — you pay in storage and replay time for a class of inconsistency that cannot occur.`,
      ], c.C.good, c.C.goodFill),
    cap: `The argument is about which errors are possible, not which are likely. With ${KAPPA_FIXES} implementation, the ${LAMBDA_DIFFER.length}-window ${LAMBDA_DRIFT}-unit divergence from the previous concept is not a bug you can have — it has nowhere to live. You pay for that with retention and replay time, which is a cost you can budget rather than a failure you have to detect.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`Replay works only as far back as RETENTION. Set it to 7 days and "we can always reprocess" quietly becomes "we can reprocess 7 days", with nothing in the running system to say so.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The pipeline must be DETERMINISTIC. One that reads the wall clock, a random seed or a mutable lookup table does not reproduce ${TOTAL} on replay, however complete the log is.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Replaying ${REPLAY_READS} events is free here; replaying a year of production traffic competes with serving it. Nothing in this design isolates the two.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And ${NEVER_FINAL.length} of the ${ET_KEYS.length} windows is never final in streaming, so "replay and you have the right answer" is true of the closed windows and not of that one.`], c.C.blue, c.C.blueFill),
    cap: `The first two gaps are the ones that invalidate the architecture rather than merely limiting it. Kappa's whole premise is that the log plus the code reproduces the result — which fails silently if retention is shorter than the history you need, and fails invisibly if the pipeline consults anything outside the log. Both are worth asserting in a test rather than assuming.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch10-history', steps: C1,
    title: 'From MapReduce to streaming — what an ending was answering',
    subtitle: `batch: ${ET_KEYS.length} windows all final at event ${batchFinalAt} · arrival-time pipeline: ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} wrong by ${LAMBDA_DRIFT}`,
    heading: 'Why the end of the input was answering three of the four questions',
    why: [
      `**MapReduce made batch tractable, and it assumed an ending.** Over this dataset a batch job reads all ${EVENTS.length} events, computes ${ET_KEYS.length} windows (${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')}, total ${TOTAL}), and every result is final at event ${batchFinalAt} — all at once. It needs no watermark, no trigger and no accumulation mode.`, '',
      `Not because it lacks them, but because **the ending answers three of the four questions for free**: WHERE is the input file (one implicit window), WHEN is end of input, HOW has no panes to relate. Remove the ending and all three defaults stop existing simultaneously. That is the difficulty, and it has nothing to do with latency.`, '',
      `**Early streaming systems got latency and lost correctness** — and it is worth being precise about why. They had no vocabulary for event time, so they bucketed by arrival. On this data that is **${LAMBDA_DIFFER.length} of the ${ET_KEYS.length} windows wrong, by ${LAMBDA_DRIFT} in total**: window [${mm(LAMBDA_DIFFER[0])}, ${mm(LAMBDA_DIFFER[0] + WIN)}) reads ${SUM(BY_ET[LAMBDA_DIFFER[0]])} by event time and ${SUM(BY_PT[LAMBDA_DIFFER[0]] || [])} by arrival. A missing feature, not an inherent limit — which is why a model could fix it.`, '',
      `**The four questions unified them.** Read the WHAT row: batch's map/reduce and streaming's aggregation are the **same**. The computation was never the difference. The other three questions are all about time — which slice, which moment, how successive answers relate — and those are exactly the three an ending used to answer.`, '',
      `**So one pipeline can run in both modes.** The grouping is identical: ${ET_KEYS.length} windows with values ${ET_KEYS.map(k => SUM(BY_ET[k])).join(', ')}, bounded or unbounded. The only difference is **when each result is final** — batch closes all ${ET_KEYS.length} at event ${batchFinalAt}, while in streaming ${NEVER_FINAL.length} is never final at all.`],
    whenHeading: 'When the unification pays, and what it does not remove',
    when: [
      `**It pays whenever the same logic serves history and live traffic** — a backfill, a re-derivation after a schema change, a new consumer over old data. One codebase, with the mode chosen by whether the input ends.`, '',
      `**Reach for a bounded run when the input genuinely ends,** and take the free answers. A nightly job over yesterday needs no watermark reasoning, and introducing one buys nothing.`, '',
      `**Do not read "batch is a special case" as "batch is obsolete".** The special case is the easy one: three of the four questions are answered for you and every window is final at once, which is why a bounded run is the right tool whenever the input allows it.`, '',
      `**What this does not settle:** what to do when you need both low latency AND correctness over an unbounded input. Historically the answer was to build two systems, which is the next concept — and the cost of that answer turns out to be measurable on this dataset.`],
    diagramHeading: 'Visual walkthrough — the free answers, the lost clock, the unification',
    sub: `The batch result, the arrival-time divergence and the finality comparison are computed from the seed and asserted.` },
  { name: 'ch10-lambda', steps: C2,
    title: 'Lambda and Kappa — two implementations, or one plus replay',
    subtitle: `Lambda's plausible drift: ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows, ${LAMBDA_DRIFT} units · the same fix lands in ${LAMBDA_FIXES} places vs ${KAPPA_FIXES}`,
    heading: 'Why Lambda\'s cost is a second implementation, and Kappa\'s is retention',
    why: [
      `**Lambda runs two layers computing the same logic:** a batch layer that re-reads all ${EVENTS.length} events (correct, slow), a speed layer that works incrementally over arrivals (fast, approximate), and a serving layer that merges them and prefers the batch answer once it lands.`, '',
      `The shape is sound — it genuinely delivers both low latency and eventual correctness. The cost is that **the same aggregation is written twice, in two systems, kept in agreement by discipline rather than by construction.**`, '',
      `**And the drift has a predictable direction**, which is what makes it more than a theoretical risk. The batch layer has the whole input, so event time is the obvious choice; the speed layer sees arrivals, so arrival time is the obvious choice. Follow that through and **${LAMBDA_DIFFER.length} of the ${ET_KEYS.length} windows disagree, by ${LAMBDA_DRIFT} in total** — with both layers internally consistent and neither containing a bug.`, '',
      `**Kappa replaces the second layer with replay.** Take a concrete bug: key "${BUG_KEY}" is halved, so it reads ${BUGGY_PER_KEY[BUG_KEY]} instead of ${TRUE_PER_KEY[BUG_KEY]} and the total reads ${BUGGY_TOTAL} instead of ${TOTAL}. Under Lambda the fix must land in **${LAMBDA_FIXES} places** and both must be verified. Under Kappa it lands in **${KAPPA_FIXES}**, and replaying ${REPLAY_READS} events restores ${TRUE_PER_KEY[BUG_KEY]} and ${TOTAL}.`, '',
      `Kappa does not make the fix cheaper to *write*. It makes it **impossible to apply inconsistently**, because there is only one place to apply it.`, '',
      `**What Kappa assumes, in exchange:** a replayable log, retained for longer than the history the new code must reprocess, and a deterministic pipeline so that the replay produces ${TOTAL} rather than merely something plausible.`],
    whenHeading: 'When to pick each, and which assumption expires quietly',
    when: [
      `**Pick Kappa when the input is already a retained log** — which, if you are running Kafka or an equivalent, you have. Then the second layer is pure cost and the single codebase is free.`, '',
      `**Pick Lambda when the batch system already exists and works** and the streaming layer is genuinely a different kind of computation — an approximation, a sketch, something you would not want to be the system of record. Then the duplication is deliberate rather than accidental.`, '',
      `**Never pick Lambda and then try to keep the layers equivalent by review.** The divergence above needs no mistake: each layer's context suggests a different clock, and the result is ${LAMBDA_DIFFER.length} wrong windows that both teams can defend.`, '',
      `**Assert determinism in a test.** A pipeline that reads the wall clock, a random seed or a mutable lookup table does not reproduce ${TOTAL} on replay, and nothing about the log will tell you — it is the pipeline that has stopped being a function of its input.`, '',
      `**What this does not settle — and it expires silently:** replay works only as far back as retention. Set 7 days and "we can always reprocess" becomes "we can reprocess 7 days", with nothing in the running system announcing the change.`],
    diagramHeading: 'Visual walkthrough — two layers, their drift, and one fix site',
    sub: `The layer divergence, the bug's effect and both fix-site counts are computed from the seed and asserted.` },
  { name: 'ch10-converge', steps: C3,
    title: 'Batch and streaming converge — and the one thing that does not',
    subtitle: `identical ${ET_KEYS.length} windows · fix once, replay ${REPLAY_READS} · ${NEVER_FINAL.length} window never final in streaming`,
    heading: 'Why batch already has all four mechanisms, and what reprocessing becomes',
    why: [
      `**Batch is streaming over a bounded input,** and the reframing is the whole claim. Batch does not *lack* watermarks — it has the easiest possible one, which reaches infinity at end of input and closes every window at once. It has a trigger too: fire once, at EOF. Three of the four mechanisms are **trivial** in batch rather than absent.`, '',
      `Seeing it that way is what makes one codebase possible: you are not adding streaming machinery to a batch job, you are removing a special case.`, '',
      `**So Lambda's duplication disappears.** The concrete correction: key "${BUG_KEY}" reads ${BUGGY_PER_KEY[BUG_KEY]} (total ${BUGGY_TOTAL}); one edit in one pipeline; replay ${REPLAY_READS} events; key "${BUG_KEY}" reads ${TRUE_PER_KEY[BUG_KEY]} and the total reads ${TOTAL}.`, '',
      `And note the verification: **key "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} before and after.** That unaffected key is how you know the replay *reproduced* history rather than recomputing it differently — without an invariant to check, "the numbers changed" and "the numbers are now right" are indistinguishable.`, '',
      `**Reprocessing becomes a first-class operation.** Changing business logic, fixing a bug and adding a new output are all the same operation: deploy new code, replay the log. This is ch06's duality as an operational practice — the state is a function of the log, so it can be discarded and rebuilt rather than migrated.`, '',
      `Which inverts the usual anxiety: the risky asset is not the pipeline you are replacing, it is **the log you are assuming is still complete.**`, '',
      `**And what stays distinct: streams do not end.** Window [${mm(NEVER_FINAL[0].k)}, ${mm(NEVER_FINAL[0].k + WIN)}) holds ${SUM(BY_ET[NEVER_FINAL[0].k])}, has received every one of its events, and is final under batch while **never final** under streaming. The model unifies the *how*; it does not give an unbounded input an ending — and that is not a gap in the model, it is the thing the model is about.`],
    whenHeading: 'When to replay, what to check, and what remains a batch-only property',
    when: [
      `**Replay for any logic change, not just for incidents.** If reprocessing is a routine operation rather than an emergency, the pipeline becomes genuinely disposable, and that is where the architecture's value is realised.`, '',
      `**Always replay with an invariant.** Pick something the change must not affect — key "${KEYS[1]}" at ${TRUE_PER_KEY[KEYS[1]]} here — and check it. A replay that changes everything is indistinguishable from a replay that is wrong in a new way.`, '',
      `**Treat the log's retention as the system's correctness boundary**, not as a storage setting. Every claim about re-derivation has that horizon.`, '',
      `**And do not promise finality on an unbounded input.** ${NEVER_FINAL.length} of the ${ET_KEYS.length} windows here is never final in streaming, so "replay and you have the right answer" is true of the closed windows and not of that one. If a consumer needs a final figure, it needs a bounded run or an explicit cut-off — which is a product decision, not a configuration.`],
    diagramHeading: 'Visual walkthrough — the trivial mechanisms, the single fix, the limit',
    sub: `The identical groupings, the replay result and the never-final window are computed from the seed and asserted.` },
  { name: 'ch10-system', steps: C4,
    title: 'System design — a system that survives a bug fix',
    subtitle: `${KAPPA_FIXES} fix site vs ${LAMBDA_FIXES} · key "${KEYS[1]}" holds ${TRUE_PER_KEY[KEYS[1]]} across the replay, which is the proof`,
    heading: 'Why only one box in this design cannot be rebuilt',
    why: [
      `**The question.** Design a data-processing system that survives a bug fix: every input is kept in a replayable log, so the corrected pipeline is deployed once and the whole history is replayed through the same code to replace the wrong result.`, '',
      `**The pipeline:** log (replayable) → one streaming pipeline → speed result; and replay path → **the same pipeline** → corrected result.`, '',
      `The pipeline appears twice and is the same code both times. That is the design: **there is no second implementation to keep in agreement.** And the log is the only box that cannot be rebuilt from another box, which makes its retention policy the system's real correctness boundary.`, '',
      `**The incident, with values.** A bug halves key "${BUG_KEY}": the pipeline produces ${KEYS.map(k => `"${k}" = ${BUGGY_PER_KEY[k]}`).join(', ')}, total ${BUGGY_TOTAL}, where the truth is ${KEYS.map(k => `"${k}" = ${TRUE_PER_KEY[k]}`).join(', ')}, total ${TOTAL}. One edit, replay ${REPLAY_READS} events, and the corrected result lands.`, '',
      `**The verification is the part worth copying:** key "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} before *and* after. An unaffected invariant is what distinguishes "the replay reproduced history" from "the replay computed something else".`, '',
      `**And what this buys over Lambda, counted.** Fix sites: ${LAMBDA_FIXES} against ${KAPPA_FIXES}. Implementations to verify: ${LAMBDA_FIXES} against ${KAPPA_FIXES}. Plausible pre-existing drift: ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows by ${LAMBDA_DRIFT} units, against **none possible**. The third row is structural rather than a matter of effort — with one implementation, layer-to-layer divergence has nowhere to live.`, '',
      `You pay for that in retention and replay time, which is a cost you can budget rather than a failure you have to detect.`],
    whenHeading: 'When this architecture holds, and the four things it does not settle',
    when: [
      `**It holds when the log is the system of record and the pipeline is a function of it.** Both halves are required: a retained log, and a pipeline that consults nothing outside it.`, '',
      `**Make reprocessing routine, and always with an invariant.** The architecture's value appears only when replay is an ordinary operation, and a replay with nothing to check against cannot be trusted.`, '',
      `**Budget retention against the history you might need to reprocess**, and revisit it whenever that answer changes.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **Replay works only as far back as retention.** Set it to 7 days and "we can always reprocess" quietly becomes "we can reprocess 7 days", with nothing in the running system to say so. This is the assumption that expires without an error.`,
      `2. **The pipeline must be deterministic.** One that reads the wall clock, a random seed or a mutable lookup table does not reproduce ${TOTAL} on replay however complete the log is — and the log will not tell you, because it is the pipeline that stopped being a function of its input. Assert it in a test.`,
      `3. **Replaying ${REPLAY_READS} events is free here; replaying a year of production traffic competes with serving it.** Nothing in this design isolates the replay path from the live one.`,
      `4. **${NEVER_FINAL.length} of the ${ET_KEYS.length} windows is never final in streaming**, so "replay and you have the right answer" is true of the closed windows and not of that one. A consumer needing a final figure needs a bounded run or an agreed cut-off.`],
    diagramHeading: 'Visual walkthrough — four boxes, one incident, the counted comparison',
    sub: `The bug, the replay result, the invariant key and both fix-site counts are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · total ${TOTAL} · ${ET_KEYS.length} windows`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch10.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch10.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being aggregated  ·  key = the grouping column',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in ARRIVAL order (tools/stream_seed.js).`,
  `//   EVENTS[0] = (id 0, key "${EVENTS[0].key}", et ${EVENTS[0].et}, pt ${EVENTS[0].pt}, v ${EVENTS[0].v})`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the window width, in seconds.  WIN = ${WIN}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: KEYS — the distinct grouping values.  KEYS = ["${KEYS.join('", "')}"]`,
  `// primitive: TOTAL — the dataset's true total.  TOTAL = ${TOTAL}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  '// primitive: floorTo(t, w) — t rounded down to a multiple of w.',
  `//   floorTo(${EVENTS[4].et}, ${WIN}) = ${Math.floor(EVENTS[4].et / WIN) * WIN}`,
  '// primitive: watermarkAfter(i) — highest et through i, minus LAG.',
  `//   watermarkAfter(4) = ${WATERMARKS[4]}      watermarkAfter(${EVENTS.length - 1}) = ${WATERMARKS[EVENTS.length - 1]}`,
];
const PROGRAMS = [];
const NF = NEVER_FINAL[0];

// ---- concept 1: one grouping, two finality rules ---------------------------
PROGRAMS.push({
  name: 'ch10-history-memory',
  title: 'One grouping, two finality rules — batch as the easy case',
  subtitle: `identical ${ET_KEYS.length} windows · batch finalises all at event ${batchFinalAt} · streaming never finalises ${NEVER_FINAL.length}`,
  src: COMMON.concat([
    '',
    'type Run { windows, finalAt }',
    '',
    '// function: group(events, clock) — bucket by one clock. This is the WHAT and the',
    '//   WHERE, and it is identical in both modes.',
    `//   group(EVENTS, "et") = {${ET_KEYS.map(k => `${k}: ${SUM(BY_ET[k])}`).join(', ')}}`,
    `//   group(EVENTS, "pt") = {${Object.keys(BY_PT).map(Number).sort((a, b) => a - b).map(k => `${k}: ${SUM(BY_PT[k])}`).join(', ')}}`,
    'fun group(events, clock) {',
    '    var out = {}',
    '    for (e in events) {',
    '        val b = floorTo(e[clock], WIN)',
    '        if (out[b] == NONE) { out[b] = 0 }',
    '        out[b] = out[b] + e.v',
    '    }',
    '    return out',
    '}',
    '',
    '// function: finalAtBounded(bucket) — batch\'s watermark: it jumps to "everything"',
    '//   at end of input, so EVERY bucket closes at the same moment.',
    `//   finalAtBounded(${ET_KEYS[0]}) = ${batchFinalAt}      finalAtBounded(${NF.k}) = ${batchFinalAt}`,
    'fun finalAtBounded(bucket) {',
    '    return len(EVENTS)',
    '}',
    '',
    '// function: finalAtStreaming(bucket) — the same question with a real watermark.',
    `//   finalAtStreaming(${ET_KEYS[0]}) = ${closedAt(ET_KEYS[0])}      finalAtStreaming(${NF.k}) = NONE`,
    'fun finalAtStreaming(bucket) {',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= bucket + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: runAs(mode) — one pipeline, two modes. Only the finality rule differs.',
    `//   runAs("bounded").finalAt   = [${ET_KEYS.map(() => batchFinalAt).join(', ')}]`,
    `//   runAs("unbounded").finalAt = [${ET_KEYS.map(k => closedAt(k) === null ? 'NONE' : closedAt(k)).join(', ')}]`,
    'fun runAs(mode) {',
    '    val w = group(EVENTS, "et")',
    '    var fin = []',
    '    for (b in w) {',
    '        if (mode == "bounded")   { fin = append(fin, finalAtBounded(b)) }',
    '        if (mode == "unbounded") { fin = append(fin, finalAtStreaming(b)) }',
    '    }',
    '    return Run(w, fin)',
    '}',
    '',
    '// function: main() — THE CALLER: the same pipeline, both modes, plus the old',
    '//   arrival-time pipeline for contrast.',
    'fun main() {',
    '    val batch   = runAs("bounded")',
    '    val stream  = runAs("unbounded")',
    '    val arrival = group(EVENTS, "pt")',
    '}',
  ]),
  heap: {
    batch:   { addr: '0x100', type: 'Run', val: () => ET_KEYS.map(k => `${k}:${SUM(BY_ET[k])}`).join(' ') + ` · all final at ${batchFinalAt}` },
    stream:  { addr: '0x200', type: 'Run', val: () => ET_KEYS.map(k => `${k}:${SUM(BY_ET[k])}`).join(' ') + ` · final [${ET_KEYS.map(k => closedAt(k) === null ? 'NONE' : closedAt(k)).join(',')}]` },
    arrival: { addr: '0x300', type: 'map', val: () => Object.keys(BY_PT).map(Number).sort((a, b) => a - b).map(k => `${k}:${SUM(BY_PT[k])}`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `batch = ${o.batch || '...'}`, `stream = ${o.stream || '...'}`, `arrival = ${o.arrival || '...'}`] });
    return [
      { t: 'the grouping is one function, and the clock is its argument', line: at('fun group(events, clock)', 'val b = floorTo(e[clock], WIN)'),
        stack: [MAIN(), { name: 'group', locals: ['events = EVENTS', 'clock = "et"', 'out = (a map)', `e = EVENTS[4]`, `b = ${Math.floor(EVENTS[4].et / WIN) * WIN}`] }],
        heap: [{ key: 'batch', hot: true }],
        cap: `\`floorTo(e[clock], WIN)\` is the whole of WHERE, and \`clock\` is an argument. Batch and streaming both call this with \`"et"\` and get the same ${ET_KEYS.length} buckets — the computation was never what distinguished them. Early streaming systems called it with \`"pt"\` because they had no other option.` },
      { t: 'batch\'s watermark is a constant: end of input', line: at('fun finalAtBounded(bucket)', 'return len(EVENTS)', 'if (mode == "bounded")   { fin = append(fin, finalAtBounded(b)) }'),
        stack: [MAIN({ batch: '@0x100' }), { name: 'runAs', locals: ['mode = "bounded"', 'w = (a map)', `fin = (${ET_KEYS.length} values)`, `b = ${NF.k}`] },
                { name: 'finalAtBounded', locals: [`bucket = ${NF.k}`] }],
        heap: [{ key: 'batch', hot: true }],
        cap: `It ignores \`bucket\` entirely and returns ${batchFinalAt}. That is batch's watermark — the simplest possible one, reaching "everything" at EOF so every window closes together. Batch does not lack a watermark; it has a trivial one, and that is the whole of what an ending buys you.` },
      { t: 'streaming asks a real watermark, and one bucket gets NONE', line: at('fun finalAtStreaming(bucket)', 'fun finalAtStreaming(bucket)::    return NONE'),
        stack: [MAIN({ batch: '@0x100', stream: '@0x200' }), { name: 'finalAtStreaming', locals: [`bucket = ${NF.k}`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'batch' }, { key: 'stream', hot: true }],
        cap: `The loop runs out: no \`watermarkAfter(i)\` reaches ${NF.k + WIN}, so bucket ${NF.k} returns NONE. Compare the two heap rows — identical window VALUES, and the finality column differs. That difference is the only thing the model does not unify, and it is real: ${SUM(BY_ET[NF.k])} is final in batch and never final in streaming.` },
      { t: 'and the old arrival-time pipeline differs in the VALUES', line: at('    val arrival = group(EVENTS, "pt")'),
        stack: [MAIN({ batch: '@0x100', stream: '@0x200', arrival: '@0x300' })],
        heap: [{ key: 'batch' }, { key: 'arrival', hot: true }],
        cap: `\`arrival\` is the same function with \`"pt"\`, and now the VALUES differ, not just the finality: ${LAMBDA_DIFFER.length} of the ${ET_KEYS.length} buckets, by ${LAMBDA_DRIFT} in total. That is what early streaming systems produced — not an approximation of the batch answer but a different question, because they had no way to name event time.` },
    ];
  },
  intro: [
    `**What is being answered.** What the end of an input was doing for a batch job — as one pipeline run in two modes.`, '',
    `\`group(events, clock)\` is the WHAT and the WHERE, and both modes call it identically with \`"et"\`. \`finalAtBounded\` is batch's watermark: it **ignores its argument** and returns ${batchFinalAt}. That is the trivial-watermark claim made mechanical.`, '',
    `Step 3 is the limit of the convergence — \`finalAtStreaming(${NF.k})\` returns NONE — and step 4 is the historical contrast: the same \`group\` with \`"pt"\` differs in the VALUES, ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} buckets by ${LAMBDA_DRIFT}.`],
  sub: `Both finality rules, the identical groupings and the arrival-clock divergence are computed from the seed and asserted.` });

// ---- concept 2: Lambda's drift, and Kappa's single fix site ----------------
PROGRAMS.push({
  name: 'ch10-lambda-memory',
  title: 'Two implementations or one — counted in fix sites',
  subtitle: `Lambda drifts on ${LAMBDA_DIFFER.length} of ${ET_KEYS.length} windows by ${LAMBDA_DRIFT} · the fix lands in ${LAMBDA_FIXES} places vs ${KAPPA_FIXES}`,
  src: COMMON.concat([
    '',
    'type Layer { name, windows, clock }',
    'type Fix   { sites, verified }',
    '',
    `// primitive: BUG_KEY — the key the bug halves.  BUG_KEY = "${BUG_KEY}"`,
    '// primitive: buggyV(e) — what the broken pipeline computes for an event.',
    `//   buggyV(EVENTS[0]) = ${buggy(EVENTS[0])}   (key "${EVENTS[0].key}", halved)`,
    `//   buggyV(EVENTS[2]) = ${buggy(EVENTS[2])}   (key "${EVENTS[2].key}", untouched)`,
    '',
    '// function: layerFor(name) — each Lambda layer picks the clock its own context',
    '//   makes obvious. Neither choice is a mistake, and they disagree.',
    `//   layerFor("batch").clock = "et"      layerFor("speed").clock = "pt"`,
    'fun layerFor(name) {',
    '    var clock = "pt"',
    '    if (name == "batch") { clock = "et" }',
    '    var out = {}',
    '    for (e in EVENTS) {',
    '        val b = floorTo(e[clock], WIN)',
    '        if (out[b] == NONE) { out[b] = 0 }',
    '        out[b] = out[b] + e.v',
    '    }',
    '    return Layer(name, out, clock)',
    '}',
    '',
    '// primitive: absDiff(a, b) — the distance between two numbers.  absDiff(19, 15) = 4',
    '',
    '// function: drift(a, b) — how far apart two layers are, in total.',
    `//   drift(layerFor("batch"), layerFor("speed")) = ${LAMBDA_DRIFT}`,
    'fun drift(a, b) {',
    '    var total = 0',
    '    for (k in a.windows) {',
    '        var other = b.windows[k]',
    '        if (other == NONE) { other = 0 }',
    '        if (a.windows[k] != other) { total = total + absDiff(a.windows[k], other) }',
    '    }',
    '    return total',
    '}',
    '',
    '// function: applyFix(architecture) — how many places the correction must land,',
    '//   and how many implementations must then be verified.',
    `//   applyFix("lambda") = Fix(${LAMBDA_FIXES}, ${LAMBDA_FIXES})      applyFix("kappa") = Fix(${KAPPA_FIXES}, ${KAPPA_FIXES})`,
    'fun applyFix(architecture) {',
    '    if (architecture == "lambda") { return Fix(2, 2) }',
    '    return Fix(1, 1)',
    '}',
    '',
    '// function: replay(fixed) — re-read the whole log through the pipeline. With the',
    '//   bug it gives the wrong total; with the fix it gives TOTAL.',
    `//   replay(false) = ${BUGGY_TOTAL}      replay(true) = ${TOTAL}`,
    'fun replay(fixed) {',
    '    var total = 0',
    '    for (e in EVENTS) {',
    '        if (fixed)         { total = total + e.v }',
    '        if (fixed == false) { total = total + buggyV(e) }',
    '    }',
    '    return total',
    '}',
    '',
    '// function: main() — THE CALLER: the drift, the fix sites, the replay.',
    'fun main() {',
    '    val batch  = layerFor("batch")',
    '    val speed  = layerFor("speed")',
    '    val apart  = drift(batch, speed)',
    '    val lam    = applyFix("lambda")',
    '    val kap    = applyFix("kappa")',
    '    val before = replay(false)',
    '    val after  = replay(true)',
    '}',
  ]),
  heap: {
    batch: { addr: '0x100', type: 'Layer', val: () => `batch · clock "et" · ` + ET_KEYS.map(k => `${k}:${SUM(BY_ET[k])}`).join(' ') },
    speed: { addr: '0x200', type: 'Layer', val: () => `speed · clock "pt" · ` + Object.keys(BY_PT).map(Number).sort((a, b) => a - b).map(k => `${k}:${SUM(BY_PT[k])}`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `batch = ${o.batch || '...'}`, `speed = ${o.speed || '...'}`, `apart = ${o.apart !== undefined ? o.apart : '...'}`,
      `lam = ${o.lam || '...'}`, `kap = ${o.kap || '...'}`,
      `before = ${o.before !== undefined ? o.before : '...'}`, `after = ${o.after !== undefined ? o.after : '...'}`] });
    return [
      { t: 'each layer picks the clock its own context makes obvious', line: at('fun layerFor(name)', 'if (name == "batch") { clock = "et" }'),
        stack: [MAIN(), { name: 'layerFor', locals: ['name = "speed"', 'clock = "pt"', 'out = (a map)', `e = EVENTS[0]`, `b = ${Math.floor(EVENTS[0].pt / WIN) * WIN}`] }],
        heap: [{ key: 'batch' }, { key: 'speed', hot: true }],
        cap: `The default is \`"pt"\` and only the batch layer overrides it — which is the realistic shape of the divergence. A batch layer holding the whole input naturally reaches for event time; a speed layer processing arrivals naturally reaches for arrival time. Neither developer made an error.` },
      { t: `so the two layers are ${LAMBDA_DRIFT} apart, with no bug in either`, line: at('fun drift(a, b)', 'if (a.windows[k] != other) { total = total + absDiff(a.windows[k], other) }'),
        stack: [MAIN({ batch: '@0x100', speed: '@0x200', apart: LAMBDA_DRIFT }),
                { name: 'drift', locals: ['a = @0x100', 'b = @0x200', `total = ${LAMBDA_DRIFT}`, `k = ${LAMBDA_DIFFER[LAMBDA_DIFFER.length - 1]}`, `other = ${SUM(BY_PT[LAMBDA_DIFFER[LAMBDA_DIFFER.length - 1]] || [])}`] }],
        heap: [{ key: 'batch' }, { key: 'speed' }],
        cap: `\`total\` reaches ${LAMBDA_DRIFT} across ${LAMBDA_DIFFER.length} buckets. Read the two heap rows at bucket ${LAMBDA_DIFFER[0]}: ${SUM(BY_ET[LAMBDA_DIFFER[0]])} and ${SUM(BY_PT[LAMBDA_DIFFER[0]] || [])}. Both layers are internally consistent, both are defensible, and the serving layer has to choose between them.` },
      { t: 'the same fix lands in two places, or in one', line: at('fun applyFix(architecture)', 'if (architecture == "lambda") { return Fix(2, 2) }'),
        stack: [MAIN({ batch: '@0x100', speed: '@0x200', apart: LAMBDA_DRIFT, lam: `Fix(${LAMBDA_FIXES}, ${LAMBDA_FIXES})`, kap: `Fix(${KAPPA_FIXES}, ${KAPPA_FIXES})` }),
                { name: 'applyFix', locals: ['architecture = "lambda"'] }],
        heap: [{ key: 'batch' }, { key: 'speed' }],
        cap: `\`lam\` is Fix(${LAMBDA_FIXES}, ${LAMBDA_FIXES}) and \`kap\` is Fix(${KAPPA_FIXES}, ${KAPPA_FIXES}). Kappa does not make the fix cheaper to write — it makes applying it inconsistently impossible, because \`sites\` is 1. That is a different kind of guarantee from "we will remember to update both".` },
      { t: 'and the replay restores the correct total from the log', line: at('fun replay(fixed)', 'if (fixed)         { total = total + e.v }'),
        stack: [MAIN({ batch: '@0x100', speed: '@0x200', apart: LAMBDA_DRIFT, lam: `Fix(${LAMBDA_FIXES}, ${LAMBDA_FIXES})`, kap: `Fix(${KAPPA_FIXES}, ${KAPPA_FIXES})`, before: BUGGY_TOTAL, after: TOTAL }),
                { name: 'replay', locals: ['fixed = true', `total = ${TOTAL}`, `e = EVENTS[${EVENTS.length - 1}]`] }],
        heap: [{ key: 'batch' }],
        cap: `\`before\` = ${BUGGY_TOTAL}, \`after\` = ${TOTAL}, from re-reading the same ${REPLAY_READS} events through corrected code. Nothing was migrated and no second implementation was touched — which is the operational content of "the log is the source of truth".` },
    ];
  },
  intro: [
    `**What is being answered.** Lambda's real cost, as a count rather than an opinion.`, '',
    `\`layerFor(name)\` defaults \`clock\` to \`"pt"\` and only the batch layer overrides it — the realistic shape of the drift, where each layer reaches for the clock its own context suggests. \`drift\` then measures the result: **${LAMBDA_DRIFT}** across ${LAMBDA_DIFFER.length} buckets, with no bug in either layer.`, '',
    `\`applyFix(architecture)\` returns \`sites\`: ${LAMBDA_FIXES} for Lambda, ${KAPPA_FIXES} for Kappa. The guarantee is not that the fix is easier to write but that applying it inconsistently becomes impossible.`],
  sub: `The layer drift, both fix-site counts and both replay totals are computed from the seed and asserted.` });

// ---- concept 3: the convergence, and the invariant check -------------------
PROGRAMS.push({
  name: 'ch10-converge-memory',
  title: 'The convergence — one pipeline, and the invariant that proves a replay',
  subtitle: `key "${KEYS[1]}" holds ${TRUE_PER_KEY[KEYS[1]]} across the replay · ${NEVER_FINAL.length} window never final`,
  src: COMMON.concat([
    '',
    'type Result { perKey, total }',
    '',
    `// primitive: BUG_KEY — the key the bug halves.  BUG_KEY = "${BUG_KEY}"`,
    '// primitive: buggyV(e) — what the broken pipeline computes for an event.',
    `//   buggyV(EVENTS[0]) = ${buggy(EVENTS[0])}      buggyV(EVENTS[2]) = ${buggy(EVENTS[2])}`,
    '',
    '// function: process(fixed) — THE pipeline. One codebase; `fixed` stands for the',
    '//   one-line correction, not for a second implementation.',
    `//   process(false) = Result({${KEYS.map(k => `"${k}": ${BUGGY_PER_KEY[k]}`).join(', ')}}, ${BUGGY_TOTAL})`,
    `//   process(true)  = Result({${KEYS.map(k => `"${k}": ${TRUE_PER_KEY[k]}`).join(', ')}}, ${TOTAL})`,
    'fun process(fixed) {',
    '    var per   = {}',
    '    var total = 0',
    '    for (e in EVENTS) {',
    '        var v = buggyV(e)',
    '        if (fixed) { v = e.v }',
    '        if (per[e.key] == NONE) { per[e.key] = 0 }',
    '        per[e.key] = per[e.key] + v',
    '        total = total + v',
    '    }',
    '    return Result(per, total)',
    '}',
    '',
    '// function: unaffectedKeys(before, after) — keys whose value did NOT move across',
    '//   the replay. These are the invariant: a replay that changes everything cannot',
    '//   be distinguished from one that is wrong in a new way.',
    `//   unaffectedKeys(process(false), process(true)) = ["${KEYS[1]}"]`,
    'fun unaffectedKeys(before, after) {',
    '    var same = []',
    '    for (k in KEYS) {',
    '        if (before.perKey[k] == after.perKey[k]) { same = append(same, k) }',
    '    }',
    '    return same',
    '}',
    '',
    '// function: reprocess(kind) — a logic change, a bug fix and a new output are all',
    '//   the SAME operation: deploy new code, replay the log.',
    '//   reprocess("bugfix") = "replay the log"      reprocess("newOutput") = "replay the log"',
    'fun reprocess(kind) {',
    '    return "replay the log"',
    '}',
    '',
    '// function: finalAtStreaming(bucket) — what the convergence does NOT unify.',
    `//   finalAtStreaming(${ET_KEYS[0]}) = ${closedAt(ET_KEYS[0])}      finalAtStreaming(${NF.k}) = NONE`,
    'fun finalAtStreaming(bucket) {',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= bucket + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: main() — THE CALLER: the wrong result, the replay, the check.',
    'fun main() {',
    '    val wrong   = process(false)',
    '    val right   = process(true)',
    '    val invariant = unaffectedKeys(wrong, right)',
    '    val sameOp  = reprocess("bugfix")',
    `    val neverFinal = finalAtStreaming(${NF.k})`,
    '}',
  ]),
  heap: {
    wrong: { addr: '0x100', type: 'Result', val: () => KEYS.map(k => `"${k}":${BUGGY_PER_KEY[k]}`).join(' ') + ` · total ${BUGGY_TOTAL}` },
    right: { addr: '0x200', type: 'Result', val: () => KEYS.map(k => `"${k}":${TRUE_PER_KEY[k]}`).join(' ') + ` · total ${TOTAL}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `wrong = ${o.wrong || '...'}`, `right = ${o.right || '...'}`, `invariant = ${o.inv || '...'}`,
      `sameOp = ${o.op || '...'}`, `neverFinal = ${o.nf || '...'}`] });
    return [
      { t: 'one pipeline, and the fix is one line inside it', line: at('fun process(fixed)', 'if (fixed) { v = e.v }'),
        stack: [MAIN(), { name: 'process', locals: ['fixed = false', 'per = (a map)', `total = ${BUGGY_TOTAL}`, `e = EVENTS[${EVENTS.length - 1}]`, `v = ${buggy(EVENTS[EVENTS.length - 1])}`] }],
        heap: [{ key: 'wrong', hot: true }],
        cap: `\`fixed\` is one flag inside one function — not a second implementation. With it false, key "${BUG_KEY}" accumulates ${BUGGY_PER_KEY[BUG_KEY]} and the total reaches ${BUGGY_TOTAL}. Under Lambda this same correction would have to be made in a second place, in a different system, and verified separately.` },
      { t: 'the replay runs the same code over the same log', line: at('    val right   = process(true)'),
        stack: [MAIN({ wrong: '@0x100', right: '@0x200' })],
        heap: [{ key: 'wrong' }, { key: 'right', hot: true }],
        cap: `Compare the heap rows: key "${BUG_KEY}" goes ${BUGGY_PER_KEY[BUG_KEY]} → ${TRUE_PER_KEY[BUG_KEY]} and the total ${BUGGY_TOTAL} → ${TOTAL}. Reading ${REPLAY_READS} events was the entire operation — nothing was migrated and no state had to be transformed in place.` },
      { t: 'and an unaffected key is what makes the replay checkable', line: at('fun unaffectedKeys(before, after)', 'if (before.perKey[k] == after.perKey[k]) { same = append(same, k) }'),
        stack: [MAIN({ wrong: '@0x100', right: '@0x200', inv: `["${KEYS[1]}"]` }),
                { name: 'unaffectedKeys', locals: ['before = @0x100', 'after = @0x200', `same = ["${KEYS[1]}"]`, `k = "${KEYS[1]}"`] }],
        heap: [{ key: 'wrong' }, { key: 'right' }],
        cap: `Key "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} in both Results, so it lands in \`same\`. That is the verification: the replay reproduced history for everything the fix should not have touched. Without such a key, "the numbers changed" and "the numbers are now right" are the same observation.` },
      { t: 'but one window is still never final', line: at('fun finalAtStreaming(bucket)', 'fun finalAtStreaming(bucket)::    return NONE'),
        stack: [MAIN({ wrong: '@0x100', right: '@0x200', inv: `["${KEYS[1]}"]`, op: '"replay the log"', nf: 'NONE' }),
                { name: 'finalAtStreaming', locals: [`bucket = ${NF.k}`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'right' }],
        cap: `\`neverFinal\` is NONE for bucket ${NF.k}, which holds ${SUM(BY_ET[NF.k])} and has received all of its events. So "replay and you have the right answer" is true of the closed windows and not of this one — the model unified the computation, not the fact that an unbounded input has no end.` },
    ];
  },
  intro: [
    `**What is being answered.** What the convergence actually delivers operationally, and the check that makes a replay trustworthy.`, '',
    `\`process(fixed)\` is **one** function with one flag — the correction, not a second implementation. Step 2 shows the replay taking key "${BUG_KEY}" from ${BUGGY_PER_KEY[BUG_KEY]} to ${TRUE_PER_KEY[BUG_KEY]} by re-reading ${REPLAY_READS} events.`, '',
    `\`unaffectedKeys\` is the part worth copying into real work: key "${KEYS[1]}" reads ${TRUE_PER_KEY[KEYS[1]]} in **both** results, which is how you know the replay reproduced history rather than computing something else. And step 4 is the residual limit — bucket ${NF.k} is never final.`],
  sub: `Both results, the invariant key and the never-final window are computed from the seed and asserted.` });

// ---- concept 4: the system that survives a bug fix -------------------------
PROGRAMS.push({
  name: 'ch10-system-memory',
  title: 'Surviving a bug fix — and the two assumptions that fail silently',
  subtitle: `${KAPPA_FIXES} fix site · replay ${REPLAY_READS} events · retention and determinism are assumed, not built`,
  src: COMMON.concat([
    '',
    'type Log      { events, retained }',
    'type Pipeline { fixed, deterministic }',
    'type Outcome  { total, trustworthy, why }',
    '',
    `// primitive: BUG_KEY — the key the bug halves.  BUG_KEY = "${BUG_KEY}"`,
    '// primitive: buggyV(e) — what the broken pipeline computes for an event.',
    `//   buggyV(EVENTS[0]) = ${buggy(EVENTS[0])}      buggyV(EVENTS[2]) = ${buggy(EVENTS[2])}`,
    '// primitive: nondeterministic(e) — what a pipeline that reads the WALL CLOCK',
    '//   computes: a value that depends on something outside the log.',
    `//   nondeterministic(EVENTS[0]) = ${EVENTS[0].v} + (whatever the clock said)`,
    '',
    '// function: logWith(retainedCount) — the log, retaining only its last N events.',
    `//   logWith(${EVENTS.length}).retained = ${EVENTS.length}      logWith(${EVENTS.length - 3}).retained = ${EVENTS.length - 3}`,
    'fun logWith(retainedCount) {',
    '    var kept = []',
    '    for (i in len(EVENTS) - retainedCount .. len(EVENTS) - 1) {',
    '        kept = append(kept, EVENTS[i])',
    '    }',
    '    return Log(kept, retainedCount)',
    '}',
    '',
    '// function: replayThrough(log, pipe) — re-read the retained log through the',
    '//   pipeline. This is the ONLY recovery mechanism in the design.',
    `//   replayThrough(logWith(${EVENTS.length}), Pipeline(true, true)) = ${TOTAL}`,
    `//   replayThrough(logWith(${EVENTS.length - 3}), Pipeline(true, true)) = ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)}   (partial)`,
    'fun replayThrough(log, pipe) {',
    '    var total = 0',
    '    for (e in log.events) {',
    '        if (pipe.fixed)         { total = total + e.v }',
    '        if (pipe.fixed == false) { total = total + buggyV(e) }',
    '    }',
    '    return total',
    '}',
    '',
    '// function: verify(log, pipe) — can this replay be TRUSTED to reproduce history?',
    '//   Two assumptions, and each fails without an error.',
    `//   verify(logWith(${EVENTS.length}), Pipeline(true, true)).trustworthy = true`,
    `//   verify(logWith(${EVENTS.length - 3}), Pipeline(true, true)).why = "retention shorter than history"`,
    `//   verify(logWith(${EVENTS.length}), Pipeline(true, false)).why = "pipeline reads outside the log"`,
    'fun verify(log, pipe) {',
    '    val t = replayThrough(log, pipe)',
    '    if (log.retained < len(EVENTS))  { return Outcome(t, false, "retention shorter than history") }',
    '    if (pipe.deterministic == false) { return Outcome(t, false, "pipeline reads outside the log") }',
    '    return Outcome(t, true, "reproduces history")',
    '}',
    '',
    '// function: main() — THE CALLER: the healthy replay, and the two silent failures.',
    'fun main() {',
    `    val healthy = verify(logWith(${EVENTS.length}), Pipeline(true, true))`,
    `    val short   = verify(logWith(${EVENTS.length - 3}), Pipeline(true, true))`,
    `    val loose   = verify(logWith(${EVENTS.length}), Pipeline(true, false))`,
    '}',
  ]),
  heap: {
    healthy: { addr: '0x100', type: 'Outcome', val: () => `total ${TOTAL} · trustworthy true · "reproduces history"` },
    short:   { addr: '0x200', type: 'Outcome', val: () => `total ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)} · trustworthy false · "retention shorter than history"` },
    loose:   { addr: '0x300', type: 'Outcome', val: () => `total ${TOTAL} · trustworthy false · "pipeline reads outside the log"` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `healthy = ${o.h || '...'}`, `short = ${o.s || '...'}`, `loose = ${o.l || '...'}`] });
    return [
      { t: 'the healthy replay reproduces the true total', line: at('fun replayThrough(log, pipe)', 'if (pipe.fixed)         { total = total + e.v }', '        kept = append(kept, EVENTS[i])'),
        stack: [MAIN(), { name: 'verify', locals: [`log = Log(${EVENTS.length} events, retained ${EVENTS.length})`, 'pipe = Pipeline(true, true)', `t = ${TOTAL}`] },
                { name: 'replayThrough', locals: [`log = Log(${EVENTS.length} events, retained ${EVENTS.length})`, 'pipe = Pipeline(true, true)', `total = ${TOTAL}`, `e = EVENTS[${EVENTS.length - 1}]`] }],
        heap: [{ key: 'healthy', hot: true }],
        cap: `All ${EVENTS.length} retained events through the fixed pipeline: \`total\` = ${TOTAL}. This is the architecture working — one codebase, one replay, the right answer. The two steps that follow are the assumptions this result quietly depends on.` },
      { t: 'short retention produces a smaller total and no error', line: at('fun verify(log, pipe)', 'if (log.retained < len(EVENTS))  { return Outcome(t, false, "retention shorter than history") }'),
        stack: [MAIN({ h: '@0x100', s: '@0x200' }), { name: 'verify', locals: [`log = Log(${EVENTS.length - 3} events, retained ${EVENTS.length - 3})`, 'pipe = Pipeline(true, true)', `t = ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)}`] }],
        heap: [{ key: 'healthy' }, { key: 'short', hot: true }],
        cap: `With ${EVENTS.length - 3} of ${EVENTS.length} events retained the replay returns ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)} — a complete, confident, wrong answer. Only this explicit check distinguishes it from ${TOTAL}; the replay itself raises nothing. "We can always reprocess" is true exactly as far back as retention.` },
      { t: 'and a non-deterministic pipeline gives the right total for the wrong reason', line: at('if (pipe.deterministic == false) { return Outcome(t, false, "pipeline reads outside the log") }'),
        stack: [MAIN({ h: '@0x100', s: '@0x200', l: '@0x300' }), { name: 'verify', locals: [`log = Log(${EVENTS.length} events, retained ${EVENTS.length})`, 'pipe = Pipeline(true, false)', `t = ${TOTAL}`] }],
        heap: [{ key: 'short' }, { key: 'loose', hot: true }],
        cap: `\`loose\` has \`total\` = ${TOTAL} and \`trustworthy\` false — the number is right and the guarantee is not. A pipeline that reads the wall clock happens to agree on this replay and will not on the next, and no amount of log completeness fixes it: the pipeline has stopped being a function of its input.` },
      { t: 'so two assumptions carry the whole architecture', line: at('    return Outcome(t, true, "reproduces history")'),
        stack: [MAIN({ h: '@0x100', s: '@0x200', l: '@0x300' }), { name: 'verify', locals: [`log = Log(${EVENTS.length} events, retained ${EVENTS.length})`, 'pipe = Pipeline(true, true)', `t = ${TOTAL}`] }],
        heap: [{ key: 'healthy' }, { key: 'short' }, { key: 'loose' }],
        cap: `Read the three heap rows: totals ${TOTAL}, ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)} and ${TOTAL}, with \`trustworthy\` true, false and false. The totals alone cannot tell you which replay to believe — which is why retention length and determinism belong in a test rather than in an assumption.` },
    ];
  },
  intro: [
    `**What is being answered.** The two assumptions Kappa rests on, made into checks rather than hopes.`, '',
    `\`replayThrough\` is the architecture's only recovery mechanism, and it works: ${TOTAL} from ${EVENTS.length} retained events through the fixed pipeline.`, '',
    `\`verify\` then names what that result depends on. Step 2: ${EVENTS.length - 3} retained events give ${EVENTS.slice(3).reduce((s, e) => s + e.v, 0)} — a confident wrong answer with no error. Step 3: a non-deterministic pipeline gives ${TOTAL}, the **right** total with \`trustworthy\` false. The totals alone cannot tell you which replay to believe.`],
  sub: `All three replay outcomes are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch10.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch10.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
