// Chapter 9, Part 1 — "Why joins are hard on streams", for a viewer who has read nothing
// before it. The adverts story, both clocks and every word are introduced here; the viewer is
// asked before being told; the pairs, the buffer and the watermarks are animated on the
// seed's own nine events. Every pair, count and time is computed from tools/stream_seed.js.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch09';
const E = seed.EVENTS;                                   // in processing (arrival) order
const J = seed.LAG;                                      // the join's time bound, 60 seconds
const clock = s => seed.hhmmss(s);
const KIND = e => (e.key === 'a' ? 'click' : 'impression');
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const PAIRS = CLICKS.flatMap(c => IMPS.map(m => ({ c, m, d: Math.abs(c.et - m.et) })));
const MATCHES = PAIRS.filter(p => p.d <= J);
const sideWm = (k, i) => { const seen = E.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - J : null; };
const joinWm = i => (['a', 'b'].some(k => sideWm(k, i) === null) ? null : Math.min(sideWm('a', i), sideWm('b', i)));
const BUFFER = E.map((_, i) => E.filter((e, j) => j <= i && (joinWm(i) === null || e.et + J >= joinWm(i))).length);
const emitAt = c => E.findIndex((_, i) => joinWm(i) !== null && joinWm(i) > c.et + J);
const NEVER = CLICKS.filter(c => emitAt(c) < 0);
const mmss = s => clock(s).slice(3);
const wmText = v => (v === null || v < 0 ? '—' : clock(v));

