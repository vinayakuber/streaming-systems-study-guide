// Chapter 1, Part 7 — Variation 4, the average that must survive a restart, built as a program
// WITH the viewer. The running total looks like one number to save, and that is the trap: the
// next subtraction needs the window, and the position must be saved with it as one fact. Every
// failure is produced by actually crashing the worker and restarting it from what it wrote.
// Listings come from programs/ch01_v4.py through _prog.js; the narration's results are asserted
// against programs/ch01_v4.out, and the crash table is recomputed here and checked against it.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch01';
const P = program('ch01_v4.py');
const OUT = program('ch01_v4.out');
const seg = (a, b) => [P.at(a), P.at(b) - 1];

const DOC = [0, P.at("# The chapter's stream and window, unchanged") - 1];
const DATA = seg("# The chapter's stream and window, unchanged", '# Inputs for the examples table');
const EX = seg('# Inputs for the examples table', 'def exact_answers(');
const EXACT = seg('def exact_answers(', 'def save_window(');
const SAVES = seg('def save_window(', 'def run(');
const LIFE1 = [P.at('def run('), P.at('if crash_at is None:') + 1];
const RESTART = seg('# ---- the restart: everything not in', 'def show_examples(');
const SHOW = seg('def show_examples(', 'def main():');
const MAIN1 = seg('def main():', '# ---- what the two checkpoints cost');
const MAIN2 = seg('# ---- what the two checkpoints cost', '# ---- the warm-up has to survive the restart too');
const MAIN3 = [P.at('# ---- the warm-up has to survive the restart too'), P.lines.length - 1];
const upTo = (...ps) => ps;

// the worker, re-run here for the total-only policy at every crash point (the program's own rule)
const VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8], W = 3;
const runTotalOnly = c => {
  let total = 0; let win = [];
  for (let i = 0; i < c; i++) { total += VALUES[i]; win.push(VALUES[i]); if (win.length > W) total -= win.shift(); }
  const saved = total; win = [];
  for (let i = c; i < VALUES.length; i++) { total += VALUES[i]; win.push(VALUES[i]); if (win.length > W) total -= win.shift(); }
  return { saved, final: total / W };
};
const CRASH = [1, 2, 3, 4, 5, 6, 7, 8];
const SAVED = CRASH.map(c => runTotalOnly(c).saved);
const FINAL_TOTAL = CRASH.map(c => { const f = runTotalOnly(c).final; return Number.isInteger(f) ? f.toFixed(1) : f.toFixed(4); });
const FINAL_WINDOW = CRASH.map(() => '7.0');
const TRUTH = ['5.0', '4.0', '5.0', '3.0', '5.3333', '4.6667', '7.0'];
const AHEAD = ['5.0', '4.0', '3.3333', '4.0', '4.6667', '7.0'];
const BEHIND = ['5.0', '4.0', '3.6667', '3.3333', '3.0', '5.3333', '4.6667', '7.0'];
const pad = (a, n) => [...a, ...Array(n - a.length).fill('—')];

