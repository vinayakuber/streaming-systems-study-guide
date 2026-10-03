#!/usr/bin/env python3
"""Variation 2 — the shortest spike (looks like load testing). Standalone and runnable.

  A load test records how many requests arrived in each second.  Find the SHORTEST run of
  consecutive seconds whose total reaches at least K -- the tightest burst in the run.
  Idle seconds are recorded as zero, so a run may contain seconds that contribute nothing.

The window is no longer a fixed size, so the sliding machinery does not apply directly and
`expire` disappears entirely: there is no W to expire against.  The move that unlocks it is
to change WHAT IS STORED.  Replace the counts by their running totals and the question
becomes, for each position, the nearest earlier total that is at least K below it -- which
is answerable from a list kept INCREASING, because a later total no larger than the back
makes the back useless: the later one is both smaller and closer, so it would always give a
shorter run.  Same eviction argument as the sliding maximum, opposite ordering, different
quantity.  "Both better AND newer" is the giveaway that it generalises.

Run it:  python3 programs/ch03_v2.py
"""

import random

# The chapter's nine values, now read as requests arriving in each of nine seconds.  All
# distinct, so a wrong run cannot be mistaken for a right one, and they rise and fall.
COUNTS = [5, 3, 7, 2, 6, 1, 9, 4, 8]

# The same nine seconds with three IDLE seconds spliced in, which is the case the statement
# bothers to mention.  A zero second repeats the running total, so the increasing list has
# to decide between two equal totals -- and the answer must prefer the later one.
IDLE = [5, 3, 7, 0, 0, 0, 2, 6, 1, 9, 4, 8]

# K values chosen from the data rather than invented: 15 is reached by [5,3,7] exactly, 21
# by [9,4,8] exactly, and 22 by nothing of length 3, so it is the boundary where the answer
# has to grow.  999 is unreachable and must be reported as such.
KS = (15, 21, 22, 999)

N = len(COUNTS)


def prefix(counts):
    """Running totals with a leading zero, so that the total of counts[i:j] is pre[j]-pre[i]
    for every pair including i = 0.  The leading zero is not decoration: without it the run
    that starts at second 0 has no earlier total to subtract and is silently unreachable."""
    pre = [0]
    for c in counts:
        pre.append(pre[-1] + c)
    return pre


def shortest_naive(counts, k):
    """The reference: every run, summed.  Returns (length, ops) -- ops counted so the
    quadratic cost is a measurement and not an adjective."""
    best, ops = None, 0
    pre = prefix(counts)
    for i in range(len(counts)):
        for j in range(i + 1, len(counts) + 1):
            ops += 1
            if pre[j] - pre[i] >= k and (best is None or j - i < best):
                best = j - i
    return best, ops


def shortest_two_pointer(counts, k):
    """The appealing answer, and it is CORRECT ONLY FOR NON-NEGATIVE COUNTS.

    Grow the right edge, then pull the left edge in while the total still reaches K.  It
    works here because every count is at least zero, which makes the running total
    non-decreasing, so shrinking the window can only lower it.  Feed it signed data -- net
    connections opened minus closed, a queue depth delta -- and it is wrong, because
    dropping a negative value RAISES the total and the left edge stops too early.  The
    assumption is in the data, not in the code, which is why it survives review."""
    best, total, left = None, 0, 0
    for right, c in enumerate(counts):
        total += c
        while left <= right and total - counts[left] >= k:
            total -= counts[left]
            left += 1
        if total >= k and (best is None or right - left + 1 < best):
            best = right - left + 1
    return best


