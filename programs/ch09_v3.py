#!/usr/bin/env python3
"""Variation 3 -- the attributed click (looks like advertising). Standalone and runnable.

  Impressions and clicks arrive on two streams.  Match each click to the impression that
  preceded it by at most W seconds, and to the NEAREST such impression if several qualify.  An
  impression may be credited with at most one click.

Both halves of the chapter's problem are here -- two streams, and a bound on what may be
forgotten -- and a third thing is added: the match is asymmetric and one-to-one, so "nearest"
cannot be decided until it is certain no closer impression is still in flight.  That turns a
stateless sweep into a WAIT, and the wait's length is the lateness allowance, not W.  Those are
two different numbers in the same units and conflating them is the mistake this program
measures: here W is 60 seconds of business rule and the data runs 85 seconds late, so waiting W
loses attributions that waiting 85 recovers.  The bound has stopped being an optimisation and
become a correctness requirement.  Two more things fall out, uninvited.  Answering a click
early is wrong in BOTH directions -- measured below, it sometimes reports more attributions
than the correct answer, so no count can audit it.  And "nearest" and "as many matches as
possible" are different objectives; the spec asks for the first one.

Run it:  python3 programs/ch09_v3.py
"""
import random

# Impressions as (shown_at, arrived_at).  The shown_at times are the chapter's LEFT endpoints,
# 1, 3, 130, 245 and 540 -- its key 'a' session boundaries.  One of them arrives late: the
# impression shown at 245 reaches the matcher at 330, which is 85 seconds of lateness and is
# deliberately MORE than W, so the two numbers cannot be confused for one.
IMPRESSIONS = [(1, 1), (3, 3), (130, 130), (245, 330), (540, 540)]
# Clicks, punctual, at the chapter's key 'b' event times 50, 90, 220 and 260, plus a second
# click at 265 that wants the same impression as the one at 260 -- which is what makes the
# one-to-one rule do some work.
CLICKS = [50, 90, 220, 260, 265]
W = 60                    # the attribution window: the chapter's widening constant J
TRUE_LATENESS = 85        # measured below, not assumed: max(arrived_at - shown_at)
UNATTRIBUTED = None       # not an impression: this click is credited to nobody


def measured_lateness(impressions):
    """The largest gap between being shown and arriving.  A property of the PIPELINE, knowable
    only after the fact, which is why the wait is a promise rather than a derivation -- exactly
    as the chapter's droppable bound was."""
    return max(arrived - shown for shown, arrived in impressions)


def in_window(shown, click_t, w):
    """Whether an impression qualifies for a click: at or before it, and no more than w before.

    Both ends are inclusive.  An impression shown at the same second as the click counts, and
    one shown exactly w seconds earlier counts -- w + 1 does not.  Those three cases are the
    whole definition, and each of them is a line in somebody's revenue report.
    """
    return click_t - w <= shown <= click_t


def attribute(impressions, clicks, w, wait):
    """Match each click, in click order, after waiting `wait` seconds for late impressions.

    The mechanism: a click at t is answered at t + wait, so the impressions it may consider are
    those that had ARRIVED by then -- which is a different set from those SHOWN inside its
    window.  Among the arrived-and-qualifying impressions it takes the latest, and marks it
    used so no later click can take it again.  `wait` therefore controls completeness and w
    controls eligibility; they are independent and both are needed.
    Returns [(click_t, shown_at or UNATTRIBUTED), ...].
    """
    used, out = set(), []
    for click_t in clicks:
        deadline = click_t + wait
        best = UNATTRIBUTED
        for shown, arrived in impressions:
            if arrived > deadline:
                continue                       # still in flight when this click was answered
            if not in_window(shown, click_t, w):
                continue
            if shown in used:
                continue                       # already credited with a click
            if best is UNATTRIBUTED or shown > best:
                best = shown                   # nearest preceding means the LATEST qualifying
        if best is not UNATTRIBUTED:
            used.add(best)
        out.append((click_t, best))
    return out


