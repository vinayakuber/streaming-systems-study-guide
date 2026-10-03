#!/usr/bin/env python3
"""Variation 3 — the counter in two places (looks like analytics). Standalone and runnable.

  Every event increments a counter in a fast store, for the live dashboard, and appends a row
  to a warehouse, for the monthly report.  BOTH MUST AGREE.

Two outputs rather than one output and a position, so there is no store the bookkeeping can
live in and the chapter's transaction is genuinely unavailable -- `together` has nothing to be
together IN.  The honest answer is that it cannot be made exact, and the useful answer is to
pick one store as the source of truth and DERIVE the other from it: the fast counter becomes a
cache rebuilt from the warehouse rather than a second authority, so disagreement becomes
STALENESS instead of INCONSISTENCY.  The difference is made precise below -- a dual-written
pair can land in a state that corresponds to no moment in the event stream at all, while a
derived pair always corresponds to some earlier moment.  The skill is noticing that "both must
agree" is a request to have two sources of truth, and declining it.

WORKED EXAMPLES: the EXAMPLES table below holds 19 input/output pairs -- the first and last
event of the stream as crash points, an ordinary middle one, both sides of the crash boundary
(the last event versus no crash at all) in both write orders, a crash point past the end that
never fires, the rebuild interval on both sides of the staleness bound (every event, every 3,
and an interval longer than the whole stream), the zero-valued event that makes the two stores
AGREE while still being split, a one-event stream, an empty stream that has nothing to split,
and a 3,000-event stream at scale; each row prints what both designs cost for that same input.
Every row is ASSERTED, so the table cannot drift from the code.

Run it:  python3 programs/ch05_v3.py
"""

import random

# The chapter's nine items, unchanged.  All values DISTINCT and none zero, for the chapter's
# reason: an event with no effect would make a disagreement invisible, and two equal values
# would stop a wrong total from identifying which event was lost.  A zero IS injected further
# down, precisely to show what it hides.
ITEMS = [(0, 5), (1, 3), (2, 7), (3, 2), (4, 6), (5, 1), (6, 9), (7, 4), (8, 8)]
CORRECT = sum(v for _, v in ITEMS)          # 45, the chapter's total
N = len(ITEMS)

# How many events between cache rebuilds, for the derived design.  3 is small enough to trace
# and large enough that the cache is visibly behind.
REBUILD_EVERY = 3

# A stream with a zero-valued event, a one-event stream, an empty stream, and a 3,000-event
# stream at scale.  These are inputs for the examples table, not alternative versions of the
# problem.  The big stream's values are all equal, which is fine because those rows test SCALE
# and not whether a wrong total identifies which event was lost.
WITH_ZERO = ITEMS[:4] + [(99, 0)] + ITEMS[4:]
ONE_EVENT = [(0, 5)]
EMPTY_STREAM = []
BIG_ITEMS = [(i, 7) for i in range(3_000)]

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, items, design, crash_at, (counter, warehouse total)).  "derived@k"
# rebuilds the cache every k events.  Every row is asserted by show_examples() against the
# program AND against an independent formula for the same pair, which is why the table is data
# and not a comment: a comment can go stale silently, and this cannot.
EXAMPLES = [
    ("counter-first, crash on the FIRST event",  ITEMS,        "counter_first",   0,     (5, 0)),
    ("counter-first, ordinary middle event",     ITEMS,        "counter_first",   4,     (23, 17)),
    ("counter-first, crash on the LAST event",   ITEMS,        "counter_first",   8,     (45, 37)),
    ("counter-first, no crash at all",           ITEMS,        "counter_first",   None,  (45, 45)),
    ("crash point past the end never fires",     ITEMS,        "counter_first",   99,    (45, 45)),
    ("warehouse-first, FIRST event (sign flip)", ITEMS,        "warehouse_first", 0,     (0, 5)),
    ("warehouse-first, crash on the LAST event", ITEMS,        "warehouse_first", 8,     (37, 45)),
    ("derived@3, crash before anything ran",     ITEMS,        "derived@3",       0,     (0, 0)),
    ("derived@3, middle event, lag 1",           ITEMS,        "derived@3",       4,     (15, 17)),
    ("derived@3, LAST event, lag 2 (the bound)", ITEMS,        "derived@3",       8,     (24, 37)),
    ("derived@3, no crash -> caught up",         ITEMS,        "derived@3",       None,  (45, 45)),
    ("derived@1, rebuild every event, lag 0",    ITEMS,        "derived@1",       8,     (37, 37)),
    ("derived@20, interval > whole stream",      ITEMS,        "derived@20",      None,  (0, 45)),
    ("a ZERO-valued event: the pair AGREES",     WITH_ZERO,    "counter_first",   4,     (17, 17)),
    ("one-event stream, crash on it",            ONE_EVENT,    "counter_first",   0,     (5, 0)),
    ("empty stream: nothing to split",           EMPTY_STREAM, "counter_first",   0,     (0, 0)),
    ("3,000 events, counter-first, midway",      BIG_ITEMS,    "counter_first",   1500,  (10507, 10500)),
    ("3,000 events, derived@500, lag 200",       BIG_ITEMS,    "derived@500",     1700,  (10500, 11900)),
    ("3,000 events, derived@500, no crash",      BIG_ITEMS,    "derived@500",     None,  (21000, 21000)),
]


