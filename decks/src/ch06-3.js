// Chapter 6, Part 3 — "Why the duality matters in practice": whether to store the table or
// work it out on demand (priced, with its crossover), time travel as a fold that stops early,
// the three ways to arrange the two views and why only one of them drifts, and the retention
// limit that bounds every claim. The story and every word are re-introduced so the deck stands
// alone. The nine records come from the one seed (tools/stream_seed.js), in arrival order.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch06';
const E = seed.EVENTS;
const ACC = E.map(e => e.key), AMT = E.map(e => e.v);
const foldTo = upto => E.filter(e => e.id <= upto).reduce((t, e) => ({ ...t, [e.key]: (t[e.key] || 0) + e.v }), {});
const AT4 = foldTo(4), NOW = foldTo(E.length - 1);
const QUERIES = 10, EAGER = E.length, LAZY = E.length * QUERIES;

if (E.length !== 9 || AT4.a !== 16 || AT4.b !== 7 || AT4.a + AT4.b !== 23 || NOW.a !== 24 || NOW.b !== 21
  || EAGER !== 9 || LAZY !== 90)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Store or Recompute',
  eyebrow: 'Streaming · Ch 6 · Part 3',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B', 'CDC': 'C D C' } },
  jargon: ['account', 'record', 'event', 'stream', 'table', 'fold', 'query', 'materialize', 'eager', 'lazy',
    'time travel', 'database', 'change capture', 'source of truth', 'lag', 'drift', 'retention'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    faces: section(CH, 'The two faces of data', 'Chapter 6 · the two faces of data'),
    pr:    section(CH, 'Why the duality matters in practice', 'Chapter 6 · why the duality matters'),
    pwhy:  section(CH, 'Why materializing is almost always right, and why drift is the real risk', 'Chapter 6 · why materialize, and drift'),
    pwhen: section(CH, 'When to materialize, when to recompute, and how the question picks the view', 'Chapter 6 · when to materialize'),
    pwalk: section(CH, 'Visual walkthrough — the crossover, the fold, and the three architectures', 'Chapter 6 · the three architectures'),
    pmem:  section(CH, 'Materialize or recompute — stack and heap at every step', 'Chapter 6 · materialize or recompute, as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['account', 'record', 'event', 'stream', 'table', 'fold'],
      eyebrow: '01 · Chapter 6 · Part 3',
      heading: 'Two accounts, nine payments, and three decisions to make',
      hero: { step: 0, text: 'A payments app holds money for two <b>accounts</b>, <code>“a”</code> and <code>“b”</code>. Each payment is an <b>event</b>, written as one <b>record</b>; the records in order are the <b>stream</b>. Reading them in order and keeping a running total per account is a <b>fold</b>, and its result, one row per account, is the <b>table</b>: “a” 24, “b” 21.[[src:faces]]' },
      tiles: [
        { step: 1, value: EAGER, label: 'records in the stream[[src:pwhy]]' },
        { step: 1, value: QUERIES, label: 'balance questions we will price[[src:pwhy]]' },
        { step: 2, value: LAZY, label: 'record reads, if nothing is stored[[src:pwhy]]' },
        { step: 2, value: 7, label: 'days of history kept, in the last trap[[src:pwhen]]' }
      ],
      cardsLabel: 'Three decisions this part makes',
      cards: [
        { step: 3, n: 1, title: 'Store the table, or work it out?', text: 'Each answer has a cost; one is almost always cheaper.' },
        { step: 3, n: 2, title: 'What does keeping the stream buy?', text: 'The past, for free.' },
        { step: 4, n: 3, title: 'Which view is the source?', text: 'And why writing both separately is the one real danger.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A payments app holds money for two accounts, “a” and “b”. Each payment is an event, written as a record; in order, they are the stream. Folding them, keeping a running total per account, gives the table: 24 and 21.',
        'The stream has 9 records. We will price 10 questions asking for a balance, answered two different ways.',
        'One way reads 90 records to answer those questions. And at the end, a history kept for only 7 days quietly limits everything else.',
        'Three decisions. Should the table be stored, or worked out when asked? And what does keeping the stream buy you?',
        'And which of the two views is the source, with the other made from it? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · question: store or recompute ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['query', 'materialize', 'eager', 'lazy'],
      eyebrow: '02 · Your turn · store, or work it out?',
      heading: 'Ten balance questions, two ways to answer',
      stand: 'Way one: fold the 9 records once, store the 2 rows, and answer each question by looking up a row. Way two: store nothing, and fold all 9 records every time a question comes in.',
      question: {
        step: 0,
        prompt: 'Over 10 balance questions, how many records does way two read in total?',
        options: [
          { text: '90: all 9 records, for each of the 10 questions.', correct: true,
            why: 'Nothing is kept between questions, so every question repeats the whole fold.' },
          { text: '9: the fold reads each record only once.', correct: false,
            why: 'That is way one. Way two throws its result away and folds again next time.' },
          { text: '10: one record per question.', correct: false,
            why: 'A balance needs every payment to that account, so one record is never enough.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Query', html: '<p>A question put to stored data is a <b>query</b>.</p>' },
        { step: 1, title: 'Materialize', html: '<p>To work a result out and store it is to <b>materialize</b> it. Way one is <b>eager</b>: it materializes once.[[src:pr]]</p>' },
        { step: 2, title: 'Lazy', html: '<p>Way two is <b>lazy</b>: it stores nothing and recomputes per query. Eager costs storage; lazy costs time.[[src:pr]]</p>' }
      ],
      narration: [
        'First question. Way one folds the 9 records once and stores the 2 rows. Way two stores nothing and folds all 9 records for every question. Over 10 questions, how many records does way two read? Choose an answer.',
        '90: all 9 records, 10 times over. A question put to stored data is called a query. Working a result out and storing it is called materializing it; way one is eager, and materializes once.',
        'Way two is lazy: it stores nothing and pays at every query. So eager costs storage, and lazy costs time. Let us compare the bills.'
      ]
    },

    /* ---------- 3 · the bill ---------- */
    {
      title: 'Bill', layout: 'cards',
      eyebrow: '03 · The two bills, side by side',
      heading: 'Eager wins from the very first query',
      stand: 'Record reads needed to answer 10 balance queries.',
      bars: { step: 0, label: 'Record reads over 10 queries', items: [
        { label: 'eager · fold once, then look up', value: EAGER }, { label: 'lazy · fold per query', value: LAZY } ] },
      columns: 2,
      cards: [
        { step: 1, title: 'The crossover is one query', html: '<p>After one query both have read 9 records. From the second on, eager reads nothing more and lazy reads 9 again.[[src:pwhy]]</p>' },
        { step: 2, title: 'Which is why almost everyone stores', html: '<p>Recomputing is right only for a view asked far less often than it changes, like a monthly report over a busy stream.[[src:pwhen]]</p>' }
      ],
      narration: [
        'Here are the two bills. Eager folds once: 9 record reads, and every query after that is a look-up. Lazy folds per query: 9 times 10, which is 90.',
        'The crossover comes after the very first query. After one query both have read 9. From the second query on, eager reads nothing new, and lazy reads all 9 again.',
        'That is why nearly every real system materializes. Recomputing is right only for a view asked far less often than its data changes, such as a monthly report over a busy stream.'
      ]
    },

    /* ---------- 4 · question: what grows ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '04 · Your turn · as history grows',
      heading: 'Years later, still two accounts',
      stand: 'The app keeps running. The stream grows by a record with every payment, but there are still only 2 accounts.',
      question: {
        step: 0,
        prompt: 'As the stream grows, which cost per balance query keeps growing?',
        options: [
          { text: 'The lazy one: each query folds a longer and longer stream.', correct: true,
            why: 'Lazy reads every record every time, so its cost follows the length of the history, not the 2 accounts.' },
          { text: 'The eager one: the stored table keeps getting bigger.', correct: false,
            why: 'The table has one row per account. With 2 accounts it stays 2 rows however long the stream gets.' },
          { text: 'Neither: there are still only 2 balances to report.', correct: false,
            why: 'The answer is still 2 numbers, but lazy has to read the whole history to produce them.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Lazy follows the history', html: '<p>Its cost grows with the <b>stream length</b>, not with the number of accounts. It gets worse while the data stays 2 rows.[[src:pwhy]]</p>' },
        { step: 2, title: 'Eager follows the accounts', html: '<p>The table stays 2 rows; each query stays one look-up. “We can always recompute it” quietly expires as the stream grows.[[src:pwhy]]</p>' }
      ],
      narration: [
        'Second question. The app keeps running for years. The stream grows with every payment, but there are still only 2 accounts. Which cost per query keeps growing? Choose an answer.',
        'The lazy one. Each query reads the whole history, so its cost follows the length of the stream, not the number of accounts. It gets worse while the answer stays 2 numbers.',
        'Eager follows the accounts instead: 2 rows, one look-up per query, however old the app gets. So “we can always recompute it” quietly stops being true.'
      ]
    },

    /* ---------- 5 · question: time travel ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['time travel'],
      eyebrow: '05 · Your turn · asking about the past',
      heading: 'What were the balances back then?',
      stand: 'An auditor asks: what were the two balances right after record 4, the fifth record?',
      question: {
        step: 0,
        prompt: 'How do you answer “what were the balances right after record 4”?',
        options: [
          { text: 'Fold the stream as usual, but stop after record 4.', correct: true,
            why: 'The same fold, with an earlier end point, gives the table exactly as it stood then.' },
          { text: 'Read the table: it holds the balances.', correct: false,
            why: 'The table holds the balances now, 24 and 21. The earlier ones are not in it.' },
          { text: 'It cannot be done unless a copy was saved at that moment.', correct: false,
            why: 'With the stream kept, nothing extra was ever needed: every past table can be folded again.' }
        ]
      },
      cards: [
        { step: 1, title: 'Time travel', html: '<p>Working out the table as it stood at an earlier point is called <b>time travel</b>. With the stream kept, it is just a fold that stops early.[[src:pr]]</p>' }
      ],
      narration: [
        'Third question. An auditor asks: what were the two balances right after record 4? How do you answer? Choose an answer.',
        'Fold the stream as usual, but stop after record 4. Working out the table as it stood at an earlier moment is called time travel. Let us watch it.'
      ]
    },

    /* ---------- 6 · time travel, animated ---------- */
    {
      title: 'Past', layout: 'array',
      eyebrow: '06 · Watch the fold stop early',
      heading: 'The same fold, a different end point',
      stand: 'The nine records. The fold runs over records 0 to 4 only, then stops.',
      array: {
        labelWidth: 150, slotLabel: 'record id',
        rows: [ { label: 'account', values: ACC }, { label: 'money in', values: AMT },
          { label: 'folded, up to 4?', values: E.map(e => (e.id <= 4 ? 'yes' : 'no')) } ],
        meters: ['records checked', 'records folded'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'pick', slots: [0, 1, 2, 3, 4] }
        ]
      },
      cards: [
        { step: 1, title: 'After record 4', html: '<p>“a”: 5 + 3 + 2 + 6 = <b>16</b>. “b”: <b>7</b>. Total 23.[[src:pwhy]]</p>' },
        { step: 2, title: 'After record 8 — now', html: '<p>“a” <b>24</b>, “b” <b>21</b>. Total 45. Same fold, run to the end.[[src:pwhy]]</p>' },
        { step: 3, title: 'Free, if the stream is kept', html: '<p>No extra storage, no second program. A table-only design has to build this on purpose, with an audit table it must keep consistent.[[src:pwhy]]</p>' }
      ],
      narration: [
        'Here are the nine records again, in order. To answer the auditor, the fold runs over records 0 to 4, and then stops.',
        'Records 0 to 4 are folded, and the rest are left out. “a” has 5 plus 3 plus 2 plus 6, which is 16, and “b” has 7. A total of 23.',
        'Run the same fold to the end and you get the present: “a” 24 and “b” 21, a total of 45. “Now” is not a special case; it is the same fold with the last end point.',
        'So time travel costs nothing extra when the stream is kept. A design that keeps only the table has to build it on purpose, with a second history table it must keep consistent.'
      ]
    },

    /* ---------- 7 · question: three arrangements ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['database', 'change capture', 'source of truth'],
      eyebrow: '07 · Your turn · three ways to keep both views',
      heading: 'Which arrangement can quietly go wrong?',
      stand: 'A database stores the table. Change capture watches a table and writes one record per change. The source of truth is the view the other is made from.',
      question: {
        step: 0,
        prompt: 'Which of these three arrangements can end up with the two views disagreeing, with nothing to notice?',
        options: [
          { text: 'The app writes each payment to both the stream and the table, separately.', correct: true,
            why: 'Two writers and no rule linking them: one write can fail or differ, and both stores still answer confidently.' },
          { text: 'The stream is the truth, and the table is folded from it.', correct: false,
            why: 'The table is worked out from the stream, so it can be behind but never different.' },
          { text: 'The table is the truth, and the stream comes from change capture.', correct: false,
            why: 'The stream is made from the table’s own writes, so it can be behind but never different.' }
        ]
      },
      narration: [
        'Fourth question. A database stores the table; change capture turns its writes into a stream. The source of truth is the view the other is made from. Which arrangement can disagree with nothing to notice? Choose an answer.',
        'The one where the app writes both views separately. The other two are safe, because one view is worked out from the other. Here are all three side by side.'
      ]
    },

    /* ---------- 8 · the three architectures ---------- */
    {
      title: 'Three', layout: 'graph',
      eyebrow: '08 · Three ways to keep both views',
      heading: 'Two are safe because one view is made from the other',
      stand: 'Each row is one design. Solid: the source of truth. Dashed: a view worked out from it. Red: two separate writers.',
      graph: {
        viewBox: '0 0 1520 430', legend: false,
        lanes: [ { y: 10, h: 130, label: 'Stream first' }, { y: 150, h: 130, label: 'Table first' }, { y: 290, h: 130, label: 'Both written' } ],
        nodes: [
          { id: 's1', x: 260, y: 40, w: 300, h: 70, title: 'Stream', sub: 'source of truth', kind: 'main', step: 0, src: 'pwhy' },
          { id: 'f1', x: 700, y: 40, w: 260, h: 70, title: 'Fold', sub: 'stream processor', kind: 'main', step: 0 },
          { id: 't1', x: 1100, y: 40, w: 300, h: 70, title: 'Table', sub: 'worked out', kind: 'new', step: 0 },
          { id: 't2', x: 260, y: 180, w: 300, h: 70, title: 'Table', sub: 'source of truth', kind: 'main', step: 1, src: 'pwhy' },
          { id: 'c2', x: 700, y: 180, w: 260, h: 70, title: 'Change capture', sub: 'one record per write', kind: 'main', step: 1 },
          { id: 's2', x: 1100, y: 180, w: 300, h: 70, title: 'Stream', sub: 'worked out', kind: 'new', step: 1 },
          { id: 'app', x: 260, y: 320, w: 300, h: 70, title: 'The app', sub: 'writes twice', kind: 'change', step: 2, src: 'pwhy' },
          { id: 's3', x: 1100, y: 310, w: 300, h: 50, title: 'Stream', kind: 'change', step: 2 },
          { id: 't3', x: 1100, y: 366, w: 300, h: 50, title: 'Table', kind: 'change', step: 2 }
        ],
        edges: [
          { from: 's1', to: 'f1', kind: 'main', step: 0 },
          { from: 'f1', to: 't1', kind: 'new', step: 0 },
          { from: 't2', to: 'c2', kind: 'main', step: 1 },
          { from: 'c2', to: 's2', kind: 'new', step: 1 },
          { from: 'app', to: 's3', kind: 'change', step: 2 },
          { from: 'app', to: 't3', kind: 'change', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Top two: safe.</b> One view is worked out from the other, so they cannot disagree; they can only be behind.[[src:pwhy]]' },
        { step: 3, html: '<b>Bottom: unsafe.</b> Two writers, nothing linking them. They will disagree, and both answer confidently.[[src:pwhy]]' },
        { step: 3, html: '<b>In the wild:</b> a Kafka topic is a changelog stream; a database index is a table built from it.[[src:pr]]' }
      ],
      narration: [
        'Top row: the stream is the source of truth, and a stream processor folds it into the table. The table is worked out from the stream.',
        'Middle row: the table is the source of truth, kept in a database, and change capture writes one record per change. The stream is worked out from the table.',
        'Bottom row: the app writes every payment twice, once to each store. Two writers, and no rule linking what they write.',
        'The top two are safe, because one view is made from the other. The bottom one is not: one failed or buggy write, and the two views disagree, with nothing to notice.'
      ]
    },

    /* ---------- 9 · question: lag or drift ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['lag', 'drift'],
      eyebrow: '09 · Your turn · behind, or wrong?',
      heading: 'Two kinds of disagreement',
      stand: 'In the stream-first design, a payment arrives and the table is updated a few seconds later. For those seconds, the two views differ.',
      question: {
        step: 0,
        prompt: 'Is that short difference the same danger as the two-writer design?',
        options: [
          { text: 'No: it is behind by a bounded amount, and then it catches up.', correct: true,
            why: 'The table is worked out from the stream, so once the fold catches up, the two agree again.' },
          { text: 'Yes: any difference between the views is the same bug.', correct: false,
            why: 'A difference that always closes by itself is very different from one that never closes.' },
          { text: 'Yes: the stream-first design can drift just like the other.', correct: false,
            why: 'Drift needs two independent writers. Here the table has one writer: the fold.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Lag', html: '<p>A view worked out from the other is behind by some amount, and converges. That is <b>lag</b>: visible and bounded.[[src:pwhy]]</p>' },
        { step: 2, title: 'Drift', html: '<p>Two independently written stores disagree without limit, and nothing detects it. That is <b>drift</b>: unbounded and silent. Never write both views independently.[[src:pwhen]]</p>' }
      ],
      narration: [
        'Fifth question. In the stream-first design the table is updated a few seconds after each payment. For those seconds the views differ. Is that the same danger as two writers? Choose an answer.',
        'No. The table is behind by a bounded amount, and then catches up, because it is worked out from the stream. Being behind like this is called lag. It is visible and bounded.',
        'Two separately written stores can disagree without limit, and nothing detects it. That is called drift: unbounded and silent. So never write both views independently; pick a direction.'
      ]
    },

    /* ---------- 10 · the question picks the view ---------- */
    {
      title: 'Pick', layout: 'table',
      eyebrow: '10 · The question picks the view',
      heading: 'Four questions, and which view answers each',
      stand: 'The same nine records, asked four different things.',
      table: {
        columns: ['The question', 'Answer', 'Which view'],
        rows: [
          { step: 0, cells: ['What is the balance of “a” now?', `<b>${NOW.a}</b>`, 'the table: one look-up[[src:pwhen]]'] },
          { step: 1, cells: ['What happened, in order?', 'the 9 records', 'the stream[[src:pwhen]]'] },
          { step: 1, cells: ['What was “a” after record 4?', `<b>${AT4.a}</b>`, 'the stream: fold, then stop[[src:pwhen]]'] },
          { step: 2, cells: ['Was “a” ever 8?', 'yes, after record 1', 'the stream: replay and look[[src:pwhen]]'] }
        ]
      },
      side: { step: 3, title: 'Why you want both', html: '<p>Three of the four need the stream. The one that needs the table is the one asked constantly. So: materialize the table, <b>and</b> keep the stream as the source of truth.[[src:pwhen]]</p>' },
      narration: [
        'The question picks the view. “What is the balance of “a” now?” is 24, one look-up in the table. That is the question asked constantly.',
        '“What happened, in order?” needs the stream. So does “what was “a” after record 4?”: fold, then stop, giving 16.',
        'And “was “a” ever 8?” needs the stream too: replay and look. Yes, right after record 1.',
        'Three of the four need the stream; the one that needs the table is asked all the time. So the good design keeps the stream as the source of truth, and materializes the table from it.'
      ]
    },

    /* ---------- 11 · question: retention ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['retention'],
      eyebrow: '11 · Your turn · the limit on all of this',
      heading: 'A stream that keeps only a week',
      stand: 'To save disk, the stream is set to keep records for 7 days, then delete them. How long records are kept is called retention.',
      question: {
        step: 0,
        prompt: 'With 7-day retention, what happens to time travel and to “we can always rebuild the table from the stream”?',
        options: [
          { text: 'Both only work for the last 7 days, and nothing warns you.', correct: true,
            why: 'The stream is the source of truth only while its records exist. Older questions have nothing left to fold.' },
          { text: 'Nothing changes: the table still holds everything.', correct: false,
            why: 'The table holds only the present. The past lived in the deleted records.' },
          { text: 'Older records are folded into the table, so history is kept.', correct: false,
            why: 'Folding keeps the result, not the steps. “What was “a” after record 4” would be gone.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Truth, while retained', html: '<p>“The stream is the source of truth” holds exactly as long as the stream is <b>retained</b>. Set 7 days, and every claim about rebuilding and time travel gets a 7-day horizon.[[src:pwhen]]</p>' },
        { step: 2, title: 'Nothing announces it', html: '<p>The system keeps running and answering. The limit is the assumption most worth writing down.[[src:pwhen]]</p>' }
      ],
      narration: [
        'Last question. To save disk, the stream keeps records for 7 days and then deletes them. How long records are kept is called retention. What happens to time travel and to rebuilding? Choose an answer.',
        'Both only work for the last 7 days. The stream is the source of truth exactly as long as its records exist. Older questions have nothing left to fold.',
        'And nothing in the running system announces it: it keeps answering the questions it still can. That limit is the assumption most worth writing down.'
      ]
    },

    /* ---------- 12 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '12 · What you now know',
      heading: 'Materialize by default, keep the stream, one writer per view',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Decision', 'The rule, and why'],
        rows: [
          { step: 0, cells: ['<b>Store or recompute</b>', 'Materialize: eager reads 9, lazy 90 over 10 queries; lazy grows with history.[[src:pwhy]]'] },
          { step: 1, cells: ['<b>Keep the stream</b>', 'Time travel is a fold that stops early: after record 4, “a” 16 and “b” 7.[[src:pwhy]]'] },
          { step: 2, cells: ['<b>One source</b>', 'Stream first or table first, never both written. Lag is bounded; drift is silent.[[src:pwhen]]'] },
          { step: 3, cells: ['<b>Retention</b>', 'The stream is truth only while it is kept: 7 days kept, 7 days of history.[[src:pwhen]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>A Google interview question built on all of this: fold a log of changes, emit it back, and decide what may be thrown away. You will write the program yourself.[[src:ch]]</p>' },
      narration: [
        'To recap. Materialize by default: over 10 queries eager reads 9 records and lazy reads 90, and lazy only gets worse as history grows.',
        'Keep the stream, because time travel is then just a fold that stops early: after record 4, “a” had 16 and “b” had 7.',
        'Pick one source and work the other view out from it. A derived view lags, which is bounded; two writers drift, which is silent.',
        'And all of it holds only while the stream is retained. Next, part 4 is an interview question built on these ideas, and you will write its program yourself.'
      ]
    }
  ]
};
