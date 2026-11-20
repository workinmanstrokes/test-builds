# Final Cast v0.2

**Tune the bite, prove the fixes, and finish the cast.**

Final Cast v0.2 is the next update to the existing pixel-art idle fishing game by Diddlerrr. Your line fishes for you; when something big bites you take the rod and fight it by hand. This update applies the game tester's fixes in priority order after a 5.0/10 (grade C) review.

## What it is

- **Idle fishing line** that catches common fish automatically, with hand-fishing when something big bites.
- **Hand-fishing loop**: bite window, hookset timing, lure retrieves at three speeds, worm depth, and fishing-spot choice.
- **Three waters** — Millpond, Cedar Creek, Ember Lake — each with a legend fish tied to one spot and time of day.
- **12 quests** across the three waters, each unlocking tackle, lures, waters, or a new mechanic. No pure catch-X grind quests.
- **Upgrades**: rod, line, reel, and tackle, plus lure unlocks.
- **Fairness aid**: an unmistakable bite cue, a short grace period on the first hookset attempt, and a small, stated penalty for missing.
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

The debug APK is also built by CI. Install it on a phone and run the recorded playtest (see `src/playtest.js`).

## Tuning

Bite and hookset windows live in [`src/tuning.json`](src/tuning.json) — one table per fish size, plus the first-attempt grace period and the miss penalty. Change the numbers there, not in code. Hookset attempts are logged by fish size in [`src/playtest.js`](src/playtest.js); export a session and use it to retune.

## Endgame and monetization

After quest 12 and legend 3, the game offers collection completion, harder legend variants, and daily/spot rotation — see the Endgame section in [`docs/quests.md`](docs/quests.md). Monetization decision: **free, no ads** (recorded in the game settings; change it explicitly if that ever changes).

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
