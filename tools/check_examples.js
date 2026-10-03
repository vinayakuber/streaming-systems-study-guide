#!/usr/bin/env node
'use strict';
/*
 * check_examples.js — every variation program must ship a WORKED EXAMPLES table: several
 * input/output pairs, including the edge cases, each one ASSERTED rather than printed.
 *
 * WHY THIS GATE: a problem statement plus a solution is not enough to learn from. A reader
 * needs to see the mapping on concrete inputs, especially the ones that decide the design
 * (both sides of a boundary, an empty input, a value past the end, and the scale the
 * statement actually names). Prose examples go stale silently; a declared table that the
 * program asserts cannot, because the program stops running when the answer changes.
 *
 * It checks three things it can check mechanically:
 *   1. a module-level EXAMPLES list with at least MIN rows;
 *   2. an `assert` inside the loop that walks it, so the rows are checked and not decorated;
 *   3. the printed count matches the declared row count, so the table and the output agree.
 * Whether a row is genuinely an EDGE case is a judgement no regex makes; the row count is
 * set high enough that the happy path alone cannot satisfy it.
 */
const fs = require('fs'), path = require('path');
const MIN = 6;
const root = path.join(__dirname, '..');
const progDir = path.join(root, 'programs');
if (!fs.existsSync(progDir)) { console.log('no programs/ directory'); process.exit(0); }
const files = fs.readdirSync(progDir).filter(f => /_v\d+\.py$/.test(f)).sort();
const findings = [];
let ok = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(progDir, f), 'utf8');
  const m = src.match(/^EXAMPLES\s*=\s*\[([\s\S]*?)^\]/m);
  if (!m) { findings.push(`${f}: no module-level EXAMPLES table — the reader gets a statement and a solution with nothing worked`); continue; }
  // The row COUNT is taken from the program, not parsed out of the source. Counting
  // `/^\s*\(/` lines over-counts: a row whose expected value is a tuple long enough to wrap
  // puts a second `(` at the start of its own line, which read as an extra row and reported
  // "declares 23 and reports 22" against a file that is perfectly correct. The printed
  // number is authoritative BECAUSE the gate also requires it to be printed as
  // `len(EXAMPLES)` — a literal there could be anything, an interpolation cannot.
  const loop = src.match(/for [^\n]*\bin EXAMPLES\b[\s\S]*?(?=\n(?:def |class |if __name__))/);
  if (!loop || !/\n\s+assert /.test(loop[0])) { findings.push(`${f}: the EXAMPLES rows are never asserted — a printed table can be wrong, an asserted one cannot`); continue; }
  if (!/all \{len\(EXAMPLES\)\} examples/.test(src))
    { findings.push(`${f}: the examples count is not printed as \`{len(EXAMPLES)}\` — a literal there can disagree with the table, an interpolation cannot`); continue; }
  const out = path.join(progDir, f.replace(/\.py$/, '.out'));
  if (fs.existsSync(out)) {
    const printed = fs.readFileSync(out, 'utf8').match(/all (\d+) examples/);
    // `continue` matters: without it this finding was pushed AND the file still counted as
    // ok, so the summary read "54/54 ship an asserted table" directly above two findings
    // saying otherwise. A gate whose count contradicts its own findings teaches the reader
    // to trust the count and ignore the list.
    if (!printed) { findings.push(`${f}: the output never states how many examples ran — print "all N examples ..." so the table and the run agree`); continue; }
    else if (+printed[1] < MIN) { findings.push(`${f}: ran ${printed[1]} example(s), needs at least ${MIN} — the happy path alone is not a worked example set`); continue; }
  }
  ok++;
}
findings.forEach(x => console.log(`  ${x}`));
console.log(`${ok}/${files.length} variation programs ship an asserted worked-examples table`);
process.exit(findings.length ? 1 : 0);
