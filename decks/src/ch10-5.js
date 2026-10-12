// Chapter 10, Part 5 — the chapter's two "Interview Questions", probed from several sides,
// then the chapter quiz and a recap. Each question is told as a story; its code snippet is
// built line by line from the chapter source (content/ch10-*.js, through _prog.js) with a
// question before each line, so the deck never retypes it. The shop story, the two clocks and
// every word are re-introduced; every number comes from the seed or the snippet itself.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch10';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const L_LAMBDA = Q1.line('// lambda: batch code + speed code');
const L_KAPPA = Q1.line('// kappa : one code, replay log');
const L_FIX = Q1.line('bug fix -> edit once');
const L_SAME = Q2.line('same windowed sum over the 9 seed events');
const L_BATCH = Q2.line('batch    : read 9 events, then stop');
const L_STREAM = Q2.line('streaming: read 9 events as they arrive');
const L_FINAL = Q2.line('only finality differs');

const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const hm = s => `12:${pad(Math.floor(s / 60))}`;
const arrOf = pt => Math.floor(pt / seed.WIN) * seed.WIN;
const BY_ET = seed.WIN_STARTS.map(w => seed.SUM(seed.WINDOWS[w]));
const BY_PT = seed.WIN_STARTS.map(w => E.filter(e => arrOf(e.pt) === w).reduce((a, e) => a + e.v, 0));
const AGREE = BY_ET.map((v, i) => (v === BY_PT[i] ? 'yes' : 'no'));
const OFF = BY_ET.reduce((a, v, i) => a + Math.abs(v - BY_PT[i]), 0);
const KEPT = 6, SHORT = E.slice(E.length - KEPT).reduce((s, e) => s + e.v, 0);

