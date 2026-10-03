#!/usr/bin/env python3
"""Variation 2 -- the double-booked room (looks like facilities). Standalone and runnable.

  One list this time: the bookings for a meeting room, sorted by start.  Report every pair
  that overlaps, and the busiest moment -- the time at which the most bookings are live at
  once.  Up to 10**6 bookings.

The chapter had two lists and leaned on a promise about each one: within a list, spans never
overlap.  Here there is one list and it overlaps ITSELF, so "the span that ends first is
finished" is simply false and the two-pointer rule does not apply at all -- the version that
pairs the list with itself is written out below and gets the wrong answer, which is more
convincing than being told.  The move is to stop thinking in spans and think in EVENTS: every
booking becomes a start and an end, all of them sorted together, and a running count rises
and falls.  The busiest moment is that count's maximum and an overlap exists wherever it
exceeds one.  The span-pair framing was the obstacle, not the solution -- and the event sweep
is strictly more general, because it also answers the chapter's two-list question.

WORKED EXAMPLES: the EXAMPLES table below holds 12 booking lists and their answers -- an empty
room, a single zero-length booking, a room with no clash at all, BOTH sides of the closed-span
boundary (adjacent at 11 is free, touching at 10 is a clash), identical and nested bookings, the
chapter's own data, the workshop that breaks the two-pointer rule, and two generated rooms of
20,000 and 2,000 bookings.  Each row prints what the sweep costs in marks beside what the
quadratic answer would cost in comparisons, and on the small rows the marks are the MORE
expensive of the two.  Every row is ASSERTED -- against the answer below, against a direct
per-instant count, and where it is affordable against every_pair() as well -- so the table
cannot drift from the code.

Run it:  python3 programs/ch09_v2.py
"""
import random

# The chapter's two lists poured into one, which is exactly what "one list this time" means:
# its LEFT = [(1, 3), (130, 245), (540, 540)] and RIGHT = [(50, 150), (220, 320)], sorted by
# start.  Neither list overlapped itself; the union does, and the chapter's two cross-list
# overlaps (130..150 and 220..245) are now this room's two double-bookings.  Spans are CLOSED:
# a booking from 130 to 245 occupies 245.
BOOKINGS = [(1, 3), (50, 150), (130, 245), (220, 320), (540, 540)]
LEFT = [(1, 3), (130, 245), (540, 540)]      # kept, to check the general sweep against
RIGHT = [(50, 150), (220, 320)]
# One more booking -- a long workshop from 140 to 230 -- so that THREE bookings are live at
# once.  It is here because the chapter's union is not enough to break the two-pointer rule:
# measured below, that rule gets the chapter's data exactly right, and only a third
# simultaneous booking exposes it.
WITH_WORKSHOP = sorted(BOOKINGS + [(140, 230)])
NONE = None                                  # these two bookings do not overlap at all

# Rooms for the examples table, not alternative versions of the problem: the degenerate ones,
# the two sides of the closed-span boundary, and two GENERATED rooms at scale -- a CHAIN in
# which each booking overlaps only the next, and a STACK in which every booking covers one
# instant, so the pair count is quadratic in the answer while the marks stay at 2 per booking.
EMPTY_ROOM  = []                                  # nothing booked at all
ONE_BOOKING = [(5, 5)]                            # one zero-length booking
NO_CLASH    = [(0, 1), (5, 6), (10, 11)]          # a clean room: no pair to report
ADJACENT    = [(0, 10), (11, 20)]                 # free side of the boundary
TOUCHING    = [(0, 10), (10, 20)]                 # clash side: both occupy minute 10
TWO_SAME    = [(0, 10), (0, 10)]                  # the same booking made twice
FOUR_SAME   = [(0, 10)] * 4                       # one instant, 4 choose 2 = 6 pairs
NESTED      = [(0, 100), (10, 20), (30, 40)]      # two bookings inside a third
BIG_CHAIN   = [(i * 5, i * 5 + 7) for i in range(20_000)]
BIG_STACK   = [(i, 50_000) for i in range(2_000)]

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, bookings, expected (max_live, busiest_moment, pair_count)).  Every row is
# asserted by show_examples(), which is why the table is data and not a comment: a comment can
# go stale silently, and this cannot.
EXAMPLES = [
    ("an empty room -> no busiest moment",   EMPTY_ROOM,     (0,    None, 0)),
    ("one zero-length booking",              ONE_BOOKING,    (1,    5,    0)),
    ("three bookings, no clash at all",      NO_CLASH,       (1,    0,    0)),
    ("adjacent at 11: free (boundary)",      ADJACENT,       (1,    0,    0)),
    ("touching at 10: a clash (boundary)",   TOUCHING,       (2,    10,   1)),
    ("the same booking made twice",          TWO_SAME,       (2,    0,    1)),
    ("four identical bookings",              FOUR_SAME,      (4,    0,    6)),
    ("nesting, not merely overlap",          NESTED,         (2,    10,   2)),
    ("the chapter's two lists, poured in",   BOOKINGS,       (2,    130,  2)),
    ("...plus the workshop: three live",     WITH_WORKSHOP,  (3,    140,  5)),
    ("20,000 bookings in a chain",           BIG_CHAIN,      (2,    5,    19_999)),
    ("2,000 bookings over one instant",      BIG_STACK,      (2000, 1999, 1_999_000)),
]


