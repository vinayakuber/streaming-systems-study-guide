#!/usr/bin/env python3
"""Variation 2 — the calendar that will not double-book (looks like scheduling). Standalone
and runnable.

  Meetings are booked and cancelled continuously.  REJECT any booking that overlaps one
  already held, and report the free gaps in the day.  A cancellation names the meeting -- in
  practice "cancel my 10:30" -- not a span.

Insertion is the chapter's `touching` with the gap set to zero, and the new operation is the
hard one: CANCELLATION SPLITS A RUN, which nothing in the chapter can do.  Merging is easy
because a merged run is determined by its two ends; splitting is not, because once two
bookings have been merged into one busy block the boundary between them is gone.  So the
stored state cannot be the merged runs at all -- it has to be the individual bookings, with
the merge computed on read.  Recognising that the chapter's state shape is only valid for an
append-only stream is the whole answer.

Run it:  python3 programs/ch04_v2.py
"""

import random

# Nine booking requests, in the order they come in.  The START times are the chapter's nine
# arrival times, unchanged and deliberately not sorted -- a calendar takes requests in
# whatever order people send them.  The durations are 30 minutes except the 90 one, which is
# 40, so that the 130 request ABUTS it exactly: that pair is the one that merges on read and
# therefore the one a merged state can no longer take apart.
REQUESTS = [(1, 31), (3, 33), (90, 130), (130, 160), (245, 275),
            (260, 290), (220, 250), (50, 80), (540, 570)]

# Minutes from 09:00 to 19:00.  Intervals are HALF-OPEN, [start, end): a 10:00-11:00 meeting
# and an 11:00-12:00 meeting do not clash, which is the only convention a human would accept
# and the one place the overlap test's comparison is visible.
DAY = (0, 600)

# The cancellation the whole file turns on: the 90-minute-mark meeting, named by its start.
CANCEL_START = 90


def clashes(members, span):
    """Every held booking the new span overlaps.  This is `touching` with the gap set to
    zero, and with half-open intervals the test is STRICT on both sides: a.start < b.end and
    b.start < a.end.  Using <= would reject back-to-back meetings, which is a calendar
    nobody would use."""
    s, e = span
    return [m for m in members if s < m[1] and m[0] < e]


def merged_view(members):
    """The busy blocks a human is shown: the held bookings, sorted and absorbed.

    Exactly the chapter's sweep with the gap at zero -- a block extends when the next
    booking starts at or before its end, so two abutting meetings become one block.  This is
    a VIEW, computed on read and thrown away, which is the whole design decision."""
    out = []
    for s, e in sorted(members):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [tuple(b) for b in out]


def free_gaps(members, day=DAY):
    """The complement of the busy blocks inside the day.  Zero-length gaps are dropped,
    because "free from 11:00 to 11:00" is not a slot anyone can book."""
    gaps, cursor = [], day[0]
    for s, e in merged_view(members):
        if s > cursor:
            gaps.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < day[1]:
        gaps.append((cursor, day[1]))
    return gaps


def run_member_calendar(ops):
    """The answer: keep the individual bookings and merge only on read.

    Insert rejects on any clash; cancel removes the one booking with that start.  Nothing is
    ever merged in the state, so nothing ever has to be unmerged.  Returns
    (accepted_flags, members)."""
    members, accepted = [], []
    for kind, arg in ops:
        if kind == "book":
            if clashes(members, arg):
                accepted.append(False)
                continue
            members.append(arg)
            accepted.append(True)
        else:
            before = len(members)
            members = [m for m in members if m[0] != arg]
            accepted.append(len(members) < before)
    return accepted, sorted(members)


def run_merged_calendar(ops, on_cancel):
    """The chapter's state shape applied where it does not belong: store the MERGED runs.

    Booking is unchanged and correct -- a clash against the merged runs is the same test,
    because the runs cover exactly the union of the members.  Cancelling is where it fails,
    and the two available guesses fail in opposite directions:

      "drop"  -- remove the whole run containing that start.  Time that another meeting still
                 holds is handed out, so two people are sent to one room.
      "keep"  -- leave the run alone, because the boundary needed to split it is gone.  The
                 freed slot is never offered to anybody, forever.

    Neither is a bug in the code; both are the only answers available from this state.
    Returns (accepted_flags, runs)."""
    runs, accepted = [], []
    for kind, arg in ops:
        if kind == "book":
            s, e = arg
            hit = [r for r in runs if s < r[1] and r[0] < e]
            if hit:
                accepted.append(False)
                continue
            touch = [r for r in runs if s <= r[1] and r[0] <= e]
            rest = [r for r in runs if r not in touch]
            lo = min([s] + [r[0] for r in touch])
            hi = max([e] + [r[1] for r in touch])
            runs = sorted(rest + [(lo, hi)])
            accepted.append(True)
        else:
            owner = [r for r in runs if r[0] <= arg < r[1]]
            if owner and on_cancel == "drop":
                runs = [r for r in runs if r not in owner]
            accepted.append(bool(owner))
    return accepted, sorted(runs)


