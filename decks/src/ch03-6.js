// Chapter 3, Part 6 — Variation 3 of the interview question ("the next warmer day", which
// looks like weather), built as a program WITH the viewer. Every code slide asks what the
// next piece must do, then reveals the real lines from programs/ch03_v3.py (read at build
// time by _prog.js, addressed by content, never by line number). The last slides show the
// whole file and what it actually prints (programs/ch03_v3.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch03';
const P = program('ch03_v3.py');
const OUT = program('ch03_v3.out');

// the pieces, in the order a person would write them
const DATA = P.span("# The chapter's nine values", 'N = len(TEMPS)');
const NAIVE = P.fn('naive');
const STACK = P.fn('next_warmer');
const WITHIN = P.fn('next_warmer_within');
const INPUTS = P.span('# One day, a monotone', 'BIG_TEMPS = ');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN = P.span('def main():', '    main()');

// the temperatures, read from the program itself, and the stack replayed day by day
const TEMPS = JSON.parse(P.lines[P.at('TEMPS = [')].split('=')[1]);
const trace = (() => {
  const stack = [], out = TEMPS.map(() => 0), after = [], resolved = [], counts = [];
  TEMPS.forEach((t, i) => {
    const now = [];
    while (stack.length && TEMPS[stack[stack.length - 1]] < t) { const j = stack.pop(); out[j] = i - j; now.push(j); }
    stack.push(i);
    after.push(stack.join(' '));
    resolved.push(now.length ? now.join(', ') : '—');
    counts.push(now.length);
  });
  return { out, after, resolved, counts, left: stack };
})();

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['naive  : [2, 1, 4, 1, 2, 1, 0, 1, 0]   (14 forward comparisons)',
  '(9 pushes + 7 pops = 16 steps -- the stack LOSES at this size)',
  'the biggest single eviction was 3 days at once', 'answer for days [2, 4, 5] simultaneously.',
  '`<=` gives [1, 1, 1, 0]', 'L = 3: [2, 1, 0, 1, 2, 1, 0, 1, 0]   wrong on days [2]',
  'the smallest safe lookahead here is 4',
  'the crossover on this series is at 16 days (28 steps against 30 comparisons);',
  '20,000 days, the longest wait          20000   9065   998    2195',
  'all 15 examples agree with the forward scan', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch03_v3.out no longer prints "${s}" — rewrite the narration`);
if (TEMPS.join() !== '5,3,7,2,6,1,9,4,8' || trace.out.join() !== '2,1,4,1,2,1,0,1,0' || trace.left.join() !== '6,8'
  || trace.counts.reduce((a, b) => a + b, 0) !== 7 || Math.max(...trace.counts) !== 3)
  throw new Error('programs/ch03_v3.py no longer has the temperatures this deck explains — rewrite the narration');

module.exports = {
  title: 'The Next Warmer Day',
  eyebrow: 'Streaming · Ch 3 · Part 6',
  ...shared,
  jargon: ['day', 'warmer', 'wait', 'function', 'forward scan', 'stack', 'unresolved', 'lookahead'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 3 · the original interview problem'),
    model: section(CH, 'How to model it', 'Chapter 3 · how to model it'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 3 · Variation 3, the next warmer day')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['day', 'warmer', 'wait'],
      eyebrow: '01 · A Google interview question, Variation 3',
      heading: 'A weather station, nine days, and how long until it gets warmer',
      hero: { step: 0, text: 'A weather station records one temperature per <b>day</b>: 5, 3, 7, 2, 6, 1, 9, 4, 8 degrees. For each day, how many days until a strictly <b>warmer</b> one? That count is the day’s <b>wait</b>; if no warmer day ever comes, the answer is 0.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'days in our series[[src:var]]' },
        { step: 1, value: 4, label: 'the longest wait in them: day 2[[src:var]]' },
        { step: 2, value: 3, label: 'days that one hot day answers at once[[src:var]]' },
        { step: 2, value: 2195, label: 'the longest wait in a 20,000-day series[[src:var]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A wait for every day', text: 'Days numbered from 0; the wait is a difference of day numbers.' },
        { step: 3, n: 2, title: 'Strictly warmer', text: 'An equal day does not count; the wait goes on past it.' },
        { step: 4, n: 3, title: '0 means never', text: 'It is a real answer: no day can honestly wait 0 days.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'A weather station records one temperature per day: 5, 3, 7, 2, 6, 1, 9, 4, 8 degrees. For each day: how many days until a strictly warmer one? That count is the day’s wait, and if no warmer day ever comes, the answer is 0.',
        'We have 9 days. The longest wait among them is 4 days, for day 2.',
        'One hot day can answer several waiting days at once: here, 3 of them. And in a 20,000-day series the longest wait is 2,195 days.',
        'Days are numbered from 0, and a wait is a difference of day numbers. Warmer means strictly warmer: a day of the same temperature does not count.',
        'And 0 is a real answer, meaning never, because no day can honestly wait zero days. We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Day 0 was 5 degrees. How long until warmer?',
      stand: 'Days 0 to 8: 5, 3, 7, 2, 6, 1, 9, 4, 8 degrees.',
      question: { step: 0, prompt: 'What is day 0’s wait?', options: [
        { text: '1: day 1 comes next.', correct: false, why: 'Day 1 is 3 degrees, cooler than 5. It does not end the wait.' },
        { text: '2: day 2 is 7 degrees.', correct: true, why: 'Day 1 is cooler; day 2, at 7, is the first warmer day: 2 days later.' },
        { text: '6: day 6 is the hottest.', correct: false, why: 'The question is the first warmer day, not the hottest one.' } ] },
      cards: [
        { step: 1, title: 'Every day’s wait', html: '<p>2, 1, 4, 1, 2, 1, 0, 1, 0. Day 6, at 9 degrees, is never beaten, so its wait is 0; so is the last day’s.[[src:var]]</p>' },
        { step: 2, title: 'No window here', html: '<p>Part 4 had a window of fixed size. Here there is none: a day may wait any number of days. Only the eviction idea carries over.[[src:var]]</p>' }
      ],
      narration: [
        'Try a small case first. Day 0 was 5 degrees. What is its wait? Choose an answer.',
        'Two. Day 1 is cooler, and day 2, at 7 degrees, is the first warmer day. All nine waits are 2, 1, 4, 1, 2, 1, 0, 1, 0. Day 6, at 9, is never beaten, so its wait is 0.',
        'Notice there is no window of fixed size here: a day may wait any number of days. Only the eviction idea carries over from the sliding maximum.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine temperatures, and a run with ties',
      stand: 'A program is written top to bottom. The first thing it needs is the data.',
      question: { step: 0, prompt: 'Why add a separate run 5, 5, 5, 6 beside the nine days?', options: [
        { text: 'The nine are all different, so “strictly” is never tested.', correct: true, why: 'Only equal temperatures show whether an equal day wrongly ends a wait.' },
        { text: 'To make the program run longer.', correct: false, why: 'Four more days barely change the running time. It is there for a case.' },
        { text: 'Because 6 is the warmest day of all.', correct: false, why: 'It is not, and the warmest day is not the point. The repeated 5s are.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch03_v3.py · the data' }),
      cards: [ { step: 2, title: 'Rise and fall', html: '<p>The comment explains the choice: the nine temperatures rise and fall, so the mechanism is visible, and all differ, so each answer can be traced to the day that caused it.[[src:var]]</p>' } ],
      narration: [
        'First, the data. Why add a separate run 5, 5, 5, 6 beside the nine days? Choose an answer.',
        'Because the nine are all different, so strictly warmer is never tested. Here are the first lines: the nine temperatures, the run with ties, and how many days there are.',
        'The comment explains the choice: the nine temperatures rise and fall, so the mechanism is visible, and they all differ, so each answer can be traced to the day that caused it.'
      ]
    },

    /* ---------- 4 · the obvious answer ---------- */
    {
      title: 'Scan', layout: 'code', defines: ['function', 'forward scan'],
      eyebrow: '04 · Writing the program · the reference answer',
      heading: 'For each day, look forward until something warmer turns up',
      stand: 'Each piece below is a function: a named recipe that takes inputs and gives back an answer.',
      question: { step: 0, prompt: 'When does looking forward from every day cost the most?', options: [
        { text: 'A cooling trend: every day looks to the end and finds nothing.', correct: true, why: 'No warmer day stops any search early, so each day reads all the days after it.' },
        { text: 'A warming trend: every day is answered at once.', correct: false, why: 'That is the cheapest case: each search stops after one day.' },
        { text: 'It always costs the same.', correct: false, why: 'The search stops at the first warmer day, so the cost depends on the weather.' } ] },
      code: P.build({ before: [DATA], add: [NAIVE], step: 1 }),
      cards: [ { step: 2, title: 'A forward scan', html: '<p>Reading forward from each day is a <b>forward scan</b>: 14 comparisons on these nine days. It is the reference every faster answer is checked against.[[src:var]]</p>' } ],
      narration: [
        'The simplest correct program: for each day, look forward until something warmer turns up. When does that cost the most? Choose an answer.',
        'A cooling trend, where every day looks to the end and finds nothing. Here is naive: for each day, start at 0, then look at each later day and stop at the first warmer one, counting the comparisons.',
        'Reading forward from each day is called a forward scan. On these nine days it makes 14 comparisons. It stays in the program as the reference.'
      ]
    },

    /* ---------- 5 · the stack ---------- */
    {
      title: 'Stack', layout: 'code', defines: ['stack', 'unresolved'],
      eyebrow: '05 · Writing the program · the answer',
      heading: 'Keep the days still waiting; a warm day answers them together',
      stand: 'Days 2 (7°), 4 (6°) and 5 (1°) are still waiting for a warmer day. Then day 6 arrives at 9°.',
      question: { step: 0, prompt: 'Which of the waiting days does day 6 answer?', options: [
        { text: 'All three at once: it is warmer than each.', correct: true, why: 'And it is the first warmer day for each, or an earlier one would already have answered them.' },
        { text: 'Only day 5, the most recent.', correct: false, why: 'Day 6 is warmer than days 4 and 2 too, and nothing warmer came before it.' },
        { text: 'Only day 2, the one waiting longest.', correct: false, why: 'Days 4 and 5 are also cooler than 9 and still waiting, so they are answered as well.' } ] },
      code: P.build({ before: [DATA, NAIVE], add: [STACK], step: 1 }),
      cards: [ { step: 2, title: 'A stack of unresolved days', html: '<p>Days still waiting are <b>unresolved</b>. They sit in a <b>stack</b>, a list used from one end only, kept cooling downward. Evicted entries <b>become answers</b>: the one line that differs from the sliding maximum.[[src:var]]</p>' } ],
      narration: [
        'Days 2, 4 and 5 are still waiting for a warmer day. Then day 6 arrives at 9 degrees. Which of them does it answer? Choose an answer.',
        'All three at once, and it is the first warmer day for each of them. Here is next warmer: while the most recent waiting day is cooler than today, pop it and record its wait. Then push today.',
        'Days still waiting are called unresolved, and they sit in a stack: a list added to and removed from at one end. The popped entries become answers instead of being thrown away.'
      ]
    },

    /* ---------- 6 · watch the stack ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '06 · Watch the stack, day by day',
      heading: 'Each day goes in once and comes out at most once',
      stand: 'For each day: its temperature, the days answered as it arrives, how many, and the unresolved days left on the stack.',
      array: {
        labelWidth: 170, slotLabel: 'day',
        rows: [
          { label: 'temperature', values: TEMPS },
          { label: 'answers days', values: trace.resolved },
          { label: 'how many', values: trace.counts },
          { label: 'stack after', values: trace.after }
        ],
        meters: ['days read', 'days answered'],
        actions: [
          { step: 0, do: 'show', rows: [0, 3] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'pick', slots: [6] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 400 }
        ]
      },
      cards: [
        { step: 1, title: 'Day 6', html: '<p>9 degrees answers days 5, 4 and 2 in one go: the biggest single group here.[[src:var]]</p>' },
        { step: 2, title: '16 steps, 2 left', html: '<p>9 pushes + 7 pops = 16 steps. Days 6 and 8 are never answered: their wait is 0.[[src:var]]</p>' }
      ],
      narration: [
        'Here is each day’s temperature, and the stack of unresolved days after it arrives. The stack always cools downward from bottom to top.',
        'The second row is the days each arrival answers. Look at day 6: at 9 degrees it answers days 5, 4 and 2 in one go.',
        'Now count the answers as the pointer walks: 7 in all. With 9 pushes, that is 16 steps. Days 6 and 8 are never answered, so their wait is 0. Every day goes in once and comes out at most once.'
      ]
    },

    /* ---------- 7 · the reflex ---------- */
    {
      title: 'Trap', layout: 'code', defines: ['lookahead'],
      eyebrow: '07 · Writing the program · the wrong answer the question invites',
      heading: 'Pick a window, and only look that far ahead',
      stand: 'Someone who has just learned the sliding window reaches for one here: look only L days ahead.',
      question: { step: 0, prompt: 'Looking only 3 days ahead, what does it report for day 2, whose true wait is 4?', options: [
        { text: '0, which reads exactly like “never warmer”.', correct: true, why: 'The warmer day is 4 days off, beyond the limit, so nothing is found, and nothing tells the two zeros apart.' },
        { text: '3, the furthest it was allowed to look.', correct: false, why: 'It reports a day only when it finds a warmer one. Finding none, it reports 0.' },
        { text: '4, the right answer, a little more slowly.', correct: false, why: 'Day 6 is beyond the 3 days it may look, so it is never seen.' } ] },
      code: P.build({ before: [DATA, NAIVE, STACK], add: [WITHIN], step: 1 }),
      cards: [ { step: 2, title: 'The window is not in the question', html: '<p>A <b>lookahead</b> of 3 is wrong on day 2; the smallest safe one here is 4, and on a slide like 10, 9, … 1, 99 it is the whole series.[[src:var]]</p>' } ],
      narration: [
        'Someone who has just learned the sliding window reaches for one here: only look L days ahead. With 3 days, what does it report for day 2, whose true wait is 4? Choose an answer.',
        '0, which reads exactly like never warmer. Here is next warmer within: the forward scan, cut off after the chosen number of days. Nothing in its output says the answer was cut off.',
        'How far ahead to look is called the lookahead. 3 is wrong on day 2, the smallest safe one here is 4, and on a long cooling slide it is the whole series. The window size is a property of the data.'
      ]
    },

    /* ---------- 8 · examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '08 · Writing the program · worked examples, as data',
      heading: 'Fifteen cases, each asserted, with both costs',
      stand: 'Each row: what it exercises, the temperatures, the day, and the wait expected. A function prints the table and checks every row.',
      question: { step: 0, prompt: 'On the nine days: the stack takes 16 steps, the forward scan 14 comparisons. Which is the better program here?', options: [
        { text: 'The forward scan: these temperatures turn over fast.', correct: true, why: 'Each forward search stops quickly, while the stack pays a push for every day.' },
        { text: 'The stack, because it is the clever one.', correct: false, why: 'Clever is not cheaper on nine days. The table prints the honest verdict.' },
        { text: 'Neither: they cost the same.', correct: false, why: '16 and 14 differ. The stack starts winning only on longer series.' } ] },
      code: P.build({ before: [DATA, NAIVE, STACK, WITHIN], add: [INPUTS, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Where the stack wins', html: '<p>On cooling and flat runs, the long slide, and at 20,000 days. The crossover on the large series is at 16 days: 28 steps against 30 comparisons.[[src:var]]</p>' } ],
      narration: [
        'Next, worked examples written as data. On the nine days the stack takes 16 steps and the forward scan 14 comparisons. Which is the better program here? Choose an answer.',
        'The forward scan: these temperatures turn over fast, so each search stops quickly, while the stack pays for every day. Here are the extra inputs, the table, and show examples, which asserts every row.',
        'The stack wins on cooling and flat runs and on large series. The crossover is at 16 days: 28 steps against 30 comparisons. Below that, the forward scan is genuinely the better program.'
      ]
    },

    /* ---------- 9 · the checks ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '09 · Writing the program · proving every answer',
      heading: 'Run it all, and pin down “strictly”',
      stand: 'The last function prints the answers, tests ties, tries lookaheads, measures the crossover, and checks 600 random series.',
      question: { step: 0, prompt: 'On 5, 5, 5, 6, what would “warmer or equal” wrongly report?', options: [
        { text: '1, 1, 1, 0: each day resolved by an identical day.', correct: true, why: 'It claims tomorrow is warmer when tomorrow is the same. The strict version gives 3, 2, 1, 0.' },
        { text: '3, 2, 1, 0, the same as the strict version.', correct: false, why: 'That is the strict answer. Allowing equal days changes it.' },
        { text: '0, 0, 0, 0: nothing is ever warmer.', correct: false, why: 'Day 3, at 6, is warmer than all three. Only the equal days are in question.' } ] },
      code: P.build({ before: [DATA, NAIVE, STACK, WITHIN, INPUTS, EXAMPLES, SHOW], add: [MAIN], step: 1 }),
      cards: [ { step: 2, title: 'What it asserts', html: '<p>The stack equals the forward scan; day 6 answers days 2, 4 and 5; strict gives 3, 2, 1, 0 on the ties; every too-short lookahead reports a false 0.[[src:var]]</p>' } ],
      narration: [
        'The last piece runs everything. On 5, 5, 5, 6, what would warmer or equal wrongly report? Choose an answer.',
        '1, 1, 1, 0: each day resolved by an identical day. Here is main: it prints the answers and costs, checks the ties both ways, tries lookaheads of 1 to 8, measures the crossover, and checks 600 random series.',
        'Every claim is asserted: the stack equals the forward scan, day 6 answers days 2, 4 and 5 together, and every too-short lookahead reports a false 0.'
      ]
    },

    /* ---------- 10 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '10 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. The long comment at the top defines every word before using it.',
        'From the top: the data, the example inputs and table, the forward scan, the stack, the lookahead reflex, and main with its checks.'
      ]
    },

    /* ---------- 11 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '11 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch03_v3.py prints'),
      narration: [
        'Here is what the program prints. First the examples table, with the stack losing honestly on the short series and winning at 20,000 days, where the longest wait is 2,195 days.',
        'Then the nine days: both methods give 2, 1, 4, 1, 2, 1, 0, 1, 0. Day 6 answers 3 days at once, and the smallest safe lookahead is 4. All assertions passed.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Link', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'What carried over from the sliding maximum?',
      stand: 'Part 4 kept a list of candidates for the highest value: beaten ones evicted at the back, old ones expired at the front. This program has only a stack.',
      question: { step: 0, prompt: 'Which part of the sliding maximum survives here?', options: [
        { text: 'The eviction: a newer, better day rules older ones out.', correct: true, why: 'A warmer arrival ends every cooler waiting day, just as a larger tick ruled smaller ones out.' },
        { text: 'The window: days leave after a fixed number of days.', correct: false, why: 'There is no window here; trying to add one is the reflex that reports false zeros.' },
        { text: 'Nothing: it is a different problem.', correct: false, why: 'The shape is the same. Only what happens to evicted entries changed: they become answers.' } ] },
      cards: [ { step: 1, title: 'The shared idea', html: '<p>The eviction, not the window. And the waiting days are a watermark’s backlog in miniature: the events a running maximum has not yet passed.[[src:var]]</p>' } ],
      narration: [
        'Part 4 kept a list of candidates, evicting beaten ones at the back and expiring old ones at the front. This program has only a stack. Which part survives? Choose an answer.',
        'The eviction: a newer, better day rules older ones out. The window does not survive, and trying to add one is the reflex that reports false zeros. The shared idea is the eviction, not the window.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you built',
      heading: 'A stack of waiting days, answered in groups',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>naive</code>', 'the forward scan: look ahead from each day', '14 comparisons'] },
          { step: 0, cells: ['<code>next_warmer</code>', 'a stack of unresolved days; a warmer day answers a whole group', '16 steps, 3 at once'] },
          { step: 1, cells: ['<code>next_warmer_within</code>', 'the window reflex: a fixed lookahead reports false zeros', 'safe only at 4'] },
          { step: 2, cells: ['<code>show_examples</code> · <code>main</code>', '15 rows and 600 random series, all asserted; crossover measured', 'at 16 days'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 7 brings the window back, but makes its size the answer: the longest steady stretch on a factory line.[[src:var]]</p>' },
      narration: [
        'To recap. The forward scan looks ahead from each day: 14 comparisons here. The stack keeps unresolved days, and a warmer day answers a whole group: 16 steps, with day 6 answering 3 at once.',
        'The window reflex, a fixed lookahead, reports false zeros: it is safe only at 4 days here, and only for this data.',
        'The examples table and main assert everything, including where the stack honestly loses, and measure the crossover at 16 days.',
        'Next, part 7 brings a window back, but makes its size the answer: the longest steady stretch on a factory line.'
      ]
    }
  ]
};