def overlap_of(x, y):
    """The overlap of two closed spans, or NONE.  It starts at the LATER start and ends at the
    EARLIER end, and if that comes out backwards there is no overlap -- so one expression
    answers both "do they" and "where"."""
    lo, hi = max(x[0], y[0]), min(x[1], y[1])
    return NONE if hi < lo else (lo, hi)


def every_pair(bookings):
    """The answer everyone gives first, and the reference everything else is checked against:
    try all of them.  Correct, and n(n-1)/2 comparisons -- at 10**6 bookings that is 5 x 10**11.
    Returns (pairs, comparisons) with pairs as (i, j, lo, hi)."""
    out, cmp = [], 0
    for i in range(len(bookings)):
        for j in range(i + 1, len(bookings)):
            cmp += 1
            o = overlap_of(bookings[i], bookings[j])
            if o is not NONE:
                out.append((i, j, o[0], o[1]))
    return out, cmp


def two_pointer_against_itself(bookings):
    """The chapter's sweep, pointed at this problem: one cursor into the list and one into the
    same list, advancing whichever span ends first.

    It is here to be run rather than dismissed.  The rule was licensed by a promise -- the
    other list does not overlap itself, so everything remaining in it starts later than the
    span just compared -- and that promise is now false by construction.  What comes out is
    every span matched with itself and the real double-bookings missed.
    """
    out, i, j = [], 0, 0
    while i < len(bookings) and j < len(bookings):
        o = overlap_of(bookings[i], bookings[j])
        if o is not NONE and i != j:
            out.append((min(i, j), max(i, j), o[0], o[1]))
        if bookings[i][1] < bookings[j][1]:
            i += 1
        else:
            j += 1
    return out


def marks_of(bookings):
    """Every booking as two events: +1 where it starts, -1 just after it ends.

    The end mark is at `end + 1` because the spans are CLOSED -- a booking occupying 245 is
    still live at 245 and free at 246.  Sorting puts -1 before +1 at the same instant, which
    is what makes a booking ending at 129 and one starting at 130 not count as a clash, while
    one ending at 130 and one starting at 130 do.
    """
    marks = []
    for s, e in bookings:
        marks.append((s, 1))
        marks.append((e + 1, -1))
    marks.sort()
    return marks


def event_sweep(bookings):
    """One pass over the sorted marks, carrying a running count of live bookings.

    The mechanism: the count after processing every mark at an instant IS the number of
    bookings covering that instant, so the maximum over the pass is the busiest moment and no
    span is ever compared with another.  The pair count comes free -- an arriving booking
    clashes with precisely those already live, so adding `live` at each start totals every
    overlapping pair exactly once, counted at the later of the two starts.
    Returns (max_live, busiest_moment, pair_count).
    """
    live = best = pairs = 0
    at = None
    for t, delta in marks_of(bookings):
        if delta == 1:
            pairs += live               # it clashes with everything currently live
        live += delta
        if live > best:
            best, at = live, t
    return best, at, pairs


