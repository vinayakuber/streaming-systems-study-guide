// Chapter 7, Part 3 — "Consistency and recovery", for a viewer who has read nothing before it.
// The story, both clocks, the window, the offset and the checkpoint are re-introduced, so the
// deck stands alone. The barrier's alignment, the three recoveries from one crash and the
// at-least-once error bound are animated from the one seed; every number the narration quotes
// is recomputed below, so the deck fails to build if the data changes.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch07';
const E = seed.EVENTS;
const winOf = seed.winOf;
// barrier injected after each source's second record (the keys are the two sources)
const nth = (k, n) => E.map((e, i) => [e, i]).filter(([e]) => e.key === k)[n - 1][1];
const BAR = { a: nth('a', 2), b: nth('b', 2) };
const LATEST = Math.max(BAR.a, BAR.b);
const HELD = E.map((e, i) => (i > BAR[e.key] && i < LATEST ? 'held' : i <= LATEST ? 'before' : 'after'));
const HELD_IDS = E.filter((_, i) => HELD[i] === 'held').map(e => e.id);
const PREFIX = E.slice(0, 5).reduce((s, e) => s + e.v, 0);
const AFTER = E.slice(5).reduce((s, e) => s + e.v, 0);
const ALL = PREFIX + AFTER;
// at-least-once error bound with a checkpoint every 3 events: the most the events since the
// last checkpoint can hold before the next one is taken
const RISK = [[0, 1], [3, 4], [6, 7]].map(([a, b]) => E[a].v + E[b].v);

