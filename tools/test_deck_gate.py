#!/usr/bin/env python3
"""test_deck_gate.py — mutation-test the deck gate (R27, §15 L3).

A checker that has never failed is indistinguishable from one that cannot. This plants one
defect per copy of a known-good deck — each one a defect class the gate has actually
caught — and requires deck_gate.py to FAIL every copy. Run it after any change to the gate.

The known-good deck is tools/fixtures/deck_gate_fixture.js: a fixed deck that passes the gate
and exercises every layout the mutants need (tiles, graph boxes with numbers, arrow labels).
It is built into a temporary file here, so it is never published as a chapter deck.
"""
import json, os, shutil, subprocess, sys, tempfile

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = tempfile.mkdtemp(prefix='deck-mutants-')
SRC = os.path.join(OUT, 'fixture.html')
OPEN, CLOSE = 'const DECK = ', ';\n/* ####'

subprocess.run(['node', '-e', """
const fs = require('fs'), b = require('./tools/build_decks.js');
const t = fs.readFileSync('decks/narrated-deck-template.html', 'utf8');
fs.writeFileSync(process.argv[1], b.render(t, require('./tools/fixtures/deck_gate_fixture.js')));""", SRC],
               cwd=REPO, check=True)

# the control: unmutated, the fixture must PASS, or a "kill" below would prove nothing
control = subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'deck_gate.py'), SRC],
                         capture_output=True, text=True, env={**os.environ, 'DECK_SETTLE_MS': '250'}, cwd=REPO)
if control.returncode != 0:
    print('FAIL the unmutated fixture does not pass the gate:\n' + control.stdout[-2000:])
    sys.exit(1)
print('PASS    control          the unmutated fixture passes')

html = open(SRC).read()
a = html.index(OPEN) + len(OPEN)
b = html.index(CLOSE, a)
base = json.loads(html[a:b].replace('<\\/', '</'))


def slide(d, title):
    return next(s for s in d['slides'] if s['title'] == title)


def overflow(d):      # a card too long for the slide
    slide(d, 'Asks')['cards'][2]['html'] = '<p>' + 'A very long sentence that keeps going. ' * 60 + '</p>'


def box_overlap(d):   # two boxes on top of each other
    n = slide(d, 'Rows')['graph']['nodes']; n[1]['x'] = n[0]['x'] + 40


def through_box(d):   # an arrow that crosses a box it does not connect
    slide(d, 'Rows')['graph']['edges'].append({'from': 'r0', 'to': 'rlast', 'kind': 'main', 'step': 0})


def crowded_box(d):   # subtitle and big number in a box too short for both
    slide(d, 'Funnel')['graph']['nodes'][0]['h'] = 72


def long_narration(d):  # a line that cannot fit in the bar
    slide(d, 'Goals')['narration'][0] = 'This narration line goes on and on. ' * 14


def missing_line(d):  # a build step with no narration line (engine only warns)
    slide(d, 'Asks')['cards'][2]['step'] = 7


def label_on_arrow(d):  # a label dropped onto another arrow
    e = slide(d, 'Rows')['graph']['edges'][0]; e['labelAt'] = 0.5; e['dx'] = 0; e['dy'] = -6; e['labelAnchor'] = 'middle'


def tile_spill(d):     # a big number too wide for its tile (it never wraps)
    slide(d, 'Ch 1')['tiles'][3]['value'] = 100000000000


def answered_overflow(d):  # on a code slide, a wrong answer's feedback plus the card revealed after
    q = slide(d, 'Ask')        # it no longer fit the side column: the last feedback line ran under the card
    for o in q['question']['options']:
        if not o.get('correct'):
            o['why'] = 'A long explanation of why this answer is wrong. ' * 9
    q['cards'][0]['html'] = '<p>' + 'A card revealed after the answer, with a good deal to say. ' * 8 + '</p>'


MUTANTS = [overflow, box_overlap, through_box, crowded_box, long_narration, missing_line, label_on_arrow, tile_spill, answered_overflow]
survivors = []
for m in MUTANTS:
    d = json.loads(json.dumps(base))
    m(d)
    path = os.path.join(OUT, f'mut-{m.__name__}.html')
    open(path, 'w').write(html[:a] + json.dumps(d).replace('</', '<\\/') + html[b:])
    r = subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'deck_gate.py'), path],
                       capture_output=True, text=True, env={**os.environ, 'DECK_SETTLE_MS': '250'}, cwd=REPO)
    first = next((l.strip() for l in r.stdout.splitlines() if l.startswith('  ')), '(no finding line)')
    print(f"{'KILLED ' if r.returncode else 'SURVIVED'} {m.__name__:16s} {first[:150]}")
    if r.returncode == 0:
        survivors.append(m.__name__)
shutil.rmtree(OUT, ignore_errors=True)
print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} mutants killed')
sys.exit(1 if survivors else 0)
