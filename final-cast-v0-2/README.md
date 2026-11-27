# Final Cast v0.2

**Tune the bite, prove the fixes, and finish the cast.**

Final Cast v0.2 is the next update to the existing pixel-art idle fishing game by Diddlerrr. Your line fishes for you; when something big bites you take the rod and fight it by hand. This update applies the game tester's fixes in priority order after a 5.0/10 (grade C) review.

**Not Final Castle, and not a tower-defence game.** Final Cast is a pixel-art idle fishing game — there are no towers, waves, or castle defences in it. The Lab and VEX reviews both describe a tower-defence game by a similar name; their fixes are applied here to the fishing game as shipped (see `docs/build-sheet.md` for the item-by-item mapping).

## Build 0.2.6 — VEX 5.0 follow-up (suggestion 497)

The VEX 5.0 follow-up re-picked one red flag: the 12-quest arc had no
described pacing, economy or difficulty tuning, so repetition and burnout
were a live risk. Build 0.2.6 writes the tuning down in
[`src/tuning.json`](src/tuning.json) (`pacing`, `economy`) and in the
quest table in [`docs/quests.md`](docs/quests.md): target minutes and
active share per quest (quests 1–2 in the first 10 minutes, first legend
in session 2, full arc 3–5 sessions / about 2–3 hours), the coin economy
as shipped (idle +5, hand +25, legend +100, completion bonuses of 25
coins × quest number), and a difficulty ramp (windows ×1.00 on quests
3–5, ×0.95 on 6–8, ×0.90 on 9–12) — plus anti-burnout rules (every quest
adds something new, no quest more than 70% idle waiting). The idle gap,
window ramp and coin rewards are wired in `src/main.js` from tuning.
These are design targets, not measurements: the pacing log is still empty
until a real 1–12 playthrough fills it, and quest-completion bonuses pay
nothing yet because in-game quest tracking is still a placeholder. See
[`docs/build-sheet.md`](docs/build-sheet.md).

## Build 0.2.5 — VEX review (5.0/10, grade C)

This is the review the v0.2 plan was built from. Build 0.2.5 answers all fifteen of its items — see [`docs/build-sheet.md`](docs/build-sheet.md) and the build-numbered audit in [`docs/bug-audit.md`](docs/bug-audit.md):

- **Timing numbers, written down and wired in:** `src/tuning.json` now holds the per-size bite/hookset windows, the 250 ms first-attempt grace, a forgiving first-quest window (1800 ms bite / 1200 ms hookset on quests 1–2), legend-fight difficulty 3/4/5 by water, and the stated retrieve-speed trade-off (slow x1.25 window, fewer bites; fast x0.8 window, more bites). The bite cue is now three channels — visual BITE! banner, two-tone audio beep, haptic buzz — and legends fight at their per-water difficulty.
- **Multi-phone playtest, ready to run:** [`docs/playtest-protocol.md`](docs/playtest-protocol.md) is the 3–5 phone matrix (different sizes and ages, full session per phone: bite hits/misses, haptic feel, portrait/landscape touch targets, frame drops, offline PWA). The game logs it: per-phone session details (Settings → phone model / Android version), bite hit/miss logging, and quest idle-vs-active timing.
- **Quest variety, stated:** [`docs/quests.md`](docs/quests.md) now gives every quest a type and a story beat per water, plus an empty pacing log to fill from a real 1–12 playthrough.
- **Visuals:** each water has its own pond palette with a swimming pixel fish on the canvas (Millpond dawn, Cedar Creek dusk, Ember Lake night).
- **Release path:** the release checklist in the build sheet lays out the signed release APK and store listing; the monetization decision stays **free, no ads, no in-app purchases**.
- **Still open (not claimed as done):** no real phone has been tested yet, no 1–12 playthrough recorded, and the release APK + store listing need maker steps (signing keystore, Play developer account). The bite/hookset windows are still the v0.2.0 defaults until a real-phone session retunes them.

## Build 0.2.4 — VEX items 772–773 (store identity + monetization, shipped in the game)

Build 0.2.3 answered the Lab's items 5 (monetization rules) and 6 (store identity) in `docs/build-sheet.md` only. Build 0.2.4 ships them in the game itself: `manifest.webmanifest` carries the exact store title **"Final Cast — Idle Fishing"**, the description that opens "pixel-art idle fishing game — not a tower-defence game", and the icon (`icon.svg`, a pixel-art rod over a still pond at dawn — no castle, no tower); `index.html` links the manifest and icon and its `<title>` is now the exact store title. The Settings panel now states the full monetization rules in the game: free, no ads, no in-app purchases, no ad placement anywhere, ad frequency zero, coins only from catching fish, and nothing stalling the idle loop. The five store screenshots remain a shot list in the build sheet — there is no listing yet to attach them to.

