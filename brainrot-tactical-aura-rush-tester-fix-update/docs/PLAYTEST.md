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

## Pass targets (open question — confirm before judging the playtest)

- Minimum frame rate during a run: _to be confirmed_
- Maximum attempts to beat a boss before it counts as too hard: _to be confirmed_

## Open questions

- Which two Android devices and Android versions are available for the recorded playtest?
- Is a Google Play developer account and signing key already available, or must they be created before the signed release build?
