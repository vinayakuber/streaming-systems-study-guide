// Chapter 1, Part 1 — "What streaming is — terminology", for a viewer who has read nothing
// before it. The click story, the nine events and both clocks are introduced from zero; the
// viewer is asked before being told; and the two per-minute counts are animated, not described.
// Every event comes from the one seed (tools/stream_seed.js), so no figure can drift from the
// chapter's own numbers.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const E = seed.EVENTS;                                     // in the order the pipeline saw them
const clock = s => seed.hhmmss(s);
const SKEW = E.map(e => e.pt - e.et);
const byMinute = key => { const m = {}; for (const e of E) { const k = Math.floor(e[key] / 60) * 60; m[k] = (m[k] || 0) + e.v; } return m; };
const BY_ET = byMinute('et'), BY_PT = byMinute('pt');
const MINUTES = [...new Set([...Object.keys(BY_ET), ...Object.keys(BY_PT)].map(Number))].sort((a, b) => a - b);
const ET_ROW = MINUTES.map(m => BY_ET[m] || 0), PT_ROW = MINUTES.map(m => BY_PT[m] || 0);
const DIFF = MINUTES.map((m, j) => (ET_ROW[j] !== PT_ROW[j] ? 'differs' : 'same'));
const TOTAL = E.reduce((a, e) => a + e.v, 0);

