#!/usr/bin/env python3
"""Variation 2 — the rolling maximum (looks like risk). Standalone and runnable.

  A risk screen shows the LARGEST exposure among the last W ticks and must update on
  every tick.  Same window, same "you may not re-read it" rule as the average: one
  arrival in, one departure out, an answer after each tick.

The trick does not transfer, and seeing exactly why is the whole exercise.  A total can
have a value subtracted out of it because addition is invertible; a maximum cannot --
once the maximum leaves the window, no single kept number can produce the next one.  So
an incremental window needs an INVERTIBLE COMBINE, which sums and counts have and
extremes do not, and the replacement is a structure (the values that could still become
the maximum) rather than an accumulator.  The impossibility is proved below by running
it, not argued: two windows agree on (kept maximum, departing value, arriving value) and
disagree on the answer, so no update function of those three arguments can exist.

Run it:  python3 programs/ch01_v2.py
"""

import random

# The chapter's own stream, reused unchanged: these are the nine seed values in arrival
# order, all DISTINCT so a wrong window cannot be mistaken for a right one, and they rise
# AND fall, which a monotone input would hide.  Here they are exposures in lakh.
VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8]

# W = 3, the chapter's window: large enough that a value departs, small enough to trace.
W = 3

# HUGE = 1e16 is the chapter's constant too, and for the same reason: a float64 carries
# ~15-16 significant decimal digits, so a total near 1e16 cannot also hold a unit value
# exactly.  It is used here for the SECOND half of the invertibility point -- addition is
# invertible in arithmetic but not in float64, and only for a MIXTURE of magnitudes.
HUGE = 1e16

N = len(VALUES)
NWIN = N - W + 1


def brute_max(xs, i, w=W):
    """Window i, read in full.  The reference: w reads per window, exact by construction
    because nothing is ever removed from a kept quantity."""
    best = xs[i]
    for k in range(1, w):
        if xs[i + k] > best:
            best = xs[i + k]
    return best


def all_maxima(xs, w=W):
    """brute_max over every window, for comparison."""
    return [brute_max(xs, i, w) for i in range(len(xs) - w + 1)]


def running_total(xs, w=W):
    """The average's machine, kept here as the CONTRAST: one accumulator, +arriving and
    -departing.  It works because subtraction undoes addition exactly."""
    total, out = 0, []
    for i, v in enumerate(xs):
        total += v
        if i - w >= 0:
            total -= xs[i - w]
        if i >= w - 1:
            out.append(total)
    return out


def running_max_single(xs, w=W):
    """The appealing wrong answer: keep ONE number and max the arrival into it.

    The departure has no line to write -- there is no un-max -- so the kept number is
    really the maximum of the whole PREFIX, which can only be too high, never too low.
    Returned so the comparison is run rather than described."""
    best, out = None, []
    for i, v in enumerate(xs):
        best = v if best is None else max(best, v)
        # the departing value xs[i - w] would have to be removed here, and cannot be
        if i >= w - 1:
            out.append(best)
    return out


def running_max_rescan(xs, w=W):
    """The second attempt, and it is CORRECT: keep one number, and when the departing
    value is the one being kept, rescan the window to find the next.

    The cost is what fails.  Returns (answers, rescans): on a decreasing stream the
    maximum departs every single tick, so this is the full re-read the question forbids,
    recovered under a different name."""
    out, rescans = [], 0
    best = None
    for i, v in enumerate(xs):
        if i < w - 1:
            best = v if best is None else max(best, v)
            continue
        if best is None or i == w - 1:
            best = brute_max(xs, 0, w)
            rescans += 1
        else:
            if xs[i - w] == best:          # the kept number just left the window
                best = brute_max(xs, i - w + 1, w)
                rescans += 1
            else:
                best = max(best, v)
        out.append(best)
    return out, rescans


def slide_max(xs, w=W):
    """The answer: keep the INDEXES that could still become the maximum, decreasing.

    An arriving value makes every smaller-or-equal entry behind it dead -- the newcomer
    is both larger and newer, so while any of them is in the window so is it, and it is
    the bigger.  Indexes rather than values, because only an index says whether an entry
    has left.  The front is the answer in one read; at most one entry can expire per tick
    because the window moves by one.  Returns (answers, pushes, pops, expiries)."""
    dq, out = [], []
    pushes = pops = expiries = 0
    for i, v in enumerate(xs):
        while dq and xs[dq[-1]] <= v:
            dq.pop()
            pops += 1
        dq.append(i)
        pushes += 1
        if dq[0] <= i - w:
            dq.pop(0)
            expiries += 1
        if i >= w - 1:
            out.append(xs[dq[0]])
    return out, pushes, pops, expiries


