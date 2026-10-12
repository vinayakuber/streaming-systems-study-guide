// Chapter 7, Part 5 — Variation 2, the unique-visitor count, built as a program WITH the viewer.
// The running-total program of part 4 turns into a distinct count, and the chapter's bound stops
// working: the expiry now overstates, and only a sketch makes the memory fixed. Every code slide
// asks what the next piece must do, then reveals the real lines of programs/ch07_v2.py (read at
// build time, addressed by content); the deck ends with the whole file and what it prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch07';
const P = program('ch07_v2.py');
const OUT = program('ch07_v2.out');

// the pieces, in the order they are written
const DATA = P.span('import hashlib', 'ONE_VISITOR = [');
const EXACT = P.fn('exact_distinct');
const COUNT = P.fn('count_the_views');
const EXPIRE = P.fn('distinct_with_expiry');
const HASH = P.fn('hashed');
const KMV = P.fn('kmv_sketch');
const HELD = P.fn('held_at');
const STREAM = P.fn('stream_of');
const MORE = P.span('# More inputs for the examples table', 'BIGGER_STREAM = stream_of');
const TABLE_C = P.span('---- WORKED EXAMPLES', 'a comment: a comment can go stale');
const TABLE = P.block('EXAMPLES = [');
const SHOW = P.fn('show_examples');
const M_VIEWS = P.span('def main():', 'is not visible in the output at all.');
const M_UP = P.span("# the chapter's bound, applied here", 'evidence that the visitor was not new.');
const M_DAY = P.span('# and the expiry buys nothing inside a day', 'assert worst_day < whole_run');
const M_SKETCH = P.span('# the sketch: constant state at every cardinality', 'costs nothing and needs no lookup against the past.');
const M_MANY = P.span('# many inputs: the sketch', 'assert 0 < overcounts < 20');
const M_SCALE = P.span('# the scale the question names', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['distinct visitors      : 2   (2 slots held)', '+1 per event           : 9',
  "the chapter's accumulator inflates the answer 4.5x here", 'ttl = 295 (the longest silence) : 2 distinct, 0 recounts  (correct)',
  'ttl = 294                      : 3 distinct, 1 recount   OVERSTATED', 'visitors saved by a day-long ttl, at any moment in this example: 0',
  'so the exact answer needs 900 slots at a time and not 1600', 'from the 256 row to the 20,000 row the exact state grows 78x',
  'boundaries: at 255 distinct the sketch holds every hash and is EXACT (255)', 'it already disagrees (257)',
  'the expiring exact counter overstated on 19 of 20 days and understated on 0', 'exact  : 0.48 GB of visitor ids',
  'sketch : 2,048 bytes, whatever the cardinality', 'the sketch is 234,375 times smaller', 'all 13 examples agree with the exact set', 'all assertions passed',
  '4,000 distinct (generated)             4,000      -     4,000     3,721'])
  if (!printed.includes(s)) throw new Error(`programs/ch07_v2.out no longer prints "${s}" — rewrite the narration`);

