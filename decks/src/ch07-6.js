// Chapter 7, Part 6 — Variation 3, the abandoned shopping cart, built as a program WITH the
// viewer. Here the expiry is the feature, and the move is to notice that "expire" and "forget"
// were conflated: write the cart out instead of deleting it, and read it back on return. Every
// code slide asks what the next piece must do, then reveals the real lines of
// programs/ch07_v3.py (read at build time, addressed by content); the deck ends with the whole
// file and what it prints.
const { section, chapter } = require('./_doc');
const shared = require('./_shared');
const { program } = require('./_prog');

const CH = 'ch07';
const P = program('ch07_v3.py');
const OUT = program('ch07_v3.out');

// the pieces, in the order they are written
const DATA = P.span('import random', 'TWO_ADDITIONS = [');
const DATA2 = P.block('BIG_ADDITIONS = sorted(');
const TRUTH = P.fn('truth_of');
const SILENCE = P.fn('longest_silence');
const ADD = P.fn('add');
const DELETE = P.fn('expire_by_deleting');
const WRITE = P.fn('expire_by_writing_out');
const RUN = P.fn('run');
const FINAL = P.fn('final_carts');
const HELD = P.fn('carts_held_at');
const SUFFIX = P.fn('is_suffix');
const TABLE_C = P.span('---- WORKED EXAMPLES', 'can go stale silently, and this cannot.');
const TABLE = P.block('EXAMPLES = [');
const SHOW = P.fn('show_examples');
const M_WEEK = P.span('def main():', 'assert quiet_b > WEEK and');
const M_SHAPE = P.span('# the damage has a shape', 'assert zero_reloads == 7');
const M_EDGE = P.span('# the boundary the comparison decides', 'outside a 168-hour one');
const M_SAVE = P.span('# the memory saving at this scale', 'and measure it there.');
const M_SCALE = P.span('# ...measured there', 'assert len(store_after) == 1_899');
const M_MANY = P.span('# many inputs: the store is always exact', '    main()');

// guard: the narration quotes these printed results; fail loudly if the program changes
const printed = OUT.lines.join('\n');
for (const s of ["expire by deleting    : {'a': [8]}   (2 carts held)",
  "expire by writing out : {'a': [5, 3, 2, 6, 8], 'b': [4, 7, 9, 1]}   (2 carts held, 1 reload)",
  "cart holding 8 instead of 24: 4 items worth 16 silently gone", 'b has been quiet 280 hours',
  '1 cart at a time and the answer is still right after 7 reloads',
  "'a' is lost: {'b': [4, 7, 9, 1], 'a': [8]}", 'At the week-long allowance it is 2, reached at hour 429',
  "shopper 'a' expired at 414 and 'b' at 429", 'ttl = 100    : 102 carts in memory  (1,899 saved, 5.1% of the state)',
  'the store now holds 1,899 carts while memory holds 102', 'plain expiry was exact in 677 of 2,400 runs',
  '1,723 it returned a strict suffix', 'all 13 examples agree with the true cart', 'all assertions passed'])
  if (!printed.includes(s)) throw new Error(`programs/ch07_v3.out no longer prints "${s}" — rewrite the narration`);

const ALL = [DATA, DATA2, TRUTH, SILENCE, ADD, DELETE, WRITE, RUN, FINAL, HELD, SUFFIX, TABLE_C, TABLE, SHOW,
  M_WEEK, M_SHAPE, M_EDGE, M_SAVE, M_SCALE, M_MANY];
const upTo = piece => ALL.slice(0, ALL.indexOf(piece));

