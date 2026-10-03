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

const checkOne = (py, out, label, embedText) => {
  if (!fs.existsSync(py)) return `${label}: no ${path.relative(root, py)} — the section shows a program that does not exist`;
  if (!fs.existsSync(out)) return `${label}: no ${path.relative(root, out)} — run tools/run_programs.sh`;
  let got;
  try { got = execFileSync('python3', [py], { cwd: root, encoding: 'utf8', timeout: 300000 }); }
  catch (e) { return `${label}: the program FAILED to run — ${String(e.stderr || e.message).trim().split('\n').slice(-1)[0]}`; }
  const want = fs.readFileSync(out, 'utf8');
  if (got !== want) {
    const g = got.split('\n'), w = want.split('\n');
    const i = g.findIndex((l, k) => l !== w[k]);
    return `${label}: the embedded output is stale at line ${i + 1} — got "${(g[i] || '').slice(0, 60)}", embedded "${(w[i] || '').slice(0, 60)}"`;
  }
  if (embedText) {
    const firstDef = (fs.readFileSync(py, 'utf8').match(/^def [a-z_]+\(.*$/m) || [''])[0];
    if (firstDef && !embedText.includes(firstDef)) return `${label}: embed.md does not contain the program's first definition — the section is not showing the program that was tested`;
    const lastOut = want.trim().split('\n').slice(-1)[0];
    if (lastOut && !embedText.includes(lastOut)) return `${label}: embed.md does not contain the program's last output line — the results shown were not produced by running it`;
  }
  return null;
};

const sections = fs.existsSync(animDir)
  ? fs.readdirSync(animDir).filter(d => /-interview-memory$/.test(d)).sort() : [];
const findings = [];
let ok = 0, vOk = 0, vTotal = 0;

for (const sec of sections) {
  const base = sec.replace(/-interview-memory$/, '');
  const embedPath = path.join(animDir, sec, 'embed.md');
  const embed = fs.existsSync(embedPath) ? fs.readFileSync(embedPath, 'utf8') : '';

  // The chapter program.
  const bad = checkOne(path.join(progDir, `${base}.py`), path.join(progDir, `${base}.out`), base, embed);
  if (bad) { findings.push(bad); continue; }
  ok++;

  // The VARIATION programs. How many are required is read off the rendered page, not
  // hand-listed here: a gate given its own copy of the list reports on the list rather
  // than on the repo, and would keep passing after a fourth variation was added.
  const labels = [...embed.matchAll(/<summary><b>Variation (\d+)<\/b>/g)].map(m => +m[1]);
  if (!labels.length) findings.push(`${base}: the section renders no "Variation N" blocks — either the page lost them or this gate's reader is broken`);
  for (const n of labels) {
    vTotal++;
    const vb = checkOne(path.join(progDir, `${base}_v${n}.py`), path.join(progDir, `${base}_v${n}.out`), `${base} variation ${n}`, embed);
    if (vb) findings.push(vb); else vOk++;
  }
}

const summary = () => `${ok}/${sections.length} sections and ${vOk}/${vTotal} variations ship a program that runs and matches`;
if (findings.length) { findings.forEach(f => console.log(`  ${f}`)); console.log(summary()); process.exit(1); }
console.log(summary());
