// Chapter 9, Part 7 — Variation 4, "the unavailable hours", built as a program WITH the viewer.
// Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch09_v4.py (read at build time by _prog.js, addressed by content). The one pass is
// animated on the program's own calendar, and the narration is guarded by its .out.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch09';
const P = program('ch09_v4.py');
const OUT = program('ch09_v4.out');

// the pieces, in the order they are written
const DATA = P.span('#!/usr/bin/env python3', 'YEAR_MINUTES = 525_600');
const CALS = P.span('# Calendars for the examples table', 'BACK_TO_BACK =');
const TABLE = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const FREE = P.fn('free_spans');
const FORWARD = P.fn('free_spans_forward_cursor');
const UNSORTED = P.fn('free_spans_unsorted');
const WALK = P.fn('free_by_walking');
const MINUTES = P.fn('minutes');
const BUSY_IN = P.fn('busy_inside');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'reports availability, which is the failure a calendar cannot afford.');
const MAIN2 = P.span('# precondition two: the spans must arrive in order', 'all assertions passed');
const END = P.span('if __name__', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['BUSY   = [(1, 3), (130, 245), (540, 540)]', 'window = 0..600',
  'one pass        : [(0, 0), (4, 129), (246, 539), (541, 600)]', '(601 minutes examined)',
  '481 free minutes + 120 busy minutes = 601, the whole window',
  'max(cursor, e + 1) : [(101, 120)]   (correct)', 'cursor = e + 1     : [(21, 120)]   WRONG', 'so 80 minutes the person is busy for',
  'without the sort : [(0, 129), (246, 539), (541, 600)]   WRONG', 'skipped, so its 3',
  'adjacent spans: no gap between         2      0..10     1         3        11  [(8, 10)]',
  'one minute between: a gap              2      0..10     2         4        11  [(4, 4), (8, 10)]',
  '600 random calendars (354 of them with overlapping or nested spans)', 'forward-cursor version was wrong on 98 and the unsorted',
  'version on 267', 'per-minute walk : would ask 525,601 questions for the same answer', '262x the work',
  'all 17 examples partition their window and agree with the per-minute walk', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch09_v4.out no longer prints "${s}" — rewrite the narration`);

// the one pass over the chapter's calendar, step by step: the cursor, each gap, the tail
const BUSY = JSON.parse(OUT.lines.find(l => l.startsWith('BUSY   =')).split('=')[1].trim().replace(/\(/g, '[').replace(/\)/g, ']'));
const [LO, HI] = OUT.lines.find(l => l.startsWith('window =')).split('=')[1].trim().split('..').map(Number);
const PASS = [];
{ let cursor = LO;
  for (const [s, e] of BUSY) { const gap = s > cursor ? `${cursor}..${s - 1}` : 'none'; PASS.push({ span: `${s}..${e}`, before: cursor, gap }); cursor = Math.max(cursor, e + 1); PASS[PASS.length - 1].after = cursor; }
  PASS.push({ span: 'after the last', before: cursor, gap: cursor <= HI ? `${cursor}..${HI}` : 'none', after: '—' }); }
if (PASS.map(p => p.gap).join() !== '0..0,4..129,246..539,541..600' || LO !== 0 || HI !== 600)
  throw new Error('the one pass no longer produces the gaps the deck animates');

module.exports = {
  title: 'The Unavailable Hours',
  eyebrow: 'Streaming · Ch 9 · Part 7',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '..': ' to ' } },
  jargon: ['busy span', 'window', 'free span', 'closed', 'function', 'cursor', 'nested', 'per-minute walk', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 9 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 9 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 9 · the three variations')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['busy span', 'window', 'free span'],
      eyebrow: '01 · Variation 4 · the unavailable hours',
      heading: 'Three meetings. When is this person free?',
      hero: { step: 0, text: 'One person’s calendar holds three meetings, each a <b>busy span</b> of minutes: 1..3, 130..245 and 540..540. You are asked about the <b>window</b> from minute 0 to minute 600. Report every <b>free span</b>: each unbroken run of minutes in the window that no meeting covers.[[src:vars]]' },
      tiles: [
        { step: 1, value: 3, label: 'meetings' },
        { step: 1, value: 601, label: 'minutes in the window, 0 to 600' },
        { step: 2, value: 4, label: 'free spans' },
        { step: 2, value: 481, label: 'free minutes in all' }
      ],
      cardsLabel: 'What the interviewer asks',
      cards: [
        { step: 3, n: 1, title: 'The gaps, not the overlaps', text: 'The opposite of part 4’s question.' },
        { step: 3, n: 2, title: 'A year of minutes', text: '525,600 of them: no walking minute by minute.' },
        { step: 4, n: 3, title: 'Almost all edges', text: 'Before the first, between, after the last, and the empty cases.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'One person’s calendar holds three meetings, each a busy span of minutes: 1..3, 130..245 and 540..540. Report every free span inside the window from minute 0 to minute 600.',
        'Three meetings, and a window of 601 minutes, because both minute 0 and minute 600 count.',
        'The answer is 4 free spans, 481 free minutes in all. Keep both numbers; they check each other.',
        'This is the opposite of part 4: the gaps, not the overlaps. And a real calendar spans a year, 525,600 minutes, so you may not walk it minute by minute.',
        'There is no clever idea here. It is almost all edges: before the first meeting, between meetings, after the last, and the empty cases. We will write it together.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['closed'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Counting both ends',
      stand: 'A window from minute 0 to minute 10, and no meetings at all.',
      question: { step: 0, prompt: 'How many free minutes does the window 0..10 hold?', options: [
        { text: '11: minute 0 up to and including minute 10.', correct: true, why: 'Both ends count, so it is 10 minus 0, plus 1.' },
        { text: '10: the end minute minus the start minute.', correct: false, why: 'That leaves out one end. Count them: 0 to 10 inclusive is eleven minutes.' },
        { text: '9: only the minutes strictly between the ends.', correct: false, why: 'The window includes its own first and last minutes.' } ] },
      cards: [
        { step: 1, title: 'Closed at both ends', html: '<p>A span or window that includes both its first and last minute is <b>closed</b>. A meeting 130..245 holds minute 245; minute 246 is free.[[src:vars]]</p>' },
        { step: 2, title: 'So touching leaves no gap', html: '<p>Meetings 0..3 and 4..7 leave <b>no</b> gap: minutes 3 and 4 are next to each other. 0..3 and 5..7 leave a one-minute gap, 4..4.[[src:vars]]</p>' }
      ],
      narration: [
        'Try a small case first. A window from minute 0 to minute 10, with no meetings. How many free minutes is that? Choose an answer.',
        'Eleven: both ends count. A span that includes its first and last minute is called closed. A meeting 130..245 holds minute 245, and minute 246 is free.',
        'So meetings 0..3 and 4..7 leave no gap at all, because minutes 3 and 4 are neighbours. But 0..3 and 5..7 leave one free minute, minute 4.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '03 · Writing the program · the calendar',
      heading: 'A note, then three meetings and a window',
      stand: 'The file opens by defining every word, then holds the data.',
      question: { step: 0, prompt: 'A year holds 525,600 minutes. Should the program check each minute, one by one?', options: [
        { text: 'No: work from the few meetings, not every minute.', correct: true, why: 'Three meetings define the answer. Asking 525,601 questions to find a handful of gaps wastes almost all of them.' },
        { text: 'Yes: it is the simplest way, and a year is short.', correct: false, why: 'Simple, yes; it is kept as the checking reference. But it does work in step with the calendar’s length.' },
        { text: 'Yes, but checking only one minute in each hour.', correct: false, why: 'Sampling would miss short meetings, like 540..540, which lasts one minute.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch09_v4.py · the note and the data' }),
      cards: [ { step: 2, title: 'The chapter’s own spans', html: '<p><code>BUSY</code> is part 4’s first list as one person’s meetings. <code>START</code> and <code>END</code> are 0 and 600. <code>YEAR_MINUTES</code> is the scale the question names.[[src:vars]]</p>' } ],
      narration: [
        'First the data. A year holds 525,600 minutes. Should the program check each minute, one by one? Choose an answer.',
        'No: work from the meetings, not the minutes. Here are the opening lines: a note defining every word and working the answers out, then the busy spans, the window, and a year in minutes.',
        'Busy is part 4’s first list, read as one person’s meetings. Start and end are 0 and 600. Checking every minute is kept only as a reference, to test the real answer against.'
      ]
    },

    /* ---------- 4 · the examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '04 · Writing the program · the worked examples',
      heading: 'Seventeen calendars, each with its expected answer',
      stand: 'Each answer is a pair: how many free spans, and how many free minutes. A lost span changes the first; an off-by-one changes the second.',
      question: { step: 0, prompt: 'Window 0..10, meetings 0..3 and 4..7. What is the answer pair?', options: [
        { text: '1 span, 3 minutes: only 8..10 is free.', correct: true, why: 'The meetings touch, leaving nothing between them, and 8, 9 and 10 are free after them.' },
        { text: '2 spans, 4 minutes: one between, and 8..10.', correct: false, why: 'Minutes 3 and 4 are neighbours, so there is no gap between the meetings.' },
        { text: '1 span, 2 minutes: only 9..10 is free.', correct: false, why: 'The second meeting ends at 7, so minute 8 is already free.' } ] },
      code: P.build({ before: [DATA], add: [CALS, TABLE], step: 1 }),
      cards: [ { step: 2, title: 'Both numbers, on purpose', html: '<p>Busy throughout gives (0, 0): no free span, and the answer says so. A window whose start is after its end is empty: (0, 0), not an error. Two generated years test scale.[[src:vars]]</p>' } ],
      narration: [
        'Next, the examples. Window 0..10, meetings 0..3 and 4..7. What is the answer pair? Choose an answer.',
        'One span of 3 minutes: only 8..10. Here is the table: seventeen calendars, from none at all, through every edge, to two generated years of 525,600 minutes.',
        'A calendar busy throughout gives no free span, and says so rather than guessing one. And a window whose start comes after its end is simply empty, not an error.'
      ]
    },

    /* ---------- 5 · the one pass ---------- */
    {
      title: 'Pass', layout: 'code', defines: ['function', 'cursor'],
      eyebrow: '05 · Writing the program · one pass over the meetings',
      heading: 'A cursor on the first minute not yet accounted for',
      stand: 'Go through the meetings in order of start, carrying one number: the first minute you have not yet placed as busy or free.',
      question: { step: 0, prompt: 'The cursor is at minute 4; the next meeting is 130..245. What does the pass do?', options: [
        { text: 'Report 4..129 as free, then move the cursor to 246.', correct: true, why: 'Everything from the cursor up to the minute before the meeting is free; then the meeting’s minutes are placed as busy.' },
        { text: 'Report 4..130 as free, then move the cursor to 245.', correct: false, why: 'Minute 130 is busy, and so is 245. Off by one at both ends.' },
        { text: 'Move the cursor to 130 and report nothing.', correct: false, why: 'Then minutes 4 to 129 are never reported, though nobody is busy then.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE], add: [FREE], step: 1 }),
      cards: [ { step: 2, title: 'Two details', html: '<p>A <b>function</b> is a named recipe; the moving number is a <b>cursor</b>. It moves to <code>max(cursor, e + 1)</code>, never backwards. The free stretch after the last meeting is added outside the loop.[[src:vars]]</p>' } ],
      narration: [
        'Now the one pass. The cursor is at minute 4, and the next meeting is 130..245. What does the pass do? Choose an answer.',
        'Report 4..129 as free, then move the cursor to 246. Here is free spans, a function, or named recipe: it sorts the meetings, skips any outside the window, and reports each gap before a meeting.',
        'The moving number is called a cursor, and it moves to the larger of where it is and just past the meeting, so it never goes backwards. The stretch after the last meeting is added at the end.'
      ]
    },

    /* ---------- 6 · the pass, animated ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '06 · Watch the pass over the three meetings',
      heading: 'Four gaps from three meetings',
      stand: 'One column per meeting, then the tail. The cursor before, the gap reported, the cursor after.',
      array: {
        labelWidth: 170, slotLabel: 'step',
        rows: [
          { label: 'meeting', values: PASS.map(p => p.span) },
          { label: 'cursor before', values: PASS.map(p => p.before) },
          { label: 'free span reported', values: PASS.map(p => p.gap) },
          { label: 'cursor after', values: PASS.map(p => p.after) },
          { label: 'a gap?', values: PASS.map(p => (p.gap === 'none' ? 'no' : 'yes')) }
        ],
        meters: ['steps', 'free spans'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'show', rows: [4] },
          { step: 2, do: 'sweep', row: 4, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 600 },
          { step: 3, do: 'pick', slots: [0] }
        ]
      },
      columns: 2,
      cards: [
        { step: 2, title: '4 gaps, 481 minutes', html: '<p>0..0, 4..129, 246..539 and 541..600: 481 free minutes, and the 120 busy ones make 601, the whole window.[[src:vars]]</p>' },
        { step: 3, title: 'A one-minute gap', html: '<p>The first gap, 0..0, is a single minute before the first meeting. It must survive as a span, not vanish as “empty”.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the three meetings, then the tail, with the cursor before each step. It starts at 0.',
        'Each step reports the gap from the cursor to just before the meeting, then jumps past the meeting: 0..0, then 4..129, then 246..539. The tail adds 541..600.',
        'Watch the count: 4 steps, 4 free spans, 481 free minutes. Add the 120 busy minutes and you get 601, the whole window.',
        'And look at the first gap: minute 0 alone, before the first meeting. A one-minute gap must survive as a span, not vanish.'
      ]
    },

    /* ---------- 7 · question: why max ---------- */
    {
      title: 'Nest', layout: 'ask', defines: ['nested'],
      eyebrow: '07 · Your turn · the first hidden promise',
      heading: 'A meeting inside a longer one',
      stand: 'Meetings 0..100 and 10..20, window 0..120. After the first meeting the cursor is at 101.',
      question: { step: 0, prompt: 'If the cursor were simply set to “end + 1” after each meeting, where would it go after 10..20?', options: [
        { text: 'Back to 21, so minutes 21 to 100 are reported free.', correct: true, why: 'They are busy, inside 0..100. Moving the cursor backwards offers 80 busy minutes as free.' },
        { text: 'It stays at 101, because 10..20 is already covered.', correct: false, why: 'That is what the larger-of rule does. Plain “end + 1” sets it to 21.' },
        { text: 'Forward to 121, past the window.', correct: false, why: 'The second meeting ends at 20, so “end + 1” is 21, not 121.' } ] },
      cards: [
        { step: 1, title: 'Nested', html: '<p>A meeting entirely inside another is <b>nested</b>. The larger-of rule keeps the cursor from moving back: a minute known to be busy cannot become free.[[src:vars]]</p>' }
      ],
      narration: [
        'The first hidden promise. Meetings 0..100 and 10..20. If the cursor were simply set to end plus one, where would it go after 10..20? Choose an answer.',
        'Back to 21, so minutes 21 to 100, which are busy, are reported free: 80 minutes. A meeting inside another is called nested. Taking the larger of the two keeps the cursor from moving back.'
      ]
    },

    /* ---------- 8 · the forward-cursor version ---------- */
    {
      title: 'Fwd', layout: 'code',
      eyebrow: '08 · Writing the program · the version that gets written',
      heading: 'Run the broken version, rather than describe it',
      stand: 'On meetings that never overlap, the larger-of rule looks redundant. So people drop it.',
      question: { step: 0, prompt: 'For meetings 0..100 and 10..20 in window 0..120, what does the broken version report?', options: [
        { text: 'Free 21..120, where the truth is 101..120.', correct: true, why: 'The cursor moved back to 21, so the tail is reported from the wrong place.' },
        { text: 'Free 101..120, the same as the correct version.', correct: false, why: 'Only the larger-of rule gives that. Without it the cursor ends at 21.' },
        { text: 'Nothing free: the window looks fully booked.', correct: false, why: 'It errs the other way: too much free time, not too little.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE, FREE], add: [FORWARD], step: 1 }),
      cards: [ { step: 2, title: 'It still looks plausible', html: '<p>21..120 is a believable calendar entry. The output gives no sign that 80 of those minutes are busy.[[src:vars]]</p>' } ],
      narration: [
        'On meetings that never overlap, the larger-of rule looks redundant, so people drop it. For the nested meetings, what does that version report? Choose an answer.',
        'Free from 21 to 120, where the truth is 101 to 120. Here it is, identical except for one line: the cursor is set to end plus one.',
        'And 21..120 looks like a perfectly believable calendar entry. Nothing in the output says that 80 of those minutes are busy.'
      ]
    },

    /* ---------- 9 · the unsorted version ---------- */
    {
      title: 'Order', layout: 'code',
      eyebrow: '09 · Writing the program · the second hidden promise',
      heading: 'Meetings that arrive out of order',
      stand: 'A calendar merges meetings from several sources, so they may reach the program in a different order from the order they happen in the day: 130..245 first, then 1..3, then 540..540.',
      question: { step: 0, prompt: 'Without sorting, what happens to the meeting 1..3, read second?', options: [
        { text: 'It is skipped, and its busy minutes are reported free.', correct: true, why: 'After 130..245 the cursor is at 246. Nothing ever looks back at minutes 1 to 3.' },
        { text: 'It is handled correctly, because order does not matter.', correct: false, why: 'The one pass depends on the order. Only sorting first makes arrival order irrelevant.' },
        { text: 'The program notices the disorder and stops with an error.', correct: false, why: 'Nothing checks the order. It quietly gives a wrong answer.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE, FREE, FORWARD], add: [UNSORTED], step: 1 }),
      cards: [ { step: 2, title: 'Wrong in one place only', html: '<p>It reports 0..129, 246..539, 541..600: the 3 busy minutes of 1..3 offered as free, and the rest of the day still right — which is why a missing sort survives a review.[[src:vars]]</p>' } ],
      narration: [
        'The second hidden promise. Meetings may reach the program in a different order from the order they happen in. Without sorting, what happens to 1..3, read second? Choose an answer.',
        'The cursor is already past it, so it is skipped, and its minutes are reported free. Here is the version without the sort.',
        'It reports 0..129, then 246..539 and 541..600. Three busy minutes offered as free, and the rest of the day still right, which is exactly why a missing sort survives a review.'
      ]
    },

    /* ---------- 10 · question: the direction of error ---------- */
    {
      title: 'Way', layout: 'ask',
      eyebrow: '10 · Your turn',
      heading: 'Which way do both broken versions go wrong?',
      stand: 'The forward cursor and the missing sort, each on its own failing calendar.',
      question: { step: 0, prompt: 'When either broken version is wrong, in which direction is it wrong?', options: [
        { text: 'Always too much free time: busy minutes offered free.', correct: true, why: 'Both skip or forget busy minutes. Neither ever invents a busy minute.' },
        { text: 'Always too little free time: free minutes marked busy.', correct: false, why: 'That would be the safe direction for a calendar. These never err that way.' },
        { text: 'Either way, at random, depending on the calendar.', correct: false, why: 'Across 600 random calendars, every failure reported more free time than there was.' } ] },
      cards: [
        { step: 1, title: 'The failure a calendar cannot afford', html: '<p>Offering a busy hour as free means two meetings at once. Of 600 random calendars, the forward cursor was wrong on 98 and the missing sort on 267 — always in that direction.[[src:vars]]</p>' }
      ],
      narration: [
        'When either broken version is wrong, in which direction is it wrong? Choose an answer.',
        'Always too much free time. Offering a busy hour as free means someone is booked twice, the one failure a calendar cannot afford. Over 600 random calendars, 98 and 267 failures, all that way.'
      ]
    },

    /* ---------- 11 · the references ---------- */
    {
      title: 'Ref', layout: 'code', defines: ['per-minute walk'],
      eyebrow: '11 · Writing the program · the checks that cannot be fooled',
      heading: 'Walk every minute, and make the totals add up',
      stand: 'Two independent checks for any answer.',
      question: { step: 0, prompt: 'Which single check catches an off-by-one at either end of a free span?', options: [
        { text: 'Free minutes plus busy minutes equal the whole window.', correct: true, why: 'A one-minute slip moves a minute from one total to the other, so the sum no longer matches: 481 and 120 make 601.' },
        { text: 'The number of free spans matches the expected count.', correct: false, why: 'An off-by-one keeps the same number of spans; it only shifts their edges.' },
        { text: 'Each free span lies inside the window it was asked about.', correct: false, why: 'An off-by-one span can still lie inside the window, so this catches nothing.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE, FREE, FORWARD, UNSORTED], add: [WALK, MINUTES, BUSY_IN], step: 1 }),
      cards: [ { step: 2, title: 'The reference', html: '<p>The <b>per-minute walk</b> asks of every minute: busy or not? Too slow to ship, but it cannot have an off-by-one, which makes it the right yardstick. 601 questions here.[[src:vars]]</p>' } ],
      narration: [
        'Which single check catches an off-by-one at either end of a free span? Choose an answer.',
        'Free minutes plus busy minutes must equal the whole window: 481 plus 120 makes 601. Here are three functions: the walk, a minute counter, and busy inside, which counts busy minutes once each.',
        'The walk asks of every minute whether it is busy, and groups the free runs. Too slow to ship, but it cannot have an off-by-one, so it is the right yardstick. Here, 601 questions.'
      ]
    },

    /* ---------- 12 · the table's checks ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assert'],
      eyebrow: '12 · Writing the program · checking every row',
      heading: 'Three ways for each calendar',
      stand: 'The table’s answers must be proved, not trusted.',
      question: { step: 0, prompt: 'Why compare against the per-minute walk only when the window is short?', options: [
        { text: 'The walk asks one question per minute: too many for a year.', correct: true, why: 'That is its whole weakness. Short windows can afford it; the year rows rely on the other checks.' },
        { text: 'Because the walk gives wrong answers on long windows.', correct: false, why: 'It is right on any window; it is only slow on long ones.' },
        { text: 'Because long windows are rare and need no checking.', correct: false, why: 'They are still checked: the pair, and free plus busy equal to the whole window.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE, FREE, FORWARD, UNSORTED, WALK, MINUTES, BUSY_IN], add: [SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Assert', html: '<p>An <b>assert</b> stops the program if its claim is false. Each row: the expected pair; free plus busy equal to the window; and the walk, wherever the window is at most 2,000 minutes.[[src:vars]]</p>' } ],
      narration: [
        'Why compare against the per-minute walk only when the window is short? Choose an answer.',
        'Because the walk asks one question per minute, too many for a year. Here is show examples: it prints the table and checks each calendar.',
        'An assert stops the program if its claim is false. Each row checks the expected pair, that free plus busy equals the whole window, and the walk, wherever the window is short enough.'
      ]
    },

    /* ---------- 13 · main ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · running everything',
      heading: 'The day, two traps, 600 random calendars and a year',
      stand: 'The last function runs every case and asserts the results.',
      question: { step: 0, prompt: 'A year with 2,000 meetings: how much more work is the per-minute walk than the one pass?', options: [
        { text: 'About 262 times: 525,601 questions against 2,000.', correct: true, why: 'The walk grows with the calendar’s length; the pass grows with the number of meetings.' },
        { text: 'About the same: both look at every minute of the year.', correct: false, why: 'The pass never looks at a minute. It reads only the 2,000 meetings.' },
        { text: 'About twice as much: two questions for every meeting.', correct: false, why: 'The walk asks 525,601 questions; the pass reads 2,000 meetings. That is far more than twice.' } ] },
      code: P.build({ before: [DATA, CALS, TABLE, FREE, FORWARD, UNSORTED, WALK, MINUTES, BUSY_IN, SHOW], add: [MAIN1, MAIN2, END], step: 1 }),
      cards: [ { step: 2, title: 'What main proves', html: '<p>The day’s 4 gaps; both broken versions failing; fifteen edge cases; 600 random calendars, 354 with overlapping or nested meetings, all matching the walk; and a year: 2,001 free spans.[[src:vars]]</p>' } ],
      narration: [
        'The last function, main, runs everything. For a year with 2,000 meetings, how much more work is the per-minute walk than the one pass? Choose an answer.',
        'About 262 times: 525,601 questions against 2,000 meetings. Here is main: the day, both broken versions, the edges, 600 random calendars, and the year.',
        'Of the 600 random calendars, 354 had overlapping or nested meetings, and the one pass matched the walk on every one. The year gives 2,001 free spans from 2,000 meetings.'
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
        'From the top: the note and the calendars, the one pass, the two broken versions, the references, and the checks.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch09_v4.py prints'),
      narration: [
        'Here is what it prints: the seventeen-row table first, then the calendar, its four gaps, and 481 plus 120 making 601.',
        'Then the nested meeting and the out-of-order meetings, both broken versions marked wrong, the edges, the random calendars, the year, and all assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Gaps are all edges',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>free_spans</code>', 'sort, then one cursor: report the gap before each meeting, and the tail', '4 spans, 481 minutes'] },
          { step: 1, cells: ['<code>free_spans_forward_cursor</code>', 'drops the larger-of rule: a nested meeting moves the cursor back', '21..120, not 101..120'] },
          { step: 1, cells: ['<code>free_spans_unsorted</code>', 'drops the sort: a late meeting is skipped', '3 busy minutes free'] },
          { step: 2, cells: ['<code>free_by_walking</code>', 'one question per minute: slow, and the yardstick', '601 questions'] },
          { step: 2, cells: ['<code>busy_inside</code>', 'free plus busy must be the whole window', '481 + 120 = 601'] }
        ]
      },
      side: { step: 3, title: 'Next · part 8', html: '<p>Back to adverts: the chapter’s system design, a click stream joined with an impression stream, built one component at a time.</p>' },
      narration: [
        'To recap. Free spans sorts the meetings, carries one cursor, and reports the gap before each meeting and the tail after the last: 4 spans, 481 minutes.',
        'The two broken versions each drop one hidden promise, the larger-of rule or the sort, and both offer busy minutes as free.',
        'The per-minute walk is the slow yardstick, and free plus busy equal to the whole window catches an off-by-one at either end.',
        'Next, part 8: back to adverts, and the chapter’s system design, a click stream joined with an impression stream, one component at a time.'
      ]
    }
  ]
};
