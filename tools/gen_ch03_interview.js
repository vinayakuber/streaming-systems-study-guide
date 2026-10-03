#!/usr/bin/env node
'use strict';
/*
 * gen_ch03_interview.js — ch03's interview problem: the largest value in a window that
 * slides, without re-scanning it, and the same trick run twice for a spread.
 *
 * SCOPE: this is the one section in the four books whose scope was EXTENDED beyond the
 * chapter's existing program, at the user's explicit direction, so that the monotonic
 * deque has an honest home. The extension is itself a real variant of the chapter's
 * subject: the chapter's heuristic watermark is `max event time SO FAR − lag`, which one
 * corrupt future timestamp raises permanently, declaring every later event late with no
 * recovery. Bounding the max to the last W events fixes that, and a bounded sliding max
 * is exactly this problem. Nothing else is in scope: no triggers, no lateness policy,
 * no chapter vocabulary.
 *
 * The values are the seed's event times in PROCESSING order, which are deliberately not
 * monotonic — a monotonic input makes the deque never evict and hides the whole idea.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

// The event VALUES, in processing order. The seed's event TIMES were the obvious choice
// and are nearly increasing, which makes the deque hold one entry almost always and means
// nothing ever expires from the front — so half the program would never be exercised. The
// values rise and fall, which the assertions below require.
const X = S.EVENTS.map(e => e.v);
const N = X.length;
const W = 3;
const L = 6;
const NWIN = N - W + 1;

const brute = (i) => { const win = X.slice(i, i + W); return { max: Math.max(...win), min: Math.min(...win), win }; };
const BRUTE = Array.from({ length: NWIN }, (_, i) => brute(i));

// ---- one deque, decreasing, for the maximum ---------------------------------
const slideMax = () => {
  const dq = []; const out = []; const trace = []; let pushes = 0, pops = 0, fronts = 0;
  for (let i = 0; i < N; i++) {
    const evicted = [];
    while (dq.length && X[dq[dq.length - 1]] <= X[i]) { evicted.push(dq.pop()); pops++; }
    dq.push(i); pushes++;
    let dropped = null;
    if (dq[0] <= i - W) { dropped = dq.shift(); fronts++; }
    const ready = i >= W - 1;
    trace.push({ i, v: X[i], evicted, dropped, dq: [...dq], max: ready ? X[dq[0]] : null, ready });
    if (ready) out.push(X[dq[0]]);
  }
  return { out, trace, pushes, pops, fronts, ops: pushes + pops + fronts };
};
const MAXR = slideMax();

// ---- two deques, for the spread --------------------------------------------
const slideBoth = () => {
  const hi = [], lo = []; const out = [];
  for (let i = 0; i < N; i++) {
    while (hi.length && X[hi[hi.length - 1]] <= X[i]) hi.pop();
    hi.push(i);
    while (lo.length && X[lo[lo.length - 1]] >= X[i]) lo.pop();
    lo.push(i);
    if (hi[0] <= i - W) hi.shift();
    if (lo[0] <= i - W) lo.shift();
    if (i >= W - 1) out.push({ at: i, max: X[hi[0]], min: X[lo[0]], spread: X[hi[0]] - X[lo[0]], hi: [...hi], lo: [...lo] });
  }
  return out;
};
const BOTH = slideBoth();
const OVER = BOTH.filter(b => b.spread > L);
const UNDER = BOTH.filter(b => b.spread <= L);

const BRUTE_OPS = NWIN * W;
const BIGW = 100000, BIGN = 10000000;

const fail = (m) => { throw new Error(`gen_ch03_interview: ${m}`); };
if (X.every((v, i) => i === 0 || v >= X[i - 1])) fail('the values arrive in increasing order, so nothing is ever evicted and the deque looks pointless');
if (MAXR.out.join() !== BRUTE.map(b => b.max).join()) fail('the deque answer disagrees with the brute-force scan; the program is wrong');
if (BOTH.map(b => b.min).join() !== BRUTE.map(b => b.min).join()) fail('the second deque disagrees with the brute-force minimum');
if (!MAXR.trace.some(t => t.evicted.length >= 2)) fail('no arriving value ever evicts two or more from the back — the case that shows why this is amortised O(1) has no worked example');
if (!MAXR.trace.some(t => t.dropped !== null)) fail('nothing ever leaves the window from the front, so the half a heap cannot do is never shown');
if (!MAXR.trace.some(t => t.evicted.length === 0 && t.i > 0)) fail('every push evicts something, so the cheap path is never shown');
if (!OVER.length || !UNDER.length) fail(`${OVER.length} of ${BOTH.length} windows exceed L = ${L}; some must and some must not, or the spread test is not discriminating`);
if (!(MAXR.ops < BRUTE_OPS)) fail(`the deque did ${MAXR.ops} operations and the scan does ${BRUTE_OPS}; the deque must do fewer here`);
if (MAXR.pushes !== N) fail('a value was pushed more than once; the amortised argument depends on exactly one push each');
if (new Set(X).size !== N) fail('two values are equal, so an eviction cannot be attributed to the newer one');

const dqStr = (idx) => `[${idx.map(i => `${i}:${X[i]}`).join(' ')}]`;
const xStr = () => X.map((v, i) => `${i}:${v}`).join('  ');
const BIGEV = MAXR.trace.find(t => t.evicted.length >= 2);
const FRONT = MAXR.trace.find(t => t.dropped !== null);
const NOEV = MAXR.trace.find(t => t.evicted.length === 0 && t.i > 0);
const FIRST = MAXR.trace[W - 1];
const O1 = OVER[0], U1 = UNDER[0];

const SRC = [
  `// primitive: len(xs) — element count.  len(TICKS) = ${N}`,
  '// primitive: TICKS — the values, in the order they arrive. Written index:value.',
  `//   TICKS = ${xStr()}`,
  `// primitive: W = ${W} — how many of the most recent to consider.`,
  `// primitive: L = ${L} — the spread the second half must warn about.`,
  '// primitive: dq — a list of INDEXES, open at both ends. Indexes, not values, because',
  '//   only an index says whether an entry has left the window yet.',
  `//   dq after ${N} ticks = ${dqStr(MAXR.trace[N - 1].dq)}`,
  '// primitive: back(dq) / front(dq) — the newest and oldest index held.',
  `//   back(${dqStr(FIRST.dq)}) = ${FIRST.dq[FIRST.dq.length - 1]}   ·   front(${dqStr(FIRST.dq)}) = ${FIRST.dq[0]}`,
  '// primitive: dropBack(dq) / dropFront(dq) — remove from either end, in one step.',
  `//   dropBack(${dqStr(BIGEV.dq.concat(BIGEV.evicted))}) = ${dqStr(BIGEV.dq.concat(BIGEV.evicted).slice(0, -1))}`,
  '// primitive: dq.pushBack(i) — append one index to the newest end.',
  `//   an empty dq pushed with 0 = ${dqStr([0])}`,
  '// primitive: evictLarger(dq, xs, i) — the mirror of evictSmaller, for the MINIMUM: drop',
  '//   anything at the back that is no SMALLER than the arriving value.',
  `//   evictLarger(lo, TICKS, ${O1.at}) = ${dqStr(O1.lo)}`,
  '// primitive: allWindows(f) — run f over every window in turn, for comparison.',
  `//   allWindows(bruteMax) = [${BRUTE.map(b => b.max).join(', ')}]`,
  '// primitive: NONE — no answer yet, because fewer than W ticks have arrived.',
  '',
  '// THE QUESTION, as asked:',
  '//   "A risk screen shows the HIGHEST value among the last W ticks, updated on every',
  '//    tick. Millions of ticks; W up to 10^5. Update it without re-reading the window.',
  '//    Then: also warn when the last W ticks span more than L, highest minus lowest."',
  '',
  '// function: bruteMax(xs, i) — the answer everyone gives first: read the window.',
  `//   bruteMax(TICKS, 0) = ${BRUTE[0].max}   ·   bruteMax(TICKS, ${NWIN - 1}) = ${BRUTE[NWIN - 1].max}`,
  `//   ${NWIN} windows x ${W} reads = ${BRUTE_OPS} reads in all`,
  'fun bruteMax(xs, i) {',
  '    var best = xs[i]',
  '    var k = 1',
  '    while (k < W) {',
  '        if (xs[i + k] > best) { best = xs[i + k] }',
  '        k = k + 1',
  '    }',
  '    return best',
  '}',
  '',
  '// function: evictSmaller(dq, xs, i) — anything at the back that is no larger than the',
  '//   arriving value can never be the maximum again, because the newcomer is both BIGGER',
  '//   and NEWER, so it outlives them. Drop them.',
  `//   at tick ${BIGEV.i} (value ${BIGEV.v}) this drops ${BIGEV.evicted.length} entries: ${BIGEV.evicted.map(j => `${j}:${X[j]}`).join(', ')}`,
  'fun evictSmaller(dq, xs, i) {',
  '    while (len(dq) > 0) {',
  '        if (xs[back(dq)] > xs[i]) { return dq }',
  '        dropBack(dq)',
  '    }',
  '    return dq',
  '}',
  '',
  '// function: expire(dq, i) — the front has left the window if its index is more than W',
  '//   behind. At most ONE can expire per tick, because the window moves by one.',
  `//   at tick ${FRONT.i} this drops index ${FRONT.dropped}`,
  'fun expire(dq, i) {',
  '    if (front(dq) <= i - W) { dropFront(dq) }',
  '    return dq',
  '}',
  '',
  '// function: slideMax(xs) — one pass. Every index is pushed once and dropped once, so',
  `//   the total work is ${MAXR.ops} steps for ${N} ticks, not ${BRUTE_OPS}.`,
  `//   slideMax(TICKS) = [${MAXR.out.join(', ')}]`,
  'fun slideMax(xs) {',
  '    var dq  = []',
  '    var out = []',
  '    var i   = 0',
  '    while (i < len(xs)) {',
  '        evictSmaller(dq, xs, i)',
  '        dq.pushBack(i)',
  '        expire(dq, i)',
  '        if (i >= W - 1) { out.append(xs[front(dq)]) }',
  '        i = i + 1',
  '    }',
  '    return out',
  '}',
  '',
  '// function: slideSpread(xs) — the same thing twice: one list kept DECREASING for the',
  '//   maximum, one kept INCREASING for the minimum, advanced together.',
  `//   slideSpread(TICKS) = [${BOTH.map(b => b.spread).join(', ')}]`,
  `//   ${OVER.length} of ${BOTH.length} windows exceed L = ${L}`,
  'fun slideSpread(xs) {',
  '    var hi  = []',
  '    var lo  = []',
  '    var out = []',
  '    var i   = 0',
  '    while (i < len(xs)) {',
  '        evictSmaller(hi, xs, i)',
  '        evictLarger(lo, xs, i)',
  '        hi.pushBack(i)',
  '        lo.pushBack(i)',
  '        expire(hi, i)',
  '        expire(lo, i)',
  '        if (i >= W - 1) { out.append(xs[front(hi)] - xs[front(lo)]) }',
  '        i = i + 1',
  '    }',
  '    return out',
  '}',
  '',
  '// function: main() — the scan, the one list, then the two.',
  'fun main() {',
  `    val slow   = allWindows(bruteMax)   // ${BRUTE_OPS} reads`,
  `    val fast   = slideMax(TICKS)        // ${MAXR.ops} steps, same answer`,
  `    val spread = slideSpread(TICKS)     // ${OVER.length} of ${BOTH.length} windows over ${L}`,
  '}',
];

const HEAP = {
  ticks: { addr: '0x100', type: `int[${N}]`, val: () => xStr() },
  maxq:  { addr: '0x200', type: 'index[] decreasing', val: (st) => st === undefined ? dqStr(MAXR.trace[N - 1].dq) : (st === 0 ? '[]' : st) },
  minq:  { addr: '0x300', type: 'index[] increasing', val: (st) => st === undefined ? dqStr(BOTH[BOTH.length - 1].lo) : (st === 0 ? '[]' : st) },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `slow = ${o.slow === undefined ? '...' : o.slow}`,
  `fast = ${o.fast === undefined ? '...' : o.fast}`,
  `spread = ${o.spread === undefined ? '...' : o.spread}`] });
const BR = (o = {}) => ({ name: 'bruteMax', locals: [
  'xs = @0x100', `i = ${o.i}`, `best = ${o.best}`, `k = ${o.k}`] });
const SM = (o = {}) => ({ name: 'slideMax', locals: [
  'xs = @0x100', 'dq = @0x200', `out = ${o.out === undefined ? '...' : o.out}`, `i = ${o.i}`] });
const EV = (o = {}) => ({ name: 'evictSmaller', locals: ['dq = @0x200', 'xs = @0x100', `i = ${o.i}`] });
const EX = (o = {}) => ({ name: 'expire', locals: ['dq = @0x200', `i = ${o.i}`] });
const SS = (o = {}) => ({ name: 'slideSpread', locals: [
  'xs = @0x100', 'hi = @0x200', 'lo = @0x300', `out = ${o.out === undefined ? '...' : o.out}`, `i = ${o.i}`] });

const steps = (at) => [
  { t: `${N} ticks, a window of ${W}, an answer per tick`, line: at('val slow   = allWindows(bruteMax)'),
    stack: [MAIN()], heap: [{ key: 'ticks' }],
    cap: `0x100 holds ${xStr()} — note they rise and fall, which is the only reason this problem is interesting. ${NWIN} windows, each needing a maximum, and the screen updates on every tick.` },

  { t: `the first answer: read all ${W}`, line: at('if (xs[i + k] > best) { best = xs[i + k] }'),
    stack: [MAIN(), BR({ i: 0, best: X[0], k: 1 })],
    heap: [{ key: 'ticks', hot: true }],
    cap: `Scanning window 0 gives ${BRUTE[0].max} after ${W} reads. Correct, and ${NWIN} windows × ${W} = ${BRUTE_OPS} reads here — at W = ${BIGW.toLocaleString('en-US')} and ${BIGN.toLocaleString('en-US')} ticks it is 10¹² reads, so the screen is a trillion operations behind by lunchtime.` },

  { t: `why a heap does not work either`, line: at('fun bruteMax(xs, i)::return best'),
    stack: [MAIN(), BR({ i: 0, best: BRUTE[0].max, k: W })],
    heap: [{ key: 'ticks' }],
    cap: `The obvious next thought is a max-heap of the window, giving the maximum in one step. It fails on the **other** operation: each tick, the value leaving the window must be removed, and a heap can only remove its top. The value leaving is almost never the top, so there is no way to take it out — and this is where most attempts stall.` },

  { t: `the reframe: keep INDEXES, in decreasing order`, line: at('fun slideMax(xs)::var dq  = []'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: '[]', i: 0 })],
    heap: [{ key: 'maxq', st: 0, hot: true }],
    cap: `An empty list at 0x200, and two decisions are already made. It holds **indexes**, not values, because only an index says whether an entry has left the window. And it will be kept **decreasing**, which makes its front the maximum — so the answer is always one read, with no searching.` },

  { t: `value ${BIGEV.v} arrives and evicts ${BIGEV.evicted.length} entries`, line: at('fun evictSmaller(dq, xs, i)::dropBack(dq)'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: `${Math.max(0, BIGEV.i - W + 1)} answers`, i: BIGEV.i }), EV({ i: BIGEV.i })],
    heap: [{ key: 'ticks', hot: true }, { key: 'maxq', st: dqStr(BIGEV.dq.concat(BIGEV.evicted).sort((a, b) => a - b)), hot: true }],
    cap: `${BIGEV.evicted.map(j => `${j}:${X[j]}`).join(' and ')} are dropped from the back because ${BIGEV.v} is larger. The argument is the whole trick, and it is one sentence: **the newcomer is both bigger AND newer**, so for as long as either of them is in the window the newcomer is too, and it is always the larger — so neither can ever be the maximum again. They are not merely unlikely to matter; they are provably dead.` },

  { t: `so the list is the window's suffix maxima`, line: at('fun slideMax(xs)::dq.pushBack(i)'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: `${Math.max(0, BIGEV.i - W + 1)} answers`, i: BIGEV.i })],
    heap: [{ key: 'maxq', st: dqStr(BIGEV.dq), hot: true }],
    cap: `0x200 is now ${dqStr(BIGEV.dq)} — decreasing by construction, never sorted. What it holds is exactly the values that are larger than everything after them in the window: the front is the maximum, and each one behind it is the maximum of what remains once the ones before have expired. That is why no recomputation is ever needed when the front leaves.` },

  { t: `a cheap tick: nothing to evict`, line: at('if (xs[back(dq)] > xs[i]) { return dq }'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: `${Math.max(0, NOEV.i - W + 1)} answers`, i: NOEV.i }), EV({ i: NOEV.i })],
    heap: [{ key: 'maxq', st: dqStr(NOEV.dq.filter(j => j !== NOEV.i)), hot: true }],
    cap: `Value ${NOEV.v} is smaller than the back, so the loop exits immediately and ${NOEV.v} simply joins the end. One comparison. Most ticks are this cheap, which is what makes the average constant even though a single tick can evict ${Math.max(...MAXR.trace.map(t => t.evicted.length))}.` },

  { t: `index ${FRONT.dropped} has left the window — dropped from the front`, line: at('if (front(dq) <= i - W) { dropFront(dq) }'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: `${Math.max(0, FRONT.i - W + 1)} answers`, i: FRONT.i }), EX({ i: FRONT.i })],
    heap: [{ key: 'maxq', st: dqStr(FRONT.dq), hot: true }],
    cap: `At tick ${FRONT.i} the window covers indexes ${FRONT.i - W + 1}..${FRONT.i}, and index ${FRONT.dropped} is older than that, so it goes. **At most one can expire per tick**, because the window moves by one — so this is an \`if\` and not a loop, and a candidate who writes a loop here has not lost correctness but has lost the argument for why the cost is constant.` },

  { t: `the answer is the front: one read`, line: at('if (i >= W - 1) { out.append(xs[front(dq)]) }'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads` }), SM({ out: `[${MAXR.out.slice(0, 1).join(', ')}]`, i: FIRST.i })],
    heap: [{ key: 'maxq', st: dqStr(FIRST.dq), hot: true }],
    cap: `The first ${W - 1} ticks produce no answer — the window is not full — and from tick ${W - 1} the maximum is \`xs[front(dq)]\` = ${FIRST.max}, matching the scan's ${BRUTE[0].max}. Forgetting the warm-up is the standard off-by-one: the loop must still push and expire during it, and only the emitting is withheld.` },

  { t: `${MAXR.ops} steps against ${BRUTE_OPS} reads`, line: at('fun slideMax(xs)::return out'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads`, fast: `[${MAXR.out.join(', ')}]` }), SM({ out: `[${MAXR.out.join(', ')}]`, i: N })],
    heap: [{ key: 'maxq' }, { key: 'ticks' }],
    cap: `[${MAXR.out.join(', ')}] — asserted equal to the scan, window by window. The cost: ${MAXR.pushes} pushes, ${MAXR.pops} back-evictions, ${MAXR.fronts} front-expiries = ${MAXR.ops} steps. **Each index is pushed exactly once and removed at most once**, which caps the total at 2${N} however the values are arranged — so the per-tick cost is amortised constant and does not depend on W at all. At W = ${BIGW.toLocaleString('en-US')} that is the difference between 2 steps a tick and ${BIGW.toLocaleString('en-US')}.` },

  { t: `the second half: a second list, kept INCREASING`, line: at('evictLarger(lo, xs, i)'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads`, fast: `[${MAXR.out.join(', ')}]` }), SS({ out: `${O1.at - W + 1} answers`, i: O1.at })],
    heap: [{ key: 'maxq', st: dqStr(O1.hi), hot: true }, { key: 'minq', st: dqStr(O1.lo), hot: true }],
    cap: `The minimum is the same problem with every comparison reversed, so 0x300 is kept increasing and its front is the smallest. The two lists are advanced **together** on each tick and never consulted about each other — the spread is just \`front(hi) − front(lo)\`, here ${O1.max} − ${O1.min} = ${O1.spread}.` },

  { t: `${OVER.length} of ${BOTH.length} windows exceed ${L}`, line: at('out.append(xs[front(hi)] - xs[front(lo)])'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads`, fast: `[${MAXR.out.join(', ')}]`, spread: `[${BOTH.map(b => b.spread).join(', ')}]` }), SS({ out: `[${BOTH.map(b => b.spread).join(', ')}]`, i: N })],
    heap: [{ key: 'maxq' }, { key: 'minq' }],
    cap: `Spreads [${BOTH.map(b => b.spread).join(', ')}]: ${OVER.length} over ${L} and ${UNDER.length} under, so the test discriminates rather than firing always or never. Both minima are asserted against the brute-force scan too — a second deque with one comparison left un-reversed is the easiest possible bug and it produces plausible numbers.` },

  { t: 'and what the two lists cost', line: at('val spread = slideSpread(TICKS)'),
    stack: [MAIN({ slow: `${BRUTE_OPS} reads`, fast: `[${MAXR.out.join(', ')}]`, spread: `[${BOTH.map(b => b.spread).join(', ')}]` })],
    heap: [{ key: 'ticks' }, { key: 'maxq' }, { key: 'minq' }],
    cap: `Twice the work of one list and still amortised constant per tick, with memory bounded by W rather than by the tick count. The limit worth naming: this answers **max and min** and nothing else. A median or a 99th percentile over a sliding window has no such trick, because no value can be ruled out by a single comparison with a newer one — which is exactly the property the eviction argument depends on, and the reason the same shape does not generalise to any statistic you like.` },
];

const r = buildInterviewSection({
  name: 'ch03-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch03-interview-memory'),
  gen: 'gen_ch03_interview.js',
  title: 'The largest of the last W — stack and heap at every step',
  subtitle: `${N} ticks, W = ${W} · scan ${BRUTE_OPS} reads vs ${MAXR.ops} steps · ${OVER.length} of ${BOTH.length} windows span more than ${L}`,
  problem: {
    surface: 'trading',
    statement: [`**A risk screen shows the highest value among the last \`W\` ticks, and must update on every tick.**`, '',
      `Millions of ticks a day and \`W\` up to 10⁵. **You may not re-read the window on each tick.**`, '',
      `Then: the screen must also warn when the last \`W\` ticks **span more than \`L\`** — highest minus lowest.`],
    example: [`\`${xStr()}\` with W = ${W} → maxima [${MAXR.out.join(', ')}]; ${OVER.length} of the ${BOTH.length} windows span more than ${L}.`],
    constraints: [`Values rise and fall. Memory may be proportional to \`W\`, not to the number of ticks.`],
  },
  model: [
    `Re-reading the window is O(W) per tick — 10⁵ reads a tick, 10¹² in a day. The next thought is a max-heap of the window, and it fails on the operation nobody looks at first: **each tick, the value leaving the window must be removed**, and a heap can only remove its top. The departing value is almost never the top. Most attempts stall here.`, '',
    `The reframe is to stop storing the window and store only the values that **could still become the maximum**. Keep a list of **indexes** — indexes, not values, because only an index says whether an entry has expired — and keep it **decreasing**, so its front is the maximum and the answer is one read.`, '',
    `Maintaining it needs one argument, and it is the whole problem: when a value arrives, **anything at the back that is no larger can be discarded**, because the newcomer is both bigger *and* newer. For as long as either is in the window the newcomer is too, and it is always the larger — so the smaller one can never be the maximum again. Not unlikely to matter: provably dead.`, '',
    `Two consequences follow. The list holds exactly the window's **suffix maxima**, so nothing has to be recomputed when the front expires — the next entry is already the right answer. And **at most one entry can expire per tick**, because the window moves by one, so that step is an \`if\` rather than a loop.`, '',
    `The cost argument is worth stating precisely, because "O(1)" is not quite true. A single tick can evict many entries. But **each index is pushed exactly once and removed at most once**, so the total over \`n\` ticks is bounded by 2\`n\` regardless of the values — amortised constant per tick, and **independent of W entirely**.`, '',
    `The second half is the same machine with every comparison reversed: a second list kept *increasing* gives the minimum, the two are advanced together, and the spread is the difference of the two fronts. The limit is worth naming too: this works for max and min and **nothing else**. A sliding median has no equivalent, because no value can be ruled out by a single comparison with a newer one — which is precisely the property the eviction argument rests on.`,
  ],
  variations: [
    { name: 'the shortest spike', surface: 'load testing',
      statement: [`Given a stream of request counts, **find the shortest run whose total reaches at least \`K\`**. Counts may be zero.`],
      whyHard: `The window is no longer a fixed size, so nothing above applies directly — and the useful move is to change what is stored. Replace the counts by their running totals and the question becomes: for each position, the **nearest earlier total** that is at least \`K\` below it. That is answerable with a list kept *increasing*, where a later total that is no larger than the back makes the back useless — because the later one is both smaller and closer, so it would always give a shorter run. Identical eviction argument, different ordering, different quantity. The giveaway that it generalises is "both better AND newer".`,
      maps: `\`evictSmaller\` with the comparison reversed and applied to running totals rather than values, and no fixed \`W\` — so \`expire\` disappears entirely.` },

    { name: 'the next warmer day', surface: 'weather',
      statement: [`Given daily temperatures, for each day report **how many days until the next warmer one**, or zero if none.`],
      whyHard: `There is no window at all here, which is what makes it worth putting beside the others: \`expire\` is gone and only the eviction remains. Keep the days whose answer is still unknown; when a warmer day arrives, it is the answer for every unresolved day cooler than it, so they are all resolved and removed at once. Each day enters once and leaves once, so it is linear even though one day can resolve many. The trap is reaching for the sliding-window machinery and looking for a window size that is not there — the shared idea is the eviction, not the window.`,
      maps: `\`evictSmaller\` almost verbatim, with the evicted entries producing answers rather than being discarded, and \`expire\` deleted.` },

    { name: 'the longest steady stretch', surface: 'manufacturing',
      statement: [`A sensor logs a measurement a second. **Find the longest run in which the highest and lowest differ by at most \`L\`.**`],
      whyHard: `This is the two-list version with the window size turned into the answer rather than an input, and that inversion is the exercise: instead of a fixed \`W\`, grow the right edge while the spread fits and advance the left edge when it does not. Both lists must then expire from the front by **position**, not by a fixed offset — and the subtle part is that advancing the left edge may expire from one list, both, or neither, so the expiry condition has to be checked against the actual left edge rather than against \`i − W\`. Getting that wrong gives a stale front and a spread that is too small, which reads as a longer steady stretch than really occurred.`,
      maps: `\`slideSpread\` with \`expire\` taking the left edge as an argument instead of \`i − W\`, and the emit replaced by a running best length.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch03-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is six paragraphs; this is both answers running, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured on ${xStr()} with W = ${W}: the scan costs **${BRUTE_OPS} reads** (${NWIN} windows × ${W}); the deque costs **${MAXR.ops} steps** — ${MAXR.pushes} pushes, ${MAXR.pops} back-evictions, ${MAXR.fronts} front-expiries — and returns the same maxima, asserted window by window. One tick evicts **${BIGEV.evicted.length}** entries at once and another evicts none, which is the amortised argument happening rather than being claimed. The two-list version gives spreads [${BOTH.map(b => b.spread).join(', ')}], of which ${OVER.length} exceed ${L}.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x200 and 0x300 hold **indexes** rather than values, which is what lets an entry be recognised as expired, and neither ever exceeds ${W} entries. Every figure is derived from \`tools/stream_seed.js\` and asserted — including that the values are NOT monotonic (or nothing is ever evicted and the whole idea is invisible), that the deque agrees with the brute-force scan for both the maxima and the minima, that at least one tick evicts two or more, that at least one tick evicts none, that something really does expire from the front, and that some windows exceed L while others do not. **Scope note:** this is the one section whose problem reaches past its chapter's existing program, at the user's explicit direction — the chapter's watermark is an unbounded running maximum, which one corrupt future timestamp raises permanently, and bounding it to the last W events is both the fix and this problem. Generated by \`node tools/gen_ch03_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch03-interview-memory`);
console.log(`    W=${W} · maxima [${MAXR.out.join(',')}] · scan ${BRUTE_OPS} vs ${MAXR.ops} (${MAXR.pushes}p/${MAXR.pops}e/${MAXR.fronts}f) · biggest evict ${BIGEV.evicted.length} · spreads [${BOTH.map(b => b.spread).join(',')}], ${OVER.length} over ${L}`);
