# Controls — Slab House Tycoon

PC controls are locked first; the mobile touch pass comes after, on one
real device, before mobile is advertised any further.

## PC (Godot build — `scripts/main.gd`)

| Key / input | Action |
|---|---|
| Mouse drag on the desk | Move the loupe over the card; zones reveal centering, corners, edges, surface |
| Mouse wheel | Zoom the card at the desk (web build; Godot zoom follows the same binding) |
| `G` | Submit the desk card for grading — locked until all 4 metrics are inspected |
| `P` | Grading preview: fee, grade range, and slab-value range before paying |
| `S` | Sell the desk card raw for the standing fixed offer |
| `A` | Start the live auction — graded slabs only |
| `H` | Hype Chat: boosts bidder momentum mid-auction |
| `Space` | Gavel Slam: close the auction now |
| `E` | End day: pay $15 rent, advance to the next day |
| `N` | Buy the Neon Sign upgrade ($150, +15% buyer demand) |

The loop is enforced, not suggested: grading refuses until the desk
shows 4/4 metrics, the auction refuses raw cards, and the grading
preview shows the fee and the grade/value range before any cash moves.

## Mobile touch pass — status: NOT YET RUN

One real-device touch pass is required before mobile is claimed as
done. It has **not** been run yet on a real phone; do not advertise
mobile as tested until it has.

**Pass target:** the web build's Inspection Desk on one real phone
(the maker's daily phone first), because that desk already has the
touch flow: fixed jeweler's screen above the finger, pinch/scroll
zoom, double-tap reset, light presets, and phone-tilt glare.

**Pass checklist (single device):**

1. Buy a pack, open it, and put the best pull on the desk — no zooming
   in/out to reach any button.
2. Drag the loupe through all four zones; every metric reveals, and
   the card never hides under the finger.
3. Flip the card and inspect the back; grading unlocks only at 4/4.
4. Preview grading, submit, crack the slab, and sell or auction it.
5. End the day and confirm the save survives a reload.

**Known gap:** the Godot build's desk currently handles mouse input
only (`InspectionDesk._gui_input`); touch in the Godot export is
pending this pass (emulate-mouse-from-touch is the expected route).
The web build is the touch reference until then.
