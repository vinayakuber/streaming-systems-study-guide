#!/usr/bin/env python3
"""Runs separated by a gap, built as the times arrive out of order.

A door log gives one person's entry times.  A VISIT is a run of entries with no
gap longer than G.  The times arrive OUT OF ORDER and they keep arriving, so
there is no moment at which you may sort them -- and the visits must be reported
after each arrival.  10^6 entries.

The case the out-of-order clause exists for: one late time can land in the gap
that was keeping two visits apart, so it joins BOTH of them, and two visits that
were already reported stop existing.

Run it:  python3 programs/ch04.py
"""
import random

# Data, from tools/gen_ch04_interview.js over tools/stream_seed.js.
# ARRIVALS: every event time in the log, in the order the pipeline sees them (the
# seed's processing order).  Deliberately not sorted: 220 arrives after 260, and
# 50 arrives next to last.
ARRIVALS = [1, 3, 90, 130, 245, 260, 220, 50, 540]
# G = 47 is a DECLARED parameter of this problem, not the chapter's gap of 120.
# The generator says why, and it is worth repeating: at 120 every arrival in this
# log joins at most ONE run, so the merge this program exists to show would never
# happen.  G belongs to the QUESTION (a product decision about what counts as one
# visit), so fixing it here chooses the example's parameter, not its data.  At 47
# the seed's deliberately LATE event (50) is the one that bridges two runs.
G = 47
N = len(ARRIVALS)

def ascending(times):
    """A sorted copy.  Named because the batch answer is built on it."""
    return sorted(times)

def sweep(times, g=G):
    """The batch answer: sort, then walk.  Each time extends the last run or starts
    a new one, decided by one comparison.  O(n log n) + O(n) -- and correct only
    once every time has arrived, which the question says will not happen."""
    out = []
    for t in ascending(times):
        if out and t - out[-1][1] <= g:
            out[-1][1] = t                     # set_end
        else:
            out.append([t, t])
    return [tuple(r) for r in out]

def touching(runs, t, g=G):
    """Every run the time t could join: one whose end is within g before t, or whose
    start is within g after it.  Two comparisons against a run's ENDS, not against
    its members -- and it returns a LIST, because there may be several."""
    return [r for r in runs if t >= r[0] - g and t <= r[1] + g]

def absorb(runs, t, g=G):
    """Replace every touched run, and t, with ONE run spanning all of them.

    Taking the smallest start and the largest end over all touched runs plus t
    handles one, two or ten of them in the same two lines.  An implementation that
    stops at the FIRST match widens one run and leaves the other, so two runs then
    claim overlapping time -- plausible output, wrong totals."""
    hit = touching(runs, t, g)
    rest = [r for r in runs if r not in hit]
    lo = min([t] + [r[0] for r in hit])
    hi = max([t] + [r[1] for r in hit])
    return sorted(rest + [(lo, hi)]), hit

def withdrawn(before, after):
    """Runs the consumer was shown that no longer exist.  Not extended: GONE,
    replaced by one run spanning both.  Nothing can un-send a report, so the
    output cannot be a stream of appends -- it has to be revisable."""
    return [r for r in before if r not in after]

def incremental(times, g=G):
    """The streaming answer: absorb each arrival in turn, recording what the
    consumer would have to be told at each step."""
    runs, trace = [], []
    for t in times:
        before = runs
        runs, hit = absorb(runs, t, g)
        act = "MERGE" if len(hit) >= 2 else "extend" if len(hit) == 1 else "new"
        trace.append({"t": t, "act": act, "hit": hit, "runs": runs,
                      "gone": withdrawn(before, runs)})
    return runs, trace

# The three variations.

def the_calendar_that_will_not_double_book(ops):
    """Variation 1, surface: scheduling.  Reject bookings that overlap; report gaps.

    Non-obvious point: insertion is `touching` with g = 0, and CANCELLATION is the
    operation nothing above can do -- merging is easy because a merged run is
    determined by its ends, and splitting is not, because the information needed
    to separate two merged bookings is gone.  So the stored state cannot be the
    merged runs at all: it must be the individual bookings, with the merge
    computed on read.

    `ops` is [("book"|"cancel", (start, end)), ...].  Returns (accepted, members).
    """
    members, accepted = [], []
    for kind, span in ops:
        if kind == "book":
            clash = [m for m in members if span[0] <= m[1] and m[0] <= span[1]]
            if clash:
                accepted.append(False)
                continue
            members.append(span)
            accepted.append(True)
        else:
            members = [m for m in members if m != span]
            accepted.append(True)
    return accepted, sorted(members)

