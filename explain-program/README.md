# /explain-program — annotation standard

This directory is the canonical spec for the `/explain-program` annotation
standard that this repo's content must satisfy. It is kept in sync across the
four study-guide repos (ddia, olap-system-design, streaming-systems,
distributed-patterns). The source of truth is the skill itself; `SKILL.md` here
is a verbatim copy of it, so a diff against the skill shows any drift.

## Files

- **SKILL.md** — the full skill: the annotation markers (`DEF` / `->` / `<-`),
  the R1–R86 rules, the execution-trace standard, the placement table, the
  generated-diagram pipeline, the standard WHY → WHEN → DIAGRAM → PROGRAM block,
  and the self-audit.
- **definition-coverage.md** — the R12 rule note: definition *coverage*, not
  presence (declaring a container does not define the concept it holds).
- **system-design-wiring.md** — the R15 + R16 rule note: no bare black-box
  component, and the per-chapter `systemDesign` field (pipeline +
  decomposition + wiring diagram + annotated program).

## Enforcement & rendering

- `tools/verify_all.sh` — the full suite: regenerates every artifact from the
  seed, rebuilds `docs/`, and runs every gate. Run it before pushing; it prints
  the authoritative gate count (R49), so this file does not list them.
- `tools/explain_program_gate.js` — the R1–R16 gate on the prose program blocks.
- `tools/to_markdown.js` — the single writer of `docs/` (R51); splices each
  walkthrough's `embed.md` into the section that declares it.
- `tools/pre-commit` — blocks a commit when the explain-program or diagram
  gates report any issue.
