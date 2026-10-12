// Chapter 9, Part 6 — Variation 3, "the attributed click", built as a program WITH the viewer.
// Every code slide asks what the next piece must do, then reveals the real lines from
// programs/ch09_v3.py (read at build time by _prog.js, addressed by content). The four waits
// are animated on the program's own printed results, and the narration is guarded by its .out.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch09';
const P = program('ch09_v3.py');
const OUT = program('ch09_v3.out');

// the pieces, in the order they are written
const DATA = P.span('#!/usr/bin/env python3', 'UNATTRIBUTED = None');
const STREAMS = P.span('# Streams for the examples table', 'FOREVER       =');
const TABLE = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const LATENESS = P.fn('measured_lateness');
const WINDOW = P.fn('in_window');
const ATTRIBUTE = P.fn('attribute');
const OFFLINE = P.fn('attribute_offline');
const COUNT = P.fn('matched_count');
const BEST = P.fn('max_matching');
const DROP = P.fn('droppable');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'Attribution is lost, not approximated.');
const MAIN2 = P.span('the one-to-one rule, and what it does to the click behind', 'which is the direction nobody audits.');
const MAIN3 = P.span('# boundaries: both ends of the window', 'all assertions passed');
const END = P.span('if __name__', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
const WAIT_LINES = ['answer at once (wait 0)    50->3  90->-  220->-  260->-  265->-   (1 attributed)',
  'wait W = 60                50->3  90->-  220->-  260->-  265->-   (1 attributed)',
  'wait lateness = 85         50->3  90->-  220->-  260->245  265->-   (2 attributed)',
  'offline, all data          50->3  90->-  220->-  260->245  265->-   (2 attributed)'];
for (const s of ['IMPRESSIONS (shown, arrived) = [(1, 1), (3, 3), (130, 130), (245, 330), (540, 540)]', 'CLICKS = [50, 90, 220, 260, 265]',
  'W = 60 seconds (the attribution window), measured lateness = 85 seconds', ...WAIT_LINES,
  'shown exactly W before: inside            1       1      0     1     1  160->100',
  'shown W + 1 before: outside               1       1      0     0     0  161->-',
  'nearest-first  : [(160, 150), (199, None)]   (1 attributed)', 'best possible  : 2 attributed (160 takes 100, 199 takes 150)',
  'answered at once : [(30, None), (51, 31), (89, None), (154, 109), (181, 132)]   (3 attributed)',
  'the right answer : [(30, None), (51, 31), (89, None), (154, 132), (181, None)]   (2 attributed)',
  'shown at or after 260 - W - lateness = 115: droppable [(1, 1), (3, 3)]', '60 + 85 = 145 seconds',
  'FEWER clicks in 133 cases, MORE in', '2, and the same number in 465', '408.  Every attribution', 'maximum possible in 579 cases and fewer',
  'in 21, so', 'all 17 examples agree with the offline matcher and the window rule', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch09_v3.out no longer prints "${s}" — rewrite the narration`);

// the four waits, for the click at 260 and the impression shown at 245 that arrives at 330
const ARRIVES = 330, CLICK = 260;
const WAITS = [['0', 0], ['60', 60], ['85', 85], ['offline', Infinity]].map(([label, w], k) => ({
  label, answered: w === Infinity ? 'all in' : w ? `${CLICK} + ${w}` : String(CLICK), sees: CLICK + w >= ARRIVES ? 'yes' : 'no',
  total: Number(WAIT_LINES[k].match(/\((\d) attributed\)/)[1]) }));
if (WAITS.map(w => w.sees).join() !== 'no,no,yes,yes' || WAITS.map(w => w.total).join() !== '1,1,2,2')
  throw new Error('the four waits no longer behave as the deck animates them');

module.exports = {
  title: 'The Attributed Click',
  eyebrow: 'Streaming · Ch 9 · Part 6',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '..': ' to ' } },
  jargon: ['impression', 'stream', 'event time', 'processing time', 'attribution window', 'nearest', 'one-to-one',
    'lateness', 'function', 'offline', 'assert'],
  sources: {
    ch:    chapter(CH, 'Chapter 9 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 9 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 9 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 9 · the three variations')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['impression', 'stream', 'attribution window', 'nearest', 'one-to-one'],
      eyebrow: '01 · Variation 3 · the attributed click',
      heading: 'Which advert gets the credit for a click?',
      hero: { step: 0, text: 'A website shows adverts; each showing is an <b>impression</b>. Showings and clicks arrive on two <b>streams</b> that never end. A click is credited to an impression shown at most 60 seconds before it — the <b>attribution window</b> — choosing the <b>nearest</b>, the latest that qualifies. And it is <b>one-to-one</b>: each impression is credited with one click at most.[[src:vars]]' },
      tiles: [
        { step: 1, value: 5, label: 'impressions, shown at 1, 3, 130, 245, 540' },
        { step: 1, value: 5, label: 'clicks, at 50, 90, 220, 260, 265' },
        { step: 2, value: 60, suffix: ' s', label: 'the attribution window[[src:vars]]' },
        { step: 2, value: 85, suffix: ' s', label: 'how late one impression arrives[[src:vars]]' }
      ],
      cardsLabel: 'What the interviewer asks',
      cards: [
        { step: 3, n: 1, title: 'How many clicks get credited?', text: 'Given the window, and how long you wait.' },
        { step: 3, n: 2, title: 'How long must you wait?', text: 'And why 60 seconds is the wrong answer.' },
        { step: 4, n: 3, title: 'What may be forgotten?', text: 'Part 4’s streaming question, with a wait added.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A website shows adverts; each showing is an impression. Showings and clicks arrive on two streams. A click is credited to an impression shown at most 60 seconds before it, the nearest one, and each impression to one click at most.',
        'Our example: 5 impressions, shown at 1, 3, 130, 245 and 540 seconds after noon, and 5 clicks, at 50, 90, 220, 260 and 265.',
        'The window is 60 seconds. But one impression, the one shown at 245, reaches the system 85 seconds late. Those two numbers are the whole story.',
        'The interviewer asks how many clicks get credited, given the window and how long you wait; and how long you must wait.',
        'And part 4’s streaming question again: what may be forgotten? We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Clock', layout: 'table', defines: ['event time', 'processing time', 'lateness'],
      eyebrow: '02 · The impressions, and the two clocks on each',
      heading: 'When it was shown, and when the system received it',
      stand: 'Seconds after noon. The clicks here arrive the moment they happen.',
      table: {
        columns: ['Impression', 'Shown at', 'Arrived at', 'How late'],
        rows: [
          { step: 0, cells: ['1st', '1', '1', '0'] },
          { step: 0, cells: ['2nd', '3', '3', '0'] },
          { step: 0, cells: ['3rd', '130', '130', '0'] },
          { step: 1, cells: ['4th', '<b>245</b>', '<b>330</b>', '<b>85</b>'] },
          { step: 1, cells: ['5th', '540', '540', '0'] }
        ]
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the advert was shown.</li><li><b>Processing time</b> — when the system received the record.</li><li>The difference is the <b>lateness</b>. The worst here is 85 seconds, measured, not assumed.[[src:vars]]</li></ul>' },
      narration: [
        'Each impression has two times: when it was shown, and when the system received the record. The first three arrive at once.',
        'The fourth was shown at 245, but did not arrive until 330. The fifth arrives at once.',
        'When it was shown is its event time; when it arrived is its processing time. The difference is its lateness: 85 seconds for the fourth, measured from the data, not assumed.'
      ]
    },

    /* ---------- 3 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '03 · Your turn · a small case first',
      heading: 'The click at 260',
      stand: 'Impressions were shown at 1, 3, 130, 245 and 540. The window is 60 seconds before the click.',
      question: { step: 0, prompt: 'With every record in hand, which impression should the click at 260 be credited to?', options: [
        { text: 'The one shown at 245, 15 seconds before it.', correct: true, why: '245 is inside the window, 260 minus 60 to 260, and it is the only one there.' },
        { text: 'The one shown at 130, the next one back.', correct: false, why: '130 is 130 seconds before the click, far outside the 60-second window.' },
        { text: 'The one shown at 540, the closest in time.', correct: false, why: 'It was shown after the click. An advert cannot cause a click that came first.' } ] },
      cards: [
        { step: 1, title: 'With everything in hand', html: '<p>Credited to 245. But the system receives that record only at <b>330</b> — 70 seconds after the click. When it answers decides whether it ever sees it.[[src:vars]]</p>' }
      ],
      narration: [
        'Try a small case first. With every record already in hand, which impression should the click at 260 be credited to? Choose an answer.',
        'The one shown at 245, inside the window. But the system receives that record only at 330, seventy seconds after the click. So when it answers decides whether it ever sees it.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code',
      eyebrow: '04 · Writing the program · the two streams',
      heading: 'A note, then the impressions and the clicks',
      stand: 'The file opens by defining every word it uses, then holds the data.',
      question: { step: 0, prompt: 'Why does the program store two times for each impression?', options: [
        { text: 'One says if it qualifies; the other, if it has arrived.', correct: true, why: 'When it was shown is tested against the window; when it arrived decides whether the system can see it.' },
        { text: 'To keep a spare in case one of the two times is wrong.', correct: false, why: 'They are not copies. They answer two different questions.' },
        { text: 'Only for printing; the matching itself uses just one.', correct: false, why: 'The matching uses both, which is exactly the problem this program studies.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch09_v3.py · the note and the data' }),
      cards: [ { step: 2, title: 'Two different numbers', html: '<p><code>W</code> is 60, a business rule. <code>TRUE_LATENESS</code> is 85, measured. They are in the same unit and are easy to mix up. <code>UNATTRIBUTED</code> means “credited to nobody” — an answer, not a failure.[[src:vars]]</p>' } ],
      narration: [
        'First the data. Why does the program store two times for each impression? Choose an answer.',
        'One decides whether it qualifies; the other, whether it has arrived yet. Here are the opening lines: a long note defining every word, then the impressions, as shown and arrived pairs, and the clicks.',
        'Two constants matter: the window, 60, a business rule; and the true lateness, 85, measured. Same unit, different meaning. And a click credited to nobody is an answer, not a failure.'
      ]
    },

    /* ---------- 5 · the examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '05 · Writing the program · the worked examples',
      heading: 'Seventeen cases, each with its expected answer',
      stand: 'One punctual impression shown at 100 is pushed against each edge of the window.',
      question: { step: 0, prompt: 'One impression shown at 100, one click at 160 — exactly 60 seconds later. Is it credited?', options: [
        { text: 'Yes: exactly 60 seconds before is inside the window.', correct: true, why: 'Both ends count. At 161 it would be outside, and the click would be credited to nobody.' },
        { text: 'No: the window ends just before 60 seconds have passed.', correct: false, why: 'The rule is “at most 60 seconds before”, so 60 itself is allowed.' },
        { text: 'Only if no other click also wants the same impression.', correct: false, why: 'True in general, but here there is only one click. The question is the edge itself.' } ] },
      code: P.build({ before: [DATA], add: [STREAMS, TABLE], step: 1 }),
      cards: [ { step: 2, title: 'Both sides of every edge', html: '<p>Click at 160: credited. At 161: credited to nobody, not to an older impression — that would bill an advertiser for a click their advert did not cause. At 99: never, it came before the showing.[[src:vars]]</p>' } ],
      narration: [
        'Next, the examples. One impression shown at 100, and one click at 160, exactly 60 seconds later. Is it credited? Choose an answer.',
        'Yes: exactly 60 seconds before is inside. Here is the table: seventeen cases, from no impressions at all, through both edges of the window, to three generated streams of 300.',
        'A click at 161 is credited to nobody, rather than to an older impression; that would bill an advertiser for a click their advert did not cause. And a click at 99 came before the showing: never.'
      ]
    },

    /* ---------- 6 · the window ---------- */
    {
      title: 'Win', layout: 'code', defines: ['function'],
      eyebrow: '06 · Writing the program · does an impression qualify?',
      heading: 'At or before the click, and no more than 60 seconds before',
      stand: 'Two small functions: how late the data runs, and whether one impression qualifies for one click.',
      question: { step: 0, prompt: 'Which test says an impression shown at s qualifies for a click at t?', options: [
        { text: 's lies from t minus 60 up to t, both ends included.', correct: true, why: 'At or before the click, and not further back than the window.' },
        { text: 's is within 60 seconds of t, before it or after it.', correct: false, why: 'An advert shown after the click cannot have caused it.' },
        { text: 's arrived at the system before the click at t did.', correct: false, why: 'That is about arrival, not eligibility. The two must be kept apart.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE], add: [LATENESS, WINDOW], step: 1 }),
      cards: [ { step: 2, title: 'Two questions, two functions', html: '<p>A <b>function</b> is a named recipe. <code>measured_lateness</code> is the worst arrived-minus-shown: 85. <code>in_window</code> tests eligibility only; arrival is a separate question.[[src:vars]]</p>' } ],
      narration: [
        'Which test says an impression shown at time s qualifies for a click at time t? Choose an answer.',
        's lies between t minus 60 and t, both ends included. Here are two functions, named recipes: measured lateness, the worst arrived minus shown, which is 85; and in window, the eligibility test.',
        'Notice in window says nothing about arrival. Whether a record has arrived yet is a separate question, and keeping the two apart is what this whole program is about.'
      ]
    },

    /* ---------- 7 · attribute ---------- */
    {
      title: 'Match', layout: 'code',
      eyebrow: '07 · Writing the program · answering a click',
      heading: 'Wait, then take the latest qualifying impression that has arrived',
      stand: 'The matcher may hold each click for a while before answering, so late records can catch up.',
      question: { step: 0, prompt: 'A click at t is answered after waiting. Which impressions may it consider?', options: [
        { text: 'Arrived by its answer time, inside its window, unused.', correct: true, why: 'Three filters: arrived, eligible, unused. Then it takes the latest, the nearest.' },
        { text: 'Every impression inside its window, arrived or not.', correct: false, why: 'One that has not arrived yet is invisible to the system, whatever its time.' },
        { text: 'Every impression that has arrived so far, at any time.', correct: false, why: 'Arrival alone is not enough; it must also be inside the 60-second window.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE, LATENESS, WINDOW], add: [ATTRIBUTE], step: 1 }),
      cards: [ { step: 2, title: 'Wait controls completeness; the window, eligibility', html: '<p>How long the matcher holds a click before answering is its <b>wait</b>. A click at t is answered at t + wait. The window and the wait are independent, and both are needed.[[src:vars]]</p>' } ],
      narration: [
        'Now the matcher. A click at time t is answered after a wait. Which impressions may it consider? Choose an answer.',
        'Those arrived by its answer time, inside its window, and not yet credited. Here is attribute: it skips anything still in flight, anything outside the window, anything already used, and keeps the latest.',
        'How long the matcher holds a click before answering is called its wait. The wait decides completeness, and the window decides eligibility. They are independent numbers.'
      ]
    },

    /* ---------- 8 · four waits, animated ---------- */
    {
      title: 'Waits', layout: 'array', defines: ['offline'],
      eyebrow: '08 · Watch four waits decide the click at 260',
      heading: 'Only a wait of 85 sees it in time',
      stand: 'The impression shown at 245 arrives at 330. For each wait: when the click at 260 is answered, and whether that impression is in by then.',
      array: {
        labelWidth: 200, slotLabel: 'wait',
        rows: [
          { label: 'wait, seconds', values: WAITS.map(w => w.label) },
          { label: 'click 260 answered at', values: WAITS.map(w => w.answered) },
          { label: 'impression 245 in?', values: WAITS.map(w => w.sees) },
          { label: 'clicks credited', values: WAITS.map(w => w.total) }
        ],
        meters: ['waits tried', 'waits that see it'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 700 },
          { step: 2, do: 'show', rows: [3] },
          { step: 2, do: 'pick', slots: [1] }
        ]
      },
      columns: 2,
      cards: [
        { step: 2, title: 'Waiting 60 is not enough', html: '<p>Answered at 320, still before 330: the click at 260 is credited to nobody. 1 credited, the same as not waiting at all.[[src:vars]]</p>' },
        { step: 3, title: 'Waiting 85 equals offline', html: '<p>Answered 85 seconds after the click, after 330: credited to 245. 2 credited, exactly the <b>offline</b> answer, with every record in hand. Waiting longer adds nothing.[[src:vars]]</p>' }
      ],
      narration: [
        'Four waits: none, 60, 85, and offline, which means waiting until every record is in hand. The click at 260 is answered at 260, at 320, 85 seconds later, or at the very end.',
        'The impression at 245 arrives at 330. Watch which waits see it: only 85 and the last one.',
        'So waiting 60, the window, is not enough. The click is answered at 320, before the record arrives, and is credited to nobody: 1 credited, the same as not waiting at all.',
        'Waiting 85, the measured lateness, gives 2 credited: exactly the offline answer, with every record in hand. Waiting longer adds nothing.'
      ]
    },

    /* ---------- 9 · question: why not 60 ---------- */
    {
      title: 'Why', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'Why does waiting the window’s 60 seconds look right, and fail?',
      stand: 'The window is 60 seconds. The data runs up to 85 seconds late.',
      question: { step: 0, prompt: 'Why is waiting 60 seconds the wrong choice here?', options: [
        { text: 'The window is a business rule; the wait must cover lateness.', correct: true, why: 'They share a unit and look interchangeable, but measure different things. Here 60 against 85.' },
        { text: 'Because 60 seconds is too short a wait for any stream of events at all.', correct: false, why: 'If nothing were ever late, a wait of 0 would do. The right wait comes from the data.' },
        { text: 'It is not wrong: waiting the window is always safe.', correct: false, why: 'It lost the click at 260 here. Safety depends on lateness, not on the window.' } ] },
      cards: [
        { step: 1, title: 'A correctness requirement', html: '<p>The bound on lateness has stopped being an optimisation and become a requirement: wait too little and an attribution is lost, not approximated.[[src:vars]]</p>' }
      ],
      narration: [
        'The window is 60 seconds; the data runs up to 85 seconds late. Why is waiting 60 seconds the wrong choice? Choose an answer.',
        'The window is a business rule, and the wait must cover how late data arrives. Same unit, different meaning. Wait too little and an attribution is lost, not approximated.'
      ]
    },

    /* ---------- 10 · offline and the best possible ---------- */
    {
      title: 'Best', layout: 'code',
      eyebrow: '10 · Writing the program · two yardsticks',
      heading: 'The answer with everything in hand, and the most possible',
      stand: 'Impressions at 100 and 150; clicks at 160 and 199; window 60 seconds.',
      question: { step: 0, prompt: 'Nearest-first: the click at 160 takes 150, the nearer one. How many clicks are credited in all?', options: [
        { text: '1: the click at 199 is left with nothing.', correct: true, why: '100 is 99 seconds before 199, outside the window. One-to-one leaves 199 with nothing.' },
        { text: '2: each of the two clicks gets one impression.', correct: false, why: 'That would need 160 to take 100, the farther one. The rule says nearest.' },
        { text: '0: neither click can be credited at all.', correct: false, why: 'The click at 160 has two candidates and takes 150.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE, LATENESS, WINDOW, ATTRIBUTE], add: [OFFLINE, COUNT, BEST], step: 1 }),
      cards: [ { step: 2, title: 'Nearest is not most', html: '<p>Offline means with every record already in hand, like a nightly batch job. The best possible here is 2 (160 takes 100, 199 takes 150); nearest-first gets 1. That is the rule, not a bug.[[src:vars]]</p>' } ],
      narration: [
        'Two yardsticks. Impressions at 100 and 150, clicks at 160 and 199. Nearest-first gives 160 the impression at 150. How many clicks are credited? Choose an answer.',
        'One. Here are three functions: attribute offline, the answer with every record in hand; matched count; and max matching, the most clicks any rule could credit.',
        'Offline means with everything already in hand, like a nightly batch job. The best possible here is 2, but nearest-first gets 1. That is the rule working, not a bug.'
      ]
    },

    /* ---------- 11 · question: answering early over-reports ---------- */
    {
      title: 'More', layout: 'ask',
      eyebrow: '11 · Your turn · the direction nobody audits',
      heading: 'Can answering too early credit MORE clicks?',
      stand: 'Impressions shown at 31, 109, 115, 132, 199; the one at 132 arrives at 172. Clicks at 30, 51, 89, 154, 181. Answered at once, 3 are credited; the right answer is 2.',
      question: { step: 0, prompt: 'What does that tell you about checking a matcher by its count of credited clicks?', options: [
        { text: 'A count cannot catch it: early answers err both ways.', correct: true, why: 'Usually it credits fewer; here it credits more. A total that can drift either way proves nothing.' },
        { text: 'More credited clicks means the matcher is doing better.', correct: false, why: 'The extra one breaks the rule: 154’s nearest impression was 132, not 109.' },
        { text: 'A lower count than before always means there is a bug.', correct: false, why: 'The right answer, 2, is lower than the rushed 3. Lower can be correct.' } ] },
      cards: [
        { step: 1, title: 'How the extra one appears', html: '<p>The click at 154 cannot see 132 yet, so it takes 109; that leaves 132 free for the click at 181. Three credits from a rule that should make two.[[src:vars]]</p>' }
      ],
      narration: [
        'Answered at once, these streams credit 3 clicks; the right answer is 2. What does that say about checking a matcher by its count? Choose an answer.',
        'A count cannot catch it. The click at 154 cannot see the impression at 132 yet, so it takes 109, leaving 132 free for the click at 181. Answering early errs in both directions.'
      ]
    },

    /* ---------- 12 · what may be forgotten ---------- */
    {
      title: 'Drop', layout: 'code',
      eyebrow: '12 · Writing the program · what may be forgotten',
      heading: 'The window plus the wait',
      stand: 'Suppose no click still to come will be answered before 260. Which impressions might it still need?',
      question: { step: 0, prompt: 'Which impressions can never be needed again?', options: [
        { text: 'Those shown before 260 minus 60 minus 85, which is 115.', correct: true, why: 'A future click reaches back 60 seconds, and late records reach back 85 more. Before 115, nothing can matter.' },
        { text: 'Those shown before 260 minus 60, which is 200.', correct: false, why: 'That forgets lateness: a record shown at 130 might still be in flight.' },
        { text: 'None: a stream must keep every impression it has ever been sent.', correct: false, why: 'With a promise about the future, some can safely go: here those at 1 and 3.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE, LATENESS, WINDOW, ATTRIBUTE, OFFLINE, COUNT, BEST], add: [DROP], step: 1 }),
      cards: [ { step: 2, title: '60 + 85 = 145 seconds', html: '<p>Drop the impressions shown at 1 and 3. Memory is bounded by the window <b>plus</b> the lateness allowance, 145 seconds — neither number alone sizes it.[[src:vars]]</p>' } ],
      narration: [
        'What may be forgotten? Suppose no click still to come will be answered before 260. Which impressions can never be needed again? Choose an answer.',
        'Those shown before 115: 260, minus the 60-second window, minus 85 seconds of lateness. Here is droppable: it keeps only the impressions shown at or after that bound.',
        'So the two impressions at 1 and 3 may go. Memory is bounded by the window plus the lateness allowance, 145 seconds. Neither number alone would have sized it.'
      ]
    },

    /* ---------- 13 · the checks ---------- */
    {
      title: 'Check', layout: 'code', defines: ['assert'],
      eyebrow: '13 · Writing the program · checking every row',
      heading: 'A legal-looking count is not enough',
      stand: 'Each example must be proved, not just counted.',
      question: { step: 0, prompt: 'Besides the count, what should each row check?', options: [
        { text: 'Every credited impression is in its window, and used once.', correct: true, why: 'A count can be right while the matches behind it are illegal. Checking each match closes that gap.' },
        { text: 'That the count is as large as any rule could make it.', correct: false, why: 'Nearest-first is allowed to fall short of the best possible. That is the rule, not an error.' },
        { text: 'Nothing more: if the count matches the table, the row has passed.', correct: false, why: 'As the rushed case showed, a count can drift either way and hide wrong matches.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE, LATENESS, WINDOW, ATTRIBUTE, OFFLINE, COUNT, BEST, DROP], add: [SHOW], step: 1 }),
      cards: [ { step: 2, title: 'Assert', html: '<p>An <b>assert</b> stops the program if its claim is false. Each row: the count, the offline answer whenever the wait covers the lateness, every match in its window, no impression twice.[[src:vars]]</p>' } ],
      narration: [
        'Besides the count, what should each example check? Choose an answer.',
        'That every credited impression is inside its window, and credited only once. Here is show examples: it prints the table and checks every row several ways.',
        'An assert stops the program if its claim is false. Each row checks the count; the offline answer, whenever the wait covers the lateness; and every single match.'
      ]
    },

    /* ---------- 14 · main ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '14 · Writing the program · running everything',
      heading: 'Four waits, two traps, and 600 random streams',
      stand: 'The last function runs every case and asserts the results.',
      question: { step: 0, prompt: 'Across 600 random stream pairs, which wait always equals the offline answer?', options: [
        { text: 'The lateness measured on that pair’s own records.', correct: true, why: 'Then every record is in before any click is answered. It matched offline every single time.' },
        { text: 'The window, 60 seconds, whatever the records say.', correct: false, why: 'The window says nothing about lateness. It already failed on the chapter’s own streams.' },
        { text: 'No wait at all: answer each click as it arrives.', correct: false, why: 'Answering at once matched the offline answer exactly in only 408 of the 600.' } ] },
      code: P.build({ before: [DATA, STREAMS, TABLE, LATENESS, WINDOW, ATTRIBUTE, OFFLINE, COUNT, BEST, DROP, SHOW], add: [MAIN1, MAIN2, MAIN3, END], step: 1 }),
      cards: [ { step: 2, title: 'What the random cases found', html: '<p>Answering at once credited fewer in 133 cases, more in 2, the same number in 465, and matched exactly in only 408. Nearest-first fell short of the best possible in 21.[[src:vars]]</p>' } ],
      narration: [
        'The last function, main, runs everything, then 600 random stream pairs. Which wait always equals the offline answer? Choose an answer.',
        'Waiting the lateness measured on each pair’s own records. Here is main: the four waits, the click at 265 refused by one-to-one, nearest against best, the rushed case, the edges, and the random pairs.',
        'Answering at once credited fewer clicks in 133 cases, more in 2, the same number in 465, and matched exactly in only 408. Nearest-first fell short of the best possible in 21.'
      ]
    },

    /* ---------- 15 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '15 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Scroll through it: you have seen each piece written, and why.',
        'From the top: the note and the streams, the window test, the matcher, the two yardsticks, what may be forgotten, and the checks.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch09_v3.py prints'),
      narration: [
        'Here is what it prints: the seventeen-row table, then the streams and the four waits, 1, 1, 2 and 2 credited.',
        'Then the one-to-one refusal, nearest against best, the rushed case crediting more, the edges, what may be dropped, the random pairs, and all assertions passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'The window says who qualifies; the wait says who has arrived',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>in_window</code>', 'at or before the click, at most 60 seconds back', '160 in, 161 out'] },
          { step: 0, cells: ['<code>attribute</code>', 'after the wait: arrived, eligible, unused — take the latest', 'wait 85: 2 credited'] },
          { step: 1, cells: ['<code>attribute_offline</code>', 'every record in hand: the yardstick', '2 credited'] },
          { step: 1, cells: ['<code>max_matching</code>', 'the most any rule could credit', '2, where nearest gets 1'] },
          { step: 2, cells: ['<code>droppable</code>', 'forget what no future click can reach', 'window + lateness = 145'] }
        ]
      },
      side: { step: 3, title: 'Next · part 7', html: '<p>A calendar this time: report the free hours between busy spans — the gaps, rather than the overlaps.[[src:vars]]</p>' },
      narration: [
        'To recap. In window decides who qualifies: at or before the click, at most 60 seconds back. Attribute waits, then takes the latest qualifying impression that has arrived and is unused.',
        'Offline is the yardstick with everything in hand; max matching is the most possible. Nearest-first can fall short of it by design.',
        'The wait must cover lateness, 85 here, not the window, 60. And memory is bounded by both together: 145 seconds.',
        'Next, part 7: a calendar, where the question is the free hours between busy spans, the gaps rather than the overlaps.'
      ]
    }
  ]
};
