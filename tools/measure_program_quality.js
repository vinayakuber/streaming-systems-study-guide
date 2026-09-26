#!/usr/bin/env node
// Measure the "execution-trace quality" of every flow/systemDesign program
// block across one or more study-guide repos.
//
//   node tools/measure_program_quality.js [--detail] [repoRoot ...]
//
// With no repos it measures the repo this script lives in. `--detail` also
// lists, per failing criterion, which block (chapter / kind / section) failed,
// so the author can iterate until the bar is met.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DETAIL = args.includes('--detail');
const roots = args.filter(a => !a.startsWith('--')).length
  ? args.filter(a => !a.startsWith('--'))
  : [path.resolve(__dirname, '..')];

function num(re) { return (s) => (s.match(re) || []).length; }
const lines = (s) => s.split('\n');

// The gold trace format (R19 input dataset · R20 downstream chain · plus the
// existing execution-trace bar: steps, transitions, causality, derivation,
// two-column steps, concrete DEF values).
const criteria = [
  { name: 'input dataset (>=2 offsets/records)', fn: s => num(/offset\s+\d+/g)(s) >= 2 || num(/\b(?:records?|r\d|ev\d)\s*[:=]/g)(s) >= 2 },
  { name: '>=3 numbered steps', fn: s => num(/step\s+\d+\s*·/g)(s) >= 3 },
  { name: '>=3 value transitions (x : old -> new)', fn: s => lines(s).filter(l => /:\s*.+\s+->\s+.+/.test(l)).length >= 3 },
  { name: '>=1 causal connective', fn: s => /BECAUSE|the ratio|is the union|merges into|causes|since it/i.test(s) },
  { name: '>=1 derivation (= a op b)', fn: s => /=\s*[\d.]+\s*[+\-*/×]/.test(s) },
  { name: 'downstream state chain (>=2 -> on one line)', fn: s => lines(s).some(l => (l.match(/->/g) || []).length >= 2) },
  { name: 'two-column steps (step line carries -> value)', fn: s => lines(s).some(l => /step\s+\d+\s*·/.test(l) && /->/.test(l)) },
  { name: 'DEF lines carry concrete values', fn: s => {
      const defs = lines(s).filter(l => /DEF\s*:/.test(l));
      if (!defs.length) return false;
      return defs.every(l => /=\s*[\d{["'[]|[\d{["']/.test(l));
    } },
];

function measureRepo(root) {
  // `var` (not let/const) so the repo registry's own `var CHAPTERS` can
  // redeclare it without a SyntaxError when we eval the registry below.
  var CHAPTERS = [];
  var PARTS = [];
  function registerChapter(c) { CHAPTERS.push(c); }

  const reg = path.join(root, 'js', 'chapters-registry.js');
  if (fs.existsSync(reg)) eval(fs.readFileSync(reg, 'utf8'));
  const dir = path.join(root, 'content');
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js')).sort()) {
    eval(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  CHAPTERS.sort((a, b) => a.num - b.num);

  const blocks = [];
  for (const ch of CHAPTERS) {
    for (const sec of (ch.flow || [])) {
      if (sec.program) blocks.push({ ch: ch.num, kind: 'flow', section: sec.section, text: String(sec.program) });
    }
    if (ch.systemDesign && ch.systemDesign.program) {
      blocks.push({ ch: ch.num, kind: 'sd', section: 'systemDesign', text: String(ch.systemDesign.program) });
    }
  }

  const results = blocks.map(b => ({ ...b, hits: criteria.map(c => c.fn(b.text)) }));

  const pct = (i) => {
    const hits = results.filter(r => r.hits[i]).length;
    return results.length ? (hits / results.length * 100) : 0;
  };
  const score = (r) => r.hits.filter(Boolean).length / criteria.length * 100;
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  console.log(`\n===== ${path.basename(root)} (${results.length} program blocks, ${CHAPTERS.length} chapters) =====`);
  criteria.forEach((c, i) => {
    console.log(`  ${String(pct(i).toFixed(1)).padStart(6)}%  ${c.name}`);
  });
  const composite = avg(results.map(score));
  console.log(`  ------`);
  console.log(`  ${composite.toFixed(1)}  COMPOSITE SCORE (mean of the ${criteria.length} criteria)`);

  if (DETAIL) {
    criteria.forEach((c, i) => {
      const fails = results.filter(r => !r.hits[i]);
      if (!fails.length) return;
      console.log(`\n  FAIL ${c.name}:`);
      for (const f of fails) console.log(`    - ch${String(f.ch).padStart(2, '0')} [${f.kind}] ${f.section}`);
    });
  }

  return { blocks: results.length, score: composite, results };
}

let grand = 0, n = 0;
const allResults = [];
for (const r of roots) {
  const res = measureRepo(path.resolve(r));
  if (res) { grand += res.score * res.blocks; n += res.blocks; allResults.push(...res.results); }
  else console.log(`\n===== ${r} — SKIPPED (no content dir) =====`);
}
if (n) console.log(`\n===== ALL MEASURED REPOS =====\n  weighted composite: ${(grand / n).toFixed(1)}  (${n} blocks)\n`);
