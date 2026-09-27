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
// DEF: watermark — the pipeline's event-time completeness signal = "12:05:00"
// DEF: window — the fixed event-time slice = [12:00, 12:05)
// DEF: log — an ordered single-partition source = { offset: 7, event_time: "12:05:01" }
// STATE (before):
//    watermark : "12:05:00"
// ======================================================================
// offset 7: {event_time: "12:05:01"}
// offset 8: {event_time: "12:05:02"}
// ======================================================================
// BUILD PHASE · run once at pipeline start · cost O(1)
// step 0 · initialize the watermark register -> watermark : none -> "12:05:00"
//    -> input  : ordered log, no record yet consumed at the shown offsets
//    <- output : watermark = "12:05:00"   BECAUSE the generator holds one monotonically increasing register
// QUERY PHASE · per ordered record · cost O(1)
// step 1 · the reader consumes offset 7 in order -> watermark : "12:05:00" -> "12:05:01"
//    -> input  : log offset = 7, record.event_time = "12:05:01", watermark = "12:05:00"
//    decode 1a · read the record at offset 7 -> record : none -> {event_time: "12:05:01"}
//    decode 1b · advance the watermark to the record's event_time -> watermark : "12:05:00" -> "12:05:01"
//    <- output : watermark = "12:05:01"   BECAUSE a single ordered log has no out-of-order arrivals
// step 2 · the new watermark passes 12:05:00 -> window_status : "open" -> "complete"
//    -> input  : watermark = "12:05:01", window end = "12:05:00"
//    <- output : window_status = "complete"   BECAUSE 12:05:01 > 12:05:00
// step 3 · the on-time trigger fires -> emitted : {} -> {window: "12:00-12:05", sum: 7, pane: "on-time"}
//    -> input  : window_status = "complete", window = "12:00-12:05", sum = 7
//    <- output : emitted = {window: "12:00-12:05", sum: 7, pane: "on-time"}   BECAUSE the window end is crossed
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(1) = one read + one assign per record
//    space(extra) = O(1) integers = the single watermark register
// TRACE (one ordered log):
//    offset | record event_time | watermark
//       7   |     12:05:01      |  12:05:01
//       8   |     12:05:02      |  12:05:02
// CORRECTNESS (monotone-advance lemma): an ordered log delivers records in non-decreasing event time, so
//    watermark <- record.event_time never moves backwards — each record sets the watermark to a value >= the
//    previous one, and no record with event time earlier than the watermark can arrive from one ordered partition.
// VARIANTS (when to pick which):
//    perfect watermark   -> O(1) query, zero skew loss   (use when the source is provably ordered)  <- THIS ONE
//    heuristic watermark -> O(1) query, subtracts a skew (use when records can arrive out of order)
//    per-source + min    -> O(sources) query, one register per source (use for many partitions)
//    no watermark        -> O(1) query, no completeness signal (use when windows never need to close)
// ======================================================================
// downstream : record 12:05:01 -> watermark 12:05:01 -> window "12:00-12:05" -> emitted sum 7   BECAUSE a perfect watermark needs no skew
//    derivation : perfect = 1 - 0 = 1 skew-free source   BECAUSE one ordered log has zero out-of-orderness`
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
// DEF: skew — the pipeline's bound on out-of-orderness = 120 s
// DEF: watermark — max_seen_event_time - skew = "12:06:30"
// DEF: max_seen — the largest event_time observed so far = "12:07:00"
// STATE (before):
//    watermark : "12:05:00"
// ======================================================================
// offset 0: {event_time: "12:08:30"}
// offset 1: {event_time: "12:05:10"}
// ======================================================================
// BUILD PHASE · run once at pipeline start · cost O(1)
// step 0 · initialize the generator registers -> max_seen : none -> "12:07:00", watermark : none -> "12:05:00"
//    -> input  : skew = 120 s, prior max_seen = "12:07:00"
//    <- output : max_seen = "12:07:00", watermark = "12:05:00"   BECAUSE 12:07:00 - 120 s skew = 12:05:00
// QUERY PHASE · per arriving record · cost O(1)
// step 1 · the record at offset 0 is newer -> max_seen : "12:07:00" -> "12:08:30"
//    -> input  : record.event_time = "12:08:30", max_seen = "12:07:00"
//    decode 1a · read the record's event_time at offset 0 -> candidate : none -> "12:08:30"
//    decode 1b · compare candidate against max_seen -> max_seen : "12:07:00" -> "12:08:30"
//    <- output : max_seen = "12:08:30"   BECAUSE 12:08:30 > 12:07:00
// step 2 · recompute the watermark -> watermark : "12:05:00" -> "12:06:30"
//    -> input  : max_seen = "12:08:30", skew = 120 s
//    <- output : watermark = "12:06:30"   BECAUSE 12:08:30 - 120 s skew = 12:06:30
// step 3 · a delayed record at offset 1 arrives -> status : "on-time" -> "late"
//    -> input  : record.event_time = "12:05:10", watermark = "12:06:30"
//    <- output : status = "late"   BECAUSE 12:05:10 is older than the 12:06:30 watermark
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(1) = one compare + one subtract per record
//    space(extra) = O(1) integers = the single max_seen register
// TRACE (skew = 120 s):
//    record    | max_seen  | watermark | status
//    12:08:30  | 12:08:30  | 12:06:30  | on-time
//    12:05:10  | 12:08:30  | 12:06:30  | late
// CORRECTNESS (monotone-estimate lemma): max_seen only rises, and watermark = max_seen - skew, so the watermark is
//    non-decreasing — a later record never lowers it, and any record more than 120 s behind max_seen is labeled late,
//    which is exactly the bound the skew promises to tolerate.
// VARIANTS (when to pick which):
//    global heuristic   -> O(1) query, one shared max_seen register (use for a single well-behaved source)  <- THIS ONE
//    perfect watermark  -> O(1) query, zero skew loss   (use when the source is provably ordered)
//    per-source + min   -> O(sources) query, one register per source (use when one idle source must not stall the pipeline)
//    no watermark       -> O(1) query, no completeness signal (use when latency trumps correctness)
// ======================================================================
// downstream : record 12:08:30 -> max_seen 12:08:30 -> watermark 12:06:30 -> window "12:00-12:05" closed   BECAUSE the heuristic assumes no record is more than 120 s late
//    derivation : watermark = 510 - 120 = 390 s into the hour = 12:06:30   BECAUSE 12:08:30 is 510 s and skew is 120 s`
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
// DEF: input_a — watermark from the click source = "12:06:00"
// DEF: input_b — watermark from the purchase source = "12:04:30"
// DEF: stage — the join operator that combines input_a and input_b = "join"
// DEF: watermark — the stage's completeness signal = "12:06:00"
// STATE (before):
//    watermark : "12:06:00"
// ======================================================================
// offset 0: {source: "input_a", watermark: "12:06:00"}
// offset 1: {source: "input_b", watermark: "12:04:30"}
// ======================================================================
// BUILD PHASE · run once when the stage opens · cost O(1)
// step 0 · initialize the stage watermark register -> watermark : none -> "12:06:00"
//    -> input  : first input watermark seen = "12:06:00"
//    <- output : watermark = "12:06:00"   BECAUSE before the second input arrives the stage mirrors the first input
// QUERY PHASE · per input watermark update · cost O(inputs)
// step 1 · read input_a watermark -> watermark : "12:06:00" -> "12:06:00"
//    -> input  : input_a.watermark = "12:06:00", stage watermark = "12:06:00"
//    decode 1a · fetch the watermark from input_a -> wm_a : none -> "12:06:00"
//    decode 1b · fold wm_a into the stage watermark (min) -> watermark : "12:06:00" -> "12:06:00"
//    <- output : watermark = "12:06:00"   BECAUSE it is the only input seen so far
// step 2 · read input_b watermark -> watermark : "12:06:00" -> "12:04:30"
//    -> input  : input_b.watermark = "12:04:30", stage watermark = "12:06:00"
//    decode 2a · fetch the watermark from input_b -> wm_b : none -> "12:04:30"
//    decode 2b · fold wm_b into the stage watermark (min) -> watermark : "12:06:00" -> "12:04:30"
//    <- output : watermark = "12:04:30"   BECAUSE 12:04:30 < 12:06:00
// step 3 · the stage cannot emit a join result keyed at 12:05:00 -> emit : "ready" -> "waiting"
//    -> input  : stage watermark = "12:04:30", join key = "12:05:00"
//    <- output : emit = "waiting"   BECAUSE input_b may still deliver 12:05:00 records
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(inputs) = one min over 2 input watermarks
//    space(extra) = O(1) integers = the single stage watermark register
// TRACE (two inputs):
//    input   | watermark | stage watermark
//    input_a | 12:06:00  | 12:06:00
//    input_b | 12:04:30  | 12:04:30
// CORRECTNESS (min-invariant lemma): the stage watermark is always min(input_a, input_b), so it can never exceed the
//    slower input — with input_b at 12:04:30 and input_a at 12:06:00, the stage claims 12:04:30, and any join key
//    12:05:00 stays unemitted until input_b passes it.
// VARIANTS (when to pick which):
//    naive min over inputs -> O(inputs) query, one register (use for a handful of inputs)  <- THIS ONE
//    per-source tracking    -> O(1) query per source, one register per source (use when a source can be idle)
//    idle-source timeout    -> O(inputs) query, drops a silent source (use when a source stalls forever)
// ======================================================================
// downstream : input_a "12:06:00" -> input_b "12:04:30" -> stage watermark "12:04:30" -> join "12:05:00" waits   BECAUSE completeness is bounded by the slowest input
//    derivation : stage_watermark = 390 - 120 = 270 s into the hour = 12:04:30   BECAUSE input_b lags input_a by 120 s, and completeness is bounded by the slower source`
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
      { name: 'Apache Flink', desc: 'BoundedOutOfOrdernessWatermarkGenerator subtracts an out-of-orderness bound from the max observed event time; per-partition watermarks and idle sources' },
      { name: 'Google Cloud Dataflow', desc: 'Watermarks with allowed lateness and trigger configuration' },
      { name: 'Apache Beam', desc: 'Watermark as a first-class pipeline concept' },
      { name: 'Google MillWheel', desc: 'The low watermark that pioneered event-time completeness tracking in production' }
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
// DEF: watermark — the pipeline's completeness signal = "12:06:30"
// DEF: skew — the out-of-orderness bound = 120 s
// DEF: allowed lateness — the horizon after the watermark = 60 s
// DEF: window — the fixed event-time slice = [12:00, 12:05)
// STATE (before):
//    window_state : { "12:00-12:05": 7 }
// ======================================================================
// offset 0: {event_time: "12:08:30"}
// offset 1: {event_time: "12:05:10"}
// ======================================================================
// step 1 · max_seen updates -> max_seen : "12:07:00" -> "12:08:30"
//    -> input  : record.event_time = "12:08:30", max_seen = "12:07:00"
//    <- output : max_seen = "12:08:30"   BECAUSE the record at offset 0 is newer than anything seen
// step 2 · the watermark recomputes -> watermark : "12:05:00" -> "12:06:30"
//    -> input  : max_seen = "12:08:30", skew = 120 s
//    <- output : watermark = "12:06:30"   BECAUSE 12:08:30 - 120 s skew = 12:06:30
// step 3 · the on-time trigger fires -> emitted : {} -> {window: "12:00-12:05", sum: 7}
//    -> input  : watermark = "12:06:30", window = "12:00-12:05", window_state = { "12:00-12:05": 7 }
//    <- output : emitted = {window: "12:00-12:05", sum: 7}   BECAUSE 12:06:30 > 12:05:00
// step 4 · a late record at offset 1 still updates -> window_state["12:00-12:05"] : 7 -> 8
//    -> input  : record.event_time = "12:05:10", allowed lateness = 60 s
//    <- output : window_state["12:00-12:05"] = 8   BECAUSE 12:05:10 is inside allowed lateness
// ======================================================================
// downstream : record 12:08:30 -> watermark 12:06:30 -> window "12:00-12:05" -> sum 7 -> 8   BECAUSE the straggler arrived within the 60 s lateness horizon
//    derivation : watermark = 510 - 120 = 390 s into the hour = 12:06:30   BECAUSE 12:08:30 is 510 s and skew is 120 s`
  },
  quiz: [
    { question: "What is a watermark?", options: ["A. The wall-clock time", "B. A monotonically increasing timestamp declaring event-time completeness", "C. The number of events in a window", "D. A type of window"], answer: 2, explanation: "A watermark is the pipeline's estimate of how complete the event-time axis is.", conceptRef: "1. Unbounded data has no natural done" },
    { question: "When is a perfect watermark possible?", options: ["A. When inputs are out of order", "B. When the source is provably ordered", "C. When there are many sources", "D. When there is no skew"], answer: 2, explanation: "Perfect watermarks require ordered input, such as a single log consumed in order.", conceptRef: "2. Perfect watermarks" },
    { question: "What is the canonical heuristic watermark formula?", options: ["A. watermark = wall clock + skew", "B. watermark = min event time + skew", "C. watermark = max seen event time − skew", "D. watermark = event count / skew"], answer: 3, explanation: "The heuristic subtracts a skew (out-of-orderness bound) from the max seen event time.", conceptRef: "3. Heuristic watermarks" },
    { question: "A stage's watermark with multiple inputs is the ___ of its inputs' watermarks.", options: ["A. maximum", "B. minimum", "C. sum", "D. average"], answer: 2, explanation: "Completeness is bounded by the least-complete input, so the stage watermark is the minimum.", conceptRef: "6. Watermark propagation" },
    { question: "What is the downside of an over-eager (too-fast) watermark?", options: ["A. Higher latency", "B. Delayed data is mislabeled as late", "C. Windows never close", "D. Memory exhaustion"], answer: 2, explanation: "An over-eager watermark gains latency but loses correctness by treating delayed data as late.", conceptRef: "7. Latency vs correctness" }
  ],
  seeAlso: [
    { to: 1, section: 'Event time vs processing time', depth: 'why a watermark is needed at all — the two clocks diverge, so the pipeline must state its belief about event-time completeness rather than trust the wall clock.', example: 'ch03\'s watermark 12:06:30 marks a 12:05:10 record late; ch01 explains the root cause: a click at 12:00:59 processed at 12:04:11 is late by 192 s of queueing delay.' },
    { to: 2, section: 'When — triggers and watermarks', depth: 'where the watermark sits in the four-question model — it is the mechanism behind the "when" axis, driving early/on-time/late triggers.', example: 'ch03\'s on-time trigger fires when the watermark passes 12:05:00; ch02 shows the same window emitting early (12:02), on-time (12:05), and late (12:06) panes as the watermark moves.' },
    { to: 4, section: 'Session semantics and pitfalls', depth: 'the watermark is what lets a pipeline garbage-collect window state — sessions and other windows die when the watermark passes their end plus allowed lateness.', example: 'ch03\'s allowed-lateness horizon (60 s) is the garbage collector; ch04 shows a late event at 12:20:00 reviving two already-emitted sessions and forcing a retraction because the watermark had not yet passed their end + lateness.' },
    { to: 8, section: 'Windows in SQL', depth: 'streaming SQL hides the watermark mechanics but not its semantics — the same completeness signal is what makes a TUMBLE/HOP/SESSION result emit.', example: 'ch03\'s watermark 12:06:30 closing window [12:00,12:05) is exactly what ch08\'s TUMBLE(event_time, 5 min) query waits for before emitting its COUNT row.' },
    { to: 9, section: 'Why joins are hard on streams', depth: 'a multi-input watermark propagates as the minimum of its inputs — and that single rule is what bounds a windowed join.', example: 'ch03\'s join stage takes min(12:06:00, 12:04:30) = 12:04:30 and waits; ch09 shows that same minimum gating when a click 12:03 matches an impression 12:02 but holds until both sides pass 12:05:00.' }
  ],
  sources: [
    { name: 'Slava Chernyak — "Watermarks: Time and Progress in Apache Beam and Beyond" (talk)', url: 'https://www.youtube.com/watch?v=TWxSLmkWPm4', note: 'A conference talk on how watermarks track event-time progress in Beam and beyond' },
    { name: 'Akidau et al. — "MillWheel: Fault-Tolerant Stream Processing at Internet Scale" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'Introduced the low watermark for out-of-order stream processing at Google' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'Defines watermarks as the mechanism that trades latency against correctness' },
    { name: 'Apache Flink — Generating watermarks', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/', note: 'How a production engine computes bounded-out-of-orderness and per-partition watermarks' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'Watermarks and lateness as part of the Beam model' }
  ]
});
