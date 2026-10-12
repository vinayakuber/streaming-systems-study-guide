// Chapter 8, Part 5 — the chapter's two "Interview Questions", each told as a story and probed
// from several sides (what goes wrong and why, which clause fixes it, what breaks if a piece is
// skipped, the same question with other numbers), with its code snippet built clause by clause,
// a question before each piece. Then the chapter quiz and a recap. The snippet lines come from
// the chapter source (content/ch08-*.js) through _prog.js, addressed by content, never retyped.
// The story, the two clocks and every word are re-introduced, so the deck stands alone.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { snippet } = require('./_prog');
const seed = require('../../tools/stream_seed.js');

const CH = 'ch08';
const Q1 = snippet(CH, 0), Q2 = snippet(CH, 1);
const Q1_QUERY = [Q1.at('SELECT window_start'), Q1.at('GROUP BY TUMBLE')];
const Q1_EMIT = [Q1.at('emits 15 once the watermark'), Q1.at('then 19 when late id 7')];
const Q2_JOIN = [Q2.at('-- c = the seed'), Q2.at('AND c.et + INTERVAL')];
const Q2_EMIT = [Q2.at('a pair emits once'), Q2.at('min(12:08:00, 12:03:20) = 12:03:20')];

const E = seed.EVENTS;
const hh = seed.hhmmss;
const W = seed.WIN;
const winOf = t => Math.floor(t / W) * W;
const BY_PT0 = E.filter(e => winOf(e.pt) === 0).reduce((n, e) => n + e.v, 0);
const TRUE0 = seed.SUM(seed.WINDOWS[0]);
const CI = seed.closedAt(0), L = seed.LATE[0];
const ONTIME = E.filter((e, i) => i <= CI && winOf(e.et) === 0).reduce((n, e) => n + e.v, 0);
const sideEnd = k => Math.max(...E.filter(e => e.key === k).map(e => e.et)) - seed.LAG;
const P = W / 2;
const hopsOf = et => { const o = []; for (let s = 0; s <= et; s += P) if (et < s + W) o.push(s); return o; };
const HOP_ROWS = new Set(E.flatMap(e => hopsOf(e.et))).size;
const HOP_TOTAL = E.reduce((n, e) => n + e.v * hopsOf(e.et).length, 0);
const CLICKS = E.filter(e => e.key === 'a'), IMPS = E.filter(e => e.key === 'b');
const ptPartners = IMPS.find(i => i.id === 7) && CLICKS.filter(c => Math.abs(c.pt - L.pt) <= seed.LAG).map(c => c.id);

if (Q1.lines.length !== 6 || Q2.lines.length !== 8 || BY_PT0 !== 15 || TRUE0 !== 19 || ONTIME !== 15 || L.id !== 7
  || hh(seed.WATERMARKS[CI]) !== '12:03:05' || hh(L.pt) !== '12:04:40' || hh(sideEnd('a')) !== '12:08:00' || hh(sideEnd('b')) !== '12:03:20'
  || HOP_ROWS !== 7 || HOP_TOTAL !== 78 || ptPartners.join() !== '4' || seed.SESSIONS.a.length + seed.SESSIONS.b.length !== 5)
  throw new Error('seed no longer matches the numbers this deck explains — rewrite the narration');

