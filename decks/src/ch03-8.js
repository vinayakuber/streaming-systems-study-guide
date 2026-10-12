// Chapter 3, Part 8 — the chapter's "System Design Interview": the watermark generator of an
// event-time pipeline, built one component at a time. Each component is preceded by a
// question; the design is then assembled and closed with the four things it does NOT settle.
// The phones, the two clocks and every word are re-introduced, so the deck stands alone.
// Every time and value comes from the one seed (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch03';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => { const t = 12 * 3600 + s; return `${Math.floor(t / 3600)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`; };
const NAIVE = E.map(e => e.et - seed.LAG);
const BACK = NAIVE.map((v, i) => (i > 0 && v < NAIVE[i - 1] ? i : -1)).filter(i => i >= 0);
const WM = seed.WATERMARKS;
const LI = E.findIndex(e => e.id === 7);
const PER = Object.fromEntries(seed.KEYS.map(k => [k, Math.max(...E.filter(e => e.key === k).map(e => e.et)) - seed.LAG]));

if (BACK.join() !== '6,7' || NAIVE[5] - NAIVE[6] !== 40 || NAIVE[6] - NAIVE[7] !== 170 || NAIVE[4] !== 185 || NAIVE[7] !== -10
  || WM.some((w, i) => i > 0 && w < WM[i - 1]) || PER.a !== 480 || PER.b !== 200 || PER.a - PER.b !== 280
  || E[LI].et !== 50 || E[LI].pt !== 280 || seed.SUM(seed.WINDOWS[0]) !== 19 || WM[LI] - seed.WIN !== 80)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Watermark Generator Design',
  eyebrow: 'Streaming · Ch 3 · Part 8',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'source', 'watermark', 'skew',
    'monotonic', 'trigger', 'late', 'allowed lateness', 'per-source', 'idleness timeout', 'checkpoint'],
  sources: {
    ch:     chapter(CH, 'Chapter 3 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 3 · system design interview'),
    src:    section(CH, 'sources (events with event time)', 'Chapter 3 · sources'),
    gen:    section(CH, 'watermark generator (max_seen − skew)', 'Chapter 3 · the watermark generator'),
    asg:    section(CH, 'window assigner', 'Chapter 3 · the window assigner'),
    trig:   section(CH, 'trigger/emitter', 'Chapter 3 · the trigger and emitter'),
    why:    section(CH, 'Why this component is small, and why its failures look like wrong totals', 'Chapter 3 · why its failures look like wrong totals'),
    when:   section(CH, 'When each setting is right, and the four things this does not settle', 'Chapter 3 · the four gaps'),
    prog:   section(CH, 'The watermark generator — stack and heap at every step', 'Chapter 3 · the generator as a program')
  },

  slides: [
    /* ---------- 1 · the brief, as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 3 · Part 8 · a system design interview',
      heading: 'One small component decides when every total is announced',
      hero: { step: 0, text: 'An app on two phones, <b>a</b> and <b>b</b>, sends a message each time something happens. Each message is an <b>event</b> with a small value; they arrive without end, a <b>stream</b>. A <b>pipeline</b> adds the values up per 2-minute <b>window</b> of time and shows each total on a dashboard.[[src:sd]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in the example[[src:sd]]' },
        { step: 1, value: 60, suffix: ' s', label: 'the safety margin the design starts with[[src:sd]]' },
        { step: 2, value: 2, label: 'times a tempting formula goes backwards[[src:why]]' },
        { step: 2, value: 4, label: 'things the finished design still does not settle[[src:when]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Where each time comes from', text: 'And which component needs it.' },
        { step: 3, n: 2, title: 'The formula', text: 'So that it never goes backwards.' },
        { step: 4, n: 3, title: 'The two settings', text: 'How big a margin, and one estimate or one per phone.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the component is shown, and at the end, what the design does not settle.[[src:sd]]' },
      narration: [
        'An app on two phones, a and b, sends a message each time something happens. Each message is an event with a small value, arriving without end: a stream. A pipeline adds the values up per 2-minute window of time and shows each total on a dashboard.',
        'Our example has 9 events, and the design starts with a safety margin of 60 seconds. The interviewer asks you to design the one component that decides when each window’s total may be announced.',
        'Along the way, a tempting formula turns out to go backwards twice, and even the finished design leaves 4 things unsettled.',
        'The design must decide where each time comes from and which component needs it, and a formula that never goes backwards.',
        'And two settings: how big a margin, and one estimate for everything or one per phone. Before each component, you will be asked to choose.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'source'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened, when it was seen, and who sent it',
      stand: 'In the order the pipeline received them.',
      table: {
        columns: ['Event', 'Source', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`id ${e.id}`, `phone ${e.key}`, i >= 6 && i <= 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), clock(e.pt), `${e.v}`] }))
      },
      side: { step: 2, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Source</b> — an input feeding the pipeline; here, each phone.[[src:src]]</li></ul>' },
      narration: [
        'Each event carries two times. When it happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Each phone feeding the pipeline is called a source.',
        'Look at ids 6 and 7. Id 6 happened at 12:03:40, earlier than id 5. Id 7 happened at 12:00:50 and was seen at 12:04:40, after ids 4, 5 and 6 had already arrived.',
        'So event times arrive out of order, and the pipeline must decide when a window has heard enough. That decision is the component we are designing.'
      ]
    },

    /* ---------- 3 · component 1: the sources ---------- */
    {
      title: 'Stamp', layout: 'ask',
      eyebrow: '03 · Your turn · component 1, the sources',
      heading: 'Who should stamp the time on an event?',
      stand: 'Id 7 happened at 12:00:50 on phone b, which was offline. It reached the pipeline at 12:04:40.',
      question: {
        step: 0,
        prompt: 'Where should an event’s time be stamped, for windows by when things happened?',
        options: [
          { text: 'On the phone, when it happens.', correct: true,
            why: 'Only the phone knows when it happened. Then id 7 lands in window 12:00 to 12:02, where it belongs.' },
          { text: 'At the pipeline, when it arrives.', correct: false,
            why: 'That is processing time. Id 7 would be stamped 12:04:40 and counted in the wrong window.' },
          { text: 'On the dashboard, when it is shown.', correct: false,
            why: 'By then it says nothing about when the thing happened, only when it was displayed.' }
        ]
      },
      cards: [
        { step: 1, title: 'Sources emit out of order', html: '<p>Event time is stamped at the source, not at arrival. Id 7 arrives after ids 4, 5 and 6, which happened later.[[src:src]]</p>' },
        { step: 2, title: 'So completeness must be estimated', html: '<p>Nothing in the stream says “everything before 12:02 is in”. Some component has to estimate it.[[src:sd]]</p>' }
      ],
      narration: [
        'Component one, the sources. Id 7 happened at 12:00:50 on a phone that was offline, and reached the pipeline at 12:04:40. Where should an event’s time be stamped? Choose an answer.',
        'On the phone, when it happens. Stamped at arrival, id 7 would be counted as 12:04:40, in the wrong window. So sources emit events out of order: id 7 arrives after ids 4, 5 and 6.',
        'And nothing in the stream ever says that everything before 12:02 is in. Some component has to estimate it.'
      ]
    },

    /* ---------- 4 · component 2: the formula ---------- */
    {
      title: 'Form', layout: 'ask', defines: ['watermark', 'skew'],
      eyebrow: '04 · Your turn · component 2, the watermark generator',
      heading: 'An estimate of “everything before this time has arrived”',
      stand: 'That estimate is called the watermark. It subtracts a safety margin, the skew, here 60 s. The question is what to subtract it from.',
      question: {
        step: 0,
        prompt: 'What should the generator subtract the 60 s skew from?',
        options: [
          { text: 'The latest event time seen so far.', correct: true,
            why: 'The latest time seen can only grow, so the watermark can never fall back.' },
          { text: 'The current event’s own event time.', correct: false,
            why: 'Looks equivalent, but an out-of-order event would pull the watermark backwards.' },
          { text: 'The wall clock at the pipeline.', correct: false,
            why: 'The wall clock is processing time; it says nothing about which events have happened.' }
        ]
      },
      cards: [
        { step: 1, title: 'The formula', html: '<p>watermark = latest event time seen − skew. After id 5: 12:04:20 − 60 s = <b>12:03:20</b>; id 6, at 12:03:40, does not move it.[[src:gen]]</p>' },
        { step: 2, title: 'The tempting version', html: '<p>“This event’s time − skew” differs by one function call. The next slide shows what it does.[[src:why]]</p>' }
      ],
      narration: [
        'Component two, the watermark generator. The pipeline’s estimate that everything before a time has arrived is called the watermark, and it subtracts a margin called the skew, 60 seconds. Subtract it from what? Choose an answer.',
        'From the latest event time seen so far. After id 5 that is 12:04:20, so the watermark is 12:03:20, and id 6, at 12:03:40, does not move it.',
        'The tempting alternative, this event’s own time minus the skew, differs by a single function call. Watch what it does.'
      ]
    },

    /* ---------- 5 · the two formulas, animated ---------- */
    {
      title: 'Back', layout: 'array', defines: ['monotonic'],
      eyebrow: '05 · Watch the two formulas side by side',
      heading: 'One formula goes backwards twice. The other never does.',
      stand: 'Slots are the events in arrival order. Row 2: this event’s time minus 60 s. Row 3: the latest time seen, minus 60 s.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => clock(e.et)) },
          { label: 'this event − 60', values: NAIVE.map(clock) },
          { label: 'latest − 60', values: WM.map(clock) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', rows: [1], slots: BACK },
          { step: 3, do: 'show', rows: [2] }
        ]
      },
      cards: [
        { step: 2, title: 'Backwards, twice', html: '<p>12:03:20 → 12:02:40 at id 6 (−40 s), and 12:02:40 → 11:59:50 at id 7 (−170 s).[[src:why]]</p>' },
        { step: 3, title: 'Monotonic', html: '<p>A number that only moves forward is <b>monotonic</b>. The latest time seen cannot shrink, so the correct row never falls: 0 regressions.[[src:prog]]</p>' }
      ],
      narration: [
        'The top row is each event’s time, in arrival order. It jumps around: ids 6 and 7 go backwards.',
        'The second row is the tempting formula: this event’s time minus 60 seconds.',
        'It goes backwards twice: from 12:03:20 to 12:02:40 at id 6, 40 seconds back, and to 11:59:50 at id 7, 170 seconds back.',
        'The third row uses the latest time seen. It never falls. A number that only moves forward is called monotonic, and here one function call is the difference between 2 regressions and none.'
      ]
    },

    /* ---------- 6 · why backwards matters ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['trigger'],
      eyebrow: '06 · Your turn · why monotonic matters',
      heading: 'A window that was already announced',
      stand: 'The rule that announces a window when the watermark passes its end is the trigger. With the tempting formula, the watermark passed 12:02 at id 4, and window 12:00 to 12:02 announced 15. At id 7 it fell to 11:59:50.',
      question: {
        step: 0,
        prompt: 'What does that fall mean for window 12:00 to 12:02?',
        options: [
          { text: 'It is “not yet complete” again, after being announced.', correct: true,
            why: 'A watermark below its end says the window is still open, yet its total was already published.' },
          { text: 'Nothing: once announced, the watermark no longer matters.', correct: false,
            why: 'Everything downstream reads the watermark to decide what is complete. It now says the opposite.' },
          { text: 'It closes again, a second time.', correct: false,
            why: 'Falling below the end does the reverse: it un-closes the window.' }
        ]
      },
      cards: [
        { step: 1, title: 'Un-closing a published window', html: '<p>Nothing downstream has a concept for that. Every guarantee is built on the watermark never going back.[[src:why]]</p>' }
      ],
      narration: [
        'The rule that announces a window when the watermark passes its end is called the trigger. With the tempting formula, the watermark passed 12:02 at id 4 and the window announced 15. Then it fell to 11:59:50. What does that mean? Choose an answer.',
        'The window is not yet complete again, after its total was announced. Nothing downstream has a concept for that, which is why monotonic is not tidiness: every later guarantee is built on it.'
      ]
    },

    /* ---------- 7 · component 3: the window assigner ---------- */
    {
      title: 'Place', layout: 'ask',
      eyebrow: '07 · Your turn · component 3, the window assigner',
      heading: 'Does putting an event in a window need the watermark?',
      stand: 'The window assigner puts each event in its 2-minute window. Id 7, from 12:00:50, belongs in window 12:00 to 12:02.',
      question: {
        step: 0,
        prompt: 'What does the window assigner need, to place id 7?',
        options: [
          { text: 'Only id 7’s own event time.', correct: true,
            why: '12:00:50 falls in 12:00 to 12:02, whatever the watermark says. The assigner never reads it.' },
          { text: 'The watermark, to know whether to accept it.', correct: false,
            why: 'Accepting or not is the trigger’s business. Placement depends on the event time alone.' },
          { text: 'The time it arrived, 12:04:40.', correct: false,
            why: 'That is processing time; it would put id 7 in the wrong window.' }
        ]
      },
      cards: [
        { step: 1, title: 'The blast radius', html: '<p>The watermark has exactly one consumer: the trigger. A watermark bug cannot put an event in the wrong window.[[src:why]]</p>' },
        { step: 2, title: 'How its failures look', html: '<p>Only too soon or too slowly: under-counted totals, not scattered data. “Our numbers are low” points back here.[[src:why]]</p>' }
      ],
      narration: [
        'Component three, the window assigner. It puts each event in its 2-minute window. What does it need to place id 7? Choose an answer.',
        'Only id 7’s own event time: 12:00:50 falls in 12:00 to 12:02, whatever the watermark says. So the watermark has exactly one consumer, the trigger, and a watermark bug cannot put an event in the wrong window.',
        'It can only make a window speak too soon or too slowly. That is why its failures look like under-counted totals, and why “our numbers are low” maps back to this component.'
      ]
    },

    /* ---------- 8 · component 4: trigger and late data ---------- */
    {
      title: 'Late', layout: 'ask', defines: ['late', 'allowed lateness'],
      eyebrow: '08 · Your turn · component 4, the trigger and emitter',
      heading: 'Id 7 lands in a window already announced',
      stand: 'The watermark passed 12:02 at 12:04:06 and the window announced 15. At 12:04:40 id 7 arrives; the watermark is 12:03:20, 80 s past the window’s end.',
      question: {
        step: 0,
        prompt: 'What should the emitter do with id 7?',
        options: [
          { text: 'Add it if the window is still kept, and announce 19.', correct: true,
            why: 'Keeping a window a bounded time after it closes lets a straggler correct the total.' },
          { text: 'Drop it: the window has closed.', correct: false,
            why: 'Then 15 stands for good, 21% low, though the right value was in hand.' },
          { text: 'Re-open every window, just in case.', correct: false,
            why: 'Keeping every window forever means memory that grows without end.' }
        ]
      },
      cards: [
        { step: 1, title: 'Late, and allowed lateness', html: '<p>An event whose window has already closed is <b>late</b>. Keeping the window a bounded time after it closes is <b>allowed lateness</b>: at least 81 s here.[[src:trig]]</p>' },
        { step: 2, title: 'A late correction', html: '<p>The emitter re-sends the updated total, 19, to the dashboard.[[src:trig]]</p>' }
      ],
      narration: [
        'Component four, the trigger and emitter. The window announced 15 at 12:04:06. At 12:04:40 id 7 arrives, with the watermark 80 seconds past the window’s end. What should the emitter do? Choose an answer.',
        'Add it, if the window is still kept, and announce 19. An event whose window has already closed is called late. Keeping a window for a bounded time after it closes is called allowed lateness; here it must be at least 81 seconds.',
        'The emitter then re-sends the corrected total, 19, to the dashboard.'
      ]
    },

    /* ---------- 9 · setting 1: the skew ---------- */
    {
      title: 'Skew', layout: 'ask',
      eyebrow: '09 · Your turn · the first setting, the skew',
      heading: 'A team wants no late events on this window',
      stand: 'Skew 60 s: window 12:00 to 12:02 announces 15 at 12:04:06, with 1 event late. Skew 141 s: it announces 19 at 12:09:02, with none late.',
      question: {
        step: 0,
        prompt: 'What does moving from 60 s to 141 s cost this window?',
        options: [
          { text: '296 s later, for the right answer.', correct: true,
            why: '12:09:02 instead of 12:04:06. The skew trades waiting for correctness.' },
          { text: 'Nothing: it is simply more accurate.', correct: false,
            why: 'The answer arrives almost five minutes later. Waiting is the price.' },
          { text: 'One more late event.', correct: false,
            why: 'The reverse: a larger skew means fewer late events, here none.' }
        ]
      },
      cards: [
        { step: 1, title: 'Large for billing, small for live screens', html: '<p>Raise it when a late answer beats a wrong one; lower it when a stale answer is worse than an incomplete one.[[src:when]]</p>' }
      ],
      narration: [
        'The first setting, the skew. At 60 seconds this window announces 15 at 12:04:06, with one event late. At 141 seconds it announces 19 at 12:09:02, with none. What does the change cost? Choose an answer.',
        '296 seconds of waiting, for the right answer. Raise the skew when a late answer is better than a wrong one, as in billing; lower it when a stale answer is worse than an incomplete one, as on a live screen.'
      ]
    },

    /* ---------- 10 · setting 2: one estimate or one per phone ---------- */
    {
      title: 'Scope', layout: 'ask', defines: ['per-source'],
      eyebrow: '10 · Your turn · the second setting, the scope',
      heading: 'One watermark for everything, or one per phone?',
      stand: 'At the end, one watermark over all events claims 12:08:00. Phone a alone vouches for 12:08:00; phone b only for 12:03:20.',
      question: {
        step: 0,
        prompt: 'When is one watermark for all sources acceptable?',
        options: [
          { text: 'When every source is busy and alike, so none goes quiet.', correct: true,
            why: 'Then no input lags the others, and one estimate claims nothing a source cannot back.' },
          { text: 'Always: it is simpler.', correct: false,
            why: 'Here it claims 12:08:00, 280 s more than phone b can back.' },
          { text: 'Never: one per source is always required.', correct: false,
            why: 'With symmetric, busy inputs the single estimate is simpler and not wrong.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Per source, then the minimum', html: '<p>One watermark per source, and the pipeline claims the smallest: <b>per-source</b> tracking. Here 12:03:20.[[src:gen]]</p>' },
        { step: 2, title: 'Its visible price', html: '<p>Windows 12:02 to 12:04 and 12:04 to 12:06, holding 11 and 7, are withheld while phone b is quiet.[[src:why]]</p>' }
      ],
      narration: [
        'The second setting, the scope. One watermark over all events claims 12:08:00 at the end, but phone b can only vouch for 12:03:20. When is one watermark acceptable? Choose an answer.',
        'When every source is busy and alike, so none goes quiet. Otherwise keep one watermark per source and claim the smallest, which is called per-source tracking: here, 12:03:20.',
        'Its price is visible: windows 12:02 to 12:04 and 12:04 to 12:06, holding 11 and 7, are withheld while phone b is quiet.'
      ]
    },

    /* ---------- 11 · the idle source ---------- */
    {
      title: 'Idle', layout: 'ask', defines: ['idleness timeout'],
      eyebrow: '11 · Your turn · the most common outage',
      heading: 'Phone b disappears for good',
      stand: 'Per-source tracking is on. Phone b never sends another event.',
      question: {
        step: 0,
        prompt: 'What happens to the pipeline?',
        options: [
          { text: 'The watermark is pinned at 12:03:20 and no window closes again.', correct: true,
            why: 'The smallest watermark never moves, so no window’s end is ever passed. It looks like a stall, not an error.' },
          { text: 'It reports an error about phone b.', correct: false,
            why: 'Nothing is wrong by its own rules. Output simply stops, while everything reports healthy.' },
          { text: 'Phone a’s watermark takes over.', correct: false,
            why: 'Not without a rule that declares phone b finished. The minimum is still phone b’s.' }
        ]
      },
      cards: [
        { step: 1, title: 'Pair it with a timeout', html: '<p>An <b>idleness timeout</b> declares a quiet source finished. Always pair it with per-source tracking. It is a decision, not a measurement.[[src:when]]</p>' }
      ],
      narration: [
        'Per-source tracking is on, and phone b never sends another event. What happens? Choose an answer.',
        'The watermark is pinned at 12:03:20 forever, and no window closes again. It looks like a stall, not an error. The fix is an idleness timeout, a rule that declares a quiet source finished: always pair it with per-source tracking.'
      ]
    },

    /* ---------- 12 · the design, assembled ---------- */
    {
      title: 'Map', layout: 'graph',
      eyebrow: '12 · The design, assembled',
      heading: 'Events flow to the windows; the watermark flows only to the trigger',
      stand: 'Each box is one answer you chose. The generator sits beside the main flow and feeds exactly one component.',
      graph: {
        viewBox: '0 0 1520 340', legend: true,
        nodes: [
          { id: 'src', x: 20, y: 40, w: 220, h: 100, title: 'Sources', sub: 'stamp event time', kind: 'main', step: 0, src: 'src', values: ['phones a and b'] },
          { id: 'asg', x: 330, y: 40, w: 230, h: 100, title: 'Window assigner', sub: 'by event time only', kind: 'main', step: 0, src: 'asg', values: ['2-minute windows'] },
          { id: 'state', x: 650, y: 40, w: 230, h: 100, title: 'Per-window state', sub: 'running totals', kind: 'main', step: 0, values: ['kept 81 s past close'] },
          { id: 'trig', x: 970, y: 40, w: 230, h: 100, title: 'Trigger / emitter', sub: 'fires on the watermark', kind: 'main', step: 2, src: 'trig', values: [null, null, '15, then 19'] },
          { id: 'dash', x: 1290, y: 40, w: 210, h: 100, title: 'Dashboard', sub: 'shows each total', kind: 'ext', step: 2 },
          { id: 'gen', x: 560, y: 220, w: 300, h: 100, title: 'Watermark generator', sub: 'latest seen − skew, per source', kind: 'new', step: 1, src: 'gen', values: [null, '12:03:20 at the end'] }
        ],
        edges: [
          { from: 'src', to: 'asg', kind: 'main', step: 0 },
          { from: 'asg', to: 'state', kind: 'main', step: 0 },
          { from: 'src', to: 'gen', kind: 'new', step: 1 },
          { from: 'state', to: 'trig', kind: 'main', step: 2 },
          { from: 'gen', to: 'trig', kind: 'new', step: 2 },
          { from: 'trig', to: 'dash', kind: 'main', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Monotonic:</b> latest time seen, not this event’s time.[[src:why]]' },
        { step: 3, html: '<b>Two settings:</b> the skew, and per source with an idleness timeout.[[src:when]]' },
        { step: 3, html: '<b>One consumer:</b> a watermark bug shows up as low totals.[[src:why]]' }
      ],
      narration: [
        'Here is the design. Sources stamp event time. The window assigner places each event by event time alone, and per-window state keeps the running totals, for at least 81 seconds after a window closes.',
        'Beside the main flow sits the watermark generator: the latest event time seen, minus the skew, one per source, and the smallest claimed.',
        'Its watermark feeds exactly one component, the trigger, which announces 15 and then the corrected 19 to the dashboard.',
        'Three things to say in the interview: it is monotonic because it uses the latest time seen; it has two settings, the skew and the scope; and its bugs show up as low totals.'
      ]
    },

    /* ---------- 13 · what it does not settle ---------- */
    {
      title: 'Gaps', layout: 'ask', defines: ['checkpoint'],
      eyebrow: '13 · Your turn · what the design does not settle',
      heading: 'The generator restarts after a crash',
      stand: 'A pipeline periodically saves its progress, a checkpoint, and restarts from the last one after a crash. The generator recomputes its watermark from there.',
      question: {
        step: 0,
        prompt: 'After a restart, can the generator publish a watermark lower than one it already published?',
        options: [
          { text: 'Yes: monotonic holds only within one run.', correct: true,
            why: 'The checkpoint may be older than the last value sent, so the recomputed latest time can be smaller.' },
          { text: 'No: taking the latest time seen forbids it.', correct: false,
            why: 'Only within a run. After a restart, the latest time seen starts again from the checkpoint.' },
          { text: 'No: the dashboard remembers the old value.', correct: false,
            why: 'The dashboard does not compute watermarks, and nothing downstream is prepared for one going back.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Four gaps', html: '<ul class="l"><li>The 60 s skew cannot be checked from inside: no late events looks the same as late events dropped.</li><li>Per source needs to know the sources, and a timeout to give up on one.[[src:when]]</li></ul>' },
        { step: 2, title: '…continued', html: '<ul class="l"><li>Monotonic only within one run.</li><li>Window 12:08 to 12:10 never closes under any skew in the sweep: its 8 is never announced.[[src:when]]</li></ul>' }
      ],
      narration: [
        'A pipeline periodically saves its progress, called a checkpoint, and restarts from the last one after a crash. After a restart, can the generator publish a watermark lower than one already published? Choose an answer.',
        'Yes. Monotonic holds only within one run. The other gaps: the 60-second skew cannot be checked from inside, and per-source tracking needs to know its sources, plus a timeout to give up on one.',
        'And window 12:08 to 12:10 never closes under any skew in the sweep: no event lifts the watermark past its end, so its 8 is never announced, though the generator works correctly.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · The design, in five sentences',
      heading: 'Stamp at the source, take the latest, feed only the trigger',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Sources</b>', 'Stamp event time on the phone; emit out of order.', 'Who stamps the time?[[src:src]]'] },
          { step: 0, cells: ['<b>Watermark generator</b>', 'Latest event time seen − skew, per source, smallest claimed.', 'Subtract from what?[[src:gen]]'] },
          { step: 1, cells: ['<b>Window assigner</b>', 'Event time only; never reads the watermark.', 'Does it need the watermark?[[src:asg]]'] },
          { step: 1, cells: ['<b>Trigger / emitter</b>', 'Fires when the watermark passes a window’s end; corrects with late data.', 'What about id 7?[[src:trig]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'Unverifiable skew; unknown sources; restarts; a window that never closes.', 'What is left open?[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>One number, from one <code>max()</code>, read by one consumer: small to build, and its mistakes look like wrong totals.[[src:why]]</p>' },
      narration: [
        'To recap. Sources stamp event time on the phone. The generator takes the latest event time seen, minus the skew, per source, and claims the smallest.',
        'The window assigner uses event time alone, and the trigger fires when the watermark passes a window’s end, correcting with late data within allowed lateness.',
        'Not settled: a skew nobody can verify from inside, unknown sources, restarts, and a window that never closes.',
        'In one line: one number, from one maximum, read by one consumer. Small to build, and its mistakes look like wrong totals.'
      ]
    }
  ]
};
