#!/usr/bin/env node
'use strict';
/*
 * gen_ch05_interview.js — ch05's interview problem: a worker that may crash at any instant
 * and must neither repeat an item nor skip one.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — the effect, the recorded position, the three orderings of those two writes, and
 * what a crash at each instant produces. No two-phase commit protocol, no replication, no
 * chapter vocabulary.
 *
 * Every duplicate and every loss below is produced by RUNNING the worker with a crash
 * injected at each instant and restarting it, not by reasoning about what would happen.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

const ITEMS = S.EVENTS.map(e => ({ n: e.id, v: e.v }));
const N = ITEMS.length;
const CORRECT = ITEMS.reduce((a, it) => a + it.v, 0);

// The three orderings, each run with a crash after item `c` has had its FIRST write done
// and before its second. c === null means no crash.
const run = (order, c) => {
  let sum = 0, pos = 0, crashed = false;
  const go = (from) => {
    for (let i = from; i < N; i++) {
      if (order === 'effectFirst') { sum += ITEMS[i].v; if (i === c && !crashed) { crashed = true; return; } pos = i + 1; }
      else if (order === 'positionFirst') { pos = i + 1; if (i === c && !crashed) { crashed = true; return; } sum += ITEMS[i].v; }
      else { sum += ITEMS[i].v; pos = i + 1; if (i === c && !crashed) { crashed = true; return; } }
    }
  };
  go(0);
  if (crashed) go(pos);                 // restart from the last recorded position
  return { sum, pos };
};
const EFFECT = ITEMS.map((_, c) => run('effectFirst', c));
const POSN = ITEMS.map((_, c) => run('positionFirst', c));
const BOTH = ITEMS.map((_, c) => run('atomic', c));
const DUPES = EFFECT.filter(r => r.sum > CORRECT);
const LOSSES = POSN.filter(r => r.sum < CORRECT);
const ATOMIC_OK = BOTH.every(r => r.sum === CORRECT);
const WORST_DUP = EFFECT.reduce((b, r, i) => (r.sum - CORRECT > b.d ? { d: r.sum - CORRECT, i } : b), { d: 0, i: 0 });
const WORST_LOSS = POSN.reduce((b, r, i) => (CORRECT - r.sum > b.d ? { d: CORRECT - r.sum, i } : b), { d: 0, i: 0 });

const fail = (m) => { throw new Error(`gen_ch05_interview: ${m}`); };
if (run('effectFirst', null).sum !== CORRECT) fail('the worker is wrong even with no crash');
if (DUPES.length !== N) fail(`effect-then-position duplicated on ${DUPES.length} of ${N} crash points; a crash at ANY point must duplicate, or the claim is weaker than stated`);
if (LOSSES.length !== N) fail(`position-then-effect lost data on ${LOSSES.length} of ${N} crash points; a crash at ANY point must lose`);
if (!ATOMIC_OK) fail('the atomic version is not exact at some crash point');
if (new Set(ITEMS.map(i => i.v)).size !== N) fail('two items carry the same value, so a wrong total cannot identify which was repeated or skipped');
if (ITEMS.some(i => i.v === 0)) fail('an item with no effect would make a duplicate invisible');

const iStr = () => ITEMS.map(it => `${it.n}:${it.v}`).join('  ');
const C = 3;                                       // the crash point the frames trace
const DUP_AT = EFFECT[C], LOSS_AT = POSN[C], OK_AT = BOTH[C];

const SRC = [
  `// primitive: len(xs) — element count.  len(ITEMS) = ${N}`,
  '// primitive: ITEMS — the queue, numbered. Written number:value.',
  `//   ITEMS = ${iStr()}   ·   their total is ${CORRECT}`,
  '// primitive: sum — the output written to the database. Starts at 0.',
  '// primitive: pos — how far the worker has recorded reading. Starts at 0.',
  '// primitive: CRASH_AT — the item during which the process dies, for this trace.',
  `//   CRASH_AT = ${C} (item ${ITEMS[C].n}, value ${ITEMS[C].v})`,
  '// primitive: valueOf(item) — the item\'s value.',
  `//   valueOf(ITEMS[0]) = ${ITEMS[0].v}   ·   valueOf(ITEMS[${C}]) = ${ITEMS[C].v}`,
  '// primitive: begin() / commit() — open and close one transaction. Everything between',
  '//   them lands together or not at all.',
  `//   begin() = 1 open transaction   ·   after commit() both writes are durable, or neither`,
  '// primitive: restart(from) — the process comes back and resumes at the RECORDED pos.',
  '//   restart reads pos from durable storage; anything not written is gone.',
  '',
  '// THE QUESTION, as asked:',
  '//   "A worker reads numbered items from a queue, transforms each, and writes the result',
  '//    to a database. It records how far it has read so a restart resumes. The process',
  '//    can die at ANY instant. No item may be processed twice, and none may be skipped."',
  '',
  '// function: applyItem(sum, item) — the effect. Note it is NOT idempotent: running it',
  '//   twice moves the total twice, which is what makes a duplicate visible.',
  `//   applyItem(0, ITEMS[0]) = ${ITEMS[0].v}   ·   applyItem(${CORRECT}, ITEMS[${C}]) = ${CORRECT + ITEMS[C].v}`,
  'fun applyItem(sum, item) {',
  '    return sum + valueOf(item)',
  '}',
  '',
  '// function: effectThenPosition(items) — write the result, then record the position.',
  `//   with no crash: ${CORRECT}   ·   crashing during item ${C}: ${DUP_AT.sum}  <- ${DUP_AT.sum - CORRECT} too much`,
  'fun effectThenPosition(items) {',
  '    var i = pos',
  '    while (i < len(items)) {',
  '        sum = applyItem(sum, items[i])',
  '        // <-- a crash HERE has written the effect and not the position',
  '        pos = i + 1',
  '        i = i + 1',
  '    }',
  '}',
  '',
  '// function: positionThenEffect(items) — record the position, then write the result.',
  `//   with no crash: ${CORRECT}   ·   crashing during item ${C}: ${LOSS_AT.sum}  <- ${CORRECT - LOSS_AT.sum} missing`,
  'fun positionThenEffect(items) {',
  '    var i = pos',
  '    while (i < len(items)) {',
  '        pos = i + 1',
  '        // <-- a crash HERE has recorded the position and not the effect',
  '        sum = applyItem(sum, items[i])',
  '        i = i + 1',
  '    }',
  '}',
  '',
  '// function: together(items) — both writes in ONE transaction, so a crash leaves either',
  `//   both or neither.  every crash point gives ${CORRECT}`,
  'fun together(items) {',
  '    var i = pos',
  '    while (i < len(items)) {',
  '        begin()',
  '        sum = applyItem(sum, items[i])',
  '        pos = i + 1',
  '        commit()',
  '        // <-- a crash anywhere inside leaves NEITHER write',
  '        i = i + 1',
  '    }',
  '}',
  '',
  '// function: main() — all three, crashed at every item in turn and restarted.',
  'fun main() {',
  `    val clean = ${CORRECT}              // no crash, any ordering`,
  `    val dup   = ${DUP_AT.sum}              // effect first, crash during item ${C}`,
  `    val lost  = ${LOSS_AT.sum}              // position first, crash during item ${C}`,
  `    val exact = ${OK_AT.sum}              // one transaction, crash during item ${C}`,
  `    val dups  = ${DUPES.length}               // of ${N} crash points that duplicate`,
  `    val losses = ${LOSSES.length}              // of ${N} crash points that lose`,
  '}',
];

const HEAP = {
  items: { addr: '0x100', type: `item[${N}]`, val: () => iStr() },
  db:    { addr: '0x200', type: 'durable', val: (st) => st === undefined ? `sum=${CORRECT} pos=${N}` : st },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `clean = ${o.clean === undefined ? '...' : o.clean}`,
  `dup = ${o.dup === undefined ? '...' : o.dup}`,
  `lost = ${o.lost === undefined ? '...' : o.lost}`,
  `exact = ${o.exact === undefined ? '...' : o.exact}`,
  `dups = ${o.dups === undefined ? '...' : o.dups}`,
  `losses = ${o.losses === undefined ? '...' : o.losses}`] });
const EF = (o = {}) => ({ name: 'effectThenPosition', locals: ['items = @0x100', `i = ${o.i}`] });
const PF = (o = {}) => ({ name: 'positionThenEffect', locals: ['items = @0x100', `i = ${o.i}`] });
const TG = (o = {}) => ({ name: 'together', locals: ['items = @0x100', `i = ${o.i}`] });
const AI = (o = {}) => ({ name: 'applyItem', locals: [`sum = ${o.sum}`, `item = ${o.item}`] });

const partial = (upto) => ITEMS.slice(0, upto).reduce((a, it) => a + it.v, 0);

const steps = (at) => [
  { t: `${N} items, one total, one recorded position`, line: at('val clean = '),
    stack: [MAIN()], heap: [{ key: 'items' }, { key: 'db', st: 'sum=0 pos=0' }],
    cap: `0x100 is the queue and 0x200 is the only durable state: the total written so far and how far the worker has recorded reading. With no crash every ordering gives ${CORRECT}. The question is about the instant between two writes, and the whole difficulty is that **there are two writes and they are not one**.` },

  { t: `effect first: the total moves`, line: at('fun effectThenPosition(items)::sum = applyItem(sum, items[i])'),
    stack: [MAIN({ clean: CORRECT }), EF({ i: C }), AI({ sum: partial(C), item: `${ITEMS[C].n}:${ITEMS[C].v}` })],
    heap: [{ key: 'db', st: `sum=${partial(C + 1)} pos=${C}`, hot: true }],
    cap: `Item ${ITEMS[C].n} is applied: the total goes from ${partial(C)} to ${partial(C + 1)}, and \`pos\` is still ${C}. For this one instant the database has done the work and has no record of having done it — and the process can die here.` },

  { t: `it dies here, and restarts at pos = ${C}`, line: at('fun effectThenPosition(items)::pos = i + 1'),
    stack: [MAIN({ clean: CORRECT }), EF({ i: C })],
    heap: [{ key: 'db', st: `sum=${partial(C + 1)} pos=${C}  <- crash`, hot: true }],
    cap: `The recorded position is ${C}, so the restart reads item ${ITEMS[C].n} again and applies it again. Nothing is corrupt, nothing errored, and the work was done twice because the only record of it having been done was the one write that did not happen.` },

  { t: `so the total is ${DUP_AT.sum}, not ${CORRECT}`, line: at('fun effectThenPosition(items)::sum = applyItem(sum, items[i])'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum })],
    heap: [{ key: 'db', st: `sum=${DUP_AT.sum} pos=${N}`, hot: true }],
    cap: `${DUP_AT.sum} against ${CORRECT} — item ${ITEMS[C].n}'s ${ITEMS[C].v} counted twice. And it is not a narrow window: crashing at **any** of the ${N} items duplicates, ${DUPES.length} of ${N} measured, worst case ${WORST_DUP.d} too much. The window is not small, it is every item.` },

  { t: `so record the position first instead`, line: at('fun positionThenEffect(items)::pos = i + 1'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum }), PF({ i: C })],
    heap: [{ key: 'db', st: `sum=${partial(C)} pos=${C + 1}`, hot: true }],
    cap: `pos is ${C + 1} and the total is still ${partial(C)}. The obvious repair: now a crash cannot cause a repeat, because the position already says item ${ITEMS[C].n} is done. Which is exactly the problem.` },

  { t: `it dies here, and item ${ITEMS[C].n} is skipped forever`, line: at('fun positionThenEffect(items)::sum = applyItem(sum, items[i])'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum }), PF({ i: C })],
    heap: [{ key: 'db', st: `sum=${partial(C)} pos=${C + 1}  <- crash`, hot: true }],
    cap: `The restart resumes at ${C + 1}, so item ${ITEMS[C].n} is never applied. The total ends at ${LOSS_AT.sum}, short by ${CORRECT - LOSS_AT.sum}, and **nothing will ever notice** — the position says it was handled. Crashing at any of the ${N} items loses something: ${LOSSES.length} of ${N}, worst case ${WORST_LOSS.d} missing.` },

  { t: `so neither ordering works, and that is a PROOF`, line: at('fun positionThenEffect(items)::i = i + 1'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum })],
    heap: [{ key: 'db' }],
    cap: `Measured: ${DUPES.length} of ${N} crash points duplicate one way and ${LOSSES.length} of ${N} lose the other. That exhausts the orderings — there are two writes, so there are two sequences, and each has an instant between them that is wrong in opposite directions. **No amount of care about the order fixes this**, which is the realisation the question is testing. Retrying harder, flushing sooner and adding a third write all leave an instant.` },

  { t: `the reframe: make it ONE write`, line: at('fun together(items)::begin()'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum }), TG({ i: C })],
    heap: [{ key: 'db', st: `sum=${partial(C)} pos=${C}`, hot: true }],
    cap: `If the two writes commit **together**, there is no instant between them: a crash leaves both or neither. Nothing about the effect or the position changed — what changed is that they are now one durable fact instead of two, and the gap the previous frames exploited does not exist.` },

  { t: `crash inside the transaction: neither write survives`, line: at('fun together(items)::commit()'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum }), TG({ i: C })],
    heap: [{ key: 'db', st: `sum=${partial(C)} pos=${C}  <- crash, both rolled back`, hot: true }],
    cap: `The total is still ${partial(C)} and pos is still ${C}, so the restart does item ${ITEMS[C].n} once — for the first time. **Every one of the ${N} crash points gives ${CORRECT}**, asserted. And note what was NOT needed: no distributed protocol, no deduplication table, no retry logic. One transaction.` },

  { t: `so exactly-once needs the output to be transactional`, line: at('fun together(items)::i = i + 1'),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum, exact: OK_AT.sum })],
    heap: [{ key: 'db' }],
    cap: `The whole result rests on one assumption: the position can be written **in the same transaction as the effect**, which means the position must live in the output store. Keeping it in the queue instead — which is where every queue wants to keep it — puts it outside that transaction and the two-writes problem returns immediately.` },

  { t: `and when the output is not transactional`, line: at('val dups  = '),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum, exact: OK_AT.sum, dups: DUPES.length })],
    heap: [{ key: 'items' }, { key: 'db' }],
    cap: `If the effect is an email, a payment call or a third-party API, there is no transaction to join and **exactly-once is not available at all**. What is available is at-least-once with an idempotent effect — the duplicate still happens and changes nothing — or at-most-once, where the loss is accepted. Saying which of the three the system actually has is the answer; "we do exactly-once" without naming the transaction is the thing to be suspicious of.` },

  { t: 'the bill', line: at('val losses = '),
    stack: [MAIN({ clean: CORRECT, dup: DUP_AT.sum, lost: LOSS_AT.sum, exact: OK_AT.sum, dups: DUPES.length, losses: LOSSES.length })],
    heap: [{ key: 'db' }],
    cap: `Per item: one transaction instead of two independent writes, which is cheaper, not dearer. What it costs is a **constraint on where state lives** — the position must be in the output store, so the worker cannot write to two unrelated systems and still claim this. That constraint is the real content: exactly-once is a property of where you put the bookkeeping, not of how carefully you retry.` },
];

const r = buildInterviewSection({
  name: 'ch05-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch05-interview-memory'),
  gen: 'gen_ch05_interview.js',
  title: 'Crash at any instant, process each item once — stack and heap at every step',
  subtitle: `${N} items, total ${CORRECT} · dupes ${DUPES.length}/${N} · losses ${LOSSES.length}/${N} · one transaction exact at all ${N}`,
  problem: {
    surface: 'order fulfilment',
    statement: [`**A worker reads numbered items from a queue, transforms each one, and writes the result to a database.** It also records how far it has read, so that a restart resumes instead of starting over.`, '',
      `**The process can die at any instant.**`, '',
      `**Make it so that no item is ever processed twice and none is ever skipped.**`],
    example: [`\`${iStr()}\` → total ${CORRECT}. Crash during item ${ITEMS[C].n} and the obvious implementation gives **${DUP_AT.sum}**; swap two lines and it gives **${LOSS_AT.sum}**.`],
    constraints: [`The effect is not idempotent — it moves a balance. The queue will redeliver anything not recorded as read.`],
  },
  model: [
    `There are **two writes** — the effect, and the position — and the entire problem is the instant between them.`, '',
    `**Effect first, then position:** a crash in between has done the work and has no record of it, so the restart does it again. Measured here, crashing at any of the ${N} items duplicates: ${DUPES.length} of ${N}.`, '',
    `**Position first, then effect:** a crash in between has recorded the item as handled without doing it, so it is skipped and *nothing will ever notice*. Measured: ${LOSSES.length} of ${N}.`, '',
    `That exhausts the orderings. Two writes give two sequences, and each has an instant that is wrong, in opposite directions — so **this is a proof, not a pair of bugs.** Retrying harder, flushing sooner, adding a third write: all of them still have an instant. The realisation that no ordering can work is what the question is for.`, '',
    `The reframe is to stop having two writes: **commit the effect and the position together, in one transaction.** A crash then leaves both or neither, the restart does the item exactly once, and every crash point gives ${CORRECT} — with no distributed protocol, no deduplication table and no retry logic.`, '',
    `And the assumption that carries it, which is the part worth volunteering: the position must be written **in the same transaction as the effect**, so it has to live in the output store — not in the queue, which is where every queue wants to keep it. If the effect is an email, a payment call or a third-party API, there is no transaction to join and **exactly-once is not available at all**. What is available is at-least-once with an idempotent effect, or at-most-once with accepted loss. Naming which of the three a system actually has is the answer.`,
  ],
  variations: [
    { name: 'the file that is half uploaded', surface: 'backups',
      statement: [`A nightly job uploads a large file and then records that the backup succeeded. **It is killed partway through the upload.**`],
      whyHard: `The same two writes, and the transaction trick is unavailable because the file store and the record are different systems. What makes it tractable is a property the queue problem lacked: the upload's destination name is under your control, so writing to a temporary name and **renaming on completion** makes the appearance of the file itself the atomic commit — the rename is the one durable write, and a partial upload is invisible because nothing is looking at the temporary name. Recognising that you can often manufacture an atomic step rather than needing a transaction is the content.`,
      maps: `\`together\` with the rename playing \`commit\`, and no \`pos\` at all — the file's existence is the position.` },

    { name: 'the counter in two places', superseded: false, surface: 'analytics',
      statement: [`Each event increments a counter in a fast store and appends a row to a warehouse. **Both must agree.**`],
      whyHard: `Two outputs rather than one output and a position, so there is no single store the bookkeeping can live in and the transaction is genuinely unavailable. The honest answer is that it cannot be made exact, and the useful answer is to pick one store as the source of truth and **derive** the other from it — the fast counter becomes a cache rebuilt from the warehouse rather than a second authority, so disagreement becomes staleness instead of inconsistency. The skill is noticing that "both must agree" is a request to have two sources of truth, and declining it.`,
      maps: `No change to the program; the point is that \`together\` has no store to be together IN, which is the condition the model's last paragraph names.` },

    { name: 'the retry that must not re-send', surface: 'notifications',
      statement: [`A worker sends a push notification per item. **A crash must not send it twice**, and the push service has no transaction and no idempotency key.`],
      whyHard: `Every tool above is gone: no transaction, no idempotency at the far end, and the effect is visible to a human so a duplicate is not harmless. So the question is which guarantee to give up, and the answer depends on the notification rather than on the code — for a "your parcel has arrived" message a duplicate is mild and a loss is bad, so at-least-once; for "you have been charged" the reverse, so at-most-once with a record written *before* sending. Arriving at "there is no correct answer without knowing what the message is" is the answer, and it is the opposite of what the first reading of the question invites.`,
      maps: `\`effectThenPosition\` and \`positionThenEffect\` as the two available designs, chosen deliberately rather than by accident — which is what the traced measurements let you do.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch05-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is six paragraphs; this is all three orderings running with a crash injected and the process restarted, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Every figure is produced by running the worker, crashing it and restarting it. Measured: with no crash, ${CORRECT}. Effect-then-position crashing during item ${ITEMS[C].n} gives **${DUP_AT.sum}** — and crashing at **any** of the ${N} items duplicates, worst case ${WORST_DUP.d} too much. Position-then-effect gives **${LOSS_AT.sum}**, and loses at all ${N} crash points, worst case ${WORST_LOSS.d} missing. One transaction gives **${CORRECT} at every one of the ${N} crash points**, asserted.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x200 is the only durable state and is the entire subject — a crash is simply the moment the frames stop and 0x200 is all that is left. Every figure is derived from \`tools/stream_seed.js\` and asserted — including that the worker is correct with no crash, that effect-first duplicates at **every** crash point and position-first loses at every one (so the claim is "no ordering works" rather than "there is a narrow window"), that the atomic version is exact at all of them, that no two items share a value (or a wrong total could not identify which was repeated), and that no item has a zero effect. Generated by \`node tools/gen_ch05_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch05-interview-memory`);
console.log(`    correct ${CORRECT} · effect-first dupes ${DUPES.length}/${N} (worst +${WORST_DUP.d}) · position-first losses ${LOSSES.length}/${N} (worst -${WORST_LOSS.d}) · atomic exact: ${ATOMIC_OK}`);
