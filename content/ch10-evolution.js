registerChapter({
  id: 'ch10',
  num: 10,
  title: 'The Evolution of Large-Scale Data Processing',
  pattern: 'The field moved from batch MapReduce, through the Lambda architecture (batch + speed layers), to the Kappa architecture (one streaming pipeline with replay) — and the Beam model unifies batch and streaming as one thing.',
  aka: 'SS Ch10 · Lambda Architecture · Kappa Architecture · Batch-Stream Unification · MapReduce · Reprocessing',
  part: 2,

  flow: [
    {
      section: 'From MapReduce to streaming',
      walkthroughs: ['ch10-history', 'ch10-history-memory'],
      color: 'cyan',
      motivation: `The evolution of data processing explains why streaming systems look the way they do, so this section traces the arc from batch to the Beam model.`,
      steps: [
        { num: 1, title: 'MapReduce made batch tractable', detail: 'MapReduce (and Hadoop) made large batch jobs <strong>scalable and fault-tolerant</strong>, but it was built for finite datasets and had high latency.' },
        { num: 2, title: 'Streaming emerged for low latency', detail: 'Systems like MillWheel and Storm processed events as they arrived for <strong>low-latency</strong> results, but early versions lacked the correctness of batch (no event time, no watermarks).' },
        { num: 3, title: 'The Beam model unified the two', detail: 'The what/where/when/how model showed batch and streaming are <strong>the same computation over bounded vs unbounded data</strong> — batch is just streaming over a finite input.' },
        { num: 4, title: 'The consequence: one pipeline, both modes', detail: 'Because the model is unified, <strong>the same pipeline code can run in batch or streaming</strong> — the only difference is whether the input is bounded.' }
      ],
    },
    {
      section: 'Lambda and Kappa',
      walkthroughs: ['ch10-lambda', 'ch10-lambda-memory'],
      color: 'orange',
      motivation: `Two architectures tried to reconcile batch correctness with streaming latency, and the difference between them is the difference between dual codebases and one pipeline, so this section contrasts them.`,
      steps: [
        { num: 1, title: 'Lambda: batch + speed layers', detail: 'The Lambda architecture runs <strong>two systems</strong>: a batch layer for correct results and a speed layer for low-latency approximations. Both compute the same logic.' },
        { num: 2, title: 'Lambda\'s flaw: two codebases', detail: 'The batch and speed layers must be kept <strong>in sync by hand</strong> — the same aggregation written twice, in two systems, which drift apart. <strong>That duplication is Lambda\'s core cost.</strong>' },
        { num: 3, title: 'Kappa: one streaming pipeline with replay', detail: 'The Kappa architecture runs <strong>one streaming pipeline</strong>; reprocessing is done by replaying the log through the same code. <strong>No second codebase.</strong>' },
        { num: 4, title: 'Kappa needs replayable, persistent logs', detail: 'Kappa assumes the input is a <strong>replayable log</strong> (Kafka) that retains history long enough to re-run the pipeline when the code changes.' }
      ],
    },
    {
      section: 'Batch and streaming converge',
      walkthroughs: ['ch10-converge', 'ch10-converge-memory'],
      color: 'green',
      motivation: `The end of the arc is convergence — batch as a special case of streaming — and this section draws the practical consequences for how systems are built today.`,
      steps: [
        { num: 1, title: 'Batch is streaming over a bounded input', detail: 'A batch job is a streaming pipeline whose input <strong>ends</strong>. <strong>All the streaming machinery — windows, watermarks, triggers — still applies</strong>, just with a finite input.' },
        { num: 2, title: 'One model, one codebase', detail: 'With the Beam model, <strong>the same pipeline serves both modes</strong>, so the Lambda duplication disappears. The choice becomes an execution detail, not a rewrite.' },
        { num: 3, title: 'Reprocessing is a first-class operation', detail: 'Changing business logic means <strong>replaying history through the new pipeline</strong> — the Kappa pattern. The log is the source of truth; the pipeline is disposable.' },
        { num: 4, title: 'What remains distinct', detail: 'Bounded vs unbounded still changes <strong>when results are final</strong> (a batch run ends; a stream waits on watermarks). The model unifies the how, not the fact that streams never end.' }
      ],
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Batch and streaming were separate worlds', content: '<p><strong>Why.</strong> Batch had correctness and fault tolerance; streaming had low latency but weak correctness — and teams had to choose.</p><p><strong>Claim.</strong> The Beam model showed batch and streaming are the same computation over bounded vs unbounded data.</p><p><strong>Grounding.</strong> The book\'s thesis is that the two converge.</p><p><strong>In the wild.</strong> Beam, Flink, and Dataflow all run the same pipeline in both modes.</p>' },
      { tag: 'solution', tagLabel: 'Architecture', title: '2. Lambda architecture', content: '<p><strong>Why.</strong> To get both correct and low-latency results, run two layers.</p><p><strong>Claim.</strong> Lambda runs a batch layer (correct) and a speed layer (low-latency) computing the same logic in two codebases.</p><p><strong>Grounding.</strong> The duplication is the core cost — the layers drift.</p><p><strong>In the wild.</strong> Nathan Marz\'s Lambda architecture from the Hadoop era.</p>' },
      { tag: 'solution', tagLabel: 'Architecture', title: '3. Kappa architecture', content: '<p><strong>Why.</strong> Eliminating the second codebase removes the drift.</p><p><strong>Claim.</strong> Kappa runs one streaming pipeline and reprocesses by replaying the log through the same code.</p><p><strong>Grounding.</strong> One codebase, no synchronization.</p><p><strong>In the wild.</strong> Jay Kreps\' Kappa architecture on top of Kafka.</p>' },
      { tag: 'solution', tagLabel: 'Insight', title: '4. Batch is a special case', content: '<p><strong>Why.</strong> If the model is unified, batch needs no separate machinery.</p><p><strong>Claim.</strong> Batch is streaming over a bounded input — windows, watermarks, and triggers still apply, just with an input that ends.</p><p><strong>Grounding.</strong> This is the consequence of the Beam model.</p><p><strong>In the wild.</strong> Beam runs batch pipelines with the same windowing as streaming.</p>' },
      { tag: 'solution', tagLabel: 'Operation', title: '5. Reprocessing via replay', content: '<p><strong>Why.</strong> Business logic changes, so history must be recomputed under the new logic.</p><p><strong>Claim.</strong> Reprocessing replays the retained log through the new pipeline — the Kappa pattern.</p><p><strong>Grounding.</strong> The log is the source of truth; the pipeline is disposable.</p><p><strong>In the wild.</strong> Kafka retention + replay is the production form.</p>' },
      { tag: 'solution', tagLabel: 'Requirement', title: '6. Replayable logs', content: '<p><strong>Why.</strong> Replay-based reprocessing requires the input history to be retained and re-readable.</p><p><strong>Claim.</strong> Kappa assumes a replayable, persistent log (Kafka) with enough retention to re-run when code changes.</p><p><strong>Grounding.</strong> Without retention, history cannot be replayed.</p><p><strong>In the wild.</strong> Kafka topic retention is the Kappa prerequisite.</p>' },
      { tag: 'tradeoff', tagLabel: 'Cost', title: '7. Lambda vs Kappa', content: '<p><strong>Why.</strong> The architectures differ in what they pay for correctness and latency.</p><p><strong>Claim.</strong> Lambda pays dual-codebase drift; Kappa pays log retention and replay time.</p><p><strong>Grounding.</strong> Kappa\'s cost is storage and recompute, not coordination.</p><p><strong>In the wild.</strong> Most modern systems choose Kappa-style, given a replayable log.</p>' },
      { tag: 'tradeoff', tagLabel: 'Remaining', title: '8. What stays distinct', content: '<p><strong>Why.</strong> Unification does not make streams finite.</p><p><strong>Claim.</strong> Bounded vs unbounded still changes when results are final — a batch run ends, a stream waits on watermarks.</p><p><strong>Grounding.</strong> The model unifies the how, not the fact that streams never end.</p><p><strong>In the wild.</strong> Streaming jobs run until stopped; batch jobs terminate.</p>' }
    ],
    examples: [
      { name: 'Apache Beam', desc: 'One pipeline that runs in batch or streaming mode' },
      { name: 'Apache Flink', desc: 'A single engine for stream and batch, treating batch as bounded streaming' },
      { name: 'Kafka + Kappa', desc: 'A replayable log enabling one-pipeline reprocessing' },
      { name: 'Google MillWheel / Dataflow', desc: 'The lineage from early streaming to the unified model' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "A team runs a batch job and a streaming job that compute the same metric, and the two numbers disagree — the batch and speed layers have drifted.", q: "How do you avoid maintaining two divergent implementations of the same computation?", solution: "Adopt the Kappa pattern: one streaming pipeline, and reprocess by replaying the retained log through the same code — batch becomes a replay of the same pipeline, not a separate codebase.", components: ["One pipeline — Kappa", "Replayable log — Kafka", "Reprocessing — replay history", "Unified model — batch = bounded streaming"],  code: "// lambda: batch code + speed code -> drift\n// kappa : one code, replay log -> no drift\n//   bug fix -> edit once -> replay history -> swap result", tieback: "This is exactly the Lambda vs Kappa material in this chapter.", refs: ["2. Lambda architecture", "3. Kappa architecture", "5. Reprocessing via replay"], problems: ["20-metrics-monitoring", "21-ad-click-aggregation"] },
    { scenario: "An analyst asks why the company maintains separate batch and streaming pipelines when the business logic is identical.", q: "Are batch and streaming really the same thing, and how would you unify them?", solution: "Yes — batch is streaming over a bounded input. Use a unified model (Beam) so one pipeline runs both modes, and reprocess via replay when logic changes.", components: ["Unified model — Beam", "Bounded vs unbounded input", "One codebase"],  code: "// same windowed sum\n//   batch    : read 3 records -> result {12:00: 3}\n//   streaming: read 3 records as they arrive -> {12:00: 3}\n//   -> identical computation, different input", tieback: "This is exactly the batch-as-a-special-case material in this chapter.", refs: ["1. Batch and streaming were separate worlds", "4. Batch is a special case"], problems: ["20-metrics-monitoring"] }
  ],
  systemDesign: {
    walkthroughs: ['ch10-system', 'ch10-system-memory'],
    question: 'Design a data-processing system that survives a bug fix. Premise: every input is kept in a replayable log, so the corrected pipeline is deployed once and the whole history is replayed through the same code to replace the wrong result.',
    pipeline: 'log (replayable) -> one streaming pipeline -> speed result; replay path -> same pipeline -> corrected result',
    decomposition: [
      { box: 'log (replayable)', role: 'log — retains input history for replay',
        parts: [
          'the log holds records [ r1, r2, r3 ] with offsets',
          'retention is long enough to re-run when code changes',
          'the log is the source of truth'
        ] },
      { box: 'one streaming pipeline', role: 'one streaming pipeline — the only codebase',
        parts: [
          'the pipeline folds records into the running result',
          'windows and watermarks apply whether the input ends or not',
          'there is no separate batch implementation to drift'
        ] },
      { box: 'speed result', role: 'speed result — the live output',
        parts: [
          'the live result reflects the current fold of the log',
          'it is low-latency but uses the same code as any reprocess',
          'a bug means the result is wrong until replay'
        ] },
      { box: 'replay path -> corrected result', role: 'replay path — recomputes history after a code change',
        parts: [
          'the log is rewound to offset 0',
          'the same pipeline (v2) folds r1, r2, r3 again',
          'the corrected result replaces the buggy one'
        ] }
    ],
    
  },
  quiz: [
    { question: "What is the core cost of the Lambda architecture?", options: ["A. High latency", "B. Two codebases that drift apart", "C. Low throughput", "D. No fault tolerance"], answer: 2, explanation: "Lambda runs the same logic in a batch layer and a speed layer that must be kept in sync.", conceptRef: "2. Lambda architecture" },
    { question: "How does Kappa reprocess data?", options: ["A. A separate batch system", "B. Replaying the log through the same pipeline", "C. A second codebase", "D. Manual fixes"], answer: 2, explanation: "Kappa replays the retained log through the one streaming pipeline.", conceptRef: "3. Kappa architecture" },
    { question: "What is batch in the unified model?", options: ["A. A separate paradigm", "B. Streaming over a bounded input", "C. A faster streaming mode", "D. A type of window"], answer: 2, explanation: "Batch is just streaming over an input that ends.", conceptRef: "4. Batch is a special case" },
    { question: "What does reprocessing require?", options: ["A. A second codebase", "B. A replayable, persistent log", "C. A batch layer", "D. No state"], answer: 2, explanation: "Replay needs retained, re-readable input history.", conceptRef: "6. Replayable logs" },
    { question: "What stays distinct between batch and streaming after unification?", options: ["A. The window types", "B. When results are final — batch ends, streams wait on watermarks", "C. The transform logic", "D. The key grouping"], answer: 2, explanation: "The model unifies the how, not the fact that streams never end.", conceptRef: "8. What stays distinct" }
  ],
  seeAlso: [
    { to: 1, section: 'Three shapes of data', depth: '"batch is streaming over a bounded input" is ch01\'s three-shapes distinction stated as a unification — bounded, unbounded-batched, and unbounded-streaming are the same computation over different inputs.', example: 'ch10\'s windowed sum over a 3-record file vs a 3-record stream (both { "12:00": 3 }) is ch01\'s "batch is a special case of streaming" made concrete.' },
    { to: 6, section: 'Why the duality matters in practice', depth: 'the Kappa architecture\'s replayable log is the stream-as-source-of-truth principle from ch06 — the log is retained history, the table is a derived view.', example: 'ch10\'s "rewind the log to offset 0 and replay" is ch06\'s "any past table is a fold of the stream"; ch10\'s corrected table is ch06\'s materialized fold under new code.' },
    { to: 7, section: 'Why state must persist', depth: 'replay-based reprocessing is only practical because state checkpoints let a pipeline resume without re-reading everything — ch07 covers the checkpoint machinery Kappa leans on.', example: 'ch10\'s replay folds r1, r2, r3 through v2; ch07\'s checkpoint { count: {42:13}, offset: 500 } is what avoids replaying the whole log on every crash, so reprocessing is a deliberate re-run, not a recovery tax.' },
    { to: 2, section: 'What and Where — transformations and windowing', depth: 'the unified model that makes Lambda\'s duplication unnecessary is the what/where/when/how model — ch02 defines the four axes ch10 unifies.', example: 'ch10\'s "one pipeline, batch + streaming" is ch02\'s four-question spec applied to a bounded vs unbounded input; ch10\'s reprocessing is ch02\'s "how" (accumulation) recomputed under new logic.' }
  ],
  sources: [
    { name: 'Dean & Ghemawat — "MapReduce" (OSDI 2004)', url: 'https://research.google/pubs/pub62/', note: 'The batch model that streaming evolved from' },
    { name: 'Nathan Marz — "How to beat the CAP theorem"', url: 'http://nathanmarz.com/blog/how-to-beat-the-cap-theorem.html', note: 'The origin of the Lambda architecture' },
    { name: 'Jay Kreps — "Questioning the Lambda Architecture"', url: 'https://www.oreilly.com/radar/questioning-the-lambda-architecture/', note: 'The origin of the Kappa architecture' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'The paper that unified batch and streaming' },
    { name: 'Akidau et al. — "MillWheel" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'The early-streaming lineage' }
  ]
});
