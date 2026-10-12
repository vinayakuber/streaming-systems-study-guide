// Chapter 5, Part 7 — Variation 4 of the interview question ("the retry that must not
// re-send"), built as a program WITH the viewer. Every code slide asks what the next piece must
// do, then reveals the real lines from programs/ch05_v4.py (read at build time by _prog.js,
// addressed by content, never by line number). What the phone receives is animated; the last
// slides show the whole file and what it prints (programs/ch05_v4.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch05';
const P = program('ch05_v4.py');
const OUT = program('ch05_v4.out');
const upto = needle => P.at(needle) - 1;

// the phone's view of a crash during item 3, read from the printed output
const seqAfter = label => JSON.parse(OUT.lines[OUT.at(label)].split(':')[1].split('->')[0].trim());
const AT_LEAST = seqAfter('effect then position : [');
const AT_MOST = seqAfter('position then effect : [');
const pad = (xs, n) => [...xs, ...Array(n - xs.length).fill('')];

// the pieces, in the order they are written
const DATA = [P.at('# The chapter\'s nine items, unchanged.'), P.block('PROFILES = {')[1]];
const R_HEAD = [P.at('def run('), P.at('die = i in crash_at and i not in fired')];
const R_EFFECT = [P.at('if order == "effect_then_position":'), upto('elif order == "position_then_effect":')];
const R_POS = [P.at('elif order == "position_then_effect":'), upto('elif order == "send_then_dedupe":')];
const R_DEDUPE = [P.at('elif order == "send_then_dedupe":'), upto('        if not crashed:')];
const R_TAIL = P.span('        if not crashed:', '    return sent');
const TALLY = P.fn('tally');
const COST = P.fn('expected_cost');
const EXTRA = P.span('# A one-item queue, an empty queue', 'ALL = "all"');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN1 = [P.at('def main():'), upto('# ---- so the choice is the message')];
const MAIN2 = [P.at('# ---- so the choice is the message'), P.lines.length - 1];

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 21 examples agree with the send sequence their ordering forces',
  'effect then position : [0, 1, 2, 3, 3, 4, 5, 6, 7, 8]   -> ([3], [])', 'position then effect : [0, 1, 2, 4, 5, 6, 7, 8]   -> ([], [3])',
  'at all 9 crash points: effect-first duplicates exactly the straddling item and',
  'send-then-remember == effect-then-position on 9/9 crash points', 'remember-then-send == position-then-effect on 9/9 crash points',
  'recorded as handled and never sent, so position-first still loses item 3.',
  'your parcel has arrived     1    20             1.0           20.0  at-least-once',
  'you have been charged    50     2            50.0            2.0  at-most-once',
  'holding the cost of a loss at 20, the two designs tie when a duplicate costs 20', 'and at-least-once starts losing at 21',
  '20,000 items, effect-first, midway          20000 effect_then_position 10000 False     [10000]',
  'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch05_v4.out no longer prints "${s}" — rewrite the narration`);
if (AT_LEAST.length !== 10 || AT_MOST.length !== 8 || AT_LEAST.filter(x => x === 3).length !== 2 || AT_MOST.includes(3))
  throw new Error('programs/ch05_v4.out no longer shows the crash this deck animates — rewrite the narration');

const W = (...pieces) => pieces;
const RUN = [R_HEAD, R_EFFECT, R_TAIL];