def attribute_offline(impressions, clicks, w):
    """The answer with every impression already in hand: the thing a nightly batch job computes
    and the thing the stream is trying to equal.  Waiting long enough makes the stream agree
    with it, and that is the only definition of "long enough" available."""
    return attribute(impressions, clicks, w, wait=float("inf"))


def matched_count(result):
    """How many clicks were credited to an impression."""
    return sum(1 for _, imp in result if imp is not UNATTRIBUTED)


def max_matching(impressions, clicks, w):
    """The largest number of clicks that COULD be attributed, by augmenting paths.

    It is here as a yardstick, not as an alternative: the spec says nearest, and nearest is a
    per-click rule that cannot see the clicks after it.  The mechanism is the standard one --
    try to give each click an impression, and when every candidate is taken, ask the click
    holding one to move to another, recursively.  The gap between this and `attribute` is the
    price of answering each click on its own.
    """
    shown_list = [s for s, _ in impressions]
    owner = {}

    def try_click(ci, seen):
        for idx, shown in enumerate(shown_list):
            if idx in seen or not in_window(shown, clicks[ci], w):
                continue
            seen.add(idx)
            if idx not in owner or try_click(owner[idx], seen):
                owner[idx] = ci
                return True
        return False

    total = 0
    for ci in range(len(clicks)):
        if try_click(ci, set()):
            total += 1
    return total


def droppable(impressions, bound):
    """Impressions that may be released, given a promise that no click still to arrive can be
    answered before `bound`.

    This is the chapter's rule with the wait folded in: an impression stops being needed once no
    future click's window can reach it.  Without the promise nothing may be dropped and the
    state grows for as long as the campaign runs -- and with it, the state is bounded by W plus
    the lateness allowance, which is the sum of the two numbers, not either one.
    """
    return [(s, a) for s, a in impressions if s < bound]


