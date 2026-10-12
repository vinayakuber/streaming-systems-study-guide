// Chapter 10, Part 3 — "Batch and streaming converge": batch is streaming over an input that
// ends, so its watermark and trigger are trivial rather than absent; one pipeline serves both
// modes; reprocessing is a replay checked against an unaffected key; and the one thing that
// stays different is finality. Every word is introduced from zero, and every mechanism is
// animated on the seed's nine events (tools/stream_seed.js).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch10';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const TOTAL = E.reduce((a, e) => a + e.v, 0);
const BY_ET = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const WM = seed.WATERMARKS.map(w => (w < 0 ? 'before 12:00' : clock(w)));
const CLOSES = E.map((_, i) => seed.WIN_STARTS.filter(w => seed.closedAt(w) === i).map(hm).join(' and ') || '—');
const LAST = E.length - 1;
const B_WM = E.map((_, i) => (i === LAST ? 'everything' : 'not yet'));
const B_FINAL = E.map((_, i) => (i === LAST ? 'all 4' : '—'));
const buggy = e => (e.key === 'a' ? Math.floor(e.v / 2) : e.v);
const per = (f, k) => E.filter(e => e.key === k).reduce((s, e) => s + f(e), 0);
const BEFORE = [per(buggy, 'a'), per(buggy, 'b')], AFTER = [per(e => e.v, 'a'), per(e => e.v, 'b')];
const BUG_TOTAL = E.reduce((s, e) => s + buggy(e), 0);
const NEVER = seed.WIN_STARTS.filter(w => seed.closedAt(w) === null);

