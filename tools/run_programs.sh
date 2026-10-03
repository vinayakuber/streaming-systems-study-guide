#!/usr/bin/env bash
# run_programs.sh — run every runnable program and capture its output.
#
# WHY: a program printed in a document is a claim that it works. The only way to
# keep that claim true is to RUN it, which is what this does: every programs/*.py
# is executed, its stdout is written next to it as .out, and a non-zero exit fails
# the script. Each program asserts its own expected figures, so "it ran" and "it is
# correct" are the same event.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0; n=0
for f in programs/*.py; do
  [ -e "$f" ] || continue
  n=$((n+1))
  out="${f%.py}.out"
  if python3 "$f" > "$out.tmp" 2>"$out.err"; then
    mv "$out.tmp" "$out"; rm -f "$out.err"
  else
    fail=1
    printf '  \033[31mFAIL\033[0m  %s\n' "$f"
    sed 's/^/          /' "$out.err" | tail -8
    rm -f "$out.tmp"
  fi
done
if [ $fail -eq 0 ]; then echo "$n/$n programs run and self-assert clean"; else echo "SOME PROGRAMS FAILED"; fi
exit $fail
