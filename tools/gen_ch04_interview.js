#!/usr/bin/env node
'use strict';
/*
 * gen_ch04_interview.js — ch04's interview problem: grouping times into runs separated by
 * a gap, when the times arrive out of order and one late arrival can join two runs.
 *
 * SCOPE, deliberately narrow: the section may discuss only what the traced program
 * solves — a sorted sweep, which existing runs a new time touches, merging all of them
 * into one, and what the consumer has to be told when a run it was already shown changes.
 * No triggers, no watermarks, no chapter vocabulary.
 *
 * G is a DECLARED parameter of this problem, not the chapter's: at the chapter's gap no
 * arrival in this dataset bridges two runs, and the whole section is about that case.
 */
const path = require('path');
const { buildInterviewSection } = require('./interviewkit.js');
const S = require('./stream_seed.js');

// Every entry time in the log, in the order the pipeline sees them. One key's events
// alone cannot show the case this section is about: for the only out-of-order key, the gap
// that permits the merge is also the gap that collapses everything into one run, so the
// two requirements are mutually exclusive. The whole log has both.
const ARRIVALS = S.EVENTS.map(e => e.et);
const N = ARRIVALS.length;
// The chapter's gap is 120, and at 120 every arrival in this log joins at most ONE run —
// so the case this section exists for would never occur. G is part of the QUESTION (a
// product decision about what counts as one visit), so declaring it here chooses the
// example's parameter, not its data. At 47 the seed's deliberately LATE event is the one
// that bridges two runs, which is exactly the narrative the chapter's own dataset was
// built for. The choice is stated rather than quietly arrived at.
const G = 47;

const sweep = (times) => { const s = [...times].sort((a, b) => a - b); const out = [];
  for (const t of s) { const last = out[out.length - 1];
    if (last && t - last.end <= G) last.end = t; else out.push({ start: t, end: t }); }
  return out; };
const BATCH = sweep(ARRIVALS);

const touching = (ss, t) => ss.filter(s => t >= s.start - G && t <= s.end + G);
const insert = (ss, t) => {
  const hit = touching(ss, t);
  const rest = ss.filter(s => !hit.includes(s));
  const start = Math.min(t, ...hit.map(s => s.start));
  const end = Math.max(t, ...hit.map(s => s.end));
  return { next: [...rest, { start, end }].sort((a, b) => a.start - b.start), hit, start, end };
};
const RUN = (() => { let ss = []; const trace = [];
  for (let i = 0; i < N; i++) { const t = ARRIVALS[i]; const before = ss.map(s => ({ ...s })); const r = insert(ss, t); ss = r.next;
    const act = r.hit.length >= 2 ? 'MERGE' : r.hit.length === 1 ? 'extend' : 'new';
    // what a consumer already shown `before` has to be told
    const gone = before.filter(b => !ss.some(s => s.start === b.start && s.end === b.end));
    trace.push({ i, t, act, hit: r.hit.map(s => `${s.start}..${s.end}`), ss: ss.map(s => ({ ...s })), gone }); }
  return { ss, trace }; })();
const FINAL = RUN.ss;

const MERGE = RUN.trace.find(t => t.act === 'MERGE');
const EXT = RUN.trace.find(t => t.act === 'extend');
const NEW = RUN.trace.filter(t => t.act === 'new');
const RETRACTED = RUN.trace.filter(t => t.gone.length).reduce((a, t) => a + t.gone.length, 0);
const BACKWARDS = RUN.trace.filter(t => t.gone.some(g => RUN.ss.some(s => s.end === g.end && s.start < g.start)));

const ssStr = (ss) => ss.map(s => `${s.start}..${s.end}`).join('  ') || '(none)';
const BIGN = 1000000;

