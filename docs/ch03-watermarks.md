# Chapter 3: Watermarks

> A watermark is a monotonically increasing timestamp that declares how complete the event-time axis is; it is the mechanism that lets a pipeline trade latency against correctness when closing windows.

_Also known as: SS Ch03 · Watermark · Event-time Progress · Heuristic Watermark · Perfect Watermark · Skew_

## Flow

### What a watermark is

> **Why this matters:** A window cannot close until the pipeline believes no more data for that window will arrive, so watermarks exist to state that belief explicitly and let downstream stages act on it.

1. **A timestamp that moves forward** — A watermark is a **monotonically increasing** event-time value: once it advances past a point, the pipeline declares it will not see event time earlier than that point again.

2. **It is a statement about completeness** — The watermark is the pipeline's best estimate of event-time completeness. **It is not the wall clock and it is not a guarantee — it is a promise the pipeline makes so triggers can fire.**

3. **Two kinds of watermarks** — A **perfect** watermark is possible when you know inputs are in order (e.g. ingestion-time processing of a single log). A **heuristic** watermark is an estimate when inputs can be out of order (e.g. mobile devices that go offline).

4. **Watermarks drive on-time triggers** — The on-time trigger for a window fires when the watermark passes the window's end. **Everything else — early, late, allowed lateness — is defined relative to the watermark.**

```java
// STREAM SIDE — a perfect watermark advances as a single ordered log is consumed
// DEF: watermark — the pipeline's event-time completeness signal = "12:05:00"
// DEF: window — the fixed event-time slice = [12:00, 12:05)
// DEF: log — an ordered single-partition source = { offset: 7, event_time: "12:05:01" }
// STATE (before):
//    watermark : "12:05:00"
// ======================================================================
// offset 7: {event_time: "12:05:01"}
// offset 8: {event_time: "12:05:02"}
// ======================================================================
// BUILD PHASE · run once at pipeline start
// step 0 · initialize the watermark register -> watermark : none -> "12:05:00"
//    -> input  : ordered log, no record yet consumed at the shown offsets
//    <- output : watermark = "12:05:00"   BECAUSE the generator holds one monotonically increasing register
// QUERY PHASE · per ordered record
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
// TRACE (one ordered log):
//    offset | record event_time | watermark
//       7   |     12:05:01      |  12:05:01
//       8   |     12:05:02      |  12:05:02
// CORRECTNESS (monotone-advance lemma): an ordered log delivers records in non-decreasing event time, so
//    watermark <- record.event_time never moves backwards — each record sets the watermark to a value >= the
//    previous one, and no record with event time earlier than the watermark can arrive from one ordered partition.
// VARIANTS (when to pick which):
//    perfect watermark   -> one register advance per record, zero skew loss   (use when the source is provably ordered)  <- THIS ONE
//    heuristic watermark -> one compare + one subtract per record (use when records can arrive out of order)
//    per-source + min    -> one min over each source's register (use for many partitions)
//    no watermark        -> no advance, no completeness signal (use when windows never need to close)
// ======================================================================
// downstream : record 12:05:01 -> watermark 12:05:01 -> window "12:00-12:05" -> emitted sum 7   BECAUSE a perfect watermark needs no skew
//    derivation : perfect = 1 - 0 = 1 skew-free source   BECAUSE one ordered log has zero out-of-orderness
```

### Heuristic watermarks and skew

> **Why this matters:** Real sources are out of order — a phone with no network can send an hour-old event — so pipelines estimate watermarks from what they have seen, and the estimate can be wrong in both directions.

1. **Estimate from observed event time minus lag** — A common heuristic: track the **maximum event time seen so far** and subtract a fixed skew (a bound on out-of-orderness). **watermark = max_seen_event_time - skew.**

2. **Too fast = late data looks late** — If the heuristic advances faster than the true arrival pattern, events that are merely delayed get classified as late. **An over-eager watermark loses data correctness to gain latency.**

