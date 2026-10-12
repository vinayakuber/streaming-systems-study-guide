// Chapter 3, Part 5 — Variation 2 of the interview question ("the shortest spike", which
// looks like load testing), built as a program WITH the viewer. Every code slide asks what
// the next piece must do, then reveals the real lines from programs/ch03_v2.py (read at
// build time by _prog.js, addressed by content, never by line number). The last slides show
// the whole file and what it actually prints (programs/ch03_v2.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch03';
const P = program('ch03_v2.py');
const OUT = program('ch03_v2.out');

// the pieces, in the order a person would write them
const DATA = P.span("# The chapter's nine values", 'N = len(COUNTS)');
const PREFIX = P.fn('prefix');
const NAIVE = P.fn('shortest_naive');
const TWO = P.fn('shortest_two_pointer');
const DEQ = P.fn('shortest_deque');
const INPUTS = P.span('# An empty load test', 'BIG_COUNTS = [');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN = P.span('def main():', '    main()');

// the counts, read from the program itself, and the increasing list replayed for K = 22
const COUNTS = JSON.parse(P.lines[P.at('COUNTS = [5')].split('=')[1]);
const PRE = COUNTS.reduce((a, c) => [...a, a[a.length - 1] + c], [0]);
const K = 22;
const trace = (() => {
  const dq = [], lists = [], bests = [];
  let best = null, widest = 0;
  PRE.forEach((pj, j) => {
    while (dq.length && pj - PRE[dq[0]] >= K) { const i = dq.shift(); if (best === null || j - i < best) best = j - i; }
    while (dq.length && PRE[dq[dq.length - 1]] >= pj) dq.pop();
    dq.push(j);
    widest = Math.max(widest, dq.length);
    lists.push(dq.join(' '));
    bests.push(best === null ? '—' : best);
  });
  return { lists, bests, best, widest };
})();

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['prefix  = [0, 5, 8, 15, 17, 23, 24, 33, 37, 45]',
  'K =  15 -> 3 seconds, [5, 3, 7] totalling 15', 'K =  21 -> 3 seconds, [9, 4, 8] totalling 21',
  'K =  22 -> 4 seconds, [1, 9, 4, 8] totalling 22   (list never longer than 6, naive examined 45 pairs)',
  'K = 999 -> no run reaches it (45 pairs examined to be sure)',
  '[-4, -6, -5, 4, 5, -2, -1, 0] with K = 5: two-pointer says None, the truth is 1',
  'K =  15 -> 3 seconds;  list length 4 with `>=`, 7 with `>`',
  'shortest run reaching 2000 is 80 seconds', 'at 20,000 that is about 200,010,000',
  'one second, exactly K                     1           7       1            1         4  list LOSES',
  'four seconds: the two costs tie           4          15       3           10        10  tie',
  'all 18 examples agree with the pair scan', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch03_v2.out no longer prints "${s}" — rewrite the narration`);
if (COUNTS.join() !== '5,3,7,2,6,1,9,4,8' || PRE[9] !== 45 || trace.best !== 4 || trace.widest !== 6)
  throw new Error('programs/ch03_v2.py no longer has the counts this deck explains — rewrite the narration');

module.exports = {
  title: 'The Shortest Spike',
  eyebrow: 'Streaming · Ch 3 · Part 5',
  ...shared,
  jargon: ['load test', 'second', 'run', 'function', 'running total', 'pair scan', 'two-pointer', 'increasing list', 'evict'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 3 · the original interview problem'),
    model: section(CH, 'How to model it', 'Chapter 3 · how to model it'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 3 · Variation 2, the shortest spike')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['load test', 'second', 'run'],
      eyebrow: '01 · A Google interview question, Variation 2',
      heading: 'A load test, nine seconds of traffic, and the tightest burst',
      hero: { step: 0, text: 'A <b>load test</b> fires requests at a server and logs how many arrived in each <b>second</b>: 5, 3, 7, 2, 6, 1, 9, 4, 8. A <b>run</b> is any stretch of consecutive seconds. Given a target K, find the <b>shortest run</b> whose total reaches at least K.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'seconds in our log[[src:var]]' },
        { step: 1, value: 45, label: 'requests in all[[src:var]]' },
        { step: 2, value: 4, label: 'seconds needed to reach K = 22[[src:var]]' },
        { step: 2, value: 20000, label: 'seconds in the large test the program measures[[src:var]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'The shortest run reaching K', text: 'Overshooting is fine; falling short is not.' },
        { step: 3, n: 2, title: 'Idle seconds count', text: 'A second with no requests is logged as 0, not left out.' },
        { step: 4, n: 3, title: 'And when nothing reaches K', text: 'Say so. Never return the longest run as a guess.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'A load test fires requests at a server and logs how many arrived in each second: 5, 3, 7, 2, 6, 1, 9, 4, 8. A run is any stretch of consecutive seconds. Given a target K, find the shortest run whose total reaches at least K.',
        'Our log has 9 seconds and 45 requests in all. A busy second and an idle one count the same: one second each.',
        'For K equal to 22, the answer is 4 seconds. The program also measures a test of 20,000 seconds, where slow methods show.',
        'Overshooting the target is fine; falling short is not. And a second with no requests is logged as 0, not left out.',
        'If no run reaches K, the program must say so, never return the longest run as a guess. We will write it together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'The shortest run reaching 15',
      stand: 'Seconds 0 to 8 logged 5, 3, 7, 2, 6, 1, 9, 4, 8 requests.',
      question: { step: 0, prompt: 'What is the shortest run whose total reaches 15?', options: [
        { text: '2 seconds: 9 and 4, then 4 and 8.', correct: false, why: '9 + 4 is 13 and 4 + 8 is 12. No two neighbouring seconds reach 15.' },
        { text: '3 seconds: 5 + 3 + 7, exactly 15.', correct: true, why: 'Seconds 0 to 2 carry exactly 15, and no pair of neighbouring seconds does.' },
        { text: '4 seconds: 2 + 6 + 1 + 9, which is 18.', correct: false, why: 'That reaches 15, but a shorter run already does.' } ] },
      cards: [
        { step: 1, title: 'The step from 3 to 4', html: '<p>K = 21 is reached by 9 + 4 + 8 in 3 seconds. K = 22 is reached by no 3 seconds, so the answer grows to 4: 1 + 9 + 4 + 8.[[src:var]]</p>' },
        { step: 2, title: 'Not a fixed window', html: '<p>In part 4 the window was always 3 ticks. Here the length is the <b>answer</b>, so nothing ever “leaves” on a schedule.[[src:var]]</p>' }
      ],
      narration: [
        'Try a small case first. Seconds 0 to 8 logged 5, 3, 7, 2, 6, 1, 9, 4, 8. What is the shortest run whose total reaches 15? Choose an answer.',
        'Three seconds: 5, 3 and 7, exactly 15. For 21 it is still three seconds, 9, 4 and 8. But 22 is reached by no three seconds, so the answer grows to 4: 1, 9, 4 and 8.',
        'Notice the difference from a fixed window: here the run’s length is the answer, not an input. Nothing leaves on a schedule.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '03 · Writing the program · the data',
      heading: 'The counts, idle seconds, and the targets to test',
      stand: 'A program is written top to bottom. The first thing it needs is the data, and the targets worth testing.',
      question: { step: 0, prompt: 'Which targets K are worth testing first?', options: [
        { text: '21 and 22, where the answer steps from 3 to 4.', correct: true, why: 'A boundary is where a wrong program shows. One target either side of the step tests it.' },
        { text: 'Random targets, as many as possible.', correct: false, why: 'Random ones help later, but may never land on the boundary that matters.' },
        { text: 'Only 45, the whole total.', correct: false, why: 'That only tests the longest run. The interesting step is in the middle.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch03_v2.py · the data' }),
      cards: [ { step: 2, title: 'Idle seconds, and 999', html: '<p><code>IDLE</code> splices three 0 seconds in, the case the problem bothers to mention. <code>999</code> is unreachable and must be reported as such.[[src:var]]</p>' } ],
      narration: [
        'First, the data. Which targets K are worth testing first? Choose an answer.',
        '21 and 22, either side of the step from 3 to 4. Here are the first lines: the nine counts, the same counts with three idle seconds spliced in, and the targets 15, 21, 22 and 999.',
        'The idle seconds are the case the problem mentions. And 999 is unreachable, so the program must report that rather than guess.'
      ]
    },

    /* ---------- 4 · running totals ---------- */
    {
      title: 'Sums', layout: 'code', defines: ['function', 'running total'],
      eyebrow: '04 · Writing the program · change what is stored',
      heading: 'Store running totals, and any run’s total is one subtraction',
      stand: 'Each piece below is a function: a named recipe that takes inputs and gives back an answer.',
      question: { step: 0, prompt: 'How can the total of any run be found without adding it up again?', options: [
        { text: 'Keep the total so far after each second; subtract two of them.', correct: true, why: 'Total through second 8 minus total through second 5 is exactly seconds 6 to 8.' },
        { text: 'Sort the counts, then add the largest.', correct: false, why: 'Sorting breaks “consecutive”. A run must be neighbouring seconds.' },
        { text: 'Keep only the grand total, 45.', correct: false, why: 'One number cannot give the total of a stretch in the middle.' } ] },
      code: P.build({ before: [DATA], add: [PREFIX], step: 1 }),
      cards: [ { step: 2, title: 'Running totals', html: '<p>0, 5, 8, 15, 17, 23, 24, 33, 37, 45. Seconds 6 to 8: 45 − 24 = 21. The leading 0 lets a run start at second 0.[[src:var]]</p>' } ],
      narration: [
        'Here is the move that unlocks the problem: change what is stored. How can the total of any run be found without adding it up again? Choose an answer.',
        'Keep the total so far after each second, a running total, and subtract two of them. Here is prefix: it starts the list with a zero and adds each count to the last total.',
        'The running totals are 0, 5, 8, 15, 17, 23, 24, 33, 37, 45. Seconds 6 to 8 total 45 minus 24, which is 21. The leading zero is what lets a run start at second 0.'
      ]
    },

    /* ---------- 5 · watch the running totals ---------- */
    {
      title: 'Sum', layout: 'array',
      eyebrow: '05 · Watch the running totals being built',
      heading: 'One pass, one addition per second',
      stand: 'Top row: each second’s count. The pointer adds them up; the second row is the total through each second.',
      array: {
        labelWidth: 170, slotLabel: 'second',
        rows: [ { label: 'count', values: COUNTS }, { label: 'total through it', values: PRE.slice(1) } ],
        meters: ['seconds read', 'running total'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [5, 8] }
        ]
      },
      cards: [
        { step: 2, title: 'A run is a difference', html: '<p>Through second 8: 45. Through second 5: 24. So seconds 6 to 8 carry 45 − 24 = <b>21</b>: two reads, no adding.[[src:var]]</p>' }
      ],
      narration: [
        'Here are the nine counts, one per second, in the order they were logged.',
        'Watch the pointer add them up, one second at a time. The running total climbs to 45, and each second’s total so far drops into the second row.',
        'Now any run is a difference of two totals. Through second 8 the total is 45; through second 5 it is 24. So seconds 6 to 8 carry 21, found with two reads and no adding.'
      ]
    },

    /* ---------- 6 · the obvious answer ---------- */
    {
      title: 'Naive', layout: 'code', defines: ['pair scan'],
      eyebrow: '06 · Writing the program · the reference answer',
      heading: 'Try every start and every end',
      stand: 'The simplest correct program checks every run.',
      question: { step: 0, prompt: 'For 9 seconds, how many runs (start, end) does checking every one examine?', options: [
        { text: '45: 9 + 8 + 7 + … + 1.', correct: true, why: 'Start at second 0 and there are 9 possible ends, at second 1 there are 8, and so on down to 1.' },
        { text: '9: one per second.', correct: false, why: 'Each second starts many runs, one for every possible end.' },
        { text: '81: 9 times 9.', correct: false, why: 'A run cannot end before it starts, so only about half of those pairs exist.' } ] },
      code: P.build({ before: [DATA, PREFIX], add: [NAIVE], step: 1 }),
      cards: [ { step: 2, title: 'A pair scan', html: '<p>Examining every (start, end) pair is a <b>pair scan</b>: 45 pairs here, about 200,010,000 at 20,000 seconds. It is the reference every faster answer is checked against.[[src:var]]</p>' } ],
      narration: [
        'The simplest correct program checks every run. For 9 seconds, how many does it examine? Choose an answer.',
        '45: nine possible ends from second 0, eight from second 1, down to one. Here is shortest naive: two loops, every start and every end, and it counts each pair so the cost is measured.',
        'Examining every start and end pair like this is called a pair scan: 45 pairs here, but about 200,010,000 at 20,000 seconds. It stays in the program as the reference.'
      ]
    },

    /* ---------- 7 · the appealing answer ---------- */
    {
      title: 'Two', layout: 'code', defines: ['two-pointer'],
      eyebrow: '07 · Writing the program · the appealing answer',
      heading: 'Grow the right edge, shrink the left',
      stand: 'Move the end forward one second at a time; while the run still reaches K without its first second, drop that second.',
      question: { step: 0, prompt: 'When does this grow-and-shrink method give a wrong answer?', options: [
        { text: 'When counts can be negative, as in net connections.', correct: true, why: 'Dropping a negative value raises the total, so the left edge stops too early.' },
        { text: 'When the log is very long.', correct: false, why: 'Length only makes it slower to read, not wrong. On non-negative counts it is right at any length.' },
        { text: 'When two seconds have the same count.', correct: false, why: 'Equal counts do not break it. The danger is a count below zero.' } ] },
      code: P.build({ before: [DATA, PREFIX, NAIVE], add: [TWO], step: 1 }),
      cards: [ { step: 2, title: 'Right only for its data', html: '<p>On −4, −6, −5, 4, 5, −2, −1, 0 with K = 5 it says None; the truth is 1. It also fails at K = 0. The assumption is in the data, not the code.[[src:var]]</p>' } ],
      narration: [
        'The appealing answer: move the end forward a second at a time, and while the run still reaches K without its first second, drop it. When does this go wrong? Choose an answer.',
        'When counts can be negative, like net connections opened minus closed. Here is shortest two pointer, named for its two edges. Its own comment says it is correct only for non-negative counts.',
        'The program found a stream where it says none and the truth is 1, and it also fails at K equal to 0. The assumption lives in the data, which is why it survives review.'
      ]
    },

    /* ---------- 8 · the increasing list ---------- */
    {
      title: 'List', layout: 'code', defines: ['increasing list', 'evict'],
      eyebrow: '08 · Writing the program · the answer',
      heading: 'For each total, the nearest earlier total at least K below it',
      stand: 'A run ending at position j reaches K when some earlier running total is at least K smaller. Keep a list of candidate starts.',
      question: { step: 0, prompt: 'An earlier running total is no smaller than a later one. Can the earlier one ever give the shortest run?', options: [
        { text: 'No: the later one is smaller and closer.', correct: true, why: 'A smaller start total reaches K at least as easily, and being closer it gives a shorter run.' },
        { text: 'Yes: it is further back, so its run is longer.', correct: false, why: 'Longer is worse here. We want the shortest run, so being further back is no help.' },
        { text: 'Only if the two totals are equal.', correct: false, why: 'Equal or larger, the later one wins: it is at least as good and closer.' } ] },
      code: P.build({ before: [DATA, PREFIX, NAIVE, TWO], add: [DEQ], step: 1 }),
      cards: [ { step: 2, title: 'The same argument, reversed', html: '<p>Throw such starts away: <b>evict</b> them. What is left is an <b>increasing list</b>. Part 4’s argument, “both better and newer”, with the order reversed, and no expiring at all.[[src:var]]</p>' } ],
      narration: [
        'A run ending at position j reaches K when an earlier running total is at least K smaller. If an earlier total is no smaller than a later one, can it ever give the shortest run? Choose an answer.',
        'No: the later one is smaller and closer. Here is shortest deque. Its front loop takes every usable start and keeps the shortest; its back loop evicts earlier totals that are no smaller than the new one.',
        'Throwing such starts away is evicting them, and what remains is an increasing list. It is the sliding maximum’s argument, better and newer, with the order reversed, and nothing expires on a schedule.'
      ]
    },

    /* ---------- 9 · watch the list for K = 22 ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '09 · Watch the list find K = 22',
      heading: 'Starts are used from the front, then thrown away',
      stand: 'Slots are positions 0 to 9 in the running totals. The list holds candidate start positions; the bottom row is the shortest run found so far.',
      array: {
        labelWidth: 170, slotLabel: 'position',
        rows: [
          { label: 'running total', values: PRE },
          { label: 'list after', values: trace.lists },
          { label: 'shortest so far', values: trace.bests }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [5] },
          { step: 3, do: 'show', rows: [2] },
          { step: 3, do: 'pick', slots: [9] }
        ]
      },
      cards: [
        { step: 2, title: 'Position 5', html: '<p>23 − 0 ≥ 22, so start 0 is used: a run of 5, and start 0 is dropped.[[src:var]]</p>' },
        { step: 3, title: 'Position 9', html: '<p>45 − 17 and 45 − 23 both reach 22; 9 − 5 = <b>4</b>. The list never holds more than 6.[[src:var]]</p>' }
      ],
      narration: [
        'The top row is the running totals, positions 0 to 9. The list will hold candidate start positions.',
        'Here is the list after each position. With all counts positive, the totals only grow, so nothing is evicted from the back; starts pile up until they become usable.',
        'At position 5 the total is 23. 23 minus the total at start 0 reaches 22, so start 0 is used, a run of 5, and dropped, because any later end would only be further from it.',
        'At position 9 the total is 45: starts 4 and 5 both reach 22, and 9 minus 5 is 4. The shortest is 4 seconds, and the list never held more than 6 entries.'
      ]
    },

    /* ---------- 10 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '10 · Writing the program · worked examples, as data',
      heading: 'Eighteen cases, each asserted',
      stand: 'Each row: what it exercises, the counts, K, and the answer expected. A function prints the table and checks every row.',
      question: { step: 0, prompt: 'For a single second, which costs less: the pair scan or the list?', options: [
        { text: 'The pair scan: 1 pair, against 4 list steps.', correct: true, why: 'The list has a fixed overhead. On tiny streams the simple program is cheaper, and the table says so.' },
        { text: 'The list, always: it is the better method.', correct: false, why: 'Better at scale, not everywhere. The table says the list loses on the tiny rows.' },
        { text: 'They cost exactly the same.', correct: false, why: 'They tie only at four seconds: 10 and 10.' } ] },
      code: P.build({ before: [DATA, PREFIX, NAIVE, TWO, DEQ], add: [INPUTS, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Honest about cost', html: '<p>Tie at 4 seconds (10 and 10); the list loses below that and wins above. The table also asserts the two-pointer is wrong on exactly 3 rows.[[src:var]]</p>' } ],
      narration: [
        'Next, worked examples written as data: eighteen rows, each with the answer expected. For a single second, which costs less, the pair scan or the list? Choose an answer.',
        'The pair scan: 1 pair against 4 list steps. Here are the example inputs, the table, and show examples, which runs every row through the list, the pair scan and the two-pointer.',
        'The two cost columns tie at four seconds, 10 and 10. Below that the list loses, and the table says so instead of hiding it. It also asserts the two-pointer is wrong on exactly three rows.'
      ]
    },

    /* ---------- 11 · the checks ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '11 · Writing the program · proving every answer',
      heading: 'Run it all, and find the two-pointer’s counter-example',
      stand: 'The last function prints each answer, tests idle seconds, searches for a stream where the two-pointer fails, and checks 400 random streams.',
      question: { step: 0, prompt: 'With idle seconds, equal running totals appear. Keeping both instead of evicting the older changes what?', options: [
        { text: 'Only how long the list gets, not the answer.', correct: true, why: 'The front loop tries every usable start and keeps the shortest, so a stale duplicate is harmless.' },
        { text: 'The answer: it reports a longer run.', correct: false, why: 'That was the first expectation, and the program measured that it does not happen.' },
        { text: 'Nothing at all.', correct: false, why: 'The list gets longer: 7 entries instead of 4, for a target of 15.' } ] },
      code: P.build({ before: [DATA, PREFIX, NAIVE, TWO, DEQ, INPUTS, EXAMPLES, SHOW], add: [MAIN], step: 1 }),
      cards: [ { step: 2, title: 'Space, not answers', html: '<p>K = 15 on the idle stream: 3 seconds either way; list length 4 with one comparison, 7 with the other.[[src:var]]</p>' } ],
      narration: [
        'The last piece runs everything. With idle seconds, equal running totals appear. Keeping both instead of evicting the older one changes what? Choose an answer.',
        'Only the length of the list. Here is main: it prints each target’s answer, compares the two comparisons on the idle stream, hunts for a stream that breaks the two-pointer, and checks 400 random streams.',
        'For K equal to 15 on the idle stream, the answer is 3 seconds either way, and the list holds 4 entries with one comparison and 7 with the other. The comparison buys space, not answers.'
      ]
    },

    /* ---------- 12 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '12 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. The long comment at the top defines every word before using it.',
        'From the top: the data, the example inputs and table, the running totals, the pair scan, the two-pointer, the increasing list, and main with its checks.'
      ]
    },

    /* ---------- 13 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '13 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch03_v2.py prints'),
      narration: [
        'Here is what the program prints. First the examples table: all 18 rows agree with the pair scan, with the list losing honestly on the tiny ones.',
        'Then the targets: 15 and 21 in 3 seconds, 22 in 4, and 999 reached by nothing. At 20,000 seconds the shortest run reaching 2000 is 80 seconds. All assertions passed.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you built',
      heading: 'Running totals, an increasing list, and an honest table',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>prefix</code>', 'running totals with a leading 0: any run is one subtraction', '0 … 45'] },
          { step: 0, cells: ['<code>shortest_naive</code>', 'the pair scan: every start, every end', '45 pairs'] },
          { step: 1, cells: ['<code>shortest_two_pointer</code>', 'grow and shrink; right only for non-negative counts and K ≥ 1', 'wrong on 3 rows'] },
          { step: 1, cells: ['<code>shortest_deque</code>', 'an increasing list of starts; evict the larger, earlier ones', 'K = 22 → 4'] },
          { step: 2, cells: ['<code>show_examples</code> · <code>main</code>', '18 rows and 400 random streams, all asserted', 'all pass'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 6 removes the window altogether: the next warmer day. The same eviction, but the evicted entries become the answers.[[src:var]]</p>' },
      narration: [
        'To recap. Prefix builds running totals with a leading zero, so any run is one subtraction. The pair scan tries every start and end: 45 pairs here.',
        'The two-pointer grows and shrinks, and is right only for non-negative counts and a target of at least 1. The increasing list evicts larger earlier totals, and finds 4 seconds for K equal to 22.',
        'The examples table and main assert every answer, including where the list honestly loses.',
        'Next, part 6 removes the window altogether: the next warmer day. Same eviction, but the evicted entries become the answers.'
      ]
    }
  ]
};