## Build 0.2.3 — Game Test Lab review (3.8/10, grade D)

The Lab's 2026-11-27 review scored the game 3.8/10. Like the two reviews before it, its text describes a tower-defence game ("place a tower or hero, clear a wave, spend the reward, start the next wave") — Final Cast is an idle fishing game, so build 0.2.3 answers its six items against the fishing game as shipped (see [`docs/build-sheet.md`](docs/build-sheet.md)): a one-page build sheet plus a 60-second capture script of the actual loop (cast, hookset a big bite, land it, bank the reward — spending it on tackle still waits on the milestone-4 upgrade shop); the named first-five-minutes differentiator (you fight the big bites by hand, then chase the Silver King); load-time, frame-drop and memory logging for the 10-minute low-end Android test pass (the device test itself still needs a real phone); the cloud-save answer (no backend — first-launch warning plus manual backup download; delete-and-reinstall restore still untested); the monetization rules written out (free, no ads, no IAP, ad frequency zero, nothing stalls the loop); and the exact proposed store identity that separates Final Cast from Final Castle, Final Squad and The Finals.

## Build 0.2.2 — VEX review (4.5/10, grade D)

The VEX review (2026-11-26) scored the game 4.5/10. Build 0.2.2 answers its sixteen items: a full build sheet ([`docs/build-sheet.md`](docs/build-sheet.md)) with build number, what is playable, devices tested, the first 10 minutes, and known bugs; a slower low-memory mode for low-end Android 6.0–8 phones (longer idle gaps, slower fight ticks, crash logging by device RAM); a first-launch warning that deleting the app loses progress plus a Settings → Back up save download (there is still no cloud save); a named first-session differentiator (you fight the big bites by hand, then chase the Silver King); day-1 / day-7 retention logging in the exported playtest session; and the monetization statement written out in the game itself — free, no ads, no in-app purchases. The review's 3.26-star public record, version 2.6.2, and April 2019 launch date belong to the tower-defence game the tester confused this with: Final Cast has no public store listing, so there is no rating to beat and no review sentiment to track yet. The recorded real-phone playtest and the lowest-spec Android 6.0 device test still need a real device — see the build sheet.

## Build 0.2.1 — Game Test Lab review (4.8/10, grade D)

The Lab's 2026-11-25 review scored the game 4.8/10. Build 0.2.1 answers its five fixes in priority order: a one-page build sheet ([`docs/build-sheet.md`](docs/build-sheet.md)), automatic unmissable saving, a low-memory guard with crash logging by device RAM, a first-launch tutorial into the first hand-fought fish and the Silver King, and pacing logging (free, no ads — ad frequency is zero). The delete-and-reinstall restore test, the lowest-spec Android 6.0 test, and the recorded playtest still need a real device — see the build sheet. (Note: the Lab text calls this a "castle-defense" game; Final Cast is an idle fishing game, and the fixes are applied to the fishing game as shipped.)

## What it is

- **Idle fishing line** that catches common fish automatically, with hand-fishing when something big bites.
- **Hand-fishing loop**: bite window, hookset timing, lure retrieves at three speeds, worm depth, and fishing-spot choice.
- **Three waters** — Millpond, Cedar Creek, Ember Lake — each with a legend fish tied to one spot and time of day.
- **12 quests** across the three waters, each unlocking tackle, lures, waters, or a new mechanic. No pure catch-X grind quests.
- **Upgrades**: rod, line, reel, and tackle, plus lure unlocks.
- **Fairness aid**: an unmistakable bite cue (visual BITE! banner, audio beep, haptic buzz), a short grace period on the first hookset attempt, a forgiving window on quests 1–2, and a small, stated penalty for missing.
- **PWA offline cache**, portrait and landscape layouts, haptics, and a Capacitor Android wrap. Telemetry is off on localhost and with Do Not Track.

## Tester priorities (in order)

