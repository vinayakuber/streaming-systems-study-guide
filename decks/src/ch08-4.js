// Chapter 8, Part 4 — the chapter's "System Design Interview": a continuous SQL query that keeps
// a click total current, built one component at a time (streams, SQL engine, watermark + window,
// sink). Each component is preceded by a question; the one result row is then followed through
// the run (array, sequence), the design is assembled (graph), and the deck closes with the four
// things the query does not settle. The story, the two clocks and every word are re-introduced,
// so the deck stands alone. Every time and value comes from tools/stream_seed.js and is asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch08';
const E = seed.EVENTS;
const hh = seed.hhmmss;
const W = seed.WIN;
const mm = t => hh(t).slice(0, 5);
const winOf = t => Math.floor(t / W) * W;
const WM = seed.WATERMARKS;
const RUN0 = E.map((_, i) => E.slice(0, i + 1).filter(e => winOf(e.et) === 0).reduce((n, e) => n + e.v, 0));
const CI = seed.closedAt(0), L = seed.LATE[0], LI = E.indexOf(L);
const ONTIME = RUN0[CI], TRUE = seed.SUM(seed.WINDOWS[0]);
const TUM = seed.WIN_STARTS.map(s => seed.SUM(seed.WINDOWS[s]));
const BY_PT = seed.WIN_STARTS.map(s => E.filter(e => winOf(e.pt) === s).reduce((n, e) => n + e.v, 0));
const NEVER = seed.WIN_STARTS.filter(s => seed.closedAt(s) === null);

