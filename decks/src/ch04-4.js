// Chapter 4, Part 4 — the Google interview question (runs separated by a gap, built as the
// times arrive out of order), written WITH the viewer. Every code slide asks what the next
// piece must do, then reveals the real lines of programs/ch04.py (read by _prog.js, addressed
// by content). The last slides show the whole file and what it prints (programs/ch04.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch04';
const P = program('ch04.py');
const OUT = program('ch04.out');

const listAt = needle => JSON.parse(P.lines[P.at(needle)].split('=')[1]);
const ARR = listAt('ARRIVALS = [1');
const G = Number(P.lines.find(l => /^G = \d+$/.test(l)).split('=')[1]);
const SORTED = ARR.slice().sort((a, b) => a - b);

// the pieces, in the order they are written
const DATA = P.span('# Data, from tools', 'N = len(ARRIVALS)');
const ASC = P.fn('ascending');
const SWEEP = P.fn('sweep');
const TOUCH = P.fn('touching');
const ABSORB = P.fn('absorb');
const GONE = P.fn('withdrawn');
const INCR = P.fn('incremental');
const VARS = [P.at('# The three variations.'), P.fn('the_deduplicated_alert')[1]];
const MAIN1 = P.span('def main():', '    assert len(batch) > 1');
const MAIN2 = P.span('    merges = [s for s in trace', 'print(f"  at the chapter');
const MAIN3 = P.span('    # variations', 'one late firing at 50');
const MAIN4 = P.span('    # brute force over many inputs', '    main()');

