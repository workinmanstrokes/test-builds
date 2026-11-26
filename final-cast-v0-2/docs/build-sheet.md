# Final Cast — build sheet (one page)

**Build 0.2.2** · 2026-11-26 · repo `workinmanstrokes/final-cast-v0-2` · branch `main`
· based on commit `99aea8c5b3ddb1e5b258614a8834ae4915518622` (v0.2.1)
· VEX review: **4.5/10 (grade D)** — this build answers that review, item by item below.
· Game Test Lab review (2026-11-25): **4.8/10 (grade D)** — answered in 0.2.1, kept here.

**Read this first: the tester reviewed the wrong game.** VEX's text describes a
Grow Castle-style tower-defence Android game — "castle-defense", a 3.26-star
public record from 665 ratings, version 2.6.2, in market since April 2019,
Google Cloud save, free with ads. Final Cast is a pixel-art idle fishing
game: no towers, no waves, no castle, no ads, no store listing, no cloud
save. The mapping below applies each VEX item to the fishing game as shipped
and says plainly where an item belongs to the other game instead. No
tower-defence content was added.

## What is playable in 0.2.2

- Idle line that catches small fish on its own; big bites hand you the rod.
- Hand-fishing loop: BITE! cue, hookset timing with a first-attempt grace
  period, a stated miss penalty (8 s line slack, 30 s spot rest, nothing lost),
  lure retrieves at three speeds, worm depth, fishing-spot choice.
- Three waters (Millpond, Cedar Creek, Ember Lake), each with a legend fish
  tied to one spot and time of day; 12 quests; collection and legend log.
- First 10 minutes: cast the idle line, hookset on the BITE! cue for the
  first hand-fought fish, then chase the Silver King (first legend, Boulder
  Run, Cedar Creek, dusk) — the one thing players can name and remember.
- PWA offline cache, portrait and landscape layouts, haptics, Capacitor
  Android wrap. Telemetry off on localhost and with Do Not Track.

## What changed in 0.2.2 (VEX items, in the tester's order)

