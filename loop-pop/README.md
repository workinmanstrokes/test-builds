# Loop Pop

A conveyor pixel puzzle. Tap a blaster to send it round the loop; it pops every pixel of its colour it can see. Clear the picture before the holding bay fills up.

- 24 hand-made pixel pictures (heart, mushroom, cat, burger, rainbow, penguin and more), then endless generated patterns up to 18x18
- Hard levels every fifth level from level 8 (8, 13, 18...): shuffled queue, four bay slots, 1.5x coins
- Three-star ratings, a win streak that multiplies coins up to x2, a chest every 5 levels
- Daily puzzle, gallery of cleared pictures with replay, double-speed toggle
- Coins, daily login bonus, two boosters (Sort queue, Add a slot)
- Glowing hint on the first levels and whenever you stall, a warning when the bay is one slot from full, and a progress bar
- Pauses behind the menu and when you leave the app
- Installable PWA: works offline and fullscreen from the Android home screen, and picks up new versions on the next launch

## Put it on your phone

1. In this repo on GitHub: Settings > Pages > Deploy from branch > `main` / root.
2. Open `https://workinmanstrokes.github.io/test-builds/loop-pop/` in Chrome on Android and choose "Install app".

Single file game: everything is in `index.html`. No build step.

## Testing

`window.__lp` exposes the game state and a few functions (`start`, `tap`, `update`, `bestMove`) so a script can play levels headlessly.
