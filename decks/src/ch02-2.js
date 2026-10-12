// Chapter 2, Part 2 — "When": triggers decide when a window's result is published, and the
// watermark lets a trigger claim the window is complete. The phones, the two clocks and every
// word are introduced from zero; the viewer answers before each mechanism; the clock trigger,
// the watermark and the allowed-lateness threshold are all computed here from the one seed
// (tools/stream_seed.js), and asserted, so the narration cannot drift from the chapter.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch02';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const wm = s => (s < 0 ? 'before 12:00' : clock(s));
const seenAt = e => (e.id === 5 ? '12:04, after id 4' : clock(e.pt));
const W0 = seed.WINDOWS[0];
const END = seed.WIN;
const inW0 = id => W0.includes(id);
const sumSeenBy = t => E.filter(e => inW0(e.id) && e.pt <= t).reduce((a, e) => a + e.v, 0);
const TICKS = [60, 120, 180, 240, 300];
const CLOCK = TICKS.map(sumSeenBy);
const WM = seed.WATERMARKS;
const MAXSEEN = E.map((_, i) => Math.max(...E.slice(0, i + 1).map(e => e.et)));
const ONTIME_I = WM.findIndex(w => w >= END);
const ONTIME = sumSeenBy(E[ONTIME_I].pt);
const EARLY = TICKS.filter(t => t < E[ONTIME_I].pt).map(sumSeenBy);
const L = E.findIndex(e => e.id === 7);
const NEED = WM[L] - END + 1;                                     // least allowed lateness that keeps the state
const TRIES = [60, 80, 81, 230];
const LANDS = TRIES.map(a => (WM[L] < END + a ? 'yes' : 'no'));

