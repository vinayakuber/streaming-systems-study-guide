// Chapter 4, Part 1 — "Window shapes — fixed, sliding, session", for a viewer who has read
// nothing before it. The nine events, both clocks and every word are introduced here; each
// shape is asked about before it is shown, and each is animated on the seed's own events.
// Every time, value and sum below is computed from tools/stream_seed.js and asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch04';
const E = seed.EVENTS;                                   // in processing order
const clock = s => seed.hhmmss(s);
const hm = s => clock(s).slice(0, 5);
const FIXED = E.map(e => seed.winOf(e.et));              // fixed window start per event
const FIXED_SUMS = seed.WIN_STARTS.map(w => E.filter(e => seed.winOf(e.et) === w).reduce((a, e) => a + e.v, 0));
const IN_SLIDING = E.map(e => [Math.floor(e.et / 60) * 60, Math.floor(e.et / 60) * 60 - 60].filter(w => w >= 0 && e.et < w + 120).length);
const COUNTED = E.map((e, i) => e.v * IN_SLIDING[i]);
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const A = E.filter(e => e.key === 'a').sort((x, y) => x.et - y.et);
const QUIET = A.map((e, i) => (i ? e.et - A[i - 1].et : null));
const NEW_VISIT = QUIET.map(q => (q === null || q > seed.GAP ? 'yes' : 'no'));
const sessionsAt = (key, gap) => {
  const es = E.filter(e => e.key === key).sort((x, y) => x.et - y.et);
  return es.reduce((n, e, i) => n + (i === 0 || e.et - es[i - 1].et > gap ? 1 : 0), 0);
};
const SWEEP = [40, 120, 130, 300].map(g => sessionsAt('a', g));
const S = [...seed.SESSIONS.a, ...seed.SESSIONS.b];

