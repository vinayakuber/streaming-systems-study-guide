#!/usr/bin/env python3
"""Variation 4 -- the fraud score over a lifetime (looks like risk). Standalone and runnable.

  Every account carries a risk score: the sum of the points its events have ever earned.
  Score each account on its ENTIRE history.  Accounts lie dormant for years and must come
  back with the score they left with.

The requirement forbids every bound, which makes this the one variation where the chapter's
answer is simply unavailable -- and the useful response is to stop treating the score as
stream state at all.  It belongs in a store keyed by account, read and written per event, so
the streaming layer holds NOTHING between events and the memory question disappears: state
that must outlive the stream is not stream state.  What makes this worth running rather than
asserting is the sequel.  A store read per event is expensive, so a bounded CACHE goes in
front of it -- and that cache is bounded by exactly the rule the chapter used on the state,
with the opposite consequence, because a cache miss RE-READS and a state expiry RESTARTS.
The same bound is safe in one place and a published laundering schedule in the other.

WORKED EXAMPLES: the EXAMPLES table below holds 13 input/output pairs -- the chapter's own
nine signals, both sides of the 295-day dormancy the expiry turns on, a laundering pair that
is washed on one side of it and kept on the other, an empty stream, a single signal, a cache
of 0 slots and a cache bigger than the data, and two generated streams at 2,000 accounts.
Every row is ASSERTED three ways, against the true score, the store and the cache, so the
table cannot drift from the code: change an answer and this file stops running.

Run it:  python3 programs/ch07_v4.py
"""
import random

# The chapter's nine seed events, read as risk signals: (account, points, day).  The points
# are the chapter's values, so the true lifetime scores are its 24 and 21.  Account 'a' is
# silent for 295 days -- the chapter's longest gap -- which is the dormancy the requirement
# is about.
SIGNALS = [("a", 5, 1), ("a", 3, 3), ("b", 4, 50), ("b", 7, 90), ("a", 2, 130),
           ("b", 9, 220), ("a", 6, 245), ("b", 1, 260), ("a", 8, 540)]
TRUE = {"a": 24, "b": 21}
DORMANCY = 295              # 540 - 245: how long account 'a' goes quiet
INFINITY = float("inf")
# The scale at which any of this matters: many accounts seen once, one that never stops.
ONEOFF = 2_000
BIG_TTL = 100

# Inputs for the examples table, not alternative versions of the problem: an empty stream, one
# signal, the laundering pair the dormancy allowance decides, and the asymptotic stream -- the
# same shape main() measures below, built here so the table can reach it too.
NO_SIGNALS = []
ONE_SIGNAL = [("solo", 7, 0)]
LAUNDERING = [("mule", 20, 0), ("mule", 4, DORMANCY)]
BIG_SIGNALS = sorted([(f"once{i}", 1, i) for i in range(1, ONEOFF + 1)]
                     + [("regular", 1, t) for t in range(5, ONEOFF, 10)],
                     key=lambda e: e[2])

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, signals, ttl, cache capacity, points the EXPIRY still has, restarts).
# The expiry's total is the expected value because it is the only one that moves: the store
# and every cache capacity return the true score on every row, which is the point.  Every row
# is asserted by show_examples(), which is why the table is data and not a comment: a comment
# can go stale silently, and this cannot.
EXAMPLES = [
    ("never expire: the true score",         SIGNALS,     INFINITY,    1,  45,   0),
    ("ttl = 295, the dormancy itself",       SIGNALS,     DORMANCY,    1,  45,   0),
    ("ttl = 294, one day tighter",           SIGNALS,   DORMANCY - 1,  1,  29,   1),
    ("ttl = 100: four restarts",             SIGNALS,          100,    2,   8,   4),
    ("ttl = 0: the last event only",         SIGNALS,            0,    0,   8,   7),
    ("an empty stream -> no score at all",   NO_SIGNALS,  INFINITY,    5,   0,   0),
    ("a single signal",                      ONE_SIGNAL,  INFINITY,    0,   7,   0),
    ("the mule at ttl = 294: washed",        LAUNDERING, DORMANCY - 1, 1,   4,   1),
    ("the mule at ttl = 295: kept",          LAUNDERING,  DORMANCY,    1,  24,   0),
    ("cache of 0 slots: write-through",      SIGNALS,     INFINITY,    0,  45,   0),
    ("cache bigger than the data",           SIGNALS,     INFINITY,   10,  45,   0),
    ("2,000 accounts, ttl 100, 64 slots",    BIG_SIGNALS,      100,   64, 301,   0),
    ("2,000 accounts, ttl 0, no cache",      BIG_SIGNALS,        0,    0,   1, 199),
]


