#!/usr/bin/env python3
"""Variation 3 -- the audit log that was compacted (looks like compliance).
Standalone and runnable.

  Every change to a customer record is written to a log as an entry carrying the record's
  new value and the date it took effect.  A regulator asks what one record HELD on a date
  two years ago.

  The log was compacted last year: for everything older than that day, one entry per record
  was kept and the superseded ones deleted.

The answer is that the question cannot be answered, and the valuable part is that it was
decided a year ago by somebody reclaiming disk.  The framing that helps separates two logs
that were conflated: a STATE log, which may be compacted freely because folding it gives
the same table, and an AUDIT log, which may not, because its whole value is the entries
compaction calls redundant.  They have different retention, different access patterns and
usually different storage.  There is no recovery scheme, so "these were never the same log"
is the answer -- and the second-best outcome is a system that KNOWS it cannot answer rather
than one that answers from the present and sounds certain.

WORKED EXAMPLES: the EXAMPLES table below holds 19 input/output pairs -- the audit log and
the compacted one asked the same questions, both sides of every boundary (an effective date
and the day before it, each record's surviving edge and the day before that), the day before
a record existed and an unknown record, which have no answer at all, a one-entry log, an
empty log, and the 5,000-change scale.  Every row is ASSERTED twice, so the table cannot
drift from the code: change the answer and this file stops running.

Run it:  python3 programs/ch06_v3.py
"""
import random
from datetime import date, timedelta

# The record log, from the chapter's changelog: the same two keys and the same nine values,
# now carried as (record, value, effective_day) with day 0 = 2024-01-01.  The values are
# the chapter's running totals, so record 'a' passes through 5, 8, 10, 16, 24 and 'b'
# through 7, 8, 17, 21.
DAY0 = date(2024, 1, 1)
RECORD_LOG = [("a", 5, 40), ("a", 8, 190), ("b", 7, 260), ("a", 10, 420),
              ("a", 16, 500), ("b", 8, 560), ("b", 17, 700), ("b", 21, 760), ("a", 24, 900)]
COMPACTED_ON = 640            # "last year": the day the retention job ran
ASKED_RECORD = "a"
ASKED_DAY = 300               # "two years ago": between record a's 8 and its 10
TODAY = 1000
UNANSWERABLE = "UNANSWERABLE"  # not a value: the question cannot be answered

