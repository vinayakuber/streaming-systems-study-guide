#!/usr/bin/env python3
"""Variation 2 — the file that is half uploaded (looks like backups). Standalone and runnable.

  A nightly job uploads a large file to object storage and then records that the backup
  succeeded.  It is killed partway through the upload.  No restore may ever read a partial
  file, and no record may ever claim a backup that is not there.

The same two writes, and the chapter's transaction is unavailable because the file store and
the record live in different systems.  What makes it tractable is a property the queue problem
lacked: the DESTINATION NAME is under your control.  Write to a temporary name and RENAME on
completion, and the appearance of the file itself becomes the atomic commit -- the rename is
the one durable write, a partial upload is invisible because nothing looks at the temporary
name, and there is no position to keep at all, because the file's existence IS the position.
You can often manufacture an atomic step instead of needing a transaction.  What it costs, and
where it stops working, are both measured below.

Run it:  python3 programs/ch05_v2.py
"""

import random

# Nine chunks whose lengths are the chapter's nine item values, so the finished file is 45
# bytes -- the same 45 the chapter's worker has to add up.  Each chunk is a DISTINCT repeated
# letter, for the chapter's reason: a chunk that looked like its neighbour would let a
# truncated or doubled upload pass a content check.
CHUNKS = ["aaaaa", "bbb", "ccccccc", "dd", "eeeeee", "f", "ggggggggg", "hhhh", "iiiiiiii"]
COMPLETE = "".join(CHUNKS)
SIZE = len(COMPLETE)

# The real and temporary names in the one store.  "backup" is what a restore reads; nothing
# ever reads "backup.tmp", which is the entire reason the trick works.
FINAL, TEMP = "backup", "backup.tmp"

# An older file left in the staging slot by a previous night's crash.  It is the boundary case
# that makes resuming dangerous, and it is a real thing to find in a bucket.
STALE_TEMP = "XXXXXXXXXXXXXXX"

N = len(CHUNKS)


def attempt(chunks, policy, crash_at, store, record, resume=False):
    """One run of the nightly job against a mutable `store` and `record`.

    `crash_at` is a chunk index to die just before writing, or N to die after the last chunk
    but before the commit step, or None to survive.  Returns the bytes transferred, so that
    the price of each policy is a measurement.

    policy:
      "rename"       -- append to TEMP, then rename TEMP to FINAL.  The rename is the commit.
      "direct"       -- append straight to FINAL, then set the record.  A reader can see a
                        half file, and the record can be missing for a complete one.
      "record_first" -- set the record, then upload.  A crash in between leaves a record
                        claiming a backup that does not exist, which is the only one of the
                        three failures nobody notices until a restore is attempted.
    `resume` continues from whatever is already in TEMP instead of starting over.  It saves
    the bytes and it is only safe if that content is known to belong to THIS attempt."""
    moved = 0
    if policy == "record_first":
        record["ok"] = True
        if crash_at == 0:
            return moved
    name = TEMP if policy == "rename" else FINAL
    if resume:
        done = len(store.get(name, ""))
        start = 0
        while start < len(chunks) and done >= len(chunks[start]):
            done -= len(chunks[start])
            start += 1
    else:
        store.pop(name, None)
        start = 0
    if policy == "rename":
        # the staging file is CREATED before any bytes are written, not when the first chunk
        # lands.  Without this a zero-byte backup has nothing to rename, so "the file exists"
        # could not express an empty backup -- the encoding would have a hole in it.
        store.setdefault(name, "")
    for i in range(start, len(chunks)):
        if crash_at == i:
            return moved
        store[name] = store.get(name, "") + chunks[i]
        moved += len(chunks[i])
    if crash_at == len(chunks):
        return moved
    if policy == "rename":
        store[FINAL] = store.pop(TEMP)          # the one durable write: the commit
    else:
        record["ok"] = True
    return moved


def visible(store):
    """What a restore would read: whatever is under the real name, or None if there is
    nothing there.  Deliberately blind to TEMP, because a restore is."""
    return store.get(FINAL)


def one_night(policy, crash_at, resume=False, seed_temp=None):
    """A fresh store, one attempt, and what is left behind.  Returns
    (visible, record_ok, bytes_moved, temp_contents)."""
    store, record = {}, {"ok": False}
    if seed_temp is not None:
        store[TEMP] = seed_temp
    moved = attempt(CHUNKS, policy, crash_at, store, record, resume=resume)
    return visible(store), record["ok"], moved, store.get(TEMP)


