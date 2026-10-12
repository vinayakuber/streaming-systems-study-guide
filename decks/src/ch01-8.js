// Chapter 1, Part 8 — the chapter's "System Design Interview": a live clicks-per-minute
// dashboard whose clicks are delayed by the network. Built one component at a time, each
// preceded by a question; then the 12:00 minute is followed through the pipeline to the 148
// seconds in which the screen is confidently wrong; then the three options, the assembled
// design, and what it does NOT settle. The click story and both clocks are re-introduced from
// zero. Every time and count is derived from the one seed (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const WM = seed.WATERMARKS;
const PUB = WM.findIndex(w => w >= 60);                         // the arrival after which minute 0 is published
const SHOWN = E.slice(0, PUB + 1).filter(e => e.et < 60).reduce((a, e) => a + e.v, 0);
const TRUE0 = E.filter(e => e.et < 60).reduce((a, e) => a + e.v, 0);
const WRONG_FOR = E[7].pt - E[PUB].pt;
const SEEN_BEFORE_7 = Math.max(...E.slice(0, 7).map(e => e.et));
const MIN4 = E.filter(e => e.et >= 240 && e.et < 300).reduce((a, e) => a + e.v, 0);

if (PUB !== 3 || E[PUB].pt !== 132 || WM[PUB] !== 70 || SHOWN !== 8 || TRUE0 !== 12 || WRONG_FOR !== 148 || E[7].pt - E[7].et !== 230
  || SEEN_BEFORE_7 !== 260 || WM[6] !== 200 || MIN4 !== 7 || E[7].v !== 4 || E[8].et !== 540 || E[8].v !== 8)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Live Clicks Dashboard',
  eyebrow: 'Streaming · Ch 1 · Part 8',
  ...shared,
  jargon: ['click', 'event', 'event time', 'processing time', 'pipeline', 'dashboard', 'writer', 'transport', 'collector',
    'aggregator', 'bucket', 'watermark', 'publish', 'revise', 'state', 'exactly-once'],
  sources: {
    ch:     chapter(CH, 'Chapter 1 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 1 · system design interview'),
    writer: section(CH, 'writer (event producer)', 'Chapter 1 · the writer'),
    trans:  section(CH, 'transport (unbounded stream)', 'Chapter 1 · the transport'),
    coll:   section(CH, 'collector (processor)', 'Chapter 1 · the collector'),
    agg:    section(CH, 'aggregator/store (window state)', 'Chapter 1 · the aggregator and store'),
    why:    section(CH, 'Why this design is decided by one stage, and one number', 'Chapter 1 · one stage, one number'),
    when:   section(CH, 'When each of the three options is right, and the four things this does not settle', 'Chapter 1 · three options, four gaps'),
    walk:   section(CH, 'Visual walkthrough — five stages, one wrong number, three options', 'Chapter 1 · five stages, three options'),
    mem:    section(CH, 'The dashboard, traced — stack and heap at every step', 'Chapter 1 · the dashboard, traced'),
    wm:     section(CH, 'Why one of the two clocks is the meaningful one, and the other is the cheap one', 'Chapter 1 · the watermark')
  },

  slides: [
    /* ---------- 1 · the brief ---------- */
    {
      title: 'Story', layout: 'title', defines: ['click', 'event', 'event time', 'processing time', 'pipeline', 'dashboard'],
      eyebrow: '01 · Chapter 1 · Part 8 · a system design interview',
      heading: 'Design a live clicks-per-minute dashboard, when clicks arrive minutes late',
      hero: { step: 0, text: 'An operations team watches a <b>dashboard</b>: a screen of live counts, here <b>clicks</b> per minute on a website. Each report of clicks is an <b>event</b>, stamped by the user’s device with when it happened: its <b>event time</b>. A <b>pipeline</b> of programs carries it to the screen, and sees it at its <b>processing time</b> — sometimes minutes later.[[src:sd]]' },
      tiles: [
        { step: 1, value: 230, label: 'seconds one click is delayed: 12:00:50 → 12:04:40[[src:trans]]' },
        { step: 1, value: 5, label: 'stages from device to screen[[src:sd]]' },
        { step: 2, value: 148, label: 'seconds the screen shows a wrong, final-looking number[[src:why]]' },
        { step: 2, value: 3, label: 'options when the late click lands, and no fourth[[src:when]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Which clock files a click', text: 'The click at 12:00:50, seen at 12:04:40, belongs to 12:00.' },
        { step: 3, n: 2, title: 'When a minute is shown as done', text: 'Too early, and it is wrong; too late, and it is slow.' },
        { step: 4, n: 3, title: 'What to do when a click is late', text: 'Drop it, change the shown number, or wait. Each costs someone.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the component, and at the end what the design does not settle.[[src:sd]]' },
      narration: [
        'An operations team watches a dashboard: a screen of live counts, here clicks per minute. Each report of clicks is an event, stamped by the user’s device with when it happened, its event time. A pipeline of programs carries it to the screen, and sees it at its processing time.',
        'One click, from 12:00:50, is delayed 230 seconds by the network and seen at 12:04:40. There are 5 stages from the device to the screen.',
        'For 148 seconds the screen will show a wrong number that looks final. And when the late click lands, there are exactly 3 things the design can do.',
        'The design must decide three things. Which clock puts a click into a minute. And when a minute is shown as done.',
        'And what to do when a click arrives after its minute was shown. Before each component you will choose; at the end, what the design does not settle.'
      ]
    },

    /* ---------- 2 · the events ---------- */
    {
      title: 'Data', layout: 'table',
      eyebrow: '02 · The nine events the dashboard receives',
      heading: 'Two times on every event',
      stand: 'In the order the pipeline saw them. Times on a clock that starts at 12:00:00.',
      table: {
        columns: ['Event', 'User', 'Clicks', 'Happened (event time)', 'Seen (processing time)'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, `${e.v}`, (i === 7) ? `<b>${clock(e.et)}</b>` : clock(e.et), (i === 7) ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'The 12:00 minute', html: '<p>Clicks that happened in it: events 0, 1 and 7: 5 + 3 + 4 = <b>' + TRUE0 + '</b>.[[src:why]]</p><p>But event 7 is the eighth to arrive, at 12:04:40.[[src:trans]]</p>' },
      narration: [
        'Here are the nine events, in the order the pipeline saw them. Event 0: user a, 5 clicks, happened at 12:00:01, seen a second later. Event 3 is seen at 12:02:12.',
        'Events 4, 5 and 6 arrive around 12:04. Event 6 happened at 12:03:40 but was seen at 12:04:30.',
        'And event 7, in bold: 4 clicks that happened at 12:00:50, seen at 12:04:40.',
        'So the 12:00 minute really holds events 0, 1 and 7: 12 clicks. But one of them arrives almost four minutes late. Let us build the pipeline that has to cope.'
      ]
    },

    /* ---------- 3 · the writer ---------- */
    {
      title: 'Writer', layout: 'ask', defines: ['writer'],
      eyebrow: '03 · Your turn · component 1, the writer',
      heading: 'What time does the device stamp?',
      stand: 'The user clicked at 12:00:50. The phone was offline, and sent the click minutes later.',
      question: {
        step: 0,
        prompt: 'Which time should the device stamp on the click?',
        options: [
          { text: 'The moment the user clicked: 12:00:50.', correct: true,
            why: 'That is the fact the dashboard is about. Every later stage relies on it being the real interaction time.' },
          { text: 'The moment the phone sent it.', correct: false,
            why: 'The send time depends on the network, not the user. It would smuggle the delay into the event itself.' },
          { text: 'No time at all: the pipeline will stamp it.', correct: false,
            why: 'The pipeline only knows when it saw the click: 12:04:40. That is four minutes away from the truth.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The writer', html: '<p>The <b>writer</b> is the device that produces the event: <code>{key: "b", v: 4, event_time: "12:00:50"}</code>. It stamps the interaction instant, not the send instant.[[src:writer]]</p>' },
        { step: 2, title: 'Immutable', html: '<p>Once emitted, an event never changes. Everything downstream can trust its event time.[[src:writer]]</p>' }
      ],
      narration: [
        'Component one, the writer. The user clicked at 12:00:50, but the phone was offline and sent the click minutes later. Which time should the device stamp on it? Choose an answer.',
        'The moment the user clicked. The device that produces the event is called the writer. It stamps the interaction instant, not the send instant, because that is the fact the dashboard is about.',
        'And once emitted, an event never changes. Every later stage can trust its event time.'
      ]
    },

    /* ---------- 4 · the transport ---------- */
    {
      title: 'Trans', layout: 'ask', defines: ['transport', 'watermark'],
      eyebrow: '04 · Your turn · component 2, the transport',
      heading: 'Which stage creates all the difficulty?',
      stand: 'Five stages carry a click from the writer to the screen. Only one of them reorders or delays events.',
      question: {
        step: 0,
        prompt: 'Which stage turns a click from 12:00:50 into a record delivered at 12:04:40?',
        options: [
          { text: 'The transport, which carries events and delays them.', correct: true,
            why: 'It is the only stage that reorders or delays. Every other stage is written to tolerate what it does.' },
          { text: 'The writer, which stamps the wrong time.', correct: false,
            why: 'The writer stamps 12:00:50, the right time. The delay happens afterwards, on the way.' },
          { text: 'The reader, which refreshes too slowly.', correct: false,
            why: 'The reader only shows what it is given. The click is already late when it reaches the pipeline.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The transport', html: '<p>The <b>transport</b> carries the unending stream of events. Click 7 is queued and delayed <b>230</b> seconds. Processing time trails event time by whatever lag builds up.[[src:trans]]</p>' },
        { step: 2, title: 'The watermark', html: '<p>A <b>watermark</b> is a claim: nothing earlier than this is still coming. Here: highest event time seen, 12:04:20, minus 60 seconds = <b>12:03:20</b>.[[src:trans]]</p>' }
      ],
      narration: [
        'Component two. Five stages carry a click from the writer to the screen. Which one turns a click from 12:00:50 into a record delivered at 12:04:40? Choose an answer.',
        'The transport, which carries the unending stream of events and delays them. Click 7 is held up 230 seconds. It is the only stage that reorders or delays; every other stage is written to tolerate it.',
        'The transport also carries a watermark: a claim that nothing earlier is still coming. Here, the highest event time seen, 12:04:20, minus 60 seconds: 12:03:20. Click 7, from 12:00:50, proves it wrong.'
      ]
    },

    /* ---------- 5 · the collector ---------- */
    {
      title: 'Coll', layout: 'ask', defines: ['collector', 'bucket'],
      eyebrow: '05 · Your turn · component 3, the collector',
      heading: 'Click 7 is read at 12:04:40. Which minute?',
      stand: 'The collector reads each event and puts it into one per-minute box.',
      question: {
        step: 0,
        prompt: 'Into which minute should the collector put click 7’s 4 clicks?',
        options: [
          { text: '12:04, the minute it was read.', correct: false,
            why: 'That is the collector’s own clock. Asking “what time is it?” to file data is exactly the bug the chapter warns about.' },
          { text: '12:00, the minute it happened.', correct: true,
            why: 'The collector files by event time, so the click lands where it happened, however late it arrives.' },
          { text: 'Neither: it arrived too late to count.', correct: false,
            why: 'Whether to count a late click is a later decision. The collector’s job is only to file it correctly.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The collector', html: '<p>The <b>collector</b> reads each event and assigns it to a <b>bucket</b>, one per minute, by its <b>event time</b>. It never consults its own clock to do so.[[src:coll]]</p>' },
        { step: 2, title: 'And it flags stragglers', html: '<p>An event that arrives after the watermark has passed its time is flagged <b>late</b>. Click 7 is: the watermark already said 12:03:20.[[src:coll]]</p>' }
      ],
      narration: [
        'Component three, the collector. It reads each event and puts it in a per-minute box. Click 7 is read at 12:04:40. Which minute should get its 4 clicks? Choose an answer.',
        'The 12:00 minute, where it happened. Each per-minute box is called a bucket. The collector files by event time and never asks its own clock, because a stage that does that to file data is exactly the bug this chapter is about.',
        'It also flags a straggler: an event that arrives after the watermark has passed its time is marked late. Click 7 is one: the watermark already said 12:03:20.'
      ]
    },

    /* ---------- 6 · the aggregator ---------- */
    {
      title: 'Agg', layout: 'ask', defines: ['aggregator', 'publish', 'state'],
      eyebrow: '06 · Your turn · component 4, the aggregator and store',
      heading: 'When is the 12:00 minute shown as done?',
      stand: 'The aggregator keeps a running count per minute and decides when each minute is final. It has only the watermark to go on.',
      question: {
        step: 0,
        prompt: 'When should the aggregator declare the 12:00 minute done and show its count?',
        options: [
          { text: 'When the watermark passes 12:01, the end of the minute.', correct: true,
            why: 'That is the only signal it has that the minute is complete. It is a guess, but it is the design’s rule.' },
          { text: 'When its own clock passes 12:01.', correct: false,
            why: 'Events are seconds to minutes late, so the clock passing 12:01 says nothing about what is still on its way.' },
          { text: 'Never: keep every minute open forever.', correct: false,
            why: 'Then no number on the screen would ever be final, and the counts would have to be kept forever.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'The aggregator and store', html: '<p>The <b>aggregator</b> holds a count per minute, its <b>state</b>: what it must remember. The dashboard reads the live counts.[[src:agg]]</p>' },
        { step: 2, title: 'Publish', html: '<p>To <b>publish</b> a minute is to declare it done and put its count on the screen as final, when the watermark passes the minute’s end.[[src:mem]]</p>' },
        { step: 2, title: 'Right minute, right count', html: '<p>Minute 12:04 keeps <b>' + MIN4 + '</b>, from events 4 and 5. It does <b>not</b> get click 7’s 4: that belongs to 12:00.[[src:agg]]</p>' }
      ],
      narration: [
        'Component four, the aggregator and store. It keeps a running count per minute and decides when each is final, with only the watermark to go on. When should it declare the 12:00 minute done? Choose an answer.',
        'When the watermark passes 12:01, the end of the minute. The counts it keeps, what it must remember, are called its state. Declaring a minute done and putting its count on screen as final is called publishing.',
        'And the counts go to the right minutes. Minute 12:04 keeps 7, from events 4 and 5. It does not get click 7’s 4 clicks: those belong to 12:00. Now follow the 12:00 minute through.'
      ]
    },

    /* ---------- 7 · the 12:00 minute, followed ---------- */
    {
      title: 'Minute', layout: 'timeline',
      eyebrow: '07 · Watch the 12:00 minute on the pipeline’s clock',
      heading: 'Published at 12:02:12. Wrong until 12:04:40.',
      stand: 'Each point is a moment on the pipeline’s own clock, processing time.',
      timeline: [
        { step: 0, time: '12:00:04', title: 'Events 0, 1 in', text: 'Count: 5 + 3 = 8.[[src:mem]]' },
        { step: 1, time: '12:02:12', title: 'Published', text: 'Watermark 70 s ≥ 60: shows ' + SHOWN + '.[[src:why]]' },
        { step: 2, time: '12:04:40', title: 'Event 7 lands', text: 'Truth: ' + TRUE0 + ', too late.[[src:why]]' },
        { step: 3, time: '148 s', title: 'Confidently wrong', text: '8 shown, 12 true: 33% low.[[src:why]]' }
      ],
      strip: { step: 1, label: 'What ops sees for the 12:00 minute', items: [
        { n: '12:02:12', text: 'published: 8', tone: 'warn' }, { n: '12:03:00', text: 'still 8', tone: 'warn' },
        { n: '12:04:00', text: 'still 8', tone: 'warn' }, { n: '12:04:40', text: 'truth known: 12', tone: 'ok' } ] },
      narration: [
        'Follow the 12:00 minute on the pipeline’s own clock. By 12:00:04, events 0 and 1 have landed: the count is 5 plus 3, which is 8.',
        'At 12:02:12, event 3 arrives and pushes the watermark to 70 seconds, past the end of the minute at 60. So the minute is published, and ops sees 8.',
        'At 12:04:40, event 7 lands, into a minute that was already published. The true answer, 12, is only knowable now.',
        'For 148 seconds, from 12:02:12 to 12:04:40, the screen said 8 and the answer was 12: 33 percent low.'
      ]
    },

    /* ---------- 8 · question: lagging or wrong? ---------- */
    {
      title: 'Q', layout: 'ask',
      eyebrow: '08 · Your turn · what kind of failure',
      heading: 'For 148 seconds the screen says 8',
      stand: 'Every stage did its job: right time stamped, right minute filed, published on the watermark.',
      question: {
        step: 0,
        prompt: 'During those 148 seconds, what state is the pipeline in?',
        options: [
          { text: 'Running behind: it will catch up by itself.', correct: false,
            why: 'It is not behind. It has finished the minute and decided. Nothing will change the 8 unless the design says so.' },
          { text: 'Finished and confidently wrong: it has published 8.', correct: true,
            why: 'It has declared the minute done. That is the state the design must have an answer for.' },
          { text: 'Showing nothing until all clicks are in.', correct: false,
            why: 'It is showing 8, as final, because the watermark said the minute was complete.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Decided, not lagging', html: '<p>The pipeline is not lagging: it has finished, decided and published. It is confidently wrong, and nothing inside it can tell.[[src:why]]</p>' },
        { step: 2, title: 'One stage, one number', html: '<p>The transport created the difficulty; the 60-second lag decided the error. Everything before publishing was correct.[[src:why]]</p>' }
      ],
      narration: [
        'Every stage did its job: the right time stamped, the right minute filed, published on the watermark. During those 148 seconds, what state is the pipeline in? Choose an answer.',
        'Finished, and confidently wrong. It has declared the minute done and published 8. It is not lagging, and nothing inside it can tell.',
        'One stage, the transport, created the difficulty, and one number, the 60-second lag, decided the error. Everything before publishing was correct. So when click 7 lands, what should happen?'
      ]
    },

    /* ---------- 9 · the three options ---------- */
    {
      title: 'Three', layout: 'ask', defines: ['revise'],
      eyebrow: '09 · Your turn · the three options',
      heading: 'Click 7 lands in a published minute. Now what?',
      stand: 'There are exactly three things the design can do: drop the late click; change the published 8 to 12; or wait 230 seconds before publishing anything.',
      question: {
        step: 0,
        prompt: 'For a dashboard that ops staff read with their own eyes, which option is usually right?',
        options: [
          { text: 'Drop it: the screen stays at 8.', correct: false,
            why: 'Simplest to build, and permanently 33% low. Right only for a rough health signal nobody checks against anything.' },
          { text: 'Change the published 8 to 12.', correct: true,
            why: 'Correct, 148 seconds after publishing. A person can cope with a number that moves, so this usually fits a human-read screen.' },
          { text: 'Wait 230 seconds before publishing any minute.', correct: false,
            why: 'Always correct, but every minute appears 170 seconds later. That is a heavy price for a live screen.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Drop', html: '<p>Screen stays 8, permanently 33% low. Silently wrong forever.[[src:when]]</p>' },
        { step: 1, title: 'Revise', html: '<p>To <b>revise</b> is to change a published number: 8 → 12, 148 seconds later. The reader must cope with a number that moves.[[src:when]]</p>' },
        { step: 2, title: 'Wait', html: '<p>Wait 230 seconds: always right first time, and every minute is 170 seconds later than when revising.[[src:when]]</p>' }
      ],
      narration: [
        'Click 7 lands in a published minute. There are exactly three options: drop it, change the published 8 to 12, or wait 230 seconds before publishing anything. For a screen people read, which is usually right? Choose an answer.',
        'Change it: 8 becomes 12, 148 seconds after publishing. Changing a published number is called revising. A person can cope with a number that moves. Dropping leaves the screen 33 percent low forever.',
        'And waiting 230 seconds is always right first time, but every minute then appears 170 seconds later than under revising. None of the three is free.'
      ]
    },

    /* ---------- 10 · the same options, another reader ---------- */
    {
      title: 'Bill', layout: 'ask',
      eyebrow: '10 · Your turn · the same options, another reader',
      heading: 'Now a billing system reads the counts',
      stand: 'Instead of a person, a program charges advertisers from each published minute. Once it has billed on a number, it cannot take the bill back.',
      question: {
        step: 0,
        prompt: 'Which option fits now?',
        options: [
          { text: 'Revise: change 8 to 12 after billing.', correct: false,
            why: 'The bill on 8 has already gone out. A moving number is exactly what this reader cannot cope with.' },
          { text: 'Wait 230 seconds, so the first number is right.', correct: true,
            why: 'When correctness on first publish is a hard requirement — a bill, a regulated count — the wait is the price.' },
          { text: 'Drop the late click and bill on 8.', correct: false,
            why: 'Every late click becomes a charge that is never made. Silently wrong, forever.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The reader decides', html: '<p>Revising is usually right for a person and usually <b>wrong</b> if something has already billed or alerted on the 8.[[src:when]]</p>' },
        { step: 2, title: '“Handle late data” is not an answer', html: '<p>The three options trade accuracy, latency and trouble for whoever reads the number. An answer that names none of them has not chosen.[[src:when]]</p>' }
      ],
      narration: [
        'Now, instead of a person, a billing program charges advertisers from each published minute, and cannot take a bill back. Which option fits now? Choose an answer.',
        'Wait 230 seconds, so the first number is right. When correctness on first publish is a hard requirement, like a bill or a regulated count, the wait is the price. Revising is wrong once something has billed on the 8.',
        'So saying handle late data is not an answer. The three options trade accuracy, delay, and trouble for whoever reads the number, and a design must pick one.'
      ]
    },

    /* ---------- 11 · the design, assembled ---------- */
    {
      title: 'Design', layout: 'graph',
      eyebrow: '11 · The design, assembled',
      heading: 'Writer, transport, collector, aggregator, reader',
      stand: 'Each box is one answer you chose. The transport is where skew enters; every other box is written to tolerate it.',
      graph: {
        viewBox: '0 0 1520 300', legend: false,
        nodes: [
          { id: 'writer', x: 20, y: 90, w: 250, h: 104, title: 'Writer', sub: 'stamps event time', kind: 'main', step: 0, src: 'writer', values: ['click at 12:00:50'] },
          { id: 'trans', x: 330, y: 90, w: 260, h: 104, title: 'Transport', sub: 'delays and reorders', kind: 'change', step: 1, src: 'trans', values: [null, 'seen at 12:04:40'] },
          { id: 'coll', x: 650, y: 90, w: 250, h: 104, title: 'Collector', sub: 'buckets by event time', kind: 'main', step: 2, src: 'coll', values: [null, null, 'into 12:00'] },
          { id: 'agg', x: 960, y: 90, w: 270, h: 104, title: 'Aggregator / store', sub: 'per-minute state', kind: 'new', step: 3, src: 'agg', values: [null, null, null, '12:00: 8 → 12'] },
          { id: 'dash', x: 1290, y: 90, w: 210, h: 104, title: 'Reader', sub: 'the dashboard', kind: 'ext', step: 3, values: [null, null, null, 'revised'] }
        ],
        edges: [
          { from: 'writer', to: 'trans', kind: 'main', step: 1 },
          { from: 'trans', to: 'coll', kind: 'change', step: 2 },
          { from: 'coll', to: 'agg', kind: 'main', step: 3 },
          { from: 'agg', to: 'dash', kind: 'new', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Bucket on event time.</b> The collector never asks its own clock.[[src:why]]' },
        { step: 4, html: '<b>Publish on the watermark.</b> A guess: 60 seconds here.[[src:mem]]' },
        { step: 4, html: '<b>Pick a late-data option.</b> Drop, revise, or wait 230 s.[[src:when]]' }
      ],
      narration: [
        'Here is the whole design. First the writer, which stamps each click with the moment it happened: 12:00:50.',
        'Then the transport, the one stage that delays and reorders. The click is seen at 12:04:40, 230 seconds later.',
        'The collector files it by event time, into the 12:00 bucket, never by its own clock.',
        'The aggregator and store keep each minute’s count, publish on the watermark, and revise 8 to 12 when click 7 lands. The dashboard reads the revised count.',
        'Three rules hold it together: bucket on event time; publish on the watermark, which is a guess; and pick one of the three late-data options on purpose.'
      ]
    },

    /* ---------- 12 · what it does not settle ---------- */
    {
      title: 'Not', layout: 'ask', defines: ['exactly-once'],
      eyebrow: '12 · Your turn · what this design does not settle',
      heading: 'The transport delivers click 7 twice',
      stand: 'Networks sometimes resend. Suppose click 7, 4 clicks at 12:00:50, arrives a second time, identical.',
      question: {
        step: 0,
        prompt: 'What does the 12:00 minute read, and can this design tell anything is wrong?',
        options: [
          { text: '12, and the duplicate is ignored automatically.', correct: false,
            why: 'Nothing in this design recognises a copy. Each delivery is treated as new clicks.' },
          { text: '16, and it cannot tell a copy from a real click.', correct: true,
            why: 'The 4 is added twice. Without a way to spot repeats, a resend looks exactly like 4 more clicks.' },
          { text: '8, because the copy is dropped as late.', correct: false,
            why: 'A late copy goes through the same late-data option as the original. Under revising, it is added.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Four gaps, each a later chapter', html: '<ul class="l"><li>The 60-second lag is a guess, wrong here by 170 seconds, and nothing inside can detect it.</li><li>The 12:09 minute still holds 8 and never closes: endless state.[[src:when]]</li></ul>' },
        { step: 2, title: '…and two more', html: '<ul class="l"><li>Nothing here is <b>exactly-once</b>: each event counted once even if delivered twice. A resent click 7 makes 16.</li><li>It is sized for 9 events, not a million per second.[[src:when]]</li></ul>' }
      ],
      narration: [
        'Networks sometimes resend. Suppose click 7 arrives a second time, identical. What does the 12:00 minute read, and can the design tell? Choose an answer.',
        'Sixteen, and it cannot tell a copy from a real click. That is the third of four gaps. The first: the 60-second lag is a guess, wrong here by 170 seconds. The second: the 12:09 minute holds 8 and never closes, so state grows without end.',
        'Third, nothing here is exactly-once, meaning each event counted once even if it is delivered twice. And fourth, it is sized for 9 events, not a million per second. Each gap gets its own later chapter.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Check', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'One rule to remember',
      stand: 'Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Which stage must never ask its own clock in order to decide where a click belongs?',
        options: [
          { text: 'The writer.', correct: false,
            why: 'The writer’s clock is the event time: the device stamps the moment of the click. That is its job.' },
          { text: 'The transport.', correct: false,
            why: 'The transport only carries events. It does not decide where a click belongs.' },
          { text: 'The collector.', correct: true,
            why: 'It files by event time. Asking “what time is it now?” to file data is the exact bug this chapter is about.' }
        ]
      },
      cards: [
        { step: 1, title: 'The rule', html: '<p>The collector buckets on the event’s own time and never consults its own clock. A stage that does is a processing-time dashboard pretending to be an event-time one.[[src:why]]</p>' }
      ],
      narration: [
        'One last check. Which stage must never ask its own clock in order to decide where a click belongs? Choose an answer.',
        'The collector. It files by the event’s own time. A stage that asks what time it is now in order to file data is exactly the bug this chapter is about.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · The design, in five sentences',
      heading: 'Stamp, carry, bucket, publish, choose',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Writer</b>', 'Stamps the click at 12:00:50, the moment it happened.', 'Which time to stamp?[[src:writer]]'] },
          { step: 0, cells: ['<b>Transport</b>', 'Delays it 230 seconds; carries the watermark, 12:03:20.', 'Where does skew enter?[[src:trans]]'] },
          { step: 1, cells: ['<b>Collector</b>', 'Files it in the 12:00 bucket; flags it late.', 'Which minute?[[src:coll]]'] },
          { step: 1, cells: ['<b>Aggregator / store</b>', 'Publishes 8 at 12:02:12; revises to 12 at 12:04:40.', 'When is a minute done?[[src:agg]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'The lag is a guess; state never ends; duplicates count; scale.', 'What is left for later chapters?[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>The transport makes clicks late; everything else is designed so that late is a case with a chosen answer, not a silent 33% error.[[src:why]]</p>' },
      narration: [
        'To recap. The writer stamps each click with when it happened. The transport delays it, here 230 seconds, and carries the watermark.',
        'The collector files it by event time, into the 12:00 bucket, and flags it as late. The aggregator published 8 at 12:02:12, and revises to 12 at 12:04:40.',
        'What is not settled: the lag is a guess, the state never ends, duplicates are counted, and nothing is sized for real traffic. Later chapters take each one.',
        'In one line: the transport makes clicks late, and everything else is designed so that late is a case with a chosen answer, not a silent 33 percent error.'
      ]
    }
  ]
};
