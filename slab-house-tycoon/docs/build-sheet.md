# Slab House Tycoon — Build Sheet (one page)

**For Game Test Lab re-review — written 2026-11-25 in response to the 2.7/10 (F) review.**
**Playable now:** open `index.html` in any browser — no install, no account. Godot 4.3 project in the same repo (`project.godot`, main scene `main.tscn`).

## What "slab" means

A **slab** is a trading card sealed in a hard plastic grading case — the thing collectors buy, sell, and display. This is a **trading-card-shop tycoon**, not a house-building game: there are no plots, no houses to construct, and no renters. The name "Slab House" is the name of the shop (and its fictional grading company, SHG). The Lab's "claim a plot, build a house, sell or rent it" loop is answered by the card-shop loop below — buy a pack, grade the pull into a slab, sell the slab.

## The 60-second loop — three player verbs

**BUY → INSPECT → FLIP.** One full loop takes about a minute and is understandable in two.

1. **BUY** — spend $25–$35 on a pack from one of 9 parody sets. Five cards, last card Rare or better.
2. **INSPECT** — put the best pull on the Inspection Desk. Drag the loupe over centering, corners, edges, and surface; flip the card to check the back. Grading stays locked until all four metrics are checked on both sides.
3. **FLIP** — grade it ($10/$25/$75 by service) and get a 1–10 slab, or sell it raw for the standing fixed offer. Slabbed cards sell for more, or go to the 15-second live auction against AI bidders (Whale, SnipeBot, BargainHunter) with a Hype Chat button and a manual Gavel Slam.

## How money is made and spent

| | Numbers |
|---|---|
| Start cash | $500 |
| Money in | Raw sale: card base value ($2–$800 by rarity). Slab sale: base × grade multiplier (10 = 5×, 9 = 3×, 8 = 2×, 7 = 1.5×). Auction: bids scale with slab value and rarity demand. Pop 1 Gem Mint 10s pay up to 2.5×. |
| Money out | Packs $25–$35. Grading $10 Economy / $25 Regular / $75 Express. Rent $15/day, paid on End day. |
| Reinvest | Profits buy more packs, better grading services, and shop upgrades. No timers, no ads, no in-app purchases — paid one-time game. |

## The first three unlocks

1. **Neon Sign — $150.** +15% buyer demand on raw sales, slab sales, and fixed offers. The first thing a profitable shop buys.
2. **High-Lumen Lamp.** Every surface flaw (micro-scratches included) becomes visible at any light angle — fewer surprise low grades.
3. **Prep Station.** +0.5 surface subgrade by wiping fingerprints before submission — turns borderline 9s into 10s.

Later unlocks: Digital Calipers (centering locks the moment a side faces up), Bulk Submitter Account (10+ cards at $15 Regular / $7 Economy), VIP Auction Slots (house fee 10% → 3%, bigger bidders), UV Blacklight ($200, catches fake cards and fake slabs at the Card Show).

## What to test in re-review

The two-minute phone loop in [`docs/mobile-loop-test.md`](mobile-loop-test.md): buy a pack → inspect the best pull → grade it → sell or auction it → end the day and confirm the save survives a reload. That is the whole game; everything else (Card Show, Hobby News, pop reports, four grading companies) is depth on top of it.

## Open questions — answered in the build

- **Sets/IP:** original parody content only — no real athletes, teams, or licensed characters.
- **Business model:** paid one-time, no ads, no IAP. The economy is balanced as a buy-once game.
- **Auction:** single-player against AI bidders only. No real-money multiplayer is planned.

## How this differs from House Builder, Home Builder 3D and Real Estate Tycoon

The Lab's comparators (House Builder 3.6 stars, Real Estate Tycoon 3.7) are
build/sell/rent **house** games. Slab House Tycoon is not one — the name is
the shop's name, and the "slab" is a graded card in a plastic case. The
table below is the differentiation, cut to one thing: the grading skill
loop. Everything that is not that loop is depth on top of it, not a
second game.

| Comparator | Their core loop | What Slab House does instead |
|---|---|---|
| House Builder / Home Builder 3D | Claim a plot, build a house, sell or rent it, customize it | No plots, no houses, no renters. **BUY → INSPECT → FLIP:** buy a pack, read a card's real condition at the desk, decide if the $25 grading fee pays, sell the slab or run the auction |
| Merge Building DIY | Merge items to build | No merging. The skill is **reading condition** — centering split ratios, whitened corners, edge chipping, typed surface flaws — and knowing the break-even grade before paying |
| Real Estate Tycoon | Buy property, collect rent, expand territory | Rent here is a **cost** ($15/day), not income. Income is flipping slabs: pop reports, fakes at the Card Show, Hobby News price moves, and a live auction with AI bidders |

The one differentiator, in one sentence: **you do not build houses, you
judge cardboard** — the game is won by spotting a card the market
undervalues, proving it at the desk, and slabbing it before anyone else
notices. The numbers behind that claim are tested in
[`docs/economy.csv`](economy.csv): at the expected grade of 7, only cards
worth $50+ profit from grading.

## Replay hooks & endgame

What brings a player back after the first houses — here, after the first
slabs:

- **Daily events:** Hobby News moves prices most days (breakouts up to
  2.5×, injuries down to 0.55×, hype bubbles that crash two days later);
  the Card Show restocks four tables of singles every day.
- **Goals:** the upgrade ladder (Neon Sign → Lamp → Prep Station →
  Calipers → Bulk Submitter → VIP Auction Slots → UV Blacklight), a Pop 1
  Gem Mint 10 (worth 2.5× a normal 10), and the 1/1 chase (1% of packs).
- **Collection endgame:** complete all 9 parody sets; chase low-pop
  slabs; own every upgrade. There is no final boss and no story ending —
  the endgame is a complete collection and a shop that runs at a profit.
- **Honest gap:** there is **no offline income** — the shop earns only
  while you play. That is a design choice, not an oversight, and it is
  stated here so the Lab does not have to guess: if offline earnings are
  wanted, they are a new system, not a tuning change.
