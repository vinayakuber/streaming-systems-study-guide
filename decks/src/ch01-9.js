// Chapter 1, Part 9 — the chapter's two "Interview Questions", each told as a story and probed
// from several sides, with its code snippet built line by line (a question before each piece),
// then the chapter quiz and a recap of the whole chapter. The snippet lines come from the chapter
// source (content/ch01-*.js) through _prog.js, addressed by content, so the deck never retypes
// them. The click story and both clocks are re-introduced from zero; every count is derived from
// the one seed (tools/stream_seed.js) and asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const Q1 = snippet(CH, 0), Q2 = snippet(CH, 1);
const span = (S, a, b) => [S.at(a), S.at(b)];
const Q1_TIMES = span(Q1, 'the click carries two timestamps', 'processing_time = 12:04:40');
const Q1_BUCKET = span(Q1, 'bucket by processing_time', 'bucket by event_time');
const Q2_BATCH = span(Q2, 'unbounded-as-batch', 'up to 24h');
const Q2_STREAM = span(Q2, 'unbounded-as-streaming', 'latency ~ watermark wait');

const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const byMinute = key => { const m = {}; for (const e of E) { const k = Math.floor(e[key] / 60) * 60; m[k] = (m[k] || 0) + e.v; } return m; };
const BY_ET = byMinute('et'), BY_PT = byMinute('pt');
const MINUTES = [...new Set([...Object.keys(BY_ET), ...Object.keys(BY_PT)].map(Number))].sort((a, b) => a - b);
const ET_ROW = MINUTES.map(m => BY_ET[m] || 0), PT_ROW = MINUTES.map(m => BY_PT[m] || 0);
const DIFF = MINUTES.map((_, j) => (ET_ROW[j] !== PT_ROW[j] ? 'differs' : 'same'));
const MOVED = E.filter(e => seed.winOf(e.et) !== seed.winOf(e.pt)).map(e => e.id);

