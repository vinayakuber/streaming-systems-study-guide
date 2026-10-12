// Chapter 3, Part 2 — "Heuristic watermarks and skew", for a viewer who has read nothing
// before it. The phones, the two clocks and the watermark are re-introduced from zero; then
// the one guess in the formula, the skew, is swept, and its exact threshold is found on
// screen. Every time and value comes from the one seed (tools/stream_seed.js), and the
// sweep is recomputed here and checked against the chapter's numbers.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch03';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => (s < 0 ? 'before 12:00' : `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`);
const MAXSEEN = E.map((_, i) => Math.max(...E.slice(0, i + 1).map(e => e.et)));
const W0 = 0, W0_END = seed.WIN;
const sweep = lag => {
  const wm = MAXSEEN.map(m => m - lag);
  const closes = w => { const i = wm.findIndex(x => x >= w + seed.WIN); return i === -1 ? null : i; };
  const ci = closes(W0);
  const value = seed.SUM(E.filter((e, i) => i <= ci && seed.winOf(e.et) === W0).map(e => e.id));
  const late = E.filter((e, i) => { const c = closes(seed.winOf(e.et)); return c !== null && c < i; }).map(e => e.id);
  return { lag, wm, ci, at: clock(E[ci].pt), value, late };
};
const SW = [0, 60, 120, 180, 141].map(sweep);
const S140 = sweep(140);
const LI = E.findIndex(e => e.id === 7);
const THRESH = MAXSEEN[LI - 1] - W0_END + 1;
const PER = E.map((_, i) => Object.fromEntries(seed.KEYS.map(k => {
  const seen = E.filter((e, j) => j <= i && e.key === k);
  return [k, seen.length ? Math.max(...seen.map(e => e.et)) - seed.LAG : null];
})));
const STAGE = PER.map(p => (p.a === null || p.b === null ? null : Math.min(p.a, p.b)));
const show = v => (v === null ? 'none yet' : clock(v));

