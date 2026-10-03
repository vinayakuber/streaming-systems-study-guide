#!/usr/bin/env python3
"""Variation 4 -- the counter changelog (looks like metrics). Standalone and runnable.

  A service ships counters, and each entry says what CHANGED -- "errors +5" -- rather than
  what the counter became.  Fold the entries into the current counters.  Then: the log is
  too long to keep.  Compact it.

The fold needs addition where the chapter's needed assignment, which still works and is
barely a change.  Compaction BREAKS: you cannot keep "the last +5" and drop the earlier
ones, because every entry contributes.  The repair is to turn the log into absolute values
first -- fold, then emit -- which is the chapter's two functions composed, and it shows that
the log's FORMAT was the first thing stated for a reason.  A log of states can be compacted
and replayed; a log of deltas can be neither, and both failures are the same fact: an
assignment is idempotent and an addition is not.

WORKED EXAMPLES: the EXAMPLES table below holds 12 input/output pairs -- an empty log and a
single increment, one entry per counter (nothing to compact), the chapter's log and the same
log reversed, both sides of the condition that decides whether keeping the last increment is
harmless (increments that cancel before the last one, and increments that do not), a counter
that cancels to zero, a delete, a log that is ONLY a delete, and two at the 20,000-increment
scale -- one of which the wrong compaction gets exactly right.  Every row is ASSERTED three
ways, so the table cannot drift from the code: change the answer and this file stops running.

Run it:  python3 programs/ch06_v4.py
"""
import random

# The delta log, from the chapter's changelog read as increments: the chapter's entries for
# 'a' were 5, 8, 10, 16, 24, so the increments are +5, +3, +2, +6, +8, and for 'b' 7, 8, 17,
# 21 give +7, +1, +9, +4.  Kept in the chapter's own order, so the totals come out at the
# chapter's 24 and 21 -- the same arithmetic, stated the other way round.
DELTAS = [("errors", 5), ("errors", 3), ("hits", 7), ("errors", 2), ("errors", 6),
          ("hits", 1), ("hits", 9), ("hits", 4), ("errors", 8)]
TRUE = {"errors": 24, "hits": 21}
N = len(DELTAS)
TOMBSTONE = None          # the entry that means "this counter is gone"

# An empty log, a single increment, one entry per counter, a log whose earlier increments
# cancel, increments that cancel to zero, a delete, a log that is only a delete, the
# chapter's log reversed, and two at the scale that gets compaction scheduled.  These are
# inputs for the examples table, not alternative versions of the problem.
EMPTY_LOG = []
ONE_DELTA = [("errors", 5)]
ONE_PER_KEY = [("errors", 5), ("hits", 7)]
NEGATIVE = [("errors", 5), ("errors", -2)]
LUCKY = [("drops", 0), ("drops", 5)]       # earlier increments sum to 0: the naive one works
CANCELLING = [("retries", 5), ("retries", -5), ("errors", 1)]
WITH_DELETE = DELTAS + [("hits", TOMBSTONE)]
ONLY_A_DELETE = [("hits", TOMBSTONE)]
REVERSED = DELTAS[::-1]
BIG_KEY_COUNT, BIG_ENTRY_COUNT = 50, 20_000
BIG_DELTAS = [(f"m{i % BIG_KEY_COUNT}", 1 + (i % 3)) for i in range(BIG_ENTRY_COUNT)]
# the same shape with increments that cycle -3..3, which per counter sum to zero over any
# 7 entries -- so the LAST increment happens to equal the total and the wrong compaction
# comes out exact.  An accidental cancellation is the one case where it looks right.
BIG_CANCELS = [(f"m{i % BIG_KEY_COUNT}", (i % 7) - 3) for i in range(BIG_ENTRY_COUNT)]
BIG_TRUE = {f"m{j}": 799 + (j % 3) for j in range(BIG_KEY_COUNT)}
BIG_CANCELS_TRUE = {f"m{j}": (j % 7) - 3 for j in range(BIG_KEY_COUNT)}

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, delta log, expected totals, does compact_last agree?).  Every row is
# asserted by show_examples(), which is why the table is data and not a comment: a comment
# can go stale silently, and this cannot.
EXAMPLES = [
    ("an empty log: no counters at all", EMPTY_LOG,     {},                             True),
    ("a single increment",               ONE_DELTA,     {"errors": 5},                  True),
    ("one entry per counter",            ONE_PER_KEY,   {"errors": 5, "hits": 7},       True),
    ("the chapter's log",                DELTAS,        {"errors": 24, "hits": 21},     False),
    ("the chapter's log, reversed",      REVERSED,      {"errors": 24, "hits": 21},     False),
    ("two increments, one negative",     NEGATIVE,      {"errors": 3},                  False),
    ("earlier increments cancel: LUCKY", LUCKY,         {"drops": 5},                   True),
    ("a counter that cancels to zero",   CANCELLING,    {"retries": 0, "errors": 1},    False),
    ("a delete at the end of the log",   WITH_DELETE,   {"errors": 24},                 False),
    ("a log that is only a delete",      ONLY_A_DELETE, {},                             True),
    ("20,000 increments, 50 counters",   BIG_DELTAS,    BIG_TRUE,                       False),
    ("20,000 that cancel: naive EXACT",  BIG_CANCELS,   BIG_CANCELS_TRUE,               True),
]