def prefixes(items):
    """Every total the stream legitimately passes through, in order.  A pair of stores is
    CONSISTENT only if both hold one of these, and the SAME one; it is stale if they hold two
    different ones, and impossible if either holds something not in this list."""
    out, run = [0], 0
    for _, v in items:
        run += v
        out.append(run)
    return out


def dual_write(items, crash_at, counter_first=True):
    """Two writes per event to two different systems, with no transaction available.

    `crash_at` kills the process between the two writes of that event, which is the only
    instant that matters.  Returns (counter, warehouse_total, rows).  Whichever store is
    written first ends up ahead, so the ORDER chooses which store lies, and nothing chooses
    whether one does."""
    counter, rows = 0, []
    for i, (eid, v) in enumerate(items):
        if counter_first:
            counter += v
            if i == crash_at:
                break
            rows.append((eid, v))
        else:
            rows.append((eid, v))
            if i == crash_at:
                break
            counter += v
    return counter, sum(v for _, v in rows), rows


def rebuild(rows):
    """The cache, computed from the warehouse.  This is the whole of the derived design: one
    function, no state of its own, and nothing it can disagree with."""
    return sum(v for _, v in rows)


def derived(items, crash_at, rebuild_every=REBUILD_EVERY):
    """One durable write per event -- the warehouse row -- and a counter REBUILT from it.

    There is no second authority to fall out of step, so a crash cannot split anything: the
    counter either shows the current total or an earlier one.  Returns (counter, rows, lag),
    where lag is how many events the counter is behind at the end."""
    rows, counter, since = [], 0, 0
    for i, (eid, v) in enumerate(items):
        if i == crash_at:
            break
        rows.append((eid, v))                  # the one durable write
        since += 1
        if since >= rebuild_every:
            counter = rebuild(rows)            # the cache catches up
            since = 0
    return counter, rows, since


def retry_until_written(items, crash_at, attempts=2):
    """The appealing fix: if the second write fails, RETRY it.

    It closes the gap whenever the process survives long enough to retry, and it does nothing
    for a crash, because a crash is not a failed call -- there is nobody left to retry.
    `attempts` replays the increment, which is where the asymmetry shows: incrementing twice
    counts twice, while appending a keyed row twice is the same row."""
    counter, rows = 0, []
    for i, (eid, v) in enumerate(items):
        for _ in range(attempts if i == crash_at else 1):
            counter += v                       # NOT idempotent: each retry moves the balance
        for _ in range(attempts if i == crash_at else 1):
            rows = [r for r in rows if r[0] != eid] + [(eid, v)]   # keyed: idempotent
    return counter, sum(v for _, v in rows), rows


