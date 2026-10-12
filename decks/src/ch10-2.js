// Chapter 10, Part 2 — "Lambda and Kappa": two architectures for fast AND correct answers.
// Lambda runs the same sum twice, in a batch layer and a speed layer, and the two drift; Kappa
// runs one pipeline and replays a retained log. The phones, the two clocks and every word are
// introduced from zero; the drift, the bug and the replay are animated on the seed's nine
// events (tools/stream_seed.js), so every number is the chapter's own.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch10';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const arrOf = pt => Math.floor(pt / seed.WIN) * seed.WIN;
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const BY_ET = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const BY_PT = seed.WIN_STARTS.map(w => E.filter(e => arrOf(e.pt) === w).reduce((a, e) => a + e.v, 0));
const AGREE = BY_ET.map((v, i) => (v === BY_PT[i] ? 'yes' : 'no'));
const OFF = BY_ET.reduce((a, v, i) => a + Math.abs(v - BY_PT[i]), 0);
const buggy = e => (e.key === 'a' ? Math.floor(e.v / 2) : e.v);
const A = E.filter(e => e.key === 'a');
const A_TRUE = A.reduce((s, e) => s + e.v, 0), A_BUG = A.reduce((s, e) => s + buggy(e), 0);
const B_SUM = E.filter(e => e.key === 'b').reduce((s, e) => s + e.v, 0);
const BUG_TOTAL = E.reduce((s, e) => s + buggy(e), 0);
const KEPT = 6, SHORT = E.slice(E.length - KEPT).reduce((s, e) => s + e.v, 0);

