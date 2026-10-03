#!/usr/bin/env node
'use strict';
/*
 * gen_ch01_interview.js — ch01's interview problem: the average of the last W values on
 * every arrival, and the two things that make the cheap version wrong.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — a running total, what leaves the window, the answer before the window is full,
 * and the drift a subtract-then-add total accumulates. No windowing semantics, no
 * watermarks, no chapter vocabulary.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

const X = S.EVENTS.map(e => e.v);
const N = X.length;
const W = 3;
const NWIN = N - W + 1;

const recompute = (i) => { const win = X.slice(i, i + W); return win.reduce((a, b) => a + b, 0) / W; };
const EXACT = Array.from({ length: NWIN }, (_, i) => recompute(i));
const running = () => { let sum = 0; const out = []; const trace = [];
  for (let i = 0; i < N; i++) {
    sum += X[i];
    const left = i - W;
    if (left >= 0) sum -= X[left];
    const full = i >= W - 1;
    trace.push({ i, added: X[i], removed: left >= 0 ? X[left] : null, sum, avg: full ? sum / W : null, full });
    if (full) out.push(sum / W);
  }
  return { out, trace }; };
const RUN = running();
const ADDS = N, SUBS = RUN.trace.filter(t => t.removed !== null).length;
const RECOMPUTE_OPS = NWIN * W;
const WARMUP = W - 1;

// ---- the drift, measured ----------------------------------------------------
// It is the MIXTURE of magnitudes that drifts, not the magnitude. Multiplying every value
// by 1e16 or 1e18 produces NO drift at all - measured below - because the values then share
// an exponent and the arithmetic stays exact. Replacing ONE value with a large one is what
// breaks it: the large value swamps the small ones, so adding it and later subtracting it
// does not return to where it started. The first draft scaled everything and found nothing,
// which is why the no-drift case is asserted too.
const HUGE = 1e16;
const BIG = X.map((v, i) => (i === 0 ? HUGE : v));
const UNIFORM = X.map(v => v * HUGE);
const bigRecompute = (i) => BIG.slice(i, i + W).reduce((a, b) => a + b, 0) / W;
const bigRunning = () => { let sum = 0; const out = [];
  for (let i = 0; i < N; i++) { sum += BIG[i]; if (i - W >= 0) sum -= BIG[i - W]; if (i >= W - 1) out.push(sum / W); }
  return out; };
const BIG_EXACT = Array.from({ length: NWIN }, (_, i) => bigRecompute(i));
const BIG_RUN = bigRunning();
const uniRecompute = (i) => UNIFORM.slice(i, i + W).reduce((a, b) => a + b, 0) / W;
const uniRunning = () => { let sum = 0; const out = [];
  for (let i = 0; i < N; i++) { sum += UNIFORM[i]; if (i - W >= 0) sum -= UNIFORM[i - W]; if (i >= W - 1) out.push(sum / W); }
  return out; };
const UNI_DRIFT = uniRunning().map((v, i) => v - uniRecompute(i)).filter(d => d !== 0).length;
const DRIFT = BIG_RUN.map((v, i) => v - BIG_EXACT[i]);
const DRIFTED = DRIFT.filter(d => d !== 0).length;
const WORST_DRIFT = Math.max(...DRIFT.map(Math.abs));

const fail = (m) => { throw new Error(`gen_ch01_interview: ${m}`); };
if (RUN.out.join() !== EXACT.join()) fail('the running total disagrees with recomputation on the small values; the program is wrong');
if (!(ADDS + SUBS < RECOMPUTE_OPS)) fail(`the running total costs ${ADDS + SUBS} and recomputation ${RECOMPUTE_OPS}; it must be cheaper`);
if (!RUN.trace.some(t => !t.full)) fail(`the window is full from the first arrival, so the warm-up has no worked case`);
if (RUN.trace.filter(t => !t.full).length !== WARMUP) fail('the warm-up is not W - 1 arrivals long');
if (!RUN.trace.some(t => t.removed !== null)) fail('nothing ever leaves the window');
if (!DRIFTED) fail(`with one value at ${HUGE} the running total still matches recomputation exactly — the drift this section measures has no worked case on this machine`);
if (UNI_DRIFT) fail(`scaling EVERY value by ${HUGE} drifted on ${UNI_DRIFT} answers; the section claims uniform scaling does NOT drift, so that claim must be rewritten rather than the assertion removed`);
if (DRIFTED === NWIN) fail('every scaled answer drifts, so nothing shows that the small-value case is exact');
if (new Set(X).size !== N) fail('two values are equal, so a wrong window cannot be attributed');

const xStr = () => X.map((v, i) => `${i}:${v}`).join('  ');
const FIRST_SUB = RUN.trace.find(t => t.removed !== null);
const LAST = RUN.trace[N - 1];
const D1 = DRIFT.findIndex(d => d !== 0);

const SRC = [
  `// primitive: len(xs) — element count.  len(VALUES) = ${N}`,
  '// primitive: VALUES — what arrives, in order. Written index:value.',
  `//   VALUES = ${xStr()}`,
  `// primitive: W = ${W} — how many of the most recent to average.`,
  '// primitive: sum — the running total of the window. One number, not a list.',
  `//   sum after all ${N} arrivals = ${LAST.sum}`,
  '// primitive: NOT_YET — fewer than W values have arrived, so there is no answer.',
  `// primitive: HUGE = ${HUGE} — one value replaced by a large one, so the window holds a`,
  '//   mixture of magnitudes. Scaling every value equally does NOT drift; the mixture does.',
  '// primitive: allWindows(f) — run f over every window in turn, for comparison.',
  `//   allWindows(recomputeAt) = [${EXACT.map(v => v.toFixed(2)).join(', ')}]`,
  '// primitive: runningAnswer(i) / recomputedAnswer(i) — the two methods\' i-th answers.',
  `//   runningAnswer(${D1}) = ${BIG_RUN[D1]}   ·   recomputedAnswer(${D1}) = ${BIG_EXACT[D1]}`,
  '',
  '// THE QUESTION, as asked:',
  '//   "Values arrive one at a time, forever. Report the average of the last W after every',
  '//    arrival. You may not re-read the window. Then: what do you report before W values',
  '//    have arrived? Then: is the running total exactly right?"',
  '',
  '// function: recomputeAt(xs, i) — the answer everyone gives first: add up the window.',
  `//   recomputeAt(VALUES, 0) = ${EXACT[0]}   ·   ${NWIN} windows x ${W} reads = ${RECOMPUTE_OPS}`,
  'fun recomputeAt(xs, i) {',
  '    var total = 0',
  '    var k = 0',
  '    while (k < W) {',
  '        total = total + xs[i + k]',
  '        k = k + 1',
  '    }',
  '    return total / W',
  '}',
  '',
  '// function: onArrival(xs, i) — add what came in, subtract what left. Two operations,',
  '//   whatever W is.',
  `//   at arrival ${FIRST_SUB.i}: + ${FIRST_SUB.added} − ${FIRST_SUB.removed} → sum ${FIRST_SUB.sum}`,
  `//   ${ADDS} additions and ${SUBS} subtractions in all, against ${RECOMPUTE_OPS} reads`,
  'fun onArrival(xs, i) {',
  '    sum = sum + xs[i]',
  '    if (i - W >= 0) {',
  '        sum = sum - xs[i - W]',
  '    }',
  '}',
  '',
  '// function: report(i) — the answer, or NOT_YET. The guard is the one everyone forgets.',
  `//   report(${WARMUP - 1}) = NOT_YET   ·   report(${WARMUP}) = ${RUN.out[0]}`,
  'fun report(i) {',
  '    if (i < W - 1) { return NOT_YET }',
  '    return sum / W',
  '}',
  '',
  '// function: driftAt(i) — how far the running total has wandered from the truth, at a',
  '//   magnitude where a double cannot hold both the total and one value.',
  `//   driftAt(${D1}) = ${DRIFT[D1]}   ·   ${DRIFTED} of ${NWIN} answers drift   ·   worst ${WORST_DRIFT}`,
  'fun driftAt(i) {',
  '    return runningAnswer(i) - recomputedAnswer(i)',
  '}',
  '',
  '// function: main() — both answers, the warm-up, then the drift.',
  'fun main() {',
  `    val slow  = allWindows(recomputeAt)   // ${RECOMPUTE_OPS} reads`,
  `    val fast  = allWindows(report)        // ${ADDS + SUBS} operations, same answers`,
  `    val early = report(${WARMUP - 1})                  // NOT_YET`,
  `    val same  = ${RUN.out.join() === EXACT.join()}                        // exact on these values`,
  `    val drift = ${DRIFTED}                           // of ${NWIN} answers, with one value at ${HUGE}`,
  '}',
];

const HEAP = {
  values: { addr: '0x100', type: `int[${N}]`, val: () => xStr() },
  state:  { addr: '0x200', type: 'running', val: (st) => st === undefined ? `sum=${LAST.sum}` : st },
  out:    { addr: '0x300', type: 'avg[]', val: (st) => st === undefined ? `[${RUN.out.map(v => v.toFixed(2)).join(', ')}]` : st },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `slow = ${o.slow === undefined ? '...' : o.slow}`,
  `fast = ${o.fast === undefined ? '...' : o.fast}`,
  `early = ${o.early === undefined ? '...' : o.early}`,
  `same = ${o.same === undefined ? '...' : o.same}`,
  `drift = ${o.drift === undefined ? '...' : o.drift}`] });
const RC = (o = {}) => ({ name: 'recomputeAt', locals: ['xs = @0x100', `i = ${o.i}`, `total = ${o.total}`, `k = ${o.k}`] });
const OA = (o = {}) => ({ name: 'onArrival', locals: ['xs = @0x100', `i = ${o.i}`] });
const RP = (o = {}) => ({ name: 'report', locals: [`i = ${o.i}`] });
const DA = (o = {}) => ({ name: 'driftAt', locals: [`i = ${o.i}`] });

const steps = (at) => [
  { t: `${N} values, a window of ${W}, an answer per arrival`, line: at('val slow  = allWindows(recomputeAt)'),
    stack: [MAIN()], heap: [{ key: 'values' }, { key: 'state', st: 'sum=0' }],
    cap: `0x100 holds ${xStr()} and 0x200 is the only state the fast answer will need: **one number**. "Forever" is the constraint — the stream does not end, so nothing can be held that grows with the arrivals.` },

  { t: `the first answer: add up the window`, line: at('total = total + xs[i + k]'),
    stack: [MAIN(), RC({ i: 0, total: X[0], k: 1 })],
    heap: [{ key: 'values', hot: true }],
    cap: `${W} reads give ${EXACT[0]} for the first window. Correct, and ${NWIN} windows × ${W} = ${RECOMPUTE_OPS} reads here — at W = 10⁵ it is 10⁵ reads **per arrival**, so the cost is set by the window size when it need not be.` },

  { t: `the reframe: one number, two operations`, line: at('sum = sum + xs[i]'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads` }), OA({ i: 0 })],
    heap: [{ key: 'state', st: `sum=${X[0]}`, hot: true }],
    cap: `The window's total is kept rather than its contents. Adding the arrival is half of it; the other half is noticing that **exactly one value leaves** when one arrives, so the update is a constant two operations whatever W is.` },

  { t: `value ${FIRST_SUB.removed} leaves the window`, line: at('sum = sum - xs[i - W]'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads` }), OA({ i: FIRST_SUB.i })],
    heap: [{ key: 'values', hot: true }, { key: 'state', st: `sum=${FIRST_SUB.sum}`, hot: true }],
    cap: `At arrival ${FIRST_SUB.i}, index ${FIRST_SUB.i - W} is now outside the window, so its value ${FIRST_SUB.removed} is subtracted: sum becomes ${FIRST_SUB.sum}. Note what this needs — **the departing value**, which means the last W values must still be reachable even though only the total is being maintained. The "one number" claim is about the total, not about the memory.` },

  { t: `and before ${W} have arrived there is no answer`, line: at('if (i < W - 1) { return NOT_YET }'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads` }), RP({ i: WARMUP - 1 })],
    heap: [{ key: 'state', st: `sum=${RUN.trace[WARMUP - 1].sum}`, hot: true }],
    cap: `After ${WARMUP} arrivals the total is ${RUN.trace[WARMUP - 1].sum}, and dividing by ${W} would report ${(RUN.trace[WARMUP - 1].sum / W).toFixed(2)} — an average of ${W} values when only ${WARMUP} exist. **${WARMUP} answers are withheld**, which is W − 1, and the usual bug is to divide by W from the first arrival and quietly report a figure that is too low for the first ${WARMUP} of them.` },

  { t: `${ADDS + SUBS} operations against ${RECOMPUTE_OPS} reads`, line: at('fun report(i)::return sum / W'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops` }), RP({ i: N - 1 })],
    heap: [{ key: 'out', st: `[${RUN.out.map(v => v.toFixed(2)).join(', ')}]`, hot: true }],
    cap: `[${RUN.out.map(v => v.toFixed(2)).join(', ')}] — asserted equal to recomputing every window. ${ADDS} additions and ${SUBS} subtractions, **independent of W**: at W = 10⁵ it is still two operations per arrival instead of 10⁵.` },

  { t: `so is the running total exactly right?`, line: at('val same  = '),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true' })],
    heap: [{ key: 'out' }],
    cap: `On these values, yes — asserted answer by answer. That is worth checking rather than assuming, because the two methods are not the same computation: one adds ${W} numbers from scratch, the other adds and subtracts ${ADDS + SUBS} times. They agree here because the values are small integers.` },

  { t: `now one value replaced by ${HUGE}`, line: at('return runningAnswer(i) - recomputedAnswer(i)'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true' }), DA({ i: D1 })],
    heap: [{ key: 'out', st: `drift at ${D1}: ${DRIFT[D1]}`, hot: true }],
    cap: `Replace one value with ${HUGE} and the two methods **stop agreeing**: ${DRIFTED} of ${NWIN} answers differ, the worst by ${WORST_DRIFT}. The reason is that a double cannot hold the total and one value to the same precision, so **adding a value and later subtracting it does not return to where you started** — each window's total carries the residue of every value that has ever passed through it.` },

  { t: `and the error only accumulates`, line: at('fun driftAt(i)::return runningAnswer(i) - recomputedAnswer(i)'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true', drift: DRIFTED }), DA({ i: NWIN - 1 })],
    heap: [{ key: 'out', st: `${DRIFTED} of ${NWIN} drifted`, hot: true }],
    cap: `There is no step that corrects it: the total is never recomputed, so a residue introduced at arrival 3 is still in the total at arrival a million. Recomputation has no such problem and costs W reads. **The fast answer trades exactness for a cost independent of W**, and whether that trade is acceptable depends on the magnitudes — which is a property of the data, not of the algorithm.` },

  { t: `which is why integers are worth insisting on`, line: at('fun onArrival(xs, i)::sum = sum + xs[i]'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true', drift: DRIFTED }), OA({ i: 0 })],
    heap: [{ key: 'state' }],
    cap: `Integer addition and subtraction are exact and reversible, so the drift disappears entirely — which is why money is counted in pence and latencies in microseconds rather than as fractions. If the values must be fractional, the fix is to recompute periodically, which bounds the residue to whatever accumulates between recomputations.` },

  { t: `and what else the window needs`, line: at('fun onArrival(xs, i)::if (i - W >= 0) {'),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true', drift: DRIFTED }), OA({ i: FIRST_SUB.i })],
    heap: [{ key: 'values', hot: true }, { key: 'state' }],
    cap: `The subtraction reads index ${FIRST_SUB.i - W}, so the last W values must be retained — a ring buffer of W entries, not the whole stream. So the real cost is O(1) **time** and O(W) **space**, and claiming O(1) for both is the overstatement to avoid: the total is one number and the window is still W values.` },

  { t: 'the bill', line: at('val drift = '),
    stack: [MAIN({ slow: `${RECOMPUTE_OPS} reads`, fast: `${ADDS + SUBS} ops`, early: 'NOT_YET', same: 'true', drift: DRIFTED })],
    heap: [{ key: 'values' }, { key: 'state' }, { key: 'out' }],
    cap: `Two operations per arrival instead of ${W}, W values retained, and ${WARMUP} answers withheld at the start. Three things to volunteer: the warm-up is **W − 1 answers**, not a rounding detail; the space is **O(W)** even though the time is O(1); and the running total is **exact only for exact arithmetic** — ${DRIFTED} of ${NWIN} answers drift as soon as one value is large enough to swamp the others, and no step ever corrects it.` },
];

const r = buildInterviewSection({
  name: 'ch01-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch01-interview-memory'),
  gen: 'gen_ch01_interview.js',
  title: 'The average of the last W — stack and heap at every step',
  subtitle: `${N} values, W = ${W} · ${RECOMPUTE_OPS} reads vs ${ADDS + SUBS} operations · ${WARMUP} answers withheld · ${DRIFTED} of ${NWIN} drift with one value at ${HUGE}`,
  problem: {
    surface: 'weather station',
    statement: [`**Values arrive one at a time, forever.** Report the **average of the last \`W\`** after every arrival.`, '',
      `**You may not re-read the window on each arrival.**`, '',
      `Then: **what do you report before \`W\` values have arrived?** And: **is the running total exactly right?**`],
    example: [`\`${xStr()}\` with W = ${W} → ${RUN.out.map(v => v.toFixed(2)).join(', ')}, with the first ${WARMUP} answers withheld. Replace one value with ${HUGE} and **${DRIFTED} of ${NWIN}** answers stop matching a recomputation — while scaling *every* value by ${HUGE} drifts on none.`],
    constraints: [`The stream does not end. \`W\` may be 10⁵.`],
  },
  model: [
    `Recomputing the window is \`W\` reads per arrival — 10⁵ per arrival at the stated size — and the cost is set by the window rather than by the data.`, '',
    `The reframe is to keep the window's **total** instead of its contents: add the arrival, subtract the one that left. Exactly one value leaves when one arrives, so the update is **two operations whatever \`W\` is**.`, '',
    `Then the two things the follow-ups are for.`, '',
    `**The warm-up.** Before \`W\` values exist there is no average of \`W\` values, so **W − 1 answers must be withheld** — here ${WARMUP}. Dividing by \`W\` from the first arrival is the standard bug, and it reports figures that are quietly too low rather than obviously wrong.`, '',
    `**The exactness.** The two methods are not the same computation: one adds \`W\` numbers from scratch, the other adds and subtracts forever. With small integers they agree, asserted answer by answer. Replace one value with ${HUGE} and they stop agreeing — ${DRIFTED} of ${NWIN} answers differ, while scaling **every** value equally drifts on none, because the values then share an exponent and the arithmetic stays exact — because a double cannot hold the total and one value to the same precision, so **adding a value and later subtracting it does not return to where you started**, and nothing ever corrects the residue. The fixes are to use exact arithmetic (count in pence, not pounds) or to recompute periodically, which bounds the residue.`, '',
    `And one overstatement to avoid: the subtraction needs the **departing value**, so the last \`W\` values must be retained. The time is O(1) and the space is **O(W)** — the total is one number and the window is still \`W\` values.`,
  ],
  variations: [
    { name: 'the rolling maximum', surface: 'risk',
      statement: [`The same window, but report the **maximum** rather than the average.`],
      whyHard: `The trick does not transfer, and seeing exactly why is the point: a total can have a value subtracted out of it because addition is invertible, and a maximum cannot — once the maximum leaves the window there is no way to recover the next one from the single number you kept. So the answer needs a structure rather than an accumulator, and the one that works keeps only the values that could still become the maximum. The useful generalisation is that **an incremental window needs an invertible combine**, which sums and counts have and extremes and medians do not.`,
      maps: `\`onArrival\`'s subtraction is the line that cannot be written, which is why this needs a monotonic deque instead of a running total.` },

    { name: 'the time-based window', surface: 'monitoring',
      statement: [`Average everything from **the last 60 seconds** rather than the last \`W\` values. Arrivals are irregular.`],
      whyHard: `The count stops being fixed, so "exactly one leaves when one arrives" is false — zero or many may expire — and the divisor changes on every arrival, which means the count must be maintained alongside the total. The subtler part is that the answer changes **with no arrival at all**: values age out while the stream is quiet, so a correct implementation must be able to recompute on a timer rather than only on input. That is the same clock-versus-arrival distinction the batching problem turns on.`,
      maps: `\`onArrival\` looping the subtraction and maintaining a count, plus a timer-driven recompute — \`report\` dividing by the live count rather than by W.` },

    { name: 'the average that must survive a restart', surface: 'reliability',
      statement: [`The process is restarted. **The running average must continue**, not start again.`],
      whyHard: `The total is one number and looks trivially checkpointable, and that is the trap: restoring the total without the last \`W\` values makes the next subtraction impossible, so the state that must be saved is the whole window rather than the accumulator. And the checkpoint must be consistent with the input position, or restoring an older total against a newer position double-counts. Recognising that the thing to persist is **larger than the thing being reported** is the content.`,
      maps: `0x200 and the retained window both persisted, with the input position — the O(W) space from the traced frames becoming the checkpoint size.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch01-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is six paragraphs; this is both answers running and then the drift measured, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured on ${xStr()} with W = ${W}: recomputation costs **${RECOMPUTE_OPS} reads** and the running total costs **${ADDS + SUBS} operations** — ${ADDS} additions and ${SUBS} subtractions — returning the same ${NWIN} answers, asserted. ${WARMUP} answers are withheld during the warm-up. Then the same program with one value replaced by ${HUGE}: **${DRIFTED} of ${NWIN}** answers no longer match a recomputation, the worst by ${WORST_DRIFT} — while multiplying *every* value by ${HUGE} drifts on **none**, which is why it is the mixture and not the magnitude.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x200 is the single number the design is famous for, and 0x100 is the W values the subtraction still needs — which is why the space is O(W) and not O(1). The large value is a declared parameter used only to make the drift measurable on this machine, and the no-drift case is asserted alongside it so "it is the mixture, not the magnitude" cannot silently become false. Every figure is asserted — including that the running total agrees with recomputation exactly on the small values, that it is cheaper, that the warm-up is exactly W − 1 arrivals long, that something really does leave the window, that the mixed-magnitude version really does drift, that **not every** such answer drifts (so the small-value case is visibly the exact one), and that uniformly scaling every value drifts on **none**. Generated by \`node tools/gen_ch01_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch01-interview-memory`);
console.log(`    W=${W} · ${RECOMPUTE_OPS} reads vs ${ADDS}+${SUBS} ops · warmup ${WARMUP} · mixed drift ${DRIFTED}/${NWIN}, worst ${WORST_DRIFT} · uniform drift ${UNI_DRIFT}`);
