#!/usr/bin/env python3
"""Variation 3 -- the abandoned shopping cart (looks like commerce). Standalone and runnable.

  Hold each shopper's cart while they shop.  Carts that have been inactive for a week are
  expired, because there are far more shoppers than active ones.  A shopper comes back after
  ten days and expects their cart to be there.

Here the expiry is the FEATURE, not the compromise -- the chapter's silent restart is the
specified behaviour -- and that inverts the whole problem, leaving one real contradiction:
the cart must be bounded in memory and unbounded in time.  The move is to notice that EXPIRE
and FORGET were conflated.  Dropping a cart from memory writes it out; a shopper who comes
back reads it in.  Then memory is bounded by ACTIVE shoppers and correctness is bounded by
nothing -- and the honest price, measured below, is that durable storage is now bounded by
nothing either.  The fix does not shrink the data, it moves it to where growth is affordable.

Run it:  python3 programs/ch07_v3.py
"""
import random

# The chapter's nine seed events, read as cart additions: (shopper, item_price, hour).  The
# prices are the chapter's values, so the true cart totals are its 24 and 21.  Shopper 'a' is
# silent from hour 245 to hour 540 -- the chapter's longest gap, 295 hours, which is ten days
# and is exactly the shopper the product requirement is about.
ADDITIONS = [("a", 5, 1), ("a", 3, 3), ("b", 4, 50), ("b", 7, 90), ("a", 2, 130),
             ("b", 9, 220), ("a", 6, 245), ("b", 1, 260), ("a", 8, 540)]
WEEK = 168                 # the inactivity allowance the product chose: a week in hours
TRUE_CARTS = {"a": [5, 3, 2, 6, 8], "b": [4, 7, 9, 1]}
TRUE_VALUE = {"a": 24, "b": 21}
INFINITY = float("inf")
# The scale at which bounding memory is worth anything, from the chapter's asymptotic case:
# many shoppers who visit once, plus one who never leaves.
ONEOFF = 2_000
BIG_TTL = 100


def longest_silence(additions, shopper):
    """The longest gap between two additions by one shopper.  A property of the DATA, not of
    the design, and knowable only afterwards -- which is why the week is a guess about
    shoppers rather than a derivation from anything."""
    worst, prev = 0, None
    for s, _, t in additions:
        if s == shopper:
            if prev is not None:
                worst = max(worst, t - prev)
            prev = t
    return worst


def add(carts, last, event):
    """One item onto one cart.  The whole computation, and never the problem."""
    s, price, t = event
    carts.setdefault(s, []).append(price)
    last[s] = t


def expire_by_deleting(carts, last, now, ttl):
    """The expiry as written when "expire" is read as "forget": the cart is deleted.

    It needs `last`, a second number per live cart whose only purpose is this comparison.
    Afterwards a shopper who returns is indistinguishable from a new one, because the thing
    that would have told them apart is what was deleted.  Returns the carts dropped.
    """
    gone = {s: carts[s] for s in list(carts) if now - last[s] > ttl}
    for s in gone:
        del carts[s]
        del last[s]
    return gone


def expire_by_writing_out(carts, last, store, now, ttl):
    """The same expiry with one line changed: the cart is written to durable storage on its
    way out of memory.

    Nothing about the bound changes -- memory still holds only active shoppers -- but the
    deletion has become a MOVE, so the information needed to recognise a returning shopper
    still exists somewhere.  Returns the carts moved.
    """
    gone = {s: carts[s] for s in list(carts) if now - last[s] > ttl}
    for s, items in gone.items():
        store[s] = store.get(s, []) + items
        del carts[s]
        del last[s]
    return gone


def run(additions, ttl, store=None):
    """The whole stream at one allowance, with or without a store behind it.

    Without a store, a returning shopper starts from an empty cart.  With one, a cart absent
    from memory is read back before the item is added, which is the only difference and is the
    entire answer.  Returns (carts_in_memory, store, peak_carts_held, reloads).
    """
    carts, last, reloads = {}, {}, 0
    peak = 0
    for event in additions:
        s, _, t = event
        if store is None:
            expire_by_deleting(carts, last, t, ttl)
        else:
            expire_by_writing_out(carts, last, store, t, ttl)
            if s not in carts and s in store:
                carts[s] = store.pop(s)        # the shopper came back: read the cart in
                reloads += 1
        add(carts, last, event)
        peak = max(peak, len(carts))
    return carts, store, peak, reloads


