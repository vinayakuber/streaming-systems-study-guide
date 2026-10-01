#!/usr/bin/env node
'use strict';
/* gen_ch01.js — ch01's four concepts, both bands each (DIAGRAM + PROGRAM):
 *   1. What streaming is — terminology
 *   2. Event time vs processing time
 *   3. Three shapes of data
 *   4. systemDesign — the clicks-per-minute dashboard
 *
 * Every number comes from tools/stream_seed.js. The derivations this chapter needs
 * that the seed does not already publish (per-MINUTE buckets, skews, the two
 * clocks' disagreement) are computed here and ASSERTED, so a seed change cannot
 * leave a caption teaching something the data no longer shows. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, WINDOWS, WIN_STARTS, winOf,
        closedAt, LATE, NOT_LATE_BUT_OOO, SESSIONS, SUM, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const MIN = 60;                                     // a dashboard minute
const minOf = (sec) => Math.floor(sec / MIN) * MIN;
const chunkOf = (pt) => Math.floor(pt / WIN) * WIN; // a processing-time batch slice
const skewOf = (e) => e.pt - e.et;
const bucketBy = (clock) => {
  const m = {};
  for (const e of EVENTS) { const k = minOf(e[clock]); (m[k] = m[k] || []).push(e.id); }
  return m;
};
const BY_ET = bucketBy('et'), BY_PT = bucketBy('pt');
const MINUTES = Object.keys(BY_ET).map(Number).sort((a, b) => a - b);
const sumOf = (ids) => (ids || []).reduce((s, i) => s + EVENTS[i].v, 0);
const DISAGREE = MINUTES.filter(m => sumOf(BY_ET[m]) !== sumOf(BY_PT[m]));
const SKEWS = EVENTS.map(skewOf);
const MAX_SKEW = Math.max(...SKEWS);
const WORST = EVENTS[SKEWS.indexOf(MAX_SKEW)];
const dropAt = (budget) => EVENTS.filter(e => skewOf(e) > budget).map(e => e.id);
const DROP_LAG = dropAt(LAG), DROP_MAX = dropAt(MAX_SKEW);
const MISPLACED = EVENTS.filter(e => chunkOf(e.pt) !== winOf(e.et)).map(e => e.id);
const PT_CHUNKS = {};
for (const e of EVENTS) { const k = chunkOf(e.pt); (PT_CHUNKS[k] = PT_CHUNKS[k] || []).push(e.id); }
// the dashboard's 12:00 minute: when the watermark declares it done, and what it
// then shows versus what is finally true
const M0 = 0;
const M0_TRUE = sumOf(BY_ET[M0]);
const M0_DECL = WATERMARKS.findIndex(w => w >= M0 + MIN);          // event index
const M0_SHOWN = sumOf(EVENTS.filter((e, i) => i <= M0_DECL && minOf(e.et) === M0).map(e => e.id));
const M0_DECL_PT = EVENTS[M0_DECL].pt;
const M0_FIX_PT = Math.max(...EVENTS.filter(e => minOf(e.et) === M0).map(e => e.pt));
const M0_BLIND = M0_FIX_PT - M0_DECL_PT;
const M0_ERR = Math.round(100 * (M0_TRUE - M0_SHOWN) / M0_TRUE);
const fail = (m) => { throw new Error(`gen_ch01: ${m}`); };
if (DISAGREE.length < 2) fail(`only ${DISAGREE.length} minute(s) disagree between the clocks — the chapter's central contrast would not be visible`);
if (MAX_SKEW <= 3 * LAG) fail(`max skew ${MAX_SKEW}s is not far beyond LAG ${LAG}s — "the lag is a guess" would have no teeth`);
if (DROP_LAG.length === 0) fail(`waiting ${LAG}s drops nothing — there would be no latency/completeness trade to show`);
if (DROP_MAX.length !== 0) fail(`waiting ${MAX_SKEW}s still drops ${DROP_MAX} — the trade's other end must be complete`);
if (MISPLACED.length < 2) fail(`only ${MISPLACED.length} event(s) land in the wrong processing-time slice — step 2 of "three shapes" needs more than one`);
if (M0_SHOWN >= M0_TRUE) fail(`the dashboard's first answer (${M0_SHOWN}) is not low against the truth (${M0_TRUE}) — nothing to revise`);
if (M0_BLIND <= 0) fail('the correction arrives before the minute was declared done — the revision story is backwards');
if (sumOf(BY_ET[M0]) !== M0_TRUE) fail('M0_TRUE drifted from its own bucket');

const W = 1140;
const F = { gen: 'gen_ch01.js' };
const secs = (n) => `${n}s`;
const ev = (id) => EVENTS.find(e => e.id === id);
const L = LATE[0], O = NOT_LATE_BUT_OOO[0];

// ============================ CONCEPT 1 — TERMINOLOGY =======================
const MEANINGS = [
  ['"real time"', 'an answer within a deadline — a latency promise'],
  ['"low latency"', 'the same promise, without naming the deadline'],
  ['"continuous"', 'the job never ends, unlike a batch run'],
  ['"event driven"', 'each record triggers work, versus a scheduled sweep'],
  ['"approximate"', 'a cheaper, wrong-by-a-bounded-amount answer'],
  ['in THIS book', 'an execution engine for UNBOUNDED data — nothing more'],
];
const EVROWS = EVENTS.map(e => [`id ${e.id} · key ${e.key}`, `et ${hhmmss(e.et)} · pt ${hhmmss(e.pt)} · v ${e.v}`]);
const C1 = [
  { t: 'the word "streaming" means five different things', draw: (c) =>
      c.panel('ONE WORD, FIVE CLAIMS', 'a')
      + c.mapRows('mg', c.P.main.x + 24, c.P.main.y + 52, MEANINGS, { w: 1040, rh: 34, hot: MEANINGS.length - 1, label: 'what someone might mean when they say "we need streaming"' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 268, 1040, [
        'Only the last row is a statement about the ENGINE. The other five are statements about the ANSWER.',
        'A team can agree they want "streaming" and disagree about every one of them, which is why the first job is to split the word.',
      ], c.C.blue, c.C.blueFill),
    cap: `Five of these six describe a property someone wants from the ANSWER — how fast it comes, how often, how exact. Only the last describes the SYSTEM. Mixing the two is why "do we need streaming?" is a question two engineers can answer differently while agreeing on every fact.` },
  { t: 'every event carries TWO timestamps, and they disagree', draw: (c) =>
      c.panel('THE BOOK\'S NINE EVENTS — IN THE ORDER THE PIPELINE SEES THEM', 'a')
      + c.mapRows('ev', c.P.main.x + 24, c.P.main.y + 52, EVROWS, { w: 1040, rh: 30, hot: EVENTS.indexOf(L), label: 'event time = when it happened · processing time = when the pipeline saw it' })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 334, 1040, [
        `The highlighted row is event ${L.id}: it HAPPENED at ${hhmmss(L.et)} and was SEEN at ${hhmmss(L.pt)} — ${secs(skewOf(L))} apart.`,
        `Nothing is broken. A phone was offline, a queue backed up, a retry fired. This gap is the normal case, not the exception.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Read the two times on any row and they differ. Read event ${L.id} and they differ by ${secs(skewOf(L))} — it happened in the first minute and arrived in the fifth. Every difficulty in this book follows from that one gap, so the dataset is built to contain it rather than to be tidy.` },
  { t: 'count by the wrong clock and the answer changes', draw: (c) => {
      let s = c.panel('THE SAME NINE EVENTS, COUNTED TWO WAYS', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'per-minute sum of v, by EVENT time (what users did) and by PROCESSING time (when we noticed)', { size: 11, weight: 700, fill: c.C.line });
      MINUTES.forEach((m, i) => {
        const y = c.P.main.y + 66 + i * 34, bad = DISAGREE.includes(m);
        s += c.cv.rect('mm' + i, c.P.main.x + 24, y, 1040, 30, { fill: bad ? c.C.hotFill : c.C.paper, stroke: bad ? c.C.hot : c.C.faint, rx: 3, sw: bad ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `${hhmmss(m).slice(0, 5)} minute`, { size: 11, weight: 700, band: 'mk' + i });
        s += c.cv.text(c.P.main.x + 230, y + 20, `event time: ${sumOf(BY_ET[m])}  (ids ${(BY_ET[m] || []).join(',') || 'none'})`, { size: 11, fill: c.C.ink, band: 'mE' + i });
        s += c.cv.text(c.P.main.x + 600, y + 20, `processing time: ${sumOf(BY_PT[m])}  (ids ${(BY_PT[m] || []).join(',') || 'none'})`, { size: 11, fill: bad ? c.C.hot : c.C.ink, band: 'mP' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 20, bad ? 'DIFFERENT' : 'agrees', { size: 10, anchor: 'end', weight: 700, fill: bad ? c.C.hot : c.C.good, band: 'mF' + i });
      });
      return s + c.note('d1', c.P.main.x + 24, c.P.main.y + 80 + MINUTES.length * 34, 1040, [
        `${DISAGREE.length} of the ${MINUTES.length} minutes get a DIFFERENT answer depending on which clock you count by.`,
        `No event was lost and no arithmetic is wrong. The two columns are counting two different questions.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is the whole problem in one table. Bucketing by processing time says the ${hhmmss(MINUTES[0]).slice(0, 5)} minute saw ${sumOf(BY_PT[M0])}; bucketing by event time says ${M0_TRUE}. ${DISAGREE.length} of ${MINUTES.length} minutes disagree. A processing-time dashboard is not a slightly-stale event-time dashboard — it answers a different question and can be arbitrarily far off.` },
  { t: 'so the book asks four questions of every pipeline', draw: (c) =>
      c.panel('WHAT · WHERE · WHEN · HOW', 'a')
      + c.mapRows('q4', c.P.main.x + 24, c.P.main.y + 52, [
        ['WHAT results are computed', 'the transformation — a sum, a count, a join'],
        ['WHERE in event time', 'the windowing — which slice each value covers'],
        ['WHEN they are materialized', 'the triggers and watermarks — a PROCESSING-time choice'],
        ['HOW refinements relate', 'the accumulation — does a new answer replace or add to the old'],
      ], { w: 1040, rh: 36, label: 'the four questions, which are the next chapter and the rest of the book' })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Only the third question is about processing time. The other three are about event time or about bookkeeping.`,
        `That split is why the table above was possible: WHERE is an event-time decision, WHEN is a processing-time one, and confusing them is the mistake.`,
      ], c.C.good, c.C.goodFill),
    cap: `These four are not a summary — they are the book's actual structure, and the reason the previous step's table has two columns. WHERE picks the event-time slice; WHEN picks the processing-time moment to speak. A system that only has "when" is a processing-time dashboard, which is the thing that was ${M0_ERR}% low.` },
];

// ============================ CONCEPT 2 — THE TWO CLOCKS ====================
const C2 = [
  { t: 'skew, measured: processing time minus event time', draw: (c) => {
      let s = c.panel('HOW LATE EACH EVENT WAS, IN SECONDS', 'a');
      EVENTS.forEach((e, i) => {
        const worst = e.id === WORST.id;
        s += c.bar('sk' + i, c.P.main.x + 110, c.P.main.y + 62 + i * 52, `id ${e.id} · happened ${hhmmss(e.et)} · seen ${hhmmss(e.pt)}`,
          skewOf(e), MAX_SKEW, { col: worst ? c.C.hot : c.C.blue, fill: worst ? c.C.hotFill : c.C.blueFill, unit: 's', maxPx: 700 });
      });
      return s + c.note('s1', c.P.main.x + 24, c.P.main.y + 66 + EVENTS.length * 52, 1040, [
        `Eight of the nine arrive within ${secs(Math.max(...SKEWS.filter(x => x !== MAX_SKEW)))}. One — id ${WORST.id} — takes ${secs(MAX_SKEW)}.`,
        `Skew is not a constant you can look up. It is a long tail, and the tail is where correctness lives.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `Skew is the single measured quantity this chapter rests on. Note its SHAPE: a cluster of small values and one outlier ${Math.round(MAX_SKEW / Math.max(...SKEWS.filter(x => x !== MAX_SKEW)))}× larger. Any system that picks a waiting time from the typical case is correct for eight events in nine and silently wrong about the ninth.` },
  { t: 'the watermark is a GUESS about skew', draw: (c) => {
      let s = c.panel(`THE WATERMARK AFTER EACH EVENT — max event time seen, minus LAG = ${secs(LAG)}`, 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'row 1 = the arriving event, in processing order  ·  row 2 = its event time  ·  row 3 = the watermark after it', { size: 11, weight: 700, fill: c.C.line });
      s += c.cells('wm', c.P.main.x + 60, c.P.main.y + 62, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 24, size: 11, fill: c.C.cold });
      s += c.cells('we', c.P.main.x + 60, c.P.main.y + 94, EVENTS.map(e => hhmmss(e.et).slice(3)), { cw: 110, ch: 26, size: 11 });
      s += c.cells('ww', c.P.main.x + 60, c.P.main.y + 128, WATERMARKS.map(w => w < 0 ? 'none yet' : hhmmss(w).slice(3)), { cw: 110, ch: 26, size: 11,
        hotSet: new Set([EVENTS.indexOf(L)]), hotFill: c.C.hotFill, hotEdge: c.C.hot });
      return s + c.note('w1', c.P.main.x + 24, c.P.main.y + 172, 1040, [
        `A watermark is one claim: "no event with an event time earlier than this will arrive." Here it is computed as the highest event time seen so far, minus ${secs(LAG)}.`,
        `By the time id ${L.id} arrives the watermark stands at ${hhmmss(WATERMARKS[EVENTS.indexOf(L)])}, which already claims ${hhmmss(L.et)} is settled. The claim is false. Nothing detected that.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `The watermark never stalls and never apologises — it is arithmetic on the events that did arrive, so it cannot know about one that has not. The ${secs(LAG)} lag is a human guess at the skew tail, and id ${L.id}'s ${secs(skewOf(L))} is ${Math.round(skewOf(L) / LAG)}x it. A heuristic watermark being wrong is its normal mode, not a failure.` },
  { t: 'what completeness costs: wait longer, or drop events', draw: (c) =>
      c.panel('THE TRADE, PRICED', 'a')
      + c.mapRows('tr', c.P.main.x + 24, c.P.main.y + 52, [
        [`wait ${secs(LAG)} (the watermark's lag)`, `drops ${DROP_LAG.length} event(s): id ${DROP_LAG.join(', ')}`],
        [`wait ${secs(MAX_SKEW)} (the worst skew seen)`, `drops ${DROP_MAX.length} events — complete`],
        [`added delay per answer`, `${secs(MAX_SKEW - LAG)} more, on every window, forever`],
        [`across this seed's ${WIN_STARTS.length} windows`, `${secs(LAG * WIN_STARTS.length)} total → ${secs(MAX_SKEW * WIN_STARTS.length)} total`],
      ], { w: 1040, rh: 36, hot: 2, label: 'two budgets, and what each one buys' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Completeness is bought with latency, at a fixed exchange rate: ${secs(MAX_SKEW - LAG)} of extra delay on EVERY answer to stop losing ${DROP_LAG.length} event in ${EVENTS.length}.`,
        `Nobody can tell you that is worth it. That is the point — it is a product decision wearing an engineering costume.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Both rows are correct systems. The first is fast and loses ${DROP_LAG.length} of ${EVENTS.length} events; the second is complete and makes every answer ${secs(MAX_SKEW - LAG)} later — ${secs((MAX_SKEW - LAG) * WIN_STARTS.length)} across the ${WIN_STARTS.length} windows. And the second budget was only knowable AFTER seeing id ${WORST.id}, so in a live system you are choosing it blind.` },
  { t: 'so each clock is correct for a different question', draw: (c) =>
      c.panel('WHICH CLOCK ANSWERS WHICH QUESTION', 'p')
      + c.mapRows('cl', c.P.main.x + 24, c.P.main.y + 52, [
        ['"how many clicks happened at 12:00?"', 'EVENT time — it is a fact about users'],
        ['"what is our ingest rate right now?"', 'PROCESSING time — it is a fact about us'],
        ['"was this user\'s session longer than 2 min?"', 'EVENT time — the user\'s clock, not ours'],
        ['"is the pipeline falling behind?"', 'BOTH — the gap between them IS the lag'],
      ], { w: 1040, rh: 36, label: 'the question decides the clock; the clock is never a default' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Processing time is not the lazy choice — it is the right answer to questions about the SYSTEM.`,
        `It is the wrong answer to questions about the WORLD, and those are most of the questions anyone asks.`,
      ], c.C.good, c.C.goodFill),
    cap: `The useful habit is to read the question for whose clock it mentions. "How many clicks happened at 12:00" names the users' clock, so the answer is ${M0_TRUE}. "How many did we receive in that minute" names ours, so the answer is ${sumOf(BY_PT[M0])}. Both are right; only one of them is what a dashboard labelled "clicks at 12:00" is promising.` },
];

// ============================ CONCEPT 3 — THREE SHAPES ======================
const C3 = [
  { t: 'bounded data: it ends, so completeness is free', draw: (c) =>
      c.panel('BOUNDED — ALL NINE EVENTS, AS A FINITE FILE', 'a')
      + c.cells('bd', c.P.main.x + 60, c.P.main.y + 74, EVENTS.map(e => `id ${e.id}`), { cw: 110, ch: 28, size: 11, ids: true, idLabel: (i) => hhmmss(EVENTS[i].et).slice(3) })
      + c.line(c.P.main.x + 60, c.P.main.y + 130, 'read to the end  →  sort by event time  →  one answer per window  →  job exits', { size: 12, weight: 700, fill: c.C.good, band: 'bdf' })
      + c.mapRows('bw', c.P.main.x + 24, c.P.main.y + 160, WIN_STARTS.map(w => [`window [${hhmmss(w).slice(0, 5)}, ${hhmmss(w + WIN).slice(0, 5)})`, `ids ${WINDOWS[w].join(',')} · sum ${SUM(WINDOWS[w])}`]), { w: 1040, rh: 32, label: 'every window, final and correct — because the input ended' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 174 + WIN_STARTS.length * 32, 1040, [
        `There is no watermark here and no lateness, because "has everything arrived?" has a free answer: the file ended.`,
        `Note that id ${L.id} lands in its CORRECT window. Batch over a finished input is not approximately right — it is right.`,
      ], c.C.good, c.C.goodFill),
    cap: `Start here, because it is the case where none of this book's problems exist. The input ends, so you can sort by event time, and every window is final. id ${L.id}'s ${secs(skewOf(L))} of skew is harmless: it was in the file before the job started. Everything difficult later comes from removing exactly one assumption — that the input ends.` },
  { t: 'unbounded data as batch: slice by the WRONG clock', draw: (c) => {
      let s = c.panel(`UNBOUNDED-AS-BATCH — sliced into ${secs(WIN)} chunks of PROCESSING time`, 'a');
      Object.keys(PT_CHUNKS).map(Number).sort((a, b) => a - b).forEach((k, i) => {
        const y = c.P.main.y + 58 + i * 34;
        const wrong = PT_CHUNKS[k].filter(id => MISPLACED.includes(id));
        s += c.cv.rect('pc' + i, c.P.main.x + 24, y, 1040, 30, { fill: wrong.length ? c.C.hotFill : c.C.paper, stroke: wrong.length ? c.C.hot : c.C.faint, rx: 3, sw: wrong.length ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `chunk [${hhmmss(k).slice(0, 5)}, ${hhmmss(k + WIN).slice(0, 5)}) of ARRIVALS`, { size: 11, weight: 700, band: 'pck' + i });
        s += c.cv.text(c.P.main.x + 400, y + 20, `holds ids ${PT_CHUNKS[k].join(',')}`, { size: 11, band: 'pcv' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 20, wrong.length ? `id ${wrong.join(',')} belongs elsewhere` : 'all correctly placed', { size: 10, anchor: 'end', weight: 700, fill: wrong.length ? c.C.hot : c.C.good, band: 'pcf' + i });
      });
      return s + c.note('p1', c.P.main.x + 24, c.P.main.y + 72 + Object.keys(PT_CHUNKS).length * 34, 1040, [
        `${MISPLACED.length} of the ${EVENTS.length} events are in a chunk that is not their event-time window: ids ${MISPLACED.join(' and ')}.`,
        `From INSIDE a chunk there is no way to notice. Each chunk is internally consistent, finishes cleanly, and reports a wrong number.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is the pattern most "streaming" systems actually are: a batch job on a timer. It works, it is simple, and ${MISPLACED.length} of ${EVENTS.length} events land in the wrong bucket — id ${O.id} by ${secs(skewOf(O))} and id ${L.id} by ${secs(skewOf(L))}. The chunk boundary is a fact about the pipeline's clock, and it is being used to answer a question about the users' clock.` },
  { t: 'unbounded data as streaming: close on the watermark', draw: (c) => {
      let s = c.panel('UNBOUNDED-AS-STREAMING — each window closes when the watermark crosses its end', 'a');
      s += c.mapRows('st', c.P.main.x + 24, c.P.main.y + 52, WIN_STARTS.map(w => {
        const ci = closedAt(w);
        return [`window [${hhmmss(w).slice(0, 5)}, ${hhmmss(w + WIN).slice(0, 5)})`,
                ci === null ? 'NEVER closes in this seed' : `closes after event id ${EVENTS[ci].id} (at ${hhmmss(EVENTS[ci].pt)})`];
      }), { w: 1040, rh: 34, hot: 0, label: `windows are ${secs(WIN)} of EVENT time; closing is a PROCESSING-time moment` });
      return s + c.note('s2', c.P.main.x + 24, c.P.main.y + 66 + WIN_STARTS.length * 34, 1040, [
        `Window [${hhmmss(0).slice(0, 5)}, ${hhmmss(WIN).slice(0, 5)}) closes after event id ${EVENTS[closedAt(0)].id} — and id ${L.id} arrives ${EVENTS.indexOf(L) - closedAt(0)} events later, so it is LATE by construction.`,
        `The last window never closes at all: no event ever pushes the watermark past its end. "Unbounded" includes the state you are left holding.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `Streaming keeps the event-time windows (so the buckets are right) and makes CLOSING a separate, processing-time decision. That split is what batch-on-a-timer collapses. The price is visible on both ends of this table: the first window closes before id ${L.id} shows up, and the last one is still open with ${SUM(WINDOWS[WIN_STARTS[WIN_STARTS.length - 1]])} in it and nothing to trigger it.` },
  { t: 'batch is the special case, not the other way round', draw: (c) =>
      c.panel('ONE MODEL, THREE SHAPES', 'p')
      + c.mapRows('gs', c.P.main.x + 24, c.P.main.y + 52, [
        ['bounded', `group by event-time window · every window final at end of input (event ${EVENTS.length})`],
        ['unbounded-as-batch', `group by PROCESSING-time chunk · ${MISPLACED.length} of ${EVENTS.length} events misplaced`],
        ['unbounded-as-streaming', `group by event-time window · each closes when the watermark crosses`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the grouping key is the only thing that differs' })
      + c.note('g1', c.P.main.x + 24, c.P.main.y + 172, 1040, [
        `Rows 1 and 3 use the SAME grouping key and get the SAME buckets. They differ only in WHEN they declare a window done.`,
        `Row 2 is the odd one out — and not because it is batch. It is wrong because it keyed on the arrival clock.`,
      ], c.C.good, c.C.goodFill)
      + c.note('g2', c.P.main.x + 24, c.P.main.y + 256, 1040, [
        `So: bounded is unbounded data whose watermark jumps to "everything" at the end of input. One model covers both.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The usual framing — "batch for history, streaming for live" — makes these sound like two systems. They are one. A bounded input is an unbounded one whose watermark reaches infinity at EOF, which closes every window at once. Keep that and you can write a pipeline once; the shape of the input decides when it speaks, not what it computes.` },
];

// ======================= CONCEPT 4 — THE DASHBOARD (systemDesign) ===========
const PIPE = [
  ['writer — the click producer', 'stamps each click with its EVENT time, then sends'],
  ['transport — the unbounded stream', 'reorders and delays; this is where skew is created'],
  ['collector — the window assigner', `reads e.et, picks the ${secs(MIN)} minute, no clock of its own`],
  ['aggregator/store — window state', 'one running sum per minute, held until the minute is declared done'],
  ['reader — the ops dashboard', 'shows a number per minute, and must handle that number CHANGING'],
];
const C4 = [
  { t: 'the pipeline, and where skew enters it', draw: (c) =>
      c.panel('CLICKS PER MINUTE — FIVE STAGES', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, PIPE, { w: 1040, rh: 36, hot: 1, label: 'the highlighted stage is the only one that creates the problem' })
      + c.note('pn', c.P.main.x + 24, c.P.main.y + 248, 1040, [
        `The transport is the only stage that reorders or delays. Every other stage is then written to TOLERATE what it did.`,
        `Note the collector reads e.et and never asks what time it is. A stage that consults its own clock to bucket data is the bug this chapter is about.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Name the stage that creates the difficulty before designing around it. Here it is the transport: it is where a click that happened at ${hhmmss(L.et)} becomes a record delivered at ${hhmmss(L.pt)}. The collector's rule follows directly — bucket on \`e.et\`, never on arrival — and the dashboard's hard requirement follows too: a published number has to be allowed to change.` },
  { t: `the ${hhmmss(M0).slice(0, 5)} minute is declared done, showing the wrong number`, draw: (c) =>
      c.panel(`THE ${hhmmss(M0).slice(0, 5)} MINUTE, AS OPS SEES IT`, 'a')
      + c.mapRows('dh', c.P.main.x + 24, c.P.main.y + 52, [
        [`clicks that HAPPENED in this minute`, `ids ${BY_ET[M0].join(',')} · sum ${M0_TRUE}`],
        [`arrived before the watermark passed ${hhmmss(M0 + MIN).slice(0, 5)}`, `ids ${EVENTS.filter((e, i) => i <= M0_DECL && minOf(e.et) === M0).map(e => e.id).join(',')} · sum ${M0_SHOWN}`],
        [`so the dashboard publishes, at ${hhmmss(M0_DECL_PT)}`, `${M0_SHOWN} — which is ${M0_ERR}% low`],
        [`the truth is only knowable at`, `${hhmmss(M0_FIX_PT)}, when id ${L.id} finally lands`],
      ], { w: 1040, rh: 36, hot: 2, label: 'what is true, what had arrived, and what was shown' })
      + c.note('dn', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `For ${secs(M0_BLIND)} — from ${hhmmss(M0_DECL_PT)} to ${hhmmss(M0_FIX_PT)} — the screen says ${M0_SHOWN} and the answer is ${M0_TRUE}.`,
        `The pipeline is not lagging during that window. It has finished, decided, and published. It is confidently wrong.`,
      ], c.C.hot, c.C.hotFill),
    cap: `This is the failure the whole chapter exists to make concrete, with no hand-waving: the watermark crosses ${hhmmss(M0 + MIN).slice(0, 5)} at event id ${EVENTS[M0_DECL].id} (${hhmmss(M0_DECL_PT)}), the minute is declared complete, and ${M0_SHOWN} goes on the screen. The true answer, ${M0_TRUE}, cannot be known until ${hhmmss(M0_FIX_PT)}. The gap is ${secs(M0_BLIND)} of confident, published error.` },
  { t: 'so the design has exactly three options, and must pick one', draw: (c) =>
      c.panel('WHAT TO DO WHEN id ' + L.id + ' ARRIVES LATE', 'a')
      + c.mapRows('op', c.P.main.x + 24, c.P.main.y + 52, [
        [`A — drop it`, `screen stays ${M0_SHOWN}, permanently ${M0_ERR}% low · simplest · silently wrong`],
        [`B — revise the published minute`, `${hhmmss(M0).slice(0, 5)}: ${M0_SHOWN} → ${M0_TRUE}, ${secs(M0_BLIND)} after publishing · correct · the reader must cope`],
        [`C — wait ${secs(MAX_SKEW)} before publishing anything`, `always correct · every minute is ${secs(MAX_SKEW - LAG)} later than with B`],
      ], { w: 1040, rh: 40, hot: 1, label: 'three correct engineering answers to one product question' })
      + c.note('on', c.P.main.x + 24, c.P.main.y + 192, 1040, [
        `There is no fourth option, and none of these three is "the right one" — they trade accuracy, latency and downstream complexity.`,
        `Option C's ${secs(MAX_SKEW)} was only knowable after id ${WORST.id} happened. In a live system you are picking that number before you have seen your worst skew.`,
      ], c.C.warn, c.C.warnFill),
    cap: `An interview answer that says "handle late data" has not answered anything — these are the three handlings, and they differ in what they cost whom. B is usually right for a dashboard a human reads, because a human can tolerate a number moving; it is usually wrong if something downstream has already billed on the ${M0_SHOWN}.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`The ${secs(LAG)} lag is a GUESS. It was wrong about id ${L.id} by ${secs(skewOf(L) - LAG)} and nothing in the pipeline could detect that.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`One window here NEVER closes — [${hhmmss(WIN_STARTS[WIN_STARTS.length - 1]).slice(0, 5)}, …) still holds ${SUM(WINDOWS[WIN_STARTS[WIN_STARTS.length - 1]])}. Unbounded input means unbounded STATE unless something expires it.`], c.C.warn, c.C.warnFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Nothing here is exactly-once. If the transport redelivers id ${L.id}, the ${hhmmss(M0).slice(0, 5)} minute reads ${M0_TRUE + L.v}, and this design cannot tell that from a real click.`], c.C.hot, c.C.hotFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And the dashboard shows ${MINUTES.length} minutes because the seed has ${EVENTS.length} events. Nothing here says what happens at a million per second.`], c.C.blue, c.C.blueFill),
    cap: `Four honest gaps, and the first two are the ones that bite. The lag is unverifiable from inside the system; the state is unbounded unless something expires it; duplicates are indistinguishable from clicks; and the whole thing is sized for ${EVENTS.length} events. Each gets its own chapter later — which is the actual reason this book has ten of them.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch01-terminology', steps: C1,
    title: 'What "streaming" means — and the two clocks underneath it',
    subtitle: `${EVENTS.length} events · ${DISAGREE.length} of ${MINUTES.length} minutes get a different answer per clock`,
    heading: 'Why the word has to be split before anything can be designed',
    why: [
      `**Start with the problem the word causes.** When someone says "we need streaming", they could mean any of five different things — an answer within a deadline, an answer soon, a job that never ends, work triggered per record, or a cheap approximate answer. Those are five different requirements. None of them is a statement about the engine.`, '',
      `**In this book "streaming" means one narrow thing:** an execution engine designed for **unbounded** data — a dataset with no end. That is all. It does not promise low latency, it does not imply approximation, and it is not the opposite of batch.`, '',
      `**Then the fact that makes it hard.** Every event carries two timestamps:`, '',
      `- **event time** — when the thing actually happened, stamped by whatever produced it.`,
      `- **processing time** — when the pipeline observed it, read off the pipeline's own clock.`, '',
      `They disagree, always, by an amount nobody controls. In this book's dataset event ${L.id} happened at **${hhmmss(L.et)}** and was seen at **${hhmmss(L.pt)}** — ${secs(skewOf(L))} apart. A phone was offline; a queue backed up. Nothing is broken.`, '',
      `**And that gap changes answers, not just timings.** Count the same ${EVENTS.length} events per minute by event time and then by processing time: **${DISAGREE.length} of the ${MINUTES.length} minutes get a different number.** The ${hhmmss(M0).slice(0, 5)} minute is ${M0_TRUE} by event time and ${sumOf(BY_PT[M0])} by processing time. No event was lost and no sum is miscalculated — the two columns are answering two different questions.`],
    whenHeading: 'When each meaning of the word is the one you want',
    when: [
      `**You want the engine (this book's meaning) when your input has no end** — a click stream, a sensor feed, a log. The test is not "is it fast?" but "can I ever read to the end?" If you cannot, you need a model that says when to speak, because "when the input is finished" is not available.`, '',
      `**You want "real time" — a latency promise — when a human or a control loop is waiting.** That is a separate requirement, and you can satisfy it with a batch job on a tight schedule. Many systems called streaming are exactly that.`, '',
      `**You want "approximate" when the exact answer costs more than it is worth.** Also separate, also compatible with either engine.`, '',
      `**What this does not settle:** which clock your pipeline should bucket on. That is the next concept, and it is a question about your users' question, not about your infrastructure. The four questions the book is built on — **what** is computed, **where** in event time, **when** results are materialized, **how** refinements relate — exist precisely to keep those decisions apart. Only "when" is about processing time.`],
    diagramHeading: 'Visual walkthrough — one word, two clocks, two answers',
    sub: `Every figure is derived from \`tools/stream_seed.js\` and asserted by the generator: ${DISAGREE.length} disagreeing minutes, max skew ${secs(MAX_SKEW)}.` },
  { name: 'ch01-eventtime', steps: C2,
    title: 'Event time vs processing time — skew, watermarks, and what completeness costs',
    subtitle: `max skew ${secs(MAX_SKEW)} (id ${WORST.id}) · watermark lag ${secs(LAG)} · waiting ${secs(LAG)} drops ${DROP_LAG.length} of ${EVENTS.length}`,
    heading: 'Why one of the two clocks is the meaningful one, and the other is the cheap one',
    why: [
      `**Skew** is the name for the gap: \`skew = processing time − event time\`, in seconds. It is the one quantity this concept rests on, so measure it on all ${EVENTS.length} events rather than reasoning about it.`, '',
      `Eight of the nine arrive within ${secs(Math.max(...SKEWS.filter(x => x !== MAX_SKEW)))}. One — id ${WORST.id} — takes **${secs(MAX_SKEW)}**, about ${Math.round(MAX_SKEW / Math.max(...SKEWS.filter(x => x !== MAX_SKEW)))}× the next worst. **Skew is a long tail, not a constant**, and that shape is why you cannot look it up.`, '',
      `**A watermark is a claim about completeness:** "no event with an event time earlier than *t* will arrive from here on." It is what lets a pipeline decide a window is done. The usual way to produce one is a heuristic: take the highest event time seen so far and subtract an assumed worst-case lag — here **${secs(LAG)}**.`, '',
      `That heuristic is arithmetic on the events that *did* arrive, so it cannot know about one that has not. When id ${L.id} shows up, the watermark already stands at ${hhmmss(WATERMARKS[EVENTS.indexOf(L)])} — it has already claimed ${hhmmss(L.et)} is settled. **The claim is simply false, and nothing in the pipeline detects it.**`, '',
      `**Now price the fix.** Waiting ${secs(LAG)} drops ${DROP_LAG.length} event (id ${DROP_LAG.join(', ')}). Waiting ${secs(MAX_SKEW)} drops none. The difference is **${secs(MAX_SKEW - LAG)} of extra delay on every answer this pipeline ever produces** — across this seed's ${WIN_STARTS.length} windows, ${secs(LAG * WIN_STARTS.length)} of total delay becomes ${secs(MAX_SKEW * WIN_STARTS.length)}. That is the exchange rate between completeness and latency, and it is fixed by the data, not by your cleverness.`],
    whenHeading: 'When to use which clock, and why the budget is a product decision',
    when: [
      `**Use event time for any question about the world.** "How many clicks happened at ${hhmmss(M0).slice(0, 5)}?" is a fact about users; the answer is ${M0_TRUE} and it does not change because your pipeline was busy. Session lengths, conversion windows, latency percentiles — all event time.`, '',
      `**Use processing time for any question about the system.** "What is our ingest rate right now?" is a fact about you; the answer is ${sumOf(BY_PT[M0])} for that minute and it is *correct*. Processing time is not the lazy choice — it is the right answer to a different question.`, '',
      `**Use both to measure yourself:** the gap between the two clocks *is* your lag. That is the number to alert on.`, '',
      `**And accept that the budget cannot be derived.** Nobody can tell you whether ${secs(MAX_SKEW - LAG)} of extra latency on every answer is worth not losing ${DROP_LAG.length} event in ${EVENTS.length}. It depends on who reads the number and what they do with it — a product decision wearing an engineering costume.`, '',
      `**What this does not settle:** the ${secs(MAX_SKEW)} budget was only knowable *after* id ${WORST.id} arrived. In a live pipeline you choose the lag before you have seen your worst skew, and you will be wrong in the direction you cannot measure. The honest design response is not a better guess — it is to make late data a case you handle rather than a case you prevent.`],
    diagramHeading: 'Visual walkthrough — measured skew, a guessing watermark, and the bill',
    sub: `Skews, watermarks and drop counts are computed from the seed and asserted: max skew ${secs(MAX_SKEW)} > 3× lag, and waiting ${secs(MAX_SKEW)} drops nothing.` },
  { name: 'ch01-shapes', steps: C3,
    title: 'Three shapes of data — and why batch is the special case',
    subtitle: `bounded · unbounded-as-batch (${MISPLACED.length} of ${EVENTS.length} events misplaced) · unbounded-as-streaming`,
    heading: 'Why the shape of the input decides the design',
    why: [
      `A pipeline's whole design falls out of one question: **does the input end?** There are three answers in practice.`, '',
      `**1. Bounded data.** A finite dataset — one day of logs, a database snapshot. You read to the end, sort by event time, and every window is final. There is no watermark and no lateness, because "has everything arrived?" has a free answer: *the file ended*. id ${L.id}'s ${secs(skewOf(L))} of skew is harmless here — it was in the file before the job started. **This is the case where none of this book's problems exist.**`, '',
      `**2. Unbounded data, processed as batch.** The data never ends, so the pipeline slices it artificially — run every ${secs(WIN)} over whatever arrived — and each run is a little bounded job. This is what most systems called "streaming" actually are.`, '',
      `The slices are cut on **arrival** time, so they are the wrong buckets: **${MISPLACED.length} of ${EVENTS.length} events land in a chunk that is not their event-time window** — id ${O.id} out by ${secs(skewOf(O))}, id ${L.id} out by ${secs(skewOf(L))}. And from inside a chunk there is nothing to notice: it is internally consistent, it finishes cleanly, and it reports a wrong number.`, '',
      `**3. Unbounded data, processed as streaming.** Keep the event-time windows — so the buckets are right — and make *closing* a separate, processing-time decision driven by the watermark. Window [${hhmmss(0).slice(0, 5)}, ${hhmmss(WIN).slice(0, 5)}) closes after event id ${EVENTS[closedAt(0)].id}, which is ${EVENTS.indexOf(L) - closedAt(0)} events before id ${L.id} arrives — so lateness is now a *case*, not an accident. And the last window **never closes**: nothing ever pushes the watermark past its end.`, '',
      `**The point of separating these three:** shapes 1 and 3 group identically. Run the same grouping over the bounded file and over the stream and you get the same buckets. They differ only in *when* they declare a window done. Shape 2 is the odd one out — and not because it is batch, but because it keyed on the arrival clock.`],
    whenHeading: 'When each shape is the right choice, and what "streaming generalizes batch" buys you',
    when: [
      `**Use bounded processing when the input genuinely ends** — a backfill, a nightly report over yesterday, a one-off analysis. It is the cheapest correct thing, and reaching for a streaming engine here buys nothing.`, '',
      `**Use unbounded-as-batch when the buckets do not have to be exact** — an ingest-rate graph, a rough volume trend, anything where "roughly the last ${secs(WIN)}" is the actual question. It is operationally simple and that is a real advantage. Just know you are accepting ${Math.round(100 * MISPLACED.length / EVENTS.length)}% of events in the wrong bucket, invisibly.`, '',
      `**Use streaming when the buckets must be event-time correct and the input does not end.** The cost is that you now have to answer "when do I speak?" explicitly — which is the entire rest of this book.`, '',
      `**Why the generalization matters practically:** a bounded input is an unbounded one whose watermark jumps to infinity at end-of-input, closing every window at once. So one model covers both, and you can write the pipeline's *what* and *where* once. That is not a philosophical point — it is why the same code can backfill history and serve live traffic.`, '',
      `**What this does not settle:** the last window in this seed holds ${SUM(WINDOWS[WIN_STARTS[WIN_STARTS.length - 1]])} and never closes. Unbounded input means unbounded **state** unless something expires it, and nothing in this concept says what. That is ch07's problem, and it is the one that actually pages people.`],
    diagramHeading: 'Visual walkthrough — the same nine events, three ways',
    sub: `The misplaced-event list is computed by comparing each event's processing-time chunk to its event-time window, and asserted to be non-trivial.` },
  { name: 'ch01-system', steps: C4,
    title: 'System design — a live clicks-per-minute dashboard',
    subtitle: `publishes ${M0_SHOWN} at ${hhmmss(M0_DECL_PT)} · truth is ${M0_TRUE} · ${secs(M0_BLIND)} of confident error`,
    heading: 'Why this design is decided by one stage, and one number',
    why: [
      `**The question.** Ops watches a live count of clicks per minute. Each click is stamped with its event time, but the network delays some of them. Design the pipeline.`, '',
      `**The pipeline:** writer (click producer) → transport (unbounded stream) → collector (window assigner) → aggregator/store (window state) → reader (dashboard).`, '',
      `**One stage creates all the difficulty: the transport.** It is the only stage that reorders or delays, and it is where a click that happened at ${hhmmss(L.et)} becomes a record delivered at ${hhmmss(L.pt)}. Every other stage is then written to *tolerate* what it did. In particular the collector buckets on \`e.et\` and **never consults its own clock** — a stage that asks "what time is it?" in order to bucket data is precisely the bug this chapter is about.`, '',
      `**Now the number that decides the design.** Follow the ${hhmmss(M0).slice(0, 5)} minute all the way through:`, '',
      `- Clicks that actually happened in it: ids ${BY_ET[M0].join(', ')} — sum **${M0_TRUE}**.`,
      `- The watermark crosses ${hhmmss(M0 + MIN).slice(0, 5)} at event id ${EVENTS[M0_DECL].id}, which arrives at **${hhmmss(M0_DECL_PT)}**. At that moment only ids ${EVENTS.filter((e, i) => i <= M0_DECL && minOf(e.et) === M0).map(e => e.id).join(', ')} have landed.`,
      `- So the dashboard declares the minute complete and publishes **${M0_SHOWN}** — **${M0_ERR}% low**.`,
      `- The truth is not knowable until id ${L.id} lands at **${hhmmss(M0_FIX_PT)}**.`, '',
      `For **${secs(M0_BLIND)}** the screen says ${M0_SHOWN} and the answer is ${M0_TRUE}. The pipeline is not lagging during that window — it has finished, decided and published. **It is confidently wrong**, and that is the state a design has to have an answer for.`],
    whenHeading: 'When each of the three options is right, and the four things this does not settle',
    when: [
      `When id ${L.id} finally arrives there are exactly **three** things the design can do, and no fourth:`, '',
      `**A — drop it.** The screen stays ${M0_SHOWN}, permanently ${M0_ERR}% low. Simplest to build; silently wrong forever. Right when the number is a rough health signal and nobody reconciles it against anything.`, '',
      `**B — revise the published minute**, ${hhmmss(M0).slice(0, 5)}: ${M0_SHOWN} → ${M0_TRUE}, ${secs(M0_BLIND)} after publishing. Correct, and it pushes the problem downstream: the reader must cope with a number that moves. Usually right for a dashboard a human reads, because a human can tolerate that. Usually **wrong** if something has already billed or alerted on the ${M0_SHOWN}.`, '',
      `**C — wait ${secs(MAX_SKEW)} before publishing anything.** Always correct, and every minute is ${secs(MAX_SKEW - LAG)} later than under B. Right when correctness-on-first-publish is a hard requirement — a financial figure, a regulated count.`, '',
      `None of the three is "the right one"; they trade accuracy, latency and downstream complexity. An answer that says "handle late data" has not chosen.`, '',
      `**What this design does NOT settle — four gaps, each a later chapter:**`, '',
      `1. **The ${secs(LAG)} lag is a guess.** It was wrong about id ${L.id} by ${secs(skewOf(L) - LAG)}, and nothing inside the pipeline could detect that. Option C's ${secs(MAX_SKEW)} was only knowable *after* id ${WORST.id} happened.`,
      `2. **One window never closes.** [${hhmmss(WIN_STARTS[WIN_STARTS.length - 1]).slice(0, 5)}, …) still holds ${SUM(WINDOWS[WIN_STARTS[WIN_STARTS.length - 1]])}. Unbounded input means unbounded state unless something expires it.`,
      `3. **Nothing here is exactly-once.** If the transport redelivers id ${L.id}, the ${hhmmss(M0).slice(0, 5)} minute reads ${M0_TRUE + L.v}, and this design cannot distinguish that from a real click.`,
      `4. **It is sized for ${EVENTS.length} events.** Nothing here says what happens at a million per second.`],
    diagramHeading: 'Visual walkthrough — five stages, one wrong number, three options',
    sub: `The publish time, the published value and the ${secs(M0_BLIND)} error window are all derived from the seed's watermarks and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · ${EVENTS.length} events · lag ${secs(LAG)}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: F.gen, whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch01.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
// Shared primitive headers. R58: every callable gets a header line in the SAME
// shape, directly above it, with its worked calls AFTER the header and before the
// body — so a reader looking for "where is this defined" can scan for the marker.
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which is the whole subject of ch01:',
  '//   et = event time, when the thing happened  ·  pt = processing time, when we saw it',
  '//   v  = the value being summed (clicks, here)  ·  key = which stream it belongs to',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[0] = (id 0, key "a", et ${EVENTS[0].et}, pt ${EVENTS[0].pt}, v ${EVENTS[0].v})`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the late one`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: MIN — seconds in a dashboard minute.  MIN = ${MIN}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  '// primitive: minOf(sec) — the START of the MIN-second minute holding sec.',
  `//   minOf(${EVENTS[0].et}) = ${minOf(EVENTS[0].et)}      minOf(${L.pt}) = ${minOf(L.pt)}`,
  '// primitive: add(m, k, n) — add n to m[k], starting from 0 when k is absent.',
  '//   add({}, 0, 5) = {0: 5}      add({0: 5}, 0, 3) = {0: 8}',
  '// primitive: keysOf(m) — m\'s keys, ascending.  keysOf({0: 12, 60: 7}) = [0, 60]',
];
const PROGRAMS = [];

// ---- concept 1: two clocks, two answers, from one loop ---------------------
PROGRAMS.push({
  name: 'ch01-terminology-memory', concept: 1,
  title: 'One dataset, two clocks — the same loop run twice',
  subtitle: `countBy(EVENTS,"et")[${M0}] = ${M0_TRUE} · countBy(EVENTS,"pt")[${M0}] = ${sumOf(BY_PT[M0])} · ${DISAGREE.length} of ${MINUTES.length} minutes disagree`,
  src: COMMON.concat([
    '',
    'type Counter { byMinute }',
    '',
    '// function: countBy(events, clock) — bucket every event by ONE clock, sum v.',
    `//   countBy(EVENTS, "et").byMinute[${M0}] = ${M0_TRUE}   (ids ${BY_ET[M0].join(',')})`,
    `//   countBy(EVENTS, "pt").byMinute[${M0}] = ${sumOf(BY_PT[M0])}   (ids ${BY_PT[M0].join(',')})`,
    'fun countBy(events, clock) {',
    '    var m = {}',
    '    for (e in events) {',
    '        val minute = minOf(e[clock])',
    '        add(m, minute, e.v)',
    '    }',
    '    return Counter(m)',
    '}',
    '',
    '// function: disagree(a, b) — the minutes where the two clocks give different sums.',
    `//   disagree(byEvent, byProc) = [${DISAGREE.join(', ')}]`,
    'fun disagree(a, b) {',
    '    var out = []',
    '    for (minute in keysOf(a.byMinute)) {',
    '        if (a.byMinute[minute] != b.byMinute[minute]) { out.append(minute) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER: one dataset, two clocks, one comparison.',
    'fun main() {',
    '    val byEvent = countBy(EVENTS, "et")',
    '    val byProc  = countBy(EVENTS, "pt")',
    '    val diff    = disagree(byEvent, byProc)',
    '}',
  ]),
  heap: {
    byEvent: { addr: '0x100', type: 'Counter', val: () => MINUTES.map(m => `${m}:${sumOf(BY_ET[m])}`).join(' ') },
    byProc:  { addr: '0x200', type: 'Counter', val: () => Object.keys(BY_PT).map(Number).sort((a, b) => a - b).map(m => `${m}:${sumOf(BY_PT[m])}`).join(' ') },
    diff:    { addr: '0x300', type: `int[${DISAGREE.length}]`, val: () => `[${DISAGREE.join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `byEvent = ${o.byEvent || '...'}`, `byProc = ${o.byProc || '...'}`, `diff = ${o.diff || '...'}`] });
    return [
      { t: `the late event is bucketed by its EVENT time`, line: at('fun countBy(events, clock)', 'fun countBy(events, clock)>val minute = minOf(e[clock])'),
        stack: [MAIN(), { name: 'countBy', locals: ['events = EVENTS', 'clock = "et"', 'm = @0x100', `e = EVENTS[${L.id}]`, `minute = ${minOf(L.et)}`] }],
        heap: [{ key: 'byEvent', hot: true }],
        cap: `On the pass for id ${L.id}, \`clock\` is \`"et"\`, so \`minute\` is \`minOf(${L.et})\` = ${minOf(L.et)} — the ${hhmmss(M0).slice(0, 5)} minute, where the click actually happened. Its ${L.v} joins ids ${BY_ET[M0].filter(i => i !== L.id).join(' and ')} for a total of ${M0_TRUE}.` },
      { t: 'the SAME line, with clock = "pt", sends it somewhere else', line: at('fun countBy(events, clock)>val minute = minOf(e[clock])', 'fun countBy(events, clock)>add(m, minute, e.v)'),
        stack: [MAIN({ byEvent: '@0x100' }), { name: 'countBy', locals: ['events = EVENTS', 'clock = "pt"', 'm = @0x200', `e = EVENTS[${L.id}]`, `minute = ${minOf(L.pt)}`] }],
        heap: [{ key: 'byEvent' }, { key: 'byProc', hot: true }],
        cap: `Identical code, one argument changed. Now \`minute\` is \`minOf(${L.pt})\` = ${minOf(L.pt)} — the ${hhmmss(minOf(L.pt)).slice(0, 5)} minute, ${Math.round((minOf(L.pt) - minOf(L.et)) / MIN)} minutes away from where the click happened. The ${L.v} lands in a minute during which this user did nothing.` },
      { t: `so ${DISAGREE.length} of ${MINUTES.length} minutes hold different numbers`, line: at('fun disagree(a, b)', 'if (a.byMinute[minute] != b.byMinute[minute]) { out.append(minute) }'),
        stack: [MAIN({ byEvent: '@0x100', byProc: '@0x200' }), { name: 'disagree', locals: ['a = @0x100', 'b = @0x200', 'out = @0x300', `minute = ${DISAGREE[DISAGREE.length - 1]}`] }],
        heap: [{ key: 'byEvent' }, { key: 'byProc' }, { key: 'diff', hot: true }],
        cap: `Read the two heap rows against each other: minute ${M0} holds ${M0_TRUE} and ${sumOf(BY_PT[M0])}; minute ${DISAGREE[DISAGREE.length - 1]} holds ${sumOf(BY_ET[DISAGREE[DISAGREE.length - 1]])} and ${sumOf(BY_PT[DISAGREE[DISAGREE.length - 1]]) || 0}. \`out\` collects every such minute: [${DISAGREE.join(', ')}].` },
      { t: 'and neither counter is wrong', line: at('    val diff    = disagree(byEvent, byProc)'),
        stack: [MAIN({ byEvent: '@0x100', byProc: '@0x200', diff: '@0x300' })],
        heap: [{ key: 'byEvent' }, { key: 'byProc' }, { key: 'diff' }],
        cap: `Every event was counted exactly once in both counters — ${EVENTS.reduce((s, e) => s + e.v, 0)} total in each. Nothing was dropped and no sum is wrong. The two Counters are answers to two different questions, and \`diff\` is the list of minutes where choosing the wrong one would mislead someone.` },
    ];
  },
  intro: [
    `**What is being answered.** Why "count clicks per minute" is ambiguous — as one loop, run twice.`, '',
    `\`countBy(events, clock)\` takes the clock as a **parameter**. There is no branch per clock and no separate code path: the only difference between the two calls is the string \`"et"\` or \`"pt"\`. Watch \`minute\` on the highlighted line in steps 1 and 2 — the same expression evaluates to ${minOf(L.et)} and then to ${minOf(L.pt)} for the same event.`, '',
    `That is the point. A processing-time dashboard is not a buggy event-time dashboard. It is the same program given a different argument, and it is **correct** — just about a different question.`],
  sub: `The per-minute sums and the disagreement list are computed from the seed and asserted by the generator.` });

// ---- concept 2: skew, the watermark's guess, and the price of waiting -------
PROGRAMS.push({
  name: 'ch01-eventtime-memory', concept: 2,
  title: 'Skew, a guessing watermark, and what completeness costs',
  subtitle: `max skew ${MAX_SKEW}s (id ${WORST.id}) · waiting ${LAG}s drops ${DROP_LAG.length} · waiting ${MAX_SKEW}s drops ${DROP_MAX.length}`,
  src: COMMON.concat([
    '',
    'type Split  { kept, dropped }',
    'type Budget { seconds, delayTotal }',
    '',
    '// primitive: skewOf(e) — how late an event was: pt minus et, in seconds.',
    `//   skewOf(EVENTS[0]) = ${skewOf(EVENTS[0])}      skewOf(EVENTS[${L.id}]) = ${skewOf(L)}`,
    '// primitive: max(xs) — the largest element.  max([1, 3, 2]) = 3',
    `// primitive: WINDOWS_N — how many windows this pipeline produces.  WINDOWS_N = ${WIN_STARTS.length}`,
    '',
    '// function: watermarkAfter(i) — the completeness CLAIM after event i:',
    '//   the highest event time seen through i, minus LAG.',
    `//   watermarkAfter(0) = ${WATERMARKS[0]}      watermarkAfter(${EVENTS.indexOf(L)}) = ${WATERMARKS[EVENTS.indexOf(L)]}`,
    'fun watermarkAfter(i) {',
    '    var seen = NONE',
    '    for (j in 0 .. i) {',
    '        if (seen == NONE) { seen = EVENTS[j].et }',
    '        if (EVENTS[j].et > seen) { seen = EVENTS[j].et }',
    '    }',
    '    return seen - LAG',
    '}',
    '',
    '// function: waitFor(events, budget) — split events into those that arrive',
    '//   within budget seconds of happening, and those that do not.',
    `//   waitFor(EVENTS, ${LAG}).dropped = [${DROP_LAG.join(', ')}]`,
    `//   waitFor(EVENTS, ${MAX_SKEW}).dropped = []`,
    'fun waitFor(events, budget) {',
    '    var kept    = []',
    '    var dropped = []',
    '    for (e in events) {',
    '        if (skewOf(e) <= budget) { kept.append(e.id) }',
    '        if (skewOf(e) > budget)  { dropped.append(e.id) }',
    '    }',
    '    return Split(kept, dropped)',
    '}',
    '',
    '// function: priceOf(budget) — the delay a budget adds across EVERY window.',
    `//   priceOf(${LAG}) = ${LAG * WIN_STARTS.length}      priceOf(${MAX_SKEW}) = ${MAX_SKEW * WIN_STARTS.length}`,
    'fun priceOf(budget) {',
    '    return Budget(budget, budget * WINDOWS_N)',
    '}',
    '',
    '// function: main() — THE CALLER: two budgets, priced against each other.',
    'fun main() {',
    `    val claim = watermarkAfter(${EVENTS.indexOf(L)})`,
    `    val cheap = waitFor(EVENTS, ${LAG})`,
    `    val safe  = waitFor(EVENTS, ${MAX_SKEW})`,
    `    val extra = priceOf(${MAX_SKEW}).delayTotal - priceOf(${LAG}).delayTotal`,
    '}',
  ]),
  heap: {
    cheap: { addr: '0x100', type: 'Split', val: () => `kept ${EVENTS.length - DROP_LAG.length} · dropped [${DROP_LAG.join(',')}]` },
    safe:  { addr: '0x200', type: 'Split', val: () => `kept ${EVENTS.length} · dropped []` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `claim = ${o.claim !== undefined ? o.claim : '...'}`, `cheap = ${o.cheap || '...'}`,
      `safe = ${o.safe || '...'}`, `extra = ${o.extra !== undefined ? o.extra : '...'}`] });
    return [
      { t: 'the watermark claims a time is settled when it is not', line: at('fun watermarkAfter(i)', 'return seen - LAG'),
        stack: [MAIN(), { name: 'watermarkAfter', locals: [`i = ${EVENTS.indexOf(L)}`, `seen = ${Math.max(...EVENTS.slice(0, EVENTS.indexOf(L) + 1).map(e => e.et))}`, `j = ${EVENTS.indexOf(L)}`] }],
        heap: [],
        cap: `\`seen\` is the highest event time in the first ${EVENTS.indexOf(L) + 1} events — ${Math.max(...EVENTS.slice(0, EVENTS.indexOf(L) + 1).map(e => e.et))}s — so the claim is ${Math.max(...EVENTS.slice(0, EVENTS.indexOf(L) + 1).map(e => e.et))} − ${LAG} = ${WATERMARKS[EVENTS.indexOf(L)]}. That asserts nothing earlier than ${hhmmss(WATERMARKS[EVENTS.indexOf(L)])} can still arrive. id ${L.id}, at ${hhmmss(L.et)}, is arriving right now. The claim is false and the function has no way to know.` },
      { t: `waiting ${LAG}s: id ${L.id} falls on the wrong side`, line: at('fun waitFor(events, budget)', 'fun waitFor(events, budget)>if (skewOf(e) > budget)  { dropped.append(e.id) }'),
        stack: [MAIN({ claim: WATERMARKS[EVENTS.indexOf(L)] }), { name: 'waitFor', locals: ['events = EVENTS', `budget = ${LAG}`, `kept = ${EVENTS.length - DROP_LAG.length} ids`, 'dropped = @0x100', `e = EVENTS[${L.id}]`] }],
        heap: [{ key: 'cheap', hot: true }],
        cap: `\`skewOf(EVENTS[${L.id}])\` is ${skewOf(L)}, and \`budget\` is ${LAG}, so ${skewOf(L)} > ${LAG} and the event is dropped. ${EVENTS.length - DROP_LAG.length} of ${EVENTS.length} events are kept. Note what decided it: one comparison against a number a human typed.` },
      { t: `waiting ${MAX_SKEW}s: the same call keeps everything`, line: at(`    val safe  = waitFor(EVENTS, ${MAX_SKEW})`),
        stack: [MAIN({ claim: WATERMARKS[EVENTS.indexOf(L)], cheap: '@0x100', safe: '@0x200' })],
        heap: [{ key: 'cheap' }, { key: 'safe', hot: true }],
        cap: `Same function, \`budget\` = ${MAX_SKEW}, and \`dropped\` comes back empty. Completeness is available — it was never a question of algorithms. And ${MAX_SKEW} is exactly \`max(skewOf(e))\` over the whole dataset, which is a number you can only compute once every event has already arrived.` },
      { t: 'and the bill for that completeness', line: at('fun priceOf(budget)', 'return Budget(budget, budget * WINDOWS_N)'),
        stack: [MAIN({ claim: WATERMARKS[EVENTS.indexOf(L)], cheap: '@0x100', safe: '@0x200', extra: (MAX_SKEW - LAG) * WIN_STARTS.length }), { name: 'priceOf', locals: [`budget = ${MAX_SKEW}`] }],
        heap: [{ key: 'cheap' }, { key: 'safe' }],
        cap: `\`priceOf(${MAX_SKEW}).delayTotal\` is ${MAX_SKEW} × ${WIN_STARTS.length} = ${MAX_SKEW * WIN_STARTS.length}s against ${LAG} × ${WIN_STARTS.length} = ${LAG * WIN_STARTS.length}s, so \`extra\` = ${(MAX_SKEW - LAG) * WIN_STARTS.length}s. That is the exchange rate: ${(MAX_SKEW - LAG) * WIN_STARTS.length} seconds of added delay to stop losing ${DROP_LAG.length} event in ${EVENTS.length}. No one can compute whether that trade is worth making.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a watermark is a guess, and what the guess costs — as three functions over the same ${EVENTS.length} events.`, '',
    `\`watermarkAfter(i)\` only ever reads \`EVENTS[0..i]\`. That single fact is the whole limitation: it is arithmetic over what arrived, so it **cannot** account for something that has not arrived. Step 1 catches it making a false claim with no error path available to it.`, '',
    `\`waitFor(events, budget)\` then shows that completeness is purely a matter of the \`budget\` argument — and \`priceOf\` converts that argument into the latency every window pays. The two together are the trade, with numbers on both sides.`],
  sub: `Skews, watermarks, drop lists and the delay totals are all computed from the seed and asserted.` });

// ---- concept 3: one grouping function, three shapes ------------------------
PROGRAMS.push({
  name: 'ch01-shapes-memory', concept: 3,
  title: 'Three shapes through one function — only the key changes',
  subtitle: `bounded and streaming group identically · batch misplaces ids ${MISPLACED.join(', ')}`,
  src: COMMON.concat([
    '',
    'type Grouping { byKey }',
    '',
    `// primitive: WIN — the window width, in seconds of EVENT time.  WIN = ${WIN}`,
    '// primitive: winOf(et) — the START of the WIN-second EVENT-time window holding et.',
    `//   winOf(${L.et}) = ${winOf(L.et)}      winOf(${EVENTS[4].et}) = ${winOf(EVENTS[4].et)}`,
    '// primitive: chunkOf(pt) — the START of the WIN-second PROCESSING-time slice holding pt.',
    `//   chunkOf(${L.pt}) = ${chunkOf(L.pt)}      chunkOf(${EVENTS[4].pt}) = ${chunkOf(EVENTS[4].pt)}`,
    '// primitive: append(m, k, id) — append id to the list at m[k], creating it if absent.',
    '//   append({}, 0, 7) = {0: [7]}',
    '',
    '// function: keyFor(e, shape) — the ONE line that differs between the three shapes.',
    `//   keyFor(EVENTS[${L.id}], "bounded") = ${winOf(L.et)}`,
    `//   keyFor(EVENTS[${L.id}], "unbounded-as-batch") = ${chunkOf(L.pt)}`,
    `//   keyFor(EVENTS[${L.id}], "unbounded-as-streaming") = ${winOf(L.et)}`,
    'fun keyFor(e, shape) {',
    '    if (shape == "unbounded-as-batch") { return chunkOf(e.pt) }',
    '    return winOf(e.et)',
    '}',
    '',
    '// function: group(events, shape) — bucket every event under keyFor.',
    `//   group(EVENTS, "unbounded-as-batch") = {${Object.keys(PT_CHUNKS).map(Number).sort((a, b) => a - b).map(k => `${k}: [${PT_CHUNKS[k].join(', ')}]`).join(', ')}}`,
    `//   group(EVENTS, "unbounded-as-streaming") = {${WIN_STARTS.map(w => `${w}: [${WINDOWS[w].join(', ')}]`).join(', ')}}`,
    'fun group(events, shape) {',
    '    var out = {}',
    '    for (e in events) {',
    '        val k = keyFor(e, shape)',
    '        append(out, k, e.id)',
    '    }',
    '    return Grouping(out)',
    '}',
    '',
    '',
    '// function: watermarkAfter(i) — as in the previous concept: the highest event',
    `//   time through i, minus LAG.  watermarkAfter(${closedAt(0)}) = ${WATERMARKS[closedAt(0)]}`,
    'fun watermarkAfter(i) {',
    '    var seen = NONE',
    '    for (j in 0 .. i) {',
    '        if (seen == NONE) { seen = EVENTS[j].et }',
    '        if (EVENTS[j].et > seen) { seen = EVENTS[j].et }',
    '    }',
    '    return seen - LAG',
    '}',
    '',
    '// function: closesAt(shape, winStart) — the event index after which that',
    '//   window\'s answer is final. For bounded that is always end-of-input.',
    `//   closesAt("bounded", 0) = ${EVENTS.length}`,
    `//   closesAt("unbounded-as-streaming", 0) = ${closedAt(0)}`,
    `//   closesAt("unbounded-as-streaming", ${WIN_STARTS[WIN_STARTS.length - 1]}) = NONE`,
    'fun closesAt(shape, winStart) {',
    '    if (shape == "bounded") { return len(EVENTS) }',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= winStart + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: misplaced(events) — events whose batch slice is not their window.',
    `//   misplaced(EVENTS) = [${MISPLACED.join(', ')}]`,
    'fun misplaced(events) {',
    '    var bad = []',
    '    for (e in events) {',
    '        if (chunkOf(e.pt) != winOf(e.et)) { bad.append(e.id) }',
    '    }',
    '    return bad',
    '}',
    '',
    '// function: main() — THE CALLER: three shapes, one function each time.',
    'fun main() {',
    '    val bounded = group(EVENTS, "bounded")',
    '    val batch   = group(EVENTS, "unbounded-as-batch")',
    '    val stream  = group(EVENTS, "unbounded-as-streaming")',
    '    val bad     = misplaced(EVENTS)',
    `    val neverClosed = closesAt("unbounded-as-streaming", ${WIN_STARTS[WIN_STARTS.length - 1]})`,
    '}',
  ]),
  heap: {
    batch:  { addr: '0x100', type: 'Grouping', val: () => Object.keys(PT_CHUNKS).map(Number).sort((a, b) => a - b).map(k => `${k}:[${PT_CHUNKS[k].join(',')}]`).join(' ') },
    stream: { addr: '0x200', type: 'Grouping', val: () => WIN_STARTS.map(w => `${w}:[${WINDOWS[w].join(',')}]`).join(' ') },
    bad:    { addr: '0x300', type: `int[${MISPLACED.length}]`, val: () => `[${MISPLACED.join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `bounded = ${o.bounded || '...'}`, `batch = ${o.batch || '...'}`, `stream = ${o.stream || '...'}`,
      `bad = ${o.bad || '...'}`, `neverClosed = ${o.neverClosed || '...'}`] });
    return [
      { t: 'the one line where the three shapes differ', line: at('fun keyFor(e, shape)', 'if (shape == "unbounded-as-batch") { return chunkOf(e.pt) }'),
        stack: [MAIN({ bounded: '@0x200' }), { name: 'group', locals: ['events = EVENTS', 'shape = "unbounded-as-batch"', 'out = @0x100', `e = EVENTS[${L.id}]`, `k = ${chunkOf(L.pt)}`] },
                { name: 'keyFor', locals: [`e = EVENTS[${L.id}]`, 'shape = "unbounded-as-batch"'] }],
        heap: [{ key: 'batch', hot: true }],
        cap: `For id ${L.id}, batch returns \`chunkOf(${L.pt})\` = ${chunkOf(L.pt)} while both other shapes return \`winOf(${L.et})\` = ${winOf(L.et)}. One \`if\`, and the event lands ${Math.round((chunkOf(L.pt) - winOf(L.et)) / WIN)} windows away from where it belongs. Nothing else in the program differs between the three shapes.` },
      { t: 'bounded and streaming produce the SAME groups', line: at('    val stream  = group(EVENTS, "unbounded-as-streaming")'),
        stack: [MAIN({ bounded: '@0x200', batch: '@0x100', stream: '@0x200' })],
        heap: [{ key: 'batch' }, { key: 'stream', hot: true }],
        cap: `\`bounded\` and \`stream\` are the same object at \`@0x200\` — identical keys, identical members. They are not two algorithms. The difference between them is entirely in \`closesAt\`, which is the next step, and that is why batch and streaming are one model rather than two.` },
      { t: `so ${MISPLACED.length} of ${EVENTS.length} events are in the wrong bucket`, line: at('fun misplaced(events)', 'if (chunkOf(e.pt) != winOf(e.et)) { bad.append(e.id) }'),
        stack: [MAIN({ bounded: '@0x200', batch: '@0x100', stream: '@0x200', bad: '@0x300' }), { name: 'misplaced', locals: ['events = EVENTS', 'bad = @0x300', `e = EVENTS[${L.id}]`] }],
        heap: [{ key: 'batch' }, { key: 'stream' }, { key: 'bad', hot: true }],
        cap: `\`bad\` = [${MISPLACED.join(', ')}] — ${Math.round(100 * MISPLACED.length / EVENTS.length)}% of the dataset. Compare the two Grouping rows at key ${chunkOf(L.pt)}: batch holds [${PT_CHUNKS[chunkOf(L.pt)].join(',')}], the windows hold [${WINDOWS[chunkOf(L.pt)].join(',')}]. This function can only compute that because it sees both clocks; a batch chunk, from the inside, cannot.` },
      { t: 'and one window never closes at all', line: at('fun closesAt(shape, winStart)', 'if (watermarkAfter(i) >= winStart + WIN) { return i }', '    return NONE'),
        stack: [MAIN({ bounded: '@0x200', batch: '@0x100', stream: '@0x200', bad: '@0x300', neverClosed: 'NONE' }),
                { name: 'closesAt', locals: ['shape = "unbounded-as-streaming"', `winStart = ${WIN_STARTS[WIN_STARTS.length - 1]}`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'stream' }],
        cap: `The loop runs out: no \`watermarkAfter(i)\` ever reaches ${WIN_STARTS[WIN_STARTS.length - 1] + WIN}, so \`closesAt\` returns NONE. Under \`"bounded"\` the first line would have returned ${EVENTS.length} immediately — end of input closes everything. That is the ONLY difference between the two shapes, and it is also the source of unbounded state.` },
    ];
  },
  intro: [
    `**What is being answered.** The claim that batch is a special case of streaming — as code you can check.`, '',
    `\`group(events, shape)\` is one function. The three shapes differ in exactly one line, inside \`keyFor\`: batch keys on \`chunkOf(e.pt)\`, the other two on \`winOf(e.et)\`. Step 2 shows \`bounded\` and \`stream\` resolving to **the same heap object** — same keys, same members.`, '',
    `So what separates bounded from streaming? Only \`closesAt\`: bounded returns end-of-input for every window, streaming waits for the watermark. Step 4 catches that difference producing NONE for the last window — a window that is still open with nothing left to close it.`],
  sub: `The misplaced list, the chunk/window memberships and the never-closing window are derived from the seed and asserted.` });

// ---- concept 4: the dashboard's wrong number, and the three options --------
PROGRAMS.push({
  name: 'ch01-system-memory', concept: 4,
  title: 'The dashboard, traced — how a published number comes out wrong',
  subtitle: `publishes ${M0_SHOWN} at ${hhmmss(M0_DECL_PT)} · truth ${M0_TRUE} · wrong for ${M0_BLIND}s`,
  src: COMMON.concat([
    '',
    'type Dash { display, published, revisions }',
    '',
    `// primitive: M0 — the dashboard minute this trace follows.  M0 = ${M0}  (${hhmmss(M0).slice(0, 5)})`,
    '// primitive: watermarkAfter(i) — the completeness claim after event i:',
    '//   the highest event time seen through i, minus LAG.',
    `//   watermarkAfter(${M0_DECL - 1}) = ${WATERMARKS[M0_DECL - 1]}      watermarkAfter(${M0_DECL}) = ${WATERMARKS[M0_DECL]}`,
    '',
    '// function: onEvent(dash, e, i) — the whole dashboard, per arriving event.',
    `//   onEvent(dash, EVENTS[0], 0) sets display[${M0}] : 0 -> ${EVENTS[0].v}`,
    `//   onEvent(dash, EVENTS[${L.id}], ${L.id}) sets display[${M0}] : ${M0_SHOWN} -> ${M0_TRUE}`,
    'fun onEvent(dash, e, i) {',
    '    val minute = minOf(e.et)',
    '    val closed = (minute in dash.published)',
    '    add(dash.display, minute, e.v)',
    '    if (closed) { dash.revisions = dash.revisions + 1 }',
    '    return dash',
    '}',
    '',
    '// function: publishDue(dash, i) — declare every minute the watermark has passed.',
    `//   publishDue(dash, ${M0_DECL - 1}) publishes nothing   (watermark ${WATERMARKS[M0_DECL - 1]} < ${M0 + MIN})`,
    `//   publishDue(dash, ${M0_DECL}) publishes minute ${M0} showing ${M0_SHOWN}`,
    'fun publishDue(dash, i) {',
    '    for (minute in keysOf(dash.display)) {',
    '        if (watermarkAfter(i) >= minute + MIN) { dash.published.append(minute) }',
    '    }',
    '    return dash',
    '}',
    '',
    '// function: onLate(dash, e, policy) — the three options, as one branch each.',
    `//   onLate(dash, EVENTS[${L.id}], "drop")   leaves display[${M0}] = ${M0_SHOWN}`,
    `//   onLate(dash, EVENTS[${L.id}], "revise") sets  display[${M0}] = ${M0_TRUE}`,
    `//   onLate(dash, EVENTS[${L.id}], "wait")   never reached: nothing was published yet`,
    'fun onLate(dash, e, policy) {',
    '    if (policy == "drop")   { return dash }',
    '    if (policy == "revise") { return onEvent(dash, e, NONE) }',
    '    return dash',
    '}',
    '',
    '// function: main() — THE CALLER: replay the stream into the dashboard.',
    'fun main() {',
    '    var dash = Dash({}, [], 0)',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        dash = onEvent(dash, EVENTS[i], i)',
    '        dash = publishDue(dash, i)',
    '    }',
    `    val shown = dash.display[M0]`,
    '    val fixes = dash.revisions',
    '}',
  ]),
  heap: {
    dash: { addr: '0x100', type: 'Dash', val: () => `display ${MINUTES.map(m => `${m}:${sumOf(BY_ET[m])}`).join(' ')} · revisions ${LATE.length}` },
    published: { addr: '0x200', type: `int[]`, val: () => `[${MINUTES.filter(m => WATERMARKS.some(w => w >= m + MIN)).join(', ')}]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      'dash = @0x100', `i = ${o.i !== undefined ? o.i : '...'}`,
      `shown = ${o.shown !== undefined ? o.shown : '...'}`, `fixes = ${o.fixes !== undefined ? o.fixes : '...'}`] });
    return [
      { t: `the ${hhmmss(M0).slice(0, 5)} minute accumulates the events that have arrived`, line: at('fun onEvent(dash, e, i)', 'fun onEvent(dash, e, i)>add(dash.display, minute, e.v)'),
        stack: [MAIN({ i: 1 }), { name: 'onEvent', locals: ['dash = @0x100', 'e = EVENTS[1]', 'i = 1', `minute = ${M0}`, 'closed = false'] }],
        heap: [{ key: 'dash', hot: true }],
        cap: `After events 0 and 1, \`display[${M0}]\` holds ${EVENTS[0].v} + ${EVENTS[1].v} = ${M0_SHOWN}. \`closed\` is false — the minute has not been published, so nothing is a revision yet. Everything here is correct; the problem is not in this function.` },
      { t: `the watermark passes ${hhmmss(M0 + MIN).slice(0, 5)}, so the minute is PUBLISHED`, line: at('fun publishDue(dash, i)', 'if (watermarkAfter(i) >= minute + MIN) { dash.published.append(minute) }'),
        stack: [MAIN({ i: M0_DECL }), { name: 'publishDue', locals: ['dash = @0x100', `i = ${M0_DECL}`, `minute = ${M0}`] }],
        heap: [{ key: 'dash' }, { key: 'published', hot: true }],
        cap: `At event ${M0_DECL} (id ${EVENTS[M0_DECL].id}, seen ${hhmmss(M0_DECL_PT)}) the watermark reaches ${WATERMARKS[M0_DECL]}, which is ≥ ${M0} + ${MIN}. So minute ${M0} joins \`published\` and ops sees **${M0_SHOWN}**. The true answer is ${M0_TRUE}. The pipeline is not behind — it has decided.` },
      { t: `id ${L.id} arrives ${M0_BLIND}s later, into a minute already published`, line: at(`fun onEvent(dash, e, i)>val closed = (minute in dash.published)`),
        stack: [MAIN({ i: EVENTS.indexOf(L) }), { name: 'onEvent', locals: ['dash = @0x100', `e = EVENTS[${L.id}]`, `i = ${EVENTS.indexOf(L)}`, `minute = ${M0}`, 'closed = true'] }],
        heap: [{ key: 'dash' }, { key: 'published' }],
        cap: `\`minute\` is ${minOf(L.et)} — correct, it is bucketed by event time — and \`closed\` is now **true**, because ${M0} is in \`published\`. This is the exact line where a pipeline discovers it has already lied. For ${M0_BLIND}s, from ${hhmmss(M0_DECL_PT)} to ${hhmmss(M0_FIX_PT)}, the screen said ${M0_SHOWN} and the answer was ${M0_TRUE}.` },
      { t: 'three policies, three different published histories', line: at('fun onLate(dash, e, policy)', 'if (policy == "drop")   { return dash }', 'if (policy == "revise") { return onEvent(dash, e, NONE) }'),
        stack: [MAIN({ i: EVENTS.indexOf(L), shown: M0_TRUE, fixes: LATE.length }), { name: 'onLate', locals: ['dash = @0x100', `e = EVENTS[${L.id}]`, 'policy = "revise"'] }],
        heap: [{ key: 'dash' }, { key: 'published' }],
        cap: `\`"drop"\` returns immediately: \`display[${M0}]\` stays ${M0_SHOWN}, permanently ${M0_ERR}% low. \`"revise"\` re-enters \`onEvent\`, so \`display[${M0}]\` becomes ${M0_TRUE} and \`revisions\` becomes ${LATE.length} — a published number moved, and every downstream reader must cope. The third option, waiting ${MAX_SKEW}s, never reaches this function because nothing was published early enough to need fixing.` },
    ];
  },
  intro: [
    `**What is being answered.** How a correct-looking dashboard publishes a wrong number — line by line, with the real times.`, '',
    `Three functions and nothing clever: \`onEvent\` buckets by \`minOf(e.et)\` (the right clock), \`publishDue\` declares a minute done when \`watermarkAfter(i)\` passes its end, and \`onLate\` is the three policies.`, '',
    `Watch \`closed\` across steps 1 and 3. It is \`false\` while the minute is still open and \`true\` when id ${L.id} finally lands — and that single boolean is the whole design problem. Everything before it is correct, and the answer is still ${M0_SHOWN} against a truth of ${M0_TRUE}.`],
  sub: `The publish event, the published value, the ${M0_BLIND}s error window and the revision count are all derived from the seed's watermarks and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: F.gen, heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch01.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
