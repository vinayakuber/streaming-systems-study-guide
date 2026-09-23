registerChapter({
  id: 'ch03',
  num: 3,
  title: 'Watermarks',
  pattern: 'A watermark is a monotonically increasing timestamp that declares how complete the event-time axis is; it is the mechanism that lets a pipeline trade latency against correctness when closing windows.',
  aka: 'SS Ch03 · Watermark · Event-time Progress · Heuristic Watermark · Perfect Watermark · Skew',
  part: 1,

  flow: [
    {
      section: 'What a watermark is',
      color: 'cyan',
      motivation: `A window cannot close until the pipeline believes no more data for that window will arrive, so watermarks exist to state that belief explicitly and let downstream stages act on it.`,
      steps: [
        { num: 1, title: 'A timestamp that moves forward', detail: 'A watermark is a <strong>monotonically increasing</strong> event-time value: once it advances past a point, the pipeline declares it will not see event time earlier than that point again.' },
        { num: 2, title: 'It is a statement about completeness', detail: 'The watermark is the pipeline\'s best estimate of event-time completeness. <strong>It is not the wall clock and it is not a guarantee — it is a promise the pipeline makes so triggers can fire.</strong>' },
        { num: 3, title: 'Two kinds of watermarks', detail: 'A <strong>perfect</strong> watermark is possible when you know inputs are in order (e.g. ingestion-time processing of a single log). A <strong>heuristic</strong> watermark is an estimate when inputs can be out of order (e.g. mobile devices that go offline).' },
        { num: 4, title: 'Watermarks drive on-time triggers', detail: 'The on-time trigger for a window fires when the watermark passes the window\'s end. <strong>Everything else — early, late, allowed lateness — is defined relative to the watermark.</strong>' }
      ],
      program: `// STREAM SIDE — a perfect watermark advances as a single ordered log is consumed
// DEF: watermark — the pipeline's event-time completeness signal, currently 12:05:00
// DEF: window — the fixed event-time slice [12:00, 12:05)
// -> input : the reader consumes log record {event_time: "12:05:01"}
//    step 1 · the record is in order -> watermark : 12:05:00 -> 12:05:01   BECAUSE a single ordered log has no out-of-order arrivals
//    step 2 · the new watermark passes 12:05:00 -> the window [12:00, 12:05) is now complete
//    step 3 · the on-time trigger fires -> emitted : {window: "12:00-12:05", sum: 7, pane: "on-time"}
// <- outcome : the watermark at 12:05:01 closed the window   BECAUSE 12:05:01 > 12:05:00
//    derivation : this is a perfect watermark because the source is one ordered log, not a set of out-of-order devices`
    },
    {
      section: 'Heuristic watermarks and skew',
      color: 'orange',
      motivation: `Real sources are out of order — a phone with no network can send an hour-old event — so pipelines estimate watermarks from what they have seen, and the estimate can be wrong in both directions.`,
      steps: [
        { num: 1, title: 'Estimate from observed event time minus lag', detail: 'A common heuristic: track the <strong>maximum event time seen so far</strong> and subtract a fixed skew (a bound on out-of-orderness). <strong>watermark = max_seen_event_time - skew.</strong>' },
        { num: 2, title: 'Too fast = late data looks late', detail: 'If the heuristic advances faster than the true arrival pattern, events that are merely delayed get classified as late. <strong>An over-eager watermark loses data correctness to gain latency.</strong>' },
        { num: 3, title: 'Too slow = correct but high latency', detail: 'If the skew is too conservative, the watermark lags and windows stay open longer. <strong>An over-cautious watermark keeps results correct but delays on-time output.</strong>' },
        { num: 4, title: 'Per-source tracking is more accurate', detail: 'When each source has its own idleness pattern, tracking a watermark <strong>per source and taking the minimum</strong> is safer than one global watermark — a single idle source stops dragging the whole pipeline\'s watermark forward.' }
      ],
      program: `// AGGREGATOR SIDE — a heuristic watermark from the max seen event time minus a skew
// DEF: skew — the pipeline's bound on out-of-orderness = 2 min
// DEF: watermark — max_seen_event_time - skew = 12:05:00 (12:07:00 - 2:00), recomputed on every record
// DEF: max_seen — the largest event_time observed so far = 12:07:00
// -> input : the pipeline ingests record {event_time: "12:08:30"}
//    step 1 · the record is newer -> max_seen : 12:07:00 -> 12:08:30   BECAUSE 12:08:30 > 12:07:00
//    step 2 · recompute the watermark -> watermark : 12:05:00 -> 12:06:30   BECAUSE 12:08:30 - 2 min skew = 12:06:30
//    step 3 · a delayed record {event_time: "12:05:10"} arrives -> it is 80 s older than the watermark -> marked late
// <- outcome : the watermark at 12:06:30 closed windows up to 12:06:30, and the 12:05:10 record arrived as a late straggler
//    derivation : watermark = max_seen - skew = 12:08:30 - 2:00 = 12:06:30   BECAUSE the heuristic assumes no record is more than 2 min late`
    },
    {
      section: 'Propagation and correctness',
      color: 'green',
      motivation: `A watermark only matters if every downstream stage sees a coherent value, and a coherent value only helps if the pipeline knows what to do when the estimate is wrong, so this section covers propagation and the failure mode.`,
      steps: [
        { num: 1, title: 'The watermark is the minimum across inputs', detail: 'When a stage has multiple upstream sources, <strong>its watermark is the minimum of its inputs\' watermarks</strong> — a stage cannot claim more completeness than its least-complete input.' },
        { num: 2, title: 'A watermark is an estimate, not a guarantee', detail: 'Because heuristics can be wrong, <strong>a watermark that passed does not mean late data will never arrive</strong> — it means the pipeline has chosen to treat the window as closed.' },
        { num: 3, title: 'Allowed lateness is the safety net', detail: 'When the heuristic is wrong and data arrives after the watermark, <strong>allowed lateness lets the window still accept it</strong> for a bounded horizon, then discard it.' },
        { num: 4, title: 'Watermarks are what make event-time pipelines tractable', detail: 'Without watermarks, a pipeline can never emit a result that a user can trust as "done for now". <strong>Watermarks convert an unbounded stream into a stream with a notion of progress.</strong>' }
      ],
      program: `// JOIN STAGE — two inputs, the stage watermark is the minimum of the two
// DEF: watermark — the stage's completeness signal = min of upstream watermarks = 12:04:30
// DEF: input_a — watermark from the click source = 12:06:00
// DEF: input_b — watermark from the purchase source = 12:04:30
// DEF: stage — the join operator that combines input_a and input_b = the pipeline operator
// STATE (before):
//    stage_watermark : { value: 12:06:00 }
// -> input : the join stage polls input_a at 12:06:00 and input_b at 12:04:30
//    step 1 · read input_a watermark -> stage_watermark : 12:06:00 -> 12:06:00   BECAUSE it is the min of the two so far
//    step 2 · read input_b watermark -> stage_watermark : 12:06:00 -> 12:04:30   BECAUSE 12:04:30 < 12:06:00
//    step 3 · the stage cannot emit a join result keyed at 12:05:00 -> it waits   BECAUSE input_b may still deliver 12:05:00 records
// <- outcome : the stage watermark sits at 12:04:30 until input_b catches up   BECAUSE completeness is bounded by the slowest input
//    derivation : stage_watermark = min(12:06:00, 12:04:30) = 12:04:30`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Unbounded data has no natural "done"', content: '<p><strong>Why.</strong> A stream never ends, so a pipeline cannot know when a window has seen all its data without a signal of progress.</p><p><strong>Claim.</strong> A watermark is that signal — a monotonically increasing event-time timestamp declaring completeness.</p><p><strong>Grounding.</strong> The watermark is the book\'s central mechanism for event-time progress.</p><p><strong>In the wild.</strong> Dataflow, Flink, and Beam all expose watermarks as first-class concepts.</p>' },
      { tag: 'solution', tagLabel: 'Perfect', title: '2. Perfect watermarks', content: '<p><strong>Why.</strong> If a source is provably ordered, the pipeline can know completeness exactly rather than estimating it.</p><p><strong>Claim.</strong> A perfect watermark is possible for ordered inputs — a single log consumed in order, or ingestion-time processing.</p><p><strong>Grounding.</strong> For an ordered log, every record is at or ahead of the watermark, so the watermark can advance to each record\'s timestamp.</p><p><strong>In the wild.</strong> Ingestion-time pipelines over a single Kafka partition are the classic perfect-watermark case.</p>' },
      { tag: 'solution', tagLabel: 'Heuristic', title: '3. Heuristic watermarks', content: '<p><strong>Why.</strong> Out-of-order sources (mobile devices, retries, multi-region collectors) make a perfect watermark impossible.</p><p><strong>Claim.</strong> A heuristic watermark estimates completeness from observed data — typically max seen event time minus a skew.</p><p><strong>Grounding.</strong> watermark = max_seen_event_time − skew is the book\'s canonical heuristic.</p><p><strong>In the wild.</strong> Flink\'s BoundedOutOfOrdernessWatermarkGenerator implements exactly this.</p>' },
      { tag: 'solution', tagLabel: 'Parameter', title: '4. Skew (out-of-orderness bound)', content: '<p><strong>Why.</strong> A heuristic needs a knob that says how out-of-order the source can be, to trade latency against correctness.</p><p><strong>Claim.</strong> Skew is the assumed bound on out-of-orderness subtracted from the max seen event time.</p><p><strong>Grounding.</strong> Too small a skew mislabels delayed data as late; too large a skew delays on-time output.</p><p><strong>In the wild.</strong> The skew parameter in a Dataflow pipeline is the production form.</p>' },
      { tag: 'solution', tagLabel: 'Bound', title: '5. Per-source watermarks', content: '<p><strong>Why.</strong> One global watermark is dragged down by the slowest source — a single idle device stalls completeness for everything.</p><p><strong>Claim.</strong> Track a watermark per source and take the minimum; this lets fast sources advance without being blocked by slow ones.</p><p><strong>Grounding.</strong> The minimum across per-source watermarks is the stage\'s watermark.</p><p><strong>In the wild.</strong> Per-partition watermarks in Flink are the production form.</p>' },
      { tag: 'solution', tagLabel: 'Propagation', title: '6. Watermark propagation', content: '<p><strong>Why.</strong> A stage with multiple inputs cannot claim more completeness than its least-complete input.</p><p><strong>Claim.</strong> A stage\'s watermark is the minimum of its inputs\' watermarks.</p><p><strong>Grounding.</strong> The join stage in the book waits on the slower input before emitting a keyed result.</p><p><strong>In the wild.</strong> Flink\'s watermark alignment (min across inputs) is the production form.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: '7. Latency vs correctness', content: '<p><strong>Why.</strong> The watermark\'s aggressiveness is the single knob that trades result latency against late-data correctness.</p><p><strong>Claim.</strong> An eager watermark emits early and risks late data; a cautious watermark waits and delays output.</p><p><strong>Grounding.</strong> Skew is the parameter that moves the pipeline along this tradeoff.</p><p><strong>In the wild.</strong> Tuning the out-of-orderness bound is a routine production decision.</p>' },
      { tag: 'tradeoff', tagLabel: 'Safety net', title: '8. Watermarks + allowed lateness', content: '<p><strong>Why.</strong> A heuristic watermark can be wrong, so a pipeline needs a bounded way to accept data that arrives after the watermark.</p><p><strong>Claim.</strong> Allowed lateness keeps the window alive for a bounded horizon after the watermark, then drops stragglers.</p><p><strong>Grounding.</strong> It is the garbage collector for window state that outlives the watermark.</p><p><strong>In the wild.</strong> Dataflow\'s allowed-lateness setting is the production form.</p>' }
    ],
    examples: [
      { name: 'Apache Flink', desc: 'BoundedOutOfOrdernessWatermarkGenerator and per-partition watermarks' },
      { name: 'Google Cloud Dataflow', desc: 'Watermarks with allowed lateness and trigger configuration' },
      { name: 'Apache Beam', desc: 'Watermark as a first-class pipeline concept' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A mobile analytics pipeline groups events by event time, but phones that go offline send events up to an hour late — so some 12:04 events arrive after the 12:05 window has already been reported.", q: "How do you compute event-time completeness when inputs are out of order, and what do you do about data that arrives after you declared the window complete?", solution: "Use a heuristic watermark — max seen event time minus a skew (out-of-orderness bound) — and keep windows alive for an allowed-lateness horizon after the watermark so late events can still update the result.", components: ["Heuristic watermark — max_seen − skew", "Skew — bound on out-of-orderness", "Allowed lateness — accepts late data for a bounded horizon", "On-time trigger — fires at the watermark"],  code: "// max_seen = 12:08:30, skew = 2 min\n//   watermark = 12:08:30 - 2:00 = 12:06:30\n//   window [12:00,12:05) -> closed (12:06:30 > 12:05:00)\n//   event @ 12:05:10 arrives -> 80 s older than watermark -> late\n//   allowed lateness 1 min -> still accepted -> re-emit", tieback: "This is exactly the heuristic watermark and skew material in this chapter.", refs: ["3. Heuristic watermarks", "4. Skew (out-of-orderness bound)", "8. Watermarks + allowed lateness"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] },
    { scenario: "A streaming join reads two sources, one fast and one slow; results for 12:05 keep getting emitted with missing data from the slow source.", q: "Why does the join emit incomplete results, and how do you fix it?", solution: "The join stage's watermark is the minimum of its inputs' watermarks, so the slow input stalls completeness; fix it with per-source watermarks and/or buffer the fast side until the slow side's watermark catches up.", components: ["Watermark propagation — min across inputs", "Per-source watermarks", "Join buffer — holds the fast side"],  code: "// stage_watermark = min(12:06:00, 12:04:30) = 12:04:30\n//   join keyed at 12:05:00 -> cannot emit -> waits on slow source\n//   per-source watermarks let the fast side advance independently", tieback: "This is exactly the watermark-propagation material in this chapter.", refs: ["5. Per-source watermarks", "6. Watermark propagation"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    question: 'Design the watermark generator for an event-time pipeline. Premise: the watermark advances as max_seen event time minus a skew bound, so windows close on time and a straggler after the watermark is flagged late.',
    pipeline: 'sources (events with event time) -> watermark generator (max_seen − skew) -> window assigner -> per-window state -> trigger/emitter -> dashboard',
    decomposition: [
      { box: 'sources (events with event time)', role: 'sources — emit events that may be out of order',
        parts: [
          'a phone emits {event_time: "12:08:30"} after a network delay',
          'event time is stamped at the source, not at ingestion',
          'a straggler {event_time: "12:05:10"} may arrive after newer events'
        ] },
      { box: 'watermark generator (max_seen − skew)', role: 'watermark generator — estimates event-time completeness',
        parts: [
          'max_seen : 12:07:00 -> 12:08:30 as the newest event arrives',
          'watermark = max_seen - skew = 12:08:30 - 2:00 = 12:06:30',
          'per-source watermarks are min-ed together at the stage'
        ] },
      { box: 'window assigner', role: 'window assigner — assigns events to event-time windows',
        parts: [
          'event {event_time: "12:08:30"} lands in window [12:05, 12:10)',
          'the watermark at 12:06:30 means windows up to 12:06:30 are complete',
          'window [12:00, 12:05) is closed because 12:06:30 > 12:05:00'
        ] },
      { box: 'trigger/emitter', role: 'trigger/emitter — fires on the watermark and handles late data',
        parts: [
          'the on-time trigger fires when the watermark passes the window end',
          'a late event {event_time: "12:05:10"} is accepted if inside allowed lateness',
          'a late pane re-emits the updated window result to the dashboard'
        ] }
    ],
    
    program: `// SYSTEM DESIGN — a watermark closes a window on time and allowed lateness catches one straggler
// DEF: watermark — the pipeline's completeness signal = max_seen - skew = 12:06:30
// DEF: skew — the out-of-orderness bound = 2 min
// DEF: allowed lateness — the horizon after the watermark = 1 min
// DEF: window — the fixed event-time slice = [12:00, 12:05)
// STATE (before):
//    window_state : { "12:00-12:05": 7 }
// -> input : the source emits record {event_time: "12:08:30"}
//    step 1 · max_seen updates -> max_seen : 12:07:00 -> 12:08:30   BECAUSE the record is newer than anything seen
//    step 2 · the watermark recomputes -> watermark : 12:05:00 -> 12:06:30   BECAUSE 12:08:30 - 2:00 skew = 12:06:30
//    step 3 · the on-time trigger fires -> emitted : {window: "12:00-12:05", sum: 7}   BECAUSE 12:06:30 > 12:05:00
// <- outcome : a late record {event_time: "12:05:10"} still updates the window   BECAUSE it is inside allowed lateness
//    derivation : watermark = max_seen - skew = 12:08:30 - 2:00 = 12:06:30`
  },
  quiz: [
    { question: "What is a watermark?", options: ["A. The wall-clock time", "B. A monotonically increasing timestamp declaring event-time completeness", "C. The number of events in a window", "D. A type of window"], answer: 2, explanation: "A watermark is the pipeline's estimate of how complete the event-time axis is.", conceptRef: "1. Unbounded data has no natural done" },
    { question: "When is a perfect watermark possible?", options: ["A. When inputs are out of order", "B. When the source is provably ordered", "C. When there are many sources", "D. When there is no skew"], answer: 2, explanation: "Perfect watermarks require ordered input, such as a single log consumed in order.", conceptRef: "2. Perfect watermarks" },
    { question: "What is the canonical heuristic watermark formula?", options: ["A. watermark = wall clock + skew", "B. watermark = min event time + skew", "C. watermark = max seen event time − skew", "D. watermark = event count / skew"], answer: 3, explanation: "The heuristic subtracts a skew (out-of-orderness bound) from the max seen event time.", conceptRef: "3. Heuristic watermarks" },
    { question: "A stage's watermark with multiple inputs is the ___ of its inputs' watermarks.", options: ["A. maximum", "B. minimum", "C. sum", "D. average"], answer: 2, explanation: "Completeness is bounded by the least-complete input, so the stage watermark is the minimum.", conceptRef: "6. Watermark propagation" },
    { question: "What is the downside of an over-eager (too-fast) watermark?", options: ["A. Higher latency", "B. Delayed data is mislabeled as late", "C. Windows never close", "D. Memory exhaustion"], answer: 2, explanation: "An over-eager watermark gains latency but loses correctness by treating delayed data as late.", conceptRef: "7. Latency vs correctness" }
  ]
});
