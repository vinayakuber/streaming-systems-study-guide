#!/usr/bin/env python3
"""Variation 2 -- the unique-visitor count (looks like analytics). Standalone and runnable.

  Page views arrive forever, each carrying a visitor id.  Report how many DISTINCT visitors
  were seen today.  10**9 views a day, tens of millions of visitors.

  The chapter's answer -- one accumulator per key, with an expiry to bound it -- does not
  survive the word "distinct".

The chapter's bound works because a sum is ONE NUMBER: a key's accumulator is the same size
after a billion events as after one.  A distinct count is not one number -- to know whether
this visitor is new you must have kept the visitors -- so the state is the CARDINALITY, which
is the quantity you were asked to measure and therefore the one you cannot assume is small.
The expiry does not rescue it either, and fails in the opposite direction from the chapter's:
there a dropped accumulator UNDERSTATED a total, here a dropped visitor is recounted and
OVERSTATES the distinct count.  The way out is to stop being exact: a sketch answers "how
many distinct" in a fixed few kilobytes at any cardinality, with a small, measurable error.

Run it:  python3 programs/ch07_v2.py
"""
import hashlib
import random
from bisect import insort

# The chapter's nine seed events with the value column dropped -- what is left is a view log:
# (visitor, event_time).  Two visitors, nine views, so the gap between "views" and "visitors"
# is 9 vs 2 and a wrong answer can be attributed.  Visitor 'a' is silent from t=245 to t=540,
# which is the chapter's longest gap of 295 and is what an expiry gets wrong.
VIEWS = [("a", 1), ("a", 3), ("b", 50), ("b", 90), ("a", 130),
         ("b", 220), ("a", 245), ("b", 260), ("a", 540)]
TRUE_DISTINCT = 2
DAY = 86_400           # the window the question names: distinct per DAY
K = 256                # the sketch's size, in retained hash values
INFINITY = float("inf")


def exact_distinct(views):
    """The correct answer, and the one that cannot be afforded: keep every visitor.

    The state is one slot per DISTINCT visitor, so it is set by the answer's own size.  At
    tens of millions of visitors this is tens of millions of slots per day, per counter, and
    there is no constant to tune: the thing that makes it big is the thing being measured.
    Returns (count, slots_held).
    """
    seen = set()
    for v, _ in views:
        seen.add(v)
    return len(seen), len(seen)


def count_the_views(views):
    """The answer that arrives first because it is the chapter's: one accumulator, +1 per
    event.  It is a perfectly good counter of VIEWS, which is a different question, and the
    inflation is the average views per visitor -- invisible unless somebody checks."""
    total = 0
    for _ in views:
        total += 1
    return total


def distinct_with_expiry(views, ttl):
    """Exact counting with the chapter's bound bolted on: increment when the visitor is not
    in the set, and drop any visitor untouched for longer than `ttl`.

    This is the chapter's `dropStale` doing exactly what it did there, and the failure has
    the OPPOSITE SIGN.  A visitor dropped a moment ago is indistinguishable from one never
    seen, so when they come back they are counted again -- the count can only rise above the
    truth, never fall below it.  Returns (count, max_slots_held, recounts).
    """
    seen, last = set(), {}
    count, high_water, recounts = 0, 0, 0
    ever = set()
    for v, t in views:
        for old in [k for k in seen if t - last[k] > ttl]:
            seen.discard(old)
            del last[old]
        if v not in seen:
            count += 1
            if v in ever:
                recounts += 1
            seen.add(v)
        ever.add(v)
        last[v] = t
        high_water = max(high_water, len(seen))
    return count, high_water, recounts


def hashed(visitor):
    """A visitor id to a number in [0, 1).  sha1 so the result is identical on every run and
    on every machine -- the sketch's error must be reproducible or it cannot be asserted."""
    return int(hashlib.sha1(str(visitor).encode()).hexdigest()[:16], 16) / float(1 << 64)