if (SW.map(s => `${s.lag}:${s.at}:${s.value}:${s.late.join('+')}`).join() !== '0:12:02:12:15:6+7,60:12:04:06:15:7,120:12:04:06:15:7,180:12:09:02:19:,141:12:09:02:19:'
  || S140.value !== 15 || THRESH !== 141 || E[LI].pt - E[LI].et !== 230 || E[8].pt - E[4].pt !== 296
  || PER[8].a !== 480 || PER[8].b !== 200 || STAGE[8] !== 200 || seed.SUM(seed.WINDOWS[120]) !== 11 || seed.SUM(seed.WINDOWS[240]) !== 7)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Tuning the Skew',
  eyebrow: 'Streaming · Ch 3 · Part 2',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'delay', 'watermark', 'skew',
    'heuristic', 'trigger', 'late', 'threshold', 'per-source', 'idleness timeout'],
  sources: {
    ch:    chapter(CH, 'Chapter 3 on GitHub'),
    flow:  section(CH, 'Heuristic watermarks and skew', 'Chapter 3 · heuristic watermarks and skew'),
    why:   section(CH, 'Why the skew bound is the only judgement in the formula — and what each value buys', 'Chapter 3 · the skew bound'),
    when:  section(CH, 'When to tune skew up, when to track per source, and what neither fixes', 'Chapter 3 · when to tune it'),
    walk:  section(CH, 'Visual walkthrough — the formula, the sweep, and the threshold', 'Chapter 3 · the walkthrough'),
    prog:  section(CH, 'Sweeping the skew bound — stack and heap at every step', 'Chapter 3 · the sweep as a program'),
    est:   section(CH, 'Why a watermark is an estimate, and what a correct one would cost', 'Chapter 3 · why a watermark is an estimate')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 3 · Part 2',
      heading: 'One number in the formula is a guess. What happens when you change it?',
      hero: { step: 0, text: 'An app on two phones, <b>a</b> and <b>b</b>, sends a message each time something happens. Each message is an <b>event</b> carrying a small value. The messages never stop: a <b>stream</b>. The <b>pipeline</b>, the program receiving them, adds the values up per 2-minute <b>window</b> of time.[[src:flow]]' },
      tiles: [
        { step: 1, value: 60, suffix: ' s', label: 'the guess the chapter started with[[src:why]]' },
        { step: 1, value: 15, label: 'what the first window announced, of a true 19[[src:why]]' },
        { step: 2, value: THRESH, suffix: ' s', label: 'the exact guess at which 15 becomes 19[[src:why]]' },
        { step: 2, value: 296, suffix: ' s', label: 'how much later the right answer arrives[[src:why]]' }
      ],
      cardsLabel: 'What this part does',
      cards: [
        { step: 3, n: 1, title: 'Find the guess', text: 'In a formula that is otherwise exact.' },
        { step: 3, n: 2, title: 'Change it, and watch', text: 'Which events get left out, and when the total goes out.' },
        { step: 4, n: 3, title: 'Find the exact turning point', text: 'And why it is not the number you would reach for.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'An app on two phones, a and b, sends a message each time something happens. Each message is an event, carrying a small value. The events never stop: a stream. The program receiving them is the pipeline.',
        'The pipeline adds up values per 2-minute slice of time, called a window. The chapter started with a guess of 60 seconds, and the first window announced 15, when the true total was 19.',
        'In this part we change that guess. At exactly 141 seconds, 15 becomes 19. The price: the right answer arrives 296 seconds later.',
        'We will find the one guess in an otherwise exact formula, change it, and watch which events get left out and when each total goes out.',
        'Then we find the exact turning point, and see why it is not the number most people reach for. You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'delay'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened, when it was seen, and the gap between',
      stand: 'In the order the pipeline received them. The last column is how far behind each one arrived.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Delay', 'Value'],
        rows: E.map((e, i) => ({ step: i < 5 ? 0 : 1,
          cells: [`id ${e.id}`, e.key, clock(e.et), clock(e.pt), i === LI ? `<b>${e.pt - e.et} s</b>` : `${e.pt - e.et} s`, `${e.v}`] }))
      },
      side: { step: 2, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when it happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Delay</b> — the gap: seen minus happened. Eight events arrive within 50 s; id 7 took 230 s.[[src:ch]]</li></ul>' },
      narration: [
        'Every event carries two times. When it happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. The gap between them is its delay.',
        'Most delays are a few seconds. Id 6 took 50 seconds. And id 7 happened at 12:00:50 but was seen at 12:04:40: a delay of 230 seconds. Its phone was offline.',
        'So eight of the nine events arrive within 50 seconds, and one takes 230. No pipeline can know in advance which kind the next event will be.'
      ]
    },

    /* ---------- 3 · question: the guess in the formula ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['watermark', 'skew', 'heuristic'],
      eyebrow: '03 · Your turn',
      heading: 'The pipeline’s estimate of “everything before this has arrived”',
      stand: 'That estimate is called the watermark. The usual formula: the latest event time seen so far, minus a fixed margin called the skew.',
      question: {
        step: 0,
        prompt: 'In “latest event time seen, minus the skew”, which part is a human’s guess?',
        options: [
          { text: 'The skew: someone chose 60 seconds.', correct: true,
            why: 'Nothing in the data says how far behind a straggler can be. A person picked the number.' },
          { text: 'The latest event time seen so far.', correct: false,
            why: 'That is measured exactly: it is just the largest event time the pipeline has received.' },
          { text: 'Both parts are guesses.', correct: false,
            why: 'Only one is. The latest time seen is a plain fact about what arrived; the margin is a choice.' }
        ]
      },
      cards: [
        { step: 1, title: 'One measured value, one guess', html: '<p>The latest time seen is free and exact. The <b>skew</b> is a bound on how out of order events can be, chosen by a person: the only judgement in the formula.[[src:why]]</p>' },
        { step: 2, title: 'A heuristic', html: '<p>A rule of thumb is a <b>heuristic</b>. This <b>watermark</b>, the pipeline’s claim that everything before it has arrived, is a heuristic watermark.[[src:flow]]</p>' }
      ],
      narration: [
        'The pipeline keeps an estimate of “everything before this event time has arrived”. It is called the watermark: the latest event time seen, minus a margin called the skew. Which part is a guess? Choose an answer.',
        'The skew. The latest time seen is measured exactly. The skew is a bound on how out of order events can be, and someone chose it. It is the only judgement in the whole formula.',
        'A rule of thumb like this is called a heuristic, so this is a heuristic watermark. Let us see what it does at two different skews.'
      ]
    },

    /* ---------- 4 · two skews, animated ---------- */
    {
      title: 'Two', layout: 'array', defines: ['trigger', 'late'],
      eyebrow: '04 · Watch the watermark at two skews',
      heading: 'Same events, two guesses, two moments of closing',
      stand: 'Slots are the events in arrival order. The first window, 12:00 to 12:02, closes when the watermark reaches 12:02.',
      array: {
        labelWidth: 160, slotLabel: 'event id',
        rows: [
          { label: 'latest so far', values: MAXSEEN.map(clock) },
          { label: 'skew 0 s', values: SW[0].wm.map(clock) },
          { label: 'skew 60 s', values: SW[1].wm.map(clock) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'pick', rows: [1], slots: [SW[0].ci] },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', rows: [2], slots: [SW[1].ci] }
        ]
      },
      cards: [
        { step: 1, title: 'Skew 0 s', html: '<p>The watermark reaches 12:02 at id 3: the window closes at 12:02:12. The rule that closes it is the <b>trigger</b>.[[src:why]]</p>' },
        { step: 2, title: 'Skew 60 s', html: '<p>It reaches 12:02 only at id 4: the window closes at 12:04:06, and announces 15.[[src:why]]</p>' },
        { step: 3, title: 'Late', html: '<p>An event whose window has already closed when it arrives is <b>late</b>. Id 7 is late under both.[[src:why]]</p>' }
      ],
      narration: [
        'Top row: the latest event time seen after each event. The watermark is this, minus the skew. Watch two skews.',
        'With a skew of 0, the watermark is the latest time itself. It reaches 12:02 at id 3, so the first window closes at 12:02:12. The rule that closes a window when the watermark passes its end is called the trigger.',
        'With a skew of 60 seconds, the watermark is a minute behind. It reaches 12:02 only at id 4, so the window closes at 12:04:06 and announces 15.',
        'An event whose window has already closed when it arrives is called late. Id 7 arrives at 12:04:40, after both closings, so it is late under both skews.'
      ]
    },

    /* ---------- 5 · question: how many are late at skew 0 ---------- */
    {
      title: 'Q2', layout: 'ask',
      eyebrow: '05 · Your turn',
      heading: 'Skew 0: which events does the pipeline call late?',
      stand: 'With skew 0 the watermark is the latest event time itself. Window 12:02 to 12:04 then closes when id 4 (12:04:05) arrives.',
      question: {
        step: 0,
        prompt: 'With a skew of 0, which events arrive after their own window has closed?',
        options: [
          { text: 'Only id 7, the one that was 230 s behind.', correct: false,
            why: 'Id 7 is one of them. But id 6 belongs to window 12:02 to 12:04, which closed at id 4, before id 6 arrived.' },
          { text: 'Id 6 and id 7: both land in windows already closed.', correct: true,
            why: 'Id 6 (12:03:40) arrives after id 4 closed its window; id 7 (12:00:50) after id 3 closed its window.' },
          { text: 'None of them: a skew of 0 waits for nothing.', correct: false,
            why: 'Waiting for nothing is exactly why windows close early, and why more events end up late.' }
        ]
      },
      cards: [
        { step: 1, title: 'Late is a verdict', html: '<p>At skew 0, 2 events are late; at 141 s, 0 are. The data did not change. <b>Late</b> is a verdict the watermark passes, not a property of an event.[[src:why]]</p>' },
        { step: 2, title: 'Too fast creates lateness', html: '<p>An over-eager watermark does not detect late events; it <b>creates</b> them. Id 6 was only 50 s behind.[[src:walk]]</p>' }
      ],
      narration: [
        'With a skew of 0, the second window, 12:02 to 12:04, closes as soon as id 4 arrives. Which events arrive after their own window has closed? Choose an answer.',
        'Id 6 and id 7. Id 6 happened at 12:03:40 but arrives after id 4 closed its window. So at skew 0, two events are late; at a large enough skew, none are. The events did not change.',
        'So late is a verdict the watermark passes, not a property of an event. A watermark that moves too fast does not detect lateness; it creates it.'
      ]
    },

    /* ---------- 6 · the sweep ---------- */
    {
      title: 'Sweep', layout: 'table',
      eyebrow: '06 · The skew, swept',
      heading: 'Same nine events, four guesses',
      stand: 'For the first window, 12:00 to 12:02, whose true total is 19.',
      table: {
        columns: ['Skew', 'Window closes at', 'Announces', 'Events called late'],
        rows: SW.slice(0, 4).map((s, i) => ({ step: i < 2 ? 0 : i < 3 ? 1 : 2,
          cells: [`<b>${s.lag} s</b>`, s.at, s.value === 19 ? `<b>${s.value}</b>` : `${s.value}`,
            s.late.length ? `${s.late.length}: ${s.late.map(id => 'id ' + id).join(', ')}` : '0'].map((c, j) => (j === 3 ? c + '[[src:why]]' : c)) }))
      },
      side: { step: 3, title: 'Read the last column down', html: '<p>2, 1, 1, 0. Identical events, identical arrival times. Only the configured guess grew.[[src:walk]]</p><p>And somewhere between 120 s and 180 s, the 15 turns into 19.</p>' },
      narration: [
        'Here is the sweep. At skew 0, the window closes at 12:02:12 and announces 15, with ids 6 and 7 late. At 60 seconds, it closes at 12:04:06, still 15, and only id 7 is late.',
        'At 120 seconds, nothing changes: still 12:04:06, still 15, still id 7 late.',
        'At 180 seconds, the window waits until 12:09:02, and announces 19, the true total. No event is late.',
        'Read the last column down: 2, 1, 1, 0, from identical data. And somewhere between 120 and 180 seconds, 15 turns into 19. Where exactly?'
      ]
    },

    /* ---------- 7 · question: guess the threshold ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['threshold'],
      eyebrow: '07 · Your turn',
      heading: 'The smallest skew that gets 19',
      stand: 'Id 7, the straggler, was 230 s behind. Before it arrives, the latest event time seen is 12:04:20, from id 5.',
      question: {
        step: 0,
        prompt: 'What is the smallest skew at which the first window announces 19?',
        options: [
          { text: '230 s, the straggler’s own delay.', correct: false,
            why: 'That works, but it is not the smallest. The watermark never has to reach back to 12:00:50.' },
          { text: '180 s, the first value in the sweep that worked.', correct: false,
            why: 'The sweep only tried steps of 60 s. Something smaller also works.' },
          { text: '141 s: just enough to stay below 12:02 until id 7.', correct: true,
            why: 'Before id 7 the latest time is 12:04:20. 12:04:20 minus 141 s is 12:01:59, still short of the window’s end.' }
        ]
      },
      cards: [
        { step: 1, title: 'The threshold', html: '<p>The exact value where the answer flips is the <b>threshold</b>: 12:04:20 − 12:02 + 1 = <b>141 s</b>.[[src:why]]</p>' },
        { step: 2, title: 'Not the delay', html: '<p>The watermark only has to stay below the window’s <b>end</b> until id 7 lands. Tuning to the worst delay, 230 s, holds every watermark 89 s further back than needed.[[src:why]]</p>' }
      ],
      narration: [
        'Id 7 was 230 seconds behind. Before it arrives, the latest event time is 12:04:20. What is the smallest skew at which the first window announces 19? Choose an answer.',
        '141 seconds. The watermark must still be below 12:02 when id 7 arrives. 12:04:20 minus 12:02 is 140 seconds, so the skew must be at least one more. That exact value is called the threshold.',
        'And it is not id 7’s delay of 230 seconds, the number most people reach for. Tuning to the worst delay would hold every watermark 89 seconds further back than this window needs.'
      ]
    },

    /* ---------- 8 · 140 against 141, animated ---------- */
    {
      title: 'Edge', layout: 'array',
      eyebrow: '08 · Watch one second make the difference',
      heading: 'Skew 140 closes the window before id 7. Skew 141 does not.',
      stand: 'For each event: has the watermark reached 12:02 yet? Id 7 arrives in slot 7.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'latest so far', values: MAXSEEN.map(clock) },
          { label: 'skew 140: reached?', values: S140.wm.map(w => (w >= W0_END ? 'yes' : 'no')) },
          { label: 'skew 141: reached?', values: SW[4].wm.map(w => (w >= W0_END ? 'yes' : 'no')) }
        ],
        meters: ['events checked', 'times it had reached 12:02'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'sweep', row: 2, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 3, do: 'pick', slots: [LI] }
        ]
      },
      cards: [
        { step: 1, title: 'Skew 140', html: '<p>12:04:20 − 140 s is exactly 12:02 at id 5, so the window closes then, before id 7. It announces 15.[[src:prog]]</p>' },
        { step: 2, title: 'Skew 141', html: '<p>One second more, and the watermark stays below 12:02 until id 8. Id 7 lands first, so the window announces 19.[[src:prog]]</p>' }
      ],
      narration: [
        'The top row is the latest event time seen after each event. Below it, for two skews, a yes or no: has the watermark reached 12:02, the end of the first window, yet?',
        'With a skew of 140, the watermark is exactly 12:02 at id 5. Watch the yeses start there: the window closes at id 5, before id 7 arrives, and announces 15.',
        'With a skew of 141, the watermark stops one second short of 12:02 until id 8. Only one yes, at the very end.',
        'Look at slot 7, where id 7 arrives. At 140, the window is already closed. At 141, it is still open, so id 7 is counted and the answer is 19. The threshold is a single comparison flipping.'
      ]
    },

    /* ---------- 9 · question: what does 19 cost ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'At 141 s the answer is right. What did that cost?',
      stand: 'Skew 60 closes the first window at 12:04:06. Skew 141 closes it at 12:09:02.',
      question: {
        step: 0,
        prompt: 'What does raising the skew from 60 s to 141 s cost?',
        options: [
          { text: 'Nothing: the answer is simply right.', correct: false,
            why: 'The window waited until 12:09:02 instead of 12:04:06. The right answer arrived much later.' },
          { text: '296 s more waiting, on this window only.', correct: true,
            why: 'The next two windows close at 12:09:02 under both skews, and the last one under neither. This window pays.' },
          { text: '296 s more waiting, on every window.', correct: false,
            why: 'Windows 12:02 to 12:04 and 12:04 to 12:06 close at 12:09:02 either way. The price lands on one window.' }
        ]
      },
      cards: [
        { step: 1, title: 'Latency for correctness', html: '<p>296 s of waiting buys 4 of the 19. That is the trade: a later answer, or a wrong one.[[src:when]]</p>' },
        { step: 2, title: 'And one window never closes', html: '<p>Window 12:08 to 12:10 closes under neither skew: no event ever lifts the watermark past 12:10.[[src:why]]</p>' }
      ],
      narration: [
        'At 141 seconds the answer is right. Skew 60 closed the first window at 12:04:06; skew 141 closes it at 12:09:02. What did that cost? Choose an answer.',
        '296 seconds more waiting, and only on this window. The next two windows close at 12:09:02 under both skews. So 296 seconds of waiting buys the missing 4 of the 19.',
        'And window 12:08 to 12:10 closes under neither: no event ever lifts the watermark past 12:10, so its total is never announced.'
      ]
    },

    /* ---------- 10 · question: which way to tune ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '10 · Your turn',
      heading: 'Two teams, two choices of skew',
      stand: 'A billing team checks its totals against invoices. An operations screen shows live load, and a computer adds servers when it climbs.',
      question: {
        step: 0,
        prompt: 'Which team should raise the skew, accepting later answers?',
        options: [
          { text: 'The billing team: a late total beats a wrong one.', correct: true,
            why: 'A bill reconciled against another system must be right. Waiting 296 s for 19 instead of 15 is the right trade.' },
          { text: 'The operations screen: it needs the fullest answers.', correct: false,
            why: 'A stale load reading is worse than a slightly short one. The screen wants a smaller skew and fast answers.' },
          { text: 'Neither: the skew should always be 60 s.', correct: false,
            why: 'The chapter’s 60 s was an assumption. The right value depends on what a wrong answer costs.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Tune up', html: '<p>When a late answer is cheaper than a wrong one: billing, compliance, anything checked against another system.[[src:when]]</p>' },
        { step: 2, title: 'Tune down', html: '<p>When a stale answer is worse than an incomplete one: a dashboard, an autoscaler. Then something downstream must absorb a correction.[[src:when]]</p>' }
      ],
      narration: [
        'A billing team checks its totals against invoices. An operations screen shows live load, and a computer adds servers when it climbs. Which team should raise the skew? Choose an answer.',
        'The billing team. Tune the skew up when a late answer is cheaper than a wrong one: billing, compliance, anything reconciled against another system.',
        'Tune it down when a stale answer is worse than an incomplete one, like a live dashboard. Then some events will be called late, and something downstream must accept a correction.'
      ]
    },

    /* ---------- 11 · question: two phones, one watermark ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['per-source'],
      eyebrow: '11 · Your turn',
      heading: 'Phone a is busy. Phone b has gone quiet.',
      stand: 'By the end, phone a’s latest event happened at 12:09:00. Phone b’s latest happened at 12:04:20. One watermark for both says 12:08:00.',
      question: {
        step: 0,
        prompt: 'How far can phone b actually vouch that everything has arrived?',
        options: [
          { text: 'Up to 12:08:00, like the shared watermark.', correct: false,
            why: 'That number comes from phone a’s events. Phone b has said nothing about anything after 12:04:20.' },
          { text: 'Up to 12:03:20: its own latest, minus the skew.', correct: true,
            why: 'Phone b’s own estimate is 12:04:20 minus 60 s. That is all it can back.' },
          { text: 'Up to 12:09:00, the latest event of all.', correct: false,
            why: 'Even phone a cannot claim that much: its own estimate subtracts the skew too.' }
        ]
      },
      cards: [
        { step: 1, title: 'Per source', html: '<p>Keep a watermark for each phone, and let the pipeline claim the <b>smallest</b>. Each input is a source, so this is <b>per-source</b> tracking.[[src:flow]]</p>' },
        { step: 2, title: '280 s of over-claiming', html: '<p>One shared watermark claims 12:08:00: 280 s more than phone b can back.[[src:when]]</p>' }
      ],
      narration: [
        'By the end, phone a’s latest event happened at 12:09:00, and phone b’s at 12:04:20. One shared watermark says 12:08:00. How far can phone b actually vouch? Choose an answer.',
        'Only up to 12:03:20: its own latest time, minus the skew. Keeping one watermark for each input, each source, and claiming the smallest is called per-source tracking.',
        'The shared watermark claims 12:08:00, which is 280 seconds more than phone b can back. The busy phone drags it forward.'
      ]
    },

    /* ---------- 12 · per-source, animated ---------- */
    {
      title: 'Each', layout: 'array',
      eyebrow: '12 · Watch one watermark per phone',
      heading: 'The pipeline may claim only the smaller of the two',
      stand: 'For each event: the shared watermark, each phone’s own, and the smaller of the two.',
      array: {
        labelWidth: 170, slotLabel: 'event id',
        rows: [
          { label: 'shared', values: seed.WATERMARKS.map(clock) },
          { label: 'phone a', values: PER.map(p => show(p.a)) },
          { label: 'phone b', values: PER.map(p => show(p.b)) },
          { label: 'smaller of a, b', values: STAGE.map(show) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1, 2] },
          { step: 2, do: 'show', rows: [3] },
          { step: 3, do: 'pick', slots: [8] }
        ]
      },
      cards: [
        { step: 2, title: 'Silence is not a yes', html: '<p>Until phone b has sent anything, the pipeline makes no claim at all: silence cannot be told apart from an old event still coming.[[src:flow]]</p>' },
        { step: 3, title: 'Two windows withheld', html: '<p>12:08:00 would close windows 12:02 to 12:04 and 12:04 to 12:06, holding 11 and 7. At 12:03:20 they stay open.[[src:when]]</p>' }
      ],
      narration: [
        'The top row is the single shared watermark from before: the latest time from either phone, minus 60 seconds.',
        'Now one watermark per phone: each phone’s own latest time, minus 60 seconds. Phone b has nothing until id 2, and stops at 12:03:20 after id 5.',
        'The bottom row is the smaller of the two, the only safe claim. Until phone b has sent anything, there is no claim at all: silence cannot be told apart from an old event still coming.',
        'Look at the last event. Shared says 12:08:00; the safe claim is 12:03:20. Windows 12:02 to 12:04 and 12:04 to 12:06, holding 11 and 7, are withheld because phone b went quiet.'
      ]
    },

    /* ---------- 13 · question: what neither fixes ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['idleness timeout'],
      eyebrow: '13 · Your turn · check yourself',
      heading: 'A run with no late events at all',
      stand: 'A pipeline reports zero late events for a whole day. The team concludes its skew is well tuned.',
      question: {
        step: 0,
        prompt: 'Does zero late events prove that the skew is well tuned?',
        options: [
          { text: 'Yes: no event arrived after its window closed.', correct: false,
            why: 'Or late events arrived and were quietly thrown away. From inside, the two look identical.' },
          { text: 'No: it looks the same as late events silently dropped.', correct: true,
            why: 'The output cannot tell a well-tuned skew from an over-eager one. The guess cannot be checked from inside.' },
          { text: 'Yes, if the skew was larger than every delay.', correct: false,
            why: 'Nobody knows every delay in advance. That is the very thing the skew is guessing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The guess cannot be verified', html: '<p>A run with zero late events is indistinguishable from one whose late events were discarded.[[src:when]]</p>' },
        { step: 2, title: 'A quiet phone, forever', html: '<p>If phone b never sends again, per-source tracking pins the claim at 12:03:20 forever, unless an <b>idleness timeout</b> declares it finished. That is a decision, not a measurement.[[src:when]]</p>' }
      ],
      narration: [
        'A pipeline reports zero late events for a whole day, and the team concludes its skew is well tuned. Does that follow? Choose an answer.',
        'No. Zero late events looks exactly like late events that were silently thrown away. The skew is a guess that cannot be checked from inside the pipeline.',
        'And per-source tracking has its own trap. If phone b never sends again, the claim stays at 12:03:20 forever, unless a rule called an idleness timeout declares the phone finished. That is a decision, not a measurement.'
      ]
    },

    /* ---------- 14 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '14 · What you now know',
      heading: 'One guess, a sweep, and one exact second',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Heuristic watermark</b>', 'Latest event time seen, minus the skew. The skew is the only guess.[[src:why]]'] },
          { step: 0, cells: ['<b>Late</b>', 'A verdict, not a property: 2 late events at skew 0, none at 141 s, from the same data.[[src:why]]'] },
          { step: 1, cells: ['<b>Threshold</b>', '141 s = 12:04:20 − 12:02 + 1. Not id 7’s 230 s delay. 140 s still announces 15.[[src:why]]'] },
          { step: 1, cells: ['<b>Its price</b>', '296 s of waiting for 4 of the 19, on this window only.[[src:why]]'] },
          { step: 2, cells: ['<b>Per-source</b>', 'Claim the smaller phone’s watermark: 12:03:20, not 12:08:00. Withholds 11 and 7.[[src:when]]'] },
          { step: 2, cells: ['<b>Not fixed by either</b>', 'The skew cannot be verified from inside; a quiet phone needs an idleness timeout.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 3', html: '<p>A stage reading from several inputs takes the smallest watermark. Part 3 shows why, what “closed” really means, and the safety net for the events that still arrive late.[[src:flow]]</p>' },
      narration: [
        'To recap. The heuristic watermark is the latest event time seen, minus the skew, and the skew is the only guess. Late is a verdict: two events at skew 0, none at 141 seconds, from the same data.',
        'The threshold is 141 seconds: 12:04:20 minus 12:02, plus one. Not id 7’s delay of 230 seconds. Its price is 296 seconds of waiting, on this window only.',
        'Per-source tracking claims the smaller phone’s watermark, 12:03:20 instead of 12:08:00, and withholds two windows. Neither fixes an unverifiable guess, or a phone that goes quiet for good.',
        'Next, part 3: why a stage with several inputs takes the smallest watermark, what closed really means, and the safety net for events that still arrive late.'
      ]
    }
  ]
};
