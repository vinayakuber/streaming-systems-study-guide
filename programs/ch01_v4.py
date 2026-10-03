#!/usr/bin/env python3
"""Variation 4 — the average that must survive a restart (looks like reliability).
Standalone and runnable.

  The same rolling average, and the process is restarted mid-stream -- a deploy, an OOM
  kill, a node reboot.  The running average must CONTINUE, not start again.

The total is one number and looks trivially checkpointable, and that is the trap: restoring
the total without the last W values makes the next subtraction impossible, so the state
that must be saved is the whole window, which is W+1 numbers to report one.  The second
trap is that the checkpoint and the input position must be saved as ONE fact; skew them
either way and the restart is silently wrong, in opposite directions depending on which is
ahead.  Both failures below are produced by running the worker with a crash injected and
restarting it from what it actually wrote.

Run it:  python3 programs/ch01_v4.py
"""

import random

# The chapter's stream and window, unchanged: nine distinct values so a wrong answer can be
# attributed to the wrong value, and W = 3 so there is both a warm-up and a departure.
VALUES = [5, 3, 7, 2, 6, 1, 9, 4, 8]
W = 3

# HUGE = 1e16 is the chapter's constant, used here for the part of this problem that only
# a checkpoint has: a total carried across a restart carries its accumulated float error
# with it, where a total REBUILT from the persisted window starts clean.  The chapter's
# finding holds and is re-asserted: uniform scaling drifts on nothing, a mixture drifts.
HUGE = 1e16

N = len(VALUES)
NWIN = N - W + 1


def exact_answers(xs, w=W):
    """The reference: every window summed from scratch, so nothing is ever subtracted."""
    return [sum(xs[i:i + w]) / w for i in range(len(xs) - w + 1)]


def save_window(total, window, pos):
    """The checkpoint that works: the window's CONTENTS plus the input position, written as
    one record.  It is W+1 numbers and a position to report one number, and that ratio is
    the content of this problem -- the thing to persist is larger than the thing emitted."""
    return {"window": list(window), "pos": pos, "size": len(window) + 1}


def save_total(total, window, pos):
    """The checkpoint that looks sufficient: the accumulator and the position, two numbers.
    Small, cheap, and missing exactly the values the next subtraction needs."""
    return {"total": total, "pos": pos, "size": 2}


def run(xs, w=W, crash_at=None, policy="window", skew=0):
    """Run the worker, kill it before consuming xs[crash_at], restart it from what it
    persisted, and return the answers the consumer saw across both lives.

    policy:
      "window"  -- persist the window and the position together.  Exact.
      "total"   -- persist the accumulator and the position.  On restart the window is
                   gone, so the departing value is unknown and nothing can be subtracted;
                   the total only ever reads too high.
      "replay"  -- persist the accumulator, and on restart RE-READ the last w inputs from
                   the source to reconstitute the window.  Exact, and it is persisting the
                   window by another name: the cost moved from the checkpoint to the
                   recovery, and it needs a source that can be read backwards.
    skew shifts the persisted position relative to the persisted state, which is what a
    checkpoint written in two steps does when the crash lands between them.
    """
    total, window, answers = 0.0, [], []
    saver = save_window if policy == "window" else save_total
    ck = saver(total, window, 0)
    for i, v in enumerate(xs):
        if crash_at is not None and i == crash_at:
            break
        total += v
        window.append(v)
        if len(window) > w:
            total -= window.pop(0)
        if i >= w - 1:
            answers.append(total / w)
        ck = saver(total, window, i + 1)
        ck["pos"] = max(0, min(len(xs), ck["pos"] + skew))
    if crash_at is None:
        return answers, ck
    # ---- the restart: everything not in `ck` is gone
    if policy == "window":
        total, window = sum(ck["window"]), list(ck["window"])
    elif policy == "replay":
        start = max(0, ck["pos"] - w)
        window = list(xs[start:ck["pos"]])          # re-read from the source
        total = sum(window)
    else:
        total, window = ck["total"], []             # the window is simply not there
    for i in range(ck["pos"], len(xs)):
        total += xs[i]
        window.append(xs[i])
        if len(window) > w:
            total -= window.pop(0)
        elif policy == "total":
            pass                                   # nothing to subtract: the hole
        if i >= w - 1:
            answers.append(total / w)
    return answers, ck