def shortest_deque(counts, k, strict=False):
    """The answer: prefix totals plus a list kept increasing.

    Two loops at each position j, and they do different jobs.  The FRONT loop answers: while
    the front total is at least K below pre[j], that front is a usable start -- and it is
    discarded afterwards, because any later j is further away from it, so it can never give
    a shorter run again.  The BACK loop maintains the invariant: a total no larger than the
    back makes the back dead, since the newcomer is both smaller and closer.

    `strict` swaps the back loop's `>=` for `>`, which keeps equal totals instead of
    replacing them.  That changes the LIST LENGTH and not the answer, because the front loop
    pops every usable start and keeps the minimum -- the same way `<=` versus `<` in the
    sliding maximum buys space rather than correctness.  Returns (length, max_list_len).
    """
    pre = prefix(counts)
    dq, best, widest = [], None, 0
    for j, pj in enumerate(pre):
        while dq and pj - pre[dq[0]] >= k:
            i = dq.pop(0)
            if best is None or j - i < best:
                best = j - i
        if strict:
            while dq and pre[dq[-1]] > pj:
                dq.pop()
        else:
            while dq and pre[dq[-1]] >= pj:
                dq.pop()
        dq.append(j)
        widest = max(widest, len(dq))
    return best, widest


def main():
    pre = prefix(COUNTS)
    print("COUNTS =", "  ".join(f"{i}:{v}" for i, v in enumerate(COUNTS)))
    print(f"prefix  = {pre}\n")

    for k in KS:
        want, ops = shortest_naive(COUNTS, k)
        got, widest = shortest_deque(COUNTS, k)
        tp = shortest_two_pointer(COUNTS, k)
        assert got == want == tp, (k, got, want, tp)
        if want is None:
            print(f"  K = {k:>3} -> no run reaches it ({ops} pairs examined to be sure)")
        else:
            start = next(i for i in range(N - want + 1) if sum(COUNTS[i:i + want]) >= k)
            run = COUNTS[start:start + want]
            print(f"  K = {k:>3} -> {want} seconds, {run} totalling {sum(run)}   "
                  f"(list never longer than {widest}, naive examined {ops} pairs)")

    assert shortest_deque(COUNTS, 15)[0] == 3 and shortest_deque(COUNTS, 21)[0] == 3
    assert shortest_deque(COUNTS, 22)[0] == 4, shortest_deque(COUNTS, 22)
    assert shortest_deque(COUNTS, 999)[0] is None, "an unreachable K must report nothing"
    # the boundary between 21 and 22 is the whole point of choosing those two: 21 is
    # reachable in three seconds and 22 is not, and nothing between them changes
    assert max(sum(COUNTS[i:i + 3]) for i in range(N - 2)) == 21
    assert shortest_deque(COUNTS, 21)[0] < shortest_deque(COUNTS, 22)[0]
    print(f"\n  21 is reached by three seconds exactly and 22 by none, so the answer steps")
    print(f"  from 3 to 4 between them -- the step is in the data, not in the algorithm.")

    # ---- idle seconds
    print(f"\n  IDLE = {IDLE}  (three zero seconds spliced into the same stream)")
    ipre = prefix(IDLE)
    repeats = [i for i in range(1, len(ipre)) if ipre[i] == ipre[i - 1]]
    print(f"  prefix = {ipre}")
    print(f"  the running total repeats at positions {repeats}, which is what a zero second is")
    assert len(repeats) == 3, repeats
    for k in (15, 21, 22):
        want, _ = shortest_naive(IDLE, k)
        loose, w_loose = shortest_deque(IDLE, k)
        strict, w_strict = shortest_deque(IDLE, k, strict=True)
        assert loose == want == strict, (k, loose, want, strict)
        assert w_strict >= w_loose, (k, w_loose, w_strict)
        print(f"    K = {k:>3} -> {want} seconds;  list length {w_loose} with `>=`, "
              f"{w_strict} with `>`")
    # MEASURED, and it is the same finding the sliding maximum gives: the comparison buys
    # SPACE, not answers.  The first expectation was that `>` would over-report the length
    # by keeping the older of two equal totals; it does not, because the front loop pops
    # every usable start and keeps the minimum, so a stale duplicate is harmless.
    assert shortest_deque(IDLE, 15, strict=True)[1] > shortest_deque(IDLE, 15)[1], (
        "the strict comparison must at least cost space, or there is nothing to say")
    assert shortest_deque(IDLE, 15, strict=True)[0] == shortest_deque(IDLE, 15)[0]

    # ---- where the two-pointer actually breaks
    rng = random.Random(20260303)
    counter = None
    for _ in range(3000):
        n = rng.randint(2, 8)
        xs = [rng.randint(-6, 6) for _ in range(n)]
        k = rng.randint(1, 12)
        if shortest_two_pointer(xs, k) != shortest_naive(xs, k)[0]:
            counter = (xs, k, shortest_two_pointer(xs, k), shortest_naive(xs, k)[0])
            break
    assert counter is not None, "no signed counterexample found; the claim is unproven"
    xs, k, tp, want = counter
    assert shortest_deque(xs, k)[0] == want, (xs, k)
    print(f"\n  the two-pointer, on signed data (net connections opened minus closed):")
    print(f"    {xs} with K = {k}: two-pointer says {tp}, the truth is {want}")
    print(f"    the deque says {shortest_deque(xs, k)[0]} -- it never assumed the totals increase.")
    # and it must be RIGHT on every non-negative stream, or the distinction is not real
    for _ in range(800):
        n = rng.randint(1, 12)
        xs = [rng.randint(0, 9) for _ in range(n)]
        k = rng.randint(1, 30)
        assert shortest_two_pointer(xs, k) == shortest_naive(xs, k)[0], (xs, k)
    print(f"    on 800 non-negative streams it agrees with the truth every time, which is")
    print(f"    exactly what makes shipping it a decision about the data rather than the code.")

    # ---- boundaries
    # the list holds ONE entry on an empty stream, not zero: the leading zero of the
    # prefix array is pushed before any count is read, and it is the entry that makes
    # runs starting at second 0 reachable at all.
    assert shortest_deque([], 1) == (None, 1), shortest_deque([], 1)
    assert shortest_deque([0, 0, 0], 1)[0] is None, "an idle stream cannot reach 1"
    assert shortest_deque([0, 0, 0], 0)[0] == 1, "K = 0 is reached by one idle second"
    assert shortest_deque([7], 7)[0] == 1 and shortest_deque([7], 8)[0] is None
    assert shortest_deque(COUNTS, 0)[0] == 1, (
        "K = 0 must give 1, not 0: the empty run is excluded because the list is empty at j=0")
    assert shortest_deque(COUNTS, sum(COUNTS))[0] == N, "K = the whole total needs every second"
    print(f"\n  boundaries: empty stream -> None; all-idle -> None for K=1 and 1 for K=0;")
    print(f"  K = {sum(COUNTS)} (the entire test) -> {N} seconds, the whole stream.")

    # ---- the scale, and the cost of the naive answer at it
    BIG = 20_000
    big = [(i * 7919) % 50 for i in range(BIG)]        # deterministic, no seed needed
    bk = 50 * 40
    got, widest = shortest_deque(big, bk)
    assert got is not None and got >= 1
    assert shortest_two_pointer(big, bk) == got, (got, shortest_two_pointer(big, bk))
    small = big[:700]
    _, naive_ops = shortest_naive(small, bk)
    print(f"\n  at {BIG:,} seconds: shortest run reaching {bk} is {got} seconds, and the")
    print(f"  increasing list never held more than {widest:,} entries.")
    print(f"  the naive pair scan on just the first {len(small):,} of them examined "
          f"{naive_ops:,} pairs;")
    print(f"  at {BIG:,} that is about {BIG * (BIG + 1) // 2:,} -- which is why the store changes.")
    assert naive_ops == len(small) * (len(small) + 1) // 2, naive_ops
    assert widest <= BIG

    # ---- many inputs, against the pair scan
    for _ in range(400):
        n = rng.randint(1, 20)
        xs = [rng.randint(0, 9) for _ in range(n)]
        k = rng.randint(0, 40)
        want, _ = shortest_naive(xs, k)
        assert shortest_deque(xs, k)[0] == want, (xs, k)
        assert shortest_deque(xs, k, strict=True)[0] == want, (xs, k)
        signed = [rng.randint(-9, 9) for _ in range(n)]
        want_s, _ = shortest_naive(signed, k)
        assert shortest_deque(signed, k)[0] == want_s, (signed, k)
    print(f"\n  400 random streams, non-negative and signed, both comparisons: the increasing")
    print(f"  list equals the pair scan every time.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
