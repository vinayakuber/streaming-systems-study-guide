#!/usr/bin/env python3
"""Variation 3 — the island count (looks like puzzles). Standalone and runnable.

  Positions on a line are turned on one at a time, in any order.  After each one, report HOW
  MANY CONTIGUOUS STRETCHES are on.

It is the chapter's problem with the gap set to 1 and only a count wanted, and dropping the
detail makes a much better answer available.  A new position can join at most TWO stretches --
the one ending at p-1 and the one starting at p+1 -- so the count changes by exactly +1, 0 or
-1 and nothing has to be searched at all.  The non-obvious part is that this needs no interval
structure whatsoever: a map from each stretch's ENDPOINTS to its length, consulted at the two
neighbours, is O(1) per position against the chapter's O(log runs).  Noticing that the question
asked only for a count is where the saving comes from.

Run it:  python3 programs/ch04_v3.py
"""

import random

# The chapter's own island sequence, with two positions appended.  5 then 7 then 6 is the
# -1 case: 6 joins TWO stretches and the count goes DOWN, which is the move the whole
# problem exists for.  4 at the end joins 1..3 to 5..7, a second -1, and the repeated 4
# after it must change nothing at all.
POSITIONS = [5, 7, 6, 1, 2, 3, 4, 4]

# The chapter's nine arrival times, reused to show the opposite extreme: no two of them are
# within 1 of each other, so every one is its own island and the count only ever rises.  It
# is the same data the chapter merges runs over -- with G = 1 instead of 47, nothing merges.
SPARSE = [1, 3, 90, 130, 245, 260, 220, 50, 540]


def count_by_rescan(positions):
    """The reference: after each position, count the stretches from scratch.

    A stretch starts at every on position whose left neighbour is off, so counting starts is
    the same as counting stretches.  Correct, obviously so, and it re-reads the whole set
    every time.  Returns (counts, ops)."""
    on, out, ops = set(), [], 0
    for p in positions:
        on.add(p)
        ops += len(on)
        out.append(sum(1 for q in on if q - 1 not in on))
    return out, ops


def count_by_runs(positions):
    """The chapter's state, unchanged: keep the merged runs and report how many there are.

    `touching` with the gap at 1 and `absorb` doing the merge, exactly as written for the
    door log.  It is correct and it answers MORE than was asked -- it can also say where each
    stretch is -- and that extra information is what costs a scan of the runs each time.
    Returns (counts, ops, runs)."""
    runs, out, ops = [], [], 0
    for p in positions:
        ops += len(runs)
        hit = [r for r in runs if p >= r[0] - 1 and p <= r[1] + 1]
        rest = [r for r in runs if r not in hit]
        lo = min([p] + [r[0] for r in hit])
        hi = max([p] + [r[1] for r in hit])
        runs = sorted(rest + [(lo, hi)])
        out.append(len(runs))
    return out, ops, runs


def count_by_endpoints(positions, verify=None):
    """The answer: a map from a stretch's two ENDPOINTS to its length, and a running count.

    The mechanism rests on one fact: when p is about to be turned on, p-1 (if on) must be the
    RIGHT end of its stretch, because p itself is off -- and symmetrically p+1 must be a LEFT
    end.  So the only two map entries ever read are guaranteed fresh, and the entries for
    interior positions are allowed to go stale and are never consulted.

    The count then moves by arithmetic: +1 for the new stretch, -1 for each neighbour it
    swallows, so +1, 0 or -1 and never anything else.  Returns (counts, deltas, length_map).
    `verify` is a brute-force length function used to check the freshness claim at every step
    rather than asserting it once."""
    length, on, count = {}, set(), 0
    out, deltas = [], []
    for p in positions:
        if p in on:
            out.append(count)
            deltas.append(0)
            continue
        left = length.get(p - 1, 0)
        right = length.get(p + 1, 0)
        if verify is not None:
            if p - 1 in on:
                assert left == verify(on, p - 1), (p, left, verify(on, p - 1))
            if p + 1 in on:
                assert right == verify(on, p + 1), (p, right, verify(on, p + 1))
        on.add(p)
        delta = 1 - (1 if left else 0) - (1 if right else 0)
        count += delta
        total = left + 1 + right
        length[p - left] = length[p + right] = total
        out.append(count)
        deltas.append(delta)
    return out, deltas, length