3. **Too slow = correct but high latency** — If the skew is too conservative, the watermark lags and windows stay open longer. **An over-cautious watermark keeps results correct but delays on-time output.**

4. **Per-source tracking is more accurate** — When each source has its own idleness pattern, tracking a watermark **per source and taking the minimum** is safer than one global watermark — a single idle source stops dragging the whole pipeline's watermark forward.

```java
// AGGREGATOR SIDE — a heuristic watermark from the max seen event time minus a skew
// GOAL (what this is FOR): answer "how complete is event time, given that records can arrive out of order?" without waiting forever.
//    THE NAIVE WAY (why we build a watermark at all): wait for the source to go quiet before closing a window — but an unbounded stream
//    never goes quiet, so the window never closes. We replace "wait for quiet" with a register max_seen that tracks the newest event
//    time seen and a watermark = max_seen - skew that advances on its own as new records arrive.
// DEF: skew — the pipeline's bound on out-of-orderness = 120 s
//    WHO chose the 120 s skew: the pipeline builder, not the data. 120 s here only so a record as much as 2 minutes behind the newest
//    seen event is still treated on-time; production heuristic skews are typically 30 s to 5 min, tuned to the source's out-of-orderness.
// DEF: watermark — max_seen_event_time - skew = "12:06:30"
// DEF: max_seen — the largest event_time observed so far = "12:07:00"
//    WHY max_seen exists: without it, "is this record late?" has no reference point — there is no newest-seen time to subtract the skew
//    from. With it, the watermark = max_seen - skew recomputes in one compare + one subtract per record.
// STATE (before):
//    watermark : "12:05:00"
// ======================================================================
// offset 0: {event_time: "12:08:30"}
// offset 1: {event_time: "12:05:10"}
// ======================================================================
// BUILD PHASE · run once at pipeline start
// step 0 · initialize the generator registers -> max_seen : none -> "12:07:00", watermark : none -> "12:05:00"
//    -> input  : skew = 120 s, prior max_seen = "12:07:00"
//    <- output : max_seen = "12:07:00", watermark = "12:05:00"   BECAUSE 12:07:00 - 120 s skew = 12:05:00
// QUERY PHASE · per arriving record
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
// TRACE (skew = 120 s):
//    record    | max_seen  | watermark | status
//    12:08:30  | 12:08:30  | 12:06:30  | on-time
//    12:05:10  | 12:08:30  | 12:06:30  | late
// CORRECTNESS (monotone-estimate lemma): max_seen only rises, and watermark = max_seen - skew, so the watermark is
//    non-decreasing — a later record never lowers it, and any record more than 120 s behind max_seen is labeled late,
//    which is exactly the bound the skew promises to tolerate.
// VARIANTS (when to pick which):
//    global heuristic   -> one compare + one subtract per record, one shared max_seen register (use for a single well-behaved source)  <- THIS ONE
//    perfect watermark  -> one register advance per record, zero skew loss   (use when the source is provably ordered)
//    per-source + min   -> one min over each source's register (use when one idle source must not stall the pipeline)
//    no watermark       -> no advance, no completeness signal (use when latency trumps correctness)
// ======================================================================
// downstream : record 12:08:30 -> max_seen 12:08:30 -> watermark 12:06:30 -> window "12:00-12:05" closed   BECAUSE the heuristic assumes no record is more than 120 s late
//    derivation : watermark = 510 - 120 = 390 s into the hour = 12:06:30   BECAUSE 12:08:30 is 510 s and skew is 120 s
```

### Propagation and correctness

> **Why this matters:** A watermark only matters if every downstream stage sees a coherent value, and a coherent value only helps if the pipeline knows what to do when the estimate is wrong, so this section covers propagation and the failure mode.

1. **The watermark is the minimum across inputs** — When a stage has multiple upstream sources, **its watermark is the minimum of its inputs' watermarks** — a stage cannot claim more completeness than its least-complete input.

