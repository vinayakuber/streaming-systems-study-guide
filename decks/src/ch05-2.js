// Chapter 5, Part 2 — "Idempotency and deduplication", for a viewer who has read nothing
// before it. The nine events, both clocks and the crash are re-told from zero; then the two
// accuracy guards (a write that names a result, a set of ids already seen) are each asked for
// and animated, and the eight combinations of the three guards are tabulated. Every number
// comes from the one seed (tools/stream_seed.js) and is asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch05';
const E = seed.EVENTS;
const TOTAL = E.reduce((s, e) => s + e.v, 0);
const CHK = 4;
const REPLAY = E.slice(CHK + 1);
const REPLAY_V = REPLAY.reduce((s, e) => s + e.v, 0);
const DELIV = [...E.map(e => e.id), ...REPLAY.map(e => e.id)];
const SEEN_BEFORE = DELIV.map((id, i) => (DELIV.indexOf(id) < i ? 'yes' : 'no'));
const KEPT = DELIV.map((id, i) => (SEEN_BEFORE[i] === 'no' ? E[id].v : ''));
const clock = sec => seed.hhmmss(sec);
const winLabel = w => `${clock(w).slice(0, 5)}–${clock(w + seed.WIN).slice(0, 5)}`;
const W8 = seed.winOf(E[8].et);
const outcome = (replay, dedup, idem) => (!replay ? TOTAL - REPLAY_V : dedup || idem ? TOTAL : TOTAL + REPLAY_V);
const COMBOS = [];
for (const replay of [true, false]) for (const dedup of [true, false]) for (const idem of [true, false])
  COMBOS.push({ replay, dedup, idem, total: outcome(replay, dedup, idem) });
const RIGHT = COMBOS.filter(c => c.total === TOTAL);

if (TOTAL !== 45 || REPLAY_V !== 22 || DELIV.length !== 13 || KEPT.reduce((a, b) => a + (b || 0), 0) !== TOTAL
  || SEEN_BEFORE.filter(x => x === 'yes').length !== 4 || seed.SUM(seed.WINDOWS[W8]) !== 8 || winLabel(W8) !== '12:08–12:10'
  || new Set(COMBOS.map(c => c.total)).size !== 3 || RIGHT.length !== 3 || !RIGHT.every(c => c.replay))
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

const yn = b => (b ? 'yes' : 'no');
const verdict = t => (t === TOTAL ? `<b>${t}</b> · right` : t > TOTAL ? `${t} · counted twice` : `${t} · events lost`);
const row = e => ({ cells: [`event ${e.id}`, `user ${e.key}`, clock(e.et), clock(e.pt), `${e.v}`, winLabel(seed.winOf(e.et))] });

