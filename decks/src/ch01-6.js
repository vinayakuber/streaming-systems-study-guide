// Chapter 1, Part 6 — Variation 3, the time-based window, built as a program WITH the viewer.
// The window becomes "the last 60 seconds", so zero, one or many samples leave per arrival and
// the count must be kept beside the total; and the answer changes with no arrival at all, which
// needs a clock-driven recompute. The chapter's two clocks are re-introduced from zero. Every
// listing is read from programs/ch01_v3.py by _prog.js; the narration's results are asserted
// against programs/ch01_v3.out.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch01';
const P = program('ch01_v3.py');
const OUT = program('ch01_v3.out');
const seg = (a, b) => [P.at(a), P.at(b) - 1];

const DOC = [0, P.at("# The seed's nine events") - 1];
const DATA = seg("# The seed's nine events", '# One boundary pair');
const EXAMPLES = seg('# One boundary pair', 'def window_at(');
const WINDOW_AT = seg('def window_at(', 'def prefix_average_at(');
const PREFIX = seg('def prefix_average_at(', 'def average_at(');
const AVG = seg('def average_at(', 'def incremental(');
const INC = seg('def incremental(', 'def expire_one_per_arrival(');
const WRONG = seg('def expire_one_per_arrival(', 'def arrival_driven_reading(');
const CLOCKS = seg('def arrival_driven_reading(', 'def show_examples(');
const SHOW = seg('def show_examples(', 'def main():');
const MAIN1 = seg('def main():', '# ---- the answer changes with no arrival at all');
const MAIN2 = [P.at('# ---- the answer changes with no arrival at all'), P.lines.length - 1];
const upTo = (...ps) => ps;

// the samples are the seed's nine events by event time, each with its own value
const SAMPLES = seed.EVENTS.map(e => [e.et, e.v]).sort((a, b) => a[0] - b[0]);
const SPAN = 60;
const TRUE = SAMPLES.map(([t]) => SAMPLES.filter(([u]) => u <= t && u > t - SPAN));
const COUNT = TRUE.map(w => w.length);
const AVGS = TRUE.map(w => (w.reduce((a, [, v]) => a + v, 0) / w.length).toFixed(3));
const GONE = COUNT.map((c, i) => (i ? COUNT[i - 1] + 1 - c : 0));
// the one-expiry bug, simulated: retire at most one per arrival
const ONE = [], ONE_N = [];
{ const win = []; for (const [t, v] of SAMPLES) { win.push([t, v]); if (win[0][0] <= t - SPAN) win.shift();
  ONE.push((win.reduce((a, [, x]) => a + x, 0) / win.length).toFixed(3)); ONE_N.push(win.length); } }
const VERDICT = ONE.map((a, i) => (a === AVGS[i] ? 'right' : 'wrong'));

