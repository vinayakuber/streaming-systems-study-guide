// Chapter 5, Part 1 — "What exactly-once means", for a viewer who has read nothing before it.
// The nine events, both clocks, the crash and the retry are introduced from zero; the viewer
// is asked before being told; the three delivery lists and the window totals are animated.
// Every number comes from the one seed (tools/stream_seed.js) and is asserted below.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch05';
const E = seed.EVENTS;
const V = E.map(e => e.v);
const TOTAL = V.reduce((a, b) => a + b, 0);
const CHK = 4;                                             // the last event whose delivery was confirmed
const REPLAY = E.slice(CHK + 1);
const LOST = TOTAL - REPLAY.reduce((s, e) => s + e.v, 0);
const DOUBLE = TOTAL + REPLAY.reduce((s, e) => s + e.v, 0);
const clock = sec => seed.hhmmss(sec);
const winLabel = w => `${clock(w).slice(0, 5)}–${clock(w + seed.WIN).slice(0, 5)}`;
const WIN_TOTALS = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const pct = (v, base) => Math.round(100 * v / base);
const W5 = seed.winOf(E[5].et), W8 = seed.winOf(E[8].et);
const AT_LEAST_IDS = [...E.map(e => e.id), ...REPLAY.map(e => e.id)];

if (TOTAL !== 45 || LOST !== 23 || DOUBLE !== 67 || WIN_TOTALS.join() !== '19,11,7,8' || AT_LEAST_IDS.length !== 13
  || pct(E[8].v, seed.SUM(seed.WINDOWS[W8])) !== 100 || pct(E[5].v, seed.SUM(seed.WINDOWS[W5])) !== 14
  || pct(TOTAL - LOST, TOTAL) !== 49 || E[7].et !== 50 || E[7].pt !== 280)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

const row = e => ({ cells: [`event ${e.id}`, `user ${e.key}`, clock(e.et), clock(e.pt), `${e.v}`] });