module.exports = {
  title: 'The Abandoned Cart',
  eyebrow: 'Streaming · Ch 7 · Part 6',
  ...shared,
  jargon: ['addition', 'shopper', 'cart', 'cart value', 'memory', 'durable storage', 'event time', 'processing time',
    'allowance', 'expire', 'function', 'reload', 'suffix'],
  sources: {
    ch:    chapter(CH, 'Chapter 7 on GitHub'),
    prob:  section(CH, 'The problem', 'Chapter 7 · the interview problem'),
    model: section(CH, 'How to model it', 'Chapter 7 · how to model it'),
    vars:  section(CH, 'The same problem, asked 3 other ways', 'Chapter 7 · variation 3, the abandoned cart')
  },

  slides: [
    /* ---------- 1 · the problem as a story ---------- */
    {
      title: 'Story', layout: 'title', defines: ['addition', 'shopper', 'cart', 'cart value', 'memory', 'durable storage', 'expire'],
      eyebrow: '01 · Variation 3 · looks like commerce',
      heading: 'Expire the idle carts — and give them back',
      hero: { step: 0, text: 'An online shop holds each <b>shopper</b>’s <b>cart</b>: every item they have put in it, in order. Putting an item in is an <b>addition</b>, and the <b>cart value</b> is the sum of the prices. Carts sit in fast <b>memory</b>, which is small; slower <b>durable storage</b> survives anything but costs a read. The product asks to <b>expire</b> inactive carts — take them out of memory once idle too long — yet a shopper who returns after a week expects theirs back.[[src:vars]]' },
      tiles: [
        { step: 1, value: 9, label: 'additions by 2 shoppers[[src:vars]]' },
        { step: 1, value: 45, label: 'cart value when nothing is lost[[src:vars]]' },
        { step: 2, value: 168, label: 'hours in the week the product chose[[src:vars]]' },
        { step: 2, value: 295, label: 'hours shopper a stays away[[src:vars]]' }
      ],
      cardsLabel: 'What the interviewer wants',
      cards: [
        { step: 3, n: 1, title: 'Bounded memory', text: 'Only active shoppers’ carts should take up fast memory.' },
        { step: 3, n: 2, title: 'No lost carts', text: 'A shopper who returns finds every item they added.' },
        { step: 4, n: 3, title: 'Spot the conflation', text: '“Expire” and “forget” were being treated as one word.' }
      ],
      note: { step: 4, text: 'We will write the program together. Each slide asks what the next piece must do; then the real lines appear.[[src:vars]]' },
      narration: [
        'An online shop holds each shopper’s cart: every item they have added, in order. Adding an item is an addition, and the cart value is the sum of the prices. Carts sit in fast memory, which is small.',
        'Our example has 9 additions by 2 shoppers, and 45 of cart value when nothing is lost. Slower durable storage survives anything, but every use of it costs a read.',
        'The product chose to expire carts after a week, 168 hours. Shopper A stays away for 295 hours, then comes back expecting the cart.',
        'So memory must hold only active shoppers, and yet a returning shopper must find every item they added.',
        'The whole move is to notice that two words were being treated as one: expire, and forget. We will write the program together, and you decide each piece first.'
      ]
    },

    /* ---------- 2 · try a small case ---------- */
    {
      title: 'Try', layout: 'ask', defines: ['event time', 'processing time', 'allowance'],
      eyebrow: '02 · Before any code · try it by hand',
      heading: 'Shopper a comes back after twelve days',
      stand: 'Each addition has two times: when it happened (event time) and when the shop’s program saw it (processing time); this program uses when it happened, in hours. Shopper a adds 5, 3, 2 and 6, goes quiet at hour 245, and adds an 8 at hour 540.',
      question: {
        step: 0,
        prompt: 'Carts quiet for more than 168 hours are deleted from memory. What does a find at hour 540?',
        options: [
          { text: 'All five items, worth 24.', correct: false,
            why: 'At hour 540 a has been quiet for 295 hours, more than 168, so the old cart is gone before the 8 goes in.' },
          { text: 'Only the 8 just added: 16 of value is gone.', correct: true,
            why: 'Deleting made a look like a new shopper, so the cart starts again with just the 8.' },
          { text: 'An empty cart: the 8 is refused too.', correct: false,
            why: 'Nothing refuses the new item. It is the old items that vanish, not the new one.' }
        ]
      },
      cards: [
        { step: 1, title: 'Two clocks, one used', html: '<p><b>Event time</b> is when it happened; <b>processing time</b> is when it was seen. This program uses event time, in hours.[[src:vars]]</p>' },
        { step: 2, title: 'Allowance, and expire', html: '<p>How long a cart may sit idle is the <b>allowance</b>; when it runs out the cart <b>expires</b>. Deleting on expiry left a with <b>8</b> instead of 24.[[src:vars]]</p>' }
      ],
      narration: [
        'Try it by hand first. Carts quiet for more than 168 hours are deleted. Shopper A goes quiet at hour 245 and adds an 8 at hour 540. What does A find? Choose an answer.',
        'Each addition has two times: when it happened, its event time, and when the program saw it, its processing time. This program uses when it happened, counted in hours.',
        'A finds only the 8 just added. How long a cart may sit idle is the allowance, and when it runs out the cart expires. Deleting on expiry threw away 16 of A’s 24.'
      ]
    },

    /* ---------- 3 · the data ---------- */
    {
      title: 'Data', layout: 'code', defines: ['function'],
      eyebrow: '03 · Writing the program · the data',
      heading: 'Nine additions, two true carts, a week',
      stand: 'The program starts with the additions, the true carts to check against, and the test inputs its examples will need.',
      question: { step: 0, prompt: 'The running-total program kept one number per key. What must the true answer keep per shopper here?', options: [
        { text: 'Every item, in the order it was added.', correct: true, why: 'A cart is its items, not just their sum. A returning shopper must see exactly what they added.' },
        { text: 'Only the cart value, the sum of prices.', correct: false, why: 'A shopper does not check out a number. Losing which items were in the cart is losing the cart.' },
        { text: 'Only the last item added.', correct: false, why: 'Then every cart would hold one item. That is the damage, not the answer.' } ] },
      code: P.build({ add: [DATA, DATA2], step: 1, label: 'programs/ch07_v3.py · the data' }),
      cards: [ { step: 2, title: 'The answer key', html: '<p><code>TRUE_CARTS</code>: a is [5, 3, 2, 6, 8], b is [4, 7, 9, 1]; values 24 and 21. <code>WEEK</code> is 168. Every piece below is a <b>function</b>: a named recipe that takes inputs and gives back an answer.[[src:vars]]</p>' } ],
      narration: [
        'First, the data. The running-total program kept one number per key. What must the true answer keep per shopper here? Choose an answer.',
        'Every item, in the order it was added. Here are the first lines: the nine additions, the true carts, A with five items and B with four, worth 24 and 21, and the week of 168 hours.',
        'Below them are inputs for the examples: an empty stream, one addition, two additions 10 hours apart, and 2,000 one-visit shoppers. Every piece after this is a function: a named recipe.'
      ]
    },

    /* ---------- 4 · the truth and the computation ---------- */
    {
      title: 'Truth', layout: 'code',
      eyebrow: '04 · Writing the program · the reference, and the one computation',
      heading: 'What the shopper should see, and how an item goes in',
      stand: 'Three small functions: the requirement written out, the longest silence per shopper, and adding one item.',
      question: { step: 0, prompt: 'Why does the program need a brute-force “true cart” function at all?', options: [
        { text: 'So every clever version can be checked against something that cannot be wrong.', correct: true, why: 'It is the requirement written out. Anything that disagrees with it is what is broken.' },
        { text: 'Because the shop uses it in production.', correct: false, why: 'It keeps every item for ever. It is a reference to test against, not the design.' },
        { text: 'To make the program run faster.', correct: false, why: 'It is the slowest, simplest answer. Its value is being obviously right.' } ] },
      code: P.build({ before: upTo(TRUTH), add: [TRUTH, SILENCE, ADD], step: 1 }),
      cards: [ { step: 2, title: 'Facts about the data', html: '<p>Longest silence: a <b>295</b> hours, b <b>130</b> — knowable only afterwards, so the week is a guess about shoppers. <code>add</code> appends one item and notes the hour: never the problem.[[src:vars]]</p>' } ],
      narration: [
        'Three small functions. Why does the program need a brute-force true cart at all? Choose an answer.',
        'So every clever version can be checked against something that cannot be wrong. Here are truth of, which is the requirement written out, longest silence per shopper, and add, which appends one item.',
        'The longest silences are 295 hours for A and 130 for B, facts only knowable afterwards. So the week of 168 is a guess about shoppers.'
      ]
    },

    /* ---------- 5 · expire by deleting ---------- */
    {
      title: 'Delete', layout: 'code',
      eyebrow: '05 · Writing the program · expire, read as forget',
      heading: 'The expiry everyone writes first',
      stand: 'An idle cart must leave memory. The first version simply deletes it.',
      question: { step: 0, prompt: 'After a cart is deleted, how can the program tell a returning shopper from a brand-new one?', options: [
        { text: 'By the hour of the addition.', correct: false, why: 'A new shopper’s addition has an hour too. The hour says nothing about having shopped before.' },
        { text: 'It cannot: the thing that would tell them apart was deleted.', correct: true, why: 'Only the old cart proved they had shopped before, and deleting it erased that proof.' },
        { text: 'By the price of the new item.', correct: false, why: 'Prices say nothing about who is shopping. Any shopper can add any item.' } ] },
      code: P.build({ before: upTo(DELETE), add: [DELETE], step: 1 }),
      cards: [ { step: 2, title: 'A second number, then nothing', html: '<p>It needs <code>last</code>, a second number per live cart, only for the comparison <code>now - last[s] &gt; ttl</code>. Afterwards, a returning shopper and a new one look identical.[[src:vars]]</p>' } ],
      narration: [
        'An idle cart must leave memory, and the first version simply deletes it. Afterwards, how can the program tell a returning shopper from a new one? Choose an answer.',
        'It cannot: the thing that would tell them apart was deleted. Here is expire by deleting: any cart idle for longer than the allowance is removed, along with its last-touched hour.',
        'It needs a second number per cart, only for that comparison. And once the cart is gone, a returning shopper and a brand-new one look exactly the same.'
      ]
    },

    /* ---------- 6 · expire by writing out ---------- */
    {
      title: 'Write', layout: 'code',
      eyebrow: '06 · Writing the program · expire, read as move',
      heading: 'Change one line: write the cart out on its way',
      stand: 'Memory must still hold only active shoppers. What is the smallest change that keeps the cart?',
      question: { step: 0, prompt: 'What should happen to an expiring cart instead of deletion?', options: [
        { text: 'Keep it in memory, but mark it as idle.', correct: false, why: 'Then memory still holds every cart ever made, and the bound is gone.' },
        { text: 'Write it to durable storage, then free the memory.', correct: true, why: 'Memory is freed exactly as before, but the cart still exists, so a returning shopper can have it back.' },
        { text: 'Email it to the shopper and delete it.', correct: false, why: 'The shop would still lose the cart. The shopper expects it in the shop, not in their inbox.' } ] },
      code: P.build({ before: upTo(WRITE), add: [WRITE], step: 1 }),
      cards: [ { step: 2, title: 'Expire is not forget', html: '<p>The bound is unchanged — memory holds only active shoppers — but the deletion has become a <b>move</b>. The information needed to recognise a returning shopper still exists somewhere.[[src:vars]]</p>' } ],
      narration: [
        'Memory must still hold only active shoppers. What should happen to an expiring cart, instead of deletion? Choose an answer.',
        'Write it to durable storage, then free the memory. Here is expire by writing out: the same test, the same freeing, and one extra line that adds the cart to the store on its way out.',
        'So the bound is untouched, and memory still holds only active shoppers. But the deletion has become a move. Expire no longer means forget.'
      ]
    },

    /* ---------- 7 · the run, with a reload ---------- */
    {
      title: 'Run', layout: 'code', defines: ['reload'],
      eyebrow: '07 · Writing the program · the whole stream',
      heading: 'Before adding, look in the store',
      stand: 'One function runs the whole stream, with or without a store behind memory.',
      question: { step: 0, prompt: 'With a store, what must happen when an addition arrives for a shopper who is not in memory?', options: [
        { text: 'Start a new cart, and merge the old one at checkout.', correct: false, why: 'The shopper looks at their cart before checkout and sees it missing items. Merge too late and it looks lost.' },
        { text: 'If the store holds their cart, read it back into memory first.', correct: true, why: 'Then the new item joins the old ones, and the shopper sees their whole cart.' },
        { text: 'Ask the shopper whether they had a cart before.', correct: false, why: 'The store already knows. The program should not hand its own bookkeeping to the shopper.' } ] },
      code: P.build({ before: upTo(RUN), add: [RUN, FINAL], step: 1 }),
      cards: [ { step: 2, title: 'Reload', html: '<p>Reading a cart back from the store is a <b>reload</b>. It is the only difference between the two runs, and it is the entire answer. <code>final_carts</code> shows what each shopper would see: memory plus the store.[[src:vars]]</p>' } ],
      narration: [
        'With a store behind memory, what must happen when an addition arrives for a shopper who is not in memory? Choose an answer.',
        'If the store holds their cart, read it back first. Here is run: it expires carts, then, if the shopper is missing from memory but present in the store, it reads the cart back before adding the item.',
        'Reading a cart back is called a reload, and it is the whole answer. Final carts then shows what each shopper would see: what is in memory, plus what is in the store.'
      ]
    },

    /* ---------- 8 · measuring honestly ---------- */
    {
      title: 'Shape', layout: 'code', defines: ['suffix'],
      eyebrow: '08 · Writing the program · two measuring tools',
      heading: 'Count carts at a moment, and name the damage',
      stand: 'Two helpers: how many carts memory holds at a given hour, and a test for exactly what a deleted cart leaves behind.',
      question: { step: 0, prompt: 'When deleting damages a cart, which items does the shopper keep?', options: [
        { text: 'The first items added, before the cart went idle.', correct: false, why: 'Those are exactly the ones deleted. What came before the drop is what is lost.' },
        { text: 'The items added since the drop: the tail of the true cart.', correct: true, why: 'Everything before the drop was deleted with the cart. Only later additions remain.' },
        { text: 'A random mix of items.', correct: false, why: 'The damage has a precise shape: one cut, with everything after it kept.' } ] },
      code: P.build({ before: upTo(HELD), add: [HELD, SUFFIX], step: 1 }),
      cards: [ { step: 2, title: 'Always a suffix', html: '<p>The tail end of a list is a <b>suffix</b>. A deleted cart always leaves a suffix of the true cart, so a cart can only ever be too small. <code>carts_held_at</code> counts carts at one hour, since the end of the run hides the saving.[[src:vars]]</p>' } ],
      narration: [
        'Two measuring tools. When deleting damages a cart, which items does the shopper keep? Choose an answer.',
        'The items added since the drop. The tail end of a list is called a suffix. Here is is suffix, which tests exactly that, and carts held at, which counts the carts in memory at one chosen hour.',
        'So the damage always has one shape: a cart can only be too small, never wrong or too big. And the saving must be counted at a quiet hour, because at the end of the run it is invisible.'
      ]
    },

    /* ---------- 9 · the worked examples ---------- */
    {
      title: 'Table', layout: 'code',
      eyebrow: '09 · Writing the program · the worked examples',
      heading: 'The same week saves 0 carts at one hour, 2 at another',
      stand: 'Thirteen examples, each asserted against the true cart and against the store. Two rows look at the week-long allowance at different hours.',
      question: { step: 0, prompt: 'With a week-long allowance, how many carts are out of memory at hour 413, and at hour 429?', options: [
        { text: '2 at both hours: the allowance is the same.', correct: false, why: 'At hour 413, a has been idle 168 hours, which is still inside the week, so it is still held.' },
        { text: '0 at 413, and 2 at 429.', correct: true, why: 'a expires at hour 414 and b at hour 429. So “how much does it save” has no answer without an hour.' },
        { text: '0 at both: a week saves nothing.', correct: false, why: 'By hour 429 both carts have been idle longer than a week, so memory holds neither.' } ] },
      code: P.build({ before: upTo(TABLE_C), add: [TABLE_C, TABLE, SHOW], step: 1 }),
      cards: [ { step: 2, title: 'What the table pins', html: '<p>Value kept by deleting: 45 at 295, <b>29</b> at 294, <b>8</b> at a week. Saved by a week: 0 at hour 413, 2 at hour 429. At 2,000 shoppers and 100 hours: 1,899 saved — and 301 of 2,200 value kept.[[src:vars]]</p>' } ],
      narration: [
        'Next, a table of thirteen examples. With a week-long allowance, how many carts are out of memory at hour 413, and at hour 429? Choose an answer.',
        'None at 413, and 2 at 429. Here is the table: every row is checked against the true cart and the store, and the hour is part of each row, because the saving depends on when you look.',
        'Deleting keeps 45 of value at 295, 29 at 294, and 8 at a week. At 2,000 one-visit shoppers and 100 hours, 1,899 carts are saved from memory, and only 301 of 2,200 value is kept.'
      ]
    },

    /* ---------- 10 · main: the week ---------- */
    {
      title: 'Week', layout: 'code',
      eyebrow: '10 · Writing the program · the week, three ways',
      heading: 'Never expire, delete, or write out',
      stand: 'Main runs the week-long allowance by deleting and by writing out, against never expiring. Shopper b’s longest silence is only 130 hours.',
      question: { step: 0, prompt: 'b is never quiet for more than 130 hours, under the week. Is b’s cart safe when deleting?', options: [
        { text: 'Yes: 130 is inside the 168-hour allowance.', correct: false, why: 'That was the first expectation, and the program refused it. What matters is how quiet b is when the sweep runs.' },
        { text: 'No: when a’s hour-540 addition sweeps memory, b has been quiet 280 hours.', correct: true, why: 'b’s last addition is at hour 260. Someone else’s event triggers the sweep, and by then b is past the week.' },
        { text: 'No: deleting always removes every cart.', correct: false, why: 'Only carts idle past the allowance are removed. b is removed because of when the sweep ran.' } ] },
      code: P.build({ before: upTo(M_WEEK), add: [M_WEEK], step: 1 }),
      cards: [ { step: 2, title: 'Two different losses', html: '<p>Deleting: <code>{\'a\': [8]}</code>. a is <b>restarted</b> — 4 items worth 16 gone. b is <b>erased</b>, with nothing to come back to. Writing out: both carts exact, with 1 reload.[[src:vars]]</p>' } ],
      narration: [
        'Main runs the week by deleting and by writing out. B is never quiet for more than 130 hours, under the week. Is B’s cart safe when deleting? Choose an answer.',
        'No. B’s last addition is at hour 260, and when A’s addition at 540 sweeps memory, B has been quiet for 280 hours. Here are those runs, with the corrected claim written beside them.',
        'So there are two different losses. A is restarted with 8, 4 items worth 16 gone. B is erased with nothing to come back to. Writing out keeps both carts exact, with 1 reload.'
      ]
    },

    /* ---------- 11 · main: always a suffix, always exact with a store ---------- */
    {
      title: 'Exact', layout: 'code',
      eyebrow: '11 · Writing the program · the store at every allowance',
      heading: 'With a store, even an allowance of 0 is exact',
      stand: 'Main checks the damage’s shape, then runs the store at allowances from 0 to never.',
      question: { step: 0, prompt: 'With the store and an allowance of 0, memory holds one cart at a time. Are the carts still right?', options: [
        { text: 'Yes, after 7 reloads: every cart comes back from the store.', correct: true, why: 'An allowance of 0 moves every idle cart out at once, and every return reads it back. It costs reads, not items.' },
        { text: 'No: an allowance of 0 deletes everything.', correct: false, why: 'Here expiring writes out. Nothing is deleted, so nothing is lost, however short the allowance.' },
        { text: 'Only for the shopper who added last.', correct: false, why: 'Both shoppers’ carts come back whole. The store does not care who was last.' } ] },
      code: P.build({ before: upTo(M_SHAPE), add: [M_SHAPE], step: 1 }),
      cards: [ { step: 2, title: 'Exact at any allowance', html: '<p>Deleting always leaves a suffix — never a prefix. With the store, every allowance from 0 to never is exact; at 0, memory holds <b>1</b> cart at a time, right after <b>7</b> reloads.[[src:vars]]</p>' } ],
      narration: [
        'Main checks that deleting always leaves a suffix, then runs the store at every allowance. At an allowance of 0, memory holds one cart at a time. Are the carts still right? Choose an answer.',
        'Yes, after 7 reloads. Here is the check: the store is exact at allowances of 0, 1, a week, 294 and never. At 0, memory holds 1 cart at a time, and the answer is still right.',
        'So the length of the allowance now only decides how often carts are read back. It no longer decides whether they are right.'
      ]
    },

    /* ---------- 12 · main: one hour decides ---------- */
    {
      title: 'Edge', layout: 'code',
      eyebrow: '12 · Writing the program · the boundary',
      heading: 'One hour decides whether a cart exists',
      stand: 'a is silent for exactly 295 hours. The comparison is “idle for MORE than the allowance”.',
      question: { step: 0, prompt: 'At allowances of 295 and of 294, which keeps every cart when deleting?', options: [
        { text: '294: a tighter allowance is safer.', correct: false, why: 'Tighter drops more. At 294, a’s silence of 295 is over the line and its cart is cut.' },
        { text: 'Neither: a is gone in both.', correct: false, why: 'At 295 the silence equals the allowance, which counts as still inside it, so a keeps its cart.' },
        { text: '295: a silence equal to the allowance is still inside it.', correct: true, why: 'The test is strictly more than. So 295 keeps a, and 294 loses its first four items.' } ] },
      code: P.build({ before: upTo(M_EDGE), add: [M_EDGE], step: 1 }),
      cards: [ { step: 2, title: 'Isolating the two losses', html: '<p>At 294 only a is lost, restarted at [8]; b, quiet 280 hours at the sweep, is inside 294 but outside 168. So 294 shows the restart alone, and a week shows both.[[src:vars]]</p>' } ],
      narration: [
        'A is silent for exactly 295 hours, and the test is idle for more than the allowance. At 295 and at 294, which keeps every cart when deleting? Choose an answer.',
        '295, because a silence equal to the allowance is still inside it. Here is the check: at 295 every cart is kept, and at 294 A loses its first four items.',
        'And 294 isolates one loss: only A is restarted, while B, quiet 280 hours at the sweep, is inside 294 but outside a week. One hour decides whether a cart exists.'
      ]
    },

    /* ---------- 13 · main: the saving is the damage ---------- */
    {
      title: 'Save', layout: 'code',
      eyebrow: '13 · Writing the program · what the week saves',
      heading: 'A saving that appears only after the carts are gone',
      stand: 'Main measures the carts saved at every hour, up to hour 540 and beyond, for the week and for 294.',
      question: { step: 0, prompt: 'The week saves 2 carts at its best hour, 429. What has happened to those 2 carts by then?', options: [
        { text: 'They are both already erased: the saving is the damage.', correct: true, why: 'a expired at 414 and b at 429. The memory reclaimed is exactly the carts the shoppers lost.' },
        { text: 'They were written to the store, as planned.', correct: false, why: 'This measurement is of deleting, not writing out. Nothing was kept.' },
        { text: 'They were checked out and paid for.', correct: false, why: 'Nothing here models checkout. They left memory because they were idle.' } ] },
      code: P.build({ before: upTo(M_SAVE), add: [M_SAVE], step: 1 }),
      cards: [ { step: 2, title: 'Two halves, both true', html: '<p>At 294 the saving is <b>0</b> for every hour up to 540 — the chapter’s own figure. At a week it is <b>2</b>, at hour 429, after a expired at 414 and b at 429.[[src:vars]]</p>' } ],
      narration: [
        'Main measures the carts saved at every hour. The week saves 2 carts at its best hour, 429. What has happened to those 2 carts by then? Choose an answer.',
        'They are both already erased. Here is the measurement: A expired at hour 414 and B at 429, so the memory reclaimed is exactly the carts the shoppers lost.',
        'And at 294 the saving is 0 for every hour up to 540, the chapter’s own figure. So the real case for the bound is about scale, and the program goes and measures it there.'
      ]
    },

    /* ---------- 14 · main: the scale, and the price ---------- */
    {
      title: 'Price', layout: 'code',
      eyebrow: '14 · Writing the program · the scale, and the honest price',
      heading: 'Memory bounded by active shoppers; storage bounded by nothing',
      stand: 'Main builds 2,000 one-visit shoppers plus one regular, with an allowance of 100 hours.',
      question: { step: 0, prompt: 'Memory holds 102 carts at the end. Where are the other 1,899?', options: [
        { text: 'In the store, and they stay there for ever.', correct: true, why: 'Every shopper who ever visited is still in it. The fix moved the growth, it did not remove it.' },
        { text: 'Deleted, since they will never return.', correct: false, why: 'With the store, nothing is deleted. The program cannot know who will never return.' },
        { text: 'Spread across memory and the store.', correct: false, why: 'A cart lives in one place at a time: memory if active, the store if not.' } ] },
      code: P.build({ before: upTo(M_SCALE), add: [M_SCALE], step: 1 }),
      cards: [ { step: 2, title: 'The growth moved', html: '<p>Never expire: 2,001 carts in memory. At 100 hours: <b>102</b> — 1,899 saved, 5.1% of the state, and the store keeps them exact. But the store now holds <b>1,899</b> carts, and a store never pruned is the next version of this conversation.[[src:vars]]</p>' } ],
      narration: [
        'Main builds 2,000 one-visit shoppers plus one regular, with an allowance of 100 hours. Memory ends holding 102 carts. Where are the other 1,899? Choose an answer.',
        'In the store, and they stay there. Here is that run: memory holds 102 instead of 2,001, 5.1 percent of the state, and the store keeps every cart exact.',
        'But the store now holds 1,899 carts, one for every shopper who ever visited. The fix did not shrink the data; it moved the growth to where growth is affordable. A store never pruned is the next problem.'
      ]
    },

    /* ---------- 15 · main: many random streams ---------- */
    {
      title: 'Many', layout: 'code',
      eyebrow: '15 · Writing the program · 400 random streams',
      heading: 'The store is always exact; deleting only ever shortens',
      stand: 'The last piece runs 400 random streams at six allowances each: 2,400 runs.',
      question: { step: 0, prompt: 'In the runs where deleting got a cart wrong, what kind of wrong was it?', options: [
        { text: 'A cart with an item it never had.', correct: false, why: 'Never. Deleting can only remove what came before a drop, never invent an item.' },
        { text: 'Sometimes too long, sometimes too short.', correct: false, why: 'It is never too long. Every wrong cart was a strict tail of the true one.' },
        { text: 'Always a shorter cart: a strict suffix of the true one.', correct: true, why: 'In all 1,723 wrong runs the cart was a tail of the truth: never a wrong item, never an extra one.' } ] },
      code: P.build({ before: upTo(M_MANY), add: [M_MANY], step: 1 }),
      cards: [ { step: 2, title: 'What 2,400 runs show', html: '<p>The store reproduced the true cart every time. Deleting was exact in <b>677</b> runs and a strict suffix in <b>1,723</b>. At the longest silence nothing was restarted — though, as the corrected claim notes, some carts were missing entirely.[[src:vars]]</p>' } ],
      narration: [
        'The last piece runs 400 random streams at six allowances each, 2,400 runs. Where deleting got a cart wrong, what kind of wrong was it? Choose an answer.',
        'Always a shorter cart, a strict suffix. Here is the loop, with another corrected claim beside it: at the longest silence nothing is restarted, but a cart can still be missing entirely.',
        'The store reproduced the true cart every single time. Deleting was exact in 677 runs and a strict suffix in 1,723: never a wrong item, never an extra one, only a shorter cart.'
      ]
    },

    /* ---------- 16 · the whole program ---------- */
    {
      title: 'Whole', layout: 'code',
      eyebrow: '16 · The whole program',
      heading: 'Everything we wrote, in one file',
      stand: 'Scroll the listing. This is exactly the file the chapter runs and checks.',
      code: P.whole(),
      narration: [
        'Here is the whole program, every line, exactly as the chapter runs it. Scroll through it: you have seen each piece being written and why.',
        'From the top: the additions, the truth, the two ways to expire, the run with its reload, the measuring tools, the examples, and main, which checks every claim.'
      ]
    },

    /* ---------- 17 · what it prints ---------- */
    {
      title: 'Output', layout: 'code',
      eyebrow: '17 · Running it',
      heading: 'What the program prints',
      stand: 'Every line below was produced by actually running the program.',
      code: OUT.whole('what python3 programs/ch07_v3.py prints'),
      narration: [
        'Here is what it prints. The 13 examples agree with the true cart. Deleting at a week leaves only A’s 8; writing out keeps both carts with 1 reload.',
        'Then the suffix shape, the store exact at every allowance, the one-hour boundary, the saving that is the damage, the store holding 1,899 carts, and 400 random streams. Every assertion passed.'
      ]
    },

    /* ---------- 18 · recap ---------- */
    {
      title: 'Recap', layout: 'table',
      eyebrow: '18 · What you built',
      heading: 'Expire means move, not forget',
      stand: 'Each piece, in a sentence.',
      table: {
        columns: ['Piece', 'What it does', 'Here'],
        rows: [
          { step: 0, cells: ['<code>expire_by_deleting</code>', 'expire read as forget: a returning shopper looks new', 'a finds [8], b erased'] },
          { step: 0, cells: ['<code>expire_by_writing_out</code>', 'one more line: the cart moves to the store', 'memory freed the same'] },
          { step: 1, cells: ['<code>run</code>', 'reload before adding, if the store has the cart', 'exact, 1 reload'] },
          { step: 1, cells: ['<code>is_suffix</code> · <code>carts_held_at</code>', 'name the damage; count carts at an hour', 'saving 2 at hour 429'] },
          { step: 2, cells: ['the price', 'memory bounded by active shoppers; the store by nothing', '102 in memory, 1,899 stored'] }
        ]
      },
      side: { step: 3, title: 'The recognition', html: '<p>Here the expiry is the <b>feature</b>. Noticing that “expire” and “forget” were conflated is the whole move: write out on expiry, read back on return.[[src:vars]]</p>' },
      narration: [
        'To recap. Expiring by deleting reads expire as forget: A returns to find only 8, and B’s cart is erased. Writing out adds one line, and the cart moves to the store instead.',
        'Run reloads a cart before adding, so every shopper sees their whole cart. Is suffix names the damage, and carts held at shows that the saving appears only after the carts are gone.',
        'The price is honest: memory is bounded by active shoppers, 102 here, and the store by nothing, 1,899 carts.',
        'The thing to recognise: here expiry is the feature, and expire and forget had been treated as one word. Write out on expiry, read back on return.'
      ]
    }
  ]
};
