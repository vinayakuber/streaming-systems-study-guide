#!/usr/bin/env python3
"""Variation 3 — the time-based window (looks like monitoring). Standalone and runnable.

  A dashboard shows the average latency over THE LAST 60 SECONDS, not the last W samples.
  Probes report whenever they feel like it, so arrivals are irregular: three may land in
  the same second and then nothing for four minutes.

Two things break.  The count stops being fixed, so "exactly one leaves when one arrives"
is false in both directions -- zero, one or many may expire -- and the divisor therefore
has to be maintained beside the total instead of being the constant W.  The subtler one is
that the answer changes WITH NO ARRIVAL AT ALL: values age out while the stream is quiet,
so a correct implementation must be able to recompute on a timer and not only on input.
That is the same clock-versus-arrival split the batching problem turns on, and a dashboard
driven only by arrivals shows a number that was true minutes ago.

WORKED EXAMPLES: the EXAMPLES table below holds 19 input/output pairs -- the instant before
the first sample and the instant of the last, an ordinary arrival, both sides of the
(now - span, now] edge on two samples exactly span apart, the arrival that retires two at
once, a quiet instant where the window is EMPTY (so the answer is None rather than 0.0), a
span of one second, a span longer than the whole stream, two probes inside the same second,
a single sample, a flat stream, and a generated 20,000-sample stream.  Each row prints the
rescan's reads beside the timer's ticks, so the rows where the timer costs more are visible.
Every row is ASSERTED twice -- the rescan and the timer-driven scan -- so the table cannot
drift from the code: change an answer and this file stops running.

Run it:  python3 programs/ch01_v3.py
"""

import random

# The chapter's nine values, now carrying the seed's nine event TIMES (in event-time
# order, which is what a time window needs) instead of positions.  Times in seconds,
# values in milliseconds.  The gaps are the seed's own and they are what makes this
# worth running: between 3 and 50 nothing expires, at 90 two expire at once, and at 540
# three do, so every case the statement names appears in one trace.
SAMPLES = [(1, 5), (3, 3), (50, 7), (90, 2), (130, 6), (220, 1), (245, 9), (260, 4), (540, 8)]

# SPAN = 60 seconds: the statement's own number.  It also happens to be the chapter's
# watermark lag, which is not a coincidence -- both are "how far back do I still care".
SPAN = 60

# W = 3, the chapter's fixed window size, kept only so the fixed-divisor mistake can be
# run with a plausible constant rather than an invented one.
W = 3

# One boundary pair, written separately because the chapter's times contain no gap of
# exactly SPAN: these two are 60 apart to the second, which is the only place the
# inclusive-or-exclusive choice is visible at all.
EDGE = [(0, 10), (60, 20)]

# Inputs for the examples table, not alternative versions of the problem: two probes that
# answer in the same second, a stream with exactly one sample, a perfectly regular flat
# stream (same value, same gap), and one GENERATED stream at the 20,000-sample scale a real
# dashboard sees, with gaps of 0, 1 or 2 seconds so that same-second ties occur throughout.
TIE_SAMPLES = [(10, 4), (10, 8), (80, 2)]
ONE_SAMPLE = [(7, 12)]
FLAT_SAMPLES = [(i * 10, 4) for i in range(7)]
_BIG_RNG = random.Random(20260303)         # seeded, so the expected values below are fixed
BIG_SAMPLES = []
_t = 0
for _ in range(20_000):
    _t += _BIG_RNG.choice([0, 1, 1, 2])
    BIG_SAMPLES.append((_t, _BIG_RNG.randint(1, 40)))

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, samples, now, span, expected (average, count)).  `now` is a CLOCK
# instant and need not be an arrival: that is the whole point of a time window, and the
# rows at 180s and 191s are instants at which nothing arrives and the answer moves anyway.
# An empty window has no average, so the expected value is None and not 0.0.  Every row is
# asserted by show_examples() against both the rescan and the timer-driven scan, which is
# why this table is data and not a comment: a comment can go stale silently, this cannot.
EXAMPLES = [
    ("before anything arrives -> None",      SAMPLES,      0,      60,     (None, 0)),
    ("the first sample's own instant",       SAMPLES,      1,      60,     (5.0, 1)),
    ("ordinary arrival, two in window",      SAMPLES,      3,      60,     (4.0, 2)),
    ("three samples in the window",          SAMPLES,      50,     60,     (5.0, 3)),
    ("the arrival that retires TWO",         SAMPLES,      90,     60,     (4.5, 2)),
    ("quiet stream, one survivor",           SAMPLES,      180,    60,     (6.0, 1)),
    ("quiet stream, window EMPTY -> None",   SAMPLES,      191,    60,     (None, 0)),
    ("the last arrival of all",              SAMPLES,      540,    60,     (8.0, 1)),
    ("far future -> None, not the last v",   SAMPLES,      10_000, 60,     (None, 0)),
    ("edge: 1s inside, t=0 still counts",    EDGE,         59,     60,     (10.0, 1)),
    ("edge: exactly span old, t=0 gone",     EDGE,         60,     60,     (20.0, 1)),
    ("span = 1s, the sample's own second",   SAMPLES,      3,      1,      (3.0, 1)),
    ("span = 1s, one second later",          SAMPLES,      4,      1,      (None, 0)),
    ("span longer than the whole stream",    SAMPLES,      540,    10_000, (5.0, 9)),
    ("two probes in the SAME second",        TIE_SAMPLES,  10,     60,     (6.0, 2)),
    ("one sample, ever",                     ONE_SAMPLE,   7,      60,     (12.0, 1)),
    ("flat stream, six identical samples",   FLAT_SAMPLES, 60,     60,     (4.0, 6)),
    ("20,000 samples, mid-stream",           BIG_SAMPLES,  10_000, 60,     (21.523076923076925, 65)),
    ("20,000 samples, past the end",         BIG_SAMPLES,  20_100, 60,     (None, 0)),
]


