# Final Cast — build sheet (one page)

**Build 0.2.1** · 2026-11-25 · repo `workinmanstrokes/final-cast-v0-2` · branch `main`
· based on commit `532c28e47b40bb6b4f01dcf0e092a195d14a852b` (v0.2.0)
· Game Test Lab review: **4.8/10 (grade D)** — this build answers that review, highest priority first.
· Note: the Lab text calls this a "castle-defense" game. Final Cast is a pixel-art idle fishing game; the five fixes below are applied to the fishing game as shipped — no castle-defense content was added.

## What changed in 0.2.1 (Lab fixes, in priority order)

1. **Build sheet (this file)** — build number, changes, finished vs placeholder, target devices, known issues.
2. **Save trap fixed in code** — progress autosaves on every catch, every settings change, and whenever the page is hidden or unloaded; the HUD shows "Saved ✓ time" after every save; the first-launch tutorial states on screen that saving is automatic. Delete-and-reinstall restore still needs a real-device test (see Known issues).
3. **Low-memory guard in code** — devices at or below 2 GB RAM (`navigator.deviceMemory`) run low-memory mode: one short haptic pulse instead of a pattern, no pulsing bite-cue animation. Crashes are logged with device RAM in the playtest session so shutdowns can be reproduced by device. The lowest-spec Android 6.0 device test has not been run yet (see Known issues).
4. **First 10 minutes** — first-launch tutorial: cast the idle line, hookset on the BITE! cue for the first hand-fought fish, then chase the Silver King (first legend, Boulder Run, Cedar Creek, dusk) — one thing players can name and remember. Retest with new players still pending.
5. **Ads & pacing audit** — monetization is **free, no ads** (ad frequency: zero — nothing to cut). Pacing is now logged automatically: time to first hand-fought catch and time to first legend (see `src/playtest.js` pacing events, exported from Settings). Grind to the first rod upgrade cannot be measured yet — the upgrade shop is a placeholder until milestone 4.

## Finished vs placeholder

| Area | Status |
|---|---|
| Idle line, hand-fishing loop, bite cue, first-attempt grace period, stated miss penalty | Finished |
| 12-quest table, three waters, three legends, collection log, endgame definition | Finished |
| PWA offline cache, portrait/landscape layouts, haptics, Capacitor Android wrap | Finished |
| Hookset logging by fish size, pacing logging, crash logging by device RAM | Finished (0.2.1) |
| Autosave + first-launch tutorial + low-memory guard | Finished (0.2.1) |
| Tackle / upgrade shop (rod, line, reel, lure unlocks) | Placeholder — panel text says "wired in milestone 4" |
| In-game quest tracking | Placeholder — quest panel points at `docs/quests.md` |
| Cloud save / cross-device sync | Not built — saves are on-device only (localStorage) |
| Recorded real-phone playtest | Not done — bite/hookset windows are still the v0.2.0 defaults |

## Target devices

- **Web (PWA):** any modern browser; offline via service worker over http(s).
- **Android (Capacitor debug APK):** a mid-range Android phone for the recorded playtest — model and OS version still to be confirmed (open question).
- **Lowest-spec test target:** an Android 6.0 device, the oldest supported — model still to be confirmed.

## Known issues / not yet proven

- Delete-and-reinstall restore has **not** been tested on a real device. Saves are on-device localStorage; there is no cloud backup yet, so a reinstall currently loses progress unless the device backup restores it.
- No low-memory shutdown has been reproduced; the guard and crash logging are in, the Android 6.0 device test is not.
- No recorded real-phone playtest yet; bite/hookset windows are still the v0.2.0 defaults.
- The upgrade shop is a placeholder, so pacing to the first rod upgrade is unmeasurable until it ships.
- The v0.1 bug list still has no authoritative source (see `docs/bug-audit.md`).

## Pacing audit (Lab fix #5)

- Monetization: free, no ads. Ad frequency: 0. Nothing stalls the loop for ads.
- Logged automatically: `first_hand_catch`, `first_legend` (milliseconds since session start). Export from Settings → Export playtest log.
- Still to measure in the recorded playtest: time to first legend (the "first boss" equivalent), and grind to the first rod upgrade once the shop ships.
