// Chapter 3, Part 1 — "What a watermark is", for a viewer who has read nothing before it.
// The story, the two clocks and every word are introduced here; the viewer is asked before
// being told; and the watermark is computed on screen, event by event, rather than described.
// Every time and value comes from the one seed (tools/stream_seed.js), so the deck cannot
// drift from the chapter's own numbers.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch03';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => { const t = 12 * 3600 + s; return `${Math.floor(t / 3600)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`; };
const MAXSEEN = E.map((_, i) => Math.max(...E.slice(0, i + 1).map(e => e.et)));
const WM = seed.WATERMARKS;
const PERFECT = E.map((_, i) => { const rest = E.slice(i + 1); return rest.length ? Math.min(...rest.map(e => e.et)) : null; });
const W0 = seed.WINDOWS[0];
const TRUE0 = seed.SUM(W0);
const CLOSE_H = WM.findIndex(w => w >= seed.WIN);
const CLOSE_P = PERFECT.findIndex(w => w === null || w >= seed.WIN);
const sumBy = c => seed.SUM(W0.filter(id => E.findIndex(e => e.id === id) <= c));
const STALL = PERFECT.filter(w => w === PERFECT[1]).length;

if (E.length !== 9 || seed.LAG !== 60 || TRUE0 !== 19 || CLOSE_H !== 4 || sumBy(CLOSE_H) !== 15 || CLOSE_P !== 7 || sumBy(CLOSE_P) !== 19
  || WM[4] !== 185 || WM[5] !== 200 || WM[6] !== 200 || PERFECT[1] !== 50 || STALL !== 6 || WM[6] - PERFECT[1] !== 150
  || E[CLOSE_P].pt - E[CLOSE_H].pt !== 34 || W0.join() !== '0,1,2,7' || clock(E[4].pt) !== '12:04:06')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'What a Watermark Is',
  eyebrow: 'Streaming · Ch 3 · Part 1',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'out of order', 'watermark',
    'skew', 'monotonic', 'trigger', 'late', 'perfect watermark', 'heuristic'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    what:  section(CH, 'What a watermark is', 'Chapter 3 · what a watermark is'),
    est:   section(CH, 'Why a watermark is an estimate, and what a correct one would cost', 'Chapter 3 · why it is an estimate'),
    avail: section(CH, 'When a perfect watermark is actually available, and what to do otherwise', 'Chapter 3 · when a perfect one exists'),
    walk:  section(CH, 'Visual walkthrough — monotonicity, the claim, and the perfect alternative', 'Chapter 3 · the walkthrough'),
    prog:  section(CH, 'The watermark, computed two ways — stack and heap at every step', 'Chapter 3 · the watermark as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 3 · Part 1',
      heading: 'Nine messages from two phones, and a total that has to be announced',
      hero: { step: 0, text: 'An app on two phones, <b>a</b> and <b>b</b>, sends a message each time something happens. Each message is an <b>event</b>, and carries a small number, its value. Events keep coming with no end: a <b>stream</b>. The program that receives them is the <b>pipeline</b>.[[src:what]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example[[src:est]]' },
        { step: 1, value: 120, suffix: ' s', label: 'per window: 12:00 to 12:02, 12:02 to 12:04…' },
        { step: 2, value: TRUE0, label: 'the true total of window 12:00 to 12:02[[src:est]]' },
        { step: 2, value: sumBy(CLOSE_H), label: 'the total the pipeline actually announced[[src:est]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'When may a total be announced?', text: 'The stream never ends, so “when everything is in” never comes.' },
        { step: 3, n: 2, title: 'What does the pipeline use to decide?', text: 'One number that only moves forward.' },
        { step: 4, n: 3, title: 'Why was it 15, not 19?', text: 'And what the right answer would have cost.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app on two phones, a and b, sends a message each time something happens. Each message is called an event, and carries a small number, its value. The events never stop: that is a stream.',
        'The program that receives the stream is called the pipeline. Our example has 9 events. The pipeline adds up the values in 2-minute slices of time, called windows: 12:00 to 12:02, then 12:02 to 12:04, and so on.',
        'The true total of the first window is 19. But the pipeline announced 15. By the end of this part you will know exactly why, and what 19 would have cost.',
        'Three questions. When may the pipeline announce a window’s total, if the stream never ends? And what does it use to decide?',
        'And why was the announced total 15 instead of 19? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Each carries two times.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 6 || i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Id 6 and id 7 are.[[src:est]]</li></ul>' },
      narration: [
        'Each event carries two times. The first is when it happened, stamped by the phone: its event time. The second is when the pipeline saw it: its processing time. Id 0 happened at 12:00:01 and was seen at 12:00:02.',
        'Usually the two are seconds apart. Id 4 happened at 12:04:05 and was seen one second later. Id 5 happened at 12:04:20.',
        'But look at id 6: it happened at 12:03:40, earlier than id 5, yet arrived after it. And id 7 happened at 12:00:50 and was not seen until 12:04:40. Its phone was offline.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. Event time going backwards twice is the whole problem of this chapter.'
      ]
    },

    /* ---------- 3 · question: when to announce ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['watermark'],
      eyebrow: '03 · Your turn',
      heading: 'The first window covers 12:00 to 12:02. When can its total go out?',
      stand: 'Window 12:00 to 12:02 holds every event whose event time falls inside it, whenever it is seen.',
      question: {
        step: 0,
        prompt: 'When should the pipeline announce the total for the window 12:00 to 12:02?',
        options: [
          { text: 'As soon as the wall clock reads 12:02.', correct: false,
            why: 'Id 7 happened at 12:00:50 but is seen at 12:04:40. A wall clock cannot say what is still on its way.' },
          { text: 'When it judges that nothing from before 12:02 is still coming.', correct: true,
            why: 'That is the only moment that makes sense, and it has to be a judgement: nothing in the stream says so for certain.' },
          { text: 'Only once every event of the stream has arrived.', correct: false,
            why: 'The stream never ends, so that moment never comes, and the total would never be announced.' }
        ]
      },
      cards: [
        { step: 1, title: 'A judgement, made explicit', html: '<p>The pipeline needs one number saying “I believe everything before this event time has arrived”. That number is the <b>watermark</b>.[[src:what]]</p>' },
        { step: 2, title: 'In event time, not on the wall', html: '<p>A watermark of 12:02 talks about when things happened, not about what time it is now.[[src:what]]</p>' }
      ],
      narration: [
        'First question. The window 12:00 to 12:02 holds every event that happened in it, whenever it is seen. When should its total be announced? Choose an answer.',
        'When the pipeline judges that nothing from before 12:02 is still coming. The number that states that judgement is called the watermark: everything with an earlier event time is believed to be in.',
        'Notice it is an event time, not a wall-clock reading. A watermark of 12:02 talks about when things happened, not about what time it is now.'
      ]
    },

    /* ---------- 4 · question: how to estimate it ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['skew'],
      eyebrow: '04 · Your turn',
      heading: 'The pipeline cannot see the future. What can it use?',
      stand: 'After id 4, the latest event time seen is 12:04:05. Most events arrive within seconds; a few straggle.',
      question: {
        step: 0,
        prompt: 'From what it has already seen, how could the pipeline estimate its watermark?',
        options: [
          { text: 'The latest event time seen so far, minus a safety margin.', correct: true,
            why: 'Events are mostly near the newest one, so “a margin behind the newest” is a sensible guess, and it never needs the future.' },
          { text: 'The earliest event time seen so far, plus a safety margin.', correct: false,
            why: 'The earliest is 12:00:01 and never changes, so the watermark would never move, and no window would ever close.' },
          { text: 'The wall clock now, minus a safety margin.', correct: false,
            why: 'The wall clock says nothing about which events happened. A phone offline for an hour breaks it completely.' }
        ]
      },
      cards: [
        { step: 1, title: 'The chapter’s formula', html: '<p>watermark = the latest event time seen − a margin. In this chapter the margin is <b>60 s</b>, and it is called the <b>skew</b>.[[src:what]]</p>' },
        { step: 2, title: 'After id 4', html: '<p>12:04:05 − 60 s = <b>12:03:05</b>. The pipeline now believes everything before 12:03:05 has arrived.[[src:est]]</p>' }
      ],
      narration: [
        'Second question. The pipeline cannot see the future. From what it has already seen, how could it estimate its watermark? Choose an answer.',
        'Take the latest event time seen so far, and subtract a safety margin. Here the margin is 60 seconds, and it is called the skew: how far out of order events are allowed to be.',
        'After id 4, the latest event time is 12:04:05. Minus 60 seconds gives 12:03:05. Let us watch this being worked out for every event.'
      ]
    },

    /* ---------- 5 · the watermark, animated ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '05 · Watch the watermark being worked out',
      heading: 'One number per event: the latest seen, minus 60 seconds',
      stand: 'Slots are the events in arrival order. Row 1: each event time. Row 2: the latest event time so far. Row 3: that, minus 60 seconds.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'event time', values: E.map(e => clock(e.et)) },
          { label: 'latest so far', values: MAXSEEN.map(clock) },
          { label: 'watermark', values: WM.map(clock) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'show', rows: [2] },
          { step: 3, do: 'pick', slots: [4] }
        ]
      },
      cards: [
        { step: 1, title: 'Latest so far', html: '<p>Each slot keeps the larger of the new event time and the one before. At ids 6 and 7 the event time is smaller, so it stays 12:04:20.[[src:est]]</p>' },
        { step: 3, title: 'After id 4', html: '<p>Latest 12:04:05, watermark <b>12:03:05</b>. The wall clock then reads 12:04:06, when id 4 is seen.[[src:est]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they arrived, numbered along the top. The first row is each event time. Notice it jumps around: id 6 and id 7 go backwards.',
        'The second row keeps the latest event time seen so far: each slot is the larger of the new time and the previous slot. At ids 6 and 7 the event time is smaller, so it stays at 12:04:20.',
        'The third row subtracts the 60-second skew. That is the watermark after each event: 12:03:05 after id 4, then 12:03:20, and 12:08:00 at the very end.',
        'Look at id 4, highlighted. The latest event time is 12:04:05, so the watermark is 12:03:05. Keep that slot in mind for the next two questions.'
      ]
    },

    /* ---------- 6 · question: the out-of-order event ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['monotonic'],
      eyebrow: '06 · Your turn',
      heading: 'An older event arrives. What happens to the watermark?',
      stand: 'The watermark is 12:03:20 after id 5. Then id 6 arrives, which happened at 12:03:40, earlier than id 5.',
      question: {
        step: 0,
        prompt: 'When id 6 (happened 12:03:40) arrives after id 5 (12:04:20), what does the watermark do?',
        options: [
          { text: 'It drops back to 12:02:40, which is 12:03:40 minus 60 s.', correct: false,
            why: 'That would use only this event’s time. The formula uses the latest time seen, which is still 12:04:20.' },
          { text: 'It stays at 12:03:20: the latest time seen has not changed.', correct: true,
            why: 'A smaller event time cannot change the latest one seen, so the watermark simply does not move.' },
          { text: 'It jumps ahead, because one more event has arrived.', correct: false,
            why: 'Arriving does not move it. Only an event time later than any seen before can.' }
        ]
      },
      cards: [
        { step: 1, title: 'Only forward', html: '<p>Because it is built from the <b>latest</b> time seen, which can never shrink, the watermark never goes back. A number that only moves forward is called <b>monotonic</b>.[[src:est]]</p>' },
        { step: 2, title: 'Why that matters', html: '<p>Once the watermark passes a point, the pipeline declares it will not see an earlier event time again. A window can then be closed once, and never re-opened.[[src:walk]]</p>' }
      ],
      narration: [
        'Third question. After id 5 the watermark is 12:03:20. Then id 6 arrives, which happened earlier, at 12:03:40. What does the watermark do? Choose an answer.',
        'It stays at 12:03:20. The latest time seen is still 12:04:20, so nothing changes. A number that can only move forward, never back, is called monotonic.',
        'That is not luck; it is why the formula uses the latest time seen. Once the watermark passes a point, it never goes back, so a window is closed once and never re-opened.'
      ]
    },

    /* ---------- 7 · question: claim, not clock ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '07 · Your turn',
      heading: 'Two times at one moment',
      stand: 'Just after id 4 is seen, the watermark is 12:03:05 and the wall clock reads 12:04:06.',
      question: {
        step: 0,
        prompt: 'What does the watermark of 12:03:05 actually say?',
        options: [
          { text: 'That the time now is 12:03:05, a little behind the wall clock.', correct: false,
            why: 'It is not a clock at all. It is measured in event time, and the two are not comparable numbers.' },
          { text: 'That every event before 12:03:05 is believed to have arrived.', correct: true,
            why: 'It is a claim about completeness: the pipeline’s best estimate, and nothing more.' },
          { text: 'That the next event to arrive happened at 12:03:05.', correct: false,
            why: 'It says nothing about the next event. The next one, id 5, happened at 12:04:20.' }
        ]
      },
      cards: [
        { step: 1, title: 'A claim, not a reading', html: '<p>The wall clock says what time it is. The watermark says which events can still arrive. Not the same kind of number.[[src:est]]</p>' },
        { step: 2, title: 'And this claim is false', html: '<p>Id 7 happened at 12:00:50, well before 12:03:05, and has not arrived yet. It will be seen at 12:04:40.[[src:est]]</p>' }
      ],
      narration: [
        'Fourth question. Just after id 4, the watermark is 12:03:05 and the wall clock reads 12:04:06. What does 12:03:05 actually say? Choose an answer.',
        'That every event before 12:03:05 is believed to have arrived. The wall clock says what time it is; the watermark says which events can still arrive. They are different kinds of number.',
        'And here the claim is false. Id 7 happened at 12:00:50, long before 12:03:05, and has not arrived yet. A watermark is an estimate, not a guarantee.'
      ]
    },

    /* ---------- 8 · the window closes, animated on a timeline ---------- */
    {
      title: 'Close', layout: 'timeline', defines: ['trigger', 'late'],
      eyebrow: '08 · Watch the first window close',
      heading: 'The watermark passes 12:02, the total goes out, and then id 7 arrives',
      stand: 'Wall-clock moments, left to right. Below them, the events of window 12:00 to 12:02 as they land.',
      timeline: [
        { step: 0, time: clock(E[2].pt), title: 'id 2 seen', text: `Watermark ${clock(WM[2])}: still open.` },
        { step: 1, time: clock(E[3].pt), title: 'id 3 seen', text: `Watermark ${clock(WM[3])}: still open.` },
        { step: 2, time: clock(E[4].pt), title: 'id 4 seen', text: `Watermark ${clock(WM[4])}: closes with 15.[[src:est]]` },
        { step: 3, time: clock(E[7].pt), title: 'id 7 seen', text: 'Happened 12:00:50: it is late.[[src:est]]' }
      ],
      strip: {
        step: 0, label: 'Events of window 12:00 to 12:02',
        items: [
          { n: 'id 0', text: 'value 5' }, { n: 'id 1', text: 'value 3' }, { n: 'id 2', text: 'value 7', tone: 'ok' },
          { n: 'id 7', text: 'value 4 · arrives after the close', tone: 'warn' }
        ]
      },
      narration: [
        'Watch the first window on the wall clock. At 12:01:33, id 2 is seen. The watermark is 12:00:30, still before 12:02, so the window stays open. It holds 5, 3 and 7 so far.',
        'At 12:02:12, id 3 is seen. It belongs to the next window. The watermark is 12:01:10: still before the window’s end, so the window still waits.',
        'At 12:04:06, id 4 lifts the watermark to 12:03:05, past 12:02. The rule that fires a window when the watermark passes its end is called a trigger. It fires, and announces 15.',
        'At 12:04:40, id 7 arrives. It happened at 12:00:50, so it belongs in that window, which has already closed. An event like that is called late. The true total was 19.'
      ]
    },

    /* ---------- 9 · question: a watermark that is never wrong ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['perfect watermark', 'heuristic'],
      eyebrow: '09 · Your turn',
      heading: 'Could a watermark ever be right every time?',
      stand: 'Define the ideal: the latest time such that no event before it is still to come.',
      question: {
        step: 0,
        prompt: 'To work out that ideal watermark after each event, what must the pipeline know?',
        options: [
          { text: 'The event times of the events that have not arrived yet.', correct: true,
            why: '“Nothing earlier is still to come” is a statement about the future. Only the events still to come can confirm it.' },
          { text: 'The latest event time seen so far, and nothing else.', correct: false,
            why: 'That is what the estimate uses, and it was wrong about id 7. The past cannot vouch for the future.' },
          { text: 'The wall clock, measured very precisely.', correct: false,
            why: 'Precision does not help: no clock can tell that a phone is offline holding an old event.' }
        ]
      },
      cards: [
        { step: 1, title: 'Perfect watermark', html: '<p>The ideal is called the <b>perfect watermark</b>. It is never wrong, and it needs the events still to come.[[src:est]]</p>' },
        { step: 2, title: 'Heuristic watermark', html: '<p>A <b>heuristic</b> is a rule of thumb. “Latest seen minus skew” is a heuristic watermark: usable now, sometimes wrong.[[src:what]]</p>' }
      ],
      narration: [
        'Fifth question. Imagine an ideal watermark: the latest time such that no event before it is still to come. To work it out, what must the pipeline know? Choose an answer.',
        'The event times of the events that have not arrived yet. The ideal is called the perfect watermark. It is never wrong, but it needs the future.',
        'A rule of thumb is called a heuristic. Latest time seen minus the skew is a heuristic watermark: usable right now, and sometimes wrong. Let us put the two side by side.'
      ]
    },

    /* ---------- 10 · perfect against heuristic, animated ---------- */
    {
      title: 'Stall', layout: 'array',
      eyebrow: '10 · Watch the two watermarks side by side',
      heading: 'The perfect one waits for id 7. The heuristic does not.',
      stand: 'Computed here with the whole stream in hand, which a live pipeline never has.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'heuristic', values: WM.map(clock) },
          { label: 'perfect', values: PERFECT.map(w => (w === null ? 'all in' : clock(w))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [1, 2, 3, 4, 5, 6] }
        ]
      },
      cards: [
        { step: 2, title: 'Stuck for 6 of 9', html: '<p>From id 1 to id 6 the perfect watermark sits at <b>12:00:50</b>, because id 7 is always still to come. Nothing can be announced.[[src:walk]]</p>' },
        { step: 3, title: '150 s of guessing', html: '<p>Over the same span the heuristic reached 12:03:20: 150 s of apparent progress, all of it unverified.[[src:est]]</p>' }
      ],
      narration: [
        'The first row is the heuristic watermark you just watched being made. It climbs steadily, from before noon to 12:08:00.',
        'The second row is the perfect watermark: for each event, the earliest event time among the events still to come. After the last event nothing is left, so everything is in.',
        'Look at ids 1 to 6. The perfect watermark is stuck at 12:00:50 for 6 of the 9 events, because id 7, from 12:00:50, is always still to come. It is correct, and useless: nothing can close.',
        'Over the same span, the heuristic reached 12:03:20. That is 150 seconds of apparent progress, and every second of it is a guess.'
      ]
    },

    /* ---------- 11 · the price, in a table ---------- */
    {
      title: 'Price', layout: 'table',
      eyebrow: '11 · Same window, same trigger, two watermarks',
      heading: '15 now, or 19 thirty-four seconds later',
      stand: 'The trigger is identical; only the watermark feeding it differs.',
      table: {
        columns: ['Watermark', 'Window closes after', 'Announces', 'At (wall clock)', 'Verdict'],
        rows: [
          { step: 0, cells: ['<b>Heuristic</b>', `id ${E[CLOSE_H].id}`, `<b>${sumBy(CLOSE_H)}</b>`, clock(E[CLOSE_H].pt), '21% low[[src:est]]'] },
          { step: 1, cells: ['<b>Perfect</b>', `id ${E[CLOSE_P].id}`, `<b>${sumBy(CLOSE_P)}</b>`, clock(E[CLOSE_P].pt), 'correct, 34 s later[[src:est]]'] }
        ]
      },
      side: { step: 2, title: 'Not a design option', html: '<p>The perfect version needed events that had not arrived. 34 s buys 4 of the 19, but no live pipeline can pay that way.[[src:walk]]</p>' },
      narration: [
        'Feed each watermark to the same trigger. With the heuristic, the window closes after id 4 and announces 15 at 12:04:06. That is 21 percent low.',
        'With the perfect watermark, it closes after id 7 and announces 19 at 12:04:40. Correct, and 34 seconds later.',
        'So 34 seconds buys the missing 4 of the 19. But the perfect version is not a real option: it needed events that had not arrived yet.'
      ]
    },

    /* ---------- 12 · question: when is perfect available ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '12 · Your turn',
      heading: 'Is a perfect watermark ever possible in practice?',
      stand: 'Think about what made id 7 a surprise: it arrived after newer events.',
      question: {
        step: 0,
        prompt: 'When can a real pipeline have a watermark that is never wrong?',
        options: [
          { text: 'When it reads one log that is known to be in time order.', correct: true,
            why: 'Then nothing earlier can ever turn up later, so the last record’s time is exactly how far complete the data is.' },
          { text: 'When it reads from many phones at once.', correct: false,
            why: 'Many phones mean some go offline. That is exactly how id 7 ended up arriving after newer events.' },
          { text: 'When it uses a large skew, such as an hour.', correct: false,
            why: 'A larger margin makes mistakes rarer, but it is still a guess. A phone offline for two hours breaks it.' }
        ]
      },
      cards: [
        { step: 1, title: 'Ordered input only', html: '<p>A single log read in order, or a sorted file replayed: the last time seen <b>is</b> the bound, with no guess in it.[[src:avail]]</p>' },
        { step: 2, title: 'Otherwise, a heuristic', html: '<p>Phones offline, several inputs merged, retries: then only a heuristic is possible. So the heuristic is the normal case.[[src:avail]]</p>' }
      ],
      narration: [
        'Sixth question. When can a real pipeline have a watermark that is never wrong? Choose an answer.',
        'When it reads one log that is known to be in time order, or replays a sorted file. Nothing earlier can turn up later, so the last time seen is exactly the bound.',
        'The moment inputs can arrive out of order, from phones that go offline, from several inputs merged, or from retries, only a heuristic is possible. That is the normal case.'
      ]
    },

    /* ---------- 13 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '13 · Your turn · check yourself',
      heading: 'How to read “the watermark passed 12:02”',
      stand: 'Answer from what you have seen in this part.',
      question: {
        step: 0,
        prompt: 'The watermark has passed 12:02. What is the safest way to read that?',
        options: [
          { text: 'Every event from before 12:02 has now arrived.', correct: false,
            why: 'That is exactly the reading id 7 disproves: it was still on its way when the watermark passed 12:02.' },
          { text: 'The pipeline has decided to stop waiting for that window.', correct: true,
            why: 'It is a decision based on an estimate. Read that way, a late event is a case to design for, not a bug.' },
          { text: 'The wall clock has passed 12:02.', correct: false,
            why: 'The watermark is in event time. It passed 12:02 when the wall clock read 12:04:06.' }
        ]
      },
      narration: [
        'One last question. The watermark has passed 12:02. What is the safest way to read that? Choose an answer.',
        'The pipeline has decided to stop waiting. Read it as complete, and late data looks like a bug. Read it as a decision, and late data is a case you design for.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'Two clocks, one number that moves forward, and its price',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when the pipeline saw it. Id 7: 12:00:50 and 12:04:40.[[src:est]]'] },
          { step: 0, cells: ['<b>Watermark</b>', 'The pipeline’s claim that everything before it has arrived. An estimate, not a guarantee.[[src:what]]'] },
          { step: 1, cells: ['<b>Heuristic</b>, with a <b>skew</b>', 'Latest event time seen, minus 60 s. Monotonic, because the latest seen never shrinks.[[src:est]]'] },
          { step: 1, cells: ['<b>Trigger</b> and <b>late</b>', 'The window closes when the watermark passes its end. Id 7 then arrived late: 15 announced, 19 true.[[src:est]]'] },
          { step: 2, cells: ['<b>Perfect watermark</b>', 'Never wrong, but needs the future: stuck at 12:00:50 for 6 of 9 events. Real only for ordered input.[[src:avail]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>The 60 s skew was simply assumed. Part 2 tries other values and finds the exact one at which 15 becomes 19 — and it is not the one you would guess.[[src:est]]</p>' },
      narration: [
        'To recap. Every event has two times: when it happened, its event time, and when it was seen, its processing time. The watermark is the pipeline’s claim that everything before it has arrived.',
        'The usual watermark is a heuristic: the latest event time seen, minus a skew of 60 seconds. It is monotonic, because the latest time seen can never shrink.',
        'The trigger closes a window when the watermark passes its end. Id 7 then arrived late, so 15 went out instead of 19. A perfect watermark would be right, but it needs the future.',
        'Next, part 2 asks what happens with a different skew. It finds the exact value at which 15 becomes 19, and it is not the value you would guess.'
      ]
    }
  ]
};