| # | VEX item | What 0.2.2 does |
|---|---|---|
| 1 | Send a real build brief next time | This file, updated: build number, what is playable, devices tested, first 10 minutes, known bugs. |
| 2 | Reproduce and fix low-memory shutdowns on a low-end Android 6.0–8 device during large waves | No waves exist in this game; the busiest moments are the idle-line bite and the fight loop. Low-memory mode now also slows those down: a fixed 9 s idle gap (`lowMemoryIdleDelayMs`) instead of the 4–9 s random gap, and a 200 ms fight tick (`lowMemoryFightTickMs`) instead of 120 ms (`src/tuning.json`, `src/main.js`). Crash logging by device RAM was already in; the Android 6.0–8 device test itself still needs a real device (see Known issues). |
| 3 | Make save protection obvious at first launch: prompt Google Cloud sign-in and backup, warn before progress can be lost | No Google Cloud save exists — there is no backend at all. What ships instead: the first-launch tutorial now warns in plain words that deleting the app deletes progress, and Settings → Back up save downloads the save as `final-cast-save.json` (`index.html`, `src/main.js`). Autosave itself was already unmissable (HUD "Saved ✓ time"). |
| 4 | Prove one differentiator in the first session | The differentiator is named in the tutorial itself: the idle line fishes for you, but the big ones you fight by hand — then the Silver King chase gives the first session a goal no idle-fishing clone hands you mid-bite. |
| 5 | Audit first-session ads and grind pacing, then track day-1 / day-7 retention and review sentiment | Ads: none — free, no ads, no IAP (stated in Settings now, not just in docs). Pacing logging was already in. Retention is now logged on-device: `recordPlayDay()` in `src/playtest.js` records days played and flags day-1 / day-7 return in the exported session. Review sentiment cannot be tracked in-game: Final Cast has no public store listing (see item 7). |
| 6 | No build description, build number, or test evidence supplied | Supplied now: this file (build 0.2.2, what's playable, devices, first 10 minutes, known issues). Test evidence still needs the recorded real-phone playtest. |
| 7 | Public rating only 3.26 stars from 665 ratings despite updates to 2.6.2 | That record belongs to the tower-defence game VEX confused this with. Final Cast has no Play Store listing, no version 2.6.2, and no public rating — there is nothing to beat yet, and no review sentiment to track until it is listed. |
| 8 | Listing warns of shutdowns from insufficient memory, especially on old phones | No listing exists for Final Cast, so no listing warns of anything. In-game answer: the low-memory guard (item 2) plus crash logging by device RAM. |
| 9 | Progress is lost if the game is deleted unless the player uses Google Cloud save | True here too (saves are on-device localStorage). Answered by item 3: first-launch warning + manual backup download. Cloud save itself is still not built. |
| 10 | Concept as named is near-identical to Grow Castle-style tower defence | Wrong game again — the name collision is real ("Final Cast" sits next to "Final Castle" in search), which is why the README and the page's meta description now say in plain words that this is a pixel-art idle fishing game, not a tower-defence game. The game itself has no tower-defence content to remove. |
| 11 | Free with ads confirmed, but IAP, ad frequency and progression pacing unstated | Stated now, in the game: free, no ads, **no in-app purchases**, ad frequency 0 (Settings panel). Pacing is logged (`first_hand_catch`, `first_legend`); grind to the first rod upgrade is still unmeasurable — the upgrade shop is a placeholder until milestone 4. |
| 12 | Title confusion: "Final cast" sits between Final Castle, Final Squad and The Finals in search | Disambiguation added where search sees it: README header and the page `<meta name="description">` both say "pixel-art idle fishing game — not Final Castle, not a tower-defence game". Renaming the game is a maker decision, not taken here. |
| 13 | No supplied build to test | Build 0.2.2 is supplied with this sheet; web build runs over HTTP (`python3 -m http.server 8000`), Android via the Capacitor debug APK. Scope and completeness are in the Finished vs placeholder table below. |
| 14 | Memory-related shutdowns on low-end Android threaten the casual and idle audience | Same fix as item 2 — low-memory mode now throttles the idle and fight loops, not just haptics and animation. The lowest-spec device test is still open. |
| 15 | Cloud-only save safety net risks losing long-term incremental progress | Same answer as items 3 and 9 — warning + backup download now; cloud save not built. |
| 16 | Long-lived but low-rated: in market since April 2019 yet still 3.3 stars | That history belongs to the other game. Final Cast v0.2 is a new update to a web/PWA game with no store history; its Lab scores are 5.0 (v0.1), 4.8 (0.2.1) and 4.5 (VEX, 0.2.2). |

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
| Low-memory idle/fight throttling, save backup download, day-1/day-7 retention logging, no-IAP statement, title disambiguation | Finished (0.2.2) |
| Tackle / upgrade shop (rod, line, reel, lure unlocks) | Placeholder — panel text says "wired in milestone 4" |
| In-game quest tracking | Placeholder — quest panel points at `docs/quests.md` |
| Cloud save / cross-device sync | Not built — saves are on-device only (localStorage); manual backup download added in 0.2.2 |
| Recorded real-phone playtest | Not done — bite/hookset windows are still the v0.2.0 defaults |

## Target devices

- **Web (PWA):** any modern browser; offline via service worker over http(s).
- **Android (Capacitor debug APK):** a mid-range Android phone for the recorded playtest — model and OS version still to be confirmed (open question).
- **Lowest-spec test target:** an Android 6.0 device, the oldest supported — model still to be confirmed.

## Known issues / not yet proven

- Delete-and-reinstall restore has **not** been tested on a real device. Saves are on-device localStorage; there is no cloud backup yet, so a reinstall currently loses progress unless the player saved a backup file first (Settings → Back up save) or the device backup restores it.
- No low-memory shutdown has been reproduced; the guard, the idle/fight throttling, and crash logging are in, the Android 6.0 device test is not.
- No recorded real-phone playtest yet; bite/hookset windows are still the v0.2.0 defaults.
- The upgrade shop is a placeholder, so pacing to the first rod upgrade is unmeasurable until it ships.
- The v0.1 bug list still has no authoritative source (see `docs/bug-audit.md`).
- Day-1 / day-7 retention has no data yet — logging is in, but no player has had 7 days with the build.

## Pacing and retention audit (VEX item 5)

- Monetization: free, no ads, no in-app purchases. Ad frequency: 0. Nothing stalls the loop for ads.
- Logged automatically: `first_hand_catch`, `first_legend` (milliseconds since session start); retention: `daysPlayed` plus `retention.day1` / `retention.day7` flags. Export from Settings → Export playtest log.
- Still to measure in the recorded playtest: time to first legend (the "first boss" equivalent), and grind to the first rod upgrade once the shop ships.
- Review sentiment: not trackable — Final Cast has no public store listing (VEX item 7).
