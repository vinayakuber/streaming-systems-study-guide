// Chapter 7, Part 1 — "Why state must persist", for a viewer who has read nothing before it.
// The story, the nine events and every word (both clocks, window, entry, state, replay,
// checkpoint, watermark) are introduced here; the viewer answers before each explanation; the
// fold, the rebuild and the bound are animated rather than described. Every event comes from
// the one seed (tools/stream_seed.js), and the numbers the narration quotes are recomputed
// from it below, so the deck fails to build if the data ever changes.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch07';
const E = seed.EVENTS;                                   // in processing order
const WIN = seed.WIN;
const winOf = seed.winOf;
const ID = e => `${e.key}@${winOf(e.et)}`;
const ENTRIES = [];                                      // (key, window) entries, in order of birth
const VAL = {};
E.forEach(e => { const k = ID(e); if (!(k in VAL)) { ENTRIES.push(k); VAL[k] = 0; } VAL[k] += e.v; });
const TOTAL = E.reduce((s, e) => s + e.v, 0);
const TOP_WM = Math.max(...seed.WATERMARKS);
const END = k => Number(k.split('@')[1]) + WIN;
const FREED = ENTRIES.map(k => (END(k) <= TOP_WM ? 'yes' : 'no'));
const PREFIX = E.slice(0, 5).reduce((s, e) => s + e.v, 0);

