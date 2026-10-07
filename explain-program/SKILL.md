---
name: explain-program
description: Exhaustively annotate and explain a program with DEF/->/<- markers, concrete live values, per-line value-change comments, and multiple possible realities. Use whenever the user asks to explain code, write a full program, trace values, or walk through how a program works step by step.
---

# Explain a Program — Exhaustive Annotated Trace

When the user asks to explain a program, write a full program, or trace how code
works, produce an **exhaustive, value-annotated walkthrough**. Nothing may be
left undefined: every class, field, method, constructor, input, output, and
value change must be annotated.

## 1. Pick ONE concrete, named scenario

Never use `foo`/`bar`/`x`/`y`. Choose a real example and trace it end to end.
Distributed-systems examples work well because there are clear actors and
messages. **Give each party a DISTINCT id and never let two parties share an
initial** — `B1` (Buyer 1) vs `B` (Seller B) is ambiguous, so name the buyer
`U1` (or a real name) and add a one-line party legend (`U1 = buyer · A = Seller
A · B = Seller B`).

Example scenario: *"Leader A sends log entries 10, 11, 12 to Follower B over a
pipelined connection; B's Singular Update Queue appends them and ACKs."*

Trace **one full cycle** with concrete values (entry 10, correlationId=0,
body="append entry 10", byte[138]). For the subsequent iterations, use `alt:`
notes instead of repeating everything.

## 2. The annotation markers (use them on EVERY method and constructor)

```java
// DEF: <what this is / where declared> · CALLED BY: <who calls it>
// -> <param1> : <its live value now>
// -> <param2> : <its live value now>
//    <line-by-line value changes>
// <- <return value>   (or "void · SIDE EFFECT: ...")
```

Rules for each marker:

- **`DEF:`** — declare where the thing lives and who invokes it. Do this for
  classes, fields, methods, AND constructors.
- **`->`** — every input parameter, one line each, with its concrete value at
  entry. For a method reading from a socket/stream, write `-> (reads from socketInputStream)`.
- **`<-`** — the return value with its concrete value. For `void`, write
  `<- void` plus the side effect. For a constructor, write `<- a <ClassName> with <fields set>`.
- **Per-line `·`** — on every executable line, show the value change:
  `field : old -> new`, `list : [] -> ["entry 10"]`, `counter : 0 -> 1`,
  `socket buffer : [] -> [0,0,0,138]`.

## 3. Multiple possible realities

Where a value can differ across runs or calls, add `alt:` notes. Show at least
three realities when the user asked for them (e.g., 1st/2nd/3rd call, or
queue-has-room vs queue-full vs shutdown).

```java
request.correlationId = correlationId.getAndIncrement();
//    counter : 0 -> 1 · request.correlationId : 0 -> 0
//    alt 2nd call: counter 1->2, stamps 1 · 3rd call: counter 2->3, stamps 2
```

## 4. Every variable must have provenance

The user's standing rule: **never write into a variable without saying how it
came to exist.** For each variable, state where it is defined/created and what
its value is. A variable that appears in a snippet but is never defined is a
bug in the explanation — catch those before the user does.

## 5. Exhaustiveness checklist (must ALL be present)

1. Every class, field, method, AND constructor annotated.
2. No referenced-but-undefined method (e.g. if you call `socketWrite(...)`,
   `processResponse(...)`, `serialize(...)`, you MUST define them).
3. Byte-level input/output for `serialize`/`deserialize` (show the byte array
   contents conceptually: header + long + string).
4. A **final `->` / `<-` table**: one row per method/constructor with its inputs
   and outputs.
5. A **call graph**: who calls whom (e.g. `Main -> sendOneWay`, `run -> handler.apply`).
6. Optionally a **moment-in-time snapshot** showing every live thread and its
   local variables simultaneously (thread | executing | live local values).
7. **The wiring is code, not prose.** Every "who calls X?" answer must trace back
   to an actual annotated code line IN the program — including the code that
   CREATES and STARTS objects/threads (e.g. the accept loop that does
   `new SocketReaderThread(conn, server).start()`). A call-graph arrow is not
   enough; if the caller itself was never written, the program is incomplete.
8. **System placement.** Every class/component must be assigned to a concrete
   machine/process. Provide a placement table (see Section 12) BELOW the call
   graph, plus one high-level sentence naming the system roles involved
   (data servers, metadata servers, config servers, leader, follower, client).

## 6. Output structure

1. One-line scenario statement.
2. The full program, class by class, annotated inline.
3. The byte-level I/O note for serialize/deserialize.
4. The `->` / `<-` table for every method.
5. The call graph.
6. The system-placement table (BELOW the call graph).

## 7. Example (the exact format, compressed)

```java
static Object deserialize(byte[] b) {
    // DEF: Codec.deserialize · CALLED BY: readResponse() and readRequest()
    // -> b : byte[120]  (the serialized ACK)
    try (var ois = new ObjectInputStream(new ByteArrayInputStream(b))) {
        //    ois : wraps b (reads from memory, no socket)
        return ois.readObject();
        // <- RequestOrResponse(correlationId=0, body="ACK append entry 10")
    } catch (Exception e) { throw new RuntimeException(e); }
}
```

## 8. Do NOT

- Skip constructors, helper methods, or "stub" methods.
- Use meaningless variable names or leave a variable's origin unexplained.
- Mix reality values without labeling (`alt:`).
- Write a "full program" that omits the I/O framing, thread loops, or the wiring
  between classes.

## 9. Standard-library constructs must be explained UNDERNEATH

When the program uses a Java library construct and the user asks "what is this /
how is it implemented", explain both **how it's used here** AND **what it is
underneath**. Annotate it with the same DEF/->/<-/value-change markers.

### `Function<T, R>` (and any functional interface / lambda)

1. Map the concrete type parameters in THIS program:
   `Function<RequestOrResponse, RequestOrResponse>` — say which class is `T`
   (input) and which is `R` (output).
2. Show the interface: it has exactly ONE abstract method (`R apply(T t)`),
   marked `@FunctionalInterface`.
3. Show the implementation forms: lambda → desugared anonymous class →
   the JVM's `invokedynamic` + `LambdaMetafactory` generating a hidden class
   whose `apply` body IS the lambda body. Also mention method references.
4. Annotate the actual call:
   `-> req : <value> · <side effects> · <- return : <value>`.

### `CompletableFuture<T>` (and thread/executor questions)

1. State plainly: **it is NOT a thread.** It is a state machine + container.
2. Show the underlying implementation:
   - `volatile Object result` (null = not done, else value/AltResult);
   - a lock-free `Completion` stack of pending callbacks;
   - `complete(value)` = `compareAndSet` + `postComplete()` (first wins);
   - `get()` = `LockSupport.park` the *calling* thread (no internal worker thread);
   - `thenAccept` runs the callback on the completing thread; `thenAcceptAsync`
     runs it on the given executor.
3. Name the REAL threads: who calls `complete()`, who calls `get()`/registers
   callbacks, and which executor runs the callback.
4. Give the full lifecycle trace with concrete values.

### General rule

Any time the user asks about `Function`, `CompletableFuture`, `ExecutorService`,
`Thread`, `ArrayBlockingQueue`, `AtomicLong`, etc., do NOT just say "it's a
helper class" — show the fields, the single method/loop, the lock/CAS/park
mechanism, and annotate every value.

## 10. Handmade, and programmatically enforced (the two non-negotiables)

**1. Handmade, not automatic.** Every line of annotation is written out by hand
for THIS specific program and THIS specific trace. Values are chosen for the
concrete scenario, not copied from a template. Never emit a generic skeleton.

**2. No undefined symbol — ever.** Any identifier that appears in the code must
have a `DEF:` (or an explicit one-line explanation of what it is). This includes,
and is not limited to:
- fields, locals, parameters, and constants;
- static handles — `VarHandle`, `AtomicReferenceFieldUpdater`,
  `MethodHandles.Lookup` — and the `findVarHandle`/`static { }` block that
  defines them;
- every library call used (`compareAndSet`, `LockSupport.park`,
  `compareAndSet` on an `AtomicLong`, `ArrayBlockingQueue.put/poll`, etc.).

A line like `RESULT.compareAndSet(this, null, value)` is **not allowed** unless
`RESULT` was defined first. This is the exact class of gap the user keeps
catching; treat it as a defect.

**3. Programmatic self-audit — run it before finishing.** At the end of every
explanation, mechanically verify completeness and print the result:

1. Collect every identifier / `DEF`-able symbol that was referenced.
2. Assert each one has a `DEF:` (or an inline "what this is" line).
3. Assert every method AND constructor has `->` (inputs) and `<-` (output).
4. Assert every class in the program appears in the placement table (Section 12).
5. Assert every Mermaid diagram PARSES (run `mermaid.parse` on each; a broken
   diagram is a defect). **Always quote node labels** — unquoted `[` `]` `(` `)`
   inside a label breaks the Mermaid parser (e.g. write `Median["sorted[n/2]"]`,
   never `Median[sorted[n/2]]`). **Escape a literal `"` inside a label as
   `#quot;` — never `&quot;`** (GitHub HTML-decodes code fences before Mermaid
   sees them, so `&quot;` becomes a literal `"` and breaks the quoted label;
   `#quot;` has no `&` and survives, then Mermaid renders it back to `"`).
6. Assert every arrow carries a LABEL naming the relationship (R18): no bare
   `A --> B`. The label is the meaning — the "1000 words" the diagram conveys.
   `A -->|"grows into"| B` (or `A -- grows into --> B`) is shape + connection +
   meaning; `A --> B` is shape + connection with the point missing.
7. Print an audit line, e.g.:
   `AUDIT PASS: 14 methods, 27 symbols, 0 undefined, 9/9 classes placed, 7/7 diagrams parse, 0 bare arrows`
8. If any check fails, rewrite until the audit passes. Do not present an
   explanation with a failing audit.

The audit is the enforcement mechanism: it turns "nothing should be left
unattended" from a wish into a check that is reported to the user.

## 11. Worked example — the "undefined method / handle" gap (and how to handle it)

**The gap class:** writing a call like `postComplete();` or
`RESULT.compareAndSet(this, null, value)` in an explanation WITHOUT first
defining `postComplete` or `RESULT`. This is the exact defect the user
repeatedly catches. Treat every such call as a pending definition.

**The rule:** before the FIRST use of any method, field, or handle, give its
full definition with `DEF/->/<-/value-change`. When the user asks "what is X?",
answer with the complete definition — **including its prerequisites** (the
`VarHandle` it CASes on, the `Completion` node type it walks, the `static { }`
block that binds the handle).

**Concrete "before" (defective — never ship this):**

```java
boolean complete(T value) {
    if (RESULT.compareAndSet(this, null, value)) {  // <- RESULT is UNDEFINED
        postComplete();                              // <- postComplete is UNDEFINED
        return true;
    }
    return false;
}
```

**Concrete "after" (correct) — define the prerequisites first, then the method:**

```java
// Prerequisites — the two VarHandles, defined ONCE:
private volatile Object result = null;      // DEF: field · null = not done
private volatile Completion stack = null;   // DEF: field · callback stack

private static final VarHandle RESULT;      // DEF: handle bound to `result`
private static final VarHandle STACK;       // DEF: handle bound to `stack`
static {
    RESULT = MethodHandles.lookup().findVarHandle(CompletableFuture.class, "result", Object.class);
    STACK  = MethodHandles.lookup().findVarHandle(CompletableFuture.class, "stack",  Completion.class);
}

final void postComplete() {
    // DEF: CompletableFuture.postComplete · CALLED BY: complete() after the CAS
    // -> (none)
    //    pop the callback stack; run each callback inline (executor==null)
    //    or on its executor (executor!=null)
    // <- void · SIDE EFFECT: every callback is run or scheduled
}
```

Then close the loop with the full traced chain:

```
complete(value)
   └─ RESULT.compareAndSet(...)   // result : null -> ACK(id=0)
   └─ postComplete()              // stack : [cb1] -> null; cb1 scheduled on writerPool
        └─ writerPool thread -> conn.socketWrite(ACK)
```

**How the audit enforces it:** in the defective "before", `RESULT` and
`postComplete` appear as referenced symbols with no `DEF` → the Section 10
self-audit reports `AUDIT FAIL: 2 undefined symbols (RESULT, postComplete)` →
rewrite until the audit passes. Never present the explanation in that state.

## 12. System placement — which component lives on which machine

AFTER the call graph, add a **placement table** that assigns every class/component
to a concrete process, a system role, AND a tier term. Format:

| Component (class) | Process / machine | System role | Role term |
|---|---|---|---|
| ... | ... | ... | ... |

Rules:
1. **Every class in the program appears in at least one row.** If a class is in
   the program but missing from the placement table, the audit fails.
2. **Name the process concretely**, e.g. `Leader node (data server A)`,
   `Follower node (data server B)`, `Core leader (metadata server C1)`,
   `Client (browser/app)`, `Config server`.
3. **One high-level sentence above the table** states the systems involved and
   their roles — explicitly say which machines are data servers, which are
   metadata servers, which are config servers, and which are clients. If a
   system type is NOT present (e.g. no metadata server in this program), say so.
4. **Tag every row with its tier term** in the `Role term` column, using ONE
   consistent vocabulary:
   - metadata / config / core servers → `leader` or `followers` (chosen by Raft/Paxos);
   - data servers → `master` or `slave` (replication / task ownership);
   - a data server talking to the core → `client` (it may be a master or slave);
   - a component present on ALL core nodes → `leader + followers`.
   Never use `leader` for a data server or `master` for a core node. The two
   tiers are terminologically separate: **leader/follower for metadata,
   master/slave for data.**

Example (leader/follower replication):

> Data servers A and B hold the application data; this program has no
> metadata/config servers.

| Component | Process / machine | System role |
|---|---|---|
| `LeaderMain` | Leader node — data server A | data server (replication leader) |
| `PipelinedConnection`, `ResponseThread` | Leader node — data server A | transport + ACK reader on the data server |
| `FollowerBootstrap` | Follower node — data server B | data server (follower) |
| `FollowerServer`, `SingularUpdateQueue`, `ClientConnection`, `SocketReaderThread` | Follower node — data server B | receiver logic on the data server |

And if the Consistent Core / metadata server IS involved, the table must show
which classes run on the 3–5 metadata servers vs which run on the data servers,
e.g.:

| Component | Process / machine | System role |
|---|---|---|
| `ConsistentCoreClient`, `WatchClient` | data server (client) | data server — client of the core |
| `CoreServer`, `ReplicatedLog`, `LeaseTracker`, `KeyToConnection` | metadata server (core leader/follower) | metadata server — the 3–5 node core |

The audit's placement check: **every class in the program must appear in the
placement table**, and the high-level sentence must name the system roles.

## 13. Concept / study-guide blocks: an execution trace, never a definition list

When the "program" is annotated pseudocode for a CONCEPT — a data structure,
algorithm, or protocol, e.g. a study-guide `/explain-program` block — the same
rules apply with one extra hard constraint:

**A block that only names concepts is a defect.** A sequence of `// DEF: x ·
CALLED BY: y` lines plus a few `->`/`<-` markers is a *definition list*, not an
explanation. The reader learns the names but never sees the mechanism run, and
terms get *mentioned* without ever being *defined* ("sparse index" with no
definition). This is the exact failure the user catches, over and over.

Root cause (recurred across an entire corpus): the exemplars were themselves
definition lists, the prompt asked for "DEF/->/<- markers" rather than a
simulated run, and the gate checked that *some* value exists somewhere rather
than that a value *flows* through the steps. All three must be fixed.

### The execution-trace standard (every concept block MUST)

1. **Simulate one real run** — initialize the concrete data structures with
   concrete values, push ONE concrete input through them, show the state at
   each step, emit the concrete output.
2. **Define every term at first use, with its concrete instance.** Never write
   `sparse index` without saying what it is AND what it holds right now:
   `// DEF: sparse index — an in-memory map of the FIRST key of each block ->
   that block's offset; here {"handbag"->0, "handsome"->4096}`.
3. **Every `DEF:` carries inline concrete values** (numbers/quoted). A DEF with
   no value is a name, not a definition.
4. **Number the execution** with `step 1 ·`, `step 2 ·`, … and show the value
   changing on each step (`//    bits : [0,0,0] -> [0,0,1]`).
5. **`->` = concrete input, `<-` = concrete output**, both carrying values.
6. **Show interconnections** — each step names which structure it reads/writes.
7. **Demonstrate, don't assert.** When a line names a mechanism — "the PK is
   the idempotency guard", "the unique constraint dedups", "the nonce ties the
   webhook back" — show the ACTUAL operation that performs it, with concrete
   values. `INSERT ... ON CONFLICT (order_id) DO NOTHING` → the 2nd INSERT hits
   the existing key and returns the row unchanged. The reader must see the
   guard WORK (the operation, the key collision, the concrete no-op), not just
   be told it exists. An assertion with no demonstrated mechanism is a gap.

Gold exemplar (this is the bar — not optional):

```java
// DEF: SSTable — an immutable file on disk whose keys are SORTED, split into fixed 4 KB blocks
//    block 0 @0 = "handbag,42|handball,7|handbook,12|handiwork,55" · block 1 @4096 = "handsome,3|handy,9"
// DEF: sparse index — in-memory map: FIRST key of each block -> block's offset (1 per block, not 1 per key)
// -> sparse_index : {"handbag" -> 0, "handsome" -> 4096}
// DEF: lookup · CALLED BY: GET("handiwork")
// -> key : "handiwork"
//    step 1 · binary-search sorted index keys : "handbag" <= "handiwork" < "handsome" -> block 0
//    step 2 · seek to offset 0, scan block 0 in sorted order
//    step 3 · "handbag,42" -> "handball,7" -> "handbook,12" -> "handiwork,55"
// <- value : 55 at offset 34 (3 comparisons + one 4 KB block read, NOT a full scan)
```

### The mechanical gate (run it; a failing block is not done)

- **R1** — every `// ->` / `// <-` line carries a concrete value (number,
  "quoted", or `= value`). A bare label is a defect.
