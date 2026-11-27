# Final Cast — multi-phone playtest protocol (VEX 5.0 items 1, 8, 12)

**Status: protocol only — no phone has been tested yet.** The CI debug APK
builds, but no real-phone session has been recorded. Do not claim the game
is proven on a phone until a session below is filled in.

## The matrix: 3–5 real Android phones

One phone proves nothing about timing fairness or touch targets — the
review asks for 3–5 phones of different sizes and ages. Fill one row per
phone before its session; a phone with no row is not a tested phone.

| Phone | Model | Android | Screen (in / px) | RAM | Role |
|---|---|---|---|---|---|
| A | _to be filled in_ | | | | Small / old — lowest-spec pass |
| B | _to be filled in_ | | | | Mid-range — the plan's target phone |
| C | _to be filled in_ | | | | Mid-range, different size |
| D | _to be filled in_ | | | | Large / new — big-screen touch targets |
| E | _optional_ | | | | Second old phone if one is available |

Suggested spread if the exact phones are not known yet: one Android 6.0–8
phone (the oldest supported — see the low-end protocol in
`docs/build-sheet.md`), one mid-range phone from the last 2–3 years, and
one large-screen phone. Age matters as much as size: old phones are where
frame drops and low-memory shutdowns show up.

## Before the session (per phone)

1. Install the CI debug APK on the phone (see `README.md`).
2. Open the game → Settings → enter **Phone model** and **Android
   version** → **Save phone details**. Screen size and orientation are
   recorded automatically; the exported log carries all four, so one
   exported session is one phone's full record (`src/playtest.js`,
   `session.phone`).
3. Note the phone's RAM (Settings → About phone, or `navigator.deviceMemory`
   in the log) — crashes are tagged with it.

## One full session per phone

Play a full session on each phone — at least 10 minutes, covering:

- **Bite hits/misses**: play the hand-fishing loop until at least 5 bites
  per fish size if possible. The log records every bite cue shown and
  whether it was hooked or missed (`session.bites`, `biteRateBySize()`),
  plus every hookset attempt with reaction time vs window
  (`session.attempts`, `successRateBySize()`). A size with fewer than
  5 bites is "not enough data" — say so, do not tune from it.
- **Haptic feel**: after the session, rate the bite buzz 1–5 (1 = did not
  feel it, 5 = unmistakable) and note it in the session record below.
  Haptics are the bite cue for a player not looking at the screen.
- **Portrait/landscape touch targets**: play 5 minutes in each
  orientation. Check the Hookset button and the fight bar are tappable
  without zooming and without hitting a neighbour — touch targets should
  be at least 48 dp. Note any target that is too small or too close to
  another control.
- **Frame drops**: the game logs them automatically for the first
  10 minutes (`session.performance.frameDrops`, `longFrames`). Note any
  visible stutter during the fight loop even if the numbers look fine.
- **Offline PWA behaviour**: after the session, turn on airplane mode,
  close the app, reopen it, and confirm the game loads and plays offline
  from the service-worker cache. Note the result — offline is a shipped
  feature, not an assumption.

## Session record (one per phone — copy this table)

| Field | Phone A | Phone B | Phone C | Phone D | Phone E |
|---|---|---|---|---|---|
| Model / Android | | | | | |
| Screen / RAM | | | | | |
| Session date | | | | | |
| Bites hooked / shown (by size) | | | | | |
| Hookset success rate (by size) | | | | | |
| Haptic feel (1–5) | | | | | |
| Portrait targets OK? | | | | | |
| Landscape targets OK? | | | | | |
| Frame drops / long stalls | | | | | |
| Load time (ms) | | | | | |
| Offline reopen OK? | | | | | |
| Crashes / shutdowns | | | | | |

Export the session after each phone (Settings → Export playtest log) and
keep the export with the phone's row. The export is the evidence; a row
with no export is a claim, not a result.

## Pass bar (per phone)

- Zero shutdowns, zero crashes, no long stalls during the fight loop.
- Bite hook rate: first-time players hook most big bites on quests 1–2
  (the forgiving first-quest window, `src/tuning.json`) without it
  feeling automatic — if the rate is near 100% on every size, the
  window is too generous; if first-time players miss most big bites,
  it is too tight. Retune from the logs, never from a guess.
- All touch targets usable in both orientations, no zooming needed.
- Offline reopen works in airplane mode.

## What this does not cover

- The release APK and store listing are a separate step — see the release
  checklist in `docs/build-sheet.md`. This protocol tests the CI debug APK.
- Quest pacing (minutes idle vs active, time per quest) is logged by the
  same sessions (`session.quests`, `questSummary()`) — see
  `docs/quests.md` — but a full 1–12 playthrough is its own run, not
  part of one 10-minute phone session.
