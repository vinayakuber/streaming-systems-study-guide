// Chapter 4, Part 7 — Variation 4 of the interview question, "the deduplicated alert", built
// as a program WITH the viewer. Every code slide asks what the next piece must do, then reveals
// the real lines of programs/ch04_v4.py (read by _prog.js, addressed by content). The last
// slides show the whole file and what it prints (programs/ch04_v4.out).
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch04';
const P = program('ch04_v4.py');
const OUT = program('ch04_v4.out');

const listAt = needle => JSON.parse(P.lines[P.at(needle)].split('=')[1]);
const FIRINGS = listAt('FIRINGS = [1');
const lineOf = needle => OUT.lines.find(l => l.includes(needle));
const TRIGGERS = JSON.parse(lineOf('pages actually sent').split('firings ')[1].replace(')', ''));
// the dial: the six rows of the swept table at CLOSE_AFTER = 47, read from the output
const DIAL = OUT.lines.filter(l => /^\s+47\s+\d+\s+3\s+\d+\s+\d+\s+\d+\s+[\d.]+$/.test(l)).map(l => l.trim().split(/\s+/).map(Number));

// the pieces, in the order they are written
const DATA = [P.at("# The chapter's nine arrival times, unchanged, now read"), P.lines.indexOf('PAGE_AFTER = 2')];
const INPUTS = P.span('# A single firing, the two pairs', 'random.Random(20260303).shuffle');
const EXAMPLES = [P.at('------- WORKED EXAMPLES'), P.block('EXAMPLES = [')[1]];
const SWEEP = P.fn('sweep');
const PAGE = P.fn('page_streaming');
const COVER = P.fn('coverage');
const APP = P.fn('apparent_latencies');
const LAT = P.fn('latencies');
const SHOW = P.fn('show_examples');
const MAIN1 = P.span('def main():', 'so the start is not a usable page identity.');
const MAIN2 = P.span('    # ---- the wide close_after', 'That is the degenerate end of the same dial.');
const MAIN3 = P.span('    # ---- is there a setting that gives everything', 'sweep can hand you a pair that has neither.');
const MAIN4 = P.span('    # ---- many random firing orders', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ['all 16 examples agree with the retrospective sweep',
  'incidents, in the morning : [(1, 130), (220, 260), (540, 540)]',
  'pages actually sent       : [1, 90, 245] (triggered by firings [3, 130, 260])', 'double pages              : 1',
  'page latency as the pager measured it   : [2, 40, 15] (mean 19.0)',
  'page latency against the TRUE start     : [2, 129, 40] (mean 57.0)',
  "at CLOSE_AFTER = 120 (the chapter's other gap): incidents [(1, 260), (540, 540)],",
  'swept 4,961 (CLOSE_AFTER, PAGE_AFTER) pairs', '3 pairs work: [(87, 0), (88, 0), (89, 0)]',
  'reorder the same nine firings to [90, 220, 1, 3, 260, 245, 130, 540, 50]',
  'but the PAGES differ on 192 of them', '22 streams double-paged and', '578 did not',
  'the same nine, in time order                      9     2     47     3      2    0',
  '1,000 firings shuffled, paging at once         1000     0     47     1     52   51',
  '1,000 shuffled, waiting 20 minutes             1000    20     47     1     34   33', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch04_v4.out no longer prints "${s}" — rewrite the narration`);
if (FIRINGS.join() !== '1,3,90,130,245,260,220,50,540' || TRIGGERS.join() !== '3,130,260' || DIAL.length !== 6
  || DIAL.map(r => r[1]).join() !== '0,2,3,20,100,1000' || DIAL.map(r => r[3]).join() !== '4,3,2,2,1,0'
  || DIAL.map(r => r[4]).join() !== '1,1,0,0,0,0' || DIAL.map(r => r[5]).join() !== '0,1,1,1,2,3')
  throw new Error('programs/ch04_v4 no longer has the firings this deck explains — rewrite the narration');

module.exports = {
  title: 'The Double Page',
  eyebrow: 'Streaming · Ch 4 · Part 7',
  ...shared,
  jargon: ['firing', 'incident', 'page', 'double page', 'list', 'function', 'latency', 'dial'],
  sources: {
    ch:    chapter(CH, 'Chapter 4 on GitHub'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 4 · three other ways'),
    model: section(CH, 'How to model it', 'Chapter 4 · how to model it'),
    prob:  section(CH, 'The problem', 'Chapter 4 · the original problem')
  },

  slides: [
    /* ---------- 1 · the story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['firing', 'incident', 'page'],
      eyebrow: '01 · Variation 4 of the interview question',
      heading: 'One page per incident — and sometimes two',
      hero: { step: 0, text: 'A monitor fires an alert every so often while a system is unhealthy: each is a <b>firing</b>, stamped with the minute it happened. Firings reach the pager through a queue, so they <b>arrive out of order</b>: the minute a firing happened and the moment it arrives are two clocks. An <b>incident</b> is a group of firings with no quiet gap longer than 47 minutes. To <b>page</b> is to wake a human; the goal is one page per incident.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'firings[[src:vars]]' },
        { step: 1, value: 47, label: 'quiet minutes that end an incident' },
        { step: 2, value: 2, label: 'minutes an incident must run before paging' },
        { step: 2, value: 1, label: 'person woken twice for one incident' }
      ],
      cardsLabel: 'What makes it hard',
      cards: [
        { step: 3, n: 1, title: 'Page while the incident is open', text: 'Waiting until it is over defeats the point of a pager.' },
        { step: 3, n: 2, title: 'A page cannot be taken back', text: 'Once someone is awake, they are awake.' },
        { step: 4, n: 3, title: 'Two settings, not one', text: 'How long to wait before paging, and how long before calling it over.' }
      ],
      note: { step: 4, text: 'The door log of part 4 with new nouns. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'A monitor fires every so often while a system is unhealthy. Each alert is a firing, stamped with its minute. Firings reach the pager through a queue, out of order, so when a firing happened and when it arrives are two clocks.',
        'An incident is a group of firings with no quiet gap longer than 47 minutes. Our example has 9 firings.',
        'A page wakes a human, once an incident has run for 2 minutes. The goal is one page per incident. On this data, one person is woken twice for a single incident.',
        'Why is it hard? The pager must act while the incident is still open, and a page cannot be taken back. Once someone is awake, they are awake.',
        'And there are two settings, not one: how long to wait before paging, and how long before calling the incident over. We will write the program together.'
      ]
    },

    /* ---------- 2 · try ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['double page'],
      eyebrow: '02 · Your turn · before any code',
      heading: 'A late firing between two incidents that already paged',
      stand: 'Firings 1 and 3 arrive: an incident 1..3, two minutes long, so someone is paged. Later 90 and 130 arrive: a second incident, also paged. Then firing 50 arrives: 47 after 3, and 40 before 90.',
      question: {
        step: 0,
        prompt: 'How many incidents were there really, and how many pages were sent for them?',
        options: [
          { text: 'One incident, two pages: firing 50 joins them.', correct: true,
            why: '50 is within 47 of both sides, so 1..3 and 90..130 are really one incident, 1..130. Two pages already went out.' },
          { text: 'Two incidents, two pages: no harm done.', correct: false,
            why: 'That was true until 50 arrived. Within 47 of both, it makes them a single incident.' },
          { text: 'One incident, one page: the pager merges the pages too.', correct: false,
            why: 'A page is a person woken up. It cannot be merged or taken back.' }
        ]
      },
      cards: [
        { step: 1, title: 'Double page', html: '<p>The same incident waking somebody twice is a <b>double page</b>. It happens when a late firing joins two incidents that had each already paged.[[src:vars]]</p>' },
        { step: 2, title: 'The door log’s withdrawal, made physical', html: '<p>In part 4 a merged run was withdrawn by a message. Here the thing to withdraw is a person’s sleep.[[src:vars]]</p>' }
      ],
      narration: [
        'Before any code, try it. Firings 1 and 3 make an incident, and someone is paged. Then 90 and 130 make a second, also paged. Then firing 50 arrives. How many incidents, and how many pages? Choose an answer.',
        'One incident, two pages. 50 is within 47 minutes of both sides, so they were one incident all along. The same incident waking somebody twice is called a double page.',
        'In part 4, a merged run could be withdrawn with a message. Here, what would need withdrawing is somebody’s sleep. That cannot be done.'
      ]
    },

    /* ---------- 3 · the firings, animated ---------- */
    {
      title: 'Fire', layout: 'array',
      eyebrow: '03 · Watch the nine firings arrive',
      heading: 'Three pages for three incidents — and still wrong',
      stand: 'In the order the pager receives them. A page goes out when an incident has run for 2 minutes.',
      array: {
        labelWidth: 150, slotLabel: 'arrival',
        rows: [
          { label: 'firing', values: FIRINGS },
          { label: 'page sent?', values: FIRINGS.map(t => (TRIGGERS.includes(t) ? 'page' : '—')) },
          { label: 'joins two paged?', values: FIRINGS.map(t => (t === 50 ? 'double' : '—')) }
        ],
        meters: ['firings', 'pages'],
        actions: [
          { step: 0, do: 'show', rows: [0] },
          { step: 1, do: 'show', rows: [1] },
          { step: 1, do: 'sweep', row: 1, mode: 'match', match: 'page', readMeter: 0, resultMeter: 1, speed: 450 },
          { step: 2, do: 'show', rows: [2] },
          { step: 2, do: 'pick', slots: [7] }
        ]
      },
      cards: [
        { step: 1, title: 'Three pages', html: '<p>Firing 3 pages 1..3; 130 pages 90..130; 260 pages 245..260. In the morning the incidents are 1..130, 220..260 and 540 alone.[[src:vars]]</p>' },
        { step: 2, title: 'Wrong both ways', html: '<p>1..130 woke someone <b>twice</b>, and 540, a single firing that never ran 2 minutes, woke <b>nobody</b>. Three pages, three incidents, wrong mapping.[[src:vars]]</p>' }
      ],
      narration: [
        'Here are the nine firings in the order the pager receives them: the door log’s nine times again.',
        'Watch the pages go out. Firing 3 pages for 1 to 3. 130 pages for 90 to 130. 260 pages for 245 to 260. Three pages.',
        'Then 50 arrives and joins the first two. So in the morning, incident 1 to 130 woke someone twice, and 540, a lone firing, woke nobody. Three pages for three incidents, and still wrong.'
      ]
    },

    /* ---------- 4 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['list'],
      eyebrow: '04 · Writing the program · the data',
      heading: 'Nine firings and two settings',
      stand: 'A program is written top to bottom. First, the data.',
      question: { step: 0, prompt: 'The paging delay is set to 2 minutes. Why that number?', options: [
        { text: 'It is the largest delay at which 1..3 still pages, so the double page happens.', correct: true, why: '1..3 spans exactly 2. At 3 it would never page, and the double page would disappear.' },
        { text: 'Two minutes is the standard paging delay.', correct: false, why: 'There is no standard. It is chosen here to show the failure, and the comment says so.' },
        { text: 'It equals the close delay divided by 47.', correct: false, why: 'The two settings are separate decisions. Nothing ties one to the other.' } ] },
      code: P.build({ add: [DATA], step: 1, label: 'programs/ch04_v4.py · the data' }),
      cards: [ { step: 2, title: 'Two decisions', html: '<p><code>FIRINGS</code> is a <b>list</b> in arrival order. <code>CLOSE_AFTER</code> = 47 ends an incident; <code>WIDE</code> = 120 is kept for contrast; <code>PAGE_AFTER</code> = 2 is how long before a human is woken.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The paging delay is set to 2 minutes. Why that number? Choose an answer.',
        'Because it is the largest delay at which the 1 to 3 incident still pages, and so the double page happens. At 3, it would disappear. Here are the firings, a list in arrival order, and the settings.',
        'The quiet period that ends an incident is 47, with 120 kept for contrast. The comments say why each number was chosen. They are two separate decisions.'
      ]
    },
    /* ---------- 5 · the inputs ---------- */
    {
      title: 'Edges', layout: 'code',
      eyebrow: '05 · Writing the program · inputs that test the edges',
      heading: 'Each side of each setting',
      stand: 'Besides the nine firings, the file prepares inputs that sit exactly on each edge.',
      question: { step: 0, prompt: 'Which pair of firings tests where one incident ends and the next begins?', options: [
        { text: 'Firings at 0 and 47, and firings at 0 and 48.', correct: true, why: 'A quiet gap of exactly 47 still belongs to one incident; one minute more makes two. Both sides of the edge.' },
        { text: 'Firings at 0 and 2.', correct: false, why: 'That pair tests the paging delay — a span of exactly 2 pages — not where an incident ends.' },
        { text: 'One firing at minute 100.', correct: false, why: 'A single firing has no gap at all. It tests that a lone firing is never paged at a delay of 2.' } ] },
      code: P.build({ before: [DATA], add: [INPUTS], step: 1 }),
      cards: [ { step: 2, title: 'Edges and scale', html: '<p>A gap of exactly 47 and of 48; a span of exactly 2; a repeated firing; the nine in time order; and 1,000 firings five minutes apart, thoroughly shuffled.[[src:vars]]</p>' } ],
      narration: [
        'The file also prepares inputs on each edge. Which pair of firings tests where one incident ends and the next begins? Choose an answer.',
        'Firings at 0 and 47, and at 0 and 48. A quiet gap of exactly 47 is still one incident; one minute more makes two. Here are those inputs.',
        'There is also a span of exactly 2 for the paging delay, the nine firings in time order, and 1,000 firings five minutes apart, arriving thoroughly shuffled.'
      ]
    },

    /* ---------- 6 · the morning truth ---------- */
    {
      title: 'Truth', layout: 'code', defines: ['function'],
      eyebrow: '06 · Writing the program · the incidents as they look in the morning',
      heading: 'Sort, then walk — once every firing is in',
      stand: 'First write the answer nobody can have in time: the true incidents, worked out once every firing has arrived.',
      question: { step: 0, prompt: 'When can the pager know the true incidents for certain?', options: [
        { text: 'Only once every firing has arrived and can be sorted.', correct: true, why: 'Any late firing can still join two incidents. Only with all of them in can the walk be trusted.' },
        { text: 'As soon as an incident has run for 2 minutes.', correct: false, why: 'That is when it pages, not when it is certain. 50 arrived long after 1..3 had paged.' },
        { text: 'After 47 quiet minutes on the wall clock.', correct: false, why: 'A firing from the past can still be in the queue. Quiet now proves nothing about what is still coming.' } ] },
      code: P.build({ before: [DATA, INPUTS], add: [SWEEP], step: 1 }),
      cards: [ { step: 2, title: 'The sweep', html: '<p>Each piece is a <b>function</b>, a named recipe. <code>sweep</code> sorts and walks: the door log’s answer, renamed. It gives 1..130, 220..260, 540..540 — the thing a pager does not get to wait for.[[src:vars]]</p>' } ],
      narration: [
        'First write the answer nobody can have in time. When can the pager know the true incidents for certain? Choose an answer.',
        'Only once every firing has arrived. Here is sweep, a function that sorts the firings and walks them, exactly the door log’s batch answer.',
        'It gives the incidents as they will look in the morning: 1 to 130, 220 to 260, and 540. The docstring says it plainly: that is the thing a pager does not get to wait for.'
      ]
    },

    /* ---------- 7 · the pager ---------- */
    {
      title: 'Pager', layout: 'code',
      eyebrow: '07 · Writing the program · paging while the incident is open',
      heading: 'The door log’s merge, with a page sent along the way',
      stand: 'Each firing is merged as in part 4. Then, if the incident has run long enough and has not paged, a page goes out.',
      question: { step: 0, prompt: 'Two incidents that have both paged are merged by a late firing. What should the merged incident remember?', options: [
        { text: 'That it has paged, and the oldest id of the two.', correct: true, why: 'Then it never pages a third time, and keeps the name a human was already shown. It cannot undo the second page.' },
        { text: 'That it has not paged yet, so it can page once properly.', correct: false, why: 'That would wake someone a third time for the same incident.' },
        { text: 'A brand-new id, since it is a new incident.', correct: false, why: 'People were already paged about the old ids. A new name would hide that link.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP], add: [PAGE], step: 1 }),
      cards: [ { step: 2, title: 'Counted, not prevented', html: '<p>The merged incident keeps the smallest id and <code>paged = any(...)</code>, which stops further pages. A merge of two paged incidents is counted as a double page: it happened, and cannot be recalled.[[src:vars]]</p>' } ],
      narration: [
        'Now the pager. Two incidents that have both paged are merged by a late firing. What should the merged incident remember? Choose an answer.',
        'That it has paged, and the oldest id of the two. Here is page streaming: the door log’s merge, plus a page when an incident has run long enough and has not paged yet.',
        'Keeping paged true stops a third page, and keeping the oldest id keeps the name a human was shown. But the second page already happened, so it is counted as a double page.'
      ]
    },

    /* ---------- 8 · which incident a page belonged to ---------- */
    {
      title: 'Cover', layout: 'code',
      eyebrow: '08 · Writing the program · scoring the pages in the morning',
      heading: 'Which true incident did each page belong to?',
      stand: 'Each page was sent for an incident as the pager knew it then. In the morning, the true incidents are different.',
      question: { step: 0, prompt: 'A page was sent for “the incident starting at 90”. Which true incident does it belong to?', options: [
        { text: 'The true incident whose span contains minute 90: 1..130.', correct: true, why: 'The start it was sent for lies inside exactly one true incident. That one got the page.' },
        { text: 'An incident starting at 90, if one exists.', correct: false, why: 'None does by morning. The start moved back to 1 when 50 arrived.' },
        { text: 'The incident closest in time to when the page went out.', correct: false, why: 'Timing does not say which incident it was about. Containment does.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE], add: [COVER], step: 1 }),
      cards: [ { step: 2, title: 'Covered, over-paged, missed', html: '<p><code>coverage</code> counts pages per true incident: 2 covered, 1 paged more than once (1..130), and 1 missed (540..540).[[src:vars]]</p>' } ],
      narration: [
        'In the morning, each page must be matched to a true incident. A page went out for the incident starting at 90. Which true incident does it belong to? Choose an answer.',
        'The one whose span contains minute 90, which is 1 to 130. Here is coverage: it counts pages per true incident, and lists any incident that got none.',
        'On this data: 2 incidents covered, one of them paged twice, and 540 never paged at all.'
      ]
    },

    /* ---------- 9 · latency ---------- */
    {
      title: 'Wait', layout: 'code', defines: ['latency'],
      eyebrow: '09 · Writing the program · how long did each page wait?',
      heading: 'The pager’s own clock is too optimistic',
      stand: 'The middle page was sent at firing 130 for an incident the pager thought started at 90. In the morning it started at 1.',
      question: { step: 0, prompt: 'How long had the system really been unhealthy when the middle page went out?', options: [
        { text: '129 minutes: from 1, the true start, to 130.', correct: true, why: 'Firing 50 arrived later and moved the start back to 1. The page was far later than it looked.' },
        { text: '40 minutes: from 90 to 130.', correct: false, why: 'That is what the pager believed at the time. The start it measured from was still going to move.' },
        { text: '47 minutes: the quiet period.', correct: false, why: '47 is when an incident is declared over. It says nothing about how long this one had been running.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER], add: [APP, LAT], step: 1 }),
      cards: [ { step: 2, title: 'Latency', html: '<p>How long a page waited is its <b>latency</b>. As the pager measured it: [2, 40, 15]. Against the true start: [2, 129, 40]. The comment records this was <b>corrected</b> after measuring.[[src:vars]]</p>' } ],
      narration: [
        'The middle page went out at firing 130, for an incident the pager thought began at 90. How long had the system really been unhealthy? Choose an answer.',
        '129 minutes. Firing 50 arrived later and moved the start back to 1. Here are two functions: the wait as the pager saw it, and the wait against the true start.',
        'How long a page waited is called its latency. The pager measured 2, 40 and 15; the truth is 2, 129 and 40. A pager cannot measure its own lateness, because its start keeps moving.'
      ]
    },

    /* ---------- 10 · the examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '10 · Writing the program · 16 examples, each checked against the morning',
      heading: 'A thousand firings, one incident',
      stand: '1,000 firings five minutes apart are truly one incident. They arrive thoroughly shuffled, and the pager pages at once.',
      question: { step: 0, prompt: 'How many pages does the pager send for that one incident?', options: [
        { text: '52: shuffled, many separate pieces page before they join.', correct: true, why: 'Out of order, the firings first form many small incidents. Each pages before the gaps between them are filled.' },
        { text: '1: it is a single incident.', correct: false, why: 'It is one in the morning. While firings arrive shuffled, it looks like many, and each one pages.' },
        { text: '1,000: one page per firing.', correct: false, why: 'Firings that join an incident that has already paged do not page again.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER, APP, LAT], add: [EXAMPLES, SHOW], step: 1 }),
      cards: [ { step: 2, title: '51 duplicates', html: '<p>52 pages, 51 of them duplicates. Waiting 20 minutes before paging: 34 pages. The same nine in time order: 2 pages and no double page — the late arrival is the whole cause.[[src:vars]]</p>' } ],
      narration: [
        '1,000 firings five minutes apart are really one incident, but they arrive shuffled and the pager pages at once. How many pages for that one incident? Choose an answer.',
        '52. Shuffled, the firings first form many small incidents, and each pages before the gaps between them fill in. Here are the 16 examples, each checked against the morning’s sweep.',
        'Waiting 20 minutes before paging cuts it to 34. And the nine firings in time order give 2 pages and no double page: the late arrival is the whole cause.'
      ]
    },

    /* ---------- 11 · main, the nine firings ---------- */
    {
      title: 'Main', layout: 'code',
      eyebrow: '11 · Writing the program · the nine firings, scored',
      heading: 'A page named an incident that no longer exists',
      stand: 'main pages the nine firings, compares with the morning, and checks every number.',
      question: { step: 0, prompt: 'The second page named “the incident starting at 90”. Does that incident exist in the morning?', options: [
        { text: 'No: it is now inside 1..130.', correct: true, why: 'Its start moved back to 1. So a start time is not a usable name for a page: the name must be given at birth.' },
        { text: 'Yes: 90..130 is still an incident.', correct: false, why: 'Firing 50 joined it to 1..3. The true incidents are 1..130, 220..260 and 540..540.' },
        { text: 'Yes, but under a different start time.', correct: false, why: 'Then the name the human was given is wrong. That is exactly why a start time cannot be the name.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER, APP, LAT, EXAMPLES, SHOW], add: [MAIN1], step: 1 }),
      cards: [ { step: 2, title: 'Asserted', html: '<p>Pages at 1, 90, 245 (triggered by 3, 130, 260); 1 double page; 540..540 never paged; latencies [2, 40, 15] seen, [2, 129, 40] true.[[src:vars]]</p>' } ],
      narration: [
        'Now main. It pages the nine firings and scores them against the morning. The second page named the incident starting at 90. Does that incident exist in the morning? Choose an answer.',
        'No. It is now inside 1 to 130. So a start time cannot be how a page names its incident; a stable name must be given when the incident is born.',
        'Main asserts every number: pages for 1, 90 and 245, one double page, 540 never paged, and the two sets of latencies.'
      ]
    },

    /* ---------- 12 · the dial ---------- */
    {
      title: 'Dial', layout: 'code', defines: ['dial'],
      eyebrow: '12 · Writing the program · turning the paging delay',
      heading: 'Wait longer, and the other failure grows',
      stand: 'The quiet period stays at 47. The paging delay is turned from 0 up to 1000 minutes, on the same nine firings.',
      question: { step: 0, prompt: 'As the paging delay grows, what happens?', options: [
        { text: 'Fewer double pages, but more incidents nobody is told about.', correct: true, why: 'Waiting lets late firings join before anyone is woken — and lets short incidents end unseen.' },
        { text: 'Fewer double pages, and nothing else changes.', correct: false, why: 'At a delay of 1000 nothing pages at all: zero double pages, and a pager that never pages.' },
        { text: 'More double pages, because incidents last longer.', correct: false, why: 'Waiting can only reduce double pages here. The program asserts it never adds one.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER, APP, LAT, EXAMPLES, SHOW, MAIN1], add: [MAIN2], step: 1 }),
      cards: [ { step: 2, title: 'One dial, two failures', html: '<p>A setting turned one way trades one failure for another: a <b>dial</b>. The quiet period of 120 removes the bridge — and reports 1..130 and 220..260 as one, a different lie.[[src:vars]]</p>' } ],
      narration: [
        'Main then turns the paging delay from 0 to 1000 minutes on the same firings. As it grows, what happens? Choose an answer.',
        'Fewer double pages, but more incidents nobody is told about. The program asserts both directions. A setting like this, trading one failure for another, is a dial.',
        'Widening the quiet period to 120 removes the bridge too, but then two real incidents are reported as one: a different lie. Watch the numbers.'
      ]
    },

    /* ---------- 13 · the dial, animated ---------- */
    {
      title: 'Turn', layout: 'array',
      eyebrow: '13 · Watch the paging delay turn',
      heading: 'No setting gives zero of both',
      stand: 'Quiet period 47, the nine firings. Read each column as one setting of the paging delay.',
      array: {
        labelWidth: 210, slotLabel: 'setting',
        rows: [
          { label: 'wait before paging (min)', values: DIAL.map(r => r[1]) },
          { label: 'pages sent', values: DIAL.map(r => r[3]) },
          { label: 'double pages', values: DIAL.map(r => r[4]) },
          { label: 'incidents never paged', values: DIAL.map(r => r[5]) }
        ],
        actions: [
          { step: 0, do: 'show', rows: [0, 1] },
          { step: 1, do: 'show', rows: [2, 3] },
          { step: 2, do: 'pick', slots: [1, 2] }
        ]
      },
      cards: [
        { step: 1, title: 'Opposite directions', html: '<p>Double pages fall 1, 1, 0, 0, 0, 0 while missed incidents rise 0, 1, 1, 1, 2, 3. At 1000, nothing pages at all.[[src:vars]]</p>' },
        { step: 2, title: 'Between 2 and 3', html: '<p>At 2 the double page happens; at 3 it is gone — and 540 is still never paged. Every column has at least one failure.[[src:vars]]</p>' }
      ],
      narration: [
        'Each column is one setting of the paging delay, from 0 up to 1000 minutes, with the pages it sends.',
        'Below, the two failures. Double pages fall from 1 to 0, while incidents that are never paged rise from 0 to 3. At 1000, nothing pages at all.',
        'Look at 2 and 3. At 2 the double page happens; at 3 it is gone, but 540 is never paged. Every column has at least one failure.'
      ]
    },

    /* ---------- 14 · the search ---------- */
    {
      title: 'Find', layout: 'code',
      eyebrow: '14 · Writing the program · is there a perfect pair?',
      heading: 'Three pairs work — for this one arrival order',
      stand: 'main tries every quiet period from 0 to 120 with every paging delay from 0 to 40: 4,961 pairs.',
      question: { step: 0, prompt: 'Three pairs give the right incidents, a page for each, and no double page. Should a team choose one?', options: [
        { text: 'No: they only work for this exact arrival order.', correct: true, why: 'Reordering the same nine firings makes the best pair double-page again. Nobody controls arrival order.' },
        { text: 'Yes: three working pairs out of 4,961 is a real answer.', correct: false, why: 'They were fitted to one arrival order. The program shows a reordering that breaks them.' },
        { text: 'Yes, but only the middle one, to be safe.', correct: false, why: 'All three fail the same way when the order changes. Being in the middle does not help.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER, APP, LAT, EXAMPLES, SHOW, MAIN1, MAIN2], add: [MAIN3], step: 1 }),
      cards: [ { step: 2, title: 'Fitted, not found', html: '<p>Quiet period 87, 88 or 89 with no paging delay: firing 90 joins the open incident, so 50 has nothing to bridge. Reordered to [90, 220, 1, 3, 260, 245, 130, 540, 50], the 87 pair double-pages again.[[src:vars]]</p>' } ],
      narration: [
        'Main tries every pair of settings: 4,961 of them. Three give the right incidents, a page each, and no double page. Should a team choose one? Choose an answer.',
        'No. They work only for this exact arrival order. With a quiet period of 87, firing 90 joins the open incident, so 50 has nothing to bridge.',
        'But reorder the same nine firings, and the 87 pair double-pages again. The comment says the first expectation was that no pair works; it was corrected, and the lesson stands.'
      ]
    },

    /* ---------- 15 · random streams ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '15 · Writing the program · 600 random streams',
      heading: 'Same incidents in any order; different pages',
      stand: 'Random firings and random settings, each run twice: once as generated, once shuffled.',
      question: { step: 0, prompt: 'Shuffling a stream’s arrival order changes what?', options: [
        { text: 'The pages, but never the morning’s incidents.', correct: true, why: 'The incidents depend only on the firing times. The pages depend on what had arrived when each decision was made.' },
        { text: 'Both the incidents and the pages.', correct: false, why: 'The grouping is the door log’s, and it always ends equal to the sorted sweep.' },
        { text: 'Nothing at all.', correct: false, why: 'The pages differed on 192 of the 600 streams.' } ] },
      code: P.build({ before: [DATA, INPUTS, SWEEP, PAGE, COVER, APP, LAT, EXAMPLES, SHOW, MAIN1, MAIN2, MAIN3], add: [MAIN4], step: 1 }),
      cards: [ { step: 2, title: 'Real, not universal', html: '<p>Incidents always equal the sorted sweep, under any order. Pages differed on 192 streams; 22 double-paged and 578 did not.[[src:vars]]</p>' } ],
      narration: [
        'Finally, 600 random streams, each run as generated and then shuffled. What does shuffling the arrival order change? Choose an answer.',
        'The pages, but never the incidents. The incidents always equal the sorted sweep. The pages differed on 192 of the streams, because the pager acts before the order is known.',
        '22 streams double-paged and 578 did not. So the failure is real, and not universal. The program asserts both kinds were seen.'
      ]
    },

    /* ---------- 16 · whole ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '16 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written, and why.',
        'From the top: the firings and settings, the morning’s sweep, the pager, coverage and latency, the examples, and main with the dial and the search.'
      ]
    },

    /* ---------- 17 · output ---------- */
    {
      title: 'Out', layout: 'code',
      eyebrow: '17 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch04_v4.py prints'),
      narration: [
        'Here is what it prints: the 16 examples, then the nine firings scored against the morning, with one double page and one incident never paged.',
        'Then the latencies, the dial table, the 3 fitted pairs and the reordering that breaks them, and the 600 random streams. Every assertion passed.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you built',
      heading: 'The grouping is the door log’s. Acting early is what breaks.',
      stand: 'Each function, in a sentence.',
      table: {
        columns: ['Function', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>sweep</code>', 'the true incidents, once every firing is in', '1..130, 220..260, 540..540'] },
          { step: 0, cells: ['<code>page_streaming</code>', 'merge as firings arrive; page while open; count double pages', '3 pages, 1 double'] },
          { step: 1, cells: ['<code>coverage</code>', 'which true incident each page belonged to', '540..540 never paged'] },
          { step: 1, cells: ['<code>latencies</code>', 'wait against the true start, not the pager’s', '129, not 40'] },
          { step: 2, cells: ['<code>main</code>', 'the dial, the search, 600 random streams', 'no pair fixes both'] }
        ]
      },
      side: { step: 3, title: 'The lesson', html: '<p>The quiet period is now two decisions: how long to wait before paging, and how long before calling it over. They trade double pages against missed incidents, and no setting removes both for arrival orders you do not control.[[src:vars]]</p>' },
      narration: [
        'To recap. Sweep gives the true incidents, but only once every firing is in. Page streaming merges as firings arrive and pages while an incident is open.',
        'Coverage scores each page against the morning, and latency measures its wait from the true start: 129 minutes, not the 40 it looked like.',
        'Main turns the dial and searches every pair: waiting trades double pages for missed incidents, and the three pairs that worked were fitted to one order.',
        'The lesson: the gap became two decisions, and they trade one failure for another. Choosing between them is a product decision, not something a sweep can hand you.'
      ]
    }
  ]
};
