// Chapter 8, Part 3 — "Joins and time in SQL", for a viewer who has read nothing before it.
// The two streams (clicks and impressions, the chapter's keys a and b), their two clocks and
// every word are introduced from zero. The viewer answers before each idea; the 5 × 4 candidate
// pairs are swept on screen on each clock, and the two sides' watermarks are worked out event by
// event so the join's minimum can be watched rather than told. Every time comes from the one
// seed (tools/stream_seed.js), and the numbers the narration quotes are asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch08';
const E = seed.EVENTS;
const hh = seed.hhmmss;
const LAG = seed.LAG, J = seed.LAG;
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const PAIRS = CLICKS.flatMap(c => IMPS.map(i => ({ c, i })));
const near = clock => PAIRS.map(p => (Math.abs(p.c[clock] - p.i[clock]) <= J ? 'yes' : 'no'));
const ET = near('et'), PT = near('pt');
const slotOf = (c, i) => PAIRS.findIndex(p => p.c.id === c && p.i.id === i);
const sideWm = (key, upto) => { const s = E.slice(0, upto + 1).filter(e => e.key === key); return s.length ? Math.max(...s.map(e => e.et)) - LAG : null; };
const WA = E.map((_, i) => sideWm('a', i)), WB = E.map((_, i) => sideWm('b', i));
const WJ = E.map((_, i) => (WA[i] === null || WB[i] === null ? null : Math.min(WA[i], WB[i])));
const txt = w => (w === null ? 'none yet' : w < 0 ? 'before 12:00' : hh(w));
const L = seed.LATE[0];
const ET_PAIRS = PAIRS.filter((p, k) => ET[k] === 'yes').map(p => `${p.c.id}–${p.i.id}`);
const PT_PAIRS = PAIRS.filter((p, k) => PT[k] === 'yes').map(p => `${p.c.id}–${p.i.id}`);