const fail = (m) => { throw new Error(`gen_ch04_interview: ${m}`); };
if (!ARRIVALS.some((t, i) => i > 0 && t < ARRIVALS[i - 1])) fail('the arrivals are in order, so the out-of-order half of the problem never happens');
if (!MERGE) fail(`no arrival joins two runs at G = ${G} — the case this section is about has no worked example`);
if (!EXT) fail('no arrival merely extends one run, so the ordinary case is never shown');
if (NEW.length < 2) fail('fewer than two arrivals start a new run');
if (ssStr(FINAL) !== ssStr(BATCH)) fail(`the incremental answer ${ssStr(FINAL)} disagrees with the sorted sweep ${ssStr(BATCH)}`);
if (!RETRACTED) fail('no run ever stopped existing, so nothing shows that an already-reported answer has to be withdrawn');
if (MERGE.gone.length < 2) fail('the merging arrival did not remove two runs; the retraction frame has nothing to point at');
if (!BACKWARDS.length) fail('no run ever acquired an EARLIER start, so the "the start is not a stable key" point has no worked case');
if (sweep(ARRIVALS).length === 1) fail('everything collapses into one run, so the gap does nothing');

const SRC = [
  `// primitive: len(xs) — element count.  len(ARRIVALS) = ${N}`,
  '// primitive: ARRIVALS — the times, in the order they arrive. NOT sorted.',
  `//   ARRIVALS = [${ARRIVALS.join(', ')}]   ·   sorted they are [${[...ARRIVALS].sort((a, b) => a - b).join(', ')}]`,
  `// primitive: G = ${G} — two times belong to the same run if they are no further apart.`,
  '// primitive: run(start, end) — one run, written start..end. A single time is start==end.',
  `//   run(${ARRIVALS[0]}, ${ARRIVALS[0]}) = ${ARRIVALS[0]}..${ARRIVALS[0]}`,
  '// primitive: startOf(r) / endOf(r) — the two ends of a run.',
  `//   startOf(${ssStr(FINAL).split('  ')[0]}) = ${FINAL[0].start}   ·   endOf(${ssStr(FINAL).split('  ')[0]}) = ${FINAL[0].end}`,
  '// primitive: minOf(xs) / maxOf(xs) — the smallest and largest of a list.',
  `//   minOf([${MERGE.hit.map(h => h.split('..')[0]).concat(String(MERGE.t)).join(', ')}]) = ${MERGE.ss.find(s => s.start <= MERGE.t && s.end >= MERGE.t).start}`,
  '// primitive: ascending(times) — a sorted copy.',
  `//   ascending([${ARRIVALS.slice(0, 3).join(', ')}]) = [${[...ARRIVALS.slice(0, 3)].sort((a, b) => a - b).join(', ')}]`,
  '// primitive: last(runs) — the final run in a list.',
  `//   last(${ssStr(BATCH)}) = ${ssStr([BATCH[BATCH.length - 1]])}`,
  '// primitive: setEnd(r, t) — move a run\'s end to t.',
  `//   setEnd(${ARRIVALS[0]}..${ARRIVALS[0]}, ${ARRIVALS[1]}) = ${ARRIVALS[0]}..${ARRIVALS[1]}`,
  '// primitive: starts(runs) / ends(runs) — the two ends of each run, as lists.',
  `//   starts(${MERGE.hit.join(' ')}) = [${MERGE.hit.map(h => h.split('..')[0]).join(', ')}]`,
  '// primitive: contains(runs, r) — is that exact run still in the list?',
  `//   contains(${ssStr(FINAL)}, ${ssStr([FINAL[0]])}) = true`,
  '// primitive: byStart(runs) — the runs ordered by where they begin.',
  `//   byStart(${ssStr(FINAL)}) = ${ssStr(FINAL)}`,
  '// primitive: without(runs, some) — the runs that are not in `some`.',
  `//   without(${ssStr(FINAL)}, ${ssStr([FINAL[0]])}) = ${ssStr(FINAL.slice(1))}`,
  '',
  '// THE QUESTION, as asked:',
  '//   "Door entries give one person\'s times. A VISIT is a run of entries with no gap',
  '//    longer than G. The times arrive OUT OF ORDER, and keep arriving. Report the',
  '//    visits after each arrival. 10^6 entries."',
  '',
  '// function: sweep(times) — the batch answer: sort, then walk. Only correct if every',
  `//   time has already arrived.  sweep(ARRIVALS) = ${ssStr(BATCH)}`,
  'fun sweep(times) {',
  '    val sorted = ascending(times)',
  '    var out = []',
  '    for (t in sorted) {',
  '        if (len(out) > 0) {',
  '            if (t - endOf(last(out)) <= G) { setEnd(last(out), t) }',
  '            else { out.append(run(t, t)) }',
  '        }',
  '        else { out.append(run(t, t)) }',
  '    }',
  '    return out',
  '}',
  '',
  '// function: touching(runs, t) — every run this time could join: one whose end is within',
  '//   G after t, or whose start is within G before it. There may be SEVERAL.',
  `//   touching(runs, ${MERGE.t}) = ${MERGE.hit.join(' and ')}  <- two of them`,
  `//   touching(runs, ${EXT.t}) = ${EXT.hit.join(' and ')}`,
  'fun touching(runs, t) {',
  '    var hit = []',
  '    for (r in runs) {',
  '        if (t >= startOf(r) - G) {',
  '            if (t <= endOf(r) + G) { hit.append(r) }',
  '        }',
  '    }',
  '    return hit',
  '}',
  '',
  '// function: absorb(runs, t) — replace every touched run, and the new time, with ONE run',
  '//   spanning all of them. This is where a late time joins two visits.',
  `//   absorb(runs, ${MERGE.t}) turns ${MERGE.hit.join(' + ')} into ${MERGE.ss.find(s => s.start <= MERGE.t && s.end >= MERGE.t).start}..${MERGE.ss.find(s => s.start <= MERGE.t && s.end >= MERGE.t).end}`,
  'fun absorb(runs, t) {',
  '    val hit  = touching(runs, t)',
  '    val rest = without(runs, hit)',
  '    val lo   = minOf(starts(hit) + [t])',
  '    val hi   = maxOf(ends(hit) + [t])',
  '    rest.append(run(lo, hi))',
  '    return byStart(rest)',
  '}',
  '',
  '// function: withdrawn(before, after) — runs the consumer was shown that no longer exist.',
  '//   Nothing can un-send a report, so these have to be revisable.',
  `//   withdrawn at arrival ${MERGE.t} = ${MERGE.gone.map(g => `${g.start}..${g.end}`).join(' and ')}`,
  'fun withdrawn(before, after) {',
  '    var gone = []',
  '    for (r in before) {',
  '        if (contains(after, r) == false) { gone.append(r) }',
  '    }',
  '    return gone',
  '}',
  '',
  '// function: main() — the batch answer, then the same thing one arrival at a time.',
  'fun main() {',
  `    val batch = sweep(ARRIVALS)       // ${ssStr(BATCH)}`,
  ...ARRIVALS.map((t, i) => `    runs = absorb(runs, ${String(t).padEnd(3)})      // ${RUN.trace[i].act.padEnd(6)} -> ${ssStr(RUN.trace[i].ss)}`),
  `    // ${RETRACTED} run(s) had to be withdrawn along the way`,
  '}',
];

