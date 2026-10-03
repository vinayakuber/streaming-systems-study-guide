#!/usr/bin/env python3
"""Variation 4 -- the unavailable hours (looks like scheduling). Standalone and runnable.

  Given one person's busy spans, report their FREE spans between a start and an end.  A year of
  minutes is 525,600 of them, so the range may not be walked.

The complement rather than the intersection, and it is almost all boundary conditions: before
the first busy span, between consecutive ones, after the last, and the empty cases where
somebody is busy throughout or not at all.  There is no clever idea here and that is the
content -- a candidate who finds the chapter's two-pointer sweep elegant and then fumbles this
is showing the more relevant thing, because the gap-between-consecutive pattern is the one that
appears in working code and off-by-one at the ends is where it breaks.  What makes it worth
running is that the one pass has two unstated preconditions, SORTED and NON-OVERLAPPING, which
the chapter handed over as a promise.  Both versions that quietly assume them are written out
below, and both report time as free when the person is busy -- the one direction of error a
calendar must never have.

Run it:  python3 programs/ch09_v4.py
"""
import random

# The chapter's LEFT list as one person's busy spans -- its key 'a' sessions at a gap of 120 --
# and the chapter's own window of 0 to 600.  Spans are CLOSED: busy from 130 to 245 means minute
# 245 is busy and 246 is not.
BUSY = [(1, 3), (130, 245), (540, 540)]
START, END = 0, 600
YEAR_MINUTES = 525_600


def free_spans(busy, start, end):
    """The free spans, in one pass over the busy spans sorted by start.

    The mechanism is a cursor holding the first minute not yet accounted for.  A busy span
    beginning after the cursor exposes a gap, which is emitted as (cursor, s - 1); then the
    cursor jumps past the span's end.  `max(cursor, e + 1)` is what makes a span nested inside
    an earlier one harmless: the cursor may only ever move forward, because a minute already
    known to be busy cannot become free because a shorter span also covered it.  The tail after
    the last span is emitted outside the loop, which is the only reason the loop needs no
    special case for it.
    """
    free, cursor = [], start
    for s, e in sorted(busy):
        if e < start or s > end:
            continue                        # entirely outside the window: not our business
        if s > cursor:
            free.append((cursor, s - 1))
        cursor = max(cursor, e + 1)
    if cursor <= end:
        free.append((cursor, end))
    return free


def free_spans_forward_cursor(busy, start, end):
    """The same pass with `cursor = e + 1` in place of `max(cursor, e + 1)`.

    It is the version that gets written, because on non-overlapping spans the max is visibly
    redundant.  Give it a span NESTED inside an earlier one and the cursor moves backwards, so
    the tail is emitted from the wrong place and minutes already known to be busy are reported
    free.  The output still looks like a plausible calendar, which is the problem.
    """
    free, cursor = [], start
    for s, e in sorted(busy):
        if e < start or s > end:
            continue
        if s > cursor:
            free.append((cursor, s - 1))
        cursor = e + 1
    if cursor <= end:
        free.append((cursor, end))
    return free


def free_spans_unsorted(busy, start, end):
    """The same pass without the sort, relying on the caller's promise that the spans arrive in
    order.  A calendar merges spans from several sources, so that promise is the first thing to
    go -- and when it does, a span that arrives late is skipped entirely and its minutes are
    reported as free."""
    free, cursor = [], start
    for s, e in busy:
        if e < start or s > end:
            continue
        if s > cursor:
            free.append((cursor, s - 1))
        cursor = max(cursor, e + 1)
    if cursor <= end:
        free.append((cursor, end))
    return free


def free_by_walking(busy, start, end):
    """The reference: ask of every single minute whether it is busy, and group the runs.

    Correct, trivially, and O(end - start) -- at a year of minutes that is 525,600 questions to
    report a handful of spans, which is why it is the thing the one pass replaces and not the
    thing that ships.  It is also the only implementation here that cannot have an off-by-one,
    which is exactly what makes it the right reference.
    """
    out, run = [], None
    for t in range(start, end + 1):
        busy_now = any(s <= t <= e for s, e in busy)
        if not busy_now and run is None:
            run = t
        elif busy_now and run is not None:
            out.append((run, t - 1))
            run = None
    if run is not None:
        out.append((run, end))
    return out


def minutes(spans):
    """Total minutes covered by a list of closed, non-overlapping spans."""
    return sum(e - s + 1 for s, e in spans)


def busy_inside(busy, start, end):
    """Busy minutes inside the window, counted without double-counting an overlap -- the other
    half of the invariant that free and busy must together be the whole window."""
    covered = set()
    for s, e in busy:
        covered.update(range(max(s, start), min(e, end) + 1))
    return len(covered)


