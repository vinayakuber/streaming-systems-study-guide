// Chapter 7, Part 2 — "Checkpoints and state stores", for a viewer who has read nothing before
// it. The story, both clocks, the window, the entry and the offset are re-introduced here, so
// the deck stands alone. The viewer decides each piece first: what a checkpoint must record,
// why the pair must be written together, where the bytes live, what to upload, and how often.
// The restore, the uploads and the frequency sweep are animated from the one seed, and the
// numbers the narration quotes are recomputed below, so the deck fails if the data changes.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch07';
const E = seed.EVENTS;
const winOf = seed.winOf;
const ID = e => `${e.key}@${winOf(e.et)}`;
const entriesUpTo = n => { const m = new Map(); E.slice(0, n + 1).forEach(e => m.set(ID(e), (m.get(ID(e)) || 0) + e.v)); return m; };
const CP = entriesUpTo(4);
const CP_SUM = [...CP.values()].reduce((a, b) => a + b, 0);
const AFTER = E.slice(5).reduce((s, e) => s + e.v, 0);
const ALL = E.reduce((s, e) => s + e.v, 0);
// checkpoint every 3 events: after offsets 2, 5, 8
const CPS = [2, 5, 8];
const FULL = CPS.map(c => entriesUpTo(c).size);
const changed = (a, b) => new Set(E.slice(a, b + 1).map(ID)).size;
const INCR = CPS.map((c, i) => changed(i ? CPS[i - 1] + 1 : 0, c));
const sum = xs => xs.reduce((a, b) => a + b, 0);
// the chapter's sweep: checkpoint every k events; incremental entry-uploads and the worst replay
const KS = [1, 3, 5, E.length];
const sweep = k => {
  const at = E.map((_, i) => i).filter(i => i % k === k - 1);
  const uploads = sum(at.map((c, j) => changed(j ? at[j - 1] + 1 : 0, c)));
  const worst = Math.max(...E.map((_, i) => { const last = at.filter(x => x <= i).pop(); return last === undefined ? i + 1 : i - last; }));
  return { at, uploads, worst };
};
const SW = KS.map(sweep);

