// Chapter 7, Part 9 — the chapter's two "Interview Questions", explored from several sides,
// then the chapter quiz and a recap of the whole chapter. Each question is told as a story,
// probed (what is slow and why, which structure, what it costs, what breaks if a step is
// skipped), and its code snippet is built line by line, a question before each line. The
// snippet lines come from the chapter source (content/ch07-*.js) through _prog.js, addressed by
// content, so the deck never retypes them. Both clocks and every word are re-introduced.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch07';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const Q1_STATE = Q1.line('at offset 4');
const Q1_SAVE = Q1.line('checkpoint saves');
const Q1_RESUME = Q1.line('restart restores');
const Q1_NO = Q1.line('no reset, no full replay');
const Q2_MODEL = Q2.line('scale model');
const Q2_FULL = Q2.line('full:');
const Q2_INCR = Q2.line('incremental:');
const Q2_GAP = Q2.line('the gap widens');

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS;
const winOf = seed.winOf;
const PREFIX = E.slice(0, 5).reduce((s, e) => s + e.v, 0);
const AFTER = E.slice(5).reduce((s, e) => s + e.v, 0);
if (E.length !== 9 || PREFIX !== 23 || AFTER !== 22 || PREFIX + AFTER !== 45 || winOf(E[4].et) !== 240 || E[7].et !== 50 || E[7].pt !== 280)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Persistent State Drill',
  eyebrow: 'Streaming · Ch 7 · Part 9',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'RocksDB': 'Rocks D B', 'GB': 'gigabytes' } },
  jargon: ['event', 'key', 'value', 'stream', 'pipeline', 'event time', 'processing time', 'window', 'offset',
    'entry', 'state', 'replay', 'checkpoint', 'state store', 'barrier', 'atomic', 'full checkpoint', 'incremental',
    'watermark', 'exactly-once'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    why:   section(CH, 'Why persistence buys time rather than correctness', 'Chapter 7 · persistence buys time'),
    pair:  section(CH, 'Why a checkpoint is two things, and why the frequency is never free', 'Chapter 7 · a checkpoint is two things'),
    when:  section(CH, 'When to checkpoint how often, and what the store choice actually decides', 'Chapter 7 · how often, and which store'),
    rec:   section(CH, 'Why alignment costs something, and why half a checkpoint is wrong rather than stale', 'Chapter 7 · half a checkpoint'),
    q1:    section(CH, 'Q1', 'Chapter 7 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 7 · interview question 2'),
    quiz:  section(CH, 'Quiz', 'Chapter 7 · quiz'),
    kc:    section(CH, 'Key Concepts', 'Chapter 7 · key concepts')
  },

  slides: [
    /* ---------- 1 · the story, and interview question 1 ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'key', 'value', 'stream', 'pipeline'],
      eyebrow: '01 · Chapter 7 · Part 9 · the interview questions',
      heading: 'Two interview questions about surviving a crash, asked from every side',
      hero: { step: 0, text: 'An app records what users do. Each action is an <b>event</b>, naming its user — its <b>key</b> — and carrying a number, its <b>value</b>. Events arrive with no end: a <b>stream</b>. A program called a <b>pipeline</b> keeps a running count per user, and the machine it runs on can crash.[[src:q1]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in the chapter’s example' },
        { step: 1, value: 45, label: 'their total with no crash[[src:pair]]' },
        { step: 2, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'The setup', text: 'A running count per user, kept only in memory.' },
        { step: 3, n: 2, title: 'The crash', text: 'On restart every count resets to zero.' },
        { step: 4, n: 3, title: 'The waste', text: 'Rebuilding them means re-reading the entire stream.' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'An app records what users do. Each action is an event, naming its user, its key, and carrying a number, its value. Events arrive with no end: a stream. A program called a pipeline keeps a running count per user.',
        'The chapter’s example has 9 events, and with no crash their values add up to 45.',
        'This part takes the chapter’s 2 interview questions and asks each from several sides, then the 5 questions of the chapter quiz.',
        'Interview question 1. The counts are kept only in memory. When the job restarts after a crash, every count resets to zero.',
        'And rebuilding them means re-reading the entire stream. How do you make the counts survive a restart without that? You will answer first, every time.'
      ]
    },

    /* ---------- 2 · the events, two clocks ---------- */
    {
      title: 'Data', layout: 'table', defines: ['event time', 'processing time', 'window', 'offset'],
      eyebrow: '02 · The nine events, two clocks, and a position',
      heading: 'Two clocks, a window, and a position',
      stand: 'The chapter’s events in the order the pipeline saw them. Times are seconds after 12:00.',
      table: {
        columns: ['offset', 'key', 'happened at', 'seen at', 'window', 'value'],
        rows: E.map((e, i) => ({ step: i < 3 ? 0 : i < 6 ? 1 : 2,
          cells: [`${i}`, `<code>${e.key}</code>`, `${e.et} s`, `${e.pt} s`, `${winOf(e.et)}`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Four words', html: '<ul class="l"><li><b>Event time</b> — when it happened. <b>Processing time</b> — when the pipeline saw it.</li><li><b>Window</b> — a 120-second stretch of event time, named by its start.</li><li><b>Offset</b> — an event’s position in the order seen, from 0.[[src:pair]]</li></ul>' },
      narration: [
        'Here are the chapter’s 9 events in the order the pipeline saw them. Each has two times: when it happened, its event time, and when the pipeline saw it, its processing time.',
        'Counts are kept per user for each 120-second stretch of event time, called a window. Event 4 happened at 245 seconds, so it belongs to window 240.',
        'Event 7 happened at 50 seconds but was seen at 280, yet it still belongs to window 0. Each event’s position in the order seen, counted from 0, is its offset.',
        'So event time picks the window, and the order seen gives the offset. Both questions turn on the offset.'
      ]
    },

    /* ---------- 3 · Q1: what is slow ---------- */
    {
      title: 'Slow', layout: 'ask', defines: ['entry', 'state', 'replay'],
      eyebrow: '03 · Interview question 1 · what is slow, and why',
      heading: 'Where does a restart’s time go?',
      stand: 'The pipeline holds one running total per user per window, only in memory. The machine crashes after offset 8 and restarts empty.',
      question: {
        step: 0,
        prompt: 'With nothing saved, what must the restart do to get correct totals back?',
        options: [
          { text: 'Read every event again from offset 0 and add it all up.', correct: true,
            why: 'The events are still kept, so the totals can be rebuilt exactly. It is correct; it just takes as long as the history.' },
          { text: 'Nothing: the totals can be started again from zero.', correct: false,
            why: 'Then every total is missing everything before the crash. The answer would be wrong, not just late.' },
          { text: 'Read only the newest event.', correct: false,
            why: 'One event rebuilds a sliver of one total. Everything else would be missing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Entry, state, replay', html: '<p>One total per key per window is an <b>entry</b>; all of them are the <b>state</b>. Reading the stream again from an offset is a <b>replay</b>.[[src:why]]</p>' },
        { step: 2, title: 'Correct but slow', html: '<p>A full replay reads all 9 events here. On a year of history it is the difference between a minute and a week.[[src:why]]</p>' }
      ],
      narration: [
        'First angle: what is slow? The totals live only in memory, and the machine restarts empty. What must the restart do to get correct totals back? Choose an answer.',
        'Read every event again from offset 0. One total per key per window is an entry, all of them are the state, and reading the stream again is a replay.',
        'A full replay is correct, only slow: all 9 events here, and on a year of history, the difference between a minute and a week.'
      ]
    },

    /* ---------- 4 · Q1 snippet line 1 ---------- */
    {
      title: 'State', layout: 'code', defines: ['checkpoint'],
      eyebrow: '04 · Interview question 1 · which structure · the snippet, line 1',
      heading: 'What to save, and alongside what',
      stand: 'After offset 4 the pipeline holds 4 entries. The interviewer asks what a saved copy must contain to avoid the full replay.',
      question: { step: 0, prompt: 'Besides the entries themselves, what must the saved copy record?', options: [
        { text: 'The offset the entries correspond to.', correct: true, why: 'Then a restart knows exactly which events are already inside the totals, and reads on from there.' },
        { text: 'The time of day it was saved.', correct: false, why: 'Clock time says nothing about which events the totals cover. Only a stream position does.' },
        { text: 'Nothing: the entries are enough.', correct: false, why: 'Without a position, a restart cannot tell where to resume, so events are skipped or counted twice.' } ] },
      code: Q1.build({ add: [Q1_STATE], step: 1 }),
      cards: [ { step: 2, title: 'Checkpoint', html: '<p>The entries <code>{a@0:8, b@0:7, a@120:2, a@240:6}</code> <b>at offset 4</b>, saved together, are a <b>checkpoint</b>. They hold 23 points.[[src:pair]]</p>' } ],
      narration: [
        'Second angle: which structure? After offset 4 the pipeline holds 4 entries. Besides the entries, what must a saved copy record? Choose an answer.',
        'The offset they correspond to. Here is the first line of the chapter’s snippet: the state, A at 0 holding 8, B at 0 holding 7, A at 120 holding 2, A at 240 holding 6, at offset 4.',
        'The entries and their offset, saved together, are called a checkpoint. These four entries hold 23 points between them.'
      ]
    },

    /* ---------- 5 · Q1 snippet lines 2 and 3 ---------- */
    {
      title: 'Resume', layout: 'code', defines: ['state store', 'barrier'],
      eyebrow: '05 · Interview question 1 · the snippet, lines 2 and 3',
      heading: 'Save the pair; restore it; read on',
      stand: 'The checkpoint is saved. Later the machine crashes, and the restart loads it.',
      question: { step: 0, prompt: 'After loading the checkpoint, from which offset does the restart read the stream?', options: [
        { text: 'From 0, to rebuild everything.', correct: false, why: 'Events 0 to 4 are already inside the 23. Reading them again would count them twice.' },
        { text: 'From 4, the offset saved.', correct: false, why: 'Event 4 is already folded in. Reading it again would add its 6 twice.' },
        { text: 'From 5, the first event not yet folded.', correct: true, why: 'Offset 4 is the last event inside the checkpoint, so the restart resumes at 5.' } ] },
      code: Q1.build({ before: [Q1_STATE], add: [Q1_SAVE, Q1_RESUME], step: 1 }),
      cards: [ { step: 2, title: 'The components', html: '<p>The entries live in a <b>state store</b> such as RocksDB: hot keys in memory, the rest on disk. A <b>barrier</b> — a marker flowing with the events — tells every stage when to save, so the copy matches one point.[[src:q1]]</p>' } ],
      narration: [
        'After loading the checkpoint, from which offset does the restart read the stream? Choose an answer.',
        'From 5. Here are the next two lines: the checkpoint saves the entries with offset 4, and the restart restores 23 and resumes at 5.',
        'The entries live in a state store, such as RocksDB, with busy keys in memory and the rest on disk. And a barrier, a marker flowing with the events, tells every stage when to save, so the copy matches one point.'
      ]
    },

    /* ---------- 6 · Q1 snippet line 4: what it costs ---------- */
    {
      title: 'Cost', layout: 'code',
      eyebrow: '06 · Interview question 1 · what it costs · the snippet, line 4',
      heading: 'No reset, no full replay',
      stand: 'With the checkpoint, the restart loads 23 and reads on from offset 5.',
      question: { step: 0, prompt: 'How many events does the restart now read, and what total does it reach?', options: [
        { text: '4 events, worth 22: total 45, as if nothing crashed.', correct: true, why: 'Events 5 to 8 hold 22. 23 loaded plus 22 replayed is the no-crash total.' },
        { text: '9 events: total 45, the same as before.', correct: false, why: 'That is the full replay the checkpoint was meant to avoid. Only events 5 to 8 are read.' },
        { text: '4 events: total 22, the rest is lost.', correct: false, why: 'The 23 is loaded from the checkpoint, not lost. It is added to the 22.' } ] },
      code: Q1.build({ before: [Q1_STATE, Q1_SAVE, Q1_RESUME], add: [Q1_NO], step: 1 }),
      cards: [ { step: 2, title: 'Same answer, less work', html: '<p>4 events read instead of 9, and the same totals. Persisting state changes the cost of recovery, never the answer: an optimisation, not a correctness mechanism.[[src:why]]</p>' } ],
      narration: [
        'Third angle: what does it cost? With the checkpoint, how many events does the restart read, and what total does it reach? Choose an answer.',
        '4 events, worth 22, so 23 plus 22 makes 45. Here is the last line of the snippet: no reset, no full replay.',
        'So the restart reads 4 events instead of 9, and gets exactly the same totals. Saving state changes the cost of recovery, never the answer.'
      ]
    },

    /* ---------- 7 · Q1: what breaks if a step is skipped ---------- */
    {
      title: 'Break', layout: 'ask', defines: ['atomic'],
      eyebrow: '07 · Interview question 1 · what breaks if you skip a step',
      heading: 'The entries were saved; the offset was not',
      stand: 'Saving the pair takes two writes. A crash between them leaves the entries saved and the offset as if nothing had been read.',
      question: {
        step: 0,
        prompt: 'What total does the next restart reach?',
        options: [
          { text: '45: the entries are what matter.', correct: false,
            why: 'The stale offset sends the replay back to 0, so events 0 to 4 are added on top of the 23 again.' },
          { text: '68: events 0 to 4 are counted twice.', correct: true,
            why: '23 loaded plus all 45 replayed is 68: over by exactly the 23 the checkpoint held.' },
          { text: '22: the saved entries are ignored.', correct: false,
            why: 'That happens when the entries are lost and the offset kept. Here the entries load fine.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Atomic', html: '<p>The two halves must be committed <b>atomically</b>: both or neither. Entries without offset give 68; offset without entries gives 22. Half a checkpoint is wrong, not stale.[[src:rec]]</p>' },
        { step: 2, title: 'What to volunteer', html: '<p>Pair state with the source offset, commit them together, and resume from the checkpoint rather than from zero. That is the chapter’s answer.[[src:q1]]</p>' }
      ],
      narration: [
        'Fourth angle: what breaks if you skip a step? The entries were saved but the offset was not, so it still says nothing has been read. What total does the next restart reach? Choose an answer.',
        '68. The replay starts at 0 and adds events 0 to 4 on top of the 23 that already holds them. So the two halves must be committed atomically. The other half missing gives 22: wrong in the opposite direction.',
        'So the chapter’s answer: persist state to a state store, pair it with the source offset in an aligned checkpoint, commit both together, and resume from the checkpoint rather than from zero.'
      ]
    },

    /* ---------- 8 · Q2: the story, and what is slow ---------- */
    {
      title: 'Big', layout: 'ask',
      eyebrow: '08 · Interview question 2 · the story, and what is slow',
      heading: 'Ten gigabytes, every minute',
      stand: 'A metrics pipeline holds 10 GB of state. Saving the whole thing every minute saturates the network; saving rarely makes crashes expensive.',
      question: {
        step: 0,
        prompt: 'Why does saving every minute saturate the network?',
        options: [
          { text: 'Each save sends all 10 GB, though little of it changed.', correct: true,
            why: 'Most of the state is the same as last minute. Sending it again is the waste.' },
          { text: 'Saving makes the state larger each time.', correct: false,
            why: 'The state is the same size either way. The cost is in copying all of it again.' },
          { text: 'The network is too slow for any saving.', correct: false,
            why: 'Sending only what changed would fit easily. The problem is what is sent, not the network.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Two pressures', html: '<p>Save often: short recovery, heavy network. Save rarely: light network, long replay on restart. The question asks for low cost <b>and</b> fast recovery.[[src:q2]]</p>' },
        { step: 2, title: 'The interviewer’s question', html: '<p>How do you keep checkpoint cost low while keeping recovery fast?[[src:q2]]</p>' }
      ],
      narration: [
        'Interview question 2. A metrics pipeline holds 10 gigabytes of state. Saving all of it every minute saturates the network. Why? Choose an answer.',
        'Each save sends all 10 gigabytes, though little of it changed. Save often, and the network is swamped; save rarely, and a crash means a long replay.',
        'So the interviewer asks: how do you keep checkpoint cost low while keeping recovery fast? The chapter answers with its own 9 events as a small model.'
      ]
    },

    /* ---------- 9 · Q2 snippet lines 1 and 2 ---------- */
    {
      title: 'Full', layout: 'code', defines: ['full checkpoint'],
      eyebrow: '09 · Interview question 2 · the snippet, lines 1 and 2',
      heading: 'Uploading the whole state each time',
      stand: 'A scale model: the 9 events, with a checkpoint after every 3. After each one, the state holds 2, then 5, then 7 entries.',
      question: { step: 0, prompt: 'If every checkpoint uploads the whole state, how many entries go up in all?', options: [
        { text: '7: the final state is all that matters.', correct: false, why: 'Each checkpoint uploads what exists at that moment: 2, then 5, then 7.' },
        { text: '14: 2 + 5 + 7.', correct: true, why: 'Every checkpoint sends everything so far, so the uploads grow with the state.' },
        { text: '9: one per event.', correct: false, why: 'Uploads are counted in entries per checkpoint, not in events.' } ] },
      code: Q2.build({ add: [Q2_MODEL, Q2_FULL], step: 1 }),
      cards: [ { step: 2, title: 'Full checkpoint', html: '<p>Uploading the whole state every time is a <b>full checkpoint</b>: 2 + 5 + 7 = 14 entries. It grows with the total state, every time.[[src:pair]]</p>' } ],
      narration: [
        'Second angle: which structure? In the scale model, a checkpoint comes after every 3 of the 9 events, when the state holds 2, then 5, then 7 entries. Uploading everything each time, how many go up? Choose an answer.',
        '14. Here are the first two lines of the snippet: the scale model, and full uploads of 2 plus 5 plus 7, which is 14 entries.',
        'Uploading the whole state every time is called a full checkpoint. It grows with the total state, every time.'
      ]
    },

    /* ---------- 10 · Q2 snippet line 3 ---------- */
    {
      title: 'Incr', layout: 'code', defines: ['incremental'],
      eyebrow: '10 · Interview question 2 · the snippet, line 3',
      heading: 'Uploading only what changed',
      stand: 'Between checkpoints, only some entries change: 2 in the first stretch, then 3, then 3.',
      question: { step: 0, prompt: 'Uploading only the entries that changed since the last checkpoint, how many go up in all?', options: [
        { text: '14, the same: recovery needs everything.', correct: false, why: 'Recovery needs everything, but the unchanged entries are already uploaded. They need not go again.' },
        { text: '3: only the last checkpoint’s changes.', correct: false, why: 'Each checkpoint sends its own changes: 2, then 3, then 3.' },
        { text: '8: 2 + 3 + 3.', correct: true, why: 'Each checkpoint sends only its own changes, and recovery is identical.' } ] },
      code: Q2.build({ before: [Q2_MODEL, Q2_FULL], add: [Q2_INCR], step: 1 }),
      cards: [ { step: 2, title: 'Incremental', html: '<p>Uploading only what changed is an <b>incremental</b> checkpoint: 2 + 3 + 3 = 8 entries, against 14. Recovery behaves exactly the same.[[src:pair]]</p>' } ],
      narration: [
        'Between checkpoints, only some entries change: 2, then 3, then 3. Uploading only those, how many go up in all? Choose an answer.',
        '8. Here is the third line: incremental uploads of 2 plus 3 plus 3, which is 8 entries instead of 14.',
        'Uploading only what changed is called an incremental checkpoint, and recovery behaves exactly the same.'
      ]
    },

    /* ---------- 11 · Q2 snippet line 4: why the gap widens ---------- */
    {
      title: 'Gap', layout: 'code',
      eyebrow: '11 · Interview question 2 · what it costs · the snippet, line 4',
      heading: 'What the last line says about scale',
      stand: 'On 9 events, incremental uploads 8 entries against 14. The question’s pipeline holds 10 GB.',
      question: { step: 0, prompt: 'Why does the saving grow as the state grows?', options: [
        { text: 'Full tracks the whole state; incremental, only the changes.', correct: true, why: 'A big, mostly idle state changes little per interval, so the incremental upload stays small while the full one keeps growing.' },
        { text: 'Bigger states simply compress better on the wire.', correct: false, why: 'Nothing here depends on compression. It is about what is sent at all.' },
        { text: 'It does not grow: it is always 57%.', correct: false, why: 'That ratio is for this 9-event model. On a large, mostly idle state it falls far lower.' } ] },
      code: Q2.build({ before: [Q2_MODEL, Q2_FULL, Q2_INCR], add: [Q2_GAP], step: 1 }),
      cards: [ { step: 2, title: '10 GB against 10 KB', html: '<p>Here incremental sends 57% of the uploads — a 43% saving. On a large, mostly idle state it is the difference between uploading 10 GB and 10 KB. Turn it on and leave it on.[[src:pair]]</p>' } ],
      narration: [
        'Third angle: what does it cost? Here incremental sends 8 against 14. Why does the saving grow as the state grows? Choose an answer.',
        'Full uploads grow with the whole state; incremental ones with how fast it changes. Here is the last line: 57 percent of the uploads, and the gap widens as state grows.',
        'On a large, mostly idle state, it is the difference between uploading 10 gigabytes and 10 kilobytes. It is the one setting with no trade: turn it on and leave it on.'
      ]
    },

    /* ---------- 12 · Q2: the frequency ---------- */
    {
      title: 'Tune', layout: 'ask',
      eyebrow: '12 · Interview question 2 · the other half of the answer',
      heading: 'And how often?',
      stand: 'Incremental makes each checkpoint cheap. The interval still decides how far back a crash must replay. Every event: 9 uploads, replay 0. Every 3: 8 uploads, replay 2. Once: 7 uploads, replay 8.',
      question: {
        step: 0,
        prompt: 'How should the checkpoint interval be chosen?',
        options: [
          { text: 'As long as possible, to save uploads.', correct: false,
            why: 'A long interval means a long replay after a crash, and the brief also asks for fast recovery.' },
          { text: 'So that recovery time matches the failure budget.', correct: true,
            why: 'Recovery time is events since the last checkpoint over replay speed. Start from what you can tolerate.' },
          { text: 'As short as possible: every single event.', correct: false,
            why: 'That replays nothing but pays an upload per event. Shorter than the budget needs is cost for nothing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'The chapter’s answer', html: '<p>Use incremental checkpoints — upload only the keys that changed — and tune the frequency so recovery time matches the failure budget.[[src:q2]]</p>' },
        { step: 2, title: 'Components', html: '<p>Incremental checkpoint, a disk-backed state store, and a frequency tuned to the failure budget.[[src:q2]]</p>' }
      ],
      narration: [
        'Last angle. Incremental makes each checkpoint cheap, but the interval still decides how far back a crash replays. How should it be chosen? Choose an answer.',
        'So that recovery time matches the failure budget. Every event costs 9 uploads and replays nothing; once costs 7 and replays 8. Start from the recovery time you can tolerate.',
        'So the chapter’s answer: incremental checkpoints, uploading only the keys that changed, on a disk-backed state store, with the frequency tuned to the failure budget.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Quiz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'Why must state persist?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Why must stream-processing state persist?',
        options: [
          { text: 'To make the stream ordered.', correct: false,
            why: 'Saving state does not reorder anything. Event 7 still arrives late.' },
          { text: 'To survive restarts without re-reading the whole stream.', correct: true,
            why: 'The state could always be rebuilt by replay; persisting it avoids that cost.' },
          { text: 'To reduce event size.', correct: false,
            why: 'Events are unchanged. Persistence is about the totals, not the events.' },
          { text: 'To create watermarks.', correct: false,
            why: 'The watermark — the estimate of how far event time has got — comes from event times, not from saving state.' }
        ]
      },
      defines: ['watermark'],
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Persistent state makes the aggregation durable and restart fast: 4 events read instead of 9.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. Why must stream-processing state persist? Choose an answer.',
        'To survive restarts without re-reading the whole stream. The state can always be rebuilt by replay; persisting it makes the restart fast, 4 events read instead of 9.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Quiz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'What does a checkpoint capture?',
      stand: 'Remember the pair at offset 4.',
      question: {
        step: 0,
        prompt: 'What does a checkpoint capture?',
        options: [
          { text: 'Only the watermark.', correct: false,
            why: 'The watermark alone says nothing about the totals. A restart could not rebuild a single entry from it.' },
          { text: 'Only the source offset.', correct: false,
            why: 'An offset without the entries replays from there into empty totals: 22, missing the 23.' },
          { text: 'State and the source offset at one logical point.', correct: true,
            why: 'The entries and the offset they correspond to, together: 4 entries holding 23, at offset 4.' },
          { text: 'Only the window definitions.', correct: false,
            why: 'Window definitions are fixed in the code. They are not what a crash loses.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A checkpoint pairs state with the offset so resume is coherent: 23 loaded, resume at 5.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. What does a checkpoint capture? Choose an answer.',
        'State and the source offset, at one logical point. The pair: 4 entries holding 23, at offset 4, so the restart loads 23 and resumes at 5.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Quiz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'What do incremental checkpoints buy?',
      stand: 'Remember 14 against 8.',
      question: {
        step: 0,
        prompt: 'What is the benefit of incremental checkpoints?',
        options: [
          { text: 'They capture every key.', correct: false,
            why: 'That is the full checkpoint. Incremental sends only the keys that changed.' },
          { text: 'They never need a barrier.', correct: false,
            why: 'A barrier still decides when each copy is taken. Incremental changes what is sent, not when.' },
          { text: 'They eliminate recovery.', correct: false,
            why: 'Recovery is identical. Incremental changes the upload cost, not the restart.' },
          { text: 'They upload only the keys that changed.', correct: true,
            why: '8 entries instead of 14 here, and the gap widens as the state grows.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Incremental checkpoints upload only the delta, cutting the upload cost sharply: 8 against 14.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is the benefit of incremental checkpoints? Choose an answer.',
        'They upload only the keys that changed: 8 entries instead of 14 on the chapter’s 9 events, and far less on a large, mostly idle state.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Quiz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'What lines up a multi-stage snapshot?',
      stand: 'Think of the stage waiting for the second marker.',
      question: {
        step: 0,
        prompt: 'What aligns a multi-stage snapshot?',
        options: [
          { text: 'A watermark.', correct: false,
            why: 'The watermark tracks event time to close windows. It does not line up saved copies.' },
          { text: 'A checkpoint barrier.', correct: true,
            why: 'It flows with the events, and each stage saves when it has seen it from every input.' },
          { text: 'A trigger.', correct: false,
            why: 'A trigger decides when a window’s result is sent on. It does not coordinate saving.' },
          { text: 'A window.', correct: false,
            why: 'A window groups events by event time. It has nothing to do with when stages save.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A barrier flows through the stream and each stage snapshots on seeing it from every input — Chandy–Lamport.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. What aligns a multi-stage snapshot? Choose an answer.',
        'A checkpoint barrier. It flows through the stream with the events, and each stage saves its state when it has seen the barrier from every input.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Quiz5', layout: 'ask', defines: ['exactly-once'],
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'What does exactly-once recovery mean?',
      stand: 'The last question of the chapter. Remember 45, 68 and 22.',
      question: {
        step: 0,
        prompt: 'Exactly-once recovery means …',
        options: [
          { text: 'no state is ever stored.', correct: false,
            why: 'The opposite: it depends on stored state, paired with its offset.' },
          { text: 'the pipeline never restarts.', correct: false,
            why: 'It restarts after every crash. Exactly-once is about what the restart does.' },
          { text: 'watermarks are perfect.', correct: false,
            why: 'Watermarks are estimates, and recovery does not need them to be perfect.' },
          { text: 'state and offsets align, so no record is lost or double-counted.', correct: true,
            why: 'The aligned pair gives 45. Misaligned, it gives 68 or 22.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p><b>Exactly-once</b>: aligning state with offsets means resume is at the right position. 45, never 68 or 22.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. Exactly-once recovery means what? Choose an answer.',
        'State and offsets align, so no record is lost or double-counted. The aligned pair gives 45; misaligned, it gives 68 or 22.'
      ]
    },

    /* ---------- 18 · recap of the chapter ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 7, and its two interview questions',
      heading: 'Save the pair, commit it together, upload what changed',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Why persist</b>', 'State can always be rebuilt by replay; saving it makes restart fast. 4 events read, not 9.[[src:why]]'] },
          { step: 1, cells: ['<b>Question 1 · the checkpoint</b>', 'Entries + offset 4, in a state store, aligned by a barrier: 23 + 22 = 45.[[src:q1]]'] },
          { step: 1, cells: ['<b>Atomic</b>', 'Half a checkpoint is wrong: 68 or 22.[[src:rec]]'] },
          { step: 2, cells: ['<b>Question 2 · incremental</b>', 'Upload only what changed: 8 against 14, and 10 KB against 10 GB at scale.[[src:q2]]'] },
          { step: 3, cells: ['<b>Frequency</b>', 'Chosen from the recovery time you can tolerate; never free.[[src:when]]'] }
        ]
      },
      side: { step: 3, title: 'And the bound', html: '<p>Persistence makes a leak permanent: 1 of 7 entries is never freed by the watermark, and a checkpoint restores it for ever. Watermarks plus allowed lateness are the only garbage collector.[[src:kc]]</p>' },
      narration: [
        'To recap the chapter. State can always be rebuilt by replaying the stream; saving it makes a restart fast, 4 events read instead of 9.',
        'Question 1: a checkpoint pairs the entries with offset 4, kept in a state store and lined up by a barrier, so recovery gives 23 plus 22, which is 45. Half a checkpoint gives 68 or 22, so it must be atomic.',
        'Question 2: incremental checkpoints upload only what changed, 8 against 14, and 10 kilobytes against 10 gigabytes at scale.',
        'And the frequency is chosen from the recovery time you can tolerate. One warning: saving state makes a leak permanent, so the watermark must bound it.'
      ]
    }
  ]
};
