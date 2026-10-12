// Chapter 9, Part 3 — "Correctness and state", for a viewer who has read nothing before it.
// The adverts story, both clocks and every word are re-introduced; the buffer, the retraction
// of a published "no match" and the on-time / late / never accounting are animated on the
// seed's own events, and every count is computed from tools/stream_seed.js and asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch09';
const E = seed.EVENTS;                                   // in processing (arrival) order
const J = seed.LAG;                                      // the join's time bound, 60 seconds
const clock = s => seed.hhmmss(s);
const idx = e => E.indexOf(e);
const KIND = e => (e.key === 'a' ? 'click' : 'impression');
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const sideWm = (k, i) => { const seen = E.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - J : null; };
const joinWm = i => (['a', 'b'].some(k => sideWm(k, i) === null) ? null : Math.min(sideWm('a', i), sideWm('b', i)));
const BUFFER = E.map((_, i) => E.filter((e, j) => j <= i && (joinWm(i) === null || e.et + J >= joinWm(i))).length);
const emitAt = c => E.findIndex((_, i) => joinWm(i) !== null && joinWm(i) > c.et + J);
const PLAN = CLICKS.map(c => {
  const at = emitAt(c), all = IMPS.filter(m => Math.abs(c.et - m.et) <= J);
  return { c, at, all, onTime: at < 0 ? [] : all.filter(m => idx(m) <= at), late: at < 0 ? [] : all.filter(m => idx(m) > at) };
});
const ON_TIME = PLAN.reduce((n, p) => n + p.onTime.length, 0);
const LATE_N = PLAN.reduce((n, p) => n + p.late.length, 0);
const NEVER_N = PLAN.filter(p => p.at < 0).reduce((n, p) => n + p.all.length, 0);
const wmText = v => (v === null || v < 0 ? '—' : clock(v));

