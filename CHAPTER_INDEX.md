# Streaming Systems — chapter index (from Tyler Akidau, Slava Chernyak & Reuven Lax, "Streaming Systems", O'Reilly 2018)

| # | Chapter | Part | One-line scope |
|---|---|---|---|
| 1 | Streaming 101 | I · The Beam Model | What streaming is; event time vs processing time; the terms every later chapter uses. |
| 2 | The What, Where, When, and How of Data Processing | I | The four questions that fully specify a pipeline: transformations, windowing, triggers, accumulation. |
| 3 | Watermarks | I | The monotonic completeness signal — perfect vs heuristic, skew, and propagation across stages. |
| 4 | Advanced Windowing | I | Fixed / sliding / session windows, and the assign→merge→group→trigger→accumulate→GC lifecycle. |
| 5 | Exactly-Once and Side Effects | I | Deduplication, idempotency, replayable sources, and why external side effects are the hard part. |
| 6 | Streams and Tables | II · Streams and Tables | The duality: a stream is a table's change log, a table is a stream's materialized view. |
| 7 | The Practicalities of Persistent State | II | Checkpoints, state stores, barriers, incremental snapshots, and exactly-once recovery. |
| 8 | Streaming SQL | II | Continuous queries, time attributes, TUMBLE/HOP/SESSION, and watermark-driven emission. |
| 9 | Streaming Joins | II | Windowed (interval) joins, temporal (stream-table) joins, and join-state correctness. |
| 10 | The Evolution of Large-Scale Data Processing | II | MapReduce → Lambda → Kappa, and batch as a special case of streaming. |

Each chapter file lives at `docs/chNN-*.md` (generated from `content/chNN-*.js`).
