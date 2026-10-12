// Chapter 9, Part 2 — "Windowed and temporal joins", for a viewer who has read nothing before
// it. The adverts story, both clocks and every word are re-introduced; the windowed join's
// twenty candidate pairs and the temporal join's five lookups are animated on the seed's own
// events, and every pair, total and lookup is computed from tools/stream_seed.js and asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch09';
const E = seed.EVENTS;                                   // in processing (arrival) order
const J = seed.LAG;                                      // the join's time bound, 60 seconds
const clock = s => seed.hhmmss(s);
const mmss = s => clock(s).slice(3);
const idx = e => E.indexOf(e);
const KIND = e => (e.key === 'a' ? 'click' : 'impression');
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const PAIRS = CLICKS.flatMap(c => IMPS.map(m => ({ c, m, d: Math.abs(c.et - m.et) })));
const MATCHES = PAIRS.filter(p => p.d <= J);
// the temporal join: the impressions read as a table holding the chapter's "impression total" —
// the sum of v over every impression with et at or before the time read
const asOf = c => IMPS.filter(m => m.et <= c.et);
const onArrival = c => IMPS.filter(m => idx(m) < idx(c) && m.et <= c.et);
const total = ms => (ms.length ? String(ms.reduce((s, m) => s + m.v, 0)) : 'NULL');
const ids = ms => (ms.length ? ms.map(m => m.id).join(', ') : 'none');
const SHORT = CLICKS.filter(c => total(asOf(c)) !== total(onArrival(c)));

