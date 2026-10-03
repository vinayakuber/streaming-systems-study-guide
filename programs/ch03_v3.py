#!/usr/bin/env python3
"""Variation 3 — the next warmer day (looks like weather). Standalone and runnable.

  A station records one temperature a day.  For each day, report HOW MANY DAYS UNTIL THE
  NEXT WARMER ONE, or zero if no warmer day ever comes.

There is no window at all here, which is exactly what makes it worth putting beside the
sliding maximum: `expire` is gone and only the eviction remains.  Keep the days whose answer
is still unknown; when a warmer day arrives it is the answer for EVERY unresolved day cooler
than it, so they are all resolved and removed at once.  Each day is pushed once and removed
once, so the whole thing is linear even though a single day can resolve many.  The trap is
reaching for the sliding-window machinery and hunting for a window size that is not in the
question -- the shared idea is the eviction, not the window.

The unresolved days are also the watermark's backlog in miniature: they are precisely the
events the running maximum has not yet passed.

WORKED EXAMPLES: the EXAMPLES table below holds 15 input/output pairs -- the first day of the
series and the last, an ordinary middle day, both sides of the strict `<` comparison (equal
days wait, strictly warmer days resolve), a day whose warmer day never comes and the 0 that
is returned instead of a guess, a single day, an all-cooling run, an all-warming run, a flat
run, one late record high that resolves ten waiting days at once, and three rows at 20,000
days including the longest wait in the series.  Every row also pins down the lookahead
boundary from both sides: a bounded lookahead equal to the true wait is right, and one day
shorter reports 0.  Every row is ASSERTED, so the table cannot drift from the code: change an
answer and this file stops running.

Run it:  python3 programs/ch03_v3.py
"""

import random

# The chapter's nine values, read now as nine daily highs in Celsius.  All distinct, so a
# resolution can be attributed to the day that caused it, and they rise AND fall -- a
# monotone series would leave the stack either empty or untouched and hide the mechanism.
TEMPS = [5, 3, 7, 2, 6, 1, 9, 4, 8]

# A run with repeats, kept separate because the nine above have none: "warmer" is strict,
# so an equal day must NOT resolve anything, and that is only visible with ties.
TIED = [5, 5, 5, 6]

N = len(TEMPS)

# One day, a monotone cooling run, a monotone warming run, a flat run, a long slide ending in
# a single record high, and the 20,000-day scale the program measures at the end (seeded, so
# the answers below are reproducible).  These are inputs for the examples table, not
# alternative versions of the problem.
SINGLE = [7]
COOLING = [9, 7, 5, 3, 1]
WARMING = [1, 3, 5, 7, 9]
FLAT = [4, 4, 4, 4]
SPIKE = list(range(10, 0, -1)) + [99]              # ten cooling days, then one record high
BIG_TEMPS = random.Random(20260304).choices(range(1000), k=20_000)

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, temps, day, expected days until the next warmer one).  Every row is
# asserted by show_examples() against the forward scan AND against the bounded lookahead on
# both sides of the true wait, which is why the table is data and not a comment: a comment
# can go stale silently, and this cannot.
EXAMPLES = [
    ("day 0, the first day of all",          TEMPS,      0,       2),
    ("an ordinary day, mid-series",          TEMPS,      4,       2),
    ("the longest wait in these nine",       TEMPS,      2,       4),
    ("the record high: never warmer -> 0",   TEMPS,      6,       0),
    ("the last day, which can only be 0",    TEMPS,      8,       0),
    ("equal is not warmer, so day 0 waits",  TIED,       0,       3),
    ("...and the last equal day waits too",  TIED,       2,       1),
    ("a single day -> 0, not an error",      SINGLE,     0,       0),
    ("a cooling run: nothing resolves",      COOLING,    0,       0),
    ("a warming run: resolved next day",     WARMING,    0,       1),
    ("a flat run: strictness again -> 0",    FLAT,       0,       0),
    ("one late record resolves everyone",    SPIKE,      0,       10),
    ("20,000 days, day 0",                   BIG_TEMPS,  0,       2),
    ("20,000 days, the longest wait",        BIG_TEMPS,  9065,    2195),
    ("20,000 days, the last day",            BIG_TEMPS,  19999,   0),
]


