registerChapter({
  id: 'ch07',
  num: 7,
  title: 'The Practicalities of Persistent State',
  pattern: 'A stream processor that holds state must be able to persist and recover it — checkpoints, state stores, and incremental snapshots turn in-memory aggregation into durable, restartable computation.',
  aka: 'SS Ch07 · Persistent State · Checkpoint · State Store · RocksDB · Recovery · Incremental Snapshot',
  part: 2,

  flow: [
    {
      section: 'Why state must persist',
      color: 'cyan',
      motivation: `A pipeline that keeps a running count in memory loses it on restart, so this section establishes why durable state is a requirement, not an optimization.`,
      steps: [
        { num: 1, title: 'State is the aggregation in progress', detail: 'A keyed count, a session, a running sum — <strong>state is everything the pipeline remembers between events</strong>. Without it, each event would start from scratch.' },
        { num: 2, title: 'Restarts must not lose state', detail: 'Machines crash and jobs redeploy. <strong>Persistent state means the aggregation survives a restart</strong> and continues where it left off, rather than re-reading the whole stream.' },
        { num: 3, title: 'Recovery is about correctness and cost', detail: 'Losing state forces a full reprocessing of the stream — <strong>correct but slow</strong>. Persisting state makes recovery <strong>fast and still correct</strong>.' },
        { num: 4, title: 'The stream is the truth, state is a cache of it', detail: 'Persistent state is a materialized fold of the stream. <strong>You can always rebuild it from the stream, but persisting it avoids the rebuild cost.</strong>' }
      ],
      program: `// COUNT SIDE — a restart loses in-memory state but a checkpoint preserves it
// DEF: state — the running per-key count = { 42: 10 }
// DEF: checkpoint — a durable snapshot of state taken periodically = every 60 s
// DEF: restart — the job restarts and resumes from the checkpoint = at offset 13
// STATE (before):
//    count_state : { 42: 10 }
// ======================================================================
// offset 10: {key: 42, value: 1}
// offset 11: {key: 42, value: 1}
// offset 12: {key: 42, value: 1}
// ======================================================================
// BUILD PHASE · run once at the checkpoint interval
// step 0 · initialize the count register -> count_state : none -> { 42: 10 }
//    -> input  : the running per-key count = { 42: 10 }
//    <- output : count_state = { 42: 10 }   BECAUSE the pipeline resumes from the last fold
// QUERY PHASE · per event (or per checkpoint)
// step 1 · fold the three events -> count_state[42] : 10 -> 13
//    -> input  : events = [1, 1, 1] for key 42, count_state = { 42: 10 }
//    <- output : count_state[42] = 13   BECAUSE 10 + 3 = 13
// step 2 · the checkpoint saves -> durable : {} -> { 42: 13 }
//    -> input  : count_state = { 42: 13 }, checkpoint interval = 60 s
//    <- output : durable = { 42: 13 }   BECAUSE the periodic snapshot fired
// step 3 · the restart restores -> count_state[42] : 0 -> 13
//    -> input  : durable = { 42: 13 }, count_state = { 42: 0 }
//    decode 3a · read the checkpoint value for key 42 -> saved : none -> 13
//    decode 3b · load the saved value into count_state -> count_state[42] : 0 -> 13
//    <- output : count_state[42] = 13   BECAUSE the checkpoint holds the last count
// ======================================================================
// TRACE (three events of value 1 for key 42):
//    phase       | count_state | durable
//    fold 3      | 13          | {}
//    checkpoint  | 13          | { 42: 13 }
//    restart     | 13          | { 42: 13 }
// CORRECTNESS (checkpoint-invariant lemma): the checkpoint stores the count at a consistent point — 10 + 3 = 13 — and
//    the restart loads 13 rather than 0, so recovery skips re-reading the 10 events already folded.
// VARIANTS (when to pick which):
//    periodic full snapshot -> one snapshot write per interval, simple (use for small state)   <- THIS ONE
//    incremental snapshot   -> one delta upload per interval, uploads only deltas (use for large state)
//    no checkpoint, replay  -> one full replay of the stream, no storage (use when replay is cheap)
// ======================================================================
// downstream : count 10 -> fold 13 -> checkpoint 13 -> restart 13   BECAUSE the checkpoint persisted the fold, so recovery is a load not a replay
//    derivation : replayed events saved = 13 - 3 = 10   BECAUSE only the 3 post-checkpoint events would need re-reading`
    },
    {
      section: 'Checkpoints and state stores',
      color: 'orange',
      motivation: `Persisting state has real machinery — how often to snapshot, where to put the bytes, and how to keep snapshots small — so this section covers the practical knobs.`,
      steps: [
        { num: 1, title: 'A checkpoint is a consistent snapshot', detail: 'A checkpoint captures the <strong>state of every stage at a consistent point in the stream</strong> (aligned by a barrier), so restart resumes from a coherent position.' },
        { num: 2, title: 'State stores hold the bytes', detail: 'Large state does not fit in memory, so processors spill to an embedded <strong>state store</strong> (e.g. RocksDB) that keeps hot data in memory and the rest on disk.' },
        { num: 3, title: 'Incremental checkpoints keep cost down', detail: 'Rather than snapshotting all state every time, <strong>incremental checkpointing uploads only what changed</strong> since the last snapshot — the difference between uploading 10 KB or 10 GB.' },
        { num: 4, title: 'Checkpoint frequency trades cost vs recovery', detail: 'Frequent checkpoints mean <strong>short recovery but high I/O</strong>; infrequent ones mean cheap steady-state but <strong>long replay on restart</strong>. Pick the frequency for the failure budget.' }
      ],
      program: `// CHECKPOINT SIDE — incremental snapshots upload only the delta, not the whole state
// DEF: state — the full keyed store = 1000 keys
// DEF: incremental checkpoint — uploads only keys changed since the last snapshot = { "key_7", "key_88", "key_501" }
// DEF: delta — the set of changed keys = { "key_7", "key_88", "key_501" }
// STATE (before):
//    uploaded_keys : 0
// ======================================================================
// offset 0: {key: "key_7", changed: true}
// offset 1: {key: "key_88", changed: true}
// offset 2: {key: "key_501", changed: true}
// ======================================================================
// BUILD PHASE · run once at the snapshot boundary
// step 0 · initialize the delta register -> delta : none -> {}
//    -> input  : full state = 1000 keys, changed keys = [ "key_7", "key_88", "key_501" ]
//    <- output : delta = {}   BECAUSE no changed key has been recorded yet
// QUERY PHASE · per changed key
// step 1 · the changed keys are recorded -> delta : {} -> { "key_7", "key_88", "key_501" }
//    -> input  : changed keys = [ "key_7", "key_88", "key_501" ], delta = {}
//    <- output : delta = { "key_7", "key_88", "key_501" }   BECAUSE only three keys changed since the last snapshot
// step 2 · the incremental checkpoint uploads the delta -> uploaded_keys : 0 -> 3
//    -> input  : delta = { "key_7", "key_88", "key_501" }, uploaded_keys = 0
//    <- output : uploaded_keys = 3   BECAUSE only changed keys are sent
// step 3 · a full snapshot comparison -> uploaded_keys : 0 -> 1000
//    -> input  : full state = 1000 keys, uploaded_keys = 0
//    <- output : uploaded_keys = 1000   BECAUSE it sends every key
// ======================================================================
// TRACE (1000 keys, 3 changed):
//    snapshot kind | keys uploaded
//    incremental   | 3
//    full          | 1000
// CORRECTNESS (delta-invariant lemma): the incremental checkpoint uploads exactly the keys changed since the last
//    snapshot — 3 of 1000 — so a restart that loads the delta plus the prior snapshot reconstructs the full state
//    without ever missing a changed key.
// VARIANTS (when to pick which):
//    incremental delta -> one upload per changed key, small uploads (use for large, slowly-changing state)   <- THIS ONE
//    full snapshot     -> one upload per key, simple (use for small state)
//    no snapshot       -> one full replay of the stream (use when the stream can rebuild state cheaply)
// ======================================================================
// downstream : 3 changed keys -> delta set 3 -> upload 3 -> not 1000   BECAUSE incremental uploads only the delta
//    derivation : upload ratio = 3 / 1000 = 0.003, so the incremental checkpoint costs 0.3% of a full snapshot`
    },
    {
      section: 'Consistency and recovery',
      color: 'green',
      motivation: `A snapshot is only useful if it is consistent — taken at one logical point in the stream — and recovery is only safe if the pipeline knows exactly where that point was, so this section covers the correctness side.`,
      steps: [
        { num: 1, title: 'Barriers align the snapshot', detail: 'A checkpoint barrier flows through the stream; each stage snapshots its state when it sees the barrier. <strong>The result is a snapshot of all stages at the same logical point</strong> (Chandy-Lamport).' },
        { num: 2, title: 'The snapshot is tied to a stream position', detail: 'A checkpoint records <strong>both the state and the source offset</strong> at the barrier, so restart resumes from a position consistent with the state.' },
        { num: 3, title: 'At-least-once vs exactly-once recovery', detail: 'With at-least-once checkpointing, some records after the last checkpoint may be replayed (duplicates). <strong>Exactly-once checkpointing aligns state and offsets so no record is lost or double-counted.</strong>' },
        { num: 4, title: 'State grows, so bound it', detail: 'Windows that never close and keys that never expire grow state forever. <strong>Watermarks + allowed lateness are what let the pipeline garbage-collect state.</strong>' }
      ],
      program: `// BARRIER SIDE — a checkpoint barrier snapshots state and offset at one logical point
// DEF: barrier — a marker in the stream that tells each stage to snapshot = at offset 500
// DEF: state — the running count = { 42: 13 }
// DEF: offset — the source position = 500
// STATE (before):
//    count_state : { 42: 13 }
// ======================================================================
// offset 499: {key: 42, value: 1}
// offset 500: {key: 42, value: 1, barrier: true}
// ======================================================================
// BUILD PHASE · run once when the barrier arrives
// step 0 · initialize the snapshot register -> snapshot : none -> {}
//    -> input  : barrier = true at offset 500, count_state = { 42: 13 }
//    <- output : snapshot = {}   BECAUSE the stage has not yet recorded its state
// QUERY PHASE · per barrier
// step 1 · the stage snapshots its state -> snapshot : {} -> { count: { 42: 13 } }
//    -> input  : count_state = { 42: 13 }, barrier = true
//    <- output : snapshot = { count: { 42: 13 } }   BECAUSE the barrier says "snapshot now"
// step 2 · the stage records the offset -> snapshot : { count: { 42: 13 } } -> { count: { 42: 13 }, offset: 500 }
//    -> input  : snapshot = { count: { 42: 13 } }, source offset = 500
//    <- output : snapshot = { count: { 42: 13 }, offset: 500 }   BECAUSE state and position must be paired
// step 3 · recovery restores both -> count_state : { 42: 0 } -> { 42: 13 }, source resumes at 501
//    -> input  : snapshot = { count: { 42: 13 }, offset: 500 }, count_state = { 42: 0 }
//    decode 3a · read the saved count from the snapshot -> saved_count : none -> 13
//    decode 3b · read the saved offset from the snapshot -> saved_offset : none -> 500
//    decode 3c · restore state and advance the source to offset + 1 -> count_state : { 42: 0 } -> { 42: 13 }, resume = 501
//    <- output : count_state = { 42: 13 }, source resumes at 501   BECAUSE offset 500 was already folded
// ======================================================================
// TRACE (barrier at offset 500):
//    phase      | snapshot                          | resume
//    snapshot   | { count: { 42: 13 } }             | -
//    record off | { count: { 42: 13 }, offset: 500 }| -
//    recover    | { count: { 42: 13 }, offset: 500 }| 501
// CORRECTNESS (barrier-invariant lemma): the snapshot captures state and offset at one logical point — offset 500 was
//    already folded into count 13, so resuming at 501 replays neither offset 500 nor skips offset 501, and no record
//    is lost or double-counted.
// VARIANTS (when to pick which):
//    aligned barrier snapshot -> one snapshot write per barrier, exactly-once (use when correctness is paramount)   <- THIS ONE
//    unaligned snapshot       -> one snapshot write per barrier, faster but at-least-once (use when latency wins over exactness)
//    no barrier               -> one full replay of the stream (use when state can be rebuilt)
// ======================================================================
// downstream : barrier 500 -> snapshot count 13 -> snapshot offset 500 -> resume 501   BECAUSE the checkpoint paired state with its source position
//    derivation : resume = 500 + 1 = 501, so no record is replayed or skipped`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Memory state dies with the process', content: '<p><strong>Why.</strong> A crash loses in-memory aggregation, and rebuilding it means re-reading the whole stream.</p><p><strong>Claim.</strong> Persistent state makes the aggregation durable and restart fast.</p><p><strong>Grounding.</strong> State is the materialized fold of the stream, and persisting it avoids the rebuild.</p><p><strong>In the wild.</strong> Flink and Dataflow persist state to survive restarts.</p>' },
      { tag: 'solution', tagLabel: 'Snapshot', title: '2. Checkpoints', content: '<p><strong>Why.</strong> A consistent point-in-time snapshot is what a restart resumes from.</p><p><strong>Claim.</strong> A checkpoint captures every stage\'s state at one logical point in the stream, aligned by a barrier.</p><p><strong>Grounding.</strong> It pairs state with the source offset so resume is coherent.</p><p><strong>In the wild.</strong> Flink\'s aligned checkpoints implement this.</p>' },
      { tag: 'solution', tagLabel: 'Store', title: '3. State stores', content: '<p><strong>Why.</strong> State can exceed memory, so bytes need a home with hot data in memory and the rest on disk.</p><p><strong>Claim.</strong> An embedded state store like RocksDB keeps hot keys cached and spills the rest to disk.</p><p><strong>Grounding.</strong> It is the difference between fitting 10 GB of state in memory or on a disk-backed store.</p><p><strong>In the wild.</strong> Flink\'s RocksDB state backend is the production form.</p>' },
      { tag: 'solution', tagLabel: 'Cost', title: '4. Incremental checkpoints', content: '<p><strong>Why.</strong> Snapshotting all state every time is I/O-expensive when state is large.</p><p><strong>Claim.</strong> Incremental checkpoints upload only the keys that changed since the last snapshot.</p><p><strong>Grounding.</strong> Uploading a delta of 12 keys vs a full 1000 is the practical win.</p><p><strong>In the wild.</strong> Flink\'s incremental checkpointing for RocksDB.</p>' },
      { tag: 'solution', tagLabel: 'Alignment', title: '5. Checkpoint barriers', content: '<p><strong>Why.</strong> A snapshot must be consistent across stages, or a resume can mix old and new state.</p><p><strong>Claim.</strong> A barrier flows through the stream; each stage snapshots on seeing it, producing a coherent multi-stage snapshot (Chandy-Lamport).</p><p><strong>Grounding.</strong> The barrier is what makes the snapshot a single logical point.</p><p><strong>In the wild.</strong> Flink checkpoint barriers are the production form.</p>' },
      { tag: 'solution', tagLabel: 'Guarantee', title: '6. Exactly-once recovery', content: '<p><strong>Why.</strong> At-least-once recovery can replay some records, double-counting at sinks.</p><p><strong>Claim.</strong> Exactly-once checkpointing aligns state with source offsets so no record is lost or double-counted.</p><p><strong>Grounding.</strong> Resume at offset 501 after offset 500 was folded = no double-count.</p><p><strong>In the wild.</strong> Flink\'s exactly-once checkpoint mode.</p>' },
      { tag: 'tradeoff', tagLabel: 'Frequency', title: '7. Checkpoint frequency', content: '<p><strong>Why.</strong> The snapshot interval is the knob between steady-state cost and recovery time.</p><p><strong>Claim.</strong> Frequent checkpoints shorten recovery but raise I/O; infrequent ones are cheap but replay more on restart.</p><p><strong>Grounding.</strong> Pick the frequency for the failure budget and state size.</p><p><strong>In the wild.</strong> A 1-minute interval is a common starting point.</p>' },
      { tag: 'tradeoff', tagLabel: 'Growth', title: '8. Bound state growth', content: '<p><strong>Why.</strong> Windows that never close and keys that never expire grow state without limit.</p><p><strong>Claim.</strong> Watermarks plus allowed lateness let the pipeline garbage-collect finished window state.</p><p><strong>Grounding.</strong> Unbounded state eventually exhausts the state store.</p><p><strong>In the wild.</strong> Dataflow\'s allowed-lateness is the garbage-collection horizon.</p>' },
      { tag: 'solution', tagLabel: 'Scope', title: '9. Stateless vs stateful operators', content: '<p><strong>Why.</strong> Not every operator needs to remember anything between events, and confusing the two is how people end up assuming every streaming job stores state.</p><p><strong>Claim.</strong> Stateless operators (map, filter) transform each record on its own and hold no state; stateful operators (group-by, window, join, dedup) hold per-key state in a state store.</p><p><strong>Grounding.</strong> State exists only where the answer depends on what came before the current record.</p><p><strong>In the wild.</strong> A Flink map is stateless; a keyed COUNT is stateful and uses the state backend.</p>' }
    ],
    examples: [
      { name: 'RocksDB', desc: 'Embedded disk-backed state store for large streaming state' },
      { name: 'Apache Flink', desc: 'Aligned, incremental, exactly-once checkpoints with the RocksDB state backend' },
      { name: 'Chandy-Lamport', desc: 'The distributed snapshot algorithm behind checkpoint barriers' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A streaming aggregation keeps a running count per user in memory; when the job restarts after a crash, all counts reset to zero and must be rebuilt by replaying the entire stream.", q: "How do you make the running counts survive a restart without a full replay?", solution: "Persist state to a state store (e.g. RocksDB) and take aligned checkpoints that pair state with the source offset; restart resumes from the checkpoint rather than from zero.", components: ["State store — RocksDB", "Checkpoint — state + offset snapshot", "Barrier — aligns the snapshot", "Incremental snapshot — only the delta"],  code: "// count {42:13} at offset 500\n//   checkpoint saves {count:{42:13}, offset:500}\n//   restart restores count 13, resumes at 501\n//   -> no reset, no full replay", tieback: "This is exactly the persistent-state and checkpoint material in this chapter.", refs: ["2. Checkpoints", "3. State stores", "6. Exactly-once recovery"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] },
    { scenario: "A metrics pipeline has 10 GB of state; snapshotting the whole thing every minute saturates the network, but snapshotting rarely makes crashes expensive.", q: "How do you keep checkpoint cost low while keeping recovery fast?", solution: "Use incremental checkpoints — upload only the keys that changed since the last snapshot — and tune the frequency so the recovery time matches the failure budget.", components: ["Incremental checkpoint — delta only", "State store — disk-backed", "Frequency — tuned to failure budget"],  code: "// 1000 keys, 12 changed\n//   incremental: upload 12 keys\n//   full:        upload 1000 keys\n//   -> 0.3% of the I/O", tieback: "This is exactly the incremental-checkpoint material in this chapter.", refs: ["4. Incremental checkpoints", "7. Checkpoint frequency"], problems: ["20-metrics-monitoring"] }
  ],
  systemDesign: {
    question: 'Design checkpointing for a stateful stream processor. Premise: after a crash the processor must resume from the last barrier snapshot (state plus offset) without losing events or double-counting, even though the source replays from the checkpoint.',
    pipeline: 'stream -> processor (state store) -> checkpoint (state + offset) -> durable storage -> restart recovery',
    decomposition: [
      { box: 'stream', role: 'stream — delivers records with a source offset',
        parts: [
          'a record for key 42 arrives at offset 500',
          'the offset is the replayable source position',
          'events after the offset are not yet folded'
        ] },
      { box: 'processor (state store)', role: 'processor — folds records into a state store',
        parts: [
          'the count for key 42 updates { 42: 10 } -> { 42: 13 }',
          'hot keys stay in memory, the rest spill to disk',
          'the state store holds the running aggregation'
        ] },
      { box: 'checkpoint (state + offset)', role: 'checkpoint — snapshots state and offset together',
        parts: [
          'a barrier triggers the snapshot at offset 500',
          'the snapshot captures { count: { 42: 13 }, offset: 500 }',
          'incremental mode uploads only the changed keys'
        ] },
      { box: 'durable storage', role: 'durable storage — holds the checkpoint bytes',
        parts: [
          'the checkpoint is written to durable storage (S3/HDFS)',
          'it survives the processor\'s crash',
          'restart reads it back to resume'
        ] }
    ],
    
    program: `// SYSTEM DESIGN — a barrier snapshots state and offset so a restart resumes without loss or double-count
// DEF: barrier — the marker that triggers a snapshot = at offset 500
// DEF: checkpoint — a durable snapshot of { state, offset } = { count: { 42: 13 }, offset: 500 }
// DEF: state — the running per-key count = { 42: 13 }
// STATE (before):
//    count_state : { 42: 13 }
// ======================================================================
// offset 499: {key: 42, value: 1}
// offset 500: {key: 42, value: 1, barrier: true}
// ======================================================================
// step 1 · the processor snapshots state -> checkpoint : {} -> { count: { 42: 13 } }
//    -> input  : count_state = { 42: 13 }, barrier = true
//    <- output : checkpoint = { count: { 42: 13 } }   BECAUSE the barrier triggers the snapshot
// step 2 · the processor records the offset -> checkpoint : { count: { 42: 13 } } -> { count: { 42: 13 }, offset: 500 }
//    -> input  : checkpoint = { count: { 42: 13 } }, source offset = 500
//    <- output : checkpoint = { count: { 42: 13 }, offset: 500 }   BECAUSE state and offset must be paired
// step 3 · a restart restores both -> count_state : { 42: 0 } -> { 42: 13 }, resume at 501
//    -> input  : checkpoint = { count: { 42: 13 }, offset: 500 }, count_state = { 42: 0 }
//    decode 3a · read the saved count from the checkpoint -> saved_count : none -> 13
//    decode 3b · read the saved offset from the checkpoint -> saved_offset : none -> 500
//    decode 3c · restore state and advance the source to offset + 1 -> count_state : { 42: 0 } -> { 42: 13 }, resume = 501
//    <- output : count_state = { 42: 13 }, resume at 501   BECAUSE offset 500 was already folded
// ======================================================================
// downstream : barrier 500 -> checkpoint count 13 -> checkpoint offset 500 -> resume 501   BECAUSE the checkpoint paired state with its source position
//    derivation : resume offset = 500 + 1 = 501, so no record is replayed or skipped`
  },
  quiz: [
    { question: "Why must stream-processing state persist?", options: ["A. To make the stream ordered", "B. To survive restarts without re-reading the whole stream", "C. To reduce event size", "D. To create watermarks"], answer: 2, explanation: "Persistent state makes the aggregation durable and restart fast.", conceptRef: "1. Memory state dies with the process" },
    { question: "What does a checkpoint capture?", options: ["A. Only the watermark", "B. State and the source offset at one logical point", "C. Only the source offset", "D. Only the window definitions"], answer: 2, explanation: "A checkpoint pairs state with the offset so resume is coherent.", conceptRef: "2. Checkpoints" },
    { question: "What is the benefit of incremental checkpoints?", options: ["A. They capture every key", "B. They upload only the keys that changed", "C. They never need a barrier", "D. They eliminate recovery"], answer: 2, explanation: "Incremental checkpoints upload only the delta, cutting I/O sharply.", conceptRef: "4. Incremental checkpoints" },
    { question: "What aligns a multi-stage snapshot?", options: ["A. A watermark", "B. A checkpoint barrier", "C. A trigger", "D. A window"], answer: 2, explanation: "A barrier flows through the stream and each stage snapshots on seeing it.", conceptRef: "5. Checkpoint barriers" },
    { question: "Exactly-once recovery means ___ .", options: ["A. no state is ever stored", "B. state and offsets align so no record is lost or double-counted", "C. the pipeline never restarts", "D. watermarks are perfect"], answer: 2, explanation: "Aligning state with offsets means resume is at the right position.", conceptRef: "6. Exactly-once recovery" }
  ],
  seeAlso: [
    { to: 4, section: 'The window lifecycle', depth: 'the state this chapter persists is, in a windowed pipeline, per-window state — ch04 shows where that state is born, merged, and garbage-collected.', example: 'ch07\'s persisted count { 42: 13 } is the same keyed state ch04 accumulates per window; ch04\'s session set { s1, s2 } is exactly what a checkpoint must snapshot for recovery.' },
    { to: 5, section: 'What exactly-once means', depth: 'exactly-once recovery is the payoff of checkpointing — pairing state with the source offset so no record is lost or double-counted.', example: 'ch07\'s checkpoint { count: {42:13}, offset: 500 } resumed at 501 is ch05\'s "replayable source + dedup": the offset says what was already folded, so a replay does not double-count.' },
    { to: 6, section: 'The duality', depth: 'a state store is the materialized table of the stream — ch06 formalizes why the running count is a table and the incoming events are the changelog.', example: 'ch07\'s count state { 42: 13 } is ch06\'s table; the events folded into it are ch06\'s changelog [ +10, -3, +5 ], and the checkpoint is the materialization that survives a restart.' },
    { to: 8, section: 'SQL as a stream language', depth: 'streaming SQL state is the same state-store discipline under the hood — a GROUP BY count lives in keyed state that the engine checkpoints.', example: 'ch07\'s checkpointed { 42: 13 } is ch08\'s result table { C1: 4 } persisted between emissions; both rely on the state store to survive a failure.' },
    { to: 9, section: 'Correctness and state', depth: 'join state is bounded and garbage-collected by the same watermark + lateness discipline that governs checkpointing — ch09 shows the buffer side.', example: 'ch07\'s "bound state growth" is ch09\'s join buffer: rows are dropped once both watermarks pass the join window + allowed lateness, so the persisted buffer never grows without limit.' }
  ],
  sources: [
    { name: 'Apache Flink — Stateful stream processing', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/', note: 'Checkpoints, state stores, and exactly-once recovery in a production engine' },
    { name: 'RocksDB', url: 'https://rocksdb.org/', note: 'The embedded key-value store used for disk-backed streaming state' },
    { name: 'Chandy & Lamport — "Distributed Snapshots"', url: 'https://lamport.azurewebsites.net/pubs/chandy.pdf', note: 'The snapshot algorithm that checkpoint barriers implement' },
    { name: 'Akidau et al. — "MillWheel" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'Persistent state and checkpointing at internet scale' }
  ]
});
