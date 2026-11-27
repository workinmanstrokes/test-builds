# Real-Phone Playtest Log

Status: **NOT DONE — no real-phone playtest has been recorded yet.**
This file is the log template plus the recording procedure. Do not fill in
results until they are measured on real devices.

## Procedure (do this before changing any more code)

1. Play a full zone cycle on **two real Android phones** (record device model
   and Android version for each below).
2. For each session log: steering responsiveness, thumb occlusion, boss
   difficulty, deaths, session length, and any frame drops.
3. The game already records per-session metrics on-device: after a run, use
   `game.exportMetrics()` in the console (or read the
   `brainrot-aura-rush:metrics-v1` localStorage key) and paste the JSON here.
4. Fix the **top three feel issues** before adding any content.

## Devices

| # | Device | Android version | Tester |
| --- | --- | --- | --- |
| 1 | _to be recorded_ | _to be recorded_ | |
| 2 | _to be recorded_ | _to be recorded_ | |

## Session log

| Date | Device | Session length | Deaths | Boss reached | Frame drops | Steering (1–5) | Thumb occlusion (1–5) | Boss difficulty (1–5) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _pending_ | | | | | | | | | |

## Top three feel issues (fill in after the playtest)

1. _pending — issue, device, fix applied_
2. _pending — issue, device, fix applied_
3. _pending — issue, device, fix applied_

## Feel fixes already in code, awaiting playtest verification

- Relative-drag steering (`src/game.js`): the hero follows the finger's
  movement, not its position, so the thumb never has to cover the hero.
  Verify on a real phone that steering still feels precise.
- Zone hazards now affect the run every frame (`src/zones.js`
  `hazardFactors`, `src/game.js` `update`): mud/ice slow steering, sand
  gusts and undertow drift the squad, coffee spills speed enemies, the
  dance floor mirrors steering, Argento mirrors block the lane.
- Grump King's stun weakness is wired in: after every third slam he is
  stunned for 2s, deals no damage, and takes double squad damage
  (`STUNNED — double damage!` shows on the canvas).

## Pass targets (proposed — confirm before judging the playtest)

These are the targets the playtest is judged against. They were set from the
tester's open question ("what playtest pass target should be used") as the
smallest sensible bar for a portrait runner; adjust them only with a reason
recorded here.

- Minimum frame rate during a run: **30 fps sustained** — the game counts a
  frame drop whenever a frame takes over 34 ms (`frameDrops` in the session
  metrics); a run passes with **fewer than 30 drops per minute**.
- Maximum attempts to beat a boss before it counts as too hard: **3 attempts**
  per boss on the first full cycle.
- Steering responsiveness: **4/5 or better** on both devices.
- Thumb occlusion: **2/5 or lower** (low = thumb rarely covers the hero).
- Session length: at least one full zone cycle (all seven bosses) completed
  across the two devices.

## Open questions

- Which two Android devices and Android versions are available for the recorded playtest?
- Is a Google Play developer account and signing key already available, or must they be created before the signed release build?
