// Chapter 9, Part 8 — the chapter's "System Design Interview": a windowed join between a click
// stream and an impression stream for ad attribution, built one component at a time. Each
// component is preceded by a question; the design is then run on the seed's nine events,
// assembled, and closed with what it does NOT settle. The adverts story, both clocks and every
// word are re-introduced, so the deck stands alone. Every time and count comes from the seed.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch09';
const E = seed.EVENTS;                                   // in processing (arrival) order
const J = seed.LAG;                                      // the join window, 60 seconds
const clock = s => seed.hhmmss(s);
const idx = e => E.indexOf(e);
const KIND = e => (e.key === 'a' ? 'click' : 'impression');
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const sideWm = (k, i) => { const seen = E.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - J : null; };
const joinWm = i => (['a', 'b'].some(k => sideWm(k, i) === null) ? null : Math.min(sideWm('a', i), sideWm('b', i)));
const emitAt = c => E.findIndex((_, i) => joinWm(i) !== null && joinWm(i) > c.et + J);
const PLAN = CLICKS.map(c => {
  const at = emitAt(c), all = IMPS.filter(m => Math.abs(c.et - m.et) <= J);
  return { c, at, all, onTime: at < 0 ? [] : all.filter(m => idx(m) <= at), late: at < 0 ? [] : all.filter(m => idx(m) > at) };
});
const ON_TIME = PLAN.reduce((n, p) => n + p.onTime.length, 0);
const LATE_N = PLAN.reduce((n, p) => n + p.late.length, 0);
const NEVER_N = PLAN.filter(p => p.at < 0).reduce((n, p) => n + p.all.length, 0);
const wmText = v => (v === null || v < 0 ? '—' : clock(v));
// what the pipeline publishes just after each arrival
const PUBLISHED = E.map((_, i) => {
  const firsts = PLAN.filter(p => p.at === i).map(p => (p.onTime.length ? `${p.c.id} with ${p.onTime.map(m => m.id).join(',')}` : `${p.c.id}: none`));
  const fixes = PLAN.filter(p => p.late.some(m => idx(m) === i)).map(p => p.c.id);
  return [...firsts, ...fixes.length ? [`fix ${fixes.join(', ')} with ${E[i].id}`] : []].join(' · ') || '—';
});

