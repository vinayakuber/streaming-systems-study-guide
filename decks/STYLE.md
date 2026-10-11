# How a narrated deck explains

These rules come from the reader's own review of the first decks, made for the OLAP study guide.
The approved examples live in that repo: `/home/vinayak/olap-system-design-study-guide/decks/src/ch03-1.js` (Chapter 3,
Part 1 — the forward index; the reader called it "the perfect way"). Read it before writing a deck.
The same engine, builder and checks run here; only the chapters and the dataset differ.

## What the reader asked for

1. **A layman must understand it.** Assume the viewer has never seen a database, a stream
   of events, a clock skew or a window. Nothing is "obvious".
2. **Every deck stands alone.** Each part re-introduces the story and every word it uses,
   even if an earlier part already did. The build enforces this per deck (`jargon`).
3. **Never jump to a conclusion.** Introduce the example first (who uses it, what the rows
   mean), then the question, then the mechanism, then the conclusion. A term like
   "grouping" or "merging" only appears after a slide has shown why it is needed.
4. **Ask before telling.** At every key point, stop and ask the viewer a question with 2–4
   options (`layout: 'ask'`). The deck waits until they answer, then explains why the right
   answer is right and why each wrong one is wrong. About one question per 2–3 slides.
5. **Animate the mechanism.** When a structure is built or searched, show it happening
   (`layout: 'array'`: values dropping into slots, a slot picked out, a pointer sweeping
   with live counters). Prefer showing over describing.
6. **One small idea per step.** Short sentences, everyday words, an everyday comparison where
   it helps (a book's page numbers, a class register), then the real example.

## The shape of every deck

1. **Story** (`title`): who has this data, what they want to know, the numbers we will reach.
2. **The table / data** (`table`): the actual rows, with every word defined.
3. Then repeat, for each idea: **question** (`ask`) → **watch it** (`array` / `graph` /
   `table`) → **what it means** (cards or the `cards` of the slide).
4. **Check yourself** (`ask`), then **Recap** (`table`): each word in one sentence, and what
   the next part asks.

10–14 slides, 3–5 narration lines each. Tab titles ≤ 5 characters (Story, Table, Q1, Slots…).

## Hard rules (the build fails otherwise)

- Every `jargon` word is listed in some slide's `defines` at or before its first use.
- Every number on a slide must occur in the chapter's doc or in `tools/stream_seed.js`
  (`tools/deck_facts.js`). Never invent a figure; restate it the way the chapter states it.
- The voice never reads an acronym, a code name or a symbol: write it out, or add a `sayAs`
  pair in the deck file (`voice: { ...shared.voice, sayAs: { ...shared.voice.sayAs, … } }`).
- No Big-O notation; give the concrete count ("32 comparisons").
- Narration lines 60–300 characters. Every claim links to its chapter section (`[[src:KEY]]`).
- A question has 2–4 options, exactly one `correct`, and a `why` on every option.
- Load example data from `tools/stream_seed.js` when the chapter uses that dataset, and assert
  the few numbers the narration quotes, so the deck fails loudly if the data ever changes.

## The two interactive layouts

```js
{ layout: 'ask', question: { step: 0, prompt: '…?', options: [
    { text: '…', correct: true,  why: 'why this is right' },
    { text: '…', correct: false, why: 'why this is wrong' } ] },
  cards: [ { step: 1, title: '…', html: '<p>…</p>' } ],   // revealed after answering
  narration: [ 'asks the question', 'explains after the answer', … ] }

{ layout: 'array', array: {
    labelWidth: 120, slotLabel: 'slot',
    rows: [ { label: 'clicks file', values: [100, 800, …] } ],
    meters: ['slots read', 'total so far'],
    actions: [
      { step: 0, do: 'show', rows: [0] },                       // values drop in
      { step: 1, do: 'pick', slots: [3] },                      // light slot 3 in every row
      { step: 2, do: 'sweep', row: 0, mode: 'sum',              // or 'count' / 'match' + match: 41
        readMeter: 0, resultMeter: 1, speed: 150 } ] } }
```

## Checks to run (from the repo root)

    node tools/build_decks.js
    node tools/deck_facts.js
    DECK_SETTLE_MS=400 python3 tools/deck_gate.py <deck-file-prefix>

Then screenshot every slide and look at it: the checks measure geometry, not clarity.

## Interview programs: build them WITH the viewer

The reader's request: "At each and every step, ask me the question so that you can start
filling up the program. Finally, at the end, display the entire program. Do it for all the
variations." The approved example is `/home/vinayak/olap-system-design-study-guide/decks/src/ch03-4.js` (OLAP Chapter 3, Part 4).

- **One deck per program**: the chapter's main interview program, and one deck for EACH
  variation (`programs/chNN.py`, `chNN_v2.py`, `chNN_v3.py`, `chNN_v4.py`).
- **Story first.** Pose the problem in plain words with the real numbers, and let the viewer
  try a small case (an `ask`) before any code.
- **Then write the program in the order a person would write it**, one `code` slide per
  piece (the data, the obvious slow answer, the key idea, the search, each question it
  answers, the checks). Every `code` slide carries a `question` about what the next piece
  must do; its lines are hidden until it is answered, then appear highlighted.
- **Read the program from disk** with `decks/src/_prog.js` — `program('chNN_v2.py')`,
  then `fn('name')`, `span(fromText, toText)`, `block(text)` — and address pieces by their
  text, never by line number. Never paste code into a deck.
- **End with the whole file** (`P.whole()`) and **what it prints** (`program('chNN_v2.out').whole(...)`).
- **Guard the narration**: assert that the `.out` file still prints every result the
  narration quotes, so the deck fails to build if the program changes.
- Questions about code ask about the IDEA the next lines express (where the search starts,
  which test, what to return when nothing fits) — not about syntax.

## The interview questions at the end of a chapter

The chapter's "Interview Questions" (Q1, Q2) are not two quiz slides. The approved examples are
`/home/vinayak/olap-system-design-study-guide/decks/src/ch03-8.js` (system design) and `/home/vinayak/olap-system-design-study-guide/decks/src/ch03-9.js` (interview questions and quiz). For each one: tell the
scenario as a story, then probe it from several sides with 4–6 `ask` slides (what is slow and
why; which structure; what it costs; what breaks if you skip a step; a variation of the
numbers), and build its code snippet with `code` slides when it has one. Then the chapter
quiz as `ask` slides, then a recap.

## Which parts a chapter gets

- **A chapter with an interview program** (`programs/chNN.py` plus `_v2`–`_v4`): nine parts —
  1–3 its Flow sections, 4 the main program built with the viewer, 5–7 the three variations,
  8 the system design, 9 the interview questions and the quiz.
- **A chapter without one** (ch02, ch08, ch10): five parts — 1–3 its Flow sections, 4 the
  system design, 5 the interview questions and the quiz.
- An interview question's code snippet comes from the chapter source:
  `const { snippet } = require('./_prog'); const S = snippet('ch10', 0);` then
  `S.build({ add: [S.all] })` or `S.whole()` in a `code` slide. Never retype a snippet.
