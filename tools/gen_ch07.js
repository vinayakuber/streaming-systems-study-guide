#!/usr/bin/env node
'use strict';
/* gen_ch07.js — ch07's four concepts, both bands each: why state persists,
 * checkpoints and state stores, consistency and recovery, and the checkpoint design.
 *
 * Everything is derived from tools/stream_seed.js: the (key, window) state entries,
 * a checkpoint-frequency sweep, the incremental-vs-full upload counts, and the
 * barrier alignment cost measured in buffered records. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, WINDOWS, WIN_STARTS, winOf, SUM, KEYS, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const mm = (sec) => hhmmss(sec).slice(0, 5);
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
// state is one entry per (key, window) — the unit a processor actually holds
const entryOf = (e) => `${e.key}@${winOf(e.et)}`;
const ENTRIES = [...new Set(EVENTS.map(entryOf))];
const entryValue = (id) => EVENTS.filter(e => entryOf(e) === id).reduce((s, e) => s + e.v, 0);
// an entry is COLLECTABLE when the watermark passes its window end
const collectIdx = (id) => { const w = Number(id.split('@')[1]); const i = WATERMARKS.findIndex(x => x >= w + WIN); return i === -1 ? null : i; };
const PERMANENT = ENTRIES.filter(id => collectIdx(id) === null);
// restart cost: with no persistence the whole stream is re-read; from a checkpoint
// at index c only the events after it are
const replayFrom = (c) => EVENTS.length - 1 - c;
// a CHECKPOINT-FREQUENCY sweep. Checkpoints every k events; the worst-case replay
// is the distance back to the last one, and the I/O is one upload per checkpoint.
const sweep = (k) => {
  const at = [];
  for (let i = k - 1; i < EVENTS.length; i += k) at.push(i);
  const worst = Math.max(...EVENTS.map((_, i) => { const last = at.filter(x => x <= i).pop(); return last === undefined ? i + 1 : i - last; }));
  // FULL upload = the whole state at that moment; INCREMENTAL = only entries touched
  // since the previous checkpoint
  let full = 0, incr = 0, prev = -1;
  for (const c of at) {
    full += new Set(EVENTS.slice(0, c + 1).map(entryOf)).size;
    incr += new Set(EVENTS.slice(prev + 1, c + 1).map(entryOf)).size;
    prev = c;
  }
  return { k, at, count: at.length, worst, full, incr };
};
const KS = [1, 3, 5, EVENTS.length];
const SWEEP = KS.map(sweep);
const CHOSEN = sweep(3);
const SAVING = Math.round(100 * (CHOSEN.full - CHOSEN.incr) / CHOSEN.full);
// BARRIER ALIGNMENT: the barrier is injected into each source after its 2nd event.
// A stage must wait for the barrier from EVERY input, buffering anything that
// arrives past its own barrier in the meantime.
const barrierAt = Object.fromEntries(KEYS.map(k => [k, EVENTS.indexOf(EVENTS.filter(e => e.key === k)[1])]));
const LAST_BARRIER = Math.max(...KEYS.map(k => barrierAt[k]));
const FIRST_BARRIER = Math.min(...KEYS.map(k => barrierAt[k]));
const BUFFERED = EVENTS.filter((e, i) => i > barrierAt[e.key] && i <= LAST_BARRIER).map(e => e.id);
const EARLY_KEY = KEYS.find(k => barrierAt[k] === FIRST_BARRIER);
const LATE_KEY = KEYS.find(k => barrierAt[k] === LAST_BARRIER);
// the checkpoint RECORDS the offset with the state; recovering with the state but a
// stale offset double-counts, and with the offset but no state under-counts
const CHK = 4;
const AFTER_CHK = EVENTS.slice(CHK + 1).reduce((s, e) => s + e.v, 0);
const fail = (m) => { throw new Error(`gen_ch07: ${m}`); };
if (ENTRIES.length < 5) fail(`only ${ENTRIES.length} state entries — the state-sizing point needs more`);
if (!PERMANENT.length) fail('every state entry is collectable, so the unbounded-state point cannot be shown');
if (new Set(SWEEP.map(s => s.count)).size < 3) fail('the checkpoint sweep does not vary the checkpoint count');
if (CHOSEN.incr >= CHOSEN.full) fail(`incremental uploads ${CHOSEN.incr} against full ${CHOSEN.full} — no saving to show`);
if (!BUFFERED.length) fail('no record is buffered during barrier alignment — the alignment cost is invisible');
if (FIRST_BARRIER === LAST_BARRIER) fail('both sources reach the barrier at the same index; there is no alignment to show');
if (replayFrom(CHK) >= EVENTS.length) fail('checkpointing does not reduce the replay');
if (AFTER_CHK <= 0) fail('nothing follows the checkpoint');

const W = 1140;

// =================== CONCEPT 1 — WHY STATE MUST PERSIST =====================
const C1 = [
  { t: 'state is the aggregation in progress', draw: (c) =>
      c.panel('WHAT THE PROCESSOR IS HOLDING — ONE ENTRY PER (KEY, WINDOW)', 'a')
      + c.mapRows('en', c.P.main.x + 24, c.P.main.y + 52, ENTRIES.map(id => {
          const [k, w] = id.split('@');
          return [`key "${k}", window [${mm(Number(w))}, ${mm(Number(w) + WIN)})`, `${entryValue(id)}   (from ids ${EVENTS.filter(e => entryOf(e) === id).map(e => e.id).join(', ')})`];
        }), { w: 1040, rh: 30, label: `${ENTRIES.length} entries for ${EVENTS.length} events — this is the whole of "state"` })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 66 + ENTRIES.length * 30, 1040, [
        `Nothing mysterious: state is ${ENTRIES.length} numbers, each the partial sum of a (key, window) group that has not finished yet.`,
        `Without it every event would start from zero, so the pipeline could not compute anything that spans more than one record.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Worth making concrete before discussing how to persist it: the state here is ${ENTRIES.length} numbers. Each one is a partial aggregate for a (key, window) group that is still open. Everything in this chapter — checkpoints, state stores, barriers — exists to move those ${ENTRIES.length} numbers safely across a restart.` },
  { t: 'and a restart without it re-reads the whole stream', draw: (c) =>
      c.panel('RECOVERY COST, WITH AND WITHOUT PERSISTED STATE', 'a')
      + c.mapRows('rc', c.P.main.x + 24, c.P.main.y + 52, [
        [`no persisted state`, `re-read all ${EVENTS.length} events to rebuild ${ENTRIES.length} entries`],
        [`state persisted at event ${CHK}`, `re-read ${replayFrom(CHK)} events — the ones after the checkpoint`],
        [`the reduction`, `${EVENTS.length} → ${replayFrom(CHK)} reads, and it grows with the stream`],
        [`both are CORRECT`, `the difference is entirely cost — the stream is the truth either way`],
      ], { w: 1040, rh: 36, hot: 3, label: 'persistence buys recovery time, not correctness' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The last row is the one to keep. A full reprocess gives the right answer; it just takes as long as the history is.`,
        `So persisted state is a CACHE of a fold over the stream. You can always throw it away, and on a long stream you cannot afford to.`,
      ], c.C.good, c.C.goodFill),
    cap: `The honest framing: persistence is an optimisation, not a correctness mechanism. Rebuilding from the stream gives exactly the same ${ENTRIES.length} entries — it just reads ${EVENTS.length} events instead of ${replayFrom(CHK)}. On a nine-event stream that is nothing; on a year of history it is the difference between a minute and a week.` },
  { t: 'so the state store is a cache, and the stream is the truth', draw: (c) =>
      c.panel('WHAT CAN BE REBUILT FROM WHAT', 'a')
      + c.mapRows('ca', c.P.main.x + 24, c.P.main.y + 52, [
        [`the stream`, `${EVENTS.length} events, total ${TOTAL} — the source of truth`],
        [`the state`, `${ENTRIES.length} entries — a fold over a PREFIX of the stream`],
        [`stream → state`, `always possible: replay and re-fold`],
        [`state → stream`, `NOT possible: the ${ENTRIES.length} partial sums do not name the events`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the derivation runs one way, which is what makes the stream primary' })
      + c.note('c1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `This is ch06's duality applied to recovery: the state is a materialized fold, and the fold is not invertible for a sum over multiple events.`,
        `Which is why losing the state is survivable and losing the stream is not.`,
      ], c.C.blue, c.C.blueFill),
    cap: `The asymmetry decides the architecture. Entry \`${ENTRIES[0]}\` holds ${entryValue(ENTRIES[0])}, which came from ${EVENTS.filter(e => entryOf(e) === ENTRIES[0]).length} events — and from ${entryValue(ENTRIES[0])} alone you cannot say which. So state is recoverable from the stream and the stream is not recoverable from state, which is the whole reason the stream is retained.` },
  { t: 'and the bound on it is the watermark', draw: (c) =>
      c.panel('WHEN EACH ENTRY CAN BE DROPPED', 'p')
      + c.mapRows('gc', c.P.main.x + 24, c.P.main.y + 52, ENTRIES.map(id => {
          const ci = collectIdx(id);
          return [`${id.replace('@', ' @ window ')}`, ci === null ? 'NEVER — the watermark never passes its end' : `after event ${ci}, when the watermark reaches ${hhmmss(WATERMARKS[ci])}`];
        }), { w: 1040, rh: 30, hot: ENTRIES.indexOf(PERMANENT[0]), label: 'the watermark is what makes state collectable, and therefore bounded' })
      + c.note('g1', c.P.main.x + 24, c.P.main.y + 66 + ENTRIES.length * 30, 1040, [
        `${PERMANENT.length} of the ${ENTRIES.length} entries is never collectable in this stream, so its ${entryValue(PERMANENT[0])} is held for the life of the job.`,
        `A window that never closes is an allocation that never ends. That is the failure mode persistence makes permanent rather than transient.`,
      ], c.C.hot, c.C.hotFill),
    cap: `State is bounded only by the watermark, and this stream shows the gap: ${ENTRIES.length - PERMANENT.length} entries become collectable and ${PERMANENT.length} does not, because no event ever pushes the watermark past window [${mm(Number(PERMANENT[0].split('@')[1]))}, …). Persisting state makes that leak survive restarts, which turns a transient memory problem into a permanent one.` },
];

// ============ CONCEPT 2 — CHECKPOINTS AND STATE STORES ======================
const C2 = [
  { t: 'a checkpoint is a snapshot plus a stream position', draw: (c) =>
      c.panel(`WHAT IS WRITTEN AT A CHECKPOINT TAKEN AFTER EVENT ${CHK}`, 'a')
      + c.mapRows('ck', c.P.main.x + 24, c.P.main.y + 52, [
        [`the state`, `${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries, holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} in total`],
        [`the source offset`, `${CHK} — the position the state corresponds to`],
        [`why BOTH`, `state without the offset replays events already counted`],
        [`the damage if the offset is stale`, `${AFTER_CHK} double-counted from ${EVENTS.length - 1 - CHK} re-applied events`],
      ], { w: 1040, rh: 36, hot: 2, label: 'two things, written together or the recovery is wrong' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The offset is not bookkeeping — it is half the checkpoint. A snapshot that does not say WHERE it was taken cannot be resumed from.`,
        `And the two must be committed atomically: state-then-crash double counts, offset-then-crash loses data.`,
      ], c.C.hot, c.C.hotFill),
    cap: `A checkpoint is a pair, and the pairing is the point. The state says what the aggregation holds; the offset says which prefix of the stream it holds. Commit them non-atomically and ch05's scenario follows exactly: state saved but offset stale re-applies ${EVENTS.length - 1 - CHK} events worth ${AFTER_CHK}.` },
  { t: 'state stores hold the bytes when it does not fit in memory', draw: (c) =>
      c.panel('WHY AN EMBEDDED STORE RATHER THAN A HASH MAP', 'a')
      + c.mapRows('ss', c.P.main.x + 24, c.P.main.y + 52, [
        [`this stream's state`, `${ENTRIES.length} entries — fits in memory trivially`],
        [`what makes it not fit`, `the entry count scales with keys x OPEN windows, both unbounded`],
        [`an embedded store (e.g. RocksDB)`, `hot entries in memory, the rest on local disk`],
        [`what it does NOT change`, `the entries, their values, or when they can be collected`],
      ], { w: 1040, rh: 36, hot: 1, label: 'a storage decision, with no effect on semantics' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The store is an implementation of the same ${ENTRIES.length}-entry map. Nothing about windowing, triggers or watermarks changes because it spilled to disk.`,
        `What DOES change is the checkpoint cost, because now a snapshot means reading those bytes back off disk and uploading them.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Worth separating cleanly: the state store is about where bytes live, and it changes nothing semantic. The ${ENTRIES.length} entries, their values and their collection times are identical whether they sit in a hash map or in RocksDB. The consequence that does matter is in the note — once state is on disk, checkpointing it becomes an I/O cost worth measuring.` },
  { t: 'incremental checkpoints upload the churn, not the state', draw: (c) => {
      let s = c.panel(`FULL VS INCREMENTAL, CHECKPOINTING EVERY ${CHOSEN.k} EVENTS`, 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `checkpoints at events ${CHOSEN.at.join(', ')} — what each one has to upload`, { size: 11, weight: 700, fill: c.C.line });
      CHOSEN.at.forEach((cp, i) => {
        const y = c.P.main.y + 64 + i * 34;
        const fullN = new Set(EVENTS.slice(0, cp + 1).map(entryOf)).size;
        const incrN = new Set(EVENTS.slice((i ? CHOSEN.at[i - 1] : -1) + 1, cp + 1).map(entryOf)).size;
        s += c.cv.rect('ic' + i, c.P.main.x + 24, y, 1040, 30, { fill: c.C.paper, stroke: c.C.faint, rx: 3 });
        s += c.cv.text(c.P.main.x + 40, y + 20, `checkpoint at event ${cp}`, { size: 11, weight: 700, band: 'ick' + i });
        s += c.cv.text(c.P.main.x + 320, y + 20, `FULL: ${fullN} entries (all of the state)`, { size: 11, fill: c.C.hot, band: 'icf' + i });
        s += c.cv.text(c.P.main.x + 700, y + 20, `INCREMENTAL: ${incrN} entries (changed since)`, { size: 11, fill: c.C.good, band: 'ici' + i });
      });
      return s + c.note('i1', c.P.main.x + 24, c.P.main.y + 78 + CHOSEN.at.length * 34, 1040, [
        `Across the run: ${CHOSEN.full} entry-uploads full against ${CHOSEN.incr} incremental — a ${SAVING}% saving on ${EVENTS.length} events.`,
        `And the gap WIDENS, because full scales with total state while incremental scales with churn. On a large, mostly-idle state the difference is uploading 10 GB or 10 KB.`,
      ], c.C.good, c.C.goodFill); },
    cap: `The numbers make the asymmetry visible: full uploads grow every checkpoint (${CHOSEN.at.map((cp) => new Set(EVENTS.slice(0, cp + 1).map(entryOf)).size).join(', ')}) while incremental ones track churn (${CHOSEN.at.map((cp, i) => new Set(EVENTS.slice((i ? CHOSEN.at[i - 1] : -1) + 1, cp + 1).map(entryOf)).size).join(', ')}). ${CHOSEN.full} against ${CHOSEN.incr} here, and the ratio keeps improving as state grows relative to how fast it changes.` },
  { t: 'and the frequency is a trade with no free point', draw: (c) => {
      let s = c.panel('CHECKPOINT EVERY k EVENTS — I/O AGAINST RECOVERY', 'p');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, 'how many checkpoints, how much is uploaded, and the worst-case replay', { size: 11, weight: 700, fill: c.C.line });
      SWEEP.forEach((sw, i) => {
        const y = c.P.main.y + 64 + i * 36, best = sw.k === CHOSEN.k;
        s += c.cv.rect('sw' + i, c.P.main.x + 24, y, 1040, 32, { fill: best ? c.C.goodFill : c.C.paper, stroke: best ? c.C.good : c.C.faint, rx: 3, sw: best ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 21, `k = ${sw.k}`, { size: 11, weight: 700, band: 'swk' + i });
        s += c.cv.text(c.P.main.x + 140, y + 21, `${sw.count} checkpoint${sw.count > 1 ? 's' : ''}`, { size: 11, band: 'swc' + i });
        s += c.cv.text(c.P.main.x + 330, y + 21, `${sw.incr} entry-uploads (incremental)`, { size: 11, band: 'swu' + i });
        s += c.cv.text(c.P.main.x + 720, y + 21, `worst-case replay: ${sw.worst} event${sw.worst === 1 ? '' : 's'}`, { size: 11, weight: 700, fill: sw.worst > 4 ? c.C.hot : c.C.ink, band: 'swr' + i });
      });
      return s + c.note('w1', c.P.main.x + 24, c.P.main.y + 78 + SWEEP.length * 36, 1040, [
        `k = ${SWEEP[0].k} replays ${SWEEP[0].worst} events and uploads ${SWEEP[0].incr} times; k = ${SWEEP[SWEEP.length - 1].k} replays ${SWEEP[SWEEP.length - 1].worst} and uploads ${SWEEP[SWEEP.length - 1].incr}.`,
        `Both ends are correct. The choice is a failure-budget question: how long may recovery take, and how much steady-state I/O is affordable?`,
      ], c.C.warn, c.C.warnFill); },
    cap: `Four frequencies, and the trade is monotone in both directions — no setting is free. Checkpoint every event and recovery replays ${SWEEP[0].worst} but you pay ${SWEEP[0].incr} uploads; checkpoint once and you pay ${SWEEP[SWEEP.length - 1].incr} upload and replay ${SWEEP[SWEEP.length - 1].worst} events. The number to start from is the recovery time you can tolerate, not the I/O you would prefer.` },
];

// ============== CONCEPT 3 — CONSISTENCY AND RECOVERY ========================
const C3 = [
  { t: 'a barrier makes the snapshot consistent across stages', draw: (c) =>
      c.panel('THE BARRIER, AND WHAT EACH SOURCE DOES WITH IT', 'a')
      + c.mapRows('ba', c.P.main.x + 24, c.P.main.y + 52, KEYS.map(k =>
          [`source "${k}" injects its barrier after event ${barrierAt[k]}`, `its 2nd record is id ${EVENTS.filter(e => e.key === k)[1].id}`])
        .concat([
          [`the stage must wait for BOTH`, `so it waits until event ${LAST_BARRIER}, source "${LATE_KEY}"'s barrier`],
          [`meanwhile it must BUFFER`, `records past their own barrier: ids ${BUFFERED.join(', ')} — ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'}`],
        ]), { w: 1040, rh: 34, hot: KEYS.length + 1, label: 'Chandy-Lamport: snapshot when the barrier arrives from every input' })
      + c.note('b1', c.P.main.x + 24, c.P.main.y + 66 + (KEYS.length + 2) * 34, 1040, [
        `Source "${EARLY_KEY}" reaches its barrier at event ${FIRST_BARRIER} and "${LATE_KEY}" at event ${LAST_BARRIER}, so the stage is aligned for ${LAST_BARRIER - FIRST_BARRIER} events.`,
        `Everything arriving in that gap belongs to the NEXT checkpoint, so it is held rather than applied. That buffer is the alignment cost.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Alignment is where a barrier costs something, and it is measurable: source "${EARLY_KEY}" is ready at event ${FIRST_BARRIER}, "${LATE_KEY}" not until event ${LAST_BARRIER}, so ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'} (id ${BUFFERED.join(', ')}) must be buffered rather than processed. With skewed sources that buffer is the latency people notice at checkpoint time.` },
  { t: 'the snapshot is tied to a position, or it is useless', draw: (c) =>
      c.panel('THREE RECOVERIES FROM THE SAME CRASH', 'a')
      + c.mapRows('rv', c.P.main.x + 24, c.P.main.y + 52, [
        [`state + matching offset ${CHK}`, `replay ${replayFrom(CHK)} events · final total ${TOTAL} — correct`],
        [`state, but offset reset to 0`, `replay all ${EVENTS.length} · total ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} — double counted`],
        [`offset ${CHK}, but state lost`, `replay ${replayFrom(CHK)} · total ${AFTER_CHK} — the prefix is missing`],
        [`so a checkpoint is the PAIR`, `either half alone produces a wrong answer, in opposite directions`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same crash, three recovery states, three different totals' })
      + c.note('v1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `${TOTAL}, ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}, ${AFTER_CHK} — and only the first is right. Note the second and third are wrong in OPPOSITE directions.`,
        `That is why the state and the offset must be committed together: a half-committed checkpoint is not a slightly-stale checkpoint, it is a wrong one.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Three recoveries, three totals: ${TOTAL} correct, ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} from a stale offset, ${AFTER_CHK} from lost state. The two failures are symmetric — one over-counts the checkpointed prefix and the other omits it — which is the clearest possible argument for committing the pair atomically.` },
  { t: 'at-least-once and exactly-once recovery differ here', draw: (c) =>
      c.panel('WHAT HAPPENS TO THE EVENTS AFTER THE LAST CHECKPOINT', 'a')
      + c.mapRows('ao', c.P.main.x + 24, c.P.main.y + 52, [
        [`at-least-once checkpointing`, `the ${replayFrom(CHK)} events after event ${CHK} may be applied twice`],
        [`the damage`, `up to ${AFTER_CHK} double-counted — ${Math.round(100 * AFTER_CHK / TOTAL)}% of the ${TOTAL} total`],
        [`exactly-once checkpointing`, `state and offsets align, so those ${replayFrom(CHK)} are applied exactly once`],
        [`what it costs`, `the alignment above — ${BUFFERED.length} buffered record${BUFFERED.length === 1 ? '' : 's'} per checkpoint, and a two-phase commit at the sink`],
      ], { w: 1040, rh: 36, hot: 2, label: 'the same checkpoint mechanism, two guarantees' })
      + c.note('a1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `At-least-once is not "nearly exactly-once": the error is bounded by the checkpoint interval, so a longer interval is a LARGER possible error.`,
        `Which couples the two settings from concept 2 — the frequency you chose for recovery time also sets the worst-case double count.`,
      ], c.C.warn, c.C.warnFill),
    cap: `The coupling in the note is the useful observation. Checkpoint interval was presented as an I/O-versus-recovery-time trade; under at-least-once it is also the bound on how wrong an answer can be — up to ${AFTER_CHK} of ${TOTAL} here. Lengthening the interval to save I/O quietly widens the error window.` },
  { t: 'and state grows unless something bounds it', draw: (c) =>
      c.panel('WHAT PERSISTENCE MAKES PERMANENT', 'p')
      + c.mapRows('gr', c.P.main.x + 24, c.P.main.y + 52, [
        [`entries collectable in this stream`, `${ENTRIES.length - PERMANENT.length} of ${ENTRIES.length}`],
        [`entries that are never collectable`, `${PERMANENT.length} — ${PERMANENT.join(', ')}, holding ${PERMANENT.map(id => entryValue(id)).join(' + ')}`],
        [`what would collect them`, `the watermark passing the window end plus allowed lateness`],
        [`what persistence changes`, `the leak now survives every restart, instead of being cleared by one`],
      ], { w: 1040, rh: 36, hot: 3, label: 'watermarks plus allowed lateness are the only garbage collector' })
      + c.note('g2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A restart used to clear a leaked entry by accident. With persisted state it is restored faithfully, forever.`,
        `So "bound the state" is not advice about efficiency — on an unbounded stream an uncollected entry is a permanent allocation per key.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The sting is in the last row. Before persistence, a window that never closed was cleared by the next deploy; with a durable state store it is checkpointed, uploaded and restored indefinitely. ${PERMANENT.length} of ${ENTRIES.length} entries here is in that category, and the only mechanism that would ever free it is the watermark.` },
];

// ============= CONCEPT 4 — THE CHECKPOINT DESIGN (systemDesign) =============
const C4 = [
  { t: 'the pipeline, and what each stage contributes', draw: (c) =>
      c.panel('CHECKPOINTING A STATEFUL PROCESSOR — FIVE STAGES', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`stream`, `replayable from an offset — without this, nothing below helps`],
        [`processor (state store)`, `${ENTRIES.length} entries, spilled to local disk when large`],
        [`checkpoint (state + offset)`, `the PAIR, committed atomically`],
        [`durable storage`, `survives the machine — local disk does not`],
        [`restart recovery`, `load the state, seek to the offset, replay ${replayFrom(CHK)} events`],
      ], { w: 1040, rh: 34, hot: 2, label: 'five stages, and the third is the one with a correctness condition' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 236, 1040, [
        `Note the split between stages 2 and 4: the state store is LOCAL and fast, the checkpoint is REMOTE and durable. A local store alone recovers nothing when the machine is gone.`,
        `And the atomicity in stage 3 is the only correctness requirement in the list; everything else is performance.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Two stages are easy to collapse and must not be: the state store is local and exists for speed, the checkpoint is remote and exists for durability. Lose that distinction and you have a fast processor that cannot survive a machine failure. The single correctness requirement is stage 3 — state and offset committed together.` },
  { t: 'the recovery, traced', draw: (c) =>
      c.panel(`RESUMING FROM THE CHECKPOINT AT EVENT ${CHK}`, 'a')
      + c.mapRows('rs', c.P.main.x + 24, c.P.main.y + 52, [
        [`1. load the state`, `${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}`],
        [`2. seek the source to offset ${CHK}`, `the position those entries correspond to`],
        [`3. replay events ${CHK + 1}..${EVENTS.length - 1}`, `${replayFrom(CHK)} events worth ${AFTER_CHK}`],
        [`4. final state`, `${ENTRIES.length} entries holding ${TOTAL} — identical to a run with no crash`],
      ], { w: 1040, rh: 36, hot: 3, label: 'four steps, and the result is indistinguishable from the uncrashed run' })
      + c.note('s2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded + ${AFTER_CHK} replayed = ${TOTAL}, which is the no-crash total. That equality is the design's whole claim.`,
        `And it holds only because step 2 used the offset FROM the checkpoint. Any other offset breaks the arithmetic in one direction or the other.`,
      ], c.C.good, c.C.goodFill),
    cap: `The claim a checkpointing design has to make is that recovery is indistinguishable from no failure, and here it is one equation: ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded plus ${AFTER_CHK} replayed equals ${TOTAL}. Every other recovery in this chapter failed that equation, and always because the state and the offset did not match.` },
  { t: 'the two settings, and what each one buys', draw: (c) =>
      c.panel('FREQUENCY AND MODE', 'a')
      + c.mapRows('kb', c.P.main.x + 24, c.P.main.y + 52, [
        [`checkpoint every ${SWEEP[0].k} event`, `${SWEEP[0].incr} uploads · replay ${SWEEP[0].worst} · at-least-once error up to ${0}`],
        [`checkpoint every ${CHOSEN.k} events`, `${CHOSEN.incr} uploads · replay ${CHOSEN.worst} · error up to ${EVENTS.slice(-CHOSEN.worst).reduce((s, e) => s + e.v, 0)}`],
        [`checkpoint once`, `${SWEEP[SWEEP.length - 1].incr} upload · replay ${SWEEP[SWEEP.length - 1].worst} · error up to ${EVENTS.slice(1).reduce((s, e) => s + e.v, 0)}`],
        [`incremental rather than full`, `${CHOSEN.incr} uploads instead of ${CHOSEN.full} at k = ${CHOSEN.k} — ${SAVING}% less, and widening`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the frequency sets recovery time AND the at-least-once error bound' })
      + c.note('k2', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The third column is the one people forget: under at-least-once recovery, a longer checkpoint interval widens the worst-case double count.`,
        `Incremental mode is the only row here with no downside — it changes the upload volume and nothing else.`,
      ], c.C.warn, c.C.warnFill),
    cap: `One of these four rows is a free win and three are trades. Incremental checkpointing changes only the bytes uploaded (${CHOSEN.incr} against ${CHOSEN.full}), with no effect on recovery time or correctness. The frequency rows all trade in three directions at once — I/O, recovery time, and under at-least-once, the error bound.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`The atomic commit of state and offset is assumed, not built. Everything in this design rests on it, and achieving it against an external sink is ch05's two-phase commit problem.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`${PERMANENT.length} of the ${ENTRIES.length} state entries is never collectable here, and persistence makes that leak survive restarts rather than being cleared by one.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`Barrier alignment buffers ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'} on this ${EVENTS.length}-event stream with ${KEYS.length} sources. With badly skewed sources it is the dominant checkpoint cost, and nothing here bounds it.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And recovery is only as good as the source's retention: replaying from offset ${CHK} requires those ${replayFrom(CHK)} events to still exist.`], c.C.blue, c.C.blueFill),
    cap: `The first gap is the load-bearing one. Every correct recovery in this chapter assumed the state and the offset were committed together, and this design does not build that — it requires it. Against an internal store it is a local transaction; against an external sink it is exactly the distributed-commit problem ch05 recommended avoiding.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch07-why', steps: C1,
    title: 'Why state must persist — and why it is only a cache',
    subtitle: `${ENTRIES.length} entries for ${EVENTS.length} events · restart replays ${EVENTS.length} without a checkpoint, ${replayFrom(CHK)} with one`,
    heading: 'Why persistence buys time rather than correctness',
    why: [
      `**State is the aggregation in progress**, and it is worth making concrete before discussing how to keep it. For this stream it is **${ENTRIES.length} numbers**, one per (key, window) group that has not finished: ${ENTRIES.slice(0, 3).map(id => `\`${id}\` = ${entryValue(id)}`).join(', ')}, and so on. Without it every event would start from zero and nothing spanning more than one record could be computed.`, '',
      `**A restart without persisted state re-reads the whole stream.** Rebuilding from scratch reads all ${EVENTS.length} events; resuming from a checkpoint at event ${CHK} reads ${replayFrom(CHK)}. Both produce the same ${ENTRIES.length} entries.`, '',
      `That last point is the one to keep: **a full reprocess is correct**, it just takes as long as the history is. So persisted state is an optimisation, not a correctness mechanism — on a nine-event stream the difference is nothing, and on a year of history it is a minute against a week.`, '',
      `**The stream is the truth because the derivation runs one way.** Stream → state is always possible: replay and re-fold. State → stream is not: entry \`${ENTRIES[0]}\` holds ${entryValue(ENTRIES[0])}, which came from ${EVENTS.filter(e => entryOf(e) === ENTRIES[0]).length} events, and from ${entryValue(ENTRIES[0])} alone you cannot say which. This is ch06's duality applied to recovery, and it is why losing state is survivable and losing the stream is not.`, '',
      `**And the only bound on state is the watermark.** ${ENTRIES.length - PERMANENT.length} of the ${ENTRIES.length} entries here become collectable when the watermark passes their window end. ${PERMANENT.length} never does — window [${mm(Number(PERMANENT[0].split('@')[1]))}, …) is never passed by any watermark in this stream — so its ${entryValue(PERMANENT[0])} is held for the life of the job.`],
    whenHeading: 'When to persist, when to rebuild, and what persistence makes worse',
    when: [
      `**Persist when the rebuild time exceeds your recovery budget**, which on any real stream is immediately. The calculation is history length ÷ replay throughput, and it only grows.`, '',
      `**Rebuild rather than persist when the state is small and the stream is short** — a test harness, a backfill over a bounded input, a job whose window is minutes. Carrying a state store you do not need is operational cost with no benefit.`, '',
      `**Always keep the stream, whatever you do with the state.** State is recoverable from the stream; the stream is not recoverable from state. That asymmetry, not retention policy, is the reason to keep it.`, '',
      `**And know what persistence makes worse:** a window that never closes used to be cleared accidentally by the next deploy. With a durable state store it is checkpointed, uploaded and faithfully restored forever. ${PERMANENT.length} of ${ENTRIES.length} entries here is in that category, which turns a transient memory problem into a permanent allocation per key.`, '',
      `**What this does not settle:** how to take a snapshot that is actually resumable. A snapshot without the stream position it corresponds to cannot be resumed from at all — that pairing, and what it costs, is the next concept.`],
    diagramHeading: 'Visual walkthrough — the entries, the rebuild cost, and the bound',
    sub: `The ${ENTRIES.length} state entries, their collection points and the replay counts are computed from the seed and asserted.` },
  { name: 'ch07-checkpoints', steps: C2,
    title: 'Checkpoints and state stores — the pair, and what it costs to write',
    subtitle: `full ${CHOSEN.full} vs incremental ${CHOSEN.incr} entry-uploads at k=${CHOSEN.k} (${SAVING}% less) · replay ${SWEEP.map(s => s.worst).join('/')} at k=${KS.join('/')}`,
    heading: 'Why a checkpoint is two things, and why the frequency is never free',
    why: [
      `**A checkpoint is a snapshot PLUS a stream position**, and the pairing is the whole mechanism. Taken after event ${CHK}, it writes ${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} state entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}, and the offset **${CHK}** that those entries correspond to.`, '',
      `The offset is not bookkeeping — a snapshot that does not say *where* it was taken cannot be resumed from. And the two must be committed **atomically**: state-then-crash re-applies ${EVENTS.length - 1 - CHK} events worth **${AFTER_CHK}**, and offset-then-crash loses the same amount.`, '',
      `**A state store is where the bytes live, and it changes nothing semantic.** This stream's ${ENTRIES.length} entries fit in memory trivially; what makes real state not fit is that the entry count scales with keys × *open windows*, both unbounded. An embedded store (RocksDB and similar) keeps hot entries in memory and the rest on local disk. The entries, their values and their collection times are identical either way — what changes is that checkpointing now means reading those bytes back and uploading them.`, '',
      `**Incremental checkpointing uploads the churn rather than the state.** Checkpointing every ${CHOSEN.k} events, the full uploads are ${CHOSEN.at.map(cp => new Set(EVENTS.slice(0, cp + 1).map(entryOf)).size).join(', ')} entries and the incremental ones are ${CHOSEN.at.map((cp, i) => new Set(EVENTS.slice((i ? CHOSEN.at[i - 1] : -1) + 1, cp + 1).map(entryOf)).size).join(', ')} — **${CHOSEN.full} against ${CHOSEN.incr}**, a ${SAVING}% saving on ${EVENTS.length} events.`, '',
      `And the gap **widens**, because full scales with total state while incremental scales with how fast it changes. On a large, mostly-idle state that is the difference between uploading 10 GB and 10 KB.`, '',
      `**The frequency is a trade with no free point.** Checkpoint every ${SWEEP[0].k} event: ${SWEEP[0].incr} uploads, worst-case replay ${SWEEP[0].worst}. Every ${CHOSEN.k}: ${CHOSEN.incr} uploads, replay ${CHOSEN.worst}. Once: ${SWEEP[SWEEP.length - 1].incr} upload, replay ${SWEEP[SWEEP.length - 1].worst}. Both ends are correct.`],
    whenHeading: 'When to checkpoint how often, and what the store choice actually decides',
    when: [
      `**Pick the frequency from the recovery time you can tolerate, not the I/O you would prefer.** Recovery time is (events since the last checkpoint ÷ replay throughput), so start from the SLA and derive the interval — the I/O then is what it is.`, '',
      `**Use incremental checkpointing unconditionally when the store supports it.** It is the one setting in this chapter with no trade: ${CHOSEN.incr} uploads instead of ${CHOSEN.full} here, with identical recovery behaviour.`, '',
      `**Reach for an embedded state store when the entry count stops fitting**, which is a function of key cardinality times open windows. It is a storage decision and changes nothing about windowing, triggers or watermarks.`, '',
      `**Do not treat the local store as durable.** It is fast and it dies with the machine; the remote checkpoint is what survives. Collapsing those two roles gives you a processor that recovers from a restart but not from a failure.`, '',
      `**What this does not settle:** whether a snapshot taken across several stages is internally consistent. Taking each stage's snapshot at a different point in the stream produces a checkpoint no single position corresponds to — which is what barriers are for, and they have a cost this concept has not priced.`],
    diagramHeading: 'Visual walkthrough — the pair, the store, incremental uploads, the sweep',
    sub: `The upload counts, the sweep and the double-count figure are computed from the seed and asserted.` },
  { name: 'ch07-recovery', steps: C3,
    title: 'Consistency and recovery — barriers, the pair, and the error bound',
    subtitle: `alignment buffers ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'} · three recoveries give ${TOTAL} / ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} / ${AFTER_CHK}`,
    heading: 'Why alignment costs something, and why half a checkpoint is wrong rather than stale',
    why: [
      `**A barrier makes the snapshot consistent across stages** (Chandy–Lamport): it flows through the stream, and each stage snapshots when it has seen the barrier from **every** input.`, '',
      `Trace it with the two keys as two sources, injecting each barrier after that source's second record. Source "${EARLY_KEY}" reaches its barrier at event ${FIRST_BARRIER}; source "${LATE_KEY}" not until event ${LAST_BARRIER}. The stage is therefore **aligned for ${LAST_BARRIER - FIRST_BARRIER} events**, and anything arriving in that gap past its own barrier belongs to the *next* checkpoint — so it is **buffered**, not applied. Here that is ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'}: id ${BUFFERED.join(', ')}.`, '',
      `That buffer is the alignment cost, and with badly skewed sources it is the latency people notice at checkpoint time.`, '',
      `**The snapshot is tied to a position, or it is useless.** Three recoveries from the same crash:`, '',
      `- state **+ matching offset ${CHK}** → replay ${replayFrom(CHK)} events, total **${TOTAL}** — correct`,
      `- state, **offset reset to 0** → replay all ${EVENTS.length}, total **${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}** — double counted`,
      `- **offset ${CHK}, state lost** → replay ${replayFrom(CHK)}, total **${AFTER_CHK}** — the prefix is missing`, '',
      `The two failures are wrong in **opposite directions**, which is the clearest argument for atomicity: a half-committed checkpoint is not a slightly-stale checkpoint, it is a wrong one.`, '',
      `**At-least-once and exactly-once recovery differ exactly here.** Under at-least-once the ${replayFrom(CHK)} events after the checkpoint may be applied twice — up to **${AFTER_CHK} double-counted, ${Math.round(100 * AFTER_CHK / TOTAL)}% of the ${TOTAL} total**. Exactly-once aligns state and offsets so they are applied once, and pays for it with the alignment above plus a two-phase commit at the sink.`, '',
      `Which couples the two settings from the previous concept: **the checkpoint interval you chose for recovery time also sets the worst-case double count.**`],
    whenHeading: 'When to pay for exactly-once recovery, and what bounds the state',
    when: [
      `**Pay for exactly-once recovery when a duplicate is visible or expensive** — the ch05 test. The cost is alignment buffering plus sink complexity, and the benefit is that your error bound stops being a function of your checkpoint interval.`, '',
      `**Accept at-least-once when the sink is idempotent anyway.** Then a replayed record is harmless and the alignment cost buys nothing. This is the common and correct choice for a pipeline writing into a keyed store.`, '',
      `**If you accept at-least-once, shorten the checkpoint interval deliberately** — not for recovery time but because the interval *is* the error bound. That is the coupling most people miss when they lengthen the interval to save I/O.`, '',
      `**And bound the state, because persistence makes a leak permanent.** ${PERMANENT.length} of the ${ENTRIES.length} entries here is never collectable, and watermarks plus allowed lateness are the only garbage collector there is. A restart used to clear such an entry by accident; a durable store restores it faithfully, forever.`, '',
      `**What this does not settle:** the atomic commit of state and offset, which every correct recovery above assumed. Against a local store it is a transaction; against an external sink it is the distributed-commit problem, and the next concept names it as a requirement rather than solving it.`],
    diagramHeading: 'Visual walkthrough — alignment, three recoveries, and the error bound',
    sub: `The alignment buffer, all three recovery totals and the never-collectable entry are computed from the seed and asserted.` },
  { name: 'ch07-system', steps: C4,
    title: 'System design — checkpointing a stateful processor',
    subtitle: `${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded + ${AFTER_CHK} replayed = ${TOTAL}, the no-crash total`,
    heading: 'Why the whole design reduces to one equation and one requirement',
    why: [
      `**The question.** After a crash the processor must resume from the last barrier snapshot — state plus offset — without losing events or double-counting, even though the source replays from the checkpoint.`, '',
      `**The pipeline:** stream → processor (state store) → checkpoint (state + offset) → durable storage → restart recovery.`, '',
      `**Two stages are easy to collapse and must not be.** The state store is **local** and exists for speed; the checkpoint in durable storage is **remote** and exists to survive the machine. A processor with only the first recovers from a restart but not from a failure.`, '',
      `**The recovery, traced:**`, '',
      `1. Load the state — ${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}.`,
      `2. Seek the source to offset **${CHK}**, the position those entries correspond to.`,
      `3. Replay events ${CHK + 1}..${EVENTS.length - 1} — ${replayFrom(CHK)} events worth ${AFTER_CHK}.`,
      `4. Final state: ${ENTRIES.length} entries holding **${TOTAL}**.`, '',
      `That is the design's entire claim, as one equation: **${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded + ${AFTER_CHK} replayed = ${TOTAL}**, the no-crash total. Every failed recovery earlier in this chapter failed that equation, and always because the state and the offset did not match.`, '',
      `**Two settings, and one of them is free.** Incremental rather than full checkpointing is ${CHOSEN.incr} uploads instead of ${CHOSEN.full} at k = ${CHOSEN.k}, with identical recovery behaviour — no trade at all. The frequency trades in three directions at once: I/O, recovery time, and under at-least-once the error bound (up to ${AFTER_CHK} of ${TOTAL} at a checkpoint every ${CHOSEN.k} events).`],
    whenHeading: 'When this design is enough, and the four things it does not settle',
    when: [
      `**It is enough when the sink is inside the system** — another stream, a keyed store you control. Then the atomic commit of state and offset is a local transaction and the design is complete as drawn.`, '',
      `**Derive the checkpoint interval from the recovery SLA**, then check the at-least-once error bound it implies. If that bound is unacceptable, you need exactly-once recovery rather than a shorter interval.`, '',
      `**Turn on incremental checkpointing and leave it on.** It is the only free improvement here.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **The atomic commit of state and offset is required, not built.** Every correct recovery above assumed it. Against a local store it is a transaction; against an external sink it is ch05's two-phase commit problem, with the in-doubt state and the human resolution.`,
      `2. **${PERMANENT.length} of the ${ENTRIES.length} state entries is never collectable**, and persistence makes that leak survive restarts rather than being cleared by one. Nothing in this design bounds it — only the watermark can.`,
      `3. **Barrier alignment buffers ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'}** on this ${EVENTS.length}-event stream with ${KEYS.length} sources. With badly skewed sources it becomes the dominant checkpoint cost, and nothing here bounds how long a stage may wait.`,
      `4. **Recovery is only as good as the source's retention.** Replaying from offset ${CHK} requires those ${replayFrom(CHK)} events to still exist — so the retention window is the real limit on how stale a checkpoint may be.`],
    diagramHeading: 'Visual walkthrough — five stages, four recovery steps, two settings',
    sub: `The recovery arithmetic, both upload counts and the alignment buffer are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · ${ENTRIES.length} state entries · total ${TOTAL}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch07.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch07.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being aggregated  ·  key = which group it belongs to',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[0] = (id 0, key "${EVENTS[0].key}", et ${EVENTS[0].et}, pt ${EVENTS[0].pt}, v ${EVENTS[0].v})`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the window width, in seconds of event time.  WIN = ${WIN}`,
  `// primitive: LAG — the watermark's assumed worst-case skew.  LAG = ${LAG}`,
  `// primitive: KEYS — the keys state is held per.  KEYS = ["${KEYS.join('", "')}"]`,
  `// primitive: CHK — the index the checkpoint in this chapter was taken at.  CHK = ${CHK}`,
  '// primitive: winOf(et) — the START of the window holding et.',
  `//   winOf(${EVENTS[0].et}) = ${winOf(EVENTS[0].et)}      winOf(${EVENTS[4].et}) = ${winOf(EVENTS[4].et)}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  '// primitive: contains(xs, x) — is x in xs?  contains([1,2], 2) = true',
  '// primitive: watermarkAfter(i) — highest event time through i, minus LAG.',
  `//   watermarkAfter(${CHK}) = ${WATERMARKS[CHK]}      watermarkAfter(${EVENTS.length - 1}) = ${WATERMARKS[EVENTS.length - 1]}`,
];
const PROGRAMS = [];
const E0 = ENTRIES[0], P0 = PERMANENT[0];

// ---- concept 1: state as a fold, and its one-way derivation ----------------
PROGRAMS.push({
  name: 'ch07-why-memory',
  title: 'State as a fold — rebuildable from the stream, and only that way',
  subtitle: `${ENTRIES.length} entries · rebuild reads ${EVENTS.length} events, resume reads ${replayFrom(CHK)} · ${PERMANENT.length} never collectable`,
  src: COMMON.concat([
    '',
    'type State { entries, readCount }',
    '',
    '// primitive: entryOf(e) — the (key, window) pair this event belongs to. That pair',
    '//   is the UNIT of streaming state; there is one number per pair.',
    `//   entryOf(EVENTS[0]) = "${entryOf(EVENTS[0])}"      entryOf(EVENTS[${EVENTS.length - 1}].id) = "${entryOf(EVENTS[EVENTS.length - 1])}"`,
    '',
    '// function: buildFrom(startIndex, prior) — fold the stream from startIndex into',
    '//   `prior`, counting the events read. prior = NONE means "rebuild from scratch".',
    `//   buildFrom(0, NONE).readCount = ${EVENTS.length}      buildFrom(CHK + 1, loaded).readCount = ${replayFrom(CHK)}`,
    'fun buildFrom(startIndex, prior) {',
    '    var st = State({}, 0)',
    '    if (prior != NONE) { st = prior }',
    '    for (i in startIndex .. len(EVENTS) - 1) {',
    '        val id = entryOf(EVENTS[i])',
    '        if (st.entries[id] == NONE) { st.entries[id] = 0 }',
    '        st.entries[id] = st.entries[id] + EVENTS[i].v',
    '        st.readCount = st.readCount + 1',
    '    }',
    '    return st',
    '}',
    '',
    `// primitive: windowOf(entryId) — the window start inside an entry id.`,
    `//   windowOf("${E0}") = ${E0.split('@')[1]}      windowOf("${P0}") = ${P0.split('@')[1]}`,
    '',
    '// function: collectableAt(entryId) — the index at which the watermark passes that',
    '//   entry\'s window end, so its memory may be released. NONE means never.',
    `//   collectableAt("${E0}") = ${collectIdx(E0)}      collectableAt("${P0}") = NONE`,
    'fun collectableAt(entryId) {',
    '    val w = windowOf(entryId)',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        if (watermarkAfter(i) >= w + WIN) { return i }',
    '    }',
    '    return NONE',
    '}',
    '// function: permanent(st) — entries nothing will ever collect. Persistence makes',
    '//   these survive restarts instead of being cleared by one.',
    `//   permanent(buildFrom(0, NONE)) = ["${PERMANENT.join('", "')}"]`,
    'fun permanent(st) {',
    '    var out = []',
    '    for (id in st.entries) {',
    '        if (collectableAt(id) == NONE) { out = append(out, id) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: main() — THE CALLER: rebuild from scratch, and resume from CHK.',
    'fun main() {',
    '    val full   = buildFrom(0, NONE)',
    `    val loaded = buildFrom(0, NONE)              // stands for the checkpointed prefix`,
    '    val resume = buildFrom(CHK + 1, loaded)',
    '    val leaks  = permanent(full)',
    '}',
  ]),
  heap: {
    full:   { addr: '0x100', type: 'State', val: () => `${ENTRIES.length} entries · readCount ${EVENTS.length}` },
    resume: { addr: '0x200', type: 'State', val: () => `${ENTRIES.length} entries · readCount ${replayFrom(CHK)}` },
    leaks:  { addr: '0x300', type: `string[${PERMANENT.length}]`, val: () => `["${PERMANENT.join('", "')}"]` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `full = ${o.full || '...'}`, `loaded = ${o.loaded || '...'}`,
      `resume = ${o.resume || '...'}`, `leaks = ${o.leaks || '...'}`] });
    return [
      { t: 'state is one number per (key, window) pair', line: at('fun buildFrom(startIndex, prior)', 'st.entries[id] = st.entries[id] + EVENTS[i].v'),
        stack: [MAIN(), { name: 'buildFrom', locals: ['startIndex = 0', 'prior = NONE', 'st = @0x100', `i = ${EVENTS.length - 1}`, `id = "${entryOf(EVENTS[EVENTS.length - 1])}"`] }],
        heap: [{ key: 'full', hot: true }],
        cap: `\`id\` is \`"${entryOf(EVENTS[EVENTS.length - 1])}"\` — a key and a window start, nothing else. ${EVENTS.length} events produce ${ENTRIES.length} such ids, so "state" is ${ENTRIES.length} numbers. Everything in this chapter exists to carry those ${ENTRIES.length} numbers across a restart.` },
      { t: 'resuming from a checkpoint reads fewer events, same result', line: at('    val resume = buildFrom(CHK + 1, loaded)'),
        stack: [MAIN({ full: '@0x100', loaded: '@0x200', resume: '@0x200' })],
        heap: [{ key: 'full' }, { key: 'resume', hot: true }],
        cap: `\`full.readCount\` is ${EVENTS.length} and \`resume.readCount\` is ${replayFrom(CHK)} — and both States hold the same ${ENTRIES.length} entries. Persistence changed the cost and not the answer, which is why it is an optimisation rather than a correctness mechanism.` },
      { t: 'the fold runs one way: the entries do not name their events', line: at('fun collectableAt(entryId)', 'if (watermarkAfter(i) >= w + WIN) { return i }'),
        stack: [MAIN({ full: '@0x100', loaded: '@0x200', resume: '@0x200' }), { name: 'collectableAt', locals: [`entryId = "${E0}"`, `w = ${E0.split('@')[1]}`, `i = ${collectIdx(E0)}`] }],
        heap: [{ key: 'full' }],
        cap: `Entry \`${E0}\` holds ${entryValue(E0)}, built from ${EVENTS.filter(e => entryOf(e) === E0).length} events. Nothing in \`st.entries\` records which events — so stream → state is a function and state → stream is not. That asymmetry is why losing state is survivable and losing the stream is not.` },
      { t: `and ${PERMANENT.length} entry is never collectable at all`, line: at('fun permanent(st)', 'if (collectableAt(id) == NONE) { out = append(out, id) }'),
        stack: [MAIN({ full: '@0x100', loaded: '@0x200', resume: '@0x200', leaks: '@0x300' }), { name: 'permanent', locals: ['st = @0x100', 'out = @0x300', `id = "${P0}"`] }],
        heap: [{ key: 'full' }, { key: 'leaks', hot: true }],
        cap: `\`collectableAt("${P0}")\` returns NONE — the loop runs out without any watermark reaching ${Number(P0.split('@')[1]) + WIN}. Its ${entryValue(P0)} stays allocated for the life of the job. Before persistence a restart cleared such an entry by accident; a durable store checkpoints it and restores it faithfully, forever.` },
    ];
  },
  intro: [
    `**What is being answered.** What "state" actually is, and why persisting it is an optimisation — as one \`buildFrom\` function called two ways.`, '',
    `\`entryOf(e)\` is the unit: a **(key, window)** pair. ${EVENTS.length} events produce ${ENTRIES.length} of them, so the state this whole chapter is about is ${ENTRIES.length} numbers.`, '',
    `Step 2 is the point: \`full.readCount\` = ${EVENTS.length} and \`resume.readCount\` = ${replayFrom(CHK)}, and both hold the same ${ENTRIES.length} entries. Step 4 is the cost — \`collectableAt("${P0}")\` returns NONE, so one entry is never freed, and persistence makes that leak survive restarts.`],
  sub: `The entries, both read counts and the never-collectable entry are computed from the seed and asserted.` });

// ---- concept 2: the checkpoint pair, and upload volume ---------------------
PROGRAMS.push({
  name: 'ch07-checkpoints-memory',
  title: 'The checkpoint pair, and what full versus incremental uploads',
  subtitle: `full ${CHOSEN.full} vs incremental ${CHOSEN.incr} entry-uploads at k=${CHOSEN.k} · stale offset costs ${AFTER_CHK}`,
  src: COMMON.concat([
    '',
    'type Checkpoint { entries, offset }',
    'type Upload     { full, incremental }',
    '',
    '// primitive: entryOf(e) — the (key, window) pair this event belongs to.',
    `//   entryOf(EVENTS[0]) = "${entryOf(EVENTS[0])}"`,
    `// primitive: K — checkpoint every K events.  K = ${CHOSEN.k}`,
    `// primitive: CHECKPOINTS — where those land.  CHECKPOINTS = [${CHOSEN.at.join(', ')}]`,
    '',
    '// function: take(upto) — a checkpoint is the STATE and the OFFSET, together.',
    `//   take(CHK).offset = ${CHK}      take(CHK).entries holds ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} across ${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries`,
    'fun take(upto) {',
    '    var ent = {}',
    '    for (i in 0 .. upto) {',
    '        val id = entryOf(EVENTS[i])',
    '        if (ent[id] == NONE) { ent[id] = 0 }',
    '        ent[id] = ent[id] + EVENTS[i].v',
    '    }',
    '    return Checkpoint(ent, upto)',
    '}',
    '',
    '// function: restore(cp, useOffset) — resume. With the checkpoint\'s own offset the',
    '//   total is right; with a stale offset the prefix is applied twice.',
    `//   restore(take(CHK), CHK) = ${TOTAL}      restore(take(CHK), 0) = ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}`,
    'fun restore(cp, useOffset) {',
    '    var total = 0',
    '    for (id in cp.entries) { total = total + cp.entries[id] }',
    '    for (i in useOffset + 1 .. len(EVENTS) - 1) { total = total + EVENTS[i].v }',
    '    return total',
    '}',
    '',
    '// primitive: countEntries(lo, hi) — distinct (key, window) pairs touched in that',
    '//   index range.',
    `//   countEntries(0, ${CHOSEN.at[0]}) = ${new Set(EVENTS.slice(0, CHOSEN.at[0] + 1).map(entryOf)).size}      countEntries(${CHOSEN.at[0] + 1}, ${CHOSEN.at[1]}) = ${new Set(EVENTS.slice(CHOSEN.at[0] + 1, CHOSEN.at[1] + 1).map(entryOf)).size}`,
    '',
    '// function: uploadVolume() — how many ENTRY-writes each checkpointing mode costs',
    '//   across the whole run. Full re-sends all of the state; incremental only churn.',
    `//   uploadVolume() = Upload(${CHOSEN.full}, ${CHOSEN.incr})`,
    'fun uploadVolume() {',
    '    var full = 0',
    '    var incr = 0',
    '    var prev = 0 - 1',
    '    for (c in CHECKPOINTS) {',
    '        full = full + countEntries(0, c)',
    '        incr = incr + countEntries(prev + 1, c)',
    '        prev = c',
    '    }',
    '    return Upload(full, incr)',
    '}',
    '// function: main() — THE CALLER: one checkpoint, two restores, one cost.',
    'fun main() {',
    '    val cp      = take(CHK)',
    '    val correct = restore(cp, CHK)',
    '    val stale   = restore(cp, 0)',
    '    val cost    = uploadVolume()',
    '}',
  ]),
  heap: {
    cp:   { addr: '0x100', type: 'Checkpoint', val: () => `${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} · offset ${CHK}` },
    cost: { addr: '0x200', type: 'Upload', val: () => `full ${CHOSEN.full} · incremental ${CHOSEN.incr}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `cp = ${o.cp || '...'}`, `correct = ${o.correct !== undefined ? o.correct : '...'}`,
      `stale = ${o.stale !== undefined ? o.stale : '...'}`, `cost = ${o.cost || '...'}`] });
    return [
      { t: 'the checkpoint writes the state AND the offset', line: at('fun take(upto)', 'return Checkpoint(ent, upto)'),
        stack: [MAIN(), { name: 'take', locals: [`upto = ${CHK}`, 'ent = (a map)', `i = ${CHK}`, `id = "${entryOf(EVENTS[CHK])}"`] }],
        heap: [{ key: 'cp', hot: true }],
        cap: `The Checkpoint carries \`ent\` and \`upto\` in one value — ${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}, at offset ${CHK}. The offset is half the checkpoint, not metadata about it: a snapshot that does not say where it was taken cannot be resumed from.` },
      { t: 'restoring with the matching offset gives the no-crash total', line: at('fun restore(cp, useOffset)', 'for (i in useOffset + 1 .. len(EVENTS) - 1) { total = total + EVENTS[i].v }'),
        stack: [MAIN({ cp: '@0x100', correct: TOTAL }), { name: 'restore', locals: ['cp = @0x100', `useOffset = ${CHK}`, `total = ${TOTAL}`, `id = "${ENTRIES.filter(x => EVENTS.slice(0, CHK + 1).some(e => entryOf(e) === x)).slice(-1)[0]}" (the loop over entries is done)`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'cp' }],
        cap: `The loop starts at \`useOffset + 1\` = ${CHK + 1}, so it adds the ${replayFrom(CHK)} events after the checkpoint to the ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded from it: ${TOTAL}, the no-crash total. One expression, \`useOffset + 1\`, is the entire correctness of the recovery.` },
      { t: 'and with a stale offset the prefix is counted twice', line: at('    val stale   = restore(cp, 0)'),
        stack: [MAIN({ cp: '@0x100', correct: TOTAL, stale: TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0) })],
        heap: [{ key: 'cp' }],
        cap: `\`restore(cp, 0)\` replays from index 1, re-adding events already in \`cp.entries\`: ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} instead of ${TOTAL}, over by exactly the ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} the checkpoint had already accumulated. Same state, same stream, one wrong argument.` },
      { t: 'incremental uploads churn; full uploads everything, every time', line: at('fun uploadVolume()', 'incr = incr + countEntries(prev + 1, c)'),
        stack: [MAIN({ cp: '@0x100', correct: TOTAL, stale: TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0), cost: '@0x200' }),
                { name: 'uploadVolume', locals: [`full = ${CHOSEN.full}`, `incr = ${CHOSEN.incr}`, `prev = ${CHOSEN.at[CHOSEN.at.length - 2]}`, `c = ${CHOSEN.at[CHOSEN.at.length - 1]}`] }],
        heap: [{ key: 'cost', hot: true }],
        cap: `Compare the two accumulators' arguments: \`countEntries(0, c)\` grows with every checkpoint while \`countEntries(prev + 1, c)\` depends only on the gap. ${CHOSEN.full} against ${CHOSEN.incr} here — and the ratio keeps improving, because full tracks total state and incremental tracks churn.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a checkpoint is a pair, and what the two checkpointing modes actually upload.`, '',
    `\`take(upto)\` returns a \`Checkpoint(ent, upto)\` — the state and the offset in one value. \`restore(cp, useOffset)\` then shows why they must match: the replay loop starts at \`useOffset + 1\`, so that one expression is the whole correctness of the recovery. Called with ${CHK} it gives ${TOTAL}; called with 0 it gives ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}.`, '',
    `\`uploadVolume\` prices the modes by their arguments: \`countEntries(0, c)\` grows with every checkpoint, \`countEntries(prev + 1, c)\` depends only on the gap. ${CHOSEN.full} against ${CHOSEN.incr}.`],
  sub: `Both restore totals and both upload counts are computed from the seed and asserted.` });

// ---- concept 3: barriers, and three recoveries ----------------------------
PROGRAMS.push({
  name: 'ch07-recovery-memory',
  title: 'Barrier alignment, and three recoveries from one crash',
  subtitle: `${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'} buffered · totals ${TOTAL} / ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} / ${AFTER_CHK}`,
  src: COMMON.concat([
    '',
    'type Align    { buffered, snapshotAt }',
    'type Recovery { total, verdict }',
    '',
    '// primitive: barrierIndex(k) — the index at which source k injects its barrier.',
    `//   barrierIndex("${EARLY_KEY}") = ${barrierAt[EARLY_KEY]}      barrierIndex("${LATE_KEY}") = ${barrierAt[LATE_KEY]}`,
    `// primitive: PREFIX_V — the v already in the checkpoint.  PREFIX_V = ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}`,
    `// primitive: SUFFIX_V — the v after it.  SUFFIX_V = ${AFTER_CHK}`,
    '',
    '// function: align() — the stage snapshots only when the barrier has arrived from',
    '//   EVERY source, buffering anything that overtakes its own barrier meanwhile.',
    `//   align().snapshotAt = ${LAST_BARRIER}      align().buffered = [${BUFFERED.join(', ')}]`,
    'fun align() {',
    '    var latest = 0',
    '    for (k in KEYS) {',
    '        if (barrierIndex(k) > latest) { latest = barrierIndex(k) }',
    '    }',
    '    var held = []',
    '    for (i in 0 .. latest) {',
    '        if (i > barrierIndex(EVENTS[i].key)) { held = append(held, EVENTS[i].id) }',
    '    }',
    '    return Align(held, latest)',
    '}',
    '',
    '// function: recover(hasState, offset) — resume with or without each half of the',
    '//   checkpoint. Only the matching pair reaches the no-crash total.',
    `//   recover(true, CHK) = ${TOTAL}      recover(true, 0) = ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}      recover(false, CHK) = ${AFTER_CHK}`,
    'fun recover(hasState, offset) {',
    '    var total = 0',
    '    if (hasState) { total = PREFIX_V }',
    '    for (i in offset + 1 .. len(EVENTS) - 1) { total = total + EVENTS[i].v }',
    `    if (total == ${TOTAL}) { return Recovery(total, "CORRECT") }`,
    `    if (total > ${TOTAL})  { return Recovery(total, "DOUBLE COUNTED") }`,
    '    return Recovery(total, "LOST THE PREFIX")',
    '}',
    '',
    '// function: errorBound(k) — under at-least-once, how much can be double counted',
    '//   when checkpointing every k events? It is the checkpoint interval, in v.',
    `//   errorBound(1) = ${EVENTS.slice(-1).reduce((s, e) => s + e.v, 0) - EVENTS.slice(-1).reduce((s, e) => s + e.v, 0)}      errorBound(${CHOSEN.k}) = ${EVENTS.slice(-CHOSEN.worst).reduce((s, e) => s + e.v, 0)}      errorBound(${EVENTS.length}) = ${EVENTS.slice(1).reduce((s, e) => s + e.v, 0)}`,
    'fun errorBound(k) {',
    '    var worst = 0',
    '    for (i in 0 .. len(EVENTS) - 1) {',
    '        val since = i % k',
    '        var run = 0',
    '        for (j in i - since + 1 .. i) { run = run + EVENTS[j].v }',
    '        if (run > worst) { worst = run }',
    '    }',
    '    return worst',
    '}',
    '',
    '// function: main() — THE CALLER: alignment, three recoveries, one bound.',
    'fun main() {',
    '    val a       = align()',
    '    val good    = recover(true, CHK)',
    '    val stale   = recover(true, 0)',
    '    val noState = recover(false, CHK)',
    `    val bound   = errorBound(${CHOSEN.k})`,
    '}',
  ]),
  heap: {
    a:       { addr: '0x100', type: 'Align', val: () => `buffered [${BUFFERED.join(', ')}] · snapshotAt ${LAST_BARRIER}` },
    good:    { addr: '0x200', type: 'Recovery', val: () => `${TOTAL} · CORRECT` },
    stale:   { addr: '0x300', type: 'Recovery', val: () => `${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} · DOUBLE COUNTED` },
    noState: { addr: '0x400', type: 'Recovery', val: () => `${AFTER_CHK} · LOST THE PREFIX` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `a = ${o.a || '...'}`, `good = ${o.good || '...'}`, `stale = ${o.stale || '...'}`,
      `noState = ${o.noState || '...'}`, `bound = ${o.bound !== undefined ? o.bound : '...'}`] });
    return [
      { t: 'the stage waits for the LATEST barrier, and buffers meanwhile', line: at('fun align()', 'if (i > barrierIndex(EVENTS[i].key)) { held = append(held, EVENTS[i].id) }'),
        stack: [MAIN(), { name: 'align', locals: [`latest = ${LAST_BARRIER}`, `held = [${BUFFERED.join(', ')}]`, `i = ${LAST_BARRIER}`, `k = "${KEYS[KEYS.length - 1]}"`] }],
        heap: [{ key: 'a', hot: true }],
        cap: `\`latest\` is ${LAST_BARRIER} — source "${LATE_KEY}"'s barrier — while source "${EARLY_KEY}" was ready at ${FIRST_BARRIER}. The condition \`i > barrierIndex(EVENTS[i].key)\` catches records that overtook their OWN barrier: ids ${BUFFERED.join(', ')}. They belong to the next checkpoint, so they are held, not applied.` },
      { t: 'the matching pair reaches the no-crash total', line: at('fun recover(hasState, offset)', `if (total == ${TOTAL}) { return Recovery(total, "CORRECT") }`),
        stack: [MAIN({ a: '@0x100', good: '@0x200' }), { name: 'recover', locals: ['hasState = true', `offset = ${CHK}`, `total = ${TOTAL}`, `i = ${EVENTS.length - 1}`] }],
        heap: [{ key: 'a' }, { key: 'good', hot: true }],
        cap: `\`total\` = PREFIX_V (${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}) plus the ${replayFrom(CHK)} replayed events (${AFTER_CHK}) = ${TOTAL}. That equation is the whole claim a checkpointing design makes: recovery indistinguishable from no failure.` },
      { t: 'and the two half-checkpoints fail in OPPOSITE directions', line: at('    val noState = recover(false, CHK)'),
        stack: [MAIN({ a: '@0x100', good: '@0x200', stale: '@0x300', noState: '@0x400' })],
        heap: [{ key: 'stale', hot: true }, { key: 'noState', hot: true }],
        cap: `Read the two heap rows together: ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} DOUBLE COUNTED and ${AFTER_CHK} LOST THE PREFIX, against a truth of ${TOTAL}. State without the offset over-counts by ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}; the offset without state under-counts by the same ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}. A half-committed checkpoint is wrong, not stale.` },
      { t: 'so the checkpoint interval IS the at-least-once error bound', line: at('fun errorBound(k)', 'if (run > worst) { worst = worst }'.replace('worst = worst', 'worst = run')),
        stack: [MAIN({ a: '@0x100', good: '@0x200', stale: '@0x300', noState: '@0x400', bound: EVENTS.slice(-CHOSEN.worst).reduce((s, e) => s + e.v, 0) }),
                { name: 'errorBound', locals: [`k = ${CHOSEN.k}`, `worst = ${EVENTS.slice(-CHOSEN.worst).reduce((s, e) => s + e.v, 0)}`, `i = ${EVENTS.length - 1}`, `since = ${(EVENTS.length - 1) % CHOSEN.k}`, `j = ${EVENTS.length - 1}`, 'run = (a partial sum)'] }],
        heap: [{ key: 'good' }],
        cap: `\`errorBound\` sums the v of the events since the last checkpoint and keeps the largest — ${EVENTS.slice(-CHOSEN.worst).reduce((s, e) => s + e.v, 0)} at k = ${CHOSEN.k}. Note what it takes as its only argument: \`k\`. The interval chosen in the previous concept for I/O and recovery time also sets how wrong an at-least-once answer can be.` },
    ];
  },
  intro: [
    `**What is being answered.** What barrier alignment costs, and why half a checkpoint is wrong rather than stale.`, '',
    `\`align()\` measures the cost in records: source "${EARLY_KEY}" is ready at index ${FIRST_BARRIER}, "${LATE_KEY}" at ${LAST_BARRIER}, and the condition \`i > barrierIndex(EVENTS[i].key)\` collects the ${BUFFERED.length} record${BUFFERED.length === 1 ? '' : 's'} that overtook their own barrier.`, '',
    `\`recover(hasState, offset)\` then runs the same crash three ways: ${TOTAL} correct, ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} double-counted, ${AFTER_CHK} with the prefix lost. The two failures are symmetric around the truth, which is the argument for atomicity. And \`errorBound(k)\` takes only \`k\` — the interval is the error bound.`],
  sub: `The alignment buffer, all three recovery totals and the error bound are computed from the seed and asserted.` });

// ---- concept 4: the checkpointing design ----------------------------------
PROGRAMS.push({
  name: 'ch07-system-memory',
  title: 'Checkpointing a stateful processor — the full cycle',
  subtitle: `${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded + ${AFTER_CHK} replayed = ${TOTAL} · local store vs durable checkpoint`,
  src: COMMON.concat([
    '',
    'type Store      { entries, durable }',
    'type Checkpoint { entries, offset }',
    'type Run        { total, entries, replayed }',
    '',
    '// primitive: entryOf(e) — the (key, window) pair this event belongs to.',
    `//   entryOf(EVENTS[0]) = "${entryOf(EVENTS[0])}"`,
    `// primitive: PREFIX_V — the v inside the checkpoint at CHK.  PREFIX_V = ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}`,
    '',
    '// function: applyTo(store, e) — the processor\'s whole steady-state behaviour.',
    `//   applyTo(a fresh store, EVENTS[0]) sets entries["${entryOf(EVENTS[0])}"] : 0 -> ${EVENTS[0].v}`,
    'fun applyTo(store, e) {',
    '    val id = entryOf(e)',
    '    if (store.entries[id] == NONE) { store.entries[id] = 0 }',
    '    store.entries[id] = store.entries[id] + e.v',
    '    return store',
    '}',
    '',
    '// primitive: copyOf(m) — a snapshot of the map, not a reference to it.',
    `//   copyOf({"${entryOf(EVENTS[0])}": ${EVENTS[0].v}}) = {"${entryOf(EVENTS[0])}": ${EVENTS[0].v}}`,
    '',
    '// function: commit(store, offset, atomic) — write the state and the offset to',
    '//   DURABLE storage. The local store survives a restart; it does not survive the',
    '//   machine, which is why this exists at all.',
    `//   commit(store, CHK, true).offset = ${CHK}`,
    '//   commit(store, CHK, false) may land the state WITHOUT the offset',
    'fun commit(store, offset, atomic) {',
    '    var cp = Checkpoint(copyOf(store.entries), offset)',
    '    if (atomic == false) { cp.offset = 0 }            // crashed between the two writes',
    '    return cp',
    '}',
    `// primitive: countOf(m) — how many keys the map has.  countOf(the full state) = ${ENTRIES.length}`,
    '',
    '// function: resume(cp) — load the state, seek to the offset, replay the rest.',
    `//   resume(commit(store, CHK, true)).total = ${TOTAL}      resume(commit(store, CHK, false)).total = ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}`,
    'fun resume(cp) {',
    '    var store = Store(copyOf(cp.entries), true)',
    '    var n = 0',
    '    for (i in cp.offset + 1 .. len(EVENTS) - 1) {',
    '        store = applyTo(store, EVENTS[i])',
    '        n = n + 1',
    '    }',
    '    var total = 0',
    '    for (id in store.entries) { total = total + store.entries[id] }',
    '    return Run(total, countOf(store.entries), n)',
    '}',
    '// function: main() — THE CALLER: run, checkpoint, crash, resume — twice.',
    'fun main() {',
    '    var store = Store({}, false)',
    '    for (i in 0 .. CHK) { store = applyTo(store, EVENTS[i]) }',
    '    val cpGood = commit(store, CHK, true)',
    '    val cpTorn = commit(store, CHK, false)',
    '    val good   = resume(cpGood)',
    '    val torn   = resume(cpTorn)',
    '}',
  ]),
  heap: {
    store:  { addr: '0x100', type: 'Store', val: () => `${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries holding ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} · durable false` },
    cpGood: { addr: '0x200', type: 'Checkpoint', val: () => `${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries · offset ${CHK}` },
    good:   { addr: '0x300', type: 'Run', val: () => `total ${TOTAL} · ${ENTRIES.length} entries · replayed ${replayFrom(CHK)}` },
    torn:   { addr: '0x400', type: 'Run', val: () => `total ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} · replayed ${EVENTS.length - 1}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: ['store = @0x100', `i = ${o.i !== undefined ? o.i : '...'}`,
      `cpGood = ${o.cpGood || '...'}`, `cpTorn = ${o.cpTorn || '...'}`,
      `good = ${o.good || '...'}`, `torn = ${o.torn || '...'}`] });
    return [
      { t: 'steady state: one entry per (key, window), updated in place', line: at('fun applyTo(store, e)', 'store.entries[id] = store.entries[id] + e.v'),
        stack: [MAIN({ i: CHK }), { name: 'applyTo', locals: ['store = @0x100', `e = EVENTS[${CHK}]`, `id = "${entryOf(EVENTS[CHK])}"`] }],
        heap: [{ key: 'store', hot: true }],
        cap: `After ${CHK + 1} events the local store holds ${new Set(EVENTS.slice(0, CHK + 1).map(entryOf)).size} entries totalling ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)}, and \`durable\` is **false** — it is on local disk, fast and doomed with the machine. That flag is the distinction the next step exists for.` },
      { t: 'the commit writes state and offset to durable storage', line: at('fun commit(store, offset, atomic)', 'var cp = Checkpoint(copyOf(store.entries), offset)'),
        stack: [MAIN({ i: CHK, cpGood: '@0x200' }), { name: 'commit', locals: ['store = @0x100', `offset = ${CHK}`, 'atomic = true', 'cp = @0x200'] }],
        heap: [{ key: 'store' }, { key: 'cpGood', hot: true }],
        cap: `\`copyOf\` is deliberate: the checkpoint is a SNAPSHOT, not a reference, so the processor can keep mutating its store while the upload proceeds. And the Checkpoint carries \`offset\` = ${CHK} alongside the entries — the pair, in one durable value.` },
      { t: 'resuming from the intact pair reproduces the no-crash run', line: at('fun resume(cp)', 'for (i in cp.offset + 1 .. len(EVENTS) - 1) {'),
        stack: [MAIN({ i: CHK, cpGood: '@0x200', cpTorn: 'offset 0', good: '@0x300' }), { name: 'resume', locals: ['cp = @0x200', 'store = (restored)', `n = ${replayFrom(CHK)}`, `i = ${EVENTS.length - 1}`, `total = ${TOTAL}`] }],
        heap: [{ key: 'cpGood' }, { key: 'good', hot: true }],
        cap: `The loop starts at \`cp.offset + 1\` = ${CHK + 1} and runs ${replayFrom(CHK)} times. \`total\` ends at ${TOTAL} across ${ENTRIES.length} entries — identical to a run that never crashed. ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} loaded plus ${AFTER_CHK} replayed, and that equation is the design's whole claim.` },
      { t: 'a torn commit replays the prefix and over-counts', line: at('if (atomic == false) { cp.offset = 0 }            // crashed between the two writes'),
        stack: [MAIN({ i: CHK, cpGood: '@0x200', cpTorn: 'offset 0', good: '@0x300', torn: '@0x400' }),
                { name: 'commit', locals: ['store = @0x100', `offset = ${CHK}`, 'atomic = false', 'cp = (offset 0)'] }],
        heap: [{ key: 'good' }, { key: 'torn', hot: true }],
        cap: `With \`atomic\` false the entries landed and the offset did not, so \`resume\` replays from index 1 and \`torn.total\` reaches ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} — over by the whole ${EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} the checkpoint already held. The design REQUIRES this commit to be atomic and does not itself provide that.` },
    ];
  },
  intro: [
    `**What is being answered.** The full checkpoint cycle — steady state, commit, crash, resume — and the one requirement the design does not supply.`, '',
    `Two details are worth watching. \`store.durable\` is **false**: the local state store is fast and dies with the machine, which is why \`commit\` exists at all. And \`copyOf\` makes the checkpoint a snapshot rather than a reference, so the processor can keep working while the upload runs.`, '',
    `Step 4 is the requirement stated as code: \`if (atomic == false) { cp.offset = 0 }\`. The entries landed and the offset did not, so \`torn.total\` reaches ${TOTAL + EVENTS.slice(0, CHK + 1).reduce((s, e) => s + e.v, 0)} against ${TOTAL}. This design assumes that commit is atomic; it does not make it so.`],
  sub: `Both run totals and the entry counts are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch07.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch07.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
