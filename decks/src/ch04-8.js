// Chapter 4, Part 8 — the chapter's "System Design Interview": session-window analytics for
// user activity, built one component at a time. Each component is preceded by a question; the
// bridging merge is animated on the seed's own clicks, the pipeline is assembled, and the
// design closes with what it does NOT settle. Every value is computed from tools/stream_seed.js.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch04';
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const G = 47;   // the interview section's gap; at the book's 120 no event bridges (doc, System Design Interview)

// keys dropped: the runs before id 7 arrives, in arrival order, at gap 47
const runsOf = (events, gap) => {
  const out = [];
  for (const e of events.slice().sort((x, y) => x.et - y.et)) {
    const last = out[out.length - 1];
    if (last && e.et - last.end <= gap) { last.end = e.et; last.sum += e.v; } else out.push({ start: e.et, end: e.et, sum: e.v });
  }
  return out;
};
const ID7 = E.findIndex(e => e.id === 7);
const BEFORE = runsOf(E.slice(0, ID7), G), AFTER = runsOf(E.slice(0, ID7 + 1), G);
const S1 = BEFORE[0], S2 = BEFORE[1], LATE = E[ID7];
const sessionsAt = gap => ['a', 'b'].reduce((n, k) => n + runsOf(E.filter(e => e.key === k), gap).length, 0);
const A_AT = gap => runsOf(E.filter(e => e.key === 'a'), gap).length;