const HEAP = {
  arrivals: { addr: '0x100', type: `int[${N}]`, val: () => `[${ARRIVALS.join(', ')}]` },
  runs:     { addr: '0x200', type: 'run[]', val: (st) => st === undefined ? ssStr(FINAL) : (st === 0 ? '(none)' : st) },
  batch:    { addr: '0x300', type: 'run[]', val: () => ssStr(BATCH) },
};

const MAIN = (o = {}) => ({ name: 'main', locals: [
  `batch = ${o.batch === undefined ? '...' : o.batch}`,
  `runs = ${o.runs === undefined ? '...' : o.runs}`] });
const SW = (o = {}) => ({ name: 'sweep', locals: [
  'times = @0x100', `sorted = ${o.sorted}`, `out = ${o.out}`, `t = ${o.t === undefined ? '...' : o.t}`] });
const TO = (o = {}) => ({ name: 'touching', locals: [
  'runs = @0x200', `t = ${o.t}`, `hit = ${o.hit === undefined ? '[]' : o.hit}`, `r = ${o.r === undefined ? '...' : o.r}`] });
const AB = (o = {}) => ({ name: 'absorb', locals: [
  'runs = @0x200', `t = ${o.t}`,
  `hit = ${o.hit === undefined ? '...' : o.hit}`,
  `rest = ${o.rest === undefined ? '...' : o.rest}`,
  `lo = ${o.lo === undefined ? '...' : o.lo}`,
  `hi = ${o.hi === undefined ? '...' : o.hi}`] });
