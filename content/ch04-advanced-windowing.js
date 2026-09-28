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
// DEF: sliding window — a 10-min span that advances every 2 min = [12:00, 12:10)
// DEF: session window — a burst that closes after a 30-min gap of inactivity = { s1 }
// STATE (before):
//    fixed_count : 0
// ======================================================================
// offset 0: {event_time: "12:04:00"}
// offset 1: {event_time: "12:04:00", shape: "same click"}
// ======================================================================
// BUILD PHASE · run once at pipeline start
// step 0 · initialize the per-shape registers -> fixed_count : none -> 0, slide_count : none -> 0, sessions : none -> []
//    -> input  : window definitions = fixed 5-min, sliding 10-min every 2 min, session 30-min gap
//    <- output : fixed_count = 0, slide_count = 0, sessions = []   BECAUSE no click has been assigned yet
// QUERY PHASE · per arriving click
// step 1 · fixed assignment -> fixed_count : 0 -> 1
//    -> input  : click.event_time = "12:04:00", fixed span = [12:00, 12:05)
//    <- output : fixed_count = 1   BECAUSE 12:04:00 falls only in [12:00, 12:05)
// step 2 · sliding assignment -> slide_count : 0 -> 3
//    -> input  : click.event_time = "12:04:00", windows = [12:00,12:10), [12:02,12:12), [12:04,12:14)
//    <- output : slide_count = 3   BECAUSE 12:04:00 overlaps [12:00,12:10), [12:02,12:12), and [12:04,12:14)
// step 3 · session assignment -> sessions : [] -> ["s1"]
//    -> input  : click.event_time = "12:04:00", session gap = 30 min
//    <- output : sessions = ["s1"]   BECAUSE the click opens a new burst
// ======================================================================
// TRACE (click 12:04:00):
//    shape    | spans                                          | count
//    fixed    | [12:00, 12:05)                                 | 1
//    sliding  | [12:00,12:10),[12:02,12:12),[12:04,12:14)      | 3
//    session  | [s1]                                           | 1
// CORRECTNESS (assignment-invariant lemma): a click is assigned to every window whose span contains its event time —
//    12:04:00 lies in exactly one fixed span, three overlapping sliding spans, and one freshly opened session, so each
//    shape counts the click exactly once and the three counts never disagree on the same underlying event.
// VARIANTS (when to pick which):
//    fixed window   -> one window-assignment check, non-overlapping spans (use for periodic totals)   <- THIS ONE
//    sliding window -> one assignment per overlapping span, overlapping spans (use for moving averages)
//    session window -> one session assignment, data-driven span (use for bursts of activity)
//    global window  -> one add per event into the single bucket, one bucket for the whole stream (use for an all-time total)
// ======================================================================
// downstream : dashboard reads click 12:04:00 -> fixed 1 -> sliding 3 -> session 1   BECAUSE the shapes define different boundaries for the same event
//    derivation : sliding overlap = 3 windows = 5 - 2   BECAUSE 5 possible 10-min windows minus the 2 that end before 12:04`
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
// DEF: s1 — a session window = [12:00, 12:10)
// DEF: s2 — a session window = [12:40, 12:50)
// STATE (before):
//    sessions : { "s1": [12:00, 12:10), "s2": [12:40, 12:50) }
// ======================================================================
// offset 0: {event_time: "12:20:00"}
// offset 1: {event_time: "12:20:00", role: "bridge"}
// ======================================================================
// BUILD PHASE · run once when the two sessions are opened
// step 0 · initialize the session set and gap threshold -> sessions : none -> { "s1": [12:00, 12:10), "s2": [12:40, 12:50) }, gap : none -> 30 min
//    -> input  : session gap = 30 min, s1 = [12:00, 12:10), s2 = [12:40, 12:50)
//    <- output : sessions = { "s1", "s2" }, gap = 30 min   BECAUSE the two sessions are already open
// QUERY PHASE · per arriving event
// step 1 · the event is 10 min from s1's end and 20 min from s2's start -> gap_check : "apart" -> "bridging"
//    -> input  : event.event_time = "12:20:00", s1 = [12:00, 12:10), s2 = [12:40, 12:50), gap = 30 min
//    decode 1a · measure the gap from the event to s1's end -> gap_to_s1 : none -> 10 min
//    decode 1b · measure the gap from the event to s2's start -> gap_to_s2 : none -> 20 min
//    decode 1c · compare both gaps against the 30-min threshold -> gap_check : "apart" -> "bridging"
//    <- output : gap_check = "bridging"   BECAUSE both distances are within the 30-min gap
// step 2 · the merged session spans s1 and s2 -> sessions : { "s1", "s2" } -> { "sMerged": [12:00, 12:50) }
//    -> input  : s1 = [12:00, 12:10), s2 = [12:40, 12:50), gap_check = "bridging"
//    <- output : sessions = { "sMerged": [12:00, 12:50) }   BECAUSE the bridge joins the two ends
// step 3 · the event folds into the merged session -> sMerged_count : 0 -> 3
//    -> input  : s1_count = 1, s2_count = 1, bridge = 1 event
//    <- output : sMerged_count = 3   BECAUSE s1 + s2 + the bridging event = 3 events
// ======================================================================
// TRACE (bridge event 12:20:00, gap = 30 min):
//    distance to s1 end | distance to s2 start | threshold | action
//    10 min             | 20 min               | 30 min    | merge
// CORRECTNESS (merge-invariant lemma): a session merges exactly when the bridging event sits within the gap of both
//    neighbors — 12:20:00 is 10 min from s1's end and 20 min from s2's start, both <= 30 min, so the three collapse
//    into one span [12:00, 12:50) and the merged count is s1 + s2 + the bridge = 3 events.
// VARIANTS (when to pick which):
//    gap measured to nearest end/start -> one check per neighbor (use for few sessions)   <- THIS ONE
//    interval tree of sessions          -> one tree lookup per event (use when thousands of sessions are open)
//    fixed window (no merge)            -> one assignment per event, no dynamic span (use when boundaries must stay clock-aligned)
// ======================================================================
// downstream : s1 [12:00,12:10) -> s2 [12:40,12:50) -> bridge 12:20:00 -> sMerged [12:00,12:50) count 3   BECAUSE the 12:20 event was inside the gap of both
//    derivation : gap to s1 = 20 - 10 = 10 min <= 30, gap to s2 = 40 - 20 = 20 min <= 30 -> merge`
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
// DEF: session gap — the inactivity threshold = 30 min
// DEF: retraction — a downstream signal that cancels a previously emitted pane = { "s1", "s2" }
// DEF: s1, s2 — already-emitted sessions = { "s1": 3, "s2": 2 }
// STATE (before):
//    downstream : { "s1": 3, "s2": 2 }
// ======================================================================
// offset 0: {event_time: "12:20:00", arrival: "13:01:00"}
// offset 1: {event_time: "12:20:00", role: "late bridge"}
// ======================================================================
// BUILD PHASE · run once when s1 and s2 are emitted
// step 0 · initialize the downstream state and retraction set -> downstream : none -> { "s1": 3, "s2": 2 }, retraction : none -> { "s1", "s2" }
//    -> input  : already-emitted sessions = { "s1": 3, "s2": 2 }
//    <- output : downstream = { "s1": 3, "s2": 2 }, retraction = { "s1", "s2" }   BECAUSE both panes are now stale
// QUERY PHASE · per late event
// step 1 · the late event bridges the gap -> sessions : { "s1", "s2" } -> { "sMerged": [12:00, 12:50) }
//    -> input  : event.event_time = "12:20:00", s1 = [12:00, 12:10), s2 = [12:40, 12:50)
//    <- output : sessions = { "sMerged": [12:00, 12:50) }   BECAUSE both gaps are within 30 min
// step 2 · the pipeline emits a retraction for s1 and s2 -> downstream : { "s1": 3, "s2": 2 } -> {}
//    -> input  : downstream = { "s1": 3, "s2": 2 }, retraction = { "s1", "s2" }
//    <- output : downstream = {}   BECAUSE the earlier panes are now stale
// step 3 · the pipeline emits the merged session -> downstream : {} -> { "sMerged": 6 }
//    -> input  : downstream = {}, merged count = 3 + 2 + 1
//    <- output : downstream = { "sMerged": 6 }   BECAUSE 3 + 2 + 1 = 6
// ======================================================================
// TRACE (late bridge 12:20:00):
//    step          | downstream       | total
//    retract s1    | { "s2": 2 }      | 2
//    retract s2    | {}               | 0
//    emit merged   | { "sMerged": 6 } | 6
// CORRECTNESS (retraction-invariant lemma): a corrected merge emits retractions for exactly the panes it replaces before
//    the merged pane lands — s1 (3) and s2 (2) are retracted, then sMerged = 3 + 2 + 1 = 6 is emitted, so the sink
//    totals 6, never the 11 a naive double-count would produce.
// VARIANTS (when to pick which):
//    retract then emit -> one retraction + one emit, sink must undo (use for an idempotent store)   <- THIS ONE
//    emit delta only   -> one delta write, sink applies the difference (use when the sink can add deltas)
//    drop late data    -> one discard of the late event, no correction (use when late merges are rare and cost > value)
// ======================================================================
// downstream : s1 3 -> s2 2 -> retraction -> sMerged 6   BECAUSE the retractions undid s1 and s2, so the total is 6 not 11
//    derivation : merged count = 3 + 2 + 1 = 6   BECAUSE s1_count + s2_count + the bridging event`
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
// DEF: retraction — a downstream signal that cancels a previously emitted pane = { "s1", "s2" }
// DEF: sessions — the current set for user 42 = { "s1": [12:00, 12:10), "s2": [12:40, 12:50) }
// STATE (before):
//    session_state : { "s1": 3, "s2": 2 }
// ======================================================================
// offset 0: {user: 42, event_time: "12:20:00"}
// offset 1: {user: 42, event_time: "12:20:00", arrival: "13:01:00"}
// ======================================================================
// step 1 · the event bridges s1 and s2 -> sessions : { "s1", "s2" } -> { "sMerged": [12:00, 12:50) }
//    -> input  : event.event_time = "12:20:00", s1 = [12:00, 12:10), s2 = [12:40, 12:50)
//    <- output : sessions = { "sMerged": [12:00, 12:50) }   BECAUSE both gaps are within 30 min
// step 2 · the pipeline retracts the stale panes -> session_state : { "s1": 3, "s2": 2 } -> {}
//    -> input  : session_state = { "s1": 3, "s2": 2 }, retraction = { "s1", "s2" }
//    <- output : session_state = {}   BECAUSE the earlier panes are now wrong
// step 3 · the merged pane is emitted -> session_state : {} -> { "sMerged": 6 }
//    -> input  : session_state = {}, merged count = 3 + 2 + 1
//    <- output : session_state = { "sMerged": 6 }   BECAUSE 3 + 2 + 1 = 6
// ======================================================================
// downstream : s1 3 -> s2 2 -> retraction -> sMerged 6   BECAUSE the store must show one session, not three totaling 11
//    derivation : merged count = 3 + 2 + 1 = 6   BECAUSE s1_count + s2_count + the bridging event`
  },
  quiz: [
    { question: "Which window shape is defined by the data rather than the clock?", options: ["A. Fixed", "B. Sliding", "C. Session", "D. Global"], answer: 3, explanation: "Session windows are dynamic — their boundaries follow bursts of activity and gaps.", conceptRef: "4. Session windows" },
    { question: "What defines a sliding window?", options: ["A. A gap of inactivity", "B. A window size and a slide", "C. A single fixed span", "D. A key"], answer: 2, explanation: "Sliding windows are fixed-length, overlapping spans defined by size and slide.", conceptRef: "3. Sliding windows" },
    { question: "When does a session window merge with another?", options: ["A. When the watermark passes", "B. When an event lands inside the gap of both", "C. When they share a key", "D. When allowed lateness expires"], answer: 2, explanation: "A bridging event inside the gap of two sessions merges them into one.", conceptRef: "6. Session merging" },
    { question: "Why do late session merges need retractions?", options: ["A. To save memory", "B. To cancel already-emitted panes and avoid double-counting", "C. To speed up the pipeline", "D. To reduce latency"], answer: 2, explanation: "Earlier panes are now wrong, so they must be retracted before the merged pane is emitted.", conceptRef: "7. Late merges need retractions" },
    { question: "Session windows are measured within a ___ .", options: ["A. partition", "B. key group", "C. global stream", "D. time zone"], answer: 2, explanation: "Sessions are per key — one user's session never merges with another's.", conceptRef: "8. Sessions are keyed" }
  ],
  seeAlso: [
    { to: 2, section: 'What and Where — transformations and windowing', depth: 'the window is the "where" axis of the four-question model; ch02 fixes that axis against the other three (what/when/how).', example: 'ch04\'s fixed vs sliding vs session shapes are the "where" choice; ch02 shows the same click 12:04:00 answering 1 fixed, 3 sliding, or 1 session result, with the trigger deciding when each emits.' },
    { to: 3, section: 'Propagation and correctness', depth: 'a window\'s lifecycle ends with garbage collection, and the watermark is what decides when a window is done — ch03 defines the signal that drives it.', example: 'ch04\'s "session done when watermark passes end + lateness" is ch03\'s watermark 12:06:30 closing [12:00,12:05); the skew formula (max_seen 12:08:30 − 120 s) is what produced that watermark.' },
    { to: 8, section: 'Windows in SQL', depth: 'TUMBLE/HOP/SESSION are the SQL spellings of this chapter\'s fixed/sliding/session shapes, with the watermark driving emission.', example: 'ch04\'s session [12:00,12:50) after a 12:20:00 bridge event is what Flink SQL\'s SESSION(gap) computes; ch04\'s sliding 10-min/2-min is ch08\'s HOP(10 min, 2 min).' },
    { to: 7, section: 'Checkpoints and state stores', depth: 'window state is exactly the state that a stateful processor must persist; ch07 covers how that per-window state is snapshotted and recovered.', example: 'ch04\'s per-window counts and session sets live in keyed state; ch07 shows that same state as { 42: 13 } being checkpointed with its offset so a restart resumes without recomputing the windows.' }
  ],
  sources: [
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'Session windows, merging, and the window lifecycle this chapter is built on' },
    { name: 'Apache Beam programming guide', url: 'https://beam.apache.org/documentation/programming-guide/', note: 'The window assign/merge/group/trigger/accumulate lifecycle as an API' },
    { name: 'Apache Flink — Windows', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/', note: 'Fixed, sliding, and session windows in a production engine' },
    { name: 'Apache Flink — Table API and SQL overview', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/overview/', note: 'TUMBLE/HOP/SESSION as SQL window constructs' }
  ]
});
