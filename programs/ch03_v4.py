#!/usr/bin/env python3
"""Variation 4 — the longest steady stretch (looks like manufacturing). Standalone and
runnable.

  A sensor on a line logs one measurement a second.  Find the LONGEST run of consecutive
  seconds in which the highest and lowest measurement differ by at most L -- the longest
  stretch the process held steady.

This is the two-deque version of the sliding spread with the window size turned into the
ANSWER rather than an input, and that inversion is the exercise.  There is no W to slide:
grow the right edge while the spread fits, and advance the left edge when it does not.  Both
deques must then expire from the front by POSITION against the actual left edge, not against
`i - W`, and the subtle part is that advancing the left edge may expire from one deque, both
or neither.  Get that wrong and a front goes stale, the spread reads too small, and the
answer is a longer steady stretch than really occurred -- which on a factory floor is a
quality claim nobody made.

Run it:  python3 programs/ch03_v4.py
"""

import random

# The chapter's nine values, read as nine seconds of sensor readings.  All distinct and they
# rise and fall, so the left edge genuinely has to advance and both deques genuinely expire.
READINGS = [5, 3, 7, 2, 6, 1, 9, 4, 8]

# L = 6, the chapter's own spread threshold.  It is the interesting value for these nine:
# the first six readings span exactly 7 - 1 = 6, so they are one steady stretch and the
# answer is 6, which is more than a first glance at the series suggests.
L = 6

N = len(READINGS)


def spread(xs):
    """The highest minus the lowest.  Written out because it is the quantity the whole
    program is about, and because the brute force needs it on arbitrary slices."""
    return max(xs) - min(xs)


def longest_naive(xs, limit):
    """The reference: every run, measured.  Returns (length, start, ops).

    Quadratic in the count of runs AND linear inside each one, so it is really cubic as
    written -- which is honest, because that is what "check every stretch" costs before any
    insight is applied."""
    best, bstart, ops = 0, 0, 0
    for i in range(len(xs)):
        for j in range(i, len(xs)):
            ops += 1
            if spread(xs[i:j + 1]) <= limit:
                if j - i + 1 > best:
                    best, bstart = j - i + 1, i
            else:
                break                       # widening further can only widen the spread
    return best, bstart, ops


def longest_steady(xs, limit):
    """The answer: two deques and a left edge that is pushed forward only as far as needed.

    `hi` is kept decreasing and `lo` increasing, so the spread of the current run is one
    subtraction of the two fronts.  The left edge advances in a `while`, not an `if`, because
    one arriving reading can invalidate several seconds at once; and each front is dropped
    only when its index has actually fallen behind the left edge, which is why the two `if`s
    are separate and tested against `left` rather than against any fixed offset.

    Returns (length, start, pushes, back_pops, front_pops, left_steps)."""
    hi, lo, left, best, bstart = [], [], 0, 0, 0
    pushes = back = front = steps = 0
    for i, v in enumerate(xs):
        while hi and xs[hi[-1]] <= v:
            hi.pop()
            back += 1
        hi.append(i)
        while lo and xs[lo[-1]] >= v:
            lo.pop()
            back += 1
        lo.append(i)
        pushes += 2
        while xs[hi[0]] - xs[lo[0]] > limit:
            left += 1
            steps += 1
            if hi[0] < left:                # the maximum may or may not be the one leaving
                hi.pop(0)
                front += 1
            if lo[0] < left:                # and the minimum independently may or may not
                lo.pop(0)
                front += 1
        if i - left + 1 > best:
            best, bstart = i - left + 1, left
    return best, bstart, pushes, back, front, steps


def longest_popping_both(xs, limit):
    """The bug the statement warns about: advance the left edge and drop BOTH fronts, on the
    assumption that the window moving means one entry left each deque.

    It drops extremes that are still inside the run, so a front goes stale, the spread reads
    too small, and the run is believed to be steady for longer than it was.  Returns the
    length only -- the point is that it is a plausible number."""
    hi, lo, left, best = [], [], 0, 0
    for i, v in enumerate(xs):
        while hi and xs[hi[-1]] <= v:
            hi.pop()
        hi.append(i)
        while lo and xs[lo[-1]] >= v:
            lo.pop()
        lo.append(i)
        while hi and lo and xs[hi[0]] - xs[lo[0]] > limit:
            left += 1
            hi.pop(0)
            lo.pop(0)
        best = max(best, i - left + 1)
    return best


def longest_fixed_offset(xs, limit):
    """The other wrong answer: look for the window size that is not in the question.

    It keeps a current W, expires against `i - W` exactly as the fixed-window program does,
    and grows W whenever the spread fits.  W can therefore never shrink, so once it is too
    large the expiry is wrong forever after -- the answer is a ratchet, not a measurement."""
    hi, lo, best = [], [], 1
    for i, v in enumerate(xs):
        while hi and xs[hi[-1]] <= v:
            hi.pop()
        hi.append(i)
        while lo and xs[lo[-1]] >= v:
            lo.pop()
        lo.append(i)
        if hi[0] <= i - best:
            hi.pop(0)
        if lo[0] <= i - best:
            lo.pop(0)
        if xs[hi[0]] - xs[lo[0]] <= limit:
            best += 1
    return best