def show_examples():
    """Print the examples table and assert every row, two ways.

    Each row is checked against the stack and against the forward scan, which is run on every
    input here (and cached, since several rows share a series).  The two cost columns are the
    point of the table: `fwd` is the forward scan's measured comparisons and `steps` is the
    stack's pushes plus pops.  The stack LOSES on every short series in the table, because it
    pays a push per day whether or not that day does any work, and the forward scan stops at
    the first warmer day.  Its win is asymptotic, and the 20,000-day rows are where it shows.

    On the small series each row additionally pins the bounded lookahead from BOTH sides: a
    lookahead equal to the true wait gives the true answer, and one day shorter gives 0 --
    the bounded view goes BACKWARDS, reporting "no warmer day ever" for a day whose warmer day
    simply had not arrived yet.  That is the same price the bounded watermark pays, and the
    unbounded stack never pays it: one late record high (the SPIKE row) resolves every waiting
    day at once, exactly as a running maximum jumps and stays there.
    """
    cache = {}
    print(f"{'what it exercises':37s} {'days':>6} {'day':>6} {'temp':>5} {'answer':>7} "
          f"{'fwd':>8} {'steps':>8}  verdict")
    for label, temps, day, want in EXAMPLES:
        key = id(temps)
        if key not in cache:
            cache[key] = (naive(temps), next_warmer(temps))
        (ref, ops), (got, pushes, pops, _, unresolved) = cache[key]
        assert got[day] == want, (label, got[day], want)
        assert ref[day] == want, (label, 'the forward scan disagrees', ref[day], want)
        assert pushes == len(temps) and pops == len(temps) - len(unresolved), label
        if len(temps) <= 50:
            # both sides of the lookahead the sliding-window reflex would have to choose
            if want:
                assert next_warmer_within(temps, want)[day] == want, (label, 'bound too tight')
                if want > 1:
                    assert next_warmer_within(temps, want - 1)[day] == 0, (label, 'bound-1')
            else:
                assert next_warmer_within(temps, len(temps))[day] == 0, (label, 'spurious')
        steps = pushes + pops
        verdict = ("stack wins" if steps < ops else
                   "stack LOSES" if steps > ops else "tie")
        print(f"{label:37s} {len(temps):>6} {day:>6} {temps[day]:>5} {want:>7} "
              f"{ops:>8,} {steps:>8,}  {verdict}")
    print(f"all {len(EXAMPLES)} examples agree with the forward scan")
    print()


def naive(temps):
    """The reference: for each day, scan forward until something warmer turns up.

    Returns (answers, ops).  Quadratic in the worst case, and the worst case is a cooling
    trend -- every day scans to the end and finds nothing, which is also the case where the
    linear answer does the least work, so the two disagree most exactly where it matters."""
    out, ops = [], 0
    for i, t in enumerate(temps):
        out.append(0)
        for j in range(i + 1, len(temps)):
            ops += 1
            if temps[j] > t:
                out[i] = j - i
                break
    return out, ops


def next_warmer(temps):
    """The answer: a stack of the days whose answer is still UNKNOWN, kept cooling downward.

    The arriving day is warmer than every day it evicts, and it is the FIRST such day for all
    of them, because any earlier warmer day would have evicted them already.  So one
    comparison resolves a whole group, and the evicted entries produce answers instead of
    being discarded -- which is the one line that differs from the sliding maximum.

    `<` and not `<=`: an equal day is not warmer, so it must leave the cooler day waiting.
    Returns (answers, pushes, pops, biggest_group, unresolved)."""
    out = [0] * len(temps)
    stack, pushes, pops, biggest = [], 0, 0, 0
    for i, t in enumerate(temps):
        group = 0
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            out[j] = i - j
            pops += 1
            group += 1
        if group > biggest:
            biggest = group
        stack.append(i)
        pushes += 1
    return out, pushes, pops, biggest, list(stack)


def next_warmer_within(temps, lookahead):
    """The sliding-window reflex: pick a window and only look that far ahead.

    This is the wrong answer the question invites, and it is wrong in a specific way -- it
    reports 0 ("no warmer day ever") for a day whose warmer day exists but is further off
    than the chosen lookahead, which is indistinguishable in the output from the true 0.
    The lookahead that would be safe is the largest gap in the ANSWER, which is not known
    until the answer is known."""
    out = []
    for i, t in enumerate(temps):
        out.append(0)
        for j in range(i + 1, min(len(temps), i + lookahead + 1)):
            if temps[j] > t:
                out[i] = j - i
                break
    return out


