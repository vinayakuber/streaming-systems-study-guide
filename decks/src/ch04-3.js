// Chapter 4, Part 3 — "Session semantics and pitfalls", for a viewer who has read nothing
// before it. The nine events, both clocks and every word are re-introduced; the retraction at
// a 40-second gap is followed to the store that receives it, the per-user near miss is
// animated, and the bridge case is previewed. Every value comes from tools/stream_seed.js.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch04';
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const SORTED = E.slice().sort((x, y) => x.et - y.et);
const QUIET = SORTED.map((e, i) => (i ? e.et - SORTED[i - 1].et : null));
const NEW = QUIET.map(q => (q === null || q > seed.GAP ? 'yes' : 'no'));
const B1 = seed.SESSIONS.b[0], B2 = seed.SESSIONS.b[1];
const ID3 = E.find(e => e.id === 3);
const NEVER = seed.SESSIONS.a[seed.SESSIONS.a.length - 1];
const OLD = seed.SUM([2]), NEWV = seed.SUM([7, 2]);
const AT40 = seed.WATERMARKS.findIndex(w => w >= 90 + 40);

if (NEW.filter(x => x === 'yes').length !== 2 || seed.SESSIONS.a.length + seed.SESSIONS.b.length !== 5
  || OLD !== 7 || NEWV !== 11 || OLD + NEWV !== 18 || AT40 !== 4 || E[7].id !== 7
  || B2.start - B1.end !== 130 || ID3.et - B1.end !== 40 || NEVER.end + seed.GAP !== 660
  || seed.WATERMARKS[8] !== 480 || QUIET.slice(1, 8).join() !== '2,47,40,40,90,25,15')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Sessions That Change',
  eyebrow: 'Streaming · Ch 4 · Part 3',
  ...shared,
  jargon: ['event', 'user', 'window', 'session', 'gap', 'event time', 'processing time', 'key', 'watermark',
    'pane', 'retraction', 'row', 'garbage-collect', 'bridge'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    flow:  section(CH, 'Session semantics and pitfalls', 'Chapter 4 · session semantics'),
    why:   section(CH, 'Why a session is the one window whose published result can stop existing', 'Chapter 4 · a result that stops existing'),
    when:  section(CH, 'When retraction is unavoidable, and how to choose the shape', 'Chapter 4 · when retraction is unavoidable'),
    prog:  section(CH, 'Session semantics — stack and heap at every step', 'Chapter 4 · session semantics as a program'),
    life:  section(CH, 'Why a session assignment is a hypothesis, and where the memory is released', 'Chapter 4 · the lifecycle'),
    shape: section(CH, 'Why there are three shapes, and why one of them has no answer without a setting', 'Chapter 4 · the three shapes')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'user', 'window', 'session', 'gap'],
      eyebrow: '01 · Chapter 4 · Part 3',
      heading: 'A report that turns out to be about something that no longer exists',
      hero: { step: 0, text: 'A website records clicks. Each click is an <b>event</b> carrying a small number <code>v</code>; two visitors, <b>users</b> <code>a</code> and <code>b</code>, make 9 of them. Reports add the numbers per <b>window</b>, a stretch of time. A <b>session</b> is a window that follows the person: a burst of clicks ended by a silence longer than the <b>gap</b>.[[src:shape]]' },
      tiles: [
        { step: 1, value: 40, label: 'seconds: the gap in this part’s main example[[src:why]]' },
        { step: 1, value: 7, label: 'the total first reported for one session[[src:why]]' },
        { step: 2, value: 11, label: 'that session’s true total[[src:why]]' },
        { step: 2, value: 18, label: 'what a careless reader adds up to[[src:why]]' }
      ],
      cardsLabel: 'Three pitfalls this part walks into',
      cards: [
        { step: 3, n: 1, title: 'A late click changes a reported session', text: 'The old report must be withdrawn.' },
        { step: 3, n: 2, title: 'Quiet does not mean finished', text: 'Looking idle proves nothing about what is still on its way.' },
        { step: 4, n: 3, title: 'One user’s silence is not another’s', text: 'Sessions must be kept per user.' }
      ],
      note: { step: 4, text: 'You will be asked before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website records clicks. Each click is an event with a small number attached, and two users, a and b, make 9 of them. A session is a window that follows the person: a burst of clicks ended by a long enough silence, the gap.',
        'This part uses a gap of 40 seconds. With it, one of user b’s sessions is reported with a total of 7.',
        'But its true total is 11, and a reader who is careless with the correction ends up with 18. We will see exactly how.',
        'Three pitfalls. A late click can change a session that was already reported. And a session that looks quiet is not necessarily finished.',
        'And one user’s silence must never be filled by another user’s clicks. You will be asked before each explanation.'
      ]
    },

    /* ---------- 2 · data ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'key', 'watermark'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'In the order the system received them. The last column is the watermark after each arrival.',
      table: {
        columns: ['Arrival', 'Event', 'User', 'Happened at', 'Seen at', 'v', 'Watermark'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`${i}`, `id ${e.id}`, e.key, i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), clock(e.pt), `${e.v}`,
            seed.WATERMARKS[i] < 0 ? 'before noon' : clock(seed.WATERMARKS[i])] }))
      },
      side: { step: 2, title: 'Words used from now on', html: '<ul class="l"><li><b>Event time</b>: when the click happened. <b>Processing time</b>: when the system received it.</li><li>The user is the event’s <b>key</b>; sessions are kept per key.</li><li>The <b>watermark</b>: latest event time seen, minus 60 seconds — the system’s estimate that nothing older is still coming.[[src:life]]</li></ul>' },
      narration: [
        'Here are the first five events, numbered by arrival, each with two times: when it happened and when the system saw it. The last column is something the system computes.',
        'Look at arrival 7: id 7 from user b happened at 12:00:50 but arrived at 12:04:40. By then the system believed it had seen everything up to 12:03:20.',
        'When it happened is the event time; when it was seen is the processing time. The user is the key. And the watermark is the latest event time seen, minus 60 seconds: the system’s guess that nothing older is still coming.'
      ]
    },

    /* ---------- 3 · the retraction ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['pane', 'retraction'],
      eyebrow: '03 · Your turn · pitfall 1',
      heading: 'A session was reported. Then its missing click arrived.',
      stand: 'Gap 40 seconds. At arrival 4 the watermark passes 12:01:30 plus 40 seconds, so user b’s session [12:01:30] — just id 2, total 7 — is reported. At arrival 7, id 7 (12:00:50, v 4) arrives: 40 seconds before id 2.',
      question: {
        step: 0,
        prompt: 'The session is now 12:00:50 to 12:01:30 with total 11. What must the system send the reader?',
        options: [
          { text: 'Withdraw the 7 for the old session, then send 11 for the new one.', correct: true,
            why: 'The old report describes a session that no longer exists. It has to be taken back, and the new one sent.' },
          { text: 'Just send 11 for the new session; the reader will work it out.', correct: false,
            why: 'A reader adding up reports then has both: 7 plus 11. Nothing tells it the 7 is gone.' },
          { text: 'Just send the 4 that id 7 adds, as an extra report.', correct: false,
            why: 'That fixes the total but not the session: its start moved, so the reader still holds a session that never existed.' }
        ]
      },
      cards: [
        { step: 1, title: 'Pane and retraction', html: '<p>Each report of a window’s total is a <b>pane</b>. A message withdrawing a pane already sent is a <b>retraction</b>. The pipeline must retract 7 and emit 11.[[src:why]]</p>' },
        { step: 2, title: 'Not stale: gone', html: '<p>A fixed window’s old pane is only out of date. This old pane describes a window with different bounds, which no longer exists.[[src:why]]</p>' }
      ],
      narration: [
        'Pitfall one. With a 40-second gap, user b’s session holding only id 2 is reported at arrival 4, total 7. Then id 7 arrives and joins it. What must the reader be sent? Choose an answer.',
        'Withdraw the 7, then send 11. Each report of a window’s total is called a pane, and a message that withdraws a pane already sent is called a retraction.',
        'For a fixed window, an old pane is just out of date. Here the old pane describes a session with different bounds, a session that no longer exists. Watch the messages.'
      ]
    },

    /* ---------- 4 · the messages ---------- */
    {
      title: 'Panes', layout: 'sequence',
      eyebrow: '04 · Watch the three messages reach the reader',
      heading: 'One pane, one retraction, one corrected pane',
      stand: 'Top to bottom in time order. The reader is an analytics store that keeps one line per session.',
      sequence: {
        actors: [
          { name: 'Clicks', sub: 'user b, gap 40 s' },
          { name: 'Pipeline', sub: 'keeps the sessions', src: 'flow' },
          { name: 'Store', sub: 'one line per session', highlight: true, src: 'prog' }
        ],
        messages: [
          { from: 'Clicks', to: 'Pipeline', label: 'arrival 2: id 2 at 12:01:30, v 7', step: 0 },
          { from: 'Pipeline', to: 'Store', label: 'pane: session [12:01:30] = 7', step: 0 },
          { from: 'Clicks', to: 'Pipeline', label: 'arrival 7: id 7 at 12:00:50, v 4', step: 1 },
          { from: 'Pipeline', to: 'Store', label: 'retract: session [12:01:30] = 7', step: 2, src: 'why' },
          { from: 'Pipeline', to: 'Store', label: 'pane: session [12:00:50–12:01:30] = 11', step: 2 }
        ]
      },
      notes: [
        { step: 3, html: '<b>Old bounds, new bounds.</b> The retraction names the session as it was; the new pane names it as it is.[[src:prog]]' },
        { step: 3, html: '<b>Right total:</b> 11, one session. All three messages were correct.[[src:prog]]' },
        { step: 3, html: '<b>Different from a fixed window,</b> whose correction would name the same window twice.[[src:prog]]' }
      ],
      narration: [
        'Here are the messages, top to bottom in time order. Id 2 arrives, and at arrival 4 the pipeline reports user b’s session at 12:01:30 with total 7.',
        'Then, at arrival 7, id 7 arrives. It happened at 12:00:50, 40 seconds before id 2, so it belongs to that same session.',
        'So the pipeline sends two messages: a retraction of the 7, naming the session by its old bounds, and a new pane of 11 for the session as it now is.',
        'Notice the two messages name two different sessions. The retraction says what was; the new pane says what is. Every message here is correct.'
      ]
    },

    /* ---------- 5 · the reader that ignores it ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '05 · Your turn',
      heading: 'A reader that throws retractions away',
      stand: 'The store adds up every pane it keeps. This one ignores retractions.',
      question: {
        step: 0,
        prompt: 'After the three messages, what total does this store hold for user b’s first session?',
        options: [
          { text: '18: it kept both the 7 and the 11.', correct: true,
            why: 'Without the retraction, the old pane stays. 7 plus 11 is 18, for a session worth 11.' },
          { text: '11: the newest pane replaces the oldest.', correct: false,
            why: 'They name different sessions, with different starts, so the new pane does not land on the old line.' },
          { text: '7: it never saw the late click.', correct: false,
            why: 'It did receive the 11. It only threw away the message that withdrew the 7.' }
        ]
      },
      cards: [
        { step: 1, title: 'Wrong by exactly the old value', html: '<p>18 against 11: 64% over, and the error is exactly the retracted 7. No error message anywhere: just a line for a session that never existed.[[src:prog]]</p>' }
      ],
      narration: [
        'Second question. This store adds up every pane it keeps, but it ignores retractions. What total does it hold for user b’s first session? Choose an answer.',
        '18. It kept both the 7 and the 11, for a session worth 11: 64 percent over, and wrong by exactly the retracted value. Nothing reported an error.'
      ]
    },

    /* ---------- 6 · delete and insert ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['row'],
      eyebrow: '06 · Your turn',
      heading: 'Why can’t the store simply update the line?',
      stand: 'The store keeps one line, or row, per session, and finds each row by (user, session start). The old row is (b, 12:01:30).',
      question: {
        step: 0,
        prompt: 'The session now starts at 12:00:50. What must the store do to its rows?',
        options: [
          { text: 'Delete the row (b, 12:01:30) and insert a row (b, 12:00:50).', correct: true,
            why: 'The start is part of how a row is found. A new start means a different row, so the old one must go.' },
          { text: 'Update the total in row (b, 12:01:30) from 7 to 11.', correct: false,
            why: 'Then the store says the session starts at 12:01:30, which is no longer true.' },
          { text: 'Nothing: the start of a session can never change.', correct: false,
            why: 'It just did. A late click before a session’s start moves the start earlier.' }
        ]
      },
      cards: [
        { step: 1, title: 'The bounds are the identity', html: '<p>A fixed window’s correction updates a <b>row</b>. A session’s correction deletes one row and inserts another, because its start is part of its name.[[src:when]]</p>' },
        { step: 2, title: 'So check the store first', html: '<p>A store that can only add rows, never delete them, cannot hold session windows correctly. Better to learn that here than in production.[[src:when]]</p>' }
      ],
      narration: [
        'Third question. The store keeps one line, called a row, per session, and finds it by user and session start. The session now starts at 12:00:50. What must the store do? Choose an answer.',
        'Delete the old row and insert a new one. For a session, the start is part of its name, so a new start means a different row. A fixed window’s correction would just update a row.',
        'So before choosing session windows, check the store. A store that can only add rows, never delete them, cannot hold sessions correctly.'
      ]
    },

    /* ---------- 7 · quiet is not finished ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['garbage-collect'],
      eyebrow: '07 · Your turn · pitfall 2',
      heading: 'A session that looks finished, and one that never is',
      stand: 'Back to the 120-second gap. User a’s last click happened at 12:09:00. The stream ends with the watermark at 12:08:00.',
      question: {
        step: 0,
        prompt: 'When can the system free the memory of user a’s session at 12:09:00?',
        options: [
          { text: 'Never in this stream: the watermark must pass 12:11:00.', correct: true,
            why: 'Its end plus the gap is 12:11:00, and the watermark stops at 12:08:00. Nothing else can rule out a late click.' },
          { text: 'After 120 seconds of real time with no click from a.', correct: false,
            why: 'Quiet on the wall clock proves nothing. A click from 12:10:00 could still be on its way.' },
          { text: 'Straight away: the stream has ended.', correct: false,
            why: 'The system never knows a stream has ended. More clicks can always arrive.' }
        ]
      },
      cards: [
        { step: 1, title: 'Collected by the watermark', html: '<p>Freeing a window’s memory is to <b>garbage-collect</b> it. For a session that happens when the watermark passes its end plus the gap, not when it looks idle.[[src:why]]</p>' },
        { step: 2, title: 'A permanent allocation', html: '<p>This session is never collected, so its state is held for the life of the job. A quiet user is memory that is never returned.[[src:why]]</p>' }
      ],
      narration: [
        'Pitfall two, back at the 120-second gap. User a’s last click was at 12:09:00, and the watermark ends at 12:08:00. When can that session’s memory be freed? Choose an answer.',
        'Never, in this stream. Freeing a window’s memory is called garbage-collecting it, and a session is collected only when the watermark passes its end plus the gap: 12:11:00.',
        'Looking idle is not the same as being done. This session is never collected, so its memory is held for as long as the job runs. A quiet user is memory never given back.'
      ]
    },

    /* ---------- 8 · the near miss ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '08 · Your turn · pitfall 3',
      heading: 'A click lands in someone else’s silence',
      stand: 'User b went quiet at 12:01:30 and came back at 12:03:40: 130 seconds, longer than the 120-second gap. Id 3 happened at 12:02:10, only 40 seconds after b went quiet — but it is user a’s click.',
      question: {
        step: 0,
        prompt: 'Does id 3 join user b’s session that ended at 12:01:30?',
        options: [
          { text: 'No: the gap is measured only between one user’s own clicks.', correct: true,
            why: 'Sessions are kept per key. User a’s click says nothing about whether user b was still there.' },
          { text: 'Yes: 40 seconds is well within the 120-second gap.', correct: false,
            why: 'Within the gap, but of the wrong person. A visit is one person’s, so another person cannot extend it.' },
          { text: 'Yes, and it also joins b’s session at 12:03:40.', correct: false,
            why: 'That would weld b’s two visits together with a click b never made.' }
        ]
      },
      cards: [
        { step: 1, title: 'A correctness rule', html: '<p>“Sessions are per key” is not a detail of how it is built: it decides whether the answer is right. One user’s activity must never fill another’s silence.[[src:why]]</p>' }
      ],
      narration: [
        'Pitfall three. User b was quiet for 130 seconds, longer than the gap. Id 3 happened 40 seconds into that silence, but it is user a’s click. Does it join user b’s session? Choose an answer.',
        'No. The gap is measured only between one user’s own clicks; sessions are kept per key. Next, watch what happens when that rule is dropped.'
      ]
    },

    /* ---------- 9 · drop the key, animated ---------- */
    {
      title: 'Nokey', layout: 'array',
      eyebrow: '09 · Watch what happens without the per-user rule',
      heading: 'Drop the key, and 5 sessions become 2',
      stand: 'All 9 clicks in event-time order, as if from one person. A silence longer than 120 seconds starts a new session.',
      array: {
        labelWidth: 170, slotLabel: 'click',
        rows: [
          { label: 'happened', values: SORTED.map(e => clock(e.et)) },
          { label: 'user', values: SORTED.map(e => e.key) },
          { label: 'silence before (s)', values: QUIET.map(q => (q === null ? '—' : q > seed.GAP ? 'over 120' : q)) },
          { label: 'new session?', values: NEW }
        ],
        meters: ['clicks checked', 'sessions'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 2, do: 'pick', slots: [4] }
        ]
      },
      cards: [
        { step: 1, title: '2, not 5', html: '<p>With the users kept apart there are 5 sessions. Mixed together, every silence is short, and only the click at 12:09:00 starts a new one.[[src:why]]</p>' },
        { step: 2, title: 'One fictional visit', html: '<p>User a’s click at 12:02:10 sits in user b’s silence and stitches it closed. The result is a visit nobody made.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are all 9 clicks in event-time order, as if one person made them, with the user underneath and the silence before each click.',
        'Watch the check. Every silence is now short, because the two users fill each other’s gaps. Only the click at 12:09:00 starts a new session: 2 sessions instead of 5.',
        'Look at the highlighted click: user a at 12:02:10, sitting in user b’s silence. Without the per-user rule it stitches b’s two visits together, into one fictional visit.'
      ]
    },

    /* ---------- 10 · choose with the store in mind ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '10 · Your turn',
      heading: 'A team picks a smaller gap to get cleaner visits',
      stand: 'Their analytics store is append-only: it can add rows but never delete them. They change the gap from 120 seconds to 40.',
      question: {
        step: 0,
        prompt: 'What does the smaller gap do to them, on this data?',
        options: [
          { text: 'It forces a retraction, which their store cannot accept.', correct: true,
            why: 'A smaller gap closes sessions sooner, so id 7 arrives after its session was reported. That needs a delete.' },
          { text: 'Nothing: the gap only changes how many sessions there are.', correct: false,
            why: 'It also changes when sessions are closed. At 40 seconds one closes before its last click arrives.' },
          { text: 'It removes all retractions, because sessions are shorter.', correct: false,
            why: 'The opposite. Shorter sessions are closed earlier, and earlier closing is what creates the retraction.' }
        ]
      },
      cards: [
        { step: 1, title: 'A function of the gap', html: '<p>Retraction is unavoidable once a session can be collected before its last member arrives. A smaller gap means earlier collection, so tightening it silently demands a store that accepts deletions.[[src:when]]</p>' }
      ],
      narration: [
        'A team with an append-only store, one that can never delete a row, shrinks the gap from 120 seconds to 40 to get cleaner visits. What does that do to them? Choose an answer.',
        'It forces a retraction their store cannot accept. A smaller gap closes sessions sooner, so a late click can arrive after its session was reported. The setting reached into the store.'
      ]
    },

    /* ---------- 11 · the bridge ---------- */
    {
      title: 'Join', layout: 'table', defines: ['bridge'],
      eyebrow: '11 · The case this stream does not show — previewed',
      heading: 'A late click between two reported sessions',
      stand: 'In this per-user stream, the late click only extends a session. Drop the users and use a 47-second gap, and the same times show the harder case.',
      table: {
        columns: ['Before the click at 12:00:50', 'The click', 'After'],
        rows: [
          { step: 0, cells: ['12:00:01–12:00:03, total 8 (reported)', '', ''] },
          { step: 0, cells: ['12:01:30–12:02:10, total 9 (reported)', '', ''] },
          { step: 1, cells: ['', '12:00:50, v 4: 47 s after the first, 40 s before the second', ''] },
          { step: 2, cells: ['retract 8, retract 9', '', '12:00:01–12:02:10, total 21[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Twice the bookkeeping', html: '<p>A click that lands in the gap between two sessions joins both: it <b>bridges</b> them. Two panes are retracted and one emitted. Same mechanism, done twice.[[src:when]]</p><p>Part 4 builds exactly this as a program.</p>' },
      narration: [
        'In this per-user stream the late click only extends one session. Drop the users and use a 47-second gap, and two sessions are reported: totals 8 and 9.',
        'Then the click at 12:00:50 arrives, carrying 4. It is 47 seconds after the first session and 40 seconds before the second: close enough to both.',
        'So both sessions become one, from 12:00:01 to 12:02:10, total 21, and the two earlier panes, 8 and 9, are both retracted.',
        'A click that joins two sessions like this is said to bridge them. It is the same retraction, done twice. Part 4 builds it as a program.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'One question about users',
      stand: 'Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'User A’s session and user B’s session are 10 seconds apart. Do they merge into one?',
        options: [
          { text: 'Never: the gap is measured within one user.', correct: true,
            why: 'Sessions are kept per key, so two users’ sessions are never compared at all.' },
          { text: 'Yes, if 10 seconds is within the gap.', correct: false,
            why: 'Within the gap only matters between one user’s own clicks. Mixing users made 5 sessions into 2.' },
          { text: 'Only if neither has been reported yet.', correct: false,
            why: 'Reporting has nothing to do with it. Different users are never in the same session.' }
        ]
      },
      narration: [
        'One last question. User A’s session and user B’s session are only 10 seconds apart. Do they merge? Choose an answer.',
        'Never. The gap is measured within one user, so two users’ sessions are never even compared. Mixing them turned 5 real sessions into 2 fictional ones.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'Retract by the old bounds, collect by the watermark, keep users apart',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Pitfall', 'What to do'],
        rows: [
          { step: 0, cells: ['<b>A late click changes a reported session</b>', 'Retract the old pane, emit the new: 7 out, 11 in. Ignore the retraction and the store reads 18.[[src:why]]'] },
          { step: 0, cells: ['<b>The start moved</b>', 'Delete one row and insert another; the store must accept deletions.[[src:when]]'] },
          { step: 1, cells: ['<b>Quiet is not finished</b>', 'Collect when the watermark passes end plus gap. One session here is never collected.[[src:why]]'] },
          { step: 1, cells: ['<b>Users fill each other’s silences</b>', 'Keep sessions per user: 5 real sessions, not 2 fictional ones.[[src:why]]'] },
          { step: 2, cells: ['<b>The gap reaches the store</b>', 'A smaller gap closes sessions sooner, and that is what forces retractions.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>A door log, times arriving out of order, and one late time that joins two visits. Part 4 writes that program with you, one piece at a time.</p>' },
      narration: [
        'To recap. When a late click changes a reported session, retract the old pane and emit the new: 7 out, 11 in. A store that ignores the retraction reads 18.',
        'Because the start moved, that correction deletes one row and inserts another. And a session is finished only when the watermark passes its end plus the gap, not when it looks quiet.',
        'Keep sessions per user, or 5 real sessions become 2 fictional ones. And remember that a smaller gap closes sessions sooner, which is exactly what forces retractions.',
        'Next, part 4 writes a program with you: a door log whose times arrive out of order, and one late time that joins two visits.'
      ]
    }
  ]
};
