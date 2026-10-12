// Chapter 2, Part 5 — the chapter's two "Interview Questions", each told as a story and
// probed from several sides, with its code snippet built line by line (a question before each
// line), then the chapter quiz and a recap of the whole chapter. The snippet lines come from the
// chapter source (content/ch02-*.js) through _prog.js, addressed by content, never retyped. The
// phones, the two clocks and every word are re-introduced, so the deck stands alone; every value
// comes from the one seed (tools/stream_seed.js) and is asserted.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch02';
const one = S => ({ ...S, line: needle => { const i = S.at(needle); return [i, i]; } });
const Q1 = one(snippet(CH, 0)), Q2 = one(snippet(CH, 1));
const Q1_WIN = Q1.line('window [12:00,12:02)');
const Q1_ON = Q1.line('watermark 12:03:05 (after id 4)');
const Q1_LATE = Q1.line('id 7 (event_time 12:00:50)');
const Q1_LET = [Q1.at('allowed lateness >= 81s'), Q1.at('allowed lateness 80s')];
const Q2_ACC = Q2.line('accumulating : sink = 15');
const Q2_RET = [Q2.at('retracting  : pane1'), Q2.at('sink sees 15, then -15')];

// the seed must still produce what the snippets and the narration say
const E = seed.EVENTS;
const pad = n => String(n).padStart(2, '0');
const clock = s => `12:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const W0 = seed.WINDOWS[0];
const WM = seed.WATERMARKS;
const ONI = WM.findIndex(w => w >= seed.WIN);
const LI = E.findIndex(e => e.id === 7);
const ONTIME = seed.SUM(W0.filter(id => E.findIndex(e => e.id === id) <= ONI));
const LAST = seed.WIN_STARTS[seed.WIN_STARTS.length - 1];
if (W0.join() !== '0,1,2,7' || seed.SUM(W0) !== 19 || ONTIME !== 15 || clock(WM[ONI]) !== '12:03:05' || E[ONI].id !== 4
  || clock(WM[LI]) !== '12:03:20' || clock(E[LI].et) !== '12:00:50' || clock(E[LI].pt) !== '12:04:40' || WM[LI] - seed.WIN + 1 !== 81
  || ONTIME + seed.SUM(W0) !== 34 || seed.SUM(W0) - ONTIME !== 4 || E[LI].pt - E[LI].et !== 230
  || LAST !== 480 || Math.max(...WM) >= LAST + seed.WIN || seed.SUM(seed.WINDOWS[LAST]) !== 8)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Late Data Interview Drill',
  eyebrow: 'Streaming · Ch 2 · Part 5',
  ...shared,
  jargon: ['event', 'stream', 'pipeline', 'window', 'dashboard', 'event time', 'processing time', 'watermark', 'trigger',
    'pane', 'on-time trigger', 'state', 'allowed lateness', 'sink', 'accumulation mode', 'accumulating', 'retraction', 'discarding'],
  sources: {
    ch:    chapter(CH, 'Chapter 2 on GitHub'),
    q1:    section(CH, 'Q1', 'Chapter 2 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 2 · interview question 2'),
    whenf: section(CH, 'When — triggers and watermarks', 'Chapter 2 · when'),
    when:  section(CH, 'Why "when" is a processing-time decision about an event-time question', 'Chapter 2 · why when is a decision'),
    use:   section(CH, 'When to use each trigger, and what allowed lateness costs', 'Chapter 2 · what allowed lateness costs'),
    howf:  section(CH, 'How — accumulation', 'Chapter 2 · how'),
    how:   section(CH, 'Why a correct pipeline plus a correct sink can still be wrong', 'Chapter 2 · why it can still be wrong'),
    howu:  section(CH, 'When each mode is right, and why the four questions are a checklist', 'Chapter 2 · when each mode is right'),
    gaps:  section(CH, 'When this design is right, the two thresholds, and four gaps', 'Chapter 2 · four gaps'),
    whatw: section(CH, 'Why these are two questions and not one', 'Chapter 2 · what and where'),
    quiz:  section(CH, 'Quiz', 'Chapter 2 · quiz')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'pipeline', 'window', 'dashboard'],
      eyebrow: '01 · Chapter 2 · Part 5 · the interview questions',
      heading: 'A dashboard that cannot say whether its number is final',
      hero: { step: 0, text: 'A shop’s app runs on two phones, <b>a</b> and <b>b</b>. Each purchase sends a message with its value: an <b>event</b>. Events never stop: a <b>stream</b>. A <b>pipeline</b> adds the values per 2-minute slice of time, a <b>window</b>, and shows each total on a <b>dashboard</b>, a screen of live figures.[[src:q1]]' },
      tiles: [
        { step: 1, value: seed.SUM(W0), label: 'the true total of window 12:00 to 12:02[[src:q1]]' },
        { step: 1, value: ONTIME, label: 'what the dashboard showed for it[[src:q1]]' },
        { step: 2, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' }
      ],
      cardsLabel: 'Interview question 1, as a story',
      cards: [
        { step: 3, n: 1, title: 'The dashboard', text: 'Sums purchases per 2-minute window and shows each total.' },
        { step: 3, n: 2, title: 'The trouble', text: 'A purchase from 12:00:50 arrives at 12:04:40, after its window was shown.' },
        { step: 4, n: 3, title: 'The interviewer asks', text: 'When is a window’s result ready, and what do you do about events that come later?' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s snippet appears, one line per question.[[src:q1]]' },
      narration: [
        'A shop’s app runs on two phones, a and b. Each purchase sends a message with its value, called an event; they never stop, a stream. A pipeline adds the values per 2-minute slice of time, a window.',
        'Each total is shown on a dashboard, a screen of live figures. The window 12:00 to 12:02 truly totals 19, but the dashboard showed 15.',
        'This part takes the chapter’s 2 interview questions and probes each from several sides, then asks the 5 questions of the chapter quiz.',
        'Interview question 1. The dashboard sums purchases per 2-minute window, but cannot say whether a number is final: a purchase from 12:00:50 arrives at 12:04:40, after its window was shown.',
        'The interviewer asks: how do you decide when a window’s result is ready, and what do you do about events that arrive later? You answer first, every time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Time', layout: 'table', defines: ['event time', 'processing time'],
      eyebrow: '02 · Interview question 1 · the four purchases, and two clocks',
      heading: 'When it happened is not when it was seen',
      stand: 'The purchases that happened between 12:00 and 12:02, in the order the pipeline saw them.',
      table: {
        columns: ['Purchase', 'Phone', 'Happened at', 'Seen at', 'Value'],
        rows: W0.map((id, i) => ({ step: i < 3 ? 0 : 1,
          cells: [`id ${id}`, E[id].key, id === 7 ? `<b>${clock(E[id].et)}</b>` : clock(E[id].et), id === 7 ? `<b>${clock(E[id].pt)}</b>` : clock(E[id].pt), `${E[id].v}`] }))
      },
      side: { step: 2, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> — when the purchase happened, stamped by the phone. It decides the window.</li><li><b>Processing time</b> — when the pipeline saw it. It decides when a total can be shown.[[src:when]]</li></ul>' },
      narration: [
        'Each purchase carries two times. When it happened, stamped by the phone, is its event time; when the pipeline saw it is its processing time. Ids 0, 1 and 2 were seen within seconds.',
        'Id 7 happened at 12:00:50, inside the window, but its phone was offline: the pipeline saw it at 12:04:40, 230 seconds later.',
        'Event time decides which window a purchase belongs to. Processing time decides when a total can be shown. The interview question lives in the gap between them.'
      ]
    },

    /* ---------- 3 · Q1: the snippet, line 1 ---------- */
    {
      title: 'Win', layout: 'code',
      eyebrow: '03 · Interview question 1 · what is in the window · the snippet, line 1',
      heading: 'First, which purchases the answer is about',
      stand: 'The interviewer asks: before deciding when, what should the window 12:00 to 12:02 eventually hold?',
      question: { step: 0, prompt: 'Which purchases belong to the window 12:00 to 12:02?', options: [
        { text: 'Ids 0, 1, 2 and 7, by when they happened: 19 in all.', correct: true, why: 'All four happened between 12:00 and 12:02. Id 7 counts even though it is seen at 12:04:40.' },
        { text: 'Ids 0, 1 and 2, by when they were seen: 15 in all.', correct: false, why: 'That uses arrival time. Id 7 happened at 12:00:50, so it belongs here however late it arrives.' },
        { text: 'Every purchase seen before 12:04:40: 34 in all.', correct: false, why: 'A window is a slice of event time, not everything that arrived before some moment.' } ] },
      code: Q1.build({ add: [Q1_WIN], step: 1 }),
      cards: [ { step: 2, title: 'The target', html: '<p>The right answer is fixed: <b>19</b> from ids 0, 1, 2 and 7. The whole question is when the pipeline can say so.[[src:q1]]</p>' } ],
      narration: [
        'First angle: what is the answer about? Which purchases belong to the window 12:00 to 12:02? Choose an answer.',
        'Ids 0, 1, 2 and 7, by when they happened. Here is the first line of the chapter’s snippet: window 12:00 to 12:02, ids 0, 1, 2 and 7, true sum 19.',
        'So the right answer is fixed at 19. What the dashboard lacks is a way to say when it has reached it.'
      ]
    },

    /* ---------- 4 · Q1: the snippet, line 2 ---------- */
    {
      title: 'Ready', layout: 'code', defines: ['watermark', 'trigger', 'pane', 'on-time trigger'],
      eyebrow: '04 · Interview question 1 · which signal · the snippet, line 2',
      heading: 'A signal that the window is complete',
      stand: 'The pipeline cannot see the future. It can track the latest event time seen so far, minus a margin of 60 s.',
      question: { step: 0, prompt: 'What should decide that the window 12:00 to 12:02 is ready to show?', options: [
        { text: 'The latest event time seen, minus 60 s, passing 12:02.', correct: true, why: 'It is the pipeline’s best estimate that nothing earlier than 12:02 is still coming, measured in event time.' },
        { text: 'The wall clock passing 12:02.', correct: false, why: 'At 12:02 on the wall clock id 7 is still on its way. The wall clock knows nothing about the events.' },
        { text: 'The window having received four purchases.', correct: false, why: 'Nobody knows in advance how many purchases a window will get. Counting cannot say it is complete.' } ] },
      code: Q1.build({ before: [Q1_WIN], add: [Q1_ON], step: 1 }),
      cards: [
        { step: 2, title: 'Watermark, trigger, pane', html: '<p>The <b>watermark</b>: after id 4, 12:04:05 − 60 s = <b>12:03:05</b>. A <b>trigger</b> says “show it now”; each result is a <b>pane</b>. The <b>on-time trigger</b> fires as the watermark passes 12:02, showing <b>15</b>.[[src:when]]</p>' }
      ],
      narration: [
        'Second angle: which signal? The pipeline can track the latest event time seen, minus a margin of 60 seconds. What should decide the window is ready? Choose an answer.',
        'That figure passing 12:02. It is called the watermark: the claim that no earlier event will still arrive. Here is the snippet’s second line: after id 4, the watermark is 12:03:05.',
        'A rule that says show it now is called a trigger, and each result it shows is a pane. Firing when the watermark passes the window’s end is the on-time trigger. It shows 15.'
      ]
    },

    /* ---------- 5 · Q1: the snippet, line 3 ---------- */
    {
      title: 'Late', layout: 'code',
      eyebrow: '05 · Interview question 1 · what goes wrong · the snippet, line 3',
      heading: 'Then id 7 arrives',
      stand: 'At 12:04:40 id 7 arrives. It happened at 12:00:50. The on-time pane, 15, has already been shown.',
      question: { step: 0, prompt: 'When id 7 arrives, where does the watermark stand?', options: [
        { text: 'At 12:03:20, already past 12:02: the claim was wrong.', correct: true, why: 'The watermark said nothing earlier than 12:03:20 would come, and here is a purchase from 12:00:50.' },
        { text: 'At 12:00:50, moved back to let id 7 in.', correct: false, why: 'A watermark never moves back. It is built from the latest time seen, which never shrinks.' },
        { text: 'At 12:04:40, the time id 7 is seen.', correct: false, why: 'That is processing time. The watermark is in event time: the latest seen, 12:04:20, minus 60 s.' } ] },
      code: Q1.build({ before: [Q1_WIN, Q1_ON], add: [Q1_LATE], step: 1 }),
      cards: [ { step: 2, title: 'The estimate was wrong', html: '<p>15, not 19. The claim of completeness and the error are the same moment. A design must expect it, not treat it as a bug.[[src:when]]</p>' } ],
      narration: [
        'Third angle: what goes wrong? At 12:04:40 id 7 arrives, though it happened at 12:00:50. Where does the watermark stand? Choose an answer.',
        'At 12:03:20, already past 12:02. Here is the snippet’s third line: id 7, event time 12:00:50, arrives at 12:04:40 with the watermark at 12:03:20.',
        'So the watermark was wrong, and 15 is not the answer. The design has to decide whether id 7 can still change what was shown.'
      ]
    },

    /* ---------- 6 · Q1: the snippet, lines 4–5 ---------- */
    {
      title: 'Keep', layout: 'code', defines: ['state', 'allowed lateness'],
      eyebrow: '06 · Interview question 1 · the threshold · the snippet, lines 4 and 5',
      heading: 'How long to keep the window alive',
      stand: 'The window’s running total is kept for a set time after the watermark passes 12:02, then freed. It survives while the watermark is below 12:02 plus that time.',
      question: { step: 0, prompt: 'What is the least time past 12:02 that lets id 7 turn 15 into 19?', options: [
        { text: '81 s: the watermark is 80 s past 12:02 when id 7 lands.', correct: true, why: '12:03:20 is below 12:02 plus 81 s, which is 12:03:21. At 80 s the two are equal, and the total is gone.' },
        { text: '230 s: the time id 7 spent travelling.', correct: false, why: 'That is id 7’s delay. The window’s life is measured against the watermark, not the event.' },
        { text: '60 s: the same margin as the watermark.', correct: false, why: 'At 60 s the total is freed once the watermark reaches 12:03:00, before id 7 arrives.' } ] },
      code: Q1.build({ before: [Q1_WIN, Q1_ON, Q1_LATE], add: [Q1_LET], step: 1 }),
      cards: [
        { step: 2, title: 'State and allowed lateness', html: '<p>A window’s kept running total is its <b>state</b>; how long it is kept past the watermark is the <b>allowed lateness</b>. At ≥ 81 s a pane of 19 follows; at 80 s id 7 is dropped and 15 stands.[[src:q1]]</p>' }
      ],
      narration: [
        'Fourth angle: the threshold. The window’s running total is kept for a set time past the watermark, then freed. What is the least time that lets id 7 turn 15 into 19? Choose an answer.',
        '81 seconds. What a window keeps between events is its state, and how long it is kept is the allowed lateness. Here are the last two lines: at 81 seconds or more, 19; at 80, id 7 is dropped and 15 stands.',
        'That is the chapter’s answer: emit on time when the watermark passes the window’s end, and keep the window alive for an allowed lateness so later events can still update it.'
      ]
    },

    /* ---------- 7 · Q1: what it costs ---------- */
    {
      title: 'Cost', layout: 'ask',
      eyebrow: '07 · Interview question 1 · what it costs',
      heading: 'Why not keep every window alive forever?',
      stand: 'A longer allowed lateness lets ever-later purchases correct their windows.',
      question: {
        step: 0,
        prompt: 'What does a longer allowed lateness cost?',
        options: [
          { text: 'Memory: every open window’s state is held for longer.', correct: true,
            why: 'The bill is open windows times state per window. Small for 4 windows, dominant for a million.' },
          { text: 'Speed: every pane is shown later.', correct: false,
            why: 'The on-time pane still fires when the watermark passes. Lateness only affects corrections.' },
          { text: 'Accuracy: late corrections make totals less exact.', correct: false,
            why: 'Corrections make totals more exact: 19 instead of 15. The price is elsewhere.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Garbage collection', html: '<p>Allowed lateness is when window state is thrown away. Open windows × state per window: nothing with 4, the main cost with a million.[[src:use]]</p>' },
        { step: 2, title: 'Set it from the tail', html: '<p>Set allowed lateness from how late events really arrive, then price the memory. And 81 s was found in hindsight; a live pipeline is guessing.[[src:gaps]]</p>' }
      ],
      narration: [
        'Fifth angle: what does it cost? A longer allowed lateness lets ever-later purchases correct their windows. So what is the price? Choose an answer.',
        'Memory. Every open window’s state is held for longer: the bill is open windows times state per window. Nothing for 4 windows; the main cost for a million.',
        'So set it from how late events really arrive, then price the memory. And remember that 81 seconds was found in hindsight; a live pipeline has to guess.'
      ]
    },

    /* ---------- 8 · Q1: other numbers ---------- */
    {
      title: 'Vary', layout: 'ask',
      eyebrow: '08 · Interview question 1 · the same question, another window',
      heading: 'The last window of the day',
      stand: 'Id 8 happened at 12:09:00, in the window 12:08 to 12:10, and is the last purchase. No later event arrives, so the watermark stays at 12:08:00.',
      question: {
        step: 0,
        prompt: 'When does the on-time trigger show the window 12:08 to 12:10?',
        options: [
          { text: 'Never: the watermark never passes 12:10.', correct: true,
            why: 'The on-time trigger waits for the watermark, and with no later events the watermark stays at 12:08:00.' },
          { text: 'At 12:10:00 on the wall clock.', correct: false,
            why: 'That is a clock trigger. The on-time trigger only reacts to the watermark.' },
          { text: 'As soon as id 8 is seen, at 12:09:02.', correct: false,
            why: 'Seeing an event does not complete a window. The watermark must pass its end.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'A window whose when never arrives', html: '<p>With only the watermark, the window from 12:08 is never shown. A clock trigger would show 8 at 12:10:00 and every 60 s after, never claimed complete.[[src:gaps]]</p>' },
        { step: 2, title: 'Why pipelines add a clock', html: '<p>A clock never stalls; a stuck watermark stops output. So real pipelines often fire early on the clock as well.[[src:use]]</p>' }
      ],
      narration: [
        'Last angle on question 1: another window. Id 8, from 12:09:00, is the last purchase, so the watermark stays at 12:08:00. When does the on-time trigger show its window? Choose an answer.',
        'Never. The on-time trigger waits for the watermark to pass 12:10, and it never does. A trigger on the clock would show 8 at 12:10:00, and again every 60 seconds, but never claim it complete.',
        'That is why real pipelines often add early firings on the clock: a clock never stalls, while a stuck watermark stops all output.'
      ]
    },

    /* ---------- 9 · Q2: the story ---------- */
    {
      title: 'Teams', layout: 'ask', defines: ['sink', 'accumulation mode'],
      eyebrow: '09 · Interview question 2 · the story, and the missing answer',
      heading: 'Two teams build “the same” aggregation',
      stand: 'Team A’s pipeline sends a running total each time a window is refined: 15, then 19. Team B’s sink was written for panes that carry only new data, so it adds every number it receives, where it should replace. Joined, the sink stores 34.',
      question: {
        step: 0,
        prompt: 'Which of the four questions did the teams fail to agree on?',
        options: [
          { text: 'How: what a later pane means relative to an earlier one.', correct: true,
            why: 'They agree on what, where and when. Nobody said whether the second number replaces or adds to the first.' },
          { text: 'Where: which windows the purchases fall into.', correct: false,
            why: 'Both numbers are for the same window, 12:00 to 12:02. The windows are not in dispute.' },
          { text: 'When: the moments the panes are shown.', correct: false,
            why: 'When 15 and 19 go out is not in dispute. The trouble is what each number means, not its timing.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Sink and accumulation mode', html: '<p>Whatever receives the panes, here the downstream job, is the <b>sink</b>. What a later pane means relative to an earlier one is the <b>accumulation mode</b>: the answer to <b>how</b>.[[src:q2]]</p>' },
        { step: 2, title: 'Nothing in the numbers says', html: '<p>15 then 19 could be “replace 15 with 19” or “add 19”. The agreement has to be written down.[[src:how]]</p>' }
      ],
      narration: [
        'Interview question 2. Team A sends running totals, 15 then 19. Team B’s sink adds every number it receives, where it should replace, so it stores 34. Which question did the teams fail to agree on? Choose an answer.',
        'How. Whatever receives the panes is called the sink, and what a later pane means relative to an earlier one is called the accumulation mode. That is the fourth question.',
        'Nothing in the numbers says which meaning is intended. 15 then 19 could mean replace 15, or add 19. The agreement has to be written down.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, line 1 ---------- */
    {
      title: 'Twice', layout: 'code', defines: ['accumulating'],
      eyebrow: '10 · Interview question 2 · what breaks · the snippet, line 1',
      heading: 'Running totals into an adding sink',
      stand: 'The window 12:00 to 12:02 sends two panes: 15 when the watermark passes, then 19 when id 7 lands. Each is the total so far. The sink adds.',
      question: { step: 0, prompt: 'What does the adding sink end up holding?', options: [
        { text: '34: the 15 inside 19 is counted twice.', correct: true, why: 'The second pane already contains the first. 15 plus 19 is 34, wrong by 15.' },
        { text: '19: the sink recognises a newer total.', correct: false, why: 'Nothing in a pane says it replaces another. An adding sink just adds.' },
        { text: '4: only the change since the first pane.', correct: false, why: 'Here each pane is the whole total so far, not the change.' } ] },
      code: Q2.build({ add: [Q2_ACC], step: 1 }),
      cards: [ { step: 2, title: 'Accumulating', html: '<p>Each pane is the window’s total so far: <b>accumulating</b> mode. Right for a sink that replaces; into an adding sink it double-counts by 15.[[src:q2]]</p>' } ],
      narration: [
        'First angle: what breaks? The window sends 15, then 19, each the total so far, into a sink that adds. What does the sink end up holding? Choose an answer.',
        '34. Here is the first line of the chapter’s snippet: accumulating, the sink gets 15 then 15 plus 19, which is 34, double-counting by 15.',
        'Sending the total so far is called accumulating mode. It is right for a sink that replaces, and wrong for one that adds.'
      ]
    },

    /* ---------- 11 · Q2: the snippet, lines 2–3 ---------- */
    {
      title: 'Undo', layout: 'code', defines: ['retraction'],
      eyebrow: '11 · Interview question 2 · the fix · the snippet, lines 2 and 3',
      heading: 'Keep the adding sink, change what is sent',
      stand: 'The downstream job belongs to another team and can only add. The pipeline can change what it sends between 15 and 19.',
      question: { step: 0, prompt: 'What should the pipeline send between the panes 15 and 19?', options: [
        { text: 'Minus 15, to undo the first pane before the new total.', correct: true, why: '15, then minus 15, then 19 adds up to exactly 19 in a sink that only adds.' },
        { text: 'Nothing: ask the other team to replace instead.', correct: false, why: 'The sink is not yours to change. The fix has to work with a sink that only adds.' },
        { text: 'Minus 4, the size of the correction.', correct: false, why: '15, minus 4, plus 19 is 30. The undo must cancel the whole old pane.' } ] },
      code: Q2.build({ before: [Q2_ACC], add: [Q2_RET], step: 1 }),
      cards: [
        { step: 2, title: 'A retraction', html: '<p>A pane that undoes an earlier one is a <b>retraction</b>: 15, −15, 19 lands an adding sink on <b>19</b>. The 15 to undo comes from the pipeline’s kept state, never from re-reading the stream.[[src:q2]]</p>' }
      ],
      narration: [
        'Second angle: the fix. The sink belongs to another team and can only add. What should the pipeline send between 15 and 19? Choose an answer.',
        'Minus 15. A pane that undoes an earlier one is called a retraction. Here are the snippet’s last two lines: pane 15, retract minus 15, pane 19, and the sink sees 15, then minus 15 plus 19: 19, correct.',
        'The 15 to undo comes from the state the pipeline already keeps for the window, never from re-reading the stream. That small memory is the price of retracting.'
      ]
    },

    /* ---------- 12 · Q2: what it cannot fix, and other numbers ---------- */
    {
      title: 'Limit', layout: 'ask', defines: ['discarding'],
      eyebrow: '12 · Interview question 2 · other numbers, and the limit',
      heading: 'A third team sends only the change',
      stand: 'A third team sends only what is new since the last pane: 15, then 4. Its sink replaces the stored value with each pane.',
      question: {
        step: 0,
        prompt: 'What does that replacing sink end up holding?',
        options: [
          { text: '4: the first pane, 15, is thrown away.', correct: true,
            why: 'Replacing keeps only the last pane, and in this mode the last pane is only id 7’s value.' },
          { text: '19: the two panes together.', correct: false,
            why: 'Only an adding sink combines panes. This one keeps the last.' },
          { text: '15: the larger pane is kept.', correct: false,
            why: 'A replacing sink keeps the latest pane, whatever its size.' }
        ]
      },
      columns: 2,
      cards: [
        { step: 1, title: 'Discarding', html: '<p>Sending only the new data is <b>discarding</b> mode: right for an adding sink, wrong by 15 for a replacing one. Same window: 19, 34 or 4.[[src:how]]</p>' },
        { step: 2, title: 'What no mode fixes', html: '<p>Retraction needs a sink that accepts −15. A ledger that already billed on 15 does not, and that is a contract with the downstream system.[[src:howu]]</p>' }
      ],
      narration: [
        'Last angle: other numbers. A third team sends only what is new since the last pane, 15 then 4, into a sink that replaces. What does the sink end up holding? Choose an answer.',
        '4. Sending only the new data is called discarding mode, right for an adding sink and wrong by 15 for a replacing one. One window can end on 19, 34 or 4.',
        'And one thing no mode fixes: retraction needs a sink that accepts minus 15. A ledger that already billed on 15 does not. That is a contract with the downstream system.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Qz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'The four questions',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'Which four questions fully specify a pipeline in the Beam model?',
        options: [
          { text: 'Who, what, when, why.', correct: false,
            why: 'Who and why are not part of it. Nothing about the sender or the purpose changes a total.' },
          { text: 'What, where, when, how.', correct: true,
            why: 'The computation, the slice of event time, the moment of showing, and how later panes relate.' },
          { text: 'Where, why, which, how.', correct: false,
            why: 'This leaves out what is computed and when it is shown, two answers that change the numbers.' },
          { text: 'What, where, when, who.', correct: false,
            why: 'Who sends the data is not one of them. It leaves out how, which decided 19, 34 or 4.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>What (transforms), where (windowing), when (triggers and watermarks) and how (accumulation).[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. Which four questions fully specify a pipeline in the Beam model? Choose an answer.',
        'What, where, when and how: the computation, the slice of event time, the moment a result is shown, and how later panes relate to earlier ones.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Qz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'What a watermark declares',
      stand: 'Think of 12:03:05 after id 4.',
      question: {
        step: 0,
        prompt: 'What does a watermark declare?',
        options: [
          { text: 'The exact time on the wall clock.', correct: false,
            why: 'It is in event time. After id 4 it read 12:03:05 while the wall clock read 12:04:06.' },
          { text: 'That no more events earlier than some time will arrive.', correct: true,
            why: 'It is the pipeline’s claim of how complete event time is, and only a best estimate.' },
          { text: 'The number of events processed so far.', correct: false,
            why: 'A count says nothing about which times are covered.' },
          { text: 'How busy the computer running it is.', correct: false,
            why: 'It is about the data’s completeness, not about the machine.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The pipeline’s statement of event-time completeness: the point past which it expects no older events.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. What does a watermark declare? Choose an answer.',
        'That no more events with an event time earlier than some point will arrive. It is a claim of completeness, and a best estimate: id 7 proved 12:03:05 wrong.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Qz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'What allowed lateness is',
      stand: 'Remember 80 s against 81 s.',
      question: {
        step: 0,
        prompt: 'What is allowed lateness?',
        options: [
          { text: 'A window that never closes.', correct: false,
            why: 'It is a limit, not forever. Past it, window state is thrown away.' },
          { text: 'How long after the watermark a window still accepts late events.', correct: true,
            why: 'With 81 s, id 7 still turned 15 into 19; with 80 s it was dropped.' },
          { text: 'The largest size an event may have.', correct: false,
            why: 'It is about time, not size: how long a window waits for stragglers.' },
          { text: 'A kind of trigger.', correct: false,
            why: 'It fires nothing itself. It decides how long state lives for late triggers to use.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The horizon after the watermark during which a window still accepts and updates late events: garbage collection for window state.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What is allowed lateness? Choose an answer.',
        'How long after the watermark a window still accepts late events. With 81 seconds, id 7 turned 15 into 19; with 80, it was dropped.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Qz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'No double counting',
      stand: 'Remember the sink that can only add.',
      question: {
        step: 0,
        prompt: 'Which accumulation mode avoids double-counting when a window refines an earlier result?',
        options: [
          { text: 'Discarding.', correct: false,
            why: 'It avoids it only for an adding sink. A replacing sink ends on 4.' },
          { text: 'Accumulating.', correct: false,
            why: 'Into an adding sink it gives 34: exactly the double count.' },
          { text: 'Accumulating and retracting.', correct: true,
            why: 'The undo before each new total lands an adding sink on 19.' },
          { text: 'None of them.', correct: false,
            why: 'One does: the undo of the old pane makes adding safe.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>Accumulating and retracting: a retraction of the previous pane, then the new total, so an add-only sink lands on the right value.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. Which accumulation mode avoids double-counting when a window refines an earlier result? Choose an answer.',
        'Accumulating and retracting. It sends an undo of the previous pane before the new total, so a sink that only adds still lands on 19.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Qz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'When the on-time trigger fires',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'When does an on-time trigger fire?',
        options: [
          { text: 'When the first event of the window arrives.', correct: false,
            why: 'That would show 8 or less, long before the window could be complete.' },
          { text: 'When the watermark passes the window’s end.', correct: true,
            why: 'For 12:00 to 12:02 that was 12:04:06, when id 4 lifted the watermark to 12:03:05.' },
          { text: 'Every second.', correct: false,
            why: 'That is a clock trigger. The on-time trigger reacts to the watermark.' },
          { text: 'When the window is empty.', correct: false,
            why: 'An empty window has nothing to show. Firing depends on the watermark, not the contents.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>On-time emission is driven by the watermark crossing the window’s end.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. When does an on-time trigger fire? Choose an answer.',
        'When the watermark passes the window’s end. For 12:00 to 12:02, that was at 12:04:06, when id 4 lifted the watermark to 12:03:05.'
      ]
    },

    /* ---------- 18 · recap of the chapter ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 2, and its two interview questions',
      heading: 'Four answers before any number exists',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>What and where</b>', 'The computation and the slice of event time are independent: one sum gives 45, 19 or 78.[[src:whatw]]'] },
          { step: 1, cells: ['<b>Question 1 · when</b>', 'Show on time when the watermark passes the end (15), then correct to 19 if allowed lateness ≥ 81 s.[[src:q1]]'] },
          { step: 1, cells: ['<b>The cost</b>', 'Allowed lateness is memory: open windows × state per window.[[src:use]]'] },
          { step: 2, cells: ['<b>Question 2 · how</b>', 'Accumulating into an adding sink gives 34; retracting gives 15, −15, 19 and lands on 19.[[src:q2]]'] },
          { step: 3, cells: ['<b>A checklist</b>', 'Leave out when or how, and the published numbers are undefined.[[src:howu]]'] }
        ]
      },
      side: { step: 3, title: 'Next · chapter 3', html: '<p>The watermark was simply “latest seen minus 60 s” here. Chapter 3 asks where a watermark comes from, and what a perfect one would cost.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. What is the computation and where is the slice of event time; the two are independent, so one sum can give 45, 19 or 78.',
        'Question 1 is when: show on time when the watermark passes the window’s end, then correct 15 to 19 if the allowed lateness is at least 81 seconds. The cost is memory.',
        'Question 2 is how: running totals into an adding sink give 34, while accumulating and retracting sends 15, minus 15, 19, and lands on 19.',
        'Ask all four of every pipeline. Next, chapter 3 asks where a watermark comes from, and what a perfect one would cost.'
      ]
    }
  ]
};
