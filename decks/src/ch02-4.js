// Chapter 2, Part 4 — the chapter's "System Design Interview": a purchase-summing pipeline
// that answers what, where, when and how for one result, built one component at a time
// (writer, transport, collector, aggregator/store, reader). Each component is preceded by a
// question; the design is run on the seed's own window, assembled, and closed with what it
// does NOT settle. The phones, the two clocks and every word are re-introduced, so the deck
// stands alone. Every value comes from the one seed (tools/stream_seed.js) and is asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch02';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const wm = s => (s < 0 ? 'before 12:00' : clock(s));
const seenAt = e => (e.id === 5 ? '12:04, after id 4' : clock(e.pt));
const W0 = seed.WINDOWS[0];
const END = seed.WIN;
const WM = seed.WATERMARKS;
const sumSeenBy = t => E.filter(e => W0.includes(e.id) && e.pt <= t).reduce((a, e) => a + e.v, 0);
const ONI = WM.findIndex(w => w >= END);
const LI = E.findIndex(e => e.id === 7);
const TICKS = [60, 120, 180, 240].filter(t => t < E[ONI].pt);
const FIRES = [...TICKS.map(t => ({ t, kind: 'early', v: sumSeenBy(t) })),
  { t: E[ONI].pt, kind: 'on time', v: sumSeenBy(E[ONI].pt) }, { t: E[LI].pt, kind: 'late', v: seed.SUM(W0) }];
const PUBLISHED = FIRES.flatMap((f, i) => (i === 0 ? [f.v] : [-FIRES[i - 1].v, f.v]));
const RET_SUM = PUBLISHED.reduce((a, b) => a + b, 0);
const ACC_SUM = FIRES.reduce((a, f) => a + f.v, 0);
const NEED = WM[LI] - END + 1;
const LAST = seed.WIN_STARTS[seed.WIN_STARTS.length - 1];

