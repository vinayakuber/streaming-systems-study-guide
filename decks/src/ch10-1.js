// Chapter 10, Part 1 — "From MapReduce to streaming": why a batch job never needed a
// watermark, what early streaming systems got wrong, and what the four questions unified.
// The phones, the two clocks and every word are introduced from zero; the viewer answers
// before each mechanism; and each mechanism is animated on the seed's nine events
// (tools/stream_seed.js), so no number can drift from the chapter.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch10';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const arrOf = pt => Math.floor(pt / seed.WIN) * seed.WIN;
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const BY_ET = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const BY_PT = seed.WIN_STARTS.map(w => E.filter(e => arrOf(e.pt) === w).reduce((a, e) => a + e.v, 0));
const AGREE = BY_ET.map((v, i) => (v === BY_PT[i] ? 'yes' : 'no'));
const OFF = BY_ET.reduce((a, v, i) => a + Math.abs(v - BY_PT[i]), 0);
const MOVED = E.filter(e => seed.winOf(e.et) !== arrOf(e.pt)).map(e => e.id);
const WM = seed.WATERMARKS.map(w => (w < 0 ? 'before 12:00' : clock(w)));
const CLOSES = E.map((_, i) => seed.WIN_STARTS.filter(w => seed.closedAt(w) === i).map(hm).join(' and ') || '—');
const NEVER = seed.WIN_STARTS.filter(w => seed.closedAt(w) === null);

