#!/usr/bin/env node
'use strict';
/* check_embeds.js — every walkthrough a chapter declares must actually appear in
 * its generated doc, with one <img> per frame plus the animation. Regenerating
 * docs once silently dropped 28 images and the failure was invisible; this makes
 * that state fail the build. */
const fs = require('fs'), path = require('path');
var CHAPTERS = []; function registerChapter(c) { CHAPTERS.push(c); }
eval(fs.readFileSync('js/chapters-registry.js', 'utf8'));
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort())
  eval(fs.readFileSync(path.join('content', f), 'utf8'));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
let bad = 0, n = 0;
const seen = new Set();
for (const ch of CHAPTERS) {
  // Walkthroughs are declared PER CONCEPT: each flow section, AND the chapter's
  // systemDesign concept, AND (legacy) the chapter itself. Enumerating only
  // `ch.flow` hid 22 bands whose artifacts existed and whose embeds were never
  // spliced into the doc — the gate printed 67/67 while 22 were unreachable.
  // Every PLACE a walkthrough can be declared must be enumerated here; the
  // disk-vs-declared check below is what catches the next place we forget.
  const declared = [
    ...(ch.flow || []).flatMap(sec => sec.walkthroughs || []),
    ...((ch.systemDesign && ch.systemDesign.walkthroughs) || []),
    ...(ch.walkthroughs || []),
  ];
  declared.forEach(d => seen.add(d));
  if (!declared.length) continue;
  const doc = path.join('docs', `ch${String(ch.num).padStart(2, '0')}-${slug(ch.title)}.md`);
  if (!fs.existsSync(doc)) { console.log(`FAIL ch${ch.num}: ${doc} missing`); bad++; continue; }
  const text = fs.readFileSync(doc, 'utf8');
  for (const dir of declared) {
    n++;
    const frames = fs.readdirSync(path.join('diagrams', 'anim', dir, 'frames')).filter(f => f.endsWith('.svg'));
    const want = frames.length + 1;                       // frames + the animation
    const got = (text.match(new RegExp(`<img[^>]*${dir}/`, 'g')) || []).length;
    if (got < want) { console.log(`FAIL ${dir}: doc shows ${got} images, expected ${want} (${frames.length} frames + 1 animation)`); bad++; }
    else console.log(`PASS ${dir}: ${got} images present (${frames.length} frames + 1 animation)`);
  }
}
// Checked-vs-total: every rendered walkthrough on disk must have been declared by
// some concept and therefore checked. A directory nobody declares is a generator
// whose output no reader can reach, which is the same failure wearing a different
// hat — so it fails the build rather than being quietly skipped.
const onDisk = fs.readdirSync(path.join('diagrams', 'anim'))
  .filter(d => fs.existsSync(path.join('diagrams', 'anim', d, 'embed.md'))).sort();
const undeclared = onDisk.filter(d => !seen.has(d));
for (const d of undeclared) { console.log(`FAIL ${d}: rendered but declared by no concept — no doc can show it`); bad++; }
console.log(`\n${n - bad}/${n} walkthroughs embedded · ${seen.size} declared, ${onDisk.length} on disk`);
process.exit(bad ? 1 : 0);
