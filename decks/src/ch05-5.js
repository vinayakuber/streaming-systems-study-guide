// Chapter 5, Part 5 — Variation 2 of the interview question ("the file that is half
// uploaded"), built as a program WITH the viewer. Every code slide asks what the next piece
// must do, then reveals the real lines from programs/ch05_v2.py (read at build time by
// _prog.js, addressed by content, never by line number). The chunks and every crash point are
// animated; the last slides show the whole file and what it prints (programs/ch05_v2.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch05';
const P = program('ch05_v2.py');
const OUT = program('ch05_v2.out');
const upto = needle => P.at(needle) - 1;

// the chunks, read from the program itself so the slides cannot drift from it
const CHUNKS = JSON.parse(P.lines[P.at('CHUNKS = ["aaaaa"')].split('=')[1]);
const SIZES = CHUNKS.map(c => c.length);
const SIZE = SIZES.reduce((a, b) => a + b, 0);
const PREFIX = SIZES.map((_, k) => SIZES.slice(0, k).reduce((a, b) => a + b, 0));        // bytes up before chunk k

// the pieces, in the order they are written
const DATA = P.span('CHUNKS = ["aaaaa"', 'FINAL, TEMP = "backup", "backup.tmp"');
const A_DOC = [P.at('def attempt('), P.at('    moved = 0')];
const A_NAME = P.span('    name = TEMP if policy == "rename" else FINAL', '    name = TEMP if policy == "rename" else FINAL');
const A_LOOP = [P.at('    for i in range(start, len(chunks)):'), P.at('        moved += len(chunks[i])')];
const A_END = [P.at('    if crash_at == len(chunks):'), P.at('store[FINAL] = store.pop(TEMP)') + 3];
const A_RECFIRST = [P.at('    if policy == "record_first":'), P.at('    if policy == "record_first":') + 3];
const A_RESUME = [P.at('    if resume:'), P.at('            start += 1')];
const A_ELSE = [P.at('            start += 1') + 1, P.at('        store.pop(name, None)') + 1];
const A_CREATE = [P.at('# the staging file is CREATED before any bytes are written') - 1, P.at('store.setdefault(name, "")')];
const VISIBLE = P.fn('visible');
const NIGHTS = [P.at('def one_night('), P.block('def until_done(')[1]];
const CROSS = P.fn('cross_store');
const EXTRA = P.span('# An older file left in the staging slot', 'MID = len(BIG_CHUNKS) // 2');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SHOW = P.fn('show_examples');
const MAIN1 = [P.at('def main():'), upto('# ---- what the rename costs')];
const MAIN2 = [P.at('# ---- what the rename costs'), P.lines.length - 1];

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 19 examples agree with the rule they claim to implement',
  "the finished file is 45 bytes: 'aaaaabbbcccccccddeeeeeefggggggggghhhhiiiiiiii'",
  'rename: at all 10 crash points and on the uninterrupted run, the visible file is', 'absent or the full 45 bytes.',
  'direct: 8 of the 10 crash points leave a partial file under the real',
  'record_first: 9 of the 10 crash points leave the record saying SUCCESS with',
  'killed at chunk 3 three nights running, then succeeding: 4 attempts and', '90 bytes transferred for a 45-byte file.',
  'resuming from the temporary file instead: 45 bytes',
  "resuming  -> 45 bytes, CORRUPT: 'XXXXXXXXXXXXXXXddeeeeeefggggggggghhhhiiiiiiii'",
  '8 crash points again leave a partial object under the real name.',
  "boundaries: an empty backup commits as a zero-byte file -- '' is not",
  '5,000 chunks, rename, killed midway       5000        rename   2500      absent False    29992   19995',
  'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch05_v2.out no longer prints "${s}" — rewrite the narration`);
if (SIZE !== 45 || SIZES.join() !== '5,3,7,2,6,1,9,4,8' || PREFIX[1] !== 5 || PREFIX[3] !== 15 || PREFIX[8] !== 37)
  throw new Error('programs/ch05_v2.py no longer has the chunks this deck explains — rewrite the narration');