module.exports = {
  title: 'Streaming SQL Drill',
  eyebrow: 'Streaming · Ch 8 · Part 5',
  ...shared,
  voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, 'TUMBLE': 'tumble', 'HOP': 'hop', 'SESSION': 'session', 'OVER': 'over', 'GROUP BY': 'group by' } },
  jargon: ['event', 'stream', 'value', 'SQL', 'query', 'impression', 'event time', 'processing time', 'out of order', 'window',
    'time attribute', 'tumble', 'continuous query', 'watermark', 'emit', 'late', 'updating', 'retraction', 'hop', 'session',
    'join', 'windowed join'],
  sources: {
    ch:    chapter(CH, 'Chapter 8 on GitHub'),
    sql:   section(CH, 'Why streaming SQL is relational SQL plus a column that is a clock', 'Chapter 8 · a column that is a clock'),
    win:   section(CH, 'Why the three window functions are three different cost profiles', 'Chapter 8 · three window functions'),
    join:  section(CH, 'Why a join is where the time decisions cost the most', 'Chapter 8 · why joins cost the most'),
    sys:   section(CH, 'Why the sink requirement is readable from the query, and the timing is not', 'Chapter 8 · the continuous query'),
    q1:    section(CH, 'Q1', 'Chapter 8 · interview question 1'),
    q2:    section(CH, 'Q2', 'Chapter 8 · interview question 2'),
    quiz:  section(CH, 'Quiz', 'Chapter 8 · quiz'),
    kf:    section(CH, 'Key Facts', 'Chapter 8 · key facts')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['event', 'stream', 'value', 'SQL', 'query', 'impression'],
      eyebrow: '01 · Chapter 8 · Part 5 · the interview questions',
      heading: 'Two interview questions, asked from every side',
      hero: { step: 0, text: 'A company counts clicks on its adverts. Messages saying “some clicks happened” arrive from two sources, a and b: each is an <b>event</b> carrying a <b>value</b>, how many clicks, and they never stop: a <b>stream</b>. A showing of an advert is an <b>impression</b>. Analysts want to ask questions — <b>queries</b> — in <b>SQL</b>, the everyday language for data.[[src:q1]]' },
      tiles: [
        { step: 1, value: 9, label: 'events in the chapter’s example' },
        { step: 1, value: 2, label: 'interview questions, each probed from several sides' },
        { step: 2, value: 5, label: 'questions in the chapter quiz[[src:quiz]]' },
        { step: 2, value: TRUE0, label: 'clicks that really happened from 12:00 to 12:02[[src:q1]]' }
      ],
      cardsLabel: 'The two interview questions',
      cards: [
        { step: 3, n: 1, title: 'A total that must be right', text: 'Analysts write click totals in SQL over a live stream; events arrive jumbled.' },
        { step: 4, n: 2, title: 'Matches that go out too soon', text: 'Clicks paired with impressions are sent out while an impression is still on its way.' }
      ],
      note: { step: 4, text: 'You answer first, every time. Then the chapter’s answer, then the next angle on the same question.[[src:q1]]' },
      narration: [
        'A company counts clicks on its adverts. Each message saying some clicks happened is an event, carrying a value; they never stop, forming a stream. A showing of an advert is called an impression.',
        'Analysts ask questions, called queries, in SQL, the everyday language for data. Our example has 9 events. This part takes the chapter’s 2 interview questions, from several sides.',
        'Then it asks the 5 questions of the chapter quiz. Keep one number in mind: from 12:00 to 12:02, 19 clicks really happened.',
        'Question 1: analysts want click totals written in SQL over a live stream, and the results must be right even though events arrive jumbled, not in the order they happened.',
        'Question 2: a query joining clicks with impressions sends out matches while an impression is still on its way. You will answer first, every time.'
      ]
    },

    /* ---------- 2 · the two clocks ---------- */
    {
      title: 'Time', layout: 'table', defines: ['event time', 'processing time', 'out of order'],
      eyebrow: '02 · The nine events, and two clocks on each',
      heading: 'When it happened is not when it was seen',
      stand: 'The events in the order they arrive. Source a is the clicks; source b, in question 2, the impressions.',
      table: {
        columns: ['id', 'source', 'et · happened at', 'pt · seen', 'v · value'],
        rows: E.map((e, i) => ({ step: i < 4 ? 0 : i < 7 ? 1 : 2,
          cells: [`${e.id}`, e.key, i === 6 || i === 7 ? `<b>${hh(e.et)}</b>` : hh(e.et),
            i === 7 ? `<b>${e.pt - e.et} s later</b> · ${hh(e.pt)}` : i === 4 ? `${e.pt - e.et} s later · ${hh(e.pt)}` : `${e.pt - e.et} s later`, `${e.v}`] }))
      },
      side: { step: 3, title: 'Two clocks, used from now on', html: '<ul class="l"><li><b>Event time</b> (et) — when it happened.</li><li><b>Processing time</b> (pt) — when the message was seen.</li><li><b>Out of order</b> — an event that happened earlier than one already seen. Ids 6 and 7 are.[[src:sql]]</li></ul>' },
      narration: [
        'Each event carries two times. The first, et, is when it happened: its event time. The second, pt, is when the message was seen: its processing time. Most are seen within seconds.',
        'Id 4 happened at 12:04:05 and is seen at 12:04:06. Id 6 happened at 12:03:40, earlier than id 5, but arrives after it.',
        'And id 7 happened at 12:00:50 but is seen only at 12:04:40, 230 seconds later.',
        'An event that happened earlier than one already seen is called out of order. Ids 6 and 7 are. Every question below turns on id 7.'
      ]
    },

    /* ---------- 3 · Q1: what goes wrong ---------- */
    {
      title: 'Bad', layout: 'ask', defines: ['window', 'time attribute'],
      eyebrow: '03 · Interview question 1 · what goes wrong, and why',
      heading: 'A total cut by the wrong clock',
      stand: 'An analyst totals the clicks per 2-minute slice, cutting time by pt, the moment each message was seen.',
      question: {
        step: 0,
        prompt: 'What does that query report for 12:00 to 12:02, when 19 clicks really happened?',
        options: [
          { text: '15, for ever: id 7 is counted in a later slice, where it was seen.', correct: true,
            why: 'Cut by the time it was seen, id 7 lands in 12:04 to 12:06. The first slice never gets its 4 clicks.' },
          { text: '19: every click is counted somewhere, so the total is right.', correct: false,
            why: 'Counted, yes, but in the wrong slice. The question asks about 12:00 to 12:02.' },
          { text: 'Nothing: SQL refuses to cut time by the moment it was seen.', correct: false,
            why: 'It accepts it happily. Both clocks are valid columns and give different answers.' }
        ]
      },
      cards: [
        { step: 1, title: 'Window and time attribute', html: '<p>Each slice is a <b>window</b>. The column it is cut by is the <b>time attribute</b>. By pt, window 12:00 to 12:02 holds ' + BY_PT0 + '; by et, ' + TRUE0 + '.[[src:sql]]</p>' },
        { step: 2, title: 'Valid, and wrong', html: '<p>Both queries are valid SQL producing valid results, and no engine can flag the wrong one. Default to event time.[[src:sql]]</p>' }
      ],
      narration: [
        'Interview question 1, first angle: what goes wrong? An analyst totals clicks per 2-minute slice, cutting by pt, the moment each was seen. What does it report for 12:00 to 12:02? Choose an answer.',
        '15, for ever. Each slice is called a window, and the column it is cut by is the time attribute. By processing time, id 7 lands in a later window, where it was seen.',
        'And nothing complains: both queries are valid SQL with valid results. So the time attribute should default to event time, which answers questions about the world, not about the pipeline.'
      ]
    },

    /* ---------- 4 · Q1: the snippet, the query ---------- */
    {
      title: 'SQL', layout: 'code', defines: ['tumble', 'continuous query'],
      eyebrow: '04 · Interview question 1 · which clause · the snippet, lines 1–3',
      heading: 'One total per window of event time',
      stand: 'The interviewer asks: how do you expose this as SQL with correct event-time meaning?',
      question: { step: 0, prompt: 'Which column should the query’s window be cut by?', options: [
        { text: 'et, the time each event happened.', correct: true, why: 'Then id 7 lands in 12:00 to 12:02 whenever it arrives, and the total can reach 19.' },
        { text: 'pt, the time each message was seen.', correct: false, why: 'That is the query that reports 15 for ever. It describes the pipeline, not the clicks.' },
        { text: 'Neither: the query should count arrivals.', correct: false, why: 'Counting arrivals has no time slices at all. The question asks for totals per 2 minutes.' } ] },
      code: Q1.build({ add: [Q1_QUERY], step: 1 }),
      cards: [ { step: 2, title: 'TUMBLE, run forever', html: '<p><b>TUMBLE</b> cuts time into equal 120 s windows that never overlap. Over a stream the query never finishes: it is a <b>continuous query</b>, keeping each total up to date.[[src:q1]]</p>' } ],
      narration: [
        'Second angle: which clause? Which column should the query’s window be cut by? Choose an answer.',
        'Event time. Here are the snippet’s first three lines: the sum of the values, from the clicks, grouped by TUMBLE on et, with an interval of 120 seconds.',
        'TUMBLE cuts time into equal 2-minute windows that never overlap. And over a stream this query never finishes: it is a continuous query, keeping every total up to date.'
      ]
    },

    /* ---------- 5 · Q1: the snippet, when it speaks ---------- */
    {
      title: 'Emit', layout: 'code', defines: ['watermark', 'emit', 'late', 'updating', 'retraction'],
      eyebrow: '05 · Interview question 1 · the snippet, lines 4–6',
      heading: 'When the total for 12:00 to 12:02 goes out',
      stand: 'The engine, the program running the query, keeps a guess called the watermark: the latest event time seen, minus 60 s.',
      question: { step: 0, prompt: 'When may the engine send out the total for 12:00 to 12:02?', options: [
        { text: 'When the watermark passes 12:02, the end of the window.', correct: true, why: 'Then the engine believes nothing earlier is still coming. Here that happens after id 4: 12:04:05 minus 60 s gives 12:03:05.' },
        { text: 'When the wall clock passes 12:02.', correct: false, why: 'At 12:02 on the wall, id 7 from 12:00:50 is still on its way. The wall clock cannot know that.' },
        { text: 'Only when the stream ends, so it is never wrong.', correct: false, why: 'The stream never ends, so no total would ever be sent.' } ] },
      code: Q1.build({ before: [Q1_QUERY], add: [Q1_EMIT], step: 1 }),
      cards: [ { step: 2, title: 'Emit, retract, update', html: '<p>Watermark 12:03:05 after id 4, past 12:02: 15 is <b>emitted</b>. Id 7 arrives <b>late</b>, at 12:04:40: 15 is withdrawn, a <b>retraction</b>, and 19 sent. A result that changes like this is <b>updating</b>.[[src:q1]]</p>' } ],
      narration: [
        'The engine keeps a guess called the watermark: the latest event time seen, minus 60 seconds. When may it send out the total for 12:00 to 12:02? Choose an answer.',
        'When the watermark passes 12:02. Here are the last three lines. After id 4 the watermark jumps to 12:03:05, the first value past 12:02, so the engine emits, sends out, 15.',
        'Then id 7 arrives at 12:04:40, after its window was sent: it is late. The engine withdraws 15, called a retraction, and sends 19.',
        'A result whose rows change after being sent is called updating. So whatever stores these totals must be able to replace a row, not only add one.'
      ]
    },

    /* ---------- 6 · Q1: without the watermark ---------- */
    {
      title: 'NoWM', layout: 'ask',
      eyebrow: '06 · Interview question 1 · what breaks if you skip a piece',
      heading: 'The same query, with no watermark at all',
      stand: 'Suppose the engine kept no watermark: it has no rule for deciding a window is done.',
      question: {
        step: 0,
        prompt: 'Over a stream that never ends, what would this windowed query send out?',
        options: [
          { text: 'Nothing, ever: “this window is done” would never become true.', correct: true,
            why: 'Without a watermark nothing ever says a window is complete, so no total is ever sent.' },
          { text: 'Each total once 2 minutes of wall-clock time have passed.', correct: false,
            why: 'That is a different rule, and id 7 shows it is wrong: its clicks are still on their way.' },
          { text: 'The same as before: the window itself decides when it is done.', correct: false,
            why: 'The window only says which slice a row belongs to. When the slice speaks is the watermark’s job.' }
        ]
      },
      cards: [
        { step: 1, title: 'Bucket and moment', html: '<p>The time attribute picks the bucket; the watermark picks the moment the bucket speaks. Both are needed, and only one is written in the SQL.[[src:win]]</p>' }
      ],
      narration: [
        'Third angle: what breaks if you skip a piece? Suppose the engine kept no watermark at all. What would this windowed query send out? Choose an answer.',
        'Nothing, ever. Without a watermark, “this window is done” never becomes true. The time attribute picks the bucket; the watermark picks the moment it speaks. Only the first is in the SQL.'
      ]
    },

    /* ---------- 7 · Q1: other window shapes ---------- */
    {
      title: 'Hop', layout: 'ask', defines: ['hop', 'session'],
      eyebrow: '07 · Interview question 1 · the same question, other window shapes',
      heading: 'Swap TUMBLE for HOP',
      stand: 'HOP makes 2-minute windows that start every minute, so they overlap. The 9 events hold 45 clicks.',
      question: {
        step: 0,
        prompt: 'With HOP, a 60 s step and a 120 s length, how many rows come out, and what do they total?',
        options: [
          { text: '7 rows, totalling 78: most events sit in 2 overlapping windows.', correct: true,
            why: '6 of the 9 events land in 2 windows each. Every row is right; their total is not a count of clicks.' },
          { text: '4 rows, totalling 45, exactly as with TUMBLE.', correct: false,
            why: 'Overlapping windows count most events twice, so both the rows and the total grow.' },
          { text: '7 rows, totalling 45: overlaps are counted only once.', correct: false,
            why: 'Each window counts every event inside it. An event in two windows is in both totals.' }
        ]
      },
      cards: [
        { step: 1, title: 'Never compare with 45', html: '<p>HOP gives ' + HOP_ROWS + ' rows totalling ' + HOP_TOTAL + ': correct, and incomparable with the data’s 45. Budget twice the rows.[[src:win]]</p>' },
        { step: 2, title: 'And SESSION', html: '<p><b>SESSION</b> makes one window per burst of activity, ended by 120 s of silence: 5 rows here, a count no query can predict.[[src:win]]</p>' }
      ],
      narration: [
        'Fourth angle: the same question with another window shape. HOP makes 2-minute windows that start every minute, so they overlap. How many rows come out, and what do they total? Choose an answer.',
        'Seven rows, totalling 78, from data holding 45 clicks. Six of the nine events sit in two overlapping windows. Every row is right; just never compare the total with 45.',
        'The third shape, SESSION, makes one window per burst of activity, ended by 2 minutes of silence. Here that gives 5 rows, a count nobody could predict from the query.'
      ]
    },

    /* ---------- 8 · Q2: the story ---------- */
    {
      title: 'Join', layout: 'ask', defines: ['join'],
      eyebrow: '08 · Interview question 2 · the story, and what goes wrong',
      heading: 'A join that answers too soon',
      stand: 'A query pairs clicks (source a) with impressions (source b) that happened close in time. It sends out matches before a late impression could still arrive, so rows come out incomplete.',
      question: {
        step: 0,
        prompt: 'Why are those rows incomplete?',
        options: [
          { text: 'A match was sent before both streams were complete for its time.', correct: true,
            why: 'Impression 7 happened at 12:00:50 but arrives at 12:04:40. Anything sent before then misses it.' },
          { text: 'Clicks and impressions can never be matched in SQL.', correct: false,
            why: 'They can. The problem is when the matches are sent, not whether they can be found.' },
          { text: 'The impressions stream has too few events.', correct: false,
            why: 'Four impressions is plenty. One of them simply arrives late.' }
        ]
      },
      cards: [
        { step: 1, title: 'A join', html: '<p>Pairing rows from two inputs is a <b>join</b>. Over two endless streams it never completes on its own: either side may still send a match.[[src:join]]</p>' }
      ],
      narration: [
        'Interview question 2. A query pairs clicks with impressions that happened close in time, but sends out matches before a late impression could arrive. Why are those rows incomplete? Choose an answer.',
        'A match was sent before both streams were complete for its time. Pairing rows from two inputs is called a join, and over two endless streams it never completes on its own.'
      ]
    },

    /* ---------- 9 · Q2: the snippet, the bound ---------- */
    {
      title: 'Bound', layout: 'code', defines: ['windowed join'],
      eyebrow: '09 · Interview question 2 · which clause · the snippet, lines 1–5',
      heading: 'Match only within 60 seconds',
      stand: 'The interviewer asks: how do you make a stream-to-stream join correct under out-of-order data?',
      question: { step: 0, prompt: 'What should limit which click and impression can match?', options: [
        { text: 'Their event times must be within 60 s of each other.', correct: true, why: 'That defines a match by when things happened, and gives every row a point after which it can no longer match.' },
        { text: 'They must arrive within 60 s of each other.', correct: false, why: 'Arrival time pairs impression 7 with the wrong click. The limit must be on event time.' },
        { text: 'No limit: every click may match any impression.', correct: false, why: 'Then no row could ever be forgotten, and no match would ever be final.' } ] },
      code: Q2.build({ add: [Q2_JOIN], step: 1 }),
      cards: [ { step: 2, title: 'A windowed join', html: '<p>Joining rows whose times fall within a limit of each other is a <b>windowed join</b>. The limit ends the wait and bounds what must be kept.[[src:q2]]</p>' } ],
      narration: [
        'Second angle: which clause? What should limit which click and impression can match? Choose an answer.',
        'Their event times must be within 60 seconds of each other. Here are the snippet’s first five lines: a comment saying source a’s rows play the clicks and source b’s the impressions, then the impression’s event time between the click’s minus 60 seconds and plus 60 seconds.',
        'A join with a time limit like this is called a windowed join. The limit does two jobs: it ends the wait for matches, and it bounds the rows the engine must keep.'
      ]
    },

    /* ---------- 10 · Q2: the snippet, when it emits ---------- */
    {
      title: 'Both', layout: 'code',
      eyebrow: '10 · Interview question 2 · the snippet, lines 6–8',
      heading: 'Two streams, two watermarks',
      stand: 'Each stream has its own watermark. At the end, the clicks’ has reached 12:08:00 and the impressions’ only 12:03:20.',
      question: { step: 0, prompt: 'Which watermark decides when a match may be sent?', options: [
        { text: 'The lower of the two, 12:03:20.', correct: true, why: 'A match could still come from the slower stream, so the join can claim no more than its least complete input.' },
        { text: 'The higher of the two, 12:08:00.', correct: false, why: 'The fast clicks stream says nothing about impressions still on their way, like impression 7 was.' },
        { text: 'Whichever stream sent the last event.', correct: false, why: 'Arriving last says nothing about what the other stream still has in transit.' } ] },
      code: Q2.build({ before: [Q2_JOIN], add: [Q2_EMIT], step: 1 }),
      cards: [ { step: 2, title: 'Both sides must pass', html: '<p>A match goes out only when <b>both</b> streams’ watermarks pass its limit, the click’s event time plus 60 s. At the end of the run the lower one is min(12:08:00, 12:03:20) = 12:03:20.[[src:q2]]</p>' } ],
      narration: [
        'Each stream has its own watermark: at the end, 12:08:00 for the clicks and 12:03:20 for the impressions. Which one decides when a match may be sent? Choose an answer.',
        'The lower one. Here are the last three lines: a match goes out once the join’s watermark, the lower of the two, passes that click’s event time plus 60 seconds. At the end of the run that is the minimum of 12:08:00 and 12:03:20: 12:03:20.',
        'So a match goes out only when both streams are complete for it. That is what keeps a late impression from being missed.'
      ]
    },

    /* ---------- 11 · Q2: an idle side ---------- */
    {
      title: 'Idle', layout: 'ask',
      eyebrow: '11 · Interview question 2 · what it costs',
      heading: 'The impressions stream goes quiet',
      stand: 'After 12:04:40 no impression arrives, while clicks keep coming.',
      question: {
        step: 0,
        prompt: 'What happens to matches that are waiting to be sent?',
        options: [
          { text: 'They wait: the join’s watermark is stuck at the quiet stream’s.', correct: true,
            why: 'The join takes the lower watermark, and the quiet stream’s never moves. Correctness is paid for in waiting.' },
          { text: 'They are sent, because the clicks stream keeps moving.', correct: false,
            why: 'The busy stream cannot vouch for the quiet one: an old impression might still arrive.' },
          { text: 'They are thrown away after 60 seconds.', correct: false,
            why: 'The 60 seconds decides what counts as a match, not when a found match is dropped.' }
        ]
      },
      cards: [
        { step: 1, title: 'The price of correctness', html: '<p>A join has two inputs by construction, so one slow or idle side holds back every result, however fast the other is.[[src:join]]</p>' }
      ],
      narration: [
        'Third angle: what does it cost? After 12:04:40 no impression arrives, while clicks keep coming. What happens to matches waiting to be sent? Choose an answer.',
        'They wait. The join’s watermark is the lower one, and the quiet stream’s never moves. A join always has two inputs, so one slow or idle side holds back every result.'
      ]
    },

    /* ---------- 12 · Q2: the other clock ---------- */
    {
      title: 'Pair', layout: 'ask',
      eyebrow: '12 · Interview question 2 · the same join, the other clock',
      heading: 'The 60-second limit, on the time things were seen',
      stand: 'Someone writes the limit on pt instead of et. Impression 7 happened at 12:00:50, but was seen at 12:04:40.',
      question: {
        step: 0,
        prompt: 'On processing time, which click does impression 7 match?',
        options: [
          { text: 'Click 4, seen at 12:04:06, which happened over 3 minutes later.', correct: true,
            why: 'On the arrival clock they sit together. In the world they were minutes apart: a false coincidence.' },
          { text: 'Clicks 0 and 1, the same as on event time, since nothing else changed.', correct: false,
            why: 'Those were seen around 12:00, far from 12:04:40, so on this clock they no longer match.' },
          { text: 'None: on this clock a late impression cannot match anything at all.', correct: false,
            why: 'On processing time nothing is late, by definition. That is exactly why it pairs the wrong rows.' }
        ]
      },
      cards: [
        { step: 1, title: 'Worse than a wrong total', html: '<p>A wrong clock in a total is a wrong number in a known place. In a join it pairs the wrong rows, placing impression 7 230 s from when it happened, and the row looks plausible.[[src:join]]</p>' }
      ],
      narration: [
        'Last angle: the same join with the other clock. On processing time, which click does impression 7, seen at 12:04:40, match? Choose an answer.',
        'Click 4, seen at 12:04:06, which happened more than 3 minutes after the impression. A wrong clock in a total gives a wrong number; in a join it states that two things happened together when they did not.'
      ]
    },

    /* ---------- 13 · quiz 1 ---------- */
    {
      title: 'Qz1', layout: 'ask',
      eyebrow: '13 · Chapter quiz · 1 of 5',
      heading: 'What is a continuous query?',
      stand: 'The chapter’s own quiz. Answer from what you have seen.',
      question: {
        step: 0,
        prompt: 'What is a continuous query?',
        options: [
          { text: 'A query that runs once.', correct: false,
            why: 'That is a query over a finished table: it returns and exits.' },
          { text: 'A query that runs forever and emits updated results.', correct: true,
            why: 'Over a stream there is no last row, so the query keeps maintaining its answer.' },
          { text: 'A query over a finished table, run in one batch.', correct: false,
            why: 'A batch query reads a finite table once. A stream is never finished.' },
          { text: 'A query that has no windows in it.', correct: false,
            why: 'Windows have nothing to do with it. The windowed total in question 1 is continuous too.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A continuous query runs forever over the stream, emitting updated results.[[src:quiz]]</p>' } ],
      narration: [
        'The chapter’s quiz, first of five. What is a continuous query? Choose an answer.',
        'A query that runs forever and emits updated results. A query over a finished table returns; a continuous query maintains.'
      ]
    },

    /* ---------- 14 · quiz 2 ---------- */
    {
      title: 'Qz2', layout: 'ask',
      eyebrow: '14 · Chapter quiz · 2 of 5',
      heading: 'Which window is the fixed one?',
      stand: 'Think of the equal 2-minute windows that never overlap.',
      question: {
        step: 0,
        prompt: 'Which SQL window is a fixed, tumbling window?',
        options: [
          { text: 'HOP', correct: false,
            why: 'HOP windows overlap: 120 s long, starting every 60 s.' },
          { text: 'SESSION', correct: false,
            why: 'SESSION windows follow bursts of activity, so their size depends on the data.' },
          { text: 'TUMBLE', correct: true,
            why: 'Equal, side by side, never overlapping: 4 rows, 19, 11, 7 and 8.' },
          { text: 'OVER', correct: false,
            why: 'Not one of the three window functions here. TUMBLE, HOP and SESSION are.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>TUMBLE is the fixed, non-overlapping window.[[src:quiz]]</p>' } ],
      narration: [
        'Second quiz question. Which SQL window is a fixed, tumbling window? Choose an answer.',
        'TUMBLE: equal windows, side by side, never overlapping. HOP overlaps, and SESSION follows bursts of activity.'
      ]
    },

    /* ---------- 15 · quiz 3 ---------- */
    {
      title: 'Qz3', layout: 'ask',
      eyebrow: '15 · Chapter quiz · 3 of 5',
      heading: 'What does a time attribute provide?',
      stand: 'Remember et against pt in question 1.',
      question: {
        step: 0,
        prompt: 'What does a time attribute provide?',
        options: [
          { text: 'A reading of the wall clock.', correct: false,
            why: 'It can be event time, which has nothing to do with the wall clock now.' },
          { text: 'The time column that windows and joins key on.', correct: true,
            why: 'Event time or processing time: it decides which window a row lands in and which rows pair.' },
          { text: 'The size of every window.', correct: false,
            why: 'The size is a separate part of the query, such as 120 seconds.' },
          { text: 'A retraction of an old row.', correct: false,
            why: 'Retractions come from updating results, not from the choice of clock.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>A time attribute tells windows and joins which time to use.[[src:quiz]]</p>' } ],
      narration: [
        'Third quiz question. What does a time attribute provide? Choose an answer.',
        'The time column that windows and joins key on: event time or processing time. In question 1 it decided 19 against 15.'
      ]
    },

    /* ---------- 16 · quiz 4 ---------- */
    {
      title: 'Qz4', layout: 'ask',
      eyebrow: '16 · Chapter quiz · 4 of 5',
      heading: 'What does an updating result require?',
      stand: 'Remember 15 being replaced by 19.',
      question: {
        step: 0,
        prompt: 'An updating query result requires what?',
        options: [
          { text: 'Rows that are only ever appended.', correct: false,
            why: 'That is an append-only result, like a filter’s. An updating one changes rows.' },
          { text: 'A retraction of the old row.', correct: true,
            why: 'When a window’s value changes, the old row, 15, must be withdrawn before 19 replaces it.' },
          { text: 'No destination for its rows at all.', correct: false,
            why: 'It needs one that can replace rows; otherwise it shows 34 for a window worth 19.' },
          { text: 'A finished table to read from.', correct: false,
            why: 'Updating results come from streams, where totals change as late events arrive.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>When a key’s value changes, the old row must be retracted.[[src:quiz]]</p>' } ],
      narration: [
        'Fourth quiz question. An updating query result requires what? Choose an answer.',
        'A retraction of the old row. When the window’s value changes, 15 is withdrawn and 19 takes its place.'
      ]
    },

    /* ---------- 17 · quiz 5 ---------- */
    {
      title: 'Qz5', layout: 'ask',
      eyebrow: '17 · Chapter quiz · 5 of 5',
      heading: 'When does a windowed join emit?',
      stand: 'The last question of the chapter.',
      question: {
        step: 0,
        prompt: 'When does a windowed SQL join emit a match?',
        options: [
          { text: 'When the first row of the pair arrives.', correct: false,
            why: 'Its partner may not have arrived yet, and other matches may still come.' },
          { text: 'When both sides’ watermarks pass the join window.', correct: true,
            why: 'Only then are both streams believed complete for it: the lower watermark, 12:03:20, decides.' },
          { text: 'Every second, whatever has arrived.', correct: false,
            why: 'A timer says nothing about late rows. That is how incomplete matches get out.' },
          { text: 'Once, when the query is started.', correct: false,
            why: 'A continuous query never stops; matches keep coming as data arrives.' }
        ]
      },
      cards: [ { step: 1, title: 'The chapter’s answer', html: '<p>The join waits until both streams are complete for the window.[[src:quiz]]</p>' } ],
      narration: [
        'Last quiz question. When does a windowed SQL join emit a match? Choose an answer.',
        'When both sides’ watermarks pass the join window. Only then are both streams believed complete for it, so the lower watermark decides.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · Chapter 8, and its two interview questions',
      heading: 'Pick the window and the clock; the watermark picks the moment',
      stand: 'The whole chapter, a sentence each.',
      table: {
        columns: ['Idea', 'What it means'],
        rows: [
          { step: 0, cells: ['<b>Continuous query</b>', 'SQL over a stream never finishes; it maintains its answer.[[src:kf]]'] },
          { step: 1, cells: ['<b>Question 1 · event time</b>', 'TUMBLE on et, 120 s: 15 once the watermark passes 12:02, then 19 when late id 7 arrives. On pt, 15 for ever.[[src:q1]]'] },
          { step: 1, cells: ['<b>Window shapes</b>', 'TUMBLE 4 rows; HOP 7 rows totalling 78; SESSION a count no query predicts.[[src:win]]'] },
          { step: 2, cells: ['<b>Question 2 · windowed join</b>', 'Event times within 60 s; emit when min(12:08:00, 12:03:20) = 12:03:20 passes.[[src:q2]]'] },
          { step: 3, cells: ['<b>Mechanics, not meaning</b>', 'The engine runs watermarks and corrections; the window and the clock are yours.[[src:kf]]'] }
        ]
      },
      side: { step: 3, title: 'Next · chapter 9', html: '<p>What a join actually keeps, how much of it, and what happens when a late row changes a match already sent.[[src:ch]]</p>' },
      narration: [
        'To recap the chapter. A query over a stream is continuous: it never finishes, it maintains its answer.',
        'Question 1: cut the window by event time. The first window is emitted as 15 once the watermark passes 12:02, and becomes 19 when late id 7 arrives. HOP and SESSION give other shapes.',
        'Question 2: match clicks and impressions within 60 seconds of event time, and emit only when both watermarks pass: the lower one, 12:03:20, decides.',
        'The engine runs the watermark and the corrections, but the window and the clock are always yours. Chapter 9 looks inside the join itself.'
      ]
    }
  ]
};
