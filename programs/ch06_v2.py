#!/usr/bin/env python3
"""Variation 2 -- the cache that must not go stale (looks like web infrastructure).
Standalone and runnable.

  A service keeps an in-memory copy of a table.  Every change to that table is written
  to a log, one entry per change, each saying what a key BECAME.  Keep the copy current.

  The service restarts.  It must rebuild the copy and then follow live changes again.

The question sounds like "apply changes as they arrive" and the loop is trivial.  The
operational content is the START-UP: the copy has to be folded from somewhere, and a
COMPACTED log -- one entry per key -- is exactly the cheap somewhere.  Then the service
must switch from reading history to following live changes without a GAP, so the version
the fold reached is the thing that has to be carried across.  Subscribing from "now"
instead of from the snapshot's version is the bug, and it is silent: the copy answers
every read confidently with a value that stopped being true during start-up.

WORKED EXAMPLES: the EXAMPLES table below holds 14 input/output pairs -- the correct
handover, both sides of the version boundary (one entry of overlap, one entry of gap), a
gap that a live entry silently repairs, a delete inside the gap, an empty log, a one-entry
log, a log with no repeated keys where the warm start reads MORE than a cold one, and the
20,000-change scale.  Every row is ASSERTED against a cold start, so the table cannot
drift from the code: change the answer and this file stops running.

Run it:  python3 programs/ch06_v2.py
"""
import random

# The log, from the chapter's changelog: one entry per change, carrying what the key
# BECAME (not what changed), which is what makes the fold an assignment.  Nine entries,
# two keys, no two entries identical -- so any entry the start-up skips is visible.
LOG = [("a", 5), ("a", 8), ("b", 7), ("a", 10), ("a", 16),
       ("b", 8), ("b", 17), ("b", 21), ("a", 24)]
LIVE = [("a", 30)]            # what arrives while the service is coming back up
N = len(LOG)
TOMBSTONE = None              # the entry that means "this key is gone"
ABSENT = object()             # not a value: the key is not in the table at all

# The snapshot was taken two changes before the end of the log.  A real snapshot is
# always behind: it is written periodically, not at the instant of a crash.
SNAPSHOT_VERSION = 7

# An empty log, a one-entry log, a log whose keys never repeat (so compaction has nothing
# to drop), the chapter's log with a delete appended, a different live entry, and the scale
# at which a snapshot is worth writing.  These are inputs for the examples table, not
# alternative versions of the problem.
EMPTY_LOG = []
ONE_ENTRY = [("a", 5)]
DISTINCT_LOG = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
LOG_DEL = LOG + [("b", TOMBSTONE)]
LIVE_B = [("b", 99)]
BIG_KEY_COUNT, BIG_CHANGE_COUNT = 50, 20_000
BIG_LOG = [(f"k{i % BIG_KEY_COUNT}", i) for i in range(BIG_CHANGE_COUNT)]

# The tables those inputs fold to, written out so the EXAMPLES rows stay one line each.
DISTINCT_TABLE = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
BIG_TABLE = {f"k{i}": 19_950 + i for i in range(BIG_KEY_COUNT)}   # the last change per key
BIG_STALE = {f"k{i}": 19_900 + i for i in range(BIG_KEY_COUNT)}   # one change per key behind

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, log, snapshot_version, subscribe_from, live, expected table).  Every
# row is asserted by show_examples() against a cold start, which is why the table is data
# and not a comment: a comment can go stale silently, and this cannot.
EXAMPLES = [
    ("empty log, nothing live",            EMPTY_LOG,    0,      0,      [],     {}),
    ("one entry, no snapshot yet",         ONE_ENTRY,    0,      0,      [],     {"a": 5}),
    ("one entry, snapshot at the tail",    ONE_ENTRY,    1,      1,      [],     {"a": 5}),
    ("snapshot at v0 = a cold start",      LOG,          0,      0,      LIVE,   {"a": 30, "b": 21}),
    ("the correct handover, v7 -> v7",     LOG,          7,      7,      LIVE,   {"a": 30, "b": 21}),
    ("one entry of OVERLAP, v7 -> v6",     LOG,          7,      6,      LIVE,   {"a": 30, "b": 21}),
    ("one entry of GAP, v7 -> v8",         LOG,          7,      8,      LIVE,   {"a": 30, "b": 17}),
    ("subscribe from NOW, v7 -> v9",       LOG,          7,      9,      LIVE,   {"a": 30, "b": 17}),
    ("a gap a live entry overwrites",      LOG,          7,      8,      LIVE_B, {"a": 24, "b": 99}),
    ("a delete inside the gap",            LOG_DEL,      7,      10,     [],     {"a": 16, "b": 17}),
    ("keys never repeat, max overlap",     DISTINCT_LOG, 5,      0,      [],     DISTINCT_TABLE),
    ("keys never repeat, exact handover",  DISTINCT_LOG, 5,      5,      [],     DISTINCT_TABLE),
    ("20,000 changes, snapshot at tail",   BIG_LOG,      20_000, 20_000, [],     BIG_TABLE),
    ("20,000 changes, a 50-entry gap",     BIG_LOG,      19_950, 20_000, [],     BIG_STALE),
]