const WD = (o = {}) => ({ name: 'withdrawn', locals: [
  `before = ${o.before}`, `after = ${o.after}`,
  `gone = ${o.gone === undefined ? '[]' : o.gone}`, `r = ${o.r === undefined ? '...' : o.r}`] });

const MI = RUN.trace.indexOf(MERGE), EI = RUN.trace.indexOf(EXT);
const MERGED_RUN = MERGE.ss.find(s => s.start <= MERGE.t && s.end >= MERGE.t);
const BW = BACKWARDS[0];

const steps = (at) => [
  { t: `${N} times, out of order, and still arriving`, line: at('val batch = sweep(ARRIVALS)'),
    stack: [MAIN()], heap: [{ key: 'arrivals' }],
    cap: `0x100 holds [${ARRIVALS.join(', ')}] in the order they arrive; sorted they are [${[...ARRIVALS].sort((a, b) => a - b).join(', ')}]. Two facts from the question do all the work: the times are **out of order**, and they **keep arriving** — so any answer that needs all of them first is answering a different question.` },

  { t: `the batch answer: sort, then walk`, line: at('if (t - endOf(last(out)) <= G) { setEnd(last(out), t) }'),
    stack: [MAIN(), SW({ sorted: `[${[...ARRIVALS].sort((a, b) => a - b).join(', ')}]`, out: ssStr(BATCH.slice(0, 1)), t: [...ARRIVALS].sort((a, b) => a - b)[1] })],
    heap: [{ key: 'batch', hot: true }],
    cap: `Sorted, each time either extends the current run or starts a new one, and one comparison decides which: ${ssStr(BATCH)}. O(n log n) for the sort and O(n) for the walk — and it is only correct **once every time has arrived**, which the question says will not happen.` },

  { t: `so: which runs does one new time touch?`, line: at('if (t <= endOf(r) + G) { hit.append(r) }'),
    stack: [MAIN({ batch: ssStr(BATCH) }), TO({ t: ARRIVALS[0], hit: '[]', r: 'none yet' })],
    heap: [{ key: 'runs', st: 0, hot: true }],
    cap: `A time joins a run if it is within G of either end — so the test is two comparisons against a run's start and end, not against its members. With no runs yet, nothing is touched and the time becomes a run of its own.` },

  { t: `arrival ${NEW[1].t}: ${NEW[1].act} — a second run`, line: at('rest.append(run(lo, hi))'),
    stack: [MAIN({ batch: ssStr(BATCH) }), AB({ t: NEW[1].t, hit: '[]', rest: ssStr(RUN.trace[NEW[1].i - 1].ss), lo: NEW[1].t, hi: NEW[1].t })],
    heap: [{ key: 'runs', st: ssStr(NEW[1].ss), hot: true }],
    cap: `${NEW[1].t} is more than ${G} from everything so far, so a new run appears and 0x200 holds ${ssStr(NEW[1].ss)}. Note the shape of the state: **the runs, not the times.** Keeping the times would mean re-sweeping on every arrival; keeping the runs means the work per arrival depends on how many runs there are.` },

  { t: `arrival ${EXT.t}: ${EXT.act}s one run`, line: at('val lo   = minOf(starts(hit) + [t])'),
    stack: [MAIN({ batch: ssStr(BATCH) }), AB({ t: EXT.t, hit: `[${EXT.hit.join(', ')}]`, rest: ssStr(RUN.trace[EI].ss.filter(s => !(s.start <= EXT.t && s.end >= EXT.t))), lo: EXT.hit.length ? Math.min(EXT.t, ...EXT.hit.map(h => +h.split('..')[0])) : EXT.t })],
    heap: [{ key: 'runs', st: ssStr(EXT.ss), hot: true }],
    cap: `${EXT.t} touches exactly one run, ${EXT.hit[0]}, so that run's ends widen to cover it: ${ssStr(EXT.ss)}. This is the case everyone implements, and it is why the next frame is the question — one touched run is the easy half.` },

  { t: `arrival ${MERGE.t} touches ${MERGE.hit.length} runs`, line: at('fun touching(runs, t)::return hit'),
    stack: [MAIN({ batch: ssStr(BATCH) }), TO({ t: MERGE.t, hit: `[${MERGE.hit.join(', ')}]`, r: MERGE.hit[MERGE.hit.length - 1] })],
    heap: [{ key: 'runs', st: ssStr(RUN.trace[MI - 1].ss), hot: true }],
    cap: `${MERGE.t} is within ${G} of **both** ${MERGE.hit.join(' and ')} — it sits in the gap that was keeping them apart. This is the case the out-of-order clause exists for, and an implementation that stops at the first match widens one run and leaves the other, so two runs claim overlapping time and the total is wrong.` },

  { t: `so all ${MERGE.hit.length} become ONE`, line: at('fun absorb(runs, t)::return byStart(rest)'),
    stack: [MAIN({ batch: ssStr(BATCH) }), AB({ t: MERGE.t, hit: `[${MERGE.hit.join(', ')}]`, rest: ssStr(RUN.trace[MI - 1].ss.filter(s => !MERGE.hit.includes(`${s.start}..${s.end}`))), lo: MERGED_RUN.start, hi: MERGED_RUN.end })],
    heap: [{ key: 'runs', st: ssStr(MERGE.ss), hot: true }],
    cap: `${MERGE.hit.join(' + ')} and ${MERGE.t} become ${MERGED_RUN.start}..${MERGED_RUN.end}, and 0x200 is now ${ssStr(MERGE.ss)}. Taking the smallest start and largest end over **all** touched runs plus the new time handles one, two or ten of them with the same two lines — which is why \`touching\` returns a list rather than a run.` },

  { t: `but ${MERGE.gone.length} runs the consumer was shown no longer exist`, line: at('if (contains(after, r) == false) { gone.append(r) }'),
    stack: [MAIN({ batch: ssStr(BATCH), runs: ssStr(MERGE.ss) }), WD({ before: ssStr(RUN.trace[MI - 1].ss), after: ssStr(MERGE.ss), gone: `[${MERGE.gone.map(g => `${g.start}..${g.end}`).join(', ')}]`, r: `${MERGE.gone[MERGE.gone.length - 1].start}..${MERGE.gone[MERGE.gone.length - 1].end}` })],
    heap: [{ key: 'runs', hot: true }],
    cap: `${MERGE.gone.map(g => `${g.start}..${g.end}`).join(' and ')} were already reported and are now wrong — not extended, **gone**, replaced by one run spanning both. ${RETRACTED} run${RETRACTED === 1 ? '' : 's'} are withdrawn over the whole stream. Nothing can un-send a report, so the output cannot be a stream of appends; it has to be revisable.` },

  { t: `and the start is not a stable key`, line: at('fun withdrawn(before, after)::return gone'),
    stack: [MAIN({ batch: ssStr(BATCH), runs: ssStr(RUN.trace[RUN.trace.length - 1].ss) }), WD({ before: ssStr(RUN.trace[N - 2].ss), after: ssStr(FINAL), gone: `[${(RUN.trace[N - 1].gone[0] ? `${RUN.trace[N - 1].gone[0].start}..${RUN.trace[N - 1].gone[0].end}` : '')}]` })],
    heap: [{ key: 'runs', hot: true }],
    cap: `Run ${BW.gone[0].start}..${BW.gone[0].end} later acquires an **earlier** start, because a time arrived before it. So "the run beginning at ${BW.gone[0].start}" is not a name that survives — which rules out the obvious design of keying the output on the start. A stable identity has to come from somewhere the data does not move: an id minted when the run is first created, and carried through every merge.` },

  { t: `the incremental answer matches the batch one`, line: at('fun sweep(times)::return out'),
    stack: [MAIN({ batch: ssStr(BATCH), runs: ssStr(FINAL) })],
    heap: [{ key: 'batch' }, { key: 'runs', hot: true }],
    cap: `${ssStr(FINAL)} from ${N} arrivals one at a time, and ${ssStr(BATCH)} from sorting everything — asserted equal. That equality is the thing to check before trusting any streaming implementation, and it is the only check that catches a \`touching\` that stops at the first match, because that bug produces plausible runs.` },

  { t: 'what each arrival costs', line: at('fun absorb(runs, t)::val hit  = touching(runs, t)'),
    stack: [MAIN({ batch: ssStr(BATCH), runs: ssStr(FINAL) })],
    heap: [{ key: 'runs' }],
    cap: `\`touching\` as written looks at every run, which is fine at ${FINAL.length} and not at ${BIGN.toLocaleString('en-US')} entries spread over thousands of runs. The runs are kept ordered by start and never overlap, so the touched ones are a **contiguous slice** — findable by bisection and then walked, giving log plus the number actually merged. The ordering is already maintained, so this costs nothing to add and is the difference between O(runs) and O(log runs) per arrival.` },

  { t: 'and the question nobody asked', line: at('runs = absorb(runs, ' + ARRIVALS[N - 1]),
    stack: [MAIN({ batch: ssStr(BATCH), runs: ssStr(FINAL) })],
    heap: [{ key: 'arrivals' }, { key: 'runs' }],
    cap: `State grows with the number of open runs and nothing above ever removes one — at ${BIGN.toLocaleString('en-US')} entries over years, the runs from the first week are still in memory waiting for a time that will never arrive. So a real answer needs a point at which a run is declared finished and dropped, which is a decision about **how late a time may be** rather than an algorithm. Volunteering that is worth more than the merge, because the merge is a puzzle and this is what makes the thing run for a year.` },
];

