# One-handed phone test — Michigan Lunker Rush

Run this on a **real Android phone, portrait, held in one hand**. Do not
sign off the tension bar, cast drag, or thumb reach from a desktop mouse
run — mouse input hides every problem this test exists to catch.

## Setup

- Device: ________________ (model, Android version, screen size)
- Build: Godot Android export, or `index.html` opened in the phone browser
  (note: the HTML slice does not yet carry the tester-update changes —
  test the Godot export for them; see `docs/TESTER-RESPONSE.md`).
- Grip: phone in one hand, thumb doing everything. No second hand, no table.
- Lake: Holloway Flats, first trip (fresh save or cleared save).

## Checks

1. **First loop under 60 seconds.** From lake select to first landed fish:
   cast → visible bite → STRIKE tap → fight → land. Time it: ______ s.
   Pass: first catch lands in under 60 seconds.
2. **First fish is findable.** Without tapping anything, is there a fish
   feeding in plain sight with a ripple ring and a line telling you to cast
   at it? Pass: yes, no tutorial card needed.
3. **Cast-drag sensitivity.** Full-power cast (CAST POWER 100%) reachable
   with one short thumb drag (200 px). Pass: full power without stretching
   the thumb or re-gripping; a short flick still casts short.
4. **Tension-bar readability.** At arm's length, in sunlight if possible:
   can you read the bar, the gold snap line, and the amber danger zone
   without squinting? When tension passes 80% of the line, does DANGER
   flash where your eye already is? Pass: yes to both.
5. **Thumb reach.** Drone button (top right), Reel In, Workbench, Lakes —
   all reachable by the thumb without shifting grip. Pass: no re-grip for
   any control used mid-fight.
6. **Fight feel.** Panfish, bass, and pike must not feel like the same bar
   at different speeds: panfish short weak runs, bass bursts, pike long
   hard runs. Pass: you can tell the species by the fight before the
   result card says so.
7. **Drone as a decision.** Reveal the fish, cast at a revealed one: does
   it bite noticeably faster than a blind cast? Pass: yes.
8. **Prompts stop.** After the first fish is landed, the ripple ring and
   "cast at it" line are gone. Pass: no coaching on the second cast.
9. **Retention hook.** Menu shows best bass / best pike and today's target;
   landing a new best or the daily target says so on the result card.
   Pass: both show, and a gold fish (rare) is obvious when revealed.

## Pass criteria

All 9 checks pass on the real phone. Any failure is a fix, not a note:
record the device, the check, and what the thumb actually had to do.

## What changed for this test (VEX item 6)

- Full-power cast now needs a 200 px drag (was 260 px) — `Casting.DRAG_FULL_PX`.
- Tension bar widened to 50 px with green / amber / red zones, an amber
  danger band in the top 20% below the snap line, and a flashing DANGER
  label at 80% of line capacity.
- All primary controls (cast, drone, reel, workbench, lakes) sit in the
  bottom bar or top-right, within bottom-thumb reach.
- First cast of a first trip bites in 0.8–1.6 s so the loop is testable
  in under a minute.

## Still open

- This checklist has not been run on a real phone yet — the Godot scripts
  were not run in the Godot editor on the machine that wrote them (Godot
  is not installed there). Run this checklist on-device and fill in the
  device line above before calling the loop proven.
