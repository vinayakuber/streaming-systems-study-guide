// Chapter 4, Part 5 — Variation 2 of the interview question, "the calendar that will not
// double-book", built as a program WITH the viewer. Every code slide asks what the next piece
// must do, then reveals the real lines of programs/ch04_v2.py (read by _prog.js, addressed by
// content). The last slides show the whole file and what it prints (programs/ch04_v2.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch04';
const P = program('ch04_v2.py');
const OUT = program('ch04_v2.out');

// the nine requests and their verdicts, read from the program and its output
const REQS = OUT.lines.filter(l => /^\s+\d+\.\.\d+\s+(ACCEPTED|REJECTED)/.test(l)).map(l => {
  const [, s, e, v] = l.match(/^\s+(\d+)\.\.(\d+)\s+(\S+)/);
  return { span: `${s}..${e}`, ok: v === 'ACCEPTED' };
});

// the pieces, in the order they are written
const DATA = P.span('# Nine booking requests, in the order', 'CANCEL_START = 90');
const INPUTS = P.span("# The chapter's nine requests as an operation stream", 'BIG_TWICE = BIG_BOOKINGS');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const CLASH = P.fn('clashes');
const VIEW = P.fn('merged_view');
const GAPS = P.fn('free_gaps');
const MEMBER = P.fn('run_member_calendar');
const MERGED = P.fn('run_merged_calendar');
const GRID = P.fn('occupied_minutes');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'in the day.")');
const MAIN2 = P.span('    # ---- the cancellation, which', 'that the merged shape cannot represent.');
const MAIN3 = P.span('    # ---- a span-carrying cancel', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 21 examples agree with the per-minute grid', '3..33   REJECTED  clashes with [(1, 31)]',
  'held      : [(1, 31), (50, 80), (90, 130), (130, 160), (245, 275), (540, 570)]',
  'busy view : [(1, 31), (50, 80), (90, 160), (245, 275), (540, 570)]',
  'per-minute grid: 190 minutes busy + 410 free = 600 in the day.',
  'members   -> busy [(1, 31), (50, 80), (130, 160), (245, 275), (540, 570)]',
  'merged/drop -> busy [(1, 31), (50, 80), (245, 275), (540, 570)]',
  'merged/keep -> busy [(1, 31), (50, 80), (90, 160), (245, 275), (540, 570)]',
  'keep never offers [(80, 130)] as one gap -- the freed 40 minutes are unbookable forever.',
  'booking 95..125 afterwards: members ACCEPT, merged/keep REJECTS,',
  "wrong on 35 with 'drop' and 492 with 'keep'.", 'on 300 append-only sequences it is never wrong at all',
  'first and last minute of a 100,000 day             2    2  [(0, 1), (99999, 100000)]      2   99998      2   100000',
  'three holds in a 2-minute day (grid wins)          3    3                   [(0, 2)]      2       0      3        2',
  'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch04_v2.out no longer prints "${s}" — rewrite the narration`);
if (REQS.length !== 9 || REQS.filter(r => r.ok).length !== 6 || REQS[2].span !== '90..130' || REQS[3].span !== '130..160' || !REQS[3].ok)
  throw new Error('programs/ch04_v2.out no longer has the requests this deck explains — rewrite the narration');

module.exports = {
  title: 'The Booking Calendar',
  eyebrow: 'Streaming · Ch 4 · Part 5',
  ...shared,
  jargon: ['minute', 'booking', 'clash', 'half-open', 'list', 'function', 'block', 'free gap', 'cancel', 'grid'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 4 · three other ways'),
    model: section(CH, 'How to model it', 'Chapter 4 · how to model it'),
    prob:  section(CH, 'The problem', 'Chapter 4 · the original problem')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['minute', 'booking', 'cancel'],
      eyebrow: '01 · Variation 2 of the interview question',
      heading: 'A calendar that must never double-book a room',
      hero: { step: 0, text: 'A meeting room’s day runs from 09:00 to 19:00. Times are counted in <b>minutes</b> from 09:00, so the day is minutes 0 to 600. A <b>booking</b> asks for the room from one minute to another. Requests come in the order people send them, not in the order of the meetings, and each must be accepted or refused as it arrives.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'booking requests[[src:vars]]' },
        { step: 1, value: 600, label: 'minutes in the day' },
        { step: 2, value: 6, label: 'requests accepted' },
        { step: 2, value: 190, label: 'minutes busy, 410 free' }
      ],
      cardsLabel: 'What the calendar must do',
      cards: [
        { step: 3, n: 1, title: 'Refuse any booking that overlaps', text: 'Two meetings in one room is the failure.' },
        { step: 3, n: 2, title: 'Show the busy time and what is still free', text: 'So people can see what is left.' },
        { step: 4, n: 3, title: 'Allow a cancel', text: '“Cancel my 90” removes the meeting that starts at minute 90. The hard one.' }
      ],
      note: { step: 4, text: 'The door log of part 4 with new nouns. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A meeting room is open from 9 in the morning to 7 in the evening. Times are counted in minutes from 9, so the day is minutes 0 to 600. A booking asks for the room from one minute to another.',
        'Nine booking requests arrive, in the order people send them, which is not the order of the meetings themselves. Each must be accepted or refused the moment it arrives.',
        'In the end 6 are accepted, and the room is busy for 190 minutes and free for 410. The program must reach those numbers.',
        'The calendar must refuse any booking that overlaps one it already holds, and show the busy time and the time still free.',
        'And it must allow cancelling. That is the new operation, and the hard one. We will write the program together, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · try the edge ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['clash', 'half-open'],
      eyebrow: '02 · Your turn · before any code',
      heading: 'Back-to-back meetings',
      stand: 'One meeting is booked from minute 90 to minute 130. Then someone asks for minute 130 to minute 160.',
      question: {
        step: 0,
        prompt: 'Should the calendar refuse the second booking?',
        options: [
          { text: 'No: the first ends as the second begins; they share no minute.', correct: true,
            why: 'A booking holds its start minute but not its end minute. 10:00 to 11:00 and 11:00 to 12:00 never meet.' },
          { text: 'Yes: both of them include minute 130.', correct: false,
            why: 'Then no two meetings could ever be back to back, and nobody would use that calendar.' },
          { text: 'Only if both were requested by the same person.', correct: false,
            why: 'Who asked has nothing to do with it. The room is either free in those minutes or not.' }
        ]
      },
      cards: [
        { step: 1, title: 'Clash, and half-open', html: '<p>Two bookings <b>clash</b> when they share at least one minute. A booking is <b>half-open</b>: it holds its start minute and not its end minute, so 90..130 and 130..160 do not clash.[[src:vars]]</p>' },
        { step: 2, title: 'One minute the other way', html: '<p>90..130 and then 129..160 <b>do</b> clash: they share minute 129. The program tests both sides of that edge.[[src:vars]]</p>' }
      ],
      narration: [
        'Before any code, try the edge. A meeting holds 90 to 130. Someone asks for 130 to 160. Should the calendar refuse it? Choose an answer.',
        'No. Two bookings clash when they share at least one minute. A booking holds its start minute but not its end minute; we say it is half-open. So these two only touch.',
        'But 129 to 160 would clash: they share minute 129. The program tests both sides of that edge, because that is exactly where a calendar goes wrong.'
      ]
    },

    /* ---------- 3 · the requests, animated ---------- */
    {
      title: 'Reqs', layout: 'array',
      eyebrow: '03 · Watch the nine requests arrive',
      heading: 'Six accepted, three refused',
      stand: 'In the order they arrive. Each is checked against the bookings already held at that moment.',
      array: {
        labelWidth: 130, slotLabel: 'request',
        rows: [
          { label: 'minutes', values: REQS.map(r => r.span) },
          { label: 'accepted?', values: REQS.map(r => (r.ok ? 'yes' : 'no')) }
        ],
        meters: ['requests', 'accepted'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'pick', slots: [2, 3] }
        ]
      },
      cards: [
        { step: 1, title: 'The three refused', html: '<p>3..33 overlaps 1..31; 260..290 and 220..250 both overlap 245..275. Each was checked against what was held <b>when it arrived</b>.[[src:vars]]</p>' },
        { step: 2, title: 'The pair that matters', html: '<p>90..130 and 130..160 are both held. Shown as busy time they look like <b>one</b> stretch, 90..160 — and that is where cancelling will hurt.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine requests in the order they arrive: 1 to 31, then 3 to 33, and so on. They are the door log’s nine times, now as meeting starts.',
        'Watch each one checked against what is held at that moment. 3 to 33 overlaps 1 to 31, so it is refused. Two more are refused later. Six accepted.',
        'Look at the highlighted pair: 90 to 130 and 130 to 160. Both are held, and side by side they look like one busy stretch, 90 to 160. Remember that pair.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'The nine requests, the day, and the cancel',
      stand: 'A program is written top to bottom. First, the data.',
      question: { step: 0, prompt: 'How should the program write down one booking?', options: [
        { text: 'As a pair of minutes, start and end, in a list in request order.', correct: true, why: 'The pair says everything a booking is, and the list keeps the order the requests came in.' },
        { text: 'As the start minute only, since meetings are 30 minutes.', correct: false, why: 'Not all are: the one at 90 lasts 40 minutes, on purpose. A booking needs its end.' },
        { text: 'As one true or false per minute of the day.', correct: false, why: 'That forgets which minutes belong to which meeting, and costs 600 values for one booking.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch04_v2.py · the data' }),
      cards: [ { step: 2, title: 'Why the 90 is 40 minutes', html: '<p>Every meeting is 30 minutes except the one at 90, which is 40, so that 130..160 <b>touches</b> it exactly. <code>DAY</code> is (0, 600); <code>CANCEL_START</code> = 90 is the cancel the file turns on.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. How should the program write down one booking? Choose an answer.',
        'As a pair of minutes, start and end, kept in a list in request order. Here are the requests, the day from 0 to 600, and the one cancellation the file turns on: the meeting at 90.',
        'Read the comment: every meeting is 30 minutes except the one at 90, which is 40, so that the next one touches it exactly. That pair is chosen to break the obvious design.'
      ]
    },

    /* ---------- 5 · the test inputs ---------- */
    {
      title: 'Edges', layout: 'code',
      eyebrow: '05 · Writing the program · inputs that test the edges',
      heading: 'Small cases that sit exactly on each edge',
      stand: 'Besides the nine requests, the file prepares inputs that each test one edge.',
      question: { step: 0, prompt: 'Which pair of inputs best tests the clash rule?', options: [
        { text: '90..130 with 130..160, and 90..130 with 129..160.', correct: true, why: 'One pair touches and must be allowed; the other shares one minute and must be refused. Both sides of the edge.' },
        { text: '10..20 with 100..130.', correct: false, why: 'They are far apart, so any reasonable test allows them. It says nothing about the edge.' },
        { text: '0..600 alone.', correct: false, why: 'One booking cannot clash with anything. It tests the full day, not the clash rule.' } ] },
      code: P.build({ before: [DATA], add: [INPUTS], step: 1 }),
      cards: [ { step: 2, title: 'Edges and scale', html: '<p>The touching pair, the one-minute overlap, a 4-minute day, a 100,000-minute day, and 400 touching bookings — shuffled, and requested twice.[[src:vars]]</p>' } ],
      narration: [
        'The file also prepares small inputs that each sit on one edge. Which pair best tests the clash rule? Choose an answer.',
        'The touching pair and the one-minute overlap. One must be allowed and the other refused: both sides of the edge. Here they are, with a tiny day, a huge day, and 400 touching bookings.',
        'The 400 are also shuffled, and requested twice over, so the program meets both the order problem and the repeat problem at a size no person would write by hand.'
      ]
    },

    /* ---------- 6 · the clash test ---------- */
    {
      title: 'Clash', layout: 'code', defines: ['function'],
      eyebrow: '06 · Writing the program · do two bookings share a minute?',
      heading: 'Two strict comparisons',
      stand: 'A new booking s..e against a held booking. When do they share a minute?',
      question: { step: 0, prompt: 'Which test says the new booking s..e shares a minute with a held booking m?', options: [
        { text: 's is before m’s end, and m’s start is before e.', correct: true, why: 'Strictly before, on both sides. Touching at an end fails one comparison, so back-to-back is allowed.' },
        { text: 's is at or before m’s end, and m’s start is at or before e.', correct: false, why: 'Then 130..160 would clash with 90..130, refusing every back-to-back meeting.' },
        { text: 's equals m’s start.', correct: false, why: 'Two meetings can overlap without starting together: 3..33 overlaps 1..31.' } ] },
      code: P.build({ before: [DATA, INPUTS], add: [CLASH], step: 1 }),
      cards: [ { step: 2, title: 'The door log’s test, gap zero', html: '<p>Each piece is a <b>function</b>: a named recipe that takes inputs and returns an answer. <code>clashes</code> is part 4’s <code>touching</code> with the gap set to zero, and strict on both sides.[[src:vars]]</p>' } ],
      narration: [
        'Now the clash test. Which test says a new booking s to e shares a minute with a held booking? Choose an answer.',
        'S is before the held booking’s end, and its start is before e: strictly before, on both sides. Here is clashes, a function returning every held booking the new one overlaps.',
        'It is the door log’s touching test with the gap set to zero. The docstring says why it is strict: with at-or-before, back-to-back meetings would be refused.'
      ]
    },

    /* ---------- 7 · the busy view ---------- */
    {
      title: 'View', layout: 'code', defines: ['block'],
      eyebrow: '07 · Writing the program · what a person is shown',
      heading: 'Busy time, merged only when it is shown',
      stand: 'People want to see busy stretches, not a list of meetings. 90..130 and 130..160 should look like one.',
      question: { step: 0, prompt: 'How should the busy stretches be made?', options: [
        { text: 'Sort the held bookings and join touching ones, each time it is shown.', correct: true, why: 'It is the door log’s sweep with gap zero, worked out on demand and thrown away, so nothing is lost.' },
        { text: 'Join bookings as they are accepted, and keep only the joined stretches.', correct: false, why: 'That is what the door log did. Here it would throw away where one meeting ends and the next begins.' },
        { text: 'Show each booking separately, never joined.', correct: false, why: 'It is correct, but a person reads 90..160 more easily than two pieces that touch.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH], add: [VIEW], step: 1 }),
      cards: [ { step: 2, title: 'A block, computed on read', html: '<p>Each joined busy stretch is a <b>block</b>: the busy view is [(1, 31), (50, 80), (90, 160), (245, 275), (540, 570)]. It is a view, made when asked and thrown away: <b>the whole design decision</b>.[[src:vars]]</p>' } ],
      narration: [
        'People want to see busy stretches, not a list of meetings. How should those stretches be made? Choose an answer.',
        'Sort the held bookings and join touching ones, each time the view is shown. Here is merged view: the door log’s sweep with the gap at zero.',
        'Each joined stretch is called a block, and the busy view is five blocks, including 90 to 160. The docstring calls this the whole design decision: the blocks are made when asked, and thrown away.'
      ]
    },

    /* ---------- 8 · free gaps ---------- */
    {
      title: 'Gaps', layout: 'code', defines: ['free gap'],
      eyebrow: '08 · Writing the program · what is still free',
      heading: 'Everything in the day that no block covers',
      stand: 'Walk the blocks in order, and note every stretch between them.',
      question: { step: 0, prompt: 'A block ends at minute 31 and the next starts at 50. What is free between them?', options: [
        { text: '31..50: from the first block’s end to the next one’s start.', correct: true, why: 'Half-open again: minute 31 is free and minute 50 is not. Nineteen minutes.' },
        { text: '32..49: the minutes strictly between them.', correct: false, why: 'The first block does not hold minute 31, so it is free, and a booking 31..50 would fit exactly.' },
        { text: 'Nothing: the free time is whatever is not in the list.', correct: false, why: 'True, but a person needs the actual free stretches to book one.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW], add: [GAPS], step: 1 }),
      cards: [ { step: 2, title: 'Free gaps', html: '<p>Each <b>free gap</b> runs from one block’s end to the next one’s start. Here: (0, 1), (31, 50), (80, 90), (160, 245), (275, 540), (570, 600). Zero-length gaps are dropped: nobody can book 11:00 to 11:00.[[src:vars]]</p>' } ],
      narration: [
        'Now the free time. A block ends at minute 31, and the next starts at 50. What is free between them? Choose an answer.',
        '31 to 50: from the first block’s end to the next one’s start. Here is free gaps: it walks the blocks with a cursor and notes every stretch between them, and the stretch after the last.',
        'Each such stretch is a free gap. There are six here, starting with minute 0 to 1. Zero-length gaps are dropped, because nobody can book the room from 11 to 11.'
      ]
    },

    /* ---------- 9 · what to store ---------- */
    {
      title: 'Store', layout: 'code', defines: ['cancel'],
      eyebrow: '09 · Writing the program · the answer',
      heading: 'Keep the individual bookings; merge only to show',
      stand: 'Now the cancel: “cancel my 90” names a meeting by its start minute. The calendar must be able to remove it.',
      question: { step: 0, prompt: 'What must the calendar store, so that “cancel my 90” can be done?', options: [
        { text: 'Every accepted booking, separately.', correct: true, why: 'Then cancelling is removing one entry. Nothing was ever joined in what is stored, so nothing has to be split.' },
        { text: 'The busy blocks, as the door log stored its runs.', correct: false, why: 'The block 90..160 no longer says where the meeting at 90 ended. Removing it exactly is impossible.' },
        { text: 'The free gaps only.', correct: false, why: 'Gaps say where nobody is, not who is where. A cancel needs to find one particular meeting.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS], add: [MEMBER], step: 1 }),
      cards: [ { step: 2, title: 'Cancel', html: '<p>A <b>cancel</b> names a meeting by its start minute and removes the one booking with that start; it is accepted only if one was removed. Insert refuses on any clash.[[src:vars]]</p>' } ],
      narration: [
        'Now the cancel. Someone says “cancel my 90”, naming the meeting by its start minute. What must the calendar store, so that can be done? Choose an answer.',
        'Every accepted booking, separately. Here is run member calendar: booking checks for a clash and adds; cancelling removes the one booking with that start.',
        'Nothing is ever joined in what is stored, so nothing ever has to be split. The joining happens only in the view. That is the answer to this variation.'
      ]
    },

    /* ---------- 10 · the wrong design ---------- */
    {
      title: 'Wrong', layout: 'code',
      eyebrow: '10 · Writing the program · the door log’s design, where it does not belong',
      heading: 'Store merged blocks, and cancelling has only bad guesses',
      stand: 'For contrast, the file also builds the calendar the door-log way: store the joined blocks. Booking still works. Cancel “my 90” finds the block 90..160.',
      question: { step: 0, prompt: 'With only the block 90..160 stored, what can “cancel my 90” correctly do?', options: [
        { text: 'Nothing correct: the end of the 90 meeting is no longer recorded.', correct: true, why: 'Drop the whole block and 130..160 is lost; keep it and 40 freed minutes are never offered. Both are wrong.' },
        { text: 'Remove 90..130 and keep 130..160.', correct: false, why: 'Only the members design knows 90 ended at 130. In the block that boundary was deleted by the join.' },
        { text: 'Remove the whole block: the meeting at 90 is in it.', correct: false, why: 'Then 130..160, which nobody cancelled, becomes bookable, and two groups are sent to one room.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS, MEMBER], add: [MERGED], step: 1 }),
      cards: [ { step: 2, title: 'Two guesses, both wrong', html: '<p><b>drop</b> removes the whole block; <b>keep</b> leaves it. The docstring: neither is a bug in the code; both are the only answers this state allows.[[src:vars]]</p>' } ],
      narration: [
        'For contrast, the file builds the calendar the door-log way, storing the joined blocks. Cancel my 90 finds the block 90 to 160. What can it correctly do? Choose an answer.',
        'Nothing correct. Here is run merged calendar. Booking works fine, but cancelling has two guesses: drop the whole block, or keep it. The end of the 90 meeting is simply no longer recorded.',
        'The docstring says it plainly: neither guess is a bug in the code. They are the only answers that state can give. Watch what each one shows.'
      ]
    },

    /* ---------- 11 · the three views after the cancel ---------- */
    {
      title: 'Undo', layout: 'array',
      eyebrow: '11 · Watch the three designs after “cancel my 90”',
      heading: 'One is right, one loses a meeting, one hides free time',
      stand: 'The busy blocks each design shows after the nine requests and the cancel. Read down a column.',
      array: {
        labelWidth: 180, slotLabel: 'block',
        rows: [
          { label: 'truly busy', values: ['1..31', '50..80', '130..160', '245..275', '540..570'] },
          { label: 'blocks, drop', values: ['1..31', '50..80', '—', '245..275', '540..570'] },
          { label: 'blocks, keep', values: ['1..31', '50..80', '90..160', '245..275', '540..570'] }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1, 2] },
          { step: 2, do: 'pick', slots: [2] }
        ]
      },
      cards: [
        { step: 2, title: 'Drop', html: '<p>Loses 130..160, a meeting nobody cancelled. A new booking can be put on top of it: two groups, one room.[[src:vars]]</p>' },
        { step: 2, title: 'Keep', html: '<p>Never offers 80..130 as one free gap: the 40 freed minutes are unbookable forever. 95..125 is refused for no reason.[[src:vars]]</p>' },
        { step: 3, title: 'Only the cancel', html: '<p>Before the cancel all three agree exactly. It is the cancel, not the bookings, that joined blocks cannot represent.[[src:vars]]</p>' }
      ],
      narration: [
        'Here is what is truly busy after the cancel: five blocks, including 130 to 160, the meeting nobody cancelled.',
        'Below, what the two block designs show. Mostly the same. But look at the middle column.',
        'Drop lost 130 to 160, so someone can now book on top of it. Keep still shows 90 to 160, so the 40 freed minutes are never offered, and a booking of 95 to 125 is refused for no reason.',
        'And before the cancel, all three designs agree exactly. It is the cancel, not the bookings, that joined blocks cannot represent.'
      ]
    },

    /* ---------- 12 · the brute-force truth ---------- */
    {
      title: 'Grid', layout: 'code', defines: ['grid'],
      eyebrow: '12 · Writing the program · a check that trusts nothing',
      heading: 'One true or false per minute of the day',
      stand: 'The busy view and the free gaps come from joining. How can they be checked without trusting the joining code?',
      question: { step: 0, prompt: 'What simple structure could confirm every block and gap independently?', options: [
        { text: 'One true or false per minute: is the room taken then?', correct: true, why: 'It knows nothing about joining. Each block must be all true, each gap all false.' },
        { text: 'A second copy of merged view, run again.', correct: false, why: 'Running the same code twice repeats its mistakes. A check must work a different way.' },
        { text: 'The count of accepted bookings.', correct: false, why: 'Six accepted says nothing about which minutes are busy, or whether a gap is right.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS, MEMBER, MERGED], add: [GRID], step: 1 }),
      cards: [ { step: 2, title: 'Slow, and obviously right', html: '<p>The <b>grid</b> is one true or false per minute. Slow, obviously correct, and the only reference the rest of the file is checked against: 190 busy + 410 free = 600.[[src:vars]]</p>' } ],
      narration: [
        'The busy view and the gaps come from joining. How can they be checked without trusting the joining code? Choose an answer.',
        'With one true or false per minute: is the room taken then? Here is occupied minutes. It knows nothing about joining: every block must be all true, every gap all false.',
        'That per-minute list is called the grid. It is slow but obviously right, and everything else is checked against it: 190 busy minutes plus 410 free makes 600.'
      ]
    },

    /* ---------- 13 · the examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '13 · Writing the program · 21 examples, each checked twice',
      heading: 'Which answer is cheaper is not always the same',
      stand: 'Each example row is checked against its expected answer and against the grid. The table also prints both costs: bookings swept, and minutes in the grid.',
      question: { step: 0, prompt: 'A 100,000-minute day holds just two meetings. Which check is cheaper?', options: [
        { text: 'The sweep: it walks 2 bookings, against 100,000 grid minutes.', correct: true, why: 'Its cost follows the bookings, and there are only two. The grid pays for every minute of the day.' },
        { text: 'The grid: it is always the simpler answer.', correct: false, why: 'Simpler, yes; cheaper, not here. On a 2-minute day with three holds the grid does win.' },
        { text: 'Both cost the same: they give the same answer.', correct: false, why: 'Same answer, very different work: 2 against 100,000.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS, MEMBER, MERGED, GRID], add: [EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'All 21 agree', html: '<p>Every row passes both checks. 2 bookings against 100,000 minutes on the long day; on a 2-minute day with 3 holds, the grid wins outright.[[src:vars]]</p>' } ],
      narration: [
        'Every example is checked twice, and the table prints the cost of both answers. A 100,000-minute day holds just two meetings. Which is cheaper? Choose an answer.',
        'The sweep. It walks 2 bookings; the grid pays for 100,000 minutes. Here are the 21 examples and show examples, which asserts each row both ways.',
        'All 21 agree. But the cheaper answer is not always the same: on a 2-minute day holding 3 bookings, the grid wins outright.'
      ]
    },

    /* ---------- 14 · main, the nine requests ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '14 · Writing the program · the nine requests',
      heading: 'Report each refusal against what was held at that moment',
      stand: 'main replays the nine requests and prints why each refusal happened.',
      question: { step: 0, prompt: 'A refused request is blamed on a clash. Against which bookings should that clash be found?', options: [
        { text: 'Those held at the moment the request arrived.', correct: true, why: 'A booking accepted later cannot be the reason an earlier request was refused.' },
        { text: 'All the bookings held at the end of the day.', correct: false, why: 'That could blame a later booking for an earlier refusal: the same out-of-order confusion the chapter is about.' },
        { text: 'Any booking that shares its start minute.', correct: false, why: 'Clashes are about shared minutes, not shared starts. 3..33 clashed with 1..31.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS, MEMBER, MERGED, GRID, EXAMPLES, SHOW], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Held, shown, free', html: '<p>Held: six bookings, 90..130 and 130..160 separately. Shown: five blocks, with 90..160 as one. Grid: 190 busy + 410 free = 600.[[src:vars]]</p>' } ],
      narration: [
        'Now main. It replays the nine requests and explains each refusal. Against which bookings should a refusal’s clash be found? Choose an answer.',
        'Those held when the request arrived. Here main keeps a list of what was held so far, so a later booking is never blamed for an earlier refusal.',
        'Then it prints three things: six bookings held, five blocks shown with 90 to 160 as one, and the grid’s 190 busy and 410 free minutes.'
      ]
    },

    /* ---------- 15 · main, the cancel and the random checks ---------- */
    {
      title: 'Proof', layout: 'code',
      eyebrow: '15 · Writing the program · the cancel, and the random cases',
      heading: 'The joined design is wrong only when something is cancelled',
      stand: 'The rest of main cancels the 90, compares the three designs, then tries random sequences of bookings and cancels.',
      question: { step: 0, prompt: 'On random sequences with no cancels at all, how often is the joined-blocks design wrong?', options: [
        { text: 'Never: with only bookings, joining loses nothing.', correct: true, why: 'Without a cancel, nothing ever needs splitting. That is exactly the case the door log was built for.' },
        { text: 'About as often as with cancels.', correct: false, why: 'With cancels, keep was wrong on all 492 sequences. With none, it is wrong on zero.' },
        { text: 'Always: joined blocks are simply a bad idea.', correct: false, why: 'They are fine for adding only. They fail only where splitting is needed.' } ] },
      code: P.build({ before: [DATA, INPUTS, CLASH, VIEW, GAPS, MEMBER, MERGED, GRID, EXAMPLES, SHOW, MAIN1], add: [MAIN2, MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'Measured', html: '<p>600 random sequences: of the 492 with a cancel, joined blocks were wrong on 35 with drop and 492 with keep. On 300 with only bookings: never wrong.[[src:vars]]</p>' } ],
      narration: [
        'The rest of main cancels the 90, compares the designs, and tries random sequences. On sequences with no cancels at all, how often are joined blocks wrong? Choose an answer.',
        'Never. With only bookings, nothing needs splitting. Of the 492 random sequences that do contain a cancel, joined blocks were wrong on 35 with drop, and on all 492 with keep.',
        'So the door log’s design was not wrong; it was built for a stream that only adds. Recognising that limit is the whole answer to this variation.'
      ]
    },

    /* ---------- 16 · whole ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '16 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written, and why.',
        'From the top: the data, the clash test, the busy view and free gaps, the two designs, the grid, the examples, and main with its cancel and random checks.'
      ]
    },

    /* ---------- 17 · output ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '17 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch04_v2.py prints'),
      narration: [
        'Here is what it prints. First the 21 examples, with both costs. Then each request, accepted or refused, and the clash that refused it.',
        'Then the cancel: drop loses 130 to 160, keep never frees 80 to 130. And the random checks. The last line says every assertion passed.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you built',
      heading: 'Store the members; join only to show',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>clashes</code>', 'shares a minute? strict on both sides, so touching is allowed', '3 refused'] },
          { step: 0, cells: ['<code>merged_view</code> · <code>free_gaps</code>', 'join touching bookings, on read; what is left is free', '5 blocks, 6 gaps'] },
          { step: 1, cells: ['<code>run_member_calendar</code>', 'store each booking; cancel removes one', 'right every time'] },
          { step: 1, cells: ['<code>run_merged_calendar</code>', 'store joined blocks; cancel can only drop or keep', 'wrong on cancels'] },
          { step: 2, cells: ['<code>occupied_minutes</code>', 'one true or false per minute: the check', '190 + 410 = 600'] }
        ]
      },
      side: { step: 3, title: 'The lesson', html: '<p>Joining is easy because a joined run is set by its ends. Splitting is not, because the boundary is gone. The door log’s state is right only for a stream that never takes anything back.[[src:vars]]</p><p>Next: the island count, where only a number is wanted.</p>' },
      narration: [
        'To recap. Clashes asks whether two bookings share a minute, strictly, so touching is allowed. The busy view joins touching bookings only when shown, and free gaps is what is left.',
        'The right design stores every booking separately. The door log’s design stores joined blocks, and can only drop or keep on a cancel: both wrong.',
        'And the grid, one true or false per minute, checks everything without trusting any joining code.',
        'The lesson: joining is easy, splitting is not, so the door log’s design is right only for a stream that never takes anything back. Next, the island count.'
      ]
    }
  ]
};