if (BAR.a !== 1 || BAR.b !== 5 || LATEST - BAR.a !== 4 || HELD_IDS.join() !== '3,4' || PREFIX !== 23 || AFTER !== 22
  || ALL !== 45 || PREFIX + ALL !== 68 || Math.round(100 * AFTER / ALL) !== 49 || RISK.join() !== '8,8,13'
  || E.length !== 9 || winOf(E[8].et) !== 480)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Three Recoveries, One Crash',
  eyebrow: 'Streaming · Ch 7 · Part 3',
  ...shared,
  jargon: ['event', 'key', 'value', 'stream', 'pipeline', 'event time', 'processing time', 'window', 'offset',
    'entry', 'state', 'checkpoint', 'replay', 'source', 'stage', 'barrier', 'alignment', 'atomic',
    'at-least-once', 'exactly-once', 'sink', 'idempotent', 'watermark', 'allowed lateness'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    flow:  section(CH, 'Consistency and recovery', 'Chapter 7 · consistency and recovery'),
    why:   section(CH, 'Why alignment costs something, and why half a checkpoint is wrong rather than stale', 'Chapter 7 · alignment, and half a checkpoint'),
    when:  section(CH, 'When to pay for exactly-once recovery, and what bounds the state', 'Chapter 7 · when to pay for exactly-once'),
    mem:   section(CH, 'Barrier alignment, and three recoveries from one crash', 'Chapter 7 · alignment and recoveries, as a program'),
    pair:  section(CH, 'Why a checkpoint is two things, and why the frequency is never free', 'Chapter 7 · a checkpoint is two things')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 7 · Part 3',
      heading: 'One crash, three ways back, and only one of them right',
      hero: { step: 0, text: 'An app records what two users, <code>a</code> and <code>b</code>, do. Each action is an <b>event</b> naming its user, its <b>key</b>, and carrying a number, its <b>value</b>, like points. Events arrive with no end: a <b>stream</b>. A program called a <b>pipeline</b> keeps running totals, saves copies of them, and after a crash must carry on as if nothing happened.[[src:flow]]' },
      tiles: [
        { step: 1, value: 45, label: 'the total if nothing ever crashed[[src:why]]' },
        { step: 1, value: 68, label: 'the total when the saved position is lost[[src:why]]' },
        { step: 2, value: 22, label: 'the total when the saved totals are lost[[src:why]]' },
        { step: 2, value: 2, label: 'events held back while copies are lined up[[src:why]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'How do several inputs save at one point?', text: 'A marker flows with the events, and waiting for it costs something.' },
        { step: 3, n: 2, title: 'Why is half a saved copy wrong?', text: 'Its two halves fail in opposite directions.' },
        { step: 4, n: 3, title: 'How wrong can a cheaper recovery be?', text: 'As wrong as the gap between saved copies.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app records what two users, A and B, do. Each action is an event, naming its user, its key, and carrying a number, its value. Events arrive with no end: a stream.',
        'A program called a pipeline keeps running totals. With no crash, they come to 45. Recover one way after a crash and you get 68.',
        'Recover another way and you get 22. And lining up the saved copies forces 2 events to wait. We will reach every one of these numbers.',
        'This part asks how several inputs can save their totals at one point, and why half a saved copy is not slightly out of date, but wrong.',
        'And how wrong a cheaper kind of recovery can be. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'window', 'offset'],
      eyebrow: '02 · The nine events, two clocks, and a position',
      heading: 'Two clocks, a window, and a position',
      stand: 'The events in the order the pipeline saw them. Times are seconds after 12:00.',
      table: {
        columns: ['offset', 'key', 'happened at', 'seen at', 'window', 'value'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 6 ? 1 : 2,
          cells: [`<b>${i}</b>`, `<code>${e.key}</code>`, `${e.et} s`, `${e.pt} s`, `${winOf(e.et)}`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words', html: '<ul class="l"><li><b>Event time</b> — when it happened. <b>Processing time</b> — when the pipeline saw it.</li><li><b>Window</b> — a 120-second stretch of event time, named by its start.</li><li><b>Offset</b> — an event’s position in the order seen, from 0.[[src:flow]]</li></ul>' },
      narration: [
        'Here are the 9 events in the order the pipeline saw them. Each has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'Totals are kept per user for each 120-second stretch of event time, called a window. Event 4 happened at 245 seconds, so it belongs to window 240.',
        'Event 7 happened at 50 seconds but was seen at 280, so it is late, yet it still belongs to window 0. Its position in the order seen is 7: that position is called its offset.',
        'So event time picks the window, and the order seen gives the offset. The offset is how the pipeline says where in the stream it has got to.'
      ]
    },

    /* ---------- 3 · state and checkpoint, re-introduced ---------- */
    {
      title: 'Pair', layout: 'array', defines: ['entry', 'state', 'checkpoint', 'replay'],
      eyebrow: '03 · What a saved copy holds',
      heading: 'Totals, plus the offset they were taken at',
      stand: 'After offset 4 the pipeline holds four running totals, one per key per window. A copy of them is saved, together with the offset 4.',
      array: {
        labelWidth: 150, slotLabel: 'slot',
        rows: [
          { label: 'key@window', values: ['a@0', 'b@0', 'a@120', 'a@240'] },
          { label: 'total', values: [8, 7, 2, 6] }
        ],
        meters: ['totals saved', 'points saved'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 380 }
        ]
      },
      cards: [
        { step: 0, title: 'Entry and state', html: '<p>One running total per key per window is an <b>entry</b>; all the entries are the <b>state</b>.[[src:pair]]</p>' },
        { step: 1, title: 'Checkpoint', html: '<p>A saved copy of the state <b>plus the offset</b> it matches is a <b>checkpoint</b>: { 4 entries holding 23, offset 4 }.[[src:pair]]</p>' },
        { step: 2, title: 'Replay', html: '<p>After a crash: load the entries, then read the stream again from offset 5. Reading it again is a <b>replay</b>.[[src:why]]</p>' }
      ],
      narration: [
        'After offset 4, the pipeline holds four running totals, one per key per window. One total is called an entry, and all the entries together are called the state.',
        'A copy of them is saved: 4 entries, holding 23 points, together with the offset they match, 4. That pair is called a checkpoint.',
        'After a crash, the pipeline loads the entries and reads the stream again from offset 5. Reading the stream again is called a replay. This part asks what can go wrong with that.'
      ]
    },

    /* ---------- 4 · question: several inputs ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['source', 'stage', 'barrier'],
      eyebrow: '04 · Your turn',
      heading: 'Two inputs, one saved copy',
      stand: 'Now user a’s events arrive through one input and user b’s through another. A step of the pipeline reads both and keeps the totals. Its saved copy must match one point in both inputs at once.',
      question: {
        step: 0,
        prompt: 'How can that step know when to take its copy?',
        options: [
          { text: 'A marker is slipped into each input; it saves once the marker has come through every input.', correct: true,
            why: 'The marker travels in order with the events, so “before the marker” means the same thing in every input.' },
          { text: 'It saves at a fixed clock time, say every minute on the dot.', correct: false,
            why: 'Each input is at a different point when the clock ticks, so the copy would match no single position.' },
          { text: 'It saves whenever one of the two inputs goes quiet.', correct: false,
            why: 'The other input may be mid-stream then, so the copy mixes old totals from one with new from the other.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Source and stage', html: '<p>Each input is a <b>source</b>. Each step that does work on the events is a <b>stage</b>.[[src:flow]]</p>' },
        { step: 1, title: 'Barrier', html: '<p>The marker is a <b>barrier</b>. A stage saves its state when it has seen the barrier from <b>every</b> input, so all stages save at one logical point (Chandy–Lamport).[[src:why]]</p>' },
        { step: 2, title: 'Here', html: '<p>The two keys act as two sources. Each barrier is slipped in after that source’s second event.[[src:why]]</p>' }
      ],
      narration: [
        'First question. Now user A’s events come through one input and user B’s through another. One step reads both and keeps the totals. How does it know when to save its copy? Choose an answer.',
        'A marker is slipped into each input, and the step saves once the marker has come through every input. Each input is called a source, each working step a stage, and the marker a barrier.',
        'In our example, the two users act as the two sources, and each barrier comes right after that source’s second event. Watch what the stage has to do while it waits.'
      ]
    },

    /* ---------- 5 · alignment, animated ---------- */
    {
      title: 'Align', layout: 'array', defines: ['alignment'],
      eyebrow: '05 · Watch the stage wait for the second barrier',
      heading: 'One barrier arrives early, the other late',
      stand: 'Source a’s barrier comes right after offset 1; source b’s right after offset 5. Between the two, a’s events have already passed their own barrier.',
      array: {
        labelWidth: 150, slotLabel: 'offset',
        rows: [
          { label: 'source', values: E.map(e => e.key) },
          { label: 'what happens', values: HELD }
        ],
        meters: ['events checked', 'held back'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'pick', slots: [BAR.a, BAR.b] },
          { step: 2, do: 'show', rows: [1] },
          { step: 2, do: 'sweep', row: 1, mode: 'match', match: 'held', readMeter: 0, resultMeter: 1, speed: 300 }
        ]
      },
      cards: [
        { step: 2, title: 'Held, not added', html: '<p>Events 3 and 4 come from a, after a’s barrier. They belong to the <b>next</b> copy, so they are buffered, not added.[[src:why]]</p>' },
        { step: 3, title: 'Alignment', html: '<p>Waiting for the latest barrier is <b>alignment</b>: here 4 events long, with 2 held. With badly lopsided sources, that wait is the delay people notice.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 9 events by source, in the order seen. Source A’s second event is at offset 1, and source B’s second event is at offset 5.',
        'So source A’s barrier arrives right after offset 1, and source B’s only after offset 5. Until it has both, the stage cannot take its copy.',
        'Watch each event checked. Events 3 and 4 are from A, but A’s barrier has already passed. They belong to the next copy, so they are held back, not added: 2 held.',
        'Waiting for the latest barrier is called alignment. Here the stage was aligning for 4 events and held 2. When sources are badly lopsided, that wait is the delay people notice.'
      ]
    },

    /* ---------- 6 · question: why hold them ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '06 · Your turn',
      heading: 'Why not just add events 3 and 4?',
      stand: 'The copy will be taken once b’s barrier arrives, and it will say: everything up to the barriers is inside.',
      question: {
        step: 0,
        prompt: 'What goes wrong if the stage adds events 3 and 4 before taking its copy?',
        options: [
          { text: 'Nothing: they arrived first, so they belong in the copy.', correct: false,
            why: 'They arrived first, but after a’s own barrier. The copy claims to hold only what came before each barrier.' },
          { text: 'The copy holds them, yet says they come after it, so a replay adds them twice.', correct: true,
            why: 'On recovery, a is read again from just after its barrier, which includes events 3 and 4 a second time.' },
          { text: 'The stage runs out of memory holding them.', correct: false,
            why: 'Holding two events costs almost nothing. The cost of holding is delay, not memory.' }
        ]
      },
      cards: [
        { step: 1, title: 'One logical point', html: '<p>Holding them keeps the copy honest: everything before the barriers is inside, nothing after. That is what makes the snapshot consistent across stages and sources.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. The copy will say: everything before the barriers is inside. What goes wrong if events 3 and 4 are added before it is taken? Choose an answer.',
        'The copy would hold them while saying they come after it, so a replay would add them a second time. Holding them back keeps the copy at one logical point, for every source.'
      ]
    },

    /* ---------- 7 · question: half a checkpoint ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['atomic'],
      eyebrow: '07 · Your turn',
      heading: 'A crash after event 8, and half a checkpoint',
      stand: 'The checkpoint should be { 4 entries holding 23, offset 4 }. Suppose the offset survived but the saved entries were lost.',
      question: {
        step: 0,
        prompt: 'Recovery starts from empty totals and replays from offset 5. What total does it reach?',
        options: [
          { text: 'Too high: events 0 to 4 are counted twice.', correct: false,
            why: 'That is the other half going missing. Here events 0 to 4 are never read at all, so they cannot be counted twice.' },
          { text: 'The right total, 45, only later than usual.', correct: false,
            why: 'Nothing ever puts events 0 to 4 back. The replay starts at 5, and the totals that held them are gone.' },
          { text: 'Too low: only events 5 to 8 are added, 22.', correct: true,
            why: 'The 23 points of events 0 to 4 lived only in the lost entries. The replay never revisits them.' }
        ]
      },
      cards: [
        { step: 1, title: 'Atomic, again', html: '<p>The entries and the offset must be written <b>atomically</b> — both or neither — because each half alone gives a wrong total, not a late one.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. The offset 4 survived, but the saved entries were lost. Recovery starts from empty totals and replays from offset 5. What total does it reach? Choose an answer.',
        'Too low: only events 5 to 8 are added, 22. The 23 points of events 0 to 4 are simply missing. So the pair must be written atomically, both halves or neither. The next slide shows all three cases.'
      ]
    },

    /* ---------- 8 · three recoveries, animated ---------- */
    {
      title: 'Three', layout: 'array',
      eyebrow: '08 · Watch three recoveries from the same crash',
      heading: 'Right, too high, too low',
      stand: 'Each slot is one way back after the crash: what is loaded, what the replay adds, and the total it ends on.',
      array: {
        labelWidth: 150, slotLabel: 'recovery',
        rows: [
          { label: 'what survived', values: ['entries + offset', 'entries only', 'offset only'] },
          { label: 'loaded', values: [PREFIX, PREFIX, 0] },
          { label: 'replayed', values: [AFTER, ALL, AFTER] },
          { label: 'total', values: [PREFIX + AFTER, PREFIX + ALL, AFTER] }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'pick', slots: [0] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The matching pair', html: '<p>23 loaded + 22 replayed = <b>45</b>: indistinguishable from a run that never crashed.[[src:mem]]</p>' },
        { step: 2, title: 'Opposite directions', html: '<p>Entries without their offset: replay from 0, <b>68</b>, over by 23. Offset without its entries: <b>22</b>, under by the same 23. Half a checkpoint is wrong, not stale.[[src:why]]</p>' }
      ],
      narration: [
        'Here are three recoveries from the same crash. Each column shows what survived, what is loaded, and what the replay adds.',
        'With both halves, 23 is loaded and 22 replayed: 45, exactly as if nothing had crashed.',
        'With the entries but no offset, the replay starts at 0 and adds 45 on top of 23: 68, over by 23. With the offset but no entries: 22, under by the same 23. The two failures are wrong in opposite directions.'
      ]
    },

    /* ---------- 9 · question: at-least-once ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['at-least-once', 'exactly-once'],
      eyebrow: '09 · Your turn',
      heading: 'A cheaper recovery that may add some events twice',
      stand: 'Some pipelines skip the careful lining-up. After a crash, the events since the last checkpoint may then be added twice. The last checkpoint is at offset 4.',
      question: {
        step: 0,
        prompt: 'Out of the true 45, how many points can such a recovery count twice?',
        options: [
          { text: 'Up to 22: the points of events 5 to 8.', correct: true,
            why: 'Only events after the checkpoint are replayed. Their points, 1 + 9 + 4 + 8, are what can land twice.' },
          { text: 'Up to 45: every point in the stream.', correct: false,
            why: 'Events 0 to 4 are inside the checkpoint and are not replayed, so they cannot be added again.' },
          { text: 'None: a checkpoint prevents any double count.', correct: false,
            why: 'Only if state and offset are lined up and committed together. That is exactly what this cheaper mode skips.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'At-least-once', html: '<p>Every event is applied <b>at least once</b>, maybe twice: up to <b>22</b> double-counted here, <b>49%</b> of the 45 total.[[src:why]]</p>' },
        { step: 2, title: 'Exactly-once', html: '<p>Lines up state and offsets so each event is applied <b>exactly once</b>. It pays with alignment, plus a two-step commit at the output.[[src:why]]</p>' }
      ],
      narration: [
        'Fourth question. A cheaper recovery skips the lining-up, so events since the last checkpoint may be added twice. The checkpoint is at offset 4. How many points can count twice? Choose an answer.',
        'Up to 22, the points of events 5 to 8. This mode is called at-least-once: every event is applied at least once, maybe twice. 22 is 49 percent of the true 45.',
        'The careful mode is called exactly-once: state and offsets are lined up so each event is applied exactly once. It pays with alignment, plus a two-step commit at the output.'
      ]
    },

    /* ---------- 10 · the interval is the error bound ---------- */
    {
      title: 'Bound', layout: 'array',
      eyebrow: '10 · Watch the interval set the error',
      heading: 'The gap between checkpoints is the error bound',
      stand: 'A checkpoint every 3 events, after offsets 2, 5 and 8. A crash just before each one replays the two events since the last.',
      array: {
        labelWidth: 190, slotLabel: 'gap',
        rows: [
          { label: 'events at risk', values: ['0 and 1', '3 and 4', '6 and 7'] },
          { label: 'points that may count twice', values: RISK }
        ],
        meters: ['gaps checked'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'count', readMeter: 0, speed: 500 },
          { step: 1, do: 'pick', slots: [2] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Worst case: 13', html: '<p>Events 6 and 7 hold 9 + 4 = <b>13</b>. That is the most an at-least-once recovery can over-count with a checkpoint every 3 events.[[src:mem]]</p>' },
        { step: 2, title: 'The coupling', html: '<p>The interval chosen for uploads and recovery time also sets the worst double count. Lengthen it to save uploads, and the error window quietly widens.[[src:why]]</p>' }
      ],
      narration: [
        'Here the checkpoint comes every 3 events. A crash just before a checkpoint replays the two events since the last one: these are the points that may count twice.',
        'Events 0 and 1 hold 8, events 3 and 4 hold 8, and events 6 and 7 hold 13. So with a checkpoint every 3 events, the worst over-count is 13.',
        'So the interval does a second job. Chosen for uploads and recovery time, under at-least-once it is also the bound on how wrong an answer can be.'
      ]
    },

    /* ---------- 11 · question: when to pay ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['sink', 'idempotent'],
      eyebrow: '11 · Your turn',
      heading: 'Is exactly-once worth its price?',
      stand: 'The pipeline writes its totals into a store keyed by key@window. Writing the same total for the same entry twice leaves the store exactly as it was.',
      question: {
        step: 0,
        prompt: 'Should this pipeline pay for exactly-once recovery?',
        options: [
          { text: 'Yes: anything less can count points twice.', correct: false,
            why: 'A replayed write here repeats the same total into the same place. Nothing is counted twice in the result.' },
          { text: 'No: a repeated write changes nothing, so at-least-once is enough.', correct: true,
            why: 'The duplicate is harmless, so the alignment and two-step commit would buy nothing. This is the common, correct choice.' },
          { text: 'Only if the checkpoints are taken rarely.', correct: false,
            why: 'The interval decides how much is replayed. Whether a replay hurts is decided by the output, not the interval.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Sink, idempotent', html: '<p>Where results are written is the <b>sink</b>. A sink where repeating a write changes nothing is <b>idempotent</b>; then at-least-once is enough.[[src:when]]</p>' },
        { step: 2, title: 'Otherwise', html: '<p>Pay for exactly-once when a duplicate is visible or expensive. If you accept at-least-once, shorten the interval on purpose: it is your error bound.[[src:when]]</p>' }
      ],
      narration: [
        'Fifth question. The totals are written into a store keyed by key and window, where writing the same total twice changes nothing. Should this pipeline pay for exactly-once? Choose an answer.',
        'No. Where results are written is called the sink, and one where a repeated write changes nothing is called idempotent. A replay there is harmless, so at-least-once is the right choice.',
        'Pay for exactly-once when a duplicate would be visible or expensive. And if you accept at-least-once, shorten the interval on purpose, because the interval is your error bound.'
      ]
    },

    /* ---------- 12 · question: what bounds the state ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['watermark', 'allowed lateness'],
      eyebrow: '12 · Your turn',
      heading: 'Recovery is safe. Is the state bounded?',
      stand: 'The 9 events make 7 entries. The last event, at 540 s, opens window 480, which ends at 600 s. No later event ever arrives.',
      question: {
        step: 0,
        prompt: 'What is the only thing that lets the pipeline throw a finished entry away?',
        options: [
          { text: 'The checkpoint: anything saved can be dropped from memory.', correct: false,
            why: 'A checkpoint copies the entries; it never decides that one is finished. It faithfully saves the unfinished ones too.' },
          { text: 'Its estimate of event time passing the window’s end, plus a set grace period.', correct: true,
            why: 'Once event time is known to be past the window’s end and its grace period, no more events for it are accepted.' },
          { text: 'A restart: it clears whatever was in memory.', correct: false,
            why: 'With checkpoints, a restart restores every entry, finished or not. That is the point of saving them.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Watermark and allowed lateness', html: '<p>The estimate of how far event time has got is the <b>watermark</b>; the grace period after a window’s end is the <b>allowed lateness</b>. Together they are the only garbage collector.[[src:flow]]</p>' },
        { step: 2, title: '1 of 7 is never freed', html: '<p>No event lifts the watermark past 600, so entry a@480 is held for ever. A restart used to clear it by accident; a durable checkpoint restores it faithfully.[[src:when]]</p>' }
      ],
      narration: [
        'Sixth question. The last event opens window 480, which ends at 600 seconds, and no later event arrives. What is the only thing that lets the pipeline throw a finished entry away? Choose an answer.',
        'Its estimate of event time, called the watermark, passing the window’s end plus a grace period, called the allowed lateness. Together they are the only way state is ever freed.',
        'And here nothing lifts the watermark past 600, so entry A at 480 is held for ever. A restart used to clear it by accident. With checkpoints, it is restored faithfully, every time.'
      ]
    },

    /* ---------- 13 · what it does not settle, and recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'Line up, commit together, and know your error bound',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Barrier</b> and <b>alignment</b>', 'A stage saves once the barrier has come through every source. Here: 4 events of waiting, events 3 and 4 held.[[src:why]]'] },
          { step: 1, cells: ['<b>Atomic</b>', 'Entries + offset: 45. Entries only: 68. Offset only: 22. Each half alone is wrong.[[src:mem]]'] },
          { step: 2, cells: ['<b>At-least-once</b>', 'Up to 22 of 45 counted twice; every 3 events, at most 13. Fine when the sink is idempotent.[[src:when]]'] },
          { step: 2, cells: ['<b>Exactly-once</b>', 'Alignment plus a two-step commit at the output, for when a duplicate is visible or costly.[[src:when]]'] },
          { step: 3, cells: ['<b>Watermark</b>', 'With allowed lateness, the only thing that frees state. a@480 is never freed.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Still unsettled', html: '<p>Every correct recovery here <b>assumed</b> the pair was committed atomically. Against a local store that is a transaction; against an outside sink it is a distributed commit, which this chapter names as a requirement rather than solves.[[src:when]]</p>' },
      narration: [
        'To recap. A barrier flows with the events, and a stage saves once it has come through every source. Here it waited 4 events and held back events 3 and 4.',
        'Entries and offset together give 45. Entries alone give 68, the offset alone gives 22. So the pair must be committed atomically.',
        'At-least-once can count up to 22 of 45 twice, or 13 with a checkpoint every 3 events, which is fine when the sink is idempotent. Exactly-once costs alignment and a two-step commit.',
        'And the watermark, with its allowed lateness, is the only thing that frees state. One assumption is left open: that the pair really is committed atomically, which the system design must require.'
      ]
    }
  ]
};
