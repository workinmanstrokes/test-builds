# Final Cast v0.1 bug list — audit against the v0.2 build

**Status: audit scaffold only.** The design review was written against the earlier v0.1 prototype and some listed bugs were already fixed — but what remains unfixed is **unverified**, and no real-phone playtest is recorded. Do not ship on the claim that "some were already fixed."

## How to use this file

1. Paste the authoritative v0.1 bug list below, one row per bug.
2. For each row, retest against the current build and set Status to `fixed/verified`, `still open`, or `cannot reproduce`.
3. Evidence must name the build, device, and date — "claimed fixed" without a retest is not evidence.
4. Retest every `still open` item before release; the release notes list the open items that remain.

| # | Bug (v0.1 wording) | Status | Evidence (build / device / date) | Retest notes |
|---|---|---|---|---|
| — | _No authoritative v0.1 bug list has been located yet — see open question below._ | _pending import_ | — | Import the list before any tuning changes. |

## VEX review — 5.0/10 (grade C) — audit against build 0.2.5

This is the review the v0.2 plan was built from ("a promising idle-to-fight
fishing core … a solid prototype rather than a releasable game yet"). Each
of its 15 items is answered below against the build as shipped, with a
build number — this section replaces carrying the stale v0.1 review
forward. "Fixed in code" means the change is in the build; "still open"
means a real phone, a real playthrough, or a maker step is still needed
before the item can be called verified.

| # | VEX 5.0 item (fishing-game reading) | Status | Evidence (build 0.2.5 unless noted) |
|---|---|---|---|
| 1 | Put the CI debug APK on 3–5 real Android phones of different sizes and ages; record a full session per phone: bite hits/misses, haptic feel, portrait/landscape touch targets, frame drops, offline PWA | protocol + logging in 0.2.5; test still open | `docs/playtest-protocol.md` (3–5 phone matrix, per-phone record); `src/playtest.js` logs bites, phone details, frame drops; Settings records the test phone. No phone tested yet. |
| 2 | Write down and tune the actual timing numbers — bite-window length, hookset grace period, legend-fight difficulty by water and quest — then add a forgiving first-quest window and a clear visual/audio bite cue | fixed in 0.2.5; retune still open | `src/tuning.json`: per-size windows, 250 ms grace, `firstQuestWindowMs` (1800/1200 ms, quests 1–2), `legendFight` difficulty 3/4/5 by water; `src/main.js` applies the first-quest window and plays a two-tone audio cue with the visual banner + haptics. Retuning needs real-phone logs. |
| 3 | Re-test the old v0.1 bug list against the current build, mark each item fixed or unfixed with the build number, and stop carrying the stale review forward | this audit in 0.2.5; v0.1 list itself still open | This section is the build-numbered audit of the 5.0 review. The authoritative v0.1 bug list still has no source (see open question) — nothing from it can be marked fixed until it is imported. |
| 4 | Play quests 1–12 in sequence and log minutes idle versus active, time per quest and where the loop repeats; vary, shorten or add a new mechanic to any quest that is just wait, fight, repeat | logging + variety in 0.2.5; playthrough still open | `src/playtest.js` `noteQuestClock` / `logQuestComplete` / `questSummary()`; `docs/quests.md` quest-type column + pacing-log section. No 1–12 playthrough recorded yet. |
| 5 | Decide the release and monetisation model — free web/PWA, paid, ads or IAP — and produce a release APK and PWA/store listing instead of stopping at a CI debug APK | decision fixed (free, no ads); release still open | Monetization recorded in Settings, `docs/quests.md`, `docs/build-sheet.md`. Release checklist in `docs/build-sheet.md`: release APK needs a signing keystore and a store listing — maker steps, not done. |
| 6 | Across 12 quests the loop is the same idle wait, big bite, hand fight; no quest-type variety, new mechanic per water, or story beat is described | described in 0.2.5 | `docs/quests.md`: every quest now carries a type (tutorial / timing / experiment / exploration / upgrade / legend / collection) and a story beat per water; each quest still unlocks a mechanic, lure, water, or tackle. |
| 7 | Hand-fishing fairness cannot be judged: no bite-window duration, hookset forgiveness, retrieve-speed trade-off, failure penalty or assist option is stated | stated in 0.2.5 | `src/tuning.json`: windows by size, 250 ms first-attempt grace, 1800/1200 ms first-quest window, `retrieveSpeedTradeoff` (slow x1.25 / medium x1.0 / fast x0.8), miss penalty (8 s slack, 30 s spot rest, nothing lost). |
| 8 | No real-phone playtest is recorded, so portrait/landscape layouts, touch targets, haptics and bite readability are claimed but unproven on device | still open | Protocol + logging in 0.2.5 (`docs/playtest-protocol.md`); no session recorded yet. Layouts, targets, haptics and bite readability stay unproven until a phone run produces them. |
| 9 | Bug status is stale: the review was against the v0.1 prototype, some bugs are said to be fixed, and what remains unfixed is unverified | answered in 0.2.5 | This section marks each item with the build it was fixed in or the test still owed. Anything marked "still open" here is unverified, not fixed. |
| 10 | Visual and feedback detail is thin: no fish animation, bite cue, UI clarity or visual distinction between waters is described | fixed in 0.2.5 | `src/main.js` draws a per-water pond (Millpond dawn, Cedar Creek dusk, Ember Lake night) with a swimming pixel fish on the canvas; bite cue is visual (amber pulsing BITE! banner) + audio (two-tone beep) + haptic (buzz pattern). See `docs/build-sheet.md` visual section. |
| 11 | No monetisation, pricing or store presence is described, so the path from a CI debug APK to a player finding and sustaining the game is missing | decision + path in 0.2.5; listing still open | Free, no ads, no IAP — stated in the game and the docs. Release checklist (`docs/build-sheet.md`) lays out the release APK and store-listing steps; no listing exists yet. |
| 12 | Red flag: no real-phone playtest recorded despite haptics and precise timing being core to the hand-fishing loop | still open | Same as item 8 — protocol and logging in 0.2.5, no recorded session yet. |
| 13 | Red flag: remaining bugs are unverified because the design review was written against the v0.1 prototype | answered in 0.2.5 | Same as item 9 — this build-numbered audit; open items stay open until retested. |
| 14 | Red flag: only a debug APK from CI is described — no release build, store listing or launch path | still open | Same as item 5 — release checklist in 0.2.5; release APK and listing need maker steps. |
| 15 | Red flag: no monetisation model is described, leaving the release with no sustainability plan | decision fixed in 0.2.5 | Free, no ads, no IAP — the decision is recorded in Settings, `docs/quests.md`, and `docs/build-sheet.md`. If it ever changes it is re-recorded, never changed silently. |

## Game Test Lab review — 2026-11-25 (4.8/10, grade D)

The Lab review text describes a "castle-defense" game; Final Cast is an idle fishing game, so each item below is applied to the fishing game as shipped. Status after build 0.2.1:

| # | Lab item (fishing-game reading) | Status | Evidence |
|---|---|---|---|
| 1 | One-page build sheet: build number, what changed, finished vs placeholder, target devices, known issues | fixed in 0.2.1 | `docs/build-sheet.md` |
| 2 | Save trap: autosave unmissable at first launch; test delete-and-reinstall restore on a real device | fix in code in 0.2.1; restore test still open | Autosave + HUD "Saved ✓" + first-launch tutorial in `src/main.js`; restore test not yet run on a real device |
| 3 | Low-memory shutdowns: test on lowest-spec Android 6.0 device, cap effects, log crashes by device RAM | guard + logging in 0.2.1; device test still open | Low-memory mode + `logCrash` in `src/main.js` / `src/playtest.js`; no shutdown reproduced yet |
| 4 | First 10 minutes: tight tutorial into first hand-fight and first legend, one thing players can name | in 0.2.1; new-player retest still open | First-launch tutorial in `index.html` / `src/main.js` names the Silver King |
| 5 | Ads & pacing: time to first legend, ad frequency, grind to next upgrade | logging in 0.2.1; measurement still open | Pacing events in `src/playtest.js`; ads: none (free, no ads); upgrade grind unmeasurable until the shop ships |

## Audit rules

- A bug is `fixed/verified` only after a retest on the current build passes.
- A bug is `still open` until a fix lands **and** a retest passes.
- `cannot reproduce` needs the exact steps tried and the build they were tried on.

## Open question

Where is the authoritative v0.1 bug list stored, and is there existing evidence for any items already claimed fixed? Until that is answered, this audit is a scaffold, not a verdict.