if (E[7].et !== 50 || E[7].pt !== 280 || BY_ET[0] !== 12 || BY_PT[0] !== 8 || BY_PT[240] !== 20 || DIFF.filter(d => d === 'differs').length !== 3
  || MOVED.join() !== '6,7' || E[7].pt - E[7].et !== 230 || seed.WIN !== 120)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Clock and Shape Drill',
  eyebrow: 'Streaming · Ch 1 · Part 9',
  ...shared,
  jargon: ['click', 'event', 'pipeline', 'dashboard', 'event time', 'processing time', 'bucket', 'lag', 'bounded', 'unbounded',
    'batch', 'chunk', 'streaming', 'watermark', 'latency'],
  sources: {
    ch:     chapter(CH, 'Chapter 1 on GitHub'),
    term:   section(CH, 'Why the word has to be split before anything can be designed', 'Chapter 1 · two timestamps'),
    mem:    section(CH, 'One dataset, two clocks — stack and heap at every step', 'Chapter 1 · one dataset, two clocks'),
    et:     section(CH, 'When to use which clock, and why the budget is a product decision', 'Chapter 1 · which clock'),
    wm:     section(CH, 'Why one of the two clocks is the meaningful one, and the other is the cheap one', 'Chapter 1 · the watermark'),
    shapes: section(CH, 'Three shapes of data', 'Chapter 1 · three shapes of data'),
    swhy:   section(CH, 'Why the shape of the input decides the design', 'Chapter 1 · why the shape decides'),
    swhen:  section(CH, 'When each shape is the right choice, and what "streaming generalizes batch" buys you', 'Chapter 1 · when each shape is right'),
    q1:     section(CH, 'Q1', 'Chapter 1 · interview question 1'),
    q2:     section(CH, 'Q2', 'Chapter 1 · interview question 2'),
    quiz:   section(CH, 'Quiz', 'Chapter 1 · quiz'),
    facts:  section(CH, 'Key Facts', 'Chapter 1 · key facts')
  },

  slides: [
    /* ---------- 1 · the story, and interview question 1 ---------- */
    {
      title: 'Story', layout: 'title', defines: ['click', 'event', 'pipeline', 'dashboard', 'event time', 'processing time'],
      eyebrow: '01 · Chapter 1 · Part 9 · the interview questions',
      heading: 'Two interview questions about clicks, asked from every side',
      hero: { step: 0, text: 'People click on a website. Each report of <b>clicks</b> is an <b>event</b>; a <b>pipeline</b> of programs adds them up for a <b>dashboard</b>, a screen of live counts. Every event has two times: when it happened, its <b>event time</b>, and when the pipeline saw it, its <b>processing time</b>.[[src:term]]' },
      tiles: [
        { step: 1, value: 230, label: 'seconds between one click’s two times[[src:q1]]' },
        { step: 1, value: 2, label: 'interview questions, each from several sides[[src:q1]]' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: 24, label: 'hours a fraud alert can wait, in question 2[[src:q2]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'The screen', text: 'Clicks per minute, live.' },
        { step: 3, n: 2, title: 'The spike', text: 'Under heavy traffic, the numbers shift into the wrong minutes.' },
        { step: 4, n: 3, title: 'The example', text: 'A click from 12:00:50, seen at 12:04:40, lands in the 12:04 minute.' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'People click on a website. Each report of clicks is an event, and a pipeline adds them up for a dashboard, a screen of live counts. Every event has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'In the chapter’s data, one click’s two times are 230 seconds apart. This part takes the chapter’s 2 interview questions and asks each from several sides.',
        'Then it asks the 5 questions of the chapter quiz. Question 2 is about a fraud alert that waits up to 24 hours.',
        'Interview question 1. A dashboard shows clicks per minute. Under a traffic spike, the numbers shift into the wrong minutes.',
        'A click that happened at 12:00:50 lands in the 12:04 minute, because the pipeline saw it at 12:04:40. You will answer first, every time.'
      ]
    },

    /* ---------- 2 · Q1: what is wrong, and why ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['bucket'],
      eyebrow: '02 · Interview question 1 · what is wrong, and why',
      heading: 'Why does a 12:00 click land in 12:04?',
      stand: 'The pipeline keeps one running count per minute, and drops each click into one of them.',
      question: {
        step: 0,
        prompt: 'What is the pipeline doing that sends the 12:00:50 click into the 12:04 minute?',
        options: [
          { text: 'Choosing the minute by when it saw the click.', correct: true,
            why: 'It saw the click at 12:04:40, so that is the minute it picks. The click happened four minutes earlier.' },
          { text: 'Losing clicks during the traffic spike.', correct: false,
            why: 'Nothing is lost: every click is counted once. It is counted in the wrong minute.' },
          { text: 'Running its clock four minutes fast.', correct: false,
            why: 'Its clock is right. The click really did reach it at 12:04:40, after waiting in the network.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A bucket', html: '<p>Each per-minute count is a <b>bucket</b>. A busy pipeline that buckets by processing time groups clicks by when <b>it</b> was busy, not by when users clicked.[[src:term]]</p>' },
        { step: 2, title: 'Worse under load', html: '<p>The busier the pipeline, the longer the delays, and the further clicks shift. The error grows exactly when the traffic matters most.[[src:q1]]</p>' }
      ],
      narration: [
        'First angle: what is wrong, and why? The pipeline keeps a running count per minute. What is it doing that sends the 12:00:50 click into the 12:04 minute? Choose an answer.',
        'Choosing the minute by when it saw the click. Each per-minute count is called a bucket. Bucketing by processing time groups clicks by when the pipeline was busy, not when users clicked.',
        'And it gets worse under load: the busier the pipeline, the longer the delays, and the further clicks shift. The error grows exactly when traffic matters most.'
      ]
    },

    /* ---------- 3 · Q1: the snippet, the two times ---------- */
    {
      title: 'Times', layout: 'code',
      eyebrow: '03 · Interview question 1 · the snippet, lines 1 to 3',
      heading: 'Write down both times the click carries',
      stand: 'The chapter’s snippet is five comment lines. It starts by naming the two timestamps.',
      question: { step: 0, prompt: 'Which two times does this click carry?', options: [
        { text: 'The time it was sent, and the time it was stored.', correct: false, why: 'Neither is what matters here. The send time depends on the network; the store time is later still.' },
        { text: 'When the user clicked, 12:00:50, and when the pipeline saw it, 12:04:40.', correct: true, why: 'Event time and processing time: the user’s real click time, and the busy pipeline’s time.' },
        { text: 'Just one, 12:04:40, since that is when it was counted.', correct: false, why: 'The device stamped 12:00:50 when the user clicked. That time travels with the event.' } ] },
      code: Q1.build({ add: [Q1_TIMES], step: 1 }),
      cards: [ { step: 2, title: 'Two times, always apart', html: '<p><code>event_time = 12:00:50</code>, the user’s real click time. <code>processing_time = 12:04:40</code>, when the busy pipeline saw it: 230 seconds later.[[src:q1]]</p>' } ],
      narration: [
        'Now the chapter’s snippet, five comment lines. It starts by naming the times the click carries. Which two? Choose an answer.',
        'When the user clicked, and when the pipeline saw it. Here are the first three lines: event time, 12:00:50, the user’s real click time, and processing time, 12:04:40, when the busy pipeline saw it.',
        'They are 230 seconds apart, and nothing is broken. The next two lines say what each choice of clock does to the click.'
      ]
    },

    /* ---------- 4 · Q1: the snippet, the choice ---------- */
    {
      title: 'Clock', layout: 'code',
      eyebrow: '04 · Interview question 1 · the snippet, lines 4 and 5',
      heading: 'Bucket by which clock?',
      stand: 'The interviewer’s question: which clock should the dashboard bucket by, and why?',
      question: { step: 0, prompt: 'Which clock should a clicks-per-minute dashboard bucket by?', options: [
        { text: 'Processing time: it is the pipeline’s own and always at hand.', correct: false, why: 'Cheap, but it answers “when did we see it?”, not “when did users click?”.' },
        { text: 'Event time: the click lands in the minute it happened.', correct: true, why: 'The click goes to 12:00, where it happened, however busy the pipeline was.' },
        { text: 'Whichever time is earlier, to be safe.', correct: false, why: 'That is always event time here, but for the wrong reason. The rule is about the question, not the size.' } ] },
      code: Q1.build({ before: [Q1_TIMES], add: [Q1_BUCKET], step: 1 }),
      cards: [ { step: 2, title: 'The chapter’s answer', html: '<p>Bucket by processing time → the click lands at 12:04 → <b>wrong</b>. Bucket by event time → it lands at 12:00 → <b>right</b>. Group by when it happened, not when the busy pipeline saw it.[[src:q1]]</p>' } ],
      narration: [
        'The interviewer’s question: which clock should a clicks-per-minute dashboard bucket by? Choose an answer.',
        'Event time. Here are the last two lines. Bucket by processing time, and the click lands at 12:04: wrong. Bucket by event time, and it lands at 12:00: right.',
        'So the answer is: group each click by when it happened, rather than when the busy pipeline happened to see it.'
      ]
    },

    /* ---------- 5 · Q1: watch both counts ---------- */
    {
      title: 'Count', layout: 'array',
      eyebrow: '05 · Interview question 1 · what it does to the whole screen',
      heading: 'The same nine events, bucketed both ways',
      stand: 'The chapter’s nine events. One column per minute.',
      array: {
        labelWidth: 170, slots: false,
        rows: [
          { label: 'minute', values: MINUTES.map(m => clock(m).slice(0, 5)) },
          { label: 'by event time', values: ET_ROW },
          { label: 'by processing time', values: PT_ROW },
          { label: 'the two', values: DIFF }
        ],
        meters: ['minutes compared', 'minutes that differ'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'differs', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 2, do: 'pick', slots: [0, 4] }
        ]
      },
      cards: [
        { step: 2, title: '12:00 and 12:04', html: '<p>12:00 holds <b>12</b> by event time, <b>8</b> by processing time. 12:04 holds 7, or <b>20</b> when late clicks pile in.[[src:mem]]</p>' }
      ],
      narration: [
        'Here is what the choice does to the whole screen, on the chapter’s nine events. One column per minute: the count by event time, and the count by processing time.',
        'Compare them minute by minute. Watch the pointer: 3 of the 6 minutes differ.',
        'The 12:00 minute shows 12 by event time but 8 by processing time. And 12:04 shows 7, or 20 when the late clicks pile into it. No click is lost; they are filed in the wrong minutes.'
      ]
    },

    /* ---------- 6 · Q1: the third component, lag ---------- */
    {
      title: 'Lag', layout: 'ask', defines: ['lag'],
      eyebrow: '06 · Interview question 1 · the third component',
      heading: 'What is the gap between the clocks good for?',
      stand: 'The chapter lists three components for this question: event time, processing time, and the gap between them.',
      question: {
        step: 0,
        prompt: 'Processing time minus event time, for each click: what should a team do with that number?',
        options: [
          { text: 'Ignore it: only event time matters.', correct: false,
            why: 'Event time is the right bucket, but the gap is the clearest measure of how far behind the pipeline is.' },
          { text: 'Add it to every count, to correct the totals.', correct: false,
            why: 'The gap is in seconds, the counts are clicks. Adding them mixes two different things.' },
          { text: 'Watch it, and raise an alarm when it grows.', correct: true,
            why: 'The gap between the clocks is your lag. That is the number to alert on.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Lag', html: '<p>The gap between the two clocks is the pipeline’s <b>lag</b>. Here it is 230 seconds for one click. Use both clocks to measure yourself.[[src:et]]</p>' },
        { step: 2, title: 'Each clock has its question', html: '<p>“How many clicks happened at 12:00?” — event time, 12. “How many clicks did we receive in that minute?” — processing time, 8. Both right.[[src:et]]</p>' }
      ],
      narration: [
        'The chapter lists three components for this question: event time, processing time, and the gap between them. What should a team do with that gap? Choose an answer.',
        'Watch it, and raise an alarm when it grows. The gap between the clocks is the pipeline’s lag, 230 seconds for this click. It is the number to alert on.',
        'And each clock has its own question. How many clicks happened at 12:00 is event time: 12. How many clicks did we receive in that minute is processing time: 8. Both are right.'
      ]
    },

    /* ---------- 7 · Q1: the same question, another reader ---------- */
    {
      title: 'Vary', layout: 'ask',
      eyebrow: '07 · Interview question 1 · the same question, another reader',
      heading: 'The platform team asks a different question',
      stand: 'The platform team wants to know how much work the pipeline did: how many clicks did it take in during the 12:04 minute?',
      question: {
        step: 0,
        prompt: 'Which count answers the platform team?',
        options: [
          { text: '7: the clicks that happened at 12:04.', correct: false,
            why: 'That is about users. The platform team is asking about the pipeline’s own workload.' },
          { text: '20: the clicks the pipeline received at 12:04.', correct: true,
            why: 'A question about the system itself is a processing-time question. For it, 20 is exactly right.' },
          { text: '12: the clicks that happened at 12:00.', correct: false,
            why: 'That is a different minute, and a question about users.' }
        ]
      },
      cards: [
        { step: 1, title: 'Read the question for its clock', html: '<p>Processing time is not the lazy choice. It is the right answer to a question about the system: queue depth, events handled per second.[[src:et]]</p>' }
      ],
      narration: [
        'Same data, another reader. The platform team asks how much work the pipeline did: how many clicks it took in during the 12:04 minute. Which count answers them? Choose an answer.',
        'Twenty, the clicks it received at 12:04. A question about the system itself is a processing-time question. So read every question for the clock it names: users, or the pipeline.'
      ]
    },

    /* ---------- 8 · Q2: the story, and the shape ---------- */
    {
      title: 'Shape', layout: 'ask', defines: ['bounded', 'unbounded', 'batch', 'chunk'],
      eyebrow: '08 · Interview question 2 · the story, and the shape of the data',
      heading: 'A fraud alert that fires the next morning',
      stand: 'A team runs a daily job over its click stream. A fraud alert that should fire the moment a card is used fires the next morning, because every answer waits for the midnight run.',
      question: {
        step: 0,
        prompt: 'What shape is this data, and how is it being processed?',
        options: [
          { text: 'Data that ends, read once by a nightly job.', correct: false,
            why: 'A day of logs ends, but the click stream does not. The team cuts it into days because its tools want an end.' },
          { text: 'Data that never ends, cut into day-long chunks.', correct: true,
            why: 'Clicks never stop, but each night’s job sees one finished day. Nothing is visible until the day is cut.' },
          { text: 'Data that never ends, handled as each event arrives.', correct: false,
            why: 'Then the alert would fire within moments, not the next morning.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Bounded and unbounded', html: '<p><b>Bounded</b> data ends, like one day of logs. <b>Unbounded</b> data never ends, like a click stream.[[src:shapes]]</p>' },
        { step: 2, title: 'Batch, and chunks', html: '<p>A <b>batch</b> job reads a finished pile of data and stops. Cutting endless data into finite <b>chunks</b>, a batch job each, is “unbounded processed as batch”.[[src:shapes]]</p>' }
      ],
      narration: [
        'Interview question 2. A team runs a daily job over its click stream. A fraud alert that should fire the moment a card is used fires the next morning. What shape is this data, and how is it processed? Choose an answer.',
        'Data that never ends, cut into day-long chunks. Data that ends, like one day of logs, is called bounded. Data that never ends, like a click stream, is called unbounded.',
        'A job that reads a finished pile and stops is a batch job. Cutting endless data into finite chunks, each run as a batch, is unbounded data processed as batch.'
      ]
    },

    /* ---------- 9 · Q2: the snippet, the batch half ---------- */
    {
      title: 'Batch', layout: 'code',
      eyebrow: '09 · Interview question 2 · the snippet, lines 1 and 2',
      heading: 'Day-long chunks: how late can an answer be?',
      stand: 'The chapter’s snippet for this question is four comment lines. The first two describe what the team does now.',
      question: { step: 0, prompt: 'With one job per day-long chunk, how late can a change show up?', options: [
        { text: 'A few seconds, once the job is fast enough.', correct: false, why: 'Speed is not the limit. The job cannot start until the day has been cut.' },
        { text: 'Up to a whole day, at the next chunk boundary.', correct: true, why: 'A card used just after midnight is not seen until the next midnight run.' },
        { text: 'Never: changes are lost between chunks.', correct: false, why: 'Nothing is lost. It is only late, by up to one chunk.' } ] },
      code: Q2.build({ add: [Q2_BATCH], step: 1 }),
      cards: [ { step: 2, title: 'The chunk sets the freshness', html: '<p>Slice into 1-day chunks, run a job per chunk: a change is reflected only at the next boundary, <b>up to 24h</b> later. The chunk boundary is the best freshness any answer can have.[[src:q2]]</p>' } ],
      narration: [
        'Now the chapter’s snippet, four comment lines. The first two describe what the team does now. With one job per day-long chunk, how late can a change show up? Choose an answer.',
        'Up to a whole day. Here are the first two lines: slice into one-day chunks and run a job per chunk, so a change is reflected only at the next chunk boundary, up to 24 hours later.',
        'The chunk boundary becomes the best freshness any answer can have. A fraud alert built this way can never be faster than the chunk.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, the streaming half ---------- */
    {
      title: 'Stream', layout: 'code', defines: ['streaming', 'watermark', 'latency'],
      eyebrow: '10 · Interview question 2 · the snippet, lines 3 and 4',
      heading: 'Process each event as it arrives',
      stand: 'The alternative: no artificial boundary at all. But an event-time answer still has to decide when it is complete.',
      question: { step: 0, prompt: 'Processed as a stream, what limits how soon an event-time answer appears?', options: [
        { text: 'Nothing: every answer appears instantly.', correct: false, why: 'Late events still exist. The pipeline must wait some time before calling a window complete.' },
        { text: 'The next midnight, as before.', correct: false, why: 'There is no midnight cut any more. That boundary is exactly what streaming removes.' },
        { text: 'How long it waits for stragglers: the watermark.', correct: true, why: 'An event-time answer is “as complete as the watermark says”, so its delay is the watermark’s wait.' } ] },
      code: Q2.build({ before: [Q2_BATCH], add: [Q2_STREAM], step: 1 }),
      cards: [ { step: 2, title: 'Streaming, the watermark, latency', html: '<p><b>Streaming</b>: an engine built for unbounded data, handling each event on arrival. A <b>watermark</b> estimates when no earlier event is still coming. The wait for an answer, its <b>latency</b>, is about the watermark’s wait.[[src:q2]]</p>' } ],
      narration: [
        'The alternative: process each event as it arrives, with no artificial boundary. Processed as a stream, what limits how soon an event-time answer appears? Choose an answer.',
        'How long it waits for stragglers. Here are the last two lines: unbounded as streaming, process each event on arrival, so there is no artificial boundary, and the delay is about the watermark’s wait.',
        'Streaming, in this book, is an engine built for unbounded data. A watermark is its estimate that no earlier event is still coming. And the wait before an answer appears is called latency.'
      ]
    },

    /* ---------- 11 · Q2: what else chunks get wrong ---------- */
    {
      title: 'Wrong', layout: 'ask',
      eyebrow: '11 · Interview question 2 · what else breaks',
      heading: 'Chunks cut by arrival, on the chapter’s nine events',
      stand: 'Cut the nine events into 120-second chunks by when they arrived, and compare with the 120-second windows they happened in.',
      question: {
        step: 0,
        prompt: 'Besides lateness, what else do chunks cut by arrival get wrong?',
        options: [
          { text: 'Nothing else: they are only late.', correct: false,
            why: 'Events 6 and 7 arrive in a later chunk than the one they happened in, so their counts land in the wrong place.' },
          { text: 'Some events land in a chunk that is not their own.', correct: true,
            why: '2 of 9 events: event 6 is out by 120 seconds, event 7 by 240. And no chunk can notice from the inside.' },
          { text: 'They count some events twice.', correct: false,
            why: 'Each event lands in exactly one chunk. The problem is which one, not how many times.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: '22% in the wrong bucket', html: '<p>Events <b>' + MOVED.join(' and ') + '</b> land in the wrong chunk: 2 of 9. Each chunk is internally consistent, finishes cleanly, and reports a wrong number.[[src:swhy]]</p>' },
        { step: 2, title: 'When chunks are fine', html: '<p>When the buckets need not be exact: an ingest-rate graph, a rough volume trend. Simple to run is a real advantage.[[src:swhen]]</p>' }
      ],
      narration: [
        'Another angle. Cut the chapter’s nine events into 120-second chunks by arrival, and compare with the windows they happened in. Besides lateness, what else do arrival chunks get wrong? Choose an answer.',
        'Some events land in a chunk that is not their own: events 6 and 7, 2 of 9, or 22 percent. Each chunk is internally consistent, finishes cleanly, and reports a wrong number.',
        'Chunks are still fine when the buckets need not be exact, like a rough graph of how much data is arriving. Being simple to run is a real advantage.'
      ]
    },

    /* ---------- 12 · Q2: the price of streaming ---------- */
    {
      title: 'Price', layout: 'ask',
      eyebrow: '12 · Interview question 2 · what the change costs',
      heading: 'Is switching to streaming free?',
      stand: 'The team moves the fraud check to a stream. Each card use is now handled as it arrives.',
      question: {
        step: 0,
        prompt: 'What new question does the team now have to answer, that the nightly job never asked?',
        options: [
          { text: 'When an answer is complete enough to act on.', correct: true,
            why: 'With no file end, the pipeline must decide when to speak, and what to do with events that arrive later.' },
          { text: 'How to sort a day of clicks overnight.', correct: false,
            why: 'That is the old job’s work. A stream never has a finished day to sort.' },
          { text: 'Nothing: it is the same job, run more often.', correct: false,
            why: 'Running a batch more often is still chunks by arrival. Streaming changes when and how answers are declared done.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The price', html: '<p>Streaming makes you answer “when do I speak?” explicitly — which is the entire rest of the book.[[src:swhen]]</p>' },
        { step: 2, title: 'And it covers batch too', html: '<p>A file that ends is a stream whose watermark jumps past every window at the end. One model, one pipeline, for history and for live data.[[src:swhen]]</p>' }
      ],
      narration: [
        'Last angle. The team moves the fraud check to a stream; each card use is handled as it arrives. What new question must the team now answer, that the nightly job never asked? Choose an answer.',
        'When an answer is complete enough to act on. With no file end, the pipeline must decide when to speak, and what to do with events that come later. That is the entire rest of the book.',
        'And streaming covers batch too. A file that ends is a stream whose watermark jumps past every window at its end. One model for history and for live data.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Q1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'What does the book mean by streaming?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What precise meaning does the book give to “streaming”?',
        options: [
          { text: 'Any program that is not a batch job.', correct: false,
            why: 'Streaming is not defined as “not batch”. Batch turns out to be a special case of it.' },
          { text: 'An engine designed for infinite datasets, applied to data that never completes.', correct: true,
            why: 'The book fixes the word to one meaning: an engine built for unbounded data.' },
          { text: 'Another word for low latency.', correct: false,
            why: 'Low latency is a separate wish. A batch job on a tight schedule can meet it.' },
          { text: 'Another word for an event-driven design.', correct: false,
            why: 'Work started by each event is one of the five meanings people use, not the book’s.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>An engine for infinite datasets — not merely “fast” or “not batch”.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What precise meaning does the book give to the word streaming? Choose an answer.',
        'An engine designed for infinite datasets, applied to data that arrives gradually and never completes. Not merely fast, and not merely the opposite of batch.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'Which timestamp for clicks per minute?',
      stand: 'Remember the 12:00:50 click, seen at 12:04:40.',
      question: {
        step: 0,
        prompt: 'Which timestamp should a clicks-per-minute dashboard key on?',
        options: [
          { text: 'Processing time.', correct: false,
            why: 'That measures the pipeline. It put the 12:00:50 click into 12:04.' },
          { text: 'Ingestion time, when the click entered the system.', correct: false,
            why: 'That is still a pipeline time, not the user’s. It shifts under load just the same.' },
          { text: 'The server’s wall clock when the count is shown.', correct: false,
            why: 'The server clock says when you looked, not when anyone clicked.' },
          { text: 'Event time.', correct: true,
            why: 'Business questions are about when things happened, so event time is the key.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Event time: processing time measures the pipeline, not the user.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. Which timestamp should a clicks-per-minute dashboard key on? Choose an answer.',
        'Event time. Business questions are about when things happened. Processing time, ingestion time and the server’s clock all measure the pipeline, not the user.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'What does slicing endless data into batches cost?',
      stand: 'Remember the fraud alert that fired the next morning.',
      question: {
        step: 0,
        prompt: 'What is the cost of unbounded data processed as batch?',
        options: [
          { text: 'Higher throughput.', correct: false,
            why: 'Throughput is how much work gets done, which is a benefit if anything, not a cost.' },
          { text: 'Results lag by up to one chunk.', correct: true,
            why: 'A change is reflected only at the next chunk boundary: up to a day with daily chunks.' },
          { text: 'It cannot grow to more data.', correct: false,
            why: 'Batch jobs can be very large. Size is not the problem; the boundary is.' },
          { text: 'It loses events.', correct: false,
            why: 'Every event is counted, in some chunk. It is late, or misplaced, not lost.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Slicing a never-ending stream into chunks means a change shows only at the next boundary.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is the cost of unbounded data processed as batch? Choose an answer.',
        'Results lag by up to one chunk. A change is reflected only at the next chunk boundary, which with daily chunks is up to a day.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'How do batch and streaming relate?',
      stand: 'Remember: a finished file groups exactly like the stream, and differs only in when it is done.',
      question: {
        step: 0,
        prompt: 'How does batch relate to streaming in the Beam model, the book’s model?',
        options: [
          { text: 'They are unrelated.', correct: false,
            why: 'They group events identically. Only the moment of “done” differs.' },
          { text: 'Streaming is a special case of batch.', correct: false,
            why: 'The other way round: a bounded dataset is an unbounded one that happens to stop.' },
          { text: 'Batch is a special case: data that ends is a stream that stops.', correct: true,
            why: 'One model handles both. At the end of a file, every window closes at once.' },
          { text: 'Batch always outperforms streaming.', correct: false,
            why: 'Speed is not the relationship. Batch was up to a day late on the fraud alert.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Batch is a special case of streaming — a bounded dataset is an unbounded one that stops.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. How does batch relate to streaming in the book’s model? Choose an answer.',
        'Batch is a special case of streaming. Data that ends is just a stream that happens to stop, so one model and one pipeline handle both.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'Why do the two clocks drift apart?',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'Why do event time and processing time diverge?',
        options: [
          { text: 'They never really diverge.', correct: false,
            why: 'They disagree on every event. The 12:00:50 click was seen 230 seconds later.' },
          { text: 'Clock drift on the devices, and nothing else.', correct: false,
            why: 'Device clocks can drift, but most of the gap is the journey, not the clock.' },
          { text: 'Event time is measured in a different time zone.', correct: false,
            why: 'Both are on the same clock. The difference is the delay between happening and being seen.' },
          { text: 'Network delay, queueing, overload and replays.', correct: true,
            why: 'Everything between the device and the pipeline can hold an event up.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The gap is caused by everything between the producer and the processor: network, queues, and replays.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. Why do event time and processing time diverge? Choose an answer.',
        'Network delay, queueing, overload and replays: everything between the device and the pipeline can hold an event up, by an amount nobody controls.'
      ]
    },

    /* ---------- 18 · recap of the chapter ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 1, and its two interview questions',
      heading: 'One word, two clocks, three shapes',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Streaming</b>', 'An engine built for unbounded data — not a promise of speed.[[src:facts]]'] },
          { step: 1, cells: ['<b>Question 1 · which clock</b>', 'Bucket by event time: the 12:00:50 click belongs to 12:00, not 12:04. Watch the lag.[[src:q1]]'] },
          { step: 1, cells: ['<b>Each clock’s question</b>', 'Users: event time (12 at 12:00). The pipeline: processing time (8).[[src:et]]'] },
          { step: 2, cells: ['<b>Question 2 · which shape</b>', 'Unbounded data in day chunks lags up to 24h; a stream removes the boundary and waits only for the watermark.[[src:q2]]'] },
          { step: 3, cells: ['<b>One model</b>', 'Batch is the special case: a stream that stops.[[src:facts]]'] }
        ]
      },
      side: { step: 3, title: 'Next · chapter 2', html: '<p>The four questions — what, where, when, how — turn this vocabulary into a full pipeline: windows, triggers and watermarks, on the same nine events.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. Streaming, in this book, means an engine built for unbounded data. It is not a promise of speed.',
        'Question 1: bucket by event time, so the 12:00:50 click counts in 12:00, not 12:04, and watch the lag between the clocks. Users’ questions take event time; the pipeline’s questions take processing time.',
        'Question 2: unbounded data cut into day-long chunks lags by up to 24 hours. A stream removes the boundary and waits only for the watermark.',
        'And it is one model: batch is a stream that stops. Chapter 2 builds the four questions, what, where, when and how, on the same nine events.'
      ]
    }
  ]
};
