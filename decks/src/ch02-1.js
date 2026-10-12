// Chapter 2, Part 1 — "What and Where": the computation and the slice of event time, shown to
// be two separate choices. The phones, the two clocks and every word are introduced from zero;
// the viewer answers before each mechanism, and each windowing is animated on the seed's own
// nine events (tools/stream_seed.js), so no number can drift from the chapter.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch02';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const W0 = seed.WINDOWS[0];
const W0V = W0.map(id => E[id].v);
const FIXED = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
// sliding: 120 s wide, a new one every 60 s, none starting before 12:00 (the chapter's rule)
const SL_STARTS = [...new Set(E.flatMap(e => [Math.floor(e.et / 60) * 60 - 60, Math.floor(e.et / 60) * 60]).filter(s => s >= 0))].sort((a, b) => a - b);
const SLIDE = SL_STARTS.map(s => ({ s, sum: E.filter(e => e.et >= s && e.et < s + seed.WIN).reduce((a, e) => a + e.v, 0) })).filter(w => w.sum > 0);
const SL_TOTAL = SLIDE.reduce((a, w) => a + w.sum, 0);
const A = E.filter(e => e.key === 'a').sort((x, y) => x.et - y.et);
const B = E.filter(e => e.key === 'b').sort((x, y) => x.et - y.et);
const startsA = A.map((e, i) => (i === 0 || e.et - A[i - 1].et > seed.GAP ? 'new' : 'same'));

