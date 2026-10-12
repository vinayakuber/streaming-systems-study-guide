// Chapter 5, Part 6 — Variation 3 of the interview question ("the counter in two places"),
// built as a program WITH the viewer. Every code slide asks what the next piece must do, then
// reveals the real lines from programs/ch05_v3.py (read at build time by _prog.js, addressed by
// content, never by line number). The legal totals and every crash point are animated; the
// last slides show the whole file and what it prints (programs/ch05_v3.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch05';
const P = program('ch05_v3.py');
const OUT = program('ch05_v3.out');
const upto = needle => P.at(needle) - 1;

// the events, read from the program itself so the slides cannot drift from it
const ITEMS = JSON.parse(P.lines[P.at('ITEMS = [(0, 5)')].split('=')[1].trim().replace(/\(/g, '[').replace(/\)/g, ']'));
const V = ITEMS.map(([, v]) => v);
const LEGAL = V.reduce((acc, v) => [...acc, acc[acc.length - 1] + v], [0]);
const EVERY = Number(P.lines[P.at('REBUILD_EVERY = 3')].split('=')[1]);
// the pair each design leaves, crash at event c (c = 9 means no crash) — the program's own rules
const dual = c => (c < 9 ? [LEGAL[c + 1], LEGAL[c]] : [LEGAL[9], LEGAL[9]]);
const derived = c => { const m = Math.min(c, 9); return [LEGAL[Math.floor(m / EVERY) * EVERY], LEGAL[m]]; };
const COLS = [...Array(10).keys()];

// the pieces, in the order they are written
const DATA = P.span('ITEMS = [(0, 5)', 'REBUILD_EVERY = 3');
const PREFIX = P.fn('prefixes');
const DUAL = P.fn('dual_write');
const RETRY = P.fn('retry_until_written');
const REBUILD = P.fn('rebuild');
const DERIVED = P.fn('derived');
const RECON = P.fn('reconcile');
const EXTRA = P.span('# A stream with a zero-valued event', 'BIG_ITEMS = [(i, 7) for i in range(3_000)]');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN1 = [P.at('def main():'), upto('# ---- the retry, which is the fix everybody reaches for')];
const MAIN2 = [P.at('# ---- the retry, which is the fix everybody reaches for'), P.lines.length - 1];

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 19 examples agree with the prefix sums of their own stream', 'cheaper: derived on 8 rows, dual on 7, tie on 4',
  'the 10 totals the stream legitimately passes through: [0, 5, 8, 15, 17, 23, 24, 33, 37, 45]',
  'of the 9 dual-write crash states, 9 correspond to NO moment in the',
  'paired with an earlier legal total -- the counter is behind by 0 to 2',
  'rebuild every 1,2,3,5,9,20 events -> worst lag 0,1,2,4,8,9 events',
  'retrying the writes for event 4 twice: counter 51, warehouse 45',
  'inject one event with value 0 and crash on it: counter 17, warehouse 17 -- they',
  'counter-first, ordinary middle event          9   counter_first     4       23       17',
  'derived@3, LAST event, lag 2 (the bound)      9       derived@3     8       24       37',
  '3,000 events, derived@500, no crash        3000     derived@500  none    21000    21000    0   6000   13500     dual',
  'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch05_v3.out no longer prints "${s}" — rewrite the narration`);
if (LEGAL.join() !== '0,5,8,15,17,23,24,33,37,45' || EVERY !== 3 || dual(4).join() !== '23,17' || derived(8).join() !== '24,37' || derived(4).join() !== '15,17')
  throw new Error('programs/ch05_v3.py no longer has the stream this deck explains — rewrite the narration');

const W = (...pieces) => pieces;
const pair = ([a, b]) => `${a} · ${b}`;

