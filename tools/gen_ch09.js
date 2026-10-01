#!/usr/bin/env node
'use strict';
/* gen_ch09.js — ch09's four concepts, both bands each: why joins are hard,
 * windowed vs temporal joins, correctness and state, and the ad-attribution join.
 *
 * The two keys are read as two streams: "a" is clicks, "b" is impressions. Every
 * figure — which matches exist, which are emitted on time, which need a retraction
 * and which are never emitted at all — is computed here and asserted. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, LATE, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const mm = (sec) => hhmmss(sec).slice(0, 5);
const secs = (n) => `${n}s`;
const LEFT = KEYS[0], RIGHT = KEYS[1];               // clicks, impressions
const lefts = EVENTS.filter(e => e.key === LEFT);
const rights = EVENTS.filter(e => e.key === RIGHT);
const idx = (e) => EVENTS.indexOf(e);
const J = LAG;                                        // the join window, in seconds
const L = LATE[0], LI = idx(L);
// every pair that TRULY matches, over the whole stream
const MATCHES = [];
for (const l of lefts) for (const r of rights) if (Math.abs(l.et - r.et) <= J) MATCHES.push([l.id, r.id]);
// per-source watermarks, and their minimum — a join claims the lower (ch03)
const sideWm = (k, i) => { const seen = EVENTS.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - LAG : null; };
const minWm = (i) => KEYS.some(k => sideWm(k, i) === null) ? null : Math.min(...KEYS.map(k => sideWm(k, i)));
// a left row's result may be emitted once the join watermark passes its window end
const emitIdxOf = (l) => { for (let i = 0; i < EVENTS.length; i++) { const w = minWm(i); if (w !== null && w > l.et + J) return i; } return null; };
const PLAN = lefts.map(l => {
  const ei = emitIdxOf(l);
  const all = MATCHES.filter(p => p[0] === l.id).map(p => p[1]);
  const onTime = ei === null ? [] : all.filter(rid => idx(EVENTS.find(e => e.id === rid)) <= ei);
  const lateArrivals = ei === null ? [] : all.filter(rid => idx(EVENTS.find(e => e.id === rid)) > ei);
  return { l, emitIdx: ei, all, onTime, lateArrivals };
});
const NEVER = PLAN.filter(p => p.emitIdx === null);
const NEEDS_RETRACTION = PLAN.filter(p => p.emitIdx !== null && p.lateArrivals.length);
const CLEAN = PLAN.filter(p => p.emitIdx !== null && !p.lateArrivals.length);
const EMITTED_ONTIME = PLAN.reduce((n, p) => n + p.onTime.length, 0);
const EMITTED_LATE = PLAN.reduce((n, p) => n + p.lateArrivals.length, 0);
const NEVER_MATCHES = NEVER.reduce((n, p) => n + p.all.length, 0);
// the BUFFER: how many rows a windowed join must hold at once
const bufferAt = (i) => EVENTS.filter((e, j) => j <= i && EVENTS.slice(j).some(() => true)
  && (minWm(i) === null || e.et + J >= minWm(i))).length;
const MAX_BUFFER = Math.max(...EVENTS.map((_, i) => bufferAt(i)));
// the TEMPORAL join: each left row probes the right side's state AS OF its own et
const temporalAt = (et) => rights.filter(r => r.et <= et).reduce((s, r) => s + r.v, 0);
const TEMPORAL = lefts.map(l => ({ l, value: rights.some(r => r.et <= l.et) ? temporalAt(l.et) : null }));
const TEMPORAL_NULL = TEMPORAL.filter(t => t.value === null).length;
const fail = (m) => { throw new Error(`gen_ch09: ${m}`); };
if (MATCHES.length < 3) fail(`only ${MATCHES.length} pairs match within ${J}s — the join has too little to show`);
if (!NEVER.length) fail('every left row eventually emits; the "never emitted" finding does not hold');
if (!NEEDS_RETRACTION.length) fail('no emitted result is later contradicted; there is no retraction case');
if (!CLEAN.length) fail('no result is emitted correctly on time; the contrast needs one');
if (EMITTED_ONTIME + EMITTED_LATE + NEVER_MATCHES !== MATCHES.length) fail('the match accounting does not add up');
if (TEMPORAL.length !== lefts.length) fail('the temporal join did not probe every left row');
if (!TEMPORAL_NULL) fail('no left row probes an empty table; the temporal-join NULL case is missing');
if (MAX_BUFFER < 2) fail('the join never buffers more than one row');

const W = 1140;

// =================== CONCEPT 1 — WHY JOINS ARE HARD =========================
const C1 = [
  { t: 'two unbounded inputs have no moment at which the join is done', draw: (c) =>
      c.panel('A BATCH JOIN COMPLETES; A STREAM-STREAM JOIN DOES NOT', 'a')
      + c.mapRows('jh', c.P.main.x + 24, c.P.main.y + 52, [
        [`batch: ${lefts.length} clicks x ${rights.length} impressions`, `${lefts.length * rights.length} candidate pairs, all testable, then done`],
        [`stream: the same two inputs`, `either side may still produce a match — forever`],
        [`so the join needs a TIME BOUND`, `match rows whose event times are within ${secs(J)} of each other`],
        [`within that bound, truly matching pairs`, `${MATCHES.length}: ${MATCHES.map(p => `${p[0]}-${p[1]}`).join(', ')}`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the bound is what gives the query a meaning at all' })
      + c.note('h1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Without the bound the join would have to retain every row of both sides forever, in case a match arrives.`,
        `So the time bound is not an optimisation — it is what makes the state finite AND the semantics defined.`,
      ], c.C.blue, c.C.blueFill),
    cap: `A batch join over these inputs tests ${lefts.length * lefts.length > 0 ? lefts.length * rights.length : 0} pairs and finishes. The streaming version never finishes on its own, so a time bound is mandatory — and with a ${secs(J)} bound there are exactly ${MATCHES.length} true matches here: ${MATCHES.map(p => `${p[0]}-${p[1]}`).join(', ')}. Everything that follows is about which of those ${MATCHES.length} actually get emitted.` },
  { t: 'the join must BUFFER one side while waiting for the other', draw: (c) => {
      let s = c.panel('WHAT IS HELD IN JOIN STATE, EVENT BY EVENT', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `rows still within ${secs(J)} of the join's watermark, so a match could still arrive for them`, { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('bf', c.P.main.x + 60, c.P.main.y + 64, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 24, size: 11, fill: c.C.cold });
      s += c.cells('bv', c.P.main.x + 60, c.P.main.y + 96, EVENTS.map((_, i) => String(bufferAt(i))), { cw: 110, ch: 26, size: 11,
        hotSet: new Set(EVENTS.map((_, i) => bufferAt(i) === MAX_BUFFER ? i : -1).filter(i => i >= 0)), hotFill: c.C.warnFill, hotEdge: c.C.warn });
      return s + c.note('b1', c.P.main.x + 24, c.P.main.y + 140, 1040, [
        `The buffer peaks at ${MAX_BUFFER} rows on this ${EVENTS.length}-row stream, and it is bounded only because the join window is.`,
        `Each buffered row is waiting for a counterpart that may never come. A join's state is therefore proportional to arrival rate times the join window.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `Rows cannot be matched and discarded immediately — each one waits for a counterpart. The buffer peaks at ${MAX_BUFFER} rows here, and the only reason it peaks at all rather than growing is the ${secs(J)} window. That makes join state (arrival rate × join window), which is the sizing formula to carry away.` },
  { t: 'and the watermark is what ends the wait', draw: (c) =>
      c.panel('WHEN EACH CLICK\'S RESULT MAY BE EMITTED', 'a')
      + c.mapRows('wt', c.P.main.x + 24, c.P.main.y + 52, PLAN.map(p =>
          [`click id ${p.l.id} (et ${hhmmss(p.l.et)})`, p.emitIdx === null
            ? `NEVER — the join watermark never passes ${hhmmss(p.l.et + J)}`
            : `after event ${p.emitIdx}, when the minimum watermark passes ${hhmmss(p.l.et + J)}`]),
        { w: 1040, rh: 32, hot: PLAN.findIndex(p => p.emitIdx === null), label: `the join claims min(left, right) — ch03's rule, with two inputs by construction` })
      + c.note('w1', c.P.main.x + 24, c.P.main.y + 66 + PLAN.length * 32, 1040, [
        `${NEVER.length} of the ${PLAN.length} clicks never emits at all, because the MINIMUM watermark never reaches its join bound.`,
        `Those ${NEVER.length} rows hold ${NEVER_MATCHES} of the ${MATCHES.length} true matches. They are in the state, matched, and never published.`,
      ], c.C.hot, c.C.hotFill),
    cap: `This is where a stream-stream join stops resembling a batch join. ${CLEAN.length + NEEDS_RETRACTION.length} of the ${PLAN.length} clicks reach an emission point; ${NEVER.length} never do, because the join's watermark is the minimum over both inputs and it stalls below their bound. ${NEVER_MATCHES} of the ${MATCHES.length} true matches are computed, held in state, and never published.` },
  { t: 'so the input type picks the join type', draw: (c) =>
      c.panel('TWO JOINS, TWO BOUNDING MECHANISMS', 'p')
      + c.mapRows('jt', c.P.main.x + 24, c.P.main.y + 52, [
        [`stream JOIN stream`, `bounded by TIME — a window, plus both watermarks`],
        [`stream JOIN table`, `bounded by the TABLE — one lookup per row, finite per key`],
        [`here, as a windowed join`, `${MATCHES.length} matches exist · ${EMITTED_ONTIME} emitted on time · ${NEVER_MATCHES} never emitted`],
        [`here, as a temporal join`, `${TEMPORAL.length} rows enriched immediately, ${TEMPORAL_NULL} with no table version yet`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same data, two join kinds, very different behaviour' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Mistaking one for the other is the common streaming-join bug: windowing a lookup adds a wait that the data never needed.`,
        `Read the right-hand input: if it is a slowly-changing dimension, it is a table and wants a temporal join, however it arrived.`,
      ], c.C.good, c.C.goodFill),
    cap: `The decision is about what is being joined, not how the data got there. Two streams need a time bound and inherit all of the above — ${EMITTED_ONTIME} of ${MATCHES.length} matches on time here. A stream against a table is a lookup, bounded per key, and all ${TEMPORAL.length} rows are enriched at once. The bug is windowing the second case.` },
];

// ============== CONCEPT 2 — WINDOWED AND TEMPORAL JOINS =====================
const C2 = [
  { t: 'the windowed join: match within a time interval', draw: (c) => {
      let s = c.panel(`WINDOWED (INTERVAL) JOIN — |click.et − impression.et| <= ${secs(J)}`, 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'every candidate pair, and whether it matches', { size: 11, weight: 700, fill: c.C.line });
      let row = 0;
      for (const l of lefts) for (const r of rights) {
        const d = Math.abs(l.et - r.et), ok = d <= J;
        if (!ok && row > 11) continue;
        const y = c.P.main.y + 64 + row * 24;
        s += c.cv.rect('cp' + row, c.P.main.x + 24, y, 1040, 20, { fill: ok ? c.C.goodFill : c.C.paper, stroke: ok ? c.C.good : c.C.faint, rx: 2, sw: ok ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 15, `click ${l.id} (${hhmmss(l.et)})  x  impression ${r.id} (${hhmmss(r.et)})`, { size: 10, band: 'cpk' + row });
        s += c.cv.text(c.P.main.x + 520, y + 15, `apart ${d}s`, { size: 10, band: 'cpd' + row });
        s += c.cv.text(c.P.main.x + 1050, y + 15, ok ? 'MATCH' : 'no', { size: 10, anchor: 'end', weight: 700, fill: ok ? c.C.good : c.C.dim, band: 'cpf' + row });
        row++;
      }
      return s + c.note('p1', c.P.main.x + 24, c.P.main.y + 78 + row * 24, 1040, [
        `${MATCHES.length} of the ${lefts.length * rights.length} candidate pairs are within ${secs(J)}. The window bounds the buffer; the watermarks bound the wait.`,
        `Note one click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions — a windowed join is not one-to-one, so the output can be larger than either input.`,
      ], c.C.blue, c.C.blueFill); },
    cap: `The join predicate is one subtraction, and it produces ${MATCHES.length} matches from ${lefts.length * rights.length} candidates. Worth noticing in the note: one click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions, so a windowed join can emit more rows than either side has — which is a capacity question people usually discover after shipping.` },
  { t: 'the temporal join: look up the table AS OF the row\'s time', draw: (c) =>
      c.panel('TEMPORAL (STREAM-TABLE) JOIN — the version current at click time', 'a')
      + c.mapRows('tj', c.P.main.x + 24, c.P.main.y + 52, TEMPORAL.map(t =>
          [`click id ${t.l.id} at ${hhmmss(t.l.et)}`, t.value === null
            ? `NULL — no impression exists at or before ${hhmmss(t.l.et)}`
            : `impression total ${t.value}, from ${rights.filter(r => r.et <= t.l.et).map(r => r.id).join(',')}`]),
        { w: 1040, rh: 32, hot: TEMPORAL.findIndex(t => t.value === null), label: 'one lookup per row, against the table as it stood at that event time' })
      + c.note('j1', c.P.main.x + 24, c.P.main.y + 66 + TEMPORAL.length * 32, 1040, [
        `No window, no buffer, no wait — each row is enriched from the table immediately. ${TEMPORAL_NULL} row${TEMPORAL_NULL === 1 ? '' : 's'} gets NULL because the table had no version yet at that event time.`,
        `What it DOES need is a VERSIONED table: the lookup is "as of ${hhmmss(TEMPORAL[2].l.et)}", not "now".`,
      ], c.C.good, c.C.goodFill),
    cap: `A temporal join is a lookup, and it behaves completely differently: all ${TEMPORAL.length} clicks are enriched immediately, with no buffer and no wait. The price is in the note — it needs the table's **history**, because "as of ${hhmmss(TEMPORAL[2].l.et)}" is not the same question as "now", and a table that only holds current values cannot answer it.` },
  { t: 'so the two joins are bounded by entirely different things', draw: (c) =>
      c.panel('SIDE BY SIDE, ON THE SAME DATA', 'a')
      + c.mapRows('sb', c.P.main.x + 24, c.P.main.y + 52, [
        [`what bounds it`, `windowed: the ${secs(J)} window · temporal: the table, finite per key`],
        [`what it buffers`, `windowed: up to ${MAX_BUFFER} rows · temporal: nothing`],
        [`when it emits`, `windowed: when both watermarks pass · temporal: immediately`],
        [`what it needs`, `windowed: watermarks on both sides · temporal: a VERSIONED table`],
      ], { w: 1040, rh: 36, hot: 2, label: 'not two implementations of one idea — two different operations' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The windowed join waits because a match may still arrive. The temporal join does not, because the table's version at that event time is already determined.`,
        `That is why ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} never emits under the windowed join and all ${TEMPORAL.length} emit under the temporal one.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The row that matters is the third. A windowed join waits because a counterpart may still arrive; a temporal join does not, because the table's state at that event time is already settled. On this data that is the difference between ${NEVER.length} click never emitting and all ${TEMPORAL.length} emitting at once.` },
  { t: 'and mistaking one for the other is the common bug', draw: (c) =>
      c.panel('WINDOWING A LOOKUP', 'p')
      + c.mapRows('mb', c.P.main.x + 24, c.P.main.y + 52, [
        [`the symptom`, `results arrive late, or not at all, for no apparent reason`],
        [`the cause`, `a windowed join against what is really a slowly-changing table`],
        [`the cost here`, `${NEVER.length} of ${lefts.length} rows never emit, and ${NEVER_MATCHES} true matches are withheld`],
        [`the fix`, `read the right-hand input: dimension-like → temporal join`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the diagnosis is about the INPUT, not about the join configuration' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Widening the window or lengthening allowed lateness treats the symptom and makes the state worse — the wait was never needed.`,
        `The question to ask is "could this side still produce a row that changes an old answer?" If not, it is a table.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The reason this bug survives is that the obvious fixes look reasonable: widen the window, raise allowed lateness. Both grow the state and neither helps, because the wait was never necessary. The diagnostic question is whether the right-hand side can still produce a row that changes an old answer — and for a dimension table it cannot.` },
];

// ================= CONCEPT 3 — CORRECTNESS AND STATE ========================
const C3 = [
  { t: 'join state is bounded by the window, and only by it', draw: (c) =>
      c.panel('WHAT MAY BE DROPPED, AND WHEN', 'a')
      + c.mapRows('jb', c.P.main.x + 24, c.P.main.y + 52, [
        [`a buffered row may be dropped when`, `both watermarks pass its event time plus ${secs(J)}`],
        [`peak buffer on this stream`, `${MAX_BUFFER} of ${EVENTS.length} rows`],
        [`what sets that peak`, `arrival rate x the join window — nothing else`],
        [`what happens with no window`, `every row of both sides retained forever`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the sizing formula for a windowed join, in one row' })
      + c.note('b2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A ${secs(J)} window on a stream arriving at R rows/sec buffers about R x ${J} rows per side. That is the number to put in a capacity plan.`,
        `Doubling the window doubles the state, which is why "just widen it" is never free.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The sizing formula is the whole of it: buffered rows ≈ arrival rate × join window, per side. ${MAX_BUFFER} rows here on a ${EVENTS.length}-row stream. It matters because the two obvious responses to a join missing matches — widen the window, raise allowed lateness — both scale this number linearly.` },
  { t: 'a late row can contradict a result already emitted', draw: (c) =>
      c.panel('THE RETRACTION CASE, WITH REAL ROWS', 'a')
      + c.mapRows('rc', c.P.main.x + 24, c.P.main.y + 52, NEEDS_RETRACTION.slice(0, 2).flatMap(p => [
          [`click id ${p.l.id} emits after event ${p.emitIdx}`, p.onTime.length ? `matched impressions ${p.onTime.join(', ')}` : `NO MATCH — nothing within ${secs(J)} had arrived`],
          [`then impression id ${p.lateArrivals.join(', ')} arrives at event ${idx(EVENTS.find(e => e.id === p.lateArrivals[0]))}`, `it DOES match click ${p.l.id} — ${Math.abs(p.l.et - EVENTS.find(e => e.id === p.lateArrivals[0]).et)}s apart`],
        ]).concat([[`so the join must`, `retract the earlier result and emit the corrected match`]]),
        { w: 1040, rh: 34, hot: 4, label: 'the emitted result was correct when emitted, and is now wrong' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 66 + 5 * 34, 1040, [
        `${NEEDS_RETRACTION.length} of the ${PLAN.length} clicks is in this state: emitted, then contradicted by a row arriving ${idx(EVENTS.find(e => e.id === NEEDS_RETRACTION[0].lateArrivals[0])) - NEEDS_RETRACTION[0].emitIdx} events later.`,
        `A NO-MATCH result is the dangerous one, because downstream it looks like a fact rather than a provisional answer.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The worst version of this is visible in the first row: the join emits **no match** for click ${NEEDS_RETRACTION[0].l.id}, which downstream reads as "this click was never attributed". Then impression ${NEEDS_RETRACTION[0].lateArrivals.join(', ')} arrives ${idx(EVENTS.find(e => e.id === NEEDS_RETRACTION[0].lateArrivals[0])) - NEEDS_RETRACTION[0].emitIdx} events later and does match. A negative result is still a result, and it still has to be retracted.` },
  { t: 'so the accounting is: on time, late, or never', draw: (c) => {
      let s = c.panel(`ALL ${MATCHES.length} TRUE MATCHES, BY WHAT ACTUALLY HAPPENS TO THEM`, 'a');
      const rows = [
        [`emitted ON TIME and correct`, `${EMITTED_ONTIME} match${EMITTED_ONTIME === 1 ? '' : 'es'}`, c.C.good, c.C.goodFill],
        [`emitted LATE, after a retraction`, `${EMITTED_LATE} match${EMITTED_LATE === 1 ? '' : 'es'}`, c.C.warn, c.C.warnFill],
        [`NEVER emitted at all`, `${NEVER_MATCHES} match${NEVER_MATCHES === 1 ? '' : 'es'} — the watermark never passed the bound`, c.C.hot, c.C.hotFill],
      ];
      rows.forEach((r, i) => {
        const y = c.P.main.y + 58 + i * 40;
        s += c.cv.rect('ac' + i, c.P.main.x + 24, y, 1040, 36, { fill: r[3], stroke: r[2], rx: 3, sw: 2 });
        s += c.cv.text(c.P.main.x + 40, y + 23, r[0], { size: 11, weight: 700, band: 'ack' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 23, r[1], { size: 11, anchor: 'end', weight: 700, fill: r[2], band: 'acv' + i });
      });
      return s + c.note('a1', c.P.main.x + 24, c.P.main.y + 72 + rows.length * 40, 1040, [
        `${EMITTED_ONTIME} + ${EMITTED_LATE} + ${NEVER_MATCHES} = ${MATCHES.length}. Only ${EMITTED_ONTIME} of the ${MATCHES.length} true matches is published correctly the first time.`,
        `This is the honest picture of a stream-stream join on out-of-order data, and it is why ad attribution is hard rather than fiddly.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `The accounting is the chapter's central result and it is not comfortable: of ${MATCHES.length} true matches, **${EMITTED_ONTIME}** is published correctly on the first attempt, **${EMITTED_LATE}** requires a retraction, and **${NEVER_MATCHES}** are computed, held in state and never published at all. Nothing is broken — this is what a correct windowed join does on this data.` },
  { t: 'and the state must be collected, or the join grows forever', draw: (c) =>
      c.panel('GARBAGE COLLECTING THE JOIN BUFFER', 'p')
      + c.mapRows('gc', c.P.main.x + 24, c.P.main.y + 52, [
        [`drop a row when`, `both watermarks pass its et + ${secs(J)} + allowed lateness`],
        [`so allowed lateness`, `directly extends how long every buffered row is held`],
        [`and the ${NEVER.length} never-emitted click${NEVER.length === 1 ? '' : 's'}`, `is never collected either — the watermark never reaches the bound`],
        [`which means`, `a stalled input is both a liveness AND a memory problem`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same watermark decides emission and collection' })
      + c.note('g1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `One watermark drives both: it decides when a match may be emitted and when its inputs may be dropped. A stalled watermark stops both at once.`,
        `So the ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} that never emits is also ${NEVER.length} buffered row${NEVER.length === 1 ? '' : 's'} that is never freed — the failure is silent in both directions.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The coupling is worth stating explicitly: the same watermark decides emission and collection, so a stalled input is simultaneously a liveness problem and a memory leak. The ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} here that never emits is also never collected, and neither symptom raises an error.` },
];

// ============ CONCEPT 4 — AD ATTRIBUTION (systemDesign) =====================
const C4 = [
  { t: 'the pipeline, and the stage that only this design needs', draw: (c) =>
      c.panel('AD ATTRIBUTION — A WINDOWED JOIN OF CLICKS AND IMPRESSIONS', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`click stream + impression stream`, `${lefts.length} clicks, ${rights.length} impressions, out of order`],
        [`windowed join (buffer + watermark)`, `${secs(J)} window · peak buffer ${MAX_BUFFER} rows · claims min(both watermarks)`],
        [`retraction emitter`, `because ${NEEDS_RETRACTION.length} emitted result${NEEDS_RETRACTION.length === 1 ? '' : 's'} gets contradicted`],
        [`attribution store`, `must accept a retraction, including of a NO-MATCH`],
      ], { w: 1040, rh: 36, hot: 2, label: 'four stages, and the third exists only because results can be contradicted' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The retraction emitter is not optional here: ${NEEDS_RETRACTION.length} of the ${PLAN.length} clicks emits a result that a later row contradicts.`,
        `And it must be able to retract a NEGATIVE result — "click ${NEEDS_RETRACTION[0].l.id} was not attributed" is a published claim that turns out to be false.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The hard requirement in this design is retracting a **negative**. "Click ${NEEDS_RETRACTION[0].l.id} matched no impression" is published as a fact and later becomes false, so the attribution store needs to express "forget what I said about this click" — which is harder than updating a number, and worth discovering at design time.` },
  { t: 'the attribution outcome, counted honestly', draw: (c) =>
      c.panel('WHAT THE ATTRIBUTION STORE ACTUALLY ENDS UP WITH', 'a')
      + c.mapRows('ao', c.P.main.x + 24, c.P.main.y + 52, [
        [`true matches in the data`, `${MATCHES.length}: ${MATCHES.map(p => `${p[0]}-${p[1]}`).join(', ')}`],
        [`published correctly, first time`, `${EMITTED_ONTIME}`],
        [`published after a retraction`, `${EMITTED_LATE}`],
        [`never published`, `${NEVER_MATCHES} — from ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} whose watermark bound is never reached`],
      ], { w: 1040, rh: 36, hot: 3, label: 'a correct implementation, on this data' })
      + c.note('o1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `${Math.round(100 * EMITTED_ONTIME / MATCHES.length)}% of the attributions are right the first time; ${Math.round(100 * NEVER_MATCHES / MATCHES.length)}% are never delivered.`,
        `The never-delivered ones are the ones that matter commercially, and nothing in the pipeline reports them — they are simply absent.`,
      ], c.C.hot, c.C.hotFill),
    cap: `This is the number an attribution design has to put in front of someone: ${EMITTED_ONTIME} of ${MATCHES.length} matches right the first time, ${EMITTED_LATE} corrected later, ${NEVER_MATCHES} never delivered. The last group is silent — the pipeline does not report a missing attribution, so the only way to know is to compute what it should have been, which is what this generator does.` },
  { t: 'the two settings, and what each one actually fixes', draw: (c) =>
      c.panel('THE WINDOW AND ALLOWED LATENESS', 'a')
      + c.mapRows('kb', c.P.main.x + 24, c.P.main.y + 52, [
        [`widen the join window`, `more candidate pairs AND more buffer — linearly`],
        [`raise allowed lateness`, `keeps buffered rows longer so late matches can still emit`],
        [`neither fixes`, `the ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} whose watermark bound is never reached`],
        [`what would`, `an idleness timeout on the slower input — i.e. DECLARING it finished`],
      ], { w: 1040, rh: 36, hot: 3, label: 'two tuning knobs, and the problem neither of them touches' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The never-emitted rows are blocked by the MINIMUM watermark, which is ch03's rule — no window width changes it.`,
        `The only remedy is to stop waiting for the slow input, which trades the correctness the minimum was protecting. That is a decision, not a setting.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Both knobs grow the state and neither touches the biggest loss. The ${NEVER_MATCHES} undelivered matches are blocked by the minimum watermark, and the only thing that unblocks them is declaring the slower input idle — which is exactly the correctness the minimum rule was protecting. That trade is a product decision presented as a config value.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`${NEVER_MATCHES} of the ${MATCHES.length} true matches are never published, and nothing reports it. An absent attribution is indistinguishable from a click that genuinely matched nothing.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The store must retract a NEGATIVE result: "click ${NEEDS_RETRACTION[0].l.id} matched nothing" is published and later false. Updating a number is easy; un-publishing an absence is not.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Buffer is arrival rate x ${secs(J)} per side — ${MAX_BUFFER} rows here. Nothing in this design bounds it for a real traffic rate, and both tuning knobs scale it linearly.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And one click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions here, so the join's OUTPUT can exceed either input. Attribution policy (first touch? last? split?) is a question this design does not answer.`], c.C.blue, c.C.blueFill),
    cap: `The fourth gap is the one that is a business question rather than an engineering one: one click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions, so the join emits more rows than it received and somebody has to decide which impression gets the credit. Nothing about windows, watermarks or retractions answers that — but the design cannot ship without it being answered.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch09-hard', steps: C1,
    title: 'Why joins are hard on streams — no completion, and a buffer',
    subtitle: `${MATCHES.length} true matches · ${EMITTED_ONTIME} on time · ${EMITTED_LATE} after a retraction · ${NEVER_MATCHES} never emitted`,
    heading: 'Why a stream-stream join needs a time bound, and what it still cannot deliver',
    why: [
      `Reading this book's two keys as two streams — "${LEFT}" is clicks, "${RIGHT}" is impressions — gives a real join to measure.`, '',
      `**A batch join completes; a stream-stream join does not.** Over these inputs a batch join tests ${lefts.length} × ${rights.length} = ${lefts.length * rights.length} candidate pairs and finishes. The streaming version never finishes on its own: either side may still produce a match.`, '',
      `So SQL requires a **time bound**, and with a ${secs(J)} bound there are exactly **${MATCHES.length} true matches** here: ${MATCHES.map(p => `${p[0]}-${p[1]}`).join(', ')}. Without the bound the join would retain every row of both sides forever, so the bound makes the state finite *and* the semantics defined.`, '',
      `**The join must buffer.** A row cannot be matched and discarded — it waits for a counterpart that may never come. The buffer peaks at **${MAX_BUFFER} rows** on this ${EVENTS.length}-row stream, and the sizing formula is (arrival rate × join window) per side.`, '',
      `**The watermark ends the wait, and it is the minimum over both inputs** — ch03's rule, now structural because a join always has two. Trace each click's emission point and **${NEVER.length} of the ${PLAN.length} never emits at all**, because the minimum watermark never passes its bound. Those rows hold **${NEVER_MATCHES} of the ${MATCHES.length} true matches**: computed, sitting in state, never published.`, '',
      `**And the input type picks the join type.** Stream ⋈ stream is bounded by *time*; stream ⋈ table is bounded by the *table*, one lookup per row. On this data the windowed join publishes ${EMITTED_ONTIME} of ${MATCHES.length} matches on time, while a temporal join enriches all ${TEMPORAL.length} clicks immediately. Mistaking the second for the first is the common streaming-join bug.`],
    whenHeading: 'When a windowed join is the right tool, and how to size it',
    when: [
      `**Use a windowed join when both sides are genuinely streams** and a match means "these happened close together". The window width is a domain statement — how close counts as together — not a tuning parameter.`, '',
      `**Size it as arrival rate × window, per side**, and treat that as a hard number in the capacity plan. ${MAX_BUFFER} rows here; at 10k rows/sec with a ${secs(J)} window it is 600k rows per side.`, '',
      `**Expect the accounting, not just the matches.** On out-of-order data a correct windowed join delivers ${EMITTED_ONTIME} of ${MATCHES.length} matches correctly first time, ${EMITTED_LATE} after a retraction, and ${NEVER_MATCHES} not at all. If that split is unacceptable, the answer is a different join or a different guarantee — not a wider window.`, '',
      `**Reach for a temporal join the moment the right-hand side is dimension-like.** Ask "could this side still produce a row that changes an old answer?" If not, it is a table, and windowing it adds a wait the data never needed.`, '',
      `**What this does not settle:** what a temporal join requires in exchange for not waiting. It needs the table's *history*, because the lookup is "as of this event time" rather than "now" — which is the next concept.`],
    diagramHeading: 'Visual walkthrough — no completion, the buffer, the minimum, the two kinds',
    sub: `Every match, the buffer peak and the full on-time/late/never accounting are computed from the seed and asserted to sum to ${MATCHES.length}.` },
  { name: 'ch09-kinds', steps: C2,
    title: 'Windowed and temporal joins — two operations, not two settings',
    subtitle: `windowed: ${MATCHES.length} matches, up to ${MAX_BUFFER} buffered, ${NEVER.length} click never emits · temporal: ${TEMPORAL.length} enriched at once, ${TEMPORAL_NULL} NULL`,
    heading: 'Why these are bounded by different things, and why confusing them is costly',
    why: [
      `**The windowed (interval) join** matches rows whose event times are within a window of each other. One subtraction per candidate pair: ${MATCHES.length} of the ${lefts.length * rights.length} pairs are within ${secs(J)}.`, '',
      `Worth noticing early: **one click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions**, so a windowed join is not one-to-one and its output can exceed either input. That is a capacity surprise people usually meet after shipping.`, '',
      `**The temporal (stream-table) join** enriches each row with the version of a table that was current *at that row's event time*. Here each click probes the impression side as of its own \`et\`: ${TEMPORAL.filter(t => t.value !== null).slice(0, 2).map(t => `click ${t.l.id} → ${t.value}`).join(', ')}, and ${TEMPORAL_NULL} click${TEMPORAL_NULL === 1 ? ' gets' : 's get'} NULL because no impression existed yet at that time.`, '',
      `No window, no buffer, no wait — all ${TEMPORAL.length} rows are enriched immediately. The price is that it needs a **versioned** table: "as of ${hhmmss(TEMPORAL[2].l.et)}" is not the same question as "now", and a table holding only current values cannot answer it.`, '',
      `**So the two are bounded by entirely different things:**`, '',
      `- what bounds it — windowed: the ${secs(J)} window · temporal: the table, finite per key`,
      `- what it buffers — windowed: up to ${MAX_BUFFER} rows · temporal: nothing`,
      `- when it emits — windowed: when both watermarks pass · temporal: immediately`,
      `- what it needs — windowed: watermarks on both sides · temporal: a versioned table`, '',
      `The third row is the substantive difference: a windowed join waits because a counterpart may still arrive, and a temporal join does not because the table's state at that event time is already settled. On this data that is ${NEVER.length} click never emitting versus all ${TEMPORAL.length} emitting at once.`, '',
      `**And mistaking one for the other is the common bug.** The symptom is results arriving late or not at all; the cause is a windowed join against what is really a slowly-changing table; the cost here would be ${NEVER.length} of ${lefts.length} rows never emitting and ${NEVER_MATCHES} matches withheld.`],
    whenHeading: 'When to use each, and why the obvious fixes make it worse',
    when: [
      `**Windowed join when both sides are streams of events.** Accept the buffer, the watermark dependency and the on-time/late/never accounting that come with it.`, '',
      `**Temporal join when the right-hand side is state** — a price list, a user profile, a campaign table. It is cheaper in every dimension except one: you must be able to look the table up *as of* a past event time, which means keeping its versions.`, '',
      `**If you cannot version the table, say so explicitly** rather than falling back to a windowed join. Joining against "now" gives a row that is wrong in a way nothing downstream can detect, because the enrichment looks perfectly plausible.`, '',
      `**And resist the obvious fixes when a join seems slow.** Widening the window or raising allowed lateness both grow the state linearly and neither helps if the real problem is that one side is a table. The diagnostic question is "could this side still produce a row that changes an old answer?"`, '',
      `**What this does not settle:** what happens when a late row contradicts a match that was already emitted — including when the emitted result was a *no match*. That is the next concept, and it is the part that constrains the downstream store.`],
    diagramHeading: 'Visual walkthrough — every candidate pair, every lookup, side by side',
    sub: `Every pair distance, every temporal lookup and the buffer peak are computed from the seed and asserted.` },
  { name: 'ch09-correctness', steps: C3,
    title: 'Correctness and state — on time, late, or never',
    subtitle: `${EMITTED_ONTIME} + ${EMITTED_LATE} + ${NEVER_MATCHES} = ${MATCHES.length} true matches · peak buffer ${MAX_BUFFER}`,
    heading: 'Why a correct windowed join still fails to deliver most of its matches here',
    why: [
      `**Join state is bounded by the window, and only by it.** A buffered row may be dropped once both watermarks pass its event time plus ${secs(J)}. Peak buffer here: **${MAX_BUFFER} of ${EVENTS.length} rows**, and the formula is arrival rate × join window per side. Doubling the window doubles the state, which is why "just widen it" is never free.`, '',
      `**A late row can contradict a result already emitted.** Click ${NEEDS_RETRACTION[0].l.id} reaches its emission point after event ${NEEDS_RETRACTION[0].emitIdx} and publishes ${NEEDS_RETRACTION[0].onTime.length ? `a match with impression ${NEEDS_RETRACTION[0].onTime.join(', ')}` : '**no match** — nothing within ' + secs(J) + ' had arrived'}. Then impression ${NEEDS_RETRACTION[0].lateArrivals.join(', ')} arrives at event ${idx(EVENTS.find(e => e.id === NEEDS_RETRACTION[0].lateArrivals[0]))} and it *does* match, ${Math.abs(NEEDS_RETRACTION[0].l.et - EVENTS.find(e => e.id === NEEDS_RETRACTION[0].lateArrivals[0]).et)}s apart.`, '',
      `So the join must retract and re-emit. And note which result is being retracted: **a no-match**. Downstream that reads as "this click was never attributed", which is a fact rather than a provisional answer — a negative result is still a result.`, '',
      `**The honest accounting for all ${MATCHES.length} true matches:**`, '',
      `- **${EMITTED_ONTIME}** emitted on time and correct`,
      `- **${EMITTED_LATE}** emitted late, after a retraction`,
      `- **${NEVER_MATCHES}** never emitted at all — the minimum watermark never passed the bound`, '',
      `${EMITTED_ONTIME} + ${EMITTED_LATE} + ${NEVER_MATCHES} = ${MATCHES.length}. Only ${Math.round(100 * EMITTED_ONTIME / MATCHES.length)}% of the true matches are published correctly the first time, and ${Math.round(100 * NEVER_MATCHES / MATCHES.length)}% are never published. **Nothing is broken** — this is what a correct windowed join does on out-of-order data.`, '',
      `**And the state must be collected, or the join grows without bound.** The same watermark drives both: it decides when a match may be emitted and when its inputs may be dropped. So the ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} that never emits is also ${NEVER.length} buffered row${NEVER.length === 1 ? '' : 's'} that is never freed — a stalled input is a liveness problem *and* a memory leak, silently.`],
    whenHeading: 'When to accept this, and what to do about the undelivered matches',
    when: [
      `**Accept the accounting when late attributions are tolerable** and the consumer can handle a retraction, including of a negative. A dashboard can; a billing run that has already paid out cannot.`, '',
      `**Require a store that can retract a no-match.** This is the unusual requirement in a join design: "click ${NEEDS_RETRACTION[0].l.id} matched nothing" has to be un-publishable. Updating a number is easy; withdrawing an absence usually means the store needs an explicit tombstone.`, '',
      `**Do not try to fix the never-emitted matches with the window or with lateness.** Both grow the buffer linearly and neither touches the cause: the minimum watermark. The only remedy is an idleness timeout on the slower input — i.e. declaring it finished, which trades away the correctness the minimum rule was protecting.`, '',
      `**Alert on the never-emitted case, because the pipeline will not.** An absent attribution is indistinguishable from a click that genuinely matched nothing. The only way to know is to compute what the answer should have been, from the retained streams.`, '',
      `**What this does not settle:** which impression gets the credit when one click matches ${Math.max(...PLAN.map(p => p.all.length))} of them. That is attribution policy — first touch, last touch, split — and no amount of join machinery decides it.`],
    diagramHeading: 'Visual walkthrough — the bound, the retraction, the accounting, the leak',
    sub: `The full accounting is computed from the seed and asserted to sum to ${MATCHES.length}, with the buffer peak measured per row.` },
  { name: 'ch09-system', steps: C4,
    title: 'System design — a windowed join for ad attribution',
    subtitle: `${EMITTED_ONTIME} of ${MATCHES.length} attributions right first time · ${EMITTED_LATE} corrected · ${NEVER_MATCHES} never delivered`,
    heading: 'Why this design needs to retract a negative, and what it still loses',
    why: [
      `**The question.** Join a click stream and an impression stream for ad attribution. The join must buffer each side until both watermarks pass, and a late row arriving afterwards must retract and correct the earlier attribution.`, '',
      `**The pipeline:** click stream + impression stream → windowed join (buffer + watermark) → retraction emitter → attribution store.`, '',
      `**The retraction emitter is not optional**, and its hard requirement is unusual: it must be able to retract a **negative**. Click ${NEEDS_RETRACTION[0].l.id} publishes ${NEEDS_RETRACTION[0].onTime.length ? 'a match' : '"matched no impression"'} after event ${NEEDS_RETRACTION[0].emitIdx}, and impression ${NEEDS_RETRACTION[0].lateArrivals.join(', ')} later proves that wrong. Updating a number is easy; un-publishing an absence usually needs an explicit tombstone in the store.`, '',
      `**And here is what the store actually ends up with.** Of the ${MATCHES.length} true matches in the data: **${EMITTED_ONTIME} published correctly first time** (${Math.round(100 * EMITTED_ONTIME / MATCHES.length)}%), **${EMITTED_LATE} published after a retraction**, **${NEVER_MATCHES} never published** (${Math.round(100 * NEVER_MATCHES / MATCHES.length)}%) — from ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} whose watermark bound the minimum never reaches.`, '',
      `The never-published group is the one that matters commercially, and the pipeline does not report it. An absent attribution looks exactly like a click that genuinely matched nothing.`, '',
      `**Two settings, and neither fixes the biggest loss.** Widening the join window adds candidate pairs *and* buffer, linearly. Raising allowed lateness holds buffered rows longer so late matches can emit. Neither touches the ${NEVER.length} click${NEVER.length === 1 ? '' : 's'} blocked by the minimum watermark — only an idleness timeout on the slower input does, and that trades away exactly the correctness the minimum rule was protecting.`],
    whenHeading: 'When to ship this, and the four things it does not settle',
    when: [
      `**Ship it when the attribution consumer tolerates corrections**, including the withdrawal of a no-match, and when an under-count is survivable. For reporting that is usually fine; for payouts it is not.`, '',
      `**Instrument the undelivered case before launch.** Compute, from the retained streams, what the attribution *should* have been and compare. Nothing in the pipeline will tell you about the ${NEVER_MATCHES} missing matches.`, '',
      `**Decide the idleness policy deliberately.** It is the only lever on the never-emitted matches, and it is a correctness trade dressed as a timeout value.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **${NEVER_MATCHES} of the ${MATCHES.length} true matches are never published and nothing reports it.** Absence of an attribution is indistinguishable from a genuine non-match, so this gap is invisible from inside the system.`,
      `2. **The store must retract a negative result.** "Click ${NEEDS_RETRACTION[0].l.id} matched nothing" is published and later false — a harder store requirement than revising a value.`,
      `3. **Buffer is arrival rate × ${secs(J)} per side**, ${MAX_BUFFER} rows on this stream, and both tuning knobs scale it linearly. Nothing here bounds it at a real traffic rate.`,
      `4. **One click matches ${Math.max(...PLAN.map(p => p.all.length))} impressions**, so the join's output can exceed either input and somebody must decide which impression gets the credit. First touch, last touch or split is a business decision this design cannot make — and it cannot ship without one.`],
    diagramHeading: 'Visual walkthrough — four stages, the honest count, two knobs',
    sub: `The attribution accounting and both tuning consequences are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · "${LEFT}" = clicks, "${RIGHT}" = impressions · join window ${secs(J)}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch09.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch09.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of a row\'s five columns are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  `//   key = which stream it is on: "${LEFT}" = clicks, "${RIGHT}" = impressions`,
  'type Row { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} rows, in ARRIVAL order (tools/stream_seed.js).`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the late impression`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: J — the join window, in seconds.  J = ${J}`,
  `// primitive: LAG — each side's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: KEYS — the two sides.  KEYS = ["${KEYS.join('", "')}"]`,
  `// primitive: LEFT / RIGHT — the side names.  LEFT = "${LEFT}"  ·  RIGHT = "${RIGHT}"`,
  '// primitive: rowsOf(key) — one side of the join.',
  `//   rowsOf(LEFT) = [${lefts.map(e => e.id).join(', ')}]      rowsOf(RIGHT) = [${rights.map(e => e.id).join(', ')}]`,
  '// primitive: absDiff(a, b) — the distance between two times.  absDiff(1, 50) = 49',
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  `// primitive: indexOf(r) — r's position in ARRIVAL order.  indexOf(EVENTS[${L.id}]) = ${LI}`,
];
const PROGRAMS = [];
const R0 = NEEDS_RETRACTION[0];
const LATE_R = EVENTS.find(e => e.id === R0.lateArrivals[0]);

// ---- concept 1: no completion, a buffer, and the minimum -------------------
PROGRAMS.push({
  name: 'ch09-hard-memory',
  title: 'A join with no completion — the buffer and the minimum watermark',
  subtitle: `${MATCHES.length} true matches · peak buffer ${MAX_BUFFER} · ${NEVER.length} click never reaches its emission point`,
  src: COMMON.concat([
    '',
    'type Plan { emitIdx, matches }',
    '',
    '// function: trueMatches() — every pair within J. This is what the data CONTAINS,',
    '//   independent of what any pipeline manages to emit.',
    `//   trueMatches() = [${MATCHES.map(p => `[${p.join(', ')}]`).join(', ')}]`,
    'fun trueMatches() {',
    '    var out = []',
    '    for (l in rowsOf(LEFT)) {',
    '        for (r in rowsOf(RIGHT)) {',
    '            if (absDiff(l.et, r.et) <= J) { out = append(out, [l.id, r.id]) }',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: sideWatermark(key, i) — one input\'s own completeness claim after row i.',
    `//   sideWatermark(LEFT, ${EVENTS.length - 1}) = ${Math.max(...lefts.map(e => e.et)) - LAG}      sideWatermark(RIGHT, 0) = NONE`,
    'fun sideWatermark(key, i) {',
    '    var seen = NONE',
    '    for (j in 0 .. i) {',
    '        if (EVENTS[j].key != key) { continue }',
    '        if (seen == NONE || EVENTS[j].et > seen) { seen = EVENTS[j].et }',
    '    }',
    '    if (seen == NONE) { return NONE }',
    '    return seen - LAG',
    '}',
    '',
    '// function: joinWatermark(i) — the MINIMUM over both inputs. A silent side blocks',
    '//   the claim entirely, and a join always has two sides.',
    `//   joinWatermark(0) = NONE      joinWatermark(${EVENTS.length - 1}) = ${minWm(EVENTS.length - 1)}`,
    'fun joinWatermark(i) {',
    '    var lowest = NONE',
    '    for (k in KEYS) {',
    '        val w = sideWatermark(k, i)',
    '        if (w == NONE) { return NONE }',
    '        if (lowest == NONE || w < lowest) { lowest = w }',
    '    }',
    '    return lowest',
    '}',
    '',
    '// function: planFor(l) — when this click may emit, and which impressions it',
    '//   matches. emitIdx NONE means it NEVER emits.',
    `//   planFor(click ${CLEAN[0].l.id}).emitIdx = ${CLEAN[0].emitIdx}      planFor(click ${NEVER[0].l.id}).emitIdx = NONE`,
    'fun planFor(l) {',
    '    var when = NONE',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        val w = joinWatermark(i)',
    '        if (when == NONE && w != NONE && w > l.et + J) { when = i }',
    '    }',
    '    var ms = []',
    '    for (p in trueMatches()) {',
    '        if (p[0] == l.id) { ms = append(ms, p[1]) }',
    '    }',
    '    return Plan(when, ms)',
    '}',
    '',
    '// function: main() — THE CALLER: all the matches, and two very different clicks.',
    'fun main() {',
    '    val all   = trueMatches()',
    `    val clean = planFor(EVENTS[${idx(CLEAN[0].l)}])`,
    `    val lost  = planFor(EVENTS[${idx(NEVER[0].l)}])`,
    `    val claim = joinWatermark(${EVENTS.length - 1})`,
    '}',
  ]),
  heap: {
    all:   { addr: '0x100', type: `pair[${MATCHES.length}]`, val: () => MATCHES.map(p => `${p[0]}-${p[1]}`).join(' ') },
    clean: { addr: '0x200', type: 'Plan', val: () => `emitIdx ${CLEAN[0].emitIdx} · matches [${CLEAN[0].all.join(', ')}]` },
    lost:  { addr: '0x300', type: 'Plan', val: () => `emitIdx NONE · matches [${NEVER[0].all.join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `all = ${o.all || '...'}`, `clean = ${o.clean || '...'}`, `lost = ${o.lost || '...'}`,
      `claim = ${o.claim !== undefined ? o.claim : '...'}`] });
    return [
      { t: 'the join predicate is one subtraction', line: at('fun trueMatches()', 'if (absDiff(l.et, r.et) <= J) { out = append(out, [l.id, r.id]) }'),
        stack: [MAIN(), { name: 'trueMatches', locals: ['out = @0x100', `l = (id ${lefts[0].id}, et ${lefts[0].et})`, `r = (id ${L.id}, et ${L.et})`] }],
        heap: [{ key: 'all', hot: true }],
        cap: `\`absDiff(${lefts[0].et}, ${L.et})\` = ${Math.abs(lefts[0].et - L.et)}, within J = ${J}, so the pair is a match. ${MATCHES.length} matches exist in this data. Note this function uses no watermark and no buffer — it is what the data CONTAINS, which is the baseline the pipeline will be measured against.` },
      { t: 'a silent side blocks the join\'s claim entirely', line: at('fun joinWatermark(i)', 'if (w == NONE) { return NONE }'),
        stack: [MAIN({ all: '@0x100' }), { name: 'joinWatermark', locals: ['i = 0', 'lowest = NONE', `k = "${RIGHT}"`, 'w = NONE'] }],
        heap: [{ key: 'all' }],
        cap: `At row 0 only the ${LEFT} side has produced anything, so this returns NONE — the join makes no claim at all. For a windowed aggregate one input going quiet is bad luck; for a join it is structural, because there are always two.` },
      { t: 'one click reaches its emission point', line: at('fun planFor(l)', 'if (when == NONE && w != NONE && w > l.et + J) { when = i }'),
        stack: [MAIN({ all: '@0x100', clean: '@0x200' }), { name: 'planFor', locals: [`l = (id ${CLEAN[0].l.id}, et ${CLEAN[0].l.et})`, `when = ${CLEAN[0].emitIdx}`, 'ms = (a list)', `i = ${EVENTS.length - 1}`, `w = ${minWm(EVENTS.length - 1)}`, 'p = (a pair)'] }],
        heap: [{ key: 'all' }, { key: 'clean', hot: true }],
        cap: `Click ${CLEAN[0].l.id} needs the join watermark above ${CLEAN[0].l.et} + ${J} = ${CLEAN[0].l.et + J}, which first happens at row ${CLEAN[0].emitIdx}. By then impression ${CLEAN[0].onTime.join(', ')} has arrived, so it is published correctly and never revised — ${CLEAN.length} of the ${PLAN.length} clicks is in this state.` },
      { t: `and ${NEVER.length} click never reaches it, holding ${NEVER_MATCHES} matches`, line: at('    return Plan(when, ms)'),
        stack: [MAIN({ all: '@0x100', clean: '@0x200', lost: '@0x300', claim: minWm(EVENTS.length - 1) }),
                { name: 'planFor', locals: [`l = (id ${NEVER[0].l.id}, et ${NEVER[0].l.et})`, 'when = NONE', `ms = [${NEVER[0].all.join(', ')}]`, `i = ${EVENTS.length - 1}`, `w = ${minWm(EVENTS.length - 1)}`, 'p = (a pair)'] }],
        heap: [{ key: 'clean' }, { key: 'lost', hot: true }],
        cap: `Click ${NEVER[0].l.id} needs the watermark above ${NEVER[0].l.et + J}, and \`claim\` only ever reaches ${minWm(EVENTS.length - 1)}. So \`when\` stays NONE while \`ms\` holds ${NEVER[0].all.length} real matches. They are computed, sitting in state, and never published — and no error is raised.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a stream-stream join cannot deliver what the data contains — by computing both numbers separately.`, '',
    `\`trueMatches()\` uses no watermark and no buffer: it is what the data CONTAINS (${MATCHES.length} matches), and it is the baseline the pipeline gets measured against.`, '',
    `\`planFor(l)\` then asks when each click may actually emit. Step 3 shows one succeeding at row ${CLEAN[0].emitIdx}; step 4 shows click ${NEVER[0].l.id} needing the watermark above ${NEVER[0].l.et + J} while \`claim\` only ever reaches ${minWm(EVENTS.length - 1)} — so \`when\` stays NONE and \`ms\` holds ${NEVER[0].all.length} real matches that are never published.`],
  sub: `Every match, the minimum watermark and both plans are computed from the seed and asserted.` });

// ---- concept 2: windowed vs temporal --------------------------------------
PROGRAMS.push({
  name: 'ch09-kinds-memory',
  title: 'Windowed against temporal — two joins, two bounding mechanisms',
  subtitle: `windowed buffers up to ${MAX_BUFFER} and waits · temporal enriches all ${TEMPORAL.length} at once, ${TEMPORAL_NULL} NULL`,
  src: COMMON.concat([
    '',
    'type Enriched { id, value }',
    '',
    '// function: windowedJoin() — match two STREAMS within J. Bounded by TIME: the',
    '//   window bounds the buffer, and the watermarks bound the wait.',
    `//   windowedJoin() = [${MATCHES.map(p => `[${p.join(', ')}]`).join(', ')}]`,
    'fun windowedJoin() {',
    '    var out = []',
    '    for (l in rowsOf(LEFT)) {',
    '        for (r in rowsOf(RIGHT)) {',
    '            if (absDiff(l.et, r.et) <= J) { out = append(out, [l.id, r.id]) }',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: tableAsOf(et) — the RIGHT side treated as a versioned TABLE: its',
    '//   state as it stood at that event time. NONE when no version existed yet.',
    `//   tableAsOf(${lefts[0].et}) = NONE      tableAsOf(${TEMPORAL.find(t => t.value !== null).l.et}) = ${TEMPORAL.find(t => t.value !== null).value}`,
    'fun tableAsOf(et) {',
    '    var total = 0',
    '    var any   = false',
    '    for (r in rowsOf(RIGHT)) {',
    '        if (r.et > et) { continue }',
    '        total = total + r.v',
    '        any   = true',
    '    }',
    '    if (any == false) { return NONE }',
    '    return total',
    '}',
    '',
    '// function: temporalJoin() — enrich each stream row from the table AS OF its own',
    '//   event time. Bounded by the TABLE: one lookup per row, no buffer, no wait.',
    `//   temporalJoin() = [${TEMPORAL.map(t => `(${t.l.id}, ${t.value === null ? 'NONE' : t.value})`).join(', ')}]`,
    'fun temporalJoin() {',
    '    var out = []',
    '    for (l in rowsOf(LEFT)) {',
    '        out = append(out, Enriched(l.id, tableAsOf(l.et)))',
    '    }',
    '    return out',
    '}',
    '',
    '// function: waitsFor(kind) — what each join is waiting on before it can emit.',
    '//   waitsFor("windowed") = "both watermarks"      waitsFor("temporal") = "nothing"',
    'fun waitsFor(kind) {',
    '    if (kind == "windowed") { return "both watermarks" }',
    '    return "nothing"',
    '}',
    '',
    '// function: main() — THE CALLER: the same data, both joins.',
    'fun main() {',
    '    val pairs    = windowedJoin()',
    '    val enriched = temporalJoin()',
    '    val wWaits   = waitsFor("windowed")',
    '    val tWaits   = waitsFor("temporal")',
    '}',
  ]),
  heap: {
    pairs:    { addr: '0x100', type: `pair[${MATCHES.length}]`, val: () => MATCHES.map(p => `${p[0]}-${p[1]}`).join(' ') },
    enriched: { addr: '0x200', type: `Enriched[${TEMPORAL.length}]`, val: () => TEMPORAL.map(t => `${t.l.id}:${t.value === null ? 'NONE' : t.value}`).join(' ') },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `pairs = ${o.pairs || '...'}`, `enriched = ${o.enriched || '...'}`,
      `wWaits = ${o.w || '...'}`, `tWaits = ${o.t || '...'}`] });
    const FIRSTV = TEMPORAL.find(t => t.value !== null);
    return [
      { t: 'the windowed join compares two STREAM rows', line: at('fun windowedJoin()', 'fun windowedJoin()::            if (absDiff(l.et, r.et) <= J) { out = append(out, [l.id, r.id]) }'),
        stack: [MAIN(), { name: 'windowedJoin', locals: ['out = @0x100', `l = (id ${lefts[2].id}, et ${lefts[2].et})`, `r = (id ${rights[0].id}, et ${rights[0].et})`] }],
        heap: [{ key: 'pairs', hot: true }],
        cap: `Both operands are stream rows, so neither is authoritative — the pair exists only if BOTH have arrived, which is why the buffer and the wait exist. ${MATCHES.length} pairs come out of this loop, and nothing here says when any of them may be published.` },
      { t: 'the temporal join probes a TABLE as of the row\'s own time', line: at('fun tableAsOf(et)', 'if (r.et > et) { continue }'),
        stack: [MAIN({ pairs: '@0x100' }), { name: 'temporalJoin', locals: ['out = @0x200', `l = (id ${FIRSTV.l.id}, et ${FIRSTV.l.et})`] },
                { name: 'tableAsOf', locals: [`et = ${FIRSTV.l.et}`, `total = ${FIRSTV.value}`, 'any = true', `r = (id ${rights[rights.length - 1].id}, et ${rights[rights.length - 1].et})`] }],
        heap: [{ key: 'pairs' }, { key: 'enriched', hot: true }],
        cap: `The \`continue\` skips table versions later than the row's own \`et\` — that is the "as of" semantics, and it is why the lookup needs the table's HISTORY rather than its current value. For click ${FIRSTV.l.id} the answer is ${FIRSTV.value}, determined the moment the click arrives.` },
      { t: 'so a row before the table existed gets NONE, not a wait', line: at('if (any == false) { return NONE }'),
        stack: [MAIN({ pairs: '@0x100', enriched: '@0x200' }), { name: 'tableAsOf', locals: [`et = ${lefts[0].et}`, 'total = 0', 'any = false', `r = (id ${rights[rights.length - 1].id}, et ${rights[rights.length - 1].et})`] }],
        heap: [{ key: 'enriched', hot: true }],
        cap: `Click ${lefts[0].id} at ${hhmmss(lefts[0].et)} precedes every impression, so \`any\` stays false and the result is NONE — **immediately**, not after a wait. Compare the windowed join, where the same click's match with impression ${MATCHES.find(p => p[0] === lefts[0].id)[1]} requires a retraction to deliver.` },
      { t: 'and that is the whole difference: one waits, one does not', line: at('fun waitsFor(kind)', 'if (kind == "windowed") { return "both watermarks" }'),
        stack: [MAIN({ pairs: '@0x100', enriched: '@0x200', w: '"both watermarks"', t: '"nothing"' }), { name: 'waitsFor', locals: ['kind = "windowed"'] }],
        heap: [{ key: 'pairs' }, { key: 'enriched' }],
        cap: `\`wWaits\` is "both watermarks" and \`tWaits\` is "nothing". Read the heap rows: \`pairs\` holds ${MATCHES.length} matches of which ${NEVER_MATCHES} are never published, while \`enriched\` holds all ${TEMPORAL.length} rows, complete. Windowing a lookup imports the first column's problems for no benefit.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a windowed join and a temporal join are two different operations rather than two configurations.`, '',
    `\`windowedJoin()\` compares two **stream** rows, so neither is authoritative and the pair exists only once both have arrived. \`tableAsOf(et)\` has the line that defines a temporal join: \`if (r.et > et) { continue }\` — skip versions later than the row's own event time, which is why it needs the table's **history**.`, '',
    `Step 3 is the contrast in one case: click ${lefts[0].id} gets NONE immediately from the temporal join, while the windowed join needs a retraction to deliver its match with impression ${MATCHES.find(p => p[0] === lefts[0].id)[1]}.`],
  sub: `Every pair, every lookup and the NULL case are computed from the seed and asserted.` });

// ---- concept 3: on time / late / never ------------------------------------
PROGRAMS.push({
  name: 'ch09-correctness-memory',
  title: 'The accounting — on time, after a retraction, or never',
  subtitle: `${EMITTED_ONTIME} + ${EMITTED_LATE} + ${NEVER_MATCHES} = ${MATCHES.length} · the retracted result is a NO-MATCH`,
  src: COMMON.concat([
    '',
    'type Emission { clickId, kind, matched }',
    'type Tally    { onTime, late, never }',
    '',
    '// primitive: joinWatermark(i) — the minimum over both inputs after row i.',
    `//   joinWatermark(${R0.emitIdx}) = ${minWm(R0.emitIdx)}      joinWatermark(${EVENTS.length - 1}) = ${minWm(EVENTS.length - 1)}`,
    '// primitive: trueMatches() — every pair within J, independent of any pipeline.',
    `//   trueMatches() = [${MATCHES.map(p => `[${p.join(', ')}]`).join(', ')}]`,
    '// primitive: matchesOf(clickId) — that click\'s impressions, from trueMatches().',
    `//   matchesOf(${R0.l.id}) = [${R0.all.join(', ')}]      matchesOf(${CLEAN[0].l.id}) = [${CLEAN[0].all.join(', ')}]`,
    '',
    `// primitive: rowById(id) — the row with that id.`,
    `//   rowById(${L.id}) = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})`,
    '// primitive: contains(xs, x) — is x in xs?  contains([1,2], 2) = true',
    '',
    '// function: emitFor(l) — what the join publishes for this click, and when. A click',
    '//   with no match YET still publishes: a NO-MATCH is a result.',
    `//   emitFor(click ${R0.l.id}) = Emission(${R0.l.id}, "NO-MATCH", [])`,
    `//   emitFor(click ${CLEAN[0].l.id}) = Emission(${CLEAN[0].l.id}, "MATCH", [${CLEAN[0].onTime.join(', ')}])`,
    'fun emitFor(l) {',
    '    var when = NONE',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        val w = joinWatermark(i)',
    '        if (when == NONE && w != NONE && w > l.et + J) { when = i }',
    '    }',
    '    if (when == NONE) { return Emission(l.id, "NEVER EMITTED", []) }',
    '    var have = []',
    '    for (m in matchesOf(l.id)) {',
    '        if (indexOf(rowById(m)) <= when) { have = append(have, m) }',
    '    }',
    '    if (len(have) == 0) { return Emission(l.id, "NO-MATCH", []) }',
    '    return Emission(l.id, "MATCH", have)',
    '}',
    '',
    '// function: contradictedBy(l) — impressions that match this click but arrive AFTER',
    '//   its emission, so the published result has to be withdrawn.',
    `//   contradictedBy(click ${R0.l.id}) = [${R0.lateArrivals.join(', ')}]      contradictedBy(click ${CLEAN[0].l.id}) = []`,
    'fun contradictedBy(l) {',
    '    val e = emitFor(l)',
    '    var out = []',
    '    for (m in matchesOf(l.id)) {',
    '        if (contains(e.matched, m) == false) { out = append(out, m) }',
    '    }',
    '    if (e.kind == "NEVER EMITTED") { return [] }',
    '    return out',
    '}',
    '',
    '// function: tally() — all matches, by what actually happens to them.',
    `//   tally() = Tally(${EMITTED_ONTIME}, ${EMITTED_LATE}, ${NEVER_MATCHES})`,
    'fun tally() {',
    '    var on = 0',
    '    var la = 0',
    '    var nv = 0',
    '    for (l in rowsOf(LEFT)) {',
    '        val e = emitFor(l)',
    '        if (e.kind == "NEVER EMITTED") { nv = nv + len(matchesOf(l.id)) }',
    '        if (e.kind != "NEVER EMITTED") { on = on + len(e.matched) }',
    '        if (e.kind != "NEVER EMITTED") { la = la + len(contradictedBy(l)) }',
    '    }',
    '    return Tally(on, la, nv)',
    '}',
    '',
    '// function: main() — THE CALLER: one retraction case, and the whole tally.',
    'fun main() {',
    `    val emitted  = emitFor(EVENTS[${idx(R0.l)}])`,
    `    val wrongAbout = contradictedBy(EVENTS[${idx(R0.l)}])`,
    '    val counts   = tally()',
    `    val total    = len(trueMatches())`,
    '}',
  ]),
  heap: {
    emitted:    { addr: '0x100', type: 'Emission', val: () => `click ${R0.l.id} · NO-MATCH · matched []` },
    wrongAbout: { addr: '0x200', type: `int[${R0.lateArrivals.length}]`, val: () => `[${R0.lateArrivals.join(', ')}]` },
    counts:     { addr: '0x300', type: 'Tally', val: () => `onTime ${EMITTED_ONTIME} · late ${EMITTED_LATE} · never ${NEVER_MATCHES}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `emitted = ${o.emitted || '...'}`, `wrongAbout = ${o.wrong || '...'}`,
      `counts = ${o.counts || '...'}`, `total = ${o.total !== undefined ? o.total : '...'}`] });
    return [
      { t: 'a click with no match yet still PUBLISHES — a no-match', line: at('fun emitFor(l)', 'if (len(have) == 0) { return Emission(l.id, "NO-MATCH", []) }'),
        stack: [MAIN(), { name: 'emitFor', locals: [`l = (id ${R0.l.id}, et ${R0.l.et})`, `when = ${R0.emitIdx}`, 'have = []', `i = ${EVENTS.length - 1}`, `w = ${minWm(EVENTS.length - 1)}`, 'm = (a match)'] }],
        heap: [{ key: 'emitted', hot: true }],
        cap: `\`have\` is empty — impression ${R0.lateArrivals.join(', ')} has not arrived by row ${R0.emitIdx} — so the join publishes NO-MATCH. Downstream that reads as "click ${R0.l.id} was never attributed", a fact rather than a provisional answer. This is the result that will have to be withdrawn.` },
      { t: 'and the impression that contradicts it arrives later', line: at('fun contradictedBy(l)', 'if (contains(e.matched, m) == false) { out = append(out, m) }'),
        stack: [MAIN({ emitted: '@0x100', wrong: '@0x200' }), { name: 'contradictedBy', locals: [`l = (id ${R0.l.id}, et ${R0.l.et})`, 'e = @0x100', `out = [${R0.lateArrivals.join(', ')}]`, `m = ${R0.lateArrivals[0]}`] }],
        heap: [{ key: 'emitted' }, { key: 'wrongAbout', hot: true }],
        cap: `Impression ${R0.lateArrivals[0]} is in \`matchesOf(${R0.l.id})\` and not in \`e.matched\`, so it lands in \`out\`. It arrived at row ${LI}, ${LI - R0.emitIdx} rows after the emission, and it is ${Math.abs(R0.l.et - LATE_R.et)}s from the click in event time — a genuine match that the published no-match denies.` },
      { t: 'a never-emitted click contributes to neither count', line: at('if (when == NONE) { return Emission(l.id, "NEVER EMITTED", []) }'),
        stack: [MAIN({ emitted: '@0x100', wrong: '@0x200' }), { name: 'emitFor', locals: [`l = (id ${NEVER[0].l.id}, et ${NEVER[0].l.et})`, 'when = NONE', 'have = []', `i = ${EVENTS.length - 1}`, `w = ${minWm(EVENTS.length - 1)}`, 'm = (a match)'] }],
        heap: [{ key: 'emitted' }],
        cap: `Click ${NEVER[0].l.id} needs the join watermark above ${NEVER[0].l.et + J} and it reaches ${minWm(EVENTS.length - 1)}, so \`when\` stays NONE. It emits nothing at all — not a match, not a no-match. Its ${NEVER[0].all.length} true matches are simply absent, which downstream is indistinguishable from a click that matched nothing.` },
      { t: `so the tally is ${EMITTED_ONTIME} / ${EMITTED_LATE} / ${NEVER_MATCHES}, summing to ${MATCHES.length}`, line: at('fun tally()', 'if (e.kind == "NEVER EMITTED") { nv = nv + len(matchesOf(l.id)) }'),
        stack: [MAIN({ emitted: '@0x100', wrong: '@0x200', counts: '@0x300', total: MATCHES.length }),
                { name: 'tally', locals: [`on = ${EMITTED_ONTIME}`, `la = ${EMITTED_LATE}`, `nv = ${NEVER_MATCHES}`, `l = (id ${NEVER[NEVER.length - 1].l.id}, et ${NEVER[NEVER.length - 1].l.et})`, 'e = (an Emission)'] }],
        heap: [{ key: 'counts', hot: true }],
        cap: `${EMITTED_ONTIME} + ${EMITTED_LATE} + ${NEVER_MATCHES} = ${MATCHES.length} = \`total\`. Only ${EMITTED_ONTIME} of the ${MATCHES.length} true matches is right the first time and ${NEVER_MATCHES} are never delivered — from a correct implementation, on this data. The accounting is the deliverable, not the match list.` },
    ];
  },
  intro: [
    `**What is being answered.** What a correct windowed join actually delivers, counted — and which published result has to be withdrawn.`, '',
    `\`emitFor(l)\` returns one of three kinds, and the middle one is the uncomfortable one: \`if (len(have) == 0) { return Emission(l.id, "NO-MATCH", []) }\`. A click with nothing matched **yet** still publishes, and downstream that reads as a fact.`, '',
    `\`tally()\` then sums the three outcomes to ${EMITTED_ONTIME} / ${EMITTED_LATE} / ${NEVER_MATCHES} = ${MATCHES.length}. Step 3 is the silent case: click ${NEVER[0].l.id} emits nothing at all, so its ${NEVER[0].all.length} matches are absent rather than wrong — and absence is indistinguishable from a genuine non-match.`],
  sub: `Every emission kind and the full tally are computed from the seed and asserted to sum to ${MATCHES.length}.` });

// ---- concept 4: ad attribution --------------------------------------------
PROGRAMS.push({
  name: 'ch09-system-memory',
  title: 'Ad attribution — the store, and what it must be able to un-say',
  subtitle: `${EMITTED_ONTIME} right first time · ${EMITTED_LATE} corrected · ${NEVER_MATCHES} never delivered`,
  src: COMMON.concat([
    '',
    'type Store    { rows, tombstones }',
    'type Emission { clickId, kind, matched }',
    '',
    `// primitive: rowById(id) — the row with that id.`,
    `//   rowById(${R0.l.id}) = (id ${R0.l.id}, key "${R0.l.key}", et ${R0.l.et}, pt ${R0.l.pt}, v ${R0.l.v})`,
    '// primitive: emitFor(l) — what the join publishes for a click: MATCH, NO-MATCH,',
    '//   or nothing at all.',
    `//   emitFor(rowById(${R0.l.id})) = Emission(${R0.l.id}, "NO-MATCH", [])`,
    `//   emitFor(rowById(${NEVER[0].l.id})) = Emission(${NEVER[0].l.id}, "NEVER EMITTED", [])`,
    `//   emitFor(rowById(${CLEAN[0].l.id})) = Emission(${CLEAN[0].l.id}, "MATCH", [${CLEAN[0].onTime.join(', ')}])`,
    '// primitive: matchesOf(clickId) — that click\'s true impressions.',
    `//   matchesOf(${R0.l.id}) = [${R0.all.join(', ')}]`,
    '// primitive: contradictedBy(l) — impressions arriving after the emission.',
    `//   contradictedBy(click ${R0.l.id}) = [${R0.lateArrivals.join(', ')}]`,
    '',
    '// function: attribute(store, clickId, impressions) — write an attribution row.',
    `//   attribute(store, ${CLEAN[0].l.id}, [${CLEAN[0].onTime.join(', ')}]) sets rows[${CLEAN[0].l.id}] = [${CLEAN[0].onTime.join(', ')}]`,
    'fun attribute(store, clickId, impressions) {',
    '    store.rows[clickId] = impressions',
    '    return store',
    '}',
    '',
    '// function: markUnattributed(store, clickId) — publish a NEGATIVE result. This is',
    '//   the row that later has to be withdrawn.',
    `//   markUnattributed(store, ${R0.l.id}) sets rows[${R0.l.id}] = "NONE MATCHED"`,
    'fun markUnattributed(store, clickId) {',
    '    store.rows[clickId] = "NONE MATCHED"',
    '    return store',
    '}',
    '',
    '// function: retract(store, clickId, canTombstone) — un-say a published claim. For a',
    '//   NEGATIVE claim, overwriting is not enough: a consumer that already read',
    '//   "NONE MATCHED" needs to be told it was withdrawn.',
    `//   retract(store, ${R0.l.id}, true).tombstones = [${R0.l.id}]`,
    `//   retract(store, ${R0.l.id}, false).tombstones = []   (the consumer is never told)`,
    'fun retract(store, clickId, canTombstone) {',
    '    if (canTombstone) { store.tombstones = append(store.tombstones, clickId) }',
    '    store.rows[clickId] = NONE',
    '    return store',
    '}',
    '',
    '// function: run(canTombstone) — the whole attribution pipeline over this stream.',
    `//   run(true).rows has ${CLEAN.length + NEEDS_RETRACTION.length} attributed clicks and ${NEEDS_RETRACTION.length} tombstone`,
    `//   run(false) leaves the same rows and no record that ${NEEDS_RETRACTION.length} claim was withdrawn`,
    'fun run(canTombstone) {',
    '    var store = Store({}, [])',
    '    for (l in rowsOf(LEFT)) {',
    '        val e = emitFor(l)',
    '        if (e.kind == "NEVER EMITTED") { continue }',
    '        if (e.kind == "NO-MATCH")      { store = markUnattributed(store, l.id) }',
    '        if (e.kind == "MATCH")         { store = attribute(store, l.id, e.matched) }',
    '        val late = contradictedBy(l)',
    '        if (len(late) > 0) {',
    '            store = retract(store, l.id, canTombstone)',
    '            store = attribute(store, l.id, matchesOf(l.id))',
    '        }',
    '    }',
    '    return store',
    '}',
    '',
    '// function: main() — THE CALLER: with and without tombstones.',
    'fun main() {',
    '    val withT    = run(true)',
    '    val withoutT = run(false)',
    '}',
  ]),
  heap: {
    withT:    { addr: '0x100', type: 'Store', val: () => `${CLEAN.length + NEEDS_RETRACTION.length} rows · tombstones [${NEEDS_RETRACTION.map(p => p.l.id).join(', ')}]` },
    withoutT: { addr: '0x200', type: 'Store', val: () => `${CLEAN.length + NEEDS_RETRACTION.length} rows · tombstones []` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [`withT = ${o.a || '...'}`, `withoutT = ${o.b || '...'}`] });
    const RUN = (o) => ({ name: 'run', locals: [`canTombstone = ${o.t}`, `store = ${o.s}`, `l = (id ${o.lid}, et ${o.let})`,
      `e = (an Emission)`, `late = [${o.late}]`] });
    return [
      { t: 'the join publishes a NEGATIVE attribution', line: at('fun markUnattributed(store, clickId)', 'store.rows[clickId] = "NONE MATCHED"', 'fun attribute(store, clickId, impressions)', '    store.rows[clickId] = impressions'),
        stack: [MAIN(), RUN({ t: 'true', s: '@0x100', lid: R0.l.id, let: R0.l.et, late: '' }),
                { name: 'markUnattributed', locals: ['store = @0x100', `clickId = ${R0.l.id}`] }],
        heap: [{ key: 'withT', hot: true }],
        cap: `\`rows[${R0.l.id}] = "NONE MATCHED"\` — a published claim that this click was never attributed. At the moment it is written it is the correct answer from everything that has arrived, which is what makes it dangerous: it is indistinguishable from a settled fact.` },
      { t: 'then a late impression contradicts it', line: at('fun run(canTombstone)', 'if (len(late) > 0) {'),
        stack: [MAIN(), RUN({ t: 'true', s: '@0x100', lid: R0.l.id, let: R0.l.et, late: R0.lateArrivals.join(', ') }),],
        heap: [{ key: 'withT', hot: true }],
        cap: `\`late\` holds impression ${R0.lateArrivals.join(', ')}, which arrived at row ${LI} — ${LI - R0.emitIdx} rows after the emission — and is ${Math.abs(R0.l.et - LATE_R.et)}s from the click. The branch fires, so the published "NONE MATCHED" has to be withdrawn and replaced.` },
      { t: 'retracting a negative needs a TOMBSTONE, not an overwrite', line: at('fun retract(store, clickId, canTombstone)', 'if (canTombstone) { store.tombstones = append(store.tombstones, clickId) }'),
        stack: [MAIN(), RUN({ t: 'true', s: '@0x100', lid: R0.l.id, let: R0.l.et, late: R0.lateArrivals.join(', ') }),
                { name: 'retract', locals: ['store = @0x100', `clickId = ${R0.l.id}`, 'canTombstone = true'] }],
        heap: [{ key: 'withT', hot: true }],
        cap: `The tombstone is the record that a claim was withdrawn. Overwriting \`rows[${R0.l.id}]\` fixes the store, but a consumer that already read "NONE MATCHED" and acted on it never learns otherwise — which is why an updating sink is not sufficient here and an explicit retraction is.` },
      { t: 'and without it the two stores look identical', line: at('    val withoutT = run(false)'),
        stack: [MAIN({ a: '@0x100', b: '@0x200' })],
        heap: [{ key: 'withT' }, { key: 'withoutT', hot: true }],
        cap: `Both stores end with the same ${CLEAN.length + NEEDS_RETRACTION.length} attributed clicks; only \`tombstones\` differs. So the damage from omitting retractions is invisible in the store's final state — and note neither store mentions the ${NEVER.length} click that never emitted at all, holding ${NEVER_MATCHES} of the ${MATCHES.length} true matches.` },
    ];
  },
  intro: [
    `**What is being answered.** What an attribution store has to be able to do, and what it still never learns.`, '',
    `The unusual requirement is retracting a **negative**. \`markUnattributed\` publishes \`"NONE MATCHED"\` for click ${R0.l.id} — correct from everything that had arrived — and impression ${R0.lateArrivals.join(', ')} later proves it false.`, '',
    `Step 3 is why an updating sink is not enough: overwriting the row fixes the store, but a consumer that already read "NONE MATCHED" never learns otherwise. And step 4 is the quieter problem — both stores end identical, and neither mentions the ${NEVER.length} click that never emitted at all, holding ${NEVER_MATCHES} of the ${MATCHES.length} true matches.`],
  sub: `Both store outcomes and the full match accounting are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch09.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch09.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