if (E.length !== 9 || TOTAL !== 45 || BY_ET.join() !== '19,11,7,8' || BY_PT.join() !== '15,2,20,8' || OFF !== 26
  || AGREE.join() !== 'no,no,no,yes' || MOVED.join() !== '6,7' || seed.WINDOWS[0].join() !== '0,1,2,7'
  || seed.WIN !== 120 || seed.LAG !== 60 || NEVER.join() !== '480' || seed.closedAt(0) !== 4
  || seed.closedAt(120) !== 8 || seed.closedAt(240) !== 8 || WM[8] !== '12:08:00')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Batch’s Free Answers',
  eyebrow: 'Streaming · Ch 10 · Part 1',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'MapReduce': 'map-reduce', 'MillWheel': 'mill-wheel' } },
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'fixed window', 'batch',
    'MapReduce', 'final', 'watermark', 'trigger', 'latency', 'Beam model', 'bounded', 'unbounded'],
  sources: {
    ch:   chapter(CH, 'Chapter 10 on GitHub'),
    flow: section(CH, 'From MapReduce to streaming', 'Chapter 10 · from MapReduce to streaming'),
    why:  section(CH, 'Why the end of the input was answering two of the four questions', 'Chapter 10 · the free answers'),
    when: section(CH, 'When the unification pays, and what it does not remove', 'Chapter 10 · when the unification pays'),
    walk: section(CH, 'Visual walkthrough — the free answers, the lost clock, the unification', 'Chapter 10 · the walkthrough'),
    prog: section(CH, 'One grouping, two finality rules — stack and heap at every step', 'Chapter 10 · one grouping as a program'),
    refs: section(CH, 'Sources', 'Chapter 10 · sources')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 10 · Part 1',
      heading: 'Nine purchases, two kinds of program, and one surprising difference',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a small message carrying its value. Each message is an <b>event</b>. Events keep coming with no end: a <b>stream</b>. The program that receives them and works out answers is the <b>pipeline</b>.[[src:flow]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: 2, label: 'phones, a and b' },
        { step: 2, value: TOTAL, label: 'the value of all nine together[[src:why]]' },
        { step: 2, value: OFF, label: 'how far wrong an early streaming program was, in total[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'What did the old programs get for free?', text: 'Programs that read a whole file at once.' },
        { step: 3, n: 2, title: 'What did the first fast ones lose?', text: 'Programs that answer as events arrive.' },
        { step: 4, n: 3, title: 'What really separates the two?', text: 'It turns out not to be the adding up.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value. Each message is called an event, and events keep coming with no end: a stream.',
        'The program that receives the stream and works out answers is called the pipeline. Our example has just 9 events, from the 2 phones.',
        'The 9 values add up to 45. And you will see an early kind of fast program get this data wrong by 26 in total, without a single bug in it.',
        'Three questions. What did the old programs, which read a whole file at once, get for free? And what did the first fast programs lose?',
        'And what really separates the two kinds? It turns out not to be the adding up. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'key'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Times are shown to the minute.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, MOVED.includes(e.id) ? `<b>${hm(e.et)}</b>` : hm(e.et), MOVED.includes(e.id) ? `<b>${hm(e.pt)}</b>` : hm(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b.[[src:prog]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened and was seen at 12:00.',
        'Usually the two are seconds apart, so to the minute they match. Id 4 happened at 12:04 and was seen at 12:04.',
        'But id 6 happened at 12:03 and was seen at 12:04. And id 7 happened at 12:00 and was not seen until 12:04: its phone was offline. Seen eighth, it happened third.',
        'Which phone sent an event, a or b, is called its key. Keep the two clocks apart: the whole of this part turns on which one a program uses.'
      ]
    },

    /* ---------- 3 · question: which window does id 7 belong to ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window', 'fixed window'],
      eyebrow: '03 · Your turn',
      heading: 'The shop wants a total for every 2 minutes',
      stand: 'The shop asks: what was bought between 12:00 and 12:02? Id 7 happened at 12:00, but was seen at 12:04.',
      question: {
        step: 0,
        prompt: 'Should id 7’s value be counted in the total for 12:00 to 12:02?',
        options: [
          { text: 'Yes: the purchase happened inside that stretch.', correct: true,
            why: 'The shop is asking about what was bought then. When the message reached the pipeline does not change when the purchase was made.' },
          { text: 'No: it was seen at 12:04, after that stretch.', correct: false,
            why: 'That answers a different question: what the pipeline happened to see then. The purchase itself was made at 12:00.' },
          { text: 'Only if it arrives before 12:02.', correct: false,
            why: 'Its arrival time is a fact about the network, not about the purchase. It belongs to 12:00 whenever it arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window', html: '<p>A stretch of time that one result is worked out over is a <b>window</b>, such as 12:00 to 12:02.[[src:why]]</p>' },
        { step: 2, title: 'Fixed windows', html: '<p>Back-to-back, equal, never overlapping: 12:00 to 12:02, 12:02 to 12:04, and so on, each <b>120 s</b> wide. These are <b>fixed windows</b>.[[src:why]]</p>' }
      ],
      narration: [
        'First question. The shop asks what was bought between 12:00 and 12:02. Id 7 happened at 12:00 but was seen at 12:04. Should its value be counted? Choose an answer.',
        'Yes. The purchase happened inside that stretch, whenever its message arrived. A stretch of time that one result is worked out over is called a window.',
        'Back-to-back windows of equal width that never overlap are called fixed windows: 12:00 to 12:02, 12:02 to 12:04, and so on, 120 seconds each. Watch the events land in them.'
      ]
    },

    /* ---------- 4 · events into windows by event time ---------- */
    {
      title: 'Slice', layout: 'array',
      eyebrow: '04 · Watch each event land in its window',
      heading: 'Each event goes to the window its event time falls in',
      stand: 'Slots are the events in the order they were seen. Row 1: when each happened. Row 3: the window it belongs to.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => hm(e.et)) },
          { label: 'value', values: E.map(e => e.v) },
          { label: 'window from', values: E.map(e => hm(seed.winOf(e.et))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: seed.WINDOWS[0] }
        ]
      },
      cards: [
        { step: 2, title: 'Window 12:00 to 12:02', html: '<p>Ids 0, 1, 2 and 7, with values 5, 3, 7 and 4: total <b>19</b>. Id 7 is in, though it was seen last.[[src:why]]</p>' },
        { step: 3, title: 'Four windows hold events', html: '<p>From 12:00, 12:02, 12:04 and 12:08, with totals <b>19, 11, 7 and 8</b>: 45 in all.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen, numbered along the top. The first row is when each happened, the second its value.',
        'Now each event drops into the 2-minute window its event time falls in. The third row shows where each window starts.',
        'Look at the window from 12:00: ids 0, 1, 2 and 7, with values 5, 3, 7 and 4. Its total is 19, and id 7 counts, though it was seen last of all.',
        'Four windows hold events: from 12:00, 12:02, 12:04 and 12:08. Their totals are 19, 11, 7 and 8, which add up to 45.'
      ]
    },

    /* ---------- 5 · question: when is a batch result final ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['batch', 'MapReduce', 'final'],
      eyebrow: '05 · Your turn',
      heading: 'The old way: one file, read once, at night',
      stand: 'A nightly job reads yesterday’s file holding all 9 events, and adds up each 2-minute window.',
      question: {
        step: 0,
        prompt: 'When can that job be sure the 12:00 to 12:02 total will never change?',
        options: [
          { text: 'When it reaches the end of the file: nothing more can come.', correct: true,
            why: 'The file has a last line. Once it is read, no event can still be missing, so every total is settled.' },
          { text: 'As soon as it has read an event from after 12:02.', correct: false,
            why: 'Id 7, from 12:00, sits near the end of the file. An event from 12:04 comes before it, so that moment is too early.' },
          { text: 'Never: some event could always turn up later.', correct: false,
            why: 'That is true of a stream, not of a file. A file ends, and the end is the guarantee.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch', html: '<p>A job over an input that <b>ends</b>, such as yesterday’s file, is <b>batch</b> processing. <b>MapReduce</b> was the system that made huge batch jobs practical.[[src:flow]]</p>' },
        { step: 2, title: 'Final', html: '<p>A result that can never change again is <b>final</b>. For a batch job, every window is final at the same moment: the end of the file.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. A nightly job reads yesterday’s file, holding all 9 events, and adds up each window. When can it be sure the 12:00 total will never change? Choose an answer.',
        'When it reaches the end of the file. A job over an input that ends is called batch processing. MapReduce was the system that made huge batch jobs scalable and able to survive failures.',
        'A result that can never change again is called final. For a batch job, every window becomes final at the same moment: when the file runs out. Watch it.'
      ]
    },

    /* ---------- 6 · batch, animated ---------- */
    {
      title: 'Batch', layout: 'array',
      eyebrow: '06 · Watch the batch job finish',
      heading: 'Four totals, all final after event 9',
      stand: 'Each slot is one window. The job reads all 9 events, then the file ends.',
      array: {
        labelWidth: 170, slotLabel: 'window',
        rows: [
          { label: 'window from', values: seed.WIN_STARTS.map(hm) },
          { label: 'total', values: BY_ET },
          { label: 'final after event', values: seed.WIN_STARTS.map(() => E.length) }
        ],
        meters: ['windows read', 'all totals added'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [0, 1, 2, 3] }
        ]
      },
      cards: [
        { step: 2, title: 'All at once', html: '<p>All 4 windows are final at event 9, together. No window waits for another.[[src:why]]</p>' },
        { step: 3, title: 'Nothing else was needed', html: '<p>No rule for when to publish, and no second answer to reconcile. The end of the file settled both.[[src:why]]</p>' }
      ],
      narration: [
        'Here is the batch job’s result: one slot per window, from 12:00, 12:02, 12:04 and 12:08, with totals 19, 11, 7 and 8.',
        'Watch the totals being added: 19, then 30, and on up to 45, the value of all 9 events.',
        'And when is each final? All four after event 9, at the same moment, because that is where the file ends.',
        'Notice what the job never had to decide: when to publish a total, or what to do if a total changed. The end of the file settled both questions.'
      ]
    },

    /* ---------- 7 · question: why batch needs no watermark ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['watermark', 'trigger'],
      eyebrow: '07 · Your turn',
      heading: 'Two questions a batch job never asks',
      stand: 'A program that never stops reading must decide when a window’s total is ready to publish, and how a later, corrected total relates to an earlier one.',
      question: {
        step: 0,
        prompt: 'Why did a batch job never need to answer those two questions?',
        options: [
          { text: 'The end of its input answers both: publish once, at the end.', correct: true,
            why: 'At the end of the file every total is final, so it is published once and never revised.' },
          { text: 'Batch systems were too simple to have such features.', correct: false,
            why: 'It is not that the features were missing. The questions were already answered by the input ending.' },
          { text: 'Its events always arrived in the order they happened.', correct: false,
            why: 'Order does not matter here: id 7 sits near the end of the file and is still counted correctly.' }
        ]
      },
      cards: [
        { step: 1, title: 'A watermark', html: '<p>A streaming pipeline keeps a running estimate: “every event that happened before this moment has now arrived”. That estimate is the <b>watermark</b>. Batch has the simplest one: the end of the file.[[src:prog]]</p>' },
        { step: 2, title: 'A trigger', html: '<p>The rule for when to publish a result is a <b>trigger</b>. Batch’s trigger is: once, at the end. Neither is missing; both are given away free.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. A program that never stops reading must decide when a total is ready, and how a corrected total relates to an earlier one. Why did batch never need to? Choose an answer.',
        'The end of its input answers both. A streaming pipeline keeps a running estimate that every event before some moment has arrived. That estimate is called a watermark. Batch has the simplest: the end of the file.',
        'The rule for when to publish is called a trigger. Batch’s trigger is: once, at the end. Batch does not lack these; the ending hands them over for free. Take the ending away and both go together.'
      ]
    },

    /* ---------- 8 · question: early streaming ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['latency'],
      eyebrow: '08 · Your turn',
      heading: 'The first fast programs: answer as events arrive',
      stand: 'Early streaming systems, such as Storm, wanted answers within seconds, with no wait for any file to end. They had no notion of when an event happened.',
      question: {
        step: 0,
        prompt: 'Without a notion of when an event happened, how could such a system cut the stream into 2-minute windows?',
        options: [
          { text: 'By when each event arrived at the pipeline.', correct: true,
            why: 'Arrival is the only clock the pipeline has without a happened-time, so it buckets by when it sees each event.' },
          { text: 'By when each event happened, as the batch job did.', correct: false,
            why: 'That needs the very notion these systems lacked. It is what later systems added.' },
          { text: 'It could not form windows at all.', correct: false,
            why: 'It could, and did: it bucketed events by the time they were seen.' }
        ]
      },
      cards: [
        { step: 1, title: 'Latency', html: '<p>The delay between an event and the answer that includes it is <b>latency</b>. Early streaming systems made it low.[[src:flow]]</p>' },
        { step: 2, title: 'The price', html: '<p>They bucketed by processing time. Watch which events change window when the clock changes.[[src:why]]</p>' }
      ],
      narration: [
        'Fourth question. Early streaming systems, such as Storm, answered within seconds, with no wait for a file to end. With no notion of when an event happened, how could they form windows? Choose an answer.',
        'By when each event arrived. The delay between an event and the answer that includes it is called latency, and these systems made latency low.',
        'But they bucketed by processing time, not event time. Watch which events change window when the clock changes.'
      ]
    },

    /* ---------- 9 · which events move ---------- */
    {
      title: 'Moved', layout: 'array',
      eyebrow: '09 · Watch the events land by arrival instead',
      heading: 'Two events change window when the clock changes',
      stand: 'Row 1: the window each event belongs to by when it happened. Row 2: the window it lands in by when it was seen.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'by happened', values: E.map(e => hm(seed.winOf(e.et))) },
          { label: 'by seen', values: E.map(e => hm(arrOf(e.pt))) },
          { label: 'value', values: E.map(e => e.v) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 2] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: MOVED }
        ]
      },
      cards: [
        { step: 2, title: 'Id 6 and id 7', html: '<p>Id 6 happened at 12:03 but lands in 12:04. Id 7 happened at 12:00 but lands in 12:04. Every other event stays put.[[src:walk]]</p>' }
      ],
      narration: [
        'Here are the 9 events again. The first row is the window each belongs to by when it happened; the bottom row is its value.',
        'Now the second row: the window each event lands in by when it was seen. Most match, because most events arrive within seconds.',
        'Two do not. Id 6, value 9, happened at 12:03 but lands in 12:04. Id 7, value 4, happened at 12:00 but lands in 12:04 too. Now watch what that does to the totals.'
      ]
    },

    /* ---------- 10 · the totals by arrival ---------- */
    {
      title: 'Wrong', layout: 'array',
      eyebrow: '10 · Watch the windows compared',
      heading: '3 of the 4 windows wrong, by 26 in total',
      stand: 'Each slot is one window. Row 2: its total by when events happened. Row 3: by when they were seen.',
      array: {
        labelWidth: 170, slotLabel: 'window',
        rows: [
          { label: 'window from', values: seed.WIN_STARTS.map(hm) },
          { label: 'by happened', values: BY_ET },
          { label: 'by seen', values: BY_PT },
          { label: 'agree?', values: AGREE }
        ],
        meters: ['windows compared', 'windows wrong'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 2, title: 'Off by 26', html: '<p>12:00 reads 15 instead of 19; 12:02 reads 2 instead of 11; 12:04 reads 20 instead of 7. Only 12:08 agrees. <b>26</b> wrong in total.[[src:why]]</p>' },
        { step: 3, title: 'A different question', html: '<p>Not an approximation of the right answer: an answer to “what was <b>seen</b> then?”, which nobody asked.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the four windows. By when events happened, they hold 19, 11, 7 and 8. By when they were seen, 15, 2, 20 and 8.',
        'Watch each window compared. 12:00, no. 12:02, no. 12:04, no. 12:08 agrees. Three of the four windows are wrong.',
        'The window from 12:00 reads 15 instead of 19, because id 7 moved out. Added up, the three wrong windows are off by 26 in total.',
        'And this is not a rough version of the right answer. It is the answer to a different question, what was seen then, which nobody asked.'
      ]
    },

    /* ---------- 11 · question: limit or missing feature ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['Beam model'],
      eyebrow: '11 · Your turn',
      heading: 'Is streaming wrong by nature?',
      stand: 'The early systems answered fast and got 3 of 4 windows wrong. Some concluded that fast answers must always be rough ones.',
      question: {
        step: 0,
        prompt: 'What caused the 26 to be wrong?',
        options: [
          { text: 'A missing feature: no way to name when an event happened.', correct: true,
            why: 'The values came from the arrival clock. Give the system the happened clock and the same nine events give 19, 11, 7 and 8.' },
          { text: 'A limit of streaming: fast answers are always rough.', correct: false,
            why: 'Nothing here was rough. Every total is exact, just for the wrong clock, so a model could fix it.' },
          { text: 'A bug in how the early systems added up values.', correct: false,
            why: 'The adding was correct. Each window’s sum is right for the events that landed in it.' }
        ]
      },
      cards: [
        { step: 1, title: 'A feature, not a limit', html: '<p>A missing feature can be added, which is why a model could fix it.[[src:why]]</p>' },
        { step: 2, title: 'The Beam model', html: '<p>A way of describing any pipeline by four questions, with event time and watermarks built in, is the <b>Beam model</b>. It grew from Google’s Dataflow work.[[src:flow]]</p>' }
      ],
      narration: [
        'Fifth question. The early systems answered fast and got 3 of 4 windows wrong. What caused that? Choose an answer.',
        'A missing feature, not a limit. Every total was exact, but for the wrong clock. Give the system a way to name when an event happened, and the same nine events give 19, 11, 7 and 8.',
        'Later systems added exactly that. A way of describing any pipeline by four questions, with event time and watermarks built in, is called the Beam model. The next slide shows the path there.'
      ]
    },

    /* ---------- 12 · the arc, as a timeline ---------- */
    {
      title: 'Arc', layout: 'timeline',
      eyebrow: '12 · From MapReduce to the Beam model',
      heading: 'Correct but slow, then fast but wrong, then both',
      stand: 'Each step kept what the last one had and added what it lacked.',
      timeline: [
        { step: 0, time: '2004', title: 'MapReduce', text: 'Huge batch jobs, scalable and survive failures. Needs an input that ends.[[src:refs]]' },
        { step: 1, time: 'then', title: 'Storm', text: 'Low latency, but buckets by arrival: no event time.[[src:flow]]' },
        { step: 2, time: '2013', title: 'MillWheel', text: 'Adds watermarks, so a stream can tell when a window is done.[[src:refs]]' },
        { step: 3, time: '2015', title: 'Dataflow, then Beam', text: 'The four questions: batch and streaming as one model.[[src:refs]]' }
      ],
      narration: [
        'Here is the path. In 2004, MapReduce made huge batch jobs practical: scalable, and able to survive failures. But it needed an input that ends, and answers came late.',
        'Then early streaming systems such as Storm brought latency down, by answering as events arrived. But they bucketed by arrival, with no event time.',
        'In 2013, Google’s MillWheel added watermarks, so a stream could tell when a window had all its events.',
        'And in 2015 the Dataflow work, which became the Beam model, described any pipeline by four questions, and showed batch and streaming to be one model.'
      ]
    },

    /* ---------- 13 · the four questions side by side ---------- */
    {
      title: 'Four', layout: 'table', defines: ['bounded', 'unbounded'],
      eyebrow: '13 · The four questions, for both kinds of input',
      heading: 'The adding up was never the difference',
      stand: 'An input that ends is bounded; one that never ends is unbounded. The same sum, the same windows, both ways.',
      table: {
        columns: ['Question', 'Bounded input (batch)', 'Unbounded input (stream)'],
        rows: [
          { step: 0, cells: ['<b>What</b> is worked out?', 'a sum', 'the same sum[[src:why]]'] },
          { step: 0, cells: ['<b>Where</b> in event time?', '4 windows of 120 s', 'the same 4 windows[[src:why]]'] },
          { step: 1, cells: ['<b>When</b> is a result final?', 'at the end of input, all at once', 'when the watermark passes it[[src:why]]'] },
          { step: 1, cells: ['<b>How</b> do later answers relate?', 'nothing to relate: one answer each', 'must be chosen[[src:why]]'] }
        ]
      },
      side: { step: 2, title: 'Batch is the special case', html: '<p>Batch is streaming over an input that ends. The two rows that differ are both about time, and they are exactly the two an ending used to answer.[[src:flow]]</p>' },
      narration: [
        'An input that ends is called bounded; one that never ends is unbounded. Read the first two rows: what is worked out, a sum, and where, the same 4 windows. Identical both ways.',
        'The two rows that differ are both about time. When is a result final, and how do later answers relate? Batch answers both with its ending; a stream must answer them itself.',
        'So batch is just streaming over an input that ends. That is why the same pipeline code can run in either mode: only whether the input is bounded changes.'
      ]
    },

    /* ---------- 14 · question: same code, what differs ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '14 · Your turn',
      heading: 'One pipeline, run both ways',
      stand: 'The same code runs over the 9 events twice: once as a file that ends, once as a stream that keeps going.',
      question: {
        step: 0,
        prompt: 'What is different between the two runs?',
        options: [
          { text: 'Only when each total becomes final.', correct: true,
            why: 'Both give 19, 11, 7 and 8. The stream run cannot rely on an ending, so some windows wait, and one waits for ever.' },
          { text: 'The totals: streaming gives 15, 2, 20 and 8.', correct: false,
            why: 'That was the arrival-clock program. This pipeline uses event time in both runs, so the totals match.' },
          { text: 'Nothing at all: they are the same code.', correct: false,
            why: 'The code is the same, but the input is not: one ends and one does not, and that changes finality.' }
        ]
      },
      cards: [
        { step: 1, title: 'Same grouping', html: '<p>Both runs put the same events in the same 4 windows: <b>19, 11, 7 and 8</b>. The grouping is one function in both modes.[[src:prog]]</p>' },
        { step: 1, title: 'Different finality', html: '<p>Batch’s watermark is a constant: the end of input, which closes all 4 at event 9. A stream needs a real watermark.[[src:prog]]</p>' }
      ],
      narration: [
        'Sixth question. The same code runs over the 9 events twice: once as a file that ends, once as a stream that keeps going. What is different? Choose an answer.',
        'Only when each total becomes final. Both runs give 19, 11, 7 and 8. Watch the stream run decide finality with its watermark.'
      ]
    },

    /* ---------- 15 · the streaming watermark, animated ---------- */
    {
      title: 'Final', layout: 'array',
      eyebrow: '15 · Watch the stream decide when windows are final',
      heading: 'Three windows close. The fourth never does.',
      stand: 'Watermark: the latest happened-time so far, to the second, minus 1 minute. A window is final once the watermark reaches its end.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => hm(e.et)) },
          { label: 'watermark after', values: WM },
          { label: 'windows final', values: CLOSES }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'pick', slots: [4, 8] }
        ]
      },
      cards: [
        { step: 2, title: 'Three close', html: '<p>12:00 closes after id 4. 12:02 and 12:04 close after id 8, when the watermark jumps to 12:08:00.[[src:why]]</p>' },
        { step: 3, title: 'One never does', html: '<p>12:08 to 12:10 holds 8 and has every one of its events, yet needs the watermark at 12:10. Under batch it is final; under streaming, <b>never</b>.[[src:walk]]</p>' }
      ],
      narration: [
        'Here is the stream run. After each event, the watermark is the latest happened-time seen so far, minus 1 minute. Id 4 happened at 12:04:05, so after it the watermark is 12:03:05.',
        'A window is final when the watermark reaches its end. Watch: the window from 12:00 closes after id 4. Those from 12:02 and 12:04 close after id 8, when the watermark jumps to 12:08:00.',
        'So three windows close, each at its own moment, not all together as in batch.',
        'And the window 12:08 to 12:10 holds 8, has every one of its events, and still needs the watermark at 12:10. No later event comes. Under batch it is final; under streaming, never.'
      ]
    },

    /* ---------- 16 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '16 · Your turn · check yourself',
      heading: '“Batch is a special case.” So is batch obsolete?',
      stand: 'A team runs a job each night over yesterday’s purchases. A colleague wants to rewrite it as a stream, with a watermark.',
      question: {
        step: 0,
        prompt: 'Is that rewrite worth doing?',
        options: [
          { text: 'No: yesterday has ended, so take the free answers.', correct: true,
            why: 'The input genuinely ends, so every window is final at once with no watermark reasoning. A watermark buys nothing here.' },
          { text: 'Yes: batch is obsolete now that the model is unified.', correct: false,
            why: 'Special case means the easy case, not the obsolete one. When the input ends, batch is the right tool.' },
          { text: 'Yes: only a stream gets the event-time totals right.', correct: false,
            why: 'The batch job already gets 19, 11, 7 and 8. Event time is used in both modes.' }
        ]
      },
      cards: [
        { step: 1, title: 'When the input ends', html: '<p>Reach for a bounded run whenever the input genuinely ends, and take the free answers. Introducing a watermark buys nothing.[[src:when]]</p>' },
        { step: 1, title: 'When it pays', html: '<p>One codebase pays whenever the same logic serves history and live traffic: a backfill, a re-run after a change.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. A nightly job runs over yesterday’s purchases. A colleague wants to rewrite it as a stream, with a watermark. Is that worth doing? Choose an answer.',
        'No. Yesterday has ended, so every window is final at once, for free. Special case means the easy case, not the obsolete one. One codebase pays when the same logic must serve history and live traffic.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you now know',
      heading: 'The ending answered two questions. Take it away and both return.',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Two clocks</b>', 'Event time is when it happened; processing time is when the pipeline saw it. Id 7: 12:00 and 12:04.[[src:prog]]'] },
          { step: 0, cells: ['<b>Batch</b>', 'An input that ends. All 4 windows final at event 9, with no watermark or trigger needed.[[src:why]]'] },
          { step: 1, cells: ['<b>Early streaming</b>', 'Low latency, but bucketed by arrival: 3 of 4 windows wrong, by 26. A missing feature.[[src:why]]'] },
          { step: 1, cells: ['<b>The Beam model</b>', 'What and where are identical both ways; when and how are the two an ending used to answer.[[src:why]]'] },
          { step: 2, cells: ['<b>What stays different</b>', 'Finality: 12:08 to 12:10 holds 8, final in batch, never final in streaming.[[src:walk]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>What if you need both fast answers and correct ones, over a stream? The first answer was to build two systems. Part 2 counts what that costs.[[src:when]]</p>' },
      narration: [
        'To recap. Every event has two clocks: when it happened, its event time, and when it was seen, its processing time. A batch job reads an input that ends, so all 4 windows are final together.',
        'Early streaming systems got low latency but bucketed by arrival, leaving 3 of 4 windows wrong by 26. A missing feature, which the Beam model supplied.',
        'In that model, what and where are identical in both modes. What stays different is finality: the window 12:08 to 12:10 is final in batch and never final in streaming.',
        'Next, part 2 asks what to do when you need both fast and correct answers over a stream. The first answer was two systems, and its cost can be counted.'
      ]
    }
  ]
};
