// Chapter 3, Part 3 — "Propagation and correctness", for a viewer who has read nothing
// before it. The phones, the two clocks and the watermark are re-introduced from zero; then
// a stage reading two phones is shown taking the minimum, the difference between "closed"
// and "complete" is asked, and the safety net (allowed lateness) is put under the estimate.
// Every time and value comes from the one seed (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch03';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => (s < 0 ? 'before 12:00' : `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`);
const PER = E.map((_, i) => Object.fromEntries(seed.KEYS.map(k => {
  const seen = E.filter((e, j) => j <= i && e.key === k);
  return [k, seen.length ? Math.max(...seen.map(e => e.et)) - seed.LAG : null];
})));
const STAGE = PER.map(p => (p.a === null || p.b === null ? null : Math.min(p.a, p.b)));
const show = v => (v === null ? 'no claim' : clock(v));
const showSrc = v => (v === null ? 'nothing yet' : clock(v));
const END = E.length - 1;
const WITHHELD = seed.WIN_STARTS.filter(w => seed.WATERMARKS[END] >= w + seed.WIN && STAGE[END] < w + seed.WIN);
const LI = E.findIndex(e => e.id === 7);
const ALLOWED = seed.WATERMARKS[LI] - seed.WIN + 1;

if (PER[END].a !== 480 || PER[END].b !== 200 || STAGE[END] !== 200 || STAGE[0] !== null || STAGE[1] !== null
  || WITHHELD.join() !== '120,240' || WITHHELD.map(w => seed.SUM(seed.WINDOWS[w])).join() !== '11,7'
  || seed.SUM(seed.WINDOWS[0]) !== 19 || seed.WATERMARKS[4] !== 185 || ALLOWED !== 81 || seed.WATERMARKS[LI] - seed.WIN !== 80)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Closed Is Not Complete',
  eyebrow: 'Streaming · Ch 3 · Part 3',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'watermark', 'skew', 'stage',
    'trigger', 'late', 'idleness timeout', 'state', 'allowed lateness'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    flow:  section(CH, 'Propagation and correctness', 'Chapter 3 · propagation and correctness'),
    why:   section(CH, 'Why a stage takes the minimum, and why "closed" is not "complete"', 'Chapter 3 · why the minimum'),
    when:  section(CH, 'When the minimum rule bites, and what watermarks actually buy', 'Chapter 3 · when the minimum bites'),
    walk:  section(CH, 'Visual walkthrough — the minimum, the decision, and the safety net', 'Chapter 3 · the walkthrough'),
    prog:  section(CH, 'Propagation — stack and heap at every step', 'Chapter 3 · propagation as a program'),
    skew:  section(CH, 'Heuristic watermarks and skew', 'Chapter 3 · heuristic watermarks'),
    sys:   section(CH, 'trigger/emitter', 'Chapter 3 · the trigger and late data')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 3 · Part 3',
      heading: 'Two phones feed one step. How sure can that step be?',
      hero: { step: 0, text: 'An app on two phones, <b>a</b> and <b>b</b>, sends a message each time something happens. Each message is an <b>event</b> carrying a small value; together they form a <b>stream</b> that never ends. The <b>pipeline</b> receiving them adds the values up per 2-minute <b>window</b> of time.[[src:flow]]' },
      tiles: [
        { step: 1, value: 2, label: 'phones feeding the same step[[src:why]]' },
        { step: 1, value: 280, suffix: ' s', label: 'how far the busy phone runs ahead of the quiet one[[src:skew]]' },
        { step: 2, value: 15, label: 'first total announced, of a true 19[[src:why]]' },
        { step: 2, value: ALLOWED, suffix: ' s', label: 'how long the window must be kept for 19 to land[[src:sys]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'With two phones, what may the pipeline claim?', text: 'Not more than the less complete phone can back.' },
        { step: 3, n: 2, title: 'What does “closed” really mean?', text: 'A decision to stop waiting, not a fact.' },
        { step: 4, n: 3, title: 'What catches the events that still arrive?', text: 'A safety net with a deliberate limit.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app on two phones, a and b, sends a message each time something happens. Each message is an event carrying a small value. Together they form a stream that never ends, received by a program called the pipeline.',
        'The pipeline adds values up per 2-minute slice of time, called a window. Both phones feed the same step of the pipeline, and by the end phone a runs 280 seconds ahead of phone b.',
        'The first window announced 15, when the true total was 19. We will see how a 19 can still come out, if the window is kept for at least 81 seconds more.',
        'Three questions. With two phones, what may the pipeline claim? And what does it really mean when a window is closed?',
        'And what catches the events that still arrive afterwards? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'In the order the pipeline received them.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`id ${e.id}`, e.key, i === LI ? `<b>${clock(e.et)}</b>` : clock(e.et), i === LI ? `<b>${clock(e.pt)}</b>` : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li></ul><p>Phone b’s last event, id 7, happened at 12:00:50 and was seen at 12:04:40. After it, phone b goes quiet.[[src:why]]</p>' },
      narration: [
        'Each event carries two times. When it happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Usually they are seconds apart.',
        'But id 6 happened at 12:03:40 and arrived after id 5, from 12:04:20. And id 7 happened at 12:00:50 and was not seen until 12:04:40.',
        'Notice which phone sent what. Id 7 is phone b’s last event: after it, phone b sends nothing more, while phone a goes on until 12:09:00.'
      ]
    },

    /* ---------- 3 · the watermark, per phone, animated ---------- */
    {
      title: 'Each', layout: 'array', defines: ['watermark', 'skew'],
      eyebrow: '03 · Watch one estimate per phone',
      heading: 'Each phone’s own “everything before this has arrived”',
      stand: 'Slots are the events in arrival order. For each phone: the latest event time it has sent, minus 60 seconds.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'from phone', values: E.map(e => e.key) },
          { label: 'phone a', values: PER.map(p => showSrc(p.a)) },
          { label: 'phone b', values: PER.map(p => showSrc(p.b)) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 3, do: 'pick', slots: [END] }
        ]
      },
      cards: [
        { step: 1, title: 'The watermark', html: '<p>The pipeline’s estimate that everything before a time has arrived is its <b>watermark</b>: the latest event time seen, minus a margin, the <b>skew</b>, here 60 s.[[src:skew]]</p>' },
        { step: 3, title: 'At the end', html: '<p>Phone a vouches up to <b>12:08:00</b>. Phone b stopped at <b>12:03:20</b>: its latest event, 12:04:20, minus 60 s.[[src:why]]</p>' }
      ],
      narration: [
        'Top row: which phone sent each event, in arrival order. Phone a sends ids 0, 1, 3, 4 and 8; phone b sends ids 2, 5, 6 and 7.',
        'For each phone the pipeline keeps an estimate that everything before some time has arrived, called the watermark: the latest event time seen, minus a margin called the skew, here 60 seconds. Phone a’s row climbs to 12:08:00.',
        'Phone b’s row starts only at id 2, its first event, and stops at 12:03:20 after id 5. Ids 6 and 7 happened earlier than id 5, so they do not move it.',
        'At the last event, phone a vouches up to 12:08:00, and phone b only up to 12:03:20. They disagree by 280 seconds.'
      ]
    },

    /* ---------- 4 · question: what may the step claim ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['stage'],
      eyebrow: '04 · Your turn',
      heading: 'One step reads both phones. What watermark may it claim?',
      stand: 'A step of the pipeline that receives several inputs is called a stage. Phone a says 12:08:00; phone b says 12:03:20.',
      question: {
        step: 0,
        prompt: 'What watermark may the stage claim, reading both phones?',
        options: [
          { text: 'The larger, 12:08:00: phone a has seen further.', correct: false,
            why: 'Phone b has said nothing about anything after 12:03:20. Claiming 12:08:00 over-claims by 280 s.' },
          { text: 'The smaller, 12:03:20: the less complete phone.', correct: true,
            why: 'Everything before 12:03:20 is vouched for by both phones. Anything later, phone b cannot back.' },
          { text: 'Their average, halfway between the two.', correct: false,
            why: 'Halfway is still past what phone b can back. An average invents completeness that no input claimed.' }
        ]
      },
      cards: [
        { step: 1, title: 'The minimum rule', html: '<p>A <b>stage</b>’s watermark is the minimum of its inputs’ watermarks: it cannot claim more completeness than its least complete input.[[src:flow]]</p>' },
        { step: 2, title: 'So the quietest sets the pace', html: '<p>Phone b is at 12:03:20, so the stage is at 12:03:20, however far phone a gets.[[src:prog]]</p>' }
      ],
      narration: [
        'A step of the pipeline that receives several inputs is called a stage. Phone a says 12:08:00, phone b says 12:03:20. What watermark may the stage claim? Choose an answer.',
        'The smaller, 12:03:20. A stage’s watermark is the minimum of its inputs’ watermarks, because it cannot claim more completeness than its least complete input.',
        'So the quietest input sets the pace. Phone b stopped at 12:03:20, so the stage stays at 12:03:20, however far phone a gets.'
      ]
    },

    /* ---------- 5 · question: before phone b says anything ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '05 · Your turn',
      heading: 'Phone b has not sent anything yet',
      stand: 'After id 0 and id 1, only phone a has spoken. Phone b has sent nothing at all.',
      question: {
        step: 0,
        prompt: 'At that moment, what should the stage claim?',
        options: [
          { text: 'Phone a’s watermark: phone b has nothing to add.', correct: false,
            why: 'Phone b may be holding an old event right now. Taking phone a’s number ignores that possibility.' },
          { text: 'Nothing at all: it makes no claim yet.', correct: true,
            why: 'Silence cannot be told apart from an old event still on its way, so there is no basis for any claim.' },
          { text: '12:00, the start of the first window.', correct: false,
            why: 'Even that says “nothing before 12:00 is coming”, which phone b has not vouched for either.' }
        ]
      },
      cards: [
        { step: 1, title: 'Silence is not a yes', html: '<p>Until every input has produced something, the stage has no claim at all, not a generous one.[[src:why]]</p>' },
        { step: 2, title: 'In the program', html: '<p>The stage’s function returns “none” the moment any input has nothing: one line, and it blocks the whole claim.[[src:prog]]</p>' }
      ],
      narration: [
        'After id 0 and id 1, only phone a has spoken. Phone b has sent nothing at all. What should the stage claim at that moment? Choose an answer.',
        'Nothing at all. Silence cannot be told apart from an old event still on its way, so until every input has produced something, the stage makes no claim, not even a generous one.',
        'In the chapter’s program this is a single line: if any input has nothing, return none. Let us watch the stage’s claim being worked out.'
      ]
    },

    /* ---------- 6 · the stage's claim, animated ---------- */
    {
      title: 'Min', layout: 'array',
      eyebrow: '06 · Watch the stage take the minimum',
      heading: 'The stage claims the smaller, or nothing',
      stand: 'For each event: phone a’s watermark, phone b’s, and the stage’s claim. Top: what one shared watermark would have claimed.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'one shared', values: seed.WATERMARKS.map(clock) },
          { label: 'phone a', values: PER.map(p => showSrc(p.a)) },
          { label: 'phone b', values: PER.map(p => showSrc(p.b)) },
          { label: 'stage claims', values: STAGE.map(show) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'pick', rows: [3], slots: [0, 1] },
          { step: 2, do: 'show', rows: [0] },
          { step: 2, do: 'pick', rows: [0, 3], slots: [END] }
        ]
      },
      cards: [
        { step: 1, title: 'No claim, then the minimum', html: '<p>Ids 0 and 1: no claim. From id 2 on, the smaller of the two. At the end: <b>12:03:20</b>.[[src:why]]</p>' },
        { step: 2, title: 'The shortcut over-claims', html: '<p>One shared watermark takes the latest time from either phone and claims 12:08:00: 280 s more than phone b can back.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the two phones’ watermarks again, event by event, in the order they arrived.',
        'Now the stage’s claim. For ids 0 and 1, highlighted, there is no claim, because phone b is silent. From id 2 on, it is the smaller of the two, and at the end it is 12:03:20.',
        'The top row is the shortcut: one shared watermark that ignores which phone sent what. At the end it claims 12:08:00, which is 280 seconds more than phone b can back. Convenient, and wrong.'
      ]
    },

    /* ---------- 7 · question: when the minimum bites ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['idleness timeout'],
      eyebrow: '07 · Your turn',
      heading: 'Two windows whose events have all arrived',
      stand: 'Window 12:02 to 12:04 holds 11, window 12:04 to 12:06 holds 7. Every one of their events has arrived. The stage’s claim is 12:03:20.',
      question: {
        step: 0,
        prompt: 'Are those two windows announced?',
        options: [
          { text: 'Yes: all of their events have arrived.', correct: false,
            why: 'The pipeline cannot know that. Only the watermark tells it, and the stage’s watermark has not reached their ends.' },
          { text: 'No: the stage’s watermark has not reached their ends.', correct: true,
            why: 'They close at 12:04 and 12:06. The claim stops at 12:03:20 because phone b went quiet, so both wait.' },
          { text: 'Only the first: it ends sooner.', correct: false,
            why: 'Even 12:04 is past 12:03:20, so the first window waits too.' }
        ]
      },
      cards: [
        { step: 1, title: 'Correct, and it looks like a bug', html: '<p>Output stops while the pipeline reports healthy. The cause: an input nobody is watching.[[src:when]]</p>' },
        { step: 2, title: 'The escape, and its price', html: '<p>An <b>idleness timeout</b> declares a quiet input finished. That is a decision, not a measurement: it trades away the correctness the minimum protected.[[src:when]]</p>' }
      ],
      narration: [
        'Window 12:02 to 12:04 holds 11, and window 12:04 to 12:06 holds 7. Every one of their events has arrived. The stage’s claim is 12:03:20. Are they announced? Choose an answer.',
        'No. Their ends, 12:04 and 12:06, are past 12:03:20, so both wait, withheld because phone b went quiet. That is correct, and in production it looks like a bug: output stops while everything reports healthy.',
        'Real systems add an idleness timeout, a rule that declares a quiet input finished. That is a decision, not a measurement, and it gives up the correctness the minimum was protecting.'
      ]
    },

    /* ---------- 8 · question: what is a fact ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['trigger', 'late'],
      eyebrow: '08 · Your turn',
      heading: 'The watermark passed 12:02. What does that tell us?',
      stand: 'After id 4, the watermark reached 12:03:05, past the end of window 12:00 to 12:02. The rule that fires a window then, the trigger, announced 15.',
      question: {
        step: 0,
        prompt: 'Which of these is a plain fact, rather than a claim?',
        options: [
          { text: 'The watermark passed 12:02 when id 4 arrived.', correct: true,
            why: 'That is just the pipeline’s own arithmetic: 12:04:05 minus 60 s is 12:03:05, which is past 12:02.' },
          { text: 'No event from before 12:02 will arrive now.', correct: false,
            why: 'That is what the watermark claims, and it is false: id 7, from 12:00:50, is still on its way.' },
          { text: 'Window 12:00 to 12:02 has all of its events.', correct: false,
            why: 'It has three of its four events. Id 7, the fourth, arrives three events later.' }
        ]
      },
      cards: [
        { step: 1, title: 'The counter-example', html: '<p>Id 7, from 12:00:50, arrives 3 events later. An event whose window has already been announced is <b>late</b>.[[src:why]]</p>' }
      ],
      narration: [
        'After id 4, the watermark reached 12:03:05, past the end of the first window. The rule that fires a window when the watermark passes its end, the trigger, announced 15. Which statement is a plain fact? Choose an answer.',
        'Only that the watermark passed 12:02 when id 4 arrived. That is the pipeline’s own arithmetic. The rest are claims, and false: id 7, from 12:00:50, arrives three events later, after its window was announced. Such an event is called late.'
      ]
    },

    /* ---------- 9 · four readings ---------- */
    {
      title: 'Read', layout: 'table',
      eyebrow: '09 · Four readings of the same moment',
      heading: 'The window was closed. It was not complete.',
      stand: 'Only the last reading is accurate.',
      table: {
        columns: ['Reading', 'What it is'],
        rows: [
          { step: 0, cells: ['The watermark passed 12:02 after id 4', 'A fact about the pipeline’s arithmetic.[[src:why]]'] },
          { step: 1, cells: ['“No event earlier than 12:02 will arrive”', 'The claim it implies, and it is false.[[src:why]]'] },
          { step: 1, cells: ['Id 7, from 12:00:50, arrives 3 events later', 'The counter-example nothing predicted.[[src:why]]'] },
          { step: 2, cells: ['<b>So the window was closed, not complete</b>', 'The pipeline chose to stop waiting.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Why the words matter', html: '<p><b>Closed</b>: the pipeline stopped waiting. <b>Complete</b>: everything has arrived. Swap them, and late data feels like a bug. It is a decision with an error attached: 21% of this window’s answer.[[src:walk]]</p>' },
      narration: [
        'Four readings of the same moment. First, a fact: the watermark passed 12:02 after id 4.',
        'Second, the claim it implies: no event earlier than 12:02 will arrive. Third, the counter-example: id 7, from 12:00:50, arrives three events later.',
        'So the window was closed, meaning the pipeline stopped waiting. It was not complete, meaning everything had arrived.',
        'Mixing up the two words is what makes late data feel like a bug. A closed window is a decision with an error attached: here, 21 percent of the answer.'
      ]
    },

    /* ---------- 10 · question: the safety net ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['state', 'allowed lateness'],
      eyebrow: '10 · Your turn',
      heading: 'Id 7 arrives after 15 was announced. Can 19 still come out?',
      stand: 'While a window is open, the pipeline keeps its running total in memory. That memory is called the window’s state.',
      question: {
        step: 0,
        prompt: 'What would let id 7 still correct the total to 19?',
        options: [
          { text: 'Keep the window’s state for a while after it closes.', correct: true,
            why: 'Then id 7 can still be added, and a corrected 19 announced, as long as it lands within that time.' },
          { text: 'Move the watermark back to before 12:02.', correct: false,
            why: 'The watermark only moves forward. Moving it back would re-open windows already announced everywhere.' },
          { text: 'Nothing: once announced, a total is final.', correct: false,
            why: 'A total can be corrected, if its state still exists. Throwing state away at once is what makes it final.' }
        ]
      },
      cards: [
        { step: 1, title: 'Allowed lateness', html: '<p>Keeping a window’s state for a bounded time after the watermark passes is <b>allowed lateness</b>. After it, stragglers are dropped.[[src:flow]]</p>' },
        { step: 2, title: 'Three layers', html: '<p>The watermark estimates, and is wrong. The trigger acts on it: 15. Allowed lateness keeps the state, so id 7 corrects it to 19.[[src:why]]</p>' }
      ],
      narration: [
        'While a window is open, the pipeline keeps its running total in memory, called the window’s state. Id 7 arrives after 15 was announced. What would let it still correct the total to 19? Choose an answer.',
        'Keep the window’s state for a while after it closes. That bounded extra time is called allowed lateness. Within it, a late event is still added; after it, stragglers are dropped.',
        'So three mechanisms layer in order: the watermark estimates and is wrong, the trigger acts on it and announces 15, and allowed lateness keeps the state so id 7 can correct it to 19.'
      ]
    },

    /* ---------- 11 · the layers on a timeline ---------- */
    {
      title: 'Net', layout: 'timeline',
      eyebrow: '11 · Watch the safety net catch id 7',
      heading: 'Estimate, act on it, then correct it',
      stand: 'Wall-clock moments for window 12:00 to 12:02. Each layer exists because the one before it is imperfect.',
      timeline: [
        { step: 0, time: clock(E[2].pt), title: 'Window open', text: 'Holds ids 0, 1, 2: 15 so far.' },
        { step: 1, time: clock(E[4].pt), title: 'Trigger fires', text: 'Watermark 12:03:05 passes 12:02: announces 15.[[src:why]]' },
        { step: 2, time: clock(E[LI].pt), title: 'Id 7 lands', text: 'Late, but the state is still kept.[[src:sys]]' },
        { step: 3, time: clock(E[LI].pt), title: 'Corrected', text: 'A second, corrected total: 19.[[src:sys]]' }
      ],
      strip: {
        step: 1, label: 'What the screen showing this window receives',
        items: [ { n: '15', text: 'on time, 21% low', tone: 'warn' }, { n: '19', text: 'the late correction', tone: 'ok' } ]
      },
      narration: [
        'Watch the first window on the wall clock. By 12:01:33 it holds ids 0, 1 and 2: 15 so far. Id 7 is still on a phone somewhere.',
        'At 12:04:06, id 4 lifts the watermark to 12:03:05, past 12:02. The trigger fires and the screen receives 15, which is 21 percent low.',
        'At 12:04:40, id 7 lands. It is late, but allowed lateness has kept the window’s state, so it can still be added.',
        'The pipeline announces a second, corrected total: 19. Each layer exists because the one before it is imperfect.'
      ]
    },

    /* ---------- 12 · question: how long to keep the state ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '12 · Your turn',
      heading: 'How long must the state be kept?',
      stand: 'When id 7 arrives, the watermark stands at 12:03:20: 80 s past the window’s end. The state survives while the watermark is below 12:02 plus the allowed lateness.',
      question: {
        step: 0,
        prompt: 'What is the smallest allowed lateness that lets id 7 correct the total?',
        options: [
          { text: '81 s: just past how far the watermark had moved.', correct: true,
            why: '12:02 plus 81 s is 12:03:21, still above the watermark’s 12:03:20, so the state is there when id 7 lands.' },
          { text: '230 s: id 7’s own delay.', correct: false,
            why: 'That also works, but holds state far longer than needed. What matters is where the watermark stood.' },
          { text: 'Forever: then nothing is ever lost.', correct: false,
            why: 'State is memory. Keeping every window forever means memory that grows without end.' }
        ]
      },
      cards: [
        { step: 1, title: 'Calibrated against the watermark', html: '<p>At 80 s the state is already gone and 15 stands for good. At 81 s, 19 arrives.[[src:sys]]</p>' },
        { step: 2, title: 'Bounded on purpose', html: '<p>Unbounded recovery means unbounded state. The limit is where correctness is traded for memory.[[src:walk]]</p>' }
      ],
      narration: [
        'When id 7 arrives, the watermark stands at 12:03:20, 80 seconds past the window’s end. The state survives while the watermark is below 12:02 plus the allowed lateness. What is the smallest value that works? Choose an answer.',
        '81 seconds. 12:02 plus 81 seconds is just above where the watermark stood, so the state is still there. At 80 seconds it is gone, and 15 stands for good.',
        'And the limit is deliberate. Keeping state is memory, and unbounded recovery means unbounded memory. The horizon is where correctness is traded for memory.'
      ]
    },

    /* ---------- 13 · question: what watermarks buy ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'And without any watermark at all?',
      stand: 'Answer from what you have seen in this part.',
      question: {
        step: 0,
        prompt: 'With no watermark, when could window 12:00 to 12:02 be announced, by event time?',
        options: [
          { text: 'Never: “everything has arrived” never becomes true.', correct: true,
            why: 'On a stream that never ends, there is no moment at which completeness can be proved, so nothing is ever announced.' },
          { text: 'At 12:02 on the wall clock, which is good enough.', correct: false,
            why: 'That answers a different question: what arrived by 12:02, not what happened by 12:02.' },
          { text: 'Once the pipeline has seen a few more events.', correct: false,
            why: 'How many is “a few”? Deciding that is exactly the judgement a watermark makes explicit.' }
        ]
      },
      cards: [
        { step: 1, title: 'Possible, not correct', html: '<p>Watermarks do not make event-time processing correct; they make it possible. This window goes out 21% wrong, and correctable.[[src:when]]</p>' }
      ],
      narration: [
        'One last question. With no watermark at all, when could the window 12:00 to 12:02 be announced, by event time? Choose an answer.',
        'Never. On a stream that never ends, everything has arrived never becomes true. So watermarks do not make event-time processing correct; they make it possible. This window goes out 21 percent wrong, and correctable.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Take the minimum, call it closed, and keep a safety net',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Stage</b> watermark', 'The minimum of its inputs’: 12:03:20, not 12:08:00. No claim at all while an input is silent.[[src:why]]'] },
          { step: 0, cells: ['When it bites', 'Windows holding 11 and 7 are withheld though complete; an idleness timeout is a decision.[[src:when]]'] },
          { step: 1, cells: ['<b>Closed</b>, not <b>complete</b>', 'The watermark passing is the pipeline deciding to stop waiting, with 21% error here.[[src:why]]'] },
          { step: 2, cells: ['<b>Allowed lateness</b>', 'Keep the state a bounded time: at least 81 s here, so id 7 turns 15 into 19.[[src:sys]]'] },
          { step: 2, cells: ['What watermarks buy', 'Not correctness: possibility. Without one, the window is never announced.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>The watermark is a running maximum, and one corrupt future time would raise it for good. Part 4 builds, with you, the program that bounds it: the largest value in a window that slides.[[src:ch]]</p>' },
      narration: [
        'To recap. A stage’s watermark is the minimum of its inputs’, 12:03:20 rather than 12:08:00, and no claim at all while an input is silent. It withholds complete windows when an input goes quiet.',
        'A watermark passing means the window is closed, not complete: the pipeline decided to stop waiting, with a 21 percent error here.',
        'Allowed lateness keeps the window’s state for a bounded time, at least 81 seconds here, so id 7 turns 15 into 19. Watermarks make event-time results possible, not correct.',
        'Next, part 4 builds a program with you: the largest value in a window that slides, which is what bounds a watermark against one corrupt time.'
      ]
    }
  ]
};