if (E.length !== 9 || TOTAL !== 45 || W0.join() !== '0,1,2,7' || seed.SUM(W0) !== 19 || Math.max(...W0V) !== 7
  || new Set(W0.map(id => E[id].key)).size !== 2 || FIXED.join() !== '19,11,7,8' || SLIDE.length !== 7 || SL_TOTAL !== 78
  || SLIDE.map(w => w.sum).join() !== '19,9,11,16,7,8,8' || seed.SESSIONS.a.length !== 3 || seed.SESSIONS.b.length !== 2
  || startsA.join() !== 'new,same,new,same,new' || seed.WIN !== 120 || seed.GAP !== 120)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'What and Where',
  eyebrow: 'Streaming · Ch 2 · Part 1',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'MapReduce': 'map-reduce' } },
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'fixed window', 'windowing',
    'transform', 'global window', 'sliding window', 'session window', 'batch'],
  sources: {
    ch:    chapter(CH, 'Chapter 2 on GitHub'),
    flow:  section(CH, 'What and Where — transformations and windowing', 'Chapter 2 · what and where'),
    why:   section(CH, 'Why these are two questions and not one', 'Chapter 2 · two questions, not one'),
    when:  section(CH, 'When each windowing is the right one, and what batch was doing all along', 'Chapter 2 · when each windowing is right'),
    walk:  section(CH, 'Visual walkthrough — vary one axis, then the other, then both', 'Chapter 2 · the walkthrough'),
    prog:  section(CH, 'What and Where as two arguments — stack and heap at every step', 'Chapter 2 · what and where as a program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 2 · Part 1',
      heading: 'Nine purchases from two phones. What exactly should be added up?',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each time a customer buys something, the phone sends a small message carrying the purchase’s value. Each message is an <b>event</b>. Events keep coming with no end: a <b>stream</b>. The program that receives them and works out answers is the <b>pipeline</b>.[[src:flow]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: 2, label: 'phones, a and b' },
        { step: 2, value: TOTAL, label: 'the value of all nine together[[src:why]]' },
        { step: 2, value: SL_TOTAL, label: 'a total you will also meet, from the same nine[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'What is worked out?', text: 'A total, a count, a largest value…' },
        { step: 3, n: 2, title: 'Over which stretch of time?', text: 'A stream never ends, so “everything” is not a stretch.' },
        { step: 4, n: 3, title: 'One decision, or two?', text: 'Does choosing the first fix the second?' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value. Each message is called an event, and events keep coming with no end: a stream.',
        'The program that receives the stream and works out answers is called the pipeline. Our example has just 9 events, from the 2 phones.',
        'The 9 values add up to 45. Yet by the end of this part you will see the same 9 events give a total of 78, with nothing counted by mistake.',
        'Three questions. What does the pipeline work out: a total, a count, a largest value? And over which stretch of time, when the stream never ends?',
        'And are those one decision, or two? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Clocks', layout: 'table', defines: ['event time', 'processing time', 'key'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Each carries two times.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 7 ? `<b>${clock(e.et)}</b>` : clock(e.et), i === 7 ? `<b>${clock(e.pt)}</b>` : e.id === 5 ? '12:04, just after id 4' : clock(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b. Events can be grouped by it.[[src:why]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened at 12:00:01 and was seen at 12:00:02.',
        'Usually the two are seconds apart. Id 4 happened at 12:04:05 and was seen a second later. Id 6 happened at 12:03:40, but was seen after id 5.',
        'And id 7 happened at 12:00:50 but was not seen until 12:04:40: its phone was offline. Seen eighth, it happened third.',
        'Which phone sent an event, a or b, is called its key. Keep the two clocks in mind: every slice of time in this part is cut by when things happened.'
      ]
    },

    /* ---------- 3 · question: a total of what? ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window'],
      eyebrow: '03 · Your turn',
      heading: 'The shop asks: what is the total value?',
      stand: 'The stream has no last event. New purchases keep arriving.',
      question: {
        step: 0,
        prompt: 'Before any total can be given, what is the question still missing?',
        options: [
          { text: 'A stretch of time to add over, with a start and an end.', correct: true,
            why: 'A total needs a boundary. “The value of purchases that happened between 12:00 and 12:02” can be answered.' },
          { text: 'Nothing: wait for the stream to end, then add.', correct: false,
            why: 'The stream never ends, so that moment never comes and no total would ever be given.' },
          { text: 'A faster computer, to keep up with the stream.', correct: false,
            why: 'Speed does not help. Even an instant computer cannot add a list that has no end.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window', html: '<p>A stretch of <b>event time</b> that a result is worked out over is a <b>window</b>, such as 12:00 to 12:02.[[src:flow]]</p>' },
        { step: 2, title: 'Cut by when it happened', html: '<p>An event belongs to a window by its event time, whenever it is seen. Id 7 belongs to 12:00 to 12:02.[[src:why]]</p>' }
      ],
      narration: [
        'First question. The shop asks for the total value of its purchases, but the stream has no last event. Before any total can be given, what is the question still missing? Choose an answer.',
        'A stretch of time to add over, with a start and an end. A stretch of event time that a result is worked out over is called a window: for example, 12:00 to 12:02.',
        'An event joins a window by when it happened, not when it was seen. So id 7, seen at 12:04:40, still belongs to the window 12:00 to 12:02. Let us watch the events being sorted.'
      ]
    },

    /* ---------- 4 · events into 2-minute windows ---------- */
    {
      title: 'Slice', layout: 'array', defines: ['fixed window', 'windowing'],
      eyebrow: '04 · Watch the events land in 2-minute windows',
      heading: 'Each event goes to the window its event time falls in',
      stand: 'Slots are the events in the order they were seen. Row 1: when each happened. Row 3: the window it belongs to.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => clock(e.et)) },
          { label: 'value', values: E.map(e => e.v) },
          { label: 'window from', values: E.map(e => hm(seed.winOf(e.et))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: W0 }
        ]
      },
      cards: [
        { step: 1, title: 'Fixed windows', html: '<p>Back-to-back, equal, never overlapping: 12:00 to 12:02, 12:02 to 12:04, and so on, each <b>120 s</b> wide. These are <b>fixed windows</b>.[[src:why]]</p>' },
        { step: 3, title: 'Windowing', html: '<p>The rule that decides which window or windows an event goes to is the <b>windowing</b>. It answers the question <b>where</b> in event time.[[src:flow]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen, numbered along the top. The first row is when each happened, the second its value.',
        'Now each event drops into a 2-minute window, chosen by when it happened. Back-to-back windows of equal width that never overlap are called fixed windows: 120 seconds each here.',
        'Look at the window starting 12:00: ids 0, 1, 2, and id 7, seen last of all. Their values are 5, 3, 7 and 4.',
        'The rule that decides which window an event goes to is called the windowing. It answers one question: where, in event time, is a result worked out? Next: what is worked out.'
      ]
    },

    /* ---------- 5 · question: what decides the answer ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['transform'],
      eyebrow: '05 · Your turn',
      heading: 'One window, two teams, two different numbers',
      stand: 'Window 12:00 to 12:02 holds ids 0, 1, 2 and 7. The finance team gets 19. The sales team gets 4.',
      question: {
        step: 0,
        prompt: 'The window is the same for both teams. What made one answer 19 and the other 4?',
        options: [
          { text: 'What each team works out: adding values, or counting events.', correct: true,
            why: 'Finance adds the values 5, 3, 7 and 4 to get 19. Sales counts the events and gets 4.' },
          { text: 'Which events each team let into the window.', correct: false,
            why: 'Both used the same four events. The window rule was identical for both teams.' },
          { text: 'The order in which the events were seen.', correct: false,
            why: 'Adding and counting give the same result in any order, so arrival order changes neither.' }
        ]
      },
      cards: [
        { step: 1, title: 'A transform', html: '<p>The computation itself, such as a sum, a count, a largest value or a filter, is a <b>transform</b>. It answers <b>what</b> is worked out.[[src:flow]]</p>' },
        { step: 2, title: 'It never mentions the window', html: '<p>A sum only sees a group of events. It cannot tell which window rule built that group.[[src:prog]]</p>' }
      ],
      narration: [
        'Second question. Both teams use window 12:00 to 12:02, holding ids 0, 1, 2 and 7. Finance gets 19; sales gets 4. What made the difference? Choose an answer.',
        'What each team works out. Finance adds the values; sales counts the events. The computation itself is called a transform, and it answers the question: what?',
        'Notice the transform never mentions the window. A sum only sees a group of events; it cannot tell which window rule built the group. Watch it run.'
      ]
    },

    /* ---------- 6 · the transform, animated ---------- */
    {
      title: 'What', layout: 'array',
      eyebrow: '06 · Watch four transforms on one window',
      heading: 'Same four events. Four answers.',
      stand: 'The window 12:00 to 12:02 is held still. Only the computation changes.',
      array: {
        labelWidth: 150, slotLabel: 'slot',
        rows: [
          { label: 'event id', values: W0 },
          { label: 'phone', values: W0.map(id => E[id].key) },
          { label: 'value', values: W0V }
        ],
        meters: ['events read', 'sum so far'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'pick', slots: [2] }
        ]
      },
      cards: [
        { step: 1, title: 'Sum and count', html: '<p>Sum of values: <b>19</b>. Count of events: <b>4</b>, the number of slots read.[[src:why]]</p>' },
        { step: 2, title: 'Largest value', html: '<p>The largest value is <b>7</b>, from id 2.[[src:why]]</p>' },
        { step: 3, title: 'Different phones', html: '<p>Count the different keys: a and b, so <b>2</b>. This transform reads the phone column, not the values.[[src:walk]]</p>' }
      ],
      narration: [
        'Here is the window 12:00 to 12:02 on its own: ids 0, 1, 2 and 7, their phones, and their values.',
        'Watch the sum transform walk the values: 5, then 8, then 15, then 19. It read 4 events, so the count transform would answer 4.',
        'A third transform, the largest value, looks for the biggest and answers 7, from id 2.',
        'And a fourth counts the different phones: a and b, so 2. Four answers from the same four events, and the window was never changed.'
      ]
    },

    /* ---------- 7 · question: fixed windows over everything ---------- */
    {
      title: 'Q3', layout: 'ask',
      eyebrow: '07 · Your turn',
      heading: 'Now hold the sum still, and change the windows',
      stand: 'All 9 events, cut into fixed 2-minute windows. Each window’s values are added up.',
      question: {
        step: 0,
        prompt: 'If you add up every fixed window’s total, what do you get?',
        options: [
          { text: '45: every event sits in exactly one window.', correct: true,
            why: 'Fixed windows never overlap and leave no gaps, so each value is counted once.' },
          { text: 'Less than 45: the late id 7 is left out.', correct: false,
            why: 'Windows are cut by when events happened, so id 7 is in the first window like the others.' },
          { text: 'It depends on the order the events were seen in.', correct: false,
            why: 'Window membership comes from event time alone. Arrival order changes nothing here.' }
        ]
      },
      narration: [
        'Third question. Now the transform is held still: a sum. All 9 events are cut into fixed 2-minute windows. If you add up every window’s total, what do you get? Choose an answer.',
        '45. Fixed windows never overlap and leave no gaps, so every event sits in exactly one window and every value is counted once. Watch it.'
      ]
    },

    /* ---------- 8 · fixed windows, animated ---------- */
    {
      title: 'Fixed', layout: 'array', defines: ['global window'],
      eyebrow: '08 · Watch the fixed windows add up',
      heading: 'Four windows, totals 19, 11, 7 and 8',
      stand: 'Each slot is one fixed window that holds at least one event. The window from 12:06 holds none.',
      array: {
        labelWidth: 150, slotLabel: 'window',
        rows: [
          { label: 'from', values: seed.WIN_STARTS.map(hm) },
          { label: 'event ids', values: seed.WIN_STARTS.map(w => seed.WINDOWS[w].join(', ')) },
          { label: 'sum', values: FIXED }
        ],
        meters: ['windows read', 'all totals added'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 1, title: '4 results, total 45', html: '<p>19 + 11 + 7 + 8 = <b>45</b>, the value of the whole dataset. Fixed windows split it without overlap.[[src:why]]</p>' },
        { step: 2, title: 'The global window', html: '<p>One window over all of time is the <b>global window</b>: one result, <b>45</b>. Right for a lifetime total.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the fixed windows that hold events: from 12:00, 12:02, 12:04 and 12:08. Their sums are 19, 11, 7 and 8.',
        'Watch the four totals being added: 19, then 30, and on up to 45. Exactly the value of all 9 events, because each one sits in one window only.',
        'One more windowing gives the same total. A single window over all of time is called the global window. It gives one result, 45, and suits a lifetime total.'
      ]
    },

    /* ---------- 9 · question: overlapping windows ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['sliding window'],
      eyebrow: '09 · Your turn',
      heading: 'Windows that overlap',
      stand: 'Still a sum. Now each window is 2 minutes wide, but a new one starts every minute, from 12:00 on. So an event can sit in two windows at once.',
      question: {
        step: 0,
        prompt: 'Add up the totals of all these overlapping windows. What do you get?',
        options: [
          { text: '78: most events are counted in two windows.', correct: true,
            why: 'An event belongs to every window covering its time. Most are covered twice; the first few only once.' },
          { text: '45: windows never change the total.', correct: false,
            why: 'That holds only for windows that never overlap. These do, by design.' },
          { text: '90: every event is counted exactly twice.', correct: false,
            why: 'No window starts before 12:00, so events from the first minute sit in only one.' }
        ]
      },
      cards: [
        { step: 1, title: 'Sliding windows', html: '<p>Equal windows that start at a regular step smaller than their width, here <b>120 s</b> wide every <b>60 s</b>, are <b>sliding windows</b>.[[src:why]]</p>' },
        { step: 2, title: 'Nothing was duplicated', html: '<p>The extra 33 is not an error. Overlap is a property of the windowing, not of the data.[[src:prog]]</p>' }
      ],
      narration: [
        'Fourth question. Still a sum, but now each window is 2 minutes wide and a new one starts every minute, so they overlap. What do their totals add up to? Choose an answer.',
        '78. An event belongs to every window that covers its time. Windows that start at a step smaller than their width are called sliding windows: 120 seconds wide, every 60 seconds.',
        'Nothing was duplicated in the data. The extra 33 comes from the overlap, which is a property of the windowing. So never compare a sliding total with the input total.'
      ]
    },

    /* ---------- 10 · sliding windows, animated ---------- */
    {
      title: 'Slide', layout: 'array',
      eyebrow: '10 · Watch the sliding windows add up',
      heading: 'Seven windows, total 78',
      stand: 'Each slot is one sliding window that holds at least one event, by its start. Each covers 2 minutes.',
      array: {
        labelWidth: 150, slotLabel: 'window',
        rows: [
          { label: 'from', values: SLIDE.map(w => hm(w.s)) },
          { label: 'to', values: SLIDE.map(w => hm(w.s + seed.WIN)) },
          { label: 'sum', values: SLIDE.map(w => w.sum) }
        ],
        meters: ['windows read', 'all totals added'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 2, do: 'pick', slots: [3, 4] }
        ]
      },
      cards: [
        { step: 1, title: '7 results, 78', html: '<p>The window totals add up to <b>78</b> against a dataset of <b>45</b>.[[src:why]]</p>' },
        { step: 2, title: 'Id 4 is in two', html: '<p>Id 4 happened at 12:04:05, inside both 12:03 to 12:05 and 12:04 to 12:06. Its value 6 is added in each.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the 7 sliding windows that hold events, from 12:00 to 12:02 through to 12:09 to 12:11. Each covers 2 minutes, and each starts one minute after the last.',
        'Watch their totals being added: 19, 9, 11, 16, 7, 8 and 8. The total reaches 78, from data worth 45.',
        'Look at the two highlighted windows. Id 4 happened at 12:04:05, which is inside both, so its value 6 is counted in each. That is where the extra comes from.'
      ]
    },

    /* ---------- 11 · question: sessions ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['session window'],
      eyebrow: '11 · Your turn',
      heading: 'Windows drawn by the data, not by the clock',
      stand: 'Phone a’s purchases happened at 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00. A burst of activity ends when the phone is quiet for more than 2 minutes.',
      question: {
        step: 0,
        prompt: 'How many bursts of activity does phone a have?',
        options: [
          { text: '3: the long pauses come after 12:00:03 and after 12:04:05.', correct: true,
            why: '12:00:03 to 12:02:10 is just over 2 minutes, and 12:04:05 to 12:09:00 is nearly 5. Each starts a new burst.' },
          { text: '5: every purchase is a burst of its own.', correct: false,
            why: '12:00:01 and 12:00:03 are two seconds apart, well inside a 2-minute gap, so they share one burst.' },
          { text: '2: one before 12:05, one after.', correct: false,
            why: 'The pause from 12:00:03 to 12:02:10 is longer than 2 minutes, so it splits the first part in two.' }
        ]
      },
      cards: [
        { step: 1, title: 'Session windows', html: '<p>A window that lasts while one key keeps being active, and ends after a quiet gap of <b>120 s</b>, is a <b>session window</b>.[[src:why]]</p>' },
        { step: 2, title: 'Per key', html: '<p>Phone a has <b>3</b> sessions; phone b has <b>2</b> over the same span. Sessions are a fact about each key’s own activity.[[src:when]]</p>' }
      ],
      narration: [
        'Fifth question. Phone a bought at 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00. A burst ends after more than 2 quiet minutes. How many bursts does phone a have? Choose an answer.',
        'Three. The long pauses come after 12:00:03 and after 12:04:05. A window that lasts while one key stays active, and ends after a quiet gap of 120 seconds, is called a session window.',
        'Sessions are drawn per key. Phone b has only 2 over the same span. Watch phone a’s sessions being found.'
      ]
    },

    /* ---------- 12 · sessions, animated ---------- */
    {
      title: 'Sess', layout: 'array',
      eyebrow: '12 · Watch phone a’s sessions being found',
      heading: 'A new session starts after every gap of more than 2 minutes',
      stand: 'Phone a’s events in the order they happened. The pointer counts the starts of new sessions.',
      array: {
        labelWidth: 150, slotLabel: 'slot',
        rows: [
          { label: 'event id', values: A.map(e => e.id) },
          { label: 'happened at', values: A.map(e => clock(e.et)) },
          { label: 'session', values: startsA }
        ],
        meters: ['events checked', 'sessions'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'new', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 2, title: 'Phone a: 3 sessions', html: '<p>12:00:01 to 12:00:03, then 12:02:10 to 12:04:05, then 12:09:00 alone.[[src:walk]]</p>' },
        { step: 2, title: 'Phone b: 2 sessions', html: '<p>12:00:50 to 12:01:30, then 12:03:40 to 12:04:20. Same clock, different activity.[[src:when]]</p>' }
      ],
      narration: [
        'Here are phone a’s five events in the order they happened: 12:00:01, 12:00:03, 12:02:10, 12:04:05 and 12:09:00.',
        'Watch each event marked: new if more than 2 minutes passed since the one before, same if not. The pointer counts the new ones: 3 sessions.',
        'So phone a has 3 sessions and phone b has 2. A fixed window is drawn by the clock; a session window is drawn by each key’s own activity.'
      ]
    },

    /* ---------- 13 · question: does one choice fix the other? ---------- */
    {
      title: 'Q6', layout: 'ask',
      eyebrow: '13 · Your turn',
      heading: '“We sum purchases.” Is the answer decided now?',
      stand: 'A team describes its pipeline in one sentence: “we sum purchases”.',
      question: {
        step: 0,
        prompt: 'From that sentence alone, can you say what number the pipeline will report?',
        options: [
          { text: 'No: the same sum gave 45, 19, 78, depending on the windowing.', correct: true,
            why: 'The sentence answers what, and says nothing about where. Both are needed before a number exists.' },
          { text: 'Yes: a sum of the same events is always 45.', correct: false,
            why: 'Only with a global or fixed windowing. Sliding windows gave 78 from the same events.' },
          { text: 'Yes, as long as the events arrive in order.', correct: false,
            why: 'Arrival order never mattered here. What is missing is the slice of event time.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two independent choices', html: '<p>Pick 3 transforms and 3 windowings and you get <b>9</b> legal pipelines. Picking one never limits the other.[[src:why]]</p>' },
        { step: 2, title: 'The same goes the other way', html: '<p>“We use session windows” names the where and leaves the what open. Both sentences are needed.[[src:walk]]</p>' }
      ],
      narration: [
        'Sixth question. A team says: we sum purchases. From that sentence alone, can you say what number its pipeline will report? Choose an answer.',
        'No. The same sum gave 45, 19 or 78, depending on the windowing. Pick 3 transforms and 3 windowings and you get 9 legal pipelines; choosing one never limits the other.',
        'And the other way round: “we use session windows” names the where, and leaves the what open. A pipeline needs both answers before any number exists.'
      ]
    },

    /* ---------- 14 · the grid ---------- */
    {
      title: 'Grid', layout: 'table',
      eyebrow: '14 · Vary one axis, then the other',
      heading: 'Change the what, or the where, and the number changes',
      stand: 'Every row uses the same nine events.',
      table: {
        columns: ['What (transform)', 'Where (windowing)', 'Result'],
        rows: [
          { step: 0, cells: ['sum', 'one fixed window, 12:00 to 12:02', '<b>19</b>[[src:why]]'] },
          { step: 0, cells: ['count / largest / different phones', 'the same window', '<b>4</b> / <b>7</b> / <b>2</b>[[src:why]]'] },
          { step: 1, cells: ['sum', 'global', '<b>45</b>, one result[[src:why]]'] },
          { step: 1, cells: ['sum', 'fixed, 2 minutes', '19, 11, 7, 8: total <b>45</b>[[src:why]]'] },
          { step: 2, cells: ['sum', 'sliding, 2 minutes every minute', '7 results, total <b>78</b>[[src:why]]'] },
          { step: 2, cells: ['any', 'sessions, gap 2 minutes', 'phone a: <b>3</b>, phone b: <b>2</b>[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'When each windowing fits', html: '<ul class="l"><li><b>Global</b>: no time boundary, like a lifetime total.</li><li><b>Fixed</b>: a named period, per minute or per hour.</li><li><b>Sliding</b>: a smooth moving figure.</li><li><b>Session</b>: bursts of one key’s activity.[[src:when]]</li></ul>' },
      narration: [
        'Here is everything side by side. Hold the window still and change the transform: sum gives 19, count 4, largest 7, different phones 2.',
        'Hold the sum still and change the windowing: global gives one result, 45; fixed gives 19, 11, 7 and 8, also 45 in total.',
        'Sliding gives 7 results that add to 78, and sessions give phone a 3 and phone b 2. Every row is a real pipeline.',
        'When does each fit? Global for no time limit, fixed for a named period, sliding for a smooth moving figure, and sessions for bursts of one key’s activity.'
      ]
    },

    /* ---------- 15 · question: batch ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['batch'],
      eyebrow: '15 · Your turn',
      heading: 'An old-style job that reads one file a night',
      stand: 'A nightly MapReduce job reads yesterday’s file of purchases and adds up the values. Nobody ever chose a window for it.',
      question: {
        step: 0,
        prompt: 'Which window is that nightly job really using?',
        options: [
          { text: 'One window: the file itself, from its first line to its last.', correct: true,
            why: 'The file has an end, so it silently acts as one big window over everything in it.' },
          { text: 'None at all: windows only exist in streams.', correct: false,
            why: 'It still adds over a stretch of time: yesterday. The window is there, just never named.' },
          { text: 'A sliding window, one per line of the file.', correct: false,
            why: 'Nothing overlaps. Every line is read once, into one total.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch', html: '<p>A job over a finished, bounded file is <b>batch</b> processing. It answers what with its map and reduce, and where with “the file”.[[src:when]]</p>' },
        { step: 2, title: 'Streaming removes the default', html: '<p>Take away the end of the input and the file stops being a window. The streaming model does not add questions; it makes you answer them.[[src:flow]]</p>' }
      ],
      narration: [
        'Seventh question. A nightly MapReduce job reads yesterday’s file and adds up the values. Nobody chose a window. Which window is it really using? Choose an answer.',
        'One window: the file itself. A job over a finished file is called batch processing. It answers what with its map and reduce steps, and where with the file.',
        'A stream has no end, so that default disappears. The streaming model does not add new questions; it removes the defaults and makes you answer them.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you now know',
      heading: 'What is the computation. Where is the slice of event time.',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> and <b>processing time</b>', 'When it happened, and when the pipeline saw it. Id 7: 12:00:50 and 12:04:40.[[src:why]]'] },
          { step: 0, cells: ['<b>Transform</b> (what)', 'The computation: sum 19, count 4, largest 7, different phones 2, on one window.[[src:why]]'] },
          { step: 1, cells: ['<b>Windowing</b> (where)', 'The slice of event time: global 45, fixed 19, 11, 7, 8, sliding 78, sessions per key.[[src:why]]'] },
          { step: 1, cells: ['<b>Independent</b>', '3 transforms and 3 windowings make 9 pipelines. Neither choice fixes the other.[[src:walk]]'] },
          { step: 2, cells: ['<b>Batch</b>', 'A job over a file uses the file as one hidden window. A stream has no such default.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>Every number here is what a window <b>eventually</b> holds. Part 2 asks <b>when</b> a result is published, and finds one window published six times.[[src:when]]</p>' },
      narration: [
        'To recap. Every event has two times: when it happened, its event time, and when it was seen, its processing time. A transform is the computation: what is worked out.',
        'The windowing is the slice of event time: where it is worked out. Global and fixed keep the total at 45; sliding gives 78; sessions follow each key.',
        'The two choices are independent: 3 of each make 9 pipelines. And a batch job answers both too, with the file as one hidden window.',
        'But every number here is what a window eventually holds. Part 2 asks when a result is published, and finds one window published six times.'
      ]
    }
  ]
};