if (FIRES.map(f => f.v).join() !== '8,15,15,15,15,19' || PUBLISHED.length !== 11 || RET_SUM !== 19 || ACC_SUM !== 87
  || PUBLISHED.join() !== '8,-8,15,-15,15,-15,15,-15,15,-15,19' || FIRES[5].t - FIRES[0].t !== 220 || NEED !== 81
  || WM[3] !== 70 || WM[4] !== 185 || WM[LI] !== 200 || E[LI].pt - E[LI].et !== 230 || seed.LAG !== 60
  || LAST !== 480 || Math.max(...WM) >= LAST + END || E[8].pt !== 542 || seed.SUM(seed.WINDOWS[LAST]) !== 8)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Purchase Summer Design',
  eyebrow: 'Streaming · Ch 2 · Part 4',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'dashboard', 'event time', 'processing time', 'writer', 'transport',
    'watermark', 'collector', 'state', 'aggregator', 'trigger', 'pane', 'sink', 'retraction', 'accumulation mode', 'allowed lateness'],
  sources: {
    ch:     chapter(CH, 'Chapter 2 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 2 · system design interview'),
    writer: section(CH, 'writer (event source)', 'Chapter 2 · the writer'),
    trans:  section(CH, 'transport (stream)', 'Chapter 2 · the transport'),
    coll:   section(CH, 'collector (window assigner)', 'Chapter 2 · the collector'),
    agg:    section(CH, 'aggregator/store (per-window state)', 'Chapter 2 · the aggregator and store'),
    sdwhy:  section(CH, 'Why one result needs all four answers before it is defined', 'Chapter 2 · why all four answers'),
    sdwhen: section(CH, 'When this design is right, the two thresholds, and four gaps', 'Chapter 2 · thresholds and gaps'),
    sdwalk: section(CH, 'Visual walkthrough — four stages, 11 published values, two thresholds', 'Chapter 2 · the walkthrough'),
    sdprog: section(CH, 'The purchase summer — stack and heap at every step', 'Chapter 2 · the purchase summer as a program'),
    when:   section(CH, 'Why "when" is a processing-time decision about an event-time question', 'Chapter 2 · when'),
    how:    section(CH, 'Why a correct pipeline plus a correct sink can still be wrong', 'Chapter 2 · how')
  },

  slides: [
    /* ---------- 1 · the brief ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window', 'dashboard'],
      eyebrow: '01 · Chapter 2 · Part 4 · a system design interview',
      heading: 'Sum purchases per window, even when one arrives late',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a message with its value: an <b>event</b>. Events never stop: a <b>stream</b>. The interviewer asks for a <b>pipeline</b>, a program that adds the values up per 2-minute slice of time, called a <b>window</b>, for a <b>dashboard</b>: a screen of live figures.[[src:sd]]' },
      tiles: [
        { step: 1, value: seed.SUM(W0), label: 'the true total of window 12:00 to 12:02[[src:sdwhy]]' },
        { step: 1, value: 230, suffix: ' s', label: 'how late one of its purchases arrives[[src:sdwhy]]' },
        { step: 2, value: PUBLISHED.length, label: 'values the dashboard receives for that one window[[src:sdwhy]]' },
        { step: 2, value: NEED, suffix: ' s', label: 'the setting that decides whether it ends right[[src:sdwhen]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Where each purchase belongs', text: 'By when it happened, or when it arrived?' },
        { step: 3, n: 2, title: 'When a total may go out', text: 'And how long to keep waiting for stragglers.' },
        { step: 4, n: 3, title: 'How a correction reaches the screen', text: 'Without counting anything twice.' }
      ],
      note: { step: 4, text: 'Before each component you choose. Then the component is shown, run on real numbers, and at the end, what the design does not settle.[[src:sd]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a message with its value, called an event; the events never stop, a stream. The interviewer asks for a pipeline: a program that adds the values up.',
        'It adds per 2-minute slice of time, called a window, for a dashboard, a screen of live figures. The window 12:00 to 12:02 truly totals 19, but one of its purchases arrives 230 seconds late.',
        'By the end, the dashboard will have received 11 values for that one window, and whether the last is right will depend on a single setting: 81 seconds.',
        'The design must decide where each purchase belongs: by when it happened, or when it arrived. And when a total may go out, and how long to keep waiting.',
        'And how a correction reaches the screen without anything counted twice. Before each component, you choose.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Clocks', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine purchases, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The purchases in the order the pipeline received them. The bold ones happened between 12:00 and 12:02.',
      table: {
        columns: ['Purchase', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: W0.includes(e.id) ? [`<b>id ${e.id}</b>`, e.key, `<b>${clock(e.et)}</b>`, `<b>${seenAt(e)}</b>`, `<b>${e.v}</b>`]
            : [`id ${e.id}`, e.key, clock(e.et), seenAt(e), `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li>Id 7: happened 12:00:50, seen 12:04:40.[[src:writer]]</li></ul>' },
      narration: [
        'Each purchase carries two times. When it happened is its event time; when the pipeline saw it is its processing time. Ids 0, 1 and 2 happened in the first window and were seen within seconds.',
        'Most others were seen within seconds too. Id 4 happened at 12:04:05 and was seen at 12:04:06. Id 6 was seen after id 5, though it happened earlier.',
        'But id 7 happened at 12:00:50, inside the first window, and was not seen until 12:04:40. Its phone was offline for 230 seconds.',
        'Every component in this design will have to say which of the two clocks it uses. Getting that wrong is how id 7 ends up in the wrong place.'
      ]
    },

    /* ---------- 3 · component 1: the writer ---------- */
    {
      title: 'Write', layout: 'ask', defines: ['writer'],
      eyebrow: '03 · Your turn · component 1, the writer',
      heading: 'Who should stamp the time a purchase happened?',
      stand: 'Id 7 happened at 12:00:50 on phone b, while it was offline. The pipeline first hears of it at 12:04:40.',
      question: {
        step: 0,
        prompt: 'Where should a purchase’s event time be stamped?',
        options: [
          { text: 'On the phone, at the moment of the purchase.', correct: true,
            why: 'Only the phone knows when it happened. Stamped there, id 7 carries 12:00:50 however long it travels.' },
          { text: 'In the pipeline, at the moment it arrives.', correct: false,
            why: 'Then id 7 is stamped 12:04:40, and its purchase lands in the wrong window for good.' },
          { text: 'In the dashboard, when it is shown.', correct: false,
            why: 'That is later still. The time a purchase is displayed says nothing about when it happened.' }
        ]
      },
      cards: [
        { step: 1, title: 'The writer', html: '<p>The component that creates events, here the app on each phone, is the <b>writer</b>, or event source. It stamps event time; the pipeline never does.[[src:writer]]</p>' },
        { step: 2, title: 'Never changed', html: '<p>Once produced, an event is never changed. Id 7 is emitted as phone b, value 4, 12:00:50, and reaches the pipeline at 12:04:40.[[src:writer]]</p>' }
      ],
      narration: [
        'Component one. Id 7 happened at 12:00:50 on phone b, while it was offline; the pipeline first hears of it at 12:04:40. Where should its event time be stamped? Choose an answer.',
        'On the phone, at the moment of purchase. The component that creates events is called the writer, or event source. It stamps event time, and the pipeline never does.',
        'And once produced, an event is never changed. Id 7 is phone b, value 4, 12:00:50, and it reaches the pipeline at 12:04:40.'
      ]
    },

    /* ---------- 4 · component 2: the transport ---------- */
    {
      title: 'Carry', layout: 'ask', defines: ['transport', 'watermark'],
      eyebrow: '04 · Your turn · component 2, the transport',
      heading: 'The stream carries events. What else should it work out?',
      stand: 'The part that carries events from the phones to the pipeline sees every event go by. Later parts must judge when a window is complete.',
      question: {
        step: 0,
        prompt: 'What single running figure would help later parts judge which event times are complete?',
        options: [
          { text: 'The latest event time seen so far, minus a margin of 60 s.', correct: true,
            why: 'Events are mostly close to the newest one, so a margin behind the newest is a sensible guess that needs no future.' },
          { text: 'The number of events carried so far.', correct: false,
            why: 'A count says nothing about which times are covered. 9 events could all be from one minute.' },
          { text: 'The wall clock, minus a margin of 60 s.', correct: false,
            why: 'The wall clock knows nothing about the events. A phone offline for an hour breaks it completely.' }
        ]
      },
      cards: [
        { step: 1, title: 'The transport and its watermark', html: '<p>The part that carries the events is the <b>transport</b>. It also tracks the <b>watermark</b>: “no event earlier than this will still arrive”, here the latest seen minus <b>60 s</b>.[[src:trans]]</p>' },
        { step: 2, title: 'Behind the wall clock', html: '<p>Network delay and the margin keep the watermark behind the wall clock. It is an estimate, and it can be proved wrong.[[src:trans]]</p>' }
      ],
      narration: [
        'Component two. The part that carries events from the phones sees every one go by. What single running figure would help later parts judge which event times are complete? Choose an answer.',
        'The latest event time seen, minus a margin of 60 seconds. The carrying part is called the transport, and that figure is the watermark: a claim that no earlier event will still arrive.',
        'It always lags the wall clock, and it is only an estimate. Watch it being tracked, and then watch id 7 prove it wrong.'
      ]
    },

    /* ---------- 5 · the watermark, animated ---------- */
    {
      title: 'Mark', layout: 'array',
      eyebrow: '05 · Watch the transport track its watermark',
      heading: 'One jump past 12:02, then a purchase from 12:00:50',
      stand: 'Slots are the purchases in the order they were seen.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => clock(e.et)) },
          { label: 'seen at', values: E.map(seenAt) },
          { label: 'watermark', values: WM.map(wm) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [ONI] },
          { step: 3, do: 'pick', slots: [LI] }
        ]
      },
      cards: [
        { step: 2, title: 'After id 4', html: '<p>The watermark jumps from 12:01:10 to <b>12:03:05</b>: the pipeline now claims nothing before 12:03:05 is still coming.[[src:trans]]</p>' },
        { step: 3, title: 'Proved wrong', html: '<p>Id 7, from 12:00:50, arrives while the watermark is 12:03:20. The claim was false.[[src:trans]]</p>' }
      ],
      narration: [
        'Here are the purchases in the order they were seen, with when each happened and when it was seen.',
        'The third row is the transport’s watermark after each one: the latest event time so far, minus 60 seconds.',
        'Look at id 4, seen at 12:04:06. It lifts the watermark from 12:01:10 to 12:03:05 in one jump. The pipeline now claims that nothing from before 12:03:05 is still coming.',
        'Then id 7 arrives, from 12:00:50, while the watermark is 12:03:20. The claim was false. The rest of the design must cope with exactly this.'
      ]
    },

    /* ---------- 6 · component 3: the collector ---------- */
    {
      title: 'Place', layout: 'ask', defines: ['collector'],
      eyebrow: '06 · Your turn · component 3, the collector',
      heading: 'Which window does id 7 go into?',
      stand: 'Windows are 2 minutes wide: 12:00 to 12:02, 12:02 to 12:04, 12:04 to 12:06… Id 7 happened at 12:00:50 and arrived at 12:04:40.',
      question: {
        step: 0,
        prompt: 'Which window should id 7’s value be added to?',
        options: [
          { text: '12:00 to 12:02, by when it happened.', correct: true,
            why: 'The window is a slice of event time. Id 7’s purchase happened at 12:00:50, so it belongs there.' },
          { text: '12:04 to 12:06, by when it arrived.', correct: false,
            why: 'Then two windows are wrong: 12:00 is 4 short, and 12:04 counts a purchase that happened earlier.' },
          { text: 'Neither: it is too late, so it is dropped.', correct: false,
            why: 'Whether it is still accepted is a separate setting, decided further on. Placing it comes first.' }
        ]
      },
      cards: [
        { step: 1, title: 'The collector', html: '<p>The component that assigns each event to its window is the <b>collector</b>, or window assigner. Its one rule reads event time, never arrival time.[[src:coll]]</p>' },
        { step: 2, title: 'Where lives here', html: '<p>The collector is the whole answer to <b>where</b>: fixed 2-minute windows by event time. Id 3, from 12:02:10, adds nothing to the first window.[[src:sdprog]]</p>' }
      ],
      narration: [
        'Component three. Windows are 2 minutes wide. Id 7 happened at 12:00:50 and arrived at 12:04:40. Which window should its value be added to? Choose an answer.',
        'The window 12:00 to 12:02, by when it happened. The component that assigns events to windows is called the collector, or window assigner. Its rule reads event time, never arrival time.',
        'The collector is the whole answer to the question where. Everything else, what, when and how, lives in the next component.'
      ]
    },

    /* ---------- 7 · component 4: the aggregator ---------- */
    {
      title: 'Keep', layout: 'ask', defines: ['state', 'aggregator'],
      eyebrow: '07 · Your turn · component 4, the aggregator and store',
      heading: 'A total that may be announced more than once',
      stand: 'The window’s total will be announced early, then again when the watermark passes 12:02, then again when id 7 lands.',
      question: {
        step: 0,
        prompt: 'What must be kept for each open window, between one event and the next?',
        options: [
          { text: 'Its running sum, and the last value it announced.', correct: true,
            why: 'The sum is the answer so far. The last value is needed to correct what readers were already told.' },
          { text: 'Nothing: add up the window’s events again each time.', correct: false,
            why: 'That means re-reading the stream on every announcement, and the stream never ends.' },
          { text: 'Only the newest event of the window.', correct: false,
            why: 'One event cannot give a total. Id 7 alone is 4, not 19.' }
        ]
      },
      cards: [
        { step: 1, title: 'State', html: '<p>What is kept per window between events is its <b>state</b>. Window 12:00 to 12:02: 0 → 15 as ids 0, 1 and 2 fold in.[[src:agg]]</p>' },
        { step: 2, title: 'The aggregator', html: '<p>The component that holds that state and announces from it is the <b>aggregator</b>, or store. <b>What</b>, <b>when</b> and <b>how</b> all live here.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Component four. The window’s total will be announced more than once. What must be kept for each open window between one event and the next? Choose an answer.',
        'Its running sum, and the last value it announced. What is kept per window between events is called its state. For our window it goes from 0 to 15 as ids 0, 1 and 2 arrive.',
        'The component that holds that state is called the aggregator, or store. What, when and how all live here, which is why where is the state is the first useful question about any streaming design.'
      ]
    },

    /* ---------- 8 · when it announces ---------- */
    {
      title: 'Fire', layout: 'timeline', defines: ['trigger', 'pane'],
      eyebrow: '08 · Watch the aggregator announce the window',
      heading: 'Every minute until the watermark passes, then on time, then late',
      stand: 'Wall-clock moments, left to right. Each is one announcement for the window 12:00 to 12:02.',
      timeline: FIRES.map((f, i) => ({ step: i < 2 ? 0 : i < 4 ? 1 : i === 4 ? 2 : 3, time: clock(f.t),
        title: `${f.kind}: ${f.v}`, text: f.kind === 'early' ? 'Every 60 s.' : f.kind === 'on time' ? 'Watermark passes 12:02.[[src:agg]]' : 'Id 7 lands.[[src:sdwhy]]' })),
      narration: [
        'The rule that says announce now is called a trigger, and each announced value is called a pane. Here, an early trigger fires every 60 seconds: 8 at 12:01:00, then 15 at 12:02:00.',
        'Then 15 at 12:03:00 and 15 at 12:04:00. All four early panes are only what has arrived so far.',
        'At 12:04:06 the watermark passes 12:02, and the on-time trigger announces 15, claiming the window is complete.',
        'At 12:04:40 id 7 lands, and the late trigger announces 19. Six panes over 220 seconds, and every one was the right answer to: what do you know now?'
      ]
    },

    /* ---------- 9 · question: how the screen stays right ---------- */
    {
      title: 'Undo', layout: 'ask', defines: ['sink', 'retraction', 'accumulation mode'],
      eyebrow: '09 · Your turn · how a correction reaches the screen',
      heading: 'The dashboard’s store can only add',
      stand: 'Each pane is the window’s total so far: 8, 15, 15, 15, 15, 19. The dashboard’s store adds every value it receives.',
      question: {
        step: 0,
        prompt: 'What must the aggregator send before each new total, so the store ends on 19?',
        options: [
          { text: 'Minus the previous total, to undo it.', correct: true,
            why: 'Each undo takes the store back to 0 before the new total lands, so it always holds exactly the latest total.' },
          { text: 'Nothing: the store keeps the largest value.', correct: false,
            why: 'This store adds. Without undos it piles every total on top of the last.' },
          { text: 'Only the difference from the previous total.', correct: false,
            why: 'That works for an adding store, but readers who see a pane alone would read 4 as the window’s total.' }
        ]
      },
      cards: [
        { step: 1, title: 'Sink and retraction', html: '<p>Whatever receives panes and stores them is the <b>sink</b>. A pane that undoes an earlier one, such as <b>−8</b> or <b>−15</b>, is a <b>retraction</b>.[[src:how]]</p>' },
        { step: 2, title: 'The accumulation mode', html: '<p>What a later pane means relative to an earlier one is the <b>accumulation mode</b>: here, accumulating and retracting. It answers <b>how</b>.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Each pane is the window’s total so far, and the dashboard’s store adds every value it receives. What must the aggregator send before each new total, so the store ends on 19? Choose an answer.',
        'Minus the previous total. Whatever receives and stores panes is called the sink, and a pane that undoes an earlier one is called a retraction: minus 8, or minus 15.',
        'What a later pane means relative to an earlier one is called the accumulation mode. This one is accumulating and retracting, and it answers how. Watch the sink receive it.'
      ]
    },

    /* ---------- 10 · the 11 published values ---------- */
    {
      title: 'Feed', layout: 'array',
      eyebrow: '10 · Watch the dashboard’s sink receive every value',
      heading: '11 values for one window, and the sink lands on 19',
      stand: 'Every value the sink receives, in order. Each correction is a retraction followed by the new total.',
      array: {
        labelWidth: 150, slotLabel: 'value',
        rows: [ { label: 'received', values: PUBLISHED } ],
        meters: ['values received', 'sink holds'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'pick', slots: [9, 10] }
        ]
      },
      cards: [
        { step: 1, title: '8, −8, 15, −15 … 19', html: '<p>11 values across 220 s, summing to <b>19</b>. 5 corrections, 5 undos, and the sink only ever adds.[[src:sdwalk]]</p>' },
        { step: 2, title: 'The last two', html: '<p>Minus 15, then 19: the late pane that id 7 made possible.[[src:sdprog]]</p>' }
      ],
      narration: [
        'Here is every value the dashboard’s sink receives for the window: 8, then minus 8 and 15, and so on, ending with minus 15 and 19.',
        'Watch the sink add them one by one. It climbs to 8, falls to 0, climbs to 15, and so on. After 11 values it holds 19.',
        'The last two are the late correction: minus 15, then 19. A dashboard that treated the first value as final would be the bug, not the pipeline.'
      ]
    },

    /* ---------- 11 · threshold 1: allowed lateness ---------- */
    {
      title: 'Wait', layout: 'ask', defines: ['allowed lateness'],
      eyebrow: '11 · Your turn · the first threshold',
      heading: 'How long should the window’s state be kept?',
      stand: 'After the watermark passes 12:02, the aggregator keeps the window’s state for a set time, then frees the memory. When id 7 lands, the watermark is 12:03:20.',
      question: {
        step: 0,
        prompt: 'What is the least time past 12:02 that keeps the state alive for id 7?',
        options: [
          { text: '81 s: the watermark is 80 s past 12:02 when id 7 lands.', correct: true,
            why: 'The state survives while the watermark is below 12:02 plus the setting: 12:03:20 is below 12:03:21.' },
          { text: '230 s: id 7 was 230 s late.', correct: false,
            why: 'That is how late id 7 was, but the setting is measured against the watermark, not against the event.' },
          { text: '60 s: the margin the watermark already uses.', correct: false,
            why: 'With 60 s, the state is gone once the watermark reaches 12:03:00, before id 7 arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'Allowed lateness', html: '<p>How long state is kept after the watermark passes the window’s end is the <b>allowed lateness</b>. At least <b>81 s</b> here; at 80 s, id 7 is dropped and 15 stands forever, 21% low.[[src:sdwhen]]</p>' },
        { step: 2, title: 'From the watermark, not the skew', html: '<p>The threshold comes from where the watermark stood, 200 s past 12:00, not from id 7’s 230 s delay.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'The first threshold. After the watermark passes 12:02, the window’s state is kept for a set time, then freed. When id 7 lands the watermark is 12:03:20. What is the least time that keeps the state alive? Choose an answer.',
        '81 seconds. That setting is called the allowed lateness. At 80, the state is gone when id 7 lands: it is dropped, and 15 stands forever, 21 percent low.',
        'Note that the threshold comes from where the watermark stood, not from id 7’s 230 seconds of delay, which is the number most people would guess.'
      ]
    },

    /* ---------- 12 · threshold 2: the mode must match ---------- */
    {
      title: 'Match', layout: 'ask',
      eyebrow: '12 · Your turn · the second threshold',
      heading: 'Same panes, but no undos',
      stand: 'Allowed lateness is 81 s, so id 7 lands. But the aggregator sends only the totals: 8, 15, 15, 15, 15, 19. The sink still adds.',
      question: {
        step: 0,
        prompt: 'What does the dashboard’s sink end up holding?',
        options: [
          { text: '87: every total is piled on top of the last.', correct: true,
            why: 'Each of the 6 panes is a running total, and the sink adds all of them: 8, 15, 15, 15, 15 and 19.' },
          { text: '19: the lateness setting was right.', correct: false,
            why: 'The lateness setting decides whether id 7 lands, not how panes combine. The two are independent.' },
          { text: '34: the last two panes, added.', correct: false,
            why: 'That would be true with only two panes. Here all six are added.' }
        ]
      },
      narration: [
        'The second threshold. The allowed lateness is right, so id 7 lands. But now the aggregator sends only totals, with no undos, and the sink still adds. What does it end up holding? Choose an answer.',
        '87. Each of the 6 panes is a running total, and the sink adds all of them. The two settings are independent: correct lateness with a mismatched mode still gives 87. Watch it.'
      ]
    },

    /* ---------- 13 · the mismatch, animated ---------- */
    {
      title: 'Pile', layout: 'array',
      eyebrow: '13 · Watch the sink add totals without undos',
      heading: 'Six running totals, added: 87',
      stand: 'The same six panes, sent as plain totals, into the same adding sink.',
      array: {
        labelWidth: 150, slotLabel: 'pane',
        rows: [ { label: 'received', values: FIRES.map(f => f.v) } ],
        meters: ['panes received', 'sink holds'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 600 }
        ]
      },
      cards: [
        { step: 1, title: '87, not 19', html: '<p>8 + 15 + 15 + 15 + 15 + 19 = <b>87</b>. Every component did its job; the agreement between them was missing.[[src:sdwhen]]</p>' },
        { step: 2, title: 'Two settings, two numbers', html: '<p>Allowed lateness ≥ 81 s, and a mode that matches the sink. Each has a threshold that is a number, not a judgement call.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Here are the same six panes, sent as plain totals: 8, 15, 15, 15, 15 and 19, into the same adding sink.',
        'Watch the sink add them, each running total piled on top of the last, until it holds 87. Every component did its job, and the result is wrong.',
        'So two settings decide whether this design is ever correct: an allowed lateness of at least 81 seconds, and an accumulation mode that matches the sink.'
      ]
    },

    /* ---------- 14 · the design, assembled ---------- */
    {
      title: 'Design', layout: 'graph',
      eyebrow: '14 · The design, assembled',
      heading: 'Writer, transport, collector, aggregator, reader',
      stand: 'Each box is one answer you chose. Where lives in the collector; what, when and how all live in the aggregator’s state.',
      graph: {
        viewBox: '0 0 1520 300', legend: true,
        nodes: [
          { id: 'writer', x: 20, y: 90, w: 250, h: 110, title: 'Writer', sub: 'phone app', kind: 'main', step: 0, src: 'writer', values: ['stamps event time'] },
          { id: 'trans', x: 320, y: 90, w: 260, h: 110, title: 'Transport', sub: 'stream + watermark', kind: 'main', step: 1, src: 'trans', values: [null, 'latest seen − 60 s'] },
          { id: 'coll', x: 630, y: 90, w: 260, h: 110, title: 'Collector', sub: 'window assigner', kind: 'main', step: 2, src: 'coll', values: [null, null, 'where: by event time'] },
          { id: 'agg', x: 940, y: 90, w: 300, h: 110, title: 'Aggregator / store', sub: 'per-window state', kind: 'change', step: 3, src: 'agg', values: [null, null, null, 'what, when, how'] },
          { id: 'reader', x: 1290, y: 90, w: 210, h: 110, title: 'Reader', sub: 'the dashboard', kind: 'ext', step: 4, values: [null, null, null, null, 'ends on 19'] }
        ],
        edges: [
          { from: 'writer', to: 'trans', kind: 'main', step: 1 },
          { from: 'trans', to: 'coll', kind: 'main', step: 2 },
          { from: 'coll', to: 'agg', kind: 'change', step: 3 },
          { from: 'agg', to: 'reader', kind: 'main', step: 4 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Where:</b> the collector’s one rule, by event time.[[src:sdwhy]]' },
        { step: 4, html: '<b>What, when, how:</b> all in the aggregator’s state.[[src:sdwhy]]' },
        { step: 4, html: '<b>Two thresholds:</b> lateness ≥ 81 s, mode matches sink.[[src:sdwhen]]' }
      ],
      narration: [
        'Here is the whole design. First, the writer: the app on each phone, which stamps event time when the purchase happens.',
        'Second, the transport carries the events and tracks the watermark: the latest event time seen, minus 60 seconds.',
        'Third, the collector puts each event in its window by event time. That one rule is the whole answer to where.',
        'Fourth, the aggregator keeps each window’s state, and with it the answers to what, when and how: a sum, three kinds of trigger, and retractions.',
        'Last, the reader, the dashboard, which ends on 19. Where lives in one rule; everything else, and every difficulty, lives in the aggregator’s state.'
      ]
    },

    /* ---------- 15 · question: what it does not settle ---------- */
    {
      title: 'Gap', layout: 'ask',
      eyebrow: '15 · Your turn · what this design does not settle',
      heading: 'The last window of the day',
      stand: 'Id 8 happened at 12:09:00, in the window 12:08 to 12:10. It is the last purchase: no later event ever arrives, so the watermark stays at 12:08:00.',
      question: {
        step: 0,
        prompt: 'What does the dashboard ever receive for the window 12:08 to 12:10?',
        options: [
          { text: 'Only early panes of 8, never claimed complete.', correct: true,
            why: 'The clock fires at 12:10:00 with 8, and again every 60 s. The watermark never passes 12:10, so no on-time pane follows to stop it.' },
          { text: 'An on-time pane of 8, as for every window.', correct: false,
            why: 'The on-time pane needs the watermark to pass 12:10. With no later events, it stays at 12:08:00.' },
          { text: 'Nothing at all: the window is still empty.', correct: false,
            why: 'Id 8 is in it, seen at 12:09:02, so the early trigger has a value to announce.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window whose when never arrives', html: '<p>Every value it publishes is one the pipeline never claims is complete. Answering all four questions says nothing about such a window.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Id 8 happened at 12:09:00, in the window 12:08 to 12:10. It is the last purchase, so the watermark stays at 12:08:00. What does the dashboard ever receive for that window? Choose an answer.',
        'Only early panes of 8: at 12:10:00, then every 60 seconds, because no on-time pane ever stops them. None is claimed complete. The design fully specified one window, and says nothing about a window whose when never arrives.'
      ]
    },

    /* ---------- 16 · the four gaps ---------- */
    {
      title: 'Not', layout: 'cards',
      eyebrow: '16 · Four things this design does not settle',
      heading: 'Memory, negatives, guessing, and silent windows',
      stand: 'Use this design when the reader can accept a moving number.',
      columns: 2,
      cards: [
        { step: 0, title: '1 · Allowed lateness is memory', html: '<p>Kept state costs open windows × state per window. With 4 windows it is free; with a million it is the pipeline’s main cost.[[src:sdwhen]]</p>' },
        { step: 1, title: '2 · The sink must accept negatives', html: '<p>−15 has to be representable and meaningful downstream. A ledger that billed on the first value is a contract problem, not a setting.[[src:sdwhen]]</p>' },
        { step: 2, title: '3 · 81 s was found in hindsight', html: '<p>It was computed with every watermark visible. A live pipeline sets it before seeing them, and so it is guessing.[[src:sdwhen]]</p>' },
        { step: 3, title: '4 · Only one window was specified', html: '<p>The window from 12:08 is only ever reported by the early trigger: 8 at 12:10:00, then every 60 s, never claimed complete.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Four things this design does not settle. First, allowed lateness is memory: open windows times the state of each. With 4 windows it is free; with a million it is the main cost.',
        'Second, retractions need a sink that accepts negative numbers. A ledger that already billed on the first value cannot take minus 15; that is a contract problem, not a setting.',
        'Third, the 81 seconds was computed with every watermark visible. A live pipeline must choose its setting before seeing them, so it is guessing.',
        'Fourth, only one window was specified. The window from 12:08 is only ever reported by the early trigger, every 60 seconds, and never claimed complete.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · The design, a sentence per component',
      heading: 'Stamp at the source, assign by event time, keep state, retract',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Writer</b>', 'Stamps event time on the phone; events never change.', 'Who knows when it happened?[[src:writer]]'] },
          { step: 0, cells: ['<b>Transport</b>', 'Carries events; watermark = latest seen − 60 s.', 'Which times are complete?[[src:trans]]'] },
          { step: 1, cells: ['<b>Collector</b>', 'Puts id 7 in 12:00 to 12:02 by event time.', 'Where?[[src:coll]]'] },
          { step: 1, cells: ['<b>Aggregator / store</b>', 'Sum per window; early, on time, late; retractions; lateness ≥ 81 s.', 'What, when, how?[[src:agg]]'] },
          { step: 2, cells: ['<b>Reader</b>', '11 values, ending on 19; without undos, 87.', 'What does the screen show?[[src:sdwhy]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Where is one rule in the collector; what, when and how all live in the aggregator’s state, which is where every difficulty is.[[src:sdwhy]]</p>' },
      narration: [
        'To recap. The writer stamps event time on the phone. The transport carries the events and tracks the watermark, the latest event time seen minus 60 seconds.',
        'The collector puts each event in its window by event time. The aggregator keeps each window’s state, fires early, on time and late, and sends retractions, with an allowed lateness of at least 81 seconds.',
        'The reader receives 11 values for one window and ends on 19. Without the undos, it would end on 87.',
        'In one line: where is a single rule in the collector, and what, when and how all live in the aggregator’s state, which is where every difficulty is.'
      ]
    }
  ]
};
