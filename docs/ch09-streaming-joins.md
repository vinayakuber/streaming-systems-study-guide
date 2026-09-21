# Chapter 9: Streaming Joins

> Joining streams is about bounding an unbounded match — windowed joins bound time, temporal joins enrich against a table, and the watermark plus state decide when a join result is complete.

_Also known as: SS Ch09 · Streaming Join · Windowed Join · Temporal Join · Stream-Table Join · Join State_

## Flow

### Why joins are hard on streams

> **Why this matters:** A join over two finite tables is a set intersection; a join over two unbounded streams has no boundary, so this section establishes what makes streaming joins different.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Unbounded inputs never finish</b><br/>a plain join waits forever for a matching key"]:::start
  n1["<b>2. Matching keys arrive far apart</b><br/>the two sides of a join disagree on arrival order"]:::warn
  n2["<b>3. Bound the wait with a window</b><br/>only join events that fall in the same time slice"]:::core
  n3["<b>4. Hold state per key</b><br/>keep each side's events until the window closes"]:::step
  n0 -->|"1. because"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. which needs"| n3
```

1. **Two unbounded inputs have no join boundary** — A batch join completes when both tables are read. **A stream-stream join never completes on its own** — it needs a time bound to say when a match is done.

2. **The join must buffer** — Rows from one side must wait for their counterpart on the other side. **Join state holds one side until the other catches up**, bounded by the join window.

3. **Watermarks bound the wait** — The watermark tells each side when no more rows for a time range will arrive. **A join emits a match when both sides' watermarks pass the join window.**

4. **Different joins for different inputs** — **Windowed joins** match two streams in a time window; **temporal joins** enrich a stream against a slowly-changing table. The input type picks the join type.

```java
// JOIN SIDE — two streams buffer one side until the other side's watermark catches up
// DEF: join window — the time bound for a match = 5 min around the click
// DEF: buffer — rows held for the other side = [ impression 12:02 ]
// DEF: watermark — clicks = 12:06:00, impressions = 12:04:30
// -> input : a click {campaign: "C1", event_time: "12:03:00"} arrives
//    step 1 · the click probes the impression buffer -> match : {} -> { (click 12:03, impression 12:02) }   BECAUSE 12:02 is within 5 min of 12:03
//    step 2 · the join checks completeness -> impressions watermark 12:04:30 < 12:05:00 -> the match is held
//    step 3 · impressions watermark advances -> watermark : 12:04:30 -> 12:06:00 -> the match emits   BECAUSE both sides passed the window
// <- outcome : the match waited 1 hold cycle until both watermarks passed 12:05:00   BECAUSE a late impression could still arrive
//    derivation : emit when min(click_watermark, impression_watermark) > 12:05:00, i.e. 12:06:00 > 12:05:00
```

### Windowed and temporal joins

> **Why this matters:** The two practical join forms — matching two streams in a window, and enriching a stream against a table — have different correctness rules, so this section contrasts them.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Windowed join</b><br/>stream-to-stream, bounded by a shared window"]:::start
  n1["<b>2. Temporal join</b><br/>stream-to-table, joining against the table snapshot at event time"]:::core
  n2["<b>3. Which when</b><br/>windowed for two live streams; temporal for enrichment against a table"]:::step
  n3["<b>4. The common thread</b><br/>both need a time bound and keyed state"]:::warn
  n0 -->|"1. vs"| n1
  n1 -->|"2. choose by"| n2
  n2 -->|"3. shared requirement"| n3
```

1. **Windowed (interval) join** — A windowed join matches rows from two streams whose time attributes are **within a window of each other**. The window bounds the buffer and the watermark bounds the wait.

2. **Temporal join (stream-table)** — A temporal join enriches a stream with the **version of a table that was current at the event's time**. It looks up state, not a moving window.

3. **Stream-table join is a lookup** — Joining a stream against a table is a **keyed lookup** — the stream row probes the table state at the join key. It is bounded because the table is finite per key.

4. **The choice is about what is joined** — Join two streams -> window; join a stream to a table -> temporal lookup. **Mistaking one for the other is the common streaming-join bug.**