- **R2** — every standalone `// DEF:` block contains a concrete value.
- **R3** — the block has >= 4 concrete-value lines.
- **R4** — the block has >= 3 value-transformation lines: a ` -> ` arrow
  carrying a concrete value on a NON-input/output line (`//    x : old -> new`).
  This is the check that forces the *how*, not just the *what*.
- **R5** derivation · **R6** causality · **R7** state · **R8** no dangling
  handle · **R9** demonstrate-don't-assert — described in the sections below.
- **R10** — distinct party ids: a single-letter id (`A`, `B`) must never be a
  prefix of a longer id (`B` the seller vs `B1` the buyer is ambiguous). Give
  each party a distinct, prefix-free id and a one-line party legend.
- **R11** — declared-entity closure: every account/entity a mutation references
  (in `| account | signed-delta |` rows) must be declared with its initial
  value, and its full `old -> new` shown — a debit like `buyer_escrow -30.00`
  must be paired with `buyer_escrow : 0.00 -> -30.00` and a `buyer_escrow :
  0.00` state line. A delta with no from-state is a gap.
- **R12** — container ≠ concept: declaring a data structure is not defining the
  concept it holds (`spans : []` does not define *span*); define every
  non-generic stem at first use with a concrete value.
- **R22** — no Big-O / complexity notation: a concept block must NOT contain
  `O(...)`, `O(1)`, `O(n)`, `O(runs)`, "time complexity", "space complexity",
  or `cost O(...)` phase labels. The reader wants the logic of the values, not
  asymptotic bounds — state the concrete step count instead ("one division +
  one array read + at most B = 2 forward steps", never `O(1)`).
- **R23** — every derived value is expanded to a worked example: a derivation
  `= a × b` must name what each operand IS and where it came from
  (`bits = 3 * 3 = 9 BECAUSE 3 pairs, each length stored in 3 bits since the
  longest run 5 = binary 101`), and an array/index built from the inputs must
  show each entry's derivation row by row (`block 3 = rows [6,7] -> run 1
  BECAUSE 5 <= 6 < 7`). A number that appears with no worked origin is a defect.
- **R24** — motivation before mechanism (the goal, the why, who chose the
  constant): a block that builds an index/data structure must, BEFORE the first
  build step: (1) state the GOAL in one line — the question the structure
  answers ("which code is at row N?") plus the naive way it replaces ("walk the
  runs, 1 step each"); (2) give every new structure a WHY clause at first use
  that names the work it removes ("WHY blockRun exists: starts alone still needs
  a halving per comparison…"); and (3) label every tunable constant with WHO
  chose it and why that value (B = 2 is the index builder's choice for an 8-row
  worked example, not a property of the data; production uses 1024/4096). A
  structure whose contents are derived but whose purpose is never stated is a
  defect — the exact "what is blockRun and why do we need it" gap.
- **R25** — the WHY clause's step-count claim must be worked, not asserted: when
  a WHY line claims a lookup costs a fixed number of steps ("one division + one
  array read + at most B forward steps"), it must (1) name the problem statement
  ("which run holds row N?"); (2) walk the SAME concrete query through each
  stage so the intuition is visible — naive (0+5=5, 5+2=7 -> 2 additions),
  intermediate (compare 6 vs starts[1]=5 then starts[2]=7 -> 2 halvings, ~20 for
  a million runs), final (6 div 2 = 3 -> block 3; blockRun[3] = 1 -> run 1;
  starts[2] = 7 > 6 -> stop); and (3) state WHY the bound is what it is in words
  ("a block spans B rows so it crosses at most B runs; blockRun names the run of
  the block's first row, so the true run is at most B-1 = 1 further right"). A
  step-count with no intuition behind it is a defect — the exact "what is the
  intuition, why did we reach this step" gap the user flagged on the blockRun line.
- **R26** — a rendered diagram's geometry is measured, never eyeballed: any SVG
  (or other generated figure) that ships beside a concept block must come from a
  GENERATOR, not from hand-placed coordinates, and the generator must enforce:
  (1) ONE fixed canvas (e.g. 960x540) that nothing may leave; (2) every
  coordinate an INTEGER derived from named grid seeds — reject a non-integer at
  the point it is computed, so two runs are byte-identical (verify: regenerate
  and diff the checksum); (3) every magnitude derived from one seed, including
  the numbers quoted in the captions, so the picture cannot contradict the prose.
  Hand-tuned nudges ("+3 to make it line up") are the defect this prevents — they
  are invisible until a value changes and the whole figure shifts.
- **R27** — TEXT is part of the geometry, not decoration: the recurring failure
  is a generator that validates boxes but never strings, so a caption silently
  runs off the canvas and the build still passes. SVG has no layout engine, so
  the generator MUST: (1) model advance width per font family
  (`width = chars x size x ratio`, monospace ~0.60, sans ~0.58 as an UPPER bound)
  and register every string as a real box beside the rectangles; (2) WRAP long
  strings to a bounded line count and FAIL when the budget is exceeded, rather
  than letting them overflow; (3) validate ACROSS bands, not just within one —
  checking only same-band pairs is what lets a footer label straddle a panel it
  was never compared against. The three checks are: **rect vs rect** may never
  overlap; **text vs rect** is fine when the label is fully INSIDE the box and a
  defect when it crosses the edge; **text vs text** may never collide.
  - **Mutation-test the checker before trusting it.** A geometry validator that
    has never failed is indistinguishable from one that cannot fail. Deliberately
    inject (a) an over-long caption and (b) a displaced grid origin, and confirm
    each makes the generator exit NON-ZERO. Restore, then regenerate.
  - **Render and measure; do not trust the model that produced the bug.** After
    generating, rasterize a frame headlessly and find the lowest inked pixel row,
    then compare it to the canvas height. Beware the capture itself: an
    exact-size window clips, which looks identical to a layout bug — re-render in
    a LARGER viewport before concluding the figure is broken.
- **R28** — a trace step must show its TEST, never only its RESULT. Caught in
  review: `step 3 · forward 1 -> run 1`. That line is unreadable unless you
  already know the algorithm — it never says WHAT moves, BY HOW MUCH, or ON WHAT
  TEST. Every `step N` line must carry three things: (1) the QUESTION it answers,
  in words ("does run 2 begin at or before row 10?"); (2) the CONCRETE comparison
  ("starts[2] = 16 > 10"); (3) the CONCLUSION drawn ("-> no, so row 10 is in run
  1"). A result with no visible test is the defect, even when the result is right.
- **R29** — when a structure is LAYERED on another, name the index domain, the
  derivation, and the division of labour. Caught in review: `starts` and
  `blockRun` render as two similar strips of small integers, so a reader cannot
  tell them apart or see why both exist. Three sentences are mandatory:
  (1) **what each is indexed BY** — "starts: one entry per RUN (5 runs);
  blockRun: one entry per BLOCK (8 blocks)" — two integer arrays look
  interchangeable until their domains are named; (2) **how the new one is
  DERIVED from the old** — "blockRun[k] is the cached answer to searching starts
  for block k's first row"; (3) **why the older one SURVIVES** — "blockRun only
  reaches the run the block BEGINS in, and a B-row block can spill into later
  runs, so starts is what finishes the lookup". Omitting (3) is the common case:
  the reader assumes the new structure replaced the old one.
- **R30** — the worked example must DISCRIMINATE the right model from a plausible
  wrong one. This is the subtlest failure in the whole skill, and it is invisible
  to the author. Found by a first-time-reader audit: the RLE column used codes
  0,1,2,3,4, so run *i* held value *i* — which made `blockRun = [0,0,0,1,2,2,3,4]`
  character-for-character identical to "the code stored at each block's first
  row". A reader holding that WRONG model computed the right answer at every
  step and was never corrected. The example confirmed the misreading instead of
  breaking it. Requirements: (1) choose data where the structure's stored values
  DIFFER from their own indices, from their own second field, and from any other
  array on screen — here codes became 3,11,20,27,31 so the answer (11) visibly
  disagrees with blockRun[2] (0); (2) state the disagreement out loud in the
  final step ("note 11 is NOT blockRun[2] = 0"); (3) treat any two concepts that
  render as the same numerals as a defect, because nothing on screen can separate
  them. **A self-check the reader cannot fail is not a self-check.**
  - **The same trap applies to a WORKED CASE, not just the dataset.** Audit 3
    caught "the last starts entry <= 8 is starts[0] = 0, so blockRun[2] = 0": the
    entry's value (0) and its index (0) are the same number, so the example never
    reveals which of the two is stored. Every rule must be worked at least twice,
    and at least one case must be NON-DEGENERATE — here `starts[2] = 16 ->
    blockRun[5] = 2`, where 16 and 2 visibly differ.
  - **Exercise the boundary of every operator you state.** `<=` that is never hit
    at equality is indistinguishable from `<`; a bound of "at most B-1 advances"
    that no example approaches is unverifiable. Pick data that forces the
    equality case and the worst case to actually occur.
- **R31** — a rule that indexes `arr[i+1]` must say what bounds the LAST element.
  Found by the same audit: "run i owns rows [starts[i], starts[i+1])" left the
  final run unbounded, so every query in the last 6 of 32 rows — a sixth of the
  data — was undefined by the stated rule, and the scan had no stopping test
  there. Add the sentinel (`starts` gains a final entry = the row count) and say
  it is a sentinel, or state the boundary case explicitly.
- **R32** — discrimination must be PROVEN, not hoped for. R30 says the example
  must rule out wrong models; R32 says you may not assert that it does. Write the
  correct rule as code, write each plausible WRONG rule as code, evaluate BOTH
  over exactly the evidence the material prints, and fail the build if any wrong
  rule reproduces every printed number. This turns "a careful reader might
  notice" into a decision the machine makes. Three consequences:
  (1) **the catalogue is append-only** — every misreading a reader reports is
  added as a model, so it can never recur silently; (2) **only PRINTED evidence
  counts** — a worked case you left out cannot discriminate, which is what makes
  the check honest; (3) **a survivor names its own cure** — search the input
  space for the first case where correct and wrong disagree, and report it
  ("decode row 9: correct 1, this model 0"), so the fix is mechanical too.
  Reference implementation: `tools/discriminate.js`. Validate it by replaying the
  OLD material: if the tool does not fail on the defect a human already found, it
  is not evidence.
- **R33** — ONE seed per concept, imported, never copied. The self-confirming
  example survived three review rounds because every artifact carried its own
  copy of it: the diagram, the animation, the prover and the prose block each
  hardcoded the numbers. Four copies are four chances to drift, and the prover
  only ever checked one of them. Put the example in a single module that every
  artifact imports, and assert the discriminating properties AT LOAD TIME so a
  bad seed cannot even load. Reference: `tools/rle_seed.js`, which rejects a seed
  when any of these holds — run values equal their indices; a value equals a
  length; values collide with the row/index ranges; values form an arithmetic
  progression (the reader can then compute the value and never learns the
  lookup); no run is shorter than the block size (so the walk can never show two
  advances); the index mentions every run (so it looks one-per-run); no query
  hits a boundary at equality (so `<=` is indistinguishable from `<`); no worked
  case has a block spanning two runs (so "begins in" cannot be told from "ends
  in"). The original example fails EIGHT of these.
- **R34** — give every DOMAIN a disjoint numeral range. This is the root
  generator of "the reader misunderstood". In the defective example `0`, `1` and
  `2` were simultaneously a value, a run index, a block index, a row number and a
  run length, so a bare numeral on screen could be five different things and no
  amount of rewording fixed it. Choose data so each domain is separable on sight:
  here values are all > the row count (41, 58, 63, 79, 86), rows and starts are
  0..32, run indices are 0..4 and written `r0..r4`, block indices 0..7 written
  `b0..b7`. Then a bare number above 32 is ALWAYS a stored value, never an index.
  Where two domains must share a range (run vs block indices), give them typed
  prefixes so a bare number never stands alone. Watch the near-miss: values
  40,50,60,70,80 are disjoint from every other domain but form a progression, so
  the reader computes `value = 40 + 10*index` and never learns the lookup — which
  is why R33 tests for that too.
- **R35** — every identifier a program listing USES must be DEFINED in that
  listing, before first use, and this is CHECKED, not read for. §10 has said "no
  undefined symbol — ever" from the start, and a listing still shipped using
  `nRows`, `nRuns`, `lastIdx`, `Index`, `len` and `maximalRuns` with none of them
  declared — because reading for it does not work and the teaching gate only
  inspected SUBSCRIPTED names in prose, so bare identifiers and calls were
  invisible to it. Publish the listing as data (`source.json`) and run a symbol
  checker over it (`tools/symbol_gate.js`): collect definitions
  (`type N { fields }`, `fun f(params)`, `val`/`var` including destructuring,
  loop variables), collect every used identifier, and fail on any that is
  undefined or defined later than its use. An assumed builtin is NOT an
  exemption: declare it explicitly with `// primitive: len(xs) — …` so the
  assumption is visible to the reader instead of hidden from the checker.
  Mutation-test both directions: delete a definition, and move one below its use.
- **R36** — a listing must LOOK like code, and its highlights must be addressed
  by CONTENT. Use real constructs (`fun`, `val`/`var`, `type`, braces, spaces
  around operators) so the reader's eye parses it as a program, not as prose.
  Two mechanical consequences: (1) SVG collapses whitespace, so a code listing
  needs `xml:space="preserve"` or its indentation silently flattens and the block
  structure disappears; (2) never point a step's highlight at a LINE NUMBER —
  address it by a substring of the line (`at('while (r + 1 < nRuns')`) and throw
  if it is not found, so editing the listing can never leave a highlight quietly
  pointing at the wrong line. **The needle must be UNAMBIGUOUS: matching zero
  lines and matching several are both errors.** `findIndex` silently takes the
  first hit, which is how `'maximalRuns'` highlighted the primitive comment
  instead of the for-loop, and `'starts.append(acc)'` the wrong one of two
  identical statements. Make the checker throw on >1 match and report every
  matching line, so the fix is to pick a unique needle (`'        starts.append(acc)'`
  with its indent) rather than to hope.
- **R37** — show the CALLER, with the actual arguments it sends. A listing that
  begins at the callee leaves the reader to imagine where the values came from,
  and the stack panel's bottom frame then appears from nowhere. Include a `main`
  (defined LAST, so define-before-use still holds) that does the real call with
  the real values, and annotate what it passes:
  `val index = buildIndex(codes, 4)   // sends codes@0x100, B=4`. On a call step,
  highlight BOTH the caller's line and the callee's signature — that pairing is
  what makes "a frame is pushed, and these are its parameters" visible rather
  than asserted.
- **R38** — when one concept is taught by several artifacts (a prose program
  block, a visual walkthrough, a memory walkthrough), they must state the same
  facts, and that agreement is CHECKED. A shared seed is not enough: it aligns
  the numbers, but each artifact still writes its own sentences and its own
  labels, so one can contradict another — or quietly stop mentioning a fact —
  with no generator noticing. Extract each fact (the arrays, the block size, the
  run pairs, every decoded answer) from every artifact and compare
  (`tools/sync_gate.js`). Three rules make the comparison honest:
  (1) **stating nothing is not passing** — report "not stated" distinctly from
  "ok", because a dash that looks neutral is how an unchecked artifact passes;
  (2) **a construction animation is a time series** — its intermediate frames
  legitimately differ from the final value, so check that every state is a
  PREFIX of the final one and that the final one is actually reached, rather
  than comparing every frame to the end state;
  (3) **a deliberate contrast is not a contradiction** — "a real index uses
  B = 1024" must not be read as disagreeing with B = 4; exclude the lines that
  are explicitly about production alternatives.
  Mutation-test both directions: make one frame disagree, and make a
  construction never reach its final value.
- **R39** — an animation must have a VALID STATIC FORM, and it must be checked by
  rendering it without its animation. The natural way to build a step animation
  is one group per step, all `opacity="0"`, each revealed by `<animate>`. That
  file has NO correct static rendering, and the two ways it degrades are both
  silent: a renderer that strips `<animate>` but keeps the attribute shows a
  BLANK canvas; one that also normalises the attribute away composites EVERY step
  on top of one another, which is what makes text appear to cross its panel even
  though every individual frame is perfect. Sanitisers, thumbnailers, static
  viewers and print all hit one of these paths. Fix: give the FIRST step no
  opacity attribute so it is visible by default, and start its animation at 1 —
  then stripping the animation yields exactly frame 1. Check it: strip
  `<animate>`, render, and assert the ink bounding box EQUALS frame 1's
  (`verify_diagram.py --fallback`). Mutation-test both degradations.
  **Per-frame geometry checks cannot catch this** — every frame was individually
  valid; the defect only exists in the composite, so it needs its own check.
- **R40** — a caption may not assert a PAYOFF the reader cannot check. Caught in
  review: *"From here the column at 0x100 is never touched again — that is what
  the index bought."* Never touched by WHOM — by `decode`, for this query, or
  ever? Bought against WHAT alternative? Both halves are unfalsifiable from
  anything on screen. Write it so the reader can confirm it: name the agent, say
  where to look, and give the comparison —
  *"decode's body, lines 39-46, mentions runs, starts and blockRun but never
  codes, so answering row 23 reads 0 of the 32 stored values, where scanning the
  column from row 0 would read 24."* Cite line numbers DERIVED from the listing
  (`lineOf('fun decode')`), never typed by hand.
  - **Captions need their own gate.** T1 only inspects lines beginning
    `step N ·`, so every claim in free prose went unchecked for the whole life of
    this skill. Extract the captions and check them separately.
  - **Keep the rule NARROW.** A first attempt flagged every `never`/`only` and
    buried the real defect in false positives — "blockRun only reaches the run a
    block begins in" is precise and gives its reason immediately. Target the
    actual construction: a payoff with no agent and no comparison
    (`that is what … bought`, `never touched again`, `the whole point`). Verify
    BOTH directions: the vague sentence fails, and a precise sentence using the
    same words passes.
  - **Check the whole caption, not each sentence.** Captions are wrapped for
    layout; splitting them separates a claim from the evidence in the next
    clause and invents defects that are not there.
- **R41** — a declared primitive must be SHOWN, not only described. R35 lets an
  assumed builtin be declared (`// primitive: maximalRuns(codes) — (value,
  length) per maximal stretch of equal values`) so nothing is silently assumed.
  But a description still leaves the reader guessing at the shape of the result:
  does it return pairs, two arrays, an iterator? Every primitive therefore
  carries a worked call beside it, derived from the seed:

  ```
  // primitive: len(xs) — element count.  len([41,58,63]) = 3
  // primitive: readColumn() — the stored column, sorted.
  //   readColumn() = [41,41,41,41,41,41,41,41,41,58,…]   (32 values)
  // primitive: maximalRuns(codes) — (value, length) per maximal
  //   stretch of equal values.
  //   maximalRuns([41,41,41,58,58]) = [(41,3), (58,2)]
  ```

  One sentence says what it is; one call says what it returns. The example uses
  the seed's own values so it cannot drift, and a SHORT input so it is obviously
  an illustration rather than the real column.
  - **Warning, and it bit immediately:** an illustrative call introduces values
    that look like the real data. `maximalRuns([41,41,41,58,58]) = [(41,3),
    (58,2)]` made the cross-artifact checker read `(41,3)` as the first run.
    A checker must extract the CANONICAL presentation (the labelled `r0 = (41,9)`
    form, or the heap row) rather than every parenthesised pair it can see.
  - **And never keep only the first value per key.** Collecting `r0..r4` by first
    occurrence hid a later frame that contradicted an earlier one; the gate must
    keep every stated value per key and report the conflict
    ("r2 is stated as (63,5) and (63,4)").
- **R42** — start from the REQUEST, not the structure. R24 already demands a GOAL
  line, and that is where this skill quietly failed for a long time: the GOAL was
  written at the level of the data structure — *"answer 'which code is at row
  N?'"* — and **nobody ever asks that**. It is an internal question. A reader who
  accepts it still cannot say what is being queried, why a row position matters,
  or what the mechanism contributes. Quote the real request VERBATIM before any
  mechanism step, then decompose it and say which part this artifact implements:

  ```sql
  SELECT sum(clicks) FROM events WHERE campaign = 41
  ```
  > value → positions: `WHERE campaign = 41` must become row positions (the sorted
  > column makes them one range). position → value: read the other columns at
  > those positions. **This artifact implements the second.**

  The test: if the GOAL question is one only the implementation would ask, it is
  an internal step and needs the caller's question above it. Gate: `T9` fails a
  stepped artifact with no user-level request, or one that states it AFTER the
  first step.
- **R43** — place the artifact among its siblings, and state the invariant that
  binds them. A mechanism is almost never alone: it is one of several structures
  that cooperate, and the reader cannot reason about anything outside the one
  being drawn unless you say what the others do and what keeps them consistent.
  Name (a) the sibling structures and the DIRECTION each provides, and (b) the
  invariant that lets them compose. Here: `codes` is one of many column files;
  the invariant is POSITIONAL — the i-th entry of every column belongs to the
  same record — and it is what makes a position found in one column read the
  right value in all the others. Its consequence must be stated too: a column is
  therefore never sorted alone; the sort key's permutation is applied to every
  column at once, so only the sort-key column ends up with long runs.
  **Symptom that this is missing:** the reader asks a question about the
  relationship rather than the mechanism — *"if I sort one column, what happens
  to the others?"* That question is always the material's fault, not the
  reader's.
- **R44** — the INSTANCE comes before the ABSTRACTION. R42 fixed *that* the
  request must be shown; this fixes *how*. The first attempt at a "why this
  exists" preamble satisfied R42 — it quoted the SQL — and the reader still
  called it "one of the worst explanations", correctly. It opened with a
  comparison table of "two different directions", named a `clicks` column whose
  values never appeared, used a range `[0, 9)` that was never derived, and
  referred to a GROUP BY that was not in the query shown. **A reader cannot check
  a generalisation they have not yet seen an instance of.** Order it:
  1. **Show the data.** The actual rows, both columns, with row numbers above
     them. Nothing is named that is not visible.
  2. **State the request**, verbatim.
  3. **Walk it on that data**, with the real numbers: "rows 0 to 8", "100, 800,
     600, … adds to 4500".
  4. **Only now name the pattern**, and say which part this artifact is.
  5. **Then the consequence** — what breaks if you ignore it.

  Gate `T10` fails a preamble whose comparison table or "two directions" phrasing
  appears before any concrete data block, or that generalises with no data at all.
  - **A table is a summary, not an introduction.** It belongs after the reader has
    followed one instance, as a recap — never as the opening move.
  - **Every noun in the preamble must already have values on screen.** Mentioning
    `clicks` before showing a single clicks value is the same defect as using an
    undefined symbol (R35), just in prose.
- **R45** — state the LIFECYCLE: when it is built, from what, and what is true
  before and after. Every artifact here drew the STEADY STATE — a finished,
  sorted, immutable segment — and none drew the lifecycle that produces it. The
  reader's question was the natural consequence: *"are we sorting during insert
  time only?"* If you only ever show the finished structure, a reader will
  reasonably assume it is maintained per row, per insert. Name four things:
  (1) **what arrives**, and in what order (usually: unsorted, one row at a time);
  (2) **where it waits** before the transformation (a mutable buffer);
  (3) **the moment it happens** — at seal/build/write time, over a BATCH, once;
  (4) **what is true afterwards** — immutable, never re-sorted, and a later
  arrival goes to the NEXT unit, not into this one.
  Gate `T11` fails material that describes a built structure without saying when
  it is built.
- **R46** — state the SCOPE: what this does NOT help, and what serves that
  instead. The same reader asked *"can I randomly query on another value?"*,
  because the material said sorting makes the lookup cheap and never said which
  queries do NOT get that path. **An unbounded benefit reads as a universal
  one.** State: which predicate shape gets the fast path; which do not; what
  serves them instead (name the sibling index and its chapter); and the cost
  paid for the win. Here: the sort key is chosen from the expected query
  pattern, but it never limits what can be asked — only the sort-key column ends
  up with equal values adjacent, every other column sits in sort-key order which
  from its own point of view is arbitrary, and a filter on it uses that column's
  own index or scans. Gate `T12` fails a claimed fast path with no stated limit.
  - **Both rules are about the axis a steady-state drawing cannot show: TIME on
    one side, and the COMPLEMENT of the benefit on the other.** R24/R42 ask what
    it is for, R43 asks what its siblings are; neither asks when it comes into
    existence or what it fails at. Those two questions must be answered in every
    chapter, not just where a reader happens to trip.
- **R19** concrete input dataset · **R20** downstream state chain · **R21**
  cross-references — described in the flow-section trace section below.
- **R13** — concrete datastore placement: a database/store named in a PARTIES
  line must name its engine AND instance (PostgreSQL 16 @ orders-db-1), because
  e.g. the outbox INSERT must share the one instance whose COMMIT it rides.
- **R14** — read + write path coverage (chapter-level): a chapter with a program
  must show data being WRITTEN (created/stored) AND READ back (queried/served).
  A write-only chapter hides how its store is consumed; a read-only chapter
  hides how its store was populated.
- **R15** — no bare black-box component: a PARTIES symbol must be DEFINED as a
  system component, not just a box. A value that names only a container
  (`instance`, `node`, `unit`, `server process`, `component`) with no role noun
  (writer/broker/collector/aggregator/reader), no engine, no `@instance`, no
  parenthetical is a tautology — it names the box, not the concept. This is the
  exact "what is Zipkin / where does RabbitMQ sit" gap.
- **R16** — system-design decomposition (chapter-level): every chapter with a
  program must carry a `systemDesign` section that (1) names the pipeline roles
  (`pipeline`), (2) decomposes each major component into its internals
  (`decomposition[].parts`, ≥2 parts), (3) draws the wiring as a connected
  mermaid `flowchart` (`wiring`), and (4) annotates the wiring with the
  explain-program markers (`program`). Naming a component is not defining it;
  defining it is not wiring it.
- **R17** — the system-design question (chapter-level): every chapter that has a
  `systemDesign` section must OPEN it with the interview question being solved —
  the problem, the use case, and the premise (`systemDesign.question`). A
  pipeline that jumps straight to the boxes never says what we are trying to
  solve; the question must come out first.
- **R18** — diagram meaning (diagram-level, enforced by `tools/validate_mermaid.js`):
  every Mermaid arrow must carry a label that names the relationship — the
  SHAPE (each node is a named concept/component) + the CONNECTION (an arrow) +
  the MEANING (the label says WHY they connect). A bare `A --> B` shows the
  boxes and the line but never says what connects them; the label is the
  "1000 words" the diagram must convey on its own. Before shipping a diagram,
  ask: *does this picture explain itself to someone who never read the prose?*
  If an arrow has no label, the answer is no. (A partonomy — a component
  decomposed into its parts — is labeled `-->|"comprises"|`, which is the one
  truthful relationship for that shape.)

### Read + write path: every chapter covers both directions

A chapter that explains a data lifecycle must trace BOTH halves, not just one.
A write-only explanation shows spans/rows/events being created and stored but
never answers "how does anyone read this back?"; a read-only explanation shows
a query/search but never "how did this store get populated?".

- **Write path** — data created/stored: mint the id, open the span, INSERT the
  outbox row, publish the event, `store : {} -> {k: v}`.
- **Read path** — stored data queried/served back to a consumer: operator
  queries Zipkin by trace_id, the relay SELECTs the outbox, a query serves the
  materialized view, `matches : [] -> [line, line]`.

For distributed tracing, the write path is mint → open → inject → report →
store; the read path is operator → query Zipkin by trace_id → reassemble the
spans by parent+start → timeline → find the slow hop. A trace-store block that
stops at "4 spans collected" hides the read; finish it with the query-back.

Gate **R14** enforces the mechanical floor: a chapter with a program must
contain at least one write signal (mint/open/insert/publish/store) and at least
one read signal (query/search/read/return). The semantic half — that the SAME
store that is written is the one read back — is the author's responsibility:
after writing the block, walk the round trip once and make sure the written
data is served back to a named consumer.

### System-design wiring: every component defined AND connected

This is the **centerpiece of every chapter** — the System Design Interview view.
R14 covers *within* a block; the system-design layer covers *between* the
blocks. Every chapter must answer, at the system level, how its components are
**exhaustively connected** — not just complete, not just adjacent. Naming a
component is not defining it, and defining it is not wiring it; all three must
hold. The decomposition is drawn as a tree (ASCII or Mermaid — Mermaid is
preferred so it renders on GitHub), and then the SAME paths are re-described in
program notation: DEF/->/<- markers, concrete values, and the concrete instance
each component is (`@ zipkin-db-1`, queue `"zipkin"`).

The one pipeline every data-system chapter traces is:

```
writer  ->  transport  ->  collector  ->  aggregator/store  ->  reader
```

- **Writer** — the process that produces/emits the data (each instrumented
  service reporting its span, the producer publishing an event).
- **Transport** — the hop that decouples writers from the collector and buffers
  under load (RabbitMQ, Kafka). It is a distinct component, NOT part of the
  aggregator.
- **Collector** — the process that ingests from the transport (Zipkin's
  collector consuming spans off the queue).
- **Aggregator/store** — where the data is accumulated and persisted, named as
  engine AND instance (MySQL 8 @ zipkin-db-1 = the trace store).
- **Reader** — the consumer that pulls data back out (Zipkin query UI serving a
  timeline to an operator).

Four obligations, per named component:

1. **Define WHAT it is** — never `ZIP = Zipkin server process` (a bare box). Say
   `ZIP = Zipkin distributed tracing system = collector (ingests spans from BRK)
   + storage — the trace store (MySQL 8 @ zipkin-db-1) + query UI (serves
   timelines to OP)`.
2. **Assign WHERE it sits** — which pipeline role (writer/transport/collector/
   aggregator/reader), and which machine/instance (`@ zipkin-db-1`).
3. **Wire it in** — show the value crossing the boundary: `span : open -> on the
   wire to BRK (transport hop 1)` then `trace_store : {} -> {...}`. A component
   named but never touched by a value flow is a prop, not a participant.
4. **Draw the connection** — the flow diagram and the interview-question diagram
   must show the SAME pipeline (Writers → RabbitMQ transport → Zipkin collector
   → trace store MySQL 8 aggregator → Zipkin query UI reader → operator), so the
   system-level wiring is the answer to "how are these connected?", not prose.
5. **Decompose the internals** — a box is not enough even when named. Open each
   major component and list its internal subcomponents, each with its role. The
   two canonical Zipkin decompositions:
   - the server: `Zipkin server (one central process, NOT per-host)` →
     `Collector — ingests spans` · `Storage — MySQL 8 @ zipkin-db-1 / Cassandra /
     Elasticsearch` · `Query API — GET /api/v2/traces/<id>` · `UI — Zipkin Lens`;
   - the writer: `each service process` → `Tracer — mints ids, propagates B3/W3C
     headers` → `Reporter — batches finished spans` → `Sender — HTTP / Kafka /
     RabbitMQ`.
   The interview answer to "what IS Zipkin?" is the first tree; the answer to
   "where does RabbitMQ sit?" is that the Sender (in-process, in each service)
   publishes to the broker, which the Collector consumes — there is NO per-host
   agent/daemon in core Zipkin.

Every chapter carries this in a dedicated `systemDesign` field:

```js
systemDesign: {
  question: 'Design a real-time click dashboard. Use case: ops watches live clicks-per-minute. Premise: the producer stamps event time, but the network delays events, so the dashboard must bucket by event time, not processing time.',
  pipeline: 'writer → transport → collector → aggregator/store → reader',
  decomposition: [
    { box: 'each service process — the writer', role: 'writer',
      parts: ['Tracer — ...', 'Reporter — ...', 'Sender — ...'] },
    { box: 'RabbitMQ broker — the transport', role: 'transport',
      parts: ['queue "zipkin"', 'buffers under load'] },
    { box: 'Zipkin server (one central process, NOT per-host)', role: 'collector + aggregator/store + reader',
      parts: ['Collector — ...', 'Storage — MySQL 8 @ zipkin-db-1 ...', 'Query API — ...', 'UI — ...'] },
    { box: 'operator — the reader', role: 'reader', parts: ['queries a trace id', 'finds the slow hop'] }
  ],
  wiring: 'flowchart LR ...',   // the connected pipeline mermaid diagram
  program: `// SYSTEM DESIGN — ...`  // annotated trace of one item crossing every hop
}
```

Gate **R15** enforces the mechanical floor: a PARTIES value that names only a
box (`instance`, `node`, `server process`, `component`) with no role noun,
engine, `@instance`, or parenthetical is flagged as a black-box tautology. Gate
**R16** enforces the system-design floor: a chapter with a program must have a
`systemDesign` section with a `pipeline` line, at least one component decomposed
into ≥2 internals, a connected mermaid `wiring` diagram, and an annotated
`program`. **R17** enforces the question: a chapter that has a `systemDesign`
section must open it with `systemDesign.question` (the problem, use case, and
premise) before the pipeline or boxes appear. **R18** (enforced by
`tools/validate_mermaid.js`) enforces diagram meaning: every Mermaid arrow must
carry a label naming the relationship, so each diagram conveys shape +
connection + meaning on its own — a bare `A --> B` fails, and a component
decomposition into parts is drawn as `R -->|"comprises"| P0`. The semantic half —
that every
named component is actually *wired* by
a value flow into the writer→collector→aggregator→reader pipeline, and that the
roles are the chapter's real roles (not a forced five for a concept with no
transport) — is the author's responsibility: after writing the chapter, walk one
item end to end and name each hop it crosses. If an item never crosses the
transport or is never read back, the wiring is incomplete.

### Numerical consistency: one seed, everything derived

A block must tell ONE consistent story with its numbers. Every size/count is
either a declared seed (with its source) or derived from a prior value with the
arithmetic shown. A block that says `4 KB block` in one line and `256 MB file`
in the next, with no derivation between them, is a defect — the reader cannot
see how the system scales from one to the other. Show the chain explicitly:
`a freshly flushed SSTable = 256 MB = 65,536 blocks x 4 KB (256 MB / 4 KB =
65,536)`, then reuse those numbers downstream (`4 x 256 MB -> ~898 MB`, `L0 =
256 MB -> L1 = 2,560 MB -> L2 = 25,600 MB`). Do NOT pick each number as an
independent illustration; pick one seed and derive the rest from it.

Gate **R5** enforces the mechanical part: a size-bearing block must contain at
least one explicit `= a × b` / `= a / b` derivation. The semantic part — that
the WHOLE block uses one seed and every magnitude follows from it — is the
author's responsibility; walk the size/count chain once before shipping and
make sure no number jumps units without a `=` — and when a derivation CHANGES
units (count→bytes, KB→MB, s→min), show the conversion factor explicitly
(`315_360_000_000 entries/year · at ~1 byte/entry = ~315 GB`), never
`entries = GB` with the multiplier hidden. Verify every arithmetic step
manually: percents, negative signs, exponents (`2^53`), ranges (`0–999`),
modular math (`(17+9) mod 21 = 5`), and thousand separators all break naive
auto-checkers, so the author must confirm each `=` computes.

### Causality: every change must state WHY it changes

A size/count that *changes* must name its cause, not just its math. "4×256 MB →
898 MB" without a reason is incomplete; "…→ 898 MB **BECAUSE** the merge is the
union of 4 files' keys, minus ~12% dropped overwrites/tombstones" is complete.
Same for levels: "L1 = 2,560 MB **BECAUSE** each level holds 10× the previous
(level-size ratio = 10)". Gate **R6** checks the mechanical proxy (a
size-bearing block must contain a causal connective: `BECAUSE`, `the ratio`,
`is the union`, `merges into`, `causes`, `since it`).

### No Big-O — explain the values, not the asymptotics

A concept block describes a MECHANISM, and the reader is learning the logic of
the values — how each number is reached and what it defines. Big-O notation and
"time complexity" / "space complexity" talk do NOT belong in a study-guide
block. Remove `O(1)`, `O(runs)`, `O(n/B)`, `cost O(...)` phase labels, and the
whole `COMPLEXITY:` section. Replace them with the concrete step count the
reader can follow: "one division + one array read + at most B = 2 forward
steps" instead of `O(1)`. If a bound matters, state it as a concrete number,
never `O(...)`. Gate **R22** forbids `O(` and the words "time complexity" /
"space complexity" in a program block.

### Every value is derived to a worked example

`= a × b` alone is not enough. Each derivation must name what `a` and `b` ARE
and where they came from, and each constructed array/index must show its
entries row by row. The defect this fixes is the "magic value" gap: `bits = 3 *
3 = 9` leaves the reader asking "what are the two 3s?", and `blockRun =
[0,0,0,1]` leaves them asking "how was this derived?". The fix:

```
//    derivation : bits = 3 * 3 = 9   BECAUSE 3 pairs, each run length stored in 3 bits (longest run 5 = binary 101)
//    build 4b · for each block of B = 2 rows, find the run that holds its FIRST row -> blockRun : [] -> [0,0,0,1]
//       block 0 = rows [0,1] -> first row 0 -> run 0   BECAUSE 0 <= 0 < 5
//       block 1 = rows [2,3] -> first row 2 -> run 0   BECAUSE 0 <= 2 < 5
//       block 2 = rows [4,5] -> first row 4 -> run 0   BECAUSE 0 <= 4 < 5
//       block 3 = rows [6,7] -> first row 6 -> run 1   BECAUSE 5 <= 6 < 7
```

Gate **R23** checks the mechanical proxy (a derivation line must pair `= a op b`
with a `BECAUSE` naming the operands; a constructed index must show at least
one entry's per-row derivation). The semantic bar is the author's: walk every
number once and make sure the reader can see where it came from.

### Motivation before mechanism — the goal, the why, and who chose the constant

Deriving every value is necessary but not sufficient. A block whose values are
all reached correctly can still be unreadable if it never says what the whole
thing is FOR. The reader's first three questions — "what is the end goal?", "why
does this structure exist?", and "where did this constant come from?" — must be
answered BEFORE the build, not left implicit. The fix has three parts:

1. **GOAL line first.** Open with the question the structure answers and the
   naive way it replaces: "answer which code is at row N — the naive walk is 1
   step per run, so 3 million runs = 3 million steps." Without this, every
   structure reads as an object built for its own sake.
2. **WHY clause on every new structure.** A DEF that says what a thing IS
   (`run-start offsets = [0,5,7]`) must also say what it REMOVES ("without it,
   finding the run is a walk over the runs"). This is the R12 container≠concept
   rule applied to purpose, not just value.
3. **WHO chose the constant.** A tunable that appears in INPUTS (B, block size,
   fanout, bucket count) is a design parameter chosen by the builder, not a
   property of the data — say so, and give the worked-example value vs the
   production value (B = 2 for an 8-row example; 1024/4096 in real columns).
4. **The WHY clause's step-count is itself worked.** A WHY line that promises a
   fixed-cost lookup ("one division + one array read + at most B forward steps")
   must not stop at the promise. Walk the same query through each stage with
   concrete numbers — naive cumulate (0+5=5, 5+2=7 -> 2 additions), then starts +
   halving (6 vs starts[1]=5, 6 vs starts[2]=7 -> 2 comparisons, ~20 for a
   million runs), then blockRun (6 div 2 = 3 -> block 3, blockRun[3] = 1 -> run
   1, starts[2] = 7 > 6 -> stop) — and then state the bound's reason in words: a
   block is B rows, so it crosses at most B runs, and blockRun already names the
   run of the block's first row, so the answer is at most B-1 = 1 run further
   right. The reader must see the intuition behind each step in the count, not
   just the count. This is the exact gap the user flagged on the blockRun line.

Gate **R24** checks the mechanical proxy (a goal line before the first build
step; a WHY clause on each introduced structure; a WHO-chose line on each tunable
constant). The semantic bar is the author's: read the block as someone who has
never seen the concept, and confirm they learn the point of each structure
before they see its arithmetic.

### The connected-trace template (start every concept block from this)

```
// DATA SERVER SIDE — <ONE scenario, one seed>
// GOAL (what this is FOR): answer "<the question>" — and the naive way it replaces:
//    <naive approach = 1 step per unit; the structure below removes that walk>
// DEF: <seed> — <what it is> = <value> · <source/reason>
//    <why this seed>
// DEF: <any new structure/constant> — <what it is> = <concrete instance>
//    WHY it exists: <the work it removes> — if it promises a step-count ("1 div + 1 read + at most B forward steps"),
//       work that count with the SAME query: naive <0+5=5, 5+2=7 -> 2 steps> -> intermediate <6 vs starts[1]=5, starts[2]=7 -> 2 halvings>
//       -> final <6 div 2 = 3, blockRun[3] = 1, starts[2] = 7 > 6 -> stop> · WHO chose <the constant>: <builder, why this value here vs production>
//
// DEF: <step 1> · CALLED BY: <caller>
// -> <input> : <value>   (comes from <seed / prior step>)
//    step 1 · <mechanism> : <before> -> <after>   BECAUSE <cause>
//    <derived> = <seed/prior> x|/ <factor>   (<why this factor>)
// <- <output> : <value>   (feeds <step 2>)
//
// DEF: <step 2> · CALLED BY: <...>
// -> <input> : <step 1's output>
//    step 2 · ...   BECAUSE <cause>
// <- <output> : <value>   (feeds <step 3>)
//
// <- FINAL : <value> — the full chain: seed -> step1 -> step2 -> ...
```

The three connective rules, applied on every block:
1. **Provenance** — every `->` input is labeled with where it came from (the
   seed or the previous step's `<-` output); AND every produced value is shown
   being consumed/stored — a value that appears and is never used again is a
   **dangling link** (e.g. a token that is received but never written to a row
   or passed on). Each input must also show its correlation key (e.g. the
   nonce that ties a token and a webhook back to the same row).
2. **Derivation** — every size/count after the seed is written `= prior ×/÷
   factor`, with the factor's reason.
3. **Causality** — every change (`old -> new`) carries `BECAUSE <mechanism>`.

A block that satisfies provenance + derivation + causality cannot have a value
"appear from nowhere" and cannot have a change whose reason is unexplained.

### The stateful-trace template (declare the state, then mutate named rows)

When the program reads/writes **tables or named data structures**, the state is
part of the explanation — an identifier like `EV-1001` that is not grounded in a
declared row is a defect (the reader cannot see the table it belongs to). The
fixed order is:

```
// SCENARIO — one end-to-end story, established UP FRONT (who, what, one seed)
// SCHEMA   — the tables/structures: columns, types, PK, FK (—> = foreign key)
//   payment_events(event_id TEXT PK, buyer_id TEXT, amount DECIMAL(10,2), status ENUM(...))
//   payment_orders(order_id TEXT PK, event_id TEXT —> payment_events.event_id, ...)
//   relationship : 1 payment_event —< N payment_orders · ...
// STATE (before) — the concrete rows/values, so every id is grounded
//   payment_events : [EV-1001 | B1 | 49.99 | NOT_STARTED]
//   wallet_balances: [A | 0.00] · [B | 0.00]
//
// PROGRAM — the trace; every mutation names table[row].column
//    step 1 · payment_orders[PO-2001].status : NOT_STARTED -> SUCCESS   BECAUSE ...
//    step 2 · ledger_entries += [1 | PO-2001 | buyer_escrow | -30.00]
//
// STATE (after) — the changed rows
//   payment_orders[PO-2001].status = SUCCESS · wallet_balances[A] = 30.00
```

Enforcement (gate **R7**): a program that references a row/record id must
declare its schema/state (a `SCHEMA`/`STATE` block, or the equivalent
`structure = {concrete values}` declaration) BEFORE the first mutation, and
each `old -> new` mutation must name `table[row].column` (or
`structure.field`). Establish the whole end-to-end scenario in the SCENARIO
line first — never introduce it mid-trace.

**Provenance, derivation and causality STILL hold inside this template** — it
adds state on top of them, it does not replace them. Every `table[row].column
: old -> new` mutation still carries `BECAUSE <cause>` (R6); every size/count
is still derived `= prior ×/÷ factor` (R5); every input is still labeled with
its origin, and every term is defined at first use (R1/R2). The four rules
together — provenance, derivation, causality, state — are the complete bar;
check all four on every block.

### The flow-section trace (the gold format for study-guide `flow[].program` blocks)

Every study-guide chapter's `flow[].program` block is a **one-queue execution
trace**, not a diagram. It must render, top to bottom, as:

1. **The concrete input dataset FIRST** — show the actual records the trace
   consumes, as an append-only queue with offsets (or named records). The
   reader must see the data the computation runs over, not an abstract "input".
2. **Numbered steps in two columns** — `step N · <mechanism> ... -> <value>`,
   each step naming the value it reads and the value it writes.
3. **A final downstream state chain** — one line carrying the consumer's state
   across the whole trace (`C1 : 2 -> 0 -> 3`), so the reader sees the net
   effect, not just the individual steps.
4. **Provenance, derivation, causality, and state still apply** — every value
   is grounded (R1/R2/R7), every change carries `BECAUSE` (R6), every size is
   derived `= a ×/÷ b` (R5), and a keyed lookup is shown as reading `state[key]`,
   never as a re-scan of the queue (the queue is immutable history; the state
   store is the running fold).

Gold exemplar (the bar — not optional):

```text
SELECT campaign, COUNT(*) FROM clicks
GROUP BY TUMBLE(event_time, INTERVAL '5' MINUTE), campaign
======================================================================
offset 0: {campaign:"C1", ts:"12:01"}
offset 1: {campaign:"C1", ts:"12:02"}
offset 2: {campaign:"C2", ts:"12:03"}
offset 3: {campaign:"C1", ts:"12:04"}   <- about to arrive
======================================================================
step 1 · read the key on the record        -> key = "C1"
         (no scanning — the key is in the payload)
step 2 · route by key                      -> the record goes to the slot that owns state["C1"]
step 3 · look up the previous value        -> state["C1"] = 2
         (one keyed lookup, not a walk back to offset 0)
step 4 · fold                              -> new = 2 + 1 = 3
         state["C1"] : 2 -> 3
step 5 · accumulate-and-retract emit:
         RETRACT ("C1", 2)                 -> downstream undoes the old total
         ADD     ("C1", 3)                 -> downstream applies the new total
======================================================================
C1 : 2  ->  (retract 2)  ->  0  ->  (add 3)  ->  3
```

Gates:

- **R19** — concrete input dataset: a flow `program` block must show the input
  records it consumes (≥2 offsets or ≥2 named records) BEFORE the first step,
  so the trace starts from a concrete queue, not an abstract "input".
- **R20** — downstream state chain: the block must END with one line carrying
  ≥2 `->` arrows (`X : a -> b -> c`), showing the downstream state change
  across the whole trace — the net effect, not just the steps.
- **R21** — cross-referencing (chapter-level): when a chapter mentions a
  concept whose full treatment lives in ANOTHER chapter, it must carry a
  `seeAlso` entry linking to that chapter (number + what's covered + the
  section/card), so a shallow mention always points to its depth and the
  bigger picture holds no matter the reading order. Rendered as a
  `## See also` section (and inline pointers on the flow sections that touch
  the concept). Never leave a shallow mention without a pointer to the depth.

