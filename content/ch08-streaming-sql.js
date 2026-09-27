registerChapter({
  id: 'ch08',
  num: 8,
  title: 'Streaming SQL',
  pattern: 'SQL gives stream processing a declarative face — relational operations map onto streams, windows become explicit time constructs (TUMBLE/HOP/SESSION), and a watermark tells the query engine when results are ready.',
  aka: 'SS Ch08 · Streaming SQL · Continuous Query · TUMBLE · HOP · SESSION · Time Attribute',
  part: 2,

  flow: [
    {
      section: 'SQL as a stream language',
      color: 'cyan',
      motivation: `Declarative SQL lowers the barrier to stream processing, but the relational model must be adapted to time, so this section shows how familiar SQL maps onto a stream.`,
      steps: [
        { num: 1, title: 'A query over a stream is continuous', detail: 'A streaming SQL query is a <strong>continuous query</strong> — it runs forever and emits updated results as data arrives, rather than reading a finite table once.' },
        { num: 2, title: 'Relational operations map onto streams', detail: '<strong>SELECT is a transform, WHERE is a filter, GROUP BY is a keyed aggregation</strong> — the relational algebra of batch SQL maps onto the streaming transforms of the Beam model.' },
        { num: 3, title: 'Time becomes a first-class column', detail: 'A stream table has a <strong>time attribute</strong> (event time or processing time) that windows and joins use. <strong>Batch SQL has no notion of event time; streaming SQL does.</strong>' },
        { num: 4, title: 'Append-only vs updating streams', detail: 'Some query results are <strong>append-only</strong> (each row is a new fact); others are <strong>updating</strong> (a key\'s value changes, requiring a retraction of the old row). The table\'s update mode matters for sinks.' }
      ],
      program: `// QUERY SIDE — a continuous GROUP BY updates a total as clicks arrive
// DEF: continuous query — a query that runs forever and emits updated results = "SELECT campaign, COUNT(*) FROM clicks GROUP BY campaign"
// DEF: result — the updating output table = { "C1": 3 }
// DEF: retraction — the engine signals the old row is replaced by the new row = { "C1": 3 }
// STATE (before):
//    result : { "C1": 3 }
// ======================================================================
// offset 0: {campaign: "C1", click: true}
// offset 1: {campaign: "C1", click: true}
// ======================================================================
// BUILD PHASE · run once when the continuous query starts · cost O(1)
// step 0 · initialize the result table register -> result : none -> { "C1": 3 }
//    -> input  : the updating output table = { "C1": 3 }
//    <- output : result = { "C1": 3 }   BECAUSE the query opens with the current count
// QUERY PHASE · per arriving row · cost O(1)
// step 1 · the WHERE keeps the row -> filtered : 1 -> 1 row passes
//    -> input  : row = {campaign: "C1", click: true}, predicate = campaign = "C1"
//    <- output : filtered = 1 row passes   BECAUSE the row matches the predicate
// step 2 · the GROUP BY updates the key -> result["C1"] : 3 -> 4
//    -> input  : row = {campaign: "C1"}, result = { "C1": 3 }
//    <- output : result["C1"] = 4   BECAUSE COUNT folds the new row in
// step 3 · the engine emits a retraction of the old row -> sink : { "C1": 3 } -> { "C1": 4 }
//    -> input  : result = { "C1": 4 }, old row = { "C1": 3 }, retraction = { "C1": 3 }
//    <- output : sink = { "C1": 4 }   BECAUSE the old row is removed then the new row is added
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(1) = one filter + one count update per row
//    space(extra) = O(1) = the single result cell for the key
// TRACE (one click for campaign C1):
//    phase      | result["C1"] | sink
//    WHERE pass | 3            | 3
//    GROUP BY   | 4            | 3
//    retract    | 4            | 4
// CORRECTNESS (count-invariant lemma): COUNT folds each matching row once — result goes 3 -> 4 for one click — and the
//    engine retracts (C1, 3) before adding (C1, 4), so the sink stores 4, not 3 + 4 = 7.
// VARIANTS (when to pick which):
//    updating result + retract -> O(1) query, correct for changing keys (use for GROUP BY counts)   <- THIS ONE
//    append-only result        -> O(1) query, no retraction (use when rows only add new facts)
//    materialized view         -> O(1) query, pays storage (use for fast reads)
// ======================================================================
// downstream : click -> WHERE pass -> GROUP BY 3 -> 4 -> sink stores 4   BECAUSE the retraction replaced the old value, not added to it
//    derivation : new count = 3 + 1 = 4`
    },
    {
      section: 'Windows in SQL',
      color: 'orange',
      motivation: `The key adaptation of SQL to streams is explicit windowing — batch SQL groups whole tables, while streaming SQL must say over which time slice each aggregate is computed, so this section covers the window constructs.`,
      steps: [
        { num: 1, title: 'TUMBLE — fixed windows', detail: '<strong>TUMBLE(size)</strong> is a fixed (tumbling) window: equal, non-overlapping spans. It is the SQL spelling of the fixed window from the Beam model.' },
        { num: 2, title: 'HOP — sliding windows', detail: '<strong>HOP(size, slide)</strong> is a sliding window: fixed length, advancing by slide. It is the SQL spelling of the sliding window.' },
        { num: 3, title: 'SESSION — session windows', detail: '<strong>SESSION(gap)</strong> is a session window: a burst of activity closed by a gap of inactivity. The query engine merges sessions as data arrives.' },
        { num: 4, title: 'The watermark drives emission', detail: 'A windowed aggregate emits when the <strong>watermark passes the window end</strong>. The time attribute (event time) plus the watermark is what makes SQL results correct under out-of-order data.' }
      ],
      program: `// WINDOWED SQL SIDE — the same clicks bucketed by TUMBLE vs HOP give different row counts
// DEF: TUMBLE — a 5-min fixed window over event time = [12:00, 12:05)
// DEF: HOP — a 10-min window sliding every 2 min = [12:00, 12:10)
// DEF: click — the event = { event_time: "12:04:00", campaign: "C1" }
// STATE (before):
//    tumble_rows : 0
// ======================================================================
// offset 0: {event_time: "12:04:00", campaign: "C1"}
// offset 1: {event_time: "12:04:00", campaign: "C1", shape: "same click"}
// ======================================================================
// BUILD PHASE · run once when the query starts · cost O(1)
// step 0 · initialize the per-window row counters -> tumble_rows : none -> 0, hop_rows : none -> 0
//    -> input  : window definitions = TUMBLE 5-min, HOP 10-min every 2 min
//    <- output : tumble_rows = 0, hop_rows = 0   BECAUSE no click has been assigned yet
// QUERY PHASE · per arriving click · cost O(hop windows)
// step 1 · TUMBLE assigns the click -> tumble_rows : 0 -> 1
//    -> input  : click.event_time = "12:04:00", TUMBLE span = [12:00, 12:05)
//    <- output : tumble_rows = 1   BECAUSE 12:04:00 falls only in [12:00, 12:05)
// step 2 · HOP assigns the click -> hop_rows : 0 -> 3
//    -> input  : click.event_time = "12:04:00", HOP windows = [12:00,12:10), [12:02,12:12), [12:04,12:14)
//    <- output : hop_rows = 3   BECAUSE it overlaps [12:00,12:10), [12:02,12:12), and [12:04,12:14)
// step 3 · the watermark at 12:06:30 closes the TUMBLE window -> emitted : {} -> { "[12:00,12:05)": 1 }
//    -> input  : watermark = "12:06:30", window = "[12:00,12:05)", tumble_rows = 1
//    <- output : emitted = { "[12:00,12:05)": 1 }   BECAUSE the window end is crossed
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(hop windows) = one assignment per overlapping span
//    space(extra) = O(1) integers per window = one row counter each
// TRACE (click 12:04:00):
//    window | spans                                     | rows
//    TUMBLE | [12:00, 12:05)                            | 1
//    HOP    | [12:00,12:10),[12:02,12:12),[12:04,12:14) | 3
// CORRECTNESS (assignment-invariant lemma): the click lands in every span whose range contains 12:04:00 — one TUMBLE
//    span and three HOP spans — so the TUMBLE count is 1 and the HOP count is 3 for the same underlying event, and the
//    watermark at 12:06:30 emits the TUMBLE window exactly once.
// VARIANTS (when to pick which):
//    TUMBLE  -> O(1) query, non-overlapping (use for periodic totals)   <- THIS ONE
//    HOP     -> O(windows) query, overlapping (use for moving averages)
//    SESSION -> O(1) query, data-driven span (use for bursts of activity)
// ======================================================================
// downstream : click 12:04:00 -> TUMBLE 1 row -> HOP 3 rows -> watermark emits 1   BECAUSE HOP windows overlap
//    derivation : HOP rows per event = 5 - 2 = 3   BECAUSE 5 possible 10-min windows minus the 2 that end before 12:04`
    },
    {
      section: 'Joins and time in SQL',
      color: 'green',
      motivation: `Joins are where streaming SQL gets subtle — two streams never align in time the way two batch tables do — so this section covers windowed joins and the time semantics that make them correct.`,
      steps: [
        { num: 1, title: 'Stream-stream joins need windows', detail: 'Joining two unbounded streams requires a <strong>windowed join</strong> — match rows whose time attributes are within a window of each other — otherwise the join has no boundary.' },
        { num: 2, title: 'The watermark bounds the join', detail: 'A windowed join emits when <strong>both sides\' watermarks pass the join window</strong>, so a row is not emitted until both streams are complete for that window.' },
        { num: 3, title: 'Time attributes pick event or processing time', detail: 'Queries declare whether windows use <strong>event time</strong> (correct, can be late) or <strong>processing time</strong> (simple, no late data). Event time is the right default for correctness.' },
        { num: 4, title: 'SQL hides the mechanics, not the semantics', detail: 'Streaming SQL still obeys the Beam model underneath — <strong>the watermark, triggers, and accumulation are configured by the engine</strong>, but the user still chooses the window and time attribute.' }
      ],
      program: `// JOIN SQL SIDE — a windowed join waits for both watermarks before emitting a match
// DEF: windowed join — match clicks and impressions whose event times are within 5 min = [12:00, 12:05)
// DEF: watermark — clicks = "12:06:00", impressions = "12:04:30"
// DEF: match — a (click, impression) pair in the join window = { "click 12:03", "impression 12:02" }
// STATE (before):
//    emitted_rows : 0
// ======================================================================
// offset 0: {campaign: "C1", kind: "click", event_time: "12:03:00"}
// offset 1: {campaign: "C1", kind: "impression", event_time: "12:02:00"}
// ======================================================================
// BUILD PHASE · run once when the join opens · cost O(1)
// step 0 · initialize the match register -> match : none -> {}, emitted_rows : none -> 0
//    -> input  : join window = [12:00, 12:05), clicks watermark = "12:06:00", impressions watermark = "12:04:30"
//    <- output : match = {}, emitted_rows = 0   BECAUSE no pair has matched yet
// QUERY PHASE · per arriving row · cost O(1)
// step 1 · both rows fall in the join window -> match : {} -> { "click 12:03", "impression 12:02" }
//    -> input  : click.event_time = "12:03:00", impression.event_time = "12:02:00", join window = [12:00, 12:05)
//    <- output : match = { "click 12:03", "impression 12:02" }   BECAUSE both event times are inside [12:00, 12:05)
// step 2 · the join checks completeness -> clicks_ready : false -> true, impressions_ready : false -> false
//    -> input  : clicks watermark = "12:06:00", impressions watermark = "12:04:30", window end = "12:05:00"
//    decode 2a · compare the clicks watermark against the window end -> clicks_ready : false -> true
//    decode 2b · compare the impressions watermark against the window end -> impressions_ready : false -> false
//    <- output : clicks_ready = true, impressions_ready = false   BECAUSE clicks watermark 12:06:00 passes but impressions 12:04:30 does not
// step 3 · the match waits -> emitted_rows : 0 -> 0
//    -> input  : clicks_ready = true, impressions_ready = false
//    <- output : emitted_rows = 0   BECAUSE a late impression could still arrive
// ======================================================================
// COMPLEXITY:
//    time(build)  = O(1) = one constant register write
//    time(query)  = O(1) = one watermark compare per side
//    space(extra) = O(1) = the held match register
// TRACE (click 12:03, impression 12:02, window [12:00, 12:05)):
//    side        | watermark | passes 12:05:00? | emit
//    clicks      | 12:06:00  | true             | -
//    impressions | 12:04:30  | false            | hold
//    impressions | 12:06:00  | true             | emit 1
// CORRECTNESS (completeness-invariant lemma): a match emits only when both sides' watermarks pass the join window —
//    impressions at 12:04:30 is short of 12:05:00 so the match is held, and it emits only after impressions advances
//    to 12:06:00, so a late impression cannot be missed.
// VARIANTS (when to pick which):
//    watermark-gated emit -> O(1) query, correct (use when out-of-order data matters)   <- THIS ONE
//    immediate emit       -> O(1) query, lower latency (use when late rows are impossible)
//    allowed-lateness hold-> O(1) query, tolerates stragglers (use when late rows are rare)
// ======================================================================
// downstream : click 12:03 -> impression 12:02 -> match held -> wait for both watermarks -> emit 1   BECAUSE the join is bounded by the slower stream
//    derivation : min watermark = 390 - 120 = 270 s, still short of 300 s, so the join waits for impressions to reach 12:05:00`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Stream processing is too low-level', content: '<p><strong>Why.</strong> Hand-written transforms and windows are verbose and error-prone; SQL expresses the same logic declaratively.</p><p><strong>Claim.</strong> Streaming SQL gives stream processing a declarative face that maps relational operations onto streams.</p><p><strong>Grounding.</strong> The book presents SQL as a first-class stream-processing surface.</p><p><strong>In the wild.</strong> Flink SQL, Beam SQL, and ksqlDB are production streaming-SQL engines.</p>' },
      { tag: 'solution', tagLabel: 'Query', title: '2. Continuous queries', content: '<p><strong>Why.</strong> A stream never ends, so a query over it must run forever, not once.</p><p><strong>Claim.</strong> A continuous query emits updated results as data arrives, rather than reading a finite table once.</p><p><strong>Grounding.</strong> This is what distinguishes streaming SQL from batch SQL.</p><p><strong>In the wild.</strong> A materialized view over a Kafka topic is a continuous query.</p>' },
      { tag: 'solution', tagLabel: 'Time', title: '3. Time attributes', content: '<p><strong>Why.</strong> Windows and joins need to know which time to use — when the event happened or when it was processed.</p><p><strong>Claim.</strong> A time attribute is an event-time or processing-time column that windows and joins key on.</p><p><strong>Grounding.</strong> Batch SQL has no event time; streaming SQL does.</p><p><strong>In the wild.</strong> Flink SQL\'s event-time attribute drives watermark-based windows.</p>' },
      { tag: 'solution', tagLabel: 'Window', title: '4. TUMBLE, HOP, SESSION', content: '<p><strong>Why.</strong> Aggregates over a stream need an explicit time slice, spelled out in SQL.</p><p><strong>Claim.</strong> TUMBLE is fixed, HOP is sliding, SESSION is gap-based — the three window shapes as SQL constructs.</p><p><strong>Grounding.</strong> They are the SQL spellings of the Beam window shapes.</p><p><strong>In the wild.</strong> Flink SQL and Beam SQL both support these.</p>' },
      { tag: 'solution', tagLabel: 'Mode', title: '5. Append-only vs updating results', content: '<p><strong>Why.</strong> Some results only add rows; others change existing rows, which sinks must handle differently.</p><p><strong>Claim.</strong> Append-only results add new facts; updating results replace a key\'s value and need retractions.</p><p><strong>Grounding.</strong> A COUNT GROUP BY is updating — the old count row must be retracted.</p><p><strong>In the wild.</strong> Flink SQL emits retract streams for updating queries.</p>' },
      { tag: 'solution', tagLabel: 'Join', title: '6. Windowed joins', content: '<p><strong>Why.</strong> Two unbounded streams have no natural join boundary, so time must supply one.</p><p><strong>Claim.</strong> A windowed join matches rows whose time attributes fall within a window of each other.</p><p><strong>Grounding.</strong> The window is what bounds an otherwise infinite join.</p><p><strong>In the wild.</strong> Flink SQL interval joins are the production form.</p>' },
      { tag: 'tradeoff', tagLabel: 'Watermark', title: '7. The watermark drives SQL emission', content: '<p><strong>Why.</strong> A windowed result must wait until the engine believes the window is complete.</p><p><strong>Claim.</strong> A windowed aggregate emits when the watermark passes the window end; a join emits when both sides\' watermarks pass.</p><p><strong>Grounding.</strong> SQL hides the watermark mechanics but not its semantics.</p><p><strong>In the wild.</strong> Flink SQL uses the watermark to fire windows.</p>' },
      { tag: 'tradeoff', tagLabel: 'Choice', title: '8. Event time vs processing time', content: '<p><strong>Why.</strong> The time attribute is a correctness decision, not a syntax detail.</p><p><strong>Claim.</strong> Event time is correct but can be late; processing time is simple but wrong for out-of-order data.</p><p><strong>Grounding.</strong> Event time is the right default for correctness.</p><p><strong>In the wild.</strong> Production SQL pipelines default to event time.</p>' }
    ],
    examples: [
      { name: 'Flink SQL', desc: 'TUMBLE/HOP/SESSION, event-time attributes, interval joins, and retract streams' },
      { name: 'ksqlDB', desc: 'Continuous SQL over Kafka streams and tables' },
      { name: 'Beam SQL', desc: 'Declarative queries over Beam pipelines' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A team wants analysts to write ad-click aggregations in SQL over a live stream, but the results must be correct under out-of-order events.", q: "How do you expose a streaming pipeline as SQL with correct event-time semantics?", solution: "Use a streaming SQL engine with an event-time attribute; declare TUMBLE/HOP/SESSION windows and let the watermark drive when each window's result emits.", components: ["Streaming SQL engine — Flink SQL", "Time attribute — event time", "Window — TUMBLE/HOP/SESSION", "Watermark — drives emission"],  code: "SELECT window_start, campaign, COUNT(*)\nFROM clicks\nGROUP BY TUMBLE(event_time, INTERVAL '5' MINUTE), campaign\n-- emits when the watermark passes each 5-min window end", tieback: "This is exactly the streaming-SQL window material in this chapter.", refs: ["3. Time attributes", "4. TUMBLE, HOP, SESSION", "7. The watermark drives SQL emission"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] },
    { scenario: "A SQL query joins clicks with impressions, but it emits matches before a late impression could still arrive, producing incomplete rows.", q: "How do you make a stream-stream SQL join correct under out-of-order data?", solution: "Use a windowed (interval) join and let the watermark bound it — the join emits a match only when both sides' watermarks pass the join window.", components: ["Windowed join — interval bound", "Watermark — both sides pass", "Hold — buffer until complete"],  code: "SELECT ...\nFROM clicks c JOIN impressions i\n  ON c.campaign = i.campaign\n  AND i.event_time BETWEEN c.event_time - INTERVAL '5' MINUTE\n                      AND c.event_time + INTERVAL '5' MINUTE\n-- emits when both watermarks pass the window", tieback: "This is exactly the windowed-join material in this chapter.", refs: ["6. Windowed joins", "7. The watermark drives SQL emission"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    question: 'Design a continuous SQL query that keeps a campaign click count current. Premise: the query buckets clicks into a TUMBLE window and updates the result only when the watermark closes the window, so the count stays correct as late clicks arrive.',
    pipeline: 'streams (clicks, impressions) -> SQL engine (continuous query) -> watermark + window -> updating result -> sink',
    decomposition: [
      { box: 'streams (clicks, impressions)', role: 'streams — feed the SQL engine with event-time data',
        parts: [
          'a click {campaign: "C1", event_time: "12:03:00"} arrives',
          'an impression {campaign: "C1", event_time: "12:02:00"} arrives',
          'both carry event time for the query\'s time attribute'
        ] },
      { box: 'SQL engine (continuous query)', role: 'SQL engine — runs the query forever',
        parts: [
          'the query groups by TUMBLE(event_time, 5 min) and campaign',
          'the engine folds each row into the right window',
          'updating results emit retractions for changed keys'
        ] },
      { box: 'watermark + window', role: 'watermark + window — decides when results emit',
        parts: [
          'the watermark at 12:06:30 closes the [12:00, 12:05) window',
          'a HOP window would emit the same event into multiple spans',
          'a join waits for both sides\' watermarks'
        ] },
      { box: 'sink', role: 'sink — applies the updating result',
        parts: [
          'the sink receives (C1, 3) retracted then (C1, 4) added',
          'append-only sinks are simpler but wrong for updating results',
          'an upsert sink applies retractions correctly'
        ] }
    ],
    
    program: `// SYSTEM DESIGN — a continuous SQL query updates a campaign count as the watermark closes a TUMBLE window
// DEF: continuous query — a query that runs forever = "SELECT campaign, COUNT(*) FROM clicks GROUP BY TUMBLE(event_time, 5 min), campaign"
// DEF: watermark — the completeness signal = "12:06:30"
// DEF: result — the updating output table = { "C1": 3 }
// STATE (before):
//    result_table : { "C1": 3 }
// ======================================================================
// offset 0: {campaign: "C1", event_time: "12:04:00"}
// offset 1: {campaign: "C1", event_time: "12:04:00", role: "late click"}
// ======================================================================
// step 1 · the engine folds the row -> result_table["C1"] : 3 -> 4
//    -> input  : row = {campaign: "C1", event_time: "12:04:00"}, result_table = { "C1": 3 }
//    <- output : result_table["C1"] = 4   BECAUSE COUNT adds the new row
// step 2 · the engine retracts the old row -> sink : { "C1": 3 } -> { "C1": 4 }
//    -> input  : result_table = { "C1": 4 }, old row = { "C1": 3 }, retraction = { "C1": 3 }
//    <- output : sink = { "C1": 4 }   BECAUSE the value changed
// step 3 · the watermark passes 12:05:00 -> emitted : {} -> { "[12:00,12:05)": 4 }
//    -> input  : watermark = "12:06:30", window = "[12:00,12:05)", result_table = { "C1": 4 }
//    <- output : emitted = { "[12:00,12:05)": 4 }   BECAUSE the window is complete
// ======================================================================
// downstream : click 12:04:00 -> COUNT 3 -> 4 -> retract 3 -> emit 4   BECAUSE the updating query replaced the old row
//    derivation : new count = 3 + 1 = 4`
  },
  quiz: [
    { question: "What is a continuous query?", options: ["A. A query that runs once", "B. A query that runs forever and emits updated results", "C. A batch query", "D. A query with no windows"], answer: 2, explanation: "A continuous query runs forever over the stream, emitting updated results.", conceptRef: "2. Continuous queries" },
    { question: "Which SQL window is a fixed (tumbling) window?", options: ["A. HOP", "B. SESSION", "C. TUMBLE", "D. OVER"], answer: 3, explanation: "TUMBLE is the fixed, non-overlapping window.", conceptRef: "4. TUMBLE, HOP, SESSION" },
    { question: "What does a time attribute provide?", options: ["A. A wall-clock reading", "B. An event-time or processing-time column windows and joins key on", "C. A window size", "D. A retraction"], answer: 2, explanation: "A time attribute tells windows and joins which time to use.", conceptRef: "3. Time attributes" },
    { question: "An updating query result requires ___ .", options: ["A. only append rows", "B. a retraction of the old row", "C. no sink", "D. a batch table"], answer: 2, explanation: "When a key's value changes, the old row must be retracted.", conceptRef: "5. Append-only vs updating results" },
    { question: "When does a windowed SQL join emit a match?", options: ["A. When the first row arrives", "B. When both sides' watermarks pass the join window", "C. Every second", "D. When the query starts"], answer: 2, explanation: "The join waits until both streams are complete for the window.", conceptRef: "6. Windowed joins" }
  ],
  seeAlso: [
    { to: 2, section: 'What and Where — transformations and windowing', depth: 'streaming SQL is a declarative spelling of the what/where/when/how model — SELECT/WHERE/GROUP BY (what), TUMBLE/HOP/SESSION (where), watermark + trigger (when), retraction (how).', example: 'ch08\'s GROUP BY TUMBLE is ch02\'s "what + where"; ch08\'s retraction of (C1, 3) before (C1, 4) is ch02\'s accumulating-and-retracting mode.' },
    { to: 3, section: 'Propagation and correctness', depth: 'the watermark that drives SQL emission is the same completeness signal ch03 defines — and it propagates as the minimum across a query\'s inputs.', example: 'ch08\'s TUMBLE window emits when the watermark passes 12:05:00; ch03 shows that watermark = max_seen 12:08:30 − skew 120 s = 12:06:30, or min(12:06:00, 12:04:30) = 12:04:30 for a join.' },
    { to: 4, section: 'Window shapes — fixed, sliding, session', depth: 'TUMBLE/HOP/SESSION are the SQL spellings of ch04\'s fixed/sliding/session windows, including session merging.', example: 'ch08\'s HOP(10 min, 2 min) putting one click into 3 rows is ch04\'s sliding window [12:00,12:10) + [12:02,12:12) + [12:04,12:14); ch08\'s SESSION is ch04\'s gap-based merge.' },
    { to: 6, section: 'The duality', depth: 'append-only vs updating results is the stream/table duality in SQL — an updating query emits a changelog, an append-only query emits a stream of facts.', example: 'ch08\'s "updating result retracts (C1, 3) then adds (C1, 4)" is ch06\'s changelog (old, new) pair; ch08\'s append-only mode is ch06\'s plain stream.' },
    { to: 9, section: 'Windowed and temporal joins', depth: 'SQL joins are where windowing, watermarks, and the stream/table duality meet — ch09 covers windowed (interval) and temporal joins in depth.', example: 'ch08\'s "match clicks and impressions within 5 min" is ch09\'s windowed join; ch08\'s "join emits when both watermarks pass" is ch09\'s hold-until-both-sides-pass rule.' }
  ],
  sources: [
    { name: 'Apache Flink — Table API and SQL overview', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/overview/', note: 'Continuous queries, time attributes, and window constructs in streaming SQL' },
    { name: 'ksqlDB documentation', url: 'https://docs.ksqldb.io/', note: 'A streaming SQL engine over Kafka streams and tables' },
    { name: 'Apache Beam — Beam SQL', url: 'https://beam.apache.org/documentation/dsls/sql/', note: 'Declarative SQL over Beam pipelines' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'The model that streaming SQL engines implement underneath' }
  ]
});