if (E.length !== 9 || TOTAL !== 45 || BY_ET.join() !== '19,11,7,8' || BEFORE.join() !== '11,21' || AFTER.join() !== '24,21'
  || BUG_TOTAL !== 32 || NEVER.join() !== '480' || seed.SUM(seed.WINDOWS[480]) !== 8 || seed.closedAt(0) !== 4
  || seed.closedAt(120) !== 8 || seed.closedAt(240) !== 8 || WM[8] !== '12:08:00' || seed.LAG !== 60 || seed.WIN !== 120)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Batch Is Bounded Streaming',
  eyebrow: 'Streaming · Ch 10 · Part 3',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, '“a”': 'A', '“b”': 'B' } },
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'fixed window', 'batch',
    'bounded', 'unbounded', 'watermark', 'trigger', 'final', 'Lambda architecture', 'codebase', 'log', 'offset',
    'replay', 'invariant', 'reprocessing', 'source of truth', 'retention'],
  sources: {
    ch:   chapter(CH, 'Chapter 10 on GitHub'),
    flow: section(CH, 'Batch and streaming converge', 'Chapter 10 · batch and streaming converge'),
    why:  section(CH, 'Why batch already has all four mechanisms, and what reprocessing becomes', 'Chapter 10 · all four mechanisms'),
    when: section(CH, 'When to replay, what to check, and what remains a batch-only property', 'Chapter 10 · when to replay'),
    walk: section(CH, 'Visual walkthrough — the trivial mechanisms, the single fix, the limit', 'Chapter 10 · the walkthrough'),
    prog: section(CH, 'The convergence — stack and heap at every step', 'Chapter 10 · the convergence as a program'),
    hist: section(CH, 'One grouping, two finality rules — stack and heap at every step', 'Chapter 10 · two finality rules'),
    lam:  section(CH, 'Lambda and Kappa', 'Chapter 10 · Lambda and Kappa')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 10 · Part 3',
      heading: 'One pipeline for yesterday’s file and for today’s live purchases',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a small message carrying its value. Each message is an <b>event</b>. Events keep coming with no end: a <b>stream</b>. A program that receives them and works out answers is a <b>pipeline</b>.[[src:flow]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: TOTAL, label: 'their value together[[src:why]]' },
        { step: 2, value: 3, label: 'of 4 streaming mechanisms that the old way has in a trivial form[[src:why]]' },
        { step: 2, value: 1, label: 'slice of time that one way closes and the other never does[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'Is a file just a short stream?', text: 'And what a file’s ending was quietly doing.' },
        { step: 3, n: 2, title: 'How is a mistake undone?', text: 'With one pipeline, and a check you can trust.' },
        { step: 4, n: 3, title: 'What can never be the same?', text: 'The one thing an endless input changes.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value. Each message is called an event, and events keep coming with no end: a stream.',
        'A program that receives the stream and works out answers is called a pipeline. Our example has 9 events, worth 45 together.',
        'You will see the old way of processing a file has 3 of the 4 mechanisms of streaming, in a trivial form. And 1 slice of time that one way closes, while the other never does.',
        'Three questions. Is a file just a short stream? And with one pipeline, how is a mistake undone, with a check you can trust?',
        'And what can never be made the same, however unified the two become? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'key'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Times are shown to the minute.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 7 ? `<b>${hm(e.et)}</b>` : hm(e.et), i === 7 ? `<b>${hm(e.pt)}</b>` : hm(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Three words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b.[[src:prog]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened and was seen at 12:00.',
        'Usually the two are seconds apart, so to the minute they match. Id 4 happened and was seen at 12:04.',
        'But id 7 happened at 12:00 and was not seen until 12:04, because its phone was offline. Seen eighth, it happened third.',
        'Which phone sent an event, a or b, is called its key. Every total in this part is grouped by when events happened, so id 7 still counts where it belongs.'
      ]
    },

    /* ---------- 3 · question: windows ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['window', 'fixed window'],
      eyebrow: '03 · Your turn',
      heading: 'The shop wants a total for every 2 minutes',
      stand: 'The shop asks: what was bought between 12:00 and 12:02? Id 7 happened at 12:00, but was seen at 12:04.',
      question: {
        step: 0,
        prompt: 'Should id 7’s value be counted in the total for 12:00 to 12:02?',
        options: [
          { text: 'Yes: the purchase happened inside that stretch.', correct: true,
            why: 'The shop asks what was bought then, and the purchase was made at 12:00, whenever its message arrived.' },
          { text: 'No: it was seen at 12:04, after that stretch.', correct: false,
            why: 'That is when the message arrived, not when the purchase was made.' },
          { text: 'Only if it arrives before the next stretch ends.', correct: false,
            why: 'Arrival time is a fact about the network, not about the purchase. It belongs to 12:00 whenever it arrives.' }
        ]
      },
      cards: [
        { step: 1, title: 'A window', html: '<p>A stretch of time that one result is worked out over is a <b>window</b>, such as 12:00 to 12:02.[[src:hist]]</p>' },
        { step: 2, title: 'Fixed windows', html: '<p>Back-to-back, equal, never overlapping, each <b>120 s</b> wide: <b>fixed windows</b>.[[src:hist]]</p>' }
      ],
      narration: [
        'First question. The shop asks what was bought between 12:00 and 12:02. Id 7 happened at 12:00 but was seen at 12:04. Should it be counted? Choose an answer.',
        'Yes: the purchase happened inside that stretch. A stretch of time that one result is worked out over is called a window.',
        'Back-to-back windows of equal width that never overlap are called fixed windows, 120 seconds each here. Watch the nine events land in them.'
      ]
    },

    /* ---------- 4 · the totals ---------- */
    {
      title: 'Slice', layout: 'array',
      eyebrow: '04 · Watch each event land in its window',
      heading: 'Four windows: 19, 11, 7 and 8',
      stand: 'Slots are the events in the order they were seen. Row 3: the window each belongs to, by event time.',
      array: {
        labelWidth: 150, slotLabel: 'event id',
        rows: [
          { label: 'happened at', values: E.map(e => hm(e.et)) },
          { label: 'value', values: E.map(e => e.v) },
          { label: 'window from', values: E.map(e => hm(seed.winOf(e.et))) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: seed.WINDOWS[0] }
        ]
      },
      cards: [
        { step: 2, title: 'Window 12:00 to 12:02', html: '<p>Ids 0, 1, 2 and 7: <b>19</b>, with id 7 included though it was seen last.[[src:hist]]</p>' },
        { step: 2, title: 'All four', html: '<p>From 12:00, 12:02, 12:04 and 12:08: <b>19, 11, 7 and 8</b>, 45 in all. The same in every mode you will meet here.[[src:walk]]</p>' }
      ],
      narration: [
        'Here are the 9 events in the order they were seen. The first row is when each happened, the second its value.',
        'Each event drops into the 2-minute window its event time falls in.',
        'The window from 12:00 holds ids 0, 1, 2 and 7: 19. The four windows hold 19, 11, 7 and 8, adding to 45, and they stay the same in every mode you meet in this part.'
      ]
    },

    /* ---------- 5 · question: does batch have a watermark ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['batch', 'bounded', 'unbounded', 'watermark', 'trigger'],
      eyebrow: '05 · Your turn',
      heading: 'Does a nightly file job have a watermark?',
      stand: 'A stream never ends, so a streaming pipeline keeps a running estimate: “every event that happened before this moment has now arrived”. That estimate is called its watermark. A nightly job reads yesterday’s file instead.',
      question: {
        step: 0,
        prompt: 'Does the nightly file job have a watermark?',
        options: [
          { text: 'Yes, a trivial one: “everything”, once the file has ended.', correct: true,
            why: 'Until the last line it knows nothing is complete; after it, everything is. That is a watermark, just a trivial one.' },
          { text: 'No: watermarks only exist for inputs that never end.', correct: false,
            why: 'The job still has to know when all events are in. The end of the file is how it knows.' },
          { text: 'Yes, the same one-minute-behind estimate a stream keeps.', correct: false,
            why: 'It needs no estimate. The file’s ending is a certainty, not a guess.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch: bounded, not unbounded', html: '<p>A job over an input that ends is <b>batch</b>. An input that ends is <b>bounded</b>; a stream is <b>unbounded</b>. Batch is streaming over a bounded input.[[src:flow]]</p>' },
        { step: 2, title: 'And a trigger', html: '<p>The rule for when to publish is a <b>trigger</b>. Batch has one too: fire once, at the end of the file. Trivial, not absent.[[src:why]]</p>' }
      ],
      narration: [
        'Second question. A streaming pipeline keeps a running estimate that every event before some moment has arrived: its watermark. A nightly job reads yesterday’s file. Does it have a watermark? Choose an answer.',
        'Yes, the simplest one: it jumps to everything at the end of the file. A job over an input that ends is called batch. An input that ends is bounded; a stream is unbounded.',
        'And the rule for when to publish is called a trigger. Batch has one too: fire once, at the end. Both are trivial in batch, not absent. Watch the two watermarks side by side.'
      ]
    },

    /* ---------- 6 · two watermarks, animated ---------- */
    {
      title: 'Marks', layout: 'array', defines: ['final'],
      eyebrow: '06 · Watch the two watermarks over the same nine events',
      heading: 'A stream closes windows one by one; batch, all at once',
      stand: 'Stream watermark: the latest happened-time so far, minus 1 minute. A window closes once the watermark passes its end.',
      array: {
        labelWidth: 190, slotLabel: 'event id',
        rows: [
          { label: 'stream watermark', values: WM },
          { label: 'stream: now final', values: CLOSES },
          { label: 'batch watermark', values: B_WM },
          { label: 'batch: now final', values: B_FINAL }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'pick', slots: [LAST] }
        ]
      },
      cards: [
        { step: 1, title: 'Final', html: '<p>A result that can never change again is <b>final</b>. Batch makes all 4 final together, after event 9.[[src:hist]]</p>' },
        { step: 3, title: 'One window left over', html: '<p>The stream has closed 12:00, 12:02 and 12:04. The window from 12:08 is still open after the last event. Hold that thought.[[src:hist]]</p>' }
      ],
      narration: [
        'First the stream. After id 4 its watermark is 12:03:05, and the window from 12:00 closes. After id 8 it jumps to 12:08:00, and the windows from 12:02 and 12:04 close.',
        'Now batch over the same events: its watermark says not yet, eight times, then everything. A result that can never change again is called final. Batch makes all 4 final together.',
        'So batch is not missing a watermark. It has the easiest possible one, which reaches everything at the end of the input and closes every window at once.',
        'But notice: after the last event, the stream has closed only three windows. The window from 12:08 is still open. Keep that in mind; it comes back at the end.'
      ]
    },

    /* ---------- 7 · the four mechanisms ---------- */
    {
      title: 'Four', layout: 'table',
      eyebrow: '07 · All four mechanisms, in both modes',
      heading: 'Three of the four are trivial in batch, not absent',
      stand: 'The same pipeline, over a bounded input and over an unbounded one.',
      table: {
        columns: ['Mechanism', 'Bounded input (batch)', 'Unbounded input (stream)'],
        rows: [
          { step: 0, cells: ['<b>Windows</b>', 'the same 4 windows of 120 s', 'the same 4 windows[[src:walk]]'] },
          { step: 1, cells: ['<b>Watermark</b>', 'trivial: “everything”, at the end of input', 'a running estimate[[src:why]]'] },
          { step: 1, cells: ['<b>Trigger</b>', 'trivial: fire once, at the end', 'chosen: fire when the watermark passes[[src:why]]'] },
          { step: 2, cells: ['<b>How later answers relate</b>', 'trivial: one answer per window', 'chosen: replace or add up[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Removing a special case', html: '<p>One pipeline for both is possible because you are not adding streaming machinery to a batch job: you are <b>removing a special case</b>.[[src:why]]</p>' },
      narration: [
        'Here are the four mechanisms side by side. Windows are the same in both modes: the same 4 windows of 120 seconds.',
        'The watermark and the trigger are trivial in batch: everything at the end of input, and fire once, at the end. A stream must keep a real estimate and choose when to fire.',
        'And how later answers relate is trivial in batch too: there is only one answer per window. A stream must choose whether a new answer replaces the old one or adds to it.',
        'So one pipeline can serve both. You are not adding streaming machinery to a batch job; you are removing a special case.'
      ]
    },

    /* ---------- 8 · question: Lambda's duplication ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['Lambda architecture', 'codebase'],
      eyebrow: '08 · Your turn',
      heading: 'What becomes of the second copy?',
      stand: 'Many teams run the Lambda architecture: a batch system and a fast streaming system side by side, each with its own program, its own codebase, for the same sum.',
      question: {
        step: 0,
        prompt: 'Once one pipeline can run over a bounded or an unbounded input, what happens to the second codebase?',
        options: [
          { text: 'It disappears: the mode becomes a setting, not a rewrite.', correct: true,
            why: 'The same pipeline runs over yesterday’s file or over the live stream. Choosing between them is an execution detail.' },
          { text: 'It stays, because batch still needs its own logic.', correct: false,
            why: 'Batch’s only special logic was its trivial watermark and trigger, and the same pipeline handles those.' },
          { text: 'It is merged into the stream as a third layer.', correct: false,
            why: 'There is nothing left to merge. One pipeline serves both modes, so no extra layer is needed.' }
        ]
      },
      cards: [
        { step: 1, title: 'No second copy', html: '<p>With one model, the same pipeline serves both modes, so the Lambda duplication disappears. The choice of mode is an execution detail.[[src:flow]]</p>' }
      ],
      narration: [
        'Third question. The Lambda architecture runs a batch system and a streaming system side by side, each with its own codebase. Once one pipeline can run over either input, what happens to the second codebase? Choose an answer.',
        'It disappears. The same pipeline runs over yesterday’s file or the live stream, and choosing between them becomes an execution detail, not a rewrite.'
      ]
    },

    /* ---------- 9 · question: undoing a bug ---------- */
    {
      title: 'Q4', layout: 'ask', defines: ['log', 'offset', 'replay'],
      eyebrow: '09 · Your turn',
      heading: 'A bug, and only one pipeline to fix',
      stand: 'A bug halves each of phone a’s values and rounds down. Phone a reads 11 instead of 24, and the total 32 instead of 45. The fix is one edit inside the one pipeline.',
      question: {
        step: 0,
        prompt: 'After the edit, how are the wrong totals of the past corrected?',
        options: [
          { text: 'Keep every event, and run them all through the fixed pipeline.', correct: true,
            why: 'If the events are kept in order, re-reading all 9 through the fixed code rebuilds every total.' },
          { text: 'Ask a separate batch system to compute the right totals.', correct: false,
            why: 'That brings back a second codebase, the very thing one pipeline removed.' },
          { text: 'Correct the stored totals with a formula that undoes halving.', correct: false,
            why: 'Halving and rounding down loses information: a 1 could have come from a 2 or a 3.' }
        ]
      },
      cards: [
        { step: 1, title: 'A log, and offsets', html: '<p>A store that keeps every event in order and lets them be read again is a <b>log</b>. Each event’s position in it, 0 to 8, is its <b>offset</b>.[[src:flow]]</p>' },
        { step: 2, title: 'A replay', html: '<p>Reading the log again from offset 0 through new code is a <b>replay</b>. Nothing is migrated: the old results are simply rebuilt.[[src:prog]]</p>' }
      ],
      narration: [
        'Fourth question. A bug halves phone a’s values: phone a reads 11 instead of 24, and the total 32 instead of 45. After the one-line fix, how are past totals corrected? Choose an answer.',
        'Keep every event and run them all again. A store that keeps every event in order, and lets them be read again, is called a log. Each event’s position, 0 to 8, is its offset.',
        'Reading the log again from offset 0 through new code is called a replay. Watch it.'
      ]
    },

    /* ---------- 10 · the replay, animated ---------- */
    {
      title: 'Redo', layout: 'array',
      eyebrow: '10 · Watch the log replayed through the fixed pipeline',
      heading: '9 events re-read: 32 becomes 45',
      stand: 'Each slot is one event in the log, by offset. Row 2: what the buggy pipeline made of it. Row 3: what the fixed one makes of it.',
      array: {
        labelWidth: 170, slotLabel: 'offset',
        rows: [
          { label: 'phone', values: E.map(e => e.key) },
          { label: 'buggy pipeline', values: E.map(buggy) },
          { label: 'fixed pipeline', values: E.map(e => e.v) }
        ],
        meters: ['events read', 'old total', 'replayed total'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 0, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 300 },
          { step: 1, do: 'show', rows: [2] },
          { step: 1, do: 'sweep', row: 2, mode: 'sum', readMeter: 0, resultMeter: 2, speed: 350 }
        ]
      },
      cards: [
        { step: 2, title: 'One edit, one replay', html: '<p>Phone a goes from 11 to <b>24</b>, the total from 32 to <b>45</b>. Reading 9 events was the whole operation.[[src:prog]]</p>' }
      ],
      narration: [
        'Here is the log, nine events by offset. Watch the old, buggy pipeline’s values add up: the total reaches 32.',
        'Now the fixed pipeline replays the same log from offset 0. Watch the replayed total climb to 45.',
        'One edit, in one pipeline, and 9 events re-read. Phone a goes from 11 to 24. Nothing was migrated and no state was changed in place.'
      ]
    },

    /* ---------- 11 · question: how do you know ---------- */
    {
      title: 'Q5', layout: 'ask', defines: ['invariant'],
      eyebrow: '11 · Your turn',
      heading: 'The numbers changed. Are they now right?',
      stand: 'After the replay the total moved from 32 to 45. But a replay that is wrong in some new way would also change the numbers.',
      question: {
        step: 0,
        prompt: 'What tells you the replay reproduced history, rather than computing something else?',
        options: [
          { text: 'Phone b’s total, which the fix should not touch, staying the same.', correct: true,
            why: 'The bug only affected phone a. If phone b’s total is unchanged, the replay reproduced everything the fix should not have touched.' },
          { text: 'The new total, 45, being larger than the buggy total of 32.', correct: false,
            why: 'A different bug could also produce a larger number. Bigger is not the same as right.' },
          { text: 'The replay running to the end without raising any error.', correct: false,
            why: 'A replay that computes the wrong thing also finishes without an error. Silence proves nothing.' }
        ]
      },
      narration: [
        'Fifth question. After the replay, the total moved from 32 to 45. But a replay wrong in some new way would also change the numbers. What tells you it reproduced history? Choose an answer.',
        'A number the fix should not touch. The bug only affected phone a, so phone b’s total must be the same before and after. Watch the check.'
      ]
    },

    /* ---------- 12 · the invariant check, animated ---------- */
    {
      title: 'Check', layout: 'array',
      eyebrow: '12 · Watch the check',
      heading: 'Phone b reads 21 before and after',
      stand: 'Each slot is one key. The fix should change phone a, and only phone a.',
      array: {
        labelWidth: 170, slotLabel: 'key',
        rows: [
          { label: 'phone', values: ['a', 'b'] },
          { label: 'before replay', values: BEFORE },
          { label: 'after replay', values: AFTER },
          { label: 'unchanged?', values: BEFORE.map((v, i) => (v === AFTER[i] ? 'yes' : 'no')) }
        ],
        meters: ['keys checked', 'keys unchanged'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'yes', readMeter: 0, resultMeter: 1, speed: 700 }
        ]
      },
      cards: [
        { step: 2, title: 'An invariant', html: '<p>A number a change must not affect, checked after it, is an <b>invariant</b>. Phone b at <b>21</b> before and after is the evidence the replay reproduced history.[[src:why]]</p>' },
        { step: 2, title: 'Always replay with one', html: '<p>Without an invariant, “the numbers changed” and “the numbers are now right” look exactly alike.[[src:when]]</p>' }
      ],
      narration: [
        'Here are the two keys. Before the replay, phone a read 11 and phone b 21. After it, phone a reads 24 and phone b reads 21.',
        'Watch each key checked: phone a changed, as the fix intended. Phone b is unchanged.',
        'A number a change must not affect, checked afterwards, is called an invariant. Always replay with one; without it, “the numbers changed” and “the numbers are right” look exactly alike.'
      ]
    },

    /* ---------- 13 · question: reprocessing becomes routine ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['reprocessing', 'source of truth', 'retention'],
      eyebrow: '13 · Your turn',
      heading: 'A bug fix, a new rule, a new report',
      stand: 'The team fixes a bug one week, changes a business rule the next, and adds a new report the week after. Each needs history recomputed.',
      question: {
        step: 0,
        prompt: 'With one pipeline and a log, how many different kinds of operation are those three changes?',
        options: [
          { text: 'One: deploy the new code and replay the log.', correct: true,
            why: 'Each is new code over the same events, so each is done the same way: replay the log through it.' },
          { text: 'Three: each kind of change has its own procedure.', correct: false,
            why: 'They differ in what the code does, not in how history is rebuilt. All three are a replay.' },
          { text: 'Two: fixes are replayed, but new reports start fresh.', correct: false,
            why: 'A new report over old events also needs history, and the log provides it by replay.' }
        ]
      },
      cards: [
        { step: 1, title: 'Reprocessing', html: '<p>Recomputing history after the logic changes is <b>reprocessing</b>. Here it is one routine operation: deploy, then replay.[[src:flow]]</p>' },
        { step: 2, title: 'The log is the asset', html: '<p>The log is the <b>source of truth</b>: every result can be rebuilt from it. How long it keeps events, its <b>retention</b>, is the real limit on what can be redone.[[src:why]]</p>' }
      ],
      narration: [
        'Sixth question. A bug fix, then a changed business rule, then a new report. Each needs history recomputed. With one pipeline and a log, how many kinds of operation is that? Choose an answer.',
        'One: deploy the new code, and replay the log. Recomputing history after the logic changes is called reprocessing, and here it is routine.',
        'So the pipeline becomes disposable, and the log becomes the source of truth. The risky asset is the log: how long it keeps events, its retention, limits everything you can redo.'
      ]
    },

    /* ---------- 14 · question: what stays distinct ---------- */
    {
      title: 'Q7', layout: 'ask',
      eyebrow: '14 · Your turn',
      heading: 'The window from 12:08, one more time',
      stand: 'The window 12:08 to 12:10 holds one event, id 8, value 8, and it has received every event it will ever get. The stream’s watermark stopped at 12:08:00.',
      question: {
        step: 0,
        prompt: 'In the stream, is the 12:08 to 12:10 total ever final?',
        options: [
          { text: 'Never: its watermark must reach 12:10, and no later event comes.', correct: true,
            why: 'Only a later event can move the watermark, and in an endless input the pipeline can never know none is coming.' },
          { text: 'Yes: it already holds all its events, so it is final now.', correct: false,
            why: 'It does have them all, but the pipeline cannot know that. Nothing tells it no 12:09 event is still on its way.' },
          { text: 'Yes: once the log is replayed, the window becomes final.', correct: false,
            why: 'A replay of the same log stops at the same watermark, 12:08:00, so the window stays open again.' }
        ]
      },
      cards: [
        { step: 1, title: 'What stays distinct', html: '<p>Final under batch, <b>never final</b> under streaming. The model unifies the how; it does not give an unbounded input an ending.[[src:why]]</p>' },
        { step: 2, title: 'Not a gap', html: '<p>That is not a flaw in the model; it is the thing the model is about. Streams do not end.[[src:why]]</p>' }
      ],
      narration: [
        'Seventh question. The window 12:08 to 12:10 holds id 8, value 8, and has every event it will ever get. The stream’s watermark stopped at 12:08:00. Is that total ever final? Choose an answer.',
        'Never. Its watermark needs to reach 12:10, and no later event comes to move it. Under batch the window is final; under streaming it never is.',
        'That is not a gap in the model; it is the very thing the model is about. The model unifies how results are worked out. It does not give an endless input an ending.'
      ]
    },

    /* ---------- 15 · check yourself ---------- */
    {
      title: 'Q8', layout: 'ask',
      eyebrow: '15 · Your turn · check yourself',
      heading: 'A customer wants a final figure for every window',
      stand: 'An accounts team asks for a final, never-changing total for every 2-minute window, including the one from 12:08.',
      question: {
        step: 0,
        prompt: 'What can the streaming pipeline offer them?',
        options: [
          { text: 'A bounded run, or an agreed cut-off after which it counts as done.', correct: true,
            why: 'Finality needs an ending. Either the input is cut into a bounded run, or the business agrees when to stop waiting.' },
          { text: 'A replay of the whole log, which makes every window final.', correct: false,
            why: 'A replay only re-reads the same events; the window from 12:08 stays open, exactly as before.' },
          { text: 'A faster pipeline, so the last window closes sooner.', correct: false,
            why: 'Speed does not move the watermark. Only a later event, or an ending, can close that window.' }
        ]
      },
      cards: [
        { step: 1, title: 'A product decision', html: '<p>“Replay and you have the right answer” is true of the closed windows, not of that one. A consumer needing a final figure needs a bounded run or an explicit cut-off: a product decision, not a setting.[[src:when]]</p>' }
      ],
      narration: [
        'Last question. An accounts team wants a final total for every window, including the one from 12:08. What can the streaming pipeline offer them? Choose an answer.',
        'A bounded run, or an agreed cut-off after which a window counts as done. Finality needs an ending, and choosing one is a product decision, not a setting.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you now know',
      heading: 'One pipeline, one log, one check, and one limit',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Batch is bounded streaming</b>', 'Its watermark (“everything”, at the end) and trigger (once) are trivial, not absent.[[src:why]]'] },
          { step: 0, cells: ['<b>One codebase</b>', 'The same pipeline over a file or a stream: the Lambda duplication disappears.[[src:flow]]'] },
          { step: 1, cells: ['<b>Reprocessing is a replay</b>', 'One edit, replay 9 events: phone a 11 to 24, total 32 to 45.[[src:prog]]'] },
          { step: 1, cells: ['<b>Check an invariant</b>', 'Phone b reads 21 before and after: the replay reproduced history.[[src:why]]'] },
          { step: 2, cells: ['<b>What stays distinct</b>', 'Finality: 12:08 to 12:10 holds 8, final in batch, never final in streaming.[[src:why]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>The interview version: design a system that survives a bug fix. Part 4 builds it one component at a time, and counts what it does not settle.[[src:ch]]</p>' },
      narration: [
        'To recap. Batch is streaming over a bounded input. Its watermark and trigger are trivial, not absent, so one codebase can serve both modes and the Lambda duplication disappears.',
        'Reprocessing becomes a replay: one edit, 9 events re-read, phone a from 11 to 24 and the total from 32 to 45. And phone b, unchanged at 21, is the invariant that proves it.',
        'What stays distinct is finality. The window 12:08 to 12:10 holds 8, and is final in batch but never final in streaming.',
        'Next, part 4 turns this into a system design interview: a system that survives a bug fix, built one component at a time.'
      ]
    }
  ]
};
