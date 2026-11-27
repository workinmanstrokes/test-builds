# Final Cast — build sheet (one page)

**Build 0.2.6** · 2026-11-27 · repo `workinmanstrokes/final-cast-v0-2` · branch `main`
· based on commit `ec72f14cf1985ca8a4621e87c1829b13d152f12c` (v0.2.4) — 0.2.5 shipped on top of it (see below)
· VEX review: **5.0/10 (grade C)** — this build answers that review, item by item below.
· Game Test Lab review: **3.8/10 (grade D)** — answered in 0.2.3, kept here.
· VEX review (2026-11-26): **4.5/10 (grade D)** — answered in 0.2.2, kept here.
· Game Test Lab review (2026-11-25): **4.8/10 (grade D)** — answered in 0.2.1, kept here.

**Read this first: the tester reviewed the wrong game — again.** The Lab's 3.8 text describes a Grow Castle-style tower-defence Android game — "place a tower or hero, clear a wave, spend the reward, start the next wave", Google Cloud save, ads, a public store listing. Final Cast is a pixel-art idle fishing game: no towers, no waves, no heroes, no castle, no ads, no store listing, no cloud save. The mapping below applies each Lab item to the fishing game as shipped and says plainly where an item belongs to the other game instead. No tower-defence content was added.

## What changed in 0.2.6 (VEX 5.0 follow-up, suggestion 497)

The VEX 5.0 follow-up re-picked one red flag from the 5.0 review: the
12-quest idle-then-fight arc had no described pacing, economy or
difficulty tuning, so repetition and burnout were a live risk. Build
0.2.6 writes the tuning down and wires what can be wired:

- **Pacing, economy and difficulty targets** in `src/tuning.json`
  (`pacing`, `economy`) and in the quest table in `docs/quests.md`:
  target minutes and target active share per quest (arc: quests 1–2 in
  the first 10 minutes, 3–5 inside the first hour, first legend in
  session 2, full arc 3–5 sessions / about 2–3 hours); coin economy as
  shipped (idle +5, hand +25, legend +100) with quest-completion bonuses
  of 25 coins × quest number; difficulty ramp ×1.00 on quests 3–5,
  ×0.95 on 6–8, ×0.90 on 9–12.
- **Wired in `src/main.js`:** the idle gap now comes from
  `pacing.idleGapMs` (4–9 s as shipped), bite/hookset windows are
  multiplied by the quest-band ramp after the forgiving first-quest
  window, and coin rewards come from `tuning.economy`. The per-size
  windows and legend-fight table are unchanged.
- **Anti-burnout rules** in `docs/quests.md`: every quest adds a new
  mechanic, unlock, water or legend; no quest is more than 70% idle
  waiting (quest 11, the background collection quest, is the flagged
  exception at 30% active); no quest targets over 20 minutes without a
  completion bonus; the first session reaches quest 2 inside 10 minutes.
- **Honest limits:** the targets are design targets, not measurements —
  the pacing log in `docs/quests.md` is still empty until a real 1–12
  playthrough fills it. Quest-completion bonuses are targets only:
  in-game quest tracking is still a placeholder, so no bonus is paid
  today; the bonuses are what the milestone-4 shop pays when quest
  tracking ships.

## What changed in 0.2.5 (VEX 5.0 items, in the tester's order)

The 5.0 review is the one the v0.2 plan was built from. Build 0.2.5
answers all fifteen of its items; the full build-numbered audit is in
[`docs/bug-audit.md`](docs/bug-audit.md). Anything marked "still open"
below needs a real phone, a real playthrough, or a maker step — it is
not claimed as done.