### Formatting pitfalls (all observed in production; all must be handled)

- Source blocks are JS template literals, so the program text must contain NO
  raw backtick and NO `${`. A markdown `` `code` `` inside a program must be
  written as a quoted literal (`"from"`) instead.
- Key/title strings mix single-quoted JS (`section: '…'`) and double-quoted JSON
  (`"section": "…"`), and titles encode dashes as `&mdash;`/`&ndash;`/`—`/`--`
  and apostrophes as `\'`. When matching, try all quote variants, escape/unescape
  apostrophes, and entity-decode before comparing against rendered headings.
- Consecutive `DEF:` lines each need their own inline value — do not open a
  value-less DEF and "define it" on the next line; fold the definition into the
  first DEF with its concrete params.

## 14. Reference implementation — generated diagram geometry (R26/R27)

A working generator that satisfies R26/R27 lives at
`olap-system-design-study-guide/tools/gen_rle_diagram.js`. Start from it rather
than re-deriving; it is the shape every diagram generator should have.

```js
// 1. SEEDS — every magnitude below derives from these, nothing is hand-picked.
const W = 960, H = 540;            // the one canvas
const CELL_W = 26, CELL_H = 30, N_ROWS = 32, B = 4;
const GRID_X = (W - N_ROWS * CELL_W) / 2;   // integer by construction

// 2. RECTS register themselves and reject non-integers at the source.
const rect = (band, x, y, w, h, opt = {}) => {
  if (![x, y, w, h].every(Number.isInteger)) throw new Error(`non-integer: ${band}`);
  boxes.push({ band, x, y, w, h });
  return `<rect .../>`;
};

// 3. TEXT is measured, boxed and registered exactly like a rect (R27).
const RATIO = { mono: 0.602, sans: 0.58 };            // UPPER-bound em advance
const textW = (s, size, mono) => Math.ceil(s.length * size * (mono ? RATIO.mono : RATIO.sans));
const text = (x, y, s, opt = {}) => {
  const w = textW(s, size, mono);
  const x0 = anchor === 'middle' ? Math.round(x - w / 2) : Math.round(x);
  boxes.push({ band: 'txt:' + band, x: x0, y: Math.round(y - size * 0.82),
               w, h: Math.round(size * 1.18), kind: 'text', s });
  return `<text .../>`;
};
// wrapText() breaks on spaces to a pixel budget; exceeding maxLines is a FAILURE,
// never a silent overflow.

// 4. VALIDATE ACROSS BANDS — the check that catches the real bugs.
//    rect vs rect : never overlap
//    text vs rect : fine when fully INSIDE, a defect when it crosses the edge
//    text vs text : never collide
//    plus: nothing may leave the WxH canvas
// Exit non-zero on any finding, so a bad figure cannot be committed.
```

