# Tester response — VEX, Michigan Lunker Rush (3/10, F)

VEX's verdict: "A clear Michigan arcade premise with a starter scene, not
yet a fishing game — the loop as described is a tension-bar timer with no
reason to cast again." Every item below is answered with the smallest real
change that satisfies it, in the Godot project (the plan's stack). Where an
item is a judgment call with no concrete change, that is stated, not faked.

## Fixes

1. **Prove one complete loop on one lake, first catch in under 60 s;
   species-differentiated tension.** Done in code. First cast of a first
   trip bites in 0.8–1.6 s (`Casting.quick_bite`, set in
   `Main.enter_lake`), so cast → bite → STRIKE → fight → land fits in a
   minute. Fights now run on per-species profiles
   (`LakesData.fight_profile`, used by `TensionGame`): panfish short weak
   runs with fast reel-in, bass bursts, pike long powerful runs. Same bar,
   a different fish.
2. **Drone as a fishing decision.** Done in code. The drone marks fish
   revealed with species, size, **depth and cover** (`ScoutDrone.mark`,
   drawn in `Main._draw_fishing`), and casting within 150 px of a revealed
   fish bites **2.5× faster** (`Casting._bite_rate`,
   `LakesData.REVEALED_BITE_MULT`). A blind cast gets no bonus.
3. **Teach without a tutorial card.** Done in code. On a first trip one
   panfish feeds in plain sight mid-water with a pulsing ripple ring and
   the line "A fish is feeding right there — drag on the water to cast at
   it" (`Main._spawn_fish`, `Main._draw_fishing`). Tension danger is
   visible, not told: a wider bar with green/amber/red zones, an amber
   danger band, and a flashing DANGER label at 80% of line capacity.
   Everything is gated on `totalCaught == 0` — it stops the moment the
   first fish is landed.
4. **One retention hook only.** Done in code — personal best for bass and
   pike (shown on the menu, announced on the result card), a rare gold
   fish (4% of spawns, 3× coins, shown gold when revealed), and a daily
   target (one named fish per day, +50 coins, `LakesData.daily_target`).
   No new lakes or species were added.
5. **Lure economy in one page.** Done as `docs/LURE-ECONOMY.md`: what
   coins buy, what each lure and line changes in play, and that lures are
   **virtual only** — physical 3D-printed redemption is cut until the loop
   retains players.
6. **Test one-handed on a real Android phone in portrait.** Code changes
   done: 200 px full-power drag (`Casting.DRAG_FULL_PX`, was 260),
   50 px tension bar with danger zone, all primary controls in the bottom
   bar / top-right within thumb reach. The on-device run itself is **not
   done** — the checklist is `docs/PHONE-TEST.md`; it has to be run on a
   real phone before the loop is called proven (see "Still open").

## Weaknesses

7. **Only a starter scene plus scripts is described.** Addressed by items
   1–4: the loop is now a complete, provable one (first catch < 60 s),
   with a visible first fish, a drone that changes bites, and a retention
   hook. The Godot scripts are the implementation; the HTML slice is the
   playable prototype (see "Still open" — it is not yet ported).
8. **Fight reads as a tap timer.** Addressed by item 1: bite and strike
   timing, a visible feeding fish, species fight profiles, and retrieve
   variation (tap vs hold vs idle) are all in the code now.
9. **Drone purpose undefined.** Addressed by item 2: it reveals fish,
   depth, and cover, and casting to a revealed spot measurably changes
   catch odds (2.5× bite rate within 150 px).
10. **No retention hook.** Addressed by item 4: personal bests (bass,
    pike), rare gold fish, daily target. No leaderboard or tournament —
    deliberately one hook only.
11. **3D-printed lure reward ambiguous.** Addressed by item 5 and
    `docs/LURE-ECONOMY.md`: lures are virtual, in-game-printed items;
    cost and unlock path are stated; physical redemption is cut.
12. **No device / touch-readability / accessibility information.**
    Addressed by item 6 (`docs/PHONE-TEST.md`) and the one-handed code
    changes. Accessibility beyond that (e.g. a no-flash or high-contrast
    option) is still open and is not claimed here.

## Red flags

13. **Core loop unproven on a real Android device.** Partly addressed:
    the loop is now provable in under 60 s and there is a one-handed test
    checklist — but the on-device run itself is still open (see below).
    This is not claimed as proven.
14. **Scope creep risk.** Addressed by restraint: no new lakes, species,
    or systems were added. One lake proves the loop first; the other two
    lakes already in the data are unchanged.
15. **Physical 3D-printed lure reward undefined.** Resolved by cutting
    it: lures are virtual only (item 5). No cost, fulfilment, or
    real-money path exists to define.
16. **No retention system or release path beyond a coin grind.** The
    retention hook is item 4. A release path (store listing, export
    checklist) is out of scope for this update and is not claimed.
17. **No visual, audio, or performance evidence.** Partly addressed:
    the tension bar, fish readability, and portrait touch layout now have
    concrete, testable changes and a checklist — but there is still no
    audio work and no on-device evidence yet. Not claimed as tested.

## Still open (honest gaps, not hidden)

- **On-device test not run.** The Godot scripts were written to match the
  tested HTML logic but were not run in the Godot editor on the machine
  that wrote them (Godot is not installed there), and no real phone run
  has happened. `docs/PHONE-TEST.md` is the checklist for that run.
- **HTML slice not ported in this push.** `index.html` is a single 35 KB
  file and the GitHub connector truncates reads of it, so it could not be
  edited safely through the connector in this run. The Godot project —
  the plan's stack — carries all of the fixes above. Porting them to the
  HTML slice is a follow-up, not something pretended to be done here.

## Tester update — VEX, 3.5/10 (D), 2026-11-25

VEX's verdict: "It's a clear, Michigan-flavoured prototype with a
cast-and-fight idea, but as described it's not yet a fishing game that
earns a second cast." Two items, both addressed in the Godot project
(the plan's stack):

730. **Only a starter fishing scene plus scripts is described — no menu,
tutorial, lake selection, catch log, or progression screen is
evidenced.** Partly already answered: the 3/10 round added a menu with
lake selection, first-trip coaching instead of a tutorial card, and
personal-best / daily-target progression. What was genuinely missing
was the catch log and an explicit tutorial, so this push adds both as
real screens in `Main`: a Fish Log (all 7 species, caught counts,
personal bests, "NOT CAUGHT YET" with where to find them, plus a
progression header — species x/7, fish landed, gold caught, daily
target) and a How to Play screen (cast, strike, fight, drone &
Workbench). Menu and lake selection were already there and are
unchanged.

731. **Core loop unproven: if the rhythmic tension bar is the same
pattern at different speeds, all three species will feel like
reskins.** The 3/10 round gave each species a fight profile (surge,
rest, tap, run/rest lengths), but the player action never changed —
only the rates did. This push adds one signature move per species
group in `TensionGame` / `LakesData.fight_profile`: bass jump mid-run
and holding while one is airborne spikes tension (+45/sec), so the
correct play is to let go; pike runs blunt reel taps to 25% progress,
so the correct play is to ride the run out and reel in the rests;
panfish keep short weak runs with full tap value. Walleye is a steady
head-shaker with reduced tap value mid-run. The fight HUD shows the
hooked species' style line and flashes JUMP! during a bass jump.

Still open: the HTML slice (`index.html`) still carries the older
build — the 3/10 fixes were never ported to it, and neither are these.
It is a single 35 KB file the GitHub connector cannot edit safely, so
porting stays a follow-up. The Godot scripts were not run in the Godot
editor on this machine (Godot is not installed here) and no real-phone
run has happened yet — `docs/PHONE-TEST.md` is still the checklist.
