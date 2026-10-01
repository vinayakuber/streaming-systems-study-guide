#!/usr/bin/env node
// Convert registerChapter() content files into GitHub-friendly Markdown under docs/.
// Usage (from repo root):  node tools/to_markdown.js "Streaming Systems Study Guide"
const fs = require('fs');
const path = require('path');

const TITLE = process.argv[2] || 'Study Guide';
var CHAPTERS = [];
function registerChapter(c) { CHAPTERS.push(c); }

eval(fs.readFileSync('js/chapters-registry.js', 'utf8'));
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort()) {
  eval(fs.readFileSync(path.join('content', f), 'utf8'));
}
CHAPTERS.sort((a, b) => a.num - b.num);

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
// GitHub's anchor algorithm for a rendered heading: lowercase, strip any char
// that is not a word char / hyphen / space (an em-dash is stripped, leaving its
// two surrounding spaces -> a double hyphen), then each space -> hyphen. This
// must match what GitHub auto-generates for `### <section>` so section links
// resolve, unlike `slug()` above which collapses runs for filenames.
function anchorSlug(s) {
  return String(s).toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
}
function ent(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&hellip;/g, '…');
}
function htmlToMd(html) {
  if (!html) return '';
  let s = String(html);
  // Protect <pre> blocks as fenced java code before anything else touches them.
  const pres = [];
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, inner) => {
    inner = inner.replace(/<\/?code[^>]*>/gi, '');
    inner = inner.replace(/<br\s*\/?>/gi, '\n');
    pres.push('\n\n```java\n' + ent(inner).trim() + '\n```\n\n');
    return 'PRE' + (pres.length - 1) + '';
  });
  s = s.replace(/<h3[^>]*>/gi, '\n\n### ').replace(/<\/h3>/gi, '\n\n');
  s = s.replace(/<h4[^>]*>/gi, '\n\n#### ').replace(/<\/h4>/gi, '\n\n');
  s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '');
  s = s.replace(/<strong[^>]*>/gi, '**').replace(/<\/strong>/gi, '**');
  s = s.replace(/<b[^>]*>/gi, '**').replace(/<\/b>/gi, '**');
  s = s.replace(/<code[^>]*>/gi, '`').replace(/<\/code>/gi, '`');
  s = s.replace(/<em[^>]*>/gi, '*').replace(/<\/em>/gi, '*');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  // strip remaining tags EXCEPT table tags (GitHub renders raw HTML tables)
  s = s.replace(/<(?!\/?(?:table|thead|tbody|tr|th|td)\b)[^>]+>/gi, '');
  s = ent(s);
  // ent() un-escapes &lt; so prose reads naturally — but it runs AFTER the
  // tag-stripping pass, so a deliberately-escaped angle bracket in the source comes
  // back as a literal `<` with nothing left to strip it, and GitHub then reads it as
  // an unknown tag. Re-escape any bare `<`/`>` that is not a table tag we keep.
  s = s.replace(/<(?!\/?(?:table|thead|tbody|tr|th|td)\b)/g, '&lt;');
  s = s.replace(/(^|[^"'\w\/])>(?=[^<]*$)/gm, '$1&gt;');
  s = s.replace(/PRE(\d+)/g, (m, i) => pres[+i]); // restore fenced code
  s = s.replace(/\*\*Cue\s+`[^`]*`\.?\*\*\s*/g, ''); // strip video cue markers
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}
function diagramMd(ch) {
  const list = Array.isArray(ch.diagram) ? ch.diagram : [ch.diagram];
  return list.filter(Boolean).map(d => {
    const src = String(d.src || '').replace(/^diagrams\//, '../diagrams/');
    let m = `![${ent(d.alt || '')}](${src})`;
    if (d.caption) m += `\n\n*${ent(d.caption)}*`;
    return m;
  }).join('\n\n');
}
function imgAlt(s) { return String(s).replace(/[\[\]"`|]/g, '').replace(/\s+/g, ' ').trim(); }
// Read a PNG's pixel width from its IHDR (bytes 16-19, big-endian) so the doc
// can render the image at half its native width (2x smaller) while the click
// still opens the full-resolution file for zoom.
function pngWidth(absPath) {
  try {
    const buf = fs.readFileSync(absPath);
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return buf.readUInt32BE(16);
  } catch (e) { return null; }
}
function d2Img(ch, kind, i) {
  const n = String(ch.num).padStart(2, '0');
  const rel = `../diagrams/d2/${kind}/ch${n}-${i}.png`;
  const abs = path.join(process.cwd(), 'diagrams', 'd2', kind, `ch${n}-${i}.png`);
  if (!fs.existsSync(abs)) return null;
  const w = pngWidth(abs);
  return { rel, width: w ? Math.round(w / 2) : null };
}
// Every interpolation into an ATTRIBUTE is escaped (R56). An alt text containing
// `->` closed the <img> tag early and produced broken markup in docs/ for two
// diagrams; `"` would have done the same. The escape is not optional because the
// alt text comes from authored prose.
function attrEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function d2ImgTag(img, alt) {
  const w = img.width ? ` width="${img.width}"` : '';
  // Half-width inline image; clicking opens the full-resolution PNG (zoom-in,
  // browser back = zoom-out). GitHub markdown gives no width/zoom control, so
  // emit HTML instead.
  return `<a href="${attrEsc(img.rel)}"><img src="${attrEsc(img.rel)}" alt="${attrEsc(alt)}"${w}></a>`;
}