def show_examples():
    """Print the examples table and assert every row, three ways.

    `true_scores` is the requirement written out, so it is the reference that cannot be wrong;
    every row is checked against it, against the store, and against the cache at that row's
    capacity.  The cost columns are printed per row so the reader can see what each answer
    buys: `saved` is the scores the expiry stops holding -- 0 at the chapter's scale, where
    the expiry has already cost 16 of account 'a''s 24 points, and 1,899 only on the last two
    rows -- against the `reads` and `writes` the cache pays to be right at every one of them.
    """
    print(f"{'what it exercises':36s} {'events':>7} {'ttl':>6} {'cap':>4} {'true':>6} "
          f"{'expiry':>7} {'restarts':>9} {'held':>6} {'+ttl':>6} {'saved':>6} "
          f"{'reads':>6} {'writes':>7}")
    for label, signals, ttl, cap, want_expiry, want_restarts in EXAMPLES:
        truth = true_scores(signals)
        forever, _ = score_in_memory_forever(signals)
        stored, held_between, _ = score_in_a_store(signals)
        cached, reads, writes, _ = score_with_cache(signals, cap)
        expired, _, restarts = score_with_expiry(signals, ttl)
        day = max((t for *_, t in signals), default=0)
        held = held_at(signals, INFINITY, day)
        held_ttl = held_at(signals, ttl, day)
        true_total = sum(truth.values())
        assert sum(expired.values()) == want_expiry, (label, sum(expired.values()), want_expiry)
        assert restarts == want_restarts, (label, restarts, want_restarts)
        assert forever == truth, (label, "keeping everything must be exact")
        assert stored == truth, (label, "the store must be exact")
        assert cached == truth, (label, "and so must the cache, at every capacity")
        assert held_between == 0, (label, "the streaming layer holds nothing between events")
        for acct in truth:
            assert expired.get(acct, 0) <= truth[acct], (label, acct)   # only ever too low
        ttl_s = "never" if ttl == INFINITY else str(ttl)
        print(f"{label:36s} {len(signals):>7,} {ttl_s:>6} {cap:>4} {true_total:>6,} "
              f"{sum(expired.values()):>7,} {restarts:>9,} {held:>6,} {held_ttl:>6,} "
              f"{held - held_ttl:>6,} {reads:>6,} {writes:>7,}")
    print(f"all {len(EXAMPLES)} examples agree with the true lifetime score")
    print()


def true_scores(signals):
    """The requirement, written out directly: every point an account ever earned."""
    out = {}
    for acct, pts, _ in signals:
        out[acct] = out.get(acct, 0) + pts
    return out


def score_in_memory_forever(signals):
    """Answer one: keep every account's score in memory and never release it.

    Correct, and it is the answer the requirement literally asks for, which is why it is the
    one to put first.  Its state is one number per account EVER SEEN, and that count only
    rises, so the process is a slow leak with a correct output.  Returns (scores, peak_held).
    """
    acc, peak = {}, 0
    for acct, pts, _ in signals:
        acc[acct] = acc.get(acct, 0) + pts
        peak = max(peak, len(acc))
    return acc, peak


def score_with_expiry(signals, ttl):
    """Answer two: the chapter's bound, applied to the score.

    Memory becomes bounded by active accounts, and a dormant account's score is deleted.  The
    next event from it looks like a first event, so the score restarts at zero -- which is not
    a degraded answer but the WRONG answer to the question asked, and an answer an adversary
    can arrange.  Returns (scores_in_memory, peak_held, restarts).
    """
    acc, last, restarts, peak = {}, {}, 0, 0
    seen_before = set()
    for acct, pts, t in signals:
        for old in [k for k in acc if t - last[k] > ttl]:
            del acc[old]
            del last[old]
        if acct not in acc and acct in seen_before:
            restarts += 1
        acc[acct] = acc.get(acct, 0) + pts
        last[acct] = t
        seen_before.add(acct)
        peak = max(peak, len(acc))
    return acc, peak, restarts


