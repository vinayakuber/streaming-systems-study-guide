// Chapter 4, Part 9 — the chapter's two "Interview Questions", each told as a story and probed
// from several sides, with its code snippet built line by line (the lines come from the
// chapter source through _prog.js's snippet(), never retyped); then the five-question chapter
// quiz and a recap of the whole chapter. Every value is computed from tools/stream_seed.js.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch04';
const Q1 = snippet(CH, 0), Q2 = snippet(CH, 1);
const span = (S, a, b) => [S.at(a), S.at(b)];
const Q1_RUNS = span(Q1, 'seed times as one user', 's1 [12:00:01,12:00:03] sum 8');
const Q1_LATE = [Q1.at('late event @ 12:00:50'), Q1.at('late event @ 12:00:50')];
const Q1_FIX = span(Q1, 'retract s1 (8), retract s2 (9)', 'emit sMerged');
const Q2_WHO = span(Q2, 'at seed scale', 'sliding : id 4 @ 12:04:05');
const Q2_SUM = [Q2.at('4 fixed sums total 45'), Q2.at('4 fixed sums total 45')];

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const runs = (events, gap) => {
  const out = [];
  for (const e of events.slice().sort((x, y) => x.et - y.et)) {
    const last = out[out.length - 1];
    if (last && e.et - last.end <= gap) { last.end = e.et; last.sum += e.v; } else out.push({ start: e.et, end: e.et, sum: e.v });
  }
  return out;
};
const ID7 = E.findIndex(e => e.id === 7);
const B47 = runs(E.slice(0, ID7), 47), B120 = runs(E.slice(0, ID7), 120);
const SLIDING = E.reduce((a, e) => a + e.v * [Math.floor(e.et / 60) * 60, Math.floor(e.et / 60) * 60 - 60].filter(w => w >= 0 && e.et < w + 120).length, 0);
const TOTAL = E.reduce((a, e) => a + e.v, 0);
if (B47.length !== 3 || B47[0].sum !== 8 || B47[1].sum !== 9 || B47[1].start - B47[0].end !== 87 || E[ID7].et !== 50
  || B120.length !== 1 || B120[0].start !== 1 || B120[0].end !== 260 || TOTAL !== 45 || SLIDING !== 78 || E[4].et !== 245)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Sessions Interview Drill',
  eyebrow: 'Streaming · Ch 4 · Part 9',
  ...shared,
  jargon: ['event', 'user', 'session', 'gap', 'event time', 'processing time', 'key', 'merge', 'bridge', 'pane',
    'retraction', 'window', 'fixed window', 'sliding window', 'watermark'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    q1:    section(CH, 'Q1', 'Chapter 4 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 4 · interview question 2'),
    quiz:  section(CH, 'Quiz', 'Chapter 4 · quiz'),
    kc:    section(CH, 'Key Concepts', 'Chapter 4 · key concepts'),
    shape: section(CH, 'Why there are three shapes, and why one of them has no answer without a setting', 'Chapter 4 · the three shapes'),
    sem:   section(CH, 'Why a session is the one window whose published result can stop existing', 'Chapter 4 · a result that stops existing'),
    sd:    section(CH, 'System Design Interview', 'Chapter 4 · system design interview')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'user', 'session', 'gap', 'window', 'merge'],
      eyebrow: '01 · Chapter 4 · Part 9 · the interview questions',
      heading: 'Two interview questions about counting user activity, asked from every side',
      hero: { step: 0, text: 'A website records every click: an <b>event</b>. Analysts ask how many visits each <b>user</b> made. A visit is a <b>session</b>: a burst of clicks ended by a silence longer than a set length, the <b>gap</b>. Reports count clicks per <b>window</b>, a stretch of time; when a late click joins two sessions into one, they <b>merge</b>.[[src:q1]]' },
      tiles: [
        { step: 1, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 1, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: 9, label: 'clicks in the example' },
        { step: 2, value: 47, label: 'seconds: the gap in question 1’s snippet[[src:q1]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'The report', text: '“Sessions per user”: a 20-minute pause counts as two sessions, a 10-minute pause as one.' },
        { step: 3, n: 2, title: 'The trouble', text: 'Late clicks can merge sessions that were already reported.' },
        { step: 4, n: 3, title: 'The ask', text: 'Model sessions as windows, and say what happens on such a late merge.' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle.[[src:q1]]' },
      narration: [
        'A website records every click, an event. Analysts ask how many visits each user made. A visit is a session: a burst of clicks ended by a silence longer than a set length, called the gap.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then the 5 questions of the chapter quiz.',
        'The example is the same 9 clicks used throughout the chapter, and question 1’s snippet uses a gap of 47 seconds.',
        'Question 1. A sessions-per-user report counts a 20-minute pause as two sessions and a 10-minute pause as one. And late clicks can merge sessions already reported.',
        'The interviewer asks: how do you model sessions as windows, and what happens when a late click merges two sessions already reported? You answer first, every time.'
      ]
    },

    /* ---------- 2 · Q1: what decides a session ---------- */
    {
      title: 'Gap', layout: 'ask', defines: ['window'],
      eyebrow: '02 · Interview question 1 · what the report is really doing',
      heading: 'Why is 20 minutes two sessions and 10 minutes one?',
      stand: 'A report puts clicks into windows — stretches of time whose clicks are counted together. Here the windows follow the person, not the clock.',
      question: {
        step: 0,
        prompt: 'What makes a 20-minute pause end a session while a 10-minute pause does not?',
        options: [
          { text: 'A gap setting between 10 and 20 minutes: longer silences end a session.', correct: true,
            why: 'A session window is defined by a gap of inactivity. Whatever the gap is, it lies between those two pauses.' },
          { text: 'The clock: sessions are cut every 15 minutes.', correct: false,
            why: 'Clock-cut windows would split a single long visit and ignore the pauses entirely.' },
          { text: 'Nothing: it is a bug, both pauses should be one session.', correct: false,
            why: 'Some pause must end a visit, or a user has one session forever. Where that line falls is a choice.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A session window', html: '<p>A <b>window</b> groups clicks to be counted together. A session window’s edges come from the data: a silence longer than the gap ends it.[[src:q1]]</p>' },
        { step: 2, title: 'The gap is the definition', html: '<p>On the chapter’s data, user a has 4, 3, 2 or 1 sessions at gaps of 40, 120, 130 and 300 seconds. Every answer is right for its gap.[[src:shape]]</p>' }
      ],
      narration: [
        'First angle: what is the report really doing? A 20-minute pause ends a session, but a 10-minute one does not. What makes the difference? Choose an answer.',
        'A gap setting between 10 and 20 minutes. A window groups clicks to be counted together, and a session window ends when a silence is longer than the gap.',
        'And the gap is a definition, not a fact. On the chapter’s data, one user has 4, 3, 2 or 1 sessions depending on it, and every one of those answers is right.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'key', 'watermark'],
      eyebrow: '03 · Interview question 1 · the clicks behind the snippet',
      heading: 'When it happened, and when the system saw it',
      stand: 'The snippet treats all 9 clicks as one user’s. In arrival order:',
      table: {
        columns: ['Arrival', 'Click', 'Happened at', 'Seen at', 'v'],
        rows: E.map((e, i) => ({ step: i < 6 ? 0 : 1, cells: [`${i}`, `id ${e.id}`, i === ID7 ? `<b>${clock(e.et)}</b>` : clock(e.et), clock(e.pt), `${e.v}`] }))
      },
      side: { step: 2, title: 'Words used from now on', html: '<ul class="l"><li><b>Event time</b>: when the click happened. <b>Processing time</b>: when it was seen.</li><li>The <b>key</b>: what sessions are kept per, normally the user.</li><li>The <b>watermark</b>: latest event time seen, minus 60 seconds — the system’s judgement that nothing older is still coming.[[src:sd]]</li></ul>' },
      narration: [
        'Here are the clicks behind question 1’s snippet, in the order the system saw them, all treated as one user’s. Each has two times: when it happened, and when it was seen.',
        'Look at id 7: it happened at 12:00:50 but was seen at 12:04:40, after clicks that happened later. It is the late click that does the merging.',
        'So: event time is when it happened, processing time when it was seen. The key is what sessions are kept per. The watermark is the latest event time seen minus 60 seconds.'
      ]
    },

    /* ---------- 4 · snippet lines 1-2 ---------- */
    {
      title: 'Two', layout: 'code',
      eyebrow: '04 · Interview question 1 · the snippet, lines 1 and 2',
      heading: 'Before the late click: two sessions',
      stand: 'Before id 7 arrives, the earliest clicks are 12:00:01 and 12:00:03, then 12:01:30 and 12:02:10. The gap is 47 seconds.',
      question: { step: 0, prompt: '12:00:03 and 12:01:30 are 87 seconds apart. With a 47-second gap, how many sessions do these four clicks make?', options: [
        { text: 'Two: the 87-second silence is longer than the gap.', correct: true, why: 's1 is 12:00:01 to 12:00:03 and s2 is 12:01:30 to 12:02:10: two sessions, each reported in turn.' },
        { text: 'One: they all happened within three minutes.', correct: false, why: 'Sessions are cut by silences, not by a total span. 87 seconds is longer than 47.' },
        { text: 'Four: one per click.', correct: false, why: 'Clicks 2 seconds apart, or 40 apart, are well within the 47-second gap.' } ] },
      code: Q1.build({ add: [Q1_RUNS], step: 1 }),
      cards: [ { step: 2, title: 'Two sessions, reported', html: '<p>s1 [12:00:01, 12:00:03] sums to 8; s2 [12:01:30, 12:02:10] sums to 9. Each is reported once the system judges it finished.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: the structure, built line by line. Before id 7 arrives, 12:00:03 and 12:01:30 are 87 seconds apart. With a 47-second gap, how many sessions? Choose an answer.',
        'Two. Here are the snippet’s first two lines: s1 from 12:00:01 to 12:00:03, total 8, and s2 from 12:01:30 to 12:02:10, total 9, 87 seconds apart.',
        'Each is reported once the system judges it finished. Both reports are correct, for now.'
      ]
    },

    /* ---------- 5 · snippet line 3 ---------- */
    {
      title: 'Late', layout: 'code', defines: ['merge', 'bridge'],
      eyebrow: '05 · Interview question 1 · the snippet, line 3',
      heading: 'A late click lands in the silence',
      stand: 'Id 7 arrives: it happened at 12:00:50, value 4.',
      question: { step: 0, prompt: 'Id 7 is 47 seconds after s1 and 40 seconds before s2. What happens?', options: [
        { text: 'It joins both: s1, id 7 and s2 become one session.', correct: true, why: 'It is within the gap of each side, so the silence that separated them no longer exists.' },
        { text: 'It joins s1 only, because s1 came first.', correct: false, why: 'Then s1 would end at 12:00:50 and s2 start 40 seconds later: within the gap, yet still split.' },
        { text: 'It is dropped, because those sessions were already reported.', correct: false, why: 'Late is not wrong. Dropping it would undercount, and the visit really was one.' } ] },
      code: Q1.build({ before: [Q1_RUNS], add: [Q1_LATE], step: 1 }),
      cards: [ { step: 2, title: 'Merge, and bridge', html: '<p>Collapsing sessions into one is a <b>merge</b>. A click that joins two at once <b>bridges</b> them: 47 s after s1, 40 s before s2.[[src:q1]]</p>' } ],
      narration: [
        'Now id 7 arrives, from 12:00:50, carrying 4. It is 47 seconds after s1 and 40 seconds before s2. What happens? Choose an answer.',
        'It joins both. Here is the third line: within the gap on both sides, so the three become one. Collapsing sessions into one is a merge.',
        'A click that joins two sessions at once is said to bridge them. And both of those sessions were already reported.'
      ]
    },

    /* ---------- 6 · snippet lines 4-5 ---------- */
    {
      title: 'Fix', layout: 'code', defines: ['pane', 'retraction'],
      eyebrow: '06 · Interview question 1 · the snippet, lines 4 and 5',
      heading: 'Withdraw two reports, then send one',
      stand: 'Each report of a session’s total is a pane. Panes 8 and 9 are already downstream.',
      question: { step: 0, prompt: 'What must the pipeline send downstream now?', options: [
        { text: 'Withdraw 8 and 9, then send the merged session: 21.', correct: true, why: 'The two old panes describe sessions that no longer exist. Both are withdrawn; the merged one is sent.' },
        { text: 'Send 21 alongside the 8 and 9.', correct: false, why: 'A reader adding panes would count one visit three times, and its clicks twice.' },
        { text: 'Send only the 4 from id 7.', correct: false, why: 'The total would be right, but the reader would still see two sessions where there is one.' } ] },
      code: Q1.build({ before: [Q1_RUNS, Q1_LATE], add: [Q1_FIX], step: 1 }),
      cards: [ { step: 2, title: 'Retraction', html: '<p>A message withdrawing a pane already sent is a <b>retraction</b>. Retract s1 (8), retract s2 (9), emit [12:00:01, 12:02:10] = 8 + 9 + 4 = <b>21</b>.[[src:q1]]</p>' } ],
      narration: [
        'Each report of a session’s total is a pane, and panes 8 and 9 are already downstream. What must the pipeline send now? Choose an answer.',
        'Withdraw 8 and 9, then send 21. Here are the last two lines. A message that withdraws a pane already sent is called a retraction.',
        'So: retract s1, retract s2, and emit the merged session from 12:00:01 to 12:02:10, totalling 8 plus 9 plus 4, which is 21. That is the chapter’s answer.'
      ]
    },

    /* ---------- 7 · Q1: what breaks ---------- */
    {
      title: 'Skip', layout: 'ask',
      eyebrow: '07 · Interview question 1 · what breaks if you skip a step',
      heading: 'A store that ignores retractions',
      stand: 'In the chapter’s per-user stream at a 40-second gap, a session is reported as 7, then a late click turns it into 11. The store receives: pane 7, retract 7, pane 11.',
      question: {
        step: 0,
        prompt: 'The store throws retractions away. What does it hold for that session?',
        options: [
          { text: '18: the 7 and the 11 both stay.', correct: true,
            why: 'Without the retraction, the old pane is never removed: 7 plus 11 is 18, for a session worth 11.' },
          { text: '11: the newer pane replaces the older.', correct: false,
            why: 'They name different sessions — the start moved — so the new pane lands on a different row.' },
          { text: '7: it never saw the late click.', correct: false,
            why: 'It received the 11. It only dropped the message withdrawing the 7.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Wrong by the old value', html: '<p>18 against 11: 64% over, and no error anywhere. The store holds a row for a session that never existed.[[src:sem]]</p>' },
        { step: 2, title: 'So the store must delete', html: '<p>The bounds are the session’s identity, so a correction deletes one row and inserts another. An append-only store cannot hold sessions.[[src:sem]]</p>' }
      ],
      narration: [
        'Third angle: what breaks if you skip a step? In the per-user stream at a 40-second gap, a session is reported as 7, then becomes 11. The store throws retractions away. What does it hold? Choose an answer.',
        '18. The old pane is never removed, so 7 plus 11 is 18 for a session worth 11: 64 percent over, and no error anywhere.',
        'Because a session’s bounds are its identity, the correction deletes one row and inserts another. A store that can only append cannot hold sessions correctly.'
      ]
    },

    /* ---------- 8 · Q1: other numbers ---------- */
    {
      title: 'Vary', layout: 'ask',
      eyebrow: '08 · Interview question 1 · the same question, another gap',
      heading: 'At the book’s gap of 120 seconds',
      stand: 'Same clicks, one user, but the gap is 120 seconds. Before id 7 arrives, 12:00:03 and 12:01:30 are 87 seconds apart.',
      question: {
        step: 0,
        prompt: 'At a 120-second gap, what does id 7 do when it arrives?',
        options: [
          { text: 'Extends one session: there were never two to bridge.', correct: true,
            why: '87 seconds is within 120, so s1 and s2 were one session all along. Id 7 just lands inside it.' },
          { text: 'Bridges two sessions, exactly as at 47.', correct: false,
            why: 'At 120 the two were already one. The bridge needs a silence longer than the gap, and 87 is not.' },
          { text: 'Starts a session of its own.', correct: false,
            why: 'It is within 120 seconds of its neighbours on both sides.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Why the snippet uses 47', html: '<p>At 120, every click joins at most one run: 0 merges, runs [(1, 260), (540, 540)]. 47 is chosen so the bridge happens.[[src:sd]]</p>' },
        { step: 2, title: 'The gap reaches the store', html: '<p>The same gap that defines a visit decides whether retractions are needed. Pick it as a product decision, then check the store.[[src:sem]]</p>' }
      ],
      narration: [
        'Last angle on question 1: another gap. At the book’s 120 seconds, what does id 7 do when it arrives? Choose an answer.',
        'It extends one session. 87 seconds is within 120, so s1 and s2 were one session all along, from 1 to 260 seconds. That is why the snippet uses 47: so the bridge happens.',
        'And it shows the coupling. The gap that defines a visit also decides whether retractions are needed, and so what the store must be able to do.'
      ]
    },

    /* ---------- 9 · Q2: the story ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['fixed window', 'sliding window'],
      eyebrow: '09 · Interview question 2 · the story',
      heading: 'An hourly total and a rolling 10-minute average',
      stand: 'A dashboard shows both. The team used one window type for both, and the numbers look wrong.',
      question: {
        step: 0,
        prompt: 'Which window shape should each figure use?',
        options: [
          { text: 'Hourly: non-overlapping hours. Rolling: 10-minute windows, one per minute.', correct: true,
            why: 'A total per period needs each event counted once; a rolling figure needs overlapping windows that move.' },
          { text: 'Both: non-overlapping 10-minute windows, added up for the hour.', correct: false,
            why: 'Then the average only changes every 10 minutes, and the hour must be rebuilt from pieces.' },
          { text: 'Both: sessions, since they follow what the users actually do.', correct: false,
            why: 'Neither figure is about visits. Sessions would give boundaries no clock-based question asks for.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Fixed window', html: '<p>Equal, non-overlapping, side by side: each event in exactly one. The hourly total.[[src:q2]]</p>' },
        { step: 2, title: 'Sliding window', html: '<p>Fixed length, overlapping, set by a size and a slide: 10 minutes long, a new one every minute. The rolling average.[[src:q2]]</p>' }
      ],
      narration: [
        'Interview question 2. A dashboard shows an hourly total and a rolling 10-minute average, and the team used one window type for both. Which shape should each use? Choose an answer.',
        'The hourly total uses equal, non-overlapping hours, so each event is counted once. That shape is called a fixed window.',
        'The rolling average uses 10-minute windows, a new one starting every minute, so they overlap and keep moving. That shape is called a sliding window.'
      ]
    },

    /* ---------- 10 · Q2 snippet lines 1-3 ---------- */
    {
      title: 'Where', layout: 'code',
      eyebrow: '10 · Interview question 2 · the snippet, lines 1 to 3',
      heading: 'One click, one fixed window, two sliding windows',
      stand: 'At the chapter’s scale: fixed windows of 120 seconds stand in for the hour; sliding windows of 120 seconds starting every 60 for the rolling one. Id 4 happened at 12:04:05.',
      question: { step: 0, prompt: 'How many sliding windows, 120 seconds long and starting every 60, contain 12:04:05?', options: [
        { text: 'Two: 12:03 to 12:05, and 12:04 to 12:06.', correct: true, why: 'Each window lasts twice the step, so every moment after the first minute is in two of them.' },
        { text: 'One: 12:04 to 12:06.', correct: false, why: 'That is the fixed window. The sliding window that began at 12:03 is still open.' },
        { text: 'Three: 12:02, 12:03 and 12:04.', correct: false, why: 'The window from 12:02 ended at 12:04:00, five seconds before the click.' } ] },
      code: Q2.build({ add: [Q2_WHO], step: 1 }),
      cards: [ { step: 2, title: 'Membership', html: '<p>Fixed: id 4 belongs to 12:04 to 12:06 only. Sliding: to 12:03 to 12:05 <b>and</b> 12:04 to 12:06.[[src:q2]]</p>' } ],
      narration: [
        'Second angle, the snippet. At the chapter’s scale, 120-second windows stand in for the hour. How many sliding windows, starting every 60 seconds, contain 12:04:05? Choose an answer.',
        'Two: 12:03 to 12:05, and 12:04 to 12:06. Here are the first three lines: the scale, then id 4 in one fixed window and in two sliding ones.',
        'The fixed window holds it once. The sliding windows hold it twice, because each one lasts twice as long as the step between them.'
      ]
    },

    /* ---------- 11 · Q2 snippet line 4 ---------- */
    {
      title: 'Sums', layout: 'code',
      eyebrow: '11 · Interview question 2 · the snippet, line 4',
      heading: 'Why the two totals cannot be compared',
      stand: 'All 9 clicks’ values add to 45. The fixed windows’ sums and the sliding windows’ sums are each added up.',
      question: { step: 0, prompt: 'The 4 fixed sums total 45. What do the 7 sliding sums total?', options: [
        { text: '78: most clicks are counted in two windows.', correct: true, why: '6 of the 9 clicks sit in two sliding windows, so their values count twice: 45 plus 33.' },
        { text: '45: the same clicks, so the same total.', correct: false, why: 'Only if each click were counted once. Overlapping windows count most of them twice.' },
        { text: '90: every click is counted exactly twice.', correct: false, why: 'Clicks before 12:01 sit in one window only: there is no window starting before 12:00.' } ] },
      code: Q2.build({ before: [Q2_WHO], add: [Q2_SUM], step: 1 }),
      cards: [ { step: 2, title: 'The overlap is the intent', html: '<p>4 fixed sums total 45, each click once; 7 sliding sums total 78, up to twice. Comparing them is the bug, not the sliding total.[[src:q2]]</p>' } ],
      narration: [
        'All 9 values add to 45, and the 4 fixed windows’ sums total 45. What do the 7 sliding windows’ sums total? Choose an answer.',
        '78. Six of the nine clicks sit in two sliding windows, so their values count twice. Here is the last line: fixed, 45, each click once; sliding, 78, up to twice.',
        'So the overlap is intended. The mistake would be comparing the sliding total with the input, or using the sliding shape for a figure that must add up.'
      ]
    },

    /* ---------- 12 · Q2: what breaks ---------- */
    {
      title: 'Break', layout: 'ask',
      eyebrow: '12 · Interview question 2 · what breaks with one shape',
      heading: 'The team used sliding windows for both',
      stand: 'Hourly totals are built from 60-minute windows that start every minute, and the finance team adds them up for the day.',
      question: {
        step: 0,
        prompt: 'What goes wrong with the day’s total?',
        options: [
          { text: 'It is far too big: each click is counted in many windows.', correct: true,
            why: 'A 60-minute window starting every minute holds each moment 60 times. Totals no longer reconcile.' },
          { text: 'Nothing: overlapping windows still add to the same total.', correct: false,
            why: 'On the chapter’s data, overlap of just 2 turned 45 into 78. More overlap, more inflation.' },
          { text: 'It is too small: the overlap hides some clicks.', correct: false,
            why: 'Overlap never hides a click; it counts the same click again.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Fixed for totals', html: '<p>Equal, non-overlapping: they reconcile against a batch job over the same data.[[src:shape]]</p>' },
        { step: 2, title: 'Sliding for moving figures', html: '<p>Budget for the extra output and state, and never add them up.[[src:shape]]</p>' }
      ],
      narration: [
        'Last angle: what breaks with one shape? The team built hourly totals from 60-minute windows starting every minute, and finance adds them up. What goes wrong? Choose an answer.',
        'The total is far too big: each click is counted in many windows. On the chapter’s data an overlap of just 2 turned 45 into 78.',
        'So fixed windows for anything that must add up, and sliding windows for moving figures, whose totals are never added.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'Defined by the data',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Which window shape is defined by the data rather than the clock?',
        options: [
          { text: 'Fixed.', correct: false, why: 'Fixed windows are equal stretches of clock time, whatever the data does.' },
          { text: 'Sliding.', correct: false, why: 'Sliding windows have a set size and slide on the clock.' },
          { text: 'Session.', correct: true, why: 'Its boundaries follow bursts of activity and gaps of silence.' },
          { text: 'Global.', correct: false, why: 'A single window over everything has no boundaries at all.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Session windows are dynamic: their boundaries follow bursts of activity and gaps.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. Which window shape is defined by the data rather than the clock? Choose an answer.',
        'Session. Its boundaries follow bursts of activity and gaps of silence, so the same clicks give different sessions at different gaps.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'What defines a sliding window?',
      stand: 'Think of 120 seconds starting every 60.',
      question: {
        step: 0,
        prompt: 'What defines a sliding window?',
        options: [
          { text: 'A gap of inactivity.', correct: false, why: 'That defines a session.' },
          { text: 'A window size and a slide.', correct: true, why: 'How long each window is, and how often a new one starts.' },
          { text: 'A single fixed span.', correct: false, why: 'One span, side by side with the next, is a fixed window.' },
          { text: 'A key.', correct: false, why: 'Keys group events by user. They do not shape windows.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Sliding windows are fixed-length, overlapping spans defined by size and slide.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. What defines a sliding window? Choose an answer.',
        'A window size and a slide: how long each window is, and how often a new one starts. 120 seconds starting every 60 is the chapter’s example.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'When do two sessions merge?',
      stand: 'Remember id 7 at 12:00:50.',
      question: {
        step: 0,
        prompt: 'When does a session window merge with another?',
        options: [
          { text: 'When the watermark passes.', correct: false, why: 'The watermark decides when a session is finished and freed, not when two join.' },
          { text: 'When an event lands inside the gap of both.', correct: true, why: 'Like id 7: 47 seconds after one and 40 before the other, within the gap of each.' },
          { text: 'When they share a key.', correct: false, why: 'Sharing a key is necessary, but two sessions of one user stay apart unless something bridges them.' },
          { text: 'When allowed lateness expires.', correct: false, why: 'That ends the chance to revise a session. It never joins two.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A bridging event inside the gap of two sessions merges them into one.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. When does a session window merge with another? Choose an answer.',
        'When an event lands inside the gap of both, as id 7 did: 47 seconds after one session and 40 before the other. That bridging event joins them into one.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'Why retract?',
      stand: 'Remember 8, 9 and 21.',
      question: {
        step: 0,
        prompt: 'Why do late session merges need retractions?',
        options: [
          { text: 'To save memory.', correct: false, why: 'Retractions are messages downstream. Freeing memory is collection’s job.' },
          { text: 'To cancel already-emitted panes and avoid double-counting.', correct: true, why: 'The earlier panes describe sessions that no longer exist. Withdrawing them keeps totals right.' },
          { text: 'To speed up the pipeline.', correct: false, why: 'They add messages and work. They are about correctness.' },
          { text: 'To reduce latency.', correct: false, why: 'They do not make anything sooner; they fix what was already sent.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Earlier panes are now wrong, so they must be retracted before the merged pane is emitted.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. Why do late session merges need retractions? Choose an answer.',
        'To cancel panes already emitted and avoid double-counting. Panes 8 and 9 described sessions that no longer existed; withdrawing them, then sending 21, keeps the totals right.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'Measured within what?',
      stand: 'Remember user a’s click landing in user b’s silence.',
      question: {
        step: 0,
        prompt: 'Session windows are measured within a what?',
        options: [
          { text: 'A partition.', correct: false, why: 'How data is split across machines does not decide whose silence it is.' },
          { text: 'A key group.', correct: true, why: 'One user’s session never merges with another’s: the gap is measured within a key.' },
          { text: 'The global stream.', correct: false, why: 'Measured across everyone, one user’s clicks fill another’s silences: 5 sessions became 2.' },
          { text: 'A time zone.', correct: false, why: 'Event times are compared directly. Time zones play no part in the gap.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Sessions are per key — one user’s session never merges with another’s.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. Session windows are measured within a what? Choose an answer.',
        'A key group. One user’s session never merges with another’s, because the gap is measured within a key. Mixing users turned 5 real sessions into 2 fictional ones.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 4, and its two interview questions',
      heading: 'Three shapes, one lifecycle, and the window that can change its mind',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Three shapes</b>', 'Fixed for totals (45), sliding for moving figures (78), sessions for behaviour.[[src:kc]]'] },
          { step: 0, cells: ['<b>The gap</b>', 'A definition, not a fact: 4, 3, 2 or 1 sessions for the same clicks.[[src:shape]]'] },
          { step: 1, cells: ['<b>Question 1 · late merges</b>', 'A bridging click joins two reported sessions: retract 8 and 9, emit 21.[[src:q1]]'] },
          { step: 1, cells: ['<b>The store</b>', 'Must delete a row and insert another; ignore retractions and 11 reads as 18.[[src:sem]]'] },
          { step: 2, cells: ['<b>Question 2 · shapes</b>', 'Hourly total fixed, rolling average sliding; never add sliding sums.[[src:q2]]'] },
          { step: 2, cells: ['<b>Per key</b>', 'One user’s silence is never filled by another’s clicks.[[src:kc]]'] }
        ]
      },
      side: { step: 3, title: 'Next · chapter 5', html: '<p>Retractions, re-emitted panes and late merges all assume each event is counted exactly once, even when machines fail. Chapter 5 asks how a pipeline can promise that.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. Three shapes: fixed windows for totals, sliding windows for moving figures, sessions for behaviour. And the gap is a definition, not a fact.',
        'Question 1: a late click can bridge two reported sessions, so the pipeline retracts 8 and 9 and emits 21, and the store must be able to delete, or 11 reads as 18.',
        'Question 2: the hourly total is a fixed window and the rolling average a sliding one, whose sums are never added up. And sessions are always kept per key.',
        'Next, chapter 5. All of this assumes each event is counted exactly once, even when machines fail. Chapter 5 asks how a pipeline can promise that.'
      ]
    }
  ]
};
