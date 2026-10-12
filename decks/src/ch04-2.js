// Chapter 4, Part 2 — "The window lifecycle": assign, merge, group and trigger, accumulate and
// garbage-collect, for a viewer who has read nothing before it. The nine events, both clocks
// and every word are re-introduced; each step is asked about before it is shown; the merge
// and the collection are animated on the seed's own arrivals. Every value is computed from
// tools/stream_seed.js and asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch04';
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const span = s => (s.start === s.end ? clock(s.start) : `${clock(s.start)}–${clock(s.end)}`);

// key b's sessions after each of its arrivals, in processing order (gap 120)
const sessionsOf = (events, gap) => {
  const es = events.slice().sort((x, y) => x.et - y.et), out = [];
  for (const e of es) {
    const last = out[out.length - 1];
    if (last && e.et - last.end <= gap) { last.end = e.et; last.ids.push(e.id); }
    else out.push({ start: e.et, end: e.et, ids: [e.id] });
  }
  return out;
};
const B = E.filter(e => e.key === 'b');
const B_STEPS = B.map((_, i) => sessionsOf(B.slice(0, i + 1), seed.GAP));
const MOVED = B_STEPS.map((ss, i) => (i && ss.some(s => B_STEPS[i - 1].some(p => p.end === s.end && s.start < p.start)) ? 'yes' : 'no'));
const ALL = [...seed.SESSIONS.a.map(s => ['a', s]), ...seed.SESSIONS.b.map(s => ['b', s])];
const WM = seed.WATERMARKS;
const B1 = seed.SESSIONS.b[0];
const FREE_AT = WM.findIndex(w => w >= B1.end + seed.GAP);
const FREED = WM.map(w => (w >= B1.end + seed.GAP ? 'yes' : 'no'));
const AT40 = WM.findIndex(w => w >= 90 + 40);
const NEVER = seed.SESSIONS.a[seed.SESSIONS.a.length - 1];