def fold(entries):
    """Changes into a table.  Later entries overwrite earlier ones, so the ORDER of the
    entries is the whole content of the answer.  A TOMBSTONE removes the key, because the
    fold hears only about entries -- a key removed by absence would never be removed."""
    t = {}
    for k, v in entries:
        if v is TOMBSTONE:
            t.pop(k, None)
        else:
            t[k] = v
    return t


def compact(entries):
    """Keep the LAST entry per key.  Everything dropped was superseded, so the table the
    log folds to is unchanged -- which is what makes a compacted log a legal start-up
    source.  The tombstone is an entry like any other and is KEPT."""
    last = {}
    for k, v in entries:
        last[k] = v
    return [(k, last[k]) for k in sorted(last)]


def compact_dropping_tombstones(entries):
    """The compaction a careless implementation writes: keep the last NON-tombstone entry
    per key, i.e. treat a delete as an absence rather than as a fact.  It is the realistic
    bug, and the damage is visible only after a restart."""
    last = {}
    for k, v in entries:
        if v is not TOMBSTONE:
            last[k] = v
    return [(k, last[k]) for k in sorted(last)]


def cold_start(log, live):
    """Rebuild by folding the entire log from the first entry ever written.  Correct, and
    it reads every entry the table has ever had.  Returns (table, entries_read)."""
    entries = list(log) + list(live)
    return fold(entries), len(entries)


def warm_start(log, snapshot_version, subscribe_from, live):
    """Rebuild from the snapshot, then follow the log from `subscribe_from` on.

    The snapshot IS a compacted log: one entry per key as of `snapshot_version`.  Folding
    it is cheap.  The only decision that matters is `subscribe_from`: the snapshot carries
    a version, and the subscription has to begin at or before it.  Beginning later leaves
    a gap; beginning earlier re-applies entries, which for a log of STATES is free,
    because assigning the same value twice is the same as assigning it once.

    Returns (table, entries_read, overlap_or_gap) where the third value is positive for
    an overlap and negative for a gap.
    """
    snap = compact(log[:snapshot_version])
    table = fold(snap)
    tail = list(log[subscribe_from:]) + list(live)
    for k, v in tail:
        if v is TOMBSTONE:
            table.pop(k, None)
        else:
            table[k] = v
    return table, len(snap) + len(tail), snapshot_version - subscribe_from


def gap_is_harmful(log, snapshot_version, subscribe_from, live):
    """Whether skipping log[snapshot_version:subscribe_from] can be detected in the table.

    The mechanism: a skipped entry is harmless when a LATER applied entry for the same key
    overwrites whatever the skip got wrong.  It is harmful exactly when no later entry for
    that key is applied AND the snapshot's value for the key differs from the skipped one.
    That is why gaps are not caught in testing -- most skips are overwritten moments later.
    """
    snap_table = fold(compact(log[:snapshot_version]))
    applied_later = {k for k, _ in list(log[subscribe_from:]) + list(live)}
    last_skipped = {}
    for k, v in log[snapshot_version:subscribe_from]:
        last_skipped[k] = v
    for k, v in last_skipped.items():
        if k in applied_later:
            continue
        want = ABSENT if v is TOMBSTONE else v
        if snap_table.get(k, ABSENT) != want:
            return True
    return False


def _tbl(t):
    """A table narrow enough for a column.  Fifty keys print as their count and first key."""
    if not t:
        return "{}"
    if len(t) <= 3:
        return " ".join(f"{k}={v}" for k, v in sorted(t.items()))
    k, v = min(t.items())
    return f"{len(t)} keys, {k}={v}"


