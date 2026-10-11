registerChapter({
  id: 'ch05',
  num: 5,
  title: 'Exactly-Once and Side Effects',
  pattern: 'Exactly-once means every record affects the output exactly once, and it decomposes into two problems — replaying sources and shuffles without double-counting (solved with deduplication and idempotency) and external side effects (the genuinely hard part).',
  aka: 'SS Ch05 · Exactly-Once · Idempotency · Deduplication · Side Effects · End-to-End Exactly-Once',
  part: 1,

  flow: [
    {
      section: 'What exactly-once means',
      walkthroughs: ['ch05-meaning', 'ch05-meaning-memory'],
      color: 'cyan',
      motivation: `"Exactly-once" is used loosely, so this section fixes the definition — it is about each record affecting the output exactly once, not about a magic guarantee that nothing is ever retried.`,
      steps: [
        { num: 1, title: 'Accuracy and completeness', detail: 'A correct pipeline is <strong>accurate</strong> (each result is right) and <strong>complete</strong> (every input contributes). Exactly-once means each record\'s contribution appears exactly once.' },
        { num: 2, title: 'Retries are the enemy of once', detail: 'In a distributed system, records are retried after crashes and timeouts. <strong>Exactly-once is the property that a retried record does not count twice.</strong>' },
        { num: 3, title: 'Two sub-problems', detail: 'Exactly-once splits into <strong>deduplicating records as they move between stages</strong> (sources and shuffles) and <strong>making the final effect idempotent</strong> (sinks and side effects).' },
        { num: 4, title: 'Exactly-once state vs exactly-once effects', detail: 'Making per-key state exactly-once is easy (recompute a deterministic value); making an <strong>external side effect</strong> exactly-once (send one email, charge one card) is the hard part.' }
      ],
    },
    {
      section: 'Idempotency and deduplication',
      walkthroughs: ['ch05-dedup', 'ch05-dedup-memory'],
      color: 'orange',
      motivation: `Exactly-once is not a single mechanism — it is deduplication at the boundaries plus idempotency at the effects, so this section separates the two and shows where each applies.`,
      steps: [
        { num: 1, title: 'Idempotent operations', detail: 'An operation is <strong>idempotent</strong> if performing it many times has the same effect as once. <strong>Setting window [12:08, 12:10) to 8 is idempotent; adding 8 to it is not.</strong>' },
        { num: 2, title: 'Deduplicate at the shuffle', detail: 'When a stage sends records to the next, the receiver can keep a set of <strong>already-seen record ids</strong> and drop duplicates. This is exactly-once delivery through the shuffle.' },
        { num: 3, title: 'Sources need replayable, deduplicable records', detail: 'A source that can be <strong>replayed from a checkpoint</strong> (a Kafka offset, a file offset) and whose records carry stable ids can be re-read without double-counting.' },
        { num: 4, title: 'End-to-end exactly-once = replay + an accuracy guard', detail: 'End-to-end exactly-once needs a replayable source plus at least one accuracy guard — a deduplicating shuffle or an <strong>idempotent sink</strong>. For an aggregation either guard alone is enough; for an external side effect only a key at the far end covers every crash point.' }
      ],
    },
    {
      section: 'Side effects — the hard part',
      walkthroughs: ['ch05-effects', 'ch05-effects-memory'],
      color: 'green',
      motivation: `The truly hard case is when the pipeline must do something in the outside world — send an email, call a payment API — because that effect cannot be undone by recomputation, so this section covers the patterns that make side effects tractable.`,
      steps: [
        { num: 1, title: 'Why side effects resist exactly-once', detail: 'A side effect touches the outside world, and the outside world cannot be "recomputed" the way per-key state can. <strong>Sending an email twice is visible; a database increment applied twice is money.</strong>' },
        { num: 2, title: 'Make the effect idempotent', detail: 'If the external system supports idempotency (a unique id, an upsert, an idempotency key), <strong>the pipeline can retry the effect safely</strong> — the external system deduplicates.' },
        { num: 3, title: 'Isolate side effects at the boundary', detail: 'Keep the main computation pure and <strong>push side effects to the very end</strong> of the pipeline, where retries are most controllable and the effect is a single idempotent write.' },
        { num: 4, title: 'Two-phase is expensive and fragile', detail: 'True end-to-end exactly-once across an external side effect often needs a <strong>two-phase commit</strong>, which is expensive and fragile. <strong>Prefer idempotent effects over distributed transactions.</strong>' }
      ],
    },
    {
      section: 'Google Interview Question',
      walkthroughs: ['ch05-interview-memory'],
      bands: ['PROGRAM'],
      color: 'purple',
      motivation: `A standalone interview problem, with three other surfaces the same program wears. Nothing here depends on this chapter's vocabulary: the problem, the one reframe that solves it, and the traced solution are self-contained, and the section stops where the program stops. Generated by \`tools/gen_ch05_interview.js\` on \`tools/interviewkit.js\`.`,
      steps: []
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Retries are unavoidable', content: '<p><strong>Why.</strong> Crashes and timeouts force retries, and a naive retry double-counts.</p><p><strong>Claim.</strong> Exactly-once is the property that a retried record does not affect the output twice.</p><p><strong>Grounding.</strong> The book defines exactly-once as each record affecting the output exactly once.</p><p><strong>In the wild.</strong> Kafka\'s exactly-once semantics and Flink\'s two-phase commit both target this.</p>' },
      { tag: 'solution', tagLabel: 'Property', title: '2. Idempotency', content: '<p><strong>Why.</strong> If an operation can be replayed without changing the result, retries are harmless.</p><p><strong>Claim.</strong> An idempotent operation has the same effect whether run once or many times — SET window [12:08, 12:10) = 8 is idempotent, ADD 8 is not (twice gives 16).</p><p><strong>Grounding.</strong> Idempotency is the property that makes sinks tolerate retries.</p><p><strong>In the wild.</strong> HTTP PUT and upserts are idempotent; a naive POST increment is not.</p>' },
      { tag: 'solution', tagLabel: 'Mechanism', title: '3. Shuffle deduplication', content: '<p><strong>Why.</strong> Records moving between stages can be delivered more than once after a crash.</p><p><strong>Claim.</strong> The receiver keeps a set of already-seen record ids and drops duplicates — exactly-once delivery through the shuffle.</p><p><strong>Grounding.</strong> Dedup turns two deliveries into one effect.</p><p><strong>In the wild.</strong> Beam\'s exactly-once shuffle and Flink\'s checkpoint barrier do this.</p>' },
      { tag: 'solution', tagLabel: 'Source', title: '4. Replayable sources', content: '<p><strong>Why.</strong> A source must be able to recover from a crash without losing or duplicating records.</p><p><strong>Claim.</strong> A replayable source exposes a checkpoint (offset) and its records carry stable ids, so re-reading is deduplicable.</p><p><strong>Grounding.</strong> Replay + stable ids = the source side of end-to-end exactly-once.</p><p><strong>In the wild.</strong> Kafka consumer offsets and file offsets are the canonical checkpoints.</p>' },
      { tag: 'solution', tagLabel: 'Composition', title: '5. End-to-end exactly-once', content: '<p><strong>Why.</strong> Completeness has one mechanism (replay); accuracy has two (dedup, idempotent sink).</p><p><strong>Claim.</strong> End-to-end exactly-once composes a replayable source with at least one accuracy guard — a deduplicating shuffle or an idempotent sink.</p><p><strong>Grounding.</strong> Drop the source and the total is lost; drop one accuracy guard and the other still holds for an aggregation. For a side effect the guard that counts is a key at the far end.</p><p><strong>In the wild.</strong> Kafka -> Flink -> idempotent sink is the reference architecture.</p>' },
      { tag: 'solution', tagLabel: 'Hard part', title: '6. Side effects', content: '<p><strong>Why.</strong> An external effect — an email, a charge, an API call — cannot be undone by recomputing state.</p><p><strong>Claim.</strong> Side effects are the hard part of exactly-once; they need idempotency keys or a two-phase commit.</p><p><strong>Grounding.</strong> Sending an email twice is visible; a double increment is money.</p><p><strong>In the wild.</strong> Stripe\'s Idempotency-Key header is the production form.</p>' },
      { tag: 'tradeoff', tagLabel: 'Pattern', title: '7. Idempotency key vs two-phase commit', content: '<p><strong>Why.</strong> Making an external side effect exactly-once has two options, and they differ sharply in cost.</p><p><strong>Claim.</strong> An idempotency key is cheap and robust; a two-phase commit is expensive and fragile.</p><p><strong>Grounding.</strong> Prefer idempotent effects over distributed transactions whenever the external system supports them.</p><p><strong>In the wild.</strong> Payment APIs accept idempotency keys; XA two-phase commit is avoided in stream processing.</p>' },
      { tag: 'tradeoff', tagLabel: 'Boundary', title: '8. Isolate side effects', content: '<p><strong>Why.</strong> Retries are most controllable when the effect is one idempotent write at the edge.</p><p><strong>Claim.</strong> Keep the main computation pure and push side effects to the very end of the pipeline.</p><p><strong>Grounding.</strong> A pure core plus a thin idempotent boundary is the cleanest exactly-once design.</p><p><strong>In the wild.</strong> Enrich -> compute -> idempotent upsert is the standard Dataflow shape.</p>' }
    ],
    examples: [
      { name: 'Stripe', desc: 'Idempotency-Key header makes payment retries safe' },
      { name: 'Apache Kafka', desc: 'Idempotent producer plus transactions for exactly-once semantics' },
      { name: 'Apache Flink', desc: 'Checkpointing plus two-phase commit sinks for end-to-end exactly-once' },
      { name: 'Google MillWheel', desc: 'Exactly-once stream processing at internet scale' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A payment pipeline charges cards from a stream; after a crash, some charges were retried and customers were billed twice.", q: "How do you guarantee a charge happens exactly once when the pipeline can crash and retry?", solution: "Give each charge an idempotency key (e.g. order id) and have the payment API deduplicate on it; make the sink idempotent so a retry is a no-op rather than a second charge.", components: ["Idempotency key — stable per-order id", "Idempotent sink — SET/upsert, not increment", "Replayable source — Kafka offset", "Dedup — drop duplicate deliveries"],  code: "// order-4 charge 6\n//   attempt 1 -> API sees key new -> charge, ledger 0->6\n//   retry      -> API sees key seen -> no-op, ledger stays 6\n//   without key: 2 attempts -> ledger 0->6->12 (double bill)", tieback: "This is exactly the idempotency-key side-effect material in this chapter.", refs: ["2. Idempotency", "6. Side effects", "7. Idempotency key vs two-phase commit"], problems: ["26-payment-system"] },
    { scenario: "A metrics pipeline recomputes per-key counts from a replayable source after a crash, but downstream sees doubled counts.", q: "Why do the counts double, and how do you make them exactly-once?", solution: "The retried records double-count because the sink is non-idempotent; make the sink an idempotent upsert (set the count) and deduplicate records at the shuffle.", components: ["Replayable source — offset", "Dedup — record ids", "Idempotent sink — upsert count"],  code: "// all 9 seed events folded, total 45; offset committed at 4, then crash\n//   replay re-delivers ids 5, 6, 7, 8 (sum 22) -> dedup drops all 4\n//   sink upserts each window total (SET), not += v\n//   -> total stays 45, not 67", tieback: "This is exactly the end-to-end exactly-once material in this chapter.", refs: ["3. Shuffle deduplication", "4. Replayable sources", "5. End-to-end exactly-once"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] }
  ],
  systemDesign: {
    walkthroughs: ['ch05-system', 'ch05-system-memory'],
    question: 'Design a payment pipeline that charges a card exactly once. Premise: the pipeline can crash and retry after a timeout, and a retry must not double-charge order-4.',
    pipeline: 'replayable source (offset) -> dedup shuffle -> idempotent sink (idempotency key) -> external system',
    decomposition: [
      { box: 'replayable source (offset)', role: 'replayable source — emits records with stable ids and a checkpoint',
        parts: [
          'a record {id: 4, order: "order-4", amount: 6} is emitted',
          'the checkpoint (offset) lets the pipeline resume after a crash',
          'records carry stable ids so they can be deduplicated'
        ] },
      { box: 'dedup shuffle', role: 'dedup shuffle — drops duplicate record deliveries',
        parts: [
          'the receiver keeps seen = { 0, 1, 2, 3 }',
          'first delivery of 4 records it -> seen grows to { 0, 1, 2, 3, 4 }',
          'a retry of 4 is dropped only while the receiving process is alive; a crash empties seen, so the replayed 4 gets through'
        ] },
      { box: 'idempotent sink (idempotency key)', role: 'idempotent sink — applies effects exactly once',
        parts: [
          'the sink writes with an idempotency key = order-4',
          'a SET/upsert replaces the value rather than incrementing',
          'a retry with the same key is a no-op at the sink'
        ] },
      { box: 'external system', role: 'external system — the outside-world effect',
        parts: [
          'the payment API deduplicates on the idempotency key',
          'a new key charges once; a seen key returns the prior result',
          'without the key, two attempts would double-bill'
        ] }
    ],
    
  },
  quiz: [
    { question: "What does exactly-once mean in this book?", options: ["A. No operation is ever retried", "B. Each record affects the output exactly once", "C. The pipeline never crashes", "D. Every window emits exactly one pane"], answer: 2, explanation: "Exactly-once is the property that a retried record does not affect the output twice.", conceptRef: "1. Retries are unavoidable" },
    { question: "Which operation is idempotent?", options: ["A. ADD 8", "B. SET window [12:08, 12:10) = 8", "C. INCREMENT", "D. APPEND"], answer: 2, explanation: "SET replaces the value, so running it twice has the same effect as once.", conceptRef: "2. Idempotency" },
    { question: "What are the three parts of end-to-end exactly-once?", options: ["A. Source, cache, queue", "B. Replayable source, deduplicating shuffle, idempotent sink", "C. Producer, broker, consumer", "D. Trigger, watermark, window"], answer: 2, explanation: "End-to-end exactly-once is built from a replayable source, a deduplicating shuffle and an idempotent sink; the source is required, and for an aggregation either of the other two is enough on its own.", conceptRef: "5. End-to-end exactly-once" },
    { question: "Why are side effects the hard part of exactly-once?", options: ["A. They are slow", "B. They touch the outside world and cannot be recomputed", "C. They use too much memory", "D. They require watermarks"], answer: 2, explanation: "An email or charge cannot be undone by recomputation, so it needs idempotency or a two-phase commit.", conceptRef: "6. Side effects" },
    { question: "Which is preferred for making a charge exactly-once?", options: ["A. Two-phase commit", "B. Idempotency key", "C. Retry without a key", "D. Ignoring failures"], answer: 2, explanation: "An idempotency key is cheap and robust; two-phase commit is expensive and fragile.", conceptRef: "7. Idempotency key vs two-phase commit" }
  ],
  seeAlso: [
    { to: 7, section: 'Consistency and recovery', depth: 'exactly-once state recovery needs a checkpoint that pairs state with the source offset — ch07 covers that machinery (barriers, state stores, aligned snapshots).', example: 'ch05\'s "replayable source + dedup shuffle + idempotent sink" is ch07\'s checkpoint { entries: {a@0:8, b@0:7, a@120:2, a@240:6}, offset: 4 }: restored with its matching offset it replays the 4 events after offset 4 and totals 45; with the offset reset it replays all 9 and totals 68 (double counted), and with the state lost it totals 22 (the prefix missing).' },
    { to: 6, section: 'The duality', depth: 'ch05\'s SET-instead-of-ADD is ch06\'s table view: a table row holds the current value, so writing it again is a no-op, while a stream of deltas is not.', example: 'ch05\'s SET instead of ADD is ch06\'s table versus its changelog: key "a"\'s row reads 24 however many times it is rewritten, while re-applying the stream\'s last delta (+8, the 16 → 24 update) a second time gives 32.' },
    { to: 4, section: 'Session semantics and pitfalls', depth: 'accumulating-and-retracting is the windowing-side twin of exactly-once — a late event that changes an emitted result must retract the old pane before emitting the new one.', example: 'ch05\'s dedup makes 2 deliveries → 1 effect; at gap 40 s ch04\'s late id 7 (12:00:50) turns key "b"\'s already-emitted session [12:01:30, 12:01:30] (7) into [12:00:50, 12:01:30] (11), so the pipeline retracts 7 before emitting 11 and an adding sink reads 11, not 18.' },
    { to: 2, section: 'How — accumulation', depth: 'the "how" axis decides whether a pane is a SET (accumulating) or an ADD (discarding, retracting), which decides whether ch05\'s idempotent sink is possible at all.', example: 'ch02\'s accumulating mode (15 then 19) is ch05\'s SET: each pane carries the whole total, so re-delivering it is harmless; the retracting mode (15, −15, 19) is still a pair of deltas, so re-delivering −15, 19 gives 23 and it needs dedup to survive a retry.' }
  ],
  sources: [
    { name: 'Akidau et al. — "MillWheel" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'Exactly-once stream processing and the side-effect problem in production' },
    { name: 'Confluent — "Exactly-Once Semantics Are Possible: Here\'s How Apache Kafka Does It"', url: 'https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/', note: 'How an idempotent producer plus transactions give end-to-end exactly-once' },
    { name: 'Stripe — Idempotency documentation', url: 'https://stripe.com/docs/idempotency', note: 'The Idempotency-Key pattern for retry-safe side effects' },
    { name: 'Apache Flink — Stateful stream processing', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/', note: 'Checkpointing and exactly-once state as the engine guarantee' }
  ]
});