module.exports = {
  title: 'The Counter Kept Twice',
  eyebrow: 'Streaming · Ch 5 · Part 6',
  ...shared,
  jargon: ['event', 'value', 'counter', 'warehouse', 'row', 'dashboard', 'crash', 'transaction', 'legal total',
    'consistent', 'pair', 'function', 'source of truth', 'cache', 'rebuild', 'lag', 'stale', 'reconcile'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 5 · the interview problem'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 5 · variation 3, the counter in two places')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'value', 'counter', 'warehouse', 'row', 'dashboard', 'crash', 'transaction'],
      eyebrow: '01 · Variation 3 of the interview question',
      heading: 'One count, kept in two places, that must always agree',
      hero: { step: 0, text: 'Things happen on a website; each is an <b>event</b> with a <b>value</b> to count. For every event a worker does two writes: it adds the value to a <b>counter</b> in a fast store, read by a live <b>dashboard</b>, and appends a <b>row</b> to a <b>warehouse</b>, a big table read by the monthly report. It can <b>crash</b> between the two. They are different systems, so no <b>transaction</b> can make the two writes land together.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'events, worth 5, 3, 7, 2, 6, 1, 9, 4 and 8[[src:var]]' },
        { step: 1, value: 45, label: 'their total: what both stores should say[[src:var]]' },
        { step: 2, value: 9, label: 'of 9 crash points that leave the stores disagreeing[[src:var]]' },
        { step: 2, value: 0, label: 'that leave them wrong, with the fix[[src:var]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'Can two stores always agree?', text: 'Not with two writes and no transaction.' },
        { step: 3, n: 2, title: 'What is worse than being behind?', text: 'Being in a state that never existed.' },
        { step: 4, n: 3, title: 'So what do you build?', text: 'One store that is believed, and a copy made from it.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each code slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'For every event, a worker does two writes: it adds the value to a counter in a fast store, read by a live dashboard, and appends a row to a warehouse, a big table read by the monthly report. It can crash between the two, and no transaction spans both systems.',
        'Our 9 events are worth 5, 3, 7, 2, 6, 1, 9, 4 and 8. Their total is 45, and both stores should say 45.',
        'Written the obvious way, a crash at any of the 9 events leaves the two stores disagreeing. With the design we will build, none of them leaves a wrong answer.',
        'The interviewer says: both must agree. This part asks whether that is possible, and what is worse than one store being behind.',
        'And what to build instead: one store that is believed, and a copy made from it. We will write the program together.'
      ]
    },

    /* ---------- 2 · a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['pair'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Crash between the two writes of event 4',
      stand: 'Events 0 to 3 are fully written: counter 17, warehouse 17. For event 4 (worth 6), the worker adds to the counter first — then crashes before writing the warehouse row.',
      question: {
        step: 0,
        prompt: 'What do the two stores say now: counter, then warehouse?',
        options: [
          { text: 'Counter 23, warehouse 17.', correct: true,
            why: 'The counter got event 4’s 6; the warehouse never got its row. They now disagree by exactly 6.' },
          { text: 'Counter 17, warehouse 17.', correct: false,
            why: 'The counter write happened before the crash, so the counter moved to 23.' },
          { text: 'Counter 23, warehouse 23.', correct: false,
            why: 'The warehouse row is the write that never happened.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Each number looks fine', html: '<p>23 is a total the stream really passed through (after event 4); so is 17 (after event 3). Each store alone looks plausible.[[src:var]]</p>' },
        { step: 2, title: 'The pair does not', html: '<p>Taken together, as a <b>pair</b>, they are wrong: at no moment was the counter 23 while the warehouse was 17. The pair describes a state that never existed.[[src:var]]</p>' }
      ],
      narration: [
        'Before any code, one case. Events 0 to 3 are fully written: both stores say 17. For event 4, worth 6, the counter is written first, then the worker crashes. What do the stores say? Choose an answer.',
        'Counter 23, warehouse 17. And each number alone looks fine: 23 is the real total after event 4, and 17 is the real total after event 3.',
        'But taken together, as a pair, they are impossible. At no moment was the counter 23 while the warehouse was 17. Watch the totals the stream really passes through.'
      ]
    },

    /* ---------- 3 · the legal totals, animated ---------- */
    {
      title: 'Sums', layout: 'array', defines: ['legal total'],
      eyebrow: '03 · Watch the running total',
      heading: 'Ten totals the stream really passes through',
      stand: 'The running total after the first 0, 1, 2 … 9 events. The top row is the value each event adds.',
      array: {
        labelWidth: 180, slotLabel: 'events counted',
        rows: [ { label: 'value added', values: ['—', ...V] }, { label: 'running total', values: LEGAL } ],
        meters: ['totals passed through'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'count', readMeter: 0, speed: 260 },
          { step: 2, do: 'pick', slots: [4, 5] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Legal totals', html: '<p>The ten values 0, 5, 8, 15 … 45 are the <b>legal totals</b>: the only totals the stream ever legitimately has.[[src:var]]</p>' },
        { step: 2, title: 'A legal pair', html: '<p>A pair is right only if both stores hold the <b>same</b> legal total. 23 and 17 are each legal; together they are not.[[src:var]]</p>' }
      ],
      narration: [
        'Here are the nine values in order, with a first column for the moment before any event.',
        'Watch the running total. It passes through exactly ten totals: 0, 5, 8, 15, 17, 23, 24, 33, 37 and 45. These are the legal totals, the only ones the stream ever legitimately has.',
        'The two highlighted columns are 17 and 23. Each is legal on its own. But a pair of stores is right only when both hold the same legal total, and 23 with 17 never happened.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['function'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'Nine events, and one number for later',
      stand: 'A program is written top to bottom. It starts with the events.',
      question: { step: 0, prompt: 'Why must no event be worth zero?', options: [
        { text: 'A zero event would let a split leave the stores agreeing.', correct: true, why: 'If the missing write adds nothing, both stores show the same total even though one write never happened.' },
        { text: 'Because the warehouse rejects zero rows.', correct: false, why: 'It accepts them. The problem is that a zero hides a disagreement.' },
        { text: 'So the total is a round number.', correct: false, why: 'The total is 45 either way. The concern is what a zero would hide.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch05_v3.py · the data' }),
      cards: [ { step: 2, title: 'Four lines', html: '<p><code>ITEMS</code> holds nine <b>pairs</b> (event number, value); <code>CORRECT</code> is 45. The number 3 is for the design we build later. Each piece below is a <b>function</b>, a named recipe.[[src:var]]</p>' } ],
      narration: [
        'First, the data. Why must no event be worth zero? Choose an answer.',
        'Because a zero event would let a split leave the two stores agreeing, and hide it. Here are the lines: nine pairs of event number and value, the correct total of 45, and a number 3 we will need later.',
        'A pair is two values kept together. Everything after this is written as functions: named recipes that take inputs and give back an answer.'
      ]
    },

    /* ---------- 5 · the legal totals in code ---------- */
    {
      title: 'Legal', layout: 'code', defines: ['consistent', 'stale'],
      eyebrow: '05 · Writing the program · what counts as right',
      heading: 'List every total the stream passes through',
      stand: 'Before writing the worker, write down what a correct pair of stores looks like.',
      question: { step: 0, prompt: 'The counter says 15 and the warehouse says 17. What kind of wrong is that?', options: [
        { text: 'Behind: both are legal totals, the counter just from an earlier moment.', correct: true, why: '15 was the total two events before 17. The counter is out of date, but it was once true.' },
        { text: 'Impossible: the two numbers differ.', correct: false, why: 'Differing is not the test. Both are real totals from real moments, one older than the other.' },
        { text: 'Correct: either number is fine.', correct: false, why: 'A dashboard showing 15 when the true total is 17 is behind. Just not inconsistent.' } ] },
      code: P.build({ before: W(DATA), add: [PREFIX], step: 1 }),
      cards: [ { step: 2, title: 'Three states', html: '<p><b>Consistent</b>: both hold the same legal total. <b>Stale</b>: two different legal totals, one behind. <b>Impossible</b>: a pair like 23 and 17, which no moment ever had.[[src:var]]</p>' } ],
      narration: [
        'Next, write down what right looks like. The counter says 15 and the warehouse 17. What kind of wrong is that? Choose an answer.',
        'Behind. Both are legal totals; the counter is just from an earlier moment. Here is the function: it lists every running total, starting from 0.',
        'So there are three states. Consistent: both hold the same legal total. Stale: two legal totals, one behind. And impossible: a pair that no moment ever had.'
      ]
    },

    /* ---------- 6 · the dual write ---------- */
    {
      title: 'Dual', layout: 'code',
      eyebrow: '06 · Writing the program · the obvious design',
      heading: 'Two writes per event, in two systems',
      stand: 'The obvious design: for each event, add to the counter, then append the warehouse row. Or the other way round.',
      question: { step: 0, prompt: 'Swap the order: warehouse first, then counter. Crash at event 4. What changes?', options: [
        { text: 'The disagreement flips sign: now the counter is behind by 6.', correct: true, why: 'Whichever store is written first ends up ahead. The order chooses which store lies, never whether one does.' },
        { text: 'The disagreement disappears.', correct: false, why: 'There are still two writes and a crash between them. One store still has event 4 and the other does not.' },
        { text: 'Both stores lose event 4.', correct: false, why: 'The first write still lands before the crash.' } ] },
      code: P.build({ before: W(DATA, PREFIX), add: [DUAL], step: 1 }),
      cards: [ { step: 2, title: 'Never agrees after a crash', html: '<p>At every one of the 9 crash points, in either order, the gap is exactly the straddled event’s value. Counter first leaves the dashboard high; warehouse first leaves it low.[[src:var]]</p>' } ],
      narration: [
        'Now the obvious design: two writes per event. If the order is swapped, warehouse first, and the crash comes at event 4, what changes? Choose an answer.',
        'The disagreement flips sign. Here is the function: it writes both stores for each event, in the chosen order, and stops between the two writes at the crash point.',
        'At every one of the 9 crash points, in either order, the stores disagree by exactly the straddled event’s value. The order chooses which store lies, never whether one does.'
      ]
    },

    /* ---------- 7 · the retry ---------- */
    {
      title: 'Retry', layout: 'code',
      eyebrow: '07 · Writing the program · the fix everybody reaches for',
      heading: 'If the second write fails, retry it?',
      stand: 'The appealing fix: write each store again until it works. Here both writes for event 4 are attempted twice.',
      question: { step: 0, prompt: 'Event 4’s two writes are each done twice. What do the stores end up saying?', options: [
        { text: 'Counter 51, warehouse 45.', correct: true, why: 'Adding 6 twice moves the counter twice. The warehouse row is keyed by event number, so writing it twice is writing it once.' },
        { text: 'Counter 45, warehouse 45.', correct: false, why: 'The counter has no key. A second “add 6” is just another 6.' },
        { text: 'Counter 45, warehouse 51.', correct: false, why: 'The row for event 4 replaces itself. Only the counter moves twice.' } ] },
      code: P.build({ before: W(DATA, PREFIX, DUAL), add: [RETRY], step: 1 }),
      cards: [ { step: 2, title: 'The asymmetry decides', html: '<p>A crash is not a failed call: there is nobody left to retry. And the two writes repeat differently: the row is safe to repeat, the increment is not. That decides which store can be trusted.[[src:var]]</p>' } ],
      narration: [
        'The fix everybody reaches for: retry. Event 4’s two writes are each done twice. What do the stores say? Choose an answer.',
        'Counter 51, warehouse 45. Here is the function: the counter adds the value each time, while the warehouse replaces the row for that event number, so a repeat changes nothing.',
        'A crash is not a failed call, so there is nobody left to retry anyway. And notice the asymmetry: the warehouse write can be repeated safely; the counter cannot. That decides which store to trust.'
      ]
    },

    /* ---------- 8 · the idea ---------- */
    {
      title: 'Idea', layout: 'ask', defines: ['source of truth', 'cache', 'rebuild'],
      eyebrow: '08 · Your turn · decline the request',
      heading: '“Both must agree” asks for two authorities',
      stand: 'With two writes and no transaction, the pair cannot be made exact. But the request can be changed.',
      question: {
        step: 0,
        prompt: 'What should the design do instead of writing both stores for every event?',
        options: [
          { text: 'Write only the warehouse, and recompute the counter from it now and then.', correct: true,
            why: 'Then there is one authority. The counter can only be behind it, never contradict it.' },
          { text: 'Write only the counter, and recompute the warehouse from it.', correct: false,
            why: 'A counter is one number. The warehouse’s rows cannot be rebuilt from a total.' },
          { text: 'Write both, and compare them every night.', correct: false,
            why: 'Comparing finds the split after it happened. It still has two authorities that can contradict each other.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Source of truth', html: '<p>The one store that is believed when the two differ is the <b>source of truth</b>. The warehouse, because its write is safe to repeat.[[src:var]]</p>' },
        { step: 1, title: 'Cache', html: '<p>A fast copy made from the source of truth is a <b>cache</b>. The counter becomes one.[[src:var]]</p>' },
        { step: 2, title: 'Rebuild', html: '<p>Recomputing the cache from the source is a <b>rebuild</b>. Disagreement becomes being behind, never being contradictory.[[src:var]]</p>' }
      ],
      narration: [
        'With two writes and no transaction, the pair cannot be made exact. But the request can be changed. What should the design do instead? Choose an answer.',
        'Write only the warehouse, and recompute the counter from it. The one store believed when they differ is the source of truth. The counter becomes a cache: a fast copy made from it.',
        'Recomputing the cache from the source is called a rebuild. Now disagreement means the cache is behind. It can never contradict the warehouse.'
      ]
    },

    /* ---------- 9 · the derived design in code ---------- */
    {
      title: 'Deriv', layout: 'code', defines: ['lag'],
      eyebrow: '09 · Writing the program · one write, one rebuilt copy',
      heading: 'The warehouse is written; the counter is rebuilt from it',
      stand: 'One durable write per event — the warehouse row — and a rebuild of the counter every 3 events.',
      question: { step: 0, prompt: 'Rebuilding every 3 events, the worker crashes at event 8. What does the counter say?', options: [
        { text: '24: the total at the last rebuild, two events ago.', correct: true, why: 'The last rebuild was after event 5, when the total was 24. That was a real total; it is just old.' },
        { text: '37: the warehouse total.', correct: false, why: 'The counter only catches up at a rebuild, and the next one never came.' },
        { text: '45: the final total.', correct: false, why: 'Event 8 never reached the warehouse, so nothing reaches 45.' } ] },
      code: P.build({ before: W(DATA, PREFIX, DUAL, RETRY), add: [REBUILD, DERIVED], step: 1 }),
      cards: [ { step: 2, title: 'Lag, with a bound you choose', html: '<p>How many events the counter is behind is its <b>lag</b>: here 24 against 37, two events. The worst lag is the rebuild interval minus one, so it is a number you choose.[[src:var]]</p>' } ],
      narration: [
        'Now build it. Rebuilding every 3 events, the worker crashes at event 8. What does the counter say? Choose an answer.',
        'Twenty-four, the total at the last rebuild. Here are the two functions: rebuild sums the warehouse rows, and derived writes one row per event, rebuilding the counter every 3 events.',
        'How many events the counter is behind is its lag: 24 against 37 is two events. The worst lag is the interval minus one, so it is a number you choose, not one you discover after an incident.'
      ]
    },

    /* ---------- 10 · every crash point, animated ---------- */
    {
      title: 'Pts', layout: 'array',
      eyebrow: '10 · Watch every crash point, both designs',
      heading: 'Dual writes land in states that never existed. Derived never does.',
      stand: 'Each column is a crash point (the last is no crash). Each cell is counter · warehouse.',
      array: {
        labelWidth: 200, slots: false,
        rows: [
          { label: 'crash point', values: COLS.map(c => (c < 9 ? `${c}` : 'none')) },
          { label: 'dual: counter · wh', values: COLS.map(c => pair(dual(c))) },
          { label: 'dual: a real moment?', values: COLS.map(c => (dual(c)[0] === dual(c)[1] ? 'yes' : 'no')) },
          { label: 'derived: counter · wh', values: COLS.map(c => pair(derived(c))) },
          { label: 'derived: lag', values: COLS.map(c => LEGAL.indexOf(derived(c)[1]) - LEGAL.indexOf(derived(c)[0])) }
        ],
        meters: ['columns checked', 'impossible pairs'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 0, do: 'sweep', row: 2, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 280 },
          { step: 1, do: 'show', rows: [3, 4] },
          { step: 2, do: 'pick', slots: [8] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Derived: always behind, never wrong', html: '<p>Every derived pair is a legal total paired with an earlier legal total. The counter is behind by 0 to 2 events.[[src:var]]</p>' },
        { step: 2, title: 'Crash at event 8', html: '<p>Dual: 45 and 37, a state that never existed. Derived: 24 and 37, two real totals two events apart.[[src:var]]</p>' }
      ],
      narration: [
        'Each column is a crash point, and each cell is counter, then warehouse. First the dual write. Watch the sweep count the impossible pairs: 9 of the 9 crash points leave a pair no moment ever had.',
        'Now the derived design. Every pair is a legal total paired with an earlier legal total. The counter is behind by 0 to 2 events, and never wrong.',
        'The highlighted column is a crash at event 8. Dual says 45 and 37, a state that never existed. Derived says 24 and 37: real totals, two events apart.'
      ]
    },

    /* ---------- 11 · reconcile ---------- */
    {
      title: 'Fix', layout: 'code', defines: ['reconcile'],
      eyebrow: '11 · Writing the program · repairing a split',
      heading: 'Which way should a repair copy?',
      stand: 'Some teams keep the dual write and run a repair job. It can copy the counter into the warehouse’s reported total, or recompute the counter from the warehouse rows.',
      question: { step: 0, prompt: 'Copying the counter into the warehouse’s total makes the pair agree. What is wrong with it?', options: [
        { text: 'The warehouse’s total no longer matches its own rows.', correct: true, why: 'The total says 23 while the rows add up to 17. Comparing the two stores can no longer detect it.' },
        { text: 'Nothing: the pair agrees, which was the goal.', correct: false, why: 'Agreement was never the real goal. Being right was, and now the warehouse contradicts itself.' },
        { text: 'The counter becomes too low.', correct: false, why: 'The counter is untouched. It is the warehouse’s reported total that is wrong.' } ] },
      code: P.build({ before: W(DATA, PREFIX, DUAL, RETRY, REBUILD, DERIVED), add: [RECON], step: 1 }),
      cards: [ { step: 2, title: 'The working repair is the derived design', html: '<p>To <b>reconcile</b> is to repair a split pair. The direction that works reads the warehouse and recomputes the counter — the derived design, with extra steps.[[src:var]]</p>' } ],
      narration: [
        'Some teams keep the dual write and run a repair. Copying the counter into the warehouse’s reported total makes the pair agree. What is wrong with that? Choose an answer.',
        'The warehouse’s total no longer matches its own rows, and comparing the stores can no longer catch it. Here is the function, with both directions.',
        'Repairing a split pair is called reconciling. The direction that works reads the warehouse and recomputes the counter. That is the derived design, with extra steps.'
      ]
    },

    /* ---------- 12 · the zero event ---------- */
    {
      title: 'Zero', layout: 'ask',
      eyebrow: '12 · Your turn · agreement is not proof',
      heading: 'Inject one event worth zero',
      stand: 'A tenth event, worth 0, is slipped in after event 3. The dual write crashes on it, between its two writes.',
      question: {
        step: 0,
        prompt: 'Do the two stores agree afterwards?',
        options: [
          { text: 'Yes, both say 17 — yet the warehouse is missing a row.', correct: true,
            why: 'The missing write adds nothing, so the totals match. The row count is wrong while the total is right.' },
          { text: 'No: a crash between two writes always splits them.', correct: false,
            why: 'It always splits the writes, but when the value is 0 the split does not show in the totals.' },
          { text: 'Yes, and that proves both writes landed.', correct: false,
            why: 'The row for the zero event never reached the warehouse. Equal totals proved nothing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Equal totals are evidence of nothing', html: '<p>Counter 17, warehouse 17, and the process still died between two writes. That is why the chapter’s values are all non-zero and all different.[[src:var]]</p>' },
        { step: 2, title: 'A check that compares totals', html: '<p>…would pass this broken state. Only the row count reveals it.[[src:var]]</p>' }
      ],
      narration: [
        'A tenth event, worth zero, is slipped in after event 3, and the dual write crashes on it between its two writes. Do the two stores agree afterwards? Choose an answer.',
        'Yes, both say 17, and yet the warehouse is missing a row. The row count is wrong while the total is right. Equal totals are evidence of nothing.',
        'That is why the chapter’s values are all non-zero and all different: so that a broken state cannot hide behind matching totals.'
      ]
    },

    /* ---------- 13 · examples ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '13 · Writing the program · the worked examples',
      heading: 'Nineteen examples, and what each design costs',
      stand: 'A table of inputs and expected pairs, each checked twice, with the cost of both designs on the same input.',
      question: { step: 0, prompt: 'On 3,000 events, rebuilding every 500 and no crash, which design does less work?', options: [
        { text: 'The dual write: 6,000 writes against 13,500 for derived.', correct: true, why: 'Each rebuild re-reads the whole warehouse, so frequent rebuilds on a long stream are expensive. Correctness is free; freshness is not.' },
        { text: 'The derived design, because it writes only once per event.', correct: false, why: 'It writes once, but every rebuild re-reads every row so far. Those reads add up.' },
        { text: 'They cost the same.', correct: false, why: 'On this row they differ by more than double.' } ] },
      code: P.build({ before: W(DATA, PREFIX, DUAL, RETRY, REBUILD, DERIVED, RECON), add: [EXTRA, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'An honest tally', html: '<p>All 19 rows agree with the prefix sums. Cheaper: derived on <b>8</b> rows, dual on <b>7</b>, tie on <b>4</b>. The derived design buys correctness, not speed.[[src:var]]</p>' } ],
      narration: [
        'Next, the worked examples, with the cost of both designs on each input. On 3,000 events, rebuilding every 500, with no crash, which design does less work? Choose an answer.',
        'The dual write: 6,000 writes, against 13,500 for derived, because each rebuild re-reads the whole warehouse. Here is the table and the function that checks it.',
        'All 19 rows agree. And the cost tally is honest: derived is cheaper on 8 rows, dual on 7, and 4 tie. The derived design buys correctness, not speed.'
      ]
    },

    /* ---------- 14 · main part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '14 · Writing the program · the measurements',
      heading: 'Inconsistent against stale, measured',
      stand: 'The last function runs both designs at every crash point and asserts the difference.',
      question: { step: 0, prompt: 'For the derived design, why assert that the counter is never above the warehouse?', options: [
        { text: 'Because a cache built from the warehouse can only be behind it.', correct: true, why: 'It is rebuilt from earlier rows, so it can lag, never lead. A counter above the warehouse would mean a second authority crept back.' },
        { text: 'Because the counter is always zero.', correct: false, why: 'It is zero only before the first rebuild. Afterwards it holds real totals.' },
        { text: 'Because the warehouse is always 45.', correct: false, why: 'After a crash it holds whatever was written before it, like 37.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, PREFIX, DUAL, RETRY, REBUILD, DERIVED, RECON, SHOW), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'The two results', html: '<p>Dual write: 9 of 9 crash states correspond to no moment. Derived: all a legal total with an earlier legal total, behind by 0 to 2. Worst lag for intervals 1, 2, 3, 5, 9, 20: 0, 1, 2, 4, 8, 9.[[src:var]]</p>' } ],
      narration: [
        'Now main. For the derived design, why does it assert that the counter is never above the warehouse? Choose an answer.',
        'Because a cache built from the warehouse can only be behind it, never ahead. Here is the first half of main: both write orders at every crash point, then the derived design at every crash point.',
        'The results: 9 of 9 dual-write states correspond to no moment. Every derived state is a legal total with an earlier one. And the worst lag is always the interval minus one.'
      ]
    },

    /* ---------- 15 · main part 2 ---------- */
    {
      title: 'Rest', layout: 'code',
      eyebrow: '15 · Writing the program · retry, repair, zero, random',
      heading: 'Check the tempting fixes, then try random streams',
      stand: 'The rest of main checks the retry, both repair directions, the zero event, and 400 random streams.',
      question: { step: 0, prompt: 'Why run 400 random streams after the nine events already passed?', options: [
        { text: 'Because nine chosen values can pass by luck.', correct: true, why: 'Random lengths and values, at every crash point, show the rule holds generally.' },
        { text: 'Because the warehouse needs warming up.', correct: false, why: 'Nothing needs warming up. The concern is whether one example was special.' },
        { text: 'To measure the speed of the dual write.', correct: false, why: 'The random tests check correctness, not speed.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, PREFIX, DUAL, RETRY, REBUILD, DERIVED, RECON, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'The rule, everywhere', html: '<p>The dual write is split by exactly the straddled value, in the direction the order chooses, and never agrees; the derived pair is always two legal totals a bounded number of events apart.[[src:var]]</p>' } ],
      narration: [
        'The rest of main. Why run 400 random streams after the nine events already passed? Choose an answer.',
        'Because nine chosen values can pass by luck. Here are the checks for the retry, counter 51 against 45, both repair directions, the zero event, and then the random streams.',
        'Across all of them: the dual write always splits by the straddled value and never agrees; the derived pair is always two legal totals, a bounded number of events apart.'
      ]
    },

    /* ---------- 16 · whole ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '16 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece written, and why.',
        'From the top: the events, the examples, the legal totals, the dual write, the retry, the rebuild and the derived design, the repair, and the checks.'
      ]
    },

    /* ---------- 17 · output ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '17 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch05_v3.py prints'),
      narration: [
        'Here is what it prints: the 19 examples and their cost tally, the ten legal totals, and every crash point in both write orders, each split by exactly the straddled value.',
        'Then the measurements: 9 of 9 dual states correspond to no moment, derived is behind by 0 to 2, the retry gives 51 against 45, and the last line: all assertions passed.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you built',
      heading: 'Decline two sources of truth',
      stand: 'Each idea, in a sentence.',
      table: {
        columns: ['Idea', 'What it means', 'Crash at event 4 or 8'],
        rows: [
          { step: 0, cells: ['dual write', 'Two writes per event, no transaction. The order picks which store lies.', '23 · 17 — never a real moment'] },
          { step: 0, cells: ['retry', 'Repeats the increment: counter 51, warehouse 45.', '—'] },
          { step: 1, cells: ['derived', 'Write the warehouse only; rebuild the counter every 3 events.', '24 · 37 — behind, never wrong'] },
          { step: 2, cells: ['the cost', 'Rebuilds re-read the warehouse: cheaper on 8 rows, dearer on 7.', '—'] },
          { step: 2, cells: ['the lesson', '“Both must agree” asks for two authorities. Keep one; derive the other.', '—'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Variation 4: a push notification with no transaction and no key at the far end. Every tool is gone, and the answer depends on what the message says.[[src:var]]</p>' },
      narration: [
        'To recap. The dual write does two writes per event with no transaction. A crash leaves a pair like 23 and 17 that never existed, and retrying only moves the counter twice.',
        'The derived design writes only the warehouse and rebuilds the counter from it. After a crash the pair is like 24 and 37: behind, never wrong.',
        'It is not free: rebuilds re-read the warehouse, so it is cheaper on some inputs and dearer on others. The lesson is to decline two sources of truth.',
        'Next, variation 4: a notification with no transaction and no key, where the right answer depends on what the message says.'
      ]
    }
  ]
};
