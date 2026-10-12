// Chapter 5, Part 3 — "Side effects — the hard part", for a viewer who has read nothing
// before it. The nine events and the crash are re-told from zero; event 4 becomes a card
// charge, and the viewer is asked how a retried charge can be made safe, what a key made at
// send time does, which of three crash points each guard reaches, and where the charge should
// sit in the pipeline. The charge sequence is drawn as a sequence diagram and the placement
// exposure is animated. Every number comes from the seed or the chapter and is asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch05';
const E = seed.EVENTS;
const TOTAL = E.reduce((s, e) => s + e.v, 0);
const ORDER = E.find(e => e.id === 4);
// the three ways a failure after the first charge can send order 4 again (from the chapter)
const FAILURES = [
  { at: 'Upstream crash, shuffle alive', viaShuffle: true, seenSurvives: true },
  { at: 'Charge times out; the sink retries it', viaShuffle: false, seenSurvives: true },
  { at: 'Crash after the charge, before the offset is saved', viaShuffle: true, seenSurvives: false }
];
const attempt = (f, useDedup, useKey) => {
  const keys = new Set(); let charged = 0, sends = 0, seen = new Set();
  const charge = () => { const k = useKey ? `order-${ORDER.id}` : `send-${++sends}`; if (keys.has(k)) return; keys.add(k); charged += ORDER.v; };
  seen.add(ORDER.id); charge();
  if (!f.seenSurvives) seen = new Set();
  if (!(f.viaShuffle && useDedup && seen.has(ORDER.id))) charge();
  return charged;
};
const COVER = FAILURES.map(f => ({ ...f, none: attempt(f, false, false), dedup: attempt(f, true, false) === ORDER.v, key: attempt(f, false, true) === ORDER.v }));
const BY_DEDUP = COVER.filter(c => c.dedup).length, BY_KEY = COVER.filter(c => c.key).length;
const STAGES = ['source', 'shuffle', 'aggregate', 'sink'];
const exposure = k => STAGES.length - k + 1;
const reach = k => STAGES.map((_, i) => (i + 1 >= k ? 'yes' : 'no'));

if (TOTAL !== 45 || ORDER.v !== 6 || COVER.some(c => c.none !== 12) || BY_DEDUP !== 1 || BY_KEY !== 3 || !COVER[0].dedup
  || exposure(2) !== 3 || exposure(4) !== 1)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

const tick = b => (b ? '<b>covers</b>' : 'misses');

