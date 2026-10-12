// Chapter 3, Part 7 — Variation 4 of the interview question ("the longest steady stretch",
// which looks like manufacturing), built as a program WITH the viewer. Every code slide asks
// what the next piece must do, then reveals the real lines from programs/ch03_v4.py (read at
// build time by _prog.js, addressed by content, never by line number). The last slides show
// the whole file and what it actually prints (programs/ch03_v4.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch03';
const P = program('ch03_v4.py');
const OUT = program('ch03_v4.out');

// the pieces, in the order a person would write them
const DATA = P.span("# The chapter's nine values", 'N = len(READINGS)');
const SPREAD = P.fn('spread');
const NAIVE = P.fn('longest_naive');
const STEADY = P.fn('longest_steady');
const BOTH = P.fn('longest_popping_both');
const FIXED = P.fn('longest_fixed_offset');
const INPUTS = P.span('# An empty log', 'BIG_READINGS = ');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN = P.span('def main():', '    main()');

// the readings, read from the program itself, and the two deques replayed for L = 6
const READINGS = JSON.parse(P.lines[P.at('READINGS = [')].split('=')[1]);
const LIM = 6;
const trace = (() => {
  const hi = [], lo = [], lefts = [], spreads = [], lens = [], bests = [];
  let left = 0, best = 0, steps = 0, front = 0;
  READINGS.forEach((v, i) => {
    while (hi.length && READINGS[hi[hi.length - 1]] <= v) hi.pop();
    hi.push(i);
    while (lo.length && READINGS[lo[lo.length - 1]] >= v) lo.pop();
    lo.push(i);
    while (READINGS[hi[0]] - READINGS[lo[0]] > LIM) {
      left++; steps++;
      if (hi[0] < left) { hi.shift(); front++; }
      if (lo[0] < left) { lo.shift(); front++; }
    }
    best = Math.max(best, i - left + 1);
    lefts.push(left); spreads.push(READINGS[hi[0]] - READINGS[lo[0]]); lens.push(i - left + 1); bests.push(best);
  });
  return { lefts, spreads, lens, bests, best, steps, front };
})();

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['naive  : 6 seconds from second 0   (33 runs measured)',
  'deques : 6 seconds from second 0 -> [5, 3, 7, 2, 6, 1], spread 6 <= 6',
  '(18 pushes, 13 back-pops, 1 front-pop, 6 left-edge steps)',
  '6 left-edge steps produced only 1 front-pop: 5 dropped from neither deque, 1 from exactly one, 0 from both.',
  'popping both fronts   : 8 seconds (truth 6) -- over by 2', 'expiring at i - best  : 7 seconds (truth 6) -- over by 1',
  'popping-both over-reports 2040 times', 'offset 3000 times, and NEITHER ever under-reports (0 cases)',
  'L = 7, one more buys nothing                    9    7       6',
  '20,000 seconds, L = 20                      20000   20       8  13,079',
  'all 15 examples agree with the brute-force scan', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch03_v4.out no longer prints "${s}" — rewrite the narration`);
if (READINGS.join() !== '5,3,7,2,6,1,9,4,8' || trace.best !== 6 || trace.steps !== 6 || trace.front !== 1
  || trace.lefts[6] !== 6 || trace.spreads[5] !== 6)
  throw new Error('programs/ch03_v4.py no longer has the readings this deck explains — rewrite the narration');

module.exports = {
  title: 'The Longest Steady Stretch',
  eyebrow: 'Streaming · Ch 3 · Part 7',
  ...shared,
  jargon: ['second', 'stretch', 'spread', 'tolerance', 'function', 'deque', 'left edge', 'front'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 3 · the original interview problem'),
    model: section(CH, 'How to model it', 'Chapter 3 · how to model it'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 3 · Variation 4, the longest steady stretch')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['second', 'stretch', 'spread', 'tolerance'],
      eyebrow: '01 · A Google interview question, Variation 4',
      heading: 'A factory sensor, nine readings, and how long the line held steady',
      hero: { step: 0, text: 'A sensor on a production line logs one reading per <b>second</b>: 5, 3, 7, 2, 6, 1, 9, 4, 8. A <b>stretch</b> is any run of consecutive seconds; its <b>spread</b> is highest minus lowest. Given a <b>tolerance</b> L, find the longest stretch whose spread is at most L.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'readings in the log[[src:var]]' },
        { step: 1, value: 8, label: 'the whole log’s spread: 9 − 1[[src:var]]' },
        { step: 2, value: 6, label: 'the tolerance L we will use[[src:var]]' },
        { step: 2, value: 6, label: 'seconds in the longest steady stretch[[src:var]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'The longest stretch within L', text: 'Exactly L still counts; L + 1 does not.' },
        { step: 3, n: 2, title: 'The size is the answer', text: 'In part 4 the stretch length was fixed in advance. Here it is what we measure.' },
        { step: 4, n: 3, title: 'An empty log gives 0', text: 'Not 1: that would claim a second the sensor never logged.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'A sensor on a production line logs one reading per second: 5, 3, 7, 2, 6, 1, 9, 4, 8. A stretch is any run of consecutive seconds, and its spread is its highest reading minus its lowest. Given a tolerance L, find the longest stretch whose spread is at most L.',
        'There are 9 readings, and the whole log spreads 9 minus 1, which is 8.',
        'We will use a tolerance of 6, and the longest steady stretch is 6 seconds.',
        'Exactly L still counts as steady; one more does not. And the size of the stretch is now the answer, not a given, which is what makes this variation different.',
        'An empty log gives 0, not 1, because 1 would claim a second the sensor never logged. We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'With a tolerance of 4, how long can it hold?',
      stand: 'Seconds 0 to 8 read 5, 3, 7, 2, 6, 1, 9, 4, 8.',
      question: { step: 0, prompt: 'What is the longest stretch whose spread is at most 4?', options: [
        { text: '3 seconds: 5, 3 and 7, spread exactly 4.', correct: true, why: 'Exactly 4 still counts. Adding the 2 makes it 7 minus 2, which is 5: too much.' },
        { text: '4 seconds: 5, 3, 7, 2.', correct: false, why: 'Its spread is 7 minus 2, which is 5: one more than the tolerance.' },
        { text: '2 seconds: 5 and 3.', correct: false, why: 'That fits, but a longer stretch, 5, 3, 7, also fits.' } ] },
      cards: [
        { step: 1, title: 'And with 6', html: '<p>Seconds 0 to 5, 5, 3, 7, 2, 6, 1, spread exactly 7 − 1 = 6: <b>6 seconds</b>. Adding the 9 makes the spread 8.[[src:var]]</p>' },
        { step: 2, title: 'One more buys nothing', html: '<p>A tolerance of 7 still gives 6 seconds. Only 8, the whole log’s spread, takes all 9.[[src:var]]</p>' }
      ],
      narration: [
        'Try a small case first. With a tolerance of 4, what is the longest stretch whose spread is at most 4? Choose an answer.',
        'Three seconds: 5, 3 and 7, whose spread is exactly 4, and exactly L still counts. With a tolerance of 6, seconds 0 to 5 fit, spread exactly 6: six seconds. Adding the 9 would make it 8.',
        'And a tolerance of 7 buys nothing: still six seconds. Only 8, the whole log’s spread, takes all nine.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine readings, and the tolerance worth testing',
      stand: 'A program is written top to bottom. The first thing it needs is the data.',
      question: { step: 0, prompt: 'Why is 6 the interesting tolerance for these nine readings?', options: [
        { text: 'The first six span exactly 6, so it sits on the boundary.', correct: true, why: 'A program that gets “at most” wrong would answer 5 instead of 6, and the test would catch it.' },
        { text: 'It is the largest reading in the log.', correct: false, why: 'The largest reading is 9. The tolerance is about spreads, not readings.' },
        { text: 'Any tolerance would test the same thing.', correct: false, why: 'Most would not land exactly on a spread, so an off-by-one would go unseen.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch03_v4.py · the data' }),
      cards: [ { step: 2, title: 'Rise and fall', html: '<p>The comment says why these readings: all different, and rising and falling, so the start of a stretch genuinely has to move, and old highs and lows genuinely leave.[[src:var]]</p>' } ],
      narration: [
        'First, the data. Why is 6 the interesting tolerance for these nine readings? Choose an answer.',
        'Because the first six readings span exactly 6, so the answer sits right on the boundary of at most. Here are the first lines: the nine readings, L equal to 6, and how many readings there are.',
        'The comment explains the readings: all different, and rising and falling, so every part of the program is exercised.'
      ]
    },

    /* ---------- 4 · the obvious answer ---------- */
    {
      title: 'Naive', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · the reference answer',
      heading: 'Measure every stretch, but stop widening when it breaks',
      stand: 'Each piece below is a function: a named recipe that takes inputs and gives back an answer.',
      question: { step: 0, prompt: 'Growing a stretch from one start, once its spread exceeds L, should we keep widening it?', options: [
        { text: 'No: widening can only widen the spread.', correct: true, why: 'Adding readings never lowers the highest or raises the lowest, so it stays too wide.' },
        { text: 'Yes: a later reading might bring it back down.', correct: false, why: 'A spread only grows as the stretch grows. Nothing later can shrink it.' },
        { text: 'Only if L is large.', correct: false, why: 'The size of L does not matter. Once too wide, a wider stretch is wider still.' } ] },
      code: P.build({ before: [DATA], add: [SPREAD, NAIVE], step: 1 }),
      cards: [ { step: 2, title: 'The reference', html: '<p>For L = 6 it measures <b>33</b> stretches and finds 6 seconds from second 0. Every faster answer is checked against it.[[src:var]]</p>' } ],
      narration: [
        'The simplest correct program measures every stretch. Growing a stretch from one start, once its spread exceeds L, should we keep widening it? Choose an answer.',
        'No: widening can only widen the spread. Here are spread, highest minus lowest, and longest naive: for each start it grows the stretch, keeps the best, and breaks as soon as the spread is too wide.',
        'For a tolerance of 6 it measures 33 stretches and finds 6 seconds from second 0. It stays in the program as the reference.'
      ]
    },

    /* ---------- 5 · the two deques ---------- */
    {
      title: 'Edge', layout: 'code', defines: ['deque', 'left edge', 'front'],
      eyebrow: '05 · Writing the program · the answer',
      heading: 'Two lists, and a left edge that moves only when it must',
      stand: 'Keep the highest and lowest candidates in two lists used from both ends, as in part 4. When the spread breaks L, move the start of the stretch forward.',
      question: { step: 0, prompt: 'A new reading pushes the spread over L. How far does the start of the stretch move?', options: [
        { text: 'As far as needed: possibly several seconds.', correct: true, why: 'One reading can break many starts at once, so the start moves in a loop, until the spread fits again.' },
        { text: 'Exactly one second, every time.', correct: false, why: 'One step may not be enough: when the 9 arrives here, the start has to move 6 seconds.' },
        { text: 'Back to the new reading, always.', correct: false, why: 'That throws away stretches that still fit. It moves only as far as it must.' } ] },
      code: P.build({ before: [DATA, SPREAD, NAIVE], add: [STEADY], step: 1 }),
      cards: [ { step: 2, title: 'Deques, the left edge, fronts', html: '<p>A list used from both ends is a <b>deque</b>; its first entry is its <b>front</b>. The start of the stretch is the <b>left edge</b>. Each front is dropped only when its own index falls behind the left edge.[[src:var]]</p>' } ],
      narration: [
        'Keep the highest and lowest candidates in two lists, as in the sliding maximum. When a new reading pushes the spread over L, how far does the start of the stretch move? Choose an answer.',
        'As far as needed. Here is longest steady: hi kept decreasing, lo kept increasing, and while their fronts differ by more than L, the left edge steps forward, dropping each front only if its index has fallen behind.',
        'A list used from both ends is a deque, and its first entry is its front. The start of the stretch is the left edge. The two fronts are checked separately, with two ifs, because either, both or neither may leave.'
      ]
    },

    /* ---------- 6 · watch it ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '06 · Watch the left edge for L = 6',
      heading: 'Six steps of the left edge, and only one front leaves',
      stand: 'For each second: the reading, where the left edge stands, the stretch’s spread and length, and the best length so far.',
      array: {
        labelWidth: 170, slotLabel: 'second',
        rows: [
          { label: 'reading', values: READINGS },
          { label: 'left edge', values: trace.lefts },
          { label: 'spread', values: trace.spreads },
          { label: 'length', values: trace.lens },
          { label: 'best so far', values: trace.bests }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'pick', slots: [5] },
          { step: 2, do: 'pick', slots: [6] },
          { step: 3, do: 'show', rows: [3, 4] }
        ]
      },
      cards: [
        { step: 1, title: 'Second 5', html: '<p>The 1 makes the spread exactly 7 − 1 = 6: still steady. Six seconds from second 0.[[src:var]]</p>' },
        { step: 2, title: 'Second 6', html: '<p>The 9 makes it 8. The left edge steps 6 times; only on the last does a front, the 1’s, fall behind it.[[src:var]]</p>' }
      ],
      narration: [
        'Here are the readings, where the left edge stands after each second, and the spread of the current stretch. The left edge stays at 0 while the spread fits.',
        'At second 5, the 1 arrives and the spread becomes exactly 7 minus 1, which is 6. Still within the tolerance.',
        'At second 6, the 9 arrives and the spread would be 8. The left edge steps forward 6 times, and only on the last step does a front, the 1, fall behind it. 6 steps, 1 front dropped.',
        'The bottom rows: the stretch’s length drops to 1, then grows again, but the best stays at 6 seconds, from second 0.'
      ]
    },

    /* ---------- 7 · bug one ---------- */
    {
      title: 'Both', layout: 'code',
      eyebrow: '07 · Writing the program · the bug the statement warns about',
      heading: 'Drop both fronts whenever the edge moves',
      stand: 'A tempting shortcut: the window moved by one, so one entry must have left each list.',
      question: { step: 0, prompt: 'If every left-edge step drops both fronts, what does it report for L = 6?', options: [
        { text: '8 seconds: it drops extremes still inside the stretch.', correct: true, why: 'A dropped front that was still inside makes the spread read too small, so too much looks steady.' },
        { text: '6 seconds, the same, just slower.', correct: false, why: 'It drops fronts that should stay, so it measures the wrong stretch.' },
        { text: '4 seconds: it is too strict.', correct: false, why: 'Dropping extremes hides spread, so the error goes the other way: too long.' } ] },
      code: P.build({ before: [DATA, SPREAD, NAIVE, STEADY], add: [BOTH], step: 1 }),
      cards: [ { step: 2, title: 'A plausible wrong number', html: '<p>8 seconds, against the truth of 6: over by 2. On a factory floor that is a quality claim nobody made.[[src:var]]</p>' } ],
      narration: [
        'A tempting shortcut: the window moved by one, so one entry must have left each list. If every left-edge step drops both fronts, what does it report for a tolerance of 6? Choose an answer.',
        '8 seconds. Here is longest popping both: the same program, but each step pops both fronts. It throws away extremes still inside the stretch, so the spread reads too small.',
        '8 seconds against the truth of 6: over by 2. A plausible number, and on a factory floor, a quality claim nobody made.'
      ]
    },

    /* ---------- 8 · bug two ---------- */
    {
      title: 'Fixed', layout: 'code',
      eyebrow: '08 · Writing the program · the other wrong answer',
      heading: 'Look for a window size that is not in the question',
      stand: 'Another reflex from part 4: keep a window size, expire against it, and grow it whenever the spread fits.',
      question: { step: 0, prompt: 'The window size here can grow but never shrink. What does that do to the answer?', options: [
        { text: 'It ratchets up: 7 seconds instead of 6.', correct: true, why: 'Once too large, it stays too large, and expiring against it keeps stale fronts.' },
        { text: 'Nothing: it ends at the right size.', correct: false, why: 'It cannot come back down after growing too far, so it overshoots.' },
        { text: 'It stays at 1, the starting size.', correct: false, why: 'It grows whenever the spread fits, so it does not stay at 1.' } ] },
      code: P.build({ before: [DATA, SPREAD, NAIVE, STEADY, BOTH], add: [FIXED], step: 1 }),
      cards: [ { step: 2, title: 'A ratchet, not a measurement', html: '<p>7 seconds against 6: over by 1. Both bugs only ever over-report, the dangerous direction for a quality claim.[[src:var]]</p>' } ],
      narration: [
        'Another reflex from the sliding window: keep a window size, expire against it, and grow it whenever the spread fits. It can grow but never shrink. What does that do? Choose an answer.',
        'It ratchets up. Here is longest fixed offset: it expires fronts against the current best size and adds one whenever the spread fits. Once too large, it stays too large.',
        'It reports 7 seconds against the truth of 6: over by 1. Like the other bug, it errs only toward claiming more stability than the line had.'
      ]
    },

    /* ---------- 9 · examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '09 · Writing the program · worked examples, as data',
      heading: 'Fifteen cases, each asserted, length and start',
      stand: 'Each row: what it exercises, the readings, L, and the length expected. The checking function also requires the same starting second.',
      question: { step: 0, prompt: 'On the nine readings, what does a tolerance of 7 give?', options: [
        { text: '6 seconds: one more tolerance buys nothing.', correct: true, why: 'Adding the 9 needs a spread of 8. At 7 the longest stretch is still the first six seconds.' },
        { text: '7 seconds: one more tolerance, one more second.', correct: false, why: 'Tolerance and length are not tied one to one. The next reading needs 8.' },
        { text: '9 seconds: the whole log.', correct: false, why: 'The whole log spreads 8, so it needs a tolerance of at least 8.' } ] },
      code: P.build({ before: [DATA, SPREAD, NAIVE, STEADY, BOTH, FIXED], add: [INPUTS, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Start, as well as length', html: '<p>A right length at a wrong start is a different stretch, which is exactly what a stale front produces. At 20,000 seconds and L = 20: 8 seconds from second 13,079.[[src:var]]</p>' } ],
      narration: [
        'Next, worked examples written as data, fifteen rows. On the nine readings, what does a tolerance of 7 give? Choose an answer.',
        '6 seconds: one more tolerance buys nothing, because adding the 9 needs 8. Here are the extra inputs, the table, and show examples, which checks every row against the reference, length and start.',
        'Checking the start matters: a right length at a wrong start is a different stretch. At 20,000 seconds with a tolerance of 20, the answer is 8 seconds from second 13,079.'
      ]
    },

    /* ---------- 10 · the checks ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '10 · Writing the program · proving every answer',
      heading: 'Run it all, and measure which way the bugs lean',
      stand: 'The last function prints the answer, counts the left-edge steps, runs both bugs, and tries 3000 random series.',
      question: { step: 0, prompt: 'Over 3000 random series, which way are the two buggy versions wrong?', options: [
        { text: 'Always too long, never too short.', correct: true, why: 'Dropping fronts too early can only hide spread, so they only ever claim more steadiness.' },
        { text: 'Too short and too long, about equally.', correct: false, why: 'The program counts under-reports and finds none at all.' },
        { text: 'Always too short.', correct: false, why: 'A stale front makes the spread look smaller, so stretches look longer, not shorter.' } ] },
      code: P.build({ before: [DATA, SPREAD, NAIVE, STEADY, BOTH, FIXED, INPUTS, EXAMPLES, SHOW], add: [MAIN], step: 1 }),
      cards: [ { step: 2, title: 'Measured, not claimed', html: '<p>Popping both over-reports 2040 times, the fixed offset 3000 times, and neither ever under-reports: 0 cases.[[src:var]]</p>' } ],
      narration: [
        'The last piece runs everything. Over 3000 random series, which way are the two buggy versions wrong? Choose an answer.',
        'Always too long, never too short. Here is main: it prints the answer and its costs, counts how many fronts each left-edge step dropped, runs both bugs, and checks the boundaries.',
        'Measured, not claimed: popping both over-reports 2,040 times, the fixed offset 3,000 times, and neither ever under-reports. Both always claim more stability than the line had.'
      ]
    },

    /* ---------- 11 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '11 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. The long comment at the top defines every word before using it.',
        'From the top: the data, the example inputs and table, the spread, the reference, the two deques, the two bugs, and main with its checks.'
      ]
    },

    /* ---------- 12 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '12 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch03_v4.py prints'),
      narration: [
        'Here is what the program prints. First the examples table: all 15 rows agree with the brute-force scan, length and start.',
        'Then the nine readings: 6 seconds from second 0, with 6 left-edge steps and only 1 front dropped. The two bugs say 8 and 7. All assertions passed.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you built',
      heading: 'Two deques, a left edge, and a size that is the answer',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>spread</code> · <code>longest_naive</code>', 'measure stretches; stop widening once too wide', '33 stretches'] },
          { step: 0, cells: ['<code>longest_steady</code>', 'two deques; the left edge moves as far as needed; fronts leave separately', '6 seconds, 1 front dropped'] },
          { step: 1, cells: ['<code>longest_popping_both</code>', 'drops both fronts on every step', '8: over by 2'] },
          { step: 1, cells: ['<code>longest_fixed_offset</code>', 'a window size that only grows', '7: over by 1'] },
          { step: 2, cells: ['<code>show_examples</code> · <code>main</code>', '15 rows, length and start; 3000 random series; bugs only over-report', 'all pass'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 8 turns to the chapter’s system design question: the component that produces a watermark, a pipeline’s estimate of how complete its data is, built one piece at a time.[[src:ch]]</p>' },
      narration: [
        'To recap. Spread and the naive reference measure stretches, stopping once too wide: 33 here. Longest steady keeps two deques and moves the left edge as far as needed, dropping each front only when it falls behind.',
        'The two bugs drop fronts too early: popping both says 8, the fixed offset says 7. Both claim more stability than the truth of 6.',
        'The examples table and main check length and start, and measure that the bugs only ever over-report.',
        'Next, part 8 turns to the chapter’s system design question: the component that produces a watermark, built one piece at a time.'
      ]
    }
  ]
};
