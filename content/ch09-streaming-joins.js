const CH09 = (() => {
  const S = require(require('path').resolve('tools', 'stream_seed.js'));
  const hm = (t) => S.hhmmss(t), J = S.LAG;
  const [LK, RK] = S.KEYS;
  const byId = (id) => S.EVENTS.find(e => e.id === id);
  const sideWm = (k, i) => { const seen = S.EVENTS.filter((e, j) => j <= i && e.key === k); return seen.length ? Math.max(...seen.map(e => e.et)) - S.LAG : null; };
  const minWm = (i) => S.KEYS.some(k => sideWm(k, i) === null) ? null : Math.min(...S.KEYS.map(k => sideWm(k, i)));
  const emitIdx = (c) => S.EVENTS.findIndex((e, i) => minWm(i) !== null && minWm(i) > c.et + J);
  const N = S.EVENTS.length - 1;
  const C = byId(3), I = byId(2), C0 = S.EVENTS.find(e => e.key === LK), L = S.LATE[0];
  const CI = emitIdx(C), C0I = emitIdx(C0);
  const never = S.EVENTS.filter(e => e.key === LK && emitIdx(e) === -1);
  const CHK = 4, folded = S.EVENTS.slice(0, CHK + 1), ent = {};
  folded.forEach(e => { const k = `${e.key}@${S.winOf(e.et)}`; ent[k] = (ent[k] || 0) + e.v; });
  if (C.key !== LK || I.key !== RK || Math.abs(C.et - I.et) > J || CI < 1 || L.key !== RK || Math.abs(C0.et - L.et) > J || S.EVENTS.indexOf(L) <= C0I || !never.length)
    throw new Error('ch09 content: the worked click/impression pair, the late impression or the never-emitted click no longer holds on the seed');
  const pre = CI - 1;
  return { J, C_ID: C.id, C_ET: hm(C.et), C_PT: hm(C.pt), I_ID: I.id, I_ET: hm(I.et), I_PT: hm(I.pt), GAP: Math.abs(C.et - I.et),
    BOUND: hm(C.et + J), CI, PRE_A: hm(sideWm(LK, pre)), PRE_B: hm(sideWm(RK, pre)), PRE_MIN: hm(minWm(pre)), CI_ID: S.EVENTS[CI].id,
    CI_A: hm(sideWm(LK, CI)), CI_MIN: hm(minWm(CI)),
    C0_ID: C0.id, C0_EMIT: S.EVENTS[C0I].id, L_ID: L.id, L_ET: hm(L.et), L_PT: hm(L.pt),
    WA: hm(sideWm(LK, N)), WB: hm(sideWm(RK, N)), WMIN: hm(minWm(N)),
    NV_ID: never[0].id, NV_ET: hm(never[0].et), NV_BOUND: hm(never[0].et + J),
    CHK, CHK_N: Object.keys(ent).length, CHK_SUM: Object.values(ent).reduce((a, b) => a + b, 0), CHK_STATE: `{${Object.entries(ent).map(([k, v]) => `${k}:${v}`).join(', ')}}` };
})();
registerChapter({
  id: 'ch09',
  num: 9,
  title: 'Streaming Joins',
  pattern: 'Joining streams is about bounding an unbounded match — windowed joins bound time, temporal joins enrich against a table, and the watermark plus state decide when a join result is complete.',
  aka: 'SS Ch09 · Streaming Join · Windowed Join · Temporal Join · Stream-Table Join · Join State',
  part: 2,

  flow: [
    {
      section: 'Why joins are hard on streams',
      walkthroughs: ['ch09-hard', 'ch09-hard-memory'],
      color: 'cyan',
      motivation: `A join over two finite tables is a set intersection; a join over two unbounded streams has no boundary, so this section establishes what makes streaming joins different.`,
      steps: [
        { num: 1, title: 'Two unbounded inputs have no join boundary', detail: 'A batch join completes when both tables are read. <strong>A stream-stream join never completes on its own</strong> — it needs a time bound to say when a match is done.' },
        { num: 2, title: 'The join must buffer', detail: 'Rows from one side must wait for their counterpart on the other side. <strong>Join state holds one side until the other catches up</strong>, bounded by the join window.' },
        { num: 3, title: 'Watermarks bound the wait', detail: 'The watermark tells each side when no more rows for a time range will arrive. <strong>A join emits a match when both sides\' watermarks pass the join window.</strong>' },
        { num: 4, title: 'Different joins for different inputs', detail: '<strong>Windowed joins</strong> match two streams in a time window; <strong>temporal joins</strong> enrich a stream against a slowly-changing table. The input type picks the join type.' }
      ],
    },
    {
      section: 'Windowed and temporal joins',
      walkthroughs: ['ch09-kinds', 'ch09-kinds-memory'],
      color: 'orange',
      motivation: `The two practical join forms — matching two streams in a window, and enriching a stream against a table — have different correctness rules, so this section contrasts them.`,
      steps: [
        { num: 1, title: 'Windowed (interval) join', detail: 'A windowed join matches rows from two streams whose time attributes are <strong>within a window of each other</strong>. The window bounds the buffer and the watermark bounds the wait.' },
        { num: 2, title: 'Temporal join (stream-table)', detail: 'A temporal join enriches a stream with the <strong>version of a table that was current at the event\'s time</strong>. It looks up state, not a moving window.' },
        { num: 3, title: 'Stream-table join is a lookup', detail: 'Joining a stream against a table is a <strong>keyed lookup</strong> — the stream row probes the table state at the join key. It is bounded because the table is finite per key.' },
        { num: 4, title: 'The choice is about what is joined', detail: 'Join two streams -> window; join a stream to a table -> temporal lookup. <strong>Mistaking one for the other is the common streaming-join bug.</strong>' }
      ],
    },
    {
      section: 'Correctness and state',
      walkthroughs: ['ch09-correctness', 'ch09-correctness-memory'],
      color: 'green',
      motivation: `A join is only correct if it holds the right state for the right amount of time and cleans it up, so this section covers the state and watermark discipline behind joins.`,
      steps: [
        { num: 1, title: 'Join state is bounded by the window', detail: 'The buffer for a windowed join only needs to hold rows <strong>within the join window</strong> — rows older than the window can be dropped once both watermarks pass.' },
        { num: 2, title: 'Late data complicates the join', detail: 'A late row can arrive after the join already emitted. <strong>Allowed lateness keeps the join state alive</strong> so a late match can still emit (and retract the earlier result).' },
        { num: 3, title: 'Retractions correct emitted joins', detail: 'If a late row changes a join result already emitted, the pipeline must <strong>retract the old match and emit the corrected one</strong> — the same accumulation discipline as windows.' },
        { num: 4, title: 'Garbage-collect the join state', detail: 'Join state must be garbage-collected when the watermark passes the window plus allowed lateness, or <strong>the buffer grows without bound.</strong>' }
      ],
    },
    {
      section: 'Google Interview Question',
      walkthroughs: ['ch09-interview-memory'],
      bands: ['PROGRAM'],
      color: 'purple',
      motivation: `A standalone interview problem, with three other surfaces the same program wears. Nothing here depends on this chapter's vocabulary: the problem, the one reframe that solves it, and the traced solution are self-contained, and the section stops where the program stops. Generated by \`tools/gen_ch09_interview.js\` on \`tools/interviewkit.js\`.`,
      steps: []
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Unbounded joins never finish', content: '<p><strong>Why.</strong> Two unbounded streams have no natural join boundary, so a naive join buffers forever.</p><p><strong>Claim.</strong> A streaming join needs a time bound — a window or a table lookup — to decide when a match is complete.</p><p><strong>Grounding.</strong> The book\'s central streaming-join point is bounding the unbounded.</p><p><strong>In the wild.</strong> Flink SQL requires an interval for stream-stream joins.</p>' },
      { tag: 'solution', tagLabel: 'Stream-stream', title: '2. Windowed joins', content: '<p><strong>Why.</strong> Two streams need a time window to bound which rows can match.</p><p><strong>Claim.</strong> A windowed join matches rows whose time attributes are within a window of each other.</p><p><strong>Grounding.</strong> The window bounds the buffer and the watermark bounds the wait.</p><p><strong>In the wild.</strong> Flink SQL interval joins are the production form.</p>' },
      { tag: 'solution', tagLabel: 'Stream-table', title: '3. Temporal joins', content: '<p><strong>Why.</strong> Enriching a stream against a slowly-changing table is a lookup, not a windowed match.</p><p><strong>Claim.</strong> A temporal join enriches each stream row with the table version current at its event time.</p><p><strong>Grounding.</strong> The table is finite per key, so no window is needed.</p><p><strong>In the wild.</strong> Flink SQL temporal joins against a changelog table.</p>' },
      { tag: 'solution', tagLabel: 'Buffer', title: '4. Join state', content: '<p><strong>Why.</strong> Rows from one side must wait for their counterpart on the other side.</p><p><strong>Claim.</strong> Join state buffers one side until the other catches up, bounded by the join window.</p><p><strong>Grounding.</strong> The buffer is what makes a streaming join possible.</p><p><strong>In the wild.</strong> Flink holds the buffered side in managed state.</p>' },
      { tag: 'solution', tagLabel: 'Signal', title: '5. Watermarks bound the wait', content: '<p><strong>Why.</strong> The pipeline needs to know when no more matching rows will arrive for a time range.</p><p><strong>Claim.</strong> A join emits when both sides\' watermarks pass the join window.</p><p><strong>Grounding.</strong> Completeness is bounded by the slower stream.</p><p><strong>In the wild.</strong> Flink SQL fires interval joins on the watermark.</p>' },
      { tag: 'solution', tagLabel: 'Correctness', title: '6. Late data and retractions', content: '<p><strong>Why.</strong> A late row can arrive after a match was emitted and change it.</p><p><strong>Claim.</strong> Allowed lateness keeps join state alive, and a corrected match retracts the old one before emitting.</p><p><strong>Grounding.</strong> The same accumulation discipline as windows applies to joins.</p><p><strong>In the wild.</strong> Retract streams in Flink SQL correct emitted joins.</p>' },
      { tag: 'tradeoff', tagLabel: 'Growth', title: '7. Garbage-collect join state', content: '<p><strong>Why.</strong> A join buffer that never shrinks exhausts memory.</p><p><strong>Claim.</strong> Join state is garbage-collected when the watermark passes the window plus allowed lateness.</p><p><strong>Grounding.</strong> The window and allowed lateness together bound the state.</p><p><strong>In the wild.</strong> Flink cleans up interval-join state past the window + lateness.</p>' },
      { tag: 'tradeoff', tagLabel: 'Mistake', title: '8. Stream-stream vs stream-table confusion', content: '<p><strong>Why.</strong> Applying the wrong join type produces unbounded buffers or wrong matches.</p><p><strong>Claim.</strong> Join two streams with a window; join a stream to a table with a temporal lookup.</p><p><strong>Grounding.</strong> The input type — unbounded vs finite-per-key — picks the join type.</p><p><strong>In the wild.</strong> A common bug is a windowed join where a temporal lookup was intended.</p>' }
    ],
    examples: [
      { name: 'Flink SQL', desc: 'Interval (windowed) joins and temporal joins' },
      { name: 'Apache Beam', desc: 'CoGroupByKey as the join primitive with windowing' },
      { name: 'Kafka Streams', desc: 'Stream-stream (windowed) and stream-table joins over topics' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "An attribution pipeline joins ad impressions with clicks to attribute conversions, but it emits matches before a late impression could arrive, so some conversions are attributed to the wrong ad.", q: "How do you join two event streams correctly when events can arrive out of order?", solution: "Use a windowed join bounded by a time window, and let the watermark decide when a match is complete — emit only when both sides' watermarks pass the join window, with allowed lateness and retractions for late corrections.", components: ["Windowed join — interval bound", "Watermark — both sides pass", "Allowed lateness — late corrections", "Retraction — correct emitted matches"],  code: `// click ${CH09.C_ID} @ ${CH09.C_ET}, impression ${CH09.I_ID} @ ${CH09.I_ET}, bound ${CH09.J} s -> release at ${CH09.BOUND}\n//   join wm min(${CH09.PRE_A}, ${CH09.PRE_B}) = ${CH09.PRE_MIN} < ${CH09.BOUND} -> hold\n//   id ${CH09.CI_ID} lifts clicks to ${CH09.CI_A} -> min ${CH09.CI_MIN} > ${CH09.BOUND} -> emit\n//   late impression ${CH09.L_ID} @ ${CH09.L_ET} -> retract click ${CH09.C0_ID}'s NO-MATCH, emit (${CH09.C0_ID}, ${CH09.L_ID})`, tieback: "This is exactly the windowed-join and watermark material in this chapter.", refs: ["2. Windowed joins", "5. Watermarks bound the wait", "6. Late data and retractions"], problems: ["21-ad-click-aggregation"] },
    { scenario: "A click stream needs each click enriched with the user's current subscription tier before aggregation, and the tier changes over time.", q: "How do you join a stream to a slowly-changing table correctly?", solution: "Use a temporal (stream-table) join — probe the table at the join key for the version current at the event's time, rather than a windowed join.", components: ["Temporal join — lookup", "Table — changelog-backed", "Join key — user id"],  code: `// click ${CH09.C_ID} @ ${CH09.C_ET} is a seed row; the user id and the tier table are an\n// illustration OUTSIDE this chapter's dataset, which has two event streams and no dimension table\n//   probe user_table[42] as of ${CH09.C_ET} = {tier: gold}   (the version valid then, not now)\n//   -> click ${CH09.C_ID} + tier=gold, no window, no wait on a second watermark`, tieback: "This is exactly the temporal-join material in this chapter.", refs: ["3. Temporal joins", "8. Stream-stream vs stream-table confusion"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    walkthroughs: ['ch09-system', 'ch09-system-memory'],
    question: 'Design a windowed join between a click stream and an impression stream for ad attribution. Premise: the join must buffer each side until both watermarks pass, and a late row arriving afterward must retract and correct the earlier attribution.',
    pipeline: 'click stream + impression stream -> windowed join (buffer + watermark) -> retraction emitter -> attribution store',
    decomposition: [
      { box: 'click stream + impression stream', role: 'two streams — feed the join with event-time rows',
        parts: [
          `click ${CH09.C_ID} {event_time: "${CH09.C_ET}"} arrives at ${CH09.C_PT}`,
          `impression ${CH09.I_ID} {event_time: "${CH09.I_ET}"} arrived earlier, at ${CH09.I_PT}`,
          'each side carries its own watermark'
        ] },
      { box: 'windowed join (buffer + watermark)', role: 'windowed join — buffers one side and matches within a window',
        parts: [
          `the impression buffer holds rows within ${CH09.J} s of a click`,
          `click ${CH09.C_ID} probes the buffer and finds impression ${CH09.I_ID}, ${CH09.GAP} s apart`,
          `the match is held until the join watermark passes ${CH09.BOUND} (et + ${CH09.J} s), after event ${CH09.CI}`
        ] },
      { box: 'retraction emitter', role: 'retraction emitter — corrects matches when late data arrives',
        parts: [
          `click ${CH09.C0_ID} publishes NO-MATCH after event ${CH09.C0_EMIT}; impression ${CH09.L_ID} (et ${CH09.L_ET}) arrives at ${CH09.L_PT} and changes it`,
          'the NO-MATCH is retracted downstream',
          `the corrected match (click ${CH09.C0_ID}, impression ${CH09.L_ID}) is emitted`
        ] },
      { box: 'attribution store', role: 'attribution store — holds the final matches',
        parts: [
          'the store applies retractions so old matches do not double-count',
          'the final state shows the corrected (click, impression) pair',
          'join state is garbage-collected past the window + lateness'
        ] }
    ],
    
  },
  quiz: [
    { question: "Why do stream-stream joins need a time bound?", options: ["A. To save CPU", "B. Two unbounded streams have no natural join boundary", "C. To create watermarks", "D. To reduce latency"], answer: 2, explanation: "Without a time bound, a stream-stream join would buffer forever.", conceptRef: "1. Unbounded joins never finish" },
    { question: "What is a windowed join?", options: ["A. A lookup against a table", "B. A join matching rows within a time window of each other", "C. A join with no state", "D. A batch join"], answer: 2, explanation: "A windowed join matches rows whose time attributes fall within a window.", conceptRef: "2. Windowed joins" },
    { question: "What is a temporal join?", options: ["A. A join of two streams in a window", "B. Enriching a stream against a table version current at event time", "C. A join with no key", "D. A join of two tables"], answer: 2, explanation: "A temporal join probes the table at the join key for the version that was current at the row's event time, not the current one.", conceptRef: "3. Temporal joins" },
    { question: "When does a windowed join emit a match?", options: ["A. When the first row arrives", "B. When both sides' watermarks pass the join window", "C. Every second", "D. When the buffer is empty"], answer: 2, explanation: "The join waits until both streams are complete for the window.", conceptRef: "5. Watermarks bound the wait" },
    { question: "How is join state bounded?", options: ["A. It is never bounded", "B. By garbage-collecting past the window plus allowed lateness", "C. By the CPU", "D. By the number of keys"], answer: 2, explanation: "State past the window + allowed lateness is garbage-collected.", conceptRef: "7. Garbage-collect join state" }
  ],
  seeAlso: [
    { to: 3, section: 'Propagation and correctness', depth: 'a windowed join is bounded by the minimum of its inputs\' watermarks — the exact propagation rule ch03 defines.', example: `ch09's join claims min(${CH09.WA}, ${CH09.WB}) = ${CH09.WMIN}, ch03's stage watermark, so click ${CH09.NV_ID} (et ${CH09.NV_ET}, bound ${CH09.NV_BOUND}) never emits: the join waits on the slower stream.` },
    { to: 4, section: 'The window lifecycle', depth: 'a windowed join is a windowing problem — the join window assigns, buffers, and is garbage-collected by the same lifecycle ch04 covers.', example: `ch09's join bound, ${CH09.J} s either side of each click, is a window assigned per row by ch04's step 1 (Assign, which reads e.et and never the arrival time); ch09's buffer holding impression ${CH09.I_ID} (${CH09.I_ET}) until click ${CH09.C_ID} (${CH09.C_ET}) probes it is ch04's step 3 (Group and trigger), and dropping it once the watermark passes the bound is ch04's step 4 garbage collection.` },
    { to: 8, section: 'Joins and time in SQL', depth: 'streaming SQL gives the join a declarative spelling — interval joins and temporal joins with the same watermark semantics.', example: `ch09's ${CH09.J} s interval join is ch08's \`i.et BETWEEN c.et - INTERVAL '${CH09.J}' SECOND AND c.et + INTERVAL '${CH09.J}' SECOND\` join (ch08 Q2); ch08's "do not window a join against a slowly-changing table" is handed to this chapter's temporal join.` },
    { to: 7, section: 'Consistency and recovery', depth: 'join state is keyed state — bounded by the window and garbage-collected past window + lateness — and ch07 covers how that state is stored and recovered.', example: `ch09's impression buffer is the join state; ch07's checkpoint taken after event ${CH09.CHK} — ${CH09.CHK_N} state entries holding ${CH09.CHK_SUM}, ${CH09.CHK_STATE}, at offset ${CH09.CHK}, resumed at ${CH09.CHK + 1} — is how keyed state like it is snapshotted with its input position, so a crash does not re-buffer from the start.` }
  ],
  sources: [
    { name: 'Apache Flink — SQL joins', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql/queries/joins/', note: 'Interval and temporal joins and their watermark semantics' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'Join semantics under the streaming model' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'CoGroupByKey as the join primitive' },
    { name: 'Apache Kafka — Kafka Streams documentation', url: 'https://kafka.apache.org/documentation/streams/', note: 'Stream-stream and stream-table joins over topics' }
  ]
});
