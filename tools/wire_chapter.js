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
  // The KEY and the VALUE may each be quoted four ways, and repos differ: this one
  // writes `section: 'x'` and that one writes `"section": "x"`. A tool that assumes
  // one style silently refuses to wire a whole repo, which is how this was found.
  // Build the pattern instead of guessing the spelling.
  const qk = (k) => `(?:${k}|'${k}'|"${k}"|\`${k}\`)`;
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (isSD) {
    const re = new RegExp(qk('systemDesign') + '\\s*:\\s*\\{');
    const m = re.exec(s);
    if (!m) { console.error(`FATAL: no systemDesign object in ${file}`); process.exit(2); }
    anchor = m.index;
  } else {
    // the VALUE may use any of the three quote characters too
    const v = esc(w.concept);
    const re = new RegExp(qk('section') + `\\s*:\\s*(?:'${v}'|"${v}"|\`${v}\`)`);
    const m = re.exec(s);
    if (!m) { console.error(`FATAL: no flow section literal for ${JSON.stringify(w.concept)} in ${file}`); process.exit(2); }
    anchor = m.index;
  }
  // 1. declare the walkthroughs, immediately after the concept's opening line,
  //    unless this concept already declares exactly these.
  const lineEnd = s.indexOf('\n', anchor) + 1;
  const already = /^\s*(?:walkthroughs|'walkthroughs'|"walkthroughs")\s*:\s*\[/.test(s.slice(lineEnd, s.indexOf('\n', lineEnd)));
  if (!already) {
    // READ the indent off the anchor's own line. A hardcoded indent produces a file
    // that parses and reads as though it were written by a different tool.
    const lineStart = s.lastIndexOf('\n', anchor) + 1;
    const indent = (s.slice(lineStart, anchor).match(/^\s*/) || [''])[0] || '    ';
    s = s.slice(0, lineEnd) + `${indent}walkthroughs: [${w.dirs.map(d => `'${d}'`).join(', ')}],\n` + s.slice(lineEnd);
  }
  // 2. delete the prose program block belonging to THIS concept, bounded by the
  //    next concept's opening line so it can never reach into a neighbour.
  const reAnchor = isSD
    ? s.search(new RegExp(qk('systemDesign') + '\\s*:\\s*\\{'))
    : s.indexOf(s.slice(anchor, s.indexOf('\n', anchor)).trim());
  const nextIdx = (() => {
    const after = s.slice(reAnchor + 10);
    const a = after.search(new RegExp(qk('section') + '\\s*:'));
    const b = isSD ? -1 : after.search(new RegExp(qk('systemDesign') + '\\s*:'));
    const cands = [a, b].filter(i => i !== -1).map(i => i + reAnchor + 10);
    return cands.length ? Math.min(...cands) : s.length;
  })();
  // `program:` may be backtick-quoted (olap, streaming) or double-quoted JSON with
  // escaped newlines (ddia). Find whichever, and consume the matching closer.
  const pm = new RegExp(qk('program') + '\\s*:\\s*(`|")').exec(s.slice(reAnchor, nextIdx));
  if (pm) {
    const pi = reAnchor + pm.index;
    const quote = pm[1];
    const bodyStart = reAnchor + pm.index + pm[0].length;
    let pj = bodyStart;
    while (pj < s.length) {
      if (s[pj] === '\\') { pj += 2; continue; }
      if (s[pj] === quote) break;
      pj++;
    }
    const lineStart = s.lastIndexOf('\n', pi) + 1;
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