if (S1.start !== 1 || S1.end !== 3 || S1.sum !== 8 || S2.start !== 90 || S2.end !== 130 || S2.sum !== 9
  || S2.start - S1.end !== 87 || LATE.et - S1.end !== G || S2.start - LATE.et !== 40 || LATE.v !== 4
  || AFTER[0].start !== 1 || AFTER[0].end !== 130 || AFTER[0].sum !== 21 || seed.WATERMARKS[ID7] !== 200
  || sessionsAt(120) !== 5 || sessionsAt(40) !== 6 || A_AT(120) !== 3 || A_AT(40) !== 4)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Session Analytics Design',
  eyebrow: 'Streaming · Ch 4 · Part 8',
  ...shared,
  legend: { main: 'every windowed pipeline has it', new: 'exists only for sessions', change: 'must accept deletions', ext: 'outside the pipeline' },
  jargon: ['event', 'user', 'session', 'gap', 'event time', 'processing time', 'key', 'watermark', 'assign',
    'merge', 'bridge', 'state', 'pane', 'trigger', 'retraction', 'row', 'allowed lateness'],
  sources: {
    ch:     chapter(CH, 'Chapter 4 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 4 · system design interview'),
    src:    section(CH, 'event source', 'Chapter 4 · event source'),
    asg:    section(CH, 'window assigner', 'Chapter 4 · window assigner'),
    mrg:    section(CH, 'session merger', 'Chapter 4 · session merger'),
    emit:   section(CH, 'trigger/retraction emitter', 'Chapter 4 · trigger/retraction emitter'),
    sdwhy:  section(CH, 'Why choosing session windows adds two components and a storage requirement', 'Chapter 4 · why sessions add two components'),
    sdwhen: section(CH, 'When this design is viable, and the four things it does not settle', 'Chapter 4 · what this design does not settle'),
    sdprog: section(CH, 'Session analytics — stack and heap at every step', 'Chapter 4 · session analytics as a program'),
    shape:  section(CH, 'Why there are three shapes, and why one of them has no answer without a setting', 'Chapter 4 · the three shapes')
  },

  slides: [
    /* ---------- 1 · the brief ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'user', 'session', 'gap'],
      eyebrow: '01 · Chapter 4 · Part 8 · a system design interview',
      heading: 'Count visits per user — when a late click can join two visits already reported',
      hero: { step: 0, text: 'A website records every click: an <b>event</b>. The business wants visits per <b>user</b>. A visit is a <b>session</b>: a burst of clicks ended by a silence longer than the <b>gap</b>. The premise of the interview: a late click can land between two sessions that were already reported, and join them.[[src:sd]]' },
      tiles: [
        { step: 1, value: 6, label: 'stages in the pipeline[[src:sdwhy]]' },
        { step: 1, value: 2, label: 'stages that exist only for sessions[[src:sdwhy]]' },
        { step: 2, value: G, label: 'seconds: the gap in the main example[[src:asg]]' },
        { step: 2, value: 21, label: 'the merged session’s total[[src:mrg]]' }
      ],
      cardsLabel: 'What the design must decide',
      cards: [
        { step: 3, n: 1, title: 'How a click finds its session', text: 'And what happens when it fits two.' },
        { step: 3, n: 2, title: 'How a wrong report is corrected', text: 'Without double-counting.' },
        { step: 4, n: 3, title: 'What the store must be able to do', text: 'A requirement no pipeline work can remove.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. At the end, what the design does not settle.[[src:sd]]' },
      narration: [
        'A website records every click, an event. The business wants visits per user. A visit is a session: a burst of clicks ended by a silence longer than the gap.',
        'The interview’s premise: a late click can land between two sessions that were already reported, and join them. The pipeline has 6 stages, and 2 exist only because of that.',
        'In the main example the gap is 47 seconds, and the joined session will total 21. We will reach both numbers ourselves.',
        'The design must decide how a click finds its session, and what happens when it fits two. And how a wrong report is corrected without double-counting.',
        'And what the store at the end must be able to do: a requirement that no amount of pipeline work can remove. You choose before each component.'
      ]
    },

    /* ---------- 2 · the data ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'key', 'watermark'],
      eyebrow: '02 · The clicks, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'For the main example, all 9 clicks are treated as one user’s, as the interview section does. In arrival order:',
      table: {
        columns: ['Arrival', 'Click', 'Happened at', 'Seen at', 'v', 'Watermark after'],
        rows: E.map((e, i) => ({ step: i < 6 ? 0 : 1,
          cells: [`${i}`, `id ${e.id}`, i === ID7 ? `<b>${clock(e.et)}</b>` : clock(e.et), clock(e.pt), `${e.v}`,
            seed.WATERMARKS[i] < 0 ? 'before noon' : clock(seed.WATERMARKS[i])] }))
      },
      side: { step: 2, title: 'Words used from now on', html: '<ul class="l"><li><b>Event time</b>: when the click happened. <b>Processing time</b>: when the system saw it.</li><li>The <b>key</b> is what sessions are kept per — normally the user.</li><li>The <b>watermark</b>: latest event time seen, minus 60 seconds — the system’s estimate that nothing older is still coming.[[src:src]]</li></ul>' },
      narration: [
        'Here are the clicks in the order the system saw them. For the main example all 9 are treated as one user’s, as the chapter’s interview section does. Each has two times.',
        'Look at id 7. It happened at 12:00:50 but arrived after clicks from 12:01:30 and 12:02:10. By then the watermark had reached 12:03:20: the system thought everything before that was in.',
        'So: event time is when it happened, processing time when it was seen. The key is what sessions are kept per. The watermark is the latest event time seen, minus 60 seconds.'
      ]
    },

    /* ---------- 3 · event source ---------- */
    {
      title: 'Src', layout: 'ask',
      eyebrow: '03 · Your turn · component 1, the event source',
      heading: 'What must every click carry?',
      stand: 'The event source emits clicks into the pipeline. Id 7: event time 12:00:50, value 4.',
      question: {
        step: 0,
        prompt: 'Which fields must every click carry for sessions to work?',
        options: [
          { text: 'Its event time and its key, besides its value.', correct: true,
            why: 'Sessions are cut by event time and kept per key. Without either, no session can be formed correctly.' },
          { text: 'Its arrival time and its value.', correct: false,
            why: 'Arrival time depends on network delays. Sessions built on it would change with the weather.' },
          { text: 'A session number, chosen by the website.', correct: false,
            why: 'The session is what the pipeline works out. The website cannot know it, because later clicks may change it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Event source', html: '<p>Emits each click with its event time and key. Keyed, id 7 would only ever meet its own user’s sessions; here, with one user, the gap is measured across the whole stream.[[src:src]]</p>' },
        { step: 2, title: 'Already behind', html: '<p>Id 7 arrives after clicks at 12:01:30 and 12:02:10, with the watermark at 12:03:20. Its event time is behind the watermark: it is late.[[src:src]]</p>' }
      ],
      narration: [
        'Component one, the event source, which emits clicks into the pipeline. Which fields must every click carry for sessions to work? Choose an answer.',
        'Its event time and its key, besides its value. Sessions are cut by event time and kept per key; a session number cannot come from the website, because later clicks can change it.',
        'And id 7 arrives already behind: the watermark is at 12:03:20 and its event time is 12:00:50. It is late, and the rest of the design must cope with that.'
      ]
    },

    /* ---------- 4 · window assigner ---------- */
    {
      title: 'Asgn', layout: 'ask', defines: ['assign'],
      eyebrow: '04 · Your turn · component 2, the window assigner',
      heading: 'Which session does a click belong to?',
      stand: 'The gap is 47 seconds of silence. Sessions start and stop wherever the clicks do, not on clock boundaries.',
      question: {
        step: 0,
        prompt: 'A click arrives. How does the assigner choose its session?',
        options: [
          { text: 'By its event time: a session within 47 seconds of it, or a new one.', correct: true,
            why: 'Sessions follow the data. The click joins a session it is close enough to, or starts its own.' },
          { text: 'By the clock: one session per minute.', correct: false,
            why: 'That is a fixed window. A visit that crosses a minute boundary would be split in two.' },
          { text: 'By arrival order: it joins the session that received the last click.', correct: false,
            why: 'Arrival order is not event order. Id 7 arrived eighth but happened third.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Assign', html: '<p>Putting a click into a new or existing session is to <b>assign</b> it. With one user, the gap is 47 seconds. At the book’s 120 seconds no click joins two sessions, so the interview uses 47.[[src:asg]]</p>' },
        { step: 2, title: 'Provisional', html: '<p>The assignment is a guess: the session’s ends depend on clicks that may not have arrived yet.[[src:asg]]</p>' }
      ],
      narration: [
        'Component two, the window assigner. The gap is 47 seconds. A click arrives: how does the assigner choose its session? Choose an answer.',
        'By its event time: a session within 47 seconds of it, or a new one. Putting a click into a session is called assigning it. At the book’s usual 120 seconds no click would join two sessions, which is why 47 is used.',
        'And the assignment is only a guess: a session’s ends depend on clicks still on their way.'
      ]
    },

    /* ---------- 5 · session merger ---------- */
    {
      title: 'Merge', layout: 'ask', defines: ['merge', 'bridge'],
      eyebrow: '05 · Your turn · component 3, the session merger',
      heading: 'A click that fits two sessions',
      stand: 'Before id 7 arrives there are sessions s1, 12:00:01 to 12:00:03 (total 8), and s2, 12:01:30 to 12:02:10 (total 9): 87 seconds apart, more than the gap.',
      question: {
        step: 0,
        prompt: 'Id 7 (12:00:50, value 4) is 47 seconds after s1 and 40 seconds before s2. What does the merger do?',
        options: [
          { text: 'Joins s1, id 7 and s2 into one session, 12:00:01 to 12:02:10.', correct: true,
            why: 'It is within the gap of both, so the silence that kept them apart is gone. All three become one.' },
          { text: 'Adds id 7 to s1 only, the first one it fits.', correct: false,
            why: 'Then s1 ends at 12:00:50 and s2 starts 40 seconds later: two sessions that should be one.' },
          { text: 'Starts a new session for id 7 alone.', correct: false,
            why: 'It is within 47 seconds of both neighbours, so it cannot stand alone.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Merge, and bridge', html: '<p>Collapsing sessions into one is a <b>merge</b>. A click that joins two sessions at once <b>bridges</b> them. Merged: [12:00:01, 12:02:10].[[src:mrg]]</p>' },
        { step: 2, title: 'The total', html: '<p>8 + 9 + 4 = <b>21</b>: the two old totals and the bridging click.[[src:mrg]]</p>' }
      ],
      narration: [
        'Component three, the session merger. Sessions s1 and s2 are 87 seconds apart. Id 7 is 47 seconds after s1 and 40 before s2. What does the merger do? Choose an answer.',
        'It joins all three into one session, from 12:00:01 to 12:02:10. Collapsing sessions into one is a merge, and a click that joins two at once is said to bridge them.',
        'The merged total is the two old totals plus the late click: 8 plus 9 plus 4, which is 21. Watch it happen.'
      ]
    },

    /* ---------- 6 · the bridge, animated ---------- */
    {
      title: 'Join', layout: 'array',
      eyebrow: '06 · Watch the bridge',
      heading: 'Two sessions and one late click become one session',
      stand: 'Left to right in event time: session s1, the late click, session s2.',
      array: {
        labelWidth: 130, slotLabel: 'piece',
        rows: [
          { label: 'from', values: [clock(S1.start), clock(LATE.et), clock(S2.start)] },
          { label: 'to', values: [clock(S1.end), clock(LATE.et), clock(S2.end)] },
          { label: 'total', values: [S1.sum, LATE.v, S2.sum] }
        ],
        meters: ['pieces joined', 'merged total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 700 }
        ]
      },
      cards: [
        { step: 1, title: 'The gaps it closes', html: '<p>12:00:03 to 12:00:50 is 47 seconds; 12:00:50 to 12:01:30 is 40. Both within the 47-second gap.[[src:mrg]]</p>' },
        { step: 2, title: 'One session, total 21', html: '<p>[12:00:01, 12:02:10], 8 + 4 + 9 = 21. Two sessions the reader was already told about no longer exist.[[src:mrg]]</p>' }
      ],
      narration: [
        'Here are the three pieces in event-time order: s1 from 12:00:01 to 12:00:03, the late click at 12:00:50, and s2 from 12:01:30 to 12:02:10.',
        'The late click sits 47 seconds after s1 and 40 seconds before s2: within the gap on both sides.',
        'So the three become one session. Watch the totals add: 8, plus 4, plus 9, is 21. And the two sessions the reader was already told about no longer exist.'
      ]
    },

    /* ---------- 7 · keyed session state ---------- */
    {
      title: 'State', layout: 'ask', defines: ['state'],
      eyebrow: '07 · Your turn · component 4, keyed session state',
      heading: 'How much must the pipeline remember?',
      stand: 'What the pipeline remembers between clicks is its state. Back to two users and the book’s 120-second gap: user a has 3 sessions, user b has 2.',
      question: {
        step: 0,
        prompt: 'Can the number of state entries be fixed in advance, as for windows of one minute?',
        options: [
          { text: 'No: it is one per (user, session), and depends on how bursty the clicks are.', correct: true,
            why: '5 entries for these 9 clicks; at a 40-second gap, 6. A burstier stream would need more.' },
          { text: 'Yes: one entry per user.', correct: false,
            why: 'Each of a user’s sessions has its own total. User a alone needs 3.' },
          { text: 'Yes: one entry per click.', correct: false,
            why: 'Clicks in the same session share one total. And the count of clicks is not known in advance either.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Keyed session state', html: '<p>One <b>state</b> entry per (user, session): 5 for 9 clicks at 120 seconds, 6 at 40. The number comes from the data, not from the design.[[src:sdprog]]</p>' },
        { step: 2, title: 'Compare fixed windows', html: '<p>For one-minute windows, the entries are users × open windows: known before a single click arrives. Sessions cannot be sized that way.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Component four. What the pipeline remembers between clicks is its state. With two users at the 120-second gap there are 5 sessions. Can the number of entries be fixed in advance? Choose an answer.',
        'No. It is one entry per user and session, and depends on how bursty the clicks are: 5 for these 9 clicks, 6 at a 40-second gap.',
        'For one-minute windows the number is known before a single click arrives. For sessions it comes from the data, so it cannot be sized ahead of time.'
      ]
    },

    /* ---------- 8 · the emitter ---------- */
    {
      title: 'Emit', layout: 'ask', defines: ['pane', 'trigger', 'retraction'],
      eyebrow: '08 · Your turn · component 5, the trigger and retraction emitter',
      heading: 'Two reports are now wrong',
      stand: 'One user, gap 47. Totals 8 (s1) and 9 (s2) were each reported when the watermark passed their end plus 47 seconds. Then id 7 merged them into one session worth 21.',
      question: {
        step: 0,
        prompt: 'What must the emitter send the store now?',
        options: [
          { text: 'Withdraw 8, withdraw 9, then report 21.', correct: true,
            why: 'Both old reports describe sessions that no longer exist. Each must be withdrawn, then the merged one reported.' },
          { text: 'Report 21, and let the store add it up.', correct: false,
            why: 'The store would then hold 8, 9 and 21: 38 for a visit worth 21.' },
          { text: 'Report just the 4 that id 7 added.', correct: false,
            why: 'The total comes out right, but the store still lists two sessions where there is one.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Pane, trigger, retraction', html: '<p>Each report of a session’s total is a <b>pane</b>; a <b>trigger</b> decides when one is sent — here, when the watermark passes the session’s end. A message withdrawing a pane is a <b>retraction</b>.[[src:emit]]</p>' },
        { step: 2, title: 'Two out, one in', html: '<p>Retract 8, retract 9, emit 21, so the store shows one session, not three.[[src:emit]]</p>' }
      ],
      narration: [
        'Component five. Totals 8 and 9 were each reported once the watermark passed their end plus 47 seconds. Then id 7 merged them into one session worth 21. What must be sent now? Choose an answer.',
        'Withdraw 8, withdraw 9, then report 21. Each report is a pane; a trigger decides when one is sent; and a message withdrawing a pane is a retraction.',
        'Two retractions and one new pane, so the store ends with one session, not three. Watch the messages.'
      ]
    },

    /* ---------- 9 · the messages ---------- */
    {
      title: 'Msgs', layout: 'sequence',
      eyebrow: '09 · Watch the panes reach the store',
      heading: 'Two panes, two retractions, one merged pane',
      stand: 'Top to bottom in time order, one user, gap 47.',
      sequence: {
        actors: [
          { name: 'Clicks', sub: 'one user' },
          { name: 'Merger', sub: 'sessions', src: 'mrg' },
          { name: 'Emitter', sub: 'trigger + retraction', src: 'emit' },
          { name: 'Store', sub: 'one line per session', highlight: true, src: 'sdprog' }
        ],
        messages: [
          { from: 'Merger', to: 'Emitter', label: 's1 closed: 12:00:01–12:00:03', step: 0 },
          { from: 'Emitter', to: 'Store', label: 'pane s1 = 8', step: 0 },
          { from: 'Emitter', to: 'Store', label: 'pane s2 = 9', step: 0 },
          { from: 'Clicks', to: 'Merger', label: 'late: id 7 at 12:00:50, v 4', step: 1 },
          { from: 'Merger', to: 'Emitter', label: 'merged: 12:00:01–12:02:10', step: 1 },
          { from: 'Emitter', to: 'Store', label: 'retract s1 = 8', step: 2 },
          { from: 'Emitter', to: 'Store', label: 'retract s2 = 9', step: 2 },
          { from: 'Emitter', to: 'Store', label: 'pane merged = 21', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Old bounds.</b> Each retraction names a session as it was reported.[[src:sdwhy]]' },
        { step: 3, html: '<b>Twice the bookkeeping</b> of a late click that only extends one session.[[src:sdwhen]]' },
        { step: 3, html: '<b>Final:</b> one session worth 21.[[src:emit]]' }
      ],
      narration: [
        'Top to bottom in time order. First, s1 and s2 are closed and reported to the store: 8 and 9.',
        'Then id 7 arrives late, and the merger joins s1, the click and s2 into one session from 12:00:01 to 12:02:10.',
        'So the emitter sends three messages: retract 8, retract 9, and a pane of 21 for the merged session.',
        'Each retraction names the session as it was reported. It is the same mechanism as extending one session, done twice.'
      ]
    },

    /* ---------- 10 · the store ---------- */
    {
      title: 'Store', layout: 'ask', defines: ['row'],
      eyebrow: '10 · Your turn · component 6, the analytics store',
      heading: 'What must the store be able to do?',
      stand: 'The store keeps one line, a row, per session, found by (user, session start). A merge moves the start, so the session needs a different row.',
      question: {
        step: 0,
        prompt: 'Which store can hold session windows correctly?',
        options: [
          { text: 'One that can delete a row, like a key-value store.', correct: true,
            why: 'A retraction is a delete of the old row plus an insert of the new one. The store must allow both.' },
          { text: 'An append-only log, since it never loses data.', correct: false,
            why: 'It can never remove the stale rows, so it reads 18 where 11 is right, forever.' },
          { text: 'Any store: the pipeline can work around it.', correct: false,
            why: 'No pipeline work can make a store delete. This is a hard requirement on the store itself.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Delete plus insert', html: '<p>A fixed window’s correction updates a <b>row</b>. A session’s deletes one row and inserts another, because the bounds are the key. Keyed, at gap 40: retract 7, emit 11 — a store that cannot delete reads 18.[[src:sdwhy]]</p>' },
        { step: 2, title: 'Check this first', html: '<p>Viable with a key-value store or a warehouse with upsert and delete. Not with an append-only event log or a billing ledger.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Component six, the analytics store. It keeps one line, called a row, per session, found by user and session start. Which store can hold sessions correctly? Choose an answer.',
        'One that can delete a row. A merge moves the start, so the correction deletes the old row and inserts a new one. In the per-user stream at a 40-second gap, a store that cannot delete reads 18 where 11 is right.',
        'So check the store first. A key-value store or a warehouse that can delete is fine; an append-only log or a billing ledger is not, and nothing upstream can fix that.'
      ]
    },

    /* ---------- 11 · the design ---------- */
    {
      title: 'Plan', layout: 'graph',
      eyebrow: '11 · The design, assembled',
      heading: 'Six stages; two exist only because sessions change',
      stand: 'Each box is one answer you chose. The dashed boxes are the price of choosing sessions.',
      graph: {
        viewBox: '0 0 1520 300', legend: true,
        nodes: [
          { id: 'src', x: 10, y: 100, w: 210, h: 96, title: 'Event source', sub: 'event time + key', kind: 'main', step: 0, src: 'src' },
          { id: 'asg', x: 260, y: 100, w: 210, h: 96, title: 'Window assigner', sub: 'gap 47 s', kind: 'main', step: 0, src: 'asg' },
          { id: 'mrg', x: 510, y: 100, w: 210, h: 96, title: 'Session merger', sub: 'joins bridged sessions', kind: 'new', step: 1, src: 'mrg', values: [null, '8 + 9 + 4 = 21'] },
          { id: 'st', x: 760, y: 100, w: 210, h: 96, title: 'Session state', sub: 'per (key, session)', kind: 'main', step: 2, src: 'sdprog', values: [null, null, '3 at 47 s'] },
          { id: 'emit', x: 1010, y: 100, w: 230, h: 96, title: 'Trigger / retraction', sub: 'emits and corrects', kind: 'new', step: 3, src: 'emit', values: [null, null, null, '−8, −9, +21'] },
          { id: 'db', x: 1280, y: 100, w: 230, h: 96, title: 'Analytics store', sub: 'must delete rows', kind: 'change', step: 3, src: 'sdwhen' }
        ],
        edges: [
          { from: 'src', to: 'asg', kind: 'main', step: 0 },
          { from: 'asg', to: 'mrg', kind: 'new', step: 1 },
          { from: 'mrg', to: 'st', kind: 'main', step: 2 },
          { from: 'st', to: 'emit', kind: 'new', step: 3 },
          { from: 'emit', to: 'db', kind: 'change', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>Not a configuration change:</b> choosing sessions adds two stages and a requirement on the store.[[src:sdwhy]]' },
        { step: 4, html: '<b>Data-dependent state:</b> 3 sessions for this one user at 47 s; 5 entries for the keyed stream at 120 s; unknown in general.[[src:sdwhen]]' },
        { step: 4, html: '<b>Corrections</b> delete a row and insert another.[[src:sdwhy]]' }
      ],
      narration: [
        'Here is the whole pipeline. The event source emits clicks with event time and key, and the window assigner puts each into a session using the 47-second gap.',
        'Next, the session merger, a stage that exists only for sessions. It joins sessions a late click bridges: 8 plus 9 plus 4 makes 21.',
        'Then the session state, one entry per key and session. This one user ends with 3 sessions at the 47-second gap; the two-user stream at the book’s 120-second gap holds 5.',
        'Then the trigger and retraction emitter, the other session-only stage: it sends minus 8, minus 9, plus 21. And the store, which must be able to delete rows.',
        'So choosing session windows is not a configuration change. It adds two stages, and places a hard requirement on the store.'
      ]
    },

    /* ---------- 12 · coupled settings ---------- */
    {
      title: 'Gap', layout: 'ask', defines: ['allowed lateness'],
      eyebrow: '12 · Your turn · the two settings are coupled',
      heading: 'The product team shrinks the gap',
      stand: 'Back to two users. At a 120-second gap user a has 3 sessions and no retraction is ever needed. The team changes the gap to 40 seconds.',
      question: {
        step: 0,
        prompt: 'Besides user a now having 4 sessions, what else changes?',
        options: [
          { text: 'A retraction becomes mandatory: sessions close before a late click lands.', correct: true,
            why: 'A smaller gap closes sessions earlier. At 40 seconds, user b’s session is reported before id 7 arrives.' },
          { text: 'Nothing: the gap only decides how many sessions there are.', correct: false,
            why: 'It also decides when sessions close, and closing early is what forces a retraction.' },
          { text: 'Retractions stop: shorter sessions are simpler.', correct: false,
            why: 'The opposite: at 120 none was needed, at 40 one is.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Not independent knobs', html: '<p>Gap 120: user a has 3 sessions, 0 retractions. Gap 40: 4 sessions, 1 retraction. A decision about what counts as a visit reaches into the storage contract.[[src:sdwhy]]</p>' },
        { step: 2, title: 'Allowed lateness', html: '<p><b>Allowed lateness</b> — how long after closing a session can still be revived — is the price of correcting, paid in memory per open session. Set it against the memory, not the skew.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'At a 120-second gap, user a has 3 sessions and no retraction is ever needed. The team changes the gap to 40 seconds. Besides 4 sessions, what else changes? Choose an answer.',
        'A retraction becomes mandatory. A smaller gap closes sessions earlier, so user b’s session is reported before id 7 arrives. The gap and the store contract are coupled.',
        'And allowed lateness, how long after closing a session can still be revived, is the price of being able to correct. It is paid in memory for every open session.'
      ]
    },

    /* ---------- 13 · what it does not settle ---------- */
    {
      title: 'Not', layout: 'ask',
      eyebrow: '13 · Your turn · what this design does not settle',
      heading: 'A user who never comes back',
      stand: 'User a’s last click is at 12:09:00, gap 120. A session can be freed when the watermark passes its end plus the gap. The stream’s watermark ends at 12:08:00.',
      question: {
        step: 0,
        prompt: 'When is that session’s state freed?',
        options: [
          { text: 'Never in this stream: the watermark must reach 12:11:00.', correct: true,
            why: 'Nothing else rules out a late click. A user who goes quiet forever is memory held forever.' },
          { text: 'When allowed lateness runs out.', correct: false,
            why: 'Allowed lateness counts from the watermark passing the end. The watermark never gets there.' },
          { text: 'After 120 seconds of real time.', correct: false,
            why: 'The design frees state by the watermark, not by the wall clock.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'It does NOT settle…', html: '<ul class="l"><li>how much state: 5 entries for the keyed stream at 120 s, nothing bounds a burstier stream;</li><li>quiet keys: one session is never collected, a permanent allocation.[[src:sdwhen]]</li></ul>' },
        { step: 2, title: '…nor these', html: '<ul class="l"><li>the bridge on the keyed stream: shown only with users dropped;</li><li>the gap itself: 4, 3, 2 or 1 sessions for user a at 40, 120, 130, 300 seconds, and the data cannot say which is right.[[src:sdwhen]]</li></ul>' }
      ],
      narration: [
        'User a’s last click is at 12:09:00, and the watermark ends at 12:08:00. When is that session’s state freed? Choose an answer.',
        'Never in this stream: the watermark would have to reach 12:11:00. So the design does not settle how much state there is, and a quiet key is a permanent allocation.',
        'Nor does it settle two more things: the bridge appears only with the users dropped, and the gap itself cannot be verified. User a has 4, 3, 2 or 1 sessions depending on it.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · The design, a sentence per component',
      heading: 'Assign, merge, keep, retract — and a store that can delete',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Event source</b>', 'Emits clicks with event time and key.', 'What must a click carry?[[src:src]]'] },
          { step: 0, cells: ['<b>Window assigner</b>', 'Puts each click in a session by event time; gap 47 s.', 'Which session?[[src:asg]]'] },
          { step: 1, cells: ['<b>Session merger</b>', 'Joins sessions a late click bridges: 8 + 9 + 4 = 21.', 'A click that fits two?[[src:mrg]]'] },
          { step: 1, cells: ['<b>Keyed session state</b>', 'One entry per (key, session): 5 here, not known in advance.', 'How much to remember?[[src:sdprog]]'] },
          { step: 2, cells: ['<b>Trigger / retraction emitter</b>', 'Retract 8, retract 9, emit 21.', 'How to correct a report?[[src:emit]]'] },
          { step: 2, cells: ['<b>Analytics store</b>', 'Must delete a row and insert another.', 'What must it be able to do?[[src:sdwhen]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Sessions are the window whose reported results can stop existing. So choosing them adds a merger, a retraction emitter, and a store that can delete — and the gap decides how often all three are needed.[[src:sdwhy]]</p>' },
      narration: [
        'To recap. The event source emits clicks with event time and key. The assigner puts each into a session by event time, here with a 47-second gap.',
        'The merger joins sessions that a late click bridges, 8 plus 9 plus 4 into 21. The state keeps one entry per key and session, a number set by the data.',
        'The emitter corrects with retractions: minus 8, minus 9, plus 21. And the store must be able to delete a row and insert another.',
        'In one line: sessions are the window whose reports can stop existing, so choosing them adds two stages and a store that can delete, and the gap decides how often they are needed.'
      ]
    }
  ]
};