const W = (...pieces) => pieces;
const ATT = [A_DOC, A_NAME, A_ELSE, A_LOOP, A_END];
const CRASHES = [...SIZES.map((_, k) => `chunk ${k}`), 'after all 9', 'no crash'];
const directShows = [...PREFIX.map(b => (b === 0 ? 'nothing' : `${b} of 45`)), 'all 45', 'all 45'];
const directPartial = directShows.map(v => (v.endsWith('of 45') ? 'yes' : 'no'));
const renameShows = [...SIZES.map(() => 'nothing'), 'nothing', 'all 45'];

module.exports = {
  title: 'The Half-Uploaded Backup',
  eyebrow: 'Streaming · Ch 5 · Part 5',
  ...shared,
  jargon: ['backup', 'chunk', 'byte', 'upload', 'record', 'restore', 'crash', 'partial', 'pair', 'function',
    'staging name', 'rename', 'commit', 'resume', 'bucket'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 5 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 5 · how to model it'),
    var:   section(CH, 'The same problem, asked 3 other ways', 'Chapter 5 · variation 2, the half-uploaded file')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['backup', 'chunk', 'byte', 'upload', 'record', 'restore', 'crash'],
      eyebrow: '01 · Variation 2 of the interview question',
      heading: 'A nightly backup, killed halfway through',
      hero: { step: 0, text: 'Every night a job copies a large file, a <b>backup</b>, to a file store, sending it in pieces called <b>chunks</b> — an <b>upload</b>. Then, in a different system, it writes a <b>record</b> saying the backup succeeded. A <b>restore</b> later reads the backup back. The job can <b>crash</b> — be killed — at any moment.[[src:var]]' },
      tiles: [
        { step: 1, value: 9, label: 'chunks in our file[[src:var]]' },
        { step: 1, value: SIZE, label: 'bytes when complete — a byte is one letter here[[src:var]]' },
        { step: 2, value: 8, label: 'crash points that leave a half file, written directly[[src:var]]' },
        { step: 2, value: 0, label: 'crash points that leave a half file, with the fix[[src:var]]' }
      ],
      cardsLabel: 'The two rules',
      cards: [
        { step: 3, n: 1, title: 'No restore may read a half file', text: 'A truncated backup restores a broken database.' },
        { step: 3, n: 2, title: 'No record may claim a missing backup', text: 'Nobody would notice until the day it is needed.' },
        { step: 4, n: 3, title: 'And no shared transaction', text: 'The file store and the record are different systems.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each code slide asks what the next piece must do; then the real lines appear.[[src:var]]' },
      narration: [
        'Every night a job copies a large file, a backup, to a file store, sending it in pieces called chunks. That is an upload. Then, in a different system, it writes a record saying the backup succeeded. A restore later reads the backup back.',
        'Our file has 9 chunks, and is 45 bytes long when complete. Here, one byte is one letter.',
        'Written the obvious way, 8 of the possible crash points leave half a file where a restore will find it. With the fix we will build, none do.',
        'The rules: no restore may ever read a half file, and no record may ever claim a backup that is not there.',
        'And the trick from the main question, one transaction, is not available: the file store and the record are different systems. We will write the program together.'
      ]
    },

    /* ---------- 2 · a small case first ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['partial'],
      eyebrow: '02 · Your turn · a small case first',
      heading: 'Killed after the first chunk',
      stand: 'The job writes each chunk straight into the file’s real name, “backup”, then sets the record. It is killed just before chunk 1, after chunk 0 (“aaaaa”) was written.',
      question: {
        step: 0,
        prompt: 'What does a restore read from “backup” afterwards?',
        options: [
          { text: 'A file of 5 bytes, “aaaaa”, which looks like a backup.', correct: true,
            why: 'Chunk 0 landed under the real name. A restore reads whatever is there, and cannot tell it is unfinished.' },
          { text: 'Nothing, because the record was never set.', correct: false,
            why: 'A restore reads the file store, not the record. The 5 bytes are sitting under the real name.' },
          { text: 'The whole 45-byte file, because the job restarts.', correct: false,
            why: 'Only if the job runs again and finishes. Until then, a restore gets the 5 bytes.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A partial file', html: '<p>Some leading bytes of the backup, but not all, is a <b>partial</b> file. It is the one outcome that must never happen: it restores a truncated database, silently.[[src:var]]</p>' },
        { step: 2, title: 'The same two writes', html: '<p>The upload and the record are two writes, like the queue worker’s result and position. And again, no transaction can hold both.[[src:var]]</p>' }
      ],
      narration: [
        'Before any code, try one case. The job writes chunks straight into the real name, backup. It is killed after chunk 0, five letters a, was written. What does a restore read? Choose an answer.',
        'A 5-byte file that looks like a backup. Some leading bytes but not all is called a partial file. It is the one outcome that must never happen: it restores a broken database, silently.',
        'It is the same shape as the main question: two writes, the upload and the record, and no transaction that can hold both.'
      ]
    },

    /* ---------- 3 · the chunks, animated ---------- */
    {
      title: 'Chunk', layout: 'array',
      eyebrow: '03 · Watch the file being uploaded',
      heading: 'Nine chunks, forty-five bytes',
      stand: 'Each column is one chunk, in upload order. The chunk lengths are the main question’s nine item values.',
      array: {
        labelWidth: 170, slotLabel: 'chunk',
        rows: [ { label: 'letters', values: CHUNKS.map(c => `${c[0]} × ${c.length}`) }, { label: 'bytes', values: SIZES } ],
        meters: ['chunks sent', 'bytes uploaded'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 280 }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A partial file at every stop', html: '<p>Stop the sweep anywhere before the end and the bytes uploaded so far — 5, 8, 15, 17 … 37 — are a partial file.[[src:var]]</p>' },
        { step: 2, title: 'Each chunk its own letter', html: '<p>A chunk that looked like its neighbour would let a cut-short or doubled upload pass a check of the content.[[src:var]]</p>' }
      ],
      narration: [
        'Here are the nine chunks, in upload order: five letters a, three letters b, and so on. Their lengths are the main question’s nine item values.',
        'Watch the upload. Nine chunks sent, and the bytes climb to 45. Stop anywhere before the end, and what is uploaded so far is a partial file.',
        'Notice each chunk is its own letter. A chunk that looked like its neighbour would let a cut-short or doubled upload pass a check of the content.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['pair', 'function'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'The chunks, and two names',
      stand: 'A program is written top to bottom. It starts with the file, and the names it can be written under.',
      question: { step: 0, prompt: 'A restore always reads the name “backup”. Why might the program also need a second name?', options: [
        { text: 'To write the upload somewhere a restore never looks.', correct: true, why: 'A name nothing reads can hold a half file safely. That is the idea we will build on.' },
        { text: 'To keep two copies of every backup.', correct: false, why: 'Copies double the storage and still leave the real name half written during the upload.' },
        { text: 'Because file stores need two names per file.', correct: false, why: 'They do not. The second name is a choice made for safety.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch05_v2.py · the data' }),
      cards: [ { step: 2, title: 'Two names', html: '<p><code>COMPLETE</code> is the 45-byte file. <code>FINAL</code> is “backup”, what a restore reads; <code>TEMP</code> is “backup.tmp”, which nothing ever reads. Each piece below is a <b>function</b>, a named recipe; some return <b>pairs</b> of values.[[src:var]]</p>' } ],
      narration: [
        'First, the data. A restore always reads the name backup. Why might the program also need a second name? Choose an answer.',
        'To write the upload somewhere a restore never looks. Here are the lines: the nine chunks, the complete file of 45 bytes, and two names, the real one and a temporary one that nothing reads.',
        'Everything after this is written as functions, named recipes that take inputs and give back an answer. Some give back pairs, two values kept together.'
      ]
    },

    /* ---------- 5 · the direct upload ---------- */
    {
      title: 'Naive', layout: 'code',
      eyebrow: '05 · Writing the program · the obvious way',
      heading: 'Upload under the real name, then set the record',
      stand: 'One function runs one night’s job. The obvious policy: write each chunk to “backup”, then mark the record as done.',
      question: { step: 0, prompt: 'The job is killed after all 9 chunks are up but before the record is set. What is left?', options: [
        { text: 'A complete file, and a record still saying it failed.', correct: true, why: 'Every byte is there, but the second write never happened. A backup exists that nothing knows about.' },
        { text: 'A partial file, and no record.', correct: false, why: 'All nine chunks landed, so the file is complete. Only the record is missing.' },
        { text: 'Nothing: the crash undoes the upload.', correct: false, why: 'A crash undoes nothing. What was written stays written.' } ] },
      code: P.build({ before: W(DATA), add: ATT, step: 1 }),
      cards: [ { step: 2, title: 'The two failures of “direct”', html: '<p>Killed during the upload: a <b>partial</b> file under the real name. Killed after it: a complete file the record says failed — the harmless half of the same split. The loop returns the bytes moved, so cost is measured too.[[src:var]]</p>' } ],
      narration: [
        'Now one night’s job, the obvious way: write each chunk to the real name, then set the record. It is killed after all 9 chunks but before the record. What is left? Choose an answer.',
        'A complete file, and a record still saying it failed. Here is the function: pick the name, loop over the chunks stopping at the crash point, then set the record at the end.',
        'So direct has two failures. Killed during the upload, a partial file under the real name. Killed after it, a complete file nobody knows about, which is the harmless half.'
      ]
    },

    /* ---------- 6 · record first ---------- */
    {
      title: 'RecQ', layout: 'code',
      eyebrow: '06 · Writing the program · the obvious repair',
      heading: 'So set the record first?',
      stand: 'Swap the two writes: mark the backup as done, then upload.',
      question: { step: 0, prompt: 'With the record set first, the job is killed before chunk 1. What is the damage?', options: [
        { text: 'The record says success, and the file is 5 bytes.', correct: true, why: 'The record was written first, so it claims a backup that is not there. Nobody finds out until a restore.' },
        { text: 'None: the record shows the job ran.', correct: false, why: 'It shows the job started. It says nothing about whether the bytes arrived.' },
        { text: 'The record says failed, and the file is empty.', correct: false, why: 'The record was set to success before any chunk was sent.' } ] },
      code: P.build({ before: W(DATA, ...ATT), add: [A_RECFIRST], step: 1 }),
      cards: [ { step: 2, title: 'The ordering that loses data', html: '<p>At 9 of the 10 crash points — every point during the upload — the record says SUCCESS with no complete file behind it. It wastes nothing, and it loses backups.[[src:var]]</p>' } ],
      narration: [
        'The obvious repair is to swap the writes: set the record first, then upload. The job is killed before chunk 1. What is the damage? Choose an answer.',
        'The record says success, and the file is 5 bytes. Here are the lines: if the policy is record first, it marks the record, and a crash right then leaves nothing uploaded at all.',
        'At 9 of the 10 crash points, every one during the upload, the record claims a backup that is not there. Nobody finds out until a restore is attempted.'
      ]
    },

    /* ---------- 7 · the idea ---------- */
    {
      title: 'Idea', layout: 'ask', defines: ['staging name', 'rename', 'commit'],
      eyebrow: '07 · Your turn · the property the queue lacked',
      heading: 'What does this job control that the queue worker did not?',
      stand: 'The queue worker needed one transaction to make two writes into one. Here no transaction spans the file store and the record. But the job chooses the name it writes under.',
      question: {
        step: 0,
        prompt: 'How can choosing the name turn the whole upload into one instant?',
        options: [
          { text: 'Upload under a name nothing reads, then rename it to “backup” at the end.', correct: true,
            why: 'A rename is one step inside the store. Before it, a restore sees nothing; after it, the complete file.' },
          { text: 'Upload under “backup” faster, so a crash is less likely.', correct: false,
            why: 'Faster still has a middle. The crash can land there.' },
          { text: 'Upload twice under two names, and keep the longer.', correct: false,
            why: 'Both copies can be half written. Comparing lengths does not make either complete.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'A staging name', html: '<p>A temporary name that nothing ever reads, here “backup.tmp”, is a <b>staging name</b>. A half file there is invisible.[[src:var]]</p>' },
        { step: 1, title: 'A rename', html: '<p>Giving a stored file a new name is a <b>rename</b>. Inside one store it is a single step: the file appears all at once.[[src:var]]</p>' },
        { step: 2, title: 'The rename is the commit', html: '<p>The instant that makes the work count is the <b>commit</b>. Here it is the rename. No record is needed: the file’s existence is the record.[[src:var]]</p>' }
      ],
      narration: [
        'The queue worker needed a transaction to make two writes one. There is none here, but the job chooses the name it writes under. How can that turn the upload into one instant? Choose an answer.',
        'Upload under a name nothing reads, called a staging name, then give it the real name at the end, called a rename. Inside one store, a rename is a single step.',
        'The instant that makes the work count is called the commit, and here it is the rename. No record is needed at all: the file’s existence is the record.'
      ]
    },

    /* ---------- 8 · the rename in code ---------- */
    {
      title: 'Move', layout: 'code',
      eyebrow: '08 · Writing the program · the rename policy',
      heading: 'Stage, then rename',
      stand: 'The rename policy writes to the staging name, and renames it at the very end. A restore reads only the real name.',
      question: { step: 0, prompt: 'Killed with all 45 bytes staged, but before the rename ran. What does a restore read?', options: [
        { text: 'Nothing: the backup does not exist yet, which is correct.', correct: true, why: 'The commit has not happened. Losing that night’s backup is right; showing 45 unrenamed bytes would not be.' },
        { text: 'The complete file, since every byte is up.', correct: false, why: 'The bytes sit under the staging name, which a restore never reads.' },
        { text: 'A partial file, since the rename was cut off.', correct: false, why: 'A rename has no middle. It either happened or it did not.' } ] },
      code: P.build({ before: W(DATA, ...ATT, A_RECFIRST), add: [A_CREATE, VISIBLE], step: 1 }),
      cards: [ { step: 2, title: 'Created before any byte', html: '<p>The staging file is created empty first, so a zero-chunk backup still has something to rename. <code>visible</code> reads only the real name, exactly like a restore.[[src:var]]</p>' } ],
      narration: [
        'Now the fix. Killed with all 45 bytes staged, but before the rename ran. What does a restore read? Choose an answer.',
        'Nothing, and that is correct: the commit never happened. Here are the lines. The staging file is created empty before any chunk, and visible reads only the real name, just as a restore does.',
        'The rename itself was already in the function’s last lines: move the staging file to the real name. That one step is the commit.'
      ]
    },

    /* ---------- 9 · every crash point, animated ---------- */
    {
      title: 'Pts', layout: 'array',
      eyebrow: '09 · Watch every crash point',
      heading: 'Direct shows half files. Rename never does.',
      stand: 'Each column is one crash point: killed before that chunk, after all nine, or not at all. Each row is what a restore would read.',
      array: {
        labelWidth: 190, slotLabel: 'killed at',
        rows: [
          { label: 'crash point', values: CRASHES.map(c => c.replace('chunk ', '')) },
          { label: 'direct: restore reads', values: directShows },
          { label: 'direct: half file?', values: directPartial },
          { label: 'rename: restore reads', values: renameShows }
        ],
        meters: ['columns checked', 'half files shown'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 0, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [3] },
          { step: 2, do: 'pick', slots: [9] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Rename: nothing, or everything', html: '<p>At all 10 crash points a restore sees nothing; with no crash, the full 45 bytes. Nothing is ever half visible.[[src:var]]</p>' },
        { step: 2, title: 'The other side of the commit', html: '<p>“after all 9”: every byte uploaded, rename not run. Rename shows nothing; direct shows a complete file with a record still saying failed.[[src:var]]</p>' }
      ],
      narration: [
        'Each column is a crash point. The direct policy first: watch the sweep count the crash points where a restore would read a half file. Eight of them, from 5 bytes up to 37.',
        'Now the rename policy, same crash points. A restore reads nothing at every one of them, and the full 45 bytes only when nothing crashed.',
        'The highlighted column is the edge of the commit: every byte uploaded, rename not run. Rename correctly shows nothing. Nothing is ever half visible.'
      ]
    },

    /* ---------- 10 · what it costs ---------- */
    {
      title: 'Cost', layout: 'code', defines: ['resume'],
      eyebrow: '10 · Writing the program · the price of starting over',
      heading: 'Every crash throws the upload away',
      stand: 'The scheduler reruns the job after each crash. The rename policy starts the staging file from empty each time.',
      question: { step: 0, prompt: 'Killed at chunk 3 three nights running, then it succeeds. How many bytes were sent in all?', options: [
        { text: '90: 15 bytes thrown away three times, plus the 45 that finished.', correct: true, why: 'Chunks 0 to 2 are 15 bytes. Sent and discarded three times, plus one full 45-byte run.' },
        { text: '45: only the finished file counts.', correct: false, why: 'The discarded bytes were still sent across the network.' },
        { text: '60: one wasted attempt plus the finished file.', correct: false, why: 'There were three wasted attempts, each throwing away 15 bytes.' } ] },
      code: P.build({ before: W(DATA, ...ATT, A_RECFIRST, A_CREATE, VISIBLE), add: [A_RESUME, NIGHTS], step: 1 }),
      cards: [ { step: 2, title: 'Resume saves it', html: '<p>Continuing from the bytes already staged is to <b>resume</b>: <b>45</b> bytes in all instead of <b>90</b>. The saving is exactly the 45 bytes the restarts re-sent.[[src:var]]</p>' } ],
      narration: [
        'What does the fix cost? Killed at chunk 3 three nights running, then it succeeds. How many bytes were sent in all? Choose an answer.',
        'Ninety: 4 attempts, three of them throwing away 15 bytes each, plus the 45 that finished. Here are the lines that run one night, and that rerun the job until it completes.',
        'Continuing from the bytes already staged, instead of starting over, is called resuming. With resume the total is 45 bytes, not 90. But resuming has a catch.'
      ]
    },

    /* ---------- 11 · the stale staging file ---------- */
    {
      title: 'Stale', layout: 'ask',
      eyebrow: '11 · Your turn · the catch in resuming',
      heading: 'A leftover from someone else',
      stand: 'An earlier crash of a DIFFERENT upload left 15 bytes, “XXXXXXXXXXXXXXX”, in “backup.tmp”. Tonight’s job resumes from whatever is there.',
      question: {
        step: 0,
        prompt: 'What does tonight’s restore read after the job finishes?',
        options: [
          { text: 'A corrupt 45-byte file that starts with the 15 X’s.', correct: true,
            why: 'The job counts 15 bytes as its own first chunks, sends the rest, and renames. The result is the right size and the wrong content.' },
          { text: 'The correct file: the rename makes it right.', correct: false,
            why: 'The rename only makes the file appear at once. It cannot know the first 15 bytes came from another upload.' },
          { text: 'Nothing: the job notices the bytes are wrong.', correct: false,
            why: 'Resuming only counts how many bytes are there, not what they are.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Same size, so a length check passes', html: '<p>The corrupt file is 45 bytes, exactly like a good one. Starting from scratch gives the correct file; resuming gives this.[[src:var]]</p>' },
        { step: 2, title: 'A name nobody else reuses', html: '<p>Resuming is only safe if the staging name is unique to this attempt. The atomic step needs a name of its own.[[src:var]]</p>' }
      ],
      narration: [
        'Here is the catch. An earlier crash of a different upload left 15 bytes of X in the staging file. Tonight’s job resumes from whatever is there. What does the restore read? Choose an answer.',
        'A corrupt 45-byte file starting with the 15 X’s. It is exactly the size of a good backup, so a length check passes. Starting from scratch would have given the correct file.',
        'So resuming is only safe if the staging name is unique to each attempt. The one-step commit needs a name nobody else will reuse.'
      ]
    },

    /* ---------- 12 · two stores ---------- */
    {
      title: 'Two', layout: 'code', defines: ['bucket'],
      eyebrow: '12 · Writing the program · where the trick stops working',
      heading: 'From one storage bucket to another',
      stand: 'Now the staging file is in one store and the real name in another. There is no rename between two stores, only copy then delete.',
      question: { step: 0, prompt: 'The copy into the archive is cut off halfway. What does a restore from the archive read?', options: [
        { text: 'A partial file: the copy was written chunk by chunk under the real name.', correct: true, why: 'A copy between stores is not one step. It has a middle, and the crash can land there.' },
        { text: 'Nothing: the staging file is still complete.', correct: false, why: 'It is complete in the staging store, which a restore from the archive never reads.' },
        { text: 'The complete file: copies are always all or nothing.', correct: false, why: 'Within one store a rename is; a copy between stores is not.' } ] },
      code: P.build({ before: W(DATA, ...ATT, A_RECFIRST, A_CREATE, A_RESUME, VISIBLE, NIGHTS), add: [CROSS], step: 1 }),
      cards: [ { step: 2, title: 'A property of the store', html: '<p>A storage area in a cloud store is a <b>bucket</b>. Across two buckets, <b>8</b> crash points again leave a partial object under the real name. The rename is one step within one store and nowhere else.[[src:var]]</p>' } ],
      narration: [
        'Where does the trick stop working? Suppose the staging file and the real name live in two different stores. The copy is cut off halfway. What does a restore read? Choose an answer.',
        'A partial file. Here is the function: it copies chunk by chunk into the archive under the real name, and only then deletes the staging copy. A copy has a middle.',
        'A storage area in a cloud store is called a bucket. Across two buckets, 8 crash points again leave a partial object. The one-step rename belongs to a single store, not to the idea.'
      ]
    },

    /* ---------- 13 · the worked examples ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '13 · Writing the program · the worked examples',
      heading: 'Nineteen examples, each checked twice',
      stand: 'A table of inputs and expected answers, including the edges: no chunks at all, one chunk, a crash past the end, and a 5,000-chunk file.',
      question: { step: 0, prompt: 'A backup with zero chunks, rename policy. What should a restore find?', options: [
        { text: 'An empty file that exists: zero bytes, but a real backup.', correct: true, why: 'The staging file was created and renamed. “Exists but empty” must differ from “absent”, or the file could not serve as the record.' },
        { text: 'Nothing at all, since no byte was written.', correct: false, why: 'That is what direct gives. With rename, the empty staging file still commits.' },
        { text: 'An error, since an empty backup is invalid.', correct: false, why: 'An empty file is a legitimate backup of nothing. The program treats it as one.' } ] },
      code: P.build({ before: W(DATA, ...ATT, A_RECFIRST, A_CREATE, A_RESUME, VISIBLE, NIGHTS, CROSS), add: [EXTRA, EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Checked against the program and a rule', html: '<p>All 19 rows agree. At scale: 5,000 chunks killed midway at chunk 2500 sends <b>29992</b> bytes starting over, against <b>19995</b> resuming.[[src:var]]</p>' } ],
      narration: [
        'Next, the worked examples, including the edges. A backup with zero chunks, using rename. What should a restore find? Choose an answer.',
        'An empty file that exists. The staging file was created and renamed, so the backup is real, just empty. Exists but empty must differ from absent, or the file could not act as the record.',
        'Here is the table of 19 examples, each checked against the program and against a separate rule. At scale, a 5,000-chunk file killed midway sends 29,992 bytes starting over, and 19,995 resuming.'
      ]
    },

    /* ---------- 14 · main, part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '14 · Writing the program · every crash point, every policy',
      heading: 'Run all three policies at every crash point',
      stand: 'The last function runs everything and asserts each claim.',
      question: { step: 0, prompt: 'Why does the program assert that the rename policy never sets the record at all?', options: [
        { text: 'Because with rename, the file’s existence is the record.', correct: true, why: 'There is no second write to disagree with the file. The appearance of the file is the only commit.' },
        { text: 'Because the record system is broken.', correct: false, why: 'Nothing is broken. Rename simply has no use for it.' },
        { text: 'To make the program shorter.', correct: false, why: 'The assertion adds a line. It is there to pin down the design.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, ...ATT, A_RECFIRST, A_CREATE, A_RESUME, VISIBLE, NIGHTS, CROSS, SHOW), add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Three counts, asserted', html: '<p>Rename: never partial, at all 10 crash points. Direct: <b>8 of 10</b> leave a partial file. Record first: <b>9 of 10</b> leave a record claiming a missing backup.[[src:var]]</p>' } ],
      narration: [
        'Now main. It runs every policy at every crash point. Why does it assert that rename never sets the record? Choose an answer.',
        'Because with rename, the file’s existence is the record. Here is the first half of main: the table of every crash point, then the checks for each policy.',
        'Rename is never partial at any of the 10 crash points. Direct leaves a partial file at 8 of them. Record first leaves a lying record at 9.'
      ]
    },

    /* ---------- 15 · main, part 2 ---------- */
    {
      title: 'Rest', layout: 'code',
      eyebrow: '15 · Writing the program · cost, the catch, the limit',
      heading: 'Price every claim, then try random files',
      stand: 'The rest of main measures the cost of starting over, catches the stale resume, shows the two-store limit, and tests 300 random files.',
      question: { step: 0, prompt: 'Why does the program assert that the corrupt resumed file is exactly 45 bytes long?', options: [
        { text: 'To show a length check cannot catch it.', correct: true, why: 'Same size as a good backup is what makes it dangerous. The assertion records that fact.' },
        { text: 'Because 45 bytes means it is correct.', correct: false, why: 'It is the right size and the wrong content. Size proves nothing here.' },
        { text: 'To check the network sent every byte.', correct: false, why: 'The point is the content: its first 15 bytes came from another upload.' } ] },
      code: P.build({ before: W(DATA, EXTRA, EXAMPLES, ...ATT, A_RECFIRST, A_CREATE, A_RESUME, VISIBLE, NIGHTS, CROSS, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Then 300 random files', html: '<p>At every crash point, rename leaves the real name absent or complete, and complete exactly when the job was not killed.[[src:var]]</p>' } ],
      narration: [
        'The rest of main. Why does it assert that the corrupt resumed file is exactly 45 bytes long? Choose an answer.',
        'To show a length check cannot catch it. Here are the remaining checks: 90 bytes against 45 for the three crashed nights, the stale resume, the two-bucket limit, and the empty backup.',
        'Then 300 random files, crashed at every point. Rename always leaves the real name absent or complete, and complete exactly when the job was not killed.'
      ]
    },

    /* ---------- 16 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '16 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece written, and why.',
        'From the top: the chunks and names, the examples, one night’s job with its three policies, the restore’s view, the reruns, the two-bucket copy, and the checks.'
      ]
    },

    /* ---------- 17 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '17 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch05_v2.py prints'),
      narration: [
        'And here is what it prints: the 19 examples, then every crash point for all three policies. Rename is absent or the full 45 bytes; direct is partial at 8 points; record first lies at 9.',
        'Then the costs, 90 bytes against 45, the corrupt 45-byte resume, the two-bucket limit, the boundaries, and the last line: all assertions passed.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you built',
      heading: 'You can often manufacture the one-step commit',
      stand: 'Each policy, in a sentence.',
      table: {
        columns: ['Policy', 'What it does', 'What a crash can leave'],
        rows: [
          { step: 0, cells: ['direct', 'Upload under “backup”, then set the record.', 'a partial file at 8 of 10 crash points'] },
          { step: 0, cells: ['record first', 'Set the record, then upload.', 'a record claiming a missing backup at 9 of 10'] },
          { step: 1, cells: ['rename', 'Upload under a staging name, then rename. The rename is the commit.', 'nothing, or the complete file'] },
          { step: 2, cells: ['the price', 'Starting over: 90 bytes for a 45-byte file. Resuming: 45, if the staging name is unique.', '—'] },
          { step: 2, cells: ['the limit', 'Within one store only. Between two buckets a copy has a middle.', 'a partial object at 8 crash points'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>Variation 3: a counter kept in two places that must agree. No rename, no transaction — and the answer is to stop having two sources of truth.[[src:var]]</p>' },
      narration: [
        'To recap. Direct uploads under the real name and leaves a partial file at 8 crash points. Record first sets the record before uploading, and lies at 9.',
        'Rename uploads under a staging name and renames at the end. The rename is the commit, so a restore sees nothing or everything.',
        'Starting over costs 90 bytes for a 45-byte file; resuming costs 45, but only with a unique staging name. And the trick works within one store, not between two buckets.',
        'Next, variation 3: a counter kept in two places that must agree, with no rename and no transaction available.'
      ]
    }
  ]
};
