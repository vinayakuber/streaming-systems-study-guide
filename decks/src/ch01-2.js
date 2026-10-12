// Chapter 1, Part 2 — "Event time vs processing time", for a viewer who has seen nothing
// before it. The click story and both clocks are told again from zero; the gap between the
// clocks is measured on all nine events; the guessing watermark is animated arrival by arrival;
// and the price of waiting is shown with the chapter's own numbers. All figures come from the
// one seed (tools/stream_seed.js) and are asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const E = seed.EVENTS;
const clock = s => seed.hhmmss(s);
const SKEW = E.map(e => e.pt - e.et);
const SEEN_MAX = E.map((_, i) => Math.max(...E.slice(0, i + 1).map(e => e.et)));
const WM = seed.WATERMARKS;
const keptAt = budget => SKEW.map(s => (s > budget ? 'dropped' : 'kept'));
const WINDOWS = seed.WIN_STARTS.length;
const ET0 = E.filter(e => e.et < 60).reduce((a, e) => a + e.v, 0);
const PT0 = E.filter(e => e.pt < 60).reduce((a, e) => a + e.v, 0);

if (SKEW[7] !== 230 || seed.LAG !== 60 || WM[6] !== 200 || SEEN_MAX[6] !== 260 || E[7].et !== 50 || WINDOWS !== 4
  || keptAt(60).filter(k => k === 'dropped').length !== 1 || keptAt(230).includes('dropped') || SKEW[6] !== 50
  || ET0 !== 12 || PT0 !== 8 || WINDOWS * 60 !== 240 || WINDOWS * 230 !== 920 || 230 - 60 !== 170)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'The Price of Waiting',
  eyebrow: 'Streaming · Ch 1 · Part 2',
  ...shared,
  jargon: ['event', 'click', 'pipeline', 'event time', 'processing time', 'skew', 'straggler', 'watermark',
    'heuristic', 'window', 'latency'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    term:  section(CH, 'Why the word has to be split before anything can be designed', 'Chapter 1 · two timestamps'),
    et:    section(CH, 'Event time vs processing time', 'Chapter 1 · event time vs processing time'),
    why:   section(CH, 'Why one of the two clocks is the meaningful one, and the other is the cheap one', 'Chapter 1 · the meaningful clock and the cheap one'),
    when:  section(CH, 'When to use which clock, and why the budget is a product decision', 'Chapter 1 · which clock, and the budget'),
    walk:  section(CH, 'Visual walkthrough — measured skew, a guessing watermark, and the bill', 'Chapter 1 · skew, watermark, bill'),
    mem:   section(CH, 'Skew, a guessing watermark, and what completeness costs', 'Chapter 1 · what completeness costs'),
    quiz:  section(CH, 'Quiz', 'Chapter 1 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'click', 'pipeline', 'event time', 'processing time'],
      eyebrow: '01 · Chapter 1 · Part 2',
      heading: 'Two clocks disagree. Which one should a click count trust — and how long should it wait?',
      hero: { step: 0, text: 'People click on a website. Each report of clicks is an <b>event</b>, sent to a <b>pipeline</b> that adds the <b>clicks</b> up per minute. Every event has two times: when it happened on the user’s device, its <b>event time</b>; and when the pipeline saw it, its <b>processing time</b>.[[src:term]]' },
      tiles: [
        { step: 1, value: 9, label: 'events, seen out of order[[src:why]]' },
        { step: 1, value: 230, label: 'seconds between the two times of event 7[[src:why]]' },
        { step: 2, value: 60, label: 'seconds a typical pipeline waits[[src:why]]' },
        { step: 2, value: 680, label: 'extra seconds of waiting to catch event 7[[src:mem]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'Which clock answers which question?', text: 'One is about users, the other about the pipeline.' },
        { step: 3, n: 2, title: 'How long to wait for late events?', text: 'Nobody can know in advance.' },
        { step: 4, n: 3, title: 'What does waiting cost?', text: 'Every answer arrives later.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'People click on a website. Each report of clicks is an event, sent to a pipeline that adds the clicks up per minute. Every event has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'Our example has 9 events, and the pipeline sees them out of order. For one of them, event 7, the two times are 230 seconds apart.',
        'A typical pipeline waits 60 seconds for late events. Waiting long enough to catch event 7 would cost 680 extra seconds of waiting in total.',
        'This part asks three questions. Which clock answers which question? And how long should a pipeline wait for late events?',
        'And what does that waiting cost? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events ---------- */
    {
      title: 'Data', layout: 'table',
      eyebrow: '02 · The nine events, in the order they were seen',
      heading: 'Two users, nine events, two times each',
      stand: 'Times are on a clock that starts at 12:00:00. Rows are in the order the pipeline saw the events.',
      table: {
        columns: ['Event', 'User', 'Clicks', 'Event time (happened)', 'Processing time (seen)'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, `${e.v}`, i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'The 12:00 minute, by each clock', html: '<p>Clicks that <b>happened</b> in it: events 0, 1 and 7, so <b>' + ET0 + '</b>.</p><p>Clicks the pipeline <b>saw</b> in it: events 0 and 1, so <b>' + PT0 + '</b>.[[src:when]]</p>' },
      narration: [
        'Here are the nine events, in the order the pipeline saw them. Event 0: user a, 5 clicks, happened at 12:00:01, seen at 12:00:02. Most are seen a few seconds after they happen.',
        'Event 6 happened at 12:03:40, but was seen at 12:04:30, after event 5.',
        'And event 7, in bold, happened at 12:00:50 and was not seen until 12:04:40.',
        'So the 12:00 minute holds 12 clicks if you count when they happened, but only 8 if you count when the pipeline saw them. Which one is right?'
      ]
    },

    /* ---------- 3 · question: the clock for the world ---------- */
    {
      title: 'Q1', layout: 'ask',
      eyebrow: '03 · Your turn',
      heading: '“How many clicks happened at 12:00?”',
      stand: 'A chart labelled “clicks at 12:00” is shown to the marketing team.',
      question: {
        step: 0,
        prompt: 'Which count should that chart show for the 12:00 minute?',
        options: [
          { text: '12, counting each click by when it happened.', correct: true,
            why: 'The question is about users, so it is keyed to their clock. The answer is 12, however busy the pipeline was.' },
          { text: '8, counting each click by when the pipeline saw it.', correct: false,
            why: 'That counts what arrived in that minute. A busy pipeline would shift clicks into later minutes.' },
          { text: '10, halfway between the two counts.', correct: false,
            why: 'Neither clock gives 10. Averaging two answers to two different questions answers neither.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Event time: the meaningful clock', html: '<p>Clicks per minute, how long a visit lasts, how slow a page was: questions about the world are keyed to <b>when things happened</b>.[[src:et]]</p>' },
        { step: 2, title: 'It does not move', html: '<p>The answer is 12, and it does not change because the pipeline was busy. A processing-time count would shift under load.[[src:when]]</p>' }
      ],
      narration: [
        'First question. A chart labelled clicks at 12:00 is shown to the marketing team. Which count should it show for the 12:00 minute? Choose an answer.',
        'Twelve, counting each click by when it happened. A question about users is keyed to their clock: clicks per minute, how long a visit lasts, how slow a page was.',
        'And the answer does not move. It is 12 whether or not the pipeline was busy. A count by processing time would shift clicks into later minutes under load.'
      ]
    },

    /* ---------- 4 · question: the clock for the system ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '04 · Your turn',
      heading: 'Is processing time ever the right clock?',
      stand: 'Processing time needs no special machinery: the pipeline’s own clock is right there.',
      question: {
        step: 0,
        prompt: 'Which question is processing time the RIGHT clock for?',
        options: [
          { text: 'How many clicks did users make at 12:00?', correct: false,
            why: 'That is about users, so it needs event time: 12, not 8.' },
          { text: 'How many clicks did the pipeline receive in that minute?', correct: true,
            why: 'That is a question about the pipeline itself, so its own clock is exactly right: 8.' },
          { text: 'How long did each user stay on the website?', correct: false,
            why: 'Visit lengths are facts about users, measured from when their clicks happened.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Processing time: the cheap clock', html: '<p>Right for questions about the <b>system</b>: how many events it handled this second, how long its queue is. For that minute it received <b>8</b> clicks, and that is correct.[[src:when]]</p>' },
        { step: 2, title: 'Use both to measure yourself', html: '<p>The gap between the two clocks is how far behind the pipeline is. That is the number to raise an alarm on.[[src:when]]</p>' }
      ],
      narration: [
        'Second question. Processing time needs no special machinery; the clock is right there. Which question is it the right clock for? Choose an answer.',
        'How many clicks the pipeline received in that minute. That is a question about the system itself, and 8 is the correct answer to it. Processing time is not the lazy choice; it answers a different question.',
        'And the gap between the two clocks tells you how far behind the pipeline is running. That gap is the number worth raising an alarm on. Let us measure it.'
      ]
    },

    /* ---------- 5 · skew, measured ---------- */
    {
      title: 'Skew', layout: 'array', defines: ['skew', 'straggler'],
      eyebrow: '05 · Watch the gap measured on every event',
      heading: 'Skew = processing time − event time',
      stand: 'Seconds past 12:00:00, one column per event, in the order seen.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => e.et) },
          { label: 'processing time', values: E.map(e => e.pt) },
          { label: 'skew', values: SKEW }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [7] }
        ]
      },
      cards: [
        { step: 1, title: 'Skew', html: '<p>The gap, in seconds, is called <b>skew</b>: processing time minus event time. It is measured, not assumed.[[src:why]]</p>' },
        { step: 2, title: 'A long tail', html: '<p>Eight events arrive within <b>50</b> seconds. Event 7 takes <b>230</b>, about 5 times the next worst. An event that late is a <b>straggler</b>.[[src:why]]</p>' },
        { step: 3, title: 'Why you cannot look it up', html: '<p>Skew is not a constant: mostly small, with one outlier. A wait chosen from the typical case is right for eight events and silently wrong about the ninth.[[src:walk]]</p>' }
      ],
      narration: [
        'Here are the two times again, now in seconds past 12:00. Event 0 happened at second 1 and was seen at second 2. One column per event, in the order seen.',
        'The bottom row is processing time minus event time. That gap is called skew. Most skews are 1, 2 or 3 seconds, and event 6’s is 50.',
        'Event 7’s skew is 230 seconds, about five times the next worst. An event that arrives that long after it happened is called a straggler.',
        'So skew is not a constant you can look up. It is mostly small, with a long tail. A wait chosen from the typical case is right for eight events, and silently wrong about the ninth.'
      ]
    },

    /* ---------- 6 · question: when is a minute complete ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['watermark', 'heuristic'],
      eyebrow: '06 · Your turn',
      heading: 'When can the pipeline say “12:00 is finished”?',
      stand: 'To show a final count for a minute, the pipeline must decide that no more events from that minute will arrive.',
      question: {
        step: 0,
        prompt: 'When can the pipeline know for certain that no more 12:00 events will ever arrive?',
        options: [
          { text: 'When its own clock passes 12:01.', correct: false,
            why: 'Event 7 happened at 12:00:50 and arrived at 12:04:40, long after the pipeline’s clock passed 12:01.' },
          { text: 'Never for certain: it can only make a guess.', correct: true,
            why: 'The input never ends, so there is always room for one more straggler. Any “finished” is a guess.' },
          { text: 'When an event from a later minute arrives.', correct: false,
            why: 'Events arrive out of order. Event 6 came after event 5, though it happened earlier.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A watermark', html: '<p>A <b>watermark</b> is a claim: “no event with an event time earlier than <i>t</i> will arrive from now on.” It is what lets a pipeline call a minute done.[[src:why]]</p>' },
        { step: 2, title: 'Usually a heuristic', html: '<p>A <b>heuristic</b> is a rule of thumb. The usual one: take the highest event time seen so far, and subtract an assumed worst-case gap — here <b>60</b> seconds.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. To show a final count for a minute, the pipeline must decide that no more events from it will arrive. When can it know that for certain? Choose an answer.',
        'Never for certain. The input never ends, so one more straggler is always possible. The claim that no event earlier than some time will still arrive is called a watermark.',
        'A watermark is usually a heuristic, a rule of thumb: take the highest event time seen so far, and subtract an assumed worst-case gap. Here that gap is 60 seconds. Watch it move.'
      ]
    },

    /* ---------- 7 · the watermark, animated ---------- */
    {
      title: 'Mark', layout: 'array',
      eyebrow: '07 · Watch the watermark after every arrival',
      heading: 'Highest event time seen, minus 60',
      stand: 'Seconds past 12:00:00, one column per arrival. The watermark claims: nothing earlier than this is still coming.',
      array: {
        labelWidth: 190, slotLabel: 'event id',
        rows: [
          { label: 'this event happened', values: E.map(e => e.et) },
          { label: 'highest seen so far', values: SEEN_MAX },
          { label: 'watermark', values: WM }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [7] }
        ]
      },
      cards: [
        { step: 2, title: 'Event 7 arrives', html: '<p>The watermark already stands at <b>' + WM[6] + '</b> (12:03:20): it has claimed that 12:00:50 is settled. Event 7 happened at <b>' + E[7].et + '</b>.[[src:mem]]</p>' },
        { step: 3, title: 'False, and unnoticed', html: '<p>The rule only reads events that <b>did</b> arrive: ' + SEEN_MAX[6] + ' − 60 = ' + WM[6] + '. It cannot know about one that has not. No error is raised.[[src:mem]]</p>' }
      ],
      narration: [
        'Here is when each event happened, in seconds, in the order the pipeline saw them: 1, 3, 90, 130 and so on, with event 7 at second 50.',
        'Under each, the highest event time seen so far, and the watermark: that number minus 60. It only goes up. After event 6, the highest is 260, so the watermark is 200, which is 12:03:20.',
        'Now event 7 arrives, picked out. The watermark already says 200: it has claimed that nothing before 12:03:20 is still coming. Event 7 happened at second 50.',
        'The claim is simply false, and nothing in the pipeline notices. The rule is arithmetic on the events that did arrive, so it cannot know about one that has not.'
      ]
    },

    /* ---------- 8 · question: how many lost at 60 ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '08 · Your turn',
      heading: 'Wait 60 seconds for stragglers',
      stand: 'Suppose the pipeline keeps an event only if its skew is at most 60 seconds, and drops the rest. Skews: 1, 1, 3, 2, 1, 5, 50, 230, 2.',
      question: {
        step: 0,
        prompt: 'How many of the 9 events would a 60-second wait drop?',
        options: [
          { text: 'None: every event arrives in the end.', correct: false,
            why: 'They all arrive, but event 7 arrives 230 seconds after it happened, after the 60-second wait is over.' },
          { text: 'One: only event 7, at 230 seconds.', correct: true,
            why: 'Every other skew is 50 or less. Only 230 is more than 60.' },
          { text: 'Two: event 7, and event 6 at 50 seconds.', correct: false,
            why: 'Fifty seconds is within a 60-second wait, so event 6 is kept.' }
        ]
      },
      cards: [
        { step: 1, title: 'Decided by one comparison', html: '<p>230 &gt; 60, so event 7 is dropped and 8 of 9 events are kept. What decided it was one comparison against a number a person typed.[[src:mem]]</p>' }
      ],
      narration: [
        'Fourth question. Suppose the pipeline keeps an event only if its skew is at most 60 seconds. How many of the 9 events would it drop? Choose an answer.',
        'One: event 7. Every other skew is 50 or less. So 8 of 9 events are kept. And notice what decided it: one comparison against a number a person typed in. Now watch both choices of wait.'
      ]
    },

    /* ---------- 9 · two waits, animated ---------- */
    {
      title: 'Wait', layout: 'array',
      eyebrow: '09 · Watch two different waits applied to every event',
      heading: 'Wait 60 seconds, or wait 230',
      stand: 'Each event is kept if its skew is at most the wait, and dropped otherwise.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'skew', values: SKEW },
          { label: 'wait 60', values: keptAt(60) },
          { label: 'wait 230', values: keptAt(230) }
        ],
        meters: ['events checked, wait 60', 'dropped, wait 60', 'events checked, wait 230', 'dropped, wait 230'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'match', match: 'dropped', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'dropped', readMeter: 2, resultMeter: 3, speed: 300 }
        ]
      },
      cards: [
        { step: 2, title: 'Completeness is available', html: '<p>The same rule with a wait of 230 keeps everything. It was never a question of a cleverer method — only of how long to wait.[[src:mem]]</p>' },
        { step: 3, title: 'But 230 is hindsight', html: '<p>230 is exactly the largest skew in the data: a number you can only work out once every event has already arrived.[[src:mem]]</p>' }
      ],
      narration: [
        'Here are the nine skews. Under them, the 60-second wait checks each event in turn. Watch the pointer: one event dropped, event 7.',
        'Now the same rule with a wait of 230 seconds. Every event is kept: zero dropped.',
        'So completeness is available. It was never a question of a cleverer method. It is purely a question of how long to wait.',
        'But 230 is exactly the largest skew in the data, a number you can only work out once every event has already arrived. In a live pipeline you choose the wait before seeing it.'
      ]
    },

    /* ---------- 10 · the bill ---------- */
    {
      title: 'Bill', layout: 'cards', defines: ['window', 'latency'],
      eyebrow: '10 · What the longer wait costs',
      heading: 'Every answer pays the wait',
      stand: 'The chapter groups the 9 events into 4 windows, 2-minute stretches of event time. Each window’s answer waits before it is shown.',
      bars: { step: 0, label: 'Total waiting across the 4 windows, in seconds', items: [
        { label: 'wait 60', value: WINDOWS * 60 }, { label: 'wait 230', value: WINDOWS * 230 } ] },
      columns: 3,
      cards: [
        { step: 1, title: 'Per answer', html: '<p>230 − 60 = <b>170</b> seconds more on <b>every</b> answer this pipeline ever produces, to stop losing 1 event in 9.[[src:why]]</p>' },
        { step: 1, title: 'In total', html: '<p>4 × 60 = <b>240</b> seconds becomes 4 × 230 = <b>920</b>: <b>680</b> seconds of added delay.[[src:mem]]</p>' },
        { step: 2, title: 'The exchange rate', html: '<p>Completeness against <b>latency</b>, the wait before an answer appears. The rate is set by the data, not by cleverness.[[src:why]]</p>' }
      ],
      narration: [
        'Now the bill. The chapter groups the events into 4 windows, each a 2-minute stretch of event time, and each window’s answer waits before it is shown. Waiting 60 seconds costs 240 in total; waiting 230 costs 920.',
        'That is 170 seconds more on every answer the pipeline ever produces, and 680 seconds more across the four windows, to stop losing 1 event in 9.',
        'The wait before an answer appears is called latency. So this is the exchange rate between completeness and latency, and it is set by the data, not by how clever the pipeline is.'
      ]
    },

    /* ---------- 11 · question: is it worth it ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: '170 seconds on every answer, to keep 1 event in 9',
      stand: 'An engineer is asked to choose the wait: 60 seconds, or 230.',
      question: {
        step: 0,
        prompt: 'Who can say whether the extra 170 seconds is worth it?',
        options: [
          { text: 'The engineer, by working it out from the data.', correct: false,
            why: 'The data gives both sides of the trade, 170 seconds and 1 event, but not which matters more.' },
          { text: 'Nobody: always choose the shorter wait.', correct: false,
            why: 'For some numbers, like a bill, losing an event is worse than any delay.' },
          { text: 'Whoever reads the number, and what they do with it.', correct: true,
            why: 'It is a product decision dressed as an engineering one: it depends on who uses the answer.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A product decision', html: '<p>Nobody can derive whether 170 seconds on every answer is worth 1 event in 9. It depends on who reads the number.[[src:when]]</p>' },
        { step: 2, title: 'And it is chosen blind', html: '<p>In a live pipeline the wait is picked before the worst skew is seen, so it will be wrong in the one direction you cannot measure.[[src:when]]</p>' }
      ],
      narration: [
        'Fifth question. An engineer must choose the wait, 60 seconds or 230. Who can say whether the extra 170 seconds on every answer is worth it? Choose an answer.',
        'Whoever reads the number, and what they do with it. The data prices both sides of the trade, but cannot say which side matters more. It is a product decision wearing an engineering costume.',
        'And it is chosen blind. The 230 was only knowable after event 7 arrived. A live pipeline picks its wait before seeing its worst skew.'
      ]
    },

    /* ---------- 12 · question: the honest response ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '12 · Your turn',
      heading: 'If any wait can be wrong, what then?',
      stand: 'Whatever wait is chosen, a straggler can one day arrive later than it.',
      question: {
        step: 0,
        prompt: 'What is the honest way to design for that?',
        options: [
          { text: 'Keep raising the wait until no event is ever dropped.', correct: false,
            why: 'Every raise slows every answer, and the next straggler can still beat it.' },
          { text: 'Treat a late event as a normal case the pipeline handles.', correct: true,
            why: 'The design response is not a better guess. A late event becomes a case with its own handling.' },
          { text: 'Count by processing time, so nothing is ever late.', correct: false,
            why: 'Nothing is late then, but the counts answer a different question: 8 at 12:00, not 12.' }
        ]
      },
      cards: [
        { step: 1, title: 'Handle it, do not prevent it', html: '<p>The answer to a guess that can be wrong is not a better guess. It is to make late data a case you handle, rather than one you try to prevent. Later chapters build that.[[src:when]]</p>' }
      ],
      narration: [
        'Whatever wait is chosen, some straggler can one day arrive later than it. What is the honest way to design for that? Choose an answer.',
        'Treat a late event as a normal case that the pipeline handles. Raising the wait only slows every answer. The response to a guess that can be wrong is not a better guess. Later chapters build the handling.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'One last check',
      stand: 'The chapter’s own quiz question. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Why do event time and processing time drift apart?',
        options: [
          { text: 'Because the two clocks are set to different time zones.', correct: false,
            why: 'Both times here are on the same clock. The gap comes from the journey, not the zone.' },
          { text: 'Because of network delay, queueing, overload and replays.', correct: true,
            why: 'Everything between the device and the pipeline can hold an event up, by an amount nobody controls.' },
          { text: 'Because the pipeline’s clock runs a little slow.', correct: false,
            why: 'A slow clock would shift every event alike. Here eight events take seconds and one takes 230.' }
        ]
      },
      cards: [
        { step: 1, title: 'The chapter’s answer', html: '<p>The gap is caused by everything between the producer and the processor: network, queues, and replays.[[src:quiz]]</p>' }
      ],
      narration: [
        'One last question, from the chapter’s own quiz. Why do event time and processing time drift apart? Choose an answer.',
        'Because of network delay, queueing, overload and replays: everything between the user’s device and the pipeline. That is why eight events take seconds and event 7 takes 230.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Two clocks, one guess, and a price',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> / <b>processing time</b>', 'When it happened, for questions about users (12 at 12:00); when it was seen, for questions about the pipeline (8).[[src:when]]'] },
          { step: 1, cells: ['<b>Skew</b>', 'Processing time minus event time. Mostly seconds; event 7 is a straggler at 230.[[src:why]]'] },
          { step: 2, cells: ['<b>Watermark</b>', 'A guess that nothing earlier is still coming: highest seen minus 60. It said 200 when event 7, at 50, arrived.[[src:mem]]'] },
          { step: 3, cells: ['<b>The price</b>', 'Wait 230 instead of 60: 170 seconds on every answer, 680 across 4 windows, to keep 1 event in 9.[[src:mem]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>Does the input end at all? A file that ends, a stream cut into chunks, and a true stream group the same 9 events differently. Part 3 compares all three.</p>' },
      narration: [
        'To recap. Event time is when something happened; use it for questions about users, like 12 clicks at 12:00. Processing time is when the pipeline saw it; use it for questions about the pipeline.',
        'Skew is processing time minus event time. It is mostly a few seconds, with a long tail: event 7 is a straggler at 230.',
        'A watermark is a guess that nothing earlier is still coming. The usual rule, highest event time seen minus 60, said 200 when event 7, from second 50, arrived. Nothing noticed.',
        'Waiting 230 instead of 60 costs 170 seconds on every answer, 680 across four windows, to keep 1 event in 9. Next, part 3 asks whether the input ends at all.'
      ]
    }
  ]
};
