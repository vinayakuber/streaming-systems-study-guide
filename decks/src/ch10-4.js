// Chapter 10, Part 4 — the chapter's "System Design Interview": a data-processing system that
// survives a bug fix. Built one component at a time (the log, the one pipeline, the speed
// result, the replay path), each preceded by a question; then assembled, compared with Lambda
// by count, and closed with the four things it does not settle. The shop story, the two clocks
// and every word are re-introduced so the deck stands alone; every number is the seed's.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch10';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const arrOf = pt => Math.floor(pt / seed.WIN) * seed.WIN;
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const BY_ET = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const BY_PT = seed.WIN_STARTS.map(w => E.filter(e => arrOf(e.pt) === w).reduce((a, e) => a + e.v, 0));
const OFF = BY_ET.reduce((a, v, i) => a + Math.abs(v - BY_PT[i]), 0);
const WRONG = BY_ET.filter((v, i) => v !== BY_PT[i]).length;
const buggy = e => (e.key === 'a' ? Math.floor(e.v / 2) : e.v);
const A = E.filter(e => e.key === 'a');
const per = (f, k) => E.filter(e => e.key === k).reduce((s, e) => s + f(e), 0);
const BUG_TOTAL = E.reduce((s, e) => s + buggy(e), 0);
const KEPT = 6, SHORT = E.slice(E.length - KEPT).reduce((s, e) => s + e.v, 0);
const REPLAYS = [['all 9 kept', E.length, TOTAL, 'yes'], ['6 kept', KEPT, SHORT, 'no'], ['reads the clock', E.length, TOTAL, 'no']];