def fold_add(log):
    """The fold for a DELTA log: + where the chapter had =.  Every entry contributes, so
    nothing in the log is redundant and a missing entry is a silently wrong total.  Addition
    commutes, so unlike the chapter's fold this one does not care about order."""
    t = {}
    for k, d in log:
        if d is TOMBSTONE:
            t.pop(k, None)
        else:
            t[k] = t.get(k, 0) + d
    return t


def fold_assign(log):
    """The chapter's fold, for a log of STATES: later entries overwrite earlier ones.  Order
    is the whole content of the answer, and applying an entry twice changes nothing."""
    t = {}
    for k, v in log:
        if v is TOMBSTONE:
            t.pop(k, None)
        else:
            t[k] = v
    return t


def emit(table):
    """The table back out as one entry per key.  For a state log this is a legal log; it is
    how a delta log becomes a compactable one."""
    return [(k, table[k]) for k in sorted(table)]


def compact_last(log):
    """Keep the last entry per key -- the chapter's compaction, applied to deltas.

    For a state log every dropped entry was superseded.  For a delta log nothing is ever
    superseded, so this keeps the last increment and throws away the counter.  It is not a
    smaller log of the same thing, it is a log of something else.
    """
    last = {}
    for k, d in log:
        last[k] = d
    return [(k, last[k]) for k in sorted(last)]


def compact_sum(log):
    """The compaction a delta log actually admits: ADD the increments per key instead of
    keeping the last one.

    One entry per key, same as the chapter's, and the fold is unchanged -- so delta logs are
    compactable after all.  What is not preserved is the thing the chapter's compaction kept
    for free: the result may only ever be applied to an empty state, because re-applying it
    adds the whole history again.  The entries look identical to `emit`'s and mean something
    different, which is the trap.
    """
    total = {}
    for k, d in log:
        if d is TOMBSTONE:
            total.pop(k, None)
        else:
            total[k] = total.get(k, 0) + d
    return [(k, total[k]) for k in sorted(total)]


def to_states(log):
    """fold, then emit: the two chapter functions composed, which converts a delta log into
    a state log.  After this the chapter's compaction is legal again, and so is replay."""
    return emit(fold_add(log))


def _tot(t):
    """Totals narrow enough for a column.  Fifty counters print as a count and one value."""
    if not t:
        return "{}"
    if len(t) <= 2:
        return " ".join(f"{k}={v}" for k, v in sorted(t.items()))
    k, v = min(t.items())
    return f"{len(t)} counters, {k}={v}"


def show_examples():
    """Print the examples table and assert every row.

    Each row is checked three ways: the fold with +, the fold of the summed compaction, and
    an independent per-counter reference that slices the log instead of making one pass.
    Both compactions' sizes are printed, because the size is NOT what separates them -- they
    usually tie, and the last two rows show the same 20,000 entries reduced to the same 50
    either way, right in one case and wrong in the other.  The last row is the uncomfortable
    one: increments that cancel make the wrong compaction exactly right.
    """
    def reference(log):
        """Per counter, the increments AFTER the last delete, summed.  A different mechanism
        from fold_add -- it slices per key where fold_add makes a single pass."""
        out = {}
        for key in {k for k, _ in log}:
            ds = [d for k, d in log if k == key]
            after = ds[max((i for i, d in enumerate(ds) if d is TOMBSTONE), default=-1) + 1:]
            if after:
                out[key] = sum(after)
        return out

    print(f"{'what it exercises':34s} {'in':>7} {'sum':>5} {'last':>5} "
          f"{'the totals':>22} {'off by':>7}  verdict")
    for label, log, want, naive_ok in EXAMPLES:
        totals = fold_add(log)
        assert totals == want, (label, totals, want)
        assert reference(log) == want, (label, "the reference disagrees", reference(log))
        summed, naive = compact_sum(log), compact_last(log)
        assert fold_add(summed) == want, (label, "summing the increments must preserve the fold")
        assert fold_assign(to_states(log)) == want, (label, "converting to states must too")
        from_naive = fold_add(naive)
        assert (from_naive == want) == naive_ok, (label, from_naive, want)
        off = max((abs(want[k] - from_naive.get(k, 0)) for k in want), default=0)
        size = ("tie" if len(summed) == len(naive) else
                "sum smaller" if len(summed) < len(naive) else "last smaller")
        verdict = f"{size}, " + ("naive agrees" if naive_ok else f"naive WRONG by {off}")
        print(f"{label:34s} {len(log):>7} {len(summed):>5} {len(naive):>5} "
              f"{_tot(totals):>22} {off:>7}  {verdict}")
    print(f"all {len(EXAMPLES)} examples agree with a per-counter reference sum and with both "
          f"safe compactions")
    print()


