registerChapter({
  id: 'ch02',
  num: 2,
  title: 'The What, Where, When, and How of Data Processing',
  pattern: 'The four questions that completely describe any pipeline: what results are computed (transformations), where in event time they are computed (windowing), when in processing time they are materialized (triggers + watermarks), and how later refinements relate to earlier results (accumulation).',
  aka: 'SS Ch02 · Beam Model · Transformations · Windowing · Triggers · Watermarks · Accumulation',
  part: 1,

  flow: [
    {
      section: 'What and Where — transformations and windowing',
      walkthroughs: ['ch02-whatwhere', 'ch02-whatwhere-memory'],
      color: 'cyan',
      motivation: `Before anything can be said about correctness or latency, a pipeline must say what it computes and over which slice of event time, so this section fixes those two axes first.`,
      steps: [
        { num: 1, title: 'What: transformations', detail: 'The answer to "what" is a computation over the data — a sum, a filter, a join, a keyed aggregation. In the Beam model <strong>a pipeline is a directed acyclic graph of transforms, and the transform decides what the output is.</strong>' },
        { num: 2, title: 'Where: windowing', detail: 'The answer to "where" is the slice of event time a value is computed over. <strong>Windowing cuts an unbounded stream into finite, event-time-aligned pieces</strong> — fixed windows, sliding windows, session windows — so an aggregate has a well-defined boundary.' },
        { num: 3, title: 'The two axes are independent', detail: 'Choosing what to compute and choosing where to compute it are separate decisions. <strong>You can sum per fixed window, per session, or over all time — the transform is the same, the window changes the grouping.</strong>' },
        { num: 4, title: 'Batch already answers what and where', detail: 'A classic MapReduce job also has transformations and (implicitly) windowing — the input file is one big fixed window. <strong>The streaming model makes the window explicit and unbounded.</strong>' }
      ],
    },
    {
      section: 'When — triggers and watermarks',
      walkthroughs: ['ch02-when', 'ch02-when-memory'],
      color: 'orange',
      motivation: `A window is useless until the pipeline decides when to emit its result, and that "when" is a processing-time decision driven by triggers and watermarks, so this section covers the timing machinery that the rest of the book leans on.`,
      steps: [
        { num: 1, title: 'Triggers decide when results materialize', detail: 'A trigger is the mechanism that says "emit the current window result now". <strong>Triggers can fire on processing time (every N seconds), on event-time progress (the watermark passes the window end), or on data arrival (count of elements).</strong>' },
        { num: 2, title: 'Watermarks declare event-time completeness', detail: 'A watermark is a signal that "no more events with event time earlier than t will arrive". <strong>It is the pipeline\'s best estimate of how complete the event-time axis is, and it lets a trigger close a window.</strong>' },
        { num: 3, title: 'Early, on-time, and late triggers', detail: 'A pipeline can emit a window\'s result <strong>early</strong> (speculative, before the watermark), <strong>on-time</strong> (when the watermark passes the window end), and <strong>late</strong> (after the watermark, for stragglers). Each is a separate trigger.' },
        { num: 4, title: 'Allowed lateness bounds the waiting', detail: 'After the watermark passes, a pipeline may keep accepting stragglers for an "allowed lateness" horizon, then discard them. <strong>Allowed lateness is garbage collection for window state — it bounds how long late data can still update a result.</strong>' }
      ],
    },
    {
      section: 'How — accumulation',
      walkthroughs: ['ch02-how', 'ch02-how-memory'],
      color: 'green',
      motivation: `When a window emits more than once, the consumer must know whether each result replaces or refines the previous one, so this section covers the four accumulation modes that relate later panes to earlier ones.`,
      steps: [
        { num: 1, title: 'Accumulation relates panes', detail: 'The answer to "how" is the relationship between a window\'s successive results. <strong>Accumulating mode adds to the previous pane; discarding mode replaces it; accumulating-and-retracting also emits a retraction so downstream can undo the old value.</strong>' },
        { num: 2, title: 'Why retractions exist', detail: 'If a downstream system stores the first result, a later refined result would double-count unless the old value is retracted. <strong>Accumulating-and-retracting emits the delta and a retraction of the previous pane, so a sink can stay correct.</strong> The previous value is read from the operator\'s <strong>keyed state</strong> — the running fold for that key — never by re-scanning the stream, which is immutable history.' },
        { num: 3, title: 'The four questions are a checklist', detail: 'Ask all four — what, where, when, how — of any pipeline and its behavior is fully specified. <strong>Omit "when" and you cannot reason about latency; omit "how" and you cannot reason about correctness under refinement.</strong>' }
      ],
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Pipelines are underspecified', content: '<p><strong>Why.</strong> Two teams can build "the same" pipeline that behaves differently because one never said when results emit or how later results relate to earlier ones.</p><p><strong>Claim.</strong> A pipeline is fully specified only when it answers what, where, when, and how.</p><p><strong>Grounding.</strong> The four questions are the Beam model\'s complete description of a pipeline.</p><p><strong>In the wild.</strong> Beam\'s PTransform (what), Window (where), Trigger (when), and AccumulationMode (how) map one-to-one onto the four questions.</p>' },
      { tag: 'solution', tagLabel: 'Axis', title: '2. Transformations (what)', content: '<p><strong>Why.</strong> The output of a pipeline is whatever its transforms compute, so the transform is the first thing a design must pin down.</p><p><strong>Claim.</strong> Transformations are the computations — sum, filter, join, keyed aggregation — applied to the data.</p><p><strong>Grounding.</strong> A pipeline is a DAG of transforms in the Beam model.</p><p><strong>In the wild.</strong> A Beam ParDo or a Flink map/keyBy/sum is a transform.</p>' },
      { tag: 'solution', tagLabel: 'Axis', title: '3. Windowing (where)', content: '<p><strong>Why.</strong> An unbounded stream has no natural boundary, so aggregates need an explicit event-time slice to be well-defined.</p><p><strong>Claim.</strong> Windowing cuts the stream into finite, event-time-aligned pieces — fixed, sliding, or session windows.</p><p><strong>Grounding.</strong> The window is the "where" an aggregate is computed over.</p><p><strong>In the wild.</strong> A 5-minute fixed window in Flink is a windowing choice.</p>' },
      { tag: 'solution', tagLabel: 'Axis', title: '4. Triggers (when)', content: '<p><strong>Why.</strong> Without a trigger a window result sits unemitted forever, so the pipeline must name the processing-time conditions that fire output.</p><p><strong>Claim.</strong> Triggers decide when a window\'s result materializes — on processing time, on the watermark, or on element count.</p><p><strong>Grounding.</strong> Early, on-time, and late are three trigger points for the same window.</p><p><strong>In the wild.</strong> Flink\'s trigger API fires on watermark passage by default.</p>' },
      { tag: 'solution', tagLabel: 'Signal', title: '5. Watermarks', content: '<p><strong>Why.</strong> The pipeline needs a signal for how complete event time is before it can safely close a window.</p><p><strong>Claim.</strong> A watermark is the statement "no more events with event time earlier than t will arrive".</p><p><strong>Grounding.</strong> The watermark passing a window\'s end is what makes an on-time trigger fire.</p><p><strong>In the wild.</strong> Flink and Dataflow watermarks are the production completeness signal.</p>' },
      { tag: 'solution', tagLabel: 'Bound', title: '6. Allowed lateness', content: '<p><strong>Why.</strong> After the watermark passes, late data still exists, and the pipeline must bound how long it keeps window state around for stragglers.</p><p><strong>Claim.</strong> Allowed lateness is the horizon after the watermark during which a window still accepts and updates late events.</p><p><strong>Grounding.</strong> Beyond it, stragglers are dropped — it is garbage collection for window state.</p><p><strong>In the wild.</strong> Dataflow\'s allowed-lateness setting is the production form.</p>' },
      { tag: 'solution', tagLabel: 'Mode', title: '7. Accumulation (how)', content: '<p><strong>Why.</strong> A window that emits early and on-time produces multiple panes, and downstream must know if each pane adds to or replaces the last.</p><p><strong>Claim.</strong> Accumulation modes — accumulating, discarding, accumulating-and-retracting — define how later panes relate to earlier ones.</p><p><strong>Grounding.</strong> Retracting mode undoes the previous pane so sinks do not double-count; the old value is read from the operator\'s keyed state, not re-scanned from the stream.</p><p><strong>In the wild.</strong> Beam\'s accumulation modes are the production expression of "how".</p>' },
      { tag: 'tradeoff', tagLabel: 'Checklist', title: '8. The four-question checklist', content: '<p><strong>Why.</strong> A design review that omits one axis ships a pipeline whose latency or correctness is an accident rather than a decision.</p><p><strong>Claim.</strong> Ask what, where, when, and how of every pipeline, and its behavior is fully specified.</p><p><strong>Grounding.</strong> Omit "when" and latency is unspecified; omit "how" and refinement correctness is unspecified.</p><p><strong>In the wild.</strong> The book\'s recurring worked example (team score over sessions) is defined by exactly these four answers.</p>' }
    ],
    examples: [
      { name: 'Apache Beam', desc: 'What/where/when/how exposed as PTransform, Window, Trigger, and AccumulationMode' },
      { name: 'Apache Flink', desc: 'Event-time windows with watermark-driven triggers and early/on-time/late firing' },
      { name: 'Google Cloud Dataflow', desc: 'Fully managed Beam runner with watermarks and allowed lateness' },
      { name: 'Flink SQL', desc: 'TUMBLE windows plus watermark emission — a declarative spelling of where and when' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A real-time dashboard sums purchases per 5-minute window, but it can't say whether a number is final — an event that happened at 12:04 can still arrive after the window was shown.", q: "How do you decide when a window's result is ready to emit, and what do you do about events that arrive later?", solution: "Use a watermark to declare event-time completeness; emit on-time when the watermark passes the window end, and keep the window alive for an allowed-lateness horizon so late events can update the result.", components: ["Fixed window — the event-time slice", "Watermark — completeness signal", "On-time trigger — fires at the watermark", "Allowed lateness — bounds late updates"],  code: "// window [12:00,12:05), sum = 3\n//   watermark 12:05:00 -> on-time trigger -> emit {sum:3}\n//   straggler event_time 12:04:59 at 12:06 -> allowed lateness 1 min\n//     -> update sum 3->4, emit late pane {sum:4}\n//   beyond allowed lateness -> drop the straggler", tieback: "This is exactly the When (triggers + watermarks) and How (accumulation) material in this chapter.", refs: ["4. Triggers (when)", "5. Watermarks", "6. Allowed lateness", "7. Accumulation (how)"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] },
    { scenario: "Two teams build 'the same' streaming aggregation, but one emits a running total and the other replaces each number — downstream sums them and double-counts.", q: "What axis did the teams fail to specify, and how do you fix the double-count?", solution: "They failed to specify the accumulation mode (how). Use accumulating-and-retracting so each refined pane retracts the previous value before adding the new one.", components: ["Accumulation mode — how panes relate", "Retraction — undo the previous pane", "Sink — applies retractions correctly"],  code: "// accumulating : sink = 3 then 3+4 = 7 -> double counts\n// retracting  : pane1 {sum:3} -> retract -> pane2 {sum:4}\n//   sink sees 3, then -3 +4 = 4 -> correct", tieback: "This is exactly the How (accumulation) axis in this chapter.", refs: ["7. Accumulation (how)", "8. The four-question checklist"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    walkthroughs: ['ch02-system', 'ch02-system-memory'],
    question: 'Design a purchase-counting pipeline that answers what, where, when, and how for one result. Premise: a purchase arrives late, so the pipeline must close the window on the watermark and let allowed lateness correct the already-emitted count.',
    pipeline: 'writer (event source) -> transport (stream) -> collector (window assigner) -> aggregator/store (per-window state) -> reader (dashboard)',
    decomposition: [
      { box: 'writer (event source)', role: 'writer — emits events with event time',
        parts: [
          'a purchase event {user: 42, amount: 10, event_time: "12:04:00"} is emitted',
          'event time is stamped by the source, not the pipeline',
          'events are immutable once produced'
        ] },
      { box: 'transport (stream)', role: 'transport — carries events and computes the watermark',
        parts: [
          'the stream delivers the event and tracks the watermark = 12:05:00',
          'the watermark says no events earlier than 12:05:00 will arrive',
          'network delay keeps the watermark behind the wall clock'
        ] },
      { box: 'collector (window assigner)', role: 'collector — assigns events to event-time windows',
        parts: [
          'the window assigner places the event in fixed window [12:00, 12:05)',
          'a trigger decides when the window result is emitted',
          'allowed lateness keeps the window open for stragglers'
        ] },
      { box: 'aggregator/store (per-window state)', role: 'aggregator/store — holds the running sum per window',
        parts: [
          'window [12:00, 12:05) sum : 0 -> 10 as the purchase folds in',
          'an early pane emits {sum: 10}, an on-time pane re-emits {sum: 10}',
          'a late straggler updates sum : 10 -> 20 if inside allowed lateness'
        ] }
    ],
    
  },
  quiz: [
    { question: "Which four questions fully specify a pipeline in the Beam model?", options: ["A. Who, what, when, why", "B. What, where, when, how", "C. Where, why, which, how", "D. What, where, when, who"], answer: 2, explanation: "The four axes are what (transformations), where (windowing), when (triggers), and how (accumulation).", conceptRef: "1. Pipelines are underspecified" },
    { question: "What does a watermark declare?", options: ["A. The exact wall-clock time", "B. That no more events with event time earlier than t will arrive", "C. The number of events processed", "D. The system's CPU load"], answer: 2, explanation: "A watermark is the pipeline's statement of event-time completeness — the threshold past which it expects no older events.", conceptRef: "5. Watermarks" },
    { question: "What is allowed lateness?", options: ["A. A window that never closes", "B. The horizon after the watermark during which a window still accepts late events", "C. The maximum event size", "D. A type of trigger"], answer: 2, explanation: "Allowed lateness bounds how long after the watermark a window keeps accepting and updating with stragglers.", conceptRef: "6. Allowed lateness" },
    { question: "Which accumulation mode avoids double-counting when a window refines an earlier result?", options: ["A. Discarding", "B. Accumulating", "C. Accumulating-and-retracting", "D. None of the above"], answer: 3, explanation: "Accumulating-and-retracting emits the delta plus a retraction of the previous pane so sinks can undo the old value.", conceptRef: "7. Accumulation (how)" },
    { question: "When does an on-time trigger fire?", options: ["A. When the first event arrives", "B. When the watermark passes the window end", "C. Every second", "D. When the window is empty"], answer: 2, explanation: "On-time emission is driven by the watermark crossing the window's end.", conceptRef: "4. Triggers (when)" }
  ],
  seeAlso: [
    { to: 1, section: 'Event time vs processing time', depth: 'the "when" axis only matters because the two clocks disagree; ch01 pins down event time vs processing time and the lag between them.', example: 'ch02\'s on-time trigger fires when the watermark passes the window end; ch01 explains why the watermark is needed at all — the same click at 12:00:59 processed at 12:04:11 lands in different windows under the two clocks.' },
    { to: 3, section: 'Propagation and correctness', depth: 'the watermark that drives this chapter\'s on-time trigger is defined in full in ch03 — perfect vs heuristic, the skew formula, and how it propagates as the minimum across inputs.', example: 'ch02 says "the watermark passes 12:05:00"; ch03 shows where that number comes from — max_seen 12:08:30 − skew 120 s = 12:06:30 — and that a multi-input stage takes min(12:06:00, 12:04:30) = 12:04:30.' },
    { to: 4, section: 'The window lifecycle', depth: 'the "where" axis (windows) is named here but its full lifecycle — assign, merge, group, trigger, accumulate, garbage-collect — lives in ch04, with session merging as the canonical dynamic case.', example: 'ch02\'s session window (30-min gap) opens s1; ch04 shows two sessions [12:00,12:10) and [12:40,12:50) merging into [12:00,12:50) when a bridge event lands at 12:20:00.' },
    { to: 6, section: 'The duality', depth: 'the "how" axis (accumulation, retractions) is the stream-table duality in motion — each pane is a changelog record, and the table is the accumulated view.', example: 'ch02\'s accumulating-and-retracting mode (3 − 3 + 4 = 4) is ch06\'s changelog fold: retract the old value, set the new one, so a sink never double-counts.' }
  ],
  sources: [
    { name: 'Tyler Akidau — "The world beyond batch: Streaming 102"', url: 'https://www.oreilly.com/radar/the-world-beyond-batch-streaming-102/', note: 'The original statement of the what/where/when/how questions and their triggers, watermarks, and accumulation' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'The formal model behind the four questions' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'The four questions as first-class API concepts' },
    { name: 'Apache Flink — Concepts: Time', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/', note: 'Windowing and watermark semantics in a production engine' }
  ]
});
