#!/usr/bin/env python3
"""A running total per key, with the state bounded -- and what the bound costs.

Events carry a key and a value, forever.  Report a running total per key.  Keys
never stop arriving, so the state cannot grow without bound: bound it.  What does
the bound cost, and how do you choose it?

The computation is one addition per event, so nothing about the computation is the
problem.  The state is: its size is set by how many DISTINCT keys have been seen,
which is not a quantity you control.

Run it:  python3 programs/ch07.py
"""
import hashlib
import random

# Data, from tools/gen_ch07_interview.js over tools/stream_seed.js: the seed events
# as (key, value, event_time), in time order.  Two keys, so one can survive an
# expiry while the other does not, and their true totals differ (24 vs 21) so a
# wrong one can be attributed.
EVENTS = [("a", 5, 1), ("a", 3, 3), ("b", 4, 50), ("b", 7, 90), ("a", 2, 130),
          ("b", 9, 220), ("a", 6, 245), ("b", 1, 260), ("a", 8, 540)]
KEYS = sorted({k for k, _, _ in EVENTS})
TRUE = {k: sum(v for kk, v, _ in EVENTS if kk == k) for k in KEYS}
END = max(t for *_, t in EVENTS)
INFINITY = float("inf")
# The asymptotic case.  The small example cannot show a memory saving at all (the
# measurement below is exactly zero), so the claim is also measured at a scale where
# it does show: ONEOFF keys seen once each, plus one key that keeps arriving.
ONEOFF = 2000
BIG_TTL = 100

def longest_gap(events, k):
    """The longest silence key k takes between events.  A property of the DATA rather
    than of the design, and knowable only after the fact -- which is why the
    allowance has to be a guess about the future."""
    worst, prev = 0, None
    for key, _, t in events:
        if key == k:
            if prev is not None:
                worst = max(worst, t - prev)
            prev = t
    return worst

def drop_stale(acc, last, now, ttl):
    """Remove any key untouched for longer than ttl.  The only thing standing between
    the state and unbounded growth -- and it needs `last`, a SECOND number per live
    key that exists solely so this comparison can be made.  Returns what was dropped."""
    gone = {k: acc[k] for k in list(acc) if now - last[k] > ttl}
    for k in gone:
        del acc[k]
        del last[k]
    return gone

def add(acc, last, event):
    """The whole computation: one number per key, one addition per event."""
    k, v, t = event
    acc[k] = acc.get(k, 0) + v
    last[k] = t

def on_event(acc, last, event, ttl):
    """Drop first, then add.  The order is why the restart happens -- a key dropped a
    moment ago is INDISTINGUISHABLE from a key never seen, and no ordering fixes it,
    because the information that would tell them apart is what was deleted."""
    gone = drop_stale(acc, last, event[2], ttl)
    fresh = event[0] not in acc
    add(acc, last, event)
    return gone, fresh

def totals(events, ttl, spill=None):
    """Run the whole stream at one allowance.

    There is deliberately NO final sweep: releasing a key's state after the stream
    has ended is expected and is not an error, since its total was already reported.
    Sweeping at the end made every total look wrong in the generator, conflating "the
    aggregate restarted mid-stream" with "the state was released at the end".

    `spill` (a dict) turns the deletion into a write-out-and-reload, which is the
    variation-2 escape; with it, the totals come out exact at any allowance.
    """
    acc, last, resets = {}, {}, []
    for e in events:
        gone, _ = drop_stale(acc, last, e[2], ttl), None
        for k, v in gone.items():
            if spill is not None:
                spill[k] = spill.get(k, 0) + v
        if e[0] not in acc and any(x[0] == e[0] and x[2] < e[2] for x in events):
            resets.append((e[0], e[2]))
            if spill is not None and e[0] in spill:
                acc[e[0]] = spill.pop(e[0])        # reload instead of restarting at 0
        add(acc, last, e)
    for k, v in acc.items():                       # whatever is still live at the end
        if spill is not None:
            spill[k] = spill.get(k, 0) + v
    return acc, resets

def held_at(events, ttl, t):
    """How many keys are held at moment t, if no event arrives then.

    The end-of-run count is the WRONG measurement: an expiry is immediately followed
    by the event that re-creates the key, so the saving is invisible there.  Observing
    a moment shows it."""
    last = {}
    for k, _, at in events:
        if at <= t:
            last[k] = at
    return sum(1 for k in last if t - last[k] <= ttl)

# The three variations.

def the_unique_visitor_count(visitors, k=256):
    """Variation 1, surface: analytics.  Count DISTINCT visitors, not a sum.

    Non-obvious point: `add` now needs a SET rather than an integer, so the state is
    the size of the visitor set and `drop_stale` is no help -- every visitor must be
    remembered for the whole day.  The way out is to give up exactness: a sketch
    answers "how many distinct" in a fixed space whatever the cardinality.  The
    chapter's bound works because a sum is ONE number and a distinct count is not.

    A k-minimum-values sketch, hashed with sha1 so it is deterministic.  Returns
    (exact_count, exact_state_size, estimate, sketch_state_size).
    """
    exact = set()
    mins = []
    for v in visitors:
        exact.add(v)
        h = int(hashlib.sha1(str(v).encode()).hexdigest()[:16], 16) / float(1 << 64)
        if h not in mins:
            mins.append(h)
            mins.sort()
            del mins[k:]
    if len(mins) < k:
        est = len(mins)
    else:
        est = int((k - 1) / mins[-1])
    return len(exact), len(exact), est, len(mins)

