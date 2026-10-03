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


def main():
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
