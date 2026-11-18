# Hydraulic Press & Foundry — project guide for AI helpers

A browser game (installable PWA). No build step: plain HTML/CSS/JS modules.

## Files
- `index.html` — page layout
- `style.css` — all styling
- `game.js` — the whole game (~950 lines). Sections are marked `// N. NAME`:
  1 CONFIG (balance numbers) · 2 STATE · 3 HELPERS · 4 AUDIO · 5 ORDERS · 6 JOB SIMULATION ·
  7 FURNACE + SHOP · 8 THREE.JS SCENE · 9 UI · 10 INPUT · 11 LOOP · 12 PLAYTEST HOOK
- `data.js` — items, customers, customer lines. Safe to extend.
- `tools/playtest.mjs` — bots play the real game and write `playtest/report.md`
- `tools/check-data.mjs` — validates data.js
- `sw.js` — offline cache. Bump `VERSION` when shipping changes.

## Commands
- `npm run check` — validate data.js (run after ANY data.js edit)
- `npm run playtest` — 3 bots x 5 game-minutes (~3 min real). Add `-- --minutes 3` for faster.
- `npm start` — play at http://localhost:8080

## Rules for every helper
1. Never rewrite a whole file. Use small Edit changes.
2. game.js is big: use Grep to find the line, then Read with offset/limit around it. Don't read the whole file.
3. After editing data.js run `npm run check`. After editing game.js run `npm run playtest -- --minutes 2` and make sure Errors says none.
4. Don't touch `vendor/`, `node_modules/`, or `icons/`.
5. Don't remove or rename anything in section 12 (PLAYTEST HOOK) — the bots depend on it.
6. Write what you did in the playtest/ notes file your bot role names.