if (TOTAL !== 45 || FIXED_SUMS.join() !== '19,11,7,8' || COUNTED.reduce((a, b) => a + b, 0) !== 78
  || IN_SLIDING.filter(n => n === 2).length !== 6 || IN_SLIDING[4] !== 2 || NEW_VISIT.join() !== 'yes,no,yes,no,yes'
  || SWEEP.join() !== '4,3,2,1' || S.length !== 5 || S.map(s => s.end - s.start).join() !== '2,115,0,40,40'
  || seed.GAP !== 120 || E[7].et !== 50 || E[7].pt !== 280)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Three Window Shapes',
  eyebrow: 'Streaming · Ch 4 · Part 1',
  ...shared,
  jargon: ['event', 'user', 'event time', 'processing time', 'key', 'window', 'fixed window', 'sliding window',
    'session', 'gap', 'state'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    flow:  section(CH, 'Window shapes — fixed, sliding, session', 'Chapter 4 · window shapes'),
    why:   section(CH, 'Why there are three shapes, and why one of them has no answer without a setting', 'Chapter 4 · why three shapes'),
    when:  section(CH, 'When to reach for each shape, and what each one costs', 'Chapter 4 · when to use each shape'),
    prog:  section(CH, 'Three window shapes through one assigner', 'Chapter 4 · one assigner, three shapes')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'user'],
      eyebrow: '01 · Chapter 4 · Part 1',
      heading: 'Nine clicks from two people. Three ways to cut them up.',
      hero: { step: 0, text: 'A website records what its visitors do. Each record is an <b>event</b>: one click, with a small number <code>v</code> attached that reports add up. Two visitors, called <b>users</b> <code>a</code> and <code>b</code>, produce 9 events in a few minutes.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events' },
        { step: 1, value: 2, label: 'users, a and b' },
        { step: 2, value: TOTAL, label: 'the 9 values added up[[src:why]]' },
        { step: 2, value: 120, label: 'seconds: the length we cut time into[[src:why]]' }
      ],
      cardsLabel: 'Three questions the website asks',
      cards: [
        { step: 3, n: 1, title: 'How many in each 120 seconds?', text: 'A total per period, like a till receipt per hour.' },
        { step: 3, n: 2, title: 'The last 120 seconds, refreshed every minute', text: 'A rolling figure that keeps moving.' },
        { step: 4, n: 3, title: 'How many visits did user a make?', text: 'A visit starts and stops when the person does.' }
      ],
      note: { step: 4, text: 'You will be asked before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website records what its visitors do. Each record is called an event: one click, with a small number attached that reports add up.',
        'Two visitors, called users a and b, produce 9 events in a few minutes. That is the whole example, and we will use it in every part of this chapter.',
        'Added together, the 9 numbers come to 45. And the website likes to cut time into pieces 120 seconds long. Keep both numbers in mind.',
        'It asks three questions. How many in each 120 seconds? And what is the figure for the last 120 seconds, refreshed every minute?',
        'And how many visits did user a make? Each question needs a different way of cutting up time. This part shows all three, and you answer first each time.'
      ]
    },

    /* ---------- 2 · the events and the two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'key'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'Listed in the order the system saw them. Times are clock times just after noon.',
      table: {
        columns: ['Event', 'User', 'Happened at', 'Seen at', 'v'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click happened, on the visitor’s side.</li><li><b>Processing time</b> — when the system received it. Networks delay things, so the two differ.</li><li>Id 7 happened at <b>12:00:50</b> but was seen at <b>12:04:40</b>: out of order.[[src:prog]]</li><li>The user is the event’s <b>key</b>: the thing events are grouped by.</li></ul>' },
      narration: [
        'Here are the first events, in the order the system received them. Each one has two times. Event 0 happened at 12:00:01 and was seen one second later.',
        'And so on. Look at id 6: it happened at 12:03:40, but was seen after id 5, which happened later. The order of arrival is not the order of events.',
        'Id 7 is the extreme case. It happened at 12:00:50 but was not seen until 12:04:40, almost four minutes late. Its message was held up somewhere.',
        'So every event carries two clocks. When it happened is its event time. When the system saw it is its processing time. And the user an event belongs to is called its key.'
      ]
    },

    /* ---------- 3 · question: which clock ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window'],
      eyebrow: '03 · Your turn',
      heading: 'Which clock decides where an event belongs?',
      stand: 'The website wants totals per 120 seconds. Id 7 happened at 12:00:50 and was seen at 12:04:40.',
      question: {
        step: 0,
        prompt: 'Which 120-second stretch should id 7 be counted in?',
        options: [
          { text: 'The one holding 12:00:50, when the click happened.', correct: true,
            why: 'The question is about when people clicked. A late delivery must not move a click into the wrong minutes.' },
          { text: 'The one holding 12:04:40, when the system saw it.', correct: false,
            why: 'Then the answer would depend on network delays, and the same clicks could give different totals each time.' },
          { text: 'Neither: it arrived too late to count.', correct: false,
            why: 'Throwing it away loses a real click. Late is not the same as wrong.' }
        ]
      },
      cards: [
        { step: 1, title: 'Window', html: '<p>A stretch of <b>event time</b> whose events are added up together is a <b>window</b>. Which window an event joins is decided by when it happened, never by when it arrived.[[src:prog]]</p>' },
        { step: 2, title: 'Three shapes', html: '<p>The three questions need three window shapes: one fixed by the clock, one that slides, and one that follows the person. This part takes them one at a time.[[src:flow]]</p>' }
      ],
      narration: [
        'First question. The website wants totals per 120 seconds. Id 7 happened at 12:00:50 and was seen at 12:04:40. Which stretch should it count in? Choose an answer.',
        'The stretch holding 12:00:50, when the click happened. A stretch of event time whose events are added up together is called a window, and the event time decides it.',
        'The three questions need three shapes of window: one fixed by the clock, one that slides, and one that follows the person. Let us take them one at a time, starting with the simplest.'
      ]
    },

    /* ---------- 4 · fixed windows, animated ---------- */
    {
      title: 'Fixed', layout: 'array', defines: ['fixed window'],
      eyebrow: '04 · Watch fixed windows',
      heading: 'Equal, side by side, never overlapping',
      stand: 'Each event, in arrival order, with the 120-second window its event time falls in: 12:00 to 12:02, 12:02 to 12:04, and so on.',
      array: {
        labelWidth: 130, slotLabel: 'event',
        rows: [
          { label: 'happened', values: E.map(e => clock(e.et)) },
          { label: 'window from', values: FIXED.map(hm) },
          { label: 'v', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'total of v'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: E.map((e, i) => (FIXED[i] === 0 ? i : -1)).filter(i => i >= 0) },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 260 }
        ]
      },
      cards: [
        { step: 1, title: 'One event, one window', html: '<p>Four events fall in 12:00 to 12:02, id 7 among them, although it arrived eighth. Each event is in <b>exactly one</b> window.[[src:why]]</p>' },
        { step: 2, title: 'The sums add up', html: '<p>The four windows hold <b>19, 11, 7 and 8</b>, which add to <b>' + TOTAL + '</b>: the whole data, each event counted once.[[src:why]]</p>' },
        { step: 3, title: 'Fixed window', html: '<p>Equal, side by side, no overlap: a <b>fixed window</b>. It answers “how many per 120 seconds”, and a batch job over the same data gives the same totals.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the 9 events in arrival order, with the time each happened, and the 120-second window it falls in. Windows start at 12:00, 12:02, 12:04 and so on.',
        'The four highlighted events all fall in the window from 12:00. Id 7 is among them, even though it arrived eighth. Each event lands in exactly one window.',
        'Now watch the values being added. The pointer reads all 9 and the total reaches 45. Window by window the sums are 19, 11, 7 and 8, which also add to 45.',
        'Equal windows, side by side, never overlapping, are called fixed windows. They answer how many per period, and their totals always match the data.'
      ]
    },

    /* ---------- 5 · question: sliding ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['sliding window'],
      eyebrow: '05 · Your turn',
      heading: 'Windows that start every 60 seconds but last 120',
      stand: 'For “the last 120 seconds, refreshed every minute”, a new 120-second window starts every 60 seconds: 12:03 to 12:05, then 12:04 to 12:06, and so on.',
      question: {
        step: 0,
        prompt: 'Id 4 happened at 12:04:05. How many of these windows contain it?',
        options: [
          { text: 'Two: 12:03 to 12:05, and 12:04 to 12:06.', correct: true,
            why: 'Each window lasts twice as long as the step between starts, so every moment is covered by two windows.' },
          { text: 'One: 12:04 to 12:06, as before.', correct: false,
            why: 'That was the fixed window. The window that started a minute earlier is still open at 12:04:05.' },
          { text: 'None, because the windows overlap.', correct: false,
            why: 'Overlap does not leave holes; it covers each moment more than once.' }
        ]
      },
      cards: [
        { step: 1, title: 'Sliding window', html: '<p>Fixed length, overlapping, set by two numbers: the size (120 seconds) and how often a new one starts (every 60). This is a <b>sliding window</b>.[[src:flow]]</p>' },
        { step: 2, title: 'So an event counts twice', html: '<p>Id 4’s value of 6 goes into both windows. That is intended: each window is its own rolling figure.[[src:prog]]</p>' }
      ],
      narration: [
        'Second question. For a rolling figure, a new 120-second window starts every 60 seconds. Id 4 happened at 12:04:05. How many windows contain it? Choose an answer.',
        'Two: the one from 12:03 to 12:05, and the one from 12:04 to 12:06. Windows of fixed length that overlap, set by a size and a step, are called sliding windows.',
        'So id 4’s value of 6 is counted in both windows. That is the point: each window is its own rolling figure. Watch what this does to the total.'
      ]
    },

    /* ---------- 6 · sliding, animated ---------- */
    {
      title: 'Slide', layout: 'array',
      eyebrow: '06 · Watch sliding windows count twice',
      heading: 'The same 9 events, but the total comes to 78',
      stand: 'For each event: how many sliding windows contain it, and its value times that count.',
      array: {
        labelWidth: 150, slotLabel: 'event',
        rows: [
          { label: 'happened', values: E.map(e => clock(e.et)) },
          { label: 'windows it is in', values: IN_SLIDING },
          { label: 'v', values: E.map(e => e.v) },
          { label: 'v counted', values: COUNTED }
        ],
        meters: ['events read', 'total over all windows'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: IN_SLIDING.map((n, i) => (n === 1 ? i : -1)).filter(i => i >= 0) },
          { step: 2, do: 'show', rows: [2, 3] },
          { step: 2, do: 'sweep', row: 3, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 260 }
        ]
      },
      cards: [
        { step: 1, title: 'Why three are in only one', html: '<p>Events before 12:01 sit in one window only, because there is no window starting before 12:00. The other <b>6 of the 9</b> are in two.[[src:why]]</p>' },
        { step: 2, title: '78, not 45', html: '<p>7 windows whose sums total <b>78</b>. The output is about twice the data, because size ÷ step = 120 ÷ 60 = 2.[[src:why]]</p>' },
        { step: 3, title: 'Not a bug', html: '<p>Never compare a sliding total with the input total. The overlap is the intent: it buys a figure that moves every minute.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the events again, with the number of sliding windows each one falls in. Most of them show a 2.',
        'The highlighted three show a 1. They happened before 12:01, and there is no window starting before 12:00 to hold them twice. The other 6 are in two windows each.',
        'Each value is counted once per window. Watch the pointer add the counted values: the total reaches 78, from data that adds up to only 45.',
        'The output is about twice the data, because each window lasts twice the step. That is intended. Never compare a sliding total with the input total.'
      ]
    },

    /* ---------- 7 · question: a visit ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['session', 'gap'],
      eyebrow: '07 · Your turn',
      heading: 'Now the third question: how many visits?',
      stand: 'User a clicked at 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00. The website’s rule: a silence longer than 120 seconds ends a visit.',
      question: {
        step: 0,
        prompt: 'Under that rule, how many visits did user a make?',
        options: [
          { text: 'Three: only the silences over 120 seconds start a visit.', correct: true,
            why: 'The 127-second silence and the long one before 12:09:00 each end a visit. The 115-second silence does not. So 1 to 3, 130 to 245, and 540 alone.' },
          { text: 'Five: every click is a separate visit.', correct: false,
            why: 'A click 2 seconds after another is plainly the same visit. Only a long silence starts a new one.' },
          { text: 'Four: one per fixed window that holds a click.', correct: false,
            why: 'Clock windows know nothing about the person. The clicks at 12:02:10 and 12:04:05 are one visit split across two windows.' }
        ]
      },
      cards: [
        { step: 1, title: 'Session and gap', html: '<p>A burst of activity, ended by a silence longer than a set length, is a <b>session</b>. That length is the <b>gap</b>: here 120 seconds.[[src:flow]]</p>' },
        { step: 2, title: 'No clock boundaries', html: '<p>Where a session starts and stops comes from the data, not from the clock. Nothing about 12:02 or 12:04 matters.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. User a clicked five times. The rule: a silence longer than 120 seconds ends a visit. How many visits did user a make? Choose an answer.',
        'Three. A burst of activity ended by a long enough silence is called a session, and the silence it needs is called the gap. Here the gap is 120 seconds.',
        'Notice that nothing about 12:02 or 12:04 matters. A session starts and stops where the person did. Let us watch the rule being applied.'
      ]
    },

    /* ---------- 8 · sessions, animated ---------- */
    {
      title: 'Visit', layout: 'array',
      eyebrow: '08 · Watch user a’s sessions being found',
      heading: 'Put the clicks in event-time order, then measure each silence',
      stand: 'User a’s five clicks, sorted by when they happened. A silence longer than the 120-second gap starts a new session.',
      array: {
        labelWidth: 170, slotLabel: 'click',
        rows: [
          { label: 'happened', values: A.map(e => clock(e.et)) },
          { label: 'silence before (s)', values: QUIET.map(q => (q === null ? '—' : q > 200 ? 'over 120' : q)) },
          { label: 'new session?', values: NEW_VISIT }
        ],
        meters: ['clicks checked', 'sessions'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 1, title: 'One subtraction each', html: '<p>Each click is compared with the one before it. 127 seconds is over the gap, so 12:02:10 opens a new session; 115 is not, so 12:04:05 joins it.[[src:prog]]</p>' },
        { step: 2, title: 'Five sessions in all', html: '<p>User a: 3 sessions. User b: 2. Their lengths are 2, 115, 0, 40 and 40 seconds, starting wherever activity began.[[src:why]]</p>' },
        { step: 3, title: 'Cannot be decided from one event', html: '<p>A fixed or sliding window can be named from a single event’s time. A session cannot: its ends depend on events that may not have arrived yet.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are user a’s five clicks, sorted by when they happened, with the silence before each one. The first click has nothing before it, so it always opens a session.',
        'Watch the check. 2 seconds: same session. 127 seconds: longer than 120, so a new session. 115: same session. And the last silence is far over 120. Three sessions.',
        'Do the same for user b and you get 2 more, so 5 sessions in all. They last 2, 115, 0, 40 and 40 seconds, and start wherever activity began.',
        'One more thing. A fixed or sliding window can be named from one event alone. A session cannot: its ends depend on clicks that may not have arrived yet.'
      ]
    },

    /* ---------- 9 · question: change the gap ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'Same clicks, a different rule',
      stand: 'User a’s silences were 2, 127 and 115 seconds, then a long one. The website changes the gap from 120 seconds to 40.',
      question: {
        step: 0,
        prompt: 'With a gap of 40 seconds, how many sessions does user a have?',
        options: [
          { text: 'Four: the 127 and the 115 both end a session now.', correct: true,
            why: 'Only the 2-second silence is short enough. Every other silence is over 40, so 5 clicks make 4 sessions.' },
          { text: 'Still three: the clicks have not changed.', correct: false,
            why: 'The clicks did not change, but the rule did, and the rule is what draws the boundaries.' },
          { text: 'Five: every click becomes its own session.', correct: false,
            why: 'The first two clicks are only 2 seconds apart, which is within 40, so they stay together.' }
        ]
      },
      narration: [
        'Fourth question. User a’s clicks stay exactly the same, but the gap changes from 120 seconds to 40. How many sessions now? Choose an answer.',
        'Four. Only the 2-second silence is short enough; every other silence now ends a session. The data did not change at all. Watch what happens as the gap grows.'
      ]
    },

    /* ---------- 10 · the gap sweep ---------- */
    {
      title: 'Sweep', layout: 'cards',
      eyebrow: '10 · One user, four gaps, four answers',
      heading: '“How many visits?” has no answer until someone chooses the gap',
      stand: 'User a’s session count at four different gaps. The five clicks never change.',
      bars: { step: 0, label: 'Sessions of user a', items: [
        { label: 'gap 40 seconds', value: SWEEP[0] }, { label: 'gap 120 seconds', value: SWEEP[1] },
        { label: 'gap 130 seconds', value: SWEEP[2] }, { label: 'gap 300 seconds', value: SWEEP[3] } ] },
      columns: 2,
      cards: [
        { step: 1, title: 'Every answer is right', html: '<p>4, 3, 2 and 1 sessions are all correct, each for its own gap. The data cannot choose between them.[[src:why]]</p>' },
        { step: 2, title: 'A product decision', html: '<p>The gap is the definition of “a visit”. It belongs in the question, decided by the business, not tuned by an engineer.[[src:why]]</p>' }
      ],
      narration: [
        'Here is user a’s session count at four gaps. At 40 seconds, 4 sessions. At 120, 3. At 130, 2. At 300, just 1. The clicks never change.',
        'Every one of these answers is correct, for its own gap. Nothing in the data can say which gap is right.',
        'So the gap is not a performance setting. It is the definition of a visit. Until someone decides it, how many visits has no answer at all.'
      ]
    },

    /* ---------- 11 · when to use which ---------- */
    {
      title: 'Which', layout: 'cards', defines: ['state'],
      eyebrow: '11 · When to reach for each shape, and what each costs',
      heading: 'Read the question; it names the shape',
      stand: 'Whatever the system must remember between events is called its state. The shapes differ in how much state they need.',
      columns: 2,
      cards: [
        { step: 0, title: 'Fixed', html: '<p>When the question names a period: per minute, per hour, daily. Totals match the data, and <b>state</b> is one total per user per open window, known in advance.[[src:when]]</p>' },
        { step: 1, title: 'Sliding', html: '<p>For a moving figure. Budget for about twice the output and twice the state, and expect 78 against 45.[[src:when]]</p>' },
        { step: 2, title: 'Session', html: '<p>When the boundary is the person’s behaviour: a visit, a trip, a conversation. The state is one entry per session — 5 here — and cannot be sized in advance.[[src:when]]</p>' },
        { step: 3, title: 'Not sessions for “recent activity”', html: '<p>A sliding window answers that, with state of a known size and nothing to join together later.[[src:when]]</p>' }
      ],

      narration: [
        'How do you choose? What the system must remember between events is called its state. Fixed windows fit any question that names a period, and their state is known in advance.',
        'Sliding windows fit a moving figure. Budget for about twice the output and twice the state, and expect totals like 78 against 45.',
        'Sessions fit questions about behaviour, like a visit or a trip. Their state is one entry per session, 5 here, and depends on the data, so it cannot be sized in advance.',
        'And do not use sessions just to mean recent activity. A sliding window answers that, with bounded state and nothing to merge.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'Match a question to a shape',
      stand: 'A dashboard wants “clicks per hour”, to be checked later against a nightly report over the same clicks.',
      question: {
        step: 0,
        prompt: 'Which window shape fits “clicks per hour”?',
        options: [
          { text: 'Fixed: the question names a period, and totals must match.', correct: true,
            why: 'Each click lands in exactly one hour, so the hourly totals add up to the nightly report.' },
          { text: 'Sliding: an hour long, starting every minute.', correct: false,
            why: 'Each click would be counted many times, and the totals could never match the nightly report.' },
          { text: 'Session: an hour of activity is one visit.', correct: false,
            why: 'Sessions follow people’s silences, not the clock, so they would not line up with hours at all.' }
        ]
      },
      narration: [
        'Last question. A dashboard wants clicks per hour, and the totals will be checked against a nightly report. Which window shape fits? Choose an answer.',
        'Fixed. The question names a period, every click lands in exactly one hour, and so the hourly totals add up to the same figure as the nightly report.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'Three shapes, one definition each, and one missing setting',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when the system saw it. Id 7: 12:00:50 and 12:04:40.'] },
          { step: 0, cells: ['<b>Window</b>', 'A stretch of event time whose events are added up together.[[src:prog]]'] },
          { step: 1, cells: ['<b>Fixed window</b>', 'Equal, no overlap; each event once. Sums 19, 11, 7, 8 add to 45.[[src:why]]'] },
          { step: 1, cells: ['<b>Sliding window</b>', 'Fixed length, overlapping; 6 events counted twice, 78 in all.[[src:why]]'] },
          { step: 2, cells: ['<b>Session</b> and <b>gap</b>', 'A burst ended by a silence longer than the gap. User a: 4, 3, 2, 1 sessions at 40, 120, 130, 300 seconds.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>A session’s ends depend on events still to come. So what happens when a late event lands between two sessions? Part 2 follows a window from birth to being thrown away.</p>' },
      narration: [
        'To recap. Every event has an event time, when it happened, and a processing time, when it was seen. A window is a stretch of event time whose events are added up.',
        'Fixed windows never overlap, so every event counts once: 19, 11, 7 and 8 make 45. Sliding windows overlap, so 6 events count twice and the total is 78.',
        'A session is a burst of activity ended by a silence longer than the gap. The gap is a definition: user a has 4, 3, 2 or 1 sessions depending on it.',
        'Next, part 2 asks: a session’s ends depend on events still to come. What happens when a late one arrives? It follows a window from birth to being thrown away.'
      ]
    }
  ]
};
