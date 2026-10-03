#!/usr/bin/env python3
"""Variation 4 — the retry that must not re-send (looks like notifications). Standalone and
runnable.

  A worker reads items from a queue and sends one push notification per item.  A crash must
  not send it twice.  The push service has NO transaction and NO idempotency key, and a person
  reads the notification, so a duplicate is not harmless.

Every tool the chapter had is gone: no transaction, no idempotency at the far end, and an
effect that cannot be made invisible.  So the question is not how to avoid the choice but WHICH
GUARANTEE TO GIVE UP, and the answer depends on the message rather than on the code -- for "your
parcel has arrived" a duplicate is mild and a loss is bad, so at-least-once; for "you have been
charged" the reverse, so at-most-once with the record written BEFORE sending.  Arriving at
"there is no correct answer without knowing what the message is" is the answer, and it is the
opposite of what the first reading of the question invites.  The local dedupe set that looks
like a third option is measured below and shown to be the same two orderings renamed.

WORKED EXAMPLES: the EXAMPLES table below holds 21 input/output pairs -- the first and last
item of the queue as crash points, the middle one the trace follows, both sides of the crash
boundary (a crash versus no crash) in both orderings, a crash point past the end that never
fires, both sides of the dedupe boundary (remember-then-send against send-then-remember), both
sides of the far-end idempotency key including the case where the key does NOT rescue the
design, an empty queue and a one-item queue, a run crashed at every item at once, and a
20,000-item queue at scale; each row prices its own outcome for both messages, so the row
shows which message it is acceptable for.  Every row is ASSERTED, so the table cannot drift
from the code.

Run it:  python3 programs/ch05_v4.py
"""

import random
from collections import Counter

# The chapter's nine items, unchanged.  Values DISTINCT and non-zero for the chapter's reason:
# here the value is the notification's content, so two identical messages would make a
# duplicate unattributable.
ITEMS = [(0, 5), (1, 3), (2, 7), (3, 2), (4, 6), (5, 1), (6, 9), (7, 4), (8, 8)]
N = len(ITEMS)
C = 3                                       # the crash point the printed trace follows

# What a duplicate and a loss are WORTH, for two real messages.  These are the only numbers in
# this file that are not derived from the data, and that is the point: they come from the
# product, not from the code, and they are what decides the design.
PROFILES = {
    "your parcel has arrived": {"duplicate": 1, "loss": 20},
    "you have been charged":   {"duplicate": 50, "loss": 2},
}

