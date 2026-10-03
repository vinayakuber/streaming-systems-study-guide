#!/usr/bin/env python3
"""The sequence of changes and the current state -- and what each cannot answer.

You have a sequence of changes, each saying what a key BECAME.  Produce the
current value of every key.  Then: produce the changes back, from the table.
Then: the log is too long to keep -- what may you discard, and what do you lose?

The second question looks symmetric to the first and is not, and the third is the
one with a cost attached.

Run it:  python3 programs/ch06.py
"""
import random

# Data, from tools/gen_ch06_interview.js over tools/stream_seed.js.  CHANGELOG is
# one entry per seed event, carrying that key's running total AFTERWARDS -- so each
# entry says what the key became, which is what makes the fold an assignment
# rather than an arithmetic update.  No two entries are identical, so a dropped one
# would be visible.  Two keys, so compaction is visibly per-key.
CHANGELOG = [("a", 5), ("a", 8), ("b", 7), ("a", 10), ("a", 16),
             ("b", 8), ("b", 17), ("b", 21), ("a", 24)]
N = len(CHANGELOG)
KEYS = sorted({k for k, _ in CHANGELOG})
ASKED = KEYS[0]                      # "a", which has 5 entries -- enough for a history
UNANSWERABLE = "UNANSWERABLE"        # not a value: the question cannot be answered
TOMBSTONE = None                     # the value that means "this key is gone"

def fold(log):
    """The changes into the state.  Later entries overwrite earlier ones, so THE ORDER
    OF THE LOG IS THE ENTIRE CONTENT OF THE ANSWER -- shuffle it and the table is
    different.  A fold that had to combine values would need an associative
    operation; this one does not, which is what makes it cheap.  A TOMBSTONE entry
    removes the key, because the fold hears only about entries: a key removed by
    ABSENCE would never be removed at all."""
    t = {}
    for k, v in log:
        if v is TOMBSTONE:
            t.pop(k, None)
        else:
            t[k] = v
    return t

def emit(t):
    """The state back out as changes: one entry per key.  That is already the whole
    asymmetry -- folding loses nothing you can get back, and emitting cannot invent
    the intermediate values it never kept."""
    return [(k, t[k]) for k in sorted(t)]

def compact(log):
    """Keep only the LAST entry per key.  Everything dropped was superseded, so the
    state the log folds to does not change -- which the assertions check rather than
    assume.  A tombstone is the one entry that may NOT be dropped until every
    consumer has passed it, so it is kept here."""
    last = {}
    for k, v in log:
        last[k] = v
    return [(k, last[k]) for k in sorted(last)]

def value_after(log, k, n):
    """What key k was after its n-th change.  Answerable from the full log and from
    nothing else.  Returns UNANSWERABLE rather than the current value, because
    answering "24" to a question about the 2nd change is a confident wrong answer
    rather than a missing one."""
    seen = 0
    for key, v in log:
        if key == k:
            seen += 1
            if seen == n:
                return v
    return UNANSWERABLE

def history_of(log, k):
    """Every value a key passed through, in order -- all real past states that
    somebody may have seen."""
    return [v for key, v in log if key == k]

# The three variations.

def the_cache_that_must_not_go_stale(log, live, compacted_start=True):
    """Variation 1, surface: web infrastructure.  Keep an in-memory copy current.

    Non-obvious point: this is `fold` at start-up, and the compacted log is exactly
    the cheap "somewhere" to fold from -- 2 entries instead of 9.  The subtlety is
    the handover: the cache must switch from reading history to following live
    changes WITHOUT a gap, so the position the fold reached is the thing that has to
    be carried across.  Compaction exists for restarts as much as for disk.

    Returns (table, entries_read, handover_version).
    """
    base = list(compact(log) if compacted_start else log)
    t = fold(base)
    version = len(log)              # the fold consumed the whole log's history
    for entry in live:              # then follow live entries from that version on
        base.append(entry)
        t = fold(base)              # the same fold, now over base + what arrived since
        version += 1
    return t, len(base), version

def the_audit_log_that_was_compacted(log, k, n):
    """Variation 2, surface: compliance.  A regulator asks what a record held two
    years ago; the log was compacted last year.

    Non-obvious point: the answer is that the question cannot be answered, and the
    valuable part is that this was decided a year ago by somebody optimising disk.
    The framing that helps separates two logs that were conflated -- a STATE log,
    compactable freely, and an AUDIT log, which may not be -- and they have
    different retention.  There is no recovery scheme, so the answer is that these
    were never the same log.

    Returns (answer_from_state_log, answer_from_audit_log).
    """
    state_log = compact(log)        # compacted last year
    audit_log = log                 # never compacted
    return value_after(state_log, k, n), value_after(audit_log, k, n)

def the_counter_changelog(deltas):
    """Variation 3, surface: metrics.  The entries say what CHANGED ("+5"), not what
    the key became.  Fold them, and compact them.

    Non-obvious point: the fold still works with + in place of =, and compaction
    BREAKS -- you cannot keep "the last +5" and drop the earlier ones, because every
    entry contributes.  The repair is to convert deltas to absolute values first,
    which is `fold` and `emit` composed, and it shows why the log's FORMAT was the
    first thing stated.  A log of deltas cannot be compacted; a log of states can.

    Returns (table, table_after_naive_compaction, table_after_converting_first).
    """
    t = {}
    for k, d in deltas:
        t[k] = t.get(k, 0) + d          # fold with + instead of =
    naive = {}
    for k, d in compact(deltas):        # compaction applied to DELTAS: wrong
        naive[k] = naive.get(k, 0) + d
    states = emit(t)                    # fold, then emit: now they are states
    return t, naive, fold(compact(states))

