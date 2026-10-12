// Chapter 1, Part 4 — the Google interview question, built as a program WITH the viewer:
// the average of the last W values, on every arrival. Every code slide asks what the next
// piece must do, then reveals the real lines of programs/ch01.py (read at build time by
// _prog.js, addressed by content, never by line number). The running total is animated
// arrival by arrival; the last slides show the whole file and what it actually prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch01';
const P = program('ch01.py');
const OUT = program('ch01.out');
const one = needle => { const i = P.at(needle); return [i, i]; };
const from = (needle, extra) => { const i = P.at(needle); return [i, i + extra]; };

// the pieces, in the order a person would write them
const DOC = [0, P.at('import random')];
const DATA = [P.at('import random') + 1, P.at('VALUES = [5')];
const WIN = [P.at('VALUES = [5') + 1, P.at('# W = 3: small enough') + 2];
const HUGE = [P.at('# HUGE = 1e16: chosen'), P.at('replaced.  Both cases are asserted') + 1];
const CONSTS = P.span('N = len(VALUES)', 'WARMUP = W - 1');
const REF = [P.at('# The reference implementation'), P.fn('all_windows')[1]];
const ADD = P.span('def running(xs, w=W):', 'adds += 1');
const SUB = P.span('left = i - w', 'subs += 1');
const GUARD = P.span('full = i >= w - 1', 'return answers, trace, adds, subs');
const DRIFT = P.fn('drift_at');
const VARS = [P.at('# The three variations.'), P.fn('the_average_that_must_survive_a_restart')[1]];
const MAIN1 = P.span('def main():', 'assert trace[WARMUP - 1]["avg"] is None');
const MAIN2 = P.span('# ---- the drift, measured.', 'assert all(d == 0 for d in uni_drift)');
const MAIN3 = P.span('# ---- the three variations', 'the error must be exactly the restored total');
const MAIN4 = [P.at('# ---- brute force over many inputs'), P.lines.length - 1];
const upTo = (...ps) => ps;

