# Michigan Lunker Rush — Milestone 1–3 Vertical Slice

A Michigan fishing game. Three lakes, a Scout Drone, weather that matters,
tap-and-drag casting, a tension-bar fight, and a 3D-printer Workbench where
landed-fish coins buy PLA lures and stronger line.

## Tester update (VEX, 2026-11-20)

VEX scored the build 3/10 (F): "a tension-bar timer with no reason to cast
again." This push answers all 17 items — see `docs/TESTER-RESPONSE.md` for
the item-by-item map. The short version:

- **One complete loop, first catch in under 60 s:** the first cast of a
  first trip bites in 0.8–1.6 s, and fights now run on per-species profiles
  (panfish nibble, bass burst, pike make long hard runs) instead of one
  scalar — same bar, a different fish.
- **Drone as a decision:** it reveals species, size, depth, and cover, and
  casting within 150 px of a revealed fish bites 2.5× faster.
- **Teaches itself:** a panfish feeds in plain sight on a first trip with
  a ripple ring and one line of guidance; the tension bar shows a visible
  danger zone with a flashing DANGER label. All coaching stops after the
  first catch.
- **One retention hook:** personal best for bass and pike, a rare gold fish
  (4% of spawns, 3× coins), and a daily target (+50 coins).
- **Lure economy, one page:** `docs/LURE-ECONOMY.md` — lures are virtual
  only; physical 3D-printed redemption is cut until the loop retains players.
- **One-handed portrait:** 200 px full-power drag, wider tension bar, all
  primary controls within thumb reach; the on-device checklist is
  `docs/PHONE-TEST.md` (not yet run on a real phone).

The fixes live in the Godot project (the plan's stack). The HTML slice has
not been ported yet — see `docs/TESTER-RESPONSE.md`, "Still open".

## Play it right now (HTML5, no install)

Open **`index.html`** in any browser (double-click it, or serve the folder).
It is a complete, self-contained, portrait 720×1280 canvas game — no server,
no assets to download.

- **Menu:** pick a lake — Holloway Flats (starter panfish/largemouth),
  St. Clair Channels (smallmouth/largemouth/pike), Tahquamenon Deep
  (trophy northern pike).
- **Cast:** press and drag on the water, release to cast. The drag distance
  sets power; the bobber lands past your drag point.
- **Bite:** wait for the bobber to dip and **STRIKE!** to flash, then tap
  within ~1.25 s to hook the fish.
- **Fight (vertical tension bar):** tap rhythmically to reel in. Holding
  reels harder but spikes tension toward the snap line. Go idle and the
  fish gains slack and spits the hook. Land it to earn coins by species
  and weight (trophy fish pay 1.5×).
- **Scout Drone button:** reveals underwater fish silhouettes (species +
  size) for 5 seconds, then a 15-second cooldown.
- **Weather:** rolled when you enter a lake — Sunny, Overcast, or Rain.
  **Rain boosts Northern Pike bite rate and aggression by 40%.**
- **Workbench button:** spend coins on 3D-printed PLA lures
  (Texas-rigged Senko → Topwater Frog → Squarebill Crankbait) and line
  upgrades (15 lb Braid → 25 lb Fluoro Leader → 40 lb Heavy Braid).
  Stronger line raises the tension level where the line snaps.
  Everything saves to `localStorage` on the device.

## Godot 4 version

The same systems, as a real Godot 4 starting point:

| File | What it does |
|---|---|
| `project.godot` | Portrait 720×1280, canvas stretch, touch-from-mouse on |
| `main.tscn` | Root `Node2D` running `scripts/main.gd` |
| `scripts/main.gd` | Game controller: scenes, input, fish spawning, drawing |
| `scripts/lakes.gd` | Lakes, species, weather, lure and line data + bite math |
| `scripts/weather.gd` | Weather state machine (Rain = +40% pike) |
| `scripts/drone.gd` | Scout Drone 5 s reveal / 15 s cooldown |
| `scripts/casting.gd` | Tap-and-drag casting, bobber, bite rolls, strike window |
| `scripts/tension.gd` | Tension-bar fight: tap, hold, slack, snap |
| `scripts/workbench.gd` | Buy/equip lures and lines |
| `scripts/save_manager.gd` | JSON save to `user://lunker_rush_save.json` |

Open the folder in Godot 4.3+ and press Play. Touch works on mobile;
on desktop, mouse input is emulated as touch.

Tester-update docs:

| File | What it does |
|---|---|
| `docs/TESTER-RESPONSE.md` | All 17 VEX items, mapped to the change that answers each |
| `docs/LURE-ECONOMY.md` | The lure economy in one page (virtual-only lures, prices, earn rate) |
| `docs/PHONE-TEST.md` | One-handed portrait phone test checklist (not yet run) |

## Tested

The HTML5 version was exercised headlessly (Node 24): `node --check` on
the game script plus a 52-check playthrough harness covering lake select,
drone reveal/cooldown, casting, bite → strike → hook, tapping to a catch,
holding to a line snap, slack to a spit hook, missed strike window,
workbench buy/equip/refusals, and save persistence across a reload.
**52 passed, 0 failed.**

The Godot scripts were written to match the tested HTML logic but were
**not** run in the Godot editor on this machine (Godot is not installed
here) — open the project in Godot and press Play to verify on your side.
That includes the tester-update changes: they are written to match the
same logic, but no Godot editor run or real-phone run has happened yet.
Run `docs/PHONE-TEST.md` on a real Android phone before calling the loop
proven.