const printed = OUT.lines.join('\n');
for (const s of ['no crash: [5.0, 4.0, 5.0, 3.0, 5.3333, 4.6667, 7.0]',
  'policy   total: final answer [7.3333, 8.6667, 9.3333, 9.6667, 10.0, 11.0, 12.0]', 'policy  window: final answer [7.0]',
  'crash_at=4 persisted total 12; the truth ends at 7.0000 and the', 'restart ends at 11.0000 -- high by exactly 12/3 = 4.0000',
  'checkpoint sizes: total-only 2 numbers, window 4 numbers,', 'W = 100,000 -> 100,001 numbers persisted per 1 reported',
  `position ONE AHEAD of the state : [${AHEAD.join(', ')}]`, `position ONE BEHIND the state   : [${BEHIND.join(', ')}]`,
  'never restarted 6 of 7, restarted and rebuilt from the window 1 of 7', 'all 21 examples agree with the from-scratch reference',
  'so it is right only when that total happens to be', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch01_v4.out no longer prints "${s}" — rewrite the narration`);
if (SAVED[3] !== 12 || FINAL_TOTAL[3] !== '11.0' || [...new Set(FINAL_TOTAL)].sort().join() !== '10.0,11.0,12.0,7.3333,8.6667,9.3333,9.6667')
  throw new Error('the restart simulation no longer matches the program — rewrite the narration');

module.exports = {
  title: 'Surviving a Restart',
  eyebrow: 'Streaming · Ch 1 · Part 7',
  ...shared,
  jargon: ['input', 'window', 'average', 'answer', 'worker', 'crash', 'checkpoint', 'running total', 'list', 'function',
    'position', 'replay', 'skew', 'float'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    model: section(CH, 'How to model it', 'Chapter 1 · the running total'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 1 · variation 4, surviving a restart'),
    whole: section(CH, 'The whole program', 'Chapter 1 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 1 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['input', 'window', 'average', 'answer', 'worker', 'crash', 'checkpoint', 'position'],
      eyebrow: '01 · Variation 4 · looks like reliability',
      heading: 'The average of the last three — and the program is killed half-way',
      hero: { step: 0, text: 'A <b>worker</b> program reads numbers one at a time; each is an <b>input</b>. After each, it emits an <b>answer</b>: the <b>average</b> of the last 3 inputs, the <b>window</b>. Then it is killed mid-stream — a <b>crash</b> — and restarted. What it wrote to disk as it went, its <b>checkpoint</b>, is all that survives.[[src:vars]]' },
      tiles: [
        { step: 1, value: 7, label: 'answers from inputs 5, 3, 7, 2, 6, 1, 9, 4, 8[[src:vars]]' },
        { step: 1, value: 7, label: 'the last answer: (9 + 4 + 8) ÷ 3' },
        { step: 2, value: 11, label: 'the last answer if only the total was saved' },
        { step: 2, value: 100001, label: 'numbers to save to report one, with 100,000 per window' }
      ],
      cardsLabel: 'Two traps, and one alarm',
      cards: [
        { step: 3, n: 1, title: 'Save the total?', text: 'It is one number and looks enough. It is not.' },
        { step: 3, n: 2, title: 'Save the position too', text: 'The position: the number of the next input to read. Written with the state, or the restart is silently wrong.' },
        { step: 4, n: 3, title: 'Count the answers', text: 'The cheapest alarm: a wrong restart emits the wrong number of them.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A worker program reads numbers one at a time; each is an input. After each, it emits an answer: the average of the last 3 inputs, the window. Then it is killed mid-stream, a crash, and restarted. Only what it wrote to disk survives: its checkpoint.',
        'The inputs are the chapter’s nine values: 5, 3, 7, 2, 6, 1, 9, 4, 8. Run straight through, they give 7 answers, the last one 7.',
        'If the worker saves only its total and crashes before input 4, its last answer comes out 11, not 7. And with 100,000 values per window, the safe checkpoint holds 100,001 numbers to report one.',
        'There are two traps. Saving the total looks like enough, and is not. And the position to carry on from must be written together with the state.',
        'And the cheapest alarm: a wrong restart often emits the wrong number of answers. We will write the program together; you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['running total'],
      eyebrow: '02 · Your turn · before any code',
      heading: 'Killed just before input 4',
      stand: 'The worker keeps a running total: add each input, subtract the one leaving the window. After inputs 5, 3, 7, 2 the window is 3, 7, 2 and the total is 12. It saved that 12, then crashed.',
      question: {
        step: 0,
        prompt: 'On restart, input 4 (the value 6) arrives. To update the total, what does the worker need that the 12 cannot give it?',
        options: [
          { text: 'The value leaving the window: the 3.', correct: true,
            why: 'The window becomes 7, 2, 6, so the 3 must be subtracted. The total alone does not say what its parts were.' },
          { text: 'Nothing more: add 6 to 12 and carry on.', correct: false,
            why: 'Then the total holds four values, 3, 7, 2 and 6. The 3 has to come out, and the 12 cannot say it was a 3.' },
          { text: 'Every input since the very beginning.', correct: false,
            why: 'Only the window is needed. Inputs that left it long ago are never read again.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A running total', html: '<p>A total kept up to date by adding the arrival and subtracting the leaver is a <b>running total</b>. Its subtraction needs the departing value, so the window must still be there.[[src:model]]</p>' },
        { step: 2, title: 'The trap', html: '<p>The total is one number and looks trivially easy to save. Restoring it without the last 3 values makes the next subtraction impossible.[[src:vars]]</p>' }
      ],
      narration: [
        'A small case first. The worker keeps a running total. After 5, 3, 7, 2 the window is 3, 7, 2, the total 12, which it saved. Then it crashed. On restart, the 6 arrives. What does it need that the 12 cannot give? Choose an answer.',
        'The value leaving the window: the 3. A total kept up to date by adding the arrival and subtracting the leaver is a running total, and its subtraction needs the departing value.',
        'That is the trap. The total is one number and looks easy to save. But restoring it without the last 3 values makes the next subtraction impossible.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '03 · Writing the program · the words, then the data',
      heading: 'The chapter’s stream and window, unchanged',
      stand: 'The top of the file defines every word: input, window, answer, checkpoint, crash at k. Then the data.',
      question: { step: 0, prompt: 'A crash “at k” kills the worker just before it reads input k. Which crash is the earliest that has read anything?', options: [
        { text: 'Crash at 0.', correct: false, why: 'Killed before input 0 means nothing was read at all: there is nothing to restart from.' },
        { text: 'Crash at 1.', correct: true, why: 'It has read input 0, the 5, and saved a checkpoint holding it. That is the earliest interesting crash.' },
        { text: 'Crash at 3.', correct: false, why: 'By then three inputs have been read. Crashes at 1 and 2 come earlier and have read something too.' } ] },
      code: P.build({ add: [DOC, DATA], step: 1, label: 'programs/ch01_v4.py · the words, then the data' }),
      cards: [ { step: 2, title: 'The data', html: '<p><code>VALUES</code> is a <b>list</b> of the nine inputs, <code>W = 3</code>. <code>HUGE = 1e16</code> comes back at the end: a total carried across a restart carries its rounding error with it.[[src:vars]]</p>' } ],
      narration: [
        'First, the words and the data. A crash at k kills the worker just before it reads input k. Which crash is the earliest that has read anything? Choose an answer.',
        'Crash at 1: it has read the 5. Here is the top of the file. It defines input, window, answer, checkpoint and crash at k, and works the answers out in its own words before any code.',
        'Then the data: values, a list of the nine inputs, and the window size 3. The huge constant comes back at the very end of the program.'
      ]
    },

    /* ---------- 4 · the reference and the two checkpoints ---------- */
    {
      title: 'Save', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · what a checkpoint holds',
      heading: 'Save the window, or save the total?',
      stand: 'First the reference, which sums every window from scratch. Then the two ways to write a checkpoint.',
      question: { step: 0, prompt: 'What must the checkpoint that WORKS hold?', options: [
        { text: 'The total, and where to carry on reading.', correct: false, why: 'That is the one that looks enough: two numbers, missing exactly the values the next subtraction needs.' },
        { text: 'The window’s values, and where to carry on reading.', correct: true, why: 'With the window, the total can be rebuilt and every later subtraction works. 3 values plus a position.' },
        { text: 'Every answer emitted so far.', correct: false, why: 'Past answers are averages. They cannot give back the values the next subtraction needs.' } ] },
      code: P.build({ before: upTo(DOC, DATA), add: [EXACT, SAVES], step: 1 }),
      cards: [ { step: 2, title: 'Larger than what it reports', html: '<p>A <b>function</b> is a named recipe. <code>save_window</code> keeps the window plus the <b>position</b>, the number of the next input to read: <b>W + 1</b> numbers to report one. <code>save_total</code> keeps 2.[[src:vars]]</p>' } ],
      narration: [
        'First the reference, which sums every window from scratch. Then two ways to write a checkpoint. What must the one that works hold? Choose an answer.',
        'The window’s values, and where to carry on reading. Here are exact answers, the reference, and two functions, named recipes: save window, and save total.',
        'Where to carry on is the position: the number of the next input. Save window keeps 3 values and the position, 4 numbers to report 1. Save total keeps just 2. The thing to save is larger than the thing reported.'
      ]
    },

    /* ---------- 5 · the first life ---------- */
    {
      title: 'Life', layout: 'code', defines: ['skew'],
      eyebrow: '05 · Writing the program · the worker’s first life',
      heading: 'Read, update, answer, checkpoint — until the crash',
      stand: 'The worker runs as before, and writes a checkpoint after every input. If a crash point is given, it stops just before that input.',
      question: { step: 0, prompt: 'Why is the checkpoint written after EVERY input, not only now and then?', options: [
        { text: 'So a crash at any moment loses nothing that was already answered.', correct: true, why: 'The restart carries on from exactly the last input finished, wherever the crash falls.' },
        { text: 'Because writing it is free.', correct: false, why: 'It is not free: the safe one is W + 1 numbers each time. It is paid so that no input is lost or repeated.' },
        { text: 'So that the answers come out faster.', correct: false, why: 'Writing a checkpoint adds work. It buys a correct restart, not speed.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EXACT, SAVES), add: [LIFE1], step: 1 }),
      cards: [ { step: 2, title: 'The crash, injected', html: '<p><code>run</code> breaks out of its loop at <code>crash_at</code>, so the failures later are produced by really stopping the worker. The <code>skew</code> setting shifts the saved position out of step with the saved state: <b>skew</b>. It comes back in a moment.[[src:vars]]</p>' } ],
      narration: [
        'Now the worker’s first life. It reads each input, updates the total and the window, emits an answer once 3 have arrived, and writes a checkpoint. Why after every input? Choose an answer.',
        'So that a crash at any moment loses nothing already answered. Here is the start of run. If a crash point is given, it breaks out of the loop just before that input, so every failure later is a real crash.',
        'One line shifts the saved position by a setting called skew. It does nothing for now; it comes back in a moment.'
      ]
    },

    /* ---------- 6 · the restart ---------- */
    {
      title: 'Restart', layout: 'code', defines: ['replay'],
      eyebrow: '06 · Writing the program · the second life',
      heading: 'Restart from the checkpoint alone',
      stand: 'Total-only restart: the total comes back as 12, the window comes back empty. The worker carries on from input 4, refilling the window.',
      question: { step: 0, prompt: 'What happens to the restored 12 once the window has refilled?', options: [
        { text: 'It is subtracted out as the window refills, so all is well.', correct: false, why: 'That was the program author’s first guess too. Measured: no window entry stands behind the 12, so nothing ever takes it out.' },
        { text: 'It stays in the total forever: the last answer is 12 over 3, so 4, too high.', correct: true, why: 'Subtraction resumes on values that arrived after the restart. The restored 12 has no entries behind it.' },
        { text: 'The worker notices and starts again from input 0.', correct: false, why: 'Nothing in the worker can notice. It carries on confidently and answers 11.0 instead of 7.0.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EXACT, SAVES, LIFE1), add: [RESTART], step: 1 }),
      cards: [ { step: 2, title: 'Three policies', html: '<p><b>window</b>: rebuild the total from the saved values — exact. <b>total</b>: the window is simply not there — high by 12/3 = 4. <b>replay</b>: re-read the last 3 inputs from the source — exact, which is saving the window by another name.[[src:vars]]</p>' } ],
      narration: [
        'Now the second life. With only the total saved, the 12 comes back and the window comes back empty. The worker carries on from input 4. What happens to the 12 once the window has refilled? Choose an answer.',
        'It stays in the total forever. Here is the restart. For a saved window, it rebuilds the total from the values. For a saved total, the window is simply not there, so the 12 has no entries behind it and is never subtracted.',
        'A third policy, replay, saves the total and on restart re-reads the last 3 inputs from their source. That is exact too, but it is saving the window by another name, and needs a source that can be read again.'
      ]
    },

    /* ---------- 7 · every crash point, animated ---------- */
    {
      title: 'Crash', layout: 'array',
      eyebrow: '07 · Watch the restart at every crash point',
      heading: 'Save the window: always 7.0. Save the total: never.',
      stand: 'One column per crash point. The total saved at that moment, and the last answer after restarting. The truth is 7.0.',
      array: {
        labelWidth: 200, slotLabel: 'crash before input', slots: false,
        rows: [
          { label: 'crash before input', values: CRASH },
          { label: 'saved total', values: SAVED },
          { label: 'last answer, total saved', values: FINAL_TOTAL },
          { label: 'last answer, window saved', values: FINAL_WINDOW }
        ],
        meters: ['crash points', 'right, total saved', 'crash points', 'right, window saved'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: '7.0', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 2, do: 'show', rows: [3] },
          { step: 2, do: 'sweep', row: 3, mode: 'match', match: '7.0', readMeter: 2, resultMeter: 3, speed: 300 },
          { step: 3, do: 'pick', slots: [3] }
        ]
      },
      cards: [
        { step: 3, title: 'Crash before input 4', html: '<p>Saved total <b>12</b>. The restart ends at <b>11.0</b>: high by exactly 12/3 = 4, the restored total that nothing will ever subtract.[[src:vars]]</p>' }
      ],
      narration: [
        'One column per crash point, from just before input 1 to just before input 8. Under each, the total the worker had saved at that moment.',
        'Now the last answer after a total-only restart. Watch the pointer: not one crash point comes out at the true 7.',
        'And with the window saved: every crash point comes out at exactly 7. Eight out of eight.',
        'Look at the crash before input 4. The saved total was 12, and the restart ends at 11: high by exactly 12 divided by 3, the restored total that nothing will ever subtract.'
      ]
    },

    /* ---------- 8 · the skew ---------- */
    {
      title: 'Skew', layout: 'ask',
      eyebrow: '08 · Your turn · state and position written separately',
      heading: 'Two writes, and a crash between them',
      stand: 'Suppose the checkpoint is written in two steps: first the window, then the position. A crash between them leaves the saved position one AHEAD of the saved window.',
      question: {
        step: 0,
        prompt: 'With the position one ahead of the window it belongs to, what happens on restart?',
        options: [
          { text: 'One input is read twice, so there are 8 answers.', correct: false,
            why: 'That is the other direction, a position one behind. The program’s author first expected it here too; measured, it is the opposite.' },
          { text: 'One input is skipped, so there are 6 answers.', correct: true,
            why: 'The restart begins one input too late: the 6 is never added. Six answers come out instead of seven.' },
          { text: 'Nothing: the window is saved, so all is well.', correct: false,
            why: 'The window is right, but it belongs to an earlier position. The two must match, or the restart is silently wrong.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Skew', html: '<p>A saved position out of step with the saved state is called <b>skew</b>. Ahead: an input is <b>lost</b>. Behind: an input is <b>counted twice</b>. Both look plausible.[[src:vars]]</p>' },
        { step: 2, title: 'One fact, not two', html: '<p>The window and the position must be written as <b>one</b> record. And counting answers catches both directions: 6 or 8 instead of 7.[[src:vars]]</p>' }
      ],
      narration: [
        'Suppose the checkpoint is written in two steps, the window and then the position, and the crash falls in between. The saved position is one ahead of the window. What happens on restart? Choose an answer.',
        'One input is skipped, so there are 6 answers. A saved position out of step with the saved state is called skew. Ahead, an input is lost. Behind, an input is counted twice.',
        'So the window and the position must be written as one record. And the two directions are caught by the cheapest alarm there is: counting the answers, 6 or 8 instead of 7.'
      ]
    },

    /* ---------- 9 · skew, animated ---------- */
    {
      title: 'Count', layout: 'array',
      eyebrow: '09 · Watch the answers with the position skewed',
      heading: 'Plausible numbers, and the wrong number of them',
      stand: 'Crash before input 4, window saved. One column per answer emitted.',
      array: {
        labelWidth: 180, slotLabel: 'answer',
        rows: [
          { label: 'the truth', values: pad(TRUTH, 8) },
          { label: 'position one ahead', values: pad(AHEAD, 8) },
          { label: 'position one behind', values: BEHIND }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 3, do: 'pick', slots: [6, 7] }
        ]
      },
      cards: [
        { step: 3, title: 'The final value looks right', html: '<p>All three end at <b>7.0</b>. Checking only the last answer would pass both broken restarts. The count — 6, 7, 8 — is what gives them away.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the seven true answers, after a crash before input 4 with the window saved correctly.',
        'With the position one ahead: the 6 is never added, so only six answers come out, and some are values nobody should ever have seen, like 3.3333.',
        'With the position one behind: one input is folded in twice, and eight answers come out.',
        'Yet all three end at 7. Checking only the last answer would pass both broken restarts. Counting the answers, 6, 7 or 8, is what gives them away.'
      ]
    },

    /* ---------- 10 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '10 · Writing the program · worked examples',
      heading: 'Twenty-one examples, counted and checked',
      stand: 'Each row runs the worker with a crash and a policy, and checks both how many answers came out and the last one.',
      question: { step: 0, prompt: 'Why does every row check HOW MANY answers came out, and not only their values?', options: [
        { text: 'Because a skewed restart gives plausible values but the wrong number of them.', correct: true, why: 'The values look fine; the count is 6 or 8 instead of 7. Counting is the cheap alarm.' },
        { text: 'Because the values are too hard to compare exactly.', correct: false, why: 'The values are compared too, exactly for whole-number inputs. The count is checked as well, not instead.' },
        { text: 'To measure how fast each policy runs.', correct: false, why: 'Speed is not checked here. The count says whether inputs were lost or repeated.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EXACT, SAVES, LIFE1, RESTART), add: [EX, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Even the lucky cases', html: '<p>The table includes a crash during the warm-up, a stream shorter than its window (no answer, None), and a 4,000-value stream where the saved total happened to be <b>0</b>, so the broken checkpoint comes out right by luck.[[src:whole]]</p>' } ],
      narration: [
        'Next, a table of worked examples. Each row runs the worker with a crash and a policy. Why does every row check how many answers came out, not only their values? Choose an answer.',
        'Because a skewed restart gives plausible values but the wrong number of them. Here is the table and the function that prints and asserts it: the count and the last answer, then the reference or the exact error rule.',
        'It even includes a lucky case: on a 4,000-value stream, one crash point saved a total of exactly 0, so the broken checkpoint comes out right by luck.'
      ]
    },

    /* ---------- 11 · main, part 1 ---------- */
    {
      title: 'Every', layout: 'code',
      eyebrow: '11 · Writing the program · every crash point, every policy',
      heading: 'Crash at each of positions 1 to 8',
      stand: 'Main crashes the worker at every position, under each of the three policies, and checks the answers.',
      question: { step: 0, prompt: 'Which policies come out exactly right at every crash point?', options: [
        { text: 'All three, on these nine values.', correct: false, why: 'Total-only is wrong at every one, ending anywhere from 7.3333 to 12.0.' },
        { text: 'Only saving the window.', correct: false, why: 'Replay is exact too. It rebuilds the window by re-reading the source.' },
        { text: 'Saving the window, and replay.', correct: true, why: 'Both restore the window, one from the checkpoint and one from the source, so every subtraction works.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EX, EXACT, SAVES, LIFE1, RESTART, SHOW), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'A law, not a guess', html: '<p>For total-only, the error is asserted to be <b>exactly</b> the saved total ÷ 3 whenever the window has refilled. Crash before 4: 12 ÷ 3 = 4.0000.[[src:vars]]</p>' } ],
      narration: [
        'Main crashes the worker at every position from 1 to 8, under each of the three policies. Which come out exactly right at every crash point? Choose an answer.',
        'Saving the window, and replay. Both restore the window, one from the checkpoint, one from the source. Here is the first part of main: every crash point, every policy, checked against the reference.',
        'For total-only it asserts a law, not a guess: once the window has refilled, the last answer is high by exactly the saved total divided by 3.'
      ]
    },

    /* ---------- 12 · main, part 2 ---------- */
    {
      title: 'Cost', layout: 'code',
      eyebrow: '12 · Writing the program · what the safe checkpoint costs',
      heading: 'The price of being right',
      stand: 'The next block prints both checkpoint sizes, for the real window sizes, then runs both skews.',
      question: { step: 0, prompt: 'With 100,000 values per window, how many numbers does the safe checkpoint save to report one answer?', options: [
        { text: '2: the total and the position.', correct: false, why: 'That is the broken checkpoint. It cannot subtract the next departing value.' },
        { text: '100,001: the window and the position.', correct: true, why: 'W values plus the position. Those extra numbers are the entire price of a correct restart.' },
        { text: '100,000: just the window.', correct: false, why: 'Without the position, the restart cannot know where to carry on, or whether the warm-up is over.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EX, EXACT, SAVES, LIFE1, RESTART, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Asserted both ways', html: '<p>Sizes: total-only 2, window 4 at W = 3, growing with W. Skew: ahead gives 6 answers, behind gives 8, and skew 0 is exact — so the failure is the skew, not the crash.[[src:vars]]</p>' } ],
      narration: [
        'The next block prints the checkpoint sizes. With 100,000 values per window, how many numbers does the safe checkpoint save to report one answer? Choose an answer.',
        'One hundred thousand and one: the window and the position. Here is the block. It prints 4 numbers against 2 at a window of 3, and the ratio at the real window sizes.',
        'Then it runs both skews and asserts 6 answers for ahead and 8 for behind, and that skew zero is exact. So the failure is caused by the skew, not by the crash.'
      ]
    },

    /* ---------- 13 · main, part 3 ---------- */
    {
      title: 'Float', layout: 'code', defines: ['float'],
      eyebrow: '13 · Writing the program · the warm-up, floats, and many streams',
      heading: 'A restart that is MORE accurate than never crashing',
      stand: 'Replace the first input with 1e16. A running total then drifts away from the true sums. Compare a worker that never crashed with one restarted from its saved window.',
      question: { step: 0, prompt: 'Which one drifts LESS from the true answers?', options: [
        { text: 'The one that never crashed.', correct: false, why: 'It carries every leftover error from the huge value forever: 6 of 7 answers drift.' },
        { text: 'The one restarted from its saved window.', correct: true, why: 'The restart sums the saved window from scratch, throwing away the error built up before it: 1 of 7 drift.' },
        { text: 'They drift exactly the same.', correct: false, why: 'Measured: 6 of 7 against 1 of 7. The restart is an accidental re-grounding.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EX, EXACT, SAVES, LIFE1, RESTART, SHOW, MAIN1, MAIN2), add: [MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'The checkpoint re-grounds the total', html: '<p>A number with a fraction, kept in about 16 digits, is a <b>float</b>. Never restarted: 6 of 7 drift. Restarted from the window: 1 of 7. Scaling every value: 0 either way. Then 300 random streams, every crash point.[[src:vars]]</p>' } ],
      narration: [
        'The last block checks the warm-up, floats, and many random streams. Replace the first input with 1e16, and compare a worker that never crashed with one restarted from its saved window. Which drifts less? Choose an answer.',
        'The restarted one. A number with a fraction, kept in about 16 digits, is a float, and one huge value makes a running total drift. The restart sums the saved window from scratch, throwing that error away.',
        'Never restarted, 6 of 7 answers drift. Restarted from the window, only 1 of 7. The checkpoint is also a re-grounding. Then 300 random streams are crashed at every point and checked.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      question: { step: 0, prompt: 'In one sentence, what does this program teach about saving state?', options: [
        { text: 'Save the smallest thing that describes the answer.', correct: false, why: 'The smallest thing, the total, is exactly what fails. The answer is not enough to carry on from.' },
        { text: 'Save what the next update needs, with its position, as one record.', correct: true, why: 'The next subtraction needs the window, and the position must match it. That is larger than the thing reported.' },
        { text: 'Save nothing; always replay from the start.', correct: false, why: 'Replaying an endless stream from the start is impossible. Replay works only for the last window.' } ] },
      code: P.whole(),
      narration: [
        'Here is the whole program, exactly as the chapter runs it. In one sentence, what does it teach about saving state? Choose an answer.',
        'Save what the next update needs, together with its position, as one record. Here that is the window and the position: more than the single number being reported.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'On 300 random streams, when is the total-only checkpoint’s final answer right?', options: [
        { text: 'Never, on any stream at all.', correct: false, why: 'It can be right: when the saved total happens to be zero, there is nothing left over.' },
        { text: 'Only when the saved total happens to be zero.', correct: true, why: 'The error is exactly the saved total over W. Zero error needs a zero total, which negative values can arrange.' },
        { text: 'Whenever the window is small.', correct: false, why: 'Window size does not matter. Only the saved total decides the error.' } ] },
      code: OUT.whole('what python3 programs/ch01_v4.py prints'),
      narration: [
        'Here is what the program prints. On 300 random streams, when is the total-only checkpoint’s final answer right? Choose an answer.',
        'Only when the saved total happens to be zero, which negative values occasionally arrange. Above that: every crash point, the checkpoint sizes, both skews, the float case, and all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Save the window and the position, as one fact',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>save_window</code>', 'the window plus the position: W + 1 numbers', 'exact at every crash'] },
          { step: 0, cells: ['<code>save_total</code>', 'two numbers; the restored total is never subtracted', '11.0 instead of 7.0'] },
          { step: 1, cells: ['replay', 'save the total, re-read the last 3 inputs on restart', 'exact; the window by another name'] },
          { step: 1, cells: ['skew', 'position ahead loses an input; behind repeats one', '6 or 8 answers, not 7'] },
          { step: 2, cells: ['the float case', 'rebuilding from the window throws old error away', '1 of 7 drift, not 6'] }
        ]
      },
      side: { step: 3, title: 'Next · part 8', html: '<p>Back to the chapter’s clicks: design a live clicks-per-minute dashboard, one component at a time, when the network delays clicks by minutes.</p>' },
      narration: [
        'To recap. Save window keeps the window and the position: the window size plus one numbers, and exact at every crash. Save total keeps two numbers, and its restored total is never subtracted: 11 instead of 7.',
        'Replay re-reads the last 3 inputs on restart, which is saving the window by another name. And skew, a position out of step with the state, loses or repeats an input: 6 or 8 answers instead of 7.',
        'A restart rebuilt from the window even throws away float error built up before it: 1 of 7 answers drift instead of 6.',
        'Next, part 8 returns to the chapter’s clicks, and designs a live clicks-per-minute dashboard, one component at a time.'
      ]
    }
  ]
};
