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
      walkthroughs: ['ch03-watermark', 'ch03-watermark-memory'],
      color: 'cyan',
      motivation: `A window cannot close until the pipeline believes no more data for that window will arrive, so watermarks exist to state that belief explicitly and let downstream stages act on it.`,
      steps: [
        { num: 1, title: 'A timestamp that moves forward', detail: 'A watermark is a <strong>monotonically increasing</strong> event-time value: once it advances past a point, the pipeline declares it will not see event time earlier than that point again.' },
        { num: 2, title: 'It is a statement about completeness', detail: 'The watermark is the pipeline\'s best estimate of event-time completeness. <strong>It is not the wall clock and it is not a guarantee — it is a promise the pipeline makes so triggers can fire.</strong>' },
        { num: 3, title: 'Two kinds of watermarks', detail: 'A <strong>perfect</strong> watermark is possible when you know inputs are in order (e.g. ingestion-time processing of a single log). A <strong>heuristic</strong> watermark is an estimate when inputs can be out of order (e.g. mobile devices that go offline).' },
        { num: 4, title: 'Watermarks drive on-time triggers', detail: 'The on-time trigger for a window fires when the watermark passes the window\'s end. <strong>Everything else — early, late, allowed lateness — is defined relative to the watermark.</strong>' }
      ],
    },
    {
      section: 'Heuristic watermarks and skew',
      walkthroughs: ['ch03-skew', 'ch03-skew-memory'],
      color: 'orange',
      motivation: `Real sources are out of order — a phone with no network can send an hour-old event — so pipelines estimate watermarks from what they have seen, and the estimate can be wrong in both directions.`,
      steps: [
        { num: 1, title: 'Estimate from observed event time minus lag', detail: 'A common heuristic: track the <strong>maximum event time seen so far</strong> and subtract a fixed skew (a bound on out-of-orderness). <strong>watermark = max_seen_event_time - skew.</strong>' },
        { num: 2, title: 'Too fast = delayed data looks late', detail: 'If the heuristic advances faster than the true arrival pattern, events that are merely delayed get classified as late. <strong>An over-eager watermark loses data correctness to gain lower latency.</strong>' },
        { num: 3, title: 'Too slow = correct but high latency', detail: 'If the skew is too conservative, the watermark lags and windows stay open longer. <strong>An over-cautious watermark keeps results correct but delays on-time output.</strong>' },
        { num: 4, title: 'Per-source tracking is safer', detail: 'When each source has its own idleness pattern, tracking a watermark <strong>per source and taking the minimum</strong> is safer than one global watermark — the busiest source can no longer drag the stage\'s watermark past what a quiet source can vouch for. <strong>The price: a quiet source now holds the whole stage back.</strong>' }
      ],
    },
    {
      section: 'Propagation and correctness',
      walkthroughs: ['ch03-propagation', 'ch03-propagation-memory'],
      color: 'green',
      motivation: `A watermark only matters if every downstream stage sees a coherent value, and a coherent value only helps if the pipeline knows what to do when the estimate is wrong, so this section covers propagation and the failure mode.`,
      steps: [
        { num: 1, title: 'The watermark is the minimum across inputs', detail: 'When a stage has multiple upstream sources, <strong>its watermark is the minimum of its inputs\' watermarks</strong> — a stage cannot claim more completeness than its least-complete input.' },
        { num: 2, title: 'A watermark is an estimate, not a guarantee', detail: 'Because heuristics can be wrong, <strong>a watermark that passed does not mean late data will never arrive</strong> — it means the pipeline has chosen to treat the window as closed.' },
        { num: 3, title: 'Allowed lateness is the safety net', detail: 'When the heuristic is wrong and data arrives after the watermark, <strong>allowed lateness lets the window still accept it</strong> for a bounded horizon, then discard it.' },
        { num: 4, title: 'Watermarks are what make event-time pipelines tractable', detail: 'Without watermarks, a pipeline can never emit a result that a user can trust as "done for now". <strong>Watermarks convert an unbounded stream into a stream with a notion of progress.</strong>' }
      ],
    },
    {
      section: 'Google Interview Question',
      walkthroughs: ['ch03-interview-memory'],
      bands: ['PROGRAM'],
      color: 'purple',
      motivation: `A standalone interview problem, with three other surfaces the same program wears. Nothing here depends on this chapter's vocabulary: the problem, the one reframe that solves it, and the traced solution are self-contained, and the section stops where the program stops. Generated by \`tools/gen_ch03_interview.js\` on \`tools/interviewkit.js\`.`,
      steps: []
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. Unbounded data has no natural "done"', content: '<p><strong>Why.</strong> A stream never ends, so a pipeline cannot know when a window has seen all its data without a signal of progress.</p><p><strong>Claim.</strong> A watermark is that signal — a monotonically increasing event-time timestamp declaring completeness.</p><p><strong>Grounding.</strong> The watermark is the book\'s central mechanism for event-time progress.</p><p><strong>In the wild.</strong> Dataflow, Flink, and Beam all expose watermarks as first-class concepts.</p>' },
      { tag: 'solution', tagLabel: 'Perfect', title: '2. Perfect watermarks', content: '<p><strong>Why.</strong> If a source is provably ordered, the pipeline can know completeness exactly rather than estimating it.</p><p><strong>Claim.</strong> A perfect watermark is possible for ordered inputs — a single log consumed in order, or ingestion-time processing.</p><p><strong>Grounding.</strong> For an ordered log, every record is at or ahead of the watermark, so the watermark can advance to each record\'s timestamp.</p><p><strong>In the wild.</strong> Ingestion-time pipelines over a single Kafka partition are the classic perfect-watermark case.</p>' },
      { tag: 'solution', tagLabel: 'Heuristic', title: '3. Heuristic watermarks', content: '<p><strong>Why.</strong> Out-of-order sources (mobile devices, retries, multi-region collectors) make a perfect watermark impossible.</p><p><strong>Claim.</strong> A heuristic watermark estimates completeness from observed data — typically max seen event time minus a skew.</p><p><strong>Grounding.</strong> watermark = max_seen_event_time − skew is the book\'s canonical heuristic.</p><p><strong>In the wild.</strong> Flink\'s BoundedOutOfOrdernessWatermarkGenerator implements exactly this.</p>' },
      { tag: 'solution', tagLabel: 'Parameter', title: '4. Skew (out-of-orderness bound)', content: '<p><strong>Why.</strong> A heuristic needs a knob that says how out-of-order the source can be, to trade latency against correctness.</p><p><strong>Claim.</strong> Skew is the assumed bound on out-of-orderness subtracted from the max seen event time.</p><p><strong>Grounding.</strong> Too small a skew mislabels delayed data as late; too large a skew delays on-time output.</p><p><strong>In the wild.</strong> The skew parameter in a Dataflow pipeline is the production form.</p>' },
      { tag: 'solution', tagLabel: 'Bound', title: '5. Per-source watermarks', content: '<p><strong>Why.</strong> One global watermark is dragged UP by the busiest source — it claims completeness (12:08:00 on this stream) that a quiet source cannot back (12:03:20).</p><p><strong>Claim.</strong> Track a watermark per source and take the minimum; the stage advances only as fast as its slowest source, which is safe and can stall output.</p><p><strong>Grounding.</strong> The minimum across per-source watermarks is the stage\'s watermark.</p><p><strong>In the wild.</strong> Per-partition watermarks in Flink are the production form.</p>' },
      { tag: 'solution', tagLabel: 'Propagation', title: '6. Watermark propagation', content: '<p><strong>Why.</strong> A stage with multiple inputs cannot claim more completeness than its least-complete input.</p><p><strong>Claim.</strong> A stage\'s watermark is the minimum of its inputs\' watermarks.</p><p><strong>Grounding.</strong> The two-source stage in this chapter claims min(12:08:00, 12:03:20) = 12:03:20 and withholds the windows source "b" cannot vouch for; ch08 and ch09 apply the same rule to a join.</p><p><strong>In the wild.</strong> Flink\'s watermark alignment (min across inputs) is the production form.</p>' },
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
    { scenario: "A mobile analytics pipeline groups events by event time into 2-minute windows, but phones that go offline send events minutes late — id 7, stamped 12:00:50, reaches the pipeline at 12:04:40, after window [12:00, 12:02) has already been reported as 15.", q: "How do you compute event-time completeness when inputs are out of order, and what do you do about data that arrives after you declared the window complete?", solution: "Use a heuristic watermark — max seen event time minus a skew (out-of-orderness bound) — and keep windows alive for an allowed-lateness horizon after the watermark so late events can still update the result.", components: ["Heuristic watermark — max_seen − skew", "Skew — bound on out-of-orderness", "Allowed lateness — accepts late data for a bounded horizon", "On-time trigger — fires at the watermark"],  code: "// max_seen = 12:04:05 (id 4), skew = 60 s\n//   watermark = 12:04:05 - 1:00 = 12:03:05\n//   window [12:00,12:02) -> closed (12:03:05 >= 12:02:00), publishes 15\n//   id 7 @ 12:00:50 arrives at 12:04:40 -> its window is closed -> late\n//   when id 7 arrives, max_seen = 12:04:20 (id 5) -> watermark 12:03:20, 80 s past 12:02\n//   window state survives while watermark < 12:02 + allowed lateness -> needs more than 80 s\n//   allowed lateness >= 81 s -> still accepted -> re-emit 19", tieback: "This is exactly the heuristic watermark and skew material in this chapter.", refs: ["3. Heuristic watermarks", "4. Skew (out-of-orderness bound)", "8. Watermarks + allowed lateness"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] },
    { scenario: "A streaming stage reads two sources, one busy and one that goes quiet; windows keep getting emitted before the quiet source has vouched for them.", q: "Why does the stage emit windows the quiet source cannot vouch for, and how do you fix it?", solution: "A single global watermark is driven by the busiest source, so it claims completeness the quiet source cannot back. Track a watermark per source and take the minimum — the stage then withholds those windows, which is correct — and add an idleness timeout (or buffer the busy side) so a source that stays quiet does not stall output forever.", components: ["Watermark propagation — min across inputs", "Per-source watermarks", "Join buffer — holds the fast side"],  code: "// one global watermark: max seen 12:09:00 - 60 s = 12:08:00\n//   per source: a = 12:09:00 - 60 s = 12:08:00, b = 12:04:20 - 60 s = 12:03:20\n//   stage_watermark = min(12:08:00, 12:03:20) = 12:03:20\n//   windows [12:02,12:04) (11) and [12:04,12:06) (7) wait on source b\n//   fix: idleness timeout for b, or buffer a until the minimum passes 12:06:00", tieback: "This is exactly the watermark-propagation material in this chapter.", refs: ["5. Per-source watermarks", "6. Watermark propagation"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    walkthroughs: ['ch03-system', 'ch03-system-memory'],
    question: 'Design the watermark generator for an event-time pipeline. Premise: the watermark advances as max_seen event time minus a skew bound, so windows close on time and a straggler after the watermark is flagged late.',
    pipeline: 'sources (events with event time) -> watermark generator (max_seen − skew) -> window assigner -> per-window state -> trigger/emitter -> dashboard',
    decomposition: [
      { box: 'sources (events with event time)', role: 'sources — emit events that may be out of order',
        parts: [
          'source b emits id 7 {key: "b", event_time: "12:00:50"}, which reaches the pipeline at 12:04:40',
          'event time is stamped at the source, not at ingestion',
          'id 7 arrives after newer events — ids 4, 5 and 6 (12:04:05, 12:04:20, 12:03:40) got there first'
        ] },
      { box: 'watermark generator (max_seen − skew)', role: 'watermark generator — estimates event-time completeness',
        parts: [
          'max_seen : 12:04:05 -> 12:04:20 as id 5 arrives (id 6 at 12:03:40 does not move it)',
          'watermark = max_seen - skew = 12:04:20 - 1:00 = 12:03:20',
          'per-source watermarks are min-ed together at the stage: min(12:08:00, 12:03:20) = 12:03:20 at the end'
        ] },
      { box: 'window assigner', role: 'window assigner — assigns events to event-time windows',
        parts: [
          'id 7 {event_time: "12:00:50"} lands in window [12:00, 12:02), by event time alone',
          'the watermark at 12:03:05 (after id 4) claims every window ending by 12:03:05 is complete',
          'window [12:00, 12:02) is closed because 12:03:05 >= 12:02:00 — holding 15 of its true 19'
        ] },
      { box: 'trigger/emitter', role: 'trigger/emitter — fires on the watermark and handles late data',
        parts: [
          'the on-time trigger fires when the watermark passes the window end — at 12:04:06, publishing 15',
          'id 7 {event_time: "12:00:50"} lands in an already-closed window, so it is late; it is accepted if allowed lateness is at least 81 s: the window keeps its state while the watermark is below 12:02 + allowed lateness, and when id 7 arrives the watermark is 12:04:20 − 60 s = 12:03:20, 80 s past 12:02',
          'a late pane re-emits the updated window result, 19, to the dashboard'
        ] }
    ],
    
  },
  quiz: [
    { question: "What is a watermark?", options: ["A. The wall-clock time", "B. A monotonically increasing timestamp declaring event-time completeness", "C. The number of events in a window", "D. A type of window"], answer: 2, explanation: "A watermark is the pipeline's estimate of how complete the event-time axis is.", conceptRef: "1. Unbounded data has no natural done" },
    { question: "When is a perfect watermark possible?", options: ["A. When inputs are out of order", "B. When the source is provably ordered", "C. When there are many sources", "D. When there is no skew"], answer: 2, explanation: "Perfect watermarks require ordered input, such as a single log consumed in order.", conceptRef: "2. Perfect watermarks" },
    { question: "What is the canonical heuristic watermark formula?", options: ["A. watermark = wall clock + skew", "B. watermark = min event time + skew", "C. watermark = max seen event time − skew", "D. watermark = event count / skew"], answer: 3, explanation: "The heuristic subtracts a skew (out-of-orderness bound) from the max seen event time.", conceptRef: "3. Heuristic watermarks" },
    { question: "A stage's watermark with multiple inputs is the ___ of its inputs' watermarks.", options: ["A. maximum", "B. minimum", "C. sum", "D. average"], answer: 2, explanation: "Completeness is bounded by the least-complete input, so the stage watermark is the minimum.", conceptRef: "6. Watermark propagation" },
    { question: "What is the downside of an over-eager (too-fast) watermark?", options: ["A. Higher latency", "B. Delayed data is mislabeled as late", "C. Windows never close", "D. Memory exhaustion"], answer: 2, explanation: "An over-eager watermark lowers latency but loses correctness by treating delayed data as late.", conceptRef: "7. Latency vs correctness" }
  ],
  seeAlso: [
    { to: 1, section: 'Event time vs processing time', depth: 'why a watermark is needed at all — the two clocks diverge, so the pipeline must state its belief about event-time completeness rather than trust the wall clock.', example: 'ch03\'s watermark 12:03:05 closes [12:00,12:02) before id 7 (12:00:50) arrives at 12:04:40, 230 s after it happened; ch01 explains the root cause: the two clocks disagree by an amount nobody controls — eight of the nine seed events arrive within 50 s, and id 7\'s 230 s is about 5× the next worst, so a 60 s lag cannot anticipate it.' },
    { to: 2, section: 'When — triggers and watermarks', depth: 'where the watermark sits in the four-question model — it is the mechanism behind the "when" axis, driving early/on-time/late triggers.', example: 'ch03\'s on-time trigger fires when the watermark passes 12:02 (at 12:04:06); ch02 shows the same window emitting early panes (8 at 12:01:00, then 15 at 12:02:00, 12:03:00 and 12:04:00), the on-time pane (15 at 12:04:06) and a late pane (19 at 12:04:40) as the watermark moves.' },
    { to: 4, section: 'Session semantics and pitfalls', depth: 'the watermark is what lets a pipeline garbage-collect window state — sessions and other windows die when the watermark passes their end plus allowed lateness.', example: 'allowed lateness (at least 81 s on this stream, computed in ch02) is the garbage collector behind ch03\'s safety net; ch04 applies the same rule to sessions, collected when the watermark passes end + gap: at gap 120 s key b\'s session is collected at event 8, one event after id 7 (12:00:50) joins it, so nothing is retracted; at gap 40 s it is collected at event 4, so id 7 forces retract 7, emit 11.' },
    { to: 8, section: 'Windows in SQL', depth: 'streaming SQL hides the watermark mechanics but not its semantics — the same completeness signal is what makes a TUMBLE/HOP/SESSION result emit.', example: 'ch03\'s watermark passing 12:02 (at 12:04:06) closes window [12:00,12:02), and that completeness signal is exactly what ch08\'s GROUP BY TUMBLE(et, INTERVAL \'120\' SECOND) waits for: its [12:00, 12:02) row emits after event 4 holding 15 against a final 19, and its [12:08, 12:10) row (8) never emits because the watermark never reaches 12:10.' },
    { to: 9, section: 'Why joins are hard on streams', depth: 'a multi-input watermark propagates as the minimum of its inputs — and that single rule is what bounds a windowed join.', example: 'ch03\'s two-source stage takes min(12:08:00, 12:03:20) = 12:03:20 and withholds the windows holding 11 and 7; ch09 shows that same minimum gating a join, where 2 of its 5 clicks never emit because the minimum never passes their bound.' }
  ],
  sources: [
    { name: 'Slava Chernyak — "Watermarks: Time and Progress in Apache Beam and Beyond" (talk)', url: 'https://www.youtube.com/watch?v=TWxSLmkWPm4', note: 'A conference talk on how watermarks track event-time progress in Beam and beyond' },
    { name: 'Akidau et al. — "MillWheel: Fault-Tolerant Stream Processing at Internet Scale" (VLDB 2013)', url: 'https://research.google/pubs/pub41378/', note: 'Introduced the low watermark for out-of-order stream processing at Google' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'Defines watermarks as the mechanism that trades latency against correctness' },
    { name: 'Apache Flink — Generating watermarks', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/', note: 'How a production engine computes bounded-out-of-orderness and per-partition watermarks' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'Watermarks and lateness as part of the Beam model' }
  ]
});