2. **A watermark is an estimate, not a guarantee** — Because heuristics can be wrong, **a watermark that passed does not mean late data will never arrive** — it means the pipeline has chosen to treat the window as closed.

3. **Allowed lateness is the safety net** — When the heuristic is wrong and data arrives after the watermark, **allowed lateness lets the window still accept it** for a bounded horizon, then discard it.

4. **Watermarks are what make event-time pipelines tractable** — Without watermarks, a pipeline can never emit a result that a user can trust as "done for now". **Watermarks convert an unbounded stream into a stream with a notion of progress.**

```java
// JOIN STAGE — two inputs, the stage watermark is the minimum of the two
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
// BUILD PHASE · run once when the stage opens
// step 0 · initialize the stage watermark register -> watermark : none -> "12:06:00"
//    -> input  : first input watermark seen = "12:06:00"
//    <- output : watermark = "12:06:00"   BECAUSE before the second input arrives the stage mirrors the first input
// QUERY PHASE · per input watermark update
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
// TRACE (two inputs):
//    input   | watermark | stage watermark
//    input_a | 12:06:00  | 12:06:00
//    input_b | 12:04:30  | 12:04:30
// CORRECTNESS (min-invariant lemma): the stage watermark is always min(input_a, input_b), so it can never exceed the
//    slower input — with input_b at 12:04:30 and input_a at 12:06:00, the stage claims 12:04:30, and any join key
//    12:05:00 stays unemitted until input_b passes it.
// VARIANTS (when to pick which):
//    naive min over inputs -> one min over the 2 input watermarks, one register (use for a handful of inputs)  <- THIS ONE
//    per-source tracking    -> one advance per source record, one register per source (use when a source can be idle)
//    idle-source timeout    -> one min over the live inputs, drops a silent source (use when a source stalls forever)
// ======================================================================
// downstream : input_a "12:06:00" -> input_b "12:04:30" -> stage watermark "12:04:30" -> join "12:05:00" waits   BECAUSE completeness is bounded by the slowest input
//    derivation : stage_watermark = 360 - 90 = 270 s into the hour = 12:04:30   BECAUSE input_b 12:04:30 lags input_a 12:06:00 by 90 s, and completeness is bounded by the slower source
```


## Links & The Bigger Picture

Concepts this chapter mentions but does not fully unpack are linked below — each pointer names the chapter where the concept is covered in depth and gives a concrete example that ties the two chapters together.