def final_carts(additions, ttl, use_store):
    """What each shopper is shown the next time they look, which is memory plus whatever is
    in the store -- the only measurement the shopper can actually make."""
    store = {} if use_store else None
    carts, store, peak, reloads = run(additions, ttl, store)
    out = {s: list(items) for s, items in carts.items()}
    if store:
        for s, items in store.items():
            out[s] = items + out.get(s, [])
    return out, peak, reloads


def carts_held_at(additions, ttl, t):
    """How many carts memory holds at hour t, if nothing arrives then.

    Counting at the end of the run is the wrong measurement: an expiry is immediately followed
    by the addition that re-creates the cart, so the saving is invisible there.  A quiet moment
    shows it."""
    last = {}
    for s, _, at in additions:
        if at <= t:
            last[s] = at
    return sum(1 for s in last if t - last[s] <= ttl)


def is_suffix(part, whole):
    """Whether `part` is a tail of `whole`.  The precise shape of the damage a deletion does:
    the shopper keeps what they added after the cart was dropped and nothing before it."""
    return part == whole[len(whole) - len(part):] if part else True


def main():
    silences = {s: longest_silence(ADDITIONS, s) for s in ("a", "b")}
    print("ADDITIONS =", "  ".join(f"{s}@{t}:{p}" for s, p, t in ADDITIONS))
    print(f"  true carts {TRUE_CARTS}, values {TRUE_VALUE}")
    print(f"  longest silence per shopper {silences}, allowance {WEEK} hours (a week)\n")

    deleting, peak_del, _ = final_carts(ADDITIONS, WEEK, use_store=False)
    writing, peak_wr, reloads = final_carts(ADDITIONS, WEEK, use_store=True)
    keeping, peak_keep, _ = final_carts(ADDITIONS, INFINITY, use_store=False)
    print(f"  never expire          : {keeping}   ({peak_keep} carts held)")
    print(f"  expire by deleting    : {deleting}   ({peak_del} carts held)")
    print(f"  expire by writing out : {writing}   ({peak_wr} carts held, {reloads} reload)")

    assert keeping == TRUE_CARTS, keeping
    assert writing == TRUE_CARTS, "writing the cart out and reading it back must be exact"
    assert deleting != TRUE_CARTS, "deleting must lose the cart, or there is no problem here"
    # CORRECTED CLAIM.  The first expectation was {"a": [8], "b": [4, 7, 9, 1]} -- shopper 'b'
    # untouched, because b's longest silence (130) is inside the allowance.  The measurement
    # refused it: b's LAST addition is at hour 260 and the sweep runs when a's addition
    # arrives at hour 540, so b has been quiet 280 hours by then and the cart is swept.  There
    # are two distinct losses here, not one: 'a' is dropped and comes back, which restarts the
    # cart, and 'b' is dropped and does not come back, which erases it.  A silence inside the
    # allowance is no protection -- what matters is the silence at the moment somebody else's
    # event triggers the sweep.
    assert deleting == {"a": [8]}, deleting
    assert "b" not in deleting, "b's cart is swept when a's hour-540 addition arrives"
    assert reloads == 1, reloads
    lost_a = TRUE_CARTS["a"][:-1]
    quiet_b = 540 - 260
    assert sum(lost_a) == 16 and sum(deleting["a"]) == 8
    print(f"\n  shopper 'a' was silent {silences['a']} hours, {silences['a'] - WEEK} past the allowance, so they return to a")
    print(f"  cart holding {sum(deleting['a'])} instead of {TRUE_VALUE['a']}: {len(lost_a)} items worth {sum(lost_a)} silently gone.")
    print(f"  shopper 'b''s longest silence is only {silences['b']} hours and the cart is lost anyway: by the")
    print(f"  time a's hour-540 addition triggers a sweep, b has been quiet {quiet_b} hours, so b's")
    print(f"  whole cart is erased with nothing to come back to.  Two different losses -- a")
    print(f"  restart and an erasure -- and only the first one looks like the chapter's.")
    assert quiet_b > WEEK and silences["b"] <= WEEK, (quiet_b, silences["b"])

    # the damage has a shape, and it is always this shape
    for s, items in deleting.items():   # only 'a' survives in memory at all
        assert is_suffix(items, TRUE_CARTS[s]), (s, items)
        assert sum(items) <= TRUE_VALUE[s], (s, items)
    assert not is_suffix([5, 3], TRUE_CARTS["a"]), "a prefix is NOT what survives"
    print(f"\n  what survives is always a SUFFIX of the true cart -- the items added since the")
    print(f"  drop -- so the error is one-directional: a cart can only ever be too small.")

    # and the store makes it exact at ANY allowance, including none at all
    for ttl in (0, 1, WEEK, silences["a"] - 1, INFINITY):
        got, peak, _ = final_carts(ADDITIONS, ttl, use_store=True)
        assert got == TRUE_CARTS, (ttl, got)
    zero, zero_peak, zero_reloads = final_carts(ADDITIONS, 0, use_store=True)
    assert zero == TRUE_CARTS and zero_peak == 1, (zero, zero_peak)
    print(f"  with a store, every allowance from 0 to never is exact; at ttl = 0 memory holds")
    print(f"  {zero_peak} cart at a time and the answer is still {zero['a'] == TRUE_CARTS['a'] and 'right' or 'wrong'} after {zero_reloads} reloads.")
    assert zero_reloads == 7, zero_reloads

    # the boundary the comparison decides
    tight, _, _ = final_carts(ADDITIONS, silences["a"] - 1, use_store=False)
    exact, _, _ = final_carts(ADDITIONS, silences["a"], use_store=False)
    assert exact == TRUE_CARTS, "an allowance equal to the longest silence drops nobody"
    assert tight != TRUE_CARTS, tight
    # and this allowance isolates the two failure modes: at 294 hours only 'a' is dropped and
    # restarted, while 'b' -- quiet 280 hours when the sweep runs -- is still inside it.  The
    # erasure of 'b' needs an allowance tighter than 280, which the week-long one is.
    assert tight == {"a": [8], "b": [4, 7, 9, 1]}, tight
    print(f"\n  boundary: ttl = {silences['a']} (the silence itself) keeps every cart; ttl = {silences['a'] - 1} loses one.")
    print(f"  The comparison is `now - last > ttl`, so a silence EQUAL to the allowance is")
    print(f"  inside it -- one hour decides whether a shopper's cart exists.  At {silences['a'] - 1} hours only")
    print(f"  'a' is lost: {tight}, with 'b' kept because 280 hours of")
    print(f"  quiet is inside a 294-hour allowance and outside a 168-hour one.")

    # the memory saving at this scale, measured at every hour -- and measured twice, because
    # where you stop looking changes the number.
    end = max(t for *_, t in ADDITIONS)
    def saving_at(ttl, horizon):
        return max(carts_held_at(ADDITIONS, INFINITY, t) - carts_held_at(ADDITIONS, ttl, t)
                   for t in range(horizon + 1))
    def best_hour(ttl, horizon):
        return max(range(horizon + 1),
                   key=lambda t: carts_held_at(ADDITIONS, INFINITY, t) - carts_held_at(ADDITIONS, ttl, t))
    beyond = end + WEEK + 2
    print(f"\n  carts the allowance saves, as a maximum over every hour:")
    print(f"    {'allowance':>12} {'up to hour ' + str(end):>16} {'up to hour ' + str(beyond):>16}")
    for ttl in (WEEK, 294):
        print(f"    {ttl:>12} {saving_at(ttl, end):>16} {saving_at(ttl, beyond):>16}")
    # MEASURED, and the first write-up of this said ZERO on the strength of the chapter's
    # figure.  Both halves are true and they are different allowances: at the chapter's
    # 294-hour allowance the saving really is 0 for every hour up to the last addition, which
    # is the chapter's own measurement reproduced.  At the week-long allowance the saving is 2,
    # reached at hour {h} -- and the hour is the whole story, because by then BOTH carts have
    # already been erased.  The memory the bound reclaims is the cart the shopper lost, so the
    # saving and the damage are one measurement seen from two sides.
    h = best_hour(WEEK, end)
    assert saving_at(294, end) == 0, saving_at(294, end)
    assert saving_at(294, beyond) == 1, saving_at(294, beyond)
    assert saving_at(WEEK, end) == 2, saving_at(WEEK, end)
    assert h == 429, h
    assert carts_held_at(ADDITIONS, WEEK, h) == 0 and carts_held_at(ADDITIONS, INFINITY, h) == 2
    assert h > 245 + WEEK and h > 260 + WEEK, "both carts are already past their allowance"
    print(f"  at the chapter's 294-hour allowance the saving is 0 for every hour up to the last")
    print(f"  addition -- the chapter's own figure -- so the correctness cost arrives before any")
    print(f"  memory benefit.  At the week-long allowance it is 2, reached at hour {h}, and the hour")
    print(f"  is the whole story: shopper 'a' expired at {245 + WEEK} and 'b' at {260 + WEEK}, so the two carts the")
    print(f"  bound has stopped holding are precisely the two the shoppers no longer have.  A")
    print(f"  saving visible only after the data is gone is the damage, measured from the other")
    print(f"  side.  The real case for the bound is asymptotic, and the honest thing is to go")
    print(f"  and measure it there.")

    # ...measured there
    big = [(f"once{i}", 1, i) for i in range(1, ONEOFF + 1)]
    big += [("regular", 1, t) for t in range(5, ONEOFF, 10)]
    big.sort(key=lambda e: e[2])
    big_end = max(t for *_, t in big)
    unbounded = carts_held_at(big, INFINITY, big_end)
    bounded = carts_held_at(big, BIG_TTL, big_end)
    big_del, _, _ = final_carts(big, BIG_TTL, use_store=False)
    big_store_carts, big_peak, big_reloads = final_carts(big, BIG_TTL, use_store=True)
    truth_big = {}
    for s, p, _ in big:
        truth_big.setdefault(s, []).append(p)
    print(f"\n  at {ONEOFF:,} one-visit shoppers plus one regular, observed at hour {big_end}:")
    print(f"    never expire : {unbounded:,} carts in memory")
    print(f"    ttl = {BIG_TTL}    : {bounded} carts in memory  "
          f"({unbounded - bounded:,} saved, {bounded / unbounded:.1%} of the state)")
    assert (unbounded, bounded) == (2001, 102), (unbounded, bounded)
    assert bounded < unbounded, "the asymptotic case must actually save memory"
    assert bounded / unbounded < 0.06
    assert big_store_carts == truth_big, "and the store keeps it exact at scale"
    assert big_del != truth_big, "while deleting does not"
    print(f"    with a store the carts are exact ({big_reloads} reloads); by deleting they are not.")

    # the honest price of the fix, which is not that it is free
    store_after = {}
    run(big, BIG_TTL, store_after)
    print(f"\n  and the price: the store now holds {len(store_after):,} carts while memory holds {big_peak}.")
    print(f"  Memory is bounded by ACTIVE shoppers; durable storage is bounded by nothing at")
    print(f"  all, because every shopper who ever visited is still in it.  The fix did not")
    print(f"  shrink the data, it moved the growth to the place where growth is affordable --")
    print(f"  and a store that is never pruned is the next version of this same conversation.")
    assert len(store_after) > big_peak * 10, (len(store_after), big_peak)
    assert len(store_after) == 1_899, len(store_after)

    # many inputs: the store is always exact, deleting always loses a suffix and never more
    rng = random.Random(20260303)
    lost_cases, exact_cases = 0, 0
    for _ in range(400):
        n = rng.randint(1, 18)
        ev = sorted(((rng.choice("abcd"), rng.randint(1, 9), rng.randint(0, 400))
                     for _ in range(n)), key=lambda e: e[2])
        truth = {}
        for s, p, _ in ev:
            truth.setdefault(s, []).append(p)
        gap = max((longest_silence(ev, s) for s in truth), default=0)
        for ttl in (0, 1, gap // 2, max(gap - 1, 0), gap, INFINITY):
            with_store, _, _ = final_carts(ev, ttl, use_store=True)
            assert with_store == truth, (ev, ttl)
            plain, _, _ = final_carts(ev, ttl, use_store=False)
            for s, items in plain.items():
                assert is_suffix(items, truth[s]), (ev, ttl, s, items)
                assert sum(items) <= sum(truth[s]), (ev, ttl, s)
            if plain == truth:
                exact_cases += 1
            else:
                lost_cases += 1
        # CORRECTED CLAIM.  "An allowance equal to the longest silence reproduces every cart"
        # is FALSE, and a random stream falsified it: a shopper whose last addition is more
        # than the allowance before the stream ends is swept by somebody ELSE's addition, so
        # their cart is absent rather than short.  What is true, and is the stronger statement,
        # is that at ttl >= the longest silence no cart is ever dropped AND re-created -- so
        # every cart still in memory holds its WHOLE history, never a suffix of it.
        at_gap = final_carts(ev, gap, use_store=False)[0]
        assert all(at_gap[sh] == truth[sh] for sh in at_gap), (ev, gap, at_gap)
    print(f"\n  400 random streams at six allowances each: the store reproduced the true cart")
    print(f"  every single time; plain expiry was exact in {exact_cases:,} of {exact_cases + lost_cases:,} runs and in the other")
    print(f"  {lost_cases:,} it returned a strict suffix -- never a wrong item, never an extra one, only")
    print(f"  a shorter cart.  At an allowance equal to the longest silence no cart was ever")
    print(f"  restarted: every cart still in memory held its whole history, and the ones missing")
    print(f"  were missing entirely.")
    assert lost_cases > 0 and exact_cases > 0
    assert (exact_cases, lost_cases) == (677, 1_723), (exact_cases, lost_cases)
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
