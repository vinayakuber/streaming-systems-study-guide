// Chapter 1, Part 3 — "Three shapes of data", for a viewer who has seen nothing before it.
// The click story and both clocks are told again from zero. The same nine events are then put
// through the three shapes — a file that ends, chunks cut by arrival, and a true stream that
// closes windows on a watermark — and each grouping is animated, not described. Every figure is
// derived from the one seed (tools/stream_seed.js) and asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const E = seed.EVENTS;
const WIN = seed.WIN;
const clock = s => seed.hhmmss(s);
const hm = s => clock(s).slice(0, 5);
const winOf = seed.winOf;
const WIN_ROW = E.map(e => hm(winOf(e.et)));                // by event time
const CHUNK_ROW = E.map(e => hm(winOf(e.pt)));              // by arrival time, 120 s chunks
const CHUNK0 = E.filter(e => e.pt < WIN).reduce((a, e) => a + e.v, 0);
const MOVED = E.map((e, i) => (WIN_ROW[i] === CHUNK_ROW[i] ? 'right' : 'wrong'));
const SUMS = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const WM = seed.WATERMARKS;
const FIRST_CLOSE = seed.closedAt(0);
const STATUS0 = WM.map(w => (w >= WIN ? 'closed' : 'open'));
const LAST = seed.WIN_STARTS[seed.WIN_STARTS.length - 1];

