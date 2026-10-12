// Chapter 5, Part 9 — the chapter's two "Interview Questions", explored in depth, then the
// chapter quiz and a recap of the whole chapter. Each interview question is told as a story,
// probed from several sides (what went wrong and why, which mechanism, what it costs, what
// breaks without a piece, the same question with other numbers), and its code snippet is
// built line by line, a question before each line. The snippet lines come from the chapter
// source (content/ch05-*.js) through _prog.js, addressed by content, so nothing is retyped.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch05';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const Q1_HEAD = Q1.line('order-4 charge 6'), Q1_FIRST = Q1.line('attempt 1'), Q1_RETRY = Q1.line('retry      ->'), Q1_NOKEY = Q1.line('without key');
const Q2_HEAD = Q2.line('all 9 seed events folded'), Q2_REPLAY = Q2.line('replay re-delivers'), Q2_SET = Q2.line('sink upserts'), Q2_RES = Q2.line('total stays 45');

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS;
const TOTAL = E.reduce((s, e) => s + e.v, 0);
const REPLAY = E.slice(5);
const REPLAY_V = REPLAY.reduce((s, e) => s + e.v, 0);
const clock = sec => seed.hhmmss(sec);
const winLabel = w => `${clock(w).slice(0, 5)}–${clock(w + seed.WIN).slice(0, 5)}`;
const W45 = seed.winOf(E[5].et);
if (TOTAL !== 45 || REPLAY_V !== 22 || REPLAY.map(e => e.id).join() !== '5,6,7,8' || E[4].v !== 6 || seed.SUM(seed.WINDOWS[W45]) !== 7
  || winLabel(W45) !== '12:04–12:06')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

const row = e => ({ cells: [`event ${e.id}`, clock(e.et), clock(e.pt), `${e.v}`, winLabel(seed.winOf(e.et))] });