**The two verification steps that are not optional:**

```bash
# (a) mutation-test the validator — it must FAIL on injected defects
#     inject an over-long caption      -> expect exit 1
#     displace the grid origin         -> expect exit 1
# (b) render and measure the real output, don't trust the metrics
google-chrome --headless --window-size=1200,900 --screenshot=f.png file://frame.svg
#     find the lowest inked pixel row and compare against H.
#     NOTE: an exact-size window CLIPS the capture, which is indistinguishable
#     from a layout bug — always re-render larger before declaring a defect.
```

**Determinism check:** regenerate and compare checksums. If two runs differ, a
float or an iteration order leaked into the geometry — fix that before shipping.

## 15. "How do we guarantee the teaching never fails?"

Answer honestly first: **you cannot prove comprehension mechanically.** Geometry
is decidable — a pixel is inside the canvas or it is not. Understanding is not.
Any claim of a 1000% guarantee would be false, and promising one is itself a
failure mode, because it stops you building the thing that actually helps.

What IS achievable, and what this section requires:

> **Every failure class that has ever been observed becomes mechanically
> impossible to ship again, and an independent reader — not the author — is what
> finds the classes nobody has named yet.**

Four layers, in order. None is optional.

**L0 — the discrimination prover (PROACTIVE: catches the unknown class).** Added
after a human reader found, three rounds running, defects the gate could not see.
L1 only blocks classes someone already named; L0 does not need the class to be
named at all. Given the correct rule as code and a catalogue of wrong rules as
code, whether the printed evidence separates them is DECIDABLE:

```
for each wrong model W:
    if evidence(W) == evidence(correct):   # same answers on everything shown
        FAIL — the material cannot teach the right model
        search inputs for the first case where they differ, and report it
```

Run it in the pre-commit hook so it BLOCKS. Proof it works: replayed against the
original material it fails, and names "decode row 9: correct 1, this model 0";
against the corrected material, 9/9 wrong models ruled out. **Every finding from
L2 becomes a MODEL in L0's catalogue, not just a lint rule in L1** — a model
generalises to inputs nobody thought to check, a lint rule does not.

**L1 — mechanical gate (catches the KNOWN classes).**
`tools/teaching_gate.js` is the reference implementation. One rule per failure
actually caught in review, never speculative rules:

| Rule | Catches | Observed as |
|---|---|---|
| T1 | a step stating a result with no question and no test | `step 3 · forward 1 -> run 1` |
| T2 | bare directional shorthand | `forward 1`, `advance 2` |
| T3 | a subscripted structure used before it is introduced | `blockRun[2]` before blockRun exists |
| T4 | coexisting structures with no index domain, derivation, or division of labour | `starts` vs `blockRun` |
| T5 | a non-discriminating example: stored values equal their own index, or two concepts render as the same numerals | codes 0,1,2,3,4 made `blockRun` identical to "the value at each block start" |
| T6 | a rule indexing `[i+1]` with no stated bound on the last element | `starts[i+1]` undefined for the final run |
| T7 | a degenerate worked case whose value equals its result, so it decides nothing | "`starts[0] = 0`, so `blockRun[2] = 0`" — value and index coincide |

**L2 — independent first-time-reader audit (finds the UNKNOWN classes).**
The author cannot run this: knowing how it works is exactly what hides the gap.
Hand the *rendered artifact only* — never the generator — to a reader with no
prior exposure, and require:
  1. a line-by-line pass asking, for each line, "can this be understood using
     ONLY what earlier lines established?";
  2. a **transfer test** — pose a case the material never walks through (we
     walked row 10; ask them to decode row 21 unaided). Passing the worked
     example proves recall; only the unseen case proves the mechanism landed;
  3. BLOCKERS reported as exact quotes with the minimal fix.
**Every blocker it returns must become a new L1 rule before the fix ships.**
That is the ratchet: the suite only grows, and no class recurs twice.

**L3 — mutation-test the gate itself.** A teaching gate that has never failed is
indistinguishable from one that cannot. Re-run it against the ORIGINAL defective
wording and confirm it fails; keep that wording as a fixture. When this was done
here it exposed three bugs in the gate: `->` contains `>` and faked a comparison,
HTML entities hid the arrows, and `run i = [...]` was misparsed as an array named
`i`. A gate you have not attacked is not evidence.

**The standing rule.** When a reader says "this part is confusing", the fix is
never only to reword that line. It is: reword it, name the failure class, add the
L1 rule, **add the misreading to L0's wrong-model catalogue**, add the old wording
as a mutation fixture, and re-run L2.

