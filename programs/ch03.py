#!/usr/bin/env python3
"""The largest value in a window that slides -- and the watermark that needs it.

A risk screen shows the highest value among the last W ticks and must update on
every tick.  Millions of ticks a day, W up to 10^5, and you may not re-read the
window.  Then: also warn when the last W ticks SPAN more than L, highest minus
lowest.

Why this sits in the watermark chapter: the usual heuristic watermark is
`max event time seen so far - lag`, an UNBOUNDED running maximum.  One corrupt
future timestamp raises it permanently and every later event is declared late,
forever, with no recovery.  Bounding the maximum to the last W events fixes that
-- and a bounded sliding maximum is exactly the problem above.  Both watermarks
are implemented here and the corrupt event is fed to both.

Run it:  python3 programs/ch03.py
"""

import random

# Data, all from tools/gen_ch03_interview.js over tools/stream_seed.js.
# TICKS: the seed events' values in arrival order.  The seed's event TIMES were the
# obvious choice and are nearly increasing, which would make the deque hold one entry
# almost always and nothing ever expire from the front -- hiding half the program.
# These rise AND fall, which the assertions require, and are all distinct, so an
# eviction can be attributed to the newer value.
TICKS = [5, 3, 7, 2, 6, 1, 9, 4, 8]
W = 3        # window size: small enough to trace, big enough to expire a front
L = 6        # the spread to warn about: chosen so SOME windows exceed it and some do not

# The watermark half.  ETS is the seed's event times in PROCESSING order (the
# seed's pt order), which is deliberately not sorted by event time.  LAG = 60 is
# the seed's own lag.  CORRUPT is one impossible future timestamp; TAIL continues
# the stream afterwards so that "the unbounded watermark never recovers" is
# demonstrated rather than asserted about a single event.
ETS = [1, 3, 90, 130, 245, 260, 220, 50, 540]
LAG = 60
CORRUPT = 999_999
CORRUPT_AT = 4
TAIL = [600, 660, 720, 780, 840, 900]

N = len(TICKS)
NWIN = N - W + 1

# The sliding maximum.

def brute_max(xs, i, w=W):
    """The answer everyone gives first: read all w values of window i."""
    best = xs[i]
    for k in range(1, w):
        if xs[i + k] > best:
            best = xs[i + k]
    return best

def evict_smaller(dq, xs, i):
    """Drop from the BACK anything no larger than the arriving value, returning how
    many went.  The whole trick in one sentence: the newcomer is both bigger AND
    newer, so while either is in the window the newcomer is too and is the larger
    -- the smaller one is not unlikely to matter, it is provably dead."""
    popped = 0
    while dq and xs[dq[-1]] <= xs[i]:
        dq.pop()
        popped += 1
    return popped

def evict_larger(dq, xs, i):
    """The mirror of evict_smaller, for the MINIMUM: drop anything no smaller.  One
    comparison left un-reversed here is the easiest possible bug and it produces
    plausible numbers, which is why the minima are asserted against a scan too."""
    while dq and xs[dq[-1]] >= xs[i]:
        dq.pop()

def expire(dq, i, w=W):
    """Drop the FRONT if its index has left the window.  At most one can expire per
    tick, because the window moves by one -- so this is an `if` and not a loop,
    which is the whole argument for the per-tick cost being constant."""
    if dq and dq[0] <= i - w:
        dq.pop(0)
        return 1
    return 0

def slide_max(xs, w=W):
    """One pass.  The deque holds INDEXES, kept decreasing, so its front is the
    answer in one read -- indexes rather than values, because only an index says
    whether an entry has left the window.  Each index is pushed exactly once and
    removed at most once, which is why the cost is amortised O(1) and independent
    of w.  Returns (answers, pushes, pops, fronts, biggest_evict, cheap_ticks)."""
    dq, out = [], []
    pushes = pops = fronts = 0
    biggest = cheap = 0
    for i in range(len(xs)):
        ev = evict_smaller(dq, xs, i)
        pops += ev
        biggest = max(biggest, ev)
        if ev == 0 and i > 0:
            cheap += 1
        dq.append(i)
        pushes += 1
        fronts += expire(dq, i, w)
        if i >= w - 1:
            out.append(xs[dq[0]])
    return out, pushes, pops, fronts, biggest, cheap