def main():
    free = free_spans(BUSY, START, END)
    walked = free_by_walking(BUSY, START, END)
    print(f"BUSY   = {BUSY}")
    print(f"window = {START}..{END}")
    print(f"  one pass        : {free}")
    print(f"  per-minute walk : {walked}   ({END - START + 1} minutes examined)")

    assert free == walked == [(0, 0), (4, 129), (246, 539), (541, 600)], free
    assert len(free) == len(BUSY) + 1, "k busy spans inside the window make at most k + 1 gaps"
    assert minutes(free) == 481 and busy_inside(BUSY, START, END) == 120
    assert minutes(free) + busy_inside(BUSY, START, END) == END - START + 1
    print(f"  {minutes(free)} free minutes + {busy_inside(BUSY, START, END)} busy minutes = {END - START + 1}, the whole window -- the two")
    print(f"  lists partition it, which is the only check that catches an off-by-one at BOTH")
    print(f"  ends at once, since a one-minute error moves a minute from one total to the other.")

    # the four shapes of gap the single pass has to produce
    print(f"\n  the gaps, in the order the pass emits them:")
    print(f"    (0, 0)      before the first busy span, and one minute long")
    print(f"    (4, 129)    between two busy spans")
    print(f"    (246, 539)  between two busy spans")
    print(f"    (541, 600)  after the last busy span, emitted outside the loop")
    assert free[0] == (START, BUSY[0][0] - 1), "the leading gap comes from the cursor's start"
    assert free[-1] == (BUSY[-1][1] + 1, END), "the trailing gap comes from the tail clause"
    assert free[0][0] == free[0][1], "a one-minute gap must survive as a span, not vanish"

    # precondition one: nothing may be nested
    nested = [(0, 100), (10, 20)]
    good = free_spans(nested, 0, 120)
    bad = free_spans_forward_cursor(nested, 0, 120)
    truth = free_by_walking(nested, 0, 120)
    print(f"\n  a meeting nested inside a longer one, {nested}, window 0..120:")
    print(f"    max(cursor, e + 1) : {good}   (correct)")
    print(f"    cursor = e + 1     : {bad}   WRONG")
    assert good == truth == [(101, 120)], good
    assert bad == [(21, 120)] and bad != truth, bad
    assert minutes(bad) > minutes(good), "the error direction is extra FREE time, every time"
    assert busy_inside(nested, 21, 100) == 80
    print(f"    the cursor moved backwards from 101 to 21, so {80} minutes the person is busy for")
    print(f"    are offered as free.  The error is one-directional: a broken complement over-")
    print(f"    reports availability, which is the failure a calendar cannot afford.")

    # precondition two: the spans must arrive in order
    out_of_order = [(130, 245), (1, 3), (540, 540)]
    sorted_ok = free_spans(out_of_order, START, END)
    unsorted_bad = free_spans_unsorted(out_of_order, START, END)
    print(f"\n  the same spans arriving out of order, {out_of_order}:")
    print(f"    with the sort    : {sorted_ok}   (correct)")
    print(f"    without the sort : {unsorted_bad}   WRONG")
    assert sorted_ok == free, "sorting makes arrival order irrelevant, which is the point"
    # MEASURED, and smaller than guessed: only the span that arrives out of order is lost.
    # The first expectation was [(0, 129), (246, 600)] -- the span at 540 swallowed as well --
    # which is wrong, because the cursor is still behind 540 when that span is read, so the
    # pass handles it correctly.  The damage is confined to the late arrival, which is why a
    # missing sort survives review: the output is right everywhere except in one span.
    assert unsorted_bad == [(0, 129), (246, 539), (541, 600)], unsorted_bad
    assert unsorted_bad != free
    assert minutes(unsorted_bad) > minutes(free), "again: too much free time, not too little"
    lost = minutes(unsorted_bad) - minutes(free)
    assert lost == 3 == minutes([BUSY[0]]), lost
    assert unsorted_bad[1:] == free[2:], "everything after the late arrival is still right"
    print(f"    the span at 1..3 arrives after the cursor has passed it and is skipped, so its {lost}")
    print(f"    busy minutes are offered as free -- and the rest of the day is still correct,")
    print(f"    which is exactly why a missing sort survives a review of the output.")

    # boundaries, every one of them a real calendar
    cases = [
        ([], 0, 10, [(0, 10)], "no meetings: the whole window"),
        ([(0, 10)], 0, 10, [], "busy throughout: nothing free, and NOT a one-span answer"),
        ([(0, 5)], 0, 10, [(6, 10)], "busy at the start"),
        ([(5, 10)], 0, 10, [(0, 4)], "busy at the end"),
        ([(-5, 20)], 0, 10, [], "a span covering the window from outside it"),
        ([(-5, 3)], 0, 10, [(4, 10)], "a span starting before the window"),
        ([(8, 20)], 0, 10, [(0, 7)], "a span ending after the window"),
        ([(20, 30)], 0, 10, [(0, 10)], "a span entirely after the window"),
        ([(-30, -20)], 0, 10, [(0, 10)], "a span entirely before it"),
        ([(0, 3), (4, 7)], 0, 10, [(8, 10)], "adjacent spans leave NO gap between them"),
        ([(0, 3), (5, 7)], 0, 10, [(4, 4), (8, 10)], "one minute between them does"),
        ([(5, 5)], 0, 10, [(0, 4), (6, 10)], "a zero-length meeting still splits the day"),
        ([(0, 10)], 5, 5, [], "a one-minute window, busy"),
        ([(0, 1)], 5, 5, [(5, 5)], "a one-minute window, free"),
    ]
    print(f"\n  boundaries:")
    for busy, lo, hi, want, label in cases:
        got = free_spans(busy, lo, hi)
        assert got == want, (busy, lo, hi, got, want)
        assert got == free_by_walking(busy, lo, hi), (busy, lo, hi)
        assert minutes(got) + busy_inside(busy, lo, hi) == hi - lo + 1, (busy, lo, hi)
        print(f"    {str(busy):<18} {lo}..{hi} -> {str(got):<22} {label}")
    assert free_spans([], 10, 5) == [], "an empty window has no free time, and is not an error"
    assert free_by_walking([], 10, 5) == []
    print(f"    {'[]':<18} 10..5 -> {str([]):<22} start after end: empty, not an error")

    # many inputs, including overlap and disorder, against the per-minute walk
    rng = random.Random(20260303)
    cursor_wrong, unsorted_wrong, overlapping = 0, 0, 0
    for _ in range(600):
        n = rng.randint(0, 7)
        busy = []
        for _ in range(n):
            s = rng.randint(-3, 30)
            busy.append((s, s + rng.randint(0, 10)))
        lo, hi = 0, rng.randint(5, 35)
        want = free_by_walking(busy, lo, hi)
        assert free_spans(busy, lo, hi) == want, (busy, lo, hi)
        assert minutes(want) + busy_inside(busy, lo, hi) == hi - lo + 1, (busy, lo, hi)
        srt = sorted(busy)
        if any(srt[i][0] <= srt[i - 1][1] for i in range(1, len(srt))):
            overlapping += 1
        if free_spans_forward_cursor(busy, lo, hi) != want:
            cursor_wrong += 1
            assert minutes(free_spans_forward_cursor(busy, lo, hi)) >= minutes(want)
        shuffled = busy[:]
        rng.shuffle(shuffled)
        if free_spans_unsorted(shuffled, lo, hi) != want:
            unsorted_wrong += 1
            assert minutes(free_spans_unsorted(shuffled, lo, hi)) >= minutes(want)
        # the gaps must never touch a busy minute, and never touch each other
        for i, (s, e) in enumerate(want):
            assert s <= e, (busy, want)
            assert not any(bs <= s <= be or bs <= e <= be for bs, be in busy), (busy, want)
            if i:
                assert s > want[i - 1][1] + 1, (busy, want)
    print(f"\n  600 random calendars ({overlapping} of them with overlapping or nested spans): the one")
    print(f"  pass matched the per-minute walk every single time, and free plus busy always came")
    print(f"  to the whole window.  The forward-cursor version was wrong on {cursor_wrong} and the unsorted")
    print(f"  version on {unsorted_wrong}, and NEITHER was ever wrong in the safe direction -- every failure")
    print(f"  reported more free time than there was.")
    assert cursor_wrong > 0 and unsorted_wrong > 0 and overlapping > 0
    assert (cursor_wrong, unsorted_wrong, overlapping) == (98, 267, 354)

    # the scale the question names: a year of minutes
    BIG_SPANS = 2_000
    big = [(i * 250 + 10, i * 250 + 70) for i in range(BIG_SPANS)]
    big_free = free_spans(big, 0, YEAR_MINUTES)
    print(f"\n  a year of {YEAR_MINUTES:,} minutes with {BIG_SPANS:,} meetings in it:")
    print(f"    one pass        : {len(big_free):,} free spans from {len(big):,} busy spans")
    print(f"    per-minute walk : would ask {YEAR_MINUTES + 1:,} questions for the same answer")
    print(f"    {(YEAR_MINUTES + 1) // len(big):,}x the work, and the gap grows with the CALENDAR'S RANGE while the")
    print(f"    pass grows with the number of MEETINGS -- which is the only reason the complement")
    print(f"    is computed from the spans at all.")
    assert len(big_free) == BIG_SPANS + 1, len(big_free)
    assert minutes(big_free) + minutes(big) == YEAR_MINUTES + 1
    assert (YEAR_MINUTES + 1) // len(big) == 262
    assert big_free[0] == (0, 9) and big_free[-1] == (big[-1][1] + 1, YEAR_MINUTES)
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