module.exports = {
  title: 'The Notification Sent Twice',
  eyebrow: 'Streaming · Ch 5 · Part 7',
  ...shared,
  jargon: ['item', 'queue', 'worker', 'push notification', 'position', 'crash', 'restart', 'duplicate', 'loss',
    'pair', 'function', 'at-least-once', 'at-most-once', 'idempotency key', 'expected cost'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 5 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 5 · how to model it'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 5 · variation 4, the retry that must not re-send')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['item', 'queue', 'worker', 'push notification', 'position', 'crash'],
      eyebrow: '01 · Variation 4 of the interview question',
      heading: 'A message a person reads, and a crash that must not send it twice',
      hero: { step: 0, text: 'Nine numbered <b>items</b> wait in a <b>queue</b>. A program, the <b>worker</b>, sends one <b>push notification</b> per item — a message that pops up on someone’s phone — and records its <b>position</b>, how far it has got. It can <b>crash</b> at any instant. The push service offers no transaction and no way to recognise a repeat.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'items, one notification each[[src:var]]' },
        { step: 1, value: 1, label: 'person told twice, one way[[src:var]]' },
        { step: 2, value: 1, label: 'person never told, the other way[[src:var]]' },
        { step: 2, value: 2, label: 'messages that need opposite designs[[src:var]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'Can the worker avoid both failures?', text: 'Not with every tool gone.' },
        { step: 3, n: 2, title: 'Is “remember what you sent” a way out?', text: 'It is the same choice, moved.' },
        { step: 4, n: 3, title: 'So which failure do you pick?', text: 'It depends on what the message says.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each code slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'Nine items wait in a queue. A worker sends one push notification per item, a message that pops up on someone’s phone, and records its position. It can crash at any instant, and the push service has no transaction and no way to recognise a repeat.',
        'Send first and record second, and a crash tells one person twice.',
        'Record first and send second, and a crash leaves one person never told. And we will see two messages that need opposite designs.',
        'This part asks: can the worker avoid both failures? And is remembering what you already sent a way out?',
        'And if not, which failure should you pick? The answer depends on what the message says. We will write the program together.'
      ]
    },

    /* ---------- 2 · a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['restart', 'duplicate', 'loss'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Send, then record — and crash in between',
      stand: 'The worker sends item 3’s notification, then crashes before recording position 4. It starts again from the recorded position, 3.',
      question: {
        step: 0,
        prompt: 'What does the person waiting for item 3 see on their phone?',
        options: [
          { text: 'The same notification twice.', correct: true,
            why: 'It was sent before the crash, and the position still says 3, so the worker sends it again.' },
          { text: 'It once, as intended.', correct: false,
            why: 'Only if the worker knew it had been sent. The position, the only record, says it had not.' },
          { text: 'Nothing: the crash stopped the send.', correct: false,
            why: 'The send happened before the crash. A notification on a phone cannot be taken back.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Restart, duplicate', html: '<p>Starting again from the recorded position is a <b>restart</b>. A notification a person receives twice is a <b>duplicate</b>.[[src:var]]</p>' },
        { step: 2, title: 'And the mirror image', html: '<p>Record first, send second, and the same crash means item 3 is never sent: a <b>loss</b>. Nothing will ever notice.[[src:var]]</p>' }
      ],
      narration: [
        'Before any code, one case. The worker sends item 3’s notification, then crashes before recording position 4, and starts again from 3. What does the person see? Choose an answer.',
        'The same notification twice. Starting again from the recorded position is a restart, and a notification someone receives twice is a duplicate.',
        'Swap the order, record first and send second, and the same crash means item 3 is never sent at all. That is a loss, and nothing will ever notice it.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['pair', 'function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine items, and what each failure is worth',
      stand: 'The program starts with the queue — and with two numbers per message that no code can work out.',
      question: { step: 0, prompt: 'Where should the cost of a duplicate and of a loss come from?', options: [
        { text: 'From the product: what the message means to the person.', correct: true, why: 'A repeated “your parcel has arrived” is mild; a repeated “you have been charged” is alarming. The code cannot know that.' },
        { text: 'From the program, by measuring how long each takes.', correct: false, why: 'Time says nothing about how bad a duplicate or a loss is for the person reading it.' },
        { text: 'They are always equal, so they do not matter.', correct: false, why: 'They are not equal, and which one is larger flips the right design.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch05_v4.py · the data' }),
      cards: [ { step: 2, title: 'Two messages, two price lists', html: '<p>“Your parcel has arrived”: a duplicate costs 1, a loss 20. “You have been charged”: a duplicate costs 50, a loss 2. <code>ITEMS</code> holds nine <b>pairs</b> (number, value). Each piece below is a <b>function</b>.[[src:var]]</p>' } ],
      narration: [
        'First, the data. Where should the cost of a duplicate and of a loss come from? Choose an answer.',
        'From the product. Here are the lines: nine pairs of item number and value, the crash point 3 the printout follows, and two messages with their costs.',
        'Your parcel has arrived: a duplicate costs 1, a loss 20. You have been charged: a duplicate costs 50, a loss 2. These are the only numbers not derived from the data, and they decide the design.'
      ]
    },

    /* ---------- 4 · effect first ---------- */
    {
      title: 'First', layout: 'code', defines: ['at-least-once'],
      eyebrow: '04 · Writing the program · send, then record',
      heading: 'The worker, sending first',
      stand: 'The function returns what the phone received: the list of item numbers, in the order they arrived.',
      question: { step: 0, prompt: 'Send first, then record. Over all 9 crash points, what can go wrong?', options: [
        { text: 'Exactly one item is sent twice; nothing is ever lost.', correct: true, why: 'A crash between the two steps repeats the item it straddled. Every item is sent at least once.' },
        { text: 'Exactly one item is lost; nothing is sent twice.', correct: false, why: 'That is the other order. Here the send already happened before the crash.' },
        { text: 'Nothing, if the crash is quick.', correct: false, why: 'Speed does not matter: any crash between the two steps repeats the send.' } ] },
      code: P.build({ before: W(DATA), add: RUN, step: 1 }),
      cards: [ { step: 2, title: 'At-least-once', html: '<p>Every item arrives, some maybe twice: <b>at-least-once</b>. At every one of the 9 crash points, exactly the straddled item is duplicated.[[src:var]]</p>' } ],
      narration: [
        'Now the worker, sending first and recording second. Over all 9 crash points, what can go wrong? Choose an answer.',
        'Exactly one item is sent twice, and nothing is lost. Here is the function: push the notification, stop here if this is the crash point, and only then move the position.',
        'Every item arrives, some possibly twice. That guarantee is called at-least-once.'
      ]
    },

    /* ---------- 5 · position first ---------- */
    {
      title: 'Swap', layout: 'code', defines: ['at-most-once'],
      eyebrow: '05 · Writing the program · record, then send',
      heading: 'The worker, recording first',
      stand: 'Swap the two steps: move the position, then send.',
      question: { step: 0, prompt: 'Record first, then send. Over all 9 crash points, what can go wrong?', options: [
        { text: 'Exactly one item is never sent; nothing is sent twice.', correct: true, why: 'The position already says the item is done, so the restart skips it. No item is ever sent twice.' },
        { text: 'Exactly one item is sent twice, as before.', correct: false, why: 'The position moved before the send, so the restart never comes back to the item.' },
        { text: 'Both: one item twice and another never.', correct: false, why: 'Each order fails in exactly one direction. Neither does both.' } ] },
      code: P.build({ before: W(DATA, ...RUN), add: [R_POS], step: 1 }),
      cards: [ { step: 2, title: 'At-most-once', html: '<p>No item arrives twice, but some may never arrive: <b>at-most-once</b>. The mirror image, at every one of the 9 crash points.[[src:var]]</p>' } ],
      narration: [
        'Now swap the steps: record first, then send. Over all 9 crash points, what can go wrong? Choose an answer.',
        'Exactly one item is never sent. Here is the branch: move the position, stop here if this is the crash point, and only then push.',
        'No item arrives twice, but some may never arrive. That guarantee is called at-most-once.'
      ]
    },

    /* ---------- 6 · the phone, animated ---------- */
    {
      title: 'Phone', layout: 'array',
      eyebrow: '06 · Watch the phones during a crash at item 3',
      heading: 'Ten notifications one way, eight the other',
      stand: 'What the phones receive, in order, when the worker crashes during item 3.',
      array: {
        labelWidth: 200, slotLabel: 'arrives',
        rows: [ { label: 'send, then record', values: pad(AT_LEAST, 10) }, { label: 'record, then send', values: pad(AT_MOST, 10) } ],
        meters: ['arrivals checked', 'copies of item 3'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 0, do: 'sweep', row: 0, mode: 'match', match: 3, readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 3, readMeter: 0, resultMeter: 1, speed: 300 }
        ]
      },
      columns: 2,
      cards: [
        { step: 0, title: 'Send first: item 3 twice', html: '<p>0, 1, 2, 3, then 3 again after the restart, then 4 to 8. One person told twice.[[src:var]]</p>' },
        { step: 1, title: 'Record first: item 3 never', html: '<p>0, 1, 2, then straight to 4. One person never told, and nothing records that.[[src:var]]</p>' },
        { step: 2, title: 'Neither gets both right', html: '<p>At all 9 crash points one order duplicates exactly the straddled item and the other loses exactly it. No crash point escapes.[[src:var]]</p>' }
      ],
      narration: [
        'Here is what the phones receive when the worker crashes during item 3. Send first: watch the sweep count the copies of item 3. Two. One person is told twice.',
        'Record first: the same sweep finds no copy of item 3 at all. Eight notifications instead of nine. One person is never told.',
        'And that holds at all 9 crash points: one order always duplicates the straddled item, the other always loses it. Neither ever gets both right.'
      ]
    },

    /* ---------- 7 · remember what you sent ---------- */
    {
      title: 'Memo', layout: 'code',
      eyebrow: '07 · Writing the program · “just remember what you sent”',
      heading: 'A set of sent items looks like a third option',
      stand: 'The worker keeps a durable set of the items it has sent, and checks it before sending. Two ways to order it: remember then send, or send then remember.',
      question: { step: 0, prompt: 'Remember the item first, then send — and crash in between. What happens to that item?', options: [
        { text: 'It is never sent: the set says it was.', correct: true, why: 'Writing to the set is itself a write. Remembering first is recording first, with a different name.' },
        { text: 'It is sent exactly once.', correct: false, why: 'The crash came after the item was remembered and before it was sent. The restart sees it in the set and skips it.' },
        { text: 'It is sent twice.', correct: false, why: 'That is what send-then-remember does. Remember-then-send fails the other way.' } ] },
      code: P.build({ before: W(DATA, ...RUN, R_POS), add: [R_DEDUPE], step: 1 }),
      cards: [ { step: 2, title: 'The same two orders, renamed', html: '<p>Measured over all 9 crash points, the phone receives an <b>identical</b> sequence: send-then-remember is send-then-record, and remember-then-send is record-then-send, 9 of 9.[[src:var]]</p>' } ],
      narration: [
        'The appealing fix: keep a set of items already sent. Remember the item first, then send, and crash in between. What happens to that item? Choose an answer.',
        'It is never sent. Here are both versions. Writing to the set is itself a write, so the same two instants come back one level down.',
        'Measured over all 9 crash points, the phones receive exactly the same sequences as before. It is not a third option; it is the same choice with the record moved.'
      ]
    },

    /* ---------- 8 · counting by id ---------- */
    {
      title: 'Tally', layout: 'code',
      eyebrow: '08 · Writing the program · counting what went wrong',
      heading: 'Count duplicates and losses by item, not by total',
      stand: 'A function turns what the phone received into two lists: items seen more than once, and items never seen.',
      question: { step: 0, prompt: 'Why count by item number instead of comparing the total of the values?', options: [
        { text: 'A total can hide a duplicate and a loss that cancel out.', correct: true, why: 'A duplicate of 5 plus a loss of 5 gives the right total. Counting by item sees both.' },
        { text: 'Totals take longer to add up.', correct: false, why: 'Speed is not the concern. A total simply cannot tell the two failures apart.' },
        { text: 'Item numbers are smaller than values.', correct: false, why: 'Size has nothing to do with it. Identity does.' } ] },
      code: P.build({ before: W(DATA, ...RUN, R_POS, R_DEDUPE), add: [TALLY], step: 1 }),
      cards: [ { step: 2, title: 'The answer is a pair of lists', html: '<p>(duplicated, lost). Crash during item 3: send first gives ([3], []); record first gives ([], [3]).[[src:var]]</p>' } ],
      narration: [
        'Next, counting what went wrong. Why count by item number instead of comparing the total of the values? Choose an answer.',
        'Because a total can hide a duplicate and a loss that cancel out. Here is the function: it counts how often each item arrived, and lists the ones seen more than once and the ones never seen.',
        'So every answer is a pair of lists. A crash during item 3: send first gives item 3 duplicated; record first gives item 3 lost.'
      ]
    },

    /* ---------- 9 · the far-end key ---------- */
    {
      title: 'Key', layout: 'ask', defines: ['idempotency key'],
      eyebrow: '09 · Your turn · what WOULD fix it',
      heading: 'Suppose the push service could recognise repeats',
      stand: 'The question says the push service has no such feature. But what if it did: every send carries the item’s number, and the service drops a number it has already delivered.',
      question: {
        step: 0,
        prompt: 'With that feature, which of the two orders becomes exact?',
        options: [
          { text: 'Send first only: its repeat is dropped. Record first still loses item 3.', correct: true,
            why: 'The service can swallow a second copy. It cannot deliver a notification that was never sent.' },
          { text: 'Both orders become exact.', correct: false,
            why: 'Record first never sends item 3 at all. There is no repeat for the service to drop.' },
          { text: 'Record first only.', correct: false,
            why: 'Record first fails by losing, and recognising repeats does nothing for a loss.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'An idempotency key at the far end', html: '<p>A fixed name per item that the receiving service remembers is an <b>idempotency key</b>. With it, send first is exact at all 9 crash points.[[src:var]]</p>' },
        { step: 2, title: 'A property of the far end', html: '<p>The missing feature is the problem; no arrangement of the worker’s two steps substitutes for it. And it only rescues the at-least-once side.[[src:var]]</p>' }
      ],
      narration: [
        'The question says the push service cannot recognise repeats. But suppose it could. Which of the two orders becomes exact? Choose an answer.',
        'Only send first. A fixed name per item that the far end remembers is called an idempotency key. It swallows the second copy, but it cannot deliver a notification that was never sent.',
        'So what would fix this is a property of the far end, not a cleverer worker. And even then it rescues only the at-least-once side.'
      ]
    },

    /* ---------- 10 · expected cost ---------- */
    {
      title: 'Cost', layout: 'code', defines: ['expected cost'],
      eyebrow: '10 · Writing the program · which failure to pick',
      heading: 'Price each design for each message',
      stand: 'The crash will land wherever it lands, so the design must be chosen before knowing where. Average the cost over every crash point.',
      question: { step: 0, prompt: '“Your parcel has arrived”: a duplicate costs 1, a loss 20. Which design costs less?', options: [
        { text: 'Send first: at worst a person sees it twice.', correct: true, why: 'Each crash duplicates exactly one item: average cost 1.0, against 20.0 for losing one.' },
        { text: 'Record first: never annoy anyone twice.', correct: false, why: 'Then each crash loses a parcel notice, at cost 20, which is far worse here.' },
        { text: 'They cost the same.', correct: false, why: 'Each design fails on exactly one item per crash, but the prices differ: 1 against 20.' } ] },
      code: P.build({ before: W(DATA, ...RUN, R_POS, R_DEDUPE, TALLY), add: [COST], step: 1 }),
      cards: [ { step: 2, title: 'Expected cost', html: '<p>The average cost of one crash over all crash points is its <b>expected cost</b>. Parcel: <b>1.0</b> for send first, <b>20.0</b> for record first.[[src:var]]</p>' } ],
      narration: [
        'Now choose. For your parcel has arrived, a duplicate costs 1 and a loss costs 20. Which design costs less? Choose an answer.',
        'Send first. Here is the function: for each crash point it counts the duplicates and losses and prices them, then averages over every crash point.',
        'The average cost of one crash is called its expected cost. For the parcel message: 1.0 sending first, 20.0 recording first. At-least-once wins.'
      ]
    },

    /* ---------- 11 · the other message ---------- */
    {
      title: 'Flip', layout: 'ask',
      eyebrow: '11 · Your turn · the same code, another message',
      heading: '“You have been charged”',
      stand: 'Same nine items, same two programs. Now a duplicate costs 50 — a second charge notice alarms people — and a loss costs 2.',
      question: {
        step: 0,
        prompt: 'Which design should this message use?',
        options: [
          { text: 'Record first, then send: at most once.', correct: true,
            why: 'Its expected cost is 2.0, against 50.0 for sending first. A missing notice is cheap; a doubled one is not.' },
          { text: 'Send first, then record: at least once.', correct: false,
            why: 'Every crash would send someone a second “you have been charged”: expected cost 50.0.' },
          { text: 'The same design as the parcel message.', correct: false,
            why: 'The code is the same, but the prices flipped, and so does the answer.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The answer is a question', html: '<p>Same items, same programs, opposite best design. Nothing in the code decides it: “which message is it?” is the answer.[[src:var]]</p>' },
        { step: 2, title: 'Where it flips', html: '<p>Holding a loss at 20, the designs tie when a duplicate costs 20, and at-least-once starts losing at 21: exactly where the two prices cross.[[src:var]]</p>' }
      ],
      narration: [
        'Same items, same two programs. Now the message is you have been charged: a duplicate costs 50, a loss 2. Which design should it use? Choose an answer.',
        'Record first: at most once. Its expected cost is 2.0, against 50.0. The better design is opposite for the two messages, and nothing in the code decides it.',
        'And the flip is exactly where the prices cross. Holding a loss at 20, the designs tie when a duplicate costs 20, and at-least-once starts losing at 21.'
      ]
    },

    /* ---------- 12 · examples ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '12 · Writing the program · the worked examples',
      heading: 'Twenty-one examples, each priced for both messages',
      stand: 'A table of inputs and expected answers, including an empty queue, one item, a crash at every item, and a 20,000-item queue.',
      question: { step: 0, prompt: 'A 20,000-item queue is killed at item 10,000, sending first. How many people are told twice?', options: [
        { text: 'Exactly one.', correct: true, why: 'One crash straddles one item, however long the queue: item 10,000 is sent twice.' },
        { text: 'About half of them, 10,000.', correct: false, why: 'Only the item the crash landed on is repeated. Everything before it was recorded.' },
        { text: 'None, because the queue is so long.', correct: false, why: 'Length does not help. The straddled item is still sent twice.' } ] },
      code: P.build({ before: W(DATA, ...RUN, R_POS, R_DEDUPE, TALLY, COST), add: [EXTRA, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Checked twice, priced twice', html: '<p>All 21 rows agree with the send sequence their order forces. Each row is priced for both messages, so it shows which message it is acceptable for.[[src:var]]</p>' } ],
      narration: [
        'Next, the worked examples. A 20,000-item queue is killed at item 10,000, sending first. How many people are told twice? Choose an answer.',
        'Exactly one. However long the queue, one crash straddles one item. Here are the extra inputs, the table of 21 examples, and the function that checks them.',
        'All 21 rows agree with the sequence their order forces, and each is priced for both messages, so you can read which message it suits.'
      ]
    },

    /* ---------- 13 · main part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · the measurements',
      heading: 'Every crash point, both orders, and the dedupe set',
      stand: 'The last function runs everything and asserts each claim.',
      question: { step: 0, prompt: 'Why assert that the dedupe versions send identical sequences to the two plain orders?', options: [
        { text: 'To prove the set is not a third option.', correct: true, why: 'If any crash point differed, the set would be doing something new. It never does: 9 of 9, both ways.' },
        { text: 'To check the set uses little memory.', correct: false, why: 'Memory is not measured here. The claim is about what the phone receives.' },
        { text: 'Because the set is never used.', correct: false, why: 'It is used, and that is why it matters that the result is the same.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, ...RUN, R_POS, R_DEDUPE, TALLY, COST, SHOW), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'What is asserted', html: '<p>With no crash, all four orders send all nine. At all 9 crash points each order fails in exactly one direction. The dedupe set matches the plain orders 9 of 9. A far-end key rescues send first only.[[src:var]]</p>' } ],
      narration: [
        'Now main. Why does it assert that the dedupe versions send identical sequences to the two plain orders? Choose an answer.',
        'To prove the set is not a third option. Here is the first half of main: the clean run, every crash point in both orders, the dedupe comparison, and the far-end key.',
        'Each order fails in exactly one direction at every crash point; the dedupe set matches them 9 of 9; and the key rescues sending first, but never recording first.'
      ]
    },

    /* ---------- 14 · main part 2 ---------- */
    {
      title: 'Rest', layout: 'code',
      eyebrow: '14 · Writing the program · the choice, and random queues',
      heading: 'Price both messages, find the flip, then test at random',
      stand: 'The rest of main prices both messages, measures where the answer flips, checks the boundaries, and tries 300 random queues.',
      question: { step: 0, prompt: 'Why assert that the two messages choose different designs?', options: [
        { text: 'Because the whole answer collapses if they do not.', correct: true, why: 'The point of the variation is that the message decides. If both chose the same, the code would decide after all.' },
        { text: 'Because different designs are always better.', correct: false, why: 'Nothing is always better. Each message picks the design that suits its prices.' },
        { text: 'To use both functions at least once.', correct: false, why: 'Both are used anyway. The assertion pins down the lesson.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, ...RUN, R_POS, R_DEDUPE, TALLY, COST, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'No queue short enough', html: '<p>An empty queue sends nothing; a one-item queue crashed on its item sends it twice one way and never the other. 300 random queues confirm the rule.[[src:var]]</p>' } ],
      narration: [
        'The rest of main. Why does it assert that the two messages choose different designs? Choose an answer.',
        'Because otherwise the whole answer collapses. Here are the lines: the expected costs for both messages, the flip at 21, the boundaries, and 300 random queues.',
        'Even a one-item queue crashed on its only item sends it twice one way and never the other. There is no queue short enough for the problem to disappear.'
      ]
    },

    /* ---------- 15 · whole ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '15 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece written, and why.',
        'From the top: the items and the two price lists, the examples, the worker with its four orders, the tally, the expected cost, and the checks.'
      ]
    },

    /* ---------- 16 · output ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch05_v4.py prints'),
      narration: [
        'Here is what it prints: the 21 examples, then the crash during item 3, item 3 sent twice one way and never the other, and the dedupe set matching both orders 9 of 9.',
        'Then the expected costs: the parcel message picks at-least-once and the charge message at-most-once, the flip at 21, and the last line: all assertions passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'When every tool is gone, the message chooses',
      stand: 'Each idea, in a sentence.',
      table: {
        columns: ['Idea', 'What it means', 'Crash during item 3'],
        rows: [
          { step: 0, cells: ['send, then record', 'At-least-once: the straddled item is sent twice.', 'item 3 twice'] },
          { step: 0, cells: ['record, then send', 'At-most-once: the straddled item is never sent.', 'item 3 never'] },
          { step: 1, cells: ['a set of sent items', 'The same two orders with the record moved: identical 9 of 9.', 'same as above'] },
          { step: 1, cells: ['a far-end key', 'Would rescue send first only. The push service has none.', 'exact, if it existed'] },
          { step: 2, cells: ['the choice', 'Parcel notice: at-least-once (1.0 against 20.0). Charge notice: at-most-once (2.0 against 50.0).', '—'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Part 8 is the chapter’s system design interview: a payment pipeline that must charge a card exactly once, built one component at a time.[[src:ch]]</p>' },
      narration: [
        'To recap. Send then record is at-least-once: the straddled item is sent twice. Record then send is at-most-once: it is never sent.',
        'A set of sent items is the same two orders with the record moved. A key at the far end would rescue sending first, but the push service has none.',
        'So the message chooses. A parcel notice picks at-least-once, 1.0 against 20.0. A charge notice picks at-most-once, 2.0 against 50.0.',
        'Next, part 8: the chapter’s system design interview, a payment pipeline that must charge a card exactly once.'
      ]
    }
  ]
};