def slide_spread(xs, w=W):
    """The same machine twice: `hi` kept decreasing, `lo` kept increasing, both
    advanced together.  The spread is just front(hi) - front(lo)."""
    hi, lo, out = [], [], []
    for i in range(len(xs)):
        evict_smaller(hi, xs, i)
        hi.append(i)
        evict_larger(lo, xs, i)
        lo.append(i)
        expire(hi, i, w)
        expire(lo, i, w)
        if i >= w - 1:
            out.append((xs[hi[0]], xs[lo[0]], xs[hi[0]] - xs[lo[0]]))
    return out

# The watermark: the same maximum, unbounded and bounded.

def watermark_unbounded(ets, lag=LAG):
    """`max event time so far - lag`: a running max over the WHOLE stream.  Monotonic
    by construction, which is the property everyone wants -- and exactly why one
    corrupt timestamp is permanent, since nothing may lower it again.  Returns
    (watermark_seen_before_each_event, late_flags)."""
    wms, late, run = [], [], None
    for et in ets:
        wm = None if run is None else run - lag
        wms.append(wm)
        late.append(wm is not None and et < wm)
        run = et if run is None else max(run, et)
    return wms, late

def watermark_bounded(ets, w=W, lag=LAG):
    """`max of the last w event times - lag`, kept by the monotonic deque above.  The
    corrupt value is evicted by POSITION after w events, so the watermark recovers
    on its own.  The price, which is real: this watermark can go BACKWARDS."""
    dq, wms, late = [], [], []
    for i, et in enumerate(ets):
        wm = None if not dq else ets[dq[0]] - lag
        wms.append(wm)
        late.append(wm is not None and et < wm)
        while dq and ets[dq[-1]] <= et:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - w:
            dq.pop(0)
    return wms, late

# The three variations.

def the_shortest_spike(counts, k):
    """Variation 1, surface: load testing.  Shortest run whose total reaches K.

    Non-obvious point: the window is no longer a fixed size, so `expire` disappears
    entirely and `evict_smaller` is reversed and applied to running TOTALS -- a later
    total no larger than the back makes the back useless, because it is both smaller
    AND closer, so it always gives a shorter run.  Same argument, different quantity."""
    pre = [0]
    for c in counts:
        pre.append(pre[-1] + c)
    dq, best = [], None
    for j, pj in enumerate(pre):
        while dq and pj - pre[dq[0]] >= k:
            i = dq.pop(0)
            if best is None or j - i < best:
                best = j - i
        while dq and pre[dq[-1]] >= pj:      # smaller AND closer: evict
            dq.pop()
        dq.append(j)
    return best

def the_next_warmer_day(temps):
    """Variation 2, surface: weather.  Days until the next warmer day, else 0.

    Non-obvious point: there is no window at all, so `expire` is gone and only the
    eviction remains -- and the evicted entries PRODUCE answers rather than being
    discarded.  The trap is hunting for a window size that is not there."""
    out = [0] * len(temps)
    stack = []
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            out[j] = i - j
        stack.append(i)
    return out

def the_longest_steady_stretch(xs, limit):
    """Variation 3, surface: manufacturing.  Longest run whose max-min <= limit.

    Non-obvious point: the window size becomes the ANSWER rather than an input, so both
    deques must expire by the actual left edge instead of by `i - W`.  Get that wrong
    and the front is stale, the spread reads too small, and the answer is a longer
    steady stretch than really happened."""
    hi, lo, left, best = [], [], 0, 0
    for i, v in enumerate(xs):
        while hi and xs[hi[-1]] <= v:
            hi.pop()
        hi.append(i)
        while lo and xs[lo[-1]] >= v:
            lo.pop()
        lo.append(i)
        while xs[hi[0]] - xs[lo[0]] > limit:
            left += 1
            if hi[0] < left:
                hi.pop(0)
            if lo[0] < left:
                lo.pop(0)
        best = max(best, i - left + 1)
    return best