def the_abandoned_shopping_cart(events, ttl):
    """Variation 2, surface: commerce.  Hold each user's cart, expire inactive ones,
    and a user who returns after a week still expects their cart.

    Non-obvious point: here the expiry is the FEATURE and the silent restart is the
    specified behaviour -- which leaves one real problem: "expire" and "forget" were
    conflated.  `drop_stale` writes the accumulator out instead of deleting it and
    `add` reads it back, so memory is bounded by ACTIVE users while correctness is
    bounded by nothing.

    Returns (totals_with_spill, totals_without_spill, spill_store).
    """
    spill = {}
    live, _ = totals(events, ttl, spill=spill)
    plain, _ = totals(events, ttl)
    return dict(spill), plain, live

def the_fraud_score_over_a_lifetime(events):
    """Variation 3, surface: risk.  Score each account on its ENTIRE history; accounts
    lie dormant for years and must keep their score.

    Non-obvious point: the requirement forbids every bound, so the chapter's answer is
    unavailable -- and the response is to stop treating the score as stream state.
    It belongs in a store keyed by account, read and written per event, so the
    streaming layer holds NOTHING between events and the memory question disappears.
    State that must outlive the stream is not stream state.

    Returns (store, max_keys_held_in_the_streaming_layer).
    """
    store, high_water = {}, 0
    for k, v, _ in events:
        held = {}                       # the streaming layer, between events
        high_water = max(high_water, len(held))
        held[k] = store.get(k, 0) + v   # read, update, write, forget
        store[k] = held.pop(k)
    return store, high_water

