// Chapter 8, Part 2 — "Windows in SQL", for a viewer who has read nothing before it. The
// click stream and its two clocks are re-introduced from zero; then each SQL window function
// (TUMBLE, HOP, SESSION) is asked about before it is shown, and each is animated on the seed:
// the events dropping into slices, the seven overlapping HOP rows adding to 78, the session
// breaks found by a sweep, and the watermark that decides when a row is sent — including the
// one window that is never sent. Every figure comes from tools/stream_seed.js and is asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch08';
const E = seed.EVENTS;
const hh = seed.hhmmss;
const W = seed.WIN, P = W / 2, GAP = seed.GAP;
const mm = t => hh(t).slice(0, 5);
const winOf = t => Math.floor(t / W) * W;
const sumIds = ids => ids.reduce((n, id) => n + E[id].v, 0);
const TOTAL = E.reduce((n, e) => n + e.v, 0);
const STARTS = seed.WIN_STARTS;
const TUM = STARTS.map(s => sumIds(seed.WINDOWS[s]));
const hopsOf = et => { const o = []; for (let s = 0; s <= et; s += P) if (et < s + W) o.push(s); return o; };
const HOP_STARTS = [...new Set(E.flatMap(e => hopsOf(e.et)))].sort((a, b) => a - b);
const HOP_IDS = HOP_STARTS.map(s => E.filter(e => hopsOf(e.et).includes(s)).map(e => e.id).sort((a, b) => a - b));
const HOP_SUM = HOP_IDS.map(sumIds);
const HOP_TOTAL = HOP_SUM.reduce((a, b) => a + b, 0);
const TWICE = E.filter(e => hopsOf(e.et).length === 2).length;
const A_EVENTS = E.filter(e => e.key === 'a').sort((x, y) => x.et - y.et);
const A_STARTS = A_EVENTS.map((e, i) => (i === 0 || e.et - A_EVENTS[i - 1].et > GAP ? 'yes' : 'no'));
const NS = { a: seed.SESSIONS.a.length, b: seed.SESSIONS.b.length };
const WM = seed.WATERMARKS;
const wmText = w => (w < 0 ? 'before 12:00' : hh(w));
const CLOSED = STARTS.map(s => seed.closedAt(s));
const HELD = STARTS.map((s, k) => (CLOSED[k] === null ? null : E.filter((e, i) => i <= CLOSED[k] && winOf(e.et) === s).reduce((n, e) => n + e.v, 0)));
const ID4 = hopsOf(E[4].et);
const EDGE = E.filter(e => hopsOf(e.et).length === 1);
const SINK = STARTS.filter((s, k) => CLOSED[k] !== null).reduce((n, s) => n + sumIds(seed.WINDOWS[s]), 0);

