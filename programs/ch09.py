#!/usr/bin/env python3
"""Every overlap between two sorted lists of spans -- and what a stream may forget.

Two sorted lists of time spans.  Within a list, spans never overlap each other.
Report every overlap between a span in the first list and a span in the second.
10^6 spans in each.  Then: both lists are streams that keep arriving -- what may
you throw away?

Two facts are handed to you and both matter: each list is SORTED, and within a list
the spans never overlap.  The second is what licenses the advance rule, and it is
easy to read past as scene-setting.

Run it:  python3 programs/ch09.py
"""
import random

# Data, from tools/gen_ch09_interview.js over tools/stream_seed.js.
# LEFT: key "a"'s sessions at the seed's gap of 120 (consecutive times within 120
# of each other merged).  RIGHT: key "b"'s events widened to [et, et+J] with J = 60
# and then merged, so the two lists come from the same seed by different rules and
# neither overlaps itself.
LEFT = [(1, 3), (130, 245), (540, 540)]
RIGHT = [(50, 150), (220, 320)]
M, NB = len(LEFT), len(RIGHT)
NONE = None                     # these two spans do not overlap at all

def overlap_of(x, y):
    """The overlap, or NONE.  The only geometry in the problem: it starts at the LATER
    start and ends at the EARLIER end, and if that comes out backwards there is no
    overlap -- so one expression answers both "do they" and "where"."""
    lo = max(x[0], y[0])
    hi = min(x[1], y[1])
    if hi < lo:
        return NONE
    return (lo, hi)

def every_pair(left, right):
    """The answer everyone gives first: try all of them.  Correct, quadratic, and it
    uses neither of the two facts the question handed you.  Returns (overlaps,
    comparisons)."""
    out, cmp = [], 0
    for x in left:
        for y in right:
            cmp += 1
            o = overlap_of(x, y)
            if o is not NONE:
                out.append(o)
    return out, cmp

def sweep(left, right):
    """One cursor into each list, advancing whichever span ENDS FIRST.

    That span cannot overlap anything further along the other list, because the other
    list is sorted AND its spans do not overlap each other -- so everything remaining
    there starts later than the one just compared.  Each comparison retires exactly
    one span, so the total is at most m + n.  The rule is symmetric and must be:
    advancing by start, or always advancing the left, skips overlaps.  And a single
    span can produce SEVERAL overlaps, so the loop must not assume one each.

    Returns (overlaps, comparisons, trace).
    """
    out, trace = [], []
    i = j = cmp = 0
    while i < len(left) and j < len(right):
        cmp += 1
        o = overlap_of(left[i], right[j])
        if o is not NONE:
            out.append(o)
        advance = "left" if left[i][1] < right[j][1] else "right"
        trace.append({"i": i, "j": j, "x": left[i], "y": right[j], "o": o, "advance": advance})
        if advance == "left":
            i += 1
        else:
            j += 1
    return out, cmp, trace

def droppable(left, bound):
    """Spans that may be forgotten, given a promise that nothing still to arrive on the
    other side can START before `bound`.

    The sweep assumed both lists were complete.  As streams they are not: a span the
    cursor has passed cannot be released, because something overlapping it may not
    have arrived -- so "finished with" becomes a claim about the FUTURE.  Without such
    a bound NOTHING can be dropped and the state grows for as long as the system runs.
    """
    return [x for x in left if x[1] < bound]

# The three variations.

def the_double_booked_room(bookings):
    """Variation 1, surface: facilities.  One list; find overlapping pairs and the
    busiest moment.

    Non-obvious point: self-overlap removes the guarantee the sweep rested on, so
    "ends first means finished" is false and the two-pointer rule does not apply at
    all.  The move is to stop thinking in spans and think in EVENTS: each span becomes
    a start and an end, sorted together, and a running count rises and falls.  The
    busiest moment is the count's maximum and an overlap exists wherever it exceeds
    one.  The span-pair framing was the obstacle, not the solution.

    Returns (max_concurrency, busiest_moment, overlapping_pair_count).
    """
    marks = []
    for s, e in bookings:
        marks.append((s, 1))
        marks.append((e + 1, -1))        # closed intervals: the end is still busy
    marks.sort()
    live = best = 0
    at = None
    pairs = 0
    for t, d in marks:
        if d == 1:
            pairs += live                # the arriving booking clashes with all live ones
        live += d
        if live > best:
            best, at = live, t
    return best, at, pairs