def the_island_count(positions):
    """Variation 2, surface: puzzles.  Positions turn on in any order; after each,
    how many contiguous stretches are on?

    Non-obvious point: the question asked only for a COUNT, and that buys a much
    better answer -- a new position can join at most TWO stretches, so the count
    moves by exactly +1, 0 or -1 and nothing has to be searched.  A map from a
    stretch's endpoints to its length is enough: O(1) per position, with no
    interval structure at all.  The two-run merge in the main trace is the -1 case.
    """
    length, count, out = {}, 0, []
    on = set()
    for p in positions:
        if p in on:
            out.append(count)
            continue
        on.add(p)
        left = length.get(p - 1, 0)
        right = length.get(p + 1, 0)
        count += 1 - (1 if left else 0) - (1 if right else 0)
        total = left + 1 + right
        lo, hi = p - left, p + right
        length[lo] = length[hi] = total
        out.append(count)
    return out

def the_deduplicated_alert(firings, page_after, close_after):
    """Variation 3, surface: operations.  Group firings into incidents and page once.

    Non-obvious point: you must page while an incident is still OPEN -- acting on a
    run before knowing it is finished -- so the withdrawal in the main trace becomes
    a page that should not have been sent: when two already-paged incidents merge,
    somebody was paged twice for what turned out to be one.  The useful answer is
    that G is two decisions, not one: how long to wait before paging, and how long
    before declaring the incident over, and they need not be the same number.

    `absorb` is reused unchanged, with close_after as its gap.  Identity is a minted
    id carried through every merge, which is the main trace's other lesson.
    Returns (pages, incidents, double_pages).
    """
    live, pages, doubles, next_id = [], [], 0, 0
    for t in firings:
        hit = [r for r in live if t >= r["start"] - close_after and t <= r["end"] + close_after]
        if sum(1 for r in hit if r["paged"]) >= 2:
            doubles += 1                        # two pages, one incident
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
            pages.append(m["start"])
    live.sort(key=lambda r: r["start"])
    return pages, [(r["start"], r["end"]) for r in live], doubles