**Make the gates blocking, and make editing a gate re-run the gates.** An audit
you choose to run is a habit, not a guarantee. Wire L0/L1/L3 into the pre-commit
hook, and include the gate files themselves in the hook's trigger pattern —
otherwise weakening a checker slips through unexamined. This was a real defect
here: the first blocking test passed because editing `discriminate.js` did not
match the hook's file pattern. A wording fix
alone means the same class returns in the next chapter.

## 16. The generated-diagram pipeline, end to end

Everything below is one chain: a change to the seed regenerates the artifacts,
and every gate below must pass before it can be committed. No step is advisory;
all of them are wired into `.git/hooks/pre-commit`, and the hook's trigger pattern
includes the gate files themselves, so weakening a checker re-runs the checks.

> **Do not hand-count the gates here.** This paragraph read "eight independent
> gates" while the table listed eleven and the suite ran seventeen — R49 in this
> document's own prose. The authoritative list is `tools/verify_all.sh`; run it
> and read the printed count. The table below says what each gate DECIDES, which
> is the part prose is actually good for.

```
rle_seed.js ──► gen_*_diagram.js ──► frames/*.svg + animated .svg + embed.md
   │                                        │
   │                                        └──► to_markdown.js ──► docs/*.md
   │                                                (chapter declares
   ▼                                                 walkthroughs: [...])
 asserts the example is DISCRIMINATING
```

| Gate | Tool | What it decides |
|---|---|---|
| seed | `rle_seed.js` | the example can teach the rule (R30/R33/R34); a bad seed cannot even load |
| discrimination | `discriminate.js` | the printed evidence rules out every catalogued wrong model (R32) |
| symbols | `symbol_gate.js` | every identifier in a listing is defined before use (R35) |
| teaching | `teaching_gate.js` | the trace explains itself (T1–T7) |
| geometry | the generator | integer grid, measured text, nothing straddling or off-canvas (R26/R27) |
| pixels | `verify_diagram.py` | the RENDERED output is not clipped — guard band + tripwires |
| static form | `verify_diagram.py --fallback` | stripping `<animate>` yields exactly frame 1, not blank or a composite (R39) |
| embeds | `check_embeds.js` | every declared walkthrough really appears in its doc |
| program | `explain_program_gate.js` | R1–R6 on the prose blocks |
| sync | `sync_gate.js` | prose, diagram and memory walkthrough state the same facts (R38) |
| request | `teaching_gate --only=T9` | the user-level query is shown BEFORE the mechanism (R42) |
| callables | `callable_gate.js` | every `fun`/primitive is shown by a worked call OR stepped into (R55) |
| stack | `stack_gate.js` | every local the listing has declared appears in its frame (R54) |
| markup | `html_gate.js` | generated tags/SVG roots parse; no unescaped quote, `<`, `\|` or backtick (R56) |
| band honesty | `check_band_honesty.js` | a `DIAGRAM`/`PROGRAM` band has the artifact it names, or is a counted debt (R48) |
| block shape | `check_block_shape.js` | WHY → WHEN → DIAGRAM → PROGRAM, in order, none empty |
| one dataset | `check_dataset.js` | every chapter uses the same rows |
| one dictionary | `check_consistency.js` | one value→code mapping across the whole book |

**The PROGRAM band is a kit, not a copy.** `tools/memkit.js` renders the
source/stack/heap shell for every concept: it derives canvas height from the line
count AND panel width from the longest measured line, throws on a highlight needle
matching zero or many lines, wraps heap values to a measured box, and refuses to
write an embed with no steps. Writing that shell by hand a third time is how the
typed-canvas and ambiguous-highlight defects came back.

**Four rules the pipeline exists to enforce, each learned from a real failure:**

1. **One writer per artifact.** `to_markdown` owns `docs/`; generators emit
   `embed.md` and never splice into docs. Two writers meant a regeneration
   silently deleted 28 images, and the generators reported "markers not found"
   as a note rather than an error.
2. **Declare, then check.** A chapter lists its `walkthroughs`; a declared one
   with no `embed.md` is fatal. Anything merely conventional gets skipped
   eventually.
3. **Address by content, never by position.** Line numbers, evidence lists and
   file-pattern triggers all drift. Substring lookups that throw when unmatched
   do not.
4. **A skip must never look like a pass.** Every "left untouched" / "markers
   absent" / "pattern did not match" path must exit non-zero. Three separate
   defects in this session were skips reported as successes.
5. **Never remap by chained text replacement.** Rewriting `[1]→[14]` and then
   `[14]→[29]` over the same buffer makes the first rule's OUTPUT the second
   rule's INPUT, so a step silently acquires another step's line. This is how
   "allocate runs" ended up highlighting a line inside `decode`. Rewrite keyed by
   something stable (the step's title), or build the new structure rather than
   editing the old one in place.

### Thinking ahead: the four questions to answer BEFORE writing a step

Every gap a reader has found here was one of these, unasked. Answer them in this
order, at the top of the artifact, and the reader can build the relationships as
they go instead of reverse-engineering them at the end.

1. **What did the caller actually ask?** The real request, verbatim (the SQL, the
   API call). Not the internal question — the one a human types. (R42)
2. **What are the parts of answering it, and which part is this?** Decompose into
   directions or phases, name the structure that serves each, and point at the
   one being taught. (R42)
3. **What else is there, and what keeps it consistent with this?** The sibling
   structures, and the invariant that binds them — positional identity, an
   ordering, a shared key. State the consequence of the invariant, not just the
   invariant. (R43)
4. **What breaks if this piece is missing?** The naive path costed at the QUERY
   level, not at the structure level — "24 rows scanned" beats "a linear walk".
   (R24/R25)
5. **When does this come into existence, and from what?** Arrival order, the
   buffer it waits in, the moment of the transformation, and what is immutable
   afterwards. A steady-state drawing cannot answer this, and the reader will
   assume "per insert" unless told. (R45)
6. **What does it NOT help, and what serves that instead?** The predicate shapes
   that miss the fast path, the sibling index that serves them, and the cost paid
   for the win. (R46)

### Every failure this pipeline has actually caught, in order

Each was found by a reader or a gate, never by re-reading my own work. Each is
now mechanically blocked; the list is the regression suite.

| # | Failure | Now blocked by |
|---|---|---|
| 1 | caption ran off the canvas (text was never measured) | measured text + wrap budget (R27) |
| 2 | a label straddled a panel it was never compared against | cross-band validator (R27) |
| 3 | a truncated screenshot read as a clean guard band | viewport calibration + tripwires (R27) |
| 4 | SMIL seek silently did nothing, so per-step checks verified nothing | `--union` verification (R27) |
| 5 | `forward 1 -> run 1` stated a result with no test | T1/T2 (R28) |
| 6 | two indexes with no index domain, derivation or division of labour | T4 (R29) |
| 7 | the example CONFIRMED a wrong model (values equalled indices) | seed assertions + prover (R30/R32/R33) |
| 8 | `starts[i+1]` undefined for the last run | T6 (R31) |
| 9 | a worked case whose value equalled its own index decided nothing | T7 (R30) |
| 10 | one numeral meant value, index, block, row and length at once | disjoint domains (R34) |
| 11 | values in arithmetic progression let the reader skip the lookup | seed assertion (R33) |
| 12 | regenerating docs silently deleted 28 embedded images | single writer + `check_embeds` |
| 13 | `nRows`, `nRuns`, `lastIdx`, `Index`, `len`, `maximalRuns` undefined | `symbol_gate` (R35) |
| 14 | SVG collapsed the listing's indentation | `xml:space="preserve"` (R36) |
| 15 | a highlight pointed inside the wrong function | content addressing, ambiguity = error (R36) |
| 16 | the caller and its arguments were never shown | `main` with real arguments (R37) |
| 17 | artifacts could drift apart in what they assert | `sync_gate` (R38) |
| 18 | the animation had no static form: blank, or all 16 steps composited so text crossed its panel | `--fallback` check (R39) |
| 19 | captions asserted payoffs with no agent and nothing to check them against | T8 on extracted captions (R40) |
| 20 | primitives were described but never shown, so their return shape was a guess | worked call per primitive (R41) |
| 21 | a checker kept only the first value per key, hiding a later contradicting frame | conflict reporting in `sync_gate` (R41) |
| 22 | the GOAL was an internal question ("which code is at row N?") with no caller | T9: request before mechanism (R42) |
| 23 | one column was drawn with no statement of what binds it to the others | sibling + invariant (R43) |
| 24 | the "why" preamble led with a comparison table before showing any data | T10: instance before abstraction (R44) |
| 25 | only the steady state was drawn, so sorting looked like a per-insert operation | T11: lifecycle (R45) |
| 26 | a fast path was claimed with no statement of which queries miss it | T12: scope (R46) |
| 27 | a gate was aimed at the generators' own output, so it could not fail on the source it was supposed to check | R47: aim every gate at the source of truth |
| 28 | a band said `DIAGRAM` / `PROGRAM` over a paragraph — the label named an artifact that did not exist | R48: band honesty + a counted pending ledger |
| 29 | a hand-written list of files to check went stale the moment a 3rd existed, and reported 3/3 while checking 2 | R49: glob, never enumerate |
| 30 | canvas height was hand-typed, so adding four source lines pushed text off the canvas | R50: derive every dimension from the content |
| 31 | walkthroughs were hand-pasted into generated docs and bound to the chapter, not the section, so one landed under the wrong heading | R51: one writer, section-scoped |
| 32 | a prose block and a rendered walkthrough both taught the same concept; 21 reports of "still there" were about the DUPLICATE, not the wording | R52: one concept, one explanation — delete the copy |
| 33 | `teaching_gate` reported `1/1 files pass` on a 0-byte file, because every check asks "is there a defect in this text?" | R53: an empty input must FAIL, never pass |
| 34 | `decode` declared `val nRuns` and the STACK panel never showed it — the two panels contradicted each other | R54: `stack_gate` — every declared local must appear in its frame |
| 35 | `lastIdx` was a real `fun`, never exampled and never stepped into; the example rule was attached to `// primitive:` syntax | R55: `callable_gate` — exampled OR traced, for every callable |
| 36 | `symbol_gate` read `"c1"` in a string literal as an undefined identifier | narrow the checker: strip literals before tokenising |
| 37 | panel WIDTH was typed while height was derived; two added lines pushed text off-canvas | R50 applies to every axis, not just height |
| 38 | `memkit.embed()` read `spec.steps` (passed as `[]`) and wrote a walkthrough with 1 image and no steps | the kit throws; `check_embeds` caught it |
| 39 | a step titled `"c1" fills 9 rows` produced `alt="Step 6: "c1" fills…"` — the tag stopped parsing and GitHub printed it as text | R56: `html_gate` + escape every interpolation into an attribute |
| 40 | the SAME unescaped title broke the `<svg aria-label>` root; `esc()` covers `& < >` but not `"` | separate `attr()` from `esc()`; check SVG roots too |
| 41 | §16's own gate inventory read "eight independent gates" while listing 11 and running 32 | R49 applies to documentation too — point at the runner, don't count |
| 42 | an empty `<text>` label rendered a 0x0 bbox the pixel checker read as a margin break | `svgkit.text()` throws on an empty string |
| 43 | `callable_gate` matched `[^)]*` so a NESTED worked call `field(readBlock(s,0), "x") = 41` was reported missing | balance the parens |
| 44 | the header title and seed line collided whenever either was long | `diagramkit` measures both and re-places the seed row |
| 45 | 11 chapter-level `systemDesign` blocks were invisible to `check_band_honesty`, which walked `ch.flow` only — 22 uncounted bands | enumerate CONCEPTS generically, not one container by name |
| 46 | keying the band census on the presence of a `program` block made COMPLETED concepts vanish from the count | a concept owes both bands whether or not prose remains |
| 47 | `symbol_gate` reported "39/39 listings have every symbol defined" while extracting **0 symbols** from each | an empty EXTRACTION is a skip, not a pass |
| 48 | 22 of 22 `fun`s had no declaration header; `lastIdx` had a description and two worked calls but no `// primitive:`-shaped line | R58: declare every callable in ONE scannable form |
| 49 | the header was inserted directly above `fun`, landing AFTER the worked examples — the reader met `lastIdx` twice before anything declared it | R58 rule 3: header, then examples, then body |
| 50 | a name could be introduced in a CAPTION and exist in no listing; `symbol_gate` checks code, never prose | R59: `prose_name_gate` |
| 51 | `prose_name_gate`'s own first version iterated only dirs with a `source.json` — 5 of 11 — and passed a planted `phantomCursor` | print checked-vs-total and FAIL if they differ |
| 52 | the measuring pass swallowed painter exceptions, so an incomplete measurement sized the panel and the validator failed later on a symptom | never catch during measurement |
| 53 | panel heights were typed, so every new step risked a collision fixed by nudging a coordinate | R60: auto-geometry — measure, then size |
| 54 | 22 bands — every `systemDesign` concept's DIAGRAM and PROGRAM, a quarter of the repo — were generated, passed band honesty, and appeared in NO doc: only `flowMd` spliced `embed.md`, and `check_embeds` enumerated only `ch.flow` | R61: splice and enumerate EVERY place a concept can be declared; plus a disk-vs-declared tripwire |
| 55 | `memkit`'s scope separator was `>`, a character that occurs constantly in the code it matches — `return w(i) >= 10` was silently re-read as scope `return w(i) ` + needle `= 10`. It resolved correctly by luck for a whole corpus (both halves come from the same line), then threw AMBIGUOUS on an unrelated listing | R62: a separator must be a string that cannot appear in the input; `::`, mutation-proven |
| 56 | four `to_markdown.js` copies contained NUL bytes, so `grep` treated them as binary and printed NOTHING — the `alt=` writer was invisible to three separate searches for it | treat an empty grep on a file you know contains the string as a signal; `tr -d '\000'` |
| 57 | an authored `alt` text containing `->` closed its own `<img>` tag; two doc images were broken markup | R56 again, now in `d2ImgTag`: EVERY attribute interpolation is escaped, not just the ones that looked risky |
| 58 | a worked example's RESULT was written with a prefix — `sortByEt(EVENTS) = ids [0, 1, ...]`, `group(...).byKey[240] = [...]`, `publish(dash, 15) sets stored : 0 -> 15` — and `callable_gate` rejected all three. Recurred 3x | the result must BEGIN with the value: `= [0, 1, ...]`, never `= ids [...]`. Put the gloss in a trailing parenthesis |
| 59 | a primitive or function used before the line that declares it: `watermarkAfter`, `windowStarts`, `indexOf`, `contains`, `finalSession`, `growsInto` — 6 occurrences in 2 chapters | declare in DEPENDENCY order; `symbol_gate` reports "used before its definition on line N" and the fix is always to move the declaration up, never to silence it |
| 60 | the SAME defect recurred ~20 more times across four more chapters, always a primitive declared next to the function that used it | R63: ALL primitives above the FIRST function, so "used before defined" is impossible for primitives by construction |
| 61 | `wire_chapter.js` assumed `section: '...'`; one repo writes `"section": "..."`, so the tool refused to wire 124 concepts | build the pattern for every quoting of key AND value; read the indent off the anchor's own line |
| 62 | `html_gate`'s `checkTags` did not skip ``` fences although `checkMarkdown` did, so an RDF triple inside a java block was reported as malformed markup | a checker with two passes needs the SAME exclusions in both; blank fenced regions, preserving newlines for line numbers |

### R59 — check the PROSE for names, not just the code

`symbol_gate` reads a listing and checks identifiers. A caption, an intro line or a
WHY band is **prose**, so a name mentioned only there is checked by nothing and the
reader has nowhere to look it up. `tools/prose_name_gate.js` closes it: every
backticked or camelCase token in every `embed.md` must appear in some listing, in
the seed's data vocabulary, or in an explicit COMMON word list.

Two things it taught immediately, both worth keeping:

1. **Its own first version was the bug it exists to prevent.** It iterated only
   directories that had a `source.json` — 5 of 11 — and printed
   `5 walkthrough(s) checked · 0 findings` while passing a planted
   `phantomCursor`. **A gate that silently narrows its own input is worse than no
   gate**, because it buys false confidence. Every gate must print
   *checked-vs-total* and fail when they differ. Mutation-test a new gate by
   planting the defect it claims to catch — if the plant survives, the gate is
   decoration.
2. **Distinguish a NAME from a DATA VALUE.** It flagged `c6`, which is a campaign
   value from the seed, not an identifier. Demanding it appear in a program listing
   would be the gate misreading data as code. The seed is the authority for what
   data the book contains, so the seed's vocabulary joins the lookupable set.

### R67 — an invisible character in an identifier is a real defect, and only a tokenising gate sees it

**What happened (distributed-patterns ch16).** A function named `maySerÂ­veClient`
carried a **soft hyphen** (U+00AD) between `maySer` and `veClient`. It renders as
`maySerstrictlyveClient` nowhere — it renders as `mayServeClient`, identically to the
correct spelling, in every editor, terminal and diff. Eleven of them had crept
into one generator. `symbol_gate` reported:

    line 29: "maySer" is used but never defined anywhere in the listing
    line 29: "veClient" is used but never defined anywhere in the listing

which is the gate tokenising the rendered `source.json` and splitting on a
character the author could not see. Stripping U+00AD fixed all eleven at once.

**Why the gate caught it and review would not.** Reading the generator, the name
looks right; reading the rendered listing, the name looks right; only *splitting
identifiers on non-word characters* reveals it. That is R47 again — the gate is
aimed at the rendered artifact and tokenises rather than eyeballing — and it is
the one class of defect where a human proofreader is strictly worse than a
regular expression.

**The companion typo in the same chapter.** `// primitive: silenceFrom Leader()`
had a stray space, so the declared name and the used name differed by one
character that *is* visible and still slipped through. Both failures are the same
shape: the identifier in the declaration and the identifier in the body must be
compared mechanically, never by eye.

**What to do.** When `symbol_gate` reports a name you are certain you declared,
check for an invisible character before re-reading the code:

    grep -nP '[\x{00AD}\x{200B}-\x{200D}\x{FEFF}]' tools/gen_*.js

Soft hyphen, zero-width space, zero-width non-joiner/joiner and BOM are the ones
that survive a copy-paste. Strip them from the whole file rather than hunting
individual sites — there is never a legitimate one inside an identifier.

### R66 — run the gate suite on a quiescent tree

**The rule.** Do not generate one chapter's artifacts while the verification
suite is running over the repository. The suite's strongest check — "every
rendered band on disk must be declared by some concept" (R61) — compares two
independent sources, so a generator writing new directories mid-run makes the
filesystem legitimately disagree with the declarations and the suite reports
exactly that.

**What it looks like.** While verifying distributed-patterns ch07 I generated
ch08's diagrams. The run ended with:

    FAIL  embeds present
          FAIL ch08-read: rendered but declared by no concept — no doc can show it
          ... 5 such lines
    SOME GATES FAILED

Nothing was wrong with ch07 or ch08: the five directories existed and had not yet
been wired, which is precisely the state R61 exists to reject. Re-running after
wiring gave 76/76.

**Why this is worth a rule rather than a shrug.** The temptation is to relax the
check so it tolerates undeclared directories — which would destroy the only gate
that catches a generator whose output no reader can reach. The check is right;
the schedule was wrong. Overlap the *writing* of the next generator (which
touches no artifact) with a verification run if you want the parallelism, and
run the generator itself only once the suite has finished.

### R65 — an escaping pass must run BEFORE the transformation that would consume what it protects

**The rule.** When a pipeline both escapes text and transforms it, the escape
has to happen first. Inserting the escape after the transformation leaves the
defect untouched while looking exactly like a fix — the code is present, the
diff reads correctly, and nothing changes.

**Where this was found (distributed-patterns, 30 chapters).** `to_markdown.js`
un-escaped `&lt;` back to `<` so prose would read naturally in the source, and
then stripped HTML tags with a pattern that matches `<` up to the next `>`. For
a bare `<` in prose — `"mood" < "name"`, or a generic type — the stripper
therefore deleted the whole sentence between them. ch23 shipped with half its
explanation gone and an unbalanced backtick, and `html_gate` failed on 14 docs.

The first attempt added the escape pass immediately AFTER the tag strip. Every
gate still failed, with identical output, because by then the text was already
deleted. Moving the same three lines above the strip fixed all 14 at once:

    // A bare `<` that is NOT the start of a recognised HTML tag must be escaped
    // BEFORE the tag-stripping pass below, or the stripper matches `<` up to the
    // next `>` and deletes the sentence between them.
    s = s.replace(/<(?!\/?(?:code|strong|em|...)[\s>/])/gi, '&lt;');
    s = s.replace(/<(?!\/?(?:table|thead|tbody|tr|th|td)\b)[^>]+>/gi, '');

**The general shape.** Any ordered pair of (protect, consume) has exactly one
correct order, and the wrong one is silent. Before adding a sanitising step, find
the destructive step it is meant to survive and place it above that line — then
re-run the gate, because "the fix is in the file" is not evidence that it ran in
time.

**The companion rule for emitters.** Prose and code fences need DIFFERENT
escaping, so they cannot share one helper. Inside a ```` ``` ```` fence a bare
`<` is correct and an entity would be shown literally; in prose rendered as HTML
the reverse holds. distributed-patterns ended up with `ent()` for fences and
`txt()` for prose, applied at 22 prose call sites — and the 97 bare `<` already
sitting in `content/` were escaped by a one-off script that first located every
`program:` backtick block (honouring `\``-escapes) and copied those regions
through untouched, so a change inside a code block was impossible rather than
merely unintended.

