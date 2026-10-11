// _doc.js — source links from a deck slide to the chapter section it renders.
//
// A link is addressed by the heading's TEXT and resolved against the published doc, so a
// renamed heading fails the build instead of leaving a deck pointing at an anchor that no
// longer exists (R36: address by content, and zero or several matches is an error).
const fs = require('fs');
const path = require('path');

const REPO = 'https://github.com/vinayakuber/streaming-systems-study-guide/blob/main/docs/';
const DOCS = path.join(__dirname, '..', '..', 'docs');

// GitHub's anchor rule: lowercase, drop everything but letters, digits, spaces, hyphens and
// underscores, then spaces become hyphens. Repeated headings get -1, -2 … in document order.
const slug = h => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

function docFile(chId) {
  const f = fs.readdirSync(DOCS).filter(n => n.startsWith(chId + '-') && n.endsWith('.md'));
  if (f.length !== 1) throw new Error(`expected one docs/${chId}-*.md, found ${f.length}`);
  return f[0];
}

function headings(file) {
  const text = fs.readFileSync(path.join(DOCS, file), 'utf8').replace(/```[\s\S]*?```/g, '');
  const seen = {};
  return [...text.matchAll(/^#{1,6} (.+)$/gm)].map(m => {
    const base = slug(m[1]);
    const n = seen[base] = (seen[base] === undefined ? 0 : seen[base] + 1);
    return { text: m[1].trim(), anchor: n ? `${base}-${n}` : base };
  });
}

// section('ch01', 'The shape of an analytics query', 'Chapter 1 · the query shape')
//   -> ['https://github.com/.../docs/ch01-...md#the-shape-of-an-analytics-query', 'Chapter 1 · the query shape']
function section(chId, heading, label) {
  const file = docFile(chId);
  const hits = headings(file).filter(h => h.text === heading);
  if (hits.length !== 1) throw new Error(`${file}: heading "${heading}" matched ${hits.length} times`);
  return [REPO + file + '#' + hits[0].anchor, label];
}

function chapter(chId, label) { return [REPO + docFile(chId), label]; }

module.exports = { section, chapter, slug };