def cross_by_events(left, right):
    """The same event sweep doing the CHAPTER's job: overlaps between two lists, not within one.

    Each booking is tagged with the list it came from, and a start records an overlap against
    every live span from the OTHER list.  The later start is the overlap's start, so the pair
    is recorded exactly once.  It is strictly more general than the two-pointer sweep and
    strictly more expensive -- the work is one pass plus the live spans touched -- which is the
    honest summary of what generality costs here.
    """
    events = []
    for tag, spans in (("L", left), ("R", right)):
        for idx, (s, e) in enumerate(spans):
            events.append((s, 1, tag, idx, e))
            events.append((e + 1, -1, tag, idx, e))
    events.sort(key=lambda m: (m[0], m[1]))
    live = {"L": {}, "R": {}}
    out = []
    for t, delta, tag, idx, end in events:
        other = "R" if tag == "L" else "L"
        if delta == -1:
            live[tag].pop(idx, None)
            continue
        for oidx, oend in live[other].items():
            lo, hi = t, min(end, oend)
            if hi >= lo:
                pair = (idx, oidx) if tag == "L" else (oidx, idx)
                out.append((pair[0], pair[1], lo, hi))
        live[tag][idx] = end
    return sorted(out)


def every_cross_pair(left, right):
    """The quadratic reference for the two-list question, indexed the same way."""
    out = []
    for i, x in enumerate(left):
        for j, y in enumerate(right):
            o = overlap_of(x, y)
            if o is not NONE:
                out.append((i, j, o[0], o[1]))
    return sorted(out)


def covering(bookings, t):
    """How many bookings cover instant t, counted directly.  The per-instant reference the
    sweep's answer is checked against -- affordable only on a small range, which is the whole
    reason the sweep exists."""
    return sum(1 for s, e in bookings if s <= t <= e)


def show_examples():
    """Print the examples table and assert every row.

    Each row is checked at least twice: against the expected triple in the table, and against
    covering(), a direct count of the bookings live at the instant the sweep calls busiest.  On
    the rows small enough to afford it the quadratic every_pair() is run too, so the pair count
    is confirmed by the reference implementation rather than by the sweep's own arithmetic.  The
    two cost columns are printed side by side because the sweep does not win on every input: at
    five bookings the marks and the comparisons are both 10, and below that the quadratic answer
    is the cheaper one.
    """
    print(f"{'what it exercises':36s} {'bookings':>8} {'marks':>7} {'pair cmps':>12} "
          f"{'busiest':>8} {'at':>6} {'pairs':>10}")
    for label, bookings, want in EXAMPLES:
        n = len(bookings)
        got = event_sweep(bookings)
        best, at, pairs = got
        assert got == want, (label, got, want)
        if at is None:
            assert (best, pairs, n) == (0, 0, 0), (label, got)   # nothing booked, nothing to report
        else:
            assert covering(bookings, at) == best, (label, at, best)
            assert any(s <= at <= e for s, e in bookings), (label, at)
        if n <= 40:                       # the quadratic reference, where it is affordable
            ref, cmps = every_pair(bookings)
            assert len(ref) == pairs, (label, len(ref), pairs)
            assert cmps == n * (n - 1) // 2, (label, cmps)
        would = n * (n - 1) // 2          # what every_pair would cost on this room
        print(f"{label:36s} {n:>8,} {2 * n:>7,} {would:>12,} {best:>8,} {str(at):>6} {pairs:>10,}")
    print(f"all {len(EXAMPLES)} examples agree with a direct per-instant count")