def until_done(policy, crash_points, resume=False):
    """Restart the job after each crash until it finally completes, which is what a scheduler
    does.  Returns (visible, attempts, total_bytes_moved) -- the bytes are the point: with no
    resume, every crash throws away everything transferred so far."""
    store, record = {}, {"ok": False}
    total, attempts = 0, 0
    for c in list(crash_points) + [None]:
        attempts += 1
        total += attempt(CHUNKS, policy, c, store, record, resume=resume)
        if visible(store) is not None and (policy == "rename" or record["ok"]):
            break
    return visible(store), attempts, total


def cross_store(chunks, crash_at):
    """The same trick attempted across TWO systems -- staging bucket to archive bucket.

    There is no rename between stores, only copy-then-delete, and the copy is not one durable
    write: a crash inside it leaves a partial object under the real name in the archive, which
    is exactly the failure the rename was adopted to prevent.  Returns the archive's view."""
    staging, archive = {TEMP: "".join(chunks)}, {}
    for i, c in enumerate(chunks):
        if crash_at == i:
            return archive.get(FINAL)
        archive[FINAL] = archive.get(FINAL, "") + c      # copying, chunk by chunk
    del staging[TEMP]
    return archive.get(FINAL)


def main():
    print(f"CHUNKS = {CHUNKS}")
    print(f"the finished file is {SIZE} bytes: {COMPLETE!r}\n")

    # ---- every crash point, every policy
    print(f"  {'crash':>7}  {'rename':>18}  {'direct':>18}  {'record_first':>18}")
    rows = {}
    for c in list(range(N + 1)) + [None]:
        row = {}
        for policy in ("rename", "direct", "record_first"):
            vis, ok, moved, tmp = one_night(policy, c)
            row[policy] = (vis, ok)
        rows[c] = row
        label = "none" if c is None else (f"after all {N}" if c == N else f"chunk {c}")

        def show(pair):
            v, ok = pair
            if v is None:
                return f"absent, rec={ok}"
            if v == COMPLETE:
                return f"COMPLETE, rec={ok}"
            return f"{len(v)}/{SIZE} bytes, rec={ok}"
        print(f"  {label:>7}  {show(row['rename']):>18}  {show(row['direct']):>18}  "
              f"{show(row['record_first']):>18}")

    # the rename: at EVERY crash point the visible file is absent or complete, never partial
    for c, row in rows.items():
        vis, ok = row["rename"]
        assert vis in (None, COMPLETE), (c, vis)
        assert ok is False, "the rename policy keeps no record at all; the file is the record"
    assert rows[None]["rename"][0] == COMPLETE
    assert all(rows[c]["rename"][0] is None for c in range(N + 1))
    print(f"\n  rename: at all {N + 2} crash points the visible file is absent or the full {SIZE} bytes.")
    print(f"  Nothing is ever half visible, and there is no record to disagree with it.")

    # the direct write: partials ARE visible, and the count is every chunk after the first
    partial = [c for c in rows if rows[c]["direct"][0] not in (None, COMPLETE)]
    assert partial == list(range(1, N)), partial
    assert rows[0]["direct"] == (None, False)
    assert rows[N]["direct"] == (COMPLETE, False), rows[N]["direct"]
    print(f"\n  direct: {len(partial)} of the {N + 2} crash points leave a partial file under the real")
    print(f"  name -- a restore from it silently produces a truncated database.  And crashing")
    print(f"  after the last chunk leaves a COMPLETE file with the record still saying failed,")
    print(f"  which is the harmless half of the same split.")

    # record_first: the record can claim a backup that is not there, which is the bad one
    lying = [c for c in rows if rows[c]["record_first"][1] and rows[c]["record_first"][0] != COMPLETE]
    # CORRECTED: N, not N+1.  Crashing AFTER the last chunk but before the commit step leaves
    # record_first with both the record set and the file complete, so it is not lying there --
    # its window of dishonesty is exactly the upload itself, which is still every crash point
    # that matters, because the upload is where all the time goes.
    assert lying == list(range(N)), lying
    assert rows[N]["record_first"] == (COMPLETE, True), rows[N]["record_first"]
    print(f"\n  record_first: {len(lying)} of the {N + 2} crash points leave the record saying SUCCESS with")
    print(f"  no complete file behind it -- every point during the upload, which is where all")
    print(f"  the time goes.  Nobody finds out until a restore is attempted, which is why this")
    print(f"  ordering is the one that loses data rather than merely wasting work.")

    # ---- what the rename costs: no resume, so every crash throws the transfer away
    crashes = [3, 3, 3]
    vis, attempts, moved = until_done("rename", crashes)
    assert vis == COMPLETE
    print(f"\n  killed at chunk 3 three nights running, then succeeding: {attempts} attempts and")
    print(f"  {moved} bytes transferred for a {SIZE}-byte file.")
    assert attempts == 4 and moved == 3 * len("".join(CHUNKS[:3])) + SIZE, (attempts, moved)
    vis_r, attempts_r, moved_r = until_done("rename", crashes, resume=True)
    assert vis_r == COMPLETE and attempts_r == attempts
    print(f"  resuming from the temporary file instead: {moved_r} bytes -- the saving is real,")
    print(f"  and it is exactly the {moved - moved_r} bytes the restarts re-sent.")
    assert moved_r < moved, (moved_r, moved)
    assert moved_r == SIZE, moved_r

    # ---- and what resuming costs: a stale temporary file from a previous night
    vis_s, ok_s, moved_s, tmp_s = one_night("rename", None, resume=True, seed_temp=STALE_TEMP)
    vis_f, ok_f, moved_f, tmp_f = one_night("rename", None, resume=False, seed_temp=STALE_TEMP)
    print(f"\n  a {len(STALE_TEMP)}-byte file left in {TEMP!r} by an earlier crash of a DIFFERENT upload:")
    print(f"    resuming  -> {len(vis_s)} bytes, {'correct' if vis_s == COMPLETE else 'CORRUPT'}: {vis_s!r}")
    print(f"    from scratch -> {len(vis_f)} bytes, {'correct' if vis_f == COMPLETE else 'CORRUPT'}")
    assert vis_f == COMPLETE, vis_f
    assert vis_s != COMPLETE, "the stale resume must be caught producing the wrong file"
    assert len(vis_s) == SIZE, (
        "and it must be the SAME LENGTH as a good file, which is what makes it dangerous")
    assert vis_s.startswith(STALE_TEMP), vis_s[:len(STALE_TEMP)]
    print(f"    the corrupt one is {len(vis_s)} bytes, the same size as a good backup, so a length")
    print(f"    check passes.  Resuming is only safe if the temporary name is unique per")
    print(f"    attempt -- which means the atomic commit needs a NAME nobody else will reuse.")

    # ---- where the trick stops working: two stores
    partial_cross = [c for c in range(N + 1) if cross_store(CHUNKS, c) not in (None, COMPLETE)]
    assert cross_store(CHUNKS, None) == COMPLETE
    assert partial_cross == list(range(1, N)), partial_cross
    print(f"\n  staging bucket to archive bucket, where a rename is really a copy and a delete:")
    print(f"  {len(partial_cross)} crash points again leave a partial object under the real name.  The")
    print(f"  rename is atomic WITHIN one store and nowhere else, so the manufactured commit")
    print(f"  is a property of the store, not of the idea.")

    # ---- boundaries
    empty_store, empty_rec = {}, {"ok": False}
    attempt([], "rename", None, empty_store, empty_rec)
    assert visible(empty_store) == "", "a zero-byte backup must still commit, as an empty file"
    assert visible(empty_store) is not None, (
        "and 'exists but empty' must be distinguishable from 'absent', or the file cannot be "
        "the position")
    one_store, one_rec = {}, {"ok": False}
    attempt(["z"], "rename", 0, one_store, one_rec)
    assert visible(one_store) is None and one_store.get(TEMP) == "", one_store
    print(f"\n  boundaries: an empty backup commits as a zero-byte file -- {visible(empty_store)!r} is not")
    print(f"  None, which is what lets 'the file exists' be the position.  A single-chunk upload")
    print(f"  killed before its only chunk leaves an empty STAGING file and nothing under the")
    print(f"  real name, which is the state a restore must read as 'no backup'.")

    # ---- many files, every crash point
    rng = random.Random(20260303)
    for _ in range(300):
        n = rng.randint(0, 10)
        chunks = ["%s" % chr(97 + i) * rng.randint(1, 6) for i in range(n)]
        whole = "".join(chunks)
        for c in list(range(n + 1)) + [None]:
            store, record = {}, {"ok": False}
            attempt(chunks, "rename", c, store, record)
            got = visible(store)
            assert got in (None, whole), (chunks, c, got)
            assert (got == whole) == (c is None), (chunks, c, got)
            store2, record2 = {}, {"ok": False}
            attempt(chunks, "record_first", c, store2, record2)
            assert record2["ok"] is True, "the record is written first, so it is always set"
            # the file is complete exactly when the job either survived or was killed after
            # the last chunk; and with no chunks at all record_first never creates the file,
            # so there the record is set and nothing exists under the real name at any point.
            assert (visible(store2) == whole) == ((c is None or c == n) and n > 0), (chunks, c)
    print(f"\n  300 random files x every crash point: the rename leaves the real name absent or")
    print(f"  complete, and complete exactly when the job was not killed.  record_first always")
    print(f"  sets the record, and the file matches it only when nothing went wrong.")

    print("\nall assertions passed")


if __name__ == "__main__":
    main()
