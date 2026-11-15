# Slab House Tycoon — Milestone 1–5 Vertical Slice

A single-player trading-card-shop tycoon. Buy parody packs, inspect
pulled cards with a loupe at the Inspection Desk, grade and slab them,
then sell raw, sell slabbed, or run a Whatnot-style live auction.

All sets, players, and creatures are **original parody content** — no
real athletes, teams, or copyrighted characters.

## Play the web version (instant, no install)

Open `index.html` in any browser (double-click it, or serve the folder).
It is a complete, self-contained HTML5 canvas game:

- **Pack Shop** — 3 parody sets (Gridiron Legends $30, Pocket Kaiju $25,
  Mythic Marvels $35). Each pack pulls 5 cards, last card guaranteed
  Rare or better. No F2P wait timers.
- **Inspection Desk** — drag the loupe over the card to reveal the 4
  real grading metrics: Front Centering (e.g. 55/45), 4 Corners
  (whitening), 4 Edges (wear), Surface print lines (tilt the light
  past ±25° to reveal them). All 4 metrics unlock grading.
- **Grading & Slab Reveal** — $25 fee. Grade 1–10 is weighted from the
  hidden sub-grades (centering 30%, corners 25%, edges 20%, surface
  25%). Value multipliers: Gem Mint 10 = 5×, 9 = 3×, 8 = 2×, 7 = 1.5×,
  6 = 1.2×, 5 = 1×, lower grades pay less than base.
- **Live Stream Auction** — 15-second countdown, Hype Chat button that
  boosts bidder momentum, AI bidders Whale (rare huge jumps), SnipeBot
  (strikes in the last 4 seconds), BargainHunter (early small bids,
  walks away above 1.2× value), and a manual Gavel Slam. A bid in the
  final 3 seconds adds 2 seconds (max 2 extensions).
- **Collection** — everything you own, with Sell and Send-to-Auction.
- Progress (cash, inventory, stats) saves to browser localStorage.

Self-test: open `index.html?autotest=1` — it runs the full flow
(pack → inspect → grade → sell → auction) and prints PASS/FAIL.

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

The Godot scripts mirror the web game's systems one-to-one (same
weights, prices, bidder caps, and rules), so the Godot version is a
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