- **[Chapter 1: Streaming 101 → Event time vs processing time](ch01-streaming-101.md#event-time-vs-processing-time)** — why a watermark is needed at all — the two clocks diverge, so the pipeline must state its belief about event-time completeness rather than trust the wall clock.
  - _Example:_ ch03's watermark 12:06:30 marks a 12:05:10 record late; ch01 explains the root cause: a click at 12:00:59 processed at 12:04:11 is late by 192 s of queueing delay.
- **[Chapter 2: The What, Where, When, and How of Data Processing → When — triggers and watermarks](ch02-the-what-where-when-and-how-of-data-processing.md#when--triggers-and-watermarks)** — where the watermark sits in the four-question model — it is the mechanism behind the "when" axis, driving early/on-time/late triggers.
  - _Example:_ ch03's on-time trigger fires when the watermark passes 12:05:00; ch02 shows the same window emitting early (12:02), on-time (12:05), and late (12:06) panes as the watermark moves.
- **[Chapter 4: Advanced Windowing → Session semantics and pitfalls](ch04-advanced-windowing.md#session-semantics-and-pitfalls)** — the watermark is what lets a pipeline garbage-collect window state — sessions and other windows die when the watermark passes their end plus allowed lateness.
  - _Example:_ ch03's allowed-lateness horizon (60 s) is the garbage collector; ch04 shows a late event at 12:20:00 reviving two already-emitted sessions and forcing a retraction because the watermark had not yet passed their end + lateness.
- **[Chapter 8: Streaming SQL → Windows in SQL](ch08-streaming-sql.md#windows-in-sql)** — streaming SQL hides the watermark mechanics but not its semantics — the same completeness signal is what makes a TUMBLE/HOP/SESSION result emit.
  - _Example:_ ch03's watermark 12:06:30 closing window [12:00,12:05) is exactly what ch08's TUMBLE(event_time, 5 min) query waits for before emitting its COUNT row.
- **[Chapter 9: Streaming Joins → Why joins are hard on streams](ch09-streaming-joins.md#why-joins-are-hard-on-streams)** — a multi-input watermark propagates as the minimum of its inputs — and that single rule is what bounds a windowed join.
  - _Example:_ ch03's join stage takes min(12:06:00, 12:04:30) = 12:04:30 and waits; ch09 shows that same minimum gating when a click 12:03 matches an impression 12:02 but holds until both sides pass 12:05:00.

## System Design Interview

> **The question:** Design the watermark generator for an event-time pipeline. Premise: the watermark advances as max_seen event time minus a skew bound, so windows close on time and a straggler after the watermark is flagged late.

**The pipeline:** sources (events with event time) -> watermark generator (max_seen − skew) -> window assigner -> per-window state -> trigger/emitter -> dashboard

<a href="../diagrams/d2/decomp/ch03-0.png"><img src="../diagrams/d2/decomp/ch03-0.png" alt="system design pipeline" width="249"></a>

### sources (events with event time)

_Role: sources — emit events that may be out of order_

- a phone emits {event_time: "12:08:30"} after a network delay
- event time is stamped at the source, not at ingestion
- a straggler {event_time: "12:05:10"} may arrive after newer events

### watermark generator (max_seen − skew)

_Role: watermark generator — estimates event-time completeness_

- max_seen : 12:07:00 -> 12:08:30 as the newest event arrives
- watermark = max_seen - skew = 12:08:30 - 2:00 = 12:06:30
- per-source watermarks are min-ed together at the stage

### window assigner

_Role: window assigner — assigns events to event-time windows_

- event {event_time: "12:08:30"} lands in window [12:05, 12:10)
- the watermark at 12:06:30 means windows up to 12:06:30 are complete
- window [12:00, 12:05) is closed because 12:06:30 > 12:05:00

### trigger/emitter

_Role: trigger/emitter — fires on the watermark and handles late data_

- the on-time trigger fires when the watermark passes the window end
- a late event {event_time: "12:05:10"} is accepted if inside allowed lateness
- a late pane re-emits the updated window result to the dashboard

```java
// SYSTEM DESIGN — a watermark closes a window on time and allowed lateness catches one straggler
// GOAL (what this is FOR): answer "when does window [12:00, 12:05) close, and what still updates it after the watermark says it is done?"
//    THE NAIVE WAY (why we pair skew with lateness): close the window at a watermark computed from max_seen with no skew — then a record
//    that is only 80 s behind the newest seen event is dropped as late even though it is ordinary. We replace "no skew" with
//    watermark = max_seen - skew, and add an allowed-lateness horizon so a straggler after the watermark still updates the result.
// DEF: watermark — the pipeline's completeness signal = "12:06:30"
// DEF: skew — the out-of-orderness bound = 120 s
//    WHO chose the 120 s skew: the pipeline builder, not the data. 120 s here only so max_seen 12:08:30 minus 120 s gives watermark
//    12:06:30, which closes [12:00, 12:05) on time; production skews are typically 30 s to 5 min.
// DEF: allowed lateness — the horizon after the watermark = 60 s
//    WHO chose the 60 s lateness: the pipeline builder, not the data. 60 s here only so the 12:05:10 straggler arriving just after the
//    12:06:30 watermark is still inside the horizon; production uses 60 s or 5 min.
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
//    derivation : watermark = 510 - 120 = 390 s into the hour = 12:06:30   BECAUSE 12:08:30 is 510 s and skew is 120 s
```


## Interview Questions

### Q1

A mobile analytics pipeline groups events by event time, but phones that go offline send events up to an hour late — so some 12:04 events arrive after the 12:05 window has already been reported.

**Interviewer's question:** How do you compute event-time completeness when inputs are out of order, and what do you do about data that arrives after you declared the window complete?

**Solution:** Use a heuristic watermark — max seen event time minus a skew (out-of-orderness bound) — and keep windows alive for an allowed-lateness horizon after the watermark so late events can still update the result.

**System-design components:**
- Heuristic watermark — max_seen − skew
- Skew — bound on out-of-orderness
- Allowed lateness — accepts late data for a bounded horizon
- On-time trigger — fires at the watermark

```java
// max_seen = 12:08:30, skew = 2 min
//   watermark = 12:08:30 - 2:00 = 12:06:30
//   window [12:00,12:05) -> closed (12:06:30 > 12:05:00)
//   event @ 12:05:10 arrives -> 80 s older than watermark -> late
//   allowed lateness 1 min -> still accepted -> re-emit
```

_This is exactly the heuristic watermark and skew material in this chapter._

_Covers:_ 3. Heuristic watermarks · 4. Skew (out-of-orderness bound) · 8. Watermarks + allowed lateness

_From the 28 problems:_ 21-ad-click-aggregation · 20-metrics-monitoring

### Q2

A streaming join reads two sources, one fast and one slow; results for 12:05 keep getting emitted with missing data from the slow source.

**Interviewer's question:** Why does the join emit incomplete results, and how do you fix it?

**Solution:** The join stage's watermark is the minimum of its inputs' watermarks, so the slow input stalls completeness; fix it with per-source watermarks and/or buffer the fast side until the slow side's watermark catches up.

**System-design components:**
- Watermark propagation — min across inputs
- Per-source watermarks
- Join buffer — holds the fast side

```java
// stage_watermark = min(12:06:00, 12:04:30) = 12:04:30
//   join keyed at 12:05:00 -> cannot emit -> waits on slow source
//   per-source watermarks let the fast side advance independently
```

_This is exactly the watermark-propagation material in this chapter._

_Covers:_ 5. Per-source watermarks · 6. Watermark propagation

_From the 28 problems:_ 21-ad-click-aggregation

## Key Concepts

### The Problem

**1. Unbounded data has no natural "done".** A watermark is that signal — a monotonically increasing event-time timestamp declaring completeness.


### The Solution

A perfect watermark is possible for ordered inputs — a single log consumed in order, or ingestion-time processing.

```java
// max_seen = 12:08:30, skew = 2 min
//   watermark = 12:08:30 - 2:00 = 12:06:30
//   window [12:00,12:05) -> closed (12:06:30 > 12:05:00)
//   event @ 12:05:10 arrives -> 80 s older than watermark -> late
//   allowed lateness 1 min -> still accepted -> re-emit
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| 2. Perfect watermarks | A perfect watermark is possible for ordered inputs — a single log consumed in order, or ingestion-time processing. | Ingestion-time pipelines over a single Kafka partition are the classic perfect-watermark case. |
| 3. Heuristic watermarks | A heuristic watermark estimates completeness from observed data — typically max seen event time minus a skew. | Flink's BoundedOutOfOrdernessWatermarkGenerator implements exactly this. |
| 4. Skew (out-of-orderness bound) | Skew is the assumed bound on out-of-orderness subtracted from the max seen event time. | The skew parameter in a Dataflow pipeline is the production form. |
| 5. Per-source watermarks | Track a watermark per source and take the minimum; this lets fast sources advance without being blocked by slow ones. | Per-partition watermarks in Flink are the production form. |
| 6. Watermark propagation | A stage's watermark is the minimum of its inputs' watermarks. | Flink's watermark alignment (min across inputs) is the production form. |
| 7. Latency vs correctness | An eager watermark emits early and risks late data; a cautious watermark waits and delays output. | Tuning the out-of-orderness bound is a routine production decision. |
| 8. Watermarks + allowed lateness | Allowed lateness keeps the window alive for a bounded horizon after the watermark, then drops stragglers. | Dataflow's allowed-lateness setting is the production form. |


### Tradeoffs & When

- An eager watermark emits early and risks late data; a cautious watermark waits and delays output.
- Allowed lateness keeps the window alive for a bounded horizon after the watermark, then drops stragglers.


### Real-World Examples

- **Apache Flink** — BoundedOutOfOrdernessWatermarkGenerator subtracts an out-of-orderness bound from the max observed event time; per-partition watermarks and idle sources
- **Google Cloud Dataflow** — Watermarks with allowed lateness and trigger configuration
- **Apache Beam** — Watermark as a first-class pipeline concept
- **Google MillWheel** — The low watermark that pioneered event-time completeness tracking in production


<details><summary>All concepts (index)</summary>

### Why: 1. Unbounded data has no natural "done"

**Why.** A stream never ends, so a pipeline cannot know when a window has seen all its data without a signal of progress.

**Claim.** A watermark is that signal — a monotonically increasing event-time timestamp declaring completeness.

**Grounding.** The watermark is the book's central mechanism for event-time progress.

**In the wild.** Dataflow, Flink, and Beam all expose watermarks as first-class concepts.

<a href="../diagrams/d2/card/ch03-0.png"><img src="../diagrams/d2/card/ch03-0.png" alt="1. Unbounded data has no natural done" width="384"></a>
### Perfect: 2. Perfect watermarks

**Why.** If a source is provably ordered, the pipeline can know completeness exactly rather than estimating it.

**Claim.** A perfect watermark is possible for ordered inputs — a single log consumed in order, or ingestion-time processing.

**Grounding.** For an ordered log, every record is at or ahead of the watermark, so the watermark can advance to each record's timestamp.

**In the wild.** Ingestion-time pipelines over a single Kafka partition are the classic perfect-watermark case.

<a href="../diagrams/d2/card/ch03-1.png"><img src="../diagrams/d2/card/ch03-1.png" alt="2. Perfect watermarks" width="423"></a>
### Heuristic: 3. Heuristic watermarks

**Why.** Out-of-order sources (mobile devices, retries, multi-region collectors) make a perfect watermark impossible.

**Claim.** A heuristic watermark estimates completeness from observed data — typically max seen event time minus a skew.

**Grounding.** watermark = max_seen_event_time − skew is the book's canonical heuristic.

**In the wild.** Flink's BoundedOutOfOrdernessWatermarkGenerator implements exactly this.

<a href="../diagrams/d2/card/ch03-2.png"><img src="../diagrams/d2/card/ch03-2.png" alt="3. Heuristic watermarks" width="387"></a>
### Parameter: 4. Skew (out-of-orderness bound)

**Why.** A heuristic needs a knob that says how out-of-order the source can be, to trade latency against correctness.

**Claim.** Skew is the assumed bound on out-of-orderness subtracted from the max seen event time.

**Grounding.** Too small a skew mislabels delayed data as late; too large a skew delays on-time output.

**In the wild.** The skew parameter in a Dataflow pipeline is the production form.

<a href="../diagrams/d2/card/ch03-3.png"><img src="../diagrams/d2/card/ch03-3.png" alt="4. Skew (out-of-orderness bound)" width="492"></a>
### Bound: 5. Per-source watermarks

**Why.** One global watermark is dragged down by the slowest source — a single idle device stalls completeness for everything.

**Claim.** Track a watermark per source and take the minimum; this lets fast sources advance without being blocked by slow ones.

**Grounding.** The minimum across per-source watermarks is the stage's watermark.

**In the wild.** Per-partition watermarks in Flink are the production form.

<a href="../diagrams/d2/card/ch03-4.png"><img src="../diagrams/d2/card/ch03-4.png" alt="5. Per-source watermarks" width="413"></a>
### Propagation: 6. Watermark propagation

**Why.** A stage with multiple inputs cannot claim more completeness than its least-complete input.

**Claim.** A stage's watermark is the minimum of its inputs' watermarks.

**Grounding.** The join stage in the book waits on the slower input before emitting a keyed result.

**In the wild.** Flink's watermark alignment (min across inputs) is the production form.

<a href="../diagrams/d2/card/ch03-5.png"><img src="../diagrams/d2/card/ch03-5.png" alt="6. Watermark propagation" width="567"></a>
### Tradeoff: 7. Latency vs correctness

**Why.** The watermark's aggressiveness is the single knob that trades result latency against late-data correctness.

**Claim.** An eager watermark emits early and risks late data; a cautious watermark waits and delays output.

**Grounding.** Skew is the parameter that moves the pipeline along this tradeoff.

**In the wild.** Tuning the out-of-orderness bound is a routine production decision.

<a href="../diagrams/d2/card/ch03-6.png"><img src="../diagrams/d2/card/ch03-6.png" alt="7. Latency vs correctness" width="661"></a>
### Safety net: 8. Watermarks + allowed lateness

**Why.** A heuristic watermark can be wrong, so a pipeline needs a bounded way to accept data that arrives after the watermark.

**Claim.** Allowed lateness keeps the window alive for a bounded horizon after the watermark, then drops stragglers.

**Grounding.** It is the garbage collector for window state that outlives the watermark.

**In the wild.** Dataflow's allowed-lateness setting is the production form.

<a href="../diagrams/d2/card/ch03-7.png"><img src="../diagrams/d2/card/ch03-7.png" alt="8. Watermarks + allowed lateness" width="537"></a>

</details>


## Quiz

1. What is a watermark?

   - A. The wall-clock time
   - B. A monotonically increasing timestamp declaring event-time completeness
   - C. The number of events in a window
   - D. A type of window

<details><summary>Reveal answer</summary>

**B.** A watermark is the pipeline's estimate of how complete the event-time axis is.

</details>

2. When is a perfect watermark possible?

   - A. When inputs are out of order
   - B. When the source is provably ordered
   - C. When there are many sources
   - D. When there is no skew

<details><summary>Reveal answer</summary>

**B.** Perfect watermarks require ordered input, such as a single log consumed in order.

</details>

3. What is the canonical heuristic watermark formula?

   - A. watermark = wall clock + skew
   - B. watermark = min event time + skew
   - C. watermark = max seen event time − skew
   - D. watermark = event count / skew

<details><summary>Reveal answer</summary>

**C.** The heuristic subtracts a skew (out-of-orderness bound) from the max seen event time.

</details>

4. A stage's watermark with multiple inputs is the ___ of its inputs' watermarks.

   - A. maximum
   - B. minimum
   - C. sum
   - D. average

<details><summary>Reveal answer</summary>

**B.** Completeness is bounded by the least-complete input, so the stage watermark is the minimum.

</details>

5. What is the downside of an over-eager (too-fast) watermark?

   - A. Higher latency
   - B. Delayed data is mislabeled as late
   - C. Windows never close
   - D. Memory exhaustion

<details><summary>Reveal answer</summary>

**B.** An over-eager watermark gains latency but loses correctness by treating delayed data as late.

</details>

## Sources

- [Slava Chernyak — "Watermarks: Time and Progress in Apache Beam and Beyond" (talk)](https://www.youtube.com/watch?v=TWxSLmkWPm4) — A conference talk on how watermarks track event-time progress in Beam and beyond
- [Akidau et al. — "MillWheel: Fault-Tolerant Stream Processing at Internet Scale" (VLDB 2013)](https://research.google/pubs/pub41378/) — Introduced the low watermark for out-of-order stream processing at Google
- [Akidau et al. — "The Dataflow Model" (VLDB 2015)](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf) — Defines watermarks as the mechanism that trades latency against correctness
- [Apache Flink — Generating watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/) — How a production engine computes bounded-out-of-orderness and per-partition watermarks
- [Apache Beam programming guide](https://beam.apache.org/documentation/programming-guide/) — Watermarks and lateness as part of the Beam model