module.exports = {
  title: 'Counting Exactly Once',
  eyebrow: 'Streaming · Ch 5 · Part 1',
  ...shared,
  jargon: ['event', 'value', 'pipeline', 'event time', 'processing time', 'window', 'crash', 'retry',
    'at-least-once', 'at-most-once', 'exactly-once', 'complete', 'accurate', 'timeout', 'state', 'side effect'],
  sources: {
    ch:    chapter(CH, 'Chapter 5 on GitHub'),
    what:  section(CH, 'What exactly-once means', 'Chapter 5 · what exactly-once means'),
    why:   section(CH, 'Why exactly-once is two guarantees, and which half is hard', 'Chapter 5 · two guarantees'),
    when:  section(CH, 'When you need exactly-once, and when at-least-once is the right answer', 'Chapter 5 · when you need it'),
    walk:  section(CH, 'Visual walkthrough — two failures, one duplicate, and the split', 'Chapter 5 · two failures, one duplicate'),
    prog:  section(CH, 'Accuracy and completeness — stack and heap at every step', 'Chapter 5 · accuracy and completeness, traced')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'value', 'pipeline', 'crash'],
      eyebrow: '01 · Chapter 5 · Part 1',
      heading: 'Nine events, one total, and a machine that can crash',
      hero: { step: 0, text: 'Two users, called <code>a</code> and <code>b</code>, do things on a website. Each thing they do is recorded as an <b>event</b>, and each event carries a <b>value</b>: a number to be added up. A <b>pipeline</b> — a chain of programs on several machines — reads the events and keeps the totals. Machines sometimes <b>crash</b>: they stop suddenly, mid-task.[[src:why]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: TOTAL, label: 'the right total of their values[[src:why]]' },
        { step: 2, value: LOST, label: 'the total if some events are lost[[src:why]]' },
        { step: 2, value: DOUBLE, label: 'the total if some are counted twice[[src:why]]' }
      ],
      cardsLabel: 'What this part answers',
      cards: [
        { step: 3, n: 1, title: 'What goes wrong when a machine crashes?', text: 'Events can go missing, or be counted twice.' },
        { step: 3, n: 2, title: 'What does “exactly once” promise?', text: 'Every event counts once: no more, no less.' },
        { step: 4, n: 3, title: 'Which half of that promise is hard?', text: 'The totals are easy. The outside world is not.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'Two users, called a and b, do things on a website. Each thing is recorded as an event, and each event carries a value, a number to add up. A pipeline, a chain of programs on several machines, keeps the totals.',
        'Our example has 9 events. Their values add up to 45. That is the right answer, and the only right answer.',
        'But machines crash. After a crash the same pipeline can report 23, with some events missing, or 67, with some counted twice. We will reach all three numbers ourselves.',
        'This part asks: what goes wrong when a machine crashes? And what exactly does the promise called exactly once mean?',
        'And which half of that promise is genuinely hard? You will answer first, each time, and then see why.'
      ]
    },

    /* ---------- 2 · the events, and the two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The nine events, and their two clocks',
      heading: 'Every event has two times: when it happened, and when it was seen',
      stand: 'Some of the nine events. They are listed in the order the pipeline saw them.',
      table: {
        columns: ['Event', 'Who', 'Happened at', 'Seen at', 'Value'],
        rows: [
          { step: 0, ...row(E[0]) }, { step: 0, ...row(E[1]) }, { step: 0, ...row(E[2]) },
          { step: 1, ...row(E[3]) }, { step: 1, ...row(E[4]) },
          { step: 1, cells: ['…', '…', '…', '…', '…'] },
          { step: 2, cells: ['<b>event 7</b>', 'user b', `<b>${clock(E[7].et)}</b>`, `<b>${clock(E[7].pt)}</b>`, `${E[7].v}`] },
          { step: 2, ...row(E[8]) }
        ]
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the thing really happened, on the user’s side.</li><li><b>Processing time</b> — when the pipeline saw it. Always later, sometimes much later.</li><li>The values add up to <b>' + TOTAL + '</b>, whichever order they arrive in.[[src:prog]]</li></ul>' },
      narration: [
        'Here are the events, in the order the pipeline saw them. Event 0 is from user a, happened at 12:00:01, and carries the value 5. Event 1 carries 3, and event 2 carries 7.',
        'Event 3 carries 2 and event 4 carries 6. Each event has two times: when it happened, and when the pipeline saw it. Usually they are a second or two apart.',
        'Now look at event 7. It happened at 12:00:50, but the pipeline only saw it at 12:04:40, almost four minutes later. Its message was slow to arrive.',
        'So every event has two clocks. Event time is when it really happened. Processing time is when the pipeline saw it. All nine values add up to 45, whatever the order.'
      ]
    },

    /* ---------- 3 · the windows, animated ---------- */
    {
      title: 'Wins', layout: 'array', defines: ['window'],
      eyebrow: '03 · Watch the totals being kept',
      heading: 'One grand total, and a total per two minutes',
      stand: 'Each column is one event. The bottom row says which two-minute stretch of event time it belongs to.',
      array: {
        labelWidth: 170, slotLabel: 'event',
        rows: [
          { label: 'value', values: V },
          { label: 'happened in', values: E.map(e => winLabel(seed.winOf(e.et))) }
        ],
        meters: ['events read', 'grand total'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 260 },
          { step: 2, do: 'show', rows: [1] },
          { step: 3, do: 'pick', slots: [8] }
        ]
      },
      cards: [
        { step: 2, title: 'Windows', html: '<p>The pipeline also keeps a total for each two minutes of <b>event time</b>. Each such stretch is a <b>window</b>. Event 7 counts in 12:00–12:02, when it happened, not when it was seen.[[src:why]]</p>' },
        { step: 3, title: 'Four window totals', html: '<p>12:00–12:02 holds <b>' + WIN_TOTALS[0] + '</b>, 12:02–12:04 holds <b>' + WIN_TOTALS[1] + '</b>, 12:04–12:06 holds <b>' + WIN_TOTALS[2] + '</b>, and 12:08–12:10 holds only event 8: <b>' + WIN_TOTALS[3] + '</b>.[[src:why]]</p>' }
      ],
      narration: [
        'Here are the nine values, one column per event, in the order the pipeline saw them.',
        'Watch the pipeline add them up, one event at a time. Nine events read, and the grand total climbs to 45.',
        'The pipeline also keeps a total for each two minutes of event time. Each such stretch is called a window. Event 7 counts in the 12:00 window, when it happened, not when it was seen.',
        'So the window from 12:00 to 12:02 holds 19, the next holds 11, then 7. The window from 12:08 to 12:10 holds only event 8, with a value of 8. Keep that thin window in mind.'
      ]
    },

    /* ---------- 4 · question: the crash ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['retry'],
      eyebrow: '04 · Your turn',
      heading: 'A machine dies in the middle of its work',
      stand: 'The machine that passes events along has confirmed events 0 to 4. It sends events 5, 6, 7 and 8, then dies before it can note that they arrived.',
      question: {
        step: 0,
        prompt: 'When it restarts, what should it do about events 5 to 8?',
        options: [
          { text: 'Send them again, since it cannot know whether they arrived.', correct: true,
            why: 'Its notes stop at event 4. It cannot tell a delivery that landed from one that was lost, so the only safe move is to send again.' },
          { text: 'Skip them, because they were already sent once.', correct: false,
            why: 'If they never arrived, skipping them loses four events for good, and nothing later would notice.' },
          { text: 'Send all nine events again, from event 0.', correct: false,
            why: 'Events 0 to 4 were confirmed. Sending them again only adds more copies to remove.' }
        ]
      },
      cards: [
        { step: 1, title: 'A crash', html: '<p>A machine stopping suddenly, mid-task, is a <b>crash</b>. What it was doing at that instant is lost; only what it had written down survives.[[src:why]]</p>' },
        { step: 2, title: 'A retry', html: '<p>Sending something again because you cannot tell whether it got through is a <b>retry</b>. Events 5, 6, 7 and 8 are retried.[[src:prog]]</p>' }
      ],
      narration: [
        'First question. The machine passing events along confirmed events 0 to 4, sent events 5 to 8, then died before noting that they arrived. What should it do when it restarts? Choose an answer.',
        'Send them again. A machine stopping suddenly like this is called a crash. Its notes stop at event 4, and it cannot tell whether events 5 to 8 arrived.',
        'Sending something again because you cannot tell whether it got through is called a retry. Events 5, 6, 7 and 8 are retried. Now watch what that does to the total.'
      ]
    },

    /* ---------- 5 · the three delivery lists, animated ---------- */
    {
      title: 'Lists', layout: 'array', defines: ['at-least-once', 'at-most-once', 'exactly-once'],
      eyebrow: '05 · Watch the retried events arrive',
      heading: 'Thirteen deliveries for nine events',
      stand: 'What the adding machine actually receives after the retry: the nine events, then events 5 to 8 a second time.',
      array: {
        labelWidth: 150, slotLabel: 'delivery',
        rows: [
          { label: 'event', values: AT_LEAST_IDS },
          { label: 'value', values: AT_LEAST_IDS.map(i => E[i].v) }
        ],
        meters: ['deliveries added', 'total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 230 },
          { step: 2, do: 'pick', slots: [9, 10, 11, 12] }
        ]
      },
      columns: 3,
      cards: [
        { step: 2, title: 'At-least-once: ' + DOUBLE, html: '<p>Retry, and add everything that arrives. If the first sends had landed, events 5 to 8 count twice: 45 + 22 = <b>' + DOUBLE + '</b>. Nothing is missing; some things are extra.[[src:prog]]</p>' },
        { step: 3, title: 'At-most-once: ' + LOST, html: '<p>Never retry. If the first sends were lost, the adder has only events 0 to 4: <b>' + LOST + '</b>. Nothing is extra; four events are missing.[[src:prog]]</p>' },
        { step: 3, title: 'Exactly-once: ' + TOTAL, html: '<p>Retry, but let each event count only once: <b>' + TOTAL + '</b>. That is the promise this chapter is about.[[src:what]]</p>' }
      ],
      narration: [
        'Here is what the adding machine receives after the retry: the nine events, then events 5, 6, 7 and 8 a second time. Thirteen deliveries for nine events.',
        'Watch it add every delivery as it arrives. Thirteen deliveries added, and the total climbs to 67, not 45.',
        'The four repeats are highlighted. Retrying and adding everything is called at-least-once. If the first sends had in fact landed, events 5 to 8 count twice: 45 plus 22 makes 67.',
        'Never retrying is called at-most-once. If the first sends were in fact lost, the adder has only events 0 to 4: 23. Retrying but counting each event once is called exactly-once, and gives 45.'
      ]
    },

    /* ---------- 6 · question: two different failures ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['complete', 'accurate'],
      eyebrow: '06 · Your turn',
      heading: 'Two wrong totals. Are they the same mistake?',
      stand: 'The right total is 45. One run reports 23; another reports 67.',
      question: {
        step: 0,
        prompt: 'A dashboard shows a total of 67, and nothing else. Can the person reading it tell that something went wrong?',
        options: [
          { text: 'No: 67 looks like any other total.', correct: true,
            why: 'A number carries no trace of where it came from. The repeats are visible in the list of deliveries, and invisible in the sum.' },
          { text: 'Yes: 67 is clearly too large.', correct: false,
            why: 'Too large compared with what? Without already knowing 45, nothing about 67 looks wrong.' },
          { text: 'Yes: a repeat always makes the total odd.', correct: false,
            why: 'Here the repeats add 22, an even number. A repeat adds whatever its value is, so nothing about the result gives it away.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two guarantees, not one', html: '<p>A correct pipeline is <b>complete</b> — every event contributes — and <b>accurate</b> — each result is right. 23 broke completeness; 67 broke accuracy.[[src:why]]</p>' },
        { step: 2, title: 'Same size, opposite sign', html: '<p>Both are <b>49%</b> wrong: 22 too little and 22 too much. In a bigger total, one could even hide the other.[[src:walk]]</p>' }
      ],
      narration: [
        'Second question. A dashboard shows a total of 67, and nothing else. Can the person reading it tell that something went wrong? Choose an answer.',
        'No. The repeats were plain in the list of deliveries, and they vanish in the sum. So two different guarantees are at stake. A pipeline is complete when every event contributes, and accurate when each result is right.',
        'The total of 23 broke completeness, and 67 broke accuracy. Both are 49 percent wrong, 22 too little and 22 too much. Same size, opposite sign, so in a bigger total one could even hide the other.'
      ]
    },

    /* ---------- 7 · question: why not just stop retrying ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['timeout'],
      eyebrow: '07 · Your turn',
      heading: 'If retries cause repeats, why not stop retrying?',
      stand: 'A machine sends an event and waits for a reply. No reply comes back in time.',
      question: {
        step: 0,
        prompt: 'Should the pipeline simply never retry, so that nothing is ever counted twice?',
        options: [
          { text: 'No: then every lost send becomes a missing event instead.', correct: true,
            why: 'A send with no reply may have landed or may have been lost. Not retrying turns every lost one into missing data, the total of 23.' },
          { text: 'Yes: a send with no reply has always failed.', correct: false,
            why: 'Often the send succeeded and only the reply was lost. The sender cannot tell these two cases apart.' },
          { text: 'Yes: crashes are rare enough to ignore.', correct: false,
            why: 'Crashes and slow replies happen all the time across many machines, so retries are a normal part of the work.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A timeout', html: '<p>Giving up waiting for a reply is a <b>timeout</b>. A send that timed out but actually succeeded looks exactly like one that failed.[[src:why]]</p>' },
        { step: 2, title: 'Built on top of retries', html: '<p>So a pipeline is at-least-once by default. Exactly-once is not “no retries”; it is retries that cannot count twice.[[src:walk]]</p>' }
      ],
      narration: [
        'Third question. If retries cause repeats, should the pipeline simply never retry, so that nothing is ever counted twice? Choose an answer.',
        'No. Giving up waiting for a reply is called a timeout, and a send that timed out may still have succeeded. The sender cannot tell. Not retrying turns every lost send into a missing event.',
        'So retries are not optional, and a pipeline is at-least-once by default. Exactly-once does not mean no retries. It means retries that can never count twice.'
      ]
    },

    /* ---------- 8 · question: what one repeat costs ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '08 · Your turn',
      heading: 'One repeat, two different windows',
      stand: 'Remember the windows: 12:04–12:06 holds 7 (events 4 and 5), and 12:08–12:10 holds only event 8, worth 8.',
      question: {
        step: 0,
        prompt: 'Event 8 is delivered twice. How wrong is the total of its window, 12:08 to 12:10?',
        options: [
          { text: 'It doubles: 16 instead of 8, 100% too high.', correct: true,
            why: 'The window held only event 8, so one extra copy is as large as everything that was there.' },
          { text: 'A little: 8 extra out of 45 overall.', correct: false,
            why: 'That is the grand total. The window’s own total went from 8 to 16, and a window reader sees exactly that.' },
          { text: 'Not at all: one extra event is too small to matter.', correct: false,
            why: 'One extra event can be the whole of a window. Here it is.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The cost is value over window total', html: '<p>A repeat of event 5 (value 1) in a window of 7 is <b>+14%</b>. A repeat of event 8 in a window of 8 is <b>+100%</b>. Same mistake, different damage.[[src:why]]</p>' },
        { step: 2, title: 'Thin windows hurt most', html: '<p>Repeats do the most damage in windows with little in them, which are exactly the windows nobody is watching.[[src:walk]]</p>' }
      ],
      narration: [
        'Fourth question. Event 8 is delivered twice. Its window, 12:08 to 12:10, held only event 8. How wrong is that window’s total? Choose an answer.',
        'It doubles, from 8 to 16: 100 percent too high. The damage of one repeat is its value divided by its window’s total. A repeat of event 5, worth 1 in a window of 7, is only 14 percent.',
        'So the same mistake does very different damage. Repeats hurt most in thin windows, with little in them, and those are exactly the windows nobody is watching.'
      ]
    },

    /* ---------- 9 · question: when it is needed ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'Does every pipeline need exactly-once?',
      stand: 'Exactly-once takes extra machinery. Three pipelines, three kinds of output.',
      question: {
        step: 0,
        prompt: 'Which of these outputs truly needs exactly-once?',
        options: [
          { text: 'A charge to a customer’s card.', correct: true,
            why: 'A second copy is real money, and the customer will notice. That is the test: would a second copy be seen?' },
          { text: 'A screen value that is overwritten each time.', correct: false,
            why: 'Writing the same value twice leaves the same value. At-least-once costs a little work and changes nothing.' },
          { text: 'A rough sample of debugging messages.', correct: false,
            why: 'Losing one now and then is cheaper than the machinery. At-most-once is fine for rough statistics.' }
        ]
      },
      columns: 3,
      cards: [
        { step: 1, title: 'At-least-once is enough', html: '<p>…when the output is overwritten anyway: a stored copy, a gauge, a list keyed by name. Repeats change nothing.[[src:when]]</p>' },
        { step: 1, title: 'At-most-once is enough', html: '<p>…when a loss is cheaper than a repeat, and the data is only rough statistics. Rare, but real.[[src:when]]</p>' },
        { step: 2, title: 'Exactly-once is needed', html: '<p>…when a repeat is visible or costly: money, an email, a count someone checks. In a thin window, one repeat is a 100% error.[[src:when]]</p>' }
      ],
      narration: [
        'Fifth question. Exactly-once takes extra machinery. Which of these outputs truly needs it? Choose an answer.',
        'The card charge. At-least-once is enough when the output is overwritten anyway, so a repeat changes nothing. At-most-once is enough for rough statistics, where a loss is cheaper.',
        'Exactly-once is needed when a second copy would be noticed: money, an email, a count someone checks. The test is not whether the data is important, but whether a repeat would be seen.'
      ]
    },

    /* ---------- 10 · question: the split ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['state', 'side effect'],
      eyebrow: '10 · Your turn',
      heading: 'Two things a pipeline can produce',
      stand: 'After a crash, the pipeline redoes some work. Compare two pieces of work it might redo.',
      question: {
        step: 0,
        prompt: 'Recomputing the 12:08 window from its events gives 8 every time. What does running “charge order 4 for 6” a second time give?',
        options: [
          { text: 'A card charged 12: the first charge already happened.', correct: true,
            why: 'The money moved the first time. Nothing inside the pipeline records that, so the second run charges again.' },
          { text: 'A card charged 6: running it again rewrites the same value.', correct: false,
            why: 'A charge does not rewrite a value; it moves money each time it runs.' },
          { text: 'Nothing: the crash cancelled the first charge.', correct: false,
            why: 'A crash in the pipeline cannot reach into the bank. The first charge stays charged.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'State: easy', html: '<p>The totals a pipeline keeps are its <b>state</b>. They are worked out from the events, so recomputing gives the same answer, 8, every time.[[src:why]]</p>' },
        { step: 2, title: 'Side effects: hard', html: '<p>A change in the outside world — a charge, an email — is a <b>side effect</b>. It cannot be recomputed; only the outside system knows it happened.[[src:walk]]</p>' }
      ],
      narration: [
        'Sixth question. Recomputing the 12:08 window from its events gives 8 every time. What does running charge order 4 for 6 a second time give? Choose an answer.',
        'A card charged 12. The totals a pipeline keeps are called its state, and state is worked out from the events, so recomputing it is harmless. It gives 8 every time.',
        'A change in the outside world, like a charge or an email, is called a side effect. It cannot be recomputed: the money moved, and only the bank knows. That is the hard half.'
      ]
    },

    /* ---------- 11 · the split, as cards ---------- */
    {
      title: 'Split', layout: 'cards',
      eyebrow: '11 · The shape of the whole chapter',
      heading: 'Exactly-once splits into two problems of different size',
      stand: 'Everything later in this chapter fills in one of these two halves.',
      columns: 3,
      cards: [
        { step: 0, title: 'Moving events between machines', html: '<p>A retried event may arrive twice. The receiver must recognise and drop the repeat, so each event counts once.[[src:what]]</p>' },
        { step: 1, title: 'Keeping state', html: '<p>Totals are worked out from the events. Recomputing the 12:08 window gives 8 every time, so repeats are easy to make harmless.[[src:why]]</p>' },
        { step: 2, title: 'Causing side effects', html: '<p>A charge cannot be recomputed. Making it happen once needs help from the outside system itself: the genuinely hard part.[[src:what]]</p>' }
      ],
      narration: [
        'So exactly-once splits into two problems. First, events moving between machines may arrive twice after a retry, so the receiver must recognise a repeat and drop it.',
        'Second, what the pipeline produces. If it is state, like a window total, it is worked out from the events, so a repeat is easy to make harmless: 8 every time.',
        'But if it is a side effect, like a charge, nothing inside the pipeline can undo or recompute it. That needs help from the outside system, and it is the hard part of this chapter.'
      ]
    },

    /* ---------- 12 · check yourself ---------- */
    {
      title: 'Check', layout: 'ask',
      eyebrow: '12 · Your turn · check yourself',
      heading: 'What does exactly-once actually promise?',
      stand: 'The chapter’s own quiz question. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What does exactly-once mean?',
        options: [
          { text: 'No operation is ever retried.', correct: false,
            why: 'Retries are unavoidable. Exactly-once is built on top of them.' },
          { text: 'Each event affects the output exactly once.', correct: true,
            why: 'Retries may deliver an event twice, but its contribution appears once: 45, not 23 and not 67.' },
          { text: 'The pipeline never crashes.', correct: false,
            why: 'Machines crash. The promise is about what the output looks like afterwards.' },
          { text: 'Every window reports exactly one total.', correct: false,
            why: 'That is about how often results are shown, not about how many times an event counts.' }
        ]
      },
      narration: [
        'One last check, the chapter’s own quiz question. What does exactly-once mean? Choose an answer.',
        'Each event affects the output exactly once. Events may be delivered twice by a retry, but each one’s contribution appears once: 45, not 23, and not 67.'
      ]
    },

    /* ---------- 13 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '13 · What you now know',
      heading: 'Retries are unavoidable; exactly-once makes them harmless',
      stand: 'Everything in this part, in a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Event time</b> · <b>processing time</b>', 'When it happened, and when the pipeline saw it. Windows use event time.'] },
          { step: 0, cells: ['<b>Crash</b> · <b>retry</b> · <b>timeout</b>', 'A machine dies, or a reply never comes, so the sender sends again because it cannot tell.[[src:why]]'] },
          { step: 1, cells: ['<b>At-most-once</b> · <b>at-least-once</b>', 'Never retry: ' + LOST + ', incomplete. Retry and add everything: ' + DOUBLE + ', inaccurate.[[src:prog]]'] },
          { step: 1, cells: ['<b>Exactly-once</b>', 'Retry, and each event still counts once: ' + TOTAL + '.[[src:what]]'] },
          { step: 2, cells: ['<b>State</b> · <b>side effect</b>', 'Totals can be recomputed, so they are the easy half. A charge cannot, so it is the hard half.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 2', html: '<p>How do you make a repeat harmless? Part 2 shows two tools — write a result instead of adding to it, and remember which events you have seen — and finds that one more piece cannot be replaced.</p>' },
      narration: [
        'To recap. Every event has an event time, when it happened, and a processing time, when it was seen. After a crash or a timeout, a sender retries, because it cannot tell what got through.',
        'Never retrying is at-most-once: 23, with events missing. Retrying and adding everything is at-least-once: 67, with events counted twice. Exactly-once keeps the retries and still gives 45.',
        'The totals a pipeline keeps, its state, can be recomputed, so they are the easy half. Side effects, like a charge, cannot, so they are the hard half.',
        'Next, part 2 shows two tools that make a repeat harmless, and one more piece that nothing else can replace.'
      ]
    }
  ]
};