if (MOVED.join() !== 'no,no,yes,yes' || B_STEPS[3].map(span).join() !== '12:00:50–12:01:30,12:03:40–12:04:20'
  || ALL.length !== 5 || ALL.map(([, s]) => seed.SUM(s.ids)).join() !== '8,8,8,11,10'
  || WM.join() !== '-59,-57,30,70,185,200,200,200,480' || B1.end + seed.GAP !== 210 || FREE_AT !== 8
  || AT40 !== 4 || E.indexOf(E.find(e => e.id === 7)) !== 7 || NEVER.end + seed.GAP !== 660 || seed.LAG !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'A Window’s Life',
  eyebrow: 'Streaming · Ch 4 · Part 2',
  ...shared,
  jargon: ['event', 'user', 'window', 'session', 'gap', 'event time', 'processing time', 'key', 'assign', 'merge',
    'state', 'trigger', 'pane', 'watermark', 'garbage-collect', 'retraction'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    flow:  section(CH, 'The window lifecycle', 'Chapter 4 · the window lifecycle'),
    why:   section(CH, 'Why a session assignment is a hypothesis, and where the memory is released', 'Chapter 4 · why a session is a hypothesis'),
    when:  section(CH, 'When merging matters, and what collection is actually buying', 'Chapter 4 · what collection buys'),
    prog:  section(CH, 'The lifecycle — stack and heap at every step', 'Chapter 4 · the lifecycle as a program'),
    shape: section(CH, 'Why there are three shapes, and why one of them has no answer without a setting', 'Chapter 4 · the three shapes')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'user', 'window', 'session', 'gap', 'assign', 'merge', 'trigger'],
      eyebrow: '01 · Chapter 4 · Part 2',
      heading: 'A window is born, grows, reports, and is thrown away',
      hero: { step: 0, text: 'A website records clicks. Each click is an <b>event</b> carrying a small number <code>v</code>. Two visitors, <b>users</b> <code>a</code> and <code>b</code>, make 9 events. Reports add the numbers up per <b>window</b>, a stretch of time. One kind of window is a <b>session</b>: a burst of clicks ended by a silence longer than the <b>gap</b>, here 120 seconds.[[src:shape]]' },
      tiles: [
        { step: 1, value: 9, label: 'events' },
        { step: 1, value: 120, label: 'seconds: the gap[[src:why]]' },
        { step: 2, value: 5, label: 'sessions to keep in memory[[src:why]]' },
        { step: 2, value: 2, label: 'sessions that change shape after they exist[[src:why]]' }
      ],
      cardsLabel: 'Four steps every window goes through',
      cards: [
        { step: 3, n: 1, title: 'Assign', text: 'Which windows does this event belong to?' },
        { step: 3, n: 2, title: 'Merge', text: 'Does it join windows that already exist?' },
        { step: 4, n: 3, title: 'Group and trigger', text: 'Keep a total per window; decide when to report it.' },
        { step: 4, n: 4, title: 'Accumulate and collect', text: 'Combine reports, then free the memory.' }
      ],
      note: { step: 4, text: 'You will be asked before each step is explained. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website records clicks. Each click is an event with a small number attached. Reports add the numbers per window, a stretch of time. A session is a burst of clicks ended by a long enough silence, called the gap.',
        'Two users, a and b, make 9 events, and the gap is 120 seconds. This part follows a window through its whole life, using these events.',
        'At the end there will be 5 sessions in memory, and 2 of them will have changed shape after they already existed. We will see exactly why.',
        'Every window goes through the same steps. First, assign: which windows does an event belong to? Then merge: does it join windows that already exist?',
        'Then group and trigger: keep a total per window and decide when to report it. Finally, accumulate and collect: combine the reports, then free the memory.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'key'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'In the order the system received them. Times are clock times just after noon.',
      table: {
        columns: ['Arrival', 'Event', 'User', 'Happened at', 'Seen at', 'v'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`${i}`, `id ${e.id}`, e.key, i >= 6 && i <= 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), clock(e.pt), `${e.v}`] }))
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click happened.</li><li><b>Processing time</b> — when the system received it. Delays make the two differ.</li><li>Ids 6 and 7 arrive <b>after</b> later clicks of user b: out of order.</li><li>The user is the event’s <b>key</b>: sessions are kept per key.[[src:why]]</li></ul>' },
      narration: [
        'Here are the first five events, numbered by arrival. Each has two times: when it happened, and when the system saw it. So far they arrive roughly in the order they happened.',
        'Now look at arrivals 6 and 7, both from user b. Id 6 happened at 12:03:40, earlier than id 5. Id 7 happened at 12:00:50, almost four minutes before it arrived.',
        'So each event carries two clocks. When it happened is its event time; when the system saw it is its processing time. And the user an event belongs to is called its key.'
      ]
    },

    /* ---------- 3 · step 1: assign ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['assign'],
      eyebrow: '03 · Your turn · step 1',
      heading: 'An event arrives. Which windows does it belong to?',
      stand: 'Id 4 happened at 12:04:05 and arrived at 12:04:06. The system must decide which windows it joins.',
      question: {
        step: 0,
        prompt: 'What does the system read to decide which windows id 4 belongs to?',
        options: [
          { text: 'Its event time, and the rule for the window shape.', correct: true,
            why: 'A window is a stretch of event time, so only when the click happened, plus the shape’s rule, can decide.' },
          { text: 'Its processing time, and the rule for the window shape.', correct: false,
            why: 'Then a network delay could move a click into the wrong window. Arrival time is never read here.' },
          { text: 'Every other event, to see which windows are busiest.', correct: false,
            why: 'Busy or quiet, the windows are defined by time. Other events are not consulted for this step.' }
        ]
      },
      cards: [
        { step: 1, title: 'Assign', html: '<p>Putting an event into its window or windows, by its event time and the shape’s rule, is the first step: <b>assign</b>.[[src:flow]]</p>' }
      ],
      narration: [
        'Step one. Id 4 happened at 12:04:05 and arrived one second later. What does the system read to decide which windows it belongs to? Choose an answer.',
        'Its event time and the shape’s rule, and nothing else. Putting an event into its windows is called assigning it. Now watch what assign returns for each shape.'
      ]
    },

    /* ---------- 4 · assign for three shapes ---------- */
    {
      title: 'Put', layout: 'table',
      eyebrow: '04 · What assign returns for id 4, under each shape',
      heading: 'For a session, the answer is not final',
      stand: 'The same event, three window shapes. Fixed windows are 120 seconds side by side; sliding windows are 120 seconds long and start every 60.',
      table: {
        columns: ['Shape', 'Windows for id 4 (happened 12:04:05)', 'Final?'],
        rows: [
          { step: 0, cells: ['Fixed', '12:04 to 12:06 — one window[[src:why]]', 'yes'] },
          { step: 1, cells: ['Sliding', '12:03 to 12:05, and 12:04 to 12:06 — two windows[[src:why]]', 'yes'] },
          { step: 2, cells: ['Session', 'one session, whose start and end are <b>not known yet</b>[[src:why]]', '<b>no</b>'] }
        ]
      },
      side: { step: 3, title: 'A guess, not a fact', html: '<p>A fixed or sliding answer never changes. A session’s ends depend on clicks that may not have arrived, so its assignment is a <b>hypothesis</b> that a later event can revise.[[src:why]]</p><p>That is why sessions need the next step, and no other shape does.[[src:flow]]</p>' },
      narration: [
        'For fixed windows, id 4 goes into exactly one window, 12:04 to 12:06. That answer is final.',
        'For sliding windows, it goes into two: 12:03 to 12:05, and 12:04 to 12:06. Also final.',
        'For sessions, it goes into one session, but nobody yet knows where that session starts or ends. That depends on clicks that may still be on their way.',
        'So a session assignment is a guess that a later event can revise. That is why sessions need the next step, and the other shapes never do.'
      ]
    },

    /* ---------- 5 · step 2: merge ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['merge'],
      eyebrow: '05 · Your turn · step 2',
      heading: 'A click from the past lands next to a session',
      stand: 'User b so far has two sessions: one at 12:01:30, one at 12:04:20. Then id 6 arrives. It happened at 12:03:40, 40 seconds before the second.',
      question: {
        step: 0,
        prompt: 'With a gap of 120 seconds, what happens to the session at 12:04:20 when id 6 arrives?',
        options: [
          { text: 'It now starts at 12:03:40: its start moves earlier.', correct: true,
            why: '40 seconds is within the gap, so id 6 joins it. The session grows backwards in time.' },
          { text: 'Nothing: sessions only grow forwards in time.', correct: false,
            why: 'That holds only when events arrive in order. A late click can land before a session’s start.' },
          { text: 'Id 6 starts a third session of its own.', correct: false,
            why: 'It is only 40 seconds from the next click, well within the 120-second gap.' }
        ]
      },
      cards: [
        { step: 1, title: 'Merge', html: '<p>When a new event lands within the gap of an existing session, the two become one window: a <b>merge</b>. Here the session’s <b>start</b> moved, after the session already existed.[[src:why]]</p>' },
        { step: 2, title: 'No other shape does this', html: '<p>A fixed window’s ends are fixed by the clock. Only a session can change its ends after it was created.[[src:why]]</p>' }
      ],
      narration: [
        'Step two. User b has a session at 12:01:30 and one at 12:04:20. Then id 6 arrives, which happened at 12:03:40. What happens to the session at 12:04:20? Choose an answer.',
        'Its start moves to 12:03:40. When an event lands within the gap of a session, they join together. That is called a merge. Here it made the session grow backwards in time.',
        'No other shape can do this. A fixed window’s ends are set by the clock. Only a session changes its boundaries after it was born. Watch it happen to all of user b’s clicks.'
      ]
    },

    /* ---------- 6 · merges, animated ---------- */
    {
      title: 'Merge', layout: 'array',
      eyebrow: '06 · Watch user b’s sessions change as each click arrives',
      heading: 'Two late clicks, two starts pulled backwards',
      stand: 'User b’s four clicks, in the order they arrive. Under each: user b’s sessions right after that arrival.',
      array: {
        labelWidth: 170, slotLabel: 'arrival of b',
        rows: [
          { label: 'event', values: B.map(e => `id ${e.id}`) },
          { label: 'happened', values: B.map(e => clock(e.et)) },
          { label: 'first session', values: B_STEPS.map(ss => span(ss[0])) },
          { label: 'second session', values: B_STEPS.map(ss => (ss[1] ? span(ss[1]) : '—')) },
          { label: 'a start moved?', values: MOVED }
        ],
        meters: ['arrivals', 'starts moved back'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'show', rows: [4] },
          { step: 2, do: 'sweep', row: 4, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 700 }
        ]
      },
      cards: [
        { step: 1, title: 'Assign and merge at once', html: '<p>Each arrival is assigned and, if it lands within 120 seconds of a session, merged into it in the same move.[[src:prog]]</p>' },
        { step: 2, title: 'Both merges were late arrivals', html: '<p>Id 6 pulled 12:04:20 back to 12:03:40; id 7 pulled 12:01:30 back to 12:00:50. A pipeline that assumes a session only grows forwards is wrong on this data.[[src:when]]</p>' }
      ],
      narration: [
        'Here are user b’s four clicks, in the order they arrive: ids 2, 5, 6 and 7. Notice the times go up, then back down twice.',
        'Under each arrival, user b’s sessions right after it. Id 5 is more than 120 seconds after id 2, so it opens a second session. Then id 6 arrives and the second session now starts at 12:03:40.',
        'Then id 7 arrives, from 12:00:50, and the first session now starts there. Watch the counter: two arrivals, two starts pulled backwards. Both were caused by late arrival.'
      ]
    },

    /* ---------- 7 · step 3: group ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['state'],
      eyebrow: '07 · Your turn · step 3',
      heading: 'One running total per user, per session',
      stand: 'What the system must remember between events is its state. Here it keeps one running total for each pair of user and session.',
      question: {
        step: 0,
        prompt: 'User a ends with 3 sessions and user b with 2. How many running totals must the system keep?',
        options: [
          { text: 'Five: one per user and session pair.', correct: true,
            why: 'Totals are kept per pair, and user a’s sessions never mix with user b’s. Three plus two.' },
          { text: 'Two: one per user.', correct: false,
            why: 'Then all of a user’s sessions would be added together, and the visits could not be told apart.' },
          { text: 'Nine: one per event.', correct: false,
            why: 'Events in the same session share one total. Keeping one per event would be keeping the events themselves.' }
        ]
      },
      cards: [
        { step: 1, title: 'Grouped by user and window', html: '<p>The unit of <b>state</b> is the pair (user, window). For sessions, the number of pairs depends on how bursty the clicks were.[[src:why]]</p>' },
        { step: 2, title: 'Cannot be sized in advance', html: '<p>Fixed windows give a known number of pairs. Sessions give 5 here, and a burstier stream would give more. Nobody can say ahead of time.[[src:when]]</p>' }
      ],
      narration: [
        'Step three. The system keeps one running total for each pair of user and session. User a ends with 3 sessions and user b with 2. How many totals? Choose an answer.',
        'Five. What a system must remember between events is called its state, and here its unit is the pair of user and window. User a’s sessions never mix with user b’s.',
        'Fixed windows give a number of pairs you can work out in advance. Sessions give 5 here, and a burstier stream would give more. Their state cannot be sized ahead of time.'
      ]
    },

    /* ---------- 8 · the state, and when it reports ---------- */
    {
      title: 'Group', layout: 'table', defines: ['trigger', 'pane'],
      eyebrow: '08 · The five state entries, and when they report',
      heading: 'Group the events, then let a trigger decide when to report',
      stand: 'The state at the end of the stream, one row per (user, session).',
      table: {
        columns: ['User', 'Session', 'Events', 'Total of v'],
        rows: ALL.map(([k, s], i) => ({ step: i < 3 ? 0 : 1, cells: [k, span(s), s.ids.map(x => `id ${x}`).join(', '), `${seed.SUM(s.ids)}`] }))
      },
      side: { step: 2, title: 'Trigger and pane', html: '<ul class="l"><li>A <b>trigger</b> is the rule deciding <b>when</b> a window’s total is reported.[[src:flow]]</li><li>Each report it produces is a <b>pane</b>: the window’s total at that moment.[[src:flow]]</li><li>How a later pane relates to an earlier one of the same window — a replacement or an addition — is the window’s <b>accumulation</b> rule.[[src:flow]]</li></ul>' },
      narration: [
        'Here is the state at the end of the stream. User a has three sessions, each with a total of 8.',
        'User b has two: one from 12:00:50 to 12:01:30 with ids 7 and 2, total 11, and one from 12:03:40 to 12:04:20, total 10. Five entries in all.',
        'The rule deciding when a window’s total is reported is called a trigger, and each report is called a pane. How a later pane combines with an earlier one is the accumulation rule.'
      ]
    },

    /* ---------- 9 · step 4: when is it over ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['watermark'],
      eyebrow: '09 · Your turn · step 4',
      heading: 'When may a session’s memory be freed?',
      stand: 'The system keeps a watermark: the latest event time seen so far, minus 60 seconds. It is the system’s estimate that nothing older is still on its way.',
      question: {
        step: 0,
        prompt: 'User b’s session 12:00:50 to 12:01:30 has had no new click for a while. When may the system forget it?',
        options: [
          { text: 'When the watermark passes its end plus the gap: 12:03:30.', correct: true,
            why: 'Only then has the system judged that no click within 120 seconds of its end can still arrive.' },
          { text: 'When 120 seconds of real time pass with no click for it.', correct: false,
            why: 'Quiet on the wall clock proves nothing: a click from 12:01:00 could still be stuck in a network.' },
          { text: 'As soon as its total has been reported once.', correct: false,
            why: 'A report is not the end. A late click can still join the session and change the total.' }
        ]
      },
      cards: [
        { step: 1, title: 'Watermark', html: '<p>Latest event time seen, minus 60 seconds. When it passes a time, the system assumes no event from before that time will arrive.[[src:prog]]</p>' },
        { step: 2, title: 'End plus gap', html: '<p>12:01:30 plus 120 seconds is 12:03:30. Until the watermark passes it, a click could still extend the session. This chapter sets no allowed lateness, so that is the whole bound.[[src:why]]</p>' }
      ],
      narration: [
        'Step four. The system keeps a watermark: the latest event time it has seen, minus 60 seconds. User b’s first session has been quiet. When may it be forgotten? Choose an answer.',
        'When the watermark passes its end plus the gap. The watermark is the system’s estimate that nothing older than it is still on its way.',
        'The session ends at 12:01:30; add the 120-second gap and you get 12:03:30. Until the watermark passes that, a click could still join. This chapter sets no allowed lateness, so nothing is added to that bound.'
      ]
    },

    /* ---------- 10 · collection, animated ---------- */
    {
      title: 'Free', layout: 'array', defines: ['garbage-collect'],
      eyebrow: '10 · Watch the watermark climb until the session can be freed',
      heading: 'Freed at arrival 8 — one arrival after its last member came in',
      stand: 'Times in seconds after 12:00:00, so 12:03:30 is 210. After each arrival: the watermark, and whether it has passed 210.',
      array: {
        labelWidth: 170, slotLabel: 'arrival',
        rows: [
          { label: 'happened (s)', values: E.map(e => e.et) },
          { label: 'watermark (s)', values: WM },
          { label: 'past 210?', values: FREED }
        ],
        meters: ['arrivals checked', 'times past 210'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'pick', slots: [7, 8] }
        ]
      },
      cards: [
        { step: 1, title: 'A comparison, not a timer', html: '<p>The watermark first reaches 210 at arrival 8, when 12:09:00 arrives. Then the session’s state is freed: it is <b>garbage-collected</b>.[[src:prog]]</p>' },
        { step: 2, title: 'A margin of one', html: '<p>Id 7, a member of this session, arrived at arrival 7. Freed at 8, it was still in memory: 8 is not before 7, so nothing went wrong — by one arrival.[[src:why]]</p>' },
        { step: 3, title: 'One is never freed', html: '<p>User a’s session at 12:09:00 needs the watermark past 12:11:00. It ends at 12:08:00, so that state is held for the life of the job.[[src:when]]</p>' }
      ],
      narration: [
        'Times are now in seconds after noon, so 12:03:30 is 210. Here is the watermark after each arrival. It climbs as later times arrive, and it never goes down.',
        'Watch the check. The watermark stays below 210 until arrival 8, when the click at 12:09:00 arrives. Only then is the session freed. Freeing a window’s state is called garbage-collecting it.',
        'Now look at arrivals 7 and 8. Id 7, which belongs to this session, arrived at 7, and the session was freed at 8. One arrival later, and id 7 would have found nothing to join.',
        'And one session is never freed: user a’s click at 12:09:00 needs the watermark past 12:11:00, and it stops at 12:08:00. That state stays in memory for as long as the job runs.'
      ]
    },

    /* ---------- 11 · a smaller gap ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['retraction'],
      eyebrow: '11 · Your turn',
      heading: 'Shrink the gap to 40 seconds',
      stand: 'At a 40-second gap, user b’s session at 12:01:30 is reported and freed at arrival 4. Id 7, which belongs to it, arrives at arrival 7.',
      question: {
        step: 0,
        prompt: 'What must the system do when id 7 arrives, after that session was already reported?',
        options: [
          { text: 'Withdraw the old report and send a new one.', correct: true,
            why: 'The reported session no longer exists in that form. Saying so is the only way to keep the reader’s total right.' },
          { text: 'Nothing: the report was correct when it was sent.', correct: false,
            why: 'Correct then, wrong now. A reader adding up reports would count the session’s clicks wrongly.' },
          { text: 'Report id 7 alone as a new session.', correct: false,
            why: 'Id 7 is within 40 seconds of id 2, so it belongs to that session. A separate report would be untrue.' }
        ]
      },
      cards: [
        { step: 1, title: 'Retraction', html: '<p>A message that withdraws a report already sent is a <b>retraction</b>. At gap 120 none is needed, by a margin of one arrival. At gap 40 one is forced.[[src:why]]</p>' },
        { step: 2, title: 'A setting, not the data', html: '<p>“Does my pipeline need retractions?” depends on the gap, and here it turns on a single event’s place in the stream.[[src:when]]</p>' }
      ],
      narration: [
        'At a gap of 40 seconds, user b’s session at 12:01:30 is reported and freed at arrival 4. Then id 7, which belongs to it, arrives at 7. What must the system do? Choose an answer.',
        'Withdraw the old report and send a new one. A message that withdraws a report already sent is called a retraction. At gap 120 none was needed; at gap 40 one is forced.',
        'So whether a pipeline needs retractions is not a fact about the data. It depends on a setting, and here it turns on a single event’s place in the stream. Part 3 follows it through.'
      ]
    },

    /* ---------- 12 · what collection buys ---------- */
    {
      title: 'Costs', layout: 'cards',
      eyebrow: '12 · When merging matters, and what collection buys',
      heading: 'Merging is normal; freeing memory is the only thing that frees it',
      stand: 'Three lessons from this stream.',
      columns: 3,
      cards: [
        { step: 0, title: 'Merging is normal', html: '<p>Both merges here came from out-of-order arrival, and both moved a start backwards. On real data, clicks always arrive out of order.[[src:when]]</p>' },
        { step: 1, title: 'Where state grows', html: '<p>State is one entry per (user, window). A stream of short bursts makes far more entries than the same clicks arriving steadily.[[src:when]]</p>' },
        { step: 2, title: 'What collection buys', html: '<p>Memory back, and nothing else does. A quiet user’s last session that is never collected is held forever: the leak that eventually matters.[[src:when]]</p>' }
      ],
      narration: [
        'Three lessons. First, merging is normal: both merges in this stream came from out-of-order arrival, and on real data clicks always arrive out of order.',
        'Second, state is one entry per user and window. A stream of short bursts makes far more entries than the same clicks arriving steadily.',
        'Third, collection is the only thing that gives memory back. A quiet user’s last session that is never collected is held forever, which is the leak that eventually matters.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'Which step only sessions need',
      stand: 'Assign, merge, group and trigger, accumulate and collect.',
      question: {
        step: 0,
        prompt: 'Which of the four steps does nothing at all for fixed windows?',
        options: [
          { text: 'Merge: a fixed window’s ends never change.', correct: true,
            why: 'Fixed windows are set by the clock. Only sessions can be joined together by a late event.' },
          { text: 'Assign: fixed windows need no assigning.', correct: false,
            why: 'Every event must still be put in its window, by its event time.' },
          { text: 'Collect: fixed windows are never freed.', correct: false,
            why: 'They are freed too, when the watermark passes their end. Otherwise memory would grow forever.' }
        ]
      },
      narration: [
        'One last question. Of the four steps, which does nothing at all for fixed windows? Choose an answer.',
        'Merge. A fixed window’s ends are set by the clock and never change. Only a session can be joined to a late event, and that is what makes sessions dynamic.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Four steps, and the one that makes sessions hard',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Step', 'What it does here'],
        rows: [
          { step: 0, cells: ['<b>Assign</b>', 'Reads event time and the shape’s rule. Final for fixed and sliding; only a guess for a session.[[src:why]]'] },
          { step: 0, cells: ['<b>Merge</b>', 'A late click within the gap joins a session. Ids 6 and 7 each pulled a start backwards.[[src:why]]'] },
          { step: 1, cells: ['<b>Group</b> and <b>trigger</b>', 'One total per (user, session): 5 entries. A trigger decides when each pane is reported.[[src:why]]'] },
          { step: 1, cells: ['<b>Collect</b>', 'When the watermark passes end plus gap: 210 seconds, reached at arrival 8. One session is never freed.[[src:prog]]'] },
          { step: 2, cells: ['<b>Retraction</b>', 'Needed when a session is freed before its last member arrives: not at gap 120, forced at gap 40.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>At gap 40 a session is reported, then changes. Part 3 follows that retraction to the reader, and shows why keeping sessions per user matters.</p>' },
      narration: [
        'To recap. Assign reads the event time and the shape’s rule; for a session it is only a guess. Merge joins a late click to a session, and here moved two starts backwards.',
        'Group keeps one total per user and session, five in all, and a trigger decides when each is reported as a pane. Collect frees a session once the watermark passes its end plus the gap.',
        'A retraction withdraws a report. It is needed when a session is freed before its last member arrives: not at gap 120 here, but forced at gap 40.',
        'Next, part 3 follows that retraction all the way to the reader, and shows why keeping sessions per user is a matter of correctness.'
      ]
    }
  ]
};
