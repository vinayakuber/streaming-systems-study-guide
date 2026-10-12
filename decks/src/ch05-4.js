// Chapter 5, Part 4 — the Google interview question ("crash at any instant, process each item
// exactly once"), built as a program WITH the viewer. Every code slide asks what the next
// piece must do, then reveals the real lines from programs/ch05.py (read at build time by
// _prog.js, addressed by content, never by line number). The nine crash points are animated,
// and the last slides show the whole file and what it actually prints (programs/ch05.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch05';
const P = program('ch05.py');
const OUT = program('ch05.out');

const upto = needle => P.at(needle) - 1;
// the pieces, in the order they are written
const DATA = P.span('ITEMS = [(0, 5)', 'C = 3');
const APPLY = P.fn('apply_item');
const W_DOC = [P.at('def worker('), upto('db = {"sum": 0, "pos": 0}')];
const W_LOOP = P.span('db = {"sum": 0, "pos": 0}', 'die = i in crash_at and i not in fired');
const W_TAIL = P.span('if not crashed:', '    return db');
const W_EFFECT = [P.at('if order == "effect_then_position":'), upto('elif order == "position_then_effect":')];
const W_POS = [P.at('elif order == "position_then_effect":'), upto('else:                            # one transaction')];
const W_TX = [P.at('else:                            # one transaction'), upto('if not crashed:')];
const VARS = [P.at('# The three variations.'), P.at('return at_least, at_most')];
const M_CLEAN = P.span('def main():', 'assert set(clean.values()) == {CORRECT}, clean');
const M_RUNS = P.span('effect = [worker(ITEMS, "effect_then_position", {c})["sum"] for c in range(N)]', 'print(f"    transactional {atomic}');
const M_ASSERT = [P.at('dupes = [s for s in effect if s > CORRECT]'), P.at('f"{worker(ITEMS, \'effect_then_position\', set(range(N)))[\'sum\']}")')];
const M_VARS = [P.at('# variations'), upto('# brute force over many inputs')];
const M_BRUTE = [P.at('# brute force over many inputs'), P.lines.length - 1];