def kmv_sketch(views, k=K):
    """A k-minimum-values sketch: keep the k SMALLEST distinct hashes and nothing else.

    The mechanism is that hashing spreads n distinct visitors evenly over [0, 1), so the
    k-th smallest hash lands near k/n.  Reading that backwards, n is about k divided by the
    k-th smallest hash -- (k-1)/h is the unbiased form.  Repeats hash to a value already
    held, so they change nothing, which is why no visitor has to be remembered.  The state is
    k slots whatever the cardinality, so the memory question is answered once and for all.
    Returns (estimate, slots_held).
    """
    mins, held = [], set()
    for v, _ in views:
        h = hashed(v)
        if h in held:
            continue
        if len(mins) < k:
            insort(mins, h)
            held.add(h)
        elif h < mins[-1]:
            held.discard(mins.pop())
            insort(mins, h)
            held.add(h)
    if len(mins) < k:
        return len(mins), len(mins)          # fewer than k distinct: the sketch IS the set
    return int((k - 1) / mins[-1]), len(mins)


def held_at(views, ttl, t):
    """How many visitors an expiring set holds at moment t, if no view arrives then.  The
    end-of-run count is the wrong measurement, because an expiry is immediately followed by
    the view that re-creates the entry; observing a quiet moment shows it."""
    last = {}
    for v, at in views:
        if at <= t:
            last[v] = at
    return sum(1 for v in last if t - last[v] <= ttl)


def stream_of(cardinality, repeats, seed=20260303):
    """A day of views with a known number of distinct visitors, shuffled so arrival order
    carries no information.  Seeded, so every number printed below is reproducible."""
    rng = random.Random(seed)
    views = [(f"visitor{i}", 0) for i in range(cardinality)] * repeats
    rng.shuffle(views)
    return views