const r = buildInterviewSection({
  name: 'ch04-interview-memory',
  out: path.join(__dirname, '..', 'diagrams', 'anim', 'ch04-interview-memory'),
  gen: 'gen_ch04_interview.js',
  title: 'Runs separated by a gap, built as they arrive — stack and heap at every step',
  subtitle: `${N} out-of-order times, G = ${G} → ${ssStr(FINAL)} · one arrival joins ${MERGE.hit.length} runs · ${RETRACTED} run(s) withdrawn`,
  problem: {
    surface: 'access logs',
    statement: [`**A door log gives one person's entry times.** A **visit** is a run of entries with no gap longer than \`G\`.`, '',
      `The times **arrive out of order**, and they **keep arriving**. **Report the visits after each arrival.**`, '',
      `10⁶ entries.`],
    example: [`\`[${ARRIVALS.join(', ')}]\` with G = ${G} → ${ssStr(FINAL)}. Arrival ${MERGE.t} turns ${MERGE.hit.join(' and ')} into a single visit.`],
    constraints: [`Times are integers. A visit already reported may turn out to be wrong.`],
  },
  model: [
    `Sorted, this is easy: walk the times and each one either extends the current run or starts a new one. The question removes that — the times arrive **out of order** and **keep arriving**, so there is no moment at which sorting is possible.`, '',
    `So keep the **runs**, not the times, and the question becomes what one new time does to them. It joins any run whose start is within \`G\` after it or whose end is within \`G\` before it — two comparisons per run, against the ends rather than the members.`, '',
    `And here is the case the out-of-order clause exists for: a time can touch **more than one** run, because it lands in the gap that was keeping them apart. So they all become one: take the smallest start and the largest end over every touched run plus the new time, and the same two lines handle one, two or ten. An implementation that stops at the first match widens one run and leaves the other, producing two runs that claim overlapping time — plausible output, wrong totals.`, '',
    `Two consequences that the algorithm cannot fix, and they are what the question is really for.`, '',
    `**Runs you already reported stop existing.** The merge above does not extend a run, it **replaces two**. Nothing can un-send a report, so the output cannot be a stream of appends — a consumer must be able to revise. And the obvious revision key does not work either: a run can acquire an **earlier start** when a time arrives before it, so "the run beginning at ${BW.gone[0].start}" is not a name that survives. Identity has to be minted when a run is created and carried through every merge.`, '',
    `**State grows and nothing above shrinks it.** Every open run stays in memory waiting for a time that may never come. A real answer needs a point at which a run is declared finished and dropped, which is a decision about how late a time may be — not an algorithm, and the thing that decides whether this runs for a year.`,
  ],
  variations: [
    { name: 'the calendar that will not double-book', surface: 'scheduling',
      statement: [`Meetings are booked and cancelled continuously. **Reject any booking that overlaps an existing one**, and report the free gaps.`],
      whyHard: `Insertion is the same shape with the gap set to zero, and the new operation is the hard one: **cancellation splits a run**, which nothing above can do. Merging is easy because the merged run is determined by its ends; splitting is not, because once two bookings have been merged into one span the information needed to separate them is gone. So the state cannot be the merged runs at all — it has to be the individual bookings, with the merge computed on read. Recognising that the chapter's state shape is only valid for an append-only stream is the whole answer.`,
      maps: `\`touching\` with G = 0 for the overlap test, and \`absorb\` kept — but the stored state changes from runs to members, which is a different program with the same lookup.` },

    { name: 'the island count', surface: 'puzzles',
      statement: [`Positions on a line are turned on one at a time, in any order. **After each one, report how many contiguous stretches are on.**`],
      whyHard: `It is this problem with G = 1 and only a count wanted, and dropping the detail makes a much better answer available: a new position can join at most **two** stretches, so the count changes by exactly +1, 0 or −1 and nothing has to be searched. The non-obvious part is that this is reachable with no interval structure at all — a map from each stretch's endpoints to its length, consulted at the two neighbours, which is O(1) per position against the chapter's O(log runs). Noticing that the question asked only for a count is where the saving comes from.`,
      maps: `\`touching\` reduced to checking the two adjacent positions, and \`absorb\` to arithmetic on a count. The ${MERGE.hit.length}-run merge in the trace is the −1 case.` },

    { name: 'the deduplicated alert', surface: 'operations',
      statement: [`A monitor fires repeatedly while a system is unhealthy. **Group the firings into incidents** — no gap longer than \`G\` — and page once per incident.`],
      whyHard: `The grouping is identical and the paging is what breaks: you must page while the incident is open, which means acting on a run **before** you know it is finished, and then a later firing within \`G\` must not page again. So the retraction problem from the trace becomes a paging problem — if two incidents merge, somebody was paged twice for what turned out to be one. The useful answer is that \`G\` is now two decisions, not one: how long to wait before paging, and how long before declaring the incident over, and they need not be the same number.`,
      maps: `\`absorb\` unchanged, with the withdrawal in the traced frames reinterpreted as a page that should not have been sent — which is why the stable-identity point matters here most.` },
  ],
  program: {
    src: SRC, heap: HEAP, steps, rel: '../diagrams/anim/ch04-interview-memory',
    heading: 'The solution as a running program — stack and heap at every step',
    intro: [
      `The reframe above is six paragraphs; this is the batch answer and then the same thing built one arrival at a time, with the two things a whiteboard cannot show — **what is allocated, and when**.`, '',
      `Measured on [${ARRIVALS.join(', ')}] with G = ${G}: the sorted sweep gives ${ssStr(BATCH)}, and ${N} arrivals processed in order give ${ssStr(FINAL)} — asserted equal. Along the way one arrival **starts** a run, one **extends** one, and arrival ${MERGE.t} **joins ${MERGE.hit.length}** of them into ${MERGED_RUN.start}..${MERGED_RUN.end}. ${RETRACTED} run${RETRACTED === 1 ? ' that was already reported stops' : 's that were already reported stop'} existing, and one run later acquires an earlier start — which is what rules out keying the output on it.`],
    sub: `Locals live in the frame and vanish when it is popped; 0x200 holds the **runs** rather than the times, which is what makes the work per arrival depend on the number of runs instead of the number of entries. G is a declared parameter of this problem rather than the chapter's, and the source says why: at the chapter's gap nothing in this dataset joins two runs, and that case is the whole section. Every figure is derived from \`tools/stream_seed.js\` and asserted — including that the arrivals are genuinely out of order, that one arrival joins two or more runs, that another merely extends one, that at least two start new ones, that the incremental answer equals the sorted sweep, that something really is withdrawn, and that some run really does acquire an earlier start. Generated by \`node tools/gen_ch04_interview.js\` on \`tools/interviewkit.js\`.`,
  },
});
console.log(`OK  ${r.steps} steps, canvas ${r.W}x${r.H} (${r.total}s loop) -> diagrams/anim/ch04-interview-memory`);
console.log(`    G=${G} arrivals [${ARRIVALS.join(',')}] -> ${ssStr(FINAL)} (batch ${ssStr(BATCH)}) · merge at ${MERGE.t} joined ${MERGE.hit.length} · withdrawn ${RETRACTED}`);