if (ON_TIME !== 1 || LATE_N !== 2 || NEVER_N !== 2 || PLAN.map(p => p.at).join() !== '5,5,8,-1,-1' || E[3].et !== 130 || E[3].pt !== 132
  || E[2].et !== 90 || E[2].pt !== 93 || E[7].et !== 50 || E[7].pt !== 280 || joinWm(5) !== 185 || joinWm(8) !== 200
  || PUBLISHED[5] !== '0: none · 1: none' || PUBLISHED[7] !== 'fix 0, 1 with 7' || PUBLISHED[8] !== '3 with 2' || J !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Ad Attribution Design',
  eyebrow: 'Streaming · Ch 9 · Part 8',
  ...shared,
  jargon: ['impression', 'event', 'stream', 'attribution', 'event time', 'processing time', 'watermark', 'join', 'buffer',
    'windowed join', 'emit', 'late', 'retraction', 'tombstone', 'allowed lateness', 'garbage collection', 'idleness timeout'],
  sources: {
    ch:     chapter(CH, 'Chapter 9 on GitHub'),
    sd:     section(CH, 'System Design Interview', 'Chapter 9 · system design interview'),
    src:    section(CH, 'click stream + impression stream', 'Chapter 9 · the two streams'),
    join:   section(CH, 'windowed join (buffer + watermark)', 'Chapter 9 · the windowed join'),
    retr:   section(CH, 'retraction emitter', 'Chapter 9 · the retraction emitter'),
    store:  section(CH, 'attribution store', 'Chapter 9 · the attribution store'),
    sdwhy:  section(CH, 'Why this design needs to retract a negative, and what it still loses', 'Chapter 9 · why it must retract a negative'),
    sdwhen: section(CH, 'When to ship this, and the four things it does not settle', 'Chapter 9 · what it does not settle'),
    sdprog: section(CH, 'Ad attribution — stack and heap at every step', 'Chapter 9 · ad attribution, traced')
  },

  slides: [
    /* ---------- 1 · the brief, as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'event', 'stream', 'attribution', 'join'],
      eyebrow: '01 · Chapter 9 · Part 8 · a system design interview',
      heading: 'Design the system that credits adverts with clicks',
      hero: { step: 0, text: 'A website shows adverts. Each showing on someone’s screen is an <b>impression</b>; each click, a click. A record of either is an <b>event</b>, and each kind arrives as a <b>stream</b> that never ends. Crediting each click to the impressions shown close to it is <b>attribution</b>, and pairing rows of the two streams that belong together is a <b>join</b>.[[src:sd]]' },
      tiles: [
        { step: 1, value: 9, label: 'events: 5 clicks, 4 impressions' },
        { step: 1, value: 60, suffix: ' s', label: 'how close a click and impression must be[[src:join]]' },
        { step: 2, value: 5, label: 'true click–impression pairs in the data[[src:sdwhy]]' },
        { step: 2, value: 4, label: 'components in the design[[src:sd]]' }
      ],
      cardsLabel: 'The brief',
      cards: [
        { step: 3, n: 1, title: 'Join the two streams', text: 'Pair each click with impressions within 60 seconds of it.' },
        { step: 3, n: 2, title: 'Wait for both sides', text: 'Hold each side until both are known to be complete.' },
        { step: 4, n: 3, title: 'Correct what arrives behind', text: 'A delayed row must take back and fix an earlier answer.' }
      ],
      note: { step: 4, text: 'Before each component you will be asked to choose. Then the design is run, assembled, and its gaps named.[[src:sd]]' },
      narration: [
        'A website shows adverts. Each showing is an impression, each click a click. A record of either is an event, and each kind arrives as a stream. Crediting clicks to impressions is attribution, and pairing the streams’ rows is a join.',
        'Our example has 9 events, 5 clicks and 4 impressions, from the book’s one dataset. A click and an impression belong together when they happened within 60 seconds.',
        'There are 5 such pairs in the data. The design has 4 components, and we will choose each one in turn.',
        'The brief: join the two streams, pairing each click with impressions within 60 seconds. And hold each side until both are known to be complete.',
        'And when a row arrives far behind, take back and fix any earlier answer it contradicts. You will choose first, every time, and at the end we will name what the design still loses.'
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
          cells: [`${e.id}`, KIND(e), [2, 3, 7].includes(i) ? `<b>${clock(e.et)}</b>` : clock(e.et), [2, 3, 7].includes(i) ? `<b>${clock(e.pt)}</b>` : clock(e.pt)] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click or showing happened.</li><li><b>Processing time</b> — when the system received it.</li><li>Impression 7 happened at 12:00:50 and was seen at 12:04:40: almost four minutes behind.[[src:retr]]</li></ul>' },
      narration: [
        'Here are the events in the order the system received them. Impression 2 happened at 12:01:30 and arrived at 12:01:33. Click 3 happened at 12:02:10 and arrived at 12:02:12.',
        'Impression 6 happened at 12:03:40, but arrived after impression 5, which happened later. Arrival order is not event order.',
        'Impression 7 happened at 12:00:50, but the system did not see it until 12:04:40, almost four minutes behind.',
        'So every event has two clocks. When it happened is its event time; when the system received it is its processing time. Attribution must be decided by event time.'
      ]
    },

    /* ---------- 3 · component 1: the two streams ---------- */
    {
      title: 'Feed', layout: 'ask', defines: ['watermark'],
      eyebrow: '03 · Your turn · component 1, the click and impression streams',
      heading: 'What must each stream hand the join?',
      stand: 'Click 3 arrives at 12:02:12 carrying its event time, 12:02:10. Impression 2 arrived earlier, at 12:01:33, carrying 12:01:30.',
      question: {
        step: 0,
        prompt: 'Besides its rows, what must each stream give the join so that it knows when to stop waiting?',
        options: [
          { text: 'Its own promise of how far its event times are complete.', correct: true,
            why: 'Only the stream knows how far behind its own rows run. Without that promise, the join can never decide a click is final.' },
          { text: 'The current time on the system’s clock.', correct: false,
            why: 'Impression 7 arrived almost four minutes behind. The system’s clock says nothing about what is still on its way.' },
          { text: 'A count of how many rows it will send in total.', correct: false,
            why: 'A stream never ends, so there is no total to give.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Watermark', html: '<p>A stream’s promise that nothing older will still arrive is its <b>watermark</b>. Here: the latest event time seen, minus 60 seconds. Each side carries its own.[[src:src]]</p>' },
        { step: 2, title: 'Rows with event times', html: '<p>Every row carries its event time, because pairs are judged by when things happened, never by when they arrived.[[src:src]]</p>' }
      ],
      narration: [
        'Component one, the two streams. Click 3 arrives carrying its event time, and so did impression 2. What else must each stream give the join, so it knows when to stop waiting? Choose an answer.',
        'Its own promise of how far its event times are complete. A stream’s promise that nothing older will still arrive is called its watermark. Here it is the latest event time seen, minus 60 seconds.',
        'And every row carries its event time, because pairs are judged by when things happened, never by when they arrived. Each side carries its own watermark.'
      ]
    },

    /* ---------- 4 · component 2: the windowed join ---------- */
    {
      title: 'Join', layout: 'ask', defines: ['buffer', 'windowed join', 'emit'],
      eyebrow: '04 · Your turn · component 2, the windowed join',
      heading: 'Click 3 has found impression 2. Publish now?',
      stand: 'Impression 2 is held in memory. Click 3 arrives and finds it 40 seconds away, inside the 60-second window. But another impression from up to 12:03:10 could still arrive.',
      question: {
        step: 0,
        prompt: 'When may the pair of click 3 and impression 2 be published?',
        options: [
          { text: 'Once the smaller of the two watermarks passes 12:03:10.', correct: true,
            why: 'Only then can no other impression within 60 seconds of click 3 still arrive, from either stream.' },
          { text: 'At once, since a match within the window has been found.', correct: false,
            why: 'Click 3 might have a second match still in flight. Publishing now could be incomplete.' },
          { text: 'Once the click stream’s watermark passes 12:03:10.', correct: false,
            why: 'Click 3’s partners are impressions; the impression stream must promise too. The join trusts only the smaller.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Buffer', html: '<p>The rows a join keeps waiting for partners form its <b>buffer</b>: here, impressions within 60 seconds of a click.[[src:join]]</p>' },
        { step: 1, title: 'Windowed join', html: '<p>Two streams paired within a time window, waiting on both watermarks: a <b>windowed join</b>.[[src:join]]</p>' },
        { step: 2, title: 'Emit after event 8', html: '<p>Publishing is <b>emitting</b>. The smaller watermark first passes 12:03:10 after event 8, and only then is click 3 with impression 2 emitted.[[src:join]]</p>' }
      ],
      narration: [
        'Component two, the join. Click 3 arrives and finds impression 2 in memory, 40 seconds away. But another impression from up to 12:03:10 could still arrive. When may the pair be published? Choose an answer.',
        'Once the smaller of the two watermarks passes 12:03:10. The rows a join keeps waiting form its buffer, and this kind, two streams paired within a window, is called a windowed join.',
        'Publishing a result is called emitting it. The smaller watermark first passes 12:03:10 after event 8. Only then is click 3 with impression 2 emitted. Let us watch every emission.'
      ]
    },

    /* ---------- 5 · watch the join emit ---------- */
    {
      title: 'Run', layout: 'array',
      eyebrow: '05 · Watch the join on the nine events',
      heading: 'What is published after each arrival',
      stand: 'One column per arrival: the join watermark — the smaller of the two promises — and what the join publishes at that moment.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'event', values: E.map(e => `${e.id} ${e.key === 'a' ? 'click' : 'imp.'}`) },
          { label: 'join watermark', values: E.map((_, i) => wmText(joinWm(i))) },
          { label: 'published', values: PUBLISHED }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'pick', slots: [5] },
          { step: 2, do: 'pick', slots: [7] },
          { step: 3, do: 'pick', slots: [8] }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'After event 5', html: '<p>The watermark reaches 12:03:05, past the limits of clicks 0 and 1. Nothing had paired with them, so the join emits <b>no match</b> for both.[[src:retr]]</p>' },
        { step: 2, title: 'After event 7', html: '<p>Impression 7 arrives. It happened 49 seconds after click 0 and pairs with both clicks — contradicting what was published.[[src:retr]]</p>' },
        { step: 3, title: 'After event 8', html: '<p>The watermark reaches 12:03:20, past 12:03:10: click 3 with impression 2 is emitted, correct first time.[[src:join]]</p>' }
      ],
      narration: [
        'Here are the arrivals, with the join’s watermark after each one: the smaller of the two streams’ promises.',
        'After event 5 the watermark reaches 12:03:05, past the limits of clicks 0 and 1. Nothing had paired with them, so the join publishes no match for both.',
        'After event 7, impression 7 arrives. It happened 49 seconds after click 0, and pairs with both clicks. What was published is now wrong.',
        'After event 8 the watermark reaches 12:03:20, past 12:03:10, and click 3 with impression 2 is published, correct first time.'
      ]
    },

    /* ---------- 6 · component 3: the retraction emitter ---------- */
    {
      title: 'Fix', layout: 'ask', defines: ['late', 'retraction', 'allowed lateness'],
      eyebrow: '06 · Your turn · component 3, the retraction emitter',
      heading: 'Impression 7 contradicts a published “no match”',
      stand: 'After event 5 the join published “click 0: no match”. At 12:04:40 impression 7 arrives; it happened at 12:00:50, 49 seconds after click 0.',
      question: {
        step: 0,
        prompt: 'What must the pipeline send downstream?',
        options: [
          { text: 'Withdraw the “no match”, then send click 0 with impression 7.', correct: true,
            why: 'Both messages are needed: the old claim must be taken back, and the right answer given.' },
          { text: 'Only the new pair; readers will work out the rest themselves.', correct: false,
            why: 'Then “click 0: no match” stays published beside the pair, and the two contradict each other.' },
          { text: 'Nothing: the answer for click 0 was already published.', correct: false,
            why: 'Then click 0 is never credited, though a real impression led to it.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'Late', html: '<p>An event that arrives after the watermark has passed its event time is <b>late</b>. Impression 7 is late.[[src:retr]]</p>' },
        { step: 1, title: 'Retraction', html: '<p>Withdrawing a published result is a <b>retraction</b>. The emitter retracts the no match, then emits the corrected pair.[[src:retr]]</p>' },
        { step: 2, title: 'Allowed lateness', html: '<p>To pair impression 7 at all, click 0 must still be held. Keeping state past the watermark for late rows is <b>allowed lateness</b>.[[src:store]]</p>' }
      ],
      narration: [
        'Component three. After event 5 the join published click 0, no match. Then impression 7 arrives, 49 seconds from click 0 in event time. What must the pipeline send downstream? Choose an answer.',
        'Withdraw the no match, then send the pair. An event arriving after the watermark has passed it is called late, and withdrawing a published result is called a retraction.',
        'And to pair impression 7 at all, click 0 must still be in memory. Keeping state past the watermark so late rows can still match is called allowed lateness.'
      ]
    },

    /* ---------- 7 · retracting a negative ---------- */
    {
      title: 'Neg', layout: 'ask', defines: ['tombstone'],
      eyebrow: '07 · Your turn · the unusual requirement',
      heading: 'Taking back an absence',
      stand: 'Correcting a number is one update. Here the claim being withdrawn is that nothing happened.',
      question: {
        step: 0,
        prompt: 'Why is it not enough for the store simply to overwrite click 0’s row with the new pair?',
        options: [
          { text: 'A reader that already acted on “no match” is never told.', correct: true,
            why: 'The store ends right, but the withdrawal itself must be visible, or downstream decisions stay wrong.' },
          { text: 'Because overwriting a row is slower than adding a new one.', correct: false,
            why: 'Speed is not the issue. The problem is who learns about the change.' },
          { text: 'Because the store cannot hold two rows for the same click.', correct: false,
            why: 'Holding rows is easy. Telling readers that an earlier claim is withdrawn is the hard part.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Tombstone', html: '<p>An explicit record that a claim was withdrawn is a <b>tombstone</b>. Without one, the store with retractions and the store without end identical, and the damage is invisible.[[src:sdprog]]</p>' },
        { step: 2, title: 'Discover it at design time', html: '<p>“Forget what I said about this click” is harder than updating a number. It is worth finding out before the store is chosen.[[src:sdwhy]]</p>' }
      ],
      narration: [
        'Correcting a number is one update. Here the claim being withdrawn is that nothing happened. Why is overwriting click 0’s row not enough? Choose an answer.',
        'Because a reader that already acted on no match is never told. An explicit record that a claim was withdrawn is called a tombstone. Without it, the damage is invisible in the store.',
        'Forget what I said about this click is a harder requirement than updating a number. It is worth discovering at design time, before the store is chosen.'
      ]
    },

    /* ---------- 8 · component 4: the attribution store ---------- */
    {
      title: 'Store', layout: 'ask', defines: ['garbage collection'],
      eyebrow: '08 · Your turn · component 4, the attribution store',
      heading: 'Holding the final answers, and freeing the join',
      stand: 'The store receives emissions, retractions and corrected pairs. Meanwhile the join keeps rows in memory.',
      question: {
        step: 0,
        prompt: 'When may the join drop a buffered row for good?',
        options: [
          { text: 'When the watermark is past its time, window and lateness.', correct: true,
            why: 'After that, no partner and no late correction can still arrive for it.' },
          { text: 'As soon as its result has been emitted for the first time.', correct: false,
            why: 'Click 0 was emitted after event 5 and still needed at event 7 to be corrected.' },
          { text: 'Never, because the store might ask the join for it again.', correct: false,
            why: 'Then the join’s memory grows for as long as the system runs.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The store applies retractions', html: '<p>So an old match is never counted twice, and the final state shows the corrected pair: click 0 with impression 7.[[src:store]]</p>' },
        { step: 2, title: 'Garbage collection', html: '<p>Dropping join state once the watermark passes the window plus the allowed lateness is <b>garbage collection</b>. It runs on the same watermark as emitting.[[src:store]]</p>' }
      ],
      narration: [
        'Component four, the attribution store. It receives emissions, retractions and corrections. Meanwhile the join holds rows in memory. When may it drop one for good? Choose an answer.',
        'When the watermark passes its time plus the window plus the allowed lateness. The store applies retractions, so no match is counted twice, and ends with click 0 paired with impression 7.',
        'Dropping join state at that point is called garbage collection. Notice it runs on the same watermark that decides emitting. That will matter in a moment.'
      ]
    },

    /* ---------- 9 · the whole story, as a sequence ---------- */
    {
      title: 'Flow', layout: 'sequence',
      eyebrow: '09 · Watch click 0 and click 3 pass through the design',
      heading: 'Four components, one late impression',
      stand: 'Messages appear in the order the system sees them.',
      sequence: {
        actors: [
          { name: 'Streams', sub: 'clicks + impressions', src: 'src' },
          { name: 'Windowed join', sub: 'buffer + watermark', src: 'join' },
          { name: 'Retraction emitter', sub: 'corrections', src: 'retr' },
          { name: 'Attribution store', sub: 'final answers', highlight: true, src: 'store' }
        ],
        messages: [
          { from: 'Streams', to: 'Windowed join', label: 'clicks 0, 1; impression 2; click 3; click 4', step: 0 },
          { from: 'Streams', to: 'Windowed join', label: 'impression 5: watermark 12:03:05', step: 1 },
          { from: 'Windowed join', to: 'Attribution store', label: 'clicks 0 and 1: no match', step: 1 },
          { from: 'Streams', to: 'Windowed join', label: 'impression 7, happened 12:00:50 (late)', step: 2 },
          { from: 'Windowed join', to: 'Retraction emitter', label: 'click 0 and 1 now pair with 7', step: 2 },
          { from: 'Retraction emitter', to: 'Attribution store', label: 'tombstone the no match; emit the pairs', step: 2 },
          { from: 'Streams', to: 'Windowed join', label: 'click 8: watermark 12:03:20', step: 3 },
          { from: 'Windowed join', to: 'Attribution store', label: 'click 3 with impression 2', step: 3 }
        ]
      },
      narration: [
        'The first arrivals go into the join’s buffer: clicks 0 and 1, impression 2, click 3 and click 4.',
        'Impression 5 lifts the join watermark to 12:03:05, past the limits of clicks 0 and 1, so the join publishes no match for both.',
        'Then late impression 7 arrives. It pairs with clicks 0 and 1, so the retraction emitter withdraws both no matches with tombstones, and emits the two corrected pairs.',
        'Finally click 8 lifts the watermark to 12:03:20, and click 3 with impression 2 is published, correct the first time.'
      ]
    },

    /* ---------- 10 · the honest count ---------- */
    {
      title: 'Count', layout: 'cards',
      eyebrow: '10 · What the store actually ends up with',
      heading: 'Of the 5 true pairs: on time, corrected, or never',
      stand: 'The number to put in front of whoever pays for this design.',
      bars: { step: 0, label: 'The 5 true click–impression pairs', items: [
        { label: 'published right first time', value: ON_TIME },
        { label: 'published after a retraction', value: LATE_N },
        { label: 'never published', value: NEVER_N } ] },
      columns: 2,
      cards: [
        { step: 1, title: '20% right first time, 40% never', html: '<p>Click 4 needs the watermark past 12:05:05; it stops at 12:03:20, because impressions stop arriving. Its 2 pairs are computed and held, never published.[[src:sdwhy]]</p>' },
        { step: 2, title: 'And the pipeline does not report it', html: '<p>A missing attribution looks exactly like a click that matched nothing. Only recomputing the answer from the kept streams reveals it.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'Here is what the store actually ends up with, out of the 5 true pairs: 1 published right first time, 2 after a retraction, and 2 never published at all.',
        'The 2 never published belong to click 4. It needs the join watermark past 12:05:05, and the watermark stops at 12:03:20 because no more impressions arrive.',
        'And nothing reports it. A missing attribution looks exactly like a click that matched nothing. The only way to know is to compute what the answer should have been.'
      ]
    },

    /* ---------- 11 · the two knobs ---------- */
    {
      title: 'Knobs', layout: 'ask', defines: ['idleness timeout'],
      eyebrow: '11 · Your turn · two settings, and the biggest loss',
      heading: 'Can a setting recover click 4’s two pairs?',
      stand: 'The design has two settings: the width of the window, and the allowed lateness.',
      question: {
        step: 0,
        prompt: 'Which change publishes click 4’s pairs?',
        options: [
          { text: 'Neither setting: only declaring the quiet stream idle does.', correct: true,
            why: 'Both settings grow the buffer, and neither moves the smaller watermark, which is what blocks click 4.' },
          { text: 'A wider window, so that more pairs can be found in time.', correct: false,
            why: 'Click 4 already has its 2 pairs. They are found; they are just never published.' },
          { text: 'More allowed lateness, so that rows are kept for longer.', correct: false,
            why: 'Keeping rows longer helps late rows match. It does not move the watermark that publishing waits for.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Idleness timeout', html: '<p>Declaring a stream that has gone quiet finished, so the watermark can move on without it, is an <b>idleness timeout</b>. It trades away exactly the correctness the smaller-watermark rule protects.[[src:sdwhy]]</p>' },
        { step: 2, title: 'A product decision', html: '<p>That trade looks like a configuration value, but it is a decision about correctness. Make it deliberately.[[src:sdwhen]]</p>' }
      ],
      narration: [
        'The design has two settings: the window width, and the allowed lateness. Which change publishes click 4’s two pairs? Choose an answer.',
        'Neither. Both grow the buffer, and neither moves the smaller watermark. Only declaring the silent stream finished does that; it is called an idleness timeout.',
        'And an idleness timeout gives up exactly the correctness the smaller-watermark rule protects. It looks like a setting, but it is a product decision. Make it deliberately.'
      ]
    },

    /* ---------- 12 · the design, assembled ---------- */
    {
      title: 'Plan', layout: 'graph',
      eyebrow: '12 · The design, assembled',
      heading: 'Streams, join, emitter, store',
      stand: 'Each box is one answer you chose.',
      graph: {
        viewBox: '0 0 1520 300', legend: true,
        nodes: [
          { id: 'src', x: 20, y: 90, w: 240, h: 104, title: 'Two streams', sub: 'rows + event times', kind: 'main', step: 0, src: 'src', values: ['a watermark each'] },
          { id: 'join', x: 330, y: 90, w: 260, h: 104, title: 'Windowed join', sub: 'buffer + watermark', kind: 'main', step: 1, src: 'join', values: [null, 'up to 5 rows held'] },
          { id: 'retr', x: 660, y: 90, w: 260, h: 104, title: 'Retraction emitter', sub: 'withdraw, then correct', kind: 'new', step: 2, src: 'retr', values: [null, null, '2 corrections'] },
          { id: 'store', x: 990, y: 90, w: 240, h: 104, title: 'Attribution store', sub: 'applies tombstones', kind: 'change', step: 3, src: 'store', values: [null, null, null, '3 pairs published'] },
          { id: 'read', x: 1300, y: 90, w: 200, h: 104, title: 'Reader', sub: 'reports, billing', kind: 'ext', step: 3, values: [null, null, null, '2 pairs missing'] }
        ],
        edges: [
          { from: 'src', to: 'join', kind: 'main', step: 1 },
          { from: 'join', to: 'retr', kind: 'new', step: 2 },
          { from: 'retr', to: 'store', kind: 'change', step: 3 },
          { from: 'store', to: 'read', kind: 'main', step: 3 }
        ]
      },
      notes: [
        { step: 4, html: '<b>One watermark, two jobs:</b> it decides both when to emit and when to free memory.[[src:sdwhy]]' },
        { step: 4, html: '<b>The unusual stage:</b> the emitter, because it must withdraw a negative.[[src:sdwhy]]' },
        { step: 4, html: '<b>The silent loss:</b> 2 of 5 pairs never reach the reader, and nothing says so.[[src:sdwhen]]' }
      ],
      narration: [
        'Here is the whole design. First, two streams, each row carrying its event time, and each stream its own watermark.',
        'Second, the windowed join: it buffers rows, pairs those within 60 seconds, and holds each result until the smaller watermark passes. Here it held up to 5 rows, both streams together.',
        'Third, the retraction emitter, the stage only this design needs: it withdraws a published no match and emits the correction. Two corrections here.',
        'Fourth, the attribution store applies the withdrawals, and the reader, reports or billing, receives 3 published pairs. Two are missing.',
        'One watermark does two jobs, emitting and freeing memory. The emitter must withdraw a negative. And 2 of 5 pairs never arrive, with nothing to say so.'
      ]
    },

    /* ---------- 13 · what it does not settle ---------- */
    {
      title: 'Not', layout: 'ask',
      eyebrow: '13 · Your turn · what this design does not settle',
      heading: 'One click, two impressions',
      stand: 'Click 4 matches two impressions: 5, 15 seconds after it, and 6, 25 seconds before it. The advertiser pays for one.',
      question: {
        step: 0,
        prompt: 'Which part of the design decides which impression gets the credit?',
        options: [
          { text: 'None of it: who is credited is a business decision.', correct: true,
            why: 'Windows, watermarks and retractions decide what matches, never who is paid. Somebody must choose a rule.' },
          { text: 'The windowed join, because it keeps the nearer one.', correct: false,
            why: 'The join emits every pair within 60 seconds. Both impressions pair with click 4.' },
          { text: 'The store, because it keeps whichever pair arrives first.', correct: false,
            why: 'Arrival order is an accident of the network, not a rule anyone chose.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Four things it does not settle', html: '<ul class="l"><li>2 of the 5 pairs never published, and nothing reports it;</li><li>the store must be able to withdraw a negative.[[src:sdwhen]]</li></ul>' },
        { step: 2, title: '…and two more', html: '<ul class="l"><li>memory is arrival rate × 60 seconds per side, summed over both sides, and both settings grow it;</li><li>one click can match 2 impressions: who gets the credit is not an engineering question.[[src:sdwhen]]</li></ul>' }
      ],
      narration: [
        'Click 4 matches two impressions, 5 and 6. The advertiser pays for one. Which part of the design decides which gets the credit? Choose an answer.',
        'None of it. First touch, last touch or split credit is a business decision. Nor does the design report the 2 never-published pairs, and its store must be able to withdraw a negative.',
        'And memory is the arrival rate times 60 seconds per side, summed over both sides, which both settings grow. Those are the four things the design does not settle, and it cannot ship until someone owns them.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · The design, in five sentences',
      heading: 'Join by event time, wait for both, retract a negative, count the losses',
      stand: 'Each component, and the question it answered.',
      table: {
        columns: ['Component', 'What it does', 'The question it answered'],
        rows: [
          { step: 0, cells: ['<b>Two streams</b>', 'Rows with event times, and a watermark each.', 'What must each stream hand over?[[src:src]]'] },
          { step: 0, cells: ['<b>Windowed join</b>', 'Buffers rows; pairs within 60 seconds; emits when the smaller watermark passes.', 'When may a pair be published?[[src:join]]'] },
          { step: 1, cells: ['<b>Retraction emitter</b>', 'Withdraws a published no match with a tombstone; emits the correction.', 'What if a late row contradicts?[[src:retr]]'] },
          { step: 1, cells: ['<b>Attribution store</b>', 'Applies withdrawals; join state freed past window plus lateness.', 'What holds the final answers?[[src:store]]'] },
          { step: 2, cells: ['<b>Not settled</b>', '2 of 5 pairs never published; who gets the credit; memory at real rates.', 'What does it still lose?[[src:sdwhen]]'] }
        ]
      },
      side: { step: 3, title: 'In one line', html: '<p>A correct windowed join delivers 1 of 5 pairs right first time, 2 corrected and 2 never — so the accounting, not the match list, is what the design must deliver.[[src:sdwhy]]</p>' },
      narration: [
        'To recap. Two streams hand the join rows with event times, and a watermark each. The windowed join buffers rows and emits a pair once the smaller watermark passes.',
        'The retraction emitter withdraws a published no match with a tombstone and emits the correction. The store applies withdrawals, and join state is freed past the window plus lateness.',
        'What it does not settle: 2 of 5 pairs are never published and nothing reports it; who gets the credit; and memory at real traffic rates.',
        'In one line: on this data a correct design delivers 1 pair right first time, 2 corrected and 2 never. The honest count is the deliverable.'
      ]
    }
  ]
};