| # | VEX 5.0 item | What 0.2.5 does |
|---|---|---|
| 1 | Put the CI debug APK on 3–5 real Android phones of different sizes and ages; record a full session per phone: bite hits/misses, haptic feel, portrait/landscape touch targets, frame drops, offline PWA | Protocol + logging in: `docs/playtest-protocol.md` (3–5 phone matrix, per-phone record, pass bar); `src/playtest.js` records per-phone details, bite hits/misses (`logBite`), and frame drops; Settings has a phone model / Android version field so one exported log is one phone's session. No phone tested yet — the test itself is still open. |
| 2 | Write down and tune the actual timing numbers — bite-window length, hookset grace period, legend-fight difficulty by water and quest — then add a forgiving first-quest window and a clear visual/audio bite cue | Numbers written down and wired in: `src/tuning.json` holds per-size bite/hookset windows, the 250 ms first-attempt grace, `firstQuestWindowMs` (1800 ms bite / 1200 ms hookset on quests 1–2), and `legendFight` difficulty 3/4/5 by water; `src/main.js` applies the first-quest window, plays a two-tone audio beep with the visual BITE! banner and haptic buzz, and fights legends at their per-water difficulty. Retuning from real-phone logs is still open. |
| 3 | Re-test the old v0.1 bug list against the current build, mark each item fixed or unfixed with the build number, and stop carrying the stale review forward | `docs/bug-audit.md` now carries the build-numbered VEX 5.0 audit. The authoritative v0.1 bug list still has no source — nothing from it can be marked fixed until it is imported. |
| 4 | Play quests 1–12 in sequence and log minutes idle versus active, time per quest and where the loop repeats; vary, shorten or add a new mechanic to any quest that is just wait, fight, repeat | Logging in: `src/playtest.js` `noteQuestClock` / `logQuestComplete` / `questSummary()` split idle vs active minutes per quest; `docs/quests.md` has the pacing-log table to fill from a real playthrough. No 1–12 playthrough recorded yet. |
| 5 | Decide the release and monetisation model — free web/PWA, paid, ads or IAP — and produce a release APK and PWA/store listing instead of stopping at a CI debug APK | Decision recorded (free, no ads, no IAP) in Settings, `docs/quests.md`, and below. Release checklist below lays out the release APK and store-listing steps; the release build and the listing itself still need maker steps (signing keystore, store account). |
| 6 | Across 12 quests the loop is the same idle wait, big bite, hand fight; no quest-type variety, new mechanic per water, or story beat is described | Described in `docs/quests.md`: every quest now carries a type (tutorial / timing / experiment / exploration / economy / upgrade / unlock / legend / collection) and a story beat per water (Millpond dawn, Cedar Creek dusk chase, Ember Lake night trial). |
| 7 | Hand-fishing fairness cannot be judged: no bite-window duration, hookset forgiveness, retrieve-speed trade-off, failure penalty or assist option is stated | Stated in `src/tuning.json`: windows by size, 250 ms grace, 1800/1200 ms first-quest window, `retrieveSpeedTradeoff` (slow x1.25 window, fewer bites; medium baseline; fast x0.8 window, more bites), miss penalty (8 s line slack, 30 s spot rest, nothing lost). |
| 8 | No real-phone playtest is recorded, so portrait/landscape layouts, touch targets, haptics and bite readability are claimed but unproven on device | Still open — protocol and logging in 0.2.5 (item 1), no session recorded yet. |
| 9 | Bug status is stale: the review was against the v0.1 prototype, some bugs are said to be fixed, and what remains unfixed is unverified | Answered by the build-numbered audit in `docs/bug-audit.md` (item 3): open items stay open until retested. |
| 10 | Visual and feedback detail is thin: no fish animation, bite cue, UI clarity or visual distinction between waters is described | Fixed in 0.2.5 — see "Visual and feedback detail" below: per-water pond palettes with a swimming pixel fish, and a three-channel bite cue (visual + audio + haptic). |
| 11 | No monetisation, pricing or store presence is described, so the path from a CI debug APK to a player finding and sustaining the game is missing | Decision + path in 0.2.5: free, no ads, no IAP (in the game and the docs); release checklist below is the path to a player finding it. No listing exists yet. |
| 12 | Red flag: no real-phone playtest recorded despite haptics and precise timing being core to the hand-fishing loop | Still open — same as item 8. |
| 13 | Red flag: remaining bugs are unverified because the design review was written against the v0.1 prototype | Answered in 0.2.5 — same as item 9. |
| 14 | Red flag: only a debug APK from CI is described — no release build, store listing or launch path | Still open — release checklist below; release APK and listing need maker steps. |
| 15 | Red flag: no monetisation model is described, leaving the release with no sustainability plan | Decision fixed in 0.2.5 — free, no ads, no IAP, recorded in Settings, `docs/quests.md`, and below. |

