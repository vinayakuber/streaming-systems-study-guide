// Chapter 2, Part 3 — "How": what a window's second published result means to whoever stores
// it. The phones, the two clocks, the two firings and every word are introduced from zero; the
// viewer predicts each mode's panes and each sink's final value before it is animated. All
// values come from the one seed (tools/stream_seed.js) and are asserted, so the five outcomes
// (19, 19, 19, 34, 4) cannot drift from the chapter.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch02';
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const W0 = seed.WINDOWS[0];
const END = seed.WIN;
const ONI = seed.WATERMARKS.findIndex(w => w >= END);
const LI = E.findIndex(e => e.id === 7);
const ONTIME = seed.SUM(W0.filter(id => E.findIndex(e => e.id === id) <= ONI));
const FINAL = seed.SUM(W0);
const PANES = {
  discarding: [ONTIME, FINAL - ONTIME],
  accumulating: [ONTIME, FINAL],
  retracting: [ONTIME, -ONTIME, FINAL]
};
const sinkSum = ps => ps.reduce((a, b) => a + b, 0);
const sinkReplace = ps => ps[ps.length - 1];
const OUT = [sinkSum(PANES.discarding), sinkReplace(PANES.accumulating), sinkSum(PANES.retracting),
  sinkSum(PANES.accumulating), sinkReplace(PANES.discarding)];

