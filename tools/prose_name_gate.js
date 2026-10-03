#!/usr/bin/env node
'use strict';
/*
 * prose_name_gate.js — every code-shaped NAME a walkthrough's prose uses must be
 * one the reader can look up in a listing.
 *
 * WHY THIS EXISTS: symbol_gate checks CODE. A caption, an intro line or a WHY band
 * is prose, so a name can be introduced there and exist nowhere lookupable. A
 * reader reported `lastIdx` as undefined while it was in fact present; this gate is
 * the automated form of that question, asked of every name in every caption.
 *
 * ITS OWN FIRST BUG, kept here as the warning: the first version iterated only
 * directories that had a `source.json`, so it checked 5 of 11 walkthroughs and
 * printed "5 walkthrough(s) checked · 0 findings" — passing a planted
 * `phantomCursor`. A gate that silently narrows its own input is worse than no
 * gate. It now enumerates every embed.md, prints checked-vs-total, and FAILS if
 * those differ.
 */
const fs = require('fs'), path = require('path');
const COMMON = new Set(('the and for not but its row rows one two all any out set step steps read reads value values code codes column columns block blocks run runs index segment table query data disk file files bucket buckets store sum total order group filter limit slot slots frame frames stack heap name names map size count bits bytes what when why how this that they them then than with from into only same each both every which while after before once still here there does done must will can cannot never always where their just like also more less most many much such make makes made take takes gives give hand hands holds hold note see say says left right first last next new old real full part whole entire side line lines panel panels label labels picture page book chapter reader engine system systems user users answer answers cost costs work works case cases point points way ways time times number numbers thing things kind sort sorted unsorted encoded stored written built build builds frozen immutable per via min max select from where group by order limit between in and or not count sum avg having distinct on as asc desc insert into values null true false').split(/\s+/));

// Language KEYWORDS are not names a reader looks up in a listing — `yield`, `def`, `await`
// are part of the language, and demanding a definition for one is the gate misreading
// syntax as vocabulary. Kept separate from COMMON so the two reasons stay distinguishable.
const KEYWORDS = new Set('yield def class lambda await async return if elif else for while try except finally with pass raise assert import global nonlocal del break continue is in not and or none true false self print len range enumerate sorted reversed sum min max abs int str float bool list dict tuple type var let const function new this typeof instanceof null undefined fun val'.split(/\s+/));

const ANIM = path.join('diagrams', 'anim');
const dirs = fs.readdirSync(ANIM).map(d => path.join(ANIM, d)).filter(d => fs.existsSync(path.join(d, 'embed.md')));
if (!dirs.length) { console.error('no embed.md found under diagrams/anim'); process.exit(2); }

// The lookupable vocabulary is the UNION of every listing in the book: a diagram's
// caption may legitimately name something the program band declares.
const declared = new Set();
let listings = 0;
for (const d of fs.readdirSync(ANIM)) {
  const f = path.join(ANIM, d, 'source.json');
  if (!fs.existsSync(f)) continue;
  listings++;
  for (const l of JSON.parse(fs.readFileSync(f, 'utf8')).src)
    for (const m of l.matchAll(/\b([A-Za-z_]\w*)\b/g)) declared.add(m[1]);
}