module.exports = {
  title: 'Exactly-Once Interview Drill',
  eyebrow: 'Streaming · Ch 5 · Part 9',
  ...shared,
  jargon: ['event', 'pipeline', 'crash', 'retry', 'side effect', 'timeout', 'payment processor', 'idempotency key', 'ledger',
    'replayable source', 'offset', 'event time', 'processing time', 'window', 'sink', 'seen-set', 'idempotent', 'upsert', 'exactly-once'],
  sources: {
    ch:      chapter(CH, 'Chapter 5 on GitHub'),
    meaning: section(CH, 'Why exactly-once is two guarantees, and which half is hard', 'Chapter 5 · two guarantees'),
    dedup:   section(CH, 'Why a replayable source has no substitute and the other two are redundant', 'Chapter 5 · the three guards'),
    effects: section(CH, 'Why the outside world cannot be recomputed, and what follows from that', 'Chapter 5 · side effects'),
    when:    section(CH, 'When each mechanism applies, and the one you cannot provide yourself', 'Chapter 5 · when each mechanism applies'),
    q1:      section(CH, 'Q1', 'Chapter 5 · interview question 1'),
    q2:      section(CH, 'Q2', 'Chapter 5 · interview question 2'),
    quiz:    section(CH, 'Quiz', 'Chapter 5 · quiz'),
    kt:      section(CH, 'Key Concepts', 'Chapter 5 · key concepts')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'pipeline', 'crash', 'retry'],
      eyebrow: '01 · Chapter 5 · Part 9 · the interview questions',
      heading: 'Two pipelines that counted twice, asked from every side',
      hero: { step: 0, text: 'Things that happen — an order, a click — arrive as <b>events</b>. A <b>pipeline</b>, a chain of programs on several machines, handles them. Machines <b>crash</b>, and work they cannot prove was done is sent again: a <b>retry</b>. Both interview questions are about a retry that counted something twice.[[src:q1]]' },
      tiles: [
        { step: 1, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 1, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: 6, label: 'the charge for order 4, in question 1[[src:q1]]' },
        { step: 2, value: TOTAL, label: 'the right total, in question 2[[src:q2]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'The pipeline', text: 'It charges customers’ cards from a stream of orders.' },
        { step: 3, n: 2, title: 'The incident', text: 'After a crash, some charges were retried, and customers were billed twice.' },
        { step: 4, n: 3, title: 'The question', text: 'How do you guarantee a charge happens exactly once?' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'Things that happen, like an order or a click, arrive as events, and a pipeline of programs handles them. Machines crash, and work they cannot prove was done is sent again: a retry.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then the 5 questions of the chapter quiz.',
        'Question 1 is about a charge of 6 for order 4. Question 2 is about a total that should be 45.',
        'Interview question 1. A payment pipeline charges customers’ cards from a stream of orders. After a crash, some charges were retried, and customers were billed twice.',
        'The interviewer asks: how do you guarantee a charge happens exactly once, when the pipeline can crash and retry? You will answer first, every time.'
      ]
    },

    /* ---------- 2 · Q1: what went wrong ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['side effect', 'timeout'],
      eyebrow: '02 · Interview question 1 · what went wrong, and why',
      heading: 'Why did the retry bill twice?',
      stand: 'The pipeline sent “charge order 4 for 6”, crashed before noting the reply, and on restart sent it again.',
      question: {
        step: 0,
        prompt: 'Why did the second attempt charge the card again?',
        options: [
          { text: 'The first charge had happened, and nothing in the pipeline recorded it.', correct: true,
            why: 'The money moved at the card company. The crash erased the pipeline’s only evidence, so the retry looked like a first attempt.' },
          { text: 'The card company made a mistake.', correct: false,
            why: 'It did exactly what it was asked: two requests, two charges.' },
          { text: 'The retry carried a different amount.', correct: false,
            why: 'Both attempts were for 6. Same amount, charged twice: 12.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A side effect', html: '<p>A change in the outside world — a charge, an email — is a <b>side effect</b>. Unlike a total, it cannot be worked out again; it can only be done again.[[src:effects]]</p>' },
        { step: 2, title: 'And the pipeline cannot tell', html: '<p>A reply that never comes ends in a <b>timeout</b>. A charge that timed out after succeeding looks exactly like one that failed.[[src:effects]]</p>' }
      ],
      narration: [
        'First angle: what went wrong? The pipeline sent charge order 4 for 6, crashed before noting the reply, and sent it again. Why did that charge the card again? Choose an answer.',
        'The first charge had happened, and nothing in the pipeline recorded it. A change in the outside world like this is called a side effect. It cannot be worked out again; it can only be done again.',
        'And the pipeline cannot tell. A reply that never comes ends in a timeout, and a charge that timed out after succeeding looks exactly like one that failed.'
      ]
    },

    /* ---------- 3 · Q1: the snippet, the first attempt ---------- */
    {
      title: 'Key', layout: 'code', defines: ['payment processor', 'idempotency key', 'ledger'],
      eyebrow: '03 · Interview question 1 · which mechanism · the snippet, lines 1–2',
      heading: 'Give the charge a name that survives the crash',
      stand: 'The interviewer asks: what should the first attempt carry, so that a later retry can be recognised?',
      question: { step: 0, prompt: 'What should every attempt to charge order 4 carry?', options: [
        { text: 'A fixed name from the order, “order-4”, for the card company to remember.', correct: true, why: 'Every attempt carries the same name, so the card company can see a repeat. It saw the first charge.' },
        { text: 'A fresh number for each attempt, so attempts never clash.', correct: false, why: 'Then the retry carries a new number and looks like a new charge.' },
        { text: 'The time of the attempt, so the latest one wins.', correct: false, why: 'Two attempts at different times look like two charges.' } ] },
      code: Q1.build({ add: [Q1_HEAD, Q1_FIRST], step: 1 }),
      cards: [ { step: 2, title: 'Processor, key, ledger', html: '<p>The card company’s system is the <b>payment processor</b> (the snippet’s “API”). The fixed name is an <b>idempotency key</b>. The processor’s running record of money charged is its <b>ledger</b>: 0 to 6.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: which mechanism? What should every attempt to charge order 4 carry? Choose an answer.',
        'A fixed name from the order: order 4. Here are the first lines of the chapter’s snippet: the first attempt arrives, the key is new, so the charge goes through and the ledger goes from 0 to 6.',
        'The card company’s system is the payment processor, the fixed name is an idempotency key, and the processor’s running record of money charged is its ledger.'
      ]
    },

    /* ---------- 4 · Q1: the retry ---------- */
    {
      title: 'Retry', layout: 'code',
      eyebrow: '04 · Interview question 1 · the snippet, line 3',
      heading: 'The retry, with the same key',
      stand: 'The pipeline crashes and retries: the same charge, the same key, order-4.',
      question: { step: 0, prompt: 'The processor sees a key it has already charged. What does it do?', options: [
        { text: 'Nothing new: it returns the earlier result. The ledger stays 6.', correct: true, why: 'A seen key means the work is done. The retry becomes harmless.' },
        { text: 'Charges again, then refunds the first charge.', correct: false, why: 'That still moves money twice and confuses the customer. A seen key simply does nothing.' },
        { text: 'Rejects the retry as an error, so the pipeline stops.', correct: false, why: 'The retry is normal and expected. It should succeed quietly, not fail.' } ] },
      code: Q1.build({ before: [Q1_HEAD, Q1_FIRST], add: [Q1_RETRY], step: 1 }),
      cards: [ { step: 2, title: 'Asking the only one who knows', html: '<p>The key does not make the charge itself repeatable. It moves the check to the only place that saw both attempts and survived the crash.[[src:effects]]</p>' } ],
      narration: [
        'The pipeline crashes and retries, with the same key, order 4. The processor sees a key it has already charged. What does it do? Choose an answer.',
        'Nothing new. Here is the next line: the retry arrives, the key has been seen, so it is a no-op, and the ledger stays 6.',
        'Notice what the key does. It does not make the charge repeatable. It moves the check to the only place that saw both attempts and survived the crash.'
      ]
    },

    /* ---------- 5 · Q1: without the key ---------- */
    {
      title: 'NoKey', layout: 'code',
      eyebrow: '05 · Interview question 1 · what breaks without it · the snippet, line 4',
      heading: 'The same two attempts, with no key',
      stand: 'Remove the key and run the same crash and retry.',
      question: { step: 0, prompt: 'Two attempts reach the processor with no key. What does the ledger read?', options: [
        { text: '12: both attempts are charged.', correct: true, why: 'With nothing to compare, each request is a new charge: 0 to 6 to 12.' },
        { text: '6: the processor notices the same amount.', correct: false, why: 'Equal amounts mean nothing. Many orders cost 6.' },
        { text: '0: the crash cancels both.', correct: false, why: 'The crash is in the pipeline, not at the processor.' } ] },
      code: Q1.build({ before: [Q1_HEAD, Q1_FIRST, Q1_RETRY], add: [Q1_NOKEY], step: 1 }),
      cards: [ { step: 2, title: 'The whole snippet', html: '<p>With the key: 0 → 6, then stays 6. Without it: 0 → 6 → 12, a double bill. The chapter’s solution also lists a last stage made safe to repeat by that key (a charge cannot be set like a total), a source that can re-read, and dropping repeats.[[src:q1]]</p>' } ],
      narration: [
        'Third angle: what breaks without it? Two attempts reach the processor with no key. What does the ledger read? Choose an answer.',
        'Twelve. Here is the last line: without the key, two attempts move the ledger from 0 to 6 to 12, a double bill.',
        'That is the whole snippet. The chapter also lists a last stage made safe to repeat by that same key, since a charge cannot be set like a total; a source that can re-read; and dropping repeats. Next: why the source matters.'
      ]
    },

    /* ---------- 6 · Q1: the source ---------- */
    {
      title: 'Src', layout: 'ask', defines: ['replayable source', 'offset'],
      eyebrow: '06 · Interview question 1 · the other direction',
      heading: 'What if the crash loses the order instead?',
      stand: 'The key stops a charge from happening twice. Suppose instead the crash lost order 4 before it was ever charged.',
      question: {
        step: 0,
        prompt: 'What brings a lost order back, so it is charged at all?',
        options: [
          { text: 'A source that can re-read records from a saved position.', correct: true,
            why: 'After the crash the pipeline re-reads from its saved position, so order 4 arrives again and is charged once.' },
          { text: 'The idempotency key.', correct: false,
            why: 'The key can only stop a repeat. It cannot produce a charge that was never requested.' },
          { text: 'The processor, which notices the missing order.', correct: false,
            why: 'The processor knows only what it was asked. A charge never sent is invisible to it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Replayable source, offset', html: '<p>The saved reading position is the <b>offset</b>; a source that can read again from it is a <b>replayable source</b> — in the wild, a Kafka offset.[[src:q1]]</p>' },
        { step: 2, title: 'Twice and never are different problems', html: '<p>The key prevents twice; replay prevents never. Exactly once needs both.[[src:dedup]]</p>' }
      ],
      narration: [
        'Fourth angle, the other direction. Suppose the crash lost order 4 before it was ever charged. What brings it back, so it is charged at all? Choose an answer.',
        'A source that can re-read from a saved position. That position is the offset, and a source that can read again from it is a replayable source.',
        'So twice and never are different problems. The key prevents twice; replay prevents never. Exactly once needs both.'
      ]
    },

    /* ---------- 7 · Q2: the story and the two clocks ---------- */
    {
      title: 'Q2', layout: 'table', defines: ['event time', 'processing time', 'window'],
      eyebrow: '07 · Interview question 2 · the story',
      heading: 'A metrics pipeline whose counts doubled',
      stand: 'Interview question 2. A pipeline adds up per-window totals from nine events. After a crash it re-reads from its saved offset — and the totals downstream come out doubled.',
      table: {
        columns: ['Event', 'Happened at', 'Seen at', 'Value', 'Window'],
        rows: [
          { step: 0, ...row(E[0]) }, { step: 0, ...row(E[1]) }, { step: 0, ...row(E[4]) },
          { step: 1, cells: ['<b>event 5</b>', clock(E[5].et), 'a few seconds later', '<b>1</b>', '<b>' + winLabel(W45) + '</b>'] },
          { step: 1, ...row(E[7]) }, { step: 1, ...row(E[8]) }
        ]
      },
      side: { step: 2, title: 'Two clocks, and windows', html: '<ul class="l"><li><b>Event time</b> — when it happened.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li>A <b>window</b> is a two-minute stretch of event time with its own total. 12:04–12:06 holds events 4 and 5: <b>7</b>.[[src:q2]]</li></ul>' },
      narration: [
        'Interview question 2. A metrics pipeline adds up totals from nine events. Each event has two times: when it happened, and when the pipeline saw it. Event 0 happened at 12:00:01.',
        'Event 5 happened at 12:04:20 and was seen five seconds later. Event 7 happened at 12:00:50, but was seen almost four minutes later. All nine values add up to 45.',
        'The time something happened is its event time; the time the pipeline saw it is its processing time. Totals are kept per two minutes of event time, called a window. The 12:04 window holds 7.'
      ]
    },

    /* ---------- 8 · Q2: why the counts double ---------- */
    {
      title: 'Twice', layout: 'ask', defines: ['sink'],
      eyebrow: '08 · Interview question 2 · what went wrong, and why',
      heading: 'Why did the counts double?',
      stand: 'The offset was saved after event 4, then the pipeline crashed. On restart it re-read from that offset, so events 5 to 8 arrived a second time. The last stage adds each arriving value to its window.',
      question: {
        step: 0,
        prompt: 'Why did the re-read events double the counts downstream?',
        options: [
          { text: 'The last stage adds every arrival, so each repeat counts again.', correct: true,
            why: '“Add the value” names a change. Applied twice, it changes the window twice.' },
          { text: 'The source sent the wrong events.', correct: false,
            why: 'Re-reading from the offset is correct and required. The problem is what happens when they arrive.' },
          { text: 'The windows were the wrong size.', correct: false,
            why: 'Any window size doubles the same way when values are added twice.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The sink', html: '<p>The last stage, which writes totals out, is the <b>sink</b>. Here it adds, so it is not safe to repeat.[[src:q2]]</p>' },
        { step: 2, title: 'The size of the damage', html: '<p>Events 5 to 8 are worth 22. Added twice, the 45 becomes <b>67</b>.[[src:meaning]]</p>' }
      ],
      narration: [
        'First angle for question 2. The offset was saved after event 4, then a crash. On restart, events 5 to 8 arrive again, and the last stage adds each arriving value. Why did the counts double? Choose an answer.',
        'Because the last stage, called the sink, adds every arrival, so each repeat counts again. Add the value names a change, and a change applied twice changes things twice.',
        'Events 5 to 8 are worth 22, so added twice, the total of 45 becomes 67.'
      ]
    },

    /* ---------- 9 · Q2: snippet lines 1–2 ---------- */
    {
      title: 'Drop', layout: 'code', defines: ['seen-set'],
      eyebrow: '09 · Interview question 2 · which mechanism · the snippet, lines 1–2',
      heading: 'Drop the repeats before they are added',
      stand: 'The interviewer asks: the re-read events carry the same ids as before. How can the pipeline use that?',
      question: { step: 0, prompt: 'Events 5, 6, 7 and 8 arrive a second time with their own ids. What can drop them?', options: [
        { text: 'A list of ids already accepted, checked as each event arrives.', correct: true, why: 'All four ids are already in the list, so all four are dropped before the sink.' },
        { text: 'A rule that drops any value seen before.', correct: false, why: 'Values say nothing about identity; two events can share a value.' },
        { text: 'Nothing: the source must not re-read.', correct: false, why: 'Re-reading is how lost events come back. It must stay.' } ] },
      code: Q2.build({ add: [Q2_HEAD, Q2_REPLAY], step: 1 }),
      cards: [ { step: 2, title: 'The seen-set', html: '<p>The list of ids already accepted is the <b>seen-set</b>. Replay re-delivers ids 5, 6, 7, 8 (worth 22); dedup drops all 4.[[src:q2]]</p>' } ],
      narration: [
        'Second angle: which mechanism? The re-read events carry the same ids as before. What can drop them? Choose an answer.',
        'A list of ids already accepted. Here are the snippet’s first lines: all nine events folded into a total of 45, the offset saved at 4, a crash, then the replay re-delivers ids 5, 6, 7 and 8.',
        'The list of ids already accepted is called the seen-set. All four re-delivered ids are in it, so dedup drops all four before they reach the sink.'
      ]
    },

    /* ---------- 10 · Q2: snippet line 3 ---------- */
    {
      title: 'Set', layout: 'code', defines: ['idempotent', 'upsert'],
      eyebrow: '10 · Interview question 2 · the snippet, line 3',
      heading: 'Write the window’s total, not a change to it',
      stand: 'The second fix is at the sink: change what it writes.',
      question: { step: 0, prompt: 'What should the sink write for the 12:04 window, so a repeat is harmless?', options: [
        { text: '“Set the 12:04 window to 7.”', correct: true, why: 'It names the result. Written again, it writes 7 over 7.' },
        { text: '“Add 1 to the 12:04 window.”', correct: false, why: 'It names a change. Written again, it adds 1 again.' },
        { text: '“Add 1, but only on weekdays.”', correct: false, why: 'A condition on the date does nothing about a repeat.' } ] },
      code: Q2.build({ before: [Q2_HEAD, Q2_REPLAY], add: [Q2_SET], step: 1 }),
      cards: [ { step: 2, title: 'Idempotent, by upsert', html: '<p>Safe to repeat is <b>idempotent</b>. Writing a row’s whole value — insert it, or replace it if it exists — is an <b>upsert</b>: SET, not += v.[[src:q2]]</p>' } ],
      narration: [
        'Third angle: a second fix, at the sink. What should it write for the 12:04 window, so a repeat is harmless? Choose an answer.',
        'Set the window to 7. Here is the next line: the sink upserts each window total, writing the result, not adding the value.',
        'Safe to repeat is called idempotent. Writing a row’s whole value, inserting it or replacing it if it exists, is called an upsert.'
      ]
    },

    /* ---------- 11 · Q2: snippet line 4, and a variation ---------- */
    {
      title: 'Total', layout: 'code',
      eyebrow: '11 · Interview question 2 · the same question, other guards · the snippet, line 4',
      heading: 'With both fixes, 45. With only one?',
      stand: 'The snippet uses both fixes. The interviewer asks: what if you had only the upsert, and no seen-set?',
      question: { step: 0, prompt: 'Replay, no seen-set, but the sink upserts window totals. What is the total?', options: [
        { text: '45: the repeats reach the sink, and rewrite the same totals.', correct: true, why: 'For a total, either guard alone is enough. The upsert makes the repeats harmless even though they arrive.' },
        { text: '67: without the seen-set, the repeats count.', correct: false, why: 'They arrive, but the sink writes 7 over 7. Nothing is added twice.' },
        { text: '23: the repeats replace the originals.', correct: false, why: 'They replace a window total with the same total. Nothing is lost.' } ] },
      code: Q2.build({ before: [Q2_HEAD, Q2_REPLAY, Q2_SET], add: [Q2_RES], step: 1 }),
      cards: [ { step: 2, title: 'Replay plus either guard', html: '<p>The total stays 45, not 67. Of 8 combinations of the three guards, the 3 with replay and at least one other guard all give 45.[[src:dedup]]</p>' } ],
      narration: [
        'Fourth angle: other guards. Suppose there is replay and an upsert sink, but no seen-set. What is the total? Choose an answer.',
        '45. Here is the last line: the total stays 45, not 67. With only the upsert, the repeats reach the sink, but rewrite the same totals.',
        'For a total, replay plus either guard is enough. Of the 8 combinations of the three guards, the 3 with replay and at least one other guard all give 45.'
      ]
    },

    /* ---------- 12 · Q2 against Q1 ---------- */
    {
      title: 'Cmp', layout: 'ask',
      eyebrow: '12 · The two questions, side by side',
      heading: 'Does question 2’s answer work for question 1?',
      stand: 'For totals, the seen-set alone was enough. Would the seen-set alone protect the card charge in question 1?',
      question: {
        step: 0,
        prompt: 'Can a seen-set alone stop order 4 being charged twice?',
        options: [
          { text: 'No: it covers only 1 of the 3 ways a charge can repeat.', correct: true,
            why: 'It dies in a crash, and a retry from the sink never passes it. Only the key covers all three.' },
          { text: 'Yes: it drops every repeat, as it did for totals.', correct: false,
            why: 'For totals, the upsert covered what it missed. A charge cannot be upserted, so its gaps show.' },
          { text: 'Yes, if it is large enough.', correct: false,
            why: 'Size is not the issue. It lives in memory, inside the pipeline, and the decisive fact lives outside.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Interchangeable for totals only', html: '<p>A total can be recomputed, so the seen-set and the upsert stand in for each other. A charge cannot, so only the key at the far end covers 3 of 3.[[src:effects]]</p>' },
        { step: 2, title: 'Prefer the key', html: '<p>Use a key whenever the outside system offers one. Two-phase commit is the fallback, expensive and fragile.[[src:when]]</p>' }
      ],
      narration: [
        'Last angle, the two questions side by side. For totals, the seen-set alone was enough. Can a seen-set alone stop order 4 being charged twice? Choose an answer.',
        'No. It covers only 1 of the 3 ways a charge can repeat: it dies in a crash, and a retry from the sink never passes it. Only the key at the far end covers all 3.',
        'For a total, the guards are interchangeable, because a total can be recomputed. For a charge they are not. Use a key whenever the outside system offers one.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask', defines: ['exactly-once'],
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'What does exactly-once mean?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What does exactly-once mean in this book?',
        options: [
          { text: 'No operation is ever retried.', correct: false, why: 'Retries are unavoidable; exactly-once is built on top of them.' },
          { text: 'Each record affects the output exactly once.', correct: true, why: 'A retried record may be delivered twice, but its contribution appears once.' },
          { text: 'The pipeline never crashes.', correct: false, why: 'Machines crash. The promise is about the output afterwards.' },
          { text: 'Every window reports exactly one total.', correct: false, why: 'That is about how often results appear, not how often an event counts.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p><b>Exactly-once</b> is the property that a retried record does not affect the output twice: 45, not 67.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What does exactly-once mean in this book? Choose an answer.',
        'Each record affects the output exactly once. Exactly-once is the property that a retried record does not affect the output twice: 45, not 67.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'Which operation is safe to repeat?',
      stand: 'Think of the 12:04 window and the sink.',
      question: {
        step: 0,
        prompt: 'Which operation is idempotent?',
        options: [
          { text: 'Add 8 to the 12:08 window.', correct: false, why: 'Twice gives 16. It names a change.' },
          { text: 'Set the 12:08 window to 8.', correct: true, why: 'It replaces the value, so running it twice has the same effect as once.' },
          { text: 'Increase a counter by one.', correct: false, why: 'Each run moves the counter again.' },
          { text: 'Append a row to a list.', correct: false, why: 'Each run adds another row.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>SET replaces the value, so running it twice has the same effect as once.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. Which of these operations is idempotent? Choose an answer.',
        'Set the 12:08 window to 8. Setting replaces the value, so running it twice has the same effect as once. The others all move something again on every run.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'The three parts',
      stand: 'Think back over both interview questions.',
      question: {
        step: 0,
        prompt: 'What are the three parts of exactly-once from start to finish?',
        options: [
          { text: 'A source, a cache in memory, and a queue between machines.', correct: false, why: 'None of these, on its own, stops a repeat or brings back a loss.' },
          { text: 'A replayable source, a deduplicating shuffle, an idempotent sink.', correct: true, why: 'And the source is required; for a total, either of the other two is enough on its own.' },
          { text: 'A sending machine, a relay machine, and a receiving machine.', correct: false, why: 'Those are roles in any message system. None is a safeguard.' },
          { text: 'A clock, a two-minute window, and a timer for each window.', correct: false, why: 'Those decide where and when totals are reported, not how often an event counts.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A replayable source, a deduplicating shuffle and an idempotent sink; the source is required, and for an aggregation either of the other two is enough.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What are the three parts of exactly-once from start to finish? Choose an answer.',
        'A replayable source, a deduplicating shuffle, and an idempotent sink. The source is required; for an aggregation, either of the other two is enough on its own.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'Why are side effects the hard part?',
      stand: 'Remember question 1: the card charged twice.',
      question: {
        step: 0,
        prompt: 'Why are side effects the hard part of exactly-once?',
        options: [
          { text: 'They are slow to carry out.', correct: false, why: 'A fast charge is just as hard to undo.' },
          { text: 'They touch the outside world and cannot be worked out again.', correct: true, why: 'A total can be recomputed; a charge or an email cannot be taken back by recomputing.' },
          { text: 'They use too much memory.', correct: false, why: 'Memory is the seen-set’s concern. A charge needs almost none.' },
          { text: 'They need a clock to run.', correct: false, why: 'Clocks decide when totals are reported, not whether an effect can be repeated.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>An email or charge cannot be undone by recomputation, so it needs idempotency or a two-phase commit.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. Why are side effects the hard part of exactly-once? Choose an answer.',
        'They touch the outside world and cannot be worked out again. An email or a charge cannot be undone by recomputing, so it needs a key, or a two-phase commit.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'Key, or two-phase commit?',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'Which is preferred for making a charge happen exactly once?',
        options: [
          { text: 'A two-phase commit, run by a coordinator.', correct: false, why: 'It works, but it is expensive, and its stuck state needs a person.' },
          { text: 'An idempotency key, checked by the processor.', correct: true, why: 'Cheap and robust: one request, and the processor decides from its own records.' },
          { text: 'A retry with no key, sent straight away.', correct: false, why: 'That is how a ledger goes from 6 to 12.' },
          { text: 'Ignoring failures, and never retrying.', correct: false, why: 'Then a charge whose reply was lost may never happen at all.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>An idempotency key is cheap and robust; a two-phase commit is expensive and fragile.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. Which is preferred for making a charge happen exactly once? Choose an answer.',
        'An idempotency key. It is cheap and robust. A two-phase commit is expensive and fragile, so it is kept for systems that offer no key.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 5, and its two interview questions',
      heading: 'Replay, a guard, and a key',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Exactly-once</b>', 'A retried record still counts once: 45, not 23 and not 67.[[src:kt]]'] },
          { step: 1, cells: ['<b>Question 1 · the key</b>', 'A charge carries order-4; the processor turns a retry into a no-op: 6, not 12.[[src:q1]]'] },
          { step: 1, cells: ['<b>Replay</b>', 'A replayable source brings lost records back. Nothing else can.[[src:dedup]]'] },
          { step: 2, cells: ['<b>Question 2 · totals</b>', 'Replay re-delivers 5 to 8 (22); a seen-set drops them, or an upsert sink rewrites the same totals: 45.[[src:q2]]'] },
          { step: 3, cells: ['<b>Totals versus effects</b>', 'For totals the guards are interchangeable; for a charge only the key covers every crash.[[src:effects]]'] }
        ]
      },
      side: { step: 3, title: 'Next · chapter 6', html: '<p>Setting a window to 8 instead of adding 8 is writing to a table instead of a stream of changes. Chapter 6 makes that duality precise.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. Exactly-once means a retried record still counts once: 45, not 23 and not 67.',
        'Question 1: every charge carries a key from the order, and the processor turns a retry into a no-op: 6, not 12. A replayable source brings back what a crash lost.',
        'Question 2: replay re-delivers events 5 to 8, and either a seen-set drops them or an upsert sink rewrites the same totals: 45.',
        'For totals the guards are interchangeable; for a charge only the key covers every crash. Next, chapter 6 shows that writing a total is writing to a table, not to a stream of changes.'
      ]
    }
  ]
};