def main():
    show_examples()
    print("DELTAS =", "  ".join(f"{k}{d:+d}" for k, d in DELTAS), f"   ({N} entries)")
    totals = fold_add(DELTAS)
    naive = compact_last(DELTAS)
    summed = compact_sum(DELTAS)
    states = to_states(DELTAS)
    print(f"  fold with +            -> {totals}")
    print(f"  compact_last(deltas)   -> {naive}  folds to {fold_add(naive)}   WRONG")
    print(f"  compact_sum(deltas)    -> {summed}  folds to {fold_add(summed)}   right")
    print(f"  to_states = fold+emit  -> {states}  folds to {fold_assign(states)}   right")

    assert totals == TRUE, totals
    assert fold_add(naive) == {"errors": 8, "hits": 4} != TRUE, fold_add(naive)
    assert fold_add(summed) == TRUE, "summing the increments must preserve the fold"
    assert fold_assign(states) == TRUE, "and so must converting to states first"
    lost = {k: TRUE[k] - fold_add(naive)[k] for k in TRUE}
    assert lost == {"errors": 16, "hits": 17}, lost
    assert all(v > 0 for v in lost.values()), "keeping the last delta can only ever understate"
    print(f"\n  keeping the last increment understates by {lost} -- the dropped entries were")
    print(f"  not superseded, they were summands, so the error is the size of the history.")

    # the entries of compact_sum and to_states are IDENTICAL bytes and different meanings
    assert summed == states == [("errors", 24), ("hits", 21)], (summed, states)
    print(f"\n  compact_sum and to_states produce the same entries, {summed},")
    print(f"  and they are not the same log: one is 'add 24' and the other is 'it is 24'.")
    twice_delta = fold_add(summed + summed)
    twice_state = fold_assign(states + states)
    print(f"  replayed twice: as deltas {twice_delta}, as states {twice_state}")
    assert twice_delta == {"errors": 48, "hits": 42} != TRUE, twice_delta
    assert twice_state == TRUE, "a state log must survive replay, that is the point of one"
    assert twice_delta != twice_state
    print(f"  so a consumer that re-reads the log double-counts the delta log and is unharmed")
    print(f"  by the state log.  Compaction and replay-safety are the same property.")

    # the asymmetry in the other direction: order
    rng = random.Random(20260303)
    shuffled = DELTAS[:]
    rng.shuffle(shuffled)
    shuffled_states = states[:]
    rng.shuffle(shuffled_states)
    assert fold_add(shuffled) == TRUE, "addition commutes, so a delta log may be reordered"
    reordered_state_log = [("errors", 5), ("errors", 24), ("errors", 8)]
    assert fold_assign(reordered_state_log) == {"errors": 8} != TRUE
    print(f"\n  a delta log may be shuffled freely (still {fold_add(shuffled)}); a state log may")
    print(f"  not -- reordering {reordered_state_log} gives")
    print(f"  {fold_assign(reordered_state_log)}.  Each format is robust to exactly what the")
    print(f"  other is not: deltas to order, states to duplication.")

    # boundary: a counter whose increments cancel.  Zero is a VALUE, absence is not.
    cancels = [("retries", 5), ("retries", -5), ("errors", 1)]
    zero_sum = compact_sum(cancels)
    pruned = [(k, v) for k, v in zero_sum if v != 0]        # "drop the no-ops"
    assert fold_add(cancels) == {"retries": 0, "errors": 1}
    assert zero_sum == [("errors", 1), ("retries", 0)], zero_sum
    assert fold_add(pruned) == {"errors": 1} != fold_add(cancels), fold_add(pruned)
    print(f"\n  increments that cancel: {cancels}")
    print(f"  compact_sum keeps {zero_sum}; dropping the zero as a no-op gives")
    print(f"  {fold_add(pruned)} and loses the fact that the counter EXISTS -- 'retries = 0'")
    print(f"  and 'no retries counter' are different dashboards.")

    # a tombstone is still the one entry no compaction may drop, in either format
    with_tomb = DELTAS + [("hits", TOMBSTONE)]
    assert fold_add(with_tomb) == {"errors": 24}, fold_add(with_tomb)
    assert fold_add(compact_sum(with_tomb)) == fold_add(with_tomb), "the tombstone was dropped"
    last_live = {}
    for k, d in with_tomb:
        if d is not TOMBSTONE:
            last_live[k] = last_live.get(k, 0) + d
    resurrecting = [(k, last_live[k]) for k in sorted(last_live)]
    assert fold_add(resurrecting) == TRUE != fold_add(with_tomb), fold_add(resurrecting)
    print(f"\n  with a delete for 'hits': {fold_add(with_tomb)}; a compactor that sums only the")
    print(f"  non-tombstone entries -- i.e. reads the delete as an absence -- brings it back as")
    print(f"  {fold_add(resurrecting)}.  The delete is a fact, not a gap in the data.")

    # many inputs, and the precise condition under which the naive compaction is harmless
    def naive_is_harmless(log):
        """CORRECTED CLAIM.  The first guess was "it agrees exactly when every counter has
        one entry, i.e. when there was nothing to compact", and a random case refused it:
        [('drops', 0), ('drops', 5)] has two entries and compacts correctly.  The real
        condition is that for every counter the increments BEFORE the last one sum to zero
        -- having only one entry is the common way for that to happen, not the only one.
        """
        per = {}
        for k, d in log:
            per.setdefault(k, []).append(d)
        return all(sum(ds[:-1]) == 0 for ds in per.values())

    ok, broken, checked, once = 0, 0, 0, 0
    for _ in range(1500):
        n = rng.randint(1, 16)
        log = [(rng.choice(("errors", "hits", "retries", "drops")),
                rng.randint(-9, 9)) for _ in range(n)]
        want = fold_add(log)
        assert fold_add(compact_sum(log)) == want, log          # always safe
        assert fold_assign(to_states(log)) == want, log         # always safe
        assert fold_assign(compact_last(to_states(log))) == want, log
        once_only = len({k for k, _ in log}) == len(log)
        agrees = fold_add(compact_last(log)) == want
        assert agrees == naive_is_harmless(log), (log, agrees)   # the exact condition
        if once_only:
            assert agrees, log                                   # one entry per key: trivial
        checked += 1
        ok += agrees
        once += once_only
        broken += not agrees
        shuf = log[:]
        rng.shuffle(shuf)
        assert fold_add(shuf) == want, log                      # order-free, always
    print(f"\n  {checked} random delta logs: summing the increments and converting to states both")
    print(f"  always reproduce the totals.  Keeping the last increment agreed in {ok} cases and")
    print(f"  broke in {broken}, and it agreed in EXACTLY the logs where every counter's earlier")
    print(f"  increments sum to zero -- {once} of those had one entry per counter (nothing to")
    print(f"  compact) and the other {ok - once} cancelled out by luck, which is the worse case:")
    print(f"  a test built from short logs can pass for both reasons.")
    assert (ok, broken, once) == (238, 1262, 223), (ok, broken, once)
    assert broken > ok, "the naive compaction must be wrong on most real logs"
    assert once < ok, "and some agreements are luck, not triviality"

    # the scale that makes compaction worth doing at all
    BIG_KEYS, BIG_ENTRIES = 50, 20_000
    # increments are positive here, as a counter's are: the first attempt used increments
    # cycling through -3..3, and at 400 entries per counter they summed to exactly zero, so
    # compact_last came out EXACT at scale and the comparison said nothing.  An accidental
    # cancellation is the one case where the wrong compaction looks right, and it is easier
    # to build by accident than it sounds.
    big = [(f"m{i % BIG_KEYS}", 1 + (i % 3)) for i in range(BIG_ENTRIES)]
    big_sum = compact_sum(big)
    big_naive = compact_last(big)
    big_true = fold_add(big)
    worst = max(abs(big_true[k] - fold_add(big_naive).get(k, 0)) for k in big_true)
    print(f"\n  at {BIG_ENTRIES:,} increments over {BIG_KEYS} counters:")
    print(f"    compact_sum  -> {len(big_sum)} entries, totals exact "
          f"({len(big) // len(big_sum)}x smaller)")
    print(f"    compact_last -> {len(big_naive)} entries, worst counter off by {worst}")
    print(f"    both logs are the same SIZE, so the saving was never the thing in question --")
    print(f"    the question was what the entries mean.")
    assert len(big_sum) == len(big_naive) == BIG_KEYS
    assert fold_add(big_sum) == big_true, "exact at scale"
    assert worst > 0 and fold_add(big_naive) != big_true
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