def main():
    print("CHANGELOG =", "  ".join(f"{k}={v}" for k, v in CHANGELOG))
    table = fold(CHANGELOG)
    back = emit(table)
    small = compact(CHANGELOG)
    same = fold(small)
    lost = N - len(small)
    past_values = sum(max(0, len(history_of(CHANGELOG, k)) - 1) for k in KEYS)
    print(f"  fold    -> {table}   ({N} changes to {len(table)} entries)")
    print(f"  emit    -> {back}   ({len(back)} entries, not {N})")
    print(f"  compact -> {small}   ({lost} of {N} entries dropped)")
    print(f"  fold(compact) -> {same}   (identical: {same == table})")

    assert table == {"a": 24, "b": 21}, table
    assert len(KEYS) >= 2, "compaction would not be visibly per-key"
    assert len(small) == 2 and lost == 7, (small, lost)
    assert same == table, "compaction is NOT state-preserving; the whole claim is wrong"
    assert len(back) == len(table) == 2 and len(back) != N, back
    assert fold(back) == table, "emitting and re-folding must round-trip the present"
    # ...and the asymmetry: the emitted stream cannot reproduce the log it came from
    assert back != CHANGELOG and len(back) < N
    assert past_values == 7, past_values

    hist = history_of(CHANGELOG, ASKED)
    mid = len(hist) // 2
    print(f"\n  key {ASKED!r} passed through {hist}  ({len(hist)} values)")
    print(f"  value_after(full log, {ASKED!r}, {mid})      = {value_after(CHANGELOG, ASKED, mid)}")
    print(f"  value_after(compacted, {ASKED!r}, {mid})     = {value_after(small, ASKED, mid)}")
    assert hist == [5, 8, 10, 16, 24] and len(hist) >= 3, hist
    assert mid == 2 and value_after(CHANGELOG, ASKED, mid) == 8
    assert value_after(small, ASKED, mid) == UNANSWERABLE
    # the opposite outcome is forbidden: it must NOT quietly return the current value
    assert value_after(small, ASKED, mid) != table[ASKED], "a confident wrong answer"
    assert value_after(small, ASKED, 1) == 24, "the present is still answerable"
    assert value_after(CHANGELOG, "zz", 1) == UNANSWERABLE, "an unknown key too"

    # a deletion must be an ENTRY, not an absence -- and it is the one entry
    # compaction may not drop
    with_tomb = CHANGELOG + [("b", TOMBSTONE)]
    assert fold(with_tomb) == {"a": 24}, fold(with_tomb)
    assert fold(compact(with_tomb)) == fold(with_tomb), "compaction dropped the tombstone"
    # the realistic bug is a compaction that keeps the last NON-tombstone entry per
    # key -- i.e. that treats a deletion as an absence.  It resurrects the key.
    last_live = {}
    for k, v in with_tomb:
        if v is not TOMBSTONE:
            last_live[k] = v
    dropped = [(k, last_live[k]) for k in sorted(last_live)]
    assert fold(dropped) == {"a": 24, "b": 21} != fold(with_tomb), fold(dropped)
    print(f"  with a tombstone for 'b': {fold(with_tomb)};  compacting the tombstone away "
          f"resurrects b: {fold(dropped)}")

    # variations
    t1, read, version = the_cache_that_must_not_go_stale(CHANGELOG, [("a", 30)])
    t2, read_full, _ = the_cache_that_must_not_go_stale(CHANGELOG, [("a", 30)], compacted_start=False)
    assert t1 == t2 == {"a": 30, "b": 21}, (t1, t2)
    assert read == 3 and read_full == 10, (read, read_full)
    assert version == N + 1, version
    print(f"\n  cache: same table {t1} from {read} entries instead of {read_full}, handover at version {version}")

    state_ans, audit_ans = the_audit_log_that_was_compacted(CHANGELOG, ASKED, mid)
    assert state_ans == UNANSWERABLE and audit_ans == 8, (state_ans, audit_ans)
    print(f"  audit: the state log says {state_ans}, an uncompacted audit log says {audit_ans}")

    deltas = [("a", 5), ("a", 3), ("b", 7), ("a", 2), ("b", 1)]
    dt, naive, repaired = the_counter_changelog(deltas)
    assert dt == {"a": 10, "b": 8}, dt
    assert naive == {"a": 2, "b": 1} and naive != dt, naive
    assert repaired == dt, "converting to states first must make compaction safe again"
    print(f"  deltas: fold {dt}, compacting the deltas gives {naive} (wrong), converted first {repaired}")

    # brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    for _ in range(800):
        log = [(rng.choice("abcd"), rng.randint(0, 99)) for _ in range(rng.randint(1, 20))]
        t = fold(log)
        assert fold(compact(log)) == t, log            # compaction preserves the present
        assert fold(emit(t)) == t, log                 # emit round-trips the present
        assert len(compact(log)) == len(t) <= len(log)
        for k in "abcde":
            h = history_of(log, k)
            for n in range(1, len(h) + 2):             # and value_after matches a rescan
                want = h[n - 1] if n <= len(h) else UNANSWERABLE
                assert value_after(log, k, n) == want, (log, k, n)
            if len(h) > 1:                             # history is lost by compaction
                assert value_after(compact(log), k, 1) == h[-1]
                assert value_after(compact(log), k, 2) == UNANSWERABLE
    print("\n  800 random changelogs: folding the compacted log always reproduces the")
    print("  table, emit round-trips the present, and value_after matches a rescan --")
    print("  while every key with a history loses all but its last value.")
    print("\nall assertions passed")

if __name__ == "__main__":
    main()
