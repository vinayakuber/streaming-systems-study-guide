// Chapter 1, Part 5 — Variation 2, the rolling maximum, built as a program WITH the viewer.
// The average's trick (keep one total) is tried and caught failing; the impossibility is shown
// by the program's own counter-example; and the monotonic deque is written piece by piece and
// animated arrival by arrival. Every listing is read from programs/ch01_v2.py by _prog.js,
// addressed by content; the narration's results are asserted against programs/ch01_v2.out.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch01';
const P = program('ch01_v2.py');
const OUT = program('ch01_v2.out');
const seg = (a, b) => [P.at(a), P.at(b) - 1];          // from one piece's first line to the line before the next

const DOC = [0, P.at("# The chapter's own stream") - 1];
const DATA = seg("# The chapter's own stream", '# Inputs for the examples table');
const EX = seg('# Inputs for the examples table', 'def brute_max(');
const REF = seg('def brute_max(', 'def running_total(');
const TOTAL = seg('def running_total(', 'def running_max_single(');
const SINGLE = seg('def running_max_single(', 'def running_max_rescan(');
const RESCAN = seg('def running_max_rescan(', 'def slide_max(');
const EVICT = P.span('def slide_max(', 'pushes += 1');
const EXPIRE = [P.at('if dq[0] <= i - w:'), P.at('def find_max_collision(') - 1];
const COLL = seg('def find_max_collision(', 'def show_examples(');
const SHOW = seg('def show_examples(', 'def main():');
const MAIN1 = seg('def main():', '# the rescan answer is correct');
const MAIN2 = [P.at('# the rescan answer is correct'), P.lines.length - 1];
const upTo = (...ps) => ps;

// the deque, simulated here so the animation is computed, then checked against the printed counts
const VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8], W = 3;
const DQ = [], ANS = [], SINGLE_ROW = [];
{ const dq = []; let best = null;
  VALUES.forEach((v, i) => {
    while (dq.length && VALUES[dq[dq.length - 1]] <= v) dq.pop();
    dq.push(i);
    if (dq[0] <= i - W) dq.shift();
    DQ.push(dq.map(j => VALUES[j]).join(' '));
    ANS.push(i >= W - 1 ? VALUES[dq[0]] : '—');
    best = best === null ? v : Math.max(best, v);
    SINGLE_ROW.push(i >= W - 1 ? best : '—');
  }); }
