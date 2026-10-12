// Chapter 6, Part 7 — Variation 4 of the interview question ("the counter changelog"), built
// as a program WITH the viewer. Every code slide asks what the next piece must do, then
// reveals the real lines from programs/ch06_v4.py (read at build time by _prog.js, addressed
// by content, never by line number). The last slides show the whole file and what it
// actually prints (programs/ch06_v4.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch06';
const P = program('ch06_v4.py');
const OUT = program('ch06_v4.out');

// the delta log, read from the program itself so the slides cannot drift from it
const pairs = l => [...l.matchAll(/\("(\w+)", (\d+)\)/g)].map(m => [m[1], +m[2]]);
const D0 = P.at('DELTAS = [("errors", 5)');
const DELTAS = [...pairs(P.lines[D0]), ...pairs(P.lines[D0 + 1])];
const LAST = DELTAS.map(([k], i) => (DELTAS.slice(i + 1).some(([k2]) => k2 === k) ? 'dropped' : 'kept'));
const TOTAL = k => DELTAS.filter(([x]) => x === k).reduce((s, [, d]) => s + d, 0);

// the pieces, in the order they are written
const DATA = P.span('# The delta log, from the chapter', 'TOMBSTONE = None');
const ADD = P.fn('fold_add');
const ASSIGN = P.fn('fold_assign');
const EMIT = P.fn('emit');
const LASTFN = P.fn('compact_last');
const SUM = P.fn('compact_sum');
const STATES = P.fn('to_states');
const EXTRA = P.span('# An empty log, a single increment', 'BIG_CANCELS_TRUE = {');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const TOT = P.fn('_tot');
const SHOW = P.fn('show_examples');
const M1 = P.span('def main():', 'so the error is the size of the history');
const M2 = P.span('# the entries of compact_sum and to_states', 'deltas to order, states to duplication');
const M3 = P.span('# boundary: a counter whose increments cancel', 'The delete is a fact, not a gap in the data');
const M4 = P.span('# many inputs, and the precise condition', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 12 examples agree with a per-counter reference sum and with both safe compactions',
  "fold with +            -> {'errors': 24, 'hits': 21}",
  "compact_last(deltas)   -> [('errors', 8), ('hits', 4)]  folds to {'errors': 8, 'hits': 4}   WRONG",
  "compact_sum(deltas)    -> [('errors', 24), ('hits', 21)]  folds to {'errors': 24, 'hits': 21}   right",
  "keeping the last increment understates by {'errors': 16, 'hits': 17}",
  "replayed twice: as deltas {'errors': 48, 'hits': 42}, as states {'errors': 24, 'hits': 21}",
  "{'errors': 8}.  Each format is robust to exactly what the", "{'errors': 1} and loses the fact that the counter EXISTS",
  "brings it back as", "Keeping the last increment agreed in 238 cases and", "broke in 1262",
  "223 of those had one entry per counter", "other 15 cancelled out by luck",
  'compact_sum  -> 50 entries, totals exact (400x smaller)', 'compact_last -> 50 entries, worst counter off by 798',
  'earlier increments cancel: LUCKY         2     1     1                drops=5       0  tie, naive agrees', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch06_v4.out no longer prints "${s}" — rewrite the narration`);
if (DELTAS.length !== 9 || TOTAL('errors') !== 24 || TOTAL('hits') !== 21 || LAST.join() !== 'dropped,dropped,dropped,dropped,dropped,dropped,dropped,kept,kept')
  throw new Error('programs/ch06_v4.py no longer has the log this deck explains — rewrite the narration');

module.exports = {
  title: 'The Counter Log',
  eyebrow: 'Streaming · Ch 6 · Part 7',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs } },
  jargon: ['counter', 'entry', 'log', 'compaction', 'function', 'fold', 'tombstone', 'state', 'emit', 'replay', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 6 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 6 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 6 · Variation 4, the counter changelog')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['counter', 'entry', 'log'],
      eyebrow: '01 · A Google interview question, Variation 4',
      heading: 'A log of counter changes that gets too long to keep',
      hero: { step: 0, text: 'A service counts things with <b>counters</b>: named numbers such as <code>errors</code> and <code>hits</code>. Each change is one <b>entry</b> saying what <i>changed</i>, such as <code>errors +5</code> — not what the counter became. The entries in order are the <b>log</b>.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'entries in the log[[src:vars]]' },
        { step: 1, value: 24, label: 'the true count of errors[[src:vars]]' },
        { step: 2, value: 8, label: 'what errors reads after the obvious shortening[[src:vars]]' },
        { step: 2, value: 16, label: 'errors lost by that shortening[[src:vars]]' }
      ],
      cardsLabel: 'What the interviewer asks',
      cards: [
        { step: 3, n: 1, title: 'Current counters', text: 'Add up the log: errors and hits now.' },
        { step: 3, n: 2, title: 'Too long to keep', text: 'Shorten it the way the chapter shortened its log.' },
        { step: 4, n: 3, title: 'Does that still work?', text: 'And if not, what does?' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A service counts things with counters, named numbers such as errors and hits. Each change is one entry saying what changed, such as errors plus 5, and not what the counter became. The entries in order are the log.',
        'The log has 9 entries: errors plus 5, plus 3, plus 2, plus 6 and plus 8, and hits plus 7, plus 1, plus 9 and plus 4. So errors is truly 24.',
        'Shorten the log the obvious way and errors reads 8: 16 errors vanish without a trace. We will see exactly why.',
        'The interviewer asks: what are the counters now? Then: the log is too long, so shorten it the way the chapter shortened its log.',
        'Does that still work, and if not, what does? We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Just the first three entries',
      stand: 'The log starts errors +5, errors +3, hits +7. Each entry says how much a counter changed.',
      question: { step: 0, prompt: 'After the first three entries, what does errors hold?', options: [
        { text: '8: plus 5, then plus 3.', correct: true, why: 'Each entry adds to the counter, so both count.' },
        { text: '3: the later entry replaces the earlier one.', correct: false, why: 'That is right for “became” entries. These say “plus 3”, which adds.' },
        { text: '5: only the first entry counts.', correct: false, why: 'Every entry is a real change; none is ignored.' } ] },
      cards: [
        { step: 1, title: 'Every entry counts', html: '<p>“Plus” entries are added up, not replaced. Nothing in this log is ever superseded.[[src:vars]]</p>' },
        { step: 2, title: 'And order does not matter', html: '<p>5 then 3, or 3 then 5: both make 8. Addition does not care about order, unlike replacing.[[src:vars]]</p>' }
      ],
      narration: [
        'Try a small case. The log starts errors plus 5, errors plus 3, hits plus 7. After those three entries, what does errors hold? Choose an answer.',
        '8: plus 5, then plus 3. Each entry adds to the counter, so every entry counts and none is ever replaced.',
        'And the order no longer matters: 5 then 3, or 3 then 5, both make 8. Keep both facts in mind; they decide what can be thrown away.'
      ]
    },

    /* ---------- 3 · the obvious shortening, animated ---------- */
    {
      title: 'Keep', layout: 'array', defines: ['compaction'],
      eyebrow: '03 · Watch the chapter’s shortening on this log',
      heading: 'Keep the last entry per counter, and the totals collapse',
      stand: 'The nine entries. The chapter shortened its log by keeping only the last entry for each name.',
      array: {
        labelWidth: 150, slotLabel: 'entry',
        rows: [
          { label: 'counter', values: DELTAS.map(([k]) => k) },
          { label: 'change', values: DELTAS.map(([, d]) => '+' + d) },
          { label: 'keep the last?', values: LAST }
        ],
        meters: ['entries checked', 'entries kept'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'kept', readMeter: 0, resultMeter: 1, speed: 350 },
          { step: 2, do: 'pick', slots: [7, 8] }
        ]
      },
      cards: [
        { step: 1, title: 'Compaction', html: '<p>Keeping only the last entry per name is <b>compaction</b>. On a log of “became” entries it is safe. Here it keeps 2 of 9.[[src:vars]]</p>' },
        { step: 2, title: 'What is left', html: '<p>hits +4 and errors +8. Added up: errors <b>8</b>, hits <b>4</b>. The truth is 24 and 21.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine entries in order: which counter, and how much it changed.',
        'The chapter shortened its log by keeping only the last entry for each name, which is called compaction. Watch it run here: only 2 of the 9 entries are kept.',
        'What is left is hits plus 4 and errors plus 8. Add them up and errors reads 8 and hits reads 4. The truth is 24 and 21. The dropped entries were not replaced; they were part of the total.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['tombstone'],
      eyebrow: '04 · Writing the program · the delta log',
      heading: 'The same arithmetic as the chapter, stated the other way round',
      stand: 'The chapter’s log said what a key became: 5, 8, 10, 16, 24. These entries are the steps between.',
      question: { step: 0, prompt: 'The chapter’s key passed through 5, 8, 10, 16, 24. What are its entries as changes?', options: [
        { text: '+5, +3, +2, +6, +8: each value minus the one before.', correct: true, why: 'The differences turn “what it became” into “what changed”. They add back up to 24.' },
        { text: '+5, +8, +10, +16, +24: the same numbers with a plus.', correct: false, why: 'Those would add up to far more than 24. A change is the step, not the new value.' },
        { text: '+24: one entry for the final value.', correct: false, why: 'That throws away four of the five changes.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch06_v4.py · the data' }),
      cards: [ { step: 2, title: 'The names', html: '<p><code>DELTAS</code>: 9 (counter, change) pairs. <code>TRUE</code>: errors 24, hits 21. A <b>tombstone</b>, <code>None</code>, is an entry meaning “this counter is gone”.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The chapter’s key passed through 5, 8, 10, 16 and 24. What are its entries written as changes? Choose an answer.',
        '5, 3, 2, 6 and 8: each value minus the one before. Here are the lines: the nine changes, the true totals, 24 and 21, and how many entries there are.',
        'One more name: None, an entry meaning a counter is gone, called a tombstone. It will matter at the end.'
      ]
    },

    /* ---------- 5 · fold with + ---------- */
    {
      title: 'Add', layout: 'code', defines: ['function', 'fold'],
      eyebrow: '05 · Writing the program · the current counters',
      heading: 'The fold, with + where the chapter had =',
      stand: 'A function is a named recipe. This one goes through the log once and builds the counters.',
      question: { step: 0, prompt: 'For each “plus” entry, what does the program do to its counter?', options: [
        { text: 'Add the change to the counter’s current value, starting from nothing.', correct: true, why: 'That is the whole difference from the chapter: plus instead of replace.' },
        { text: 'Replace the counter with the change.', correct: false, why: 'That is the chapter’s rule for “became” entries. Here it would give 8, not 24.' },
        { text: 'Keep the largest change seen.', correct: false, why: 'A counter is the sum of its changes, not the biggest one.' } ] },
      code: P.build({ before: [DATA], add: [ADD], step: 1 }),
      cards: [ { step: 2, title: 'Still a fold', html: '<p><code>fold_add</code>: one pass, <code>t[k] = t.get(k, 0) + d</code>. A tombstone removes the counter. Result: errors <b>24</b>, hits <b>21</b>.[[src:vars]]</p>' } ],
      narration: [
        'Now the current counters. For each plus entry, what does the program do to its counter? Choose an answer.',
        'Add the change to the counter’s current value, starting from nothing. Here is the function, fold add: still a fold, one pass through the log, with a plus where the chapter had a replace.',
        'A tombstone still removes the counter. Folding the nine entries gives errors 24 and hits 21. That part barely changed. Shortening the log is where it breaks.'
      ]
    },

    /* ---------- 6 · the chapter's own functions ---------- */
    {
      title: 'Old', layout: 'code', defines: ['state', 'emit'],
      eyebrow: '06 · Writing the program · the chapter’s two functions',
      heading: 'Bring back the chapter’s fold and emit',
      stand: 'The chapter’s fold replaced values; its emit wrote a table out as one entry per key. Why does this program need them?',
      question: { step: 0, prompt: 'Emit writes the totals out as “errors 24, hits 21”. What does that new log mean?', options: [
        { text: 'Each entry says what the counter now is: a log of states.', correct: true, why: 'Written from the totals, each entry is a value to set, not a change to add.' },
        { text: 'Each entry says “add 24” and “add 21”.', correct: false, why: 'The same numbers could mean that, which is exactly the trap. Emit means “it is 24”.' },
        { text: 'Nothing: it is the same as the delta log.', correct: false, why: 'It has 2 entries, not 9, and they mean something different.' } ] },
      code: P.build({ before: [DATA, ADD], add: [ASSIGN, EMIT], step: 1 }),
      cards: [ { step: 2, title: 'States, not changes', html: '<p>A <b>state</b> entry says what a counter is. <code>fold_assign</code> folds states by replacing; <code>emit</code> turns a table into states. That is how a delta log becomes one the chapter can compact.[[src:vars]]</p>' } ],
      narration: [
        'Next, the chapter’s own two functions come back. Emit writes the totals out as errors 24, hits 21. What does that new log mean? Choose an answer.',
        'Each entry says what the counter is: a log of states. Here are the chapter’s fold, which replaces, and emit, which writes a table out as one entry per key.',
        'An entry that says what a counter is, is called a state. Turning changes into states is how a delta log becomes one the chapter’s shortening can handle.'
      ]
    },

    /* ---------- 7 · compact_last ---------- */
    {
      title: 'Last', layout: 'code',
      eyebrow: '07 · Writing the program · the wrong compaction',
      heading: 'Keep the last increment, throw the counter away',
      stand: 'The program writes the chapter’s compaction on purpose, applied to changes, to measure the damage.',
      question: { step: 0, prompt: 'Keeping the last entry per counter, what do the totals become?', options: [
        { text: 'errors 8 and hits 4: only the last change of each survives.', correct: true, why: 'The other seven changes were part of the totals and are simply gone.' },
        { text: 'errors 24 and hits 21: compaction never changes the result.', correct: false, why: 'That is only true when later entries replace earlier ones. These add.' },
        { text: 'errors 0 and hits 0: the log is emptied.', correct: false, why: 'Two entries survive, and they still add up to something — just not the truth.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT], add: [LASTFN], step: 1 }),
      cards: [ { step: 2, title: 'A log of something else', html: '<p><code>compact_last</code> keeps [errors +8, hits +4], which folds to {errors: 8, hits: 4}: <b>WRONG</b>. It is not a smaller log of the same thing.[[src:vars]]</p>' } ],
      narration: [
        'The program writes the chapter’s compaction on purpose, applied to changes. Keeping the last entry per counter, what do the totals become? Choose an answer.',
        'Errors 8 and hits 4. Here is compact last: the chapter’s function, unchanged. On a log of changes, it keeps the last increment and throws the counter away.',
        'The result is not a smaller log of the same thing; it is a log of something else. Folded, it says errors 8 and hits 4, and nothing in it looks broken.'
      ]
    },

    /* ---------- 8 · the two right compactions ---------- */
    {
      title: 'Right', layout: 'code',
      eyebrow: '08 · Writing the program · two compactions that work',
      heading: 'Sum per counter, or convert to states first',
      stand: 'A delta log can still be shortened. How?',
      question: { step: 0, prompt: 'How can this log be shortened to one entry per counter without changing the totals?', options: [
        { text: 'Add up each counter’s changes, and keep one entry with the sum.', correct: true, why: 'One entry per counter, and folding it gives exactly the same totals.' },
        { text: 'Keep the first entry per counter instead of the last.', correct: false, why: 'Then errors reads 5 and hits 7. Any single change throws the rest away.' },
        { text: 'It cannot: a delta log can never be shortened.', correct: false, why: 'It can, by summing. What it loses is the right to read it twice, as the next slides show.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN], add: [SUM, STATES], step: 1 }),
      cards: [ { step: 2, title: 'Same bytes, different meaning', html: '<p><code>compact_sum</code> and <code>to_states</code> both give [errors 24, hits 21]. One means “add 24”, the other “it is 24”. Both fold to the right totals.[[src:vars]]</p>' } ],
      narration: [
        'A delta log can still be shortened. How, without changing the totals? Choose an answer.',
        'Add up each counter’s changes, and keep one entry with the sum. Here is compact sum, which does exactly that, and to states, which is the chapter’s fold then emit.',
        'Both produce the same entries: errors 24, hits 21. But one means add 24, and the other means it is 24. Same bytes, different meaning, and the next check shows why it matters.'
      ]
    },

    /* ---------- 9 · the worked examples ---------- */
    {
      title: 'Rows', layout: 'code', defines: ['assert'],
      eyebrow: '09 · Writing the program · the worked examples',
      heading: 'Twelve cases, including one that is right by luck',
      stand: 'Inputs, the examples table, and the function that prints and asserts every row: stops the program if one is false.',
      question: { step: 0, prompt: 'For the log drops +0, drops +5, keeping the last entry gives drops 5, which is correct. Does that prove keep-the-last is fine?', options: [
        { text: 'No: it worked only because the earlier changes summed to zero.', correct: true, why: 'Luck, not correctness. Change the +0 to anything else and it breaks.' },
        { text: 'Yes: it gave the right answer.', correct: false, why: 'One right answer from a broken method is a coincidence. The program marks this row as lucky.' },
        { text: 'Yes, for logs with two entries.', correct: false, why: 'errors plus 5, errors minus 2 also has two entries, and keep-the-last is wrong by 5.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN, SUM, STATES], add: [EXTRA, EXAMPLES, TOT, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Checked three ways', html: '<p>Every row is asserted against a per-counter sum and both safe compactions: <b>all 12 examples agree</b>. The LUCKY row is in the table on purpose.[[src:vars]]</p>' } ],
      narration: [
        'Now the worked examples, each asserted: checked, with the program stopping if it is false. For drops plus 0, drops plus 5, keeping the last entry gives 5, which is correct. Does that prove it is fine? Choose an answer.',
        'No. It worked only because the earlier change summed to zero. Here are the inputs, the table of 12 examples, and the function that prints and checks each, three ways.',
        'All 12 agree. The lucky row is kept in the table on purpose, so nobody mistakes it for proof. A short test log can pass for the wrong reason.'
      ]
    },

    /* ---------- 10 · main, part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '10 · Writing the program · the measurements',
      heading: 'Keeping the last increment can only undercount',
      stand: 'The main part prints all four compactions of the chapter’s log and asserts each.',
      question: { step: 0, prompt: 'Keeping the last increment understates errors by 16 and hits by 17. Why can it only ever undercount here?', options: [
        { text: 'Every change is positive, and the dropped ones were part of the total.', correct: true, why: 'Removing positive amounts from a sum can only make it smaller: the error is the size of the history.' },
        { text: 'Because the last change is always the smallest.', correct: false, why: 'errors +8 is not its smallest change. Size is not the reason.' },
        { text: 'Because the totals are recomputed wrongly.', correct: false, why: 'The fold is correct. The input it was given is missing entries.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN, SUM, STATES, EXTRA, EXAMPLES, TOT, SHOW], add: [M1], step: 1 }),
      cards: [ { step: 2, title: 'The error is the history', html: '<p>Keep-the-last: {errors: 8, hits: 4}, <b>WRONG</b>. Summed, or converted to states: {errors: 24, hits: 21}, right. Lost: errors 16, hits 17.[[src:vars]]</p>' } ],
      narration: [
        'The main part prints all four results and asserts each. Keeping the last increment understates errors by 16 and hits by 17. Why can it only undercount here? Choose an answer.',
        'Every change is positive, and the dropped ones were part of the total. Removing positive amounts can only shrink a sum. The error is exactly the size of the history.',
        'The two right compactions, summing and converting to states, both fold back to errors 24 and hits 21.'
      ]
    },

    /* ---------- 11 · replay ---------- */
    {
      title: 'Twice', layout: 'code', defines: ['replay'],
      eyebrow: '11 · Writing the program · reading it twice',
      heading: 'Same entries, read twice',
      stand: 'A reader that restarts may read the shortened log a second time. To replay a log is to apply it again.',
      question: { step: 0, prompt: 'The log [errors 24, hits 21] is replayed twice. What does errors read, as deltas and as states?', options: [
        { text: 'As deltas 48; as states 24.', correct: true, why: '“Add 24” twice is 48. “It is 24” twice is still 24.' },
        { text: '24 both ways.', correct: false, why: 'That holds for states only. Adding 24 twice doubles the counter.' },
        { text: '48 both ways.', correct: false, why: 'Setting a value twice leaves it as it was. Only adding doubles.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN, SUM, STATES, EXTRA, EXAMPLES, TOT, SHOW, M1], add: [M2], step: 1 }),
      cards: [ { step: 2, title: 'Each format is safe from one thing', html: '<p>Deltas replayed: {errors: 48, hits: 42}. States: {errors: 24, hits: 21}. Deltas survive reordering; states survive duplication. Reordered, a state log gives {errors: 8}.[[src:vars]]</p>' } ],
      narration: [
        'A reader that restarts may apply the shortened log a second time, called a replay. Replayed twice, what does errors read, as deltas and as states? Choose an answer.',
        '48 as deltas, and 24 as states. Add 24 twice is 48; it is 24, twice, is still 24. Here are the lines that check it, and also what happens when each log is shuffled.',
        'A delta log can be shuffled freely, but not replayed. A state log can be replayed freely, but not shuffled: reordered, it gives errors 8. Each format is safe from exactly one thing.'
      ]
    },

    /* ---------- 12 · zero, absence, delete ---------- */
    {
      title: 'Zero', layout: 'code',
      eyebrow: '12 · Writing the program · zero, absent, and deleted',
      heading: 'A counter at 0 still exists',
      stand: 'retries +5, retries −5, errors +1: summed, retries is 0. A tidy-up step drops entries whose value is 0.',
      question: { step: 0, prompt: 'Dropping the summed entry “retries 0” as a no-op: what is lost?', options: [
        { text: 'The fact that the retries counter exists.', correct: true, why: '“retries is 0” and “there is no retries counter” are different facts, and different dashboards.' },
        { text: 'Nothing: zero adds nothing.', correct: false, why: 'It adds nothing to the total, but its existence is information.' },
        { text: 'The errors counter as well.', correct: false, why: 'Only the zero entry is dropped; errors 1 is untouched.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN, SUM, STATES, EXTRA, EXAMPLES, TOT, SHOW, M1, M2], add: [M3], step: 1 }),
      cards: [ { step: 2, title: 'And the delete, again', html: '<p>Dropping the zero gives {errors: 1}: retries vanished. And a compactor that skips the tombstone for hits brings it back as 21. A delete is a fact, not a gap.[[src:vars]]</p>' } ],
      narration: [
        'Retries plus 5, retries minus 5, errors plus 1: summed, retries is 0. A tidy-up drops entries whose value is 0. What is lost? Choose an answer.',
        'The fact that the retries counter exists. Retries at 0 and no retries counter at all are different facts. Here are the lines that check it, and the tombstone case.',
        'The same lesson as the chapter: a compactor that skips the delete for hits brings hits back with 21. A delete is a fact, not a gap.'
      ]
    },

    /* ---------- 13 · random logs and scale ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '13 · Writing the program · 1,500 random logs',
      heading: 'Exactly when the wrong compaction looks right',
      stand: 'The last piece tries 1,500 random delta logs, and then the scale at which compaction is worth doing.',
      question: { step: 0, prompt: 'Keep-the-last agreed with the truth in 238 random logs. In 223 every counter had one entry. Why did the other 15 agree?', options: [
        { text: 'Each counter’s earlier changes happened to sum to zero.', correct: true, why: 'Then the last change equals the total. The program checks this exact condition on every log.' },
        { text: 'They were sorted in a lucky order.', correct: false, why: 'Order does not affect a sum. Only the cancelling of earlier changes does.' },
        { text: 'The program has a bug in those cases.', correct: false, why: 'The condition is asserted on all 1,500 logs. It holds exactly.' } ] },
      code: P.build({ before: [DATA, ADD, ASSIGN, EMIT, LASTFN, SUM, STATES, EXTRA, EXAMPLES, TOT, SHOW, M1, M2, M3], add: [M4], step: 1 }),
      cards: [ { step: 2, title: 'Same size, different meaning', html: '<p>At 20,000 increments over 50 counters both compactions keep <b>50 entries</b>. Summing is exact (400x smaller); keep-the-last is off by up to <b>798</b>.[[src:vars]]</p>' } ],
      narration: [
        'The last piece tries 1,500 random logs. Keep-the-last agreed in 238 of them; in 223 every counter had a single entry. Why did the other 15 agree? Choose an answer.',
        'Each counter’s earlier changes happened to sum to zero, so the last change equalled the total. Here are the lines: they assert that exact condition on every log, and that order never matters.',
        'Then the scale: 20,000 increments over 50 counters. Both compactions keep 50 entries. Summing is exact, 400 times smaller; keeping the last is off by as much as 798. Size was never the question.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. The opening text defines every word before the code uses it.',
      question: { step: 0, prompt: 'One fact explains both failures — keep-the-last and the double replay. Which?', options: [
        { text: 'Setting a value is safe to repeat; adding is not.', correct: true, why: 'States can lose earlier entries and be replayed; deltas can do neither, because every addition counts.' },
        { text: 'The log was too long.', correct: false, why: 'Length is why we compact, not why the compaction failed.' },
        { text: 'The counters were named badly.', correct: false, why: 'Names do not matter. The format of the entries does.' } ] },
      code: P.whole(),
      cards: [ { step: 1, title: 'From top to bottom', html: '<p>The words; the delta log; fold with +; the chapter’s fold and emit; the wrong compaction and the two right ones; the examples; main.[[src:vars]]</p>' } ],
      narration: [
        'Here is the whole program. One fact explains both failures, keep-the-last and the double replay. Which? Choose an answer.',
        'Setting a value is safe to repeat; adding is not. So the log’s format, changes or states, is a decision about retention, made the moment the first entry is written.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'In the table, “the chapter’s log, reversed” is wrong by 19, not 17. Why a different error?', options: [
        { text: 'Reversed, a different entry is “last” for each counter.', correct: true, why: 'Keep-the-last now keeps errors +5 and hits +7, so the amount thrown away changes.' },
        { text: 'Reversing changes the true totals.', correct: false, why: 'The totals are still 24 and 21: addition ignores order.' },
        { text: 'A rounding error.', correct: false, why: 'All values are whole numbers; nothing is rounded.' } ] },
      code: OUT.whole('what python3 programs/ch06_v4.py prints'),
      cards: [ { step: 1, title: 'The last line', html: '<p><b>all assertions passed</b> — including that keep-the-last agreed in exactly the logs where earlier increments cancel.[[src:vars]]</p>' } ],
      narration: [
        'And here is what it prints. The chapter’s log reversed is wrong by 19, not 17. Why a different error? Choose an answer.',
        'Reversed, a different entry is last for each counter, so a different amount is thrown away. The true totals do not change. The last line says all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'A log of changes compacts by summing, never by keeping the last',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>fold_add</code>', 'The fold, with + instead of replace.', 'errors 24, hits 21'] },
          { step: 0, cells: ['<code>compact_last</code>', 'The chapter’s compaction on changes: wrong.', 'errors 8, hits 4'] },
          { step: 1, cells: ['<code>compact_sum</code> · <code>to_states</code>', 'Sum per counter, or fold then emit: right.', 'errors 24, hits 21'] },
          { step: 2, cells: ['replay · order', 'Deltas survive shuffling, not replay; states the reverse.', '48 vs 24'] },
          { step: 2, cells: ['the lucky case', 'Keep-the-last agrees only when earlier changes cancel.', '15 of 1,500 by luck'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 8: the chapter’s system design — a balance table and a change stream kept as two views that cannot drift.[[src:ch]]</p>' },
      narration: [
        'To recap. The fold works with plus instead of replace: errors 24, hits 21. The chapter’s compaction does not: keeping the last change gives errors 8 and hits 4.',
        'Summing per counter, or folding then emitting as states, shortens the log correctly.',
        'A delta log survives shuffling but not replay; a state log survives replay but not shuffling. And keep-the-last only agrees by luck, when earlier changes cancel.',
        'Next, part 8: the chapter’s system design, a balance table and a stream of changes kept as two views that cannot drift.'
      ]
    }
  ]
};
