#!/usr/bin/env python3
"""The average of the last W values, on every arrival.

Values arrive one at a time, forever.  After every arrival, report the average of
the most recent W of them.  You may not re-read the window on each arrival -- so
recomputing the W values each time is out, and the answer has to be maintained.

Two follow-ups do the real work.  What do you report before W values have arrived?
And: is a running total exactly right?

Run it:  python3 programs/ch01.py
"""

import random

# Data.  Every constant comes from tools/gen_ch01_interview.js, which derives it
# from tools/stream_seed.js.

# VALUES: the seed events' values, in arrival order.  They are all DISTINCT on
# purpose -- if two were equal, a wrong window could not be attributed to the
# wrong index, so a bug could average the wrong three values and still look right.
VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8]

# W = 3: small enough that the whole trace fits on a page, large enough that
# there is a warm-up (W - 1 = 2 withheld answers) and a departure to subtract.
W = 3

# HUGE = 1e16: chosen because a float64 has ~15-16 significant decimal digits, so
# a total near 1e16 cannot also hold a unit value exactly.  The generator's
# finding, kept here deliberately: uniformly SCALING every value by HUGE produces
# NO drift, because the values then share an exponent and the arithmetic stays
# exact.  It is the MIXTURE of magnitudes that drifts, so exactly ONE value is
# replaced.  Both cases are asserted below so the claim cannot silently flip.
HUGE = 1e16

N = len(VALUES)
NWIN = N - W + 1
WARMUP = W - 1

# The reference implementation and the incremental one.

def recompute_at(xs, i, w=W):
    """The answer everyone gives first: add the w values of window i from scratch.

    Costs w reads per window -- so the price is set by the window size, not by
    the data.  Exact for any arithmetic, because no value is ever subtracted out.
    """
    total = 0
    for k in range(w):
        total += xs[i + k]
    return total / w

def all_windows(xs, w=W):
    """Run recompute_at over every window in turn, for comparison."""
    return [recompute_at(xs, i, w) for i in range(len(xs) - w + 1)]

def running(xs, w=W):
    """Keep the window's TOTAL instead of its contents.

    On each arrival: add what came in, and subtract the one value that left.
    Exactly one value leaves when one arrives, so the update is two operations
    whatever w is.  `report` withholds the first w-1 answers, because there is no
    average of w values before w values exist.

    Returns (answers, trace, adds, subs).  The subtraction reads xs[i - w], which
    is why the SPACE is O(w) even though the TIME is O(1): the departing value
    must still be reachable.
    """
    total = 0
    answers, trace = [], []
    adds = subs = 0
    for i in range(len(xs)):
        total += xs[i]                    # on_arrival: the addition
        adds += 1
        left = i - w
        removed = None
        if left >= 0:                     # on_arrival: the subtraction
            total -= xs[left]
            removed = xs[left]
            subs += 1
        full = i >= w - 1                 # report: the warm-up guard
        trace.append({"i": i, "added": xs[i], "removed": removed,
                      "sum": total, "avg": total / w if full else None,
                      "full": full})
        if full:
            answers.append(total / w)
    return answers, trace, adds, subs

def drift_at(xs, i, w=W):
    """How far the running total has wandered from the truth at window i.

    running(...)[i] - recompute_at(xs, i).  Zero for exact arithmetic; non-zero
    once the window holds a mixture of magnitudes, because adding a value and
    later subtracting it does not return to where you started.
    """
    return running(xs, w)[0][i] - recompute_at(xs, i, w)

# The three variations.

def the_rolling_maximum(xs, w=W):
    """Variation 1, surface: risk.  The same window, but the MAXIMUM.

    Non-obvious point: the trick does not transfer.  `running`'s subtraction is
    the line that cannot be written -- addition is invertible and max is not, so
    once the maximum leaves the window a single kept number cannot produce the
    next one.  What works instead keeps the indexes that could still become the
    maximum, in decreasing order: a monotonic deque.
    """
    dq, out = [], []
    for i, v in enumerate(xs):
        while dq and xs[dq[-1]] <= v:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - w:
            dq.pop(0)
        if i >= w - 1:
            out.append(xs[dq[0]])
    return out