### R64 — order a listing callees-first, so a forward reference is impossible

**The rule.** Within a PROGRAM listing, declare every function ABOVE its first
caller: leaves first, composites next, the entry point last. A `// function:`
comment may not name a callable that is declared further down either — the
comment is part of the listing a reader scans top to bottom.

**Why this is a convention and not a per-case fix.** The same two gate findings
recurred four times across ddia ch12 and distributed-patterns ch05 and ch10:

  symbol_gate:   "tsOf2" is used before its definition on line 91
  callable_gate: `safeDeletable` is mentioned on line 55 but only declared on 69
  callable_gate: `main` is mentioned on line 55 but only declared on line 96
  symbol_gate:   "bothGuarantee" is used before its definition on line 87

Each time the fix was local — move one function, reword one comment — and each
time it came back in the next chapter, because the cause was an authoring habit
rather than a mistake: a helper gets written when it is *needed*, which is after
the function that needs it. Three of the four arrived through a mechanism that
made forward references structurally likely:

  * a per-program `extraPrimitives` / `extra` hook that APPENDED declarations
    after the functions (ddia ch12, dp ch05). Appending can only ever produce a
    forward reference, so the hook was deleted both times rather than reordered.
  * a comment added to explain the ordering, which named `main()` while
    describing why `main()` comes last.

**How to comply mechanically.** Build the listing as one array in dependency
order and never append to it afterwards. If a function needs a helper, the
helper's lines go in above it at the moment it is written. `tools/hoist_primitives.js`
already enforces the R63 half (primitives above the first function); the function
half is ordering discipline that `symbol_gate` and `callable_gate` verify.

**Why the gates are aimed correctly here.** Both read the rendered `source.json`
rather than the generator, so they see the listing exactly as the reader does —
which is why they catch an appended declaration that looks fine in the source
array. That is R47 working as intended.

### R63 — declare every primitive above the first function

Twenty-plus `symbol_gate` findings across six chapters were the same shape:

```
line 49: "contains" is used before its definition on line 55
```

and the fix was always identical — move the declaration up. Declaring a primitive
next to the function that uses it reads well while you are writing one function and
breaks the moment a second function uses it earlier.

The rule removes the class rather than the instances: **every `// primitive:` goes
above the first `// function:`**. Then a primitive cannot be used before it is
declared, because nothing is declared after the primitives block. The only ordering
left to think about is function-to-function, which is a genuine dependency question
and worth thinking about.

Mechanically enforceable, and worth doing when a generator grows past a few
listings:

```python
# hoist every trailing `// primitive:` block to just before the first `// function:`
first_fn = next(k for k, l in enumerate(lines) if '// function:' in l)
prims = [l for k, l in enumerate(lines) if '// primitive:' in l and k > first_fn]  # + continuations
```

**Generalised:** when the same gate finding recurs with the same fix, the fix is not
the lesson — the *ordering convention that made it possible* is. Change the
convention so the finding cannot occur, and the gate stops being a reminder and
goes back to being a check.


### R62 — a separator must be a string that cannot appear in the input

`memkit`'s `at()` lets a step name a source line, optionally scoped to the function
containing it. The separator was `>`:

```js
const [scope, nd] = spec.includes('>') ? spec.split('>', 2) : [null, spec];
```

`>` occurs in almost every interesting line of the pseudocode being matched. So

```
at('    return watermarkAfter(i) >= W0 + WIN')
```

was silently re-read as scope `    return watermarkAfter(i) ` plus needle `= W0 + WIN`.

**It worked anyway, for a long time.** Both halves come from the same line, so the
scope anchored on that line and the needle search starting there found it again —
the right answer by coincidence. Dozens of call sites across two repos were in this
state and every gate passed. Then one listing had two functions whose bodies both
contained `return watermarkAfter(i) `, the accidental scope matched twice, and the
kit threw `AMBIGUOUS` pointing at a line the author had not scoped.

The dangerous version is the one that did not throw: if the accidental scope had
matched a *different, earlier* line, the needle search would have started in the
wrong place and silently resolved to the wrong source line — a highlighted step
pointing at code that is not what the caption describes.

The rule: **a separator is part of a grammar, so it must be a token the input
cannot produce.** `::` does not appear in this pseudocode; `>`, `|`, `:`, `-` and
`=` all do. The fix also rejects a spec containing `::` twice, because that is
either a typo or a line that breaks the assumption.

```js
if ((spec.match(/::/g) || []).length > 1) throw new Error(`more than one '::' separator`);
const i = spec.indexOf('::');
const [scope, nd] = i === -1 ? [null, spec] : [spec.slice(0, i), spec.slice(i + 2)];
```

Mutation-proven in both directions: a plain needle containing `>=` resolves to its
line, an ambiguous plain needle still throws, `fun g(i)::<line>` and
`fun f(i)::<line>` resolve to different lines of identical text, and `a::b::c`
throws.

**Generalised:** any time code splits authored text on a delimiter — a needle, a
pending-ledger line, a cache key, a log field — check whether that delimiter can
occur in the text being split. If it can, the parse is wrong on some input you have
not tried, and "it passes today" is evidence about your examples, not about the code.


### R61 — a generated band must be REACHABLE, and the gate must prove it

The worst failure in this corpus was not a wrong diagram. It was 22 correct ones
that no reader could see. Every chapter's `systemDesign` concept declared its two
bands, both generators ran, both walkthrough directories were complete — and the
published Markdown contained **zero** references to any of them. A quarter of the
repo was built and shipped into a void.

Three checks were green at the time, and each was green for a different reason:

- **band honesty** asked *"does the artifact exist?"* — it did.
- **the generators** reported `OK ch11-compare: 4 frames` — they had run.
- **`check_embeds`** printed `67/67 walkthroughs embedded` — because its census line
  was `(ch.flow || []).flatMap(sec => sec.walkthroughs || [])`. The 22 bands were
  declared on `ch.systemDesign`, so they were never among the 67. It did not fail;
  it never looked.

That last line is the whole lesson, and it is the same lesson as #51 and #40:
**the denominator was computed from the same incomplete enumeration as the
numerator**, so the ratio could not expose the gap. `67/67` and `89/89` are
indistinguishable from the outside.

The rule has two halves, and the second is the one that generalises:

1. **Enumerate every PLACE a concept can be declared, in both the renderer and the
   gate.** A walkthrough can hang off a flow section, off `systemDesign`, or off the
   chapter. `to_markdown.js` now splices all three through one shared
   `spliceWalkthroughs()` — one writer, so the renderer and the gate cannot drift —
   and `check_embeds.js` enumerates all three into its census.

2. **Add a tripwire that does not depend on that enumeration being right.** Walk
   the artifacts on *disk* and fail on any that no concept declared:

   ```js
   const onDisk = fs.readdirSync('diagrams/anim').filter(d => fs.existsSync(`.../${d}/embed.md`));
   const undeclared = onDisk.filter(d => !seen.has(d));   // seen = what the census found
   for (const d of undeclared) { console.log(`FAIL ${d}: rendered but declared by no concept`); bad++; }
   ```

   This is the check that catches the *next* forgotten declaration site, because its
   input is the filesystem rather than the schema the author remembered to walk.
   Report both numbers — `89 declared, 89 on disk` — so a drift is visible even on a
   passing run.

Mutation-proven both ways: planting an undeclared `diagrams/anim/zz-planted/` exits
1, and deleting one band's `<img>` lines from a doc exits 1.

**Generalised:** whenever a gate counts things, ask what supplies the list. If the
list comes from the same declaration the code under test reads, the gate can only
confirm internal consistency — it can never find something the declaration omits.
Cross-check against an independent source: the filesystem, the rendered output, or
a count taken a different way.


### R60 — auto-geometry: measure the content, then size the container

Every collision in this corpus was fixed the same way: a validator failed, and a
coordinate was nudged. That is reactive, it has to be redone for every new step,
and the nudge is a number nobody can later justify. The kits now size themselves:

- **`panelH` is omitted.** `diagramkit` renders every step once against a
  deliberately oversized canvas, asks `svgkit.contentBottom()` how far down
  anything actually reached, and sizes the panel to that. The panel's own
  background is excluded from that measurement — it is the thing being sized.
- **`note()` wraps.** Each line is measured against the box width and the box
  grows to the wrapped line count. A long line used to run straight out of its own
  note and be discovered from a validator failure two steps later.
- **Never catch during a measuring pass.** A swallowed painter exception produces
  an *incomplete* measurement: the panel gets sized to whatever was drawn before
  the throw, and the failure surfaces later as a collision somewhere unrelated.

The test that it works: delete every typed `PANEL_H` and re-render. Both ch01
walkthroughs came out at 570 and 592 px, within 4 px of the hand-tuned values, with
no number typed and all 23 frames passing the rendered-pixel check.


### R58 — declare every callable in ONE form the reader can scan for

`lastIdx` was reported as undefined by a reader **after** it had been given a
description and two worked examples. Both were there. What was missing was the
**shape**: every primitive in the listing was introduced as

```
// primitive: len(xs) — element count.  len([41,58,63]) = 3
```

and every `fun` was introduced by nothing at all — its body just began. A reader
looking for "where is this defined" scans for the marker, finds one for `len`, and
finds none for `lastIdx`. **22 of 22 functions were in that state**, so `lastIdx`
was not an exception; the convention itself was inconsistent.

Why `callable_gate` passed it: R55 asks *"is there evidence — an example or a
trace?"*. That is a question about **evidence existing**. It never asked *"can the
reader FIND the declaration by scanning?"* — a question about **uniform
presentation**. Both are required, and they are different checks.

The rule: every callable gets a header line in the same shape, directly above it.

```
// primitive: gather(xs, p) — xs rearranged by p: gather(xs,p)[i] = xs[p[i]].
//   gather([600,100,900,800], [1,3,0,2]) = [100,800,600,900]
// function: buildIndex(codes, B) — build the sparse index ONCE at seal time. Body below; traced from step 2.
```

**Order is part of the rule:** header, then the worked calls, then the body. The
first fix inserted the header directly above `fun`, which put it *after* the
examples — so the reader still met `lastIdx` twice before anything declared it.
"Declared somewhere" is not "declared before you need it".

`primitive:` for an assumed operation (no body shown — so it *must* carry a worked
call); `function:` for one whose body follows (it may point at the step that traces
it instead). `main` is not exempt: its header is where "who calls this?" is
answered. Enforced by rule 2 of `callable_gate.js`.

**The general lesson, and the reason this recurred:** a rule that checks whether
information EXISTS is not the same as a rule that checks whether it is
DISCOVERABLE. Every gate here asked the first question. A reader only ever asks
the second.


### R57 — the shells are kits: `memkit` for PROGRAM, `diagramkit` for DIAGRAM

After four diagram generators and three memory generators, the shell was rewritten
by hand seven times, and each rewrite reintroduced a defect the previous one had
already fixed (typed canvas, typed panel width, unescaped attribute, colliding
header, empty label). The shell is not the interesting part of a walkthrough and
must not be retyped.

`tools/memkit.js` (PROGRAM band) and `tools/diagramkit.js` (DIAGRAM band) own:

- canvas height AND panel width **derived** from the content (R50, both axes);
- header placement **measured** — the seed line drops to its own row rather than
  colliding with a long title;
- every `alt` / `aria-label` through `attr()` (R56);
- static fallback = exactly frame 1 (R39);
- highlight needles addressed by content, throwing on 0 or >1 matches (R36);
- `embed.md` emitted with WHY → WHEN → DIAGRAM headings in contract order;
- a refusal to emit a walkthrough with zero steps.

A caller supplies only the painters, the step titles, the captions and the prose.
**A new concept should be a spec, not a generator.** If you find yourself copying
a previous generator's geometry block, stop and extend the kit instead — that copy
is how every one of the five defects above came back.


### R47 — a gate must be aimed at the SOURCE OF TRUTH, not at your own output

The worst failure in this corpus was not a wrong explanation. It was a block
reported "converted" **twenty times** while never changing. The mechanism:

```
content/ch02.js:211        <- where the block actually lives (docs/ is GENERATED from it)
diagrams/anim/*/embed.md   <- what check_block_shape.js was invoked on
```

Each "fix" generated a **new** section next to the block. The gate read the new
section, printed PASS, and the report said ALL GATES PASS — while the block the
reader was looking at was out of scope for both the edit and the check.

**A gate that reads what you just wrote cannot fail.** Before trusting any
checker, answer two questions in writing:

1. **What file does the reader actually see?** Trace it back through every
   generator to the file a human edits. That file is the gate's input.
2. **Would this gate fail if I changed nothing?** If the artifact it reads is one
   your generator just produced, the answer is no, and the gate is theatre.

Print the input paths in the gate's own output, so a mis-aimed gate is visible:
`band honesty: 4/66 bands ... ` names counts over the *source*, not over `embed.md`.

### R48 — a band may not name an artifact it does not have

`WHY -> WHEN -> DIAGRAM -> PROGRAM` is a contract about *artifacts*, not about
headings. A `DIAGRAM` band with prose under it tells the reader "here is the
picture" and shows a paragraph; a `PROGRAM` band with prose tells them "here is
it running" and shows a paragraph. Both are the label lying about its content.

Enforce it (`tools/check_band_honesty.js`):

- `DIAGRAM` band => a rendered stepped walkthrough exists and is declared here.
- `PROGRAM` band => a rendered **stack + heap** walkthrough exists and is declared here.
- Neither yet => the band MUST be listed in a committed `BANDS_PENDING.txt`.
  Unlisted = FAIL (a silent lie). Listed but now built = FAIL (a stale line).

The ledger is the point: it converts *N silent lies* into *N counted, visible
debts*, printed on every run (`4/66 bands have the artifact they name · 62
pending`). A skip must never look like a pass — and "pending" is the only honest
way to ship an unfinished band.

### R49 — glob, never enumerate

`check_block_shape.js a/embed.md b/embed.md` was written when two walkthroughs
existed. At four it reported `3/3 blocks match` while checking two of them. Any
hand-written list of inputs is a tripwire that fires later, silently, as a PASS.
Use `diagrams/anim/*/embed.md`. If a set can grow, the gate discovers it.

### R50 — derive every dimension from the content

`const W = 1120, H = 1010;` is a latent overflow. Adding four `// primitive:`
lines to the listing pushed text off the canvas — and the only reason it was
caught is that the geometry validator runs before the render. Compute it:

```js
const PAN_H = SRC.length * LH + 26;
const Y = { step: PAN_Y + PAN_H + 34, cap: PAN_Y + PAN_H + 66 };
const H  = Y.cap + CAP_LINES * CAP_LH + 6;
```

A hardcoded canvas breaks exactly when someone improves the content, which is
the worst possible time. If a number can be computed from the data, typing it is
a defect.