def window_at(samples, now, span=SPAN):
    """The reference: every sample still inside the window at clock time `now`.

    A full rescan, correct for any arrival pattern, and the only definition the rest of
    the file is checked against.  `t > now - span` is STRICT at the old end and inclusive
    at the new, so the window is the half-open interval (now - span, now]: a sample
    exactly span seconds old has just left.  The other choice is defensible; what is not
    defensible is leaving it undecided, because it changes the answer."""
    return [(t, v) for t, v in samples if now - span < t <= now]


def prefix_average_at(samples, i, span=SPAN):
    """(average, count) as reported ON the arrival of samples[i]: the window computed over
    the samples seen SO FAR, which is a prefix and not the whole list.

    It is a separate reference from average_at on purpose.  When two samples carry the
    same stamp, the first of them is reported before the second has been seen, so an
    arrival-time answer and a clock-time answer legitimately differ -- the clock-time one
    is the later, more complete view of the same instant.  Conflating the two is the same
    clock-versus-arrival confusion in miniature, and it only shows up on ties."""
    now = samples[i][0]
    win = [(t, v) for t, v in samples[:i + 1] if now - span < t <= now]
    if not win:
        return None, 0
    return sum(v for _, v in win) / len(win), len(win)


def average_at(samples, now, span=SPAN):
    """(average, count) at clock time `now`, or (None, 0) when the window is empty.

    None rather than 0.0: there is no average of no values, exactly as there is no average
    of W values before W have arrived.  Reporting 0.0 for an empty window is a dashboard
    that shows a healthy latency when the probes have stopped answering."""
    win = window_at(samples, now, span)
    if not win:
        return None, 0
    return sum(v for _, v in win) / len(win), len(win)


def incremental(samples, span=SPAN):
    """The answer: one pass, keeping the window's TOTAL and its COUNT together.

    The expiry is a `while`, not an `if`, because an arrival after a quiet stretch can
    retire many samples at once; and the divisor is len(window), which moves on its own.
    Returns [(t, avg, count, expired_here), ...] -- expired_here is reported so that the
    0/1/many claim is measured rather than asserted."""
    win, total, out = [], 0.0, []
    for t, v in samples:
        win.append((t, v))
        total += v
        gone = 0
        while win and win[0][0] <= t - span:
            total -= win.pop(0)[1]
            gone += 1
        out.append((t, total / len(win), len(win), gone))
    return out


def expire_one_per_arrival(samples, span=SPAN):
    """The appealing wrong answer, part one: assume the fixed window's invariant holds and
    retire at most ONE sample per arrival -- an `if` where the `while` belongs.

    Stale samples then stay in the total, so the average is dragged toward values that
    left minutes ago.  It is right whenever no more than one expires, which is most
    arrivals, which is what makes it survive review."""
    win, total, out = [], 0.0, []
    for t, v in samples:
        win.append((t, v))
        total += v
        if win and win[0][0] <= t - span:
            total -= win.pop(0)[1]
        out.append((t, total / len(win), len(win)))
    return out


