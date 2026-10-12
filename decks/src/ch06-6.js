// Chapter 6, Part 6 — Variation 3 of the interview question ("the audit log that was
// compacted"), built as a program WITH the viewer. Every code slide asks what the next piece
// must do, then reveals the real lines from programs/ch06_v3.py (read at build time by
// _prog.js, addressed by content, never by line number). The last slides show the whole file
// and what it actually prints (programs/ch06_v3.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch06';
const P = program('ch06_v3.py');
const OUT = program('ch06_v3.out');

// the record log and the survivors, read from the program itself so the slides cannot drift
const triples = needle => [...P.lines[P.at(needle)].matchAll(/\("(\w)", (\d+), (\d+)\)/g)].map(m => [m[1], +m[2], +m[3]]);
const LOG = [...triples('RECORD_LOG = [("a", 5, 40)'), ...P.lines.slice(P.at('RECORD_LOG = [("a", 5, 40)') + 1).slice(0, 1).flatMap(l => [...l.matchAll(/\("(\w)", (\d+), (\d+)\)/g)].map(m => [m[1], +m[2], +m[3]]))];
const KEPT = triples('STATE_LOG = [');
const kept = e => KEPT.some(k => k.join() === e.join());
const AFTER_JOB = LOG.map(e => (kept(e) ? 'kept' : 'deleted'));
const num = needle => Number(P.lines[P.at(needle)].split('=')[1].split('#')[0]);
const CUT = num('COMPACTED_ON = 640'), ASK = num('ASKED_DAY = 300');