## Visual and feedback detail (VEX 5.0 item 10)

What the player actually sees and feels, as shipped in 0.2.5:

- **Per-water pond**: the canvas is painted per water, not one generic
  gradient — Millpond at dawn (green–teal), Cedar Creek at dusk
  (indigo–blue), Ember Lake at night (ember orange–near-black). The
  water label in the HUD names the water and time of day.
- **Fish animation**: one pixel fish (body, tail triangle, eye) swims
  across the pond on a gentle sine path, drawn on the canvas in the
  water's accent colour. In low-memory mode it is drawn once and does
  not animate, so a small-RAM phone does less work per second.
- **Bite cue, three channels**: visual — amber BITE! banner (`#ffb703`,
  pulsing; static in low-memory mode); audio — two-tone WebAudio beep
  (880 Hz then 1320 Hz, 90 ms each, no audio asset); haptic — buzz
  pattern `[60, 40, 60]` ms, one 30 ms pulse in low-memory mode. All
  three fire on the same bite, so a miss feels fair, not random — the
  player was told by sight, sound, and touch.
- **Fight feedback**: the fight bar fills green as the player taps to
  reel; the bar's drift and the reel gain come from the legend-fight
  table (`src/tuning.json`), so the Silver King and the Emberfin
  genuinely fight harder than the Old Mossback.
- **Miss feedback**: the stated penalty is shown on screen — 8 s line
  slack, 30 s spot rest, no coins or tackle lost.

## Release checklist (VEX 5.0 item 5)

Monetization decision: **free, no ads, no in-app purchases** — recorded
in the game Settings, `docs/quests.md`, and the monetization rules
below. The release path from the CI debug APK is:

1. **Release APK** (not the CI debug APK): build a signed release in
   Android Studio (`Build → Generate Signed App Bundle / APK`) from the
   Capacitor Android project. Needs a release keystore — **maker step**:
   create it once in Android Studio and keep the keystore file and
   passwords safe; a lost keystore means the app can never be updated
   under the same listing. Do not commit the keystore to the repo.
2. **PWA / web release**: the web build is already the release — serve
   this folder over HTTPS with the service worker (`sw.js`) so the PWA
   installs and plays offline. Confirm the manifest title, description,
   and icon (shipped in 0.2.4) before pointing players at it.