if (CLICKS.length !== 5 || IMPS.length !== 4 || PAIRS.length !== 20 || ET_PAIRS.join() !== '0–7,1–7,3–2,4–5,4–6'
  || PT_PAIRS.join() !== '3–2,4–5,4–6,4–7' || hh(WA[8]) !== '12:08:00' || hh(WB[8]) !== '12:03:20' || hh(WJ[8]) !== '12:03:20'
  || WJ[0] !== null || L.id !== 7 || L.pt - L.et !== 230 || Math.abs(CLICKS[0].et - L.et) !== 49 || hh(E[4].pt) !== '12:04:06')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Joining Two Streams',
  eyebrow: 'Streaming · Ch 8 · Part 3',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'JOIN': 'join', 'BETWEEN': 'between', 'TUMBLE': 'tumble' } },
  jargon: ['event', 'stream', 'click', 'impression', 'SQL', 'query', 'event time', 'processing time', 'out of order',
    'join', 'windowed join', 'buffer', 'watermark', 'time attribute', 'lookup'],
  sources: {
    ch:    chapter(CH, 'Chapter 8 on GitHub'),
    join:  section(CH, 'Joins and time in SQL', 'Chapter 8 · joins and time in SQL'),
    why:   section(CH, 'Why a join is where the time decisions cost the most', 'Chapter 8 · why joins cost the most'),
    when:  section(CH, 'When to join streams, when to join against a table, and what to review first', 'Chapter 8 · when to join streams'),
    walk:  section(CH, 'Visual walkthrough — the bound, the minimum, the clock, and the division of labour', 'Chapter 8 · the walkthrough'),
    prog:  section(CH, 'A join has two inputs, so it claims the minimum', 'Chapter 8 · the join as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'click', 'impression', 'SQL', 'query'],
      eyebrow: '01 · Chapter 8 · Part 3',
      heading: 'Which advert showings led to a click? Two streams, matched',
      hero: { step: 0, text: 'A company shows adverts. Each time an advert is shown, a message is sent: an <b>impression</b>. Each time someone clicks one, another message: a <b>click</b>. Every message is an <b>event</b>, and each kind never stops coming: two <b>streams</b>. Analysts want, in <b>SQL</b> — the everyday language for questions about data — a <b>query</b> pairing each impression with the clicks that happened close to it.[[src:join]]' },
      tiles: [
        { step: 1, value: CLICKS.length, label: 'clicks in our example (the chapter’s key a)' },
        { step: 1, value: IMPS.length, label: 'impressions (the chapter’s key b)' },
        { step: 2, value: J, suffix: ' s', label: 'how close in time counts as “together”[[src:why]]' },
        { step: 3, value: 230, suffix: ' s', label: 'how late one impression arrives[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 4, n: 1, title: 'When is a match between two endless streams final?', text: 'Either side may still send one.' },
        { step: 4, n: 2, title: 'Which side does the query wait for?', text: 'One is fast, one is slow.' },
        { step: 4, n: 3, title: 'What does the wrong clock do here?', text: 'Something worse than a wrong total.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A company shows adverts. Each showing sends a message called an impression; each click on an advert sends one called a click. Every message is an event, and each kind keeps coming forever: two streams.',
        'Our example has 5 clicks and 4 impressions. In the chapter they are the two sources of one table, key a and key b, split here into two streams. Analysts want a query, written in SQL, that pairs each impression with the clicks near it.',
        'Near means: the click and the impression happened within 60 seconds of each other, going by when they happened.',
        'But one impression arrives 230 seconds after it happened. By the end of this part you will see what that does to the pairs.',
        'Three questions: when is a match between two endless streams final, which side does the query wait for, and what does the wrong clock do here? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Time', layout: 'table', defines: ['event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'All nine events in the order they arrived: clicks and impressions mixed. Each carries two times.',
      table: {
        columns: ['id', 'kind', 'et · happened at', 'pt · seen'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`${e.id}`, e.key === 'a' ? 'click' : 'impression', i === 6 || i === 7 ? `<b>${hh(e.et)}</b>` : hh(e.et),
            i === 7 ? `<b>${e.pt - e.et} s later</b> · ${hh(e.pt)}` : i === 4 ? `${e.pt - e.et} s later · ${hh(e.pt)}` : `${e.pt - e.et} s later`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> (et) — when it happened.</li><li><b>Processing time</b> (pt) — when the message was seen.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Ids 6 and 7 are.[[src:why]]</li></ul>' },
      narration: [
        'Each event carries two times. The first, et, is when it happened: its event time. The second, pt, is when the message was seen: its processing time. Clicks 0 and 1 were each seen 1 second after they happened.',
        'Click 4 happened at 12:04:05 and was seen at 12:04:06. Impression 5 happened at 12:04:20.',
        'But impression 6 happened at 12:03:40, before impression 5, and arrived after it. And impression 7 happened at 12:00:50 but was seen 230 seconds later, at 12:04:40.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. Impression 7 will matter most in this part.'
      ]
    },

    /* ---------- 3 · question: when does a join end ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['join'],
      eyebrow: '03 · Your turn',
      heading: 'Two finished lists end. Two streams never do.',
      stand: 'Over two finished lists, the query compares every click with every impression, 5 × 4 pairs, and stops. Now both are endless streams.',
      question: {
        step: 0,
        prompt: 'Over two endless streams, when can the query be sure click 0 has met all its matches?',
        options: [
          { text: 'Never, unless it is told how close in time a match must be.', correct: true,
            why: 'Without a limit, an impression from any time could still arrive and match. No row is ever the last candidate.' },
          { text: 'After all 4 impressions so far have been compared with it.', correct: false,
            why: 'Four is only how many have arrived so far. A fifth impression could come at any moment.' },
          { text: 'As soon as one impression has matched it.', correct: false,
            why: 'A click can match several impressions. Stopping at the first would drop the others.' }
        ]
      },
      cards: [
        { step: 1, title: 'A join', html: '<p>Pairing rows from two inputs is a <b>join</b>. Over two finished lists it completes: 5 × 4 candidate pairs, then done.[[src:why]]</p>' },
        { step: 1, title: 'Over two streams', html: '<p>It never completes on its own: either side may still produce a match. Without a time limit the query has no meaning.[[src:why]]</p>' }
      ],
      narration: [
        'First question. Over two finished lists, the query compares every click with every impression, 5 times 4 pairs, and stops. Over two endless streams, when can it be sure click 0 has met all its matches? Choose an answer.',
        'Never, unless it is told how close in time a match must be. Pairing rows from two inputs is called a join. Over two streams it never completes on its own, because either side may still send a match.'
      ]
    },

    /* ---------- 4 · question: what the bound does ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['windowed join', 'buffer'],
      eyebrow: '04 · Your turn',
      heading: 'Within 60 seconds of each other',
      stand: 'So SQL insists on a limit: match a click and an impression only if their event times are within 60 seconds.',
      question: {
        step: 0,
        prompt: 'Apart from defining what a match is, what else does that 60-second limit give the engine?',
        options: [
          { text: 'A point after which it can stop keeping a row and forget it.', correct: true,
            why: 'Once nothing within 60 seconds can still arrive, the row can no longer match anything, so it can be dropped.' },
          { text: 'Faster comparisons, because 60 is a small number.', correct: false,
            why: 'Each comparison costs the same either way. What changes is how long rows must be kept.' },
          { text: 'Nothing more: it only decides which pairs count.', correct: false,
            why: 'Without it, every row of both streams would have to be kept forever in case a match arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'Windowed join', html: '<p>A join that matches rows whose times are within a limit of each other is a <b>windowed join</b>. SQL requires one between two streams.[[src:join]]</p>' },
        { step: 1, title: 'Two jobs at once', html: '<p>The limit ends the wait, <b>and</b> it bounds the <b>buffer</b>: the rows kept waiting for a possible match.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. SQL insists on a limit: match only if the two event times are within 60 seconds. Apart from defining a match, what else does that limit give the engine, the program running the query? Choose an answer.',
        'A point after which it can forget a row. A join with a time limit is a windowed join. The limit does two jobs at once: it ends the wait, and it bounds the buffer, the rows kept waiting for a possible match.'
      ]
    },

    /* ---------- 5 · the pairs, animated ---------- */
    {
      title: 'Pairs', layout: 'array',
      eyebrow: '05 · Watch every candidate pair being tested',
      heading: 'Twenty candidate pairs, five within 60 seconds',
      stand: 'Each slot is one click paired with one impression. The bottom row: did they happen within 60 seconds of each other?',
      array: {
        labelWidth: 150, slotLabel: 'pair',
        rows: [
          { label: 'click id', values: PAIRS.map(p => p.c.id) },
          { label: 'impression id', values: PAIRS.map(p => p.i.id) },
          { label: 'within 60 s, event time?', values: ET }
        ],
        meters: ['pairs tested', 'matches'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 220 },
          { step: 2, do: 'pick', slots: [slotOf(0, 7), slotOf(1, 7)] }
        ]
      },
      cards: [
        { step: 1, title: '5 true matches', html: '<p>Click–impression: ' + ET_PAIRS.join(', ') + '.[[src:prog]]</p>' },
        { step: 2, title: 'The late one matches too', html: '<p>Impression 7 happened at 12:00:50, 49 s after click 0. It truly belongs with clicks 0 and 1, though it arrives 230 s late.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are all 20 candidate pairs: every click, 0, 1, 3, 4 and 8, against every impression, 2, 5, 6 and 7.',
        'Watch each pair being tested on event time: did they happen within 60 seconds? 20 tested, 5 matches: 0 with 7, 1 with 7, 3 with 2, and 4 with 5 and with 6.',
        'Look at the two highlighted pairs. Impression 7 happened 49 seconds after click 0, so it truly belongs with clicks 0 and 1, even though it is the one that arrives 230 seconds late.'
      ]
    },

    /* ---------- 6 · question: which watermark ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['watermark'],
      eyebrow: '06 · Your turn',
      heading: 'Two streams, two estimates of “how far along”',
      stand: 'Each stream has a watermark: the latest event time it has sent, minus 60 s, the engine’s guess that nothing earlier is still coming. At the end, clicks reach 12:08:00 and impressions 12:03:20.',
      question: {
        step: 0,
        prompt: 'Which watermark may the join go by when deciding a match is final?',
        options: [
          { text: 'The lower, 12:03:20: a match could still come from the slower stream.', correct: true,
            why: 'An impression from before 12:08:00 may still be on its way. The join can claim no more than its least complete input.' },
          { text: 'The higher, 12:08:00: the faster stream shows how far time has got.', correct: false,
            why: 'The clicks stream says nothing about impressions still in transit, like impression 7 was.' },
          { text: 'Whichever stream sent the most recent message.', correct: false,
            why: 'Arriving last says nothing about what is still on its way from the other stream.' }
        ]
      },
      cards: [
        { step: 1, title: 'The minimum rule', html: '<p>The join’s watermark is the <b>lower</b> of its two inputs’: 12:08:00 and 12:03:20 give <b>12:03:20</b>. A match is sent when that passes the match’s limit.[[src:why]]</p>' }
      ],
      narration: [
        'Third question. Each stream has a watermark: the latest event time it has sent, minus 60 seconds, the engine’s guess that nothing earlier is still coming. Clicks reach 12:08:00; impressions 12:03:20. Which may the join go by? Choose an answer.',
        'The lower one, 12:03:20. A match could still come from the slower stream, so the join can claim no more than its least complete input. Let us watch both watermarks move.'
      ]
    },

    /* ---------- 7 · the two watermarks, animated ---------- */
    {
      title: 'Mark', layout: 'array',
      eyebrow: '07 · Watch the two watermarks, and the join’s',
      heading: 'The join always sits at the slower side',
      stand: 'Slots are the nine events in arrival order. Each stream’s watermark after that event, and the join’s: the lower of the two.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'clicks watermark', values: WA.map(txt) },
          { label: 'impressions watermark', values: WB.map(txt) },
          { label: 'join watermark', values: WJ.map(txt) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'pick', slots: [0, 1] },
          { step: 2, do: 'pick', slots: [8] }
        ]
      },
      cards: [
        { step: 1, title: 'A silent side blocks everything', html: '<p>After events 0 and 1 only clicks have arrived, so the join makes no claim at all.[[src:prog]]</p>' },
        { step: 2, title: 'At the end', html: '<p>Clicks 12:08:00, impressions 12:03:20: the join claims <b>12:03:20</b>, however fast the clicks run.[[src:why]]</p>' }
      ],
      narration: [
        'Top row: the clicks stream’s watermark after each event. Second row: the impressions stream’s. Notice the clicks race ahead.',
        'Now the join’s watermark, the lower of the two. After events 0 and 1, no impression has arrived at all, so the join makes no claim whatever. A silent side blocks every result.',
        'And at the very end, clicks reach 12:08:00 but impressions only 12:03:20. The join claims 12:03:20, however fast the clicks run.'
      ]
    },

    /* ---------- 8 · question: an idle side ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '08 · Your turn',
      heading: 'One stream goes quiet',
      stand: 'Suppose no more impressions arrive after 12:04:40, while clicks keep pouring in.',
      question: {
        step: 0,
        prompt: 'What happens to the join’s finished matches?',
        options: [
          { text: 'They are held back: the join’s watermark stays stuck at the quiet side’s.', correct: true,
            why: 'The join can only claim the lower watermark, and the quiet side’s never moves again.' },
          { text: 'They keep flowing, driven by the busy clicks stream.', correct: false,
            why: 'A busy side cannot vouch for the quiet one. An old impression might still be on its way.' },
          { text: 'The join switches to using only the clicks stream.', correct: false,
            why: 'It has no such switch. It always takes the lower of its two inputs.' }
        ]
      },
      cards: [
        { step: 1, title: 'Why joins hurt most', html: '<p>A join has two inputs by construction, so one slow or idle side holds back every result, however fast the other is.[[src:why]]</p>' }
      ],
      narration: [
        'Fourth question. Suppose no impressions arrive after 12:04:40, while clicks keep pouring in. What happens to the join’s finished matches? Choose an answer.',
        'They are held back. The join’s watermark is the lower one, and the quiet side’s never moves again. A join always has two inputs, so one slow or idle side holds back every result.'
      ]
    },

    /* ---------- 9 · question: the wrong clock ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['time attribute'],
      eyebrow: '09 · Your turn',
      heading: 'The same join, on the time each message was seen',
      stand: 'Someone writes the join on pt instead of et: within 60 s of when each was seen. Impression 7 happened at 12:00:50 and was seen at 12:04:40.',
      question: {
        step: 0,
        prompt: 'On processing time, which click is impression 7 paired with?',
        options: [
          { text: 'Click 4, seen at 12:04:06, which happened over 3 minutes after it.', correct: true,
            why: 'On the arrival clock, 12:04:40 sits near click 4’s 12:04:06. They never happened close together at all.' },
          { text: 'Clicks 0 and 1, the same as on event time, since the data is unchanged.', correct: false,
            why: 'Those clicks were seen at 12:00:02 and 12:00:04, far from 12:04:40, so on this clock they no longer match.' },
          { text: 'None: a join cannot be written on the time a message was seen.', correct: false,
            why: 'It can. Both columns are valid, and the query runs without any complaint.' }
        ]
      },
      cards: [
        { step: 1, title: 'Time attribute', html: '<p>The time column a window or a join uses is its <b>time attribute</b>. Here it decides <b>which rows are paired</b>.[[src:join]]</p>' }
      ],
      narration: [
        'Fifth question. Someone writes the same join on pt, the time each message was seen. Impression 7 happened at 12:00:50 and was seen at 12:04:40. Which click is it paired with now? Choose an answer.',
        'Click 4, seen at 12:04:06, which happened more than 3 minutes after impression 7. The time column a join uses is called its time attribute, and here it decides which rows are paired. Watch both sets.'
      ]
    },

    /* ---------- 10 · both clocks, animated ---------- */
    {
      title: 'Clock', layout: 'array',
      eyebrow: '10 · Watch the same 20 pairs on each clock',
      heading: 'Same data, two different sets of pairs',
      stand: 'Row 3 tests each pair on event time, row 4 on processing time. Lit slots are matches.',
      array: {
        labelWidth: 170, slotLabel: 'pair',
        rows: [
          { label: 'click id', values: PAIRS.map(p => p.c.id) },
          { label: 'impression id', values: PAIRS.map(p => p.i.id) },
          { label: 'within 60 s, event time?', values: ET },
          { label: 'within 60 s, processing time?', values: PT }
        ],
        meters: ['pairs tested', 'matches on event time', 'matches on processing time'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 0, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 150 },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 2, speed: 150 },
          { step: 2, do: 'pick', slots: [slotOf(0, 7), slotOf(1, 7), slotOf(4, 7)] }
        ]
      },
      cards: [
        { step: 2, title: 'A false coincidence', html: '<p>On processing time, 0–7 and 1–7 vanish and 4–7 appears. Impression 7 is placed 230 s from when it really happened.[[src:why]]</p>' },
        { step: 3, title: 'Worse than a wrong sum', html: '<p>A wrong clock in a total is a wrong number in a known place. In a join it asserts two things coincided when they did not, and the row looks entirely plausible.[[src:why]]</p>' }
      ],
      narration: [
        'First, the pairs tested on event time again, when things really happened: 5 matches, the true ones.',
        'Now processing time, on the same 20 pairs: 4 matches. Not just fewer; different.',
        'Look at the three highlighted slots. Clicks 0 and 1 lose their real partner, impression 7, and click 4 gains it. On the arrival clock, impression 7 sits 230 seconds from when it happened.',
        'A wrong clock in a total gives a wrong number in a known place. In a join it states that two things happened together when they did not, and that row looks entirely believable.'
      ]
    },

    /* ---------- 11 · question: who decides what ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: 'What SQL takes off your hands, and what it does not',
      stand: 'The engine handles a great deal for you: when to send results, how to correct them, how rows are stored.',
      question: {
        step: 0,
        prompt: 'Which two decisions still belong to whoever writes the query?',
        options: [
          { text: 'The window, and the time attribute it uses.', correct: true,
            why: 'They are a few characters of the query text, and they decide which window an event lands in and which rows are paired.' },
          { text: 'When results are sent, and how they are corrected.', correct: false,
            why: 'Those are set by the engine. The query text never mentions them.' },
          { text: 'Nothing: SQL makes all the time decisions itself.', correct: false,
            why: 'The engine cannot guess which clock you meant. Both choices are valid and give different answers.' }
        ]
      },
      cards: [
        { step: 1, title: 'Mechanics, not meaning', html: '<p>SQL hides the mechanics, not the semantics. Review the window and the time attribute first: most meaning per character, and no error when wrong.[[src:when]]</p>' }
      ],
      narration: [
        'Sixth question. The engine decides when results are sent, how they are corrected and how rows are stored. Which two decisions still belong to whoever writes the query? Choose an answer.',
        'The window, and the time attribute. SQL hides the mechanics, not the meaning. So when reviewing a query, read those two first: they carry the most meaning per character, and neither gives an error when wrong.'
      ]
    },

    /* ---------- 12 · question: a join against a table ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['lookup'],
      eyebrow: '12 · Your turn · check yourself',
      heading: 'Not every join is between two streams',
      stand: 'Now join each click with a list of advert names. The list is not a stream: it changes only now and then.',
      question: {
        step: 0,
        prompt: 'Should this join also get a 60-second limit?',
        options: [
          { text: 'No: each click just looks up the current name in the list.', correct: true,
            why: 'The list is bounded by itself, not by time. Forcing a time limit onto it is the common streaming-join bug.' },
          { text: 'Yes: every streaming join needs a time limit.', correct: false,
            why: 'Only a join of two endless streams does. A slowly-changing list is not one.' },
          { text: 'Yes, but a longer one, such as an hour.', correct: false,
            why: 'Any time limit would drop names that simply have not changed recently. Length is not the issue.' }
        ]
      },
      cards: [
        { step: 1, title: 'A lookup', html: '<p>Joining against a slowly-changing table is a <b>lookup</b>, bounded by the table rather than by time. Chapter 9 takes it apart.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. Now join each click with a list of advert names, which changes only now and then. Should this join also get a 60-second limit? Choose an answer.',
        'No. Each click just looks up the current name: that is called a lookup, bounded by the list, not by time. Forcing a time window onto it is the common streaming-join bug. Chapter 9 takes it apart.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'A time limit, the lower watermark, and the right clock',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b>, <b>processing time</b>', 'When it happened, and when it was seen. Impression 7: 230 s apart.[[src:why]]'] },
          { step: 0, cells: ['<b>Windowed join</b>', 'Two streams matched within a time limit, here 60 s. The limit ends the wait and bounds the buffer.[[src:why]]'] },
          { step: 1, cells: ['<b>Watermark</b> of a join', 'The lower of its two inputs: 12:08:00 and 12:03:20 give 12:03:20. A quiet side holds everything back.[[src:why]]'] },
          { step: 1, cells: ['<b>Time attribute</b>', 'On event time 5 true pairs; on processing time 4, one of them a false coincidence.[[src:prog]]'] },
          { step: 2, cells: ['<b>Lookup</b>', 'A join against a slowly-changing table: no time limit.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>Part 4 designs a whole query that runs forever, piece by piece, from the streams to the place its results are written.[[src:join]]</p>' },
      narration: [
        'To recap. Every event has an event time and a processing time. Two streams are joined within a time limit, here 60 seconds; the limit ends the wait and bounds the buffer.',
        'A join’s watermark is the lower of its two inputs: 12:03:20, not 12:08:00. One quiet side holds back every result.',
        'The time attribute decides which rows are paired: 5 true pairs on event time, and a false one on processing time. And a join against a slowly-changing table is a lookup, with no time limit.',
        'Next, part 4 designs a whole continuous query, one piece at a time, from the incoming streams to where the results are written.'
      ]
    }
  ]
};