def the_time_based_window(stamped, span):
    """Variation 2, surface: monitoring.  Average everything from the last `span`.

    Non-obvious point: "exactly one leaves when one arrives" becomes false -- zero
    or many expire -- so the COUNT must be maintained beside the total and the
    divisor changes every arrival.  Subtler: the answer changes with no arrival at
    all, as values age out while the stream is quiet, so a real implementation
    needs a timer-driven recompute as well as an input-driven one.

    `stamped` is [(t, v), ...] in time order.  Returns [(t, avg, count), ...].
    """
    from collections import deque
    win = deque()
    total = 0.0
    out = []
    for t, v in stamped:
        win.append((t, v))
        total += v
        while win and win[0][0] < t - span:   # zero, one or many expire
            total -= win.popleft()[1]
        out.append((t, total / len(win), len(win)))
    return out

def the_average_that_must_survive_a_restart(xs, crash_after, w=W):
    """Variation 3, surface: reliability.  The process restarts mid-stream.

    Non-obvious point: the total is one number and looks trivially
    checkpointable, and that is the trap -- restoring the total WITHOUT the last w
    values makes the next subtraction impossible, so the state to persist is the
    whole window plus the input position, which is larger than the thing being
    reported.

    Returns (answers_from_full_checkpoint, answers_from_total_only_checkpoint).
    The second is what a checkpoint of the accumulator alone produces: it has to
    guess the departing value, and guessing zero leaves the total too high.
    """
    total, window, out_good = 0, [], []
    for i in range(crash_after):            # before the crash
        total += xs[i]
        window.append(xs[i])
        if len(window) > w:
            total -= window.pop(0)
        if i >= w - 1:
            out_good.append(total / w)
    out_bad, bad_total = list(out_good), total   # the crash: only `total` was saved
    for i in range(crash_after, len(xs)):
        total += xs[i]                      # restored WITH the window: can subtract
        window.append(xs[i])
        if len(window) > w:
            total -= window.pop(0)
        out_good.append(total / w)
        bad_total += xs[i]                  # restored without it: nothing to subtract
        out_bad.append(bad_total / w)
    return out_good, out_bad


