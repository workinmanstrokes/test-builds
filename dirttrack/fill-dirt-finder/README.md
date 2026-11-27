# Paydirt: Fill-Dirt Finder

**Build spec:** Paydirt: Fill-Dirt Finder is a free 60-second timed digging game on the Web. You dig — tap, click, or drag — across a grid of dirt cells; ordinary dirt clears empty, while hidden pay-dirt cells flash gold flecks and add a nugget to your haul. Reach the site's target gold weight before the timer ends to succeed; run out of time below target and the run fails, with your haul still shown. Three graded sites (Creek Bed, Old Yard, River Claim) get bigger and richer, and your best haul per site is saved in this browser. Free entry, no ads, no subscription, and a sub-2-second load target — one self-contained page with no network requests.

## Play it

Open `index.html` in any modern browser, or visit the deployed copy at
`https://dirttrack-diddlerrr.web.app/fill-dirt-finder/` once the standalone site is next deployed
(the file ships in `public/` with the rest of the site).

## The loop

1. Pick a site: Creek Bed (Easy, 6×6, 8 nuggets, target 6.0 g), Old Yard (Medium, 7×7,
   10 nuggets, target 8.0 g), or River Claim (Hard, 8×8, 14 nuggets, target 12.0 g).
2. Dig for 60 seconds: mouse click / click-drag, or touch tap / drag. Every cell is at
   least 44 px, so it works on a phone without zooming.
3. Haul result: nuggets found, gold weight, haul value (at the in-game assay rate of
   $65/g — not a market price), site target, success or failure, and best haul.

## Why it will not stall

- The timer is driven by the clock (`Date.now()`), not by animation frames, so a
  throttled tab or a stalled frame can neither freeze nor extend a run; the run always
  ends on time, with a visibility-change safety net.
- Best-haul saving is wrapped in try/catch: if the browser blocks localStorage, the
  result screen says so instead of failing silently.
- No dependencies, no network requests, no build step — one HTML file plus a logo.

## Branding

Distinct from the other games called Pay Dirt: subtitle **Fill-Dirt Finder**, its own
gold-nugget logo, and landing copy that says plainly it is a timed digging game — not a
tycoon, not an idle game, not a slot.

## Test it

- Desktop Chrome: click and drag across the grid; confirm gold flashes and the haul
  counter rises, and the run ends at 0 seconds.
- Mobile Safari: tap and drag with a finger; confirm cells dig without zooming or
  scrolling the page, and the best haul shows on the site-select screen after a run.
- Save failure: with localStorage blocked, the result screen must show the
  "could not be saved" note.