if (CP.size !== 4 || CP_SUM !== 23 || AFTER !== 22 || ALL !== 45 || CP_SUM + AFTER !== 45 || CP_SUM + ALL !== 68
  || FULL.join() !== '2,5,7' || INCR.join() !== '2,3,3' || sum(FULL) !== 14 || sum(INCR) !== 8
  || SW.map(w => w.uploads).join() !== '9,8,4,7' || SW.map(w => w.worst).join() !== '0,2,4,8' || SW[2].at.join() !== '4'
  || changed(0, 8) !== 7 || E.map((_, i) => changed(i, i)).reduce((a, b) => a + b, 0) !== 9)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Saving State Cheaply',
  eyebrow: 'Streaming · Ch 7 · Part 2',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'RocksDB': 'Rocks D B', 'GB': 'gigabytes', 'KB': 'kilobytes' } },
  jargon: ['event', 'key', 'value', 'stream', 'pipeline', 'event time', 'processing time', 'window', 'offset',
    'entry', 'state', 'checkpoint', 'replay', 'atomic', 'state store', 'durable storage', 'upload', 'incremental'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    flow:  section(CH, 'Checkpoints and state stores', 'Chapter 7 · checkpoints and state stores'),
    why:   section(CH, 'Why a checkpoint is two things, and why the frequency is never free', 'Chapter 7 · a checkpoint is two things'),
    when:  section(CH, 'When to checkpoint how often, and what the store choice actually decides', 'Chapter 7 · how often, and which store'),
    mem:   section(CH, 'The checkpoint pair, and what full versus incremental uploads', 'Chapter 7 · the pair, as a program'),
    time:  section(CH, 'Why persistence buys time rather than correctness', 'Chapter 7 · persistence buys time')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 7 · Part 2',
      heading: 'Saving a running total so a crash costs little',
      hero: { step: 0, text: 'An app records what two users, <code>a</code> and <code>b</code>, do. Each action is an <b>event</b>: it names its user, called its <b>key</b>, and carries a number, its <b>value</b>, like points scored. Events arrive one after another with no end: a <b>stream</b>. A program called a <b>pipeline</b> keeps running totals of them, and the machine it runs on can crash at any moment.[[src:flow]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example[[src:why]]' },
        { step: 1, value: CP_SUM, label: 'points held by the copy saved after event 4[[src:why]]' },
        { step: 2, value: sum(FULL), label: 'totals sent off if everything is saved each time[[src:why]]' },
        { step: 2, value: sum(INCR), label: 'sent off if only what changed is saved[[src:why]]' }
      ],
      cardsLabel: 'What this part decides',
      cards: [
        { step: 3, n: 1, title: 'What must a saved copy record?', text: 'More than the totals, or it cannot be resumed from.' },
        { step: 3, n: 2, title: 'Where do the bytes live?', text: 'Memory, local disk, or somewhere that survives the machine.' },
        { step: 4, n: 3, title: 'What to send, and how often?', text: 'One setting is free; the other is a trade with no free point.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app records what two users, A and B, do. Each action is an event. It names its user, called its key, and carries a number, its value. Events arrive with no end: a stream.',
        'A program called a pipeline keeps running totals, and its machine can crash at any moment. Our example has 9 events. A copy saved after event 4 holds 23 points.',
        'Saving everything each time sends off 14 totals over the run. Saving only what changed sends off 8. We will reach all three numbers ourselves.',
        'This part decides three things. What must a saved copy record, beyond the totals? And where should the bytes live?',
        'And what should be sent off, and how often? One of those settings turns out to be free. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events, two clocks, the offset ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'window', 'offset'],
      eyebrow: '02 · The nine events, their two clocks, and their position',
      heading: 'Two clocks, a window, and a position',
      stand: 'The events in the order the pipeline saw them. Times are seconds after 12:00.',
      table: {
        columns: ['offset', 'key', 'happened at', 'seen at', 'window', 'value'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 6 ? 1 : 2,
          cells: [`<b>${i}</b>`, `<code>${e.key}</code>`, `${e.et} s`, `${e.pt} s`, `${winOf(e.et)}`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words', html: '<ul class="l"><li><b>Event time</b> — when it happened. <b>Processing time</b> — when the pipeline saw it. Event 7: 50 s and 280 s.</li><li><b>Window</b> — a 120-second stretch of event time, named by its start.</li><li><b>Offset</b> — an event’s position in the order seen, from 0.[[src:flow]]</li></ul>' },
      narration: [
        'Here are the 9 events in the order the pipeline saw them. Each has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'The pipeline keeps one total per user for each 120-second stretch of event time, called a window. Event 3 happened at 130 seconds, so it belongs to window 120.',
        'Event 7 happened at 50 seconds but was seen at 280. It still goes into window 0. And each event’s position in the order seen, counted from 0, is called its offset.',
        'So event time picks the window, and processing order gives the offset. The offset is how the pipeline says where it is in the stream: reading from offset 5 means reading events 5 to 8 again.'
      ]
    },

    /* ---------- 3 · the state after offset 4 ---------- */
    {
      title: 'State', layout: 'array', defines: ['entry', 'state'],
      eyebrow: '03 · What the pipeline holds after offset 4',
      heading: 'Five events have made four running totals',
      stand: 'One slot per running total, named key@window. Events 0 to 4 have been added in.',
      array: {
        labelWidth: 150, slotLabel: 'slot',
        rows: [
          { label: 'key@window', values: [...CP.keys()] },
          { label: 'total', values: [...CP.values()] }
        ],
        meters: ['totals held', 'points held'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [0] },
          { step: 2, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 380 }
        ]
      },
      cards: [
        { step: 1, title: 'Entry', html: '<p>One running total for one key in one window is an <b>entry</b>. Events 0 and 1 are both key a in window 0: <code>a@0</code> = 5 + 3 = 8.[[src:why]]</p>' },
        { step: 2, title: 'State', html: '<p>All the entries together are the <b>state</b>: everything the pipeline remembers between events. Here, 4 entries holding <b>23</b>.[[src:why]]</p>' }
      ],
      narration: [
        'After the first five events, offsets 0 to 4, the pipeline holds four running totals, each named by its key and its window.',
        'Events 0 and 1 are both user A in window 0, so they share one total: 5 plus 3 is 8. One total for one key in one window is called an entry.',
        'All the entries together are called the state. Watch them added up: 4 entries, holding 23 points. This is what a crash right now would wipe from memory.'
      ]
    },

    /* ---------- 4 · question: what a saved copy must record ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['checkpoint', 'replay'],
      eyebrow: '04 · Your turn',
      heading: 'A copy of the four entries is saved. Then the machine crashes.',
      stand: 'After the restart, the pipeline loads the 4 saved entries. The stream still holds every event, and can be read again from any offset.',
      question: {
        step: 0,
        prompt: 'From which offset must the pipeline start reading the stream again?',
        options: [
          { text: 'From offset 5, the first event the copy does not hold.', correct: true,
            why: 'Events 0 to 4 are already inside the loaded entries. Reading on from 5 adds each event exactly once.' },
          { text: 'From offset 0, to be safe.', correct: false,
            why: 'Events 0 to 4 are already in the entries. Reading them again would add them a second time.' },
          { text: 'From wherever it had got to when it crashed.', correct: false,
            why: 'Events read after the copy was saved were lost with memory. Skipping them would leave them out.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Checkpoint: a pair', html: '<p>A <b>checkpoint</b> is the saved entries <b>plus the offset</b> they correspond to: { 4 entries holding 23, offset 4 }. A copy that does not say where it was taken cannot be resumed from.[[src:why]]</p>' },
        { step: 2, title: 'Replay', html: '<p>Reading the stream again from an offset is a <b>replay</b>. The restore loop starts at offset + 1 = 5; that one expression is the whole correctness of recovery.[[src:mem]]</p>' }
      ],
      narration: [
        'First question. A copy of the 4 entries was saved, then the machine crashed. The pipeline loads the copy. From which offset must it read the stream again? Choose an answer.',
        'From offset 5. So the copy must also record where it was taken: offset 4. The entries plus their offset, saved together, is called a checkpoint. Without the offset it cannot be resumed from.',
        'Reading the stream again from an offset is called a replay. Restoring means: load the entries, then replay from the offset plus one. That one step is the whole correctness of recovery.'
      ]
    },

    /* ---------- 5 · the restore, animated ---------- */
    {
      title: 'Restore', layout: 'array',
      eyebrow: '05 · Watch two restores of the same checkpoint',
      heading: 'The right offset gives 45. A lost offset gives 68.',
      stand: 'Top row: each event’s value. Then what a replay adds on top of the 23 already loaded — with the saved offset 4, and with the offset lost so the replay starts at 0.',
      array: {
        labelWidth: 190, slotLabel: 'offset',
        rows: [
          { label: 'value', values: E.map(e => e.v) },
          { label: 'added, offset 4 kept', values: E.map((e, i) => (i <= 4 ? 0 : e.v)) },
          { label: 'added, offset lost', values: E.map(e => e.v) }
        ],
        meters: ['added with offset 4', 'added with offset lost'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', resultMeter: 0, speed: 260 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', resultMeter: 1, speed: 260 }
        ]
      },
      cards: [
        { step: 1, title: 'Matching pair', html: '<p>23 loaded + <b>22</b> replayed = <b>45</b>: exactly the total of a run that never crashed.[[src:mem]]</p>' },
        { step: 2, title: 'Offset lost', html: '<p>23 loaded + 45 replayed = <b>68</b>. Events 0 to 4 are counted twice: over by exactly the 23 the checkpoint already held.[[src:mem]]</p>' },
        { step: 3, title: 'One wrong argument', html: '<p>Same entries, same stream; only the offset differs. That is why the two halves of a checkpoint are one thing.[[src:mem]]</p>' }
      ],
      narration: [
        'Here are the 9 values in offset order. The checkpoint has already loaded 23 points: events 0 to 4.',
        'With the saved offset 4, the replay starts at 5. Watch it add only events 5 to 8: 22 points. 23 loaded plus 22 is 45, exactly the total of a run that never crashed.',
        'Now suppose the offset was lost, so the replay starts at 0. It adds all 45 again on top of the 23 already loaded: 68. Events 0 to 4 have been counted twice.',
        'Same entries, same stream, and only the offset differs. That is why the entries and the offset are one checkpoint, not two separate things.'
      ]
    },

    /* ---------- 6 · question: atomic ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['atomic'],
      eyebrow: '06 · Your turn',
      heading: 'Writing the pair takes two writes',
      stand: 'The pipeline writes the entries first, then the offset. The machine crashes between the two writes, so the new entries are saved and the offset beside them is not.',
      question: {
        step: 0,
        prompt: 'What happens on the next restore?',
        options: [
          { text: 'The replay starts too early, and events already in the entries are added again.', correct: true,
            why: 'The entries already hold those events, but the offset says they still need reading. They are counted twice, like the 68.' },
          { text: 'Nothing: the entries are saved, and they are what matters.', correct: false,
            why: 'The entries alone cannot say where to resume. A wrong offset with right entries gives a wrong total.' },
          { text: 'The restore fails with an error, and someone fixes it.', correct: false,
            why: 'Nothing looks wrong to the pipeline. It loads, replays and reports a total that is simply too high.' }
        ]
      },
      cards: [
        { step: 1, title: 'Atomic', html: '<p>The entries and the offset must be committed <b>atomically</b>: both written, or neither. A half-written checkpoint is not slightly stale; it is wrong.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. The entries are written first, then the offset, and the machine crashes in between. The new entries are saved; the offset beside them is not. What happens next? Choose an answer.',
        'The replay starts too early, and events already in the entries are added again, with no error anywhere. So the two must be written atomically: both, or neither. Half a checkpoint is a wrong one.'
      ]
    },

    /* ---------- 7 · question: where the bytes live ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['state store'],
      eyebrow: '07 · Your turn',
      heading: 'When the state stops fitting in memory',
      stand: 'Our state is 7 entries and fits anywhere. Real state is one entry per key per open window, and both of those keep growing.',
      question: {
        step: 0,
        prompt: 'Where should the pipeline keep entries once there are more than memory can hold?',
        options: [
          { text: 'In a store on the machine’s own disk, with the busiest entries kept in memory.', correct: true,
            why: 'Hot entries stay fast in memory and the rest wait on disk. Nothing about the totals changes, only where the bytes sit.' },
          { text: 'Nowhere: drop the oldest entries to make room.', correct: false,
            why: 'Dropping an unfinished entry silently loses its points. Freeing is the watermark’s job, not memory’s.' },
          { text: 'In a database across the network, read on every event.', correct: false,
            why: 'That works but pays a network trip per event. An embedded store keeps the work on the same machine.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'State store', html: '<p>An embedded <b>state store</b>, such as RocksDB, keeps hot entries in memory and the rest on local disk. The entries, their values and when they are freed are identical either way.[[src:why]]</p>' },
        { step: 2, title: 'What it does change', html: '<p>Once state is on disk, saving a checkpoint means reading those bytes back and uploading them. That cost is what the next questions shrink.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. Our state is 7 entries, but real state is one entry per key per open window, and both keep growing. Where should entries go once memory is full? Choose an answer.',
        'In a store on the machine’s own disk, with the busiest entries in memory. That is a state store, such as RocksDB. It changes where the bytes live, and nothing about the totals.',
        'What it does change is the cost of checkpoints: saving now means reading those bytes back from disk and uploading them. That cost is what the rest of this part shrinks.'
      ]
    },

    /* ---------- 8 · question: local is not durable ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['durable storage', 'upload'],
      eyebrow: '08 · Your turn',
      heading: 'The disk dies with the machine',
      stand: 'The state store sits on the machine’s own disk. Now the machine itself is lost, not just restarted.',
      question: {
        step: 0,
        prompt: 'Is the local state store enough to recover from losing the machine?',
        options: [
          { text: 'No: the checkpoint must also be copied somewhere that outlives the machine.', correct: true,
            why: 'The local store is there for speed and dies with its disk. Only a copy kept elsewhere survives a failure.' },
          { text: 'Yes: anything written to disk is safe.', correct: false,
            why: 'A disk is part of the machine. When the machine is gone, so is everything on it.' },
          { text: 'Yes, as long as the store keeps hot entries in memory.', correct: false,
            why: 'Memory is the first thing lost in a failure. Keeping entries there makes them faster, not safer.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Durable storage', html: '<p>Storage that survives the machine — a remote file system or object store — is <b>durable storage</b>. Each checkpoint is <b>uploaded</b> there: copied across the network.[[src:when]]</p>' },
        { step: 2, title: 'Two roles, never one', html: '<p>The local store is for speed; the remote checkpoint is for survival. Collapse them and the pipeline recovers from a restart but not from a failure.[[src:when]]</p>' }
      ],
      narration: [
        'Fourth question. The state store sits on the machine’s own disk. Now the whole machine is lost, not just restarted. Is the local store enough to recover? Choose an answer.',
        'No. Storage that outlives the machine, somewhere across the network, is called durable storage, and each checkpoint is uploaded there: copied across.',
        'So there are two roles. The local store is for speed, and the remote checkpoint is for survival. Merge them, and the pipeline survives a restart but not a failure.'
      ]
    },

    /* ---------- 9 · question: what to upload ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['incremental'],
      eyebrow: '09 · Your turn',
      heading: 'A checkpoint every 3 events. What goes up each time?',
      stand: 'Checkpoints are taken after offsets 2, 5 and 8. At the second one the state holds 5 entries, but only 3 of them changed since the first.',
      question: {
        step: 0,
        prompt: 'At the second checkpoint, how many entries must be uploaded?',
        options: [
          { text: 'All 5: a checkpoint is the whole state.', correct: false,
            why: 'The first 2 entries are already uploaded and unchanged, so sending them again buys nothing.' },
          { text: 'Only the 3 that changed since the last one.', correct: true,
            why: 'The unchanged entries are already in durable storage. Restoring needs the old upload plus the changes.' },
          { text: 'None: it can wait until the third checkpoint.', correct: false,
            why: 'Then a crash before the third would replay from offset 2, and this checkpoint would not exist at all.' }
        ]
      },
      cards: [
        { step: 1, title: 'Full and incremental', html: '<p>Uploading the whole state each time is a full checkpoint. Uploading only what changed since the last one is an <b>incremental</b> checkpoint. Recovery is identical either way.[[src:why]]</p>' }
      ],
      narration: [
        'Fifth question. Checkpoints are taken after offsets 2, 5 and 8. At the second one the state holds 5 entries, but only 3 changed since the first. How many must be uploaded? Choose an answer.',
        'Only the 3 that changed. Uploading only what changed since the last checkpoint is called incremental. Uploading everything each time is a full checkpoint. Recovery works the same either way.'
      ]
    },

    /* ---------- 10 · full versus incremental, animated ---------- */
    {
      title: 'Upload', layout: 'array',
      eyebrow: '10 · Watch the uploads add up',
      heading: '14 entries against 8, for the same three checkpoints',
      stand: 'One slot per checkpoint, taken after offsets 2, 5 and 8. Full uploads the whole state; incremental uploads the churn.',
      array: {
        labelWidth: 170, slotLabel: 'checkpoint',
        rows: [
          { label: 'after offset', values: CPS },
          { label: 'full', values: FULL },
          { label: 'incremental', values: INCR }
        ],
        meters: ['full: entries uploaded', 'incremental: entries uploaded'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', resultMeter: 0, speed: 500 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', resultMeter: 1, speed: 500 }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Full grows', html: '<p>2, 5, 7: each full upload is the whole state so far, so it grows every time.[[src:why]]</p>' },
        { step: 2, title: 'Incremental tracks churn', html: '<p>2, 3, 3: only what changed. <b>8 against 14</b>, a 43% saving on 9 events.[[src:why]]</p>' },
        { step: 3, title: 'The gap widens', html: '<p>Full scales with total state; incremental with how fast it changes. On a large, mostly idle state: 10 GB against 10 KB. Leave it on.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the three checkpoints, taken after offsets 2, 5 and 8.',
        'A full checkpoint uploads the whole state each time: 2 entries, then 5, then 7. Watch them add up: 14 entries.',
        'An incremental checkpoint uploads only what changed: 2, then 3, then 3. That adds up to 8, a 43 percent saving on just 9 events.',
        'And the gap widens, because full grows with the whole state while incremental grows with the churn. On a large, idle state that is 10 gigabytes against 10 kilobytes. It is the one free setting.'
      ]
    },

    /* ---------- 11 · question: how often ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: 'How often should checkpoints be taken?',
      stand: 'Option one: a checkpoint after every event. Option two: one checkpoint, after the last event. A crash can come at any moment.',
      question: {
        step: 0,
        prompt: 'Which option replays fewer events after the worst-timed crash?',
        options: [
          { text: 'A checkpoint after every event: at most 0 events to replay.', correct: true,
            why: 'The last checkpoint is never more than one event old, so nothing needs reading again — but every event costs an upload.' },
          { text: 'One checkpoint at the end: fewer checkpoints, less to replay.', correct: false,
            why: 'Fewer checkpoints means older ones. A crash just before the only checkpoint replays 8 events.' },
          { text: 'They replay the same, because recovery is always correct.', correct: false,
            why: 'Both are correct, but correctness is not cost. How far back the last checkpoint is decides the replay.' }
        ]
      },
      narration: [
        'Sixth question. Option one takes a checkpoint after every event. Option two takes one, after the last event. Which replays fewer events after the worst-timed crash? Choose an answer.',
        'A checkpoint after every event: the last one is never more than one event old, so the worst replay is 0. But every event now pays for an upload. The next slide prices all three choices.'
      ]
    },

    /* ---------- 12 · the frequency sweep ---------- */
    {
      title: 'Sweep', layout: 'array',
      eyebrow: '12 · The trade, with incremental uploads',
      heading: 'More checkpoints, less replay. No free point.',
      stand: 'The chapter’s four settings on the same 9 events, counting incremental entry-uploads and the worst-case replay after a crash.',
      array: {
        labelWidth: 170, slotLabel: 'setting',
        rows: [
          { label: 'checkpoint', values: ['every event', 'every 3', 'every 5', 'once'] },
          { label: 'uploads', values: SW.map(w => w.uploads) },
          { label: 'worst replay', values: SW.map(w => w.worst) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [1] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Both directions, no free point', html: '<p>Every event: 9 uploads, replay 0. Every 3: 8, replay 2. Every 5: 4, replay 4, cheap only because its one checkpoint, at event 4, never covers the last 4 events. Once: 7, replay 8. All four recover correctly.[[src:why]]</p>' },
        { step: 2, title: 'Start from recovery time', html: '<p>Recovery time is events since the last checkpoint divided by replay speed. Start from what you can tolerate and derive the interval; the upload cost then is what it is.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the chapter’s four settings on the same 9 events, counting incremental uploads: one per entry a checkpoint writes. Every event: 9 uploads. Every 3 events: 8. Every 5: 4. Once: 7.',
        'And the worst replay after a crash: 0, 2, 4 and 8 events. Replay grows with the interval. Every 5 looks cheapest only because its one checkpoint, at event 4, never covers the last 4 events. Every setting is correct; none is free.',
        'So choose the interval from the recovery time you can tolerate, not from the uploads you would prefer. Recovery time is events since the last checkpoint, divided by replay speed.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'A pair, written together, stored twice, uploaded by its changes',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Checkpoint</b>', 'The entries plus their offset: { 4 entries holding 23, offset 4 }. Replay from 5: 23 + 22 = 45.[[src:mem]]'] },
          { step: 0, cells: ['<b>Atomic</b>', 'Both halves written, or neither. Offset lost: 68, counted twice.[[src:why]]'] },
          { step: 1, cells: ['<b>State store</b> and <b>durable storage</b>', 'Local and fast, for speed; remote, for surviving the machine. Never one thing.[[src:when]]'] },
          { step: 1, cells: ['<b>Incremental</b>', 'Upload only what changed: 8 entries against 14. No trade at all.[[src:why]]'] },
          { step: 2, cells: ['<b>Frequency</b>', 'Every event: 9 uploads, replay 0. Once: 7 uploads, replay 8. Pick it from recovery time.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>A real pipeline has several stages and sources. If each saves at a different point in the stream, no single offset matches the whole checkpoint. Part 3 adds the barrier that lines them up, and prices it.[[src:when]]</p>' },
      narration: [
        'To recap. A checkpoint is a pair: the entries and their offset. 4 entries holding 23 at offset 4, then a replay from 5, gives 23 plus 22, which is 45.',
        'The pair must be written atomically, or a lost offset counts events twice: 68. The local state store is for speed, and durable storage is for surviving the machine.',
        'Incremental checkpoints upload only what changed: 8 instead of 14, at no cost. And the frequency trades uploads against replay, so pick it from the recovery time you can tolerate.',
        'Next, part 3. With several stages, each saving at a different point, no single offset matches the checkpoint. Part 3 adds the barrier that lines them up, and what it costs.'
      ]
    }
  ]
};