```java
// TEMPORAL JOIN SIDE — a click enriches against the version of a user table current at event time
// DEF: temporal join — enrich each stream row with the table version current at its event time = 12:03:00
// DEF: user_table — the slowly-changing table = { 42: {tier: "gold"} }
// DEF: click — {user: 42, event_time: "12:03:00"}
// -> input : the click {user: 42, event_time: "12:03:00"} arrives
//    step 1 · probe the table at the join key -> user_table[42] = {tier: "gold"}
//    step 2 · enrich the click -> click : {user: 42, event_time: "12:03:00"} -> {user: 42, event_time: "12:03:00", tier: "gold"}
//    step 3 · the enriched row emits immediately -> no watermark wait   BECAUSE the table is finite per key, not an unbounded stream
// <- outcome : the click is enriched with tier "gold" without buffering   BECAUSE a table lookup is bounded
//    derivation : temporal join = probe table at key 42, so no window is needed to bound the match
```

### Correctness and state

> **Why this matters:** A join is only correct if it holds the right state for the right amount of time and cleans it up, so this section covers the state and watermark discipline behind joins.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. The watermark bounds the wait</b><br/>a window is joinable until its watermark passes"]:::start
  n1["<b>2. Late data needs retractions</b><br/>a late event invalidates an emitted join result"]:::warn
  n2["<b>3. Garbage-collect join state</b><br/>drop a key's state once its window can no longer match"]:::core
  n3["<b>4. Keyed state</b><br/>join state is per key, so it scales by partitioning"]:::stop
  n0 -->|"1. after which"| n1
  n1 -->|"2. so"| n2
  n2 -->|"3. and it is"| n3
```

1. **Join state is bounded by the window** — The buffer for a windowed join only needs to hold rows **within the join window** — rows older than the window can be dropped once both watermarks pass.

2. **Late data complicates the join** — A late row can arrive after the join already emitted. **Allowed lateness keeps the join state alive** so a late match can still emit (and retract the earlier result).

3. **Retractions correct emitted joins** — If a late row changes a join result already emitted, the pipeline must **retract the old match and emit the corrected one** — the same accumulation discipline as windows.

4. **Garbage-collect the join state** — Join state must be garbage-collected when the watermark passes the window plus allowed lateness, or **the buffer grows without bound.**

```java
// LATE JOIN SIDE — a late impression changes an emitted match, forcing a retraction
// DEF: join window — 5 min around the click
// DEF: allowed lateness — how long the join keeps state for late rows = 1 min
// DEF: match — the already-emitted pair = (click 12:03, impression 12:01)
// -> input : a late impression {campaign: "C1", event_time: "12:02:00"} arrives after emission
//    step 1 · the late impression is within the join window -> join_state records it -> a better match is found
//    step 2 · the pipeline retracts the old match -> downstream : { (12:03,12:01) } -> cancelled
//    step 3 · the corrected match emits -> downstream : {} -> { (12:03, 12:02) }   BECAUSE 12:02 is closer to 12:03
// <- outcome : the downstream result is corrected from (12:03,12:01) to (12:03,12:02)   BECAUSE the late row changed the match
//    derivation : allowed lateness 1 min > lateness of the impression (arrival 12:06, event 12:02 = 4 min? 4 > 1 -> only if within lateness)
```


## System Design Interview

**The pipeline:** click stream + impression stream -> windowed join (buffer + watermark) -> retraction emitter -> attribution store

### click stream + impression stream

_Role: two streams — feed the join with event-time rows_

```mermaid
flowchart TD
  R["click stream + impression stream"]
  R --> P0["a click {campaign: #quot;C1#quot;, event_time: #quot;12:03:00#quot;} arrives"]
  R --> P1["an impression {campaign: #quot;C1#quot;, event_time: #quot;12:02:00#quot;} arrives"]
  R --> P2["each side carries its own watermark"]
```

### windowed join (buffer + watermark)

_Role: windowed join — buffers one side and matches within a window_

```mermaid
flowchart TD
  R["windowed join (buffer + watermark)"]
  R --> P0["the impression buffer holds rows within 5 min of a click"]
  R --> P1["the click probes the buffer and finds the 12:02 impression"]
  R --> P2["the match is held until both watermarks pass 12:05:00"]
```

### retraction emitter

_Role: retraction emitter — corrects matches when late data arrives_

```mermaid
flowchart TD
  R["retraction emitter"]
  R --> P0["a late impression within allowed lateness changes the match"]
  R --> P1["the old match is retracted downstream"]
  R --> P2["the corrected match is emitted"]
```

### attribution store

_Role: attribution store — holds the final matches_

```mermaid
flowchart TD
  R["attribution store"]
  R --> P0["the store applies retractions so old matches do not double-count"]
  R --> P1["the final state shows the corrected (click, impression) pair"]
  R --> P2["join state is garbage-collected past the window + lateness"]