# A one-item queue, an empty queue, and a 20,000-item queue at the scale a real notification
# backlog reaches.  ALL means "crashed at every item in one run".  These are inputs for the
# examples table, not alternative versions of the problem.
ONE_ITEM = [(0, 5)]
EMPTY_QUEUE = []
BIG_QUEUE = [(i, 1 + i % 7) for i in range(20_000)]
BIG_MID = len(BIG_QUEUE) // 2
ALL = "all"

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, items, ordering, crash point, far-end key, (duplicated ids, lost ids)).
# Every row is asserted by show_examples() against the program AND against a closed form for
# the send sequence the ordering forces, which is why the table is data and not a comment: a
# comment can go stale silently, and this cannot.
EXAMPLES = [
    ("effect-first, crash on the FIRST item",   ITEMS,       "effect_then_position", 0,       False, ([0], [])),
    ("effect-first, the traced middle item",    ITEMS,       "effect_then_position", C,       False, ([3], [])),
    ("effect-first, crash on the LAST item",    ITEMS,       "effect_then_position", N - 1,   False, ([8], [])),
    ("effect-first, no crash at all",           ITEMS,       "effect_then_position", None,    False, ([], [])),
    ("crash point past the end never fires",    ITEMS,       "effect_then_position", 99,      False, ([], [])),
    ("position-first, FIRST item (mirrored)",   ITEMS,       "position_then_effect", 0,       False, ([], [0])),
    ("position-first, crash on the LAST item",  ITEMS,       "position_then_effect", N - 1,   False, ([], [8])),
    ("position-first, no crash at all",         ITEMS,       "position_then_effect", None,    False, ([], [])),
    ("send-then-remember == effect-first",      ITEMS,       "send_then_dedupe",     C,       False, ([3], [])),
    ("remember-then-send == position-first",    ITEMS,       "dedupe_then_send",     C,       False, ([], [3])),
    ("effect-first, crashed at EVERY item",     ITEMS,       "effect_then_position", ALL,     False, ([0, 1, 2, 3, 4, 5, 6, 7, 8], [])),
    ("position-first, crashed at EVERY item",   ITEMS,       "position_then_effect", ALL,     False, ([], [0, 1, 2, 3, 4, 5, 6, 7, 8])),
    ("far-end key rescues effect-first",        ITEMS,       "effect_then_position", C,       True,  ([], [])),
    ("far-end key does NOT rescue position",    ITEMS,       "position_then_effect", C,       True,  ([], [3])),
    ("far-end key, crashed at EVERY item",      ITEMS,       "effect_then_position", ALL,     True,  ([], [])),
    ("empty queue: nothing to send",            EMPTY_QUEUE, "effect_then_position", 0,       False, ([], [])),
    ("one item, effect-first, crash on it",     ONE_ITEM,    "effect_then_position", 0,       False, ([0], [])),
    ("one item, position-first, crash on it",   ONE_ITEM,    "position_then_effect", 0,       False, ([], [0])),
    ("20,000 items, effect-first, midway",      BIG_QUEUE,   "effect_then_position", BIG_MID, False, ([10000], [])),
    ("20,000 items, position-first, midway",    BIG_QUEUE,   "position_then_effect", BIG_MID, False, ([], [10000])),
    ("20,000 items, far-end key, midway",       BIG_QUEUE,   "effect_then_position", BIG_MID, True,  ([], [])),
]


def run(items, order, crash_at, far_end_key=False):
    """Run the worker, crash it at the listed items, restart it, and return what the PHONE
    received -- a list of item ids in send order, which is what a person sees.

    order:
      "effect_then_position" -- push, then record the position.  A crash in between has sent
          the notification with no record of it, so the restart sends it again: at-least-once.
      "position_then_effect" -- record the position, then push.  A crash in between has
          recorded the item as handled without sending it, and nothing will ever notice:
          at-most-once.
      "dedupe_then_send"     -- remember the id in a durable set first, then push.
      "send_then_dedupe"     -- push, then remember the id.
    The last two are the local-dedupe idea, which looks like a third option.

    `far_end_key` models the feature the question says is absent: the push service itself
    dropping a repeat of a key it has already seen.  It is here to show that what fixes this is
    a property of the far end and not a cleverer worker.
    """
    pos, sent, marks, fired = 0, [], set(), set()
    seen_at_far_end = set()

    def push(eid, value):
        if far_end_key and eid in seen_at_far_end:
            return                            # the far end swallows the repeat
        seen_at_far_end.add(eid)
        sent.append(eid)

    while pos < len(items):
        crashed = False
        for i in range(pos, len(items)):
            eid, v = items[i]
            die = i in crash_at and i not in fired
            if order == "effect_then_position":
                push(eid, v)
                if die:
                    fired.add(i)
                    crashed = True
                    break
                pos = i + 1
            elif order == "position_then_effect":
                pos = i + 1
                if die:
                    fired.add(i)
                    crashed = True
                    break
                push(eid, v)
            elif order == "send_then_dedupe":
                if eid not in marks:
                    push(eid, v)
                if die:
                    fired.add(i)
                    crashed = True
                    break
                marks.add(eid)
                pos = i + 1
            else:                             # dedupe_then_send
                if eid in marks:
                    pos = i + 1
                    continue
                marks.add(eid)
                if die:
                    fired.add(i)
                    crashed = True
                    break
                push(eid, v)
                pos = i + 1
        if not crashed:
            break
    return sent


