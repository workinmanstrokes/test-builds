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
