#!/usr/bin/env node
'use strict';
/* gen_ch05.js — ch05's four concepts, both bands each: what exactly-once means,
 * idempotency and dedup, side effects, and the payment pipeline.
 *
 * The finding this chapter rests on, derived rather than asserted: for a pure
 * AGGREGATION a deduplicating shuffle and an idempotent sink are REDUNDANT —
 * either one alone reaches the right total. For a SIDE EFFECT they are not, because
 * a duplicate can be created after the dedup point. Both are computed here. */
const path = require('path');
const { buildDiagramWalkthrough } = require('./diagramkit.js');
const { buildMemoryWalkthrough } = require('./memkit.js');
const S = require('./stream_seed.js');
const { EVENTS, LAG, WIN, WATERMARKS, WINDOWS, WIN_STARTS, winOf, SUM, hhmmss } = S;

// ---------------------------- DERIVED, THEN ASSERTED ------------------------
const TOTAL = EVENTS.reduce((s, e) => s + e.v, 0);
const mm = (sec) => hhmmss(sec).slice(0, 5);
const secs = (n) => `${n}s`;
// what ONE duplicate does to its own window, per event
const dupDamage = EVENTS.map(e => {
  const w = winOf(e.et), base = SUM(WINDOWS[w]);
  return { e, w, base, after: base + e.v, pct: Math.round(100 * e.v / base) };
}).sort((a, b) => b.pct - a.pct);
const WORST_DUP = dupDamage[0];
// the crash-and-replay scenario: the pipeline checkpoints its STATE after event
// CHK but the source offset is not committed, so CHK+1 .. end are re-read
const CHK = WATERMARKS.findIndex(w => w >= WIN_STARTS[0] + WIN);     // a real pipeline moment
const REPLAYED = EVENTS.slice(CHK + 1);
const REPLAY_V = REPLAYED.reduce((s, e) => s + e.v, 0);
// the 2x2x2 table: replayable source, deduplicating shuffle, idempotent sink
const outcome = (replay, dedup, idem) => {
  if (!replay) return { total: TOTAL - REPLAY_V, label: 'LOST', why: `${REPLAYED.length} records after the checkpoint are never re-read` };
  if (dedup || idem) return { total: TOTAL, label: 'CORRECT', why: dedup && idem ? 'both guards, either would do' : dedup ? 'the shuffle recognised the replayed ids' : 'the sink SET the window total rather than adding to it' };
  return { total: TOTAL + REPLAY_V, label: 'DOUBLE', why: `${REPLAYED.length} records applied twice` };
};
const TABLE = [];
for (const replay of [true, false]) for (const dedup of [true, false]) for (const idem of [true, false])
  TABLE.push({ replay, dedup, idem, ...outcome(replay, dedup, idem) });
const CORRECT_ROWS = TABLE.filter(r => r.label === 'CORRECT');
const REDUNDANT = CORRECT_ROWS.some(r => r.dedup && !r.idem) && CORRECT_ROWS.some(r => !r.dedup && r.idem);
// the SIDE EFFECT case: three crash windows, and which guard covers each
const ORDER = EVENTS.find(e => e.id === 4);                   // the charge this chapter follows
const CRASH_WINDOWS = [
  { at: 'before the shuffle', dedupCovers: true,  keyCovers: true,  what: 'the record is re-sent and the shuffle recognises its id' },
  { at: 'after the shuffle, before the charge', dedupCovers: false, keyCovers: true, what: 'the id is already past the dedup set; the replay sends a NEW copy that dedup has not seen' },
  { at: 'after the charge, before the offset commit', dedupCovers: false, keyCovers: true, what: 'the charge happened; only the external system can know that' },
];
const DEDUP_COVERS = CRASH_WINDOWS.filter(c => c.dedupCovers).length;
const KEY_COVERS = CRASH_WINDOWS.filter(c => c.keyCovers).length;
// isolating the effect: a 4-stage pipeline, effect at stage k, exposed to crashes
// in stages k..4
const STAGES = ['source', 'shuffle', 'aggregate', 'sink'];
const exposure = (k) => STAGES.length - k + 1;
const EXPOSE_EARLY = exposure(2), EXPOSE_LATE = exposure(STAGES.length);
const fail = (m) => { throw new Error(`gen_ch05: ${m}`); };
if (WORST_DUP.pct < 50) fail(`the worst single duplicate only inflates its window by ${WORST_DUP.pct}% — not enough to make the stakes concrete`);
if (!REPLAYED.length) fail('the checkpoint is at the end of the stream; there is nothing to replay');
if (new Set(TABLE.map(r => r.total)).size !== 3) fail(`the 2x2x2 table produces ${new Set(TABLE.map(r => r.total)).size} distinct totals, expected 3 (lost / correct / double)`);
if (!REDUNDANT) fail('dedup and an idempotent sink are not redundant for the aggregation — the chapter\'s refinement does not hold');
if (DEDUP_COVERS >= KEY_COVERS) fail(`dedup covers ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} crash windows and the key covers ${KEY_COVERS} — the side-effect contrast needs the key to cover strictly more`);
if (EXPOSE_LATE >= EXPOSE_EARLY) fail('moving the effect later does not reduce its exposure');
if (TOTAL + REPLAY_V === TOTAL) fail('replaying changes nothing');

const W = 1140;

