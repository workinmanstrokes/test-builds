# Slab House Tycoon — Milestone 1–5 Vertical Slice

A single-player trading-card-shop tycoon. Buy parody packs, inspect
pulled cards with a loupe at the Inspection Desk, grade and slab them,
then sell raw, sell slabbed, or run a Whatnot-style live auction.

All sets, players, and creatures are **original parody content** — no
real athletes, teams, or copyrighted characters.

## Game Test Lab re-review

The Lab's first review scored the build 2.7/10 (F): "a title and a
genre, not a testable game — define the slab loop before building
anything else." The response is the one-page
[build sheet](docs/build-sheet.md): what "slab" means (a graded card
sealed in a plastic case — this is a card-shop tycoon, not a
house-building game), the 60-second loop in three verbs
(**BUY → INSPECT → FLIP**), how money is made and spent, and the
first three unlocks. The one-loop phone prototype and the 30-second
capture script are in [docs/mobile-loop-test.md](docs/mobile-loop-test.md)
— the two-minute run (buy a pack → inspect → grade → sell/auction)
has not been run on a real phone yet; that doc is the checklist, not
a claim it passed. The locked economy is tested in
[docs/economy.csv](docs/economy.csv): expected pack value, grade
break-evens, and a 10-day simulation, all computed from the game's own
numbers.

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
- **Four grading companies** (all fictional) — pick one in the grading
  sheet:
  - **Slab House (SHG)**: house prices, four subgrades, Black Label for
    quad 10s.
  - **Titan Card Authority (TCA)**: 1.6× fees, slabs resell highest
    (+20% sports), huge pop reports, and a 10 needs 55/45 centering or
    better.
  - **Tuxedo Grading Co. (TGC)**: black slabs, 0.8× fees, a day faster,
    has a 9.5, and a borderline 10 lands at 9.5.
  - **Vault Card Guaranty (VCG)**: 0.6× fees, monster, hero and comic
    specialists (+15% there, −20% on sports), and a Pristine 10.
  Every company keeps its own pop report and cert prefix. The sheet shows
  the **money diff** for one card: raw value now, what it's worth as a
  10, 9 and 8 at that company, the fee, the grade where grading starts to
  pay, and (once you've inspected it) what your own estimate nets.
- **Parallels, rookies and autos** — packs roll numbered parallels:
  Refractor (1.5×), Green /99 (2×), Gold /50 (3×), Orange /25 (4.5×),
  Black /10 (6×), Red /5 (8×), with the 1/1 on top. A serial that matches
  the player's jersey number adds 25%. RC rookies are 1.6×, on-card
  autographs 3×, and they stack. Rarer parallels and autos have much
  smaller pop reports.
- **Hobby News** — most days bring a headline that moves prices for a
  few days: a player's breakout (up to 2.5×), an injury (down to 0.55×),
  a hype bubble (+50%) that crashes two days later (−30%), a surprise
  reprint (−25%), a cartoon premiere for monster sets (+40%), or an
  anniversary (+25%). The Collection marks moved cards ▲ or ▼.
- **Card Show** — four tables of singles a day, raw and slabbed, from
  sellers rated 2 to 5 stars. Lower stars mean more fakes (none at 5,
  35% at 2), and fakes are priced 25–45% under book to tempt you. Three
  kinds of fake slab: a **bogus** cert (the lookup finds no record), an
  **altered** label (the lookup shows the real, lower grade) and a
  **cloned** cert copied from a real slab (passes the lookup). The UV
  Blacklight upgrade ($200) catches all of them, and raw counterfeits
  show a dot-screen print and plastic gloss under the desk light.
  Graders reject counterfeits and keep the fee. A buyer who catches a
  fake cancels the sale; a known fake is worth $0 and goes in the trash.
  An altered slab is corrected to its real grade instead.
- **Slab reveal** — tap the sealed sleeve to crack it open. Label colors:
  Pristine Black Label for quad 10s, gold for 10s, silver for 9s, red for
  8s. Each slab gets a cert number and subgrades on the label.
- **Pop report** — every grade has a population (market copies that grow
  over time, plus your own). A Pop 1 Gem Mint 10 is worth 2.5× a normal
  10; a flooded grade sinks toward 0.6×. Slabs value off the live pop.
- **Upgrades** — High-Lumen Lamp (every surface flaw, micro-scratches
  included, at any angle), Digital Calipers (centering locks the moment a
  side faces up), Prep Station (+0.5 surface by wiping fingerprints),
  Bulk Submitter Account (10+ cards at $15/card Regular, $7 Economy),
  VIP Auction Slots (house fee 10% → 3%, bigger bidders) and the UV
  Blacklight (catches fake cards and fake slabs).
- **Live Stream Auction** — 15-second countdown, Hype Chat button that
  boosts bidder momentum, AI bidders Whale (rare huge jumps), SnipeBot
  (strikes in the last 4 seconds), BargainHunter (early small bids,
  walks away above 1.2× value), and a manual Gavel Slam. A bid in the
  final 3 seconds adds 2 seconds (max 2 extensions).
- **Collection** — everything you own, with Sell and Send-to-Auction.
  Slabs show their label color and pop; cards at the grader show when
  they're due back. **Bulk submit** selects several raw cards at once.
- Progress (cash, inventory, day, upgrades, pop, news, Card Show) saves to browser
  localStorage. Older saves load as before: their cards get a clean back
  and their slabs keep the value they were graded at.

Self-test: open `index.html?autotest=1` — it runs the full flow
(pack → inspect → grade → sell → auction) and prints PASS/FAIL.

## Economy at a glance

The loop, in order: buy a lot → inspect the pull → grade it or sell it
raw → bank the cash. No number in the loop is hidden.

| Step | Numbers |
|---|---|
| Start cash | $500 |
| Packs | $25–$35 by set; 5 cards, last card Rare or better |
| Raw sale (fixed offer) | Card base value ($2–$800 by rarity); always available, no auction needed |
| Grading (Godot) | $25 flat; preview shows fee, grade range, and slab-value range before paying |
| Grading (web) | Economy $10 / Regular $25 / Express $75 (see above) |
| Slab value | Base value × grade multiplier (10 = 5×, 9 = 3×, 8 = 2×, 7 = 1.5×, 5 = 1×, 1 = 0.3×) |
| Live auction | Graded slabs only; bids scale with slab value and rarity demand (Secret draws 2× the bidder caps of Common); no bids means the card comes back |
| Daily rent | $15/day, paid on End day (Godot) |
| Shop upgrade (Godot) | Neon Sign $150 — +15% buyer demand on raw sales, slab sales, and fixed offers |
| Save | Automatic after every money move (Godot `user://slab-house-save.json`; web localStorage) |

## Controls

PC controls are locked first; the mobile touch pass follows on one real
device. See [docs/controls.md](docs/controls.md) for the full key map
and the touch-pass checklist. The touch pass has **not** been run on a
real phone yet — mobile is not claimed as tested until it has.

## Release plan

- **Single-player only, against AI bidders.** The live auction is the
  payoff for graded slabs, not a multiplayer mode; no real-money
  multiplayer is planned.
- **Paid one-time, no ads, no in-app purchases.** Decided for this
  update because the game has no IAP or ad hooks anywhere in the code;
  the maker can change this, but the economy is balanced as a
  buy-once game.
- **Original parody IP only** — no real athletes, teams, or licensed
  characters (see the open question in the plan; the answer in the
  build is parody sets).
- **Discoverability:** the name collides with unrelated Roblox "House
  Tycoon" games in web search, so store copy and the tagline lead with
  "trading card shop tycoon" and the card-shop hook, never with
  "house tycoon" alone.

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
| `scripts/grading.gd` | Grade 1–10 from sub-grades + value multipliers (Gem Mint 10 = 5×); `preview_grading()` shows fee, grade range, and slab-value range before paying |
| `scripts/economy.gd` | Cash, inventory, pack buying, raw/slab selling at a fixed offer, grading ($25); buyer-demand multiplier from upgrades |
| `scripts/inspection_desk.gd` | Draggable loupe, zone detection, 4-metric reveal, tiltable light |
| `scripts/auction.gd` | Graded slabs only; 15s countdown, Hype Chat, Whale/SnipeBot/BargainHunter AI whose caps scale with slab value and rarity demand, Gavel Slam |
| `scripts/tycoon.gd` | Day progression, $15/day rent, Neon Sign upgrade (+15% demand), save/load to `user://slab-house-save.json` |
| `scripts/main.gd` | Screen glue: wires Economy + Desk + Auction + Tycoon; enforces inspect-then-grade and slabs-only auction; PC keyboard controls; auto-save |

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
  docs/controls.md      PC controls + mobile touch-pass checklist
  docs/build-sheet.md   one-page build sheet for Lab re-review
  docs/mobile-loop-test.md  two-minute phone loop + 30s capture script
  docs/economy.csv        locked economy model: pack EV, grade break-evens, 10-day simulation
  README.md             this file
```
