// Chapter 7, Part 4 — the Google interview question, built as a program WITH the viewer.
// Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch07.py (read at build time by _prog.js, addressed by content, never by line
// number). The last slides show the whole file and what it actually prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch07';
const P = program('ch07.py');
const OUT = program('ch07.out');

// the pieces, in the order they are written
const DATA = P.span('import hashlib', 'INFINITY = float("inf")');
const ADD = P.fn('add');
const DROP = P.fn('drop_stale');
const ON = P.fn('on_event');
const TOTALS = P.fn('totals');
const GAP = P.fn('longest_gap');
const RUN = P.span('def main():', 'print(f"  ttl = {tight_ttl}');
const CHECK = P.span('assert worst_gap == 295', 'f"key looked new');
const HELD = P.fn('held_at');
const ZERO = P.span('# The memory saving at this scale', 'f"arrives before any memory benefit');
const BIGC = P.span('# The asymptotic case.', 'BIG_TTL = 100');
const BIG = P.span('# so the case for bounding is purely asymptotic', 'assert longest_gap(big, "hot") == 10');
const VARS = P.span('# The three variations.', 'return store, high_water');
const VARMAIN = P.span('# variations', 'assert store == TRUE and high_water == 0');
const BRUTE = P.span('# brute force over many inputs', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ["true totals {'a': 24, 'b': 21}   longest gap per key {'a': 295, 'b': 130}",
  "ttl = 295      : {'a': 24, 'b': 21}  (correct)", "ttl = 294      : {'b': 21, 'a': 8}  <- restarted [('a', 540)]",
  "dropped {'a': 16}, key looked new (True), so a restarts at 8", 'keys saved by the bound, at any moment in this example: 0',
  'ttl = INFINITY : 2001 keys held', 'ttl = 100      : 102 keys held  (1899 saved, 5.1% of the state)',
  'sketch 5307 in 256 slots (6.1% error)', "carts: spilled-and-reloaded {'b': 21, 'a': 24}, plain expiry {'b': 21, 'a': 8}",
  'keys ever held between events 0', '500 random streams', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch07.out no longer prints "${s}" — rewrite the narration`);

module.exports = {
  title: 'Bounded Running Totals',
  eyebrow: 'Streaming · Ch 7 · Part 4',
  ...shared,
  jargon: ['event', 'key', 'value', 'running total', 'state', 'event time', 'processing time', 'allowance',
    'function', 'restart', 'longest gap', 'spill', 'sketch'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 7 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 7 · how to model it'),
    whole: section(CH, 'The whole program', 'Chapter 7 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 7 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'running total', 'state'],
      eyebrow: '01 · A Google interview question',
      heading: 'Totals that never end, memory that must',
      hero: { step: 0, text: 'Things keep happening in an app, for ever. Each one is an <b>event</b>: it names who it is about, its <b>key</b>, and carries a number, its <b>value</b>. Report a <b>running total</b> per key: the sum of every value that key has had so far. What the program must remember between events is its <b>state</b>, and keys never stop arriving.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example, 2 keys[[src:prob]]' },
        { step: 1, value: 24, label: 'the true total of key a; b’s is 21[[src:prob]]' },
        { step: 2, value: 295, label: 'how long key a goes silent[[src:model]]' },
        { step: 2, value: 8, label: 'what a ends with if it is forgotten one moment too soon[[src:prob]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'A running total per key', text: 'Easy: one number per key, one addition per event.' },
        { step: 3, n: 2, title: 'Bounded memory', text: 'Keys never stop arriving, so the state cannot grow for ever.' },
        { step: 4, n: 3, title: 'What the bound costs', text: 'And how to choose it, and what goes wrong when you choose badly.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'Things keep happening in an app, for ever. Each one is an event, naming who it is about, its key, and carrying a number, its value. Report a running total per key.',
        'Our example has 9 events and 2 keys, A and B. Key A’s true total is 24, and B’s is 21.',
        'Key A goes silent for 295 time units in the middle. If the program forgets A one moment too soon, A ends with 8 instead of 24, and nothing warns anyone.',
        'The interviewer wants a running total per key. And because keys never stop arriving, the memory the program keeps, its state, must be bounded.',
        'And the hard part: what does that bound cost, and how do you choose it? We will write the program together, one piece at a time, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['event time', 'processing time', 'allowance'],
      eyebrow: '02 · Before any code · try it by hand',
      heading: 'Forget anything that has been quiet too long',
      stand: 'Each event has two times: when it happened (event time) and when the program saw it (processing time). This program takes events in the order they happened. Key a’s events happen at 1, 3, 130, 245 and 540; between 245 and 540 it is silent for 295.',
      question: {
        step: 0,
        prompt: 'The program forgets any key that has been quiet for more than 294. What total does key a end with?',
        options: [
          { text: '24: forgetting a key does not change its total.', correct: false,
            why: 'At 540, a has been quiet for 295, which is more than 294. Its total of 16 is forgotten before the last event is added.' },
          { text: '8: its earlier 16 is forgotten, and the event at 540 starts it again.', correct: true,
            why: 'A forgotten key looks exactly like a new one, so the event at 540 starts a fresh total of 8.' },
          { text: '16: the event at 540 arrives too late and is ignored.', correct: false,
            why: 'Nothing ignores the new event. It is the old total that is lost, not the new value.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two clocks, one used', html: '<p><b>Event time</b> is when it happened; <b>processing time</b> is when it was seen. This program uses only event time, and reads events in that order.[[src:prob]]</p>' },
        { step: 2, title: 'Allowance', html: '<p>How long a key may stay quiet before it is forgotten is the <b>allowance</b>. At 294, a ends at <b>8</b>, too low by 16, and b — never quiet for more than 130 — stays right at 21.[[src:prob]]</p>' }
      ],
      narration: [
        'Try it by hand first. The program forgets any key quiet for more than 294. Key A is silent from 245 to 540, which is 295. What total does A end with? Choose an answer.',
        'Each event has two times: when it happened, its event time, and when the program saw it, its processing time. This program reads events in the order they happened, by event time.',
        'So A ends with 8. How long a key may stay quiet is called the allowance. At 294, A’s 16 is forgotten, and the event at 540 starts it again. Key B is never quiet for more than 130, so it stays right.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine events, and the totals they should give',
      stand: 'A program is written top to bottom. The first thing it needs is the events, and the right answer to check against.',
      question: { step: 0, prompt: 'How should the program hold the events?', options: [
        { text: 'A list of (key, value, time), in the order they happened.', correct: true, why: 'Every piece below walks it front to back, and the time is what the allowance is measured against.' },
        { text: 'One total per key, already added up.', correct: false, why: 'Then there is nothing left to compute, and no way to see what forgetting does along the way.' },
        { text: 'A list of values only, without keys or times.', correct: false, why: 'Without keys there is nothing per key, and without times nothing can be quiet for too long.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch07.py · the data' }),
      cards: [ { step: 2, title: 'The answer key', html: '<p><code>TRUE</code> adds up each key directly: a is 24, b is 21. <code>END</code> is the last time, 540. Every piece below is a <b>function</b>: a named recipe that takes inputs and gives back an answer.[[src:whole]]</p>' } ],
      narration: [
        'First, the data. How should the program hold the events? Choose an answer.',
        'A list of key, value and time, in the order they happened. Here are the first lines of the real program: the nine events, the two keys, and the true totals, 24 and 21, worked out directly.',
        'Everything after this is written as functions. A function is a named recipe: it takes inputs and gives back an answer. The first one is the whole computation.'
      ]
    },

    /* ---------- 4 · the computation ---------- */
    {
      title: 'Add', layout: 'code',
      eyebrow: '04 · Writing the program · the computation',
      heading: 'One number per key, one addition per event',
      stand: 'An event arrives. What must the program do to keep the running total?',
      question: { step: 0, prompt: 'What does adding one event to the running totals need?', options: [
        { text: 'Re-add every event that key has ever had.', correct: false, why: 'The total so far already holds them. Adding them again repeats work that never changes.' },
        { text: 'Add its value to that key’s one number, and note when it happened.', correct: true, why: 'One addition per event and one number per key. The time is noted for the bound that comes next.' },
        { text: 'Store the event in a list for that key.', correct: false, why: 'That keeps every event for ever, so memory grows with the stream, not just with the keys.' } ] },
      code: P.build({ before: [DATA], add: [ADD], step: 1 }),
      cards: [ { step: 2, title: 'Nothing here is expensive', html: '<p><code>acc</code> holds one number per key; <code>last</code> holds when each key was last seen. Nothing about the <b>computation</b> is the problem — the size of the state is.[[src:model]]</p>' } ],
      narration: [
        'An event arrives. What does adding it to the running totals need? Choose an answer.',
        'Add its value to that key’s one number, and note when it happened. Here is the function called add: two lines, one addition, and the time written down.',
        'So the computation is trivial. What grows is the number of keys held, and keys never stop arriving. That is the whole problem.'
      ]
    },

    /* ---------- 5 · the bound ---------- */
    {
      title: 'Drop', layout: 'code',
      eyebrow: '05 · Writing the program · the bound',
      heading: 'Forget keys that have been quiet too long',
      stand: 'The only way to keep the state from growing for ever is to drop keys that have not been touched recently.',
      question: { step: 0, prompt: 'To drop keys quiet for longer than the allowance, what must the program keep for every key it holds?', options: [
        { text: 'Nothing extra: the total says how old a key is.', correct: false, why: 'A total of 16 says nothing about when it was last added to. Age needs its own number.' },
        { text: 'When it was last touched, to compare with now.', correct: true, why: 'Now minus last-touched is the silence. That second number exists only so this comparison can be made.' },
        { text: 'Every time it was ever touched.', correct: false, why: 'Only the latest touch matters for “how long has it been quiet”. Keeping all of them grows without bound.' } ] },
      code: P.build({ before: [DATA, ADD], add: [DROP], step: 1 }),
      cards: [ { step: 2, title: 'Twice the memory per key', html: '<p>The test is <code>now - last[k] &gt; ttl</code>. Bounding the state costs a <b>second</b> number per key it keeps. A silence <b>equal</b> to the allowance is still kept.[[src:trace]]</p>' } ],
      narration: [
        'To stop the state growing, drop keys that have been quiet too long. What must the program keep for every key, to know that? Choose an answer.',
        'When it was last touched. Here is drop stale: any key whose silence, now minus last touched, is more than the allowance is deleted, and what was deleted is returned.',
        'Notice the price. Bounding the state needs a second number for every key it keeps. And the test is strictly more than, so a silence exactly equal to the allowance is still kept.'
      ]
    },

    /* ---------- 6 · drop, then add ---------- */
    {
      title: 'Event', layout: 'code', defines: ['restart'],
      eyebrow: '06 · Writing the program · one event, start to finish',
      heading: 'Drop first, then add',
      stand: 'Key a was dropped at 540, holding 16 from 4 events. Its event at 540 is the very next thing to happen.',
      question: { step: 0, prompt: 'When a’s event at 540 arrives just after a was dropped, what does the program see?', options: [
        { text: 'A key with no total, exactly like a key never seen before.', correct: true, why: 'The information that would tell the two apart is the total that was just deleted.' },
        { text: 'A key that was dropped, so it reloads the old 16.', correct: false, why: 'Nothing was kept to reload from. The deletion removed the only record of the 16.' },
        { text: 'An error, because a dropped key cannot come back.', correct: false, why: 'Nothing fails. A new total is started quietly, which is exactly the danger.' } ] },
      code: P.build({ before: [DATA, ADD, DROP], add: [ON], step: 1 }),
      cards: [ { step: 2, title: 'A silent restart', html: '<p><code>on_event</code> drops, then adds. a’s total starts again from zero and becomes <b>8</b>: a <b>restart</b>. No order of drop and add fixes it — the deleted number is what would have told them apart.[[src:model]]</p>' } ],
      narration: [
        'Key A was dropped at 540, holding 16 from 4 events, and its own event at 540 arrives next. What does the program see? Choose an answer.',
        'A key with no total, exactly like one never seen. Here is on event: drop first, then add, and report whether the key looked new.',
        'So A’s total starts again from zero, and becomes 8. A total starting again like this is called a restart. No ordering fixes it, because the deleted number is what would have told them apart.'
      ]
    },

    /* ---------- 7 · the whole stream, and the honest escape ---------- */
    {
      title: 'Run', layout: 'code', defines: ['spill'],
      eyebrow: '07 · Writing the program · the whole stream',
      heading: 'Run every event at one allowance — with an escape hatch',
      stand: 'One function runs the whole stream. It also offers the one fix that keeps totals exact at any allowance.',
      question: { step: 0, prompt: 'A dropped total must leave memory. How can the final totals still come out exact?', options: [
        { text: 'Write it somewhere cheaper, and reload it if the key comes back.', correct: true, why: 'Memory stays bounded by active keys, and a returning key picks up its old total instead of zero.' },
        { text: 'Make the allowance very large.', correct: false, why: 'That only moves the problem: the state then holds every key seen within that whole allowance.' },
        { text: 'Drop it, and subtract nothing.', correct: false, why: 'That is the restart again: the key comes back and its total starts from zero.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON], add: [TOTALS], step: 1 }),
      cards: [ { step: 2, title: 'Spill and reload', html: '<p>With <code>spill</code>, a dropped total is written out and reloaded on return. Writing state out like this is a <b>spill</b>. Without it, a returning key is recorded as a reset. And there is <b>no final sweep</b>: releasing a key after the stream ends is not an error.[[src:model]]</p>' } ],
      narration: [
        'A dropped total must leave memory. How can the final totals still come out exact? Choose an answer.',
        'Write it somewhere cheaper, and reload it when the key comes back. Here is totals: it runs every event at one allowance, records each restart, and, if given a spill, reloads instead of restarting.',
        'Writing state out like this is called a spill. One more detail: there is no sweep at the end. A key released after the stream has finished already had its total reported; that is not an error.'
      ]
    },

    /* ---------- 8 · choosing the allowance ---------- */
    {
      title: 'Gap', layout: 'code', defines: ['longest gap'],
      eyebrow: '08 · Writing the program · choosing the allowance',
      heading: 'The safe allowance is a fact about the data',
      stand: 'Too short and totals restart. What is the smallest allowance that never restarts a key?',
      question: { step: 0, prompt: 'Which allowance is guaranteed never to drop a key that will come back?', options: [
        { text: 'The average gap between a key’s events.', correct: false, why: 'Half the gaps are longer than the average, and each of those would drop the key mid-total.' },
        { text: 'At least the longest silence any key takes.', correct: true, why: 'Then no key is ever quiet longer than the allowance, so none is ever dropped and restarted.' },
        { text: 'Any fixed number, such as a week.', correct: false, why: 'A week is a guess. Whether it is enough depends on how long the quietest key actually stays silent.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS], add: [GAP], step: 1 }),
      cards: [ { step: 2, title: 'Known only afterwards', html: '<p>Longest gap per key: a <b>295</b>, b <b>130</b>. These are measurements of the stream, not choices — and only knowable after the fact. So in practice the allowance is a guess about the future.[[src:model]]</p>' } ],
      narration: [
        'Too short, and totals restart. Which allowance is guaranteed never to drop a key that will come back? Choose an answer.',
        'At least the longest silence any key takes. Here is longest gap: for one key, it walks its events and keeps the biggest jump in time between two of them.',
        'Here that is 295 for A and 130 for B. But those are facts about the data, only knowable afterwards. So in practice, the allowance is a guess about the future.'
      ]
    },

    /* ---------- 9 · run it at three allowances ---------- */
    {
      title: 'Check', layout: 'code',
      eyebrow: '09 · Writing the program · three allowances, checked',
      heading: 'Forever, 295 and 294',
      stand: 'The main function runs the stream with no bound, with the longest gap, and with one less, and asserts every answer.',
      question: { step: 0, prompt: 'At an allowance of 294, which keys come out wrong?', options: [
        { text: 'Both: a tight allowance damages every key.', correct: false, why: 'Key b is never quiet for more than 130, so 294 never touches it. It stays at 21.' },
        { text: 'Only a, and too low: 8 instead of 24.', correct: true, why: 'a is the only key quiet for more than 294. Its 16 is dropped, so its total can only fall.' },
        { text: 'Only a, and too high: it is counted twice.', correct: false, why: 'Nothing is added twice. A dropped total is lost, so the error can only make totals smaller.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS, GAP], add: [RUN, CHECK], step: 1 }),
      cards: [ { step: 2, title: 'Wrong, and only low', html: '<p>No bound: a 24, b 21. At 295: the same. At 294: a <b>8</b>, b 21 — 1 of 2 wrong, too low by exactly the 16 dropped, with no error raised. The single step is asserted too: dropped 16, key looked new.[[src:trace]]</p>' } ],
      narration: [
        'Now main runs the stream three ways and asserts every answer. At an allowance of 294, which keys come out wrong? Choose an answer.',
        'Only A, and too low. Here is the start of main: the totals with no bound, at 295, and at 294, then assertions that A is wrong, B is right, and the error is exactly the 16 dropped.',
        'With no bound or at 295, A is 24 and B is 21. At 294, A is 8: one of two totals wrong, always too low, and no error raised anywhere.'
      ]
    },

    /* ---------- 10 · the saving here ---------- */
    {
      title: 'Zero', layout: 'code',
      eyebrow: '10 · Writing the program · what the bound saves here',
      heading: 'At two keys, the bound saves nothing',
      stand: 'The bound costs a’s correct total. What does it buy in memory on this stream?',
      question: { step: 0, prompt: 'At an allowance of 294, how many keys does the bound save at the busiest moment of this stream?', options: [
        { text: 'One: key a, while it is quiet.', correct: false, why: 'a is only dropped at 540, by its own returning event, which re-creates it at once. It is never absent at a quiet moment.' },
        { text: 'Two: both keys, after their last events.', correct: false, why: 'Up to 540, neither key is ever more than 294 past its last event at a moment the program looks.' },
        { text: 'None at any moment: the cost arrives before any saving.', correct: true, why: 'Measured at every moment up to 540, the bounded state is never smaller than the unbounded one.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS, GAP, RUN, CHECK], add: [HELD, ZERO], step: 1 }),
      cards: [ { step: 2, title: 'Measured, not argued', html: '<p><code>held_at</code> counts keys held at one moment. The end of the run is the wrong place to look, since an expiry is followed at once by the event that re-creates the key. Saving at every moment here: <b>0</b>.[[src:trace]]</p>' } ],
      narration: [
        'The bound cost A its correct total. What does it buy? At 294, how many keys does it save at the busiest moment of this stream? Choose an answer.',
        'None. Here is held at, which counts the keys held at one moment, and the check: at every moment from 0 to 540, the bound saves 0 keys. The cost came before any benefit.',
        'Why measure every moment? Because at the end of the run, an expiry is always followed straight away by the event that brings the key back, so the saving would be invisible there.'
      ]
    },

    /* ---------- 11 · the scale where it pays ---------- */
    {
      title: 'Scale', layout: 'code',
      eyebrow: '11 · Writing the program · where the bound pays',
      heading: '2,000 one-off keys and one that never stops',
      stand: 'The case for bounding is about scale. The program builds a stream where most keys are seen once.',
      question: { step: 0, prompt: 'With 2,000 keys seen once each and one recurring key, what does an allowance of 100 keep at the end?', options: [
        { text: 'Only the keys touched in the last 100 time units.', correct: true, why: 'Everything older is dropped, so the state stays the size of one allowance, however many keys pass through.' },
        { text: 'All 2,001 keys, because every key was seen.', correct: false, why: 'That is the unbounded case. The allowance exists precisely to let old one-off keys go.' },
        { text: 'Only the recurring key.', correct: false, why: 'The one-off keys from the last 100 time units are still inside the allowance and are kept.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS, GAP, RUN, CHECK, HELD, ZERO], add: [BIGC, BIG], step: 1 }),
      cards: [ { step: 2, title: '102 instead of 2,001', html: '<p>Unbounded: <b>2001</b> keys held. At 100: <b>102</b> — 100 one-off keys, the recurring one and one on the boundary: 1899 saved, 5.1% of the state. The recurring key, gap 10, is still exact at 200.[[src:whole]]</p>' } ],
      narration: [
        'The case for bounding is about scale. With 2,000 keys seen once each and one recurring key, what does an allowance of 100 keep at the end? Choose an answer.',
        'Only the keys touched in the last 100 time units. Here is that stream, built and measured: the unbounded state against the bounded one, at the last moment.',
        'Unbounded, it holds 2,001 keys. At 100, it holds 102: 1,899 saved, 5.1 percent of the state. And the recurring key, whose gap is only 10, is still exact.'
      ]
    },

    /* ---------- 12 · the three variations ---------- */
    {
      title: 'Vars', layout: 'code', defines: ['sketch'],
      eyebrow: '12 · Writing the program · the same problem, three other ways',
      heading: 'Visitors, carts and fraud scores',
      stand: 'The same program wears three other surfaces. Each one changes what the bound may do.',
      question: { step: 0, prompt: 'To count distinct visitors, the state becomes the set of visitors. Why does dropping quiet ones not help?', options: [
        { text: 'Every visitor must be remembered all day to know who is new.', correct: true, why: 'A dropped visitor who returns is counted again, so the only way to save memory is to stop being exact.' },
        { text: 'Visitors are never quiet for long.', correct: false, why: 'Some are. The problem is that each one must still be remembered for the whole day, quiet or not.' },
        { text: 'A set is smaller than one number per key.', correct: false, why: 'The opposite: the set is as big as the number of visitors, which is the very thing being measured.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS, GAP, RUN, CHECK, HELD, ZERO, BIGC, BIG], add: [VARS, VARMAIN], step: 1 }),
      cards: [ { step: 2, title: 'Three escapes', html: '<p><b>Visitors</b>: a <b>sketch</b> — an approximate counter in fixed space: 5307 for 5000, in 256 slots. <b>Carts</b>: spill and reload, exact. <b>Fraud score</b>: keep it in a store, holding 0 keys between events.[[src:whole]]</p>' } ],
      narration: [
        'The same program wears three other surfaces. To count distinct visitors, the state becomes the set of visitors. Why does dropping quiet ones not help? Choose an answer.',
        'Every visitor must be remembered all day to know who is new. Here are the three variations, and the lines in main that check them.',
        'Visitors give up exactness: an approximate counter in fixed space, called a sketch, says 5,307 for 5,000 in 256 slots. Carts spill and reload, exactly. Fraud scores live in a store, so 0 keys are held between events.'
      ]
    },

    /* ---------- 13 · brute force ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '13 · Writing the program · checking many streams',
      heading: 'One example is not proof',
      stand: 'The last piece runs 500 random streams and checks every claim against the true totals.',
      question: { step: 0, prompt: 'A first claim said: at an allowance equal to the longest gap, every total comes out exact. A random stream broke it. Why?', options: [
        { text: 'A key whose last event is long before the end is released, so it is absent, not wrong.', correct: true, why: 'Its total was already reported. What survives is the stronger claim: nothing is ever dropped and re-created.' },
        { text: 'The longest gap was measured wrongly.', correct: false, why: 'The gap is measured exactly. The claim, not the measurement, was too broad.' },
        { text: 'Random streams have keys with negative values.', correct: false, why: 'Every value is from 1 to 9. The failure is about when keys are released, not their values.' } ] },
      code: P.build({ before: [DATA, ADD, DROP, ON, TOTALS, GAP, RUN, CHECK, HELD, ZERO, BIGC, BIG, VARS, VARMAIN], add: [BRUTE], step: 1 }),
      cards: [ { step: 2, title: 'What survives 500 streams', html: '<p>Unbounded equals the true totals; at the longest gap nothing restarts; spilling is exact at any allowance; and a tight allowance never overstates — it only ever loses.[[src:whole]]</p>' } ],
      narration: [
        'The last piece runs 500 random streams. A first claim said an allowance equal to the longest gap makes every total exact, and a random stream broke it. Why? Choose an answer.',
        'A key whose last event is long before the end is released, so it is absent rather than wrong. Here is the loop, with the corrected claim written beside it: nothing is ever dropped and re-created.',
        'Across 500 streams: no bound gives the true totals, the longest gap restarts nothing, spilling is exact at any allowance, and a tight allowance never overstates. It only ever loses.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have now seen each piece being written and why.',
        'From the top: the data, the addition, the bound, one event, the whole stream, the longest gap, the three variations, and main, which checks every claim.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch07.py prints'),
      narration: [
        'And here is what it prints. The longest gaps are 295 and 130. At 295 both totals are right; at 294 A restarts at 8, and the bound saves 0 keys here.',
        'At scale it holds 102 keys instead of 2,001. The variations and 500 random streams all pass, and the last line says every assertion passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'One addition, one bound, and the price of the bound',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>add</code>', 'one addition per event, one number per key', 'a 24, b 21'] },
          { step: 0, cells: ['<code>drop_stale</code>', 'forgets keys quiet longer than the allowance — needs a second number per key', 'a dropped holding 16'] },
          { step: 1, cells: ['<code>on_event</code> · <code>totals</code>', 'drop, then add; a forgotten key restarts at zero, unless spilled', 'a 8 at 294'] },
          { step: 1, cells: ['<code>longest_gap</code>', 'the safe allowance, known only afterwards', 'a 295, b 130'] },
          { step: 2, cells: ['<code>held_at</code>', 'keys held at one moment: the honest measure of the saving', '0 here, 1899 at scale'] }
        ]
      },
      side: { step: 3, title: 'Three things to volunteer', html: '<p>The state is sized by <b>distinct keys</b>, not by throughput. An expiry makes a total <b>restart</b>, silently low, on the quietest keys. The allowance must exceed the longest silence, which is a <b>guess</b>.[[src:trace]]</p>' },
      narration: [
        'To recap. Add is the whole computation: one addition per event, one number per key. Drop stale bounds the state, at the price of a second number per key.',
        'On event drops then adds, so a forgotten key restarts at zero: A becomes 8 at 294, unless its total was spilled and reloaded. Longest gap gives the safe allowance, but only afterwards.',
        'Held at measures the honest saving: 0 keys here, 1,899 at scale. So the cost arrives first, and the benefit only at scale.',
        'Three things to volunteer in the interview: state is sized by distinct keys; an expiry restarts totals silently low; and the allowance is a guess about the longest silence.'
      ]
    }
  ]
};
