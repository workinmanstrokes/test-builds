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
