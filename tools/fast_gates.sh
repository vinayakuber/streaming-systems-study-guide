#!/usr/bin/env bash
# fast_gates.sh — every gate in verify_all.sh that does NOT launch a browser, invoked EXACTLY
# as verify_all.sh invokes it (this file is verify_all.sh with the browser steps cut out).
# Skipped, and why that is honest: frame geometry (each generator asserts its own geometry
# before writing frames) and deck rendering (run deck_gate.py on the decks you touched).
# FG_GEN=<glob> regenerates only the generators you changed. Run verify_all.sh before shipping.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
# The non-PASS lines of a gate's output. A failing gate that checks 1,600 frames
# ends in PASS lines, so its tail shows twelve passes and hides the failure (R74).
# Only when every line is a PASS does the tail say anything, so fall back to it then.
failing_lines() { # failing_lines <logfile>
  local hits; hits=$(grep -v '^ *PASS ' "$1" | grep -v '^ *$')
  [ -n "$hits" ] || hits=$(tail -n 12 "$1")
  echo "$hits" | head -n 40 | sed 's/^/          /'
}

# Output goes to a FILE, never a $(...) pipe. Playwright's child flips the shared pipe
# to non-blocking, and verify_diagram.py then died with BlockingIOError printing its own
# PASS lines: 1607/1607 frames passed run directly and FAILED inside this suite. On a
# regular file O_NONBLOCK has no effect, so the gate's verdict is the only verdict.
run() { # run <label> <cmd...>
  local label="$1"; shift
  local log; log=$(mktemp); "$@" >"$log" 2>&1; local rc=$?
  if [ $rc -eq 0 ]; then printf '  \033[32mPASS\033[0m  %-26s %s\n' "$label" "$(tail -n 1 "$log")"
  else fail=1; printf '  \033[31mFAIL\033[0m  %-26s\n' "$label"; failing_lines "$log"; fi
  rm -f "$log"
}

echo "regenerating every artifact from the one seed..."
for g in ${FG_GEN:-tools/gen_ch*.js}; do node "$g" >/dev/null || { echo "  GENERATOR FAILED: $g"; fail=1; }; done
node tools/to_markdown.js "Streaming Systems Study Guide" >/dev/null || fail=1

echo; echo "THE EXAMPLE ITSELF"
run "seed discriminates"   node -e "require('./tools/stream_seed.js'); console.log('all seed assertions hold')"

echo; echo "THE PROGRAM"
# Not a gate: the REMAINING prose blocks are tracked debt, enforced by band
# honesty below. A pass/fail here could only go green once every concept is
# converted, so it would be a to-do list wearing a gate's clothes.
printf "  %-6s %-25s %s\n" "INFO" "prose blocks remaining" "$(grep -c 'program: `' content/*.js | awk -F: '{s+=$2} END {print s+0}') in content/ — each one is a DIAGRAM+PROGRAM pair still owed"
run "symbols defined"      node tools/symbol_gate.js
run "callables shown"      node tools/callable_gate.js
run "prose names"          node tools/prose_name_gate.js
run "stack complete"       node tools/stack_gate.js

echo; echo "THE WALKTHROUGHS"
# ONE captions file PER WALKTHROUGH, never one concatenated file. Concatenated, the
# gate reported "1/1 files pass" for a repo with hundreds of walkthroughs, and an
# extraction that came back empty for one of them vanished into the others (R53/R74).
# Per walkthrough, the count matches the repo and an empty one fails on its own.
ALLCAPS=(); for d in diagrams/anim/*/; do CC=$(mktemp); node tools/extract_captions.js "$d"frames > "$CC"; ALLCAPS+=("$CC"); done
run "captions checkable"   node tools/teaching_gate.js --only=T8 "${ALLCAPS[@]}"
rm -f "${ALLCAPS[@]}"

echo; echo "THE DECKS"
# Each chapter rendered as a narrated deck. Built AFTER to_markdown, because every slide's
# source link is resolved against the published doc's headings. deck_facts holds a deck to
# the numbers its chapter prints; deck_gate walks every step headless (template section 10).
run "decks build"          node tools/build_decks.js
run "decks quote chapter"  node tools/deck_facts.js

echo; echo "THEY ALL AGREE"
run "band honesty"         node tools/check_band_honesty.js
run "block shape"          node tools/check_block_shape.js diagrams/anim/*/embed.md
run "html well-formed"     node tools/html_gate.js
run "embeds present"       node tools/check_embeds.js
run "diagrams"             node tools/validate_diagrams.js
# A program listed in a chapter is a claim that it runs and prints that. This re-RUNS
# every one and diffs the output against what the page shows, so a listing cannot drift
# from the thing it documents.
run "programs run"         node tools/check_programs.js

echo
[ $fail -eq 0 ] && echo "ALL GATES PASS" || echo "SOME GATES FAILED"
exit $fail
