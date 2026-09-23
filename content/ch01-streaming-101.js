registerChapter({
  id: 'ch01',
  num: 1,
  title: 'Streaming 101',
  pattern: 'The vocabulary and mental model that the whole book builds on: what streaming is, why the event-time/processing-time distinction matters, and the three shapes data can take — bounded, unbounded batched, and unbounded streamed.',
  aka: 'SS Ch01 · Event Time · Processing Time · Bounded vs Unbounded',
  part: 1,

  flow: [
    {
      section: 'What streaming is — terminology',
      color: 'cyan',
      motivation: `Every later chapter assumes you can tell a bounded dataset from an unbounded one and an event-time answer from a processing-time answer, so this section pins the vocabulary down before any of the mechanics.`,
      steps: [
        { num: 1, title: 'The term "streaming" is overloaded', detail: '"Streaming" means different things to different teams — real-time, low latency, continuous computation, event-driven, or merely "not batch". The book pins it to one precise meaning: <strong>a data processing engine designed with infinite datasets in mind, and a dataset that is unbounded — one that arrives gradually and never completes.</strong>' },
        { num: 2, title: 'Two critical dimensions of time', detail: 'Every event carries two timestamps that disagree. <strong>Event time</strong> is when the event actually happened (recorded by the producer). <strong>Processing time</strong> is when the processing system observed it. They diverge because of network delay, queueing, backpressure, and replays.' },
        { num: 3, title: 'Why the divergence breaks naive systems', detail: 'A system that buckets by processing time groups events by when it happened to be busy, not by when the user clicked. <strong>A correct answer to "how many clicks at 12:00?" must use event time — the processing-time answer silently shifts under load.</strong>' },
        { num: 4, title: 'The rest of the book in one sentence', detail: 'The book is a systematic answer to four questions you can ask of any data-processing pipeline — <strong>what</strong> results are computed, <strong>where</strong> in event time they are computed, <strong>when</strong> in processing time they are materialized, and <strong>how</strong> later refinements relate to earlier results.' }
      ],
      program: `// STREAM SIDE — one user click carries two timestamps that disagree; correct analytics must pick the right one
// DEF: event time — when the click happened, stamped by the user's device = 12:00:59
// DEF: processing time — when the pipeline observed the click = 12:04:11 (3m12s later)
// DEF: watermark — the pipeline's statement of how complete event time is at this moment = 12:03:00
// -> click : {user: 42, url: "/shoe/x", event_time: "12:00:59", processing_time: "12:04:11"}
//    step 1 · the network + queue delayed the click : 12:00:59 -> observed at 12:04:11   BECAUSE the device was offline for 3 minutes
//    step 2 · bucket by event time -> the click lands in the 12:00 window
//    step 3 · bucket by processing time -> the same click lands in the 12:04 window
// <- wrong answer : 12:04 bucket says 1 click when the user really clicked at 12:00   BECAUSE processing time measures the pipeline, not the user
//    alt watermark at 12:03:00 : the 12:00 window is declared complete -> the click arriving now is a late (straggler) event
//    derivation : lag = 12:04:11 - 12:00:59 = 3m12s   BECAUSE processing time trails event time by the network delay`
    },
    {
      section: 'Event time vs processing time',
      color: 'orange',
      motivation: `Because the two clocks disagree, a pipeline must decide which one its answers are about, so this section makes the distinction concrete with a metric that changes meaning when the clock is wrong.`,
      steps: [
        { num: 1, title: 'Event time is the meaningful one', detail: 'For almost any question about users or business — clicks per minute, latency, correctness — the answer should be keyed to <strong>when things happened</strong>, not when your system happened to look at them.' },
        { num: 2, title: 'Processing time is the cheap one', detail: 'Processing time needs no special machinery — the system clock is right there. <strong>It is the correct clock only for questions about the system itself</strong>, such as current queue depth or "how many events did I process this second".' },
        { num: 3, title: 'The lag between them is the cost of correctness', detail: 'Event-time correctness requires waiting for stragglers, and waiting costs latency. <strong>The whole art of the Beam model is choosing how long to wait (watermarks) and what to do with events that arrive later (triggers, allowed lateness).</strong>' }
      ],
      program: `// DATA SERVER SIDE — one click carries two timestamps; bucketing by the wrong clock moves the count into the wrong minute
// DEF: minute — the dashboard's 60-second reporting bucket; here "12:00" and "12:04"
// DEF: event time — when the click happened, stamped by the device = "12:00:59"
// DEF: processing time — when the busy pipeline observed it = "12:04:11"
// STATE (before):
//    minute_counts : { "12:00": 0, "12:04": 0 }
// -> click : {user: 42, url: "/shoe/x", event_time: "12:00:59", processing_time: "12:04:11"}
//    step 1 · bucket by event time -> minute_counts["12:00"] : 0 -> 1   BECAUSE the user clicked at 12:00:59
//    step 2 · bucket by processing time -> minute_counts["12:04"] : 0 -> 1   BECAUSE the pipeline saw it at 12:04:11
//    step 3 · the dashboard reports the two answers -> the 12:00 and 12:04 counts disagree   BECAUSE the two clocks are 3m12s apart
// <- correct answer : minute_counts["12:00"] = 1 is the user truth; the 12:04 count is a pipeline artifact
//    derivation : lag = 12:04:11 - 12:00:59 = 3m12s   BECAUSE processing time trails event time by the queueing delay`,
    },
    {
      section: 'Three shapes of data',
      color: 'green',
      motivation: `A pipeline's design falls out of whether its input has an end, so this section separates bounded, unbounded-as-batch, and unbounded-as-streaming and shows which machinery each forces on you.`,
      steps: [
        { num: 1, title: 'Bounded data', detail: 'A finite dataset — one day of logs, a database snapshot. <strong>You can process it to completion; when the job ends you have a final answer.</strong> Classic batch engines (MapReduce) assume this shape.' },
        { num: 2, title: 'Unbounded data, processed as batch', detail: 'Data that never ends, but the pipeline artificially slices it into finite chunks (a day at a time) and runs a batch over each chunk. <strong>The cost: a change is reflected only at the next chunk boundary — up to a day late.</strong>' },
        { num: 3, title: 'Unbounded data, processed as streaming', detail: 'Process every event as it arrives, continuously, with no artificial end. <strong>This is what the book means by streaming — the engine is built for infinite datasets, and answers are always "as complete as the watermark says".</strong>' },
        { num: 4, title: 'Streaming is the generalization', detail: 'Batch is a special case of streaming: a bounded dataset is just an unbounded one that happens to stop. <strong>A model that handles unbounded data well (the Beam model) therefore also handles batch — one abstraction for both.</strong>' }
      ],
      program: `// DATA SERVER SIDE — the same click pipeline over three input shapes; only the unbounded-streaming shape gives a live answer
// DEF: bounded — a finite dataset, e.g. one day of clicks = 86,400 events, processed to a final answer
// DEF: unbounded batched — clicks sliced into 1-day chunks, each chunk run as a batch at midnight
// DEF: unbounded streaming — every click processed as it arrives, no artificial boundary
// -> click : {user: 42, url: "/shoe/x", ts: "12:00:59"}
//    step 1 · bounded : the click joins an 86,400-event file; count : 0 -> 1 at end-of-day   BECAUSE the whole day must finish first
//    step 2 · unbounded batched : the click waits for the midnight boundary; count : 0 -> 1 at the boundary   BECAUSE results lag by up to 24h
//    step 3 · unbounded streaming : the click is counted on arrival; count : 0 -> 1 in seconds   BECAUSE no artificial boundary is waited on
// <- answer : "clicks at 12:00" = 1 in all three shapes; only the streaming shape reports it live
//    derivation : batch latency = up to 1 chunk = 24h; streaming latency = the watermark wait = ~ minutes`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. "Streaming" means too many things', content: '<p><strong>Why.</strong> If "streaming" can mean real-time, low latency, event-driven, or merely not-batch, then a team can agree on a word and still disagree on the system they are building.</p><p><strong>Claim.</strong> The book fixes the term to one meaning: an engine designed for infinite datasets, applied to data that arrives gradually and never completes.</p><p><strong>Grounding.</strong> The whole book is the answer to what/where/when/how for that one definition.</p><p><strong>In the wild.</strong> A Flink job over a Kafka topic is streaming in this precise sense.</p>' },
      { tag: 'solution', tagLabel: 'Definition', title: '2. Event time', content: '<p><strong>Why.</strong> Every business question is about when things happened, so the pipeline must record and reason with that instant rather than the instant it looked.</p><p><strong>Claim.</strong> Event time is the time at which an event actually occurred, as stamped by the producing system.</p><p><strong>Grounding.</strong> It is the correct key for "clicks per minute", "latency", and correctness.</p><p><strong>In the wild.</strong> A device timestamp on a mobile click is event time.</p>' },
      { tag: 'solution', tagLabel: 'Definition', title: '3. Processing time', content: '<p><strong>Why.</strong> The system still needs its own clock to answer questions about itself, even though it is the wrong clock for user behavior.</p><p><strong>Claim.</strong> Processing time is the time at which the processing system observes an event.</p><p><strong>Grounding.</strong> It is correct only for system questions — queue depth, events processed per second.</p><p><strong>In the wild.</strong> A Flink operator wall-clock timestamp is processing time.</p>' },
      { tag: 'tradeoff', tagLabel: 'Distinction', title: '4. Event vs processing time', content: '<p><strong>Why.</strong> Bucketing by the wrong clock silently corrupts every aggregate, and the corruption worsens exactly when the system is under load.</p><p><strong>Claim.</strong> Event time measures the user; processing time measures the pipeline — and network delay, queueing, and replay keep them apart.</p><p><strong>Grounding.</strong> A click at 12:00:59 processed at 12:04:11 lands in different windows under the two clocks.</p><p><strong>In the wild.</strong> Event-time mode in Flink is the production fix for this divergence.</p>' },
      { tag: 'solution', tagLabel: 'Shape', title: '5. Bounded data', content: '<p><strong>Why.</strong> Finite inputs are the one case where a job can run to completion and hand back a final answer, so they are the natural fit for classic batch.</p><p><strong>Claim.</strong> Bounded data is a finite, complete dataset such as a day of logs or a database snapshot.</p><p><strong>Grounding.</strong> MapReduce and friends assume this shape.</p><p><strong>In the wild.</strong> A nightly Hive table scan is bounded data processing.</p>' },
      { tag: 'tradeoff', tagLabel: 'Shape', title: '6. Unbounded as batch', content: '<p><strong>Why.</strong> Teams slice never-ending data into chunks because batch tooling is familiar, but the chunk boundary becomes the maximum freshness of every answer.</p><p><strong>Claim.</strong> Unbounded data processed as batch divides the stream into finite chunks and runs a batch job per chunk, so results lag by up to one chunk.</p><p><strong>Grounding.</strong> A daily aggregation reflects a change only at the next midnight.</p><p><strong>In the wild.</strong> Daily ETL over a click stream is unbounded-as-batch.</p>' },
      { tag: 'solution', tagLabel: 'Shape', title: '7. Unbounded as streaming', content: '<p><strong>Why.</strong> When a change must be visible in seconds, the only option is to process each event as it arrives and give up the idea of a finished answer.</p><p><strong>Claim.</strong> Unbounded data processed as streaming handles each event continuously, with results always "complete up to the watermark".</p><p><strong>Grounding.</strong> The engine is designed for infinite datasets from the start.</p><p><strong>In the wild.</strong> A Kafka-to-Flink pipeline is unbounded streaming.</p>' },
      { tag: 'solution', tagLabel: 'Model', title: '8. Batch is a special case of streaming', content: '<p><strong>Why.</strong> If one abstraction covers both finite and infinite inputs, you maintain one pipeline instead of two that must agree.</p><p><strong>Claim.</strong> A bounded dataset is just an unbounded dataset that stops, so a streaming model generalizes batch for free.</p><p><strong>Grounding.</strong> The Beam model treats both with one what/where/when/how vocabulary.</p><p><strong>In the wild.</strong> Apache Beam runs the same pipeline on batch and streaming runners.</p>' }
    ],
    examples: [
      { name: 'Apache Flink', desc: 'Stream processor with first-class event-time and watermark support' },
      { name: 'Apache Kafka', desc: 'The unbounded transport that makes streams concrete' },
      { name: 'Apache Beam', desc: 'Unified model over batch and streaming runners' },
      { name: 'MapReduce', desc: 'The classic bounded-data batch engine' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A dashboard shows clicks per minute, but under a traffic spike the numbers shift into the wrong minutes — a click that happened at 12:00:59 lands in the 12:04 bucket because the pipeline was busy.", q: "Which clock should the dashboard bucket by, and why?", solution: "Bucket by event time, not processing time, so a click is grouped by when it happened rather than when the busy pipeline happened to see it.", components: ["Event time — when the click happened", "Processing time — when the pipeline observed it", "Lag — the gap between the two clocks"],  code: "// the click carries two timestamps\n//   event_time    = 12:00:59  (the user's real click time)\n//   processing_time = 12:04:11 (when the busy pipeline saw it)\n// bucket by processing_time -> the click lands at 12:04 -> wrong\n// bucket by event_time      -> the click lands at 12:00 -> right", tieback: "This is exactly the Event time vs Processing time distinction in this chapter.", refs: ["2. Event time", "3. Processing time", "4. Event vs processing time"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] },
    { scenario: "A team runs a daily ETL job over a click stream. A fraud alert that should fire the moment a card is used instead fires the next morning, because every answer waits for the midnight batch boundary.", q: "What is the shape of this data, and what changes if it is processed as a stream instead of batch?", solution: "The data is unbounded but processed as batch, so results lag by up to one chunk. Processing it as a stream removes the artificial boundary and reflects each event as it arrives.", components: ["Unbounded data — never completes", "Batch chunk — the artificial 24h boundary", "Streaming — process each event on arrival"],  code: "// unbounded-as-batch : slice into 1-day chunks, run a job per chunk\n//   -> a change is reflected only at the next chunk boundary (up to 24h)\n// unbounded-as-streaming : process each event on arrival\n//   -> no artificial boundary, latency ~ watermark wait", tieback: "This is exactly the Three shapes of data distinction in this chapter.", refs: ["5. Bounded data", "6. Unbounded as batch", "7. Unbounded as streaming"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] }
  ],
  systemDesign: {
    question: 'Design a real-time clicks-per-minute dashboard. Use case: ops watches live click counts. Premise: each click is stamped with its event time, but the network delays it by minutes, so a click at 12:00:59 processed at 12:04:11 must land in the 12:00 window (event time), not 12:04.',
    pipeline: 'writer (event producer) -> transport (unbounded stream) -> collector (processor) -> aggregator/store (window state) -> reader (dashboard)',
    decomposition: [
      { box: 'writer (event producer)', role: 'writer — stamps events with event time',
        parts: [
          'a device stamps a click {user: 42, url: "/shoe/x", event_time: "12:00:59"}',
          'the timestamp is the user-interaction instant, not the send instant',
          'each event is immutable once emitted'
        ] },
      { box: 'transport (unbounded stream)', role: 'transport — carries events and delays them',
        parts: [
          'the click is queued and delayed 3m12s by the network',
          'processing time trails event time by the accumulated lag',
          'a watermark at 12:03:00 declares how complete event time is'
        ] },
      { box: 'collector (processor)', role: 'collector — reads events and assigns buckets',
        parts: [
          'the processor reads the click at processing time 12:04:11',
          'it buckets by event time, placing the click in the 12:00 window',
          'a straggler arriving after the watermark is flagged late'
        ] },
      { box: 'aggregator/store (window state)', role: 'aggregator/store — holds per-window counts',
        parts: [
          'window 12:00 count : 0 -> 1 as the click is folded in',
          'window 12:04 stays 0 BECAUSE the click belongs to 12:00',
          'the dashboard reads the live window counts'
        ] }
    ],
    
    program: `// SYSTEM DESIGN — a producer emits a click, the stream delays it, the processor buckets by event time, the dashboard reads the count
// DEF: click — the immutable event {user: 42, url: "/shoe/x", event_time: "12:00:59"}
// DEF: watermark — the stream's completeness signal = 12:03:00
// DEF: window — an event-time bucket that aggregates the count of events inside it
// STATE (before):
//    window_state : { "12:00": 0, "12:04": 0 }
// -> input : producer emits click {user: 42, url: "/shoe/x", event_time: "12:00:59"}
//    step 1 · the stream queues the click -> processing_time : 12:00:59 -> 12:04:11   BECAUSE the network delayed it
//    step 2 · the processor buckets by event time -> window_state["12:00"] : 0 -> 1
//    step 3 · the processor keys the dashboard read -> window_state["12:04"] : 0 -> 0, unchanged   BECAUSE event time, not processing time, is the key
// <- outcome : the dashboard reads window_state["12:00"] = 1   BECAUSE the click was keyed to when it happened
//    derivation : lag = 12:04:11 - 12:00:59 = 3m12s   BECAUSE processing time trails event time`
  },
  quiz: [
    { question: "What precise meaning does the book give to 'streaming'?", options: ["A. Any program that is not batch", "B. A data processing engine designed with infinite datasets in mind, applied to unbounded data that arrives gradually and never completes", "C. A synonym for low latency", "D. A synonym for event-driven architecture"], answer: 2, explanation: "The book fixes 'streaming' to one meaning — an engine for infinite datasets — rather than letting it mean merely 'fast' or 'not batch'.", conceptRef: "1. \"Streaming\" means too many things" },
    { question: "Which timestamp should a clicks-per-minute dashboard key on?", options: ["A. Processing time", "B. Event time", "C. Ingestion time", "D. Server wall-clock time"], answer: 2, explanation: "Business questions are about when things happened, so event time is the correct key; processing time measures the pipeline, not the user.", conceptRef: "2. Event time" },
    { question: "What is the cost of unbounded data processed as batch?", options: ["A. Higher throughput", "B. Results lag by up to one chunk boundary", "C. It cannot scale", "D. It loses events"], answer: 2, explanation: "Slicing a never-ending stream into fixed chunks means a change is reflected only at the next boundary.", conceptRef: "6. Unbounded as batch" },
    { question: "How does batch relate to streaming in the Beam model?", options: ["A. They are unrelated", "B. Batch is a special case of streaming — a bounded dataset is an unbounded one that stops", "C. Streaming is a special case of batch", "D. Batch always outperforms streaming"], answer: 2, explanation: "One model handles both: bounded data is just unbounded data that happens to end.", conceptRef: "8. Batch is a special case of streaming" },
    { question: "Why do event time and processing time diverge?", options: ["A. They never diverge", "B. Network delay, queueing, backpressure, and replay keep them apart", "C. Because of clock drift only", "D. Because event time is measured in a different timezone"], answer: 2, explanation: "The gap is caused by everything between the producer and the processor: network, queues, and replays.", conceptRef: "4. Event vs processing time" }
  ]
});