if (E.length !== 9 || TOTAL !== 45 || BY_ET.join() !== '19,11,7,8' || BY_PT.join() !== '15,2,20,8' || OFF !== 26
  || AGREE.join() !== 'no,no,no,yes' || A.map(e => e.v).join() !== '5,3,2,6,8' || A.map(buggy).join() !== '2,1,1,3,4'
  || A_TRUE !== 24 || A_BUG !== 11 || B_SUM !== 21 || BUG_TOTAL !== 32 || SHORT !== 30 || seed.WIN !== 120
  || seed.winOf(E[6].et) !== 120)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Two Layers or Replay',
  eyebrow: 'Streaming · Ch 10 · Part 2',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'fixed window', 'batch',
    'latency', 'Lambda architecture', 'batch layer', 'speed layer', 'serving layer', 'codebase', 'drift', 'log',
    'offset', 'replay', 'Kappa architecture', 'retention', 'deterministic'],
  sources: {
    ch:   chapter(CH, 'Chapter 10 on GitHub'),
    flow: section(CH, 'Lambda and Kappa', 'Chapter 10 · Lambda and Kappa'),
    why:  section(CH, "Why Lambda's cost is a second implementation, and Kappa's is retention", 'Chapter 10 · Lambda’s cost and Kappa’s'),
    when: section(CH, 'When to pick each, and which assumption expires quietly', 'Chapter 10 · when to pick each'),
    walk: section(CH, 'Visual walkthrough — two layers, their drift, and one fix site', 'Chapter 10 · the walkthrough'),
    prog: section(CH, 'Two implementations or one — stack and heap at every step', 'Chapter 10 · two implementations as a program'),
    hist: section(CH, 'Why the end of the input was answering two of the four questions', 'Chapter 10 · batch and early streaming'),
    sys:  section(CH, 'Surviving a bug fix — stack and heap at every step', 'Chapter 10 · replay outcomes as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 10 · Part 2',
      heading: 'Fast answers and correct answers. Can one shop have both?',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a small message carrying its value. Each message is an <b>event</b>. Events keep coming with no end: a <b>stream</b>. A program that receives them and works out answers is a <b>pipeline</b>.[[src:flow]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: TOTAL, label: 'their value together[[src:why]]' },
        { step: 2, value: 2, label: 'places a bug fix must land, the first way[[src:why]]' },
        { step: 2, value: 1, label: 'place it must land, the second way[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'How do you get both?', text: 'Fast answers now, correct answers later.' },
        { step: 3, n: 2, title: 'What does that cost?', text: 'Counted on our nine events.' },
        { step: 4, n: 3, title: 'Is there a cheaper way?', text: 'And what it quietly assumes.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value. Each message is called an event, and events keep coming with no end: a stream.',
        'A program that receives the stream and works out answers is called a pipeline. Our example has 9 events, worth 45 together.',
        'The shop wants answers fast, and it wants them correct. You will see two ways to build that. With the first, fixing one bug means editing 2 places; with the second, just 1.',
        'Three questions. How do you get both fast and correct answers? And what does that cost, counted on our nine events?',
        'And is there a cheaper way, and what does it quietly assume? You will answer first, each time.'
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
          cells: [`id ${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hm(e.et)}</b>` : hm(e.et), i === 6 || i === 7 ? `<b>${hm(e.pt)}</b>` : hm(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b.[[src:prog]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened and was seen at 12:00.',
        'Usually the two are seconds apart, so to the minute they match. Id 4 happened and was seen at 12:04.',
        'But id 6 happened at 12:03 and was seen at 12:04. And id 7 happened at 12:00 and was not seen until 12:04, because its phone was offline.',
        'Which phone sent an event, a or b, is called its key. Keep the two clocks apart: in this part, two programs that use different clocks will disagree.'
      ]
    },

    /* ---------- 3 · question: which window does id 6 belong to ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window', 'fixed window'],
      eyebrow: '03 · Your turn',
      heading: 'The shop wants a total for every 2 minutes',
      stand: 'The shop asks for the value bought in each 2-minute stretch: 12:00 to 12:02, 12:02 to 12:04, and so on. Id 6 happened at 12:03 and was seen at 12:04.',
      question: {
        step: 0,
        prompt: 'Which stretch should id 6’s value be counted in?',
        options: [
          { text: '12:02 to 12:04, when the purchase happened.', correct: true,
            why: 'The shop asks what was bought in each stretch, and this purchase was made at 12:03.' },
          { text: '12:04 to 12:06, when the pipeline saw it.', correct: false,
            why: 'That is when the message arrived, not when the purchase was made. The shop asked about purchases.' },
          { text: 'Both stretches, to be safe.', correct: false,
            why: 'Then its value would be counted twice and the totals would add up to more than was bought.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window', html: '<p>A stretch of time that one result is worked out over is a <b>window</b>, such as 12:02 to 12:04.[[src:hist]]</p>' },
        { step: 2, title: 'Fixed windows', html: '<p>Back-to-back, equal, never overlapping, each <b>120 s</b> wide: <b>fixed windows</b>.[[src:hist]]</p>' }
      ],
      narration: [
        'First question. The shop wants the value bought in each 2-minute stretch. Id 6 happened at 12:03 and was seen at 12:04. Which stretch should it count in? Choose an answer.',
        '12:02 to 12:04, when the purchase happened. A stretch of time that one result is worked out over is called a window.',
        'Back-to-back windows of equal width that never overlap are called fixed windows, 120 seconds each here. Watch all nine events land in them.'
      ]
    },

    /* ---------- 4 · the correct totals ---------- */
    {
      title: 'Slice', layout: 'array',
      eyebrow: '04 · Watch the correct totals form',
      heading: 'By when it happened: 19, 11, 7 and 8',
      stand: 'Slots are the events in the order they were seen. Row 3: the window each belongs to, by event time.',
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
          { step: 2, do: 'pick', slots: seed.WINDOWS[120] }
        ]
      },
      cards: [
        { step: 2, title: 'Window 12:02 to 12:04', html: '<p>Ids 3 and 6, values 2 and 9: total <b>11</b>.[[src:hist]]</p>' },
        { step: 2, title: 'All four', html: '<p>From 12:00, 12:02, 12:04 and 12:08: <b>19, 11, 7 and 8</b>, which add up to 45. These are the right answers.[[src:hist]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen. The first row is when each happened, the second its value.',
        'Each event drops into the 2-minute window its event time falls in.',
        'The window from 12:02 holds ids 3 and 6, values 2 and 9: total 11. All four windows hold 19, 11, 7 and 8, adding up to 45. These are the correct answers.'
      ]
    },

    /* ---------- 5 · question: how to get both ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['batch', 'latency', 'Lambda architecture'],
      eyebrow: '05 · Your turn',
      heading: 'Correct but late, or fast but rough',
      stand: 'A job that reads a whole file once its input has ended is correct, but answers hours late. A program that answers as events arrive is fast, but can be rough. The shop wants both.',
      question: {
        step: 0,
        prompt: 'What is the most direct way to give the shop both?',
        options: [
          { text: 'Run both, showing the fast answer until the correct one lands.', correct: true,
            why: 'The shop sees a number at once, and it is replaced by the correct number as soon as the slow program finishes.' },
          { text: 'Run only the fast program, and treat its answers as final.', correct: false,
            why: 'Then the rough answers are never corrected, which gives up the correctness the shop asked for.' },
          { text: 'Run only the slow program, but run it much more often.', correct: false,
            why: 'It still answers only once its input has ended. Running it hourly is still not fast.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch and latency', html: '<p>A job over an input that ends is <b>batch</b> processing. The delay between an event and an answer that includes it is <b>latency</b>.[[src:hist]]</p>' },
        { step: 2, title: 'The Lambda architecture', html: '<p>Running a batch system and a fast system side by side, computing the same thing, is the <b>Lambda architecture</b>.[[src:flow]]</p>' }
      ],
      narration: [
        'Second question. A job that reads a whole file once it has ended is correct but late. A program that answers as events arrive is fast but rough. What is the most direct way to have both? Choose an answer.',
        'Run both side by side. A job over an input that ends is called batch processing. The delay between an event and an answer that includes it is called latency.',
        'Running a batch system and a fast system side by side, computing the same thing, is called the Lambda architecture. Here is its shape.'
      ]
    },

    /* ---------- 6 · the Lambda architecture ---------- */
    {
      title: 'Lamb', layout: 'graph', defines: ['batch layer', 'speed layer', 'serving layer'],
      eyebrow: '06 · The Lambda architecture',
      heading: 'Two layers computing the same sum, and one that merges them',
      stand: 'Every event goes to both layers. The shop’s screen reads only the serving layer.',
      graph: {
        viewBox: '0 0 1520 360', legend: false,
        nodes: [
          { id: 'ev', x: 20, y: 136, w: 240, h: 88, title: 'Events', sub: 'all 9 purchases', kind: 'main', step: 0 },
          { id: 'bat', x: 380, y: 20, w: 330, h: 104, title: 'Batch layer', sub: 're-reads all 9: slow, correct', kind: 'main', step: 0, src: 'why' },
          { id: 'spd', x: 380, y: 236, w: 330, h: 104, title: 'Speed layer', sub: 'works on arrivals: fast', kind: 'change', step: 1, src: 'why' },
          { id: 'srv', x: 830, y: 128, w: 330, h: 104, title: 'Serving layer', sub: 'prefers batch once it lands', kind: 'new', step: 2, src: 'why' },
          { id: 'rd', x: 1260, y: 136, w: 240, h: 88, title: 'Shop’s screen', sub: 'one number per window', kind: 'ext', step: 2 }
        ],
        edges: [
          { from: 'ev', to: 'bat', kind: 'main', step: 0 },
          { from: 'ev', to: 'spd', kind: 'change', step: 1 },
          { from: 'bat', to: 'srv', kind: 'main', step: 2 },
          { from: 'spd', to: 'srv', kind: 'change', step: 2 },
          { from: 'srv', to: 'rd', kind: 'new', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>The shape is sound:</b> it does deliver both low latency and, eventually, correct answers.[[src:walk]]' },
        { step: 3, html: '<b>The catch:</b> the same sum now exists twice, in two different systems.[[src:flow]]' },
        { step: 3, html: '<b>Who keeps them equal:</b> nothing mechanical. Only people, by care.[[src:walk]]' }
      ],
      narration: [
        'Here is the Lambda architecture. Every event goes to the batch layer, which re-reads all 9 events: slow, but correct.',
        'Every event also goes to the speed layer, which works on events as they arrive: fast, but only approximate.',
        'The serving layer merges the two. It shows the speed layer’s answer at first, and prefers the batch answer once it lands. The shop’s screen reads only the serving layer.',
        'The shape is sound: it really does deliver low latency and, eventually, correct answers. The catch: the same sum now exists twice, in two different systems.'
      ]
    },

    /* ---------- 7 · question: what it costs ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['codebase', 'drift'],
      eyebrow: '07 · Your turn',
      heading: 'Both layers compute the same sum. What does that cost?',
      stand: 'The batch layer runs on one system, the speed layer on another. Each has its own program for the same windowed sum.',
      question: {
        step: 0,
        prompt: 'What is the Lambda architecture’s real cost?',
        options: [
          { text: 'The same logic is written twice, and kept in agreement only by care.', correct: true,
            why: 'Nothing mechanical forces the two programs to stay the same. Every change must be made, and checked, twice.' },
          { text: 'The speed layer is too slow to keep up with the stream.', correct: false,
            why: 'The speed layer is the fast part. Its answers arrive within seconds; that is its whole job.' },
          { text: 'The batch layer drops every event that arrives after the file closes.', correct: false,
            why: 'The batch layer re-reads everything once the input ends, so late events are included.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two codebases', html: '<p>The body of program code one system runs is its <b>codebase</b>. Lambda has two for one sum, kept in step by discipline rather than by construction.[[src:why]]</p>' },
        { step: 2, title: 'Drift', html: '<p>When two copies of the same logic slowly come to compute different things, they <b>drift</b>. That duplication is Lambda’s core cost.[[src:flow]]</p>' }
      ],
      narration: [
        'Third question. The batch layer and the speed layer run on different systems, each with its own program for the same sum. What is the real cost? Choose an answer.',
        'The same logic written twice. The body of code one system runs is called its codebase, and Lambda has two codebases for one sum, kept in step only by care.',
        'When two copies of the same logic come to compute different things, they are said to drift. And that drift has a predictable direction.'
      ]
    },

    /* ---------- 8 · question: which clock each layer reaches for ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '08 · Your turn',
      heading: 'Two developers, two different contexts',
      stand: 'One developer writes the batch layer, holding the whole file. Another writes the speed layer, which sees events one by one as they arrive. Neither is careless.',
      question: {
        step: 0,
        prompt: 'Which clock does each developer most naturally bucket events by?',
        options: [
          { text: 'Batch by when it happened; speed by when it arrived.', correct: true,
            why: 'With the whole input in hand, event time is the obvious choice. A stream of arrivals makes arrival time the obvious choice.' },
          { text: 'Both by when it happened, because both read the same events.', correct: false,
            why: 'They read the same events in different contexts, and each context suggests a different clock.' },
          { text: 'Batch by when it arrived; speed by when it happened.', correct: false,
            why: 'The other way round: the file holds every event’s happened time; the speed layer is handed arrivals.' }
        ]
      },
      narration: [
        'Fourth question. One developer writes the batch layer, holding the whole file. Another writes the speed layer, which sees arrivals one by one. Which clock does each naturally use? Choose an answer.',
        'The batch layer buckets by when events happened; the speed layer by when they arrived. Each is the obvious choice in its own context. Watch what that does to the two answers.'
      ]
    },

    /* ---------- 9 · the drift, animated ---------- */
    {
      title: 'Drift', layout: 'array',
      eyebrow: '09 · Watch the two layers compared',
      heading: '3 of 4 windows disagree, by 26, with no bug in either',
      stand: 'Each slot is one window. Row 2: the batch layer’s total, by event time. Row 3: the speed layer’s, by arrival.',
      array: {
        labelWidth: 170, slotLabel: 'window',
        rows: [
          { label: 'window from', values: seed.WIN_STARTS.map(hm) },
          { label: 'batch layer', values: BY_ET },
          { label: 'speed layer', values: BY_PT },
          { label: 'agree?', values: AGREE }
        ],
        meters: ['windows compared', 'windows that disagree'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 2, title: '26 apart', html: '<p>12:00 is 19 against 15, because id 7 arrived late. 12:02 is 11 against 2, and 12:04 is 7 against 20. <b>26</b> apart in total.[[src:why]]</p>' },
        { step: 3, title: 'Both defensible', html: '<p>Each layer is internally consistent, and neither has a bug. The serving layer must choose between them.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the four windows. The batch layer, by event time, gives 19, 11, 7 and 8. The speed layer, by arrival, gives 15, 2, 20 and 8.',
        'Watch each window compared. 12:00 disagrees, 12:02 disagrees, 12:04 disagrees. Only 12:08 agrees. Three windows out of four.',
        'At 12:00 it is 19 against 15, because id 7 arrived late. Across the three windows, the layers are 26 apart in total.',
        'And neither layer has a bug. Each is internally consistent and each could be defended. That is why reviewing the two for equality is not enough.'
      ]
    },

    /* ---------- 10 · a bug, animated ---------- */
    {
      title: 'Bug', layout: 'array',
      eyebrow: '10 · Watch a bug enter the sum',
      heading: 'A bug halves every value from phone a',
      stand: 'The events from phone a, in the order they were seen. The bug halves each value and rounds down.',
      array: {
        labelWidth: 170, slotLabel: 'slot',
        rows: [
          { label: 'event id', values: A.map(e => e.id) },
          { label: 'true value', values: A.map(e => e.v) },
          { label: 'with the bug', values: A.map(buggy) }
        ],
        meters: ['events read', 'phone a’s total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 2, title: 'Wrong totals', html: '<p>Phone a reads <b>11</b> instead of 24, so the grand total reads <b>32</b> instead of 45. Phone b’s 21 is untouched.[[src:why]]</p>' }
      ],
      narration: [
        'Now a bug ships. Here are phone a’s five events, with their true values 5, 3, 2, 6 and 8, which add up to 24.',
        'The bug halves each value and rounds down: 5 becomes 2, 3 becomes 1, 2 becomes 1, 6 becomes 3, and 8 becomes 4. Watch the wrong total build: 11.',
        'So phone a reads 11 instead of 24, and the grand total reads 32 instead of 45. Phone b’s 21 is untouched. The bug is found. Where must the fix go?'
      ]
    },

    /* ---------- 11 · question: how many fix sites ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: 'Fixing the bug under Lambda',
      stand: 'The halving bug is in the sum. Under the Lambda architecture, the sum exists in the batch layer and in the speed layer.',
      question: {
        step: 0,
        prompt: 'In how many places must the fix land, and be checked?',
        options: [
          { text: '2: once in each layer, in two different systems.', correct: true,
            why: 'Each layer has its own copy of the sum, so each needs the fix, and each fix must be verified separately.' },
          { text: '1: fix the batch layer, and the serving layer prefers it.', correct: false,
            why: 'The serving layer shows the speed layer’s answer first, so the screen stays wrong until each batch run lands.' },
          { text: '3: one per layer, the serving layer included.', correct: false,
            why: 'The serving layer only merges answers; it holds no copy of the sum, so there is nothing to fix there.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two fix sites', html: '<p>Under Lambda the fix lands in <b>2</b> places, and both must be verified. Forget one, and the layers now disagree by design.[[src:why]]</p>' }
      ],
      narration: [
        'Fifth question. The halving bug is in the sum, and under Lambda the sum lives in two layers. In how many places must the fix land, and be checked? Choose an answer.',
        'Two, once in each layer, in two different systems. And both fixes must be verified. Apply it to one and not the other, and the layers disagree by design.'
      ]
    },

    /* ---------- 12 · question: the Kappa idea ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['log', 'offset', 'replay', 'Kappa architecture'],
      eyebrow: '12 · Your turn',
      heading: 'What if there were only one pipeline?',
      stand: 'Suppose the batch layer is removed and only the fast pipeline remains. After the fix, the old totals of 11 and 32 are still wrong.',
      question: {
        step: 0,
        prompt: 'How can a single fast pipeline recompute the past after the fix?',
        options: [
          { text: 'Keep every event, and feed them all again through the fixed code.', correct: true,
            why: 'If the events are kept, re-reading them from the start through corrected code rebuilds every total correctly.' },
          { text: 'Ask both phones to send every past purchase over again.', correct: false,
            why: 'The phones are not a store of history. The pipeline must keep its own copy of what it was sent.' },
          { text: 'Patch the old totals by hand, using a formula for halving.', correct: false,
            why: 'Halving and rounding down loses information: 1 could have come from 2 or from 3. Only the events can say.' }
        ]
      },
      cards: [
        { step: 1, title: 'A log, and offsets', html: '<p>A store that keeps every event, in order, and lets them be read again is a <b>log</b>. Each event’s position in it, 0 to 8, is its <b>offset</b>.[[src:flow]]</p>' },
        { step: 2, title: 'Replay, and Kappa', html: '<p>Reading the log again from the start through new code is a <b>replay</b>. One pipeline plus replay is the <b>Kappa architecture</b>.[[src:flow]]</p>' }
      ],
      narration: [
        'Sixth question. Suppose only the fast pipeline remains. After the fix, the old totals of 11 and 32 are still wrong. How can it recompute the past? Choose an answer.',
        'Keep every event, in order, and feed them all again. A store that keeps every event in order, and lets them be read again, is called a log. Each event’s position in it, 0 to 8, is its offset.',
        'Reading the log again from the start through new code is called a replay. One pipeline plus replay is called the Kappa architecture. Watch the replay run.'
      ]
    },

    /* ---------- 13 · the replay, animated ---------- */
    {
      title: 'Redo', layout: 'array',
      eyebrow: '13 · Watch the log replayed through the fixed code',
      heading: 'One edit, 9 events re-read, 45 restored',
      stand: 'Each slot is one event in the log, by offset. Row 2: what the buggy code made of it. Row 3: what the fixed code makes of it.',
      array: {
        labelWidth: 170, slotLabel: 'offset',
        rows: [
          { label: 'phone', values: E.map(e => e.key) },
          { label: 'buggy code', values: E.map(buggy) },
          { label: 'fixed code', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'old total', 'replayed total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 2, speed: 350 }
        ]
      },
      cards: [
        { step: 2, title: 'One fix site', html: '<p>The fix lands in <b>1</b> place. Replaying 9 events takes phone a from 11 to <b>24</b> and the total from 32 to <b>45</b>.[[src:why]]</p>' },
        { step: 2, title: 'Not cheaper to write', html: '<p>Kappa does not make the fix easier to write. It makes it <b>impossible to apply inconsistently</b>: there is only one place.[[src:why]]</p>' }
      ],
      narration: [
        'Here is the log: nine events by offset, 0 to 8. Watch the old, buggy code’s values add up: the total reaches 32.',
        'Now the fixed code replays the same log from offset 0. Watch the replayed total climb: it reaches 45.',
        'One edit, in one place, and 9 events re-read: phone a goes from 11 to 24. Kappa does not make the fix easier to write. It makes it impossible to apply inconsistently.'
      ]
    },

    /* ---------- 14 · the Kappa architecture ---------- */
    {
      title: 'Kappa', layout: 'graph',
      eyebrow: '14 · The Kappa architecture',
      heading: 'One pipeline, and replay instead of a second layer',
      stand: 'The pipeline appears twice, and it is the same code both times.',
      graph: {
        viewBox: '0 0 1520 360', legend: false,
        nodes: [
          { id: 'log', x: 20, y: 128, w: 280, h: 104, title: 'Log', sub: 'all 9 events, offsets 0 to 8', kind: 'hub', step: 0, src: 'flow' },
          { id: 'p1', x: 470, y: 20, w: 340, h: 104, title: 'The one pipeline', sub: 'reads new events live', kind: 'main', step: 0 },
          { id: 'p2', x: 470, y: 236, w: 340, h: 104, title: 'The same pipeline, fixed', sub: 'replays from offset 0', kind: 'new', step: 1, src: 'why' },
          { id: 'live', x: 1080, y: 20, w: 400, h: 104, title: 'Live result', sub: 'fast; wrong until a replay', kind: 'main', step: 0 },
          { id: 'fix', x: 1080, y: 236, w: 400, h: 104, title: 'Corrected result', sub: 'phone a 24, total 45', kind: 'new', step: 1 }
        ],
        edges: [
          { from: 'log', to: 'p1', kind: 'main', step: 0 },
          { from: 'p1', to: 'live', kind: 'main', step: 0 },
          { from: 'log', to: 'p2', kind: 'new', step: 1, label: 'rewind', dx: 10, dy: 4, labelAnchor: 'start' },
          { from: 'p2', to: 'fix', kind: 'new', step: 1 },
          { from: 'fix', to: 'live', kind: 'change', step: 2, label: 'replaces', dx: 12, dy: 4, labelAnchor: 'start' }
        ]
      },
      notes: [
        { step: 3, html: '<b>No second codebase:</b> there is no batch layer to drift from.[[src:flow]]' },
        { step: 3, html: '<b>The price:</b> keeping the log, and the time a replay takes.[[src:why]]' },
        { step: 3, html: '<b>The asset:</b> the pipeline can be thrown away and rebuilt; the log cannot.[[src:prog]]' }
      ],
      narration: [
        'Here is the Kappa architecture. The log holds every event. The one pipeline reads new events from it and keeps the live result up to date.',
        'When the code changes, the same pipeline, fixed, rewinds the log to offset 0 and replays all 9 events into a corrected result.',
        'The corrected result then replaces the live one. Phone a reads 24, and the total 45.',
        'There is no second codebase, so there is nothing to drift. The price moves elsewhere: the log must be kept, and a replay takes time.'
      ]
    },

    /* ---------- 15 · question: retention ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['retention'],
      eyebrow: '15 · Your turn',
      heading: 'What if the log forgets?',
      stand: 'To save space, the log keeps only the newest 6 events: offsets 3 to 8. The first three are deleted. Then the fix is replayed.',
      question: {
        step: 0,
        prompt: 'What does the replay report?',
        options: [
          { text: 'A total of 30, with no error at all.', correct: true,
            why: 'It adds 2, 6, 1, 9, 4 and 8, which is all it can see. Nothing tells it three events are missing.' },
          { text: 'The true total of 45, because the code is fixed.', correct: false,
            why: 'Fixed code over 6 events cannot know the 3 deleted values 5, 3 and 7.' },
          { text: 'An error saying 3 events are missing.', correct: false,
            why: 'A log does not know what it used to hold. The replay simply reads what is there.' }
        ]
      },
      cards: [
        { step: 1, title: 'Retention', html: '<p>How long the log keeps events before deleting them is its <b>retention</b>. Replay works only as far back as retention.[[src:sys]]</p>' },
        { step: 2, title: 'It expires silently', html: '<p>Set 7 days and “we can always reprocess” becomes “we can reprocess 7 days”, with nothing in the running system announcing it.[[src:when]]</p>' }
      ],
      narration: [
        'Seventh question. To save space, the log keeps only the newest 6 events, offsets 3 to 8. Then the fix is replayed. What does the replay report? Choose an answer.',
        'A total of 30, and no error. How long a log keeps events before deleting them is called its retention, and replay works only as far back as retention reaches.',
        'And this assumption expires silently. Set retention to 7 days, and “we can always reprocess” quietly becomes “we can reprocess 7 days”.'
      ]
    },

    /* ---------- 16 · question: determinism ---------- */
    {
      title: 'Q8', layout: 'ask', defines: ['deterministic'],
      eyebrow: '16 · Your turn',
      heading: 'The same log, a different answer?',
      stand: 'All 9 events are kept. But the pipeline also looks at the computer’s clock while it adds, for example to skip “old” events.',
      question: {
        step: 0,
        prompt: 'Will replaying all 9 events through it always give 45?',
        options: [
          { text: 'Not necessarily: its result depends on more than the log.', correct: true,
            why: 'Run on another day, the clock reads differently, so the same events can be treated differently. The log cannot reveal that.' },
          { text: 'Yes: all 9 events are kept, so it must give 45.', correct: false,
            why: 'A complete log is necessary but not enough. The pipeline must also depend on nothing outside it.' },
          { text: 'No: like the short log, it will always give 30.', correct: false,
            why: '30 came from deleted events. Here nothing is deleted; the danger is that the answer is not repeatable.' }
        ]
      },
      cards: [
        { step: 1, title: 'Deterministic', html: '<p>A pipeline whose output depends only on its input, so the same log always gives the same result, is <b>deterministic</b>. Reading the clock, a random number or a changing lookup table breaks it.[[src:when]]</p>' },
        { step: 2, title: 'Assert it in a test', html: '<p>Nothing about the log will tell you. Check that a replay reproduces 45 before trusting one.[[src:when]]</p>' }
      ],
      narration: [
        'Eighth question. All 9 events are kept, but the pipeline also reads the computer’s clock while it adds. Will a replay always give 45? Choose an answer.',
        'Not necessarily. A pipeline whose output depends only on its input is called deterministic. Reading the clock, a random number or a changing lookup table breaks that.',
        'And nothing about the log will tell you, because it is the pipeline that has stopped being a function of its input. So assert it in a test.'
      ]
    },

    /* ---------- 17 · when to pick each ---------- */
    {
      title: 'Pick', layout: 'table',
      eyebrow: '17 · When to pick each',
      heading: 'Lambda pays in drift. Kappa pays in retention and replay time.',
      stand: 'Neither is free. What matters is which cost you can budget for.',
      table: {
        columns: ['Situation', 'Choice', 'Why'],
        rows: [
          { step: 0, cells: ['The input is already kept in a log', '<b>Kappa</b>', 'The second layer is pure cost; one codebase is free.[[src:when]]'] },
          { step: 1, cells: ['A batch system already works, and the fast layer is deliberately rough', '<b>Lambda</b>', 'The duplication is chosen, not accidental.[[src:when]]'] },
          { step: 2, cells: ['Lambda, kept equal by code review', '<b>Never</b>', 'The drift needs no mistake: 3 wrong windows that both teams can defend.[[src:when]]'] },
          { step: 3, cells: ['Kappa, in any case', '<b>Test it</b>', 'Assert determinism; treat retention as the limit of what can be redone.[[src:when]]'] }
        ]
      },
      narration: [
        'When to pick each? Pick Kappa when the input is already kept in a log. Then the second layer is pure cost, and one codebase is free.',
        'Pick Lambda when a batch system already works and the fast layer is deliberately a rough estimate. Then the duplication is chosen, not accidental.',
        'Never pick Lambda and then try to keep the layers equal by review. The drift needs no mistake: it gave 3 wrong windows that both teams could defend.',
        'And with Kappa, test its two assumptions: that the pipeline is deterministic, and that retention reaches back as far as you will need.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you now know',
      heading: 'Two fix sites or one, and what each one assumes',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Lambda</b>', 'A batch layer and a speed layer compute the same sum; a serving layer merges them.[[src:flow]]'] },
          { step: 0, cells: ['<b>Its cost</b>', 'Two codebases that drift: 3 of 4 windows apart by 26, with no bug. A fix lands in 2 places.[[src:why]]'] },
          { step: 1, cells: ['<b>Kappa</b>', 'One pipeline and a log. A fix lands in 1 place; replaying 9 events restores 24 and 45.[[src:why]]'] },
          { step: 2, cells: ['<b>Its assumptions</b>', 'Retention: keep 6 of 9 and the replay says 30, silently. Determinism: no clock, no randomness.[[src:sys]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>If one pipeline can do the batch layer’s job by replay, is batch just a special case of streaming? Part 3 follows that idea to its end, and finds the one thing it cannot change.[[src:ch]]</p>' },
      narration: [
        'To recap. The Lambda architecture runs a batch layer and a speed layer computing the same sum, and a serving layer merges them.',
        'Its cost is two codebases that drift: 3 of 4 windows apart by 26, with no bug in either, and every fix landing in 2 places.',
        'The Kappa architecture keeps a log and one pipeline. A fix lands in 1 place, and replaying 9 events restores 24 and 45. It assumes retention long enough, and a deterministic pipeline.',
        'Next, part 3 asks whether batch is just a special case of streaming, and finds the one thing that unification cannot change.'
      ]
    }
  ]
};