### R51 — one writer, and bind an artifact to the SECTION it explains

Two related failures, same root:

- The generator wrote `embed.md`; the *docs* content was hand-pasted. One
  `to_markdown` run had already deleted 28 images that way. Fix: the doc
  generator splices `embed.md` in — splicing is code, not a paste.
- Walkthroughs were declared on the **chapter** (`walkthroughs: [...]` at the
  top). A chapter-level list cannot say *where* a walkthrough goes, so ch02's RLE
  walkthrough was emitted inside the **segment** section. Fix: declare
  `walkthroughs` on the flow **section**, and let the section's own emit loop
  place it. The declaration then also records which concept owns it, which is
  what R48's gate reads.


### R52 — one concept, one explanation; when a visual exists, the prose copy goes

The longest-running defect in this corpus: a `program:` block explaining the RLE
index in prose, sitting directly above four rendered sections explaining the same
index with animations. Reported 21 times as "why is this still there". Each time
it was read as a request to improve the block's wording or bands, so a better
version of the duplicate was produced. **The request was to delete it.**

The rule, in the order to apply it:

1. Does a rendered WHY/WHEN/DIAGRAM/PROGRAM already cover this concept?
   **Yes → delete the prose block.** It is the copy.
2. **No → the block is the only explanation; it stays** and goes on the pending
   ledger until its visuals exist.

And when content exists *only* in the block being deleted — here the cost bound,
the B trade-off, the four rejected alternatives, the bit arithmetic — it does not
become more prose somewhere else. **It becomes another walkthrough.** Diff the
block against the sections first and find out what is genuinely unique; deleting
without that check loses content, and migrating it as prose recreates the
problem one level up.

Mechanised: `check_band_honesty.js` emits `DUPLICATE` when a section has both a
rendered walkthrough and a `program:` block carrying that same band. Mutation-
tested — re-inserting the block makes the gate exit 1.

### R53 — an empty input must FAIL, never pass

Every check in a linter has the form "is there a defect in this text?", so an
empty text has no defects and **passes every one of them**. `teaching_gate.js`
printed `PASS /tmp/empty.txt · 1/1 files pass the teaching gate` on a 0-byte
file, which meant a broken upstream extraction was indistinguishable from clean
content. This is the single most common way a gate lies.

Every gate that reads a file needs a floor:

```js
if (text.trim().length < MIN) {
  console.log(`  EMPTY INPUT: ${text.trim().length} chars (minimum ${MIN}). Nothing was checked.`);
  bad++; continue;   // a FAILURE, not a pass
}
```

The message must say *nothing was checked* and point at the extraction, because
the fix is upstream. **Never lower the floor to make the gate green.** The same
floor belongs on every extraction, every glob (zero files matched is a failure),
and every count (`0/0 passed` is not a pass).


### R54 — every local the listing has declared must appear in its stack frame

A PROGRAM walkthrough shows two panels that claim to describe the same instant:
the SOURCE, and the STACK. `decode` declared `val nRuns = len(runs)` and the
stack frame for `decode` never listed it. The reader watches a name come into
existence on line 44 and cannot find it in the panel titled "the stack at this
moment". Either the panel is incomplete or the line is dead, and nothing said which.

**No existing gate could catch it,** which is the important part:

| gate | question it asks | why it passed |
|---|---|---|
| `symbol_gate` | is every name defined *somewhere*? | `nRuns` is defined |
| `verify_diagram` | is any pixel clipped? | nothing was clipped |
| `sync_gate` | do artifacts state the same facts? | neither states `nRuns` |

The unasked question was whether the two panels **agree with each other**.
`tools/stack_gate.js` asks it: the generator publishes `steps.json` (highlighted
lines + frames), the gate parses the listing's declarations, and per step per
frame requires every local declared by the current line to be shown.

Two scope subtleties, both of which were checker bugs before they were fixed:
- a **caller** frame is suspended AT its call site, so its own `val x = callee()`
  is not yet assigned — bound strictly *before* the call line;
- a frame that is innermost because **the callee just returned** resumes at the
  call site, not at the end of the function.

The durable fix in the generator is to build each frame from **one builder per
function** (`BUILD()`, `DEC()`, `SEAL()`), so a local cannot be present in step 4
and silently absent in step 6. It ran at **101 findings** across three finished
walkthroughs that had all passed every other gate.

### R55 — every callable is exampled OR traced

R41 said "primitives are shown by example", and the check looked for
`// primitive:`. `lastIdx` was declared `fun lastIdx(starts, row) { ... }`,
invoked, and never demonstrated: no worked call, and no step ever stepped inside
its body. **The rule was attached to the syntax instead of to the reader's need.**

`tools/callable_gate.js`: for every `fun name(...)` and every called
`// primitive: name`, at least one must hold —

- **(a) exampled** — a line shows `name(<concrete args>) = <concrete result>`; or
- **(b) traced** — some step highlights a line strictly inside its body.

`main` is exempt; the whole walkthrough is its trace. Value sentinels declared as
primitives but never called (`NONE`) are not callables. Prefer the example that
also teaches the boundary: `lastIdx([0,9,16,21,23,32], 16) = 2 — starts[2] EQUALS
16, and <= counts` does double duty.

**Generalise the lesson past these two gates:** when a rule is written, check
whether it is bound to a *spelling* or to the *reader's need*. Every rule bound
to a spelling has a sibling case that spells it differently and slips through.


### R56 — escape every interpolation into an attribute, and check the markup

The artifact can be perfect and still not reach the reader. A step was titled:

```
"c1" fills 9 rows and still gets one code
```

interpolated straight into an attribute:

```html
<img src="..." alt="Step 6: "c1" fills 9 rows and still gets one code" width="1040">
```

The second `"` closes `alt`. The tag never parses, and GitHub prints it as
literal text where the image should be. **Every existing gate passed**: the SVG
was pixel-perfect, the geometry validated, the embed was present, the caption
taught. What was broken was the *markup pointing at* the artifact, and nothing
looked at that layer. The same title also broke `<svg aria-label="...">`, because
`esc()` escapes `& < >` — correct for element TEXT, insufficient for an ATTRIBUTE.

Two things, both required:

1. **Two escapers, not one.** `esc()` for element text; `attr()` = `esc()` plus
   `"` → `&quot;` and `'` → `&#39;` for attribute values. Every `${...}` inside
   an attribute goes through `attr()` — no exceptions, because any caption or
   title may legitimately contain a quote.
2. **`tools/html_gate.js`** tokenises the attribute region of every tag in
   generated markdown and every generated SVG root. It must consume entirely as
   `name`, `name="..."`, `name='...'` or `name=bare`; leftover means a quote
   leaked in.

**And look for the same class in every other context where generated text meets
syntax** — that is what makes this rule general rather than one bug fixed:

| context | what an interpolated title can break |
|---|---|
| HTML/SVG attribute | `"` closes it early → tag stops parsing |
| markdown prose | `<word` is parsed as a tag and **vanishes from the page** |
| markdown table cell | unescaped `|` adds a phantom column, shifting every value left |
| inline code | an odd number of backticks leaves a code span open to end of block |
| markdown image alt | `]` inside `![...]` closes it early |

`html_gate` checks all five. The generalisable habit: after generating text into
any structured format, **re-parse the result** and assert it still has the shape
you intended. Generating valid content is not the same as generating valid markup.


## 17. The standard block — the shape every concept gets

One concept, four parts, always in this order. Anything else is a defect, and
`tools/check_block_shape.js` fails the build on it (it was written after a block
shipped with an EMPTY "Visual walkthrough" heading sitting above the
explanation — anyone following that anchor landed on nothing).

| # | Part | Answers | Rules |
|---|---|---|---|
| 1 | **WHY** — origin and example | where the data comes from, the real request, walked on that data with real numbers | R42, R44 |
| 2 | **WHEN** — lifecycle and scope | when it is built and from what; what it does NOT help and what serves that instead | R45, R46 |
| 3 | **DIAGRAM** — visual walkthrough | the structure built and used, one animation plus one still per step | R26, R27, R39 |
| 4 | **PROGRAM** — the same thing running | the listing with stack and heap at every step | R35, R36, R37 |

**Part 1 is the one people skip.** It is not an introduction to the mechanism —
it is the mechanism's *caller*. Show the rows, quote the request, walk it, and
only then name the pattern. A "why" that could be written without knowing the
query is not a why.

