# Playtest plan — Paydirt: Soil & Gold Assay

Milestone 5 of the build plan: playtest with 5 people before any shop,
upgrades, or meta is added. The loop under test is the 60-second ante
loop: 5 Soil Probes, 3 Assay Shovel digs, one hidden 3–5-cell pay streak,
gold quota in grams (Ante 1: 12.0 g, ×1.4 per ante).

## How to run it

- Open `index.html` in any desktop or mobile browser, or host the files
  on any static host — no server or build step.
- Rules are covered by `node test.js` (run it before a playtest round).
- For a reproducible run, open `index.html?seed=42` — the same seed
  deals the same claim every time.

## The 5 players

- 5 people, a mix of desktop and mobile browsers (at least 2 on phones).
- 10 timed attempts each (each attempt is one ante run, win or lose).

## Record per player

- Attempts played, best ante reached, best run total (grams).
- Did they voluntarily replay after the 10 attempts? (yes/no — this is
  the keep-or-rework signal.)
- Where they got stuck: did they understand probe numbers (0 cold,
  1–2 warm, 3–4 hot), the 5-probe / 3-dig budgets, and the weigh-in?
- Any input trouble: tap vs click, keyboard (P probe, S dig,
  right-click to dig), sound mute.

## Keep or rework

- Keep the loop if at least 3 of 5 players voluntarily replay and at
  least 3 of 5 clear Ante 1 within their 10 attempts.
- Rework if players stall on the probe numbers or never clear Ante 1 —
  first suspects are the probe budget and the Ante 1 quota (12.0 g),
  not new features. No crews, districts, excavators, or collections:
  scope stays on the 60-second loop until the playtest says keep.
