#!/usr/bin/env node
'use strict';
/*
 * gen_ch06_interview.js — ch06's interview problem: the current state and the sequence of
 * changes, and what is lost when you keep only one of them.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — folding a changelog into a state, emitting a state as a changelog, keeping the
 * last entry per key, and the questions each form can and cannot answer. No joins, no
 * windowing, no chapter vocabulary.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

// A changelog: one entry per arriving event, carrying the key's running total afterwards.
const LOG = (() => { const run = {}; return S.EVENTS.map(e => { run[e.key] = (run[e.key] || 0) + e.v;
  return { key: e.key, val: run[e.key], at: e.pt }; }); })();
const N = LOG.length;
const KEYS = [...new Set(LOG.map(l => l.key))].sort();

const fold = (log) => { const t = {}; for (const l of log) t[l.key] = l.val; return t; };
const TABLE = fold(LOG);
const compact = (log) => { const last = {}; for (const l of log) last[l.key] = l; return Object.keys(last).sort().map(k => last[k]); };
const COMPACT = compact(LOG);
const emit = (t) => Object.keys(t).sort().map(k => ({ key: k, val: t[k], at: null }));
const EMITTED = emit(TABLE);

// what history can answer, and what a compacted log cannot
const historyOf = (k) => LOG.filter(l => l.key === k).map(l => l.val);
const ASKED = KEYS[0];
const HIST = historyOf(ASKED);
const LOST = N - COMPACT.length;
const DISTINCT_PAST = KEYS.reduce((a, k) => a + Math.max(0, historyOf(k).length - 1), 0);
const foldedFromCompact = fold(COMPACT);
const SAME_TABLE = KEYS.every(k => foldedFromCompact[k] === TABLE[k]);

const fail = (m) => { throw new Error(`gen_ch06_interview: ${m}`); };
if (KEYS.length < 2) fail(`only ${KEYS.length} key; at least 2 are needed for compaction to be visibly per-key`);
if (!(N > COMPACT.length)) fail('the changelog is already one entry per key, so compaction does nothing');
if (!SAME_TABLE) fail('folding the compacted log does not reproduce the table; compaction is not state-preserving and the whole section is wrong');
if (EMITTED.length !== Object.keys(TABLE).length) fail('emitting the table did not give one entry per key');
if (EMITTED.length === N) fail('the emitted stream is as long as the original changelog, so nothing is visibly lost');
if (HIST.length < 3) fail(`key "${ASKED}" has only ${HIST.length} entries; at least 3 are needed for a history question to be interesting`);
if (!DISTINCT_PAST) fail('no key has a past value, so nothing is lost by compaction');
if (new Set(LOG.map(l => `${l.key}${l.val}`)).size !== N) fail('two changelog entries are identical, so a lost one would be invisible');

const lStr = (log) => log.map(l => `${l.key}=${l.val}`).join('  ');
const tStr = (t) => Object.keys(t).sort().map(k => `${k}:${t[k]}`).join('  ');
const MID = Math.floor(HIST.length / 2);

const SRC = [
  `// primitive: len(xs) — element count.  len(CHANGELOG) = ${N}   ·   keys = ${KEYS.length}`,
  '// primitive: CHANGELOG — one entry per change, in order. Each says what a key BECAME.',
  `//   CHANGELOG = ${lStr(LOG)}`,
  '// primitive: TABLE — a key to its current value. One entry per key, no history.',
  `//   TABLE = ${tStr(TABLE)}`,
  '// primitive: keyOf(e) / valOf(e) — the two fields of an entry.',
  `//   keyOf(CHANGELOG[0]) = "${LOG[0].key}"   ·   valOf(CHANGELOG[0]) = ${LOG[0].val}`,
  '// primitive: emptyTable() — no keys.  emptyTable() = {}',
  '// primitive: keysOf(t) — the keys a table holds, in order.',
  `//   keysOf(TABLE) = [${KEYS.join(', ')}]`,
  '// primitive: UNANSWERABLE — the question cannot be answered from what is kept.',
  '// primitive: entry(k, v) — one changelog entry.',
  `//   entry("${KEYS[0]}", ${TABLE[KEYS[0]]}) = "${KEYS[0]}=${TABLE[KEYS[0]]}"`,
  '',
  '// THE QUESTION, as asked:',
  '//   "You have a sequence of changes, each saying what a key became. Produce the current',
  '//    value of every key. Then: produce the changes back from the table. Then: the log is',
  '//    too long to keep — what may you discard, and what do you lose?"',
  '',
  '// function: fold(log) — the changes into the state. Later entries overwrite earlier ones,',
  '//   so the order of the log is the whole content of the answer.',
  `//   fold(CHANGELOG) = ${tStr(TABLE)} in ${N} steps`,
  'fun fold(log) {',
  '    var t = emptyTable()',
  '    for (e in log) {',
  '        t[keyOf(e)] = valOf(e)',
  '    }',
  '    return t',
  '}',
  '',
  '// function: emit(t) — the state back out as changes. One entry per key, and that is',
  '//   already the whole difference.',
  `//   emit(TABLE) = ${lStr(EMITTED)} — ${EMITTED.length} entries, from ${N}`,
  'fun emit(t) {',
  '    var log = []',
  '    for (k in keysOf(t)) {',
  '        log.append(entry(k, t[k]))',
  '    }',
  '    return log',
  '}',
  '',
  '// function: compact(log) — keep only the LAST entry per key. Everything dropped was',
  '//   superseded, so the state the log folds to does not change.',
  `//   compact(CHANGELOG) = ${lStr(COMPACT)} — ${LOST} of ${N} entries dropped`,
  'fun compact(log) {',
  '    var last = emptyTable()',
  '    for (e in log) {',
  '        last[keyOf(e)] = e',
  '    }',
  '    return emit(last)',
  '}',
  '',
  '// function: valueAfter(log, k, n) — what key k was after its n-th change. Answerable',
  '//   from the full log and from nothing else.',
  `//   valueAfter(CHANGELOG, "${ASKED}", ${MID}) = ${HIST[MID - 1]}`,
  `//   valueAfter(compacted, "${ASKED}", ${MID}) = UNANSWERABLE`,
  'fun valueAfter(log, k, n) {',
  '    var seen = 0',
  '    for (e in log) {',
  '        if (keyOf(e) == k) {',
  '            seen = seen + 1',
  '            if (seen == n) { return valOf(e) }',
  '        }',
  '    }',
  '    return UNANSWERABLE',
  '}',
  '',
  '// function: main() — fold, emit, compact, then ask about the past.',
  'fun main() {',
  `    val table = fold(CHANGELOG)             // ${tStr(TABLE)}`,
  `    val back  = emit(table)                 // ${EMITTED.length} entries, not ${N}`,
  `    val small = compact(CHANGELOG)          // ${COMPACT.length} entries, ${LOST} dropped`,
  `    val same  = fold(small)                 // ${tStr(foldedFromCompact)} — identical`,
  `    val past  = valueAfter(CHANGELOG, "${ASKED}", ${MID})  // ${HIST[MID - 1]}`,
  `    val gone  = valueAfter(small, "${ASKED}", ${MID})       // UNANSWERABLE`,
  '}',
];

const HEAP = {
  log:   { addr: '0x100', type: `entry[${N}]`, val: () => lStr(LOG) },
  table: { addr: '0x200', type: `map[${KEYS.length}]`, val: (st) => st === undefined ? tStr(TABLE) : st },
  small: { addr: '0x300', type: 'entry[]', val: (st) => st === undefined ? lStr(COMPACT) : st },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `table = ${o.table === undefined ? '...' : o.table}`,
  `back = ${o.back === undefined ? '...' : o.back}`,
  `small = ${o.small === undefined ? '...' : o.small}`,
  `same = ${o.same === undefined ? '...' : o.same}`,
  `past = ${o.past === undefined ? '...' : o.past}`,
  `gone = ${o.gone === undefined ? '...' : o.gone}`] });
const FO = (o = {}) => ({ name: 'fold', locals: [`log = ${o.src}`, `t = ${o.t}`, `e = ${o.e}`] });
const EM = (o = {}) => ({ name: 'emit', locals: ['t = @0x200', `log = ${o.log}`, `k = ${o.k === undefined ? '...' : `"${o.k}"`}`] });
const CO = (o = {}) => ({ name: 'compact', locals: ['log = @0x100', `last = ${o.last}`, `e = ${o.e}`] });
const VA = (o = {}) => ({ name: 'valueAfter', locals: [`log = ${o.src}`, `k = "${ASKED}"`, `n = ${MID}`, `seen = ${o.seen}`, `e = ${o.e}`] });

const partial = (upto) => { const t = {}; for (const l of LOG.slice(0, upto)) t[l.key] = l.val; return t; };

const steps = (at) => [
  { t: `${N} changes, ${KEYS.length} keys`, line: at('val table = fold(CHANGELOG)'),
    stack: [MAIN()], heap: [{ key: 'log' }, { key: 'table', st: '{}' }],
    cap: `0x100 holds ${lStr(LOG)} — each entry says what a key **became**, not what changed about it. That distinction is the whole reason the fold below is one assignment rather than an arithmetic update, and it is a property of the log's format rather than of the data.` },

  { t: `folding: later overwrites earlier`, line: at('t[keyOf(e)] = valOf(e)'),
    stack: [MAIN(), FO({ src: '@0x100', t: `{${tStr(partial(3))}}`, e: `${LOG[2].key}=${LOG[2].val}` })],
    heap: [{ key: 'log', hot: true }, { key: 'table', st: tStr(partial(3)), hot: true }],
    cap: `After 3 entries the table is ${tStr(partial(3))}. The assignment is unconditional, so **the order of the log is the entire content of the answer** — shuffle it and the table is different. A fold that had to combine values rather than replace them would need the operation to be associative; this one does not, which is what makes it cheap.` },

  { t: `${N} changes become ${KEYS.length} entries`, line: at('fun fold(log)::return t'),
    stack: [MAIN({ table: tStr(TABLE) }), FO({ src: '@0x100', t: tStr(TABLE), e: `${LOG[N - 1].key}=${LOG[N - 1].val}` })],
    heap: [{ key: 'table', hot: true }],
    cap: `${tStr(TABLE)} — ${KEYS.length} entries from ${N} changes. The table is **smaller than the log by the number of times keys were revisited**, and that ratio is the only thing the next three frames are about.` },

  { t: `and the table emits back as ${EMITTED.length} changes`, line: at('log.append(entry(k, t[k]))'),
    stack: [MAIN({ table: tStr(TABLE) }), EM({ log: lStr(EMITTED.slice(0, 1)), k: KEYS[0] })],
    heap: [{ key: 'table', hot: true }, { key: 'small', st: lStr(EMITTED), hot: true }],
    cap: `${lStr(EMITTED)} — ${EMITTED.length} entries where ${N} went in. So "a table is a stream and a stream is a table" is true **in one direction only**: folding loses nothing you can get back, and emitting cannot invent the ${LOST} intermediate values it never kept.` },

  { t: `compaction: keep the last per key`, line: at('last[keyOf(e)] = e'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries` }), CO({ last: `${KEYS.length} keys`, e: `${LOG[N - 1].key}=${LOG[N - 1].val}` })],
    heap: [{ key: 'log', hot: true }, { key: 'small', st: lStr(COMPACT), hot: true }],
    cap: `${lStr(COMPACT)} — **${LOST} of ${N} entries dropped**. Every one of them had been superseded by a later entry for the same key, so nothing that the table depends on was removed, which the next frame checks rather than assumes.` },

  { t: `and the compacted log folds to the same table`, line: at('val same  = fold(small)'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact) })],
    heap: [{ key: 'table', hot: true }, { key: 'small' }],
    cap: `${tStr(foldedFromCompact)}, asserted identical to folding all ${N}. **That is the guarantee compaction offers and the limit of it**: the state is preserved exactly, and nothing is said about anything else. A log that has been compacted is still a complete description of the present.` },

  { t: `"what was ${ASKED} after its ${MID}${MID === 1 ? 'st' : MID === 2 ? 'nd' : MID === 3 ? 'rd' : 'th'} change?"`, line: at('if (seen == n) { return valOf(e) }'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact) }), VA({ src: '@0x100', seen: MID, e: `${ASKED}=${HIST[MID - 1]}` })],
    heap: [{ key: 'log', hot: true }],
    cap: `From the full log: **${HIST[MID - 1]}**. Key ${ASKED} passed through ${HIST.join(', ') } — ${HIST.length} values — and every one of them is a real past state that somebody may have seen. The log can answer that; the table never could.` },

  { t: `and from the compacted log: UNANSWERABLE`, line: at('fun valueAfter(log, k, n)::return UNANSWERABLE'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact), past: HIST[MID - 1] }), VA({ src: '@0x300', seen: 1, e: `${ASKED}=${TABLE[ASKED]}` })],
    heap: [{ key: 'small', hot: true }],
    cap: `There is one entry for ${ASKED} and it holds ${TABLE[ASKED]}, so the ${MID}${MID === 1 ? 'st' : MID === 2 ? 'nd' : 'rd'} value is not there to find. **${DISTINCT_PAST} past values across all keys are gone**, and the function returns UNANSWERABLE rather than the current value — which is the important part, because returning ${TABLE[ASKED]} would be a confident wrong answer to a question about the past.` },

  { t: `so compaction trades history for size`, line: at('fun compact(log)::return emit(last)'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact), past: HIST[MID - 1], gone: 'UNANSWERABLE' })],
    heap: [{ key: 'log' }, { key: 'small' }],
    cap: `${N} entries to ${COMPACT.length}, and every question about the present still answerable. The cost is **every question about the past** — audit, debugging, replaying a different computation over old data, rebuilding a downstream consumer that wants the history and not the state. None of those is visible in the table, which is why compaction looks free until somebody needs one.` },

  { t: `and it is why a delete must be an entry`, line: at('fun fold(log)::t[keyOf(e)] = valOf(e)'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact), past: HIST[MID - 1], gone: 'UNANSWERABLE' }), FO({ src: '@0x300', t: tStr(foldedFromCompact), e: `${COMPACT[0].key}=${COMPACT[0].val}` })],
    heap: [{ key: 'small', hot: true }],
    cap: `The fold builds the table from entries and **only** from entries, so a key removed by its absence cannot be removed at all — the fold would simply never hear about it and keep the old value forever. A deletion therefore has to be an entry that says "gone", which is the one piece of the log that compaction may not drop until every consumer has passed it.` },

  { t: `how long the log has to be`, line: at('val small = compact(CHANGELOG)'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact), past: HIST[MID - 1], gone: 'UNANSWERABLE' })],
    heap: [{ key: 'log' }],
    cap: `A new consumer that needs the current state can start from the compacted log — ${COMPACT.length} entries instead of ${N}, which is what makes compaction worth doing operationally rather than only for disk. A consumer that needs the **history** must start from a log that has not been compacted past the point it cares about, so the retention is set by the most demanding consumer rather than by the storage budget.` },

  { t: 'the bill', line: at('val back  = emit(table)'),
    stack: [MAIN({ table: tStr(TABLE), back: `${EMITTED.length} entries`, small: `${COMPACT.length} entries`, same: tStr(foldedFromCompact), past: HIST[MID - 1], gone: 'UNANSWERABLE' })],
    heap: [{ key: 'log' }, { key: 'table' }, { key: 'small' }],
    cap: `Folding is one pass and one assignment per entry; the table is ${KEYS.length} entries against the log's ${N}; compaction drops ${LOST} and changes no present answer. Three things to volunteer: the two forms are **not symmetric** — a table cannot reproduce the log it came from; a deletion must be an **entry**, not an absence, or the fold can never remove anything; and retention is set by the consumer that needs the most history, not by disk.` },
];

const r = buildInterviewSection({
  name: 'ch06-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch06-interview-memory'),
  gen: 'gen_ch06_interview.js',
  title: 'The changes and the current state — stack and heap at every step',
  subtitle: `${N} changes → ${KEYS.length} entries · compaction drops ${LOST} and changes nothing present · ${DISTINCT_PAST} past values lost`,
  problem: {
    surface: 'ledger',
    statement: [`**You have a sequence of changes, each saying what a key became.**`, '',
      `**Produce the current value of every key.** Then: **produce the changes back, from the table.**`, '',
      `Then: **the log is too long to keep. What may you discard, and what do you lose?**`],
    example: [`\`${lStr(LOG)}\` → \`${tStr(TABLE)}\`. Emitting the table gives **${EMITTED.length}** entries, not ${N}. Compaction drops **${LOST}** and folds to the same table — losing **${DISTINCT_PAST}** past values.`],
    constraints: [`Each entry says what the key became, not what changed. The log is in order.`],
  },
  model: [
    `The fold is one assignment per entry: later entries overwrite earlier ones, so **the order of the log is the entire content of the answer**. Note what makes it cheap — each entry says what the key *became*, so nothing has to be combined and no operation has to be associative.`, '',
    `The second question looks symmetric and is not. The table emits back as **one entry per key** — ${EMITTED.length} where ${N} went in — so "a table is a stream and a stream is a table" holds in **one direction**: folding loses nothing you can get back, and emitting cannot invent the ${LOST} intermediate values it never kept.`, '',
    `Which answers the third. You may discard every entry that a later entry for the same key supersedes — **${LOST} of ${N}** here — and the compacted log folds to exactly the same table, asserted. That is the guarantee, and the limit of it: the **present** is preserved exactly, and nothing else is promised.`, '',
    `What is lost is **every question about the past**: audit, debugging, replaying a different computation over old data, rebuilding a consumer that wants the history rather than the state. Here ${DISTINCT_PAST} past values go. And the function that asks must return **UNANSWERABLE** rather than the current value, because answering ${TABLE[ASKED]} to a question about the ${MID}${MID === 1 ? 'st' : MID === 2 ? 'nd' : 'rd'} change is a confident wrong answer rather than a missing one.`, '',
    `Two things to volunteer. A **deletion must be an entry** saying "gone", not an absence — the fold builds the table only from entries, so a key removed by omission is never removed at all, and that entry is the one compaction may not drop until every consumer has passed it. And **retention is set by the most demanding consumer**, not by the storage budget: a consumer needing current state can start from the compacted log, and one needing history cannot.`,
  ],
  variations: [
    { name: 'the cache that must not go stale', surface: 'web infrastructure',
      statement: [`A service keeps an in-memory copy of a table. **Keep it current** as changes happen.`],
      whyHard: `Folding the changelog into memory is exactly the chapter's program, and the operational question is what happens at start-up: the service must fold from somewhere, and the compacted log is precisely the "somewhere" that makes that cheap — ${COMPACT.length} entries instead of ${N}. The subtlety is that it must then switch from reading history to following live changes without a gap, which is the read-then-watch race from another chapter arriving here as a start-up sequence. Recognising that compaction exists for restarts as much as for disk is the content.`,
      maps: `\`fold\` over the compacted log, then continuing over live entries — with the handover point being the version the fold reached.` },

    { name: 'the audit log that was compacted', surface: 'compliance',
      statement: [`A regulator asks what a record held on a date two years ago. **The log was compacted last year.**`],
      whyHard: `The answer is that the question cannot be answered, and the valuable part is that this was decided a year ago by someone optimising disk. The useful framing separates two logs that were conflated: a **state** log, which may be compacted freely, and an **audit** log, which may not — and they have different retention, different access patterns and often different storage. Arriving at "these were never the same log and treating them as one was the mistake" is better than any recovery scheme, because there is no recovery scheme.`,
      maps: `\`valueAfter\` returning UNANSWERABLE, which is the traced frame — here with a person on the other end of it.` },

    { name: 'the counter changelog', surface: 'metrics',
      statement: [`The entries say **what changed** — "+5" — rather than what the key became. **Fold them, and compact them.**`],
      whyHard: `The fold now needs addition rather than assignment, which still works, and compaction **breaks**: you cannot keep "the last +5" and drop the earlier ones, because every entry contributes. The repair is to convert the log to absolute values first — fold, then emit — which is exactly the chapter's two functions composed, and it reveals why the log's format mattered in the first frame. The general rule is that a log of *deltas* cannot be compacted and a log of *states* can, so the format is a decision about retention and not about convenience.`,
      maps: `\`fold\` with \`+\` in place of \`=\`, and \`compact\` becoming invalid until \`fold\` and \`emit\` have converted the deltas to states.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch06-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is five paragraphs; this is both conversions running and then the compaction measured, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured: ${N} changes fold to **${KEYS.length} entries** — ${tStr(TABLE)}. Emitting that table back gives **${EMITTED.length}** entries, not ${N}. Compaction drops **${LOST} of ${N}** and the result folds to the same table, asserted key by key. Then the history question: key ${ASKED} passed through ${HIST.join(', ')}, so its ${MID}${MID === 1 ? 'st' : MID === 2 ? 'nd' : 'rd'} value is **${HIST[MID - 1]}** from the full log and **UNANSWERABLE** from the compacted one, with ${DISTINCT_PAST} past values gone across all keys.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x100, 0x200 and 0x300 hold the same information in three forms, and the whole section is about which questions each form can answer. Every figure is asserted — including that there are at least two keys (so compaction is visibly per-key), that the changelog really is longer than the compacted one, that folding the **compacted** log reproduces the table exactly (the claim compaction rests on), that the emitted stream is shorter than the original (so the asymmetry is visible), that the asked-about key has at least three entries, and that no two changelog entries are identical. Generated by \`node tools/gen_ch06_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch06-interview-memory`);
console.log(`    ${N} changes -> ${KEYS.length} table entries · emit ${EMITTED.length} · compact drops ${LOST}, same table: ${SAME_TABLE} · ${ASKED} history [${HIST.join(',')}], ${DISTINCT_PAST} past values lost`);