def tally(items, sent):
    """(duplicates, losses) as lists of item ids.  A duplicate is an id a person saw more than
    once; a loss is one they never saw.  Counted rather than inferred from a total, because a
    total cannot tell a duplicate of 5 from a loss of 5 plus a duplicate of 10."""
    counts = Counter(sent)
    dups = [eid for eid, _ in items if counts[eid] > 1]
    lost = [eid for eid, _ in items if counts[eid] == 0]
    return dups, lost


def expected_cost(items, order, profile):
    """The average cost of one crash, over every crash point, for one ordering and one message.

    Averaging over crash points is the honest model: a crash lands where it lands, and the
    design has to be chosen before knowing where."""
    total = 0.0
    for c in range(len(items)):
        dups, lost = tally(items, run(items, order, {c}))
        total += len(dups) * profile["duplicate"] + len(lost) * profile["loss"]
    return total / len(items)


def show_examples():
    """Print the examples table and assert every row, twice over.

    The second check is a closed form for the send sequence: effect-first repeats the
    straddling item, so the phone sees ids[:c+1] + ids[c:], and position-first skips it, so it
    sees ids[:c] + ids[c+1:].  It is written out here with no reference to `run`, so a row has
    to agree with the program and with the rule the program claims to implement.  A run
    crashed at EVERY item has no closed form -- the send order after repeated restarts is an
    implementation detail -- so those rows are checked on the tally alone.

    The two cost columns price the SAME outcome for BOTH messages, which is the whole point of
    the variation: a duplicate is cheap for a parcel notice and expensive for a charge notice,
    so the identical row is acceptable under one message and not the other.  Rows that cost
    nothing either way -- a clean run, or a crash under a far-end key -- are the ties, and
    they are the only rows where the choice does not have to be made.
    """
    parcel, charged = PROFILES["your parcel has arrived"], PROFILES["you have been charged"]

    def price(dups, lost, profile):
        return len(dups) * profile["duplicate"] + len(lost) * profile["loss"]

    def closed_form(ids, order, crash_at, key):
        """What the phone must see, derived from the ordering rather than from `run`."""
        if crash_at is None or crash_at >= len(ids):
            return list(ids)
        if key and order in ("effect_then_position", "send_then_dedupe"):
            return list(ids)                      # the far end swallows the repeat
        if order in ("effect_then_position", "send_then_dedupe"):
            return ids[:crash_at + 1] + ids[crash_at:]
        return ids[:crash_at] + ids[crash_at + 1:]

    def short(ids):
        return str(ids) if len(ids) <= 3 else f"{len(ids)} items"

    print(f"{'what it exercises':42s} {'items':>6} {'ordering':>20} {'crash':>5} {'key':>5} "
          f"{'duplicated':>11} {'lost':>11} {'parcel':>7} {'charge':>7} {'better for':>10}")
    for label, items, order, crash_at, key, want in EXAMPLES:
        ids = [eid for eid, _ in items]
        crashes = (set(range(len(items))) if crash_at == ALL
                   else set() if crash_at is None else {crash_at})
        sent = run(items, order, crashes, far_end_key=key)
        dups, lost = tally(items, sent)
        assert (dups, lost) == want, (label, (dups, lost), want)

        if crash_at != ALL:
            ref = closed_form(ids, order, crash_at, key)
            assert sent == ref, (label, 'the rule disagrees', sent[:12], ref[:12])

        p, ch = price(dups, lost, parcel), price(dups, lost, charged)
        better = 'parcel' if p < ch else 'charge' if ch < p else 'either'
        shown = 'all' if crash_at == ALL else 'none' if crash_at is None else str(crash_at)
        print(f"{label:42s} {len(items):>6} {order:>20} {shown:>5} {str(key):>5} "
              f"{short(dups):>11} {short(lost):>11} {p:>7} {ch:>7} {better:>10}")
    print(f"all {len(EXAMPLES)} examples agree with the send sequence their ordering forces")
    print()


