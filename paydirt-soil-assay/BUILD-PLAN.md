# Paydirt: Soil & Gold Assay — Build Plan

- **Name:** Paydirt: Soil & Gold Assay
- **Tagline:** Find the hidden pay streak and hit the gold quota in 60 seconds — or the run is over.
- **Kind:** Game — prospecting puzzle game, Web platform, free-to-play, single-screen.
- **Summary:** A playable single-screen browser prospecting game on a 6x6 dirt claim: 60 seconds per ante, 5 Soil Probes and 3 Shovel digs per ante, a hidden connected pay streak of 3-5 cells, and a Balatro-style escalating gold quota — hit it and advance, miss it and the run ends.

## Ante loop (maker's direction, 2026-11-19)

- The open decision from the earlier run is settled: the game uses the tester's loop (5 Probes, 3 Shovel digs, one 3-5-cell connected pay streak, grams) with Balatro's escalating ante quota bolted on. The shipped 18-energy / 8-scattered-tiles loop is replaced.
- Each round is "Ante N": a fresh 60-second dig on a new 6x6 grid with a hidden pay streak. The timer AND the dig budget are the constraints.
- Weigh-in at the end of each dig: gold found vs the quota. Hit the quota → advance screen ("Ante N cleared", run total, next quota) with a fresh grid and a bigger quota. Miss the quota (or time runs out short) → run-over screen: gold found, quota missed by, best ante reached, best run total, Restart button.
- Best ante reached and best run total gold are saved on this device (localStorage).

## Quotas and yields (exact numbers)

- Quota per ante: `quota(ante) = round(12 * 1.4^(ante-1), 1)`. Ante 1: 12.0 g, Ante 2: 16.8 g, Ante 3: 23.5 g, Ante 4: 32.9 g, Ante 5: 46.1 g, Ante 6: 64.5 g, Ante 7: 90.4 g, Ante 8: 126.5 g.
- Per-cell yield scales x1.35 per ante: mother lode `(6 + rand*2) * 1.35^(ante-1)` g; ordinary cells `(3.5 + rand*2.5) * 1.35^(ante-1)` g. At Ante 1 that is a 6-8 g mother lode and 3.5-6 g nuggets.
- Streak length: 5 cells at Antes 1-2, 4 cells at Antes 3-4, 3 cells at Ante 5 and up (`max(3, 5 - floor((ante-1)/2))`). The streak is easiest to find at Ante 1 and gets smaller as the quota grows.
- The gold is always there if you find it: the best 3 streak cells sum to at least the quota in 100% of simulated Ante 1-4 claims (oracle check).

## Balance — simulation, not guesswork

Two node simulations were run against the real `game.js` rules (probe/dig budgets, streak generation, quotas). The timer is not modelled — the budgets bind, not the clock.
- **Near-optimal solver play** (enumerates every connected streak placement consistent with the probe counts, digs the highest-probability cells; N=400 per ante): Ante 1 win 68.5%, Ante 2 65.0%, Ante 3 61.5%, Ante 4 59.0%, Ante 5 52.5%, Ante 6 50.5%; mean 2.6 pay cells dug per ante. Full runs: 28.5% end at Ante 1, 24.0% at Ante 2, 17.5% at Ante 3, 10.5% at Ante 4 — mean 2.9 antes reached, median Ante 2. Ante 1 is winnable most of the time with good play, and the run usually ends within a few antes.
- **Simple spread-and-chase play** (probe a spread, chase high counts, dig the likeliest cells; N=2000 per ante): Ante 1 win 16.3%, mean 1.53 pay cells dug. The gap is the skill: the game rewards reading the probe numbers properly (a probe that reads 2 with only 2 untouched neighbours means both hold gold). The intro sheet teaches that deduction.
- Tuning history: the first numbers (random 3-5 streak, 5-7 g lode, 2.5-5 g nuggets) gave the solver only 4.7% at Ante 1 — the streak was too hard to find. Lengthening the early streak and enriching the cells moved the solver to 68.5% at Ante 1.

## Correction — read this first

- The ship snapshot for this run said the repo held only a LICENSE file. That was stale: PR #1 ("Build the Paydirt: Soil & Gold Assay game", merged 2026-11-18) had already landed a complete playable build — `index.html`, `style.css`, and `game.js`.
- This run's first push overwrote the real `index.html` with a simpler starter. That was a mistake: the starter was never read against the existing file. The follow-up commit restores `index.html` byte-for-byte to the PR #1 version and keeps only the new files from this run (`README.md`, this plan).
- The game tester's ordered loop (5 Probes, 3 Shovel digs, one 3–5-cell connected pay streak, grams/troy ounces) differs from the shipped loop (18 shared energy, probe reads a neighbour count, 8 pay-dirt tiles, grams only). That is an open decision for the maker — do not silently swap one loop for the other. (Settled 2026-11-19: the tester loop wins, with the ante quota added — see "Ante loop" above.)

## Features (as shipped)

- Clickable 6x6 dirt-claim grid that works with mouse and touch
- 60-second countdown per ante that starts on the player's first move and stops play at 0:00
- Hidden connected pay streak (3-5 cells) per ante, one mother lode per streak
- Soil Probe (5 per ante): reads how many neighbouring tiles hold gold, breaks no ground
- Assay Shovel (3 per ante): digs the tile and banks its gold in grams
- Live quota meter (gold found vs quota), current Ante, time remaining, probes and digs left
- Weigh-in after each dig: quota-hit advance screen or run-over screen with gold found, quota missed by, best ante, best run total, and Restart
- Best ante and best run total saved on the device; mute control for sound
- Intro sheet explaining the ante rules and the key deduction (a 2 with 2 untouched neighbours means both hold gold)

## Stack

`index.html` + `style.css` + `game.js` — vanilla HTML, CSS, and JavaScript, no framework, build step, backend, or art assets. The game rules in `game.js` are written pure so they can also be loaded by a node test. It opens and runs in any desktop or mobile browser.

## Screens

- Main game screen — 6x6 grid, 60-second timer, quota meter, Ante number, probes and digs left, tool picker
- Intro sheet — ante rules and Stake the claim
- Advance sheet — quota hit: gold this ante, quota, run total, next quota, Dig Ante N+1
- Run-over sheet — gold this ante, quota, missed by, best ante, Restart the run

## Entities

- Cell — grid position, probed/dug state, neighbour pay-streak count, and gold grams
- Pay streak — 3-5 connected cells, one mother lode, hidden until probed or dug
- Ante — quota, 60-second timer, 5 probes, 3 digs, gold found
- GameRun — current ante, run total gold, best ante, best run total

## Milestones

1. Playable build landed via PR #1 (2026-11-18): grid, timer, probe/dig loop, end report
2. README.md added with the real rules (this run)
3. Restore `index.html` to the PR #1 version after the accidental overwrite (this run)
4. Ante loop bolted on (2026-11-19): 5 probes / 3 digs per ante, connected pay streak, escalating quota (12.0 g at Ante 1, x1.4 per ante), advance and run-over screens, best ante + best run total, simulation-balanced
5. Playtest with 5 people on desktop and mobile browsers, 10 timed attempts each, record whether they voluntarily replay, and keep or rework the loop before adding any shop, upgrades, or meta

## Tester context

- Previous tester score: 0.5/10, grade F — that review was written against the stale snapshot (LICENSE only) and does not describe the shipped build. Re-test against the live game before acting on its fixes.