def main():
    show_examples()
    print(f"BOOKINGS = {BOOKINGS}   ({len(BOOKINGS)} bookings, closed spans)")
    pairs, cmp = every_pair(BOOKINGS)
    best, at, count = event_sweep(BOOKINGS)
    print("  marks   =", marks_of(BOOKINGS))
    print(f"\n  every pair  : {[(i, j, f'{lo}..{hi}') for i, j, lo, hi in pairs]}   "
          f"({cmp} comparisons)")
    print(f"  event sweep : busiest {best} bookings at t={at}, {count} overlapping pairs   "
          f"({len(marks_of(BOOKINGS))} marks)")

    assert pairs == [(1, 2, 130, 150), (2, 3, 220, 245)], pairs
    assert (best, at, count) == (2, 130, 2), (best, at, count)
    assert count == len(pairs), "the sweep's pair count must match the quadratic answer"
    assert cmp == len(BOOKINGS) * (len(BOOKINGS) - 1) // 2 == 10
    assert covering(BOOKINGS, at) == best, "the busiest moment must really be that busy"
    assert any(s <= at <= e for s, e in BOOKINGS), "and it must be inside a booking"
    print(f"  the two double-bookings are the chapter's two overlaps, 130..150 and 220..245 --")
    print(f"  the same data, with the two lists poured into one.")

    # the chapter's sweep, run rather than dismissed -- and it PASSES, which is the dangerous
    # outcome.  The first version of this program asserted that it misses an overlap here; the
    # measurement refused that, and the reason is worth more than the assertion was: the
    # chapter's union is a CHAIN, each booking overlapping only its neighbour, so each
    # comparison really does retire a span and the rule survives by luck.
    wrong = two_pointer_against_itself(BOOKINGS)
    print(f"\n  two-pointer sweep of the list against itself: "
          f"{[(i, j, f'{lo}..{hi}') for i, j, lo, hi in wrong]}")
    assert wrong == pairs, wrong
    print(f"  it gets the right answer -- which is the worst thing it could do, because the")
    print(f"  promise that licensed the rule is gone and the output does not say so.  In this")
    print(f"  list every booking overlaps only its neighbour, so each comparison still retires a")
    print(f"  span.  Breaking it needs THREE bookings live at once, which is also exactly the")
    print(f"  thing the question asks about.")

    # ...so add the third one
    trip_pairs, trip_cmp = every_pair(WITH_WORKSHOP)
    trip_best, trip_at, trip_count = event_sweep(WITH_WORKSHOP)
    trip_wrong = two_pointer_against_itself(WITH_WORKSHOP)
    print(f"\n  with a workshop from 140 to 230 added: {WITH_WORKSHOP}")
    print(f"    every pair  : {len(trip_pairs)} pairs, busiest unknown to it   ({trip_cmp} comparisons)")
    print(f"    event sweep : busiest {trip_best} at t={trip_at}, {trip_count} pairs   "
          f"({len(marks_of(WITH_WORKSHOP))} marks)")
    print(f"    two-pointer : {len(trip_wrong)} pairs   WRONG")
    assert trip_count == len(trip_pairs) == 5, (trip_count, trip_pairs)
    assert (trip_best, trip_at) == (3, 140), (trip_best, trip_at)
    assert covering(WITH_WORKSHOP, trip_at) == 3
    missed = [p for p in trip_pairs if p not in trip_wrong]
    assert missed == [(1, 3, 140, 150)], missed
    assert len(trip_wrong) == 4 < len(trip_pairs), trip_wrong
    assert all(p in trip_pairs for p in trip_wrong), "it misses pairs, it never invents them"
    print(f"    it finds {len(trip_wrong)} of {len(trip_pairs)} and misses {missed[0][2]}..{missed[0][3]}: after comparing bookings 1 and 2 it")
    print(f"    advances past booking 1, which still had an overlap with booking 3 waiting.  The")
    print(f"    rule retires a span per comparison, and with three live at once that is one span")
    print(f"    too many.  It under-reports, so a double-booking is simply never raised.")

    # the sweep's count, checked instant by instant across the whole range
    lo_t, hi_t = min(s for s, _ in BOOKINGS), max(e for _, e in BOOKINGS)
    by_instant = max(covering(BOOKINGS, t) for t in range(lo_t, hi_t + 2))
    assert by_instant == best == 2, (by_instant, best)
    for t in range(lo_t, hi_t + 2):
        assert covering(BOOKINGS, t) <= best, t
    print(f"\n  checked against a direct count at all {hi_t - lo_t + 2} instants from {lo_t} to {hi_t + 1}: the maximum is")
    print(f"  {by_instant}, and no instant exceeds it -- so the running count is the concurrency, not a")
    print(f"  proxy for it.")

    # the same machinery on the chapter's own two-list question
    cross = cross_by_events(LEFT, RIGHT)
    reference = every_cross_pair(LEFT, RIGHT)
    assert cross == reference == [(1, 0, 130, 150), (1, 1, 220, 245)], cross
    print(f"\n  and the event sweep answers the chapter's question too: on its LEFT and RIGHT it")
    print(f"  finds {[(f'L{i}', f'R{j}', f'{lo}..{hi}') for i, j, lo, hi in cross]},")
    print(f"  which is the chapter's own answer -- so nothing was given up by abandoning the")
    print(f"  two-pointer rule except the two-pointer rule's efficiency.")

    # boundaries, each one a thing a real booking system has in it
    assert event_sweep([]) == (0, None, 0), "an empty room has no busiest moment to report"
    assert event_sweep([(5, 5)]) == (1, 5, 0), "a zero-length booking is still a booking"
    assert event_sweep([(0, 10), (11, 20)]) == (1, 0, 0), "adjacent bookings do not clash"
    assert event_sweep([(0, 10), (10, 20)]) == (2, 10, 1), "touching at one instant does"
    assert event_sweep([(0, 10), (0, 10)]) == (2, 0, 1), "identical bookings clash once"
    assert event_sweep([(0, 10)] * 4) == (4, 0, 6), "four identical bookings make 6 pairs"
    assert event_sweep([(0, 100), (10, 20), (30, 40)]) == (2, 10, 2), "nesting, not just overlap"
    print(f"\n  boundaries: [] -> {event_sweep([])} (no moment to report, not 0);  [(0,10),(11,20)] ->")
    print(f"  {event_sweep([(0, 10), (11, 20)])} (adjacent is free);  [(0,10),(10,20)] -> {event_sweep([(0, 10), (10, 20)])} (closed spans touch,")
    print(f"  so that IS a clash);  four identical bookings -> {event_sweep([(0, 10)] * 4)}, i.e. 4 choose 2 pairs")
    print(f"  from one instant -- the pair count is quadratic in the answer even when the sweep")
    print(f"  is linear in the input, which is why it is counted rather than listed.")

    # many inputs, including heavy self-overlap, against the quadratic reference
    rng = random.Random(20260303)
    overlapping_cases, clean_cases = 0, 0
    for _ in range(600):
        n = rng.randint(0, 9)
        spans = []
        for _ in range(n):
            s = rng.randint(0, 25)
            spans.append((s, s + rng.randint(0, 8)))
        spans.sort()
        want, _ = every_pair(spans)
        best_n, at_n, count_n = event_sweep(spans)
        assert count_n == len(want), (spans, count_n, len(want))
        if spans:
            lo_s = min(s for s, _ in spans)
            hi_s = max(e for _, e in spans)
            direct = max(covering(spans, t) for t in range(lo_s, hi_s + 2))
            assert best_n == direct, (spans, best_n, direct)
            assert covering(spans, at_n) == best_n, (spans, at_n)
        else:
            assert (best_n, at_n, count_n) == (0, None, 0)
        if want:
            overlapping_cases += 1
            assert best_n >= 2, (spans, best_n)
        else:
            clean_cases += 1
            assert best_n <= 1, (spans, best_n)
        # the two-pointer attempt may never beat the reference, only fall short of it
        attempt = two_pointer_against_itself(spans)
        assert all(p in want for p in attempt), (spans, attempt)
        # and the cross-list sweep against its own quadratic reference
        half = len(spans) // 2
        a, b = sorted(spans[:half]), sorted(spans[half:])
        a = [x for i, x in enumerate(a) if i == 0 or x[0] > a[i - 1][1]]
        b = [x for i, x in enumerate(b) if i == 0 or x[0] > b[i - 1][1]]
        assert cross_by_events(a, b) == every_cross_pair(a, b), (a, b)
    print(f"\n  600 random booking lists, most of them self-overlapping: the event sweep's pair")
    print(f"  count matched the quadratic answer every time and its maximum matched a direct")
    print(f"  per-instant count every time ({overlapping_cases} lists had a clash, {clean_cases} were clean).  The")
    print(f"  two-pointer attempt never reported a pair that was not real -- it only ever")
    print(f"  reported fewer, which is exactly why nobody notices it is wrong.")
    assert overlapping_cases > 0 and clean_cases > 0

    # the scale the question names
    BIG = 20_000
    big = [(i * 5, i * 5 + 7) for i in range(BIG)]       # each booking overlaps its neighbour
    marks = len(marks_of(big))
    big_best, big_at, big_pairs = event_sweep(big)
    would_compare = BIG * (BIG - 1) // 2
    print(f"\n  at {BIG:,} bookings, each overlapping the next: busiest {big_best} at t={big_at}, "
          f"{big_pairs:,} pairs,")
    print(f"  from {marks:,} marks.  The quadratic answer would need {would_compare:,} comparisons for")
    print(f"  the same result, and at the stated 10**6 bookings it would need 5 x 10**11 --")
    print(f"  while the marks stay at 2 per booking.")
    assert (big_best, big_pairs) == (2, BIG - 1), (big_best, big_pairs)
    assert marks == 2 * BIG
    assert would_compare // marks == 4_999, would_compare // marks
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
