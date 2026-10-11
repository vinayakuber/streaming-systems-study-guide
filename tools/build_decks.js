#!/usr/bin/env node
// build_decks.js — render each chapter as a narrated deck.
//
//   decks/src/chNN.js            the chapter's DECK object (the only file a person edits)
//   decks/narrated-deck-template.html   the engine: the shared template plus the ask/array layouts
//                                       added by tools/extend_deck_engine.py (its only change)
//   decks/<doc-slug>.html        GENERATED: the template with this chapter's DECK spliced in
//
// The template's engine only WARNS in the browser console about a step with no narration
// line, an unknown source key or an edge to an unknown box. A console warning is a skip
// that looks like a pass (R53), so every one of those is a build failure here, before a
// browser is ever opened. Fields are a closed set (R73): a misspelt key would otherwise be
// ignored by the engine and the slide would silently lose that content.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'decks', 'narrated-deck-template.html');
const SRC = path.join(ROOT, 'decks', 'src');
const OUT = path.join(ROOT, 'decks');
const DOCS = path.join(ROOT, 'docs');

const OPEN = 'const DECK = {';
const CLOSE = '/* ##################################  END OF DECK CONTENT  ################################## */';

const LAYOUTS = ['title', 'graph', 'sequence', 'table', 'timeline', 'cards', 'ask', 'array', 'code'];
const SLIDE_KEYS = ['title', 'layout', 'eyebrow', 'heading', 'stand', 'narration', 'speech',
  'hero', 'tiles', 'cardsLabel', 'cards', 'note', 'graph', 'notes', 'sequence', 'table',
  'side', 'timeline', 'strip', 'tokens', 'bars', 'columns', 'defines', 'question', 'array', 'code'];
const DECK_KEYS = ['title', 'eyebrow', 'theme', 'voice', 'auto', 'legend', 'sources', 'slides', 'jargon'];
// A deck file is chNN.js (the whole chapter) or chNN-P.js (part P of it, for a chapter
// explained in more depth than one deck's tab strip can hold).
const DECK_FILE = /^(ch\d+)(?:-(\d+))?\.js$/;
// Template rule 8: the bar holds about two lines. The headless gate measures the real fit;
// this bound catches the gross case before a browser starts.
const NARR_MIN = 60, NARR_MAX = 300;

function fail(msgs, deckName, msg) { msgs.push(`${deckName}: ${msg}`); }

// every `step` / `fadeStep` anywhere inside a slide, so a build item can never point past
// the last narration line
function maxStep(node) {
  if (Array.isArray(node)) return Math.max(-1, ...node.map(maxStep));
  if (!node || typeof node !== 'object') return -1;
  let m = -1;
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'step' || k === 'fadeStep') && typeof v === 'number') m = Math.max(m, v);
    else m = Math.max(m, maxStep(v));
  }
  return m;
}

// every string in a slide, for source-key and symbol checks
function strings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(n => strings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach(n => strings(n, out));
  return out;
}

function srcKeys(slide) {
  const keys = [];
  for (const s of strings(slide)) for (const m of s.matchAll(/(?<!\\)\[\[(src|unv):([A-Za-z0-9_-]+)/g)) keys.push(m[2]);
  const walk = n => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.src) keys.push(Array.isArray(n.src) ? n.src[0] : n.src);
    Object.values(n).forEach(walk);
  };
  walk(slide);
  return keys;
}

