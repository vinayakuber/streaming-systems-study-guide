const CH08 = (() => {
  const S = require(require('path').resolve('tools', 'stream_seed.js'));
  const hm = (t) => S.hhmmss(t), mm = (t) => S.hhmmss(t).slice(0, 5);
  const W0 = S.WIN_STARTS[0], W0_END = W0 + S.WIN;
  const CI = S.closedAt(W0), CE = S.EVENTS[CI], L = S.LATE[0];
  const ONTIME = S.SUM(S.EVENTS.filter((e, i) => i <= CI && S.winOf(e.et) === W0).map(e => e.id));
  const TRUE = S.SUM(S.WINDOWS[W0]);
  const PERIOD = S.WIN / 2;
  const hopStarts = (et) => { const o = []; for (let st = 0; st <= et; st += PERIOD) if (et < st + S.WIN) o.push(st); return o; };
  const HOPS = hopStarts(CE.et);
  const sideWm = (k) => Math.max(...S.EVENTS.filter(e => e.key === k).map(e => e.et)) - S.LAG;
  const [WA, WB] = S.KEYS.map(sideWm);
  const RUN = S.EVENTS.filter(e => e.key === S.KEYS[0]).reduce((o, e) => o.concat((o.length ? o[o.length - 1] : 0) + e.v), []);
  const [OLD6, NEW6] = RUN.slice(-2);
  const clicks = S.EVENTS.filter(e => e.key === S.KEYS[0]), imps = S.EVENTS.filter(e => e.key === S.KEYS[1]);
  const MATCHES = clicks.reduce((n, c) => n + imps.filter(i => Math.abs(i.et - c.et) <= S.LAG).length, 0);
  const STUCK = clicks.filter(c => c.et + S.LAG >= Math.min(WA, WB));
  const STUCK_M = STUCK.reduce((n, c) => n + imps.filter(i => Math.abs(i.et - c.et) <= S.LAG).length, 0);
  const SC = STUCK.find(c => imps.some(i => Math.abs(i.et - c.et) <= S.LAG));
  if (ONTIME === TRUE || S.winOf(L.et) !== W0 || HOPS.length !== 2) throw new Error(`ch08 content: window ${W0} emits ${ONTIME} of ${TRUE}, late id ${L.id}, ${HOPS.length} HOP rows; the prose was checked against an on-time/late split and 2 HOP rows`);
  return { WIN: S.WIN, LAG: S.LAG, PERIOD, W0: `[${mm(W0)}, ${mm(W0_END)})`, W0_END: hm(W0_END), ONTIME, TRUE,
    CE_ID: CE.id, CE_KEY: CE.key, CE_ET: hm(CE.et), CE_V: CE.v, CE_PT: hm(CE.pt), CE_WM: hm(CE.et - S.LAG),
    L_ID: L.id, L_KEY: L.key, L_ET: hm(L.et), L_V: L.v, L_PT: hm(L.pt),
    HOP_N: HOPS.length, HOP_ROWS: HOPS.map(st => `[${mm(st)}, ${mm(st + S.WIN)})`).join(' + '),
    KA: S.KEYS[0], KB: S.KEYS[1], WA: hm(WA), WB: hm(WB), WMIN: hm(Math.min(WA, WB)),
    OLD6, NEW6, MATCHES, NCLICK: clicks.length, NSTUCK: STUCK.length, STUCK_M, SC_ID: SC.id, SC_BOUND: hm(SC.et + S.LAG) };
})();
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
      walkthroughs: ['ch08-sql', 'ch08-sql-memory'],
      color: 'cyan',
      motivation: `Declarative SQL lowers the barrier to stream processing, but the relational model must be adapted to time, so this section shows how familiar SQL maps onto a stream.`,
      steps: [
        { num: 1, title: 'A query over a stream is continuous', detail: 'A streaming SQL query is a <strong>continuous query</strong> — it runs forever and emits updated results as data arrives, rather than reading a finite table once.' },
        { num: 2, title: 'Relational operations map onto streams', detail: '<strong>SELECT is a transform, WHERE is a filter, GROUP BY is a keyed aggregation</strong> — the relational algebra of batch SQL maps onto the streaming transforms of the Beam model.' },
        { num: 3, title: 'Time becomes a first-class column', detail: 'A stream table has a <strong>time attribute</strong> (event time or processing time) that windows and joins use. <strong>Batch SQL has no notion of event time; streaming SQL does.</strong>' },
        { num: 4, title: 'Append-only vs updating streams', detail: 'Some query results are <strong>append-only</strong> (each row is a new fact); others are <strong>updating</strong> (a key\'s value changes, requiring a retraction of the old row). The table\'s update mode matters for sinks.' }
      ],
    },
    {
      section: 'Windows in SQL',
      walkthroughs: ['ch08-windows', 'ch08-windows-memory'],
      color: 'orange',
      motivation: `The key adaptation of SQL to streams is explicit windowing — batch SQL groups whole tables, while streaming SQL must say over which time slice each aggregate is computed, so this section covers the window constructs.`,
      steps: [
        { num: 1, title: 'TUMBLE — fixed windows', detail: '<strong>TUMBLE(size)</strong> is a fixed (tumbling) window: equal, non-overlapping spans. It is the SQL spelling of the fixed window from the Beam model.' },
        { num: 2, title: 'HOP — sliding windows', detail: '<strong>HOP(slide, size)</strong> is a sliding window: fixed length (size), advancing by slide. It is the SQL spelling of the sliding window.' },
        { num: 3, title: 'SESSION — session windows', detail: '<strong>SESSION(gap)</strong> is a session window: a burst of activity closed by a gap of inactivity. The query engine merges sessions as data arrives.' },
        { num: 4, title: 'The watermark drives emission', detail: 'A windowed aggregate emits when the <strong>watermark passes the window end</strong>. The time attribute (event time) plus the watermark is what makes SQL results correct under out-of-order data.' }
      ],
    },
    {
      section: 'Joins and time in SQL',
      walkthroughs: ['ch08-joins', 'ch08-joins-memory'],
      color: 'green',
      motivation: `Joins are where streaming SQL gets subtle — two streams never align in time the way two batch tables do — so this section covers windowed joins and the time semantics that make them correct.`,
      steps: [
        { num: 1, title: 'Stream-stream joins need windows', detail: 'Joining two unbounded streams requires a <strong>windowed join</strong> — match rows whose time attributes are within a window of each other — otherwise the join has no boundary.' },
        { num: 2, title: 'The watermark bounds the join', detail: 'A windowed join emits when <strong>both sides\' watermarks pass the join window</strong>, so a row is not emitted until both streams are complete for that window.' },
        { num: 3, title: 'Time attributes pick event or processing time', detail: 'Queries declare whether windows use <strong>event time</strong> (correct, can be late) or <strong>processing time</strong> (simple, no late data). Event time is the right default for correctness.' },
        { num: 4, title: 'SQL hides the mechanics, not the semantics', detail: 'Streaming SQL still obeys the Beam model underneath — <strong>the watermark, triggers, and accumulation are configured by the engine</strong>, but the user still chooses the window and time attribute.' }
      ],
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
    { scenario: "A team wants analysts to write ad-click aggregations in SQL over a live stream, but the results must be correct under out-of-order events.", q: "How do you expose a streaming pipeline as SQL with correct event-time semantics?", solution: "Use a streaming SQL engine with an event-time attribute; declare TUMBLE/HOP/SESSION windows and let the watermark drive when each window's result emits.", components: ["Streaming SQL engine — Flink SQL", "Time attribute — event time", "Window — TUMBLE/HOP/SESSION", "Watermark — drives emission"],  code: `SELECT window_start, SUM(v)\nFROM clicks\nGROUP BY TUMBLE(et, INTERVAL '${CH08.WIN}' SECOND)\n-- ${CH08.W0} emits ${CH08.ONTIME} once the watermark reaches ${CH08.CE_WM},\n-- then ${CH08.TRUE} when late id ${CH08.L_ID} arrives at ${CH08.L_PT}`, tieback: "This is exactly the streaming-SQL window material in this chapter.", refs: ["3. Time attributes", "4. TUMBLE, HOP, SESSION", "7. The watermark drives SQL emission"], problems: ["21-ad-click-aggregation", "20-metrics-monitoring"] },
    { scenario: "A SQL query joins clicks with impressions, but it emits matches before a late impression could still arrive, producing incomplete rows.", q: "How do you make a stream-stream SQL join correct under out-of-order data?", solution: "Use a windowed (interval) join and let the watermark bound it — the join emits a match only when both sides' watermarks pass the join window.", components: ["Windowed join — interval bound", "Watermark — both sides pass", "Hold — buffer until complete"],  code: `SELECT ...\nFROM clicks c JOIN impressions i\n  ON i.et BETWEEN c.et - INTERVAL '${CH08.LAG}' SECOND\n              AND c.et + INTERVAL '${CH08.LAG}' SECOND\n-- emits when min(${CH08.WA}, ${CH08.WB}) = ${CH08.WMIN} passes the bound`, tieback: "This is exactly the windowed-join material in this chapter.", refs: ["6. Windowed joins", "7. The watermark drives SQL emission"], problems: ["21-ad-click-aggregation"] }
  ],
  systemDesign: {
    walkthroughs: ['ch08-system', 'ch08-system-memory'],
    question: 'Design a continuous SQL query that keeps a click total current. Premise: the query buckets clicks into a TUMBLE window and updates the result only when the watermark closes the window, so the count stays correct as late clicks arrive.',
    pipeline: 'streams (clicks, impressions) -> SQL engine (continuous query) -> watermark + window -> updating result -> sink',
    decomposition: [
      { box: 'streams (clicks, impressions)', role: 'streams — feed the SQL engine with event-time data',
        parts: [
          `id ${CH08.CE_ID} {key: "${CH08.CE_KEY}", et: "${CH08.CE_ET}", v: ${CH08.CE_V}} arrives at ${CH08.CE_PT}`,
          `id ${CH08.L_ID} {key: "${CH08.L_KEY}", et: "${CH08.L_ET}", v: ${CH08.L_V}} arrives at ${CH08.L_PT}, after its window has emitted`,
          'both carry event time for the query\'s time attribute'
        ] },
      { box: 'SQL engine (continuous query)', role: 'SQL engine — runs the query forever',
        parts: [
          `the query groups by TUMBLE(et, ${CH08.WIN} s) — one total per window`,
          'the engine folds each row into the right window',
          'updating results emit retractions for changed windows'
        ] },
      { box: 'watermark + window', role: 'watermark + window — decides when results emit',
        parts: [
          `the watermark reaches ${CH08.CE_WM} after id ${CH08.CE_ID} (et ${CH08.CE_ET} − ${CH08.LAG} s) and closes ${CH08.W0}, which emits ${CH08.ONTIME}`,
          `a HOP(${CH08.PERIOD} s, ${CH08.WIN} s) window would put id ${CH08.CE_ID} into ${CH08.HOP_N} rows, ${CH08.HOP_ROWS}`,
          `a join waits for both sides\' watermarks: min(${CH08.WA}, ${CH08.WB}) = ${CH08.WMIN}`
        ] },
      { box: 'sink', role: 'sink — applies the updating result',
        parts: [
          `the sink receives ${CH08.ONTIME} for ${CH08.W0}, then ${CH08.ONTIME} retracted and ${CH08.TRUE} added when id ${CH08.L_ID} arrives at ${CH08.L_PT}`,
          'append-only sinks are simpler but wrong for updating results',
          'an upsert sink applies retractions correctly'
        ] }
    ],
    
  },
  quiz: [
    { question: "What is a continuous query?", options: ["A. A query that runs once", "B. A query that runs forever and emits updated results", "C. A batch query", "D. A query with no windows"], answer: 2, explanation: "A continuous query runs forever over the stream, emitting updated results.", conceptRef: "2. Continuous queries" },
    { question: "Which SQL window is a fixed (tumbling) window?", options: ["A. HOP", "B. SESSION", "C. TUMBLE", "D. OVER"], answer: 3, explanation: "TUMBLE is the fixed, non-overlapping window.", conceptRef: "4. TUMBLE, HOP, SESSION" },
    { question: "What does a time attribute provide?", options: ["A. A wall-clock reading", "B. An event-time or processing-time column windows and joins key on", "C. A window size", "D. A retraction"], answer: 2, explanation: "A time attribute tells windows and joins which time to use.", conceptRef: "3. Time attributes" },
    { question: "An updating query result requires ___ .", options: ["A. only append rows", "B. a retraction of the old row", "C. no sink", "D. a batch table"], answer: 2, explanation: "When a key's value changes, the old row must be retracted.", conceptRef: "5. Append-only vs updating results" },
    { question: "When does a windowed SQL join emit a match?", options: ["A. When the first row arrives", "B. When both sides' watermarks pass the join window", "C. Every second", "D. When the query starts"], answer: 2, explanation: "The join waits until both streams are complete for the window.", conceptRef: "6. Windowed joins" }
  ],
  seeAlso: [
    { to: 2, section: 'What and Where — transformations and windowing', depth: 'streaming SQL is a declarative spelling of the what/where/when/how model — SELECT/WHERE/GROUP BY (what), TUMBLE/HOP/SESSION (where), watermark + trigger (when), retraction (how).', example: `ch08's GROUP BY TUMBLE is ch02's "what + where"; ch08's retraction of ${CH08.ONTIME} before ${CH08.TRUE} for ${CH08.W0} is ch02's accumulating-and-retracting mode.` },
    { to: 3, section: 'Propagation and correctness', depth: 'the watermark that drives SQL emission is the same completeness signal ch03 defines — and it propagates as the minimum across a query\'s inputs.', example: `ch08's TUMBLE window ${CH08.W0} emits when the watermark passes ${CH08.W0_END}, which happens after id ${CH08.CE_ID}; ch03 shows that watermark = max_seen ${CH08.CE_ET} − ${CH08.LAG} s = ${CH08.CE_WM}, and for a join min(${CH08.WA}, ${CH08.WB}) = ${CH08.WMIN}.` },
    { to: 4, section: 'Window shapes — fixed, sliding, session', depth: 'TUMBLE/HOP/SESSION are the SQL spellings of ch04\'s fixed/sliding/session windows, including session merging.', example: `ch08's HOP(${CH08.PERIOD} s, ${CH08.WIN} s) putting id ${CH08.CE_ID} (et ${CH08.CE_ET}) into ${CH08.HOP_N} rows is ch04's sliding window ${CH08.HOP_ROWS}; ch08's SESSION is ch04's gap-based merge.` },
    { to: 6, section: 'The duality', depth: 'append-only vs updating results is the stream/table duality in SQL — an updating query emits a changelog, an append-only query emits a stream of facts.', example: `ch08's "updating result retracts ${CH08.ONTIME} then adds ${CH08.TRUE}" for ${CH08.W0} is ch06's changelog record carrying old → new: ch06's last update, ${CH08.OLD6} → ${CH08.NEW6}, sums to ${CH08.OLD6} − ${CH08.OLD6} + ${CH08.NEW6} = ${CH08.NEW6} only because the old value travels with it; ch08's append-only mode is ch06's plain stream.` },
    { to: 9, section: 'Windowed and temporal joins', depth: 'SQL joins are where windowing, watermarks, and the stream/table duality meet — ch09 covers windowed (interval) and temporal joins in depth.', example: `ch08's Q2 interval join, i.et within ${CH08.LAG} s of c.et, is ch09's windowed join with its ${CH08.LAG} s bound and ${CH08.MATCHES} true matches; ch08's "join emits when both watermarks pass", min(${CH08.WA}, ${CH08.WB}) = ${CH08.WMIN}, is why ch09's click ${CH08.SC_ID} (bound ${CH08.SC_BOUND}) never emits: ${CH08.NSTUCK} of its ${CH08.NCLICK} clicks wait forever, holding ${CH08.STUCK_M} of the ${CH08.MATCHES} matches.` }
  ],
  sources: [
    { name: 'Apache Flink — Table API and SQL overview', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/overview/', note: 'Continuous queries, time attributes, and window constructs in streaming SQL' },
    { name: 'ksqlDB documentation', url: 'https://docs.ksqldb.io/', note: 'A streaming SQL engine over Kafka streams and tables' },
    { name: 'Apache Beam — Beam SQL', url: 'https://beam.apache.org/documentation/dsls/sql/', note: 'Declarative SQL over Beam pipelines' },
    { name: 'Akidau et al. — "The Dataflow Model" (VLDB 2015)', url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', note: 'The model that streaming SQL engines implement underneath' }
  ]
});
