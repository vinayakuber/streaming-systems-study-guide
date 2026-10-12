// Chapter 9, Part 4 — the Google interview question, built as a program WITH the viewer.
// Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch09.py (read at build time by _prog.js, addressed by content, never by line
// number). The sweep is animated on the program's own trace; the last slides show the whole
// file and what it actually prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch09';
const P = program('ch09.py');
const OUT = program('ch09.out');

// the pieces, in the order they are written
const DATA = P.span('#!/usr/bin/env python3', 'NONE = None');
const OVERLAP = P.fn('overlap_of');
const EVERY = P.fn('every_pair');
const SWEEP = P.fn('sweep');
const DROP = P.fn('droppable');
const VARS = P.span('# The three variations.', 'return free');
const MAIN1 = P.span('def main():', 'closed intervals touch at a point');
const MAIN2 = P.span('    bound = RIGHT[-1][0]', 'and a finished stream may drop all of it');
const VMAIN = P.span('    # variations', 'a span covering the window');
const RAND = P.span('    # brute force over many inputs', 'all assertions passed');
const END = P.span('if __name__', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['LEFT  = [(1, 3), (130, 245), (540, 540)]', 'RIGHT = [(50, 150), (220, 320)]',
  'i=0 j=0  (1, 3) vs (50, 150)  ->  NONE     advance left', 'i=1 j=0  (130, 245) vs (50, 150)  ->  130..150 advance right',
  'i=1 j=1  (130, 245) vs (220, 320)  ->  220..245 advance left', 'i=2 j=1  (540, 540) vs (220, 320)  ->  NONE     advance right',
  'every pair : [(130, 150), (220, 245)]   (3 x 2 = 6 comparisons)', 'sweep      : [(130, 150), (220, 245)]   (4 comparisons)',
  'with a bound of 220 on how late RIGHT may be: droppable [(1, 3)], kept [(130, 245), (540, 540)]',
  'double-booked room: busiest 2 at t=5, 2 overlapping pairs', 'unavailable hours: free [(0, 129), (246, 539), (541, 600)]',
  '800 random span-list pairs', '697 exercised both advance directions', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch09.out no longer prints "${s}" — rewrite the narration`);

// the sweep's four steps, as the program prints them
const TRACE = OUT.lines.filter(l => /^\s+i=\d j=\d/.test(l)).map(l => {
  const m = l.match(/i=(\d) j=(\d)\s+(\(.*?\)) vs (\(.*?\))\s+->\s+(\S+)\s+advance (\w+)/);
  return { i: m[1], j: m[2], x: m[3].replace(/[() ]/g, '').replace(',', '..'), y: m[4].replace(/[() ]/g, '').replace(',', '..'), o: m[5], adv: m[6] };
});
if (TRACE.length !== 4) throw new Error('programs/ch09.out no longer prints a 4-step sweep trace');

const SAY = { 'NONE': 'none', 'LEFT': 'left', 'RIGHT': 'right', '..': ' to ' };

module.exports = {
  title: 'The Overlap Sweep',
  eyebrow: 'Streaming · Ch 9 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, ...SAY } },
  jargon: ['span', 'overlap', 'sorted', 'stream', 'closed', 'function', 'comparison', 'cursor', 'event time',
    'processing time', 'lateness bound', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 9 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 9 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 9 · the three variations'),
    whole: section(CH, 'The whole program', 'Chapter 9 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 9 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['span', 'overlap', 'sorted', 'stream'],
      eyebrow: '01 · A Google interview question',
      heading: 'Two lists of busy stretches. Where do they overlap?',
      hero: { step: 0, text: 'A <b>span</b> is a stretch of time with a start and an end, like 130..245 seconds after noon. You get two lists of spans, each <b>sorted</b> by start, and within a list no two spans share a moment. Report every <b>overlap</b>: each stretch covered by a span of the first list and a span of the second.[[src:prob]]' },
      tiles: [
        { step: 1, value: 3, label: 'spans in the first list[[src:prob]]' },
        { step: 1, value: 2, label: 'spans in the second list[[src:prob]]' },
        { step: 2, value: 2, label: 'overlaps: 130..150 and 220..245[[src:prob]]' },
        { step: 2, value: 4, label: 'pair tests the good answer needs[[src:trace]]' }
      ],
      cardsLabel: 'What the interviewer asks',
      cards: [
        { step: 3, n: 1, title: 'Every overlap', text: 'Between a span on the left and a span on the right.' },
        { step: 3, n: 2, title: 'A million spans each', text: 'So trying every pair is out of the question.' },
        { step: 4, n: 3, title: 'Then: they never stop arriving', text: 'Both lists are streams. What may you throw away?' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'A span is a stretch of time with a start and an end. You get two lists of spans, each sorted by start, and within one list no two spans share a moment. Report every overlap between the two lists.',
        'Our example is small: 3 spans in the first list, 1..3, 130..245 and 540..540, and 2 in the second, 50..150 and 220..320. All in seconds after noon.',
        'There are 2 overlaps: 130..150 and 220..245. The good answer finds them testing just 4 pairs. Keep both numbers in mind; the program must reach them.',
        'The interviewer wants every overlap, and says each list may hold a million spans, so trying every pair is out of the question.',
        'Then the twist: both lists are streams, events that keep arriving with no end. What may you throw away? We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Two spans, by hand',
      stand: 'The span 130..245 from the first list, and the span 50..150 from the second.',
      question: { step: 0, prompt: 'Where do 130..245 and 50..150 overlap?', options: [
        { text: 'From 130 to 150: the later start to the earlier end.', correct: true, why: 'Both spans cover every moment from 130 up to 150, and no other moment.' },
        { text: 'From 50 to 245: the earlier start to the later end.', correct: false, why: 'That is everything either span covers. At 60, only one of them is busy.' },
        { text: 'Nowhere: one starts after the other one does.', correct: false, why: 'Starting later is fine, as long as it starts before the other ends. 130 is before 150.' } ] },
      cards: [
        { step: 1, title: 'One rule for both questions', html: '<p>Start = the later start, end = the earlier end. If that comes out backwards, there is no overlap at all. One rule answers “do they?” and “where?”[[src:model]]</p>' },
        { step: 2, title: 'Where the lists come from', html: '<p>The first list is a visitor’s busy stretches of clicks; the second is each advert showing widened by 60 seconds. Both come from the book’s one dataset.[[src:whole]]</p>' }
      ],
      narration: [
        'Try a small case first. The span 130..245 from the first list, and 50..150 from the second. Where do they overlap? Choose an answer.',
        'From 130 to 150: the later of the two starts, to the earlier of the two ends. If that comes out backwards, there is no overlap at all. One rule answers both whether and where.',
        'By the way, these spans come from the book’s one dataset: the first list is a visitor’s busy stretches of clicks, and the second is each advert showing, widened by 60 seconds.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['closed'],
      eyebrow: '03 · Writing the program · the two lists',
      heading: 'Start with the spans themselves',
      stand: 'A program is written top to bottom. First, a note saying what it solves; then the data.',
      question: { step: 0, prompt: 'How should the program hold one list of spans?', options: [
        { text: 'A list of (start, end) pairs, sorted by start.', correct: true, why: 'It keeps each span whole, and keeps the order the problem promised, which the fast answer relies on.' },
        { text: 'Two separate lists, one of starts and one of ends.', correct: false, why: 'That works, but every step would have to keep the two lists lined up by hand for no gain.' },
        { text: 'A list of every second each span covers.', correct: false, why: 'The span 130..245 alone would become over a hundred entries, and a million spans far too many.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch09.py · the problem and the data' }),
      cards: [ { step: 2, title: 'Three names', html: '<p><code>LEFT</code> and <code>RIGHT</code> hold the two lists. <code>NONE</code> means “these two spans do not overlap”. Spans are <b>closed</b>: 130..245 includes both 130 and 245.[[src:prob]]</p>' } ],
      narration: [
        'First, the data. How should the program hold one list of spans? Choose an answer.',
        'A list of start and end pairs, sorted by start. Here are the opening lines: a note restating the problem, then left and right, the two lists, and how many spans each holds.',
        'Two details. None is the answer for two spans that do not overlap. And spans are closed: 130..245 includes both 130 and 245 themselves.'
      ]
    },

    /* ---------- 4 · the geometry ---------- */
    {
      title: 'Meet', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · where two spans meet',
      heading: 'One expression answers “do they?” and “where?”',
      stand: 'Every other piece will lean on this one, so it is written first.',
      question: { step: 0, prompt: 'Two spans x and y. When does the program report no overlap?', options: [
        { text: 'When the earlier end comes before the later start.', correct: true, why: 'Then the “overlap” would run backwards: there is no moment both spans cover.' },
        { text: 'When the two spans start at different times.', correct: false, why: '130..245 and 50..150 start at different times, and still overlap on 130..150.' },
        { text: 'When one span is longer than the other.', correct: false, why: 'Length has nothing to do with it. A short span inside a long one overlaps it completely.' } ] },
      code: P.build({ before: [DATA], add: [OVERLAP], step: 1 }),
      cards: [ { step: 2, title: 'A function', html: '<p>A <b>function</b> is a named recipe: inputs in, an answer out. <code>overlap_of</code>: <code>lo</code> is the later start, <code>hi</code> the earlier end; if <code>hi &lt; lo</code>, NONE.[[src:whole]]</p>' } ],
      narration: [
        'Next, where two spans meet. Given two spans, when does the program report no overlap? Choose an answer.',
        'When the earlier end comes before the later start. Here it is: low is the later of the two starts, high the earlier of the two ends, and if high is below low, there is no overlap.',
        'This is a function: a named recipe that takes inputs and gives back an answer. Its name is overlap of. Everything that follows uses it.'
      ]
    },

    /* ---------- 5 · the obvious answer ---------- */
    {
      title: 'Slow', layout: 'code', defines: ['comparison'],
      eyebrow: '05 · Writing the program · the answer everyone gives first',
      heading: 'Try every pair',
      stand: 'Correct, simple, and the baseline every faster answer is checked against.',
      question: { step: 0, prompt: 'Trying every left span against every right span, how many tests is that here?', options: [
        { text: '6: three left spans times two right spans.', correct: true, why: 'Every pair is tested once: 3 times 2 makes 6.' },
        { text: '5: one test per span, across both of the lists.', correct: false, why: 'A test needs one span from each list. Five spans make six such pairs.' },
        { text: '2: one test per overlap that is in the lists.', correct: false, why: 'You only learn there are 2 overlaps after testing every pair.' } ] },
      code: P.build({ before: [DATA, OVERLAP], add: [EVERY], step: 1 }),
      cards: [ { step: 2, title: 'Impossible, not slow', html: '<p>Each test of a pair is one <b>comparison</b>. 6 here, for 2 overlaps. With a million spans in each list it is a million million: not slow, impossible. And it never used the sorted order.[[src:model]]</p>' } ],
      narration: [
        'Now the answer everyone gives first: try every pair. How many tests is that here? Choose an answer.',
        'Six: three left spans, each against two right spans. Here is every pair: two loops, one inside the other, counting each test and keeping the overlaps.',
        'Each test of a pair is a comparison. Six of them here. But with a million spans in each list, it is a million million comparisons: not slow, impossible. And the sorted order was never used.'
      ]
    },

    /* ---------- 6 · the sweep ---------- */
    {
      title: 'Sweep', layout: 'code', defines: ['cursor'],
      eyebrow: '06 · Writing the program · one pass over both lists',
      heading: 'Two fingers, and one rule for which moves',
      stand: 'Put one finger on the first span of each list. Compare the two spans, then move one finger forward.',
      question: { step: 0, prompt: 'After comparing two spans, which finger moves forward?', options: [
        { text: 'The one on whichever span ends first.', correct: true, why: 'That span cannot overlap anything further along the other list, so it is finished with.' },
        { text: 'The one on whichever span starts first.', correct: false, why: 'A span that starts first may end last and still overlap the next span. Moving it would skip an overlap.' },
        { text: 'Always the one on the first list.', correct: false, why: 'Then 50..150 would be compared again and again while 220..320 waited. It skips overlaps too.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY], add: [SWEEP], step: 1 }),
      cards: [ { step: 2, title: 'Cursors', html: '<p><code>i</code> and <code>j</code> are the two fingers, called <b>cursors</b>. Each comparison moves exactly one, so there are at most 3 + 2 comparisons, not 3 × 2.[[src:model]]</p>' } ],
      narration: [
        'Now the reframe. One finger on each list. After comparing two spans, which finger moves forward? Choose an answer.',
        'The one on whichever span ends first. That span cannot overlap anything further along the other list, because the other list is sorted and its spans never overlap each other.',
        'The two fingers, i and j, are called cursors. Each comparison moves exactly one of them, so there are at most 3 plus 2 comparisons, rather than 3 times 2. Let us watch it run.'
      ]
    },

    /* ---------- 7 · the sweep, animated ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '07 · Watch the sweep, step by step',
      heading: 'Four comparisons, two overlaps',
      stand: 'Each column is one comparison, exactly as the program prints it.',
      array: {
        labelWidth: 150, slotLabel: 'step',
        rows: [
          { label: 'left span', values: TRACE.map(t => t.x) },
          { label: 'right span', values: TRACE.map(t => t.y) },
          { label: 'overlap', values: TRACE.map(t => t.o) },
          { label: 'cursor that moves', values: TRACE.map(t => t.adv) },
          { label: 'found one?', values: TRACE.map(t => (t.o === 'NONE' ? 'no' : 'yes')) }
        ],
        meters: ['comparisons', 'overlaps found'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'show', rows: [4] },
          { step: 2, do: 'sweep', row: 4, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 600 },
          { step: 3, do: 'pick', slots: [1, 2] }
        ]
      },
      columns: 2,
      cards: [
        { step: 2, title: '4 against 6', html: '<p>The same 2 overlaps as every pair, in 4 comparisons instead of 6. One comparison found nothing at all, and still counts.[[src:trace]]</p>' },
        { step: 3, title: 'One span, two overlaps', html: '<p>130..245 produces <b>both</b> overlaps, so the loop must never assume one overlap per span.[[src:model]]</p>' }
      ],
      narration: [
        'Here are the four comparisons. First 1..3 against 50..150, then 130..245 against 50..150, then 130..245 against 220..320, then 540..540 against 220..320.',
        'The overlaps: none, 130..150, 220..245, none. And the cursor that moves: left, right, left, right. Each time it is the span that ends first.',
        'Watch the count. 4 comparisons, 2 overlaps found: the same answer as every pair, in 4 comparisons instead of 6. One comparison found nothing, and it still counts.',
        'And look at steps 1 and 2: the same left span, 130..245, produces both overlaps. So the loop must never assume one overlap per span.'
      ]
    },

    /* ---------- 8 · question: why the rule is sound ---------- */
    {
      title: 'Why', layout: 'ask',
      eyebrow: '08 · Your turn · why the rule is safe',
      heading: 'Is 1..3 really finished with?',
      stand: 'The first comparison was 1..3 against 50..150, and the left cursor moved past 1..3 for good.',
      question: { step: 0, prompt: 'Why can no later right span overlap 1..3?', options: [
        { text: 'Every later right span starts after 50, long after 1..3 ends at 3.', correct: true, why: 'The right list is sorted and never overlaps itself, so everything after 50..150 starts later still.' },
        { text: 'Because 1..3 is short, and short spans rarely overlap.', correct: false, why: 'Length proves nothing. The guarantee comes from the order of the other list.' },
        { text: 'Because the sweep looks at each span once, so it cannot check again.', correct: false, why: 'That is what the sweep does, not why it is allowed to. The reason is the sorted, non-overlapping other list.' } ] },
      cards: [
        { step: 1, title: 'Both promises matter', html: '<p>Sorted, <b>and</b> never overlapping itself. The second is easy to read past as scene-setting, but it is what makes “ends first means finished” true.[[src:trace]]</p>' }
      ],
      narration: [
        'Why is it safe to move past 1..3 for good? Choose an answer.',
        'Every later right span starts after 50, long after 1..3 ends at 3. The right list is sorted and never overlaps itself; that second promise is what makes ends first mean finished.'
      ]
    },

    /* ---------- 9 · the streaming half ---------- */
    {
      title: 'Drop', layout: 'code', defines: ['event time', 'processing time', 'lateness bound'],
      eyebrow: '09 · Writing the program · the twist: both lists are streams',
      heading: 'What may be forgotten, when more is still coming?',
      stand: 'Now the spans arrive one by one, forever, and some arrive late. Every event has two clocks: when it happened, and when it arrived.',
      question: { step: 0, prompt: 'The cursor has moved past 1..3. May the program forget it now?', options: [
        { text: 'Only if promised that nothing still to come could reach it.', correct: true, why: 'A right span that overlaps 1..3 might simply not have arrived yet. Only a promise about the future makes forgetting safe.' },
        { text: 'Yes: the sweep has passed it, so it is finished with for good.', correct: false, why: 'That held for finished lists. A stream may still deliver a span that overlaps it.' },
        { text: 'No: a stream must keep every span it has ever seen, for ever.', correct: false, why: 'Then memory grows for as long as the system runs. With a promise, some spans can safely go.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY, SWEEP], add: [DROP], step: 1 }),
      cards: [ { step: 2, title: 'Two clocks, and a promise', html: '<p>When a span happened is its <b>event time</b>; when it arrived, its <b>processing time</b>. A declared limit on how far behind a stream may be is a <b>lateness bound</b>: “nothing still to come starts before 220”. Then every left span ending before 220 may go.[[src:model]]</p>' } ],
      narration: [
        'Now the twist: both lists are streams, and spans can arrive late. The cursor has moved past 1..3. May the program forget it now? Choose an answer.',
        'Only with a promise about the future. Here is droppable: given such a promise, a bound, it keeps only the left spans that end at or after the bound. Without one, nothing may be dropped.',
        'Every event has two clocks: when it happened, its event time, and when it arrived, its processing time. A declared limit on how far behind a stream may be is called a lateness bound.'
      ]
    },

    /* ---------- 10 · the checks, part one ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assert'],
      eyebrow: '10 · Writing the program · proving the sweep',
      heading: 'Run both answers, and make them agree',
      stand: 'The last function runs everything, prints it, and checks it.',
      question: { step: 0, prompt: 'What should the sweep’s answer be checked against?', options: [
        { text: 'The every-pair answer, which is slow but plainly right.', correct: true, why: 'Every pair has no clever idea to get wrong, so it is the yardstick for the clever one.' },
        { text: 'Nothing: the sweep is clearly correct by its reasoning.', correct: false, why: 'Reasoning can hide an off-by-one. A check against a simpler answer catches it.' },
        { text: 'A second copy of the sweep, run twice.', correct: false, why: 'A copy repeats any mistake the original has, so it proves nothing.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY, SWEEP, DROP], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Assert', html: '<p>An <b>assert</b> line stops the program if its claim is false. Here: same 2 overlaps both ways, 6 against 4 comparisons, each cursor moved, and neither list overlaps itself.[[src:whole]]</p>' } ],
      narration: [
        'The final function, main, runs everything and checks it. What should the sweep’s answer be checked against? Choose an answer.',
        'The every-pair answer, slow but plainly right. Here is the first part of main: it prints both lists, runs both answers, prints the sweep step by step, and compares.',
        'Each assert line stops the program if its claim is false: the same 2 overlaps both ways, 6 against 4 comparisons, each cursor moved at least once, and neither list overlapping itself.'
      ]
    },

    /* ---------- 11 · the checks, part two ---------- */
    {
      title: 'Bound', layout: 'code',
      eyebrow: '11 · Writing the program · proving what may be dropped',
      heading: 'A bound of 220 on how late the right side may be',
      stand: 'The program takes its bound from the last right span’s start: 220.',
      question: { step: 0, prompt: 'With a promise that nothing still to come on the right starts before 220, which left spans may go?', options: [
        { text: 'Only 1..3: the other two end at or after 220.', correct: true, why: '130..245 runs past 220 and 540..540 is later still, so a new right span could overlap either.' },
        { text: '1..3 and 130..245: both start before 220.', correct: false, why: 'What matters is where a span ends. 130..245 is still busy at 220.' },
        { text: 'None of them: a stream can never drop anything.', correct: false, why: 'With a promise, it can. Without one, it cannot; that is the difference the bound makes.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY, SWEEP, DROP, MAIN1], add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Both edges asserted', html: '<p>Bound 220: drop 1..3, keep 130..245 and 540..540. With no promise at all, nothing may go; with a finished stream, everything may. The bound must be the <b>smaller</b> of both sides’ promises.[[src:trace]]</p>' } ],
      narration: [
        'The program takes its bound from the start of the last right span: 220. With that promise, which left spans may go? Choose an answer.',
        'Only 1..3. 130..245 is still busy at 220, and 540..540 is later still. Here are the lines: they drop 1..3, keep the other two, and assert it.',
        'And both edges are asserted: with no promise at all, nothing may go; with a finished stream, everything may. The bound must be the smaller of the two sides’ promises, since one silent stream blocks both.'
      ]
    },

    /* ---------- 12 · the three variations ---------- */
    {
      title: 'Vars', layout: 'code',
      eyebrow: '12 · Writing the program · the same idea in three other clothes',
      heading: 'Three variations, each its own part next',
      stand: 'The same file carries three related questions: a double-booked room, a click matched to an advert, and the free hours in a calendar.',
      question: { step: 0, prompt: 'One room’s bookings can overlap each other. Why does the two-cursor rule fail there?', options: [
        { text: 'Its safety rested on spans in a list never overlapping each other.', correct: true, why: 'Without that promise, “ends first means finished” is false, and the sweep would miss clashes.' },
        { text: 'Because there is only one list, and two cursors need two lists.', correct: false, why: 'That is the visible difference, but the reason is the missing promise, not the count of lists.' },
        { text: 'It does not fail: the same sweep works unchanged.', correct: false, why: 'Three bookings live at once break it. The room needs a different method.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY, SWEEP, DROP, MAIN1, MAIN2], add: [VARS], step: 1 }),
      cards: [ { step: 2, title: 'Three functions', html: '<p>The room counts starts and ends instead of pairing spans; the click waits for a late advert; the calendar reports the gaps. Parts 5, 6 and 7 build each one.[[src:vars]]</p>' } ],
      narration: [
        'The file also carries three variations. In one, a single room’s bookings can overlap each other. Why does the two-cursor rule fail there? Choose an answer.',
        'Its safety rested on spans in a list never overlapping each other. Here are the three functions: the double-booked room, the attributed click, and the unavailable hours.',
        'The room counts starts and ends instead of pairing spans; the click must wait for a late advert; the calendar reports the gaps. Parts 5, 6 and 7 build each one with you.'
      ]
    },

    /* ---------- 13 · the last checks ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '13 · Writing the program · checks beyond the one example',
      heading: 'The variations, and 800 random lists',
      stand: 'One example can pass by luck. The last lines test many more.',
      question: { step: 0, prompt: 'Why run the sweep on 800 randomly made pairs of lists too?', options: [
        { text: 'One example can pass by luck; many cases catch what it misses.', correct: true, why: 'Each random case is checked against every pair, so a rare mistake has hundreds of chances to show.' },
        { text: 'To measure how fast the sweep runs over many lists of spans.', correct: false, why: 'Nothing here is timed. Each case is checked for the right answer.' },
        { text: 'Because the example data itself might have been typed wrong.', correct: false, why: 'The example is asserted separately. The random cases test the method, not the data.' } ] },
      code: P.build({ before: [DATA, OVERLAP, EVERY, SWEEP, DROP, MAIN1, MAIN2, VARS], add: [VMAIN, RAND, END], step: 1 }),
      cards: [ { step: 2, title: '800 cases', html: '<p>Each random pair of lists: sweep equals every pair, never more comparisons than the two lengths added; 697 of them move both cursors. The gaps and the room are checked against slow answers too.[[src:whole]]</p>' } ],
      narration: [
        'The last checks. Why also run the sweep on 800 randomly made pairs of lists? Choose an answer.',
        'One example can be right by luck. Here are the final lines: each variation’s answer asserted, then 800 random cases, each checked against the slow every-pair answer.',
        'In all 800, the sweep matches every pair and never needs more comparisons than the two list lengths added. 697 of them move both cursors. Then the program says all assertions passed.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have now seen each piece written, and why.',
        'From the top: the data, where two spans meet, every pair, the sweep, what may be dropped, the three variations, and the checks at the end.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch09.py prints'),
      narration: [
        'And here is what it prints. The two lists, the sweep’s four steps, both answers with their counts, 6 comparisons against 4, and what a bound of 220 lets you drop.',
        'Then each variation’s answer, the 800 random cases, and the last line: all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Where, which, and what to forget',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>overlap_of</code>', 'later start to earlier end, or none if backwards', '130..150'] },
          { step: 0, cells: ['<code>every_pair</code>', 'tests every pair: the slow yardstick', '6 comparisons'] },
          { step: 1, cells: ['<code>sweep</code>', 'two cursors; advance the span that ends first', '4 comparisons'] },
          { step: 2, cells: ['<code>droppable</code>', 'what may be forgotten, given a lateness bound', 'bound 220: drop 1..3'] },
          { step: 2, cells: ['<code>main</code>', 'runs everything and asserts it, plus 800 random cases', 'all passed'] }
        ]
      },
      side: { step: 3, title: 'Next · part 5', html: '<p>One list this time: bookings for one room, which may overlap each other. The two-cursor rule no longer applies. What does?[[src:vars]]</p>' },
      narration: [
        'To recap. Overlap of takes the later start and the earlier end, or none. Every pair tests all 6 pairs, and is the slow yardstick.',
        'The sweep moves two cursors and advances the span that ends first: 4 comparisons for the same 2 overlaps.',
        'Droppable answers the streaming half: with a lateness bound of 220, only 1..3 may be forgotten. And main asserts everything, including 800 random cases.',
        'Next, part 5: one list of room bookings that may overlap each other, where the two-cursor rule no longer applies.'
      ]
    }
  ]
};