module.exports = {
  title: 'Charging a Card Once',
  eyebrow: 'Streaming · Ch 5 · Part 3',
  ...shared,
  jargon: ['event', 'value', 'pipeline', 'crash', 'retry', 'side effect', 'state', 'timeout', 'payment processor',
    'idempotency key', 'stage', 'shuffle', 'seen-set', 'sink', 'offset', 'two-phase commit'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    sec:   section(CH, 'Side effects — the hard part', 'Chapter 5 · side effects'),
    why:   section(CH, 'Why the outside world cannot be recomputed, and what follows from that', 'Chapter 5 · why it cannot be recomputed'),
    when:  section(CH, 'When each mechanism applies, and the one you cannot provide yourself', 'Chapter 5 · when each mechanism applies'),
    walk:  section(CH, 'Visual walkthrough — no recompute, the key, the three crash windows', 'Chapter 5 · the key and three crash windows'),
    prog:  section(CH, 'Side effects — stack and heap at every step', 'Chapter 5 · side effects, traced'),
    dedup: section(CH, 'Why a replayable source has no substitute and the other two are redundant', 'Chapter 5 · the seen-set'),
    quiz:  section(CH, 'Quiz', 'Chapter 5 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'value', 'pipeline', 'crash', 'retry'],
      eyebrow: '01 · Chapter 5 · Part 3',
      heading: 'One order, one card, and a machine that might charge it twice',
      hero: { step: 0, text: 'A shop’s customers do things on its website. Each thing is an <b>event</b> carrying a <b>value</b>. A <b>pipeline</b> — programs on several machines — handles them. When a machine <b>crashes</b> (stops suddenly), work it cannot prove was done is sent again: a <b>retry</b>. This time, one event is an order to charge a card.[[src:why]]' },
      tiles: [
        { step: 1, value: ORDER.v, label: 'the charge for order 4[[src:why]]' },
        { step: 1, value: 12, label: 'charged if the retry runs it again[[src:why]]' },
        { step: 2, value: 3, label: 'ways a crash can repeat the charge[[src:walk]]' },
        { step: 2, value: 1, label: 'of them stopped by remembering ids[[src:walk]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'Why is a charge harder than a total?', text: 'A total can be worked out again. A charge cannot.' },
        { step: 3, n: 2, title: 'Who can tell a repeat from a new charge?', text: 'Only the system that took the money.' },
        { step: 4, n: 3, title: 'Where should the charge happen?', text: 'As late in the pipeline as possible.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s customers do things on its website. Each thing is an event with a value, and a pipeline of programs handles them. When a machine crashes, work it cannot prove was done is sent again: a retry.',
        'This time, event 4 is an order: charge the customer’s card 6. If a retry runs that charge a second time, the card is charged 12.',
        'There are 3 different ways a crash can make the charge run twice. Remembering which events you have seen, the trick that works for totals, stops only 1 of them.',
        'This part asks: why is a charge so much harder than a total? And who is able to tell a repeated charge from a new one?',
        'And where in the pipeline should a charge happen? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events ---------- */
    {
      title: 'Data', layout: 'table', defines: ['state'],
      eyebrow: '02 · The nine events, and the one that touches money',
      heading: 'Eight events feed totals. One moves money.',
      stand: 'The nine events, in the order the pipeline handles them. Their values add up to 45.',
      table: {
        columns: ['Event', 'Value', 'What the pipeline does with it'],
        rows: [
          { step: 0, cells: ['event 0', `${E[0].v}`, 'adds it to a running total'] },
          { step: 0, cells: ['event 1 · event 2 · event 3', `${E[1].v} · ${E[2].v} · ${E[3].v}`, 'adds them to the running total'] },
          { step: 1, cells: ['<b>event 4</b>', `<b>${ORDER.v}</b>`, '<b>order 4: charges a card ' + ORDER.v + '</b>'] },
          { step: 2, cells: ['event 5 … event 8', `${E[5].v} · ${E[6].v} · ${E[7].v} · ${E[8].v}`, 'adds them to the running total'] }
        ]
      },
      side: { step: 3, title: 'Two kinds of output', html: '<ul class="l"><li><b>State</b> — what the pipeline keeps for itself, like the running total. It is worked out from the events: <b>' + TOTAL + '</b>, every time.[[src:why]]</li><li><b>A charge</b> — money moving at a bank, outside the pipeline.[[src:sec]]</li></ul>' },
      narration: [
        'Here are the nine events. Event 0 is worth 5, and the pipeline adds it to a running total. Events 1, 2 and 3 are added too.',
        'Event 4 is different. It is order 4, and the pipeline charges the customer’s card 6 for it.',
        'Events 5 to 8 are added to the total as usual. All nine values add up to 45.',
        'So there are two kinds of output. What the pipeline keeps for itself, like the running total, is called its state. And there is money moving at a bank, outside the pipeline.'
      ]
    },

    /* ---------- 3 · question: recompute vs charge ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['side effect', 'timeout'],
      eyebrow: '03 · Your turn',
      heading: 'Redo the work after a crash',
      stand: 'After a crash, the pipeline redoes the work for event 4. Redoing the running total gives the same total as before.',
      question: {
        step: 0,
        prompt: 'What does redoing “charge order 4 for 6” give?',
        options: [
          { text: 'The card is charged 12: the first charge already happened.', correct: true,
            why: 'The money moved the first time, and nothing in the pipeline records that it did. Running the charge again moves it again.' },
          { text: 'The card is charged 6: the second run overwrites the first.', correct: false,
            why: 'A charge does not overwrite anything. Every run moves money.' },
          { text: 'The card is charged 0: the crash undid the first charge.', correct: false,
            why: 'A crash inside the pipeline cannot reach into the bank. What the bank did stays done.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A side effect', html: '<p>A change in the outside world — a charge, an email — is a <b>side effect</b>. State can be worked out again from the events; a side effect cannot.[[src:why]]</p>' },
        { step: 2, title: 'And the pipeline cannot tell', html: '<p>If the bank’s reply never arrives, the pipeline gives up waiting: a <b>timeout</b>. A charge that timed out after succeeding looks exactly like one that failed.[[src:why]]</p>' }
      ],
      narration: [
        'First question. After a crash, the pipeline redoes the work for event 4. Redoing the total gives the same total. What does redoing charge order 4 for 6 give? Choose an answer.',
        'The card is charged 12. A change in the outside world, like a charge or an email, is called a side effect. State can be worked out again from the events. A side effect cannot.',
        'And the pipeline cannot even tell. If the bank’s reply never comes, it gives up waiting: a timeout. A charge that timed out after succeeding looks exactly like one that failed.'
      ]
    },

    /* ---------- 4 · question: how to make the retry safe ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['payment processor', 'idempotency key'],
      eyebrow: '04 · Your turn',
      heading: 'Somebody has to recognise the repeat',
      stand: 'The pipeline must be allowed to retry, because a lost reply looks like a failure. So the retry itself has to be harmless.',
      question: {
        step: 0,
        prompt: 'Who is able to tell a repeated charge for order 4 from a new one?',
        options: [
          { text: 'The company that takes the money, if each charge carries a fixed name.', correct: true,
            why: 'It saw the first charge. If both attempts carry the name “order-4”, it can see the second is the same and skip it.' },
          { text: 'The pipeline, by checking its own notes before charging.', correct: false,
            why: 'Its notes are exactly what the crash wiped out. It does not know whether the first charge landed.' },
          { text: 'Nobody: a repeat always looks like a new charge.', correct: false,
            why: 'Only if the two attempts carry nothing in common. Give them the same name and the repeat is recognisable.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The payment processor', html: '<p>The company that actually moves the money is the <b>payment processor</b>. It is the only system that saw the first charge.[[src:why]]</p>' },
        { step: 2, title: 'An idempotency key', html: '<p>A fixed name sent with every attempt, like <code>order-4</code>, is an <b>idempotency key</b>. The processor remembers keys it has charged and ignores a repeat.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. The pipeline must be allowed to retry, so the retry itself has to be harmless. Who is able to tell a repeated charge for order 4 from a new one? Choose an answer.',
        'The company that takes the money, called the payment processor. It is the only system that saw the first charge.',
        'If every attempt carries the same name, like order 4, the processor can recognise a repeat. That name is called an idempotency key. The processor remembers the keys it has charged.'
      ]
    },

    /* ---------- 5 · the key, as a sequence ---------- */
    {
      title: 'Key', layout: 'sequence',
      eyebrow: '05 · Watch the retry, with a key',
      heading: 'Two attempts, one charge',
      stand: 'Time runs top to bottom. The pipeline sends the charge, crashes, and sends it again with the same key.',
      sequence: {
        actors: [
          { name: 'Pipeline', sub: 'its last machine' },
          { name: 'Payment processor', sub: 'remembers keys', highlight: true, src: 'why' },
          { name: 'Card', sub: 'the customer’s' }
        ],
        messages: [
          { from: 'Pipeline', to: 'Payment processor', label: 'charge 6 · key order-4', step: 0 },
          { from: 'Payment processor', to: 'Card', label: 'charge 6 · total charged 6', step: 0 },
          { from: 'Payment processor', to: 'Pipeline', label: 'done (reply lost in the crash)', step: 1 },
          { from: 'Pipeline', to: 'Payment processor', label: 'retry: charge 6 · key order-4', step: 2 },
          { from: 'Payment processor', to: 'Pipeline', label: 'key already seen · no new charge', step: 3 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Total charged: 6.</b> The second attempt changed nothing.[[src:why]]' },
        { step: 4, html: '<b>Note where the decision is made:</b> inside the processor, the only state that survived the crash.[[src:prog]]' }
      ],
      narration: [
        'Time runs top to bottom. The pipeline asks the processor to charge 6, with the key order 4. The processor records the key and charges the card: 6 in total.',
        'The processor replies that it is done, but the pipeline crashes before the reply is noted. As far as the pipeline knows, the charge may never have happened.',
        'So it retries: the same charge of 6, with the same key, order 4, because that key comes from the order itself.',
        'The processor finds order 4 among the keys it has charged, and does nothing. Total charged: 6, not 12.',
        'Notice who made the decision: the processor, using its own records. Those records are the only state that survived the pipeline’s crash.'
      ]
    },

    /* ---------- 6 · question: key made at send time ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '06 · Your turn',
      heading: 'Where does the key come from?',
      stand: 'A different pipeline makes its key at the moment it sends: “send-1” for the first attempt, “send-2” for the retry.',
      question: {
        step: 0,
        prompt: 'With keys made at send time, what does the card end up charged?',
        options: [
          { text: '12: the processor has never seen “send-2”.', correct: true,
            why: 'The retry carries a brand-new key, so to the processor it is a brand-new charge.' },
          { text: '6: any key at all is enough.', correct: false,
            why: 'A key only helps if both attempts carry the same one. Here they differ.' },
          { text: '0: the processor rejects keys it does not know.', correct: false,
            why: 'An unknown key means “new charge”, which is exactly what the processor is there to carry out.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Derived from the data', html: '<p>The key must come from the order itself — <code>order-4</code> — so every attempt carries it. A key made at send time is a second charge with extra steps.[[src:why]]</p>' },
        { step: 2, title: 'And nothing notices', html: '<p>Everything else about that pipeline is correct. It uses a key, it retries, and it charges <b>12</b>. Nothing inside it can detect the difference.[[src:prog]]</p>' }
      ],
      narration: [
        'Third question. Another pipeline makes its key when it sends: send 1 for the first attempt, send 2 for the retry. What does the card end up charged? Choose an answer.',
        'Twelve. The processor has never seen send 2, so it charges again. The key must come from the order itself, order 4, so that every attempt carries the same one.',
        'And nothing notices. That pipeline uses a key, retries correctly, and still charges 12. Nothing inside it can tell the difference.'
      ]
    },

    /* ---------- 7 · question: the seen-set ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['stage', 'shuffle', 'seen-set', 'sink'],
      eyebrow: '07 · Your turn',
      heading: 'Does remembering ids help here?',
      stand: 'For totals, a machine could drop repeats by keeping the ids of events it had already accepted. Now the processor’s reply is lost, and the pipeline’s last machine re-sends the charge itself.',
      question: {
        step: 0,
        prompt: 'Does the list of accepted ids, kept by the machine before the last one, stop this retry?',
        options: [
          { text: 'No: the retry starts after that check, so it never passes it.', correct: true,
            why: 'The list sits at the hand-over between machines. A re-send from the last machine starts later, so it never meets the list.' },
          { text: 'Yes: event 4 is already on the list.', correct: false,
            why: 'It is on the list, but the retry never goes back through the place where the list is checked.' },
          { text: 'Yes: the list is shared with the payment processor.', correct: false,
            why: 'The list lives inside the pipeline. The processor never sees it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Stages, the shuffle, the sink', html: '<p>Each machine’s step is a <b>stage</b>. The hand-over between stages is the <b>shuffle</b>; the last stage, which sends results out, is the <b>sink</b>.[[src:walk]]</p>' },
        { step: 2, title: 'The seen-set', html: '<p>The list of accepted ids kept at the shuffle is the <b>seen-set</b>. It stops only a copy that comes back <b>through</b> the shuffle.[[src:dedup]]</p>' }
      ],
      narration: [
        'Fourth question. For totals, a machine could drop repeats by keeping the ids it had accepted. Now the processor’s reply is lost, and the last machine re-sends the charge itself. Does that list stop it? Choose an answer.',
        'No. Each machine’s step is called a stage. The hand-over between stages is the shuffle, and the last stage, which sends results out, is the sink.',
        'The list of accepted ids is kept at the shuffle, and it is called the seen-set. It only stops a copy that comes back through the shuffle. A retry from the sink never passes it.'
      ]
    },

    /* ---------- 8 · the three crash windows ---------- */
    {
      title: 'Three', layout: 'table', defines: ['offset'],
      eyebrow: '08 · Every way the charge can run twice',
      heading: 'The seen-set covers 1 of 3. The key covers 3 of 3.',
      stand: 'Three failures that each happen after the first charge landed. With no guard, every one of them charges 12.',
      table: {
        columns: ['What goes wrong', 'Seen-set at the shuffle', 'Key at the processor'],
        rows: [
          { step: 0, cells: [COVER[0].at + ' — the stage before the shuffle re-sends; the shuffle still remembers id 4', tick(COVER[0].dedup), tick(COVER[0].key)] },
          { step: 1, cells: [COVER[1].at + ' — the re-send starts after the shuffle', tick(COVER[1].dedup), tick(COVER[1].key)] },
          { step: 2, cells: [COVER[2].at + ' — the seen-set dies with the machine', tick(COVER[2].dedup), tick(COVER[2].key)] },
          { step: 3, cells: ['<b>Covered</b>', `<b>${BY_DEDUP} of 3</b>`, `<b>${BY_KEY} of 3</b>`] }
        ]
      },
      side: { step: 3, title: 'Why the difference', html: '<p>The seen-set lives <b>inside</b> the pipeline, in memory. The keys live at the processor, the one place that sees both attempts and survives the crash.[[src:walk]]</p><p>For totals the two guards were interchangeable. For a charge they are not.[[src:why]]</p>' },
      narration: [
        'Here are three failures that each happen after the first charge landed. First, the stage before the shuffle crashes and re-sends. The shuffle never crashed, still remembers id 4, and drops the copy. Both guards cover it.',
        'Second, the charge times out and the sink retries it. The re-send starts after the shuffle, so the seen-set never sees it. Only the key covers it.',
        'Third, the machine crashes after the charge but before saving its offset, its saved reading position. The seen-set, kept in memory, dies with the machine, so the re-read event looks new. Only the key covers it.',
        'So the seen-set covers 1 of 3, and the key covers 3 of 3. For totals the two guards were interchangeable. For a charge they are not.'
      ]
    },

    /* ---------- 9 · question: placement ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'Which stage should make the charge?',
      stand: 'A pipeline of four stages: source, shuffle, aggregate, sink. A crash in a stage re-runs that stage and every stage after it.',
      question: {
        step: 0,
        prompt: 'Where should the charge happen, to be re-run by as few crashes as possible?',
        options: [
          { text: 'In the last stage, the sink.', correct: true,
            why: 'Only a crash in the sink itself can re-run it. Every stage before it can crash and retry freely.' },
          { text: 'In the second stage, as early as possible.', correct: false,
            why: 'Then a crash in stage 2, 3 or 4 can re-run it: three chances instead of one.' },
          { text: 'It makes no difference where it sits.', correct: false,
            why: 'It does: the earlier the charge, the more later crashes can re-run it.' }
        ]
      },
      narration: [
        'Fifth question. A pipeline has four stages: source, shuffle, aggregate, sink. A crash in a stage re-runs it and everything after it. Where should the charge happen? Choose an answer.',
        'In the last stage, the sink. Watch why on the next slide: count the crashes that can reach the charge in each position.'
      ]
    },

    /* ---------- 10 · placement, animated ---------- */
    {
      title: 'Place', layout: 'array',
      eyebrow: '10 · Watch which crashes can reach the charge',
      heading: 'At stage 2, three crashes reach it. At stage 4, one.',
      stand: 'One column per stage. “yes” means a crash in that stage would re-run the charge.',
      array: {
        labelWidth: 210, slots: false,
        rows: [
          { label: 'the stage', values: STAGES },
          { label: 'charge in stage 2', values: reach(2) },
          { label: 'charge in stage 4', values: reach(4) }
        ],
        meters: ['stages checked', 'crashes that re-run it'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 },
          { step: 2, do: 'pick', slots: [3] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Three times less exposure, for free', html: '<p>Moving the charge from stage 2 to stage 4 cuts the crashes that can re-run it from <b>' + exposure(2) + '</b> to <b>' + exposure(4) + '</b>. No feature needed from anyone.[[src:why]]</p>' },
        { step: 2, title: 'And everything before it stays pure', html: '<p>Stages that only compute can be retried without anyone thinking about it. Keep the work pure; put the side effect at the very end.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the four stages. First, the charge sits in stage 2, the shuffle. Watch: a crash in the shuffle, the aggregate or the sink would re-run it. Three crashes can reach it.',
        'Now the charge sits in stage 4, the sink. Only a crash in the sink itself can re-run it. One crash, instead of three.',
        'So placement alone cuts the exposure three times, and needs no help from anyone. Everything before the sink only computes, so it can be retried freely.'
      ]
    },

    /* ---------- 11 · question: no key at all ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['two-phase commit'],
      eyebrow: '11 · Your turn',
      heading: 'When the processor offers no key',
      stand: 'Some outside systems do not remember keys at all. There is another way: first ask both sides to get ready, then tell both to go ahead.',
      question: {
        step: 0,
        prompt: 'The coordinator says “get ready”, both sides agree, and the coordinator then dies. What should the processor do?',
        options: [
          { text: 'Nothing is safe: charging may double, cancelling may lose a real payment.', correct: true,
            why: 'The processor cannot know what the coordinator decided. Either choice can be wrong, so a person must resolve it.' },
          { text: 'Charge: it already agreed to be ready, so it should finish.', correct: false,
            why: 'Agreeing to be ready is not being told to go. If the other side was told to cancel, charging is wrong.' },
          { text: 'Cancel: it never heard “go ahead”, so nothing happened.', correct: false,
            why: 'The coordinator may have told the other side to go ahead just before dying. Cancelling then loses a real payment.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two-phase commit', html: '<p>“Get ready”, then “go ahead”, run by a coordinator, is a <b>two-phase commit</b>. It really does reach exactly once without a key.[[src:sec]]</p>' },
        { step: 2, title: 'Expensive and fragile', html: '<p>It has a stuck state — ready, coordinator gone — where neither choice is safe, and a human must step in. Prefer a key whenever one exists.[[src:when]]</p>' }
      ],
      narration: [
        'Sixth question. Some outside systems remember no keys. Another way: a coordinator tells both sides to get ready, then to go ahead. It says get ready, both agree, then it dies. What should the processor do? Choose an answer.',
        'Nothing is safe. Charging may charge twice; cancelling may lose a real payment. Get ready, then go ahead, is called a two-phase commit. It really works without a key.',
        'But it has this stuck state, ready with the coordinator gone, where neither choice is safe and a person must decide. So it is the fallback, not the default.'
      ]
    },

    /* ---------- 12 · what it rests on ---------- */
    {
      title: 'Rests', layout: 'cards',
      eyebrow: '12 · When each mechanism applies',
      heading: 'The whole design rests on someone else’s feature',
      stand: 'The three mechanisms of this part, and the dependency underneath them.',
      columns: 2,
      cards: [
        { step: 0, title: '1 · A key, whenever the processor offers one', html: '<p>One request, a free retry, and the decision made by the only system that can make it.[[src:when]]</p>' },
        { step: 1, title: '2 · The charge in the last stage, always', html: '<p>Costs nothing, cuts exposure from 3 crashes to 1, and keeps every earlier stage freely retryable.[[src:when]]</p>' },
        { step: 2, title: '3 · Two-phase commit only when there is no key', html: '<p>It works, but its stuck state needs a person. The fallback, never the default.[[src:when]]</p>' },
        { step: 3, title: 'What this does not settle', html: '<p>If the processor has no keys, this design is simply unavailable. And a key made at send time looks correct and double-charges, with nothing inside able to tell.[[src:when]]</p>' }
      ],
      narration: [
        'So, when does each mechanism apply? Use a key whenever the processor offers one. One request, a free retry, and the decision made by the only system that can make it.',
        'Put the charge in the last stage, always. It costs nothing, cuts exposure from three crashes to one, and leaves every earlier stage free to retry.',
        'Use two-phase commit only when there is no key. It works, but its stuck state needs a person.',
        'And notice what this rests on: a feature of someone else’s system. Without keys at the processor, the design is unavailable. With a key made at send time, it double-charges silently.'
      ]
    },

    /* ---------- 13 · quiz ---------- */
    {
      title: 'Check', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'Why are side effects the hard part?',
      stand: 'The chapter’s own quiz question.',
      question: {
        step: 0,
        prompt: 'Why are side effects the hard part of exactly once?',
        options: [
          { text: 'They are slow to carry out.', correct: false, why: 'Speed has nothing to do with it. A fast charge is just as hard to undo.' },
          { text: 'They touch the outside world and cannot be worked out again.', correct: true, why: 'A total can be recomputed; a charge or an email cannot be taken back by recomputing.' },
          { text: 'They use too much memory.', correct: false, why: 'Memory is the seen-set’s problem. A charge needs almost none.' },
          { text: 'They need a clock to run.', correct: false, why: 'Clocks decide when totals are reported, not whether a charge can be repeated safely.' }
        ]
      },
      narration: [
        'A check, from the chapter’s quiz. Why are side effects the hard part of exactly once? Choose an answer.',
        'They touch the outside world and cannot be worked out again. A total can be recomputed. A charge or an email cannot, so it needs a key, or a two-phase commit.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Chk2', layout: 'ask',
      eyebrow: '14 · Your turn · check yourself',
      heading: 'Key or two-phase commit?',
      stand: 'Another of the chapter’s quiz questions.',
      question: {
        step: 0,
        prompt: 'Which is preferred for making a charge happen exactly once?',
        options: [
          { text: 'A two-phase commit, run by a coordinator.', correct: false, why: 'It works, but it is expensive, and its stuck state needs a person to resolve.' },
          { text: 'An idempotency key, checked by the processor.', correct: true, why: 'Cheap and robust: one request, and the processor decides using its own records.' },
          { text: 'A retry with no key, sent straight away.', correct: false, why: 'That is how a card gets charged 12.' },
          { text: 'Ignoring failures, and never retrying.', correct: false, why: 'Then a charge whose reply was lost might never happen, or never be known to have happened.' }
        ]
      },
      narration: [
        'And one more from the chapter’s quiz. Which is preferred for making a charge happen exactly once? Choose an answer.',
        'An idempotency key. It is cheap and robust. A two-phase commit is expensive and fragile, so it is kept for systems that offer no key.'
      ]
    },

    /* ---------- 15 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '15 · What you now know',
      heading: 'Only the outside system can recognise a repeated charge',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Side effect</b>', 'A change outside the pipeline. Redo “charge order 4 for 6” and the card is charged 12.[[src:why]]'] },
          { step: 0, cells: ['<b>Idempotency key</b>', 'A fixed name from the order, like order-4. The processor ignores a repeat: total 6.[[src:why]]'] },
          { step: 1, cells: ['<b>Seen-set vs key</b>', 'Of the 3 ways a charge can run twice, the seen-set covers 1 and the key covers 3.[[src:walk]]'] },
          { step: 2, cells: ['<b>Placement</b>', 'The charge in the last stage: 1 crash can reach it instead of 3.[[src:why]]'] },
          { step: 2, cells: ['<b>Two-phase commit</b>', 'Works without a key, but has a stuck state a person must resolve.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>A coding interview question: a worker that writes a result and records how far it has read. Every order of those two writes fails somewhere. Part 4 builds the program that proves it, and the one fix.</p>' },
      narration: [
        'To recap. A side effect is a change outside the pipeline: redo the charge and the card is charged 12. An idempotency key, taken from the order itself, lets the processor ignore the repeat.',
        'Of the three ways a crash can run the charge twice, the seen-set covers one and the key covers all three, because only the processor sees both attempts and survives the crash.',
        'Put the charge in the last stage, so one crash can reach it instead of three. Use a two-phase commit only when there is no key.',
        'Next, part 4 is a coding interview question: a worker with two writes, where every order of the two writes fails somewhere. We build the program that proves it, and the one fix.'
      ]
    }
  ]
};