if (PAIRS.length !== 20 || MATCHES.length !== 5 || MATCHES.map(p => `${p.c.id}-${p.m.id}`).join() !== '0-7,1-7,3-2,4-5,4-6'
  || Math.max(...BUFFER) !== 5 || BUFFER.indexOf(5) !== 4 || emitAt(E[3]) !== 8 || NEVER.map(c => c.id).join() !== '4,8'
  || joinWm(8) !== 200 || sideWm('a', 8) !== 480 || joinWm(5) !== 185 || E[7].et !== 50 || E[7].pt !== 280 || J !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Joins Never Finish',
  eyebrow: 'Streaming · Ch 9 · Part 1',
  ...shared,
  jargon: ['impression', 'event', 'stream', 'event time', 'processing time', 'join', 'batch', 'match', 'time bound',
    'buffer', 'join state', 'watermark', 'emit', 'windowed join', 'temporal join'],
  sources: {
    ch:   chapter(CH, 'Chapter 9 on GitHub'),
    flow: section(CH, 'Why joins are hard on streams', 'Chapter 9 · why joins are hard on streams'),
    why:  section(CH, 'Why a stream-stream join needs a time bound, and what it still cannot deliver', 'Chapter 9 · why a join needs a time bound'),
    when: section(CH, 'When a windowed join is the right tool, and how to size it', 'Chapter 9 · how to size a join'),
    mem:  section(CH, 'A join with no completion — stack and heap at every step', 'Chapter 9 · a join with no completion')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'event', 'stream'],
      eyebrow: '01 · Chapter 9 · Part 1',
      heading: 'Adverts shown, adverts clicked. Which click goes with which showing?',
      hero: { step: 0, text: 'A website shows adverts. Each time an advert appears on someone’s screen, that is an <b>impression</b>; each time someone clicks one, a click. Each record of either is an <b>event</b>. Events keep arriving with no end, so each kind forms a <b>stream</b>: one of clicks, one of impressions.[[src:why]]' },
      tiles: [
        { step: 1, value: 5, label: 'clicks in our example' },
        { step: 1, value: 4, label: 'impressions in our example' },
        { step: 2, value: 20, label: 'click–impression pairs to consider[[src:why]]' },
        { step: 2, value: 60, suffix: ' s', label: 'how close in time a pair must be[[src:why]]' }
      ],
      cardsLabel: 'What the advertiser wants to know',
      cards: [
        { step: 3, n: 1, title: 'Which showing led to each click?', text: 'Pair each click with the impressions close to it in time.' },
        { step: 3, n: 2, title: 'When is a click’s answer final?', text: 'More impressions may still be on their way.' },
        { step: 4, n: 3, title: 'What must be kept meanwhile?', text: 'And when can it be thrown away?' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website shows adverts. Each showing on someone’s screen is called an impression, and each click is a click. A record of either is an event, and events keep coming without end, so each kind forms a stream.',
        'Our example is small: 5 clicks and 4 impressions, nine events in all. They come from the book’s one dataset, and every number in this part is computed from it.',
        'Five clicks and four impressions make 20 possible pairs. A pair counts when the click and the impression happened within 60 seconds of each other.',
        'The advertiser wants to know which showing led to each click. And, because more impressions may still be on their way, when is a click’s answer final?',
        'And what must be kept in memory while it waits, and when can it be thrown away? This part answers all three, and you will answer first each time.'
      ]
    },

    /* ---------- 2 · the events and the two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, and when the system saw it',
      stand: 'Listed in the order the system received them. Times are clock times just after noon.',
      table: {
        columns: ['Event', 'Kind', 'Happened at', 'Seen at'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`${e.id}`, KIND(e), i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click or showing happened, on the visitor’s screen.</li><li><b>Processing time</b> — when the system received the record. Networks delay things, so the two differ.</li><li>Impression 7 happened at <b>12:00:50</b> but was seen at <b>12:04:40</b>.[[src:why]]</li></ul>' },
      narration: [
        'Here are the first events, in the order the system received them. Each has two times. Click 0 happened at 12:00:01 and was seen one second later.',
        'Look at impression 6: it happened at 12:03:40, but it was seen after impression 5, which happened later. The order of arrival is not the order of events.',
        'Impression 7 is the extreme case. It happened at 12:00:50, but the system did not see it until 12:04:40, almost four minutes late.',
        'So every event carries two clocks. When it happened is its event time. When the system received it is its processing time. Matching uses event time.'
      ]
    },

    /* ---------- 3 · question: the finished case ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['join', 'batch', 'match'],
      eyebrow: '03 · Your turn · first, the easy case',
      heading: 'Suppose all nine events are already in hand',
      stand: 'A pair counts when the click and the impression happened within 60 seconds of each other, by event time.',
      question: {
        step: 0,
        prompt: 'With the list finished, how many click–impression pairs must be checked to find every pair that counts?',
        options: [
          { text: 'All 20: five clicks times four impressions.', correct: true,
            why: 'Any click could be close to any impression, so every one of the 5 × 4 pairs is checked once. Then the work is done.' },
          { text: 'Just 9: one test for each event in the list.', correct: false,
            why: 'A pair needs one click and one impression. Nine events make 20 such pairs, not 9.' },
          { text: 'Just 5: one test for each click, no more.', correct: false,
            why: 'A click does not know in advance which impression is near it. It has to be compared with all four.' }
        ]
      },
      cards: [
        { step: 1, title: 'Join, and match', html: '<p>Combining rows from two inputs that belong together is a <b>join</b>. A pair that passes the rule — here, within 60 seconds — is a <b>match</b>.[[src:flow]]</p>' },
        { step: 2, title: 'A batch join finishes', html: '<p>When both inputs are complete lists, the work is a <b>batch</b>: test all 20 pairs, and stop. The answer is final the moment the last pair is tested.[[src:why]]</p>' }
      ],
      narration: [
        'First, the easy case. Suppose all nine events are already in hand. How many click and impression pairs must be checked to find every one that counts? Choose an answer.',
        'All 20: each of the five clicks against each of the four impressions. Combining rows from two inputs that belong together is called a join, and a pair that passes the rule is a match.',
        'With complete lists, this is called a batch: test all 20 pairs, and stop. The answer is final as soon as the last pair is tested. Let us watch the 20 tests.'
      ]
    },

    /* ---------- 4 · the 20 pairs, animated ---------- */
    {
      title: 'Pairs', layout: 'array',
      eyebrow: '04 · Watch the twenty pairs being tested',
      heading: 'One subtraction per pair',
      stand: 'Each column is one pair, click first, with the minutes and seconds past 12:00 at which each happened.',
      array: {
        labelWidth: 150, slotLabel: 'pair',
        rows: [
          { label: 'click · impression', values: PAIRS.map(p => `${p.c.id}·${p.m.id}`) },
          { label: 'click happened', values: PAIRS.map(p => mmss(p.c.et)) },
          { label: 'impression happened', values: PAIRS.map(p => mmss(p.m.et)) },
          { label: 'within 60 s?', values: PAIRS.map(p => (p.d <= J ? 'yes' : 'no')) }
        ],
        meters: ['pairs tested', 'matches found'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 220 },
          { step: 2, do: 'pick', slots: PAIRS.map((p, i) => (p.c.id === 4 && p.d <= J ? i : -1)).filter(i => i >= 0) }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Five matches', html: '<p>20 pairs tested, <b>5 matches</b>: click 0 with impression 7, click 1 with 7, click 3 with 2, click 4 with 5, and click 4 with 6.[[src:why]]</p>' },
        { step: 2, title: 'Not one-to-one', html: '<p>Click 4 matches <b>two</b> impressions, 15 and 25 seconds away. A join’s output can be larger than you expect.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 20 pairs, click first, then impression, with the minute and second past noon at which each happened. Click 0 at 00:01 and impression 7 at 00:50 are 49 seconds apart.',
        'Now watch each pair being tested against the 60-second rule. The pointer reads all 20, and 5 of them match: 0 with 7, 1 with 7, 3 with 2, 4 with 5, and 4 with 6.',
        'Notice click 4, highlighted. It matches two impressions, 15 and 25 seconds away. So a join is not one click to one impression; its output can grow.'
      ]
    },

    /* ---------- 5 · question: no end ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['time bound'],
      eyebrow: '05 · Your turn · now the hard case',
      heading: 'The events never stop arriving',
      stand: 'In real life the two streams have no last event. Impression 7 arrived almost four minutes after it happened.',
      question: {
        step: 0,
        prompt: 'With streams that never end, when can the join say that click 0 will get no more matches?',
        options: [
          { text: 'Never, unless a rule limits how far apart a match may be.', correct: true,
            why: 'Without such a rule, an impression from any time could still arrive and match. With it, only a short stretch of time matters.' },
          { text: 'As soon as click 0 itself has arrived at the system.', correct: false,
            why: 'Impression 7 matches click 0 and arrives almost four minutes after it. Deciding at once would miss it.' },
          { text: 'Once every impression in the stream has arrived.', correct: false,
            why: 'A stream has no last impression, so that moment never comes.' }
        ]
      },
      cards: [
        { step: 1, title: 'A time bound', html: '<p>The 60-second rule is a <b>time bound</b>. Only impressions within 60 seconds of a click can ever match it, so the question has a limit.[[src:why]]</p>' },
        { step: 2, title: 'It gives the join a meaning', html: '<p>Without it, the join would have to keep every row of both streams forever, in case a match turns up. The bound makes the memory finite <b>and</b> the question well defined.[[src:why]]</p>' }
      ],
      narration: [
        'Now the hard case. Real streams have no last event. When can the join say that click 0 will get no more matches? Choose an answer.',
        'Never, unless a rule says how far apart a match may be. The 60-second rule is called a time bound: only impressions within 60 seconds of a click can ever match it.',
        'Without a bound, the join would have to keep every row of both streams forever, in case a match turns up. The bound makes the memory finite, and gives the question a meaning.'
      ]
    },

    /* ---------- 6 · question: what to do with an early row ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['buffer', 'join state'],
      eyebrow: '06 · Your turn',
      heading: 'An impression arrives before its click',
      stand: 'Impression 2 happened at 12:01:30 and arrived at 12:01:33. Click 3, which it matches, happened at 12:02:10 and arrived at 12:02:12.',
      question: {
        step: 0,
        prompt: 'When impression 2 arrives, no click matches it yet. What must the join do with it?',
        options: [
          { text: 'Keep it, so a later click can still be paired with it.', correct: true,
            why: 'Click 3 arrives less than a minute later and needs it. A row has to wait for a partner that may not have arrived yet.' },
          { text: 'Throw it away, since nothing matched it when it arrived.', correct: false,
            why: 'Then click 3 would find nothing, and a real match would be lost.' },
          { text: 'Report it at once as an impression that nobody clicked.', correct: false,
            why: 'That would be wrong less than a minute later, when click 3 arrives and matches it.' }
        ]
      },
      cards: [
        { step: 1, title: 'Buffer, and join state', html: '<p>Rows kept waiting for a partner form a <b>buffer</b>. Everything the join holds in memory between events is its <b>join state</b>.[[src:flow]]</p>' },
        { step: 2, title: 'Both sides wait', html: '<p>It works the other way too: a click must be kept in case a late impression matches it. So both streams are buffered.[[src:why]]</p>' }
      ],
      narration: [
        'Impression 2 arrives first, at 12:01:33. Click 3, which it matches, arrives at 12:02:12. When impression 2 arrives, what must the join do with it? Choose an answer.',
        'Keep it. Click 3 arrives less than a minute later and needs it. Rows kept waiting for a partner form a buffer, and everything the join holds between events is called its join state.',
        'And it works the other way too. A click must be kept in case a late impression matches it, as impression 7 does for click 0. So both streams are buffered.'
      ]
    },

    /* ---------- 7 · the buffer, animated ---------- */
    {
      title: 'Hold', layout: 'array',
      eyebrow: '07 · Watch the buffer fill and empty',
      heading: 'How many rows the join holds after each arrival',
      stand: 'One column per event, in arrival order. The last row counts the rows held in join state just after that event arrives.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'event', values: E.map(e => e.id) },
          { label: 'kind', values: E.map(e => (e.key === 'a' ? 'click' : 'imp.')) },
          { label: 'rows held', values: BUFFER }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [BUFFER.indexOf(5)] },
          { step: 3, do: 'pick', slots: [5] }
        ]
      },
      columns: 2,
      cards: [
        { step: 2, title: 'The peak: 5 rows', html: '<p>After click 4 arrives, the join holds <b>5 of the 9 rows</b>, both streams together: 4 clicks and 1 impression. Nothing could be dropped yet: each one might still meet a partner.[[src:why]]</p>' },
        { step: 3, title: 'Then it shrinks', html: '<p>After impression 5 it holds 3. Rows older than the time bound can be dropped — once the join knows it is safe. That knowledge is the next slide.[[src:flow]]</p>' }
      ],
      narration: [
        'Here are the nine events in arrival order: clicks and impressions, mixed together as the network delivers them.',
        'The bottom row counts the rows the join is holding just after each arrival. It climbs: 1, 2, 3, 4, 5.',
        'The peak is 5 rows after click 4 arrives, counting both streams together: 4 clicks and 1 impression. None could be dropped yet, because each might still meet a partner.',
        'After impression 5 it falls back to 3. A row may be dropped once nothing within 60 seconds of it can still arrive. But how does the join know that? That is the next question.'
      ]
    },

    /* ---------- 8 · question: the watermark ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['watermark'],
      eyebrow: '08 · Your turn',
      heading: 'Two promises, one join',
      stand: 'Each stream makes a promise: “nothing more from before my latest event time, minus 60 seconds, will arrive.” After click 4 and impression 5, clicks promise 12:03:05 and impressions promise 12:03:20.',
      question: {
        step: 0,
        prompt: 'What may the join assume about both streams together?',
        options: [
          { text: 'Only the earlier promise, 12:03:05: both streams are complete up to there.', correct: true,
            why: 'Clicks may still deliver events after 12:03:05, so only time before 12:03:05 is settled on both sides.' },
          { text: 'The later promise, 12:03:20, since one stream already got that far.', correct: false,
            why: 'The click stream has not promised that. A click from 12:03:10 could still arrive.' },
          { text: 'Halfway between the two promises, as a compromise.', correct: false,
            why: 'An average is not a promise anyone made. Only the smaller one is true of both streams.' }
        ]
      },
      cards: [
        { step: 1, title: 'Watermark', html: '<p>A stream’s promise that nothing older will arrive is its <b>watermark</b>. Here it is the latest event time seen, minus 60 seconds.[[src:flow]]</p>' },
        { step: 2, title: 'The join takes the minimum', html: '<p>A join has two inputs, so its watermark is the <b>smaller</b> of the two. The slower stream sets the pace for both.[[src:why]]</p>' }
      ],
      narration: [
        'Each stream promises that nothing from before its latest event time, minus 60 seconds, will still arrive. Clicks promise 12:03:05; impressions promise 12:03:20. What may the join assume? Choose an answer.',
        'Only the earlier promise, 12:03:05. A stream’s promise that nothing older will arrive is called its watermark. Here, each one is the latest event time seen, minus 60 seconds.',
        'A join has two inputs, so the join’s own watermark is the smaller of the two. Whichever stream is slower sets the pace. Let us watch what that does.'
      ]
    },

    /* ---------- 9 · watermarks, animated ---------- */
    {
      title: 'Marks', layout: 'array', defines: ['emit'],
      eyebrow: '09 · Watch the two watermarks, and the smaller one',
      heading: 'Click 3 waits for 12:03:10',
      stand: 'One column per arrival; a dash means nothing after noon is promised yet. Click 3 happened at 12:02:10, so its answer is final once the join watermark passes 12:03:10.',
      array: {
        labelWidth: 170, slotLabel: 'arrival',
        rows: [
          { label: 'event', values: E.map(e => `${e.id} ${e.key === 'a' ? 'click' : 'imp.'}`) },
          { label: 'clicks promise', values: E.map((_, i) => wmText(sideWm('a', i))) },
          { label: 'impressions promise', values: E.map((_, i) => wmText(sideWm('b', i))) },
          { label: 'join watermark', values: E.map((_, i) => wmText(joinWm(i))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 2, do: 'pick', slots: [8] }
        ]
      },
      columns: 3,
      cards: [
        { step: 2, title: 'Click 3 is published', html: '<p>Only after event 8 does the join watermark, 12:03:20, pass 12:03:10. Then click 3’s match with impression 2 is published, or <b>emitted</b>.[[src:mem]]</p>' },
        { step: 3, title: 'Click 4 never is', html: '<p>Click 4 happened at 12:04:05, so it needs the join watermark past 12:05:05. It stops at <b>12:03:20</b>, because impressions stop arriving.[[src:mem]]</p>' },
        { step: 3, title: 'Clicks ran far ahead', html: '<p>After event 8 the clicks promise 12:08:00. It does not help: the smaller promise is the one that counts.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the arrivals again, with each stream’s promise after each event. The click promise climbs to 12:03:05 after click 4; the impression promise reaches 12:03:20 after impression 5.',
        'The bottom row is the join’s own watermark: the smaller of the two, each time. It sits at 12:03:05 for three arrivals, held back by the clicks.',
        'Click 3 needs the join watermark past 12:03:10. That first happens after event 8, at 12:03:20. Only then is its match published. Publishing a result is called emitting it.',
        'Click 4 needs it past 12:05:05. But the join watermark stops at 12:03:20, because no more impressions arrive. Clicks are at 12:08:00, and it makes no difference.'
      ]
    },

    /* ---------- 10 · question: the stalled click ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '10 · Your turn',
      heading: 'What happens to click 4’s two matches?',
      stand: 'Click 4 matches impressions 5 and 6. Its answer may be emitted only once the join watermark passes 12:05:05, and the join watermark never gets past 12:03:20.',
      question: {
        step: 0,
        prompt: 'What does the join do with click 4’s two matches?',
        options: [
          { text: 'Holds them in its state, and never emits them.', correct: true,
            why: 'They are computed, but the condition for emitting never comes true. Nothing is published, and nothing raises an error.' },
          { text: 'Emits them anyway, once all nine events are in.', correct: false,
            why: 'The join cannot know that the nine are “all”. Streams have no end, so it keeps waiting.' },
          { text: 'Emits “no match” for click 4 instead.', correct: false,
            why: 'Even that needs the watermark to pass 12:05:05. Nothing at all is emitted for click 4.' }
        ]
      },
      cards: [
        { step: 1, title: '2 of the 5 clicks never emit', html: '<p>Clicks 4 and 8 never reach their emission point. They hold <b>2 of the 5 true matches</b>: computed, sitting in state, never published.[[src:why]]</p>' },
        { step: 2, title: 'And never freed', html: '<p>The same watermark decides when rows may be dropped. So these rows are never freed either: a silent stall <b>and</b> a slow memory leak.[[src:flow]]</p>' }
      ],
      narration: [
        'Click 4 matches impressions 5 and 6, but may only emit once the join watermark passes 12:05:05, which never happens. What does the join do with its two matches? Choose an answer.',
        'It holds them, and never emits them. Clicks 4 and 8 never reach their emission point, and they hold 2 of the 5 true matches: computed, kept in state, never published, with no error.',
        'And because the same watermark decides when rows may be dropped, those rows are never freed either. A slow stream causes a silent stall and a growing memory, together.'
      ]
    },

    /* ---------- 11 · question: a table instead ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['windowed join', 'temporal join'],
      eyebrow: '11 · Your turn · a different kind of input',
      heading: 'What if the other side were a table, not a stream?',
      stand: 'Imagine joining each click with a price list that changes now and then. Old prices are settled: no row for 12:02 will turn up later.',
      question: {
        step: 0,
        prompt: 'For each click, what does the join need to do with the price list?',
        options: [
          { text: 'Look up the price that was in force at the click’s event time.', correct: true,
            why: 'The list is settled for past times, so one lookup answers the click at once. There is nothing to wait for.' },
          { text: 'Buffer the click for 60 seconds, then look for nearby prices.', correct: false,
            why: 'Waiting helps only if a partner may still arrive. A settled list sends nothing new for an old time.' },
          { text: 'Wait for both watermarks to pass the click’s time.', correct: false,
            why: 'A table has no stream of events to wait for. That wait would add delay and buy nothing.' }
        ]
      },
      cards: [
        { step: 1, title: 'Windowed join', html: '<p>Two streams, matched within a time bound, waiting on both watermarks: a <b>windowed join</b>. All of the above applies.[[src:flow]]</p>' },
        { step: 2, title: 'Temporal join', html: '<p>A stream against a table, one lookup per row, “as of” the row’s event time: a <b>temporal join</b>. No buffer, no wait.[[src:flow]]</p>' }
      ],
      narration: [
        'Now imagine the other side is a price list that changes now and then, and is settled for past times. For each click, what does the join need to do with it? Choose an answer.',
        'Look up the price that was in force at the click’s event time. Two streams matched within a time bound, waiting on both watermarks, is called a windowed join.',
        'A stream matched against a table, one lookup per row, as of the row’s own event time, is called a temporal join. There is no buffer and no wait.'
      ]
    },

    /* ---------- 12 · the two kinds, side by side ---------- */
    {
      title: 'Kinds', layout: 'table',
      eyebrow: '12 · The input type picks the join type',
      heading: 'The same nine events, joined two ways',
      stand: 'Treat the impressions first as a stream, then as if they were a settled table.',
      table: {
        columns: ['', 'Windowed join', 'Temporal join'],
        rows: [
          { step: 0, cells: ['<b>What bounds it</b>', 'time: the 60-second bound', 'the table: one lookup per row'] },
          { step: 0, cells: ['<b>What it holds</b>', 'up to 5 rows here', 'nothing'] },
          { step: 1, cells: ['<b>When it answers</b>', 'when the join watermark passes', 'on arrival'] },
          { step: 2, cells: ['<b>On this data</b>', '1 of 5 matches on time; 2 never[[src:why]]', 'all 5 clicks answered at once, 2 of them short[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Why two answers fall short', html: '<p>Impressions are not a settled table. Impressions 6 and 7 arrive <b>after</b> clicks they come before, so a lookup on arrival misses them for clicks 3 and 4.[[src:why]]</p><p>Windowing a real table adds a wait it never needed; looking up a late stream gives short answers. Both are the common bug.[[src:when]]</p>' },
      narration: [
        'Here the same nine events are joined two ways. The windowed join is bounded by time, and holds up to 5 rows. The temporal join is bounded by the table, and holds nothing.',
        'The windowed join answers when the join watermark passes. The temporal join answers each click the moment it arrives.',
        'On this data the windowed join publishes only 1 of the 5 matches on time, and 2 never. The temporal join answers all 5 clicks at once, but 2 answers come up short.',
        'Why short? Impressions 6 and 7 arrive after clicks they come before, so a lookup on arrival misses them. Choosing the wrong join for the input is the common streaming-join bug.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'One last check',
      stand: 'Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Two streams are joined within 60 seconds. One stream stops sending. What happens?',
        options: [
          { text: 'The join watermark stops, so waiting clicks never emit and are never freed.', correct: true,
            why: 'The join takes the smaller watermark. A silent stream freezes it, which blocks both publishing and clean-up.' },
          { text: 'The join switches to the other stream’s watermark and carries on.', correct: false,
            why: 'That would assume the silent stream has nothing more to send, which nobody promised.' },
          { text: 'The join emits “no match” for every waiting click.', correct: false,
            why: 'Even a “no match” needs the watermark to pass the click’s bound. Nothing is emitted.' }
        ]
      },
      narration: [
        'One last question. Two streams are joined within 60 seconds, and one of them stops sending. What happens? Choose an answer.',
        'The join watermark stops, because it is the smaller of the two. Waiting clicks never emit and their rows are never freed, exactly like click 4.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'A stream join needs a bound, a buffer and two watermarks',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when the system saw it. Impression 7: 12:00:50 and 12:04:40.'] },
          { step: 0, cells: ['<b>Join</b> and <b>time bound</b>', 'Pair rows that belong together; here, within 60 seconds. 20 pairs, 5 matches.[[src:why]]'] },
          { step: 1, cells: ['<b>Buffer</b> and <b>join state</b>', 'Rows kept waiting for a partner. The peak here is 5 of 9.[[src:why]]'] },
          { step: 1, cells: ['<b>Watermark</b>', 'A stream’s promise that nothing older will come. The join uses the smaller of the two.[[src:flow]]'] },
          { step: 2, cells: ['<b>Emit</b>', 'Publish a result. Clicks 4 and 8 never emit: 2 of the 5 matches stay unpublished.[[src:mem]]'] },
          { step: 2, cells: ['<b>Windowed</b> and <b>temporal join</b>', 'Two streams within a bound, or one lookup per row against a table.[[src:flow]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>Part 2 sets the two joins side by side, one candidate pair and one lookup at a time — and shows why the “as of” lookup needs the table’s history.</p>' },
      narration: [
        'To recap. Every event has an event time and a processing time. A join pairs rows that belong together, and on streams it needs a time bound: here 60 seconds, giving 5 matches from 20 pairs.',
        'While it waits, the join buffers rows in its state; here up to 5 of 9. A watermark is a stream’s promise that nothing older will come, and the join uses the smaller of its two.',
        'A result is emitted once the join watermark passes its bound. Clicks 4 and 8 never get there. A windowed join waits on two streams; a temporal join looks a row up in a table.',
        'Next, part 2 compares the two kinds of join closely, and shows why a temporal lookup needs the table’s history, not just its current values.'
      ]
    }
  ]
};
