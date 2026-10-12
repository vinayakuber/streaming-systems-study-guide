// Chapter 5, Part 8 — the chapter's "System Design Interview": a payment pipeline that charges
// a card exactly once, built one component at a time. Each component is preceded by a
// question; the seen-set's life across a crash is animated, the five-step crash-and-retry is
// drawn as a sequence, the design is assembled as a graph, and the deck closes with the four
// things the design does NOT settle. The story and every word are re-introduced, so the deck
// stands alone. The record, the charge and the coverage counts come from the seed.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch05';
const E = seed.EVENTS;
const ORDER = E.find(e => e.id === 4);
const SEEN_BEFORE = E.filter(e => e.id < ORDER.id).map(e => e.id);
// the crash and retry, as the chapter traces it: pass 1 charges, the crash empties the seen-set
// and keeps the offset, pass 2 re-reads the record and only the key stops the second charge
const run = useKey => {
  const keys = new Set(); let charged = 0, sends = 0;
  const charge = () => { const k = useKey ? `order-${ORDER.id}` : `send-${++sends}`; if (keys.has(k)) return; keys.add(k); charged += ORDER.v; };
  let seen = new Set(SEEN_BEFORE);
  if (!seen.has(ORDER.id)) { seen.add(ORDER.id); charge(); }
  seen = new Set();                                    // the crash: the seen-set was in memory
  if (!seen.has(ORDER.id)) { seen.add(ORDER.id); charge(); }
  return charged;
};

