#!/usr/bin/env node
'use strict';
/*
 * hoist_primitives.js — move every `// primitive:` declaration in a generator's
 * `src:` arrays above the FIRST `// function:` comment in the same array.
 *
 * WHY THIS EXISTS: ~30 symbol_gate findings across six chapters were all the same
 * shape — "X is used before its definition on line N" — and the fix was always to
 * move the declaration up. Declaring a primitive next to the function that uses it
 * reads well while writing one function and breaks the moment a second function
 * uses it earlier. R63 makes primitives-before-functions the convention; this
 * applies it mechanically so the convention cannot drift.
 *
 * usage: hoist_primitives.js tools/gen_chNN.js [...]
 * It is idempotent: running it on an already-ordered file changes nothing.
 */
const fs = require('fs');
const PRIM = /(['`])\/\/ primitive:/;
const FUNC = /(['`])\/\/ function:/;
// a continuation line is the indented `//   ...` example under a declaration
const CONT = /(['`])\/\/\s{2,}/;

function fixArray(body) {
  const ls = body.split('\n');
  const firstFn = ls.findIndex(l => FUNC.test(l));
  if (firstFn === -1) return { body, moved: 0 };
  const prims = [], rest = [];
  let i = 0, moved = 0;
  while (i < ls.length) {
    if (PRIM.test(ls[i]) && i > firstFn) {
      prims.push(ls[i]); i++; moved++;
      while (i < ls.length && CONT.test(ls[i]) && !FUNC.test(ls[i]) && !PRIM.test(ls[i])) { prims.push(ls[i]); i++; }
      continue;
    }
    rest.push(ls[i]); i++;
  }
  if (!moved) return { body, moved: 0 };
  const at = rest.findIndex(l => FUNC.test(l));
  return { body: [...rest.slice(0, at), ...prims, ...rest.slice(at)].join('\n'), moved };
}

let total = 0;
for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, 'utf8');
  const parts = text.split(/(src: COMMON\.concat\(\[)/);
  let out = parts[0], moved = 0;
  for (let a = 1; a < parts.length; a += 2) {
    const marker = parts[a], body = parts[a + 1];
    const end = body.indexOf('\n  ]),');
    if (end === -1) { out += marker + body; continue; }
    const r = fixArray(body.slice(0, end));
    moved += r.moved;
    out += marker + r.body + body.slice(end);
  }
  if (moved) { fs.writeFileSync(file, out); console.log(`${file}: hoisted ${moved} primitive declaration line(s)`); }
  else console.log(`${file}: already ordered`);
  total += moved;
}
console.log(`\n${total} line(s) moved across ${process.argv.length - 2} file(s)`);
