// Chapter 3, Part 4 — the Google interview question, built as a program WITH the viewer:
// the largest value in a window that slides, and the watermark that needs it. Every code
// slide asks what the next piece must do, then reveals the real lines from programs/ch03.py
// (read at build time by _prog.js, addressed by content, never by line number). The last
// slides show the whole file and what it actually prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch03';
const P = program('ch03.py');
const OUT = program('ch03.out');

// the pieces, in the order they are written
const DATA = P.span('# Data, all from', 'L = 6        #');
const SIZES = P.span('N = len(TICKS)', 'NWIN = N - W + 1');
const BRUTE = P.fn('brute_max');
const EVICT = P.fn('evict_smaller');
const EXPIRE = P.fn('expire');
const SLIDE = P.fn('slide_max');
const EVICT_LO = P.fn('evict_larger');
const SPREAD = P.fn('slide_spread');
const WMDATA = P.span('# The watermark half.', 'TAIL = [');
const UNB = P.fn('watermark_unbounded');
const BND = P.fn('watermark_bounded');
const MAIN = P.span('def main():', '    main()');

// the ticks, read from the program itself, and the deque replayed so the animation is the program's
const TICKS = JSON.parse(P.lines[P.at('TICKS = [')].split('=')[1]);
const W = 3;
const replay = (() => {
  const dq = [], states = [], evicted = [], shown = [];
  TICKS.forEach((v, i) => {
    let ev = 0;
    while (dq.length && TICKS[dq[dq.length - 1]] <= v) { dq.pop(); ev++; }
    dq.push(i);
    if (dq[0] <= i - W) dq.shift();
    states.push(dq.map(j => `${j}:${TICKS[j]}`).join(' '));
    evicted.push(ev);
    shown.push(i >= W - 1 ? TICKS[dq[0]] : '—');
  });
  return { states, evicted, shown };
})();

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['scan     : [7, 7, 7, 6, 9, 9, 9]   (7 windows x 3 = 21 reads)', '(9p + 6e + 1f = 16 steps)',
  'spreads  : [4, 5, 5, 5, 8, 8, 5]   (2 over 6, 5 under)', 'clean stream, unbounded: 1 late [50]',
  'unbounded wm after it = 999939, at the end = 999939', 'bounded   wm after it = 999939, at the end = 780',
  'falsely late: unbounded [245, 260, 220, 540, 600, 660, 720, 780, 840, 900]  (10)', 'bounded   [245, 260, 220]  (3)',
  'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch03.out no longer prints "${s}" — rewrite the narration`);
if (TICKS.join() !== '5,3,7,2,6,1,9,4,8' || replay.evicted.reduce((a, b) => a + b, 0) !== 6 || Math.max(...replay.evicted) !== 2
  || replay.shown.slice(W - 1).join() !== '7,7,7,6,9,9,9')
  throw new Error('programs/ch03.py no longer has the ticks this deck explains — rewrite the narration');

module.exports = {
  title: 'The Sliding Maximum',
  eyebrow: 'Streaming · Ch 3 · Part 4',
  ...shared,
  jargon: ['tick', 'window', 'index', 'function', 'scan', 'evict', 'deque', 'expire', 'spread',
    'event time', 'processing time', 'watermark', 'late'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 3 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 3 · how to model it'),
    whole: section(CH, 'The whole program', 'Chapter 3 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 3 · the solution, traced'),
    what:  section(CH, 'What a watermark is', 'Chapter 3 · what a watermark is')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['tick', 'window', 'watermark', 'spread'],
      eyebrow: '01 · A Google interview question',
      heading: 'A risk screen, a stream of prices, and the highest of the last few',
      hero: { step: 0, text: 'A trading risk screen receives a stream of values, one at a time. Each arrival is a <b>tick</b>. The screen shows the highest value among the last <b>W</b> ticks, a stretch called the <b>window</b>, and must update on every tick.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'ticks in our example: 5, 3, 7, 2, 6, 1, 9, 4, 8[[src:prob]]' },
        { step: 1, value: 3, label: 'ticks per window, W, in our example[[src:prob]]' },
        { step: 2, value: 100000, label: 'ticks per window in the real problem[[src:trace]]' },
        { step: 2, value: 6, label: 'the spread to warn about, L[[src:prob]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'The highest of the last 3', text: 'On every tick, without re-reading the window.' },
        { step: 3, n: 2, title: 'Then the spread', text: 'Warn when highest minus lowest is more than 6.' },
        { step: 4, n: 3, title: 'And why it is in this chapter', text: 'The same machine keeps a watermark safe from one bad value.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'A trading risk screen receives a stream of values, one at a time. Each arrival is called a tick. The screen shows the highest value among the last W ticks, a stretch called the window, and updates on every tick.',
        'Our example has 9 ticks: 5, 3, 7, 2, 6, 1, 9, 4 and 8, with a window of 3.',
        'In the real problem the window holds up to 100,000 ticks, and there are millions of ticks a day. Re-reading the window on every tick is forbidden. Then the screen must also warn when highest minus lowest is more than 6.',
        'So: the highest of the last 3 on every tick, without re-reading the window. Then the spread, highest minus lowest.',
        'And the same machine turns out to protect a watermark, a clock-like number in data pipelines, from one corrupt value. We will write the program together, one piece at a time.'
      ]
    },

    /* ---------- 2 · try a case ---------- */
    {
      title: 'Try', layout: 'ask',
      eyebrow: '02 · Your turn · a small case first',
      heading: 'The windows of 3, by hand',
      stand: 'Ticks 0 to 8 hold 5, 3, 7, 2, 6, 1, 9, 4, 8. The first window is ticks 0 to 2; the last is ticks 6 to 8.',
      question: { step: 0, prompt: 'The window of ticks 3, 4 and 5 holds 2, 6 and 1. What does the screen show for it?', options: [
        { text: '6: the highest of those three.', correct: true, why: 'Only the three values inside the window count. The 7 before them has already left.' },
        { text: '7: the highest seen so far.', correct: false, why: 'That is the highest of everything, not of the last three. Tick 2’s 7 has left the window.' },
        { text: '1: the newest value.', correct: false, why: 'The screen shows the highest of the window, not the latest tick.' } ] },
      cards: [
        { step: 1, title: 'All seven windows', html: '<p>9 ticks give 7 windows of 3. Their highest values: <b>7, 7, 7, 6, 9, 9, 9</b>. The program must reach exactly this.[[src:prob]]</p>' },
        { step: 2, title: 'Values leave', html: '<p>The 7 stops counting once its tick leaves the window. That departure is what makes the problem hard.[[src:model]]</p>' }
      ],
      narration: [
        'Try a small case first. The window of ticks 3, 4 and 5 holds 2, 6 and 1. What does the screen show for it? Choose an answer.',
        '6. Only the three values inside the window count. Over all 9 ticks there are 7 windows, and their highest values are 7, 7, 7, 6, 9, 9, 9. The program must reach exactly this.',
        'Notice that the 7 from tick 2 stops counting once its tick leaves the window. Values leaving is what makes this problem hard.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['index'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Start with the ticks, the window size and the limit',
      stand: 'A program is written top to bottom. The first thing it needs is the data.',
      question: { step: 0, prompt: 'How should the program hold the ticks?', options: [
        { text: 'One list, in arrival order.', correct: true, why: 'Then a tick’s place in the list is its number, and the last W places are the window.' },
        { text: 'One list, sorted from smallest to largest.', correct: false, why: 'Sorting loses the arrival order, and with it which ticks are in the window.' },
        { text: 'Only the highest value so far.', correct: false, why: 'Then nothing is known once that value leaves the window.' } ] },
      code: P.build({ add: [DATA, SIZES], step: 1, label: 'programs/ch03.py · the data' }),
      cards: [ { step: 2, title: 'Index', html: '<p>A tick’s position in the list, from 0, is its <b>index</b>. <code>W</code> = 3, <code>L</code> = 6, and there are <code>NWIN</code> = 7 windows.[[src:whole]]</p>' } ],
      narration: [
        'First, the data. How should the program hold the ticks? Choose an answer.',
        'One list, in arrival order. Here are the first lines of the real program: the 9 ticks, a window of 3, and the spread limit of 6. The comments say why these numbers rise and fall.',
        'A tick’s position in the list, counting from 0, is called its index. There are 9 ticks, so 7 windows of 3.'
      ]
    },

    /* ---------- 4 · the obvious answer ---------- */
    {
      title: 'Scan', layout: 'code', defines: ['function', 'scan'],
      eyebrow: '04 · Writing the program · the answer everyone gives first',
      heading: 'Read the whole window, every tick',
      stand: 'Each piece below is a function: a named recipe that takes inputs and gives back an answer.',
      question: { step: 0, prompt: 'Re-reading each window of 3 in full, how many reads does the screen need for all 7 windows?', options: [
        { text: '21: 7 windows of 3 reads each.', correct: true, why: 'Every window is read in full, and the windows overlap, so most values are read three times.' },
        { text: '9: each tick is read once.', correct: false, why: 'That is the goal, not this method. Re-reading reads most ticks three times.' },
        { text: '7: one read per window.', correct: false, why: 'One read cannot find the highest of three. Each window needs all three.' } ] },
      code: P.build({ before: [DATA, SIZES], add: [BRUTE], step: 1 }),
      cards: [ { step: 2, title: 'A scan', html: '<p>Reading every value of the window is a <b>scan</b>: 21 reads here. At a window of 100,000 and millions of ticks, a trillion reads by lunchtime.[[src:trace]]</p>' } ],
      narration: [
        'The answer everyone gives first: for each window, read all of it. Each piece of the program is a function, a named recipe. How many reads for all 7 windows? Choose an answer.',
        '21: seven windows of three reads each. Here is brute max: it starts with the window’s first value and reads the rest, keeping the larger.',
        'Reading every value like this is called a scan. Here it is 21 reads. With a window of 100,000 and millions of ticks a day, it is a trillion reads by lunchtime.'
      ]
    },

    /* ---------- 5 · the key idea: eviction ---------- */
    {
      title: 'Evict', layout: 'code', defines: ['evict'],
      eyebrow: '05 · Writing the program · the one argument',
      heading: 'Keep only the values that could still be the highest',
      stand: 'A heap would give the highest in one step, but cannot remove the value leaving the window. So store less: only the candidates.',
      question: { step: 0, prompt: 'The candidates are 5 (tick 0) and 3 (tick 1). Then 7 arrives. Which can be thrown away?', options: [
        { text: 'Both: 7 is larger, and it will stay longer.', correct: true, why: 'While 5 or 3 is in the window, 7 is too, and it is larger. Neither can ever be the highest again.' },
        { text: 'Only 3, the smallest.', correct: false, why: '5 is also smaller than 7, and leaves the window sooner. It can never win either.' },
        { text: 'Neither: they are still inside the window.', correct: false, why: 'Inside, yes, but beaten for as long as they stay. Keeping them only costs time.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE], add: [EVICT], step: 1 }),
      cards: [ { step: 2, title: 'Provably dead', html: '<p>The newcomer is both bigger <b>and</b> newer, so anything at the back no larger than it is removed for good: to <b>evict</b> it. Not unlikely to matter: provably dead.[[src:model]]</p>' } ],
      narration: [
        'Here is the idea. Store only values that could still become the highest. The candidates are 5 and 3, and then 7 arrives. Which can be thrown away? Choose an answer.',
        'Both. The newcomer is bigger and newer: as long as 5 or 3 is in the window, 7 is too, and it is larger. Here is evict smaller: while the value at the back is no larger than the newcomer, pop it, and count.',
        'Removing such a value for good is called evicting it. It is not unlikely to matter; it is provably dead. The comment in the code says exactly that.'
      ]
    },

    /* ---------- 6 · the front expires ---------- */
    {
      title: 'Old', layout: 'code', defines: ['deque', 'expire'],
      eyebrow: '06 · Writing the program · the value leaving the window',
      heading: 'The oldest candidate must leave when its tick does',
      stand: 'The candidates sit in a list we add to at the back and remove from at both ends. The oldest is at the front.',
      question: { step: 0, prompt: 'The window moves by one tick. How many candidates can leave from the front at once?', options: [
        { text: 'At most one, so a single check is enough.', correct: true, why: 'Only one tick leaves the window per step, so at most one candidate can be too old.' },
        { text: 'Any number, so it must loop until none is old.', correct: false, why: 'A loop gives the same answer, but hides why each tick costs so little: only one tick leaves.' },
        { text: 'None: old candidates are evicted anyway.', correct: false, why: 'Not always. A large old value is never beaten, so it must be removed by age.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT], add: [EXPIRE], step: 1 }),
      cards: [ { step: 2, title: 'Deque, and expire', html: '<p>A list used from both ends is a <b>deque</b>. Removing the front because its index has left the window is to <b>expire</b> it: an <code>if</code>, not a loop.[[src:model]]</p>' } ],
      narration: [
        'Evicting works at the back. But the oldest candidate, at the front, must also leave when its tick leaves the window. How many can leave at once? Choose an answer.',
        'At most one, because the window moves by one tick. Here is expire: if the front’s index is too old, pop it from the front, and report one. It is an if, not a loop.',
        'A list used from both ends like this is called a deque. Removing the front because it has left the window is called expiring it.'
      ]
    },

    /* ---------- 7 · one pass ---------- */
    {
      title: 'Slide', layout: 'code',
      eyebrow: '07 · Writing the program · one pass over the ticks',
      heading: 'Evict, add, expire, and read the front',
      stand: 'The deque is kept decreasing, so its front is always the highest candidate.',
      question: { step: 0, prompt: 'Why does the deque hold each tick’s index, rather than its value?', options: [
        { text: 'Only an index says whether it has left the window.', correct: true, why: 'Expiring compares the front’s index with the current tick. A bare value cannot say how old it is.' },
        { text: 'Indexes are smaller numbers than values.', correct: false, why: 'Size is not the point. The age of an entry is what matters, and only the index carries it.' },
        { text: 'Values may repeat, and indexes cannot.', correct: false, why: 'True, but not the reason. Even with all values different, a value cannot say when it arrived.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT, EXPIRE], add: [SLIDE], step: 1 }),
      cards: [ { step: 2, title: 'The warm-up', html: '<p>The first 2 ticks push and expire but emit nothing: the window is not yet full. Skipping that is the standard off-by-one.[[src:trace]]</p>' } ],
      narration: [
        'Now one pass over all ticks. The deque is kept decreasing, so its front is the highest. Why does it hold indexes rather than values? Choose an answer.',
        'Only an index says whether an entry has left the window. Here is slide max: for each tick, evict smaller values from the back, add this index, expire the front if too old, and once the window is full, read the front.',
        'Notice the warm-up. The first two ticks still push and expire, but emit nothing, because the window is not full yet. Forgetting that is the standard off-by-one mistake.'
      ]
    },

    /* ---------- 8 · watch the deque ---------- */
    {
      title: 'Watch', layout: 'array',
      eyebrow: '08 · Watch the deque, tick by tick',
      heading: 'Each index is added once and removed at most once',
      stand: 'For each tick: its value, what the deque holds afterwards (index:value), how many were evicted, and what the screen shows.',
      array: {
        labelWidth: 160, slotLabel: 'tick',
        rows: [
          { label: 'value', values: TICKS },
          { label: 'deque after', values: replay.states },
          { label: 'evicted', values: replay.evicted },
          { label: 'screen shows', values: replay.shown }
        ],
        meters: ['ticks done', 'evictions so far'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'pick', slots: [2, 5] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 400 },
          { step: 3, do: 'show', rows: [3] }
        ]
      },
      cards: [
        { step: 1, title: 'Two moments', html: '<p>Tick 2: the 7 evicts 2 entries at once. Tick 5: index 2 has left the window and expires from the front.[[src:trace]]</p>' },
        { step: 2, title: '16 steps, not 21 reads', html: '<p>9 additions + 6 evictions + 1 expiry = <b>16 steps</b>, and the most there could ever be is 18: each index goes in once, out at most once.[[src:trace]]</p>' }
      ],
      narration: [
        'Here is the deque after each tick, written as index and value. Notice it is always decreasing from front to back.',
        'Look at tick 2: the 7 evicts both earlier entries at once. And at tick 5, index 2 has left the window, so it expires from the front, and 6 becomes the highest.',
        'Now count the evictions as the pointer walks: 6 in all. With 9 additions and 1 expiry, that is 16 steps, against the scan’s 21 reads. Each index goes in once and out at most once, so it can never exceed 18.',
        'The bottom row is what the screen shows: nothing during the warm-up, then 7, 7, 7, 6, 9, 9, 9. The same as the scan, and the cost does not depend on the window size.'
      ]
    },

    /* ---------- 9 · the spread ---------- */
    {
      title: 'Range', layout: 'code', defines: ['spread'],
      eyebrow: '09 · Writing the program · highest minus lowest',
      heading: 'The same machine, with every comparison reversed',
      stand: 'The screen must also warn when the window’s highest minus its lowest is more than 6.',
      question: { step: 0, prompt: 'How can the program keep the lowest of the window too?', options: [
        { text: 'A second deque, kept increasing.', correct: true, why: 'Reverse every comparison and the front is the lowest. Both deques move forward together.' },
        { text: 'Scan each window for its lowest.', correct: false, why: 'That brings back the re-reading the problem forbids.' },
        { text: 'Read the back of the first deque.', correct: false, why: 'The back is the newest candidate for highest, not the lowest value in the window.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT, EXPIRE, SLIDE], add: [EVICT_LO, SPREAD], step: 1 }),
      cards: [ { step: 2, title: 'Spreads', html: '<p>The <b>spread</b> is front of the high deque minus front of the low: 4, 5, 5, 5, 8, 8, 5. <b>2</b> windows are over 6, and 5 are not.[[src:trace]]</p>' } ],
      narration: [
        'Now the warning: highest minus lowest, more than 6. How can the program keep the lowest of the window too? Choose an answer.',
        'A second deque, kept increasing. Here is evict larger, the mirror image, and slide spread, which moves both deques together and subtracts their fronts. The comment warns that one comparison left unreversed gives plausible wrong numbers.',
        'Highest minus lowest is called the spread. Here it is 4, 5, 5, 5, 8, 8, 5: two windows over 6, and five not. The trick works for highest and lowest only; a middle value has no such shortcut.'
      ]
    },

    /* ---------- 10 · why this is in the watermark chapter ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['event time', 'processing time', 'watermark', 'late'],
      eyebrow: '10 · Your turn · why this is in a chapter about watermarks',
      heading: 'A pipeline’s clock is a running maximum, too',
      stand: 'Events from phones carry two times: when each happened (its event time) and when it was seen (its processing time). A pipeline estimates “everything before this has arrived” as the latest event time seen, minus 60 s: its watermark.',
      question: { step: 0, prompt: 'One event arrives stamped far in the future, a corrupt time. What happens to a watermark built from the latest time ever seen?', options: [
        { text: 'It jumps ahead and never comes back down.', correct: true, why: 'A maximum over everything never forgets its largest value, so the corrupt time stays in charge for good.' },
        { text: 'It jumps ahead, then returns as normal events arrive.', correct: false, why: 'Normal events are all smaller than the corrupt one, so the maximum never moves back down.' },
        { text: 'Nothing: one event cannot move it much.', correct: false, why: 'One event is enough, because only the largest time seen matters.' } ] },
      cards: [
        { step: 1, title: 'Late', html: '<p>An event whose event time is below the watermark when it arrives is called <b>late</b>. After the corrupt time, every event looks late.[[src:whole]]</p>' },
        { step: 2, title: 'Bound it', html: '<p>Take the maximum of only the last 3 event times. That is exactly the sliding maximum just built.[[src:whole]]</p>' }
      ],
      narration: [
        'Why is this in a chapter on watermarks? Events from phones carry two times: when each happened, its event time, and when it was seen, its processing time. The watermark is the latest event time seen, minus 60 seconds.',
        'Now one event arrives stamped far in the future, by mistake. A maximum over everything never forgets its largest value, so the watermark jumps ahead and never comes back. An event whose time is below the watermark is called late, and now every event is.',
        'The fix: take the maximum of only the last 3 event times, so the corrupt value leaves after 3 events. That is exactly the sliding maximum we just built.'
      ]
    },

    /* ---------- 11 · the unbounded watermark ---------- */
    {
      title: 'Clock', layout: 'code',
      eyebrow: '11 · Writing the program · the usual watermark',
      heading: 'The latest event time ever seen, minus 60',
      stand: 'The event times are seconds past 12:00, in the order they were seen. One corrupt time, 999,999, will be slipped in at position 4.',
      question: { step: 0, prompt: 'Should an event be judged against the watermark from before it, or after it?', options: [
        { text: 'Before it: the event cannot vouch for itself.', correct: true, why: 'The watermark after includes this event’s own time, so an event could never look late.' },
        { text: 'After it: that is the most up to date.', correct: false, why: 'Then the event has already moved the watermark, and would be judged against itself.' },
        { text: 'Either: the answer is the same.', correct: false, why: 'Not for an event that raises the maximum. It would pass a test it should be put through.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT, EXPIRE, SLIDE, EVICT_LO, SPREAD], add: [WMDATA, UNB], step: 1 }),
      cards: [ { step: 2, title: 'Monotonic, so permanent', html: '<p>A running maximum never goes down, which everyone wants, and is exactly why 999,999 stays in it for good.[[src:whole]]</p>' } ],
      narration: [
        'The event times are seconds past 12:00, in the order seen. One corrupt time, 999,999, will be slipped in. Should an event be judged against the watermark from before it or after it? Choose an answer.',
        'Before it. Here are the data and watermark unbounded: it records the watermark seen before each event, flags the event late if its time is below that, and only then folds the event into the running maximum.',
        'A running maximum only goes up. Everyone wants that, and it is exactly why one corrupt value stays in charge forever.'
      ]
    },

    /* ---------- 12 · the bounded watermark ---------- */
    {
      title: 'Bound', layout: 'code',
      eyebrow: '12 · Writing the program · the bounded watermark',
      heading: 'The highest of the last 3 event times, minus 60',
      stand: 'The same deque as before, now over event times. The corrupt value is evicted by position after 3 events.',
      question: { step: 0, prompt: 'Bounding the maximum lets it recover. What does that cost?', options: [
        { text: 'The watermark can now go backwards.', correct: true, why: 'When a big value leaves the window, the maximum of the rest can be smaller.' },
        { text: 'Nothing: it is better in every way.', correct: false, why: 'A watermark that goes back can re-open windows already closed. That is a real cost.' },
        { text: 'It no longer catches any late event.', correct: false, why: 'It still catches the genuinely late one; the program asserts that.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT, EXPIRE, SLIDE, EVICT_LO, SPREAD, WMDATA, UNB], add: [BND], step: 1 }),
      cards: [ { step: 2, title: 'The price, in the comment', html: '<p>“This watermark can go BACKWARDS.” The program asserts it does, so the cost cannot be forgotten.[[src:whole]]</p>' } ],
      narration: [
        'Now the bounded watermark: the highest of the last 3 event times, minus 60. Bounding lets it recover from the corrupt value. What does that cost? Choose an answer.',
        'It can go backwards. Here is watermark bounded: the same evict and expire as before, over event times. When the big value expires, the highest of the rest is smaller.',
        'The comment states the price, and the program asserts it happens, so nobody can forget it.'
      ]
    },

    /* ---------- 13 · the checks ---------- */
    {
      title: 'Tests', layout: 'code',
      eyebrow: '13 · Writing the program · proving every answer',
      heading: 'Run everything, print it, and assert it',
      stand: 'The last function runs both halves, checks them against the slow answers, and tries 600 random inputs.',
      question: { step: 0, prompt: 'Why compare the deque against the slow scan, if the deque is the better method?', options: [
        { text: 'The scan is obviously right, so it can check the clever one.', correct: true, why: 'A slow answer that is easy to trust is the best judge of a fast one that is easy to get subtly wrong.' },
        { text: 'To measure which one runs faster.', correct: false, why: 'Speed is counted separately. The comparison checks the answers, not the time.' },
        { text: 'It is left over from writing the program.', correct: false, why: 'It is deliberate, and it runs on 600 random inputs as well as the example.' } ] },
      code: P.build({ before: [DATA, SIZES, BRUTE, EVICT, EXPIRE, SLIDE, EVICT_LO, SPREAD, WMDATA, UNB, BND], add: [MAIN], step: 1 }),
      cards: [ { step: 2, title: 'What it asserts', html: '<p>Deque equals scan; 16 steps against 21; spreads 2 over 6; the unbounded watermark falsely calls 10 events late, the bounded one 3; the bounded one goes backwards.[[src:whole]]</p>' } ],
      narration: [
        'The last piece runs everything and checks it. Why compare the deque against the slow scan, if the deque is better? Choose an answer.',
        'Because the scan is obviously right, so it is the best judge of the clever method. Here is main: it prints each answer with its cost, asserts it, and repeats the checks on 600 random inputs.',
        'It also feeds the corrupt time to both watermarks. The unbounded one falsely calls 10 events late, the bounded one 3, and it asserts that the bounded one really goes backwards.'
      ]
    },

    /* ---------- 14 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '14 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks; the three functions near the end are parts 5, 6 and 7.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. You have seen each piece being written, and why.',
        'Three functions near the end, the shortest spike, the next warmer day and the longest steady stretch, are the same idea in disguise. Parts 5, 6 and 7 build each one.'
      ]
    },

    /* ---------- 15 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '15 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch03.py prints'),
      narration: [
        'Here is what the program prints. The scan and the deque agree on 7, 7, 7, 6, 9, 9, 9, in 21 reads against 16 steps. The spreads have 2 windows over 6.',
        'With the corrupt time, the unbounded watermark stays at 999,939 to the end and falsely calls 10 events late. The bounded one recovers to 780 and makes 3 false calls. All assertions passed.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you built',
      heading: 'A deque of candidates, one pass, and a watermark that recovers',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>brute_max</code>', 'reads the whole window', '21 reads'] },
          { step: 0, cells: ['<code>evict_smaller</code> · <code>expire</code>', 'drop beaten values at the back; drop the old one at the front', '6 evictions, 1 expiry'] },
          { step: 1, cells: ['<code>slide_max</code>', 'one pass; the front is the answer', '16 steps'] },
          { step: 1, cells: ['<code>slide_spread</code>', 'two deques, one decreasing, one increasing', '2 of 7 over 6'] },
          { step: 2, cells: ['<code>watermark_unbounded</code>', 'latest time ever, minus 60: one corrupt value is permanent', '10 false lates'] },
          { step: 2, cells: ['<code>watermark_bounded</code>', 'highest of the last 3, minus 60: recovers, but can go back', '3 false lates'] }
        ]
      },
      side: { step: 3, title: 'Next', html: '<p>The same eviction argument answers three more interview questions in disguise: a load test, the weather, and a factory. Each gets its own part.[[src:ch]]</p>' },
      narration: [
        'To recap. Brute max reads the whole window: 21 reads. Evict smaller drops beaten values from the back, and expire drops the old one from the front.',
        'Slide max does it all in one pass, 16 steps, and the front is always the answer. Slide spread runs two deques, one decreasing and one increasing, and finds 2 windows over 6.',
        'The unbounded watermark lets one corrupt time poison every later event: 10 false lates. The bounded one, the highest of the last 3, recovers with 3, at the price of going backwards.',
        'Next, the same eviction argument answers three more interview questions in disguise: a load test, the weather, and a factory. Each gets its own part.'
      ]
    }
  ]
};