def main():
    print(f"ARRIVALS = {ARRIVALS}   (sorted: {ascending(ARRIVALS)})   G = {G}")
    batch = sweep(ARRIVALS)
    final, trace = incremental(ARRIVALS)
    for s in trace:
        hit = " ".join(f"{a}..{b}" for a, b in s["hit"]) or "-"
        runs = "  ".join(f"{a}..{b}" for a, b in s["runs"])
        gone = " ".join(f"{a}..{b}" for a, b in s["gone"]) or "-"
        print(f"  {s['t']:>3}  {s['act']:<6} touches [{hit}]  ->  {runs}   withdrawn: {gone}")
    print(f"\n  sorted sweep : {batch}")
    print(f"  incremental  : {final}")

    assert final == batch, f"incremental {final} != batch {batch}"
    assert final == [(1, 130), (220, 260), (540, 540)], f"measured {final}"
    assert any(ARRIVALS[i] < ARRIVALS[i - 1] for i in range(1, N)), "the arrivals are in order"
    assert len(batch) > 1, "everything collapsed into one run, so the gap does nothing"

    merges = [s for s in trace if s["act"] == "MERGE"]
    exts = [s for s in trace if s["act"] == "extend"]
    news = [s for s in trace if s["act"] == "new"]
    retracted = sum(len(s["gone"]) for s in trace)
    assert len(merges) == 1 and merges[0]["t"] == 50, f"merges {[s['t'] for s in merges]}"
    assert merges[0]["hit"] == [(1, 3), (90, 130)], merges[0]["hit"]
    assert len(merges[0]["gone"]) == 2, "the merging arrival must remove two runs"
    assert len(exts) == 4 and len(news) == 4, f"{len(exts)} extends, {len(news)} new"
    # MEASURED 6, which is more than the merge alone: every `extend` also withdraws
    # the run it widened, because a run is identified by its ENDS and both moved.
    assert retracted == 6, f"measured {retracted} withdrawn runs"
    # a run acquires an EARLIER start -- so "the run beginning at 245" is not a name
    # that survives, which rules out keying the output on the start
    backwards = [(g, r) for s in trace for g in s["gone"] for r in final
                 if r[1] == g[1] and r[0] < g[0]]
    # MEASURED two of them, not the one first expected: 245..260 became 220..260 when
    # 220 arrived, AND 90..130 became 1..130 when the merge took the earlier start.
    assert backwards == [((245, 260), (220, 260)), ((90, 130), (1, 130))], backwards
    print(f"\n  {retracted} runs withdrawn; {backwards[0][0][0]}..{backwards[0][0][1]} later became "
          f"{backwards[0][1][0]}..{backwards[0][1][1]} -- an EARLIER start, so the start is not a key")

    # the opposite outcome is forbidden too: at the chapter's own gap of 120 the
    # merge does NOT happen, which is why G is declared rather than inherited
    _, t120 = incremental(ARRIVALS, 120)
    assert not [s for s in t120 if s["act"] == "MERGE"], "at G = 120 nothing may join two runs"
    assert incremental(ARRIVALS, 120)[0] == sweep(ARRIVALS, 120)
    print(f"  at the chapter's G = 120: 0 merges, runs {sweep(ARRIVALS, 120)}")

    # variations
    ok, members = the_calendar_that_will_not_double_book(
        [("book", (0, 10)), ("book", (5, 15)), ("book", (11, 20)),
         ("cancel", (0, 10)), ("book", (5, 9))])
    assert ok == [True, False, True, True, True], ok
    assert members == [(5, 9), (11, 20)], members
    # and the point: a merged-run state could not have produced that last booking,
    # because cancelling 0..10 out of a merged 0..20 is not expressible
    assert sweep([0, 10, 11, 20], 1) == [(0, 0), (10, 11), (20, 20)]
    print(f"\n  calendar: accepted {ok}, members {members}")

    islands = the_island_count([5, 7, 6, 1, 2, 3])
    assert islands == [1, 2, 1, 2, 2, 2], islands
    assert the_island_count([1, 2, 3]) == [1, 1, 1], "adjacent positions must not add islands"
    assert the_island_count([1, 3, 5]) == [1, 2, 3], "isolated positions must each add one"
    print(f"  islands : {islands}  (position 6 joins TWO stretches: the -1 case)")

    pages, incidents, doubles = the_deduplicated_alert(
        [0, 5, 10, 300, 305], page_after=5, close_after=47)
    assert incidents == [(0, 10), (300, 305)], incidents
    assert pages == [0, 300] and doubles == 0, (pages, doubles)
    # the firing that arrives late and bridges two ALREADY-PAGED incidents: two pages
    # were sent for what turns out to be one incident, and neither can be un-sent
    late_pages, late_inc, late_dbl = the_deduplicated_alert([0, 5, 90, 95, 50], 5, 47)
    assert late_inc == [(0, 95)] and late_pages == [0, 90] and late_dbl == 1, (late_inc, late_pages, late_dbl)
    print(f"  alerts  : incidents {incidents}, paged at {pages}, double pages {doubles}")
    print(f"            one late firing at 50: {late_inc} after paging at {late_pages} -> {late_dbl} double page")

    # brute force over many inputs: the incremental answer must equal the sorted sweep
    rng = random.Random(20260303)
    merge_seen = 0
    for _ in range(800):
        g = rng.randint(0, 30)
        times = [rng.randint(0, 120) for _ in range(rng.randint(1, 14))]
        runs, tr = incremental(times, g)
        assert runs == sweep(times, g), (times, g)
        merge_seen += sum(1 for s in tr if s["act"] == "MERGE")
        on = sorted(set(times))
        want, cnt, seen = [], 0, set()
        for p in times:                       # naive island count: rescan the set
            seen.add(p)
            cnt = sum(1 for q in sorted(seen) if q - 1 not in seen)
            want.append(cnt)
        assert the_island_count(times) == want, times
    assert merge_seen > 0, "no random case merged, so the hard path was never retested"
    print(f"\n  800 random (times, G) pairs: incremental == sorted sweep ({merge_seen} merges")
    print("  among them), and the island count == a naive rescan of the set.")
    print("\nall assertions passed")

if __name__ == "__main__":
    main()
