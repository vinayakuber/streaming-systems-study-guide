#!/usr/bin/env node
'use strict';
/*
 * wire_chapter.js — attach a chapter's rendered bands to its content file, in one
 * verified step: declare the walkthroughs on each concept, delete the prose
 * `program:` block that those bands replace, and clear the satisfied lines from
 * BANDS_PENDING.txt.
 *
 * WHY THIS EXISTS: those three edits were done by hand per chapter, and each one
 * has already gone wrong once — a positional marker scan deleted the WRONG
 * section's block, a hand-declared walkthrough list went stale, and pending lines
 * were left behind so band honesty reported STALE. Doing them together, from one
 * spec, means the three can never disagree with each other.
 *
 * usage: wire_chapter.js <content-file> <concept>=<dir>,<dir> [<concept>=<dir>,<dir> ...]
 *        <concept> is a flow section's exact title, or the literal `systemDesign`.
 *
 * Nothing is written unless EVERY concept named resolves and every post-edit
 * check passes: the file still parses, no other concept lost its program block,
 * no section lost steps, and every declared walkthrough directory exists.
 */
const fs = require('fs'), path = require('path');
const [file, ...specs] = process.argv.slice(2);
if (!file || !specs.length) {
  console.error('usage: wire_chapter.js <content-file> <concept>=<dir>,<dir> ...');
  process.exit(2);
}
const WANT = specs.map(s => {
  const i = s.lastIndexOf('=');
  if (i === -1) { console.error(`FATAL: malformed spec ${JSON.stringify(s)} — expected <concept>=<dir>,<dir>`); process.exit(2); }
  return { concept: s.slice(0, i), dirs: s.slice(i + 1).split(',').filter(Boolean) };
});
const load = (src) => { const C = []; global.registerChapter = (c) => C.push(c); eval(src); return C; };

// Every named band must EXIST before anything is declared. Declaring a band that
// was never rendered makes to_markdown throw on its next run, which is a worse
// failure than refusing here.
for (const w of WANT) for (const d of w.dirs) {
  const p = path.join('diagrams', 'anim', d, 'embed.md');
  if (!fs.existsSync(p)) { console.error(`FATAL: ${w.concept} names '${d}' but ${p} does not exist — run its generator first`); process.exit(2); }
}

let s = fs.readFileSync(file, 'utf8');
const before = load(s);
const secBefore = before.flatMap(c => c.flow || []);
const chNums = before.map(c => c.num);

// ---- resolve each concept to its literal in the source text ----------------
for (const w of WANT) {
  const isSD = w.concept === 'systemDesign';
  let anchor;
  if (isSD) {
    anchor = s.indexOf('systemDesign: {');
    if (anchor === -1) { console.error(`FATAL: no \`systemDesign: {\` in ${file}`); process.exit(2); }
  } else {
    const lit = `section: '${w.concept.replace(/'/g, "\\'")}'`;
    anchor = s.indexOf(lit);
    if (anchor === -1) anchor = s.indexOf(`section: \`${w.concept}\``);
    if (anchor === -1) { console.error(`FATAL: no flow section literal for ${JSON.stringify(w.concept)}`); process.exit(2); }
  }
  // 1. declare the walkthroughs, immediately after the concept's opening line,
  //    unless this concept already declares exactly these.
  const lineEnd = s.indexOf('\n', anchor) + 1;
  const already = /^\s*walkthroughs: \[/.test(s.slice(lineEnd, s.indexOf('\n', lineEnd)));
  if (!already) {
    const indent = isSD ? '    ' : '      ';
    s = s.slice(0, lineEnd) + `${indent}walkthroughs: [${w.dirs.map(d => `'${d}'`).join(', ')}],\n` + s.slice(lineEnd);
  }
  // 2. delete the prose program block belonging to THIS concept, bounded by the
  //    next concept's opening line so it can never reach into a neighbour.
  const reAnchor = isSD ? s.indexOf('systemDesign: {') : s.indexOf(s.slice(anchor, s.indexOf('\n', anchor)));
  const nextIdx = (() => {
    const a = s.indexOf('section:', reAnchor + 10);
    const b = isSD ? -1 : s.indexOf('systemDesign: {', reAnchor + 10);
    const cands = [a, b].filter(i => i !== -1);
    return cands.length ? Math.min(...cands) : s.length;
  })();
  const pi = s.indexOf('program: `', reAnchor);
  if (pi !== -1 && pi < nextIdx) {
    const lineStart = s.lastIndexOf('\n', pi) + 1;
    const pj = s.indexOf('`', pi + 'program: `'.length);
    let end = pj + 1;
    while (end < s.length && (s[end] === ',' || s[end] === '\n')) end++;
    s = s.slice(0, lineStart) + s.slice(end);
  }
}

// ---- verify BEFORE writing -------------------------------------------------
const after = load(s);
const secAfter = after.flatMap(c => c.flow || []);
const errs = [];
if (after.map(c => c.num).join() !== chNums.join()) errs.push('chapter list changed');
if (secAfter.length !== secBefore.length) errs.push(`section count changed: ${secBefore.length} -> ${secAfter.length}`);
const named = new Set(WANT.map(w => w.concept));
for (const b of secBefore) {
  const a = secAfter.find(x => x.section === b.section);
  if (!a) { errs.push(`section vanished: ${b.section}`); continue; }
  if ((a.steps || []).length !== (b.steps || []).length) errs.push(`section ${JSON.stringify(b.section)} lost steps`);
  if (named.has(b.section)) {
    if (a.program) errs.push(`${JSON.stringify(b.section)} still has a program block`);
  } else if (!!a.program !== !!b.program) {
    errs.push(`COLLATERAL DAMAGE: ${JSON.stringify(b.section)} lost its program block`);
  }
}
for (const w of WANT) {
  const obj = w.concept === 'systemDesign'
    ? after.map(c => c.systemDesign).find(Boolean)
    : secAfter.find(x => x.section === w.concept);
  if (!obj) { errs.push(`concept vanished: ${w.concept}`); continue; }
  if ((obj.walkthroughs || []).join() !== w.dirs.join())
    errs.push(`${w.concept}: walkthroughs are ${JSON.stringify(obj.walkthroughs)}, wanted ${JSON.stringify(w.dirs)}`);
  if (obj.program) errs.push(`${w.concept} still has a program block`);
}
if (errs.length) { console.error('REFUSING TO WRITE:\n  ' + errs.join('\n  ')); process.exit(1); }
fs.writeFileSync(file, s);

// ---- clear the satisfied pending lines ------------------------------------
const PEND = 'BANDS_PENDING.txt';
let cleared = 0;
if (fs.existsSync(PEND)) {
  const chTag = after.map(c => `ch${String(c.num).padStart(2, '0')}`);
  const lines = fs.readFileSync(PEND, 'utf8').split('\n');
  const keep = lines.filter(l => {
    const parts = l.split('|');
    if (parts.length < 3) return true;
    const hit = chTag.includes(parts[0]) && named.has(parts[1]);
    if (hit) cleared++;
    return !hit;
  });
  fs.writeFileSync(PEND, keep.join('\n'));
}
console.log(`wired ${file}: ${WANT.length} concepts, ${WANT.reduce((n, w) => n + w.dirs.length, 0)} bands declared`);
console.log(`  verified: ${secAfter.length} sections intact, no collateral damage, ${cleared} pending line(s) cleared`);
