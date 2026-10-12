const CH07 = (() => {
  const S = require(require('path').resolve('tools', 'stream_seed.js'));
  const CHK = 4;
  const entryOf = (e) => `${e.key}@${S.winOf(e.et)}`;
  const folded = S.EVENTS.slice(0, CHK + 1);
  const ENT = [...new Set(folded.map(entryOf))];
  const val = (id) => folded.filter(e => entryOf(e) === id).reduce((s, e) => s + e.v, 0);
  const PREFIX = folded.reduce((s, e) => s + e.v, 0);
  const LAST = S.EVENTS[CHK];
  const E0 = ENT[0], E0_EVENTS = folded.filter(e => entryOf(e) === E0);
  const INC_AT = S.EVENTS.map((e, i) => i).filter(i => i % 3 === 2);
  const distinct = (a, b) => new Set(S.EVENTS.slice(a, b).map(entryOf)).size;
  const INC = { k: 3, n: S.EVENTS.length,
    full: INC_AT.map(c => distinct(0, c + 1)), incr: INC_AT.map((c, j) => distinct(j ? INC_AT[j - 1] + 1 : 0, c + 1)) };
  INC.F = INC.full.reduce((a, b) => a + b, 0); INC.I = INC.incr.reduce((a, b) => a + b, 0);
  INC.PCT = Math.round(100 * INC.I / INC.F); INC.SAVING = 100 - INC.PCT;
  if (ENT.length !== 4 || PREFIX !== 23) throw new Error(`ch07 content: checkpoint at ${CHK} holds ${ENT.length} entries / ${PREFIX}, the prose was checked against 4 / 23`);
  return { CHK, NEXT: CHK + 1, N_ENT: ENT.length, PREFIX,
    STATE: `{${ENT.map(id => `${id}:${val(id)}`).join(', ')}}`,
    LAST_KEY: LAST.key, LAST_V: LAST.v, LAST_ENT: entryOf(LAST), LAST_ENT_V: val(entryOf(LAST)),
    E0, E0_V: val(E0), E0_IDS: E0_EVENTS.map(e => e.id).join(' and '), E0_VS: E0_EVENTS.map(e => `+${e.v}`).join(', '),
    TOTAL: S.SUM(S.EVENTS.map(e => e.id)), AFTER: S.EVENTS.length - CHK - 1,
    GROUPS: new Set(S.EVENTS.map(entryOf)).size, SESSIONS: S.KEYS.reduce((n, k) => n + S.SESSIONS[k].length, 0),
    W0_ON: S.SUM(S.WINDOWS[0].filter(i => !S.LATE.some(e => e.id === i))), W0_ALL: S.SUM(S.WINDOWS[0]),
    WALK: [0, ...S.EVENTS.filter(e => e.key === E0_EVENTS[0].key).reduce((a, e) => [...a, (a[a.length - 1] || 0) + e.v], [])].join(' → '),
    INC };
})();
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
      walkthroughs: ['ch07-why', 'ch07-why-memory'],
      color: 'cyan',
      motivation: `A pipeline that keeps a running count in memory loses it on restart, so this section establishes why durable state is a requirement, not an optimization.`,
      steps: [
        { num: 1, title: 'State is the aggregation in progress', detail: 'A keyed count, a session, a running sum — <strong>state is everything the pipeline remembers between events</strong>. Without it, each event would start from scratch.' },
        { num: 2, title: 'Restarts must not lose state', detail: 'Machines crash and jobs redeploy. <strong>Persistent state means the aggregation survives a restart</strong> and continues where it left off, rather than re-reading the whole stream.' },
        { num: 3, title: 'Recovery is about correctness and cost', detail: 'Losing state forces a full reprocessing of the stream — <strong>correct but slow</strong>. Persisting state makes recovery <strong>fast and still correct</strong>.' },
        { num: 4, title: 'The stream is the truth, state is a cache of it', detail: 'Persistent state is a materialized fold of the stream. <strong>You can always rebuild it from the stream, but persisting it avoids the rebuild cost.</strong>' }
      ],
    },
    {
      section: 'Checkpoints and state stores',
      walkthroughs: ['ch07-checkpoints', 'ch07-checkpoints-memory'],
      color: 'orange',
      motivation: `Persisting state has real machinery — how often to snapshot, where to put the bytes, and how to keep snapshots small — so this section covers the practical knobs.`,
      steps: [
        { num: 1, title: 'A checkpoint is a consistent snapshot', detail: 'A checkpoint captures the <strong>state of every stage at a consistent point in the stream</strong> (aligned by a barrier), so restart resumes from a coherent position.' },
        { num: 2, title: 'State stores hold the bytes', detail: 'Large state does not fit in memory, so processors spill to an embedded <strong>state store</strong> (e.g. RocksDB) that keeps hot data in memory and the rest on disk.' },
        { num: 3, title: 'Incremental checkpoints keep cost down', detail: 'Rather than snapshotting all state every time, <strong>incremental checkpointing uploads only what changed</strong> since the last snapshot — the difference between uploading 10 KB or 10 GB.' },
        { num: 4, title: 'Checkpoint frequency trades cost vs recovery', detail: 'Frequent checkpoints mean <strong>short recovery but high I/O</strong>; infrequent ones mean cheap steady-state but <strong>long replay on restart</strong>. Pick the frequency for the failure budget.' }
      ],
    },
    {
      section: 'Consistency and recovery',
      walkthroughs: ['ch07-recovery', 'ch07-recovery-memory'],
      color: 'green',
      motivation: `A snapshot is only useful if it is consistent — taken at one logical point in the stream — and recovery is only safe if the pipeline knows exactly where that point was, so this section covers the correctness side.`,
      steps: [
        { num: 1, title: 'Barriers align the snapshot', detail: 'A checkpoint barrier flows through the stream; each stage snapshots its state when it sees the barrier. <strong>The result is a snapshot of all stages at the same logical point</strong> (Chandy-Lamport).' },
        { num: 2, title: 'The snapshot is tied to a stream position', detail: 'A checkpoint records <strong>both the state and the source offset</strong> at the barrier, so restart resumes from a position consistent with the state.' },
        { num: 3, title: 'At-least-once vs exactly-once recovery', detail: 'With at-least-once checkpointing, some records after the last checkpoint may be replayed (duplicates). <strong>Exactly-once checkpointing aligns state and offsets so no record is lost or double-counted.</strong>' },
        { num: 4, title: 'State grows, so bound it', detail: 'Windows that never close and keys that never expire grow state forever. <strong>Watermarks + allowed lateness are what let the pipeline garbage-collect state.</strong>' }
      ],
    },
    {
      section: 'Google Interview Question',
      walkthroughs: ['ch07-interview-memory'],
      bands: ['PROGRAM'],
      color: 'purple',
      motivation: `A standalone interview problem, with three other surfaces the same program wears. Nothing here depends on this chapter's vocabulary: the problem, the one reframe that solves it, and the traced solution are self-contained, and the section stops where the program stops. Generated by \`tools/gen_ch07_interview.js\` on \`tools/interviewkit.js\`.`,
      steps: []
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Memory state dies with the process', content: '<p><strong>Why.</strong> A crash loses in-memory aggregation, and rebuilding it means re-reading the whole stream.</p><p><strong>Claim.</strong> Persistent state makes the aggregation durable and restart fast.</p><p><strong>Grounding.</strong> State is the materialized fold of the stream, and persisting it avoids the rebuild.</p><p><strong>In the wild.</strong> Flink and Dataflow persist state to survive restarts.</p>' },
      { tag: 'solution', tagLabel: 'Snapshot', title: '2. Checkpoints', content: '<p><strong>Why.</strong> A consistent point-in-time snapshot is what a restart resumes from.</p><p><strong>Claim.</strong> A checkpoint captures every stage\'s state at one logical point in the stream, aligned by a barrier.</p><p><strong>Grounding.</strong> It pairs state with the source offset so resume is coherent.</p><p><strong>In the wild.</strong> Flink\'s aligned checkpoints implement this.</p>' },
      { tag: 'solution', tagLabel: 'Store', title: '3. State stores', content: `<p><strong>Why.</strong> State can exceed memory, so bytes need a home with hot data in memory and the rest on disk.</p><p><strong>Claim.</strong> An embedded state store like RocksDB keeps hot keys cached and spills the rest to disk.</p><p><strong>Grounding.</strong> This chapter's state is ${CH07.GROUPS} entries and fits anywhere; at a scale such as 10 GB (an illustration outside the chapter's dataset) it is the difference between running out of memory and running on a disk-backed store.</p><p><strong>In the wild.</strong> Flink's RocksDB state backend is the production form.</p>` },
      { tag: 'solution', tagLabel: 'Cost', title: '4. Incremental checkpoints', content: `<p><strong>Why.</strong> Snapshotting all state every time is I/O-expensive when state is large.</p><p><strong>Claim.</strong> Incremental checkpoints upload only the keys that changed since the last snapshot.</p><p><strong>Grounding.</strong> Checkpointing every ${CH07.INC.k} of the ${CH07.INC.n} events, full uploads ${CH07.INC.F} entries and incremental ${CH07.INC.I}, ${CH07.INC.SAVING}% less; the gap widens as state grows relative to how fast it changes.</p><p><strong>In the wild.</strong> Flink's incremental checkpointing for RocksDB.</p>` },
      { tag: 'solution', tagLabel: 'Alignment', title: '5. Checkpoint barriers', content: '<p><strong>Why.</strong> A snapshot must be consistent across stages, or a resume can mix old and new state.</p><p><strong>Claim.</strong> A barrier flows through the stream; each stage snapshots on seeing it, producing a coherent multi-stage snapshot (Chandy-Lamport).</p><p><strong>Grounding.</strong> The barrier is what makes the snapshot a single logical point.</p><p><strong>In the wild.</strong> Flink checkpoint barriers are the production form.</p>' },
      { tag: 'solution', tagLabel: 'Guarantee', title: '6. Exactly-once recovery', content: `<p><strong>Why.</strong> At-least-once recovery can replay some records, double-counting at sinks.</p><p><strong>Claim.</strong> Exactly-once checkpointing aligns state with source offsets so no record is lost or double-counted.</p><p><strong>Grounding.</strong> Resume at offset ${CH07.NEXT} after offset ${CH07.CHK} was folded = no double-count.</p><p><strong>In the wild.</strong> Flink's exactly-once checkpoint mode.</p>` },
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
    { scenario: "A streaming aggregation keeps a running count per user in memory; when the job restarts after a crash, all counts reset to zero and must be rebuilt by replaying the entire stream.", q: "How do you make the running counts survive a restart without a full replay?", solution: "Persist state to a state store (e.g. RocksDB) and take aligned checkpoints that pair state with the source offset; restart resumes from the checkpoint rather than from zero.", components: ["State store — RocksDB", "Checkpoint — state + offset snapshot", "Barrier — aligns the snapshot", "Incremental snapshot — only the delta"],  code: `// state ${CH07.STATE} at offset ${CH07.CHK}\n//   checkpoint saves {entries, offset: ${CH07.CHK}}\n//   restart restores ${CH07.PREFIX}, resumes at ${CH07.NEXT}\n//   -> no reset, no full replay`, tieback: "This is exactly the persistent-state and checkpoint material in this chapter.", refs: ["2. Checkpoints", "3. State stores", "6. Exactly-once recovery"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] },
    { scenario: "A metrics pipeline has 10 GB of state; snapshotting the whole thing every minute saturates the network, but snapshotting rarely makes crashes expensive.", q: "How do you keep checkpoint cost low while keeping recovery fast?", solution: "Use incremental checkpoints — upload only the keys that changed since the last snapshot — and tune the frequency so the recovery time matches the failure budget.", components: ["Incremental checkpoint — delta only", "State store — disk-backed", "Frequency — tuned to failure budget"],  code: `// the ${CH07.INC.n} seed events as a scale model, checkpoint every ${CH07.INC.k}\n//   full:        upload ${CH07.INC.full.join(' + ')} = ${CH07.INC.F} entries\n//   incremental: upload ${CH07.INC.incr.join(' + ')} = ${CH07.INC.I} entries\n//   -> ${CH07.INC.PCT}% of the I/O (a ${CH07.INC.SAVING}% saving), and the gap widens as state grows`, tieback: "This is exactly the incremental-checkpoint material in this chapter.", refs: ["4. Incremental checkpoints", "7. Checkpoint frequency"], problems: ["20-metrics-monitoring"] }
  ],
  systemDesign: {
    walkthroughs: ['ch07-system', 'ch07-system-memory'],
    question: 'Design checkpointing for a stateful stream processor. Premise: after a crash the processor must resume from the last barrier snapshot (state plus offset) without losing events or double-counting, even though the source replays from the checkpoint.',
    pipeline: 'stream -> processor (state store) -> checkpoint (state + offset) -> durable storage -> restart recovery',
    decomposition: [
      { box: 'stream', role: 'stream — delivers records with a source offset',
        parts: [
          `event ${CH07.CHK} (key "${CH07.LAST_KEY}", v ${CH07.LAST_V}) arrives at offset ${CH07.CHK}`,
          'the offset is the replayable source position',
          'events after the offset are not yet folded'
        ] },
      { box: 'processor (state store)', role: 'processor — folds records into a state store',
        parts: [
          `entry ${CH07.LAST_ENT} goes NONE -> ${CH07.LAST_ENT_V}; the store now holds ${CH07.N_ENT} entries totalling ${CH07.PREFIX}`,
          'hot keys stay in memory, the rest spill to disk',
          'the state store holds the running aggregation'
        ] },
      { box: 'checkpoint (state + offset)', role: 'checkpoint — snapshots state and offset together',
        parts: [
          `a barrier triggers the snapshot at offset ${CH07.CHK}`,
          `the snapshot captures { entries: ${CH07.STATE}, offset: ${CH07.CHK} }`,
          'incremental mode uploads only the changed keys'
        ] },
      { box: 'durable storage', role: 'durable storage — holds the checkpoint bytes',
        parts: [
          'the checkpoint is written to durable storage (S3/HDFS)',
          'it survives the processor\'s crash',
          'restart reads it back to resume'
        ] }
    ],
    
  },
  quiz: [
    { question: "Why must stream-processing state persist?", options: ["A. To make the stream ordered", "B. To survive restarts without re-reading the whole stream", "C. To reduce event size", "D. To create watermarks"], answer: 2, explanation: "Persistent state makes the aggregation durable and restart fast.", conceptRef: "1. Memory state dies with the process" },
    { question: "What does a checkpoint capture?", options: ["A. Only the watermark", "B. State and the source offset at one logical point", "C. Only the source offset", "D. Only the window definitions"], answer: 2, explanation: "A checkpoint pairs state with the offset so resume is coherent.", conceptRef: "2. Checkpoints" },
    { question: "What is the benefit of incremental checkpoints?", options: ["A. They capture every key", "B. They upload only the keys that changed", "C. They never need a barrier", "D. They eliminate recovery"], answer: 2, explanation: "Incremental checkpoints upload only the delta, cutting I/O sharply.", conceptRef: "4. Incremental checkpoints" },
    { question: "What aligns a multi-stage snapshot?", options: ["A. A watermark", "B. A checkpoint barrier", "C. A trigger", "D. A window"], answer: 2, explanation: "A barrier flows through the stream and each stage snapshots on seeing it.", conceptRef: "5. Checkpoint barriers" },
    { question: "Exactly-once recovery means ___ .", options: ["A. no state is ever stored", "B. state and offsets align so no record is lost or double-counted", "C. the pipeline never restarts", "D. watermarks are perfect"], answer: 2, explanation: "Aligning state with offsets means resume is at the right position.", conceptRef: "6. Exactly-once recovery" }
  ],
  seeAlso: [
    { to: 4, section: 'The window lifecycle', depth: 'the state this chapter persists is, in a windowed pipeline, per-window state — ch04 shows where that state is born, merged, and garbage-collected.', example: `ch07's persisted entry ${CH07.E0} = ${CH07.E0_V} is one (key, window) group of ch04's step 3, "group and trigger"; ch04's ${CH07.SESSIONS} state entries, one per (key, session), are exactly what a checkpoint must snapshot, and ch04's step 4 is what finally releases them.` },
    { to: 5, section: 'What exactly-once means', depth: 'exactly-once recovery is the payoff of checkpointing — pairing state with the source offset so no record is lost or double-counted.', example: `ch07's checkpoint { ${CH07.N_ENT} entries holding ${CH07.PREFIX}, offset: ${CH07.CHK} } resumed at ${CH07.NEXT} is ch05's two failures avoided at once: drop the ${CH07.AFTER} records after the offset and the total is ch05's ${CH07.PREFIX}, apply them twice and it is ch05's ${CH07.TOTAL + CH07.TOTAL - CH07.PREFIX}; resuming at ${CH07.NEXT} applies them once and gives ${CH07.TOTAL}.` },
    { to: 6, section: 'The duality', depth: 'a state store is the materialized table of the stream — ch06 formalizes why the running count is a table and the incoming events are the changelog.', example: `ch07's entry ${CH07.E0} = ${CH07.E0_V} is ch06's fold stopped early: ch06's key "${CH07.E0.split('@')[0]}" walks ${CH07.WALK}, and ${CH07.E0} holds the first two steps, ids ${CH07.E0_IDS} (${CH07.E0_VS}); the checkpoint is that table materialized so it survives a restart.` },
    { to: 8, section: 'SQL as a stream language', depth: 'streaming SQL state is the same state-store discipline under the hood — a GROUP BY count lives in keyed state that the engine checkpoints.', example: `ch07's checkpointed ${CH07.STATE} is ${CH07.N_ENT} of the ${CH07.GROUPS} groups of ch08's GROUP BY key, TUMBLE(et, INTERVAL '120' SECOND), persisted between emissions; ch08's window [12:00, 12:02) can emit ${CH07.W0_ON} and later become ${CH07.W0_ALL} only because the ${CH07.W0_ON} survived in that state.` },
    { to: 9, section: 'Correctness and state', depth: 'join state is bounded and garbage-collected by the same watermark + lateness discipline that governs checkpointing — ch09 shows the buffer side.', example: 'ch07\'s "bound state growth" is ch09\'s join buffer: a buffered row may be dropped once both watermarks pass its event time plus 60 s, so the buffer peaks at 5 of 9 rows; ch09\'s 2 clicks that never emit are 2 rows that are never freed, which a checkpoint then persists across every restart.' }
  ],
  sources: [
    { name: 'Apache Flink — Stateful stream processing', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/', note: 'Checkpoints, state stores, and exactly-once recovery in a production engine' },
    { name: 'RocksDB', url: 'https://rocksdb.org/', note: 'The embedded key-value store used for disk-backed streaming state' },
    { name: 'Chandy & Lamport — "Distributed Snapshots"', url: 'https://lamport.azurewebsites.net/pubs/chandy.pdf', note: 'The snapshot algorithm that checkpoint barriers implement' },
    { name: 'Akidau et al. — "MillWheel" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'Persistent state and checkpointing at internet scale' }
  ]
});
