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
    """Variation 2, surface: facilities.  One list; find overlapping pairs and the
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

def the_attributed_click(impressions, clicks, w, wait):
    """Variation 3, surface: advertising.  Match each click to the NEAREST impression
    shown at most w before it, one-to-one.  The same function, encoding and data as
    programs/ch09_v3.py's attribute(), so the two give the same answers.

    Non-obvious point: the match is asymmetric and one-to-one, so an impression already
    matched must not match again -- and "nearest" means a click cannot be answered until
    it is certain no closer impression is still in flight.  That turns a stateless
    sweep into a WAIT, whose length is the lateness bound from `droppable`, so the bound
    stops being an optimisation and becomes a correctness requirement.  w and the
    lateness bound are different numbers and are easy to conflate.

    `impressions` is [(shown_at, arrived_at), ...]: the second it was shown and the
    second the matcher received it.  A click at t is answered at t + wait, so it may only
    consider impressions that had ARRIVED by then.  Returns [(click_t, shown_at or None), ...].
    """
    out, used = [], set()
    for ct in clicks:
        best = None
        for shown, arrived in impressions:
            if arrived <= ct + wait and ct - w <= shown <= ct and shown not in used:
                if best is None or shown > best:
                    best = shown
        if best is not None:
            used.add(best)
        out.append((ct, best))
    return out

def the_unavailable_hours(busy, start, end):
    """Variation 4, surface: scheduling.  Report the FREE spans between start and end.

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

    # the streams of programs/ch09_v3.py: the impression shown at 245 arrives at 330
    imps = [(1, 1), (3, 3), (130, 130), (245, 330), (540, 540)]
    clicks = [50, 90, 220, 260, 265]
    credited = lambda res: sum(1 for _, i in res if i is not None)
    at_once = the_attributed_click(imps, clicks, w=60, wait=0)
    wait_w = the_attributed_click(imps, clicks, w=60, wait=60)
    wait_late = the_attributed_click(imps, clicks, w=60, wait=85)
    print(f"  attributed click: wait 0 -> {credited(at_once)}, wait 60 -> {credited(wait_w)}, "
          f"wait 85 -> {credited(wait_late)} attributed")
    # MEASURED, as in ch09_v3.py: waiting W = 60 is not enough, because the impression
    # shown at 245 is 85 late; waiting the measured lateness recovers the click at 260.
    assert (credited(at_once), credited(wait_w), credited(wait_late)) == (1, 1, 2)
    assert at_once[3] == (260, None) and wait_late[3] == (260, 245), (at_once, wait_late)
    assert wait_late[4] == (265, None), "one-to-one: the click at 265 may not take 245 again"
    # one-to-one: two clicks may not take the same impression
    two = the_attributed_click([(100, 100)], [120, 120], w=60, wait=0)
    assert two == [(120, 100), (120, None)], two

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