function shortDetail(html) {
  let s = htmlToMd(html);
  s = s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length > 70) s = s.slice(0, 67).trim() + '…';
  return s;
}

// Splice a declared walkthrough's generated embed.md in at the point it belongs.
// Used by BOTH the flow sections and the System Design concept: in the olap repo
// 22 bands existed on disk, band honesty passed, and the reader saw nothing,
// because only flowMd spliced. A walkthrough declared and not spliced is invisible.
function spliceWalkthroughs(list, whereLabel) {
  let out = '';
  for (const w of (list || [])) {
    const f = path.join('diagrams', 'anim', w, 'embed.md');
    if (!fs.existsSync(f))
      throw new Error(`FATAL: ${whereLabel} declares walkthrough '${w}' but ${f} does not exist \u2014 run its generator`);
    out += '\n' + fs.readFileSync(f, 'utf8').trim() + '\n';
  }
  return out;
}
function flowMd(ch) {
  let out = '';
  for (const sec of (ch.flow || [])) {
    out += `\n### ${ent(sec.section)}\n`;
    if (sec.motivation) out += `\n> **Why this matters:** ${ent(sec.motivation)}\n`;
    const steps = sec.steps || [];
    for (const st of steps) {
      out += `\n${st.num}. **${ent(st.title)}** — ${htmlToMd(st.detail)}\n`;
    }
    if (sec.program) {
      out += `\n\`\`\`java\n${ent(sec.program)}\n\`\`\`\n`;
    }
    // A section's rendered bands are spliced in HERE, under the section they
    // belong to, so regenerating docs CARRIES them instead of wiping them.
    out += spliceWalkthroughs(sec.walkthroughs, `section "${sec.section}"`);
  }
  return out;
}
// Concept-card "zoom-in" diagrams are rendered as D2 PNGs under
// diagrams/d2/card/ (see tools/build_d2.js). to_markdown references the image
// when the rendered file exists; no mermaid is emitted.