def occupied_minutes(members, day=DAY):
    """The brute-force truth: one boolean per minute of the day.  Slow, obviously correct,
    and the only reference the rest of this file is checked against."""
    grid = [False] * (day[1] - day[0])
    for s, e in members:
        for t in range(max(s, day[0]), min(e, day[1])):
            grid[t - day[0]] = True
    return grid


def main():
    ops = [("book", r) for r in REQUESTS]
    accepted, members = run_member_calendar(ops)
    print("REQUESTS (minutes from 09:00, half-open):")
    held_so_far = []
    for (s, e), ok in zip(REQUESTS, accepted):
        # the clash is reported against the state AS IT WAS when the request arrived, not
        # against the final set -- otherwise a later booking could be blamed for an earlier
        # rejection, which is the same out-of-order confusion the chapter is about.
        hit = clashes(held_so_far, (s, e))
        assert bool(hit) != ok, ((s, e), hit, ok)
        if ok:
            held_so_far.append((s, e))
        print(f"  {s:>3}..{e:<4} {'ACCEPTED' if ok else 'REJECTED'}"
              f"{'' if ok else f'  clashes with {hit}'}")
    assert sorted(held_so_far) == members, (held_so_far, members)
    print(f"\n  held      : {members}")
    print(f"  busy view : {merged_view(members)}")
    print(f"  free gaps : {free_gaps(members)}")

    assert accepted == [True, False, True, True, True, False, False, True, True], accepted
    assert members == [(1, 31), (50, 80), (90, 130), (130, 160), (245, 275), (540, 570)], members
    assert merged_view(members) == [(1, 31), (50, 80), (90, 160), (245, 275), (540, 570)], merged_view(members)
    assert free_gaps(members) == [(0, 1), (31, 50), (80, 90), (160, 245), (275, 540), (570, 600)]
    # six accepted, three rejected -- and the rejections must be real overlaps, not abutments
    assert sum(accepted) == 6 and accepted.count(False) == 3
    assert clashes([(90, 130)], (130, 160)) == [], "back-to-back meetings must NOT clash"
    assert clashes([(90, 130)], (129, 160)) == [(90, 130)], "one minute of overlap must clash"
    assert clashes([(90, 130)], (89, 90)) == [], "ending exactly where another starts is fine"
    print(f"\n  the 90..130 and 130..160 pair abuts exactly: no clash, and the busy view shows")
    print(f"  them as ONE block 90..160, which is what a person wants to read.")

    # the brute-force check on the per-minute grid
    grid = occupied_minutes(members)
    for s, e in merged_view(members):
        assert all(grid[t] for t in range(s, e)), (s, e)
    for s, e in free_gaps(members):
        assert not any(grid[t] for t in range(s, e)), (s, e)
    assert sum(grid) == sum(e - s for s, e in members), "the blocks must cover the members exactly"
    assert sum(grid) + sum(e - s for s, e in free_gaps(members)) == DAY[1] - DAY[0]
    print(f"  per-minute grid: {sum(grid)} minutes busy + "
          f"{sum(e - s for s, e in free_gaps(members))} free = {DAY[1] - DAY[0]} in the day.")

    # ---- the cancellation, which is where the two state shapes part company
    full = ops + [("cancel", CANCEL_START)]
    acc_m, mem_after = run_member_calendar(full)
    acc_d, runs_drop = run_merged_calendar(full, "drop")
    acc_k, runs_keep = run_merged_calendar(full, "keep")
    print(f"\n  cancel the meeting starting at {CANCEL_START} (which ran to 130):")
    print(f"    members   -> busy {merged_view(mem_after)}")
    print(f"    merged/drop -> busy {runs_drop}")
    print(f"    merged/keep -> busy {runs_keep}")
    assert acc_m[-1] is True and acc_d[-1] is True and acc_k[-1] is True
    assert mem_after == [(1, 31), (50, 80), (130, 160), (245, 275), (540, 570)], mem_after
    assert merged_view(mem_after) == [(1, 31), (50, 80), (130, 160), (245, 275), (540, 570)]
    # "drop" hands out time the 130..160 meeting still holds
    assert (90, 160) not in runs_drop and (130, 160) not in runs_drop, runs_drop
    lost = [m for m in mem_after if not any(r[0] <= m[0] and m[1] <= r[1] for r in runs_drop)]
    assert lost == [(130, 160)], lost
    print(f"    drop loses {lost} from the busy view -- a meeting that was never cancelled is")
    print(f"    now bookable, so two parties are sent to one room.")
    # "keep" never offers the freed slot
    assert (90, 160) in runs_keep, runs_keep
    gaps_true = free_gaps(mem_after)
    gaps_keep = [g for g in free_gaps([(r[0], r[1]) for r in runs_keep])]
    missing = [g for g in gaps_true if g not in gaps_keep]
    assert missing == [(80, 130)], missing
    print(f"    keep never offers {missing} -- the freed 50 minutes are unbookable forever.")
    # and the consequence, as a booking anyone would try to make
    probe = (95, 125)
    assert run_member_calendar(full + [("book", probe)])[0][-1] is True
    assert run_merged_calendar(full + [("book", probe)], "keep")[0][-1] is False
    assert run_merged_calendar(full + [("book", probe)], "drop")[0][-1] is True
    print(f"    booking {probe[0]}..{probe[1]} afterwards: members ACCEPT, merged/keep REJECTS,")
    print(f"    merged/drop accepts -- and accepts it on top of the meeting it lost.")
    # the opposite outcome is forbidden: before the cancellation all three agree, so the
    # disagreement is created by the cancel and not by the bookings
    assert merged_view(members) == run_merged_calendar(ops, "keep")[1] == run_merged_calendar(ops, "drop")[1]
    assert run_merged_calendar(ops, "keep")[0] == accepted
    print(f"  before the cancellation all three states agree exactly, so it is the cancel --")
    print(f"  not the booking -- that the merged shape cannot represent.")

    # ---- a span-carrying cancel does not rescue it either
    # subtracting the exact span works here only because no two held bookings overlap; it
    # still cannot say WHICH booking a start belongs to, which is the interface people use.
    ambiguous = [("book", (90, 130)), ("book", (130, 160))]
    _, amb_runs = run_merged_calendar(ambiguous, "keep")
    assert amb_runs == [(90, 160)], amb_runs
    assert len({(90, 130), (130, 160)}) == 2
    print(f"\n  from the single run {amb_runs[0]} there is no way to tell whether the meeting at 90")
    print(f"  ends at 130 or at 160: the two bookings are {run_member_calendar(ambiguous)[1]}, and")
    print(f"  that boundary is the fact the merge deleted.")

    # ---- many random op sequences, against the per-minute grid
    rng = random.Random(20260303)
    drop_wrong = keep_wrong = cancels = 0
    for _ in range(600):
        day = (0, 60)
        held, seq = [], []
        for _ in range(rng.randint(1, 14)):
            if held and rng.random() < 0.35:
                seq.append(("cancel", rng.choice(held)[0]))
                held = [m for m in held if m[0] != seq[-1][1]]
            else:
                s = rng.randint(0, 55)
                span = (s, s + rng.randint(1, 5))
                seq.append(("book", span))
                if not [m for m in held if span[0] < m[1] and m[0] < span[1]]:
                    held.append(span)
        acc, mem = run_member_calendar(seq)
        assert sorted(held) == mem, (seq, held, mem)
        grid = occupied_minutes(mem, day)
        for s, e in merged_view(mem):
            assert all(grid[t] for t in range(s, min(e, day[1])))
        for s, e in free_gaps(mem, day):
            assert not any(grid[t] for t in range(s, e))
        if any(k == "cancel" for k, _ in seq):
            cancels += 1
            if run_merged_calendar(seq, "drop")[1] != merged_view(mem):
                drop_wrong += 1
            if run_merged_calendar(seq, "keep")[1] != merged_view(mem):
                keep_wrong += 1
    print(f"\n  600 random book/cancel sequences: the member state always matches a per-minute")
    print(f"  grid.  Of the {cancels} sequences containing a cancellation, the merged state is")
    print(f"  wrong on {drop_wrong} with 'drop' and {keep_wrong} with 'keep'.")
    assert drop_wrong > 0 and keep_wrong > 0, (drop_wrong, keep_wrong)
    # and with NO cancellations the merged state is never wrong -- append-only is its domain
    for _ in range(300):
        seq = []
        for _ in range(rng.randint(1, 10)):
            s = rng.randint(0, 55)
            seq.append(("book", (s, s + rng.randint(1, 5))))
        acc, mem = run_member_calendar(seq)
        assert run_merged_calendar(seq, "keep")[1] == merged_view(mem), seq
        assert run_merged_calendar(seq, "keep")[0] == acc, seq
    print(f"  on 300 append-only sequences it is never wrong at all, which is exactly the")
    print(f"  condition the chapter's state shape was built under.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