def score_in_a_store(signals):
    """Answer three: the score is not stream state.  Read it, add to it, write it back, and
    hold nothing.

    The mechanism is that the streaming layer's memory no longer depends on the account count
    at all -- between two events it holds zero scores, so there is no quantity to bound and
    the memory question has been dissolved rather than answered.  The cost moves to the store:
    one read and one write per event.  Returns (store, held_between_events, store_ops).
    """
    store, high_water, ops = {}, 0, 0
    for acct, pts, _ in signals:
        held = {}                                  # the streaming layer, between events
        high_water = max(high_water, len(held))
        held[acct] = store.get(acct, 0) + pts      # read
        ops += 1
        store[acct] = held.pop(acct)               # update, write, forget
        ops += 1
    return store, high_water, ops


def score_with_cache(signals, capacity):
    """Answer three with the obvious optimisation: a cache of `capacity` accounts in front of
    the store, evicting the least recently used.

    This is the chapter's bound again -- a fixed number of accounts in memory and the rest
    dropped -- and it is CORRECT at every capacity, including zero.  The difference is one
    line: an evicted account is written to the store on its way out, so the next event for it
    reads the score back rather than starting from nothing.  A miss costs a read; an expiry
    cost the answer.  Returns (scores, store_reads, store_writes, peak_held).
    """
    store, cache = {}, {}
    reads = writes = peak = 0
    for acct, pts, _ in signals:
        if acct in cache:
            val = cache.pop(acct)                  # a hit, and it becomes most-recent below
        else:
            reads += 1
            val = store.get(acct, 0)               # a miss: the score is still there
        cache[acct] = val + pts
        while len(cache) > capacity:
            oldest = next(iter(cache))             # dicts keep insertion order: LRU first
            store[oldest] = cache.pop(oldest)
            writes += 1
        peak = max(peak, len(cache))
    for acct, val in cache.items():
        store[acct] = val
        writes += 1
    return store, reads, writes, peak


def held_at(signals, ttl, t):
    """How many scores an expiring memory holds on day t, if nothing arrives then.  Counting
    at the end of the run is the wrong measurement, because an expiry is immediately followed
    by the event that re-creates the entry."""
    last = {}
    for acct, _, at in signals:
        if at <= t:
            last[acct] = at
    return sum(1 for a in last if t - last[a] <= ttl)