1. Run a recorded real-phone playtest on at least one mid-range Android phone: play all hand-fishing, log hookset success/fail rate by fish size, and tune the bite and hookset windows until first-time players succeed most big bites without it feeling automatic.
2. Audit the v0.1 bug list line-by-line against the current build, mark each fixed/verified or still open, and retest the open items — do not ship on the claim that "some were already fixed". See [`docs/bug-audit.md`](docs/bug-audit.md).
3. Write out the 12 quests in one table (objective, new unlock/mechanic, water, difficulty) and cut or rewrite any quest that is only "catch X more fish" with no new choice or reward. See [`docs/quests.md`](docs/quests.md).
4. Add a visible fairness aid for the hand loop — a clear bite cue, a short grace period on the first hookset attempt, and a small, stated penalty for missing — then retest it with new players.
5. Define what happens after quest 12 and legend 3 (collection completion, harder legend variants, daily/spot rotation, or a clean ending) and decide monetization explicitly, even if the decision is "free, no ads".

## How to run

### Web (PWA)

```bash
# Serve the folder over HTTP (service worker needs http(s), not file://)
python3 -m http.server 8000
# Open http://localhost:8000
```

Or open `index.html` directly for a quick look — the game runs, but the offline cache only registers over HTTP.

### Android (Capacitor debug APK)

```bash
npm install
npx cap sync android
npx cap open android   # build the debug APK from Android Studio
```

The debug APK is also built by CI. Install it on a phone and run the recorded playtest (see `src/playtest.js` and `docs/playtest-protocol.md` for the 3–5 phone matrix).

## Saving

Progress saves **automatically** on this device — on every catch, every settings change, and whenever the page is hidden or closed. The HUD shows "Saved ✓ time" after every save, and the first-launch tutorial states that saving is automatic. There is no cloud save yet: a delete-and-reinstall currently loses progress unless the device backup restores it. That restore test is still open — see [`docs/build-sheet.md`](docs/build-sheet.md). **Back up your save yourself:** Settings → Back up save downloads your progress as `final-cast-save.json`. The tutorial warns about this on first launch.

## Tuning

Bite and hookset windows live in [`src/tuning.json`](src/tuning.json) — one table per fish size, plus the first-attempt grace period, the forgiving first-quest window (quests 1–2), per-water legend-fight difficulty, the retrieve-speed trade-off, and the miss penalty. Change the numbers there, not in code. Hookset attempts are logged by fish size in [`src/playtest.js`](src/playtest.js); export a session and use it to retune. Pacing (time to first hand-fought catch, time to first legend), retention (day-1 / day-7 return), and crashes (tagged with device RAM) are logged in the same session. Pacing, economy and difficulty tuning for the 12-quest arc — target minutes and active share per quest, coin rewards, the quest-band window ramp, and the anti-burnout rules — are in the same file (`pacing`, `economy`) and in the quest table in [`docs/quests.md`](docs/quests.md); they are design targets until a real 1–12 playthrough fills the pacing log.

## Endgame and monetization

After quest 12 and legend 3, the game offers collection completion, harder legend variants, and daily/spot rotation — see the Endgame section in [`docs/quests.md`](docs/quests.md). Monetization decision: **free, no ads, no in-app purchases** (recorded in the game settings; change it explicitly if that ever changes). The release path — signed release APK and store listing — is in the release checklist in [`docs/build-sheet.md`](docs/build-sheet.md).

## Build milestones

1. Baseline and audit scaffold — freeze the current build, import the v0.1 bug list as a fixed/verified/open checklist, extract bite/hookset tuning into config, add hookset logging.
2. Recorded real-phone playtest — play all hand-fishing on at least one mid-range Android phone, log hookset success/fail by fish size, tune bite/hookset windows.
3. Fairness aid — clear bite cue, first-attempt grace period, stated miss penalty, retest with new players.
4. Quest rewrite — publish the 12-quest table, cut or rewrite pure catch-X quests.
5. Endgame and monetization — implement the chosen post-quest-12 / post-legend-3 loop and record the explicit monetization decision.
6. Verification and ship — retest all open bugs, regression-test PWA offline, portrait/landscape, and the Capacitor debug APK, then release with playtest and audit notes.

## Open questions

- Which mid-range Android phone (model and OS version) and which first-time players are available for the recorded playtest?
- Which post-quest-12 endgame is chosen: collection completion, harder legend variants, daily/spot rotation, or a clean ending?
- Is monetization confirmed as free with no ads, or is there a paid or optional-purchase model to support?
- Where is the authoritative v0.1 bug list stored, and is there existing evidence for any items already claimed fixed?

## License

All rights reserved — Diddlerrr / workinmanstrokes.
