// Chapter 6, Part 4 — the Google interview question, built as a program WITH the viewer.
// Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch06.py (read at build time by _prog.js, addressed by content, never by line
// number). The last slides show the whole file and what it actually prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch06';
const P = program('ch06.py');
const OUT = program('ch06.out');

// the pieces, in the order they are written
const DATA = P.span('# Data, from tools/gen_ch06_interview.js', 'TOMBSTONE = None');
const FOLD = P.fn('fold');
const EMIT = P.fn('emit');
const COMPACT = P.fn('compact');
const VALUE = P.fn('value_after');
const HIST = P.fn('history_of');
const MAIN1 = P.span('def main():', 'assert past_values == 7');
const MAIN2 = P.span('    hist = history_of(CHANGELOG, ASKED)', 'an unknown key too');
const TOMB = P.span('# a deletion must be an ENTRY', 'resurrects b: {fold(dropped)}');
const VARS = P.span('# The three variations.', 'return t, naive, fold(compact(states))');
const VMAIN = P.span('    # variations', 'converted first {repaired}');
const RAND = P.span('# brute force over many inputs', 'all assertions passed');
const END = P.span('if __name__', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['CHANGELOG = a=5  a=8  b=7  a=10  a=16  b=8  b=17  b=21  a=24',
  "fold    -> {'a': 24, 'b': 21}   (9 changes to 2 entries)", "emit    -> [('a', 24), ('b', 21)]   (2 entries, not 9)",
  '(7 of 9 entries dropped)', '(identical: True)', "key 'a' passed through [5, 8, 10, 16, 24]  (5 values)",
  "value_after(full log, 'a', 2)      = 8", "value_after(compacted, 'a', 2)     = UNANSWERABLE",
  "with a tombstone for 'b': {'a': 24};  compacting the tombstone away resurrects b: {'a': 24, 'b': 21}",
  "cache: same table {'a': 30, 'b': 21} from 3 entries instead of 10, handover at version 9",
  'audit: the state log says UNANSWERABLE, an uncompacted audit log says 8',
  "deltas: fold {'a': 10, 'b': 8}, compacting the deltas gives {'a': 2, 'b': 1} (wrong), converted first {'a': 10, 'b': 8}",
  '800 random changelogs', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch06.out no longer prints "${s}" — rewrite the narration`);

module.exports = {
  title: 'The Changelog Puzzle',
  eyebrow: 'Streaming · Ch 6 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['key', 'entry', 'log', 'table', 'function', 'fold', 'emit', 'compaction', 'unanswerable', 'tombstone', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 6 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 6 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 6 · the three variations'),
    whole: section(CH, 'The whole program', 'Chapter 6 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 6 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['key', 'entry', 'log'],
      eyebrow: '01 · A Google interview question',
      heading: 'Nine changes, two names, and a log too long to keep',
      hero: { step: 0, text: 'A system tracks two values, named by <b>keys</b>: <code>“a”</code> and <code>“b”</code>. Every change is written as one <b>entry</b> saying what a key <i>became</i>, such as <code>a=8</code>. The entries, in the order written, form the <b>log</b>: <code>a=5 a=8 b=7 a=10 a=16 b=8 b=17 b=21 a=24</code>.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'entries in the log[[src:prob]]' },
        { step: 1, value: 2, label: 'keys, “a” and “b”[[src:prob]]' },
        { step: 2, value: 7, label: 'entries that can be thrown away[[src:prob]]' },
        { step: 2, value: 8, label: 'what “a” held after its 2nd change[[src:trace]]' }
      ],
      cardsLabel: 'What the interviewer asks, in three steps',
      cards: [
        { step: 3, n: 1, title: 'Current values', text: 'Produce the value of every key now.' },
        { step: 3, n: 2, title: 'And back again', text: 'From those values, produce the changes back.' },
        { step: 4, n: 3, title: 'Too long to keep', text: 'What may you throw away, and what do you lose?' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'A system tracks two values, named by keys, “a” and “b”. Every change is written as one entry saying what a key became, such as “a” equals 8. The entries in order form the log.',
        'Our log has 9 entries for 2 keys. Key “a” goes 5, 8, 10, 16, 24, and key “b” goes 7, 8, 17, 21, mixed together.',
        'By the end we will have thrown away 7 of the 9 entries without changing the present, and found the one question that then becomes impossible: what “a” held after its 2nd change, which was 8.',
        'The interviewer asks three things. First, produce the current value of every key. Then, from those values, produce the changes back.',
        'And then: the log is too long to keep. What may you throw away, and what do you lose? We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Just the first three entries',
      stand: 'The log starts a=5, a=8, b=7. Each entry says what the key became.',
      question: { step: 0, prompt: 'After the first three entries, what does each key hold?', options: [
        { text: '“a” holds 8 and “b” holds 7.', correct: true, why: 'The later entry for “a” replaces the earlier one. “b” has one entry, 7.' },
        { text: '“a” holds 13 and “b” holds 7.', correct: false, why: 'That adds 5 and 8. But the entry says what “a” became, not how much it grew.' },
        { text: '“a” holds 5 and “b” holds 7.', correct: false, why: 'That keeps the first entry. The later entry is newer, so it wins.' } ] },
      cards: [
        { step: 1, title: 'Later replaces earlier', html: '<p>Each entry says what a key <b>became</b>, so applying it means replacing the old value. Nothing is added up.[[src:model]]</p>' },
        { step: 2, title: 'So order matters', html: '<p>Shuffle the log and a different entry comes last. The order of the log is the entire content of the answer.[[src:model]]</p>' }
      ],
      narration: [
        'Try a small case first. The log starts “a” equals 5, “a” equals 8, “b” equals 7. After those three entries, what does each key hold? Choose an answer.',
        '“a” holds 8 and “b” holds 7. Each entry says what the key became, so a later entry simply replaces an earlier one. Nothing is added.',
        'That also means the order is everything. Shuffle the log, and a different entry comes last, and the answer changes. Now let us write the program.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['unanswerable', 'tombstone'],
      eyebrow: '03 · Writing the program · the log',
      heading: 'Start with the nine entries',
      stand: 'A program is written top to bottom. The first thing it needs is the log itself.',
      question: { step: 0, prompt: 'How should the program hold the log?', options: [
        { text: 'A list of pairs, key and new value, in the order written.', correct: true, why: 'A list keeps the order, and each pair is one entry: which key, and what it became.' },
        { text: 'One number per key, already added up.', correct: false, why: 'That is the answer, not the log. The history would be gone before we start.' },
        { text: 'A list of pairs, sorted by key so all “a” entries are together.', correct: false, why: 'Sorting loses the order between the keys, and order is the whole content of the log.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch06.py · the log' }),
      cards: [ { step: 2, title: 'A few names', html: '<p><code>CHANGELOG</code> holds the 9 pairs. <code>ASKED</code> is “a”, the key we will ask about. <code>UNANSWERABLE</code> is a refusal: “this cannot be answered”, not a value. A <b>tombstone</b>, <code>None</code>, is an entry meaning “this key is gone”.[[src:whole]]</p>' } ],
      narration: [
        'First, the log. How should the program hold it? Choose an answer.',
        'A list of pairs, in the order written. Here are the first lines of the real program: the nine pairs, how many there are, and the two keys.',
        'Three more names for later: the key we will ask about, “a”; the word unanswerable, a refusal rather than a value; and None, an entry meaning a key is gone, called a tombstone.'
      ]
    },

    /* ---------- 4 · the fold ---------- */
    {
      title: 'Fold', layout: 'code', defines: ['table', 'function', 'fold'],
      eyebrow: '04 · Writing the program · the current values',
      heading: 'One pass, one replacement per entry',
      stand: 'The first question: the current value of every key. The result is a table: one value per key.',
      question: { step: 0, prompt: 'Going through the log in order, what does the program do with each entry?', options: [
        { text: 'Set that key’s value to the entry’s value, replacing what was there.', correct: true, why: 'The entry says what the key became, so it simply replaces the old value.' },
        { text: 'Add the entry’s value to that key’s running total.', correct: false, why: 'That treats “became 8” as “plus 8”, and “a” would end far above 24.' },
        { text: 'Keep whichever value is larger.', correct: false, why: 'Values may go down. The newest entry wins, not the largest.' } ] },
      code: P.build({ before: [DATA], add: [FOLD], step: 1 }),
      cards: [ { step: 2, title: 'Fold, and the tombstone', html: '<p>A <b>function</b> is a named recipe; this one is <code>fold</code>: one pass, building the <b>table</b>. A tombstone entry removes its key.[[src:whole]]</p><p><code>fold(CHANGELOG)</code> = <b>{a: 24, b: 21}</b>: 9 changes to 2 entries.[[src:trace]]</p>' } ],
      narration: [
        'The first question: the current value of every key. Going through the log in order, what does the program do with each entry? Choose an answer.',
        'It sets that key’s value, replacing what was there. Here is the function, called fold. A function is a named recipe; this one goes through the log once and builds the table.',
        'One more detail: a tombstone entry removes its key. Folding the whole log gives “a” 24 and “b” 21: nine changes became two entries.'
      ]
    },

    /* ---------- 5 · emit ---------- */
    {
      title: 'Emit', layout: 'code', defines: ['emit'],
      eyebrow: '05 · Writing the program · the changes back',
      heading: 'The table, written out as a log again',
      stand: 'The second question: produce the changes back, from the table.',
      question: { step: 0, prompt: 'From the table {a: 24, b: 21}, how many entries can the program write back out?', options: [
        { text: '9: the same entries that went in.', correct: false, why: 'The table never kept 5, 8, 10 and the rest. It cannot write out what it does not have.' },
        { text: '2: one per key, holding its value now.', correct: true, why: 'The table holds one value per key, so that is all it can produce: “a” 24 and “b” 21.' },
        { text: '7: the entries that were replaced.', correct: false, why: 'Those are exactly the ones the table forgot. They are gone from it.' } ] },
      code: P.build({ before: [DATA, FOLD], add: [EMIT], step: 1 }),
      cards: [ { step: 2, title: 'Only one direction is lossless', html: '<p>To <b>emit</b> is to write the table out as entries: <b>2</b>, not 9. Folding loses nothing you can get back; emitting cannot invent the 7 values it never kept.[[src:model]]</p>' } ],
      narration: [
        'The second question: produce the changes back, from the table. From “a” 24 and “b” 21, how many entries can the program write out? Choose an answer.',
        'Two, one per key. Here is the function, called emit: it writes the table out as entries, a equals 24 and b equals 21.',
        'So the two directions are not symmetric. Folding loses nothing the present needs, but emitting cannot invent the 7 earlier values the table never kept.'
      ]
    },

    /* ---------- 6 · compaction ---------- */
    {
      title: 'Keep', layout: 'code', defines: ['compaction'],
      eyebrow: '06 · Writing the program · what may be thrown away',
      heading: 'Keep the last entry per key',
      stand: 'The third question: the log is too long to keep. Which entries can go, without changing what the log folds to?',
      question: { step: 0, prompt: 'Which entries can be dropped so that folding the shorter log still gives {a: 24, b: 21}?', options: [
        { text: 'Every entry that a later entry for the same key replaces.', correct: true, why: 'Those values are overwritten during the fold anyway, so dropping them changes nothing in the result.' },
        { text: 'The oldest half of the log, whatever the keys.', correct: false, why: 'If a key’s only entry is old, dropping it removes the key from the table.' },
        { text: 'All but the very last entry, “a” becomes 24.', correct: false, why: 'Then “b” disappears. The last entry must be kept per key, not overall.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT], add: [COMPACT], step: 1 }),
      cards: [ { step: 2, title: 'Compaction', html: '<p>Keeping only the last entry per key is <b>compaction</b>. Here 7 of 9 entries go: [a=24, b=21]. A tombstone is the one entry that must be kept until every reader has seen it.[[src:model]]</p>' } ],
      narration: [
        'The third question: the log is too long to keep. Which entries can be dropped so that folding still gives 24 and 21? Choose an answer.',
        'Every entry replaced by a later entry for the same key. Here is the function: it remembers the last value per key and writes out one entry each. This is called compaction.',
        'Here it drops 7 of the 9 entries, keeping a equals 24 and b equals 21. The comment adds one rule: a tombstone is never dropped until every reader has seen it.'
      ]
    },

    /* ---------- 7 · questions about the past ---------- */
    {
      title: 'Past', layout: 'code',
      eyebrow: '07 · Writing the program · what is lost',
      heading: 'Asking about the past, and refusing honestly',
      stand: 'What was lost? Questions about the past: “what did “a” hold after its 2nd change?”. The full log says 8.',
      question: { step: 0, prompt: 'Asked about the 2nd change of “a” on the compacted log, which no longer has it, what should the function return?', options: [
        { text: '24: the only value of “a” it can find.', correct: false, why: '24 is the present, not the 2nd change. A confident wrong answer is worse than none.' },
        { text: 'A clear refusal: this cannot be answered.', correct: true, why: 'The information is gone. Saying so lets the person asking know, instead of misleading them.' },
        { text: '0, meaning no value.', correct: false, why: '0 looks like a real value. Nobody can tell it from an answer.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT], add: [VALUE, HIST], step: 1 }),
      cards: [ { step: 2, title: 'Unanswerable, not wrong', html: '<p><code>value_after</code> counts the key’s entries and returns the n-th, or <b>UNANSWERABLE</b>. <code>history_of</code> lists every value a key passed through: 5, 8, 10, 16, 24.[[src:trace]]</p>' } ],
      narration: [
        'What was lost? Questions about the past. On the compacted log, which no longer has the 2nd change of “a”, what should the function return? Choose an answer.',
        'A clear refusal. Here is the function, value after: it counts the key’s entries and returns the n-th one, or the word unanswerable if there are not that many.',
        'The second function, history of, lists every value a key passed through: 5, 8, 10, 16, 24 for “a”. Every one of those was real, and someone may have seen it.'
      ]
    },

    /* ---------- 8 · checks, part 1 ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assert'],
      eyebrow: '08 · Writing the program · checking the present',
      heading: 'Run all three answers, and check them',
      stand: 'The main part prints each answer and then asserts it: a line that stops the program if the claim is false.',
      question: { step: 0, prompt: 'Of all the checks, which one does the claim “compaction is safe” rest on?', options: [
        { text: 'Folding the compacted log gives exactly the same table.', correct: true, why: 'That is the whole promise of compaction: the present is unchanged. If it failed, nothing else would matter.' },
        { text: 'The compacted log has exactly 2 entries.', correct: false, why: 'A log of 2 wrong entries would also have 2 entries. Size proves nothing about correctness.' },
        { text: 'The emitted log is shorter than the original.', correct: false, why: 'That shows the asymmetry, not that compaction preserves the present.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT, VALUE, HIST], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Asserted, not assumed', html: '<p>To <b>assert</b> is to stop the program if a claim is false. <code>fold(compact)</code> = {a: 24, b: 21}, <b>identical: True</b>; 7 dropped; 7 past values lost.[[src:whole]]</p>' } ],
      narration: [
        'The main part runs all three answers. Of its checks, which one does the claim “compaction is safe” rest on? Choose an answer.',
        'Folding the compacted log gives exactly the same table. Here is the start of main: it folds, emits and compacts, prints each, and asserts each claim. To assert is to stop the program if a claim is false.',
        'The output confirms it: the compacted log folds to “a” 24 and “b” 21, identical. Seven entries dropped, and seven past values gone across both keys.'
      ]
    },

    /* ---------- 9 · checks, part 2 ---------- */
    {
      title: 'Hist', layout: 'code',
      eyebrow: '09 · Writing the program · checking the past',
      heading: 'The full log answers 8; the compacted one refuses',
      stand: 'Next the program asks about the 2nd change of “a”, from both logs.',
      question: { step: 0, prompt: 'Besides checking that the compacted log says unanswerable, why also assert that it does NOT say 24?', options: [
        { text: 'Because quietly returning the current value is the bug most likely to slip in.', correct: true, why: '24 looks plausible and sounds certain. The check forbids that specific wrong answer by name.' },
        { text: 'Because 24 is too large to be a value of “a”.', correct: false, why: '24 is a real value of “a”: its present one. That is exactly what makes it dangerous.' },
        { text: 'It is a duplicate check and changes nothing.', correct: false, why: 'It names the forbidden outcome, so a later change that returns 24 fails loudly.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT, VALUE, HIST, MAIN1], add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'The two answers', html: '<p>Full log: <code>value_after(…, ’a’, 2)</code> = <b>8</b>. Compacted: <b>UNANSWERABLE</b>. An unknown key, “zz”, is unanswerable too.[[src:trace]]</p>' } ],
      narration: [
        'Next, the program asks about the 2nd change of “a” from both logs. Besides checking for unanswerable, why also assert the compacted answer is not 24? Choose an answer.',
        'Because quietly returning the current value is the bug most likely to slip in. Here are the lines: “a” passed through 5, 8, 10, 16, 24, and the 2nd value is 8.',
        'From the full log the answer is 8; from the compacted log, unanswerable. And a key the log never mentions, “zz”, is unanswerable too, rather than some default.'
      ]
    },

    /* ---------- 10 · the tombstone ---------- */
    {
      title: 'Tomb', layout: 'code',
      eyebrow: '10 · Writing the program · deleting a key',
      heading: 'A deletion has to be an entry',
      stand: 'Now key “b” is deleted. The fold builds the table only from entries.',
      question: { step: 0, prompt: 'How must the deletion of “b” appear in the log?', options: [
        { text: 'As a new entry for “b” whose value says “gone”.', correct: true, why: 'The fold only hears about entries. An entry saying “gone” is the only way to make it remove “b”.' },
        { text: 'By removing every entry for “b” from the log.', correct: false, why: 'Readers that already folded the log would never hear that “b” went away; they keep 21 forever.' },
        { text: 'It needs nothing: the table can just drop “b”.', correct: false, why: 'Then the log and the table disagree, and folding the log again brings “b” back.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT, VALUE, HIST, MAIN1, MAIN2], add: [TOMB], step: 1 }),
      cards: [ { step: 2, title: 'Drop the tombstone, and “b” is back', html: '<p>With the tombstone: {a: 24}. A compaction that keeps the last <i>non-tombstone</i> entry treats the delete as an absence and <b>resurrects b</b>: {a: 24, b: 21}.[[src:trace]]</p>' } ],
      narration: [
        'Now key “b” is deleted. The fold builds the table only from entries. How must the deletion appear in the log? Choose an answer.',
        'As a new entry, “b” equals None, a tombstone. Here are the lines: with the tombstone, the log folds to “a” 24 alone, and compacting keeps the tombstone.',
        'Then the realistic bug: a compaction that keeps the last non-tombstone entry treats the delete as an absence, and “b” comes back with 21. A deletion is a fact, not a gap.'
      ]
    },

    /* ---------- 11 · the three variations ---------- */
    {
      title: 'Vary', layout: 'code',
      eyebrow: '11 · Writing the program · the same idea in three disguises',
      heading: 'A cache, an audit, and a counter',
      stand: 'The file also solves three variations, each with a different surface. The last one changes the log’s format: entries say “+5”, what changed, instead of what the key became.',
      question: { step: 0, prompt: 'If entries say “+5” instead of “became 5”, does keeping the last entry per key still work?', options: [
        { text: 'No: every “+” entry counts, so dropping any changes the total.', correct: true, why: 'Nothing is replaced in a sum. Keeping only the last “+” throws away the rest of the total.' },
        { text: 'Yes: compaction never changes what a log folds to.', correct: false, why: 'That holds only when later entries replace earlier ones. Here they add to them.' },
        { text: 'Yes, as long as the entries stay in order.', correct: false, why: 'Order is not the problem. The dropped entries were part of the sum.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT, VALUE, HIST, MAIN1, MAIN2, TOMB], add: [VARS, VMAIN], step: 1 }),
      cards: [ { step: 2, title: 'What the three print', html: '<p><b>Cache:</b> same table from <b>3</b> entries instead of 10. <b>Audit:</b> the compacted log says UNANSWERABLE, an uncompacted one says <b>8</b>. <b>Deltas:</b> fold {a: 10, b: 8}; keeping the last gives {a: 2, b: 1}, <b>wrong</b>.[[src:vars]]</p>' } ],
      narration: [
        'The file also solves three variations. In the last, entries say plus 5, what changed, instead of what the key became. Does keeping the last entry per key still work? Choose an answer.',
        'No. In a sum every entry counts, so dropping any changes the total. Here are the three variation functions and the lines that run them; parts 5, 6 and 7 build each one properly.',
        'The cache restarts from 3 entries instead of 10. The audit question gets unanswerable from the compacted log, 8 from the full one. And the plus-entry log, compacted naively, is wrong.'
      ]
    },

    /* ---------- 12 · random checks ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '12 · Writing the program · beyond one example',
      heading: '800 random logs, checked the same way',
      stand: 'One worked example can pass by luck. The last piece invents many logs and checks every claim on each.',
      question: { step: 0, prompt: 'Why test 800 random logs when the chapter’s log already passes?', options: [
        { text: 'One example can pass by accident; many make an accident very unlikely.', correct: true, why: 'Random logs hit cases nobody thought of: one key, repeated values, very short logs.' },
        { text: 'To measure how fast the program runs.', correct: false, why: 'Nothing here is timed. Every random log is checked for correctness only.' },
        { text: 'Because the chapter’s log might be wrong.', correct: false, why: 'The chapter’s log is checked separately above. These logs test the functions, not the data.' } ] },
      code: P.build({ before: [DATA, FOLD, EMIT, COMPACT, VALUE, HIST, MAIN1, MAIN2, TOMB, VARS, VMAIN], add: [RAND, END], step: 1 }),
      cards: [ { step: 2, title: 'Every claim, every log', html: '<p>Compaction preserves the present; emit round-trips the present; <code>value_after</code> matches a rescan — while every key with a history loses all but its last value.[[src:whole]]</p>' } ],
      narration: [
        'The last piece. Why test 800 random logs when the chapter’s log already passes? Choose an answer.',
        'One example can pass by accident. Here it is: 800 random logs, and for each one, compaction must preserve the table, emit must round-trip it, and every past value must match a rescan.',
        'And on every log, any key with a history loses all but its last value after compaction. That is the guarantee, and the limit, checked 800 times.'
      ]
    },

    /* ---------- 13 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '13 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      question: { step: 0, prompt: 'Which one function, by itself, turns the log into the present?', options: [
        { text: 'The fold.', correct: true, why: 'One pass, one replacement per entry. Everything else is built around it.' },
        { text: 'Compaction.', correct: false, why: 'Compaction makes a shorter log. It still has to be folded to give the table.' },
        { text: 'Emit.', correct: false, why: 'Emit goes the other way: from the table back to entries.' } ] },
      code: P.whole(),
      cards: [ { step: 1, title: 'Read it top to bottom', html: '<p>The log; fold, emit, compact; the questions about the past; the three variations; and main with its checks.[[src:whole]]</p>' } ],
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Before scrolling: which one function, by itself, turns the log into the present? Choose an answer.',
        'The fold. From the top: the log; fold, emit and compact; the two questions about the past; the three variations; and main, which runs and checks everything.'
      ]
    },

    /* ---------- 14 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '14 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'Compaction dropped 7 entries, and 7 past values are lost. Why are those two numbers equal?', options: [
        { text: 'Each dropped entry was one value a key used to hold.', correct: true, why: '“a” loses 4 of its 5 values and “b” 3 of its 4: 7 entries, 7 past values.' },
        { text: 'It is a coincidence of this log.', correct: false, why: 'It holds for any log of “became” entries: every dropped entry is a replaced value.' },
        { text: 'The program forces them to match.', correct: false, why: 'It counts them separately and only then asserts both are 7.' } ] },
      code: OUT.whole('what python3 programs/ch06.py prints'),
      cards: [ { step: 1, title: 'The last line', html: '<p><b>all assertions passed</b>: every printed answer was checked, including the refusals.[[src:whole]]</p>' } ],
      narration: [
        'And here is what the program prints. Compaction dropped 7 entries, and 7 past values are lost. Why are those numbers equal? Choose an answer.',
        'Each dropped entry was one value a key used to hold: “a” loses 4 of its 5 values, and “b” 3 of its 4. The last line says all assertions passed.'
      ]
    },

    /* ---------- 15 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '15 · What you built',
      heading: 'Fold, emit, compact — and what each cannot do',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>fold</code>', 'Log → table: one replacement per entry; a tombstone removes.', '9 entries → {a: 24, b: 21}'] },
          { step: 0, cells: ['<code>emit</code>', 'Table → log: one entry per key. Cannot invent the past.', '2 entries, not 9'] },
          { step: 1, cells: ['<code>compact</code>', 'Keep the last entry per key; same table, no history.', '7 of 9 dropped'] },
          { step: 2, cells: ['<code>value_after</code>', 'The n-th value of a key, or UNANSWERABLE.', '8 from the full log'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>The same program wears three disguises: a cache that must not go stale, an audit log that was compacted, and a log of counters. Each gets its own part.[[src:vars]]</p>' },
      narration: [
        'To recap. Fold turns the log into the table with one replacement per entry. Emit turns the table back into a log, but only one entry per key: it cannot invent the past.',
        'Compact keeps the last entry per key. The table is unchanged, and every question about the past is gone: 7 of 9 entries dropped.',
        'Value after answers questions about the past, and refuses honestly when it cannot: 8 from the full log, unanswerable from the compacted one.',
        'Next, the same program in three disguises: a cache, an audit log, and a log of counters. Each one gets its own part, built the same way.'
      ]
    }
  ]
};