def fixed_divisor(samples, span=SPAN, w=W):
    """The appealing wrong answer, part two: expire correctly but divide by a CONSTANT --
    here the nominal "about w probes per window" that someone wrote down once.

    The total is right and the answer is not, which is the most confusing possible
    failure: the bug is in the denominator, so the number moves correctly and sits at the
    wrong level."""
    win, total, out = [], 0.0, []
    for t, v in samples:
        win.append((t, v))
        total += v
        while win and win[0][0] <= t - span:
            total -= win.pop(0)[1]
        out.append((t, total / w, len(win)))
    return out


def arrival_driven_reading(samples, span=SPAN):
    """What a dashboard updated only on input shows at an arbitrary later instant: the
    last answer it computed, held forever.  Returns a function of `now`."""
    computed = incremental(samples, span)

    def read(now):
        last = None
        for t, avg, count, _ in computed:
            if t <= now:
                last = (avg, count)
        return last if last is not None else (None, 0)
    return read


def timer_driven_scan(samples, until, span=SPAN, tick=1):
    """What a dashboard that also recomputes on a timer shows: one incremental window
    advanced by the CLOCK, admitting arrivals as they come due and expiring by age at every
    tick whether or not anything arrived.

    This is the mechanism the statement demands, and it is deliberately written without
    reference to window_at, so that agreeing with the rescan is a check and not a tautology.
    Returns {now: (avg, count)} for every tick up to `until`.  The cost is per TICK, which
    is what correctness during a quiet stream actually costs."""
    win, total, nxt, out = [], 0.0, 0, {}
    for now in range(0, until + 1, tick):
        while nxt < len(samples) and samples[nxt][0] <= now:
            win.append(samples[nxt])
            total += samples[nxt][1]
            nxt += 1
        while win and win[0][0] <= now - span:
            total -= win.pop(0)[1]
        out[now] = (total / len(win) if win else None, len(win))
    return out


def show_examples():
    """Print the examples table and assert every row.

    Each row is checked TWO ways: the rescan (average_at, which re-reads every sample) and
    the timer-driven scan (one incremental window advanced by the clock), which is written
    without reference to the rescan, so agreement is a check and not a tautology.  The two
    costs are printed side by side -- the rescan's reads against the timer's ticks.  The
    tick column counts ticks at THIS row's tick size (1s up to 1000s, 100s beyond, which is
    exact at `now` because every tick admits all due arrivals and expires everything old
    enough), and the quiet rows are where the timer loses: 101 ticks at a 100s tick, or
    10,001 at a 1s one, to hold an answer a 9-sample rescan reproduces in 9 reads.
    """
    print(f"{'what it exercises':37s} {'now':>7} {'span':>7} {'n':>6} {'average':>10} "
          f"{'count':>6} {'reads':>7} {'ticks':>7}")
    for label, samples, now, span, want in EXAMPLES:
        avg, count = average_at(samples, now, span)
        tick = 1 if now <= 1000 else 100          # coarser ticks past a quiet stretch
        assert now % tick == 0, (label, now, tick)
        scan_avg, scan_count = timer_driven_scan(samples, now, span, tick)[now]
        want_avg, want_count = want
        assert count == want_count, (label, count, want_count)
        assert (avg is None) == (want_avg is None), (label, avg, want_avg)
        assert avg is None or abs(avg - want_avg) <= 1e-9 * max(1.0, abs(want_avg)), (
            label, avg, want_avg)
        assert scan_count == want_count, (label, 'the timer scan disagrees', scan_count)
        assert (scan_avg is None and avg is None) or abs(scan_avg - avg) < 1e-9, (
            label, 'the timer scan disagrees', scan_avg, avg)
        shown = 'None' if avg is None else f"{avg:.3f}"
        print(f"{label:37s} {now:>7} {span:>7} {len(samples):>6} {shown:>10} "
              f"{count:>6} {len(samples):>7} {now // tick + 1:>7}")
    print(f"all {len(EXAMPLES)} examples agree with the rescan and the timer-driven scan")
    print()