// the nine crash points, read from the program's own assertions so the slide cannot drift
const EFFECT = JSON.parse(P.lines[P.at('assert effect == [')].match(/\[[^\]]*\]/)[0]);
const POSN = JSON.parse(P.lines[P.at('assert posn == [')].match(/\[[^\]]*\]/)[0]);

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['ITEMS = 0:5  1:3  2:7  3:2  4:6  5:1  6:9  7:4  8:8   total 45', 'no crash, every ordering: [45]',
  'effect then position : 47  (+2)', 'position then effect : 43  (-2)', 'one transaction      : 45  (exact)',
  'effect first  [50, 48, 52, 47, 51, 46, 54, 49, 53]  -> 9/9 duplicate', 'position first [40, 42, 38, 43, 39, 44, 36, 41, 37]  -> 9/9 lose',
  'transactional [45, 45, 45, 45, 45, 45, 45, 45, 45]  -> 9/9 exact', 'crashed at every item at once: transactional 45, effect-first 90',
  "half-uploaded file: with rename None, written directly 'xxxxxx'", 'counter in two places: dual write (15, 8) disagree, derived (8, 8) agree',
  'push notification: at-least-once 20, at-most-once 14, true 17 -- pick one', '400 random item lists x every crash point', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch05.out no longer prints "${s}" — rewrite the narration`);
if (EFFECT.join() !== '50,48,52,47,51,46,54,49,53' || POSN.join() !== '40,42,38,43,39,44,36,41,37')
  throw new Error('programs/ch05.py no longer asserts the crash table this deck animates — rewrite the narration');

const W = (...pieces) => pieces;

module.exports = {
  title: 'The Two Writes',
  eyebrow: 'Streaming · Ch 5 · Part 4',
  ...shared,
  jargon: ['queue', 'item', 'worker', 'database', 'position', 'crash', 'restart', 'pair', 'function', 'durable',
    'transaction', 'commit', 'at-least-once', 'at-most-once'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 5 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 5 · how to model it'),
    ways:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 5 · the same problem, 3 other ways'),
    whole: section(CH, 'The whole program', 'Chapter 5 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 5 · the solution, traced')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['queue', 'item', 'worker', 'database', 'position', 'crash'],
      eyebrow: '01 · A Google interview question',
      heading: 'A worker, nine items, and a crash that can come at any instant',
      hero: { step: 0, text: 'Numbered <b>items</b> wait in a <b>queue</b>, a line of work to be done in order. A program called the <b>worker</b> takes each item, adds its value to a balance kept in a <b>database</b> (a store that survives a power cut), and records its <b>position</b>: how far it has got. The machine can <b>crash</b> — stop dead — at any instant.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'items in the queue, numbered 0 to 8[[src:prob]]' },
        { step: 1, value: 45, label: 'the right balance at the end[[src:prob]]' },
        { step: 2, value: 47, label: 'the obvious program, crashed during item 3[[src:prob]]' },
        { step: 2, value: 43, label: 'the same program with two lines swapped[[src:prob]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'No item processed twice', text: 'Or the balance is too high.' },
        { step: 3, n: 2, title: 'No item skipped', text: 'Or the balance is too low.' },
        { step: 4, n: 3, title: 'Whatever instant the crash lands on', text: 'The queue sends again anything not recorded as read.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each code slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'Numbered items wait in a queue. A program, the worker, adds each item’s value to a balance in a database, a store that survives a power cut, and records its position: how far it has got. The machine can crash at any instant.',
        'Our queue has 9 items, numbered 0 to 8. Their values add up to 45, so the right balance at the end is 45.',
        'Crash the obvious program while it handles item 3, and the balance ends at 47. Swap two of its lines, and it ends at 43. Both are wrong.',
        'The interviewer asks: make sure no item is processed twice, and no item is skipped.',
        'Whatever instant the crash lands on. The queue will send again anything not recorded as read. We will now write the program together, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · a small case, before any code ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['restart'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Trace one crash by hand',
      stand: 'Items 0, 1 and 2 are done: balance 15, position 3. The worker adds item 3 (worth 2), so the balance is 17 — and it crashes before recording position 4.',
      question: {
        step: 0,
        prompt: 'It starts again from the recorded position, 3, and runs to the end. What is the final balance?',
        options: [
          { text: '47: item 3 is added a second time.', correct: true,
            why: 'The position still says 3, so item 3 is handled again on top of the 17. Everything else is added once: 45 plus 2.' },
          { text: '45: the worker carries on from where it stopped.', correct: false,
            why: 'It carries on from the position it recorded, which is before item 3. The 2 is already in the balance.' },
          { text: '43: item 3 is lost in the crash.', correct: false,
            why: 'Item 3’s value reached the balance before the crash. Nothing was lost; something is about to be doubled.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A restart', html: '<p>Starting the worker again after a crash, from the position it had recorded, is a <b>restart</b>. It knows only what was written down.[[src:trace]]</p>' },
        { step: 2, title: 'Not a narrow window', html: '<p>The same happens whichever item the crash lands on: every one of the 9 crash points gives a balance that is too high.[[src:model]]</p>' }
      ],
      narration: [
        'Before any code, try one case. Balance 15, position 3. The worker adds item 3, worth 2, making 17, and crashes before recording position 4. It starts again from position 3. What is the final balance? Choose an answer.',
        '47. Starting again from the recorded position after a crash is called a restart. The position still says 3, so item 3 is added a second time.',
        'And this is not bad luck with one item. Whichever item the crash lands on, the balance comes out too high. We will prove that with the program.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['pair', 'function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Start with the nine items',
      stand: 'A program is written top to bottom. The first thing it needs is the queue.',
      question: { step: 0, prompt: 'Why should every item’s value be different, and none of them zero?', options: [
        { text: 'So a wrong balance shows exactly which item went wrong.', correct: true, why: 'With distinct values, 47 can only mean item 3 (worth 2) was doubled. A zero would make a repeat invisible.' },
        { text: 'So the program runs faster.', correct: false, why: 'Speed has nothing to do with it. The values are chosen so that mistakes are visible.' },
        { text: 'Because the queue refuses repeated values.', correct: false, why: 'A queue holds whatever it is given. The choice is ours, made for testing.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch05.py · the data' }),
      cards: [ { step: 2, title: 'Four lines', html: '<p><code>ITEMS</code> holds nine <b>pairs</b> — two values kept together: (number, value). <code>CORRECT</code> is 45, and <code>C</code> = 3 is the crash point the printout follows. Each piece below is a <b>function</b>: a named recipe that takes inputs and gives back an answer.[[src:whole]]</p>' } ],
      narration: [
        'First, the data. Why should every item’s value be different, and none of them zero? Choose an answer.',
        'So a wrong balance points at the item that went wrong. Here are the lines: nine pairs of number and value, the correct total of 45, and the crash point 3 that the printout follows.',
        'A pair is two values kept together. Everything after this is written as functions: named recipes that take inputs and give back an answer.'
      ]
    },

    /* ---------- 4 · the effect ---------- */
    {
      title: 'Work', layout: 'code',
      eyebrow: '04 · Writing the program · the work itself',
      heading: 'The effect: move the balance',
      stand: 'The work for one item is to add its value to the balance.',
      question: { step: 0, prompt: 'The function that does one item’s work is run twice for the same item. What happens?', options: [
        { text: 'The balance moves twice: the item is counted twice.', correct: true, why: 'Adding is a change, not a result. Doing it again changes the balance again.' },
        { text: 'Nothing: the second run sees the item was done.', correct: false, why: 'The function only adds. It keeps no record of which items it has seen.' },
        { text: 'The program stops with an error.', correct: false, why: 'Adding twice is perfectly legal. That is exactly why the mistake is silent.' } ] },
      code: P.build({ before: W(DATA), add: [APPLY], step: 1 }),
      cards: [ { step: 2, title: 'Deliberately not safe to repeat', html: '<p><code>apply_item</code> returns the balance plus the item’s value. Run twice, it moves the balance twice. That is what makes a duplicate <b>visible</b> rather than harmless.[[src:prob]]</p>' } ],
      narration: [
        'Next, the work for one item. If that function is run twice for the same item, what happens? Choose an answer.',
        'The balance moves twice. Here it is: apply item returns the balance plus the item’s value. Nothing more.',
        'It is deliberately not safe to repeat. The problem says the effect moves a balance, and that is what makes a duplicate show up instead of being harmless.'
      ]
    },

    /* ---------- 5 · the worker's durable state ---------- */
    {
      title: 'State', layout: 'code', defines: ['durable'],
      eyebrow: '05 · Writing the program · what survives a crash',
      heading: 'Two numbers survive. Everything else is lost.',
      stand: 'The worker loops over the items from its recorded position. A crash simply stops the loop.',
      question: { step: 0, prompt: 'After a crash, what does the restarted worker know?', options: [
        { text: 'Only what is in the database: the balance and the position.', correct: true, why: 'Everything the program was holding in its head is gone. Those two numbers are all that is left.' },
        { text: 'Which item it was in the middle of.', correct: false, why: 'That was only in the running program, which died. Unless it was written down, it is gone.' },
        { text: 'Whether the last write finished.', correct: false, why: 'Nothing records that. This is exactly the blind spot the whole problem is about.' } ] },
      code: P.build({ before: W(DATA, APPLY), add: [W_DOC, W_LOOP, W_TAIL], step: 1 }),
      cards: [ { step: 2, title: 'Durable', html: '<p>Kept somewhere that survives a crash is called <b>durable</b>. Here that is only <code>db</code>: <code>sum</code> (the balance) and <code>pos</code> (the position). The loop restarts from <code>db["pos"]</code> until no crash happens.[[src:trace]]</p>' } ],
      narration: [
        'Now the worker itself. After a crash, what does the restarted worker know? Choose an answer.',
        'Only what is in the database: the balance and the position. Here is the frame of the worker: it starts both at zero, then loops from the recorded position, and starts again after every crash.',
        'Kept somewhere that survives a crash is called durable. Here only two numbers are durable: the balance and the position. The whole problem is about those two writes.'
      ]
    },

    /* ---------- 6 · effect first ---------- */
    {
      title: 'First', layout: 'code',
      eyebrow: '06 · Writing the program · the obvious order',
      heading: 'Write the result, then the position',
      stand: 'The obvious order: do the work, then record that it was done. The crash is placed between the two writes.',
      question: { step: 0, prompt: 'A crash lands between the two writes. What does the restart do?', options: [
        { text: 'Does the item again: the work is in, the record of it is not.', correct: true, why: 'The position still points at this item, so the restart handles it a second time.' },
        { text: 'Skips the item: it was already done.', correct: false, why: 'The worker only knows what the position says, and the position was never moved.' },
        { text: 'Nothing goes wrong: the gap is too short to matter.', correct: false, why: 'A crash can land at any instant, including this one. The program tests every item.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_TAIL), add: [W_EFFECT], step: 1 }),
      cards: [ { step: 2, title: 'Too high, at every item', html: '<p>Crashed during item 3, the balance ends at <b>47</b>. Crashed at each of the 9 items, it is always too high, by exactly that item’s value: 9 of 9.[[src:model]]</p>' } ],
      narration: [
        'The obvious order: write the result, then record the position. A crash lands between the two. What does the restart do? Choose an answer.',
        'Does the item again. Here is the branch: add the value, and if this is the crash point, stop before moving the position. The comment marks the exact instant.',
        'Crashed during item 3, the balance ends at 47. Crashed at any of the 9 items, it is too high by exactly that item’s value. Not a narrow window: every item.'
      ]
    },

    /* ---------- 7 · position first ---------- */
    {
      title: 'Swap', layout: 'code',
      eyebrow: '07 · Writing the program · the obvious repair',
      heading: 'So record the position first',
      stand: 'Swap the two writes: record the position, then do the work. A crash still lands between them.',
      question: { step: 0, prompt: 'With the position recorded first, what does a crash between the writes do?', options: [
        { text: 'The item is skipped forever, and nothing notices.', correct: true, why: 'The position already says the item is done, so the restart moves on without ever doing it.' },
        { text: 'The item is done twice, as before.', correct: false, why: 'The position has moved past it, so the restart will not come back to it.' },
        { text: 'It is safe now: the position is written first.', correct: false, why: 'Writing it first just moves the bad instant. Now the record says done when nothing was done.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_TAIL), add: [W_POS], step: 1 }),
      cards: [ { step: 2, title: 'Too low, at every item', html: '<p>Crashed during item 3, the balance ends at <b>43</b>, short by 2. Crashed at each of the 9 items, it is always too low: 9 of 9. And the record says all is well.[[src:model]]</p>' } ],
      narration: [
        'The obvious repair: swap the two writes. What does a crash between them do now? Choose an answer.',
        'The item is skipped forever. Here is the branch: move the position first, then, if this is the crash point, stop before adding the value.',
        'Crashed during item 3, the balance ends at 43, short by 2. Crashed at any of the 9 items, it is too low, and the record says everything was handled. Nothing will ever notice.'
      ]
    },

    /* ---------- 8 · the proof ---------- */
    {
      title: 'Proof', layout: 'ask',
      eyebrow: '08 · Your turn · is there a safe order?',
      heading: 'Two writes. How many orders?',
      stand: 'Effect then position doubles an item. Position then effect skips one. Someone suggests trying harder: retry more, write sooner, add a third write.',
      question: {
        step: 0,
        prompt: 'Is there any order of two separate writes that a crash cannot break?',
        options: [
          { text: 'No: there are only two orders, and each has a bad instant between the writes.', correct: true,
            why: 'Two writes give exactly two sequences, and a crash can land between them in either. That exhausts the options: it is a proof, not a pair of bugs.' },
          { text: 'Yes: write them faster, so the gap is too small to hit.', correct: false,
            why: 'A crash can land at any instant. A smaller gap is still a gap.' },
          { text: 'Yes: add a third write that checks the other two.', correct: false,
            why: 'Then there are gaps between three writes instead of two. Each one is another instant to crash in.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A proof, not a pair of bugs', html: '<p>Measured: 9 of 9 crash points duplicate one way, and 9 of 9 lose the other. No amount of care about the order fixes it.[[src:model]]</p>' },
        { step: 2, title: 'The reframe', html: '<p>Stop having two writes. Make the result and the position <b>one</b> durable fact, so a crash leaves both or neither.[[src:model]]</p>' }
      ],
      narration: [
        'One order doubles an item, the other skips one. Is there any order of two separate writes that a crash cannot break? Choose an answer.',
        'No. Two writes give exactly two orders, and a crash can land between the writes in either one. That is a proof, not a pair of bugs. Retrying harder or adding a third write only adds more instants.',
        'So the way out is not a better order. It is to stop having two writes: make the result and the position one fact, so that a crash leaves both, or neither.'
      ]
    },

    /* ---------- 9 · one transaction ---------- */
    {
      title: 'Tx', layout: 'code', defines: ['transaction', 'commit'],
      eyebrow: '09 · Writing the program · one write instead of two',
      heading: 'Both writes, or neither',
      stand: 'The database can group the two writes so they become durable together.',
      question: { step: 0, prompt: 'The two writes are grouped so they land together. A crash comes just before they land. What does the restart see?', options: [
        { text: 'Neither write: it does the item once, for the first time.', correct: true, why: 'Nothing of the item reached the database, so redoing it is not a repeat. It is the first time.' },
        { text: 'The balance moved but not the position.', correct: false, why: 'That split is exactly what grouping makes impossible. They land together or not at all.' },
        { text: 'The position moved but not the balance.', correct: false, why: 'Same answer: grouped writes cannot land half way.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_POS, W_TAIL), add: [W_TX], step: 1 }),
      cards: [
        { step: 2, title: 'Transaction and commit', html: '<p>Writes grouped to land together form a <b>transaction</b>; the instant they land is the <b>commit</b>. Before it: neither. After it: both.[[src:trace]]</p><p>No retry logic, no list of handled items, no protocol between machines.[[src:model]]</p>' }
      ],
      narration: [
        'The way out. The two writes are grouped so they land together, and a crash comes just before they land. What does the restart see? Choose an answer.',
        'Neither write, so it does the item once, for the first time. Here is the branch: if the crash comes before the commit, nothing is written; otherwise both writes land.',
        'Grouping writes so they land together is called a transaction, and the instant they land is the commit. The program tests a crash on both sides of the commit.',
        'And notice what was not needed: no retry logic, no list of items already handled, no protocol between machines. One transaction.'
      ]
    },

    /* ---------- 10 · the nine crash points, animated ---------- */
    {
      title: 'Nine', layout: 'array',
      eyebrow: '10 · Watch every crash point',
      heading: 'Crash at each item in turn: which balances come out 45?',
      stand: 'Each column is one crash point: the item the crash lands on. Each row is one order of writes.',
      array: {
        labelWidth: 200, slotLabel: 'crash at item',
        rows: [
          { label: 'effect then position', values: EFFECT },
          { label: 'position then effect', values: POSN },
          { label: 'one transaction', values: Array(9).fill(45) }
        ],
        meters: ['crash points tried', 'balances of 45'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 0, do: 'sweep', row: 0, mode: 'match', match: 45, readMeter: 0, resultMeter: 1, speed: 260 },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 45, readMeter: 0, resultMeter: 1, speed: 260 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'match', match: 45, readMeter: 0, resultMeter: 1, speed: 260 },
          { step: 3, do: 'pick', slots: [3] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Wrong by one item, every time', html: '<p>Effect first is always high by the crashed item’s value; position first is always low by it. Worst case: 54 and 36, 9 off either way.[[src:trace]]</p>' },
        { step: 3, title: 'Item 3, the traced crash', html: '<p>47, 43 and 45. The program prints exactly this column, then asserts all 27 values.[[src:trace]]</p>' }
      ],
      narration: [
        'Each column is one crash point. First row, effect then position. Watch the counter: nine crash points tried, and not one balance comes out 45.',
        'Second row, position then effect. Nine tried, and again not one comes out 45. Each is low by exactly the value of the item the crash landed on.',
        'Third row, one transaction. Nine tried, and all nine come out 45.',
        'The highlighted column is item 3, the crash the program traces: 47, 43 and 45.'
      ]
    },

    /* ---------- 11 · the three variations ---------- */
    {
      title: 'Vars', layout: 'code', defines: ['at-least-once', 'at-most-once'],
      eyebrow: '11 · Writing the program · when there is no transaction',
      heading: 'The same shape, three other surfaces',
      stand: 'The fix rests on one thing: the position can live in the same database as the result. What if it cannot?',
      question: { step: 0, prompt: 'The work is a push notification to a phone. There is no transaction to join. What can the worker still offer?', options: [
        { text: 'One of two: maybe twice, or maybe never. You must pick.', correct: true, why: 'Notify then record may notify twice; record then notify may never notify. Without one transaction, those are the choices.' },
        { text: 'Exactly once, by choosing the order carefully.', correct: false, why: 'The proof already ruled that out: every order of two writes has a bad instant.' },
        { text: 'Exactly once, by retrying until it works.', correct: false, why: 'A retry after a crash is how the second notification gets sent.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_POS, W_TX, W_TAIL), add: [VARS], step: 1 }),
      cards: [ { step: 2, title: 'Three functions, three later parts', html: '<p>A half-uploaded file (backups), a counter kept in two places (analytics), and a notification (no transaction, no key). The last returns <b>at-least-once</b> (maybe twice) and <b>at-most-once</b> (maybe never) side by side.[[src:ways]]</p>' } ],
      narration: [
        'The fix needs the position to live in the same database as the result. Suppose the work is a push notification, with no transaction to join. What can the worker offer? Choose an answer.',
        'One of two: maybe twice, or maybe never. Here are three short functions, the same problem in three other surfaces: a backup file, a counter kept in two places, and a notification.',
        'Maybe twice is called at-least-once; maybe never is called at-most-once. The notification function returns both, side by side. Each variation gets its own part later.'
      ]
    },

    /* ---------- 12 · main: the clean run and the crash runs ---------- */
    {
      title: 'Runs', layout: 'code',
      eyebrow: '12 · Writing the program · running every case',
      heading: 'First prove the worker is right with no crash',
      stand: 'The last function runs everything and checks it. It starts before any crash is injected.',
      question: { step: 0, prompt: 'Before injecting any crash, what should the program check first?', options: [
        { text: 'That every order gives 45 when nothing crashes.', correct: true, why: 'Otherwise a wrong balance later could be a plain bug, not the crash. The clean run is the baseline.' },
        { text: 'That the program runs quickly.', correct: false, why: 'Speed says nothing about correctness. The baseline that matters is the right answer.' },
        { text: 'Nothing: the crash cases are the point.', correct: false, why: 'Without the baseline, a crash result cannot be blamed on the crash.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_POS, W_TX, W_TAIL, VARS), add: [M_CLEAN, M_RUNS], step: 1 }),
      cards: [ { step: 2, title: 'Then every crash point', html: '<p>With no crash, every order gives <b>45</b>. Then each order is run crashed at each of the 9 items, and the crash during item 3 is printed: 47, 43, 45.[[src:whole]]</p>' } ],
      narration: [
        'The last function runs everything. Before injecting any crash, what should it check first? Choose an answer.',
        'That every order gives 45 when nothing crashes. Here is the start of main: it runs all three orders cleanly and asserts 45.',
        'Then it runs each order crashed at each of the 9 items, and prints the crash during item 3: 47, 43 and 45, followed by all nine results for each order.'
      ]
    },

    /* ---------- 13 · main: the assertions ---------- */
    {
      title: 'Asrt', layout: 'code',
      eyebrow: '13 · Writing the program · asserting the proof',
      heading: 'No crash point may come out right',
      stand: 'The checks state the claim exactly, so the program fails if it ever stops being true.',
      question: { step: 0, prompt: 'Why does the program assert that 45 never appears among the effect-first results?', options: [
        { text: 'To prove the failure is at every item, not a narrow window.', correct: true, why: 'If even one crash point came out right, the claim would be “usually wrong”, not “no order works”.' },
        { text: 'Because 45 would mean the program crashed.', correct: false, why: '45 is the right balance. The point is that this order never reaches it after a crash.' },
        { text: 'To make the printout shorter.', correct: false, why: 'An assertion prints nothing. It only stops the program if the fact is false.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_POS, W_TX, W_TAIL, VARS, M_CLEAN, M_RUNS), add: [M_ASSERT], step: 1 }),
      cards: [ { step: 2, title: 'And the extremes', html: '<p>Each error is exactly one item’s value; the transaction is exact on both sides of the commit; and crashed at <b>every</b> item in one run, the transaction still gives 45 while effect first gives <b>90</b>.[[src:whole]]</p>' } ],
      narration: [
        'Now the checks. Why does the program assert that 45 never appears among the effect-first results? Choose an answer.',
        'To prove the failure is at every item. Here they are: 9 of 9 duplicate, 9 of 9 lose, the exact lists, and each error equal to one item’s value.',
        'Then the extremes: the transaction is exact on both sides of the commit, and even crashed at every item in one run it gives 45, while effect first gives 90.'
      ]
    },

    /* ---------- 14 · main: variations and random tests ---------- */
    {
      title: 'Rand', layout: 'code',
      eyebrow: '14 · Writing the program · beyond one example',
      heading: 'Four hundred random queues',
      stand: 'The variations are checked, then the claims are tested on lists the author never chose.',
      question: { step: 0, prompt: 'Why test 400 random lists of items, after the nine items already passed?', options: [
        { text: 'Because one example can pass by luck.', correct: true, why: 'Random lengths and values, crashed at every point, show the rule holds generally, not just for 5, 3, 7 and so on.' },
        { text: 'To make the program take longer.', correct: false, why: 'Time is not the goal; confidence that the rule is general is.' },
        { text: 'Because nine items is too few to crash.', correct: false, why: 'Nine items crash fine. The worry is that they were special.' } ] },
      code: P.build({ before: W(DATA, APPLY, W_DOC, W_LOOP, W_EFFECT, W_POS, W_TX, W_TAIL, VARS, M_CLEAN, M_RUNS, M_ASSERT), add: [M_VARS, M_BRUTE], step: 1 }),
      cards: [ { step: 2, title: 'The rule, everywhere', html: '<p>Effect first is always high by exactly the crashed item, position first always low by it, and one transaction always exact — even crashed at every item in one run.[[src:whole]]</p>' } ],
      narration: [
        'Last piece. Why test 400 random lists of items, after the nine items already passed? Choose an answer.',
        'Because one example can pass by luck. Here are the variation checks, then 400 random lists, each crashed at every point, in all three orders.',
        'Effect first is always high by exactly the crashed item, position first always low by it, and one transaction always exact.'
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
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have now seen each piece written, and why.',
        'From the top: the items, the effect, the worker with its three orders, the three variations, and the checks that prove every claim.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch05.py prints'),
      narration: [
        'And here is what it prints. The crash during item 3 gives 47, 43 and 45. Across all nine crash points: 9 of 9 duplicate, 9 of 9 lose, and 9 of 9 exact.',
        'Then the three variations, the 400 random lists, and the last line: all assertions passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'Two writes cannot be ordered safely; one transaction can',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Crash during item 3'],
        rows: [
          { step: 0, cells: ['<code>apply_item</code>', 'Adds the item’s value: not safe to repeat.', '—'] },
          { step: 0, cells: ['effect then position', 'Does the work, then records it.', '47 · 9 of 9 too high'] },
          { step: 1, cells: ['position then effect', 'Records it, then does the work.', '43 · 9 of 9 too low'] },
          { step: 1, cells: ['one transaction', 'Both writes commit together, or neither.', '45 · 9 of 9 exact'] },
          { step: 2, cells: ['the catch', 'The position must live in the same database as the result.', 'otherwise: at-least-once or at-most-once'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>The same shape in three disguises: a backup file half uploaded, a counter kept in two places, and a notification that must not be sent twice. Each gets its own part, built the same way.[[src:ways]]</p>' },
      narration: [
        'To recap. The effect adds an item’s value and is not safe to repeat. Effect then position doubles the crashed item: 47, and too high at every crash point.',
        'Position then effect skips it: 43, too low at every crash point. One transaction commits both or neither: 45 at every crash point.',
        'The catch: the position must live in the same database as the result. Otherwise only at-least-once or at-most-once is available, and you must say which.',
        'Next, the same shape in three disguises: a backup file, a counter kept in two places, and a notification. Each gets its own part.'
      ]
    }
  ]
};
