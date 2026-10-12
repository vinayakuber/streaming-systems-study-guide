// _prog.js — show a real program, built up piece by piece, in a deck's `code` slides.
//
// The listing is read from programs/<file> at build time, so what the viewer sees is the
// program that runs and that tools/check_programs.js verifies against the chapter — it
// cannot drift into a paraphrase. Pieces are addressed by CONTENT, never by line number
// (R36): a needle that matches no line, or more than one, throws, so editing the program
// can never leave a slide silently highlighting the wrong lines.
const fs = require('fs');
const path = require('path');

const PROGRAMS = path.join(__dirname, '..', '..', 'programs');

function program(file) {
  const lines = fs.readFileSync(path.join(PROGRAMS, file), 'utf8').replace(/\n+$/, '').split('\n');

  // the one line containing `needle`; zero or several matches is an error, never a guess
  const at = needle => {
    const hits = lines.map((l, i) => (l.includes(needle) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`${file}: "${needle}" matches ${hits.length} lines${hits.length ? ' (' + hits.map(i => i + 1).join(', ') + ')' : ''}`);
    return hits[0];
  };

  // a top-level block (def / class / assignment) from its first line to the line before
  // the next top-level statement, without trailing blank lines
  const block = needle => {
    const a = at(needle);
    let b = a + 1;
    while (b < lines.length && (lines[b] === '' || /^[\s)\]}]/.test(lines[b]))) b++;
    b--;
    while (b > a && lines[b].trim() === '') b--;
    return [a, b];
  };

  const fn = name => block(`def ${name}(`);
  const span = (fromNeedle, toNeedle) => {
    const a = at(fromNeedle), b = at(toNeedle);
    if (b < a) throw new Error(`${file}: "${toNeedle}" comes before "${fromNeedle}"`);
    return [a, b];
  };

  // a `code` value for a slide: everything already written, plus this slide's new piece,
  // revealed on `step` (after the question on this slide is answered)
  // `source` lets the builder reload the file and prove the slide shows it unaltered
  const source = { program: file };
  const build = ({ before = [], add = [], step = 1, label }) => ({ lines, shown: before, fresh: add, step, label, source });
  const whole = label => ({ lines, full: true, label: label || `the whole program · programs/${file}`, source });

  return { file, lines, at, block, fn, span, build, whole };
}

// An interview question's code snippet lives in the chapter source (content/chNN-*.js,
// interview[i].code), not in programs/. Read it from there, so a deck never retypes it.
function snippet(chId, index) {
  const dir = path.join(__dirname, '..', '..', 'content');
  const file = fs.readdirSync(dir).find(f => f.startsWith(chId + '-') && f.endsWith('.js'));
  if (!file) throw new Error(`no content/${chId}-*.js`);
  let chapter;
  new Function('registerChapter', 'require', fs.readFileSync(path.join(dir, file), 'utf8'))(c => { chapter = c; }, require);
  const q = (chapter.interview || [])[index];
  if (!q || !q.code) throw new Error(`${file}: interview question ${index + 1} has no code snippet`);
  const lines = q.code.replace(/\n+$/, '').split('\n');
  const at = needle => {
    const hits = lines.map((l, i) => (l.includes(needle) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`${file} Q${index + 1}: "${needle}" matches ${hits.length} lines`);
    return hits[0];
  };
  const source = { snippet: [chId, index] };
  const build = ({ before = [], add = [], step = 1, label }) => ({ lines, shown: before, fresh: add, step, label: label || `the chapter's snippet for Q${index + 1}`, source });
  const whole = label => ({ lines, full: true, label: label || `the chapter's snippet for Q${index + 1}`, source });
  return { file, lines, at, build, whole, all: [0, lines.length - 1] };
}

// A chapter walkthrough's program listing (the PROGRAM band) is published as data in
// diagrams/anim/<name>/source.json, checked by symbol_gate and callable_gate. Read it from
// there — never by scraping the rendered SVG frame.
function listing(name, label) {
  const file = path.join(__dirname, '..', '..', 'diagrams', 'anim', name, 'source.json');
  const lines = JSON.parse(fs.readFileSync(file, 'utf8')).src;
  if (!Array.isArray(lines) || !lines.length) throw new Error(`${name}: source.json has no src lines`);
  const at = needle => {
    const hits = lines.map((l, i) => (l.includes(needle) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`${name}: "${needle}" matches ${hits.length} lines${hits.length ? ' (' + hits.map(i => i + 1).join(', ') + ')' : ''}`);
    return hits[0];
  };
  const span = (a, b) => { const x = at(a), y = at(b); if (y < x) throw new Error(`${name}: "${b}" comes before "${a}"`); return [x, y]; };
  const source = { listing: name };
  const lab = label || `the chapter's program · ${name}`;
  const build = ({ before = [], add = [], step = 1 }) => ({ lines, shown: before, fresh: add, step, label: lab, source });
  const whole = () => ({ lines, full: true, label: 'the whole program · ' + lab, source });
  return { lines, at, span, build, whole };
}

module.exports = { program, snippet, listing };
