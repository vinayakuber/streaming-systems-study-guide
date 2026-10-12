// Chapter 7, Part 8 — the chapter's "System Design Interview": checkpointing a stateful stream
// processor, built one component at a time. Each component is preceded by a question; the
// recovery is then traced as a sequence, the design assembled as a graph, and closed with the
// four things it does not settle. The story, both clocks, the window and the offset are
// re-introduced, so the deck stands alone. Every number is recomputed from the one seed.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch07';
const E = seed.EVENTS;
const winOf = seed.winOf;
const ID = e => `${e.key}@${winOf(e.et)}`;
const STATE = new Map();
E.slice(0, 5).forEach(e => STATE.set(ID(e), (STATE.get(ID(e)) || 0) + e.v));
const LOADED = [...STATE.values()].reduce((a, b) => a + b, 0);
const REPLAYED = E.slice(5).reduce((s, e) => s + e.v, 0);
const ALL = E.reduce((s, e) => s + e.v, 0);
const FINAL = new Set(E.map(ID)).size;

if (STATE.size !== 4 || LOADED !== 23 || REPLAYED !== 22 || ALL !== 45 || FINAL !== 7 || LOADED + ALL !== 68
  || [...STATE.keys()].join() !== 'a@0,b@0,a@120,a@240' || E[4].key !== 'a' || E[4].v !== 6 || ID(E[4]) !== 'a@240')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Crash-Proof Processor Design',
  eyebrow: 'Streaming · Ch 7 · Part 8',
  ...shared,
  legend: { main: 'in use', change: 'the stage being designed', new: 'added by this design', ext: 'outside the processor' },
  jargon: ['event', 'key', 'value', 'stream', 'processor', 'event time', 'processing time', 'window', 'offset',
    'replay', 'entry', 'state', 'state store', 'checkpoint', 'barrier', 'snapshot', 'durable storage', 'incremental',
    'atomic', 'at-least-once', 'watermark', 'retention'],
  sources: {
    ch:     chapter(CH, 'Chapter 7 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 7 · system design interview'),
    stream: section(CH, 'stream', 'Chapter 7 · the stream'),
    proc:   section(CH, 'processor (state store)', 'Chapter 7 · the processor'),
    cp:     section(CH, 'checkpoint (state + offset)', 'Chapter 7 · the checkpoint'),
    dur:    section(CH, 'durable storage', 'Chapter 7 · durable storage'),
    why:    section(CH, 'Why the whole design reduces to one equation and one requirement', 'Chapter 7 · one equation, one requirement'),
    when:   section(CH, 'When this design is enough, and the four things it does not settle', 'Chapter 7 · what the design does not settle'),
    mem:    section(CH, 'Checkpointing a stateful processor — stack and heap at every step', 'Chapter 7 · the design, as a program'),
    flow:   section(CH, 'Checkpoints and state stores', 'Chapter 7 · checkpoints and state stores')
  },

  slides: [
    /* ---------- 1 · the brief, as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'processor'],
      eyebrow: '01 · Chapter 7 · Part 8 · a system design interview',
      heading: 'Design a processor that can crash and lose nothing',
      hero: { step: 0, text: 'An app records what two users, <code>a</code> and <code>b</code>, do. Each action is an <b>event</b>, naming its user — its <b>key</b> — and carrying a number, its <b>value</b>. Events arrive with no end: a <b>stream</b>. A <b>processor</b> keeps running totals of them. The brief: after a crash it must carry on, losing no event and counting none twice, even though the stream sends events again from an earlier point.[[src:sd]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in the example[[src:why]]' },
        { step: 1, value: ALL, label: 'the total with no crash[[src:why]]' },
        { step: 2, value: LOADED, label: 'loaded back after the crash[[src:why]]' },
        { step: 2, value: REPLAYED, label: 'read again from the stream[[src:why]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Where the totals live', text: 'Fast, while the processor runs.' },
        { step: 3, n: 2, title: 'What is saved, and when', text: 'So a restart knows exactly where to resume.' },
        { step: 4, n: 3, title: 'Where the saved copy goes', text: 'So it survives the machine, not just a restart.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the recovery is traced, the design assembled, and its gaps named.[[src:sd]]' },
      narration: [
        'An app records what two users, A and B, do. Each action is an event, naming its user, its key, and carrying a number, its value. Events arrive with no end: a stream. A processor keeps running totals.',
        'The brief: after a crash, the processor must carry on losing no event and counting none twice. Our example has 9 events, and with no crash the total is 45.',
        'By the end, recovery will load 23 back and read 22 again from the stream, and 23 plus 22 must equal 45. That one sum is the whole design’s claim.',
        'The design must decide where the totals live while the processor runs, and what is saved, and when.',
        'And where the saved copy goes, so that it survives the machine and not just a restart. Before each component you will be asked to choose.'
      ]
    },

    /* ---------- 2 · the events ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'window', 'offset'],
      eyebrow: '02 · The nine events, two clocks, and a position',
      heading: 'Two clocks, a window, and a position',
      stand: 'The events in the order the processor saw them. Times are seconds after 12:00.',
      table: {
        columns: ['offset', 'key', 'happened at', 'seen at', 'window', 'value'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 6 ? 1 : 2,
          cells: [i === 4 ? '<b>4</b>' : `${i}`, `<code>${e.key}</code>`, `${e.et} s`, `${e.pt} s`, `${winOf(e.et)}`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words', html: '<ul class="l"><li><b>Event time</b> — when it happened. <b>Processing time</b> — when the processor saw it.</li><li><b>Window</b> — a 120-second stretch of event time, named by its start.</li><li><b>Offset</b> — an event’s position in the order seen, from 0.[[src:stream]]</li></ul>' },
      narration: [
        'Here are the 9 events in the order the processor saw them. Each has two times: when it happened, its event time, and when the processor saw it, its processing time.',
        'Totals are kept per user for each 120-second stretch of event time, called a window. Event 4, user A, value 6, happened at 245 seconds, so it belongs to window 240.',
        'Event 7 happened at 50 seconds but was seen at 280, so it still belongs to window 0. Each event’s position in the order seen, counted from 0, is called its offset.',
        'So event time picks the window, and the order seen gives the offset. The offset is what lets a restart say exactly where in the stream it should continue.'
      ]
    },

    /* ---------- 3 · component 1: the stream ---------- */
    {
      title: 'Stream', layout: 'ask', defines: ['replay'],
      eyebrow: '03 · Your turn · component 1, the stream',
      heading: 'What must the stream offer, for recovery to work?',
      stand: 'After a crash, whatever the processor had not safely saved must be read again.',
      question: {
        step: 0,
        prompt: 'What must the stream that delivers events be able to do?',
        options: [
          { text: 'Deliver events again from any offset it still holds.', correct: true,
            why: 'Then the processor can ask for “everything after offset 4” and get exactly the events it has not yet saved.' },
          { text: 'Deliver each event exactly once, and then delete it.', correct: false,
            why: 'Then an event read but not yet saved is gone for good when the processor crashes.' },
          { text: 'Deliver events sorted by when they happened.', correct: false,
            why: 'Order of happening decides windows, not recovery. What recovery needs is a position to restart from.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Replayable', html: '<p>The offset is a replayable position: reading the stream again from it is a <b>replay</b>. Events after the offset are not yet folded into any total.[[src:stream]]</p>' },
        { step: 2, title: 'Here', html: '<p>Event 4 — key a, value 6 — arrives at offset 4. Everything from offset 5 on is what a crash right now would have to replay.[[src:stream]]</p>' }
      ],
      narration: [
        'Component one, the stream. After a crash, whatever was not safely saved must be read again. What must the stream that delivers events be able to do? Choose an answer.',
        'Deliver events again from any offset it still holds. The offset is a replayable position, and reading the stream again from it is called a replay.',
        'In our example, event 4, user A, value 6, arrives at offset 4. Everything from offset 5 onwards is what a crash right now would have to replay.'
      ]
    },

    /* ---------- 4 · component 2: the processor and its store ---------- */
    {
      title: 'Store', layout: 'array', defines: ['entry', 'state', 'state store'],
      eyebrow: '04 · Component 2 · the processor and its state store',
      heading: 'Five events fold into four running totals',
      stand: 'One slot per running total, named key@window, after offsets 0 to 4. Event 4 has just created a@240.',
      array: {
        labelWidth: 150, slotLabel: 'slot',
        rows: [
          { label: 'key@window', values: [...STATE.keys()] },
          { label: 'total', values: [...STATE.values()] }
        ],
        meters: ['entries held', 'points held'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [3] },
          { step: 2, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 380 }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Entry', html: '<p>One running total for one key in one window is an <b>entry</b>. Event 4 creates <code>a@240</code>: nothing → 6.[[src:proc]]</p>' },
        { step: 2, title: 'State', html: '<p>All the entries are the <b>state</b>: here <b>4 entries totalling 23</b>.[[src:proc]]</p>' },
        { step: 3, title: 'State store', html: '<p>The processor keeps them in a local <b>state store</b>: hot keys in memory, the rest spilled to local disk. Fast — and it dies with the machine.[[src:proc]]</p>' }
      ],
      narration: [
        'Component two, the processor. After offsets 0 to 4 it holds four running totals, each named by its key and its window.',
        'Event 4 has just created key A in window 240: nothing, then 6. One running total for one key in one window is called an entry.',
        'All the entries together are the state. Watch them added up: 4 entries, totalling 23.',
        'The processor keeps them in a local state store: busy keys in memory, the rest on the machine’s own disk. It is fast, and it dies with the machine.'
      ]
    },

    /* ---------- 5 · component 3: the checkpoint ---------- */
    {
      title: 'Snap', layout: 'ask', defines: ['checkpoint', 'barrier', 'snapshot'],
      eyebrow: '05 · Your turn · component 3, the checkpoint',
      heading: 'What exactly must be saved?',
      stand: 'A marker travels with the events; when the processor sees it at offset 4, it saves a copy. The copy must be enough to resume from.',
      question: {
        step: 0,
        prompt: 'What must the saved copy contain?',
        options: [
          { text: 'The four entries only: they are the totals.', correct: false,
            why: 'Without the offset, a restart cannot know where to read on from, so events are skipped or added twice.' },
          { text: 'The four entries and the offset 4, together in one value.', correct: true,
            why: 'The entries say what has been added up; the offset says which events that covers. Recovery needs both.' },
          { text: 'The offset only: the totals can be rebuilt.', correct: false,
            why: 'Rebuilding means replaying from offset 0, which is the cost the checkpoint exists to avoid.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Checkpoint', html: '<p>The pair { entries: {a@0:8, b@0:7, a@120:2, a@240:6}, offset: 4 } is a <b>checkpoint</b>.[[src:cp]]</p>' },
        { step: 1, title: 'Barrier', html: '<p>The marker is a <b>barrier</b>: when a stage has seen it from every input, it saves. Here, at offset 4.[[src:cp]]</p>' },
        { step: 2, title: 'Snapshot, not reference', html: '<p>The saved entries are a <b>snapshot</b>: a frozen copy, so the processor can keep working while the copy is sent off.[[src:mem]]</p>' }
      ],
      narration: [
        'Component three, the checkpoint. A marker travels with the events, and at offset 4 the processor saves a copy. What must that copy contain? Choose an answer.',
        'The four entries and the offset 4, together. That pair is called a checkpoint, and the marker that triggers it is called a barrier.',
        'And the saved entries are a snapshot: a frozen copy, not a link to the live ones. So the processor can keep working on new events while the copy is being sent off.'
      ]
    },

    /* ---------- 6 · component 4: durable storage ---------- */
    {
      title: 'Durable', layout: 'ask', defines: ['durable storage', 'incremental'],
      eyebrow: '06 · Your turn · component 4, durable storage',
      heading: 'Where does the checkpoint go?',
      stand: 'The state store is on the processor’s own disk. A checkpoint kept there would vanish with the machine.',
      question: {
        step: 0,
        prompt: 'Where should the checkpoint be written?',
        options: [
          { text: 'Next to the state store, on the same fast disk.', correct: false,
            why: 'That survives a restart but not a failure. When the machine is lost, so is everything on its disk.' },
          { text: 'To remote storage that outlives the processor, such as an object store.', correct: true,
            why: 'Only a copy kept off the machine survives its crash, and restart reads it back from there.' },
          { text: 'Nowhere: the stream can always replay.', correct: false,
            why: 'Replaying from offset 0 is correct but slow. On a long history it is the difference between a minute and a week.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Durable storage', html: '<p>Remote storage that survives the processor’s crash — S3 or HDFS — is <b>durable storage</b>. The local store is for speed; this copy is for survival. Never one thing.[[src:dur]]</p>' },
        { step: 2, title: 'Upload only what changed', html: '<p><b>Incremental</b> mode sends only the entries changed since the last checkpoint: 8 instead of 14 at a checkpoint every 3 events, with identical recovery. The one free improvement.[[src:why]]</p>' }
      ],
      narration: [
        'Component four. The state store is on the processor’s own disk, so a checkpoint kept there would vanish with the machine. Where should the checkpoint be written? Choose an answer.',
        'To remote storage that outlives the processor. That is called durable storage. The local store is for speed, and this copy is for survival; collapse them and you survive a restart, not a failure.',
        'And only send what changed. Incremental mode uploads only the entries changed since the last checkpoint: 8 instead of 14 at one every 3 events, with identical recovery. It is free.'
      ]
    },

    /* ---------- 7 · the recovery, traced ---------- */
    {
      title: 'Recover', layout: 'sequence',
      eyebrow: '07 · The crash comes. Watch the restart.',
      heading: '23 loaded + 22 replayed = 45',
      stand: 'The processor crashed after offset 8. It restarts with nothing but the checkpoint in durable storage.',
      sequence: {
        actors: [
          { name: 'Processor', sub: 'restarting, empty' },
          { name: 'Durable storage', sub: 'holds the checkpoint', src: 'dur' },
          { name: 'Stream', sub: 'replays from an offset', src: 'stream' }
        ],
        messages: [
          { from: 'Processor', to: 'Durable storage', label: 'read the latest checkpoint', step: 0 },
          { from: 'Durable storage', to: 'Processor', label: '4 entries holding 23, offset 4', step: 0 },
          { from: 'Processor', to: 'Stream', label: 'seek to offset 4, send what follows', step: 1 },
          { from: 'Stream', to: 'Processor', label: 'events 5, 6, 7, 8: worth 22', step: 2 },
          { from: 'Processor', to: 'Durable storage', label: 'next checkpoint: 7 entries, 45', step: 3 }
        ]
      },
      notes: [
        { step: 2, html: '<b>No loss:</b> events 5 to 8 were never in the checkpoint, and they are read again.[[src:why]]' },
        { step: 2, html: '<b>No double count:</b> events 0 to 4 are already inside the 23, and are not read again.[[src:why]]' },
        { step: 3, html: '<b>The claim:</b> 23 + 22 = 45, indistinguishable from a run that never crashed.[[src:why]]' }
      ],
      narration: [
        'The processor crashed after offset 8 and restarts empty. First, it reads the latest checkpoint from durable storage: 4 entries holding 23, at offset 4.',
        'Then it seeks the stream to offset 4, the position those entries correspond to, and asks for everything that follows.',
        'The stream replays events 5, 6, 7 and 8, worth 22. Nothing is lost, because those were not in the checkpoint. Nothing is counted twice, because events 0 to 4 are not read again.',
        'The final state is 7 entries holding 45: 23 loaded plus 22 replayed. That one equation is the design’s entire claim.'
      ]
    },

    /* ---------- 8 · the requirement ---------- */
    {
      title: 'Torn', layout: 'ask', defines: ['atomic'],
      eyebrow: '08 · Your turn · the one requirement',
      heading: 'The entries landed. The offset did not.',
      stand: 'Writing the checkpoint is two writes. A crash between them leaves the entries in durable storage, with the offset still at its old value, as if nothing had been folded.',
      question: {
        step: 0,
        prompt: 'What does the next recovery report?',
        options: [
          { text: '45, the right total.', correct: false,
            why: 'The stale offset sends the replay back to the start, so events 0 to 4 are added on top of the 23 that already holds them.' },
          { text: '22: the loaded entries are ignored.', correct: false,
            why: 'The entries are loaded. The fault is that the replay starts too early, not that the entries are missing.' },
          { text: '68: events 0 to 4 are counted twice.', correct: true,
            why: '23 loaded, plus all 9 events replayed, 45, is 68: over by exactly the 23 the checkpoint held.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Atomic', html: '<p>The entries and the offset must be committed <b>atomically</b>: both or neither. This design <b>requires</b> that, and does not itself provide it.[[src:mem]]</p>' },
        { step: 2, title: 'How hard that is', html: '<p>Against a store you control it is a local transaction. Against an outside output it is a two-phase commit, with its in-doubt state and human resolution.[[src:when]]</p>' }
      ],
      narration: [
        'Writing the checkpoint is two writes. The entries landed, but the offset stayed at its old value, as if nothing had been folded. What does the next recovery report? Choose an answer.',
        '68. The replay starts at the beginning, and events 0 to 4 are added on top of the 23 that already holds them. So the entries and the offset must be committed atomically: both, or neither.',
        'The design requires that, and does not build it. Against a store you control it is a local transaction. Against an outside output it is a two-phase commit, which is much harder.'
      ]
    },

    /* ---------- 9 · the design, assembled ---------- */
    {
      title: 'Design', layout: 'graph',
      eyebrow: '09 · The design, assembled',
      heading: 'Stream, processor, checkpoint, durable storage, recovery',
      stand: 'Each box is one answer you chose. The arrow back into the processor is the restart.',
      graph: {
        viewBox: '0 0 1520 380', legend: true,
        nodes: [
          { id: 'stream', x: 20, y: 40, w: 260, h: 104, title: 'Stream', sub: 'replayable from an offset', kind: 'ext', step: 0, src: 'stream', values: ['event 4 at offset 4'] },
          { id: 'proc', x: 330, y: 40, w: 260, h: 104, title: 'Processor', sub: 'local state store', kind: 'main', step: 0, src: 'proc', values: ['4 entries, 23'] },
          { id: 'cp', x: 640, y: 40, w: 260, h: 104, title: 'Checkpoint', sub: 'entries + offset, at a barrier', kind: 'new', step: 1, src: 'cp', values: [null, 'offset 4'] },
          { id: 'dur', x: 950, y: 40, w: 260, h: 104, title: 'Durable storage', sub: 'survives the machine', kind: 'new', step: 1, src: 'dur', values: [null, '8 uploads, not 14'] },
          { id: 'rec', x: 640, y: 240, w: 260, h: 104, title: 'Restart recovery', sub: 'load, seek, replay', kind: 'change', step: 2, src: 'why', values: [null, null, '23 + 22 = 45'] }
        ],
        edges: [
          { from: 'stream', to: 'proc', kind: 'main', step: 0 },
          { from: 'proc', to: 'cp', kind: 'new', step: 1 },
          { from: 'cp', to: 'dur', kind: 'new', step: 1 },
          { from: 'dur', to: 'rec', kind: 'change', step: 2 },
          { from: 'rec', to: 'proc', kind: 'change', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Local vs remote:</b> the store is for speed, the checkpoint for survival.[[src:why]]' },
        { step: 3, html: '<b>Free:</b> incremental uploads, 8 against 14.[[src:why]]' },
        { step: 3, html: '<b>Required, not built:</b> the atomic commit of the pair.[[src:when]]' }
      ],
      narration: [
        'Here is the whole design. The stream delivers events with a replayable offset, and the processor folds them into its local state store: 4 entries holding 23 after offset 4.',
        'At a barrier, the processor takes a checkpoint, the entries plus offset 4, and uploads it to durable storage, sending only what changed: 8 uploads, not 14.',
        'After a crash, restart recovery loads the checkpoint, seeks the stream to the offset, and replays the rest back into the processor: 23 plus 22 is 45.',
        'Three things to remember: the local store and the remote checkpoint are two roles, incremental uploads are free, and the atomic commit of the pair is required, not built.'
      ]
    },

    /* ---------- 10 · the settings ---------- */
    {
      title: 'Often', layout: 'ask', defines: ['at-least-once'],
      eyebrow: '10 · Your turn · the frequency setting',
      heading: 'How often should the processor checkpoint?',
      stand: 'Some processors skip the careful commit; then, after a crash, events since the last checkpoint may be applied twice. With a checkpoint every 3 events, the worst such gap holds 13 points.',
      question: {
        step: 0,
        prompt: 'What should the checkpoint interval be derived from?',
        options: [
          { text: 'The recovery time you can tolerate after a crash.', correct: true,
            why: 'Recovery time is events since the last checkpoint over replay speed. Start there, then see how wrong at-least-once could be.' },
          { text: 'The upload cost you would like to pay each hour.', correct: false,
            why: 'Lengthening the interval to save uploads quietly lengthens recovery and widens the double-count window.' },
          { text: 'Nothing: every interval recovers correctly anyway.', correct: false,
            why: 'With the careful commit, yes; but the interval still sets recovery time, and without it, how wrong a total can be.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'At-least-once', html: '<p>Applying each event <b>at least once</b>, maybe twice, is at-least-once. At a checkpoint every 3 events, up to 13 of 45 can be double-counted.[[src:why]]</p>' },
        { step: 2, title: 'If that is too much', html: '<p>If the bound is unacceptable, you need exactly-once recovery — the atomic commit — rather than an ever shorter interval.[[src:when]]</p>' }
      ],
      narration: [
        'The frequency setting. Without the careful commit, events since the last checkpoint may be applied twice: with one every 3 events, up to 13 points. What should the interval be derived from? Choose an answer.',
        'The recovery time you can tolerate, and then check the error bound it implies. Applying each event at least once, maybe twice, is called at-least-once: here up to 13 of 45 double-counted.',
        'And if that bound is unacceptable, the fix is exactly-once recovery, the atomic commit, rather than an ever shorter interval.'
      ]
    },

    /* ---------- 11 · what it does not settle ---------- */
    {
      title: 'Gaps', layout: 'ask', defines: ['watermark', 'retention'],
      eyebrow: '11 · Your turn · what this design does not settle',
      heading: 'The checkpoint is old, and the stream has moved on',
      stand: 'The stream only keeps events for so long. Suppose the last checkpoint is at offset 4, but the stream has already thrown events 5 to 8 away.',
      question: {
        step: 0,
        prompt: 'What can recovery do?',
        options: [
          { text: 'Replay from offset 0 instead.', correct: false,
            why: 'Offset 0 is older still. If events 5 to 8 are gone, everything before them is gone too.' },
          { text: 'Nothing correct: the events it must replay no longer exist.', correct: true,
            why: 'Recovery is only as good as the stream’s retention: how long it keeps events limits how stale a checkpoint may be.' },
          { text: 'Load the checkpoint and skip the missing events.', correct: false,
            why: 'That silently drops 22 points. The result would look fine and be wrong.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'It does NOT…', html: '<ul class="l"><li>build the atomic commit it requires;</li><li>outlive the stream’s <b>retention</b> — how long the stream keeps events.[[src:when]]</li></ul>' },
        { step: 2, title: '…nor bound the rest', html: '<ul class="l"><li>free a@480: 1 of 7 entries is never passed by the <b>watermark</b>, the estimate of how far event time has got, so it is checkpointed for ever;</li><li>limit barrier waits: 2 records buffered here, more with skewed sources.[[src:when]]</li></ul>' }
      ],
      narration: [
        'What the design does not settle. The stream keeps events only for so long. The checkpoint is at offset 4, but events 5 to 8 are already gone. What can recovery do? Choose an answer.',
        'Nothing correct. How long the stream keeps events is called its retention, and it limits how stale a checkpoint may be. That is one gap. The atomic commit, required but not built, is another.',
        'Two more. One entry of 7 is never passed by the watermark, the estimate of how far event time has got, so it is checkpointed for ever. And barrier waits are unbounded: 2 records buffered here.'
      ]
    },

    /* ---------- 12 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '12 · The design, in five sentences',
      heading: 'One equation, one requirement, four gaps',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Stream</b>', 'Delivers events with an offset it can replay from.', 'What must recovery re-read?[[src:stream]]'] },
          { step: 0, cells: ['<b>Processor</b>', 'Folds events into a local state store: 4 entries, 23.', 'Where do the totals live?[[src:proc]]'] },
          { step: 1, cells: ['<b>Checkpoint</b>', 'Entries + offset 4, at a barrier, as a snapshot.', 'What must be saved?[[src:cp]]'] },
          { step: 1, cells: ['<b>Durable storage</b>', 'Holds the checkpoint off the machine; incremental, 8 not 14.', 'Where does it go?[[src:dur]]'] },
          { step: 2, cells: ['<b>Recovery</b>', 'Load 23, seek offset 4, replay 22: 45. Torn commit: 68.', 'What makes it correct?[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Not settled', html: '<p>The atomic commit (required, not built); the entry the watermark never frees; unbounded barrier waits; and the stream’s retention.[[src:when]]</p>' },
      narration: [
        'To recap. The stream delivers events with an offset it can replay from. The processor folds them into a local state store: 4 entries holding 23.',
        'At a barrier, a checkpoint saves the entries and offset 4 as a snapshot, and durable storage keeps it off the machine, uploading only changes: 8 instead of 14.',
        'Recovery loads 23, seeks offset 4 and replays 22, reaching 45. A torn commit reaches 68, which is why the pair must be committed atomically.',
        'And four things are not settled: the atomic commit itself, the entry the watermark never frees, unbounded barrier waits, and the stream’s retention.'
      ]
    }
  ]
};