3. **Store listing**: create the listing with the store identity in this
   sheet (exact title "Final Cast — Idle Fishing", pixel-art rod-over-pond
   icon, five screenshots, description opening "pixel-art idle fishing
   game — not a tower-defence game"). Needs a Google Play developer
   account — **maker step**. No listing exists yet.
4. **Before listing**: the multi-phone playtest (`docs/playtest-protocol.md`)
   must have at least one recorded session, and the quest pacing log
   (`docs/quests.md`) must have a 1–12 playthrough — a listing that
   points at an unproven build repeats the 5.0 review.

## What is playable in 0.2.5

- Idle line that catches small fish on its own; big bites hand you the rod.
- Hand-fishing loop: BITE! cue (visual + audio beep + haptic buzz), hookset timing with a first-attempt grace period and a forgiving first-quest window (1800/1200 ms on quests 1–2), a stated miss penalty (8 s line slack, 30 s spot rest, nothing lost), lure retrieves at three speeds, worm depth, fishing-spot choice.
- Three waters (Millpond, Cedar Creek, Ember Lake), each with its own pond palette and legend fish tied to one spot and time of day; 12 quests with types and story beats; collection and legend log.
- First 10 minutes: cast the idle line, hookset on the BITE! cue for the first hand-fought fish, then chase the Silver King (first legend, Boulder Run, Cedar Creek, dusk) — the one thing players can name and remember.
- PWA offline cache, portrait and landscape layouts, haptics, Capacitor Android wrap. Telemetry off on localhost and with Do Not Track.
- Performance logging for the low-end test pass: load time, frame drops and memory use are recorded in the exported playtest session (new in 0.2.3).
- Playtest logging for the multi-phone pass: bite hits/misses, hookset attempts by fish size, quest idle vs active minutes, and per-phone details (new in 0.2.5).

## What changed in 0.2.4 (VEX items 772–773, re-picked from the Lab 3.8 review)

Build 0.2.3 answered Lab items 5 and 6 in this sheet only. 0.2.4 ships them in the game itself:

| # | Lab item | What 0.2.4 does |
|---|---|---|
| 772 | Clarify store identity: exact title, icon, screenshots, and description that separate Final Cast from Final Castle, Final Squad, and The Finals | The identity now ships in the build, not just in this sheet: `manifest.webmanifest` carries the exact title **"Final Cast — Idle Fishing"**, the description that opens "pixel-art idle fishing game — not a tower-defence game", and the icon (`icon.svg`: pixel-art fishing rod over a still pond at dawn, teal water, gold hook — no castle, no tower). `index.html` links the manifest and icon, and its `<title>` is now the exact store title. The five screenshots are still a shot list in this sheet — there is no listing yet to attach them to, and no screenshots were staged. Renaming the game is still a maker decision, not taken here. |
| 773 | No monetization or ad plan described: the analogue is free and contains ads, with no placement, reward, or progression pacing shown for this build | The full monetization and ad rules now appear in the game itself (Settings panel), not just in this sheet: free, no ads, no in-app purchases; no rewarded ads, no interruptive ads, no ad placement anywhere, no ad SDK, ad frequency zero; coins earned only by catching fish; nothing stalls the idle loop (no timer, energy, or ad gate between casts); the first legend is reached by fishing, never by paying. The analogue's ads belong to the other game — Final Cast has never had ads. |

## What changed in 0.2.3 (Lab 3.8 items, in the tester's order)

| # | Lab item | What 0.2.3 does |
|---|---|---|
| 1 | Send a one-page build brief plus a 60-second capture of the actual loop: place a tower or hero, clear a wave, spend the reward, start the next wave | This file is the brief, updated. The capture script is below ("60-second capture of the actual loop"): cast the idle line, hookset a big bite on the BITE! cue, fight and land it, bank the coins in the collection, cast again. One step cannot be captured yet: spending the reward on tackle — the upgrade shop is a placeholder until milestone 4, so the script records the coins banked instead and says so. No tower, hero or wave exists to place or clear. |
| 2 | Define one thing Final Cast does that Grow Castle and Final Castle do not — one hero combo, tower, pet, or boss mechanic — and put it in the first five minutes | The differentiator is the hand-fought big bite: the idle line fishes for you, but when something big bites you take the rod and fight it by hand — then the first session points you at the Silver King (first legend, Boulder Run, Cedar Creek, dusk). It is named in the first-launch tutorial, inside the first five minutes, and the pacing log records time to first hand-fought catch and first legend to prove it lands. No hero combo, tower, pet or boss mechanic was added — there are no towers or heroes in a fishing game. |
| 3 | Lock a low-end Android test pass on the oldest device you support: a 10-minute wave session recording memory use, shutdowns, load time, and frame drops | No waves exist; the test is a 10-minute fishing session (protocol below). The logging is now in the game: load time (`recordLoadTime`), frame drops and long stalls for the first 10 minutes (`startFrameMonitor`), JS heap sampled every 30 s (`sampleMemory`), crashes tagged with device RAM — all in `src/playtest.js`, wired in `src/main.js`, exported from Settings. The device test itself still needs a real Android 6.0 phone (see Known issues). |
| 4 | Implement and test Google Cloud save and restore before tuning progression: verify delete and reinstall keeps heroes, artifacts, and currency | No Google Cloud save — there is no backend at all, and no heroes or artifacts exist (the save holds coins, fish caught, collection and legends). What ships: autosave on every catch, every settings change, and whenever the page is hidden or unloaded; the first-launch warning that deleting the app deletes progress; and Settings → Back up save (`final-cast-save.json`). The delete-and-reinstall restore test still needs a real device (see Known issues). |
| 5 | Write the monetization and ad rules: where ads appear, what is rewarded versus interruptive, and time to first boss without paying, then check it does not stall the idle loop | Rules written out below ("Monetization and ad rules"): free, no ads, no in-app purchases — ad frequency is zero, so there are no rewarded or interruptive ads anywhere, and nothing can stall the idle loop. "First boss" here is the first legend (Silver King); time to first legend is logged (`first_legend` pacing event) but still unmeasured — no recorded playtest yet. |
| 6 | Clarify store identity: exact title, icon, screenshots, and description that separate Final Cast from Final Castle, Final Squad, and The Finals | Proposed identity written out below ("Store identity"): exact title "Final Cast — Idle Fishing", icon, five screenshots, and a description that opens "pixel-art idle fishing game — not a tower-defence game". Final Cast has no public store listing yet, so this is the identity to use when it is listed, not a listing that exists. Renaming the game is a maker decision, not taken here. |

## 60-second capture of the actual loop (Lab item 1)

Record on the test phone while playing; export the playtest session from Settings afterwards — the hookset log proves the timing.

- 0:00–0:05 — Open the game. The idle line is already in the water; the HUD shows coins, fish caught, water and quest.
- 0:05–0:20 — The idle line catches a small fish on its own (+5 coins, HUD updates, "Saved ✓" appears).
- 0:20–0:35 — A big bite: the BITE! cue flashes with a haptic buzz. Tap HOOK inside the hookset window (first-attempt grace 250 ms).
- 0:35–0:50 — Fight: tap the bar to keep it in the green; land the fish (+25 coins, +100 for a legend).
- 0:50–0:60 — Reward banked: the collection count rises, a legend is logged if it was one; cast again and the next bite starts the loop over.
- "Spend the reward" is not in the capture: the upgrade shop is a placeholder until milestone 4, so the script shows the coins banked instead. Do not stage a spend that the build cannot do.
- Status: the capture has not been recorded yet — it needs a real phone (see Known issues).

## Low-end Android test protocol (Lab item 3)

- Device: an Android 6.0 phone, the oldest supported — model still to be confirmed.
- Session: 10 minutes of play — cast, land at least one hand-fought fish, switch waters once.
- Recorded automatically in the exported playtest session: load time in ms (`performance.loadMs`), frame drops (gaps over 33.4 ms) and long stalls (gaps over 100 ms) across the first 10 minutes, JS heap in MB sampled every 30 s (`performance.memorySamples`, Chrome / Android WebView only), crashes tagged with device RAM, and hookset success/fail by fish size.
- Pass bar: zero shutdowns, zero crashes, and no long stalls during the fight loop on the test device. The numbers are the evidence — no pass is claimed until a real device run produces them.

## Monetization and ad rules (Lab item 5)

- Free. No ads — no rewarded ads, no interruptive ads, no ad SDK in the build. No in-app purchases.
- Nothing in the game costs real money; coins are earned only by catching fish.
- Nothing stalls the idle loop: the line keeps fishing while the player is away from the screen; there is no timer, energy, or ad gate between casts.
- Time to first boss without paying: the "first boss" is the first legend fish (Silver King, Boulder Run, Cedar Creek, dusk). Time to first legend is logged automatically (`first_legend` pacing event); it is still unmeasured because no recorded playtest exists yet. Paying cannot speed it up — there is nothing to buy.
- If monetization ever changes, the decision is recorded in Settings and in this sheet — it is not changed silently.

## Store identity (Lab item 6)

Proposed identity for when Final Cast is listed. No listing exists yet.

- Exact title: **Final Cast — Idle Fishing**
- Icon: pixel-art fishing rod over a still pond at dawn, teal water, gold hook — the rod and water, not a castle or tower.
- Screenshots (5): 1) main fishing view with the idle line and a BITE! cue; 2) the hand-fishing fight bar; 3) the quest log; 4) waters and the legend log (Silver King at Boulder Run, dusk); 5) the collection and endgame screen.
- Description (first lines): "Final Cast is a pixel-art idle fishing game. Your line fishes for you — when something big bites, you take the rod and fight it by hand. Three waters, twelve quests, three legend fish. Free, no ads, no in-app purchases. Not Final Castle, not a tower-defence game."
- The name collision is real ("Final Cast" sits next to "Final Castle", "Final Squad" and "The Finals" in search) — the title, icon and description all carry "idle fishing" so the game is not mistaken for a tower-defence game. Renaming the game is a maker decision, not taken here.

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
| 16 | Long-lived but low-rated: in market since April 2019 yet still 3.3 stars | That history belongs to the other game. Final Cast v0.2 is a new update to a web/PWA game with no store history; its Lab scores are 5.0 (v0.1), 4.8 (0.2.1), 4.5 (VEX, 0.2.2) and 3.8 (Lab, 0.2.3). |

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
| Load-time / frame-drop / memory logging for the low-end test pass, 60-second capture script, monetization rules, proposed store identity | Finished (0.2.3) |
| Store identity in the shipped build (manifest, icon, exact title) and full monetization/ad rules in the Settings panel | Finished (0.2.4) |
| VEX 5.0 fixes: first-quest forgiving window, audio bite cue, per-water legend-fight difficulty, retrieve-speed trade-off stated, quest types + story beats, build-numbered bug audit, release checklist | Finished (0.2.5) |
| Multi-phone playtest protocol + per-phone session logging + bite hit/miss logging + quest idle/active timing | Finished (0.2.5) — protocol and logging; no phone tested yet |
| Pacing, economy and difficulty tuning for the 12-quest arc (targets + anti-burnout rules, idle gap / window ramp / coin rewards wired from tuning.json) | Finished (0.2.6) — targets, not measurements; pacing log still empty until a real 1–12 playthrough |
| Tackle / upgrade shop (rod, line, reel, lure unlocks) | Placeholder — panel text says "wired in milestone 4" |
| In-game quest tracking | Placeholder — quest panel points at `docs/quests.md` |
| Cloud save / cross-device sync | Not built — saves are on-device only (localStorage); manual backup download added in 0.2.2 |
| Recorded real-phone playtest | Not done — bite/hookset windows are still the v0.2.0 defaults until a real-phone session retunes them |
| Release APK + store listing | Not done — checklist in 0.2.5; needs a signing keystore and a Play developer account (maker steps) |

