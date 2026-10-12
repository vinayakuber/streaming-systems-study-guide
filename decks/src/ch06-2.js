// Chapter 6, Part 2 — "The duality": moving between the two views. Stream to table by a
// fold; table to stream by change capture; why each change record must carry the old value
// as well as the new; and the part the usual statement leaves out — the round trip gives
// back the original events only when the aggregate can be undone (a sum can, a max cannot).
// The story and every word are re-introduced so the deck stands alone. Account "a"'s
// payments come from the one seed (tools/stream_seed.js), in the order the pipeline saw them.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch06';
const A = seed.EVENTS.filter(e => e.key === 'a').map(e => e.v);              // a's payments, in order
const SUMLOG = A.map((_, i) => A.slice(0, i + 1).reduce((x, y) => x + y, 0)); // running sum after each
const MAXLOG = A.map((_, i) => Math.max(...A.slice(0, i + 1)));               // running max after each
const diff = L => L.map((v, i) => v - (i ? L[i - 1] : 0));
const SUMBACK = diff(SUMLOG), MAXBACK = diff(MAXLOG);
// how many payment lists give the same max log: a record that does not move the max allows
// any payment from 0 up to the running max
const HOW_MANY = MAXLOG.reduce((n, v, i) => (i && v === MAXLOG[i - 1] ? n * (v + 1) : n), 1);
const RUN_B = seed.EVENTS.filter(e => e.key === 'b').reduce((x, e) => x + e.v, 0);