if (E.length !== 9 || ENTRIES.length !== 7 || TOTAL !== 45 || VAL['a@0'] !== 8 || VAL['b@0'] !== 11
  || ENTRIES.join() !== 'a@0,b@0,a@120,a@240,b@240,b@120,a@480' || TOP_WM !== 480 || seed.LAG !== 60
  || FREED.filter(x => x === 'no').length !== 1 || PREFIX !== 23 || WIN !== 120 || E[7].et !== 50 || E[7].pt !== 280)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'State Worth Saving',
  eyebrow: 'Streaming · Ch 7 · Part 1',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs } },
  jargon: ['event', 'key', 'value', 'stream', 'pipeline', 'event time', 'processing time', 'window', 'entry',
    'state', 'fold', 'replay', 'checkpoint', 'cache', 'watermark'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    why:   section(CH, 'Why state must persist', 'Chapter 7 · why state must persist'),
    time:  section(CH, 'Why persistence buys time rather than correctness', 'Chapter 7 · persistence buys time'),
    when:  section(CH, 'When to persist, when to rebuild, and what persistence makes worse', 'Chapter 7 · when to persist'),
    fold:  section(CH, 'State as a fold — stack and heap at every step', 'Chapter 7 · state as a fold')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 7 · Part 1',
      heading: 'Two users, nine events, and totals that must outlive a crash',
      hero: { step: 0, text: 'An app records what two users, <code>a</code> and <code>b</code>, do. Each thing a user does is an <b>event</b>. It carries the user it belongs to, called its <b>key</b>, and a number, called its <b>value</b> — think of points scored. Events keep arriving, one after another, with no end: a <b>stream</b>. A program called a <b>pipeline</b> reads the stream and keeps running totals.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example[[src:time]]' },
        { step: 1, value: 2, label: 'keys: a and b' },
        { step: 2, value: TOTAL, label: 'all the values added up[[src:fold]]' },
        { step: 2, value: 7, label: 'running totals the pipeline holds at the end[[src:time]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'What does the pipeline remember?', text: 'The totals it has built so far, and nothing else.' },
        { step: 3, n: 2, title: 'What does a crash cost?', text: 'Re-reading events, or not, depending on what was saved.' },
        { step: 4, n: 3, title: 'What can never be rebuilt, and what is never forgotten?', text: 'One direction only works, and one total never goes away.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app records what two users, A and B, do. Each thing a user does is an event. It carries the user it belongs to, called its key, and a number, called its value, like points scored.',
        'Events keep arriving with no end, which is called a stream. A program called a pipeline reads it and keeps running totals. Our example has 9 events and 2 keys.',
        'All 9 values add up to 45. At the end, the pipeline is holding 7 running totals. We will build both numbers ourselves.',
        'This part asks three questions. What exactly does the pipeline remember? And what does a crash cost it?',
        'And what can never be rebuilt, and what is never forgotten? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the nine events, two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and their two clocks',
      heading: 'Every event has two times: when it happened, and when it was seen',
      stand: 'The events in the order the pipeline saw them. Times are seconds after 12:00.',
      table: {
        columns: ['Seen as', 'key', 'happened at', 'seen at', 'value'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 7 ? 1 : 2,
          cells: [`event ${e.id}`, `<code>${e.key}</code>`, i === 7 ? `<b>${e.et} s</b>` : `${e.et} s`, i === 7 ? `<b>${e.pt} s</b>` : `${e.pt} s`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks', html: '<ul class="l"><li><b>Event time</b> — when the thing actually happened, stamped by the phone that recorded it.</li><li><b>Processing time</b> — when the pipeline saw it, read off the pipeline’s own clock.</li><li>Event 7 happened at 50 s but was seen at 280 s: a phone was offline. Nothing is broken; the clocks simply disagree.[[src:why]]</li></ul>' },
      narration: [
        'Here are the events, in the order the pipeline saw them, numbered from 0. Event 0 is user A, value 5, and it happened 1 second after 12:00.',
        'Each event has two times. When it happened, and when the pipeline saw it. Event 4 happened at 245 seconds and was seen at 246.',
        'Now look at event 7. It happened at 50 seconds, but the pipeline only saw it at 280. Its phone was offline, so it arrived late and out of order.',
        'So there are two clocks. Event time is when the thing actually happened. Processing time is when the pipeline saw it. They disagree, and nothing is broken.'
      ]
    },

    /* ---------- 3 · question: which clock picks the window ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window'],
      eyebrow: '03 · Your turn',
      heading: 'Totals per user, per two-minute stretch',
      stand: 'The pipeline keeps one total per user for each 120-second stretch of time: 0 to 120 s, 120 to 240 s, and so on.',
      question: {
        step: 0,
        prompt: 'Event 7 happened at 50 s and was seen at 280 s. Which stretch should its value be added to?',
        options: [
          { text: 'The stretch from 0 to 120 s, by when it happened.', correct: true,
            why: 'The total is meant to describe what users did in that stretch. When the pipeline got round to seeing it does not change when it happened.' },
          { text: 'The stretch from 240 to 360 s, by when it was seen.', correct: false,
            why: 'Then a late phone would move points into the wrong stretch, and the totals would depend on network delays.' },
          { text: 'Neither: it arrived too late to count at all.', correct: false,
            why: 'Nothing has been thrown away yet. Deciding when an event is too late comes later in this part.' }
        ]
      },
      cards: [
        { step: 1, title: 'Window', html: '<p>A 120-second stretch of <b>event time</b> is called a <b>window</b>. It is named by its start: window 0 covers 0 to 120 s, window 480 covers 480 to 600 s.[[src:time]]</p>' },
        { step: 2, title: 'Two clocks, two jobs', html: '<p>Event time decides <b>which window</b> an event belongs to. Processing time decides <b>the order</b> the pipeline reads events in.[[src:why]]</p>' }
      ],
      narration: [
        'First question. The pipeline keeps one total per user for each 120-second stretch. Event 7 happened at 50 seconds and was seen at 280. Which stretch gets its value? Choose an answer.',
        'The stretch from 0 to 120 seconds, by when it happened. A 120-second stretch of event time is called a window, and it is named by its start: window 0, window 120, and so on.',
        'So the two clocks have two different jobs. Event time picks the window. Processing time is just the order in which the pipeline reads the events.'
      ]
    },

    /* ---------- 4 · the fold, animated ---------- */
    {
      title: 'Fold', layout: 'array', defines: ['entry', 'state', 'fold'],
      eyebrow: '04 · Watch the pipeline add the events up',
      heading: 'Nine events become a handful of running totals',
      stand: 'The events in the order they were seen. Second row: the window each one belongs to, by event time.',
      array: {
        labelWidth: 150, slotLabel: 'event',
        rows: [
          { label: 'key', values: E.map(e => e.key) },
          { label: 'window', values: E.map(e => winOf(e.et)) },
          { label: 'value', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'values added'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'pick', slots: [0, 1] },
          { step: 3, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 260 }
        ]
      },
      cards: [
        { step: 1, title: 'Entry', html: '<p>One running total for one key in one window is an <b>entry</b>, written key@window. Events 0 and 1 are both key a in window 0, so entry <code>a@0</code> = 5 + 3 = <b>8</b>.[[src:time]]</p>' },
        { step: 2, title: 'State', html: '<p>All the entries together are the <b>state</b>: everything the pipeline remembers between events. Without it, each event would start from nothing.[[src:why]]</p>' },
        { step: 3, title: 'Fold', html: '<p>Adding the events into the entries one at a time, in order, is called a <b>fold</b>. 9 events read, 45 added in all.[[src:fold]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen: the key on top, the window each belongs to by event time, and the value.',
        'Events 0 and 1 are both key A in window 0, so they share one running total: 5 plus 3 is 8. One total for one key in one window is called an entry, written A at 0.',
        'All the entries together are called the state. It is everything the pipeline remembers between events. Without it, every event would start again from nothing.',
        'Watch the pipeline read all 9 values in order, adding each into its entry. Adding events in one at a time like this is called a fold. 9 events read, 45 added.'
      ]
    },

    /* ---------- 5 · the seven entries ---------- */
    {
      title: 'State', layout: 'array',
      eyebrow: '05 · What the state actually is',
      heading: 'Seven numbers',
      stand: 'One slot per entry, in the order each entry was first created. This is everything the pipeline is holding after event 8.',
      array: {
        labelWidth: 150, slotLabel: 'entry',
        rows: [
          { label: 'key@window', values: ENTRIES },
          { label: 'total', values: ENTRIES.map(k => VAL[k]) }
        ],
        meters: ['entries', 'sum of all entries'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [1] },
          { step: 2, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 }
        ]
      },
      cards: [
        { step: 1, title: 'b@0 = 11', html: '<p>Events 2 and 7: 7 + 4. Event 7 was seen last of all, yet it still landed in window 0, because its event time is 50 s.[[src:time]]</p>' },
        { step: 3, title: 'The thing to protect', html: '<p>Everything in this chapter — saving, stores, recovery — exists to carry these <b>7 numbers</b> safely across a crash.[[src:fold]]</p>' }
      ],
      narration: [
        'After all 9 events, the state is just these entries: key A in window 0 holds 8, key B in window 0 holds 11, and so on, down to key A in window 480, holding 8.',
        'Key B in window 0 holds 11: event 2’s 7 plus event 7’s 4. Event 7 was seen last of all, but it still landed in window 0, because of when it happened.',
        'Count them and add them up: 7 entries, holding 45 between them, the same 45 as all the values. The state is 7 numbers.',
        'Everything in this chapter, every saved copy and every recovery, exists to carry these 7 numbers safely across a crash.'
      ]
    },

    /* ---------- 6 · question: the crash ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['replay'],
      eyebrow: '06 · Your turn',
      heading: 'The machine crashes, and memory is wiped',
      stand: 'The pipeline kept its 7 entries only in memory. The machine restarts with nothing. The events themselves are still kept, in order, by the system that delivers them.',
      question: {
        step: 0,
        prompt: 'With nothing saved, how can the pipeline get its 7 entries back?',
        options: [
          { text: 'Read every event again from the very first one, and add them up again.', correct: true,
            why: 'The events are still there, and adding them up again gives exactly the same totals. It is correct; it is only slow.' },
          { text: 'It cannot: the totals are gone for good.', correct: false,
            why: 'The totals were made from the events, and the events are still kept. Anything made from them can be made again.' },
          { text: 'Read only the last event, since it is the newest.', correct: false,
            why: 'One event rebuilds one small part of one entry. The other 8 events’ values would be missing.' }
        ]
      },
      cards: [
        { step: 1, title: 'Replay', html: '<p>Reading the stream again from an earlier point and folding it again is a <b>replay</b>. A full replay is <b>correct</b>; it just takes as long as the history is.[[src:time]]</p>' },
        { step: 2, title: 'Correct but slow', html: '<p>On 9 events the cost is nothing. On a year of history it is the difference between a minute and a week.[[src:time]]</p>' }
      ],
      narration: [
        'Second question. The machine crashes and restarts with an empty memory, but the events are still kept in order. How can the pipeline get its 7 entries back? Choose an answer.',
        'Read every event again from the first, and add them up again. Reading the stream again from an earlier point is called a replay. A full replay gives exactly the right totals.',
        'So losing the state is not wrong, only slow. On 9 events that costs nothing. On a year of history, it is the difference between a minute and a week.'
      ]
    },

    /* ---------- 7 · rebuild versus resume, animated ---------- */
    {
      title: 'Resume', layout: 'array', defines: ['checkpoint'],
      eyebrow: '07 · Watch the two ways back',
      heading: 'Rebuild from scratch, or start from a saved copy',
      stand: 'Top row: every event’s value. Bottom row: whether a copy of the entries saved after event 4 already contains it.',
      array: {
        labelWidth: 170, slotLabel: 'event',
        rows: [
          { label: 'value', values: E.map(e => e.v) },
          { label: 'in the saved copy?', values: E.map((_, i) => (i <= 4 ? 'yes' : 'no')) }
        ],
        meters: ['events read: from scratch', 'events read: from the copy'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 0, do: 'sweep', row: 0, mode: 'count', readMeter: 0, speed: 220 },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'sweep', row: 1, mode: 'match', match: 'no', resultMeter: 1, speed: 260 }
        ]
      },
      cards: [
        { step: 2, title: 'Same answer, less reading', html: '<p>From scratch: 9 events read. From a copy saved after event 4: 4 read. Both end with the <b>same 7 entries</b>.[[src:time]]</p>' },
        { step: 3, title: 'Checkpoint', html: '<p>A saved copy of the state, together with where in the stream it was taken, is a <b>checkpoint</b>. It changes the cost of recovery, never the answer.[[src:time]]</p>' }
      ],
      narration: [
        'Watch the first way back: rebuild from scratch. The pipeline reads every event again, from 0 to 8. 9 events read.',
        'Now suppose a copy of the entries had been saved after event 4. The bottom row marks which events that copy already contains: events 0 to 4.',
        'Starting from the copy, only the events it does not contain need reading: events 5 to 8. 4 events read instead of 9, and both ways end with the same 7 entries.',
        'A saved copy of the state, together with where in the stream it was taken, is called a checkpoint. It is an optimisation: it changes the cost of recovery, never the answer.'
      ]
    },

    /* ---------- 8 · question: the one-way derivation ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['cache'],
      eyebrow: '08 · Your turn',
      heading: 'Can the events be rebuilt from the totals?',
      stand: 'Entry a@0 holds 8. Suppose the events themselves were thrown away, and only the 7 entries kept.',
      question: {
        step: 0,
        prompt: 'From the number 8 alone, can the pipeline say which events made it?',
        options: [
          { text: 'Yes: 8 is the total, so the events can be worked out from it.', correct: false,
            why: 'Many different events add up to 8. A total keeps the sum and throws away which parts made it.' },
          { text: 'No: 5 and 3 make 8, but so do 7 and 1, or 2 and 6.', correct: true,
            why: 'Adding up loses the parts. So events always rebuild the totals, but the totals never rebuild the events.' },
          { text: 'Only if the entry also keeps the window it belongs to.', correct: false,
            why: 'The entry already names its window, 0. That still says nothing about which values were added into it.' }
        ]
      },
      cards: [
        { step: 1, title: 'One way only', html: '<p>Stream → state always works: replay and fold again. State → stream does not. So losing the state is survivable, and losing the stream is not.[[src:time]]</p>' },
        { step: 2, title: 'The stream is the truth', html: '<p>The state is a <b>cache</b> of the stream: a copy kept only to save time. You can always rebuild it; saving it just avoids the rebuild.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. Entry A at 0 holds 8. Suppose the events were thrown away and only the totals kept. From 8 alone, can anyone say which events made it? Choose an answer.',
        'No. 5 and 3 make 8, but so do 7 and 1, or 2 and 6. So the events can always rebuild the totals, but the totals can never rebuild the events. It only works one way.',
        'That is why the stream is the truth, and the state is only a cache of it: a copy kept to save time. Losing the state is survivable. Losing the stream is not.'
      ]
    },

    /* ---------- 9 · question: when can an entry go ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['watermark'],
      eyebrow: '09 · Your turn',
      heading: 'When may the pipeline forget an entry?',
      stand: 'The pipeline keeps an estimate of how far event time has got: the latest event time seen so far, minus 60 seconds of slack for late phones.',
      question: {
        step: 0,
        prompt: 'Entry a@0 covers window 0 to 120 s. When can the pipeline safely throw it away?',
        options: [
          { text: 'Once its estimate of event time passes 120 s, the window’s end.', correct: true,
            why: 'Then no more events for that window are expected, so the total is finished and can be handed on and freed.' },
          { text: 'As soon as one event from a later window arrives.', correct: false,
            why: 'Events arrive out of order. Event 7 belonged to window 0 and arrived after events from window 240.' },
          { text: 'Never: every entry must be kept for ever.', correct: false,
            why: 'Then the state would grow without end, one entry for every key in every window that ever existed.' }
        ]
      },
      cards: [
        { step: 1, title: 'Watermark', html: '<p>The pipeline’s estimate of how far event time has got is the <b>watermark</b>: here, the latest event time seen minus 60 s. When it passes a window’s end, that window’s entry can be freed.[[src:time]]</p>' },
        { step: 2, title: 'The only bound', html: '<p>The watermark is the only thing that ever frees state. Nothing else decides that an entry is finished.[[src:time]]</p>' }
      ],
      narration: [
        'Fourth question. The pipeline estimates how far event time has got: the latest event time seen, minus 60 seconds of slack. When can entry A at 0 be thrown away? Choose an answer.',
        'Once that estimate passes 120 seconds, the window’s end. The estimate is called the watermark. When it passes a window’s end, no more events are expected there, and the entry can be freed.',
        'The watermark is the only thing that ever frees state. So the next question is: does it free every entry in our stream?'
      ]
    },

    /* ---------- 10 · the bound, animated ---------- */
    {
      title: 'Bound', layout: 'array',
      eyebrow: '10 · Watch which entries the watermark frees',
      heading: 'Six entries are freed. One never is.',
      stand: 'For each entry: where its window ends, and whether the watermark ever reaches that point. The highest the watermark ever gets here is 480 s.',
      array: {
        labelWidth: 170, slotLabel: 'entry',
        rows: [
          { label: 'key@window', values: ENTRIES },
          { label: 'window ends at', values: ENTRIES.map(END) },
          { label: 'ever freed?', values: FREED }
        ],
        meters: ['entries checked', 'never freed'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 320 },
          { step: 2, do: 'pick', slots: [6] }
        ]
      },
      cards: [
        { step: 2, title: 'a@480 is held for ever', html: '<p>Its window, [12:08, …), ends at 600 s. The last event lifts the watermark only to 480, and no event ever comes to lift it further. Its 8 is held for the life of the job.[[src:time]]</p>' },
        { step: 3, title: 'Saving makes it worse', html: '<p>Without saving, a restart cleared such an entry by accident. With a saved copy it is saved, restored and kept faithfully, for ever.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the 7 entries again, with the point where each one’s window ends. The highest the watermark ever reaches in this stream is 480 seconds.',
        'Watch each entry checked against the watermark. 6 of the 7 windows end at or before 480, so they are freed. One is never freed.',
        'It is key A in window 480. Its window ends at 600 seconds, and no later event ever lifts the watermark that far. So its 8 is held for the life of the job.',
        'And saving makes this worse. Before, a restart wiped such an entry by accident. With a checkpoint, it is saved and restored faithfully, for ever.'
      ]
    },

    /* ---------- 11 · question: persist or rebuild ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: 'Is a checkpoint always worth it?',
      stand: 'A test run reads a short, fixed list of events and finishes in seconds. A live job reads a stream with a year of history behind it.',
      question: {
        step: 0,
        prompt: 'Which of the two should save checkpoints of its state?',
        options: [
          { text: 'Both, always: saving is what makes the totals correct.', correct: false,
            why: 'A replay gives exactly the same totals. Saving changes how long recovery takes, never whether it is right.' },
          { text: 'The live job: a full replay would take longer than it can afford.', correct: true,
            why: 'Persist when rebuilding takes longer than the recovery time you can allow. On a year of history it always does.' },
          { text: 'The test run: it has fewer events, so saving is cheap.', correct: false,
            why: 'A short run can simply be replayed in seconds. Keeping a store it does not need is cost with no benefit.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Persist when…', html: '<p>…the rebuild time is more than the recovery time you can allow: history length divided by how fast it can be re-read, and it only grows.[[src:when]]</p>' },
        { step: 1, title: 'Rebuild when…', html: '<p>…the state is small and the stream is short: a test, a bounded backfill, a job whose windows last minutes.[[src:when]]</p>' },
        { step: 2, title: 'Always keep the stream', html: '<p>Whatever you do with the state. The stream rebuilds the state; the state never rebuilds the stream.[[src:when]]</p>' }
      ],
      narration: [
        'Fifth question. A test run reads a short, fixed list of events. A live job reads a stream with a year of history. Which should save checkpoints of its state? Choose an answer.',
        'The live job. Persist when rebuilding would take longer than the recovery time you can allow. Rebuild instead when the state is small and the stream is short, like a test.',
        'And whatever you do with the state, always keep the stream. The stream can rebuild the state, and the state can never rebuild the stream.'
      ]
    },

    /* ---------- 12 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '12 · What you now know',
      heading: 'Seven numbers, one way to rebuild them, one that never goes away',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when the pipeline saw it. Event 7: 50 s and 280 s.[[src:why]]'] },
          { step: 0, cells: ['<b>Window</b> and <b>entry</b>', 'A 120-second stretch of event time; one running total per key per window.[[src:time]]'] },
          { step: 1, cells: ['<b>State</b>', 'All the entries: here 7 numbers holding 45, built by a fold of 9 events.[[src:fold]]'] },
          { step: 1, cells: ['<b>Replay</b> and <b>checkpoint</b>', 'Rebuilding reads all 9 events; a saved copy after event 4 leaves 4 to read. Same 7 entries.[[src:time]]'] },
          { step: 2, cells: ['<b>Watermark</b>', 'Event time reached so far, minus 60 s. It frees 6 entries; a@480 is never freed.[[src:time]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>A snapshot that does not say <b>where in the stream</b> it was taken cannot be resumed from. Part 2 builds the checkpoint as a pair, and prices how often to take it.[[src:when]]</p>' },
      narration: [
        'To recap. Every event has two times: when it happened, its event time, and when the pipeline saw it, its processing time. Event time picks the window.',
        'The state is one entry per key per window: here 7 numbers holding 45, built by folding 9 events. Losing it costs a replay of all 9; a checkpoint after event 4 leaves only 4 to read.',
        'The watermark frees entries once their window is passed. It frees 6 of the 7, and key A in window 480 is never freed, which saving makes permanent.',
        'Next, part 2. A saved copy that does not say where in the stream it was taken cannot be resumed from. Part 2 builds the checkpoint properly and prices it.'
      ]
    }
  ]
};