## Target devices

- **Web (PWA):** any modern browser; offline via service worker over http(s).
- **Android (Capacitor debug APK):** 3–5 real phones of different sizes and ages for the recorded playtest — see `docs/playtest-protocol.md` for the matrix. Models and OS versions still to be confirmed (open question).
- **Lowest-spec test target:** an Android 6.0 device, the oldest supported — model still to be confirmed.

## Known issues / not yet proven

- Delete-and-reinstall restore has **not** been tested on a real device. Saves are on-device localStorage; there is no cloud backup yet, so a reinstall currently loses progress unless the player saved a backup file first (Settings → Back up save) or the device backup restores it.
- No low-memory shutdown has been reproduced; the guard, the idle/fight throttling, and crash logging are in, the Android 6.0 device test is not.
- No recorded real-phone playtest yet; bite/hookset windows are still the v0.2.0 defaults (the first-quest window is the only tuned value, and it is a design choice, not a measured one).
- The 60-second capture of the actual loop has not been recorded yet — it needs a real phone.
- Time to first legend ("first boss" in the Lab's words) is still unmeasured — no recorded playtest yet.
- The upgrade shop is a placeholder, so pacing to the first rod upgrade is unmeasurable until it ships.
- The v0.1 bug list still has no authoritative source (see `docs/bug-audit.md`).
- Day-1 / day-7 retention has no data yet — logging is in, but no player has had 7 days with the build.
- No 1–12 quest playthrough has been recorded yet — the pacing log in `docs/quests.md` is empty until one is.
- No release APK or store listing exists yet — see the release checklist above.

## Pacing and retention audit (VEX item 5)

- Monetization: free, no ads, no in-app purchases. Ad frequency: 0. Nothing stalls the loop for ads.
- Logged automatically: `first_hand_catch`, `first_legend` (milliseconds since session start); retention: `daysPlayed` plus `retention.day1` / `retention.day7` flags. Export from Settings → Export playtest log.
- Still to measure in the recorded playtest: time to first legend (the "first boss" equivalent), and grind to the first rod upgrade once the shop ships.
- Review sentiment: not trackable — Final Cast has no public store listing (VEX item 7).