# A one-entry log, an empty log, the log the retention job leaves behind (checked against
# retained() in show_examples, so it cannot drift), and the scale at which the job gets
# approved.  These are inputs for the examples table, not alternative versions of the
# problem.
ONE_ENTRY_LOG = [("a", 5, 40)]
EMPTY_LOG = []
STATE_LOG = [("a", 16, 500), ("b", 8, 560), ("b", 17, 700), ("b", 21, 760), ("a", 24, 900)]
BIG_RECORD_COUNT, BIG_CHANGE_COUNT, BIG_DAY_COUNT = 50, 5_000, 3_650
BIG_AUDIT = [(f"r{i % BIG_RECORD_COUNT}", i, (i * BIG_DAY_COUNT) // BIG_CHANGE_COUNT)
             for i in range(BIG_CHANGE_COUNT)]

# ------------------------------------------------------------------- WORKED EXAMPLES
# (what it exercises, log, record, day, expected value).  Every row is asserted by
# show_examples(), which is why the table is data and not a comment: a comment can go stale
# silently, and this cannot.  U is UNANSWERABLE -- a refusal, not a value.
U = UNANSWERABLE
EXAMPLES = [
    ("audit: the day before 'a' exists",   RECORD_LOG,    "a",  39,    U),
    ("audit: a's first effective day",     RECORD_LOG,    "a",  40,    5),
    ("audit: the day before a change",     RECORD_LOG,    "a",  189,   5),
    ("audit: the effective day itself",    RECORD_LOG,    "a",  190,   8),
    ("audit: the regulator's own day",     RECORD_LOG,    "a",  300,   8),
    ("audit: today",                       RECORD_LOG,    "a",  1000,  24),
    ("audit: an unknown record",           RECORD_LOG,    "zz", 1000,  U),
    ("state: the regulator's own day",     STATE_LOG,     "a",  300,   U),
    ("state: the day before a's edge",     STATE_LOG,     "a",  499,   U),
    ("state: a's edge day",                STATE_LOG,     "a",  500,   16),
    ("state: the day before b's edge",     STATE_LOG,     "b",  559,   U),
    ("state: b's edge day",                STATE_LOG,     "b",  560,   8),
    ("state: today, still answerable",     STATE_LOG,     "a",  1000,  24),
    ("one entry: the day before it",       ONE_ENTRY_LOG, "a",  39,    U),
    ("one entry: that very day",           ONE_ENTRY_LOG, "a",  40,    5),
    ("an empty log answers nothing",       EMPTY_LOG,     "a",  1000,  U),
    ("5,000 changes: day 0",               BIG_AUDIT,     "r1", 0,     1),
    ("5,000 changes: mid-history",         BIG_AUDIT,     "r0", 1825,  2500),
    ("5,000 changes: today",               BIG_AUDIT,     "r49", 3650, 4999),
]


def shown(day):
    """Day offsets as the dates a regulator would actually write in a letter."""
    return (DAY0 + timedelta(days=day)).isoformat()


def fold(log):
    """The log into the table of current values: later entries overwrite earlier ones."""
    t = {}
    for r, v, _ in log:
        t[r] = v
    return t


def retained(log, cutoff):
    """The log as the retention job left it: everything older than `cutoff` reduced to the
    last entry per record, everything newer untouched.

    That is how such a job is really written -- it compacts the closed part of the history
    and leaves the live tail alone -- and it is why the damage has a visible EDGE.  Each
    record keeps exactly one entry from before the cutoff, so questions about dates after
    that entry survive and questions before it do not.
    """
    old = [e for e in log if e[2] <= cutoff]
    new = [e for e in log if e[2] > cutoff]
    last = {}
    for r, v, d in old:
        last[r] = (v, d)
    kept_old = [(r, last[r][0], last[r][1]) for r in sorted(last)]
    return kept_old + new


def value_as_of(log, record, day):
    """What `record` held at the end of `day`, from whatever entries the log still has.

    The mechanism is a scan for the LATEST entry for that record whose effective date is at
    or before the day asked about.  If no such entry survives, the result is UNANSWERABLE
    rather than a value -- a missing answer, which a regulator can be told about, instead of
    a confident wrong one, which they cannot.
    """
    best, best_day = UNANSWERABLE, None
    for r, v, d in log:
        if r == record and d <= day and (best_day is None or d >= best_day):
            best, best_day = v, d
    return best


def value_as_of_date_blind(log, record, day):
    """The same lookup written by somebody who trusted the log to be complete: it ignores
    the effective date and returns the record's last entry.  On the compacted log this is
    wrong for every past date, and wrong in the worst way -- it hands back today's value
    dressed as history."""
    out = UNANSWERABLE
    for r, v, _ in log:
        if r == record:
            out = v
    return out


def answer_from_current_state(log, record, day):
    """The answer the service can give instantly, because the table is right there.  It is
    the appealing one: it always returns a number, and the number is always the present."""
    return fold(log).get(record, UNANSWERABLE)


def replay_tables(log, until):
    """An independent reference: fold the log one day at a time, keeping the table for every
    day.  Affordable only because this log is nine entries over three years, which is
    exactly why nobody materialises history this way in production."""
    tables, t = [], {}
    for day in range(until + 1):
        for r, v, d in log:
            if d == day:
                t[r] = v
        tables.append(dict(t))
    return tables


def answerable_questions(log, records, days):
    """How many (record, date) questions the log can answer at all.  This is the quantity
    the retention job changed and the quantity nobody measured before running it."""
    return sum(1 for r in records for d in days if value_as_of(log, r, d) != UNANSWERABLE)


def earliest_answerable(log, record):
    """The edge the cutoff left behind: the record's oldest surviving effective date.  Every
    question before it is lost and every question after it is intact."""
    days = [d for r, _, d in log if r == record]
    return min(days) if days else None


def show_examples():
    """Print the examples table and assert every row.

    Each row is checked TWO ways, and usually three: the scan must return the expected
    value, a max over the candidate entries must agree, and where it is affordable the
    day-by-day replay must agree as well.  Both costs are printed -- the scan reads every
    entry once, the replay reads every entry once PER day -- so a reader can see that on
    the first day of a long log the two cost the same, and that the gap opens up only as
    the question moves away from the beginning of the log.  The `present` column is the
    answer the service could give for free out of its current table.
    """
    assert retained(RECORD_LOG, COMPACTED_ON) == STATE_LOG, "STATE_LOG must be what the job leaves"
    print(f"{'what it exercises':34s} {'entries':>8} {'record':>7} {'date':>12} "
          f"{'answer':>13} {'present':>13} {'scan':>6} {'replay':>9}  verdict")
    for label, log, record, day, want in EXAMPLES:
        got = value_as_of(log, record, day)
        assert got == want, (label, got, want)
        candidates = [(d, v) for r, v, d in log if r == record and d <= day]
        by_max = max(candidates)[1] if candidates else UNANSWERABLE
        assert by_max == want, (label, "the max over candidates disagrees", by_max, want)
        scan, replay = len(log), (day + 1) * len(log)
        if replay <= 100_000:          # materialising history is affordable only when tiny
            tables = replay_tables(log, day)
            assert tables[day].get(record, UNANSWERABLE) == want, (label, "the replay disagrees")
        present = answer_from_current_state(log, record, day)
        verdict = ("scan wins" if scan < replay else "tie") + \
                  (", present agrees" if present == want else ", present WRONG")
        print(f"{label:34s} {len(log):>8} {record:>7} {shown(day):>12} "
              f"{str(got):>13} {str(present):>13} {scan:>6} {replay:>9}  {verdict}")
    print(f"all {len(EXAMPLES)} examples agree with a max over the surviving entries, and with a "
          f"day-by-day replay wherever one is affordable")
    print()


def main():
    show_examples()
    records = sorted({r for r, _, _ in RECORD_LOG})
    audit_log = RECORD_LOG                             # never compacted
    state_log = retained(RECORD_LOG, COMPACTED_ON)     # compacted on COMPACTED_ON
    print("RECORD_LOG:")
    for r, v, d in RECORD_LOG:
        mark = "  <- deleted by the retention job" if (r, v, d) not in state_log else ""
        print(f"  {shown(d)}  record {r!r} becomes {v:2d}{mark}")
    print(f"\nretention job ran on {shown(COMPACTED_ON)}; what is left:")
    for r, v, d in state_log:
        print(f"  {shown(d)}  record {r!r} = {v}")
    print(f"  {len(RECORD_LOG)} entries became {len(state_log)}: "
          f"{len(RECORD_LOG) - len(state_log)} deleted\n")

    print(f"the regulator asks: what did record {ASKED_RECORD!r} hold on {shown(ASKED_DAY)}?")
    from_audit = value_as_of(audit_log, ASKED_RECORD, ASKED_DAY)
    from_state = value_as_of(state_log, ASKED_RECORD, ASKED_DAY)
    from_present = answer_from_current_state(state_log, ASKED_RECORD, ASKED_DAY)
    blind = value_as_of_date_blind(state_log, ASKED_RECORD, ASKED_DAY)
    print(f"  uncompacted audit log  -> {from_audit}")
    print(f"  compacted state log    -> {from_state}")
    print(f"  from the current table -> {from_present}   (instant, confident, wrong)")
    print(f"  date-blind lookup      -> {blind}   (the same wrong answer, differently reached)")

    assert from_audit == 8, from_audit
    assert from_state == UNANSWERABLE, from_state
    assert from_present == 24 and blind == 24
    assert from_present != from_audit, "the present is not the past and must not be served as it"
    assert from_state != from_present, "a missing answer and a wrong answer are not the same"
    assert fold(state_log) == fold(audit_log) == {"a": 24, "b": 21}
    print(f"\n  both logs fold to the same table {fold(state_log)}, which is exactly the")
    print(f"  argument the retention job was approved on -- and it is true.")

    # what was destroyed, counted rather than described
    days = list(range(0, TODAY + 1, 10))
    audit_ans = answerable_questions(audit_log, records, days)
    state_ans = answerable_questions(state_log, records, days)
    print(f"\n  of {len(records) * len(days)} (record, date) questions on a 10-day grid:")
    print(f"    the audit log answers {audit_ans}")
    print(f"    the state log answers {state_ans}   ({audit_ans - state_ans} destroyed)")
    assert (audit_ans, state_ans) == (172, 96), (audit_ans, state_ans)
    assert state_ans < audit_ans, "compaction must actually have destroyed answers"
    assert state_ans > 0, "and it must NOT have destroyed all of them"

    # the surviving questions are exactly the ones after each record's oldest survivor
    edges = {r: earliest_answerable(state_log, r) for r in records}
    for r in records:
        for d in days:
            got = value_as_of(state_log, r, d)
            if d >= edges[r]:
                assert got == value_as_of(audit_log, r, d) != UNANSWERABLE, (r, d, got)
            else:
                assert got == UNANSWERABLE, (r, d, got)
    print(f"  the edge: record {'a'!r} is answerable from {shown(edges['a'])}, "
          f"{'b'!r} from {shown(edges['b'])};")
    print(f"  before those dates nothing, after them everything -- so the loss is not")
    print(f"  'some history' but a clean cut at the day a disk job happened to run.")

    # the two-log split, priced
    audit_only = [e for e in audit_log if e not in state_log]
    print(f"\n  keeping both logs would cost {len(audit_log)} + {len(state_log)} = "
          f"{len(audit_log) + len(state_log)} entries instead of {len(state_log)},")
    print(f"  and the {len(audit_only)} entries the state log does not need are precisely the ones the")
    print(f"  regulator is asking about.")
    assert len(audit_only) == 4 and all(e[2] <= COMPACTED_ON for e in audit_only)
    assert value_as_of(audit_only + state_log, ASKED_RECORD, ASKED_DAY) == from_audit

    # boundaries: the effective date is inclusive, the day before is the previous value,
    # and before a record exists there is nothing to report -- not zero
    assert value_as_of(audit_log, "a", 190) == 8, "the effective date itself"
    assert value_as_of(audit_log, "a", 189) == 5, "the day before"
    assert value_as_of(audit_log, "a", 39) == UNANSWERABLE, "before the record existed"
    assert value_as_of(audit_log, "a", 39) != 0, "an absent record is not a zero one"
    assert value_as_of(audit_log, "zz", TODAY) == UNANSWERABLE, "an unknown record"
    assert value_as_of(audit_log, "a", TODAY) == 24, "and today is still today"
    assert value_as_of(state_log, "a", TODAY) == 24, "which the compacted log answers too"
    print(f"\n  boundaries: {shown(190)} -> 8 (inclusive), {shown(189)} -> 5, "
          f"{shown(39)} -> {UNANSWERABLE} and not 0,")
    print(f"  because 'no record' and 'a record holding nothing' are different facts about")
    print(f"  a customer; an unknown record is {UNANSWERABLE} on both logs.")

    # the day-by-day replay is an independent reference for every day, not just the six above
    tables = replay_tables(audit_log, TODAY)
    for r in records:
        for d in range(TODAY + 1):
            assert value_as_of(audit_log, r, d) == tables[d].get(r, UNANSWERABLE), (r, d)
    print(f"\n  all {len(records) * (TODAY + 1)} (record, day) pairs agree with a day-by-day replay of the audit")
    print(f"  log, so the scan and a materialised history are the same answer.")

    # many inputs: the compacted log may lose answers and may never invent one
    rng = random.Random(20260303)
    lost_total, kept_total, blind_wrong = 0, 0, 0
    for _ in range(200):
        n = rng.randint(1, 12)
        log = sorted(((rng.choice("abcd"), rng.randint(0, 99), rng.randint(0, 60))
                      for _ in range(n)), key=lambda e: e[2])
        cutoff = rng.randint(0, 60)
        small = retained(log, cutoff)
        assert fold(small) == fold(log), (log, cutoff)
        for r in "abcde":
            edge = earliest_answerable(small, r)
            for d in range(0, 62):
                full_ans = value_as_of(log, r, d)
                small_ans = value_as_of(small, r, d)
                if small_ans == UNANSWERABLE:
                    lost_total += full_ans != UNANSWERABLE
                    assert edge is None or d < edge, (log, cutoff, r, d)
                else:
                    assert small_ans == full_ans, (log, cutoff, r, d)   # never wrong
                    kept_total += 1
                if value_as_of_date_blind(small, r, d) != full_ans:
                    blind_wrong += 1
    print(f"\n  200 random record logs at random cutoffs: the compacted log lost {lost_total:,} answers")
    print(f"  and never once returned a wrong one ({kept_total:,} kept, all correct), while the")
    print(f"  date-blind lookup over the same entries was wrong {blind_wrong:,} times -- the DATE on")
    print(f"  the surviving entry is the whole difference between a refusal and a fabrication.")
    assert lost_total > 0 and kept_total > 0
    assert blind_wrong > lost_total, "the date-blind lookup must be worse, not merely different"

    # the scale that gets a retention job approved, and the scale of what it costs
    BIG_RECORDS, BIG_CHANGES, BIG_DAYS = 50, 5_000, 3_650
    big = [(f"r{i % BIG_RECORDS}", i, (i * BIG_DAYS) // BIG_CHANGES) for i in range(BIG_CHANGES)]
    big_small = retained(big, BIG_DAYS)
    print(f"\n  at {BIG_CHANGES:,} changes to {BIG_RECORDS} records over {BIG_DAYS:,} days:")
    print(f"    state log {len(big_small)} entries, audit log {len(big):,} -- "
          f"{len(big) // len(big_small)}x the storage")
    print(f"    the audit log grows with TIME and the state log grows with RECORDS, which is")
    print(f"    why the two have different retention and always did.")
    assert len(big_small) == BIG_RECORDS and fold(big_small) == fold(big)
    assert len(big) // len(big_small) == 100
    assert value_as_of(big_small, "r0", BIG_DAYS // 2) == UNANSWERABLE
    assert value_as_of(big, "r0", BIG_DAYS // 2) != UNANSWERABLE
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