if (A.join() !== '5,3,2,6,8' || SUMLOG.join() !== '5,8,10,16,24' || MAXLOG.join() !== '5,5,5,6,8'
  || SUMBACK.join() !== '5,3,2,6,8' || MAXBACK.join() !== '5,0,0,1,2' || HOW_MANY !== 36 || RUN_B !== 21)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Folding and Capturing',
  eyebrow: 'Streaming · Ch 6 · Part 2',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B', 'CDC': 'C D C' } },
  jargon: ['account', 'record', 'event', 'stream', 'table', 'fold', 'aggregate', 'materialized view',
    'database', 'change capture', 'CDC', 'changelog', 'consumer', 'retraction', 'running max', 'invertible'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    dual:  section(CH, 'The duality', 'Chapter 6 · the duality'),
    dwhy:  section(CH, 'Why the round trip recovers the table but not always the events', 'Chapter 6 · why the round trip is conditional'),
    dwhen: section(CH, 'When the round trip is safe to rely on, and what to do when it is not', 'Chapter 6 · when the round trip is safe'),
    dwalk: section(CH, 'Visual walkthrough — fold, capture, retraction, and the lossy round trip', 'Chapter 6 · fold, capture, retraction'),
    dmem:  section(CH, 'The round trip — stack and heap at every step', 'Chapter 6 · the round trip as a program'),
    faces: section(CH, 'The two faces of data', 'Chapter 6 · the two faces of data')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['account', 'record', 'event', 'stream', 'table'],
      eyebrow: '01 · Chapter 6 · Part 2',
      heading: 'From payments to balances, and back again',
      hero: { step: 0, text: 'A small payments app holds money for two <b>accounts</b>, <code>“a”</code> and <code>“b”</code>. Each payment in is one <b>event</b>, written as one <b>record</b>: “account a: +5”. The records in arrival order are the <b>stream</b>. One row per account holding its balance now is the <b>table</b>.[[src:faces]]' },
      tiles: [
        { step: 1, value: 5, label: 'payments to account “a”: 5, 3, 2, 6, 8[[src:dwhy]]' },
        { step: 1, value: SUMLOG[4], label: 'the balance of “a” now[[src:dwhy]]' },
        { step: 2, value: 40, label: 'what a careless reader computes instead[[src:dwhy]]' },
        { step: 2, value: HOW_MANY, label: 'payment lists that one record log cannot tell apart[[src:dwhy]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'Stream → table', text: 'How do payments become a balance?' },
        { step: 3, n: 2, title: 'Table → stream', text: 'How does a changing balance become a list of records again?' },
        { step: 4, n: 3, title: 'The round trip', text: 'Going there and back: do you get the original payments?' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A small payments app holds money for two accounts, “a” and “b”. Each payment in is an event, written as one record. The records in arrival order are the stream; one row per account is the table.',
        'We will follow account “a”. It received five payments: 5, 3, 2, 6 and 8, so its balance now is 24.',
        'Along the way we will meet a careless reader that computes 40 instead of 24, and a record log that 36 different payment lists produce. Both come from the same mistake.',
        'This part asks three questions. How does the stream become the table? And how does a changing table become a stream again?',
        'And if you go there and back, do you get the original payments? The usual answer is yes. The true answer is: it depends on how the balance was worked out.'
      ]
    },

    /* ---------- 2 · question: stream to table ---------- */
    {
      title: 'Q1', layout: 'ask',
      eyebrow: '02 · Your turn · stream to table',
      heading: 'Payments in, a balance out',
      stand: 'Account “a” received 5, then 3, then 2, then 6, then 8. The table needs one number for “a”.',
      question: {
        step: 0,
        prompt: 'How do you turn the five payments to “a” into its one row in the table?',
        options: [
          { text: 'Go through them in order, keeping a running total; the last total is the row.', correct: true,
            why: 'The running total goes 5, 8, 10, 16, 24. The table keeps the final one, 24.' },
          { text: 'Take the largest payment, 8, since it is the most recent.', correct: false,
            why: 'The balance is all the money in, not one payment. 8 is only the latest change.' },
          { text: 'Copy the five payments into the row, side by side.', correct: false,
            why: 'Then the row would hold the stream again. A table row holds one current value.' }
        ]
      },
      narration: [
        'First question, stream to table. Account “a” received 5, 3, 2, 6 and 8. How do you turn those five payments into its one row in the table? Choose an answer.',
        'Go through them in order, keeping a running total, and keep the last one. Watch it happen on the next slide.'
      ]
    },

    /* ---------- 3 · the fold, animated ---------- */
    {
      title: 'Fold', layout: 'array', defines: ['fold', 'aggregate', 'materialized view'],
      eyebrow: '03 · Watch stream become table',
      heading: 'The table’s 24 is the last line of a running total',
      stand: 'Top: the payments to “a”, in order. Below: the balance after each one.',
      array: {
        labelWidth: 150, slotLabel: 'payment no.',
        rows: [ { label: 'payment', values: A }, { label: 'balance after', values: SUMLOG } ],
        meters: ['payments read', 'running total'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 600 },
          { step: 2, do: 'show', rows: [1] },
          { step: 3, do: 'pick', slots: [4] }
        ]
      },
      cards: [
        { step: 2, title: 'Fold, aggregate', html: '<p>Reading the stream in order and keeping a running result is a <b>fold</b>. Combining many values into one, like a sum or a count, is an <b>aggregate</b>.[[src:dual]]</p>' },
        { step: 3, title: 'Materialized view', html: '<p>The table is the stream’s <b>materialized view</b>: a result worked out and stored. Fold the stream again and you get the same <b>24</b>.[[src:dwhy]]</p>' }
      ],
      narration: [
        'Here are the payments to account “a”, in the order they arrived: 5, 3, 2, 6 and 8.',
        'Watch the pointer read them one by one, adding as it goes. Five payments read, and the running total ends at 24.',
        'The second row is the balance after each payment: 5, 8, 10, 16, 24. Reading in order and keeping a running result is called a fold. A sum is an aggregate: many values combined into one.',
        'The table keeps only the last line, 24. That stored result is called a materialized view of the stream. And because it is worked out from the stream, folding again always gives the same 24.'
      ]
    },

    /* ---------- 4 · question: table to stream ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['database', 'change capture', 'CDC', 'changelog'],
      eyebrow: '04 · Your turn · table to stream',
      heading: 'A bank that only keeps the table',
      stand: 'A bank keeps balances in a database, a program that stores tables. Rows are changed in place: “a” goes from 16 to 24. A fraud team wants a live feed of every change.',
      question: {
        step: 0,
        prompt: 'How can the bank give the fraud team a stream when it only stores a table?',
        options: [
          { text: 'Watch the table, and write out a record each time a row changes.', correct: true,
            why: 'Every write to the table becomes one record in a new stream, in the order the writes happened.' },
          { text: 'Send the whole table to the team every few minutes.', correct: false,
            why: 'Changes between two copies would be merged or missed. The team needs every change, in order.' },
          { text: 'It cannot: once rows are changed in place, a stream is impossible.', correct: false,
            why: 'Each change is still seen at the moment it is written. That moment is when to record it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Change capture', html: '<p>Watching a table and emitting a record per write is <b>change capture</b>, often called change-data-capture, or <b>CDC</b>. It is how a database becomes a stream.[[src:dual]]</p>' },
        { step: 2, title: 'The changelog', html: '<p>The stream it produces is the table’s <b>changelog</b>: one record per change, append-only and in order.[[src:dwalk]]</p>' }
      ],
      narration: [
        'Second question, the other direction. A bank keeps balances in a database, a program that stores tables, and changes rows in place. How can it give a fraud team a stream of every change? Choose an answer.',
        'Watch the table, and write out a record each time a row changes. This is called change capture, or change-data-capture, C D C for short. It is how a database becomes a stream.',
        'The stream it produces is called the table’s changelog: one record per change, only ever added to, in the order the changes happened.'
      ]
    },

    /* ---------- 5 · the changelog ---------- */
    {
      title: 'Log', layout: 'table',
      eyebrow: '05 · The changelog of account “a”',
      heading: 'Each record says what the balance was, and what it became',
      stand: 'The five writes to the row for “a”, as change capture writes them out.',
      table: {
        columns: ['Change', 'Old balance', 'New balance', 'Payment that caused it'],
        rows: [
          { step: 0, cells: ['1st', '0', String(SUMLOG[0]), '+5'] },
          { step: 0, cells: ['2nd', String(SUMLOG[0]), String(SUMLOG[1]), '+3'] },
          { step: 1, cells: ['3rd', String(SUMLOG[1]), String(SUMLOG[2]), '+2'] },
          { step: 1, cells: ['4th', String(SUMLOG[2]), String(SUMLOG[3]), '+6'] },
          { step: 2, cells: ['5th', `<b>${SUMLOG[3]}</b>`, `<b>${SUMLOG[4]}</b>`, '+8'] }
        ]
      },
      side: { step: 3, title: 'Old → new', html: '<p>Each record carries <b>both</b> the old value and the new one, written (16, 24). The old value is taken <i>before</i> the row is updated.[[src:dmem]]</p><p>Is the old value really needed? The new one is the balance, after all.[[src:dwhy]]</p>' },
      narration: [
        'Here is the changelog for account “a”. The first change takes it from 0 to 5. The second from 5 to 8.',
        'Then 8 to 10, and 10 to 16. Each line is one write to the table, captured as it happened.',
        'And the last: from 16 to 24. That is the update the fraud team cares about.',
        'Notice each record carries both values: the old one, taken before the row is updated, and the new one. Is the old value really needed? The new one is the balance, after all.'
      ]
    },

    /* ---------- 6 · question: the summing reader ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['consumer', 'retraction'],
      eyebrow: '06 · Your turn · why the old value matters',
      heading: 'A reader that adds up what it is told',
      stand: 'A consumer is any program that reads the changelog. This one keeps its own figure for “a” by adding each record’s value. It currently shows 16. Then a record arrives saying only “a is now 24”.',
      question: {
        step: 0,
        prompt: 'If the record carries only the new value, 24, what figure does this consumer show afterwards?',
        options: [
          { text: '40: it adds 24 to the 16 it already had.', correct: true,
            why: 'A reader that adds cannot tell “now 24” from “plus 24”. Its figure is wrong by 16.' },
          { text: '24: the record says the balance is 24.', correct: false,
            why: 'That is what a reader that overwrites would show. This one adds, so it shows 16 plus 24.' },
          { text: '8: the difference between 24 and 16.', correct: false,
            why: 'To compute 8 it would need the old value, 16, inside the record — which is exactly what is missing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Wrong by 16', html: '<p>New value only, into a reader that sums: 16 + 24 = <b>40</b>.[[src:dwhy]]</p>' },
        { step: 2, title: 'With the old value', html: '<p>The record (16, 24) means “take back 16, add 24”: 16 − 16 + 24 = <b>24</b>. Taking back the old value is a <b>retraction</b>.[[src:dwhy]]</p>' }
      ],
      narration: [
        'Third question. A consumer is any program that reads the changelog. This one adds each record’s value to its own figure, which is now 16. A record says only “a is now 24”. What does it show next? Choose an answer.',
        '40. A reader that adds cannot tell “now 24” from “plus 24”, so it adds 24 to its 16. Wrong by 16, and nothing in the record warns it.',
        'With the old value inside, the record means “take back 16, then add 24”: 16 minus 16 plus 24 is 24. Taking back the old value is called a retraction. So the old value is not decoration; it is load-bearing.'
      ]
    },

    /* ---------- 7 · question: the round trip ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '07 · Your turn · the round trip',
      heading: 'From the changelog back to the payments',
      stand: 'You have only the changelog of the balance of “a”: 5, 8, 10, 16, 24. The original payment records are gone.',
      question: {
        step: 0,
        prompt: 'Can you work out the original payments to “a” from the balances alone?',
        options: [
          { text: 'Yes: subtract each balance from the next one.', correct: true,
            why: '5 minus 0, 8 minus 5, 10 minus 8 and so on give 5, 3, 2, 6, 8: exactly the payments.' },
          { text: 'No: the payments were lost when they were added up.', correct: false,
            why: 'A sum keeps every step in the changelog, and subtraction undoes addition one step at a time.' },
          { text: 'Only the last one: 24 minus 16 is 8.', correct: false,
            why: 'The same subtraction works at every step, not just the last, giving all five payments.' }
        ]
      },
      narration: [
        'Fourth question, the round trip. You have only the changelog of the balance of “a”: 5, 8, 10, 16, 24. Can you work out the original payments from it? Choose an answer.',
        'Yes. Subtract each balance from the next one. Watch it on the next slide, and then watch the same trick fail.'
      ]
    },

    /* ---------- 8 · differences of the sum log ---------- */
    {
      title: 'Back', layout: 'array',
      eyebrow: '08 · Watch the payments come back',
      heading: 'For a sum, differences give back every payment',
      stand: 'Row 1: the changelog of the balance. Row 2: each balance minus the one before. Row 3: the payments that really arrived.',
      array: {
        labelWidth: 170, slotLabel: 'change no.',
        rows: [
          { label: 'balance (changelog)', values: SUMLOG },
          { label: 'difference', values: SUMBACK },
          { label: 'real payment', values: A }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] }
        ]
      },
      cards: [
        { step: 1, title: 'Subtraction undoes addition', html: '<p>5 − 0 = 5, 8 − 5 = 3, 10 − 8 = 2, 16 − 10 = 6, 24 − 16 = 8.[[src:dmem]]</p>' },
        { step: 2, title: 'Recovered exactly', html: '<p>[5, 3, 2, 6, 8] — the same as the real payments. Nothing was lost by adding them up.[[src:dwhy]]</p>' }
      ],
      narration: [
        'Here is the changelog of the balance of “a”: 5, 8, 10, 16, 24.',
        'Now subtract each balance from the one before it: 5, then 3, then 2, then 6, then 8. Subtraction undoes addition, one step at a time.',
        'And here are the payments that really arrived: 5, 3, 2, 6, 8. Identical. For a sum, the round trip gives back every event, exactly.'
      ]
    },

    /* ---------- 9 · question: a different aggregate ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['running max'],
      eyebrow: '09 · Your turn · a different aggregate',
      heading: 'Now the table keeps the largest payment instead',
      stand: 'A second table keeps, for each account, its largest single payment so far: a running max. For “a” the changelog reads 5, 5, 5, 6, 8.',
      question: {
        step: 0,
        prompt: 'Subtracting each value from the next gives 5, 0, 0, 1, 2. Are those the payments to “a”?',
        options: [
          { text: 'No: a payment that does not beat the max leaves no trace.', correct: true,
            why: 'The payments 3 and 2 were below 5, so the max stayed 5 and the log shows a 0 for each.' },
          { text: 'Yes: differences always give back the events.', correct: false,
            why: 'Differences undo addition only. A max is not built by adding, so subtracting does not undo it.' },
          { text: 'Yes, except that the zeros are payments of nothing.', correct: false,
            why: 'Nobody paid 0. The real payments were 3 and 2; the zeros only say the max did not move.' }
        ]
      },
      narration: [
        'Fifth question. A second table keeps each account’s largest single payment so far, a running max. For “a” its changelog reads 5, 5, 5, 6, 8. Differences give 5, 0, 0, 1, 2. Are those the payments? Choose an answer.',
        'No. The payments 3 and 2 did not beat 5, so the max stayed at 5 and left no trace. Let us put the two rows side by side.'
      ]
    },

    /* ---------- 10 · the max log, animated ---------- */
    {
      title: 'Max', layout: 'array', defines: ['invertible'],
      eyebrow: '10 · Watch the max lose two payments',
      heading: 'The same subtraction, and two payments vanish',
      stand: 'Row 1: the real payments. Row 2: the running max after each. Row 3: the differences of row 2.',
      array: {
        labelWidth: 170, slotLabel: 'payment no.',
        rows: [
          { label: 'real payment', values: A },
          { label: 'max (changelog)', values: MAXLOG },
          { label: 'difference', values: MAXBACK }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [1, 2] }
        ]
      },
      cards: [
        { step: 2, title: 'Two zeros', html: '<p>Payments 1 and 2 were 3 and 2; the max said 5 → 5 both times. The log cannot say what they were.[[src:dmem]]</p>' },
        { step: 3, title: 'Invertible, or not', html: '<p>An aggregate that can be undone, like a sum or a count, is <b>invertible</b>. A max, a min, a distinct count and a top-K are not.[[src:dwhen]]</p>' }
      ],
      narration: [
        'Here are the real payments, 5, 3, 2, 6, 8, and below them the running max after each one: 5, 5, 5, 6, 8.',
        'Now the differences of the max log: 5, 0, 0, 1, 2. Only the first one equals its payment.',
        'Look at payments 1 and 2. They were 3 and 2, but the max said 5 to 5 both times. The log keeps no trace of them.',
        'An aggregate that can be undone, like a sum or a count, is called invertible. A max is not, and neither is a min, a count of distinct values, or a top few.'
      ]
    },

    /* ---------- 11 · question: how many histories ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '11 · Your turn · how much is lost',
      heading: 'How many payment lists fit that one changelog?',
      stand: 'The max log is 5, 5, 5, 6, 8. At payments 1 and 2, numbered from 0, the max stayed 5. Payments are whole numbers, 0 or more.',
      question: {
        step: 0,
        prompt: 'How many different lists of five payments produce exactly that max changelog?',
        options: [
          { text: 'Exactly 1: the log fixes every payment.', correct: false,
            why: 'The payments of 3 and 2 could have been 4 and 0, or 5 and 5, and the log would read the same.' },
          { text: 'At least 36: any of 6 values, at two places.', correct: true,
            why: 'Each of the two hidden payments could be any value from 0 to 5: six choices, twice, makes 36.' },
          { text: 'Exactly 2: one for each zero in the differences.', correct: false,
            why: 'Each zero hides a whole range of possible payments, not just one.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Six choices, twice', html: '<p>A 5 → 5 record allows any payment from 0 to 5. Two such records: at least <b>36</b> different histories, one changelog.[[src:dwhy]]</p>' },
        { step: 2, title: 'Table always, events sometimes', html: '<p>Folding the changelog gives back the <b>table</b> for any aggregate. It gives back the <b>events</b> only for an invertible one. That is a property of the aggregate, not of streams and tables.[[src:dwhy]]</p>' }
      ],
      narration: [
        'Sixth question. The max log is 5, 5, 5, 6, 8, and it stayed at 5 twice. How many different lists of payments produce exactly that log? Choose an answer.',
        'At least 36. A record that says 5 to 5 allows any payment from 0 up to 5: six choices. Two such records give six times six, 36 histories that one changelog cannot tell apart.',
        'So the round trip always gives back the table, for any aggregate. It gives back the events only for an invertible aggregate. That depends on the aggregate, not on streams and tables.'
      ]
    },

    /* ---------- 12 · the rules ---------- */
    {
      title: 'Rules', layout: 'cards',
      eyebrow: '12 · When to rely on the round trip',
      heading: 'Four rules that follow from the two experiments',
      stand: 'Each rule is one thing you have just watched happen.',
      columns: 2,
      cards: [
        { step: 0, title: 'Changelog → table: always', html: '<p>Every record names the result, so folding the changelog rebuilds the table under any aggregate. For “a” that is 24.[[src:dwhen]]</p>' },
        { step: 1, title: 'Changelog → events: only if invertible', html: '<p>Sum, count, anything with a subtraction. Differencing recovered [5, 3, 2, 6, 8] exactly.[[src:dwhen]]</p>' },
        { step: 2, title: 'Not invertible? Keep the events', html: '<p>For a max, min, distinct count or top-K, keep the event stream itself. No later cleverness recovers what aggregating threw away: 36 histories from 5 events.[[src:dwhen]]</p>' },
        { step: 3, title: 'Always send old and new', html: '<p>Even when the only consumer you know overwrites. The cost is one field; the alternative is the 40-instead-of-24 bug when a second consumer is added.[[src:dwhen]]</p>' }
      ],
      narration: [
        'Four rules follow from what you watched. First: from changelog to table always works. Every record names the result, so folding rebuilds 24 under any aggregate.',
        'Second: from changelog back to the events works only for an invertible aggregate, such as a sum or a count. Differencing gave back 5, 3, 2, 6, 8 exactly.',
        'Third: if the aggregate is not invertible, keep the event stream itself. Nothing downstream can recover what a max threw away: 36 possible histories from 5 events.',
        'Fourth: always send old and new values in a changelog. The cost is one field. Leaving it out is the 40-instead-of-24 bug, waiting for a second consumer.'
      ]
    },

    /* ---------- 13 · question: check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'Only one consumer today',
      stand: 'Today the changelog has a single consumer, and it overwrites: it simply stores each new balance. A colleague suggests dropping the old value to save space.',
      question: {
        step: 0,
        prompt: 'Should the changelog keep carrying the old value?',
        options: [
          { text: 'Yes: a future consumer that adds would be wrong without it.', correct: true,
            why: 'The next consumer might sum. Without the old value it would show 40 where the balance is 24.' },
          { text: 'No: the only consumer overwrites, so the old value is unused.', correct: false,
            why: 'True today. But the record format outlives today’s consumers, and one field is cheap.' },
          { text: 'No: the consumer can remember the old value itself.', correct: false,
            why: 'Then every consumer rebuilds its own copy of the table — the very thing it was trying not to need.' }
        ]
      },
      narration: [
        'Last question. Today the changelog has one consumer, and it overwrites. A colleague suggests dropping the old value to save space. Should the changelog keep it? Choose an answer.',
        'Yes. The format outlives today’s consumers, and the next one may add. Without the old value it would show 40 where the balance is 24. One field is a small price for that.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Fold one way, capture the other, and check the aggregate',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Stream → table</b>', 'A fold: a running total whose last line is the row. “a” walks 5, 8, 10, 16, 24.[[src:dwhy]]'] },
          { step: 0, cells: ['<b>Table → stream</b>', 'Change capture, or CDC: one changelog record per write.[[src:dual]]'] },
          { step: 1, cells: ['<b>Old and new</b>', 'The old value is the retraction. Without it a summing consumer shows 40, not 24.[[src:dwhy]]'] },
          { step: 2, cells: ['<b>The round trip</b>', 'Always gives back the table. Gives back the events only for an invertible aggregate.[[src:dwhy]]'] },
          { step: 2, cells: ['<b>Not invertible</b>', 'A max loses payments: at least 36 histories fit one log. Keep the events.[[src:dwhen]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>Should the table be stored at all, or worked out when asked? And what does keeping the stream buy you? Part 3 prices both choices.[[src:dwhen]]</p>' },
      narration: [
        'To recap. Stream to table is a fold: a running total whose last line is the row. Table to stream is change capture: one changelog record per write.',
        'Each record carries the old value and the new. The old value is the retraction; without it, a summing consumer shows 40 instead of 24.',
        'The round trip always gives back the table, but gives back the events only for an invertible aggregate. A max fits at least 36 histories, so keep the events.',
        'Next, part 3 asks whether the table should be stored at all, or worked out on demand, and what keeping the stream buys you.'
      ]
    }
  ]
};