def main():
    print("READINGS =", "  ".join(f"{i}:{v}" for i, v in enumerate(READINGS)), f"   L = {L}")
    want, wstart, ops = longest_naive(READINGS, L)
    got, start, pushes, back, front, steps = longest_steady(READINGS, L)
    run = READINGS[start:start + got]
    print(f"  naive  : {want} seconds from second {wstart}   ({ops} runs measured)")
    print(f"  deques : {got} seconds from second {start} -> {run}, spread "
          f"{spread(run)} <= {L}")
    print(f"           ({pushes} pushes, {back} back-pops, {front} front-pops, "
          f"{steps} left-edge steps)")
    assert (got, start) == (want, wstart), (got, start, want, wstart)
    assert got == 6 and start == 0, (got, start)
    assert run == [5, 3, 7, 2, 6, 1] and spread(run) == 6 == L, run
    # the answer is 6 and not 4, because the first six readings span exactly L.  One more
    # reading would break it, and that is the boundary the whole measurement sits on.
    assert spread(READINGS[0:7]) == 8 > L, spread(READINGS[0:7])
    print(f"  adding second 6 ({READINGS[6]}) takes the spread to {spread(READINGS[0:7])}, so the stretch")
    print(f"  ends exactly where it does -- the answer sits on the = in 'at most {L}'.")

    # ---- the left edge advances by more than one, and the two deques expire separately
    assert steps >= 1, "the left edge never moved, so the hard part was never exercised"
    assert front >= 1, "nothing ever expired from a front"
    assert front < 2 * steps, (
        "every left-edge step dropped from BOTH deques, so the separate `if`s are untested")
    print(f"\n  {steps} left-edge steps produced only {front} front-pops: most steps drop from one")
    print(f"  deque and not the other, which is precisely what a single shared `if` gets wrong.")

    # ---- the two wrong answers, run
    bad_both = longest_popping_both(READINGS, L)
    bad_fix = longest_fixed_offset(READINGS, L)
    print(f"\n  popping both fronts   : {bad_both} seconds (truth {want}) -- over by {bad_both - want}")
    print(f"  expiring at i - best  : {bad_fix} seconds (truth {want}) -- over by {bad_fix - want}")
    assert bad_both == 8 and bad_fix == 7, (bad_both, bad_fix)
    assert bad_both > want and bad_fix > want
    # and the direction is not an accident of this input: measured over many, both bugs
    # ONLY ever over-report, which is the dangerous direction for a quality claim.
    rng = random.Random(20260303)
    over_both = over_fix = under = 0
    for _ in range(3000):
        n = rng.randint(1, 12)
        xs = [rng.randint(0, 12) for _ in range(n)]
        lim = rng.randint(0, 6)
        t, _, _ = longest_naive(xs, lim)
        assert longest_steady(xs, lim)[0] == t, (xs, lim)
        b1, b2 = longest_popping_both(xs, lim), longest_fixed_offset(xs, lim)
        over_both += b1 > t
        over_fix += b2 > t
        under += (b1 < t) + (b2 < t)
    print(f"  over 3000 random series: popping-both over-reports {over_both} times, the fixed")
    print(f"  offset {over_fix} times, and NEITHER ever under-reports ({under} cases) -- the error")
    print(f"  always claims more stability than the line actually had.")
    assert under == 0, f"{under} under-reports, so the direction claim is wrong"
    assert over_both > 1000 and over_fix > 2000, (over_both, over_fix)

    # ---- the boundaries, where L decides everything
    print()
    for lim in (0, 1, 2, 4, 6, 8, 99):
        t, st, _ = longest_naive(READINGS, lim)
        g, gs, *_ = longest_steady(READINGS, lim)
        assert (g, gs) == (t, st), (lim, g, t)
        print(f"  L = {lim:>2} -> {g} seconds from second {gs}: {READINGS[gs:gs + g]}")
    assert longest_steady(READINGS, 0)[0] == 1, "with no tolerance and no repeats, every run is 1"
    assert longest_steady(READINGS, 99)[0] == N, "a tolerance above the whole spread takes everything"
    assert longest_steady(READINGS, spread(READINGS) - 1)[0] < N, (
        "one below the full spread must NOT take the whole series")
    assert longest_steady([], 5)[0] == 0 and longest_naive([], 5)[0] == 0
    assert longest_steady([4], 0)[0] == 1
    flat = [4, 4, 4, 4, 4]
    assert longest_steady(flat, 0)[0] == 5, "with repeats, L = 0 finds the flat run"
    print(f"  L = 0 on a flat run {flat} -> {longest_steady(flat, 0)[0]} seconds, so L = 0 is not")
    print(f"  trivially 1: it asks for the longest CONSTANT stretch, which is a real question.")

    # ---- the scale
    BIG = 100_000
    rng2 = random.Random(7)
    big = rng2.choices(range(100), k=BIG)
    bgot, bstart, bpush, bback, bfront, bsteps = longest_steady(big, 20)
    assert bpush == 2 * BIG, bpush
    assert bback + bfront <= bpush, (bback, bfront, bpush)
    assert bsteps <= BIG, bsteps
    assert spread(big[bstart:bstart + bgot]) <= 20
    assert bstart + bgot <= BIG
    # and it really is the longest: no run one longer anywhere fits
    assert all(spread(big[i:i + bgot + 1]) > 20 for i in range(0, BIG - bgot, 997)), (
        "a longer steady run was found by sampling, so the answer is not maximal")
    small = big[:1500]
    st, _, sops = longest_naive(small, 20)
    assert longest_steady(small, 20)[0] == st
    print(f"\n  at {BIG:,} seconds with L = 20: longest steady stretch {bgot} seconds from "
          f"second {bstart:,},")
    print(f"  found with {bpush:,} pushes, {bback + bfront:,} pops and {bsteps:,} left-edge steps --")
    print(f"  every index enters each deque once and leaves at most once, and the left edge")
    print(f"  only ever moves forward, so all three are bounded by the stream length.")
    print(f"  the naive scan over the first {len(small):,} seconds alone measured {sops:,} runs.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