if (ONTIME !== 15 || FINAL !== 19 || OUT.join() !== '19,19,19,34,4' || E[ONI].id !== 4 || E[LI].v !== 4
  || clock(E[ONI].pt) !== '12:04:06' || clock(E[LI].pt) !== '12:04:40' || clock(E[LI].et) !== '12:00:50' || W0.join() !== '0,1,2,7')
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'How Panes Combine',
  eyebrow: 'Streaming · Ch 2 · Part 3',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'event time', 'processing time', 'watermark', 'trigger', 'pane',
    'sink', 'accumulation mode', 'discarding', 'accumulating', 'retraction', 'keyed state'],
  sources: {
    ch:    chapter(CH, 'Chapter 2 on GitHub'),
    flow:  section(CH, 'How — accumulation', 'Chapter 2 · how'),
    why:   section(CH, 'Why a correct pipeline plus a correct sink can still be wrong', 'Chapter 2 · why it can still be wrong'),
    use:   section(CH, 'When each mode is right, and why the four questions are a checklist', 'Chapter 2 · when each mode is right'),
    walk:  section(CH, 'Visual walkthrough — two panes, three modes, five outcomes', 'Chapter 2 · the walkthrough'),
    prog:  section(CH, 'How — stack and heap at every step', 'Chapter 2 · how, as a program'),
    when:  section(CH, 'Why "when" is a processing-time decision about an event-time question', 'Chapter 2 · when')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window'],
      eyebrow: '01 · Chapter 2 · Part 3',
      heading: 'One window announced twice. What should the second number mean?',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a message with its value: an <b>event</b>. Events never stop: a <b>stream</b>. The <b>pipeline</b> adds them up in 2-minute slices of time called <b>windows</b>. We follow one: 12:00 to 12:02.[[src:why]]' },
      tiles: [
        { step: 1, value: FINAL, label: 'the true total of window 12:00 to 12:02[[src:why]]' },
        { step: 1, value: 2, label: 'times that total is announced: 15, then 19[[src:why]]' },
        { step: 2, value: OUT[3], label: 'what one reader ends up with[[src:why]]' },
        { step: 2, value: OUT[4], label: 'what another reader ends up with[[src:why]]' }
      ],
      cardsLabel: 'Three questions this part answers',
      cards: [
        { step: 3, n: 1, title: 'Is 19 a new total, or an extra 19?', text: 'The numbers alone cannot say.' },
        { step: 3, n: 2, title: 'What can the pipeline send?', text: 'Three standard ways, each with its own meaning.' },
        { step: 4, n: 3, title: 'Who has to agree?', text: 'The pipeline, and whatever stores its numbers.' }
      ],
      note: { step: 4, text: 'You will be asked to answer before each explanation. Every ↗ opens the chapter on GitHub.[[src:ch]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a message with its value, called an event. Events never stop: a stream. The pipeline adds them up in 2-minute slices called windows.',
        'We follow one window, 12:00 to 12:02. Its true total is 19. But the pipeline announces its total twice: first 15, then 19.',
        'Depending on what the reader does with those two numbers, it can end up with 19, or 34, or 4. Same window, same events, and nothing in the pipeline is broken.',
        'Three questions. Is the second number a new total, or an extra amount to add? And what could the pipeline send, so that there is no doubt?',
        'And who has to agree on the meaning? You will answer first, each time.'
      ]
    },

    /* ---------- 2 · the four events and two clocks ---------- */
    {
      title: 'Clocks', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · The four events of the window, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events that happened between 12:00 and 12:02, in the order the pipeline saw them.',
      table: {
        columns: ['Event', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: W0.map((id, i) => ({ step: i < 3 ? 0 : 1,
          cells: [`id ${id}`, E[id].key, id === 7 ? `<b>${clock(E[id].et)}</b>` : clock(E[id].et), id === 7 ? `<b>${clock(E[id].pt)}</b>` : clock(E[id].pt), `${E[id].v}`] }))
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone. It decides the window.</li><li><b>Processing time</b> — when the pipeline saw it. It decides when anything can be announced.[[src:when]]</li></ul>' },
      narration: [
        'Each event carries two times. When it happened, stamped by the phone, is its event time; when the pipeline saw it is its processing time. Ids 0, 1 and 2 were seen within seconds, with values 5, 3 and 7.',
        'Id 7 happened at 12:00:50, inside the window, but its phone was offline: the pipeline saw it at 12:04:40. Its value is 4.',
        'Event time decides which window an event belongs to. Processing time decides when anything can be announced. That gap is why the window is announced twice.'
      ]
    },

    /* ---------- 3 · two announcements ---------- */
    {
      title: 'Twice', layout: 'timeline', defines: ['watermark', 'trigger', 'pane'],
      eyebrow: '03 · Watch the window being announced twice',
      heading: '15 when the pipeline believes it is complete, 19 when id 7 turns up',
      stand: 'Wall-clock moments, left to right.',
      timeline: [
        { step: 0, time: clock(E[2].pt), title: 'id 2 seen', text: 'The window holds 5, 3 and 7.' },
        { step: 1, time: clock(E[ONI].pt), title: `first pane: ${ONTIME}`, text: 'The watermark passes 12:02.[[src:when]]' },
        { step: 2, time: clock(E[LI].pt), title: `second pane: ${FINAL}`, text: 'Id 7 adds its 4.[[src:why]]' }
      ],
      strip: {
        step: 0, label: 'Events of window 12:00 to 12:02',
        items: [
          { n: 'id 0', text: 'value 5' }, { n: 'id 1', text: 'value 3' }, { n: 'id 2', text: 'value 7', tone: 'ok' },
          { n: 'id 7', text: 'value 4 · seen after the first pane', tone: 'warn' }
        ]
      },
      narration: [
        'At 12:01:33 id 2 is seen. The window now holds 5, 3 and 7. The pipeline has no way to know id 7 is still on its way.',
        'At 12:04:06 the pipeline’s estimate that every earlier event is in, its watermark, passes 12:02. The rule that announces a total, its trigger, fires. Each announced result is called a pane: this one is 15.',
        'At 12:04:40 id 7 arrives, and a second trigger announces a second pane: 19. Both panes were correct when they were produced.'
      ]
    },

    /* ---------- 4 · question: add or replace ---------- */
    {
      title: 'Q1', layout: 'ask', defines: ['sink', 'accumulation mode'],
      eyebrow: '04 · Your turn',
      heading: 'A database stored 15. Now 19 arrives.',
      stand: 'The shop’s database receives the panes and keeps one number for the window. It already holds 15.',
      question: {
        step: 0,
        prompt: 'Looking only at the numbers 15 and 19, should the database add 19, or replace 15 with it?',
        options: [
          { text: 'It cannot tell: the numbers do not say what they mean.', correct: true,
            why: '19 could be a new total that replaces 15, or an amount to add. Nothing in the pane says which.' },
          { text: 'Replace: the later number is always the newer total.', correct: false,
            why: 'Only if the pipeline sends totals. If it sends only what is new, the second pane would be 4.' },
          { text: 'Add: every pane is a fresh amount of purchases.', correct: false,
            why: 'Only if the pipeline sends only the new part. If it sends totals, adding gives 34.' }
        ]
      },
      cards: [
        { step: 1, title: 'The sink', html: '<p>Whatever receives the panes and stores or uses them, here the database, is the <b>sink</b>. It can add each pane, or replace with each pane.[[src:flow]]</p>' },
        { step: 2, title: 'The agreement', html: '<p>What a later pane means relative to an earlier one is the <b>accumulation mode</b>. It answers the question <b>how</b>.[[src:flow]]</p>' }
      ],
      narration: [
        'First question. The shop’s database already holds 15 for this window. Now 19 arrives. Looking only at the numbers, should it add 19, or replace 15 with it? Choose an answer.',
        'It cannot tell. Whatever receives the panes and stores them is called the sink, and a sink can add each pane, or replace with each pane. The number 19 alone does not say which is right.',
        'What a later pane means relative to an earlier one is called the accumulation mode. It answers the fourth question: how. There are three standard modes.'
      ]
    },

    /* ---------- 5 · question: discarding ---------- */
    {
      title: 'Q2', layout: 'ask', defines: ['discarding'],
      eyebrow: '05 · Your turn · the first mode',
      heading: 'Send only what is new',
      stand: 'In this mode, each pane carries only the data that arrived since the previous pane. The first pane was 15.',
      question: {
        step: 0,
        prompt: 'What is the second pane in this mode?',
        options: [
          { text: '4: only id 7’s value arrived since the first pane.', correct: true,
            why: 'Since 15 was sent, the only new event is id 7, worth 4. That is all the second pane carries.' },
          { text: '19: the window’s new total.', correct: false,
            why: 'That is the total so far. This mode sends only the part that is new since the last pane.' },
          { text: '15: the first pane is repeated.', correct: false,
            why: 'Nothing is repeated. What was already sent is thrown away from the pane, not resent.' }
        ]
      },
      cards: [
        { step: 1, title: 'Discarding', html: '<p>Each pane holds only the new data: panes <b>15</b>, then <b>4</b>. What was already sent is discarded. A sink must <b>add</b> them.[[src:why]]</p>' },
        { step: 2, title: 'Cheap to send', html: '<p>It transmits 4 instead of 19. On a big window, that is a small change instead of a full re-send.[[src:use]]</p>' }
      ],
      narration: [
        'First mode. Each pane carries only what arrived since the previous pane. The first pane was 15. What is the second? Choose an answer.',
        '4. Only id 7 arrived since then. This mode is called discarding: what was already sent is thrown away from the next pane. Panes 15, then 4, and a sink must add them.',
        'It is the cheapest to send: 4 instead of 19. But read on its own, a pane of 4 looks like a window holding 4.'
      ]
    },

    /* ---------- 6 · question: accumulating ---------- */
    {
      title: 'Q3', layout: 'ask', defines: ['accumulating'],
      eyebrow: '06 · Your turn · the second mode',
      heading: 'Send the total so far',
      stand: 'In this mode, each pane carries the window’s whole total up to that moment. The first pane was 15.',
      question: {
        step: 0,
        prompt: 'What is the second pane, and what must the sink do with it?',
        options: [
          { text: '19, and the sink must replace 15 with it.', correct: true,
            why: '19 already includes the 15. Replacing gives the right answer; adding would count 15 twice.' },
          { text: '19, and the sink must add it to 15.', correct: false,
            why: 'Then 15 is counted twice: 15 plus 19 is 34, not the window’s 19.' },
          { text: '4, and the sink must add it to 15.', correct: false,
            why: 'That describes the first mode. In this one, each pane is the total so far.' }
        ]
      },
      cards: [
        { step: 1, title: 'Accumulating', html: '<p>Each pane is the window’s total so far: panes <b>15</b>, then <b>19</b>. A sink must <b>replace</b>.[[src:flow]]</p>' },
        { step: 2, title: 'The one most people assume', html: '<p>Simplest to read: a cache or a dashboard row that is overwritten. And it is the mode most people assume is in use.[[src:use]]</p>' }
      ],
      narration: [
        'Second mode. Each pane carries the window’s whole total up to that moment. The first pane was 15. What is the second, and what must the sink do with it? Choose an answer.',
        '19, and the sink must replace 15 with it. This mode is called accumulating: each pane is the total so far. Panes 15, then 19.',
        'It is the simplest to read, and the mode most people assume is in use. But what if the sink adds instead of replacing?'
      ]
    },

    /* ---------- 7 · question: the mismatch ---------- */
    {
      title: 'Q4', layout: 'ask',
      eyebrow: '07 · Your turn',
      heading: 'An adding sink meets accumulating panes',
      stand: 'The sink adds every pane it receives. The pipeline sends accumulating panes: 15, then 19.',
      question: {
        step: 0,
        prompt: 'What number does the sink end up with?',
        options: [
          { text: '34: the 15 is counted twice.', correct: true,
            why: 'The second pane already contained the first. Adding both gives 15 plus 19.' },
          { text: '19: the sink notices the repeat.', correct: false,
            why: 'Nothing in a pane says it repeats an earlier one. The sink just adds.' },
          { text: 'An error is raised somewhere.', correct: false,
            why: 'Every part is doing its job correctly. No error is raised anywhere; the number is simply wrong.' }
        ]
      },
      narration: [
        'Fourth question. The sink adds every pane. The pipeline sends accumulating panes: 15, then 19. What number does the sink end up with? Choose an answer.',
        '34. The second pane already contained the first, so 15 is counted twice. And no error is raised anywhere. Watch both modes run into the same adding sink.'
      ]
    },

    /* ---------- 8 · adding sink, animated ---------- */
    {
      title: 'Add', layout: 'array',
      eyebrow: '08 · Watch one adding sink receive two different pane streams',
      heading: 'Discarding reaches 19. Accumulating reaches 34.',
      stand: 'Each row is the panes one mode sends, in order. The sink adds every pane it receives.',
      array: {
        labelWidth: 170, slotLabel: 'pane',
        rows: [
          { label: 'discarding', values: PANES.discarding },
          { label: 'accumulating', values: PANES.accumulating }
        ],
        meters: ['panes received', 'adding sink holds'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 700 },
          { step: 2, do: 'sweep', row: 1, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 700 }
        ]
      },
      cards: [
        { step: 1, title: 'Matched: 19', html: '<p>15 + 4 = <b>19</b>. The sink’s behaviour matches the mode.[[src:prog]]</p>' },
        { step: 2, title: 'Mismatched: 34', html: '<p>15 + 19 = <b>34</b>, 79% high, because pane 2 already contained pane 1. The pipeline was right, the sink was right, the result is wrong by 15.[[src:prog]]</p>' }
      ],
      narration: [
        'Here are the panes of two modes. Discarding sends 15, then 4. Accumulating sends 15, then 19. The same sink adds whatever it receives.',
        'Watch the discarding panes go in: 15, then 4. The sink holds 19. Correct, because the sink’s behaviour matches the mode.',
        'Now the accumulating panes, into the same sink: 15, then 19. It holds 34, which is 79 percent high. The pipeline was right, the sink was right, and the answer is wrong by 15.'
      ]
    },

    /* ---------- 9 · question: the other mismatch ---------- */
    {
      title: 'Q5', layout: 'ask',
      eyebrow: '09 · Your turn',
      heading: 'A replacing sink meets discarding panes',
      stand: 'This sink keeps only the latest pane it received. The pipeline sends discarding panes: 15, then 4.',
      question: {
        step: 0,
        prompt: 'What number does this sink end up with?',
        options: [
          { text: '4: the first pane, 15, is thrown away.', correct: true,
            why: 'Replacing keeps only the last pane, and in this mode the last pane is only id 7’s value.' },
          { text: '19: replacing always keeps the latest total.', correct: false,
            why: 'Only if each pane is a total. Discarding panes are only the new part.' },
          { text: '15: the larger pane is kept.', correct: false,
            why: 'A replacing sink keeps the latest pane, not the larger one.' }
        ]
      },
      cards: [
        { step: 1, title: 'Wrong by 15 the other way', html: '<p>Replacing 15 with 4 leaves <b>4</b>: the first pane is lost. The same window can end on 19, 34 or 4.[[src:walk]]</p>' },
        { step: 2, title: 'The two common bugs', html: '<p>A sink that adds accumulating panes double-counts by 15. A sink that replaces with discarding panes throws away 15.[[src:walk]]</p>' }
      ],
      narration: [
        'Fifth question. This sink keeps only the latest pane. The pipeline sends discarding panes: 15, then 4. What number does the sink end up with? Choose an answer.',
        '4. Replacing keeps only the last pane, which here is only id 7’s value. The first pane, 15, is thrown away.',
        'Those are the two common bugs: adding accumulating panes double-counts by 15, and replacing with discarding panes loses 15. What if the sink can only add, and you cannot change it?'
      ]
    },

    /* ---------- 10 · question: retraction ---------- */
    {
      title: 'Q6', layout: 'ask', defines: ['retraction'],
      eyebrow: '10 · Your turn · the third mode',
      heading: 'The sink can only add. Make it end on 19.',
      stand: 'The sink belongs to another team and can only add. The pipeline already sent 15, and now knows the total is 19.',
      question: {
        step: 0,
        prompt: 'What could the pipeline send just before 19, so the adding sink ends on 19?',
        options: [
          { text: 'Minus 15: an undo of the pane it sent before.', correct: true,
            why: 'Minus 15 takes the sink back to 0, and then 19 lands on an empty slate: 15, minus 15, plus 19.' },
          { text: 'Nothing: send 19 and let the sink sort it out.', correct: false,
            why: 'The sink only adds, so it ends on 34. It cannot sort anything out.' },
          { text: 'Minus 4: the size of the correction.', correct: false,
            why: '15, minus 4, plus 19 is 30. The undo must cancel the whole old pane, 15.' }
        ]
      },
      cards: [
        { step: 1, title: 'A retraction', html: '<p>A pane that undoes an earlier pane, here <b>minus 15</b>, is a <b>retraction</b>. The mode that sends one before each new total is <b>accumulating and retracting</b>: panes 15, minus 15, 19.[[src:flow]]</p>' },
        { step: 2, title: 'Safe for a sink you do not control', html: '<p>It is the only mode that is correct for a sink that can only add: another job, an event log, a downstream total.[[src:use]]</p>' }
      ],
      narration: [
        'Sixth question. The sink belongs to another team and can only add. The pipeline sent 15 and now knows the total is 19. What could it send just before 19, so the sink ends on 19? Choose an answer.',
        'Minus 15. A pane that undoes an earlier pane is called a retraction. The mode that sends a retraction before each new total is called accumulating and retracting: panes 15, minus 15, then 19.',
        'It is the only mode that stays correct for a sink that can only add, which is most sinks you do not control. Watch it.'
      ]
    },

    /* ---------- 11 · retraction, animated ---------- */
    {
      title: 'Undo', layout: 'array',
      eyebrow: '11 · Watch the adding sink receive a retraction',
      heading: 'An undo makes adding safe',
      stand: 'The panes of accumulating and retracting, in order, into the same adding sink.',
      array: {
        labelWidth: 170, slotLabel: 'pane',
        rows: [ { label: 'retracting', values: PANES.retracting } ],
        meters: ['panes received', 'adding sink holds'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'sweep', row: 0, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 800 },
          { step: 2, do: 'pick', slots: [1] }
        ]
      },
      cards: [
        { step: 1, title: '15, then 0, then 19', html: '<p>The sink goes 15 → 0 → <b>19</b>, without being changed at all.[[src:prog]]</p>' },
        { step: 2, title: 'It must accept a negative', html: '<p>Minus 15 has to be meaningful downstream. A counter usually accepts it; a ledger that already billed on 15 usually does not.[[src:use]]</p>' }
      ],
      narration: [
        'Here are the three panes of accumulating and retracting: 15, minus 15, then 19. The sink is the same one that reached 34 before.',
        'Watch them go in. 15. Then minus 15, back to 0. Then 19. The sink ends on 19, and nothing about the sink was changed.',
        'One condition: the sink must accept a negative number. A counter usually does. A ledger that already billed a customer on 15 usually does not, and no mode fixes that.'
      ]
    },

    /* ---------- 12 · question: where the old value comes from ---------- */
    {
      title: 'Q7', layout: 'ask', defines: ['keyed state'],
      eyebrow: '12 · Your turn',
      heading: 'To send minus 15, the pipeline must know it sent 15',
      stand: 'Many minutes and many events after the first pane, the pipeline must still know the value it published for this window.',
      question: {
        step: 0,
        prompt: 'Where does the pipeline get the old value, 15, that it must undo?',
        options: [
          { text: 'From the running total it keeps for this window.', correct: true,
            why: 'The pipeline already keeps the window’s running total. It also keeps the last value it published, ready to undo.' },
          { text: 'By reading the whole stream again from the start.', correct: false,
            why: 'The stream is history that never changes, and re-reading it for every correction would cost more each time.' },
          { text: 'By asking the sink what it currently holds.', correct: false,
            why: 'The sink may be another team’s system, which only adds. It owes the pipeline no answers.' }
        ]
      },
      cards: [
        { step: 1, title: 'Keyed state', html: '<p>What the pipeline keeps for each window or key between events, its running total and its last published pane, is its <b>keyed state</b>.[[src:flow]]</p>' },
        { step: 2, title: 'The cost of retracting', html: '<p>The pipeline must keep the previous pane’s value in its keyed state to emit the undo. Discarding needs no such memory.[[src:use]]</p>' }
      ],
      narration: [
        'Seventh question. To send minus 15, the pipeline must still know it published 15, long after. Where does it get that old value? Choose an answer.',
        'From what it keeps for this window: its running total and the last value it published. What the pipeline keeps for each window or key between events is called its keyed state.',
        'It never re-reads the stream, which is history that never changes. The price of retracting is that small piece of memory per window.'
      ]
    },

    /* ---------- 13 · the five pairings ---------- */
    {
      title: 'Five', layout: 'table',
      eyebrow: '13 · Three modes, two sinks, five outcomes',
      heading: 'The same window ends on 19, 34 or 4',
      stand: 'Every function in every row is correct. Only the agreement between them changes.',
      table: {
        columns: ['Mode (panes sent)', 'Sink', 'Ends on'],
        rows: [
          { step: 0, cells: ['discarding: 15, 4', 'adds', `<b>${OUT[0]}</b> ✓[[src:why]]`] },
          { step: 0, cells: ['accumulating: 15, 19', 'replaces', `<b>${OUT[1]}</b> ✓[[src:why]]`] },
          { step: 1, cells: ['accumulating and retracting: 15, −15, 19', 'adds', `<b>${OUT[2]}</b> ✓[[src:why]]`] },
          { step: 2, cells: ['accumulating: 15, 19', 'adds', `<b>${OUT[3]}</b>, 15 counted twice[[src:why]]`] },
          { step: 2, cells: ['discarding: 15, 4', 'replaces', `<b>${OUT[4]}</b>, 15 thrown away[[src:why]]`] }
        ]
      },
      side: { step: 3, title: 'Correctness, not preference', html: '<p>The pipeline is correct in all five rows, and nothing in the data reveals a mismatch. Retractions exist to make the panes correct for the sink that cannot be changed.[[src:why]]</p>' },
      narration: [
        'Here are all the pairings. Discarding into an adding sink gives 19. Accumulating into a replacing sink gives 19.',
        'Accumulating and retracting into an adding sink also gives 19.',
        'But accumulating into an adding sink gives 34, and discarding into a replacing sink gives 4.',
        'The pipeline is correct in all five rows, and nothing in the data shows the mismatch. That makes the accumulation mode a question of correctness, not of taste.'
      ]
    },

    /* ---------- 14 · which mode when ---------- */
    {
      title: 'Use', layout: 'cards',
      eyebrow: '14 · Which mode for which sink',
      heading: 'Choose the mode from what the sink does',
      stand: 'The sink decides; the mode must match it.',
      columns: 3,
      cards: [
        { step: 0, title: 'Discarding', html: '<p>When the sink adds and sending less matters: 4 instead of 19. Requires that nothing ever re-reads a pane as a total.[[src:use]]</p>' },
        { step: 1, title: 'Accumulating', html: '<p>When the sink is a store you overwrite: a cache, a dashboard row. Simplest to reason about.[[src:use]]</p>' },
        { step: 2, title: 'Accumulating and retracting', html: '<p>When the sink can only append: another job, an event log. Safe when you do not control the consumer, at the cost of keyed state.[[src:use]]</p>' }
      ],
      narration: [
        'Which mode when? Discarding, when the sink adds and sending less matters: 4 instead of 19. It requires that nothing ever reads a pane as a total.',
        'Accumulating, when the sink is a store you overwrite, such as a cache or a dashboard row. It is the simplest to reason about.',
        'Accumulating and retracting, when the sink can only append, such as another job or an event log. It is safe when you do not control the consumer, and costs a little keyed state.'
      ]
    },

    /* ---------- 15 · question: the checklist ---------- */
    {
      title: 'Q8', layout: 'ask',
      eyebrow: '15 · Your turn · check yourself',
      heading: 'Four questions describe a pipeline',
      stand: 'A pipeline is described by four answers: what it computes, where in event time, when results go out, and how later results relate to earlier ones.',
      question: {
        step: 0,
        prompt: 'A design document answers what, where and when, but leaves out how. What is left undecided?',
        options: [
          { text: 'The sink’s final value: it could be 19, 34 or 4.', correct: true,
            why: 'Without the mode, the same panes can be added or replaced, and the window ends on three different numbers.' },
          { text: 'Nothing: how is only a matter of style.', correct: false,
            why: 'Two of the five pairings are wrong by 15. That is a correctness problem, not a style choice.' },
          { text: 'When the panes go out.', correct: false,
            why: 'That is when, which the document already answers. How is about what a later pane means.' }
        ]
      },
      cards: [
        { step: 1, title: 'A checklist, not a summary', html: '<p>Each question changes an observable number. Leave out when, and the 15-then-19 sequence vanishes from the spec; leave out how, and the final value is 19, 34 or 4.[[src:use]]</p>' }
      ],
      narration: [
        'Last question. A design document answers what, where and when, but leaves out how. What is left undecided? Choose an answer.',
        'The sink’s final value: 19, 34 or 4. Each of the four questions changes a number you can observe, which makes them a checklist, not a summary. Ask all four of every pipeline.'
      ]
    },

    /* ---------- 16 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '16 · What you now know',
      heading: 'How is an agreement between the pipeline and its sink',
      stand: 'Everything in this part, a sentence each.',
      table: {
        columns: ['Word', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Pane</b> and <b>sink</b>', 'Each announced result is a pane; the sink stores it, by adding or by replacing.[[src:flow]]'] },
          { step: 0, cells: ['<b>Discarding</b>', 'Only the new data: 15, then 4. The sink must add.[[src:why]]'] },
          { step: 1, cells: ['<b>Accumulating</b>', 'The total so far: 15, then 19. The sink must replace; adding gives 34.[[src:why]]'] },
          { step: 1, cells: ['<b>Retraction</b>', 'An undo before each new total: 15, −15, 19. Safe for a sink that only adds.[[src:why]]'] },
          { step: 2, cells: ['<b>Keyed state</b>', 'What the pipeline keeps per window, including the last pane it must undo.[[src:flow]]'] }
        ]
      },
      side: { step: 3, title: 'Next · part 4', html: '<p>A whole purchase-summing design, built one component at a time, where all four answers meet: 11 published values for one window, and two thresholds.[[src:ch]]</p>' },
      narration: [
        'To recap. Each announced result is a pane, and the sink stores it by adding or by replacing. Discarding sends only the new data, so the sink must add.',
        'Accumulating sends the total so far, so the sink must replace; adding gives 34. Accumulating and retracting sends an undo first, which keeps an adding sink on 19.',
        'The undo comes from the pipeline’s keyed state, never from re-reading the stream. And a pipeline is only fully described once all four questions are answered.',
        'Next, part 4 builds a whole purchase-summing design, one component at a time, where all four answers meet.'
      ]
    }
  ]
};