def main():
    print("VALUES =", "  ".join(f"{i}:{v}" for i, v in enumerate(VALUES)), f"   W = {W}")
    truth, clean_ck = run(VALUES)
    assert truth == exact_answers(VALUES), (truth, exact_answers(VALUES))
    print(f"  no crash: {[round(a, 4) for a in truth]}\n")

    # ---- crash at every position, under each policy
    for policy in ("window", "replay", "total"):
        ends = []
        for c in range(1, N):
            got, ck = run(VALUES, crash_at=c, policy=policy)
            ends.append(got[-1] if got else None)
            if policy in ("window", "replay"):
                assert got == truth, (policy, c, got, truth)
            else:
                assert got != truth, (policy, c, "a total-only restart came out right")
                assert got[-1] > truth[-1], (c, got[-1], truth[-1])
                assert ck["total"] > 0, "these values are all positive, so the total must be"
        print(f"  crash at each of positions 1..{N - 1}, policy {policy:>7}: final answer "
              f"{sorted(set(round(e, 4) for e in ends))}")
    # CORRECTED.  The first expectation was that a total-only restart simply stops
    # subtracting, so the final answer would be the whole stream's sum over W.  Measured, it
    # is not: the window REFILLS after the restart and subtraction resumes once it holds
    # more than W values.  What is permanent is narrower and much sharper -- the restored
    # total entered the accumulator with no window entries behind it, so it is never taken
    # out, and the final answer is high by EXACTLY the checkpointed total over W.  That
    # holds once the window has refilled (W arrivals after the restart); during the refill
    # the error is a partial sum instead, which is wrong in a way that is harder to spot.
    for c in range(1, N):
        got, ck = run(VALUES, crash_at=c, policy="total")
        if N - c >= W:                 # enough input left for the window to refill
            assert abs((got[-1] - truth[-1]) - ck["total"] / W) < 1e-12, (c, got[-1], ck)
    _, ck4 = run(VALUES, crash_at=4, policy="total")
    got4 = run(VALUES, crash_at=4, policy="total")[0]
    print(f"    crash_at=4 persisted total {ck4['total']:.0f}; the truth ends at {truth[-1]:.4f} and the")
    print(f"    restart ends at {got4[-1]:.4f} -- high by exactly {ck4['total']:.0f}/{W} = "
          f"{ck4['total'] / W:.4f}, the restored total that")
    print(f"    nothing will ever subtract, because no window entry corresponds to it.")

    # ---- what the two checkpoints cost
    small = run(VALUES, policy="total")[1]
    big = run(VALUES, policy="window")[1]
    print(f"\n  checkpoint sizes: total-only {small['size']} numbers, window {big['size']} numbers,")
    print(f"  to report 1 number.  At the chapter's real W the ratio is what matters:")
    for w in (3, 1000, 100_000):
        print(f"    W = {w:>7,} -> {w + 1:>7,} numbers persisted per 1 reported")
    assert big["size"] == W + 1 and small["size"] == 2
    assert run(VALUES, w=5, policy="window")[1]["size"] == 6, "the checkpoint must grow with W"
    assert big["size"] > small["size"], "the working checkpoint must be the larger one"

    # ---- the position skew: two writes again, and the direction is NOT obvious
    ahead = run(VALUES, crash_at=4, policy="window", skew=+1)[0]
    behind = run(VALUES, crash_at=4, policy="window", skew=-1)[0]
    print(f"\n  checkpoint and position written separately, crash in between (crash_at=4):")
    print(f"    position ONE AHEAD of the state : {[round(a, 4) for a in ahead]}")
    print(f"    position ONE BEHIND the state   : {[round(a, 4) for a in behind]}")
    print(f"    the truth                       : {[round(a, 4) for a in truth]}")
    # CORRECTED.  The expectation taken from the problem statement was that an older state
    # against a newer position double-counts.  Measured, it is the other way round: a
    # position AHEAD of the state skips the input in between (xs[4] = 6 is never added, so
    # the sequence is SHORT by one answer), and a position BEHIND the state re-reads input
    # already folded in, which is the double count.  The lesson survives intact -- skew is
    # fatal either way -- but the two directions are not interchangeable, and only one of
    # them loses data.
    assert len(ahead) == len(truth) - 1, (len(ahead), len(truth))
    assert len(behind) == len(truth) + 1, (len(behind), len(truth))
    assert ahead != truth and behind != truth
    skipped = [a for a in ahead if a not in truth]
    print(f"    AHEAD loses one input and emits {len(ahead)} answers instead of {len(truth)};")
    print(f"    BEHIND re-reads one and emits {len(behind)} -- so the skew is detectable by")
    print(f"    COUNTING answers, which is the cheapest available alarm.")
    assert skipped, "the ahead-skew must produce at least one answer nobody should have seen"
    # and skew 0 must be exact, so the assertion above is about the skew and not the crash
    assert run(VALUES, crash_at=4, policy="window", skew=0)[0] == truth

    # ---- the warm-up has to survive the restart too
    early = run(VALUES, crash_at=1, policy="window")[0]
    assert early == truth, "a crash during the warm-up must not emit an early answer"
    assert len(run(VALUES, crash_at=1, policy="window")[1]["window"]) == 1, (
        "the checkpoint at position 1 holds one value, not W of them")
    assert run(VALUES, crash_at=N - 1, policy="window")[0] == truth
    print(f"\n  crash at position 1 (mid warm-up): {len(early)} answers, the first still withheld")
    print(f"  until {W} values exist -- the position is what says whether the warm-up is over.")

    # ---- the float cost of carrying a total across a restart
    mixture = [HUGE] + VALUES[1:]
    uniform = [v * HUGE for v in VALUES]
    for name, xs in (("mixture", mixture), ("uniform", uniform)):
        exact = exact_answers(xs)
        rebuilt = run(xs, crash_at=4, policy="window")[0]     # total rebuilt from window
        carried = run(xs, crash_at=4, policy="replay")[0]     # total re-derived from source
        live = run(xs)[0]                                     # never restarted
        drift_live = sum(1 for a, b in zip(live, exact) if a != b)
        drift_rebuilt = sum(1 for a, b in zip(rebuilt, exact) if a != b)
        print(f"\n  {name}: answers differing from a from-scratch sum --")
        print(f"    never restarted {drift_live} of {NWIN}, restarted and rebuilt from the window "
              f"{drift_rebuilt} of {NWIN}")
        assert rebuilt == carried, "rebuilding from the window and replaying must agree"
        if name == "mixture":
            assert drift_live == 6, drift_live
            # the restart REPAIRS some of the drift, which was not the expected direction:
            # summing the persisted window from scratch discards the error accumulated
            # before the crash, so a restart is an accidental re-grounding.
            assert drift_rebuilt < drift_live, (drift_rebuilt, drift_live)
        else:
            # the opposite outcome is forbidden: uniform scaling must drift on NOTHING,
            # restarted or not.  If this fires, the claim changes, not the assertion.
            assert drift_live == 0 and drift_rebuilt == 0, (drift_live, drift_rebuilt)
    print(f"  so a restart that rebuilds the total from the window is MORE accurate than the")
    print(f"  process that never crashed -- the checkpoint is also a re-grounding.")

    # ---- many streams, every crash point, every policy
    rng = random.Random(20260303)
    for _ in range(300):
        w = rng.randint(1, 5)
        n = rng.randint(w, 16)
        xs = [rng.randint(-40, 40) for _ in range(n)]
        want = exact_answers(xs, w)
        assert run(xs, w)[0] == want, (xs, w)
        for c in range(1, n):
            assert run(xs, w, crash_at=c, policy="window")[0] == want, (xs, w, c)
            assert run(xs, w, crash_at=c, policy="replay")[0] == want, (xs, w, c)
            got, ck = run(xs, w, crash_at=c, policy="total")
            if n - c >= w:
                # the exact error, which also covers the one case where the total-only
                # checkpoint is accidentally RIGHT: a persisted total of zero.  Asserting
                # `!= want` would have been wrong there, and negative values make it happen.
                assert abs((got[-1] - want[-1]) - ck["total"] / w) < 1e-9, (xs, w, c, ck)
                # and the FINAL answer is right exactly when the restored total was zero.
                # Not the whole sequence: while the window refills, the error is a partial
                # sum rather than the restored total, so the transient is wrong either way.
                assert (abs(got[-1] - want[-1]) < 1e-9) == (ck["total"] == 0), (xs, w, c, ck)
    print(f"\n  300 random streams x every crash point: the window checkpoint and the replay")
    print(f"  recover exactly, and the total-only checkpoint's final answer is high by exactly")
    print(f"  the restored total over W -- so it is right only when that total happens to be")
    print(f"  zero, which negative values do occasionally arrange.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
