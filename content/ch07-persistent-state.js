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
// DEF: checkpoint — a durable snapshot of state taken periodically = every 1 min
// DEF: restart — the job restarts and resumes from the checkpoint
// -> input : three more events for key 42 arrive, then the job restarts
//    step 1 · fold the three events -> state : { 42: 10 } -> { 42: 13 }   BECAUSE 10 + 3 = 13
//    step 2 · the checkpoint saves -> durable : {} -> { 42: 13 }   BECAUSE the periodic snapshot fired
//    step 3 · the restart restores -> state : {} -> { 42: 13 }   BECAUSE the checkpoint holds the last count
// <- outcome : after restart the count is still 13, not 0 or a full replay   BECAUSE the checkpoint persisted the fold
//    derivation : without the checkpoint, recovery = re-read 13 events; with it, recovery = load { 42: 13 }`
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
// DEF: incremental checkpoint — uploads only keys changed since the last snapshot = 12 keys
// DEF: delta — the set of changed keys = { key_7, key_88, key_501 }
// -> input : 3 keys change, then the incremental checkpoint fires
//    step 1 · the changed keys are recorded -> delta : {} -> { key_7, key_88, key_501 }
//    step 2 · the checkpoint uploads the delta -> uploaded : 0 -> 3 keys   BECAUSE only changed keys are sent
//    step 3 · a full snapshot comparison -> uploaded : 0 -> 1000 keys   BECAUSE it sends every key
// <- outcome : the incremental checkpoint uploads 3 keys, the full one 1000   BECAUSE incremental uploads only the delta
//    derivation : upload ratio = 3 / 1000, so the incremental checkpoint costs 0.3% of a full snapshot`
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
// -> input : the barrier reaches the counting stage at offset 500
//    step 1 · the stage snapshots its state -> snapshot : {} -> { count: { 42: 13 } }
//    step 2 · the stage records the offset -> snapshot : { count: { 42: 13 } } -> { count: { 42: 13 }, offset: 500 }
//    step 3 · recovery restores both -> state : {} -> { 42: 13 }, source resumes at 501   BECAUSE offset 500 was already folded
// <- outcome : restart continues from offset 501 with count 13   BECAUSE the checkpoint paired state with its source position
//    derivation : no double-count because offset 500 is the last folded position, so resume is 501`
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
      { tag: 'tradeoff', tagLabel: 'Growth', title: '8. Bound state growth', content: '<p><strong>Why.</strong> Windows that never close and keys that never expire grow state without limit.</p><p><strong>Claim.</strong> Watermarks plus allowed lateness let the pipeline garbage-collect finished window state.</p><p><strong>Grounding.</strong> Unbounded state eventually exhausts the state store.</p><p><strong>In the wild.</strong> Dataflow\'s allowed-lateness is the garbage-collection horizon.</p>' }
    ],
    examples: [
      { name: 'RocksDB', desc: 'Embedded disk-backed state store for large streaming state' },
      { name: 'Apache Flink', desc: 'Aligned, incremental, exactly-once checkpoints' },
      { name: 'Chandy-Lamport', desc: 'The snapshot algorithm behind checkpoint barriers' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A streaming aggregation keeps a running count per user in memory; when the job restarts after a crash, all counts reset to zero and must be rebuilt by replaying the entire stream.", q: "How do you make the running counts survive a restart without a full replay?", solution: "Persist state to a state store (e.g. RocksDB) and take aligned checkpoints that pair state with the source offset; restart resumes from the checkpoint rather than from zero.", components: ["State store — RocksDB", "Checkpoint — state + offset snapshot", "Barrier — aligns the snapshot", "Incremental snapshot — only the delta"], diagram: "flowchart LR\n  S[\"stream\"] --> P[\"processor + state store\"]\n  P --> C[\"checkpoint (state + offset)\"]\n  C --> R[\"restart resumes from offset\"]", code: "// count {42:13} at offset 500\n//   checkpoint saves {count:{42:13}, offset:500}\n//   restart restores count 13, resumes at 501\n//   -> no reset, no full replay", tieback: "This is exactly the persistent-state and checkpoint material in this chapter.", refs: ["2. Checkpoints", "3. State stores", "6. Exactly-once recovery"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] },
    { scenario: "A metrics pipeline has 10 GB of state; snapshotting the whole thing every minute saturates the network, but snapshotting rarely makes crashes expensive.", q: "How do you keep checkpoint cost low while keeping recovery fast?", solution: "Use incremental checkpoints — upload only the keys that changed since the last snapshot — and tune the frequency so the recovery time matches the failure budget.", components: ["Incremental checkpoint — delta only", "State store — disk-backed", "Frequency — tuned to failure budget"], diagram: "flowchart LR\n  S[(10 GB state)] --> D[\"delta = changed keys\"]\n  D -->|upload 12 keys| C[\"checkpoint\"]", code: "// 1000 keys, 12 changed\n//   incremental: upload 12 keys\n//   full:        upload 1000 keys\n//   -> 0.3% of the I/O", tieback: "This is exactly the incremental-checkpoint material in this chapter.", refs: ["4. Incremental checkpoints", "7. Checkpoint frequency"], problems: ["20-metrics-monitoring"] }
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
    wiring: "flowchart LR\n  S[\"stream\"] --> P[\"processor + state store\"]\n  P --> C[\"checkpoint\"]\n  C --> D[(durable storage)]\n  D -->|restore| P",
    program: `// SYSTEM DESIGN — a barrier snapshots state and offset so a restart resumes without loss or double-count
// DEF: barrier — the marker that triggers a snapshot = at offset 500
// DEF: checkpoint — a durable snapshot of { state, offset } = { count: { 42: 13 }, offset: 500 }
// DEF: state — the running per-key count = { 42: 13 }
// STATE (before):
//    count_state : { 42: 13 }
// -> input : the barrier reaches the processor at offset 500
//    step 1 · the processor snapshots state -> checkpoint : {} -> { count: { 42: 13 } }
//    step 2 · the processor records the offset -> checkpoint : { count: { 42: 13 } } -> { count: { 42: 13 }, offset: 500 }
//    step 3 · a restart restores both -> count_state : {} -> { 42: 13 }, resume at 501   BECAUSE offset 500 was already folded
// <- outcome : the count resumes at 13 from offset 501   BECAUSE the checkpoint paired state with its source position
//    derivation : resume offset = checkpoint offset + 1 = 500 + 1 = 501, so no record is replayed or skipped`
  },
  quiz: [
    { question: "Why must stream-processing state persist?", options: ["A. To make the stream ordered", "B. To survive restarts without re-reading the whole stream", "C. To reduce event size", "D. To create watermarks"], answer: 2, explanation: "Persistent state makes the aggregation durable and restart fast.", conceptRef: "1. Memory state dies with the process" },
    { question: "What does a checkpoint capture?", options: ["A. Only the watermark", "B. State and the source offset at one logical point", "C. Only the source offset", "D. Only the window definitions"], answer: 2, explanation: "A checkpoint pairs state with the offset so resume is coherent.", conceptRef: "2. Checkpoints" },
    { question: "What is the benefit of incremental checkpoints?", options: ["A. They capture every key", "B. They upload only the keys that changed", "C. They never need a barrier", "D. They eliminate recovery"], answer: 2, explanation: "Incremental checkpoints upload only the delta, cutting I/O sharply.", conceptRef: "4. Incremental checkpoints" },
    { question: "What aligns a multi-stage snapshot?", options: ["A. A watermark", "B. A checkpoint barrier", "C. A trigger", "D. A window"], answer: 2, explanation: "A barrier flows through the stream and each stage snapshots on seeing it.", conceptRef: "5. Checkpoint barriers" },
    { question: "Exactly-once recovery means ___ .", options: ["A. no state is ever stored", "B. state and offsets align so no record is lost or double-counted", "C. the pipeline never restarts", "D. watermarks are perfect"], answer: 2, explanation: "Aligning state with offsets means resume is at the right position.", conceptRef: "6. Exactly-once recovery" }
  ]
});