const AGREE = ANS.map((a, i) => (a === '—' ? '—' : a === SINGLE_ROW[i] ? 'same' : 'wrong'));
const printed = OUT.lines.join('\n');
for (const s of ['brute force  : [7, 7, 7, 6, 9, 9, 9]   (7 windows x 3 = 21 reads)', 'one number   : [7, 7, 7, 7, 9, 9, 9]   <- WRONG',
  'rescan on departure: [7, 7, 7, 6, 9, 9, 9]   (2 rescans, correct)', 'deque        : [7, 7, 7, 6, 9, 9, 9]   (9p + 6e + 1x = 16 steps)',
  'window [8, 2, 7] keeps 8, 8 departs, 3 arrives -> 7', 'window [8, 6, 6] keeps 8, 8 departs, 3 arrives -> 6',
  '18 of 18 windows on a falling one', 'at 1 entry with `<=` and at 3 with `<`', 'one-number version is wrong on 636 of 800',
  '5,000 events, W = 1, deque LOSES       5000    1  2500    -48956    9999      5000', '6 of 7 running totals drift, worst 2.0',
  'all 18 examples agree with the brute force and the rescan', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch01_v2.out no longer prints "${s}" — rewrite the narration`);
if (ANS.slice(2).join() !== '7,7,7,6,9,9,9' || SINGLE_ROW.slice(2).join() !== '7,7,7,7,9,9,9' || DQ[5] !== '6 1' || DQ[4] !== '7 6'
  || AGREE.filter(a => a === 'wrong').length !== 1)
  throw new Error('the deque simulation no longer matches the program — rewrite the narration');

module.exports = {
  title: 'Largest of the Last Three',
  eyebrow: 'Streaming · Ch 1 · Part 5',
  ...shared,
  jargon: ['tick', 'exposure', 'window', 'maximum', 'list', 'function', 'running total', 'invertible', 'rescan', 'deque', 'index'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 1 · the original problem'),
    model: section(CH, 'How to model it', 'Chapter 1 · the running total'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 1 · variation 2, the rolling maximum'),
    whole: section(CH, 'The whole program', 'Chapter 1 · the whole program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['tick', 'exposure', 'window', 'maximum'],
      eyebrow: '01 · Variation 2 · looks like risk',
      heading: 'A risk screen must always show the largest of the last three exposures',
      hero: { step: 0, text: 'A bank’s risk screen receives one number per <b>tick</b> — one arrival — and they never stop. Each number is an <b>exposure</b>: how big one position is, in lakh. After every tick it must show the <b>maximum</b>, the largest value, of the last 3 ticks: the <b>window</b>. It may not re-read the window.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'exposures: 5, 3, 7, 2, 6, 1, 9, 4, 8' },
        { step: 1, value: 3, label: 'ticks in each window' },
        { step: 2, value: 7, label: 'answers: 7, 7, 7, 6, 9, 9, 9' },
        { step: 2, value: 16, label: 'steps for the answer we build, against 21 reads' }
      ],
      cardsLabel: 'What makes it hard',
      cards: [
        { step: 3, n: 1, title: 'The average’s trick fails', text: 'A total can have a value taken out. A maximum cannot.' },
        { step: 3, n: 2, title: 'Proved, not argued', text: 'The program finds two windows that no single number can tell apart.' },
        { step: 4, n: 3, title: 'A structure instead', text: 'Keep only the values that could still become the maximum.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A bank’s risk screen receives one number per tick, and the ticks never stop. Each number is an exposure: how big one position is. After every tick it must show the maximum, the largest of the last 3 ticks. Those 3 are the window.',
        'Our example has 9 exposures, the same values as the chapter: 5, 3, 7, 2, 6, 1, 9, 4, 8. The window holds 3 of them.',
        'They give 7 answers: 7, 7, 7, 6, 9, 9, 9. The answer we build costs 16 steps, against 21 reads for re-reading every window.',
        'What makes it hard? The average’s trick, keeping one total, fails here. And the program proves it fails, rather than just arguing it.',
        'So it needs a structure instead: keep only the values that could still become the maximum. We will write it together; you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · before any code',
      heading: 'The 7 is about to leave',
      stand: 'Windows so far: 5, 3, 7 → 7. Then 3, 7, 2 → 7. Then 7, 2, 6 → 7. Now the exposure 1 arrives.',
      question: {
        step: 0,
        prompt: 'The window is now 2, 6, 1. What should the screen show?',
        options: [
          { text: '6: the largest of 2, 6 and 1.', correct: true,
            why: 'The 7 has just left the window. Of what remains, 6 is the largest.' },
          { text: '7: the largest seen so far.', correct: false,
            why: '7 was the largest, but it has left the window. Showing it now reports a value that is no longer there.' },
          { text: '1: the value that just arrived.', correct: false,
            why: 'The newest value is the answer only if it is the largest. Here 6 is larger.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The hard tick', html: '<p>When the maximum leaves, the next largest must come from somewhere. The question is how to know it without re-reading.[[src:vars]]</p>' },
        { step: 2, title: 'The seven answers', html: '<p>7, 7, 7, <b>6</b>, 9, 9, 9. The 6 is the one an easy shortcut gets wrong.[[src:vars]]</p>' }
      ],
      narration: [
        'A small case first. The windows so far all showed 7. Now the exposure 1 arrives, and the window is 2, 6, 1. What should the screen show? Choose an answer.',
        'Six. The 7 has just left the window, and of what remains, 6 is the largest. This is the hard tick: when the maximum leaves, where does the next one come from, without re-reading?',
        'All seven answers are 7, 7, 7, 6, 9, 9, 9. Remember the 6. It is the one an easy shortcut gets wrong.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'The chapter’s nine values, reused unchanged',
      stand: 'The top of the file defines every word, then the data. The values must rise and fall.',
      question: { step: 0, prompt: 'Why must the example values rise AND fall, rather than only rise?', options: [
        { text: 'In a rising list the newest value is always largest, so nothing hard happens.', correct: true, why: 'If every value is bigger than the last, the maximum never leaves the window. The hard tick never comes.' },
        { text: 'Because a rising list would give a wrong answer.', correct: false, why: 'A rising list gives right answers. It just never tests the moment the maximum leaves.' },
        { text: 'So the average and the maximum come out the same.', correct: false, why: 'They differ on purpose: 7, 7, 7, 6, 9, 9, 9 against the average’s 5, 4, 5, 3 and so on.' } ] },
      code: P.build({ add: [DOC, DATA], step: 1, label: 'programs/ch01_v2.py · the words, then the data' }),
      cards: [ { step: 2, title: 'The data', html: '<p><code>VALUES</code> is a <b>list</b>, values in order from place 0. <code>W = 3</code>. <code>HUGE = 1e16</code> comes back near the end, for the float point.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The example values rise and fall. Why must they, rather than only rise? Choose an answer.',
        'In a rising list the newest value is always the largest, so the maximum never leaves and the hard tick never comes. Here is the top of the file: it defines every word first, then sets out the nine values.',
        'Values is a list: values in order, from place 0. The window size is 3. And the huge constant, 1e16, comes back near the end of the program.'
      ]
    },

    /* ---------- 4 · the reference ---------- */
    {
      title: 'Brute', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · the reference',
      heading: 'Read the whole window, every time',
      stand: 'The answer the question forbids, written anyway: everything else is checked against it.',
      question: { step: 0, prompt: 'Reading one window of 3 to find its largest: how many values are read?', options: [
        { text: '1: just the newest.', correct: false, why: 'The newest says nothing about the other two in the window.' },
        { text: '3: every value in the window.', correct: true, why: 'Any of the three could be the largest, so all are read: 7 windows of 3 make 21 reads.' },
        { text: '9: every value in the list.', correct: false, why: 'Only the window counts. Values outside it cannot be its maximum.' } ] },
      code: P.build({ before: upTo(DOC, DATA), add: [REF], step: 1 }),
      cards: [ { step: 2, title: 'Exact by construction', html: '<p>A <b>function</b> is a named recipe: inputs in, answer out. <code>brute_max</code> reads all 3, so it is exact, because nothing is ever taken back out. <b>21 reads</b> for 7 windows.[[src:vars]]</p>' } ],
      narration: [
        'First the reference. To find the largest of one window of 3, how many values are read? Choose an answer.',
        'All three. Here is brute max: it starts with the first value in the window and keeps whichever is bigger. All maxima runs it for every window.',
        'Each is a function, a named recipe: inputs in, answer out. It is exact, because nothing is ever taken back out of a kept number. And it costs 21 reads for the 7 windows.'
      ]
    },

    /* ---------- 5 · the trick that fails ---------- */
    {
      title: 'Single', layout: 'code', defines: ['running total'],
      eyebrow: '05 · Writing the program · the appealing wrong answer',
      heading: 'Copy the average’s trick: keep one number',
      stand: 'For the average, a running total worked: add the arrival, subtract the value that left. Try the same with a maximum.',
      question: { step: 0, prompt: 'Keep one number and take the larger of it and each arrival. When the 7 leaves, what line removes it?', options: [
        { text: 'Subtract 7 from the kept number.', correct: false, why: 'Subtracting gives 0, which is not the largest of 2, 6 and 1. A maximum is not a sum.' },
        { text: 'There is no such line: a maximum cannot be undone.', correct: true, why: 'There is no “un-maximum”. Once 7 is the kept number, nothing can say what it was before.' },
        { text: 'Reset the kept number to the arriving value, 1.', correct: false, why: 'Then the screen shows 1, but 6 is still in the window.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF), add: [TOTAL, SINGLE], step: 1 }),
      cards: [ { step: 2, title: 'The missing line', html: '<p>A <b>running total</b> adds the arrival and subtracts the leaver. <code>running_max_single</code> has only a comment where the removal should go, so its number is really the largest of <b>everything so far</b>: [7, 7, 7, <b>7</b>, 9, 9, 9].[[src:vars]]</p>' } ],
      narration: [
        'For the average, a running total worked: add the arrival, subtract the leaver. Try that with a maximum. Keep one number, the larger of it and each arrival. When the 7 leaves, what line removes it? Choose an answer.',
        'There is no such line. Here are both: running total, kept as the contrast, and running max single. Where the removal should be, there is only a comment saying it cannot be written.',
        'So the kept number is really the largest of everything so far, not of the window. It gives 7, 7, 7, 7, 9, 9, 9. Watch where that goes wrong.'
      ]
    },

    /* ---------- 6 · watch the one number go wrong ---------- */
    {
      title: 'Stale', layout: 'array',
      eyebrow: '06 · Watch the one number against the truth',
      heading: 'Right, right, right — then stale',
      stand: 'One column per tick. The answer shown after that tick, by each method.',
      array: {
        labelWidth: 150, slotLabel: 'tick',
        rows: [
          { label: 'arrives', values: VALUES },
          { label: 'one number', values: SINGLE_ROW },
          { label: 'true maximum', values: ANS },
          { label: 'one number is', values: AGREE }
        ],
        meters: ['ticks compared', 'wrong answers'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'wrong', readMeter: 0, resultMeter: 1, speed: 320 },
          { step: 2, do: 'pick', slots: [5, 6] }
        ]
      },
      cards: [
        { step: 2, title: 'Wrong at tick 5', html: '<p>It shows <b>7</b> for the window 2, 6, 1, whose maximum is <b>6</b>. It can only ever be too high.[[src:vars]]</p>' },
        { step: 3, title: 'Healed by luck', html: '<p>It is right again at tick 6 only because 9 arrives and beats the stale 7, not because the 7 was removed.[[src:vars]]</p>' }
      ],
      narration: [
        'One column per tick: the arriving exposure, and the answer the one-number method shows after it.',
        'Under it, the true maximum of each window. Compare them tick by tick. Watch the pointer: one wrong answer.',
        'At tick 5 the window is 2, 6, 1, and the one number still shows 7. It left the window and nothing could put it back. The one number can only ever read too high.',
        'And at tick 6 it is right again, only because 9 arrives and beats the stale 7. The error ends when a bigger value happens along, not when the window moves on.'
      ]
    },

    /* ---------- 7 · the impossibility ---------- */
    {
      title: 'Proof', layout: 'code', defines: ['invertible'],
      eyebrow: '07 · Writing the program · proving no one-number answer exists',
      heading: 'Two windows that one number cannot tell apart',
      stand: 'Any one-number update would be a rule: new answer = f(kept number, departing value, arriving value).',
      question: { step: 0, prompt: 'How could a program prove that NO such rule f can exist?', options: [
        { text: 'Try many rules, and show each one fails.', correct: false, why: 'There are endlessly many rules. Failing some proves nothing about the ones not tried.' },
        { text: 'Find two windows with the same three inputs but different answers.', correct: true, why: 'A rule gives one answer for one set of inputs. Two different right answers rule out every rule at once.' },
        { text: 'Show that the rule would be too slow.', correct: false, why: 'The claim is that no rule gives right answers at all, whatever its speed.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF, TOTAL, SINGLE), add: [COLL], step: 1 }),
      cards: [ { step: 2, title: 'Found by the program', html: '<p>Window [8, 2, 7] and window [8, 6, 6]: both keep 8, 8 departs, 3 arrives. The next maxima are <b>7</b> and <b>6</b>. The same search over <b>sums</b> finds nothing: subtraction undoes addition. A combine that can be undone is <b>invertible</b>.[[src:vars]]</p>' } ],
      narration: [
        'Any one-number update would be a rule: the new answer from the kept number, the departing value and the arriving value. How could a program prove that no such rule can exist? Choose an answer.',
        'Find two windows with the same three inputs but different right answers. Here is the search: random windows, keyed by those three inputs, until two keys match and their next maxima differ.',
        'It finds window 8, 2, 7 and window 8, 6, 6. Both keep 8, 8 departs, 3 arrives, but the answers are 7 and 6. The same search over sums finds nothing, because subtraction undoes addition. A combine that can be undone is called invertible.'
      ]
    },

    /* ---------- 8 · the rescan ---------- */
    {
      title: 'Rescan', layout: 'code', defines: ['rescan'],
      eyebrow: '08 · Writing the program · the second attempt',
      heading: 'When the kept maximum leaves, re-read the window',
      stand: 'This version keeps one number, and only when that number is the one departing does it read the window again.',
      question: { step: 0, prompt: 'This is correct. On which stream does it re-read the window on every single tick?', options: [
        { text: 'A rising stream: 1, 2, 3 and so on.', correct: false, why: 'Rising, the newest is always the maximum, so the kept number never departs. Just 1 rescan.' },
        { text: 'A falling stream: 20, 19, 18 and so on.', correct: true, why: 'Falling, the oldest value in the window is always the largest, so the maximum departs on every tick.' },
        { text: 'A flat stream: 4, 4, 4 and so on.', correct: false, why: 'All values are equal, and the eviction keeps one entry. It is the falling stream that hurts.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF, TOTAL, SINGLE, COLL), add: [RESCAN], step: 1 }),
      cards: [ { step: 2, title: 'The forbidden re-read, back again', html: '<p>A <b>rescan</b> re-reads the whole window. Here: <b>2</b> rescans. Rising: 1. Falling: <b>18 of 18</b> windows — the full re-read the question forbids, under another name.[[src:vars]]</p>' } ],
      narration: [
        'The second attempt keeps one number, and only when that number is departing does it re-read the window. This is correct. On which stream does it re-read on every single tick? Choose an answer.',
        'A falling stream. Here it is: it tracks the kept number, and when the departing value equals it, it calls brute max on the window again. Each re-read of the whole window is called a rescan.',
        'On our values it rescans twice. On a rising stream, once. On a falling stream, 18 times for 18 windows: the full re-read the question forbids, back again under another name.'
      ]
    },

    /* ---------- 9 · the deque, part 1: eviction ---------- */
    {
      title: 'Evict', layout: 'code', defines: ['deque', 'index'],
      eyebrow: '09 · Writing the program · the structure that works',
      heading: 'Keep only values that could still win',
      stand: 'At tick 6 the window is 6, 1 and the newly arrived 9. The 6 and the 1 are still inside it.',
      question: { step: 0, prompt: '9 arrives. Can the 6 or the 1 ever be the maximum again?', options: [
        { text: 'Yes, once the 9 leaves the window.', correct: false, why: 'The 9 is newer, so it leaves after them. While they are in the window, so is the 9.' },
        { text: 'No: 9 is both larger and newer than them.', correct: true, why: 'As long as either is in the window, the 9 is too, and it is bigger. They are dead, and can be dropped.' },
        { text: 'Only the 6, since it is larger than the 1.', correct: false, why: 'Being larger than 1 does not help. The 9 beats both, and outlasts both.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF, TOTAL, SINGLE, COLL, RESCAN), add: [EVICT], step: 1 }),
      cards: [ { step: 2, title: 'A deque of indexes', html: '<p>A <b>deque</b> is a list you can add to or remove from at both ends. It holds each value’s <b>index</b>, its position in the stream. Before pushing a new index, every entry whose value is ≤ the newcomer is popped off the back.[[src:vars]]</p>' } ],
      narration: [
        'Now the structure that works. Suppose 9 arrives while 6 and 1 are still in the window. Can either of them ever be the maximum again? Choose an answer.',
        'No. The 9 is both larger and newer. While either of them is in the window, so is the 9, and it beats them. So they can be thrown away. Here is the start of slide max.',
        'It keeps a deque, a list you can add to or remove from at both ends. It holds positions in the stream, called indexes. Before pushing a new index, it pops every entry from the back whose value is not bigger than the newcomer.'
      ]
    },

    /* ---------- 10 · the deque, part 2: expiry and answer ---------- */
    {
      title: 'Front', layout: 'code',
      eyebrow: '10 · Writing the program · expiry, and the answer',
      heading: 'The front is the answer — once it is still in the window',
      stand: 'After eviction the deque runs from largest at the front to smallest at the back. But the front can be too old.',
      question: { step: 0, prompt: 'Why does the deque hold indexes rather than the values themselves?', options: [
        { text: 'Indexes are smaller numbers, so they save memory.', correct: false, why: 'Size is not the point. With exposures in lakh, an index can be as big as a value.' },
        { text: 'Only an index can say whether an entry has left the window.', correct: true, why: 'Comparing the front’s index with the tick number tells whether it is older than the window. A value cannot tell you its age.' },
        { text: 'Values would not stay in decreasing order.', correct: false, why: 'The eviction keeps the values decreasing either way. The index is needed for age, not order.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF, TOTAL, SINGLE, COLL, RESCAN, EVICT), add: [EXPIRE], step: 1 }),
      cards: [ { step: 2, title: 'At most one expiry per tick', html: '<p>The window moves by one, so at most one entry can expire per tick. Then the front is the maximum, read in one step. Every index is pushed once and popped at most once.[[src:vars]]</p>' } ],
      narration: [
        'After eviction the deque runs from largest at the front to smallest at the back. But the front might be too old. Why does the deque hold indexes rather than values? Choose an answer.',
        'Only an index can say whether an entry has left the window. Here is the rest: if the front’s index is older than the window, it expires. Then, once 3 ticks have arrived, the front’s value is the answer.',
        'The window moves by one, so at most one entry expires per tick. Every index is pushed once and popped at most once. Watch it run.'
      ]
    },

    /* ---------- 11 · the deque, animated ---------- */
    {
      title: 'Deque', layout: 'array',
      eyebrow: '11 · Watch the deque after every tick',
      heading: 'Largest at the front, and the front is the answer',
      stand: 'The deque row shows the values its indexes point to, front first.',
      array: {
        labelWidth: 140, slotLabel: 'tick',
        rows: [
          { label: 'arrives', values: VALUES },
          { label: 'deque after', values: DQ },
          { label: 'answer', values: ANS }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [5] },
          { step: 3, do: 'show', rows: [2] }
        ]
      },
      cards: [
        { step: 2, title: 'Tick 5: the 7 expires', html: '<p>Before: 7 6. The 1 is pushed behind them; then the 7’s index is too old and leaves the front. Deque: <b>6 1</b>, answer <b>6</b>.[[src:vars]]</p>' },
        { step: 4, title: '16 steps against 21 reads', html: '<p>9 pushes + 6 pops + 1 expiry = <b>16</b> steps, against 21 reads for re-reading every window.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine exposures as they arrive, one column per tick.',
        'Under each, the deque after that tick, front first. At tick 2, the 7 arrives and pops both the 3 and the 5: they can never win now. At tick 6, the 9 pops the 6 and the 1.',
        'Look at tick 5. The deque was 7 6. The 1 is pushed behind them, then the 7’s index is too old, so it expires from the front. The deque is 6 1, and the answer is 6.',
        'And the answers are simply the front of the deque each time: 7, 7, 7, 6, 9, 9, 9. No window is ever re-read.',
        'In all, 9 pushes, 6 pops and 1 expiry: 16 steps, against 21 reads for re-reading every window.'
      ]
    },

    /* ---------- 12 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '12 · Writing the program · worked examples, checked three ways',
      heading: 'Eighteen examples, including where the deque loses',
      stand: 'Each row is checked against the deque, the brute force and the rescan, and prints the deque’s steps beside the brute force’s reads.',
      question: { step: 0, prompt: 'With a window of just 1, which costs more: the deque, or re-reading?', options: [
        { text: 'Re-reading: it always costs more than a structure.', correct: false, why: 'With a window of 1, re-reading is one read per tick. Nothing can beat that.' },
        { text: 'They cost exactly the same.', correct: false, why: 'The deque pushes, pops and expires on every tick, which is more than one read.' },
        { text: 'The deque: it does several steps where one read would do.', correct: true, why: 'On 5,000 ticks with a window of 1: 9,999 deque steps against 5,000 reads.' } ] },
      code: P.build({ before: upTo(DOC, DATA, REF, TOTAL, SINGLE, COLL, RESCAN, EVICT, EXPIRE), add: [EX, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Honest about losing', html: '<p>The table includes a flat stream, a single event, a stream shorter than its window (no answer: None), and a 5,000-tick stream where the deque <b>loses</b>: 9999 steps against 5000 reads at a window of 1.[[src:whole]]</p>' } ],
      narration: [
        'Next, a table of worked examples, each checked three ways. With a window of just 1, which costs more: the deque, or re-reading? Choose an answer.',
        'The deque. Here is the examples table and the function that prints and asserts it. Each row is checked against the deque, the brute force and the rescan, so a wrong expected value would have to be wrong in three places at once.',
        'And it is honest about losing. On 5,000 ticks with a window of 1, the deque takes 9,999 steps against 5,000 reads. A window that small was never worth a structure.'
      ]
    },

    /* ---------- 13 · main, part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · run all four answers',
      heading: 'Run every method, and catch the wrong one',
      stand: 'The main function runs the brute force, the one number, the rescan and the deque. Window 3 means ticks 3, 4 and 5: the values 2, 6, 1.',
      question: { step: 0, prompt: 'The one-number answer is wrong at window 3 only. Why is it right again at window 4?', options: [
        { text: 'Because 9 arrives and is bigger than the stale 7.', correct: true, why: 'The stale number is not fixed by time passing. A bigger value happening along is what hides it.' },
        { text: 'Because the 7 finally expires from it.', correct: false, why: 'Nothing ever expires from one kept number. That is exactly what it cannot do.' },
        { text: 'Because window 4 is the last one the program checks.', correct: false, why: 'Windows 5 and 6 are checked too. They agree for the same reason: 9 is still the largest.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EX, REF, TOTAL, SINGLE, RESCAN, EVICT, EXPIRE, COLL, SHOW), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Caught in the predicted direction', html: '<p>Asserted: the one number differs only at window 3, it can only read <b>high</b>, and window 4 agrees because 9 &gt; 7. The deque equals the truth with exactly 9 pushes, 6 pops and 1 expiry.[[src:vars]]</p>' } ],
      narration: [
        'Main runs all four answers on the nine values. The one-number answer is wrong at window 3 only. Why is it right again at window 4? Choose an answer.',
        'Because 9 arrives and beats the stale 7. Here is the first part of main: it prints all four results, then asserts that the one number is wrong only at window 3, only ever too high, and right at window 4 because 9 is bigger.',
        'It also asserts the deque’s cost exactly: 9 pushes, 6 pops and 1 expiry, 16 steps, fewer than the 21 reads.'
      ]
    },

    /* ---------- 14 · main, part 2 ---------- */
    {
      title: 'Edges', layout: 'code',
      eyebrow: '14 · Writing the program · the remaining checks',
      heading: 'Rescans, the proof, floats, edges, and 800 random streams',
      stand: 'The rest of main. One check is about a single character in the eviction: `<=` or `<`.',
      question: { step: 0, prompt: 'On the flat stream 4, 4, 4, 4, 4, 4, what does using “smaller than” instead of “smaller than or equal” in the eviction change?', options: [
        { text: 'The answers become wrong.', correct: false, why: 'The answers stay right: equal values are all the maximum. What changes is how many are kept.' },
        { text: 'The deque grows to hold all 3, instead of 1.', correct: true, why: 'Equal values are no longer popped, so duplicates pile up. The comparison buys space, not answers.' },
        { text: 'Nothing at all.', correct: false, why: 'The program measures it: 1 entry with the first, 3 with the second.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EX, REF, TOTAL, SINGLE, RESCAN, EVICT, EXPIRE, COLL, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Everything asserted', html: '<p>Rescans: 2, 1 rising, 18 of 18 falling. The proof is re-run. Floats: one 1e16 makes 6 of 7 running totals drift; the deque never subtracts, so it stays exact. And 800 random streams: the one number is wrong on 636.[[src:whole]]</p>' } ],
      narration: [
        'The rest of main checks everything else. One check is about a single character. On a flat stream of six 4s, what does using smaller than, instead of smaller than or equal, change? Choose an answer.',
        'The deque grows to 3 entries instead of 1. The answers stay right. Here is the rest of main: the rescan costs, the impossibility search re-run, and the float case.',
        'One huge value makes 6 of 7 running totals drift, but the deque never subtracts, so it stays exact. Then 800 random streams: the deque and the rescan always match, and the one number is wrong on 636.'
      ]
    },

    /* ---------- 15 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '15 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      question: { step: 0, prompt: 'Of the four methods in the file, which ones give correct answers?', options: [
        { text: 'Only the deque.', correct: false, why: 'The brute force and the rescan are correct too. They just cost more.' },
        { text: 'Brute force, rescan and deque: all but the one number.', correct: true, why: 'Three are correct; they differ in cost. Only the one number is wrong, at window 3.' },
        { text: 'All four, on these nine values.', correct: false, why: 'The one number shows 7 at window 3, where the truth is 6.' } ] },
      code: P.whole(),
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Of its four methods, which give correct answers? Choose an answer.',
        'Brute force, rescan and deque. They differ only in cost: 21 reads, a rescan whenever the maximum departs, or 16 steps. Only the one number is wrong.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'The output shows the counter-example. Why does it settle the question for good?', options: [
        { text: 'Because it was found quickly.', correct: false, why: 'Speed of finding it is beside the point. One example is enough, however long it took.' },
        { text: 'Because both windows are real ones from the nine values.', correct: false, why: 'They are random windows from the search, not from the nine values. They need not be.' },
        { text: 'Because same inputs with different answers rules out every rule.', correct: true, why: 'Any rule gives one answer for one set of inputs, so no rule can be right for both windows.' } ] },
      code: OUT.whole('what python3 programs/ch01_v2.py prints'),
      narration: [
        'Here is what the program prints: the examples table, the four methods, and the counter-example. Why does the counter-example settle the question for good? Choose an answer.',
        'Because the same three inputs give two different right answers, 7 and 6, and any rule gives one answer per input. Every possible one-number rule is ruled out at once, including ones nobody has thought of.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'An invertible combine, or a structure',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>brute_max</code>', 'reads the whole window: the reference', '21 reads'] },
          { step: 0, cells: ['<code>running_max_single</code>', 'one kept number: no line can remove a departed maximum', 'wrong at window 3'] },
          { step: 1, cells: ['<code>find_max_collision</code>', 'two windows, same three inputs, answers 7 and 6', 'no rule can exist'] },
          { step: 1, cells: ['<code>running_max_rescan</code>', 'correct, but re-reads when the maximum departs', '18 of 18 when falling'] },
          { step: 2, cells: ['<code>slide_max</code>', 'deque of indexes, largest at the front', '9 + 6 + 1 = 16 steps'] }
        ]
      },
      side: { step: 3, title: 'The lesson', html: '<p>An incremental window needs an <b>invertible</b> combine. Sums and counts have one; a maximum does not, so it needs a structure.[[src:vars]]</p><p>Next, part 6: a window of the last 60 <b>seconds</b>, where any number of values can leave at once.</p>' },
      narration: [
        'To recap. Brute max reads the whole window: the reference, 21 reads. Running max single keeps one number, and goes wrong at window 3, because no line can remove a departed maximum.',
        'The collision search proves no one-number rule can exist. And the rescan is correct, but re-reads on every tick of a falling stream.',
        'Slide max keeps a deque of indexes, largest at the front: 16 steps. The lesson: a window can be updated with one number only if its combine is invertible, like a sum. A maximum is not.',
        'Next, part 6: a window of the last 60 seconds, where any number of values can leave at once.'
      ]
    }
  ]
};
