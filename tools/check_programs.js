#!/usr/bin/env node
'use strict';
/*
 * check_programs.js — every interview section must ship a program that RUNS, and the
 * output printed beside it must be the output it actually produced.
 *
 * WHY THIS GATE: the section shows a program and its results. Nothing stops those
 * results from being hand-typed, and nothing stops the program from drifting away from
 * them after an edit. So: re-run every program, compare byte-for-byte with the .out that
 * the document embeds, and refuse a section whose program is missing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const progDir = path.join(root, 'programs');
const animDir = path.join(root, 'diagrams', 'anim');

const sections = fs.existsSync(animDir)
  ? fs.readdirSync(animDir).filter(d => /-interview-memory$/.test(d)).sort() : [];
const findings = [];
let ok = 0;

for (const sec of sections) {
  const base = sec.replace(/-interview-memory$/, '');
  const py = path.join(progDir, `${base}.py`);
  const out = path.join(progDir, `${base}.out`);
  if (!fs.existsSync(py)) { findings.push(`${base}: no programs/${base}.py — the section shows a program that does not exist`); continue; }
  if (!fs.existsSync(out)) { findings.push(`${base}: no programs/${base}.out — run tools/run_programs.sh`); continue; }
  let got;
  try { got = execFileSync('python3', [py], { cwd: root, encoding: 'utf8', timeout: 120000 }); }
  catch (e) { findings.push(`${base}: the program FAILED to run — ${String(e.stderr || e.message).trim().split('\n').slice(-1)[0]}`); continue; }
  const want = fs.readFileSync(out, 'utf8');
  if (got !== want) {
    const g = got.split('\n'), w = want.split('\n');
    const i = g.findIndex((l, k) => l !== w[k]);
    findings.push(`${base}: the embedded output is stale at line ${i + 1} — got "${(g[i] || '').slice(0, 60)}", embedded "${(w[i] || '').slice(0, 60)}"`);
    continue;
  }
  // the embed must actually carry the program and its output
  const embed = path.join(animDir, sec, 'embed.md');
  if (fs.existsSync(embed)) {
    const md = fs.readFileSync(embed, 'utf8');
    const src = fs.readFileSync(py, 'utf8');
    const firstDef = (src.match(/^def [a-z_]+\(.*$/m) || [''])[0];
    if (firstDef && !md.includes(firstDef)) { findings.push(`${base}: embed.md does not contain the program's first definition — the section is not showing the program that was tested`); continue; }
    const lastOut = want.trim().split('\n').slice(-1)[0];
    if (lastOut && !md.includes(lastOut)) { findings.push(`${base}: embed.md does not contain the program's last output line — the results shown were not produced by running it`); continue; }
  }
  ok++;
}

if (findings.length) { findings.forEach(f => console.log(`  ${f}`)); console.log(`${ok}/${sections.length} interview sections ship a program that runs and matches`); process.exit(1); }
console.log(`${ok}/${sections.length} interview sections ship a program that runs and matches`);
