#!/usr/bin/env node
// Author the per-section and per-concept-card mermaid diagrams, keyed off the
// exact section/card titles in content/ so keys can never drift.
// Usage (from repo root):  node tools/build_diagrams.js
const fs = require('fs');

function ent(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&hellip;/g, '…');
}

const CDEFS = `  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6`;

// section diagram: classDefs at top; card diagram: classDefs at bottom.
const sec = (body) => `flowchart TD\n${CDEFS}\n${body}`;
const card = (body) => `flowchart TD\n${body}\n${CDEFS}`;

// ---------------------------------------------------------------- ch01
const SEC = {
1: [
sec(`  n0["<b>1. The term is overloaded</b><br/>real-time, low latency, continuous, event-driven, merely not-batch"]:::start
  n1["<b>2. The book's precise meaning</b><br/>a data-processing engine designed for infinite datasets"]:::step
  n2["<b>3. Unbounded data</b><br/>a dataset that arrives gradually and never completes"]:::core
  n3["<b>4. Two clocks per event</b><br/>event time vs processing time - they disagree"]:::warn
  n4["<b>5. Four questions</b><br/>what, where, when, how - the rest of the book"]:::step
  n5["<b>6. Recap</b><br/>streaming = designed for unbounded data, not merely fast"]:::stop
  n0 -->|"1. narrowed to"| n1
  n1 -->|"2. built around"| n2
  n2 -->|"3. every event carries"| n3
  n3 -->|"4. answered by"| n4
  n4 -->|"5. the one-sentence summary"| n5`),
sec(`  n0["<b>1. Event time</b><br/>when the event actually happened, stamped by the producer"]:::start
  n1["<b>2. Processing time</b><br/>when the pipeline observed the event"]:::step
  n2["<b>3. They diverge</b><br/>network delay, queueing, backpressure, replay"]:::warn
  n3["<b>4. Correct answers need event time</b><br/>processing-time buckets silently shift under load"]:::core
  n4["<b>5. The lag is the cost</b><br/>waiting for stragglers buys correctness"]:::stop
  n0 -->|"1. contrasted with"| n1
  n1 -->|"2. the gap is"| n2
  n2 -->|"3. so bucket by"| n3
  n3 -->|"4. measured as"| n4`),
sec(`  n0["<b>1. Bounded</b><br/>a finite dataset - the batch world"]:::start
  n1["<b>2. Unbounded as batch</b><br/>infinite data chopped into finite windows, each run as a batch"]:::step
  n2["<b>3. Unbounded as streaming</b><br/>infinite data processed continuously as it arrives"]:::core
  n3["<b>4. The bridge</b><br/>batch is a special case of streaming - a bounded stream"]:::warn
  n0 -->|"1. grows into"| n1
  n1 -->|"2. re-framed as"| n2
  n2 -->|"3. subsumes"| n3
  n3 -->|"4. loops back to"| n0`),
],
2: [
sec(`  n0["<b>1. A pipeline is underspecified</b><br/>names alone - sum, join, filter - leave four questions open"]:::start
  n1["<b>2. What - transformations</b><br/>the functions applied to each element"]:::step
  n2["<b>3. Where - windowing</b><br/>the event-time slice a transformation runs over"]:::core
  n3["<b>4. When - triggers</b><br/>when results materialize in processing time"]:::step
  n4["<b>5. How - accumulation</b><br/>how later results relate to earlier ones"]:::step
  n5["<b>6. Recap</b><br/>all four together fully specify the pipeline"]:::stop
  n0 -->|"1. first question"| n1
  n1 -->|"2. second question"| n2
  n2 -->|"3. third question"| n3
  n3 -->|"4. fourth question"| n4
  n4 -->|"5. together"| n5`),
sec(`  n0["<b>1. When = materialization</b><br/>the moment results become visible downstream"]:::start
  n1["<b>2. Triggers</b><br/>repeated signals - processing time, count, or data driven"]:::step
  n2["<b>3. Watermarks</b><br/>a monotonic estimate of event-time completeness"]:::core
  n3["<b>4. Allowed lateness</b><br/>a data-driven trigger for stragglers after the watermark"]:::warn
  n4["<b>5. Recap</b><br/>triggers decide when; watermarks decide what is late"]:::stop
  n0 -->|"1. fired by"| n1
  n1 -->|"2. often gated on"| n2
  n2 -->|"3. late data handled by"| n3
  n3 -->|"4. both shape"| n4`),
sec(`  n0["<b>1. How = refinement</b><br/>the relationship between a new result and the previous one"]:::start
  n1["<b>2. Discarding</b><br/>each pane is independent - downstream gets disjoint results"]:::step
  n2["<b>3. Accumulating</b><br/>each pane folds into a running total - a growing result"]:::core
  n3["<b>4. Accumulating and retracting</b><br/>the running total plus a retraction of the prior value"]:::warn
  n4["<b>5. Recap</b><br/>retractions keep a downstream accumulator exact"]:::stop
  n0 -->|"1. simplest"| n1
  n0 -->|"2. moving sum"| n2
  n2 -->|"3. exact version of"| n3
  n3 -->|"4. the point of"| n4`),
],
3: [
sec(`  n0["<b>1. Unbounded data has no end</b><br/>so a window can never know it is complete"]:::start
  n1["<b>2. Watermark = completeness estimate</b><br/>a statement of how complete event time is right now"]:::core
  n2["<b>3. Monotonic</b><br/>the estimate only moves forward, never backward"]:::step
  n3["<b>4. Perfect vs heuristic</b><br/>exact lag is unknowable in practice - heuristics approximate it"]:::warn
  n4["<b>5. After the watermark</b><br/>events with older event times are late"]:::stop
  n0 -->|"1. answered by"| n1
  n1 -->|"2. it is"| n2
  n2 -->|"3. two kinds"| n3
  n3 -->|"4. anything older is"| n4`),
sec(`  n0["<b>1. Perfect watermarks are impossible</b><br/>you cannot know the true lag of every event"]:::start
  n1["<b>2. Heuristic watermark</b><br/>estimate lag from what is observed - arrival minus event time"]:::core
  n2["<b>3. Skew</b><br/>the out-of-orderness bound, often a percentile of observed lag"]:::step
  n3["<b>4. Too short vs too long</b><br/>too short - more late data; too long - higher latency"]:::warn
  n4["<b>5. Recap</b><br/>the skew parameter trades correctness against latency"]:::stop
  n0 -->|"1. so use a"| n1
  n1 -->|"2. parameterized by"| n2
  n2 -->|"3. the tuning tension"| n3
  n3 -->|"4. summarized as"| n4`),
sec(`  n0["<b>1. One watermark per source</b><br/>each input has its own estimate of completeness"]:::start
  n1["<b>2. Propagated through stages</b><br/>a stage's output watermark is the min of its inputs"]:::core
  n2["<b>3. Upstream changes flow down</b><br/>a source updating its watermark advances downstream estimates"]:::step
  n3["<b>4. Correctness depends on it</b><br/>a wrong watermark emits results too early or too late"]:::warn
  n0 -->|"1. combined by"| n1
  n1 -->|"2. as"| n2
  n2 -->|"3. because"| n3`),
],
4: [
sec(`  n0["<b>1. Fixed windows</b><br/>equal, non-overlapping event-time slices"]:::start
  n1["<b>2. Sliding windows</b><br/>fixed length with a period - overlapping or with gaps"]:::step
  n2["<b>3. Session windows</b><br/>activity-bounded - a gap of inactivity closes the window"]:::core
  n3["<b>4. Which when</b><br/>fixed for uniform accounting, sliding for moving views, session for bursts"]:::warn
  n0 -->|"1. vs"| n1
  n1 -->|"2. vs"| n2
  n2 -->|"3. choose by"| n3`),
sec(`  n0["<b>1. Assign</b><br/>each event is placed into one or more windows"]:::start
  n1["<b>2. Merge</b><br/>session windows merge when an event bridges a gap"]:::step
  n2["<b>3. Group and trigger</b><br/>events grouped by key; triggers decide when to emit"]:::core
  n3["<b>4. Accumulate</b><br/>pane results fold together per the accumulation mode"]:::step
  n4["<b>5. Garbage collect</b><br/>state for a closed window is dropped once it can never change"]:::stop
  n0 -->|"1. then"| n1
  n1 -->|"2. then"| n2
  n2 -->|"3. then"| n3
  n3 -->|"4. finally"| n4`),
sec(`  n0["<b>1. Sessions are keyed</b><br/>a session is per user or per key, never global"]:::start
  n1["<b>2. Merging after emission</b><br/>a late event can bridge two already-emitted sessions"]:::warn
  n2["<b>3. Retractions</b><br/>the pipeline must cancel the earlier panes and emit the merged one"]:::core
  n3["<b>4. Gap threshold tuning</b><br/>too small - one session splits; too large - distinct sessions merge"]:::step
  n0 -->|"1. the trap is"| n1
  n1 -->|"2. handled by"| n2
  n2 -->|"3. the knob is"| n3`),
],
5: [
sec(`  n0["<b>1. Retries are unavoidable</b><br/>crashes and timeouts force re-processing"]:::start
  n1["<b>2. At-least-once + dedup</b><br/>re-process freely, then drop duplicates"]:::core
  n2["<b>3. Exactly-once ≠ one-time</b><br/>a step may run many times; results appear once"]:::warn
  n3["<b>4. End-to-end</b><br/>the guarantee must span the whole pipeline, not one operator"]:::step
  n4["<b>5. Replayable sources</b><br/>inputs must be re-readable for recovery"]:::stop
  n0 -->|"1. made safe by"| n1
  n1 -->|"2. the key distinction"| n2
  n2 -->|"3. scoped as"| n3
  n3 -->|"4. requiring"| n4`),
sec(`  n0["<b>1. Idempotency</b><br/>the same operation yields the same result however often run"]:::start
  n1["<b>2. Deduplication</b><br/>recognize a repeated input and skip it"]:::core
  n2["<b>3. Shuffle dedup</b><br/>a repeated delivery across a shuffle must not double-count"]:::step
  n3["<b>4. The guard</b><br/>a seen-set or stable key turns a replay into a no-op"]:::warn
  n0 -->|"1. complementary to"| n1
  n1 -->|"2. the distributed case"| n2
  n2 -->|"3. implemented with"| n3`),
sec(`  n0["<b>1. Pure transforms are easy</b><br/>recompute and the same output follows"]:::start
  n1["<b>2. Side effects are not idempotent</b><br/>a credit, an email, an external write does not undo itself"]:::warn
  n2["<b>3. Isolate side effects</b><br/>keep the heavy compute pure; concentrate effects at the edge"]:::core
  n3["<b>4. The two tools</b><br/>an idempotency key, or a two-phase commit with the sink"]:::step
  n0 -->|"1. the hard part is"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. made safe by"| n3`),
],
6: [
sec(`  n0["<b>1. A stream</b><br/>motion - events over time, the change log"]:::start
  n1["<b>2. A table</b><br/>state - the current value per key"]:::step
  n2["<b>3. Same data, two views</b><br/>a table is a stream's materialized view; a stream is a table's log"]:::core
  n3["<b>4. Databases vs logs</b><br/>a database is a table; its replication stream is the log"]:::warn
  n0 -->|"1. dual of"| n1
  n1 -->|"2. the insight"| n2
  n2 -->|"3. in practice"| n3`),
sec(`  n0["<b>1. Stream to table</b><br/>aggregate the events into current state"]:::start
  n1["<b>2. Table to stream</b><br/>watch changes - the change log is the stream"]:::step
  n2["<b>3. The round-trip</b><br/>table of a stream, stream of a table - two directions of one idea"]:::core
  n3["<b>4. Why it holds</b><br/>both are the same data, one at rest and one in motion"]:::warn
  n0 -->|"1. inverse"| n1
  n1 -->|"2. composed"| n2
  n2 -->|"3. because"| n3`),
sec(`  n0["<b>1. Feeds are views</b><br/>a user feed is a table built from a stream of posts"]:::start
  n1["<b>2. Unread is a table</b><br/>inbox state derived from a message stream"]:::step
  n2["<b>3. Reprocessing is replay</b><br/>rebuild a view by replaying the source stream"]:::core
  n3["<b>4. One mental model</b><br/>streams and tables unify batch, streaming, and databases"]:::stop
  n0 -->|"1. likewise"| n1
  n1 -->|"2. and"| n2
  n2 -->|"3. delivering"| n3`),
],
7: [
sec(`  n0["<b>1. In-memory state dies</b><br/>a crash loses every running window and join"]:::start
  n1["<b>2. Long-lived queries need state</b><br/>windows, joins, and aggregations accumulate over time"]:::step
  n2["<b>3. Persist it</b><br/>write state to disk so a restart can resume, not restart"]:::core
  n3["<b>4. Consistency across replicas</b><br/>state must survive single-node and whole-pipeline failure"]:::warn
  n0 -->|"1. motivates"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. with"| n3`),
sec(`  n0["<b>1. State store</b><br/>local, keyed, queryable state per operator"]:::start
  n1["<b>2. Checkpoint</b><br/>a durable snapshot of all operator state"]:::core
  n2["<b>3. Incremental checkpoints</b><br/>copy only what changed since the last snapshot"]:::step
  n3["<b>4. Barriers align the snapshot</b><br/>a marker flows the graph so all operators checkpoint a consistent point"]:::warn
  n0 -->|"1. snapshotted by"| n1
  n1 -->|"2. made cheap by"| n2
  n2 -->|"3. aligned via"| n3`),
sec(`  n0["<b>1. Failure strikes</b><br/>a worker dies mid-window"]:::start
  n1["<b>2. Restore the checkpoint</b><br/>reload state from the last durable snapshot"]:::core
  n2["<b>3. Replay the source</b><br/>re-read inputs from the checkpointed position"]:::step
  n3["<b>4. Exactly-once recovery</b><br/>barrier alignment + replay + dedup = no lost or double results"]:::stop
  n0 -->|"1. handled by"| n1
  n1 -->|"2. then"| n2
  n2 -->|"3. together give"| n3`),
],
8: [
sec(`  n0["<b>1. SQL is declarative</b><br/>say what you want, not how to compute it"]:::start
  n1["<b>2. Continuous queries</b><br/>the same query runs forever over a stream, emitting as data arrives"]:::core
  n2["<b>3. Tables append or update</b><br/>an INSERT-only stream, or an upserting stream with retractions"]:::step
  n3["<b>4. Time attributes</b><br/>each row carries event time; the watermark drives emission"]:::warn
  n0 -->|"1. turns into"| n1
  n1 -->|"2. over"| n2
  n2 -->|"3. governed by"| n3`),
sec(`  n0["<b>1. TUMBLE</b><br/>fixed, non-overlapping windows - GROUP BY TUMBLE(5 MINUTES)"]:::start
  n1["<b>2. HOP</b><br/>sliding windows - fixed size, fixed period"]:::step
  n2["<b>3. SESSION</b><br/>activity-bounded windows that merge across gaps"]:::core
  n3["<b>4. Watermark-driven emission</b><br/>a window's result emits when the watermark passes its end"]:::warn
  n0 -->|"1. then"| n1
  n1 -->|"2. then"| n2
  n2 -->|"3. all emit when"| n3`),
sec(`  n0["<b>1. Windowed joins</b><br/>join two streams only within a shared time window"]:::start
  n1["<b>2. Temporal joins</b><br/>join a stream against a table's version as of event time"]:::core
  n2["<b>3. Time attributes are required</b><br/>every joined input must declare its event-time column"]:::step
  n3["<b>4. Retractions</b><br/>late data corrects an earlier join result"]:::warn
  n0 -->|"1. vs"| n1
  n1 -->|"2. both need"| n2
  n2 -->|"3. corrected by"| n3`),
],
9: [
sec(`  n0["<b>1. Unbounded inputs never finish</b><br/>a plain join waits forever for a matching key"]:::start
  n1["<b>2. Matching keys arrive far apart</b><br/>the two sides of a join disagree on arrival order"]:::warn
  n2["<b>3. Bound the wait with a window</b><br/>only join events that fall in the same time slice"]:::core
  n3["<b>4. Hold state per key</b><br/>keep each side's events until the window closes"]:::step
  n0 -->|"1. because"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. which needs"| n3`),
sec(`  n0["<b>1. Windowed join</b><br/>stream-to-stream, bounded by a shared window"]:::start
  n1["<b>2. Temporal join</b><br/>stream-to-table, joining against the table snapshot at event time"]:::core
  n2["<b>3. Which when</b><br/>windowed for two live streams; temporal for enrichment against a table"]:::step
  n3["<b>4. The common thread</b><br/>both need a time bound and keyed state"]:::warn
  n0 -->|"1. vs"| n1
  n1 -->|"2. choose by"| n2
  n2 -->|"3. shared requirement"| n3`),
sec(`  n0["<b>1. The watermark bounds the wait</b><br/>a window is joinable until its watermark passes"]:::start
  n1["<b>2. Late data needs retractions</b><br/>a late event invalidates an emitted join result"]:::warn
  n2["<b>3. Garbage-collect join state</b><br/>drop a key's state once its window can no longer match"]:::core
  n3["<b>4. Keyed state</b><br/>join state is per key, so it scales by partitioning"]:::stop
  n0 -->|"1. after which"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. and it is"| n3`),
],
10: [
sec(`  n0["<b>1. MapReduce = batch</b><br/>finite inputs, full pass, then results"]:::start
  n1["<b>2. Streaming engines arrived</b><br/>Flink, Beam, MillWheel - continuous, event-time aware"]:::step
  n2["<b>3. Batch as a special case</b><br/>a bounded stream is just a stream that ends"]:::core
  n3["<b>4. One model</b><br/>the same semantics run over both bounded and unbounded data"]:::stop
  n0 -->|"1. superseded by"| n1
  n1 -->|"2. by treating"| n2
  n2 -->|"3. giving"| n3`),
sec(`  n0["<b>1. Lambda architecture</b><br/>a batch layer + a speed layer, merged at query time"]:::start
  n1["<b>2. Two codebases drift</b><br/>the same logic written twice inevitably disagrees"]:::warn
  n2["<b>3. Kappa architecture</b><br/>a single streaming pipeline; batch is replay over a log"]:::core
  n3["<b>4. The trade</b><br/>Kappa removes drift but requires replayable sources and streaming maturity"]:::step
  n0 -->|"1. its weakness"| n1
  n1 -->|"2. answered by"| n2
  n2 -->|"3. the catch"| n3`),
sec(`  n0["<b>1. Same engine</b><br/>one runner executes batch and streaming jobs"]:::start
  n1["<b>2. Replay = reprocessing</b><br/>re-run a job by replaying the log from an offset"]:::core
  n2["<b>3. Batch = bounded stream</b><br/>batch is streaming over a finite input"]:::step
  n3["<b>4. What stays distinct</b><br/>batch is cheaper and simpler; streaming trades cost for latency"]:::warn
  n0 -->|"1. enables"| n1
  n1 -->|"2. formalizes"| n2
  n2 -->|"3. yet"| n3`),
],
};

