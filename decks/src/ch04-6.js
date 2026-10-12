// Chapter 4, Part 6 — Variation 3 of the interview question, "the island count", built as a
// program WITH the viewer. Every code slide asks what the next piece must do, then reveals the
// real lines of programs/ch04_v3.py (read by _prog.js, addressed by content). The last slides
// show the whole file and what it prints (programs/ch04_v3.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch04';
const P = program('ch04_v3.py');
const OUT = program('ch04_v3.out');

const listAt = needle => JSON.parse(P.lines[P.at(needle)].split('=')[1]);
const POS = listAt('POSITIONS = [5');
const lineOf = needle => OUT.lines.find(l => l.includes(needle));
const COUNTS = JSON.parse(lineOf('endpoints : ').split(':')[1].split('(')[0]);
const DELTAS = JSON.parse(lineOf('endpoints : ').split('deltas ')[1].replace(')', ''));

// the pieces, in the order they are written
const DATA = P.span("# The chapter's own island sequence", 'SPARSE = [1, 3, 90');
const INPUTS = P.span('# A fully dense stretch', 'BIG_ALTERNATE = [2 * i');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const RESCAN = P.fn('count_by_rescan');
const RUNS = P.fn('count_by_runs');
const ENDS = P.fn('count_by_endpoints');
const TRUE = P.fn('true_stretch_length');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'That was checked at every step.');
const MAIN2 = P.span('    # ---- the sparse case', 'The two extremes bracket it.');
const MAIN3 = P.span('    # ---- order must not matter', 'and 0 together with');
const MAIN4 = P.span('    # ---- the scale, and what each', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 15 examples agree with the rescan', 'rescan    : [1, 2, 1, 2, 2, 2, 1, 1]   (35 set reads)',
  "chapter's runs : [1, 2, 1, 2, 2, 2, 1, 1]   (11 run comparisons), ending [(1, 7)]",
  'endpoints : [1, 2, 1, 2, 2, 2, 1, 1]   (deltas [1, 1, -1, 1, 0, 0, -1, 0])',
  'the length map ends as {1: 7, 2: 2, 3: 3, 5: 3, 7: 7}:',
  'the chapter\'s first seven                       7        1        +3/2/-2        28             28       10',
  'a single position                               1        1        +1/0/-0         4              1        0',
  '150 shuffles of the same 15 positions: the final count is always 3',
  'and 150 different count PATHS were', '6,677 isolated (+1),', '6,647 extending one stretch (0) and 6,676 joining two (-1)',
  'on just the first 800 the rescan made 320,400 set reads', "first 300 the chapter's run structure made 43,884 run comparisons",
  'in all at 20,000', 'At the chapter\'s G = 47 the same 9 times collapse into 3 runs.', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch04_v3.out no longer prints "${s}" — rewrite the narration`);
if (POS.join() !== '5,7,6,1,2,3,4,4' || COUNTS.join() !== '1,2,1,2,2,2,1,1' || DELTAS.join() !== '1,1,-1,1,0,0,-1,0')
  throw new Error('programs/ch04_v3.py no longer has the positions this deck explains — rewrite the narration');

module.exports = {
  title: 'The Island Count',
  eyebrow: 'Streaming · Ch 4 · Part 6',
  ...shared,
  jargon: ['position', 'island', 'list', 'function', 'set', 'rescan', 'run', 'neighbour', 'map', 'endpoint', 'stale'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 4 · three other ways'),
    model: section(CH, 'How to model it', 'Chapter 4 · how to model it'),
    prob:  section(CH, 'The problem', 'Chapter 4 · the original problem')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['position', 'island', 'neighbour'],
      eyebrow: '01 · Variation 3 of the interview question',
      heading: 'Lights turn on along a line. How many lit stretches are there now?',
      hero: { step: 0, text: 'Picture an endless row of lamps, each at a whole-number <b>position</b>. Lamps turn on one at a time, in any order, and never turn off. Lamps side by side are <b>neighbours</b>. An <b>island</b> is a stretch of neighbouring lamps that are all on. After every lamp, report how many islands there are. The order lamps turn on in is not the order they stand in.[[src:vars]]' },
      tiles: [
        { step: 1, value: 8, label: 'lamps in our example[[src:vars]]' },
        { step: 1, value: 1, label: 'island at the end' },
        { step: 2, value: 3, label: 'possible changes per lamp: +1, 0 or −1[[src:vars]]' },
        { step: 2, value: 20000, label: 'lamps in the large test' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A count after every lamp', text: 'Not once at the end.' },
        { step: 3, n: 2, title: 'Lamps in any order', text: 'And the same lamp may be switched on twice.' },
        { step: 4, n: 3, title: 'Only a number', text: 'Nobody asks where the islands are. That turns out to matter.' }
      ],
      note: { step: 4, text: 'The door log of part 4 with new nouns. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'Picture an endless row of lamps, each at a whole-number position. Lamps turn on one at a time, in any order, and never turn off. An island is a stretch of neighbouring lamps that are all on.',
        'Our example turns on 8 lamps, and ends with a single island. After every lamp, the program must say how many islands there are.',
        'Each new lamp changes the count by exactly plus one, zero, or minus one. The large test turns on 20,000 lamps.',
        'Lamps arrive in any order, not the order they stand in, and the same lamp may be switched on twice.',
        'And only a number is wanted: nobody asks where the islands are. That turns out to be the whole trick. We will write the program together.'
      ]
    },

    /* ---------- 2 · try ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['run'],
      eyebrow: '02 · Your turn · before any code',
      heading: 'A lamp between two islands',
      stand: 'Lamps 5 and 7 are on: two islands, because 6 is off between them. Now lamp 6 turns on.',
      question: {
        step: 0,
        prompt: 'How many islands are there after lamp 6 turns on?',
        options: [
          { text: 'One: 5, 6 and 7 are now a single stretch.', correct: true,
            why: 'Lamp 6 fills the only hole. The two islands and the new lamp become one: the count goes down.' },
          { text: 'Three: 5, 6 and 7, one each.', correct: false,
            why: 'Neighbouring lamps that are on belong to the same island. 6 touches both.' },
          { text: 'Two: lamp 6 joins the island of 5.', correct: false,
            why: 'It touches 7 too. Joining only one side would leave two islands that actually touch.' }
        ]
      },
      cards: [
        { step: 1, title: 'The −1 case', html: '<p>A new lamp can join <b>two</b> islands at once, and then the count goes <b>down</b>. It is the door log’s merge of two <b>runs</b> (stretches written by their ends, like 5..7), with a gap of 1.[[src:vars]]</p>' },
        { step: 2, title: 'At most two', html: '<p>Lamp 6 has only two neighbours, 5 and 7. So it can touch at most two islands, and the count moves by +1, 0 or −1, never more.[[src:vars]]</p>' }
      ],
      narration: [
        'Before any code, try it. Lamps 5 and 7 are on: two islands. Now lamp 6 turns on. How many islands now? Choose an answer.',
        'One. Lamp 6 fills the only hole, and the two islands become one, so the count goes down. That is the door log’s merge, with a gap of 1.',
        'And lamp 6 has only two neighbours, 5 and 7. So a new lamp can touch at most two islands, and the count can only move by plus one, zero, or minus one.'
      ]
    },

    /* ---------- 3 · the stream, animated ---------- */
    {
      title: 'Count', layout: 'array',
      eyebrow: '03 · Watch the eight lamps turn on',
      heading: 'The count goes up, stays, and twice goes down',
      stand: 'Lamps in the order they turn on, the island count after each, and how much it changed.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'lamp', values: POS },
          { label: 'islands after', values: COUNTS },
          { label: 'change', values: DELTAS }
        ],
        meters: ['lamps', 'changes added up'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [2, 6] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 1, title: 'Two −1s', html: '<p>Lamp 6 joins 5..5 and 7..7. Lamp 4 joins 1..3 and 5..7. Each time two islands become one.[[src:vars]]</p>' },
        { step: 2, title: 'The changes add up to the count', html: '<p>+1 +1 −1 +1 0 0 −1 0 = <b>1</b>, the final count. And the second 4 changes nothing: it was already on.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the lamps in the order they turn on: 5, 7, 6, 1, 2, 3, 4, and 4 again. Under each, the island count after it.',
        'Look at the two highlighted arrivals. Lamp 6 joins two islands, and later lamp 4 joins 1 to 3 with 5 to 7. Both times the count goes down.',
        'Each change is plus one, zero, or minus one. Watch the pointer add them up: the total is 1, the final count. The second 4 changes nothing, because it was already on.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'The lamps, in the order they turn on',
      stand: 'A program is written top to bottom. First, the data.',
      question: { step: 0, prompt: 'The example ends with 4 and then 4 again. Why the repeat?', options: [
        { text: 'A lamp switched on twice must change nothing, and that needs testing.', correct: true, why: 'Repeats happen in real streams. Counting the second 4 as a new island would be a quiet, wrong answer.' },
        { text: 'It is a typing mistake in the data.', correct: false, why: 'The comment says it is deliberate: the repeated 4 must change nothing at all.' },
        { text: 'To make the stream longer, so it runs slower.', correct: false, why: 'One more entry does not change speed. It is there to test one specific case.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch04_v3.py · the data' }),
      cards: [ { step: 2, title: 'Two lists', html: '<p><code>POSITIONS</code> is a <b>list</b>, values in a row, in arrival order. <code>SPARSE</code> is the door log’s nine times: no two are neighbours, so the count only ever rises.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The example ends with lamp 4, and then 4 again. Why the repeat? Choose an answer.',
        'Because a lamp switched on twice must change nothing, and that needs testing. Here is the list, values in a row in arrival order, with the comment saying exactly that.',
        'Below it, the door log’s nine times, reused. No two of them are neighbours, so every one is its own island and the count only ever rises: the opposite extreme.'
      ]
    },

    /* ---------- 5 · the inputs ---------- */
    {
      title: 'Edges', layout: 'code',
      eyebrow: '05 · Writing the program · inputs that test the edges',
      heading: 'Negative positions, a billion apart, and 10,000 at once',
      stand: 'More inputs, each testing one edge.',
      question: { step: 0, prompt: 'Why test lamps 0 and 1,000,000,000 together?', options: [
        { text: 'To prove positions are names, not places in a long array.', correct: true, why: 'If lamps were slots in an array, this would need a billion slots. Two entries should be enough.' },
        { text: 'Because a billion is the largest position allowed.', correct: false, why: 'There is no largest position: the line is endless. The test is about the empty space between.' },
        { text: 'To check that two far lamps make one island.', correct: false, why: 'They make two islands. Only neighbours join.' } ] },
      code: P.build({ before: [DATA], add: [INPUTS], step: 1 }),
      cards: [ { step: 2, title: 'Edges and scale', html: '<p>0..19 in order (never more than one island), −3, −1, −2, 0 (negative is ordinary), 0 and a billion, and 10,000 positions shuffled or spread out.[[src:vars]]</p>' } ],
      narration: [
        'The file also prepares inputs that test edges. Why test lamps 0 and one billion together? Choose an answer.',
        'To prove that positions are names, not places in a long array. An array would need a billion slots; the program should need two entries. Here are the inputs.',
        'A dense run from 0 to 19, negative positions, the two far lamps, and 10,000 positions either shuffled into one stretch or spread so that none ever touch.'
      ]
    },

    /* ---------- 6 · the rescan ---------- */
    {
      title: 'Slow', layout: 'code', defines: ['function', 'set', 'rescan'],
      eyebrow: '06 · Writing the program · the obviously right answer',
      heading: 'Count from scratch after every lamp',
      stand: 'Before anything clever, write something slow and certainly right, to check the clever version against.',
      question: { step: 0, prompt: 'Given all the lamps that are on, how can you count islands most simply?', options: [
        { text: 'Count lamps whose left neighbour is off: each starts an island.', correct: true, why: 'Every island has exactly one leftmost lamp, so counting starts counts islands.' },
        { text: 'Count all lamps that are on.', correct: false, why: 'Lamps 5, 6 and 7 are three lamps but one island.' },
        { text: 'Count lamps with both neighbours on.', correct: false, why: 'Those are the middles of islands. A single lamp alone is an island with none.' } ] },
      code: P.build({ before: [DATA, INPUTS], add: [RESCAN], step: 1 }),
      cards: [ { step: 2, title: 'A rescan', html: '<p>The lamps that are on are kept in a <b>set</b>: a collection you can ask “is this one in?”. Counting from scratch each time is a <b>rescan</b>: correct, and it rereads everything. On our 8 lamps, 35 set reads.[[src:vars]]</p>' } ],
      narration: [
        'First write something slow and certainly right. Given the lamps that are on, how can you count islands most simply? Choose an answer.',
        'Count lamps whose left neighbour is off, because each island has exactly one leftmost lamp. Here is count by rescan, a function that does just that after every lamp.',
        'The lamps that are on are kept in a set, a collection you can ask whether something is in. Counting from scratch each time is a rescan. On our 8 lamps it makes 35 set reads.'
      ]
    },

    /* ---------- 7 · the chapter's runs ---------- */
    {
      title: 'Runs', layout: 'code',
      eyebrow: '07 · Writing the program · the door log’s structure, reused',
      heading: 'Keep the runs, with a gap of 1',
      stand: 'Part 4 kept runs and merged every run a new time touched. With a gap of 1, a run is an island.',
      question: { step: 0, prompt: 'Does the door log’s run structure give the right count here?', options: [
        { text: 'Yes, but it compares each lamp with every run kept.', correct: true, why: 'It answers more than was asked — where each island is — and pays for it with a scan of all runs.' },
        { text: 'No: runs cannot handle lamps in any order.', correct: false, why: 'They can: that was the whole point of part 4. Lamp 6 merges two runs just as 50 did.' },
        { text: 'Yes, and it does less work than anything else.', correct: false, why: 'It is the most work of the three on long streams, because it keeps re-checking every run.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN], add: [RUNS], step: 1 }),
      cards: [ { step: 2, title: 'More than was asked', html: '<p>A <b>run</b> is an island written by its ends, like 1..7. Correct — 11 run comparisons here — but it also knows <b>where</b> every island is, and nobody asked.[[src:vars]]</p>' } ],
      narration: [
        'Part 4 kept runs and merged every run a new time touched. With a gap of 1, a run is exactly an island. Does that structure give the right count here? Choose an answer.',
        'Yes, but it compares each lamp with every run. Here is count by runs: part 4’s touching and absorb, with the gap at 1, and the count is just how many runs there are.',
        'Its docstring is honest: it answers more than was asked. It knows where every island is, and that extra knowledge is what costs a scan of all the runs each time.'
      ]
    },

    /* ---------- 8 · the endpoint map ---------- */
    {
      title: 'Ends', layout: 'code', defines: ['neighbour', 'map', 'endpoint'],
      eyebrow: '08 · Writing the program · the answer',
      heading: 'Look only at the two neighbours',
      stand: 'Lamp p turns on. Only lamps p−1 and p+1 can be part of an island it joins.',
      question: { step: 0, prompt: 'What is the least the program must remember to update the count?', options: [
        { text: 'For each island’s two end lamps, the island’s length.', correct: true, why: 'If p−1 is on, it must be the right end of its island; if p+1 is on, the left end. Two lookups say everything.' },
        { text: 'The full list of islands, as runs.', correct: false, why: 'That is the door log’s structure. It works, but searches every run for something two lookups can find.' },
        { text: 'Only the current count.', correct: false, why: 'The count alone cannot say whether p−1 or p+1 is already on, so it cannot tell +1 from −1.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS], add: [ENDS], step: 1 }),
      cards: [ { step: 2, title: 'Endpoint map', html: '<p>A lamp’s <b>neighbours</b> are p−1 and p+1. A <b>map</b> finds a value by a key; here an island’s two <b>endpoints</b> map to its length. The change is <code>1 − (left on) − (right on)</code>: +1, 0 or −1. Two lookups and two writes per lamp.[[src:vars]]</p>' } ],
      narration: [
        'Now the answer. Lamp p turns on; only p minus 1 and p plus 1, its neighbours, can belong to an island it joins. What is the least the program must remember? Choose an answer.',
        'For each island’s two end lamps, the island’s length. Here is count by endpoints. A map finds a value by its key, and here each island’s two endpoints map to its length.',
        'The change is one, minus one if the left neighbour is on, minus one if the right is: plus one, zero, or minus one. Two lookups and two writes per lamp, however many islands exist.'
      ]
    },

    /* ---------- 9 · the map, animated ---------- */
    {
      title: 'Map', layout: 'array', defines: ['stale'],
      eyebrow: '09 · Watch what the map holds at the end',
      heading: 'Right at the ends, out of date in the middle',
      stand: 'After all eight lamps, lamps 1 to 7 are one island of length 7. What the map says for each lamp:',
      array: {
        labelWidth: 150, slotLabel: 'column',
        rows: [
          { label: 'lamp', values: [1, 2, 3, 4, 5, 6, 7] },
          { label: 'map says', values: [7, 2, 3, '—', 3, '—', 7] }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [0, 6] },
          { step: 2, do: 'pick', slots: [1, 2, 4] }
        ]
      },
      cards: [
        { step: 1, title: 'Fresh where it is read', html: '<p>Lamps 1 and 7, the ends, both say 7: correct.[[src:vars]]</p>' },
        { step: 2, title: 'Stale inside', html: '<p>Lamps 2, 3 and 5 hold old lengths: <b>stale</b> entries. They are never read, because a new lamp’s neighbour can only be an <b>end</b> while that lamp is still off.[[src:vars]]</p>' }
      ],
      narration: [
        'After all eight lamps, lamps 1 to 7 form one island of length 7. Here is what the map holds for each lamp; 4 and 6 have no entry at all.',
        'The two ends, lamps 1 and 7, both say 7. That is correct: the island from 1 to 7 is seven lamps long.',
        'But lamps 2, 3 and 5 hold old lengths. Out-of-date entries like these are called stale. They are safe, because a new lamp’s neighbour can only ever be the end of an island, never its middle.'
      ]
    },

    /* ---------- 10 · checking freshness ---------- */
    {
      title: 'Check', layout: 'code',
      eyebrow: '10 · Writing the program · prove the claim, every step',
      heading: 'Walk out from the lamp to measure the real length',
      stand: 'The program claims the two entries it reads are never stale. Asserting that once is not enough.',
      question: { step: 0, prompt: 'How can the program check, at every step, that the length it read is right?', options: [
        { text: 'Walk left and right from the neighbour while lamps are on, and compare.', correct: true, why: 'Slow but obviously right. The endpoint map calls it at every step on small inputs.' },
        { text: 'Check that the final count is correct.', correct: false, why: 'A stale read could be wrong in the middle and still end at the right count by luck.' },
        { text: 'Trust the argument: neighbours are always ends.', correct: false, why: 'The argument is right, but code can disagree with its argument. A check catches that.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS, ENDS], add: [TRUE], step: 1 }),
      cards: [ { step: 2, title: 'Used only to check', html: '<p><code>true_stretch_length</code> walks from a lamp while its neighbours are on. <code>count_by_endpoints</code> calls it through <code>verify</code> at every step, on every small input.[[src:vars]]</p>' } ],
      narration: [
        'The program claims the two entries it reads are never stale. How can it check that at every step? Choose an answer.',
        'Walk left and right from the neighbour while lamps are on, and compare. Here is true stretch length: slow, obviously right, and used only as a check.',
        'Count by endpoints calls it at every single step on the small inputs. An argument can be right while the code disagrees with it; this is what catches that.'
      ]
    },

    /* ---------- 11 · the examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '11 · Writing the program · 15 examples, three answers each',
      heading: 'The clever answer loses on short streams',
      stand: 'Each example is checked against the rescan and the door log’s runs. The table prints all three costs.',
      question: { step: 0, prompt: 'The map does 4 operations per lamp; the rescan rereads every lamp on. For a single lamp, which costs less?', options: [
        { text: 'The rescan: 1 read, against the map’s 4.', correct: true, why: 'With one lamp, rereading everything is one read. The fixed 4 only pays off as the stream grows.' },
        { text: 'The map: it is always cheaper.', correct: false, why: 'Not for short streams. The two tie at exactly seven lamps, and only past that does the map win.' },
        { text: 'They cost exactly the same.', correct: false, why: '4 against 1 for one lamp. They first cost the same at seven lamps: 28 each.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS, ENDS, TRUE], add: [EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Ties at seven', html: '<p>All 15 examples agree. One lamp: map 4, rescan 1. Seven lamps: 28 and 28. At 10,000 lamps the map wins by about 1,250 times.[[src:vars]]</p>' } ],
      narration: [
        'Each example is checked three ways, and the table prints the cost of each. For a single lamp, which costs less: the map’s 4 operations, or the rescan? Choose an answer.',
        'The rescan: 1 read. Here are the 15 examples and show examples, which checks every row against the rescan and the door log’s runs, and that the changes add up.',
        'All 15 agree. The two tie at exactly seven lamps, 28 each. Only past that does the map win, and at 10,000 lamps it wins by about 1,250 times.'
      ]
    },

    /* ---------- 12 · main, the example ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '12 · Writing the program · the eight lamps',
      heading: 'Three answers, one result, and the stale entries shown',
      stand: 'main runs all three on the example and prints what the map ended holding.',
      question: { step: 0, prompt: 'Why does main print the stale entries, rather than hiding them?', options: [
        { text: 'To show the correctness argument really was exercised.', correct: true, why: 'If no entry went stale, the claim that stale entries are never read would be untested. main asserts some did.' },
        { text: 'Because stale entries are a bug to be fixed later.', correct: false, why: 'They are not a bug. They are never read, and cleaning them would cost work for nothing.' },
        { text: 'To use up less memory.', correct: false, why: 'Printing changes nothing about memory. It is evidence, not a fix.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS, ENDS, TRUE, EXAMPLES, SHOW], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'All three agree', html: '<p>Rescan: 35 set reads. Runs: 11 comparisons. Endpoints: changes [1, 1, −1, 1, 0, 0, −1, 0]. The map ends {1: 7, 2: 2, 3: 3, 5: 3, 7: 7}.[[src:vars]]</p>' } ],
      narration: [
        'Main runs all three answers on the eight lamps. Then it prints the stale entries left in the map. Why show them, rather than hide them? Choose an answer.',
        'To show the argument was really exercised. If no entry had gone stale, the claim that stale entries are never read would be untested, so main asserts that some did.',
        'All three agree: the rescan in 35 set reads, the runs in 11 comparisons, and the map with changes plus one, plus one, minus one, and so on.'
      ]
    },

    /* ---------- 13 · main, order and edges ---------- */
    {
      title: 'Order', layout: 'code',
      eyebrow: '13 · Writing the program · does the order matter?',
      heading: 'Same lamps, shuffled 150 times',
      stand: 'The lamps 0 to 11, 20, 21 and 30 are turned on in 150 different orders.',
      question: { step: 0, prompt: 'Across the 150 orders, what changes and what does not?', options: [
        { text: 'The final count is always 3; the counts along the way differ.', correct: true, why: 'The islands at the end depend only on which lamps are on. The order only changes the reports on the way.' },
        { text: 'Everything is the same, every time.', correct: false, why: 'The path differs: 150 different sequences of counts were seen.' },
        { text: 'The final count changes with the order.', correct: false, why: 'Which lamps are on at the end is the same, so the islands are too: 0..11, 20..21 and 30.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS, ENDS, TRUE, EXAMPLES, SHOW, MAIN1], add: [MAIN2, MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'Order decides the path', html: '<p>Final count always 3; 150 different count paths. Also: the door log’s nine times give 9 islands here, but 3 runs at a gap of 47; and two far lamps cost two map entries.[[src:vars]]</p>' } ],
      narration: [
        'The same 15 lamps are turned on in 150 different orders. What changes and what does not? Choose an answer.',
        'The final count is always 3, and every one of the 150 orders gave a different path of counts on the way. The order decides the reports along the way, nothing else.',
        'These lines also check the sparse case, the door log’s nine times as 9 islands, and the edges: repeats change nothing, negatives are ordinary, and far lamps cost two entries.'
      ]
    },

    /* ---------- 14 · main, the scale ---------- */
    {
      title: 'Scale', layout: 'code',
      eyebrow: '14 · Writing the program · 20,000 lamps',
      heading: 'At scale, the three changes split into thirds',
      stand: '20,000 lamps, shuffled. The program first expected 0 to dominate; the comment records that it was wrong.',
      question: { step: 0, prompt: 'With lamps in random order, roughly how often is the change −1?', options: [
        { text: 'About a third of the time.', correct: true, why: 'Of p−1, p and p+1, whichever turns on last joins two. Each is equally likely to be last.' },
        { text: 'Almost never: joining two islands is rare.', correct: false, why: 'It is as common as the other two cases. Every lamp whose two neighbours came first gives −1.' },
        { text: 'Half the time.', correct: false, why: 'There are three equally likely cases — first, middle or last of the three — not two.' } ] },
      code: P.build({ before: [DATA, INPUTS, RESCAN, RUNS, ENDS, TRUE, EXAMPLES, SHOW, MAIN1, MAIN2, MAIN3], add: [MAIN4], step: 1 }),
      cards: [ { step: 2, title: 'Measured', html: '<p>6,677 +1, 6,647 zero, 6,676 −1. The rescan made 320,400 reads on just the first 800; the runs 43,884 comparisons on the first 300; the map 80,000 in all at 20,000.[[src:vars]]</p>' } ],
      narration: [
        '20,000 lamps in random order. Roughly how often is the change minus one? Choose an answer.',
        'About a third. Of a lamp and its two neighbours, whichever turns on last joins two islands, and each is equally likely to be last. The comment records that the first guess was wrong.',
        'Measured: 6,677 plus ones, 6,647 zeros, and 6,676 minus ones. The rescan needed 320,400 reads for just 800 lamps; the map needs 80,000 operations for all 20,000.'
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
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written, and why.',
        'From the top: the data, the rescan, the door log’s runs, the endpoint map and its check, the examples, and main with the order and scale tests.'
      ]
    },

    /* ---------- 16 · output ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch04_v3.py prints'),
      narration: [
        'Here is what it prints: the 15 examples with all three costs, then the eight lamps answered three ways, and the map with its stale entries.',
        'Then the sparse case, the 150 shuffles, the edges, and the 20,000-lamp run split into thirds. The last line says every assertion passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'Only a count was asked, so only the neighbours are read',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>count_by_rescan</code>', 'count the lamps whose left neighbour is off, from scratch', '35 set reads'] },
          { step: 0, cells: ['<code>count_by_runs</code>', 'the door log’s runs, gap 1: right, but scans every run', '11 comparisons'] },
          { step: 1, cells: ['<code>count_by_endpoints</code>', 'ends map to lengths; change = 1 − left − right', '2 lookups + 2 writes'] },
          { step: 1, cells: ['<code>true_stretch_length</code>', 'walk out from a lamp: the freshness check', 'every step'] },
          { step: 2, cells: ['<code>main</code>', 'three answers agree; order changes paths, not the end', '+1, 0, −1 in thirds'] }
        ]
      },
      side: { step: 3, title: 'The lesson', html: '<p>The door log needed runs because it reported where visits were. Asked only for a count, a lamp can touch at most two islands, and nothing has to be searched.[[src:vars]]</p><p>Next: the pager, where acting early is the problem.</p>' },
      narration: [
        'To recap. The rescan counts lamps whose left neighbour is off, from scratch each time. The door log’s runs give the same answer, but scan every run.',
        'The endpoint map stores each island’s length at its two ends, and the change is one minus the neighbours that are on: two lookups and two writes per lamp.',
        'True stretch length checks the map at every step, and main shows all three agree, and that order changes the path, never the end.',
        'The lesson: asked only for a number, a new lamp can touch at most two islands, so nothing needs searching. Next, the pager, where acting early is the problem.'
      ]
    }
  ]
};