def reconcile(counter, rows, direction):
    """A repair pass over a split pair.  Returns (counter, reported_warehouse_total, rows).

    "from_warehouse" recomputes the counter from the rows: the pair agrees AND the reported
    total still equals the sum of the detail.
    "from_counter" writes the counter's value into the warehouse's reported total and leaves
    the rows alone.  The pair agrees too -- and the warehouse's own total no longer matches its
    own rows, which is a worse condition than being behind, because nothing downstream can
    detect it by comparing stores.  Both are one line, and one of them is the derived design
    with extra steps."""
    if direction == "from_warehouse":
        return rebuild(rows), rebuild(rows), rows
    return counter, counter, rows


def show_examples():
    """Print the examples table and assert every row, twice over.

    The second check is an independent formula for the pair -- prefix sums of the values,
    with no reference to dual_write or derived -- so a row has to agree with the program and
    with the rule the program claims to implement.

    The two cost columns are for the SAME input on BOTH designs, so each row shows which one
    is cheaper for it.  `dual` counts durable writes (two per event, one for the event the
    crash straddles).  `derv` counts the one write per event PLUS the rows each rebuild has to
    re-read, because rebuild() sums the whole warehouse every time.  That is why the derived
    design LOSES on most of these rows: its correctness is free and its freshness is not, and
    a short rebuild interval on a long stream is the expensive corner.
    """
    print(f"{'what it exercises':40s} {'events':>6} {'design':>15} {'crash':>5} "
          f"{'counter':>8} {'wh':>8} {'lag':>4} {'dual':>6} {'derv':>7} {'cheaper':>8}")
    for label, items, design, crash_at, want in EXAMPLES:
        vals = [v for _, v in items]
        n = len(items)
        m = n if crash_at is None else min(crash_at, n)      # events that completed a row
        every = int(design.split("@")[1]) if "@" in design else REBUILD_EVERY

        if design.startswith("derived"):
            counter, rows, lag = derived(items, crash_at, every)
            wh = rebuild(rows)
            caught = (m // every) * every
            ref = (sum(vals[:caught]), sum(vals[:m]))
            assert lag == m - caught, (label, lag, m - caught)
        else:
            first = design == "counter_first"
            counter, wh, rows = dual_write(items, crash_at, counter_first=first)
            lag = 0
            if m < n:                                        # the crash really landed
                ahead, behind = sum(vals[:m + 1]), sum(vals[:m])
                ref = (ahead, behind) if first else (behind, ahead)
            else:
                ref = (sum(vals), sum(vals))

        assert (counter, wh) == want, (label, (counter, wh), want)
        assert ref == want, (label, 'the rule disagrees', ref, want)
        assert wh == sum(v for _, v in rows), (label, wh, rows)

        dual = 2 * m + (1 if m < n else 0)
        r = m // every
        derv = m + every * r * (r + 1) // 2
        cheaper = 'derived' if derv < dual else 'dual' if dual < derv else 'tie'
        crash = 'none' if crash_at is None else str(crash_at)
        print(f"{label:40s} {n:>6} {design:>15} {crash:>5} "
              f"{counter:>8} {wh:>8} {lag:>4} {dual:>6} {derv:>7} {cheaper:>8}")
    print(f"all {len(EXAMPLES)} examples agree with the prefix sums of their own stream")
    print()


def main():
    show_examples()
    legal = prefixes(ITEMS)
    print("ITEMS =", "  ".join(f"{e}:{v}" for e, v in ITEMS), f"  total {CORRECT}")
    print(f"the {len(legal)} totals the stream legitimately passes through: {legal}\n")

    # ---- the dual write, at every crash point and in both orders
    print(f"  {'crash':>5}  {'counter-first':>22}  {'warehouse-first':>22}")
    split_c, split_w = [], []
    for c in range(N):
        cc, wc, _ = dual_write(ITEMS, c, counter_first=True)
        cw, ww, _ = dual_write(ITEMS, c, counter_first=False)
        split_c.append((cc, wc))
        split_w.append((cw, ww))
        print(f"  {c:>5}  counter {cc:>3}  wh {wc:>3} ({cc - wc:+d})  "
              f"counter {cw:>3}  wh {ww:>3} ({cw - ww:+d})")
    assert all(a - b == ITEMS[c][1] for c, (a, b) in enumerate(split_c)), split_c
    assert all(b - a == ITEMS[c][1] for c, (a, b) in enumerate(split_w)), split_w
    print(f"\n  the gap is always exactly the straddling event's value, and its SIGN is the write")
    print(f"  order: counter-first leaves the dashboard high, warehouse-first leaves it low.")
    # and no crash point escapes, in either order
    assert not any(a == b for a, b in split_c) and not any(a == b for a, b in split_w)
    assert max(a - b for a, b in split_c) == 9 == max(v for _, v in ITEMS)

    # ---- the precise difference between inconsistency and staleness
    impossible = [(c, p) for c, p in enumerate(split_c) if p[0] != p[1]]
    not_a_moment = [(c, p) for c, p in enumerate(split_c)
                    if not any(p[0] == t and p[1] == t for t in legal)]
    print(f"\n  of the {N} dual-write crash states, {len(not_a_moment)} correspond to NO moment in the")
    print(f"  stream: the pair (counter, warehouse) is not (T, T) for any legal total T.")
    assert len(not_a_moment) == N and len(impossible) == N
    # the derived design: every crash state is a PAST moment, which is the whole claim
    lags = []
    for c in range(N + 1):
        cnt, rows, lag = derived(ITEMS, c if c < N else None)
        wh = rebuild(rows)
        assert cnt in legal and wh in legal, (c, cnt, wh)
        assert cnt <= wh, (c, cnt, wh)
        assert legal.index(cnt) == legal.index(wh) - lag, (c, cnt, wh, lag)
        lags.append(lag)
    print(f"  of the {N + 1} derived crash states, ALL are a legal total paired with an earlier legal")
    print(f"  total -- the counter is behind by {min(lags)} to {max(lags)} events and never wrong.")
    assert max(lags) == REBUILD_EVERY - 1, (lags, REBUILD_EVERY)
    assert min(lags) == 0, lags
    print(f"  the lag is bounded by the rebuild interval ({REBUILD_EVERY}), so it is a number you choose,")
    print(f"  not a number you discover after an incident.")
    # the bound is the parameter, measured across several intervals
    for every in (1, 2, 3, 5, 9, 20):
        worst = max(derived(ITEMS, c, every)[2] for c in range(N + 1))
        assert worst == min(every - 1, N), (every, worst)
    print(f"  rebuild every 1,2,3,5,9,20 events -> worst lag 0,1,2,4,8,{min(20 - 1, N)} events: exactly the")
    print(f"  interval minus one, until the interval exceeds the stream.")

    # ---- the retry, which is the fix everybody reaches for
    r_counter, r_wh, r_rows = retry_until_written(ITEMS, crash_at=4, attempts=2)
    print(f"\n  retrying the writes for event 4 twice: counter {r_counter}, warehouse {r_wh}")
    assert r_wh == CORRECT, r_wh
    assert r_counter == CORRECT + ITEMS[4][1], (r_counter, CORRECT)
    print(f"  the warehouse is still {r_wh} because its row is keyed by event id, so writing it")
    print(f"  twice is writing it once.  The counter is {r_counter}, high by {r_counter - CORRECT} -- an increment")
    print(f"  has no key, so a retry is a second event.  THAT asymmetry is what decides which")
    print(f"  store can be the source of truth: the one whose write can be repeated safely.")
    for c in range(N):
        assert retry_until_written(ITEMS, c, attempts=2)[1] == CORRECT, c
        assert retry_until_written(ITEMS, c, attempts=3)[1] == CORRECT, c
        assert retry_until_written(ITEMS, c, attempts=3)[0] == CORRECT + 2 * ITEMS[c][1], c
    print(f"  at every crash point and for 2 or 3 attempts: the warehouse is always {CORRECT}, and the")
    print(f"  counter is high by one or two copies of the retried event.")

    # ---- reconciliation, and which direction it has to run
    for c in range(N):
        cc, wc, rows = dual_write(ITEMS, c, counter_first=True)
        g_cnt, g_total, g_rows = reconcile(cc, rows, "from_warehouse")
        b_cnt, b_total, b_rows = reconcile(cc, rows, "from_counter")
        assert g_cnt == g_total == rebuild(g_rows) and g_total in legal, (c, g_total)
        assert b_cnt == b_total, "writing the counter into the warehouse does make them agree"
        # CORRECTED.  The expectation was that this lands on a total the stream never had.  It
        # does not: counter-first leaves the counter holding prefix total c+1, which IS a legal
        # total -- what was illegal was the PAIR, not either number.  The real damage is one
        # level down: the warehouse's reported total no longer equals the sum of its own rows,
        # so the corruption is invisible to any check that compares the two stores.
        assert b_total in legal, (c, b_total)
        assert b_total != rebuild(b_rows), (c, b_total, rebuild(b_rows))
        assert b_total - rebuild(b_rows) == ITEMS[c][1], (c, b_total)
    print(f"\n  repairing the {N} split pairs: recomputing the counter FROM the warehouse makes the")
    print(f"  pair agree and leaves the warehouse's total equal to the sum of its own rows.")
    print(f"  Copying the counter INTO the warehouse also makes the pair agree, on a total that")
    print(f"  is even a legal one -- but the warehouse's total is then high by the missing row's")
    print(f"  value at every crash point, so comparing the two stores can no longer detect it.")
    print(f"  and note what the working repair reads: the warehouse.  It was the source of")
    print(f"  truth all along, and the reconcile job is the derived design with extra steps.")

    # ---- the boundary a zero-valued event creates
    with_zero = ITEMS[:4] + [(99, 0)] + ITEMS[4:]
    zc, zw, _ = dual_write(with_zero, 4, counter_first=True)
    print(f"\n  inject one event with value 0 and crash on it: counter {zc}, warehouse {zw} -- they")
    print(f"  AGREE, and the process still died between two writes.")
    assert zc == zw, (zc, zw)
    assert dual_write(with_zero, 4)[0] == dual_write(with_zero, 4)[1]
    # ...and the agreement is not consistency: the row is missing from the warehouse
    _, _, zrows = dual_write(with_zero, 4, counter_first=True)
    assert (99, 0) not in zrows, zrows
    assert len(zrows) == 4, zrows
    print(f"  the row {(99, 0)} is missing from the warehouse all the same, so the row COUNT is")
    print(f"  wrong while the total is right.  Equal totals are evidence of nothing, which is")
    print(f"  why the chapter's items are all non-zero and distinct.")

    # ---- many streams, every crash point, both designs
    rng = random.Random(20260303)
    for _ in range(400):
        n = rng.randint(1, 12)
        items = [(i, rng.randint(1, 40)) for i in range(n)]
        legal_i = prefixes(items)
        for c in range(n):
            cc, wc, _ = dual_write(items, c, counter_first=True)
            cw, ww, _ = dual_write(items, c, counter_first=False)
            assert cc - wc == items[c][1] and ww - cw == items[c][1], (items, c)
            assert not (cc == wc) and not (cw == ww), (items, c)
        for c in range(n + 1):
            every = rng.randint(1, 6)
            cnt, rows, lag = derived(items, c if c < n else None, every)
            wh = rebuild(rows)
            assert cnt in legal_i and wh in legal_i, (items, c, every)
            assert legal_i.index(wh) - legal_i.index(cnt) == lag <= every - 1, (items, c, every)
    print(f"\n  400 random streams x every crash point: the dual write is split by exactly the")
    print(f"  straddling value in the direction the write order chooses, and never agrees; the")
    print(f"  derived pair is always two legal totals a bounded number of events apart.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
