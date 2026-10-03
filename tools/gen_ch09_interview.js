#!/usr/bin/env node
'use strict';
/*
 * gen_ch09_interview.js — ch09's interview problem: every overlap between two sorted lists
 * of non-overlapping intervals, and what you may throw away when both lists are streams.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — the overlap of two intervals, the rule that decides which side to advance, the
 * O(m+n) sweep against the O(mn) pair check, and the bound below which an interval can be
 * discarded. No join semantics beyond overlap, no retractions, no chapter vocabulary.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

const J = 60;
const sessionsOf = (key, gap) => { const ts = S.EVENTS.filter(e => e.key === key).map(e => e.et).sort((a, b) => a - b);
  const out = []; for (const t of ts) { const last = out[out.length - 1];
    if (last && t - last[1] <= gap) last[1] = t; else out.push([t, t]); } return out; };
const mergeSpans = (spans) => { const s = [...spans].sort((a, b) => a[0] - b[0]); const out = [];
  for (const sp of s) { const last = out[out.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]); else out.push([...sp]); } return out; };

const A = sessionsOf('a', S.GAP);
const B = mergeSpans(S.EVENTS.filter(e => e.key === 'b').map(e => [e.et, e.et + J]));
const M = A.length, NB = B.length;

const overlap = (x, y) => { const lo = Math.max(x[0], y[0]), hi = Math.min(x[1], y[1]); return hi >= lo ? [lo, hi] : null; };
const CROSS = []; let CROSS_CMP = 0;
for (const x of A) for (const y of B) { CROSS_CMP++; const o = overlap(x, y); if (o) CROSS.push(o); }

const sweep = () => { let i = 0, j = 0; const out = []; const trace = []; let cmp = 0;
  while (i < M && j < NB) { cmp++; const o = overlap(A[i], B[j]);
    const advance = A[i][1] < B[j][1] ? 'left' : 'right';
    trace.push({ i, j, a: A[i], b: B[j], o, advance });
    if (o) out.push(o);
    if (advance === 'left') i++; else j++; }
  return { out, trace, cmp }; };
const SW = sweep();

// what may be discarded once you know nothing from the other side can be older than `bound`
const bound = B[NB - 1][0];
const DROPPABLE = A.filter(x => x[1] < bound);
const KEPT = A.filter(x => x[1] >= bound);

const BIGM = 1000000;

const fail = (m) => { throw new Error(`gen_ch09_interview: ${m}`); };
if (M < 3 || NB < 2) fail(`${M} and ${NB} intervals; too few to exercise the advance rule in both directions`);
if (SW.out.map(o => o.join('-')).join() !== CROSS.map(o => o.join('-')).join()) fail('the sweep and the pair check disagree');
if (SW.out.length < 2) fail(`only ${SW.out.length} overlap; at least 2 are needed for the advance rule to matter`);
if (!SW.trace.some(t => t.advance === 'left') || !SW.trace.some(t => t.advance === 'right')) fail('the sweep only ever advances one side, so half the rule is never exercised');
if (!SW.trace.some(t => !t.o)) fail('every pair the sweep compares overlaps, so the no-overlap branch is never shown');
if (!(SW.cmp < CROSS_CMP)) fail(`the sweep made ${SW.cmp} comparisons and the pair check ${CROSS_CMP}; the sweep must make fewer`);
if (!DROPPABLE.length) fail('nothing can be discarded, so the state-growth frame has no worked case');
if (!KEPT.length) fail('everything can be discarded');
if (A.some((x, k) => k > 0 && x[0] <= A[k - 1][1])) fail('the left list overlaps itself');
if (B.some((y, k) => k > 0 && y[0] <= B[k - 1][1])) fail('the right list overlaps itself');

const iv = (x) => `${x[0]}..${x[1]}`;
const lStr = () => A.map(iv).join('  ');
const rStr = () => B.map(iv).join('  ');
const oStr = (n) => `[${(n === undefined ? SW.out : SW.out.slice(0, n)).map(iv).join(', ')}]`;
const HIT = SW.trace.find(t => t.o);
const MISS = SW.trace.find(t => !t.o);
const ADVL = SW.trace.find(t => t.advance === 'left');
const ADVR = SW.trace.find(t => t.advance === 'right');

const SRC = [
  `// primitive: len(xs) — element count.  len(LEFT) = ${M}   ·   len(RIGHT) = ${NB}`,
  '// primitive: LEFT / RIGHT — two lists of spans, each sorted and none overlapping its',
  '//   own neighbours. Written start..end.',
  `//   LEFT  = ${lStr()}`,
  `//   RIGHT = ${rStr()}`,
  '// primitive: startOf(x) / endOf(x) — the two ends of a span.',
  `//   startOf(${iv(A[0])}) = ${A[0][0]}   ·   endOf(${iv(A[0])}) = ${A[0][1]}`,
  '// primitive: maxOf(a, b) / minOf(a, b) — the larger and smaller of two numbers.',
  `//   maxOf(${HIT.a[0]}, ${HIT.b[0]}) = ${Math.max(HIT.a[0], HIT.b[0])}   ·   minOf(${HIT.a[1]}, ${HIT.b[1]}) = ${Math.min(HIT.a[1], HIT.b[1])}`,
  '// primitive: span(lo, hi) — one overlap.  span(1, 3) = 1..3',
  '// primitive: NONE — these two spans do not overlap at all.',
  '',
  '// THE QUESTION, as asked:',
  '//   "Two sorted lists of time spans. Within a list, spans never overlap each other.',
  '//    Report every overlap between a LEFT span and a RIGHT one. 10^6 spans each. Then:',
  '//    both lists are streams that keep arriving — what may you throw away?"',
  '',
  '// function: overlapOf(x, y) — the overlap, or NONE. Two lines, and they are the only',
  '//   geometry in the problem: it starts at the later start and ends at the earlier end.',
  `//   overlapOf(${iv(HIT.a)}, ${iv(HIT.b)}) = ${iv(HIT.o)}   ·   overlapOf(${iv(MISS.a)}, ${iv(MISS.b)}) = NONE`,
  'fun overlapOf(x, y) {',
  '    val lo = maxOf(startOf(x), startOf(y))',
  '    val hi = minOf(endOf(x), endOf(y))',
  '    if (hi < lo) { return NONE }',
  '    return span(lo, hi)',
  '}',
  '',
  '// function: everyPair(left, right) — the answer everyone gives first: try all of them.',
  `//   everyPair(LEFT, RIGHT) = ${oStr()} after ${CROSS_CMP} comparisons`,
  'fun everyPair(left, right) {',
  '    var out = []',
  '    for (x in left) {',
  '        for (y in right) {',
  '            val o = overlapOf(x, y)',
  '            if (o != NONE) { out.append(o) }',
  '        }',
  '    }',
  '    return out',
  '}',
  '',
  '// function: sweep(left, right) — one pointer into each list. After testing a pair,',
  '//   advance whichever span ENDS FIRST: it cannot overlap anything further along the',
  '//   other list, because that list is sorted and its spans only start later.',
  `//   sweep(LEFT, RIGHT) = ${oStr()} after ${SW.cmp} comparisons`,
  'fun sweep(left, right) {',
  '    var out = []',
  '    var i = 0',
  '    var j = 0',
  '    while (i < len(left)) {',
  '        if (j == len(right)) { return out }',
  '        val o = overlapOf(left[i], right[j])',
  '        if (o != NONE) { out.append(o) }',
  '        if (endOf(left[i]) < endOf(right[j])) { i = i + 1 }',
  '        else { j = j + 1 }',
  '    }',
  '    return out',
  '}',
  '',
  '// function: droppable(left, bound) — spans that can be forgotten, because nothing still',
  '//   to arrive on the other side can start before `bound`.',
  `//   droppable(LEFT, ${bound}) = ${DROPPABLE.map(iv).join(', ')}   ·   kept: ${KEPT.map(iv).join(', ')}`,
  'fun droppable(left, bound) {',
  '    var gone = []',
  '    for (x in left) {',
  '        if (endOf(x) < bound) { gone.append(x) }',
  '    }',
  '    return gone',
  '}',
  '',
  '// function: main() — every pair, then the sweep, then what may be discarded.',
  'fun main() {',
  `    val slow = everyPair(LEFT, RIGHT)     // ${CROSS_CMP} comparisons`,
  `    val fast = sweep(LEFT, RIGHT)         // ${SW.cmp} comparisons, same ${SW.out.length} overlaps`,
  `    val gone = droppable(LEFT, ${bound})       // ${DROPPABLE.length} of ${M} spans`,
  '}',
];

const HEAP = {
  left:  { addr: '0x100', type: `span[${M}]`, val: () => lStr() },
  right: { addr: '0x200', type: `span[${NB}]`, val: () => rStr() },
  out:   { addr: '0x300', type: 'span[]', val: (st) => st === undefined ? oStr() : st },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `slow = ${o.slow === undefined ? '...' : o.slow}`,
  `fast = ${o.fast === undefined ? '...' : o.fast}`,
  `gone = ${o.gone === undefined ? '...' : o.gone}`] });
const EP = (o = {}) => ({ name: 'everyPair', locals: [
  'left = @0x100', 'right = @0x200', `out = ${o.out}`,
  `x = ${o.x}`, `y = ${o.y}`, `o = ${o.o}`] });
const SWF = (o = {}) => ({ name: 'sweep', locals: [
  'left = @0x100', 'right = @0x200', `out = ${o.out}`,
  `i = ${o.i}`, `j = ${o.j}`, `o = ${o.o}`] });
const OV = (o = {}) => ({ name: 'overlapOf', locals: [
  `x = ${iv(o.x)}`, `y = ${iv(o.y)}`, `lo = ${o.lo}`, `hi = ${o.hi}`] });
const DR = (o = {}) => ({ name: 'droppable', locals: [
  'left = @0x100', `bound = ${bound}`, `gone = ${o.gone}`, `x = ${o.x}`] });

const HI = SW.trace.indexOf(HIT), MI = SW.trace.indexOf(MISS);
const outAt = (k) => oStr(SW.trace.slice(0, k).filter(t => t.o).length);

const steps = (at) => [
  { t: `${M} spans against ${NB}, both sorted`, line: at('val slow = everyPair(LEFT, RIGHT)'),
    stack: [MAIN()], heap: [{ key: 'left' }, { key: 'right' }],
    cap: `0x100 holds ${lStr()} and 0x200 holds ${rStr()}. Two facts are handed to you and both matter: each list is **sorted**, and within a list the spans **never overlap each other**. The second is what makes the advance rule below sound, and it is easy to read past as scene-setting.` },

  { t: 'the overlap is two comparisons', line: at('val hi = minOf(endOf(x), endOf(y))'),
    stack: [MAIN(), EP({ out: '[]', x: iv(HIT.a), y: iv(HIT.b), o: '...' }), OV({ x: HIT.a, y: HIT.b, lo: Math.max(HIT.a[0], HIT.b[0]), hi: Math.min(HIT.a[1], HIT.b[1]) })],
    heap: [{ key: 'left', hot: true }, { key: 'right', hot: true }],
    cap: `${iv(HIT.a)} and ${iv(HIT.b)} overlap on ${iv(HIT.o)}: it starts at the **later** start and ends at the **earlier** end. If that comes out backwards — hi below lo — there is no overlap, so one comparison answers both "do they" and "where". Getting this expression right first removes most of the fiddliness from the rest.` },

  { t: `every pair: ${CROSS_CMP} comparisons`, line: at('fun everyPair(left, right)::if (o != NONE) { out.append(o) }'),
    stack: [MAIN(), EP({ out: oStr(), x: iv(A[M - 1]), y: iv(B[NB - 1]), o: 'NONE' })],
    heap: [{ key: 'out', st: oStr(), hot: true }],
    cap: `${M} × ${NB} = ${CROSS_CMP} comparisons for ${SW.out.length} overlaps. Correct, and quadratic — at 10⁶ spans each that is 10¹² comparisons, so it is not slow, it is impossible. And the sortedness has not been used at all.` },

  { t: 'the reframe: one pointer into each', line: at('fun sweep(left, right)::var i = 0'),
    stack: [MAIN({ slow: oStr() }), SWF({ out: '[]', i: 0, j: 0, o: '...' })],
    heap: [{ key: 'left' }, { key: 'right' }],
    cap: `Two cursors, both at the front. Because each list is sorted, everything after cursor \`i\` starts no earlier than \`left[i]\` — so the lists can be walked forward once and never revisited. The only question is which cursor to move.` },

  { t: `${iv(ADVL.a)} ends before ${iv(ADVL.b)}, so LEFT advances`, line: at('if (endOf(left[i]) < endOf(right[j])) { i = i + 1 }'),
    stack: [MAIN({ slow: oStr() }), SWF({ out: outAt(SW.trace.indexOf(ADVL)), i: ADVL.i, j: ADVL.j, o: ADVL.o ? iv(ADVL.o) : 'NONE' })],
    heap: [{ key: 'left', hot: true }, { key: 'right' }],
    cap: `**Advance whichever span ends first.** ${iv(ADVL.a)} ends at ${ADVL.a[1]}, before ${iv(ADVL.b)} ends at ${ADVL.b[1]} — and every later RIGHT span starts after ${ADVL.b[0]}, so none of them can reach back to ${ADVL.a[1]}. ${iv(ADVL.a)} is finished with, permanently, and the non-overlapping guarantee is exactly what licenses that.` },

  { t: `and here ${iv(ADVR.b)} ends first, so RIGHT advances`, line: at('else { j = j + 1 }'),
    stack: [MAIN({ slow: oStr() }), SWF({ out: outAt(SW.trace.indexOf(ADVR)), i: ADVR.i, j: ADVR.j, o: ADVR.o ? iv(ADVR.o) : 'NONE' })],
    heap: [{ key: 'left' }, { key: 'right', hot: true }],
    cap: `The rule is symmetric and must be, which is the part to get right: advancing the one that **starts** first, or always advancing left, skips overlaps. ${iv(ADVR.a)} is still live and will be compared against the next RIGHT span — so a single LEFT span can produce several overlaps, and the loop does not assume one each.` },

  { t: `overlap ${SW.out.length > 1 ? SW.out.length : 1}: ${iv(SW.out[SW.out.length - 1])}`, line: at('fun sweep(left, right)::if (o != NONE) { out.append(o) }'),
    stack: [MAIN({ slow: oStr() }), SWF({ out: oStr(), i: SW.trace[SW.trace.length - 1].i, j: SW.trace[SW.trace.length - 1].j, o: iv(SW.out[SW.out.length - 1]) })],
    heap: [{ key: 'out', st: oStr(), hot: true }],
    cap: `${oStr()} — the same ${SW.out.length} overlaps the pair check found, asserted span for span. Note ${iv(SW.trace.filter(t => t.o).length > 1 ? SW.trace.filter(t => t.o)[0].a : A[0])} appears in ${SW.trace.filter(t => t.o && t.a === SW.trace.filter(x => x.o)[0].a).length} of them, which is why the advance rule may not assume one overlap per span.` },

  { t: `a pair that does not overlap at all`, line: at('if (hi < lo) { return NONE }'),
    stack: [MAIN({ slow: oStr() }), SWF({ out: outAt(MI), i: MISS.i, j: MISS.j, o: 'NONE' }), OV({ x: MISS.a, y: MISS.b, lo: Math.max(MISS.a[0], MISS.b[0]), hi: Math.min(MISS.a[1], MISS.b[1]) })],
    heap: [{ key: 'left', hot: true }, { key: 'right', hot: true }],
    cap: `${iv(MISS.a)} and ${iv(MISS.b)} give lo = ${Math.max(MISS.a[0], MISS.b[0])} and hi = ${Math.min(MISS.a[1], MISS.b[1])}, so hi is below lo and there is nothing. The pair is still **compared**, which is the cost of the sweep: ${SW.cmp} comparisons, one per advance, and some of them find nothing.` },

  { t: `${SW.cmp} comparisons against ${CROSS_CMP}`, line: at('fun sweep(left, right)::return out'),
    stack: [MAIN({ slow: oStr(), fast: oStr() })],
    heap: [{ key: 'out' }],
    cap: `${SW.cmp} against ${CROSS_CMP} here — small lists, small margin. The shape is what matters: each comparison advances exactly one cursor, so the total is at most ${M} + ${NB}, and at 10⁶ spans each that is 2 × 10⁶ comparisons instead of 10¹². O(m+n) rather than O(mn), and no sorting needed because both inputs arrived sorted.` },

  { t: `now the second half: both lists are streams`, line: at('val gone = droppable(LEFT, '),
    stack: [MAIN({ slow: oStr(), fast: oStr() }), DR({ gone: '[]', x: iv(A[0]) })],
    heap: [{ key: 'left', hot: true }],
    cap: `The sweep assumed both lists were complete. As streams they are not, and a LEFT span cannot be released the moment the cursor passes it — a RIGHT span that overlaps it may not have arrived yet. So "finished with" becomes a claim about the **future**, which the sweep had no need to make.` },

  { t: `${DROPPABLE.length} of ${M} spans may be forgotten`, line: at('if (endOf(x) < bound) { gone.append(x) }'),
    stack: [MAIN({ slow: oStr(), fast: oStr() }), DR({ gone: `[${DROPPABLE.map(iv).join(', ')}]`, x: iv(A[M - 1]) })],
    heap: [{ key: 'left', hot: true }],
    cap: `Given a promise that nothing further from the RIGHT stream will start before ${bound}, every LEFT span ending before ${bound} is safe to drop: ${DROPPABLE.map(iv).join(' and ')}. ${KEPT.map(iv).join(' and ')} must be kept. Without such a promise **nothing** can be dropped, and the state grows for as long as the system runs — which is the real answer to "what may you throw away".` },

  { t: 'so the bound is the whole design', line: at('fun droppable(left, bound)::return gone'),
    stack: [MAIN({ slow: oStr(), fast: oStr(), gone: `${DROPPABLE.length} spans` })],
    heap: [{ key: 'left' }, { key: 'right' }, { key: 'out' }],
    cap: `Where does ${bound} come from? Not from the algorithm — from a declared limit on how far behind a stream may be, and it has to be the **minimum** over both sides, because one silent stream means nothing can be released from either. That makes memory a function of the declared lateness bound rather than of the data, and it means a stream that stops arriving stalls the join rather than breaking it. Naming that bound is the answer; the two-pointer sweep is the easy half.` },
];

const r = buildInterviewSection({
  name: 'ch09-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch09-interview-memory'),
  gen: 'gen_ch09_interview.js',
  title: 'Every overlap between two sorted lists — stack and heap at every step',
  subtitle: `${M} vs ${NB} spans → ${SW.out.length} overlaps · ${CROSS_CMP} comparisons vs ${SW.cmp} · ${DROPPABLE.length} of ${M} droppable`,
  problem: {
    surface: 'shift rosters',
    statement: [`**Two sorted lists of time spans.** Within a list, spans never overlap each other.`, '',
      `**Report every overlap between a span in the first list and a span in the second.**`, '',
      `10⁶ spans in each. Then: **both lists are streams that keep arriving — what may you throw away?**`],
    example: [`\`${lStr()}\` against \`${rStr()}\` → ${oStr()}.`],
    constraints: [`Spans are closed intervals of integers. The lists arrive already sorted.`],
  },
  model: [
    `Start with the geometry, because getting it right removes most of the fiddliness: two spans overlap on **the later start to the earlier end**, and if that comes out backwards they do not overlap at all. One expression answers both questions.`, '',
    `Then the cost. Trying all pairs is ${CROSS_CMP} comparisons here and 10¹² at the stated size — not slow, impossible — and it uses neither of the two facts the question handed you.`, '',
    `The reframe uses both: one cursor into each list, and **advance whichever span ends first.** That span cannot overlap anything further along the other list, because the other list is sorted *and its spans do not overlap each other*, so everything remaining there starts later than the one just compared. Each comparison retires exactly one span, so the total is at most m + n.`, '',
    `Two things to get right. The rule is **symmetric** — advancing by start, or always advancing the left, skips overlaps. And a single span can produce **several** overlaps, so the loop must not assume one each.`, '',
    `The second half is a different question wearing the same clothes. The sweep assumed both lists were finished. As streams they are not: a span the cursor has passed cannot be released, because something overlapping it may not have arrived. So "finished with" becomes a claim about the future, and it needs a **declared bound on how late a stream may be** — below which nothing new can start. With that bound, ${DROPPABLE.length} of these ${M} spans are safe to forget; without it, **nothing is**, and state grows for as long as the system runs.`, '',
    `And the bound must be the **minimum over both sides**, because one silent stream means nothing can be released from either. That makes memory a function of the declared lateness rather than of the data, and makes a stalled stream stall the join rather than corrupt it. Naming the bound is the answer; the sweep is the easy half.`,
  ],
  variations: [
    { name: 'the double-booked room', surface: 'facilities',
      statement: [`One list this time: bookings for a room. **Find every pair that overlaps**, and report the busiest moment.`],
      whyHard: `Self-overlap removes the guarantee the sweep depended on — within one list spans may now overlap, so "ends first means finished" is false and the two-pointer rule does not apply. The move is to stop thinking in spans and think in **events**: each span becomes a start and an end, all sorted together, and a running count rises and falls. The busiest moment is the count's maximum, and an overlap exists wherever it exceeds one. Recognising that the span-pair framing was the obstacle, not the solution, is the content — and the event sweep handles the chapter's problem too, less efficiently.`,
      maps: `Neither \`sweep\` nor \`overlapOf\` survives; what carries over is the idea of walking a sorted sequence once. This is the case the chapter's program cannot do.` },

    { name: 'the attributed click', surface: 'advertising',
      statement: [`Clicks and impressions arrive on two streams. **Match each click to the impression that preceded it by at most \`W\` seconds**, and to the nearest one if several qualify.`],
      whyHard: `Both halves of the chapter's problem are here and a third thing is added: the match is **asymmetric and one-to-one**, so an impression already matched must not match again, and "nearest" means a click cannot be answered until it is certain no closer impression is still in flight. That turns a stateless sweep into a wait, and the wait's length is exactly the lateness bound from the model above — so the bound stops being an optimisation and becomes a correctness requirement. The useful observation is that \`W\` and the lateness bound are different numbers that are easy to conflate.`,
      maps: `\`droppable\` with \`bound\` derived from \`W\` plus the lateness allowance, and \`overlapOf\` replaced by a nearest-preceding test with a one-to-one constraint.` },

    { name: 'the unavailable hours', surface: 'scheduling',
      statement: [`Given one person's busy spans, **report their free spans** between a start and an end.`],
      whyHard: `The complement rather than the intersection, and it is almost all boundary conditions: before the first busy span, between consecutive ones, after the last, and the empty cases where someone is busy throughout or not at all. There is no clever idea and that is the point — a candidate who finds the two-pointer sweep elegant and then fumbles this is showing something more relevant than cleverness, because the gap-between-consecutive pattern is the one that actually appears in working code, and off-by-one at the ends is where it breaks.`,
      maps: `One pass over \`LEFT\` emitting the gaps, with \`overlapOf\` unused. The same sorted, non-overlapping guarantee is what makes the single pass sufficient.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch09-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is six paragraphs; this is both answers running and then the streaming question measured, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured on ${lStr()} against ${rStr()}: trying every pair costs **${CROSS_CMP} comparisons**, the sweep costs **${SW.cmp}**, and both return the same ${SW.out.length} overlaps — ${oStr()} — asserted span for span. Both directions of the advance rule are exercised and so is a pair that does not overlap at all. Given a bound of ${bound} on how late the right-hand stream may be, **${DROPPABLE.length} of the ${M} left spans become droppable** and ${KEPT.length} must be kept.`],
    sub: `Locals live in the frame and vanish when it is popped; the two cursors are the whole state, which is why the sweep is O(m+n) in time and O(1) in space — and why the streaming half is hard, because a stream cannot drop what it has passed. Every figure is derived from \`tools/stream_seed.js\` and asserted — including that neither list overlaps itself (the guarantee the advance rule rests on), that the sweep and the pair check agree exactly, that the sweep advances each side at least once, that at least one compared pair does NOT overlap, that the sweep makes fewer comparisons, and that something is droppable while something else is not. Generated by \`node tools/gen_ch09_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch09-interview-memory`);
console.log(`    LEFT ${lStr()} | RIGHT ${rStr()} -> ${oStr()} · ${CROSS_CMP} vs ${SW.cmp} cmp · droppable ${DROPPABLE.length}/${M} at bound ${bound}`);
