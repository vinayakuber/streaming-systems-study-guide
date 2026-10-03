#!/usr/bin/env python3
"""Variation 4 — the deduplicated alert (looks like operations). Standalone and runnable.

  A monitor fires repeatedly while a system is unhealthy.  Group the firings into INCIDENTS --
  no gap longer than G -- and page once per incident.  Firings arrive out of order, because
  they travel through a queue.

The grouping is the chapter's, unchanged.  The PAGING is what breaks.  You must page while the
incident is still open, which means acting on a run before you know it is finished, and then a
later firing within G must not page again.  So the retraction from the chapter's trace becomes
a paging problem: when two already-paged incidents merge, somebody was paged twice for what
turned out to be one.  The useful answer is that G is now TWO decisions and not one -- how long
to wait before paging, and how long before declaring the incident over -- and they need not be
the same number.  Measured below: at this data no single pair of numbers gives both zero double
pages and a page for every incident.

WORKED EXAMPLES: the EXAMPLES table below holds 16 input/output pairs -- an empty stream, a
single firing that nobody is ever paged for, both sides of the quiet period (a gap of exactly
CLOSE_AFTER groups, one more does not), both sides of the paging delay (a span of exactly
PAGE_AFTER pages, one short of it does not), CLOSE_AFTER = 0 and PAGE_AFTER = 1000 at the two
degenerate ends, the fitted (87, 0) pair, and 1,000 generated firings.  Every row is ASSERTED
against the retrospective sweep as well as its expected answer, so the table cannot drift
from the code.

Run it:  python3 programs/ch04_v4.py
"""

import random

# The chapter's nine arrival times, unchanged, now read as monitor firings in the order the
# pager receives them.  Deliberately not sorted: 220 arrives after 260, and 50 arrives second
# to last -- and 50 is the firing that lands in the gap and bridges two incidents.
FIRINGS = [1, 3, 90, 130, 245, 260, 220, 50, 540]

# CLOSE_AFTER = 47 is the chapter's G: the quiet period after which an incident is over.  The
# chapter chose it so that 50 bridges two runs instead of extending one, which is exactly the
# case this program needs.  120 is the chapter's other gap, kept as the contrast: at 120
# nothing bridges, so the double page cannot happen at all.
CLOSE_AFTER = 47
WIDE = 120

# PAGE_AFTER = 2 minutes: how long the monitor must have been firing before a human is woken.
# Chosen because the 1..3 firings span exactly 2, so this is the smallest value at which that
# pair pages -- and therefore the smallest value at which the double page happens.
PAGE_AFTER = 2

# A single firing, the two pairs that straddle the quiet period, a repeated firing, the same
# nine in time order, and a generated stream at a scale a real monitor reaches.  These are
# inputs for the examples table, not alternative versions of the problem.
ONE_FIRING = [100]
IN_TIME_ORDER = sorted(FIRINGS)
GAP_AT_G = [0, CLOSE_AFTER]                 # 47 - 0 == CLOSE_AFTER: still ONE incident
GAP_PAST_G = [0, CLOSE_AFTER + 1]           # one minute more: two incidents
SPAN_PAIR = [0, PAGE_AFTER]                 # spans exactly PAGE_AFTER: pages at the second
REPEATED = [100, 100, 100]                  # the monitor re-fires on the same minute
BIG_N = 1_000
BIG_FIRINGS = [5 * i for i in range(BIG_N)]           # 5 minutes apart: all one incident at 47
BIG_SHUFFLED = BIG_FIRINGS[:]
random.Random(20260303).shuffle(BIG_SHUFFLED)         # ... arriving in a thoroughly shuffled queue

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, firings, page_after, close_after, (incidents, pages, double pages)).
# Every row is asserted by show_examples(), which is why the table is data and not a comment:
# a comment can go stale silently, and this cannot.
EXAMPLES = [
    ("empty stream -> no incident, no page",       [],            PAGE_AFTER, CLOSE_AFTER, (0, 0, 0)),
    ("one firing, span 0 -> NOBODY is paged",      ONE_FIRING,    PAGE_AFTER, CLOSE_AFTER, (1, 0, 0)),
    ("one firing, PAGE_AFTER 0 -> paged at once",  ONE_FIRING,    0,          CLOSE_AFTER, (1, 1, 0)),
    ("the same firing three times",                REPEATED,      0,          CLOSE_AFTER, (1, 1, 0)),
    ("a gap of exactly CLOSE_AFTER: one incident", GAP_AT_G,      0,          CLOSE_AFTER, (1, 1, 0)),
    ("a gap of CLOSE_AFTER + 1: two incidents",    GAP_PAST_G,    0,          CLOSE_AFTER, (2, 2, 0)),
    ("a span of exactly PAGE_AFTER: it pages",     SPAN_PAIR,     PAGE_AFTER, CLOSE_AFTER, (1, 1, 0)),
    ("a span one short of PAGE_AFTER: no page",    SPAN_PAIR,     PAGE_AFTER + 1, CLOSE_AFTER, (1, 0, 0)),
    ("the chapter's nine, as the pager sees them", FIRINGS,       PAGE_AFTER, CLOSE_AFTER, (3, 3, 1)),
    ("the same nine, in time order",               IN_TIME_ORDER, PAGE_AFTER, CLOSE_AFTER, (3, 2, 0)),
    ("the wide close: nothing bridges",            FIRINGS,       PAGE_AFTER, WIDE,        (2, 1, 0)),
    ("CLOSE_AFTER 0: every firing its own",        FIRINGS,       0,          0,           (9, 9, 0)),
    ("PAGE_AFTER 1000: it never alerts at all",    FIRINGS,       1000,       CLOSE_AFTER, (3, 0, 0)),
    ("the fitted pair (87, 0)",                    FIRINGS,       0,          87,          (3, 3, 0)),
    ("1,000 firings shuffled, paging at once",     BIG_SHUFFLED,  0,          CLOSE_AFTER, (1, 52, 51)),
    ("1,000 shuffled, waiting 20 minutes",         BIG_SHUFFLED,  20,         CLOSE_AFTER, (1, 34, 33)),
]


