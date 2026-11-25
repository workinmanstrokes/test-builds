# Slab House Tycoon — Milestone 1–5 Vertical Slice

A single-player trading-card-shop tycoon. Buy parody packs, inspect
pulled cards with a loupe at the Inspection Desk, grade and slab them,
then sell raw, sell slabbed, or run a Whatnot-style live auction.

All sets, players, and creatures are **original parody content** — no
real athletes, teams, or copyrighted characters.

## Play the web version (instant, no install)

Open `index.html` in any browser (double-click it, or serve the folder).
It is a complete, self-contained HTML5 canvas game:

- **Pack Shop** — 9 parody sets (Gridiron Legends $30, Hardwood Heroes $30,
  Diamond Kings $30, Frozen Fury $30, Pitch Legends $25, Pocket Kaiju $25,
  Critter Clash $25, Mythic Marvels $35, Panel Punchers $35). Each pack pulls
  5 cards, last card guaranteed
  Rare or better. No F2P wait timers.
  **1/1 chase:** 1% of packs — the guaranteed card is a black-and-gold
  1/1 instead, stamped 1/1 and worth 10×. Same player, one of one.
  Old saves migrate automatically on load: cards pulled before the
  trading-card redesign get their jersey number, team, position, and
  collector number backfilled from their set.
- **Inspection Desk** — touch the card and read the **jeweler's screen**:
  a fixed magnified window (top of the desk on phones, beside the card on
  desktop) that shows the spot under your finger, so your hand never
  covers what you're inspecting. Pinch or scroll to zoom the card,
  double-tap to reset. Light presets (−30° / 0° / +30°) or **Tilt phone**
  to rake the light with the gyroscope. Checked corners and edges glow
  **green** when clean and **amber** when flawed; the measured centering
  frame and split ratios show on the card. **Flip the card** to check the
  back corners and back centering: grading stays locked until both sides
  are done. The old floating loupe is still there as an option.
- **True subgrades** — BGS-style half-point subgrades. Centering uses
  split ratios (fronts: 55/45 = 9.5, 60/40 = 9; backs allow 60/40 for a
  10). Corners count front whitening at 2.5 and back at 1. Edges score
  chipping. Surface tells print lines, roller marks, scratches,
  micro-scratches, dimples and fingerprints apart, each with its own
  penalty. One weak subgrade caps the slab; a 10 needs every sub at 9+.
- **Grading services** — Economy $10 (3–5 days, strict graders with
  pop-control risk), Regular $25 (back the next day), Walk-Through
  Express $75 (instant). A day passes when an auction ends or you press
  **End day** in the header.
- **Slab reveal** — tap the sealed sleeve to crack it open. Label colors:
  Pristine Black Label for quad 10s, gold for 10s, silver for 9s, red for
  8s. Each slab gets a cert number and subgrades on the label.
- **Pop report** — every grade has a population (market copies that grow
  over time, plus your own). A Pop 1 Gem Mint 10 is worth 2.5× a normal
  10; a flooded grade sinks toward 0.6×. Slabs value off the live pop.
- **Upgrades** — High-Lumen Lamp (every surface flaw, micro-scratches
  included, at any angle), Digital Calipers (centering locks the moment a
  side faces up), Prep Station (+0.5 surface by wiping fingerprints),
  Bulk Submitter Account (10+ cards at $15/card Regular, $7 Economy) and
  VIP Auction Slots (house fee 10% → 3%, bigger bidders).
- **Live Stream Auction** — 15-second countdown, Hype Chat button that
  boosts bidder momentum, AI bidders Whale (rare huge jumps), SnipeBot
  (strikes in the last 4 seconds), BargainHunter (early small bids,
  walks away above 1.2× value), and a manual Gavel Slam. A bid in the
  final 3 seconds adds 2 seconds (max 2 extensions).
- **Collection** — everything you own, with Sell and Send-to-Auction.
  Slabs show their label color and pop; cards at the grader show when
  they're due back. **Bulk submit** selects several raw cards at once.
- Progress (cash, inventory, day, upgrades, pop) saves to browser
  localStorage. Older saves load as before: their cards get a clean back
  and their slabs keep the value they were graded at.

Self-test: open `index.html?autotest=1` — it runs the full flow
(pack → inspect → grade → sell → auction) and prints PASS/FAIL.

## Look & feel

Warm card-shop theme throughout: deep brown panels with gold
gradient buttons, stat chips, and headings. Every pack shows its own
**card back** (gold-bordered, set-colored, SLAB HOUSE monogram).
Opening a pack reveals the five pulls in a staggered flip-in, and the
best pull gets a pulsing gold glow. Tiles lift on hover; slabbed
cards glow gold. The Inspection Desk is a wood-framed felt table
(light pool, speckle, stitched border, vignette) with a brass-ringed
loupe and a face-down card back when the desk is empty.

## Card art direction

Every card is a composition, not a pose: each position/sport has a
distinct silhouette (three-point stance, diving receiver, flying comic
hero, low goalie crouch), and each card rolls a deterministic figure
scale, horizontal anchor, hair style/color, skin tone, and day/dusk/
night scene from its set + name — no two cards in a set share the same
pose + scale + anchor + hair + scene combination (asserted by the
self-test and the headless harness). The art window is a drawn scene,
not a flat gradient: stadiums with crowd dots and floodlights, a
hardwood court with a hoop, a baseball diamond, hockey boards and ice,
a soccer pitch, comic halftone dots with a skyline, and creature
habitats (forest, volcano, ocean, storm sky). The card frame and name
bar carry the team color, and each set has its own frame treatment
(Gridiron double border, Hardwood rounded corners, Panel comic drop
shadow). Rarity is a real parallel: Common plain, Uncommon silver
shimmer, Rare refractor grid, Ultra rainbow holo sweep, Secret
black-gold, and the 1/1 chase stays a black Prizm with a gold stamp.
The same figure spec drives both the HTML tile renderer and the
canvas Inspection Desk renderer, so the two can never drift apart.

## Godot 4 version

Godot 4.3 project, portrait 720×1280 (`project.godot`, main scene
`main.tscn`). Open the folder in Godot 4.3+ and press Play.

| File | What it does |
|---|---|
| `scripts/card_data.gd` | Card resource: the 3 parody sets, pack pulls, hidden sub-grade rolls |
| `scripts/grading.gd` | Grade 1–10 from sub-grades + value multipliers (Gem Mint 10 = 5×) |
| `scripts/economy.gd` | Cash, inventory, pack buying, raw/slab selling, grading ($25) |
| `scripts/inspection_desk.gd` | Draggable loupe, zone detection, 4-metric reveal, tiltable light |
| `scripts/auction.gd` | 15s countdown, Hype Chat, Whale/SnipeBot/BargainHunter AI, Gavel Slam |
| `scripts/main.gd` | Screen glue: wires Economy + Desk + Auction together |

The Godot scripts mirror the web game's original systems (the newer
card backs, subgrades, service tiers, pop report and upgrades are
web-only for now), so the Godot version is a
real starting point for the full game, not an empty shell. The web
build is the fully playable vertical slice; the Godot scene is the
same systems wired into a runnable project shell (UI layout is
minimal — the desk, economy, and auction logic are complete).

## Layout

```
slab-house-tycoon/
  index.html            playable HTML5 canvas game (self-contained)
  project.godot         Godot 4.3 project
  main.tscn             Godot main scene
  scripts/              Godot GDScript systems (see table above)
  README.md             this file
```