// What the voice will actually say: narration (or speech) after the deck's sayAs rewrite.
// Template rule 4: no acronyms, codes or symbols in spoken text.
function spokenProblems(text, sayAs) {
  let t = text;
  for (const [a, b] of Object.entries(sayAs || {})) t = t.split(a).join(b);
  const bad = [];
  const sym = t.match(/[<>=_`{}\[\]|\\#*^~→←×÷≤≥]/g);
  if (sym) bad.push(`symbol(s) ${[...new Set(sym)].join(' ')}`);
  const caps = t.match(/\b[A-Z]{2,}\b/g);
  if (caps) bad.push(`acronym/code(s) ${[...new Set(caps)].join(', ')} — add a sayAs pair or a speech line`);
  const camel = t.match(/\b[a-z]+[A-Z][A-Za-z]*\b/g);
  if (camel) bad.push(`code name(s) ${[...new Set(camel)].join(', ')}`);
  return bad;
}

function validate(deck, deckName) {
  const msgs = [];
  for (const k of Object.keys(deck)) if (!DECK_KEYS.includes(k)) fail(msgs, deckName, `unknown top-level key "${k}"`);
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) fail(msgs, deckName, 'no slides');
  const sources = deck.sources || {};
  const sayAs = (deck.voice || {}).sayAs || {};
  const defined = new Set();
  (deck.slides || []).forEach((s, i) => {
    const where = `slide ${i + 1} "${s.title}"`;
    for (const k of Object.keys(s)) if (!SLIDE_KEYS.includes(k)) fail(msgs, deckName, `${where}: unknown key "${k}"`);
    if (!LAYOUTS.includes(s.layout)) fail(msgs, deckName, `${where}: unknown layout "${s.layout}"`);
    const N = s.narration || [];
    if (N.length === 0) fail(msgs, deckName, `${where}: no narration lines`);
    const top = maxStep(s);
    if (top >= N.length) fail(msgs, deckName, `${where}: uses step ${top} but has only ${N.length} narration line(s)`);
    if (s.speech && s.speech.length !== N.length) fail(msgs, deckName, `${where}: speech has ${s.speech.length} lines, narration has ${N.length}`);
    N.forEach((line, k) => {
      if (line.length < NARR_MIN || line.length > NARR_MAX)
        fail(msgs, deckName, `${where} line ${k + 1}: ${line.length} chars (bounds ${NARR_MIN}-${NARR_MAX})`);
      const spoken = (s.speech && s.speech[k]) || line;
      for (const p of spokenProblems(spoken, sayAs)) fail(msgs, deckName, `${where} line ${k + 1}: spoken text has ${p}`);
    });
    for (const key of srcKeys(s)) if (!sources[key]) fail(msgs, deckName, `${where}: unknown source key "${key}"`);
    // Every word on the deck's jargon list must be explained before the reader meets it: on
    // this slide (listed in its `defines`) or an earlier one. A layman stops at the first
    // undefined word, so "used before defined" is a defect, not a style choice.
    for (const t of s.defines || []) if (!(deck.jargon || []).includes(t)) fail(msgs, deckName, `${where}: defines "${t}", which is not on the deck's jargon list`);
    (s.defines || []).forEach(t => defined.add(t));
    // only what a reader sees or hears: not markup, not link markers like [[src:layout]]
    const said = strings({ ...s, defines: [], code: null }).join(' ').replace(/<[^>]*>/g, ' ').replace(/\[\[[^\]]*\]\]/g, ' ').toLowerCase();
    for (const t of deck.jargon || []) {
      const re = new RegExp(`(^|[^a-z])${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?([^a-z]|$)`);
      if (re.test(said) && !defined.has(t)) fail(msgs, deckName, `${where}: uses "${t}" before any slide explains it`);
    }
    // R22: concept material gives concrete step counts, never asymptotic notation
    for (const t of strings(s)) {
      const bigO = t.match(/\bO\([^)]*\)|time complexity|space complexity/i);
      if (bigO) fail(msgs, deckName, `${where}: "${bigO[0]}" — state the concrete count instead (R22)`);
    }
    if (s.layout === 'graph') {
      const ids = new Set();
      for (const n of s.graph.nodes) { if (ids.has(n.id)) fail(msgs, deckName, `${where}: duplicate box id "${n.id}"`); ids.add(n.id); }
      for (const e of s.graph.edges || []) for (const end of [e.from, e.to])
        if (!ids.has(end)) fail(msgs, deckName, `${where}: edge to unknown box "${end}"`);
    }
    if (s.layout === 'ask' && !s.question) fail(msgs, deckName, `${where}: an ask slide needs a question`);
    if (s.question) {
      const q = s.question || {};
      const opts = q.options || [];
      if (!q.prompt) fail(msgs, deckName, `${where}: a question needs a prompt`);
      if (opts.length < 2 || opts.length > 4) fail(msgs, deckName, `${where}: a question needs 2 to 4 options, has ${opts.length}`);
      if (opts.filter(o => o.correct).length !== 1) fail(msgs, deckName, `${where}: a question needs exactly one correct option`);
      opts.forEach((o, j) => {
        if (!o.text || !o.why) fail(msgs, deckName, `${where}: option ${j + 1} needs text and a why — the viewer is told why after answering`);
        for (const t of [o.text || '', o.why || '']) for (const p of spokenProblems(t.replace(/<[^>]*>/g, ' ').replace(/\[\[[^\]]*\]\]/g, ' '), sayAs))
          fail(msgs, deckName, `${where} option ${j + 1}: the voice reads this aloud, and it has ${p}`);
      });
      if (typeof q.step !== 'number') fail(msgs, deckName, `${where}: the question needs a step`);
      // options are reordered at build time (placeAnswers), so nothing may name one by letter
      const said = JSON.stringify([s.narration, s.speech, s.cards, opts.map(o => o.why)]);
      const letter = said.match(/\b(?:option|answer|choice)(?: is|:)? \(?[ABCD]\)?\b|\(([ABCD])\)|\bletter [ABCD]\b/);
      if (letter) fail(msgs, deckName, `${where}: "${letter[0]}" names an option by letter, but options are reordered when built`);
    }
    if (s.layout === 'code') {
      const c = s.code || {}, n = (c.lines || []).length;
      if (!n) fail(msgs, deckName, `${where}: a code slide needs program lines (use decks/src/_prog.js)`);
      for (const [a, b] of [...(c.shown || []), ...(c.fresh || [])])
        if (!(Number.isInteger(a) && Number.isInteger(b) && 0 <= a && a <= b && b < n)) fail(msgs, deckName, `${where}: line range [${a}, ${b}] is outside the program's ${n} lines`);
      if ((c.fresh || []).length && !(typeof c.step === 'number' && c.step < (s.narration || []).length))
        fail(msgs, deckName, `${where}: new lines appear on step ${c.step}, which has no narration line`);
      if (!c.full && !(c.shown || []).length && !(c.fresh || []).length) fail(msgs, deckName, `${where}: a code slide shows no lines`);
      // The listing must BE the file. Decks were found editing program text before showing it
      // (rewriting a comment to pass a rule), so the viewer saw a program that does not run.
      // Reload the source and require the lines to match exactly; fix the program, not the slide.
      const { program, snippet, listing } = require(path.join(SRC, '_prog.js'));
      const truth = !c.source ? null : c.source.program ? program(c.source.program).lines
        : c.source.snippet ? snippet(...c.source.snippet).lines
        : c.source.listing ? listing(c.source.listing).lines : null;
      if (!truth) fail(msgs, deckName, `${where}: code lines must come from decks/src/_prog.js (program(), snippet() or listing()), which records their source`);
      else if (truth.length !== n || truth.some((l, k) => l !== c.lines[k])) {
        const k = truth.findIndex((l, j) => l !== c.lines[j]);
        fail(msgs, deckName, `${where}: line ${k + 1} differs from ${c.source.program ? 'programs/' + c.source.program : c.source.listing ? 'diagrams/anim/' + c.source.listing + '/source.json' : 'the chapter snippet'} — a listing must show the file unaltered`);
      }
    }
    if (s.layout === 'array') {
      const a = s.array || {}, rows = a.rows || [], n = rows.length ? rows[0].values.length : 0;
      if (!rows.length || rows.some(r => r.values.length !== n)) fail(msgs, deckName, `${where}: array rows must all have the same number of values`);
      for (const x of a.actions || []) {
        if (!['show', 'pick', 'sweep'].includes(x.do)) fail(msgs, deckName, `${where}: unknown array action "${x.do}"`);
        const rs = x.rows != null ? x.rows : x.row != null ? [x.row] : [];
        for (const r of rs) if (!rows[r]) fail(msgs, deckName, `${where}: array action refers to missing row ${r}`);
        for (const c of x.slots || []) if (c < 0 || c >= n) fail(msgs, deckName, `${where}: array action picks missing slot ${c}`);
        for (const m of [x.readMeter, x.resultMeter]) if (m != null && !(a.meters || [])[m]) fail(msgs, deckName, `${where}: array action uses missing meter ${m}`);
        if (x.do === 'sweep' && !['sum', 'count', 'match'].includes(x.mode)) fail(msgs, deckName, `${where}: a sweep needs mode sum, count or match`);
      }
    }
    if (s.layout === 'sequence') {
      const names = new Set(s.sequence.actors.map(a => a.name));
      for (const m of s.sequence.messages) {
        for (const end of [m.from, m.to])
          if (!names.has(end)) fail(msgs, deckName, `${where}: message to unknown actor "${end}"`);
        // the engine drops a message to oneself with only a console warning
        if (m.from === m.to) fail(msgs, deckName, `${where}: message "${m.label}" goes from "${m.from}" to itself, which the engine drops`);
      }
    }
  });
  // and the spread itself, measured on what will actually ship
  const pos = placeAnswers(deck).filter(s => s.question).map(s => s.question.options.findIndex(o => o.correct));
  if (pos.length >= 4) {
    const top = Math.max(...[0, 1, 2, 3].map(p => pos.filter(x => x === p).length));
    if (top / pos.length > 0.6) fail(msgs, deckName, `the right answer sits in one position in ${top} of ${pos.length} questions — a viewer could guess by position`);
  }
  return msgs;
}