def sweep(firings, close_after):
    """The retrospective truth: sort, then walk.  These are the incidents as they will look in
    the morning, and they are only computable once every firing has arrived -- which is the
    thing a pager does not get to wait for."""
    out = []
    for t in sorted(firings):
        if out and t - out[-1][1] <= close_after:
            out[-1][1] = t
        else:
            out.append([t, t])
    return [tuple(r) for r in out]


def page_streaming(firings, page_after, close_after):
    """The pager: the chapter's `absorb`, with a page emitted while the incident is still open.

    An incident keeps the SMALLEST id of everything merged into it, so that identity survives
    a merge -- the chapter's point about stable identity, which matters most here because the
    id is what a human has already been shown.  `paged` is likewise carried through a merge
    with `any`, which is what stops a second page for an incident that has already woken
    somebody.  It cannot stop the FIRST pages from having been two.

    A double page is recorded when a firing merges two or more incidents that have both
    already paged: two humans were woken for one incident, and neither page can be recalled.

    Returns (pages, incidents, doubles), where pages are (incident_start_at_page_time,
    firing_that_triggered_it)."""
    live, pages, doubles, next_id = [], [], 0, 0
    for t in firings:
        hit = [r for r in live
               if t >= r["start"] - close_after and t <= r["end"] + close_after]
        if sum(1 for r in hit if r["paged"]) >= 2:
            doubles += 1
        if hit:
            m = {"id": min(r["id"] for r in hit),
                 "start": min([t] + [r["start"] for r in hit]),
                 "end": max([t] + [r["end"] for r in hit]),
                 "paged": any(r["paged"] for r in hit)}
            live = [r for r in live if r not in hit] + [m]
        else:
            m = {"id": next_id, "start": t, "end": t, "paged": False}
            next_id += 1
            live.append(m)
        if not m["paged"] and m["end"] - m["start"] >= page_after:
            m["paged"] = True
            pages.append((m["start"], t))
    live.sort(key=lambda r: r["start"])
    return pages, [(r["start"], r["end"]) for r in live], doubles


def coverage(pages, incidents):
    """Which retrospective incidents got at least one page, and which got more than one.

    A page belongs to the incident whose span contains the start it was sent for.  Returns
    (covered, over_paged, uncovered)."""
    counts = []
    for s, e in incidents:
        counts.append(sum(1 for ps, _ in pages if s <= ps <= e))
    covered = sum(1 for c in counts if c >= 1)
    return covered, sum(1 for c in counts if c > 1), [inc for inc, c in zip(incidents, counts) if c == 0]


def apparent_latencies(pages):
    """How long each page APPEARED to have waited at the moment it was sent: the triggering
    firing minus the incident's start as the pager knew it then.  This is the number a pager's
    own metrics would report, and it is the optimistic one."""
    return [trigger - ps for ps, trigger in pages]