def main():
    print("TICKS =", "  ".join(f"{i}:{v}" for i, v in enumerate(TICKS)), f"  W = {W}  L = {L}")
    scan = [brute_max(TICKS, i) for i in range(NWIN)]
    fast, pushes, pops, fronts, biggest, cheap = slide_max(TICKS)
    brute_ops = NWIN * W
    ops = pushes + pops + fronts
    print(f"  scan     : {scan}   ({NWIN} windows x {W} = {brute_ops} reads)")
    print(f"  deque    : {fast}   ({pushes}p + {pops}e + {fronts}f = {ops} steps)")

    assert fast == scan, "the deque disagrees with the brute-force scan"
    assert fast == [7, 7, 7, 6, 9, 9, 9], f"measured maxima {fast}"
    assert (pushes, pops, fronts) == (9, 6, 1), f"measured {(pushes, pops, fronts)}"
    assert ops == 16 and brute_ops == 21 and ops < brute_ops
    assert pushes == N, "a value was pushed twice; the amortised argument needs exactly one each"
    assert biggest == 2, f"the biggest single eviction was {biggest}, expected 2"
    assert cheap >= 1, "no tick evicts nothing, so the cheap path is never shown"
    assert any(TICKS[i] < TICKS[i - 1] for i in range(1, N)), "monotone input hides eviction"
    assert fronts >= 1, "nothing ever expired from the front"

    spreads = slide_spread(TICKS)
    over = [s for *_, s in spreads if s > L]
    under = [s for *_, s in spreads if s <= L]
    print(f"  spreads  : {[s for *_, s in spreads]}   ({len(over)} over {L}, {len(under)} under)")
    assert [s for *_, s in spreads] == [4, 5, 5, 5, 8, 8, 5], f"measured {[s for *_, s in spreads]}"
    assert [m for m, _, _ in spreads] == scan
    assert [m for _, m, _ in spreads] == [min(TICKS[i:i + W]) for i in range(NWIN)]
    assert over and under, "the spread test must discriminate, not fire always or never"

    # ---- the watermark, with one corrupt future timestamp
    clean = ETS + TAIL
    corrupt = ETS[:CORRUPT_AT] + [CORRUPT] + ETS[CORRUPT_AT:] + TAIL
    _, clean_u = watermark_unbounded(clean)
    _, clean_b = watermark_bounded(clean)
    truly_late = {clean[i] for i, f in enumerate(clean_u) if f}
    print(f"\n  clean stream, unbounded: {sum(clean_u)} late {sorted(truly_late)}")
    print(f"  clean stream, bounded  : {sum(clean_b)} late "
          f"{sorted(clean[i] for i, f in enumerate(clean_b) if f)}")
    assert truly_late == {50}, f"the genuinely late event should be et=50, got {truly_late}"
    assert [clean[i] for i, f in enumerate(clean_b) if f] == [50], "the bounded watermark must still catch it"

    wm_u, late_u = watermark_unbounded(corrupt)
    wm_b, late_b = watermark_bounded(corrupt)
    false_u = [corrupt[i] for i, f in enumerate(late_u) if f and corrupt[i] not in truly_late]
    false_b = [corrupt[i] for i, f in enumerate(late_b) if f and corrupt[i] not in truly_late]
    print(f"  corrupt event {CORRUPT} at position {CORRUPT_AT}:")
    print(f"    unbounded wm after it = {wm_u[CORRUPT_AT + 1]}, at the end = {wm_u[-1]}")
    print(f"    bounded   wm after it = {wm_b[CORRUPT_AT + 1]}, at the end = {wm_b[-1]}")
    print(f"    falsely late: unbounded {false_u}  ({len(false_u)})")
    print(f"                  bounded   {false_b}  ({len(false_b)})")

    assert len(false_u) == 10, f"measured {len(false_u)} false-lates unbounded"
    assert len(false_b) == 3, f"measured {len(false_b)} false-lates bounded"
    assert len(false_b) < len(false_u), "bounding must reduce the damage"
    # the unbounded watermark never comes back down: every event after the corrupt
    # one is declared late, including the tail
    assert all(f for f in late_u[CORRUPT_AT + 1:]), "unbounded must poison EVERY later event"
    assert wm_u[-1] == CORRUPT - LAG, "the unbounded watermark must still hold the corrupt value"
    # the bounded one recovers after exactly W events, permanently
    # ...and after W events the bounded watermark raises no FALSE lateness again.
    # It does still flag corrupt[8] = 50, which is the genuinely late event -- the
    # fix must not work by switching lateness detection off.
    tail_flags = [(corrupt[i], f) for i, f in enumerate(late_b) if i > CORRUPT_AT + W]
    assert [v for v, f in tail_flags if f] == [50], f"bounded tail flags {tail_flags}"
    assert wm_b[-1] == max(corrupt[-W - 1:-1]) - LAG
    # and the cost of bounding, asserted so it cannot be forgotten: it is NOT monotone
    assert all(a <= b for a, b in zip(wm_u[1:], wm_u[2:])), "unbounded must be monotone"
    assert any(a > b for a, b in zip(wm_b[1:], wm_b[2:])), (
        "the bounded watermark must go backwards somewhere -- that is what it costs")

    # ---- variations
    assert the_shortest_spike([2, 0, 1, 4, 3], 5) == 2
    assert the_shortest_spike([1, 1, 1], 99) is None, "unreachable K must report nothing"
    assert the_next_warmer_day(TICKS) == [2, 1, 4, 1, 2, 1, 0, 1, 0], the_next_warmer_day(TICKS)
    assert the_next_warmer_day([5, 4, 3]) == [0, 0, 0]
    # MEASURED 6, not the 4 first expected: 5,3,7,2,6,1 spans 7-1 = 6, which is
    # exactly L, so six of the nine ticks are one steady stretch.
    assert the_longest_steady_stretch(TICKS, L) == 6, the_longest_steady_stretch(TICKS, L)
    assert the_longest_steady_stretch(TICKS, 0) == 1, "with no tolerance every run is one long"
    print(f"\n  shortest spike reaching 5 in [2,0,1,4,3] : {the_shortest_spike([2, 0, 1, 4, 3], 5)}")
    print(f"  days to a warmer day                    : {the_next_warmer_day(TICKS)}")
    print(f"  longest stretch spanning <= {L}            : {the_longest_steady_stretch(TICKS, L)}")

    # ---- brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    for _ in range(600):
        w = rng.randint(1, 6)
        n = rng.randint(w, 22)
        xs = [rng.randint(-20, 20) for _ in range(n)]
        want = [(max(xs[i:i + w]), min(xs[i:i + w])) for i in range(n - w + 1)]
        assert slide_max(xs, w)[0] == [m for m, _ in want], (xs, w)
        assert [(h, lo) for h, lo, _ in slide_spread(xs, w)] == want, (xs, w)
        assert the_next_warmer_day(xs) == [
            next((j - i for j in range(i + 1, n) if xs[j] > xs[i]), 0) for i in range(n)], xs
        lim = rng.randint(0, 10)
        assert the_longest_steady_stretch(xs, lim) == max(
            (j - i + 1 for i in range(n) for j in range(i, n)
             if max(xs[i:j + 1]) - min(xs[i:j + 1]) <= lim), default=0), (xs, lim)
        pos, k = [abs(v) for v in xs], rng.randint(1, 30)
        assert the_shortest_spike(pos, k) == min(
            (j - i for i in range(n + 1) for j in range(i + 1, n + 1) if sum(pos[i:j]) >= k),
            default=None), (pos, k)
    print("\n  600 random inputs: deque == scan for max and min; all three variations")
    print("  == their naive references.")

    print("\nall assertions passed")

if __name__ == "__main__":
    main()