// DATA labels are lookupable too. `c6` is a campaign value from the book's single
// seed, shown in the rendered dictionary — it is not a code symbol, and demanding
// it appear in a program listing would be the gate misreading data as an
// identifier. The seed is the authority for what data the book contains, so its
// vocabulary joins the lookupable set.
// Which seed file a repo has is repo-specific (rle_seed.js here, stream_seed.js in
// the streaming book), so this is a GLOB rather than a name. A hardcoded filename
// would make the gate silently stop contributing data labels in every other repo —
// the same "it narrowed its own input" failure recorded in the header above.
const seeds = fs.readdirSync('tools').filter(f => /_seed\.js$/.test(f));
if (!seeds.length) console.log('note: no tools/*_seed.js — data labels are not in the lookupable set here');
for (const sf of seeds) {
  const seed = require(path.resolve('tools', sf));
  // Harvest every string/number the seed names or holds, two levels deep: a data
  // label like `c6` or a key like `a` is DATA, not an identifier, and demanding it
  // appear in a program listing would be the gate misreading data as code.
  const harvest = (v, depth) => {
    if (v === null || v === undefined || depth > 2) return;
    if (typeof v === 'string' || typeof v === 'number') { declared.add(String(v)); return; }
    if (Array.isArray(v)) { v.forEach(x => harvest(x, depth + 1)); return; }
    if (typeof v === 'object') { for (const [k, x] of Object.entries(v)) { declared.add(k); harvest(x, depth + 1); } }
  };
  for (const [k, v] of Object.entries(seed)) { declared.add(k); harvest(v, 0); }
}

// The embedded PROGRAM is a listing too — the most complete one in the book, since a
// chapter's interview section prints the whole runnable file. But only what it DEFINES
// counts: a `def` name, that def's parameters, and assigned names. A name merely
// MENTIONED in one of its comments is exactly what this gate exists to catch, so
// harvesting every word token here (as the pseudocode listings do) would let the
// program's prose vouch for itself and quietly disable the check on the new band.
let programs = 0;
if (fs.existsSync('programs')) {
  for (const f of fs.readdirSync('programs').filter(x => /\.py$/.test(x))) {
    programs++;
    const src = fs.readFileSync(path.join('programs', f), 'utf8');
    for (const line of src.split('\n')) {
      const def = line.match(/^\s*(?:def|class)\s+([A-Za-z_]\w*)\s*\(?(.*)$/);
      if (def) {
        declared.add(def[1]);
        for (const m of def[2].matchAll(/([A-Za-z_]\w*)\s*(?=[,:=)])/g)) declared.add(m[1]);
        continue;
      }
      for (const m of line.matchAll(/^\s*(?:for\s+)?([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?:=[^=]|\bin\b)/g))
        for (const n of m[1].split(/\s*,\s*/)) declared.add(n);
    }
  }
}
let total = 0, checked = 0;
for (const dir of dirs) {
  checked++;
  const text = fs.readFileSync(path.join(dir, 'embed.md'), 'utf8');
  const used = new Set();
  for (const m of text.matchAll(/`([A-Za-z_]\w*)`/g)) used.add(m[1]);          // backticked
  // The camelCase sweep is a PROSE check, so it runs on the prose only. Inside a fenced
  // block the text is code — already checked by symbol_gate and callable_gate — and three
  // kinds of false positive come from scanning it: a `\n` escape inside a print string
  // reads as the identifier `nbuildRing`, a quoted data label like "seatA" reads as a
  // symbol, and a language keyword like `yield` has no definition to point at. None of
  // them is a name introduced to the reader without a definition, which is what this gate
  // is for. The backticked sweep above still covers the whole text, including comments
  // inside the program - that is how a wrongly-backticked English word gets caught.
  const prose = text.replace(/```[\s\S]*?```/g, '\n');
  for (const m of prose.matchAll(/\b([a-z]+[A-Z]\w*)\b/g)) used.add(m[1]);     // camelCase, prose only
  const missing = [...used].filter(n => !declared.has(n) && !COMMON.has(n.toLowerCase()) && !KEYWORDS.has(n.toLowerCase()));
  if (missing.length) {
    total += missing.length;
    console.log(`FAIL ${dir}`);
    missing.forEach(n => console.log(`  \`${n}\` appears in the prose but in NO listing — the reader has nowhere to look it up`));
  } else console.log(`PASS ${dir}`);
}

console.log(`\n${checked}/${dirs.length} walkthroughs checked against ${listings} listing(s) and ${programs} program(s) · ${total} unlookupable name(s)`);
if (checked !== dirs.length) { console.log('A gate that narrowed its own input is a failure, not a pass.'); process.exit(1); }
process.exit(total ? 1 : 0);
