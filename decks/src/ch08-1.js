// Chapter 8, Part 1 — "SQL as a stream language", for a viewer who has read nothing before
// it. The click stream, its two clocks and every SQL word are introduced from zero; the viewer
// answers before each explanation; the filter, the two clocks and the late revision are shown
// happening (array, timeline) rather than described. Every time and value comes from the one
// seed (tools/stream_seed.js), and the numbers the narration quotes are asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch08';
const E = seed.EVENTS;
const hh = seed.hhmmss;
const W = seed.WIN;
const winOf = (t) => Math.floor(t / W) * W;
const total = (clock, start) => E.filter(e => winOf(e[clock]) === start).reduce((s, e) => s + e.v, 0);
const STARTS = seed.WIN_STARTS;
const BY_ET = STARTS.map(s => total('et', s));
const BY_PT = STARTS.map(s => total('pt', s));
const DIFFER = STARTS.filter((s, i) => BY_ET[i] !== BY_PT[i]).length;
const KEPT = E.filter(e => e.v > 5).map(e => e.id);
const GROUPS = [];
for (const s of STARTS) for (const k of seed.KEYS) {
  const v = E.filter(e => e.key === k && winOf(e.et) === s).reduce((n, e) => n + e.v, 0);
  if (E.some(e => e.key === k && winOf(e.et) === s)) GROUPS.push({ k, s, v });
}
const CLOSE = seed.closedAt(0);
const FIRST = E.filter((e, i) => i <= CLOSE && winOf(e.et) === 0).reduce((n, e) => n + e.v, 0);
const LATE = seed.LATE[0];
const range = s => `${hh(s).slice(0, 5)} to ${hh(s + W).slice(0, 5)}`;

