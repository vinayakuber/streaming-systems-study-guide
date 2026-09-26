registerChapter({
  id: 'ch04',
  num: 4,
  title: 'Advanced Windowing',
  pattern: 'Windowing generalizes into a lifecycle — assign, merge, group, trigger, accumulate, and garbage-collect — and session windows are the canonical case where a window is born, merges with its neighbors, and dies dynamically as data arrives.',
  aka: 'SS Ch04 · Session Windows · Fixed Window · Sliding Window · Window Merging · Window Lifecycle',
  part: 1,

  flow: [
    {
      section: 'Window shapes — fixed, sliding, session',
      color: 'cyan',
      motivation: `Different questions need different event-time boundaries, so this section distinguishes the three canonical window shapes and when each is the right tool.`,
      steps: [
        { num: 1, title: 'Fixed (tumbling) windows', detail: 'Fixed windows partition time into <strong>equal, non-overlapping, contiguous</strong> spans — every event belongs to exactly one window. They answer "how many per hour".' },
        { num: 2, title: 'Sliding (hopping) windows', detail: 'Sliding windows are <strong>fixed-length, overlapping</strong> spans defined by a window size and a slide. They answer "what is the rolling 5-minute average, updated every minute".' },
        { num: 3, title: 'Session windows', detail: 'Session windows are <strong>dynamic and data-driven</strong>: a session is a burst of activity separated by a gap of inactivity. They answer "how long did a user stay engaged".' },
        { num: 4, title: 'Sessions capture behavior, not just counting', detail: 'Because session boundaries follow the data, they model real user journeys — a visit with a 30-minute gap is two sessions, not one. <strong>The window is defined by the data, not the clock.</strong>' }
      ],
      program: `// STREAM SIDE — one click stream cut three ways gives three different groupings
// DEF: fixed window — a 5-min non-overlapping span = [12:00, 12:05)
// DEF: sliding window — a 10-min span that advances every 2 min = [12:00, 12:10) at slide 12:00
// DEF: session window — a burst that closes after a 30-min gap of inactivity
// -> input : click {event_time: "12:04:00"}
//    step 1 · fixed assignment -> the click belongs to [12:00, 12:05) only -> fixed_count : 0 -> 1
//    step 2 · sliding assignment -> the click belongs to [12:00, 12:10), [12:02, 12:12), [12:04, 12:14) -> slide_count : 0 -> 3
//    step 3 · session assignment -> the click opens session s1 -> sessions : [] -> [s1]
// <- outcome : the dashboard reads the same click as 1 fixed, 3 sliding, 1 session   BECAUSE the shapes define different boundaries
//    derivation : sliding windows per event = window size / slide = 10 min / 2 min = 5, but only 3 overlap this event time`
    },
    {
      section: 'The window lifecycle',
      color: 'orange',
      motivation: `Windowing is more than "which bucket" — a window is assigned, merged, grouped, triggered, accumulated, and finally garbage-collected, so this section walks the full lifecycle in order.`,
      steps: [
        { num: 1, title: 'Assign', detail: 'Each element is assigned to a set of windows by its event time and the windowing function. <strong>A sliding window assigns one event to several windows at once.</strong>' },
        { num: 2, title: 'Merge', detail: 'Session windows <strong>merge</strong>: when a new event lands inside the gap of two existing sessions, the two sessions and the event collapse into one window. Merging is what makes sessions dynamic.' },
        { num: 3, title: 'Group and trigger', detail: 'Elements are <strong>grouped by (key, window)</strong> into the state that will be aggregated, then <strong>triggers</strong> decide when that state emits.' },
        { num: 4, title: 'Accumulate and garbage-collect', detail: 'Each emitted pane is <strong>accumulated</strong> per the accumulation mode, and the window state is <strong>garbage-collected</strong> once the watermark passes the window end plus allowed lateness.' }
      ],
      program: `// SESSION SIDE — two sessions merge when a bridging event lands inside the gap
// DEF: session gap — the inactivity threshold that splits sessions = 30 min
// DEF: session — a window [start, end) that closes after a 30-min gap = s1 [12:00, 12:10)
// DEF: sessions — the current set = { s1: [12:00, 12:10), s2: [12:40, 12:50) }
// -> input : event {event_time: "12:20:00"}
//    step 1 · the event is 20 min from s1 and 20 min from s2 -> both within the 30-min gap -> they merge
//    step 2 · the merged session spans s1 and s2 -> sessions : { s1, s2 } -> { sMerged: [12:00, 12:50) }
//    step 3 · the event folds into the merged session -> sMerged_count : 0 -> 3   BECAUSE s1 + s2 + the bridging event = 3 events
// <- outcome : one session [12:00, 12:50) replaces two   BECAUSE the 12:20 event was inside the gap of both
//    derivation : gap check = 12:20:00 - 12:10:00 = 10 min <= 30 min, and 12:40:00 - 12:20:00 = 20 min <= 30 min -> merge`
    },
    {
      section: 'Session semantics and pitfalls',
      color: 'green',
      motivation: `Sessions are powerful but subtle — their boundaries change as data arrives, so this section covers what the lifecycle implies and where implementations get it wrong.`,
      steps: [
        { num: 1, title: 'A session can merge late', detail: 'A late event can bridge two sessions that were already emitted separately. <strong>The pipeline must retract the two earlier panes and emit the merged one</strong> — this is why accumulation mode matters.' },
        { num: 2, title: 'Sessions are garbage-collected by watermark', detail: 'A session is not done when it looks idle; it is done when the <strong>watermark passes the session end plus allowed lateness</strong>. Until then, a late event can revive it.' },
        { num: 3, title: 'Session windows are keyed', detail: 'Sessions are per key — <strong>user A\'s session and user B\'s session never merge</strong> because they are in different key groups. The gap is measured within a key.' },
        { num: 4, title: 'Choose the window to match the question', detail: 'Fixed windows for periodic aggregates, sliding windows for moving averages, sessions for user behavior. <strong>The window shape is part of the answer, not an implementation detail.</strong>' }
      ],
      program: `// RETRACTION SIDE — a late event merges two already-emitted sessions, forcing a retraction
// DEF: session gap — 30 min; the two sessions s1 [12:00,12:10) and s2 [12:40,12:50) are already emitted
// DEF: retraction — a downstream signal that cancels a previously emitted pane = { s1, s2 }
// -> input : late event {event_time: "12:20:00", arrival: "13:01:00"}
//    step 1 · the late event bridges the gap -> sessions : { s1, s2 } -> { sMerged: [12:00, 12:50) }
//    step 2 · the pipeline emits a retraction for s1 and s2 -> downstream : {s1:3, s2:2} -> cancelled
//    step 3 · the pipeline emits the merged session -> downstream : {} -> {sMerged: 6}   BECAUSE 3 + 2 + 1 = 6
// <- outcome : downstream ends with one session of 6, not three sessions totaling 11   BECAUSE the retractions undid s1 and s2
//    derivation : merged count = s1_count + s2_count + bridging = 3 + 2 + 1 = 6`
    }
  ],

  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Why', title: '1. One window shape does not fit all questions', content: '<p><strong>Why.</strong> "How many per hour", "what is the rolling average", and "how long did a user stay" need different event-time boundaries.</p><p><strong>Claim.</strong> Fixed, sliding, and session windows are three shapes that answer three different kinds of questions.</p><p><strong>Grounding.</strong> The book builds the whole windowing model on these three shapes.</p><p><strong>In the wild.</strong> Beam, Flink, and Dataflow all expose these three window types.</p>' },
      { tag: 'solution', tagLabel: 'Shape', title: '2. Fixed windows', content: '<p><strong>Why.</strong> Periodic, comparable aggregates need equal, non-overlapping time buckets.</p><p><strong>Claim.</strong> Fixed windows partition time into equal, non-overlapping, contiguous spans; each event belongs to exactly one window.</p><p><strong>Grounding.</strong> They answer "how many per hour".</p><p><strong>In the wild.</strong> A 5-minute tumbling window in Flink is a fixed window.</p>' },
      { tag: 'solution', tagLabel: 'Shape', title: '3. Sliding windows', content: '<p><strong>Why.</strong> Moving averages need overlapping spans so a point in time contributes to several recent windows.</p><p><strong>Claim.</strong> Sliding windows are fixed-length, overlapping spans defined by a window size and a slide.</p><p><strong>Grounding.</strong> One event can belong to several sliding windows at once.</p><p><strong>In the wild.</strong> A 10-minute window sliding every 2 minutes is the canonical rolling average.</p>' },
      { tag: 'solution', tagLabel: 'Shape', title: '4. Session windows', content: '<p><strong>Why.</strong> User behavior is bursty and its boundaries follow the data, not the clock.</p><p><strong>Claim.</strong> A session is a burst of activity separated by a gap of inactivity; session boundaries are data-driven.</p><p><strong>Grounding.</strong> A 30-minute gap splits one visit into two sessions.</p><p><strong>In the wild.</strong> Web-analytics sessionization is the canonical session-window use case.</p>' },
      { tag: 'solution', tagLabel: 'Lifecycle', title: '5. The window lifecycle', content: '<p><strong>Why.</strong> Windowing is a pipeline of steps — assign, merge, group, trigger, accumulate, garbage-collect — not a single bucket lookup.</p><p><strong>Claim.</strong> Each element is assigned, session windows merge, elements group by (key, window), triggers emit, panes accumulate, and state is garbage-collected.</p><p><strong>Grounding.</strong> The lifecycle is the book\'s complete description of windowing.</p><p><strong>In the wild.</strong> Beam\'s WindowFn, trigger, and accumulation mode map onto these stages.</p>' },
      { tag: 'solution', tagLabel: 'Merge', title: '6. Session merging', content: '<p><strong>Why.</strong> Sessions that were separate can turn out to be one session when a bridging event arrives.</p><p><strong>Claim.</strong> When an event lands inside the gap of two sessions, the two sessions and the event merge into one window.</p><p><strong>Grounding.</strong> The merge changes the window set, not just a count.</p><p><strong>In the wild.</strong> Beam\'s mergeWindows is the production form.</p>' },
      { tag: 'tradeoff', tagLabel: 'Pitfall', title: '7. Late merges need retractions', content: '<p><strong>Why.</strong> A late event can bridge two sessions already emitted separately, so the earlier panes are now wrong.</p><p><strong>Claim.</strong> The pipeline must retract the two earlier panes and emit the merged one, or downstream double-counts.</p><p><strong>Grounding.</strong> Retraction is the only way to correct an already-emitted result.</p><p><strong>In the wild.</strong> Accumulating-and-retracting mode in Beam handles this.</p>' },
      { tag: 'tradeoff', tagLabel: 'Scope', title: '8. Sessions are keyed', content: '<p><strong>Why.</strong> A gap must be measured within one entity, not across unrelated entities.</p><p><strong>Claim.</strong> Sessions are per key — user A\'s session never merges with user B\'s, because the gap is measured within a key group.</p><p><strong>Grounding.</strong> Keying is what makes session windows per-user rather than global.</p><p><strong>In the wild.</strong> Grouping by user id before sessionizing is the production pattern.</p>' }
    ],
    examples: [
      { name: 'Google Analytics', desc: 'Sessionization of user visits with a 30-minute inactivity gap' },
      { name: 'Apache Beam', desc: 'Session windows with mergeWindows and accumulating-and-retracting for late merges' },
      { name: 'Apache Flink', desc: 'Event-time session windows with a gap and dynamic session merging' },
      { name: 'Flink SQL', desc: 'TUMBLE/HOP/SESSION constructs as the SQL spellings of the three window shapes' }
    ],
    extraHtml: ''
  },

  interview: [
    { scenario: "An analytics pipeline reports 'sessions per user', but a user who pauses for 20 minutes and returns is counted as two sessions while a 10-minute pause is one — and late events can merge sessions that were already reported.", q: "How do you model user sessions as windows, and what happens when a late event merges two already-reported sessions?", solution: "Use session windows with a gap threshold; when a late event bridges two already-emitted sessions, retract the two earlier panes and emit the merged one.", components: ["Session window — gap-based dynamic window", "Gap threshold — inactivity bound", "Merge — collapse two sessions + the bridging event", "Retraction — cancel the earlier panes"],  code: "// s1 [12:00,12:10), s2 [12:40,12:50)\n//   late event @ 12:20 -> bridges gap -> merge\n//   retract s1 (3), retract s2 (2)\n//   emit sMerged [12:00,12:50) count = 3+2+1 = 6", tieback: "This is exactly the session merging and retraction material in this chapter.", refs: ["4. Session windows", "6. Session merging", "7. Late merges need retractions"], problems: ["21-ad-click-aggregation"] },
    { scenario: "A dashboard needs both an hourly total and a rolling 10-minute average, but the team used one window type for both and the numbers look wrong.", q: "Which window shapes should each metric use, and why?", solution: "The hourly total is a fixed window (equal, non-overlapping buckets); the rolling average is a sliding window (10-minute window advancing every minute).", components: ["Fixed window — hourly total", "Sliding window — rolling 10-min average", "Window size + slide — defines the overlap"],  code: "// fixed   : event @ 12:04 belongs to [12:00,12:05) only\n// sliding : event @ 12:04 belongs to [11:55,12:05), [11:56,12:06), ... [12:04,12:14)\n//   -> count once vs count many", tieback: "This is exactly the fixed vs sliding window material in this chapter.", refs: ["2. Fixed windows", "3. Sliding windows"], problems: ["20-metrics-monitoring"] }
  ],
  systemDesign: {
    question: 'Design session-window analytics for user activity. Premise: a late event can bridge two already-emitted sessions, so the pipeline must retract the two stale panes and emit the merged session instead of double-counting.',
    pipeline: 'event source -> window assigner -> session merger -> keyed session state -> trigger/retraction emitter -> analytics store',
    decomposition: [
      { box: 'event source', role: 'event source — emits events with event time and a key',
        parts: [
          'a click {user: 42, event_time: "12:20:00"} arrives',
          'the key is user 42, so sessions are per-user',
          'a late event may arrive with event_time earlier than the watermark'
        ] },
      { box: 'window assigner', role: 'window assigner — assigns events to session windows',
        parts: [
          'the event is assigned to a new or existing session for user 42',
          'the gap threshold is 30 min of inactivity',
          'sessions are data-driven, not clock-aligned'
        ] },
      { box: 'session merger', role: 'session merger — merges sessions that a bridging event connects',
        parts: [
          's1 [12:00,12:10) and s2 [12:40,12:50) both sit within 30 min of the event',
          'the merger collapses them into sMerged [12:00, 12:50)',
          'the merged count folds s1 + s2 + the bridging event'
        ] },
      { box: 'trigger/retraction emitter', role: 'trigger/retraction emitter — emits and corrects panes',
        parts: [
          'the on-time trigger fires when the watermark passes a session end',
          'a late merge retracts the two earlier panes',
          'the merged pane is emitted so the store shows one session, not three'
        ] }
    ],
    
    program: `// SYSTEM DESIGN — a late event merges two sessions and the pipeline retracts the stale panes
// DEF: session gap — the inactivity threshold = 30 min
// DEF: retraction — a downstream signal that cancels a previously emitted pane = { s1, s2 }
// DEF: sessions — the current set for user 42 = { s1: [12:00, 12:10), s2: [12:40, 12:50) }
// STATE (before):
//    session_state : { s1: 3, s2: 2 }
// -> input : a late event {user: 42, event_time: "12:20:00"} arrives
//    step 1 · the event bridges s1 and s2 -> sessions : { s1, s2 } -> { sMerged: [12:00, 12:50) }   BECAUSE both gaps are within 30 min
//    step 2 · the pipeline retracts the stale panes -> session_state : { s1: 3, s2: 2 } -> cancelled
//    step 3 · the merged pane is emitted -> session_state : {} -> { sMerged: 6 }   BECAUSE 3 + 2 + 1 = 6
// <- outcome : the store shows one session of 6, not three sessions totaling 11   BECAUSE the retractions undid s1 and s2
//    derivation : merged count = s1_count + s2_count + bridging = 3 + 2 + 1 = 6`
  },
  quiz: [
    { question: "Which window shape is defined by the data rather than the clock?", options: ["A. Fixed", "B. Sliding", "C. Session", "D. Global"], answer: 3, explanation: "Session windows are dynamic — their boundaries follow bursts of activity and gaps.", conceptRef: "4. Session windows" },
    { question: "What defines a sliding window?", options: ["A. A gap of inactivity", "B. A window size and a slide", "C. A single fixed span", "D. A key"], answer: 2, explanation: "Sliding windows are fixed-length, overlapping spans defined by size and slide.", conceptRef: "3. Sliding windows" },
    { question: "When does a session window merge with another?", options: ["A. When the watermark passes", "B. When an event lands inside the gap of both", "C. When they share a key", "D. When allowed lateness expires"], answer: 2, explanation: "A bridging event inside the gap of two sessions merges them into one.", conceptRef: "6. Session merging" },
    { question: "Why do late session merges need retractions?", options: ["A. To save memory", "B. To cancel already-emitted panes and avoid double-counting", "C. To speed up the pipeline", "D. To reduce latency"], answer: 2, explanation: "Earlier panes are now wrong, so they must be retracted before the merged pane is emitted.", conceptRef: "7. Late merges need retractions" },
    { question: "Session windows are measured within a ___ .", options: ["A. partition", "B. key group", "C. global stream", "D. time zone"], answer: 2, explanation: "Sessions are per key — one user's session never merges with another's.", conceptRef: "8. Sessions are keyed" }
  ],
  sources: [
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'Session windows, merging, and the window lifecycle this chapter is built on' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'The window assign/merge/group/trigger/accumulate lifecycle as an API' },
    { name: 'Apache Flink — Windows', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/', note: 'Fixed, sliding, and session windows in a production engine' },
    { name: 'Apache Flink — Table API and SQL overview', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/overview/', note: 'TUMBLE/HOP/SESSION as SQL window constructs' }
  ]
});