def main():
    print("EVENTS =", "  ".join(f"{k}@{t}:{v}" for k, v, t in EVENTS))
    print(f"  true totals {TRUE}   longest gap per key "
          f"{ {k: longest_gap(EVENTS, k) for k in KEYS} }")
    worst_gap = max(longest_gap(EVENTS, k) for k in KEYS)
    safe_ttl, tight_ttl = worst_gap, worst_gap - 1
    free, _ = totals(EVENTS, INFINITY)
    safe, _ = totals(EVENTS, safe_ttl)
    tight, resets = totals(EVENTS, tight_ttl)
    print(f"  ttl = INFINITY : {free}  (correct, {held_at(EVENTS, INFINITY, END)} keys held forever)")
    print(f"  ttl = {safe_ttl}      : {safe}  (correct)")
    print(f"  ttl = {tight_ttl}      : {tight}  <- restarted {resets}")

    assert worst_gap == 295 and (safe_ttl, tight_ttl) == (295, 294)
    assert free == TRUE == {"a": 24, "b": 21}, free
    assert safe == TRUE, "an allowance equal to the worst gap must be enough"
    assert resets == [("a", 540)], resets
    wrong = [k for k in KEYS if tight.get(k, 0) != TRUE[k]]
    right = [k for k in KEYS if tight.get(k, 0) == TRUE[k]]
    assert wrong == ["a"] and right == ["b"], (wrong, right)
    assert tight["a"] == 8 and TRUE["a"] == 24, tight
    # the error is one-directional: too LOW, by exactly what was dropped
    assert all(tight.get(k, 0) <= TRUE[k] for k in KEYS)
    assert TRUE["a"] - tight["a"] == 16, "the dropped accumulator held 16 from 4 events"
    assert longest_gap(EVENTS, "b") == 130 <= tight_ttl, "b must survive the tight allowance"
    # the single step, through on_event: "a" is dropped holding 16 from 4 events, and the
    # very next thing that happens is the event that re-creates it from zero
    acc = {"a": 16, "b": 21}
    last = {"a": 245, "b": 260}
    gone, fresh = on_event(acc, last, ("a", 8, 540), tight_ttl)
    assert gone == {"a": 16} and fresh is True and acc["a"] == 8, (gone, fresh, acc)
    print(f"  on_event(('a', 8, 540), ttl={tight_ttl}): dropped {gone}, "
          f"key looked new ({fresh}), so a restarts at {acc['a']}")

    # The memory saving at this scale, measured at every moment: it is ZERO.
    saving = max(held_at(EVENTS, INFINITY, t) - held_at(EVENTS, tight_ttl, t)
                 for t in range(END + 1))
    print(f"\n  keys saved by the bound, at any moment in this example: {saving}")
    assert saving == 0, (
        f"the bound saves up to {saving} keys here; the claim 'the correctness cost "
        f"arrives before any memory benefit' would have to be rewritten")
    # so the case for bounding is purely asymptotic -- measured at a scale where it shows
    big = [(f"one{i}", 1, i) for i in range(1, ONEOFF + 1)]
    big += [("hot", 1, t) for t in range(5, ONEOFF, 10)]
    big.sort(key=lambda e: e[2])
    big_end = max(t for *_, t in big)
    unbounded_keys = held_at(big, INFINITY, big_end)
    bounded_keys = held_at(big, BIG_TTL, big_end)
    big_free, _ = totals(big, INFINITY)
    big_bound, _ = totals(big, BIG_TTL)
    print(f"  at {ONEOFF} one-off keys + 1 recurring key, observed at t = {big_end}:")
    print(f"    ttl = INFINITY : {unbounded_keys} keys held")
    print(f"    ttl = {BIG_TTL}      : {bounded_keys} keys held  "
          f"({unbounded_keys - bounded_keys} saved, {bounded_keys / unbounded_keys:.1%} of the state)")
    # MEASURED 102, not the handful first guessed: the allowance keeps every key
    # touched within the last 100 time units -- 100 one-off keys, the recurring key,
    # and the one sitting exactly on the boundary.  So the bound holds 5.1% of the
    # state, and the saving grows with the key count while 102 stays put.
    assert (unbounded_keys, bounded_keys) == (2001, 102), (unbounded_keys, bounded_keys)
    assert unbounded_keys - bounded_keys == 1899
    assert bounded_keys / unbounded_keys < 0.06 < 1.0
    # the opposite outcome is forbidden: at this scale the saving may NOT be zero
    assert bounded_keys < unbounded_keys, "the asymptotic case must actually save keys"
    # and the recurring key is still exact, because its gap (10) is inside the allowance
    assert big_free["hot"] == big_bound["hot"] == 200, (big_free["hot"], big_bound.get("hot"))
    assert longest_gap(big, "hot") == 10 <= BIG_TTL

    # variations
    exact, exact_state, est, sketch_state = the_unique_visitor_count(
        [f"user{i % 5000}" for i in range(20000)])
    err = abs(est - exact) / exact
    print(f"\n  unique visitors: exact {exact} in {exact_state} slots, sketch {est} in "
          f"{sketch_state} slots ({err:.1%} error)")
    assert (exact, exact_state) == (5000, 5000)
    assert sketch_state == 256 and err < 0.12, (sketch_state, est, err)
    # the opposite outcome is forbidden: the sketch must NOT be exact, or it is not a sketch
    assert est != exact, "a sketch that is exact here would make the trade-off invisible"

    spilled, plain, live = the_abandoned_shopping_cart(EVENTS, tight_ttl)
    print(f"  carts: spilled-and-reloaded {spilled}, plain expiry {plain}, live at end {live}")
    assert spilled == TRUE, "writing the cart out and reading it back must be exact"
    assert plain != TRUE and plain == tight, "and plain expiry must still be wrong"

    store, high_water = the_fraud_score_over_a_lifetime(EVENTS)
    print(f"  lifetime score: store {store}, keys ever held between events {high_water}")
    assert store == TRUE and high_water == 0, (store, high_water)

    # brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    for _ in range(500):
        n = rng.randint(1, 20)
        ev = sorted(((rng.choice("abcd"), rng.randint(1, 9), rng.randint(0, 400))
                     for _ in range(n)), key=lambda e: e[2])
        truth = {}
        for k, v, _ in ev:
            truth[k] = truth.get(k, 0) + v
        assert totals(ev, INFINITY)[0] == truth, ev
        gap = max((longest_gap(ev, k) for k in truth), default=0)
        # CORRECTED CLAIM.  "An allowance equal to the worst gap reproduces the true
        # totals" is FALSE in general, and a random case falsified it: a key whose last
        # event is more than ttl before the stream's end is released at the end, so it
        # is simply absent from `acc` -- its total was already reported, which is why
        # `totals` has no final sweep.  What is actually true is the stronger and more
        # useful statement: at ttl >= the worst gap NO key is ever dropped and
        # re-created, so no aggregate is ever restarted, and every key still live holds
        # its true total.
        acc_gap, resets_gap = totals(ev, gap)
        assert resets_gap == [], (ev, gap, resets_gap)
        assert all(acc_gap[k] == truth[k] for k in acc_gap), (ev, gap)
        sp = {}
        totals(ev, 0, spill=sp)
        assert sp == truth, (ev, sp)                         # spilling is exact at ANY ttl
        for ttl in (0, 1, gap - 1 if gap else 0):            # and a tight one never overstates
            assert all(totals(ev, ttl)[0].get(k, 0) <= truth[k] for k in truth), (ev, ttl)
    print("\n  500 random streams: unbounded == the true totals; at an allowance equal to")
    print("  the worst gap NOTHING is ever dropped and re-created (0 restarts) and every")
    print("  live key is exact; spilling is exact at any allowance; and a tight allowance")
    print("  never overstates a total -- it only ever loses.")
    print("\nall assertions passed")

if __name__ == "__main__":
    main()