def main():
    lateness = measured_lateness(IMPRESSIONS)
    print(f"IMPRESSIONS (shown, arrived) = {IMPRESSIONS}")
    print(f"CLICKS = {CLICKS}")
    print(f"  W = {W} seconds (the attribution window), measured lateness = {lateness} seconds")
    assert lateness == TRUE_LATENESS == 85, lateness
    assert lateness > W, "the point of this data is that the two numbers are not the same"

    at_once = attribute(IMPRESSIONS, CLICKS, W, wait=0)
    waiting_w = attribute(IMPRESSIONS, CLICKS, W, wait=W)
    waiting_l = attribute(IMPRESSIONS, CLICKS, W, wait=lateness)
    offline = attribute_offline(IMPRESSIONS, CLICKS, W)
    for label, res in (("answer at once (wait 0)", at_once),
                       (f"wait W = {W}", waiting_w),
                       (f"wait lateness = {lateness}", waiting_l),
                       ("offline, all data", offline)):
        shown = "  ".join(f"{c}->{'-' if i is UNATTRIBUTED else i}" for c, i in res)
        print(f"  {label:<26} {shown}   ({matched_count(res)} attributed)")

    assert at_once == [(50, 3), (90, None), (220, None), (260, None), (265, None)], at_once
    assert waiting_w == at_once, "waiting W is not waiting long enough, and here changes nothing"
    assert waiting_l == [(50, 3), (90, None), (220, None), (260, 245), (265, None)], waiting_l
    assert waiting_l == offline, "waiting the measured lateness must equal the batch answer"
    assert matched_count(at_once) == 1 and matched_count(waiting_l) == 2
    assert matched_count(waiting_w) < matched_count(waiting_l), "the conflation costs a match"
    print(f"\n  the click at 260 is attributed to the impression shown at 245 -- but that impression")
    print(f"  arrives at 330, so a matcher that waits {W} seconds answers at 320 and credits nobody.")
    print(f"  Waiting W is not a conservative version of waiting the lateness; it is the wrong")
    print(f"  quantity, and it happens to be smaller here.  Attribution is lost, not approximated.")

    # the one-to-one rule, and what it does to the click behind
    assert waiting_l[4] == (265, UNATTRIBUTED), waiting_l[4]
    assert in_window(245, 265, W), "265 qualified for 245 and was refused it"
    both = attribute(IMPRESSIONS, [265], W, wait=lateness)
    assert both == [(265, 245)], both
    print(f"\n  the click at 265 also qualifies for the impression at 245 -- on its own it gets it")
    print(f"  ({both[0][1]}) -- and is refused because the click at 260 took it first.  One-to-one makes")
    print(f"  a click's answer depend on the clicks BEFORE it, which is why the clicks cannot be")
    print(f"  answered out of order even though each window is independent.")

    # ...and "nearest" is not "as many as possible"
    greedy_imps = [(100, 100), (150, 150)]
    greedy_clicks = [160, 199]
    greedy = attribute(greedy_imps, greedy_clicks, W, wait=0)
    best_possible = max_matching(greedy_imps, greedy_clicks, W)
    print(f"\n  impressions at 100 and 150, clicks at 160 and 199, W = {W}:")
    print(f"    nearest-first  : {greedy}   ({matched_count(greedy)} attributed)")
    print(f"    best possible  : {best_possible} attributed (160 takes 100, 199 takes 150)")
    assert greedy == [(160, 150), (199, None)], greedy
    assert best_possible == 2 and matched_count(greedy) == 1
    assert matched_count(greedy) < best_possible, "nearest-first must be shown to lose a match"
    assert in_window(100, 160, W) and not in_window(100, 199, W)
    print(f"    the click at 160 takes the nearer impression and strands the click at 199, whose")
    print(f"    only candidate was the one just taken.  Both answers are defensible and the spec")
    print(f"    picked the first -- so a report of 'lost' attributions may be the rule working.")

    # ...and answering at once is not merely incomplete: it can report MORE attributions than
    # the correct answer.  This is measured, not constructed -- it fell out of the random cases
    # below and the first version of this program asserted the opposite.
    late_imps = [(31, 31), (109, 109), (115, 155), (132, 172), (199, 199)]
    late_clicks = [30, 51, 89, 154, 181]
    rushed = attribute(late_imps, late_clicks, W, wait=0)
    correct = attribute_offline(late_imps, late_clicks, W)
    print(f"\n  impressions {late_imps}, clicks {late_clicks}:")
    print(f"    answered at once : {rushed}   ({matched_count(rushed)} attributed)")
    print(f"    the right answer : {correct}   ({matched_count(correct)} attributed)")
    assert matched_count(rushed) == 3 and matched_count(correct) == 2
    assert matched_count(rushed) > matched_count(correct), "the error is NOT one-directional"
    assert rushed[2] == (89, UNATTRIBUTED) and correct[2] == (89, UNATTRIBUTED)
    assert rushed[3] == (154, 109) and correct[3] == (154, 132), (rushed[3], correct[3])
    assert rushed[4] == (181, 132) and correct[4] == (181, UNATTRIBUTED)
    print(f"    the click at 154 cannot see the impression shown at 132 yet -- it arrives at 172 --")
    print(f"    so it takes 109 instead, which leaves 132 free for the click at 181.  Three")
    print(f"    attributions out of a rule that should have made two, and the extra one breaks")
    print(f"    the spec: 154's nearest preceding impression was 132, not 109.  So the count of")
    print(f"    attributions is not a check on the matcher -- a rushed matcher can report more")
    print(f"    conversions than a correct one, which is the direction nobody audits.")

    # boundaries: both ends of the window, and the far side of it
    assert attribute([(100, 100)], [100], W, 0) == [(100, 100)], "shown at the click's own second"
    assert attribute([(100, 100)], [160], W, 0) == [(160, 100)], "exactly W before: inside"
    assert attribute([(100, 100)], [161], W, 0) == [(161, None)], "W + 1 before: outside"
    assert attribute([(100, 100)], [99], W, 0) == [(99, None)], "after the click: never"
    assert attribute([], [100], W, 0) == [(100, None)], "no impressions at all"
    assert attribute([(100, 100)], [], W, 0) == [], "no clicks at all"
    assert attribute([(100, 100)], [120, 120], W, 0) == [(120, 100), (120, None)], "a tie"
    print(f"\n  boundaries: shown at the click's own second -> attributed; exactly {W} before ->")
    print(f"  attributed; {W + 1} before -> not; shown after the click -> never; two clicks at the")
    print(f"  same second -> the first takes it, because one-to-one admits no tie-break.")

    # what may be forgotten, which is the chapter's question with the wait folded in
    horizon = 260 - W - lateness
    gone = droppable(IMPRESSIONS, horizon)
    print(f"\n  with clicks answered no earlier than 260, an impression is needed only if it was")
    print(f"  shown at or after 260 - W - lateness = {horizon}: droppable {gone}")
    assert gone == [(1, 1), (3, 3)], gone
    assert droppable(IMPRESSIONS, float("-inf")) == [], "with no promise, nothing may be dropped"
    assert droppable(IMPRESSIONS, float("inf")) == IMPRESSIONS, "and a finished campaign, all"
    print(f"  so the state is bounded by W PLUS the lateness allowance -- {W} + {lateness} = {W + lateness} seconds of")
    print(f"  impressions -- and neither number alone would have been enough to size it.")

    # many inputs: waiting the measured lateness must always equal the batch answer
    rng = random.Random(20260303)
    fewer, more, equal_count, same, greedy_loses, greedy_ties = 0, 0, 0, 0, 0, 0
    for _ in range(600):
        n_imp, n_click = rng.randint(0, 6), rng.randint(0, 5)
        imps = []
        for _ in range(n_imp):
            shown = rng.randint(0, 200)
            imps.append((shown, shown + rng.choice((0, 0, 5, 40, 120))))
        imps.sort()
        imps = [(s, a) for i, (s, a) in enumerate(imps) if i == 0 or s != imps[i - 1][0]]
        clicks = sorted(rng.randint(0, 260) for _ in range(n_click))
        late = measured_lateness(imps) if imps else 0
        batch = attribute_offline(imps, clicks, W)
        assert attribute(imps, clicks, W, wait=late) == batch, (imps, clicks, late)
        now = attribute(imps, clicks, W, wait=0)
        # CORRECTED CLAIM.  This asserted matched_count(now) <= matched_count(batch) -- that
        # answering early can only lose attributions -- and a random case refused it: a click
        # that cannot see its nearest impression takes a farther one and thereby frees the
        # nearer one for a later click.  Answering early is wrong in BOTH directions, so no
        # count-based check can detect it.
        delta = matched_count(now) - matched_count(batch)
        fewer += delta < 0
        more += delta > 0
        equal_count += delta == 0
        same += now == batch
        # every attribution must be legal and unique, at any wait
        for wait in (0, W, late, late + 50):
            res = attribute(imps, clicks, W, wait)
            credited = [i for _, i in res if i is not UNATTRIBUTED]
            assert len(credited) == len(set(credited)), (imps, clicks, wait)
            for click_t, i in res:
                if i is not UNATTRIBUTED:
                    assert in_window(i, click_t, W), (click_t, i)
        # nearest-first can never beat the best possible, and sometimes falls short
        best = max_matching(imps, clicks, W)
        got = matched_count(batch)
        assert got <= best, (imps, clicks, got, best)
        if got < best:
            greedy_loses += 1
        else:
            greedy_ties += 1
    print(f"\n  600 random stream pairs: waiting the measured lateness equalled the batch answer")
    print(f"  every single time.  Answering at once attributed FEWER clicks in {fewer} cases, MORE in")
    print(f"  {more}, and the same number in {equal_count} -- and it reproduced the batch answer exactly in only")
    print(f"  {same}.  Every attribution at every wait was inside its window and no impression was")
    print(f"  credited twice.  Nearest-first matched the maximum possible in {greedy_ties} cases and fewer")
    print(f"  in {greedy_loses}, so the one-to-one rule leaves money on the table by design, not by bug.")
    assert fewer > 0 and more > 0 and same > 0 and greedy_loses > 0
    assert (fewer, more, equal_count, same, greedy_loses, greedy_ties) == (133, 2, 465, 408, 21, 579)
    print("\nall assertions passed")


if __name__ == "__main__":
    main()