def the_attributed_click(impressions, clicks, w, wait_for_late):
    """Variation 2, surface: advertising.  Match each click to the NEAREST impression
    that preceded it by at most w, one-to-one.

    Non-obvious point: the match is asymmetric and one-to-one, so an impression already
    matched must not match again -- and "nearest" means a click cannot be answered until
    it is certain no closer impression is still in flight.  That turns a stateless
    sweep into a WAIT, whose length is the lateness bound from `droppable`, so the bound
    stops being an optimisation and becomes a correctness requirement.  w and the
    lateness bound are different numbers and are easy to conflate.

    `impressions` is [(arrival_order_index, t), ...] -- its t values may arrive late.
    `wait_for_late` false answers each click immediately; true waits for every
    impression first.  Returns [(click_t, impression_t or None), ...].
    """
    out, used = [], set()
    for ci, ct in enumerate(clicks):
        if wait_for_late:
            pool = [t for _, t in impressions]
        else:                            # only what had arrived by this click's position
            pool = [t for order, t in impressions if order <= ci]
        best = None
        for t in pool:
            if ct - w <= t <= ct and t not in used:
                if best is None or t > best:
                    best = t
        if best is not None:
            used.add(best)
        out.append((ct, best))
    return out

def the_unavailable_hours(busy, start, end):
    """Variation 3, surface: scheduling.  Report the FREE spans between start and end.

    Non-obvious point: the complement rather than the intersection, and it is almost
    all boundary conditions -- before the first busy span, between consecutive ones,
    after the last, and the empty cases where someone is busy throughout or not at
    all.  There is no clever idea, which is the point: the gap-between-consecutive
    pattern is what appears in working code, and off-by-one at the ends is where it
    breaks.  The sorted, non-overlapping guarantee is what makes one pass enough.
    """
    free, cursor = [], start
    for s, e in sorted(busy):
        if e < start or s > end:
            continue
        if s > cursor:
            free.append((cursor, s - 1))
        cursor = max(cursor, e + 1)
    if cursor <= end:
        free.append((cursor, end))
    return free

