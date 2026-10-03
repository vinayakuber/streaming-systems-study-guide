#!/usr/bin/env python3
"""Crash at any instant, and process each item exactly once.

A worker reads numbered items from a queue, transforms each, and writes the result
to a database.  It also records how far it has read, so a restart resumes instead
of starting over.  The process can die at ANY instant.  No item may be processed
twice, and none may be skipped.

The effect is not idempotent -- it moves a balance -- and the queue redelivers
anything not recorded as read.  There are two writes, and the entire problem is
the instant between them.  Every duplicate and every loss below is produced by
RUNNING the worker with a crash injected and restarting it, not by reasoning
about what would happen.

Run it:  python3 programs/ch05.py
"""
import random

# Data, from tools/gen_ch05_interview.js over tools/stream_seed.js.
# ITEMS: (number, value) per seed event.  The values are all DISTINCT and none is
# zero -- an item with no effect would make a duplicate invisible, and two equal
# values would stop a wrong total from identifying which item was repeated.
ITEMS = [(0, 5), (1, 3), (2, 7), (3, 2), (4, 6), (5, 1), (6, 9), (7, 4), (8, 8)]
N = len(ITEMS)
CORRECT = sum(v for _, v in ITEMS)          # 45
C = 3                                       # the crash point the printed trace follows

def apply_item(total, item):
    """The effect.  NOT idempotent: running it twice moves the balance twice, which
    is exactly what makes a duplicate visible rather than harmless."""
    return total + item[1]

def worker(items, order, crash_at, commit_first=False):
    """Run the worker, crash it during item `crash_at`, restart it, and return the
    durable state it ends with.

    `order` is one of:
      "effect_then_position" -- write the result, then record the position.  A crash
          in between has done the work with no record of it, so the restart repeats it.
      "position_then_effect" -- record the position, then write the result.  A crash
          in between has recorded the item as handled without doing it, so it is
          skipped and nothing will ever notice.
      "together"             -- both writes in one transaction.  A crash leaves both
          or neither; `commit_first` chooses which instant the crash lands on.

    The durable state is `db`; the crash is simply the moment the loop stops and db
    is all that is left.  The restart resumes from the RECORDED position.
    """
    db = {"sum": 0, "pos": 0}
    fired = set()
    while db["pos"] < len(items):
        crashed = False
        for i in range(db["pos"], len(items)):
            die = i in crash_at and i not in fired
            if order == "effect_then_position":
                db["sum"] = apply_item(db["sum"], items[i])
                if die:                      # <- crash HERE: effect written, position not
                    fired.add(i); crashed = True; break
                db["pos"] = i + 1
            elif order == "position_then_effect":
                db["pos"] = i + 1
                if die:                      # <- crash HERE: position written, effect not
                    fired.add(i); crashed = True; break
                db["sum"] = apply_item(db["sum"], items[i])
            else:                            # one transaction: begin ... commit
                if die and not commit_first:  # crash inside: NEITHER write survives
                    fired.add(i); crashed = True; break
                db["sum"] = apply_item(db["sum"], items[i])
                db["pos"] = i + 1            # commit: both durable together
                if die:                      # crash after commit: BOTH survive
                    fired.add(i); crashed = True; break
        if not crashed:
            break
    return db

# The three variations.

def the_file_that_is_half_uploaded(size, crash_after):
    """Variation 1, surface: backups.  Upload a large file, then record success.

    Non-obvious point: the transaction is unavailable (the file store and the record
    are different systems), but the destination NAME is under your control -- so
    writing to a temporary name and RENAMING on completion makes the appearance of
    the file itself the atomic commit.  A partial upload is invisible because
    nothing looks at the temporary name, and there is no `pos` at all: the file's
    existence is the position.  You can often manufacture an atomic step instead of
    needing a transaction.

    Returns (visible_after_crash_with_rename, visible_after_crash_without_rename).
    """
    store = {}
    store["backup.tmp"] = "x" * min(crash_after, size)
    if crash_after >= size:
        store["backup"] = store.pop("backup.tmp")      # the rename IS the commit
    with_rename = store.get("backup")
    direct = {"backup": "x" * min(crash_after, size)}  # written under the real name
    return with_rename, direct["backup"]

def the_counter_in_two_places(values, crash_at):
    """Variation 2, surface: analytics.  A fast counter and a warehouse row, both
    of which must agree.

    Non-obvious point: two OUTPUTS, not one output and a position, so there is no
    store the bookkeeping can live in and the transaction is genuinely unavailable.
    "Both must agree" is a request for two sources of truth, and the answer is to
    decline it: pick one store as the truth and DERIVE the other, so disagreement
    becomes staleness instead of inconsistency.

    Returns (dual_write_pair, derived_pair) at the same crash point.
    """
    counter = warehouse = 0
    for i, v in enumerate(values):
        counter += v                     # write 1
        if i == crash_at:
            break                        # <- crash: the warehouse row never happens
        warehouse += v                   # write 2
    derived = warehouse                  # the cache is rebuilt FROM the warehouse
    return (counter, warehouse), (derived, warehouse)

def the_retry_that_must_not_re_send(values, crash_at):
    """Variation 3, surface: notifications.  One push per item, no transaction at the
    far end and no idempotency key.

    Non-obvious point: every tool is gone, and the effect is visible to a human so a
    duplicate is not harmless.  The question becomes which guarantee to give up, and
    that depends on the MESSAGE rather than on the code -- "your parcel arrived"
    prefers a duplicate, "you have been charged" prefers a loss.  Arriving at "there
    is no correct answer without knowing what the message is" is the answer.

    Returns (sent_at_least_once, sent_at_most_once) for the same crash point: the
    first repeats one notification, the second drops one, and nothing gives both.
    """
    at_least = worker([(i, v) for i, v in enumerate(values)],
                      "effect_then_position", {crash_at})["sum"]
    at_most = worker([(i, v) for i, v in enumerate(values)],
                     "position_then_effect", {crash_at})["sum"]
    return at_least, at_most

