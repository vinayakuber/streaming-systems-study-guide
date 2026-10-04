#!/usr/bin/env node
'use strict';
/*
 * check_statements.js — a variation's problem must be DEFINED before it is posed.
 *
 * WHY THIS GATE: the statements said things like "What RATE applies to unit k? Tiers are
 * (rate, size) pairs" without ever saying what a unit is, what a rate is charged per, or
 * what a tier is. The solution was rigorous and the question was unreadable. A reader who
 * does not already hold the model cannot start.
 *
 * Two mechanical requirements on the module docstring:
 *   1. a definitions block — at least 2 lines of the form `word -- what it means`, so every
 *      noun the question uses is given a meaning BEFORE the question is asked;
 *   2. at least 3 worked continuations — lines of the form `<input> -> <answer>`, so the
 *      reader sees the mapping on concrete values rather than inferring it.
 * Whether a definition is actually clear is a judgement no regex makes; what it can enforce
 * is that the words are defined at all and the mapping is shown more than once.
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'programs');
if (!fs.existsSync(dir)) { console.log('no programs/ directory'); process.exit(0); }
const files = fs.readdirSync(dir).filter(f => /_v\d+\.py$/.test(f)).sort();
const findings = []; let ok = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = src.match(/^"""([\s\S]*?)"""/m);
  if (!m) { findings.push(`${f}: no module docstring, so the problem is never stated`); continue; }
  const doc = m[1];
  const defs = (doc.match(/^\s{2,}\S+\s+--\s+\S/gm) || []).length;
  const worked = (doc.match(/^\s{2,}\S.*->\s*\S/gm) || []).length;
  if (defs < 2) { findings.push(`${f}: ${defs} term(s) defined — the question uses nouns it never explains; add a "word -- what it means" block before posing it`); continue; }
  if (worked < 3) { findings.push(`${f}: ${worked} worked example(s) in the statement, needs 3 — show the mapping on concrete inputs, e.g. "unit 53 -> 6"`); continue; }
  ok++;
}
findings.forEach(x => console.log(`  ${x}`));
console.log(`${ok}/${files.length} variation statements define their terms and work the mapping`);
process.exit(findings.length ? 1 : 0);