module.exports = {
  title: 'Making Repeats Harmless',
  eyebrow: 'Streaming · Ch 5 · Part 2',
  ...shared,
  jargon: ['event', 'value', 'pipeline', 'crash', 'retry', 'event time', 'processing time', 'window',
    'idempotent', 'record id', 'seen-set', 'deduplicate', 'shuffle', 'sink', 'stable', 'horizon',
    'source', 'offset', 'replayable', 'guard', 'exactly-once'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    sec:   section(CH, 'Idempotency and deduplication', 'Chapter 5 · idempotency and deduplication'),
    why:   section(CH, 'Why a replayable source has no substitute and the other two are redundant', 'Chapter 5 · why the source has no substitute'),
    when:  section(CH, 'When to use which guard, and where the redundancy disappears', 'Chapter 5 · when to use which guard'),
    walk:  section(CH, 'Visual walkthrough — SET vs ADD, the seen-set, and all 8 combinations', 'Chapter 5 · set versus add, and 8 combinations'),
    prog:  section(CH, 'Three guards, eight combinations — stack and heap at every step', 'Chapter 5 · three guards, traced'),
    meaning: section(CH, 'Why exactly-once is two guarantees, and which half is hard', 'Chapter 5 · two guarantees'),
    quiz:  section(CH, 'Quiz', 'Chapter 5 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'value', 'pipeline', 'crash', 'retry'],
      eyebrow: '01 · Chapter 5 · Part 2',
      heading: 'A crash, four events sent twice, and how to make that harmless',
      hero: { step: 0, text: 'Two users, <code>a</code> and <code>b</code>, do things on a website. Each thing is an <b>event</b> carrying a <b>value</b>, a number to add up. A <b>pipeline</b> — programs on several machines — keeps the totals. When a machine <b>crashes</b> (stops suddenly), work it cannot prove was done is sent again: a <b>retry</b>.[[src:meaning]]' },
      tiles: [
        { step: 1, value: 9, label: 'events, worth 45 in total[[src:why]]' },
        { step: 1, value: 4, label: 'events sent twice after a crash[[src:why]]' },
        { step: 2, value: 8, label: 'ways to combine three safeguards[[src:why]]' },
        { step: 2, value: 3, label: 'different totals they produce[[src:why]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'How can a repeat change nothing?', text: 'By writing a result, not adding to one.' },
        { step: 3, n: 2, title: 'How can a repeat be spotted?', text: 'By remembering what has already arrived.' },
        { step: 4, n: 3, title: 'Which safeguard cannot be replaced?', text: 'The one that can bring a lost event back.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'Two users, a and b, do things on a website. Each thing is an event with a value, a number to add up. A pipeline of programs keeps the totals. When a machine crashes, work it cannot prove was done is sent again: a retry.',
        'Our 9 events are worth 45 in total. After one crash, 4 of them, events 5 to 8, are sent a second time. Counted twice, they would make the total 67.',
        'This part looks at three safeguards against that. They can be combined in 8 ways, and the 8 ways produce only 3 different totals.',
        'Two questions first. How can a repeat be made to change nothing? And how can a repeat be spotted and dropped?',
        'And then the surprising one: which of the three safeguards can nothing else replace? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events and both clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'window'],
      eyebrow: '02 · The nine events, and their two clocks',
      heading: 'When it happened, when it was seen, and which window it counts in',
      stand: 'Some of the nine events, in the order the pipeline saw them.',
      table: {
        columns: ['Event', 'Who', 'Happened at', 'Seen at', 'Value', 'Window'],
        rows: [
          { step: 0, ...row(E[0]) }, { step: 0, ...row(E[1]) }, { step: 0, ...row(E[2]) },
          { step: 1, ...row(E[3]) }, { step: 1, ...row(E[4]) },
          { step: 1, cells: ['…', '…', '…', '…', '…', '…'] },
          { step: 2, ...row(E[7]) },
          { step: 2, cells: ['<b>event 8</b>', 'user a', clock(E[8].et), clock(E[8].pt), '<b>8</b>', '<b>12:08–12:10</b>'] }
        ]
      },
      side: { step: 3, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it really happened.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Window</b> — a two-minute stretch of event time with its own total. 12:08–12:10 holds only event 8: total <b>8</b>.[[src:why]]</li></ul>' },
      narration: [
        'Here are the events, in the order the pipeline saw them. Each has two clocks: when it happened, and when the pipeline saw it. Event 0 happened at 12:00:01 and was seen a second later.',
        'Event 3 is worth 2 and event 4 is worth 6. The time something really happened is called its event time. The time the pipeline saw it is called its processing time.',
        'Event 7 happened at 12:00:50 but was seen at 12:04:40. The pipeline keeps a total per two minutes of event time, called a window, so event 7 still counts in the 12:00 window.',
        'One window matters in this part: 12:08 to 12:10. It holds only event 8, so its total is 8. Watch what a retry of event 8 does to it.'
      ]
    },

    /* ---------- 3 · question: set or add ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['idempotent'],
      eyebrow: '03 · Your turn',
      heading: 'Two ways to tell a window about event 8',
      stand: 'The message about event 8 arrives at the window 12:08–12:10, and is then retried, so it arrives a second time.',
      question: {
        step: 0,
        prompt: 'Which message leaves the window’s total right after arriving twice?',
        options: [
          { text: '“Set this window’s total to 8.”', correct: true,
            why: 'It names the result. However many times it arrives, the total ends at 8.' },
          { text: '“Add 8 to this window’s total.”', correct: false,
            why: 'It names a change. Arriving twice adds 8 twice: 16.' },
          { text: 'Neither: a repeated message is always wrong.', correct: false,
            why: 'A message that states the final value can be applied twice with no harm. That is the whole trick.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Idempotent', html: '<p>An action is <b>idempotent</b> when doing it twice is the same as doing it once. “Set to 8” is; “add 8” is not.[[src:sec]]</p>' },
        { step: 2, title: 'The test', html: '<p>Does the message name a <b>result</b> or a <b>change</b>? A result is safe to repeat; a change is not.[[src:why]]</p>' }
      ],
      narration: [
        'First question. The message about event 8 arrives at its window, and is retried, so it arrives twice. Which message leaves the total right? Choose an answer.',
        'Set the total to 8. An action is called idempotent when doing it twice is the same as doing it once. Setting to 8 is idempotent; adding 8 is not.',
        'The test is simple: does the message name a result, or a change? A result can be repeated safely. A change cannot.'
      ]
    },

    /* ---------- 4 · set versus add, animated ---------- */
    {
      title: 'Set', layout: 'array',
      eyebrow: '04 · Watch the two messages arrive twice',
      heading: 'Add drifts. Set stays put.',
      stand: 'The window 12:08–12:10, before any message, after the first delivery, and after the retry.',
      array: {
        labelWidth: 200, slotLabel: 'moment',
        rows: [
          { label: 'delivery', values: ['before', 'event 8', 'event 8 again'] },
          { label: 'total with “add 8”', values: [0, 8, 16] },
          { label: 'total with “set 8”', values: [0, 8, 8] }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [2] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Add: 16', html: '<p>The second “add 8” is applied on top of the first. The window reads <b>16</b>, double its real total.[[src:walk]]</p>' },
        { step: 2, title: 'Set: 8', html: '<p>The second “set 8” writes 8 over 8. Nothing changes. The output that does this is an idempotent writer.[[src:walk]]</p>' },
        { step: 3, title: 'Whether this is possible at all', html: '<p>Only if each message carries the window’s <b>whole total</b>. A pipeline that sends only the change can never write “set”.[[src:why]]</p>' }
      ],
      narration: [
        'Here is the window at three moments: before any message, after event 8’s first delivery, and after its retry.',
        'With add 8, the first delivery makes 8, and the retry makes 16: double the real total.',
        'With set 8, the first delivery makes 8, and the retry writes 8 over 8. Nothing changes. The repeat is harmless.',
        'But set is only possible if each message carries the window’s whole total. A pipeline that sends only the change, plus 8, can never write set, so this choice is made early.'
      ]
    },

    /* ---------- 5 · question: spotting repeats ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['record id', 'shuffle', 'deduplicate'],
      eyebrow: '05 · Your turn',
      heading: 'When the messages can only add',
      stand: 'Sometimes the receiving machine can only add. Every event carries its own number, 0 to 8.',
      question: {
        step: 0,
        prompt: 'How can the receiving machine stop a retried event from being added twice?',
        options: [
          { text: 'Keep the numbers of events it has accepted, and drop any it has seen.', correct: true,
            why: 'Event 5 arriving a second time is found in that list and dropped before it is added.' },
          { text: 'Drop any event whose value equals the previous one.', correct: false,
            why: 'Values say nothing about identity. Two different events can share a value; a repeat need not follow its original.' },
          { text: 'Add everything, then halve the total at the end.', correct: false,
            why: 'Only four of the nine events were repeated, so halving the total punishes the five that arrived once.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Record id', html: '<p>Each event’s own number, which travels with it, is its <b>record id</b>. Event 5 is id 5 on its first trip and on its retry.[[src:sec]]</p>' },
        { step: 2, title: 'Shuffle', html: '<p>The hop where one machine hands events to the next is called the <b>shuffle</b>. The receiving side is where repeats arrive.[[src:sec]]</p>' },
        { step: 2, title: 'Deduplicate', html: '<p>To <b>deduplicate</b> is to drop the copies, keeping one of each. At the shuffle, that is one look-up per arriving event.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. Sometimes the receiver can only add. Every event carries its own number. How can the receiver stop a retried event from being added twice? Choose an answer.',
        'Keep the numbers it has accepted, and drop any it has seen. Each event’s own number, which travels with it, is called its record id. Event 5 is id 5 on every trip.',
        'The hop where one machine hands events to the next is called the shuffle, and that is where repeats arrive. Dropping the copies is called deduplicating. Watch it happen.'
      ]
    },

    /* ---------- 6 · the seen-set, animated ---------- */
    {
      title: 'Seen', layout: 'array', defines: ['seen-set'],
      eyebrow: '06 · Watch the receiver check each arrival',
      heading: 'Thirteen arrivals, four dropped, total 45',
      stand: 'The thirteen deliveries after the crash. Before adding, the receiver asks: have I accepted this id already?',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'record id', values: DELIV },
          { label: 'seen before?', values: SEEN_BEFORE },
          { label: 'value added', values: KEPT }
        ],
        meters: ['arrivals checked', 'repeats dropped'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 240 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [9, 10, 11, 12] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The seen-set', html: '<p>The list of ids already accepted is the <b>seen-set</b>. Ids 5, 6, 7 and 8 are in it when their retries arrive, so all 4 are dropped.[[src:why]]</p>' },
        { step: 2, title: 'Right, with a receiver that only adds', html: '<p>The values that get through add up to <b>' + TOTAL + '</b>. The check stands in front of the adding, so the adding never sees a repeat.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the thirteen deliveries after the crash: ids 0 to 8, then 5, 6, 7 and 8 again.',
        'Before adding, the receiver checks each id against the list of ids it has already accepted, called the seen-set. Watch: thirteen checked, and the four retries are found and dropped.',
        'Only the first copy of each event is added. The values that get through add up to 45, the right total, even though the receiver itself can only add.'
      ]
    },

    /* ---------- 7 · question: what dedup needs ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['stable', 'horizon'],
      eyebrow: '07 · Your turn',
      heading: 'Deduplication is not free',
      stand: 'Suppose the sender gives each send a fresh number, made up at the moment of sending, instead of the event’s own id.',
      question: {
        step: 0,
        prompt: 'Event 5 is retried. What does the seen-set do with it?',
        options: [
          { text: 'Lets it through: the new number has never been seen.', correct: true,
            why: 'The retry carries a different number from the first trip, so the check finds nothing and event 5 is added twice.' },
          { text: 'Drops it: the receiver recognises event 5 anyway.', correct: false,
            why: 'The receiver only compares numbers. With a fresh number per send, two trips of one event look like two events.' },
          { text: 'Stops the pipeline with an error.', correct: false,
            why: 'Nothing looks wrong to the receiver. That is what makes this failure silent.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Ids must be stable', html: '<p>An id is <b>stable</b> when every retry of an event carries the same one. A number made up at send time defeats the seen-set entirely.[[src:why]]</p>' },
        { step: 2, title: 'The set has a horizon', html: '<p>The seen-set grows with every event, forever. It must be trimmed, and how far back it remembers is its <b>horizon</b>. A repeat older than that gets through.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. Suppose the sender gives each send a fresh number made up at the moment of sending. Event 5 is retried. What does the seen-set do? Choose an answer.',
        'It lets the retry through. An id is called stable when every retry of an event carries the same one. A number made up at send time defeats the seen-set completely.',
        'And the seen-set grows with every event, forever, so it must be trimmed. How far back it remembers is its horizon. A repeat older than the horizon gets through.'
      ]
    },

    /* ---------- 8 · question: the source ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['source', 'offset', 'replayable', 'guard'],
      eyebrow: '08 · Your turn',
      heading: 'What if events 5 to 8 never come back?',
      stand: 'The events are read from a source that keeps a saved position. The crash may have lost events 5 to 8 before they were counted, and the pipeline cannot tell.',
      question: {
        step: 0,
        prompt: 'If the source cannot read events 5 to 8 again, can “set” or the seen-set rescue the total?',
        options: [
          { text: 'No: both only stop extra copies. Neither can bring an event back.', correct: true,
            why: 'Both safeguards remove repeats. If an event never arrives again, there is nothing for them to work on: the total stays 23.' },
          { text: 'Yes: the seen-set knows which ids are missing.', correct: false,
            why: 'It knows which ids it has accepted, not which ones exist. It cannot fetch an event it never received.' },
          { text: 'Yes: “set” writes the correct total anyway.', correct: false,
            why: '“Set” writes whatever total it was given. Without events 5 to 8, that total is 23.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A replayable source', html: '<p>The <b>source</b> is where events are read from. Its saved position is an <b>offset</b>. A <b>replayable</b> source can read again from any saved offset, so lost events come back.[[src:sec]]</p>' },
        { step: 2, title: 'Guards only subtract', html: '<p>Each of the three safeguards is a <b>guard</b>. “Set” and the seen-set stop a contribution counting twice, and can do nothing else. Only replay can make the total complete.[[src:why]]</p>' }
      ],
      narration: [
        'Fourth question. Events are read from a source with a saved position. If the crash lost events 5 to 8 and the source cannot read them again, can set or the seen-set rescue the total? Choose an answer.',
        'No. The place events are read from is the source, and its saved position is an offset. A source that can read again from a saved offset is called replayable. Without that, the total stays 23.',
        'Call each of the three safeguards a guard. Set and the seen-set only stop a repeat counting twice. Neither can add back an event that never returned. Only the replayable source can.'
      ]
    },

    /* ---------- 9 · the eight combinations ---------- */
    {
      title: 'Eight', layout: 'table', defines: ['sink'],
      eyebrow: '09 · Every combination of the three guards',
      heading: 'Eight combinations, three totals',
      stand: 'The same crash in each row, at its worst: unsent events stay lost, landed ones count twice. Each guard is there or not. The last stage, which writes totals out, is the sink: it writes “set” or “add”.',
      table: {
        columns: ['Replayable source?', 'Seen-set at the shuffle?', 'Sink writes “set”?', 'Total'],
        rows: COMBOS.map((c, i) => ({ step: i < 4 ? (i < 3 ? 0 : 1) : 2, cells: [yn(c.replay), yn(c.dedup), yn(c.idem), verdict(c.total)] }))
      },
      side: { step: 3, title: 'Read the right column', html: '<ul class="l"><li>Without replay: <b>' + (TOTAL - REPLAY_V) + '</b> in all four rows, whatever else is there.</li><li>With replay and no guard: <b>' + (TOTAL + REPLAY_V) + '</b>.</li><li>With replay and <b>either</b> guard: <b>' + TOTAL + '</b>. 3 of the 8 rows.[[src:walk]]</li></ul>' },
      narration: [
        'Here is the same crash, in all 8 combinations of the three guards, each row at its worst. The last stage, which writes the totals out, is called the sink. In the first three rows, the source replays and another guard is there: 45 each time.',
        'The fourth row replays but has no guard at all. If the first sends had landed, the retried events count twice, and the total is 67.',
        'The bottom four rows cannot replay. If the first sends were lost, nothing brings them back: whatever else is there, the total is 23 in every one of them.',
        'So three totals from eight rows. Replay is needed every time. After that, the seen-set or a sink that writes set: either one alone is enough.'
      ]
    },

    /* ---------- 10 · question: the usual rule ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['exactly-once'],
      eyebrow: '10 · Your turn',
      heading: 'Do you really need all three?',
      stand: 'A common rule says: exactly-once needs a replayable source, a deduplicating shuffle and an idempotent sink — drop any one and it breaks.',
      question: {
        step: 0,
        prompt: 'For a pipeline that keeps totals, what does the table say about that rule?',
        options: [
          { text: 'Too strict: replay is required, then either guard is enough.', correct: true,
            why: 'Rows with replay and only the seen-set, or only “set”, both reach 45. The two guards cover for each other.' },
          { text: 'Exactly right: every row missing a guard is wrong.', correct: false,
            why: 'Two rows each miss a guard and still reach 45. Only the row missing both, or missing replay, goes wrong.' },
          { text: 'Too strict the other way: no guard is needed.', correct: false,
            why: 'The row with replay and no guard gives 67. At least one guard is needed.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Exactly-once, for totals', html: '<p>Each event counting once, <b>exactly-once</b>, needs a replayable source plus at least one guard: the seen-set <b>or</b> a “set” sink.[[src:sec]]</p>' },
        { step: 2, title: 'Why replay is different', html: '<p>Completeness has one mechanism; accuracy has two. That asymmetry is why one guard has no substitute and the other two can stand in for each other.[[src:why]]</p>' }
      ],
      narration: [
        'Fifth question. A common rule says exactly-once needs all three guards, and dropping any one breaks it. For a pipeline that keeps totals, what does the table say? Choose an answer.',
        'Too strict. Exactly-once means each event counts once, and for totals it needs a replayable source plus at least one guard: the seen-set, or a sink that writes set.',
        'The reason is an asymmetry. Making the total complete has one mechanism, replay. Making it accurate has two, and they can stand in for each other.'
      ]
    },

    /* ---------- 11 · when to use which ---------- */
    {
      title: 'When', layout: 'cards',
      eyebrow: '11 · When to use which guard',
      heading: 'Start with the source, then pick the cheaper guard',
      stand: 'The table says what works. These cards say what each choice costs.',
      columns: 2,
      cards: [
        { step: 0, title: '1 · Always start with the source', html: '<p>If it cannot replay from a saved offset, nothing downstream gets past 23. Check this before designing anything else.[[src:when]]</p>' },
        { step: 1, title: '2 · Prefer a sink that writes “set”', html: '<p>It needs no extra memory, no stable ids and no horizon. The seen-set needs all three.[[src:when]]</p>' },
        { step: 2, title: '3 · Use the seen-set when “set” is impossible', html: '<p>When the sink only accepts changes, or only appends rows. Then budget for its memory and choose its horizon deliberately.[[src:when]]</p>' },
        { step: 3, title: '4 · The redundancy is not universal', html: '<p>It holds because a window total can be recomputed. Once the sink touches the outside world, the two guards stop being interchangeable: part 3.[[src:when]]</p>' }
      ],
      narration: [
        'So, when to use which guard. Always start with the source. If it cannot replay from a saved offset, nothing downstream gets past 23.',
        'Then prefer a sink that writes set. It needs no extra memory, no stable ids and no horizon, all of which the seen-set needs.',
        'Use the seen-set when set is impossible: when the sink only accepts changes, or only appends rows. Then budget for its memory and choose its horizon on purpose.',
        'One warning. The two guards are interchangeable only because a window total can be recomputed. Once the sink changes the outside world, that stops being true. That is part 3.'
      ]
    },

    /* ---------- 12 · quiz: idempotent ---------- */
    {
      title: 'Check', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'Which of these is safe to repeat?',
      stand: 'The chapter’s own quiz question, in plain words.',
      question: {
        step: 0,
        prompt: 'Which operation is idempotent?',
        options: [
          { text: 'Add 8 to the 12:08 window.', correct: false, why: 'Twice gives 16. It names a change.' },
          { text: 'Set the 12:08 window to 8.', correct: true, why: 'It replaces the value, so running it twice has the same effect as once.' },
          { text: 'Increase a counter by one.', correct: false, why: 'Every run moves the counter again.' },
          { text: 'Append a row to a list.', correct: false, why: 'Every run adds another row.' }
        ]
      },
      narration: [
        'One check, the chapter’s own quiz question. Which of these operations is idempotent? Choose an answer.',
        'Set the 12:08 window to 8. It replaces the value, so running it twice has the same effect as running it once. Adding, increasing and appending all move something again on every run.'
      ]
    },

    /* ---------- 13 · quiz: three parts ---------- */
    {
      title: 'Chk2', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'The three parts, and which one is required',
      stand: 'Another of the chapter’s quiz questions.',
      question: {
        step: 0,
        prompt: 'What are the three parts of exactly-once from start to finish?',
        options: [
          { text: 'A source, a cache in memory, and a queue between machines.', correct: false, why: 'None of those, on its own, stops a repeat or brings back a loss.' },
          { text: 'A replayable source, a deduplicating shuffle, an idempotent sink.', correct: true, why: 'And the source is required; for totals, either of the other two is enough on its own.' },
          { text: 'A sending machine, a relay machine, and a receiving machine.', correct: false, why: 'Those are just the roles in any message system. None of them is a safeguard.' },
          { text: 'A clock, a two-minute window, and a timer for each window.', correct: false, why: 'Those decide where and when totals are reported, not how often an event counts.' }
        ]
      },
      narration: [
        'And one more from the chapter’s quiz. What are the three parts of exactly-once from start to finish? Choose an answer.',
        'A replayable source, a deduplicating shuffle and an idempotent sink. The source is required. For totals, either of the other two is enough on its own.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'One guard brings events back; two stop them counting twice',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Idempotent</b>', 'Twice is the same as once. “Set the window to 8” is; “add 8” is not.[[src:sec]]'] },
          { step: 0, cells: ['<b>Seen-set</b> · <b>deduplicate</b>', 'Ids already accepted; a repeat is dropped: 13 arrivals, 4 dropped, 45. Needs stable ids and a horizon.[[src:why]]'] },
          { step: 1, cells: ['<b>Replayable source</b>', 'Reads again from a saved offset. The only guard that can make a total complete.[[src:why]]'] },
          { step: 2, cells: ['<b>The eight rows</b>', '23 without replay, 67 with replay alone, 45 with replay and either other guard.[[src:walk]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>What if the sink charges a card instead of writing a total? Then the two guards are no longer interchangeable, and only one of them reaches every way a crash can strike.</p>' },
      narration: [
        'To recap. Idempotent means twice is the same as once: setting the window to 8 is, adding 8 is not. The seen-set drops repeats by id, and needs stable ids and a horizon.',
        'The replayable source reads again from a saved offset. It is the only guard that can make the total complete again.',
        'Across the eight combinations: 23 without replay, 67 with replay and nothing else, and 45 with replay plus either of the other guards.',
        'Next, part 3: what if the sink charges a card instead of writing a total? Then the two guards stop being interchangeable.'
      ]
    }
  ]
};