// the seed must still produce what the snippets and the narration say
if (E.length !== 9 || BY_ET.join() !== '19,11,7,8' || BY_PT.join() !== '15,2,20,8' || OFF !== 26 || SHORT !== 30
  || !Q2.lines[L_BATCH[0]].includes('12:00: 19, 12:02: 11, 12:04: 7, 12:08: 8') || seed.closedAt(480) !== null
  || !Q2.lines[L_FINAL[0]].includes('[12:08, 12:10) is never final in streaming'))
  throw new Error('seed or snippet no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Lambda and Beam Drill',
  eyebrow: 'Streaming · Ch 10 · Part 5',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'event time', 'processing time', 'key', 'window', 'batch', 'latency',
    'Lambda architecture', 'batch layer', 'speed layer', 'drift', 'codebase', 'log', 'replay', 'Kappa architecture',
    'retention', 'bounded', 'unbounded', 'Beam model', 'final'],
  sources: {
    ch:   chapter(CH, 'Chapter 10 on GitHub'),
    q1:   section(CH, 'Q1', 'Chapter 10 · interview question 1'),
    q2:   section(CH, 'Q2', 'Chapter 10 · interview question 2'),
    quiz: section(CH, 'Quiz', 'Chapter 10 · quiz'),
    kf:   section(CH, 'Key Facts', 'Chapter 10 · key facts'),
    lam:  section(CH, "Why Lambda's cost is a second implementation, and Kappa's is retention", 'Chapter 10 · Lambda’s cost'),
    lamw: section(CH, 'When to pick each, and which assumption expires quietly', 'Chapter 10 · when to pick each'),
    hist: section(CH, 'Why the end of the input was answering two of the four questions', 'Chapter 10 · the free answers'),
    conv: section(CH, 'Why batch already has all four mechanisms, and what reprocessing becomes', 'Chapter 10 · all four mechanisms'),
    sys:  section(CH, 'Surviving a bug fix — stack and heap at every step', 'Chapter 10 · replay outcomes')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 10 · Part 5 · the interview questions',
      heading: 'Two interview questions about two systems that disagree',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a small message carrying its value: an <b>event</b>. Events keep coming with no end: a <b>stream</b>. A program that works out answers from them is a <b>pipeline</b>.[[src:q1]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in our example' },
        { step: 1, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: OFF, label: 'how far apart two honest programs end up[[src:lam]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'Two jobs, one number', text: 'A team runs a slow job and a fast job that compute the same total.' },
        { step: 3, n: 2, title: 'They disagree', text: 'Neither job has a bug, yet the two totals differ.' },
        { step: 4, n: 3, title: 'The question', text: 'How do you avoid maintaining two diverging copies of the same computation?' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a small message carrying its value, called an event. Events keep coming with no end: a stream. A program working out answers from them is a pipeline.',
        'Our example has 9 events. This part takes the chapter’s 2 interview questions and asks each from several sides.',
        'Then it asks the 5 questions of the chapter quiz. And you will see two honest programs end up 26 apart.',
        'Interview question 1. A team runs a slow job and a fast job that compute the same total for the shop. The two totals disagree, and neither job has a bug.',
        'The interviewer asks: how do you avoid maintaining two diverging copies of the same computation? You will answer first, every time.'
      ]
    },

    /* ---------- 2 · the events and two clocks ---------- */
    {
      title: 'Times', layout: 'table', defines: ['event time', 'processing time', 'key', 'window'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order the pipeline received them. Times are shown to the minute.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 6 ? 1 : 2,
          cells: [`id ${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hm(e.et)}</b>` : hm(e.et), i === 6 || i === 7 ? `<b>${hm(e.pt)}</b>` : hm(e.pt), `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened.</li><li><b>Processing time</b> — when the pipeline saw it.</li><li><b>Key</b> — which phone sent it, a or b.</li><li><b>Window</b> — a 2-minute stretch one total covers: 12:00 to 12:02, 12:02 to 12:04, and so on.[[src:hist]]</li></ul>' },
      narration: [
        'Each event carries two times. When the purchase happened, stamped by the phone, is its event time. When the pipeline saw it is its processing time. Id 0 happened and was seen at 12:00.',
        'Usually the two are seconds apart, so to the minute they match. Id 4 happened and was seen at 12:04.',
        'But id 6 happened at 12:03 and was seen at 12:04, and id 7 happened at 12:00 and was seen at 12:04.',
        'Which phone sent an event is its key. And the shop’s totals are per window: a 2-minute stretch, such as 12:00 to 12:02. Which clock decides an event’s window is the whole story here.'
      ]
    },

    /* ---------- 3 · Q1: why they disagree ---------- */
    {
      title: 'Why', layout: 'ask', defines: ['batch', 'latency', 'Lambda architecture', 'batch layer', 'speed layer'],
      eyebrow: '03 · Interview question 1 · what is wrong, and why',
      heading: 'Two honest jobs, two different totals',
      stand: 'The slow job reads a whole day’s file once it has ended. The fast job adds each event the moment it arrives. Both sum each 2-minute window, and neither has a bug.',
      question: {
        step: 0,
        prompt: 'Why do the two jobs’ window totals disagree?',
        options: [
          { text: 'The slow job windows by when it happened; the fast one by arrival.', correct: true,
            why: 'Holding the whole file, event time is the obvious clock; seeing arrivals, arrival time is. Each choice is natural, and they differ.' },
          { text: 'The fast job loses some events because it is in a hurry.', correct: false,
            why: 'It sees all 9 events. It puts two of them in different windows, which is not the same as losing them.' },
          { text: 'The slow job counts some events twice when it re-reads the file.', correct: false,
            why: 'Fixed windows never overlap, so each event is counted once. Its totals add up to exactly 45.' }
        ]
      },
      cards: [
        { step: 1, title: 'Batch and latency', html: '<p>A job over an input that ends is <b>batch</b>. The delay before an answer arrives is <b>latency</b>: high for the slow job, low for the fast one.[[src:hist]]</p>' },
        { step: 2, title: 'The Lambda architecture', html: '<p>Running a <b>batch layer</b> for correctness and a <b>speed layer</b> for low latency, computing the same logic, is the <b>Lambda architecture</b>.[[src:kf]]</p>' }
      ],
      narration: [
        'First angle: what is wrong, and why? The slow job reads a whole day’s file once it has ended; the fast job adds each event as it arrives. Why do their window totals disagree? Choose an answer.',
        'Each windows by a different clock: the slow one by when events happened, the fast one by arrival. A job over an input that ends is called batch. The delay before an answer is called latency.',
        'Running a batch layer for correctness and a speed layer for low latency, both computing the same logic, is called the Lambda architecture. Watch how far apart the layers end up.'
      ]
    },

    /* ---------- 4 · Q1: the drift, animated ---------- */
    {
      title: 'Drift', layout: 'array', defines: ['drift'],
      eyebrow: '04 · Interview question 1 · watch the layers compared',
      heading: '3 of 4 windows apart, by 26',
      stand: 'Each slot is one window. Row 2: the batch layer, by event time. Row 3: the speed layer, by arrival.',
      array: {
        labelWidth: 170, slotLabel: 'window',
        rows: [
          { label: 'window from', values: seed.WIN_STARTS.map(hm) },
          { label: 'batch layer', values: BY_ET },
          { label: 'speed layer', values: BY_PT },
          { label: 'agree?', values: AGREE }
        ],
        meters: ['windows compared', 'windows that disagree'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'show', rows: [3] },
          { step: 1, do: 'sweep', row: 3, mode: 'match', match: 'no', readMeter: 0, resultMeter: 1, speed: 500 }
        ]
      },
      cards: [
        { step: 2, title: 'Drift', html: '<p>Two copies of the same logic that come to compute different things <b>drift</b>. Here: 3 of 4 windows, <b>26</b> apart in total, with no bug in either.[[src:lam]]</p>' }
      ],
      narration: [
        'Here are the four windows. The batch layer gives 19, 11, 7 and 8. The speed layer gives 15, 2, 20 and 8.',
        'Watch each window compared: 12:00, 12:02 and 12:04 disagree. Only 12:08 agrees.',
        'When two copies of the same logic come to compute different things, they are said to drift. Here, 3 of 4 windows, 26 apart in total, and neither copy has a bug.'
      ]
    },

    /* ---------- 5 · Q1: the snippet, line 1 ---------- */
    {
      title: 'Two', layout: 'code', defines: ['codebase'],
      eyebrow: '05 · Interview question 1 · the snippet, line 1',
      heading: 'Two copies of the code',
      stand: 'The chapter’s answer is three lines. The first names what the Lambda architecture runs.',
      question: { step: 0, prompt: 'What does keeping a batch copy and a speed copy of the same sum lead to?', options: [
        { text: 'Drift: two copies kept equal only by care, which slowly diverge.', correct: true, why: 'Nothing mechanical holds them together, and each context suggests a different clock.' },
        { text: 'Nothing, as long as both copies are reviewed together.', correct: false, why: 'The drift above needed no mistake. A review sees two defensible programs.' },
        { text: 'Faster answers, because the work is split across two systems.', correct: false, why: 'The two copies do the same work twice. Speed comes from the speed layer alone.' } ] },
      code: Q1.build({ add: [L_LAMBDA], step: 1 }),
      cards: [ { step: 2, title: 'Two codebases', html: '<p>The body of code a system runs is its <b>codebase</b>. Lambda keeps two for one sum: “batch code plus speed code leads to drift”.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: which structure is to blame? What does keeping a batch copy and a speed copy of the same sum lead to? Choose an answer.',
        'Drift. Here is the snippet’s first line: Lambda, batch code plus speed code, leads to drift.',
        'The body of code a system runs is called its codebase. Lambda keeps two codebases for one sum, and nothing mechanical keeps them equal.'
      ]
    },

    /* ---------- 6 · Q1: the snippet, line 2 ---------- */
    {
      title: 'One', layout: 'code', defines: ['log', 'replay', 'Kappa architecture'],
      eyebrow: '06 · Interview question 1 · the snippet, line 2',
      heading: 'One copy, and a way to redo the past',
      stand: 'Remove the batch layer, and keep only the fast pipeline. It still has to be able to recompute history.',
      question: { step: 0, prompt: 'With only one pipeline, how can history be recomputed when the code changes?', options: [
        { text: 'Keep every event in a log, and read it again through the code.', correct: true, why: 'A retained log lets the one pipeline rebuild every past result, so no batch copy is needed.' },
        { text: 'Keep the old batch job around just for recomputing.', correct: false, why: 'That is the second codebase again, with all of its drift.' },
        { text: 'Recompute nothing, and only fix results from now on.', correct: false, why: 'Then every past total stays wrong, which the shop will not accept.' } ] },
      code: Q1.build({ before: [L_LAMBDA], add: [L_KAPPA], step: 1 }),
      cards: [ { step: 2, title: 'Log, replay, Kappa', html: '<p>A store that keeps every event in order is a <b>log</b>; reading it again through new code is a <b>replay</b>. One pipeline plus replay is the <b>Kappa architecture</b>: no drift.[[src:q1]]</p>' } ],
      narration: [
        'Remove the batch layer and keep only the fast pipeline. How can it recompute history when the code changes? Choose an answer.',
        'Keep every event in a log, and read it again. Here is the second line: Kappa, one code, replay the log, no drift.',
        'A store that keeps every event in order is called a log, and reading it again through new code is a replay. One pipeline plus replay is called the Kappa architecture.'
      ]
    },

    /* ---------- 7 · Q1: the snippet, line 3 ---------- */
    {
      title: 'Fix', layout: 'code',
      eyebrow: '07 · Interview question 1 · the snippet, line 3',
      heading: 'A bug fix, step by step',
      stand: 'A bug is found in the one pipeline. The old results it produced are wrong.',
      question: { step: 0, prompt: 'Under Kappa, what are the steps of a bug fix?', options: [
        { text: 'Edit once, replay history, then swap in the new result.', correct: true, why: 'One edit in one place; the replay rebuilds the past; the corrected result replaces the old one.' },
        { text: 'Edit the pipeline, then edit the batch job to match.', correct: false, why: 'Under Kappa there is no batch job. That is the Lambda procedure, with two fix sites.' },
        { text: 'Edit once, and let only new events use the fix.', correct: false, why: 'The past results stay wrong. The replay is what corrects them.' } ] },
      code: Q1.build({ before: [L_LAMBDA, L_KAPPA], add: [L_FIX], step: 1 }),
      cards: [ { step: 2, title: 'One fix site', html: '<p>Bug fix: edit once, replay history, swap the result. The fix lands in 1 place instead of 2, and cannot be applied inconsistently.[[src:lam]]</p>' } ],
      narration: [
        'A bug is found in the one pipeline, and its old results are wrong. Under Kappa, what are the steps of a fix? Choose an answer.',
        'Edit once, replay history, swap the result. Here is the third line, which completes the chapter’s answer.',
        'The fix lands in 1 place instead of 2. Kappa does not make it easier to write; it makes it impossible to apply to one copy and not the other.'
      ]
    },

    /* ---------- 8 · Q1: what breaks if you skip a step ---------- */
    {
      title: 'Keep', layout: 'ask', defines: ['retention'],
      eyebrow: '08 · Interview question 1 · what breaks if you skip a step',
      heading: 'The log was trimmed to save space',
      stand: 'The team keeps only the newest 6 of the 9 events in the log. Then the fixed pipeline replays it.',
      question: {
        step: 0,
        prompt: 'What does that replay report, out of a true total of 45?',
        options: [
          { text: '30, and nothing warns that 3 events are gone.', correct: true,
            why: 'It adds the 6 values it can still read. A log does not remember what it deleted.' },
          { text: '45, because the code is now correct.', correct: false,
            why: 'Correct code cannot add values that are no longer stored.' },
          { text: 'An error, because the replay is incomplete.', correct: false,
            why: 'Nothing knows it is incomplete. The replay reads what is there and stops.' }
        ]
      },
      cards: [
        { step: 1, title: 'Retention', html: '<p>How long a log keeps events is its <b>retention</b>. Kappa pays in retention and replay time, where Lambda pays in drift.[[src:kf]]</p>' },
        { step: 2, title: 'It expires quietly', html: '<p>Set 7 days, and “we can always reprocess” becomes “we can reprocess 7 days”, with no error anywhere.[[src:lamw]]</p>' }
      ],
      narration: [
        'Third angle: what breaks if you skip a step? The team keeps only the newest 6 of the 9 events. What does the fixed replay report, out of a true 45? Choose an answer.',
        '30, with no warning. How long a log keeps events is called its retention. Kappa pays in retention and replay time, where Lambda pays in drift.',
        'And that cost expires quietly. Set retention to 7 days, and “we can always reprocess” becomes “we can reprocess 7 days”.'
      ]
    },

    /* ---------- 9 · Q2: the story ---------- */
    {
      title: 'Same', layout: 'ask', defines: ['bounded', 'unbounded', 'Beam model'],
      eyebrow: '09 · Interview question 2 · the story',
      heading: '“Why do we keep two pipelines?”',
      stand: 'An analyst asks why the company keeps separate batch and streaming pipelines when the business logic is identical. The interviewer asks: are batch and streaming really the same thing?',
      question: {
        step: 1,
        prompt: 'What is the real difference between a file that ends and a stream that does not?',
        options: [
          { text: 'Only that one input ends: the computation can be identical.', correct: true,
            why: 'Batch is streaming over an input that ends. The same windowed sum works on either.' },
          { text: 'Batch needs a different program, written for files.', correct: false,
            why: 'Nothing in a windowed sum depends on whether the input ends. Only knowing when it is done does.' },
          { text: 'Streaming can only give rough answers.', correct: false,
            why: 'Given event time, streaming gives the exact same window totals as batch.' }
        ]
      },
      cards: [
        { step: 2, title: 'Bounded and unbounded', html: '<p>An input that ends is <b>bounded</b>; a stream is <b>unbounded</b>. Batch is streaming over a bounded input.[[src:q2]]</p>' },
        { step: 2, title: 'The Beam model', html: '<p>A way of writing one pipeline that runs in either mode is the <b>Beam model</b>. Unify with it, and reprocess by replay.[[src:q2]]</p>' }
      ],
      narration: [
        'Interview question 2. An analyst asks why the company keeps separate batch and streaming pipelines when the business logic is identical.',
        'The interviewer asks: are batch and streaming really the same thing? What is the real difference between a file that ends and a stream that does not? Choose an answer.',
        'Only that one input ends. An input that ends is called bounded; a stream is unbounded. A way of writing one pipeline for either is called the Beam model. Let us build the chapter’s snippet.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, lines 1–2 ---------- */
    {
      title: 'Batch', layout: 'code',
      eyebrow: '10 · Interview question 2 · the snippet, lines 1 and 2',
      heading: 'Batch: read 9 events, then stop',
      stand: 'One windowed sum over the 9 events. First, run it as batch: the input is a file that ends.',
      question: { step: 0, prompt: 'Run as batch, by when events happened, what do the four windows hold?', options: [
        { text: '19, 11, 7 and 8.', correct: true, why: 'Grouped by event time: ids 0, 1, 2 and 7 make 19, and so on. The file’s order does not matter.' },
        { text: '15, 2, 20 and 8.', correct: false, why: 'That is grouping by arrival, the speed layer’s mistake. Batch groups by when events happened.' },
        { text: 'Just one total, 45, for the whole file.', correct: false, why: 'The sum is windowed: one total per 2-minute window, not one for the file.' } ] },
      code: Q2.build({ add: [L_SAME, L_BATCH], step: 1 }),
      cards: [ { step: 2, title: 'Four totals, all at once', html: '<p>Batch reads 9 events, then stops. The ending tells it every window is complete.[[src:q2]]</p>' } ],
      narration: [
        'Here is the same windowed sum, run first as batch over a file that ends. By when events happened, what do the four windows hold? Choose an answer.',
        '19, 11, 7 and 8. Here are the snippet’s first two lines: the same windowed sum over the 9 events, and batch reads 9 events, then stops.',
        'And because the file ends, batch knows every window is complete the moment it stops.'
      ]
    },

    /* ---------- 11 · Q2: the snippet, line 3 ---------- */
    {
      title: 'Strm', layout: 'code',
      eyebrow: '11 · Interview question 2 · the snippet, line 3',
      heading: 'Streaming: the same 9 events, as they arrive',
      stand: 'Now the same code runs as streaming: events are added as they arrive, out of order, with no end in sight. It still groups by when events happened.',
      question: { step: 0, prompt: 'What windows and totals does the streaming run produce?', options: [
        { text: 'The same 4 windows, with the same values.', correct: true, why: 'The grouping is by event time in both runs, so the late id 7 still lands in 12:00 and makes 19.' },
        { text: 'Different values, because the order is different.', correct: false, why: 'A sum does not depend on order, and each event still lands in the window it happened in.' },
        { text: 'Fewer windows, because the stream has not ended.', correct: false, why: 'Every window that holds events is formed. What is missing is not a window, but a certainty.' } ] },
      code: Q2.build({ before: [L_SAME, L_BATCH], add: [L_STREAM], step: 1 }),
      cards: [ { step: 2, title: 'Identical computation', html: '<p>Streaming reads 9 events as they arrive and produces the same 4 windows and the same values. The computation never differed.[[src:q2]]</p>' } ],
      narration: [
        'Now the same code runs as streaming: events added as they arrive, with no end in sight, still grouped by when they happened. What does it produce? Choose an answer.',
        'The same 4 windows, with the same values. Here is the third line: streaming reads 9 events as they arrive, and gets the same windows and values.',
        'So the computation was never the difference between the two runs. Then what is?'
      ]
    },

    /* ---------- 12 · Q2: the snippet, line 4 ---------- */
    {
      title: 'Ends', layout: 'code', defines: ['final'],
      eyebrow: '12 · Interview question 2 · the snippet, line 4',
      heading: 'What is left: when a total is final',
      stand: 'A result that can never change again is final. The window 12:08 to 12:10 holds one event, id 8, value 8. In the stream, no later event ever arrives.',
      question: { step: 0, prompt: 'Is the 12:08 to 12:10 total ever final in the streaming run?', options: [
        { text: 'Never: the stream cannot know no later 12:09 event is coming.', correct: true, why: 'Batch knows because its file ends. A stream has no end to tell it, so that window stays open.' },
        { text: 'Yes: it holds every event it will ever get.', correct: false, why: 'True, but the pipeline cannot know it. Only an ending, or a later event, could tell it.' },
        { text: 'Yes, as soon as id 8 has been added.', correct: false, why: 'Adding an event says nothing about whether another one for that window is still on its way.' } ] },
      code: Q2.build({ before: [L_SAME, L_BATCH, L_STREAM], add: [L_FINAL], step: 1 }),
      cards: [ { step: 2, title: 'Only finality differs', html: '<p>Identical computation; only finality differs. 12:08 to 12:10 is final in batch and never final in streaming. The model unifies the how, not the fact that streams never end.[[src:q2]]</p>' } ],
      narration: [
        'A result that can never change again is called final. The window 12:08 to 12:10 holds id 8, and no later event arrives. In the streaming run, is its total ever final? Choose an answer.',
        'Never. The stream cannot know that no later event is coming. Here is the last line: identical computation; only finality differs, and 12:08 to 12:10 is never final in streaming.',
        'So the answer to the interviewer: yes, batch and streaming are one computation. Unify them with one model and one codebase, and reprocess by replay. Only finality stays different.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'Lambda’s core cost',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What is the core cost of the Lambda architecture?',
        options: [
          { text: 'High latency for answers', correct: false,
            why: 'The speed layer exists precisely to keep latency, the wait for an answer, low.' },
          { text: 'Two codebases that drift apart', correct: true,
            why: 'The same logic lives in a batch layer and a speed layer, kept in step by hand, and they drift.' },
          { text: 'Low throughput of events', correct: false,
            why: 'Nothing here is about how many events per second it can handle. The cost is in the code.' },
          { text: 'No tolerance of failures', correct: false,
            why: 'The batch layer is built on systems that survive failures. Its cost is duplication.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Lambda runs the same logic in a batch layer and a speed layer that must be kept in sync.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What is the core cost of the Lambda architecture? Choose an answer.',
        'Two codebases that drift apart. The same logic lives in a batch layer and a speed layer that must be kept in sync by hand.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'How Kappa reprocesses',
      stand: 'Think of the bug fix: edit once, then what?',
      question: {
        step: 0,
        prompt: 'How does Kappa reprocess data?',
        options: [
          { text: 'Running a separate batch system', correct: false,
            why: 'That would be Lambda’s second layer. Kappa has none.' },
          { text: 'Writing a second codebase', correct: false,
            why: 'Removing the second codebase is the whole point of Kappa.' },
          { text: 'Replaying the log through one pipeline', correct: true,
            why: 'The retained log is read again from the start through the one, corrected pipeline.' },
          { text: 'Fixing old results by hand', correct: false,
            why: 'Hand-correcting totals cannot undo a bug like halving. The events must be re-read.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Kappa replays the retained log through the one streaming pipeline.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. How does Kappa reprocess data? Choose an answer.',
        'By replaying the log through the same pipeline. The retained log is read again from the start through the one, corrected pipeline.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'Batch, in the unified model',
      stand: 'Think of the snippet: read 9 events, then stop.',
      question: {
        step: 0,
        prompt: 'What is batch in the unified model?',
        options: [
          { text: 'A separate paradigm', correct: false,
            why: 'The snippet ran the same computation both ways. Batch is not a different kind of thing.' },
          { text: 'A faster streaming mode', correct: false,
            why: 'Speed is not what distinguishes it. Batch is often the slower of the two.' },
          { text: 'A special type of window', correct: false,
            why: 'Windows are how events are grouped, in either mode. Batch is about the input.' },
          { text: 'Streaming over a bounded input', correct: true,
            why: 'Batch is a stream whose input ends, so the same windows, watermark and triggers apply.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Batch is just streaming over an input that ends.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is batch in the unified model? Choose an answer.',
        'Streaming over a bounded input. Batch is a stream whose input ends, so all the same machinery applies, just with an input that ends.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'What replay needs',
      stand: 'Remember the trimmed log that replayed to 30.',
      question: {
        step: 0,
        prompt: 'What does reprocessing require?',
        options: [
          { text: 'A replayable, persistent log', correct: true,
            why: 'Without the events kept and re-readable, there is nothing to replay. Trim it, and the replay says 30.' },
          { text: 'A second codebase to replay', correct: false,
            why: 'Reprocessing is done by the same code. A second copy is what it avoids.' },
          { text: 'A separate batch layer', correct: false,
            why: 'Kappa reprocesses with no batch layer at all.' },
          { text: 'No state in the pipeline', correct: false,
            why: 'The pipeline can keep state; it is rebuilt by the replay. What it needs is the history.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Replay needs retained, re-readable input history.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. What does reprocessing require? Choose an answer.',
        'A replayable, persistent log. Replay needs the input history kept and re-readable; trim it, and the replay quietly reports 30.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'What stays distinct',
      stand: 'The last question of the chapter. Think of the window 12:08 to 12:10.',
      question: {
        step: 0,
        prompt: 'What stays distinct between batch and streaming after unification?',
        options: [
          { text: 'Which window types exist', correct: false,
            why: 'Both modes used the same 4 windows of 2 minutes.' },
          { text: 'The transform logic', correct: false,
            why: 'The sum was identical in both modes; that is the unification.' },
          { text: 'When results become final', correct: true,
            why: 'Batch closes every window at its end; a stream waits on its running estimate, and 12:08 to 12:10 never closes.' },
          { text: 'How events group by key', correct: false,
            why: 'Grouping by phone works the same way over a file or a stream.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The model unifies the how, not the fact that streams never end.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. What stays distinct between batch and streaming after unification? Choose an answer.',
        'When results are final. A batch run ends; a stream waits on its watermark, its running estimate of what has arrived. The model unifies the how, not the fact that streams never end.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 10, and its two interview questions',
      heading: 'One pipeline, one log, and the one thing that stays different',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Lambda</b>', 'A batch layer and a speed layer for the same logic: two codebases that drift, 3 of 4 windows by 26.[[src:lam]]'] },
          { step: 0, cells: ['<b>Question 1 · Kappa</b>', 'One code, replay the log: edit once, replay history, swap the result.[[src:q1]]'] },
          { step: 1, cells: ['<b>Its price</b>', 'Retention and replay time: keep 6 of 9 events and the replay says 30.[[src:sys]]'] },
          { step: 2, cells: ['<b>Question 2 · one model</b>', 'Batch is streaming over a bounded input: 19, 11, 7, 8 either way.[[src:q2]]'] },
          { step: 3, cells: ['<b>What stays different</b>', 'Finality: 12:08 to 12:10 is final in batch, never final in streaming.[[src:conv]]'] }
        ]
      },
      side: { step: 3, title: 'The whole book, in one line', html: '<p>The field moved from batch, through two layers, to one pipeline with replay, and the model treats batch as the special case where the input ends.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. Lambda keeps a batch layer and a speed layer for the same logic: two codebases that drift, here 3 of 4 windows by 26.',
        'Question 1’s answer is Kappa: one code, replay the log. A fix is one edit, a replay, and a swap. Its price is retention: keep 6 of 9 events and the replay quietly says 30.',
        'Question 2’s answer is one model: batch is streaming over a bounded input, giving 19, 11, 7 and 8 either way.',
        'What stays different is finality: the window 12:08 to 12:10 is final in batch and never final in streaming. Streams do not end.'
      ]
    }
  ]
};