if (E.length !== 9 || WIN !== 120 || MOVED.filter(m => m === 'wrong').length !== 2 || MOVED[6] !== 'wrong' || MOVED[7] !== 'wrong'
  || SUMS.join() !== '19,11,7,8' || FIRST_CLOSE !== 4 || E[4].pt !== 246 || seed.closedAt(LAST) !== null || LAST !== 480
  || Math.max(...WM) !== 480 || seed.closedAt(120) !== 8 || seed.closedAt(240) !== 8 || E[8].pt !== 542 || E[8].v !== 8 || CHUNK0 !== 15)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Does the Input End?',
  eyebrow: 'Streaming · Ch 1 · Part 3',
  ...shared,
  jargon: ['event', 'click', 'pipeline', 'event time', 'processing time', 'window', 'bounded', 'unbounded', 'batch',
    'chunk', 'streaming', 'watermark', 'state'],
  sources: {
    ch:     chapter(CH, 'Chapter 1 on GitHub'),
    term:   section(CH, 'Why the word has to be split before anything can be designed', 'Chapter 1 · two timestamps'),
    wm:     section(CH, 'Why one of the two clocks is the meaningful one, and the other is the cheap one', 'Chapter 1 · the watermark'),
    shapes: section(CH, 'Three shapes of data', 'Chapter 1 · three shapes of data'),
    why:    section(CH, 'Why the shape of the input decides the design', 'Chapter 1 · why the shape decides'),
    when:   section(CH, 'When each shape is the right choice, and what "streaming generalizes batch" buys you', 'Chapter 1 · when each shape is right'),
    walk:   section(CH, 'Visual walkthrough — the same nine events, three ways', 'Chapter 1 · nine events, three ways'),
    mem:    section(CH, 'Three shapes through one function — stack and heap at every step', 'Chapter 1 · three shapes, one function'),
    quiz:   section(CH, 'Quiz', 'Chapter 1 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'click', 'pipeline', 'event time', 'processing time', 'chunk', 'streaming'],
      eyebrow: '01 · Chapter 1 · Part 3',
      heading: 'Does the input end? The same nine clicks, handled three ways',
      hero: { step: 0, text: 'People click on a website. Each report of clicks is an <b>event</b>, sent to a <b>pipeline</b> that adds the <b>clicks</b> up. Every event has two times: when it happened, its <b>event time</b>; and when the pipeline saw it, its <b>processing time</b>. They disagree, because events are delayed on the way. An engine built for data that never ends is called <b>streaming</b>.[[src:term]]' },
      tiles: [
        { step: 1, value: 9, label: 'events, seen out of order[[src:why]]' },
        { step: 1, value: WIN, label: 'seconds: the size of each time slice[[src:why]]' },
        { step: 2, value: 2, label: 'events cut into the wrong slice by one of the shapes[[src:why]]' },
        { step: 2, value: 1, label: 'slice another shape never finishes[[src:why]]' }
      ],
      cardsLabel: 'Three ways to handle the same events',
      cards: [
        { step: 3, n: 1, title: 'A file that has ended', text: 'Read it all, then answer.' },
        { step: 3, n: 2, title: 'Endless data, cut into chunks', text: 'A chunk: whatever arrived in one slice of time. Answer per chunk.' },
        { step: 4, n: 3, title: 'Endless data, handled as it comes', text: 'Answer per slice of event time, and decide separately when each is done.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'People click on a website. Each report of clicks is an event, sent to a pipeline that adds the clicks up. Every event has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'Our example has 9 events, and the pipeline sees them out of order. The clicks are added up in slices of time, each 120 seconds long.',
        'One way of handling the events puts 2 of them in the wrong slice. Another leaves 1 slice never finished. Let us see which, and why.',
        'There are three ways in practice. Read a file that has ended, then answer. Or, for data that never ends, cut it into chunks, pieces of whatever arrived in each slice of time, and answer per chunk.',
        'Or handle the endless data as it comes, and decide separately when each slice is done. A pipeline’s whole design falls out of one question: does the input end?'
      ]
    },

    /* ---------- 2 · the events and their windows ---------- */
    {
      title: 'Data', layout: 'table', defines: ['window'],
      eyebrow: '02 · The nine events, and the slice each belongs to',
      heading: 'Slices of event time, 2 minutes each',
      stand: 'Listed in the order the pipeline saw them. Times are on a clock that starts at 12:00:00.',
      table: {
        columns: ['Event', 'Clicks', 'Happened at', 'Seen at', 'Its window'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, `${e.v}`, clock(e.et), clock(e.pt), (i === 6 || i === 7) ? `<b>from ${WIN_ROW[i]}</b>` : `from ${WIN_ROW[i]}`] }))
      },
      side: { step: 3, title: 'Window', html: '<p>A <b>window</b> is a 2-minute slice of <b>event time</b>: 12:00 to 12:02, 12:02 to 12:04, and so on. Each event belongs to the window in which it happened.[[src:why]]</p><p>Clicks per window: <b>' + SUMS.join(', ') + '</b>.[[src:mem]]</p>' },
      narration: [
        'Here are the nine events, in the order the pipeline saw them. Event 0 has 5 clicks, happened at 12:00:01 and was seen at 12:00:02.',
        'Event 6, in bold, happened at 12:03:40, so it belongs to the slice from 12:02. But it was seen at 12:04:30.',
        'And event 7 happened at 12:00:50, in the slice from 12:00, but was seen at 12:04:40.',
        'A 2-minute slice of event time is called a window. Each event belongs to the window in which it happened. The four windows hold 19, 11, 7 and 8 clicks.'
      ]
    },

    /* ---------- 3 · shape 1: bounded ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['bounded', 'batch'],
      eyebrow: '03 · Your turn · shape 1, a file that has ended',
      heading: 'Yesterday’s clicks, in one finished file',
      stand: 'All nine events are already written in a file before the job starts. The job reads the whole file, sorts it by event time, and adds up each window.',
      question: {
        step: 0,
        prompt: 'What harm does event 7’s 230-second delay do to this job?',
        options: [
          { text: 'None: it was in the file before the job began.', correct: true,
            why: 'The delay happened before the file was finished. By the time the job reads it, event 7 is simply there.' },
          { text: 'Its 4 clicks land in the wrong window.', correct: false,
            why: 'The job groups by event time from a complete file, so event 7 goes into the 12:00 window, where it belongs.' },
          { text: 'The job has to wait 230 seconds for it.', correct: false,
            why: 'There is nothing to wait for. The file has ended; everything it will ever hold is already in it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Bounded data', html: '<p>Data that ends — one day of logs, a copy of a database — is <b>bounded</b>. “Has everything arrived?” has a free answer: <i>the file ended</i>. Every window is final.[[src:why]]</p>' },
        { step: 2, title: 'Batch', html: '<p>A job that reads a finished pile of data to its end, answers, and stops, is a <b>batch</b> job. Here none of this book’s problems exist.[[src:shapes]]</p>' }
      ],
      narration: [
        'Shape one. All nine events are already in a finished file. The job reads it all, sorts by event time, and adds up each window. What harm does event 7’s 230-second delay do? Choose an answer.',
        'None. Event 7 was in the file before the job began. Data that ends, like one day of logs, is called bounded. Asking whether everything has arrived has a free answer: the file ended.',
        'A job that reads a finished pile to its end, answers and stops, is called a batch job. Every window is final. This is the case where none of this book’s problems exist.'
      ]
    },

    /* ---------- 4 · shape 2: chunks by arrival ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['unbounded', 'chunk'],
      eyebrow: '04 · Your turn · shape 2, endless data cut into chunks',
      heading: 'Every 120 seconds, a batch job over whatever arrived',
      stand: 'Now the clicks never stop. So every 120 seconds the pipeline takes whatever ARRIVED in that time and runs a small batch job on it.',
      question: {
        step: 0,
        prompt: 'Event 7 happened at 12:00:50 and arrived at 12:04:40. Which run counts its 4 clicks?',
        options: [
          { text: 'The run for 12:00 to 12:02, when it happened.', correct: false,
            why: 'That run only sees what arrived between 12:00 and 12:02. Event 7 had not arrived yet.' },
          { text: 'The run for 12:04 to 12:06, when it arrived.', correct: true,
            why: 'The runs are cut on arrival time, so event 7 joins whatever arrived between 12:04 and 12:06.' },
          { text: 'No run: it arrived too late to be counted.', correct: false,
            why: 'Nothing is too late for this pipeline. Every event is counted by some run, just perhaps the wrong one.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Unbounded, processed as batch', html: '<p>Data that never ends is <b>unbounded</b>. Slicing it by arrival into finite <b>chunks</b>, each a little batch job, is what most systems called “streaming” actually are.[[src:why]]</p>' },
        { step: 2, title: 'Two clocks, mixed up', html: '<p>The chunk edge is a fact about the pipeline’s clock. It is being used to answer a question about the users’ clock.[[src:walk]]</p>' }
      ],
      narration: [
        'Shape two. Now the clicks never stop. Every 120 seconds, the pipeline takes whatever arrived in that time and runs a small batch job on it. Which run counts event 7? Choose an answer.',
        'The run for 12:04 to 12:06, when it arrived. Data that never ends is called unbounded. Cutting it by arrival into finite chunks, each one a little batch job, is what most systems called streaming really are.',
        'But the edge of a chunk is a fact about the pipeline’s clock, and it is being used to answer a question about the users’ clock. Watch what that does to all nine events.'
      ]
    },

    /* ---------- 5 · chunks vs windows, animated ---------- */
    {
      title: 'Chunk', layout: 'array',
      eyebrow: '05 · Watch every event sorted both ways',
      heading: 'Window by event time, chunk by arrival',
      stand: 'One column per event, in the order seen. Each value is the start of a 2-minute slice.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'its window', values: WIN_ROW },
          { label: 'its chunk', values: CHUNK_ROW },
          { label: 'chunk is', values: MOVED }
        ],
        meters: ['events compared', 'in the wrong chunk'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'match', match: 'wrong', readMeter: 0, resultMeter: 1, speed: 320 }
        ]
      },
      cards: [
        { step: 3, title: 'Event 6', html: '<p>Window from 12:02, chunk from 12:04: out by <b>120</b> seconds, one window.[[src:why]]</p>' },
        { step: 3, title: 'Event 7', html: '<p>Window from 12:00, chunk from 12:04: out by <b>240</b> seconds, two windows.[[src:why]]</p>' },
        { step: 3, title: '22% of the events', html: '<p>2 of the 9 events land in a chunk that is not their window.[[src:when]]</p>' }
      ],
      narration: [
        'Top row: the window each event belongs to, by when it happened. Events 0, 1, 2 and 7 belong to the window from 12:00.',
        'Next row: the chunk each event falls into, by when it arrived. Most match their window.',
        'Now compare, event by event. Watch the pointer: 2 of the 9 events are in the wrong chunk.',
        'Event 6 is out by 120 seconds, one window. Event 7 is out by 240 seconds, two windows. That is 22 percent of the events in the wrong place.'
      ]
    },

    /* ---------- 6 · question: can the chunk tell ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '06 · Your turn',
      heading: 'The chunk from 12:04 holds events 4, 5, 6 and 7',
      stand: 'Two of those four belong to earlier windows. The job for that chunk sees only the four events it was handed.',
      question: {
        step: 0,
        prompt: 'Can the job for that chunk notice that it holds two misplaced events?',
        options: [
          { text: 'Yes: it raises an error when an event is from an older window.', correct: false,
            why: 'It keys on arrival time, so to the job every event in its chunk is exactly where it should be.' },
          { text: 'No: it finishes cleanly and reports a wrong number.', correct: true,
            why: 'From inside, the chunk is consistent. Only something that sees both clocks can find the misplaced pair.' },
          { text: 'Yes: its total looks too large, which gives it away.', correct: false,
            why: 'The job has nothing to compare its total with. A larger total looks like a busy two minutes.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Silent', html: '<p>The chunk is internally consistent, finishes cleanly, and reports a wrong number. Nothing inside it can notice.[[src:why]]</p>' },
        { step: 2, title: 'And slow to change', html: '<p>A change shows up only at the next chunk boundary. With day-sized chunks, that is up to a day late.[[src:shapes]]</p>' }
      ],
      narration: [
        'The chunk from 12:04 holds events 4, 5, 6 and 7, and two of them belong to earlier windows. Can the job for that chunk notice? Choose an answer.',
        'No. It finishes cleanly and reports a wrong number. From inside, the chunk is perfectly consistent. Only something that can see both clocks can find the two misplaced events.',
        'There is a second cost too. A change shows up only at the next chunk boundary. When the chunks are a day long, an answer can be up to a day late.'
      ]
    },

    /* ---------- 7 · shape 3: when to close ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['streaming', 'watermark'],
      eyebrow: '07 · Your turn · shape 3, handled as it comes',
      heading: 'Keep the right windows. When is one finished?',
      stand: 'Shape three groups every event into its event-time window, as the file did. But the data never ends, so no file end says “done”.',
      question: {
        step: 0,
        prompt: 'When should the window from 12:00 to 12:02 be declared finished?',
        options: [
          { text: 'When the pipeline’s own clock reaches 12:02.', correct: false,
            why: 'Event 7 belongs to that window and arrives at 12:04:40, long after the clock passes 12:02.' },
          { text: 'When a guess of what is still coming passes 12:02.', correct: true,
            why: 'That guess is the watermark: a running estimate, made from the events seen, that nothing older is still on its way.' },
          { text: 'Never: a window of endless data never finishes.', correct: false,
            why: 'Then no answer would ever be final. The pipeline decides, on purpose, when a window is done.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A watermark', html: '<p>A <b>watermark</b> is a claim: “no event earlier than <i>t</i> will arrive from now on.” The usual rule: the highest event time seen so far, minus <b>60</b> seconds.[[src:wm]]</p>' },
        { step: 2, title: 'Streaming', html: '<p><b>Streaming</b>, in this book: keep the event-time windows, so the groups are right, and make <b>closing</b> a separate decision on the pipeline’s clock, driven by the watermark.[[src:why]]</p>' }
      ],
      narration: [
        'Shape three groups every event into its event-time window, just like the file did. But the data never ends. When should the window from 12:00 to 12:02 be declared finished? Choose an answer.',
        'When a guess of what is still coming passes 12:02. That guess is called the watermark: the highest event time seen so far, minus 60 seconds. It is a guess.',
        'This is what the book means by streaming: keep the event-time windows, so the groups are right, and make closing a window a separate decision, driven by the watermark. Watch it run.'
      ]
    },

    /* ---------- 8 · the watermark closes windows, animated ---------- */
    {
      title: 'Close', layout: 'array',
      eyebrow: '08 · Watch the window from 12:00 being closed',
      heading: 'The window closes when the watermark reaches 120',
      stand: 'Seconds past 12:00:00, one column per arrival. The window from 12:00 ends at second 120.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => e.et) },
          { label: 'watermark', values: WM },
          { label: 'window 12:00', values: STATUS0 }
        ],
        meters: ['arrivals checked', 'with the window closed'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'closed', readMeter: 0, resultMeter: 1, speed: 320 },
          { step: 2, do: 'pick', slots: [FIRST_CLOSE, 7] }
        ]
      },
      cards: [
        { step: 2, title: 'Closed after event 4', html: '<p>Watermark <b>' + WM[FIRST_CLOSE] + '</b> ≥ 120, so the window from 12:00 is declared done at 12:04:06, three arrivals before event 7.[[src:why]]</p>' },
        { step: 3, title: 'Lateness becomes a case', html: '<p>Event 7 belongs to a window already closed. Streaming makes that a <b>case</b> to handle, not an accident nobody sees.[[src:why]]</p>' }
      ],
      narration: [
        'Here is each event’s own time, in seconds, in the order seen, and the watermark after each arrival: the highest event time so far, minus 60.',
        'The window from 12:00 ends at second 120. It stays open until the watermark reaches 120. Watch the pointer: from event 4 on, it is closed.',
        'Event 4 pushes the watermark to 185, so the window is declared done at 12:04:06. Event 7, picked out, arrives three arrivals later, into a window already closed.',
        'Shape two hid that problem inside a wrong chunk. Shape three makes it visible: a late event is now a case the pipeline must handle, not an accident nobody sees.'
      ]
    },

    /* ---------- 9 · question: the last window ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['state'],
      eyebrow: '09 · Your turn',
      heading: 'The last window, 12:08 to 12:10, holds 8 clicks',
      stand: 'Event 8 is the last event: it happened at 12:09:00 and pushed the watermark to 480. The window from 12:08 ends at second 600.',
      question: {
        step: 0,
        prompt: 'When does the window from 12:08 close?',
        options: [
          { text: 'When the pipeline’s clock reaches 12:10.', correct: false,
            why: 'Closing follows the watermark, not the wall clock, and the watermark only moves when events arrive.' },
          { text: 'At 12:09:02, when event 8 is seen.', correct: false,
            why: 'Event 8 pushes the watermark to 480, short of 600, so the window stays open.' },
          { text: 'Never here: nothing pushes the watermark past 600.', correct: true,
            why: 'No later event arrives, so the watermark stops at 480 and the window stays open, holding 8.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Open forever', html: '<p>Event 8 leaves the watermark at <b>480</b>. Nothing ever reaches 600, so the window from 12:08 never closes. In the file, the end of the file would have closed it at once.[[src:mem]]</p>' },
        { step: 2, title: 'State', html: '<p>What the pipeline must keep remembering, like that open window’s 8, is its <b>state</b>. Endless input means endless state, unless something expires it — a later chapter’s problem.[[src:when]]</p>' }
      ],
      narration: [
        'Event 8 is the last one. It happened at 12:09:00 and pushed the watermark to 480. The window from 12:08 ends at second 600. When does it close? Choose an answer.',
        'Never, here. No later event arrives, so the watermark stops at 480 and the window stays open, holding its 8 clicks. In the finished file, the end of the file would have closed it at once.',
        'What the pipeline must keep remembering, like that open window, is called its state. Endless input means endless state, unless something expires it. That is a later chapter’s problem.'
      ]
    },

    /* ---------- 10 · the three shapes side by side ---------- */
    {
      title: 'Three', layout: 'table',
      eyebrow: '10 · The three shapes, side by side',
      heading: 'Same nine events: how each shape groups and finishes',
      stand: 'Groups: which events are added together. Finished: when an answer is declared done.',
      table: {
        columns: ['Shape', 'Groups by', 'Window from 12:00', 'Finished when'],
        rows: [
          { step: 0, cells: ['<b>1 · file that ended</b>', 'event time', 'events 0, 1, 2, 7 → <b>19</b>', 'the file ends: every window at once[[src:mem]]'] },
          { step: 1, cells: ['<b>2 · chunks by arrival</b>', 'processing time', 'events 0, 1, 2 → <b>15</b> (event 7 elsewhere)', 'each chunk’s run ends[[src:mem]]'] },
          { step: 2, cells: ['<b>3 · stream</b>', 'event time', 'events 0, 1, 2, 7 → <b>19</b>', 'the watermark passes the window’s end[[src:mem]]'] }
        ]
      },
      side: { step: 3, title: 'The odd one out', html: '<p>Shapes 1 and 3 group <b>identically</b>: the same windows, the same members. They differ only in <b>when</b> a window is declared done.[[src:why]]</p><p>Shape 2 is odd not because it is batch, but because it groups by the arrival clock.[[src:why]]</p>' },
      narration: [
        'Here are the three shapes side by side. The finished file groups by event time: the window from 12:00 holds events 0, 1, 2 and 7, 19 clicks. Every window is finished when the file ends.',
        'The chunks group by arrival. Their first chunk holds only events 0, 1 and 2, because event 7 arrived later. Each chunk is finished when its run ends.',
        'The stream groups by event time, exactly like the file: events 0, 1, 2 and 7. Each window is finished when the watermark passes its end.',
        'So shapes one and three group identically. They differ only in when a window is declared done. Shape two is the odd one out, not because it is batch, but because it groups by the arrival clock.'
      ]
    },

    /* ---------- 11 · question: one model ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: 'Is the finished file a different system from the stream?',
      stand: 'In the stream, a window closes when the watermark passes its end. In the file, every window closes when the file ends.',
      question: {
        step: 0,
        prompt: 'How can one streaming pipeline also process the finished file?',
        options: [
          { text: 'It cannot: files need a separate batch system.', correct: false,
            why: 'The grouping is already identical. Only the closing rule differs, and the file’s end gives that for free.' },
          { text: 'Treat the file’s end as the watermark jumping past every window.', correct: true,
            why: 'Then every window closes at once at the end of the file, which is exactly what the batch job did.' },
          { text: 'Cut the file into 120-second chunks first.', correct: false,
            why: 'That is shape two, which groups by arrival and misplaces events.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Batch is the special case', html: '<p>A file that ends is endless data whose watermark jumps to infinity at the end, closing every window at once. One model covers both.[[src:when]]</p>' },
        { step: 2, title: 'Why it matters', html: '<p>The same pipeline code can rerun history from files and serve live clicks. The shape of the input decides <b>when</b> it speaks, not <b>what</b> it computes.[[src:walk]]</p>' }
      ],
      narration: [
        'In the stream, a window closes when the watermark passes its end. In the file, every window closes when the file ends. How can one streaming pipeline also process the finished file? Choose an answer.',
        'Treat the end of the file as the watermark jumping past every window. Then every window closes at once, exactly as the batch job did. A file that ends is just endless data that happens to stop.',
        'That is why the same pipeline code can rerun history from files and serve live clicks. The shape of the input decides when the pipeline speaks, not what it computes.'
      ]
    },

    /* ---------- 12 · question: when chunks are fine ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '12 · Your turn',
      heading: 'Chunks are simple. When are they good enough?',
      stand: 'Chunks by arrival are easy to run, and they put 22% of these events in the wrong slice, invisibly.',
      question: {
        step: 0,
        prompt: 'For which job are chunks cut by arrival time good enough?',
        options: [
          { text: 'A rough graph of how much data is arriving right now.', correct: true,
            why: 'There the question really is “roughly the last 120 seconds of arrivals”, which is exactly what a chunk holds.' },
          { text: 'The marketing chart of clicks that happened at 12:00.', correct: false,
            why: 'That is about when clicks happened. Chunks would show 15 for the first slice instead of 19.' },
          { text: 'Billing each advertiser for the clicks made in each minute.', correct: false,
            why: 'A bill must put each click in the minute it happened, so misplaced events become wrong charges.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'A file that ends', html: '<p>A rerun of history, a nightly report over yesterday. The cheapest correct choice.[[src:when]]</p>' },
        { step: 1, title: 'Chunks by arrival', html: '<p>When the slices need not be exact: a rough volume trend. Simple to run, a real advantage.[[src:when]]</p>' },
        { step: 2, title: 'A stream', html: '<p>When the windows must be right and the input never ends. The price: deciding when to speak, which is the rest of the book.[[src:when]]</p>' }
      ],
      narration: [
        'Chunks by arrival are easy to run, and they put 22 percent of these events in the wrong slice without anyone noticing. For which job are they good enough? Choose an answer.',
        'A rough graph of how much data is arriving right now. There the question really is the last 120 seconds of arrivals. A file that ends suits a rerun of history, and is the cheapest correct choice.',
        'And a stream is for when the windows must be right and the input never ends. Its price is having to decide when to speak, which is what the rest of the book is about.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Q8', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'One last check',
      stand: 'The chapter’s own quiz question. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'How does batch relate to streaming in the book’s model?',
        options: [
          { text: 'Batch is a special case: data that ends is endless data that stops.', correct: true,
            why: 'One model handles both. A finished file is a stream whose watermark jumps past every window at the end.' },
          { text: 'Streaming is a special case of batch, with very small chunks.', correct: false,
            why: 'Small chunks are shape two, which groups by arrival. It is not the book’s streaming.' },
          { text: 'They are unrelated, and need two separate pipelines.', correct: false,
            why: 'Shapes 1 and 3 group identically, so one pipeline can do both.' }
        ]
      },
      cards: [
        { step: 1, title: 'The chapter’s answer', html: '<p>Batch is a special case of streaming: a bounded dataset is an unbounded one that stops. One model handles both.[[src:quiz]]</p>' }
      ],
      narration: [
        'One last question, from the chapter’s own quiz. How does batch relate to streaming in the book’s model? Choose an answer.',
        'Batch is a special case. Data that ends is endless data that happens to stop, with the watermark jumping past every window at the end. One model handles both.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'One question decides the design',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Shape', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Bounded</b>, as batch', 'The file ends, so every window is final. Event 7’s delay is harmless.[[src:why]]'] },
          { step: 1, cells: ['<b>Unbounded</b>, in chunks', 'Cut by arrival: 2 of 9 events in the wrong slice, and nothing inside notices.[[src:why]]'] },
          { step: 2, cells: ['<b>Unbounded</b>, as a stream', 'Event-time windows, closed by the watermark. The 12:00 window closes before event 7; the 12:08 window never closes.[[src:why]]'] },
          { step: 3, cells: ['<b>One model</b>', 'A file is a stream whose watermark jumps past every window when it ends.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 4 leaves the clocks behind for a classic interview puzzle about endless data: the average of the last few values, kept up to date as each one arrives.</p>' },
      narration: [
        'To recap. Bounded data ends, so a batch job reads it all and every window is final. Event 7’s delay does no harm.',
        'Unbounded data cut into chunks by arrival puts 2 of the 9 events in the wrong slice, and nothing inside a chunk can notice.',
        'Unbounded data as a stream keeps the event-time windows and closes each one when the watermark passes its end. The 12:00 window closes before event 7 arrives, and the 12:08 window never closes.',
        'And it is one model: a file is a stream whose watermark jumps past every window at its end. Next, part 4 builds a program for a classic puzzle about endless data.'
      ]
    }
  ]
};