if (TOTAL !== 45 || TUM.join() !== '19,11,7,8' || HOP_STARTS.length !== 7 || HOP_TOTAL !== 78 || TWICE !== 6 || NS.a !== 3 || NS.b !== 2
  || A_STARTS.join() !== 'yes,no,yes,no,yes' || ID4.map(mm).join() !== '12:03,12:04' || CLOSED.join() !== '4,8,8,'
  || HELD.join() !== '15,11,7,' || hh(WM[4]) !== '12:03:05' || hh(WM[8]) !== '12:08:00' || seed.SESSIONS.b[0].ids.join() !== '7,2'
  || EDGE.map(e => e.id).join() !== '0,1,7' || EDGE.some(e => e.et >= P) || SINK !== 37)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Three SQL Windows',
  eyebrow: 'Streaming · Ch 8 · Part 2',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'TUMBLE': 'tumble', 'HOP': 'hop', 'SESSION': 'session' } },
  jargon: ['event', 'key', 'value', 'stream', 'SQL', 'query', 'event time', 'processing time', 'out of order', 'window',
    'tumble', 'hop', 'session', 'gap', 'merge', 'updating', 'watermark', 'emit', 'sink'],
  sources: {
    ch:    chapter(CH, 'Chapter 8 on GitHub'),
    win:   section(CH, 'Windows in SQL', 'Chapter 8 · windows in SQL'),
    why:   section(CH, 'Why the three window functions are three different cost profiles', 'Chapter 8 · three cost profiles'),
    when:  section(CH, 'When to use each window function, and how to capacity-plan them', 'Chapter 8 · when to use each'),
    walk:  section(CH, 'Visual walkthrough — three window functions, and when each row emits', 'Chapter 8 · the walkthrough'),
    prog:  section(CH, 'TUMBLE, HOP and SESSION — stack and heap at every step', 'Chapter 8 · the three as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'SQL', 'query'],
      eyebrow: '01 · Chapter 8 · Part 2',
      heading: 'How many clicks in each stretch of time? Three ways to cut it',
      hero: { step: 0, text: 'A company counts clicks on its adverts. Every so often a message arrives saying “some clicks happened”: an <b>event</b>. It names its source, <b>a</b> or <b>b</b> — its <b>key</b> — and carries a number, its <b>value</b>: how many clicks. The events never stop: a <b>stream</b>. Analysts question it in <b>SQL</b>, the everyday language for asking questions of data; one question is a <b>query</b>.[[src:win]]' },
      tiles: [
        { step: 1, value: TOTAL, label: 'clicks in all, over 9 events[[src:why]]' },
        { step: 2, value: TUM.length, label: 'answer rows from one way of cutting time[[src:why]]' },
        { step: 2, value: HOP_TOTAL, label: 'the total a second way reports[[src:why]]' },
        { step: 3, value: NS.a + NS.b, label: 'answer rows from a third way, a count no query predicts[[src:walk]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 4, n: 1, title: 'How can time be cut into pieces?', text: 'Equal slices, overlapping slices, or bursts of activity.' },
        { step: 4, n: 2, title: 'What does each way cost?', text: 'In rows, and in surprises.' },
        { step: 4, n: 3, title: 'When is a piece’s answer sent?', text: 'And why one never is.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A company counts clicks on its adverts. Each message saying some clicks happened is an event. It names its source, a or b, called its key, and carries a number, its value. The events never stop: a stream.',
        'Analysts question the stream in SQL, the everyday language for data; one question is called a query. Our example has 9 events, worth 45 clicks in all.',
        'The analysts want clicks per stretch of time. Cut time one way and the answer has 4 rows. Cut it a second way and the rows add up to 78, more than the 45 clicks that exist.',
        'Cut it a third way and you get 5 rows, a number nobody could have predicted from the query. This part explains all three.',
        'And it asks when each answer is sent, and why one of them never is. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Clock', layout: 'table', defines: ['event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order they arrived. Each carries two times: when the clicks happened, and how long after that the message was seen.',
      table: {
        columns: ['id', 'key', 'et · happened at', 'pt · seen', 'v · value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hh(e.et)}</b>` : hh(e.et), i === 7 ? `<b>${e.pt - e.et} s later</b> · ${hh(e.pt)}` : `${e.pt - e.et} s later`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> (et) — when the clicks happened.</li><li><b>Processing time</b> (pt) — when the message was seen.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Ids 6 and 7 are.[[src:why]]</li></ul><p>In this part every slice is cut by event time.</p>' },
      narration: [
        'Each event carries two times. The first, et, is when the clicks happened: its event time. The second, pt, is when the message was seen: its processing time. Id 0 was seen 1 second after it happened.',
        'Most are seen within seconds. Id 4 happened at 12:04:05 and was seen 1 second later. Id 5 happened at 12:04:20.',
        'But id 6 happened at 12:03:40, earlier than id 5, and arrived after it. And id 7 happened at 12:00:50 but was seen 230 seconds later, at 12:04:40.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. In this part, every slice of time is cut by event time: when the clicks really happened.'
      ]
    },

    /* ---------- 3 · question: equal slices ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window', 'tumble'],
      eyebrow: '03 · Your turn · the first way to cut',
      heading: 'Equal two-minute slices, side by side',
      stand: 'Cut event time into slices of 2 minutes: 12:00 to 12:02, 12:02 to 12:04, 12:04 to 12:06, and so on, with nothing in between.',
      question: {
        step: 0,
        prompt: 'Into how many of these slices does each event fall?',
        options: [
          { text: 'Exactly one: the slice its event time lies in.', correct: true,
            why: 'The slices touch but never overlap, so every moment belongs to one slice, and so does every event.' },
          { text: 'Two: the slice it happened in and the slice it was seen in.', correct: false,
            why: 'Only one clock is used to cut, here event time. When it was seen plays no part.' },
          { text: 'It depends on how many events are near it.', correct: false,
            why: 'The slices are fixed in advance. Other events cannot move an event into another slice.' }
        ]
      },
      cards: [
        { step: 1, title: 'Window', html: '<p>Each slice of time that results are totalled over is a <b>window</b>.[[src:win]]</p>' },
        { step: 1, title: 'TUMBLE', html: '<p><code>TUMBLE(et, INTERVAL \'120\' SECOND)</code> makes equal windows that never overlap: the fixed window, spelled in SQL.[[src:win]]</p>' }
      ],
      narration: [
        'First question. Cut event time into 2-minute slices, side by side: 12:00 to 12:02, 12:02 to 12:04, and so on. Into how many slices does each event fall? Choose an answer.',
        'Exactly one. Each slice of time a total is taken over is called a window. In SQL these equal, never-overlapping windows are written TUMBLE, with the time column and the width: event time, 120 seconds.'
      ]
    },

    /* ---------- 4 · TUMBLE, animated ---------- */
    {
      title: 'Fixed', layout: 'array',
      eyebrow: '04 · Watch each event drop into its window',
      heading: 'Every event counted once',
      stand: 'Slots are the events in arrival order. Row 2 is the window each one lands in. The sweep adds every value.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => hh(e.et)) },
          { label: 'its window starts', values: E.map(e => mm(winOf(e.et))) },
          { label: 'value', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'total counted'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'pick', slots: [7] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 }
        ]
      },
      cards: [
        { step: 2, title: '4 rows', html: '<p>12:00 to 12:02: <b>' + TUM[0] + '</b> · 12:02 to 12:04: <b>' + TUM[1] + '</b> · 12:04 to 12:06: <b>' + TUM[2] + '</b> · 12:08 to 12:10: <b>' + TUM[3] + '</b>.[[src:why]]</p>' },
        { step: 3, title: 'They add up to the data', html: '<p>The engine’s 4 totals make 45, the whole dataset. So a TUMBLE result can be checked against one plain total of everything: the easy case. What actually gets sent out comes later.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 9 event times in arrival order. Ids 6 and 7 jump backwards.',
        'Each event lands in the window its event time lies in. Id 7, highlighted, was seen last but lands in the first window, 12:00 to 12:02.',
        'Now watch every value being counted once. 9 events read; 45 counted. Per window: 19, 11, 7 and 8.',
        'Those 4 totals, inside the engine, add up to 45, the whole dataset. That is what makes TUMBLE the easy case: its result can be checked against one plain total of everything. What actually gets sent out comes later.'
      ]
    },

    /* ---------- 5 · question: overlapping slices ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['hop'],
      eyebrow: '05 · Your turn · the second way to cut',
      heading: 'Two-minute windows, a new one every minute',
      stand: 'Now each window is still 2 minutes long, but a new one starts every 60 seconds: 12:00 to 12:02, 12:01 to 12:03, 12:02 to 12:04…',
      question: {
        step: 0,
        prompt: 'Id 4 happened at 12:04:05. How many of these windows hold it?',
        options: [
          { text: 'Two: 12:03 to 12:05, and 12:04 to 12:06.', correct: true,
            why: 'Windows now overlap. 12:04:05 lies inside the one that started at 12:03 and inside the one that started at 12:04.' },
          { text: 'One: 12:04 to 12:06, as before.', correct: false,
            why: 'That window holds it, but the one from 12:03 to 12:05 still runs at 12:04:05, so it holds it too.' },
          { text: 'Four: every window that starts near 12:04.', correct: false,
            why: 'Only windows that are still running at 12:04:05 hold it. Each one lasts 2 minutes, so at most two can.' }
        ]
      },
      cards: [
        { step: 1, title: 'HOP', html: '<p><code>HOP</code> takes a step, here 60 s, and a length, here 120 s. Windows overlap, so one event can be in 2 of them: the sliding window, in SQL.[[src:win]]</p>' },
        { step: 1, title: 'A rolling figure', html: '<p>It answers “the last 2 minutes, refreshed every minute”.[[src:walk]]</p>' }
      ],
      narration: [
        'Second question. Now each window is still 2 minutes long, but a new one starts every 60 seconds, so they overlap. Id 4 happened at 12:04:05. How many windows hold it? Choose an answer.',
        'Two: 12:03 to 12:05, and 12:04 to 12:06. Overlapping windows like these are written HOP, with a step of 60 seconds and a length of 120. They answer “the last 2 minutes, refreshed every minute”.'
      ]
    },

    /* ---------- 6 · HOP, animated ---------- */
    {
      title: 'Hop', layout: 'array',
      eyebrow: '06 · Watch the seven overlapping windows add up',
      heading: 'Seven rows, totalling more than the data',
      stand: 'Slots are the HOP windows that hold at least one event. Row 2 lists the event ids inside each; row 3 is its total.',
      array: {
        labelWidth: 150, slotLabel: 'row',
        rows: [
          { label: 'window', values: HOP_STARTS.map(s => `${mm(s)}–${mm(s + W)}`) },
          { label: 'event ids in it', values: HOP_IDS.map(ids => ids.join(', ')) },
          { label: 'total', values: HOP_SUM }
        ],
        meters: ['rows read', 'sum of the rows'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'pick', slots: [3, 4] }
        ]
      },
      cards: [
        { step: 2, title: 'Counted twice', html: '<p>Id 4 is in both 12:03–12:05 and 12:04–12:06. In all, 6 of the 9 events land in 2 rows each.[[src:why]]</p>' },
        { step: 3, title: '2× the rows, 2× the memory', html: '<p>Length ÷ step = 120 ÷ 60 = 2: in steady state each event sits in 2 windows. Budget twice the rows and twice the stored totals. This short run shows less, ' + HOP_STARTS.length + ' rows against ' + TUM.length + ', because the ' + EDGE.length + ' events before 12:01 have no earlier window.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 7 HOP windows that hold anything, and the events in each. Notice ids appearing twice: 2, 3, 4, 5, 6 and 8 each sit in two neighbouring windows.',
        'Watch the 7 totals being added: 19, 9, 11, 16, 7, 8 and 8. The rows add up to 78, although only 45 clicks exist.',
        'The two highlighted windows both hold id 4. In all, 6 of the 9 events land in 2 rows each, and that is the whole reason for 78.',
        'So plan HOP for twice the rows, and twice the totals to keep in memory: the length, 120 seconds, divided by the step, 60. This short run shows less, 7 rows against 4, only because the 3 events before 12:01 have no earlier window to land in.'
      ]
    },

    /* ---------- 7 · question: 78 against 45 ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '07 · Your turn',
      heading: 'Someone files a bug: “the HOP total is wrong”',
      stand: 'A colleague adds up the HOP rows, gets 78, compares it with the 45 clicks in the data, and reports a bug.',
      question: {
        step: 0,
        prompt: 'Who is right?',
        options: [
          { text: 'Nobody has a bug: 78 is correct, and must not be compared with 45.', correct: true,
            why: 'Each HOP row is a correct rolling total. Overlapping windows count most events twice, so their sum is not a count of clicks.' },
          { text: 'The colleague: the rows of any query should add up to the 45 clicks.', correct: false,
            why: 'Only windows that never overlap add up to the data. HOP windows overlap by design.' },
          { text: 'The engine: it counted 6 of the events twice, by mistake.', correct: false,
            why: 'No mistake: an event really is inside both overlapping windows, so both rows rightly include it.' }
        ]
      },
      cards: [
        { step: 1, title: 'The failure is in reading it', html: '<p>With HOP the danger is not speed but interpretation: someone compares 78 to 45 and files a bug.[[src:when]]</p>' }
      ],
      narration: [
        'Third question. A colleague adds up the HOP rows, gets 78, compares it with the 45 clicks in the data, and reports a bug. Who is right? Choose an answer.',
        'Nobody has a bug. Each row is a correct rolling total, and overlapping windows count most events twice. A HOP total must simply never be compared with the input total.'
      ]
    },

    /* ---------- 8 · question: bursts ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['session', 'gap'],
      eyebrow: '08 · Your turn · the third way to cut',
      heading: 'Windows shaped by the activity itself',
      stand: 'Key a’s events happened at 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00. Rule: a burst of activity ends after 2 minutes of silence.',
      question: {
        step: 0,
        prompt: 'With that rule, how many bursts of activity does key a have?',
        options: [
          { text: 'Three: the silences after 12:00:03 and after 12:04:05 are each longer than 2 minutes.', correct: true,
            why: '12:00:03 to 12:02:10 is just over 2 minutes, and 12:04:05 to 12:09:00 far more. 12:02:10 to 12:04:05 is just under.' },
          { text: 'Five: every event starts its own burst.', correct: false,
            why: 'Events closer than 2 minutes stay together. 12:00:01 and 12:00:03 are 2 seconds apart.' },
          { text: 'Four, one for each 2-minute slice they fall in.', correct: false,
            why: 'This rule ignores fixed slices. Only the silences between events decide where a burst ends.' }
        ]
      },
      cards: [
        { step: 1, title: 'Session and gap', html: '<p>A burst of activity per key is a <b>session</b>; the silence that ends it is the <b>gap</b>, here 120 s. <code>SESSION(et, INTERVAL \'120\' SECOND)</code>.[[src:win]]</p>' }
      ],
      narration: [
        'Fourth question. Key a’s events happened at 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00. A burst ends after 2 minutes of silence. How many bursts does key a have? Choose an answer.',
        'Three. A burst of activity is called a session, and the silence that ends it is the gap, here 120 seconds. In SQL it is written SESSION. Let us watch the breaks being found.'
      ]
    },

    /* ---------- 9 · SESSION, animated ---------- */
    {
      title: 'Sess', layout: 'array', defines: ['merge', 'updating'],
      eyebrow: '09 · Watch key a’s sessions being found',
      heading: 'The data decides how many rows there are',
      stand: 'Key a’s events in event-time order. A new session starts wherever the silence before an event is longer than 2 minutes.',
      array: {
        labelWidth: 150, slotLabel: 'in event-time order',
        rows: [
          { label: 'event id', values: A_EVENTS.map(e => `id ${e.id}`) },
          { label: 'event time', values: A_EVENTS.map(e => hh(e.et)) },
          { label: 'starts a session?', values: A_STARTS }
        ],
        meters: ['events read', 'sessions'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 2, title: 'a: 3 rows, b: 2 rows', html: '<p>Over the same stretch of time, key a gets ' + NS.a + ' sessions and key b ' + NS.b + '. No one can predict the count from the query: it is how bursty each key was.[[src:why]]</p>' },
        { step: 3, title: 'Boundaries that move', html: '<p>Key b’s first session began at 12:01:30. Then id 7, from 12:00:50, arrived and the engine stretched it back: it <b>merges</b>. A result that can change after it is sent is <b>updating</b>.[[src:why]]</p>' }
      ],
      narration: [
        'Here are key a’s five events, in the order they happened rather than the order they arrived.',
        'Watch the sweep mark where a new session starts: the first event, then 12:02:10, after just over 2 minutes of silence, then 12:09:00. Three sessions.',
        'Over the same stretch of time, key b gets only 2. So SESSION is the one window whose row count cannot be predicted from the query. You cannot plan capacity for it from the text.',
        'And sessions move. Key b’s began at 12:01:30, until id 7, from 12:00:50, arrived and stretched it back. The engine, the program running the query, merges sessions as events arrive, so a SESSION result is always updating: rows change after being sent.'
      ]
    },

    /* ---------- 10 · question: when to send ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['watermark', 'emit'],
      eyebrow: '10 · Your turn · when is a window’s answer sent?',
      heading: 'When may a window’s row go out?',
      stand: 'Events arrive out of order: id 7, from 12:00:50, is seen only at 12:04:40. The engine cannot see what is still on its way.',
      question: {
        step: 0,
        prompt: 'When should the engine send out the row for 12:00 to 12:02?',
        options: [
          { text: 'When it judges that nothing from before 12:02 is still on its way.', correct: true,
            why: 'That is the only sensible moment, and it can only be a judgement: nothing in the stream says so for certain.' },
          { text: 'As soon as the wall clock reads 12:02.', correct: false,
            why: 'Id 7 happened at 12:00:50 but arrives at 12:04:40. A wall clock cannot know what is still coming.' },
          { text: 'Only when the stream has ended.', correct: false,
            why: 'The stream never ends, so the row would never be sent at all.' }
        ]
      },
      cards: [
        { step: 1, title: 'The watermark', html: '<p>The engine’s judgement is one number: the <b>watermark</b>. Here it is the latest event time seen, minus 60 s.[[src:win]]</p>' },
        { step: 1, title: 'Emit', html: '<p>A window’s row is <b>emitted</b>, sent out, when the watermark passes the window’s end.[[src:win]]</p>' }
      ],
      narration: [
        'Fifth question. Events arrive out of order, so the engine cannot see what is still on its way. When should it send out the row for 12:00 to 12:02? Choose an answer.',
        'When it judges nothing from before 12:02 is still coming. That judgement is a number called the watermark: the latest event time seen, minus 60 seconds. When it passes 12:02, the row is emitted, sent out.'
      ]
    },

    /* ---------- 11 · the watermark, animated ---------- */
    {
      title: 'Mark', layout: 'array',
      eyebrow: '11 · Watch the watermark move',
      heading: 'The latest event time seen, minus 60 seconds',
      stand: 'Slots are the events in arrival order. Top: each event time. Bottom: the watermark after it.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => hh(e.et)) },
          { label: 'watermark after', values: WM.map(wmText) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [4] },
          { step: 3, do: 'pick', slots: [8] }
        ]
      },
      cards: [
        { step: 2, title: 'After id 4', html: '<p>Latest 12:04:05, so the watermark is <b>12:03:05</b>, past 12:02. Window 12:00 to 12:02 is emitted holding <b>' + HELD[0] + '</b>; id 7 has not arrived.[[src:why]]</p>' },
        { step: 3, title: 'After id 8', html: '<p>12:08:00 passes 12:04 and 12:06, so those two windows go out. Nothing ever passes 12:10.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the nine event times again, in the order the events arrived. Ids 6 and 7 go backwards.',
        'Below them, the watermark after each event: the latest event time seen so far, minus 60 seconds. At ids 6 and 7 the event time goes backwards, so the watermark simply stays at 12:03:20.',
        'Look at id 4. The latest event time is 12:04:05, so the watermark becomes 12:03:05, past 12:02. Window 12:00 to 12:02 is emitted, holding 15. Id 7 is still on its way.',
        'And id 8 lifts the watermark to 12:08:00, past 12:04 and 12:06, so those two windows go out. Then the events stop, and nothing ever passes 12:10.'
      ]
    },

    /* ---------- 12 · what each window emits ---------- */
    {
      title: 'Emit', layout: 'table', defines: ['sink'],
      eyebrow: '12 · The four TUMBLE windows, and what the sink receives',
      heading: 'Three rows go out. One never does.',
      stand: 'The query is the same TUMBLE as before. What reaches the sink, the place results are written, depends on the watermark.',
      table: {
        columns: ['window', 'final total', 'emitted', 'holding'],
        rows: STARTS.map((s, k) => ({ step: k === 0 ? 0 : k < 3 ? 1 : 2,
          cells: [`${mm(s)} to ${mm(s + W)}`, `${TUM[k]}`, CLOSED[k] === null ? '<b>never</b>' : `after id ${E[CLOSED[k]].id}`, HELD[k] === null ? '<b>nothing reaches the sink</b>' : (HELD[k] === TUM[k] ? `${HELD[k]}` : `<b>${HELD[k]}</b>, then ${TUM[k]} when id 7 arrives`)] }))
      },
      side: { step: 3, title: 'Bucket and moment', html: '<p>The time column picks which window a row goes in. The watermark picks the moment the window speaks. Only the first is written in the SQL.[[src:walk]]</p>' },
      narration: [
        'The results go to a sink: wherever they are written. Window 12:00 to 12:02 is emitted after id 4, holding 15, and changed to 19 when id 7 arrives.',
        'Windows 12:02 to 12:04 and 12:04 to 12:06 are emitted after id 8, holding their final totals, 11 and 7.',
        'But window 12:08 to 12:10 holds 8 and is never emitted. The watermark never passes 12:10, so the sink never hears of it. No error, no row. So the sink ends up holding 37, not the 45 the engine counted.',
        'The time column picks which window a row goes in. The watermark picks the moment the window speaks. Both are needed, and only the first is written in the SQL.'
      ]
    },

    /* ---------- 13 · question: the missing row ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'A window that never arrives',
      stand: 'Window 12:08 to 12:10 holds 8 clicks, and the sink never receives it.',
      question: {
        step: 0,
        prompt: 'What in the SQL query warns you that this window will never be emitted?',
        options: [
          { text: 'Nothing: when a window speaks is set by the engine’s watermark, not the query.', correct: true,
            why: 'The query says which window a row belongs to. The moment of emission comes from engine settings the text never mentions.' },
          { text: 'The window width: 120 seconds is too short to ever be complete.', correct: false,
            why: 'A longer window would still need the watermark to pass its end. The width is not the cause.' },
          { text: 'The word TUMBLE: the other window types always emit their rows.', correct: false,
            why: 'Every window type waits for the watermark. HOP and SESSION windows can be left unsent just the same.' }
        ]
      },
      cards: [
        { step: 1, title: 'Ask about the engine', html: '<p>For any of the three, find out the engine’s watermark settings. The window is in your SQL; the moment of emission is not.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. Window 12:08 to 12:10 holds 8 clicks, and the sink never receives it. What in the SQL query warns you? Choose an answer.',
        'Nothing. The query says which window a row belongs to; when it is emitted comes from the engine’s watermark. So for all three window types, find out the engine’s watermark settings.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Three ways to cut time, three cost profiles, one watermark',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b>, <b>processing time</b>', 'When it happened, and when it was seen. Windows here are cut by event time.[[src:why]]'] },
          { step: 0, cells: ['<b>TUMBLE</b>', 'Equal windows, no overlap: 4 rows, 19, 11, 7, 8, adding up to the data’s 45.[[src:why]]'] },
          { step: 1, cells: ['<b>HOP</b>', 'Overlapping windows: 7 rows totalling 78. Plan for twice the rows; never compare with 45.[[src:why]]'] },
          { step: 1, cells: ['<b>SESSION</b> and <b>gap</b>', 'Bursts per key, ended by 120 s of silence: a has 3, b has 2. Unpredictable count; merges, so updating.[[src:why]]'] },
          { step: 2, cells: ['<b>Watermark</b> and <b>emit</b>', 'A window is sent when the watermark passes its end. 12:08 to 12:10 never is.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>A window over one stream has one watermark. A join of two streams has two, and the slower one holds back every result.[[src:when]]</p>' },
      narration: [
        'To recap. Every event has an event time and a processing time; these windows are cut by event time. TUMBLE makes equal windows with no overlap: 4 rows that add up to the data’s 45.',
        'HOP makes overlapping windows: 7 rows totalling 78; plan for twice the rows, and never compare with 45. SESSION follows bursts of activity: key a gets 3, key b gets 2, and sessions merge.',
        'And a window is emitted only when the watermark passes its end. The window from 12:08 to 12:10 never is, and nothing in the SQL says so.',
        'Next, part 3 joins two streams. A join has two watermarks, and the slower stream holds back every result.'
      ]
    }
  ]
};