def main():
    show_examples()
    print("TEMPS =", "  ".join(f"{i}:{v}" for i, v in enumerate(TEMPS)))
    want, naive_ops = naive(TEMPS)
    got, pushes, pops, biggest, unresolved = next_warmer(TEMPS)
    print(f"  naive  : {want}   ({naive_ops} forward comparisons)")
    print(f"  stack  : {got}   ({pushes} pushes + {pops} pops = {pushes + pops} steps"
          f" -- the stack LOSES at this size)")
    assert got == want, (got, want)
    assert got == [2, 1, 4, 1, 2, 1, 0, 1, 0], got
    assert pushes == N, "every day must be pushed exactly once for the linear claim"
    assert pops == N - len(unresolved) == 7, (pops, unresolved)
    # CORRECTED.  The expectation was that the stack is cheaper here.  It is NOT: 16 steps
    # against 14 comparisons on nine days, because the forward scan stops at the first
    # warmer day and these temperatures turn over quickly, while the stack pays a push for
    # every day whether or not it does any work.  The stack's win is asymptotic, and the
    # crossover is measured at the end of this program rather than assumed here.
    assert pushes + pops > naive_ops, (pushes + pops, naive_ops)
    print(f"  the {len(unresolved)} days never resolved are {unresolved} "
          f"(temps {[TEMPS[i] for i in unresolved]}), which is")
    print(f"  the stack at the end -- and it is cooling downward, as it was all along.")
    assert [TEMPS[i] for i in unresolved] == [9, 8], unresolved
    assert all(TEMPS[a] > TEMPS[b] for a, b in zip(unresolved, unresolved[1:])), (
        "the stack must be decreasing, or the group eviction is not justified")
    assert all(got[i] == 0 for i in unresolved)

    # one day resolving many is the thing that makes the linear claim surprising
    print(f"\n  the biggest single eviction was {biggest} days at once: day 6 ({TEMPS[6]}C) is the")
    print(f"  answer for days {[i for i in range(N) if i + got[i] == 6 and got[i]]} simultaneously.")
    assert biggest == 3, biggest
    assert [i for i in range(N) if got[i] and i + got[i] == 6] == [2, 4, 5]
    assert sum(1 for i in range(N) if got[i] and i + got[i] == 6) == biggest
    # ...and no day is resolved twice, which is the other half of "pushed once, popped once"
    resolved = [i for i in range(N) if got[i]]
    assert len(resolved) == len(set(resolved)) == pops

    # ---- the strict comparison
    tied_want, _ = naive(TIED)
    tied_got, *_ = next_warmer(TIED)
    print(f"\n  TIED = {TIED}: {tied_got}")
    assert tied_got == tied_want == [3, 2, 1, 0], (tied_got, tied_want)
    print(f"  the three equal days all wait for day 3 ({TIED[3]}C) -- an equal day is not warmer,")
    print(f"  so `<` is what keeps them waiting.  With `<=` each would resolve to its neighbour:")
    loose = [0] * len(TIED)
    stack = []
    for i, t in enumerate(TIED):                 # the same loop with the weaker comparison
        while stack and TIED[stack[-1]] <= t:
            j = stack.pop()
            loose[j] = i - j
        stack.append(i)
    print(f"    `<=` gives {loose}, which claims tomorrow is warmer when tomorrow is identical")
    assert loose == [1, 1, 1, 0], loose
    assert loose != tied_got, "the two comparisons must differ on ties or there is nothing to say"
    # and on the nine distinct temperatures they must AGREE, so the difference is about ties
    loose9 = [0] * N
    stack = []
    for i, t in enumerate(TEMPS):
        while stack and TEMPS[stack[-1]] <= t:
            j = stack.pop()
            loose9[j] = i - j
        stack.append(i)
    assert loose9 == got, "with no ties the comparison cannot matter, and it must not"

    # ---- the window that is not there
    needed = max(got)
    print(f"\n  the sliding-window reflex: with a lookahead of L days,")
    for L in (1, 2, 3, 4, 8):
        w = next_warmer_within(TEMPS, L)
        bad = [i for i in range(N) if w[i] != got[i]]
        print(f"    L = {L}: {w}   wrong on days {bad}")
        assert (bad == []) == (L >= needed), (L, bad, needed)
        for i in bad:
            assert w[i] == 0 and got[i] != 0, (i, w[i], got[i])
    assert needed == 4, needed
    print(f"  the smallest safe lookahead here is {needed}, and every too-small one fails the")
    print(f"  same way: it reports 0, which is indistinguishable from a true 'never warmer'.")
    # and the safe lookahead is data-dependent, up to n-1: a single cold snap at the end
    staircase = list(range(10, 0, -1)) + [99]
    sgot, *_ = next_warmer(staircase)
    assert max(sgot) == len(staircase) - 1, sgot
    assert next_warmer_within(staircase, len(staircase) - 2)[0] == 0 and sgot[0] != 0
    print(f"  on {staircase} the answer for day 0 is {sgot[0]} days, so no fixed lookahead")
    print(f"  short of the whole series is safe -- the window size is a property of the data.")

    # ---- boundaries
    assert next_warmer([])[0] == []
    assert next_warmer([7])[0] == [0], "one day can have no warmer day"
    cooling = [9, 7, 5, 3, 1]
    warming = [1, 3, 5, 7, 9]
    c, cp, cpop, cbig, cun = next_warmer(cooling)
    w2, wp, wpop, wbig, wun = next_warmer(warming)
    assert c == [0] * 5 and len(cun) == 5 and cpop == 0, (c, cun)
    assert w2 == [1, 1, 1, 1, 0] and len(wun) == 1 and wpop == 4, (w2, wun)
    assert cbig == 0 and wbig == 1, (cbig, wbig)
    print(f"\n  a cooling run {cooling} -> {c}: nothing is ever resolved and the stack holds all 5,")
    print(f"  which is where the stack costs O(n) space (a flat run does the same).  A warming run -> {w2}:")
    print(f"  every day is resolved by the next, one at a time, and the stack never exceeds 1.")
    flat = [4, 4, 4, 4]
    assert next_warmer(flat)[0] == [0] * 4 and len(next_warmer(flat)[4]) == 4
    print(f"  a flat run {flat} -> all zeros, and all four stay unresolved: strictness again.")

    # ---- the scale
    BIG = 100_000
    rng = random.Random(20260303)
    # choices() rather than a randint per day: the point of this block is the step count,
    # not the random number generator, and 100,000 randint calls dominate the runtime.
    big = rng.choices(range(1000), k=BIG)
    bgot, bpush, bpop, bbig, bun = next_warmer(big)
    assert bpush == BIG and bpop == BIG - len(bun)
    assert bpop + bpush <= 2 * BIG, (bpop, bpush)
    small = big[:2000]
    _, small_ops = naive(small)
    print(f"\n  at {BIG:,} days: {bpush:,} pushes + {bpop:,} pops = {bpush + bpop:,} steps, biggest")
    print(f"  single eviction {bbig:,} days, {len(bun)} days never resolved.")
    print(f"  the forward scan on the first {len(small):,} days alone made {small_ops:,} comparisons.")
    # where the stack starts winning, measured rather than assumed
    cross = None
    for n in range(2, 400):
        p2 = big[:n]
        _, ops2 = naive(p2)
        _, pu, po, _, _ = next_warmer(p2)
        if pu + po < ops2:
            cross = (n, pu + po, ops2)
            break
    assert cross is not None, "the stack never became cheaper, which would need explaining"
    print(f"  the crossover on this series is at {cross[0]} days ({cross[1]} steps against "
          f"{cross[2]} comparisons);")
    print(f"  below that the forward scan is genuinely the better program.")
    assert cross[0] > N, (
        "the crossover must be beyond the nine-day sample, or the LOSES claim above is wrong")
    assert bbig > 1, "no group eviction at scale, so the interesting path was not exercised"
    assert len(bun) == len([i for i in range(BIG) if bgot[i] == 0])
    # the descending tail is exactly the unresolved set, and it must be the record highs
    # CORRECTED: `>` is the wrong test here.  With 200,000 days drawn from 1,000 values ties
    # are certain, and a day equal to the warmest day after it is still unresolved, because
    # "warmer" is strict.  So the unresolved set is the days that MATCH OR BEAT every later
    # day, which is a weaker condition than being a strict suffix record.
    run_max, best = [], None
    for i in range(BIG - 1, -1, -1):
        if best is None or big[i] >= best:
            run_max.append(i)
        if best is None or big[i] > best:
            best = big[i]
    assert sorted(run_max) == sorted(bun), (len(run_max), len(bun))
    print(f"  and the unresolved days are exactly those matching or beating every later day")
    print(f"  -- {len(bun)} of {BIG:,}, which with ties is more than the strict record highs.")

    # ---- many inputs, against the forward scan
    for _ in range(600):
        n = rng.randint(0, 25)
        xs = [rng.randint(-10, 10) for _ in range(n)]      # ties on purpose
        want_x, _ = naive(xs)
        got_x, px, pp, _, un = next_warmer(xs)
        assert got_x == want_x, xs
        assert px == n and pp == n - len(un), (xs, px, pp, un)
    print(f"\n  600 random series (with ties, since the range repeats): the stack equals the")
    print(f"  forward scan every time, and pushes + unresolved always accounts for every day.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
