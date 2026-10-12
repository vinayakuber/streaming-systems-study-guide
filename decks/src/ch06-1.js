// Chapter 6, Part 1 — "The two faces of data", for a viewer who has read nothing before it.
// Two accounts, nine money-in records: the same data read as a moving list of changes (the
// stream) and as a still list of balances (the table). Every word is introduced here, the
// viewer answers before being told, and the fold is animated rather than described.
// The records come from the one seed (tools/stream_seed.js), in the order the pipeline saw
// them, so they cannot drift from the chapter's own numbers.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch06';
const E = seed.EVENTS;                                     // in arrival order
const ACC = E.map(e => e.key);
const AMT = E.map(e => e.v);
const run = {};
const AFTER = E.map(e => (run[e.key] = (run[e.key] || 0) + e.v));   // that account's balance after each record
const A_IDS = E.filter(e => e.key === 'a').map(e => e.id);
const A_AFTER = A_IDS.map(i => AFTER[i]);
const TOTAL = AMT.reduce((x, y) => x + y, 0);

if (E.length !== 9 || TOTAL !== 45 || run.a !== 24 || run.b !== 21 || A_AFTER.join() !== '5,8,10,16,24'
  || AFTER.join() !== '5,8,7,10,16,8,17,21,24' || A_IDS.join() !== '0,1,3,4,8')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Two Faces of Data',
  eyebrow: 'Streaming · Ch 6 · Part 1',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['account', 'record', 'event', 'stream', 'append-only', 'fold', 'table', 'state', 'duality',
    'database', 'audit table', 'event log', 'stream processor', 'lag', 'drift'],
  sources: {
    ch:   chapter(CH, 'Chapter 6 on GitHub'),
    faces: section(CH, 'The two faces of data', 'Chapter 6 · the two faces of data'),
    why:  section(CH, 'Why these are two views rather than two kinds of data', 'Chapter 6 · two views, not two kinds'),
    when: section(CH, 'When to reach for each view, and what the choice commits you to', 'Chapter 6 · when to reach for each view'),
    walk: section(CH, 'Visual walkthrough — the stream, the table, and the shared total', 'Chapter 6 · the shared total'),
    mem:  section(CH, 'One dataset, two shapes — stack and heap at every step', 'Chapter 6 · one dataset, two shapes')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['account', 'record'],
      eyebrow: '01 · Chapter 6 · Part 1',
      heading: 'Two accounts, nine payments, and two ways to write them down',
      hero: { step: 0, text: 'A small payments app holds money for two <b>accounts</b>, named <code>“a”</code> and <code>“b”</code>. Every time money comes in, the app writes one line, called a <b>record</b>: which account, and how much, such as “account a: +5”.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'records written so far[[src:why]]' },
        { step: 1, value: 2, label: 'accounts, “a” and “b”[[src:why]]' },
        { step: 2, value: TOTAL, label: 'money paid in, in total[[src:walk]]' },
        { step: 2, value: run.a, label: 'the balance of account “a” now[[src:why]]' }
      ],
      cardsLabel: 'Three questions the app is asked',
      cards: [
        { step: 3, n: 1, title: 'What is the balance of “a” now?', text: 'Asked every time someone opens the app.' },
        { step: 3, n: 2, title: 'What happened, in order?', text: 'Asked when something looks wrong.' },
        { step: 4, n: 3, title: 'Was the balance of “a” ever 8?', text: 'Asked by an auditor, about the past.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A small payments app holds money for two accounts, named “a” and “b”. Every time money comes in, the app writes one line, called a record: which account, and how much.',
        'So far it has written 9 records, for the 2 accounts. Records are never changed or rubbed out. A new one is only ever added at the end.',
        'Altogether the 9 records bring in 45, and the balance of account “a” is now 24. We will reach both numbers ourselves.',
        'The app is asked three kinds of question. What is a balance now? And what happened, in order, when something looks wrong?',
        'And was a balance ever some value, such as 8, for an auditor asking about the past? This part shows two ways to keep the same data, and which questions each can answer.'
      ]
    },

    /* ---------- 2 · the records ---------- */
    {
      title: 'Recs', layout: 'array', defines: ['event', 'stream', 'append-only'],
      eyebrow: '02 · The nine records, in the order they arrived',
      heading: 'A list of things that happened',
      stand: 'Top row: the record ids, numbered from 0 in the order the app saw them. Below: which account received money, and how much.',
      array: {
        labelWidth: 150, slotLabel: 'record id',
        rows: [ { label: 'account', values: ACC }, { label: 'money in', values: AMT } ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [2] },
          { step: 2, do: 'pick', slots: [8] }
        ]
      },
      cards: [
        { step: 3, title: 'Event', html: '<p>One thing that happened: here, one payment arriving.</p>' },
        { step: 3, title: 'Stream', html: '<p>The events in the order they happened, one after another. It answers “what happened”.[[src:faces]]</p>' },
        { step: 3, title: 'Append-only', html: '<p>New events are only added at the end; old ones are never changed.[[src:faces]]</p>' }
      ],
      narration: [
        'Here are the records, numbered from zero in the order they arrived. Record 0: account “a” received 5. Record 1: account “a” received 3 more.',
        'Record 2, highlighted, is the first for account “b”: 7. Then “a” gets 2 and 6, and “b” gets 1, 9 and 4. The two accounts are mixed together.',
        'The last record, number 8, gives “a” another 8. Nine records in all, and not one of them says what a balance is.',
        'Three words for this. Each payment is an event. The events in the order they happened form a stream. And because the stream only grows at the end, it is called append-only.'
      ]
    },

    /* ---------- 3 · question: the balance now ---------- */
    {
      title: 'Q1', layout: 'ask',
      eyebrow: '03 · Your turn',
      heading: 'The stream holds payments, not balances',
      stand: 'Someone opens the app and asks for the balance of account “a”. All you have is the stream of nine records.',
      question: {
        step: 0,
        prompt: 'What is the balance of account “a” now, and how do you get it from the stream?',
        options: [
          { text: '24: add up every amount sent to “a”, in records 0, 1, 3, 4 and 8.', correct: true,
            why: '5, 3, 2, 6 and 8 add up to 24. No record says “a is 24”; you have to add them up.' },
          { text: '8: read the last record for “a”, which is record 8.', correct: false,
            why: 'Record 8 says how much came in last, not what the balance is. Each record is a change.' },
          { text: '45: add up all nine amounts in the stream, start to end.', correct: false,
            why: '45 includes the payments to “b” too. Only the records for “a” count towards its balance.' }
        ]
      },
      cards: [
        { step: 1, title: 'No line holds the answer', html: '<p>Each record is a <b>change</b>. The balance is the sum of every change to “a”: <b>24</b>.[[src:why]]</p>' },
        { step: 2, title: 'Every record must be read', html: '<p>To be sure you have every payment to “a”, all 9 records are read, even those for “b”.[[src:mem]]</p>' }
      ],
      narration: [
        'First question. Someone asks for the balance of account “a” now. All you have is the stream. What is the balance, and how do you get it? Choose an answer.',
        'It is 24, from adding every amount sent to “a”: 5, 3, 2, 6 and 8. No record says the balance. Each record is only a change, so the balance has to be worked out.',
        'And to be sure no payment to “a” is missed, every one of the 9 records must be read. Let us watch that happen.'
      ]
    },

    /* ---------- 4 · the fold, animated ---------- */
    {
      title: 'Fold', layout: 'array', defines: ['fold'],
      eyebrow: '04 · Watch the stream being read',
      heading: 'Read every record, keep a running balance per account',
      stand: 'Top row: the record ids. Then the account, the amount, and that account’s balance after the record.',
      array: {
        labelWidth: 150, slotLabel: 'record id',
        rows: [
          { label: 'account', values: ACC },
          { label: 'money in', values: AMT },
          { label: 'balance after', values: AFTER }
        ],
        meters: ['records read', 'money added so far'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 2, do: 'show', rows: [2] },
          { step: 3, do: 'pick', slots: [7, 8] }
        ]
      },
      cards: [
        { step: 2, title: 'A fold', html: '<p>Walking the stream in order and keeping a running result for each account is called a <b>fold</b>. “a” goes 5, 8, 10, 16, 24.[[src:mem]]</p>' },
        { step: 3, title: 'The last value is “now”', html: '<p>“b” last changed at record 7: <b>21</b>. “a” last changed at record 8: <b>24</b>.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the nine records again, in arrival order: which account, and how much. The numbers along the top are the record ids, from 0 to 8.',
        'Watch the pointer read every record and add up the amounts. Nine records read, 45 added in total. There is no shortcut: the stream holds changes, not balances.',
        'Now keep a running balance for each account as you go. The third row shows each account’s balance after each record: “a” goes 5, 8, 10, 16, 24. Doing this is called a fold.',
        'The last balance of each account is its balance now: 21 for “b”, after record 7, and 24 for “a”, after record 8. To get it, the fold had to read the whole stream.'
      ]
    },

    /* ---------- 5 · the table ---------- */
    {
      title: 'Table', layout: 'table', defines: ['table', 'state'],
      eyebrow: '05 · Write down only the result',
      heading: 'Nine records become two rows',
      stand: 'Keep just the final balance of each account, one line per account.',
      table: {
        columns: ['Account', 'Balance now', 'Records folded into it'],
        rows: [
          { step: 0, cells: ['“a”', `<b>${run.a}</b>`, 'records 0, 1, 3, 4, 8'] },
          { step: 0, cells: ['“b”', `<b>${run.b}</b>`, 'records 2, 5, 6, 7'] }
        ]
      },
      side: { step: 1, title: 'Two more words', html: '<ul class="l"><li><b>Table</b> — one row per account, holding what is true now. It answers “what is true now”.[[src:faces]]</li><li><b>State</b> — what is true at one moment: here, the two balances.[[src:faces]]</li></ul><p>Reading “a” from the table is one look-up: no adding at all.[[src:when]]</p>' },
      narration: [
        'Now keep only the result of the fold: one line per account. Account “a” holds 24 and account “b” holds 21. Nine records have become two rows.',
        'This is called a table: one row per account, holding what is true now. What is true at one moment is called the state. A table answers “what is true now” in one look-up.',
        'So now there are two ways of writing down the same payments. The stream says what happened. The table says what is true now. Are they really the same data?'
      ]
    },

    /* ---------- 6 · question: the shared total ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['duality'],
      eyebrow: '06 · Your turn',
      heading: 'Did anything go missing?',
      stand: 'The stream has 9 records adding to 45. The table has 2 rows: 24 and 21.',
      question: {
        step: 0,
        prompt: 'Add the table’s two balances. How does that compare with adding all nine amounts in the stream?',
        options: [
          { text: 'They are equal: 24 + 21 is 45, the same as the stream.', correct: true,
            why: 'The fold only regrouped the payments by account. Nothing was added and nothing was lost.' },
          { text: 'The table is smaller, because it dropped seven records.', correct: false,
            why: 'The seven records were not dropped: their amounts are inside the two balances.' },
          { text: 'The table is larger, because a balance counts old money again.', correct: false,
            why: 'Each payment is counted once, in exactly one account’s balance.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The same total, two shapes', html: '<p>45 over 9 records, and 45 over 2 rows. Neither view invented or lost money.[[src:walk]]</p>' },
        { step: 2, title: 'Duality', html: '<p>Two views of one dataset, arranged for different questions, is called the <b>duality</b> of streams and tables. The stream is the table’s history; the table is the stream’s present.[[src:faces]]</p>' }
      ],
      narration: [
        'Second question. The stream has nine records adding to 45. The table has two rows, 24 and 21. Add the table’s rows. How does that compare? Choose an answer.',
        'They are equal: 24 plus 21 is 45. The fold only grouped the payments by account. Nothing was invented and nothing was lost.',
        'Two views of one dataset, each arranged for different questions, is called the duality of streams and tables. The stream is the table’s history, and the table is the stream’s present.'
      ]
    },

    /* ---------- 7 · question: was it ever 8 ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '07 · Your turn',
      heading: 'A question about the past',
      stand: 'An auditor asks: was the balance of account “a” ever exactly 8?',
      question: {
        step: 0,
        prompt: 'Which of the two views can answer “was the balance of “a” ever 8”?',
        options: [
          { text: 'Only the stream: the table holds 24 for “a” and nothing else.', correct: true,
            why: 'The table keeps the latest balance only. The balances “a” passed through are not in it.' },
          { text: 'The table: 8 is below 24, so “a” must have passed through 8.', correct: false,
            why: '“a” could have jumped from 5 straight to 10. Only the payments themselves say which values it held.' },
          { text: 'Neither: an old balance is gone once it changes.', correct: false,
            why: 'The stream still has every payment, so every old balance can be worked out again.' }
        ]
      },
      narration: [
        'Third question, about the past. An auditor asks: was the balance of account “a” ever exactly 8? Which view can answer? Choose an answer.',
        'Only the stream. The table holds 24 for “a”, and nothing else. A balance below 24 proves nothing: “a” could have jumped past 8. Let us check it in the stream.'
      ]
    },

    /* ---------- 8 · was it ever 8, animated ---------- */
    {
      title: 'Ever', layout: 'array',
      eyebrow: '08 · Watch the stream answer it',
      heading: 'Replay the balance of “a” and look for 8',
      stand: 'Only the five records for account “a”, with its balance after each one. The table, by contrast, holds one number for “a”: 24.',
      array: {
        labelWidth: 150, slotLabel: 'change of “a”',
        rows: [
          { label: 'record id', values: A_IDS },
          { label: 'balance after', values: A_AFTER }
        ],
        meters: ['balances checked', 'times it was 8'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 8, readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 1, title: 'Yes, at record 1', html: '<p>The fold passes through 8 right after record 1: 5, then 5 + 3 = <b>8</b>.[[src:mem]]</p>' },
        { step: 2, title: 'The table forgot it', html: '<p>The value 8 existed, and the table does not contain it. Nobody deleted it; the table simply only keeps the present.[[src:mem]]</p>' }
      ],
      narration: [
        'Here are only the five records for account “a”, with its balance after each one. The table, by contrast, has a single number for “a”: 24.',
        'Watch the pointer replay the balances and compare each with 8. Five checked, one match: right after record 1, “a” held 5 plus 3, which is 8.',
        'So the answer is yes. The value 8 really existed, and the table does not contain it. Nobody threw it away on purpose. A table only ever keeps the present.'
      ]
    },

    /* ---------- 9 · what each view gives up ---------- */
    {
      title: 'Cost', layout: 'cards',
      eyebrow: '09 · What each view gives up',
      heading: 'Cheap for one question, blind to another',
      stand: 'Same data, two arrangements. Here is the precise price of each.',
      bars: { step: 1, label: 'Reads needed to answer “what is the balance of “a” now?”', items: [
        { label: 'stream: records read', value: 9 }, { label: 'table: rows looked up', value: 1 } ] },
      columns: 3,
      cards: [
        { step: 0, title: 'The table forgot', html: '<p>The <b>order</b> of the payments, and every <b>in-between balance</b>. “Was it ever 8?” cannot be answered from it at any cost.[[src:why]]</p>' },
        { step: 1, title: 'The stream gave up', html: '<p>Cheap look-ups. Every current balance is a fold over all 9 records, even to answer about 2 accounts.[[src:why]]</p>' },
        { step: 2, title: 'And the gap grows', html: '<p>Every new payment adds a record to the stream, but no row to the table. The fold gets longer; the look-up does not.[[src:when]]</p>' }
      ],
      narration: [
        'Here is the price of each view. The table forgot two things: the order of the payments, and every in-between balance. A question about history cannot be answered from it at any cost.',
        'The stream gave up cheap look-ups. Every current balance is a fold over all nine records, even though there are only two accounts. The table needs one look-up.',
        'And the difference grows. Each new payment adds a record to the stream, but not a row to the table. The fold gets longer every day; the look-up never does.'
      ]
    },

    /* ---------- 10 · question: the database side ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['database', 'audit table'],
      eyebrow: '10 · Your turn',
      heading: 'A bank that keeps only balances',
      stand: 'A bank keeps its accounts in a database: a program that stores tables and answers questions about them. It stores the 2 balances and nothing else.',
      question: {
        step: 0,
        prompt: 'An auditor asks this bank what happened to account “a”, in order. What must the bank have done in advance?',
        options: [
          { text: 'Kept a second table of every change, written as each payment arrived.', correct: true,
            why: 'History that was never written down cannot be rebuilt from today’s balances. It has to be kept on purpose.' },
          { text: 'Nothing: the history can be worked back out from the balance of 24.', correct: false,
            why: '24 could come from many different payments. The order and the steps are not in the balance.' },
          { text: 'Kept a backup copy of the balances table.', correct: false,
            why: 'A copy of the present is still the present. It holds 24 for “a”, not how “a” got there.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'An audit table', html: '<p>A second table that records every change is called an <b>audit table</b>. Someone has to build it, and keep it in step with the real one.[[src:why]]</p>' },
        { step: 2, title: 'The database picked the table side', html: '<p>A <b>database</b> stores the 2 rows. History exists only if someone built an audit table.[[src:faces]]</p>' }
      ],
      narration: [
        'Fourth question. A bank keeps its accounts in a database, a program that stores tables. It stores the two balances and nothing else. What must it have done to answer an auditor? Choose an answer.',
        'Kept a second table of every change, written as each payment arrived. That is called an audit table. History that was never written down cannot be rebuilt from a balance of 24.',
        'So a database picks the table side: it stores the two rows, and has history only if someone built it deliberately, and keeps it in step with the real table.'
      ]
    },

    /* ---------- 11 · the industry split ---------- */
    {
      title: 'Sides', layout: 'graph', defines: ['event log', 'stream processor'],
      eyebrow: '11 · Who keeps which view',
      heading: 'Two kinds of system, and one that sits between them',
      stand: 'Each box keeps one view as its own data. The arrow shows a view being made from the other.',
      graph: {
        viewBox: '0 0 1520 300', legend: false,
        nodes: [
          { id: 'log', x: 40, y: 90, w: 360, h: 110, title: 'Event log', sub: 'keeps the stream', kind: 'main', step: 0, src: 'faces', values: ['9 records, in order'] },
          { id: 'proc', x: 580, y: 90, w: 360, h: 110, title: 'Stream processor', sub: 'reads the stream, folds it', kind: 'new', step: 1, src: 'why', values: [null, 'a running fold'] },
          { id: 'db', x: 1120, y: 90, w: 360, h: 110, title: 'Database', sub: 'keeps the table', kind: 'main', step: 2, src: 'faces', values: [null, null, '2 rows: a 24, b 21'] }
        ],
        edges: [
          { from: 'log', to: 'proc', kind: 'main', step: 1, label: 'each new record' },
          { from: 'proc', to: 'db', kind: 'new', step: 2, label: 'updated balance' }
        ]
      },
      notes: [
        { step: 3, html: '<b>Not “which technology”.</b> The real question is which view is the source, and which is made from it.[[src:why]]' },
        { step: 3, html: '<b>Neither is first by nature.</b> The stream earns that role because folding it into a table is cheap.[[src:why]]' },
        { step: 3, html: '<b>Between them</b>, the stream processor turns each new record into an updated balance.[[src:why]]' }
      ],
      narration: [
        'On the left, an event log: a system that keeps the stream itself, all nine records in order. Every balance is a fold, done when someone asks.',
        'In the middle, a stream processor: a program that reads each new record as it arrives and keeps the fold running, so the balances are always ready.',
        'On the right, the database, keeping the table: two rows, 24 for “a” and 21 for “b”. One system keeps the stream, one keeps the table, and one turns the first into the second.',
        'So “database or event log?” is usually the wrong question. The real one is which view is the source, and which is made from it. Neither is first by nature.'
      ]
    },

    /* ---------- 12 · question: two writers ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['lag', 'drift'],
      eyebrow: '12 · Your turn · check yourself',
      heading: 'One payment, written in two places',
      stand: 'A team writes every payment twice, by two separate pieces of code: once into the event log, and once into the database balance.',
      question: {
        step: 0,
        prompt: 'What is the danger of writing both views independently, instead of making one from the other?',
        options: [
          { text: 'They can disagree, and nothing would ever notice.', correct: true,
            why: 'If one write fails or has a bug, both stores still answer confidently, with different numbers.' },
          { text: 'The balances would arrive a little late.', correct: false,
            why: 'Lateness is the harmless problem: a view made from the other is behind, then catches up.' },
          { text: 'None: two copies are safer than one.', correct: false,
            why: 'Two copies with no rule linking them are two opinions. There is no way to tell which is right.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Lag: visible and bounded', html: '<p>A view made from the other can be behind by some amount, then catch up. That is called <b>lag</b>.[[src:when]]</p>' },
        { step: 2, title: 'Drift: silent and unbounded', html: '<p>Two stores written separately slowly disagree, with nothing to detect it. That is called <b>drift</b>. Choose the source once; make the other from it.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. A team writes every payment twice, by two separate pieces of code: into the event log, and into the database. What is the danger? Choose an answer.',
        'They can disagree, and nothing notices. A view made from the other can only be behind and then catch up; that is called lag, and it is visible and bounded.',
        'Two stores written separately can drift: they disagree without limit, silently, and both answer confidently. So choose the source once, and make the other view from it.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'One dataset, two shapes, and the question decides which',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Stream</b>', 'Events in order, append-only. Answers “what happened”: 9 records here.[[src:faces]]'] },
          { step: 0, cells: ['<b>Table</b>', 'One row per account, the state now. Answers “what is true now”: 2 rows.[[src:faces]]'] },
          { step: 1, cells: ['<b>Fold</b>', 'Read the stream in order, keep a running result: “a” 24, “b” 21.[[src:mem]]'] },
          { step: 1, cells: ['<b>Duality</b>', 'Both views total 45: the same data, arranged for different questions.[[src:walk]]'] },
          { step: 2, cells: ['<b>What is lost</b>', 'The table forgets order and in-between values: “was “a” ever 8?” needs the stream.[[src:why]]'] },
          { step: 2, cells: ['<b>Lag and drift</b>', 'A view made from the other lags; two independent writers drift.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>Folding turns a stream into a table. Can a table be turned back into a stream — and do you get the original payments back? Part 2 shows when you do, and when you cannot.[[src:when]]</p>' },
      narration: [
        'To recap. A stream is events in order, only ever added to; it answers what happened. A table holds one row per account, the state now; it answers what is true now.',
        'A fold reads the stream in order and keeps a running result: 24 for “a”, 21 for “b”. Both views total 45. That is the duality: one dataset, two shapes.',
        'The table forgets the order and every in-between value, so history needs the stream. And a view made from the other only lags, while two independent writers drift.',
        'Next, part 2 goes the other way: from a table back to a stream. Do you get the original payments back? Sometimes, and part 2 shows exactly when.'
      ]
    }
  ]
};