def show_examples():
    """Print the examples table and assert every row.

    Each row is checked TWO ways: the warm start must produce the expected table, and the
    cold start -- the brute-force fold of every entry ever written -- must agree about
    whether anything was lost.  The costs of both are printed, because the warm start is
    not always the cheaper one: a log whose keys never repeat has nothing for compaction
    to drop, so an overlapping handover reads the history twice.
    """
    print(f"{'what it exercises':34s} {'log':>6} {'snap':>6} {'sub':>6} {'slack':>6} "
          f"{'the table':>18} {'warm':>6} {'cold':>6}  verdict")
    for label, log, snap_v, sub_from, live, want in EXAMPLES:
        table, warm_read, slack = warm_start(log, snap_v, sub_from, live)
        truth, cold_read = cold_start(log, live)
        assert table == want, (label, table, want)
        assert (table != truth) == gap_is_harmful(log, snap_v, sub_from, live), (label, table, truth)
        verdict = ("warm wins" if warm_read < cold_read else
                   "warm LOSES" if warm_read > cold_read else "tie")
        if table != truth:
            verdict += ", STALE"
        print(f"{label:34s} {len(log):>6} {snap_v:>6} {sub_from:>6} {slack:>6} "
              f"{_tbl(table):>18} {warm_read:>6} {cold_read:>6}  {verdict}")
    print(f"all {len(EXAMPLES)} examples match a cold start exactly where the gap predicate says they must")
    print()


