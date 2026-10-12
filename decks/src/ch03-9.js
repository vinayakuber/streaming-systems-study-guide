// Chapter 3, Part 9 — the chapter's two "Interview Questions", explored from several sides,
// then the chapter quiz and a recap of the whole chapter. Each interview question is told as
// a story, probed (why the obvious answer fails, which estimate, what each step does, what
// breaks if a step is skipped, the same question with other numbers), and its code snippet is
// built line by line, a question before each piece. The snippet lines come from the chapter
// source (content/ch03-*.js) through _prog.js, addressed by content, so the deck never
// retypes them. Every time and value comes from the one seed (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch03';
const Q1 = snippet(CH, 0), Q2 = snippet(CH, 1);
const span = (S, a, b) => [S.at(a), S.at(b)];
const Q1_EST = span(Q1, 'max_seen = 12:04:05 (id 4)', 'watermark = 12:04:05 - 1:00');
const Q1_CLOSE = span(Q1, 'publishes 15', 'publishes 15');
const Q1_LATE = span(Q1, 'its window is closed -> late', 're-emit 19');
const Q2_CLAIM = span(Q2, 'one global watermark', 'stage_watermark = min(');
const Q2_FIX = span(Q2, 'wait on source b', 'fix: idleness timeout');

const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const LI = E.findIndex(e => e.id === 7);
const maxThrough = i => Math.max(...E.slice(0, i + 1).map(e => e.et));
if (seed.WATERMARKS[4] !== 185 || seed.SUM(seed.WINDOWS[0]) !== 19 || seed.SUM(seed.WINDOWS[0].filter(id => id !== 7)) !== 15
  || E[LI].et !== 50 || E[LI].pt !== 280 || seed.WATERMARKS[LI] - seed.WIN + 1 !== 81 || maxThrough(LI - 1) - seed.WIN + 1 !== 141
  || seed.SUM(seed.WINDOWS[120]) !== 11 || seed.SUM(seed.WINDOWS[240]) !== 7)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Watermark Interview Drill',
  eyebrow: 'Streaming · Ch 3 · Part 9',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'watermark', 'skew', 'heuristic',
    'trigger', 'late', 'allowed lateness', 'source', 'stage', 'idleness timeout', 'perfect watermark'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    what:  section(CH, 'What a watermark is', 'Chapter 3 · what a watermark is'),
    est:   section(CH, 'Why a watermark is an estimate, and what a correct one would cost', 'Chapter 3 · why it is an estimate'),
    skew:  section(CH, 'Why the skew bound is the only judgement in the formula — and what each value buys', 'Chapter 3 · the skew bound'),
    prop:  section(CH, 'Why a stage takes the minimum, and why "closed" is not "complete"', 'Chapter 3 · why the minimum'),
    q1:    section(CH, 'Q1', 'Chapter 3 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 3 · interview question 2'),
    trig:  section(CH, 'trigger/emitter', 'Chapter 3 · the trigger and late data'),
    quiz:  section(CH, 'Quiz', 'Chapter 3 · quiz'),
    kc:    section(CH, 'Key Concepts', 'Chapter 3 · key concepts')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 3 · Part 9 · the interview questions',
      heading: 'Two interview questions about phones that go offline, from every side',
      hero: { step: 0, text: 'A mobile analytics app on two phones, <b>a</b> and <b>b</b>, sends a message each time something happens: an <b>event</b> with a small value. They arrive without end, a <b>stream</b>. The <b>pipeline</b> adds the values up per 2-minute <b>window</b> of time and reports each total.[[src:q1]]' },
      tiles: [
        { step: 1, value: 2, label: 'interview questions, each probed from several sides[[src:q1]]' },
        { step: 1, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: 15, label: 'what the first window reported[[src:q1]]' },
        { step: 2, value: 19, label: 'its true total[[src:q1]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'A phone goes offline', text: 'Its events reach the pipeline minutes after they happened.' },
        { step: 3, n: 2, title: 'A window is reported too soon', text: 'Window 12:00 to 12:02 goes out as 15.' },
        { step: 4, n: 3, title: 'The interviewer asks', text: 'How do you decide a window is complete, and what do you do about data after that?' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'A mobile analytics app on two phones, a and b, sends a message each time something happens: an event with a small value. They arrive without end, a stream, and a pipeline adds the values up per 2-minute window of time.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then the 5 questions of the chapter quiz.',
        'Interview question 1. The first window, 12:00 to 12:02, was reported as 15. Its true total is 19.',
        'A phone went offline, so its event reached the pipeline minutes after it happened, and the window had already been reported.',
        'The interviewer asks: how do you decide a window is complete when events arrive out of order, and what do you do about data that comes after? You answer first, every time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'In the order the pipeline received them.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`id ${e.id}`, e.key, i === LI ? `<b>${clock(e.et)}</b>` : clock(e.et), i === LI ? `<b>${clock(e.pt)}</b>` : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li></ul><p>Window 12:00 to 12:02 holds ids 0, 1, 2 and 7: 5 + 3 + 7 + 4 = 19.[[src:est]]</p>' },
      narration: [
        'Each event carries two times. When it happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Usually seconds apart.',
        'But id 7 happened at 12:00:50 and was seen at 12:04:40, after ids 4, 5 and 6, which happened later.',
        'Window 12:00 to 12:02 holds ids 0, 1, 2 and 7: 5, 3, 7 and 4, which is 19. Without id 7, it is 15.'
      ]
    },

    /* ---------- 3 · Q1: why the obvious answer fails ---------- */
    {
      title: 'Wall', layout: 'ask',
      eyebrow: '03 · Interview question 1 · why the obvious answer fails',
      heading: 'Why not report the window when the clock says 12:02?',
      stand: 'The simplest rule: report window 12:00 to 12:02 as soon as the wall clock reaches 12:02.',
      question: {
        step: 0,
        prompt: 'What is wrong with reporting when the wall clock reaches 12:02?',
        options: [
          { text: 'The wall clock is processing time; id 7 is still on its way.', correct: true,
            why: 'Id 7 happened at 12:00:50 but arrives at 12:04:40. The clock cannot know what is still travelling.' },
          { text: 'Nothing: every event arrives within a second or two.', correct: false,
            why: 'Most do, but id 7 took 230 s. One straggler is enough to make the total wrong.' },
          { text: 'The wall clock is too slow to read.', correct: false,
            why: 'Reading the clock is instant. The problem is what it measures, not how fast.' }
        ]
      },
      cards: [
        { step: 1, title: 'Completeness must be estimated', html: '<p>A stream never says “everything before 12:02 is in”. The pipeline needs an estimate of that, in event time.[[src:what]]</p>' }
      ],
      narration: [
        'First angle: why the obvious answer fails. The simplest rule reports the window when the wall clock reaches 12:02. What is wrong with that? Choose an answer.',
        'The wall clock is processing time, and id 7 is still on its way: it happened at 12:00:50 but arrives at 12:04:40. A stream never says that everything before 12:02 is in, so the pipeline needs an estimate of it, in event time.'
      ]
    },

    /* ---------- 4 · Q1: the snippet, the estimate ---------- */
    {
      title: 'Est', layout: 'code', defines: ['watermark', 'skew', 'heuristic'],
      eyebrow: '04 · Interview question 1 · which estimate · the snippet, lines 1 and 2',
      heading: 'The latest event time seen, minus a margin',
      stand: 'The pipeline’s estimate that everything before a time has arrived is its watermark. After id 4, the latest event time seen is 12:04:05.',
      question: { step: 0, prompt: 'Which estimate can the pipeline compute from what it has already seen?', options: [
        { text: 'The latest event time seen, minus a fixed margin.', correct: true, why: 'It needs no future events, and it never moves backwards: 12:04:05 minus 60 s is 12:03:05.' },
        { text: 'The earliest event time seen, plus a margin.', correct: false, why: 'The earliest time never changes, so the estimate would never move and nothing would be reported.' },
        { text: 'The time of the event still to arrive.', correct: false, why: 'That would be exact, but it needs events that have not arrived. No live pipeline has them.' } ] },
      code: Q1.build({ add: [Q1_EST], step: 1 }),
      cards: [ { step: 2, title: 'A heuristic watermark', html: '<p>The margin is the <b>skew</b>, a bound on how out of order events can be: 60 s. A rule of thumb like this is a <b>heuristic</b> watermark: 12:03:05.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: which estimate? The pipeline’s estimate that everything before a time has arrived is called its watermark. Which one can it compute from what it has already seen? Choose an answer.',
        'The latest event time seen, minus a fixed margin. Here are the first two lines of the chapter’s snippet: the latest time is 12:04:05, from id 4, the margin is 60 seconds, so the watermark is 12:03:05.',
        'The margin is called the skew: a bound on how out of order events can be. A rule of thumb like this is called a heuristic, so this is a heuristic watermark.'
      ]
    },

    /* ---------- 5 · Q1: the snippet, closing ---------- */
    {
      title: 'Close', layout: 'code', defines: ['trigger'],
      eyebrow: '05 · Interview question 1 · the snippet, line 3',
      heading: 'The watermark passes the window’s end',
      stand: 'The rule that reports a window when the watermark passes its end is the trigger. The watermark is now 12:03:05; the window ends at 12:02.',
      question: { step: 0, prompt: 'With the watermark at 12:03:05, what happens to window 12:00 to 12:02?', options: [
        { text: 'It closes and reports 15.', correct: true, why: '12:03:05 is past 12:02, so the trigger fires. Ids 0, 1 and 2 are in: 15.' },
        { text: 'It waits for 12:02 on the wall clock.', correct: false, why: 'The trigger compares the watermark, an event time, with the window’s end. The wall clock is not used.' },
        { text: 'It waits until all 19 have arrived.', correct: false, why: 'The pipeline cannot know 19 is the total. It acts on its estimate.' } ] },
      code: Q1.build({ before: [Q1_EST], add: [Q1_CLOSE], step: 1 }),
      cards: [ { step: 2, title: 'Closed, not complete', html: '<p>12:03:05 ≥ 12:02:00, so the window closes with 15. The pipeline decided to stop waiting; it did not prove the window complete.[[src:prop]]</p>' } ],
      narration: [
        'The rule that reports a window when the watermark passes its end is called the trigger. With the watermark at 12:03:05, what happens to window 12:00 to 12:02? Choose an answer.',
        'It closes and reports 15. Here is the third line: 12:03:05 is at least 12:02, so the window is closed and publishes 15.',
        'Closed, not complete. The pipeline decided to stop waiting; it did not prove that everything had arrived.'
      ]
    },

    /* ---------- 6 · Q1: the snippet, late data ---------- */
    {
      title: 'Late', layout: 'code', defines: ['late', 'allowed lateness'],
      eyebrow: '06 · Interview question 1 · the snippet, lines 4 and 5',
      heading: 'Id 7 lands in a closed window',
      stand: 'Id 7, from 12:00:50, arrives at 12:04:40. The watermark then stands at 12:03:20, 80 s past the window’s end.',
      question: { step: 0, prompt: 'What must be true for id 7 to still correct the total?', options: [
        { text: 'The window is kept at least 81 s after its end.', correct: true, why: '12:02 plus 81 s is just past the watermark’s 12:03:20, so the window still exists when id 7 lands.' },
        { text: 'The skew is raised to 230 s, id 7’s delay.', correct: false, why: 'That changes when the window closes, not what happens to a straggler after it closed.' },
        { text: 'Nothing: a closed window always takes late data.', correct: false, why: 'Only while its running total is still kept. Once dropped, 15 stands for good.' } ] },
      code: Q1.build({ before: [Q1_EST, Q1_CLOSE], add: [Q1_LATE], step: 1 }),
      cards: [ { step: 2, title: 'Late, and the safety net', html: '<p>An event arriving after its window closed is <b>late</b>. Keeping the window for a bounded time after its end is <b>allowed lateness</b>: at least 81 s here, then re-emit 19.[[src:trig]]</p>' } ],
      narration: [
        'Id 7, from 12:00:50, arrives at 12:04:40, with the watermark 80 seconds past the window’s end. What must be true for it to still correct the total? Choose an answer.',
        'The window must be kept at least 81 seconds after its end. Here are the last two lines: its window is closed, so id 7 is late, but with allowed lateness of at least 81 seconds it is still accepted, and 19 is re-emitted.',
        'An event that arrives after its window closed is called late. Keeping a window for a bounded time after its end is called allowed lateness. That is the chapter’s whole answer to question 1.'
      ]
    },

    /* ---------- 7 · Q1: other numbers ---------- */
    {
      title: 'Vary', layout: 'ask',
      eyebrow: '07 · Interview question 1 · the same question, other numbers',
      heading: 'What if the skew were 141 s instead of 60?',
      stand: 'Before id 7 arrives, the latest event time seen is 12:04:20, from id 5. The window ends at 12:02.',
      question: {
        step: 0,
        prompt: 'With a skew of 141 s, what does window 12:00 to 12:02 report the first time?',
        options: [
          { text: '19, but at 12:09:02, 296 s later.', correct: true,
            why: '12:04:20 − 141 s is 12:01:59, short of 12:02, so the window waits for id 7, and closes only at id 8.' },
          { text: '15, at 12:04:06, as before.', correct: false,
            why: 'That is skew 60. With 141 the watermark stays just below 12:02 until id 7 has landed.' },
          { text: '19, at 12:04:06, with no cost.', correct: false,
            why: 'The window cannot close at 12:04:06: the watermark has not passed 12:02 yet. Waiting is the cost.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The exact threshold', html: '<p>141 s = 12:04:20 − 12:02 + 1. Not id 7’s delay of 230 s: the watermark only has to stay below the window’s end.[[src:skew]]</p>' },
        { step: 2, title: 'Latency against correctness', html: '<p>A bigger skew buys the right answer with waiting; a smaller one buys speed with late events and corrections.[[src:kc]]</p>' }
      ],
      narration: [
        'Third angle: the same question with other numbers. Before id 7 arrives, the latest event time is 12:04:20. With a skew of 141 seconds, what does the window report the first time? Choose an answer.',
        '19, but at 12:09:02, 296 seconds later. 12:04:20 minus 141 seconds is just short of 12:02, so the window waits for id 7. And 141 is exactly the threshold, not id 7’s delay of 230 seconds.',
        'So the skew is the knob between latency and correctness: a bigger one buys the right answer by waiting, a smaller one buys speed with late events and corrections.'
      ]
    },

    /* ---------- 8 · Q2: the story ---------- */
    {
      title: 'Quiet', layout: 'ask', defines: ['source', 'stage'],
      eyebrow: '08 · Interview question 2 · the story, and what goes wrong',
      heading: 'One busy phone, one quiet phone, one shared step',
      stand: 'Each phone is a source; a step of the pipeline reading several sources is a stage. Phone b goes quiet after its event at 12:04:20, but windows keep being reported that phone b never vouched for.',
      question: {
        step: 0,
        prompt: 'Why does the stage report windows phone b cannot vouch for?',
        options: [
          { text: 'One shared watermark is driven by the busiest phone.', correct: true,
            why: 'It takes the latest time from anyone, so phone a’s 12:09:00 drags it past what phone b has said.' },
          { text: 'Phone b’s events are dropped as late.', correct: false,
            why: 'Phone b is simply quiet. Nothing of it is being dropped; it has nothing to send.' },
          { text: 'The windows are too short.', correct: false,
            why: 'Window length does not matter. The estimate of completeness is what over-claims.' }
        ]
      },
      cards: [
        { step: 1, title: 'The interviewer asks', html: '<p>Why does the stage report windows the quiet source cannot vouch for, and how do you fix it?[[src:q2]]</p>' }
      ],
      narration: [
        'Interview question 2. Each phone is called a source, and a step of the pipeline reading several sources is called a stage. Phone b goes quiet, yet windows keep being reported that it never vouched for. Why? Choose an answer.',
        'One shared watermark is driven by the busiest phone: it takes the latest time from anyone, so phone a drags it past what phone b has said. The interviewer asks why, and how to fix it.'
      ]
    },

    /* ---------- 9 · Q2: the snippet, the claim ---------- */
    {
      title: 'Min', layout: 'code',
      eyebrow: '09 · Interview question 2 · the snippet, lines 1 to 3',
      heading: 'One shared watermark, or the smaller of two',
      stand: 'Phone a’s latest event happened at 12:09:00; phone b’s at 12:04:20. The skew is 60 s.',
      question: { step: 0, prompt: 'What may the stage claim, reading both phones?', options: [
        { text: 'The smaller of the two phones’ watermarks.', correct: true, why: 'A stage cannot claim more completeness than its least complete input: 12:03:20.' },
        { text: 'The larger, 12:08:00, since phone a has seen further.', correct: false, why: 'Phone b has said nothing past 12:03:20. Claiming 12:08:00 over-claims by 280 s.' },
        { text: 'Whichever phone sent the latest event.', correct: false, why: 'That is the shared watermark again, driven by the busiest phone.' } ] },
      code: Q2.build({ add: [Q2_CLAIM], step: 1 }),
      cards: [ { step: 2, title: 'Per source, then the minimum', html: '<p>Shared: 12:09:00 − 60 s = 12:08:00. Per source: a 12:08:00, b 12:03:20. The stage takes the minimum: <b>12:03:20</b>.[[src:q2]]</p>' } ],
      narration: [
        'Phone a’s latest event happened at 12:09:00, phone b’s at 12:04:20. What may the stage claim, reading both? Choose an answer.',
        'The smaller of the two. Here are the first three lines: one shared watermark would claim 12:08:00, but per source, a is at 12:08:00 and b at 12:03:20, and the stage takes the minimum, 12:03:20.',
        'A stage cannot claim more completeness than its least complete input. The shared watermark over-claimed by 280 seconds.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, the fix ---------- */
    {
      title: 'Fix', layout: 'code', defines: ['idleness timeout'],
      eyebrow: '10 · Interview question 2 · the snippet, lines 4 and 5',
      heading: 'Two windows wait, and how to stop them waiting forever',
      stand: 'Window 12:02 to 12:04 holds 11 and window 12:04 to 12:06 holds 7. Every one of their events has arrived.',
      question: { step: 0, prompt: 'Phone b may never send again. What fixes the stall without lying?', options: [
        { text: 'A timeout that declares b finished, or holding a’s data until the minimum moves.', correct: true, why: 'Either makes a deliberate decision about b, instead of claiming completeness it never gave.' },
        { text: 'Go back to one shared watermark.', correct: false, why: 'That reports the windows again, but by over-claiming for phone b: the original bug.' },
        { text: 'Raise the skew.', correct: false, why: 'A bigger skew holds the watermark further back. It cannot make a silent source speak.' } ] },
      code: Q2.build({ before: [Q2_CLAIM], add: [Q2_FIX], step: 1 }),
      cards: [ { step: 2, title: 'Idleness timeout', html: '<p>An <b>idleness timeout</b> declares a quiet source finished; or buffer phone a until the minimum passes 12:06:00. Both are decisions, not measurements.[[src:q2]]</p>' } ],
      narration: [
        'Windows 12:02 to 12:04 and 12:04 to 12:06, holding 11 and 7, wait on phone b, which may never send again. What fixes the stall without lying? Choose an answer.',
        'A timeout that declares phone b finished, or holding phone a’s data until the minimum moves. Here are the last two lines: the two windows wait on source b, and the fix is an idleness timeout, or a buffer until the minimum passes 12:06:00.',
        'A rule that declares a quiet source finished is called an idleness timeout. It is a decision, not a measurement: it trades away the correctness the minimum was protecting.'
      ]
    },

    /* ---------- 11 · Q2: what breaks ---------- */
    {
      title: 'None', layout: 'ask',
      eyebrow: '11 · Interview question 2 · the same question, other numbers',
      heading: 'Before phone b has said anything at all',
      stand: 'After ids 0 and 1, only phone a has sent anything. Phone a’s own watermark is from before 12:00.',
      question: {
        step: 0,
        prompt: 'What should the stage claim at that moment?',
        options: [
          { text: 'Nothing: no claim until every source has spoken.', correct: true,
            why: 'Silence cannot be told apart from an old event still on its way, so there is no basis for a claim.' },
          { text: 'Phone a’s watermark, since phone b has nothing.', correct: false,
            why: 'Phone b may be holding an old event right now. Ignoring a silent source is the over-claim again.' },
          { text: 'The start of the first window, 12:00.', correct: false,
            why: 'Even that says nothing before 12:00 is coming, which phone b has not vouched for.' }
        ]
      },
      cards: [ { step: 1, title: 'Silence is not a yes', html: '<p>Until every input has produced something, the stage makes no claim, not even a generous one.[[src:prop]]</p>' } ],
      narration: [
        'Last angle on question 2. After ids 0 and 1, only phone a has sent anything. What should the stage claim at that moment? Choose an answer.',
        'Nothing at all. Silence cannot be told apart from an old event still on its way, so until every source has produced something, the stage makes no claim, not even a generous one.'
      ]
    },

    /* ---------- 12 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask',
      eyebrow: '12 · Chapter quiz · 1 of 5',
      heading: 'What is a watermark?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What is a watermark?',
        options: [
          { text: 'The wall-clock time.', correct: false, why: 'The wall clock is processing time. A watermark is measured in event time.' },
          { text: 'A forward-only time declaring how complete event time is.', correct: true, why: 'It is the pipeline’s estimate that everything before it has arrived, and it never moves back.' },
          { text: 'The number of events in a window.', correct: false, why: 'That is a count of data, not a statement about completeness.' },
          { text: 'A type of window.', correct: false, why: 'Windows group events; the watermark decides when a window may be reported.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A watermark is the pipeline’s estimate of how complete the event-time axis is.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What is a watermark? Choose an answer.',
        'A time that only moves forward, declaring how complete event time is: the pipeline’s estimate that everything before it has arrived.'
      ]
    },

    /* ---------- 13 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask', defines: ['perfect watermark'],
      eyebrow: '13 · Chapter quiz · 2 of 5',
      heading: 'When can a watermark be perfect?',
      stand: 'A perfect watermark is one that is never wrong.',
      question: {
        step: 0,
        prompt: 'When is a perfect watermark possible?',
        options: [
          { text: 'When inputs are out of order.', correct: false, why: 'Out-of-order input is exactly what forces a guess.' },
          { text: 'When the source is known to be in order.', correct: true, why: 'Then nothing earlier can turn up later, so the last time seen is the exact bound.' },
          { text: 'When there are many sources.', correct: false, why: 'More sources make out-of-order arrival more likely, not less.' },
          { text: 'When there is no skew.', correct: false, why: 'A skew of 0 is still a guess; on out-of-order data it only makes more events late.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A <b>perfect watermark</b> needs ordered input, such as a single log consumed in order.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. A perfect watermark is one that is never wrong. When is it possible? Choose an answer.',
        'When the source is known to be in order, such as a single log read in order. Then nothing earlier can turn up later, so the last time seen is the exact bound.'
      ]
    },

    /* ---------- 14 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 3 of 5',
      heading: 'The usual formula',
      stand: 'Remember 12:04:05 and 12:03:05.',
      question: {
        step: 0,
        prompt: 'What is the usual heuristic watermark formula?',
        options: [
          { text: 'The wall clock plus the skew.', correct: false, why: 'The wall clock is processing time, and adding moves the estimate the wrong way.' },
          { text: 'The smallest event time plus the skew.', correct: false, why: 'The smallest time never changes, so the watermark would never move.' },
          { text: 'The latest event time seen, minus the skew.', correct: true, why: '12:04:05 minus 60 s is 12:03:05: measured, minus one guess.' },
          { text: 'The number of events, divided by the skew.', correct: false, why: 'A count says nothing about which times are complete.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The heuristic subtracts a skew, a bound on out-of-orderness, from the latest event time seen.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is the usual heuristic watermark formula? Choose an answer.',
        'The latest event time seen, minus the skew: 12:04:05 minus 60 seconds, 12:03:05. One measured value, minus one guess.'
      ]
    },

    /* ---------- 15 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 4 of 5',
      heading: 'A stage with several inputs',
      stand: 'Remember phone a at 12:08:00 and phone b at 12:03:20.',
      question: {
        step: 0,
        prompt: 'A stage’s watermark, with several inputs, is which of its inputs’ watermarks?',
        options: [
          { text: 'The largest.', correct: false, why: 'That over-claims for every slower input: 12:08:00 where phone b backs only 12:03:20.' },
          { text: 'The smallest.', correct: true, why: 'Completeness is bounded by the least complete input.' },
          { text: 'Their sum.', correct: false, why: 'A sum of times is not a time anyone can vouch for.' },
          { text: 'Their average.', correct: false, why: 'An average is still past what the slowest input can back.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The minimum: completeness is bounded by the least complete input.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. With several inputs, a stage’s watermark is which of its inputs’ watermarks? Choose an answer.',
        'The smallest. Completeness is bounded by the least complete input: 12:03:20, not 12:08:00.'
      ]
    },

    /* ---------- 16 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 5 of 5',
      heading: 'A watermark that moves too fast',
      stand: 'Remember skew 0, where ids 6 and 7 were both called late.',
      question: {
        step: 0,
        prompt: 'What is the downside of an over-eager, too-fast watermark?',
        options: [
          { text: 'Results arrive later.', correct: false, why: 'That is the cautious watermark’s cost. A fast one reports sooner.' },
          { text: 'Events that were merely delayed are called late.', correct: true, why: 'At skew 0, id 6, only 50 s behind, was called late. Lower latency, lost correctness.' },
          { text: 'Windows never close.', correct: false, why: 'A fast watermark closes windows sooner, not never.' },
          { text: 'Memory runs out.', correct: false, why: 'Memory grows with how long windows are kept, which a fast watermark shortens.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>An over-eager watermark lowers latency but loses correctness by treating delayed data as late.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. What is the downside of an over-eager watermark? Choose an answer.',
        'Events that were merely delayed get called late. At skew 0, id 6, only 50 seconds behind, was called late. It lowers latency and loses correctness.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · Chapter 3, and its two interview questions',
      heading: 'Estimate, act on it, correct it, and take the minimum',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Watermark</b>', 'The pipeline’s forward-only estimate that everything before it has arrived. Perfect only for ordered input.[[src:what]]'] },
          { step: 1, cells: ['<b>Question 1 · heuristic</b>', 'Latest event time seen − skew: 12:03:05, so the window closes with 15.[[src:q1]]'] },
          { step: 1, cells: ['<b>Allowed lateness</b>', 'Keep the window at least 81 s, so id 7 turns 15 into 19.[[src:q1]]'] },
          { step: 2, cells: ['<b>Question 2 · the minimum</b>', 'Per source, then the smallest: 12:03:20, not 12:08:00. Windows of 11 and 7 wait.[[src:q2]]'] },
          { step: 2, cells: ['<b>The fix</b>', 'An idleness timeout, or a buffer: a decision about a quiet source.[[src:q2]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Watermarks do not make event-time results correct; they make them possible, and correctable.[[src:kc]]</p>' },
      narration: [
        'To recap the chapter. A watermark is the pipeline’s forward-only estimate that everything before it has arrived, and it can be perfect only for ordered input.',
        'Question 1: the heuristic, latest event time seen minus the skew, closes the window at 12:03:05 with 15, and allowed lateness of at least 81 seconds lets id 7 turn it into 19.',
        'Question 2: track a watermark per source and take the smallest, 12:03:20 rather than 12:08:00, and fix a quiet source with an idleness timeout or a buffer.',
        'In one line: watermarks do not make event-time results correct; they make them possible, and correctable.'
      ]
    }
  ]
};