if (E.length !== 9 || SKEW[7] !== 230 || E[7].et !== 50 || E[7].pt !== 280 || E[7].v !== 4 || BY_ET[0] !== 12 || BY_PT[0] !== 8
  || MINUTES.length !== 6 || DIFF.filter(d => d === 'differs').length !== 3 || BY_PT[240] !== 20 || BY_ET[240] !== 7 || TOTAL !== 45
  || Math.max(...SKEW.filter((_, i) => i !== 7)) !== 50)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Two Clocks, One Word',
  eyebrow: 'Streaming · Ch 1 · Part 1',
  ...shared,
  jargon: ['event', 'click', 'pipeline', 'streaming', 'latency', 'bounded', 'unbounded', 'batch', 'engine',
    'event time', 'processing time', 'bucket'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    term:  section(CH, 'What streaming is — terminology', 'Chapter 1 · what streaming is'),
    why:   section(CH, 'Why the word has to be split before anything can be designed', 'Chapter 1 · why the word must be split'),
    when:  section(CH, 'When each meaning of the word is the one you want', 'Chapter 1 · when each meaning is right'),
    walk:  section(CH, 'Visual walkthrough — one word, two clocks, two answers', 'Chapter 1 · one word, two clocks'),
    mem:   section(CH, 'One dataset, two clocks — stack and heap at every step', 'Chapter 1 · one dataset, two clocks'),
    quiz:  section(CH, 'Quiz', 'Chapter 1 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'click', 'pipeline', 'streaming'],
      eyebrow: '01 · Chapter 1 · Part 1',
      heading: 'A website counts clicks. What does it mean to “stream” them?',
      hero: { step: 0, text: 'People click on a website. Each report of clicks is an <b>event</b>: it says which user (<code>a</code> or <code>b</code>) and how many <b>clicks</b>. The events travel to a <b>pipeline</b>: a program that receives them and adds them up, minute by minute. People call that kind of work <b>streaming</b> — a word this part pins down.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example[[src:why]]' },
        { step: 1, value: TOTAL, label: 'clicks in those events[[src:mem]]' },
        { step: 2, value: 230, label: 'seconds one event took to arrive[[src:why]]' },
        { step: 2, value: 3, label: 'of 6 minutes whose count can change[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'What does “streaming” mean?', text: 'People use it for five different things.' },
        { step: 3, n: 2, title: 'When did an event happen?', text: 'Every event has two times, and they disagree.' },
        { step: 4, n: 3, title: 'Does that change the answer?', text: 'Yes: half the minutes get a different count.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'People click on a website. Each report of clicks is called an event: it says which user, a or b, and how many clicks. The events travel to a pipeline, a program that adds them up minute by minute.',
        'Our example has 9 events, holding 45 clicks between them. They are the same 9 events in every part of this chapter.',
        'One of them took 230 seconds to reach the pipeline. And because of delays like that, 3 of the 6 minutes can end up with a different count.',
        'People call this kind of work streaming. This part asks three questions. What does the word streaming mean? And when did an event happen?',
        'And does the answer to that change the counts? It does. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · question: the word ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['latency'],
      eyebrow: '02 · Your turn',
      heading: 'One word, said in a meeting',
      stand: 'An engineer says: “we need streaming.” Two colleagues nod, and later build two different systems.',
      question: {
        step: 0,
        prompt: 'What did the engineer actually ask for?',
        options: [
          { text: 'One clear thing: everyone means the same by “streaming”.', correct: false,
            why: 'Then the two colleagues would not have built two different systems. The word is used for several separate needs.' },
          { text: 'Possibly any of several different things, depending on who is listening.', correct: true,
            why: 'The word is used for at least five different requirements, so two people can agree on it and still disagree on the system.' },
          { text: 'Always the same thing: a faster answer than before.', correct: false,
            why: 'Speed is only one of the meanings. Others are about a job that never ends, or an answer that is only roughly right.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Five meanings', html: '<ul class="l"><li>an answer within a deadline</li><li>an answer soon</li><li>a job that never ends</li><li>work started by each event</li><li>a cheap, roughly right answer[[src:why]]</li></ul>' },
        { step: 2, title: 'Latency', html: '<p>How long you wait for an answer is its <b>latency</b>. “Soon” and “within a deadline” are wishes about latency.[[src:when]]</p>' },
        { step: 2, title: 'About the answer, not the system', html: '<p>Most of the five describe what someone wants from the <b>answer</b>. Only “a job that never ends” describes the <b>system</b>.[[src:walk]]</p>' }
      ],
      narration: [
        'First question. An engineer says we need streaming. Two colleagues nod, and later build two different systems. What did the engineer actually ask for? Choose an answer.',
        'Any of several things. The word is used for at least five: an answer within a deadline, an answer soon, a job that never ends, work started by each event, or a cheap, roughly right answer.',
        'How long you wait for an answer is called its latency. Most of the five meanings are wishes about the answer, like its latency. Only a job that never ends says anything about the system.'
      ]
    },

    /* ---------- 3 · the book's meaning ---------- */
    {
      title: 'Meant', layout: 'cards', defines: ['bounded', 'unbounded', 'batch', 'engine'],
      eyebrow: '03 · The meaning this book uses',
      heading: 'Streaming = an engine built for data that never ends',
      stand: 'The book keeps one meaning, and drops the other four.',
      columns: 3,
      cards: [
        { step: 0, title: 'Bounded and unbounded', html: '<p>A <b>bounded</b> dataset has an end, like yesterday’s log file. An <b>unbounded</b> dataset has no end: new events keep arriving, forever.[[src:term]]</p>' },
        { step: 1, title: 'The engine', html: '<p>An <b>engine</b> is the program that runs the pipeline’s work. In this book, streaming means an engine <b>designed for unbounded data</b>. That is all.[[src:why]]</p>' },
        { step: 2, title: 'What it does not promise', html: '<p>Not low latency, not a rough answer. And it is not the opposite of <b>batch</b>: a job that reads a finished pile of data once, then stops.[[src:why]]</p>' }
      ],
      narration: [
        'The book keeps just one meaning. A dataset that has an end, like yesterday’s log file, is called bounded. A dataset that never ends, where new events keep arriving, is called unbounded.',
        'The program that runs a pipeline’s work is called an engine. In this book, streaming means one thing: an engine designed for unbounded data. Nothing more.',
        'It does not promise low latency, and it does not mean a rough answer. Nor is it the opposite of batch, a job that reads a finished pile of data once and then stops.'
      ]
    },

    /* ---------- 4 · question: the test ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '04 · Your turn',
      heading: 'When do you need this book’s kind of engine?',
      stand: 'A team receives website clicks all day, every day. Nobody ever says “that was the last click”.',
      question: {
        step: 0,
        prompt: 'Which test tells the team it needs an engine built for unbounded data?',
        options: [
          { text: 'Can the input ever be read to its end?', correct: true,
            why: 'If it cannot, there is no “after everything has arrived”, so the engine needs another way to decide when to answer.' },
          { text: 'Must the answer arrive within a second?', correct: false,
            why: 'That is a latency wish. A batch job on a tight schedule can meet it, so it does not decide the engine.' },
          { text: 'Is the amount of data very large?', correct: false,
            why: 'A huge file still ends. Size makes a job slower; it does not make the input endless.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The test', html: '<p>Not “is it fast?” but “can I ever read to the end?” A click feed, a sensor feed, a log: none of them ends.[[src:when]]</p>' },
        { step: 2, title: 'The other wishes are separate', html: '<p>A latency promise, or a rough answer, can be met by either kind of engine. They are separate decisions.[[src:when]]</p>' }
      ],
      narration: [
        'Second question. A team receives website clicks all day, every day, and nobody ever says that was the last click. Which test tells it to use an engine built for unbounded data? Choose an answer.',
        'Can the input ever be read to its end? Here it cannot. So the engine can never wait until everything has arrived. It needs some other way to decide when to answer.',
        'The other wishes are separate decisions. A fast answer, or a rough one, can be had from either kind of engine. Now let us see what makes unbounded data hard.'
      ]
    },

    /* ---------- 5 · the nine events, two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '05 · The nine events, and their two times',
      heading: 'Every event carries two times',
      stand: 'Listed in the order the pipeline saw them. Times are on a clock that starts at 12:00:00.',
      table: {
        columns: ['Event', 'User', 'Clicks', 'Happened at', 'Seen at'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, `${e.v}`, i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'Two clocks', html: '<ul class="l"><li><b>Event time</b> — when the click really happened, stamped by the user’s own device.</li><li><b>Processing time</b> — when the pipeline saw it, read off the pipeline’s own clock.[[src:why]]</li></ul>' },
      narration: [
        'Here are the nine events, in the order the pipeline saw them. Event 0 is from user a: 5 clicks, which happened at 12:00:01 and were seen at 12:00:02.',
        'Most events are seen a second or a few seconds after they happen. Look at event 6: it happened at 12:03:40, but was seen at 12:04:30.',
        'And event 7, in bold, happened at 12:00:50 but was not seen until 12:04:40. It is listed late because it arrived late.',
        'So every event carries two times. When it really happened, stamped by the user’s device, is its event time. When the pipeline saw it, on the pipeline’s own clock, is its processing time.'
      ]
    },

    /* ---------- 6 · question: the gap ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '06 · Your turn',
      heading: 'Event 7: happened at 12:00:50, seen at 12:04:40',
      stand: 'The two times of one event are 230 seconds apart. The pipeline did nothing wrong.',
      question: {
        step: 0,
        prompt: 'What does a gap like that most likely mean?',
        options: [
          { text: 'Something broke, and the event must be thrown away.', correct: false,
            why: 'Nothing is broken. The click is real and correct; it simply took the long way to arrive.' },
          { text: 'The pipeline’s clock is wrong by 230 seconds.', correct: false,
            why: 'The other events are seen within seconds, so the clock is fine. Only this event was delayed.' },
          { text: 'Normal life: a phone was offline, or a queue backed up.', correct: true,
            why: 'Network delay, waiting in queues, and resending all keep the two times apart, and nobody controls by how much.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Always apart', html: '<p>The two times disagree on <b>every</b> event, by an amount nobody controls: network delay, queueing, overload, replays.[[src:term]]</p>' },
        { step: 2, title: 'Not a bug', html: '<p>Event 7 happened in the first minute and arrived in the fifth. The dataset is built to contain that gap, because every difficulty in the book follows from it.[[src:walk]]</p>' }
      ],
      narration: [
        'Third question. Event 7 happened at 12:00:50 and was seen at 12:04:40, 230 seconds later. What does a gap like that most likely mean? Choose an answer.',
        'Normal life. A phone was offline, or a queue backed up. Network delay, waiting in queues, overload and resending keep the two times apart on every event, by an amount nobody controls.',
        'Event 7 happened in the first minute and arrived in the fifth. Nothing is broken. Let us measure the gap on all nine events.'
      ]
    },

    /* ---------- 7 · the gap, measured ---------- */
    {
      title: 'Gap', layout: 'array',
      eyebrow: '07 · Watch the gap on every event',
      heading: 'Seen at, minus happened at',
      stand: 'One column per event, in the order seen. The bottom row is the gap in seconds.',
      array: {
        labelWidth: 140, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => clock(e.et)) },
          { label: 'seen at', values: E.map(e => clock(e.pt)) },
          { label: 'gap (seconds)', values: SKEW }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [7] }
        ]
      },
      cards: [
        { step: 2, title: 'One long straggler', html: '<p>Eight events arrive within <b>50</b> seconds. Event 7 takes <b>230</b>, about 5 times the next worst.[[src:why]]</p>' },
        { step: 3, title: 'Even the order changes', html: '<p>Event 7 happened <b>third</b> but was seen <b>eighth</b>. Event 6 happened before event 4, and was seen after it.[[src:walk]]</p>' }
      ],
      narration: [
        'Here are the two times again, one column per event, in the order the pipeline saw them. Top row: when each click happened. Middle row: when it was seen.',
        'The bottom row is the difference: seen at minus happened at, in seconds. Most gaps are 1, 2 or 3 seconds. Event 6 waited 50.',
        'And event 7, picked out, waited 230 seconds, about five times the next worst. Eight events arrive within 50 seconds; one is a long straggler.',
        'Notice the order changes too. Event 7 happened third, but was seen eighth. The pipeline does not receive events in the order they happened.'
      ]
    },

    /* ---------- 8 · question: which minute ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['bucket'],
      eyebrow: '08 · Your turn',
      heading: 'Into which minute do event 7’s 4 clicks go?',
      stand: 'The pipeline keeps one running count per minute: a box for 12:00, a box for 12:01, and so on. Each event is dropped into one box.',
      question: {
        step: 0,
        prompt: 'If the pipeline picks the box by when it SAW each event, which minute gets event 7’s 4 clicks?',
        options: [
          { text: 'The 12:00 minute, when the clicks really happened.', correct: false,
            why: 'That is the event-time box. Picking by when the pipeline saw it uses 12:04:40 instead.' },
          { text: 'The 12:04 minute, when the pipeline saw them.', correct: true,
            why: 'Seen at 12:04:40, so by processing time the 4 clicks land in 12:04, four minutes away from where they happened.' },
          { text: 'No minute: an event that late is left out.', correct: false,
            why: 'Nothing is left out. Every event goes into exactly one box; the only question is which clock picks it.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A bucket', html: '<p>Each per-minute box is called a <b>bucket</b>. By processing time, event 7 goes in the 12:04 bucket; by event time, in the 12:00 bucket.[[src:mem]]</p>' },
        { step: 2, title: 'The same line of code', html: '<p>The chapter’s program counts with the clock as a setting. Same code; only the setting changes, and event 7 lands four minutes away.[[src:mem]]</p>' }
      ],
      narration: [
        'Fourth question. The pipeline keeps a running count for each minute. If it picks the minute by when it saw each event, which minute gets event 7’s 4 clicks? Choose an answer.',
        'The 12:04 minute. Each per-minute box is called a bucket. By processing time, event 7 lands in the 12:04 bucket. By event time, it lands in the 12:00 bucket, where it happened.',
        'The chapter’s program counts both ways with the same code: the only thing that changes is which clock it is told to use. Now watch both counts for every minute.'
      ]
    },

    /* ---------- 9 · the two counts, animated ---------- */
    {
      title: 'Count', layout: 'array',
      eyebrow: '09 · Watch the clicks counted per minute, both ways',
      heading: 'Same 9 events, two sets of buckets',
      stand: 'One column per minute. Top: clicks by when they happened. Below: clicks by when they were seen.',
      array: {
        labelWidth: 170, slots: false,
        rows: [
          { label: 'minute', values: MINUTES.map(m => clock(m).slice(0, 5)) },
          { label: 'by event time', values: ET_ROW },
          { label: 'by processing time', values: PT_ROW },
          { label: 'the two', values: DIFF }
        ],
        meters: ['clicks, by event time', 'clicks, by processing time', 'minutes compared', 'minutes that differ'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'sum', resultMeter: 0, speed: 260 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', resultMeter: 1, speed: 260 },
          { step: 2, do: 'show', rows: [3] },
          { step: 2, do: 'sweep', row: 3, mode: 'match', match: 'differs', readMeter: 2, resultMeter: 3, speed: 400 }
        ]
      },
      cards: [
        { step: 3, title: 'The 12:00 minute', html: '<p>By event time: events 0, 1 and 7, so <b>12</b>. By processing time: only 0 and 1, so <b>8</b>.[[src:mem]]</p>' },
        { step: 3, title: 'The 12:04 minute', html: '<p>By event time <b>7</b>. By processing time <b>20</b>: events 6 and 7 pile in from earlier minutes.[[src:mem]]</p>' }
      ],
      narration: [
        'One column per minute. The top row of counts adds each event to the minute it happened in. Added up, they make 45 clicks.',
        'The next row adds each event to the minute it was seen in. Again 45 clicks. No event is lost and none is counted twice.',
        'Now compare the two rows, minute by minute. Watch the pointer: 3 of the 6 minutes hold different numbers.',
        'The 12:00 minute is 12 by event time, but 8 by processing time, because event 7 is missing. And 12:04 jumps from 7 to 20, because events 6 and 7 pile in late.'
      ]
    },

    /* ---------- 10 · question: which is wrong ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '10 · Your turn',
      heading: '12 or 8: which count for 12:00 is wrong?',
      stand: 'Both rows used the same nine events and both add up to 45. They disagree about three minutes.',
      question: {
        step: 0,
        prompt: 'By event time the 12:00 minute holds 12 clicks; by processing time, 8. Which is wrong?',
        options: [
          { text: 'The 8: the processing-time count has a bug.', correct: false,
            why: 'The code is the same in both. The 8 correctly counts what arrived during that minute.' },
          { text: 'Neither: they answer two different questions.', correct: true,
            why: 'Twelve clicks happened at 12:00; eight were received at 12:00. Both are true. Only one is what a clicks chart promises.' },
          { text: 'The 12: it includes an event that arrived late.', correct: false,
            why: 'Event 7 really did happen at 12:00:50. Counting it there is correct for a question about when clicks happened.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two questions', html: '<p>“How many clicks <b>happened</b> at 12:00?” is 12. “How many did the pipeline <b>receive</b> at 12:00?” is 8.[[src:why]]</p>' },
        { step: 2, title: 'Not just slower', html: '<p>A processing-time count is not a slightly late event-time count. It answers another question, and can be any distance off.[[src:walk]]</p>' }
      ],
      narration: [
        'Fifth question. By event time the 12:00 minute holds 12 clicks. By processing time, it holds 8. Which count is wrong? Choose an answer.',
        'Neither. Twelve clicks happened at 12:00, and eight were received at 12:00. Both are true. The two counts answer two different questions.',
        'So a count by processing time is not a slightly late count by event time. It is about something else, and it can be any distance from the event time count.'
      ]
    },

    /* ---------- 11 · question: the four questions ---------- */
    {
      title: 'Four', layout: 'ask',
      eyebrow: '11 · Your turn · the book in four questions',
      heading: 'What, where, when, how',
      stand: 'The book asks four questions of every pipeline: what is computed, where in event time, when it is shown, and how later answers relate to earlier ones.',
      question: {
        step: 0,
        prompt: 'Which of the four questions is the only one about processing time, the pipeline’s own clock?',
        options: [
          { text: 'What: which result is computed.', correct: false,
            why: 'What is computed, here a sum of clicks, is the same whichever clock you pick.' },
          { text: 'Where: which slice of event time.', correct: false,
            why: 'Where picks the slice of time the events happened in, like the 12:00 minute. That is event time.' },
          { text: 'When: the moment the answer is shown.', correct: true,
            why: 'Deciding when to speak happens on the pipeline’s own clock. That is the only question about processing time.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Where and when, kept apart', html: '<p><b>Where</b> picks the event-time slice: the 12:00 minute. <b>When</b> picks the processing-time moment to speak. A system with only “when” is a processing-time count.[[src:walk]]</p>' },
        { step: 2, title: 'And how', html: '<p><b>How</b> says what a later, corrected answer does to an earlier one. The rest of the book is these four questions, one at a time.[[src:term]]</p>' }
      ],
      narration: [
        'The book asks four questions of every pipeline: what is computed, where in event time, when the answer is shown, and how later answers relate to earlier ones. Which one is about processing time? Choose an answer.',
        'When. Where picks the event-time slice, like the 12:00 minute. When picks the moment, on the pipeline’s clock, to speak. A system that only has when is the processing-time count.',
        'And how says what a later, corrected answer does to an earlier one. The rest of the book takes these four questions one at a time.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'One last check',
      stand: 'The chapter’s own quiz question. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What precise meaning does the book give to “streaming”?',
        options: [
          { text: 'Any program that is not a batch job.', correct: false,
            why: 'Streaming is not defined as the opposite of batch. A batch job is, in fact, a special case of it.' },
          { text: 'An engine designed for data that never ends.', correct: true,
            why: 'An engine built with unbounded data in mind: data that arrives gradually and never completes.' },
          { text: 'A pipeline that answers with low latency.', correct: false,
            why: 'Low latency is a separate wish. A batch job on a tight schedule can meet it too.' }
        ]
      },
      cards: [
        { step: 1, title: 'The chapter’s answer', html: '<p>A data processing engine designed with infinite datasets in mind, applied to unbounded data that arrives gradually and never completes.[[src:quiz]]</p>' }
      ],
      narration: [
        'One last question, from the chapter’s own quiz. What precise meaning does the book give to the word streaming? Choose an answer.',
        'An engine designed for data that never ends: unbounded data, arriving gradually and never complete. Not fast, not rough, and not merely the opposite of batch.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'One word pinned down, two clocks, two answers',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Streaming</b>', 'An engine designed for unbounded data. Not a promise of speed or of rough answers.[[src:why]]'] },
          { step: 0, cells: ['<b>Bounded</b> / <b>unbounded</b>', 'Data with an end, like a day’s file; data with no end, like a click feed.[[src:term]]'] },
          { step: 1, cells: ['<b>Event time</b>', 'When the click happened. Event 7: 12:00:50.[[src:why]]'] },
          { step: 1, cells: ['<b>Processing time</b>', 'When the pipeline saw it. Event 7: 12:04:40, 230 seconds later.[[src:why]]'] },
          { step: 2, cells: ['<b>Bucket</b>', 'One minute’s count. 3 of 6 minutes differ by clock: 12:00 is 12 or 8.[[src:mem]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>If the two clocks give two answers, which one should a pipeline trust — and how long should it wait for a straggler like event 7? Part 2 puts a price on waiting.</p>' },
      narration: [
        'To recap. Streaming, in this book, means an engine designed for unbounded data: data with no end, unlike a bounded file. It is not a promise of speed.',
        'Every event carries two times. Event time is when it happened: event 7 at 12:00:50. Processing time is when the pipeline saw it: 12:04:40, 230 seconds later.',
        'Counting per minute by each clock fills the buckets differently: 3 of the 6 minutes disagree, and 12:00 holds 12 or 8. Neither count is wrong; they answer different questions.',
        'Next, part 2 asks which clock a pipeline should use, and what it costs to wait for a straggler like event 7.'
      ]
    }
  ]
};