if (PAIRS.length !== 20 || MATCHES.length !== 5 || CLICKS.map(c => total(asOf(c))).join() !== 'NULL,NULL,11,20,21'
  || CLICKS.map(c => total(onArrival(c))).join() !== 'NULL,NULL,7,7,21' || SHORT.map(c => c.id).join() !== '3,4'
  || E[2].v !== 7 || E[7].v !== 4 || E[6].v !== 9 || E[7].et !== 50 || E[7].pt !== 280 || J !== 60)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Windowed Versus Temporal',
  eyebrow: 'Streaming · Ch 9 · Part 2',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'NULL': 'null' } },
  jargon: ['impression', 'event', 'stream', 'event time', 'processing time', 'join', 'match', 'windowed join',
    'buffer', 'watermark', 'table', 'temporal join', 'as of', 'null', 'history', 'allowed lateness'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    flow:  section(CH, 'Windowed and temporal joins', 'Chapter 9 · windowed and temporal joins'),
    why:   section(CH, 'Why these are bounded by different things, and why confusing them is costly', 'Chapter 9 · bounded by different things'),
    when:  section(CH, 'When to use each, and why the obvious fixes make it worse', 'Chapter 9 · when to use each'),
    mem:   section(CH, 'Windowed against temporal — stack and heap at every step', 'Chapter 9 · windowed against temporal, traced')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'event', 'stream', 'table'],
      eyebrow: '01 · Chapter 9 · Part 2',
      heading: 'Two ways to pair a click with what came before it',
      hero: { step: 0, text: 'A website shows adverts. Each showing on someone’s screen is an <b>impression</b>; each click is a click. A record of either is an <b>event</b>, and events keep coming without end, so each kind forms a <b>stream</b>. A <b>table</b>, by contrast, is a grid that holds the current value of each thing it tracks. The advertiser wants to pair every click with the impressions that led to it.[[src:why]]' },
      tiles: [
        { step: 1, value: 5, label: 'clicks' },
        { step: 1, value: 4, label: 'impressions' },
        { step: 2, value: 20, label: 'pairs the first method tests[[src:why]]' },
        { step: 2, value: 5, label: 'lookups the second method makes[[src:why]]' }
      ],
      cardsLabel: 'Two methods, compared on the same events',
      cards: [
        { step: 3, n: 1, title: 'Pair two streams', text: 'Pair rows that happened close together in time.' },
        { step: 3, n: 2, title: 'Look a row up', text: 'Read a table as it stood when the click happened.' },
        { step: 4, n: 3, title: 'Which one, when', text: 'And the costly mistake of using the wrong one.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A website shows adverts. Each showing on someone’s screen is an impression, and each click is a click. A record of either is an event, and events keep coming, so each kind forms a stream.',
        'Our example has 5 clicks and 4 impressions, from the book’s one dataset. The advertiser wants to pair every click with the impressions that led to it.',
        'There are two ways to do it. The first tests 20 pairs. The second makes just 5 lookups, one per click. They give different answers, at different times.',
        'The first method pairs two streams by time. The second looks each click up in a table, a grid holding the current value of what it tracks, as it stood when the click happened.',
        'By the end you will know which to use when, and the costly mistake of mixing them up. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events, the two clocks, the numbers ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and the two clocks on each',
      heading: 'When it happened, when it was seen, and a small number',
      stand: 'Listed in the order the system received them. Each event also carries a small number, v, that reports add up.',
      table: {
        columns: ['Event', 'Kind', 'Happened at', 'Seen at', 'v'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`${e.id}`, KIND(e), i >= 6 && i <= 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i >= 6 && i <= 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the click or showing happened.</li><li><b>Processing time</b> — when the system received it. Networks delay things, so the two differ.</li><li>Impressions 6 and 7 happened at 12:03:40 and 12:00:50, but arrived after clicks that came later.[[src:why]]</li></ul>' },
      narration: [
        'Here are the events in the order the system received them. Each has two times, and a small number v that reports add up. Click 0 happened at 12:00:01 and was seen a second later.',
        'Impression 6 happened at 12:03:40 but was seen at 12:04:30, after click 4, which happened later than it.',
        'Impression 7 happened at 12:00:50, but was not seen until 12:04:40. It is almost four minutes late.',
        'So every event has two clocks. When it happened is its event time. When the system received it is its processing time. Both methods pair events by event time.'
      ]
    },

    /* ---------- 3 · question: the windowed rule ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['join', 'match', 'windowed join'],
      eyebrow: '03 · Your turn · the first method',
      heading: 'Pair events that happened within 60 seconds of each other',
      stand: 'Click 3 happened at 12:02:10. The impressions happened at 12:01:30, 12:04:20, 12:03:40 and 12:00:50.',
      question: {
        step: 0,
        prompt: 'Which impressions happened within 60 seconds of click 3?',
        options: [
          { text: 'Only impression 2, at 12:01:30, which is 40 seconds earlier.', correct: true,
            why: 'Impression 7 is 80 seconds earlier and impression 6 is 90 seconds later. Only 40 seconds is inside the limit.' },
          { text: 'Impressions 2 and 7, since both came before the click.', correct: false,
            why: 'Coming before is not enough. Impression 7, at 12:00:50, is 80 seconds earlier: outside 60.' },
          { text: 'None of them: the nearest impression is more than a minute away.', correct: false,
            why: 'Impression 2, at 12:01:30, is 40 seconds before the click, which is inside the limit.' }
        ]
      },
      cards: [
        { step: 1, title: 'Join, and match', html: '<p>Combining rows from two inputs that belong together is a <b>join</b>; a pair that passes the rule is a <b>match</b>. Click 3 and impression 2: one match.[[src:why]]</p>' },
        { step: 2, title: 'Windowed join', html: '<p>Matching rows of two streams whose event times are within a window of each other is a <b>windowed join</b>. Its test is one subtraction per pair.[[src:flow]]</p>' }
      ],
      narration: [
        'The first method. Click 3 happened at 12:02:10. Which impressions happened within 60 seconds of it? Choose an answer.',
        'Only impression 2, 40 seconds earlier. Combining rows from two inputs that belong together is called a join, and a pair that passes the rule is called a match.',
        'Matching the rows of two streams whose event times are within a window of each other is called a windowed join. Its test is one subtraction per pair. Let us run it on all of them.'
      ]
    },

    /* ---------- 4 · every candidate pair, animated ---------- */
    {
      title: 'Pairs', layout: 'array',
      eyebrow: '04 · Watch the windowed join test every pair',
      heading: 'Twenty candidates, five matches',
      stand: 'Each column is one click and one impression, with the minutes and seconds past 12:00 at which each happened.',
      array: {
        labelWidth: 170, slotLabel: 'pair',
        rows: [
          { label: 'click · impression', values: PAIRS.map(p => `${p.c.id}·${p.m.id}`) },
          { label: 'click happened', values: PAIRS.map(p => mmss(p.c.et)) },
          { label: 'impression happened', values: PAIRS.map(p => mmss(p.m.et)) },
          { label: 'within 60 s?', values: PAIRS.map(p => (p.d <= J ? 'yes' : 'no')) }
        ],
        meters: ['pairs tested', 'matches'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 220 },
          { step: 2, do: 'pick', slots: PAIRS.map((p, i) => (p.c.id === 4 && p.d <= J ? i : -1)).filter(i => i >= 0) }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: '5 of the 20', html: '<p>Click 0 with 7, click 1 with 7, click 3 with 2, click 4 with 5, click 4 with 6. Only 5 of the 20 candidate pairs are within 60 seconds.[[src:why]]</p>' },
        { step: 2, title: 'Not one-to-one', html: '<p>Click 4 matches <b>2 impressions</b>. A windowed join can emit more rows than either side has: a capacity surprise people usually meet after shipping.[[src:why]]</p>' }
      ],
      narration: [
        'Here are all 20 candidate pairs, each click against each impression, with the times they happened. Click 3 at 02:10 and impression 2 at 01:30 are the pair we just tested.',
        'Watch the windowed join test each one. The pointer reads all 20, and 5 are within 60 seconds: 0 with 7, 1 with 7, 3 with 2, 4 with 5, and 4 with 6.',
        'Click 4, highlighted, matches two impressions. So a windowed join is not one-to-one, and its output can be larger than either input. That surprises people after they ship.'
      ]
    },

    /* ---------- 5 · question: when does a pair exist ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['buffer', 'watermark'],
      eyebrow: '05 · Your turn',
      heading: 'When can click 0’s pair be found?',
      stand: 'Click 0 happened at 12:00:01 and arrived at 12:00:02. Its partner, impression 7, happened at 12:00:50 but arrived at 12:04:40.',
      question: {
        step: 0,
        prompt: 'At what moment can the windowed join find the pair of click 0 and impression 7?',
        options: [
          { text: 'Only at 12:04:40, once both rows have arrived.', correct: true,
            why: 'Both sides are streams, so neither is the authority. The pair exists for the join only when it holds both rows.' },
          { text: 'At 12:00:02, when the click arrives.', correct: false,
            why: 'The impression has not arrived yet. Nothing in the join knows about it.' },
          { text: 'At 12:00:50, the moment that the impression actually happened.', correct: false,
            why: 'Nobody was told at 12:00:50. The join learns of an event only when the event arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'So it must wait', html: '<p>The click must be kept until its partner may have arrived. Rows kept waiting form the join’s <b>buffer</b>.[[src:mem]]</p>' },
        { step: 2, title: 'And it must know when to stop', html: '<p>Each stream’s promise that nothing older will still arrive is its <b>watermark</b>. The window bounds the buffer; the watermarks bound the wait.[[src:flow]]</p>' }
      ],
      narration: [
        'Click 0 arrived at 12:00:02. Its partner, impression 7, arrived at 12:04:40. At what moment can the windowed join find this pair? Choose an answer.',
        'Only at 12:04:40, once both rows have arrived. Both sides are streams, so neither is the authority. The click must be kept until then; rows kept waiting form the buffer.',
        'And the join must know when to stop waiting. A stream’s promise that nothing older will still arrive is its watermark. The window bounds the buffer, and the watermarks bound the wait.'
      ]
    },

    /* ---------- 6 · question: the second method ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['as of'],
      eyebrow: '06 · Your turn · the second method',
      heading: 'Read the impressions as a table, as it stood at the click',
      stand: 'Now treat the impressions as a table holding one figure, the impression total: the sum of v over every impression that happened at or before the moment read. Impression 2 has v 7, and impression 7 has v 4.',
      question: {
        step: 0,
        prompt: 'Click 3 happened at 12:02:10. What did the table hold at that moment?',
        options: [
          { text: '11: impression 2 (v 7) and impression 7 (v 4) had both happened.', correct: true,
            why: 'Both happened before 12:02:10, at 12:01:30 and 12:00:50, so both count, whenever they arrived.' },
          { text: '7: only impression 2, which is the one that had already arrived.', correct: false,
            why: 'That is what had arrived, not what had happened. Impression 7 happened at 12:00:50, before the click.' },
          { text: '20: every impression that happened by 12:04:05.', correct: false,
            why: 'That is the moment of click 4, not click 3. Impression 6, at 12:03:40, had not happened yet.' }
        ]
      },
      cards: [
        { step: 1, title: 'A table, read as of a time', html: '<p>A table holds the current value of each thing it tracks. Reading it <b>as of</b> 12:02:10 means: what it held at that moment, not now.[[src:why]]</p>' },
        { step: 2, title: 'The trap in the wrong answer', html: '<p>7 is what a lookup <b>on arrival</b> reads: impression 7 had not arrived when click 3 did. Keep that in mind.[[src:mem]]</p>' }
      ],
      narration: [
        'The second method. Treat the impressions as a table holding one figure, the impression total: the sum of v over every impression that happened at or before the moment read. Click 3 happened at 12:02:10. What did the table hold then? Choose an answer.',
        '11. Impressions 2 and 7 had both happened, with v 7 and 4. A table holds the current value of what it tracks. Reading it as of 12:02:10 means what it held at that moment, not now.',
        'Notice the trap in the second answer. 7 is what you would read on arrival, because impression 7 had not yet arrived when click 3 did. Hold on to that.'
      ]
    },

    /* ---------- 7 · the five lookups, animated ---------- */
    {
      title: 'Look', layout: 'array', defines: ['temporal join', 'null'],
      eyebrow: '07 · Watch the second method look up every click',
      heading: 'One lookup per click: no window, no wait',
      stand: 'For each click: the impressions that had happened by its event time, and the total as of then; then what had actually arrived when the click did.',
      array: {
        labelWidth: 200, slotLabel: 'click',
        rows: [
          { label: 'click', values: CLICKS.map(c => c.id) },
          { label: 'happened at', values: CLICKS.map(c => clock(c.et)) },
          { label: 'impressions by then', values: CLICKS.map(c => ids(asOf(c))) },
          { label: 'total as of then', values: CLICKS.map(c => total(asOf(c))) },
          { label: 'arrived by then', values: CLICKS.map(c => ids(onArrival(c))) },
          { label: 'total on arrival', values: CLICKS.map(c => total(onArrival(c))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2, 3] },
          { step: 1, do: 'pick', slots: [0, 1] },
          { step: 2, do: 'show', rows: [4, 5] },
          { step: 2, do: 'pick', slots: SHORT.map(c => CLICKS.indexOf(c)) }
        ]
      },
      columns: 3,
      cards: [
        { step: 0, title: 'Temporal join', html: '<p>Enriching each row of a stream with the table <b>as of</b> that row’s event time is a <b>temporal join</b>. Click 3 → 11, click 4 → 20.[[src:why]]</p>' },
        { step: 1, title: 'Null, at once', html: '<p>Clicks 0 and 1 came before every impression, so the table had nothing: the answer is empty, written <b>NULL</b>, and given immediately.[[src:mem]]</p>' },
        { step: 2, title: 'Two short answers', html: '<p>Looked up the moment they arrive, click 3 reads 7 instead of 11 and click 4 reads 7 instead of 20: impressions 6 and 7 arrive after the clicks they come before.[[src:why]]</p>' }
      ],
      narration: [
        'Here is each click with the impressions that had happened by its event time, and the total as of then. Enriching each row this way is called a temporal join. Click 3 gets 11, click 4 gets 20.',
        'Clicks 0 and 1, highlighted, came before every impression. The table had nothing, so the answer is empty, written null. And it is given at once, without any waiting.',
        'Now the bottom rows: what had actually arrived when each click did. Click 3 would read 7, not 11, and click 4 would read 7, not 20. Impressions 6 and 7 arrive after the clicks they come before.'
      ]
    },

    /* ---------- 8 · question: what the table must keep ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['history'],
      eyebrow: '08 · Your turn',
      heading: 'What must a table keep to be read “as of” a past time?',
      stand: 'Click 3 arrives at 12:02:12 and asks for the table as of 12:02:10. Later, at 12:04:06, click 4 asks as of 12:04:05.',
      question: {
        step: 0,
        prompt: 'If the table kept only its current value, what goes wrong?',
        options: [
          { text: 'It cannot answer “as of then”, so it reads the wrong version.', correct: true,
            why: 'A lookup for an earlier time needs the value that held then. Only kept versions can give it.' },
          { text: 'Nothing: the current value is always the right one to use.', correct: false,
            why: 'The current value includes changes made after the event. That answers a different question.' },
          { text: 'It becomes too slow to read, but every answer stays correct.', correct: false,
            why: 'Speed is not the problem. A current-only table gives a wrong answer, and it looks perfectly plausible.' }
        ]
      },
      cards: [
        { step: 1, title: 'History', html: '<p>The earlier values a table keeps, each with the time it took effect, are its <b>history</b>. “As of 12:02:10” is a different question from “now”.[[src:why]]</p>' },
        { step: 2, title: 'And it must be complete', html: '<p>History up to 12:02:10 must also be <b>complete</b>. Here it is not: impression 7 has not arrived, so the lookup yields 7 instead of 11.[[src:mem]]</p>' }
      ],
      narration: [
        'A temporal lookup asks for the table as of a past time. If the table kept only its current value, what goes wrong? Choose an answer.',
        'It can answer now, but not as of then. The earlier values a table keeps, each with the time it took effect, are its history. As of 12:02:10 is a different question from now.',
        'And the history must also be complete up to that time. Here it is not: when click 3 is looked up, impression 7 has not arrived, so the table yields 7 instead of 11.'
      ]
    },

    /* ---------- 9 · side by side ---------- */
    {
      title: 'Bound', layout: 'table',
      eyebrow: '09 · Two operations, bounded by different things',
      heading: 'Not two settings of one join — two different joins',
      stand: 'The same events, joined both ways.',
      table: {
        columns: ['', 'Windowed join', 'Temporal join'],
        rows: [
          { step: 0, cells: ['<b>What bounds it</b>', 'the 60-second window', 'the table, a few rows per thing it tracks'] },
          { step: 0, cells: ['<b>What it holds</b>', 'up to 5 rows[[src:why]]', 'nothing'] },
          { step: 1, cells: ['<b>When it answers</b>', 'when both watermarks pass', 'on arrival, trusting the table to be settled'] },
          { step: 1, cells: ['<b>What it needs</b>', 'watermarks on both sides', 'a table with its history'] },
          { step: 2, cells: ['<b>On these events</b>', '2 clicks never answered[[src:why]]', 'all 5 answered at once, 2 of them short[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'The row that matters', html: '<p><b>When it answers.</b> A windowed join waits because a partner may still arrive. A temporal join does not, because it trusts the table to be settled for that time. That trust is right for a price list, and wrong for impressions.[[src:why]]</p>' },
      narration: [
        'Side by side. The windowed join is bounded by its 60-second window, and holds up to 5 rows. The temporal join is bounded by the table itself, and holds nothing.',
        'The windowed join answers when both watermarks pass, so it needs watermarks on both sides. The temporal join answers on arrival, so it needs a table with its history.',
        'On these events, 2 clicks never get an answer from the windowed join. The temporal join answers all 5 at once, but 2 of those answers are short.',
        'The row that matters is when it answers. One waits because a partner may still arrive; the other trusts the table to be settled. That trust fits a price list, not a stream of impressions.'
      ]
    },

    /* ---------- 10 · question: the common bug ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['allowed lateness'],
      eyebrow: '10 · Your turn · the common bug',
      heading: 'Results arrive late, or not at all',
      stand: 'A team joins clicks with a campaign table using a windowed join. Results arrive late or never. Someone proposes widening the window, or keeping rows longer for late arrivals.',
      question: {
        step: 0,
        prompt: 'What is the right fix?',
        options: [
          { text: 'Use a temporal join: the campaign side is a table, not a stream.', correct: true,
            why: 'The wait was never needed. A settled table can be looked up on arrival, with no buffer at all.' },
          { text: 'Widen the window, so that more clicks find a campaign row in time.', correct: false,
            why: 'A wider window holds more rows and waits just as long. It treats the symptom and grows the memory.' },
          { text: 'Keep rows longer, so that late campaign rows can still match.', correct: false,
            why: 'Keeping rows longer also grows the memory, and nothing late is coming from a settled table.' }
        ]
      },
      cards: [
        { step: 1, title: 'Allowed lateness', html: '<p>Keeping rows past their window so that late arrivals can still match is <b>allowed lateness</b>. Like widening the window, it grows the state in step with its size.[[src:when]]</p>' },
        { step: 2, title: 'The diagnostic question', html: '<p>“Could this side still produce a row that changes an old answer?” If not, it is a table, and it wants a temporal join.[[src:when]]</p>' }
      ],
      narration: [
        'A team joins clicks with a campaign table using a windowed join. Results arrive late, or never. Someone proposes a wider window, or keeping rows longer. What is the right fix? Choose an answer.',
        'Switch to a temporal join. The campaign side is a table, so the wait was never needed. Keeping rows past their window for late arrivals is called allowed lateness, and it grows memory, just like a wider window.',
        'The question to ask is: could this side still produce a row that changes an old answer? If not, it is a table, and it wants a temporal join.'
      ]
    },

    /* ---------- 11 · when to use each ---------- */
    {
      title: 'When', layout: 'cards',
      eyebrow: '11 · When to use each',
      heading: 'Read the right-hand input, not the join settings',
      stand: 'The choice is about what is being joined.',
      columns: 3,
      cards: [
        { step: 0, title: 'Two streams of events', html: '<p>Use a windowed join, and accept what comes with it: the buffer, the wait on both watermarks, and answers that come late or not at all.[[src:when]]</p>' },
        { step: 1, title: 'A stream and a table', html: '<p>A price list, a user profile, a campaign table: use a temporal join. Cheaper in every way, provided the table keeps its history.[[src:when]]</p>' },
        { step: 2, title: 'No history kept?', html: '<p>Say so plainly, rather than fall back to a windowed join. Joining against “now” gives a wrong row that looks perfectly plausible downstream.[[src:when]]</p>' }
      ],
      narration: [
        'So, when to use each. Two streams of events want a windowed join, and you accept what comes with it: the buffer, the wait on both watermarks, and late or missing answers.',
        'A stream and a table, such as a price list, a user profile or a campaign table, wants a temporal join. It is cheaper in every way, provided the table keeps its history.',
        'And if the table cannot keep its history, say so plainly. Joining against now gives an answer that is wrong in a way nothing downstream can detect, because it looks plausible.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'The mirror-image mistake',
      stand: 'Answer from what you have seen on these nine events.',
      question: {
        step: 0,
        prompt: 'Someone treats the impression stream as a settled table and looks each click up on arrival. What happens?',
        options: [
          { text: 'Every click is answered at once; clicks 3 and 4 get short totals.', correct: true,
            why: 'Impressions 6 and 7 arrive after clicks they come before, so the lookup misses them: 7 instead of 11 and 20.' },
          { text: 'Every click gets exactly the same answer as the windowed join gave.', correct: false,
            why: 'The windowed join never answers clicks 4 and 8 at all. The two methods differ on these events.' },
          { text: 'Clicks 3 and 4 wait until impressions 6 and 7 arrive.', correct: false,
            why: 'A lookup never waits. That is its whole appeal, and here its weakness.' }
        ]
      },
      narration: [
        'One last question. Someone treats the impression stream as if it were a settled table, and looks each click up on arrival. What happens? Choose an answer.',
        'Every click is answered at once, but clicks 3 and 4 get short totals, 7 instead of 11 and 20. Windowing a table adds a needless wait; looking up a late stream gives short answers.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'One waits for a partner; the other trusts a table',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Windowed join</b>', 'Two streams, rows within 60 seconds of each other: 5 of 20 pairs match, and one click matches 2.[[src:why]]'] },
          { step: 0, cells: ['<b>Buffer</b> and <b>watermark</b>', 'Rows kept waiting, and each stream’s promise of when to stop waiting.[[src:flow]]'] },
          { step: 1, cells: ['<b>Temporal join</b>', 'One lookup per row, in a table as of that row’s event time. Click 3 → 11; clicks 0 and 1 → null.[[src:why]]'] },
          { step: 1, cells: ['<b>History</b>', 'The earlier values a table keeps. Without it, “as of” cannot be answered.[[src:why]]'] },
          { step: 2, cells: ['<b>The common bug</b>', 'Windowing a table, or looking up a late stream. Ask: could this side still change an old answer?[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>A windowed join may already have published an answer when a late row contradicts it — even an answer of “no match”. Part 3 counts what a correct join actually delivers.</p>' },
      narration: [
        'To recap. A windowed join pairs rows of two streams within a window: 5 of 20 pairs here. It needs a buffer, and each stream’s watermark to know when to stop waiting.',
        'A temporal join makes one lookup per row, in a table as of that row’s event time. It needs the table’s history, and that history must be complete for the time asked.',
        'The common bug is choosing the wrong one for the input. Ask whether the other side could still produce a row that changes an old answer.',
        'Next, part 3: a late row can contradict an answer already published, even an answer of no match. It counts what a correct join actually delivers.'
      ]
    }
  ]
};
