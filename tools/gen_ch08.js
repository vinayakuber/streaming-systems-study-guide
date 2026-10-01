#!/usr/bin/env node
'use strict';
/* gen_ch08.js — ch08's four concepts, both bands each: SQL as a stream language,
 * windows in SQL, joins and time in SQL, and the continuous click-count query.
 * Every figure derives from tools/stream_seed.js and is asserted. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, GAP, WATERMARKS, WINDOWS, WIN_STARTS, winOf, closedAt, LATE, SESSIONS, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const mm = (sec) => hhmmss(sec).slice(0, 5);
const secs = (n) => `${n}s`;
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
const PERIOD = WIN / 2;
const L = LATE[0], LI = EVENTS.indexOf(L);
// TUMBLE on each clock — the same SQL, a different time attribute
const bucket = (clock, width) => { const m = {}; for (const e of EVENTS) { const k = Math.floor(e[clock] / width) * width; (m[k] = m[k] || []).push(e.id); } return m; };
const TUMBLE_ET = bucket('et', WIN), TUMBLE_PT = bucket('pt', WIN);
const ET_KEYS = Object.keys(TUMBLE_ET).map(Number).sort((a, b) => a - b);
const PT_KEYS = Object.keys(TUMBLE_PT).map(Number).sort((a, b) => a - b);
const CLOCK_DIFFER = ET_KEYS.filter(k => SUM(TUMBLE_ET[k]) !== SUM(TUMBLE_PT[k] || []));
// HOP — sliding, so a row can land in several windows
const hopStarts = (et) => { const o = []; for (let k = 0; k * PERIOD <= et; k++) { const st = k * PERIOD; if (et < st + WIN) o.push(st); } return o; };
const HOP_TOTAL = EVENTS.reduce((s, e) => s + e.v * hopStarts(e.et).length, 0);
const HOP_WINDOWS = [...new Set(EVENTS.flatMap(e => hopStarts(e.et)))].sort((a, b) => a - b);
// APPEND-ONLY vs UPDATING: a filter never revises a row; a windowed aggregate does
const FILTER_V = 5;
const APPEND_ROWS = EVENTS.filter(e => e.v > FILTER_V).map(e => e.id);
const W0 = WIN_STARTS[0], W0_END = W0 + WIN, W0_TRUE = SUM(WINDOWS[W0]);
const ONTIME_I = closedAt(W0);
const ONTIME = SUM(EVENTS.filter((e, i) => i <= ONTIME_I && winOf(e.et) === W0).map(e => e.id));
const UPDATED_ROWS = ET_KEYS.filter(k => SUM(EVENTS.filter((e, i) => i <= closedAt(k) && winOf(e.et) === k).map(e => e.id)) !== SUM(TUMBLE_ET[k]));
// the SQL text the chapter is about, and the per-key result of it
const perKeyWindow = {};
for (const e of EVENTS) { const k = `${e.key}|${winOf(e.et)}`; perKeyWindow[k] = (perKeyWindow[k] || 0) + e.v; }
const RESULT_ROWS = Object.keys(perKeyWindow).sort();
const fail = (m) => { throw new Error(`gen_ch08: ${m}`); };
if (CLOCK_DIFFER.length < 2) fail(`only ${CLOCK_DIFFER.length} TUMBLE window differs between the clocks — the time-attribute point needs more`);
if (HOP_TOTAL <= TOTAL) fail('HOP does not over-count relative to the data; the overlap point is invisible');
if (!APPEND_ROWS.length) fail('the filter query returns nothing');
if (!UPDATED_ROWS.length) fail('no windowed result is ever revised, so there is no updating stream to contrast');
if (ONTIME === W0_TRUE) fail('the first window is already correct on time; the update story needs a revision');
if (SESSIONS.a.length === SESSIONS.b.length) fail('both keys have the same session count; SESSION(gap) looks like TUMBLE');

const W = 1140;
const SQL_TUMBLE = `SELECT key, SUM(v) FROM clicks GROUP BY key, TUMBLE(et, INTERVAL '${WIN}' SECOND)`;

// ================= CONCEPT 1 — SQL AS A STREAM LANGUAGE =====================
const C1 = [
  { t: 'a query over a stream never finishes', draw: (c) =>
      c.panel('THE SAME SQL, OVER A TABLE AND OVER A STREAM', 'a')
      + c.mapRows('cq', c.P.main.x + 24, c.P.main.y + 52, [
        [`over a finite TABLE`, `read ${EVENTS.length} rows, emit ${RESULT_ROWS.length} result rows, exit`],
        [`over an unbounded STREAM`, `emit ${RESULT_ROWS.length} rows so far, and keep running`],
        [`so "the result" is`, `a table that changes, not a value that is returned`],
        [`and the query's lifetime is`, `forever — there is no row count at which it is done`],
      ], { w: 1040, rh: 36, hot: 2, label: 'one query text, two completely different execution models' })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A batch query returns; a continuous query MAINTAINS. Everything else in this chapter follows from that one difference.`,
        `In particular, "when is the answer right?" becomes a question the query text has to answer, because nothing else will.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The query text is identical and the execution model is not. Over a table it reads ${EVENTS.length} rows and returns ${RESULT_ROWS.length}; over a stream it maintains those ${RESULT_ROWS.length} rows indefinitely. A batch query *returns*, a continuous query *maintains* — and that is why "when is this answer final?" has to be expressed in the query rather than assumed.` },
  { t: 'relational operations map straight onto streaming transforms', draw: (c) =>
      c.panel('THE MAPPING, WITH THIS DATASET', 'a')
      + c.mapRows('mp', c.P.main.x + 24, c.P.main.y + 52, [
        [`SELECT key, v`, `a transform — the "what" of ch02`],
        [`WHERE v > ${FILTER_V}`, `a filter — ${APPEND_ROWS.length} of ${EVENTS.length} rows: ids ${APPEND_ROWS.join(', ')}`],
        [`GROUP BY key`, `a keyed aggregation — ${KEYS.length} groups`],
        [`GROUP BY key, TUMBLE(et, ${WIN}s)`, `keyed aggregation per WINDOW — ${RESULT_ROWS.length} groups`],
      ], { w: 1040, rh: 36, hot: 3, label: 'nothing new is invented; the relational algebra already has these' })
      + c.note('m1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The only row with no batch equivalent is the last: TUMBLE needs a TIME column, and batch SQL has no notion of event time.`,
        `So streaming SQL is not a new language. It is relational SQL plus one idea: a column whose values are a clock.`,
      ], c.C.good, c.C.goodFill),
    cap: `Three of these four rows are plain SQL doing plain SQL things. The fourth is the whole addition: \`TUMBLE(et, ...)\` requires a time column, and the number of result groups jumps from ${KEYS.length} to ${RESULT_ROWS.length} because the grouping key now includes a window. Streaming SQL is relational SQL plus a column that is a clock.` },
  { t: 'and the time attribute is a CHOICE with different answers', draw: (c) => {
      let s = c.panel('TUMBLE ON et VERSUS TUMBLE ON pt', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `${SQL_TUMBLE.replace('key, SUM(v)', 'SUM(v)').replace(' GROUP BY key,', ' GROUP BY')} — and the same query with pt`, { size: 10, weight: 700, fill: c.C.line });
      ET_KEYS.forEach((k, i) => {
        const y = c.P.main.y + 66 + i * 34, bad = CLOCK_DIFFER.includes(k);
        s += c.cv.rect('tc' + i, c.P.main.x + 24, y, 1040, 30, { fill: bad ? c.C.hotFill : c.C.paper, stroke: bad ? c.C.hot : c.C.faint, rx: 3, sw: bad ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `window [${mm(k)}, ${mm(k + WIN)})`, { size: 11, weight: 700, band: 'tck' + i });
        s += c.cv.text(c.P.main.x + 250, y + 20, `TUMBLE(et): ${SUM(TUMBLE_ET[k])}  (ids ${TUMBLE_ET[k].join(',')})`, { size: 11, band: 'tce' + i });
        s += c.cv.text(c.P.main.x + 630, y + 20, `TUMBLE(pt): ${SUM(TUMBLE_PT[k] || [])}  (ids ${(TUMBLE_PT[k] || []).join(',') || 'none'})`, { size: 11, fill: bad ? c.C.hot : c.C.ink, band: 'tcp' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 20, bad ? 'DIFFERENT' : 'agrees', { size: 10, anchor: 'end', weight: 700, fill: bad ? c.C.hot : c.C.good, band: 'tcf' + i });
      });
      return s + c.note('t1', c.P.main.x + 24, c.P.main.y + 80 + ET_KEYS.length * 34, 1040, [
        `${CLOCK_DIFFER.length} of the ${ET_KEYS.length} windows get a different answer. One token in the query — \`et\` or \`pt\` — decides which.`,
        `And both are valid SQL producing valid results. Nothing in the engine can tell you the wrong one was chosen.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is ch01's two-clock problem arriving as a one-token edit. \`TUMBLE(et, ...)\` and \`TUMBLE(pt, ...)\` differ by three characters and disagree on ${CLOCK_DIFFER.length} of ${ET_KEYS.length} windows — window [${mm(CLOCK_DIFFER[0])}, ${mm(CLOCK_DIFFER[0] + WIN)}) reads ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} against ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])}. Both are valid SQL and the engine cannot flag either.` },
  { t: 'so some results append and others UPDATE', draw: (c) =>
      c.panel('TWO QUERIES, TWO KINDS OF RESULT STREAM', 'p')
      + c.mapRows('au', c.P.main.x + 24, c.P.main.y + 52, [
        [`SELECT * FROM clicks WHERE v > ${FILTER_V}`, `APPEND-ONLY — ${APPEND_ROWS.length} rows (ids ${APPEND_ROWS.join(', ')}), none ever revised`],
        [`${SQL_TUMBLE.slice(0, 44)}…`, `UPDATING — ${UPDATED_ROWS.length} of ${ET_KEYS.length} window rows get revised`],
        [`window [${mm(W0)}, ${mm(W0_END)}) specifically`, `first ${ONTIME}, then ${W0_TRUE} when id ${L.id} arrives`],
        [`what the sink must support`, `append-only: INSERT · updating: UPSERT, or a retraction`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the update mode is a property of the QUERY, not of the engine' })
      + c.note('a1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A filter can never revise a row — a row either matched or it did not. An aggregate over an open window can always be revised.`,
        `So you can read the update mode off the query text, and it tells you what the sink has to be capable of before you write any code.`,
      ], c.C.good, c.C.goodFill),
    cap: `The update mode is readable from the query, which makes it a design input rather than a surprise. A \`WHERE\` produces ${APPEND_ROWS.length} facts that never change; a windowed \`GROUP BY\` produces ${ET_KEYS.length} rows of which ${UPDATED_ROWS.length} get revised — window [${mm(W0)}, ${mm(W0_END)}) goes ${ONTIME} then ${W0_TRUE}. An INSERT-only sink is compatible with the first and not the second.` },
];

// ===================== CONCEPT 2 — WINDOWS IN SQL ===========================
const C2 = [
  { t: 'TUMBLE — equal, non-overlapping, one row each', draw: (c) =>
      c.panel(`TUMBLE(et, INTERVAL '${WIN}' SECOND)`, 'a')
      + c.mapRows('tb', c.P.main.x + 24, c.P.main.y + 52, ET_KEYS.map(k =>
          [`[${mm(k)}, ${mm(k + WIN)})`, `${SUM(TUMBLE_ET[k])}   (ids ${TUMBLE_ET[k].join(', ')})`]),
        { w: 1040, rh: 32, label: `${ET_KEYS.length} rows, and the sums total ${ET_KEYS.reduce((n, k) => n + SUM(TUMBLE_ET[k]), 0)} — the whole dataset` })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 66 + ET_KEYS.length * 32, 1040, [
        `Every row of the input is in exactly one output row, so the totals reconcile against a batch job over the same data.`,
        `This is the SQL spelling of ch04's fixed window — same semantics, different syntax, nothing added.`,
      ], c.C.good, c.C.goodFill),
    cap: `TUMBLE is the default to reach for and the easy one to reason about: ${ET_KEYS.length} output rows, each input row counted once, totals summing to ${ET_KEYS.reduce((n, k) => n + SUM(TUMBLE_ET[k]), 0)}. If a question names a period, this is the window, and the result reconciles against a batch run.` },
  { t: 'HOP — overlapping, so a row appears several times', draw: (c) => {
      let s = c.panel(`HOP(et, INTERVAL '${PERIOD}' SECOND, INTERVAL '${WIN}' SECOND)`, 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'how many output rows each input row contributes to', { size: 11, weight: 700, fill: c.C.line });
      EVENTS.forEach((e, i) => {
        const y = c.P.main.y + 64 + i * 28, n = hopStarts(e.et).length;
        s += c.cv.rect('hp' + i, c.P.main.x + 24, y, 1040, 24, { fill: n > 1 ? c.C.warnFill : c.C.paper, stroke: n > 1 ? c.C.warn : c.C.faint, rx: 3 });
        s += c.cv.text(c.P.main.x + 40, y + 17, `id ${e.id} (et ${hhmmss(e.et)}, v ${e.v})`, { size: 11, band: 'hpk' + i });
        s += c.cv.text(c.P.main.x + 330, y + 17, `TUMBLE: 1 row`, { size: 11, band: 'hpt' + i });
        s += c.cv.text(c.P.main.x + 520, y + 17, `HOP: ${n} row${n > 1 ? 's' : ''} — ${hopStarts(e.et).map(mm).join(', ')}`, { size: 11, weight: n > 1 ? 700 : 400, fill: n > 1 ? c.C.warn : c.C.ink, band: 'hph' + i });
      });
      return s + c.note('h1', c.P.main.x + 24, c.P.main.y + 78 + EVENTS.length * 28, 1040, [
        `${HOP_WINDOWS.length} output rows instead of ${ET_KEYS.length}, totalling ${HOP_TOTAL} instead of ${TOTAL} — because ${EVENTS.filter(e => hopStarts(e.et).length > 1).length} input rows appear in ${Math.max(...EVENTS.map(e => hopStarts(e.et).length))} windows.`,
        `The output volume is size / slide = ${WIN} / ${PERIOD} = ${WIN / PERIOD}x. That is the intent, not a bug — and it means HOP totals must never be compared to the input.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `HOP answers "the rolling ${secs(WIN)} figure, refreshed every ${secs(PERIOD)}" and costs ${WIN / PERIOD}× the rows. The column to read is the third: ${EVENTS.filter(e => hopStarts(e.et).length > 1).length} of ${EVENTS.length} input rows land in ${Math.max(...EVENTS.map(e => hopStarts(e.et).length))} output rows, which is why the ${HOP_TOTAL} total is correct and incomparable to the dataset's ${TOTAL}.` },
  { t: 'SESSION — the engine merges windows as rows arrive', draw: (c) =>
      c.panel(`SESSION(et, INTERVAL '${GAP}' SECOND)`, 'a')
      + c.mapRows('se', c.P.main.x + 24, c.P.main.y + 52, KEYS.flatMap(k =>
          SESSIONS[k].map((sx, j) => [`key "${k}" session ${j + 1}`, `[${hhmmss(sx.start)}, ${hhmmss(sx.end)}] · ids ${sx.ids.join(',')} · ${SUM(sx.ids)}`])),
        { w: 1040, rh: 32, label: `key "${KEYS[0]}" gets ${SESSIONS[KEYS[0]].length} rows and key "${KEYS[1]}" gets ${SESSIONS[KEYS[1]].length} — the row COUNT is data-dependent` })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 66 + (SESSIONS.a.length + SESSIONS.b.length) * 32, 1040, [
        `TUMBLE and HOP have a row count you can compute from the time range. SESSION does not — it comes from how bursty the data was.`,
        `And the engine MERGES: a row arriving inside the gap between two existing sessions collapses them, which is a window boundary moving after the fact.`,
      ], c.C.blue, c.C.blueFill),
    cap: `SESSION is the one window whose output row count cannot be predicted from the query: key "${KEYS[0]}" gets ${SESSIONS[KEYS[0]].length} rows and key "${KEYS[1]}" gets ${SESSIONS[KEYS[1]].length} over the same time range. The merging in the note is what the engine is doing for you, and it is also why a SESSION result is always an updating stream.` },
  { t: 'and the watermark is what makes any of them correct', draw: (c) =>
      c.panel('WHEN A WINDOWED ROW IS EMITTED', 'p')
      + c.mapRows('wm', c.P.main.x + 24, c.P.main.y + 52, ET_KEYS.map(k => {
          const ci = closedAt(k);
          return [`[${mm(k)}, ${mm(k + WIN)})`, ci === null ? 'never emitted — the watermark never passes its end' : `emitted after event ${ci}, holding ${SUM(EVENTS.filter((e, i) => i <= ci && winOf(e.et) === k).map(e => e.id))} (final ${SUM(TUMBLE_ET[k])})`];
        }), { w: 1040, rh: 32, hot: 0, label: 'the time attribute picks the bucket; the watermark picks the moment' })
      + c.note('w1', c.P.main.x + 24, c.P.main.y + 66 + ET_KEYS.length * 32, 1040, [
        `Without a watermark a windowed query over an unbounded stream could never emit anything, because "the window is done" would never become true.`,
        `${ET_KEYS.filter(k => closedAt(k) === null).length} of the ${ET_KEYS.length} windows here is never emitted at all, and the SQL gives no hint of that.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The query says which bucket a row goes in; the watermark says when the bucket speaks. Both are needed and only one is visible in the SQL — which is why ${ET_KEYS.filter(k => closedAt(k) === null).length} window here is never emitted and nothing in the query text would tell you. The engine configures the watermark; you still chose the time attribute that it applies to.` },
];

// ================= CONCEPT 3 — JOINS AND TIME IN SQL ========================
const C3 = [
  { t: 'joining two streams needs a time bound, or it never ends', draw: (c) =>
      c.panel('WHY A STREAM-STREAM JOIN NEEDS A WINDOW', 'a')
      + c.mapRows('jb', c.P.main.x + 24, c.P.main.y + 52, [
        [`a batch join`, `completes when both tables are read — ${EVENTS.filter(e => e.key === KEYS[0]).length} x ${EVENTS.filter(e => e.key === KEYS[1]).length} candidate pairs, then done`],
        [`a stream-stream join`, `never completes: either side may still produce a match`],
        [`so SQL requires a bound`, `match rows whose time attributes are within a window of each other`],
        [`and the bound does two jobs`, `it ends the wait, AND it bounds the buffered state`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the window is not an optimisation here; without it the query has no semantics' })
      + c.note('j1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `An unwindowed join of two unbounded streams would have to keep every row of both sides forever, in case a match arrives.`,
        `So the time bound is what makes the query both finite in state and defined in meaning. SQL will not let you omit it.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Worth stating plainly because it is the one place streaming SQL refuses something batch SQL allows: a join of two unbounded streams has no meaning without a time bound, because no row is ever the last candidate. The bound ends the wait and bounds the buffer at the same time, which is why it is mandatory rather than advisory.` },
  { t: 'the watermark decides when a join result may be emitted', draw: (c) =>
      c.panel('BOTH SIDES MUST BE COMPLETE FOR THE WINDOW', 'a')
      + c.mapRows('wj', c.P.main.x + 24, c.P.main.y + 52, [
        [`left side (key "${KEYS[0]}") watermark at the end`, `${hhmmss(Math.max(...EVENTS.filter(e => e.key === KEYS[0]).map(e => e.et)) - LAG)}`],
        [`right side (key "${KEYS[1]}") watermark at the end`, `${hhmmss(Math.max(...EVENTS.filter(e => e.key === KEYS[1]).map(e => e.et)) - LAG)}`],
        [`the join's watermark`, `the MINIMUM of the two — ${hhmmss(Math.min(...KEYS.map(k => Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG)))}`],
        [`so a match is emitted when`, `that minimum passes the join window's end`],
      ], { w: 1040, rh: 36, hot: 2, label: 'ch03\'s propagation rule, applied to a join' })
      + c.note('w2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The join cannot claim more completeness than its least-complete input, exactly as a stage cannot in ch03.`,
        `Which means one slow or idle side holds back every result — a join is where the minimum rule hurts most, because it has two inputs by construction.`,
      ], c.C.warn, c.C.warnFill),
    cap: `A join is the clearest case of ch03's minimum rule, because it structurally has two inputs. The two sides reach ${KEYS.map(k => hhmmss(Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG)).join(' and ')}, so the join claims the lower — and every emission waits on whichever stream is further behind, however fast the other one is.` },
  { t: 'the time attribute is the same choice, with the same cost', draw: (c) =>
      c.panel('EVENT TIME OR PROCESSING TIME, IN A JOIN', 'a')
      + c.mapRows('ta', c.P.main.x + 24, c.P.main.y + 52, [
        [`join on EVENT time`, `correct pairings; rows can arrive late and change the result`],
        [`join on PROCESSING time`, `no late data by definition; pairs rows that did not happen together`],
        [`how wrong is that here`, `id ${L.id} happened at ${hhmmss(L.et)} and arrived at ${hhmmss(L.pt)} — ${secs(L.pt - L.et)} apart`],
        [`so a processing-time join`, `would pair it with rows from ${hhmmss(L.pt)}, not with rows from ${hhmmss(L.et)}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same decision as a window, with the error now in the PAIRING' })
      + c.note('t2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `In a windowed aggregate the wrong clock puts a value in the wrong bucket. In a join it pairs the wrong two rows, which is harder to spot downstream.`,
        `Event time is the right default for the same reason as everywhere else — and it is the reason the join needs watermarks and lateness handling at all.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The clock choice costs more in a join than in an aggregate. A mis-bucketed sum is a wrong number in a known place; a mis-paired join emits a row asserting that two things coincided when they did not. For id ${L.id} that is a ${secs(L.pt - L.et)} error in the pairing, and the resulting row looks entirely plausible.` },
  { t: 'so SQL hides the mechanics and not the semantics', draw: (c) =>
      c.panel('WHAT THE ENGINE CHOOSES, AND WHAT YOU STILL CHOOSE', 'p')
      + c.mapRows('hs', c.P.main.x + 24, c.P.main.y + 52, [
        [`the ENGINE configures`, `triggers, accumulation mode, retraction emission, state layout`],
        [`YOU still choose`, `the window (TUMBLE / HOP / SESSION) and the time attribute`],
        [`and those two decide`, `${ET_KEYS.length} rows or ${HOP_WINDOWS.length}; ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} or ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])} in window [${mm(CLOCK_DIFFER[0])}, …)`],
        [`what SQL does NOT remove`, `the need to understand watermarks — ${ET_KEYS.filter(k => closedAt(k) === null).length} window still never emits`],
      ], { w: 1040, rh: 36, hot: 3, label: 'a shorter notation for the Beam model, not a replacement for it' })
      + c.note('h2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Everything from ch02 is still underneath: what (the aggregate), where (the window), when (the watermark), how (the engine's accumulation mode).`,
        `SQL removes the boilerplate for "when" and "how" and leaves "what" and "where" entirely in your hands — which is where the correctness decisions live.`,
      ], c.C.good, c.C.goodFill),
    cap: `The honest summary of streaming SQL: it is a shorter notation, not a simpler model. The engine handles triggers, accumulation and retractions; you still pick the window and the clock, and those two choices decide whether a window holds ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} or ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])}. The ${ET_KEYS.filter(k => closedAt(k) === null).length} window that never emits is invisible in the SQL and entirely real.` },
];

// ============ CONCEPT 4 — THE CONTINUOUS QUERY (systemDesign) ===============
const C4 = [
  { t: 'the pipeline, and the one line of SQL it runs', draw: (c) =>
      c.panel('A CONTINUOUS CLICK-COUNT QUERY — FIVE STAGES', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`streams (clicks, impressions)`, `${EVENTS.length} rows, with et and pt on every one`],
        [`SQL engine (continuous query)`, SQL_TUMBLE.slice(0, 58) + '…'],
        [`watermark + window`, `TUMBLE buckets by et; the watermark decides when each bucket emits`],
        [`updating result`, `${RESULT_ROWS.length} rows, of which ${UPDATED_ROWS.length} window row gets revised`],
        [`sink`, `must UPSERT — an INSERT-only sink cannot express the revision`],
      ], { w: 1040, rh: 34, hot: 4, label: 'the sink requirement is readable from the query text' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 236, 1040, [
        `The last row is the design decision this query forces: a windowed GROUP BY produces an updating stream, so the sink needs UPSERT or retractions.`,
        `That is known before any code is written, from the shape of the query — which is the practical value of the append-only/updating distinction.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The useful property of a SQL-first design is that the sink requirement falls out of the query text. A windowed \`GROUP BY\` is an updating stream — ${UPDATED_ROWS.length} of ${ET_KEYS.length} window rows is revised here — so the sink must UPSERT. Had the query been a \`WHERE\`, an append-only sink would have been fine, and that is decidable before anything is built.` },
  { t: 'the result row, as it actually changes', draw: (c) =>
      c.panel(`WINDOW [${mm(W0)}, ${mm(W0_END)}) — WHAT THE SINK RECEIVES`, 'a')
      + c.mapRows('rr', c.P.main.x + 24, c.P.main.y + 52, [
        [`rows that belong to this window`, `ids ${WINDOWS[W0].join(', ')} · final sum ${W0_TRUE}`],
        [`the watermark passes ${mm(W0_END)} after event ${ONTIME_I}`, `at ${hhmmss(EVENTS[ONTIME_I].pt)} — the engine emits`],
        [`what it emits then`, `${ONTIME}, from ids ${EVENTS.filter((e, i) => i <= ONTIME_I && winOf(e.et) === W0).map(e => e.id).join(', ')}`],
        [`then id ${L.id} arrives at ${hhmmss(L.pt)}`, `the row is UPDATED: ${ONTIME} → ${W0_TRUE}`],
      ], { w: 1040, rh: 36, hot: 3, label: 'one output row, two values, and the SQL says nothing about either' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The query text contains neither ${ONTIME} nor ${W0_TRUE} nor the moment ${hhmmss(EVENTS[ONTIME_I].pt)} — all three come from the watermark the engine maintains.`,
        `Which is the point of this chapter: SQL made the query short and left the timing semantics exactly where ch02 and ch03 put them.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Follow the one row all the way: the window finally holds ${W0_TRUE}, the watermark lets the engine emit at ${hhmmss(EVENTS[ONTIME_I].pt)} with ${ONTIME}, and id ${L.id} later revises it to ${W0_TRUE}. None of ${ONTIME}, ${W0_TRUE} or ${hhmmss(EVENTS[ONTIME_I].pt)} appears in the SQL. The query got shorter; the semantics did not get simpler.` },
  { t: 'the two choices that are still yours', draw: (c) =>
      c.panel('WHAT CHANGING ONE TOKEN DOES', 'a')
      + c.mapRows('tk', c.P.main.x + 24, c.P.main.y + 52, [
        [`TUMBLE(et, ${WIN}s) — as written`, `${ET_KEYS.length} rows: ${ET_KEYS.map(k => SUM(TUMBLE_ET[k])).join(', ')}`],
        [`TUMBLE(pt, ${WIN}s) — one token changed`, `${PT_KEYS.length} rows: ${PT_KEYS.map(k => SUM(TUMBLE_PT[k])).join(', ')} — ${CLOCK_DIFFER.length} differ`],
        [`HOP(et, ${PERIOD}s, ${WIN}s)`, `${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL}, against a dataset of ${TOTAL}`],
        [`SESSION(et, ${GAP}s)`, `${SESSIONS.a.length + SESSIONS.b.length} rows — a count the query cannot predict`],
      ], { w: 1040, rh: 36, hot: 1, label: 'four queries differing by a few characters, four different result shapes' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `None of these is wrong. They answer four different questions, and the SQL is almost identical in all four.`,
        `So a code review of a streaming query has to read the window and the time attribute first — they carry more meaning per character than anything else in the statement.`,
      ], c.C.good, c.C.goodFill),
    cap: `Four nearly-identical statements with four different answers: ${ET_KEYS.length} rows, ${PT_KEYS.length} rows disagreeing on ${CLOCK_DIFFER.length} of them, ${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL}, and ${SESSIONS.a.length + SESSIONS.b.length} rows whose count the query cannot predict. Those few characters carry more meaning than the rest of the statement put together.` },
  { t: 'and what this query does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`${ET_KEYS.filter(k => closedAt(k) === null).length} of the ${ET_KEYS.length} windows is never emitted, because the watermark never passes its end. Nothing in the SQL hints at that, and the sink simply never sees the row.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The engine chooses the accumulation mode. If it accumulates and the sink sums rather than upserts, the window reads ${ONTIME + W0_TRUE} instead of ${W0_TRUE} — and that mismatch lives outside the query entirely.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Allowed lateness is an engine setting, not query syntax. Whether id ${L.id} is admitted at all depends on configuration the SQL does not mention.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And SESSION's row count is data-dependent (${SESSIONS.a.length + SESSIONS.b.length} here), so a query that looks like the others cannot be capacity-planned like them.`], c.C.blue, c.C.blueFill),
    cap: `The first two gaps are the ones that make SQL deceptive rather than merely incomplete. A window that never emits produces no error and no row; a sink that sums accumulating panes reads ${ONTIME + W0_TRUE} instead of ${W0_TRUE}. Both are invisible in the query text, which is exactly why the model underneath still has to be understood.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch08-sql', steps: C1,
    title: 'SQL as a stream language — one addition, several consequences',
    subtitle: `TUMBLE(et) and TUMBLE(pt) disagree on ${CLOCK_DIFFER.length} of ${ET_KEYS.length} windows · ${APPEND_ROWS.length} append-only rows vs ${UPDATED_ROWS.length} revised`,
    heading: 'Why streaming SQL is relational SQL plus a column that is a clock',
    why: [
      `**A query over a stream never finishes.** The same text over a finite table reads ${EVENTS.length} rows, emits ${RESULT_ROWS.length} result rows and exits; over an unbounded stream it emits those ${RESULT_ROWS.length} rows and keeps running. A batch query **returns**; a continuous query **maintains** — and everything else follows from that.`, '',
      `**The relational operations map straight across.** \`SELECT\` is a transform, \`WHERE v > ${FILTER_V}\` is a filter (${APPEND_ROWS.length} of ${EVENTS.length} rows: ids ${APPEND_ROWS.join(', ')}), \`GROUP BY key\` is a keyed aggregation (${KEYS.length} groups). Nothing new so far.`, '',
      `The one row with no batch equivalent is \`GROUP BY key, TUMBLE(et, INTERVAL '${WIN}' SECOND)\`, which needs a **time column** — and batch SQL has no notion of event time. Adding the window takes the group count from ${KEYS.length} to ${RESULT_ROWS.length}. **Streaming SQL is relational SQL plus a column whose values are a clock.**`, '',
      `**And which clock is a one-token choice with different answers.** \`TUMBLE(et, …)\` and \`TUMBLE(pt, …)\` differ by three characters, and over this dataset they disagree on **${CLOCK_DIFFER.length} of the ${ET_KEYS.length} windows** — window [${mm(CLOCK_DIFFER[0])}, ${mm(CLOCK_DIFFER[0] + WIN)}) reads ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} by event time and ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])} by processing time. Both are valid SQL producing valid results, and no engine can flag the wrong one.`, '',
      `**So some results append and others update.** \`SELECT * FROM clicks WHERE v > ${FILTER_V}\` is **append-only**: ${APPEND_ROWS.length} rows, each a fact that can never be revised, because a row either matched or it did not. The windowed aggregate is **updating**: ${UPDATED_ROWS.length} of its ${ET_KEYS.length} window rows gets revised — window [${mm(W0)}, ${mm(W0_END)}) emits ${ONTIME} and later becomes ${W0_TRUE}.`, '',
      `That distinction is readable from the query text, and it tells you what the sink must be capable of before any code exists.`],
    whenHeading: 'When to reach for streaming SQL, and what it does not do for you',
    when: [
      `**Use it when the computation is expressible relationally** — filters, keyed aggregates, windowed sums, joins. That is most analytics work, and the SQL version is an order of magnitude less code than the equivalent pipeline.`, '',
      `**Read the query for its update mode before choosing a sink.** A \`WHERE\` can target an append-only log; a windowed \`GROUP BY\` needs UPSERT or retraction support. Getting this backwards is discovered late and fixed expensively.`, '',
      `**Default the time attribute to event time** for the same reason as everywhere else: it answers questions about the world rather than about your infrastructure. Reach for processing time only when the question really is about the pipeline.`, '',
      `**Do not use SQL to avoid learning the model.** The engine configures triggers and accumulation; the window and the clock are still yours, and they are where the correctness decisions are.`, '',
      `**What this does not settle:** which window shapes exist and what each costs. TUMBLE, HOP and SESSION have very different output volumes and state profiles — one of them cannot even have its row count predicted from the query — which is the next concept.`],
    diagramHeading: 'Visual walkthrough — continuous, mapped, clocked, and the two result kinds',
    sub: `The clock comparison, the filter result and the revised-row count are computed from the seed and asserted.` },
  { name: 'ch08-windows', steps: C2,
    title: 'Windows in SQL — TUMBLE, HOP, SESSION, and the watermark',
    subtitle: `TUMBLE ${ET_KEYS.length} rows totalling ${TOTAL} · HOP ${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL} · SESSION ${SESSIONS.a.length + SESSIONS.b.length} rows, count unpredictable`,
    heading: 'Why the three window functions are three different cost profiles',
    why: [
      `**TUMBLE(size)** is the fixed window: equal, contiguous, non-overlapping. ${ET_KEYS.length} output rows here (${ET_KEYS.map(k => SUM(TUMBLE_ET[k])).join(', ')}), every input row counted once, and the sums total ${TOTAL} — the whole dataset. That reconciliation against a batch run is what makes it the easy case.`, '',
      `**HOP(slide, size)** is the sliding window: fixed length, advancing by \`slide\`. With ${secs(WIN)} windows every ${secs(PERIOD)}, ${EVENTS.filter(e => hopStarts(e.et).length > 1).length} of the ${EVENTS.length} input rows land in ${Math.max(...EVENTS.map(e => hopStarts(e.et).length))} output rows, so there are **${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL}** against a dataset of ${TOTAL}. Output volume is size / slide = ${WIN / PERIOD}×, and a HOP total must never be compared to an input total.`, '',
      `**SESSION(gap)** is the data-driven window, and it is the one whose **row count cannot be predicted from the query**: key "${KEYS[0]}" gets ${SESSIONS[KEYS[0]].length} rows and key "${KEYS[1]}" gets ${SESSIONS[KEYS[1]].length} over the same time range, because that is how bursty each key's activity was. The engine also **merges** sessions as rows arrive, which means a window boundary can move after the fact — so a SESSION result is always an updating stream.`, '',
      `**And the watermark is what makes any of them correct.** The time attribute picks the bucket; the watermark picks the moment the bucket speaks. Window [${mm(W0)}, ${mm(W0_END)}) emits after event ${ONTIME_I} holding ${ONTIME}, against a final ${W0_TRUE}.`, '',
      `Without a watermark a windowed query over an unbounded stream could never emit anything, because "this window is done" would never become true. And **${ET_KEYS.filter(k => closedAt(k) === null).length} of the ${ET_KEYS.length} windows here is never emitted at all** — the SQL gives no hint of that, and the sink simply never sees the row.`],
    whenHeading: 'When to use each window function, and how to capacity-plan them',
    when: [
      `**TUMBLE when the question names a period.** Plan for (keys × open windows) state and one output row per window. Totals reconcile, which makes it the only shape you can easily check against a batch job.`, '',
      `**HOP for a moving measure,** and budget ${WIN / PERIOD}× the rows and ${WIN / PERIOD}× the state up front. The failure here is not performance but interpretation: someone compares ${HOP_TOTAL} to ${TOTAL} and files a bug.`, '',
      `**SESSION when the boundary belongs to the data** — a visit, a trip, an engagement. Accept that you cannot capacity-plan it from the query, and that the result is necessarily updating because of merging.`, '',
      `**And in all three cases, find out what the engine's watermark settings are.** The window is in your SQL; the moment of emission is not, and ${ET_KEYS.filter(k => closedAt(k) === null).length} window here never emits because of it.`, '',
      `**What this does not settle:** joins. A windowed aggregate has one input, so the watermark story is simple. A join has two by construction, which makes ch03's minimum rule bite much harder — that is the next concept.`],
    diagramHeading: 'Visual walkthrough — three window functions, and when each row emits',
    sub: `Every window membership, the HOP total and the never-emitted window are computed from the seed and asserted.` },
  { name: 'ch08-joins', steps: C3,
    title: 'Joins and time in SQL — two inputs, one watermark',
    subtitle: `the join claims min(${KEYS.map(k => hhmmss(Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG)).join(', ')}) · a mis-clocked join pairs rows ${secs(L.pt - L.et)} apart`,
    heading: 'Why a join is where the time decisions cost the most',
    why: [
      `**Joining two unbounded streams needs a time bound, or the query has no meaning.** A batch join completes when both tables are read — here ${EVENTS.filter(e => e.key === KEYS[0]).length} × ${EVENTS.filter(e => e.key === KEYS[1]).length} candidate pairs, then done. A stream-stream join never completes on its own: either side may still produce a match.`, '',
      `So SQL **requires** a window on such a join, and the bound does two jobs at once — it ends the wait, and it bounds the buffered state. Without it the engine would have to keep every row of both sides forever in case a match arrives.`, '',
      `**The watermark decides when a result may be emitted**, and it is ch03's minimum rule applied to two inputs. Side "${KEYS[0]}" reaches ${hhmmss(Math.max(...EVENTS.filter(e => e.key === KEYS[0]).map(e => e.et)) - LAG)} and side "${KEYS[1]}" reaches ${hhmmss(Math.max(...EVENTS.filter(e => e.key === KEYS[1]).map(e => e.et)) - LAG)}, so the join claims the **minimum**, ${hhmmss(Math.min(...KEYS.map(k => Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG)))}.`, '',
      `A join is where that rule hurts most, because it has two inputs by construction: one slow or idle side holds back every result, however fast the other is.`, '',
      `**And the clock choice costs more here than in an aggregate.** In a windowed sum the wrong clock puts a value in the wrong bucket — a wrong number in a known place. In a join it **pairs the wrong two rows**, emitting an assertion that two things coincided when they did not. For id ${L.id}, which happened at ${hhmmss(L.et)} and arrived at ${hhmmss(L.pt)}, a processing-time join would pair it with rows from ${hhmmss(L.pt)} — ${secs(L.pt - L.et)} away from when it actually happened — and the resulting row looks entirely plausible.`, '',
      `**So SQL hides the mechanics, not the semantics.** The engine configures triggers, accumulation, retraction emission and state layout. You still choose the window and the time attribute, and those two decide whether a window holds ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} or ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])}, and whether ${ET_KEYS.filter(k => closedAt(k) === null).length} window ever emits.`],
    whenHeading: 'When to join streams, when to join against a table, and what to review first',
    when: [
      `**Window the join when both inputs are genuinely streams** and a match means "these happened close together". The window width is a domain statement — how close counts as together — not a tuning knob.`, '',
      `**Do not window a join against a slowly-changing table.** That is a lookup, bounded by the table rather than by time, and forcing a window onto it is the common streaming-join bug. ch09 takes this apart properly.`, '',
      `**Default to event time, and expect lateness handling.** A join on event time is the only one whose pairings mean what they say, and the price is that a late row can change a result already emitted.`, '',
      `**In review, read the window and the time attribute before anything else.** They carry more meaning per character than the rest of the statement, and both are easy to get wrong without producing an error.`, '',
      `**What this does not settle:** what the join actually buffers, how much of it, and what happens when a late row changes a match that was already emitted. Those are ch09's subject, and the answers are less comfortable than the SQL suggests.`],
    diagramHeading: 'Visual walkthrough — the bound, the minimum, the clock, and the division of labour',
    sub: `Both side watermarks, their minimum and the skew figure are computed from the seed and asserted.` },
  { name: 'ch08-system', steps: C4,
    title: 'System design — a continuous click-count query',
    subtitle: `one window row goes ${ONTIME} → ${W0_TRUE}; none of ${ONTIME}, ${W0_TRUE} or ${hhmmss(EVENTS[ONTIME_I].pt)} appears in the SQL`,
    heading: 'Why the sink requirement is readable from the query, and the timing is not',
    why: [
      `**The question.** A continuous SQL query that keeps a campaign click count current: it buckets clicks into a TUMBLE window and updates the result when the watermark closes the window, so the count stays correct as late clicks arrive.`, '',
      `**The pipeline:** streams → SQL engine (continuous query) → watermark + window → updating result → sink.`, '',
      `**The query:** \`${SQL_TUMBLE}\``, '',
      `**One thing is decidable from that text alone:** a windowed \`GROUP BY\` produces an **updating** stream, so the sink must UPSERT or accept retractions. ${UPDATED_ROWS.length} of the ${ET_KEYS.length} window rows is revised here. Had the query been a \`WHERE\`, an append-only sink would have been fine — and knowing which before building anything is the practical value of the distinction.`, '',
      `**And one thing is not.** Follow window [${mm(W0)}, ${mm(W0_END)})\\: it finally holds ${W0_TRUE} from ids ${WINDOWS[W0].join(', ')}. The watermark passes ${mm(W0_END)} after event ${ONTIME_I}, at ${hhmmss(EVENTS[ONTIME_I].pt)}, and the engine emits **${ONTIME}**. Then id ${L.id} arrives at ${hhmmss(L.pt)} and the row is updated to **${W0_TRUE}**.`, '',
      `None of ${ONTIME}, ${W0_TRUE} or ${hhmmss(EVENTS[ONTIME_I].pt)} appears anywhere in the SQL. All three come from the watermark the engine maintains. **The query got shorter; the semantics did not get simpler.**`, '',
      `**Two choices remain yours, and they are a few characters each:** \`TUMBLE(et, ${WIN}s)\` gives ${ET_KEYS.length} rows (${ET_KEYS.map(k => SUM(TUMBLE_ET[k])).join(', ')}); \`TUMBLE(pt, ${WIN}s)\` gives ${PT_KEYS.length} rows differing on ${CLOCK_DIFFER.length} of them; \`HOP\` gives ${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL}; \`SESSION\` gives ${SESSIONS.a.length + SESSIONS.b.length} rows with an unpredictable count.`],
    whenHeading: 'When this design is right, and the four things it does not settle',
    when: [
      `**It is right when the sink can UPSERT by (key, window).** That is the one hard requirement, and it is known from the query shape rather than discovered in testing.`, '',
      `**Use the SQL form rather than a hand-written pipeline for this kind of query.** Four window shapes, two clocks and the whole trigger/accumulation apparatus are available in a statement you can review in one screen — which is a real advantage, as long as the review reads the window and the clock first.`, '',
      `**Find out the engine's allowed-lateness setting before trusting the "stays correct" claim.** Whether id ${L.id} is admitted at all is configuration the SQL does not mention.`, '',
      `**What this query does NOT settle — four gaps:**`, '',
      `1. **${ET_KEYS.filter(k => closedAt(k) === null).length} of the ${ET_KEYS.length} windows is never emitted**, because the watermark never passes its end. There is no error and no row — the sink simply never hears about it, and nothing in the SQL hints at it.`,
      `2. **The engine chooses the accumulation mode.** If it accumulates and the sink sums rather than upserts, the window reads ${ONTIME + W0_TRUE} instead of ${W0_TRUE}. That mismatch is outside the query entirely, which is exactly where it is hardest to notice.`,
      `3. **Allowed lateness is an engine setting, not syntax.** The "stays correct as late clicks arrive" premise depends on a number the query does not contain.`,
      `4. **SESSION's row count is data-dependent** (${SESSIONS.a.length + SESSIONS.b.length} here), so a query that looks like the others cannot be capacity-planned like them.`],
    diagramHeading: 'Visual walkthrough — five stages, one changing row, two token choices',
    sub: `The emission moment, both row values and all four window variants are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · TUMBLE(${WIN}s) gives ${ET_KEYS.length} windows`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch08.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch08.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of a row\'s five columns are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being aggregated  ·  key = the GROUP BY column',
  'type Row { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} rows, in ARRIVAL order (tools/stream_seed.js).`,
  `//   EVENTS[${L.id}] = (id ${L.id}, key "${L.key}", et ${L.et}, pt ${L.pt}, v ${L.v})   <- the late one`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the TUMBLE size, in seconds.  WIN = ${WIN}`,
  `// primitive: PERIOD — the HOP slide, in seconds.  PERIOD = ${PERIOD}`,
  `// primitive: GAP — the SESSION gap, in seconds.  GAP = ${GAP}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: KEYS — the distinct GROUP BY values.  KEYS = ["${KEYS.join('", "')}"]`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  '// primitive: sum(ids) — total v over those row ids.',
  `//   sum([${WINDOWS[W0].join(', ')}]) = ${W0_TRUE}`,
  '// primitive: watermarkAfter(i) — highest et through i, minus LAG.',
  `//   watermarkAfter(${ONTIME_I}) = ${WATERMARKS[ONTIME_I]}      watermarkAfter(${LI}) = ${WATERMARKS[LI]}`,
];
const PROGRAMS = [];

// ---- concept 1: the continuous query, and the clock token ------------------
PROGRAMS.push({
  name: 'ch08-sql-memory',
  title: 'One query, two clocks — and append-only versus updating',
  subtitle: `TUMBLE(et) vs TUMBLE(pt) differ on ${CLOCK_DIFFER.length} of ${ET_KEYS.length} windows · ${APPEND_ROWS.length} rows never revised, ${UPDATED_ROWS.length} window revised`,
  src: COMMON.concat([
    '',
    'type Result { rows, mode }',
    '',
    `// primitive: FILTER_V — the WHERE threshold.  FILTER_V = ${FILTER_V}`,
    '// primitive: bucketOf(row, clock) — the TUMBLE bucket, read off ONE column.',
    `//   bucketOf(EVENTS[${L.id}], "et") = ${Math.floor(L.et / WIN) * WIN}      bucketOf(EVENTS[${L.id}], "pt") = ${Math.floor(L.pt / WIN) * WIN}`,
    '',
    '// function: runFilter() — SELECT * FROM clicks WHERE v > FILTER_V.',
    '//   Every output row is a FACT: it matched, and nothing later unmatches it.',
    `//   runFilter().rows = [${APPEND_ROWS.join(', ')}]      runFilter().mode = "APPEND-ONLY"`,
    'fun runFilter() {',
    '    var out = []',
    '    for (e in EVENTS) {',
    '        if (e.v > FILTER_V) { out = append(out, e.id) }',
    '    }',
    '    return Result(out, "APPEND-ONLY")',
    '}',
    '',
    '// function: runTumble(clock) — SELECT SUM(v) ... GROUP BY TUMBLE(<clock>, WIN).',
    '//   The clock is a PARAMETER: there is no second code path for processing time.',
    `//   runTumble("et").rows = {${ET_KEYS.map(k => `${k}: ${SUM(TUMBLE_ET[k])}`).join(', ')}}`,
    `//   runTumble("pt").rows = {${PT_KEYS.map(k => `${k}: ${SUM(TUMBLE_PT[k])}`).join(', ')}}`,
    'fun runTumble(clock) {',
    '    var out = {}',
    '    for (e in EVENTS) {',
    '        val b = bucketOf(e, clock)',
    '        if (out[b] == NONE) { out[b] = 0 }',
    '        out[b] = out[b] + e.v',
    '    }',
    '    return Result(out, "UPDATING")',
    '}',
    '',
    '// function: disagree(a, b) — the buckets where the two clocks differ.',
    `//   disagree(runTumble("et"), runTumble("pt")) = [${CLOCK_DIFFER.join(', ')}]`,
    'fun disagree(a, b) {',
    '    var out = []',
    '    for (k in a.rows) {',
    '        if (a.rows[k] != b.rows[k]) { out = append(out, k) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: sinkNeeds(r) — what a sink must support for that result stream.',
    '//   sinkNeeds(runFilter()) = "INSERT"      sinkNeeds(runTumble("et")) = "UPSERT"',
    'fun sinkNeeds(r) {',
    '    if (r.mode == "APPEND-ONLY") { return "INSERT" }',
    '    return "UPSERT"',
    '}',
    '',
    '// function: main() — THE CALLER: two queries, two clocks, two sink contracts.',
    'fun main() {',
    '    val facts   = runFilter()',
    '    val byEvent = runTumble("et")',
    '    val byProc  = runTumble("pt")',
    '    val diff    = disagree(byEvent, byProc)',
    '    val needs   = sinkNeeds(byEvent)',
    '}',
  ]),
  heap: {
    facts:   { addr: '0x100', type: 'Result', val: () => `[${APPEND_ROWS.join(', ')}] · APPEND-ONLY` },
    byEvent: { addr: '0x200', type: 'Result', val: () => ET_KEYS.map(k => `${k}:${SUM(TUMBLE_ET[k])}`).join(' ') + ' · UPDATING' },
    byProc:  { addr: '0x300', type: 'Result', val: () => PT_KEYS.map(k => `${k}:${SUM(TUMBLE_PT[k])}`).join(' ') + ' · UPDATING' },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `facts = ${o.facts || '...'}`, `byEvent = ${o.byEvent || '...'}`, `byProc = ${o.byProc || '...'}`,
      `diff = ${o.diff || '...'}`, `needs = ${o.needs || '...'}`] });
    return [
      { t: 'a filter produces facts, which nothing can revise', line: at('fun runFilter()', 'if (e.v > FILTER_V) { out = append(out, e.id) }'),
        stack: [MAIN(), { name: 'runFilter', locals: ['out = @0x100', `e = EVENTS[${EVENTS.length - 1}]`] }],
        heap: [{ key: 'facts', hot: true }],
        cap: `\`e.v > FILTER_V\` is decided from the row alone — no later row can change whether id ${APPEND_ROWS[0]} matched. That is why the mode is APPEND-ONLY, and it is readable from the query shape rather than measured: a \`WHERE\` has no state to revise.` },
      { t: 'the clock is a PARAMETER, not a second code path', line: at('fun runTumble(clock)', 'val b = bucketOf(e, clock)'),
        stack: [MAIN({ facts: '@0x100', byEvent: '@0x200' }), { name: 'runTumble', locals: ['clock = "pt"', 'out = @0x300', `e = EVENTS[${L.id}]`, `b = ${Math.floor(L.pt / WIN) * WIN}`] }],
        heap: [{ key: 'byEvent' }, { key: 'byProc', hot: true }],
        cap: `For id ${L.id}, \`b\` is ${Math.floor(L.pt / WIN) * WIN} with \`clock\` = "pt" and ${Math.floor(L.et / WIN) * WIN} with "et" — ${Math.round((Math.floor(L.pt / WIN) * WIN - Math.floor(L.et / WIN) * WIN) / WIN)} windows apart. One argument, and the row lands somewhere else entirely. In SQL that argument is three characters of the query text.` },
      { t: `so ${CLOCK_DIFFER.length} of the ${ET_KEYS.length} buckets hold different sums`, line: at('fun disagree(a, b)', 'if (a.rows[k] != b.rows[k]) { out = append(out, k) }'),
        stack: [MAIN({ facts: '@0x100', byEvent: '@0x200', byProc: '@0x300', diff: `[${CLOCK_DIFFER.join(', ')}]` }),
                { name: 'disagree', locals: ['a = @0x200', 'b = @0x300', `out = [${CLOCK_DIFFER.join(', ')}]`, `k = ${CLOCK_DIFFER[CLOCK_DIFFER.length - 1]}`] }],
        heap: [{ key: 'byEvent' }, { key: 'byProc' }],
        cap: `Read the two heap rows against each other at bucket ${CLOCK_DIFFER[0]}: ${SUM(TUMBLE_ET[CLOCK_DIFFER[0]])} and ${SUM(TUMBLE_PT[CLOCK_DIFFER[0]] || [])}. Both Results came from the same function over the same rows. Neither is a bug, and nothing in the engine could prefer one.` },
      { t: 'and the mode decides what the sink must support', line: at('fun sinkNeeds(r)', 'if (r.mode == "APPEND-ONLY") { return "INSERT" }'),
        stack: [MAIN({ facts: '@0x100', byEvent: '@0x200', byProc: '@0x300', diff: `[${CLOCK_DIFFER.join(', ')}]`, needs: '"UPSERT"' }),
                { name: 'sinkNeeds', locals: ['r = @0x200'] }],
        heap: [{ key: 'facts' }, { key: 'byEvent' }],
        cap: `\`sinkNeeds\` reads only \`r.mode\`, which was set by the query shape — so the sink contract is derivable before the pipeline runs. \`facts\` needs INSERT; \`byEvent\` needs UPSERT, because window [${mm(W0)}, ${mm(W0_END)}) will go from ${ONTIME} to ${W0_TRUE}.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a streaming query's clock and its update mode are both properties of the query text — as two query functions over the same rows.`, '',
    `\`runTumble(clock)\` takes the clock as a **parameter**. There is no second code path for processing time: step 2 shows the same line producing bucket ${Math.floor(L.et / WIN) * WIN} or ${Math.floor(L.pt / WIN) * WIN} for id ${L.id} depending on one argument. In SQL that argument is three characters.`, '',
    `\`sinkNeeds(r)\` reads only \`r.mode\`, which \`runFilter\` and \`runTumble\` set from their own shape — so "does my sink need UPSERT?" is answerable from the query before anything runs.`],
  sub: `Both clock results, the disagreement list and the filter output are computed from the seed and asserted.` });

// ---- concept 2: the three window functions --------------------------------
PROGRAMS.push({
  name: 'ch08-windows-memory',
  title: 'TUMBLE, HOP and SESSION — one assigner, three row counts',
  subtitle: `${ET_KEYS.length} rows / ${HOP_WINDOWS.length} rows totalling ${HOP_TOTAL} / ${SESSIONS.a.length + SESSIONS.b.length} rows · ${ET_KEYS.filter(k => closedAt(k) === null).length} never emitted`,
  src: COMMON.concat([
    '',
    'type Windowed { rows, emitted }',
    '',
    '// primitive: tumbleOf(et) — the ONE bucket a row falls in.',
    `//   tumbleOf(${L.et}) = [${Math.floor(L.et / WIN) * WIN}]`,
    '// primitive: hopOf(et) — EVERY bucket a row falls in. A list, which is the whole',
    '//   difference between HOP and TUMBLE.',
    `//   hopOf(${EVENTS[4].et}) = [${hopStarts(EVENTS[4].et).join(', ')}]      hopOf(${EVENTS[0].et}) = [${hopStarts(EVENTS[0].et).join(', ')}]`,
    '// primitive: sortByEt(rows) — rows in ascending event-time order.',
    `//   sortByEt(EVENTS) = [${EVENTS.slice().sort((a, b) => a.et - b.et).map(e => e.id).join(', ')}]`,
    '',
    '// function: assign(shape, row) — the buckets one row contributes to. SESSION',
    '//   returns NONE because a session\'s bounds depend on rows not yet seen.',
    `//   assign("TUMBLE", EVENTS[4]) = [${Math.floor(EVENTS[4].et / WIN) * WIN}]`,
    `//   assign("HOP", EVENTS[4]) = [${hopStarts(EVENTS[4].et).join(', ')}]`,
    '//   assign("SESSION", EVENTS[4]) = NONE',
    'fun assign(shape, row) {',
    '    if (shape == "TUMBLE") { return tumbleOf(row.et) }',
    '    if (shape == "HOP")    { return hopOf(row.et) }',
    '    return NONE',
    '}',
    '',
    '// primitive: contains(xs, x) — is x in xs?  contains([1,2], 2) = true',
    '',
    '// function: rowCount(shape) — how many OUTPUT rows the query produces, and their',
    '//   total. For a partitioning shape the total equals the input; for HOP it cannot.',
    `//   rowCount("TUMBLE") = Windowed(${ET_KEYS.length}, ${TOTAL})      rowCount("HOP") = Windowed(${HOP_WINDOWS.length}, ${HOP_TOTAL})`,
    'fun rowCount(shape) {',
    '    var buckets = []',
    '    var total   = 0',
    '    for (e in EVENTS) {',
    '        for (b in assign(shape, e)) {',
    '            if (contains(buckets, b) == false) { buckets = append(buckets, b) }',
    '            total = total + e.v',
    '        }',
    '    }',
    '    return Windowed(len(buckets), total)',
    '}',
    '',
    '// function: sessionRows(key) — SESSION needs its own pass, because the bounds move.',
    `//   sessionRows("${KEYS[0]}") = ${SESSIONS[KEYS[0]].length}      sessionRows("${KEYS[1]}") = ${SESSIONS[KEYS[1]].length}`,
    'fun sessionRows(key) {',
    '    var n    = 0',
    '    var last = NONE',
    '    for (e in sortByEt(EVENTS)) {',
    '        if (e.key != key) { continue }',
    '        if (last == NONE || e.et - last > GAP) { n = n + 1 }',
    '        last = e.et',
    '    }',
    '    return n',
    '}',
    '',
    '// function: emitsAt(bucket) — the row index at which the watermark lets that',
    '//   bucket emit. NONE means the output row is never produced at all.',
    `//   emitsAt(${W0}) = ${ONTIME_I}      emitsAt(${ET_KEYS.filter(k => closedAt(k) === null)[0]}) = NONE`,
    'fun emitsAt(bucket) {',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= bucket + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '',
    '// function: main() — THE CALLER: three shapes, and the emission check.',
    'fun main() {',
    '    val tum  = rowCount("TUMBLE")',
    '    val hop  = rowCount("HOP")',
    `    val sesA = sessionRows("${KEYS[0]}")`,
    `    val sesB = sessionRows("${KEYS[1]}")`,
    `    val silent = emitsAt(${ET_KEYS.filter(k => closedAt(k) === null)[0]})`,
    '}',
  ]),
  heap: {
    tum: { addr: '0x100', type: 'Windowed', val: () => `${ET_KEYS.length} rows · total ${TOTAL}` },
    hop: { addr: '0x200', type: 'Windowed', val: () => `${HOP_WINDOWS.length} rows · total ${HOP_TOTAL}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `tum = ${o.tum || '...'}`, `hop = ${o.hop || '...'}`,
      `sesA = ${o.sesA !== undefined ? o.sesA : '...'}`, `sesB = ${o.sesB !== undefined ? o.sesB : '...'}`,
      `silent = ${o.silent || '...'}`] });
    return [
      { t: 'TUMBLE returns one bucket; HOP returns a list', line: at('fun assign(shape, row)', 'if (shape == "HOP")    { return hopOf(row.et) }'),
        stack: [MAIN({ tum: '@0x100' }), { name: 'rowCount', locals: ['shape = "HOP"', 'buckets = (a list)', `total = ${HOP_TOTAL}`, `e = EVENTS[4]`, `b = ${hopStarts(EVENTS[4].et)[1]}`] },
                { name: 'assign', locals: ['shape = "HOP"', 'row = EVENTS[4]'] }],
        heap: [{ key: 'tum' }, { key: 'hop', hot: true }],
        cap: `\`hopOf(${EVENTS[4].et})\` returns [${hopStarts(EVENTS[4].et).join(', ')}] — ${hopStarts(EVENTS[4].et).length} buckets for one row — so the inner loop of \`rowCount\` runs twice and adds \`e.v\` twice. That is the entire reason the HOP total reaches ${HOP_TOTAL} against the dataset's ${TOTAL}.` },
      { t: 'so one shape partitions the data and the other does not', line: at('fun rowCount(shape)', 'total = total + e.v'),
        stack: [MAIN({ tum: '@0x100', hop: '@0x200' }), { name: 'rowCount', locals: ['shape = "HOP"', 'buckets = (a list)', `total = ${HOP_TOTAL}`, `e = EVENTS[${EVENTS.length - 1}]`, `b = ${hopStarts(EVENTS[EVENTS.length - 1].et)[1]}`] }],
        heap: [{ key: 'tum' }, { key: 'hop', hot: true }],
        cap: `\`tum\` totals ${TOTAL} and \`hop\` totals ${HOP_TOTAL}, from the same \`total = total + e.v\` line. The difference is purely how many times the inner loop runs. Comparing a HOP total to an input total is therefore always a mistake, and the mistake is in the comparison rather than in the query.` },
      { t: 'SESSION needs its own pass, and its row count is data-dependent', line: at('fun sessionRows(key)', 'if (last == NONE || e.et - last > GAP) { n = n + 1 }'),
        stack: [MAIN({ tum: '@0x100', hop: '@0x200', sesA: SESSIONS[KEYS[0]].length, sesB: SESSIONS[KEYS[1]].length }),
                { name: 'sessionRows', locals: [`key = "${KEYS[0]}"`, `n = ${SESSIONS[KEYS[0]].length}`, `last = ${SESSIONS[KEYS[0]][SESSIONS[KEYS[0]].length - 1].end}`, `e = (et ${SESSIONS[KEYS[0]][SESSIONS[KEYS[0]].length - 1].end})`] }],
        heap: [{ key: 'tum' }, { key: 'hop' }],
        cap: `\`n\` increments on a gap larger than GAP, so the answer comes from the DATA's spacing: ${SESSIONS[KEYS[0]].length} for key "${KEYS[0]}" and ${SESSIONS[KEYS[1]].length} for key "${KEYS[1]}" over the same time range. Note \`assign\` returned NONE for SESSION — no function of a single row can name a session's bounds.` },
      { t: 'and one output row is never produced at all', line: at('fun emitsAt(bucket)', 'fun emitsAt(bucket)::    return NONE'),
        stack: [MAIN({ tum: '@0x100', hop: '@0x200', sesA: SESSIONS[KEYS[0]].length, sesB: SESSIONS[KEYS[1]].length, silent: 'NONE' }),
                { name: 'emitsAt', locals: [`bucket = ${ET_KEYS.filter(k => closedAt(k) === null)[0]}`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'tum' }],
        cap: `The loop runs out: no \`watermarkAfter(i)\` ever reaches ${ET_KEYS.filter(k => closedAt(k) === null)[0] + WIN}, so \`emitsAt\` returns NONE. The bucket exists in the state and holds ${SUM(TUMBLE_ET[ET_KEYS.filter(k => closedAt(k) === null)[0]])}, and the sink never sees it. Nothing in the SQL mentions this and no error is raised.` },
    ];
  },
  intro: [
    `**What is being answered.** Why the three SQL window functions have three different cost profiles — as one \`assign\` function whose return shape differs.`, '',
    `\`assign(shape, row)\` returns one bucket for TUMBLE, a **list** for HOP, and **NONE** for SESSION. Those three return shapes are the whole story: the list is why HOP totals ${HOP_TOTAL} against ${TOTAL}, and the NONE is why SESSION needs its own pass and cannot be capacity-planned.`, '',
    `Step 4 is the gap a SQL reader would not see: \`emitsAt\` returns NONE for bucket ${ET_KEYS.filter(k => closedAt(k) === null)[0]}, which holds ${SUM(TUMBLE_ET[ET_KEYS.filter(k => closedAt(k) === null)[0]])} and is never delivered to the sink.`],
  sub: `All three row counts, the HOP total and the never-emitted bucket are computed from the seed and asserted.` });

// ---- concept 3: the join's watermark ---------------------------------------
PROGRAMS.push({
  name: 'ch08-joins-memory',
  title: 'A join has two inputs, so it claims the minimum',
  subtitle: `sides reach ${KEYS.map(k => Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG).join(' and ')} · the join claims ${Math.min(...KEYS.map(k => Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG))}`,
  src: COMMON.concat([
    '',
    'type Join { pairs, claim }',
    '',
    `// primitive: J — the join window: rows match if their et are within J seconds.  J = ${LAG}`,
    '// primitive: rowsOf(key) — one side of the join.',
    `//   rowsOf("${KEYS[0]}") = [${EVENTS.filter(e => e.key === KEYS[0]).map(e => e.id).join(', ')}]      rowsOf("${KEYS[1]}") = [${EVENTS.filter(e => e.key === KEYS[1]).map(e => e.id).join(', ')}]`,
    '// primitive: absDiff(a, b) — the distance between two times.  absDiff(1, 50) = 49',
    '',
    '// function: sideWatermark(key, i) — one input\'s own completeness claim after row i.',
    `//   sideWatermark("${KEYS[0]}", ${EVENTS.length - 1}) = ${Math.max(...EVENTS.filter(e => e.key === KEYS[0]).map(e => e.et)) - LAG}      sideWatermark("${KEYS[1]}", ${EVENTS.length - 1}) = ${Math.max(...EVENTS.filter(e => e.key === KEYS[1]).map(e => e.et)) - LAG}`,
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
    '// function: joinWatermark(i) — the MINIMUM over inputs. A side that has produced',
    '//   nothing blocks the claim entirely: silence is not completeness.',
    `//   joinWatermark(0) = NONE      joinWatermark(${EVENTS.length - 1}) = ${Math.min(...KEYS.map(k => Math.max(...EVENTS.filter(e => e.key === k).map(e => e.et)) - LAG))}`,
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
    '// function: matches(clock) — every pair within J on the chosen clock. The clock',
    '//   decides WHICH ROWS ARE PAIRED, not just which bucket a value lands in.',
    `//   matches("et") pairs ${(() => { let n = 0; for (const a of EVENTS.filter(e => e.key === KEYS[0])) for (const b of EVENTS.filter(e => e.key === KEYS[1])) if (Math.abs(a.et - b.et) <= LAG) n++; return n; })()} rows`,
    `//   matches("pt") pairs ${(() => { let n = 0; for (const a of EVENTS.filter(e => e.key === KEYS[0])) for (const b of EVENTS.filter(e => e.key === KEYS[1])) if (Math.abs(a.pt - b.pt) <= LAG) n++; return n; })()} rows`,
    'fun matches(clock) {',
    '    var out = []',
    `    for (l in rowsOf("${KEYS[0]}")) {`,
    `        for (r in rowsOf("${KEYS[1]}")) {`,
    '            if (absDiff(l[clock], r[clock]) <= J) { out = append(out, [l.id, r.id]) }',
    '        }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER: the claim, and the pairings under both clocks.',
    'fun main() {',
    '    val early = joinWatermark(2)',
    `    val claim = joinWatermark(${EVENTS.length - 1})`,
    '    val byEt  = matches("et")',
    '    val byPt  = matches("pt")',
    '}',
  ]),
  heap: {
    byEt: { addr: '0x100', type: 'pair[]', val: () => { const o = []; for (const a of EVENTS.filter(e => e.key === KEYS[0])) for (const b of EVENTS.filter(e => e.key === KEYS[1])) if (Math.abs(a.et - b.et) <= LAG) o.push(`${a.id}-${b.id}`); return o.join(' '); } },
    byPt: { addr: '0x200', type: 'pair[]', val: () => { const o = []; for (const a of EVENTS.filter(e => e.key === KEYS[0])) for (const b of EVENTS.filter(e => e.key === KEYS[1])) if (Math.abs(a.pt - b.pt) <= LAG) o.push(`${a.id}-${b.id}`); return o.join(' ') || '(none)'; } },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `early = ${o.early !== undefined ? o.early : '...'}`, `claim = ${o.claim !== undefined ? o.claim : '...'}`,
      `byEt = ${o.byEt || '...'}`, `byPt = ${o.byPt || '...'}`] });
    const WA = Math.max(...EVENTS.filter(e => e.key === KEYS[0]).map(e => e.et)) - LAG;
    const WB = Math.max(...EVENTS.filter(e => e.key === KEYS[1]).map(e => e.et)) - LAG;
    return [
      { t: 'a side that has produced nothing blocks the claim', line: at('fun joinWatermark(i)', 'if (w == NONE) { return NONE }'),
        stack: [MAIN(), { name: 'joinWatermark', locals: ['i = 0', 'lowest = NONE', `k = "${KEYS[1]}"`, 'w = NONE'] }],
        heap: [],
        cap: `At row 0 only side "${KEYS[0]}" has produced anything, so \`sideWatermark("${KEYS[1]}", 0)\` is NONE and the join makes NO claim at all. A join is the case where this bites hardest: it has two inputs by construction, so either one being silent stops every result.` },
      { t: 'and the claim is the lower of the two, never the higher', line: at('if (lowest == NONE || w < lowest) { lowest = w }'),
        stack: [MAIN({ early: 'NONE' }), { name: 'joinWatermark', locals: [`i = ${EVENTS.length - 1}`, `lowest = ${Math.min(WA, WB)}`, `k = "${WA < WB ? KEYS[0] : KEYS[1]}"`, `w = ${Math.min(WA, WB)}`] }],
        heap: [],
        cap: `Side "${KEYS[0]}" has reached ${WA} and side "${KEYS[1]}" ${WB}, so \`lowest\` ends at ${Math.min(WA, WB)}. Every join emission waits on whichever stream is further behind, however fast the other one is — which is ch03's propagation rule with the two inputs made structural.` },
      { t: 'the clock decides WHICH ROWS ARE PAIRED', line: at('fun matches(clock)', 'if (absDiff(l[clock], r[clock]) <= J) { out = append(out, [l.id, r.id]) }'),
        stack: [MAIN({ early: 'NONE', claim: Math.min(WA, WB) }), { name: 'matches', locals: ['clock = "et"', 'out = @0x100', `l = (id ${EVENTS.filter(e => e.key === KEYS[0])[0].id}, et ${EVENTS.filter(e => e.key === KEYS[0])[0].et})`, `r = (id ${L.id}, et ${L.et})`] }],
        heap: [{ key: 'byEt', hot: true }],
        cap: `\`absDiff(${EVENTS.filter(e => e.key === KEYS[0])[0].et}, ${L.et})\` = ${Math.abs(EVENTS.filter(e => e.key === KEYS[0])[0].et - L.et)}, within J = ${LAG}, so the pair is emitted. Note what this line asserts about the world: these two things happened close together. A wrong clock here does not mis-bucket a number, it states a false coincidence.` },
      { t: 'so the same join on pt pairs a different set of rows', line: at('    val byPt  = matches("pt")'),
        stack: [MAIN({ early: 'NONE', claim: Math.min(WA, WB), byEt: '@0x100', byPt: '@0x200' })],
        heap: [{ key: 'byEt' }, { key: 'byPt', hot: true }],
        cap: `Compare the heap rows. Pairing on \`et\` and on \`pt\` gives different pair sets from identical data — id ${L.id} arrived ${L.pt - L.et}s after it happened, so on the arrival clock it sits next to rows it had nothing to do with. The output rows look equally plausible in both cases.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a join is where the time decisions cost most — as the minimum rule and the pairing rule, side by side.`, '',
    `\`joinWatermark(i)\` has the line that matters: \`if (w == NONE) { return NONE }\`. A side that has produced nothing blocks the claim entirely, and a join has two sides by construction — so either one going quiet stops every result.`, '',
    `\`matches(clock)\` then shows the sharper cost. A mis-clocked aggregate puts a number in the wrong bucket; a mis-clocked join **pairs the wrong rows**, emitting an assertion that two things coincided. Step 4 compares the two pair sets from identical data.`],
  sub: `Both side watermarks, their minimum and both pair sets are computed from the seed and asserted.` });

// ---- concept 4: the continuous query, end to end ---------------------------
PROGRAMS.push({
  name: 'ch08-system-memory',
  title: 'The continuous query — one row, two values, and the sink contract',
  subtitle: `window [${mm(W0)}, ${mm(W0_END)}) emits ${ONTIME} at ${hhmmss(EVENTS[ONTIME_I].pt)}, then ${W0_TRUE}`,
  src: COMMON.concat([
    '',
    'type Sink  { rows, writes }',
    'type Query { bucket, value, emittedAt }',
    '',
    `// primitive: W0 — the window this trace follows.  W0 = ${W0}  ([${mm(W0)}, ${mm(W0_END)}))`,
    '// primitive: bucketOf(row) — the TUMBLE bucket, read off the et column.',
    `//   bucketOf(EVENTS[0]) = ${winOf(EVENTS[0].et)}      bucketOf(EVENTS[${L.id}]) = ${winOf(L.et)}`,
    '',
    '// function: upsert(sink, bucket, value) — the UPDATING sink: one row per bucket,',
    '//   overwritten. An INSERT-only sink cannot express this.',
    `//   upsert(sink, W0, ${ONTIME}) then upsert(sink, W0, ${W0_TRUE}) leaves ${W0_TRUE} after 2 writes`,
    'fun upsert(sink, bucket, value) {',
    '    sink.rows[bucket] = value',
    '    sink.writes = sink.writes + 1',
    '    return sink',
    '}',
    '',
    '// function: insertOnly(sink, bucket, value) — the APPEND-ONLY sink, for contrast:',
    '//   it adds rather than replaces, so a revision double-counts.',
    `//   insertOnly(sink, W0, ${ONTIME}) then insertOnly(sink, W0, ${W0_TRUE}) leaves ${ONTIME + W0_TRUE}`,
    'fun insertOnly(sink, bucket, value) {',
    '    if (sink.rows[bucket] == NONE) { sink.rows[bucket] = 0 }',
    '    sink.rows[bucket] = sink.rows[bucket] + value',
    '    sink.writes = sink.writes + 1',
    '    return sink',
    '}',
    '',
    '// function: run(canUpsert) — the engine: accumulate, emit when the watermark',
    '//   closes the bucket, and re-emit on every later row for that bucket.',
    `//   run(true).rows[W0]  = ${W0_TRUE}      run(false).rows[W0] = ${ONTIME + W0_TRUE}`,
    'fun run(canUpsert) {',
    '    var sink  = Sink({}, 0)',
    '    var ids   = []',
    '    var fired = false',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (bucketOf(EVENTS[i]) != W0) { continue }',
    '        ids = append(ids, EVENTS[i].id)',
    '        if (watermarkAfter(i) < W0 + WIN && fired == false) { continue }',
    '        if (canUpsert)          { sink = upsert(sink, W0, sum(ids)) }',
    '        if (canUpsert == false) { sink = insertOnly(sink, W0, sum(ids)) }',
    '        fired = true',
    '    }',
    '    return sink',
    '}',
    '',
    '// function: main() — THE CALLER: the same query into two kinds of sink.',
    'fun main() {',
    '    val good = run(true)',
    '    val bad  = run(false)',
    '}',
  ]),
  heap: {
    good: { addr: '0x100', type: 'Sink', val: () => `rows {${W0}: ${W0_TRUE}} · writes 2` },
    bad:  { addr: '0x200', type: 'Sink', val: () => `rows {${W0}: ${ONTIME + W0_TRUE}} · writes 2` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [`good = ${o.good || '...'}`, `bad = ${o.bad || '...'}`] });
    const RUN = (o) => ({ name: 'run', locals: [`canUpsert = ${o.u}`, `sink = ${o.s}`, `ids = [${o.ids}]`, `fired = ${o.f}`, `i = ${o.i}`] });
    return [
      { t: 'the bucket is read off the et column, and nothing else', line: at('fun run(canUpsert)', 'if (bucketOf(EVENTS[i]) != W0) { continue }'),
        stack: [MAIN(), RUN({ u: 'true', s: '@0x100', ids: EVENTS.filter((e, i) => i <= 3 && winOf(e.et) === W0).map(e => e.id).join(','), f: 'false', i: 3 })],
        heap: [{ key: 'good', hot: true }],
        cap: `\`bucketOf(EVENTS[3])\` is ${winOf(EVENTS[3].et)}, which is not W0 = ${W0}, so row 3 is skipped. That one line is the whole of \`TUMBLE(et, ${WIN}s)\` — it reads \`et\` and never asks what time it is now.` },
      { t: 'the watermark decides the moment, and the engine emits', line: at('if (watermarkAfter(i) < W0 + WIN && fired == false) { continue }'),
        stack: [MAIN(), RUN({ u: 'true', s: '@0x100', ids: EVENTS.filter((e, i) => i <= ONTIME_I && winOf(e.et) === W0).map(e => e.id).join(','), f: 'false', i: ONTIME_I })],
        heap: [{ key: 'good', hot: true }],
        cap: `\`watermarkAfter(${ONTIME_I})\` is ${WATERMARKS[ONTIME_I]}, no longer below ${W0_END}, so the \`continue\` is skipped and the bucket emits \`sum(ids)\` = **${ONTIME}**. Neither ${ONTIME} nor ${hhmmss(EVENTS[ONTIME_I].pt)} appears anywhere in the query text — both come from this comparison.` },
      { t: `id ${L.id} arrives and the SAME row is written again`, line: at('fun upsert(sink, bucket, value)', 'sink.rows[bucket] = value'),
        stack: [MAIN({ good: '@0x100' }), RUN({ u: 'true', s: '@0x100', ids: WINDOWS[W0].join(','), f: 'true', i: LI }),
                { name: 'upsert', locals: ['sink = @0x100', `bucket = ${W0}`, `value = ${W0_TRUE}`] }],
        heap: [{ key: 'good', hot: true }],
        cap: `\`sink.rows[${W0}] = ${W0_TRUE}\` — an assignment, replacing ${ONTIME}. \`writes\` reaches 2 for one logical result, which is what "updating stream" means in practice: the sink is written more often than the answer changes meaning.` },
      { t: 'and an INSERT-only sink reads the two writes as two facts', line: at('fun insertOnly(sink, bucket, value)', 'sink.rows[bucket] = sink.rows[bucket] + value'),
        stack: [MAIN({ good: '@0x100', bad: '@0x200' }), RUN({ u: 'false', s: '@0x200', ids: WINDOWS[W0].join(','), f: 'true', i: LI }),
                { name: 'insertOnly', locals: ['sink = @0x200', `bucket = ${W0}`, `value = ${W0_TRUE}`] }],
        heap: [{ key: 'good' }, { key: 'bad', hot: true }],
        cap: `The same two emissions, into a sink that adds: ${ONTIME} + ${W0_TRUE} = **${ONTIME + W0_TRUE}** for a window worth ${W0_TRUE}. The query, the engine and the sink are each behaving correctly. The mismatch is the sink's update mode against the query's — and that is decidable from the query text before any of this runs.` },
    ];
  },
  intro: [
    `**What is being answered.** What a continuous query actually does to its sink, and why the sink contract is readable from the query.`, '',
    `Two lines carry the whole chapter. \`if (bucketOf(EVENTS[i]) != W0) { continue }\` is all of \`TUMBLE(et, ${WIN}s)\` — it reads \`et\` and never asks the time. \`if (watermarkAfter(i) < W0 + WIN && fired == false) { continue }\` is the emission moment, and neither ${ONTIME} nor ${hhmmss(EVENTS[ONTIME_I].pt)} appears in the SQL.`, '',
    `Step 4 prices the sink mismatch: the same two emissions give ${W0_TRUE} into an UPSERT sink and ${ONTIME + W0_TRUE} into an INSERT-only one. Every component is behaving correctly.`],
  sub: `The emission moment and both sink totals are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch08.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch08.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