// the pieces, in the order they are written
const DATA = P.span('# The record log, from the chapter', 'UNANSWERABLE = "UNANSWERABLE"');
const FOLD = P.fn('fold');
const RETAINED = P.fn('retained');
const VALUE = P.fn('value_as_of');
const BLIND = P.fn('value_as_of_date_blind');
const PRESENT = P.fn('answer_from_current_state');
const REPLAY = P.fn('replay_tables');
const COUNT = P.fn('answerable_questions');
const EDGE = P.fn('earliest_answerable');
const SHOWN = P.fn('shown');
const EXTRA = P.span('# A one-entry log, an empty log', 'for i in range(BIG_CHANGE_COUNT)]');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const M1 = P.span('def main():', 'argument the retention job was approved on');
const M2 = P.span('# what was destroyed, counted', 'a clean cut at the day a disk job happened to run');
const M3 = P.span('# the two-log split, priced', 'a customer; an unknown record is');
const M4 = P.span('# the day-by-day replay is an independent', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 19 examples agree with a max over the surviving entries',
  'retention job ran on 2025-10-02; what is left:', '9 entries became 5: 4 deleted',
  "the regulator asks: what did record 'a' hold on 2024-10-27?", 'uncompacted audit log  -> 8',
  'compacted state log    -> UNANSWERABLE', 'from the current table -> 24   (instant, confident, wrong)',
  "both logs fold to the same table {'a': 24, 'b': 21}", 'of 202 (record, date) questions on a 10-day grid:',
  'the audit log answers 172', 'the state log answers 96   (76 destroyed)',
  "the edge: record 'a' is answerable from 2025-05-15, 'b' from 2025-07-14;",
  'keeping both logs would cost 9 + 5 = 14 entries instead of 5', '2024-07-09 -> 8 (inclusive), 2024-07-08 -> 5',
  'lost 2,333 answers', 'wrong 22,055 times', 'state log 50 entries, audit log 5,000 -- 100x the storage', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch06_v3.out no longer prints "${s}" — rewrite the narration`);
if (LOG.length !== 9 || KEPT.length !== 5 || AFTER_JOB.filter(x => x === 'deleted').length !== 4 || CUT !== 640 || ASK !== 300
  || LOG.filter(e => e[0] === 'a').map(e => `${e[1]}@${e[2]}`).join() !== '5@40,8@190,10@420,16@500,24@900')
  throw new Error('programs/ch06_v3.py no longer has the log this deck explains — rewrite the narration');

module.exports = {
  title: 'The Compacted Audit',
  eyebrow: 'Streaming · Ch 6 · Part 6',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['record', 'entry', 'log', 'effective day', 'regulator', 'function', 'fold', 'table', 'retention job',
    'unanswerable', 'state log', 'audit log', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 6 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 6 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 6 · Variation 3, the audit log')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['record', 'entry', 'log', 'effective day', 'regulator'],
      eyebrow: '01 · A Google interview question, Variation 3',
      heading: 'A regulator asks about the past, and the log was compacted',
      hero: { step: 0, text: 'A company keeps customer <b>records</b>, “a” and “b”, each holding one number. Every change is an <b>entry</b> in a <b>log</b>: which record, its new value, and the <b>effective day</b> it took effect. Days count from 0, which is 1 January 2024. A <b>regulator</b>, an official who can demand the company’s history, asks a question.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'entries in the log[[src:vars]]' },
        { step: 1, value: ASK, label: 'the day asked about: 2024-10-27[[src:vars]]' },
        { step: 2, value: CUT, label: 'the day a disk-saving job ran[[src:vars]]' },
        { step: 2, value: 5, label: 'entries it left behind[[src:vars]]' }
      ],
      cardsLabel: 'The question, and what decides it',
      cards: [
        { step: 3, n: 1, title: 'What did “a” hold on day 300?', text: 'A question about the past, two years ago.' },
        { step: 3, n: 2, title: 'From the full log', text: 'Easy, if the history still exists.' },
        { step: 4, n: 3, title: 'From what is left', text: 'Decided a year earlier, by someone saving disk.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A company keeps customer records, “a” and “b”, each holding one number. Every change is an entry in a log: which record, its new value, and the effective day it took effect. Day 0 is the first of January 2024.',
        'The log has 9 entries. A regulator, an official who can demand the company’s history, asks what record “a” held on day 300: the 27th of October 2024.',
        'But on day 640, a job ran to save disk space, and it left only 5 of the 9 entries behind.',
        'So the question is about the past. From the full log it is easy: the history is all there.',
        'From what is left, the answer was decided a year earlier, by someone saving disk. We will write the program that shows exactly what was lost.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Read the full log by hand',
      stand: 'Record “a” became 5 on day 40, 8 on day 190, 10 on day 420, 16 on day 500 and 24 on day 900.',
      question: { step: 0, prompt: 'From the full log, what did record “a” hold on day 300?', options: [
        { text: '8: the latest change on or before day 300 was on day 190.', correct: true, why: 'Day 190 set “a” to 8, and nothing changed it again until day 420.' },
        { text: '10: the change nearest to day 300 is on day 420.', correct: false, why: 'Day 420 is after day 300. On day 300 that change had not happened yet.' },
        { text: '24: that is what “a” holds.', correct: false, why: 'That is what it holds today. The regulator asked about day 300.' } ] },
      cards: [
        { step: 1, title: 'The latest entry on or before the day', html: '<p>What a record held on a day is the value of its latest entry whose effective day is on or before it. For day 300: <b>8</b>.[[src:vars]]</p>' }
      ],
      narration: [
        'Try it by hand. Record “a” became 5 on day 40, 8 on day 190, 10 on day 420, 16 on day 500 and 24 on day 900. What did it hold on day 300? Choose an answer.',
        '8. The latest change on or before day 300 was on day 190, and nothing changed “a” again until day 420. Now see that history on a line.'
      ]
    },

    /* ---------- 3 · the history, as a timeline ---------- */
    {
      title: 'Line', layout: 'timeline',
      eyebrow: '03 · The history of record “a”',
      heading: 'Five changes, one question, one disk job',
      stand: 'Days along the bar. The question sits between two changes; the disk job sits after both.',
      timeline: [
        { step: 0, time: 'day 40', title: 'a becomes 5', text: 'Its first entry.[[src:vars]]' },
        { step: 0, time: 'day 190', title: 'a becomes 8', text: 'Still 8 on day 300.[[src:vars]]' },
        { step: 1, time: 'day 300', title: 'The question', text: 'What did “a” hold?[[src:vars]]' },
        { step: 1, time: 'day 420', title: 'a becomes 10', text: 'Too late for day 300.[[src:vars]]' },
        { step: 2, time: 'day 640', title: 'Disk job runs', text: 'Deletes replaced entries up to here.[[src:vars]]' },
        { step: 3, time: 'day 900', title: 'a becomes 24', text: 'Its value today.[[src:vars]]' }
      ],
      notes: [
        { step: 1, html: '<b>Day 300:</b> the latest change on or before it is day 190, so “a” held 8.[[src:vars]]' },
        { step: 2, html: '<b>After the job:</b> the oldest entry left for “a” is day 500, holding 16.[[src:vars]]' },
        { step: 3, html: '<b>Today:</b> 24, unchanged by the job, which is why it was approved.[[src:vars]]' }
      ],
      narration: [
        'Here is record “a” on a line of days. On day 40 it became 5, and on day 190 it became 8.',
        'Day 300 is the regulator’s question. The next change, to 10, came on day 420, too late. So the answer is 8.',
        'On day 640 the disk job ran. For everything older than that day, it kept only the last entry per record and deleted the ones that had been replaced.',
        'And on day 900 “a” became 24, its value today. Next, let us write the program, starting with the data.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['unanswerable'],
      eyebrow: '04 · Writing the program · the record log',
      heading: 'Each entry carries its effective day',
      stand: 'Days are numbers counted from day 0; the program turns them into dates only when it prints.',
      question: { step: 0, prompt: 'Why must every entry carry its effective day, not just the record and the value?', options: [
        { text: 'Without the day, no question “on day X” can be answered.', correct: true, why: 'The order says what came first, but not when. The regulator asks about a date.' },
        { text: 'To sort the entries alphabetically.', correct: false, why: 'Sorting by name is not needed. The day is what links an entry to a date.' },
        { text: 'It is extra detail that the program ignores.', correct: false, why: 'Every answer in this program depends on the day. A lookup that ignores it is one of the bugs we will see.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch06_v3.py · the data' }),
      cards: [ { step: 2, title: 'The names', html: '<p><code>RECORD_LOG</code>: 9 entries (record, value, day). <code>COMPACTED_ON</code> = 640, <code>ASKED_DAY</code> = 300, <code>TODAY</code> = 1000. <code>UNANSWERABLE</code> is a refusal: “this cannot be answered”, not a value.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. Why must every entry carry its effective day, and not just the record and the value? Choose an answer.',
        'Because without the day, no question about a date can be answered. Here are the lines: nine entries of record, value and day, and the days that matter: 640, 300, and today, 1000.',
        'One more name: unanswerable. It is a refusal, meaning this cannot be answered, and it is deliberately not a value.'
      ]
    },

    /* ---------- 5 · fold and the retention job ---------- */
    {
      title: 'Job', layout: 'code', defines: ['function', 'fold', 'table', 'retention job'],
      eyebrow: '05 · Writing the program · the disk-saving job',
      heading: 'Compact the old part, leave the recent part alone',
      stand: 'Two functions, named recipes. One gives today’s value of each record. The other is the disk job itself.',
      question: { step: 0, prompt: 'The job runs on day 640. Which entries can it delete and still keep every record’s value today?', options: [
        { text: 'Entries up to day 640 that a later entry for the same record replaces.', correct: true, why: 'They are overwritten anyway when the log is applied, so today’s values do not change.' },
        { text: 'Every entry up to day 640.', correct: false, why: 'Then a record whose last change was before day 640 would lose its value.' },
        { text: 'Every entry after day 640.', correct: false, why: 'Those are the newest changes. Deleting them would lose today’s values.' } ] },
      code: P.build({ before: [DATA], add: [FOLD, RETAINED], step: 1 }),
      cards: [ { step: 2, title: 'Fold, and the retention job', html: '<p><code>fold</code> applies entries in order and gives the <b>table</b> of today’s values. <code>retained</code> is the <b>retention job</b>: up to the cutoff, keep the last entry per record; after it, keep everything.[[src:vars]]</p>' } ],
      narration: [
        'Two functions next. The disk job runs on day 640. Which entries can it delete and still keep every record’s value today? Choose an answer.',
        'Entries up to day 640 that a later entry for the same record replaces. Here is fold, which gives the table of today’s values, and retained, the retention job itself.',
        'Up to the cutoff, it keeps only the last entry per record; after the cutoff, it leaves everything alone. Watch what it does to our nine entries.'
      ]
    },

    /* ---------- 6 · the job, animated ---------- */
    {
      title: 'Cut', layout: 'array',
      eyebrow: '06 · Watch the retention job',
      heading: 'Four entries go, and today does not change',
      stand: 'The nine entries in order: record, value, effective day, and what the job does to each.',
      array: {
        labelWidth: 150, slotLabel: 'entry',
        rows: [
          { label: 'record', values: LOG.map(e => e[0]) },
          { label: 'value', values: LOG.map(e => e[1]) },
          { label: 'effective day', values: LOG.map(e => e[2]) },
          { label: 'after the job', values: AFTER_JOB }
        ],
        meters: ['entries checked', 'entries deleted'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'deleted', readMeter: 0, resultMeter: 1, speed: 350 },
          { step: 2, do: 'pick', slots: [4, 5] }
        ]
      },
      cards: [
        { step: 1, title: '4 deleted', html: '<p>“a” 5, 8 and 10, and “b” 7: each replaced before day 640. <b>9 entries became 5</b>.[[src:vars]]</p>' },
        { step: 2, title: 'The edges', html: '<p>Each record keeps one entry from before the cutoff: “a” 16 on day 500, “b” 8 on day 560. Every question before those days is lost.[[src:vars]]</p>' },
        { step: 3, title: 'Today is untouched', html: '<p>Both logs fold to {a: 24, b: 21}. That is the argument the job was approved on — and it is true.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine entries in order: which record, its new value, and its effective day.',
        'Now the job runs. Watch the pointer: four entries are deleted, “a” 5, 8 and 10, and “b” 7, because each was replaced before day 640. Nine entries became five.',
        'Look at the two entries highlighted. Each record keeps one entry from before the cutoff: “a” 16 on day 500, and “b” 8 on day 560. Those are the edges; before them, nothing remains.',
        'And today is untouched: both logs still give “a” 24 and “b” 21. That is exactly the argument the job was approved on, and it is true.'
      ]
    },

    /* ---------- 7 · the lookup ---------- */
    {
      title: 'Ask', layout: 'code',
      eyebrow: '07 · Writing the program · what did it hold that day?',
      heading: 'The latest entry on or before the day, or an honest refusal',
      stand: 'The function that answers the regulator, from whatever entries the log still has.',
      question: { step: 0, prompt: 'On the compacted log, “a” has no entry on or before day 300. What should the function return?', options: [
        { text: 'Unanswerable: no surviving entry can say.', correct: true, why: 'A refusal can be reported to the regulator. A made-up answer cannot be told apart from a true one.' },
        { text: '16: the oldest entry for “a” that survives.', correct: false, why: '16 took effect on day 500, after day 300. On day 300 “a” did not hold 16.' },
        { text: '0: there was nothing there.', correct: false, why: '0 is a value, and a wrong one: “a” held 8 that day.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED], add: [VALUE], step: 1 }),
      cards: [ { step: 2, title: 'Missing, not wrong', html: '<p><code>value_as_of</code> keeps the latest entry for the record with day ≤ the day asked. Full log, day 300: <b>8</b>. Compacted: <b>UNANSWERABLE</b>.[[src:vars]]</p>' } ],
      narration: [
        'Now the function that answers the regulator. On the compacted log, “a” has no entry on or before day 300. What should it return? Choose an answer.',
        'Unanswerable. Here it is: it scans for the latest entry for that record whose effective day is on or before the day asked, and if none survives, it says so.',
        'From the full log it answers 8. From the compacted log, unanswerable: a missing answer that can be reported, rather than a confident wrong one.'
      ]
    },

    /* ---------- 8 · the two tempting answers ---------- */
    {
      title: 'Wrong', layout: 'code',
      eyebrow: '08 · Writing the program · the answers that sound right',
      heading: 'Two lookups that always return a number',
      stand: 'Two functions the program writes on purpose, to show the mistakes: one ignores the day, one just reads today’s table.',
      question: { step: 0, prompt: 'A lookup that ignores the day returns the record’s last surviving entry. For “a” on day 300, from the compacted log, it gives?', options: [
        { text: '24: today’s value, presented as history.', correct: true, why: 'It never looks at the day, so it hands back the present. Instant, confident, and wrong.' },
        { text: '8: the right answer.', correct: false, why: 'The entry saying 8 was deleted by the job. Nothing left in the log says 8.' },
        { text: 'Unanswerable.', correct: false, why: 'Only a lookup that checks the day can notice that nothing survives. This one never checks.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE], add: [BLIND, PRESENT], step: 1 }),
      cards: [ { step: 2, title: 'The date is the difference', html: '<p>Both return <b>24</b> for day 300. Without the effective day, a refusal turns into a fabrication.[[src:vars]]</p>' } ],
      narration: [
        'Next, two mistakes the program writes on purpose. A lookup that ignores the day returns the record’s last surviving entry. For “a” on day 300 it gives what? Choose an answer.',
        '24, today’s value, presented as history. Here is that date-blind lookup, and next to it the answer read straight from today’s table. Both are instant, and both say 24.',
        'The only difference between them and the honest function is checking the effective day. That check is what turns a fabrication into a refusal.'
      ]
    },

    /* ---------- 9 · the references ---------- */
    {
      title: 'Ref', layout: 'code',
      eyebrow: '09 · Writing the program · checking it another way',
      heading: 'A slow replay, a count, and the edge',
      stand: 'Three helpers that measure what was lost, and check the lookup by a different route.',
      question: { step: 0, prompt: 'Why build a slow replay that rebuilds the table for every single day?', options: [
        { text: 'To check the fast lookup by a completely different method.', correct: true, why: 'If two different methods agree on every record and day, a bug in one would have to be copied in the other.' },
        { text: 'Because the fast lookup is not fast enough.', correct: false, why: 'The replay is far slower: it touches every entry once per day.' },
        { text: 'To answer the regulator more precisely.', correct: false, why: 'Both give the same answers. The replay is a cross-check, not a better answer.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE, BLIND, PRESENT], add: [REPLAY, COUNT, EDGE], step: 1 }),
      cards: [ { step: 2, title: 'Three helpers', html: '<p><code>replay_tables</code>: the table for every day. <code>answerable_questions</code>: how many (record, day) questions get an answer. <code>earliest_answerable</code>: the first day a record can be asked about.[[src:vars]]</p>' } ],
      narration: [
        'Three helpers next. Why build a slow replay that rebuilds the table for every day? Choose an answer.',
        'To check the fast lookup by a completely different method. Here they are: the day-by-day replay; a count of how many questions a log can answer; and the earliest day a record can be asked about.',
        'The count measures what the job destroyed, and the earliest day shows where the damage stops. Both are about to be printed.'
      ]
    },

    /* ---------- 10 · the worked examples ---------- */
    {
      title: 'Rows', layout: 'code', defines: ['assert'],
      eyebrow: '10 · Writing the program · the worked examples',
      heading: 'Nineteen questions, every edge tested',
      stand: 'Inputs, the examples table, a function to print dates, and the function that prints and asserts every row: stops the program if one is false.',
      question: { step: 0, prompt: '“a becomes 8” takes effect on day 190. What did “a” hold on day 190 itself?', options: [
        { text: '8: the effective day counts as already in force.', correct: true, why: 'The program fixes this rule and tests both sides: day 190 gives 8, day 189 gives 5.' },
        { text: '5: the change only shows the next day.', correct: false, why: 'That is day 189’s answer. The rule here is that the effective day is included.' },
        { text: 'Unanswerable: it changed that day.', correct: false, why: 'A change on the day is a clear answer once the rule is stated: it counts.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE, BLIND, PRESENT, REPLAY, COUNT, EDGE], add: [SHOWN, EXTRA, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Both sides of every edge', html: '<p>Day 39 → UNANSWERABLE, day 40 → 5, day 189 → 5, day 190 → 8. Every row is asserted two or three ways: <b>all 19 examples agree</b>.[[src:vars]]</p>' } ],
      narration: [
        'Now the worked examples, each one asserted: checked, with the program stopping if it is false. “a becomes 8” takes effect on day 190. What did “a” hold on day 190 itself? Choose an answer.',
        '8. The effective day counts as already in force. Here are the inputs, the table of 19 examples, and the function that prints and asserts them, testing both sides of every edge.',
        'Day 39 is unanswerable, day 40 is 5, day 189 is 5, and day 190 is 8. All 19 examples agree with two independent checks.'
      ]
    },

    /* ---------- 11 · the regulator's question ---------- */
    {
      title: 'Main', layout: 'code', defines: ['state log', 'audit log'],
      eyebrow: '11 · Writing the program · the regulator’s question',
      heading: 'Four answers to one question',
      stand: 'The main part runs the job, then asks the regulator’s question four ways.',
      question: { step: 0, prompt: 'Both logs give today’s values exactly. Why did nobody object when the job was approved?', options: [
        { text: 'Its promise, the present is unchanged, is true; history was simply not asked about.', correct: true, why: 'The check that approved it looked only at today’s values, which the job preserves exactly.' },
        { text: 'The job was faulty and nobody tested it.', correct: false, why: 'The job works exactly as designed. It just answers a different question from the regulator’s.' },
        { text: 'Nobody needed old values until now.', correct: false, why: 'Someone always might. That is why the question should have been asked before the job ran.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE, BLIND, PRESENT, REPLAY, COUNT, EDGE, SHOWN, EXTRA, EXAMPLES, SHOW], add: [M1], step: 1 }),
      cards: [ { step: 2, title: 'Four answers', html: '<p>The full log, kept for history, is an <b>audit log</b>: <b>8</b>. The compacted one, kept for today’s values, is a <b>state log</b>: <b>UNANSWERABLE</b>. Current table: <b>24</b> (instant, confident, wrong). Date-blind: <b>24</b>.[[src:vars]]</p>' } ],
      narration: [
        'The main part runs the job, then asks the regulator’s question. Both logs give today’s values exactly. Why did nobody object when the job was approved? Choose an answer.',
        'Because its promise is true: the present is unchanged. History was simply not part of the check. Here the program prints all four answers to the regulator’s question.',
        'The full log, kept for history, is called an audit log: it says 8. The compacted one, kept for today’s values, is a state log: unanswerable. Today’s table and the date-blind lookup both say 24.'
      ]
    },

    /* ---------- 12 · counting the damage ---------- */
    {
      title: 'Loss', layout: 'code',
      eyebrow: '12 · Writing the program · counting what was destroyed',
      heading: 'Not “some history”: a clean cut',
      stand: 'Ask both logs every question on a grid: each record, every 10th day up to today.',
      question: { step: 0, prompt: 'After the job, which (record, day) questions still get an answer?', options: [
        { text: 'Exactly those on or after each record’s oldest surviving entry.', correct: true, why: 'Before that edge nothing survives; after it every answer is intact. The loss is a clean cut.' },
        { text: 'A random scattering, depending on the values.', correct: false, why: 'The job keeps one entry per record up to the cutoff, so the loss has one clear edge per record.' },
        { text: 'None of them: the history is gone.', correct: false, why: 'Questions after the edge are still answered, including today’s.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE, BLIND, PRESENT, REPLAY, COUNT, EDGE, SHOWN, EXTRA, EXAMPLES, SHOW, M1], add: [M2], step: 1 }),
      cards: [ { step: 2, title: 'Counted', html: '<p>Of 202 questions, the audit log answers <b>172</b>, the compacted log <b>96</b>: 76 destroyed. “a” is answerable from 2025-05-15, “b” from 2025-07-14.[[src:vars]]</p>' } ],
      narration: [
        'Next, count the damage. Ask both logs every question on a grid. Which questions still get an answer after the job? Choose an answer.',
        'Exactly those on or after each record’s oldest surviving entry. Here are the lines: they count answers on both logs, then check the edge for every record and day.',
        'Of 202 questions, the full log answers 172 and the compacted one 96: 76 destroyed. “a” can be asked about from day 500, “b” from day 560. Before that, nothing.'
      ]
    },

    /* ---------- 13 · the fix, and the rest of the checks ---------- */
    {
      title: 'Split', layout: 'code',
      eyebrow: '13 · Writing the program · the real answer',
      heading: 'They were never the same log',
      stand: 'There is no way to recover deleted entries. What should the design have been?',
      question: { step: 0, prompt: 'What is the real fix for next time?', options: [
        { text: 'Keep two logs: one compacted for today’s values, one never compacted for history.', correct: true, why: 'They serve different questions, so they need different retention. Only the history log can answer a regulator.' },
        { text: 'Run the disk job less often.', correct: false, why: 'Any compaction of the only log destroys history; running it later only moves the edge.' },
        { text: 'Answer from today’s table and note it may be out of date.', correct: false, why: 'That is the confident wrong answer, 24, with a disclaimer.' } ] },
      code: P.build({ before: [DATA, FOLD, RETAINED, VALUE, BLIND, PRESENT, REPLAY, COUNT, EDGE, SHOWN, EXTRA, EXAMPLES, SHOW, M1, M2], add: [M3, M4], step: 1 }),
      cards: [ { step: 2, title: 'Two logs, priced', html: '<p>A state log (compactable) and an audit log (never compacted): 9 + 5 = 14 entries instead of 5. At 5,000 changes the audit log is <b>100x</b> the storage.[[src:vars]]</p>' } ],
      narration: [
        'There is no way to recover deleted entries. What is the real fix for next time? Choose an answer.',
        'Keep two logs: a state log, compacted freely for today’s values, and an audit log, never compacted, for history. Here are the lines that price the split, test the edges, and try 200 random logs.',
        'Two logs cost 9 plus 5, 14 entries instead of 5. At 5,000 changes the audit log is 100 times the storage. And across random logs, the compacted log lost answers but never once gave a wrong one.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. The opening text defines every word before the code uses it.',
      question: { step: 0, prompt: 'Which detail separates the honest lookup from the two that say 24?', options: [
        { text: 'It checks each entry’s effective day against the day asked.', correct: true, why: 'Only then can it notice that no surviving entry is old enough, and refuse.' },
        { text: 'It reads the log in reverse.', correct: false, why: 'Direction does not matter; the day check does.' },
        { text: 'It uses the compacted log.', correct: false, why: 'The date-blind lookup used the same compacted log and still said 24.' } ] },
      code: P.whole(),
      cards: [ { step: 1, title: 'From top to bottom', html: '<p>The words; the data; fold and the retention job; the honest lookup and the two tempting ones; the references; the examples; main.[[src:vars]]</p>' } ],
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Which detail separates the honest lookup from the two that say 24? Choose an answer.',
        'It checks each entry’s effective day against the day asked. From the top: the words, the data, fold and the job, the three lookups, the references, the examples, and main.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'On random logs the compacted log lost 2,333 answers; the date-blind lookup was wrong 22,055 times. Which is worse?', options: [
        { text: 'The wrong answers: nobody can tell them from right ones.', correct: true, why: 'A lost answer is a visible refusal. A wrong one is believed.' },
        { text: 'The lost answers: there are more of them.', correct: false, why: 'There are fewer, and each one is honest about being missing.' },
        { text: 'They are the same thing.', correct: false, why: 'One says “I cannot know”. The other says something false with confidence.' } ] },
      code: OUT.whole('what python3 programs/ch06_v3.py prints'),
      cards: [ { step: 1, title: 'The last line', html: '<p><b>all assertions passed</b> — including that the compacted log never once returned a wrong answer.[[src:vars]]</p>' } ],
      narration: [
        'And here is what it prints. On random logs the compacted log lost 2,333 answers, while the date-blind lookup was wrong 22,055 times. Which is worse? Choose an answer.',
        'The wrong answers. A lost answer is a visible refusal; a wrong one is believed. The last line says all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Refuse honestly, and keep history in its own log',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>retained</code>', 'The disk job: last entry per record up to the cutoff.', '9 entries → 5'] },
          { step: 0, cells: ['<code>value_as_of</code>', 'Latest entry on or before the day, else UNANSWERABLE.', 'day 300: 8, or refused'] },
          { step: 1, cells: ['date-blind · current table', 'Always a number, the present, presented as the past.', '24, wrong'] },
          { step: 1, cells: ['the edge', 'Before each record’s oldest survivor, nothing; after, everything.', '172 → 96 answers'] },
          { step: 2, cells: ['state log · audit log', 'Two logs, two retentions. They were never the same log.', '14 entries, not 5'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Variation 4: the entries say what <b>changed</b> — “+5” — instead of what a value became. Fold them, and try to compact them.[[src:vars]]</p>' },
      narration: [
        'To recap. The retention job keeps the last entry per record up to its cutoff: 9 entries became 5. The honest lookup takes the latest entry on or before the day, or refuses.',
        'The date-blind lookup and today’s table always give a number: the present, presented as the past. And the loss is a clean cut at each record’s oldest surviving entry.',
        'The real answer is two logs: a state log, compacted freely, and an audit log, never compacted. They were never the same log.',
        'Next, variation 4: the entries say what changed, plus 5, instead of what a value became. We will fold them, and try to compact them.'
      ]
    }
  ]
};