if (E.length !== 9 || KEPT.join() !== '2,4,6,8' || GROUPS.length !== 7 || BY_ET.join() !== '19,11,7,8' || BY_PT.join() !== '15,2,20,8'
  || DIFFER !== 3 || CLOSE !== 4 || FIRST !== 15 || LATE.id !== 7 || hh(LATE.pt) !== '12:04:40' || hh(seed.WATERMARKS[4]) !== '12:03:05'
  || E.reduce((n, e) => n + e.v, 0) !== 45)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'SQL Over a Stream',
  eyebrow: 'Streaming · Ch 8 · Part 1',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'TUMBLE': 'tumble', 'WHERE': 'where', 'SELECT': 'select', 'GROUP BY': 'group by', 'FROM': 'from', 'HOP': 'hop', 'SESSION': 'session' } },
  jargon: ['event', 'key', 'value', 'stream', 'SQL', 'event time', 'processing time', 'out of order', 'table', 'row', 'column',
    'query', 'batch', 'continuous query', 'filter', 'transform', 'keyed aggregation', 'window', 'time attribute',
    'append-only', 'watermark', 'late', 'updating', 'retraction', 'sink'],
  sources: {
    ch:   chapter(CH, 'Chapter 8 on GitHub'),
    sql:  section(CH, 'SQL as a stream language', 'Chapter 8 · SQL as a stream language'),
    why:  section(CH, 'Why streaming SQL is relational SQL plus a column that is a clock', 'Chapter 8 · a column that is a clock'),
    when: section(CH, 'When to reach for streaming SQL, and what it does not do for you', 'Chapter 8 · when to reach for it'),
    walk: section(CH, 'Visual walkthrough — continuous, mapped, clocked, and the two result kinds', 'Chapter 8 · the walkthrough'),
    prog: section(CH, 'One query, two clocks — stack and heap at every step', 'Chapter 8 · one query, two clocks')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'SQL'],
      eyebrow: '01 · Chapter 8 · Part 1',
      heading: 'Nine messages about clicks, and a question asked in SQL',
      hero: { step: 0, text: 'A company counts clicks on its adverts. Every so often a message arrives saying “some clicks happened”. Each message is an <b>event</b>. It names the source that sent it, <b>a</b> or <b>b</b> — its <b>key</b> — and carries a small number, its <b>value</b>: how many clicks. The events never stop coming: a <b>stream</b>. Analysts want to question it in <b>SQL</b>, the everyday language for asking questions of data.[[src:sql]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example[[src:why]]' },
        { step: 1, value: 2, label: 'keys: a and b' },
        { step: 2, value: BY_ET[0], label: 'clicks that happened from 12:00 to 12:02[[src:why]]' },
        { step: 2, value: FIRST, label: 'what one question first reports for them[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'When is a question over a stream finished?', text: 'The stream never ends.' },
        { step: 3, n: 2, title: 'Which clock does the question read?', text: 'Every event carries two.' },
        { step: 4, n: 3, title: 'Can an answer change after it is given?', text: 'And who has to cope when it does.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A company counts clicks on its adverts. Every so often a message arrives saying some clicks happened. Each message is an event. It names its source, a or b, called its key, and carries a number, its value.',
        'The events never stop coming; that is called a stream. Our example has 9 events from 2 keys, a and b. Analysts want to question the stream in SQL, the everyday language for asking questions of data.',
        'From 12:00 to 12:02, 19 clicks really happened. Yet one simple question first reports 15. By the end of this part you will know why, and why that is not a bug.',
        'Three questions. When is a question over a stream finished, if the stream never ends? And which clock does the question read, when every event carries two?',
        'And can an answer change after it has been given? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the table and the two clocks ---------- */
    {
      title: 'Clock', layout: 'table', defines: ['table', 'row', 'column', 'event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, written down as a table',
      heading: 'When it happened is not when it was seen',
      stand: 'The table is called clicks, its rows in the order the events arrived. The pt column shows how long after it happened each event was seen.',
      table: {
        columns: ['id', 'key', 'et · happened at', 'pt · seen', 'v · value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hh(e.et)}</b>` : hh(e.et), i === 7 ? `<b>${e.pt - e.et} s later</b> · ${hh(e.pt)}` : `${e.pt - e.et} s later`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> (et) — when the clicks happened.</li><li><b>Processing time</b> (pt) — when the message was seen.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Ids 6 and 7 are.[[src:why]]</li></ul>' },
      narration: [
        'Written down, the events form a table, a grid like a spreadsheet, called clicks. Each line across is a row: one event. Each kind of fact going down is a column. Id 0, key a, value 5.',
        'Every row has two times. The first, et, is when the clicks happened: its event time. The second, pt, is when the message was seen: its processing time. Id 4 happened at 12:04:05 and was seen 1 second later, at 12:04:06.',
        'Now look at id 6: it happened at 12:03:40, earlier than id 5, yet arrived after it. And id 7 happened at 12:00:50 but was not seen until 12:04:40. Its message was held up.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. Keep id 7 in mind: it causes most of what follows.'
      ]
    },

    /* ---------- 3 · question: when does it finish ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['query', 'batch', 'continuous query'],
      eyebrow: '03 · Your turn',
      heading: 'A question that never finishes',
      stand: 'A question written in SQL is called a query. Over a finished table of 9 rows, a query reads them, gives its answer, and stops.',
      question: {
        step: 0,
        prompt: 'The same query text is run over the stream instead. When does it stop?',
        options: [
          { text: 'Never: it keeps running, and updates its answer as events arrive.', correct: true,
            why: 'The stream has no last event, so there is no moment at which the answer is complete. The query has to keep going.' },
          { text: 'After the 9th event, exactly like the finished table.', correct: false,
            why: 'Nine is only how many have arrived so far. A 10th event could come at any moment.' },
          { text: 'After a fixed stretch of time, such as one hour.', correct: false,
            why: 'Events keep arriving after the hour too, and a stopped query would never count them.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch', html: '<p>A query over a finished table is a <b>batch</b> query: it reads 9 rows, returns its answer, and exits.[[src:why]]</p>' },
        { step: 1, title: 'Continuous query', html: '<p>The same text over a stream is a <b>continuous query</b>: it never exits, and keeps its answer up to date as each event lands.[[src:sql]]</p>' },
        { step: 2, title: 'Returns against maintains', html: '<p>A batch query <b>returns</b>; a continuous query <b>maintains</b>. Everything else in this chapter follows from that.[[src:why]]</p>' }
      ],
      narration: [
        'First question. A question written in SQL is called a query. Over a finished table it reads 9 rows and stops. Run over the stream instead, when does it stop? Choose an answer.',
        'Never. A query over a finished table is called a batch query: it returns its answer and exits. The same text over a stream is a continuous query: it keeps its answer up to date forever.',
        'A batch query returns; a continuous query maintains. So the question “when is this answer final?” has no automatic answer any more. Keep that in mind.'
      ]
    },

    /* ---------- 4 · question: what a filter needs ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '04 · Your turn',
      heading: 'Keep only the big messages',
      stand: 'The query SELECT * FROM clicks WHERE v > 5 keeps the events whose value is more than 5, and passes them on.',
      question: {
        step: 0,
        prompt: 'To decide whether id 2, with value 7, should be passed on, what does the query need to look at?',
        options: [
          { text: 'Only id 2 itself: its value is 7, which is more than 5.', correct: true,
            why: 'The test reads one value from one row. No other event, earlier or later, can change its result.' },
          { text: 'Every event so far, to see whether 7 is large for this stream.', correct: false,
            why: 'The test is a fixed number, 5, not a comparison with other events. Nothing else is read.' },
          { text: 'The events still to come, in case one of them changes it.', correct: false,
            why: 'No later event can change whether 7 is more than 5. The decision is final the moment id 2 arrives.' }
        ]
      },
      narration: [
        'Second question. The query keeps only events whose value is more than 5. To decide about id 2, with value 7, what does the query need to look at? Choose an answer.',
        'Only id 2 itself. Its value is 7, more than 5, so it passes, and nothing that comes later can change that. Let us watch the query make that decision for every event.'
      ]
    },

    /* ---------- 5 · the filter, animated ---------- */
    {
      title: 'Keep', layout: 'array', defines: ['filter'],
      eyebrow: '05 · Watch the query test each event',
      heading: 'One row at a time, decided on the spot',
      stand: 'Slots are the events in arrival order. Top: each value. Bottom: is it more than 5?',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'value v', values: E.map(e => e.v) },
          { label: 'more than 5?', values: E.map(e => (e.v > 5 ? 'yes' : 'no')) }
        ],
        meters: ['events tested', 'events passed on'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 2, title: 'A filter', html: '<p>A <b>WHERE</b> is a <b>filter</b>: it keeps some rows and drops the rest. Here 4 of 9: ids ' + KEPT.join(', ') + '.[[src:why]]</p>' },
        { step: 3, title: 'Nothing new yet', html: '<p>The very same filter works on a finished table. A stream only means the decisions keep coming.[[src:sql]]</p>' }
      ],
      narration: [
        'Here are the 9 values, in the order the events arrived: 5, 3, 7, 2, 6, 1, 9, 4 and 8.',
        'Watch the query test each one as it arrives, and light up the ones it passes on. 9 events tested; 4 passed on.',
        'A test like this, keeping some rows and dropping the rest, is called a filter. In SQL it is written with WHERE. It kept ids 2, 4, 6 and 8.',
        'Notice there was nothing special about the stream here. The very same filter works on a finished table; the stream only means the decisions keep coming.'
      ]
    },

    /* ---------- 6 · the mapping ---------- */
    {
      title: 'Map', layout: 'table', defines: ['transform', 'keyed aggregation'],
      eyebrow: '06 · Familiar SQL words, and what each one does to a stream',
      heading: 'Three SQL words carry straight across',
      stand: 'Each line is a piece of SQL, what it does to the stream, and its result on our 9 events.',
      table: {
        columns: ['SQL', 'What it does to the stream', 'On our 9 events'],
        rows: [
          { step: 0, cells: ['<code>SELECT key, v</code>', '<b>Transform</b>: reshapes each event as it passes', '9 in, 9 out[[src:sql]]'] },
          { step: 1, cells: ['<code>WHERE v &gt; 5</code>', '<b>Filter</b>: keeps some events', '4 of 9: ids ' + KEPT.join(', ') + '[[src:why]]'] },
          { step: 2, cells: ['<code>GROUP BY key</code>', '<b>Keyed aggregation</b>: one running total per key', '2 groups, a and b[[src:why]]'] },
          { step: 3, cells: ['<code>GROUP BY key, TUMBLE(et, …)</code>', 'needs something batch SQL never had', '?'] }
        ]
      },
      side: { step: 3, title: 'The odd one out', html: '<p>The first three exist in ordinary SQL. The last one names a time column, and ordinary SQL has no idea when anything happened.[[src:why]]</p>' },
      narration: [
        'SQL words you may know carry straight across. SELECT picks and reshapes the columns of each event as it passes; doing that to every event is called a transform.',
        'WHERE is the filter you just watched: 4 of the 9 events, ids 2, 4, 6 and 8.',
        'GROUP BY key keeps one running total per key, a and b: 2 groups. Totalling per key like this is called a keyed aggregation.',
        'The last line is different. It names a time column, et. Ordinary SQL over a finished table has no idea when anything happened. That is the one real addition.'
      ]
    },

    /* ---------- 7 · question: grouping by time ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['window', 'time attribute'],
      eyebrow: '07 · Your turn',
      heading: 'Totals per key, per two minutes',
      stand: 'The analysts want each key’s total for every 2 minutes: 12:00 to 12:02, 12:02 to 12:04, and so on.',
      question: {
        step: 0,
        prompt: 'What must the query be told, that a query over a finished table never needs?',
        options: [
          { text: 'Which column holds the time to cut the events by.', correct: true,
            why: 'Each row carries two times. The query must be told which one decides the two-minute slice a row belongs to.' },
          { text: 'Nothing: the rows already arrive in time order.', correct: false,
            why: 'They do not. Ids 6 and 7 arrived after events that happened later than they did.' },
          { text: 'What time it is right now, on the server.', correct: false,
            why: 'The time now says nothing about when the clicks happened. Id 7 happened at 12:00:50 and was seen at 12:04:40.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window', html: '<p><code>TUMBLE(et, INTERVAL \'120\' SECOND)</code> cuts time into 2-minute slices. Each slice is a <b>window</b>.[[src:why]]</p>' },
        { step: 1, title: 'A time attribute', html: '<p>The column it cuts by, here <code>et</code>, is the <b>time attribute</b>. Ordinary SQL has no such thing.[[src:sql]]</p>' },
        { step: 2, title: 'From 2 groups to 7', html: '<p>Grouping by key <b>and</b> window gives 7 groups instead of 2. Streaming SQL is ordinary SQL plus a column that is a clock.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. The analysts want each key’s total for every 2 minutes. What must the query be told that a query over a finished table never needs? Choose an answer.',
        'Which column holds the time to cut by. TUMBLE of et, 120 seconds, cuts time into 2-minute slices, each called a window. The column it reads, et here, is called the time attribute.',
        'Grouping by key and by window gives 7 groups instead of 2. So streaming SQL is ordinary SQL plus one idea: a column whose values are a clock.'
      ]
    },

    /* ---------- 8 · the seven groups ---------- */
    {
      title: 'Group', layout: 'table',
      eyebrow: '08 · The seven groups',
      heading: 'One total per key, per window',
      stand: 'Each event lands in the window its event time falls in, whenever it was seen.',
      table: {
        columns: ['key', 'window (event time)', 'total'],
        rows: GROUPS.map((g, i) => ({ step: i < 2 ? 0 : i < 6 ? 1 : 2, cells: [g.k, range(g.s), `${g.v}`] }))
      },
      side: { step: 3, title: 'Id 7 is in the first window', html: '<p>It happened at 12:00:50, so by event time it belongs to 12:00 to 12:02, although it was seen at 12:04:40. Key b’s total there is 11: 7 + 4.[[src:why]]</p><p>No event happened from 12:06 to 12:08, so that window has no group at all.</p>' },
      narration: [
        'Here are the 7 groups. In the window 12:00 to 12:02, key a totals 8, from ids 0 and 1, and key b totals 11.',
        'Then 12:02 to 12:04: a has 2 and b has 9. Then 12:04 to 12:06: a has 6 and b has 1.',
        'And the last window, 12:08 to 12:10, holds only key a, with 8. Seven groups in all.',
        'Look at key b’s 11 in the first window: 7 from id 2, plus 4 from id 7. Id 7 was seen at 12:04:40, but by event time it belongs in the first window.'
      ]
    },

    /* ---------- 9 · question: the other clock ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'Change one word: et becomes pt',
      stand: 'The same query, totalling every key together per window, but cutting by pt, the time each event was seen.',
      question: {
        step: 0,
        prompt: 'Cut by processing time, what does the window 12:00 to 12:02 hold?',
        options: [
          { text: '15: ids 0, 1 and 2. Id 7 was seen at 12:04:40, in a later window.', correct: true,
            why: 'By processing time, id 7 belongs where it was seen, 12:04 to 12:06. Only 5, 3 and 7 are left: 15.' },
          { text: '19, as before: the same events and the same query.', correct: false,
            why: 'Same events, but a different clock puts id 7 somewhere else. The column named decides where each event lands.' },
          { text: 'Nothing: windows cannot be cut by processing time.', correct: false,
            why: 'They can. Both columns are valid time attributes, and both queries run without complaint.' }
        ]
      },
      narration: [
        'Fourth question. Change one word: cut by pt, the time each event was seen, and total every key together. What does the window 12:00 to 12:02 now hold? Choose an answer.',
        'Fifteen. By processing time, id 7 lands where it was seen, at 12:04:40, in a later window. Only ids 0, 1 and 2 are left: 5, 3 and 7. Let us watch both totals being added up.'
      ]
    },

    /* ---------- 10 · two clocks, animated ---------- */
    {
      title: 'Two', layout: 'array',
      eyebrow: '10 · Watch the same window totalled by each clock',
      heading: 'Window 12:00 to 12:02, cut by et and then by pt',
      stand: 'Each row shows what every event adds to that window: its value if it lands there, otherwise 0.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'cut by event time', values: E.map(e => (winOf(e.et) === 0 ? e.v : 0)) },
          { label: 'cut by processing time', values: E.map(e => (winOf(e.pt) === 0 ? e.v : 0)) }
        ],
        meters: ['events read', 'total by event time', 'total by processing time'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 0, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 2, speed: 300 },
          { step: 2, do: 'pick', slots: [7] }
        ]
      },
      cards: [
        { step: 2, title: 'One event moved', html: '<p>Id 7 adds 4 by event time and 0 by processing time: <b>' + BY_ET[0] + '</b> against <b>' + BY_PT[0] + '</b>.[[src:prog]]</p>' },
        { step: 3, title: '3 of the 4 windows disagree', html: '<p>By event time: ' + BY_ET.join(', ') + '. By processing time: ' + BY_PT.join(', ') + '. Both queries are valid SQL; nothing can flag the wrong one.[[src:why]]</p>' }
      ],
      narration: [
        'The top row is what each event adds to the window 12:00 to 12:02 when cut by event time. Watch the total: ids 0, 1, 2 and 7 count, and it reaches 19.',
        'The bottom row cuts by processing time. Id 7 was seen at 12:04:40, so it adds nothing here. The total reaches only 15.',
        'Slot 7, highlighted, is the whole difference: id 7 adds 4 by event time and nothing by processing time. One word in the query moved it.',
        'Over all four windows, the two clocks disagree on 3 of them: 19, 11, 7 and 8, against 15, 2, 20 and 8. Both are valid SQL, and no engine can tell you which one you meant.'
      ]
    },

    /* ---------- 11 · question: can a result be revised ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['append-only'],
      eyebrow: '11 · Your turn',
      heading: 'Can an answer, once given, turn out wrong?',
      stand: 'The filter passed on id 2 the moment it arrived. Later, ids 3 to 8 arrive.',
      question: {
        step: 0,
        prompt: 'Could any later event make the filter’s output for id 2 wrong?',
        options: [
          { text: 'No: whether 7 is more than 5 depends on id 2 alone.', correct: true,
            why: 'A row either matched or it did not, and nothing that arrives later changes that. Each output row is a settled fact.' },
          { text: 'Yes: an event arriving afterwards could have a larger value.', correct: false,
            why: 'Another event’s value has no bearing on whether 7 is more than 5. It would only add a row of its own.' },
          { text: 'Yes, until the stream ends, because it never ends.', correct: false,
            why: 'The filter never needs the end of the stream. Its decision is final the moment the row is seen.' }
        ]
      },
      cards: [
        { step: 1, title: 'Append-only', html: '<p>A result made only of new, settled rows is <b>append-only</b>: rows are added, never changed. The filter’s 4 rows are.[[src:why]]</p>' },
        { step: 2, title: 'But a window total?', html: '<p>A total for 12:00 to 12:02 depends on every event of that window, including one that has not arrived yet.[[src:why]]</p>' }
      ],
      narration: [
        'Fifth question. The filter passed on id 2 the moment it arrived. Could any later event make that output wrong? Choose an answer.',
        'No. Whether 7 is more than 5 depends on id 2 alone. A result made only of settled rows, added and never changed, is called append-only. The filter’s 4 rows are.',
        'A window total is different. It depends on every event of its window, including ones not yet arrived. So when may it be sent out at all? Watch.'
      ]
    },

    /* ---------- 12 · the revision, on a timeline ---------- */
    {
      title: 'Late', layout: 'timeline', defines: ['watermark', 'late', 'updating', 'retraction'],
      eyebrow: '12 · Watch the window total go out, and then change',
      heading: 'Sent out as 15, corrected to 19',
      stand: 'Wall-clock moments, left to right. Below: the events of window 12:00 to 12:02.',
      timeline: [
        { step: 0, time: hh(E[3].pt), title: 'id 3 seen', text: 'Window holds 5 + 3 + 7 = 15. Not sent yet.' },
        { step: 1, time: hh(E[4].pt), title: 'id 4 seen', text: `Watermark = latest event time − 60 s = ${hh(seed.WATERMARKS[4])}: past 12:02, so 15 goes out.[[src:why]]` },
        { step: 2, time: hh(LATE.pt), title: 'id 7 seen', text: 'Happened 12:00:50: late. 15 is withdrawn, 19 sent.[[src:why]]' }
      ],
      strip: {
        step: 0, label: 'Events of window 12:00 to 12:02',
        items: [
          { n: 'id 0', text: 'value 5' }, { n: 'id 1', text: 'value 3' }, { n: 'id 2', text: 'value 7', tone: 'ok' },
          { n: 'id 7', text: 'value 4 · arrives after 15 went out', tone: 'warn' }
        ]
      },
      narration: [
        'At 12:02:12 the wall clock is past 12:02, and the window holds 5, 3 and 7: 15 so far. But the engine, the program running the query, cannot know whether more of this window is on its way, so it waits.',
        'It decides with a watermark: the latest event time seen, minus a 60-second margin. At 12:04:06, id 4 lifts it to 12:03:05, past the window’s end, so the engine sends out 15.',
        'At 12:04:40, id 7 arrives. It happened at 12:00:50, so it belongs to a window already sent: it is late. The engine withdraws 15, called a retraction, and sends 19.',
        'A result whose rows can be changed like this is called updating. The windowed total is updating; the filter was append-only. And you could tell which from the query text alone.'
      ]
    },

    /* ---------- 13 · question: the sink ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['sink'],
      eyebrow: '13 · Your turn · check yourself',
      heading: 'Where the answers go',
      stand: 'Every result is written somewhere: a table, a dashboard, a file. That destination is called the sink. Nothing has been built yet.',
      question: {
        step: 0,
        prompt: 'Of the two queries, which needs a sink that can replace a row it has already written?',
        options: [
          { text: 'The windowed total: its 15 later becomes 19.', correct: true,
            why: 'A windowed total is updating. The sink must replace the old row, or accept a retraction, or it holds both.' },
          { text: 'The filter: its rows may be replaced later.', correct: false,
            why: 'The filter is append-only. Its rows are settled facts, so a sink that only adds is enough.' },
          { text: 'Both: every streaming query replaces rows.', correct: false,
            why: 'Only results that can be revised need it. A filter’s rows are never revised.' }
        ]
      },
      cards: [
        { step: 1, title: 'Read from the query text', html: '<p>A <b>WHERE</b> can feed a sink that only adds. A windowed <b>GROUP BY</b> needs one that replaces, or accepts retractions.[[src:when]]</p>' },
        { step: 2, title: 'Before any code exists', html: '<p>The update mode is a property of the query, so the sink can be chosen first. Getting it backwards is found late and fixed expensively.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. Every result is written somewhere, a table or a dashboard, called the sink. Of the two queries, which needs a sink that can replace a row it already wrote? Choose an answer.',
        'The windowed total. It is updating: 15 later becomes 19, so the sink must replace the row or accept a retraction. The filter is append-only, so a sink that only adds is enough.',
        'And this is known from the query text, before any code exists. Choose the sink from the query’s update mode; getting it backwards is discovered late and fixed expensively.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Ordinary SQL, plus a column that is a clock',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when it was seen. Id 7: 12:00:50 and 12:04:40.[[src:why]]'] },
          { step: 0, cells: ['<b>Continuous query</b>', 'A query over a stream: it never finishes, and maintains its answer.[[src:sql]]'] },
          { step: 1, cells: ['<b>Filter</b>, <b>transform</b>, <b>keyed aggregation</b>', 'WHERE, SELECT and GROUP BY, unchanged from ordinary SQL.[[src:sql]]'] },
          { step: 1, cells: ['<b>Window</b> and <b>time attribute</b>', 'TUMBLE cuts the chosen time column into slices. By et or pt: 3 of 4 windows differ.[[src:why]]'] },
          { step: 2, cells: ['<b>Append-only</b> and <b>updating</b>', 'A filter only adds rows; a window total can change, 15 then 19, so its sink must replace rows.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>TUMBLE is one of three window shapes. Part 2 meets HOP and SESSION, and finds one window that is never sent out at all.[[src:when]]</p>' },
      narration: [
        'To recap. Every event has two times: when it happened, its event time, and when it was seen, its processing time. A query over a stream is continuous: it never finishes.',
        'Filter, transform and keyed aggregation are ordinary SQL, unchanged. The one addition is the window, cut by a time column called the time attribute. Choose et or pt, and 3 of 4 windows differ.',
        'A filter is append-only. A window total is updating: 15, then 19 when late id 7 arrives. So the sink is chosen from the query text, before anything is built.',
        'Next, part 2 meets the other two window shapes, HOP and SESSION, and a window that the engine never sends out at all.'
      ]
    }
  ]
};