if (seed.SUM(W0) !== 19 || W0.join() !== '0,1,2,7' || CLOCK.join() !== '8,15,15,15,19' || ONTIME_I !== 4 || ONTIME !== 15
  || EARLY.join() !== '8,15,15,15' || WM[ONTIME_I] !== 185 || WM[L] !== 200 || NEED !== 81 || LANDS.join() !== 'no,no,yes,yes'
  || E[L].et !== 50 || E[L].pt !== 280 || E[L].pt - E[L].et !== 230 || seed.LAG !== 60 || EARLY.length + 2 !== 6)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'When to Publish',
  eyebrow: 'Streaming · Ch 2 · Part 2',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'trigger', 'processing-time trigger',
    'watermark', 'on-time trigger', 'late trigger', 'early trigger', 'pane', 'state', 'allowed lateness'],
  sources: {
    ch:   chapter(CH, 'Chapter 2 on GitHub'),
    flow: section(CH, 'When — triggers and watermarks', 'Chapter 2 · when'),
    why:  section(CH, 'Why "when" is a processing-time decision about an event-time question', 'Chapter 2 · why when is a decision'),
    use:  section(CH, 'When to use each trigger, and what allowed lateness costs', 'Chapter 2 · when to use each trigger'),
    walk: section(CH, 'Visual walkthrough — a clock trigger, a watermark trigger, and one threshold', 'Chapter 2 · the walkthrough'),
    prog: section(CH, 'When — stack and heap at every step', 'Chapter 2 · when, as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 2 · Part 2',
      heading: 'One 2-minute window, and the question of when to announce its total',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a message with its value: an <b>event</b>. Events never stop coming: a <b>stream</b>. The <b>pipeline</b> is the program that adds them up, in 2-minute slices of time called <b>windows</b>: 12:00 to 12:02, 12:02 to 12:04…[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: seed.SUM(W0), label: 'the true total of window 12:00 to 12:02[[src:why]]' },
        { step: 2, value: 6, label: 'times that one window’s total is announced[[src:prog]]' },
        { step: 2, value: NEED, suffix: ' s', label: 'the setting that decides whether the last one is right[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'When may a total go out?', text: 'The stream never ends, so “when it is all in” never comes.' },
        { step: 3, n: 2, title: 'What can the pipeline rely on?', text: 'A clock, or something that knows about the events?' },
        { step: 4, n: 3, title: 'What about a purchase that turns up late?', text: 'Can it still change a total already announced?' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a message with its value, called an event. The events never stop: a stream. The pipeline is the program that adds them up.',
        'It adds them in 2-minute slices of time called windows: 12:00 to 12:02, then 12:02 to 12:04, and so on. Our example has 9 events. The first window’s true total is 19.',
        'Yet that one window’s total will be announced 6 times, and whether the last one is right depends on a single setting of 81 seconds.',
        'Three questions. When may a total go out, if the stream never ends? And what can the pipeline rely on to decide: a clock, or something that knows about the events?',
        'And what happens to a purchase that turns up after its total was announced? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Clocks', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. The bold ones belong to the window 12:00 to 12:02.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: inW0(e.id) ? [`<b>id ${e.id}</b>`, e.key, `<b>${clock(e.et)}</b>`, `<b>${seenAt(e)}</b>`, `<b>${e.v}</b>`]
            : [`id ${e.id}`, e.key, clock(e.et), seenAt(e), `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li>Windows are cut by event time. Totals go out in processing time.[[src:why]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened at 12:00:01, seen at 12:00:02.',
        'Ids 0, 1 and 2 happened inside 12:00 to 12:02, and were seen within seconds. So were most others: id 4 happened at 12:04:05 and was seen at 12:04:06.',
        'But id 7 happened at 12:00:50, inside the first window, and was not seen until 12:04:40, because its phone was offline. That is 230 seconds late.',
        'So windows are cut by event time, but a total can only go out at some moment of processing time. Choosing that moment is the subject of this part.'
      ]
    },

    /* ---------- 3 · question: is it ready at 12:02? ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['trigger'],
      eyebrow: '03 · Your turn',
      heading: 'The wall clock reads 12:02:00',
      stand: 'The window 12:00 to 12:02 has just ended on the wall clock. Ids 0, 1 and 2 have been seen; their values add to 15.',
      question: {
        step: 0,
        prompt: 'Is 15 the window’s final total at 12:02:00?',
        options: [
          { text: 'No: id 7 happened inside it but is not seen until 12:04:40.', correct: true,
            why: 'Events of a window can keep arriving long after the window ends on the wall clock.' },
          { text: 'Yes: the window’s two minutes are over.', correct: false,
            why: 'The two minutes are over in event time, but a delayed event can still be on its way.' },
          { text: 'Yes: every event before 12:02 has already been seen.', correct: false,
            why: 'Id 7, from 12:00:50, has not. The pipeline has no way to know what is still coming.' }
        ]
      },
      cards: [
        { step: 1, title: 'Something must decide', html: '<p>No moment is certain to be complete, so the pipeline needs a rule that says “announce the total now”. That rule is a <b>trigger</b>.[[src:flow]]</p>' },
        { step: 2, title: 'Kinds of trigger', html: '<p>A trigger can fire on the clock, on progress through event time, or on a count of events. Each reacts to something different.[[src:flow]]</p>' }
      ],
      narration: [
        'First question. The wall clock reads 12:02:00, so the first window has just ended. Ids 0, 1 and 2 have been seen, adding to 15. Is 15 the final total? Choose an answer.',
        'No. Id 7 happened inside the window but is not seen until 12:04:40. No moment is certain to be complete, so the pipeline needs a rule that says: announce the total now. That rule is called a trigger.',
        'A trigger can fire on the clock, on progress through event time, or on a count of events. Let us try the simplest first: the clock.'
      ]
    },

    /* ---------- 4 · the clock trigger ---------- */
    {
      title: 'Clock', layout: 'timeline', defines: ['processing-time trigger'],
      eyebrow: '04 · Watch a trigger that fires every minute',
      heading: 'Fire every 60 seconds, and announce whatever has arrived',
      stand: 'Wall-clock moments, left to right. Below, the four events of the window 12:00 to 12:02.',
      timeline: [
        { step: 0, time: clock(TICKS[0]), title: `announces ${CLOCK[0]}`, text: 'Ids 0 and 1 are in.[[src:why]]' },
        { step: 1, time: clock(TICKS[1]), title: `announces ${CLOCK[1]}`, text: 'Id 2 arrived at 12:01:33.[[src:why]]' },
        { step: 1, time: clock(TICKS[2]), title: `announces ${CLOCK[2]}`, text: 'Nothing new.' },
        { step: 2, time: clock(TICKS[3]), title: `announces ${CLOCK[3]}`, text: 'Nothing new.' },
        { step: 3, time: clock(TICKS[4]), title: `announces ${CLOCK[4]}`, text: 'Id 7 came at 12:04:40.[[src:walk]]' }
      ],
      strip: {
        step: 0, label: 'Events of window 12:00 to 12:02, by when they were seen',
        items: [
          { n: 'id 0', text: 'value 5 · 12:00:02' }, { n: 'id 1', text: 'value 3 · 12:00:04' },
          { n: 'id 2', text: 'value 7 · 12:01:33', tone: 'ok' }, { n: 'id 7', text: 'value 4 · 12:04:40', tone: 'warn' }
        ]
      },
      narration: [
        'A trigger that fires on the wall clock is called a processing-time trigger. This one fires every 60 seconds. At 12:01:00, ids 0 and 1 are in, so it announces 8.',
        'At 12:02:00, id 2 has arrived, so it announces 15. At 12:03:00, nothing new: 15 again.',
        'At 12:04:00, still 15. The clock never stalls, which is its real virtue: a reader gets a number on schedule.',
        'At 12:05:00, id 7 has arrived, and it announces 19. That is the right answer at last, but nothing about this firing says so.'
      ]
    },

    /* ---------- 5 · question: which one is final? ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '05 · Your turn',
      heading: 'Five announcements: 8, 15, 15, 15, 19',
      stand: 'A reader watches the numbers arrive, one a minute.',
      question: {
        step: 0,
        prompt: 'At the moment each number arrives, which one can the reader tell is final?',
        options: [
          { text: 'None of them: each looks exactly like the ones before.', correct: true,
            why: 'The clock trigger only knows the time. It cannot tell which firing has every event in it.' },
          { text: 'The 19, because it is the largest.', correct: false,
            why: 'Only hindsight says so. At 12:05:00 another late event could still have been on its way.' },
          { text: 'The third 15, because it repeated twice.', correct: false,
            why: 'Repeats only mean nothing arrived that minute. Id 7 was still to come.' }
        ]
      },
      cards: [
        { step: 1, title: 'Fine for a dashboard', html: '<p>Use a clock trigger when a reader needs a number on a schedule and can live with it being provisional.[[src:use]]</p>' },
        { step: 2, title: 'Not an answer', html: '<p>To claim a total is complete, the trigger must react to the events themselves, not to the wall clock.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. A reader watches 8, 15, 15, 15 and 19 arrive, one a minute. At the moment each arrives, which one can the reader tell is final? Choose an answer.',
        'None. Each looks exactly like the ones before. The clock trigger only knows the time; it cannot tell which firing has every event in it. That is fine for a live dashboard.',
        'But a total that someone will quote needs a claim attached: this window is complete. That claim must come from the events, not the wall clock.'
      ]
    },

    /* ---------- 6 · question: how to judge completeness ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['watermark'],
      eyebrow: '06 · Your turn',
      heading: 'The pipeline cannot see the future. What can it use?',
      stand: 'Most events are seen within seconds of happening. A few straggle.',
      question: {
        step: 0,
        prompt: 'From the events already seen, how could the pipeline judge which event times are complete?',
        options: [
          { text: 'The latest event time seen so far, minus a safety margin.', correct: true,
            why: 'Events are mostly close to the newest one, so “a margin behind the newest” is a sensible guess that needs no future.' },
          { text: 'The earliest event time seen so far, plus a safety margin.', correct: false,
            why: 'The earliest is 12:00:01 and never changes, so the judgement would never move and no window would close.' },
          { text: 'The wall clock now, minus a safety margin.', correct: false,
            why: 'The wall clock says nothing about the events. A phone offline for an hour breaks it completely.' }
        ]
      },
      cards: [
        { step: 1, title: 'A watermark', html: '<p>The statement “no event earlier than this event time will still arrive” is a <b>watermark</b>. Here: the latest event time seen, minus <b>60 s</b>.[[src:flow]]</p>' },
        { step: 2, title: 'A best estimate', html: '<p>It is the pipeline’s best estimate of how complete event time is. It lets a trigger close a window, and it can be wrong.[[src:flow]]</p>' }
      ],
      narration: [
        'Third question. The pipeline cannot see the future. From the events already seen, how could it judge which event times are complete? Choose an answer.',
        'Take the latest event time seen so far, and subtract a margin: here, 60 seconds. The statement that no event earlier than this will still arrive is called a watermark.',
        'It is only the pipeline’s best estimate of how complete event time is. But it lets a trigger say something the clock never could. Watch it being worked out.'
      ]
    },

    /* ---------- 7 · the watermark, animated ---------- */
    {
      title: 'Mark', layout: 'array',
      eyebrow: '07 · Watch the watermark after each event',
      heading: 'The latest event time seen, minus 60 seconds',
      stand: 'Slots are the events in the order they were seen. The window 12:00 to 12:02 is complete, says the watermark, once it reaches 12:02:00.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => clock(e.et)) },
          { label: 'latest so far', values: MAXSEEN.map(clock) },
          { label: 'watermark', values: WM.map(wm) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1, 2] },
          { step: 2, do: 'pick', slots: [ONTIME_I] }
        ]
      },
      cards: [
        { step: 1, title: 'Only forward', html: '<p>The latest time seen never shrinks, so the watermark never moves back. Ids 6 and 7 happened earlier and change nothing.[[src:why]]</p>' },
        { step: 2, title: 'Id 4 crosses 12:02', html: '<p>Seen at 12:04:06, id 4 lifts the watermark from 12:01:10 to <b>12:03:05</b>, past the window’s end, in a single event.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen. The first row is when each happened. Notice ids 6 and 7 go backwards.',
        'The second row keeps the latest event time seen so far; the third subtracts 60 seconds. That is the watermark. It never moves back, because the latest time seen never shrinks.',
        'Look at id 4, seen at 12:04:06. It lifts the watermark from 12:01:10 to 12:03:05 in one jump, past 12:02. The pipeline now claims the first window is complete.'
      ]
    },

    /* ---------- 8 · question: what the on-time trigger announces ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['on-time trigger'],
      eyebrow: '08 · Your turn',
      heading: 'The watermark passes 12:02. The trigger fires.',
      stand: 'A new trigger fires once, when the watermark passes the window’s end. That happens at 12:04:06, as id 4 is seen.',
      question: {
        step: 0,
        prompt: 'What total does this trigger announce for the window 12:00 to 12:02?',
        options: [
          { text: '15: ids 0, 1 and 2 are in, and id 7 is not.', correct: true,
            why: 'At 12:04:06 id 7 is still on its way. The window holds 5, 3 and 7.' },
          { text: '19: the watermark says the window is complete.', correct: false,
            why: 'The watermark only claims completeness. Id 7 has not arrived, so the claim is wrong.' },
          { text: '8: only ids 0 and 1 count once the window ends.', correct: false,
            why: 'Id 2 happened at 12:01:30, inside the window, and was seen at 12:01:33. It counts.' }
        ]
      },
      cards: [
        { step: 1, title: 'The on-time trigger', html: '<p>Firing when the watermark passes the window’s end is the <b>on-time trigger</b>. It fires exactly once, with a claim attached: complete.[[src:flow]]</p>' },
        { step: 2, title: 'The claim and the error', html: '<p>15, not 19. The claim of completeness and the mistake are the same moment: the watermark was the best estimate, and it was wrong.[[src:why]]</p>' }
      ],
      narration: [
        'Fourth question. A trigger fires when the watermark passes the window’s end: at 12:04:06, as id 4 is seen. What total does it announce for 12:00 to 12:02? Choose an answer.',
        '15. Ids 0, 1 and 2 are in; id 7 is still on its way. Firing when the watermark passes the window’s end is called the on-time trigger. It fires once, and claims the window is complete.',
        'And the claim is wrong. 15, not 19. The moment of the claim and the moment of the error are the same: the watermark was the best estimate, and it was wrong.'
      ]
    },

    /* ---------- 9 · question: the straggler ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['late trigger'],
      eyebrow: '09 · Your turn',
      heading: 'At 12:04:40, id 7 finally arrives',
      stand: 'Id 7 happened at 12:00:50, inside the window. 15 has already been announced as complete.',
      question: {
        step: 0,
        prompt: 'What should the pipeline do with id 7?',
        options: [
          { text: 'Add it and announce the corrected total, 19.', correct: true,
            why: 'Correctness outranks simplicity: the window really holds 19, so readers should get it, even late.' },
          { text: 'Drop it: the window was already declared complete.', correct: false,
            why: 'Then 15 stands forever, 21% low, for a purchase that really happened.' },
          { text: 'Count it in the window 12:04 to 12:06, when it was seen.', correct: false,
            why: 'Windows are cut by event time. Id 7 happened at 12:00:50 and belongs to the first window.' }
        ]
      },
      cards: [
        { step: 1, title: 'The late trigger', html: '<p>A trigger that fires after the watermark, once for each straggler, is a <b>late trigger</b>. Here it announces <b>19</b> at 12:04:40.[[src:why]]</p>' },
        { step: 2, title: 'Numbers will move', html: '<p>Use late triggers whenever correctness outranks simplicity, and accept that published numbers change.[[src:use]]</p>' }
      ],
      narration: [
        'Fifth question. At 12:04:40, id 7 arrives. It happened at 12:00:50, inside the window, but 15 was already announced as complete. What should the pipeline do? Choose an answer.',
        'Add it and announce the corrected total, 19. A trigger that fires after the watermark, once for each straggler, is called a late trigger. Dropping id 7 would leave 15 standing, 21 percent low.',
        'The price is that a published number moves. So a real pipeline does not choose one trigger: it uses several on the same window. Here are all of them together.'
      ]
    },

    /* ---------- 10 · all firings ---------- */
    {
      title: 'Three', layout: 'timeline', defines: ['early trigger', 'pane'],
      eyebrow: '10 · Watch one window fire three kinds of trigger',
      heading: 'Four early, one on time, one late: six announcements',
      stand: 'Wall-clock moments, left to right. The early trigger stops once the on-time one has fired.',
      timeline: [
        { step: 0, time: clock(TICKS[0]), title: `early ${EARLY[0]}`, text: 'Before the watermark.[[src:why]]' },
        { step: 0, time: clock(TICKS[1]), title: `early ${EARLY[1]}`, text: 'Before the watermark.' },
        { step: 1, time: clock(TICKS[2]), title: `early ${EARLY[2]}`, text: 'Before the watermark.' },
        { step: 1, time: clock(TICKS[3]), title: `early ${EARLY[3]}`, text: 'Before the watermark.[[src:prog]]' },
        { step: 2, time: clock(E[ONTIME_I].pt), title: `on time ${ONTIME}`, text: 'Watermark passes 12:02.[[src:why]]' },
        { step: 3, time: clock(E[L].pt), title: `late ${seed.SUM(W0)}`, text: 'Id 7 arrives.[[src:why]]' }
      ],
      strip: {
        step: 4, label: 'Three kinds of reader, three triggers',
        items: [
          { n: 'early', text: 'a live dashboard', tone: 'ok' }, { n: 'on time', text: 'a report someone quotes' },
          { n: 'late', text: 'anyone who needs it right', tone: 'warn' }
        ]
      },
      narration: [
        'A trigger that fires before the watermark, on the clock, is called an early trigger. Its results are speculative. Each announced result is called a pane: here, 8 at 12:01:00, then 15 at 12:02:00.',
        'Then 15 at 12:03:00 and 15 at 12:04:00: four early panes, every one before the watermark passes 12:02.',
        'At 12:04:06 the watermark passes 12:02, and the on-time trigger announces 15, with a claim that the window is complete.',
        'At 12:04:40 id 7 arrives, and the late trigger announces 19. Six panes for one window, and only the last is right.',
        'They serve three different readers: a live dashboard, a report someone will quote, and anyone who needs the right answer. All three fire.'
      ]
    },

    /* ---------- 11 · question: allowed lateness ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['state', 'allowed lateness'],
      eyebrow: '11 · Your turn',
      heading: 'How long should a window’s running total be kept?',
      stand: 'Each open window keeps its running total in memory. After the watermark passes the window’s end, that memory is kept for a set time, then freed. When id 7 arrives, the watermark stands at 12:03:20.',
      question: {
        step: 0,
        prompt: 'What is the least waiting time, after the window’s end at 12:02, that still lets id 7 turn 15 into 19?',
        options: [
          { text: '81 s: the watermark is 80 s past 12:02 when id 7 lands.', correct: true,
            why: 'The memory survives while the watermark is below 12:02 plus the wait. 12:03:20 is below 12:03:21, but not below 12:03:20.' },
          { text: '230 s: id 7 was seen 230 s after it happened.', correct: false,
            why: '230 s is how late id 7 was, but the wait is measured against the watermark, not against the event.' },
          { text: '60 s: the same margin the watermark already uses.', correct: false,
            why: 'At 60 s the memory is freed once the watermark reaches 12:03:00, before id 7 arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'State, and allowed lateness', html: '<p>What a window remembers between events, its running total, is its <b>state</b>. How long state is kept after the watermark passes the window’s end is the <b>allowed lateness</b>.[[src:flow]]</p>' },
        { step: 2, title: 'Not the 230 s', html: '<p>81 s comes from where the watermark stood, 12:03:20, not from id 7’s 230 s delay. The setting is measured against the watermark, not the data.[[src:why]]</p>' }
      ],
      narration: [
        'Sixth question. A window keeps its running total in memory, and after the watermark passes its end, keeps it for a set time. What is the least time that lets id 7 still turn 15 into 19? Choose an answer.',
        '81 seconds. What a window remembers between events is called its state, and how long it is kept after the watermark passes is called the allowed lateness. When id 7 lands, the watermark is 80 seconds past 12:02.',
        'Note that 81 is not id 7’s 230 seconds of delay, the number most people guess. It comes from where the watermark stood. Watch the comparison for four settings.'
      ]
    },

    /* ---------- 12 · the threshold, animated ---------- */
    {
      title: 'Lands', layout: 'array',
      eyebrow: '12 · Watch four allowed-lateness settings meet id 7',
      heading: 'One second decides between 15 and 19',
      stand: 'When id 7 arrives, the watermark is 12:03:20. The state survives only if that is before 12:02 plus the allowed lateness.',
      array: {
        labelWidth: 170, slotLabel: 'setting',
        rows: [
          { label: 'allowed lateness', values: TRIES.map(a => `${a} s`) },
          { label: 'state kept until', values: TRIES.map(a => clock(END + a)) },
          { label: 'id 7 lands?', values: LANDS }
        ],
        meters: ['settings checked', 'corrected to 19'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 500 },
          { step: 2, do: 'pick', rows: [0, 1], slots: [1, 2] }
        ]
      },
      cards: [
        { step: 2, title: '80 s against 81 s', html: '<p>At 80 s the state is gone at 12:03:20, the very moment id 7 lands: 15 stands forever. At 81 s it survives, and 19 follows.[[src:prog]]</p>' },
        { step: 3, title: 'What it costs', html: '<p>Kept state is memory: open windows × state per window. With 4 windows it is nothing; with a million open windows it is the main cost.[[src:use]]</p>' }
      ],
      narration: [
        'Here are four allowed-lateness settings, and the moment each frees the window’s state: 12:02 plus the setting.',
        'When id 7 arrives, the watermark is 12:03:20. Watch each setting checked: 60 and 80 have already freed the state, so id 7 is dropped. 81 and 230 still hold it, so 19 goes out.',
        'Look at 80 and 81 side by side. One second of configuration decides between 15 forever and the corrected 19.',
        'But kept state is memory: the number of open windows times the state each holds. With 4 windows it costs nothing; with a million open windows it is the pipeline’s main cost.'
      ]
    },

    /* ---------- 13 · which trigger when ---------- */
    {
      title: 'Use', layout: 'cards',
      eyebrow: '13 · Which trigger for which reader',
      heading: 'A schedule, an answer, or a correction',
      stand: 'Each trigger reacts to something different, and serves a different reader.',
      columns: 3,
      cards: [
        { step: 0, title: 'Early: on the clock', html: '<p>For a reader who needs a number on a schedule and accepts it is provisional. It never stalls: a stuck watermark stops other output, a clock does not.[[src:use]]</p>' },
        { step: 1, title: 'On time: at the watermark', html: '<p>For a result meant to be an answer, such as a report. It fires once per window, with a claim of completeness attached.[[src:use]]</p>' },
        { step: 2, title: 'Late: per straggler', html: '<p>When correctness outranks simplicity. Set the allowed lateness from how late events really are, then price the memory.[[src:use]]</p>' }
      ],
      narration: [
        'Which trigger, when? The early trigger, on the clock, serves a reader who needs a number on schedule. It never stalls: if the watermark gets stuck, the clock still fires.',
        'The on-time trigger, at the watermark, serves a result meant to be an answer, like a report. It fires once per window, with a claim of completeness.',
        'The late trigger serves correctness. Set the allowed lateness from how late events really arrive, and then price the memory it keeps.'
      ]
    },

    /* ---------- 14 · check yourself ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '14 · Your turn · check yourself',
      heading: 'A store kept 15. Now 19 arrives.',
      stand: 'A shop’s database stored the on-time pane, 15. Then the late pane, 19, arrives for the same window.',
      question: {
        step: 0,
        prompt: 'Does anything in this part tell the database whether to add 19 to 15, or to replace 15 with it?',
        options: [
          { text: 'No: the triggers decide when, not what a second pane means.', correct: true,
            why: 'Nothing in the numbers says whether 19 is a new total or an extra amount. That is a separate question.' },
          { text: 'Yes: a late pane is always added to the earlier one.', correct: false,
            why: 'Adding would give 34, which is wrong here. Nothing in this part fixes the rule.' },
          { text: 'Yes: the watermark says which pane to keep.', correct: false,
            why: 'The watermark only says when a window is believed complete. It says nothing about pane meaning.' }
        ]
      },
      narration: [
        'Last question. A database stored the on-time pane, 15. Then the late pane, 19, arrives. Does anything in this part say whether to add it, or replace 15 with it? Choose an answer.',
        'No. Triggers decide when a pane goes out, not what a second pane means. Add, and you get 34; replace, and you get 19. That question is how, and it is the subject of part 3.'
      ]
    },

    /* ---------- 15 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '15 · What you now know',
      heading: 'When is a decision in processing time about a question in event time',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when it was seen. Id 7: 12:00:50 and 12:04:40.[[src:why]]'] },
          { step: 0, cells: ['<b>Trigger</b>, <b>pane</b>', 'The rule that says announce now; each announced result is a pane.[[src:flow]]'] },
          { step: 1, cells: ['<b>Watermark</b>', 'Latest event time seen minus 60 s: a claim of completeness, and a best estimate.[[src:why]]'] },
          { step: 1, cells: ['<b>Early</b>, <b>on time</b>, <b>late</b>', '8, 15, 15, 15 on the clock; 15 at 12:04:06; 19 at 12:04:40.[[src:prog]]'] },
          { step: 2, cells: ['<b>Allowed lateness</b>', 'How long state is kept past the watermark: at least 81 s here, set by the watermark, not the 230 s.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>One window produced 6 panes. Part 3 asks <b>how</b> a reader should combine them, and finds the same window ending on 19, 34 or 4.[[src:use]]</p>' },
      narration: [
        'To recap. Every event has an event time, when it happened, and a processing time, when it was seen. A trigger is the rule that says announce now; each result it announces is a pane.',
        'The watermark is the latest event time seen, minus 60 seconds: a claim of completeness, and only a best estimate. It passed 12:02 at 12:04:06.',
        'So the window fired early 4 times, on time with 15, and late with 19. The late one lands only if the allowed lateness is at least 81 seconds.',
        'One window, six panes. Part 3 asks how a reader should combine them, and finds the same window ending on 19, 34 or 4.'
      ]
    }
  ]
};