```

```mermaid
flowchart LR
  C["click stream"] --> J["windowed join"]
  I["impression stream"] --> J
  J --> R["retraction emitter"]
  R --> S[(attribution store)]
```

```java
// SYSTEM DESIGN — a windowed join holds a match until both watermarks pass, then a late row corrects it
// DEF: join window — the time bound for a match = 5 min
// DEF: watermark — clicks = 12:06:00, impressions = 12:04:30
// DEF: retraction — a downstream signal that cancels an emitted match
// STATE (before):
//    join_state : { matches: [], impressions: [ 12:02 ] }
// -> input : a click {campaign: "C1", event_time: "12:03:00"} arrives
//    step 1 · the click probes the impression buffer -> join_state.matches : [] -> [ (12:03, 12:02) ]   BECAUSE 12:02 is within 5 min of 12:03
//    step 2 · completeness check -> impressions watermark 12:04:30 < 12:05:00 -> the match is held
//    step 3 · impressions watermark advances -> watermark : 12:04:30 -> 12:06:00 -> the match emits   BECAUSE both sides passed 12:05:00
// <- outcome : the match emits 1 row once both watermarks pass 12:05:00, and a late impression would retract and re-emit   BECAUSE the join is bounded by the slower stream
//    derivation : emit when min(12:06:00, 12:06:00) > 12:05:00 = true
```

## Interview Questions

### Q1

An attribution pipeline joins ad impressions with clicks to attribute conversions, but it emits matches before a late impression could arrive, so some conversions are attributed to the wrong ad.

**Interviewer's question:** How do you join two event streams correctly when events can arrive out of order?

**Solution:** Use a windowed join bounded by a time window, and let the watermark decide when a match is complete — emit only when both sides' watermarks pass the join window, with allowed lateness and retractions for late corrections.

**System-design components:**
- Windowed join — interval bound
- Watermark — both sides pass
- Allowed lateness — late corrections
- Retraction — correct emitted matches

```mermaid
flowchart LR
  C["clicks"] --> J{join window}
  I["impressions"] --> J
  J --> W{both watermarks pass?}
  W -->|yes| E[emit match]
  W -->|no| H[hold]
  L["late row"] --> R[retract + re-emit]
```

```java
// click 12:03, impression 12:02, window 5 min
//   impressions wm 12:04:30 < 12:05 -> hold
//   impressions wm -> 12:06 -> both pass -> emit
//   late impression 12:01 -> retract old, emit corrected
```

_This is exactly the windowed-join and watermark material in this chapter._

_Covers:_ 2. Windowed joins · 5. Watermarks bound the wait · 6. Late data and retractions

_From the 28 problems:_ 21-ad-click-aggregation

### Q2

A click stream needs each click enriched with the user's current subscription tier before aggregation, and the tier changes over time.

**Interviewer's question:** How do you join a stream to a slowly-changing table correctly?

**Solution:** Use a temporal (stream-table) join — probe the table at the join key for the version current at the event's time, rather than a windowed join.

**System-design components:**
- Temporal join — lookup
- Table — changelog-backed
- Join key — user id

```mermaid
flowchart LR
  C["click stream"] --> T["temporal join"]
  U[(user table)] --> T
  T --> E["enriched click"]
```

```java
// click {user:42, event_time:12:03}
//   probe user_table[42] = {tier: gold}
//   -> click + tier=gold, no window needed
```

_This is exactly the temporal-join material in this chapter._

_Covers:_ 3. Temporal joins · 8. Stream-stream vs stream-table confusion

_From the 28 problems:_ 21-ad-click-aggregation

## Key Concepts

### The Problem

**1. Unbounded joins never finish.** A streaming join needs a time bound — a window or a table lookup — to decide when a match is complete.


### The Solution

A windowed join matches rows whose time attributes are within a window of each other.

```mermaid
flowchart LR
  C["clicks"] --> J{join window}
  I["impressions"] --> J
  J --> W{both watermarks pass?}
  W -->|yes| E[emit match]
  W -->|no| H[hold]
  L["late row"] --> R[retract + re-emit]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| 2. Windowed joins | A windowed join matches rows whose time attributes are within a window of each other. | Flink SQL interval joins are the production form. |
