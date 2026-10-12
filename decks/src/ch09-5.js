// Chapter 9, Part 5 — Variation 2, "the double-booked room", built as a program WITH the
// viewer. Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch09_v2.py (read at build time by _prog.js, addressed by content). The failing
// two-pointer rule and the event sweep are animated on the program's own printed values.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch09';
const P = program('ch09_v2.py');
const OUT = program('ch09_v2.out');

// the pieces, in the order they are written
const DATA = P.span('#!/usr/bin/env python3', 'NONE = None');
const ROOMS = P.span('# Rooms for the examples table', 'BIG_STACK   =');
const TABLE = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const OVERLAP = P.fn('overlap_of');
const EVERY = P.fn('every_pair');
const TWO = P.fn('two_pointer_against_itself');
const MARKS = P.fn('marks_of');
const SWEEP = P.fn('event_sweep');
const CROSS = P.fn('cross_by_events');
const CROSS_REF = P.fn('every_cross_pair');
const COVER = P.fn('covering');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'the same data, with the two lists poured into one.');
const MAIN2 = P.span('the chapter\'s sweep, run rather than dismissed', 'too many.  It under-reports');
const MAIN3 = P.span('the sweep\'s count, checked instant by instant', 'all assertions passed');
const END = P.span('if __name__', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['BOOKINGS = [(1, 3), (50, 150), (130, 245), (220, 320), (540, 540)]   (5 bookings, closed spans)',
  "every pair  : [(1, 2, '130..150'), (2, 3, '220..245')]   (10 comparisons)",
  'event sweep : busiest 2 bookings at t=130, 2 overlapping pairs   (10 marks)',
  "two-pointer sweep of the list against itself: [(1, 2, '130..150'), (2, 3, '220..245')]",
  'with a workshop from 140 to 230 added: [(1, 3), (50, 150), (130, 245), (140, 230), (220, 320), (540, 540)]',
  'event sweep : busiest 3 at t=140, 5 pairs   (12 marks)', 'two-pointer : 4 pairs   WRONG', 'it finds 4 of 5 and misses 140..150',
  'touching at 10: a clash (boundary)          2       4            1        2     10          1',
  'adjacent at 11: free (boundary)             2       4            1        1      0          0',
  "finds [('L1', 'R0', '130..150'), ('L1', 'R1', '220..245')]", '415 lists had a clash, 185 were clean',
  'at 20,000 bookings, each overlapping the next: busiest 2 at t=5, 19,999 pairs', 'The quadratic answer would need 199,990,000 comparisons',
  'all 12 examples agree with a direct per-instant count', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch09_v2.out no longer prints "${s}" — rewrite the narration`);

// the marks the program prints for the five bookings, and the running count over them
const MARK_LIST = JSON.parse(OUT.lines.find(l => l.trim().startsWith('marks   =')).split('=')[1].trim().replace(/\(/g, '[').replace(/\)/g, ']'));
const LIVE = MARK_LIST.reduce((acc, [, d]) => acc.concat((acc.length ? acc[acc.length - 1] : 0) + d), []);
// the room with the workshop, every pair that clashes, and the one the two-pointer rule misses
const SHOP = JSON.parse(OUT.lines.find(l => l.includes('with a workshop from 140 to 230 added:')).split('added:')[1].trim().replace(/\(/g, '[').replace(/\)/g, ']'));
const SHOP_PAIRS = SHOP.flatMap((x, i) => SHOP.slice(i + 1).map((y, k) => ({ i, j: i + 1 + k, lo: Math.max(x[0], y[0]), hi: Math.min(x[1], y[1]) })))
  .filter(p => p.hi >= p.lo);
const MISSED = '140..150';
if (MARK_LIST.length !== 10 || Math.max(...LIVE) !== 2 || MARK_LIST[LIVE.indexOf(2)][0] !== 130 || LIVE[LIVE.length - 1] !== 0
  || SHOP_PAIRS.length !== 5 || !SHOP_PAIRS.some(p => `${p.lo}..${p.hi}` === MISSED && p.i === 1 && p.j === 3))
  throw new Error('programs/ch09_v2.out no longer prints the marks and pairs this deck animates');

module.exports = {
  title: 'The Double-Booked Room',
  eyebrow: 'Streaming · Ch 9 · Part 5',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'NONE': 'none', '..': ' to ' } },
  jargon: ['booking', 'closed', 'clash', 'busiest moment', 'function', 'comparison', 'cursor', 'mark', 'live',
    'running count', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 9 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 9 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 9 · the three variations')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['booking', 'clash', 'busiest moment'],
      eyebrow: '01 · Variation 2 · the double-booked room',
      heading: 'One meeting room, five bookings. Which ones clash?',
      hero: { step: 0, text: 'A meeting room has a list of <b>bookings</b>, each a start and an end in minutes, sorted by start: 1..3, 50..150, 130..245, 220..320 and 540..540. Two bookings that hold the room at the same minute <b>clash</b>. Report how many are in the room at the <b>busiest moment</b>, which minute that is, and how many pairs clash.[[src:vars]]' },
      tiles: [
        { step: 1, value: 5, label: 'bookings in our room' },
        { step: 1, value: 2, label: 'pairs that clash[[src:vars]]' },
        { step: 2, value: 130, label: 'the busiest minute, with 2 in the room' },
        { step: 2, value: 10, label: 'start-and-end notes the good answer reads' }
      ],
      cardsLabel: 'What is different from part 4',
      cards: [
        { step: 3, n: 1, title: 'One list, not two', text: 'The chapter’s two lists poured into one room.' },
        { step: 3, n: 2, title: 'It overlaps itself', text: 'The promise part 4 relied on is gone.' },
        { step: 4, n: 3, title: 'Up to a million bookings', text: 'So trying every pair is still out of the question.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A meeting room has a list of bookings, each a start and an end in minutes, sorted by start. Two bookings that hold the room at the same minute clash.',
        'Our room has 5 bookings: 1..3, 50..150, 130..245, 220..320 and 540..540. Two pairs of them clash.',
        'The busiest moment is minute 130, with 2 bookings in the room. The good answer finds all this by reading just 10 short notes, one at each start and each end.',
        'This is part 4’s data, the two lists poured into one room. And now the list overlaps itself: the promise part 4’s method relied on is gone.',
        'A room may have up to a million bookings, so trying every pair is still out of the question. We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['closed'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Two bookings that touch',
      stand: 'One booking runs from minute 0 to minute 10, the next from minute 10 to minute 20. Each holds the room at its start and at its end.',
      question: { step: 0, prompt: 'Do the bookings 0..10 and 10..20 clash?', options: [
        { text: 'Yes: both hold the room at minute 10.', correct: true, why: 'The first holds minute 10 as its end, the second as its start. One shared minute is a clash.' },
        { text: 'No: one ends exactly as the other starts.', correct: false, why: 'That would be true if an end did not count. Here a booking holds its end minute too.' },
        { text: 'Only if they are made by different people.', correct: false, why: 'Who booked does not matter. Two bookings in the same minute is a clash either way.' } ] },
      cards: [
        { step: 1, title: 'Closed spans', html: '<p>A booking that holds both its start and its end minute is <b>closed</b>. So 0..10 and 10..20 clash, while 0..10 and 11..20 do not: the two sides of one boundary.[[src:vars]]</p>' }
      ],
      narration: [
        'Try a small case first. One booking runs from minute 0 to 10, the next from 10 to 20, and each holds the room at its start and its end. Do they clash? Choose an answer.',
        'Yes: both hold minute 10. A booking that holds both its start and end minute is called closed. So 0..10 and 10..20 clash, but 0..10 and 11..20 do not.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '03 · Writing the program · the room',
      heading: 'A note, then the bookings',
      stand: 'The file opens by defining its words and working the answers out, then holds the data.',
      question: { step: 0, prompt: 'Why does the program also keep a sixth booking, a workshop from 140 to 230?', options: [
        { text: 'To put three bookings in the room at once, as the five never do.', correct: true, why: 'On the five bookings the wrong method happens to work. A third simultaneous booking is what exposes it.' },
        { text: 'To make the example a little larger, and so harder to solve.', correct: false, why: 'Size is not the point. One booking is added for one exact reason.' },
        { text: 'Because the five bookings on their own do not overlap at all.', correct: false, why: 'They do: two pairs clash. But never more than two at a time.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch09_v2.py · the note and the data' }),
      cards: [ { step: 2, title: 'Two rooms', html: '<p><code>BOOKINGS</code> is the five; <code>WITH_WORKSHOP</code> adds 140..230. <code>LEFT</code> and <code>RIGHT</code> are kept to check the new method on part 4’s own question.[[src:vars]]</p>' } ],
      narration: [
        'First the data. The program keeps the five bookings, and a sixth: a workshop from 140 to 230. Why? Choose an answer.',
        'To put three bookings in the room at once, which the five never do. Here are the opening lines: a long note defining every word and working the answers out, then the data.',
        'Bookings holds the five. With workshop adds the sixth. And left and right, part 4’s two lists, are kept so that the new method can be checked on the old question too.'
      ]
    },

    /* ---------- 4 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '04 · Writing the program · the worked examples',
      heading: 'Twelve rooms, each with its expected answer',
      stand: 'Each row is a room, what it tests, and the answer: how many at the busiest moment, which minute, how many clashing pairs.',
      question: { step: 0, prompt: 'Four identical bookings, all 0..10. How many clashing pairs?', options: [
        { text: '6: every pair of the four clashes.', correct: true, why: 'Four bookings make 6 pairs, and each pair shares every minute. The count is of pairs, not of bookings.' },
        { text: '4: one for each booking.', correct: false, why: 'A clash is between two bookings. Four bookings make 6 different pairs.' },
        { text: '3: each booking clashes with the next.', correct: false, why: 'The first also clashes with the third and the fourth. All 6 pairs share the room.' } ] },
      code: P.build({ before: [DATA], add: [ROOMS, TABLE], step: 1 }),
      cards: [ { step: 2, title: 'The rows are asserted', html: '<p>An empty room has no busiest moment at all: None, not minute 0. Two generated rooms test scale: 20,000 bookings in a chain, and 2,000 over one instant.[[src:vars]]</p>' } ],
      narration: [
        'Next, the worked examples. One row is four identical bookings, all 0..10. How many clashing pairs is that? Choose an answer.',
        'Six: every pair of the four clashes. Here is the table: twelve rooms, from an empty room to two generated rooms, each with the answer it must produce.',
        'Notice the empty room: it has no busiest moment at all, so the answer is none, not minute 0. Naming a minute would claim somebody was in the room.'
      ]
    },

    /* ---------- 5 · the obvious answer ---------- */
    {
      title: 'Slow', layout: 'code', defines: ['function', 'comparison'],
      eyebrow: '05 · Writing the program · the answer everyone gives first',
      heading: 'Try every pair of bookings',
      stand: 'The same rule as part 4 for where two spans meet: the later start to the earlier end.',
      question: { step: 0, prompt: 'Five bookings in one list. How many pairs must every-pair test?', options: [
        { text: '10: each booking against every later one.', correct: true, why: '4, then 3, then 2, then 1 more: 10 in all. Each pair once, never a booking against itself.' },
        { text: '25: every booking against every booking.', correct: false, why: 'That tests each pair twice, and each booking against itself.' },
        { text: '5: one test for each of the five bookings.', correct: false, why: 'A test needs two bookings. Five bookings make 10 pairs.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE], add: [OVERLAP, EVERY], step: 1 }),
      cards: [ { step: 2, title: 'The yardstick', html: '<p>A <b>function</b> is a named recipe; each test of a pair is a <b>comparison</b>. 10 here, but at a million bookings, 5 × 10¹¹. Too slow to use — and still the reference everything is checked against.[[src:vars]]</p>' } ],
      narration: [
        'Now the answer everyone gives first. Five bookings in one list: how many pairs must be tested? Choose an answer.',
        'Ten: each booking against every later one. Here are two functions, named recipes: overlap of, the same rule as before, and every pair, which tests each pair once.',
        'Each test of a pair is a comparison: 10 here, but about 5 hundred thousand million at a million bookings. Too slow to use, but it stays as the yardstick every other answer is checked against.'
      ]
    },

    /* ---------- 6 · the two-pointer rule, tried ---------- */
    {
      title: 'Try2', layout: 'code', defines: ['cursor'],
      eyebrow: '06 · Writing the program · part 4’s sweep, pointed at one list',
      heading: 'Run it, rather than dismiss it',
      stand: 'Part 4 moved two fingers, called cursors, along two lists, always past the span that ends first. Here both cursors walk the same list.',
      question: { step: 0, prompt: 'On the five bookings, does that two-cursor rule find both clashes?', options: [
        { text: 'Yes, by luck: each booking overlaps only its neighbour.', correct: true, why: 'The five form a chain, so passing the span that ends first never skips anything — here.' },
        { text: 'No: it misses one of the two clashes in the room.', correct: false, why: 'Surprisingly, it finds both. That is what makes it dangerous.' },
        { text: 'No: it reports a clash between bookings that is not real.', correct: false, why: 'It never invents a clash. When it fails, it reports too few.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY], add: [TWO], step: 1 }),
      cards: [ { step: 2, title: 'The worst kind of right', html: '<p>It finds 130..150 and 220..245 — the right answer, though the promise that made the rule safe is gone. Nothing in the output says so.[[src:vars]]</p>' } ],
      narration: [
        'Part 4 moved two cursors along two lists. Here both cursors walk the same list. On the five bookings, does that rule find both clashes? Choose an answer.',
        'Yes, by luck. Here is the function, run rather than dismissed. The five bookings form a chain, each overlapping only its neighbour, so passing the span that ends first skips nothing.',
        'It gets the right answer, which is the worst thing it could do: the promise that licensed the rule is gone, and the output does not say so. So add the workshop.'
      ]
    },

    /* ---------- 7 · the workshop breaks it, animated ---------- */
    {
      title: 'Break', layout: 'array',
      eyebrow: '07 · Watch the workshop break the two-cursor rule',
      heading: 'Three in the room at once: one clash is lost',
      stand: 'With the workshop 140..230 added, every pair that clashes, and whether the two-cursor rule finds it.',
      array: {
        labelWidth: 170, slotLabel: 'pair',
        rows: [
          { label: 'bookings', values: SHOP_PAIRS.map(p => `${SHOP[p.i][0]}..${SHOP[p.i][1]} · ${SHOP[p.j][0]}..${SHOP[p.j][1]}`) },
          { label: 'clash', values: SHOP_PAIRS.map(p => `${p.lo}..${p.hi}`) },
          { label: 'two-cursor finds it?', values: SHOP_PAIRS.map(p => (`${p.lo}..${p.hi}` === MISSED ? 'no' : 'yes')) }
        ],
        meters: ['real clashes', 'found by the two-cursor rule'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 },
          { step: 2, do: 'pick', slots: [SHOP_PAIRS.findIndex(p => `${p.lo}..${p.hi}` === MISSED)] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: '4 of 5', html: '<p>Every pair finds 5 clashes. The two-cursor rule finds 4, and the program prints WRONG.[[src:vars]]</p>' },
        { step: 2, title: 'Why 140..150 is lost', html: '<p>After comparing 50..150 with 130..245, it moves past 50..150 — which still clashed with the workshop. It under-reports, so nobody is warned.[[src:vars]]</p>' }
      ],
      narration: [
        'With the workshop added, here is every pair that clashes: five of them, with the minutes they share.',
        'And whether the two-cursor rule finds each one. Watch the count: 5 real clashes, 4 found.',
        'The missing one is 50..150 against the workshop, minutes 140 to 150. The rule moved past 50..150 too early. It only ever reports too few, so a double-booking is simply never raised.'
      ]
    },

    /* ---------- 8 · the marks ---------- */
    {
      title: 'Marks', layout: 'code', defines: ['mark', 'live'],
      eyebrow: '08 · Writing the program · stop thinking in spans',
      heading: 'Every booking becomes two events: a start and an end',
      stand: 'Instead of pairing bookings, write down each moment the room count changes, and sort all of them together.',
      question: { step: 0, prompt: 'The booking 130..245 holds minute 245. Where should its “one fewer in the room” mark go?', options: [
        { text: 'At 246, the first minute it no longer holds.', correct: true, why: 'The booking is still in the room at 245, so the count must drop only after it, at 246.' },
        { text: 'At 245, the last minute that it holds.', correct: false, why: 'Then a booking starting at 245 would look free, though both hold minute 245.' },
        { text: 'At 130, the minute where it starts.', correct: false, why: 'That is where it enters. Leaving and entering at the same minute would cancel out.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY, TWO], add: [MARKS], step: 1 }),
      cards: [ { step: 2, title: 'Marks', html: '<p>A <b>mark</b> is (minute, +1) where a booking starts or (end + 1, −1) just after it ends. A booking is <b>live</b> at a minute it holds. Sorting puts −1 before +1 at the same minute.[[src:vars]]</p>' } ],
      narration: [
        'The way out is to stop thinking in spans. Each booking becomes two events. The booking 130..245 holds minute 245: where should its one-fewer mark go? Choose an answer.',
        'At 246, the first minute it no longer holds. Here is marks of: for each booking, a plus one at its start, and a minus one just after its end. Then all of them are sorted together.',
        'Each of these is called a mark. A booking is live at a minute it holds. At the same minute, sorting puts the minus ones first, so a booking ending at 129 and one starting at 130 never clash.'
      ]
    },

    /* ---------- 9 · the running count, animated ---------- */
    {
      title: 'Count', layout: 'array', defines: ['running count'],
      eyebrow: '09 · Watch the marks being read in order',
      heading: 'A running count rises and falls',
      stand: 'The ten marks of the five bookings, as the program prints them, in sorted order.',
      array: {
        labelWidth: 150, slotLabel: 'mark',
        rows: [
          { label: 'minute', values: MARK_LIST.map(m => m[0]) },
          { label: 'change', values: MARK_LIST.map(m => m[1]) },
          { label: 'live after it', values: LIVE }
        ],
        meters: ['marks read', 'live now'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: LIVE.map((v, i) => (v === 2 ? i : -1)).filter(i => i >= 0) }
        ]
      },
      columns: 2,
      cards: [
        { step: 2, title: 'The busiest moment', html: '<p>The count reaches <b>2</b> at minute 130 and again at 220, never more. The first time is the busiest moment: 130.[[src:vars]]</p>' },
        { step: 3, title: 'Pairs come free', html: '<p>A booking that starts clashes with everything already live. Add the count at each start: 1 at minute 130, 1 at 220, so <b>2</b> pairs — no booking ever compared with another.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the ten marks, sorted: the minute, and the change, plus one or minus one.',
        'Watch a running count read them in order, adding each change. Keeping one total as you go like this is called a running count. It rises and falls, and ends at zero.',
        'The live count reaches 2 at minute 130 and again at 220, and never more. The first time it peaks is the busiest moment: minute 130.',
        'And clashing pairs come free. A booking that starts clashes with everything already live: 1 at minute 130, 1 at 220. Two pairs, without comparing any two bookings.'
      ]
    },

    /* ---------- 10 · the event sweep ---------- */
    {
      title: 'Sweep', layout: 'code',
      eyebrow: '10 · Writing the program · the event sweep',
      heading: 'One pass over the marks',
      stand: 'Now write it: a running count, its maximum, and a pair tally.',
      question: { step: 0, prompt: 'When a booking’s start mark is read, how many new clashing pairs does it add?', options: [
        { text: 'As many as are live just before it.', correct: true, why: 'It clashes with exactly those bookings, each pair counted once, at the later start.' },
        { text: 'Always exactly one, whatever is live.', correct: false, why: 'With the workshop, the booking at 220 arrives while two others are live, and clashes with both.' },
        { text: 'None, until its own end mark is read.', correct: false, why: 'The clash exists from the minute it starts. Waiting for the end changes nothing but the timing.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY, TWO, MARKS], add: [SWEEP], step: 1 }),
      cards: [ { step: 2, title: '2 at 130, 2 pairs', html: '<p><code>event_sweep(BOOKINGS)</code>: busiest 2 at minute 130, 2 pairs, from 10 marks. With the workshop: 3 at minute 140, 5 pairs, from 12 marks — none missed.[[src:vars]]</p>' } ],
      narration: [
        'Now write it. When a booking’s start mark is read, how many new clashing pairs does it add? Choose an answer.',
        'As many as are live just before it. Here is event sweep: for each mark, a start adds the live count to the pairs; then the count changes, and its highest value is remembered with its minute.',
        'On the five bookings: busiest 2 at minute 130, and 2 pairs, from 10 marks. With the workshop: 3 at minute 140, and all 5 pairs, from 12 marks. Nothing is missed.'
      ]
    },

    /* ---------- 11 · the chapter's question, by events ---------- */
    {
      title: 'Cross', layout: 'code',
      eyebrow: '11 · Writing the program · the old question, the new method',
      heading: 'The event sweep answers part 4’s question too',
      stand: 'Part 4 asked for overlaps between two lists. Can marks answer that?',
      question: { step: 0, prompt: 'How can the event sweep find only overlaps between the two lists, not within one?', options: [
        { text: 'Tag each mark with its list; pair only across the two lists.', correct: true, why: 'Then two spans from the same list are never paired, and each cross pair is recorded once.' },
        { text: 'Run it on each list separately, then subtract the two.', correct: false, why: 'Each list alone has no overlaps at all. Subtracting nothing from nothing finds nothing.' },
        { text: 'It cannot: two lists always need two cursors, one each.', correct: false, why: 'Marks do not care how many lists there are; a tag is enough.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY, TWO, MARKS, SWEEP], add: [CROSS, CROSS_REF], step: 1 }),
      cards: [ { step: 2, title: 'More general, more costly', html: '<p>It finds L1 with R0 on 130..150 and L1 with R1 on 220..245: part 4’s answer. Nothing was given up except the two-cursor rule’s speed.[[src:vars]]</p>' } ],
      narration: [
        'Part 4 asked for overlaps between two lists. How can the event sweep find only those, not overlaps within one list? Choose an answer.',
        'Tag each mark with its list, and pair a start only with live spans of the other list. Here it is, with its own slow reference that tests every cross pair.',
        'It finds 130..150 and 220..245, part 4’s own answer. So the event sweep is strictly more general; what it gives up is only the two-cursor rule’s speed.'
      ]
    },

    /* ---------- 12 · the checks ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assert'],
      eyebrow: '12 · Writing the program · checking every row',
      heading: 'Is the busiest moment really that busy?',
      stand: 'The table’s answers must be proved, not trusted.',
      question: { step: 0, prompt: 'How can the program prove that 2 bookings really are live at minute 130?', options: [
        { text: 'Count, directly, the bookings that hold minute 130.', correct: true, why: 'A plain count at one minute uses none of the sweep’s logic, so it cannot share its mistakes.' },
        { text: 'Run the event sweep a second time and compare.', correct: false, why: 'A second run repeats any mistake the first one made.' },
        { text: 'Trust the table, since it was written out by hand.', correct: false, why: 'The table is what is being checked. Something independent has to check it.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY, TWO, MARKS, SWEEP, CROSS, CROSS_REF], add: [COVER, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Assert', html: '<p>An <b>assert</b> stops the program if its claim is false. Every row is asserted against the table, against a direct count, and where affordable against every pair.[[src:vars]]</p>' } ],
      narration: [
        'How can the program prove that 2 bookings really are live at minute 130? Choose an answer.',
        'Count, directly, the bookings that hold minute 130. Here is covering, that direct count, and show examples, which prints the table and checks every row.',
        'An assert stops the program if its claim is false. Each row is asserted against its expected answer, against the direct count, and, where affordable, against every pair.'
      ]
    },

    /* ---------- 13 · main ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · running everything',
      heading: 'The room, the workshop, and twenty thousand bookings',
      stand: 'The last function runs every method on every room, and asserts the results.',
      question: { step: 0, prompt: 'At 20,000 bookings in a chain, how do the marks compare with every pair’s comparisons?', options: [
        { text: '40,000 marks against 199,990,000 comparisons.', correct: true, why: 'Two marks per booking, against every pair of 20,000 bookings: about five thousand times as many.' },
        { text: '40,000 marks against about 40,000 comparisons.', correct: false, why: 'Every pair grows with the square of the bookings, not in step with them.' },
        { text: '20,000 marks against 20,000 comparisons.', correct: false, why: 'Each booking makes two marks, and pairs vastly outnumber bookings.' } ] },
      code: P.build({ before: [DATA, ROOMS, TABLE, OVERLAP, EVERY, TWO, MARKS, SWEEP, CROSS, CROSS_REF, COVER, SHOW], add: [MAIN1, MAIN2, MAIN3, END], step: 1 }),
      cards: [ { step: 2, title: 'What main proves', html: '<p>The two-cursor rule passes on five bookings and fails with the workshop; the count is checked at all 541 minutes; and 600 random rooms agree with every pair — 415 with a clash, 185 clean.[[src:vars]]</p>' } ],
      narration: [
        'The last function, main, runs everything. At 20,000 bookings in a chain, how do the marks compare with every pair’s comparisons? Choose an answer.',
        '40,000 marks, against 199,990,000 comparisons. Here is main: the room, the two-cursor rule passing and then failing, the direct count, the old question, the boundaries, random rooms, and the scale.',
        'It checks the live count at all 541 minutes, and 600 random rooms against every pair: 415 had a clash and 185 were clean. The two-cursor rule never invented a clash; it only missed them.'
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
        'Here is the whole program, exactly as the chapter runs it. Scroll through it: you have seen each piece written, and why.',
        'From the top: the note and the rooms, every pair, the failing two-cursor rule, the marks, the event sweep, the two-list version, and the checks.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch09_v2.py prints'),
      narration: [
        'Here is what it prints: the twelve-row table first, each with what it costs in marks against comparisons, then the five bookings and their ten marks.',
        'Then the two-cursor rule right by luck, and wrong with the workshop; the direct count; the old question; and at the end, all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Stop pairing spans; count marks',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>every_pair</code>', 'tests every pair: the slow yardstick', '10 comparisons'] },
          { step: 0, cells: ['<code>two_pointer_against_itself</code>', 'part 4’s rule on one list: right by luck, wrong with three live', '4 of 5 with the workshop'] },
          { step: 1, cells: ['<code>marks_of</code>', '+1 at a start, −1 just after an end, all sorted', '10 marks'] },
          { step: 1, cells: ['<code>event_sweep</code>', 'running count: its peak, its minute, and pairs at each start', '2 at minute 130, 2 pairs'] },
          { step: 2, cells: ['<code>cross_by_events</code>', 'the same sweep, answering part 4’s two-list question', '130..150, 220..245'] }
        ]
      },
      side: { step: 3, title: 'Next · part 6', html: '<p>Adverts this time: match each click to the nearest impression before it — and learn why answering at once can lose the match entirely.[[src:vars]]</p>' },
      narration: [
        'To recap. Every pair is the slow yardstick. Part 4’s two-cursor rule, pointed at one list, is right by luck on five bookings and wrong once three are live at once.',
        'The fix is to stop pairing spans: write a mark at each start and just after each end, sort them, and keep a running count. Its peak is the busiest moment, and pairs come free.',
        'And the same sweep, with each mark tagged by its list, answers part 4’s two-list question as well.',
        'Next, part 6: adverts and clicks, matching each click to the nearest impression before it, and why answering at once can lose the match.'
      ]
    }
  ]
};
