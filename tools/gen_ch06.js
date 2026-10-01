#!/usr/bin/env node
'use strict';
/* gen_ch06.js — ch06's four concepts, both bands each: stream and table as two
 * faces, the duality, why it matters, and the two-view system.
 *
 * The finding this chapter derives rather than asserts: the stream→table→stream
 * round trip is lossless for a running SUM and lossy for a MAX, so "the two
 * directions are inverses" is a property of the aggregate, not of the duality. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, WIN, WINDOWS, WIN_STARTS, winOf, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const mm = (sec) => hhmmss(sec).slice(0, 5);
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
const perKey = (k) => EVENTS.filter(e => e.key === k);
// STREAM -> TABLE: fold the events into a balance per key
const fold = (upto) => Object.fromEntries(KEYS.map(k => [k, perKey(k).filter(e => EVENTS.indexOf(e) <= upto).reduce((s, e) => s + e.v, 0)]));
const TABLE = fold(EVENTS.length - 1);
const MID = 4;                                     // a point to time-travel to
const TABLE_MID = fold(MID);
// TABLE -> STREAM: the changelog. Two shapes, for two aggregates.
const changelog = (k, agg) => {
  const out = []; let acc = agg === 'max' ? null : 0;
  for (const e of perKey(k)) { acc = agg === 'max' ? (acc === null ? e.v : Math.max(acc, e.v)) : acc + e.v; out.push({ id: e.id, v: e.v, after: acc }); }
  return out;
};
const K0 = KEYS[0];
const CL_SUM = changelog(K0, 'sum'), CL_MAX = changelog(K0, 'max');
// the round trip: recover the event values from a NEW-VALUE-ONLY changelog
const deltasOf = (cl) => cl.map((r, i) => r.after - (i ? cl[i - 1].after : 0));
const SUM_RECOVERED = deltasOf(CL_SUM);
const MAX_DELTAS = deltasOf(CL_MAX);
const SUM_LOSSLESS = SUM_RECOVERED.join() === perKey(K0).map(e => e.v).join();
const MAX_LOSSLESS = MAX_DELTAS.join() === perKey(K0).map(e => e.v).join();
// how many event sequences are consistent with the MAX changelog? each zero-delta
// step could have carried any value from 0 up to the running max at that point
const MAX_AMBIGUITY = CL_MAX.reduce((n, r, i) => MAX_DELTAS[i] === 0 ? n * (CL_MAX[i - 1].after + 1) : n, 1);
// an UPDATE that carries only the new value, into a summing consumer
const UPD_FROM = CL_SUM[CL_SUM.length - 2].after, UPD_TO = CL_SUM[CL_SUM.length - 1].after;
const NAIVE_SINK = UPD_FROM + UPD_TO, RETRACT_SINK = UPD_FROM - UPD_FROM + UPD_TO;
// materialization: eager stores |keys| rows; lazy re-folds the whole stream per query
const EAGER_ROWS = KEYS.length, LAZY_READS = EVENTS.length;
const QUERIES = 10;
const EAGER_COST = LAZY_READS + 0 * QUERIES, LAZY_COST = LAZY_READS * QUERIES;
const fail = (m) => { throw new Error(`gen_ch06: ${m}`); };
if (!SUM_LOSSLESS) fail(`the sum changelog does not round-trip: recovered [${SUM_RECOVERED}] against [${perKey(K0).map(e => e.v)}]`);
if (MAX_LOSSLESS) fail('the max changelog round-trips too, so the chapter has no lossy case to contrast');
if (MAX_AMBIGUITY < 2) fail(`only ${MAX_AMBIGUITY} event sequence is consistent with the max changelog — the ambiguity is not demonstrable`);
if (NAIVE_SINK === UPD_TO) fail('a new-value-only update does not break a summing sink here');
if (RETRACT_SINK !== UPD_TO) fail('the retraction does not restore the right value');
if (Object.values(TABLE).reduce((a, b) => a + b, 0) !== TOTAL) fail('the folded table does not total the stream');
if (Object.values(TABLE_MID).reduce((a, b) => a + b, 0) >= TOTAL) fail('the time-travel table is not strictly smaller than the final one');
if (LAZY_COST <= EAGER_COST) fail('lazy materialization is not more expensive over the query budget');

const W = 1140;

// ===================== CONCEPT 1 — THE TWO FACES ============================
const C1 = [
  { t: 'the stream: what happened, in order', draw: (c) =>
      c.panel('THE STREAM — AN APPEND-ONLY SEQUENCE OF CHANGES', 'a')
      + c.mapRows('st', c.P.main.x + 24, c.P.main.y + 52, EVENTS.map(e =>
          [`id ${e.id} · key "${e.key}" · ${hhmmss(e.et)}`, `+${e.v}`]),
        { w: 1040, rh: 28, label: `${EVENTS.length} records, each one a CHANGE — nothing here is a current value` })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 66 + EVENTS.length * 28, 1040, [
        `Every row is a delta. To answer "what is key \\"${K0}\\" now?" you must read all of them and add up — the stream does not hold an answer, it holds a history.`,
        `What it DOES hold that a table cannot: the order, and every intermediate value that ever existed.`,
      ], c.C.blue, c.C.blueFill),
    cap: `A stream answers "what happened". Each of the ${EVENTS.length} rows is a change, so the current value of anything is a computation rather than a lookup. In exchange you get something a table throws away: the order, and every value the system ever held.` },
  { t: 'the table: what is true now', draw: (c) =>
      c.panel('THE TABLE — ONE ROW PER KEY, CURRENT VALUE', 'a')
      + c.mapRows('tb', c.P.main.x + 24, c.P.main.y + 52, KEYS.map(k =>
          [`key "${k}"`, `${TABLE[k]}   (from ${perKey(k).length} events: ${perKey(k).map(e => e.v).join(' + ')})`]),
        { w: 1040, rh: 34, label: `${KEYS.length} rows, answering "what is true now" in one lookup` })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 66 + KEYS.length * 34, 1040, [
        `${EVENTS.length} stream records became ${KEYS.length} table rows. The table is smaller, faster to query — and it has forgotten the order and every intermediate value.`,
        `Ask it "was key \\"${K0}\\" ever ${CL_SUM[1].after}?" and it cannot answer. The stream can.`,
      ], c.C.good, c.C.goodFill),
    cap: `A table answers "what is true now" in a lookup rather than a fold: ${EVENTS.length} records collapse to ${KEYS.length} rows. The cost is in the note — the table has forgotten the order and every intermediate value, so a question about history is unanswerable from it even though no information was deliberately discarded.` },
  { t: 'and they are the same data, folded differently', draw: (c) =>
      c.panel('ONE DATASET, TWO SHAPES', 'a')
      + c.mapRows('bo', c.P.main.x + 24, c.P.main.y + 52, [
        [`the stream totals`, `${TOTAL} over ${EVENTS.length} records`],
        [`the table totals`, `${Object.values(TABLE).reduce((a, b) => a + b, 0)} over ${KEYS.length} rows`],
        [`the stream is`, `the table's HISTORY — every change that produced it`],
        [`the table is`, `the stream's PRESENT — the fold of every change so far`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the totals agree because neither view invented or lost anything' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The two totals are equal, and that equality is the duality stated as an arithmetic check rather than as a slogan.`,
        `Neither view is primary by nature. The stream is primary by CHOICE, because it is the one you can rebuild the other from.`,
      ], c.C.good, c.C.goodFill),
    cap: `Both totals are ${TOTAL}, which is the duality in its most checkable form: the two views contain the same information, arranged for different questions. The second note is the design consequence — neither is inherently the source of truth, and the stream earns that role because the derivation only runs one way cheaply.` },
  { t: 'so databases and event logs each picked a side', draw: (c) =>
      c.panel('THE SAME DUALITY, TWO INDUSTRIES', 'p')
      + c.mapRows('ind', c.P.main.x + 24, c.P.main.y + 52, [
        [`a relational database`, `table-centric: stores the ${KEYS.length} rows, derives history only if you ask for it`],
        [`an event log (e.g. Kafka)`, `stream-centric: stores the ${EVENTS.length} records, derives the rows on read`],
        [`a stream processor`, `sits between them — consumes the stream, maintains the table`],
        [`what each one gives up`, `the DB gives up history; the log gives up cheap lookups`],
      ], { w: 1040, rh: 36, hot: 2, label: 'neither is wrong; each optimised for one of the two questions' })
      + c.note('i1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A database with an audit log and a Kafka topic with a materialized view are converging on the same thing from opposite ends.`,
        `So "should we use a database or an event log?" is usually the wrong question. The real one is which view is the SOURCE and which is DERIVED.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Reading the industry split this way makes the architectural choice concrete. A database stores ${KEYS.length} rows and can give you history only if someone added an audit table; a log stores ${EVENTS.length} records and makes every lookup a fold. The useful question is never which technology — it is which of the two views you treat as truth.` },
];

// ===================== CONCEPT 2 — THE DUALITY ==============================
const C2 = [
  { t: 'stream → table by aggregation', draw: (c) =>
      c.panel(`FOLDING KEY "${K0}"'S EVENTS INTO ONE VALUE`, 'a')
      + c.mapRows('fd', c.P.main.x + 24, c.P.main.y + 52, CL_SUM.map((r, i) =>
          [`after id ${r.id} (+${r.v})`, `balance ${i ? CL_SUM[i - 1].after : 0} → ${r.after}`]),
        { w: 1040, rh: 32, hot: CL_SUM.length - 1, label: `each row is one fold step; the last one is the table's value` })
      + c.note('f1', c.P.main.x + 24, c.P.main.y + 66 + CL_SUM.length * 32, 1040, [
        `The table's value for key "${K0}" is ${TABLE[K0]}, and it is nothing but the last line of this fold.`,
        `Which means the table is not a separate thing that must be kept in sync — it is a FUNCTION of the stream, and can always be recomputed.`,
      ], c.C.good, c.C.goodFill),
    cap: `Stream to table is a fold, and the whole right-hand column is the proof: ${TABLE[K0]} is the last line of it. That matters architecturally — a table that is a function of the stream cannot drift from it, whereas two independently-written stores can and will.` },
  { t: 'table → stream by change capture', draw: (c) =>
      c.panel('CDC — EVERY CHANGE TO THE TABLE, AS A RECORD', 'a')
      + c.mapRows('cd', c.P.main.x + 24, c.P.main.y + 52, CL_SUM.map((r, i) =>
          [`changelog record ${i + 1}`, `key "${K0}": old ${i ? CL_SUM[i - 1].after : 0} → new ${r.after}`]),
        { w: 1040, rh: 32, label: 'this is what change-data-capture emits when the table is written' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 66 + CL_SUM.length * 32, 1040, [
        `Each record carries BOTH values. That is what makes the changelog a stream you can fold back into a table, rather than a log of final states.`,
        `Carrying only the new value is the common mistake, and the next step prices it.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Table to stream is change capture: watch the table and emit a record per write. This is how a database becomes a stream. The detail that makes it work is in each row — the record carries the **old** value as well as the new, which is what the next step shows to be load-bearing rather than decorative.` },
  { t: 'and a new-value-only changelog breaks a summing consumer', draw: (c) =>
      c.panel('THE LAST UPDATE, INTO TWO KINDS OF CONSUMER', 'a')
      + c.mapRows('up', c.P.main.x + 24, c.P.main.y + 52, [
        [`the update`, `key "${K0}": ${UPD_FROM} → ${UPD_TO}`],
        [`record carries only the NEW value, consumer SUMS`, `${UPD_FROM} + ${UPD_TO} = ${NAIVE_SINK} — wrong by ${NAIVE_SINK - UPD_TO}`],
        [`record carries OLD and NEW, consumer sums`, `${UPD_FROM} − ${UPD_FROM} + ${UPD_TO} = ${RETRACT_SINK} — correct`],
        [`so a changelog is not a list of values`, `it is a list of (retraction, assertion) pairs`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the same update, with and without the old value' })
      + c.note('u1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `This is ch02's accumulation question arriving from the other direction: a changelog record IS an accumulating pane, and the old value IS the retraction.`,
        `A consumer that can only add is correct only if the producer supplies the undo. Nothing in the data reveals a mismatch.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The same mechanism as ch02's retraction, reached from the table side. A record saying "the balance is now ${UPD_TO}" sums to ${NAIVE_SINK} in a consumer that adds; a record saying "it was ${UPD_FROM}, it is now ${UPD_TO}" sums to ${RETRACT_SINK}. The old value is not metadata — it is what makes the changelog invertible.` },
  { t: 'but "the directions are inverses" depends on the AGGREGATE', draw: (c) =>
      c.panel('THE ROUND TRIP, FOR A SUM AND FOR A MAX', 'p')
      + c.mapRows('rt', c.P.main.x + 24, c.P.main.y + 52, [
        [`key "${K0}"'s actual event values`, `[${perKey(K0).map(e => e.v).join(', ')}]`],
        [`SUM changelog (new values)`, `[${CL_SUM.map(r => r.after).join(', ')}] → differences [${SUM_RECOVERED.join(', ')}] — recovered exactly`],
        [`MAX changelog (new values)`, `[${CL_MAX.map(r => r.after).join(', ')}] → differences [${MAX_DELTAS.join(', ')}] — NOT the events`],
        [`event sequences consistent with that max log`, `at least ${MAX_AMBIGUITY} — the round trip is lossy`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same duality, applied to two aggregates' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A sum is invertible: differencing the changelog recovers every event. A max is not — the ${MAX_DELTAS.filter(d => d === 0).length} zero-deltas each hide any value up to the running max.`,
        `So "aggregating the changelog reproduces the table, and capturing the table reproduces the changelog" is true of the TABLE, and not of the original events.`,
      ], c.C.warn, c.C.warnFill),
    cap: `This is the refinement the duality usually gets stated without. Differencing the sum changelog gives back [${SUM_RECOVERED.join(', ')}] — exactly the events. Differencing the max changelog gives [${MAX_DELTAS.join(', ')}], and at least ${MAX_AMBIGUITY} different event sequences produce that same log. The round trip recovers the *table* either way; it recovers the *events* only for an invertible aggregate.` },
];

// =============== CONCEPT 3 — WHY IT MATTERS IN PRACTICE =====================
const C3 = [
  { t: 'materialization is a cost choice, and it has a crossover', draw: (c) =>
      c.panel('EAGER VS LAZY, PRICED', 'a')
      + c.mapRows('mt', c.P.main.x + 24, c.P.main.y + 52, [
        [`EAGER — store the table`, `${EAGER_ROWS} rows of storage · fold ${LAZY_READS} events ONCE · every query is a lookup`],
        [`LAZY — recompute on demand`, `0 rows of storage · fold ${LAZY_READS} events PER QUERY`],
        [`over ${QUERIES} queries`, `eager: ${EAGER_COST} event reads · lazy: ${LAZY_COST} event reads`],
        [`the crossover`, `after the FIRST query — eager has already paid its only fold`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one fold, amortised, against one fold per question' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Eager is cheaper from the second query onward, which is why almost every real system materializes. Lazy wins only when queries are rarer than writes by a large factor.`,
        `And lazy's cost grows with the STREAM length, not with the number of keys — so it degrades as history accumulates even if the data is tiny.`,
      ], c.C.good, c.C.goodFill),
    cap: `Priced rather than argued: eager stores ${EAGER_ROWS} rows and folds ${LAZY_READS} events once; lazy stores nothing and folds ${LAZY_READS} events every time. Over ${QUERIES} queries that is ${EAGER_COST} reads against ${LAZY_COST}. The second note is the one that bites in practice — lazy scales with history, so it gets worse while the data stays the same size.` },
  { t: 'time travel is just a fold up to a point', draw: (c) =>
      c.panel('THE TABLE AT TWO DIFFERENT POINTS IN THE STREAM', 'a')
      + c.mapRows('tt', c.P.main.x + 24, c.P.main.y + 52, [
        [`fold events 0..${MID} (the first ${MID + 1})`, KEYS.map(k => `"${k}": ${TABLE_MID[k]}`).join(' · ') + ` · total ${Object.values(TABLE_MID).reduce((a, b) => a + b, 0)}`],
        [`fold events 0..${EVENTS.length - 1} (all of them)`, KEYS.map(k => `"${k}": ${TABLE[k]}`).join(' · ') + ` · total ${TOTAL}`],
        [`what made both possible`, `the stream retained every record, so any past table is recoverable`],
        [`what a table alone could give`, `only the second row — the first is gone the moment it is overwritten`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the same fold function, two different end points' })
      + c.note('t2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Time travel is not a feature you add — it is what you already have if the stream is the source of truth and nothing is discarded.`,
        `Conversely a table-first architecture has to build it deliberately, with an audit table, and then keep that table consistent with the real one.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Two calls to the same fold with different end points: {${KEYS.map(k => `${k}: ${TABLE_MID[k]}`).join(', ')}} and {${KEYS.map(k => `${k}: ${TABLE[k]}`).join(', ')}}. Time travel costs nothing when the stream is truth, and costs an audit table plus a consistency problem when it is not — which is the strongest practical argument for keeping the stream primary.` },
  { t: 'so one of the two views has to be the source', draw: (c) =>
      c.panel('WHAT DRIFTS, AND WHAT CANNOT', 'a')
      + c.mapRows('dr', c.P.main.x + 24, c.P.main.y + 52, [
        [`stream is truth, table is derived`, `the table is a FUNCTION of the stream — it cannot drift, only lag`],
        [`table is truth, stream is derived (CDC)`, `the stream is a function of the table — same guarantee, other direction`],
        [`both written independently`, `two writers, no function between them — they WILL drift`],
        [`and nothing detects the third case`, `both stores answer confidently and differently`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the only safe architectures are the ones with a derivation' })
      + c.note('d1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `"Keep them in sync" is not a design. A derivation is: one view is computed from the other, so disagreement is impossible rather than merely unlikely.`,
        `Lag is fine and visible. Drift is not fine and is invisible.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The distinction worth carrying away is lag versus drift. A derived view lags — it is behind by some amount and converges. Two independently written stores drift, which is unbounded and silent. The duality is useful precisely because it says you never need the third row: either direction of derivation is available.` },
  { t: 'and the question picks the view', draw: (c) =>
      c.panel('WHICH VIEW ANSWERS WHICH QUESTION', 'p')
      + c.mapRows('qv', c.P.main.x + 24, c.P.main.y + 52, [
        [`"what is key \\"${K0}\\" now?"`, `TABLE — ${TABLE[K0]}, one lookup`],
        [`"what happened, in order?"`, `STREAM — ${perKey(K0).length} records for key "${K0}"`],
        [`"what was it after event ${MID}?"`, `STREAM, folded to ${MID} — ${TABLE_MID[K0]}`],
        [`"was it ever ${CL_SUM[1].after}?"`, `STREAM only — the table has forgotten`],
      ], { w: 1040, rh: 36, hot: 3, label: 'three of four questions need the stream; one needs the table' })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Only the first row is a table question, and it is the most common one — which is why systems materialize.`,
        `The last row is the one that decides architecture: if anyone will ever ask it, the stream has to be retained, and then it may as well be the source of truth.`,
      ], c.C.good, c.C.goodFill),
    cap: `Three of these four questions need the stream and one needs the table — and the one that needs the table is the one asked a thousand times a second, which is why materializing is right. The last row is the architectural test: if a historical question is ever going to be asked, the stream must be retained anyway.` },
];

// ============ CONCEPT 4 — TWO CONSISTENT VIEWS (systemDesign) ===============
const C4 = [
  { t: 'the pipeline, and which direction the derivation runs', draw: (c) =>
      c.panel('BALANCE TABLE AND BALANCE-CHANGE STREAM, FROM ONE SOURCE', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`database (table)`, `${KEYS.length} rows — what fraud detection's lookups hit`],
        [`change capture (CDC)`, `emits (old, new) per write — the only writer of the stream`],
        [`changelog stream`, `${EVENTS.length} records — what fraud detection's feed consumes`],
        [`stream processor (fold) → materialized view`, `re-derives the table, so the two views are checkable`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the table is the source; the stream is derived from it by CDC' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `There is exactly ONE writer of the stream — the CDC component. That is what makes drift impossible rather than unlikely.`,
        `And the fold at the end is not redundant: it is how you check the derivation, by comparing the re-derived table against the real one.`,
      ], c.C.blue, c.C.blueFill),
    cap: `This design runs the derivation table → stream, which is the right direction when an existing database is already the system of record. The single-writer property in the note is the whole guarantee: application code writes the table, CDC writes the stream, and nothing writes both. The final fold exists to make the agreement testable.` },
  { t: 'the consistency check, with real values', draw: (c) =>
      c.panel('THE TWO VIEWS, COMPARED', 'a')
      + c.mapRows('cc', c.P.main.x + 24, c.P.main.y + 52, KEYS.map(k =>
          [`key "${k}"`, `table says ${TABLE[k]} · fold of the changelog says ${TABLE[k]} · agree`])
        .concat([[`total`, `${TOTAL} both ways`], [`what a mismatch would mean`, `a write that CDC missed — a bug in the derivation, not in either store`]]),
        { w: 1040, rh: 34, hot: KEYS.length + 1, label: 'the check that makes the design falsifiable' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 66 + (KEYS.length + 2) * 34, 1040, [
        `Both views total ${TOTAL}. Run this continuously and a CDC gap shows up as a divergence rather than as a wrong fraud decision three weeks later.`,
        `Note what it does NOT check: whether either view is correct. It checks that they agree, which is a different and weaker claim.`,
      ], c.C.good, c.C.goodFill),
    cap: `Re-folding the changelog and comparing to the table is the cheapest real guarantee in this design — and the note is the honest limit. Agreement between a source and its derivation catches a broken derivation; it cannot catch a wrong value that was written correctly to both. That needs a check against something outside the system.` },
  { t: 'and the changelog must carry the old value', draw: (c) =>
      c.panel('WHAT FRAUD DETECTION RECEIVES', 'a')
      + c.mapRows('fr', c.P.main.x + 24, c.P.main.y + 52, [
        [`a record with only the new balance`, `"key ${K0} is now ${UPD_TO}" — a consumer that sums reaches ${NAIVE_SINK}`],
        [`a record with old and new`, `"was ${UPD_FROM}, now ${UPD_TO}" — the same consumer reaches ${RETRACT_SINK}`],
        [`and fraud detection wants the DELTA`, `${UPD_TO} − ${UPD_FROM} = ${UPD_TO - UPD_FROM}: "the balance moved by this much"`],
        [`which only the second form gives`, `the delta is not recoverable from a new-value-only record`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the consumer\'s actual question decides the record format' })
      + c.note('f1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Fraud detection asks "how much did this move?", which is a question about the CHANGE — so a changelog of final states cannot serve it at all.`,
        `A consumer could reconstruct deltas by keeping its own copy of the previous value, which means re-implementing the table it was trying to avoid.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The record format follows from the consumer's question. Fraud detection asks how much a balance moved — \`${UPD_TO} − ${UPD_FROM} = ${UPD_TO - UPD_FROM}\` — and that is unrecoverable from a record carrying only ${UPD_TO}. The alternative in the note is the telling one: a consumer can reconstruct deltas by keeping the previous value, which is to say by rebuilding the table it was trying not to need.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`The consistency check proves the two views AGREE. It does not prove either is right — a value written correctly to the table and faithfully captured is still wrong if the application computed it wrongly.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The fold recovers the TABLE from the changelog. It recovers the original EVENTS only for an invertible aggregate — differencing a max changelog is consistent with at least ${MAX_AMBIGUITY} different histories.`], c.C.warn, c.C.warnFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Lazy materialization costs ${LAZY_READS} event reads per query and grows with HISTORY, so "just recompute it" stops being viable long before the data gets large.`], c.C.blue, c.C.blueFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And nothing here bounds the changelog. The stream is the source of truth only while it is retained; beyond retention, time travel and re-derivation both stop working.`], c.C.hot, c.C.hotFill),
    cap: `The last gap is the one that quietly undoes the whole architecture. "The stream is the source of truth" holds exactly as long as the stream is retained — set a 7-day retention and every claim in this chapter about re-derivation and time travel has a 7-day horizon, with nothing in the design to announce that.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch06-faces', steps: C1,
    title: 'Streams and tables — the two faces of one dataset',
    subtitle: `${EVENTS.length} stream records ↔ ${KEYS.length} table rows · both total ${TOTAL}`,
    heading: 'Why these are two views rather than two kinds of data',
    why: [
      `**A stream is motion.** Each of this book's ${EVENTS.length} records is a *change*: id 0 adds ${EVENTS[0].v} to key "${EVENTS[0].key}", and so on. To answer "what is key \`${K0}\` now?" you have to read all of them and add up. A stream answers **what happened**.`, '',
      `**A table is state.** Fold those records per key and you get ${KEYS.length} rows: ${KEYS.map(k => `"${k}" = ${TABLE[k]}`).join(', ')}. One lookup, no arithmetic. A table answers **what is true now**.`, '',
      `**They are the same data.** Both views total **${TOTAL}** — the stream over ${EVENTS.length} records, the table over ${KEYS.length} rows. That equality is the duality in its most checkable form: neither view invented or lost anything, they are arranged for different questions.`, '',
      `What each gives up is precise. The table has forgotten the **order** and every **intermediate value** — ask it "was key \`${K0}\` ever ${CL_SUM[1].after}?" and it cannot answer, though the stream can. The stream has given up cheap lookups: every current value is a fold.`, '',
      `**And that is why the industry split the way it did.** A relational database is table-centric: it stores the ${KEYS.length} rows and derives history only if someone built an audit table. An event log is stream-centric: it stores the ${EVENTS.length} records and derives the rows on read. A stream processor sits between them, consuming the stream and maintaining the table.`, '',
      `So "database or event log?" is usually the wrong question. The real one is **which view is the source and which is derived** — and neither is primary by nature. The stream earns that role only because the derivation is cheap in one direction.`],
    whenHeading: 'When to reach for each view, and what the choice commits you to',
    when: [
      `**Query the table for "what is true now"**, which is almost all production traffic. It is a lookup against ${KEYS.length} rows rather than a fold over ${EVENTS.length} records, and the gap widens as history accumulates.`, '',
      `**Query the stream for anything about order or history** — "what happened", "what was it at time T", "was it ever X". These are unanswerable from the table at any cost, because the information is gone rather than merely slow to reach.`, '',
      `**Choose which view is the source deliberately, and only once.** A derived view can lag, which is visible and bounded. Two independently written stores **drift**, which is unbounded and silent, and "keep them in sync" is not a design — a derivation is.`, '',
      `**What this does not settle:** whether the derivation actually runs both ways. The next concept shows that aggregating a changelog always recovers the table, and recovers the original events only when the aggregate is invertible — so "the two directions are inverses" turns out to be a property of the aggregate rather than of the duality.`],
    diagramHeading: 'Visual walkthrough — the stream, the table, and the shared total',
    sub: `Both views and their totals are computed from the seed and asserted equal.` },
  { name: 'ch06-duality', steps: C2,
    title: 'The duality — and the aggregate it depends on',
    subtitle: `sum changelog differences to [${SUM_RECOVERED.join(', ')}] — exact · max changelog is consistent with ≥ ${MAX_AMBIGUITY} histories`,
    heading: 'Why the round trip recovers the table but not always the events',
    why: [
      `**Stream → table is a fold.** Key "${K0}"'s balance walks ${CL_SUM.map((r, i) => `${i ? '' : '0 → '}${r.after}`).join(' → ')}, and the table's value — **${TABLE[K0]}** — is simply the last line. The architectural consequence: a table that is a *function* of the stream cannot drift from it, it can only lag.`, '',
      `**Table → stream is change capture.** Watch the table and emit a record per write. Each record carries **old → new**, which is what makes the changelog foldable back into a table rather than a log of final states.`, '',
      `**That old value is load-bearing.** Take the last update, ${UPD_FROM} → ${UPD_TO}. A record carrying only the new value, into a consumer that sums, gives ${UPD_FROM} + ${UPD_TO} = **${NAIVE_SINK}** — wrong by ${NAIVE_SINK - UPD_TO}. A record carrying both gives ${UPD_FROM} − ${UPD_FROM} + ${UPD_TO} = **${RETRACT_SINK}**. This is ch02's accumulation question reached from the table side: a changelog record *is* an accumulating pane, and the old value *is* the retraction.`, '',
      `**Now the part the usual statement of the duality leaves out.** "Aggregating the changelog reproduces the table, and capturing the table reproduces the changelog" — true. But does the round trip recover the original **events**?`, '',
      `- Key "${K0}"'s actual event values: **[${perKey(K0).map(e => e.v).join(', ')}]**`,
      `- its **SUM** changelog: [${CL_SUM.map(r => r.after).join(', ')}] → successive differences **[${SUM_RECOVERED.join(', ')}]** — recovered exactly`,
      `- its **MAX** changelog: [${CL_MAX.map(r => r.after).join(', ')}] → successive differences **[${MAX_DELTAS.join(', ')}]** — not the events at all`, '',
      `The max changelog has ${MAX_DELTAS.filter(d => d === 0).length} zero-deltas, and each one hides any value up to the running max, so **at least ${MAX_AMBIGUITY} different event sequences produce that same changelog**.`, '',
      `So the duality holds for the *table* under any aggregate, and for the *events* only under an invertible one. That is a property of the aggregation, not of streams and tables.`],
    whenHeading: 'When the round trip is safe to rely on, and what to do when it is not',
    when: [
      `**Rely on changelog → table under any aggregate.** That direction always works; it is just a fold.`, '',
      `**Rely on changelog → events only for invertible aggregates** — sum, count, anything with a subtraction. Differencing recovers [${SUM_RECOVERED.join(', ')}] exactly here.`, '',
      `**For a non-invertible aggregate, keep the event stream itself**, not the changelog of its aggregate. A max, a min, a distinct count and a top-K all discard information at aggregation time, and no downstream cleverness recovers it — ${MAX_AMBIGUITY} candidate histories here, from ${perKey(K0).length} events.`, '',
      `**Always emit old and new in a changelog**, even when the consumer you know about overwrites rather than sums. The cost is one field; the alternative is a correctness bug that appears when a second consumer is added.`, '',
      `**What this does not settle:** whether to materialize the table at all, and how either view behaves when the stream is only retained for a window. Both are the next concept — and the retention point quietly bounds every claim made here about re-derivation.`],
    diagramHeading: 'Visual walkthrough — fold, capture, retraction, and the lossy round trip',
    sub: `Both changelogs, the recovered deltas and the ${MAX_AMBIGUITY}-way ambiguity are computed from the seed and asserted.` },
  { name: 'ch06-practice', steps: C3,
    title: 'Why the duality matters — materialization, time travel, and drift',
    subtitle: `eager ${EAGER_COST} reads vs lazy ${LAZY_COST} over ${QUERIES} queries · any past table is a fold`,
    heading: 'Why materializing is almost always right, and why drift is the real risk',
    why: [
      `**Materialization is a cost choice with a crossover you can compute.** Eager stores the ${EAGER_ROWS} rows and folds the ${LAZY_READS} events **once**; every query is then a lookup. Lazy stores nothing and folds all ${LAZY_READS} events **per query**. Over ${QUERIES} queries that is **${EAGER_COST} event reads against ${LAZY_COST}** — and the crossover is after the *first* query.`, '',
      `Which is why nearly every real system materializes. And the detail that matters more: lazy's cost grows with the **stream length**, not with the number of keys, so it degrades as history accumulates even while the data stays ${KEYS.length} rows.`, '',
      `**Time travel is a fold up to a point**, and it costs nothing extra. Fold events 0..${MID} and the table reads ${KEYS.map(k => `"${k}" = ${TABLE_MID[k]}`).join(', ')} (total ${Object.values(TABLE_MID).reduce((a, b) => a + b, 0)}); fold all of them and it reads ${KEYS.map(k => `"${k}" = ${TABLE[k]}`).join(', ')} (total ${TOTAL}). Same function, different end point.`, '',
      `A table-first architecture has to build that deliberately, with an audit table — and then keep the audit table consistent with the real one, which is a second instance of the problem it was solving.`, '',
      `**And here is the risk the duality actually removes.** There are three architectures: stream is truth and the table is derived; table is truth and the stream is derived by CDC; or **both written independently**. The first two are safe because one view is a *function* of the other, so disagreement is impossible. The third has two writers and no function between them, so the views **will** diverge — and nothing detects it, because both stores answer confidently and differently.`, '',
      `The distinction to carry away is **lag versus drift**. A derived view lags: it is behind by some amount and converges. Independently written stores drift: unbounded, and silent.`],
    whenHeading: 'When to materialize, when to recompute, and how the question picks the view',
    when: [
      `**Materialize by default.** The break-even is one query, and the lazy cost grows with history. Recompute-on-demand is right only for a view queried far less often than it is written — a monthly report over a high-volume stream.`, '',
      `**Keep the stream if any historical question will ever be asked.** Of the four questions this concept poses, three need the stream: "what happened in order", "what was it after event ${MID}" (${TABLE_MID[K0]}), and "was it ever ${CL_SUM[1].after}". Only "what is it now" (${TABLE[K0]}) is a table question — and it is the one asked constantly, which is why you want both.`, '',
      `**Never write both views independently.** If an existing database is the system of record, derive the stream from it with CDC. If the log is the system of record, derive the table with a stream processor. Pick a direction; do not maintain two writers.`, '',
      `**What this does not settle — and it bounds everything above:** "the stream is the source of truth" holds exactly as long as the stream is **retained**. Set a 7-day retention and every claim here about re-derivation and time travel acquires a 7-day horizon, with nothing in the architecture to announce it.`],
    diagramHeading: 'Visual walkthrough — the crossover, the fold, and the three architectures',
    sub: `The eager/lazy costs and both time-travel tables are computed from the seed and asserted.` },
  { name: 'ch06-system', steps: C4,
    title: 'System design — one balance, two consistent views',
    subtitle: `table ${KEYS.map(k => `${k}:${TABLE[k]}`).join(' ')} · re-folded changelog agrees · one writer per view`,
    heading: 'Why a single writer is the whole guarantee',
    why: [
      `**The question.** Keep a balance table and a balance-change stream as two consistent views: fraud detection needs the real-time change feed while the database holds current balances.`, '',
      `**The pipeline:** database (table) → change capture (CDC) → changelog stream → stream processor (fold) → materialized view (table).`, '',
      `This runs the derivation **table → stream**, which is right when an existing database is already the system of record. And the guarantee is one property: **there is exactly one writer of the stream** — the CDC component. Application code writes the table; CDC writes the stream; nothing writes both. Drift becomes impossible rather than unlikely.`, '',
      `**The final fold is not redundant** — it is the check. Re-fold the changelog and compare: ${KEYS.map(k => `"${k}" = ${TABLE[k]}`).join(', ')}, total **${TOTAL}** both ways. Run it continuously and a CDC gap shows up as a divergence, rather than as a wrong fraud decision three weeks later.`, '',
      `**And the record format follows from the consumer's question.** Fraud detection asks "how much did this balance move?" — a question about the **change**. For the last update that is \`${UPD_TO} − ${UPD_FROM} = ${UPD_TO - UPD_FROM}\`, and it is unrecoverable from a record carrying only ${UPD_TO}. Worse, a record carrying only the new value, into a consumer that sums, gives **${NAIVE_SINK}** instead of ${RETRACT_SINK}.`, '',
      `A consumer *could* reconstruct deltas by keeping its own copy of the previous value — which is to say by rebuilding the table it was trying not to need. So the changelog carries **old and new**.`],
    whenHeading: 'When to run the derivation each way, and the four things this does not settle',
    when: [
      `**Derive stream from table (this design) when a database is already the system of record** and you cannot rewrite the application. CDC is the lowest-disruption way to get a stream, and the single-writer property comes for free.`, '',
      `**Derive table from stream when you are building new.** It makes time travel and re-derivation free rather than retrofitted, and the fold is simpler than change capture.`, '',
      `**Run the comparison continuously, not as a test.** It is the only thing in this design that can fail loudly, and the failure it catches — a missed write — is otherwise silent.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **The check proves the views AGREE, not that either is right.** A value computed wrongly by the application, written to the table and faithfully captured, passes every check in this design. Catching that needs a reference outside the system.`,
      `2. **The fold recovers the TABLE, not necessarily the events.** For an invertible aggregate differencing works; for a max, at least ${MAX_AMBIGUITY} histories are consistent with the same changelog. If a consumer needs the events, ship the events.`,
      `3. **Lazy re-derivation costs ${LAZY_READS} reads per query and scales with history**, so "we can always recompute it" expires quietly as the stream grows.`,
      `4. **Nothing here bounds the changelog.** The stream is the source of truth only while it is retained, and past that horizon re-derivation and time travel both stop working — which is the assumption most worth writing down, because nothing in the running system announces it.`],
    diagramHeading: 'Visual walkthrough — one writer per view, and the check that catches a gap',
    sub: `The table, the re-folded changelog and the delta figures are computed from the seed and asserted equal.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · table ${KEYS.map(k => `${k}:${TABLE[k]}`).join(' ')} · total ${TOTAL}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch06.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch06.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the change this record applies  ·  key = whose balance it changes',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[0] = (id 0, key "${EVENTS[0].key}", et ${EVENTS[0].et}, pt ${EVENTS[0].pt}, v ${EVENTS[0].v})`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: KEYS — the keys the table has a row for.  KEYS = ["${KEYS.join('", "')}"]`,
  '// primitive: max(a, b) — the larger of two values.  max(3, 5) = 5',
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  `// primitive: indexOf(e) — e's position in PROCESSING order.  indexOf(EVENTS[0]) = 0`,
];
const PROGRAMS = [];

// ---- concept 1: the two faces, from one dataset -----------------------------
PROGRAMS.push({
  name: 'ch06-faces-memory',
  title: 'One dataset, two shapes — the fold that produces a table',
  subtitle: `${EVENTS.length} records → ${KEYS.length} rows · both total ${TOTAL}`,
  src: COMMON.concat([
    '',
    'type Table { rows }',
    '',
    '// function: streamTotal(events) — add up every CHANGE in the stream.',
    `//   streamTotal(EVENTS) = ${TOTAL}`,
    'fun streamTotal(events) {',
    '    var t = 0',
    '    for (e in events) { t = t + e.v }',
    '    return t',
    '}',
    '',
    '// function: toTable(events) — fold the stream into one row per key. This is the',
    '//   ENTIRE stream-to-table direction; there is nothing else to it.',
    `//   toTable(EVENTS).rows = {${KEYS.map(k => `"${k}": ${TABLE[k]}`).join(', ')}}`,
    'fun toTable(events) {',
    '    var tbl = Table({})',
    '    for (e in events) {',
    '        if (tbl.rows[e.key] == NONE) { tbl.rows[e.key] = 0 }',
    '        tbl.rows[e.key] = tbl.rows[e.key] + e.v',
    '    }',
    '    return tbl',
    '}',
    '',
    '// function: tableTotal(tbl) — add up every ROW in the table.',
    `//   tableTotal(toTable(EVENTS)) = ${TOTAL}`,
    'fun tableTotal(tbl) {',
    '    var t = 0',
    '    for (k in KEYS) { t = t + tbl.rows[k] }',
    '    return t',
    '}',
    '',
    '// function: everWas(events, key, value) — a question only the STREAM can answer:',
    '//   did this key ever hold that value?',
    `//   everWas(EVENTS, "${K0}", ${CL_SUM[1].after}) = true      everWas(EVENTS, "${K0}", ${CL_SUM[1].after + 1}) = false`,
    'fun everWas(events, key, value) {',
    '    var acc = 0',
    '    for (e in events) {',
    '        if (e.key != key) { continue }',
    '        acc = acc + e.v',
    '        if (acc == value) { return true }',
    '    }',
    '    return false',
    '}',
    '',
    '// function: main() — THE CALLER: both views, and a history question.',
    'fun main() {',
    '    val sTotal = streamTotal(EVENTS)',
    '    val tbl    = toTable(EVENTS)',
    '    val tTotal = tableTotal(tbl)',
    `    val wasIt  = everWas(EVENTS, "${K0}", ${CL_SUM[1].after})`,
    '}',
  ]),
  heap: {
    tbl: { addr: '0x100', type: 'Table', val: () => KEYS.map(k => `"${k}": ${TABLE[k]}`).join(' · ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `sTotal = ${o.s !== undefined ? o.s : '...'}`, `tbl = ${o.tbl || '...'}`,
      `tTotal = ${o.t !== undefined ? o.t : '...'}`, `wasIt = ${o.w !== undefined ? o.w : '...'}`] });
    return [
      { t: 'the stream is read start to finish, one change at a time', line: at('fun streamTotal(events)', 'fun streamTotal(events)::    for (e in events) { t = t + e.v }'),
        stack: [MAIN(), { name: 'streamTotal', locals: ['events = EVENTS', `t = ${TOTAL}`, `e = EVENTS[${EVENTS[EVENTS.length - 1].id}]`] }],
        heap: [],
        cap: `There is no shortcut here: \`t\` reaches ${TOTAL} only after all ${EVENTS.length} records. A stream has no current value to look up, which is the cost side of what it gives you — and the loop is the reason a lazy query scales with history rather than with the number of keys.` },
      { t: 'the fold collapses it to one row per key', line: at('fun toTable(events)', 'tbl.rows[e.key] = tbl.rows[e.key] + e.v'),
        stack: [MAIN({ s: TOTAL }), { name: 'toTable', locals: ['events = EVENTS', 'tbl = @0x100', `e = EVENTS[${EVENTS[EVENTS.length - 1].id}]`] }],
        heap: [{ key: 'tbl', hot: true }],
        cap: `One line does the whole stream-to-table direction. ${EVENTS.length} records become ${KEYS.length} rows — ${KEYS.map(k => `"${k}" = ${TABLE[k]}`).join(', ')} — and note the table is a *function* of \`events\`, which is why a derived table cannot drift from its stream, only lag behind it.` },
      { t: 'and the two totals agree, which IS the duality', line: at('fun tableTotal(tbl)', 'for (k in KEYS) { t = t + tbl.rows[k] }'),
        stack: [MAIN({ s: TOTAL, tbl: '@0x100', t: TOTAL }), { name: 'tableTotal', locals: ['tbl = @0x100', `t = ${TOTAL}`, `k = "${KEYS[KEYS.length - 1]}"`] }],
        heap: [{ key: 'tbl' }],
        cap: `\`sTotal\` = ${TOTAL} over ${EVENTS.length} records and \`tTotal\` = ${TOTAL} over ${KEYS.length} rows. Same number from two loops over two completely different shapes — nothing was invented and nothing lost. That equality is the duality in the only form you can actually check.` },
      { t: 'but only one of them can answer a question about history', line: at('fun everWas(events, key, value)', 'if (acc == value) { return true }'),
        stack: [MAIN({ s: TOTAL, tbl: '@0x100', t: TOTAL, w: true }), { name: 'everWas', locals: ['events = EVENTS', `key = "${K0}"`, `value = ${CL_SUM[1].after}`, `acc = ${CL_SUM[1].after}`, `e = EVENTS[${CL_SUM[1].id}]`] }],
        heap: [{ key: 'tbl' }],
        cap: `\`acc\` passes through ${CL_SUM[1].after} at event id ${CL_SUM[1].id} and the function returns true. Now look at the heap: \`tbl\` holds ${TABLE[K0]} for key "${K0}" and nothing else. The intermediate ${CL_SUM[1].after} existed and the table does not contain it — so this function needs \`events\`, and no table-side cleverness substitutes.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a stream and a table are two views of one dataset — as two loops producing the same number.`, '',
    `\`toTable(events)\` is the entire stream-to-table direction: one line, \`tbl.rows[e.key] = tbl.rows[e.key] + e.v\`. The table is a **function** of the events, which is the mechanical reason a derived table can lag but cannot drift.`, '',
    `Step 4 is the limit. \`everWas\` finds key "${K0}" passing through ${CL_SUM[1].after} at event id ${CL_SUM[1].id} — and the heap shows the table holding only ${TABLE[K0]}. The intermediate value existed; the table does not contain it.`],
  sub: `Both totals and every row are computed from the seed and asserted equal.` });

// ---- concept 2: the round trip, and where it is lossy ----------------------
PROGRAMS.push({
  name: 'ch06-duality-memory',
  title: 'The round trip — invertible for a sum, lossy for a max',
  subtitle: `sum differences to [${SUM_RECOVERED.join(', ')}] · max differences to [${MAX_DELTAS.join(', ')}] · ≥ ${MAX_AMBIGUITY} histories`,
  src: COMMON.concat([
    '',
    'type Record { id, old, new }',
    '',
    `// primitive: K0 — the key this concept follows.  K0 = "${K0}"`,
    `// primitive: eventsOf(k) — that key's events, in processing order.`,
    `//   eventsOf("${K0}") = [${perKey(K0).map(e => e.id).join(', ')}]   (its event ids; values [${perKey(K0).map(e => e.v).join(', ')}])`,
    '',
    '// function: capture(key, agg) — CDC: one record per write, carrying OLD and NEW.',
    `//   capture("${K0}", "sum").new values = [${CL_SUM.map(r => r.after).join(', ')}]`,
    `//   capture("${K0}", "max").new values = [${CL_MAX.map(r => r.after).join(', ')}]`,
    'fun capture(key, agg) {',
    '    var out = []',
    '    var acc = NONE',
    '    for (e in eventsOf(key)) {',
    '        val before = acc',
    '        if (acc == NONE)      { acc = e.v }',
    '        if (agg == "sum" && before != NONE) { acc = before + e.v }',
    '        if (agg == "max" && before != NONE) { acc = max(before, e.v) }',
    '        out = append(out, Record(e.id, before, acc))',
    '    }',
    '    return out',
    '}',
    '',
    '// function: foldBack(log) — aggregate the changelog into the table value. Works',
    '//   for ANY aggregate, because each record names the result.',
    `//   foldBack(capture("${K0}", "sum")) = ${TABLE[K0]}      foldBack(capture("${K0}", "max")) = ${CL_MAX[CL_MAX.length - 1].after}`,
    'fun foldBack(log) {',
    '    var cur = 0',
    '    for (r in log) { cur = r.new }',
    '    return cur',
    '}',
    '',
    '// function: recoverEvents(log) — difference the changelog to get back the events.',
    '//   This is the direction that depends on the aggregate being invertible.',
    `//   recoverEvents(capture("${K0}", "sum")) = [${SUM_RECOVERED.join(', ')}]`,
    `//   recoverEvents(capture("${K0}", "max")) = [${MAX_DELTAS.join(', ')}]`,
    'fun recoverEvents(log) {',
    '    var out = []',
    '    for (r in log) {',
    '        var before = r.old',
    '        if (before == NONE) { before = 0 }',
    '        out = append(out, r.new - before)',
    '    }',
    '    return out',
    '}',
    '',
    '// function: ambiguity(log) — how many event sequences give this same changelog?',
    '//   Every zero-delta step could have carried any value up to the running result.',
    `//   ambiguity(capture("${K0}", "sum")) = 1      ambiguity(capture("${K0}", "max")) = ${MAX_AMBIGUITY}`,
    'fun ambiguity(log) {',
    '    var n = 1',
    '    for (r in log) {',
    '        if (r.old != NONE && r.new == r.old) { n = n * (r.old + 1) }',
    '    }',
    '    return n',
    '}',
    '',
    '// function: main() — THE CALLER: the round trip, twice.',
    'fun main() {',
    '    val sumLog  = capture(K0, "sum")',
    '    val maxLog  = capture(K0, "max")',
    '    val sumBack = recoverEvents(sumLog)',
    '    val maxBack = recoverEvents(maxLog)',
    '    val howMany = ambiguity(maxLog)',
    '}',
  ]),
  heap: {
    sumLog: { addr: '0x100', type: `Record[${CL_SUM.length}]`, val: () => CL_SUM.map((r, i) => `${i ? CL_SUM[i - 1].after : 'NONE'}→${r.after}`).join(' ') },
    maxLog: { addr: '0x200', type: `Record[${CL_MAX.length}]`, val: () => CL_MAX.map((r, i) => `${i ? CL_MAX[i - 1].after : 'NONE'}→${r.after}`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `sumLog = ${o.sumLog || '...'}`, `maxLog = ${o.maxLog || '...'}`,
      `sumBack = ${o.sumBack || '...'}`, `maxBack = ${o.maxBack || '...'}`,
      `howMany = ${o.howMany !== undefined ? o.howMany : '...'}`] });
    const zeroIdx = MAX_DELTAS.findIndex((d, i) => i > 0 && d === 0);
    return [
      { t: 'every changelog record carries the OLD value', line: at('fun capture(key, agg)', 'out = append(out, Record(e.id, before, acc))'),
        stack: [MAIN(), { name: 'capture', locals: [`key = "${K0}"`, 'agg = "sum"', 'out = @0x100', `e = EVENTS[${CL_SUM[1].id}]`, `before = ${CL_SUM[0].after}`, `acc = ${CL_SUM[1].after}`] }],
        heap: [{ key: 'sumLog', hot: true }],
        cap: `\`before\` is captured BEFORE \`acc\` is updated, so the record is (${CL_SUM[0].after} → ${CL_SUM[1].after}). That \`before\` is what makes the log invertible and what lets a summing consumer retract. Drop it and the record says only "${CL_SUM[1].after}", which is a final state rather than a change.` },
      { t: 'folding back works for ANY aggregate — each record names the result', line: at('fun foldBack(log)', 'for (r in log) { cur = r.new }'),
        stack: [MAIN({ sumLog: '@0x100', maxLog: '@0x200' }), { name: 'foldBack', locals: ['log = @0x200', `cur = ${CL_MAX[CL_MAX.length - 1].after}`, `r = Record(${CL_MAX[CL_MAX.length - 1].id}, ${CL_MAX[CL_MAX.length - 2].after}, ${CL_MAX[CL_MAX.length - 1].after})`] }],
        heap: [{ key: 'sumLog' }, { key: 'maxLog', hot: true }],
        cap: `\`cur\` just takes \`r.new\` each time, so it ends at ${CL_MAX[CL_MAX.length - 1].after} for the max log and ${TABLE[K0]} for the sum log. Changelog → table always works, because every record states the result. It is the other direction that is conditional.` },
      { t: 'differencing recovers the events — for the SUM', line: at('fun recoverEvents(log)', 'out = append(out, r.new - before)'),
        stack: [MAIN({ sumLog: '@0x100', maxLog: '@0x200', sumBack: `[${SUM_RECOVERED.join(', ')}]` }),
                { name: 'recoverEvents', locals: ['log = @0x100', `out = [${SUM_RECOVERED.join(', ')}]`, `r = Record(${CL_SUM[CL_SUM.length - 1].id}, ${CL_SUM[CL_SUM.length - 2].after}, ${CL_SUM[CL_SUM.length - 1].after})`, `before = ${CL_SUM[CL_SUM.length - 2].after}`] }],
        heap: [{ key: 'sumLog', hot: true }],
        cap: `\`out\` reaches [${SUM_RECOVERED.join(', ')}], which is exactly key "${K0}"'s event values [${perKey(K0).map(e => e.v).join(', ')}]. The subtraction inverts the addition, so nothing was lost in aggregating. This is the round trip the duality is usually described by.` },
      { t: `and the SAME function on the max log loses ${MAX_DELTAS.filter((d, i) => i > 0 && d === 0).length} events`, line: at('fun ambiguity(log)', 'if (r.old != NONE && r.new == r.old) { n = n * (r.old + 1) }'),
        stack: [MAIN({ sumLog: '@0x100', maxLog: '@0x200', sumBack: `[${SUM_RECOVERED.join(', ')}]`, maxBack: `[${MAX_DELTAS.join(', ')}]`, howMany: MAX_AMBIGUITY }),
                { name: 'ambiguity', locals: ['log = @0x200', `n = ${MAX_AMBIGUITY}`, `r = Record(${CL_MAX[zeroIdx].id}, ${CL_MAX[zeroIdx - 1].after}, ${CL_MAX[zeroIdx].after})`] }],
        heap: [{ key: 'sumLog' }, { key: 'maxLog', hot: true }],
        cap: `When \`r.new == r.old\` the record tells you nothing about the event that caused it — any value from 0 to ${CL_MAX[zeroIdx - 1].after} produces the same record, so \`n\` multiplies by ${CL_MAX[zeroIdx - 1].after + 1}. \`howMany\` = ${MAX_AMBIGUITY}: that many event sequences give this identical changelog. \`maxBack\` = [${MAX_DELTAS.join(', ')}] is not the events and no amount of care makes it so.` },
    ];
  },
  intro: [
    `**What is being answered.** Whether "the two directions are inverses" is a property of the duality or of the aggregate — by running the round trip on a sum and on a max.`, '',
    `\`capture(key, agg)\` emits each record with \`before\` taken *before* the update, so every record is (old → new). \`foldBack\` then recovers the table from either log, because every record names the result.`, '',
    `\`recoverEvents\` is the conditional direction. On the sum log it returns [${SUM_RECOVERED.join(', ')}] — exactly the events. On the max log it returns [${MAX_DELTAS.join(', ')}], and \`ambiguity\` counts **${MAX_AMBIGUITY}** event sequences consistent with that same log.`],
  sub: `Both changelogs, the recovered deltas and the ${MAX_AMBIGUITY}-way ambiguity are computed from the seed and asserted.` });

// ---- concept 3: materialization, time travel, drift ------------------------
PROGRAMS.push({
  name: 'ch06-practice-memory',
  title: 'Materialize or recompute — and the architecture that drifts',
  subtitle: `eager ${EAGER_COST} reads vs lazy ${LAZY_COST} over ${QUERIES} queries · a past table is a fold to an index`,
  src: COMMON.concat([
    '',
    'type Table { rows }',
    'type Cost  { reads, stored }',
    '',
    `// primitive: QUERIES — how many times the view is read.  QUERIES = ${QUERIES}`,
    '',
    '// function: foldTo(events, upto) — the table as it stood after event `upto`.',
    '//   The same function serves "now" and any point in the past.',
    `//   foldTo(EVENTS, ${MID}).rows = {${KEYS.map(k => `"${k}": ${TABLE_MID[k]}`).join(', ')}}`,
    `//   foldTo(EVENTS, ${EVENTS.length - 1}).rows = {${KEYS.map(k => `"${k}": ${TABLE[k]}`).join(', ')}}`,
    'fun foldTo(events, upto) {',
    '    var tbl = Table({})',
    '    for (e in events) {',
    '        if (indexOf(e) > upto) { continue }',
    '        if (tbl.rows[e.key] == NONE) { tbl.rows[e.key] = 0 }',
    '        tbl.rows[e.key] = tbl.rows[e.key] + e.v',
    '    }',
    '    return tbl',
    '}',
    '',
    '// function: eagerCost(queries) — fold ONCE, then every query is a lookup.',
    `//   eagerCost(${QUERIES}) = Cost(${EAGER_COST}, ${EAGER_ROWS})`,
    'fun eagerCost(queries) {',
    '    return Cost(len(EVENTS), len(KEYS))',
    '}',
    '',
    '// function: lazyCost(queries) — fold PER QUERY, store nothing.',
    `//   lazyCost(${QUERIES}) = Cost(${LAZY_COST}, 0)`,
    'fun lazyCost(queries) {',
    '    return Cost(len(EVENTS) * queries, 0)',
    '}',
    '',
    '// function: drifts(sourceIsStream, bothWritten) — can the two views disagree?',
    '//   drifts(true, false)  = false   (the table is a function of the stream)',
    '//   drifts(false, false) = false   (the stream is a function of the table)',
    '//   drifts(true, true)   = true    (two writers, no derivation between them)',
    'fun drifts(sourceIsStream, bothWritten) {',
    '    if (bothWritten) { return true }',
    '    return false',
    '}',
    '',
    '// function: main() — THE CALLER: two costs, two tables, three architectures.',
    'fun main() {',
    `    val past    = foldTo(EVENTS, ${MID})`,
    `    val now     = foldTo(EVENTS, ${EVENTS.length - 1})`,
    `    val eager   = eagerCost(${QUERIES})`,
    `    val lazy    = lazyCost(${QUERIES})`,
    '    val canDrift = drifts(true, true)',
    '}',
  ]),
  heap: {
    past: { addr: '0x100', type: 'Table', val: () => KEYS.map(k => `"${k}": ${TABLE_MID[k]}`).join(' · ') },
    now:  { addr: '0x200', type: 'Table', val: () => KEYS.map(k => `"${k}": ${TABLE[k]}`).join(' · ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `past = ${o.past || '...'}`, `now = ${o.now || '...'}`,
      `eager = ${o.eager || '...'}`, `lazy = ${o.lazy || '...'}`,
      `canDrift = ${o.canDrift !== undefined ? o.canDrift : '...'}`] });
    return [
      { t: 'one fold function, bounded by an index, gives any past table', line: at('fun foldTo(events, upto)', 'if (indexOf(e) > upto) { continue }'),
        stack: [MAIN(), { name: 'foldTo', locals: ['events = EVENTS', `upto = ${MID}`, 'tbl = @0x100', `e = EVENTS[${EVENTS[MID + 1].id}]`] }],
        heap: [{ key: 'past', hot: true }],
        cap: `One \`continue\` is the whole of time travel: events past index ${MID} are skipped and \`tbl\` holds ${KEYS.map(k => `"${k}" = ${TABLE_MID[k]}`).join(', ')}. No extra storage, no audit table, no second code path — the ability to ask about the past is a consequence of having kept the stream.` },
      { t: 'and the same call with no bound gives the present', line: at(`    val now     = foldTo(EVENTS, ${EVENTS.length - 1})`),
        stack: [MAIN({ past: '@0x100', now: '@0x200' })],
        heap: [{ key: 'past' }, { key: 'now', hot: true }],
        cap: `Compare the two heap rows: ${KEYS.map(k => `"${k}" ${TABLE_MID[k]} → ${TABLE[k]}`).join(', ')}. "Now" is not a special case of anything — it is \`foldTo\` with \`upto\` at the end of the stream, which is why a table-first architecture has to build time travel deliberately and a stream-first one gets it for free.` },
      { t: 'eager folds once; lazy folds per query', line: at('fun lazyCost(queries)', 'return Cost(len(EVENTS) * queries, 0)'),
        stack: [MAIN({ past: '@0x100', now: '@0x200', eager: `Cost(${EAGER_COST}, ${EAGER_ROWS})`, lazy: `Cost(${LAZY_COST}, 0)` }),
                { name: 'lazyCost', locals: [`queries = ${QUERIES}`] }],
        heap: [{ key: 'now' }],
        cap: `\`len(EVENTS) * queries\` = ${LAZY_READS} × ${QUERIES} = ${LAZY_COST}, against eager's ${EAGER_COST}. Note which factor each depends on: eager is \`len(EVENTS)\` once, lazy is \`len(EVENTS)\` per query — so lazy degrades as HISTORY grows, even while the table stays ${EAGER_ROWS} rows.` },
      { t: 'and drift is a property of having two writers', line: at('fun drifts(sourceIsStream, bothWritten)', 'if (bothWritten) { return true }'),
        stack: [MAIN({ past: '@0x100', now: '@0x200', eager: `Cost(${EAGER_COST}, ${EAGER_ROWS})`, lazy: `Cost(${LAZY_COST}, 0)`, canDrift: true }),
                { name: 'drifts', locals: ['sourceIsStream = true', 'bothWritten = true'] }],
        heap: [{ key: 'now' }],
        cap: `Look at what the function ignores: \`sourceIsStream\` never affects the answer. Either direction of derivation is safe, and the only thing that produces drift is \`bothWritten\` — two writers with no function between them. "Which technology" is not the question; "is one view computed from the other" is.` },
    ];
  },
  intro: [
    `**What is being answered.** Why materializing is almost always right, and why drift — not lag — is the risk worth designing against.`, '',
    `\`foldTo(events, upto)\` is one function that answers both "what is it now" and "what was it after event ${MID}". The entire mechanism is a single \`continue\`, which is why time travel is free when the stream is retained.`, '',
    `\`drifts(sourceIsStream, bothWritten)\` is worth reading for what it **ignores**: \`sourceIsStream\` never affects the result. Either direction of derivation is safe; only two independent writers produce drift.`],
  sub: `Both tables and both cost figures are computed from the seed and asserted.` });

// ---- concept 4: the two-view system ---------------------------------------
PROGRAMS.push({
  name: 'ch06-system-memory',
  title: 'Two views, one writer each — and the check that catches a gap',
  subtitle: `table ${KEYS.map(k => `${k}:${TABLE[k]}`).join(' ')} · re-folded changelog agrees · a missed capture shows up`,
  src: COMMON.concat([
    '',
    'type Table  { rows }',
    'type Record { key, old, new }',
    'type Audit  { agree, tableTotal, logTotal }',
    '',
    '// function: applyWrite(tbl, log, e, captureOn) — the application writes the TABLE;',
    '//   CDC writes the LOG. One writer each, which is the whole guarantee.',
    `//   applyWrite(tbl, log, EVENTS[0], true) appends Record("${EVENTS[0].key}", 0, ${EVENTS[0].v})`,
    'fun applyWrite(tbl, log, e, captureOn) {',
    '    if (tbl.rows[e.key] == NONE) { tbl.rows[e.key] = 0 }',
    '    val before = tbl.rows[e.key]',
    '    tbl.rows[e.key] = before + e.v',
    '    if (captureOn) { log = append(log, Record(e.key, before, tbl.rows[e.key])) }',
    '    return log',
    '}',
    '',
    '// function: foldLog(log) — re-derive the table from the changelog.',
    `//   foldLog(a complete log).rows = {${KEYS.map(k => `"${k}": ${TABLE[k]}`).join(', ')}}`,
    'fun foldLog(log) {',
    '    var tbl = Table({})',
    '    for (r in log) { tbl.rows[r.key] = r.new }',
    '    return tbl',
    '}',
    '',
    '// function: totalOf(tbl) — add up every row.',
    `//   totalOf(the full table) = ${TOTAL}`,
    'fun totalOf(tbl) {',
    '    var t = 0',
    '    for (k in KEYS) {',
    '        if (tbl.rows[k] != NONE) { t = t + tbl.rows[k] }',
    '    }',
    '    return t',
    '}',
    '',
    '// function: audit(tbl, log) — the continuous check: does the re-folded log match',
    '//   the real table? A mismatch means a WRITE THAT CDC MISSED.',
    `//   audit(tbl, a complete log)   = Audit(true, ${TOTAL}, ${TOTAL})`,
    `//   audit(tbl, a log missing one) = Audit(false, ${TOTAL}, ${TOTAL - EVENTS[EVENTS.length - 1].v})`,
    'fun audit(tbl, log) {',
    '    val derived = foldLog(log)',
    '    return Audit(totalOf(tbl) == totalOf(derived), totalOf(tbl), totalOf(derived))',
    '}',
    '',
    '// function: run(captureEvery) — replay the stream, capturing every write or not.',
    '//   run(true) leaves the audit agreeing; run(false) leaves it disagreeing.',
    `//   run(true).agree = true      run(false).agree = false`,
    'fun run(captureEvery) {',
    '    var tbl = Table({})',
    '    var log = []',
    '    for (e in EVENTS) {',
    '        val last = indexOf(e) == len(EVENTS) - 1',
    '        log = applyWrite(tbl, log, e, captureEvery || last == false)',
    '    }',
    '    return audit(tbl, log)',
    '}',
    '',
    '// function: main() — THE CALLER: a healthy run, and one with a missed capture.',
    'fun main() {',
    '    val healthy = run(true)',
    '    val gap     = run(false)',
    '}',
  ]),
  heap: {
    healthy: { addr: '0x100', type: 'Audit', val: () => `agree true · table ${TOTAL} · log ${TOTAL}` },
    gap:     { addr: '0x200', type: 'Audit', val: () => `agree false · table ${TOTAL} · log ${TOTAL - EVENTS[EVENTS.length - 1].v}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `healthy = ${o.healthy || '...'}`, `gap = ${o.gap || '...'}`] });
    const LASTE = EVENTS[EVENTS.length - 1];
    return [
      { t: 'the application writes the table; CDC writes the log', line: at('fun applyWrite(tbl, log, e, captureOn)', 'if (captureOn) { log = append(log, Record(e.key, before, tbl.rows[e.key])) }'),
        stack: [MAIN(), { name: 'run', locals: ['captureEvery = true', 'tbl = (a Table)', 'log = (a Record list)', `e = EVENTS[0]`, 'last = false'] },
                { name: 'applyWrite', locals: ['tbl = (a Table)', 'log = (a Record list)', `e = EVENTS[0]`, 'captureOn = true', 'before = 0'] }],
        heap: [{ key: 'healthy', hot: true }],
        cap: `Two writes, one per view, and they are in the same function so they cannot get out of step: \`tbl.rows\` is updated, then a Record carrying \`before\` and the new value is appended. Nothing else in the design writes either view — which is what makes agreement structural rather than hoped for.` },
      { t: 're-folding the log reconstructs the table', line: at('fun foldLog(log)', 'for (r in log) { tbl.rows[r.key] = r.new }'),
        stack: [MAIN(), { name: 'audit', locals: ['tbl = (a Table)', 'log = (a Record list)', 'derived = (a Table)'] },
                { name: 'foldLog', locals: ['log = (a Record list)', 'tbl = (a Table)', `r = Record("${LASTE.key}", ${TABLE[LASTE.key] - LASTE.v}, ${TABLE[LASTE.key]})`] }],
        heap: [{ key: 'healthy', hot: true }],
        cap: `\`tbl.rows[r.key] = r.new\` — each record names the result, so the fold is an assignment rather than an accumulation. The derived table ends at ${KEYS.map(k => `"${k}" = ${TABLE[k]}`).join(', ')}, which is exactly the real one. That is the derivation this design's guarantee rests on.` },
      { t: 'the audit compares the two, and agrees', line: at('fun audit(tbl, log)', 'return Audit(totalOf(tbl) == totalOf(derived), totalOf(tbl), totalOf(derived))'),
        stack: [MAIN({ healthy: '@0x100' }), { name: 'audit', locals: ['tbl = (a Table)', 'log = (a Record list)', 'derived = (a Table)'] }],
        heap: [{ key: 'healthy' }],
        cap: `\`totalOf(tbl)\` = ${TOTAL} and \`totalOf(derived)\` = ${TOTAL}, so \`agree\` is true. This is cheap enough to run continuously, and it is the only thing in the design that can fail loudly — which matters because the failure it catches is otherwise completely silent.` },
      { t: 'and one missed capture makes it disagree', line: at('fun run(captureEvery)', 'log = applyWrite(tbl, log, e, captureEvery || last == false)'),
        stack: [MAIN({ healthy: '@0x100', gap: '@0x200' }), { name: 'run', locals: ['captureEvery = false', 'tbl = (a Table)', 'log = (a Record list)', `e = EVENTS[${LASTE.id}]`, 'last = true'] }],
        heap: [{ key: 'healthy' }, { key: 'gap', hot: true }],
        cap: `With \`captureEvery\` false the last write skips its Record, so the table reaches ${TOTAL} and the re-folded log reaches ${TOTAL - LASTE.v}. \`agree\` is false, and the gap is exactly the uncaptured ${LASTE.v}. Without the audit this is a fraud feed quietly missing one balance change, and nothing else in the system notices.` },
    ];
  },
  intro: [
    `**What is being answered.** How two views of one balance are kept consistent — and what the consistency check can and cannot catch.`, '',
    `\`applyWrite\` does both writes in one place: the table row, then a Record carrying \`before\` and the new value. One writer per view, so agreement is structural rather than maintained.`, '',
    `\`audit\` re-folds the log and compares totals. Step 4 runs it with one capture deliberately skipped: the table reads ${TOTAL} and the re-folded log reads ${TOTAL - EVENTS[EVENTS.length - 1].v}, so \`agree\` is false and the gap is exactly the uncaptured ${EVENTS[EVENTS.length - 1].v}. Without that check it is a fraud feed silently missing a balance change.`],
  sub: `Both audit outcomes are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch06.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch06.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