| 3. Temporal joins | A temporal join enriches each stream row with the table version current at its event time. | Flink SQL temporal joins against a changelog table. |
| 4. Join state | Join state buffers one side until the other catches up, bounded by the join window. | Flink holds the buffered side in managed state. |
| 5. Watermarks bound the wait | A join emits when both sides' watermarks pass the join window. | Flink SQL fires interval joins on the watermark. |
| 6. Late data and retractions | Allowed lateness keeps join state alive, and a corrected match retracts the old one before emitting. | Retract streams in Flink SQL correct emitted joins. |
| 7. Garbage-collect join state | Join state is garbage-collected when the watermark passes the window plus allowed lateness. | Flink cleans up interval-join state past the window + lateness. |
| 8. Stream-stream vs stream-table confusion | Join two streams with a window; join a stream to a table with a temporal lookup. | A common bug is a windowed join where a temporal lookup was intended. |


### Tradeoffs & When

- Join state is garbage-collected when the watermark passes the window plus allowed lateness.
- Join two streams with a window; join a stream to a table with a temporal lookup.


### Real-World Examples

- **Flink SQL** — Interval (windowed) joins and temporal joins
- **Apache Beam** — CoGroupByKey as the join primitive with windowing
- **ksqlDB** — Stream-stream and stream-table joins over Kafka


<details><summary>All concepts (index)</summary>

### Why: 1. Unbounded joins never finish

**Why.** Two unbounded streams have no natural join boundary, so a naive join buffers forever.

**Claim.** A streaming join needs a time bound — a window or a table lookup — to decide when a match is complete.

**Grounding.** The book's central streaming-join point is bounding the unbounded.

**In the wild.** Flink SQL requires an interval for stream-stream joins.

```mermaid
flowchart TD
  S(["<b>1. Unbounded joins never finish</b><br/>a matching key may arrive any time"]):::start
  A["<b>2. So a plain join waits forever</b><br/>and holds state without bound"]:::warn
  B["<b>3. The fix</b><br/>bound the wait with a window"]:::core
  C["<b>4. The cost</b><br/>state per key until the window closes"]:::step
  S -->|"1. which means"| A
  A -->|"2. hence"| B
  B -->|"3. paid as"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Stream-stream: 2. Windowed joins

**Why.** Two streams need a time window to bound which rows can match.

**Claim.** A windowed join matches rows whose time attributes are within a window of each other.

**Grounding.** The window bounds the buffer and the watermark bounds the wait.

**In the wild.** Flink SQL interval joins are the production form.

```mermaid
flowchart TD
  S(["<b>1. Windowed join</b><br/>stream-to-stream"]):::start
  A["<b>2. Shared time window</b><br/>both sides bounded by the same slice"]:::core
  B["<b>3. Emit at watermark</b><br/>with late updates after"]:::step
  C["<b>4. Use when</b><br/>two live streams must match in time"]:::warn
  S -->|"1. joins within a"| A
  A -->|"2. and"| B
  B -->|"3. i.e."| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Stream-table: 3. Temporal joins

**Why.** Enriching a stream against a slowly-changing table is a lookup, not a windowed match.

**Claim.** A temporal join enriches each stream row with the table version current at its event time.

**Grounding.** The table is finite per key, so no window is needed.

**In the wild.** Flink SQL temporal joins against a changelog table.

```mermaid
flowchart TD
  S(["<b>1. Temporal join</b><br/>stream-to-table"]):::start
  A["<b>2. Join against a version</b><br/>the table snapshot as of event time"]:::core
  B["<b>3. Enrichment pattern</b><br/>look up a user, product, or currency"]:::step
  C["<b>4. No window needed</b><br/>the table side is already state"]:::warn
  S -->|"1. it joins"| A
  A -->|"2. the classic"| B
  B -->|"3. so"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Buffer: 4. Join state

**Why.** Rows from one side must wait for their counterpart on the other side.

**Claim.** Join state buffers one side until the other catches up, bounded by the join window.

**Grounding.** The buffer is what makes a streaming join possible.

**In the wild.** Flink holds the buffered side in managed state.

```mermaid
flowchart TD
  S(["<b>1. Join state</b><br/>both sides held per key"]):::start
  A["<b>2. Until the window closes</b><br/>or the match is complete"]:::core
  B["<b>3. Keyed and partitioned</b><br/>state scales by key"]:::step
  C["<b>4. The risk</b><br/>unbounded state if never released"]:::warn
  S -->|"1. held"| A
  A -->|"2. it is"| B
  B -->|"3. with"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Signal: 5. Watermarks bound the wait

**Why.** The pipeline needs to know when no more matching rows will arrive for a time range.

**Claim.** A join emits when both sides' watermarks pass the join window.

**Grounding.** Completeness is bounded by the slower stream.

