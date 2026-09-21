# Streaming Systems Study Guide

Study guide for **"Streaming Systems: The What, Where, When, and How of Large-Scale Data Processing"** by Tyler Akidau, Slava Chernyak & Reuven Lax (O'Reilly, 2018) — all 10 chapters, in book order.

> **Read on GitHub / mobile:** [docs/README.md](docs/README.md) — all 10 chapters as Markdown, with flows, annotated `explain-program` traces (gate-checked R1–R16), key concepts, and tap-to-reveal quizzes.

This is the fourth knowledge base in the series, alongside the [DDIA study guide](https://github.com/vinayakuber/ddia-study-guide), the [Distributed Patterns study guide](https://github.com/vinayakuber/distributed-patterns-study-guide), and the [Microservice Patterns study guide](https://github.com/vinayakuber/microservices-io-study-guide).

## Sources (strict)

1. **Streaming Systems** — Tyler Akidau, Slava Chernyak & Reuven Lax, O'Reilly, 2018.

> The source PDF is used **only** to extract the chapter structure and concept
> list. All prose, program traces, diagrams, and quizzes in this repo are
> **original** — paraphrased concepts, original worked examples, and no
> reproduction of the book's figures or prose.

## Repository layout

- `content/chNN-*.js` — the source of truth for each chapter (flow sections, annotated program traces, concepts, quiz).
- `docs/chNN-*.md` — GitHub-rendered Markdown (generated from `content/` by `node tools/to_markdown.js "Streaming Systems Study Guide"`).
- `js/chapters-registry.js` — the two parts (Part I: The Beam Model, Part II: Streams and Tables) + `registerChapter()`.
- `explain-program/` — the authoring standard and its enforcement notes.
- `tools/` — the gate, the mermaid validator, and the Markdown generator.

## The explain-program gate (R1–R16)

Every annotated program block must be a real execution trace with concrete values:

- **R1** — every `// ->` / `// <-` line carries a concrete value.
- **R2** — every `DEF` block contains a concrete value.
- **R3** — each block has ≥ 4 concrete-value lines.
- **R4** — each block has ≥ 3 `x : old -> new` value transformations.
- **R7** — state is declared (`name : {...}`) before it is mutated.
- **R9** — a dedup/idempotency claim shows the actual guard operation.
- **R12** — every non-generic state-container stem is itself defined.
- **R14** — each chapter covers both a write path and a read path.
- **R16** — each chapter carries a `systemDesign` decomposition + wiring.

Run the gate and the mermaid validator from the repo root:

```bash
node tools/explain_program_gate.js   # 38 programs · 0 issues
node tools/validate_mermaid.js       # 110 mermaid blocks · 0 issues
```

## Chapter map

| # | Chapter | Part |
|---|---|---|
| 1 | Streaming 101 | I · The Beam Model |
| 2 | The What, Where, When, and How of Data Processing | I |
| 3 | Watermarks | I |
| 4 | Advanced Windowing | I |
| 5 | Exactly-Once and Side Effects | I |
| 6 | Streams and Tables | II · Streams and Tables |
| 7 | The Practicalities of Persistent State | II |
| 8 | Streaming SQL | II |
| 9 | Streaming Joins | II |
| 10 | The Evolution of Large-Scale Data Processing | II |

See [CHAPTER_INDEX.md](CHAPTER_INDEX.md) for the full catalog and
[PROBLEM_MAP.md](PROBLEM_MAP.md) for how each chapter backs the 28 system-design
problems in [system-design-deep-dives](https://github.com/vinayakuber/system-design-deep-dives).