def main():
    print(f"LEFT  = {LEFT}")
    print(f"RIGHT = {RIGHT}")
    cross, cross_cmp = every_pair(LEFT, RIGHT)
    fast, cmp, trace = sweep(LEFT, RIGHT)
    for s in trace:
        o = "NONE" if s["o"] is NONE else f"{s['o'][0]}..{s['o'][1]}"
        print(f"  i={s['i']} j={s['j']}  {s['x']} vs {s['y']}  ->  {o:<8} advance {s['advance']}")
    print(f"\n  every pair : {cross}   ({M} x {NB} = {cross_cmp} comparisons)")
    print(f"  sweep      : {fast}   ({cmp} comparisons)")

    assert fast == cross == [(130, 150), (220, 245)], (fast, cross)
    assert (cross_cmp, cmp) == (6, 4) and cmp < cross_cmp
    assert cmp <= M + NB, "each comparison must retire exactly one span"
    assert len(fast) >= 2, "fewer than two overlaps and the advance rule would not matter"
    assert any(s["advance"] == "left" for s in trace), "the left side never advanced"
    assert any(s["advance"] == "right" for s in trace), "the right side never advanced"
    assert any(s["o"] is NONE for s in trace), "no compared pair failed to overlap"
    assert all(LEFT[k][0] > LEFT[k - 1][1] for k in range(1, M)), "LEFT overlaps itself"
    assert all(RIGHT[k][0] > RIGHT[k - 1][1] for k in range(1, NB)), "RIGHT overlaps itself"
    # one LEFT span produces BOTH overlaps, so the loop may not assume one each
    assert sum(1 for s in trace if s["o"] is not NONE and s["x"] == (130, 245)) == 2
    # the geometry, both ways round
    assert overlap_of((130, 245), (50, 150)) == (130, 150)
    assert overlap_of((1, 3), (50, 150)) is NONE and overlap_of((540, 540), (220, 320)) is NONE
    assert overlap_of((5, 5), (5, 5)) == (5, 5), "closed intervals touch at a point"

    bound = RIGHT[-1][0]
    gone, kept = droppable(LEFT, bound), [x for x in LEFT if x not in droppable(LEFT, bound)]
    print(f"\n  with a bound of {bound} on how late RIGHT may be: droppable {gone}, kept {kept}")
    assert gone == [(1, 3)] and kept == [(130, 245), (540, 540)], (gone, kept)
    assert len(gone) == 1 and len(kept) == 2
    # and the opposite outcome is forbidden: with no promise, NOTHING may be dropped
    assert droppable(LEFT, float("-inf")) == [], "a stream with no bound must keep everything"
    assert droppable(LEFT, float("inf")) == LEFT, "and a finished stream may drop all of it"

    # variations
    best, at, pairs = the_double_booked_room([(0, 10), (5, 15), (12, 20), (100, 101)])
    print(f"\n  double-booked room: busiest {best} at t={at}, {pairs} overlapping pairs")
    assert (best, at, pairs) == (2, 5, 2), (best, at, pairs)
    assert the_double_booked_room([(0, 1), (2, 3)]) == (1, 0, 0), "no overlap, no clash"

    late = [(0, 100), (1, 180), (2, 150)]          # the 150 impression arrives LAST
    now = the_attributed_click(late, [200], w=60, wait_for_late=False)
    later = the_attributed_click(late, [200], w=60, wait_for_late=True)
    print(f"  attributed click: answering at once gives {now} (lost), waiting gives {later}")
    # MEASURED, and sharper than first expected: answering the click at once does not
    # merely pick a worse impression, it finds NONE at all -- the only impression that
    # had arrived (100) is already outside the w = 60 window, so the attribution is
    # lost rather than approximated.  Waiting for the late arrivals recovers 180.
    assert now == [(200, None)] and later == [(200, 180)], (now, later)
    assert now != later, "the wait must change the answer"
    # a click at 160 answered immediately picks 100; waiting finds the nearer 150
    now2 = the_attributed_click(late, [160], w=60, wait_for_late=False)
    later2 = the_attributed_click(late, [160], w=60, wait_for_late=True)
    assert now2 == [(160, 100)] and later2 == [(160, 150)], (now2, later2)
    assert now2 != later2, "the wait must change the answer, or it is not needed"
    print(f"                    a click at 160: at once {now2[0][1]}, waiting {later2[0][1]}")
    # one-to-one: two clicks may not take the same impression
    two = the_attributed_click([(0, 100)], [120, 130], w=60, wait_for_late=True)
    assert two == [(120, 100), (130, None)], two

    free = the_unavailable_hours([(130, 245), (540, 540)], 0, 600)
    print(f"  unavailable hours: free {free}")
    assert free == [(0, 129), (246, 539), (541, 600)], free
    assert the_unavailable_hours([], 0, 10) == [(0, 10)], "no busy spans: all free"
    assert the_unavailable_hours([(0, 10)], 0, 10) == [], "busy throughout: nothing free"
    assert the_unavailable_hours([(0, 5)], 0, 10) == [(6, 10)], "busy at the start"
    assert the_unavailable_hours([(5, 10)], 0, 10) == [(0, 4)], "busy at the end"
    assert the_unavailable_hours([(-5, 20)], 0, 10) == [], "a span covering the window"

    # brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    both_ways = 0
    for _ in range(800):
        def make(n):
            spans, t = [], rng.randint(0, 5)
            for _ in range(n):
                s = t + rng.randint(1, 8)
                e = s + rng.randint(0, 6)
                spans.append((s, e))
                t = e + 1
            return spans
        left, right = make(rng.randint(1, 8)), make(rng.randint(1, 8))
        want, _ = every_pair(left, right)
        got, c, tr = sweep(left, right)
        assert got == want, (left, right)
        assert c <= len(left) + len(right), (left, right, c)
        if any(s["advance"] == "left" for s in tr) and any(s["advance"] == "right" for s in tr):
            both_ways += 1
        # the complement, against a naive per-unit scan
        busy_units = {u for s, e in left for u in range(s, e + 1)}
        lo, hi = 0, max(e for _, e in left) + 3
        naive, run = [], None
        for u in range(lo, hi + 1):
            if u not in busy_units and run is None:
                run = u
            elif u in busy_units and run is not None:
                naive.append((run, u - 1))
                run = None
        if run is not None:
            naive.append((run, hi))
        assert the_unavailable_hours(left, lo, hi) == naive, (left, lo, hi)
        # and the event sweep, against a naive pair count
        pairs_naive = sum(1 for a in range(len(left)) for b in range(a + 1, len(left))
                          if overlap_of(left[a], left[b]) is not NONE)
        assert the_double_booked_room(left)[2] == pairs_naive, left
    assert both_ways > 0, "no random case exercised both advance directions"
    print(f"\n  800 random span-list pairs: sweep == every pair, never more than m + n")
    print(f"  comparisons ({both_ways} exercised both advance directions), the free-span")
    print("  complement == a per-unit scan, and the event sweep == a naive pair count.")
    print("\nall assertions passed")

if __name__ == "__main__":
    main()
