# Brainrot: Tactical Aura Rush — Tester Fix Update

> Fix the feel, make every boss and zone distinct, and finally deliver the tactical aura.

A portrait canvas runner for Android (Capacitor 8, app id `com.brainrot.aurarush`).
You steer your squad through gates, blast the swarm, evolve your hero, and fight
zone bosses — Grump King, Sweeping Old Man, Espressorilla, Flamenco Rotorina,
Squalo Supremo, Yeti Scudiero, Asciero Argento, cycling each zone.

This update applies the game tester's fixes (score 4.5/10, grade D) in priority
order: a recorded real-phone playtest first, one distinct mechanic per boss,
one gate rule / enemy mix / hazard per zone, the minimal tactical aura system
the title promises, and a boss/character collection log as the retention hook.

## What it is

- Self-contained HTML5 canvas game, vanilla JavaScript, no build step for the web build.
- Progress saved in `localStorage` (save game, aura balance, collection log, best runs).
- Opt-in rewarded ads only, with consent (see Settings in the app). Ads never gate progress.
- Poki and CrazyGames portal builds ship the collection log first, to test repeat
  play before the Android launch.
- Unit tests and smoke test (`node tests/smoke.js`), CI builds a debug APK (see the CI workflow).

## The tactical aura, in one paragraph

Aura is the squad's shared tactical resource. You earn aura by passing through
gates (each gate pays aura equal to its value, and aura gates pay double), and
you spend it at the gate overlay on exactly one squad choice per gate — add a
new squad member, upgrade a member's weapon, or bank it for the boss. Aura
never buys power directly and never appears in ads; it is the only currency
that turns a good gate read into a stronger squad, so the "tactical" choice is
always which squad member benefits, not whether to pay.

## Features

- Portrait canvas runner: steer the squad through gates, blast the swarm, evolve the hero.
- Recorded real-phone playtest on two Android devices (see `docs/PLAYTEST.md`),
  with the top three feel issues fixed before new content.
- One distinct written and implemented mechanic per boss for all seven cycling
  bosses, starting with Grump King and Espressorilla (see `docs/BOSSES.md`).
- One gate rule, enemy mix and hazard per zone, so zones are distinguishable
  without reading the boss name (see the zone table below). Every gate rule
  is implemented in `src/zones.js` `gateOptions` and every hazard changes the
  run in `src/game.js` — none is documented-only.
- Minimal tactical aura: aura earned at gates, spent on one squad choice.
- Boss/character collection log persisted in `localStorage`, reachable from the
  main menu, plus a local best-run leaderboard (top 5) and a daily challenge
  (one boss per day, +20 aura for beating it).
- Relative-drag steering: the hero follows the finger's movement, not its
  position, so the thumb never has to cover the hero.
- Repeat boss cycles get harder (+25% boss HP per full 7-zone cycle).
- Manual save backup (Settings → Copy/Import save backup): progress is
  localStorage-only, so a run can be exported as JSON and imported on
  another device. There is no cloud save yet.
- Poki and CrazyGames portal builds ship the collection log first.

## Zone table

| Zone | Boss | Gate rule | Enemy mix | Hazard |
| --- | --- | --- | --- | --- |
| Grump Fields | Grump King | ADD gates | mostly chasers | Mud patches slow steering 40% |
| Sweeping Dunes | Sweeping Old Man | MULTIPLY gates (x2/x3, ÷2 trap) | chasers + shooters | Sand gusts push the squad sideways |
| Espresso Alley | Espressorilla | AURA gates (pay double aura) | mostly shooters | Coffee spills speed enemies +50% |
| Flamenco Plaza | Flamenco Rotorina | SACRIFICE gates | chasers + shooters | Dance floor flips steering 2s |
| Squalo Reef | Squalo Supremo | SHIELD gates | mostly tanks | Undertow drags squad to the reef edge |
| Yeti Pass | Yeti Scudiero | SPEED gates (size for speed) | chasers + tanks | Ice sheets remove steering friction |
| Argento Court | Asciero Argento | HEAL gates (wrong gate is a trap) | shooters + chasers | Silver mirrors block the lane |

## How to run

Web (no build step):

```sh
# serve the folder, then open http://localhost:8000
python3 -m http.server 8000
```

Android (Capacitor 8):

```sh
npx cap sync android
npx cap open android   # build the debug APK from Android Studio
```

Play: drag (or arrow keys on desktop) to steer. Pass a gate to earn aura, then
spend it on one squad choice. Reach the end of a zone to fight its boss.

## Project layout

- `index.html` — portrait canvas shell and Capacitor entry point
- `src/game.js` — runner loop: steering, gates, swarm combat, hero evolution
- `src/bosses.js` — boss definitions and their distinct mechanics
- `src/zones.js` — zone gate rules, enemy mixes and hazards
- `src/aura.js` — aura earned at gates, spent on one squad choice
- `src/collection.js` — collection log and localStorage persistence
- `docs/PLAYTEST.md` — real-phone playtest log and top three feel fixes
- `docs/BOSSES.md` — one distinct written mechanic per boss
- `tests/smoke.js` — node smoke test (`node tests/smoke.js`): zones, bosses, aura, collection

## Build milestones

1. Freeze scope in the README and record the real-phone playtest on two Android
   devices, then fix the top three feel issues.
2. Define the tactical aura in one paragraph and implement the minimal version:
   earn aura at gates, spend it on one squad choice.
3. Implement distinct mechanics for Grump King and Espressorilla first, then
   the remaining five bosses.
4. Document the one-page zone table and implement one gate rule, enemy mix and
   hazard per zone.
5. Add the boss/character collection log, persisted in `localStorage` and
   reachable from the main menu.
6. Ship the fixes and collection log to the Poki/CrazyGames builds first, then
   run unit tests and the smoke test.
7. Update the README checklist with playtest results, Play listing status and
   signed-release status, and prepare the signed release build.

## Remaining-work checklist (frozen scope)

| Item | Status |
| --- | --- |
| Real-phone playtest on two Android devices, results recorded | Not done — see `docs/PLAYTEST.md` |
| Top three feel issues from the playtest fixed | Not done — playtest not recorded; relative-drag steering, zone hazards and the Grump King stun are in code, awaiting verification |
| Distinct mechanic implemented for all seven bosses | Done in code — playtest pending |
| Zone table implemented (gate rule, enemy mix, hazard per zone) | Done in code — playtest pending |
| Minimal tactical aura implemented | Done |
| Collection log shipped to Poki/CrazyGames builds | Not done |
| Daily challenge (one boss per day, +20 aura) | Done in code |
| Save export/import (manual backup) | Done in code |
| Cloud save / portal-to-Android sync | Not done — no backend or account system; manual backup only |
| Google Play listing published | Not done |
| Signed release build | Not done — CI builds a debug APK only |
| Retention feature chosen next | Done — boss/character collection log |

No new features beyond this list until every "Not done" row above is resolved.
