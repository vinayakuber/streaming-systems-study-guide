registerChapter({
  id: 'ch06',
  num: 6,
  title: 'Streams and Tables',
  pattern: 'Streams and tables are two views of the same data — a stream is the change log of a table, and a table is the materialized aggregate of a stream — and every data-processing system picks a point on this duality.',
  aka: 'SS Ch06 · Stream-Table Duality · Change Log · Materialized View · Stream · Table',
  part: 2,

  flow: [
    {
      section: 'The two faces of data',
      color: 'cyan',
      motivation: `Every dataset has a moving form and a still form, and much confusion in data systems comes from not naming which one is being discussed, so this section fixes the two terms.`,
      steps: [
        { num: 1, title: 'A stream is motion', detail: 'A stream is a <strong>sequence of events over time</strong> — a change log, an event feed, an append-only sequence. It answers "what happened".' },
        { num: 2, title: 'A table is state', detail: 'A table is a <strong>snapshot of state at a point in time</strong> — a materialized view, a map, a balance. It answers "what is true now".' },
        { num: 3, title: 'They are two views of one thing', detail: 'The stream of balance changes and the table of current balances describe <strong>the same underlying data</strong>. The stream is the table\'s history; the table is the stream\'s present.' },
        { num: 4, title: 'Databases and event systems picked a side', detail: 'A relational database is table-centric (it materializes state); an event log like Kafka is stream-centric (it records motion). <strong>Each is a projection of the same duality.</strong>' }
      ],
      program: `// ACCOUNT SIDE — the same three balance changes seen as a stream and as a table
// DEF: stream — the append-only sequence of balance changes = [ +10, -3, +5 ]
// DEF: table — the materialized balance = 12
// -> input : the change event {op: +5, account: 42}
//    step 1 · append to the stream -> stream : [ +10, -3 ] -> [ +10, -3, +5 ]
//    step 2 · apply to the table -> table : 7 -> 12   BECAUSE 7 + 5 = 12
//    step 3 · the two views stay consistent -> stream tail +5 and table 12 describe the same account
// <- outcome : the stream gained one event and the table gained 5   BECAUSE the table is the running sum of the stream
//    derivation : table = +10 - 3 + 5 = 12, exactly the last value of the folded stream`
    },
    {
      section: 'The duality',
      color: 'orange',
      motivation: `The real power is the ability to move between the two views — aggregate a stream into a table, or capture a table's changes back into a stream — so this section covers both directions.`,
      steps: [
        { num: 1, title: 'Stream -> table by aggregation', detail: 'Aggregating a stream (sum, count, group-by) produces a table. <strong>The table is the materialized view of the stream</strong> — recompute it from the stream and you get the same state.' },
        { num: 2, title: 'Table -> stream by change capture', detail: 'Capturing a table\'s changes (inserts, updates, deletes) produces a stream — the <strong>change log</strong>. This is how change-data-capture (CDC) turns a database into a stream.' },
        { num: 3, title: 'The two directions are inverses', detail: '<strong>Aggregating the change log reproduces the table, and capturing the table\'s changes reproduces the change log.</strong> That round-trip is the duality.' },
        { num: 4, title: 'A changelog stream carries old and new values', detail: 'For an update to be reversible, the change record must carry <strong>both the old value (retraction) and the new value</strong> — a changelog stream, not just a list of new values.' }
      ],
      program: `// CHANGE-CAPTURE SIDE — a table update becomes a changelog record that can rebuild the table
// DEF: changelog — the stream of (old, new) pairs for a key = [ (0,10), (10,7), (7,12) ]
// DEF: table — the materialized balance = 12
// DEF: cdc — change-data-capture, which turns table writes into changelog records
// -> input : the database updates account 42 from 7 to 12
//    step 1 · capture the change -> changelog : [ (0,10), (10,7) ] -> [ (0,10), (10,7), (7,12) ]
//    step 2 · the downstream consumer folds the changelog -> table : 7 -> 12   BECAUSE the last pair (7,12) sets the new value
//    step 3 · a retraction of the old value is implicit in the pair -> the old 7 is replaced by the new 12
// <- outcome : the changelog gained (7,12) and the consumer table matches the source table at 12   BECAUSE change capture + fold = the same state
//    derivation : folding (0,10) then (10,7) then (7,12) = 12, the table value`
    },
    {
      section: 'Why the duality matters in practice',
      color: 'green',
      motivation: `The duality is not philosophy — it decides how systems store, replay, and rebuild state, so this section connects it to the concrete choices a streaming architecture makes.`,
      steps: [
        { num: 1, title: 'Materialization is a design choice', detail: 'You can materialize a table eagerly (store it) or <strong>recompute it from the stream on demand</strong>. Eager costs storage; lazy costs recompute time.' },
        { num: 2, title: 'Kafka is a changelog; a DB index is a table', detail: 'A Kafka topic is literally a changelog stream; a database index is a table built from it. <strong>Stream processors sit between the two.</strong>' },
        { num: 3, title: 'Time-travel is a table over the stream', detail: 'Because the stream is the full history, <strong>any past table is recoverable by folding the stream up to that point</strong> — the stream is the source of truth, the table is a derived view.' },
        { num: 4, title: 'Pick the right view for the question', detail: 'For "what is the balance now" use the table; for "what happened in order" use the stream. <strong>A good architecture keeps the stream as truth and derives tables as views.</strong>' }
      ],
      program: `// REPLAY SIDE — the stream rebuilds a past table, proving it is the source of truth
// DEF: stream — the full changelog = [ +10, -3, +5 ]
// DEF: table — a snapshot of balance, recoverable at any point
// STATE (before):
//    balance : { value: 0 }
// -> input : a request for the balance as of event 2
//    step 1 · fold events up to index 2 -> balance : 0 -> 10 -> 7
//    step 2 · the past table is materialized -> table : 7   BECAUSE +10 - 3 = 7
//    step 3 · fold one more event -> table : 7 -> 12   BECAUSE +5 brings it to the present
// <- outcome : the past table at event 2 is 7 and the present table is 12   BECAUSE both are folds of the same stream
//    derivation : table(t) = fold of stream[0..t], so table(2) = +10 - 3 = 7`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. One dataset, two forms', content: '<p><strong>Why.</strong> The same data appears as motion (what happened) and as state (what is true now), and mixing the two causes confusion.</p><p><strong>Claim.</strong> A stream is the change log; a table is the materialized view — two views of one thing.</p><p><strong>Grounding.</strong> The book\'s core Part II idea is the stream-table duality.</p><p><strong>In the wild.</strong> Kafka (stream) vs a database index (table) are the two projections.</p>' },
      { tag: 'solution', tagLabel: 'View', title: '2. Streams', content: '<p><strong>Why.</strong> Order of events and history matter when the question is "what happened".</p><p><strong>Claim.</strong> A stream is a sequence of events over time — an append-only change log.</p><p><strong>Grounding.</strong> It answers "what happened".</p><p><strong>In the wild.</strong> A Kafka topic is a stream.</p>' },
      { tag: 'solution', tagLabel: 'View', title: '3. Tables', content: '<p><strong>Why.</strong> A point-in-time answer needs a snapshot, not a history.</p><p><strong>Claim.</strong> A table is a snapshot of state at a point in time — a materialized view.</p><p><strong>Grounding.</strong> It answers "what is true now".</p><p><strong>In the wild.</strong> A SQL materialized view or a database index is a table.</p>' },
      { tag: 'solution', tagLabel: 'Direction', title: '4. Stream -> table', content: '<p><strong>Why.</strong> To answer "what is the current total" from a feed of events, aggregate them.</p><p><strong>Claim.</strong> Aggregating a stream produces a table — the materialized view of the stream.</p><p><strong>Grounding.</strong> The table is the fold of the stream.</p><p><strong>In the wild.</strong> A Flink keyed aggregation produces a stateful table.</p>' },
      { tag: 'solution', tagLabel: 'Direction', title: '5. Table -> stream', content: '<p><strong>Why.</strong> To react to database changes in real time, capture them as a feed.</p><p><strong>Claim.</strong> Capturing a table\'s changes produces a changelog stream — change-data-capture.</p><p><strong>Grounding.</strong> The changelog records (old, new) pairs so updates are reversible.</p><p><strong>In the wild.</strong> Debezium CDC turns MySQL/Postgres into Kafka changelogs.</p>' },
      { tag: 'solution', tagLabel: 'Duality', title: '6. The round-trip', content: '<p><strong>Why.</strong> The two directions should be inverses — that is the formal statement of the duality.</p><p><strong>Claim.</strong> Aggregating the change log reproduces the table; capturing the table\'s changes reproduces the change log.</p><p><strong>Grounding.</strong> The round-trip is lossless for a changelog that carries old and new values.</p><p><strong>In the wild.</strong> This is the theoretical basis for stream-table systems.</p>' },
      { tag: 'tradeoff', tagLabel: 'Choice', title: '7. Materialize vs recompute', content: '<p><strong>Why.</strong> Keeping a table has a cost, and recomputing it also has a cost — the duality makes the trade explicit.</p><p><strong>Claim.</strong> Eager materialization costs storage; lazy recompute-from-stream costs time.</p><p><strong>Grounding.</strong> The stream is the source of truth; the table is a derived view.</p><p><strong>In the wild.</strong> A cache (eager) vs a query-time fold (lazy) is the production choice.</p>' },
      { tag: 'tradeoff', tagLabel: 'Truth', title: '8. Stream as source of truth', content: '<p><strong>Why.</strong> A table alone loses history; a stream alone is inconvenient for lookups.</p><p><strong>Claim.</strong> Keep the stream as the source of truth and derive tables as views — any past table is a fold of the stream up to that point.</p><p><strong>Grounding.</strong> Time-travel is free if the stream is retained.</p><p><strong>In the wild.</strong> Event-sourced systems are the production form.</p>' }
    ],
    examples: [
      { name: 'Kafka', desc: 'The changelog stream; the log is the source of truth' },
      { name: 'Debezium', desc: 'Change-data-capture turning tables into changelog streams' },
      { name: 'Event sourcing', desc: 'Keeping the stream as truth and deriving tables as projections' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A service stores account balances in a database but also needs a real-time feed of balance changes for fraud detection; the two systems keep drifting out of sync.", q: "How do you keep a table of balances and a stream of balance changes as two consistent views of the same data?", solution: "Treat them as the stream-table duality: capture the database's changes into a changelog stream (CDC), and derive the table as the materialized fold of that stream.", components: ["Table — the database state", "Changelog stream — CDC output", "Fold — rebuilds the table from the stream", "Retraction — (old, new) pairs"], diagram: "flowchart LR\n  T[(table)] -->|CDC| C[\"changelog stream\"]\n  C -->|fold| V[(materialized view)]\n  V -->|matches| T", code: "// table balance 7 -> 12\n//   CDC emits (7,12) to the changelog\n//   consumer folds -> table 12 (matches source)\n//   stream = source of truth, table = derived view", tieback: "This is exactly the stream-table duality material in this chapter.", refs: ["5. Table -> stream", "6. The round-trip", "8. Stream as source of truth"], problems: ["26-payment-system"] },
    { scenario: "An ad-click pipeline needs both a per-minute event feed and a per-campaign running total, but the team built two separate systems that disagree.", q: "How do you model the event feed and the running total so they never disagree?", solution: "Keep the event feed as the stream of truth and derive the per-campaign total as a table by aggregating the stream — one system, two views.", components: ["Stream — the event feed", "Table — the per-campaign total", "Aggregation — stream -> table"], diagram: "flowchart LR\n  E[\"click stream\"] --> A[\"aggregate by campaign\"]\n  A --> T[(campaign totals)]", code: "// clicks [ +1, +1, +1 ] campaign C\n//   stream: 3 events, table: total 3\n//   both from the same source -> cannot disagree", tieback: "This is exactly the stream -> table material in this chapter.", refs: ["4. Stream -> table", "7. Materialize vs recompute"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    question: 'Design one system that keeps a balance table and a balance-change stream as two consistent views. Use case: fraud detection needs the real-time change feed while the database holds current balances. Premise: the table is the materialized fold of the changelog (CDC), so the two views cannot drift.',
    pipeline: 'database (table) -> change capture (CDC) -> changelog stream -> stream processor (fold) -> materialized view (table)',
    decomposition: [
      { box: 'database (table)', role: 'database — holds the source table',
        parts: [
          'account 42 balance is 7, then updates to 12',
          'the database is table-centric state',
          'the update is the event that CDC will capture'
        ] },
      { box: 'change capture (CDC)', role: 'change capture — turns table writes into a changelog',
        parts: [
          'the update 7 -> 12 emits the changelog record (7,12)',
          'the record carries the old value for retraction',
          'the changelog is append-only and ordered'
        ] },
      { box: 'changelog stream', role: 'changelog stream — the stream view of the data',
        parts: [
          'the stream is [ (0,10), (10,7), (7,12) ]',
          'it is the source of truth — history is retained',
          'any past table is a fold up to that point'
        ] },
      { box: 'stream processor (fold)', role: 'stream processor — derives tables from the stream',
        parts: [
          'the fold applies each (old, new) pair',
          'after (7,12) the materialized balance is 12',
          'the derived table matches the source database'
        ] }
    ],
    wiring: "flowchart LR\n  D[(database table)] -->|CDC| C[\"changelog stream\"]\n  C -->|fold| P[\"stream processor\"]\n  P --> V[(materialized view)]\n  V -.matches.-> D",
    program: `// SYSTEM DESIGN — a balance update flows from table to changelog and back to a matching table
// DEF: changelog — the stream of (old, new) pairs = [ (0,10), (10,7) ]
// DEF: table — the materialized balance = 7
// DEF: cdc — change-data-capture, which turns table writes into changelog records = (7,12)
// DEF: account — the balance record keyed by user = 42
// STATE (before):
//    account_state : { 42: 7 }
// -> input : the database updates account 42 from 7 to 12
//    step 1 · CDC captures the change -> changelog : [ (0,10), (10,7) ] -> [ (0,10), (10,7), (7,12) ]
//    step 2 · the processor folds the new pair -> account_state : { 42: 7 } -> { 42: 12 }   BECAUSE 7 + (12 - 7) = 12
//    step 3 · the derived view matches the source -> table : 7 -> 12   BECAUSE the fold reproduces the database state
// <- outcome : the changelog gained (7,12) and the materialized view matches the database at 12   BECAUSE table and stream are dual
//    derivation : fold (0,10) then (10,7) then (7,12) = 12, the same as the source table`
  },
  quiz: [
    { question: "What is a stream in the stream-table duality?", options: ["A. A snapshot of state", "B. A sequence of events over time", "C. A database index", "D. A materialized view"], answer: 2, explanation: "A stream is the moving, append-only change log.", conceptRef: "2. Streams" },
    { question: "What is a table in the stream-table duality?", options: ["A. An event feed", "B. A changelog", "C. A snapshot of state at a point in time", "D. A retraction"], answer: 3, explanation: "A table is the still, materialized view of state.", conceptRef: "3. Tables" },
    { question: "Aggregating a stream produces a ___ .", options: ["A. stream", "B. table", "C. changelog", "D. watermark"], answer: 2, explanation: "Aggregation folds the stream into a materialized table.", conceptRef: "4. Stream -> table" },
    { question: "What does change-data-capture (CDC) produce?", options: ["A. A table", "B. A changelog stream of a table's changes", "C. A watermark", "D. A window"], answer: 2, explanation: "CDC turns table writes into a changelog stream of (old, new) pairs.", conceptRef: "5. Table -> stream" },
    { question: "Why keep the stream as the source of truth?", options: ["A. It is faster to query", "B. Any past table is recoverable by folding the stream", "C. It uses less storage", "D. It never needs retractions"], answer: 2, explanation: "The stream is the full history, so any past table is a fold up to that point.", conceptRef: "8. Stream as source of truth" }
  ]
});