// ==================== CONCEPT 1 — WHAT EXACTLY-ONCE MEANS ===================
const C1 = [
  { t: 'accuracy and completeness are two different failures', draw: (c) =>
      c.panel('TWO WAYS TO BE WRONG, WITH THE SAME DATA', 'a')
      + c.mapRows('ac', c.P.main.x + 24, c.P.main.y + 52, [
        [`the truth`, `${EVENTS.length} events, total ${TOTAL}`],
        [`INCOMPLETE — ${REPLAYED.length} records lost after a crash`, `total ${TOTAL - REPLAY_V} · ${Math.round(100 * REPLAY_V / TOTAL)}% low`],
        [`INACCURATE — the same ${REPLAYED.length} records applied twice`, `total ${TOTAL + REPLAY_V} · ${Math.round(100 * REPLAY_V / TOTAL)}% high`],
        [`exactly-once means neither`, `each record's contribution appears once, no more and no less`],
      ], { w: 1040, rh: 36, hot: 3, label: 'a correct pipeline is accurate AND complete; losing and duplicating are separate bugs' })
      + c.note('a1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The two failures are symmetric in size here (${REPLAY_V} either way) and opposite in sign, which is why one can mask the other in an aggregate.`,
        `They have different causes too: completeness fails when a source cannot be replayed, accuracy fails when a replay is not deduplicated.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Exactly-once is two guarantees, not one. Losing ${REPLAYED.length} records takes the total to ${TOTAL - REPLAY_V}; applying the same ${REPLAYED.length} twice takes it to ${TOTAL + REPLAY_V}. Both are ${Math.round(100 * REPLAY_V / TOTAL)}% wrong and neither is detectable from the number alone — and they are fixed by different mechanisms, at different stages.` },
  { t: 'one duplicate record, and what it does to a window', draw: (c) => {
      let s = c.panel('EVERY EVENT, DELIVERED TWICE — WHAT ITS OWN WINDOW READS', 'a');
      dupDamage.forEach((d, i) => {
        const y = c.P.main.y + 58 + i * 30, worst = i === 0;
        s += c.cv.rect('dd' + i, c.P.main.x + 24, y, 1040, 26, { fill: worst ? c.C.hotFill : c.C.paper, stroke: worst ? c.C.hot : c.C.faint, rx: 3, sw: worst ? 2 : 1 });
        s += c.cv.text(c.P.main.x + 40, y + 18, `id ${d.e.id} (v ${d.e.v}) in window [${mm(d.w)}, ${mm(d.w + WIN)})`, { size: 11, weight: worst ? 700 : 400, band: 'ddk' + i });
        s += c.cv.text(c.P.main.x + 440, y + 18, `${d.base} → ${d.after}`, { size: 11, band: 'ddv' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 18, `+${d.pct}%`, { size: 11, anchor: 'end', weight: 700, fill: worst ? c.C.hot : c.C.ink, band: 'ddp' + i });
      });
      return s + c.note('d1', c.P.main.x + 24, c.P.main.y + 72 + dupDamage.length * 30, 1040, [
        `A single duplicated record moves its window by between ${dupDamage[dupDamage.length - 1].pct}% and ${WORST_DUP.pct}%. The damage is \`v\` divided by the window's total, so a SMALL window is the fragile one.`,
        `id ${WORST_DUP.e.id} is the worst case here: ${WORST_DUP.base} → ${WORST_DUP.after}. Nothing about that record is special — its window is just thin.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `The cost of one duplicate is not a fixed percentage — it is \`v\` over the window's total, so the same retry is a ${dupDamage[dupDamage.length - 1].pct}% error in one window and a ${WORST_DUP.pct}% error in another. That is worth knowing because it means duplicate damage concentrates in the thin windows, which are exactly the ones nobody is watching.` },
  { t: 'retries are the enemy, and they are not optional', draw: (c) =>
      c.panel('WHY DUPLICATES EXIST AT ALL', 'a')
      + c.mapRows('rt', c.P.main.x + 24, c.P.main.y + 52, [
        [`a worker crashes mid-batch`, `the batch is re-sent — its records arrive twice`],
        [`a send times out but SUCCEEDED`, `the sender cannot tell, so it retries`],
        [`a checkpoint commits state but not the offset`, `the source re-reads from the old offset`],
        [`the alternative — never retry`, `every one of those becomes LOST data instead`],
      ], { w: 1040, rh: 36, hot: 3, label: 'three ordinary events, each producing a duplicate' })
      + c.note('r1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The last row is why "just do not retry" is not a design. Without retries a timeout becomes a loss, and completeness fails instead of accuracy.`,
        `So a distributed pipeline is at-least-once by default, and exactly-once is something built ON TOP of retries, never instead of them.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Retries are not a flaw to be removed. A timed-out send that actually succeeded is indistinguishable from one that failed, so the sender must choose between retrying (risking a duplicate) and not retrying (risking a loss). Exactly-once is the property that makes the first choice safe — it is built on top of at-least-once, not as an alternative to it.` },
  { t: 'and exactly-once STATE is easy; exactly-once EFFECTS are not', draw: (c) =>
      c.panel('TWO SUB-PROBLEMS, VERY DIFFERENT DIFFICULTY', 'p')
      + c.mapRows('sp', c.P.main.x + 24, c.P.main.y + 52, [
        [`per-key STATE — window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)})`, `recompute it: SET the total to ${WORST_DUP.base}. Idempotent by construction.`],
        [`an external EFFECT — charge order ${ORDER.id} for ${ORDER.v}`, `cannot be recomputed. The money has moved.`],
        [`so the problem splits into`, `dedup records BETWEEN stages, and make the final effect idempotent`],
        [`and the hard half is the second`, `the outside world does not support "recompute"`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the same guarantee, two completely different mechanisms' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Window state is a deterministic function of the records, so a retry that recomputes it lands on the same value — ${WORST_DUP.base} either way.`,
        `A charge is not a function of anything the pipeline holds. Once it has happened, only the external system knows, and the pipeline must ask.`,
      ], c.C.hot, c.C.hotFill),
    cap: `This split is the chapter's structure. Making per-key state exactly-once is nearly free: the state is a deterministic function of the records, so recomputing gives ${WORST_DUP.base} every time. Making an external effect exactly-once is a different problem entirely — the money has moved, nothing in the pipeline records that, and the only system that knows is the one you are calling.` },
];

// ================= CONCEPT 2 — IDEMPOTENCY AND DEDUPLICATION ================
const C2 = [
  { t: 'idempotent means "twice is the same as once"', draw: (c) =>
      c.panel('TWO OPERATIONS, APPLIED TWICE', 'a')
      + c.mapRows('id', c.P.main.x + 24, c.P.main.y + 52, [
        [`SET window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)}) = ${WORST_DUP.base}`, `once: ${WORST_DUP.base} · twice: ${WORST_DUP.base} — idempotent`],
        [`ADD ${WORST_DUP.e.v} to that window`, `once: ${WORST_DUP.base} · twice: ${WORST_DUP.after} — NOT idempotent`],
        [`what makes the difference`, `SET names the RESULT; ADD names a change to whatever is there`],
        [`so an idempotent sink needs`, `a value that does not depend on the sink's current contents`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the distinction is about what the operation names, not about the data' })
      + c.note('i1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `An accumulating pane (ch02) is a SET: it carries the window's whole total, so re-delivering it is harmless.`,
        `A discarding pane is an ADD: it carries only the delta, so re-delivering it double-counts. The accumulation mode decides whether your sink can be idempotent at all.`,
      ], c.C.good, c.C.goodFill),
    cap: `The test for idempotency is whether the operation names a result or a change. \`SET = ${WORST_DUP.base}\` is a result and survives any number of retries; \`ADD ${WORST_DUP.e.v}\` is a change and does not. The note connects this back to ch02: accumulating panes are SETs and discarding panes are ADDs, so that choice decides whether an idempotent sink is even possible.` },
  { t: 'dedup at the shuffle: a set of ids already seen', draw: (c) => {
      let s = c.panel(`THE SHUFFLE RECEIVES THE REPLAY — ids ${REPLAYED.map(e => e.id).join(', ')} ARRIVE A SECOND TIME`, 'a');
      s += c.mapRows('dh', c.P.main.x + 24, c.P.main.y + 52, [
        [`records delivered to the shuffle`, `${EVENTS.length} first time + ${REPLAYED.length} replayed = ${EVENTS.length + REPLAYED.length}`],
        [`the seen-set after the first pass`, `${EVENTS.length} ids`],
        [`replayed records recognised`, `${REPLAYED.length} of ${REPLAYED.length} — dropped`],
        [`total reaching the aggregate`, `${TOTAL} — correct`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the receiver keeps every id it has accepted and drops repeats' });
      return s + c.note('h1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `This requires the records to carry STABLE ids. A record whose id is generated at send time gets a new one on the retry, and dedup cannot see it.`,
        `And the seen-set is state: it grows with the number of records, so it needs its own bound — usually a window, which means dedup only works within that window.`,
      ], c.C.warn, c.C.warnFill); },
    cap: `Dedup at the shuffle is a seen-set and one membership test, and it works — ${TOTAL}, correct. The two things that make it not free are in the note: the ids must be stable across the retry (a freshly generated id defeats it entirely), and the set itself is unbounded state that needs a horizon, so dedup has a memory beyond which it stops working.` },
  { t: 'the 8 combinations, and what each one actually produces', draw: (c) => {
      let s = c.panel('REPLAYABLE SOURCE x DEDUP SHUFFLE x IDEMPOTENT SINK', 'a');
      s += c.line(c.P.main.x + 24, c.P.main.y + 46, `after a crash at event ${CHK}, with the state committed and the offset not`, { size: 11, weight: 700, fill: c.C.line });
      TABLE.forEach((r, i) => {
        const y = c.P.main.y + 64 + i * 30;
        const col = r.label === 'CORRECT' ? c.C.good : c.C.hot, fil = r.label === 'CORRECT' ? c.C.goodFill : c.C.hotFill;
        s += c.cv.rect('tb' + i, c.P.main.x + 24, y, 1040, 26, { fill: fil, stroke: col, rx: 3, sw: 2 });
        s += c.cv.text(c.P.main.x + 40, y + 18, `source ${r.replay ? 'replayable' : 'not replayable'} · shuffle ${r.dedup ? 'dedups' : 'plain'} · sink ${r.idem ? 'idempotent' : 'adds'}`, { size: 10, band: 'tbk' + i });
        s += c.cv.text(c.P.main.x + 700, y + 18, `total ${r.total}`, { size: 11, weight: 700, band: 'tbv' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 18, r.label, { size: 10, anchor: 'end', weight: 700, fill: col, band: 'tbl' + i });
      });
      return s + c.note('t1', c.P.main.x + 24, c.P.main.y + 78 + TABLE.length * 30, 1040, [
        `${CORRECT_ROWS.length} of the ${TABLE.length} rows reach ${TOTAL}. Read them: a replayable source is REQUIRED, and then dedup OR an idempotent sink is enough — they are redundant here.`,
        `Only three totals exist: ${TOTAL - REPLAY_V} (lost), ${TOTAL} (correct) and ${TOTAL + REPLAY_V} (doubled). The source protects completeness; the other two protect accuracy.`,
      ], c.C.blue, c.C.blueFill); },
    cap: `Worth reading carefully, because it refines the usual claim. "End-to-end exactly-once = source + shuffle + sink, drop any one and it breaks" is not quite right for an aggregation: the source is load-bearing, and dedup and an idempotent sink are **redundant** — either alone reaches ${TOTAL}. The next concept is where that redundancy disappears.` },
  { t: 'a replayable source is the one piece with no substitute', draw: (c) =>
      c.panel('WHY THE SOURCE IS DIFFERENT', 'p')
      + c.mapRows('sr', c.P.main.x + 24, c.P.main.y + 52, [
        [`what a replayable source gives`, `re-read from a committed offset — ids ${REPLAYED.map(e => e.id).join(', ')} are available again`],
        [`without it, after the crash`, `those ${REPLAYED.length} records are gone: total ${TOTAL - REPLAY_V}`],
        [`can dedup recover them?`, `no — dedup only ever removes records`],
        [`can an idempotent sink?`, `no — it only makes re-applying safe`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the two accuracy mechanisms cannot create a record that was never re-read' })
      + c.note('s1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Dedup and idempotency are both SUBTRACTIVE: they stop a contribution counting twice. Neither can add a contribution back.`,
        `So completeness has exactly one mechanism — replay — and accuracy has two. That asymmetry is why "replayable source" is the first requirement on the list rather than one of three equals.`,
      ], c.C.good, c.C.goodFill),
    cap: `The asymmetry in the note is the practical takeaway. Dedup and idempotency are subtractive — they prevent double counting and can do nothing else — so the only mechanism for completeness is a source you can re-read. If a source cannot replay, no amount of care downstream gets you past ${TOTAL - REPLAY_V}.` },
];

// ===================== CONCEPT 3 — SIDE EFFECTS =============================
const C3 = [
  { t: 'a side effect cannot be recomputed', draw: (c) =>
      c.panel('STATE VS EFFECT, ON THE SAME RETRY', 'a')
      + c.mapRows('se', c.P.main.x + 24, c.P.main.y + 52, [
        [`per-key state: window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)})`, `recompute from the records → ${WORST_DUP.base}, every time`],
        [`side effect: charge order ${ORDER.id} for ${ORDER.v}`, `re-run → charged ${ORDER.v * 2}. There is no recompute.`],
        [`why the difference`, `the state is a FUNCTION of the records; the charge is not`],
        [`and the pipeline cannot tell`, `a timed-out charge that succeeded looks exactly like one that failed`],
      ], { w: 1040, rh: 36, hot: 1, label: 'the same retry, two completely different outcomes' })
      + c.note('e1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Nothing the pipeline holds records that the charge happened — that fact lives in the payment processor.`,
        `So the pipeline has only two options: make the effect safe to repeat, or ask the external system whether it already happened. Those are the same thing.`,
      ], c.C.hot, c.C.hotFill),
    cap: `The asymmetry is total. Recomputing window state gives ${WORST_DUP.base} however many times you do it, because the state is a function of the records. Re-running a charge gives ${ORDER.v * 2}, because the money moved and nothing in the pipeline knows. And the pipeline cannot distinguish a timed-out charge that succeeded from one that failed — so it must either make repetition safe, or ask.` },
  { t: 'an idempotency key moves the dedup OUTSIDE', draw: (c) =>
      c.panel('THE SAME RETRY, WITH AN IDEMPOTENCY KEY', 'a')
      + c.mapRows('ik', c.P.main.x + 24, c.P.main.y + 52, [
        [`first attempt`, `charge("order-${ORDER.id}", ${ORDER.v}) → processor records the key, charges ${ORDER.v}`],
        [`the pipeline crashes before committing`, `it does not know whether the charge landed`],
        [`the retry`, `charge("order-${ORDER.id}", ${ORDER.v}) → processor RECOGNISES the key`],
        [`result`, `charged ${ORDER.v} total, and the retry returns the first attempt's answer`],
      ], { w: 1040, rh: 36, hot: 3, label: 'the external system does the deduplication, because only it can' })
      + c.note('k1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `The key must be derived from the DATA (the order id), not generated at send time — a fresh key on the retry is a second charge with extra steps.`,
        `And this works only because the processor offers it. If the external system has no idempotency key, no amount of pipeline engineering supplies one.`,
      ], c.C.good, c.C.goodFill),
    cap: `An idempotency key does not make the effect idempotent — it moves the deduplication to the only place that can see both attempts. Two requirements follow, both in the note: the key must come from the data (a send-time key is useless), and the external system has to support it. The second is a dependency you cannot work around from inside.` },
  { t: 'so dedup covers 1 of 3 crash windows, the key covers 3', draw: (c) => {
      let s = c.panel(`WHERE THE PIPELINE CAN CRASH WHILE CHARGING ORDER ${ORDER.id}`, 'a');
      CRASH_WINDOWS.forEach((cw, i) => {
        const y = c.P.main.y + 58 + i * 48;
        s += c.cv.rect('cw' + i, c.P.main.x + 24, y, 1040, 44, { fill: cw.dedupCovers ? c.C.goodFill : c.C.hotFill, stroke: cw.dedupCovers ? c.C.good : c.C.hot, rx: 3, sw: 2 });
        s += c.cv.text(c.P.main.x + 40, y + 19, `crash ${cw.at}`, { size: 11, weight: 700, band: 'cwk' + i });
        s += c.cv.text(c.P.main.x + 40, y + 36, cw.what, { size: 10, mono: false, fill: c.C.line, band: 'cww' + i });
        s += c.cv.text(c.P.main.x + 790, y + 27, `dedup: ${cw.dedupCovers ? 'covers' : 'MISSES'}`, { size: 10, weight: 700, fill: cw.dedupCovers ? c.C.good : c.C.hot, band: 'cwd' + i });
        s += c.cv.text(c.P.main.x + 1050, y + 27, `key: covers`, { size: 10, anchor: 'end', weight: 700, fill: c.C.good, band: 'cwi' + i });
      });
      return s + c.note('c1', c.P.main.x + 24, c.P.main.y + 72 + CRASH_WINDOWS.length * 48, 1040, [
        `A deduplicating shuffle covers ${DEDUP_COVERS} of the ${CRASH_WINDOWS.length} windows; an idempotency key covers ${KEY_COVERS} of ${CRASH_WINDOWS.length}.`,
        `This is where the redundancy from the previous concept disappears: for an AGGREGATION either guard sufficed, and for a SIDE EFFECT only the external one does.`,
      ], c.C.hot, c.C.hotFill); },
    cap: `This is the concept's whole argument in one table. For a pure aggregation, dedup and an idempotent sink were interchangeable. For a side effect they are not: dedup covers only the crash BEFORE the dedup point, and the two crash windows after it — record in flight, and charge completed — are reachable only by the external system's own key. ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} against ${KEY_COVERS} of ${CRASH_WINDOWS.length}.` },
  { t: 'and isolating the effect at the boundary shrinks its exposure', draw: (c) =>
      c.panel('WHERE TO PUT THE SIDE EFFECT IN A FOUR-STAGE PIPELINE', 'p')
      + c.mapRows('is', c.P.main.x + 24, c.P.main.y + 52, STAGES.map((st, i) =>
          [`effect at stage ${i + 1} (${st})`, `a crash in any of ${exposure(i + 1)} stage${exposure(i + 1) > 1 ? 's' : ''} can re-run it`]),
        { w: 1040, rh: 34, hot: STAGES.length - 1, label: `stages: ${STAGES.join(' → ')}` })
      + c.note('i2', c.P.main.x + 24, c.P.main.y + 66 + STAGES.length * 34, 1040, [
        `An effect at stage 2 is exposed to crashes in ${EXPOSE_EARLY} stages; at the last stage, ${EXPOSE_LATE}. That is a ${EXPOSE_EARLY / EXPOSE_LATE}x reduction from placement alone.`,
        `It does not make the effect exactly-once — it reduces how many failures can repeat it, and keeps the computation above it pure and freely retryable.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Placement is the cheapest of the three mechanisms and the only one that needs no cooperation. An effect at stage 2 can be re-run by a crash in ${EXPOSE_EARLY} stages; at stage ${STAGES.length} only ${EXPOSE_LATE} can reach it — a ${EXPOSE_EARLY / EXPOSE_LATE}× reduction. And everything upstream stays pure, which means it can be retried without a thought.` },
];

// ============== CONCEPT 4 — THE PAYMENT PIPELINE (systemDesign) =============
const C4 = [
  { t: 'the pipeline, and the one stage that touches the world', draw: (c) =>
      c.panel('CHARGE A CARD EXACTLY ONCE — FOUR STAGES', 'a')
      + c.mapRows('pp', c.P.main.x + 24, c.P.main.y + 52, [
        [`replayable source (offset)`, `re-readable from a committed offset — protects COMPLETENESS`],
        [`dedup shuffle`, `a seen-set of record ids — protects accuracy for ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} crash windows`],
        [`idempotent sink (idempotency key)`, `key "order-${ORDER.id}", derived from the data — covers ${KEY_COVERS} of ${CRASH_WINDOWS.length}`],
        [`external system`, `the only component that can know the charge happened`],
      ], { w: 1040, rh: 36, hot: 2, label: 'three guards, and the one place the truth actually lives' })
      + c.note('p1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `Only the last stage is outside the pipeline, and it holds the one fact that matters: whether order-${ORDER.id} has already been charged.`,
        `Every mechanism in the first three stages is about not having to know that — and only the idempotency key actually asks.`,
      ], c.C.blue, c.C.blueFill),
    cap: `Four stages, and the design's whole difficulty is that the decisive fact lives in the fourth. The source protects completeness and has no substitute; the dedup shuffle covers ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} crash windows; the idempotency key covers ${KEY_COVERS}. Note that the third mechanism depends on the external system offering it — the design has a dependency it cannot satisfy itself.` },
  { t: `the retry, traced — order ${ORDER.id} charged once`, draw: (c) =>
      c.panel(`THE CRASH-AND-RETRY SEQUENCE FOR ORDER ${ORDER.id} (amount ${ORDER.v})`, 'a')
      + c.mapRows('sq', c.P.main.x + 24, c.P.main.y + 52, [
        [`1. record id ${ORDER.id} passes the dedup shuffle`, `seen-set gains id ${ORDER.id}`],
        [`2. sink calls charge("order-${ORDER.id}", ${ORDER.v})`, `processor charges ${ORDER.v} and records the key`],
        [`3. the pipeline crashes before committing the offset`, `the charge happened; the pipeline does not know it`],
        [`4. replay re-reads from the old offset`, `record id ${ORDER.id} arrives again — and the seen-set was lost with the crash`],
        [`5. sink calls charge("order-${ORDER.id}", ${ORDER.v}) again`, `processor recognises the key → no second charge`],
        [`total charged`, `${ORDER.v}, not ${ORDER.v * 2}`],
      ], { w: 1040, rh: 34, hot: 4, label: 'five steps, one charge' })
      + c.note('q1', c.P.main.x + 24, c.P.main.y + 276, 1040, [
        `Step 4 is the one that defeats dedup: the seen-set was in memory and died with the process, so the replayed record looks new.`,
        `Only the key survives the crash, because it lives in the processor. That is why the key is the mechanism and the shuffle is an optimisation.`,
      ], c.C.hot, c.C.hotFill),
    cap: `Step 4 is where the earlier redundancy breaks down concretely: the dedup seen-set lived in the crashed process, so after the restart the replayed record is indistinguishable from a new one. The only state that survived the crash is in the payment processor, and the only mechanism that reads it is the idempotency key. Total charged ${ORDER.v}, not ${ORDER.v * 2}.` },
  { t: 'two-phase commit is the alternative, and it is worse', draw: (c) =>
      c.panel('IDEMPOTENT EFFECT VS DISTRIBUTED TRANSACTION', 'a')
      + c.mapRows('tp', c.P.main.x + 24, c.P.main.y + 52, [
        [`idempotent effect (an idempotency key)`, `one round trip · the processor decides · retry is free`],
        [`two-phase commit`, `prepare + commit · a coordinator must not fail between them`],
        [`what 2PC buys`, `exactly-once even when the external system has no key`],
        [`what it costs`, `a blocking coordinator, and an in-doubt state with no safe default`],
      ], { w: 1040, rh: 36, hot: 0, label: 'both reach exactly-once; one of them keeps working when something fails' })
      + c.note('t1', c.P.main.x + 24, c.P.main.y + 212, 1040, [
        `A coordinator that dies after "prepare" leaves the charge in doubt: committing may double-charge, aborting may lose a legitimate payment.`,
        `So prefer an idempotent effect whenever the external system allows one, and treat 2PC as what you do when it does not.`,
      ], c.C.warn, c.C.warnFill),
    cap: `Two-phase commit genuinely achieves exactly-once across a side effect, and it is the right answer when the external system has no idempotency key. The reason to prefer the key is in the note: 2PC has a state — prepared, coordinator gone — in which neither committing nor aborting is safe, and that state has to be resolved by a human.` },
  { t: 'and what this design does NOT settle', draw: (c) =>
      c.panel('SCOPE', 'p')
      + c.note('x1', c.P.main.x + 24, c.P.main.y + 46, 1040, [`The idempotency key requires the processor to support it. If it does not, this design does not degrade gracefully — it is simply unavailable, and 2PC is the fallback.`], c.C.hot, c.C.hotFill)
      + c.note('x2', c.P.main.x + 24, c.P.main.y + 112, 1040, [`The key must be derived from the data ("order-${ORDER.id}"). A key generated at send time produces a second charge with extra steps, and nothing in the pipeline detects that.`], c.C.hot, c.C.hotFill)
      + c.note('x3', c.P.main.x + 24, c.P.main.y + 178, 1040, [`The dedup seen-set is unbounded state. Bounding it by a window means dedup stops working past that horizon — so the ${DEDUP_COVERS}-of-${CRASH_WINDOWS.length} coverage is also time-limited.`], c.C.warn, c.C.warnFill)
      + c.note('x4', c.P.main.x + 24, c.P.main.y + 244, 1040, [`And a replayable source protects completeness only as far back as its retention. Beyond that, the ${TOTAL - REPLAY_V} outcome is reachable again and no downstream guard helps.`], c.C.blue, c.C.blueFill),
    cap: `The first two gaps are the ones that silently break this design. The whole guarantee rests on a feature of someone else's system, and on a key being derived from data rather than generated — and a send-time key fails in a way that produces a correct-looking pipeline and a double charge. Neither is visible from inside, which is why both belong in the design review rather than in testing.` },
];

// =============================== EMIT DIAGRAMS ==============================
const DIAGRAMS = [
  { name: 'ch05-meaning', steps: C1,
    title: 'What exactly-once means — accuracy and completeness',
    subtitle: `lost ${REPLAYED.length} records → ${TOTAL - REPLAY_V} · doubled them → ${TOTAL + REPLAY_V} · the truth is ${TOTAL}`,
    heading: 'Why exactly-once is two guarantees, and which half is hard',
    why: [
      `A correct pipeline is **accurate** (each result is right) and **complete** (every input contributes). Exactly-once means each record's contribution appears exactly once — no more and no less.`, '',
      `Those are separate failures with separate causes. Lose the ${REPLAYED.length} records after a crash and the total is **${TOTAL - REPLAY_V}**, ${Math.round(100 * REPLAY_V / TOTAL)}% low. Apply the same ${REPLAYED.length} twice and it is **${TOTAL + REPLAY_V}**, ${Math.round(100 * REPLAY_V / TOTAL)}% high. Same size, opposite sign — which is exactly why one can mask the other in an aggregate.`, '',
      `**One duplicate record costs \`v\` divided by its window's total**, so the damage is not a fixed percentage. Delivering id ${WORST_DUP.e.id} twice takes its window from ${WORST_DUP.base} to ${WORST_DUP.after} (**+${WORST_DUP.pct}%**); the least damaging duplicate in this dataset is +${dupDamage[dupDamage.length - 1].pct}%. Duplicate damage concentrates in **thin** windows, which are the ones nobody watches.`, '',
      `**And retries are not optional.** A worker crashes mid-batch and the batch is re-sent. A send times out but actually succeeded, and the sender cannot tell. A checkpoint commits state but not the offset. Each produces a duplicate — and the alternative, never retrying, turns every one of them into **lost** data instead. So a distributed pipeline is at-least-once by default, and exactly-once is built on top of retries rather than instead of them.`, '',
      `**The problem then splits in two, and the halves are not equally hard.** Per-key state is a deterministic function of the records: recompute window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)}) and you get ${WORST_DUP.base} every time, so it is idempotent by construction. An external effect — charge order ${ORDER.id} for ${ORDER.v} — cannot be recomputed. The money has moved, nothing in the pipeline records that, and the only system that knows is the one you called.`],
    whenHeading: 'When you need exactly-once, and when at-least-once is the right answer',
    when: [
      `**At-least-once is fine when the sink is idempotent anyway** — a cache you overwrite, a gauge you set, a search index keyed by document id. Re-delivering a record costs a little work and changes nothing, so the extra machinery buys nothing.`, '',
      `**At-most-once is fine when a loss is cheaper than a duplicate** and the data is statistical — a sampled metric, a debug trace. Rare, but it exists, and it is far cheaper to build.`, '',
      `**You need exactly-once when a duplicate is visible or expensive**: money, an email, a count someone reconciles. The test is not "is the data important" but "would a second copy be noticed" — and in a thin window, a single duplicate is a ${WORST_DUP.pct}% error.`, '',
      `**What this does not settle:** which mechanism to use where. Completeness and accuracy have different fixes at different stages, and the state half and the effect half of exactly-once need entirely different machinery. The next two concepts take them in turn — and the second one is where the usual "source + shuffle + sink" rule turns out to be imprecise.`],
    diagramHeading: 'Visual walkthrough — two failures, one duplicate, and the split',
    sub: `The loss and duplication totals, and every per-window duplicate cost, are computed from the seed and asserted.` },
  { name: 'ch05-dedup', steps: C2,
    title: 'Idempotency and deduplication — and which guard is load-bearing',
    subtitle: `8 combinations, 3 outcomes: ${TOTAL - REPLAY_V} lost · ${TOTAL} correct · ${TOTAL + REPLAY_V} doubled`,
    heading: 'Why a replayable source has no substitute and the other two are redundant',
    why: [
      `**Idempotent means twice is the same as once**, and the test is what the operation *names*. \`SET window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)}) = ${WORST_DUP.base}\` names a result: apply it any number of times and the value is ${WORST_DUP.base}. \`ADD ${WORST_DUP.e.v}\` names a change: twice gives ${WORST_DUP.after}.`, '',
      `This connects straight back to ch02. An **accumulating** pane carries the window's whole total, so it is a SET and is safe to re-deliver. A **discarding** pane carries only the delta, so it is an ADD and is not. **The accumulation mode decides whether an idempotent sink is possible at all.**`, '',
      `**Dedup at the shuffle** is a set of ids already accepted plus one membership test. Replay ids ${REPLAYED.map(e => e.id).join(', ')} into it and all ${REPLAYED.length} are recognised and dropped: total ${TOTAL}, correct. Two things make it non-free — the ids must be **stable** across the retry (an id generated at send time gets a new value and defeats it), and the seen-set is unbounded state that needs a horizon, so dedup has a memory beyond which it stops working.`, '',
      `**Now put all three guards in a table.** After a crash at event ${CHK} with the state committed and the offset not, the ${TABLE.length} combinations of (replayable source × deduplicating shuffle × idempotent sink) produce exactly **three** totals: ${TOTAL - REPLAY_V}, ${TOTAL} and ${TOTAL + REPLAY_V}.`, '',
      `${CORRECT_ROWS.length} of the ${TABLE.length} rows reach ${TOTAL}, and reading them refines the usual claim. "End-to-end exactly-once = source + shuffle + sink, drop any one and it breaks" is **not quite right for an aggregation**: the replayable source is load-bearing, and then dedup **or** an idempotent sink is enough. The two accuracy guards are redundant.`, '',
      `**The source is different because the mechanisms are asymmetric.** Dedup and idempotency are *subtractive* — they stop a contribution counting twice, and can do nothing else. Neither can add back a record that was never re-read. So completeness has exactly one mechanism and accuracy has two.`],
    whenHeading: 'When to use which guard, and where the redundancy disappears',
    when: [
      `**Always start with the source.** If it cannot replay from a committed offset, nothing downstream gets you past ${TOTAL - REPLAY_V}, and no amount of care elsewhere helps. This is the requirement to check before designing anything else.`, '',
      `**Prefer an idempotent sink to a deduplicating shuffle when you have the choice.** It needs no extra state, no id stability and no horizon — whereas the seen-set is unbounded state that must be bounded, and bounding it puts an expiry on the guarantee.`, '',
      `**Use the deduplicating shuffle when the sink genuinely cannot be idempotent** — when it only accepts deltas, or when the operation is an append. Then budget for the seen-set and decide its horizon deliberately.`, '',
      `**Use both when you want the cheap belt-and-braces**, knowing from the table that for an aggregation this is redundancy rather than defence in depth.`, '',
      `**What this does not settle — and it is the important one:** the redundancy above holds because a window total can be recomputed. It **disappears** the moment the sink's effect is outside the pipeline. The next concept shows the dedup shuffle covering ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} crash windows where an idempotency key covers ${KEY_COVERS} — at which point the two guards are not interchangeable at all.`],
    diagramHeading: 'Visual walkthrough — SET vs ADD, the seen-set, and all 8 combinations',
    sub: `The ${TABLE.length}-row table and its 3 distinct totals are computed from the seed, and the redundancy finding is asserted.` },
  { name: 'ch05-effects', steps: C3,
    title: 'Side effects — where the redundancy disappears',
    subtitle: `dedup covers ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} crash windows · an idempotency key covers ${KEY_COVERS} of ${CRASH_WINDOWS.length}`,
    heading: 'Why the outside world cannot be recomputed, and what follows from that',
    why: [
      `**A side effect touches the outside world, and the outside world has no "recompute".** Retry the aggregation and window [${mm(WORST_DUP.w)}, ${mm(WORST_DUP.w + WIN)}) is ${WORST_DUP.base} again, because the state is a function of the records. Retry \`charge(order ${ORDER.id}, ${ORDER.v})\` and the card is charged **${ORDER.v * 2}**, because the money moved and nothing in the pipeline records that it did.`, '',
      `Worse, the pipeline **cannot tell**: a charge that timed out after succeeding looks exactly like one that failed. So it has only two options, and they are the same option — make the effect safe to repeat, or ask the external system whether it already happened.`, '',
      `**An idempotency key is how you ask.** First attempt: \`charge("order-${ORDER.id}", ${ORDER.v})\`, the processor records the key and charges ${ORDER.v}. The pipeline crashes before committing. The retry sends the same call, the processor **recognises the key**, and the total charged is ${ORDER.v}.`, '',
      `Note what the key does *not* do: it does not make the effect idempotent. It moves the deduplication to the only place that can see both attempts. Two requirements follow — the key must be derived from the **data** (a key generated at send time is a second charge with extra steps), and the external system has to offer the feature at all.`, '',
      `**And here is where the previous concept's redundancy disappears.** There are three windows in which the pipeline can crash while charging order ${ORDER.id}:`, '',
      ...CRASH_WINDOWS.map(cw => `- **crash ${cw.at}** — ${cw.what}. Dedup: ${cw.dedupCovers ? 'covers' : '**misses**'}. Key: covers.`),
      '',
      `A deduplicating shuffle covers **${DEDUP_COVERS} of ${CRASH_WINDOWS.length}**; an idempotency key covers **${KEY_COVERS} of ${CRASH_WINDOWS.length}**. For a pure aggregation the two guards were interchangeable. For a side effect only the external one reaches the crash windows that matter.`, '',
      `**Placement helps too, and it is free.** In a ${STAGES.length}-stage pipeline (${STAGES.join(' → ')}), an effect at stage 2 can be re-run by a crash in ${EXPOSE_EARLY} stages; at the last stage, only ${EXPOSE_LATE}. That is a ${EXPOSE_EARLY / EXPOSE_LATE}× reduction in exposure from placement alone, and it keeps everything upstream pure and freely retryable.`],
    whenHeading: 'When each mechanism applies, and the one you cannot provide yourself',
    when: [
      `**Use an idempotency key whenever the external system offers one** — Stripe, most payment processors, any API with an \`Idempotency-Key\` header, any database with upsert. It is one round trip, the retry is free, and the decision is made by the only component that can make it.`, '',
      `**Push the effect to the last stage, always.** It costs nothing, reduces exposure ${EXPOSE_EARLY / EXPOSE_LATE}× here, and leaves the computation above it pure — so the expensive part of the pipeline can be retried without anyone thinking about it.`, '',
      `**Reach for two-phase commit only when there is no key.** It genuinely achieves exactly-once across an external effect, and it has a state — prepared, coordinator gone — in which neither committing nor aborting is safe. That state is resolved by a human, which is why it is the fallback rather than the default.`, '',
      `**What this does not settle, and it is a dependency rather than a gap:** the whole mechanism rests on a feature of someone else's system. If the processor has no idempotency key, this design does not degrade — it is unavailable. And if the key is generated at send time rather than derived from the order, the pipeline looks correct and double-charges, with nothing inside it able to detect the difference.`],
    diagramHeading: 'Visual walkthrough — no recompute, the key, the three crash windows',
    sub: `The crash-window coverage counts and the placement exposure figures are computed and asserted.` },
  { name: 'ch05-system', steps: C4,
    title: 'System design — charge a card exactly once',
    subtitle: `order ${ORDER.id}, amount ${ORDER.v}: crash after the charge, replay, charged ${ORDER.v} not ${ORDER.v * 2}`,
    heading: 'Why the decisive fact lives outside the pipeline',
    why: [
      `**The question.** A payment pipeline that charges a card exactly once. It can crash and retry after a timeout, so the sink must be idempotent on an idempotency key and the shuffle must dedup — otherwise a retry double-charges.`, '',
      `**The pipeline:** replayable source (offset) → dedup shuffle → idempotent sink (idempotency key) → external system.`, '',
      `The design's whole difficulty is that **the decisive fact lives in the fourth stage**. Whether order ${ORDER.id} has already been charged is known only by the processor; every mechanism in the first three stages is an attempt not to have to know it, and only the idempotency key actually asks.`, '',
      `**Trace the crash and retry:**`, '',
      `1. Record id ${ORDER.id} passes the dedup shuffle; the seen-set gains id ${ORDER.id}.`,
      `2. The sink calls \`charge("order-${ORDER.id}", ${ORDER.v})\`; the processor charges ${ORDER.v} and records the key.`,
      `3. The pipeline crashes **before committing the offset**. The charge happened; the pipeline does not know.`,
      `4. Replay re-reads from the old offset. Record id ${ORDER.id} arrives again — **and the seen-set died with the process**, so it looks new.`,
      `5. The sink calls \`charge("order-${ORDER.id}", ${ORDER.v})\` again; the processor recognises the key and does not charge.`, '',
      `Total charged: **${ORDER.v}**, not ${ORDER.v * 2}.`, '',
      `**Step 4 is where the earlier redundancy breaks down concretely.** The dedup seen-set was in memory and is gone, so the replayed record is indistinguishable from a new one. The only state that survived the crash lives in the payment processor, which is why the key is the mechanism and the shuffle is an optimisation.`, '',
      `**Two-phase commit is the alternative.** It reaches exactly-once without a key, and it costs a blocking coordinator plus an in-doubt state: coordinator dead after "prepare", where committing may double-charge and aborting may lose a legitimate payment. There is no safe default, so a human resolves it.`],
    whenHeading: 'When this design works, and the four things it does not settle',
    when: [
      `**It works when the processor supports an idempotency key and the key can be derived from the order.** Both halves are required, and both are checked before anything else in the design.`, '',
      `**Keep the dedup shuffle anyway.** It is cheap, it covers the crash window before the dedup point, and it reduces load on the processor. Treat it as an optimisation rather than as a guarantee.`, '',
      `**Prefer this to 2PC whenever the choice exists**, for the reason above: 2PC's in-doubt state has no safe resolution.`, '',
      `**What this design does NOT settle — four gaps:**`, '',
      `1. **The key requires the processor to support it.** If it does not, this design does not degrade gracefully — it is simply unavailable, and 2PC is the fallback with all of its cost.`,
      `2. **The key must be derived from the data.** \`"order-${ORDER.id}"\` works; a key generated at send time produces a second charge with extra steps, and **nothing in the pipeline can detect that**. It is a correct-looking pipeline that double-charges.`,
      `3. **The dedup seen-set is unbounded state.** Bounding it by a window means dedup stops working past that horizon, so its ${DEDUP_COVERS}-of-${CRASH_WINDOWS.length} coverage is time-limited as well as partial.`,
      `4. **Replay protects completeness only as far back as the source's retention.** Beyond that the ${TOTAL - REPLAY_V} outcome is reachable again, and no downstream guard helps — because dedup and idempotency are subtractive and cannot add a record back.`],
    diagramHeading: 'Visual walkthrough — four stages, five steps, one charge',
    sub: `The charge sequence and both coverage counts are computed from the seed and asserted.` },
];
for (const d of DIAGRAMS) {
  const Dg = buildDiagramWalkthrough({ W, name: d.name, stepSecs: 5.5,
    out: path.join(__dirname, '..', 'diagrams', 'anim', d.name),
    title: d.title, subtitle: d.subtitle,
    seedLine: `seed: tools/stream_seed.js · total ${TOTAL} · crash at event ${CHK}`,
    steps: d.steps });
  const r = Dg.emit();
  Dg.embed({ gen: 'gen_ch05.js', whyHeading: d.heading, why: d.why,
    whenHeading: d.whenHeading, when: d.when, diagramHeading: d.diagramHeading,
    sub: d.sub + ' Generated by `node tools/gen_ch05.js`.' });
  console.log(`OK  ${d.name}: ${r.steps} frames ${r.W}x${r.H}`);
}

// =============================== EMIT PROGRAMS ==============================
const COMMON = [
  '// primitive: len(xs) — element count.  len([1,2]) = 2',
  '// Two of an event\'s five fields are CLOCKS, which ch01 established:',
  '//   et = event time, when it happened  ·  pt = processing time, when we saw it',
  '//   v = the value being summed (also, here, the amount to charge)',
  'type Event { id, key, et, pt, v }',
  `// primitive: EVENTS — the book's ${EVENTS.length} events, in PROCESSING order (tools/stream_seed.js).`,
  `//   EVENTS[${ORDER.id}] = (id ${ORDER.id}, key "${ORDER.key}", et ${ORDER.et}, pt ${ORDER.pt}, v ${ORDER.v})   <- the order this chapter charges`,
  '// primitive: NONE — no value. Distinct from a value of 0.',
  `// primitive: WIN — the window width, in seconds of event time.  WIN = ${WIN}`,
  `// primitive: CHK — the index whose state was checkpointed before the crash.  CHK = ${CHK}`,
  `// primitive: TOTAL — the dataset's true total.  TOTAL = ${TOTAL}`,
  '// primitive: winOf(et) — the START of the window holding et.',
  `//   winOf(${ORDER.et}) = ${winOf(ORDER.et)}      winOf(${EVENTS[0].et}) = ${winOf(EVENTS[0].et)}`,
  '// primitive: append(xs, x) — xs with x added at the end.  append([1], 2) = [1,2]',
  '// primitive: contains(xs, x) — is x in xs?  contains([1,2], 2) = true',
];
const PROGRAMS = [];
const WD = WORST_DUP;

// ---- concept 1: accuracy vs completeness, as two mutations ------------------
PROGRAMS.push({
  name: 'ch05-meaning-memory',
  title: 'Accuracy and completeness — two mutations of one delivery list',
  subtitle: `lost ${REPLAYED.length} → ${TOTAL - REPLAY_V} · doubled them → ${TOTAL + REPLAY_V} · truth ${TOTAL}`,
  src: COMMON.concat([
    '',
    'type Run { delivered, total }',
    '',
    `// primitive: REPLAYED — the ids re-read after a crash at CHK.  REPLAYED = [${REPLAYED.map(e => e.id).join(', ')}]`,
    `// primitive: REPLAY_V — their combined v.  REPLAY_V = ${REPLAY_V}`,
    '',
    `// primitive: indexOf(e) — e's position in PROCESSING order.  indexOf(EVENTS[${ORDER.id}]) = ${EVENTS.indexOf(ORDER)}`,
    '',
    '// function: deliver(mode) — the list of record ids a stage actually receives.',
    `//   deliver("exactly-once") = [${EVENTS.map(e => e.id).join(', ')}]`,
    `//   deliver("at-most-once") = [${EVENTS.slice(0, CHK + 1).map(e => e.id).join(', ')}]   (the replay never happens)`,
    `//   deliver("at-least-once") = [${EVENTS.map(e => e.id).join(', ')}, ${REPLAYED.map(e => e.id).join(', ')}]   (the replay is not deduplicated)`,
    'fun deliver(mode) {',
    '    var out = []',
    '    for (e in EVENTS) {',
    '        if (mode == "at-most-once" && indexOf(e) > CHK) { continue }',
    '        out = append(out, e.id)',
    '    }',
    '    if (mode == "at-least-once") {',
    '        for (e in REPLAYED) { out = append(out, e.id) }',
    '    }',
    '    return out',
    '}',
    '',
    '// function: aggregate(ids) — sum v over a delivery list, counting repeats.',
    `//   aggregate(deliver("exactly-once")) = ${TOTAL}`,
    `//   aggregate(deliver("at-least-once")) = ${TOTAL + REPLAY_V}`,
    'fun aggregate(ids) {',
    '    var t = 0',
    '    for (id in ids) { t = t + EVENTS[id].v }',
    '    return t',
    '}',
    '',
    '// function: windowCost(id) — what ONE duplicate of that record does to its own',
    '//   window, as a percentage. The damage is v over the window total.',
    `//   windowCost(${WD.e.id}) = ${WD.pct}      windowCost(${dupDamage[dupDamage.length - 1].e.id}) = ${dupDamage[dupDamage.length - 1].pct}`,
    'fun windowCost(id) {',
    '    val w    = winOf(EVENTS[id].et)',
    '    var base = 0',
    '    for (e in EVENTS) {',
    '        if (winOf(e.et) == w) { base = base + e.v }',
    '    }',
    '    return 100 * EVENTS[id].v / base',
    '}',
    '',
    '// function: main() — THE CALLER: three delivery guarantees, one dataset.',
    'fun main() {',
    '    val once   = aggregate(deliver("exactly-once"))',
    '    val atMost = aggregate(deliver("at-most-once"))',
    '    val atLeast = aggregate(deliver("at-least-once"))',
    `    val worst  = windowCost(${WD.e.id})`,
    '}',
  ]),
  heap: {
    once:    { addr: '0x100', type: `int[${EVENTS.length}]`, val: () => `[${EVENTS.map(e => e.id).join(',')}] → ${TOTAL}` },
    atMost:  { addr: '0x200', type: `int[${CHK + 1}]`, val: () => `[${EVENTS.slice(0, CHK + 1).map(e => e.id).join(',')}] → ${TOTAL - REPLAY_V}` },
    atLeast: { addr: '0x300', type: `int[${EVENTS.length + REPLAYED.length}]`, val: () => `[${EVENTS.map(e => e.id).join(',')},${REPLAYED.map(e => e.id).join(',')}] → ${TOTAL + REPLAY_V}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `once = ${o.once !== undefined ? o.once : '...'}`, `atMost = ${o.atMost !== undefined ? o.atMost : '...'}`,
      `atLeast = ${o.atLeast !== undefined ? o.atLeast : '...'}`, `worst = ${o.worst !== undefined ? o.worst : '...'}`] });
    return [
      { t: 'at-most-once DROPS everything after the checkpoint', line: at('fun deliver(mode)', 'if (mode == "at-most-once" && indexOf(e) > CHK) { continue }'),
        stack: [MAIN(), { name: 'deliver', locals: ['mode = "at-most-once"', 'out = @0x200', `e = EVENTS[${REPLAYED[0].id}]`] }],
        heap: [{ key: 'atMost', hot: true }],
        cap: `\`indexOf(EVENTS[${REPLAYED[0].id}])\` is ${CHK + 1}, which is > CHK = ${CHK}, so the record is skipped. All ${REPLAYED.length} records after the checkpoint are dropped and the list holds ${CHK + 1} ids. That is a COMPLETENESS failure: the sum will be ${TOTAL - REPLAY_V}, and nothing downstream can recover it.` },
      { t: 'at-least-once APPENDS them a second time', line: at('for (e in REPLAYED) { out = append(out, e.id) }'),
        stack: [MAIN({ once: TOTAL, atMost: TOTAL - REPLAY_V }), { name: 'deliver', locals: ['mode = "at-least-once"', 'out = @0x300', `e = EVENTS[${REPLAYED[REPLAYED.length - 1].id}]`] }],
        heap: [{ key: 'atMost' }, { key: 'atLeast', hot: true }],
        cap: `The replayed ids are appended, so \`out\` holds ${EVENTS.length + REPLAYED.length} entries for ${EVENTS.length} records — ids ${REPLAYED.map(e => e.id).join(', ')} appear twice. That is an ACCURACY failure, and note the list itself is the evidence: the duplicates are visible here and invisible in the sum.` },
      { t: 'and the aggregate cannot tell the two apart', line: at('fun aggregate(ids)', 't = t + EVENTS[id].v'),
        stack: [MAIN({ once: TOTAL, atMost: TOTAL - REPLAY_V, atLeast: TOTAL + REPLAY_V }), { name: 'aggregate', locals: [`ids = @0x300`, `t = ${TOTAL + REPLAY_V}`, `id = ${REPLAYED[REPLAYED.length - 1].id}`] }],
        heap: [{ key: 'atMost' }, { key: 'atLeast' }],
        cap: `\`aggregate\` adds \`EVENTS[id].v\` for each entry and has no idea whether an id appeared before. ${TOTAL - REPLAY_V}, ${TOTAL}, ${TOTAL + REPLAY_V} — three numbers from one dataset, and the function that produced them is identical and correct in all three cases.` },
      { t: 'one duplicate costs v / window total, so thin windows hurt', line: at('fun windowCost(id)', 'return 100 * EVENTS[id].v / base'),
        stack: [MAIN({ once: TOTAL, atMost: TOTAL - REPLAY_V, atLeast: TOTAL + REPLAY_V, worst: WD.pct }),
                { name: 'windowCost', locals: [`id = ${WD.e.id}`, `w = ${WD.w}`, `base = ${WD.base}`, `e = EVENTS[${EVENTS[EVENTS.length - 1].id}]`] }],
        heap: [{ key: 'atLeast' }],
        cap: `For id ${WD.e.id}: \`base\` is ${WD.base} and \`v\` is ${WD.e.v}, so the cost is ${WD.pct}%. For id ${dupDamage[dupDamage.length - 1].e.id} the same calculation gives ${dupDamage[dupDamage.length - 1].pct}%, because its window is thicker. The duplicate is identical; only the denominator differs — which is why duplicate damage concentrates where the data is thin.` },
    ];
  },
  intro: [
    `**What is being answered.** Why exactly-once is two guarantees — as three delivery lists built by one function and summed by another.`, '',
    `\`deliver(mode)\` produces the list of record ids a stage actually receives: ${EVENTS.length} ids for exactly-once, ${CHK + 1} for at-most-once (the replay never happens), and ${EVENTS.length + REPLAYED.length} for at-least-once (the replay is not deduplicated).`, '',
    `\`aggregate(ids)\` then sums them, and step 3 is the point: it is **identical and correct** for all three lists and produces ${TOTAL - REPLAY_V}, ${TOTAL} and ${TOTAL + REPLAY_V}. The duplicates are visible in the list and invisible in the number.`],
  sub: `All three totals and every per-window duplicate cost are computed from the seed and asserted.` });

// ---- concept 2: the 2x2x2 table as a function ------------------------------
PROGRAMS.push({
  name: 'ch05-dedup-memory',
  title: 'Three guards, eight combinations — and which one is load-bearing',
  subtitle: `source required · dedup OR idempotent sink sufficient · ${CORRECT_ROWS.length} of ${TABLE.length} rows reach ${TOTAL}`,
  src: COMMON.concat([
    '',
    'type Sink   { rows }',
    'type Result { total, verdict }',
    '',
    `// primitive: REPLAYED — the ids re-read after the crash.  REPLAYED = [${REPLAYED.map(e => e.id).join(', ')}]`,
    `// primitive: REPLAY_V — their combined v.  REPLAY_V = ${REPLAY_V}`,
    '',
    '// function: setRow(sink, w, value) — IDEMPOTENT: names the result.',
    `//   setRow(sink, ${WD.w}, ${WD.base}) then setRow(sink, ${WD.w}, ${WD.base}) leaves ${WD.base}`,
    'fun setRow(sink, w, value) {',
    '    sink.rows[w] = value',
    '    return sink',
    '}',
    '',
    '// function: addRow(sink, w, delta) — NOT idempotent: names a change.',
    `//   addRow(sink, ${WD.w}, ${WD.e.v}) twice leaves ${WD.e.v * 2}, not ${WD.e.v}`,
    'fun addRow(sink, w, delta) {',
    '    sink.rows[w] = sink.rows[w] + delta',
    '    return sink',
    '}',
    '',
    `// primitive: firstN(xs, n) — the first n elements.  firstN([1,2,3], 2) = [1,2]`,
    '// primitive: windowTotal(w, ids) — sum of v over the DISTINCT ids in window w.',
    `//   windowTotal(${WD.w}, [${WINDOWS[WD.w].join(', ')}]) = ${WD.base}`,
    `// primitive: sumRows(sink) — every row added up.  sumRows(a full sink) = ${TOTAL}`,
    `// primitive: verdictOf(t) — "CORRECT" when t == TOTAL, else "LOST" or "DOUBLE".`,
    `//   verdictOf(${TOTAL}) = "CORRECT"      verdictOf(${TOTAL + REPLAY_V}) = "DOUBLE"`,
    '',
    '// function: runPipeline(replayable, dedup, idempotent) — one crash, three guards.',
    `//   runPipeline(true, true, false).total  = ${TOTAL}`,
    `//   runPipeline(true, false, true).total  = ${TOTAL}`,
    `//   runPipeline(true, false, false).total = ${TOTAL + REPLAY_V}`,
    `//   runPipeline(false, true, true).total  = ${TOTAL - REPLAY_V}`,
    'fun runPipeline(replayable, dedup, idempotent) {',
    '    var sink  = Sink({})',
    '    var seen  = []',
    '    var feed  = []',
    '    for (e in EVENTS) { feed = append(feed, e.id) }',
    '    if (replayable) {',
    '        for (e in REPLAYED) { feed = append(feed, e.id) }',
    '    }',
    '    if (replayable == false) {',
    '        feed = firstN(feed, CHK + 1)',
    '    }',
    '    for (id in feed) {',
    '        if (dedup && contains(seen, id)) { continue }',
    '        seen = append(seen, id)',
    '        val w = winOf(EVENTS[id].et)',
    '        if (idempotent) { sink = setRow(sink, w, windowTotal(w, seen)) }',
    '        if (idempotent == false) { sink = addRow(sink, w, EVENTS[id].v) }',
    '    }',
    '    return Result(sumRows(sink), verdictOf(sumRows(sink)))',
    '}',
    '',
    '// function: main() — THE CALLER: the four interesting rows of the table.',
    'fun main() {',
    '    val bothGuards = runPipeline(true, true, true)',
    '    val dedupOnly  = runPipeline(true, true, false)',
    '    val idemOnly   = runPipeline(true, false, true)',
    '    val neither    = runPipeline(true, false, false)',
    '    val noSource   = runPipeline(false, true, true)',
    '}',
  ]),
  heap: {
    dedupOnly: { addr: '0x100', type: 'Result', val: () => `total ${TOTAL} · CORRECT` },
    idemOnly:  { addr: '0x200', type: 'Result', val: () => `total ${TOTAL} · CORRECT` },
    neither:   { addr: '0x300', type: 'Result', val: () => `total ${TOTAL + REPLAY_V} · DOUBLE` },
    noSource:  { addr: '0x400', type: 'Result', val: () => `total ${TOTAL - REPLAY_V} · LOST` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `bothGuards = ${o.both || '...'}`, `dedupOnly = ${o.dedup || '...'}`, `idemOnly = ${o.idem || '...'}`,
      `neither = ${o.neither || '...'}`, `noSource = ${o.noSource || '...'}`] });
    const RUN = (o) => ({ name: 'runPipeline', locals: [`replayable = ${o.r}`, `dedup = ${o.d}`, `idempotent = ${o.i}`,
      `sink = ${o.sink}`, `seen = (${o.seen} ids)`, `feed = (${o.feed} ids)`,
      `e = ${o.id === 'NONE' ? 'NONE (the feed loops are done)' : `EVENTS[${o.id}]`}`, `id = ${o.id}`, `w = ${o.w}`] });
    return [
      { t: 'dedup drops the replayed record on a membership test', line: at('fun runPipeline(replayable, dedup, idempotent)', 'if (dedup && contains(seen, id)) { continue }', 'sink.rows[w] = sink.rows[w] + delta'),
        stack: [MAIN(), RUN({ r: 'true', d: 'true', i: 'false', sink: '@0x100', seen: EVENTS.length, feed: EVENTS.length + REPLAYED.length, id: REPLAYED[0].id, w: winOf(REPLAYED[0].et) })],
        heap: [{ key: 'dedupOnly', hot: true }],
        cap: `\`seen\` already holds id ${REPLAYED[0].id} from the first pass, so \`contains\` is true and the replayed copy is skipped before it can reach the sink. \`dedupOnly\` reaches ${TOTAL} — correct, with a sink that merely ADDS. The guard is upstream of the sink's weakness.` },
      { t: 'OR the sink names the result, which makes the repeat harmless', line: at('if (idempotent) { sink = setRow(sink, w, windowTotal(w, seen)) }', 'sink.rows[w] = value'),
        stack: [MAIN({ dedup: '@0x100' }), RUN({ r: 'true', d: 'false', i: 'true', sink: '@0x200', seen: EVENTS.length + 1, feed: EVENTS.length + REPLAYED.length, id: REPLAYED[0].id, w: winOf(REPLAYED[0].et) })],
        heap: [{ key: 'dedupOnly' }, { key: 'idemOnly', hot: true }],
        cap: `\`dedup\` is false here, so the replayed id is NOT skipped — it reaches the sink. But \`setRow\` writes \`windowTotal(w, seen)\`, the window's total over distinct ids, so writing it again changes nothing. \`idemOnly\` also reaches ${TOTAL}. Two different guards, same result: they are redundant for an aggregation.` },
      { t: 'with neither, the add runs twice', line: at('if (idempotent == false) { sink = addRow(sink, w, EVENTS[id].v) }'),
        stack: [MAIN({ dedup: '@0x100', idem: '@0x200', neither: '@0x300' }), RUN({ r: 'true', d: 'false', i: 'false', sink: '@0x300', seen: EVENTS.length + 1, feed: EVENTS.length + REPLAYED.length, id: REPLAYED[0].id, w: winOf(REPLAYED[0].et) })],
        heap: [{ key: 'idemOnly' }, { key: 'neither', hot: true }],
        cap: `\`addRow\` adds \`EVENTS[${REPLAYED[0].id}].v\` = ${REPLAYED[0].v} to a row that already contains it. Across all ${REPLAYED.length} replayed records the total reaches ${TOTAL + REPLAY_V} — DOUBLE. Nothing errored; the sink simply applied a delta it had already applied.` },
      { t: 'and no guard can recover a record that was never re-read', line: at('feed = firstN(feed, CHK + 1)'),
        stack: [MAIN({ dedup: '@0x100', idem: '@0x200', neither: '@0x300', noSource: '@0x400' }),
                RUN({ r: 'false', d: 'true', i: 'true', sink: '@0x400', seen: 0, feed: CHK + 1, id: 'NONE', w: 'NONE' })],
        heap: [{ key: 'neither' }, { key: 'noSource', hot: true }],
        cap: `With \`replayable\` false the feed is truncated to ${CHK + 1} ids BEFORE the loop, so \`dedup\` and \`idempotent\` — both true here — never see the missing records. ${TOTAL - REPLAY_V}, LOST. Both accuracy guards are subtractive: they stop a contribution counting twice and can do nothing else.` },
    ];
  },
  intro: [
    `**What is being answered.** Which of the three exactly-once guards is actually load-bearing — as one \`runPipeline(replayable, dedup, idempotent)\` called with different flags.`, '',
    `Steps 1 and 2 are the finding: \`dedupOnly\` and \`idemOnly\` both reach ${TOTAL}, by completely different routes. Dedup stops the record before the sink; the idempotent sink lets it through and writes a value that does not depend on what is already there. **For an aggregation they are redundant.**`, '',
    `Step 4 is why the source is different. \`firstN\` truncates the feed *before* the loop, so both guards — set to true — never see the missing records. They are subtractive, and no subtractive mechanism can add a contribution back.`],
  sub: `All ${TABLE.length} combinations are computed from the seed; the three distinct totals and the redundancy finding are asserted.` });

// ---- concept 3: the side effect, and the three crash windows ---------------
PROGRAMS.push({
  name: 'ch05-effects-memory',
  title: 'Side effects — three crash windows, two guards',
  subtitle: `dedup covers ${DEDUP_COVERS} of ${CRASH_WINDOWS.length} · the idempotency key covers ${KEY_COVERS} of ${CRASH_WINDOWS.length}`,
  src: COMMON.concat([
    '',
    'type Processor { chargedKeys, totalCharged }',
    'type Outcome   { charged, covered }',
    '',
    `// primitive: ORDER — the record this concept charges.  ORDER = EVENTS[${ORDER.id}], amount ${ORDER.v}`,
    `// primitive: CRASH_POINTS — where the pipeline can die mid-charge.`,
    `//   CRASH_POINTS = ["${CRASH_WINDOWS.map(c => c.at).join('", "')}"]`,
    '',
    '// function: charge(proc, key, amount) — the external call. The PROCESSOR decides,',
    '//   because it is the only component that can see both attempts.',
    `//   charge(proc, "order-${ORDER.id}", ${ORDER.v}) then the same call again leaves totalCharged = ${ORDER.v}`,
    'fun charge(proc, key, amount) {',
    '    if (contains(proc.chargedKeys, key)) { return proc }        // already done',
    '    proc.chargedKeys  = append(proc.chargedKeys, key)',
    '    proc.totalCharged = proc.totalCharged + amount',
    '    return proc',
    '}',
    '',
    '// primitive: nextCounter() — 1, then 2, then 3 ... a fresh value per call.',
    '//   nextCounter() = 1      nextCounter() = 2',
    '',
    '// function: keyFor(e, fromData) — the idempotency key. Derived from the DATA, or',
    '//   generated at send time — and the second one is useless.',
    `//   keyFor(ORDER, true)  = "order-${ORDER.id}"   (same on every attempt)`,
    `//   keyFor(ORDER, false) = "send-1", then "send-2"   (a NEW key per attempt)`,
    'fun keyFor(e, fromData) {',
    '    if (fromData) { return "order-" + e.id }',
    '    return "send-" + nextCounter()',
    '}',
    '',
    '// function: attempt(proc, crashAt, useDedup, useKey) — one run that crashes at a',
    '//   given point, then retries. Returns what was charged.',
    `//   attempt(proc, "${CRASH_WINDOWS[0].at}", true, false).charged = ${ORDER.v}`,
    `//   attempt(proc, "${CRASH_WINDOWS[2].at}", true, false).charged = ${ORDER.v * 2}`,
    `//   attempt(proc, "${CRASH_WINDOWS[2].at}", false, true).charged = ${ORDER.v}`,
    'fun attempt(proc, crashAt, useDedup, useKey) {',
    '    var seen = []',
    '    for (pass in 1 .. 2) {',
    '        if (useDedup && contains(seen, ORDER.id)) { continue }',
    `        if (crashAt == "${CRASH_WINDOWS[0].at}") { seen = append(seen, ORDER.id) }`,
    '        if (useKey)          { proc = charge(proc, keyFor(ORDER, true), ORDER.v) }',
    '        if (useKey == false) { proc = charge(proc, keyFor(ORDER, false), ORDER.v) }',
    '        seen = append(seen, ORDER.id)',
    '    }',
    '    return Outcome(proc.totalCharged, proc.totalCharged == ORDER.v)',
    '}',
    '',
    '// function: coverage(useDedup, useKey) — how many crash points this pair covers.',
    `//   coverage(true, false) = ${DEDUP_COVERS}      coverage(false, true) = ${KEY_COVERS}`,
    'fun coverage(useDedup, useKey) {',
    '    var n = 0',
    '    for (p in CRASH_POINTS) {',
    '        val o = attempt(Processor([], 0), p, useDedup, useKey)',
    '        if (o.covered) { n = n + 1 }',
    '    }',
    '    return n',
    '}',
    '',
    '// function: main() — THE CALLER: the two guards, scored.',
    'fun main() {',
    '    val byDedup = coverage(true, false)',
    '    val byKey   = coverage(false, true)',
    `    val worst   = attempt(Processor([], 0), "${CRASH_WINDOWS[2].at}", true, false)`,
    '}',
  ]),
  heap: {
    proc:   { addr: '0x100', type: 'Processor', val: () => `chargedKeys ["order-${ORDER.id}"] · totalCharged ${ORDER.v}` },
    double: { addr: '0x200', type: 'Processor', val: () => `chargedKeys ["send-1", "send-2"] · totalCharged ${ORDER.v * 2}` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `byDedup = ${o.byDedup !== undefined ? o.byDedup : '...'}`, `byKey = ${o.byKey !== undefined ? o.byKey : '...'}`,
      `worst = ${o.worst || '...'}`] });
    return [
      { t: 'the processor is the only component that can recognise a repeat', line: at('fun charge(proc, key, amount)', 'if (contains(proc.chargedKeys, key)) { return proc }        // already done'),
        stack: [MAIN(), { name: 'coverage', locals: ['useDedup = false', 'useKey = true', 'n = 0', `p = "${CRASH_WINDOWS[2].at}"`, 'o = ...'] },
                { name: 'attempt', locals: [`proc = @0x100`, `crashAt = "${CRASH_WINDOWS[2].at}"`, 'useDedup = false', 'useKey = true', 'seen = []', 'pass = 2'] },
                { name: 'charge', locals: ['proc = @0x100', `key = "order-${ORDER.id}"`, `amount = ${ORDER.v}`] }],
        heap: [{ key: 'proc', hot: true }],
        cap: `On the second pass \`proc.chargedKeys\` already contains "order-${ORDER.id}", so the function returns before touching \`totalCharged\`. It stays ${ORDER.v}. Note where that decision is made: inside the processor's state, which is the only state that survived the pipeline's crash.` },
      { t: 'a key generated at SEND TIME defeats the whole mechanism', line: at('fun keyFor(e, fromData)', 'return "send-" + nextCounter()'),
        stack: [MAIN(), { name: 'attempt', locals: [`proc = @0x200`, `crashAt = "${CRASH_WINDOWS[2].at}"`, 'useDedup = false', 'useKey = false', 'seen = []', 'pass = 2'] },
                { name: 'keyFor', locals: [`e = EVENTS[${ORDER.id}]`, 'fromData = false'] }],
        heap: [{ key: 'proc' }, { key: 'double', hot: true }],
        cap: `\`nextCounter()\` returns 2 on the retry, so the key is "send-2" — which the processor has never seen. It charges again and \`totalCharged\` reaches ${ORDER.v * 2}. The pipeline is using an idempotency key correctly in every respect except where the key came from, and nothing detects the difference.` },
      { t: `dedup covers ${DEDUP_COVERS} crash point, and misses the other ${CRASH_WINDOWS.length - DEDUP_COVERS}`, line: at(`if (crashAt == "${CRASH_WINDOWS[0].at}") { seen = append(seen, ORDER.id) }`),
        stack: [MAIN({ byDedup: DEDUP_COVERS }), { name: 'coverage', locals: ['useDedup = true', 'useKey = false', `n = ${DEDUP_COVERS}`, `p = "${CRASH_WINDOWS[1].at}"`, 'o = ...'] },
                { name: 'attempt', locals: [`proc = @0x200`, `crashAt = "${CRASH_WINDOWS[1].at}"`, 'useDedup = true', 'useKey = false', 'seen = []', 'pass = 1'] }],
        heap: [{ key: 'double' }],
        cap: `\`seen\` only gains the id when the crash happens BEFORE the shuffle. For the other ${CRASH_WINDOWS.length - DEDUP_COVERS} crash points the record is already past the dedup set — or the set died with the process — so \`contains(seen, ORDER.id)\` is false on the retry and the charge runs again.` },
      { t: 'so the two guards are NOT interchangeable here', line: at('fun coverage(useDedup, useKey)', 'if (o.covered) { n = n + 1 }'),
        stack: [MAIN({ byDedup: DEDUP_COVERS, byKey: KEY_COVERS, worst: `charged ${ORDER.v * 2}` }),
                { name: 'coverage', locals: ['useDedup = false', 'useKey = true', `n = ${KEY_COVERS}`, `p = "${CRASH_WINDOWS[2].at}"`, 'o = ...'] }],
        heap: [{ key: 'proc' }, { key: 'double' }],
        cap: `\`byDedup\` = ${DEDUP_COVERS} and \`byKey\` = ${KEY_COVERS}. In the previous concept these two guards were redundant for an aggregation; here they are not, and the reason is structural: dedup is inside the pipeline, and ${CRASH_WINDOWS.length - DEDUP_COVERS} of the ${CRASH_WINDOWS.length} crash points are after the point where the pipeline stops knowing anything.` },
    ];
  },
  intro: [
    `**What is being answered.** Why a deduplicating shuffle and an idempotency key are interchangeable for an aggregation and not for a charge — by scoring each against every crash point.`, '',
    `\`charge(proc, key, amount)\` makes the decision **inside the processor**, which matters because that is the only state that survives the pipeline's crash. Step 1 shows the early return leaving \`totalCharged\` at ${ORDER.v}.`, '',
    `Step 2 is the failure mode worth remembering: \`keyFor(e, false)\` returns a fresh \`"send-N"\` per attempt, so the processor sees a new key and charges ${ORDER.v * 2}. Everything else about the pipeline is correct. And \`coverage\` scores the two guards at ${DEDUP_COVERS} and ${KEY_COVERS} of ${CRASH_WINDOWS.length}.`],
  sub: `Both coverage counts and the double-charge total are computed and asserted.` });

// ---- concept 4: the payment pipeline, traced -------------------------------
PROGRAMS.push({
  name: 'ch05-system-memory',
  title: 'The payment pipeline — one charge across a crash',
  subtitle: `order ${ORDER.id}: crash after the charge, seen-set lost, key survives → charged ${ORDER.v}`,
  src: COMMON.concat([
    '',
    'type Processor { chargedKeys, totalCharged }',
    'type Pipeline  { offset, seen }',
    '',
    `// primitive: ORDER — the record being charged.  ORDER = EVENTS[${ORDER.id}], amount ${ORDER.v}`,
    `// primitive: OFFSET0 — the committed offset before the crash.  OFFSET0 = ${EVENTS.indexOf(ORDER)}`,
    '',
    '// function: charge(proc, key, amount) — the external call; the processor dedups.',
    `//   charge(proc, "order-${ORDER.id}", ${ORDER.v}) twice leaves totalCharged = ${ORDER.v}`,
    'fun charge(proc, key, amount) {',
    '    if (contains(proc.chargedKeys, key)) { return proc }',
    '    proc.chargedKeys  = append(proc.chargedKeys, key)',
    '    proc.totalCharged = proc.totalCharged + amount',
    '    return proc',
    '}',
    '',
    '// function: sinkWrite(proc, pipe, e) — the last stage: dedup, then charge.',
    `//   sinkWrite(proc, pipe, ORDER) charges ${ORDER.v} the first time, and nothing after`,
    'fun sinkWrite(proc, pipe, e) {',
    '    if (contains(pipe.seen, e.id)) { return proc }',
    '    pipe.seen = append(pipe.seen, e.id)',
    `    proc = charge(proc, "order-" + e.id, e.v)`,
    '    return proc',
    '}',
    '',
    '// function: crash(pipe) — what the pipeline LOSES: its in-memory seen-set. The',
    '//   committed offset survives; everything else does not.',
    `//   crash(Pipeline(${EVENTS.indexOf(ORDER)}, [${ORDER.id}])) = Pipeline(${EVENTS.indexOf(ORDER)}, [])`,
    'fun crash(pipe) {',
    '    return Pipeline(pipe.offset, [])',
    '}',
    '',
    '// function: run(useKey) — charge the order, crash before committing, replay.',
    `//   run(true).totalCharged  = ${ORDER.v}`,
    `//   run(false).totalCharged = ${ORDER.v * 2}`,
    'fun run(useKey) {',
    '    var proc = Processor([], 0)',
    `    var pipe = Pipeline(${EVENTS.indexOf(ORDER)}, [])`,
    '    proc = sinkWrite(proc, pipe, ORDER)        // pass 1: charges',
    '    pipe = crash(pipe)                         // offset NOT committed',
    '    if (useKey == false) { proc = Processor([], proc.totalCharged) }',
    '    proc = sinkWrite(proc, pipe, ORDER)        // pass 2: the replay',
    '    return proc',
    '}',
    '',
    '// function: main() — THE CALLER: with the key, and without it.',
    'fun main() {',
    '    val withKey    = run(true)',
    '    val withoutKey = run(false)',
    '    val doubled    = withoutKey.totalCharged - withKey.totalCharged',
    '}',
  ]),
  heap: {
    withKey:    { addr: '0x100', type: 'Processor', val: () => `chargedKeys ["order-${ORDER.id}"] · totalCharged ${ORDER.v}` },
    withoutKey: { addr: '0x200', type: 'Processor', val: () => `chargedKeys ["order-${ORDER.id}"] · totalCharged ${ORDER.v * 2}` },
    pipe:       { addr: '0x300', type: 'Pipeline', val: () => `offset ${EVENTS.indexOf(ORDER)} · seen [] (lost in the crash)` },
  },
  steps: (at) => {
    const MAIN = (o = {}) => ({ name: 'main', locals: [
      `withKey = ${o.withKey || '...'}`, `withoutKey = ${o.withoutKey || '...'}`,
      `doubled = ${o.doubled !== undefined ? o.doubled : '...'}`] });
    const RUN = (o) => ({ name: 'run', locals: [`useKey = ${o.k}`, `proc = ${o.p}`, 'pipe = @0x300'] });
    return [
      { t: 'pass 1 — the dedup set admits it, and the charge lands', line: at('fun sinkWrite(proc, pipe, e)', 'proc = charge(proc, "order-" + e.id, e.v)', '    proc = sinkWrite(proc, pipe, ORDER)        // pass 1: charges'),
        stack: [MAIN(), RUN({ k: 'true', p: '@0x100' }), { name: 'sinkWrite', locals: ['proc = @0x100', 'pipe = @0x300', `e = EVENTS[${ORDER.id}]`] }],
        heap: [{ key: 'withKey', hot: true }, { key: 'pipe' }],
        cap: `\`pipe.seen\` is empty, so the record is admitted, and the key is built from \`e.id\` — \`"order-${ORDER.id}"\`, derived from the data. \`totalCharged\` goes 0 → ${ORDER.v}. Everything about this pass is correct, which is the point: the problem is entirely in what happens next.` },
      { t: 'the crash takes the seen-set and leaves the offset', line: at('fun crash(pipe)', 'return Pipeline(pipe.offset, [])'),
        stack: [MAIN(), RUN({ k: 'true', p: '@0x100' }), { name: 'crash', locals: ['pipe = @0x300'] }],
        heap: [{ key: 'withKey' }, { key: 'pipe', hot: true }],
        cap: `\`seen\` becomes \`[]\` while \`offset\` stays ${EVENTS.indexOf(ORDER)}. That asymmetry is the whole scenario: the offset was durable and the dedup set was in memory, so the replay will re-read record ${ORDER.id} AND the shuffle will think it is new. The dedup guard is gone exactly when it is needed.` },
      { t: 'pass 2 — dedup lets it through, and the KEY stops it', line: at('fun charge(proc, key, amount)', 'if (contains(proc.chargedKeys, key)) { return proc }'),
        stack: [MAIN({ withKey: '@0x100' }), RUN({ k: 'true', p: '@0x100' }),
                { name: 'sinkWrite', locals: ['proc = @0x100', 'pipe = @0x300', `e = EVENTS[${ORDER.id}]`] },
                { name: 'charge', locals: ['proc = @0x100', `key = "order-${ORDER.id}"`, `amount = ${ORDER.v}`] }],
        heap: [{ key: 'withKey', hot: true }, { key: 'pipe' }],
        cap: `\`contains(pipe.seen, ${ORDER.id})\` is false — the set was cleared — so \`sinkWrite\` calls \`charge\` again. The processor's \`chargedKeys\` still holds "order-${ORDER.id}", so it returns early and \`totalCharged\` stays ${ORDER.v}. The guarantee came from the one piece of state outside the pipeline.` },
      { t: `and without the key the same run charges ${ORDER.v * 2}`, line: at('    val doubled    = withoutKey.totalCharged - withKey.totalCharged'),
        stack: [MAIN({ withKey: '@0x100', withoutKey: '@0x200', doubled: ORDER.v })],
        heap: [{ key: 'withKey' }, { key: 'withoutKey', hot: true }],
        cap: `\`doubled\` = ${ORDER.v} — a full second charge. Read the two heap rows: identical pipelines, identical crash, and the only difference is whether the processor remembered the key across it. That is why the key is the mechanism and the dedup shuffle is an optimisation.` },
    ];
  },
  intro: [
    `**What is being answered.** Why the dedup shuffle does not save this pipeline — as a crash that is traced through the one line that matters.`, '',
    `\`crash(pipe)\` is the step to read twice: it returns \`Pipeline(pipe.offset, [])\`. The **offset survives** because it was committed; the **seen-set does not** because it was in memory. So the replay re-reads record ${ORDER.id} *and* the shuffle thinks it is new.`, '',
    `Everything then rests on \`charge\`'s early return, which reads \`proc.chargedKeys\` — the only state that lived outside the crashed process. With it: ${ORDER.v}. Without it: ${ORDER.v * 2}.`],
  sub: `Both charge totals are computed from the seed and asserted.` });

for (const g of PROGRAMS) {
  const M2 = buildMemoryWalkthrough({ src: g.src, heap: g.heap, steps: [], name: g.name,
    title: g.title, subtitle: g.subtitle, out: path.join(__dirname, '..', 'diagrams', 'anim', g.name) });
  const steps = g.steps(M2.at, M2.lineOf, M2.linesWith);
  const r = M2.emit(steps);
  M2.embed({ gen: 'gen_ch05.js', heading: g.title.replace(/ —.*$/, ' — stack and heap at every step'),
    rel: `../diagrams/anim/${g.name}`, intro: g.intro,
    sub: g.sub + ' Generated by `node tools/gen_ch05.js` on `tools/memkit.js`.' });
  console.log(`OK  ${g.name}: ${r.steps} frames ${r.W}x${r.H}`);
}