def find_max_collision(rng, w=W, tries=20000):
    """Search for the proof that no incremental maximum exists.

    Two windows with the SAME kept maximum, the SAME departing value and the SAME
    arriving value, whose next maxima differ.  Any update function f(kept, out, in) must
    return one number for one argument triple, so finding this pair rules out every such
    function at once -- including ones nobody has thought of yet.  The same search over
    SUMS can never succeed, which is what invertible means, and that is checked too."""
    seen = {}
    for _ in range(tries):
        win = [rng.randint(0, 9) for _ in range(w)]
        arriving = rng.randint(0, 9)
        key = (max(win), win[0], arriving)
        nxt = max(win[1:] + [arriving])
        if key in seen and seen[key][0] != nxt:
            return key, seen[key], (nxt, win)
        seen.setdefault(key, (nxt, win))
    return None


def find_sum_collision(rng, w=W, tries=20000):
    """The same search over sums.  It must come back empty: kept - out + in is a
    function, so two windows agreeing on the triple cannot disagree on the answer."""
    seen = {}
    for _ in range(tries):
        win = [rng.randint(0, 9) for _ in range(w)]
        arriving = rng.randint(0, 9)
        key = (sum(win), win[0], arriving)
        nxt = sum(win[1:]) + arriving
        if key in seen and seen[key][0] != nxt:
            return key, seen[key], (nxt, win)
        seen.setdefault(key, (nxt, win))
    return None


