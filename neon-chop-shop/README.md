# Neon Chop Shop — Milestone 1-3 Vertical Slice

A cyberpunk roguelite: **surgery first**, with an optional ICE card heist.
Portrait **720x1280**, built for one-handed mobile play.

## How to run

### Browser prototype (playable now)
Open `index.html` in any modern browser, or serve it locally:

```bash
cd neon-chop-shop
python3 -m http.server 8000
# open http://localhost:8000/
```

Touch and mouse both work. Progress (banked credits, reputation, shift
record, blueprints) saves to `localStorage` on the device.

**Self-test:** open `index.html?selftest=1` — an automated suite plays a
full shift (diagnosis calls, drag implant, wires, overclock, optional ICE
battle, Jack Out), buys a blueprint, then triggers a Raid both ways (Heat
and Trace) and verifies the blueprints survive. It prints PASS/FAIL lines
on the page.

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
                            + reputation + shift win/loss record
  surgery.gd                Phase 1: diagnosis call / implant / wires /
                            Stability / overclock gamble / score breakdown
  ice_battler.gd            Phase 2 (optional): deck, RAM, Trace, ICE nodes
  raid.gd                   Raid resolution (wipes unbanked + implant only)
  main.gd                   State machine + input + _draw rendering
README.md                   This file
```

## The game

**Title screen** — Start Shift, Workbench (3D printer), How to Play. Shows
banked credits, jobs done, raids survived, blueprints owned, reputation,
and shifts won/lost.

**The shift (the roguelite spine)** — one shift is **5 clients**. Bank
**800cr** in the shift and finish with **Reputation 40+** to win it. A Raid
ends the shift as a loss. Win/loss record persists between shifts.

**Phase 1 — Cyber-Surgery Table (the core loop, playable end to end)**
- Tap **DIAGNOSE**: the log shows the client's **conflicting symptoms**
  (two point at the true fault, one is a red herring) plus system-log lines.
  Then **CALL the faulty slot** — Optics, Neural Link, or Reflex Booster.
  A wrong call costs **25 Stability, 5 Reputation, 10 Heat**, and the
  diagnosis stays open so you can re-read the logs.
- Pick a chip: **Factory** (safe) or **Street chip** (+30% pay, +15 Heat,
  −10 Stability when seated).
- **Drag** the matching implant chip from the tray onto that slot. Wrong
  slot = rejection, **−25 Stability**, +12 Heat, −5 Reputation.
- **Drag** each color-coded wire (red / blue / green) to its matching node.
  A missed drop costs 6 Heat and **−5 Stability**.
- **Stability** is the client's health on the table: **0% = the client
  flatlines = failed surgery = Raid.**
- **OVERCLOCK** toggle: +50% payout, but all Heat gains x1.25 (x1.125 with
  the Overclock Governor blueprint), and a **25% malfunction chance halves
  the payout** and hurts the client.
- Tap **COMPLETE SURGERY** once the implant is seated and all 3 circuits
  are connected. You get an itemised **score breakdown** (base fee,
  blueprint/variant/overclock bonuses, clean-table bonus, mistake
  penalties) so you can see how to improve. **Heat 100% or Stability 0%
  = failed surgery = Raid.**
- **UNDO** pulls your last seat/wire back (Heat and damage stay — undo is
  not free). **Hold a chip** (600ms) to inspect what it is and where it
  goes.

**After surgery — your choice.** Bank the surgery pay and take the next
client, or **JACK IN** for the optional heist.

**Phase 2 — ICE Card Battler (OPTIONAL heist prototype, frozen)**
- The heist is deliberately **not** part of the core loop: it only exists
  behind the explicit "Jack In" choice after a completed surgery, so the
  surgery loop can be playtested on its own first. Keep it only if it adds
  tension the surgery loop lacks.
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
unbanked credits and the active implant are wiped, and the shift ends as a
loss. **Banked credits, reputation, and unlocked 3D-printer blueprints
always survive.**

**Workbench (3D printer)** — spend banked credits on persistent blueprints:
Optics Mk II (+25% surgery payout, 200cr), Neural Link Mk II (+2 starting
RAM, 200cr), Reflex Booster Mk II (20% less Heat, 200cr), Cloak Firmware
(Cloak cuts 25 Trace, 300cr), Overclock Governor (Overclock Heat penalty
halved, 300cr), PLA+ Spool (draw 5 cards/turn, 150cr).

## Tester update — VEX, Game Test Lab (2026-11-20)

VEX scored the previous build **2.5/10 (F)**: a cyberpunk clinic fantasy
with a working drag-and-drop toy, not yet a fun or playable roguelite. This
update answers every item in the smallest real change that satisfies it:

1. **One surgery job, end to end** — a client arrives, you diagnose, seat
   parts, gamble the overclock, get paid with a score breakdown, and the
   next client arrives. No new systems were added before this loop worked.
2. **Surgery tension** — wrong slot / missed wire / wrong diagnosis damage
   the client (Stability meter), cut pay and reputation; the score
   breakdown shows exactly how to improve.
3. **Diagnosis is a decision** — conflicting symptoms, a red herring, and
   Factory vs Street chip trade-offs replace flavour text before dragging.
4. **Shift/run skeleton** — 5 clients per shift, credits + reputation,
   shift win/lose, restart; built on the existing GameState/save.
5. **Heist frozen as an optional prototype** — one short card encounter
   against ICE with a Trace meter, behind an explicit opt-in after surgery.
6. **Android touch pass** — larger snap zones (slot +34, wire node 56,
   implant grab 90, wire grab 44), Undo, hold-to-inspect, larger log text.
   Still needs a real-phone test for mis-drops and stability (see below).
7.–10. **Loop, danger, roguelite systems, mobile tuning** — covered by
   1–6 above: there is now a run, win/lose condition, pay, progression,
   wrong-part costs, a timer-like pressure (Heat/Stability), and touch
   tuning.
11. **Art / audio / performance** — honestly still procedural only: no art
    assets, no sound, no device/frame-rate data yet. See "Device test
    checklist" below; nothing here is faked as measured.
12. **Economy / release path** — no price, purchase, ad, or retention hook
    is decided yet. The plan is a free test/sideload build first; store
    release (and signing/review work) is an open decision, not a v1
    requirement.
13./14./17. **Scope** — diagnosis, surgery, and card heists are no longer
    built in parallel: surgery is the one proven loop, the heist is frozen
    behind an opt-in, and no new content was added in this update.
15. **Real-device evidence** — still none. The checklist below is the next
    step; drag-and-drop feel and readability are unproven until then.
16. **Name discoverability** — acknowledged, not resolved: Neon Shop 3D!
    and several Chop Shop titles already exist in stores, so this title
    risks confusion in search. A rename is a release decision for the
    maker, not something this update pretends to fix.

## Device test checklist (real phone, still to do)

- [ ] One full shift (5 clients) on a real Android phone, one-handed.
- [ ] Mis-drop rate: count accidental wrong-slot / missed-wire drops.
- [ ] Text readable at arm's length on a small screen (log, slot labels).
- [ ] Hold-to-inspect and Undo usable without mis-taps.
- [ ] Frame rate / load time noted (no target claimed until measured).
- [ ] One iOS-sized viewport check (layout is 720x1280 portrait).

## What was tested

- `node --check` on the extracted inline JS: clean.
- Headless logic harness (Node DOM/canvas stub, 20 assertions):
  **20 passed, 0 failed.** It plays clean jobs end to end, checks the
  score breakdown, wrong-diagnosis costs, Undo, Street-chip payout, the
  optional-heist opt-in and Jack Out, a forced overclock malfunction
  (payout halved), a full 5-client shift win, and both Raid triggers
  (Heat 100 and Stability 0).
- In-file self-test (`index.html?selftest=1`, 51 assertions) extended for
  the new flows: diagnosis calls, Undo/re-seat, Street variant, score
  breakdown, the optional-heist skip, forced malfunction, and a 5-client
  shift win: **51 passed, 0 failed** (verified under a Node DOM/canvas
  stub harness).
- Every screen (title, workbench, surgery, surgery-done, ICE, raid,
  job done, shift end, how-to) rendered without throwing.
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
  run fails in ~5-6 turns and a careful one wins in ~3-4. The 800cr shift
  quota and 25% malfunction rate are first-pass numbers — tune them from
  real playtests, not from this doc.
