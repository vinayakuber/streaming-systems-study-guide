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
      color: 'cyan',
      motivation: `"Exactly-once" is used loosely, so this section fixes the definition — it is about each record affecting the output exactly once, not about a magic guarantee that nothing is ever retried.`,
      steps: [
        { num: 1, title: 'Accuracy and completeness', detail: 'A correct pipeline is <strong>accurate</strong> (each result is right) and <strong>complete</strong> (every input contributes). Exactly-once means each record\'s contribution appears exactly once.' },
        { num: 2, title: 'Retries are the enemy of once', detail: 'In a distributed system, records are retried after crashes and timeouts. <strong>Exactly-once is the property that a retried record does not count twice.</strong>' },
        { num: 3, title: 'Two sub-problems', detail: 'Exactly-once splits into <strong>deduplicating records as they move between stages</strong> (sources and shuffles) and <strong>making the final effect idempotent</strong> (sinks and side effects).' },
        { num: 4, title: 'Exactly-once state vs exactly-once effects', detail: 'Making per-key state exactly-once is easy (recompute a deterministic value); making an <strong>external side effect</strong> exactly-once (send one email, charge one card) is the hard part.' }
      ],
      program: `// SHUFFLE SIDE — a retried record is deduplicated so it does not double-count
// DEF: record — a keyed element {id: "r7", key: 42, value: 10}
// DEF: dedup — a store of record ids already delivered, holding seen = { r1, r2, r3 }
// DEF: seen — the set of delivered ids = { r1, r2, r3 }
// -> input : the shuffle delivers record {id: "r7", key: 42, value: 10}
//    step 1 · check the id -> seen has no r7 -> delivered : false -> true
//    step 2 · record the id -> seen : { r1, r2, r3 } -> { r1, r2, r3, r7 }
//    step 3 · the retry delivers the same record again -> seen has r7 -> dropped   BECAUSE the id was already recorded
// <- outcome : the downstream stage reads r7 exactly once   BECAUSE the second delivery was a duplicate
//    derivation : dedup makes 2 deliveries -> 1 effect, so the record contributes value 10 once, not 20`
    },
    {
      section: 'Idempotency and deduplication',
      color: 'orange',
      motivation: `Exactly-once is not a single mechanism — it is deduplication at the boundaries plus idempotency at the effects, so this section separates the two and shows where each applies.`,
      steps: [
        { num: 1, title: 'Idempotent operations', detail: 'An operation is <strong>idempotent</strong> if performing it many times has the same effect as once. <strong>Setting a value to 10 is idempotent; incrementing by 10 is not.</strong>' },
        { num: 2, title: 'Deduplicate at the shuffle', detail: 'When a stage sends records to the next, the receiver can keep a set of <strong>already-seen record ids</strong> and drop duplicates. This is exactly-once delivery through the shuffle.' },
        { num: 3, title: 'Sources need replayable, deduplicable records', detail: 'A source that can be <strong>replayed from a checkpoint</strong> (a Kafka offset, a file offset) and whose records carry stable ids can be re-read without double-counting.' },
        { num: 4, title: 'End-to-end exactly-once = source + shuffle + sink', detail: 'End-to-end exactly-once composes: a replayable source, a deduplicating shuffle, and an <strong>idempotent sink</strong>. Drop any one and the guarantee breaks.' }
      ],
      program: `// SINK SIDE — an idempotent write absorbs a retry, a non-idempotent one double-counts
// DEF: idempotent write — writing the same (key, value) twice leaves one value = SET 42 -> 10
// DEF: non-idempotent write — a counter that increments = ADD 10
// DEF: balance — the downstream account state = 30
// STATE (before):
//    balance : { 42: 30 }
// -> input : the sink receives record {key: 42, value: 10} and then a retry of the same record
//    step 1 · first delivery, idempotent path -> balance : 30 -> 10   BECAUSE SET replaces the old value
//    step 2 · retry, idempotent path -> the key is already seen -> skip -> balance : 10 -> 10   BECAUSE SET 10 again is the same effect
//    step 3 · counter path comparison -> balance : 30 -> 40 -> 50   BECAUSE ADD 10 runs twice
// <- outcome : the idempotent sink ends at 10, the counter ends at 50 for the same two deliveries   BECAUSE only the idempotent write tolerates the retry
//    derivation : 2 deliveries x ADD 10 = +20, but exactly-once requires +10 -> the sink must be idempotent`
    },
    {
      section: 'Side effects — the hard part',
      color: 'green',
      motivation: `The truly hard case is when the pipeline must do something in the outside world — send an email, call a payment API — because that effect cannot be undone by recomputation, so this section covers the patterns that make side effects tractable.`,
      steps: [
        { num: 1, title: 'Why side effects resist exactly-once', detail: 'A side effect touches the outside world, and the outside world cannot be "recomputed" the way per-key state can. <strong>Sending an email twice is visible; a database increment applied twice is money.</strong>' },
        { num: 2, title: 'Make the effect idempotent', detail: 'If the external system supports idempotency (a unique id, an upsert, an idempotency key), <strong>the pipeline can retry the effect safely</strong> — the external system deduplicates.' },
        { num: 3, title: 'Isolate side effects at the boundary', detail: 'Keep the main computation pure and <strong>push side effects to the very end</strong> of the pipeline, where retries are most controllable and the effect is a single idempotent write.' },
        { num: 4, title: 'Two-phase is expensive and fragile', detail: 'True end-to-end exactly-once across an external side effect often needs a <strong>two-phase commit</strong>, which is expensive and fragile. <strong>Prefer idempotent effects over distributed transactions.</strong>' }
      ],
      program: `// PAYMENT SIDE — an idempotency key makes a charge retry-safe, a plain charge double-bills
// DEF: idempotency key — a unique id the external system uses to deduplicate = "order-99"
// DEF: charge — a side effect on the card = charge $10 for order-99
// DEF: card_ledger — the external ledger = 0
// DEF: card — the customer payment instrument charged = card ending 4242
// DEF: ledger — the external balance record the charge writes = 0
// STATE (before):
//    card_ledger : { "order-99": 0 }
// -> input : the pipeline attempts the charge for order-99, then retries after a timeout
//    step 1 · first attempt with the key -> card_ledger : 0 -> 10   BECAUSE the charge succeeds and records the key
//    step 2 · retry with the same key -> card_ledger : 10 -> 10   BECAUSE the external system sees order-99 already charged
//    step 3 · plain charge comparison -> card_ledger : 0 -> 10 -> 20   BECAUSE the retry has no key to deduplicate on
// <- outcome : the idempotent charge bills $10, the plain charge bills $20 for the same two attempts   BECAUSE only the key deduplicates the side effect
//    derivation : exactly-once side effect = one charge of $10, not two, thanks to idempotency key order-99`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Retries are unavoidable', content: '<p><strong>Why.</strong> Crashes and timeouts force retries, and a naive retry double-counts.</p><p><strong>Claim.</strong> Exactly-once is the property that a retried record does not affect the output twice.</p><p><strong>Grounding.</strong> The book defines exactly-once as each record affecting the output exactly once.</p><p><strong>In the wild.</strong> Kafka\'s exactly-once semantics and Flink\'s two-phase commit both target this.</p>' },
      { tag: 'solution', tagLabel: 'Property', title: '2. Idempotency', content: '<p><strong>Why.</strong> If an operation can be replayed without changing the result, retries are harmless.</p><p><strong>Claim.</strong> An idempotent operation has the same effect whether run once or many times — SET 42 -> 10 is idempotent, ADD 10 is not.</p><p><strong>Grounding.</strong> Idempotency is the property that makes sinks tolerate retries.</p><p><strong>In the wild.</strong> HTTP PUT and upserts are idempotent; a naive POST increment is not.</p>' },
      { tag: 'solution', tagLabel: 'Mechanism', title: '3. Shuffle deduplication', content: '<p><strong>Why.</strong> Records moving between stages can be delivered more than once after a crash.</p><p><strong>Claim.</strong> The receiver keeps a set of already-seen record ids and drops duplicates — exactly-once delivery through the shuffle.</p><p><strong>Grounding.</strong> Dedup turns two deliveries into one effect.</p><p><strong>In the wild.</strong> Beam\'s exactly-once shuffle and Flink\'s checkpoint barrier do this.</p>' },
      { tag: 'solution', tagLabel: 'Source', title: '4. Replayable sources', content: '<p><strong>Why.</strong> A source must be able to recover from a crash without losing or duplicating records.</p><p><strong>Claim.</strong> A replayable source exposes a checkpoint (offset) and its records carry stable ids, so re-reading is deduplicable.</p><p><strong>Grounding.</strong> Replay + stable ids = the source side of end-to-end exactly-once.</p><p><strong>In the wild.</strong> Kafka consumer offsets and file offsets are the canonical checkpoints.</p>' },
      { tag: 'solution', tagLabel: 'Composition', title: '5. End-to-end exactly-once', content: '<p><strong>Why.</strong> Each stage has its own failure mode, so a single dedup is not enough.</p><p><strong>Claim.</strong> End-to-end exactly-once composes a replayable source, a deduplicating shuffle, and an idempotent sink.</p><p><strong>Grounding.</strong> Drop any one of the three and the guarantee breaks.</p><p><strong>In the wild.</strong> Kafka -> Flink -> idempotent sink is the reference architecture.</p>' },
      { tag: 'solution', tagLabel: 'Hard part', title: '6. Side effects', content: '<p><strong>Why.</strong> An external effect — an email, a charge, an API call — cannot be undone by recomputing state.</p><p><strong>Claim.</strong> Side effects are the hard part of exactly-once; they need idempotency keys or a two-phase commit.</p><p><strong>Grounding.</strong> Sending an email twice is visible; a double increment is money.</p><p><strong>In the wild.</strong> Stripe\'s Idempotency-Key header is the production form.</p>' },
      { tag: 'tradeoff', tagLabel: 'Pattern', title: '7. Idempotency key vs two-phase commit', content: '<p><strong>Why.</strong> Making an external side effect exactly-once has two options, and they differ sharply in cost.</p><p><strong>Claim.</strong> An idempotency key is cheap and robust; a two-phase commit is expensive and fragile.</p><p><strong>Grounding.</strong> Prefer idempotent effects over distributed transactions whenever the external system supports them.</p><p><strong>In the wild.</strong> Payment APIs accept idempotency keys; XA two-phase commit is avoided in stream processing.</p>' },
      { tag: 'tradeoff', tagLabel: 'Boundary', title: '8. Isolate side effects', content: '<p><strong>Why.</strong> Retries are most controllable when the effect is one idempotent write at the edge.</p><p><strong>Claim.</strong> Keep the main computation pure and push side effects to the very end of the pipeline.</p><p><strong>Grounding.</strong> A pure core plus a thin idempotent boundary is the cleanest exactly-once design.</p><p><strong>In the wild.</strong> Enrich -> compute -> idempotent upsert is the standard Dataflow shape.</p>' }
    ],
    examples: [
      { name: 'Stripe', desc: 'Idempotency-Key header makes charge retries safe' },
      { name: 'Apache Kafka', desc: 'Exactly-once semantics via idempotent producer + transactions' },
      { name: 'Apache Flink', desc: 'Two-phase commit sinks for end-to-end exactly-once' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A payment pipeline charges cards from a stream; after a crash, some charges were retried and customers were billed twice.", q: "How do you guarantee a charge happens exactly once when the pipeline can crash and retry?", solution: "Give each charge an idempotency key (e.g. order id) and have the payment API deduplicate on it; make the sink idempotent so a retry is a no-op rather than a second charge.", components: ["Idempotency key — stable per-order id", "Idempotent sink — SET/upsert, not increment", "Replayable source — Kafka offset", "Dedup — drop duplicate deliveries"], diagram: "flowchart LR\n  S[\"source (replayable)\"] --> D[\"dedup shuffle\"]\n  D --> K[\"sink with idempotency key\"]\n  K --> P[\"payment API\"]\n  P -->|key seen| N[\"no-op\"]\n  P -->|key new| C[\"charge once\"]", code: "// order-99 charge $10\n//   attempt 1 -> API sees key new -> charge, ledger 0->10\n//   retry      -> API sees key seen -> no-op, ledger stays 10\n//   without key: 2 attempts -> ledger 0->10->20 (double bill)", tieback: "This is exactly the idempotency-key side-effect material in this chapter.", refs: ["2. Idempotency", "6. Side effects", "7. Idempotency key vs two-phase commit"], problems: ["26-payment-system"] },
    { scenario: "A metrics pipeline recomputes per-key counts from a replayable source after a crash, but downstream sees doubled counts.", q: "Why do the counts double, and how do you make them exactly-once?", solution: "The retried records double-count because the sink is non-idempotent; make the sink an idempotent upsert (set the count) and deduplicate records at the shuffle.", components: ["Replayable source — offset", "Dedup — record ids", "Idempotent sink — upsert count"], diagram: "flowchart LR\n  R[\"replay from offset\"] --> D[\"dedup\"]\n  D --> U[\"upsert count\"]\n  U --> S[(count = 10)]", code: "// count before crash = 10\n//   replay delivers same records -> dedup drops duplicates\n//   sink upserts count = 10 (SET), not += 10\n//   -> count stays 10, not 20", tieback: "This is exactly the end-to-end exactly-once material in this chapter.", refs: ["3. Shuffle deduplication", "4. Replayable sources", "5. End-to-end exactly-once"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] }
  ],
  systemDesign: {
    pipeline: 'replayable source (offset) -> dedup shuffle -> idempotent sink (idempotency key) -> external system',
    decomposition: [
      { box: 'replayable source (offset)', role: 'replayable source — emits records with stable ids and a checkpoint',
        parts: [
          'a record {id: "r7", order: "order-99", amount: 10} is emitted',
          'the checkpoint (offset) lets the pipeline resume after a crash',
          'records carry stable ids so they can be deduplicated'
        ] },
      { box: 'dedup shuffle', role: 'dedup shuffle — drops duplicate record deliveries',
        parts: [
          'the receiver keeps seen = { r1, r2, r3 }',
          'first delivery of r7 records it -> seen grows to { r1, r2, r3, r7 }',
          'a retry of r7 is dropped because the id is already seen'
        ] },
      { box: 'idempotent sink (idempotency key)', role: 'idempotent sink — applies effects exactly once',
        parts: [
          'the sink writes with an idempotency key = order-99',
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
    wiring: "flowchart LR\n  S[\"replayable source\"] --> D[\"dedup shuffle\"]\n  D --> K[\"idempotent sink\"]\n  K --> X[\"external system\"]",
    program: `// SYSTEM DESIGN — a crash and retry still charge the card exactly once via the idempotency key
// DEF: idempotency key — a unique id the external system deduplicates on = "order-99"
// DEF: dedup — a set of record ids already delivered = { r1, r2, r3 }
// DEF: charge — the side effect = charge $10 for order-99
// STATE (before):
//    card_ledger : 0
// -> input : the pipeline attempts the charge for order-99, then retries after a timeout
//    step 1 · first delivery of r7 -> dedup : { r1, r2, r3 } -> { r1, r2, r3, r7 }   BECAUSE r7 is new
//    step 2 · the charge succeeds -> card_ledger : 0 -> 10   BECAUSE the API sees the key order-99 as new
//    step 3 · the retry delivers r7 again -> dropped by dedup -> card_ledger : 10 -> 10   BECAUSE the key is now seen
// <- outcome : the card is charged exactly $10   BECAUSE dedup blocked the retry and the key made the effect idempotent
//    derivation : 2 deliveries of r7 -> 1 charge of $10, so exactly-once holds end to end`
  },
  quiz: [
    { question: "What does exactly-once mean in this book?", options: ["A. No operation is ever retried", "B. Each record affects the output exactly once", "C. The pipeline never crashes", "D. Every window emits exactly one pane"], answer: 2, explanation: "Exactly-once is the property that a retried record does not affect the output twice.", conceptRef: "1. Retries are unavoidable" },
    { question: "Which operation is idempotent?", options: ["A. ADD 10", "B. SET 42 -> 10", "C. INCREMENT", "D. APPEND"], answer: 2, explanation: "SET replaces the value, so running it twice has the same effect as once.", conceptRef: "2. Idempotency" },
    { question: "What are the three parts of end-to-end exactly-once?", options: ["A. Source, cache, queue", "B. Replayable source, deduplicating shuffle, idempotent sink", "C. Producer, broker, consumer", "D. Trigger, watermark, window"], answer: 2, explanation: "End-to-end exactly-once composes a replayable source, a deduplicating shuffle, and an idempotent sink.", conceptRef: "5. End-to-end exactly-once" },
    { question: "Why are side effects the hard part of exactly-once?", options: ["A. They are slow", "B. They touch the outside world and cannot be recomputed", "C. They use too much memory", "D. They require watermarks"], answer: 2, explanation: "An email or charge cannot be undone by recomputation, so it needs idempotency or a two-phase commit.", conceptRef: "6. Side effects" },
    { question: "Which is preferred for making a charge exactly-once?", options: ["A. Two-phase commit", "B. Idempotency key", "C. Retry without a key", "D. Ignoring failures"], answer: 2, explanation: "An idempotency key is cheap and robust; two-phase commit is expensive and fragile.", conceptRef: "7. Idempotency key vs two-phase commit" }
  ]
});