**In the wild.** Flink SQL fires interval joins on the watermark.

```mermaid
flowchart TD
  S(["<b>1. Watermarks bound the wait</b><br/>a window is matchable until it passes"]):::start
  A["<b>2. Then emit</b><br/>the join result for that slice"]:::core
  B["<b>3. Then release state</b><br/>the key's events can be dropped"]:::step
  C["<b>4. The dependency</b><br/>join correctness rides on the watermark"]:::warn
  S -->|"1. after which"| A
  A -->|"2. and"| B
  B -->|"3. so"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Correctness: 6. Late data and retractions

**Why.** A late row can arrive after a match was emitted and change it.

**Claim.** Allowed lateness keeps join state alive, and a corrected match retracts the old one before emitting.

**Grounding.** The same accumulation discipline as windows applies to joins.

**In the wild.** Retract streams in Flink SQL correct emitted joins.

```mermaid
flowchart TD
  S(["<b>1. Late data</b><br/>arrives after the watermark"]):::start
  A["<b>2. May change a join result</b><br/>a missed match, or a wrong one"]:::warn
  B["<b>3. Retractions</b><br/>withdraw the stale result, emit the corrected"]:::core
  C["<b>4. The cost</b><br/>downstream must handle withdrawals"]:::step
  S -->|"1. which"| A
  A -->|"2. handled by"| B
  B -->|"3. meaning"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Growth: 7. Garbage-collect join state

**Why.** A join buffer that never shrinks exhausts memory.

**Claim.** Join state is garbage-collected when the watermark passes the window plus allowed lateness.

**Grounding.** The window and allowed lateness together bound the state.

**In the wild.** Flink cleans up interval-join state past the window + lateness.

```mermaid
flowchart TD
  S(["<b>1. Garbage-collect join state</b><br/>drop it when it can no longer match"]):::start
  A["<b>2. After the watermark</b><br/>the window is closed"]:::core
  B["<b>3. Per-key cleanup</b><br/>release each key's buffered events"]:::step
  C["<b>4. The discipline</b><br/>no GC means unbounded memory"]:::warn
  S -->|"1. i.e."| A
  A -->|"2. done as"| B
  B -->|"3. because"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```
### Mistake: 8. Stream-stream vs stream-table confusion

**Why.** Applying the wrong join type produces unbounded buffers or wrong matches.

**Claim.** Join two streams with a window; join a stream to a table with a temporal lookup.

**Grounding.** The input type — unbounded vs finite-per-key — picks the join type.

**In the wild.** A common bug is a windowed join where a temporal lookup was intended.

```mermaid
flowchart TD
  S(["<b>1. Stream-stream</b><br/>two moving inputs"]):::start
  A["<b>2. Stream-table</b><br/>one moving, one at rest"]:::core
  B["<b>3. The confusion</b><br/>using a windowed join where a temporal join fits"]:::warn
  C["<b>4. The rule</b><br/>two streams - window; a table side - temporal"]:::step
  S -->|"1. vs"| A
  A -->|"2. avoid"| B
  B -->|"3. so"| C
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
```

</details>


## Quiz

1. Why do stream-stream joins need a time bound?

   - A. To save CPU
   - B. Two unbounded streams have no natural join boundary
   - C. To create watermarks
   - D. To reduce latency

<details><summary>Reveal answer</summary>

**B.** Without a time bound, a stream-stream join would buffer forever.

</details>

2. What is a windowed join?

   - A. A lookup against a table
   - B. A join matching rows within a time window of each other
   - C. A join with no state
   - D. A batch join

<details><summary>Reveal answer</summary>

**B.** A windowed join matches rows whose time attributes fall within a window.

</details>

3. What is a temporal join?

   - A. A join of two streams in a window
   - B. Enriching a stream against a table version current at event time
   - C. A join with no key
   - D. A join of two tables

<details><summary>Reveal answer</summary>

**B.** A temporal join probes a table at the join key for the current version.

</details>

4. When does a windowed join emit a match?

   - A. When the first row arrives
   - B. When both sides' watermarks pass the join window
   - C. Every second
   - D. When the buffer is empty

<details><summary>Reveal answer</summary>

**B.** The join waits until both streams are complete for the window.

</details>

5. How is join state bounded?

   - A. It is never bounded
   - B. By garbage-collecting past the window plus allowed lateness
   - C. By the CPU
   - D. By the number of keys

<details><summary>Reveal answer</summary>

**B.** State past the window + allowed lateness is garbage-collected.

</details>

