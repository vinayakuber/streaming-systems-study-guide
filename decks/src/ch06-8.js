// Chapter 6, Part 8 — the chapter's "System Design Interview": keep a balance table and a
// balance-change stream as two views that cannot drift, built one component at a time. Each
// component is preceded by a question; the design is then assembled, its check is run with a
// capture deliberately missed, and it closes with what it does NOT settle. The accounts story
// and every word are re-introduced so the deck stands alone. Balances come from the one seed.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch06';
const E = seed.EVENTS;
const run = {};
const NEWV = E.map(e => (run[e.key] = (run[e.key] || 0) + e.v));     // what each write set the row to
const KEYS = E.map(e => e.key);
const CAPTURED = E.map((_, i) => (i < E.length - 1 ? 'yes' : 'no'));  // the last capture is skipped
const refold = {};
E.forEach((e, i) => { if (CAPTURED[i] === 'yes') refold[e.key] = NEWV[i]; });
const TABLE_TOTAL = run.a + run.b, REFOLD_TOTAL = refold.a + refold.b;
const A_LOG = E.filter(e => e.key === 'a').map(e => NEWV[e.id]);

if (run.a !== 24 || run.b !== 21 || TABLE_TOTAL !== 45 || REFOLD_TOTAL !== 37 || TABLE_TOTAL - REFOLD_TOTAL !== 8
  || A_LOG.join() !== '5,8,10,16,24')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Two Views, One Writer',
  eyebrow: 'Streaming · Ch 6 · Part 8',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B', 'CDC': 'C D C' } },
  jargon: ['account', 'balance', 'table', 'database', 'stream', 'fraud detection', 'drift', 'source of truth',
    'change capture', 'CDC', 'single writer', 'changelog', 'retraction', 'fold', 'stream processor', 'materialized view', 'retention'],
  sources: {
    ch:     chapter(CH, 'Chapter 6 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 6 · system design interview'),
    db:     section(CH, 'database (table)', 'Chapter 6 · the database'),
    cdc:    section(CH, 'change capture (CDC)', 'Chapter 6 · change capture'),
    cl:     section(CH, 'changelog stream', 'Chapter 6 · the changelog stream'),
    sp:     section(CH, 'stream processor (fold)', 'Chapter 6 · the stream processor'),
    sdwhy:  section(CH, 'Why a single writer is the whole guarantee', 'Chapter 6 · why a single writer'),
    sdwhen: section(CH, 'When to run the derivation each way, and the four things this does not settle', 'Chapter 6 · what this design does not settle'),
    sdmem:  section(CH, 'Two views, one writer each — stack and heap at every step', 'Chapter 6 · two views, one writer, as a program'),
    dwhy:   section(CH, 'Why the round trip recovers the table but not always the events', 'Chapter 6 · the round trip'),
    pwhen:  section(CH, 'When to materialize, when to recompute, and how the question picks the view', 'Chapter 6 · retention')
  },

  slides: [
    /* ---------- 1 · the brief, as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['account', 'balance', 'table', 'database', 'stream', 'fraud detection'],
      eyebrow: '01 · Chapter 6 · Part 8 · a system design interview',
      heading: 'A balance table, a feed of changes, and two systems that disagree',
      hero: { step: 0, text: 'A bank holds money in <b>accounts</b>, “a” and “b”. Each account’s current <b>balance</b> sits in a <b>table</b>, one row per account, kept in a <b>database</b>. A separate team runs <b>fraud detection</b>: software that watches every balance change as it happens, so it needs a <b>stream</b> — the changes, in order.[[src:sd]]' },
      tiles: [
        { step: 1, value: 2, label: 'views of the same balances: table and stream[[src:sd]]' },
        { step: 1, value: TABLE_TOTAL, label: 'total of the balances: “a” 24 + “b” 21[[src:sdwhy]]' },
        { step: 2, value: 8, label: 'the last change to “a”: 16 to 24[[src:sdwhy]]' },
        { step: 2, value: REFOLD_TOTAL, label: 'what the stream adds up to after one missed change[[src:sdmem]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Which view is the source', text: 'And how the other is made from it.' },
        { step: 3, n: 2, title: 'What each change record holds', text: 'So fraud detection can see how much a balance moved.' },
        { step: 4, n: 3, title: 'How a gap is caught', text: 'And what the design still cannot promise.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the component is shown, and at the end, what the design does not settle.[[src:sd]]' },
      narration: [
        'A bank holds money in accounts “a” and “b”. Current balances sit in a table, one row per account, in a database. A fraud team watches every change as it happens, so it needs a stream: the changes, in order.',
        'So there are two views of the same balances: the table, and the stream. Today, “a” holds 24 and “b” holds 21: 45 in total.',
        'The last change took “a” from 16 to 24, a move of 8. And at the end we will deliberately miss one change, and watch the stream add up to 37 instead of 45.',
        'The two systems were built separately, and they keep disagreeing. The design must decide which view is the source, and what each change record holds.',
        'And how a gap is caught, plus what the design still cannot promise. You will choose first, each time.'
      ]
    },

    /* ---------- 2 · the table and the update ---------- */
    {
      title: 'Rows', layout: 'table', defines: ['drift'],
      eyebrow: '02 · The data',
      heading: 'One update, seen from both sides',
      stand: 'The database row for “a” is updated in place, from 16 to 24. The fraud team needs to hear about it.',
      table: {
        columns: ['Account', 'Balance before', 'Balance after', 'What the fraud team needs'],
        rows: [
          { step: 0, cells: ['“a”', '16', `<b>${run.a}</b>`, 'a record of the change, in order[[src:db]]'] },
          { step: 1, cells: ['“b”', `${run.b}`, `${run.b}`, 'nothing: no change[[src:db]]'] }
        ]
      },
      side: { step: 2, title: 'Why they disagree today', html: '<p>The app writes the database, and separately writes a feed for the fraud team. Two writers, no rule linking them: when one write fails, the views quietly differ. That is <b>drift</b>.[[src:sdwhy]]</p>' },
      narration: [
        'Here is the data. The database row for “a” is updated in place, from 16 to 24. The fraud team needs a record of that change, in order with all the others.',
        'Account “b” holds 21 and does not change here, so there is nothing to report for it.',
        'Today the app writes the database and, separately, a feed for the fraud team. When one of the two writes fails, the views quietly differ. That silent, growing disagreement is called drift.'
      ]
    },

    /* ---------- 3 · component 1: the source ---------- */
    {
      title: 'Source', layout: 'ask', defines: ['source of truth'],
      eyebrow: '03 · Your turn · component 1, the database',
      heading: 'Which view is the source of truth?',
      stand: 'The bank already runs its database, and the app already writes balances to it. Rewriting the app is not on the table.',
      question: {
        step: 0,
        prompt: 'Which view should every other view be made from?',
        options: [
          { text: 'The database table: the app already writes it, so the stream is made from it.', correct: true,
            why: 'An existing database is already the system of record. Deriving the stream from it disturbs nothing.' },
          { text: 'The stream: rewrite the app to write changes first.', correct: false,
            why: 'Stream-first is a fine design for something new, but here it means rewriting a working app.' },
          { text: 'Both: keep writing each from the app, and compare them nightly.', correct: false,
            why: 'That is today’s design. Two writers drift; a nightly comparison only notices late.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The source of truth', html: '<p>The view every other view is made from. Here: the database table. The design runs <b>table → stream</b>.[[src:sdwhy]]</p>' },
        { step: 2, title: 'The database’s role', html: '<p>It holds the source table. The update 16 → 24 is the event the next component must capture.[[src:db]]</p>' }
      ],
      narration: [
        'First decision. The bank already runs its database, and the app already writes to it. Which view should every other view be made from? Choose an answer.',
        'The database table. The view everything else is made from is called the source of truth, and an existing database already is one. So this design runs from table to stream.',
        'The database keeps its job: holding the source table. And each update in it, like 16 to 24, is an event the next component must capture.'
      ]
    },

    /* ---------- 4 · component 2: change capture ---------- */
    {
      title: 'CDC', layout: 'ask', defines: ['change capture', 'CDC', 'single writer'],
      eyebrow: '04 · Your turn · component 2, change capture',
      heading: 'How does the stream get every change?',
      stand: 'The app must not write the stream itself, or there are two writers again.',
      question: {
        step: 0,
        prompt: 'What should produce the stream of balance changes?',
        options: [
          { text: 'A component that watches the database’s own writes and emits one record per write.', correct: true,
            why: 'Every change the database accepts is captured, in order, and the app does nothing new.' },
          { text: 'The app, writing a second message after each database write.', correct: false,
            why: 'That is two writers again. A crash between the two writes is enough to drift.' },
          { text: 'A job that copies the whole table to the fraud team every minute.', correct: false,
            why: 'Two changes inside one minute would merge, and the order between them is lost.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Change capture, or CDC', html: '<p>Watching the database’s writes and emitting a record per write is <b>change capture</b>, change-data-capture, <b>CDC</b>.[[src:cdc]]</p>' },
        { step: 2, title: 'One writer per view', html: '<p>The app writes the table; CDC writes the stream; nothing writes both. A <b>single writer</b> per view makes drift impossible rather than unlikely.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Second component. The app must not write the stream itself, or there are two writers again. What should produce the stream of changes? Choose an answer.',
        'A component that watches the database’s own writes and emits one record per write. This is called change capture, change-data-capture, or C D C.',
        'Now the app writes the table, C D C writes the stream, and nothing writes both. One writer per view, a single writer, is the whole guarantee: drift becomes impossible, not just unlikely.'
      ]
    },

    /* ---------- 5 · component 3: the record format ---------- */
    {
      title: 'Format', layout: 'ask', defines: ['changelog', 'retraction'],
      eyebrow: '05 · Your turn · what each change record holds',
      heading: 'Fraud detection asks how much a balance moved',
      stand: 'The stream CDC writes is the changelog: one record per change. For the update of “a”, what goes in the record?',
      question: {
        step: 0,
        prompt: 'What must the changelog record for “a: 16 to 24” carry?',
        options: [
          { text: 'Both values: old 16 and new 24.', correct: true,
            why: 'The move, 24 minus 16, is 8, and it can be read straight from the record.' },
          { text: 'Just the new value, 24: that is the balance.', correct: false,
            why: 'Then “how much did it move?” cannot be answered, and a consumer that adds would compute 40.' },
          { text: 'Just the difference, 8.', correct: false,
            why: 'Then a reader that wants the balance must keep its own running copy, which is rebuilding the table.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'The move is 8', html: '<p>The record (16, 24) gives 24 − 16 = <b>8</b> directly. From “24” alone, it is unrecoverable.[[src:sdwhy]]</p>' },
        { step: 1, title: 'And sums stay right', html: '<p>New value only, into a reader that adds: 16 + 24 = <b>40</b>. With old and new: 16 − 16 + 24 = 24. Taking back the old value is a <b>retraction</b>.[[src:dwhy]]</p>' },
        { step: 2, title: 'The changelog', html: '<p>CDC’s output, the <b>changelog</b>: append-only, ordered, one (old, new) record per write.[[src:cdc]]</p>' }
      ],
      narration: [
        'The stream C D C writes is called the changelog: one record per change. Fraud detection asks how much a balance moved. What must the record for 16 to 24 carry? Choose an answer.',
        'Both values, old 16 and new 24. The move, 8, is read straight from the record. With only 24, it is lost, and a reader that adds would compute 40. Taking back the old value is called a retraction.',
        'So the changelog is append-only, in order, with one old-and-new record per write. A reader could rebuild the old values itself, but only by keeping its own copy of the table, the thing it was trying not to need.'
      ]
    },

    /* ---------- 6 · component 4: the changelog stream ---------- */
    {
      title: 'Log', layout: 'table', defines: ['fold'],
      eyebrow: '06 · Component 3, the changelog stream',
      heading: 'More than a feed: the history',
      stand: 'The changelog for account “a”, as CDC writes it. Each record is (old, new).',
      table: {
        columns: ['Write', 'Record', 'What it lets you ask'],
        rows: [
          { step: 0, cells: ['1st', '(0, 5)', 'when “a” first received money'] },
          { step: 0, cells: ['2nd', '(5, 8)', 'was “a” ever 8? yes'] },
          { step: 1, cells: ['3rd', '(8, 10)', 'every move, in order'] },
          { step: 1, cells: ['4th', '(10, 16)', 'the balance at any point: fold up to it'] },
          { step: 2, cells: ['5th', '(16, 24)', 'the move fraud detection sees: <b>8</b>'] }
        ]
      },
      side: { step: 3, title: 'A source of history', html: '<p>Reading records in order and keeping the latest value is a <b>fold</b>. The changelog is retained, so <b>any past table is a fold up to that point</b>.[[src:cl]]</p>' },
      narration: [
        'Here is the changelog for account “a”: from 0 to 5, then 5 to 8. It records when “a” first got money, and that it once held 8.',
        'Then 8 to 10, and 10 to 16. Every move, in order, so the balance at any moment can be worked out by reading up to that point.',
        'And the last: 16 to 24, the move of 8 that fraud detection sees.',
        'So the changelog is more than a feed. Reading records in order and keeping the latest value is called a fold, and because the changelog is kept, any past table is a fold up to that point.'
      ]
    },

    /* ---------- 7 · component 5: the fold ---------- */
    {
      title: 'Fold', layout: 'ask', defines: ['stream processor', 'materialized view'],
      eyebrow: '07 · Your turn · component 4, the stream processor',
      heading: 'The database already has the table. Why build it again?',
      stand: 'A stream processor is a program that reads the changelog as it arrives. Folding it — reading in order, keeping the latest value per account — rebuilds a table.',
      question: {
        step: 0,
        prompt: 'Why fold the changelog back into a second table, when the database already holds one?',
        options: [
          { text: 'To compare the two: if they disagree, a change was missed.', correct: true,
            why: 'The rebuilt table should equal the database. Running the comparison continuously turns a silent gap into a loud one.' },
          { text: 'To serve reads faster than the database can.', correct: false,
            why: 'It may, but that is not why this design needs it. Its job here is to be the check.' },
          { text: 'It is not needed; it only duplicates the database.', correct: false,
            why: 'Without it nothing in the design can notice a missed capture until a fraud decision goes wrong.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The final fold is the check', html: '<p>The <b>stream processor</b> applies each (old, new) pair: “a” 24, “b” 21. This rebuilt <b>materialized view</b> must match the source database.[[src:sp]]</p>' },
        { step: 2, title: 'Run it all the time', html: '<p>It is the only part of the design that can fail loudly, and what it catches, a missed write, is otherwise silent.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'A stream processor is a program that reads the changelog as it arrives; folding it, keeping the latest value per account, rebuilds a table. Why build that, when the database has one? Choose an answer.',
        'To compare the two. The stream processor’s rebuilt table, its materialized view, should read “a” 24 and “b” 21, exactly like the database. If they disagree, a change was missed.',
        'So the final fold is not redundant: it is the check. Run it continuously, because it is the only part of the design that can fail loudly.'
      ]
    },

    /* ---------- 8 · the check, with one capture missed ---------- */
    {
      title: 'Audit', layout: 'array',
      eyebrow: '08 · Watch the check catch a missed capture',
      heading: 'One write not captured, and the totals split',
      stand: 'The nine writes to the table, in order, and whether CDC captured each. This time the last one is deliberately skipped.',
      array: {
        labelWidth: 150, slotLabel: 'write',
        rows: [
          { label: 'account', values: KEYS },
          { label: 'set balance to', values: NEWV },
          { label: 'captured?', values: CAPTURED }
        ],
        meters: ['writes checked', 'writes missed'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 350 },
          { step: 2, do: 'pick', slots: [E.length - 1] }
        ]
      },
      cards: [
        { step: 2, title: 'Table: 45. Re-fold: 37.', html: '<p>The database reached “a” 24, “b” 21: <b>45</b>. Re-folding the changelog stops “a” at 16: <b>37</b>. They disagree.[[src:sdmem]]</p>' },
        { step: 3, title: 'The gap is exactly 8', html: '<p>45 − 37 = 8: the uncaptured move of “a”. Without the check, the fraud feed silently misses it.[[src:sdmem]]</p>' }
      ],
      narration: [
        'Here are the nine writes to the table, in order: which account, and the balance it was set to.',
        'Now CDC captures them. Watch the pointer: 8 of the 9 writes made it into the changelog, and 1 was missed. The last one, “a” set to 24, was deliberately skipped.',
        'The database reached “a” 24 and “b” 21, a total of 45. Re-folding the changelog stops “a” at 16, a total of 37. The check compares them, and they disagree.',
        'The gap is exactly 8, the uncaptured move of “a”. Without this check, the fraud feed would silently be missing one balance change, and nothing else would notice.'
      ]
    },

    /* ---------- 9 · the design, assembled ---------- */
    {
      title: 'Design', layout: 'graph',
      eyebrow: '09 · The design, assembled',
      heading: 'Database, change capture, changelog, fold, check',
      stand: 'Each box is one answer you chose. One writer per view; the last box exists to be compared with the first.',
      graph: {
        viewBox: '0 0 1520 330', legend: true,
        nodes: [
          { id: 'db', x: 20, y: 60, w: 250, h: 104, title: 'Database (table)', sub: 'source of truth', kind: 'main', step: 0, src: 'db', values: ['a 24 · b 21'] },
          { id: 'cdc', x: 330, y: 60, w: 250, h: 104, title: 'Change capture', sub: 'the stream’s one writer', kind: 'new', step: 1, src: 'cdc', values: [null, '(16, 24)'] },
          { id: 'log', x: 640, y: 60, w: 250, h: 104, title: 'Changelog stream', sub: 'retained history', kind: 'main', step: 2, src: 'cl', values: [null, null, 'old + new'] },
          { id: 'proc', x: 950, y: 60, w: 250, h: 104, title: 'Stream processor', sub: 'folds the changelog', kind: 'new', step: 3, src: 'sp', values: [null, null, null, 'a 24 · b 21'] },
          { id: 'view', x: 1260, y: 60, w: 240, h: 104, title: 'Materialized view', sub: 'compared with the source', kind: 'change', step: 3, values: [null, null, null, '45 = 45'] },
          { id: 'fraud', x: 640, y: 220, w: 250, h: 90, title: 'Fraud detection', sub: 'reads every move', kind: 'ext', step: 2, values: [null, null, 'move 8'] }
        ],
        edges: [
          { from: 'db', to: 'cdc', kind: 'new', step: 1 },
          { from: 'cdc', to: 'log', kind: 'new', step: 1 },
          { from: 'log', to: 'fraud', kind: 'ext', step: 2 },
          { from: 'log', to: 'proc', kind: 'main', step: 3 },
          { from: 'proc', to: 'view', kind: 'change', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>One writer per view:</b> the app writes the table, CDC writes the stream, nothing writes both.[[src:sdwhy]]' },
        { step: 4, html: '<b>Records carry old and new:</b> the move is readable, and summing readers stay right.[[src:sdwhy]]' },
        { step: 4, html: '<b>The fold is the check:</b> compared continuously with the source.[[src:sdwhen]]' }
      ],
      narration: [
        'Here is the whole design. First, the database holds the source table: “a” 24 and “b” 21. The app writes it, as it always has.',
        'Second, change capture watches the database’s writes and emits one old-and-new record per write, such as 16 to 24. It is the only writer of the stream.',
        'Third, the changelog stream: retained, in order. Fraud detection reads every move from it, such as the 8 that took “a” from 16 to 24.',
        'Fourth, a stream processor folds the changelog into a materialized view, which is compared with the database: 45 equals 45.',
        'One writer per view; records carrying old and new; and the fold running continuously as the check. Those three choices are the design.'
      ]
    },

    /* ---------- 10 · the other direction ---------- */
    {
      title: 'Dir', layout: 'ask',
      eyebrow: '10 · Your turn · the same problem, from scratch',
      heading: 'No database yet',
      stand: 'Another team is building a brand-new payments system. There is no existing database to respect.',
      question: {
        step: 0,
        prompt: 'Which direction should they run the derivation?',
        options: [
          { text: 'Stream first: write the changelog, and fold tables from it.', correct: true,
            why: 'Time travel and rebuilding become free instead of retrofitted, and a fold is simpler than change capture.' },
          { text: 'Table first, exactly like the bank.', correct: false,
            why: 'That is right when a database already is the record. Starting fresh, it adds change capture for no reason.' },
          { text: 'Both written by the app, compared nightly.', correct: false,
            why: 'Two writers drift whichever way you start. The answer is always one direction.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Table → stream', html: '<p>When a database is already the system of record and the app cannot be rewritten: CDC is the lowest-disruption way to a stream.[[src:sdwhen]]</p>' },
        { step: 2, title: 'Stream → table', html: '<p>When building new: any past table is a fold up to a point, for free. Either way, one direction, one writer.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Another team is building a brand-new payments system, with no existing database. Which direction should they run the derivation? Choose an answer.',
        'Stream first: write the changelog, and fold tables from it. Table first, like the bank, is right only when a database already is the record and the app cannot change.',
        'Built stream first, time travel and rebuilding are free, and a fold is simpler than change capture. Either way the rule is the same: one direction, one writer.'
      ]
    },

    /* ---------- 11 · what the check cannot catch ---------- */
    {
      title: 'Limit', layout: 'ask',
      eyebrow: '11 · Your turn · what this design does not settle',
      heading: 'A wrong balance, faithfully copied',
      stand: 'A bug in the app computes a wrong balance and writes it to the table. CDC captures it perfectly, and the fold rebuilds it perfectly.',
      question: {
        step: 0,
        prompt: 'Does the continuous check catch this bug?',
        options: [
          { text: 'No: the two views agree, they are just both wrong.', correct: true,
            why: 'The check proves the views agree with each other. A value wrong at the source passes every comparison.' },
          { text: 'Yes: the check compares every balance.', correct: false,
            why: 'It compares the table with its own copy. Both hold the same wrong number.' },
          { text: 'Yes: CDC refuses wrong values.', correct: false,
            why: 'CDC records what was written. It has no idea what the right balance would have been.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Agreement is not correctness', html: '<p>Catching a wrong value needs a reference <b>outside</b> the system, such as the payments themselves checked another way.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Last question. A bug in the app writes a wrong balance to the table. CDC captures it perfectly, and the fold rebuilds it perfectly. Does the check catch it? Choose an answer.',
        'No. The check proves the two views agree with each other, not that either is right. Catching a wrong value needs a reference outside the system.'
      ]
    },

    /* ---------- 12 · the four gaps ---------- */
    {
      title: 'Gaps', layout: 'cards', defines: ['retention'],
      eyebrow: '12 · What this design does NOT settle',
      heading: 'Four gaps to say out loud in the interview',
      stand: 'The design keeps two views consistent. These are the limits of that promise.',
      columns: 2,
      cards: [
        { step: 0, title: '1 · Agreement, not truth', html: '<p>The check proves the views agree, not that either is right.[[src:sdwhen]]</p>' },
        { step: 1, title: '2 · The table, not the events', html: '<p>The fold rebuilds the table. For a max, at least 36 histories fit one changelog. If a consumer needs the events, ship the events.[[src:sdwhen]]</p>' },
        { step: 2, title: '3 · Recomputing has a price', html: '<p>Rebuilding on demand costs 9 reads per query here, and grows with history. “We can always recompute” quietly expires.[[src:sdwhen]]</p>' },
        { step: 3, title: '4 · Only while retained', html: '<p>How long the changelog is kept is its <b>retention</b>. Past that horizon, rebuilding and time travel stop, and nothing announces it: 7-day retention, 7-day horizon.[[src:pwhen]]</p>' }
      ],
      narration: [
        'Four things this design does not settle. First, the check proves the views agree, not that either is right.',
        'Second, the fold rebuilds the table, not necessarily the events. For an aggregate like a max, at least 36 histories fit one changelog. If a consumer needs the events, ship the events.',
        'Third, rebuilding on demand costs 9 reads per query here, and grows as history grows. “We can always recompute it” quietly expires.',
        'Fourth, the changelog is the source of history only while it is kept, its retention. Keep it 7 days, and rebuilding works for 7 days, with nothing in the system to announce that.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · The design, in five sentences',
      heading: 'One source, one writer per view, old and new, and a check',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Database (table)</b>', 'Holds the source table; the app writes it.', 'Which view is the source?[[src:db]]'] },
          { step: 0, cells: ['<b>Change capture</b>', 'Emits one record per write; the stream’s only writer.', 'Who writes the stream?[[src:cdc]]'] },
          { step: 1, cells: ['<b>Changelog stream</b>', '(old, new) records, retained: the move is 8, not 40.', 'What does a record hold?[[src:cl]]'] },
          { step: 1, cells: ['<b>Stream processor</b>', 'Folds the changelog; compared with the source: 45 vs 37 catches a gap.', 'How is a gap caught?[[src:sp]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'Truth, the events, recompute cost, retention.', 'What must be said out loud?[[src:sdwhen]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Drift needs two writers. Give each view one writer, make one view from the other, and keep checking that they agree.[[src:sdwhy]]</p>' },
      narration: [
        'To recap. The database holds the source table. Change capture is the stream’s only writer, emitting one record per write.',
        'The changelog carries old and new values, so fraud detection reads a move of 8, and a summing reader never shows 40. The stream processor folds it, and the comparison catches a missed write: 45 against 37.',
        'Not settled: whether the values are true, whether the events can be recovered, what recomputing costs, and how long the changelog is kept.',
        'In one line: drift needs two writers. Give each view one writer, make one view from the other, and keep checking that they agree.'
      ]
    }
  ]
};