def main():
    show_examples()
    clean = {o: run(ITEMS, o, set()) for o in
             ("effect_then_position", "position_then_effect", "dedupe_then_send", "send_then_dedupe")}
    want = [eid for eid, _ in ITEMS]
    for o, s in clean.items():
        assert s == want, (o, s)
    print(f"ITEMS = {[eid for eid, _ in ITEMS]}, values {[v for _, v in ITEMS]}")
    print(f"  with no crash, all four orderings send exactly {want}\n")

    at_least = run(ITEMS, "effect_then_position", {C})
    at_most = run(ITEMS, "position_then_effect", {C})
    print(f"  crash during item {C}:")
    print(f"    effect then position : {at_least}   -> {tally(ITEMS, at_least)}")
    print(f"    position then effect : {at_most}   -> {tally(ITEMS, at_most)}")
    assert tally(ITEMS, at_least) == ([C], []), tally(ITEMS, at_least)
    assert tally(ITEMS, at_most) == ([], [C]), tally(ITEMS, at_most)
    assert at_least.count(C) == 2 and C not in at_most

    # ---- every crash point, and the two guarantees are exactly complementary
    for c in range(N):
        dl, ll = tally(ITEMS, run(ITEMS, "effect_then_position", {c}))
        dm, lm = tally(ITEMS, run(ITEMS, "position_then_effect", {c}))
        assert (dl, ll) == ([c], []), (c, dl, ll)
        assert (dm, lm) == ([], [c]), (c, dm, lm)
    print(f"\n  at all {N} crash points: effect-first duplicates exactly the straddling item and")
    print(f"  loses nothing; position-first loses exactly it and duplicates nothing.  Neither")
    print(f"  ever gets both right, and no crash point escapes either way.")
    # the opposite outcome is forbidden
    assert not any(tally(ITEMS, run(ITEMS, "effect_then_position", {c})) == ([], []) for c in range(N))
    assert not any(tally(ITEMS, run(ITEMS, "position_then_effect", {c})) == ([], []) for c in range(N))
    # and crashing at EVERY item in one run duplicates or loses every one of them
    all_dup = tally(ITEMS, run(ITEMS, "effect_then_position", set(range(N))))
    all_lost = tally(ITEMS, run(ITEMS, "position_then_effect", set(range(N))))
    assert all_dup == (want, []), all_dup
    assert all_lost == ([], want), all_lost
    print(f"  crashed at every item in one run: {len(all_dup[0])} duplicates and 0 losses one way,")
    print(f"  0 duplicates and {len(all_lost[1])} losses the other -- {N} of {N} either way.")

    # ---- the local dedupe set, which looks like a third option
    same_a = same_b = 0
    for c in range(N):
        a1 = run(ITEMS, "send_then_dedupe", {c})
        a2 = run(ITEMS, "effect_then_position", {c})
        b1 = run(ITEMS, "dedupe_then_send", {c})
        b2 = run(ITEMS, "position_then_effect", {c})
        assert a1 == a2, (c, a1, a2)
        assert b1 == b2, (c, b1, b2)
        same_a += a1 == a2
        same_b += b1 == b2
    print(f"\n  'just remember what you already sent': the dedupe set is itself a write, so the")
    print(f"  same two instants come back one level down.  Measured over all {N} crash points, the")
    print(f"  phone receives an IDENTICAL sequence:")
    print(f"    send-then-remember == effect-then-position on {same_a}/{N} crash points")
    print(f"    remember-then-send == position-then-effect on {same_b}/{N} crash points")
    assert same_a == same_b == N
    print(f"  so it is not a third option: it is the same choice with the record moved, which is")
    print(f"  what 'the problem is the instant between two writes' means in practice.")

    # ---- what WOULD fix it is a property of the far end
    for c in range(N):
        fixed = run(ITEMS, "effect_then_position", {c}, far_end_key=True)
        assert tally(ITEMS, fixed) == ([], []), (c, fixed)
        assert fixed == want, (c, fixed)
    assert run(ITEMS, "effect_then_position", set(range(N)), far_end_key=True) == want
    print(f"\n  give the push service an idempotency key and effect-first becomes exact at all {N}")
    print(f"  crash points, and at every item at once.  The missing feature is the problem; no")
    print(f"  arrangement of the worker's two writes substitutes for it.")
    # and with the key, the ORDER stops mattering at all -- which is the proof it was the fix
    assert run(ITEMS, "effect_then_position", {C}, far_end_key=True) == want
    assert tally(ITEMS, run(ITEMS, "position_then_effect", {C}, far_end_key=True)) == ([], [C])
    print(f"  note it only rescues the at-least-once side: a key cannot un-skip an item that was")
    print(f"  recorded as handled and never sent, so position-first still loses item {C}.")

    # ---- so the choice is the message's, and the answer flips
    print(f"\n  expected cost of one crash, averaged over all {N} crash points:")
    print(f"    {'message':>24}  {'dup':>4} {'loss':>5}  {'at-least-once':>14}  {'at-most-once':>13}  best")
    best = {}
    for msg, profile in PROFILES.items():
        cheap = expected_cost(ITEMS, "effect_then_position", profile)
        safe = expected_cost(ITEMS, "position_then_effect", profile)
        best[msg] = "at-least-once" if cheap < safe else "at-most-once"
        print(f"    {msg:>24}  {profile['duplicate']:>4} {profile['loss']:>5}  {cheap:>14.1f}  "
              f"{safe:>13.1f}  {best[msg]}")
    assert best["your parcel has arrived"] == "at-least-once", best
    assert best["you have been charged"] == "at-most-once", best
    assert len(set(best.values())) == 2, (
        "the two messages must choose DIFFERENTLY, or the whole answer collapses")
    print(f"  the same nine items, the same two programs, and the better design is opposite for")
    print(f"  the two messages.  Nothing in the code decides it, which is why the answer to this")
    print(f"  question is a question.")
    # and the flip happens at the obvious place, measured rather than assumed
    flip = [d for d in range(1, 60)
            if expected_cost(ITEMS, "effect_then_position", {"duplicate": d, "loss": 20})
            > expected_cost(ITEMS, "position_then_effect", {"duplicate": d, "loss": 20})]
    assert flip and min(flip) == 21, min(flip) if flip else None
    print(f"  holding the cost of a loss at 20, at-least-once stops winning the moment a")
    print(f"  duplicate costs {min(flip)} -- the crossover is exactly where the two costs cross,")
    print(f"  because each design fails on exactly one item per crash.")

    # ---- boundaries
    assert run([], "effect_then_position", {0}) == []
    one = [(0, 5)]
    assert run(one, "effect_then_position", {0}) == [0, 0], run(one, "effect_then_position", {0})
    assert run(one, "position_then_effect", {0}) == []
    assert tally(one, run(one, "effect_then_position", {0})) == ([0], [])
    print(f"\n  boundaries: an empty queue sends nothing under either design; a one-item queue")
    print(f"  crashed on its only item sends it twice one way and never the other -- there is no")
    print(f"  stream short enough for the problem to disappear.")

    # ---- many queues, every crash point, all four orderings
    rng = random.Random(20260303)
    for _ in range(300):
        n = rng.randint(1, 10)
        items = [(i, rng.randint(1, 40)) for i in range(n)]
        ids = [eid for eid, _ in items]
        for c in range(n):
            a = run(items, "effect_then_position", {c})
            b = run(items, "position_then_effect", {c})
            assert tally(items, a) == ([c], []), (items, c, a)
            assert tally(items, b) == ([], [c]), (items, c, b)
            assert run(items, "send_then_dedupe", {c}) == a, (items, c)
            assert run(items, "dedupe_then_send", {c}) == b, (items, c)
            assert run(items, "effect_then_position", {c}, far_end_key=True) == ids
        # crashed at every item in one run: every id duplicated one way, every id lost the
        # other.  Written as a tally rather than a sequence, because the send ORDER after
        # repeated restarts is an implementation detail and the guarantee is not.
        assert tally(items, run(items, "effect_then_position", set(range(n)))) == (ids, [])
        assert tally(items, run(items, "position_then_effect", set(range(n)))) == ([], ids)
    print(f"\n  300 random queues x every crash point: effect-first duplicates exactly one item")
    print(f"  and loses none, position-first the mirror image, the two dedupe variants are")
    print(f"  byte-identical to them, and a far-end key makes effect-first exact every time.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
