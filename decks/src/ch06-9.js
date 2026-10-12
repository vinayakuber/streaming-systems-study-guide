// Chapter 6, Part 9 — the chapter's two "Interview Questions", explored in depth, then the
// chapter quiz and a recap of the whole chapter. Each interview question is told as a story,
// probed from several sides (what goes wrong and why, which structure, what each line of the
// answer does, what breaks if a step is skipped, the same question with other numbers), and its
// code snippet is built line by line, a question before each line. The snippet lines come from
// the chapter source (content/ch06-*.js) through _prog.js, addressed by content, so the deck
// never retypes them. Balances come from the one seed (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch06';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const Q1_TABLE = Q1.line('table balance for "a" 16 -> 24');
const Q1_CDC = Q1.line('CDC emits (16,24)');
const Q1_FOLD = Q1.line('consumer folds');
const Q1_TRUTH = Q1.line('stream = source of truth');
const Q2_EVENTS = Q2.line('events a+5 a+3');
const Q2_VIEWS = Q2.line('stream: 9 events');
const Q2_SAME = Q2.line('both from the same source');

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS;
const tot = k => E.filter(e => e.key === k).reduce((s, e) => s + e.v, 0);
if (E.length !== 9 || tot('a') !== 24 || tot('b') !== 21 || E.map(e => e.key + '+' + e.v).join(' ') !== 'a+5 a+3 b+7 a+2 a+6 b+1 b+9 b+4 a+8')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Duality Interview Drill',
  eyebrow: 'Streaming · Ch 6 · Part 9',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B', 'CDC': 'C D C' } },
  jargon: ['account', 'balance', 'table', 'database', 'stream', 'drift', 'fraud detection', 'change capture', 'CDC',
    'changelog', 'fold', 'source of truth', 'derived view', 'retraction', 'campaign', 'event', 'aggregation',
    'materialize', 'watermark', 'window'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    faces: section(CH, 'The two faces of data', 'Chapter 6 · the two faces of data'),
    dual:  section(CH, 'The duality', 'Chapter 6 · the duality'),
    dwhy:  section(CH, 'Why the round trip recovers the table but not always the events', 'Chapter 6 · the round trip'),
    pwhy:  section(CH, 'Why materializing is almost always right, and why drift is the real risk', 'Chapter 6 · why materialize, and drift'),
    sdwhy: section(CH, 'Why a single writer is the whole guarantee', 'Chapter 6 · why a single writer'),
    sdmem: section(CH, 'Two views, one writer each — stack and heap at every step', 'Chapter 6 · the check, as a program'),
    q1:    section(CH, 'Q1', 'Chapter 6 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 6 · interview question 2'),
    quiz:  section(CH, 'Quiz', 'Chapter 6 · quiz'),
    kc:    section(CH, 'Key Concepts', 'Chapter 6 · key concepts')
  },

  slides: [
    /* ---------- 1 · the story, and interview question 1 ---------- */
    {
      title: 'Story', layout: 'title', defines: ['account', 'balance', 'table', 'database', 'stream', 'fraud detection'],
      eyebrow: '01 · Chapter 6 · Part 9 · the interview questions',
      heading: 'Two interview questions about two views of one dataset',
      hero: { step: 0, text: 'A bank holds money in <b>accounts</b>, “a” and “b”. Each account’s current <b>balance</b> is one row of a <b>table</b>, stored in a <b>database</b>. <b>Fraud detection</b> software needs every balance change as it happens: a <b>stream</b>, the changes in order.[[src:q1]]' },
      tiles: [
        { step: 1, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 1, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: 24, label: 'the balance of “a”: 5 + 3 + 2 + 6 + 8[[src:q1]]' },
        { step: 2, value: 21, label: 'the balance of “b”: 7 + 1 + 9 + 4[[src:q1]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'Two systems', text: 'A database of balances, and a separate feed of changes for fraud detection.' },
        { step: 3, n: 2, title: 'Out of step', text: 'The two keep disagreeing about the balances.' },
        { step: 4, n: 3, title: 'The question', text: 'How do you keep the table and the stream as two consistent views of the same data?' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'A bank holds money in accounts “a” and “b”. Each current balance is a row of a table in a database. Fraud detection software needs every change as it happens: a stream, the changes in order.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then asks the 5 questions of the chapter quiz.',
        'The example: “a” received 5, 3, 2, 6 and 8, so it holds 24, and “b” received 7, 1, 9 and 4, so it holds 21.',
        'Interview question 1. The bank built two systems: the database of balances, and a separate feed of changes. And the two keep falling out of step.',
        'The interviewer asks: how do you keep a table of balances and a stream of balance changes as two consistent views of the same data? You will answer first, every time.'
      ]
    },

    /* ---------- 2 · Q1: what goes wrong ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['drift'],
      eyebrow: '02 · Interview question 1 · what goes wrong, and why',
      heading: 'Why do the two systems disagree?',
      stand: 'Today the app writes each change twice: once to the database, once to the fraud feed, by separate code.',
      question: {
        step: 0,
        prompt: 'What is the root cause of the two views falling out of step?',
        options: [
          { text: 'Two independent writers, and no rule that makes one view from the other.', correct: true,
            why: 'Any failed or different write leaves them disagreeing, and both still answer confidently.' },
          { text: 'The fraud feed is slower than the database.', correct: false,
            why: 'Being behind and catching up is harmless lag. They disagree without ever catching up.' },
          { text: 'The database stores too many accounts.', correct: false,
            why: 'Size does not cause disagreement. Two writers do.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Drift', html: '<p>Two independently written stores disagree without limit, and nothing detects it. That is <b>drift</b>.[[src:pwhy]]</p>' },
        { step: 2, title: 'Lag is different', html: '<p>A view made from the other can be behind, then catch up. That is bounded and visible. The fix is to turn drift into lag.[[src:pwhy]]</p>' }
      ],
      narration: [
        'First angle: what goes wrong, and why? The app writes each change twice, by separate code. What is the root cause of the views falling out of step? Choose an answer.',
        'Two independent writers, with no rule making one view from the other. Their silent, unbounded disagreement is called drift.',
        'Being behind and then catching up is different: that is lag, and it is harmless. The whole fix is to turn drift into lag, by making one view from the other.'
      ]
    },

    /* ---------- 3 · Q1: which structure — snippet lines 1 and 2 ---------- */
    {
      title: 'CDC', layout: 'code', defines: ['change capture', 'CDC', 'changelog'],
      eyebrow: '03 · Interview question 1 · which structure · the snippet, lines 1–2',
      heading: 'Make the stream from the table',
      stand: 'The database is already the system of record. The balance of “a” goes from 16 to 24.',
      question: { step: 0, prompt: 'What should produce the stream of changes, so the app writes only once?', options: [
        { text: 'A component that watches the database’s writes and emits one record per write.', correct: true, why: 'The stream is then made from the table. The app is the table’s only writer, and this component the stream’s.' },
        { text: 'The app, sending a message after each database write.', correct: false, why: 'That is today’s two-writer design, the cause of the drift.' },
        { text: 'A nightly copy of the whole table.', correct: false, why: 'Changes within a day merge together, and fraud detection needs them as they happen.' } ] },
      code: Q1.build({ add: [Q1_TABLE, Q1_CDC], step: 1 }),
      cards: [ { step: 2, title: 'Change capture, and the changelog', html: '<p>Watching the table’s writes is <b>change capture</b>, <b>CDC</b>. Its output, one (old, new) record per write such as (16, 24), is the <b>changelog</b>.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: which structure? The database is already the system of record. What should produce the stream of changes, so the app writes only once? Choose an answer.',
        'A component that watches the database’s writes. Here are the first two lines of the chapter’s snippet: the balance of “a” goes from 16 to 24, and C D C emits the record 16, 24.',
        'Watching a table’s writes is called change capture, or C D C. Its output, one old-and-new record per write, is the changelog: the stream view of the same data.'
      ]
    },

    /* ---------- 4 · Q1: the snippet, line 3 ---------- */
    {
      title: 'Fold', layout: 'code', defines: ['fold'],
      eyebrow: '04 · Interview question 1 · the snippet, line 3',
      heading: 'Fold the changelog, and compare',
      stand: 'A consumer reads the changelog in order, keeping the latest value per account.',
      question: { step: 0, prompt: 'Folding the changelog gives a table. What must that table equal?', options: [
        { text: 'The source table in the database: “a” 24, “b” 21.', correct: true, why: 'Each record names the new balance, so folding rebuilds exactly the table it was captured from.' },
        { text: 'The sum of every record: 45 for “a”.', correct: false, why: 'Folding keeps the latest value per account; it does not add the records.' },
        { text: 'Whatever the fraud team last saw.', correct: false, why: 'The point is to match the source. Any difference means a change was missed.' } ] },
      code: Q1.build({ before: [Q1_TABLE, Q1_CDC], add: [Q1_FOLD], step: 1 }),
      cards: [ { step: 2, title: 'The fold is the check', html: '<p>Reading in order and keeping the latest value is a <b>fold</b>: a:24 b:21, matching the source. Run the comparison continuously and a missed write shows up loudly.[[src:sdwhy]]</p>' } ],
      narration: [
        'A consumer reads the changelog in order, keeping the latest value per account. Folding it gives a table. What must that table equal? Choose an answer.',
        'The source table: “a” 24 and “b” 21. Here is the third line: the consumer folds, and the result matches the source. Reading in order and keeping the latest value is called a fold.',
        'So the fold is not a copy for its own sake. It is the check: compare it with the database continuously, and a missed write stops being silent.'
      ]
    },

    /* ---------- 5 · Q1: the snippet, line 4 ---------- */
    {
      title: 'Truth', layout: 'code', defines: ['source of truth', 'derived view'],
      eyebrow: '05 · Interview question 1 · the snippet, line 4',
      heading: 'Which view is which',
      stand: 'The last line of the snippet names the role of each view.',
      question: { step: 0, prompt: 'Once the changelog is kept, what can it do that the balance table cannot?', options: [
        { text: 'Rebuild the table as it was at any past point, by folding up to there.', correct: true, why: 'The table holds only the present. The changelog holds every change, so any past table is a fold.' },
        { text: 'Answer the current balance faster.', correct: false, why: 'The table answers that in one look-up; the changelog needs a fold.' },
        { text: 'Nothing: it is a copy of the table.', correct: false, why: 'It holds the history the table forgot: the order and every value in between.' } ] },
      code: Q1.build({ before: [Q1_TABLE, Q1_CDC, Q1_FOLD], add: [Q1_TRUTH], step: 1 }),
      cards: [ { step: 2, title: 'Source and derived', html: '<p>The <b>source of truth</b> is the view everything else is made from; a <b>derived view</b> is made from it, so it can lag but never drift. The snippet’s line: the stream is the source, the table derived.[[src:q1]]</p>' } ],
      narration: [
        'Once the changelog is kept, what can it do that the balance table cannot? Choose an answer.',
        'Rebuild the table as it was at any past point, by folding up to there. Here is the last line: the stream is the source of truth, and the table is a derived view.',
        'The source of truth is the view everything else is made from. A derived view is made from it, so it can lag, but never drift.'
      ]
    },

    /* ---------- 6 · Q1: what breaks without the old value ---------- */
    {
      title: 'Old', layout: 'ask', defines: ['retraction'],
      eyebrow: '06 · Interview question 1 · what breaks if you skip a step',
      heading: 'A record that carries only the new value',
      stand: 'To save a field, someone drops the old value: the record for “a” now says only 24. A consumer that adds up what it reads currently shows 16.',
      question: {
        step: 0,
        prompt: 'What does the adding consumer show after reading “24”?',
        options: [
          { text: '40: it adds 24 to its 16.', correct: true,
            why: 'It cannot tell “now 24” from “plus 24”. And fraud detection can no longer read the move of 8.' },
          { text: '24: the record says so.', correct: false,
            why: 'A consumer that overwrites would show 24. This one adds.' },
          { text: '8: the move.', correct: false,
            why: 'To compute 8 it needs the old value, 16, in the record, which is exactly what was dropped.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Old and new', html: '<p>(16, 24) means “take back 16, add 24”: 16 − 16 + 24 = 24. Taking back the old value is a <b>retraction</b>.[[src:dwhy]]</p>' },
        { step: 2, title: 'The move fraud detection needs', html: '<p>24 − 16 = <b>8</b>, read straight from the record. From “24” alone it is unrecoverable.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Third angle: what breaks if you skip a step? Someone drops the old value from each record. A consumer that adds currently shows 16, and reads “24”. What does it show? Choose an answer.',
        '40. It cannot tell now 24 from plus 24. With the old value, the record means take back 16, then add 24, giving 24. Taking back the old value is called a retraction.',
        'And the move fraud detection actually asks about, 24 minus 16, which is 8, is lost too. So the changelog carries old and new.'
      ]
    },

    /* ---------- 7 · Q1: the same question, other numbers ---------- */
    {
      title: 'Gap', layout: 'ask',
      eyebrow: '07 · Interview question 1 · the same question, other numbers',
      heading: 'One capture missed',
      stand: 'The database ends at “a” 24 and “b” 21. But the very last change, “a” from 16 to 24, never reached the changelog.',
      question: {
        step: 0,
        prompt: 'What do the database and the folded changelog total, and what does the check do?',
        options: [
          { text: '45 against 37: they disagree by 8, so the check fails loudly.', correct: true,
            why: 'The fold stops “a” at 16. The gap is exactly the uncaptured move.' },
          { text: '45 and 45: nothing is noticed.', correct: false,
            why: 'The folded changelog never saw 24, so it still has 16 for “a”.' },
          { text: '37 and 37: both lost the change.', correct: false,
            why: 'The database accepted the write. Only the capture missed it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The gap is the missing change', html: '<p>Table: 24 + 21 = <b>45</b>. Folded changelog: 16 + 21 = <b>37</b>. Difference: 8.[[src:sdmem]]</p>' },
        { step: 2, title: 'And what it cannot catch', html: '<p>A wrong value written by the app and captured faithfully passes: the check proves the views agree, not that either is right.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Last angle on question 1: other numbers. The final change to “a”, 16 to 24, never reached the changelog. What do the two views total, and what does the check do? Choose an answer.',
        '45 against 37. The database has 24 and 21; the folded changelog stops “a” at 16. They disagree by exactly 8, the missing move, and the check fails loudly.',
        'One limit to volunteer: a wrong value, written by the app and faithfully captured, passes. The check proves the views agree with each other, not that either is right.'
      ]
    },

    /* ---------- 8 · Q2: the story ---------- */
    {
      title: 'Ads', layout: 'ask', defines: ['campaign', 'event'],
      eyebrow: '08 · Interview question 2 · the story, and what goes wrong',
      heading: 'An event feed and a running total that disagree',
      stand: 'An advertising company groups its adverts into campaigns, “a” and “b”. Each event reports that one campaign got some more clicks. One system gives a per-minute feed of these events; a second keeps each campaign’s running click total.',
      question: {
        step: 0,
        prompt: 'The feed and the totals disagree. What is the root cause?',
        options: [
          { text: 'Two systems each compute their own answer from the clicks.', correct: true,
            why: 'Two pipelines, two sets of bugs and failures, and nothing tying their answers together.' },
          { text: 'The feed is per-minute and the totals are not.', correct: false,
            why: 'Different shapes are fine; the chapter keeps exactly these two views. They disagree because they are built separately.' },
          { text: 'Clicks arrive too fast to count.', correct: false,
            why: 'Speed is not the cause. The same clicks counted by two separate systems is.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Campaign, event', html: '<p>A <b>campaign</b> is a group of adverts, such as a summer sale. An <b>event</b> is one thing that happened: here, a report that one campaign got v more clicks.[[src:q2]]</p>' },
        { step: 2, title: 'The interviewer’s question', html: '<p>How do you model the event feed and the running total so they never disagree?[[src:q2]]</p>' }
      ],
      narration: [
        'Interview question 2. An advertising company groups adverts into campaigns, “a” and “b”. Each event reports that one campaign got some more clicks. One system feeds these events per minute; a second keeps each campaign’s click total.',
        'The two keep disagreeing about the totals. What is the root cause? Choose an answer.',
        'Two systems, each computing its own answer from the same clicks. So the interviewer asks: how do you model the feed and the running total so that they can never disagree?'
      ]
    },

    /* ---------- 9 · Q2: the snippet, line 1 ---------- */
    {
      title: 'Feed', layout: 'code',
      eyebrow: '09 · Interview question 2 · which structure · the snippet, line 1',
      heading: 'Start from the events',
      stand: 'The chapter’s nine events, each saying which campaign and how many more clicks it got.',
      question: { step: 0, prompt: 'Which view should be the source of truth here?', options: [
        { text: 'The event feed: every click, in order.', correct: true, why: 'The totals can be worked out from the events, but the events cannot be worked out from the totals.' },
        { text: 'The per-campaign totals.', correct: false, why: 'The totals forget which clicks happened when; the feed could not be rebuilt from them.' },
        { text: 'Both, kept equal by a nightly comparison.', correct: false, why: 'That is two writers again, with drift found only at night.' } ] },
      code: Q2.build({ add: [Q2_EVENTS], step: 1 }),
      cards: [ { step: 2, title: 'Nine events', html: '<p>a+5 a+3 b+7 a+2 a+6 b+1 b+9 b+4 a+8: the stream. a+5 means 5 more clicks for “a”. It answers “what happened”, and everything else is made from it.[[src:q2]]</p>' } ],
      narration: [
        'Second angle: which structure? Which view should be the source of truth? Choose an answer.',
        'The event feed. Here is the first line of the chapter’s snippet: nine events, a plus 5, a plus 3, b plus 7, and so on. A plus 5 means 5 more clicks for campaign a.',
        'The totals can be worked out from these events, but the events can never be worked out from the totals. So the stream is the source, and everything else is made from it.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, line 2 ---------- */
    {
      title: 'Total', layout: 'code', defines: ['aggregation'],
      eyebrow: '10 · Interview question 2 · the snippet, line 2',
      heading: 'The running total is the stream, aggregated',
      stand: 'Each campaign’s running total is the table view of the same events.',
      question: { step: 0, prompt: 'How is each campaign’s running total produced from the nine events?', options: [
        { text: 'Add up each campaign’s clicks: “a” 24, “b” 21.', correct: true, why: '5 + 3 + 2 + 6 + 8 is 24 and 7 + 1 + 9 + 4 is 21: a sum of clicks, the table made from the stream.' },
        { text: 'Take each campaign’s last event: “a” 8, “b” 4.', correct: false, why: 'These events say “plus”, so every one counts. The last alone throws the rest away.' },
        { text: 'Count each campaign’s events: “a” 5, “b” 4.', correct: false, why: 'That counts the reports, not the clicks they carry. The total is a sum of clicks.' } ] },
      code: Q2.build({ before: [Q2_EVENTS], add: [Q2_VIEWS], step: 1 }),
      cards: [ { step: 2, title: 'Aggregation: stream → table', html: '<p>Combining the events per campaign is <b>aggregation</b>. Stream: 9 events. Table: a:24 b:21. Both total <b>45</b>.[[src:q2]]</p>' } ],
      narration: [
        'How is each campaign’s running total produced from the nine events? Choose an answer.',
        'Add up each campaign’s clicks: “a” 24 and “b” 21. Here is the second line: the stream has 9 events, the table has 24 and 21 clicks, summed to 45 either way.',
        'Combining many events into one value per campaign is called aggregation. It turns the stream into the table, and nothing is invented or lost: both views total 45.'
      ]
    },

    /* ---------- 11 · Q2: the snippet, line 3 ---------- */
    {
      title: 'Same', layout: 'code',
      eyebrow: '11 · Interview question 2 · the snippet, line 3',
      heading: 'One source, two views',
      stand: 'The last line of the snippet is the guarantee.',
      question: { step: 0, prompt: 'Why can the feed and the totals no longer disagree?', options: [
        { text: 'The totals are computed from the feed, so there is only one writer.', correct: true, why: 'A view worked out from another can be behind, but cannot hold different data.' },
        { text: 'Because both are checked every minute.', correct: false, why: 'Checking helps, but the guarantee is structural: one is made from the other.' },
        { text: 'Because the feed is faster now.', correct: false, why: 'Speed was never the problem. Two independent computations were.' } ] },
      code: Q2.build({ before: [Q2_EVENTS, Q2_VIEWS], add: [Q2_SAME], step: 1 }),
      cards: [ { step: 2, title: 'One system, two views', html: '<p>Keep the event feed as the stream of truth, and derive the per-campaign totals by aggregating it.[[src:q2]]</p>' } ],
      narration: [
        'Why can the feed and the totals no longer disagree? Choose an answer.',
        'Because the totals are computed from the feed: one source, one writer. Here is the last line: both come from the same source, so they cannot disagree.',
        'That is the chapter’s answer: keep the event feed as the stream of truth, and derive the per-campaign total as a table by aggregating it. One system, two views.'
      ]
    },

    /* ---------- 12 · Q2: what it costs ---------- */
    {
      title: 'Cost', layout: 'ask', defines: ['materialize'],
      eyebrow: '12 · Interview question 2 · what it costs',
      heading: 'Store the totals, or add them up each time?',
      stand: 'A dashboard asks for the campaign totals 10 times. Adding up all 9 events per question costs 9 reads each time.',
      question: {
        step: 0,
        prompt: 'Should the totals be stored, or recomputed from the events for every question?',
        options: [
          { text: 'Stored: 9 event reads once, against 90 over 10 questions.', correct: true,
            why: 'Storing wins from the first repeat, and recomputing gets worse as the feed grows.' },
          { text: 'Recomputed: storing them would let them drift.', correct: false,
            why: 'Stored totals made from the feed lag at worst; they cannot drift. Drift needs two writers.' },
          { text: 'It makes no difference.', correct: false,
            why: '9 reads against 90 is a real difference, and it grows with the length of the feed.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Materialize', html: '<p>To <b>materialize</b> is to work a result out and store it. Eager: 9 reads once. Lazy: 9 per query, 90 over 10.[[src:pwhy]]</p>' },
        { step: 2, title: 'Recompute only when rare', html: '<p>Lazy cost grows with the stream length, not with the number of campaigns. Recompute only a view asked far less often than it changes.[[src:pwhy]]</p>' }
      ],
      narration: [
        'Last angle: what does it cost? A dashboard asks for the totals 10 times. Should they be stored, or recomputed from the 9 events every time? Choose an answer.',
        'Stored. Working a result out and storing it is called materializing. It costs 9 event reads once, against 90 over 10 questions if recomputed each time.',
        'And recomputing gets worse as the feed grows, while the totals stay two numbers. Stored totals made from the feed can lag, but they cannot drift.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask', defines: ['watermark', 'window'],
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'What is a stream?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What is a stream in the stream-table duality?',
        options: [
          { text: 'A snapshot of state', correct: false,
            why: 'That is a table: what is true at one moment.' },
          { text: 'A sequence of events over time', correct: true,
            why: 'The moving, append-only change log: what happened, in order.' },
          { text: 'A database index', correct: false,
            why: 'An index is a table built from data, a still view.' },
          { text: 'A materialized view', correct: false,
            why: 'A materialized view is a table worked out from a stream.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A stream is the moving, append-only change log. (Two later quiz options name a <b>watermark</b> and a <b>window</b>: tools from other chapters for judging time, not views of data.)[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What is a stream in the stream-table duality? Choose an answer.',
        'A sequence of events over time: the moving, append-only change log. Two later options name a watermark and a window, which are tools from other chapters for judging time, not views of data.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'What is a table?',
      stand: 'Think of the two balance rows: 24 and 21.',
      question: {
        step: 0,
        prompt: 'What is a table in the stream-table duality?',
        options: [
          { text: 'An event feed', correct: false,
            why: 'A feed is moving: that is a stream.' },
          { text: 'A changelog', correct: false,
            why: 'A changelog is the stream of a table’s changes.' },
          { text: 'A snapshot of state at a point in time', correct: true,
            why: 'The still view: what is true now, one row per key.' },
          { text: 'A retraction', correct: false,
            why: 'A retraction is the old value in a change record, not a view.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A table is the still, materialized view of state: “a” 24, “b” 21.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. What is a table in the stream-table duality? Choose an answer.',
        'A snapshot of state at a point in time: the still view, what is true now. For our accounts, “a” 24 and “b” 21.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'Aggregating a stream produces…',
      stand: 'Remember the nine events adding up per campaign.',
      question: {
        step: 0,
        prompt: 'Aggregating a stream produces a ___ .',
        options: [
          { text: 'stream', correct: false,
            why: 'Aggregating collapses the stream; the result is still, not moving.' },
          { text: 'table', correct: true,
            why: 'The fold of the stream: one value per key, its materialized view.' },
          { text: 'changelog', correct: false,
            why: 'A changelog comes from capturing a table’s changes, the other direction.' },
          { text: 'watermark', correct: false,
            why: 'A watermark is about time, from another chapter, not a view of the data.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Aggregation folds the stream into a materialized table: 9 events → a:24 b:21.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. Aggregating a stream produces what? Choose an answer.',
        'A table. Aggregation folds the stream into its materialized view: nine events become “a” 24 and “b” 21.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'What does change capture produce?',
      stand: 'Remember the record (16, 24).',
      question: {
        step: 0,
        prompt: 'What does change-data-capture produce?',
        options: [
          { text: 'A table', correct: false,
            why: 'It starts from a table; what it produces is the other view.' },
          { text: 'A changelog stream of a table’s changes', correct: true,
            why: 'One (old, new) record per write, in order.' },
          { text: 'A watermark', correct: false,
            why: 'Watermarks belong to another chapter, about event time.' },
          { text: 'A window', correct: false,
            why: 'Windows group events by time, another chapter’s tool.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>CDC turns table writes into a changelog stream of (old, new) pairs, such as (16, 24).[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. What does change-data-capture produce? Choose an answer.',
        'A changelog stream of the table’s changes: one old-and-new record per write, such as 16 to 24.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'Why keep the stream as the source of truth?',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'Why keep the stream as the source of truth?',
        options: [
          { text: 'It is faster to query', correct: false,
            why: 'The table is faster for “what is true now”. Speed is not the reason.' },
          { text: 'Any past table is recoverable by folding the stream', correct: true,
            why: 'The stream is the full history, so any past table is a fold up to that point.' },
          { text: 'It uses less storage', correct: false,
            why: 'It usually uses more: it keeps every change, not just the latest.' },
          { text: 'It never needs retractions', correct: false,
            why: 'Changelogs carry old values exactly so that consumers can retract.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The stream is the full history, so any past table is a fold up to that point: after record 4, “a” 16 and “b” 7.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. Why keep the stream as the source of truth? Choose an answer.',
        'Because any past table is recoverable by folding the stream up to that point, such as “a” 16 and “b” 7 right after record 4. The table alone has forgotten that.'
      ]
    },

    /* ---------- 18 · recap of the chapter ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 6, and its two interview questions',
      heading: 'One dataset, two views, one writer',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Two views</b>', 'A stream says what happened; a table says what is true now. Both total 45.[[src:faces]]'] },
          { step: 1, cells: ['<b>Question 1 · table → stream</b>', 'CDC emits (old, new) records; folding them back is the check: 45, or 37 when a write is missed.[[src:q1]]'] },
          { step: 1, cells: ['<b>Old and new</b>', 'Without the old value a summing reader shows 40, not 24, and the move of 8 is lost.[[src:dwhy]]'] },
          { step: 2, cells: ['<b>Question 2 · stream → table</b>', 'Keep the events as truth; aggregate them into totals: a:24 b:21.[[src:q2]]'] },
          { step: 3, cells: ['<b>One writer</b>', 'A derived view lags; two writers drift. Pick a direction, and keep the stream while you need its history.[[src:pwhy]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Every data system picks a point on this duality. Pick which view is the source, make the other from it, and never write both.[[src:kc]]</p>' },
      narration: [
        'To recap the chapter. A stream says what happened; a table says what is true now. They are two views of one dataset, and both total 45.',
        'Question 1 runs table to stream: C D C emits old-and-new records, and folding them back is the check. Without the old value, a summing reader shows 40 instead of 24.',
        'Question 2 runs stream to table: keep the click events as the truth, and aggregate them into each campaign’s total.',
        'And the rule behind both: a derived view only lags, two writers drift. Pick one direction, make the other view from it, and never write both.'
      ]
    }
  ]
};