def main():
    show_examples()
    print(f"SAMPLES (t seconds, v ms) = {SAMPLES}")
    print(f"SPAN = {SPAN}s   window = (now - {SPAN}, now]\n")

    fast = incremental(SAMPLES)
    for i, (t, avg, count, gone) in enumerate(fast):
        ref_avg, ref_count = prefix_average_at(SAMPLES, i)
        assert count == ref_count and abs(avg - ref_avg) < 1e-12, (t, avg, ref_avg)
        # these nine stamps are all distinct, so the clock view agrees here as well
        assert average_at(SAMPLES, t) == (ref_avg, ref_count), t
        win = [v for _, v in window_at(SAMPLES, t)]
        print(f"  t={t:>3}s  window {str(win):<14} count {count}  avg {avg:>6.3f}   "
              f"expired here: {gone}")

    counts = [c for _, _, c, _ in fast]
    expiries = [g for *_, g in fast]
    print(f"\n  counts   : {counts}")
    print(f"  expiries : {expiries}")
    assert counts == [1, 2, 3, 2, 2, 1, 2, 3, 1], counts
    assert expiries == [0, 0, 0, 2, 1, 2, 0, 0, 3], expiries
    # the invariant the fixed window relies on is false in BOTH directions here
    assert 0 in expiries, "nothing ever arrives without something leaving"
    assert 1 in expiries, "no arrival ever retires exactly one, so the easy case is absent"
    assert max(expiries) == 3, f"the biggest single expiry was {max(expiries)}"
    assert min(counts) < max(counts), "the count must rise AND fall or the divisor is constant"
    assert sum(expiries) == len(SAMPLES) - counts[-1], (
        "every sample must either have expired or still be in the final window")
    print(f"  the count rises to {max(counts)} and falls to {min(counts)}; one arrival retires {max(expiries)}")
    print(f"  samples at once and another retires none -- so 'one in, one out' is false both ways.")

    # ---- the two wrong answers, run
    one = expire_one_per_arrival(SAMPLES)
    fix = fixed_divisor(SAMPLES)
    bad_one = [(t, a, c) for (t, a, c), (_, ra, rc, _) in zip(one, fast) if abs(a - ra) > 1e-12]
    bad_fix = [(t, a) for (t, a, _), (_, ra, _, _) in zip(fix, fast) if abs(a - ra) > 1e-12]
    print(f"\n  one-expiry-per-arrival is wrong at t = {[t for t, _, _ in bad_one]}")
    for t, a, c in bad_one:
        ra, rc = average_at(SAMPLES, t)
        print(f"    t={t:>3}s reports {a:.3f} over {c} samples; the truth is {ra:.3f} over {rc}")
    # CORRECTED, twice.  The first expectation was that it is wrong only at the three
    # arrivals where two or more expire -- 90, 220, 540.  Measured: it is wrong at FIVE,
    # including 130 and 245 where only one sample was due to leave.  The reason is that the
    # error does not heal: once an arrival retires one of the two it owed, each later
    # arrival adds one and retires one, so the backlog is carried forever and the count
    # pins at 3.  The second wrong expectation was the DIRECTION -- stale samples do not
    # reliably drag the average up: at t=90 it reads 4.000 against 4.500 and at t=130 it
    # reads 5.000 against 4.000.  Whether the error is high or low depends on the stale
    # values, so there is no safe side to err on.
    assert [t for t, _, _ in bad_one] == [90, 130, 220, 245, 540], bad_one
    assert one[3][1] < fast[3][1] and one[4][1] > fast[4][1], "the error must go BOTH ways"
    assert [c for _, _, c in one[3:]] == [3, 3, 3, 3, 3, 3], (
        "once behind, the count must pin at the first stale size and never recover")
    assert all(g <= 1 for g in expiries[4:5]) and abs(one[4][1] - fast[4][1]) > 1e-12, (
        "t=130 owed only one expiry and is still wrong, which is the carried backlog")
    # the opposite outcome exists too, and it is the dangerous one: at t=260 the stale
    # window happens to hold exactly the right three samples, so the bug reports the
    # correct answer and nothing is visible at that arrival at all.
    assert abs(one[7][1] - fast[7][1]) < 1e-12 and one[7][2] == fast[7][2] == 3
    assert all(abs(a - ra) < 1e-12 for (_, a, _), (_, ra, _, _) in zip(one[:3], fast[:3]))
    print(f"  ...right at the first 3 arrivals, where nothing had expired yet, and right again")
    print(f"  at t=260 BY ACCIDENT -- the stale window happens to hold the correct three samples.")
    assert len(bad_fix) == sum(1 for c in counts if c != W), bad_fix
    print(f"  the fixed divisor {W} is wrong at {len(bad_fix)} of {len(SAMPLES)} arrivals -- right only when the")
    print(f"  live count happens to equal {W}, which it does {counts.count(W)} times.")

    # ---- the answer changes with no arrival at all
    quiet = arrival_driven_reading(SAMPLES)
    timed = timer_driven_scan(SAMPLES, 10_000)
    print(f"\n  nothing arrives between t=130 and t=220, and the answer moves anyway:")
    for now in (130, 180, 191, 219):
        truth, tc = average_at(SAMPLES, now)
        held, hc = quiet(now)
        shown = "NONE" if truth is None else f"{truth:.3f}"
        print(f"    now={now:>3}s  truth {shown:>6} over {tc} samples;  "
              f"arrival-driven dashboard still shows {held:.3f} over {hc}")
        assert timed[now] == (truth, tc), (now, timed[now])
    assert average_at(SAMPLES, 130)[1] == 2 and average_at(SAMPLES, 180)[1] == 1
    assert average_at(SAMPLES, 191) == (None, 0), average_at(SAMPLES, 191)
    assert quiet(191) == quiet(130) == (4.0, 2), (quiet(191), quiet(130))
    assert average_at(SAMPLES, 180)[0] == 6.0, "the single surviving sample is the 6ms one"
    # the last arrival is the worst case: the dashboard holds 8.0 forever
    assert quiet(10_000) == (8.0, 1) and average_at(SAMPLES, 10_000) == (None, 0)
    assert timed[10_000] == (None, 0), timed[10_000]
    assert timed[600] == (None, 0) and timed[540] == (8.0, 1), (timed[600], timed[540])
    print(f"    now=10000s truth   NONE over 0 samples;  arrival-driven still shows 8.000 over 1")
    print(f"  so the quiet-stream error is unbounded in TIME, not in value: the number is simply old.")

    # ---- the boundary the window definition decides
    inc = [(t, v) for t, v in EDGE if 60 - SPAN <= t <= 60]
    exc = window_at(EDGE, 60)
    print(f"\n  two samples exactly {SPAN}s apart, {EDGE}, read at now={EDGE[1][0]}:")
    print(f"    (now-{SPAN}, now] keeps {exc} -> avg {average_at(EDGE, 60)[0]}")
    print(f"    [now-{SPAN}, now] keeps {inc} -> avg {sum(v for _, v in inc) / len(inc)}")
    assert exc == [(60, 20)] and average_at(EDGE, 60) == (20.0, 1)
    assert inc == EDGE and sum(v for _, v in inc) / len(inc) == 15.0
    assert average_at(EDGE, 60)[0] != 15.0, "the two conventions must actually differ here"
    print(f"    {20.0} against {15.0} on the same two samples -- a 25% difference decided by one `<`.")

    # ---- two samples in the SAME second: the arrival view and the clock view differ
    TIE = [(10, 4), (10, 8), (80, 2)]      # two probes answer within the same second
    assert prefix_average_at(TIE, 0) == (4.0, 1), prefix_average_at(TIE, 0)
    assert prefix_average_at(TIE, 1) == (6.0, 2), prefix_average_at(TIE, 1)
    assert average_at(TIE, 10) == (6.0, 2), "the clock view at t=10 sees both"
    assert prefix_average_at(TIE, 0) != average_at(TIE, 10), (
        "on a tie the arrival answer and the clock answer must be allowed to differ")
    print(f"\n  two probes reporting in the same second, {TIE[:2]}:")
    print(f"    on the first arrival the dashboard can only say {prefix_average_at(TIE, 0)[0]} over 1 sample;")
    print(f"    the clock at t=10 says {average_at(TIE, 10)[0]} over 2 -- the same instant, a later view of it.")
    print(f"  so 'the average at time t' is two different questions, and only ties expose it.")

    # ---- many irregular streams, against the rescan
    rng = random.Random(20260303)
    disagreements = 0
    for _ in range(600):
        n = rng.randint(1, 18)
        t = 0
        samples = []
        for _ in range(n):
            t += rng.choice([0, 0, 1, 5, 30, 59, 60, 61, 200])
            samples.append((t, rng.randint(1, 40)))
        span = rng.choice([1, 10, 60, 120])
        got = incremental(samples, span)
        for i, (gt, ga, gc, _) in enumerate(got):
            ra, rc = prefix_average_at(samples, i, span)
            assert gc == rc and abs(ga - ra) < 1e-9, (samples, span, gt, ga, ra)
        until = samples[-1][0] + span + 2
        scan = timer_driven_scan(samples, until, span)
        for now in (0, until, rng.randint(0, until)):
            ra, rc = average_at(samples, now, span)
            got_a, got_c = scan[now]
            assert got_c == rc and ((got_a is None and ra is None)
                                    or abs(got_a - ra) < 1e-9), (samples, span, now)
        if any(abs(a - ra) > 1e-9 for (_, a, _), (_, ra, _, _) in
               zip(expire_one_per_arrival(samples, span), got)):
            disagreements += 1
    print(f"\n  600 irregular streams x 4 spans: the incremental total+count equals the rescan at")
    print(f"  every arrival and at every probed clock instant; the one-expiry version differs on")
    print(f"  {disagreements} of 600, which is how often a stream has a gap big enough to retire two.")
    assert disagreements > 100, f"only {disagreements} streams exposed the one-expiry bug"

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
