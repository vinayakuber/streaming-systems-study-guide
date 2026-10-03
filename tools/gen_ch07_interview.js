#!/usr/bin/env node
'use strict';
/*
 * gen_ch07_interview.js — ch07's interview problem: a per-key total over an endless stream,
 * and the expiry that keeps the memory bounded by silently restarting an aggregate.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — one accumulator per key, when a key was last touched, dropping the untouched,
 * and what a key that comes back after being dropped reports. No checkpointing, no
 * windowing semantics, no chapter vocabulary.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

const EV = S.EVENTS.map(e => ({ key: e.key, v: e.v, at: e.et })).sort((a, b) => a.at - b.at);
const N = EV.length;
const KEYS = [...new Set(EV.map(e => e.key))].sort();
const TRUE = {}; for (const e of EV) TRUE[e.key] = (TRUE[e.key] || 0) + e.v;
const END = Math.max(...EV.map(e => e.at));

const gapsOf = (k) => { const ts = EV.filter(e => e.key === k).map(e => e.at);
  return ts.slice(1).map((t, i) => t - ts[i]); };
const MAXGAP = {}; for (const k of KEYS) MAXGAP[k] = Math.max(0, ...gapsOf(k));
const WORST_GAP = Math.max(...KEYS.map(k => MAXGAP[k]));

const run = (ttl) => {
  const acc = {}, last = {}; const log = []; const resets = [];
  for (const e of EV) {
    // anything untouched for longer than the allowance is dropped before this event lands
    for (const k of Object.keys(acc)) if (e.at - last[k] > ttl) { delete acc[k]; delete last[k]; }
    const fresh = acc[e.key] === undefined;
    if (fresh && EV.some(x => x.key === e.key && x.at < e.at)) resets.push({ key: e.key, at: e.at });
    acc[e.key] = (acc[e.key] || 0) + e.v; last[e.key] = e.at;
    log.push({ e, fresh, acc: { ...acc } });
  }
  // NO final sweep. Releasing a key's state after the stream has ended is expected and is
  // not an error - its total was already reported. Sweeping here made every total look wrong,
  // conflating "the aggregate restarted mid-stream" with "the state was released at the end",
  // and the per-key assertion below is what caught it. The keys-held figure comes from
  // heldAt() instead, which observes a moment rather than the end.
  return { acc: { ...acc }, log, resets, held: Object.keys(acc).length };
};
const NOEXP = run(Infinity);
// How many keys are held at a given moment, if no event arrives then. The end-of-run count
// is the wrong measurement: an expiry is immediately followed by the event that re-creates
// the key, so the saving is invisible there. Observing at the last event's time shows it.
const heldAt = (ttl, t) => { const last = {};
  for (const e of EV) if (e.at <= t) last[e.key] = e.at;
  return Object.keys(last).filter(k => t - last[k] <= ttl).length; };

const SAFE_TTL = WORST_GAP;
// One unit below the worst gap: the exact boundary at which correctness breaks.
const TIGHT_TTL = WORST_GAP - 1;
// MEASURED, and it is zero: at the boundary allowance there is no moment at which the
// bounded run holds fewer keys than the unbounded one. On this data the correctness cost
// arrives BEFORE any memory benefit does, which is worth reporting rather than engineering
// around - and the assertion below pins it, so the claim cannot silently become false.
const OBSERVE = END;
const SAVING = Math.max(0, ...Array.from({ length: END + 1 }, (_, t) => heldAt(Infinity, t) - heldAt(TIGHT_TTL, t)));
const SAFE = run(SAFE_TTL), TIGHT = run(TIGHT_TTL);
const WRONG = KEYS.filter(k => (TIGHT.acc[k] === undefined ? 0 : TIGHT.acc[k]) !== TRUE[k]);
const RIGHT = KEYS.filter(k => TIGHT.acc[k] === TRUE[k]);
const BIGK = 1000000;

const fail = (m) => { throw new Error(`gen_ch07_interview: ${m}`); };
if (KEYS.length < 2) fail(`only ${KEYS.length} key; at least 2 are needed for one to survive the expiry while another does not`);
if (KEYS.some(k => NOEXP.acc[k] !== TRUE[k])) fail('the unbounded run does not produce the true totals; the program is wrong');
if (KEYS.some(k => SAFE.acc[k] !== TRUE[k])) fail(`at an allowance of ${SAFE_TTL} some total is wrong; the "equal to the worst gap is enough" claim is false here`);
if (!TIGHT.resets.length) fail(`at an allowance of ${TIGHT_TTL} nothing was dropped and re-created, so the restart this section is about has no worked case`);
if (!WRONG.length) fail(`at ${TIGHT_TTL} every total is still right, so the expiry has no visible cost`);
// the exact boundary: one unit below the worst gap must already break a total

if (!RIGHT.length) fail(`at ${TIGHT_TTL} every total is wrong, so nothing shows that the allowance is per-key in effect`);
// The frames state that the memory saving at this scale is ZERO. Assert it, so that if a
// future seed made the expiry start paying off the prose would have to be rewritten rather
// than quietly becoming an understatement.
if (SAVING !== 0) fail(`the boundary allowance saves up to ${SAVING} key(s) at some moment; the frames say the saving here is zero, so that claim must be rewritten`);
if (new Set(KEYS.map(k => TRUE[k])).size !== KEYS.length) fail('two keys have the same total, so a wrong one cannot be attributed');

const eStr = () => EV.map(e => `${e.key}@${e.at}:${e.v}`).join('  ');
const aStr = (a) => Object.keys(a).sort().map(k => `${k}:${a[k]}`).join('  ') || '(empty)';
const tStr = () => KEYS.map(k => `${k}:${TRUE[k]}`).join('  ');
const gStr = () => KEYS.map(k => `${k}:${MAXGAP[k]}`).join('  ');
const RESET = TIGHT.resets[0];
const RESET_I = EV.findIndex(e => e.key === RESET.key && e.at === RESET.at);
const BADK = WRONG[0], GOODK = RIGHT[0];

const SRC = [
  `// primitive: len(xs) — element count.  len(EVENTS) = ${N}   ·   keys = ${KEYS.length}`,
  '// primitive: EVENTS — what arrives, in time order. Written key@time:value.',
  `//   EVENTS = ${eStr()}`,
  `//   true totals = ${tStr()}`,
  '// primitive: acc — one running total per key. This is the state, and it is the problem.',
  '// primitive: last — when each key was last touched. Needed only to expire it.',
  `// primitive: TTL — how long a key may go untouched before it is dropped.`,
  `//   ${SAFE_TTL} and ${TIGHT_TTL} are both traced`,
  '// primitive: gapsOf(k) — the intervals between one key\'s events.',
  `//   longest gap per key = ${gStr()}   ·   worst overall = ${WORST_GAP}`,
  '// primitive: GONE — the key is not in the state, which is indistinguishable from new.',
  '// primitive: keyOf(e) / valueOf(e) / timeOf(e) — the three fields of an event.',
  `//   keyOf(EVENTS[0]) = "${EV[0].key}"   ·   valueOf(EVENTS[0]) = ${EV[0].v}   ·   timeOf(EVENTS[0]) = ${EV[0].at}`,
  '// primitive: lastTimeOf(events) — the time of the final event.',
  `//   lastTimeOf(EVENTS) = ${END}`,
  '// primitive: maxOf(a, b) — the larger of two numbers.  maxOf(2, 127) = 127',
  '// primitive: remove(m, k) — drop one key from a map.',
  `//   remove(a map of ${KEYS.length}, a key) = ${KEYS.length - 1} entries left`,
  '// primitive: emptyMap() — no keys, and a missing key reads as 0.',
  `//   emptyMap() = {}`,
  '// primitive: keysOf(m) — the keys a map holds.',
  `//   keysOf(acc) = [${KEYS.join(', ')}] once both have been seen`,
  '// primitive: NONE — no previous event yet, so no gap can be measured.',
  '// primitive: INFINITY — an allowance nothing ever exceeds, i.e. no expiry at all.',
  '',
  '// THE QUESTION, as asked:',
  '//   "Events carry a key and a value, forever. Report a running total per key. Keys never',
  '//    stop arriving, so the state cannot grow without bound — bound it. What does the',
  '//    bound cost, and how do you choose it?"',
  '',
  '// function: add(acc, e) — the whole computation. One number per key.',
  `//   add over all ${N} events = ${tStr()}`,
  'fun add(acc, e) {',
  '    acc[keyOf(e)] = acc[keyOf(e)] + valueOf(e)',
  '    last[keyOf(e)] = timeOf(e)',
  '}',
  '',
  '// function: dropStale(acc, now) — remove any key untouched for longer than TTL. This is',
  '//   the only thing standing between the state and unbounded growth.',
  `//   at ${RESET.at} with TTL = ${TIGHT_TTL}, "${RESET.key}" is dropped (last touched ${EV.filter(e => e.key === RESET.key && e.at < RESET.at).slice(-1)[0].at})`,
  'fun dropStale(acc, now) {',
  '    for (k in keysOf(acc)) {',
  '        if (now - last[k] > TTL) {',
  '            remove(acc, k)',
  '            remove(last, k)',
  '        }',
  '    }',
  '}',
  '',
  '// function: onEvent(acc, e) — drop first, then add. The order is why the next frames',
  '//   happen: a key dropped a moment ago is indistinguishable from a key never seen.',
  'fun onEvent(acc, e) {',
  '    dropStale(acc, timeOf(e))',
  '    add(acc, e)',
  '}',
  '',
  '// function: totals(events, ttl) — run the whole stream at one allowance.',
  `//   totals(EVENTS, INFINITY) = ${aStr(NOEXP.acc)}`,
  `//   totals(EVENTS, ${SAFE_TTL}) = ${aStr(SAFE.acc)}`,
  `//   totals(EVENTS, ${TIGHT_TTL}) = ${aStr(TIGHT.acc)}  <- "${BADK}" is wrong`,
  'fun totals(events, ttl) {',
  '    var acc = emptyMap()',
  '    for (e in events) {',
  '        onEvent(acc, e)',
  '    }',
  '    dropStale(acc, lastTimeOf(events))',
  '    return acc',
  '}',
  '',
  '// function: longestGap(events, k) — the number the allowance has to beat, and it is a',
  '//   property of the DATA rather than of the design.',
  `//   longestGap(EVENTS, "${BADK}") = ${MAXGAP[BADK]}   ·   longestGap(EVENTS, "${GOODK}") = ${MAXGAP[GOODK]}`,
  'fun longestGap(events, k) {',
  '    var worst = 0',
  '    var prev  = NONE',
  '    for (e in events) {',
  '        if (keyOf(e) == k) {',
  '            if (prev != NONE) { worst = maxOf(worst, timeOf(e) - prev) }',
  '            prev = timeOf(e)',
  '        }',
  '    }',
  '    return worst',
  '}',
  '',
  '// function: main() — unbounded, then two allowances.',
  'fun main() {',
  `    val free  = totals(EVENTS, INFINITY)  // ${aStr(NOEXP.acc)}, ${heldAt(Infinity, OBSERVE)} keys held`,
  `    val safe  = totals(EVENTS, ${SAFE_TTL})      // ${aStr(SAFE.acc)}, all correct`,
  `    val tight = totals(EVENTS, ${TIGHT_TTL})      // ${aStr(TIGHT.acc)}, ${WRONG.length} wrong`,
  `    val gap   = longestGap(EVENTS, "${BADK}") // ${MAXGAP[BADK]} — the allowance must beat this`,
  `    val saved = ${SAVING}                        // keys the bound saves, at any moment, at this scale`,
  '}',
];

const HEAP = {
  events: { addr: '0x100', type: `event[${N}]`, val: () => eStr() },
  acc:    { addr: '0x200', type: 'map', val: (st) => st === undefined ? aStr(NOEXP.acc) : st },
  last:   { addr: '0x300', type: 'map', val: (st) => st === undefined ? KEYS.map(k => `${k}:${Math.max(...EV.filter(e => e.key === k).map(e => e.at))}`).join('  ') : st },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `free = ${o.free === undefined ? '...' : o.free}`,
  `safe = ${o.safe === undefined ? '...' : o.safe}`,
  `tight = ${o.tight === undefined ? '...' : o.tight}`,
  `gap = ${o.gap === undefined ? '...' : o.gap}`,
  `saved = ${o.held === undefined ? '...' : o.held}`] });
const AD = (o = {}) => ({ name: 'add', locals: ['acc = @0x200', `e = ${o.e}`] });
const DS = (o = {}) => ({ name: 'dropStale', locals: ['acc = @0x200', `now = ${o.now}`, `k = ${o.k === undefined ? '...' : `"${o.k}"`}`] });
const OE = (o = {}) => ({ name: 'onEvent', locals: ['acc = @0x200', `e = ${o.e}`] });
const TT = (o = {}) => ({ name: 'totals', locals: ['events = @0x100', `ttl = ${o.ttl}`, `acc = ${o.acc}`, `e = ${o.e === undefined ? '...' : o.e}`] });
const LG = (o = {}) => ({ name: 'longestGap', locals: ['events = @0x100', `k = "${o.k}"`, `worst = ${o.worst}`, `prev = ${o.prev}`,
  // the loop variable holds the last event examined by the lines these frames sit on
  `e = ${o.e === undefined ? '...' : o.e}`] });

const atStep = (i, r) => aStr(r.log[i].acc);
const PREV_A = EV.filter(e => e.key === RESET.key && e.at < RESET.at);
const PREV_SUM = PREV_A.reduce((a, e) => a + e.v, 0);

const steps = (at) => [
  { t: `${N} events, ${KEYS.length} keys, forever`, line: at('val free  = totals(EVENTS, INFINITY)'),
    stack: [MAIN()], heap: [{ key: 'events' }, { key: 'acc', st: '(empty)' }],
    cap: `0x100 holds ${eStr()} and 0x200 will hold one number per key. "Forever" plus "keys never stop arriving" is the constraint: the computation is trivial and the **state** is the problem, because its size is set by how many distinct keys have been seen rather than by anything you control.` },

  { t: `one number per key, and that is all`, line: at('acc[keyOf(e)] = acc[keyOf(e)] + valueOf(e)'),
    stack: [MAIN(), TT({ ttl: 'INFINITY', acc: '@0x200', e: `${EV[0].key}@${EV[0].at}` }), OE({ e: `${EV[0].key}@${EV[0].at}` }), AD({ e: `${EV[0].key}@${EV[0].at}` })],
    heap: [{ key: 'acc', st: atStep(0, NOEXP), hot: true }],
    cap: `${EV[0].key} becomes ${EV[0].v}. The computation per event is one addition and the memory per key is one number — nothing about the *computation* is expensive, which is exactly why the memory question is the whole question.` },

  { t: `unbounded: ${aStr(NOEXP.acc)}, ${heldAt(Infinity, OBSERVE)} keys held`, line: at('fun totals(events, ttl)::return acc'),
    stack: [MAIN({ free: aStr(NOEXP.acc) }), TT({ ttl: 'INFINITY', acc: aStr(NOEXP.acc), e: `${EV[N - 1].key}@${EV[N - 1].at}` })],
    heap: [{ key: 'acc', hot: true }],
    cap: `${aStr(NOEXP.acc)} — the right answer, asserted against the totals computed directly. And ${heldAt(Infinity, OBSERVE)} keys are held at time ${OBSERVE} and would be held forever: at ${BIGK.toLocaleString('en-US')} distinct keys that is ${BIGK.toLocaleString('en-US')} numbers plus their overhead, growing for as long as the system runs. **Correct and unrunnable** at scale — and at ${KEYS.length} keys the measured saving from bounding it is **zero at every moment**, so the argument for bounding is entirely about the asymptote and this example cannot show it.` },

  { t: `so drop anything untouched for TTL`, line: at('if (now - last[k] > TTL) {'),
    stack: [MAIN({ free: aStr(NOEXP.acc) }), DS({ now: RESET.at, k: RESET.key })],
    heap: [{ key: 'last', st: KEYS.map(k => `${k}:${Math.max(...EV.filter(e => e.key === k && e.at < RESET.at).map(e => e.at), 0)}`).join('  '), hot: true }],
    cap: `0x300 remembers when each key was last touched, which exists only so that this comparison can be made. At time ${RESET.at} with an allowance of ${TIGHT_TTL}, "${RESET.key}" was last touched at ${PREV_A.slice(-1)[0].at} — ${RESET.at - PREV_A.slice(-1)[0].at} ago — so it goes.` },

  { t: `and "${RESET.key}" is dropped holding ${PREV_SUM}`, line: at('remove(acc, k)'),
    stack: [MAIN({ free: aStr(NOEXP.acc) }), DS({ now: RESET.at, k: RESET.key })],
    heap: [{ key: 'acc', st: atStep(RESET_I - 1, TIGHT), hot: true }],
    cap: `Its accumulator held ${PREV_SUM} from ${PREV_A.length} earlier events, and that number is now gone. Nothing is logged and nothing fails — the state simply became smaller, which is what was asked for.` },

  { t: `then the next "${RESET.key}" event arrives`, line: at('dropStale(acc, timeOf(e))'),
    stack: [MAIN({ free: aStr(NOEXP.acc) }), OE({ e: `${RESET.key}@${RESET.at}` })],
    heap: [{ key: 'acc', st: atStep(RESET_I, TIGHT), hot: true }],
    cap: `It lands at ${RESET.at}, finds no accumulator for "${RESET.key}", and starts one — **because a key dropped a moment ago is indistinguishable from a key never seen.** The order in \`onEvent\` is drop-then-add, and no ordering fixes this: the information that would distinguish the two cases is exactly the information that was deleted.` },

  { t: `so "${BADK}" totals ${TIGHT.acc[BADK] === undefined ? 0 : TIGHT.acc[BADK]}, not ${TRUE[BADK]}`, line: at('val tight = totals(EVENTS, '),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc) })],
    heap: [{ key: 'acc', st: aStr(TIGHT.acc), hot: true }],
    cap: `${aStr(TIGHT.acc)} against a true ${tStr()}. **${WRONG.length} of ${KEYS.length} totals are wrong** and the error is one-directional — too low, by exactly what was dropped. "${GOODK}" is right, because its longest gap is ${MAXGAP[GOODK]} and the allowance was ${TIGHT_TTL}, so it was never dropped.` },

  { t: `at ${SAFE_TTL} every total is right again`, line: at('val safe  = totals(EVENTS, '),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc) })],
    heap: [{ key: 'acc', st: aStr(SAFE.acc), hot: true }],
    cap: `${aStr(SAFE.acc)}, asserted equal to the unbounded run. ${SAFE_TTL} is exactly the longest gap any key has, which is the whole rule: **the allowance must be at least as large as the longest silence a key may take.** One unit less and a key is dropped mid-aggregate.` },

  { t: `and that number is a property of the DATA`, line: at('if (prev != NONE) { worst = maxOf(worst, timeOf(e) - prev) }'),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc) }), LG({ k: BADK, worst: MAXGAP[BADK], prev: RESET.at, e: `${EV[N - 1].key}@${EV[N - 1].at}` })],
    heap: [{ key: 'events', hot: true }],
    cap: `Longest gap per key: ${gStr()}. These are measurements of the stream, not design choices — and they are only knowable **after the fact**, so the allowance has to be a guess about the future. Guess low and aggregates silently restart; guess high and the state is as large as the guess.` },

  { t: `so the bound is a guess, and both errors are silent`, line: at('fun dropStale(acc, now)::return'),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc), gap: MAXGAP[BADK] })],
    heap: [{ key: 'acc' }],
    cap: `Too short: totals come out low with no error anywhere, and the keys affected are the **quietest** ones — precisely the ones nobody is watching. Too long: the state holds every key seen in the window, so a burst of one-off keys is remembered for the whole allowance. Neither failure announces itself, and the first is worse because it corrupts answers rather than resources.` },

  { t: `what would make it safe`, line: at('fun onEvent(acc, e)::add(acc, e)'),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc), gap: MAXGAP[BADK], held: SAVING }), OE({ e: `${RESET.key}@${RESET.at}` })],
    heap: [{ key: 'acc' }, { key: 'last' }],
    cap: `Two honest options. **Close the aggregate explicitly** — if the total is per hour rather than forever, the state is bounded by the keys seen in an hour and an expiry after that hour is *correct* rather than approximate. Or **keep the dropped total somewhere cheaper** and reload it when the key returns, which turns a memory bound into a storage read. The one thing that does not work is choosing an allowance and calling the result exact.` },

  { t: 'the bill', line: at('val saved = '),
    stack: [MAIN({ free: aStr(NOEXP.acc), safe: aStr(SAFE.acc), tight: aStr(TIGHT.acc), gap: MAXGAP[BADK], held: SAVING })],
    heap: [{ key: 'events' }, { key: 'acc' }, { key: 'last' }],
    cap: `One addition per event, two numbers per live key, a measured memory saving of **${SAVING}** at ${KEYS.length} keys — the correctness cost arrives before any benefit does here, and the case for bounding is purely asymptotic. Three things to volunteer: the state is sized by **distinct keys**, not by throughput; an expiry makes an aggregate **restart**, and the error is silently low and concentrated on quiet keys; and the allowance must exceed the longest silence a key may take — a number that is a property of the data and therefore a guess.` },
];

const r = buildInterviewSection({
  name: 'ch07-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch07-interview-memory'),
  gen: 'gen_ch07_interview.js',
  title: 'A total per key, with bounded memory — stack and heap at every step',
  subtitle: `${N} events, ${KEYS.length} keys · allowance ${SAFE_TTL} correct, ${TIGHT_TTL} gets ${WRONG.length} of ${KEYS.length} wrong · longest gap ${WORST_GAP}`,
  problem: {
    surface: 'turnstiles',
    statement: [`**Events carry a key and a value, forever.** Report a **running total per key**.`, '',
      `Keys never stop arriving, so **the state cannot grow without bound — bound it.**`, '',
      `**What does the bound cost, and how do you choose it?**`],
    example: [`${eStr()} → true totals ${tStr()}. With an allowance of **${TIGHT_TTL}** the answer is ${aStr(TIGHT.acc)} — ${WRONG.length} of ${KEYS.length} wrong. With **${SAFE_TTL}** it is correct.`],
    constraints: [`The stream does not end. A key may go silent for an arbitrary time and come back.`],
  },
  model: [
    `The computation is one addition per event and one number per key, so **nothing about the computation is the problem**. The state is: its size is set by how many **distinct keys** have been seen, which is not a quantity you control and does not stop growing.`, '',
    `The only mechanism available is to **drop keys that have not been touched recently**, which needs a second number per key — when it was last seen — existing solely to make that comparison.`, '',
    `And here is what it costs. A key dropped a moment ago is **indistinguishable from a key never seen**, so when it comes back its total starts again from zero. The information that would tell the two apart is exactly the information that was deleted, and no ordering of the drop and the add can recover it. Measured: at an allowance of ${TIGHT_TTL}, ${WRONG.length} of ${KEYS.length} totals come out wrong — **too low**, by exactly what was dropped, with no error raised anywhere.`, '',
    `The rule for the allowance follows: it must be **at least the longest silence a key may take** — ${SAFE_TTL} here, at which every total is correct, asserted. But that number is a **property of the data** (${gStr()}) and only knowable after the fact, so in practice it is a guess, and **both ways of guessing wrong are silent**. Too short and totals are low, with the affected keys being the quietest ones — precisely those nobody is watching. Too long and the state holds every key seen within the allowance, so a burst of one-off keys is remembered for all of it.`, '',
    `Two honest ways out. **Close the aggregate explicitly** — if the total is per hour rather than forever, the state is bounded by the keys seen in an hour and expiring after it is *correct* rather than approximate. Or **keep the dropped total somewhere cheaper** and reload it when the key returns, trading a memory bound for a storage read. What does not work is picking an allowance and calling the result exact.`,
  ],
  variations: [
    { name: 'the unique-visitor count', surface: 'analytics',
      statement: [`Count **distinct** visitors per day, for 10⁹ events and tens of millions of visitors.`],
      whyHard: `The accumulator stops being one number: counting distinct values needs the values themselves, so the state is the size of the visitor set rather than one integer per key, and no expiry helps because every visitor must be remembered for the whole day. The way out is to give up exactness — a sketch answers "how many distinct" in a few kilobytes with a small error, whatever the cardinality. The content is recognising that the chapter's bound works because a sum is **one number** and a distinct count is not, so the two have completely different memory stories.`,
      maps: `\`add\` with a set in place of an integer, which is what makes \`dropStale\` insufficient and a sketch necessary.` },

    { name: 'the abandoned shopping cart', surface: 'commerce',
      statement: [`Hold each user's cart while they shop. **Expire the inactive ones.** A user returns after a week and expects their cart.`],
      whyHard: `Here the expiry is the *feature* and the chapter's silent restart is the specified behaviour — which inverts everything and leaves one real problem: the user who returns after the allowance expects their cart back, so the state cannot simply be dropped. The answer is the model's second escape, made concrete: write the cart to durable storage on expiry and read it back on return, so memory is bounded by **active** users while correctness is bounded by nothing. Noticing that "expire" and "forget" were conflated is the whole move.`,
      maps: `\`dropStale\` writing the accumulator out rather than deleting it, and \`add\` reading it back when a key reappears.` },

    { name: 'the fraud score over a lifetime', surface: 'risk',
      statement: [`Score each account on its **entire** history. Accounts are dormant for years and must keep their score.`],
      whyHard: `The requirement forbids every bound, which makes it the one case where the chapter's answer is simply unavailable — and the useful response is to stop treating the score as stream state at all. It belongs in a store keyed by account, read and written per event, so the streaming layer holds nothing between events and the memory question disappears. The insight is that **"state that must outlive the stream is not stream state"**, and trying to bound it is answering the wrong question.`,
      maps: `\`acc\` moved out of memory entirely, so \`dropStale\` has nothing to drop — the one variation where the traced program is the wrong shape rather than a tunable one.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch07-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is five paragraphs; this is the stream run at three allowances, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured on ${eStr()}. Unbounded: ${aStr(NOEXP.acc)}, correct, with ${heldAt(Infinity, OBSERVE)} keys held and never released. At an allowance of **${TIGHT_TTL}**: "${RESET.key}" is dropped at ${RESET.at} holding ${PREV_SUM} from ${PREV_A.length} events, the next event starts it again from zero, and the result is ${aStr(TIGHT.acc)} — **${WRONG.length} of ${KEYS.length} wrong**, all too low. At **${SAFE_TTL}**, which is exactly the longest gap any key takes, every total is correct — asserted. The longest gap per key is ${gStr()}, and those are measurements of the stream rather than choices.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x200 holds one number per live key and 0x300 holds a second number per live key that exists **only** so the expiry can be computed — so bounding the state costs twice the memory per key it keeps. Every figure is asserted — including that the unbounded run matches the totals computed directly, that an allowance equal to the worst gap is enough, that one unit less really does drop and re-create a key, that this makes some totals wrong **and leaves others right** (so the effect is visibly per-key), that the memory saving at this scale is **exactly zero** (so the frames' admission cannot quietly become an understatement), and that no two keys share a total (or a wrong one could not be attributed). Generated by \`node tools/gen_ch07_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch07-interview-memory`);
console.log(`    true ${tStr()} · ttl INF -> ${aStr(NOEXP.acc)} (saving ${SAVING}) · ttl ${SAFE_TTL} -> ${aStr(SAFE.acc)} · ttl ${TIGHT_TTL} -> ${aStr(TIGHT.acc)} (${WRONG.length} wrong) · gaps ${gStr()}`);