def latencies(pages, incidents):
    """How long each page waited: the triggering firing minus the incident's true start.

    Measured against the RETROSPECTIVE start, because that is the moment the system actually
    became unhealthy -- which is the number a human cares about and the one a pager cannot
    know at the time."""
    out = []
    for ps, trigger in pages:
        start = next(s for s, e in incidents if s <= ps <= e)
        out.append(trigger - start)
    return out


def show_examples():
    """Print the examples table and assert every row, two independent ways.

    Every row's incidents are checked against `sweep` -- the retrospective truth, computed by
    sorting -- as well as against the expected (incidents, pages, double pages), and the
    coverage identity (paged + unpaged == incidents) and the inequality over_paged <= doubles
    are checked on every row too.

    The last two columns are the cost of the two answers, measured in the only currency that
    matters here: how many firings had to arrive first.  `paged after` is how many the pager
    had seen when it woke somebody; `sweep needs` is all of them, because a sorted walk cannot
    start until the stream has ended.  On the rows where nothing pages the streaming answer
    buys nothing at all -- a single firing with PAGE_AFTER = 2, and PAGE_AFTER = 1000, both
    say `never` -- and that is the price of the same dial that removes the double pages.
    """
    print(f"{'what it exercises':44s} {'n':>6} {'page':>5} {'close':>6} {'inc':>5} "
          f"{'pages':>6} {'dbl':>4} {'unpaged':>8} {'paged after':>12} {'sweep needs':>12}")
    for label, firings, page_after, close_after, want in EXAMPLES:
        pages, incidents, doubles = page_streaming(firings, page_after, close_after)
        covered, over, uncovered = coverage(pages, incidents)
        assert (len(incidents), len(pages), doubles) == want, (
            label, (len(incidents), len(pages), doubles), want)
        assert incidents == sweep(firings, close_after), (label, incidents)
        assert covered + len(uncovered) == len(incidents), (label, covered, uncovered)
        assert over <= doubles, (label, over, doubles)
        app, lat = apparent_latencies(pages), latencies(pages, incidents)
        assert all(t >= a for t, a in zip(lat, app)), (label, lat, app)
        seen = f"{firings.index(pages[0][1]) + 1}" if pages else "never"
        print(f"{label:44s} {len(firings):>6} {page_after:>5} {close_after:>6} "
              f"{len(incidents):>5} {len(pages):>6} {doubles:>4} {len(uncovered):>8} "
              f"{seen:>12} {len(firings):>12}")
    print(f"all {len(EXAMPLES)} examples agree with the retrospective sweep")
    print()