def main():
    print("VALUES =", "  ".join(f"{i}:{v}" for i, v in enumerate(VALUES)))
    print(f"W = {W} -> {NWIN} windows, {WARMUP} answers withheld\n")

    exact = all_windows(VALUES)
    answers, trace, adds, subs = running(VALUES)
    recompute_ops = NWIN * W

    for t in trace:
        rm = "-" if t["removed"] is None else f"-{t['removed']}"
        av = "NOT_YET" if t["avg"] is None else f"{t['avg']:.4f}"
        print(f"  arrival {t['i']}: +{t['added']} {rm:>3}  sum={t['sum']:>2}  report={av}")
    print()
    print(f"  recomputed : {[round(v, 4) for v in exact]}  ({recompute_ops} reads)")
    print(f"  running    : {[round(v, 4) for v in answers]}  ({adds} adds + {subs} subs = {adds + subs} ops)")

    assert answers == exact, "the running total disagrees with recomputation on small values"
    assert adds + subs < recompute_ops, f"{adds + subs} ops is not cheaper than {recompute_ops} reads"
    assert adds == N and subs == N - W, f"expected {N} adds and {N - W} subs, got {adds} and {subs}"
    assert sum(1 for t in trace if not t["full"]) == WARMUP == 2
    assert any(t["removed"] is not None for t in trace), "nothing ever leaves the window"
    assert trace[WARMUP - 1]["avg"] is None and trace[WARMUP]["avg"] == answers[0]

    # ---- the drift, measured.  Mixture of magnitudes vs uniform scaling.
    big = [HUGE] + VALUES[1:]
    uniform = [v * HUGE for v in VALUES]
    big_exact, big_run = all_windows(big), running(big)[0]
    uni_exact, uni_run = all_windows(uniform), running(uniform)[0]
    drift = [r - e for r, e in zip(big_run, big_exact)]
    uni_drift = [r - e for r, e in zip(uni_run, uni_exact)]
    drifted = sum(1 for d in drift if d != 0)
    uni_drifted = sum(1 for d in uni_drift if d != 0)
    worst = max(abs(d) for d in drift)
    first_bad = next(i for i, d in enumerate(drift) if d != 0)

    print(f"\n  one value replaced by {HUGE:.0e}: at window {first_bad} recomputation gives "
          f"{big_exact[first_bad]!r} and the running total {big_run[first_bad]!r},")
    print(f"    so drift_at({first_bad}) = {drift[first_bad]!r};  {drifted} of {NWIN} drift, worst {worst!r} (= 2/3)")
    print(f"  EVERY value multiplied by {HUGE:.0e}: {uni_drifted} of {NWIN} answers drift")

    assert drifted == 6, f"expected 6 of {NWIN} drifting, measured {drifted}"
    assert drifted != NWIN, "every answer drifts, so nothing shows the exact case"
    assert drift[0] == 0.0, "window 0 drifts, but it precedes the first subtraction"
    assert first_bad == 1, f"drift starts at window {first_bad}, expected 1"
    assert abs(worst - 2 / 3) < 1e-12, f"worst drift {worst!r} is not 2/3"
    assert drift_at(big, first_bad) == drift[first_bad]
    # the opposite outcome is forbidden too: uniform scaling must drift on NONE
    assert uni_drifted == 0, (
        f"uniform scaling drifted on {uni_drifted} answers; the claim 'it is the "
        f"mixture, not the magnitude' would have to be rewritten, not the assert")
    assert all(d == 0 for d in uni_drift)

    # ---- the three variations
    assert the_rolling_maximum(VALUES) == [7, 7, 7, 6, 9, 9, 9]
    assert the_rolling_maximum(VALUES) != answers, "max and mean must not coincide here"
    stamped = [(0, 10.0), (10, 20.0), (70, 30.0), (71, 40.0), (200, 50.0)]
    tb = the_time_based_window(stamped, 60)
    print(f"\n  time-based window (span 60): {[(t, round(a, 3), c) for t, a, c in tb]}")
    # MEASURED, and not what a first reading expects: the count is 1,2,2,2,1 -- at
    # t=71 one value arrives and one expires (so the count holds), and at t=200 TWO
    # expire at once and none would have expired on a timer tick at t=140 either.
    # So "exactly one leaves when one arrives" is false in both directions here.
    assert [c for _, _, c in tb] == [1, 2, 2, 2, 1], f"measured counts {[c for *_, c in tb]}"
    assert tb[2][1] == 25.0, "the divisor did not follow the count"
    assert tb[4][1] == 50.0, "two values expiring at once left the total too high"
    assert min(c for *_, c in tb) < max(c for *_, c in tb), "the count must rise AND fall"
    good, bad = the_average_that_must_survive_a_restart(VALUES, crash_after=5)
    print(f"  restart, window checkpointed : {[round(v, 4) for v in good]}")
    print(f"  restart, total only          : {[round(v, 4) for v in bad]}")
    assert good == exact, "a full checkpoint must continue exactly"
    assert bad != exact, "a total-only checkpoint must NOT come out right"
    assert bad[-1] > exact[-1], "the un-subtracted total has to read too high"

    # ---- brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    for _ in range(600):
        w = rng.randint(1, 6)
        n = rng.randint(w, 20)
        xs = [rng.randint(-50, 50) for _ in range(n)]
        assert running(xs, w)[0] == all_windows(xs, w), (xs, w)
        assert the_rolling_maximum(xs, w) == [max(xs[i:i + w]) for i in range(n - w + 1)], (xs, w)
    print("\n  600 random (values, W) pairs: running total == recomputation, and the")
    print("  rolling maximum == max of every window.")

    print("\nall assertions passed")

if __name__ == "__main__":
    main()