const printed = OUT.lines.join('\n');
for (const s of ['SAMPLES (t seconds, v ms) = [(1, 5), (3, 3), (50, 4), (90, 7), (130, 2), (220, 9), (245, 6), (260, 1), (540, 8)]',
  'counts   : [1, 2, 3, 2, 2, 1, 2, 3, 1]', 'expiries : [0, 0, 0, 2, 1, 2, 0, 0, 3]', 'one-expiry-per-arrival is wrong at t = [90, 130, 220, 245, 540]',
  't= 90s reports 4.667 over 3 samples; the truth is 5.500 over 2', 'the fixed divisor 3 is wrong at 7 of 9 arrivals',
  'now=191s  truth   NONE over 0 samples;  arrival-driven dashboard still shows 4.500 over 2', 'now=180s  truth  2.000 over 1 samples',
  'now=10000s truth   NONE over 0 samples;  arrival-driven still shows 8.000 over 1', '20.0 against 15.0 on the same two samples -- a 25% difference',
  'on the first arrival the dashboard can only say 4.0 over 1 sample;', 'the clock at t=10 says 6.0 over 2',
  'Of those, 400 streams have a wrong answer reading HIGH and 393 one reading LOW', 'far future -> None, not the last v      10000      60      9       None      0       9     101',
  'all 19 examples agree with the rescan and the timer-driven scan', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch01_v3.out no longer prints "${s}" — rewrite the narration`);
if (COUNT.join() !== '1,2,3,2,2,1,2,3,1' || GONE.join() !== '0,0,0,2,1,2,0,0,3' || AVGS.join() !== '5.000,4.000,4.000,5.500,4.500,9.000,7.500,5.333,8.000'
  || VERDICT.map((v, i) => (v === 'wrong' ? SAMPLES[i][0] : '')).filter(Boolean).join() !== '90,130,220,245,540'
  || P.lines[P.at('SAMPLES = [(1, 5)')] !== 'SAMPLES = [(1, 5), (3, 3), (50, 4), (90, 7), (130, 2), (220, 9), (245, 6), (260, 1), (540, 8)]')
  throw new Error('the seed or the program no longer gives the numbers this deck animates — rewrite the narration');

module.exports = {
  title: 'The Last Sixty Seconds',
  eyebrow: 'Streaming · Ch 1 · Part 6',
  ...shared,
  jargon: ['sample', 'probe', 'latency', 'window', 'average', 'event time', 'processing time', 'list', 'function', 'half-open',
    'expire', 'timer'],
  sources: {
    ch:    chapter(CH, 'Chapter 1 on GitHub'),
    term:  section(CH, 'Why the word has to be split before anything can be designed', 'Chapter 1 · two timestamps'),
    model: section(CH, 'How to model it', 'Chapter 1 · the running total'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 1 · variation 3, the time-based window'),
    whole: section(CH, 'The whole program', 'Chapter 1 · the whole program')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['sample', 'probe', 'latency', 'window', 'average', 'event time', 'processing time'],
      eyebrow: '01 · Variation 3 · looks like monitoring',
      heading: 'A dashboard shows the average latency of the last 60 seconds',
      hero: { step: 0, text: 'Small checking programs, <b>probes</b>, measure how slow a website is: its <b>latency</b>, in milliseconds. Each measurement is a <b>sample</b>, stamped with the second it was taken: its <b>event time</b>. The dashboard has its own clock, reading “now”: <b>processing time</b>. At any now it must show the <b>average</b> of the samples taken in the last 60 seconds: the <b>window</b>.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'samples, taken at seconds 1 to 540[[src:vars]]' },
        { step: 1, value: 60, label: 'seconds in the window[[src:vars]]' },
        { step: 2, value: 3, label: 'samples that leave at once at second 540' },
        { step: 2, value: 191, label: 'a second when there is no average at all' }
      ],
      cardsLabel: 'Two things that break',
      cards: [
        { step: 3, n: 1, title: 'One in, one out is false', text: 'Zero, one or many samples can leave when one arrives.' },
        { step: 3, n: 2, title: 'The divisor moves', text: 'The count of samples changes, so it must be kept beside the total.' },
        { step: 4, n: 3, title: 'The answer moves with no arrival', text: 'Samples age out while nothing comes in.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'Small checking programs, called probes, measure how slow a website is, its latency. Each measurement is a sample, stamped with the second it was taken: its event time. The dashboard has its own clock, reading now: processing time.',
        'At any moment, the dashboard must show the average of the samples taken in the last 60 seconds. That stretch is the window. Our 9 samples are the chapter’s nine events, taken at seconds 1 to 540.',
        'Probes report whenever they like, so the gaps are uneven. At second 540, three samples leave the window at once. And at second 191 there is no average at all.',
        'Two things from the fixed window break. One in, one out is false: zero, one or many samples can leave. So the count of samples moves, and must be kept beside the total.',
        'And the subtler one: the answer changes even when nothing arrives, because samples age out. We will write the program together; you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · before any code',
      heading: 'At second 90, a 7 ms sample arrives',
      stand: 'Samples so far: 5 ms at second 1, 3 ms at second 3, 4 ms at second 50. Now 7 ms at second 90. The window is the 60 seconds up to now.',
      question: {
        step: 0,
        prompt: 'What is the average latency at second 90?',
        options: [
          { text: '5.5: the samples at seconds 50 and 90.', correct: true,
            why: 'The window runs back to second 30. The samples at seconds 1 and 3 are too old, so it is (4 + 7) over 2.' },
          { text: '4.667: the last 3 samples, as a fixed window would.', correct: false,
            why: 'That keeps the sample from second 3, far more than 60 seconds old. The window is time, not a count.' },
          { text: 'The average of all four samples so far.', correct: false,
            why: 'Two of them are older than 60 seconds. They have left the window.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two leave at once', html: '<p>One sample arrived and <b>two</b> left. In the fixed window exactly one left per arrival; here it can be none, one, or many.[[src:vars]]</p>' },
        { step: 2, title: 'So the divisor moves', html: '<p>The answer divides by <b>2</b> here, not 3. The number of samples in the window has to be kept, beside the total.[[src:vars]]</p>' }
      ],
      narration: [
        'A small case first. Samples so far: 5 milliseconds at second 1, 3 at second 3, 4 at second 50. Now 7 arrives at second 90. What is the average latency at second 90? Choose an answer.',
        'Five and a half. The window runs back to second 30, so the samples at seconds 1 and 3 are too old. One sample arrived and two left at once.',
        'And the answer divides by 2, not by 3. The number of samples in the window keeps changing, so it has to be kept beside the total.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'The seed’s nine events, as samples',
      stand: 'The top of the file defines every word. Then the nine samples, each as (second taken, latency).',
      question: { step: 0, prompt: 'Why use the seed’s own uneven times, rather than one sample every 10 seconds?', options: [
        { text: 'So that none, one and many samples leaving all appear in one run.', correct: true, why: 'Between seconds 3 and 50 nothing leaves; at 90 two leave; at 540 three leave. Even gaps would hide that.' },
        { text: 'Because probes never report at even times.', correct: false, why: 'Some do. The uneven times are chosen so that every case the program must handle shows up.' },
        { text: 'So the average comes out a whole number.', correct: false, why: 'It does not: 5.333 is one of the answers.' } ] },
      code: P.build({ add: [DOC, DATA], step: 1, label: 'programs/ch01_v3.py · the words, then the data' }),
      cards: [ { step: 2, title: 'The data', html: '<p><code>SAMPLES</code> is a <b>list</b> of (second, latency) pairs, in time order. <code>SPAN = 60</code>, the window. <code>W = 3</code> is kept only to run the fixed-divisor mistake later.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. Why use the seed’s own uneven times, rather than one sample every 10 seconds? Choose an answer.',
        'So that none, one and many samples leaving all appear in one run. Here is the top of the file. It defines the words: sample, now, window and average. Then the nine samples, each a second and a latency.',
        'Samples is a list of pairs, in time order. Span is 60, the window in seconds. And W, 3, is kept only so that a common mistake, dividing by a fixed 3, can be run later.'
      ]
    },

    /* ---------- 4 · the window's edge ---------- */
    {
      title: 'Edge', layout: 'code', defines: ['function', 'half-open'],
      eyebrow: '04 · Writing the program · which samples are in the window?',
      heading: 'A sample exactly 60 seconds old: in or out?',
      stand: 'The reference: re-read every sample and keep those inside the window at clock time “now”.',
      question: { step: 0, prompt: 'Samples at second 0 (10 ms) and second 60 (20 ms). Asked at now = 60, is the sample from second 0 inside?', options: [
        { text: 'It does not matter either way.', correct: false, why: 'It does: keeping it gives 15.0, dropping it gives 20.0, a 25% difference on the same two samples.' },
        { text: 'In: 60 seconds old is still within 60 seconds.', correct: false, why: 'That is a defensible choice, but not this program’s. What matters is that one choice is made and written down.' },
        { text: 'Out: the program decides that exactly 60 old has just left.', correct: true, why: 'The window is from now − 60, not included, up to now, included. So the answer is 20.0.' } ] },
      code: P.build({ before: upTo(DOC, DATA), add: [WINDOW_AT], step: 1 }),
      cards: [ { step: 2, title: 'Half-open', html: '<p>A <b>function</b> is a named recipe. <code>window_at</code> keeps <code>now - span &lt; t &lt;= now</code>: open at the old end, closed at the new. A range like that is <b>half-open</b>. The choice changes the answer, so it is decided, not left vague.[[src:vars]]</p>' } ],
      narration: [
        'First the reference: which samples are in the window at clock time now? Samples at second 0 and second 60. Asked at now equals 60, is the one from second 0 inside? Choose an answer.',
        'Out. Here is window at. It keeps a sample only if it is newer than now minus 60, and not newer than now. A sample exactly 60 seconds old has just left.',
        'Each piece is a function, a named recipe. A range that leaves out one end and includes the other is called half-open. The other choice is defensible too; leaving it undecided is not, because it changes the answer from 20 to 15.'
      ]
    },

    /* ---------- 5 · the empty window ---------- */
    {
      title: 'Empty', layout: 'code',
      eyebrow: '05 · Writing the program · the average, and an empty window',
      heading: 'What is the average of no samples?',
      stand: 'At second 191 the last sample, from second 130, is 61 seconds old. The window is empty.',
      question: { step: 0, prompt: 'What should the dashboard show when the window holds no samples?', options: [
        { text: '0 ms: nothing was measured, so nothing was slow.', correct: false, why: 'A 0 ms latency looks perfectly healthy, exactly when the probes have stopped answering.' },
        { text: 'No average at all: “None”.', correct: true, why: 'There is no average of no values, just as there was none before the first window filled.' },
        { text: '2 ms: the last sample that was in the window.', correct: false, why: 'That sample is 61 seconds old. Showing it reports a latency nobody measured in the last minute.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WINDOW_AT), add: [AVG], step: 1 }),
      cards: [ { step: 2, title: 'None, not 0.0', html: '<p><code>average_at</code> returns <code>(None, 0)</code> for an empty window: no average, zero samples. A 0.0 would be a dashboard showing a healthy latency when the probes have gone quiet.[[src:vars]]</p>' } ],
      narration: [
        'At second 191 the last sample, from second 130, is 61 seconds old, so the window is empty. What should the dashboard show? Choose an answer.',
        'No average at all. Here is average at: it asks window at for the samples, and if there are none it returns none, with a count of zero. Otherwise it returns the average and the count.',
        'Showing zero would be a dashboard reporting a perfectly healthy latency exactly when the probes have stopped answering. None says what is true: there is nothing to average.'
      ]
    },

    /* ---------- 6 · the incremental answer ---------- */
    {
      title: 'Total', layout: 'code', defines: ['expire'],
      eyebrow: '06 · Writing the program · keep the total AND the count',
      heading: 'At second 540, how many samples leave?',
      stand: 'The fast answer keeps the window’s samples, their total, and divides by how many there are. Second 540 comes after a 280-second gap.',
      question: { step: 0, prompt: 'When the sample at second 540 arrives, how many samples leave the window?', options: [
        { text: 'One: the oldest, as in a fixed window.', correct: false, why: 'After a 280-second gap, everything from seconds 220, 245 and 260 is too old at once.' },
        { text: 'None: the window keeps everything it held.', correct: false, why: 'The window is the last 60 seconds. Samples from 220, 245 and 260 are all older than that.' },
        { text: 'Three: the samples from seconds 220, 245 and 260.', correct: true, why: 'All three are more than 60 seconds old at 540, so the removal must loop until none is.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WINDOW_AT, AVG), add: [INC], step: 1 }),
      cards: [ { step: 2, title: 'A while, not an if', html: '<p>Leaving the window is to <b>expire</b>. The removal is a <code>while</code>, which repeats, not an <code>if</code>, which happens once. The divisor is <code>len(win)</code>, the live count. Expired per arrival: 0, 0, 0, 2, 1, 2, 0, 0, <b>3</b>.[[src:vars]]</p>' } ],
      narration: [
        'Now the fast answer. It keeps the window’s samples and their total, and divides by how many there are. Second 540 comes after a 280-second gap. How many samples leave when it arrives? Choose an answer.',
        'Three: the samples from seconds 220, 245 and 260. Here is incremental. It adds the arrival, then removes from the front while the oldest sample is too old. That is a while, which repeats, not an if, which happens once.',
        'A sample leaving the window is said to expire. Per arrival, the expiries are 0, 0, 0, 2, 1, 2, 0, 0 and 3. And it divides by the live count, not by a fixed number.'
      ]
    },

    /* ---------- 7 · watch it run ---------- */
    {
      title: 'Run', layout: 'array',
      eyebrow: '07 · Watch the total and the count, arrival by arrival',
      heading: 'The count rises and falls, so the divisor does too',
      stand: 'One column per sample, in time order. Each column is what the program knows right after that sample arrives.',
      array: {
        labelWidth: 170, slotLabel: 'arrival',
        rows: [
          { label: 'second taken', values: SAMPLES.map(s => s[0]) },
          { label: 'latency (ms)', values: SAMPLES.map(s => s[1]) },
          { label: 'expired here', values: GONE },
          { label: 'count', values: COUNT },
          { label: 'average', values: AVGS }
        ],
        meters: ['arrivals', 'samples expired in all'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 320 },
          { step: 2, do: 'show', rows: [3, 4] },
          { step: 3, do: 'pick', slots: [3, 8] }
        ]
      },
      cards: [
        { step: 3, title: 'Second 90 and second 540', html: '<p>At 90, two expire and the count drops to 2: average <b>5.500</b>. At 540, three expire and only the new sample is left: <b>8.000</b>.[[src:vars]]</p>' },
        { step: 4, title: 'Every sample accounted for', html: '<p>8 expired + 1 still in the window = all 9 samples. The program asserts exactly that.[[src:whole]]</p>' }
      ],
      narration: [
        'Here are the nine samples in time order: the second each was taken, and its latency in milliseconds.',
        'The next row is how many expired when each one arrived. Watch the pointer add them up: 8 samples expire in all, none of them at seconds 3 or 50, three at once at 540.',
        'Below: the count in the window after each arrival, and the average. The count goes 1, 2, 3, then down to 2, up and down again. The divisor moves with it.',
        'At second 90, two expire and the average is 5.5 over 2 samples. At second 540, three expire and only the new sample is left: 8.',
        'And every sample is accounted for: 8 expired, plus 1 still in the window, makes all 9. The program asserts that too.'
      ]
    },

    /* ---------- 8 · the wrong answers ---------- */
    {
      title: 'Wrong', layout: 'code',
      eyebrow: '08 · Writing the program · two appealing wrong answers',
      heading: 'An if where the while belongs',
      stand: 'The first wrong answer retires at most ONE sample per arrival, as a fixed window would. The second expires correctly but always divides by 3.',
      question: { step: 0, prompt: 'With at most one expiry per arrival, at which seconds is the average wrong?', options: [
        { text: 'Only where two or more were due: 90, 220 and 540.', correct: false, why: 'That was the program author’s first guess too. Measured, the missed samples are never caught up, so the error carries on.' },
        { text: 'At five arrivals, including 130 and 245, where only one was due.', correct: true, why: 'Once behind, each arrival adds one and retires one, so the stale backlog is carried forever.' },
        { text: 'Nowhere: one expiry per arrival is always enough.', correct: false, why: 'At second 90 two samples are due to leave. Retiring one keeps a stale sample in the total.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WINDOW_AT, AVG, INC), add: [WRONG], step: 1 }),
      cards: [ { step: 2, title: 'Wrong at 5 of 9, right once by accident', html: '<p>Wrong at 90, 130, 220, 245, 540. At 260 it is right <b>by accident</b>: the stale window happens to hold the right three samples. The fixed divisor is wrong at <b>7 of 9</b> — right only when the count is 3.[[src:vars]]</p>' } ],
      narration: [
        'Two wrong answers are worth writing down. The first retires at most one sample per arrival, as a fixed window would. At which seconds is its average wrong? Choose an answer.',
        'At five arrivals, including 130 and 245, where only one sample was due. Here they are. The first has an if where the while belongs. Once it falls behind, every arrival adds one and retires one, so the backlog is never caught up.',
        'It is wrong at 90, 130, 220, 245 and 540, and right at 260 only by accident. The second wrong answer expires correctly but divides by 3, and is wrong at 7 of 9 arrivals.'
      ]
    },

    /* ---------- 9 · watch the stale backlog ---------- */
    {
      title: 'Stale', layout: 'array',
      eyebrow: '09 · Watch the one-expiry version fall behind',
      heading: 'Once behind, never caught up',
      stand: 'One column per sample. The one-expiry version’s count sticks at 3 after second 90.',
      array: {
        labelWidth: 190, slotLabel: 'arrival',
        rows: [
          { label: 'second taken', values: SAMPLES.map(s => s[0]) },
          { label: 'true average', values: AVGS },
          { label: 'one-expiry average', values: ONE },
          { label: 'one-expiry count', values: ONE_N },
          { label: 'one-expiry is', values: VERDICT }
        ],
        meters: ['arrivals compared', 'wrong answers'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'show', rows: [4] },
          { step: 2, do: 'sweep', row: 4, mode: 'match', match: 'wrong', readMeter: 0, resultMeter: 1, speed: 320 },
          { step: 3, do: 'pick', slots: [4, 7] }
        ]
      },
      cards: [
        { step: 3, title: 'Second 130', html: '<p>Only one sample was due to leave, and one left — but one from the earlier backlog was still there. 4.333 over 3, against 4.500 over 2.[[src:vars]]</p>' },
        { step: 3, title: 'Second 260', html: '<p>Right by accident: the stale window happens to hold exactly the right three samples. Nothing is visible at that arrival.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine arrivals again, with the true average after each.',
        'Under them, the one-expiry version’s average and count. From second 90 on, its count is stuck at 3: it fell behind by one sample and never catches up.',
        'Compare them arrival by arrival. Watch the pointer: 5 wrong answers.',
        'At 130 only one sample was due to leave, yet the answer is still wrong, because of the backlog. And at 260 it is right only by accident: the stale window happens to hold the right three samples.'
      ]
    },

    /* ---------- 10 · the answer moves with no arrival ---------- */
    {
      title: 'Quiet', layout: 'code', defines: ['timer'],
      eyebrow: '10 · Writing the program · when nothing arrives',
      heading: 'Nothing arrives between second 130 and second 220',
      stand: 'A dashboard that recomputes only when a sample arrives keeps showing its last answer: 4.5 over 2 samples, from second 130.',
      question: { step: 0, prompt: 'At now = 191, with no new sample since second 130, what is the TRUE average?', options: [
        { text: '4.5: the last answer, from second 130.', correct: false, why: 'Both samples behind that answer have since aged out. It was true 61 seconds ago.' },
        { text: '2.0: the one sample left, from second 130.', correct: false, why: 'That was true at second 180. By 191, that sample too is more than 60 seconds old.' },
        { text: 'None: every sample has aged out of the window.', correct: true, why: 'At 191 the window holds only samples newer than 60 seconds, and none was taken since 130. The answer moved with no arrival at all.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WINDOW_AT, AVG, INC, WRONG), add: [CLOCKS], step: 1 }),
      cards: [ { step: 2, title: 'Driven by the clock', html: '<p>A <b>timer</b> wakes the program every tick of the clock, arrival or not. <code>timer_driven_scan</code> admits samples as they come due and expires by age on every tick: the answer follows <b>processing time</b>, not just arrivals.[[src:vars]]</p>' } ],
      narration: [
        'Nothing arrives between second 130 and second 220. A dashboard that recomputes only on arrival keeps showing 4.5. At now equals 191, what is the true average? Choose an answer.',
        'None. Every sample has aged out. Here are two readers: arrival driven reading, which just holds its last answer, and timer driven scan, which advances by the clock and expires samples on every tick.',
        'Something that wakes the program on every tick of the clock is a timer. An answer driven only by arrivals is keyed to when data came in. A timer-driven one is keyed to the clock, the processing time. Watch the two side by side.'
      ]
    },

    /* ---------- 11 · the quiet stretch, as a timeline ---------- */
    {
      title: 'Clock', layout: 'timeline',
      eyebrow: '11 · Watch the clock move while nothing arrives',
      heading: 'The truth moves; the arrival-driven screen does not',
      stand: 'Each point is a clock reading. Under it: the true answer, and what an arrival-driven dashboard still shows.',
      timeline: [
        { step: 0, time: 'now = 130', title: 'Truth 4.500, 2 samples', text: 'Screen: 4.500. Both agree.[[src:vars]]' },
        { step: 1, time: 'now = 180', title: 'Truth 2.000, 1 sample', text: 'Screen still: 4.500.[[src:vars]]' },
        { step: 2, time: 'now = 191', title: 'Truth: none, 0 samples', text: 'Screen still: 4.500.[[src:vars]]' },
        { step: 3, time: 'now = 10000', title: 'Truth: none', text: 'Screen still: 8.000, from second 540.[[src:vars]]' }
      ],
      strip: { step: 1, label: 'What the arrival-driven screen shows at each clock reading, and whether it is still true', items: [
        { n: 'now 130', text: '4.500 · true', tone: 'ok' }, { n: 'now 180', text: '4.500 · truth is 2.000', tone: 'warn' },
        { n: 'now 191', text: '4.500 · truth is none', tone: 'warn' }, { n: 'now 219', text: '4.500 · truth is none', tone: 'warn' },
        { n: 'now 10000', text: '8.000 · truth is none', tone: 'warn' } ] },
      narration: [
        'At second 130 a sample has just arrived. The true average is 4.5 over 2 samples, and the screen shows 4.5. They agree.',
        'At second 180 nothing has arrived, but the older sample has aged out. The truth is 2 over 1 sample. The arrival-driven screen still says 4.5.',
        'At second 191 the last sample has aged out too. The truth is no average at all. The screen still says 4.5.',
        'And at second 10000, long after the last sample at 540, the screen still shows 8. The error is not in the value; the number is simply old. The timer-driven scan matches the truth every time.'
      ]
    },

    /* ---------- 12 · the examples table ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '12 · Writing the program · worked examples, checked two ways',
      heading: 'Nineteen examples, and where the timer costs more',
      stand: 'Each row is checked against the rescan and the timer-driven scan, and prints the rescan’s reads beside the timer’s ticks.',
      question: { step: 0, prompt: 'Asked at second 10000 with nothing new since 540: which costs more, the timer or a rescan?', options: [
        { text: 'The rescan: it reads every sample again.', correct: false, why: 'There are only 9 samples to read. The timer has to tick through the whole quiet stretch.' },
        { text: 'The timer: 101 ticks, against 9 reads.', correct: true, why: 'Correctness during a quiet stretch costs a tick per step of the clock, whether or not anything happens.' },
        { text: 'They cost the same.', correct: false, why: 'The table prints both: 9 reads for the rescan, 101 ticks for the timer at a 100-second tick.' } ] },
      code: P.build({ before: upTo(DOC, DATA, WINDOW_AT, AVG, INC, WRONG, CLOCKS), add: [EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'What correctness costs', html: '<p>The quiet rows are where the timer loses: 101 ticks at a 100-second tick to hold an answer a 9-sample rescan gives in 9 reads. The table also holds the edge pair, a 1-second window, two probes in the same second, and 20,000 samples.[[src:whole]]</p>' } ],
      narration: [
        'Next, a table of worked examples, each checked against both the rescan and the timer. Asked at second 10000, with nothing new since 540, which costs more? Choose an answer.',
        'The timer: 101 ticks, against 9 reads. Here is the table and the function that prints and asserts it. The quiet rows are exactly where the timer pays for being right.',
        'It also holds the edge pair, a one-second window, two probes reporting in the same second, and a generated stream of 20,000 samples.'
      ]
    },

    /* ---------- 13 · main, part 1 ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '13 · Writing the program · checking the trace and the wrong answers',
      heading: 'Assert the counts, the expiries, and both bugs',
      stand: 'On these nine samples, every wrong answer of the one-expiry version reads LOW.',
      question: { step: 0, prompt: 'Does the one-expiry bug always make the average too low?', options: [
        { text: 'Yes: keeping old samples always pulls it down.', correct: false, why: 'Only if the stale samples are smaller than the true average, as they happen to be here.' },
        { text: 'No: on random streams it reads high as well as low.', correct: true, why: 'Measured on 600 random streams: 400 have a wrong answer reading high, and 393 one reading low.' },
        { text: 'It never changes the average, only the count.', correct: false, why: 'At second 90 it reports 4.667 against the true 5.5. The average itself is wrong.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EXAMPLES, WINDOW_AT, AVG, INC, WRONG, CLOCKS, SHOW), add: [PREFIX, MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'No safe side to err on', html: '<p>Asserted: counts [1, 2, 3, 2, 2, 1, 2, 3, 1], expiries [0, 0, 0, 2, 1, 2, 0, 0, 3], wrong at [90, 130, 220, 245, 540], all low <b>here</b>. That is a property of these values, not of the bug.[[src:whole]]</p>' } ],
      narration: [
        'On these nine samples, every wrong answer of the one-expiry version reads too low. Does that bug always make the average too low? Choose an answer.',
        'No. On random streams it reads high as well as low. Here is the first part of main, and a helper it uses: the average as reported on each arrival. It asserts the counts, the expiries, and exactly where both bugs go wrong.',
        'All the errors on these nine are low because every stale sample happens to be below the true average. The random streams later in main show 400 streams reading high and 393 low. There is no safe side to err on.'
      ]
    },

    /* ---------- 14 · main, part 2 ---------- */
    {
      title: 'Ties', layout: 'code',
      eyebrow: '14 · Writing the program · quiet time, the edge, and ties',
      heading: 'Two probes report in the same second',
      stand: 'The rest of main asserts the quiet stretch, the window’s edge, and a tie: samples (10, 4) and (10, 8), both taken at second 10.',
      question: { step: 0, prompt: 'When the first of the two arrives, what can the dashboard honestly show?', options: [
        { text: '6.0 over 2 samples, since both were taken at second 10.', correct: false, why: 'The second has not arrived yet. On the first arrival, the dashboard has seen only one.' },
        { text: '4.0 over 1 sample; the clock view at second 10 later says 6.0 over 2.', correct: true, why: 'The same instant, a later and more complete view of it. “The average at time t” is two different questions.' },
        { text: 'Nothing, until a whole second has passed.', correct: false, why: 'An answer is due on each arrival. It is simply less complete than the clock’s later view.' } ] },
      code: P.build({ before: upTo(DOC, DATA, EXAMPLES, WINDOW_AT, PREFIX, AVG, INC, WRONG, CLOCKS, SHOW, MAIN1), add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Arrival view and clock view', html: '<p>On arrival: 4.0 over 1. At clock time 10: 6.0 over 2. The same instant, seen later. Only ties expose it. Then 600 irregular streams check everything against the rescan.[[src:vars]]</p>' } ],
      narration: [
        'The rest of main checks the quiet stretch, the window’s edge, and ties: two samples both taken at second 10, 4 and 8 milliseconds. When the first arrives, what can the dashboard honestly show? Choose an answer.',
        'Four, over one sample. Asked later by the clock, at second 10, the answer is 6 over two. Same instant, a later and more complete view. Here is the rest of main, ending with 600 irregular streams checked against the rescan.',
        'So the average at time t is really two questions: what the dashboard could say when a sample arrived, and what is true at that clock time. The same split as the chapter’s two clocks, in miniature.'
      ]
    },

    /* ---------- 15 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '15 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      question: { step: 0, prompt: 'Which two changes turn the fixed-window running total into this one?', options: [
        { text: 'A while for expiry, and dividing by the live count.', correct: true, why: 'Zero, one or many expire per arrival, and the divisor is the number actually in the window.' },
        { text: 'Re-reading the window, and rounding the answer.', correct: false, why: 'Re-reading is the reference, not the fast answer, and nothing is rounded.' },
        { text: 'Sorting the samples, and keeping a maximum.', correct: false, why: 'The samples are already in time order, and this is an average, not a maximum.' } ] },
      code: P.whole(),
      cards: [ { step: 1, title: 'Plus a timer', html: '<p>And a third, the subtle one: a timer-driven recompute, because the answer moves when nothing arrives.[[src:vars]]</p>' } ],
      narration: [
        'Here is the whole program, exactly as the chapter runs it. Which two changes turn the fixed-window running total into this one? Choose an answer.',
        'A while for expiry, and dividing by the live count. And a third, the subtle one: a timer-driven recompute, because the answer moves even when nothing arrives.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      question: { step: 0, prompt: 'Two samples exactly 60 seconds apart give 20.0 one way and 15.0 the other. What decides it?', options: [
        { text: 'Rounding in the division.', correct: false, why: 'Both are exact: 20 over 1, and 30 over 2. Nothing is rounded.' },
        { text: 'One comparison: whether a sample exactly 60 old is in.', correct: true, why: 'Strictly newer than now − 60, or not older than it. A 25% difference decided by one character.' },
        { text: 'Which sample arrived first.', correct: false, why: 'The order is the same both ways. Only the edge of the window differs.' } ] },
      code: OUT.whole('what python3 programs/ch01_v3.py prints'),
      narration: [
        'Here is what the program prints. Two samples exactly 60 seconds apart give 20 one way and 15 the other. What decides it? Choose an answer.',
        'One comparison: whether a sample exactly 60 seconds old is inside. That is a 25 percent difference decided by a single character. Above it: the trace, both bugs, and the quiet stretch, then all assertions passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'A total, a live count, and a clock',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>window_at</code>', 'the reference, half-open: exactly 60 seconds old is out', '20.0, not 15.0'] },
          { step: 0, cells: ['<code>average_at</code>', 'no samples, no average', 'None at second 191'] },
          { step: 1, cells: ['<code>incremental</code>', 'total and count; a while for expiry', '3 expire at second 540'] },
          { step: 1, cells: ['the two bugs', 'an if for the while; a fixed divisor of 3', 'wrong at 5 and 7 of 9'] },
          { step: 2, cells: ['<code>timer_driven_scan</code>', 'expires by the clock, arrival or not', 'none at 191, not 4.500'] }
        ]
      },
      side: { step: 3, title: 'Next · part 7', html: '<p>Back to the fixed window, but the program is <b>restarted</b> half-way. What must it save so the answers carry on? Not just the total.[[src:vars]]</p>' },
      narration: [
        'To recap. Window at is the reference, and it is half-open: a sample exactly 60 seconds old is out. Average at returns none for an empty window, never zero.',
        'Incremental keeps the total and the live count, and expires with a while: three at once at second 540. The two bugs, an if for the while and a fixed divisor, are wrong at 5 and 7 of 9 arrivals.',
        'And the timer-driven scan expires by the clock, so at second 191 it says none, where an arrival-driven screen still says 4.5.',
        'Next, part 7 goes back to the fixed window, but the program is restarted half-way through. What must it save so that the answers carry on?'
      ]
    }
  ]
};