def main():
    show_examples()
    print(f"FIRINGS = {FIRINGS}   (sorted: {sorted(FIRINGS)})")
    print(f"CLOSE_AFTER = {CLOSE_AFTER}, PAGE_AFTER = {PAGE_AFTER}\n")
    truth = sweep(FIRINGS, CLOSE_AFTER)
    pages, incidents, doubles = page_streaming(FIRINGS, PAGE_AFTER, CLOSE_AFTER)
    assert incidents == truth, (incidents, truth)
    assert truth == [(1, 130), (220, 260), (540, 540)], truth
    print(f"  incidents, in the morning : {truth}")
    print(f"  pages actually sent       : {[p for p, _ in pages]} "
          f"(triggered by firings {[t for _, t in pages]})")
    print(f"  double pages              : {doubles}")

    covered, over, uncovered = coverage(pages, truth)
    lat = latencies(pages, truth)
    assert pages == [(1, 3), (90, 130), (245, 260)], pages
    assert doubles == 1, doubles
    assert (covered, over) == (2, 1), (covered, over)
    assert uncovered == [(540, 540)], uncovered
    # CORRECTED.  The expectation was [2, 40, 15] -- each page's wait as the pager saw it.
    # Measured against the TRUE start the middle page is 129 minutes late, not 40, because
    # firing 50 arrived afterwards and moved that incident's start from 90 back to 1.  So the
    # pager's own latency metric is optimistic by construction: it measures from a start that
    # out-of-order firings can still move backwards.
    app = apparent_latencies(pages)
    assert app == [2, 40, 15], app
    assert lat == [2, 129, 40], lat
    assert all(t >= a for t, a in zip(lat, app)), (lat, app)
    assert lat[1] - app[1] == 89 == 90 - 1, (lat[1], app[1])
    print(f"\n  so three pages were sent for three incidents, and the mapping is still wrong:")
    print(f"    incident {truth[0]} woke somebody TWICE, at {pages[0][0]} and at {pages[1][0]}, because")
    print(f"    firing 50 arrived last and bridged two incidents that had each already paged;")
    print(f"    incident {uncovered[0]} woke nobody at all, because it is a single firing and")
    print(f"    spans 0 < PAGE_AFTER = {PAGE_AFTER}.")
    print(f"  page latency as the pager measured it   : {app} (mean {sum(app) / len(app):.1f})")
    print(f"  page latency against the TRUE start     : {lat} (mean {sum(lat) / len(lat):.1f})")
    print(f"  the middle page looked like a {app[1]}-minute wait and was really {lat[1]}: firing 50 arrived")
    print(f"  afterwards and moved that incident's start from 90 back to 1.  A pager cannot")
    print(f"  measure its own lateness, because the start it measures from is still moving.")
    # the identity point: the page was sent for "the incident starting at 90", and that
    # incident no longer exists under that name
    assert 90 not in [s for s, _ in truth], "the start a page was sent for must have been lost"
    assert any(s < 90 <= e for s, e in truth), "and it must now be inside a wider incident"
    print(f"  the second page named 'the incident starting at 90'.  No such incident exists by")
    print(f"  morning -- it is inside {truth[0]} -- so the start is not a usable page identity.")

    # ---- the wide close_after: the bridge cannot happen, so neither can the double page
    wide_pages, wide_inc, wide_doubles = page_streaming(FIRINGS, PAGE_AFTER, WIDE)
    assert wide_inc == sweep(FIRINGS, WIDE) == [(1, 260), (540, 540)], wide_inc
    assert wide_doubles == 0, wide_doubles
    w_cov, w_over, w_unc = coverage(wide_pages, wide_inc)
    print(f"\n  at CLOSE_AFTER = {WIDE} (the chapter's other gap): incidents {wide_inc},")
    print(f"  pages {[p for p, _ in wide_pages]}, double pages {wide_doubles} -- nothing bridges, so")
    print(f"  nothing is paged twice.  The price is the other direction: {w_cov} of {len(wide_inc)} incidents")
    print(f"  paged, and {truth[0]} and {truth[1]} are now reported as ONE, which is a different lie.")
    assert w_cov == 1 and w_unc == [(540, 540)], (w_cov, w_unc)
    assert len(wide_inc) < len(truth), "a wider close must merge incidents a human would separate"

    # ---- the two decisions, swept
    print(f"\n  PAGE_AFTER against CLOSE_AFTER, on the same nine firings:")
    print(f"    {'close':>6} {'page':>6} {'incidents':>10} {'pages':>6} {'doubles':>8} "
          f"{'uncovered':>10} {'mean lat':>9}")
    rows = []
    for close in (CLOSE_AFTER, WIDE):
        for page_after in (0, 2, 3, 20, 100, 1000):
            ps, inc, db = page_streaming(FIRINGS, page_after, close)
            cov, ov, unc = coverage(ps, inc)
            la = latencies(ps, inc)
            rows.append((close, page_after, len(inc), len(ps), db, len(unc),
                         sum(la) / len(la) if la else 0.0))
            print(f"    {close:>6} {page_after:>6} {len(inc):>10} {len(ps):>6} {db:>8} "
                  f"{len(unc):>10} {sum(la) / len(la) if la else 0.0:>9.1f}")
    # the tradeoff, asserted: waiting longer before paging cannot increase double pages,
    # and it cannot decrease the number of incidents left unpaged
    for close in (CLOSE_AFTER, WIDE):
        same = [r for r in rows if r[0] == close]
        for a, b in zip(same, same[1:]):
            assert b[4] <= a[4], (a, b, "a longer wait must not create MORE double pages")
            assert b[5] >= a[5], (a, b, "a longer wait must not page MORE incidents")
    assert rows[0][4] == 1 and rows[0][5] == 0, rows[0]        # close 47, page 0
    assert rows[2][4] == 0 and rows[2][5] == 1, rows[2]        # close 47, page 3
    assert rows[5][3] == 0, rows[5]                            # page 1000: nothing pages at all
    print(f"  at PAGE_AFTER = 1000 nothing pages at all: zero double pages, and an alerting")
    print(f"  system that never alerts.  That is the degenerate end of the same dial.")

    # ---- is there a setting that gives everything?  Swept, not guessed.
    CLOSES, PAGES = 121, 41
    both = []
    for close in range(CLOSES):
        for page_after in range(PAGES):
            ps, inc, db = page_streaming(FIRINGS, page_after, close)
            cov, ov, unc = coverage(ps, inc)
            if db == 0 and ov == 0 and not unc and inc == truth:
                both.append((close, page_after))
    print(f"\n  swept {CLOSES * PAGES:,} (CLOSE_AFTER, PAGE_AFTER) pairs looking for one that gives the")
    print(f"  right incidents, pages every one, and pages none of them twice:")
    print(f"    {len(both)} pairs work: {both}")
    # CORRECTED.  The expectation was that none exists, from the argument that (540,540) is a
    # single firing so only PAGE_AFTER = 0 pages it, and PAGE_AFTER = 0 pages 1..3 before 50
    # arrives to bridge it.  Both halves are true and the conclusion was still wrong: three
    # values of CLOSE_AFTER escape, and they escape for a reason the argument never considered.
    assert both == [(87, 0), (88, 0), (89, 0)], both
    assert CLOSE_AFTER < 87 and all(47 <= c <= 89 for c, _ in both)
    ps0, inc0, db0 = page_streaming(FIRINGS, 0, CLOSE_AFTER)
    assert coverage(ps0, inc0)[2] == [] and db0 == 1, (ps0, db0)
    ps3, inc3, db3 = page_streaming(FIRINGS, 3, CLOSE_AFTER)
    assert db3 == 0 and coverage(ps3, inc3)[2] == [(540, 540)], (ps3, db3)
    print(f"  at CLOSE_AFTER = 87 the firing at 90 is within 87 of the firing at 3, so when 90")
    print(f"  arrives it joins the open incident instead of starting a second one -- and then")
    print(f"  there are never two paged incidents for 50 to bridge.  The window has to be wide")
    print(f"  enough to swallow the gap the late firing was going to land in.")
    print(f"  the band is {len(both)} wide out of {CLOSES}: it opens at 90 - 3 = {90 - 3}, where the bridge stops")
    print(f"  forming, and closes at 220 - 130 = {220 - 130}, where two real incidents start merging into")
    print(f"  one.  And it only works for THIS arrival order:")
    assert min(c for c, _ in both) == 90 - 3 and max(c for c, _ in both) == 220 - 130 - 1

    # the escape is fitted to one arrival order, which is the reason not to trust it
    rng0 = random.Random(11)
    broke = None
    for _ in range(500):
        order = FIRINGS[:]
        rng0.shuffle(order)
        ps, inc, db = page_streaming(order, 0, 87)
        if inc == truth and db > 0:
            broke = (order, db)
            break
    assert broke is not None, "no permutation broke the fitted pair, so the fragility is unproven"
    assert page_streaming(FIRINGS, 0, 87)[2] == 0, "the given order must be the clean one"
    print(f"    reorder the same nine firings to {broke[0]}")
    print(f"    and (87, 0) double-pages {broke[1]} time(s) again.  So the pair that worked was fitted to")
    print(f"    an arrival order nobody controls -- which is the honest answer to the question:")
    print(f"    the two numbers are a product decision about which failure you prefer, and no")
    print(f"    sweep can hand you a pair that has neither.")

    # ---- many random firing orders and parameter pairs
    rng = random.Random(20260303)
    seen_double, seen_clean, orders = 0, 0, 0
    for _ in range(600):
        n = rng.randint(1, 14)
        times = [rng.randint(0, 300) for _ in range(n)]
        close = rng.randint(0, 60)
        page_after = rng.randint(0, 40)
        ps, inc, db = page_streaming(times, page_after, close)
        # the chapter's invariant must survive the paging: grouping is unchanged
        assert inc == sweep(times, close), (times, close)
        cov, ov, unc = coverage(ps, inc)
        assert cov + len(unc) == len(inc), (times, close, page_after)
        assert ov <= db, (
            "an incident cannot be over-paged without a merge of two paged incidents")
        seen_double += db > 0
        seen_clean += db == 0
        # re-ordering the same firings must not change the incidents, only the pages
        shuffled = times[:]
        rng.shuffle(shuffled)
        ps2, inc2, db2 = page_streaming(shuffled, page_after, close)
        assert inc2 == inc, (times, shuffled, close)
        if [p for p, _ in ps2] != [p for p, _ in ps]:
            orders += 1
    print(f"\n  600 random firing streams: the incidents always equal the sorted sweep, and they")
    print(f"  are identical under re-ordering -- but the PAGES differ on {orders} of them, because the")
    print(f"  pager has to act before the order is known.  {seen_double} streams double-paged and")
    print(f"  {seen_clean} did not, so the failure is real and not universal.")
    assert seen_double > 0 and seen_clean > 0, (seen_double, seen_clean)
    assert orders > 0, "re-ordering never changed the pages, so the whole problem is invisible"

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
