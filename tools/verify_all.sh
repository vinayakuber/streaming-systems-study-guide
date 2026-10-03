#!/usr/bin/env bash
# verify_all.sh — every gate, one command. "Did I follow the standard?" must be
# answerable without remembering which checkers exist.
#
# The chain being verified is ONE story told four times:
#   stream_seed.js -> visual walkthrough  (diagrams/anim/<concept>)
#                  -> memory walkthrough  (diagrams/anim/<concept>-memory)
#                  -> docs/chNN-*.md      (to_markdown splices both embeds)
# Every number in all of them comes from the seed.
#
# GLOB, never a hand-written list: a list of generators or embeds goes stale the
# moment a chapter is added, and then reports "N/N" while checking fewer.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
run() { # run <label> <cmd...>
  local label="$1"; shift
  local out; out="$("$@" 2>&1)"; local rc=$?
  if [ $rc -eq 0 ]; then printf '  \033[32mPASS\033[0m  %-26s %s\n' "$label" "$(echo "$out" | tail -1)"
  else fail=1; printf '  \033[31mFAIL\033[0m  %-26s\n' "$label"; echo "$out" | sed 's/^/          /' | tail -12; fi
}

echo "regenerating every artifact from the one seed..."
for g in tools/gen_ch*.js; do node "$g" >/dev/null || { echo "  GENERATOR FAILED: $g"; fail=1; }; done
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
CAPS=$(mktemp)
for d in diagrams/anim/*/frames; do node tools/extract_captions.js "$d" >> "$CAPS"; done
run "captions checkable"   node tools/teaching_gate.js --only=T8 "$CAPS"

echo; echo "THE GEOMETRY"
# ONE Chrome session for every frame in the repo, not one per walkthrough: at 20
# walkthroughs the per-walkthrough loop spent almost all its time on browser
# startup. The static-form check needs a PAIR per walkthrough and still loops,
# but it is 1 frame each rather than all of them.
run "all frames"           python3 tools/verify_diagram.py diagrams/anim/*/frames/step-*.svg
# ONE invocation for every static-fallback PAIR, rendered concurrently. The loop
# launched two Chrome instances per walkthrough serially; at 80 walkthroughs that was
# almost all of the wall clock. Each pair still gets its own canvas, read from its own
# animated file, so the check is unchanged — proven by diffing the ink bboxes against
# the per-pair runs.
PAIRS=()
for d in diagrams/anim/*/; do
  w=$(basename "$d")
  PAIRS+=("$d$w.svg" "$d"frames/step-01.svg)
done
run "static fallbacks"     python3 tools/verify_diagram.py "${PAIRS[@]}" --fallback

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

rm -f "$CAPS"
echo
[ $fail -eq 0 ] && echo "ALL GATES PASS" || echo "SOME GATES FAILED"
exit $fail