if (ORDER.v !== 6 || SEEN_BEFORE.join() !== '0,1,2,3' || run(true) !== 6 || run(false) !== 12)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Exactly-Once Payments',
  eyebrow: 'Streaming · Ch 5 · Part 8',
  ...shared,
  jargon: ['event', 'record', 'pipeline', 'stage', 'crash', 'retry', 'timeout', 'record id', 'source', 'offset',
    'replayable', 'shuffle', 'seen-set', 'sink', 'payment processor', 'idempotency key', 'two-phase commit', 'horizon', 'retention'],
  sources: {
    ch:     chapter(CH, 'Chapter 5 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 5 · system design interview'),
    src:    section(CH, 'replayable source (offset)', 'Chapter 5 · replayable source'),
    shuf:   section(CH, 'dedup shuffle', 'Chapter 5 · dedup shuffle'),
    sink:   section(CH, 'idempotent sink (idempotency key)', 'Chapter 5 · idempotent sink'),
    ext:    section(CH, 'external system', 'Chapter 5 · external system'),
    sdwhy:  section(CH, 'Why the decisive fact lives outside the pipeline', 'Chapter 5 · why the decisive fact lives outside'),
    sdwhen: section(CH, 'When this design works, and the four things it does not settle', 'Chapter 5 · what this design does not settle'),
    sdprog: section(CH, 'The payment pipeline — stack and heap at every step', 'Chapter 5 · the payment pipeline, traced'),
    effects: section(CH, 'Why the outside world cannot be recomputed, and what follows from that', 'Chapter 5 · three crash windows')
  },

  slides: [
    /* ---------- 1 · the brief ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'record', 'pipeline', 'stage', 'crash', 'retry', 'timeout'],
      eyebrow: '01 · Chapter 5 · Part 8 · a system design interview',
      heading: 'Charge each order once, even when everything crashes',
      hero: { step: 0, text: 'A shop’s orders arrive as a stream of <b>events</b>; each is stored as a <b>record</b>. A <b>pipeline</b> — a chain of steps called <b>stages</b>, each on its own machine — reads them and charges the customer’s card. Machines <b>crash</b>, and replies are slow to come back: giving up on one is a <b>timeout</b>. Either way the work is sent again: a <b>retry</b>.[[src:sd]]' },
      tiles: [
        { step: 1, value: ORDER.v, label: 'the charge for order 4[[src:src]]' },
        { step: 1, value: 12, label: 'charged if a retry repeats it[[src:sdprog]]' },
        { step: 2, value: 4, label: 'stages in the design[[src:sd]]' },
        { step: 2, value: 5, label: 'steps in the crash-and-retry trace[[src:sdwhy]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'How to get lost records back', text: 'After a crash, re-read from a saved place.' },
        { step: 3, n: 2, title: 'How to drop records that arrive twice', text: 'Cheaply, inside the pipeline.' },
        { step: 4, n: 3, title: 'Who decides whether order 4 was charged', text: 'The one place that saw the first charge.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the design is traced through a crash, and closed with what it does not settle.[[src:sd]]' },
      narration: [
        'A shop’s orders arrive as a stream of events, each stored as a record. A pipeline of programs on several machines reads them and charges the customer’s card. Machines crash, replies time out, and either way the work is sent again: a retry.',
        'The interviewer’s question: design a payment pipeline that charges a card exactly once. Order 4 is a charge of 6. A retry must never turn that into 12.',
        'The design the chapter arrives at has 4 stages, and we will trace it through a crash in 5 steps.',
        'It must decide three things: how to get lost records back after a crash, and how to drop records that arrive twice.',
        'And who decides whether order 4 was already charged. You will be asked to choose before each component.'
      ]
    },

    /* ---------- 2 · the records ---------- */
    {
      title: 'Data', layout: 'array', defines: ['record id'],
      eyebrow: '02 · The records, and the one this design follows',
      heading: 'Nine records, numbered in order',
      stand: 'Each column is one record. Record 4 is order 4: charge 6.',
      array: {
        labelWidth: 150, slotLabel: 'record id',
        rows: [ { label: 'value', values: E.map(e => e.v) }, { label: 'meaning', values: E.map(e => (e.id === ORDER.id ? 'order-4' : '·')) } ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'pick', slots: [ORDER.id] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A record id', html: '<p>Each record carries its own number, its <b>record id</b>, which stays the same on every retry. The record this design follows is <code>{id: 4, order: "order-4", amount: 6}</code>.[[src:src]]</p>' },
        { step: 2, title: 'Stages', html: '<p>The pipeline is a chain of <b>stages</b>, each a machine doing one step and handing records to the next.[[src:sd]]</p>' }
      ],
      narration: [
        'Here are the records, one per column, numbered 0 to 8 in the order they arrive.',
        'Each carries its own number, its record id, which stays the same on every retry. Record 4 is the one this design follows: order 4, charge 6.',
        'The pipeline is a chain of stages. Each stage is a machine doing one step and handing records on to the next. Now design the stages, one at a time.'
      ]
    },

    /* ---------- 3 · component 1: the source ---------- */
    {
      title: 'Src', layout: 'ask', defines: ['source', 'offset', 'replayable'],
      eyebrow: '03 · Your turn · component 1, the replayable source',
      heading: 'After a crash, where do lost records come from?',
      stand: 'The first stage reads records from where the shop puts them. A crash may lose records the later stages had not finished with.',
      question: {
        step: 0,
        prompt: 'What must the first stage be able to do after a crash?',
        options: [
          { text: 'Read again from a saved position, so nothing is lost.', correct: true,
            why: 'Records are re-read from the last saved place onwards. Nothing that was not finished can be lost.' },
          { text: 'Start reading only new records, from now on.', correct: false,
            why: 'Then everything in flight at the crash is lost for good, and nothing downstream can bring it back.' },
          { text: 'Ask the customers to resend their orders.', correct: false,
            why: 'The pipeline must recover by itself. Customers do not know a crash happened.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Source, offset, replayable', html: '<p>The first stage is the <b>source</b>. Its saved reading position is the <b>offset</b>; a source that can read again from any saved offset is <b>replayable</b>.[[src:src]]</p>' },
        { step: 2, title: 'No substitute', html: '<p>Every later guard can only stop a record counting twice. None can bring back one that was never re-read. Completeness starts here.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Component one. The first stage reads the shop’s records, and a crash may lose records not yet finished. What must it be able to do after a crash? Choose an answer.',
        'Read again from a saved position. The first stage is called the source, its saved reading position is the offset, and a source that can read again from a saved offset is replayable.',
        'It has no substitute. Every later guard can only stop a record counting twice. None can bring back a record that was never re-read.'
      ]
    },

    /* ---------- 4 · component 2: the dedup shuffle ---------- */
    {
      title: 'Shuf', layout: 'ask', defines: ['shuffle', 'seen-set'],
      eyebrow: '04 · Your turn · component 2, the dedup shuffle',
      heading: 'Replay means some records arrive twice',
      stand: 'Re-reading from the offset re-sends records that may already have been handled. The next stage receives them.',
      question: {
        step: 0,
        prompt: 'How can the receiving stage drop a record it has already handled?',
        options: [
          { text: 'Keep the ids it has accepted, and drop any id already there.', correct: true,
            why: 'It holds 0, 1, 2 and 3; record 4 is added on first arrival, and a second record 4 is dropped.' },
          { text: 'Drop any record whose amount matches the one before.', correct: false,
            why: 'Amounts say nothing about identity. Two different orders can cost the same.' },
          { text: 'Accept everything, and let the card company sort it out.', correct: false,
            why: 'That is a design, but not this component. This one is meant to stop repeats cheaply, inside the pipeline.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The shuffle and its seen-set', html: '<p>The hand-over between stages is the <b>shuffle</b>. The ids it has accepted form its <b>seen-set</b>: <code>{0, 1, 2, 3}</code>, then <code>{0, 1, 2, 3, 4}</code>.[[src:shuf]]</p>' },
        { step: 2, title: 'Only while it is alive', html: '<p>A repeat of 4 is dropped only while the receiving machine is running. A crash empties the seen-set, so the replayed 4 gets through.[[src:shuf]]</p>' }
      ],
      narration: [
        'Component two. Re-reading from the offset re-sends records that may already have been handled. How can the receiving stage drop one it has already handled? Choose an answer.',
        'Keep the ids it has accepted. The hand-over between stages is called the shuffle, and the ids it has accepted form its seen-set: 0, 1, 2 and 3, and then 4.',
        'But the seen-set lives in the machine’s memory. A repeat of 4 is dropped only while that machine is running. Watch what a crash does to it.'
      ]
    },

    /* ---------- 5 · the seen-set across a crash, animated ---------- */
    {
      title: 'Life', layout: 'array',
      eyebrow: '05 · Watch the seen-set across a crash',
      heading: 'The offset survives the crash. The seen-set does not.',
      stand: 'Four moments in the life of record 4 at the shuffle.',
      array: {
        labelWidth: 200, slots: false,
        rows: [
          { label: 'moment', values: ['record 4 arrives', 'retry, shuffle alive', 'the crash', 'replay of record 4'] },
          { label: 'seen-set holds 4?', values: ['no', 'yes', 'emptied', 'no'] },
          { label: 'passes the shuffle?', values: ['yes', 'no', '—', 'yes'] }
        ],
        meters: ['moments', 'times record 4 got through'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 600 },
          { step: 2, do: 'pick', slots: [3] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Twice through', html: '<p>First arrival: admitted. A retry while the shuffle lives: dropped. After the crash: the seen-set is empty, so the replay is admitted again.[[src:sdprog]]</p>' },
        { step: 2, title: 'Durable versus in memory', html: '<p>The offset was saved, so it survives; the seen-set was in memory, so it does not. The replay re-reads record 4 <b>and</b> the shuffle thinks it is new.[[src:sdprog]]</p>' }
      ],
      narration: [
        'Here is record 4 at the shuffle, at four moments. It arrives; a retry arrives while the shuffle is alive; the machine crashes; and the replay arrives.',
        'Watch which copies get through. The first arrival, yes. The retry while the shuffle lives, no. And after the crash, the seen-set is empty, so the replay gets through again.',
        'That is the whole scenario. The offset was saved, so it survives the crash. The seen-set was in memory, so it does not. The guard is gone exactly when it is needed.'
      ]
    },

    /* ---------- 6 · component 3: the sink ---------- */
    {
      title: 'Sink', layout: 'ask', defines: ['sink', 'payment processor', 'idempotency key'],
      eyebrow: '06 · Your turn · component 3, the idempotent sink',
      heading: 'The last stage calls the card company',
      stand: 'The last stage sends “charge 6” to the company that moves the money. A replayed record 4 may make it send that twice.',
      question: {
        step: 0,
        prompt: 'What should the last stage send with each charge, so that a repeat is harmless?',
        options: [
          { text: 'A fixed name taken from the order itself: “order-4”.', correct: true,
            why: 'Both attempts carry the same name, so the card company can see the second is a repeat.' },
          { text: 'A fresh number made up at the moment of sending.', correct: false,
            why: 'Then the retry carries a different number and looks like a new charge: 12.' },
          { text: 'Nothing extra: the amount identifies the charge.', correct: false,
            why: 'Two different orders can both cost 6. The amount says nothing about which order it is.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'The sink', html: '<p>The last stage, which sends results out of the pipeline, is the <b>sink</b>.[[src:sink]]</p>' },
        { step: 1, title: 'The payment processor', html: '<p>The company that actually moves the money is the <b>payment processor</b>.[[src:ext]]</p>' },
        { step: 2, title: 'An idempotency key', html: '<p>The fixed name, <code>order-4</code>, is an <b>idempotency key</b>. A retry with the same key does nothing new.[[src:sink]]</p>' }
      ],
      narration: [
        'Component three. The last stage sends charge 6 to the company that moves the money, and a replayed record may make it send that twice. What should it send with each charge? Choose an answer.',
        'A fixed name taken from the order itself. The last stage is called the sink, and the company that moves the money is the payment processor.',
        'The fixed name, order 4, is called an idempotency key. A retry carrying the same key does nothing new.'
      ]
    },

    /* ---------- 7 · component 4: the external system ---------- */
    {
      title: 'Ext', layout: 'ask',
      eyebrow: '07 · Your turn · component 4, the external system',
      heading: 'Where does the decisive fact live?',
      stand: 'The crash wiped the seen-set and the sink’s memory. Something must still know whether order 4 was charged.',
      question: {
        step: 0,
        prompt: 'Which part of the system knows for certain whether order 4 was already charged?',
        options: [
          { text: 'The payment processor, which remembers the keys it has charged.', correct: true,
            why: 'It saw the first charge, and its records lie outside the crashed machines.' },
          { text: 'The shuffle, through its seen-set.', correct: false,
            why: 'The seen-set was in memory and died in the crash.' },
          { text: 'The source, through its offset.', correct: false,
            why: 'The offset says where to re-read from. It knows nothing about charges.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The decisive fact is outside', html: '<p>Whether order 4 was charged is known only by the processor. Everything in the first three stages is an attempt not to have to ask; the key actually asks.[[src:sdwhy]]</p>' },
        { step: 2, title: 'New key or seen key', html: '<p>A new key charges once. A seen key returns the earlier result. Without a key, two attempts would bill twice.[[src:ext]]</p>' }
      ],
      narration: [
        'Component four. The crash wiped the seen-set. Which part of the system knows for certain whether order 4 was already charged? Choose an answer.',
        'The payment processor. It saw the first charge, and its records are outside the crashed machines. Everything in the first three stages is an attempt not to have to ask it. The key actually asks.',
        'A new key charges once. A key it has seen returns the earlier result. Without a key, two attempts would bill twice.'
      ]
    },

    /* ---------- 8 · the trace ---------- */
    {
      title: 'Trace', layout: 'sequence',
      eyebrow: '08 · The crash and the retry, step by step',
      heading: 'Five steps, one charge',
      stand: 'Time runs top to bottom. The design is run through the crash the interviewer described.',
      sequence: {
        actors: [
          { name: 'Source', sub: 'offset saved at 4' },
          { name: 'Shuffle', sub: 'seen-set' },
          { name: 'Sink', sub: 'sends the key' },
          { name: 'Payment processor', sub: 'remembers keys', highlight: true, src: 'ext' }
        ],
        messages: [
          { from: 'Source', to: 'Shuffle', label: 'record 4 · seen-set gains 4', step: 0 },
          { from: 'Shuffle', to: 'Sink', label: 'record 4', step: 0 },
          { from: 'Sink', to: 'Payment processor', label: 'charge 6, key order-4 · charged 6', step: 1 },
          { from: 'Payment processor', to: 'Sink', label: 'reply lost: crash before the offset is saved', step: 2 },
          { from: 'Source', to: 'Shuffle', label: 'replay: record 4 · seen-set empty, looks new', step: 3 },
          { from: 'Shuffle', to: 'Sink', label: 'record 4 again', step: 3 },
          { from: 'Sink', to: 'Payment processor', label: 'charge 6, key order-4 · key seen, no charge', step: 4 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Total charged: 6, not 12.</b>[[src:sdwhy]]' },
        { step: 4, html: '<b>The replay</b> is where the seen-set fails: it died with the process.[[src:sdwhy]]' }
      ],
      narration: [
        'Step 1. The source sends record 4. It passes the shuffle, and the seen-set gains id 4.',
        'Step 2. The sink asks the processor to charge 6 with the key order 4. The processor charges 6 and records the key.',
        'Step 3. The pipeline crashes before saving its offset past record 4. The charge happened; the pipeline does not know.',
        'Step 4. The replay re-reads record 4 from the old offset. The seen-set died with the process, so record 4 looks new, and it goes through.',
        'Step 5. The sink sends the same charge with the same key. The processor recognises order 4 and does not charge. Total charged: 6, not 12.'
      ]
    },

    /* ---------- 9 · question: without the key ---------- */
    {
      title: 'NoKey', layout: 'ask',
      eyebrow: '09 · Your turn · remove one component',
      heading: 'The same run, without the key',
      stand: 'Identical pipeline, identical crash. The only change: the sink sends no key, so the processor cannot recognise a repeat.',
      question: {
        step: 0,
        prompt: 'What is the card charged at the end of the same five steps?',
        options: [
          { text: '12: step 5 becomes a full second charge.', correct: true,
            why: 'The seen-set already failed at step 4, and nothing else stands between the replay and the money.' },
          { text: '6: the seen-set catches the replay.', correct: false,
            why: 'The seen-set was emptied by the crash. That is exactly what step 4 showed.' },
          { text: '0: the crash cancels the first charge.', correct: false,
            why: 'The crash is inside the pipeline. The first charge at the processor stands.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The key is the mechanism', html: '<p>With it: <b>' + run(true) + '</b>. Without it: <b>' + run(false) + '</b>. The only difference is whether the processor remembered the key across the crash.[[src:sdprog]]</p>' },
        { step: 2, title: 'The seen-set is an optimisation', html: '<p>Keep it anyway: it is cheap, it covers a re-send while the shuffle is up, and it spares the processor load. But it covers 1 of the 3 crash windows; the key covers 3.[[src:effects]]</p>' }
      ],
      narration: [
        'Remove one component. The same pipeline, the same crash, but the sink sends no key. What is the card charged? Choose an answer.',
        'Twelve. With the key, 6; without it, 12. The only difference is whether the processor remembered the key across the crash. So the key is the mechanism.',
        'The seen-set is an optimisation. Keep it: it is cheap, it catches a re-send while the shuffle is up, and it spares the processor. But it covers 1 of the 3 crash windows, and the key covers 3.'
      ]
    },

    /* ---------- 10 · question: two-phase commit ---------- */
    {
      title: 'TwoPC', layout: 'ask', defines: ['two-phase commit'],
      eyebrow: '10 · Your turn · the alternative',
      heading: 'What if the processor offered no key?',
      stand: 'Another design: a coordinator first asks the pipeline and the processor to get ready, then tells both to go ahead. It reaches exactly once without a key.',
      question: {
        step: 0,
        prompt: 'The coordinator dies after both sides said “ready”. What should the processor do?',
        options: [
          { text: 'Nothing is safe: charging may double, cancelling may lose a real payment.', correct: true,
            why: 'It cannot know what the coordinator decided. There is no safe default, so a person must resolve it.' },
          { text: 'Charge, because it said it was ready.', correct: false,
            why: 'Ready is not go. If the coordinator had decided to cancel, the charge is wrong.' },
          { text: 'Cancel, because it never heard “go”.', correct: false,
            why: 'The coordinator may have told the pipeline “go” before dying. Cancelling then loses a real payment.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two-phase commit', html: '<p>“Get ready”, then “go”, run by a coordinator, is a <b>two-phase commit</b>. It costs a coordinator that everything waits on.[[src:sdwhy]]</p>' },
        { step: 2, title: 'Prefer the key', html: '<p>Its in-doubt state — ready, coordinator dead — has no safe resolution. Prefer the key whenever the choice exists.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'What if the processor offered no key? A coordinator could ask both sides to get ready, then tell both to go. It dies after both said ready. What should the processor do? Choose an answer.',
        'Nothing is safe. Charging may double; cancelling may lose a real payment. Get ready, then go, is called a two-phase commit, and everything waits on its coordinator.',
        'Its in-doubt state has no safe resolution, so a person must step in. That is why the key is preferred whenever the choice exists.'
      ]
    },

    /* ---------- 11 · the design, assembled ---------- */
    {
      title: 'Design', layout: 'graph',
      eyebrow: '11 · The design, assembled',
      heading: 'Source, shuffle, sink, processor',
      stand: 'Each box is one answer you chose. Only the last one is outside the pipeline, and it decides.',
      graph: {
        viewBox: '0 0 1520 300', legend: true,
        nodes: [
          { id: 'src', x: 20, y: 90, w: 300, h: 110, title: 'Replayable source', sub: 'stable ids + offset', kind: 'main', step: 0, src: 'src', values: ['re-reads from offset'] },
          { id: 'shuf', x: 400, y: 90, w: 300, h: 110, title: 'Dedup shuffle', sub: 'seen-set, in memory', kind: 'change', step: 1, src: 'shuf', values: [null, 'covers 1 of 3'] },
          { id: 'sink', x: 780, y: 90, w: 300, h: 110, title: 'Idempotent sink', sub: 'sends key order-4', kind: 'new', step: 2, src: 'sink', values: [null, null, 'one key per order'] },
          { id: 'ext', x: 1160, y: 90, w: 340, h: 110, title: 'Payment processor', sub: 'remembers keys', kind: 'ext', step: 3, src: 'ext', values: [null, null, null, 'charged 6, once'] }
        ],
        edges: [
          { from: 'src', to: 'shuf', kind: 'main', step: 1 },
          { from: 'shuf', to: 'sink', kind: 'change', step: 2 },
          { from: 'sink', to: 'ext', kind: 'new', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Completeness:</b> only the source can bring a record back.[[src:src]]' },
        { step: 4, html: '<b>Accuracy:</b> the shuffle is cheap; the key is the guarantee.[[src:sdwhen]]' },
        { step: 4, html: '<b>The decision:</b> made outside, by the processor.[[src:sdwhy]]' }
      ],
      narration: [
        'Here is the whole design. First, the replayable source: records with stable ids, and an offset to re-read from after a crash.',
        'Second, the dedup shuffle: a seen-set in memory that drops repeats cheaply, covering 1 of the 3 crash windows.',
        'Third, the idempotent sink: every charge carries one key per order, taken from the order itself.',
        'Fourth, outside the pipeline, the payment processor: it remembers keys, and charges order 4 once: 6.',
        'So completeness comes only from the source. Accuracy comes cheaply from the shuffle and for certain from the key. And the deciding fact lives outside the pipeline.'
      ]
    },

    /* ---------- 12 · what it does not settle ---------- */
    {
      title: 'Not', layout: 'ask', defines: ['horizon', 'retention'],
      eyebrow: '12 · Your turn · what this design does not settle',
      heading: 'Four gaps, and one nobody can see',
      stand: 'The design works when the processor supports keys and the key comes from the order. Four things it leaves open.',
      question: {
        step: 0,
        prompt: 'Which of these failures can nothing inside the pipeline detect?',
        options: [
          { text: 'A key made at send time instead of from the order.', correct: true,
            why: 'The pipeline looks correct in every respect, uses a key, retries properly — and double-charges.' },
          { text: 'A processor that offers no keys at all.', correct: false,
            why: 'That is visible before anything is built: the design is simply unavailable, and two-phase commit is the fallback.' },
          { text: 'A source that cannot re-read old records.', correct: false,
            why: 'That shows up as missing records against the source, and it is checked first, before the design.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'It does NOT…', html: '<ul class="l"><li>work without the processor’s keys: it is unavailable, not degraded;</li><li>catch a key made at send time: a correct-looking double charge.[[src:sdwhen]]</li></ul>' },
        { step: 2, title: '…and it is limited in time', html: '<ul class="l"><li>The seen-set must be trimmed; how far back it remembers is its <b>horizon</b>.</li><li>Replay reaches back only as far as the source keeps records, its <b>retention</b>. Beyond that, loss returns.[[src:sdwhen]]</li></ul>' }
      ],
      narration: [
        'The design works when the processor supports keys and the key comes from the order. It leaves four things open. Which of these can nothing inside the pipeline detect? Choose an answer.',
        'A key made at send time. The pipeline looks correct, uses a key, retries properly, and double-charges. And without the processor’s keys at all, the design is unavailable, not merely weaker.',
        'Two more are limits in time. The seen-set must be trimmed, and how far back it remembers is its horizon. Replay reaches back only as far as the source keeps records, called its retention.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · The design, in five sentences',
      heading: 'Replay for completeness, a key for accuracy, the processor decides',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Replayable source</b>', 'Stable record ids, and an offset to re-read from.', 'Where do lost records come from?[[src:src]]'] },
          { step: 0, cells: ['<b>Dedup shuffle</b>', 'A seen-set in memory; drops repeats while alive. Covers 1 of 3.', 'How are repeats dropped cheaply?[[src:shuf]]'] },
          { step: 1, cells: ['<b>Idempotent sink</b>', 'Sends every charge with a key from the order: order-4.', 'What makes a repeat harmless?[[src:sink]]'] },
          { step: 1, cells: ['<b>Payment processor</b>', 'Remembers keys; charges 6 once, not 12.', 'Who knows what was charged?[[src:ext]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'Needs the processor’s keys; a send-time key fails silently; horizon and retention limit it.', 'What is left open?[[src:sdwhen]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>The decisive fact lives outside the pipeline, so the mechanism that works is the one that asks the outside: the idempotency key.[[src:sdwhy]]</p>' },
      narration: [
        'To recap. The replayable source re-reads from its offset, so nothing is lost. The dedup shuffle drops repeats cheaply, but only while its machine is alive.',
        'The idempotent sink sends every charge with a key taken from the order. The payment processor remembers keys, and charges 6 once, not 12.',
        'What it does not settle: it needs the processor’s keys, a key made at send time fails silently, and the horizon and retention limit it in time.',
        'In one line: the decisive fact lives outside the pipeline, so the mechanism that works is the one that asks the outside.'
      ]
    }
  ]
};