def true_stretch_length(on, q):
    """Brute force: the length of the contiguous stretch containing q.  Used only to check
    that the endpoint map is fresh where it is read."""
    lo = hi = q
    while lo - 1 in on:
        lo -= 1
    while hi + 1 in on:
        hi += 1
    return hi - lo + 1


def main():
    print(f"POSITIONS = {POSITIONS}")
    want, rescan_ops = count_by_rescan(POSITIONS)
    runs_counts, run_ops, runs = count_by_runs(POSITIONS)
    got, deltas, length = count_by_endpoints(POSITIONS, verify=true_stretch_length)
    print(f"  rescan    : {want}   ({rescan_ops} set reads)")
    print(f"  chapter's runs : {runs_counts}   ({run_ops} run comparisons), ending {runs}")
    print(f"  endpoints : {got}   (deltas {deltas})")
    assert got == want == runs_counts, (got, want, runs_counts)
    assert got == [1, 2, 1, 2, 2, 2, 1, 1], got
    assert deltas == [1, 1, -1, 1, 0, 0, -1, 0], deltas
    assert set(deltas) == {1, 0, -1}, "all three cases must appear or the claim is untested"
    assert runs == [(1, 7)], runs
    print(f"\n  position 6 joins the stretches at 5..5 and 7..7, so the count goes 2 -> 1; position")
    print(f"  4 joins 1..3 and 5..7, the same -1 again; the repeated 4 moves nothing.")

    # the counts are reachable with no interval structure, which is the point
    assert len(length) >= 2
    assert sum(1 for d in deltas if d == -1) == 2 and sum(1 for d in deltas if d == 0) == 3
    # the stale interior entries, which the correctness argument says are never read
    stale = {q: length[q] for q in sorted(length) if q not in (1, 7)}
    assert stale, "no interior entry went stale, so the freshness argument is untested here"
    assert length[1] == length[7] == 7, (length[1], length[7])
    print(f"  the length map ends as {dict(sorted(length.items()))}:")
    print(f"    the endpoints 1 and 7 both read 7, correctly, and the interior entries {sorted(stale)}")
    print(f"    are stale -- they are never consulted, because a position's neighbour can only")
    print(f"    be an ENDPOINT when that position is still off.  That was checked at every step.")

    # ---- the sparse case: nothing ever merges
    sparse_counts, _, _ = count_by_endpoints(SPARSE, verify=true_stretch_length)
    sparse_want, _ = count_by_rescan(SPARSE)
    assert sparse_counts == sparse_want == list(range(1, len(SPARSE) + 1)), sparse_counts
    assert count_by_runs(SPARSE)[0] == sparse_counts
    print(f"\n  SPARSE = {SPARSE} (the chapter's arrival times, G = 1):")
    print(f"    {sparse_counts} -- no two are within 1, so every position is its own island and")
    print(f"    the count only ever rises.  The same data merged four runs at the chapter's G = 47.")
    # the opposite outcome is forbidden: a DENSE sequence must end at one island
    dense = list(range(20))
    assert count_by_endpoints(dense)[0] == [1] * 20, "consecutive positions must never add an island"
    assert count_by_endpoints(list(range(0, 40, 2)))[0] == list(range(1, 21)), (
        "every-other positions must each add one")
    print(f"    0..19 in order -> all ones; 0,2,4,..,38 -> 1..20.  The two extremes bracket it.")

    # ---- order must not matter to the final count, only to the path
    rng = random.Random(20260303)
    target = list(range(12)) + [20, 21, 30]
    finals = set()
    paths = set()
    for _ in range(150):
        shuffled = target[:]
        rng.shuffle(shuffled)
        counts, _, _ = count_by_endpoints(shuffled)
        assert counts == count_by_rescan(shuffled)[0], shuffled
        finals.add(counts[-1])
        paths.add(tuple(counts))
    assert finals == {3}, finals
    assert len(paths) > 80, len(paths)
    print(f"\n  150 shuffles of the same {len(target)} positions: the final count is always {finals.pop()}")
    print(f"  (the three stretches 0..11, 20..21, 30), and {len(paths)} different count PATHS were")
    print(f"  seen getting there -- the order decides the intermediate reports, nothing else.")

    # ---- boundaries
    assert count_by_endpoints([])[0] == []
    assert count_by_endpoints([7])[0] == [1]
    assert count_by_endpoints([7, 7, 7])[0] == [1, 1, 1], "repeats must be idempotent"
    neg = [-3, -1, -2, 0]
    assert count_by_endpoints(neg)[0] == count_by_rescan(neg)[0] == [1, 2, 1, 1], neg
    assert count_by_endpoints([0, 2, 1])[0] == [1, 2, 1], "the middle position must merge both"
    big_gap = [0, 10**9]
    assert count_by_endpoints(big_gap)[0] == [1, 2], (
        "the coordinates are keys, not array indexes, so a huge gap costs nothing")
    print(f"\n  boundaries: repeats idempotent; negative positions {neg} -> {count_by_endpoints(neg)[0]};")
    print(f"  and 0 together with {big_gap[1]:,} costs two map entries, not {big_gap[1]:,} array slots.")

    # ---- the scale, and what each approach costs at it
    BIG = 20_000
    shuffled = list(range(BIG))
    rng.shuffle(shuffled)
    counts, deltas_big, length_big = count_by_endpoints(shuffled)
    assert counts[-1] == 1, counts[-1]
    assert set(deltas_big) <= {1, 0, -1}, set(deltas_big)
    # CORRECTED twice.  The first expectation was that a delta of 0 means a repeated
    # position; it does not -- 0 is the ordinary case of extending exactly ONE stretch (+1
    # for the new position, -1 for the neighbour it absorbs), and a repeat also gives 0,
    # which is why the two cannot be told apart from the count alone.  The second
    # expectation was that 0 would then dominate.  Measured, the three deltas each occur
    # close to n/3 times on a shuffle, because each of the two neighbours is already on with
    # probability about a half and the three outcomes are the three ways that can land.
    thirds = [deltas_big.count(d) / BIG for d in (1, 0, -1)]
    assert all(abs(f - 1 / 3) < 0.02 for f in thirds), thirds
    assert sum(deltas_big) == 1, sum(deltas_big)
    assert deltas_big.count(1) - deltas_big.count(-1) == 1, (
        "each -1 cancels a +1 exactly, so the two counts must differ by the one stretch left")
    assert len(length_big) <= 2 * BIG
    peak = max(c for c in counts)
    small = shuffled[:800]
    _, small_rescan_ops = count_by_rescan(small)
    # both references are measured on short prefixes on purpose: the rescan is quadratic in
    # the number of positions and the chapter's run structure re-sorts hundreds of runs on
    # every arrival, so either one at the full 20,000 takes longer than everything else in
    # this file put together.  That IS the finding.
    tiny = shuffled[:300]
    _, tiny_run_ops, _ = count_by_runs(tiny)
    assert count_by_endpoints(small)[0] == count_by_rescan(small)[0]
    print(f"\n  at {BIG:,} positions shuffled: the count peaks at {peak:,} islands and ends at")
    print(f"  {counts[-1]}, and the three deltas split almost exactly into thirds: "
          f"{deltas_big.count(1):,} isolated (+1),")
    print(f"  {deltas_big.count(0):,} extending one stretch (0) and {deltas_big.count(-1):,} joining two (-1) "
          f"-- {', '.join(f'{f:.3f}' for f in thirds)} of the stream.")
    print(f"  on just the first {len(small):,} the rescan made {small_rescan_ops:,} set reads, and on the")
    print(f"  first {len(tiny)} the chapter's run structure made {tiny_run_ops:,} run comparisons; the")
    print(f"  endpoint map does a fixed two lookups and two writes per position -- {4 * BIG:,}")
    print(f"  in all at {BIG:,}, and it never sorts anything.")
    assert small_rescan_ops == sum(range(1, len(small) + 1)), small_rescan_ops
    assert tiny_run_ops > 4 * len(tiny), (tiny_run_ops, 4 * len(tiny))

    # ---- many random sequences, against the rescan and the chapter's runs
    for _ in range(400):
        n = rng.randint(0, 25)
        xs = [rng.randint(-6, 12) for _ in range(n)]       # repeats and adjacency on purpose
        want_x, _ = count_by_rescan(xs)
        got_x, d_x, _ = count_by_endpoints(xs, verify=true_stretch_length)
        assert got_x == want_x, xs
        assert count_by_runs(xs)[0] == want_x, xs
        assert set(d_x) <= {1, 0, -1}, (xs, d_x)
        assert all(a + b == c for a, b, c in zip([0] + want_x, d_x, want_x)), (xs, d_x)
    print(f"\n  400 random sequences with repeats and adjacency: the endpoint map equals the")
    print(f"  rescan and the chapter's run structure every time, the delta is always in")
    print(f"  {{+1, 0, -1}}, and the deltas always telescope into the counts.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
