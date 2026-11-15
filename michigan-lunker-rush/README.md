# Michigan Lunker Rush — Milestone 1–3 Vertical Slice

A Michigan fishing game. Three lakes, a Scout Drone, weather that matters,
tap-and-drag casting, a tension-bar fight, and a 3D-printer Workbench where
landed-fish coins buy PLA lures and stronger line.

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