if (ON_TIME !== 1 || LATE_N !== 2 || NEVER_N !== 2 || ON_TIME + LATE_N + NEVER_N !== 5 || Math.max(...BUFFER) !== 5
  || PLAN.map(p => p.at).join() !== '5,5,8,-1,-1' || joinWm(5) !== 185 || joinWm(8) !== 200 || E[7].et !== 50 || E[7].pt !== 280
  || Math.abs(E[0].et - E[7].et) !== 49 || J !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'What a Join Delivers',
  eyebrow: 'Streaming · Ch 9 · Part 3',
  ...shared,
  jargon: ['impression', 'event', 'stream', 'event time', 'processing time', 'join', 'match', 'buffer', 'watermark',
    'emit', 'no match', 'late', 'retraction', 'allowed lateness', 'garbage collection', 'idleness timeout'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    flow:  section(CH, 'Correctness and state', 'Chapter 9 · correctness and state'),
    why:   section(CH, 'Why a correct windowed join still fails to deliver most of its matches here', 'Chapter 9 · why a correct join under-delivers'),
    when:  section(CH, 'When to accept this, and what to do about the undelivered matches', 'Chapter 9 · what to do about it'),
    mem:   section(CH, 'The accounting — stack and heap at every step', 'Chapter 9 · the accounting, traced')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'event', 'stream'],
      eyebrow: '01 · Chapter 9 · Part 3',
      heading: 'A correct pairing, counted honestly',
      hero: { step: 0, text: 'A website shows adverts. Each showing on someone’s screen is an <b>impression</b>; each click is a click. A record of either is an <b>event</b>, and events keep coming, so each kind forms a <b>stream</b>. The advertiser pairs each click with the impressions within 60 seconds of it.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events: 5 clicks, 4 impressions' },
        { step: 1, value: 5, label: 'true click–impression pairs in the data[[src:why]]' },
        { step: 2, value: 60, suffix: ' s', label: 'how close in time a pair must be[[src:why]]' },
        { step: 2, value: 5, label: 'rows held in memory at the peak[[src:why]]' }
      ],
      cardsLabel: 'What this part counts',
      cards: [
        { step: 3, n: 1, title: 'How much must be kept', text: 'And when it may be dropped.' },
        { step: 3, n: 2, title: 'When a delayed row disagrees', text: 'With an answer already published.' },
        { step: 4, n: 3, title: 'What is actually delivered', text: 'Of the 5 true pairs: on time, corrected, or never.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website shows adverts. Each showing is an impression, and each click is a click. A record of either is an event, and events keep coming, so each kind forms a stream.',
        'Our example, from the book’s one dataset, has 9 events: 5 clicks and 4 impressions. Exactly 5 click and impression pairs truly belong together.',
        'A pair belongs together when the two happened within 60 seconds of each other. And while it waits, the system holds up to 5 rows in memory.',
        'This part asks how much must be kept, and when it may be dropped; and what happens when a delayed row disagrees with an answer already published.',
        'And then it counts what a correct system actually delivers, of the 5 true pairs. The count is not comfortable. You will answer first each time.'
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
          cells: [`${e.id}`, KIND(e), i === 7 || i === 0 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 || i === 0 ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click or showing happened.</li><li><b>Processing time</b> — when the system received it. Networks delay things, so the two differ.</li><li>Click 0 and impression 7 happened 49 seconds apart, but arrived almost four minutes apart.[[src:why]]</li></ul>' },
      narration: [
        'Here are the events in the order the system received them, each with two times. Click 0 happened at 12:00:01 and was seen a second later.',
        'Impression 6 happened at 12:03:40, but was seen after impression 5, which happened later. Arrival order is not event order.',
        'Impression 7 happened at 12:00:50, only 49 seconds after click 0. But the system did not see it until 12:04:40.',
        'So every event has two clocks. When it happened is its event time; when the system received it is its processing time. Pairs are judged by event time.'
      ]
    },

    /* ---------- 3 · question: how long can a partner exist ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['join', 'match', 'buffer'],
      eyebrow: '03 · Your turn · how long to keep a row',
      heading: 'Click 0 waits for a partner',
      stand: 'Click 0 happened at 12:00:01. A pair counts when the two happened within 60 seconds of each other.',
      question: {
        step: 0,
        prompt: 'Up to what event time could an impression still pair with click 0?',
        options: [
          { text: 'Up to 12:01:01: 60 seconds after the click happened.', correct: true,
            why: 'Anything that happened later than 12:01:01 is more than 60 seconds away, so it can never pair with click 0.' },
          { text: 'Up to 12:01:02: 60 seconds after the click arrived.', correct: false,
            why: 'Pairs are judged by when things happened, not by when they arrived. Arrival is the other clock.' },
          { text: 'There is no limit: an impression from any time might pair.', correct: false,
            why: 'The 60-second rule is exactly that limit. It is what keeps the waiting finite.' }
        ]
      },
      cards: [
        { step: 1, title: 'Join, and match', html: '<p>Combining rows from two inputs that belong together is a <b>join</b>; a pair that passes the 60-second rule is a <b>match</b>.[[src:flow]]</p>' },
        { step: 2, title: 'The buffer', html: '<p>Rows kept waiting for a partner form the join’s <b>buffer</b>. Click 0 needs to be kept only while a partner up to 12:01:01 could still arrive.[[src:flow]]</p>' }
      ],
      narration: [
        'Click 0 happened at 12:00:01, and is waiting for a partner. Up to what event time could an impression still pair with it? Choose an answer.',
        'Up to 12:01:01, 60 seconds after it happened. Combining rows from two inputs that belong together is a join, and a pair that passes the rule is a match.',
        'Rows kept waiting for a partner form the join’s buffer. Click 0 needs a place in it only while a partner from up to 12:01:01 could still arrive. But how does the join know?'
      ]
    },

    /* ---------- 4 · question: knowing when to drop ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['watermark'],
      eyebrow: '04 · Your turn · knowing when to drop',
      heading: 'When may click 0 leave the buffer?',
      stand: 'Each stream promises: “nothing from before my latest event time, minus 60 seconds, will still arrive.” The join trusts only the smaller of the two promises.',
      question: {
        step: 0,
        prompt: 'When may click 0 be dropped from the buffer?',
        options: [
          { text: 'When both streams have promised nothing before 12:01:01 will come.', correct: true,
            why: 'Then no partner for click 0 can still arrive on either side, so keeping it buys nothing.' },
          { text: 'As soon as the clicks have promised it, whatever the impressions say.', correct: false,
            why: 'Click 0’s partners are impressions. Only the impression side can promise none is still coming.' },
          { text: 'When 60 seconds have passed on the system’s own clock.', correct: false,
            why: 'Impression 7 arrives almost four minutes after it happened. The system’s clock says nothing about what is still on its way.' }
        ]
      },
      cards: [
        { step: 1, title: 'Watermark', html: '<p>A stream’s promise that nothing older will arrive is its <b>watermark</b>. The join’s watermark is the smaller of the two, and a row may go once it passes the row’s event time plus 60 seconds.[[src:why]]</p>' },
        { step: 2, title: 'Bounded by the window, and only by it', html: '<p>Each side holds ≈ its arrival rate × the 60-second window; the buffer is both sides added. At an assumed 10 thousand rows a second per side, that is 600 thousand rows per side; double the window, double the state.[[src:why]]</p>' }
      ],
      narration: [
        'Each stream promises that nothing from before its latest event time, minus 60 seconds, will still arrive. When may click 0 be dropped from the buffer? Choose an answer.',
        'When both streams have promised that nothing before 12:01:01 will come. A stream’s promise is called its watermark, and the join trusts the smaller of the two.',
        'So the buffer is bounded by the window, and only by it: each side holds about its arrival rate times 60 seconds. At an assumed 10 thousand rows a second, that is 600 thousand rows per side. Double the window, double the state.'
      ]
    },

    /* ---------- 5 · the buffer, animated ---------- */
    {
      title: 'Hold', layout: 'array',
      eyebrow: '05 · Watch the buffer rise and fall with the join watermark',
      heading: 'At most 5 of the 9 rows are held',
      stand: 'One column per arrival. The join watermark is the smaller promise; a dash means nothing after noon is promised yet.',
      array: {
        labelWidth: 170, slotLabel: 'arrival',
        rows: [
          { label: 'event', values: E.map(e => `${e.id} ${e.key === 'a' ? 'click' : 'imp.'}`) },
          { label: 'join watermark', values: E.map((_, i) => wmText(joinWm(i))) },
          { label: 'rows held', values: BUFFER }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'pick', slots: [BUFFER.indexOf(5)] },
          { step: 2, do: 'pick', slots: [5] }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The peak', html: '<p>After click 4 the join holds <b>5 rows</b>: the watermark is still at 12:00:30, so nothing may go yet.[[src:why]]</p>' },
        { step: 2, title: 'Then 3', html: '<p>Impression 5 lifts the join watermark to 12:03:05, past 12:01:01 and 12:01:03, so the two early clicks may leave the buffer.[[src:flow]]</p>' }
      ],
      narration: [
        'Here are the arrivals, with the join’s watermark after each one. It sits at 12:00:30 for two arrivals, then jumps to 12:03:05 when impression 5 arrives.',
        'Below, the rows held. They climb to a peak of 5 after click 4, because the watermark is still at 12:00:30 and nothing may be dropped yet.',
        'Then impression 5 lifts the join watermark to 12:03:05, past the limits of clicks 0 and 1, so the count falls to 3. But wait: what did the join publish for those two clicks?'
      ]
    },

    /* ---------- 6 · question: what to publish for click 0 ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['emit', 'no match'],
      eyebrow: '06 · Your turn · the moment of decision',
      heading: 'Click 0’s time is up. Nothing has paired with it.',
      stand: 'After event 5 the join watermark is 12:03:05, past click 0’s limit of 12:01:01. No impression from within 60 seconds of click 0 has arrived yet.',
      question: {
        step: 0,
        prompt: 'What does a correct join publish for click 0 at this moment?',
        options: [
          { text: '“No match”: both streams promised nothing more is coming.', correct: true,
            why: 'From everything that has arrived, and everything that was promised, that is the right answer.' },
          { text: 'Nothing yet: it waits a little longer, to be safe.', correct: false,
            why: 'The watermarks said the wait is over. Waiting past them would mean never trusting them at all.' },
          { text: 'The nearest impression, even though it is too far away.', correct: false,
            why: 'Impression 2 is 89 seconds away, outside the rule. That would be a wrong match.' }
        ]
      },
      cards: [
        { step: 1, title: 'Emit, and “no match”', html: '<p>Publishing a result is <b>emitting</b> it. A click with nothing paired still emits a result: <b>no match</b>.[[src:mem]]</p>' },
        { step: 2, title: 'It reads as a fact', html: '<p>Downstream, “click 0: no match” reads as “this click was never attributed”: a fact, not a provisional answer. Keep that in mind.[[src:why]]</p>' }
      ],
      narration: [
        'After event 5 the join watermark passes click 0’s limit, and nothing has paired with it. What does a correct join publish for click 0? Choose an answer.',
        'No match. Publishing a result is called emitting it, and a click with nothing paired still emits a result: no match. From everything that arrived and was promised, it is right.',
        'But downstream, no match reads as this click was never attributed: a fact, not a provisional answer. Now watch what arrives two events later.'
      ]
    },

    /* ---------- 7 · the retraction, as a sequence ---------- */
    {
      title: 'Undo', layout: 'sequence', defines: ['late', 'retraction'],
      eyebrow: '07 · Watch a late impression contradict a published answer',
      heading: 'Publish “no match”, then take it back',
      stand: 'Each column is one party; messages appear in the order the system sees them.',
      sequence: {
        actors: [
          { name: 'Click stream', sub: 'clicks' },
          { name: 'Impression stream', sub: 'impressions' },
          { name: 'Join', sub: 'buffer and watermarks', src: 'why' },
          { name: 'Downstream', sub: 'reads results', highlight: true }
        ],
        messages: [
          { from: 'Click stream', to: 'Join', label: 'click 0, happened 12:00:01', step: 0 },
          { from: 'Impression stream', to: 'Join', label: 'impression 5 lifts the watermark to 12:03:05', step: 0 },
          { from: 'Join', to: 'Downstream', label: 'click 0: no match', step: 1 },
          { from: 'Impression stream', to: 'Join', label: 'impression 7, happened 12:00:50, seen 12:04:40', step: 2 },
          { from: 'Join', to: 'Downstream', label: 'take back: click 0 no match', step: 3 },
          { from: 'Join', to: 'Downstream', label: 'click 0 matched impression 7', step: 3 }
        ]
      },
      narration: [
        'Click 0 arrives and waits. Then impression 5 lifts the join watermark to 12:03:05, past click 0’s limit.',
        'So the join emits: click 0, no match. Downstream records that this click was never attributed.',
        'Two events later, impression 7 arrives. It happened at 12:00:50, 49 seconds after click 0, so it is a true match. An event that arrives after the watermark has passed it is called late.',
        'So the join must take back its published no match, and emit the corrected pair. Withdrawing a published result is called a retraction. Here it withdraws an absence.'
      ]
    },

    /* ---------- 8 · question: why a negative is hard ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '08 · Your turn',
      heading: 'Taking back a “no match”',
      stand: 'Correcting a total from 7 to 11 is one update. Here the join must withdraw a statement that nothing happened.',
      question: {
        step: 0,
        prompt: 'What does the store downstream need, to take back “click 0: no match”?',
        options: [
          { text: 'An explicit record that the earlier claim was withdrawn.', correct: true,
            why: 'Overwriting fixes the store, but anyone who already read “no match” never learns otherwise. The withdrawal must be a thing of its own.' },
          { text: 'Nothing special: just overwrite the row with the new pair.', correct: false,
            why: 'The store ends right, but a reader that already acted on “no match” is never told. The damage is invisible.' },
          { text: 'Nothing: “no match” is never published, so there is nothing to take back.', correct: false,
            why: 'It is published, after event 5. A click with nothing paired still emits a result.' }
        ]
      },
      cards: [
        { step: 1, title: 'Updating versus withdrawing', html: '<p>Updating a number is easy. Withdrawing an <b>absence</b> usually means the store needs an explicit withdrawal record. A dashboard can live with this; a billing run that already paid out cannot.[[src:when]]</p>' }
      ],
      narration: [
        'Correcting a total from 7 to 11 is one update. Here the join must withdraw a statement that nothing happened. What does the store downstream need? Choose an answer.',
        'An explicit record that the claim was withdrawn. Overwriting fixes the store, but a reader who already acted on no match is never told. A dashboard can live with that; a billing run that already paid out cannot.'
      ]
    },

    /* ---------- 9 · question: allowed lateness ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['allowed lateness'],
      eyebrow: '09 · Your turn',
      heading: 'What made the correction possible at all?',
      stand: 'The join watermark passed click 0’s limit after event 5. Impression 7 arrived at event 7.',
      question: {
        step: 0,
        prompt: 'For impression 7 to pair with click 0 at event 7, what must the join have done with click 0?',
        options: [
          { text: 'Kept it in the buffer for a while after emitting.', correct: true,
            why: 'Had click 0 been dropped at event 5, impression 7 would find nothing to pair with, and the retraction could never happen.' },
          { text: 'Dropped it at once, and rebuilt it from the published result.', correct: false,
            why: 'The published result says only “no match”. It does not hold click 0’s event time to test against.' },
          { text: 'Nothing: the impression carries everything it needs.', correct: false,
            why: 'The impression knows only itself. To pair, the join needs click 0’s row too.' }
        ]
      },
      cards: [
        { step: 1, title: 'Allowed lateness', html: '<p>Keeping state past the watermark, so that late rows can still match and correct an earlier answer, is <b>allowed lateness</b>. It too grows the state, in step with its length.[[src:flow]]</p>' }
      ],
      narration: [
        'The join watermark passed click 0’s limit after event 5, and impression 7 arrived at event 7. What must the join have done with click 0? Choose an answer.',
        'Kept it in the buffer for a while after emitting. Keeping state past the watermark so late rows can still match is called allowed lateness. Like a wider window, it grows the state.'
      ]
    },

    /* ---------- 10 · the accounting ---------- */
    {
      title: 'Count', layout: 'cards',
      eyebrow: '10 · The honest accounting for all 5 true matches',
      heading: 'On time, late, or never',
      stand: 'Every click, what the join published first, what came later, and what was never published.',
      bars: { step: 0, label: 'The 5 true matches', items: [
        { label: 'emitted on time, correct', value: ON_TIME },
        { label: 'emitted late, after a retraction', value: LATE_N },
        { label: 'never emitted', value: NEVER_N } ] },
      columns: 3,
      cards: [
        { step: 1, title: 'Click 3 · on time', html: '<p>Emits after event 8 with impression 2, and is never revised. <b>1</b> match.[[src:mem]]</p>' },
        { step: 1, title: 'Clicks 0 and 1 · late', html: '<p>Emit “no match” after event 5; impression 7 arrives at event 7 and pairs with both. <b>2</b> matches, each after a retraction.[[src:mem]]</p>' },
        { step: 2, title: 'Clicks 4 and 8 · never', html: '<p>The join watermark never passes 12:05:05 or 12:10:00. Click 4’s <b>2</b> matches are computed, held, and never published.[[src:mem]]</p>' }
      ],
      narration: [
        'Here is the whole count for the 5 true matches. 1 emitted on time and correct, 2 emitted late after a retraction, and 2 never emitted at all.',
        'Click 3 emits after event 8 with impression 2, and is never revised. Clicks 0 and 1 emit no match after event 5, and are corrected when impression 7 arrives.',
        'Clicks 4 and 8 never emit, because the join watermark never passes their limits. Click 4’s 2 matches are computed, held in state, and never published.'
      ]
    },

    /* ---------- 11 · question: is it broken ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '11 · Your turn',
      heading: '1 + 2 + 2 = 5. Is something broken?',
      stand: 'Only 1 of the 5 true matches, 20%, was published correctly the first time. 2 of them, 40%, were never published.',
      question: {
        step: 0,
        prompt: 'Is this join broken?',
        options: [
          { text: 'No: this is what a correct windowed join does on out-of-order data.', correct: true,
            why: 'Every step followed the rules. Late arrivals and a silent stream produce this count from a correct design.' },
          { text: 'Yes: a correct join publishes every match exactly once.', correct: false,
            why: 'That holds only when data arrives in order and every stream keeps sending. Neither is true here.' },
          { text: 'Yes: the window is too narrow, and a wider one would fix it.', correct: false,
            why: 'A wider window grows the state and still waits on the same watermark. It does not touch the 2 never sent.' }
        ]
      },
      cards: [
        { step: 1, title: 'The accounting is the deliverable', html: '<p>1 right first time, 2 corrected, 2 never delivered — from a correct implementation. Nothing is broken, and no error is raised.[[src:why]]</p>' }
      ],
      narration: [
        'Only 1 of the 5 true matches, 20 percent, was published correctly the first time, and 40 percent were never published. Is this join broken? Choose an answer.',
        'No. This is what a correct windowed join does on out-of-order data. Nothing is broken, and no error is raised. The count itself is the thing to report, not just the matches.'
      ]
    },

    /* ---------- 12 · question: the leak ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['garbage collection'],
      eyebrow: '12 · Your turn · the memory',
      heading: 'What happens to the rows of clicks 4 and 8?',
      stand: 'The same watermark decides when a match may be emitted and when its rows may be dropped.',
      question: {
        step: 0,
        prompt: 'Clicks 4 and 8 never emit. What happens to their rows in the join’s memory?',
        options: [
          { text: 'They are never dropped either, so memory keeps growing.', correct: true,
            why: 'Dropping waits on the same watermark that emitting waits on. A stalled stream blocks both.' },
          { text: 'They are dropped after 60 seconds on the system’s clock.', correct: false,
            why: 'Nothing here runs on the system’s clock. Dropping waits for the watermark, which has stopped.' },
          { text: 'They are dropped when the buffer reaches 5 rows.', correct: false,
            why: 'There is no size limit in the rule. The window and the watermark are the only bound.' }
        ]
      },
      cards: [
        { step: 1, title: 'Garbage collection', html: '<p>Dropping state once the watermark passes the window plus the allowed lateness is <b>garbage collection</b>. Without it, the buffer grows without bound.[[src:flow]]</p>' },
        { step: 2, title: 'A leak, silently', html: '<p>A stalled input is a liveness problem <b>and</b> a memory leak, and neither raises an error.[[src:why]]</p>' }
      ],
      narration: [
        'The same watermark decides when a match may be emitted and when its rows may be dropped. Clicks 4 and 8 never emit. What happens to their rows? Choose an answer.',
        'They are never dropped either. Dropping state once the watermark passes the window plus the allowed lateness is called garbage collection. Here it never happens for these two.',
        'So a stalled input is two problems at once: answers that never come, and memory that never shrinks. And neither raises an error.'
      ]
    },

    /* ---------- 13 · what to do ---------- */
    {
      title: 'Do', layout: 'cards', defines: ['idleness timeout'],
      eyebrow: '13 · When to accept this, and what to do about it',
      heading: 'Accept the count, or change the guarantee — not the window',
      stand: 'Four things the chapter recommends.',
      columns: 2,
      cards: [
        { step: 0, title: 'Accept it when corrections are tolerable', html: '<p>A dashboard can take a retraction, even of a “no match”. A billing run that has already paid out cannot.[[src:when]]</p>' },
        { step: 1, title: 'Require a store that can withdraw a “no match”', html: '<p>Click 0 matched nothing, then it did. The store must be able to un-publish an absence.[[src:when]]</p>' },
        { step: 2, title: 'Do not widen the window for the never-sent', html: '<p>The only remedy is an <b>idleness timeout</b>: declaring a silent stream finished. That trades away exactly the correctness the smaller-watermark rule protects.[[src:when]]</p>' },
        { step: 3, title: 'Alert on the never-sent case', html: '<p>A missing pair looks just like a click that matched nothing. Only computing the right answer from the kept streams reveals it.[[src:when]]</p>' }
      ],
      narration: [
        'What to do. Accept the count when corrections are tolerable. A dashboard can take a retraction, even of a no match; a billing run that has already paid out cannot.',
        'Require a store that can withdraw a no match. Updating a number is easy; un-publishing an absence usually needs an explicit record.',
        'Do not try to fix the never-sent matches with the window or lateness. The only remedy is an idleness timeout, declaring a silent stream finished, which gives up the very correctness the rule protects.',
        'And alert on the never-sent case, because the system will not. A missing pair looks exactly like a click that matched nothing; only recomputing the answer reveals it.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'One watermark decides what is published and what is freed',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Buffer</b> and <b>watermark</b>', 'Rows wait until the smaller promise passes their time plus 60 seconds. Peak here: 5 of 9.[[src:why]]'] },
          { step: 1, cells: ['<b>Emit</b> and <b>no match</b>', 'A click with nothing paired still publishes a result, and it reads as a fact.[[src:mem]]'] },
          { step: 1, cells: ['<b>Late</b>, <b>retraction</b>, <b>allowed lateness</b>', 'Impression 7 arrives after the watermark; click 0’s no match is withdrawn and the pair emitted.[[src:why]]'] },
          { step: 2, cells: ['<b>The count</b>', '1 on time, 2 after a retraction, 2 never: 5 true matches, from a correct join.[[src:why]]'] },
          { step: 2, cells: ['<b>Garbage collection</b>', 'Dropping state past window plus lateness. A stalled stream blocks it: a silent leak.[[src:flow]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>A standalone interview question with the same shape: two sorted lists of time spans, every overlap between them — and, as streams, what may be thrown away.</p>' },
      narration: [
        'To recap. Rows wait in the buffer until the join’s watermark, the smaller promise, passes their time plus 60 seconds. Here up to 5 of 9 are held.',
        'A click with nothing paired still emits no match. When a late row contradicts it, a retraction withdraws it, which needs allowed lateness to keep the click around.',
        'The honest count is 1 on time, 2 after a retraction, and 2 never, from a correct join. And the same watermark decides garbage collection, so a stalled stream also leaks memory.',
        'Next, part 4 is an interview question with the same shape: every overlap between two sorted lists of time spans, and, as streams, what may be thrown away.'
      ]
    }
  ]
};