// the trace the array slide animates, recomputed here and checked against what the program prints
const VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8];
const W = 3;
const SUMS = VALUES.map((_, i) => VALUES.slice(Math.max(0, i - W + 1), i + 1).reduce((a, b) => a + b, 0));
const LEFT = VALUES.map((_, i) => (i >= W ? VALUES[i - W] : '—'));
const REPORT = SUMS.map((s, i) => (i >= W - 1 ? (s / W).toFixed(2) : 'wait'));
const printed = OUT.lines.join('\n');
for (const s of ['VALUES = 0:5  1:3  2:7  3:2  4:6  5:1  6:9  7:4  8:8', 'W = 3 -> 7 windows, 2 answers withheld',
  'arrival 1: +3   -  sum= 8  report=NOT_YET', 'arrival 3: +2  -5  sum=12  report=4.0000', 'arrival 8: +8  -1  sum=21  report=7.0000',
  '(21 reads)', '(9 adds + 6 subs = 15 ops)', '6 of 7 drift, worst 0.666666666666667 (= 2/3)',
  'EVERY value multiplied by 1e+16: 0 of 7 answers drift', 'at window 1 recomputation gives 4.0 and the running total 4.666666666666667',
  'restart, total only          : [5.0, 4.0, 5.0, 5.3333, 8.3333, 9.6667, 12.0]', '600 random (values, W) pairs', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch01.out no longer prints "${s}" — rewrite the narration`);
if (SUMS.join() !== '5,8,15,12,15,9,16,14,21' || REPORT.slice(2).join() !== '5.00,4.00,5.00,3.00,5.33,4.67,7.00'
  || P.lines[P.at('VALUES = [5')] !== 'VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8]')
  throw new Error('programs/ch01.py no longer holds the values this deck animates — rewrite the narration');

module.exports = {
  title: 'Average of the Last Three',
  eyebrow: 'Streaming · Ch 1 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '1e16': '1 followed by 16 zeros' } },
  jargon: ['value', 'window', 'average', 'arrival', 'list', 'function', 'running total', 'warm-up', 'float', 'drift', 'assertion'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    q:     section(CH, 'Google Interview Question', 'Chapter 1 · the interview question'),
    prob:  section(CH, 'The problem', 'Chapter 1 · the problem'),
    model: section(CH, 'How to model it', 'Chapter 1 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 1 · three other ways'),
    whole: section(CH, 'The whole program', 'Chapter 1 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 1 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['value', 'arrival', 'window', 'average'],
      eyebrow: '01 · A Google interview question',
      heading: 'Numbers arrive forever. After each one, report the average of the last three.',
      hero: { step: 0, text: 'A screen receives numbers — <b>values</b> — one at a time, and they never stop. Each one coming in is an <b>arrival</b>. After every arrival it must show the <b>average</b> (the total divided by how many) of the last 3 values: the <b>window</b>. It may not re-read the window each time.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'values in our example: 5, 3, 7, 2, 6, 1, 9, 4, 8[[src:prob]]' },
        { step: 1, value: 3, label: 'values in each window[[src:prob]]' },
        { step: 2, value: 7, label: 'answers those 9 values give[[src:prob]]' },
        { step: 2, value: 100000, label: 'values per window in the real question[[src:prob]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A fast update', text: 'Not re-reading 3, or 100,000, values on every arrival.' },
        { step: 3, n: 2, title: 'What to show at the start', text: 'Before 3 values have arrived.' },
        { step: 4, n: 3, title: 'Is it exactly right?', text: 'Compared with adding the window up from scratch.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'A screen receives numbers, called values, one at a time, and they never stop. Each one coming in is an arrival. After every arrival it must show the average of the last 3 values. Those last 3 are called the window.',
        'Our example has 9 values: 5, 3, 7, 2, 6, 1, 9, 4, 8. The window holds 3 of them.',
        'Those 9 values give 7 answers. And in the real interview question a window can hold 100,000 values, so anything that re-reads the window will be slow.',
        'The interviewer wants three things. A fast update, without re-reading the window. And an answer for the start, before 3 values have arrived.',
        'And an honest answer to: is the fast way exactly right? We will write the program together, one piece at a time, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case first ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · before any code',
      heading: 'Four values have arrived: 5, 3, 7, 2',
      stand: 'The window is always the last 3 values. The first answer, after 5, 3 and 7, was (5 + 3 + 7) ÷ 3 = 5.',
      question: {
        step: 0,
        prompt: 'Now 2 has arrived. What should the screen show?',
        options: [
          { text: '4: the average of 3, 7 and 2.', correct: true,
            why: 'The window is the last 3 values. The 5 has left it, so 3 plus 7 plus 2, divided by 3, is 4.' },
          { text: 'The average of all four values so far.', correct: false,
            why: 'That averages everything so far. The window is only ever the last 3, so the 5 no longer counts.' },
          { text: '5: the first answer, until 3 more values arrive.', correct: false,
            why: 'An answer is due after every arrival, and each one moves the window along by one.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'One in, one out', html: '<p>When 2 arrived, exactly one value, the 5, left the window. That is true of every arrival once the window is full.[[src:model]]</p>' },
        { step: 2, title: 'The seven answers', html: '<p>5.00, 4.00, 5.00, 3.00, 5.33, 4.67, 7.00. The program must reach exactly these.[[src:prob]]</p>' }
      ],
      narration: [
        'Try a small case first. After 5, 3 and 7 the screen showed 5. Now 2 arrives. What should the screen show? Choose an answer.',
        'Four: the average of 3, 7 and 2. The 5 has left the window. Notice that exactly one value left when one arrived. That is true of every arrival once the window is full.',
        'Done for all nine values, the seven answers are 5, 4, 5, 3, 5.33, 4.67 and 7. The program must reach exactly these. Now let us write it.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Start with the nine values and the window size',
      stand: 'A program is written top to bottom. The first thing it needs is the example.',
      question: { step: 0, prompt: 'Why are the nine example values all different from one another?', options: [
        { text: 'So a wrong window cannot give the right average by accident.', correct: true, why: 'If two values were equal, a bug that averaged the wrong three could still print the right number.' },
        { text: 'Because the problem forbids equal values.', correct: false, why: 'Nothing forbids them. Distinct values are chosen so that mistakes show.' },
        { text: 'So the average always comes out a whole number.', correct: false, why: 'It does not: 5.33 and 4.67 are among the answers.' } ] },
      code: P.build({ add: [DOC, DATA, WIN], step: 1, label: 'programs/ch01.py · the data' }),
      cards: [ { step: 2, title: 'A list and a size', html: '<p><code>VALUES</code> is a <b>list</b>: values in order, each at a numbered place from 0. <code>W = 3</code> is the window size: big enough that a value leaves, small enough to trace by hand.[[src:whole]]</p>' } ],
      narration: [
        'First, the data. The nine example values are all different from one another. Why? Choose an answer.',
        'So that a wrong window cannot give the right average by accident. Here are the first lines: the problem in plain words, then the values, then the window size, 3.',
        'Values is a list: values in order, each at a numbered place starting from 0. And the window size is 3: big enough that a value leaves the window, small enough to trace by hand.'
      ]
    },

    /* ---------- 4 · the obvious answer ---------- */
    {
      title: 'Slow', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · the answer everyone gives first',
      heading: 'Add up the window from scratch, every time',
      stand: 'The first answer is the one the question forbids. It is still worth writing: it is the reference every other answer is checked against.',
      question: { step: 0, prompt: 'Adding up one window from scratch: how many values must be read?', options: [
        { text: 'As many as the window holds: 3 here.', correct: true, why: 'Every value in the window is part of its total, so all of them are read.' },
        { text: 'Just 1: the newest value.', correct: false, why: 'One value says nothing about the other two in the window.' },
        { text: 'All the values that have ever arrived.', correct: false, why: 'Only the window counts. Values that left it are not part of the average.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN), add: [CONSTS, REF], step: 1 }),
      cards: [ { step: 2, title: 'Correct, and priced by the window', html: '<p>A <b>function</b> is a named recipe: inputs in, an answer out. <code>recompute_at</code> reads 3 values per window: 7 windows × 3 = <b>21 reads</b>. With 100,000 in a window, that is 100,000 reads per arrival.[[src:trace]]</p>' } ],
      narration: [
        'First, the answer everyone gives. To add up one window from scratch, how many values must be read? Choose an answer.',
        'As many as the window holds, 3 here. Here it is. N is how many values there are, and the window count is 7. Recompute at adds the window up; all windows does it for every window.',
        'Each of these is a function: a named recipe that takes inputs and gives back an answer. It is correct, but it costs 3 reads per window, 21 in all. With 100,000 in a window, that is 100,000 reads per arrival.'
      ]
    },

    /* ---------- 5 · the reframe: keep a total ---------- */
    {
      title: 'Total', layout: 'code', defines: ['running total'],
      eyebrow: '05 · Writing the program · the one idea',
      heading: 'Keep one number, not the whole window',
      stand: 'The answer is the window’s total divided by 3. So what if the program kept that total, and only updated it?',
      question: { step: 0, prompt: 'When a value arrives, what is the first thing to do to the kept total?', options: [
        { text: 'Add the arriving value to it.', correct: true, why: 'The new value has joined the window, so it joins the total. One addition.' },
        { text: 'Add up the whole window again.', correct: false, why: 'That is the slow answer again: 3 reads, or 100,000.' },
        { text: 'Set it to the arriving value.', correct: false, why: 'Then the other values in the window would be forgotten.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, CONSTS, REF), add: [ADD], step: 1 }),
      cards: [ { step: 2, title: 'A running total', html: '<p>A total updated as values come in, instead of added up again, is a <b>running total</b>. The loop visits each arrival once, and adds it: <code>total += xs[i]</code>.[[src:model]]</p>' } ],
      narration: [
        'Now the idea that solves it. The answer is the window’s total divided by 3. What if the program kept that total, and only updated it? When a value arrives, what is the first thing to do? Choose an answer.',
        'Add the arriving value to the total. Here is the start of the function called running. It visits each arrival once, in order, and adds the new value to the total, counting each addition.',
        'A total that is updated as values come in, instead of being added up again, is called a running total. But adding is only half of the update.'
      ]
    },

    /* ---------- 6 · the value that leaves ---------- */
    {
      title: 'Leave', layout: 'code',
      eyebrow: '06 · Writing the program · the value that leaves',
      heading: 'One arrives, one leaves',
      stand: 'Arrival number 3 is the value 2. After adding it, the total holds 5 + 3 + 7 + 2 = 17: four values, one too many.',
      question: { step: 0, prompt: 'What must the program do next, and what does it need to do it?', options: [
        { text: 'Subtract the 5 that left, so it must still have the 5.', correct: true, why: 'The departing value is subtracted out, which means the last 3 values must still be kept somewhere.' },
        { text: 'Subtract the 2 it just added, which it already has.', correct: false, why: 'The 2 is in the window now. It is the oldest value, the 5, that has left.' },
        { text: 'Divide the 17 by 4, since 4 values are in it.', correct: false, why: 'The answer is the average of the window, 3 values. The 5 must come out first.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, CONSTS, REF, ADD), add: [SUB], step: 1 }),
      cards: [ { step: 2, title: 'Two operations, but not one number', html: '<p>Arrival 3: +2 −5, total <b>12</b>. Each arrival costs two operations however big the window is. But <code>xs[left]</code> reads the departing value, so the last 3 values must be <b>kept</b>: the memory is the window plus the total.[[src:model]]</p>' } ],
      narration: [
        'Arrival number 3 is the value 2. After adding it, the total holds 17: four values, one too many. What must the program do next, and what does it need? Choose an answer.',
        'Subtract the 5 that left. Here are the lines: left is the place of the value that just left the window, and if there is one, it is subtracted from the total. Now the total is 12.',
        'So each arrival costs two operations, an add and a subtract, however big the window is. But the subtraction reads the departing value, so the last 3 values must still be kept. The memory is the window plus one total.'
      ]
    },

    /* ---------- 7 · the warm-up ---------- */
    {
      title: 'Warm', layout: 'code', defines: ['warm-up'],
      eyebrow: '07 · Writing the program · before the window is full',
      heading: 'What to show after only two values?',
      stand: 'After 5 and 3 the total is 8. An average of 3 values is wanted, but only 2 exist.',
      question: { step: 0, prompt: 'What should the program report after the first 2 arrivals?', options: [
        { text: '2.67: the total, 8, divided by 3.', correct: false, why: 'That is the usual bug. It divides by 3 when only 2 values exist, and reports a figure that is quietly too low.' },
        { text: '4: the average of the 2 values so far.', correct: false, why: 'That is not the average of the last 3. It answers a different question and looks just like a real answer.' },
        { text: 'Nothing yet: hold the answer back.', correct: true, why: 'There is no average of 3 values before 3 exist, so the first 2 answers are withheld.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, CONSTS, REF, ADD, SUB), add: [GUARD], step: 1 }),
      cards: [ { step: 2, title: 'The warm-up', html: '<p>The stretch before the window first fills is the <b>warm-up</b>: W − 1 = <b>2</b> answers withheld. <code>full</code> is false there, and the report says <code>NOT_YET</code> instead of a wrong number.[[src:model]]</p>' } ],
      narration: [
        'After 5 and 3 the total is 8. An average of 3 values is wanted, but only 2 exist. What should the program report? Choose an answer.',
        'Nothing yet. Here are the last lines of running: full is true only once 3 values have arrived, and only then is an answer added to the list of answers. Every step is also recorded in a trace.',
        'The stretch before the window first fills is called the warm-up. Here it is 2 answers, one less than the window size. Dividing 8 by 3 would report 2.67, quietly too low. That is the classic bug.'
      ]
    },

    /* ---------- 8 · watch it run ---------- */
    {
      title: 'Run', layout: 'array',
      eyebrow: '08 · Watch the running total, arrival by arrival',
      heading: 'Add the arrival, subtract the leaver, report',
      stand: 'One column per arrival. The total is never added up from scratch.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'arrives', values: VALUES },
          { label: 'leaves', values: LEFT },
          { label: 'running total', values: SUMS },
          { label: 'report', values: REPORT }
        ],
        meters: ['arrivals', 'answers withheld'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1, 2] },
          { step: 2, do: 'show', rows: [3] },
          { step: 2, do: 'sweep', row: 3, mode: 'match', match: 'wait', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 3, do: 'pick', slots: [3] }
        ]
      },
      cards: [
        { step: 3, title: 'Arrival 3', html: '<p>+2, −5: total 15 becomes <b>12</b>, report <b>4.00</b>. Two operations.[[src:whole]]</p>' },
        { step: 4, title: '15 operations against 21 reads', html: '<p>9 additions and 6 subtractions, the same seven answers as adding up every window. At 100,000 per window it is still two per arrival.[[src:trace]]</p>' }
      ],
      narration: [
        'Here are the nine values as they arrive, one column each, in order: 5, 3, 7, 2, 6, 1, 9, 4 and 8.',
        'Under each, the value that leaves the window, and the running total. The first three arrivals only add. From arrival 3 on, each one adds and subtracts.',
        'And the report. Watch the pointer: the first 2 arrivals report nothing, the warm-up. Then 5, 4, 5, 3, 5.33, 4.67 and 7.',
        'Look at arrival 3: add 2, subtract 5, and the total goes from 15 to 12, so the report is 4. Two operations, whatever the window size.',
        'In all, 9 additions and 6 subtractions, 15 operations, against 21 reads for adding every window up. The same seven answers, and at 100,000 per window, still two operations per arrival.'
      ]
    },

    /* ---------- 9 · is it exactly right? ---------- */
    {
      title: 'Drift', layout: 'code', defines: ['float', 'drift'],
      eyebrow: '09 · Writing the program · is the running total exactly right?',
      heading: 'Add, then subtract: back where you started?',
      stand: 'Computers store numbers with fractions in a fixed number of digits. Replace the first value, 5, with 10000000000000000.',
      question: { step: 0, prompt: 'Will the running total still match adding each window up from scratch?', options: [
        { text: 'Yes: adding then subtracting a value always cancels.', correct: false, why: 'In exact arithmetic it does. Stored in a fixed number of digits, the huge value swamps the small ones, and they are lost.' },
        { text: 'No: the answers drift, and nothing ever corrects them.', correct: true, why: 'The total cannot hold the huge value and the small ones to the same precision. The leftover error stays in it.' },
        { text: 'Only the answers whose window holds the huge value are off.', correct: false, why: 'The error stays in the total after the huge value leaves, so later windows are off too.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, CONSTS, REF, ADD, SUB, GUARD), add: [HUGE, DRIFT], step: 1 }),
      cards: [ { step: 2, title: 'Drift', html: '<p>A number with a fraction, stored in about 16 digits, is a <b>float</b>. With one value of 1e16, <b>6 of 7</b> answers stop matching, the worst by 0.666666666666667. That wandering is <b>drift</b>. Scaling <b>every</b> value by 1e16 drifts on none: it is the mixture, not the size.[[src:model]]</p>' } ],
      narration: [
        'Computers store numbers with fractions in a fixed number of digits. Replace the first value with 1e16. Will the running total still match adding up each window from scratch? Choose an answer.',
        'No. Here is the constant, with the reason in its comment, and drift at: the running answer minus the from-scratch answer for one window. It is zero only when the arithmetic is exact.',
        'A number with a fraction, kept in about 16 digits, is called a float. With one huge value, 6 of 7 answers drift, the worst by two thirds. But multiplying every value by 1e16 drifts on none. It is the mixture of sizes, not the size.'
      ]
    },

    /* ---------- 10 · the checks for the main answer ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assertion'],
      eyebrow: '10 · Writing the program · proving the answers',
      heading: 'Run both answers, print them, and assert',
      stand: 'A program you cannot check is a guess. The main function runs both answers on the example.',
      question: { step: 0, prompt: 'What must the checks prove about the running total on the small values?', options: [
        { text: 'That it runs without crashing.', correct: false, why: 'A program can run cleanly and print wrong numbers. Running proves nothing about the answers.' },
        { text: 'That it gives every answer, faster than recomputing would.', correct: false, why: 'Speed alone is not enough: it must give the same answers as the reference, and cost less.' },
        { text: 'That it equals recomputing on every window, and costs less.', correct: true, why: 'Same seven answers, 15 operations against 21 reads, and exactly 2 withheld. Each is asserted.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, HUGE, CONSTS, REF, ADD, SUB, GUARD, DRIFT), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Assertions', html: '<p>An <b>assertion</b> is a line that stops the program if a claim is false. Here: the answers equal the reference, 15 &lt; 21, 9 adds and 6 subtractions, exactly 2 withheld.[[src:whole]]</p>' } ],
      narration: [
        'The main function runs both answers on the example and prints a trace. What must the checks prove about the running total on these small values? Choose an answer.',
        'That it equals recomputing on every window, and costs less. Here it is: it prints each arrival, then both lists of answers with their cost, then checks them.',
        'Each check is an assertion: a line that stops the program if a claim is false. The answers equal the reference, 15 operations are fewer than 21 reads, and exactly 2 answers are withheld.'
      ]
    },

    /* ---------- 11 · measuring the drift ---------- */
    {
      title: 'Prove', layout: 'code',
      eyebrow: '11 · Writing the program · the drift, measured',
      heading: 'Assert the drift, and assert where it does not happen',
      stand: 'The second block measures two cases: one value replaced by 1e16, and every value multiplied by 1e16.',
      question: { step: 0, prompt: 'Why also assert that multiplying EVERY value by 1e16 drifts on none?', options: [
        { text: 'To prove the cause is the mix of sizes, not size itself.', correct: true, why: 'If uniform scaling drifted too, the explanation would be wrong, and the assertion would say so.' },
        { text: 'Because big numbers are always handled exactly.', correct: false, why: 'They are not: one big value among small ones is exactly what drifts.' },
        { text: 'To make the program run longer as a stress test.', correct: false, why: 'An assertion checks a claim; it adds no meaningful work.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, HUGE, CONSTS, REF, ADD, SUB, GUARD, DRIFT, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Both directions pinned', html: '<p>Mixture: <b>6 of 7</b> drift, starting at window 1, worst 2/3. Uniform: <b>0 of 7</b>. Window 0 cannot drift: it comes before the first subtraction. The fixes: count in whole units, like pence, or recompute now and then.[[src:model]]</p>' } ],
      narration: [
        'The next block measures the drift in two cases: one value replaced by 1e16, and every value multiplied by it. Why also assert that multiplying every value drifts on none? Choose an answer.',
        'To prove that the cause is the mix of sizes. Here it is: it builds both streams, counts the answers that differ from the reference, and asserts 6 of 7 for the mixture and none for the scaled one.',
        'Window 0 cannot drift, because it comes before the first subtraction. And the fixes are named in the chapter: count in whole units, like pence instead of pounds, or recompute the total now and then.'
      ]
    },

    /* ---------- 12 · the variations ---------- */
    {
      title: 'Vary', layout: 'code',
      eyebrow: '12 · Writing the program · the same window, three other questions',
      heading: 'Maximum, last 60 seconds, survive a restart',
      stand: 'The interviewer changes the question three ways: the largest of the last 3; the average of the last 60 seconds; and keep going after the program is restarted.',
      question: { step: 0, prompt: 'Which of the three can NOT keep a running total at all?', options: [
        { text: 'The largest of the last 3 values.', correct: true, why: 'There is no “un-maximum”: when the largest value leaves, one kept number cannot say what the next largest is.' },
        { text: 'The average of the last 60 seconds.', correct: false, why: 'A total still works there. What changes is that the count of values must be kept beside it.' },
        { text: 'The average that survives a restart.', correct: false, why: 'The same total works. The catch is what must be saved to restart it: the window, not just the total.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, HUGE, CONSTS, REF, ADD, SUB, GUARD, DRIFT, MAIN1, MAIN2), add: [VARS, MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'Each gets its own part', html: '<p>Maximum: a different structure, <code>[7, 7, 7, 6, 9, 9, 9]</code>. Time window: the count rises and falls, <code>1, 2, 1, 2, 1</code>. Restart: saving only the total ends at <b>12.0</b> instead of 7.0. Parts 5, 6 and 7 build each one.[[src:vars]]</p>' } ],
      narration: [
        'The interviewer changes the question three ways: the largest of the last 3, the average of the last 60 seconds, and an average that must keep going after a restart. Which one can not keep a running total at all? Choose an answer.',
        'The largest of the last 3. Here are all three, and the block that checks them. There is no way to take a value back out of a maximum, so it needs a different structure.',
        'The maximum gives 7, 7, 7, 6, 9, 9, 9. The time window’s count rises and falls. And a restart that saved only the total ends at 12 instead of 7. Parts 5, 6 and 7 build each one properly.'
      ]
    },

    /* ---------- 13 · beyond one example ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '13 · Writing the program · more than one example',
      heading: 'Six hundred random streams',
      stand: 'Every check so far used the same nine values. The last block checks many more.',
      question: { step: 0, prompt: 'Why run 600 random streams, with random window sizes, through both answers?', options: [
        { text: 'To show the fast answer is faster on big inputs.', correct: false, why: 'The block compares answers, not times. Speed was already shown by counting operations.' },
        { text: 'To catch a mistake the nine example values happen to hide.', correct: true, why: 'One example can pass by luck. Hundreds of random ones, with negatives and many sizes, rarely do.' },
        { text: 'Because random values are the hardest for a float.', correct: false, why: 'These are small whole numbers, which floats hold exactly. The drift case was tested above.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WIN, HUGE, CONSTS, REF, ADD, SUB, GUARD, DRIFT, MAIN1, MAIN2, VARS, MAIN3), add: [MAIN4], step: 1 }),
      cards: [ { step: 2, title: 'Then the last line', html: '<p>600 random streams, window sizes 1 to 6, values from −50 to 50: the running total equals the reference every time. Only then does it print “all assertions passed”.[[src:whole]]</p>' } ],
      narration: [
        'Every check so far used the same nine values. Why run 600 random streams, with random window sizes, through both answers? Choose an answer.',
        'To catch a mistake the nine example values happen to hide. Here is the last block: random window sizes from 1 to 6, random values including negatives, and the running total compared with the reference each time.',
        'The maximum is checked against the plain largest of each window too. Only when all of it agrees does the program print its last line: all assertions passed.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      question: { step: 0, prompt: 'Reading top to bottom, in which part does the program prove its own answers?', options: [
        { text: 'In the comments above each value.', correct: false, why: 'Comments explain, but nothing checks them. They could go out of date silently.' },
        { text: 'In the assertions inside the main function.', correct: true, why: 'Each assertion stops the program if a claim is false, so a wrong answer cannot be printed quietly.' },
        { text: 'In the running function itself.', correct: false, why: 'Running computes the answers. It is main that compares them with the reference and asserts.' } ] },
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Reading top to bottom, in which part does it prove its own answers? Choose an answer.',
        'In the assertions inside main. From the top: the data, the reference, the running total with its warm-up, the drift, the three variations, and main, which checks everything.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'The output says 6 of 7 answers drift. Which window never drifts?', options: [
        { text: 'Window 0: it comes before any subtraction.', correct: true, why: 'Drift comes from adding a value and later subtracting it. Window 0 has only been added to.' },
        { text: 'Window 6: the huge value left long before.', correct: false, why: 'The leftover error stays in the total after the huge value leaves. It is never corrected.' },
        { text: 'Window 1: the first without the huge value.', correct: false, why: 'Window 1 is exactly where the drift starts: 4.0 from scratch, but 4.666666666666667 running.' } ] },
      code: OUT.whole('what python3 programs/ch01.py prints'),
      cards: [ { step: 1, title: 'Read it as a story', html: '<p>The trace: NOT_YET twice, then 5.0 to 7.0. Then 21 reads against 15 operations. Then the drift: window 1 gives 4.0 from scratch but 4.666666666666667 running.[[src:trace]]</p>' } ],
      narration: [
        'Here is what the program prints. The output says 6 of 7 answers drift. Which window never drifts? Choose an answer.',
        'Window 0, because it comes before any subtraction. Read the output from the top: the trace with two answers withheld, then 21 reads against 15 operations, then the drift starting at window 1, and finally all assertions passed.'
      ]
    },

    /* ---------- 16 · what it costs in memory ---------- */
    {
      title: 'Memory', layout: 'ask',
      eyebrow: '16 · Your turn · the overstatement to avoid',
      heading: '“The fast answer keeps just one number”',
      stand: 'People often say the running total needs only one number of memory. Think of the subtraction.',
      question: {
        step: 0,
        prompt: 'With 100,000 values per window, how much must the program keep?',
        options: [
          { text: 'One number: the running total.', correct: false,
            why: 'The subtraction needs the departing value, so the window’s values must still be there.' },
          { text: 'The 100,000 values in the window, plus the total.', correct: true,
            why: 'Each arrival costs two operations, but the memory is the window plus one total: 100,001 numbers.' },
          { text: 'Every value that has ever arrived.', correct: false,
            why: 'Only the window is needed. Older values are never read again.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Cost and memory are different', html: '<p>Two operations per arrival, whatever the window size. But <b>W values</b> kept plus the total: 4 numbers here, 100,001 for a window of 100,000.[[src:model]]</p>' },
        { step: 2, title: 'Three things to volunteer', html: '<p>The warm-up is W − 1 answers. The memory is W values plus the total. And the running total is exact only for exact arithmetic.[[src:trace]]</p>' }
      ],
      narration: [
        'People often say the running total needs only one number of memory. With 100,000 values per window, how much must the program keep? Choose an answer.',
        'The window’s values, plus the total. Each arrival costs only two operations, but the subtraction reads the departing value. So the memory is 4 numbers here, and 100,001 for a window of 100,000.',
        'So there are three things to say in the interview. The warm-up is one less than the window size. The memory is the window plus the total. And the running total is exact only for exact arithmetic.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'One total, two operations per arrival, three honest caveats',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>recompute_at</code>', 'adds one window up from scratch: the reference', '21 reads'] },
          { step: 0, cells: ['<code>running</code>', 'adds the arrival, subtracts the value that left', '9 + 6 = 15 operations'] },
          { step: 1, cells: ['the warm-up', 'withholds answers until the window is full', '2 withheld'] },
          { step: 1, cells: ['<code>drift_at</code>', 'measures how far floats wander', '6 of 7 drift with one 1e16'] },
          { step: 2, cells: ['<code>main</code>', 'asserts every claim, both ways', 'all assertions passed'] }
        ]
      },
      side: { step: 3, title: 'Next · part 5', html: '<p>The same window, but the <b>largest</b> value instead of the average. The running total cannot do it. Part 5 builds the structure that can.[[src:vars]]</p>' },
      narration: [
        'To recap. Recompute at adds one window up from scratch: correct, 21 reads, and the reference. Running adds the arrival and subtracts the leaver: 15 operations for the same answers.',
        'The warm-up withholds the first 2 answers instead of reporting numbers that are too low. And drift at shows floats wandering: 6 of 7 answers with one huge value.',
        'Main asserts every claim, including where drift does not happen, and checks 600 random streams before printing all assertions passed.',
        'Next, part 5 asks for the largest value in the window instead of the average. A running total cannot do that, so part 5 builds the structure that can.'
      ]
    }
  ]
};
