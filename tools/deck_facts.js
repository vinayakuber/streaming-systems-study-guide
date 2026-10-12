#!/usr/bin/env node
// deck_facts.js — a deck may only show numbers its chapter already shows.
//
// A deck is a re-rendering of docs/chNN-*.md, never a new source of facts. So every number
// on a slide or in its narration must occur in that chapter's doc, which is itself
// generated from the one seed. This is the low-noise direction of R85: a deck quoting a
// figure the chapter never states is either a typo or an invention, and both are defects.
//
// Not checked, because they carry no claim: geometry and step fields, integers 0..12
// (counts like "2 columns" or "4 stages" occur everywhere and decide nothing), numbering
// inside an identifier (c1, ch02, Q1), and the "NN ·" eyebrow prefix.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_KEYS = new Set(['x', 'y', 'w', 'h', 'step', 'fadeStep', 'dx', 'dy', 'bend', 'labelAt', 'columns', 'defines', 'jargon',
  'n', 'rowHeight', 'viewBox', 'voice', 'auto', 'theme', 'sources', 'legend', 'lanes', 'decimals',
  'speed', 'labelWidth', 'slots', 'readMeter', 'resultMeter', 'shown', 'fresh',
  // a program listing is read from programs/ at build time and verified by check_programs;
  // it is its own source, so its lines are not held to the doc (see PROGRAM_NUMBERS below)
  'lines']);
const SMALL = 12;
const seed = require(path.join(__dirname, 'stream_seed.js'));
const SEED = [...seed.EVENTS.flatMap(e => [e.et, e.pt, e.v]), seed.LAG, seed.WIN, seed.GAP, ...seed.WATERMARKS,
  ...seed.WIN_STARTS, ...seed.WIN_STARTS.map(w => w + seed.WIN)].map(v => String(Math.abs(v)));

const norm = s => s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');  // 1,600 -> 1600 (and 234,375x -> 234375x), so both spellings match

function numbersIn(text) {
  const t = norm(text.replace(/<[^>]+>/g, ' ').replace(/\[\[[a-z]+:[^\]]*\]\]/g, ' '));
  return [...t.matchAll(/(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)(?![A-Za-z]*\d)/g)].map(m => m[1]);
}

function collect(node, key, out) {
  // `n` is a card's position number when it is a NUMBER, but a strip ticket's label when it
  // is a string ("row 31") — skipping the key outright let that label through unchecked
  if (SKIP_KEYS.has(key) && !(key === 'n' && typeof node === 'string')) return out;
  if (typeof node === 'number') out.push({ key, v: String(node) });
  else if (typeof node === 'string') {
    const s = key === 'eyebrow' ? node.replace(/^\d+\s*·\s*/, '') : node;
    numbersIn(s).forEach(v => out.push({ key, v }));
  } else if (Array.isArray(node)) node.forEach(n => collect(n, key, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) collect(v, k, out);
  return out;
}

function main() {
  const srcDir = path.join(ROOT, 'decks', 'src');
  const files = fs.readdirSync(srcDir).filter(f => /^ch\d+(?:-\d+)?\.js$/.test(f)).sort();
  if (!files.length) { console.log('FAIL no decks/src/chNN.js — nothing was checked'); process.exit(1); }
  let bad = 0, checked = 0;
  for (const f of files) {
    const chId = f.match(/^ch\d+/)[0];
    const docName = fs.readdirSync(path.join(ROOT, 'docs')).find(d => d.startsWith(chId + '-') && d.endsWith('.md'));
    const doc = norm(fs.readFileSync(path.join(ROOT, 'docs', docName), 'utf8'));
    // The seed is the one dataset every chapter draws its example rows from (R33), so its
    // values are quotable in any chapter's deck even where that chapter's prose skips one.
    const inDoc = new Set([...numbersIn(doc), ...SEED]);
    const deck = require(path.join(srcDir, f));
    // A deck may also quote what a program it DISPLAYS contains or prints: those lines come
    // from programs/*.py and *.out (re-run and diffed by check_programs), never from an author.
    const shownCode = deck.slides.filter(s => s.code && s.code.lines).flatMap(s => s.code.lines).join('\n');
    // read raw: in program text `<` and `>` are operators, and stripping "tags" would delete
    // the code between them (it hid every number in a line like `if a < b ... -> 668`)
    const codeNums = [...norm(shownCode).matchAll(/(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)(?![A-Za-z]*\d)/g)].map(m => m[1]);
    const quotable = new Set([...inDoc, ...codeNums]);
    const nums = [];
    deck.slides.forEach((s, i) => collect(s, '', []).forEach(n => nums.push({ ...n, slide: i + 1, title: s.title })));
    const missing = nums.filter(n => !(Number(n.v) <= SMALL && Number.isInteger(Number(n.v))) && !quotable.has(n.v));
    checked += nums.length;
    const seen = new Set();
    for (const m of missing) {
      const k = `${m.slide}:${m.v}`; if (seen.has(k)) continue; seen.add(k);
      console.log(`  ${f} slide ${m.slide} "${m.title}": ${m.v} (in ${m.key || 'text'}) does not occur in docs/${docName}`);
      bad++;
    }
    if (nums.length === 0) { console.log(`  ${f}: no numbers extracted — the extraction is broken`); bad++; }
  }
  if (bad) { console.log(`FAIL ${bad} number(s) shown in a deck but not in its chapter`); process.exit(1); }
  console.log(`${files.length}/${files.length} decks quote only their chapter · ${checked} numbers checked`);
}

main();