**Part 2 is the one nobody asks for and every reader needs.** A steady-state
drawing cannot show time, and it cannot show the complement of its own benefit.
Without it, readers correctly infer the wrong lifecycle ("is this maintained per
insert?") and the wrong scope ("can I query anything else?").

**Parts 3 and 4 are the same story twice, at different altitudes** — the data
structure changing shape, then the code and memory doing it. Both step-numbered,
both from the same seed, and `sync_gate` proves they state the same facts.

**Ordering is part of the contract.** A heading with nothing under it is a defect
in its own right: anchors are how people arrive, and an empty section is a dead
landing.


### R68 — run a gate on the artifact the gate reads, not on the file you were editing

T8 (the caption/teaching gate) reads **extracted frame captions**, not the chapter source.
Running `teaching_gate.js --only=T8 content/ch21-two-phase-commit.js` returned
`1/1 files pass` — on a file containing no captions at all. The real check, which
`verify_all.sh` performs, is:

```bash
caps=$(mktemp)
for d in diagrams/anim/ch21*/frames; do node tools/extract_captions.js "$d" >> "$caps"; done
node tools/teaching_gate.js --only=T8 "$caps"       # FAIL: "the whole point" has no agent
```

A gate that reports PASS over an empty input is indistinguishable from a gate that
reports PASS over a clean one, and a per-chapter fast loop is exactly where that
confusion is cheapest to make. The fix is a committed wrapper (`tools/t8_fast.sh
<chapter-prefix>`) that constructs the same input `verify_all.sh` does, so the fast
loop and the full run can no longer disagree about what was checked.

It happened a second time within the hour, on a different gate: `check_block_shape.js`
takes `diagrams/anim/*/embed.md` as arguments, and run bare it printed
`0/0 blocks match the shape contract` — a PASS. The full run then failed it on four
real findings (WHY/WHEN headings whose wording matched neither keyword the gate looks
for). Two independent gates, the same hole, both hiding a genuine defect.

**The general rule:** before trusting a gate's PASS, confirm it read something. `0/0` and
`N/N` are not both passes — a denominator of zero means the gate was never given the
work. A gate whose input is *derived* (extracted, rendered, concatenated) or *passed as
arguments* must be driven through the same derivation in every loop that claims to run
it, never pointed at the source file the derivation happens to start from.

**The structural fix** (what finally closed it): one committed script,
`tools/fast_gates.sh [chapter-prefix]`, which invokes every non-browser gate exactly as
`verify_all.sh` does, builds both derived inputs the same way, and **exits non-zero if the
prefix matched no files at all**. Hand-typing a gate invocation in the fast loop is now
the mistake, not the habit. Two ad-hoc loops disagreeing with the full run is a sign the
loop should be a file — the same conclusion as the null-baseline corollary in
`CLAUDE.md`: any measurement whose result will be reported lives in a committed script.

Related: [[R61]] (cross-check declared bands against what is on disk), [[R66]] (run the
suite on a quiescent tree).

### R69 — a panel's note offset is arithmetic, not a remembered constant

A diagram panel lays its rows from `y + 52` at `rh` each, so an N-row panel's last row ends at
`y + 52 + N*rh`. The note beneath it must start at or below that. The offset was being written
as a remembered constant — `y + 196` for a four-row panel at rh 34, `y + 230` for five — and in
one chapter **three separate five-row panels kept the four-row offset**, so the note straddled
the final row. Compute it:

```
note_y  >=  52 + rows * rh          (196 for 4 rows at rh 34; 230 for 5; 256 for 6 at rh 34)
```

`diagramkit`'s rendered-pixel check catches every instance authoritatively, but **one panel per
run** — so a one-line arithmetic slip becomes three edit-render cycles. Check the arithmetic
while writing the panel.

**And the failed attempt is the more useful half.** I wrote a source-level checker to catch all
of them at once. It asserted a fixed gap (`note_y == 52 + rows*34 + 8`) and reported ~1500
findings across already-shipped chapters that render correctly — because the real rule is an
*inequality* and chapters legitimately differ in clearance. Rewriting it as the inequality cut
that to 17, all still false: the parser assumed `rh: 34` when call sites use 36, and its
panel-terminator regex missed formatting variants, so it ran one panel's row scan into the next.

The tool was deleted rather than shipped. **A gate with false positives is worse than no gate**
— it trains you to skim its output, which is the same failure as [[R68]]'s `0/0` PASS: both
leave you believing a check ran when it did not tell you anything. When the authoritative check
already exists (here: rendered pixels) and the only complaint is that it reports one finding at
a time, the fix is to get the arithmetic right at the call site, not to add a second, weaker
oracle that re-derives geometry from source text.

Related: [[R68]] (run a gate on the artifact it reads), [[R67]] (only a tokenising gate sees an
invisible character).

### R70 — an optimisation that collapses N invocations into 1 has a scale ceiling; chunk by a natural unit

The rendered-geometry gate started as a loop: one headless-browser session per walkthrough.
At ~20 walkthroughs that spent almost all its wall clock on browser startup, so it was
collapsed into **one** session for every frame in the repo. That was the right call at the
time and it silently acquired a ceiling: at 326 walkthroughs (1304 frames) a screenshot
inside the single invocation hit the 180s per-render subprocess timeout, and the gate
**failed on a resource flake rather than on any content**. A gate that fails for reasons
unrelated to correctness is as corrosive as one that passes wrongly — both teach you to
discount it.

The fix is neither extreme. Chunk by a unit the work already has (here: the chapter), so
startup stays amortised over ~12 walkthroughs, each invocation is bounded, and the failure
message names which chunk failed:

```bash
for ch in $(ls -d diagrams/anim/*/ | sed 's|.*/\(ch[0-9]*\)-.*|\1|' | sort -u); do
  out=$(python3 tools/verify_diagram.py diagrams/anim/"$ch"-*/frames/step-*.svg) || { report "$ch"; break; }
done
```

**The general rule:** when you batch away a per-item overhead, write down what bounds the
batch. "All of them" is not a bound — it is a bound that happens to hold at today's input
size. This is the same shape as the chapter content itself (a batch size is a failure unit
as well as a throughput unit), which is worth noticing: the gate had the defect its own
subject matter warns about.

Corollary for incremental work: when the full gate is too slow to run per chapter, run it on
the chapter you changed and say so explicitly. Artifacts regenerated from an unchanged seed
are byte-identical, so re-verifying them proves nothing new — but the claim "the rest is
unchanged" has to be stated, not assumed silently.

### R71 — a template literal written with the wrong quote fails silently; check the artifact

`'... ${X} ...'` in JavaScript does not interpolate. It ships `${X}` verbatim to the reader.
This recurred in five separate chapters, always in the same place — a table row written as
`['label ${X}', \`value ${Y}\`]`, where the second element is correct and the first is not,
because the eye reads the pair as uniform.

Source-level grep cannot catch it reliably: `grep "'[^']*\${"` cannot tell a `${` inside a
backtick string from one inside a quoted string, and matching on the *source* is exactly the
mistake [[R68]] names. The check belongs on the **rendered artifact**, where the question is
unambiguous — any literal `${` in a generated page is an uninterpolated template:

```bash
grep -rl '\${' diagrams/anim/*/embed.md diagrams/anim/*/frames/*.svg docs/*.md
```

That one line, in the fast-gate suite, closed the class. Two lessons compound here: prefer a
check whose input is the output (R68), and when a defect recurs across chapters, the fix is a
gate rather than vigilance (R64).

### R72 — validate a replacement oracle byte-for-byte, and re-tune for its cost model

Replacing how a gate drives a browser (a fresh process per render → one reused
Playwright browser) is replacing the **oracle**, so the first obligation is to prove it
measures the same thing. Not "it still passes" — diff the measurements:

```
engine A: PASS step-01.svg (25 elements measured, ink bbox (23, 22, 1116, 505), guard band clean)
engine B: PASS step-01.svg (25 elements measured, ink bbox (23, 22, 1116, 505), guard band clean)
```

Identical output on the same input is what licenses the swap. "Both say PASS" would not
have: a weaker oracle also says PASS.

**Then re-tune, because the cost model inverted.** With a process per render, parallelism
is pure win and the batch must be *small* (a huge single invocation hit a per-render
timeout). With one reused browser per worker, a worker amortises its launch over the
frames it handles — so chunking is *harmful*: 28-frame chunks at 8 jobs meant 8 launches
per chunk and the run was launch-dominated again. The fix is to batch according to the
engine and to write the measurement next to each branch, because the same setting is
wrong for both. **Carrying an old optimisation across a change in cost model is a
recognisable mistake; it was right once, which is what makes it hard to see.**

Three defects the swap surfaced, each worth knowing on its own:

- **Driving a clock you then wait on.** Reproducing Chrome's `--virtual-time-budget` via
  CDP `Emulation.setVirtualTimePolicy` hung every render at **0% CPU**: once the virtual
  budget is spent the clock pauses, and `wait_for_timeout` is driven by *that* clock, so
  its timer can never fire. A bounded real wait beats an unbounded hang.
- **A library default that is wrong for a gate.** Playwright times out at 30s. A
  screenshot measured 7.4s at load 33 and over 30s at load 50 — so the gate failed on
  contention, which is the exact failure mode being fixed, reintroduced by a different
  default. Match the timeout the thing you replaced allowed.
- **`atexit` does not run in `ProcessPoolExecutor` workers.** They exit via `os._exit()`.
  A temp-file sweep registered with `atexit` left 48 files behind — *measured*, after I
  had already called it fixed. Clean up where the work happens, at the point the data is
  safely in memory, so every early return below is covered.

That leak had reached **54,542 files and 8.4 GB in /tmp**, from `tempfile.mktemp` targets
unlinked on the success path only. Every early return and every timeout leaked one. The
general rule: if a temp file's cleanup is one statement on the happy path, it is not
cleaned up — put the removal immediately after the last read of it, not at the end.

## R73 — a renderer field it does not read must be a hard error

The memory-walkthrough step format declares heap state with `st:` and the heap
DECLARATION uses `val:`. Writing `{ key: 'prefix', val: 0 }` in a step is therefore
the natural slip, and it is silent: `it.st` is `undefined`, `val()` returns the FULL
value, and the frame shows a populated array next to a caption saying the array is
empty. Nothing crashes. No gate compares pixels against prose, so it ships.

**The fix is not vigilance, it is a closed field set.** `memkit` now rejects any key
on a step's heap item other than `key`/`st`/`hot`, and any key on a stack frame other
than `name`/`locals`. Proven by mutation: reintroducing `val:` fails the build.

Generalise it: **whenever a config object is consumed by field name, enumerate the
fields you read and throw on anything else.** The dangerous typos are the ones that
name a field used *somewhere else in the same file*, because they look right in
review. A silent default is worse than a crash in exactly the places where the output
is a human-read artifact rather than a value another program checks.

## R74 — a gate given a hand-written list of inputs reports on the list, not the repo

`verify_all.sh` ran the caption gate as `teaching_gate --only=T8 "$C1" "$C2" "$C3"`
and printed "3/3 files pass" for a repo with 91 walkthroughs, **four of which were
failing**. The gate was correct; its argument list had been frozen when there were
three walkthroughs and never grew.

This is R68's sibling. R68 was "a gate run on the wrong input reports a vacuous
pass". R74 is narrower and more common: **the input list itself is the stale thing.**
Every gate invocation takes a glob, never an enumeration, and a gate whose count
("91/91") does not match the repo's artifact count is reporting on a subset.

Corollary that caught the same class twice: when a gate fails on a per-file report,
print the FAILING lines, not `tail -12`. A tail of 91 results is 12 PASS lines.

## R75 — flip the assertion, not the example

Three interview sections asserted that the optimised answer beats the naive one on
the worked example, and in two of them the assertion FIRED: at 18 ids against 3, a
resumed bisection costs 13 probes where a merge costs 11; at 5 weights, bisecting
loses on a draw that lands in the first bucket. The reflex is to enlarge the example
until the optimisation wins.

**Do the opposite: assert the loss, and make it the teaching point.** The sections now
refuse to build unless the clever answer is measurably *worse* at the demonstrated
size, with the crossover named separately (`10⁶ against 12` figures). This is strictly
more honest and strictly more useful — a reader who only ever sees the optimisation
win never learns that selectivity, not the data structure, is what decides.

A worked example that is big enough for the asymptotics to show is too big to check
by eye, so the choice is not "small example or honest example". It is "small example
plus named crossover" or "small example that lies by omission".

## R76 — a declared parameter is the honest alternative to a tuned example

Nine sections needed a value the seed does not fix: an arrival order, a key-set size, a
gap threshold, where a network splits a byte stream, which instant a process dies, how
many copies of a key to use. In every case the seed constrains the *data* and says nothing
about the *parameter*, so choosing one is unavoidable — and choosing the one that makes the
numbers look good is exactly the backtesting sin in another costume.

**The honest form is to declare it in the source with the reason it was chosen**, e.g.
"the chapter's gap is 120; at 120 every arrival joins at most one run, so the case this
section is about would never occur" or "at one entry per write, none of the 11 keys falls
in the arc the new machine claims, so the central demonstration would have zero cases."

**The test for whether you are doing it honestly: does an assertion also forbid the
opposite outcome?** ch07 asserts both that virtual points reduce the spread over 1100 keys
AND that they do *not* help over the 22 traced keys — so the small-sample caveat the prose
makes cannot silently become false either. A parameter guarded in only the flattering
direction is a tuned parameter with a comment on it.

## R77 — when the small example cannot show the effect, measure it where it applies and report both

Two sections made a claim that is simply **false at the scale you can check by eye**.
Virtual nodes even out a hash ring *in expectation*, and 22 keys cannot show an
expectation — 8 points per machine made the spread worse. Gossip reaches everyone in
log rounds, and at N=16 it takes 9 against 15 for telling people one at a time.

Neither is a reason to enlarge the example until the claim looks true: an example big
enough for the asymptotics is too big to check. Measure the claim **at a scale where it
holds**, trace the small one, and print both numbers with the discrepancy named. The
reader then learns the actual shape of the thing — including that a handful of samples
cannot demonstrate an average, which is the same lesson as "p99 of 11 samples is the
maximum."

**And interrogate the mechanism before blaming the data.** ch07's virtual points looked
counterproductive at every count tried; the cause was a 1024-position ring holding 600
points, so most points collided and the tie-break systematically favoured one machine —
reinstating the exact skew virtual points exist to remove. The measurement was right and
the parameter was wrong. A result that contradicts a well-established mechanism is a bug
in the setup until proven otherwise.

## R78 — integer arithmetic past 2^53 silently rounds; ask whether the loss is in the definition or in the result

JavaScript has no integers. `h * 16777619` with `h` near 2^32, or `x * 1103515245` with
`x` near 2^31, produces a product around 2^55–2^57 — past a double's 53-bit mantissa — so
**the low bits are rounded away before any mask or shift is applied.** Nothing throws. The
sequence is deterministic and reproducible, and it is not the sequence the code appears to
describe. Two generators in this corpus did this; the defect was found only when the same
algorithm was rewritten in a language with exact integers and disagreed.

The repair depends on which half of the work the lossy arithmetic sits in:

- **In the RESULT → fix the arithmetic.** A gossip generator's RNG is supposed to be a
  fair sampler. Its rounding changed the sequence from the third draw on, and the chapter
  published *9 rounds and 52 messages* for a spread whose true cost is *7 and 41*. Every
  structural assertion still held at the true figures, which is exactly what makes this
  dangerous: the guards passed, so nothing flagged it. A number produced by arithmetic
  that silently lost bits is not a measurement. Switched to `BigInt`.
- **In the DEFINITION → declare it and keep it.** A hash is arbitrary by nature; any
  deterministic function will do, and IEEE-754 round-to-nearest is deterministic and
  portable. So a lossy FNV is a legitimate hash — but only if the file says so, because a
  reader porting it to exact arithmetic will get different values and conclude the
  measurements are wrong. What is *not* arbitrary is that it ends up slightly non-uniform,
  so figures derived from it sit a point or two off their ideal and must be reported with
  a stated tolerance rather than rounded to the pretty number.

The test to apply: **would a correct implementation of this function change the claim, or
only change the arbitrary labels the claim is about?**

## R79 — a gate that forbids one direction does not establish the opposite; derive the word from the measurement

A consistent-hashing section asserted `if (SKM.spread < SK1.spread) fail(...)` — "virtual
points must not have helped at this small sample". The measured spread was *equal*
(12 → 12; only which machine was busiest changed). Equality satisfies `<`, so the guard
passed, while **three separate pieces of prose claimed the spread got WORSE** — a step
title saying "spread falls from 12 to 12", a caption saying "it goes the OTHER way", and
a summary saying "**worse**".

This is R75's twin, one level up. R75 says flip the assertion to match the measurement.
R79 says: when a claim is *directional*, do not write the direction down at all.

```js
const SMALL_REL  = a > b ? 'worse' : a === b ? 'unchanged' : 'better';
const SMALL_VERB = a > b ? 'rises' : a === b ? 'does not move' : 'falls';
```

Then the prose cannot disagree with the number, because the prose *is* the number. And
name the no-op case explicitly — the "unchanged" branch is the one a hand-written
direction always omits, and it is the one that was true here. Add the guard the omission
leaves open too: if the spread is unchanged *and* the counts are identical, the example
demonstrates nothing at all, and that deserves its own failure.

## R80 — a program shown in a document is a claim that it runs; re-run it and diff, and let it vouch only for what it defines

Printing a program and its output asserts two things no existing gate checked: that the
program runs, and that those are the results it produced. Both drift silently — output
gets hand-edited, the program gets refactored, and the page keeps claiming.

The gate that closes it: re-execute every program, **diff stdout byte-for-byte** against
the embedded copy, and require the embed to carry the program's first `def` line and its
last output line (so a section cannot show a *different* program from the tested one).
Mutation-prove all three directions — a program that raises, a stale embedded output, and
a program missing entirely.

The subtle part is what happens next. Once the whole program is embedded, it becomes a
listing the prose-name gate consults, and the lazy wiring — harvest every word token, as
the pseudocode listings do — **lets the program's own comments vouch for themselves** and
quietly disables the check on the new band. Harvest only what the program *defines*: `def`
and `class` names, their parameters, and assigned names. A name merely mentioned in a
comment stays unlookupable, which is the case the gate exists to catch. Proved by planting
a name in a comment and confirming it is still flagged.

Corollary, learned the same day: the runner and the gate must be two programs. The runner
writes the captured output; the gate re-runs and compares. If one program does both it
cannot fail, because it would be comparing a fresh run against itself.

## R81 — a measurement taken through a library that hides the operation is not a measurement

A comparison of two selection algorithms counted comparisons — but ran the heap through
`heapq`, whose sift comparisons happen in C and increment nothing. The counter therefore
omitted the entire `O(n log K)` term, and the heap "won" at every K including the median,
which is the one case it must lose. The cost model was not wrong; it was never evaluated.

The fix is to implement the thing being measured, however boring: an explicit `sift_up` /
`sift_down` that counts. Then the crossover becomes real and locatable (heap to K=100,
partitioning from K=1,000) — and the conclusion *changes*: at a podium-sized K the two are
within a few percent, so what decides is the quadratic worst case and the full
materialisation, not the constant factor.

Generalise it: **whenever a measurement instruments a loop you did not write, check that the
operation you are counting is one your code actually performs.** Same class as R78 — there
the arithmetic silently lost bits, here the instrument silently lost events. Both produce a
number that looks like evidence.

Related trap from the same sweep: a model whose *shape* is right and whose constant is 9×
out. A merge engine's read cost was modelled as one page per level; measured, a size-tiered
level holds several overlapping files, so a read probes 9.53 of them and the crossover sits
2.8× off — in the engine's favour, which is the direction nobody checks.

## R82 — a demonstration that passes by luck is worse than one that fails

Three separate findings in one sweep, all the same shape:

- A two-pointer sweep validated against the chapter's own data got the **right** answer,
  because that data happened to be a chain. The rule's precondition was absent and nothing
  said so.
- A plausibility check on a corrupted frame length guessed the **right** boundary on the
  traced stream. Measured over 300 corruptions it is right 153/153 times with text payloads
  and 103/142 with binary — because four text bytes read as a length always exceed the cap.
  "It resynchronises" turned out to be a property of the *data*, not the protocol.
- A heavy-hitter cache *without* the cancellation step found all three heavy hitters,
  because the stream was evenly mixed.

In each case the honest repair is the same, and it is not to delete the example: **construct
the input where the mechanism is actually exercised, keep both, and print both.** The
accidental pass is the interesting half, because it is exactly what a reviewer or a test
suite would have seen before shipping the bug.

The sharper form of this rule: when a measurement agrees with the claim, ask whether it
*could have* disagreed. A loop that generates only under-estimates cannot support "the error
has no fixed sign", however many iterations it runs.

## R83 — exit 124 is your timeout, not their failure

A commit was reported as "blocked" three times. It was not blocked: `git commit` was exiting
**124**, the shell's timeout signal, because a pre-commit hook rendering diagrams in headless
Chrome needed longer than the budget on a machine at load 177 against 8 cores (a trivial
render measured 61s against ~1s idle). Two mistakes compounded:

1. **`cmd | tail -3` discards the exit status** and shows the hook's progress output, which
   reads exactly like success. Never pipe a command whose exit code is the thing you care
   about; capture to a file and test `$?`.
2. A timeout is a **resource parameter, not a correctness check.** Raising it (to an env-var
   default of 900s, here) does not weaken a guard — it is what lets the guard run instead of
   being bypassed with `--no-verify`, which is the outcome a too-tight timeout actually
   produces.

Before concluding that a check has failed, confirm it *ran*. And when a machine is saturated
by processes that are not yours, say so and budget around it rather than treating the
slowness as a verdict.

## R84 — gate the artifact the READER reads, which may be two steps from the one you generate

A generator wrote 123 programs into `diagrams/anim/*/embed.md`. The published chapter lives
in `docs/*.md` and is built from those embeds by a **separate** step. Running the gates
individually instead of through the suite skipped that step, so the embeds held four programs
per section and the published page held one — **and every gate passed**, because the gate read
the embed too. The defect was found by a reader opening the page.

This is R68 one level deeper. R68 says run the gate on the rendered artifact rather than the
source you edited. R84 says: when a pipeline has more than one rendered artifact, the gate
must read the **last** one — the file a human actually opens. Everything upstream of it can be
perfect while the thing being published is wrong.

Two concrete rules:

1. **A gate that checks an intermediate artifact must also check the final one**, and should
   name the missing step in its failure: *"the embed has it and the chapter does not, so run
   `to_markdown.js`"*. A failure that tells you which step was skipped costs nothing extra to
   write and saves the whole diagnosis.
2. **Never substitute individual gate invocations for the suite.** The suite contains build
   steps as well as checks, and running the checks alone silently removes the builds. If the
   suite is too slow to run, make it faster or add a fast variant — do not hand-pick the
   checks out of it, which is what happened here.

It proved itself immediately: once widened to read `docs/*.md`, the gate caught the *next*
fix in this same session before the page had been rebuilt (22/24, not 24/24).

## R85 — a program can be internally consistent and externally wrong: check it solves the stated instance

Two variation programs solved the right *shape* with the wrong *data*. The page states "the
first 9 units cost **41** each, the next 7 cost **58**" and the program used rates
`9, 16, 21, 23, 32` — the **cumulative boundaries**, which are derived from the same run
lengths and sit one `=` away in the same seed. The sensor-log variation made the identical
substitution against a statement that prints its pairs explicitly.

Every assertion passed. The program ran, self-checked, agreed with its own brute-force
reference, and its output matched the page byte-for-byte — because the output *came from* that
program. **Self-consistency cannot detect a wrong instance.** The only check that catches it
compares the program's input data against the problem statement, which no gate was doing.

So: when a program is published beside a stated problem, verify it reproduces **the
statement's own worked answer** ("Tick 23 → 86°"), not merely that it is self-coherent. That
single comparison would have caught both.

### And the honest limit, recorded so it is not rediscovered as a success

The obvious gate — *every figure quoted on the page must appear in its program* — was built
and **rejected**: 836 findings across four repos, almost all false, because a page legitimately
quotes **computed** results that no program contains as a literal (a total bill of 632 is
calculated, not declared). Inverting it (*every number in the program's declared input data
must appear in the statement*) is the low-noise direction and catches exactly this defect —
but only where the statement quotes its data; where the data is given in prose it still
cannot be checked automatically.

A gate with a 97% false-positive rate is worse than no gate, because it gets ignored and then
removed. Shipping one to be able to claim coverage is the failure mode to avoid: say which
cases are covered, and which are not.

## R86 — define the nouns before posing the question, and work the mapping on concrete inputs

A reader stopped at this statement: *"What RATE applies to unit k? Tiers are (rate, size)
pairs and there may be 10**5 of them."* Their words: **"It doesn't define what a rate is,
what a unit is, and suddenly talks about a tier. Everything is very confusing."**

The solution underneath was rigorous — self-asserting, brute-force cross-checked, gated. The
*question* was unreadable to anyone not already holding the vocabulary. Rigour in the answer
does not substitute for a stateable problem, and no amount of verifying the answer detects
this: every gate passed.

The shape that fixes it, in order:

1. **A definitions block, before any of the words is used.** One line per noun: `word -- what
   it means`. Include the units of measure, which are the silent gap — are items numbered
   from 0? is a bound inclusive? what *is* one "unit", "tick", "view"?
2. The scenario in plain domain words, carrying the concrete numbers.
3. The question on its own line, emphasised so it is findable.
4. **4–8 worked continuations**, `input -> answer   short why`: the first valid input, an
   ordinary one, both sides of the boundary the comparison decides, the last valid input, an
   input off the end, and one or two at the scale the problem names.
5. One line stating that each worked answer is an asserted row, so it cannot drift.

### The part that matters more than the structure

**Required structure that does not fit the problem must be reported, not padded.** Applying
this to 123 problems, the "off the end → undefined" slot turned out not to exist for many of
them, in several distinct ways, and each statement now says so:

- The input space *wraps*: `k = 32` on a circle of students returns student 0 and never
  becomes undefined.
- The function is *total*: a rank exists for every score, so `score 0 -> 33` (= n+1). The
  statement names what the invented answer would have been — clamping to the nearest held
  score's rank.
- The domain *refuses nothing*: hashing accepts every string. What is unreliable is the
  answer, not the input, and that is the actual hazard.
- The off-the-end lives on the *other side*: not the input, but the guarantee — an
  adversarial case where straight-line, top-1 and top-5 all return warehouse 17 when the
  true answer is 40.
- The answer is *not a value at all*: "how many consumers get the makespan under 100" and
  "what timeout is right" have none. A peak that doubles when the horizon doubles is "a
  property of when we stopped looking", not a measurement.
- The verdict *is not in the codomain*: "PROVABLY ONE" is never returned by any margin.
- The input *is not an input*: capacity 0 and 0 consumers make the program raise. Say "not an
  input", and exclude that line from the "every line is asserted" claim rather than making a
  blanket promise that is false.

A statement that promises more coverage than it has is the same defect as the original, one
level up. When a worked line is not an asserted row, say which line and why.

### What this found that the asserted answers could not

Stating the units explicitly exposed a line reading "the 295-**hour** silence" in a file whose
event times and `DAY = 86_400` are **seconds**. Writing a worked answer by reasoning rather
than running produced `max_conns@5 -> 25`; the program returns **30**, because the combined
log sorts by `(setting, version)` and picks up a different setting's value. And a statement
asked for "the next 20 posts after offset 100" of a feed holding **nine** — a question its own
example cannot answer.

Gate it with `check_statements.js`: at least 2 defined terms and at least 3 worked `->` lines.
Whether a definition is *clear* is a judgement no regex makes; what it can enforce is that
the words are defined at all and that the mapping is shown more than once.