if (CI !== 4 || ONTIME !== 15 || TRUE !== 19 || ONTIME + TRUE !== 34 || L.id !== 7 || LI !== 7 || hh(E[CI].pt) !== '12:04:06'
  || hh(WM[CI]) !== '12:03:05' || hh(L.pt) !== '12:04:40' || hh(L.et) !== '12:00:50' || TUM.join() !== '19,11,7,8'
  || BY_PT.join() !== '15,2,20,8' || NEVER.join() !== '480' || seed.SESSIONS.a.length + seed.SESSIONS.b.length !== 5)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Live Click Total Design',
  eyebrow: 'Streaming · Ch 8 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'TUMBLE': 'tumble', 'HOP': 'hop', 'SESSION': 'session', 'GROUP BY': 'group by', 'SELECT': 'select', 'FROM': 'from', 'UPSERT': 'upsert', 'INSERT': 'insert' } },
  legend: { main: 'carries the rows', change: 'decides the moment', new: 'must replace rows', ext: 'outside the query' },
  jargon: ['event', 'stream', 'value', 'SQL', 'query', 'engine', 'event time', 'processing time', 'out of order', 'time attribute',
    'continuous query', 'window', 'tumble', 'watermark', 'emit', 'late', 'updating', 'retraction', 'sink', 'upsert', 'insert-only',
    'hop', 'session', 'allowed lateness'],
  sources: {
    ch:     chapter(CH, 'Chapter 8 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 8 · system design interview'),
    streams: section(CH, 'click stream (sources a, b)', 'Chapter 8 · the click stream'),
    eng:    section(CH, 'SQL engine (continuous query)', 'Chapter 8 · the SQL engine'),
    wm:     section(CH, 'watermark + window', 'Chapter 8 · watermark and window'),
    sink:   section(CH, 'sink', 'Chapter 8 · the sink'),
    why:    section(CH, 'Why the sink requirement is readable from the query, and the timing is not', 'Chapter 8 · what the query text tells you'),
    when:   section(CH, 'When this design is right, and the four things it does not settle', 'Chapter 8 · the four gaps'),
    prog:   section(CH, 'The continuous query — stack and heap at every step', 'Chapter 8 · the query as a program')
  },

  slides: [
    /* ---------- 1 · the brief ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'value', 'SQL', 'query', 'engine', 'late'],
      eyebrow: '01 · Chapter 8 · Part 4 · a system design interview',
      heading: 'Keep a click total current, even when clicks arrive late',
      hero: { step: 0, text: 'A company counts clicks on its adverts. Messages saying “some clicks happened” arrive from two sources, a and b; each message is an <b>event</b>, carrying a <b>value</b>: how many clicks. They never stop: a <b>stream</b>. The interviewer wants a <b>query</b> in <b>SQL</b>, the everyday language for questions about data, that keeps a total per 2 minutes current, run by an <b>engine</b>: the program that runs the query. Some clicks arrive <b>late</b>: after the total for their 2 minutes has been sent.[[src:sd]]' },
      tiles: [
        { step: 1, value: W, suffix: ' s', label: 'per slice of time: one total each[[src:eng]]' },
        { step: 1, value: 9, label: 'events in our example' },
        { step: 2, value: ONTIME, label: 'what the first total says when first sent[[src:why]]' },
        { step: 2, value: TRUE, label: 'what it says once a late click arrives[[src:why]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'What every event must carry', text: 'So a late one can still be counted right.' },
        { step: 3, n: 2, title: 'What the engine does, and when it speaks', text: 'A total that is never finished.' },
        { step: 4, n: 3, title: 'What the destination must be able to do', text: 'When a total it already holds changes.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. At the end: what this design does not settle.[[src:sd]]' },
      narration: [
        'A company counts clicks on its adverts. Each message saying some clicks happened is an event, carrying a value: how many clicks. They never stop: a stream. The program that runs a query over it is the engine.',
        'The interviewer asks for a query, in SQL, that keeps a total for every 2 minutes current. Our example has 9 events.',
        'The total for the first 2 minutes will be sent as 15, and later become 19, when a late click arrives. The design must stay correct through that change.',
        'It must decide three things. What every event must carry. What the engine does with each event, and when it speaks.',
        'And what the destination of the totals must be able to do when a total it already holds changes. You will choose first, each time.'
      ]
    },

    /* ---------- 2 · the data and its two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order they arrive. Each carries its source, two times and its value.',
      table: {
        columns: ['id', 'source', 'et · happened at', 'pt · seen', 'v · value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hh(e.et)}</b>` : hh(e.et),
            i === 7 ? `<b>${e.pt - e.et} s later</b> · ${hh(e.pt)}` : i === 4 ? `${e.pt - e.et} s later · ${hh(e.pt)}` : `${e.pt - e.et} s later`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> (et) — when the clicks happened.</li><li><b>Processing time</b> (pt) — when the message was seen.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Ids 6 and 7 are.[[src:streams]]</li></ul>' },
      narration: [
        'Each event carries two times. The first, et, is when the clicks happened: its event time. The second, pt, is when the message was seen: its processing time. Most are seen within seconds.',
        'Id 4, from source a, happened at 12:04:05 and is seen at 12:04:06. Id 6 happened at 12:03:40, earlier than id 5, but arrives after it.',
        'And id 7, from source b, happened at 12:00:50 but is seen only at 12:04:40, 230 seconds later.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. Id 7 is the one this design has to survive.'
      ]
    },

    /* ---------- 3 · component 1: the streams ---------- */
    {
      title: 'Input', layout: 'ask', defines: ['time attribute'],
      eyebrow: '03 · Your turn · component 1, the streams',
      heading: 'What must each event bring with it?',
      stand: 'Id 7 happened at 12:00:50 and arrives at 12:04:40. The total for 12:00 to 12:02 must still count it.',
      question: {
        step: 0,
        prompt: 'For id 7 to be counted in the right 2 minutes, what must it carry?',
        options: [
          { text: 'The time it happened, stamped where it happened.', correct: true,
            why: 'Then the engine can place it in 12:00 to 12:02 however late it arrives. Nothing else records when it happened.' },
          { text: 'Nothing: the engine notes the time it arrives.', correct: false,
            why: 'Its arrival time, 12:04:40, would put it in the wrong 2 minutes, with clicks it never happened near.' },
          { text: 'A number giving its place in the stream.', correct: false,
            why: 'Its place in the arrival order is 8th of 9, which says nothing about when the clicks happened.' }
        ]
      },
      cards: [
        { step: 1, title: 'Event time on every event', html: '<p>Id 4: source a, et 12:04:05, value 6, arrives at 12:04:06. Id 7: source b, et 12:00:50, value 4, arrives at 12:04:40, after the total for its 2 minutes has been sent.[[src:streams]]</p>' },
        { step: 2, title: 'The time attribute', html: '<p>The time column the query cuts by is its <b>time attribute</b>. Here it is event time, so both events carry it.[[src:streams]]</p>' }
      ],
      narration: [
        'Component one, the streams. Id 7 happened at 12:00:50 and arrives at 12:04:40. For it to be counted in the right 2 minutes, what must it carry? Choose an answer.',
        'The time it happened, stamped where it happened. Id 4 carries 12:04:05 and arrives at 12:04:06; id 7 carries 12:00:50 and arrives at 12:04:40, after the total for its 2 minutes has already been sent.',
        'The time column a query cuts by is called its time attribute. In this design it is event time, so every event must carry it.'
      ]
    },

    /* ---------- 4 · component 2: the engine ---------- */
    {
      title: 'Query', layout: 'ask', defines: ['continuous query', 'window', 'tumble'],
      eyebrow: '04 · Your turn · component 2, the SQL engine',
      heading: 'One line of SQL, run forever',
      stand: 'The query: SELECT SUM(v) FROM clicks GROUP BY TUMBLE(et, INTERVAL \'120\' SECOND) — one total per 2-minute slice of event time.',
      question: {
        step: 0,
        prompt: 'What does the engine do with each event as it arrives?',
        options: [
          { text: 'Adds its value to the slice its event time falls in, and keeps going.', correct: true,
            why: 'Each slice keeps a running total. The stream never ends, so neither does the query.' },
          { text: 'Stores it, and adds everything up once the stream ends.', correct: false,
            why: 'The stream never ends, so the total would never be produced at all.' },
          { text: 'Adds its value to the slice it arrived in.', correct: false,
            why: 'The query names et, the event time. Arrival time would put id 7 in the wrong slice.' }
        ]
      },
      cards: [
        { step: 1, title: 'Continuous query', html: '<p>A query that runs forever and keeps its answer up to date as events arrive is a <b>continuous query</b>.[[src:eng]]</p>' },
        { step: 2, title: 'Window, and TUMBLE', html: '<p>Each slice is a <b>window</b>. <b>TUMBLE</b> makes them equal and never overlapping: one total per window.[[src:eng]]</p>' }
      ],
      narration: [
        'Component two, the SQL engine. The query asks for the sum of the values, grouped into 2-minute slices of event time. What does the engine do with each event as it arrives? Choose an answer.',
        'Adds its value to the slice its event time falls in, and keeps going. A query that runs forever like this, keeping its answer current, is called a continuous query.',
        'Each slice is called a window. TUMBLE makes them equal and never overlapping, so there is one total per window. The engine folds each event into the right one.'
      ]
    },

    /* ---------- 5 · component 3: when to speak ---------- */
    {
      title: 'When', layout: 'ask', defines: ['watermark', 'emit'],
      eyebrow: '05 · Your turn · component 3, watermark and window',
      heading: 'A total that is never finished. When is it sent?',
      stand: 'The window 12:00 to 12:02 keeps a running total. The engine cannot see which events are still on their way.',
      question: {
        step: 0,
        prompt: 'When should the engine send out the total for 12:00 to 12:02?',
        options: [
          { text: 'When it judges that nothing from before 12:02 is still coming.', correct: true,
            why: 'It can only be a judgement. The engine needs a rule for it, made from what it has already seen.' },
          { text: 'When the wall clock reads 12:02.', correct: false,
            why: 'Id 7, from 12:00:50, is still on its way at 12:02. The wall clock cannot know that.' },
          { text: 'Never: a total is only right once the stream ends.', correct: false,
            why: 'The stream never ends, so nobody would ever see a total.' }
        ]
      },
      cards: [
        { step: 1, title: 'The watermark', html: '<p>The engine’s judgement is the <b>watermark</b>: the latest event time seen, minus 60 s.[[src:wm]]</p>' },
        { step: 1, title: 'Emit', html: '<p>When the watermark passes the window’s end, the total is <b>emitted</b>: sent out.[[src:wm]]</p>' }
      ],
      narration: [
        'Component three, the watermark and the window. The total for 12:00 to 12:02 is never certain to be finished. When should the engine send it? Choose an answer.',
        'When it judges nothing earlier is still coming. That judgement is the watermark: the latest event time seen, minus 60 seconds. When it passes the window’s end, the total is emitted, sent out. Watch it run.'
      ]
    },

    /* ---------- 6 · the run, animated ---------- */
    {
      title: 'Run', layout: 'array',
      eyebrow: '06 · Watch the engine fold each event in, and the watermark move',
      heading: 'The window 12:00 to 12:02, event by event',
      stand: 'Slots are the events in arrival order. Row 2: the running total of window 12:00 to 12:02. Row 3: the watermark after the event.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => hh(e.et)) },
          { label: '12:00–12:02 total', values: RUN0 },
          { label: 'watermark', values: WM.map(w => (w < 0 ? 'before 12:00' : hh(w))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'pick', slots: [CI] },
          { step: 2, do: 'pick', slots: [LI] }
        ]
      },
      cards: [
        { step: 1, title: 'Emitted: 15', html: '<p>After id 4 the watermark is ' + hh(WM[CI]) + ' (12:04:05 − 60 s), past 12:02, at 12:04:06. The engine emits <b>' + ONTIME + '</b>.[[src:wm]]</p>' },
        { step: 2, title: 'Then id 7', html: '<p>It happened at 12:00:50 but arrives at 12:04:40, after its window was sent: it is <b>late</b>. The total becomes <b>' + TRUE + '</b>.[[src:why]]</p>' }
      ],
      narration: [
        'Top row: each event time, in arrival order. Second row: the running total of the window 12:00 to 12:02. It reaches 15 after id 2, and stays there.',
        'Third row: the watermark. After id 4 it is 12:04:05 minus 60 seconds: 12:03:05, past 12:02. So at 12:04:06 the engine emits 15.',
        'Then id 7 arrives at 12:04:40. It happened at 12:00:50, so it belongs to a window already sent: it is late. The window’s total becomes 19.'
      ]
    },

    /* ---------- 7 · question: the late event ---------- */
    {
      title: 'Late', layout: 'ask', defines: ['updating', 'retraction'],
      eyebrow: '07 · Your turn · what the engine sends next',
      heading: '15 is already out. Now id 7 arrives.',
      stand: 'The brief says the count must stay correct as late clicks arrive. The engine has already sent 15 for 12:00 to 12:02.',
      question: {
        step: 0,
        prompt: 'What should the engine send when id 7 arrives?',
        options: [
          { text: 'Withdraw the 15, and send 19 in its place.', correct: true,
            why: 'The window’s true total is 19. Saying so means taking back the 15 already sent, not just adding a row.' },
          { text: 'Nothing: that window has already been sent.', correct: false,
            why: 'Then the total stays 15 for ever, 4 clicks short, against the brief.' },
          { text: 'Just the 4 from id 7, as a new row.', correct: false,
            why: 'A separate 4 is not the window’s total. Whoever reads it has to know to add it to the 15.' }
        ]
      },
      cards: [
        { step: 1, title: 'Retraction', html: '<p>Taking back a row already sent is a <b>retraction</b>: 15 is retracted and 19 added.[[src:sink]]</p>' },
        { step: 1, title: 'Updating', html: '<p>A result whose rows can change after being sent is <b>updating</b>. A windowed total is; 1 of its 4 window rows changes here.[[src:why]]</p>' }
      ],
      narration: [
        'The engine has already sent 15 for the first window. Now id 7 arrives. What should the engine send? Choose an answer.',
        'Withdraw the 15, and send 19 in its place. Taking back a row already sent is called a retraction. A result whose rows can change like this is called updating: here 1 of the 4 window rows changes.'
      ]
    },

    /* ---------- 8 · component 4: the sink ---------- */
    {
      title: 'Sink', layout: 'ask', defines: ['sink', 'upsert'],
      eyebrow: '08 · Your turn · component 4, the sink',
      heading: 'Where the totals land must cope with a change',
      stand: 'The totals are written to a sink: a table, a dashboard. It receives 15 for 12:00 to 12:02, then a retraction of 15 and a 19.',
      question: {
        step: 0,
        prompt: 'What must the sink be able to do?',
        options: [
          { text: 'Replace the row for a window when a new value for it arrives.', correct: true,
            why: 'One row per window, overwritten with the latest total: 15, then 19. Retractions are applied correctly.' },
          { text: 'Only add each row it receives as a new line.', correct: false,
            why: 'Then 15 and 19 both stay, as two facts about one window. Next question: what that shows.' },
          { text: 'Nothing special: the engine sends only final totals.', correct: false,
            why: 'It does not. It sent 15 before id 7 existed for it, and the total changed afterwards.' }
        ]
      },
      cards: [
        { step: 1, title: 'Upsert', html: '<p>A sink that inserts a row or, if one exists for that window, replaces it, is an <b>upsert</b> sink. It applies retractions correctly.[[src:sink]]</p>' }
      ],
      narration: [
        'Component four, the sink: wherever the totals are written, a table or a dashboard. It receives 15, then a retraction of 15 and a 19. What must it be able to do? Choose an answer.',
        'Replace the row for a window when a new value arrives. A sink that inserts a row, or replaces the one already there for that window, is called an upsert sink. It applies retractions correctly.'
      ]
    },

    /* ---------- 9 · the wrong sink ---------- */
    {
      title: 'Add', layout: 'ask', defines: ['insert-only'],
      eyebrow: '09 · Your turn · the wrong sink',
      heading: 'A sink that only adds',
      stand: 'Suppose instead the sink keeps every row it receives and sums them per window. Every part is working exactly as designed.',
      question: {
        step: 0,
        prompt: 'What does that sink show for 12:00 to 12:02, a window worth 19?',
        options: [
          { text: '34: it adds 15 and then 19.', correct: true,
            why: 'Both emissions are treated as separate facts and summed. The query, engine and sink each behave correctly.' },
          { text: '19: it ignores the earlier 15.', correct: false,
            why: 'A sink that only adds has no idea the 19 replaces the 15. It keeps both.' },
          { text: '15: it never sees the 19.', correct: false,
            why: 'It does see the 19; it just treats it as one more row to add.' }
        ]
      },
      cards: [
        { step: 1, title: 'Insert-only', html: '<p>A sink that can only add rows is <b>insert-only</b>. Fine for results that never change; here it reads <b>34</b> for a window worth 19.[[src:prog]]</p>' },
        { step: 2, title: 'Nobody is broken', html: '<p>The mismatch is the sink’s update mode against the query’s, and that is knowable before any of this runs.[[src:prog]]</p>' }
      ],
      narration: [
        'Suppose the sink instead keeps every row it receives and sums them per window. What does it show for the first window, which is worth 19? Choose an answer.',
        'Thirty-four: 15 plus 19. A sink that can only add rows is called insert-only. It is fine for results that never change, and wrong for this one.',
        'And notice that nobody is broken. The query, the engine and the sink each behave correctly. The mismatch is between the sink and the kind of result, and it was knowable in advance.'
      ]
    },

    /* ---------- 10 · the one row, as a sequence ---------- */
    {
      title: 'Trace', layout: 'sequence',
      eyebrow: '10 · Follow the one result row through the design',
      heading: 'Two emissions for one window',
      stand: 'Time runs top to bottom. The window 12:00 to 12:02, from the first emission to the late correction.',
      sequence: {
        actors: [
          { name: 'Streams', sub: 'events with event time', src: 'streams' },
          { name: 'Engine', sub: 'runs the query', src: 'eng' },
          { name: 'Watermark', sub: 'latest et − 60 s', src: 'wm' },
          { name: 'Sink', sub: 'replaces rows', highlight: true, src: 'sink' }
        ],
        messages: [
          { from: 'Streams', to: 'Engine', label: 'id 4 at 12:04:06 · window total 15', step: 0 },
          { from: 'Engine', to: 'Watermark', label: '12:04:05 − 60 s = 12:03:05', step: 0 },
          { from: 'Watermark', to: 'Engine', label: 'past 12:02: emit', step: 1 },
          { from: 'Engine', to: 'Sink', label: '12:00–12:02 = 15', step: 1 },
          { from: 'Streams', to: 'Engine', label: 'id 7 at 12:04:40 · happened 12:00:50', step: 2 },
          { from: 'Engine', to: 'Sink', label: 'retract 15 · add 19', step: 3 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Upsert sink:</b> 19. <b>Insert-only sink:</b> 34.[[src:prog]]' },
        { step: 3, html: '<b>None of 15, 19 or 12:04:06</b> appears anywhere in the SQL.[[src:why]]' },
        { step: 3, html: '<b>Whether id 7 is admitted at all</b> is an engine setting, not in the SQL.[[src:when]]' }
      ],
      narration: [
        'Id 4 reaches the engine at 12:04:06; the window 12:00 to 12:02 holds 15. The watermark becomes 12:04:05 minus 60 seconds: 12:03:05.',
        'That is past 12:02, so the engine emits the window, and the sink stores 15.',
        'At 12:04:40 id 7 arrives. It happened at 12:00:50, inside the window already sent.',
        'The engine retracts 15 and adds 19. An upsert sink now shows 19; an insert-only one would show 34. And none of 15, 19 or 12:04:06 appears anywhere in the SQL.'
      ]
    },

    /* ---------- 11 · question: what the text tells you ---------- */
    {
      title: 'Read', layout: 'ask',
      eyebrow: '11 · Your turn · read the query',
      heading: 'What can you know before anything runs?',
      stand: 'You have only the query text: one total per 2-minute window of event time.',
      question: {
        step: 0,
        prompt: 'Which of these can be read from the query text alone?',
        options: [
          { text: 'That the sink must be able to replace rows.', correct: true,
            why: 'A windowed total is an updating result, whatever the data. That is decidable from the text, before building anything.' },
          { text: 'That the first window will be sent at 12:04:06.', correct: false,
            why: 'The moment comes from the watermark the engine keeps, not from the query.' },
          { text: 'That the first window will be sent as 15, then 19.', correct: false,
            why: 'Those values depend on the data and on the watermark. The text contains neither.' }
        ]
      },
      cards: [
        { step: 1, title: 'Readable: the sink’s job', html: '<p>A windowed GROUP BY is updating, so the sink must UPSERT. Had it been a WHERE, which only lets rows through, an insert-only sink would do.[[src:why]]</p>' },
        { step: 1, title: 'Not readable: the timing', html: '<p>15, 19 and 12:04:06 all come from the watermark. The query got shorter; the meaning did not get simpler.[[src:why]]</p>' }
      ],
      narration: [
        'With only the query text in hand, which of these can you know before anything runs? Choose an answer.',
        'That the sink must be able to replace rows. A windowed total is always updating. But 15, 19 and 12:04:06 all come from the watermark, so the query got shorter while the meaning did not get simpler.'
      ]
    },

    /* ---------- 12 · the two choices still yours ---------- */
    {
      title: 'Pick', layout: 'table', defines: ['hop', 'session'],
      eyebrow: '12 · The choices that are still yours',
      heading: 'Four nearly identical lines, four different answers',
      stand: 'The window type and the time column are a few characters each. Change them and the result changes shape.',
      table: {
        columns: ['In the query', 'What comes out'],
        rows: [
          { step: 0, cells: ['<code>TUMBLE(et, 120 s)</code> — as designed', `4 rows: ${TUM.join(', ')}[[src:why]]`] },
          { step: 1, cells: ['<code>TUMBLE(pt, 120 s)</code> — the other clock', `4 rows: ${BY_PT.join(', ')}. 3 of the 4 differ.[[src:why]]`] },
          { step: 2, cells: ['<code>HOP</code> — overlapping windows', '7 rows totalling 78, against 45 clicks in the data[[src:why]]'] },
          { step: 3, cells: ['<code>SESSION</code> — bursts of activity', '5 rows: a count the query cannot predict[[src:why]]'] }
        ]
      },
      side: { step: 4, title: 'Review these first', html: '<p>None of the four is wrong; they answer different questions. They carry more meaning than the rest of the statement put together.[[src:when]]</p>' },
      narration: [
        'As designed, TUMBLE on event time gives 4 rows: 19, 11, 7 and 8.',
        'Change one word, the time column, to processing time: still 4 rows, but 15, 2, 20 and 8. Three of the four differ.',
        'HOP makes 2-minute windows that start every minute, so they overlap: 7 rows, totalling 78, though the data holds only 45 clicks.',
        'SESSION makes one window per burst of activity, ended by 2 minutes of silence: 5 rows, a count no one could predict from the query.',
        'None of these is wrong; they answer different questions. So when reviewing such a query, read the window and the clock first.'
      ]
    },

    /* ---------- 13 · the design, assembled ---------- */
    {
      title: 'Whole', layout: 'graph',
      eyebrow: '13 · The design, assembled',
      heading: 'Streams, engine, watermark and window, updating result, sink',
      stand: 'Each box is one answer you chose.',
      graph: {
        viewBox: '0 0 1520 300', legend: true,
        nodes: [
          { id: 'st', x: 20, y: 90, w: 250, h: 110, title: 'Streams', sub: 'events carry event time', kind: 'main', step: 0, src: 'streams', values: ['id 7: et 12:00:50'] },
          { id: 'en', x: 320, y: 90, w: 260, h: 110, title: 'SQL engine', sub: 'continuous query', kind: 'main', step: 1, src: 'eng', values: [null, 'TUMBLE(et, 120 s)'] },
          { id: 'wm', x: 630, y: 90, w: 260, h: 110, title: 'Watermark + window', sub: 'decides when to emit', kind: 'change', step: 2, src: 'wm', values: [null, null, 'emits 15 at 12:04:06'] },
          { id: 'up', x: 940, y: 90, w: 260, h: 110, title: 'Updating result', sub: 'retract 15, add 19', kind: 'new', step: 3, src: 'sink', values: [null, null, null, '1 of 4 rows revised'] },
          { id: 'sk', x: 1250, y: 90, w: 250, h: 110, title: 'Sink', sub: 'must upsert', kind: 'ext', step: 3, src: 'sink', values: [null, null, null, 'shows 19'] }
        ],
        edges: [
          { from: 'st', to: 'en', kind: 'main', step: 1 },
          { from: 'en', to: 'wm', kind: 'change', step: 2 },
          { from: 'wm', to: 'up', kind: 'new', step: 3 },
          { from: 'up', to: 'sk', kind: 'ext', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Readable from the query:</b> the result is updating, so the sink must upsert.[[src:why]]' },
        { step: 4, html: '<b>Not in the query:</b> when it emits, which comes from the watermark.[[src:why]]' },
        { step: 4, html: '<b>Never emitted:</b> the window 12:08 to 12:10, holding 8. No error, no row.[[src:when]]' }
      ],
      narration: [
        'Here is the whole design. First, the streams: every event carries its event time, so id 7 still says 12:00:50.',
        'Second, the SQL engine runs the continuous query, folding each event into its 2-minute window by event time.',
        'Third, the watermark and the window decide when each total is emitted: the first one at 12:04:06, holding 15.',
        'Fourth, the result is updating: when id 7 arrives, 15 is retracted and 19 added. And fifth, the sink must upsert, so it shows 19.',
        'What the query text tells you: the result is updating, so the sink must upsert. What it does not: when anything is emitted.'
      ]
    },

    /* ---------- 14 · what it does not settle ---------- */
    {
      title: 'Gaps', layout: 'ask', defines: ['allowed lateness'],
      eyebrow: '14 · Your turn · what this design does not settle',
      heading: 'The last window holds 8 clicks',
      stand: 'The window 12:08 to 12:10 holds id 8, worth 8. After id 8 no events arrive, and the watermark stays at 12:08:00.',
      question: {
        step: 0,
        prompt: 'What does the sink ever receive for 12:08 to 12:10?',
        options: [
          { text: 'Nothing: the watermark never passes 12:10, so it is never emitted.', correct: true,
            why: 'No error and no row. The sink simply never hears about it, and nothing in the SQL hints at that.' },
          { text: '8, as soon as id 8 arrives at 12:09:02.', correct: false,
            why: 'Arriving is not enough. A window is emitted only when the watermark passes its end, 12:10.' },
          { text: '8, at 12:10 on the wall clock.', correct: false,
            why: 'Emission follows the watermark, which is event time, and it stops at 12:08:00.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Four gaps · 1 and 2', html: '<ul class="l"><li>1 of the 4 windows is never emitted.</li><li>The engine chooses how corrections are sent; if they add up rather than replace, the window reads 34, not 19.[[src:when]]</li></ul>' },
        { step: 2, title: 'Four gaps · 3 and 4', html: '<ul class="l"><li><b>Allowed lateness</b>, how late an event may be and still count, is an engine setting: whether id 7 is admitted is not in the SQL.</li><li>SESSION’s row count, 5 here, cannot be planned for.[[src:when]]</li></ul>' }
      ],
      narration: [
        'The last window, 12:08 to 12:10, holds id 8, worth 8. After that no events arrive. What does the sink ever receive for it? Choose an answer.',
        'Nothing. The watermark stops at 12:08:00 and never passes 12:10, so the row is never emitted: no error, no row. And the engine chooses how corrections are sent; if they are added up, the window reads 34 instead of 19.',
        'Third, how late an event may be and still count, the allowed lateness, is an engine setting: whether id 7 is admitted at all is not in the SQL. Fourth, SESSION’s row count, 5 here, cannot be planned for.'
      ]
    },

    /* ---------- 15 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '15 · The design, a sentence per component',
      heading: 'Carry event time, fold forever, emit on the watermark, upsert',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Streams</b>', 'Every event carries its event time: id 7 says 12:00:50.', 'What must each event carry?[[src:streams]]'] },
          { step: 0, cells: ['<b>SQL engine</b>', 'Runs the continuous query: one total per 120 s window.', 'What happens to each event?[[src:eng]]'] },
          { step: 1, cells: ['<b>Watermark + window</b>', 'Emits when the watermark passes the end: 15 at 12:04:06.', 'When is a total sent?[[src:wm]]'] },
          { step: 1, cells: ['<b>Sink</b>', 'Upserts: 15, then 19. Insert-only would read 34.', 'What must it be able to do?[[src:sink]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'A window never emitted; how corrections are sent; allowed lateness; SESSION counts.', 'What is outside the SQL?[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>The sink’s requirement is readable from the query; the timing is not. The query got shorter; the meaning did not get simpler.[[src:why]]</p>' },
      narration: [
        'To recap. The streams carry event time on every event. The engine runs the query forever, one total per 2-minute window.',
        'The watermark decides when each total is emitted: 15 at 12:04:06. The sink must upsert, turning 15 into 19; an insert-only sink would read 34.',
        'What the query does not settle: a window that is never emitted, how corrections are sent, how late an event may be, and how many session rows there will be.',
        'In one line: the sink’s requirement can be read from the query, but the timing cannot.'
      ]
    }
  ]
};