module.exports = {
  title: 'Counting Distinct Visitors',
  eyebrow: 'Streaming · Ch 7 · Part 5',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'GB': 'gigabytes' } },
  jargon: ['view', 'visitor', 'distinct', 'state', 'event time', 'processing time', 'allowance', 'function',
    'set', 'hash', 'sketch', 'slot'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 7 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 7 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 7 · variation 2, the unique-visitor count')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['view', 'visitor', 'distinct', 'state', 'slot'],
      eyebrow: '01 · Variation 2 · looks like analytics',
      heading: 'How many different people came today?',
      hero: { step: 0, text: 'A website logs every page load, called a <b>view</b>. Each view carries the id of the person who loaded it, the <b>visitor</b>. The site wants the number of <b>distinct</b> visitors per day: how many <i>different</i> ids appeared, not how many views. What the program keeps in memory to answer is its <b>state</b>; each thing it remembers takes one <b>slot</b>.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'views in our example[[src:vars]]' },
        { step: 1, value: 2, label: 'distinct visitors: a and b[[src:vars]]' },
        { step: 2, value: 295, label: 'seconds visitor a stays silent[[src:vars]]' },
        { step: 2, value: 256, label: 'numbers the fixed-size answer keeps[[src:vars]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A distinct count per day', text: 'Not a sum: a thousand views from one visitor is one visitor.' },
        { step: 3, n: 2, title: 'Bounded memory', text: 'Tens of millions of visitors a day must not mean tens of millions of slots.' },
        { step: 4, n: 3, title: 'Does the old bound still work?', text: 'Forgetting quiet keys saved memory for totals. Here it breaks the other way.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A website logs every page load, called a view. Each view carries the id of the person who loaded it, the visitor. The site wants the number of distinct visitors per day: how many different ids appeared.',
        'Our example has 9 views from just 2 distinct visitors, A and B.',
        'Visitor A goes silent for 295 seconds in the middle. At real scale there are a billion views a day, and the answer we build will keep just 256 slots, whatever the count.',
        'So the interviewer wants a distinct count per day, not a sum: a thousand views from one visitor is still one visitor. And the memory, the state, must be bounded.',
        'And the trap: the trick that bounded memory for running totals, forgetting quiet keys, breaks here, in the opposite direction. We will write the program together.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['event time', 'processing time', 'allowance'],
      eyebrow: '02 · Before any code · try it by hand',
      heading: 'Forget a visitor who has been away too long',
      stand: 'Each view has two times: when it happened (event time) and when the program saw it (processing time); this program uses when it happened, in seconds. Visitor a views at 1, 3, 130, 245 and 540: silent for 295 before the last.',
      question: {
        step: 0,
        prompt: 'The program forgets any visitor quiet for more than 294 seconds. How many distinct visitors does it report?',
        options: [
          { text: '2: forgetting a visitor cannot change who came.', correct: false,
            why: 'It can. At 540, a has been forgotten, so its view looks like a brand-new visitor and is counted again.' },
          { text: '1: forgetting a removes it from the count.', correct: false,
            why: 'The count only goes up when a new id arrives. Forgetting a does not subtract it; it makes a look new later.' },
          { text: '3: a is forgotten, then counted again as new.', correct: true,
            why: 'A forgotten visitor is indistinguishable from one never seen, so a is counted twice: 3 for a day with 2.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two clocks, one used', html: '<p><b>Event time</b> is when it happened; <b>processing time</b> is when it was seen. This program uses event time only.[[src:vars]]</p>' },
        { step: 2, title: 'Allowance, and the opposite sign', html: '<p>How long a visitor is remembered while quiet is the <b>allowance</b>. At 294 the count reads <b>3</b>: too <b>high</b>. For running totals, the same mistake made a total too low.[[src:vars]]</p>' }
      ],
      narration: [
        'Try it by hand first. The program forgets any visitor quiet for more than 294 seconds. Visitor A is silent for 295 before its last view. How many distinct visitors does it report? Choose an answer.',
        'Each view has two times: when it happened, its event time, and when the program saw it, its processing time. This program uses when it happened.',
        'The answer is 3. How long a visitor is remembered is the allowance. A is forgotten, then counted again as new: 3 for a day with 2. With running totals, this mistake made a total too low. Here it is too high.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine views, two visitors, one day',
      stand: 'The first thing the program needs is the views, and the right answer to check against.',
      question: { step: 0, prompt: 'The chapter’s events carried a key, a value and a time. What does a view log need?', options: [
        { text: 'The visitor and the time; the value is dropped.', correct: true, why: 'A distinct count adds nothing up. Who and when are all it needs.' },
        { text: 'All three, since the value is the visit length.', correct: false, why: 'Nothing here measures length. Keeping a column nobody uses only adds noise.' },
        { text: 'The visitor only, since time does not matter.', correct: false, why: 'Time matters twice: for the day the count belongs to, and for any allowance.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch07_v2.py · the data' }),
      cards: [ { step: 2, title: 'The constants', html: '<p>9 views, true answer 2. A day is 86,400 seconds; <code>K</code> = 256 is used later. Every piece below is a <b>function</b>: a named recipe that takes inputs and gives back an answer.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The chapter’s events carried a key, a value and a time. What does a view log need? Choose an answer.',
        'The visitor and the time; the value is dropped. Here are the first lines: the nine views, the true answer 2, a day of 86,400 seconds, and K, 256, which is used later.',
        'Every piece below is a function: a named recipe that takes inputs and gives back an answer. Let us start with the exact answer.'
      ]
    },

    /* ---------- 4 · the exact answer ---------- */
    {
      title: 'Exact', layout: 'code', defines: ['set'],
      eyebrow: '04 · Writing the program · the exact answer, and the wrong one',
      heading: 'To know who is new, keep everyone',
      stand: 'For a running total, one number per key was enough. A distinct count asks a different question of each view: have I seen this visitor before?',
      question: { step: 0, prompt: 'What must the program keep to answer “is this visitor new?” exactly?', options: [
        { text: 'One counter, plus one for each view.', correct: false, why: 'That counts views, 9, not visitors, 2. It is the right answer to a different question.' },
        { text: 'Every visitor seen so far today.', correct: true, why: 'Only the visitors themselves can say whether this one is new, so the state grows with the answer.' },
        { text: 'Only the last visitor seen.', correct: false, why: 'Visitor a views, then b, then a again. Checking only the last one would count a twice.' } ] },
      code: P.build({ before: [DATA], add: [EXACT, COUNT], step: 1 }),
      cards: [ { step: 2, title: 'A set, sized by the answer', html: '<p>A <b>set</b> is a collection with no repeats. <code>exact_distinct</code> keeps one place per visitor: 2 here, tens of millions at scale. <code>count_the_views</code> keeps 1 number and answers 9: 4.5 times too many.[[src:vars]]</p>' } ],
      narration: [
        'For running totals, one number per key was enough. Here each view asks: have I seen this visitor before? What must the program keep to answer that exactly? Choose an answer.',
        'Every visitor seen so far today. Here is exact distinct: it puts each visitor into a set, a collection with no repeats, and the count is the set’s size. Below it, count the views, the tempting wrong answer.',
        'The exact state is one place per visitor: 2 here, tens of millions at scale. Counting views keeps one number, but answers 9, which is 4.5 times too many.'
      ]
    },

    /* ---------- 5 · the chapter's bound, applied ---------- */
    {
      title: 'Expire', layout: 'code',
      eyebrow: '05 · Writing the program · the old bound, bolted on',
      heading: 'Drop quiet visitors to save memory',
      stand: 'The chapter bounded its state by dropping keys quiet longer than the allowance. Apply the same rule to the set of visitors.',
      question: { step: 0, prompt: 'When a dropped visitor comes back, which way is the count wrong?', options: [
        { text: 'Too high: the visitor is counted a second time.', correct: true, why: 'Being absent from the set means being new, so the count rises again for a visitor already counted.' },
        { text: 'Too low: the visitor’s earlier visit is lost.', correct: false, why: 'The earlier visit was already counted, and nothing subtracts it. The error is in the extra count.' },
        { text: 'Either way, at random.', correct: false, why: 'It has one direction. A drop can only cause an extra count, never a missing one.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT], add: [EXPIRE], step: 1 }),
      cards: [ { step: 2, title: 'The opposite sign', html: '<p><code>distinct_with_expiry</code> drops any visitor untouched for longer than the allowance, and counts recounts. The count can only rise above the truth, never fall below it.[[src:vars]]</p>' } ],
      narration: [
        'The chapter bounded its state by dropping quiet keys. Apply the same rule to the visitors. When a dropped visitor comes back, which way is the count wrong? Choose an answer.',
        'Too high: the visitor is counted again. Here is distinct with expiry: before each view it drops visitors quiet for longer than the allowance, and it counts how many visitors it met twice.',
        'So the failure has the opposite sign from the chapter’s. There, a dropped total made the answer too low. Here, a dropped visitor makes the count too high, never too low.'
      ]
    },

    /* ---------- 6 · the sketch ---------- */
    {
      title: 'Sketch', layout: 'code', defines: ['hash', 'sketch'],
      eyebrow: '06 · Writing the program · a fixed-size answer',
      heading: 'Keep the 256 smallest hash values, and nothing else',
      stand: 'Turn each visitor id into a number between 0 and 1 that looks random but is always the same for the same id. Spread evenly, many distinct ids push the smallest numbers closer to 0.',
      question: { step: 0, prompt: 'Keeping only the 256 smallest of those numbers, how can the program estimate how many distinct visitors there were?', options: [
        { text: 'From how small the 256th smallest number is.', correct: true, why: 'With n ids spread evenly, the 256th smallest lands near 256 divided by n, so n is about 255 divided by it.' },
        { text: 'By counting how many numbers it kept.', correct: false, why: 'It keeps 256 once it is full, whatever the count. The size alone says nothing.' },
        { text: 'It cannot: an estimate needs every visitor.', correct: false, why: 'That is the exact answer’s cost. Giving up exactness is exactly what frees the memory.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE], add: [HASH, KMV], step: 1 }),
      cards: [ { step: 2, title: 'Fixed memory, small error', html: '<p>The id-to-number step is a <b>hash</b>; repeats hash to a value already held, so they cost nothing. Keeping k smallest is a <b>sketch</b>: at most 256 <b>slots</b>. Below 256 distinct it is exact; above, it estimates.[[src:vars]]</p>' } ],
      narration: [
        'Turn each id into a number between 0 and 1 that looks random but never changes. Keep only the 256 smallest. How can that estimate the number of distinct visitors? Choose an answer.',
        'From how small the 256th smallest is. Turning an id into such a number is called hashing. Here is hashed, and k minimum values: it keeps the 256 smallest hashes, and estimates 255 divided by the largest one kept.',
        'An approximate counter like this is a sketch, and it holds at most 256 slots, however many visitors there are. A repeat visitor hashes to a value already held, so it costs nothing. Below 256 distinct, it is exact.'
      ]
    },

    /* ---------- 7 · measuring tools and the example table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '07 · Writing the program · the worked examples',
      heading: 'Thirteen examples, each checked two ways',
      stand: 'Before main, the program builds test streams with a known number of visitors, and a table of examples that it asserts.',
      question: { step: 0, prompt: 'At exactly 256 distinct visitors, the sketch is just full. What should the table expect it to say?', options: [
        { text: 'Exactly 256: it holds every visitor’s hash.', correct: false, why: 'At 256 it is full, so the estimator takes over. It already says 257: exactness ends one visitor before the memory does.' },
        { text: 'About 257: the estimate takes over and is 1 high.', correct: true, why: 'The table records 257, and asserts it, so the moment exactness ends is written down rather than hidden.' },
        { text: 'An error: it cannot count past its size.', correct: false, why: 'It counts any number of visitors. Past its size it estimates instead of counting.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV], add: [HELD, STREAM, MORE, TABLE_C, TABLE, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'What the table pins', html: '<p>Both sides of the 295-second silence (2 and 3), an empty day (0), one visitor with 1,000 views (1), and the sketch at 255 (exact), 256 (257), 4,000 (3,721) and 12,000 (11,544).[[src:vars]]</p>' } ],
      narration: [
        'Before main, the program builds test streams and a table of worked examples. At exactly 256 distinct visitors, the sketch is just full. What should the table expect? Choose an answer.',
        'About 257. Here are held at, stream of, the generated streams, and the table: each row is checked against the exact set and against the sketch, so it cannot drift from the code.',
        'The table pins both sides of the 295-second silence, an empty day, one visitor with 1,000 views, and the sketch at 255, exact, at 256, saying 257, and at 4,000, saying 3,721.'
      ]
    },

    /* ---------- 8 · views versus visitors, and the bound upward ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '08 · Writing the program · the main checks',
      heading: 'Views overstate, and the expiry overstates too',
      stand: 'Main starts with the example: 9 views, 2 visitors. Then it applies the chapter’s bound at 295 and at 294.',
      question: { step: 0, prompt: 'Counting views instead of visitors gives 9 for 2. What does that inflation measure?', options: [
        { text: 'The average views per visitor, a number nobody reports.', correct: true, why: '9 views over 2 visitors is 4.5. Because nobody reports it, the error is invisible in the output.' },
        { text: 'The number of repeated visitors.', correct: false, why: 'Both visitors repeat, and the ratio is 4.5, not 2. It is views per visitor on average.' },
        { text: 'Nothing: it is a rounding error.', correct: false, why: 'It is 4.5 times too many. The size of the error is the size of the habit of returning.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV, HELD, STREAM, MORE, TABLE_C, TABLE, SHOW], add: [M_VIEWS, M_UP], step: 1 }),
      cards: [ { step: 2, title: 'Too high, by the recounts', html: '<p>Views: 9, inflated <b>4.5x</b>. At 295: 2 distinct, 0 recounts. At 294: <b>3</b> distinct, 1 recount, OVERSTATED — the dropped visitor was the evidence that they were not new.[[src:vars]]</p>' } ],
      narration: [
        'Main starts with the example. Counting views instead of visitors gives 9 for 2. What does that inflation measure? Choose an answer.',
        'The average views per visitor. Here is the start of main: 9 views against 2 visitors, 4.5 times. Then the chapter’s bound at 295, the longest silence, and at 294, one second tighter.',
        'At 295, 2 distinct and no recounts. At 294, 3 distinct with 1 recount, overstated. The thing dropped was the evidence that the visitor was not new.'
      ]
    },

    /* ---------- 9 · the day is the bound ---------- */
    {
      title: 'Day', layout: 'code',
      eyebrow: '09 · Writing the program · what actually bounds the state',
      heading: 'Inside one day, nobody can be forgotten',
      stand: 'The question asks for distinct visitors TODAY. So every visitor seen today is still needed today.',
      question: { step: 0, prompt: 'How many visitors does a day-long allowance save, at any moment of our example?', options: [
        { text: 'One: visitor a during its long silence.', correct: false, why: 'a is quiet for 295 seconds, far less than a day. Inside the day it is never stale.' },
        { text: 'None: inside the day no visitor is ever stale.', correct: true, why: 'Every visitor seen today is needed until the day ends. The only thing that frees the state is the day boundary.' },
        { text: 'Both, once each has gone quiet.', correct: false, why: 'Going quiet for seconds is not going stale for a day. Nobody is dropped.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV, HELD, STREAM, MORE, TABLE_C, TABLE, SHOW, M_VIEWS, M_UP], add: [M_DAY], step: 1 }),
      cards: [ { step: 2, title: 'The window is the bound', html: '<p>Saved by a day-long allowance: <b>0</b>. Over three days of 400, 900 and 300 visitors, the exact answer needs <b>900</b> slots at a time, not 1600: the day boundary frees the state, at the busiest day’s size.[[src:vars]]</p>' } ],
      narration: [
        'The question asks for distinct visitors today, so every visitor seen today is needed today. How many does a day-long allowance save at any moment? Choose an answer.',
        'None. Here is the check, measured at every moment: 0 saved. Then three days, of 400, 900 and 300 visitors, measured together.',
        'The exact answer needs 900 slots at a time, not 1,600. The day boundary is what frees the state, and it is part of the question, not a bound anyone chose. But 900 still grows with the visitors.'
      ]
    },

    /* ---------- 10 · the sketch, measured ---------- */
    {
      title: 'Flat', layout: 'code',
      eyebrow: '10 · Writing the program · the sketch, measured',
      heading: 'The exact state grows 78 times. The sketch does not grow.',
      stand: 'Main now runs the sketch at 50, 255, 256, 1,000, 4,000 and 20,000 distinct visitors.',
      question: { step: 0, prompt: 'From 256 distinct visitors to 20,000, how much does the sketch’s memory grow?', options: [
        { text: 'Not at all: it stays at 256 slots.', correct: true, why: 'Once full, it only swaps a larger hash for a smaller one. The slot count never changes.' },
        { text: 'About 78 times, like the exact set.', correct: false, why: 'That is the exact set, whose state is the cardinality itself. The sketch’s state is fixed at k.' },
        { text: 'A little, to keep the error small.', correct: false, why: 'The error is set by k alone: a standard error of 1 over the square root of 256, which is 6.25%.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV, HELD, STREAM, MORE, TABLE_C, TABLE, SHOW, M_VIEWS, M_UP, M_DAY], add: [M_SKETCH], step: 1 }),
      cards: [ { step: 2, title: 'Exactness ends one early', html: '<p>Exact state grows <b>78x</b>; the sketch stays at 256. Worst error 7.0%, against a predicted 6.25%. At 255 it is exact (255); at 256 it already says 257.[[src:vars]]</p>' } ],
      narration: [
        'Main now runs the sketch from 50 up to 20,000 distinct visitors. From 256 to 20,000, how much does the sketch’s memory grow? Choose an answer.',
        'Not at all. Here is the measurement: the exact state grows 78 times, while the sketch stays at 256 slots. Its worst error is 7 percent, against its own predicted 6.25 percent.',
        'And the boundaries: at 255 distinct the sketch holds every hash and is exact. At 256 it is full and already says 257. An empty day gives 0, and a thousand views from one visitor give 1.'
      ]
    },

    /* ---------- 11 · many random days ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '11 · Writing the program · twenty random days',
      heading: 'The sketch’s error is bounded; the expiry’s has one sign',
      stand: 'Main generates 20 random days of 300 to 1,200 visitors, and runs the expiring counter on a short stream of its own each time.',
      question: { step: 0, prompt: 'On one of the 20 days the expiring counter was exact. Why?', options: [
        { text: 'Its allowance was wider than every silence that day, so it dropped nobody.', correct: true, why: 'Widening the allowance until it is safe is the same as not bounding at all.' },
        { text: 'The sketch corrected it.', correct: false, why: 'The two are separate counters. Nothing passes between them.' },
        { text: 'That day had only one visitor.', correct: false, why: 'Every day had hundreds. The allowance, not the crowd, decided it.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV, HELD, STREAM, MORE, TABLE_C, TABLE, SHOW, M_VIEWS, M_UP, M_DAY, M_SKETCH], add: [M_MANY], step: 1 }),
      cards: [ { step: 2, title: 'A corrected claim', html: '<p>The first version said the expiry overstates <b>every</b> day; one day refused it. What survives: overstated on <b>19 of 20</b>, understated on <b>0</b>. The sketch held 256 slots each time, mean error 3.43%.[[src:vars]]</p>' } ],
      narration: [
        'Main then runs 20 random days. On one of them the expiring counter came out exact. Why? Choose an answer.',
        'Its allowance was wider than every silence that day, so it dropped nobody. Here is the loop, with the corrected claim written beside it: the first version said it overstates every day.',
        'What survives: it overstated on 19 days of 20, and understated on none. The sketch held 256 slots every time, with a mean error of 3.43 percent.'
      ]
    },

    /* ---------- 12 · the scale, priced ---------- */
    {
      title: 'Price', layout: 'code',
      eyebrow: '12 · Writing the program · the scale the question names',
      heading: 'Thirty million visitors, priced',
      stand: 'The last piece prices the two answers at 30,000,000 distinct visitors a day.',
      question: { step: 0, prompt: 'At 16 bytes per visitor id against 256 numbers of 8 bytes, which costs what?', options: [
        { text: 'Exact: 0.48 GB per counter per day. Sketch: 2,048 bytes.', correct: true, why: '30,000,000 × 16 bytes against 256 × 8 bytes. The first grows with the visitors; the second never does.' },
        { text: 'Both about the same, since both count visitors.', correct: false, why: 'One stores every visitor; the other stores 256 numbers. Their sizes are nowhere near each other.' },
        { text: 'Sketch: 0.48 GB. Exact: 2,048 bytes.', correct: false, why: 'Reversed. The exact set is the one whose size is the number of visitors.' } ] },
      code: P.build({ before: [DATA, EXACT, COUNT, EXPIRE, HASH, KMV, HELD, STREAM, MORE, TABLE_C, TABLE, SHOW, M_VIEWS, M_UP, M_DAY, M_SKETCH, M_MANY], add: [M_SCALE], step: 1 }),
      cards: [ { step: 2, title: 'Bytes against gigabytes', html: '<p>The sketch is 234,375 times smaller, and its cost does not depend on the answer — the property the chapter’s one-number total had, and the exact distinct count never did.[[src:vars]]</p>' } ],
      narration: [
        'The last piece prices both answers at 30 million distinct visitors a day. At 16 bytes per id, against 256 numbers of 8 bytes, which costs what? Choose an answer.',
        'The exact set costs 0.48 gigabytes per counter per day; the sketch costs 2,048 bytes, whatever the count: 234,375 times smaller. Here are those lines, with the ratio asserted.',
        'The sketch’s cost does not depend on the answer. That is the property a one-number running total had, and an exact distinct count never does.'
      ]
    },

    /* ---------- 13 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '13 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written and why.',
        'From the top: the views, the exact set, the view counter, the expiry, the hash and the sketch, the examples table, and main, which measures and asserts every claim.'
      ]
    },

    /* ---------- 14 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '14 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch07_v2.py prints'),
      narration: [
        'Here is what it prints: first the 13 worked examples, all agreeing with the exact set. Then 2 distinct visitors against 9 views, and the expiry at 294 overstating to 3.',
        'Then the day boundary, the sketch flat at 256 slots, 19 overstated days of 20, and the price: 0.48 gigabytes against 2,048 bytes. Every assertion passed.'
      ]
    },

    /* ---------- 15 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '15 · What you built',
      heading: 'A sum is one number. A distinct count is not.',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>exact_distinct</code>', 'keeps every visitor in a set: state = the answer', '2 slots; 30 million at scale'] },
          { step: 0, cells: ['<code>count_the_views</code>', 'one number, the wrong question', '9, inflated 4.5x'] },
          { step: 1, cells: ['<code>distinct_with_expiry</code>', 'the chapter’s bound: overstates, never understates', '3 at 294'] },
          { step: 1, cells: ['<code>kmv_sketch</code>', 'the 256 smallest hashes: fixed memory, small error', '3,721 for 4,000'] },
          { step: 2, cells: ['<code>main</code>', 'day boundary, flat sketch, 20 random days, the price', '2,048 bytes vs 0.48 GB'] }
        ]
      },
      side: { step: 3, title: 'The recognition', html: '<p>The chapter’s bound works because a sum is <b>one number</b>. A distinct count needs the values themselves, so no expiry helps; the way out is to give up exactness.[[src:vars]]</p>' },
      narration: [
        'To recap. Exact distinct keeps every visitor, so its state is the answer itself. Counting views keeps one number and answers the wrong question, 4.5 times too high.',
        'The chapter’s bound, applied here, overstates: 3 at 294. The sketch keeps the 256 smallest hashes, in fixed memory, with a small error: 3,721 for 4,000.',
        'Main shows the day is the real bound, the sketch stays flat, the expiry is wrong in one direction only, and the price: 2,048 bytes against 0.48 gigabytes.',
        'The thing to recognise: the chapter’s bound works because a sum is one number. A distinct count is not, so the way out is to give up exactness.'
      ]
    }
  ]
};