def main():
    show_examples()
    truth = true_scores(SIGNALS)
    print("SIGNALS =", "  ".join(f"{a}@{t}:+{p}" for a, p, t in SIGNALS))
    print(f"  true lifetime scores {truth};  account 'a' is dormant for {DORMANCY} days\n")

    forever, peak_forever = score_in_memory_forever(SIGNALS)
    expired, peak_exp, restarts = score_with_expiry(SIGNALS, DORMANCY - 1)
    stored, held_between, ops = score_in_a_store(SIGNALS)
    cached, reads, writes, peak_cache = score_with_cache(SIGNALS, capacity=1)
    print(f"  in memory forever   : {forever}   ({peak_forever} scores held, grows forever)")
    print(f"  with a {DORMANCY - 1}-day expiry : {expired}   ({peak_exp} held, {restarts} restart)   WRONG")
    print(f"  in a store          : {stored}   ({held_between} held between events, {ops} store ops)")
    print(f"  store + 1-slot cache: {cached}   ({peak_cache} held, {reads} reads, {writes} writes)")

    assert forever == truth == {"a": 24, "b": 21}, forever
    assert stored == truth, "the store must be exact; that is the only reason to accept it"
    assert cached == truth, "and a one-account cache must not change the answer"
    assert expired != truth and expired["a"] == 8, expired
    assert restarts == 1 and truth["a"] - expired["a"] == 16
    assert held_between == 0, "the streaming layer must hold nothing between events"
    assert ops == 2 * len(SIGNALS), ops
    print(f"\n  the expiry lost {truth['a'] - expired['a']} of account 'a''s {truth['a']} points because it was quiet for {DORMANCY}")
    print(f"  days and the allowance was {DORMANCY - 1}.  The store holds {held_between} scores between events, so its")
    print(f"  memory does not depend on the account count at all -- the question is dissolved,")
    print(f"  not answered, and the price is {ops} store operations for {len(SIGNALS)} events.")

    # the expiry's error is one-directional, and that direction is the whole problem
    for acct in truth:
        assert expired.get(acct, 0) <= truth[acct], acct
    assert not any(expired.get(a, 0) > truth[a] for a in truth), "it can only understate"
    laundering = [("mule", 20, 0), ("mule", 4, DORMANCY)]
    washed, _, _ = score_with_expiry(laundering, DORMANCY - 1)
    kept, _, _ = score_with_expiry(laundering, DORMANCY)
    assert washed == {"mule": 4} and kept == {"mule": 24}, (washed, kept)
    print(f"\n  and the direction matters: a score can only come out too LOW.  An account that")
    print(f"  earns 20 points, waits {DORMANCY} days and earns 4 more scores {washed['mule']} at a {DORMANCY - 1}-day allowance")
    print(f"  and {kept['mule']} at a {DORMANCY}-day one -- so the allowance is a published schedule for")
    print(f"  resetting a risk score, which is the one thing a risk score must not have.")

    # the cache is the same bound with the opposite consequence, at every capacity
    print(f"\n  the same bound, on a cache instead of on the state:")
    print(f"    {'capacity':>9} {'scores':>18} {'held':>5} {'reads':>6} {'writes':>7}")
    sweep = []
    for cap in (0, 1, 2, 3, 10):
        got, r, w, pk = score_with_cache(SIGNALS, cap)
        sweep.append((cap, r, w, pk))
        print(f"    {cap:>9} {str(got):>18} {pk:>5} {r:>6} {w:>7}")
        assert got == truth, (cap, got)
    assert all(sweep[i][1] >= sweep[i + 1][1] for i in range(len(sweep) - 1)), sweep
    assert sweep[0][1] == len(SIGNALS), "capacity 0 means every event reads the store"
    assert sweep[-1][1] == len(truth), "a cache bigger than the data reads once per account"
    assert sweep[0][3] == 0 and sweep[-1][3] == len(truth)
    print(f"    every capacity is EXACT, and the reads fall from {sweep[0][1]} to {sweep[-1][1]} as the cache grows.")
    print(f"    Bounding the cache costs store reads; bounding the state cost the answer.  The")
    print(f"    difference is one line -- the evicted score is written out instead of deleted.")

    # ...including for the dormant account the whole requirement is about
    cap1, _, _, _ = score_with_cache(SIGNALS, 1)
    assert cap1["a"] == TRUE["a"] if False else cap1["a"] == truth["a"]
    assert cap1["a"] == 24, cap1
    print(f"\n  account 'a' is evicted from a 1-slot cache repeatedly and still scores {cap1['a']}: its")
    print(f"  dormancy evicts it from MEMORY and not from the store, which is the distinction")
    print(f"  the word 'expire' was hiding.")

    # boundaries
    assert score_in_a_store([]) == ({}, 0, 0), "an empty stream has no scores and no ops"
    assert score_with_cache([], 5)[0] == {}, "and no cache contents"
    assert score_with_expiry(SIGNALS, 0)[0] == {"a": 8}, score_with_expiry(SIGNALS, 0)[0]
    assert score_with_cache(SIGNALS, 0)[0] == truth, "a zero-capacity cache is write-through"
    one_event = [("solo", 7, 0)]
    assert score_in_a_store(one_event)[0] == {"solo": 7}
    assert score_with_cache(one_event, 0) == ({"solo": 7}, 1, 1, 0)
    print(f"\n  boundaries: an empty stream gives no scores and no store operations; a ttl of 0")
    print(f"  reduces the expiring version to {score_with_expiry(SIGNALS, 0)[0]}, i.e. the last event only, while a")
    print(f"  zero-capacity cache is a write-through store and is still exact.")

    # many inputs: the cache is exact at every capacity, the expiry never is safe
    rng = random.Random(20260303)
    exact_runs, wrong_runs = 0, 0
    for _ in range(400):
        n = rng.randint(1, 18)
        ev = sorted(((rng.choice("abcde"), rng.randint(1, 9), rng.randint(0, 400))
                     for _ in range(n)), key=lambda e: e[2])
        want = true_scores(ev)
        assert score_in_memory_forever(ev)[0] == want, ev
        assert score_in_a_store(ev)[0] == want, ev
        prev_reads = None
        for cap in range(0, 7):
            got, r, w, pk = score_with_cache(ev, cap)
            assert got == want, (ev, cap)
            assert pk <= cap, (ev, cap, pk)
            if prev_reads is not None:
                assert r <= prev_reads, (ev, cap, r, prev_reads)   # LRU: more cache, fewer reads
            prev_reads = r
        for ttl in (0, 5, 50, 400):
            got, _, _ = score_with_expiry(ev, ttl)
            assert all(got.get(a, 0) <= want[a] for a in want), (ev, ttl)
            if got == want:
                exact_runs += 1
            else:
                wrong_runs += 1
    print(f"\n  400 random signal streams: the store and every cache capacity from 0 to 6 returned")
    print(f"  the true lifetime score every single time, with reads falling monotonically as the")
    print(f"  cache grew.  The expiring version was right in {exact_runs:,} of {exact_runs + wrong_runs:,} runs and too low in {wrong_runs:,},")
    print(f"  never once too high -- so it is not noisy, it is biased, and biased the way an")
    print(f"  attacker would choose.")
    assert (exact_runs, wrong_runs) == (481, 1119), (exact_runs, wrong_runs)
    assert wrong_runs > 0 and exact_runs > 0

    # the scale that forces the decision
    big = [(f"once{i}", 1, i) for i in range(1, ONEOFF + 1)]
    big += [("regular", 1, t) for t in range(5, ONEOFF, 10)]
    big.sort(key=lambda e: e[2])
    big_true = true_scores(big)
    big_end = max(t for *_, t in big)
    unbounded_held = held_at(big, INFINITY, big_end)
    bounded_held = held_at(big, BIG_TTL, big_end)
    _, store_held, store_ops = score_in_a_store(big)
    _, cache_reads, cache_writes, cache_peak = score_with_cache(big, 64)
    big_expired, _, big_restarts = score_with_expiry(big, BIG_TTL)
    print(f"\n  at {ONEOFF:,} accounts seen once plus one regular, on day {big_end}:")
    print(f"    in memory forever : {unbounded_held:,} scores held")
    print(f"    with a {BIG_TTL}-day expiry: {bounded_held} held, {big_restarts} restarts -- and every score still in")
    print(f"      memory is CORRECT, while {len(big_true) - len(big_expired):,} accounts' scores are simply gone")
    print(f"    in a store        : {store_held} held between events, {store_ops:,} store operations")
    print(f"    64-slot cache     : {cache_peak} held, {cache_reads:,} reads, {cache_writes:,} writes")
    assert (unbounded_held, bounded_held) == (2001, 102), (unbounded_held, bounded_held)
    assert store_held == 0 and store_ops == 2 * len(big)
    assert cache_peak == 64 and cache_reads < store_ops // 2
    assert score_with_cache(big, 64)[0] == big_true, "exact at scale"
    assert big_expired.get("regular") == big_true["regular"], "the regular account is never idle"
    # MEASURED, and it is the uncomfortable half of the story: at this scale the expiry
    # restarts NOTHING and every score it still holds is exact, because an account seen once
    # cannot be restarted and the regular account never goes quiet.  So the scale that
    # justifies the bound is precisely the scale at which its cost is invisible -- the damage
    # needs a dormant-then-returning account, which is the small example, not this one.
    assert big_restarts == 0, big_restarts
    assert all(big_expired[a] == big_true[a] for a in big_expired), "the live scores are exact"
    assert len(big_expired) < len(big_true), "but most accounts are no longer anywhere"
    print(f"    the expiry restarts nothing HERE, because a one-visit account cannot be restarted")
    print(f"    and the regular one never goes quiet -- the scale that justifies the bound is the")
    print(f"    scale at which its cost is invisible.  The cache holds {cache_peak} and is exact for all")
    print(f"    {len(big_true):,} accounts, trading {cache_reads:,} store reads for the {unbounded_held - cache_peak:,} scores it does not hold.")
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