if (E.length !== 9 || TOTAL !== 45 || BY_ET.join() !== '19,11,7,8' || OFF !== 26 || WRONG !== 3
  || A.map(buggy).join() !== '2,1,1,3,4' || per(buggy, 'a') !== 11 || per(e => e.v, 'a') !== 24 || per(e => e.v, 'b') !== 21
  || per(buggy, 'b') !== 21 || BUG_TOTAL !== 32 || SHORT !== 30 || seed.closedAt(480) !== null || seed.SUM(seed.WINDOWS[480]) !== 8)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Surviving a Bug Fix',
  eyebrow: 'Streaming · Ch 10 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'log', 'offset', 'replay',
    'retention', 'source of truth', 'codebase', 'Lambda architecture', 'drift', 'speed result', 'invariant',
    'deterministic', 'final'],
  sources: {
    ch:     chapter(CH, 'Chapter 10 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 10 · system design interview'),
    log:    section(CH, 'log (replayable)', 'Chapter 10 · the log'),
    pipe:   section(CH, 'one streaming pipeline', 'Chapter 10 · one streaming pipeline'),
    speed:  section(CH, 'speed result', 'Chapter 10 · the speed result'),
    replay: section(CH, 'replay path -> corrected result', 'Chapter 10 · the replay path'),
    why:    section(CH, 'Why only one box in this design cannot be rebuilt', 'Chapter 10 · the one box that cannot be rebuilt'),
    when:   section(CH, 'When this architecture holds, and the four things it does not settle', 'Chapter 10 · what this design does not settle'),
    walk:   section(CH, 'Visual walkthrough — four boxes, one incident, the counted comparison', 'Chapter 10 · the walkthrough'),
    prog:   section(CH, 'Surviving a bug fix — stack and heap at every step', 'Chapter 10 · surviving a bug fix as a program'),
    lam:    section(CH, "Why Lambda's cost is a second implementation, and Kappa's is retention", 'Chapter 10 · Lambda’s cost')
  },

  slides: [
    /* ---------- 1 · the brief, as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 10 · Part 4 · a system design interview',
      heading: 'Design a system that survives a bug fix',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a small message carrying its value: an <b>event</b>. Events keep coming with no end: a <b>stream</b>. The program that works out the shop’s totals from them is the <b>pipeline</b>. One day a bug ships in it.[[src:sd]]' },
      tiles: [
        { step: 1, value: 9, label: 'events so far' },
        { step: 1, value: TOTAL, label: 'their true total[[src:why]]' },
        { step: 2, value: BUG_TOTAL, label: 'what the buggy pipeline reports[[src:why]]' },
        { step: 2, value: 1, label: 'place the fix should have to land[[src:why]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'Where history lives', text: 'So the past can be worked out again.' },
        { step: 3, n: 2, title: 'How many copies of the logic', text: 'So a fix lands once, and only once.' },
        { step: 4, n: 3, title: 'How a correction is made and checked', text: 'And what the design still cannot promise.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the design is assembled, counted against the old way, and its gaps named.[[src:sd]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value, called an event. Events keep coming with no end: a stream.',
        'The program that works out the shop’s totals is called the pipeline. So far there are 9 events, worth 45 in total.',
        'One day a bug ships, and the pipeline reports 32 instead of 45. The interviewer asks: design a system in which fixing that takes one edit, in 1 place.',
        'The design must decide where history lives, so the past can be worked out again, and how many copies of the logic exist, so the fix lands once.',
        'And how a correction is made and checked, and what the design still cannot promise. Before each component, you will choose.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'key', 'window'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Times are shown to the minute.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 7 ? `<b>${hm(e.et)}</b>` : hm(e.et), i === 7 ? `<b>${hm(e.pt)}</b>` : hm(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b.</li><li><b>Window</b> — a stretch of event time one total covers: 12:00 to 12:02, 12:02 to 12:04, and so on. Ours give 19, 11, 7 and 8.[[src:lam]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened and was seen at 12:00.',
        'Usually the two are seconds apart, so to the minute they match. Id 4 happened and was seen at 12:04.',
        'But id 7 happened at 12:00 and was not seen until 12:04, because its phone was offline.',
        'Which phone sent an event is its key. And the shop’s totals are per window: a 2-minute stretch of event time. By when things happened, the four windows hold 19, 11, 7 and 8.'
      ]
    },

    /* ---------- 3 · component 1: the log ---------- */
    {
      title: 'Log', layout: 'ask', defines: ['log', 'offset', 'replay', 'retention'],
      eyebrow: '03 · Your turn · component 1, where history lives',
      heading: 'After the fix, the past must be worked out again',
      stand: 'The fixed pipeline will be correct from now on. But the totals it already produced from the first 9 events are wrong.',
      question: {
        step: 0,
        prompt: 'What must the system have kept, so the past can be recomputed?',
        options: [
          { text: 'Every event, in order, ready to be read again from the start.', correct: true,
            why: 'With the events themselves, the corrected pipeline can simply read them all again and rebuild every total.' },
          { text: 'Every total it produced, so they can be corrected.', correct: false,
            why: 'The totals are what is wrong. Halving and rounding down cannot be undone from a total alone.' },
          { text: 'Nothing: ask the two phones to resend their purchases.', correct: false,
            why: 'The phones are not a store of history, and a system must not depend on its sources for that.' }
        ]
      },
      cards: [
        { step: 1, title: 'The log', html: '<p>A store that keeps every event in order and lets it be read again is a <b>log</b>. Each event’s position, 0 to 8, is its <b>offset</b>. Reading it again from the start is a <b>replay</b>.[[src:log]]</p>' },
        { step: 2, title: 'Retention', html: '<p>How long the log keeps events before deleting them is its <b>retention</b>. It must outlast the history you may need to recompute.[[src:log]]</p>' }
      ],
      narration: [
        'Component one. The fixed pipeline is correct from now on, but the totals already produced from the first 9 events are wrong. What must the system have kept? Choose an answer.',
        'Every event, in order. A store that keeps every event in order and lets it be read again is called a log. An event’s position in it is its offset, and reading it again from the start is a replay.',
        'How long the log keeps events before deleting them is called its retention. It must be long enough to re-run the pipeline whenever the code changes.'
      ]
    },

    /* ---------- 4 · the log, shown ---------- */
    {
      title: 'Offs', layout: 'array', defines: ['source of truth'],
      eyebrow: '04 · Watch the log fill',
      heading: 'Nine events at offsets 0 to 8',
      stand: 'Each slot is one offset in the log. Events are written in the order they arrive, and are never changed.',
      array: {
        labelWidth: 150, slotLabel: 'offset',
        rows: [
          { label: 'event id', values: E.map(e => e.id) },
          { label: 'phone', values: E.map(e => e.key) },
          { label: 'value', values: E.map(e => e.v) }
        ],
        meters: ['events kept', 'their total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 }
        ]
      },
      cards: [
        { step: 2, title: 'The source of truth', html: '<p>Every total can be rebuilt from these 9 events, so the log is the <b>source of truth</b>. It is the only box in the design that cannot be rebuilt from another.[[src:why]]</p>' }
      ],
      narration: [
        'Here is the log. Each slot is one offset, 0 to 8, holding one event: its id, its phone and its value. Events are written in arrival order and never changed.',
        'Watch the 9 values read in order: their total is 45, the true total, whatever the pipeline happens to report.',
        'Every result can be rebuilt from these events, so the log is called the source of truth. It is the one box in this design that cannot be rebuilt from any other.'
      ]
    },

    /* ---------- 5 · component 2: the one pipeline ---------- */
    {
      title: 'Pipe', layout: 'ask', defines: ['codebase', 'Lambda architecture', 'drift'],
      eyebrow: '05 · Your turn · component 2, how many copies of the logic',
      heading: 'One copy of the sum, or two?',
      stand: 'An older design, the Lambda architecture, runs two programs for the same sum: a slow one over whole files for correctness, and a fast one over arrivals for speed.',
      question: {
        step: 0,
        prompt: 'How many implementations of the shop’s sum should this design have?',
        options: [
          { text: 'One, used both for live events and for any replay.', correct: true,
            why: 'With a single implementation, a fix lands once and the live and replayed answers can never disagree.' },
          { text: 'Two: a slow correct one and a fast live one.', correct: false,
            why: 'That is the Lambda architecture. Its two copies drift apart: here 3 of 4 windows, by 26, with no bug.' },
          { text: 'One per window, so each total stays separate.', correct: false,
            why: 'Windows are data the sum is grouped by, not reasons to copy the code. One sum handles all 4.' }
        ]
      },
      cards: [
        { step: 1, title: 'One codebase', html: '<p>The body of code a system runs is its <b>codebase</b>. This design has one pipeline, and no separate batch implementation.[[src:pipe]]</p>' },
        { step: 2, title: 'What it rules out', html: '<p>Lambda’s two copies reach for different clocks and <b>drift</b>: 3 of 4 windows apart, by 26 in total. With one copy, that has nowhere to live.[[src:lam]]</p>' }
      ],
      narration: [
        'Component two. An older design, the Lambda architecture, runs two programs for the same sum: a slow one for correctness and a fast one for speed. How many should this design have? Choose an answer.',
        'One, used for live events and for every replay. The body of code a system runs is called its codebase, and this design has one, with no separate batch implementation.',
        'Lambda’s two copies drift: they come to compute different things. Each reaches for a different clock, leaving 3 of 4 windows apart by 26. With one copy, that drift has nowhere to live.'
      ]
    },

    /* ---------- 6 · component 3: the speed result ---------- */
    {
      title: 'Live', layout: 'ask', defines: ['speed result'],
      eyebrow: '06 · Your turn · component 3, the live output',
      heading: 'The bug ships. What does the shop see?',
      stand: 'The pipeline folds each new event into a running total, which the shop’s screen shows within seconds. The new code has a bug that halves phone a’s values.',
      question: {
        step: 0,
        prompt: 'Until the fix is deployed and replayed, what does the live total show?',
        options: [
          { text: 'A wrong total, 32: every event goes through the buggy code.', correct: true,
            why: 'The live output is just the current fold of the log through the current code. Buggy code gives a buggy total.' },
          { text: 'The right total, 45, because the log itself is still correct.', correct: false,
            why: 'The log is correct, but the live total is what the code makes of it, and the code is wrong.' },
          { text: 'Nothing at all: the pipeline stops until the bug is fixed.', correct: false,
            why: 'A bug like this raises no error. The pipeline keeps running and keeps reporting the wrong number.' }
        ]
      },
      cards: [
        { step: 1, title: 'The speed result', html: '<p>The live output is the <b>speed result</b>: low latency, and computed by the same code as any replay. Kappa has no speed layer; the name means only this live answer. A bug makes it wrong until a replay.[[src:speed]]</p>' }
      ],
      narration: [
        'Component three, the live output. The pipeline folds each event into a running total for the shop’s screen. A bug ships that halves phone a’s values. What does the live total show? Choose an answer.',
        'A wrong total, 32. The live output is called the speed result: fast, and computed by the same code as any replay, since Kappa has no speed layer. So a bug makes it wrong until a replay. Watch the bug at work.'
      ]
    },

    /* ---------- 7 · the bug, animated ---------- */
    {
      title: 'Bug', layout: 'array',
      eyebrow: '07 · Watch the bug at work',
      heading: 'Phone a’s 24 becomes 11',
      stand: 'Phone a’s five events. The bug halves each value and rounds down.',
      array: {
        labelWidth: 170, slotLabel: 'slot',
        rows: [
          { label: 'event id', values: A.map(e => e.id) },
          { label: 'true value', values: A.map(e => e.v) },
          { label: 'with the bug', values: A.map(buggy) }
        ],
        meters: ['events read', 'phone a’s total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 2, title: 'The incident', html: '<p>The pipeline reports phone a 11, phone b 21, total 32. The truth is phone a 24, phone b 21, total 45.[[src:why]]</p>' }
      ],
      narration: [
        'Here are phone a’s five events, with true values 5, 3, 2, 6 and 8: 24 together.',
        'The bug halves each and rounds down: 2, 1, 1, 3 and 4. Watch phone a’s total build to 11.',
        'So the pipeline reports phone a 11, phone b 21, total 32. The truth is phone a 24, phone b 21, total 45. Now the fix.'
      ]
    },

    /* ---------- 8 · component 4: the replay path ---------- */
    {
      title: 'Path', layout: 'ask',
      eyebrow: '08 · Your turn · component 4, the replay path',
      heading: 'The fix is deployed. Where does the replay start?',
      stand: 'The corrected pipeline is deployed once. The wrong totals came from every event phone a ever sent.',
      question: {
        step: 0,
        prompt: 'From which offset must the corrected pipeline replay the log?',
        options: [
          { text: 'From offset 0, the very start, through all 9 events.', correct: true,
            why: 'Every phone a event since the start was halved, so every event must be read again to rebuild the totals.' },
          { text: 'From offset 8, the newest event only.', correct: false,
            why: 'That rebuilds one event. The other four phone a values in the totals would still be halved.' },
          { text: 'From the moment the bug was fixed onwards.', correct: false,
            why: 'That only gets future events right. The wrong totals already published would stay wrong.' }
        ]
      },
      cards: [
        { step: 1, title: 'Rewind, then replay', html: '<p>The log is rewound to offset 0, the same pipeline, now fixed, folds all 9 events again, and the corrected result replaces the buggy one.[[src:replay]]</p>' }
      ],
      narration: [
        'Component four, the replay path. The fix is deployed once. From which offset must the corrected pipeline replay the log? Choose an answer.',
        'From offset 0, through all 9 events, because every phone a value was halved. The log is rewound, the same pipeline folds every event again, and the corrected result replaces the buggy one.'
      ]
    },

    /* ---------- 9 · the replay, animated ---------- */
    {
      title: 'Redo', layout: 'array',
      eyebrow: '09 · Watch the replay',
      heading: '9 events re-read: 32 becomes 45',
      stand: 'Each slot is one event in the log, by offset. Row 2: what the buggy pipeline made of it. Row 3: the fixed pipeline.',
      array: {
        labelWidth: 170, slotLabel: 'offset',
        rows: [
          { label: 'phone', values: E.map(e => e.key) },
          { label: 'buggy pipeline', values: E.map(buggy) },
          { label: 'fixed pipeline', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'buggy total', 'replayed total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 2, speed: 350 }
        ]
      },
      cards: [
        { step: 2, title: 'One edit, one replay', html: '<p>Phone a goes 11 to <b>24</b>, the total 32 to <b>45</b>. One edit, 9 events re-read, nothing migrated.[[src:replay]]</p>' }
      ],
      narration: [
        'Here is the log again. Watch the buggy pipeline’s values add up: 32.',
        'Now the fixed pipeline replays from offset 0. Watch the replayed total climb to 45.',
        'One edit, one replay of 9 events: phone a goes from 11 to 24, and the total from 32 to 45. Nothing was migrated. But how do you know this replay is right?'
      ]
    },

    /* ---------- 10 · the check ---------- */
    {
      title: 'Check', layout: 'ask', defines: ['invariant'],
      eyebrow: '10 · Your turn · verifying the replay',
      heading: 'The numbers changed. Are they now right?',
      stand: 'Before the replay: phone a 11, phone b 21. After: phone a 24, phone b 21. A replay that was wrong in a new way would also change numbers.',
      question: {
        step: 0,
        prompt: 'Which observation shows the replay reproduced history, rather than computing something else?',
        options: [
          { text: 'Phone b reads 21 both before and after.', correct: true,
            why: 'The bug never touched phone b. Its unchanged total shows the replay reproduced everything the fix should not alter.' },
          { text: 'Phone a’s total more than doubled, from 11 to 24.', correct: false,
            why: 'A change in the expected direction is not proof. A different mistake could produce it too.' },
          { text: 'The replay ran to the end without an error.', correct: false,
            why: 'A wrong replay also runs without an error. Silence is not evidence.' }
        ]
      },
      cards: [
        { step: 1, title: 'An invariant', html: '<p>A number a change must not affect, checked after it, is an <b>invariant</b>. Phone b at 21 is the one here.[[src:why]]</p>' },
        { step: 2, title: 'Always replay with one', html: '<p>A replay with nothing to check against is just a second computation, with no reason to prefer it.[[src:walk]]</p>' }
      ],
      narration: [
        'Before the replay, phone a read 11 and phone b 21. After it, phone a reads 24 and phone b 21. Which observation shows the replay reproduced history? Choose an answer.',
        'Phone b reads 21 before and after. The bug never touched phone b. A number a change must not affect, checked after it, is called an invariant.',
        'Always replay with one. A replay with nothing to check against is just a second computation, and you would have no reason to prefer it.'
      ]
    },

    /* ---------- 11 · the design, assembled ---------- */
    {
      title: 'Plan', layout: 'graph',
      eyebrow: '11 · The design, assembled',
      heading: 'Log, one pipeline, speed result, and the replay path',
      stand: 'The pipeline appears twice and is the same code both times. Only the log cannot be rebuilt.',
      graph: {
        viewBox: '0 0 1520 380', legend: true,
        nodes: [
          { id: 'log', x: 20, y: 136, w: 250, h: 108, title: 'Log', sub: 'replayable, retained', kind: 'hub', step: 0, src: 'log', values: ['offsets 0 to 8'] },
          { id: 'p1', x: 350, y: 20, w: 300, h: 108, title: 'One streaming pipeline', sub: 'the only codebase', kind: 'main', step: 1, src: 'pipe', values: [null, 'folds each event'] },
          { id: 'sr', x: 760, y: 20, w: 300, h: 108, title: 'Speed result', sub: 'the live output', kind: 'main', step: 1, src: 'speed', values: [null, 'buggy: 32'] },
          { id: 'p2', x: 350, y: 252, w: 300, h: 108, title: 'Same pipeline, fixed', sub: 'replays from offset 0', kind: 'new', step: 2, src: 'replay', values: [null, null, 'all 9 events'] },
          { id: 'cr', x: 760, y: 252, w: 300, h: 108, title: 'Corrected result', sub: 'replaces the buggy one', kind: 'new', step: 2, src: 'replay', values: [null, null, '45; phone b still 21'] },
          { id: 'scr', x: 1220, y: 20, w: 280, h: 108, title: 'Shop’s screen', sub: 'reads the result', kind: 'ext', step: 3 }
        ],
        edges: [
          { from: 'log', to: 'p1', kind: 'main', step: 1 },
          { from: 'p1', to: 'sr', kind: 'main', step: 1 },
          { from: 'log', to: 'p2', kind: 'new', step: 2 },
          { from: 'p2', to: 'cr', kind: 'new', step: 2 },
          { from: 'cr', to: 'sr', kind: 'change', step: 3, label: 'replaces', dx: 12, dy: 4, labelAnchor: 'start' },
          { from: 'sr', to: 'scr', kind: 'main', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Rebuildable:</b> the pipeline and every result can be thrown away and recomputed.[[src:why]]' },
        { step: 4, html: '<b>Not rebuildable:</b> the log. Its retention is the system’s real correctness boundary.[[src:why]]' },
        { step: 4, html: '<b>No second copy:</b> nothing to keep in agreement, so no drift.[[src:pipe]]' }
      ],
      narration: [
        'Here is the whole design. First, the log: replayable and retained, holding the 9 events at offsets 0 to 8.',
        'Second, one streaming pipeline, the only codebase, folds each event into the speed result, the live output. With the bug, that showed 32.',
        'Third, the replay path: the same pipeline, fixed, rewinds to offset 0 and folds all 9 events again into a corrected result: 45, with phone b still at 21.',
        'The corrected result replaces the buggy one, and the shop’s screen reads it. There is no second implementation anywhere to keep in step.',
        'Every box except one can be thrown away and rebuilt. The log cannot, so its retention setting, usually chosen for cost, is where this system’s correctness actually ends.'
      ]
    },

    /* ---------- 12 · question: the counted comparison ---------- */
    {
      title: 'Kind', layout: 'ask',
      eyebrow: '12 · Your turn · what this buys over Lambda',
      heading: 'Which difference is one of kind, not effort?',
      stand: 'Against Lambda, this design needs fewer fix sites, fewer implementations to verify, and has no room for the two copies to disagree.',
      question: {
        step: 0,
        prompt: 'Which of those differences could no amount of care under Lambda make up for?',
        options: [
          { text: 'Drift: with one copy, the two can never disagree.', correct: true,
            why: 'Under Lambda, drift is possible however careful the teams are. Here there is no second copy for it to live in.' },
          { text: 'Fix sites: 2 places under Lambda, against 1 here.', correct: false,
            why: 'A careful team can apply a fix in 2 places. It is more work, not impossible.' },
          { text: 'Verification: 2 implementations to check, against 1.', correct: false,
            why: 'Checking two is twice the effort, but it can be done. That is a difference of effort.' }
        ]
      },
      narration: [
        'Against Lambda, this design has fewer fix sites, fewer implementations to verify, and no room for the copies to disagree. Which difference could no amount of care make up for? Choose an answer.',
        'The drift. Two fix sites or two checks are more work, but possible. Drift between two copies is possible however careful the teams are; with one copy it has nowhere to live.'
      ]
    },

    /* ---------- 13 · the counted comparison ---------- */
    {
      title: 'Count', layout: 'table',
      eyebrow: '13 · Lambda against this design, counted',
      heading: 'Pay in retention and replay time, not in drift',
      stand: 'The same incident, under each design.',
      table: {
        columns: ['', 'Lambda (two layers)', 'This design (one pipeline)'],
        rows: [
          { step: 0, cells: ['<b>Places the fix lands</b>', '2', '1[[src:why]]'] },
          { step: 0, cells: ['<b>Implementations to verify</b>', '2', '1[[src:why]]'] },
          { step: 1, cells: ['<b>Drift that can already exist</b>', `3 of 4 windows, by ${OFF}`, 'none possible[[src:why]]'] },
          { step: 2, cells: ['<b>What you pay instead</b>', 'two teams kept in step by care', 'log retention and replay time[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'A cost you can budget', html: '<p>Retention and replay time are a cost you can plan for. Drift is a failure you have to detect.[[src:why]]</p>' },
      narration: [
        'Here is the count. The fix lands in 2 places under Lambda, and 1 here. There are 2 implementations to verify under Lambda, and 1 here.',
        'Drift that can already be present: under Lambda, 3 of 4 windows apart by 26. Here, none is possible, because there is one implementation.',
        'What you pay instead: Lambda pays in two teams kept in step by care. This design pays in keeping the log, and in the time a replay takes.',
        'And that is the trade. Retention and replay time are a cost you can budget for. Drift is a failure you have to detect.'
      ]
    },

    /* ---------- 14 · gap 1: retention ---------- */
    {
      title: 'Gap1', layout: 'ask',
      eyebrow: '14 · Your turn · what the design does not settle, 1',
      heading: 'The log kept only 6 events',
      stand: 'Retention was set short to save space, so the log holds only the newest 6 events, offsets 3 to 8. The fixed pipeline replays it.',
      question: {
        step: 0,
        prompt: 'What does the replay return?',
        options: [
          { text: '30, a confident wrong answer, with no error.', correct: true,
            why: 'It adds 2, 6, 1, 9, 4 and 8. The deleted 5, 3 and 7 are simply not there, and nothing says so.' },
          { text: '45, because the pipeline is now fixed.', correct: false,
            why: 'Correct code cannot add values that are no longer in the log.' },
          { text: 'An error saying three events are missing.', correct: false,
            why: 'A log does not remember what it deleted. The replay reads what is there and stops.' }
        ]
      },
      cards: [
        { step: 1, title: 'Replay reaches only as far as retention', html: '<p>Set it to 7 days and “we can always reprocess” quietly becomes “we can reprocess 7 days”. This assumption expires without an error.[[src:when]]</p>' }
      ],
      narration: [
        'First gap. Retention was set short, so the log holds only the newest 6 events, offsets 3 to 8. The fixed pipeline replays it. What does the replay return? Choose an answer.',
        '30: a complete, confident, wrong answer, and no error. Replay works only as far back as retention. Set it to 7 days, and “we can always reprocess” quietly becomes “we can reprocess 7 days”.'
      ]
    },

    /* ---------- 15 · gap 2: determinism ---------- */
    {
      title: 'Gap2', layout: 'ask', defines: ['deterministic'],
      eyebrow: '15 · Your turn · what the design does not settle, 2',
      heading: 'All 9 kept, but the pipeline reads the clock',
      stand: 'This time every event is kept. But the pipeline also consults the computer’s clock while it adds. Its replay returns 45.',
      question: {
        step: 0,
        prompt: 'Can that 45 be trusted?',
        options: [
          { text: 'No: the next replay of the same log might not agree.', correct: true,
            why: 'Its output depends on the clock as well as the log, so a replay on another day may differ. 45 is right by luck, not by guarantee.' },
          { text: 'Yes: the total is right, so the replay is right.', correct: false,
            why: 'The number is right this time; the guarantee is not. Nothing makes the next replay agree.' },
          { text: 'Yes: every event was kept, so it must be repeatable.', correct: false,
            why: 'A complete log is needed but not enough. The pipeline must depend on nothing outside it.' }
        ]
      },
      cards: [
        { step: 1, title: 'Deterministic', html: '<p>A pipeline whose output depends only on its input is <b>deterministic</b>. Reading the wall clock, a random seed or a changing lookup table breaks it.[[src:when]]</p>' },
        { step: 2, title: 'Assert it in a test', html: '<p>The log cannot tell you; it is the pipeline that has stopped being a function of its input.[[src:when]]</p>' }
      ],
      narration: [
        'Second gap. Every event is kept, but the pipeline also consults the computer’s clock while it adds. Its replay returns 45. Can that be trusted? Choose an answer.',
        'No. A pipeline whose output depends only on its input is called deterministic, and this one is not. Its 45 is right this time, but nothing guarantees the next replay agrees.',
        'And the log cannot warn you, because it is the pipeline that stopped being a function of its input. So assert determinism in a test.'
      ]
    },

    /* ---------- 16 · three replays, compared ---------- */
    {
      title: 'Three', layout: 'array',
      eyebrow: '16 · Watch three replays compared',
      heading: 'Totals 45, 30 and 45. Only one can be trusted.',
      stand: 'Each slot is one replay through the fixed pipeline. Row 4: does the replay pass both checks, enough events kept and a deterministic pipeline?',
      array: {
        labelWidth: 170, slotLabel: 'replay',
        rows: [
          { label: 'situation', values: REPLAYS.map(r => r[0]) },
          { label: 'events read', values: REPLAYS.map(r => r[1]) },
          { label: 'total', values: REPLAYS.map(r => r[2]) },
          { label: 'trustworthy?', values: REPLAYS.map(r => r[3]) }
        ],
        meters: ['replays checked', 'not trustworthy'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 600 }
        ]
      },
      cards: [
        { step: 2, title: 'The totals alone cannot tell', html: '<p>Two replays give 45; only one is trustworthy. That is why retention and determinism belong in a test, not in an assumption.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are three replays through the fixed pipeline. All 9 kept gives 45. Only 6 kept gives 30. All 9 kept, but reading the clock, gives 45 again.',
        'Now each is checked: enough events kept, and a deterministic pipeline. The first passes. The second and third do not: 2 of the 3 replays cannot be trusted.',
        'So the totals alone cannot tell you which replay to believe. Both assumptions belong in a test rather than in an assumption.'
      ]
    },

    /* ---------- 17 · gaps 3 and 4 ---------- */
    {
      title: 'Gap3', layout: 'ask', defines: ['final'],
      eyebrow: '17 · Your turn · what the design does not settle, 3 and 4',
      heading: 'A year of history, and a window that never closes',
      stand: 'In production, a replay may cover a year of traffic, through the same pipeline that serves live events. And the stream never ends.',
      question: {
        step: 0,
        prompt: 'What does this design say about a year-long replay running beside live traffic?',
        options: [
          { text: 'Nothing: it does not shield live work from the replay.', correct: true,
            why: 'Replaying 9 events is free; replaying a year competes with serving it. Isolating the two is left to you.' },
          { text: 'It runs the replay only while no new events are arriving.', correct: false,
            why: 'A stream never pauses, so there is no such moment, and the design names no such rule.' },
          { text: 'It moves the replay into a second, batch codebase.', correct: false,
            why: 'That would bring back Lambda’s second copy, the very thing this design removed.' }
        ]
      },
      cards: [
        { step: 1, title: 'Gap 3 · replay load', html: '<p>Replaying 9 events is free; replaying a year of production traffic competes with serving it. Nothing here isolates the replay path from the live one.[[src:when]]</p>' },
        { step: 2, title: 'Gap 4 · finality', html: '<p>A result that can never change again is <b>final</b>. 1 of the 4 windows, 12:08 to 12:10 holding 8, is never final in a stream. A consumer needing a final figure needs a bounded run or an agreed cut-off.[[src:when]]</p>' }
      ],
      narration: [
        'Third gap. In production, a replay may cover a year of traffic, through the same pipeline that serves live events. What does this design say about that? Choose an answer.',
        'Nothing. Replaying 9 events is free, but replaying a year competes with serving it, and nothing here keeps the two apart.',
        'And the fourth gap. A result that can never change is called final. In a stream that never ends, the window 12:08 to 12:10, holding 8, is never final. A consumer needing a final figure needs a run over an input that ends, or an agreed cut-off.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · The design, in five sentences',
      heading: 'Keep the log, run one pipeline, replay with an invariant',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Log</b>', 'Keeps the 9 events at offsets 0 to 8; the source of truth.', 'Where does history live?[[src:log]]'] },
          { step: 0, cells: ['<b>One pipeline</b>', 'The only codebase: no second copy to drift.', 'How many copies of the logic?[[src:pipe]]'] },
          { step: 1, cells: ['<b>Speed result</b>', 'The live output; wrong while a bug is live: 32.', 'What does the shop see?[[src:speed]]'] },
          { step: 1, cells: ['<b>Replay path</b>', 'Fixed pipeline from offset 0: 45, with phone b still 21.', 'How is the past corrected, and checked?[[src:replay]]'] },
          { step: 2, cells: ['<b>Not settled</b>', 'Retention, determinism, replay load, finality.', 'What can it not promise?[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>The pipeline is disposable and the log is not: budget retention, test determinism, and always replay with an invariant.[[src:why]]</p>' },
      narration: [
        'To recap. The log keeps every event at its offset and is the source of truth. One pipeline is the only codebase, so there is no second copy to drift.',
        'The speed result is the live output, wrong while a bug is live. The replay path runs the fixed pipeline from offset 0: 45, with phone b still 21 as the check.',
        'What it does not settle: retention, determinism, the load of a long replay, and finality on a stream that never ends.',
        'In one line: the pipeline is disposable and the log is not. Budget retention, test determinism, and always replay with an invariant.'
      ]
    }
  ]
};