function conceptsMd(ch) {
  const cards = (ch.concepts && ch.concepts.cards) || [];
  if (!cards.length) return '';
  function part(content, key) {
    const m = String(content || '').match(new RegExp('<strong>' + key + '[.:]</strong>\\s*([\\s\\S]*?)(?:</p>|$)'));
    return m ? htmlToMd(m[1]).trim() : '';
  }
  const claim = (c) => { const p = part(c.content, 'Claim'); return p || htmlToMd(c.content).trim(); };
  const tbl = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

  const problems = cards.filter(c => c.tag === 'problem');
  const solutions = cards.filter(c => c.tag === 'solution');
  const tradeoffs = cards.filter(c => c.tag === 'tradeoff');
  const others = cards.filter(c => !['problem', 'solution', 'tradeoff'].includes(c.tag));

  let out = '';
  if (problems.length) {
    out += '\n### The Problem\n\n';
    problems.forEach(c => { out += `**${ent(c.title)}.** ${claim(c)}\n\n`; });
  }
  if (solutions.length) {
    out += '\n### The Solution\n\n';
    out += `${claim(solutions[0])}\n\n`;
    const iq = (ch.interview && ch.interview[0]);
    if (iq && iq.code) out += `\`\`\`java\n${ent(iq.code)}\n\`\`\`\n\n`;
  }
  const factCards = [...solutions, ...tradeoffs];
  if (factCards.length) {
    out += '\n### Key Facts\n\n| Fact | Detail | In the wild |\n|---|---|---|\n';
    factCards.forEach(c => {
      out += `| ${tbl(ent(c.title))} | ${tbl(claim(c))} | ${tbl(part(c.content, 'In the wild'))} |\n`;
    });
    out += '\n';
  }
  if (tradeoffs.length) {
    out += '\n### Tradeoffs & When\n\n';
    tradeoffs.forEach(c => { out += `- ${claim(c)}\n`; });
    out += '\n';
  }
  if (others.length) {
    out += '\n### Examples & Related\n\n';
    others.forEach(c => { out += `- **${ent(c.title)}** — ${claim(c)}\n`; });
    out += '\n';
  }
  const examples = (ch.concepts && ch.concepts.examples) || [];
  if (examples.length) {
    out += '\n### Real-World Examples\n\n';
    for (const e of examples) out += `- **${ent(e.name)}** — ${ent(e.desc)}\n`;
    out += '\n';
  }
  if (ch.concepts && ch.concepts.extraHtml) out += htmlToMd(ch.concepts.extraHtml) + '\n';
  // preserve every concept-card heading (and its anchor) in a collapsed index
  out += '\n<details><summary>All concepts (index)</summary>\n\n';
  let ci = 0;
  for (const c of cards) {
    const title = ent(c.title);
    out += `### ${ent(c.tagLabel)}: ${title}\n\n${htmlToMd(c.content)}\n`;
    const img = d2Img(ch, 'card', ci);
    if (img) out += `\n${d2ImgTag(img, imgAlt(title))}\n`;
    ci++;
  }
  out += '\n</details>\n';
  return out;
}
function quizMd(ch) {
  let out = '';
  (ch.quiz || []).forEach((q, i) => {
    out += `\n${i + 1}. ${ent(q.question)}\n\n`;
    (q.options || []).forEach(o => { out += `   - ${ent(o)}\n`; });
    const letter = String.fromCharCode(64 + q.answer);
    out += `\n<details><summary>Reveal answer</summary>\n\n**${letter}.** ${htmlToMd(q.explanation)}\n\n</details>\n`;
  });
  return out;
}
function interviewMd(ch) {
  if (!ch.interview || !ch.interview.length) return '';
  let md = `## Interview Questions\n\n`;
  ch.interview.forEach((iq, i) => {
    md += `### Q${i + 1}\n\n${ent(iq.scenario)}\n\n**Interviewer's question:** ${ent(iq.q)}\n\n`;
    if (iq.solution) md += `**Solution:** ${ent(iq.solution)}\n\n`;
    if (iq.components && iq.components.length) {
      md += `**System-design components:**\n`;
      iq.components.forEach(c => { md += `- ${ent(c)}\n`; });
      md += `\n`;
    }
    if (iq.code) md += `\`\`\`java\n${ent(iq.code)}\n\`\`\`\n\n`;
    if (iq.tieback) md += `_${ent(iq.tieback)}_\n\n`;
    if (iq.refs && iq.refs.length) md += `_Covers:_ ${iq.refs.map(r => ent(r)).join(' · ')}\n\n`;
    if (iq.problems && iq.problems.length) md += `_From the 28 problems:_ ${iq.problems.join(' · ')}\n\n`;
  });
  return md;
}
function systemDesignMd(ch) {
  const sd = ch.systemDesign;
  if (!sd) return '';
  let md = `## System Design Interview\n\n`;
  if (sd.question) md += `> **The question:** ${ent(sd.question)}\n\n`;
  if (sd.pipeline) md += `**The pipeline:** ${ent(sd.pipeline)}\n\n`;
  const img = d2Img(ch, 'decomp', 0);
  if (img) md += `${d2ImgTag(img, imgAlt('system design pipeline'))}\n\n`;
  const dec = Array.isArray(sd.decomposition) ? sd.decomposition : [];
  for (const d of dec) {
    md += `### ${ent(d.box)}\n\n`;
    if (d.role) md += `_Role: ${ent(d.role)}_\n\n`;
    if (Array.isArray(d.parts) && d.parts.length) {
      for (const p of d.parts) md += `- ${ent(p)}\n`;
      md += '\n';
    }
  }
  if (sd.program) md += `\`\`\`java\n${ent(sd.program)}\n\`\`\`\n\n`;
  // The System Design concept is a CONCEPT like any flow section, so its bands go
  // in the doc too. Omitting this splice made 22 generated bands unreachable.
  md += spliceWalkthroughs(sd.walkthroughs, `ch${ch.num} systemDesign`) + '\n';
  return md;
}
// Cross-chapter links: every shallow mention in this chapter points to the
// chapter that covers the concept in depth, with a concrete example tying the
// two chapters together — so reading any chapter in any order reconstructs the
// whole picture. Each entry: { to, section?, depth, example }.
function seeAlsoMd(ch) {
  const list = Array.isArray(ch.seeAlso) ? ch.seeAlso : [];
  if (!list.length) return '';
  const byNum = new Map(CHAPTERS.map(c => [c.num, c]));
  let md = `## Links & The Bigger Picture\n\n`;
  md += `Concepts this chapter mentions but does not fully unpack are linked below — each pointer names the chapter where the concept is covered in depth and gives a concrete example that ties the two chapters together.\n\n`;
  for (const e of list) {
    const target = byNum.get(e.to);
    if (!target) continue;
    const fname = `ch${String(target.num).padStart(2, '0')}-${slug(target.title)}.md`;
    const anchor = e.section ? '#' + anchorSlug(e.section) : '';
    const label = `Chapter ${target.num}: ${ent(target.title)}${e.section ? ' → ' + ent(e.section) : ''}`;
    md += `- **[${label}](${fname}${anchor})** — ${ent(e.depth)}\n`;
    if (e.example) md += `  - _Example:_ ${ent(e.example)}\n`;
  }
  return md + '\n';
}
function sourcesMd(ch) {
  const list = Array.isArray(ch.sources) ? ch.sources : [];
  if (!list.length) return '';
  let md = `## Sources\n\n`;
  for (const s of list) {
    const name = ent(s.name || s.title || '');
    const url = String(s.url || '').trim();
    const note = s.note ? ` — ${ent(s.note)}` : '';
    md += url ? `- [${name}](${url})${note}\n` : `- ${name}${note}\n`;
  }
  return md + '\n';
}
function chapterMd(ch) {
  let md = `# Chapter ${ch.num}: ${ent(ch.title)}\n\n`;
  if (ch.pattern) md += `> ${ent(ch.pattern)}\n\n`;
  if (ch.aka) md += `_Also known as: ${ent(ch.aka)}_\n\n`;
  const dm = diagramMd(ch);
  if (dm) md += `## Diagram\n\n${dm}\n\n`;
  md += `## Flow\n${flowMd(ch)}\n\n`;
  md += seeAlsoMd(ch);
  md += systemDesignMd(ch);
  md += interviewMd(ch);
  md += `## Key Concepts\n${conceptsMd(ch)}\n\n`;
  md += `## Quiz\n${quizMd(ch)}\n`;
  md += sourcesMd(ch);
  return md;
}

fs.mkdirSync('docs', { recursive: true });
let toc = `# ${TITLE} — Read on GitHub\n\nEach chapter: flow, key concepts, and quiz (tap to reveal answers).\n\n`;
for (const ch of CHAPTERS) {
  const fname = `ch${String(ch.num).padStart(2, '0')}-${slug(ch.title)}.md`;
  fs.writeFileSync(path.join('docs', fname), chapterMd(ch));
  toc += `- [Chapter ${ch.num}: ${ent(ch.title)}](${fname})\n`;
}
fs.writeFileSync('docs/README.md', toc);
console.log(`Wrote ${CHAPTERS.length} chapters to docs/ (TOC: docs/README.md). Title: ${TITLE}`);