// the trace, read from what the program printed, so the animation is the program's own
const TRACE = OUT.lines.filter(l => /^\s+\d+\s+(new|extend|MERGE)\s/.test(l)).map(l => {
  const [, t, act] = l.match(/^\s+(\d+)\s+(\S+)/);
  const gone = l.split('withdrawn:')[1].trim();
  const hit = l.match(/touches \[([^\]]*)\]/)[1];
  return { t: Number(t), act, touched: hit === '-' ? 0 : hit.split(' ').length, gone: gone === '-' ? 0 : gone.split(' ').length };
});

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['50  MERGE  touches [1..3 90..130]  ->  1..130  220..260   withdrawn: 1..3 90..130',
  'sorted sweep : [(1, 130), (220, 260), (540, 540)]', 'incremental  : [(1, 130), (220, 260), (540, 540)]',
  '6 runs withdrawn; 245..260 later became 220..260 -- an EARLIER start, so the start is not a key',
  "at the chapter's G = 120: 0 merges, runs [(1, 260), (540, 540)]",
  'calendar: accepted [True, False, True, True, True], members [(5, 9), (11, 20)]',
  'islands : [1, 2, 1, 2, 2, 2]', 'one late firing at 50: [(0, 95)] after paging at [0, 90] -> 1 double page',
  '800 random (times, G) pairs: incremental == sorted sweep (286 merges', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch04.out no longer prints "${s}" — rewrite the narration`);
if (ARR.join() !== '1,3,90,130,245,260,220,50,540' || G !== 47 || TRACE.length !== 9
  || TRACE.map(x => x.act).join() !== 'new,extend,new,extend,new,extend,extend,MERGE,new'
  || TRACE.reduce((a, x) => a + x.gone, 0) !== 6)
  throw new Error('programs/ch04.py no longer has the data this deck explains — rewrite the narration');

module.exports = {
  title: 'The Door Log',
  eyebrow: 'Streaming · Ch 4 · Part 4',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'MERGE': 'merge' } },
  jargon: ['entry', 'visit', 'run', 'list', 'function', 'touch', 'merge', 'withdraw', 'trace'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 4 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 4 · how to model it'),
    whole: section(CH, 'The whole program', 'Chapter 4 · the whole program'),
    trace: section(CH, 'The solution as a running program — stack and heap at every step', 'Chapter 4 · the solution, traced'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 4 · three other ways')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['entry', 'visit'],
      eyebrow: '01 · A Google interview question',
      heading: 'A door log, times that arrive out of order, and visits to report',
      hero: { step: 0, text: 'A door records each time one person walks through it: an <b>entry</b>, stamped with the minute it happened. A <b>visit</b> is a stretch of entries with no gap longer than <code>G</code> minutes between them. The entries reach our program late and in any order, so the time an entry happened and the moment we receive it are two different clocks.[[src:prob]]' },
      tiles: [
        { step: 1, value: 9, label: 'entries in our example[[src:prob]]' },
        { step: 1, value: 1000000, label: 'entries in the real problem[[src:trace]]' },
        { step: 2, value: G, label: 'minutes: the largest gap inside one visit[[src:whole]]' },
        { step: 2, value: 3, label: 'visits in the final answer[[src:prob]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'Report the visits after each entry', text: 'Not once at the end: the entries keep coming.' },
        { step: 3, n: 2, title: 'Entries arrive out of order', text: 'So there is never a moment when sorting is possible.' },
        { step: 4, n: 3, title: 'A reported visit may turn out wrong', text: 'The program must say so.' }
      ],
      note: { step: 4, text: 'We write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:whole]]' },
      narration: [
        'A door records each time a person walks through it: an entry, stamped with the minute it happened. A visit is a stretch of entries with no gap longer than G minutes.',
        'Our example has 9 entries. The real problem has a million, so anything slow will show.',
        'G is 47 minutes, and at the end there are 3 visits. But the entries reach the program late, in any order. When an entry happened and when we receive it are two different clocks.',
        'The interviewer wants the visits reported after every single entry, not once at the end, because entries keep arriving and arrive out of order.',
        'And a visit already reported may turn out to be wrong. We will now write the program together, one piece at a time, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['run'],
      eyebrow: '02 · Your turn · before any code',
      heading: 'Sorted, the answer is easy to see',
      stand: 'The 9 times in time order: ' + SORTED.join(', ') + '. A gap of more than 47 minutes ends a visit.',
      question: {
        step: 0,
        prompt: 'Sorted, with a 47-minute limit, what are the visits?',
        options: [
          { text: '1 to 130, 220 to 260, and 540 alone.', correct: true,
            why: 'Every step up to 130 is 47 or less, 130 to 220 is 90, and 260 to 540 is 280: two breaks, three visits.' },
          { text: '1 to 3, 50 to 130, 220 to 260, and 540.', correct: false,
            why: '3 to 50 is exactly 47, which is not more than 47, so 50 stays in the first visit.' },
          { text: '1 to 260, and 540 alone.', correct: false,
            why: '130 to 220 is 90 minutes, far more than 47, so a visit ends at 130.' }
        ]
      },
      cards: [
        { step: 1, title: 'Runs', html: '<p>Each visit is a <b>run</b>: written <code>1..130</code>, its first and last time. The answer is 1..130, 220..260, 540..540.[[src:prob]]</p>' },
        { step: 2, title: 'The hard part is not this', html: '<p>Sorted, one walk does it. But the times arrive in another order, and keep arriving, so they can never all be sorted first.[[src:model]]</p>' }
      ],
      narration: [
        'Before any code, try it yourself. Here are the times in time order, and a gap of more than 47 minutes ends a visit. What are the visits? Choose an answer.',
        '1 to 130, 220 to 260, and 540 alone. Each visit is called a run, written by its first and last time. That is the answer the program must reach.',
        'Sorted, one walk does it. The hard part is that the times do not arrive sorted, and they keep arriving, so there is never a moment to sort them all.'
      ]
    },

    /* ---------- 3 · the arrival order ---------- */
    {
      title: 'Order', layout: 'array',
      eyebrow: '03 · How the times actually arrive',
      heading: 'Two times come in after later ones',
      stand: 'Top: the order the program receives them. Below: the same times sorted.',
      array: {
        labelWidth: 130, slotLabel: 'arrival',
        rows: [ { label: 'arrives', values: ARR }, { label: 'sorted', values: SORTED } ],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 2, do: 'pick', slots: [6, 7] }
        ]
      },
      cards: [
        { step: 2, title: 'The two late ones', html: '<p>220 arrives after 260, and 50 arrives eighth, long after 130. The 50 is the one that matters: it lands in the gap between two visits.[[src:prob]]</p>' }
      ],
      narration: [
        'Here are the times in the order the program receives them: 1, 3, 90, 130, 245, 260, 220, 50, 540.',
        'And here they are sorted. Compare the two rows: most times arrive in order, but not all.',
        'The highlighted two are late: 220 arrives after 260, and 50 arrives eighth. The 50 is the one that matters. It lands between two visits, and joins them.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'Start with the times, in the order they arrive',
      stand: 'A program is written top to bottom. First, the data.',
      question: { step: 0, prompt: 'How should the program hold the 9 times?', options: [
        { text: 'A list in arrival order, exactly as received.', correct: true, why: 'The order they arrive in is part of the problem. Sorting them first would answer a different question.' },
        { text: 'A list in time order, sorted once at the start.', correct: false, why: 'That hides the late arrivals, and in the real problem the later times have not arrived yet.' },
        { text: 'Only the first and last time, to save memory.', correct: false, why: 'Every time decides where a visit breaks. Two numbers cannot say that.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch04.py · the data' }),
      cards: [ { step: 2, title: 'G is declared here', html: '<p><code>ARRIVALS</code> is a <b>list</b>: values in a row, in arrival order. <code>G = 47</code>, and the comment says why: at the chapter’s gap of 120 nothing joins two runs, and that case is the whole point.[[src:whole]]</p>' } ],
      narration: [
        'First, the data. How should the program hold the 9 times? Choose an answer.',
        'A list in arrival order, exactly as received. A list is just values in a row. Here are the first lines of the real program: the arrivals, G, and N, the count.',
        'Read the comment above G. It is 47 on purpose: at the chapter’s usual gap of 120, no time ever joins two runs, and that is the case this program exists to show.'
      ]
    },

    /* ---------- 5 · the batch answer ---------- */
    {
      title: 'Batch', layout: 'code', defines: ['function'],
      eyebrow: '05 · Writing the program · the answer if all times were known',
      heading: 'Sort, then walk: one comparison per time',
      stand: 'First write the answer for when every time has arrived. It is what the real answer will be checked against.',
      question: { step: 0, prompt: 'Walking the sorted times, what decides whether a time extends the last run or starts a new one?', options: [
        { text: 'Whether it is within G of the last run’s end.', correct: true, why: 'Sorted, the time can only be after that run. Within G, it extends it; further, a new run starts.' },
        { text: 'Whether it is within G of the last run’s start.', correct: false, why: 'A long run’s start can be far behind. What matters is the silence since its last time.' },
        { text: 'Whether it is within G of every earlier time.', correct: false, why: 'Sorted, only the latest time can be the nearest. Checking all of them is wasted work.' } ] },
      code: P.build({ before: [DATA], add: [ASC, SWEEP], step: 1 }),
      cards: [ { step: 2, title: 'Correct only at the end', html: '<p>Each piece is a <b>function</b>: a named recipe that takes inputs and gives back an answer. <code>sweep</code> gives 1..130, 220..260, 540..540 — but only once every time has arrived.[[src:trace]]</p>' } ],
      narration: [
        'Next, the answer for when every time has arrived. Walking the sorted times, what decides whether a time extends the last run or starts a new one? Choose an answer.',
        'Whether it is within G of the last run’s end. Here are two functions, named recipes that take inputs and give back an answer: ascending sorts, and sweep walks with one comparison per time.',
        'Sweep gives 1 to 130, 220 to 260, and 540. But its docstring says it plainly: it is correct only once every time has arrived, which the question says never happens.'
      ]
    },

    /* ---------- 6 · which runs does a time touch ---------- */
    {
      title: 'Touch', layout: 'code', defines: ['touch'],
      eyebrow: '06 · Writing the program · one new time, unsorted',
      heading: 'Keep the runs, not the times',
      stand: 'Times arrive one at a time. Keep the runs found so far, and ask what one new time does to them.',
      question: { step: 0, prompt: 'A new time t arrives. Which existing runs could it join?', options: [
        { text: 'Every run whose start or end is within G of t — possibly several.', correct: true, why: 'Two comparisons against a run’s ends decide it, and t can sit close to more than one run.' },
        { text: 'Only the run that comes just before t.', correct: false, why: 'Arriving out of order, t can also land just before a later run, and join that one too.' },
        { text: 'The first run within G, then stop looking.', correct: false, why: 'If t sits between two runs, stopping at the first leaves the second one wrongly apart.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP], add: [TOUCH], step: 1 }),
      cards: [ { step: 2, title: 'It returns a list', html: '<p>A run <b>touches</b> t when <code>t &gt;= start - G</code> and <code>t &lt;= end + G</code>: two comparisons against its ends, never its members. It returns a list, because there may be several.[[src:model]]</p>' } ],
      narration: [
        'Now the times arrive one at a time. The program keeps the runs found so far. A new time arrives: which runs could it join? Choose an answer.',
        'Every run whose start or end is within G of it, and there may be several. Here is touching: two comparisons per run, against the run’s ends, never against its members.',
        'A run that the new time could join is said to touch it. Notice touching returns a list, not one run. That choice is what the next piece depends on.'
      ]
    },

    /* ---------- 7 · absorb ---------- */
    {
      title: 'Join', layout: 'code', defines: ['merge'],
      eyebrow: '07 · Writing the program · joining the touched runs',
      heading: 'Smallest start, largest end, over everything touched',
      stand: 'Arrival 50 touches two runs: 1..3 (50 is 47 after 3) and 90..130 (50 is 40 before 90).',
      question: { step: 0, prompt: 'What single run should replace 1..3, 90..130 and the new time 50?', options: [
        { text: '1..130: the smallest start and the largest end of all of them.', correct: true, why: 'Taking the smallest start and largest end over every touched run plus t works for one, two or ten runs.' },
        { text: '1..50: widen the first run, and leave 90..130 alone.', correct: false, why: 'Then two runs would claim overlapping time. Plausible output, wrong totals.' },
        { text: '50..130: widen the second run, and leave 1..3 alone.', correct: false, why: 'Same mistake from the other side: 1..3 and 50..130 would still be reported as two visits.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH], add: [ABSORB], step: 1 }),
      cards: [ { step: 2, title: 'Merge', html: '<p>Replacing every touched run, and t, with one spanning run is a <b>merge</b>. The same two lines — <code>min</code> of starts, <code>max</code> of ends — handle one, two or ten.[[src:model]]</p>' } ],
      narration: [
        'Arrival 50 touches two runs: 1 to 3, and 90 to 130. What single run should replace them and the new time? Choose an answer.',
        '1 to 130. Here is absorb: it takes the smallest start and the largest end over every touched run plus the new time, and puts that one run in their place. That is called a merge.',
        'The docstring names the trap: stopping at the first match widens one run and leaves the other, so two runs claim overlapping time. Plausible output, wrong totals.'
      ]
    },

    /* ---------- 8 · withdrawn ---------- */
    {
      title: 'Gone', layout: 'code', defines: ['withdraw'],
      eyebrow: '08 · Writing the program · what the reader must be told',
      heading: 'Runs already reported can stop existing',
      stand: 'Before 50 arrived, the reader had been shown 1..3 and 90..130. Now there is only 1..130.',
      question: { step: 0, prompt: 'What must the program tell the reader about 1..3 and 90..130?', options: [
        { text: 'That both are gone, replaced by 1..130.', correct: true, why: 'They were not extended; they no longer exist. A report cannot be unsent, so the output must be able to say so.' },
        { text: 'Nothing: just add 1..130 to what was reported.', correct: false, why: 'Then the reader holds three runs that overlap, and counts one visit as three.' },
        { text: 'That 90..130 now starts at 1, and nothing about 1..3.', correct: false, why: 'Then 1..3 is still on the reader’s list, as a visit that never happened on its own.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB], add: [GONE], step: 1 }),
      cards: [ { step: 2, title: 'Withdraw', html: '<p>To <b>withdraw</b> a run is to tell the reader it no longer exists. The output cannot be a stream of additions only: it has to be revisable.[[src:model]]</p>' } ],
      narration: [
        'Before 50 arrived, the reader had been shown 1 to 3 and 90 to 130. What must the program tell it now? Choose an answer.',
        'That both are gone, replaced by 1 to 130. Here is withdrawn: every run the reader was shown that is not in the new list. Telling the reader a run no longer exists is called withdrawing it.',
        'Nothing can unsend a report, so the output cannot be additions only. It has to be revisable. Now put the pieces together, one arrival at a time.'
      ]
    },

    /* ---------- 9 · incremental ---------- */
    {
      title: 'Loop', layout: 'code', defines: ['trace'],
      eyebrow: '09 · Writing the program · one arrival at a time',
      heading: 'Absorb each arrival, and record what changed',
      stand: 'The streaming answer: take each arrival in turn, absorb it, and note what the reader must be told.',
      question: { step: 0, prompt: 'How can the program label each arrival as new, extending or merging?', options: [
        { text: 'By how many runs it touched: none, one, or two or more.', correct: true, why: 'None starts a run, one extends it, and two or more is a merge. The list from touching already says which.' },
        { text: 'By whether the time is larger than every earlier time.', correct: false, why: '50 is smaller than earlier times and merges; 245 is larger and starts a new run. Size does not decide.' },
        { text: 'By comparing the time with the sorted answer.', correct: false, why: 'The sorted answer needs every time, and they have not all arrived yet.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB, GONE], add: [INCR], step: 1 }),
      cards: [ { step: 2, title: 'A trace', html: '<p>Each step’s record — time, label, runs touched, runs now, runs withdrawn — is kept in a <b>trace</b>, which <code>main</code> prints. The label is <code>MERGE</code> when two or more runs were touched.[[src:trace]]</p>' } ],
      narration: [
        'Now the loop. How can the program label each arrival as new, extending, or merging? Choose an answer.',
        'By how many runs it touched. Here is incremental: for each arrival it calls absorb, labels the step, and records what the reader must be told.',
        'The records form a trace: a step-by-step log the program prints. Let us watch what it records for our nine arrivals.'
      ]
    },

    /* ---------- 10 · the trace, animated ---------- */
    {
      title: 'Trace', layout: 'array',
      eyebrow: '10 · Watch the nine arrivals, as the program records them',
      heading: 'Four new runs, four extensions, one merge — and six withdrawals',
      stand: 'Read from the program’s own printed trace. Every widened run is also withdrawn, because a run is named by its ends.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'time', values: TRACE.map(x => x.t) },
          { label: 'runs touched', values: TRACE.map(x => x.touched) },
          { label: 'label', values: TRACE.map(x => x.act) },
          { label: 'withdrawn', values: TRACE.map(x => x.gone) }
        ],
        meters: ['arrivals', 'runs withdrawn'],
        actions: [
          { step: 0, do: 'show', rows: [0, 1, 2] },
          { step: 1, do: 'pick', slots: [7] },
          { step: 2, do: 'show', rows: [3] },
          { step: 2, do: 'sweep', row: 3, mode: 'sum', readMeter: 0, resultMeter: 1, speed: 450 }
        ]
      },
      cards: [
        { step: 1, title: 'Arrival 50', html: '<p>Touches 1..3 and 90..130, and turns them into 1..130. Runs now: 1..130, 220..260.[[src:trace]]</p>' },
        { step: 2, title: '6 withdrawn', html: '<p>Every extension withdraws the run it widened, and the merge withdraws two: 1 + 1 + 1 + 1 + 2 = <b>6</b>.[[src:whole]]</p>' },
        { step: 3, title: 'The start is not a name', html: '<p>245..260 later became 220..260: an <b>earlier</b> start. So “the run starting at 245” cannot be how the reader finds it.[[src:model]]</p>' }
      ],
      narration: [
        'Here is the trace, read from the program’s own output. Times that touch nothing start a run; times that touch one extend it.',
        'Arrival 50, highlighted, is the only one that touches two runs. It turns 1 to 3 and 90 to 130 into one run, 1 to 130.',
        'Now count the withdrawals. Each extension withdraws the run it widened, and the merge withdraws two. Watch the counter reach 6.',
        'And look at 220: it widened 245 to 260 into 220 to 260, an earlier start. So the start cannot be how the reader names a run. A stable name must be given when a run is born.'
      ]
    },

    /* ---------- 11 · main, the core check ---------- */
    {
      title: 'Check', layout: 'code',
      eyebrow: '11 · Writing the program · proving it',
      heading: 'The streaming answer must equal the sorted one',
      stand: 'main runs both answers on the same nine times.',
      question: { step: 0, prompt: 'Which single check best proves the one-at-a-time answer is right?', options: [
        { text: 'It ends equal to the sorted sweep.', correct: true, why: 'The sweep is simple and obviously right once all times are in. Any bug in touching or absorb shows as a difference.' },
        { text: 'It printed no error while running.', correct: false, why: 'Stopping at the first match prints no error either. It just gives plausible, wrong runs.' },
        { text: 'It produced exactly three runs.', correct: false, why: 'A wrong program can also produce three runs. The runs themselves must match, not just how many.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB, GONE, INCR], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Equal', html: '<p>Sorted sweep: [(1, 130), (220, 260), (540, 540)]. Incremental: the same. The asserts also check the arrivals really are out of order, and that the gap really splits them.[[src:trace]]</p>' } ],
      narration: [
        'Now main, which proves it. Which single check best proves the one-at-a-time answer is right? Choose an answer.',
        'That it ends equal to the sorted sweep. Here main prints the trace, then asserts the incremental answer equals the sweep: 1 to 130, 220 to 260, and 540.',
        'It also asserts the arrivals really are out of order, and that the gap really splits them. A test on sorted data would prove nothing about the hard case.'
      ]
    },

    /* ---------- 12 · main, the details ---------- */
    {
      title: 'Count', layout: 'code',
      eyebrow: '12 · Writing the program · checking every claim',
      heading: 'One merge, six withdrawals, and the gap at 120',
      stand: 'The next lines assert each number the trace showed, then rerun everything at the chapter’s usual gap of 120.',
      question: { step: 0, prompt: 'Why does the program also run the same times with a gap of 120?', options: [
        { text: 'To show the merge disappears there: G is a choice, not a fact.', correct: true, why: 'At 120 nothing joins two runs. So the 47 was chosen to make the hard case happen, and the program says so.' },
        { text: 'To check that 120 gives the same runs as 47.', correct: false, why: 'It does not: at 120 the runs are 1..260 and 540..540. The program asserts that difference.' },
        { text: 'Because 120 is the correct gap for a door log.', correct: false, why: 'No gap is correct by itself. What counts as one visit is a decision for the question.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB, GONE, INCR, MAIN1], add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'Measured, and corrected', html: '<p>The comments say the 6 and the two earlier starts were <b>measured</b>, not first expected. At 120: 0 merges, runs [(1, 260), (540, 540)].[[src:whole]]</p>' } ],
      narration: [
        'These lines assert each number the trace showed. Then the program reruns everything with a gap of 120. Why? Choose an answer.',
        'To show the merge disappears there. At 120 the runs are 1 to 260 and 540, with no merge at all. The 47 was chosen so the hard case happens, and the program proves it.',
        'Read the comments: the 6 withdrawals and the two earlier starts were measured, and the first expectation was corrected. A check that can fail is worth more than a claim.'
      ]
    },

    /* ---------- 13 · the three variations ---------- */
    {
      title: 'Vary', layout: 'code',
      eyebrow: '13 · Writing the program · the same idea, three other ways',
      heading: 'A calendar, an island count, and a pager',
      stand: 'The file also holds the three variations the chapter asks next, each with a small check. Each gets its own part.',
      question: { step: 0, prompt: 'A calendar must allow cancelling a meeting. Why can it not store merged runs, as the door log does?', options: [
        { text: 'A merged run forgets where one meeting ended and the next began.', correct: true, why: 'Merging keeps only the ends. Cancelling needs the boundary between two meetings, which the merge threw away.' },
        { text: 'Merged runs take too much memory for a calendar.', correct: false, why: 'They take less, not more. The problem is what they forget, not their size.' },
        { text: 'Meetings never touch, so nothing would ever merge.', correct: false, why: 'Back-to-back meetings touch all the time, and are shown as one busy block.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB, GONE, INCR, MAIN1, MAIN2], add: [VARS, MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'Three surfaces, one shape', html: '<p>Calendar: keep the bookings, merge only to display. Islands: count only, so +1, 0 or −1 per position. Pager: pages sent while an incident is open can turn out to be two for one.[[src:vars]]</p>' } ],
      narration: [
        'The file also holds three variations of the same problem. The first is a calendar where meetings can be cancelled. Why can it not store merged runs, as the door log does? Choose an answer.',
        'Because a merged run forgets where one meeting ended and the next began. Here are the three functions and their checks: a calendar, an island count, and a pager.',
        'Each wears different nouns over the same shape, and each breaks the simple version in its own way. Parts 5, 6 and 7 build each one with you.'
      ]
    },

    /* ---------- 14 · many random inputs ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '14 · Writing the program · beyond nine numbers',
      heading: 'Check against the slow answer on 800 random inputs',
      stand: 'Nine numbers can hide a bug. The last piece tries many.',
      question: { step: 0, prompt: 'How can the program test its streaming answer on inputs nobody wrote by hand?', options: [
        { text: 'Generate random times and gaps, and compare with the sorted sweep each time.', correct: true, why: 'The sweep is the trusted answer. Hundreds of random cases reach shapes no person thinks to write.' },
        { text: 'Run the nine times again, many times over.', correct: false, why: 'The same input gives the same output. Repeating it finds nothing new.' },
        { text: 'Print the runs and check them by eye.', correct: false, why: 'By eye, a run that stops at the first match looks perfectly plausible. That is the bug to catch.' } ] },
      code: P.build({ before: [DATA, ASC, SWEEP, TOUCH, ABSORB, GONE, INCR, MAIN1, MAIN2, VARS, MAIN3], add: [MAIN4], step: 1 }),
      cards: [ { step: 2, title: '800 cases, 286 merges', html: '<p>Every random case equals the sorted sweep, and 286 merges happened among them, so the hard path was really tested. It also asserts at least one merge was seen.[[src:whole]]</p>' } ],
      narration: [
        'Nine numbers can hide a bug. How can the program test its streaming answer on inputs nobody wrote by hand? Choose an answer.',
        'Generate random times and gaps, and compare with the sorted sweep each time. Here it does 800 of them, from a fixed seed so the run repeats exactly.',
        'Every case matches, and 286 merges happened among them. It even asserts that some merge happened, so the hard path cannot quietly go untested.'
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
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written, and why.',
        'From the top: the data, the sorted sweep, touching, absorb, withdrawn, the loop, the three variations, and main with all its checks.'
      ]
    },

    /* ---------- 16 · what it prints ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '16 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch04.py prints'),
      narration: [
        'And here is what it prints. Each arrival’s line shows its label, the runs it touched, the runs after it, and what was withdrawn. Arrival 50 is the merge.',
        'Then the two answers, equal; the 6 withdrawals; the gap of 120 with no merge; the three variations; and the 800 random cases. The last line says every assertion passed.'
      ]
    },

    /* ---------- 17 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '17 · What you built',
      heading: 'Keep the runs, merge everything touched, and say what was withdrawn',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>sweep</code>', 'sort, then one comparison per time — right only at the end', '1..130, 220..260, 540..540'] },
          { step: 0, cells: ['<code>touching</code>', 'every run within G of the new time, as a list', '50 touches 2 runs'] },
          { step: 1, cells: ['<code>absorb</code>', 'smallest start, largest end over all touched runs', '1..3 + 90..130 → 1..130'] },
          { step: 1, cells: ['<code>withdrawn</code>', 'runs the reader saw that no longer exist', '6 in all'] },
          { step: 2, cells: ['<code>incremental</code> · <code>main</code>', 'one arrival at a time; equal to the sweep; 800 random checks', '286 merges seen'] }
        ]
      },
      side: { step: 3, title: 'Two things the code cannot fix', html: '<p>A run’s start can move earlier, so a stable name must be given when it is born. And runs are never dropped: deciding how late a time may be is what lets this run for a year.[[src:model]]</p><p>Next: the calendar, where cancelling splits a run.</p>' },
      narration: [
        'To recap. Sweep is the answer once everything has arrived. Touching finds every run within G of a new time, as a list, because there may be two.',
        'Absorb merges them into one, with the smallest start and largest end. Withdrawn says which reported runs no longer exist: 6 in all.',
        'Incremental does this one arrival at a time, and main proves it equals the sweep, here and on 800 random inputs.',
        'Two things the code cannot fix: a run’s start moves, so it needs a name given at birth; and runs are never dropped, so someone must decide how late a time may be. Next: the calendar.'
      ]
    }
  ]
};