def main():
    print("ITEMS =", "  ".join(f"{n}:{v}" for n, v in ITEMS), f"  total {CORRECT}")
    clean = {o: worker(ITEMS, o, set())["sum"]
             for o in ("effect_then_position", "position_then_effect", "together")}
    print(f"  no crash, every ordering: {sorted(set(clean.values()))}")
    assert set(clean.values()) == {CORRECT}, clean

    effect = [worker(ITEMS, "effect_then_position", {c})["sum"] for c in range(N)]
    posn = [worker(ITEMS, "position_then_effect", {c})["sum"] for c in range(N)]
    atomic = [worker(ITEMS, "together", {c})["sum"] for c in range(N)]
    after = [worker(ITEMS, "together", {c}, commit_first=True)["sum"] for c in range(N)]
    print(f"  crash during item {C} (value {ITEMS[C][1]}):")
    print(f"    effect then position : {effect[C]}  ({effect[C] - CORRECT:+d})")
    print(f"    position then effect : {posn[C]}  ({posn[C] - CORRECT:+d})")
    print(f"    one transaction      : {atomic[C]}  (exact)")
    print(f"  all {N} crash points:")
    print(f"    effect first  {effect}  -> {sum(1 for s in effect if s > CORRECT)}/{N} duplicate")
    print(f"    position first {posn}  -> {sum(1 for s in posn if s < CORRECT)}/{N} lose")
    print(f"    transactional {atomic}  -> {sum(1 for s in atomic if s == CORRECT)}/{N} exact")

    dupes = [s for s in effect if s > CORRECT]
    losses = [s for s in posn if s < CORRECT]
    assert len(dupes) == N, f"only {len(dupes)} of {N} crash points duplicated"
    assert len(losses) == N, f"only {len(losses)} of {N} crash points lost"
    assert effect == [50, 48, 52, 47, 51, 46, 54, 49, 53], effect
    assert posn == [40, 42, 38, 43, 39, 44, 36, 41, 37], posn
    # the error is exactly one item's value, in each direction -- so it is not a
    # vague corruption, it is the item that straddled the crash
    assert all(effect[c] - CORRECT == ITEMS[c][1] for c in range(N))
    assert all(CORRECT - posn[c] == ITEMS[c][1] for c in range(N))
    assert max(effect) - CORRECT == 9 and CORRECT - min(posn) == 9
    # and the opposite outcome is forbidden: no crash point may come out right
    assert CORRECT not in effect and CORRECT not in posn, "some ordering got lucky"
    # one transaction: exact whichever side of the commit the crash lands on
    assert atomic == [CORRECT] * N, atomic
    assert after == [CORRECT] * N, after
    # and exact even when it is crashed at EVERY item in one run
    assert worker(ITEMS, "together", set(range(N)))["sum"] == CORRECT
    assert worker(ITEMS, "effect_then_position", set(range(N)))["sum"] == CORRECT + CORRECT, (
        "crashing at every item must duplicate every item")
    print(f"  crashed at every item at once: transactional {CORRECT}, effect-first "
          f"{worker(ITEMS, 'effect_then_position', set(range(N)))['sum']}")

    # variations
    good, bad = the_file_that_is_half_uploaded(size=10, crash_after=6)
    assert good is None, "a partial upload must not be visible under the real name"
    assert bad == "xxxxxx", bad
    done, _ = the_file_that_is_half_uploaded(size=10, crash_after=10)
    assert done == "x" * 10, done
    print(f"\n  half-uploaded file: with rename {good!r}, written directly {bad!r}")

    dual, derived = the_counter_in_two_places([5, 3, 7, 2], crash_at=2)
    assert dual[0] != dual[1], "the dual write must be caught disagreeing"
    assert derived[0] == derived[1], "the derived cache must always agree"
    assert any(the_counter_in_two_places([5, 3, 7, 2], c)[0][0]
               != the_counter_in_two_places([5, 3, 7, 2], c)[0][1] for c in range(4))
    print(f"  counter in two places: dual write {dual} disagree, derived {derived} agree")

    al, am = the_retry_that_must_not_re_send([5, 3, 7, 2], crash_at=1)
    assert al > 17 and am < 17, (al, am)
    assert al - 17 == 3 and 17 - am == 3, "the gap must be exactly the item's value"
    assert not any(the_retry_that_must_not_re_send([5, 3, 7, 2], c) == (17, 17) for c in range(4)), (
        "no crash point may give both guarantees at once -- that is the whole point")
    print(f"  push notification: at-least-once {al}, at-most-once {am}, true 17 -- pick one")

    # brute force over many inputs, not just the one example
    rng = random.Random(20260303)
    for _ in range(400):
        n = rng.randint(1, 12)
        items = [(i, rng.randint(1, 40)) for i in range(n)]
        total = sum(v for _, v in items)
        for c in range(n):
            assert worker(items, "effect_then_position", {c})["sum"] == total + items[c][1]
            assert worker(items, "position_then_effect", {c})["sum"] == total - items[c][1]
            assert worker(items, "together", {c})["sum"] == total
            assert worker(items, "together", {c}, commit_first=True)["sum"] == total
        assert worker(items, "together", set(range(n)))["sum"] == total
    print("\n  400 random item lists x every crash point: effect-first is always high by")
    print("  exactly that item's value, position-first always low by it, and one")
    print("  transaction always exact -- including a crash at every item in one run.")
    print("\nall assertions passed")

if __name__ == "__main__":
    main()
