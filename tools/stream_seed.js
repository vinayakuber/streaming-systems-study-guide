'use strict';
/*
 * stream_seed.js — THE one dataset for this book, with its assertions.
 *
 * Streaming needs two clocks, so every event carries an EVENT time (when it
 * happened) and a PROCESSING time (when the pipeline saw it). The events are
 * deliberately out of order, because a seed in which processing order equals event
 * order cannot demonstrate a watermark, skew, lateness, or why windowing is hard —
 * a reader would get the right answers from the wrong model.
 *
 * Times are seconds past 12:00:00 so every number in the book is checkable by
 * subtraction rather than by trusting a clock library.
 *
 * WHAT THE ASSERTIONS BELOW GUARANTEE (each one is a teaching premise):
 *   - processing order differs from event order        (otherwise: no skew to show)
 *   - at least one event is LATE: it arrives after the watermark has passed its
 *     event time AND after its window has closed       (otherwise: no late data)
 *   - at least one event is out-of-order but NOT late  (so "out of order" and
 *                                                       "late" stay distinguishable)
 *   - one key has >= 3 sessions under the session gap  (otherwise: session windows
 *                                                       look like fixed windows)
 *   - at least one fixed window holds events from >1 key (otherwise: grouping is
 *                                                         indistinguishable from windowing)
 */
const t = (m, s) => m * 60 + s;                 // 12:MM:SS -> seconds past 12:00
const hhmmss = (sec) => `12:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

// in PROCESSING order — this is the order the pipeline sees them
const EVENTS = [
  { id: 0, key: 'a', et: t(0, 1),  pt: t(0, 2),  v: 5 },
  { id: 1, key: 'a', et: t(0, 3),  pt: t(0, 4),  v: 3 },
  { id: 2, key: 'b', et: t(1, 30), pt: t(1, 33), v: 7 },
  { id: 3, key: 'a', et: t(2, 10), pt: t(2, 12), v: 2 },
  { id: 4, key: 'a', et: t(4, 5),  pt: t(4, 6),  v: 6 },
  { id: 5, key: 'b', et: t(4, 20), pt: t(4, 25), v: 1 },
  { id: 6, key: 'b', et: t(3, 40), pt: t(4, 30), v: 9 },   // out of order, NOT late
  { id: 7, key: 'b', et: t(0, 50), pt: t(4, 40), v: 4 },   // the LATE one
  { id: 8, key: 'a', et: t(9, 0),  pt: t(9, 2),  v: 8 },
];
const LAG = 60;                                  // heuristic watermark lag, seconds
const WIN = 120;                                 // fixed window width, seconds
const GAP = 120;                                 // session gap, seconds

// ---- everything below is DERIVED -------------------------------------------
// watermark after each event: the max event time seen so far, minus the lag
const WATERMARKS = [];
{ let maxEt = -Infinity;
  for (const e of EVENTS) { maxEt = Math.max(maxEt, e.et); WATERMARKS.push(maxEt - LAG); } }
const winOf = (et) => Math.floor(et / WIN) * WIN;            // window START
const WINDOWS = {};
for (const e of EVENTS) { const w = winOf(e.et); (WINDOWS[w] = WINDOWS[w] || []).push(e.id); }
const WIN_STARTS = Object.keys(WINDOWS).map(Number).sort((a, b) => a - b);
// a window CLOSES when the watermark reaches its end
const closedAt = (winStart) => {
  for (let i = 0; i < EVENTS.length; i++) if (WATERMARKS[i] >= winStart + WIN) return i;
  return null;                                   // never closed in this seed
};
const LATE = EVENTS.filter((e, i) => {
  const c = closedAt(winOf(e.et));
  return WATERMARKS[i] > e.et && c !== null && c < i;
});
const OUT_OF_ORDER = EVENTS.filter((e, i) => i > 0 && e.et < EVENTS[i - 1].et);
const NOT_LATE_BUT_OOO = OUT_OF_ORDER.filter(e => !LATE.includes(e));
// sessions, per key, in EVENT-time order
const sessionsFor = (key) => {
  const es = EVENTS.filter(e => e.key === key).sort((a, b) => a.et - b.et);
  const out = [];
  for (const e of es) {
    const last = out[out.length - 1];
    if (last && e.et - last.end <= GAP) { last.end = e.et; last.ids.push(e.id); }
    else out.push({ start: e.et, end: e.et, ids: [e.id] });
  }
  return out;
};
const SESSIONS = { a: sessionsFor('a'), b: sessionsFor('b') };
const KEYS = ['a', 'b'];
const SUM = (ids) => ids.reduce((s, i) => s + EVENTS[i].v, 0);

// ---- the assertions: each one is a teaching premise ------------------------
const fail = (m) => { throw new Error(`stream_seed: ${m}`); };
if (EVENTS.map(e => e.et).join() === EVENTS.slice().sort((a, b) => a.et - b.et).map(e => e.et).join())
  fail('processing order equals event order — nothing about skew, lateness or watermarks could be shown');
if (LATE.length === 0) fail('no event is LATE (past the watermark AND its window closed) — ch03 would have nothing to teach');
if (NOT_LATE_BUT_OOO.length === 0) fail('every out-of-order event is also late — "out of order" and "late" must stay distinguishable');
if (SESSIONS.a.length < 3) fail(`key 'a' has ${SESSIONS.a.length} sessions; needs >= 3 or session windows look like fixed windows`);
if (!WIN_STARTS.some(w => new Set(WINDOWS[w].map(i => EVENTS[i].key)).size > 1))
  fail('no fixed window holds more than one key — windowing would be indistinguishable from grouping');
if (EVENTS.some(e => e.pt < e.et)) fail('an event is processed before it happened');

module.exports = { EVENTS, LAG, WIN, GAP, WATERMARKS, WINDOWS, WIN_STARTS, winOf,
                   closedAt, LATE, OUT_OF_ORDER, NOT_LATE_BUT_OOO, SESSIONS, KEYS, SUM, t, hhmmss };