// docs/chNN-<slug>.md names the deck, so a deck and its chapter always share a slug
function docSlug(chId) {
  const doc = fs.readdirSync(DOCS).find(f => f.startsWith(chId + '-') && f.endsWith('.md'));
  if (!doc) throw new Error(`no docs/${chId}-*.md for deck ${chId}`);
  return doc.replace(/\.md$/, '');
}

// Where each question's right answer sits. Authors write the right answer wherever it comes
// to mind — which turned out to be first, in 32 of 87 decks, so a viewer could win by always
// picking A. The builder places it instead: a balanced, deterministic spread per deck (seeded
// by the deck title, so rebuilding never reshuffles), moving only the correct option and
// keeping the others in their written order. Safe because no slide names an option by letter;
// validate() fails any deck that does.
function placeAnswers(deck) {
  let h = 0; for (const ch of deck.title || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let k = 0;
  return deck.slides.map(s => {
    if (!s.question) return s;
    const opts = s.question.options, n = opts.length, right = opts.findIndex(o => o.correct);
    const target = (h + k * 2 + (k >> 1)) % n; k++;
    const others = opts.filter((_, j) => j !== right);
    others.splice(target, 0, opts[right]);
    return { ...s, question: { ...s.question, options: others } };
  });
}

function render(template, deckIn) {
  // authoring-only fields are checked above and never shipped to the engine
  const deck = { ...deckIn, slides: placeAnswers(deckIn).map(({ defines, ...s }) => s) };
  delete deck.jargon;
  const a = template.indexOf(OPEN), b = template.indexOf(CLOSE);
  if (a < 0 || b < 0 || b < a) throw new Error('template DECK markers not found — has the template changed?');
  if (template.indexOf(OPEN, a + 1) >= 0) throw new Error('template has more than one DECK block');
  // JSON is valid JS, and `<\/` keeps a "</script>" inside any text from closing the tag
  const body = JSON.stringify(deck, null, 1).replace(/<\//g, '<\\/');
  // The engine sets document.title from DECK.title only once its script runs; anything that
  // reads the page without running it (a gallery, a link preview) would see the template's name.
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const page = template.slice(0, a) + `const DECK = ${body};\n` + template.slice(b);
  if (!/<title>[^<]*<\/title>/.test(page)) throw new Error('template has no <title> to name the deck with');
  return page.replace(/<title>[^<]*<\/title>/, `<title>${esc(deck.title)}</title>`);
}

function main() {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const files = fs.readdirSync(SRC).filter(f => DECK_FILE.test(f)).sort();
  if (files.length === 0) { console.log('FAIL no decks/src/chNN.js found — nothing was built'); process.exit(1); }
  const errors = [];
  let built = 0;
  for (const f of files) {
    const [, chId, part] = f.match(DECK_FILE);
    delete require.cache[require.resolve(path.join(SRC, f))];
    const deck = require(path.join(SRC, f));
    const msgs = validate(deck, f);
    if (msgs.length) { errors.push(...msgs); continue; }
    const out = path.join(OUT, docSlug(chId) + (part ? `-part${part}` : '') + '.html');
    fs.writeFileSync(out, render(template, deck));
    built++;
  }
  for (const e of errors) console.log('  ' + e);
  const steps = files.reduce((n, f) => n + require(path.join(SRC, f)).slides.reduce((m, s) => m + s.narration.length, 0), 0);
  if (errors.length) { console.log(`FAIL ${errors.length} problem(s); ${built}/${files.length} deck(s) built`); process.exit(1); }
  console.log(`${built}/${files.length} decks built · ${steps} narrated steps`);
}

if (require.main === module) main();
module.exports = { validate, spokenProblems, render };
