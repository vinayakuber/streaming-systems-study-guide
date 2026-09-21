# Streaming Systems → the 28 problems (mapped + ranked)

Where each of the 10 chapters of **Streaming Systems** backs a problem in
`system-design-deep-dives`. Ranked strongest-first; **⭐ PICK** = the chapter that
owns the concept, **🥈** = strong secondary, **🥉** = supporting.

Books: **DDIA** · **PDS** (Patterns of Distributed Systems) · **MSP** (Microservice Patterns) · **SS** (Streaming Systems).

| # | Problem | ⭐ PICK | 🥈 Secondary | 🥉 Supporting |
|---|---|---|---|---|
| 10 | Notification system | — (MSP messaging/outbox owns it) | SS ch05 Exactly-once (retry-safe delivery) | SS ch02 (triggers) |
| 11 | News feed | — (MSP CQRS/domain events own it) | SS ch06 Streams and Tables (feed = materialized view) | SS ch09 (fan-out join) |
| 12 | Chat system | — (DDIA log-based broker owns it) | SS ch06 (message log = stream, unread = table) | SS ch01 (event vs processing time) |
| 15 | Google Drive | — (PDS version vector owns it) | SS ch06 (doc = table of a mutation stream) | SS ch07 (checkpointed sync state) |
| 17 | Nearby friends | — (PDS state watch/gossip owns it) | SS ch06 (location = table over a move stream) | SS ch03 (late location events) |
| 19 | Distributed message queue | — (DDIA log-based broker owns it) | SS ch06 (log = stream, consumer offset = table) | SS ch07 (checkpointed consumer state) |
| **20** | **Metrics monitoring** | **SS ch03 Watermarks + ch04 Advanced Windowing** | SS ch02 What/Where/When/How · ch08 Streaming SQL | SS ch07 Persistent State · ch10 Evolution |
| **21** | **Ad-click aggregation** | **SS ch03 Watermarks + ch04 Advanced Windowing + ch05 Exactly-Once** | SS ch02 · ch07 Persistent State | SS ch08 Streaming SQL · ch10 Evolution |
| 23 | Distributed email | — (MSP outbox/messaging owns it) | SS ch05 Exactly-once (no duplicate send) | SS ch06 (inbox = table of a mail stream) |
| 26 | Payment system | — (MSP saga owns it) | SS ch05 Exactly-Once and Side Effects (idempotency key) | SS ch06 Streams and Tables (ledger = table) |

## The two problems this book exists to back

- **20 Metrics monitoring** — the aggregation/downsampling path was described as a
  "stream processor" but the *streaming semantics* (event-time windows, the
  watermark that closes a window, checkpointed state, TUMBLE in streaming SQL,
  batch-as-a-special-case for rollups) had no source. Chapters **02, 03, 04, 07,
  08, 10** now back it.
- **21 Ad-click aggregation** — event time, watermarks, tumbling/sliding windows,
  exactly-once, kappa, and checkpointing were all named but sourced only to the
  one-page DDIA Ch12 summary. Chapters **02, 03, 04, 05, 07, 10** now back each
  named concept with a chapter-length treatment.

For the full 28-problem × 4-book map, see
[`microservices-io-study-guide/PROBLEM_MAP.md`](https://github.com/vinayakuber/microservices-io-study-guide/blob/main/PROBLEM_MAP.md).