def main():
    print("VIEWS =", "  ".join(f"{v}@{t}" for v, t in VIEWS), f"   ({len(VIEWS)} views)")
    distinct, slots = exact_distinct(VIEWS)
    views_count = count_the_views(VIEWS)
    print(f"  distinct visitors      : {distinct}   ({slots} slots held)")
    print(f"  +1 per event           : {views_count}   (1 slot held -- and the wrong question)")
    assert (distinct, slots) == (TRUE_DISTINCT, TRUE_DISTINCT)
    assert views_count == len(VIEWS) == 9
    assert views_count / distinct == 4.5, "the inflation is the views per visitor"
    print(f"  the chapter's accumulator inflates the answer {views_count / distinct:.1f}x here, and the")
    print(f"  factor is the average views per visitor -- a number nobody reports, so the error")
    print(f"  is not visible in the output at all.")

    # the chapter's bound, applied here: it fails upward
    gap = 540 - 245                      # visitor 'a' is silent for the chapter's 295
    tight, tight_slots, recounts = distinct_with_expiry(VIEWS, gap - 1)
    safe, safe_slots, safe_recounts = distinct_with_expiry(VIEWS, gap)
    print(f"\n  ttl = {gap} (the longest silence) : {safe} distinct, {safe_recounts} recounts  (correct)")
    print(f"  ttl = {gap - 1}                      : {tight} distinct, {recounts} recount   OVERSTATED")
    assert safe == TRUE_DISTINCT and safe_recounts == 0
    assert tight == 3 and recounts == 1, (tight, recounts)
    assert tight > TRUE_DISTINCT, "a dropped visitor is recounted, so the count can only rise"
    assert tight != TRUE_DISTINCT - 1, "and it must NOT understate -- that is the other failure"
    print(f"  the chapter's tight allowance made a TOTAL too low by what it dropped; here it")
    print(f"  makes a COUNT too high by what it dropped, because the dropped thing was the")
    print(f"  evidence that the visitor was not new.")

    # and the expiry buys nothing inside a day, measured at every moment
    end = max(t for _, t in VIEWS)
    saving = max(held_at(VIEWS, INFINITY, t) - held_at(VIEWS, DAY, t) for t in range(end + 1))
    print(f"\n  visitors saved by a day-long ttl, at any moment in this example: {saving}")
    assert saving == 0, "inside the window no visitor is ever stale, so there is nothing to drop"
    print(f"  which is the real objection: the question says DISTINCT TODAY, so every visitor")
    print(f"  seen today is still needed today.  The only thing that frees the state is the")
    print(f"  day boundary, and that is a property of the question, not a bound you chose.")

    # the day boundary IS the bound -- measured over three days
    per_day = [stream_of(c, 2, seed=s) for s, c in ((1, 400), (2, 900), (3, 300))]
    all_days = [(f"d{i}:{v}", t) for i, day in enumerate(per_day) for v, t in day]
    worst_day = max(exact_distinct(d)[1] for d in per_day)
    whole_run = exact_distinct(all_days)[1]
    print(f"\n  three days of {[len(d) for d in per_day]} views: per-day states "
          f"{[exact_distinct(d)[0] for d in per_day]},")
    print(f"  so the exact answer needs {worst_day} slots at a time and not {whole_run} -- the window")
    print(f"  bounds the state, and it bounds it at the busiest day's cardinality.")
    assert worst_day == 900 and whole_run == 1600, (worst_day, whole_run)
    assert worst_day < whole_run, "the day boundary must actually release state"

    # the sketch: constant state at every cardinality
    print(f"\n  k-minimum-values sketch, k = {K}:")
    print(f"    {'distinct':>9} {'exact slots':>12} {'estimate':>9} {'sketch slots':>13} {'error':>7}")
    rows = []
    for c in (50, 255, 256, 1_000, 4_000, 20_000):
        views = stream_of(c, 2)
        exact, exact_slots = exact_distinct(views)
        est, sketch_slots = kmv_sketch(views)
        err = abs(est - exact) / exact
        rows.append((exact, exact_slots, est, sketch_slots, err))
        print(f"    {exact:>9,} {exact_slots:>12,} {est:>9,} {sketch_slots:>13} {err:>6.1%}")
    assert all(r[1] == r[0] for r in rows), "the exact state is the cardinality, by definition"
    assert {r[3] for r in rows} == {50, 255, K}, [r[3] for r in rows]
    big = [r for r in rows if r[0] >= K]
    assert all(r[3] == K for r in big), "the sketch state must not grow with the cardinality"
    # the error bar is not a guess: a k-minimum-values sketch has a standard error of
    # 1/sqrt(k), so at k = 256 that is 6.25%, and the rows have to sit inside a few of those
    # rather than inside a threshold picked to make them pass.
    se = K ** -0.5
    assert max(r[4] for r in big) < 3 * se, (max(r[4] for r in big), se)
    print(f"    the exact state grows {rows[-1][1] // rows[1][1]}x across these rows and the sketch state does not")
    print(f"    grow at all; the worst error over the rows at or above k is "
          f"{max(r[4] for r in big):.1%}, against the")
    print(f"    sketch's own standard error of 1/sqrt({K}) = {se:.2%}.")

    # boundaries: below k the sketch is the set, at k the estimator takes over
    under = kmv_sketch(stream_of(K - 1, 3))
    at_k = kmv_sketch(stream_of(K, 3))
    assert under == (K - 1, K - 1), under
    assert at_k[1] == K and at_k[0] != K, at_k
    print(f"\n  boundaries: at {K - 1} distinct the sketch holds every hash and is EXACT ({under[0]}); at")
    print(f"  {K} it is full, the estimator takes over, and it already disagrees ({at_k[0]}) -- so the")
    print(f"  exactness ends one visitor before the memory does.")
    assert kmv_sketch([]) == (0, 0), "an empty day is 0 distinct, not an error"
    assert exact_distinct([]) == (0, 0)
    assert kmv_sketch([("solo", 0)] * 1000) == (1, 1), "one visitor, a thousand views"
    assert exact_distinct([("solo", 0)] * 1000) == (1, 1)
    print(f"  an empty day gives 0 and a thousand views from one visitor give 1, in both the")
    print(f"  exact set and the sketch -- repeats hash to a value already held, so a repeat")
    print(f"  costs nothing and needs no lookup against the past.")

    # many inputs: the sketch's error is bounded and the expiry's error has one sign
    rng = random.Random(20260304)
    errs, worst_case, overcounts = [], 0, 0
    for trial in range(20):
        c = rng.randint(300, 1_200)
        views = stream_of(c, rng.randint(1, 2), seed=1000 + trial)
        exact, _ = exact_distinct(views)
        est, slots = kmv_sketch(views)
        assert slots == K, (c, slots)
        assert exact == c, (c, exact)
        errs.append(abs(est - exact) / exact)
        # the expiry is checked on a short stream of its own: `distinct_with_expiry` rescans
        # the live set on every view, which is quadratic, and that cost is itself part of the
        # objection to keeping the visitors at all.
        small = [(f"v{rng.randrange(40)}", rng.randint(0, 500)) for _ in range(120)]
        small.sort(key=lambda e: e[1])
        exact_small = exact_distinct(small)[0]
        # the allowance spans both regimes on purpose: 0 drops almost everybody and 600 is
        # wider than any silence in a 500-hour day, so it drops nobody at all.
        got, _, rec = distinct_with_expiry(small, rng.choice((0, 10, 40, 200, 600)))
        assert got >= exact_small, (got, exact_small)              # it can only overstate
        assert got == exact_small + rec, (got, exact_small, rec)   # by exactly the recounts
        overcounts += got > exact_small
    mean_err = sum(errs) / len(errs)
    worst_case = max(errs)
    print(f"\n  20 random days from 300 to 1,200 visitors: the sketch held {K} slots every time,")
    print(f"  mean error {mean_err:.2%} against the predicted {se:.2%}, worst {worst_case:.2%}.")
    # CORRECTED CLAIM.  The first version asserted the expiring counter overstates on EVERY
    # random day, and the measurement refused it: an allowance wider than every silence in a
    # day's stream drops nobody and is therefore exact.  What survives is the directional
    # claim, which is the one that matters -- the expiry never understates, and when it is
    # wrong it is wrong by exactly the number of visitors it met twice.
    print(f"  the expiring exact counter overstated on {overcounts} of 20 days and understated on 0;")
    print(f"  on the other {20 - overcounts} the allowance exceeded every silence in that day, so it dropped")
    print(f"  nobody -- the bound is only ever as safe as the quietest visitor, and widening it")
    print(f"  until it is safe is the same as not bounding it.")
    assert 0.3 * se < mean_err < 2.0 * se, (mean_err, se)
    assert worst_case < 4 * se, (worst_case, se)
    assert 0 < overcounts < 20, overcounts

    # the scale the question names, priced rather than argued
    VISITORS_PER_DAY = 30_000_000
    bytes_exact = VISITORS_PER_DAY * 16            # 16 bytes for a visitor id, hash set aside
    bytes_sketch = K * 8                           # k doubles
    print(f"\n  at {VISITORS_PER_DAY:,} distinct visitors a day:")
    print(f"    exact  : {bytes_exact / 1e9:.2f} GB of visitor ids, per counter, per day")
    print(f"    sketch : {bytes_sketch:,} bytes, whatever the cardinality")
    print(f"    {bytes_exact // bytes_sketch:,}x, and the sketch's cost does not depend on the answer --")
    print(f"    which is the property the chapter's one-number accumulator had and the exact")
    print(f"    distinct count never did.")
    assert bytes_exact // bytes_sketch == 234_375
    assert bytes_sketch == 2048
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
