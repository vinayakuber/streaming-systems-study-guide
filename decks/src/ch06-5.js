// Chapter 6, Part 5 — Variation 2 of the interview question ("the cache that must not go
// stale"), built as a program WITH the viewer. Every code slide asks what the next piece must
// do, then reveals the real lines from programs/ch06_v2.py (read at build time by _prog.js,
// addressed by content, never by line number). The last slides show the whole file and what
// it actually prints (programs/ch06_v2.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch06';
const P = program('ch06_v2.py');
const OUT = program('ch06_v2.out');

// the log, read from the program itself so the slides cannot drift from it
const LOG = [...P.lines[P.at('LOG = [("a", 5)')].matchAll(/\("(\w)", (\d+)\)/g), ...P.lines[P.at('("b", 8), ("b", 17)')].matchAll(/\("(\w)", (\d+)\)/g)]
  .map(m => `${m[1]}=${m[2]}`);
const SNAP_V = Number(P.lines[P.at('SNAPSHOT_VERSION = 7')].split('=')[1]);
const IN_SNAP = LOG.map((_, i) => (i < SNAP_V ? 'yes' : 'no'));

// the pieces, in the order they are written
const DATA = P.span('# The log, from the chapter', 'SNAPSHOT_VERSION = 7');
const FOLD = P.fn('fold');
const COMPACT = P.fn('compact');
const COLD = P.fn('cold_start');
const WARM = P.fn('warm_start');
const HARM = P.fn('gap_is_harmful');
const DROP = P.fn('compact_dropping_tombstones');
const EXTRA = P.span('# An empty log, a one-entry log', 'BIG_STALE = {');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const TBL = P.fn('_tbl');
const SHOW = P.fn('show_examples');
const MAIN = P.span('def main():', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 14 examples match a cold start exactly where the gap predicate says they must',
  "snapshot at version 7 = [('a', 16), ('b', 17)]   (2 entries for 7 changes)",
  "cold start, from entry 0        -> {'a': 30, 'b': 21}   10 entries read",
  "warm, subscribe from v=7        -> {'a': 30, 'b': 21}   5 entries read   (slack 0)",
  "warm, subscribe from NOW (v=9)  -> {'a': 30, 'b': 17}   3 entries read   (slack -2: a gap)",
  "warm, subscribe from v=5        -> {'a': 30, 'b': 21}   7 entries read   (slack 2: an overlap)",
  'the cache then served b=17 forever', "-> {'a': 24, 'b': 21}  (b is back)",
  'keys never repeat, max overlap          5      5      0      5        5 keys, a=1     10      5  warm LOSES',
  '59360 random gaps', '44.7% of gaps leave', 'a compacted snapshot reads 50 -- 400x less', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch06_v2.out no longer prints "${s}" — rewrite the narration`);
if (LOG.join(' ') !== 'a=5 a=8 b=7 a=10 a=16 b=8 b=17 b=21 a=24' || SNAP_V !== 7)
  throw new Error('programs/ch06_v2.py no longer has the log this deck explains — rewrite the narration');

module.exports = {
  title: 'The Stale Cache',
  eyebrow: 'Streaming · Ch 6 · Part 5',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['service', 'cache', 'key', 'entry', 'log', 'version', 'snapshot', 'subscribe', 'function', 'fold',
    'compaction', 'tombstone', 'cold start', 'warm start', 'gap', 'overlap', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 6 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 6 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 6 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 6 · Variation 2, the cache')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['service', 'cache', 'key', 'entry', 'log', 'version', 'snapshot'],
      eyebrow: '01 · A Google interview question, Variation 2',
      heading: 'A cache restarts, and must not come back stale',
      hero: { step: 0, text: 'A <b>service</b> — a program that runs all day answering reads — keeps an in-memory copy of a table, a <b>cache</b>. Two values, named by <b>keys</b> “a” and “b”, change over time; each change is an <b>entry</b> saying what a key became. The entries in order are the <b>log</b>: <code>a=5 a=8 b=7 a=10 a=16 b=8 b=17 b=21 a=24</code>.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'entries in the log[[src:vars]]' },
        { step: 1, value: SNAP_V, label: 'the version the snapshot on disk was taken at[[src:vars]]' },
        { step: 2, value: 30, label: 'the new value of “a” that arrives during the restart[[src:vars]]' },
        { step: 2, value: 21, label: 'what “b” must read after the restart[[src:vars]]' }
      ],
      cardsLabel: 'What the service must do on restart',
      cards: [
        { step: 3, n: 1, title: 'Start cheap', text: 'Load the snapshot instead of replaying every entry.' },
        { step: 3, n: 2, title: 'Catch up', text: 'Follow the log from exactly the right place.' },
        { step: 4, n: 3, title: 'Never stale', text: 'End with the table a full replay would give: “a” 30, “b” 21.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A service, a program that runs all day answering reads, keeps an in-memory copy of a table, called a cache. Each change is an entry saying what a key became; the entries in order are the log.',
        'The log has 9 entries. Version 7 means the state after the first 7 entries. A snapshot on disk, a saved copy of the table, was taken at version 7: “a” 16 and “b” 17.',
        'The service restarts. While it is coming back up, a new entry arrives: “a” becomes 30. Afterwards “b” must read 21, its last value in the log.',
        'So on restart it must start cheaply, from the snapshot, and then catch up by following the log from exactly the right place.',
        'And it must end with the table a full replay would give: “a” 30, “b” 21. Getting the right place wrong is the whole problem, and it is silent.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'The snapshot is two entries behind',
      stand: 'The snapshot holds the state at version 7: “a” 16, “b” 17. After it, the log still has b=21 and a=24, and then the live a=30 arrives.',
      question: { step: 0, prompt: 'After loading the snapshot, which entries must the service still apply?', options: [
        { text: 'The last two of the log, then the live one: b becomes 21, a becomes 24, a becomes 30.', correct: true, why: 'Those are exactly the entries written after version 7. Skipping any leaves the cache behind.' },
        { text: 'Only the live one, a becomes 30, since the rest is history.', correct: false, why: 'Then “b” never hears that it became 21. The cache answers 17 forever.' },
        { text: 'All nine entries again, then the live one.', correct: false, why: 'That is correct, but it throws away the point of the snapshot: a full replay.' } ] },
      cards: [
        { step: 1, title: 'The edge matters', html: '<p>The snapshot covers entries up to version 7. Everything written after it must be applied, and nothing may be skipped.[[src:vars]]</p>' },
        { step: 2, title: 'Re-reading is harmless', html: '<p>Each entry says what a key <b>became</b>, so applying one twice gives the same result. Reading too early costs time; reading too late costs correctness.[[src:vars]]</p>' }
      ],
      narration: [
        'Try a small case. The snapshot holds the state at version 7: “a” 16, “b” 17. Which entries must the service still apply after loading it? Choose an answer.',
        'The last two of the log, and then the live one: “b” becomes 21, “a” becomes 24, then “a” becomes 30. Skip any of them and the cache is behind.',
        'One comfort: each entry says what a key became, so applying one twice gives the same result. Starting too early costs time. Starting too late costs correctness.'
      ]
    },

    /* ---------- 3 · the edge, animated ---------- */
    {
      title: 'Edge', layout: 'array', defines: ['subscribe'],
      eyebrow: '03 · Watch the snapshot’s edge',
      heading: 'Which entries the snapshot already contains',
      stand: 'Top row: the version each entry starts from. Then the entry, and whether the snapshot taken at version 7 already contains it.',
      array: {
        labelWidth: 170, slotLabel: 'version',
        rows: [ { label: 'entry', values: LOG }, { label: 'in the snapshot?', values: IN_SNAP } ],
        meters: ['entries checked', 'still to apply'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 2, do: 'pick', slots: [SNAP_V, SNAP_V + 1] }
        ]
      },
      cards: [
        { step: 1, title: '7 folded into 2', html: '<p>The snapshot stands in for the first 7 entries with just 2: a=16, b=17.[[src:vars]]</p>' },
        { step: 2, title: 'Subscribe from 7', html: '<p>To <b>subscribe</b> from a version is to start reading the live log there. The snapshot’s version is where reading must begin.[[src:model]]</p>' }
      ],
      narration: [
        'Here is the log, one entry per slot. The top row is the version each entry starts from, and the second row says whether the snapshot, taken at version 7, already contains it.',
        'Watch the pointer check each entry. Seven are already in the snapshot, folded into just two values. Two are not: “b” becomes 21 and “a” becomes 24.',
        'Starting to read the live log at some version is called subscribing from it. Here the service must subscribe from version 7, the snapshot’s own version, so those two entries are applied.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['tombstone'],
      eyebrow: '04 · Writing the program · the log and the snapshot',
      heading: 'The log, the live change, and the snapshot version',
      stand: 'The program starts with the data.',
      question: { step: 0, prompt: 'Why is the snapshot at version 7, not at the end of the log?', options: [
        { text: 'A real snapshot is written now and then, so it is always somewhat behind.', correct: true, why: 'Nobody writes a snapshot at the instant of every change. Being behind is the normal case.' },
        { text: 'To make the example harder than it really is.', correct: false, why: 'It is the realistic case. A snapshot exactly at the end would hide the whole problem.' },
        { text: 'Because versions 8 and 9 were never written.', correct: false, why: 'They were written: “b” 21 and “a” 24 are in the log. The snapshot just predates them.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch06_v2.py · the data' }),
      cards: [ { step: 2, title: 'Four names', html: '<p><code>LOG</code>: the 9 entries. <code>LIVE</code>: a=30, arriving during start-up. <code>TOMBSTONE</code>: <code>None</code>, an entry meaning “this key is gone”. <code>SNAPSHOT_VERSION</code>: 7.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. Why is the snapshot at version 7 and not at the end of the log? Choose an answer.',
        'Because a real snapshot is written every so often, not at every change, so it is always somewhat behind. Here are the lines: the log, the live change, and the snapshot version.',
        'Two markers are set up too. None stands for an entry meaning a key is gone, called a tombstone. And a separate marker means a key is simply absent, which is a different thing.'
      ]
    },

    /* ---------- 5 · fold and compact ---------- */
    {
      title: 'Fold', layout: 'code', defines: ['function', 'fold', 'compaction'],
      eyebrow: '05 · Writing the program · what a snapshot is',
      heading: 'A snapshot is a compacted log',
      stand: 'Two functions, named recipes, that the rest of the program uses: one builds a table from entries, one shortens a log.',
      question: { step: 0, prompt: 'What makes the snapshot a legal place to start from?', options: [
        { text: 'Folding it gives the same table as folding every entry up to its version.', correct: true, why: 'It keeps the last entry per key, and only earlier, replaced entries were dropped.' },
        { text: 'It is smaller than the log.', correct: false, why: 'Small is not enough. A snapshot missing a key would be small and wrong.' },
        { text: 'It was written to disk safely.', correct: false, why: 'Safe storage says nothing about whether its contents match the log.' } ] },
      code: P.build({ before: [DATA], add: [FOLD, COMPACT], step: 1 }),
      cards: [ { step: 2, title: 'Fold, compaction, tombstone', html: '<p><code>fold</code> applies entries in order, later replacing earlier; a <b>tombstone</b> entry (<code>None</code>) removes its key. <code>compact</code> keeps the last entry per key: <b>compaction</b>, and the tombstone is kept.[[src:model]]</p>' } ],
      narration: [
        'Two functions come next: named recipes the rest of the program uses. What makes the snapshot a legal place to start from? Choose an answer.',
        'Folding it gives the same table as folding every entry up to its version. Here is fold: it applies entries in order, a later one replacing an earlier one, and an entry of None, a tombstone, removes its key.',
        'And here is compact: it keeps the last entry per key, which is called compaction. The tombstone is an entry like any other, so it is kept. A snapshot is exactly a compacted log.'
      ]
    },

    /* ---------- 6 · cold start ---------- */
    {
      title: 'Cold', layout: 'code', defines: ['cold start'],
      eyebrow: '06 · Writing the program · the slow, safe restart',
      heading: 'Replay everything from the first entry',
      stand: 'Before the clever version, the obvious one — which later checks everything else.',
      question: { step: 0, prompt: 'What is the simplest restart that is always correct?', options: [
        { text: 'Fold every entry ever written, then the live ones.', correct: true, why: 'Nothing can be missed, because nothing is skipped. It is just slow.' },
        { text: 'Load the snapshot and stop there.', correct: false, why: 'Then the last two entries and the live one are never applied: the cache is stale from the start.' },
        { text: 'Start with an empty table and wait for live changes.', correct: false, why: 'Keys that do not change again would never appear at all.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT], add: [COLD], step: 1 }),
      cards: [ { step: 2, title: 'Correct, and 10 reads', html: '<p>A <b>cold start</b> reads every entry: 9 from the log plus 1 live = <b>10 entries</b>, giving {a: 30, b: 21}. It is the reference every other answer is checked against.[[src:vars]]</p>' } ],
      narration: [
        'Before the clever restart, the obvious one. What is the simplest restart that is always correct? Choose an answer.',
        'Fold every entry ever written, then the live ones. Here it is: it joins the log and the live entries and folds them all. This is called a cold start.',
        'It reads 10 entries, 9 from the log and 1 live, and gives “a” 30 and “b” 21. It is slow on a long log, but it is the reference everything else is checked against.'
      ]
    },

    /* ---------- 7 · warm start ---------- */
    {
      title: 'Warm', layout: 'code', defines: ['warm start'],
      eyebrow: '07 · Writing the program · the fast restart',
      heading: 'Load the snapshot, then follow the log',
      stand: 'The fast restart folds the snapshot, then applies the log from some version on. That version is the one decision that matters.',
      question: { step: 0, prompt: 'Having loaded the snapshot taken at version 7, from which version should the service subscribe?', options: [
        { text: 'Version 9, “now”: history is in the snapshot already.', correct: false, why: 'Versions 7 and 8 are in neither the snapshot nor the future. “b becomes 21” would never be applied.' },
        { text: 'Version 7, the snapshot’s own: no earlier, no later.', correct: true, why: 'Everything before 7 is in the snapshot; everything from 7 on is read. Nothing missed, nothing extra.' },
        { text: 'Version 0, to be completely safe.', correct: false, why: 'Correct, but it reads the whole history again, which is what the snapshot was for.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT, COLD], add: [WARM], step: 1 }),
      cards: [ { step: 2, title: 'Warm start, and slack', html: '<p>A <b>warm start</b> folds the snapshot, then the tail from <code>subscribe_from</code>. It returns the table, the entries read, and the <i>slack</i>: positive for re-reading, negative for skipping. From 7: <b>5 entries</b>, slack 0.[[src:vars]]</p>' } ],
      narration: [
        'The fast restart folds the snapshot and then follows the log. Having loaded the snapshot taken at version 7, from which version should it subscribe? Choose an answer.',
        'Version 7, the snapshot’s own. Here is the function: it compacts the log up to the snapshot version, folds it, then applies every entry from the subscribe point, and the live ones. This is a warm start.',
        'From version 7 it reads 5 entries instead of 10 and gets the right table. It also reports the slack: positive when it re-reads entries, negative when it skips some.'
      ]
    },

    /* ---------- 8 · question: subscribing from now ---------- */
    {
      title: 'Now', layout: 'ask', defines: ['gap', 'overlap'],
      eyebrow: '08 · Your turn · the plausible bug',
      heading: 'Subscribe from “now”',
      stand: 'A developer writes the restart to load the snapshot taken at version 7, then subscribe from version 9: “just follow new changes from now on”.',
      question: { step: 0, prompt: 'What does the cache then hold for key “b”?', options: [
        { text: '17, forever: the entry “b becomes 21” was never read.', correct: true, why: 'Entry 7 sits after the snapshot and before “now”. Nobody applies it, and no later entry for “b” arrives.' },
        { text: '21: the cache catches up eventually.', correct: false, why: 'It only catches up if another entry for “b” arrives. Until then it is wrong, with no warning.' },
        { text: 'Nothing: “b” disappears from the cache.', correct: false, why: '“b” is in the snapshot with 17. It does not disappear; it just stays out of date.' } ] },
      columns: 2,
      cards: [
        { step: 1, title: 'A gap', html: '<p>Subscribing later than the snapshot’s version skips entries: a <b>gap</b>. Here it skips b=21 and a=24; the live a=30 hides the second, but “b” stays at 17.[[src:vars]]</p>' },
        { step: 2, title: 'An overlap is harmless', html: '<p>Subscribing earlier re-reads entries: an <b>overlap</b>. From version 5, 7 entries read and the table is still right. The safe direction is backwards.[[src:vars]]</p>' }
      ],
      narration: [
        'A developer writes the restart to subscribe from version 9, “now”, after loading the snapshot from version 7. What does the cache then hold for key “b”? Choose an answer.',
        '17, forever. The entry “b becomes 21” lies after the snapshot but before now, so nobody applies it. Skipping entries like this is called a gap, and the cache answers every read with a stale value.',
        'Subscribing too early instead re-reads some entries, an overlap. From version 5 it reads 7 entries and the table is still right, because applying an entry twice changes nothing.'
      ]
    },

    /* ---------- 9 · the cases ---------- */
    {
      title: 'Cases', layout: 'table',
      eyebrow: '09 · Every subscribe point, measured',
      heading: 'Early costs reads; late costs correctness',
      stand: 'What the program prints for the snapshot taken at version 7, with the live a=30.',
      table: {
        columns: ['Restart', 'Table it ends with', 'Entries read', 'Verdict'],
        rows: [
          { step: 0, cells: ['cold start, from entry 0', 'a=30 b=21', '10', 'correct, slow'] },
          { step: 1, cells: ['subscribe from 7', 'a=30 b=21', '5', '<b>correct</b>'] },
          { step: 1, cells: ['subscribe from 6 · overlap', 'a=30 b=21', '6', 'correct'] },
          { step: 2, cells: ['subscribe from 8 · gap', 'a=30 <b>b=17</b>', '4', '<b>stale</b>'] },
          { step: 2, cells: ['subscribe from 9 · “now”', 'a=30 <b>b=17</b>', '3', '<b>stale</b>'] }
        ]
      },
      side: { step: 3, title: 'Silent', html: '<p>The stale cache answers every read confidently. No read can tell b=17 from a right answer, so nothing ever notices.[[src:vars]]</p>' },
      narration: [
        'Here is what the program measures. A cold start reads 10 entries and is correct.',
        'Subscribing from 7, the snapshot’s version, reads 5 and is correct. From 6, one entry of overlap, it reads 6 and is still correct.',
        'From 8, one entry of gap, it reads 4 and “b” is stuck at 17. From 9, “now”, it reads only 3, and is just as wrong. The cheapest restart is the broken one.',
        'And nothing notices. The stale cache answers every read confidently, and no read can tell 17 from a right answer.'
      ]
    },

    /* ---------- 10 · when is a gap harmful ---------- */
    {
      title: 'Harm', layout: 'code',
      eyebrow: '10 · Writing the program · predicting the damage',
      heading: 'When a skipped entry leaves no trace',
      stand: 'The subscribe-from-9 restart skipped two entries, but only “b” came out wrong. Why not “a”?',
      question: { step: 0, prompt: 'A gap skipped “a becomes 24”, yet “a” ends right. When is a skipped entry harmless?', options: [
        { text: 'When a later entry that is applied replaces the same key.', correct: true, why: 'The live “a becomes 30” replaced whatever “a” held, so the skipped 24 no longer mattered.' },
        { text: 'When the skipped value is smaller than the snapshot’s.', correct: false, why: 'Size has nothing to do with it. A newer entry replaces a value whatever its size.' },
        { text: 'Never: every skipped entry corrupts the cache.', correct: false, why: '“a” proves otherwise: it skipped 24 and still ended at the right 30.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT, COLD, WARM], add: [HARM], step: 1 }),
      cards: [ { step: 2, title: 'Why gaps survive testing', html: '<p>A skip is harmful exactly when no later applied entry overwrites that key <b>and</b> the snapshot’s value differs. Most skips get overwritten soon after, so a quick test often passes.[[src:vars]]</p>' } ],
      narration: [
        'The restart from version 9 skipped two entries, but only “b” came out wrong. When is a skipped entry harmless? Choose an answer.',
        'When a later entry that is applied replaces the same key. The live “a becomes 30” covered the skipped 24. Here is the function that predicts this, key by key.',
        'A skip is harmful exactly when nothing applied later overwrites that key, and the snapshot’s value differs. Because many skips are overwritten soon after, a quick test often passes.'
      ]
    },

    /* ---------- 11 · the tombstone ---------- */
    {
      title: 'Tomb', layout: 'code',
      eyebrow: '11 · Writing the program · a delete, at restart',
      heading: 'Treat a delete as an absence, and the key comes back',
      stand: 'Now “b” is deleted: a tombstone is appended to the log. The snapshot is built by compaction.',
      question: { step: 0, prompt: 'A careless compaction keeps the last entry per key that is NOT a tombstone. What happens to “b” at the next restart?', options: [
        { text: 'It comes back with its old value, 21.', correct: true, why: 'The delete was skipped as if it were not there, so the last real value of “b” is what the snapshot keeps.' },
        { text: 'It stays deleted: the log still has the tombstone.', correct: false, why: 'The restart reads the snapshot, not the full log. The snapshot no longer has the delete.' },
        { text: 'The restart stops with an error.', correct: false, why: 'Nothing fails. The snapshot is perfectly readable; it is just wrong.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT, COLD, WARM, HARM], add: [DROP], step: 1 }),
      cards: [ { step: 2, title: 'The delete is a fact', html: '<p>Kept, the tombstone gives {a: 24}. Dropped, “b is back”: {a: 24, b: 21}. The damage shows only after a restart.[[src:vars]]</p>' } ],
      narration: [
        'Now “b” is deleted with a tombstone. A careless compaction keeps the last entry per key that is not a tombstone. What happens to “b” at the next restart? Choose an answer.',
        'It comes back with 21. Here is that careless compaction: it skips tombstones, treating a delete as if it never happened, so the last real value of “b” survives.',
        'With the tombstone kept, the table is “a” 24 alone. Dropped, “b” is back with 21. The delete was a fact, and the damage only shows after a restart.'
      ]
    },

    /* ---------- 12 · the worked examples ---------- */
    {
      title: 'Rows', layout: 'code', defines: ['assert'],
      eyebrow: '12 · Writing the program · the worked examples',
      heading: 'Fourteen cases, each checked against a cold start',
      stand: 'Inputs for the examples table, the table itself, and the function that prints and asserts every row.',
      question: { step: 0, prompt: 'In one row the keys never repeat (a=1, b=2 … e=5), the snapshot is at 5 and the service subscribes from 0. Why does the warm start read MORE than a cold start?', options: [
        { text: 'Compaction drops nothing, and the overlap reads the whole log again.', correct: true, why: 'The snapshot is as long as the log, then all 5 entries are read again: 10 reads against 5.' },
        { text: 'The snapshot is wrong for logs with many keys.', correct: false, why: 'The snapshot is right; the table comes out correct. Only the cost is worse.' },
        { text: 'Warm starts are always slower on small logs.', correct: false, why: 'On the chapter’s log the warm start reads 5 against 10. It is the overlap that costs.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT, COLD, WARM, HARM, DROP], add: [EXTRA, EXAMPLES, TBL, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Asserted, not described', html: '<p>Every row is asserted against a cold start: <b>all 14 examples match</b>. One row reads 10 against 5: “warm LOSES”.[[src:vars]]</p>' } ],
      narration: [
        'Next, the worked examples, each one asserted: checked, with the program stopping if it is false. In one, the keys never repeat, and the service subscribes from 0 after a snapshot at 5. Why does the warm start read more than a cold one? Choose an answer.',
        'Compaction drops nothing when no key repeats, so the snapshot is as long as the log, and then the overlap reads all of it again: 10 reads against 5.',
        'Here are the inputs, the table of 14 examples, and the function that prints them. Each row is asserted against a cold start, and all 14 match.'
      ]
    },

    /* ---------- 13 · main ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · the checks',
      heading: 'Run every restart, and measure the random ones',
      stand: 'The main part prints each restart and asserts its claims: a check that stops the program if false. Then it tries 1,500 random logs.',
      question: { step: 0, prompt: 'Across random logs, 44.7% of gaps leave no trace in the table. What does that mean for a test that restarts the service and compares?', options: [
        { text: 'It passes about half the time, so the bug can ship.', correct: true, why: 'Nearly half of all gaps happen to be overwritten, and a test that only compares tables cannot see them.' },
        { text: 'It always catches the bug.', correct: false, why: 'It catches only the gaps that change the table: 32849 of 59360.' },
        { text: 'Gaps are rare, so the test does not matter.', correct: false, why: 'Most gaps are harmful. The danger is that the test misses so many of them.' } ] },
      code: P.build({ before: [DATA, FOLD, COMPACT, COLD, WARM, HARM, DROP, EXTRA, EXAMPLES, TBL, SHOW], add: [MAIN], step: 1 }),
      cards: [ { step: 2, title: 'And at scale', html: '<p>20,000 changes over 50 keys: a cold start reads 20,000 entries, a compacted snapshot reads 50: <b>400x less</b>. That is why the snapshot exists.[[src:vars]]</p>' } ],
      narration: [
        'The main part runs every restart and asserts each claim. Across random logs, 44.7 percent of gaps leave no trace in the table. What does that mean for a restart-and-compare test? Choose an answer.',
        'It passes about half the time, so the bug ships. Here is main: the named restarts and their checks, the delete inside a gap, both compactions, and 59,360 random gaps checked against the predicate.',
        'And the scale that justifies all this: 20,000 changes over 50 keys, a cold start reads 20,000 entries, and a compacted snapshot reads 50. 400 times less.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. The opening text defines every word before the code uses it.',
      question: { step: 0, prompt: 'Which single number must a correct warm start carry from the snapshot into the subscription?', options: [
        { text: 'The snapshot’s version.', correct: true, why: 'Subscribing from it, or earlier, is safe; subscribing later leaves a gap.' },
        { text: 'The number of keys.', correct: false, why: 'The key count says how big the snapshot is, not where reading must resume.' },
        { text: 'The time of the restart.', correct: false, why: 'That is “now”, the plausible bug: it skips everything written since the snapshot.' } ] },
      code: P.whole(),
      cards: [ { step: 1, title: 'From top to bottom', html: '<p>The words; the data; fold and compact; the cold and warm starts; the gap predicate; the careless compaction; the examples; main.[[src:vars]]</p>' } ],
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Which single number must a correct warm start carry from the snapshot into the subscription? Choose an answer.',
        'The snapshot’s version. From the top: the words, the data, fold and compact, the cold and warm starts, the gap predicate, the careless compaction, the examples, and main.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'The overlap from version 5 read 7 entries; the correct handover read 5. What did those 2 extra reads change in the table?', options: [
        { text: 'Nothing: re-applying a “became” entry is the same as applying it once.', correct: true, why: 'That is why the safe direction is backwards: an overlap costs reads, never correctness.' },
        { text: 'They doubled the values of the re-read keys.', correct: false, why: 'That would happen for “plus” entries. These say what a key became, so repeating them is harmless.' },
        { text: 'They fixed a gap.', correct: false, why: 'There was no gap. The table was already correct from version 7.' } ] },
      code: OUT.whole('what python3 programs/ch06_v2.py prints'),
      cards: [ { step: 1, title: 'The last line', html: '<p><b>all assertions passed</b> — including that the gap is wrong on exactly “b”, and that the overlap changed nothing.[[src:vars]]</p>' } ],
      narration: [
        'And here is what it prints. The overlap from version 5 read 7 entries; the correct handover read 5. What did those 2 extra reads change in the table? Choose an answer.',
        'Nothing. Applying a “became” entry twice is the same as once. So an overlap costs reads, a gap costs correctness, and the safe direction is backwards. All assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'Start from the snapshot, subscribe from its version',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>fold</code>, <code>compact</code>', 'Entries → table; last entry per key. A snapshot is a compacted log.', '7 entries → 2'] },
          { step: 0, cells: ['<code>cold_start</code>', 'Replay everything: correct, slow, the reference.', '10 reads'] },
          { step: 1, cells: ['<code>warm_start</code>', 'Snapshot, then the log from its version.', '5 reads, correct'] },
          { step: 1, cells: ['gap · overlap', 'Late skips entries, silently; early re-reads, harmlessly.', 'b=17 forever · 7 reads'] },
          { step: 2, cells: ['<code>gap_is_harmful</code>', 'A skip shows only if nothing later overwrites it.', '44.7% leave no trace'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Variation 3: a regulator asks what a record held two years ago — and the log was compacted last year.[[src:vars]]</p>' },
      narration: [
        'To recap. Fold and compact: a snapshot is just a compacted log. A cold start replays everything: correct, slow, and the reference for every check.',
        'A warm start loads the snapshot and subscribes from its version. Subscribing later is a gap that leaves “b” at 17 forever; subscribing earlier is a harmless overlap.',
        'And a gap shows only when nothing later overwrites the skipped key, which is why nearly half of them pass a restart test.',
        'Next, variation 3: a regulator asks what a record held two years ago, and the log was compacted last year.'
      ]
    }
  ]
};
