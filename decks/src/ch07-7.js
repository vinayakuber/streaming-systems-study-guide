// Chapter 7, Part 7 — Variation 4, the fraud score over a lifetime, built as a program WITH the
// viewer. The requirement forbids every bound, so the score stops being stream state and moves
// into a store; then a bounded cache goes in front of it, and the same bound that cost the answer
// now only costs reads. Every code slide asks what the next piece must do, then reveals the real
// lines of programs/ch07_v4.py (read at build time, addressed by content); the deck ends with the
// whole file and what it prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch07';
const P = program('ch07_v4.py');
const OUT = program('ch07_v4.out');

// the pieces, in the order they are written
const DATA = P.span('import random', 'LAUNDERING = [');
const DATA2 = P.block('BIG_SIGNALS = sorted(');
const TRUTH = P.fn('true_scores');
const FOREVER = P.fn('score_in_memory_forever');
const EXPIRY = P.fn('score_with_expiry');
const STORE = P.fn('score_in_a_store');
const CACHE = P.fn('score_with_cache');
const HELD = P.fn('held_at');
const TABLE_C = P.span('---- WORKED EXAMPLES', 'can go stale silently, and this cannot.');
const TABLE = P.block('EXAMPLES = [');
const SHOW = P.fn('show_examples');
const M_FOUR = P.span('def main():', 'not answered, and the price is');
const M_WASH = P.span("# the expiry's error is one-directional", 'which is the one thing a risk score must not have.');
const M_CACHE = P.span('# the cache is the same bound with the opposite consequence', "the word 'expire' was hiding.");
const M_EDGE = P.span('# boundaries', 'zero-capacity cache is a write-through store and is still exact.');
const M_MANY = P.span('# many inputs: the cache is exact', 'assert wrong_runs > 0 and exact_runs > 0');
const M_SCALE = P.span('# the scale that forces the decision', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ["with a 294-day expiry : {'b': 21, 'a': 8}   (2 held, 1 restart)   WRONG",
  "in a store          : {'a': 24, 'b': 21}   (0 held between events, 18 store ops)",
  "store + 1-slot cache: {'a': 24, 'b': 21}   (1 held, 7 reads, 7 writes)",
  'earns 20 points, waits 295 days and earns 4 more scores 4 at a 294-day allowance',
  'and 24 at a 295-day one', 'every capacity is EXACT, and the reads fall from 9 to 2 as the cache grows.',
  "evicted from a 1-slot cache repeatedly and still scores 24", 'The expiring version was right in 481 of 1,600 runs and too low in 1,119',
  'in a store        : 0 held between events, 4,400 store operations', '64-slot cache     : 64 held, 2,001 reads, 2,001 writes',
  'with a 100-day expiry: 102 held, 0 restarts', "1,899 accounts' scores are simply gone",
  'all 13 examples agree with the true lifetime score', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch07_v4.out no longer prints "${s}" — rewrite the narration`);

const ALL = [DATA, DATA2, TRUTH, FOREVER, EXPIRY, STORE, CACHE, HELD, TABLE_C, TABLE, SHOW,
  M_FOUR, M_WASH, M_CACHE, M_EDGE, M_MANY, M_SCALE];
const upTo = piece => ALL.slice(0, ALL.indexOf(piece));

module.exports = {
  title: 'Lifetime Fraud Score',
  eyebrow: 'Streaming · Ch 7 · Part 7',
  ...shared,
  jargon: ['signal', 'account', 'score', 'dormant', 'state', 'event time', 'processing time', 'allowance',
    'restart', 'function', 'store', 'cache', 'evict'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 7 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 7 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 7 · variation 4, the fraud score')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['signal', 'account', 'score', 'dormant', 'state'],
      eyebrow: '01 · Variation 4 · looks like risk',
      heading: 'A risk score that must never forget',
      hero: { step: 0, text: 'A bank watches every <b>account</b> for fraud. Each risky thing an account does is a <b>signal</b> worth some points. An account’s <b>score</b> is the sum of every point it has <i>ever</i> earned: no window, no decay. Accounts can lie <b>dormant</b> — no signals — for months, and must come back with the score they left with. What the program keeps between signals is its <b>state</b>.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'signals from 2 accounts[[src:vars]]' },
        { step: 1, value: 45, label: 'points in all: a 24, b 21[[src:vars]]' },
        { step: 2, value: 295, label: 'days account a stays dormant[[src:vars]]' },
        { step: 2, value: 0, label: 'scores the final design holds between signals[[src:vars]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A lifetime score per account', text: 'Every point ever, for every account ever seen.' },
        { step: 3, n: 2, title: 'No bound allowed', text: 'Forgetting a dormant account is exactly what a fraudster wants.' },
        { step: 4, n: 3, title: 'So where does the memory go?', text: 'The chapter’s answer is unavailable. Something else must change.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A bank watches every account for fraud. Each risky thing an account does is a signal worth some points, and its score is the sum of every point it has ever earned. Accounts can lie dormant for months.',
        'Our example has 9 signals from 2 accounts, 45 points in all: A has 24 and B has 21.',
        'Account A stays dormant for 295 days. And the design we end with holds 0 scores in the streaming layer between signals.',
        'So the interviewer wants a lifetime score per account. And no bound is allowed, because forgetting a dormant account is exactly what a fraudster would want.',
        'The chapter’s answer, forgetting quiet keys, is unavailable. So what the program remembers, its state, has to go somewhere else. We will write it together.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['event time', 'processing time', 'allowance', 'restart'],
      eyebrow: '02 · Before any code · try it by hand',
      heading: 'Forget accounts dormant too long',
      stand: 'Each signal has two times: when it happened (event time) and when the bank’s program saw it (processing time); this program uses when it happened, in days. Account a earns 5, 3, 2 and 6, goes quiet on day 245, and earns 8 on day 540.',
      question: {
        step: 0,
        prompt: 'The program forgets accounts quiet for more than 294 days. What is a’s score after day 540?',
        options: [
          { text: '24: forgetting cannot lower a score.', correct: false,
            why: 'It can. On day 540, a has been quiet 295 days, so its 16 is forgotten before the 8 is added.' },
          { text: '16: the new 8 is ignored.', correct: false,
            why: 'The new signal is counted. It is the old points that are lost.' },
          { text: '8: the old 16 is forgotten and the score starts again.', correct: true,
            why: 'A forgotten account looks brand new, so its score starts from zero with just the 8.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two clocks, one used', html: '<p><b>Event time</b> is when it happened; <b>processing time</b> is when it was seen. This program uses event time, in days.[[src:vars]]</p>' },
        { step: 2, title: 'Allowance and restart', html: '<p>How long a quiet account is remembered is the <b>allowance</b>. Past it, the next signal starts the score from zero: a <b>restart</b>. a scores <b>8</b>, not 24.[[src:vars]]</p>' }
      ],
      narration: [
        'Try it by hand first. Accounts quiet for more than 294 days are forgotten. Account A goes quiet on day 245 and earns 8 on day 540. What is its score? Choose an answer.',
        'Each signal has two times: when it happened, its event time, and when the program saw it, its processing time. This program uses when it happened, in days.',
        'A scores 8. How long a quiet account is remembered is the allowance, and past it the next signal starts the score from zero, which is a restart. 16 points of history are gone.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine signals, and a two-signal mule',
      stand: 'The program starts with the signals, the true scores, and the test inputs its examples will need.',
      question: { step: 0, prompt: 'Which extra test input best shows why this bound is dangerous for fraud?', options: [
        { text: 'An account that earns 20, waits 295 days, then earns 4.', correct: true, why: 'Whether its 20 survives depends on one day of allowance: the exact pattern a fraudster would choose.' },
        { text: 'An account that earns 1 point every day.', correct: false, why: 'It is never quiet, so no allowance ever touches it. It shows nothing about the bound.' },
        { text: 'An account with no signals at all.', correct: false, why: 'Useful as an edge case, but with no score there is nothing for the bound to wash away.' } ] },
      code: P.build({ add: [DATA, DATA2], step: 1, label: 'programs/ch07_v4.py · the data' }),
      cards: [ { step: 2, title: 'The inputs', html: '<p><code>TRUE</code>: a 24, b 21. <code>DORMANCY</code> = 295. <code>LAUNDERING</code>: a “mule” earning 20, then 4 after 295 days. And 2,000 one-time accounts plus one regular. Every piece below is a <b>function</b>: a named recipe.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. Which extra test input best shows why this bound is dangerous for fraud? Choose an answer.',
        'An account that earns 20, waits 295 days, then earns 4. Here are the first lines: the nine signals, the true scores, 24 and 21, the dormancy of 295 days, and that laundering pair, called the mule.',
        'There is also an empty stream, a single signal, and 2,000 accounts seen once plus one regular. Every piece after this is a function: a named recipe that takes inputs and gives back an answer.'
      ]
    },

    /* ---------- 4 · the truth, and keeping everything ---------- */
    {
      title: 'Ever', layout: 'code',
      eyebrow: '04 · Writing the program · answer one',
      heading: 'Keep every score in memory, for ever',
      stand: 'The requirement literally asks for every point an account ever earned. The simplest program does exactly that.',
      question: { step: 0, prompt: 'Keeping every account’s score in memory for ever is correct. What is wrong with it?', options: [
        { text: 'It sometimes gives a wrong score.', correct: false, why: 'It is exact every time. That is why it is the answer to put first.' },
        { text: 'Its memory grows with every account ever seen, and never shrinks.', correct: true, why: 'One number per account ever seen, and that count only rises: a slow leak with a correct output.' },
        { text: 'It is too slow per signal.', correct: false, why: 'One addition per signal is as fast as it gets. The cost is memory, not time.' } ] },
      code: P.build({ before: upTo(TRUTH), add: [TRUTH, FOREVER], step: 1 }),
      cards: [ { step: 2, title: 'A slow leak, correctly', html: '<p><code>true_scores</code> is the requirement written out: the reference nothing may disagree with. <code>score_in_memory_forever</code> matches it, holding one number per account <b>ever</b> seen.[[src:vars]]</p>' } ],
      narration: [
        'The requirement asks for every point ever earned. Keeping every account’s score in memory for ever is correct. What is wrong with it? Choose an answer.',
        'Its memory grows with every account ever seen, and never shrinks. Here is true scores, the requirement written out, and score in memory for ever, which matches it exactly.',
        'So answer one is correct, and is a slow leak: one number for every account ever seen, a count that only rises.'
      ]
    },

    /* ---------- 5 · the chapter's bound ---------- */
    {
      title: 'Expire', layout: 'code',
      eyebrow: '05 · Writing the program · answer two',
      heading: 'The chapter’s bound, applied to a risk score',
      stand: 'Drop any account quiet for longer than the allowance. Memory is then bounded by active accounts.',
      question: { step: 0, prompt: 'Why is a restarted score worse here than a restarted running total?', options: [
        { text: 'It is the wrong answer to the question asked, and an adversary can arrange it.', correct: true, why: 'Anyone who knows the allowance can go quiet just past it, and come back with a clean score.' },
        { text: 'It uses more memory than a running total.', correct: false, why: 'It uses the same one number per account. The difference is who benefits from the error.' },
        { text: 'It is not worse: both are slightly off.', correct: false, why: 'A risk score that can be reset on purpose is not slightly off. It is a published way to evade it.' } ] },
      code: P.build({ before: upTo(EXPIRY), add: [EXPIRY], step: 1 }),
      cards: [ { step: 2, title: 'Wrong, and arrangeable', html: '<p><code>score_with_expiry</code> drops dormant accounts and counts restarts. The next signal from a dropped account looks like a first signal, so the score restarts at zero.[[src:vars]]</p>' } ],
      narration: [
        'Answer two applies the chapter’s bound: drop accounts quiet longer than the allowance. Why is a restarted score worse here than a restarted running total? Choose an answer.',
        'It is the wrong answer, and an adversary can arrange it. Here is score with expiry: it drops dormant accounts, then counts a restart whenever an account it has seen before arrives with no score.',
        'Memory becomes bounded by active accounts. But the next signal from a dropped account looks like a first signal, so its score restarts at zero.'
      ]
    },

    /* ---------- 6 · the store ---------- */
    {
      title: 'Store', layout: 'code', defines: ['store'],
      eyebrow: '06 · Writing the program · answer three',
      heading: 'The score is not stream state',
      stand: 'Every bound is forbidden. So stop asking how to bound the streaming layer’s memory, and ask whether it needs to hold the score at all.',
      question: { step: 0, prompt: 'Where should each account’s score live, so the streaming layer holds nothing between signals?', options: [
        { text: 'In the signal itself, carried along the stream.', correct: false, why: 'Each signal arrives new, with no history. The score would have to come from somewhere first.' },
        { text: 'In a database keyed by account: read, add, write back, forget.', correct: true, why: 'The score outlives the stream there. Between signals, the streaming layer holds zero scores.' },
        { text: 'In memory, but compressed.', correct: false, why: 'Compressed or not, memory still grows with every account ever seen. The question is not answered.' } ] },
      code: P.build({ before: upTo(STORE), add: [STORE], step: 1 }),
      cards: [ { step: 2, title: 'Dissolved, not answered', html: '<p>A database keyed by account is a <b>store</b>. The streaming layer holds <b>0</b> scores between signals, so there is no memory to bound. The cost moves to the store: one read and one write per signal.[[src:vars]]</p>' } ],
      narration: [
        'Every bound is forbidden, so ask instead whether the streaming layer needs the score at all. Where should each score live, so nothing is held between signals? Choose an answer.',
        'In a database keyed by account, called a store: read the score, add the points, write it back, forget. Here is score in a store: between signals, the streaming layer holds nothing.',
        'So the memory question is dissolved rather than answered. State that must outlive the stream is not stream state. The price moves to the store: one read and one write for every signal.'
      ]
    },

    /* ---------- 7 · the cache ---------- */
    {
      title: 'Cache', layout: 'code', defines: ['cache', 'evict'],
      eyebrow: '07 · Writing the program · answer three, made cheaper',
      heading: 'A bounded cache in front of the store',
      stand: 'A store read for every signal is expensive. So keep a few recent scores in memory, up to a fixed capacity, and push the oldest out when full.',
      question: { step: 0, prompt: 'This is the chapter’s bound again: a fixed number in memory, the rest dropped. Why is it safe here?', options: [
        { text: 'Because a cache is always large enough.', correct: false, why: 'It is exact at every capacity, even 0. Its size changes only how many reads it makes.' },
        { text: 'Because a pushed-out score is written to the store, so a miss reads it back.', correct: true, why: 'A miss re-reads the score; an expiry restarted it. One line makes the difference.' },
        { text: 'Because dormant accounts never come back.', correct: false, why: 'They do — that is the whole requirement. The cache is safe because it keeps them in the store.' } ] },
      code: P.build({ before: upTo(CACHE), add: [CACHE], step: 1 }),
      cards: [ { step: 2, title: 'A miss costs a read; an expiry cost the answer', html: '<p>Recent scores kept in memory in front of a store are a <b>cache</b>. When it is full, the least recently used score is <b>evicted</b>: written to the store and dropped from memory. Correct at every capacity.[[src:vars]]</p>' } ],
      narration: [
        'A store read for every signal is expensive, so put a cache in front: a few recent scores in memory, the oldest pushed out when full. That is the chapter’s bound again. Why is it safe here? Choose an answer.',
        'Because a pushed-out score is written to the store, so a miss reads it back. Recent scores kept in front of a store are called a cache, and pushing one out is called evicting.',
        'Here is score with cache. On a hit it uses the cached score; on a miss it reads the store. When full, it evicts the oldest score to the store. A miss costs a read. An expiry cost the answer.'
      ]
    },

    /* ---------- 8 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '08 · Writing the program · the worked examples',
      heading: 'Thirteen examples, each checked three ways',
      stand: 'Each row is asserted against the true score, the store and the cache. Only the expiry’s column moves.',
      question: { step: 0, prompt: 'For an account never seen, like “zz”, what should the store report?', options: [
        { text: 'A score of 0.', correct: false, why: 'Zero is the score of a clean account: a claim about it. An account never seen has no claim at all.' },
        { text: 'No score at all: the account is absent.', correct: true, why: 'Absent and clean are different answers. Reporting 0 would vouch for an account nobody has seen.' },
        { text: 'The average of all scores.', correct: false, why: 'That would invent a history for an account that has none.' } ] },
      code: P.build({ before: upTo(HELD), add: [HELD, TABLE_C, TABLE, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'What the table pins', html: '<p>Expiry: 45 at 295, <b>29</b> at 294, 8 at 100 days with 4 restarts. The mule: <b>24</b> at 295, washed to <b>4</b> at 294. A 0-slot cache: 9 store reads, still exact; one bigger than the data: 2.[[src:vars]]</p>' } ],
      narration: [
        'Next, a table of thirteen examples, each checked against the true score, the store and the cache. For an account never seen, what should the store report? Choose an answer.',
        'No score at all. Zero would be the score of a clean account, a claim nobody can make. Here are held at, the table, and the function that asserts every row.',
        'The expiry keeps 45 at 295 days, 29 at 294, and 8 at 100 days, with 4 restarts. The mule keeps 24 at 295 and is washed down to 4 at 294. Every cache size stays exact.'
      ]
    },

    /* ---------- 9 · main: four answers ---------- */
    {
      title: 'Four', layout: 'code',
      eyebrow: '09 · Writing the program · four answers side by side',
      heading: 'Forever, expiry, store, and store plus cache',
      stand: 'Main runs all four on the nine signals, with a 294-day expiry and a one-slot cache.',
      question: { step: 0, prompt: 'How many store operations does the plain store need for 9 signals?', options: [
        { text: '9: one per signal.', correct: false, why: 'Each signal needs the score read before adding, and written after. That is two operations.' },
        { text: '2: one per account.', correct: false, why: 'That is what a big enough cache achieves. The plain store reads and writes on every signal.' },
        { text: '18: one read and one write per signal.', correct: true, why: 'Read, add, write back, forget: two operations for each of the 9 signals.' } ] },
      code: P.build({ before: upTo(M_FOUR), add: [M_FOUR], step: 1 }),
      cards: [ { step: 2, title: 'Four results', html: '<p>Forever: a 24, b 21, growing for ever. Expiry at 294: a <b>8</b>, 1 restart, WRONG. Store: exact, 0 held between signals, 18 operations. One-slot cache: exact, 7 reads and 7 writes.[[src:vars]]</p>' } ],
      narration: [
        'Main runs all four answers on the nine signals. How many store operations does the plain store need for 9 signals? Choose an answer.',
        '18: one read and one write per signal. Here are the four runs and their assertions: keeping for ever is exact and grows, the expiry is wrong, the store and the cache are exact.',
        'The expiry at 294 gives A 8, with 1 restart. The store holds 0 scores between signals, for 18 operations. A one-slot cache is still exact, with 7 reads and 7 writes.'
      ]
    },

    /* ---------- 10 · main: the laundering pair ---------- */
    {
      title: 'Wash', layout: 'code',
      eyebrow: '10 · Writing the program · the direction of the error',
      heading: 'A published schedule for resetting a score',
      stand: 'The expiry’s error has a direction. Main checks it, then runs the mule: 20 points, 295 days of silence, then 4 more.',
      question: { step: 0, prompt: 'At a 294-day allowance, what does the mule score?', options: [
        { text: '24: both signals count.', correct: false, why: 'That is the 295-day result. At 294, the 20 is forgotten one day before the 4 arrives.' },
        { text: '4: the 20 is washed away.', correct: true, why: 'Anyone who knows the allowance can wait it out. A risk score must not have such a schedule.' },
        { text: '20: the late 4 is ignored.', correct: false, why: 'The late signal counts. It is the early, larger one that vanishes.' } ] },
      code: P.build({ before: upTo(M_WASH), add: [M_WASH], step: 1 }),
      cards: [ { step: 1, title: 'Biased, the way an attacker would choose', html: '<p>A score can only come out too <b>low</b>. The mule scores <b>4</b> at 294 days and <b>24</b> at 295: the allowance is a published schedule for resetting a risk score.[[src:vars]]</p>' } ],
      narration: [
        'The expiry’s error only ever lowers a score. Main checks that, then runs the mule: 20 points, 295 days of silence, then 4 more. At a 294-day allowance, what does it score? Choose an answer.',
        '4: the 20 is washed away. At 295 days it scores 24. So the allowance is a published schedule for resetting a risk score, and a risk score is the one thing that must never have one.'
      ]
    },

    /* ---------- 11 · main: the cache sweep ---------- */
    {
      title: 'Sweep', layout: 'code',
      eyebrow: '11 · Writing the program · the same bound, on a cache',
      heading: 'Every capacity exact; only the reads change',
      stand: 'Main runs the cache at capacities 0, 1, 2, 3 and 10.',
      question: { step: 0, prompt: 'As the cache grows from 0 to 10 slots, what happens to the store reads?', options: [
        { text: 'They fall, from 9 to 2, and every score stays exact.', correct: true, why: 'Bigger cache, more hits, fewer reads. The answer never changes; only the cost does.' },
        { text: 'They rise, because there is more to keep in sync.', correct: false, why: 'Hits avoid reads entirely. More room means more hits, not more traffic.' },
        { text: 'They stay at 9, one per signal.', correct: false, why: 'That is only at capacity 0. Any room at all lets repeated accounts hit the cache.' } ] },
      code: P.build({ before: upTo(M_CACHE), add: [M_CACHE], step: 1 }),
      cards: [ { step: 2, title: 'Evicted from memory, not from the store', html: '<p>Reads fall from <b>9</b> to <b>2</b>. a is evicted from a one-slot cache again and again and still scores <b>24</b>: dormancy evicts it from memory, not from the store — the distinction the word “expire” was hiding.[[src:vars]]</p>' } ],
      narration: [
        'Main runs the cache at capacities 0, 1, 2, 3 and 10. As it grows, what happens to the store reads? Choose an answer.',
        'They fall, from 9 to 2, and every score stays exact. Bounding the cache costs store reads. Bounding the state cost the answer. The difference is one line: write out instead of delete.',
        'And account A, evicted from a one-slot cache again and again, still scores 24. Dormancy evicts it from memory, not from the store. That is the distinction the word expire was hiding.'
      ]
    },

    /* ---------- 12 · main: the edges ---------- */
    {
      title: 'Edge', layout: 'code',
      eyebrow: '12 · Writing the program · the boundaries',
      heading: 'Empty streams, an allowance of 0, a cache of 0',
      stand: 'Main checks the extremes of each answer.',
      question: { step: 0, prompt: 'A cache with 0 slots holds nothing. Is it still exact?', options: [
        { text: 'No: with no slots, scores have nowhere to live.', correct: false, why: 'They live in the store. A 0-slot cache simply sends every signal there.' },
        { text: 'Only for accounts with one signal.', correct: false, why: 'Every account is exact: each signal reads its score from the store and writes it straight back.' },
        { text: 'Yes: it writes every score straight through to the store.', correct: true, why: 'Capacity 0 is the plain store, read and written per signal. Slower, never wrong.' } ] },
      code: P.build({ before: upTo(M_EDGE), add: [M_EDGE], step: 1 }),
      cards: [ { step: 1, title: 'The extremes', html: '<p>An empty stream: no scores and no store operations. An allowance of 0 keeps only the last signal, <code>{\'a\': 8}</code>. A 0-slot cache writes through to the store and is still exact.[[src:vars]]</p>' } ],
      narration: [
        'Main checks the extremes. A cache with 0 slots holds nothing at all. Is it still exact? Choose an answer.',
        'Yes: it writes every score straight through to the store. Here are the checks: an empty stream gives no scores and no operations, and an allowance of 0 keeps only the last signal, A with 8.'
      ]
    },

    /* ---------- 13 · main: random streams ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '13 · Writing the program · 400 random streams',
      heading: 'Not noisy: biased',
      stand: 'The program runs 400 random signal streams, the cache at every capacity from 0 to 6, and the expiry at four allowances.',
      question: { step: 0, prompt: 'When the expiring version was wrong, which way was it wrong?', options: [
        { text: 'Too low every time, never too high.', correct: true, why: 'Forgetting only removes points. So the error is a bias, in the direction an attacker would want.' },
        { text: 'Too high about as often as too low.', correct: false, why: 'Nothing in it can add points that were not earned. It cannot be too high.' },
        { text: 'It was never wrong on random data.', correct: false, why: 'It was wrong in 1,119 of 1,600 runs. Random data still has quiet accounts.' } ] },
      code: P.build({ before: upTo(M_MANY), add: [M_MANY], step: 1 }),
      cards: [ { step: 2, title: '1,119 of 1,600', html: '<p>The store and every cache capacity were exact every time, with reads falling as the cache grew. The expiry was right in <b>481</b> runs and too low in <b>1,119</b>, never once too high.[[src:vars]]</p>' } ],
      narration: [
        'The program runs 400 random streams: the cache at every capacity from 0 to 6, and the expiry at four allowances. When the expiry was wrong, which way was it wrong? Choose an answer.',
        'Too low every time. Here is the loop. The store and every cache size were exact, every time. The expiry was right in 481 runs and too low in 1,119, never once too high.',
        'So the expiry is not noisy, it is biased, and biased the way an attacker would choose.'
      ]
    },

    /* ---------- 14 · main: the scale ---------- */
    {
      title: 'Scale', layout: 'code',
      eyebrow: '14 · Writing the program · the scale that forces the decision',
      heading: 'The scale that justifies the bound hides its cost',
      stand: 'Main builds 2,000 accounts seen once plus one regular, and runs every answer on day 2000.',
      question: { step: 0, prompt: 'At this scale, how many scores does a 100-day expiry restart?', options: [
        { text: 'Hundreds: most accounts go quiet.', correct: false, why: 'They go quiet and never return. An account seen once cannot be restarted, only forgotten.' },
        { text: 'None: one-time accounts never return, and the regular is never quiet.', correct: true, why: 'So the damage is invisible here. It needs a dormant account that comes back, which is the small example.' },
        { text: 'One: the regular account.', correct: false, why: 'The regular account signals every 10 days, well inside 100. It is never dropped.' } ] },
      code: P.build({ before: upTo(M_SCALE), add: [M_SCALE], step: 1 }),
      cards: [ { step: 2, title: 'Every answer, at scale', html: '<p>Forever: <b>2,001</b> scores held. Expiry: 102 held, 0 restarts, and 1,899 accounts simply gone. Store: 0 held, 4,400 operations. A 64-slot cache: 64 held, exact for all 2,001 accounts, for 2,001 reads.[[src:vars]]</p>' } ],
      narration: [
        'Main builds 2,000 accounts seen once plus one regular. At this scale, how many scores does a 100-day expiry restart? Choose an answer.',
        'None: one-time accounts never return, and the regular one is never quiet. So the scale that justifies the bound is exactly where its cost is invisible. Here are those runs.',
        'Keeping everything holds 2,001 scores. The expiry holds 102, but 1,899 accounts are simply gone. The store holds 0, for 4,400 operations. A 64-slot cache is exact for all 2,001 accounts.'
      ]
    },

    /* ---------- 15 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '15 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written and why.',
        'From the top: the signals, the truth, keeping for ever, the expiry, the store, the cache, the examples, and main, which checks every claim.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch07_v4.py prints'),
      narration: [
        'Here is what it prints. The 13 examples agree with the true lifetime score. The expiry at 294 is wrong; the store and the one-slot cache are exact.',
        'Then the mule washed to 4, the cache reads falling from 9 to 2, the 400 random streams, and the scale. Every assertion passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'State that must outlive the stream is not stream state',
      stand: 'Each answer, in a sentence.',
      table: {
        columns: ['Answer', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>score_in_memory_forever</code>', 'exact, and a slow leak', 'a 24, b 21; 2,001 at scale'] },
          { step: 0, cells: ['<code>score_with_expiry</code>', 'the chapter’s bound: biased low, arrangeable', 'a 8; the mule 4'] },
          { step: 1, cells: ['<code>score_in_a_store</code>', 'read, add, write, forget: holds nothing between signals', '0 held, 18 operations'] },
          { step: 1, cells: ['<code>score_with_cache</code>', 'the same bound with a store behind it: a miss costs a read', 'reads 9 → 2, always exact'] },
          { step: 2, cells: ['<code>main</code>', 'every answer checked, 400 random streams, and the scale', '1,119 of 1,600 too low'] }
        ]
      },
      side: { step: 3, title: 'The recognition', html: '<p>The requirement forbids every bound, so the chapter’s answer is unavailable. Move the score out of the stream: then the streaming layer holds nothing, and a cache bound costs only reads.[[src:vars]]</p>' },
      narration: [
        'To recap. Keeping every score in memory is exact, and a slow leak. The chapter’s bound, the expiry, is biased low: A drops to 8, and the mule is washed to 4.',
        'The store reads, adds, writes and forgets, so the streaming layer holds nothing between signals, for 18 operations on 9 signals. The cache puts the same bound in front of the store, and costs only reads.',
        'Main checks every answer, then 400 random streams, where the expiry was too low 1,119 times and never too high.',
        'The thing to recognise: when the requirement forbids every bound, state that must outlive the stream is not stream state. Move it to a store.'
      ]
    }
  ]
};
