# Mobile Loop Test — one loop, one phone, two minutes

**Purpose:** the Game Test Lab asked for one loop prototyped on an Android phone, playable and understandable in two minutes, plus 30 seconds of real-device gameplay and screenshots for the next build description. This is the protocol for that run. It has **not** been run on a real phone yet — this document is the checklist, not a claim that it passed.

## The loop, mapped to the Lab's ask

The Lab's "claim a slab plot, build a house, sell or rent it, reinvest" describes a house tycoon. Slab House Tycoon is a trading-card-shop tycoon, so the loop maps like this:

| Lab's step | In this game |
|---|---|
| Claim a slab plot | **Buy a pack** ($25–$35, Pack Shop) — this is claiming your stock |
| Build a house | **Inspect + grade the best pull** into a slab (Inspection Desk → grading) |
| Sell or rent it | **Sell raw, sell slabbed, or run the live auction** |
| Reinvest | **Buy the next pack / upgrade** with the profit |

## Two-minute run (one real Android phone, web build `index.html`)

| Time | Do | Pass if |
|---|---|---|
| 0:00–0:20 | Open the game, buy one pack, open it | Pack opens, 5 cards reveal, best pull glows gold — no zooming in/out to reach any button |
| 0:20–1:00 | Put the best pull on the Inspection Desk, drag the loupe through all four zones, flip the card, inspect the back | Every metric reveals; the card never hides under the finger; grading unlocks only at 4/4 |
| 1:00–1:30 | Preview grading, submit, crack the slab open | Preview shows fee, grade range, and slab-value range before any cash moves; slab reveal shows grade + subgrades + cert number |
| 1:30–2:00 | Sell the slab (or run the auction and Gavel Slam), end the day | Cash updates, $15 rent is charged, save survives a reload |

## 30-second gameplay capture (for the next build description)

Record one continuous 30-second screen recording on the real device — no emulator, no sped-up footage:

- **0–10s:** buy and open a pack (shows shop, pack opening, rarity reveal).
- **10–20s:** loupe drag across the Inspection Desk, flip the card (shows touch controls and desk visuals).
- **20–30s:** grading preview, slab crack, and the sale/auction close (shows the payoff and the cash counter moving).

## Screenshots for the next build description

1. Main Shop (3D store view / web shop front)
2. Pack opening — best pull with gold glow
3. Inspection Desk — loupe over a card with a metric revealed
4. Slab reveal — label color, grade, subgrades, cert number
5. Live auction — countdown, hype meter, chat bidders
6. Collection — slabbed cards with label colors and pop

## Known gap (do not claim otherwise)

The Godot build's desk handles mouse input (`InspectionDesk._gui_input`), and `project.godot` now sets `pointing/emulate_mouse_from_touch=true` explicitly, so a finger on the Android/iOS export generates the same mouse-button/motion events the desk already handles — that wiring has still **not** been run on a real phone, so touch is configured, not tested. The web build is the touch reference until then. See [`docs/controls.md`](controls.md) for the full PC key map and the touch-pass checklist.

## Performance notes to record during the capture

The 30-second capture is also the first performance evidence. Record
these alongside the video and do not claim any of them until measured:

- **Device:** model, Android version, and whether the game ran in the
  browser or an installed wrapper.
- **Frame rate:** note any visible stutter during the pack flip-in and
  the auction countdown; if the device can show it, record the FPS
  (target 60, acceptable 30 — unmeasured until this run).
- **Load time:** seconds from tap to the shop front being usable.
- **Fit:** every button reachable without zooming in/out; the desk canvas
  already scales to viewport width (`#desk { max-width:100%;
  height:auto; }`), so confirm it holds on this device.
- **Touch latency:** any lag between a loupe drag and the magnified
  window following the finger.