def main():
    print("VALUES =", "  ".join(f"{i}:{v}" for i, v in enumerate(VALUES)), f"   W = {W}")
    truth = all_maxima(VALUES)
    single = running_max_single(VALUES)
    rescan, rescans = running_max_rescan(VALUES)
    deque_out, pushes, pops, expiries = slide_max(VALUES)
    brute_reads = NWIN * W
    steps = pushes + pops + expiries

    print()
    print(f"  brute force  : {truth}   ({NWIN} windows x {W} = {brute_reads} reads)")
    print(f"  one number   : {single}   <- WRONG")
    print(f"  rescan on departure: {rescan}   ({rescans} rescans, correct)")
    print(f"  deque        : {deque_out}   ({pushes}p + {pops}e + {expiries}x = {steps} steps)")

    assert deque_out == truth, (deque_out, truth)
    assert truth == [7, 7, 7, 6, 9, 9, 9], truth
    assert (pushes, pops, expiries) == (9, 6, 1), (pushes, pops, expiries)
    assert steps < brute_reads, (steps, brute_reads)
    assert pushes == N, "every index must be pushed exactly once for the amortised claim"

    # the one-number answer must be CAUGHT, and caught in the predicted direction
    wrong = [i for i, (a, b) in enumerate(zip(single, truth)) if a != b]
    assert wrong == [3], f"the one-number maximum differs at windows {wrong}"
    assert all(a >= b for a, b in zip(single, truth)), "the prefix maximum can only read HIGH"
    assert single[3] == 7 and truth[3] == 6, (single[3], truth[3])
    # the correction: the stale number is not wrong FOREVER, it is wrong until a larger
    # value arrives.  Window 4 agrees again because 9 > 7, not because 7 expired.
    assert single[4] == truth[4] == 9 and max(VALUES[4:7]) == 9
    assert single[2] == truth[2], "window 2 still holds 7 legitimately"
    print(f"\n  the one number is high at window {wrong[0]} only: it reports {single[3]} for "
          f"[{', '.join(str(v) for v in VALUES[3:6])}], whose maximum is {truth[3]}.")
    print(f"  7 left the window at that tick and nothing could put it back.  It is right again")
    print(f"  at window 4 only because 9 arrives and exceeds the stale number -- the error ends")
    print(f"  when a bigger value happens along, not when the window moves on.")

    # the rescan answer is correct, and its cost is the thing the question forbids
    assert rescan == truth, (rescan, truth)
    falling = list(range(20, 0, -1))
    _, fall_rescans = running_max_rescan(falling)
    assert running_max_rescan(falling)[0] == all_maxima(falling)
    assert fall_rescans == len(falling) - W + 1, fall_rescans
    rising = list(range(1, 21))
    _, rise_rescans = running_max_rescan(rising)
    assert rise_rescans == 1, rise_rescans
    print(f"\n  rescan-on-departure is correct and costs {rescans} rescans here, {rise_rescans} on a")
    print(f"  rising stream, and {fall_rescans} of {len(falling) - W + 1} windows on a falling one -- the")
    print(f"  full re-read, back again under another name.")

    # ---- the impossibility, measured rather than argued
    rng = random.Random(20260303)
    hit = find_max_collision(rng)
    assert hit is not None, "no collision found; the impossibility argument is unproven"
    key, (n1, w1), (n2, w2) = hit
    kept, out_v, in_v = key
    assert n1 != n2
    assert max(w1) == max(w2) == kept and w1[0] == w2[0] == out_v
    assert max(w1[1:] + [in_v]) == n1 and max(w2[1:] + [in_v]) == n2
    print(f"\n  no f(kept, departing, arriving) can exist for the maximum:")
    print(f"    window {w1} keeps {kept}, {out_v} departs, {in_v} arrives -> {n1}")
    print(f"    window {w2} keeps {kept}, {out_v} departs, {in_v} arrives -> {n2}")
    print(f"    identical arguments, {n1} != {n2} -- so EVERY such function is ruled out at once")
    assert find_sum_collision(random.Random(20260303)) is None, (
        "a sum collision was found, which would mean addition is not invertible")
    print(f"  the same search over SUMS comes back empty, which is what invertible means.")
    assert running_total(VALUES) == [sum(VALUES[i:i + W]) for i in range(NWIN)]

    # ---- and the second half: addition is invertible in arithmetic, not in float64
    mixture = [HUGE] + VALUES[1:]              # ONE value replaced: magnitudes mixed
    uniform = [v * HUGE for v in VALUES]       # every value scaled: magnitudes shared
    mix_drift = [r - e for r, e in zip(running_total(mixture),
                                       [sum(mixture[i:i + W]) for i in range(NWIN)])]
    uni_drift = [r - e for r, e in zip(running_total(uniform),
                                       [sum(uniform[i:i + W]) for i in range(NWIN)])]
    mix_bad = sum(1 for d in mix_drift if d != 0)
    uni_bad = sum(1 for d in uni_drift if d != 0)
    print(f"\n  one value replaced by {HUGE:.0e}: {mix_bad} of {NWIN} running totals drift, worst "
          f"{max(abs(d) for d in mix_drift)!r}")
    print(f"  EVERY value scaled by {HUGE:.0e}:   {uni_bad} of {NWIN} drift -- scaling is not the cause")
    assert mix_bad == 6, f"measured {mix_bad} drifting totals"
    assert mix_drift[0] == 0.0, "window 0 precedes the first subtraction, so it cannot drift"
    # the opposite outcome is forbidden: uniform scaling must drift on NOTHING.  If this
    # ever fires, the claim 'it is the mixture, not the magnitude' is what changes.
    assert uni_bad == 0, f"uniform scaling drifted on {uni_bad} answers"
    assert all(d == 0 for d in uni_drift)
    # the deque never subtracts, so it is exact in BOTH cases -- the structure buys that
    assert slide_max(mixture)[0] == all_maxima(mixture)
    assert slide_max(uniform)[0] == all_maxima(uniform)
    print(f"  the deque is exact on both, because it never removes anything from a number.")

    # ---- boundaries
    assert slide_max(VALUES, 1)[0] == VALUES, "W = 1 must return the stream itself"
    assert slide_max(VALUES, N)[0] == [max(VALUES)], "W = N must give one answer"
    flat = [4] * 6
    assert slide_max(flat)[0] == [4] * (6 - W + 1), "equal values must not break the eviction"
    # `<=` not `<` in the eviction: with `<` the deque keeps duplicates of the maximum and
    # still answers correctly, but it grows -- so the cost claim, not the answer, is what
    # that comparison protects.  Measured here on a flat stream.
    dq_len = []
    dq = []
    for i, v in enumerate(flat):
        while dq and flat[dq[-1]] < v:       # deliberately the weaker comparison
            dq.pop()
        dq.append(i)
        if dq[0] <= i - W:
            dq.pop(0)
        dq_len.append(len(dq))
    assert max(dq_len) == W, f"with `<` the deque reached {max(dq_len)} on a flat stream"
    print(f"\n  W = 1 -> the stream itself; W = {N} -> one answer; a flat stream keeps the deque")
    print(f"  at 1 entry with `<=` and at {max(dq_len)} with `<` -- the comparison buys space, not answers.")

    # ---- many inputs, against the brute force
    rng = random.Random(20260303)
    caught = 0
    for _ in range(800):
        w = rng.randint(1, 6)
        n = rng.randint(w, 22)
        xs = [rng.randint(-30, 30) for _ in range(n)]
        want = all_maxima(xs, w)
        assert slide_max(xs, w)[0] == want, (xs, w)
        assert running_max_rescan(xs, w)[0] == want, (xs, w)
        if running_max_single(xs, w) != want:
            caught += 1
    print(f"\n  800 random (values, W) pairs: the deque and the rescan both equal the brute")
    print(f"  force on all of them; the one-number version is wrong on {caught} of 800.")
    assert caught > 400, f"the one-number version was only wrong {caught} times"

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
