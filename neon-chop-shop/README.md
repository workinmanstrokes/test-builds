# Neon Chop Shop — Milestone 1-3 Vertical Slice

A cyberpunk roguelite: **Phase 1** cyber-surgery table, **Phase 2** turn-based
ICE card battler, with roguelite Raid stakes. Portrait **720x1280**, built
for one-handed mobile play.

## How to run

### Browser prototype (playable now)
Open `index.html` in any modern browser, or serve it locally:

```bash
cd neon-chop-shop
python3 -m http.server 8000
# open http://localhost:8000/
```

Touch and mouse both work. Progress (banked credits + blueprints) saves to
`localStorage` on the device.

**Self-test:** open `index.html?selftest=1` — an automated suite plays a
full job (diagnose, drag implant, wires, overclock, ICE battle, Jack Out),
buys a blueprint, then triggers a Raid both ways (Heat and Trace) and
verifies the blueprints survive. It prints PASS/FAIL lines on the page.

### Godot 4 version
Requires **Godot 4.x**. Open `project.godot` in the editor and run the
`Main` scene. The GDScript mirrors the HTML version exactly — same screens,
same numbers, same stakes — using `_draw()`-based rendering, so the project
runs with no extra scene setup. Mouse works on desktop;
`emulate_touch_from_mouse` is enabled in `project.godot` for testing touch.

## Layout

```
index.html                  Playable HTML5 canvas prototype (self-contained)
project.godot               Godot 4 project (portrait 720x1280)
main.tscn                   Main scene (Node2D + scripts/main.gd)
scripts/
  game_state.gd             Persistent save: banked credits + blueprints
  surgery.gd                Phase 1: diagnose / implant / wires / Heat
  ice_battler.gd            Phase 2: deck, RAM, Trace, ICE nodes
  raid.gd                   Raid resolution (wipes unbanked + implant only)
  main.gd                   State machine + input + _draw rendering
README.md                   This file
```

## The game

**Title screen** — New Job, Workbench (3D printer), How to Play. Shows banked
credits, jobs done, raids survived, blueprints owned.

**Phase 1 — Cyber-Surgery Table**
- Tap **DIAGNOSE**: the log names the faulty slot — Optics, Neural Link,
  or Reflex Booster.
- **Drag** the matching implant chip from the tray onto that slot. Wrong
  slot = rejection + 12 Heat.
- **Drag** each color-coded wire (red / blue / green) to its matching node.
  A missed drop costs 6 Heat.
- **OVERCLOCK** toggle: +50% payout, but all Heat gains x1.25 (x1.125 with
  the Overclock Governor blueprint).
- Tap **COMPLETE SURGERY** once the implant is seated and all 3 circuits
  are connected. **Heat 100% = failed surgery = Raid.**

**Phase 2 — ICE Card Battler**
- Turn-based. Draw **4 cards per turn** (5 with the PLA+ Spool blueprint),
  **RAM +3 per turn** (max 10).
- Cards: **Spike** (2 RAM, 3 dmg), **Spoof** (1 RAM, 2 dmg, Trace -5),
  **Cloak** (2 RAM, Trace -15), **Overcharge** (3 RAM, 6 dmg, Trace +10).
- Tap a card to select it, tap a live ICE node to attack. Cloak needs no
  target — tap it again to run it.
- 3 firewall nodes: SENTRY-7 (8 HP), BLACK ICE (10 HP), GATEKEEPER (12 HP).
  Each destroyed node steals 100cr; destroying all three pays a 250cr bonus.
- **Trace Meter**: +5 per turn, +3 per live node, +10 per Overcharge.
  **Trace 100% = Raid.**
- **JACK OUT** any time to bank what you stole so far and end the job.

**Raid stakes** — a failed surgery or 100% Trace triggers a police Raid:
unbanked credits and the active implant are wiped. **Banked credits and
unlocked 3D-printer blueprints always survive.**

**Workbench (3D printer)** — spend banked credits on persistent blueprints:
Optics Mk II (+25% surgery payout, 200cr), Neural Link Mk II (+2 starting
RAM, 200cr), Reflex Booster Mk II (20% less Heat, 200cr), Cloak Firmware
(Cloak cuts 25 Trace, 300cr), Overclock Governor (Overclock Heat penalty
halved, 300cr), PLA+ Spool (draw 5 cards/turn, 150cr).

## What was tested

- `node --check` on the extracted inline JS: clean.
- Headless self-test (`index.html?selftest=1`, 36 assertions, run under a
  Node DOM/canvas stub harness): **36 passed, 0 failed.** It exercises a
  real pointer drag to seat the implant, wrong-slot/wrong-wire rejections,
  Overclock payout math, card play + RAM + Trace, end-turn redraw, hack
  completion, Jack Out banking, blueprint purchase + persistence, and both
  Raid triggers (Heat 100 and Trace 100) with blueprint survival verified
  against localStorage.
- Every screen (title, workbench, surgery, ICE, raid, job done, how-to)
  rendered without throwing.
- Godot scripts: delimiter/indentation sanity-checked, but **not executed
  in the Godot editor** (no Godot binary in this environment) — open the
  project in Godot 4.x and run the Main scene to confirm.

## Known limits

- The HTML prototype is the fully playable version; the Godot port mirrors
  its systems and screens but its in-editor run is unverified here (see above).
- The Godot renderer draws square panels (rounded corners are stubbed in
  `_rr()`), and the surgery log lines are sized to fit without clipping.
- The browser prototype has no sound and no art assets — all visuals are
  procedural canvas drawing.
- Balance is a first pass: Heat and Trace pressure were tuned so a careless
  run fails in ~5-6 turns and a careful one wins in ~3-4.