def main():
    show_examples()
    truth, cold_read = cold_start(LOG, LIVE)
    snap = compact(LOG[:SNAPSHOT_VERSION])
    print("LOG  =", "  ".join(f"{k}={v}" for k, v in LOG), f"   ({N} entries)")
    print("LIVE =", "  ".join(f"{k}={v}" for k, v in LIVE), "   (arrives during start-up)")
    print(f"snapshot at version {SNAPSHOT_VERSION} = {snap}   "
          f"({len(snap)} entries for {SNAPSHOT_VERSION} changes)")
    print(f"the table, truth = {truth}\n")

    good, good_read, good_slack = warm_start(LOG, SNAPSHOT_VERSION, SNAPSHOT_VERSION, LIVE)
    now, now_read, now_slack = warm_start(LOG, SNAPSHOT_VERSION, N, LIVE)
    over, over_read, over_slack = warm_start(LOG, SNAPSHOT_VERSION, 5, LIVE)
    print(f"  cold start, from entry 0        -> {truth}   {cold_read} entries read")
    print(f"  warm, subscribe from v={SNAPSHOT_VERSION}        -> {good}   {good_read} entries read   "
          f"(slack {good_slack})")
    print(f"  warm, subscribe from NOW (v={N})  -> {now}   {now_read} entries read   "
          f"(slack {now_slack}: a gap)")
    print(f"  warm, subscribe from v=5        -> {over}   {over_read} entries read   "
          f"(slack {over_slack}: an overlap)")

    assert truth == {"a": 30, "b": 21}, truth
    assert good == truth, "the handover version is the whole trick and it must work"
    assert over == truth, "re-applying entries must be free for a log of states"
    assert now != truth, "subscribing from now must lose the changes made during start-up"
    assert now == {"a": 30, "b": 17}, now
    # the gap is wrong on exactly the key whose last change fell inside it
    assert [k for k in truth if now.get(k) != truth[k]] == ["b"]
    assert truth["b"] - now["b"] == 4, "b was 17 at the snapshot and 21 in the log"
    assert gap_is_harmful(LOG, SNAPSHOT_VERSION, N, LIVE) is True
    assert gap_is_harmful(LOG, SNAPSHOT_VERSION, SNAPSHOT_VERSION, LIVE) is False
    print(f"\n  the gap lost ('b', 21) and the cache then served b=17 forever: a wrong answer")
    print(f"  that no read can distinguish from a right one.  The overlap cost {over_read - good_read}")
    print(f"  extra entries and changed nothing -- so the safe direction is backwards.")

    # ...and a key dropped during the gap is the sharper case: the entry skipped is the
    # TOMBSTONE, so the cache keeps serving a record the table no longer has.
    log_del = LOG + [("b", TOMBSTONE)]
    t_del, _ = cold_start(log_del, [])
    g_del, _, _ = warm_start(log_del, SNAPSHOT_VERSION, len(log_del), [])
    assert t_del == {"a": 24} and "b" in g_del, (t_del, g_del)
    assert gap_is_harmful(log_del, SNAPSHOT_VERSION, len(log_del), []) is True
    print(f"  with a delete inside the gap: truth {t_del}, the cache {g_del} -- it serves a")
    print(f"  deleted record, which is the same bug wearing its worst clothes.")

    # the snapshot's own compaction has to keep the tombstone, or every restart resurrects
    full = compact(log_del)
    buggy = compact_dropping_tombstones(log_del)
    assert fold(full) == t_del, "correct compaction is state-preserving"
    assert fold(buggy) == {"a": 24, "b": 21} != t_del, fold(buggy)
    print(f"\n  snapshot built by keeping the last entry per key      -> {fold(full)}  (correct)")
    print(f"  snapshot built by keeping the last NON-tombstone entry -> {fold(buggy)}  (b is back)")
    print(f"  the delete was a FACT; dropping it as an absence resurrects the key at restart.")

    # boundaries: a snapshot at version 0 is a cold start, and at N it needs no tail
    assert warm_start(LOG, 0, 0, LIVE)[0] == truth, "an empty snapshot still has to work"
    assert warm_start(LOG, N, N, LIVE)[0] == truth, "a snapshot at the tail needs no history"
    assert warm_start(LOG, N, N, [])[0] == fold(LOG), "and with nothing live, just the log"
    print(f"\n  snapshot at version 0 (none yet) and at version {N} (fully caught up) both")
    print(f"  reproduce the table, so the handover needs no special case at either end.")

    # many inputs: the gap is wrong exactly when the predicate says so, never otherwise
    rng = random.Random(20260303)
    harmful, harmless, cases = 0, 0, 0
    for _ in range(1500):
        n = rng.randint(1, 14)
        log = []
        for _ in range(n):
            k = rng.choice("abcd")
            log.append((k, TOMBSTONE if rng.random() < 0.12 else rng.randint(0, 9)))
        live = [(rng.choice("abcd"), rng.randint(0, 9)) for _ in range(rng.randint(0, 3))]
        want = fold(list(log) + live)
        for v in range(len(log) + 1):
            # the correct handover, and an overlap, must both reproduce the table exactly
            assert warm_start(log, v, v, live)[0] == want, (log, v)
            for back in range(0, v + 1):
                assert warm_start(log, v, back, live)[0] == want, (log, v, back)
            for ahead in range(v + 1, len(log) + 1):
                got = warm_start(log, v, ahead, live)[0]
                bad = gap_is_harmful(log, v, ahead, live)
                assert (got != want) == bad, (log, live, v, ahead, got, want, bad)
                cases += 1
                harmful += bad
                harmless += not bad
    # CORRECTED CLAIM.  "A gap is usually overwritten within a few entries" was the first
    # expectation and the measurement refuses it: the harmful cases are the MAJORITY
    # (32849 vs 26511).  What is true, and is the reason the bug ships, is weaker and
    # still damning: 44.7% of random gaps leave no trace in the table at all, so a test
    # that restarts the service and compares the table passes about half the time.
    share = harmless / cases
    print(f"\n  {cases} random gaps: the table is wrong in exactly the {harmful} cases the")
    print(f"  predicate calls harmful, and right in the other {harmless} -- {share:.1%} of gaps leave")
    print(f"  no trace at all, so a restart-and-compare test passes about half the time.")
    assert (harmful, harmless) == (32849, 26511), (harmful, harmless)
    assert harmful > harmless, "the majority of gaps ARE detectable; do not soften this"
    assert 0.40 < share < 0.50, share

    # the scale that makes a compacted snapshot worth having
    BIG_KEYS, BIG_CHANGES = 50, 20_000
    big = [(f"k{i % BIG_KEYS}", i) for i in range(BIG_CHANGES)]
    big_snap = compact(big)
    cold_cost = cold_start(big, [])[1]
    warm_cost = warm_start(big, BIG_CHANGES, BIG_CHANGES, [])[1]
    print(f"\n  at {BIG_CHANGES:,} changes over {BIG_KEYS} keys: cold start reads {cold_cost:,} entries,")
    print(f"  a compacted snapshot reads {warm_cost} -- {cold_cost // warm_cost}x less, and the ratio is the")
    print(f"  change count over the KEY count, so it grows for as long as the service runs.")
    assert len(big_snap) == BIG_KEYS and warm_cost == BIG_KEYS
    assert fold(big_snap) == fold(big), "compaction must still be state-preserving at scale"
    assert cold_cost == BIG_CHANGES and cold_cost // warm_cost == 400
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