const CARD = {
1: [
card(`  S(["<b>1. Streaming</b><br/>overloaded: real-time, low latency, continuous, event-driven, not-batch"]):::start
  A["<b>2. The book's fix</b><br/>one precise meaning - engines designed for infinite datasets"]:::core
  B["<b>3. Consequence</b><br/>unbounded data, not latency, is the defining trait"]:::step
  C["<b>4. Result</b><br/>the same engine answers batch and streaming questions"]:::warn
  S -->|"1. narrowed to"| A
  A -->|"2. the trait is"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Event time</b><br/>when the event happened"]):::start
  A["<b>2. Stamped by the producer</b><br/>the user's device, not the pipeline"]:::core
  B["<b>3. The meaningful clock</b><br/>answers about users must use it"]:::step
  C["<b>4. Cost</b><br/>requires waiting for late events"]:::warn
  S -->|"1. defined by"| A
  A -->|"2. drives"| B
  B -->|"3. imposes"| C`),
card(`  S(["<b>1. Processing time</b><br/>when the pipeline observed the event"]):::start
  A["<b>2. Read from the system clock</b><br/>no special machinery needed"]:::core
  B["<b>3. The cheap clock</b><br/>immediate, no waiting for stragglers"]:::step
  C["<b>4. The trap</b><br/>answers silently shift under load"]:::warn
  S -->|"1. sourced from"| A
  A -->|"2. it is"| B
  B -->|"3. but"| C`),
card(`  S(["<b>1. Two clocks per event</b><br/>they disagree by the network delay"]):::start
  A["<b>2. Event time</b><br/>correct answers, but wait for stragglers"]:::core
  B["<b>3. Processing time</b><br/>instant answers, but they shift under load"]:::warn
  C["<b>4. The trade</b><br/>latency vs correctness - the book's central tension"]:::stop
  S -->|"1. choose"| A
  S -->|"2. or choose"| B
  A -->|"3. both frame"| C
  B -->|"4. both frame"| C`),
card(`  S(["<b>1. Bounded data</b><br/>a finite dataset"]):::start
  A["<b>2. Fully known</b><br/>can be sorted, indexed, completed"]:::core
  B["<b>3. Batch processing</b><br/>read the whole set, then emit results"]:::step
  C["<b>4. The classic world</b><br/>MapReduce and SQL over files"]:::warn
  S -->|"1. it is"| A
  A -->|"2. handled by"| B
  B -->|"3. the home of"| C`),
card(`  S(["<b>1. Unbounded data</b><br/>never completes"]):::start
  A["<b>2. Chopped into finite windows</b><br/>process each window as a batch"]:::core
  B["<b>3. Repeated batch runs</b><br/>hourly or daily jobs over the latest chunk"]:::step
  C["<b>4. The price</b><br/>arbitrary boundaries; latency and correctness suffer"]:::warn
  S -->|"1. re-framed by"| A
  A -->|"2. implemented as"| B
  B -->|"3. pays"| C`),
card(`  S(["<b>1. Unbounded data</b><br/>never completes"]):::start
  A["<b>2. Processed continuously</b><br/>results emit as events arrive"]:::core
  B["<b>3. The engine assumes infinity</b><br/>windows, watermarks, triggers handle never-ending input"]:::step
  C["<b>4. The goal</b><br/>correct event-time answers with low latency"]:::warn
  S -->|"1. handled by"| A
  A -->|"2. needs"| B
  B -->|"3. to reach"| C`),
card(`  S(["<b>1. A batch job</b><br/>reads a finite file"]):::start
  A["<b>2. Reframe as a stream</b><br/>a bounded stream - a stream that ends"]:::core
  B["<b>3. One engine, one model</b><br/>same windows, same watermarks, same semantics"]:::step
  C["<b>4. The payoff</b><br/>batch and streaming logic no longer drift apart"]:::warn
  S -->|"1. can be"| A
  A -->|"2. so"| B
  B -->|"3. delivers"| C`),
],
2: [
card(`  S(["<b>1. A named pipeline</b><br/>sum, join, filter - but four questions left open"]):::start
  A["<b>2. What / Where / When / How</b><br/>transform, window, trigger, accumulate"]:::core
  B["<b>3. Underspecified = surprising</b><br/>two engines give two different answers for the same code"]:::warn
  C["<b>4. The checklist</b><br/>answer all four and the pipeline is fully specified"]:::stop
  S -->|"1. must answer"| A
  A -->|"2. otherwise"| B
  B -->|"3. fixed by"| C`),
card(`  S(["<b>1. What = transformations</b><br/>the per-element computation"]):::start
  A["<b>2. Element-wise and per-pane</b><br/>map, filter, sum - pure functions over data"]:::core
  B["<b>3. The first question</b><br/>without it nothing else is defined"]:::step
  C["<b>4. In Beam</b><br/>ParDo and combiners express it"]:::warn
  S -->|"1. split into"| A
  A -->|"2. it is"| B
  B -->|"3. e.g."| C`),
card(`  S(["<b>1. Where = windowing</b><br/>the event-time slice a transform runs over"]):::start
  A["<b>2. Fixed, sliding, session</b><br/>the three shapes of event-time grouping"]:::core
  B["<b>3. Event time, not processing time</b><br/>the bucket is when the event happened"]:::step
  C["<b>4. The second question</b><br/>windows decide what a result means"]:::warn
  S -->|"1. answered with"| A
  A -->|"2. always in"| B
  B -->|"3. because"| C`),
card(`  S(["<b>1. When = triggers</b><br/>when results materialize"]):::start
  A["<b>2. Repeated, not once</b><br/>a window can emit many times as data arrives"]:::core
  B["<b>3. Kinds</b><br/>processing-time, count-based, watermark, data-driven"]:::step
  C["<b>4. The third question</b><br/>triggers decide freshness vs cost"]:::warn
  S -->|"1. they are"| A
  A -->|"2. the"| B
  B -->|"3. answering"| C`),
card(`  S(["<b>1. Watermark</b><br/>a monotonic estimate of event-time completeness"]):::start
  A["<b>2. Gates a trigger</b><br/>emit when the watermark passes the window's end"]:::core
  B["<b>3. Heuristic, not perfect</b><br/>some events will still arrive late"]:::step
  C["<b>4. Paired with allowed lateness</b><br/>late data gets a data-driven trigger"]:::warn
  S -->|"1. it"| A
  A -->|"2. but it is"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Allowed lateness</b><br/>the grace period after the watermark"]):::start
  A["<b>2. A data-driven trigger</b><br/>any late event re-fires the window"]:::core
  B["<b>3. Trade-off</b><br/>longer grace = more correct, more state, more late updates"]:::warn
  C["<b>4. After it lapses</b><br/>later data is dropped or parked"]:::step
  S -->|"1. enables"| A
  A -->|"2. the"| B
  B -->|"3. once"| C`),
card(`  S(["<b>1. How = accumulation</b><br/>how a new pane relates to the prior one"]):::start
  A["<b>2. Discarding</b><br/>each pane independent"]:::core
  B["<b>3. Accumulating</b><br/>running total grows"]:::step
  C["<b>4. Accumulating + retracting</b><br/>running total plus a retraction of the old value"]:::warn
  S -->|"1. mode"| A
  A -->|"2. next mode"| B
  B -->|"3. exact mode"| C`),
card(`  S(["<b>1. Four questions</b><br/>what, where, when, how"]):::start
  A["<b>2. Each has a default</b><br/>but the defaults are engine-specific"]:::core
  B["<b>3. The checklist</b><br/>state all four before you trust a result"]:::step
  C["<b>4. The payoff</b><br/>a pipeline you can reason about and port"]:::warn
  S -->|"1. they form"| A
  A -->|"2. so use"| B
  B -->|"3. giving"| C`),
],
3: [
card(`  S(["<b>1. Unbounded data</b><br/>never ends, so no natural done"]):::start
  A["<b>2. A window needs completion</b><br/>to emit a final result"]:::core
  B["<b>3. The answer</b><br/>a watermark - an estimate of completeness"]:::step
  C["<b>4. The tension</b><br/>earlier emission vs more late data"]:::warn
  S -->|"1. yet"| A
  A -->|"2. provided by"| B
  B -->|"3. tuned by"| C`),
card(`  S(["<b>1. Perfect watermark</b><br/>exactly knows the lag of every event"]):::start
  A["<b>2. Complete knowledge</b><br/>no event will ever arrive late"]:::core
  B["<b>3. Unattainable in practice</b><br/>real sources have unbounded, unknowable delay"]:::warn
  C["<b>4. The ideal</b><br/>a correctness baseline, not a deployment target"]:::step
  S -->|"1. requires"| A
  A -->|"2. but"| B
  B -->|"3. so it is"| C`),
card(`  S(["<b>1. Heuristic watermark</b><br/>estimates lag from observed events"]):::start
  A["<b>2. Arrival minus event time</b><br/>the observed delay becomes the estimate"]:::core
  B["<b>3. Skew parameter</b><br/>a percentile bound on out-of-orderness"]:::step
  C["<b>4. The trade</b><br/>tighter skew = lower latency, more late data"]:::warn
  S -->|"1. computed as"| A
  A -->|"2. tuned by"| B
  B -->|"3. giving"| C`),
card(`  S(["<b>1. Skew</b><br/>the bound on out-of-orderness"]):::start
  A["<b>2. A percentile</b><br/>e.g. P99 of observed lag"]:::core
  B["<b>3. Too small</b><br/>many events arrive late"]:::warn
  C["<b>4. Too large</b><br/>results wait too long"]:::warn
  S -->|"1. chosen as"| A
  A -->|"2. set too small"| B
  A -->|"3. set too large"| C`),
card(`  S(["<b>1. One watermark per source</b><br/>each input has its own lag"]):::start
  A["<b>2. Independent estimates</b><br/>a slow source does not delay a fast one"]:::core
  B["<b>3. Combined downstream</b><br/>a stage's watermark is the min of its inputs"]:::step
  C["<b>4. The rule</b><br/>the pipeline is as complete as its slowest source"]:::warn
  S -->|"1. with"| A
  A -->|"2. then"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Watermark propagation</b><br/>estimates flow through the graph"]):::start
  A["<b>2. Downstream = min of upstream</b><br/>a stage cannot be more complete than its inputs"]:::core
  B["<b>3. Updates cascade</b><br/>a source advancing advances its dependents"]:::step
  C["<b>4. Correctness</b><br/>a wrong propagated watermark mis-times every downstream emission"]:::warn
  S -->|"1. the rule"| A
  A -->|"2. so"| B
  B -->|"3. and"| C`),
card(`  S(["<b>1. Latency vs correctness</b><br/>the watermark's central trade"]):::start
  A["<b>2. Early emission</b><br/>low latency, but late data missed"]:::core
  B["<b>3. Late emission</b><br/>more complete, but results are stale"]:::warn
  C["<b>4. No free lunch</b><br/>pick a skew; the trade is structural"]:::stop
  S -->|"1. choose"| A
  S -->|"2. or choose"| B
  A -->|"3. either way"| C
  B -->|"4. either way"| C`),
card(`  S(["<b>1. Watermark passed</b><br/>the window is declared complete"]):::start
  A["<b>2. Allowed lateness</b><br/>a grace period for stragglers"]:::core
  B["<b>3. Late data re-fires</b><br/>each straggler triggers an update or retraction"]:::step
  C["<b>4. The combination</b><br/>watermark = when to close; allowed lateness = how long to forgive"]:::warn
  S -->|"1. then"| A
  A -->|"2. during which"| B
  B -->|"3. together"| C`),
],
4: [
card(`  S(["<b>1. One shape does not fit all</b><br/>different questions need different windows"]):::start
  A["<b>2. Fixed</b><br/>uniform, non-overlapping accounting"]:::core
  B["<b>3. Sliding</b><br/>moving views with a period"]:::step
  C["<b>4. Session</b><br/>bursts bounded by inactivity"]:::warn
  S -->|"1. the choices"| A
  A -->|"2. and"| B
  B -->|"3. and"| C`),
card(`  S(["<b>1. Fixed windows</b><br/>equal, non-overlapping slices"]):::start
  A["<b>2. Aligned to the clock</b><br/>e.g. every hour, on the hour"]:::core
  B["<b>3. One window each</b><br/>an event lands in exactly one"]:::step
  C["<b>4. Best for</b><br/>uniform, per-period accounting"]:::warn
  S -->|"1. they are"| A
  A -->|"2. so"| B
  B -->|"3. ideal"| C`),
card(`  S(["<b>1. Sliding windows</b><br/>fixed length with a fixed period"]):::start
  A["<b>2. Overlap or gaps</b><br/>period smaller or larger than length"]:::core
  B["<b>3. One event, many windows</b><br/>an event may land in several"]:::step
  C["<b>4. Best for</b><br/>moving averages and recent-window views"]:::warn
  S -->|"1. defined by"| A
  A -->|"2. so"| B
  B -->|"3. ideal"| C`),
card(`  S(["<b>1. Session windows</b><br/>bounded by a gap of inactivity"]):::start
  A["<b>2. Data-defined</b><br/>the events decide the boundaries"]:::core
  B["<b>3. Merge across the gap</b><br/>a bridging event joins two sessions"]:::step
  C["<b>4. Best for</b><br/>user sessions, bursts, clickstreams"]:::warn
  S -->|"1. they are"| A
  A -->|"2. and"| B
  B -->|"3. ideal"| C`),
card(`  S(["<b>1. The window lifecycle</b><br/>five stages"]):::start
  A["<b>2. Assign, merge</b><br/>place events, join sessions"]:::core
  B["<b>3. Group, trigger, accumulate</b><br/>key events, emit, fold panes"]:::step
  C["<b>4. Garbage collect</b><br/>drop state that can never change"]:::warn
  S -->|"1. first"| A
  A -->|"2. then"| B
  B -->|"3. finally"| C`),
card(`  S(["<b>1. Session merging</b><br/>a late event bridges a gap"]):::start
  A["<b>2. Two sessions become one</b><br/>their events and state merge"]:::core
  B["<b>3. After emission</b><br/>already-emitted panes must be corrected"]:::warn
  C["<b>4. Via retraction</b><br/>cancel the old, emit the merged"]:::step
  S -->|"1. so"| A
  A -->|"2. even"| B
  B -->|"3. handled"| C`),
card(`  S(["<b>1. Late merges</b><br/>a session changes after it emitted"]):::start
  A["<b>2. The downstream saw stale panes</b><br/>two separate session results"]:::warn
  B["<b>3. Retraction needed</b><br/>downstream must undo the stale result"]:::core
  C["<b>4. The cost</b><br/>retractions complicate every downstream consumer"]:::step
  S -->|"1. means"| A
  A -->|"2. so"| B
  B -->|"3. and"| C`),
card(`  S(["<b>1. Sessions are keyed</b><br/>a session belongs to a key"]):::start
  A["<b>2. Per-user sessions</b><br/>merging happens within a key, never across"]:::core
  B["<b>3. Keyed state</b><br/>session state is per key, so it partitions"]:::step
  C["<b>4. The trap</b><br/>forgetting the key merges unrelated activity"]:::warn
  S -->|"1. e.g."| A
  A -->|"2. held in"| B
  B -->|"3. avoid"| C`),
],
5: [
card(`  S(["<b>1. Retries are unavoidable</b><br/>crashes and timeouts force re-processing"]):::start
  A["<b>2. Duplicates follow</b><br/>a retried step may re-emit results"]:::warn
  B["<b>3. The fix</b><br/>at-least-once delivery plus deduplication"]:::core
  C["<b>4. The guarantee</b><br/>exactly-once = at-least-once + at-most-once"]:::stop
  S -->|"1. which produce"| A
  A -->|"2. so"| B
  B -->|"3. giving"| C`),
card(`  S(["<b>1. Idempotency</b><br/>same operation, same result, any number of runs"]):::start
  A["<b>2. Natural examples</b><br/>set a value, insert with a fixed key"]:::core
  B["<b>3. Retry-safe</b><br/>a re-run changes nothing"]:::step
  C["<b>4. The tool</b><br/>an idempotency key makes an arbitrary operation idempotent"]:::warn
  S -->|"1. e.g."| A
  A -->|"2. so it is"| B
  B -->|"3. enforced by"| C`),
card(`  S(["<b>1. Shuffle deduplication</b><br/>a repeated delivery across a shuffle"]):::start
  A["<b>2. Why it matters</b><br/>a retried shuffle can double-count a key"]:::warn
  B["<b>3. The guard</b><br/>a seen-set or deterministic key drops repeats"]:::core
  C["<b>4. The rule</b><br/>dedup at every stage, not just the source"]:::step
  S -->|"1. the risk"| A
  A -->|"2. fixed by"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Replayable sources</b><br/>inputs that can be re-read"]):::start
  A["<b>2. A durable, ordered log</b><br/>offsets let you re-read from a point"]:::core
  B["<b>3. Recovery depends on it</b><br/>replay after a checkpoint resumes exactly"]:::step
  C["<b>4. The requirement</b><br/>end-to-end exactly-once starts here"]:::warn
  S -->|"1. e.g."| A
  A -->|"2. so"| B
  B -->|"3. which is"| C`),
card(`  S(["<b>1. End-to-end exactly-once</b><br/>the whole pipeline, not one operator"]):::start
  A["<b>2. Replayable source</b><br/>re-read inputs from a checkpoint"]:::core
  B["<b>3. Deterministic compute + dedup</b><br/>no double results within or across stages"]:::step
  C["<b>4. Idempotent sink</b><br/>the final write is retry-safe"]:::warn
  S -->|"1. needs"| A
  A -->|"2. then"| B
  B -->|"3. and"| C`),
card(`  S(["<b>1. Side effects</b><br/>writes to the outside world"]):::start
  A["<b>2. Not idempotent by nature</b><br/>a credit, an email, a notification"]:::warn
  B["<b>3. The hard part of exactly-once</b><br/>compute is easy; effects are not"]:::core
  C["<b>4. Two tools</b><br/>idempotency keys, or a two-phase commit with the sink"]:::step
  S -->|"1. they are"| A
  A -->|"2. making them"| B
  B -->|"3. tamed by"| C`),
card(`  S(["<b>1. Idempotency key</b><br/>a stable identifier per logical operation"]):::start
  A["<b>2. Sink dedups on it</b><br/>repeated writes with the same key are no-ops"]:::core
  B["<b>3. Two-phase commit</b><br/>coordinate the sink write with the checkpoint"]:::step
  C["<b>4. The trade</b><br/>keys are simpler; 2PC is stronger but heavier"]:::warn
  S -->|"1. vs"| A
  A -->|"2. alternative"| B
  B -->|"3. choosing"| C`),
card(`  S(["<b>1. Isolate side effects</b><br/>concentrate them at the edge"]):::start
  A["<b>2. Keep compute pure</b><br/>recomputable, no external writes"]:::core
  B["<b>3. One small effectful stage</b><br/>only it needs idempotency or 2PC"]:::step
  C["<b>4. The payoff</b><br/>most of the pipeline is trivially exactly-once"]:::warn
  S -->|"1. by keeping"| A
  A -->|"2. with"| B
  B -->|"3. so"| C`),
],
6: [
card(`  S(["<b>1. One dataset, two forms</b><br/>motion and state"]):::start
  A["<b>2. A stream</b><br/>the change log - events over time"]:::core
  B["<b>3. A table</b><br/>the current value per key"]:::step
  C["<b>4. The insight</b><br/>each is the other viewed differently"]:::warn
  S -->|"1. is"| A
  A -->|"2. materialized as"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. A stream</b><br/>motion"]):::start
  A["<b>2. Append-only events</b><br/>each event is a fact that happened"]:::core
  B["<b>3. Ordered by time</b><br/>event time, possibly out of arrival order"]:::step
  C["<b>4. The change log</b><br/>a stream is the log of changes to some state"]:::warn
  S -->|"1. it is"| A
  A -->|"2. roughly"| B
  B -->|"3. i.e."| C`),
card(`  S(["<b>1. A table</b><br/>state"]):::start
  A["<b>2. Current value per key</b><br/>the latest fact wins"]:::core
  B["<b>3. A materialized view</b><br/>of its change stream"]:::step
  C["<b>4. The database shape</b><br/>what you query"]:::warn
  S -->|"1. holds the"| A
  A -->|"2. it is"| B
  B -->|"3. which is"| C`),
card(`  S(["<b>1. Stream to table</b><br/>aggregate events into state"]):::start
  A["<b>2. Sum, count, last-write-wins</b><br/>each key folds its events"]:::core
  B["<b>3. Materialization</b><br/>the table is the stream, at rest"]:::step
  C["<b>4. In practice</b><br/>a feed view, a counter, an inbox"]:::warn
  S -->|"1. via"| A
  A -->|"2. called"| B
  B -->|"3. e.g."| C`),
card(`  S(["<b>1. Table to stream</b><br/>state emits its changes"]):::start
  A["<b>2. The change log</b><br/>every insert, update, delete is an event"]:::core
  B["<b>3. Replication is this</b><br/>a database ships its change log to replicas"]:::step
  C["<b>4. In practice</b><br/>CDC, binlogs, WAL replay"]:::warn
  S -->|"1. as"| A
  A -->|"2. literally"| B
  B -->|"3. e.g."| C`),
card(`  S(["<b>1. The round-trip</b><br/>table of a stream, stream of a table"]):::start
  A["<b>2. Aggregate a stream into a table</b><br/>then watch the table for changes"]:::core
  B["<b>3. You get a stream again</b><br/>the derived change log"]:::step
  C["<b>4. One idea, two directions</b><br/>the duality is closed"]:::warn
  S -->|"1. step one"| A
  A -->|"2. step two"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Materialize vs recompute</b><br/>store the view, or rebuild it"]):::start
  A["<b>2. Materialize</b><br/>fast reads, but storage and update cost"]:::core
  B["<b>3. Recompute</b><br/>no storage, but slow reads"]:::step
  C["<b>4. The trade</b><br/>pick per access pattern"]:::warn
  S -->|"1. option"| A
  A -->|"2. option"| B
  B -->|"3. choose"| C`),
card(`  S(["<b>1. Stream as source of truth</b><br/>the log is the ledger"]):::start
  A["<b>2. Tables are derived</b><br/>views you can rebuild by replay"]:::core
  B["<b>3. Reprocessing</b><br/>fix a bug, replay, rebuild the views"]:::step
  C["<b>4. The payoff</b><br/>the past is never lost"]:::warn
  S -->|"1. so"| A
  A -->|"2. enabling"| B
  B -->|"3. and"| C`),
],
7: [
card(`  S(["<b>1. Memory state dies</b><br/>a crash loses windows and joins"]):::start
  A["<b>2. Long-lived queries</b><br/>accumulate state for hours or forever"]:::core
  B["<b>3. The fix</b><br/>persist state to disk"]:::step
  C["<b>4. The goal</b><br/>resume, not restart"]:::warn
  S -->|"1. yet"| A
  A -->|"2. so"| B
  B -->|"3. to"| C`),
card(`  S(["<b>1. Checkpoint</b><br/>a durable snapshot of all state"]):::start
  A["<b>2. Written periodically</b><br/>to durable, replicated storage"]:::core
  B["<b>3. Recovery point</b><br/>restart reloads from here"]:::step
  C["<b>4. The trade</b><br/>more frequent = less replay, more write cost"]:::warn
  S -->|"1. it is"| A
  A -->|"2. the"| B
  B -->|"3. tuning"| C`),
card(`  S(["<b>1. State store</b><br/>local, keyed, queryable state"]):::start
  A["<b>2. Per operator</b><br/>each operator holds its own"]:::core
  B["<b>3. RocksDB-style</b><br/>an embedded, disk-backed key-value store"]:::step
  C["<b>4. Checkpointed</b><br/>its contents feed the snapshot"]:::warn
  S -->|"1. it is"| A
  A -->|"2. often"| B
  B -->|"3. and"| C`),
card(`  S(["<b>1. Incremental checkpoints</b><br/>copy only what changed"]):::start
  A["<b>2. Delta since last snapshot</b><br/>not a full copy every time"]:::core
  B["<b>3. Much cheaper</b><br/>frequent checkpoints become affordable"]:::step
  C["<b>4. The win</b><br/>less replay without the write storm"]:::warn
  S -->|"1. i.e."| A
  A -->|"2. so"| B
  B -->|"3. hence"| C`),
card(`  S(["<b>1. Checkpoint barriers</b><br/>markers that flow the graph"]):::start
  A["<b>2. Injected at the sources</b><br/>one barrier between logical chunks"]:::core
  B["<b>3. Operators snapshot on the barrier</b><br/>all align at a consistent point"]:::step
  C["<b>4. Chandy-Lamport idea</b><br/>a consistent global snapshot of a running graph"]:::warn
  S -->|"1. they are"| A
  A -->|"2. and"| B
  B -->|"3. the"| C`),
card(`  S(["<b>1. Exactly-once recovery</b><br/>no lost, no double results"]):::start
  A["<b>2. Restore checkpoint</b><br/>reload state"]:::core
  B["<b>3. Replay source from offset</b><br/>re-read inputs"]:::step
  C["<b>4. Barrier + dedup</b><br/>alignment plus dedup closes the loop"]:::warn
  S -->|"1. step"| A
  A -->|"2. then"| B
  B -->|"3. with"| C`),
card(`  S(["<b>1. Checkpoint frequency</b><br/>how often to snapshot"]):::start
  A["<b>2. Frequent</b><br/>little replay, but heavy writes"]:::core
  B["<b>3. Infrequent</b><br/>cheap writes, but long replay"]:::warn
  C["<b>4. Incremental helps</b><br/>cheapens the frequent side"]:::step
  S -->|"1. option"| A
  A -->|"2. option"| B
  B -->|"3. the middle"| C`),
card(`  S(["<b>1. State grows unbounded</b><br/>windows and joins keep accumulating"]):::start
  A["<b>2. Bound it</b><br/>cap state per key, window, or time"]:::core
  B["<b>3. Garbage collection</b><br/>drop state whose window is closed"]:::step
  C["<b>4. The discipline</b><br/>no bound means the store fills"]:::warn
  S -->|"1. so"| A
  A -->|"2. via"| B
  B -->|"3. because"| C`),
],
8: [
card(`  S(["<b>1. Streaming is too low-level</b><br/>hand-rolled operators are verbose"]):::start
  A["<b>2. SQL is declarative</b><br/>say what, not how"]:::core
  B["<b>3. Streaming SQL</b><br/>continuous queries over streams"]:::step
  C["<b>4. The payoff</b><br/>familiar syntax, engine-optimized execution"]:::warn
  S -->|"1. the fix"| A
  A -->|"2. applied as"| B
  B -->|"3. giving"| C`),
card(`  S(["<b>1. Continuous query</b><br/>runs forever"]):::start
  A["<b>2. Emits as data arrives</b><br/>not once at the end"]:::core
  B["<b>3. Table semantics</b><br/>append-only or updating results"]:::step
  C["<b>4. In practice</b><br/>Flink SQL, Beam SQL, ksqlDB"]:::warn
  S -->|"1. it"| A
  A -->|"2. with"| B
  B -->|"3. e.g."| C`),
card(`  S(["<b>1. Time attributes</b><br/>event-time or processing-time columns"]):::start
  A["<b>2. Declared per table</b><br/>the engine must know the clock"]:::core
  B["<b>3. Event time needs a watermark</b><br/>else the engine cannot close windows"]:::step
  C["<b>4. The rule</b><br/>every windowed query names its time attribute"]:::warn
  S -->|"1. they are"| A
  A -->|"2. and"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. TUMBLE</b><br/>fixed, non-overlapping windows"]):::start
  A["<b>2. HOP</b><br/>sliding - fixed size, fixed period"]:::core
  B["<b>3. SESSION</b><br/>activity-bounded, merging"]:::step
  C["<b>4. All emit on the watermark</b><br/>when the window's end passes"]:::warn
  S -->|"1. then"| A
  A -->|"2. then"| B
  B -->|"3. each"| C`),
card(`  S(["<b>1. Append-only results</b><br/>each row is a new fact"]):::start
  A["<b>2. Updating results</b><br/>a key's value changes over time"]:::core
  B["<b>3. Retractions</b><br/>updates ship the old value as a withdrawal"]:::step
  C["<b>4. The difference</b><br/>whether downstream sees history or current state"]:::warn
  S -->|"1. vs"| A
  A -->|"2. needing"| B
  B -->|"3. which is"| C`),
card(`  S(["<b>1. Windowed joins</b><br/>two streams in a shared window"]):::start
  A["<b>2. Bounded by the window</b><br/>matches only within the time slice"]:::core
  B["<b>3. Emit on watermark</b><br/>plus late updates"]:::step
  C["<b>4. In SQL</b><br/>JOIN ... WITHIN or a window clause"]:::warn
  S -->|"1. they are"| A
  A -->|"2. and"| B
  B -->|"3. e.g."| C`),
card(`  S(["<b>1. The watermark drives SQL emission</b><br/>windows close when it passes"]):::start
  A["<b>2. No watermark</b><br/>no final result"]:::warn
  B["<b>3. Late data</b><br/>updates or retractions after emission"]:::core
  C["<b>4. The takeaway</b><br/>SQL correctness rides on the watermark"]:::step
  S -->|"1. so"| A
  A -->|"2. while"| B
  B -->|"3. hence"| C`),
card(`  S(["<b>1. Event time vs processing time</b><br/>in SQL, the same choice"]):::start
  A["<b>2. Event time</b><br/>correct, but waits on the watermark"]:::core
  B["<b>3. Processing time</b><br/>instant, but shifts under load"]:::warn
  C["<b>4. Declare it</b><br/>the time attribute picks the clock"]:::step
  S -->|"1. choose"| A
  S -->|"2. or"| B
  A -->|"3. via"| C
  B -->|"4. via"| C`),
],
9: [
card(`  S(["<b>1. Unbounded joins never finish</b><br/>a matching key may arrive any time"]):::start
  A["<b>2. So a plain join waits forever</b><br/>and holds state without bound"]:::warn
  B["<b>3. The fix</b><br/>bound the wait with a window"]:::core
  C["<b>4. The cost</b><br/>state per key until the window closes"]:::step
  S -->|"1. which means"| A
  A -->|"2. hence"| B
  B -->|"3. paid as"| C`),
card(`  S(["<b>1. Windowed join</b><br/>stream-to-stream"]):::start
  A["<b>2. Shared time window</b><br/>both sides bounded by the same slice"]:::core
  B["<b>3. Emit at watermark</b><br/>with late updates after"]:::step
  C["<b>4. Use when</b><br/>two live streams must match in time"]:::warn
  S -->|"1. joins within a"| A
  A -->|"2. and"| B
  B -->|"3. i.e."| C`),
card(`  S(["<b>1. Temporal join</b><br/>stream-to-table"]):::start
  A["<b>2. Join against a version</b><br/>the table snapshot as of event time"]:::core
  B["<b>3. Enrichment pattern</b><br/>look up a user, product, or currency"]:::step
  C["<b>4. No window needed</b><br/>the table side is already state"]:::warn
  S -->|"1. it joins"| A
  A -->|"2. the classic"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Join state</b><br/>both sides held per key"]):::start
  A["<b>2. Until the window closes</b><br/>or the match is complete"]:::core
  B["<b>3. Keyed and partitioned</b><br/>state scales by key"]:::step
  C["<b>4. The risk</b><br/>unbounded state if never released"]:::warn
  S -->|"1. held"| A
  A -->|"2. it is"| B
  B -->|"3. with"| C`),
card(`  S(["<b>1. Watermarks bound the wait</b><br/>a window is matchable until it passes"]):::start
  A["<b>2. Then emit</b><br/>the join result for that slice"]:::core
  B["<b>3. Then release state</b><br/>the key's events can be dropped"]:::step
  C["<b>4. The dependency</b><br/>join correctness rides on the watermark"]:::warn
  S -->|"1. after which"| A
  A -->|"2. and"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Late data</b><br/>arrives after the watermark"]):::start
  A["<b>2. May change a join result</b><br/>a missed match, or a wrong one"]:::warn
  B["<b>3. Retractions</b><br/>withdraw the stale result, emit the corrected"]:::core
  C["<b>4. The cost</b><br/>downstream must handle withdrawals"]:::step
  S -->|"1. which"| A
  A -->|"2. handled by"| B
  B -->|"3. meaning"| C`),
card(`  S(["<b>1. Garbage-collect join state</b><br/>drop it when it can no longer match"]):::start
  A["<b>2. After the watermark</b><br/>the window is closed"]:::core
  B["<b>3. Per-key cleanup</b><br/>release each key's buffered events"]:::step
  C["<b>4. The discipline</b><br/>no GC means unbounded memory"]:::warn
  S -->|"1. i.e."| A
  A -->|"2. done as"| B
  B -->|"3. because"| C`),
card(`  S(["<b>1. Stream-stream</b><br/>two moving inputs"]):::start
  A["<b>2. Stream-table</b><br/>one moving, one at rest"]:::core
  B["<b>3. The confusion</b><br/>using a windowed join where a temporal join fits"]:::warn
  C["<b>4. The rule</b><br/>two streams - window; a table side - temporal"]:::step
  S -->|"1. vs"| A
  A -->|"2. avoid"| B
  B -->|"3. so"| C`),
],
10: [
card(`  S(["<b>1. Batch and streaming were separate</b><br/>different engines, different code"]):::start
  A["<b>2. Same logic, twice</b><br/>a batch job and a streaming job"]:::warn
  B["<b>3. They drift</b><br/>two implementations, two answers"]:::core
  C["<b>4. The motivation</b><br/>unify them"]:::step
  S -->|"1. so"| A
  A -->|"2. and"| B
  B -->|"3. hence"| C`),
card(`  S(["<b>1. Lambda architecture</b><br/>batch layer + speed layer"]):::start
  A["<b>2. Batch = accurate</b><br/>full recompute, eventually"]:::core
  B["<b>3. Speed = fast</b><br/>approximate, then corrected"]:::step
  C["<b>4. The flaw</b><br/>two codebases to keep in sync"]:::warn
  S -->|"1. the"| A
  A -->|"2. the"| B
  B -->|"3. but"| C`),
card(`  S(["<b>1. Kappa architecture</b><br/>streaming only"]):::start
  A["<b>2. Batch is replay</b><br/>re-run the stream over the log"]:::core
  B["<b>3. One codebase</b><br/>one pipeline, no drift"]:::step
  C["<b>4. The requirement</b><br/>replayable sources and streaming maturity"]:::warn
  S -->|"1. where"| A
  A -->|"2. giving"| B
  B -->|"3. needing"| C`),
card(`  S(["<b>1. Batch is a special case</b><br/>of streaming"]):::start
  A["<b>2. A bounded stream</b><br/>a stream that ends"]:::core
  B["<b>3. One engine runs both</b><br/>same windows, watermarks, semantics"]:::step
  C["<b>4. The unification</b><br/>batch and streaming logic match"]:::warn
  S -->|"1. i.e."| A
  A -->|"2. so"| B
  B -->|"3. delivering"| C`),
card(`  S(["<b>1. Reprocessing via replay</b><br/>re-run the past"]):::start
  A["<b>2. Replay the log</b><br/>from an earlier offset"]:::core
  B["<b>3. Fix bugs, backfill views</b><br/>rebuild results with new logic"]:::step
  C["<b>4. The payoff</b><br/>the past is never lost"]:::warn
  S -->|"1. by"| A
  A -->|"2. to"| B
  B -->|"3. so"| C`),
card(`  S(["<b>1. Replayable logs</b><br/>durable, ordered, re-readable"]):::start
  A["<b>2. Kafka, Kinesis, bookkeeper</b><br/>offset-based reads"]:::core
  B["<b>3. The foundation</b><br/>of reprocessing and recovery"]:::step
  C["<b>4. The prerequisite</b><br/>Kappa cannot exist without them"]:::warn
  S -->|"1. e.g."| A
  A -->|"2. they are"| B
  B -->|"3. hence"| C`),
card(`  S(["<b>1. Lambda vs Kappa</b><br/>the architecture choice"]):::start
  A["<b>2. Lambda</b><br/>proven, but two codebases"]:::core
  B["<b>3. Kappa</b><br/>one codebase, but needs replay + streaming maturity"]:::warn
  C["<b>4. The trend</b><br/>toward Kappa as streaming engines matured"]:::step
  S -->|"1. choose"| A
  S -->|"2. or"| B
  A -->|"3. the drift"| C
  B -->|"4. the drift"| C`),
card(`  S(["<b>1. What stays distinct</b><br/>even when unified"]):::start
  A["<b>2. Batch is cheaper</b><br/>simpler, no watermarks, no live state"]:::core
  B["<b>3. Streaming trades cost for latency</b><br/>continuous, low-latency results"]:::step
  C["<b>4. The rule</b><br/>use batch unless latency pays for itself"]:::warn
  S -->|"1. first"| A
  A -->|"2. while"| B
  B -->|"3. so"| C`),
],
};

// ---------------------------------------------------------------- build
eval(fs.readFileSync('js/chapters-registry.js', 'utf8'));
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort()) {
  eval(fs.readFileSync('content/' + f, 'utf8'));
}
CHAPTERS.sort((a, b) => a.num - b.num);

const sectionOut = {};
const cardOut = {};
for (const ch of CHAPTERS) {
  const nn = String(ch.num).padStart(2, '0');
  const secs = SEC[ch.num] || [];
  (ch.flow || []).forEach((s, i) => { if (secs[i]) sectionOut[`ch${nn}::${ent(s.section)}`] = secs[i]; });
  const cards = CARD[ch.num] || [];
  ((ch.concepts && ch.concepts.cards) || []).forEach((c, i) => { if (cards[i]) cardOut[`ch${nn}::${ent(c.title)}`] = cards[i]; });
}
fs.writeFileSync('tools/section-diagrams.json', JSON.stringify(sectionOut, null, 2));
fs.writeFileSync('tools/card-diagrams.json', JSON.stringify(cardOut, null, 2));
console.log(`Wrote ${Object.keys(sectionOut).length} section diagrams and ${Object.keys(cardOut).length} card diagrams.`);
