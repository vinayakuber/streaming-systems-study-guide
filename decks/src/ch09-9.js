// Chapter 9, Part 9 — the chapter's two "Interview Questions", explored in depth, then the
// chapter quiz and a recap of the whole chapter. Each interview question is told as a story,
// probed from several sides (what goes wrong and why, which structure, what each step does,
// what breaks if a step is skipped, the same question with other numbers), and its code
// snippet is built line by line, a question before each line. The snippet lines come from the
// chapter source (content/ch09-*.js) through _prog.js, addressed by content, never retyped.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch09';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const Q1_BOUND = Q1.line('bound 60 s -> release at 12:03:10');
const Q1_HOLD = Q1.line('join wm min(12:03:05, 12:03:20)');
const Q1_EMIT = Q1.line('id 8 lifts clicks to 12:08:00');
const Q1_LATE = Q1.line('late impression 7 @ 12:00:50');
const Q2_KEY = [Q2.at('is a seed row; the user id'), Q2.at('illustration OUTSIDE')];
const Q2_PROBE = Q2.line('probe user_table[42]');
const Q2_NOWAIT = Q2.line('no window, no wait');

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS, J = seed.LAG, clock = s => seed.hhmmss(s);
const sideWm = (k, i) => { const seen = E.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - J : null; };
const joinWm = i => (['a', 'b'].some(k => sideWm(k, i) === null) ? null : Math.min(sideWm('a', i), sideWm('b', i)));
if (clock(E[3].et) !== '12:02:10' || clock(E[2].et) !== '12:01:30' || clock(E[3].et + J) !== '12:03:10'
  || clock(sideWm('a', 7)) !== '12:03:05' || clock(sideWm('b', 7)) !== '12:03:20' || clock(sideWm('a', 8)) !== '12:08:00'
  || clock(joinWm(8)) !== '12:03:20' || clock(E[7].et) !== '12:00:50' || clock(E[7].pt) !== '12:04:40'
  || clock(E[4].et + J) !== '12:05:05' || E.length !== 9 || J !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Joins Interview Drill',
  eyebrow: 'Streaming · Ch 9 · Part 9',
  ...shared,
  jargon: ['impression', 'event', 'stream', 'attribution', 'event time', 'processing time', 'join', 'time bound',
    'windowed join', 'watermark', 'emit', 'late', 'retraction', 'allowed lateness', 'buffer', 'table', 'temporal join',
    'join key', 'as of', 'garbage collection'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    hard:  section(CH, 'Why a stream-stream join needs a time bound, and what it still cannot deliver', 'Chapter 9 · why a join needs a time bound'),
    size:  section(CH, 'When a windowed join is the right tool, and how to size it', 'Chapter 9 · how to size a join'),
    kinds: section(CH, 'Why these are bounded by different things, and why confusing them is costly', 'Chapter 9 · bounded by different things'),
    use:   section(CH, 'When to use each, and why the obvious fixes make it worse', 'Chapter 9 · when to use each'),
    corr:  section(CH, 'Why a correct windowed join still fails to deliver most of its matches here', 'Chapter 9 · why a correct join under-delivers'),
    q1:    section(CH, 'Q1', 'Chapter 9 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 9 · interview question 2'),
    quiz:  section(CH, 'Quiz', 'Chapter 9 · quiz'),
    kc:    section(CH, 'Key Concepts', 'Chapter 9 · key concepts')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'event', 'stream', 'attribution', 'table'],
      eyebrow: '01 · Chapter 9 · Part 9 · the interview questions',
      heading: 'Two interview questions about joining streams, asked from every side',
      hero: { step: 0, text: 'A website shows adverts. Each showing is an <b>impression</b>; each click, a click. A record of either is an <b>event</b>, and each kind arrives as a <b>stream</b> that never ends. Crediting a click to the advert that led to it is <b>attribution</b>. A <b>table</b>, by contrast, holds the current value of each thing it tracks.[[src:q1]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in the chapter’s example' },
        { step: 1, value: 60, suffix: ' s', label: 'how close a click and impression must be[[src:hard]]' },
        { step: 2, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' }
      ],
      cardsLabel: 'The two questions',
      cards: [
        { step: 3, n: 1, title: 'Credited to the wrong advert', text: 'A pipeline answers too early, before a delayed impression arrives.' },
        { step: 4, n: 2, title: 'A value that changes over time', text: 'Each click needs the user’s subscription tier as it was then.' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'A website shows adverts. Each showing is an impression, each click a click. A record of either is an event, and each kind arrives as a stream. Crediting a click to the advert that led to it is attribution.',
        'The chapter’s example has 9 events, and a click and an impression belong together when they happened within 60 seconds of each other.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then the 5 questions of the chapter quiz.',
        'Question 1: an attribution pipeline credits some clicks to the wrong advert, because it answers before a delayed impression arrives.',
        'Question 2: each click must be enriched with the user’s subscription tier, which changes over time. You will answer first, every time.'
      ]
    },

    /* ---------- 2 · the events and the two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'In the order the system received them. Times are clock times just after noon.',
      table: {
        columns: ['Event', 'Kind', 'Happened at', 'Seen at'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`${e.id}`, e.key === 'a' ? 'click' : 'impression', [2, 3, 7].includes(i) ? `<b>${clock(e.et)}</b>` : clock(e.et), [2, 3, 7].includes(i) ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click or showing happened.</li><li><b>Processing time</b> — when the system received it.</li><li>Impression 7 happened at 12:00:50 but was seen at 12:04:40.[[src:q1]]</li></ul>' },
      narration: [
        'Here are the events, in the order the system received them. Impression 2 happened at 12:01:30; click 3 at 12:02:10, seen two seconds later.',
        'Impression 6 happened at 12:03:40, but arrived after impression 5, which happened later.',
        'Impression 7 happened at 12:00:50, but the system did not see it until 12:04:40.',
        'So each event has two clocks: when it happened, its event time, and when the system received it, its processing time. Attribution must go by event time.'
      ]
    },

    /* ---------- 3 · Q1: what goes wrong ---------- */
    {
      title: 'Wrong', layout: 'ask', defines: ['join'],
      eyebrow: '03 · Interview question 1 · what goes wrong, and why',
      heading: 'Matches published too soon',
      stand: 'An attribution pipeline pairs clicks with impressions, and publishes each click’s answer as soon as it finds one. Some clicks end up credited to the wrong advert.',
      question: {
        step: 0,
        prompt: 'Why are some clicks credited to the wrong advert?',
        options: [
          { text: 'A better match was still on its way when the answer went out.', correct: true,
            why: 'Impressions can arrive minutes after they happen. Answering at once can only use what has arrived.' },
          { text: 'The clicks themselves were recorded with the wrong times.', correct: false,
            why: 'The clicks carry their own correct times. The problem is impressions that have not arrived yet.' },
          { text: 'The pipeline compares too few pairs of rows to be accurate enough.', correct: false,
            why: 'It compares every pair it holds. What it lacks is the rows that have not arrived.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A join', html: '<p>Pairing rows of two inputs that belong together is a <b>join</b>. On streams, the open question is <b>when</b> a click’s pairs are complete.[[src:hard]]</p>' },
        { step: 2, title: 'The interviewer’s question', html: '<p>How do you join two event streams correctly when events can arrive out of order?[[src:q1]]</p>' }
      ],
      narration: [
        'Interview question 1. A pipeline pairs clicks with impressions and publishes each click’s answer as soon as it finds one. Why are some clicks credited to the wrong advert? Choose an answer.',
        'A better-matching impression was still on its way. Pairing rows of two inputs that belong together is a join, and on streams the hard question is when a click’s pairs are complete.',
        'So the interviewer asks: how do you join two event streams correctly when events can arrive out of order? Let us build the chapter’s answer, one line at a time.'
      ]
    },

    /* ---------- 4 · Q1: the bound — snippet line 1 ---------- */
    {
      title: 'Bound', layout: 'code', defines: ['time bound', 'windowed join'],
      eyebrow: '04 · Interview question 1 · which structure · the snippet, line 1',
      heading: 'A time bound gives each click a deadline',
      stand: 'Click 3 happened at 12:02:10. Impression 2 happened at 12:01:30. A pair counts when the two are within 60 seconds.',
      question: { step: 0, prompt: 'Up to what event time could a partner for click 3 still exist?', options: [
        { text: '12:03:10: 60 seconds after the click happened.', correct: true, why: 'Anything later is more than 60 seconds away, so after that the click’s pairs are fixed.' },
        { text: '12:03:12: 60 seconds after the click arrived.', correct: false, why: 'Pairs are judged by when things happened, not by when they arrived.' },
        { text: 'There is no limit on a stream.', correct: false, why: 'The 60-second rule is the limit. It is what lets the join ever finish a click.' } ] },
      code: Q1.build({ add: [Q1_BOUND], step: 1 }),
      cards: [ { step: 2, title: 'Time bound, windowed join', html: '<p>The 60-second rule is a <b>time bound</b>, and pairing two streams within one is a <b>windowed join</b>. Click 3 may be released once nothing before 12:03:10 can still arrive.[[src:q1]]</p>' } ],
      narration: [
        'First, which structure. Click 3 happened at 12:02:10. Up to what event time could a partner for it still exist? Choose an answer.',
        '12:03:10, 60 seconds after it happened. Here is the first line of the chapter’s snippet: click 3, impression 2, a bound of 60 seconds, release at 12:03:10.',
        'The 60-second rule is called a time bound, and pairing two streams within one is a windowed join. The click may be released once nothing before 12:03:10 can still arrive.'
      ]
    },

    /* ---------- 5 · Q1: hold — snippet line 2 ---------- */
    {
      title: 'Hold', layout: 'code', defines: ['watermark'],
      eyebrow: '05 · Interview question 1 · the snippet, line 2',
      heading: 'Two promises: release, or hold?',
      stand: 'Each stream promises that nothing older than its latest event time minus 60 seconds will still arrive. Before event 8: clicks promise 12:03:05, impressions 12:03:20.',
      question: { step: 0, prompt: 'Click 3 needs the join past 12:03:10. May it be released?', options: [
        { text: 'No: the smaller promise, 12:03:05, has not passed it.', correct: true, why: 'A click from before 12:03:10 could still arrive. Only time settled on both sides counts.' },
        { text: 'Yes: impressions have promised 12:03:20, past the deadline.', correct: false, why: 'The click stream has not promised that far. The join may only trust what both promise.' },
        { text: 'Yes: impression 2, its partner, has already been found.', correct: false, why: 'Finding one partner says nothing about others still in flight.' } ] },
      code: Q1.build({ before: [Q1_BOUND], add: [Q1_HOLD], step: 1 }),
      cards: [ { step: 2, title: 'Watermark', html: '<p>Each promise is a stream’s <b>watermark</b>. The join’s watermark is the smaller: min(12:03:05, 12:03:20) = 12:03:05, below 12:03:10, so hold.[[src:q1]]</p>' } ],
      narration: [
        'Before event 8, clicks promise 12:03:05 and impressions 12:03:20. Click 3 needs the join past 12:03:10. May it be released? Choose an answer.',
        'No. Here is the second line: the join takes the smaller of the two promises, 12:03:05, which is below 12:03:10, so it holds.',
        'Each stream’s promise is called its watermark, and the join’s watermark is the smaller of the two. Whichever stream is slower decides when a click is final.'
      ]
    },

    /* ---------- 6 · Q1: emit — snippet line 3 ---------- */
    {
      title: 'Emit', layout: 'code', defines: ['emit'],
      eyebrow: '06 · Interview question 1 · the snippet, line 3',
      heading: 'Event 8 moves the clicks’ promise',
      stand: 'Event 8 is a click at 12:09:00. The clicks now promise 12:08:00; the impressions still promise 12:03:20.',
      question: { step: 0, prompt: 'What is the join’s watermark now, and what happens to click 3?', options: [
        { text: '12:03:20, past 12:03:10: the pair is published.', correct: true, why: 'The smaller of 12:08:00 and 12:03:20 is 12:03:20, and that passes the deadline.' },
        { text: '12:08:00: every waiting click is published at once.', correct: false, why: 'The join never takes the larger promise. The impressions have only reached 12:03:20.' },
        { text: 'Still 12:03:05: click 3 keeps on waiting for now.', correct: false, why: 'Event 8 raised the clicks’ promise, so the smaller one is now the impressions’ 12:03:20.' } ] },
      code: Q1.build({ before: [Q1_BOUND, Q1_HOLD], add: [Q1_EMIT], step: 1 }),
      cards: [ { step: 2, title: 'Emit', html: '<p>Publishing a result is <b>emitting</b> it. Click 3 with impression 2 is emitted after event 8, correct the first time.[[src:q1]]</p>' } ],
      narration: [
        'Event 8, a click at 12:09:00, lifts the clicks’ promise to 12:08:00. What is the join’s watermark now, and what happens to click 3? Choose an answer.',
        '12:03:20, the impressions’ promise, which is past 12:03:10. Here is the third line: the clicks jump ahead, the smaller promise passes the deadline, and the pair is published.',
        'Publishing a result is called emitting it. Click 3 with impression 2 is emitted after event 8, and it is right the first time.'
      ]
    },

    /* ---------- 7 · Q1: the late row — snippet line 4 ---------- */
    {
      title: 'Late', layout: 'code', defines: ['late', 'retraction'],
      eyebrow: '07 · Interview question 1 · the snippet, line 4',
      heading: 'A late impression contradicts a published answer',
      stand: 'After event 5 the join published “click 0: no match”. Then impression 7 arrives at 12:04:40; it happened at 12:00:50, within 60 seconds of click 0.',
      question: { step: 0, prompt: 'What must the pipeline now send downstream?', options: [
        { text: 'Take back the “no match”, then send click 0 with impression 7.', correct: true, why: 'The old answer must be withdrawn and the right one given, or readers keep the wrong one.' },
        { text: 'Only the new pair, and leave the old “no match” exactly where it is.', correct: false, why: 'Then the two answers contradict each other, and a reader may have acted on the first.' },
        { text: 'Nothing, because once published an answer is final.', correct: false, why: 'Then click 0 is never credited, although a real impression led to it.' } ] },
      code: Q1.build({ before: [Q1_BOUND, Q1_HOLD, Q1_EMIT], add: [Q1_LATE], step: 1 }),
      cards: [ { step: 2, title: 'Late, and retraction', html: '<p>An event arriving after the watermark has passed it is <b>late</b>. Withdrawing a published result is a <b>retraction</b>. Here a <b>negative</b> is retracted.[[src:q1]]</p>' } ],
      narration: [
        'After event 5 the join published click 0, no match. Then impression 7 arrives; it happened within 60 seconds of click 0. What must the pipeline send downstream? Choose an answer.',
        'Take back the no match, then send click 0 with impression 7. Here is the last line: late impression 7, retract click 0’s no match, emit the pair.',
        'An event arriving after the watermark has passed it is called late, and withdrawing a published result is a retraction. Notice what is retracted here: a negative.'
      ]
    },

    /* ---------- 8 · Q1: what breaks if a step is skipped ---------- */
    {
      title: 'Skip', layout: 'ask', defines: ['allowed lateness', 'buffer', 'garbage collection'],
      eyebrow: '08 · Interview question 1 · what breaks if you skip a step',
      heading: 'Drop click 0 the moment it is published',
      stand: 'To save memory, an engineer frees each click from the join’s memory as soon as its answer is emitted.',
      question: {
        step: 0,
        prompt: 'What happens when impression 7 arrives at 12:04:40?',
        options: [
          { text: 'It finds no click 0, so “no match” stands for ever.', correct: true,
            why: 'A retraction needs both rows. With click 0 gone, the correction can never be made.' },
          { text: 'It is paired with click 0 using the published answer.', correct: false,
            why: 'The published answer says only “no match”. It holds nothing to test impression 7 against.' },
          { text: 'It waits in memory until click 0 arrives a second time.', correct: false,
            why: 'Click 0 will not arrive again. Each event arrives once.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Allowed lateness', html: '<p>Keeping rows past the watermark so late rows can still match is <b>allowed lateness</b>. Skip it and every late correction is lost.[[src:q1]]</p>' },
        { step: 1, title: 'Buffer', html: '<p>The rows a join keeps waiting are its <b>buffer</b>: about arrival rate × 60 seconds per side, both sides added. At an assumed 10 thousand rows a second per side, 600 thousand per side.[[src:size]]</p>' },
        { step: 2, title: 'Garbage collection', html: '<p>Dropping a row once the watermark passes the window plus the allowed lateness is <b>garbage collection</b>. Earlier is wrong; never is a leak.[[src:corr]]</p>' }
      ],
      narration: [
        'What breaks if a step is skipped? An engineer frees each click from memory as soon as its answer is emitted. What happens when impression 7 arrives? Choose an answer.',
        'It finds no click 0, so the no match stands, wrongly, for ever. Keeping rows past the watermark so late rows can still match is called allowed lateness. The kept rows form the buffer.',
        'Rows may be dropped only once the watermark passes the window plus the allowed lateness; that is called garbage collection. Earlier is wrong, and never is a memory leak.'
      ]
    },

    /* ---------- 9 · Q1: other numbers ---------- */
    {
      title: 'Vary', layout: 'ask',
      eyebrow: '09 · Interview question 1 · the same question, other numbers',
      heading: 'Now click 4, at 12:04:05',
      stand: 'Click 4 happened at 12:04:05 and pairs with impressions 5 and 6. The impressions stop arriving after event 7, so their promise stays at 12:03:20.',
      question: {
        step: 0,
        prompt: 'When is click 4 released?',
        options: [
          { text: 'Never: the join stops at 12:03:20, short of 12:05:05.', correct: true,
            why: 'The smaller promise is stuck because the impression stream went quiet. Click 4 waits for ever.' },
          { text: 'After event 8, at the same moment as click 3 is released.', correct: false,
            why: 'Event 8 lifts the join only to 12:03:20, enough for click 3 but not for 12:05:05.' },
          { text: 'At once, because it already has both of its partners.', correct: false,
            why: 'Having partners is not enough; the join must know no more can come. It never learns that.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: '1, 2 and 2', html: '<p>Of the 5 true pairs: 1 right first time, 2 after a retraction, 2 never published. A correct design, and only 20% right first time.[[src:corr]]</p>' },
        { step: 2, title: 'Not fixed by a setting', html: '<p>A wider window or more lateness grows memory and does not move the stuck promise. Only declaring the quiet stream finished does, at the price of correctness.[[src:corr]]</p>' }
      ],
      narration: [
        'The same question with other numbers. Click 4 happened at 12:04:05; the impressions stop after event 7, so their promise stays at 12:03:20. When is click 4 released? Choose an answer.',
        'Never. It needs the join past 12:05:05. So of the 5 true pairs, 1 is right first time, 2 come after a retraction, and 2 are never published, from a correct design.',
        'And no setting fixes it. A wider window or more lateness only grows memory. Only declaring the quiet stream finished moves the promise, and that gives up correctness.'
      ]
    },

    /* ---------- 10 · Q2: the story, and which join ---------- */
    {
      title: 'Tier', layout: 'ask', defines: ['temporal join'],
      eyebrow: '10 · Interview question 2 · the story, and which join',
      heading: 'Each click needs the user’s tier, as it was then',
      stand: 'A click stream must be enriched with the user’s subscription tier before it is counted. The tier is kept per user, and changes from time to time.',
      question: {
        step: 0,
        prompt: 'What kind of join fits a click stream and a per-user tier?',
        options: [
          { text: 'Look each click up in the tiers as they stood at its time.', correct: true,
            why: 'The tiers are settled state, not a stream of new events. One lookup answers each click, with no wait.' },
          { text: 'Pair the clicks with any tier changes within 60 seconds of them.', correct: false,
            why: 'A tier set months ago still applies. A time window would miss it and wait for nothing.' },
          { text: 'Wait for both watermarks, then pair clicks with tiers.', correct: false,
            why: 'The tiers are not a stream of events with a watermark. That wait would only add delay.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A table, not a stream', html: '<p>A table holds the current value of each thing it tracks: here, one tier per user. It changes, but slowly.[[src:q2]]</p>' },
        { step: 2, title: 'Temporal join', html: '<p>Enriching each stream row with the table as it stood at that row’s event time is a <b>temporal join</b>. No window, no wait.[[src:kinds]]</p>' }
      ],
      narration: [
        'Interview question 2. Each click must be enriched with the user’s subscription tier, which changes from time to time. What kind of join fits? Choose an answer.',
        'Look each click up in the tiers, as they stood at the click’s event time. The tiers are a table: the current value of each thing it tracks, here one tier per user.',
        'Enriching each stream row with the table as it stood at that row’s event time is called a temporal join. No window, and no wait on a second watermark.'
      ]
    },

    /* ---------- 11 · Q2: the key — snippet lines 1–2 ---------- */
    {
      title: 'Key', layout: 'code', defines: ['join key'],
      eyebrow: '11 · Interview question 2 · the snippet, lines 1 and 2',
      heading: 'Which row of the table does a click read?',
      stand: 'The chapter’s data has two streams and no table, so the snippet says plainly that its tier table is an illustration.',
      question: { step: 0, prompt: 'Which value takes a click to its row in the tier table?', options: [
        { text: 'The user the click belongs to.', correct: true, why: 'The table holds one tier per user, so the click’s user picks the row.' },
        { text: 'The click’s event time.', correct: false, why: 'Time picks which version of the row, not which row. The user picks the row.' },
        { text: 'The advert that was clicked.', correct: false, why: 'Tiers belong to users, not adverts. The advert says nothing about the tier.' } ] },
      code: Q2.build({ add: [Q2_KEY], step: 1 }),
      cards: [ { step: 2, title: 'Join key', html: '<p>The value that takes a row to its partner is the <b>join key</b>: here, the user id. The snippet is honest that the user and the table lie outside the chapter’s dataset.[[src:q2]]</p>' } ],
      narration: [
        'First, which row does a click read? Which value takes a click to its row in the tier table? Choose an answer.',
        'The user the click belongs to. Here are the first two lines of the snippet: click 3 is a real row of the dataset, but the user and the tier table are an illustration outside it.',
        'The value that takes a row to its partner is called the join key; here, the user id. The chapter’s own data has two streams and no table, and the snippet says so.'
      ]
    },

    /* ---------- 12 · Q2: as of — snippet lines 3–4 ---------- */
    {
      title: 'AsOf', layout: 'code', defines: ['as of'],
      eyebrow: '12 · Interview question 2 · the snippet, lines 3 and 4',
      heading: 'The version valid then, not now',
      stand: 'Click 3 happened at 12:02:10. Suppose the user’s tier changed later that day.',
      question: { step: 0, prompt: 'Which tier should click 3 be enriched with?', options: [
        { text: 'The tier that was valid at 12:02:10.', correct: true, why: 'The click happened then. A later change did not apply to it.' },
        { text: 'The tier the user has now.', correct: false, why: 'That is a different question. A later change would rewrite history.' },
        { text: 'The first tier that the user ever had.', correct: false, why: 'That is out of date unless nothing ever changed. Only the version at the click’s time is right.' } ] },
      code: Q2.build({ before: [Q2_KEY], add: [Q2_PROBE, Q2_NOWAIT], step: 1 }),
      cards: [ { step: 2, title: 'As of, and its price', html: '<p>Reading a table <b>as of</b> 12:02:10 means its value at that moment. So the table must keep its history. Then the click is enriched at once: no window, no wait on a second watermark.[[src:q2]]</p>' } ],
      narration: [
        'Click 3 happened at 12:02:10, and suppose the user’s tier changed later that day. Which tier should click 3 be enriched with? Choose an answer.',
        'The tier valid at 12:02:10. Here are the last two lines: look up user 42 in the tier table as of 12:02:10, get gold, the version valid then, not now. Then click 3 carries gold, with no window and no wait.',
        'Reading a table as of a time means its value at that moment, so the table must keep its history. Without it, a later change would silently rewrite old answers.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'Why a time bound?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Why do stream-stream joins need a time bound?',
        options: [
          { text: 'To save processing power on the machine.', correct: false,
            why: 'The bound is about meaning and memory, not about saving effort.' },
          { text: 'Two unbounded streams have no natural join boundary.', correct: true,
            why: 'Without a bound, a partner could always still arrive, so the join would buffer for ever.' },
          { text: 'To create the watermarks that the join relies on to finish.', correct: false,
            why: 'Watermarks come from the streams. The bound uses them; it does not create them.' },
          { text: 'To make each answer reach readers sooner.', correct: false,
            why: 'A bound often means waiting longer. It exists so that an answer can be final at all.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Without a time bound, a stream-stream join would buffer for ever. The bound makes the memory finite and the question defined.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. Why do stream-stream joins need a time bound? Choose an answer.',
        'Two unbounded streams have no natural join boundary. Without a bound, a partner could always still arrive, so the join would buffer for ever.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'What is a windowed join?',
      stand: 'Think of click 3 and impression 2, 40 seconds apart.',
      question: {
        step: 0,
        prompt: 'What is a windowed join?',
        options: [
          { text: 'A lookup of each stream row in a table.', correct: false,
            why: 'That is a temporal join, the other kind.' },
          { text: 'Pairing rows within a time window of each other.', correct: true,
            why: 'Click 3 and impression 2 pair because they are 40 seconds apart, inside 60.' },
          { text: 'A join that keeps no state in memory at all.', correct: false,
            why: 'It must buffer rows until both watermarks pass. State is unavoidable.' },
          { text: 'A batch join over two lists that are finished.', correct: false,
            why: 'A batch join finishes on its own. A windowed join exists because streams never do.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A windowed join matches rows whose time attributes fall within a window of each other. The window bounds the buffer; the watermarks bound the wait.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. What is a windowed join? Choose an answer.',
        'A join that pairs rows within a time window of each other, like click 3 and impression 2, 40 seconds apart. The window bounds the buffer, and the watermarks bound the wait.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'What is a temporal join?',
      stand: 'Think of click 3 and the tier valid at 12:02:10.',
      question: {
        step: 0,
        prompt: 'What is a temporal join?',
        options: [
          { text: 'A join of two streams within a time window.', correct: false,
            why: 'That is the windowed join.' },
          { text: 'Looking rows up in a table as of their event time.', correct: true,
            why: 'Click 3 gets the tier valid at 12:02:10, not the one valid now.' },
          { text: 'A join that needs no key to find its partner.', correct: false,
            why: 'It needs a key to pick the table’s row; here, the user id.' },
          { text: 'A join of two whole tables, with no stream involved at all.', correct: false,
            why: 'One side is a stream: each of its rows makes one lookup.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A temporal join probes the table at the join key for the version current at the row’s event time, not the current one.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is a temporal join? Choose an answer.',
        'Enriching a stream with a table as it stood at each event’s time. It probes the table at the join key, for the version current at the row’s event time, not the current one.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'When does a windowed join emit?',
      stand: 'Think of click 3, released only after event 8.',
      question: {
        step: 0,
        prompt: 'When does a windowed join emit a match?',
        options: [
          { text: 'As soon as the first matching row of the other side arrives.', correct: false,
            why: 'Another partner could still be in flight. That is interview question 1’s bug.' },
          { text: 'When both sides’ watermarks pass the join window.', correct: true,
            why: 'Click 3 waited until the smaller watermark, 12:03:20, passed 12:03:10.' },
          { text: 'Once every second, on the system’s clock.', correct: false,
            why: 'The system’s clock says nothing about what is still on its way.' },
          { text: 'Whenever the buffer happens to empty.', correct: false,
            why: 'The buffer empties only after emitting and clean-up, not before.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The join waits until both streams are complete for the window: both watermarks past it.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. When does a windowed join emit a match? Choose an answer.',
        'When both sides’ watermarks pass the join window. Click 3 waited until the smaller watermark, 12:03:20, passed its deadline of 12:03:10.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'How is join state bounded?',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'How is join state bounded?',
        options: [
          { text: 'It is never bounded: it simply keeps growing.', correct: false,
            why: 'Only if clean-up never happens, which is the leak a stalled stream causes.' },
          { text: 'By dropping state past window plus lateness.', correct: true,
            why: 'After that, no partner and no late correction can still arrive for a row.' },
          { text: 'By the speed of the machine that it runs on.', correct: false,
            why: 'Speed sets how fast rows are handled, not how many must be kept.' },
          { text: 'By the number of different users it has seen.', correct: false,
            why: 'A windowed join keeps rows by time, not by user. Time is what bounds it.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>State past the window plus the allowed lateness is garbage-collected, on the same watermark that decides emitting.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. How is join state bounded? Choose an answer.',
        'By dropping state once the watermark passes the window plus the allowed lateness. It runs on the same watermark that decides emitting, so a stalled stream blocks both.'
      ]
    },

    /* ---------- 18 · recap of the chapter ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 9, and its two interview questions',
      heading: 'Bound it, wait for both, retract, or look it up',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Time bound</b>', 'Two streams never finish; 60 seconds gives each click a deadline. 5 true pairs from 20.[[src:hard]]'] },
          { step: 1, cells: ['<b>Question 1 · the windowed join</b>', 'Buffer rows; emit when the smaller watermark passes; retract when a late row contradicts — even a no match.[[src:q1]]'] },
          { step: 1, cells: ['<b>The honest count</b>', '1 right first time, 2 corrected, 2 never — from a correct join, with no error raised.[[src:corr]]'] },
          { step: 2, cells: ['<b>Question 2 · the temporal join</b>', 'Look the row up in a table as of its event time, by its join key. No window, no wait; it needs history.[[src:q2]]'] },
          { step: 3, cells: ['<b>The common bug</b>', 'Windowing a table, or looking up a late stream. Ask: could this side still change an old answer?[[src:use]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>Joining streams is bounding an unbounded match: a window bounds time, a table lookup bounds by key, and the watermark plus state decide when a result is complete.[[src:kc]]</p>' },
      narration: [
        'To recap the chapter. Two streams never finish, so a join needs a time bound. Here 60 seconds gives each click a deadline, and 5 of 20 pairs are true matches.',
        'Question 1, the windowed join: buffer rows, emit when the smaller watermark passes, and retract when a late row contradicts, even a no match. Done correctly, it still delivers 1 on time, 2 corrected and 2 never.',
        'Question 2, the temporal join: look each row up in a table as of its event time, by its join key, with no wait. It needs the table’s history.',
        'And the common bug is choosing the wrong one for the input. In one line: a window bounds time, a lookup bounds by key, and the watermark plus state decide when a result is complete.'
      ]
    }
  ]
};
