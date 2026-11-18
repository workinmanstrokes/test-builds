# Hydraulic Press & Foundry

Run a hydraulic press shop. Customers bring in custom orders: flatten a safe to exactly 41%, crack a geode open without shattering it, crush a mystery crate and keep what's inside. Read the metal, release in time, build your reputation, and upgrade the press.

- **3D press** (three.js) with real-time metal deformation, heat glow, sparks and synthesized sound
- **Custom orders** with tolerances, fragility and hidden break points
- **Read the metal**: creaks, glow, sparks and vibration warn you before something ruptures
- **Reputation stars** unlock pickier customers and bigger jobs
- **Furnace**: every job leaves scrap, scrap becomes ingots, ingots become cash
- **Installable app (PWA)** that works offline on Android

## Controls
| | Phone | Keyboard |
|---|---|---|
| Press (fast) | hold **PRESS** or the 3D view | hold **Space** |
| Fine press (slow) | hold **FINE** | hold **Shift** |
| Deliver | **DELIVER** | **Enter** |

## Play locally
```
npm start          # → http://localhost:8080
```

## Install on your phone
Host the folder on GitHub Pages (repo Settings → Pages → deploy from `main`, `/root`), open the link in Chrome on Android, then tap **⋮ → Add to Home screen / Install app**.

## The AI bot team (local Ollama)
The `.claude/agents/` folder holds five bots that run on your own Ollama model through Claude Code:

| Bot | Job | Writes |
|---|---|---|
| `game-tester` | runs the automated playtest and ranks problems | `playtest/FINDINGS.md` |
| `bug-hunter` | fixes one bug with the smallest change | `playtest/BUGS.md` |
| `balance-tuner` | changes one balance number, retests, keeps or reverts | `playtest/BALANCE_LOG.md` |
| `content-writer` | adds customers, lines and items in `data.js` | `data.js` |
| `release-manager` | checks, bumps the offline cache, commits, pushes | git |

```
./bots.sh test        # playtest + findings
./bots.sh cycle       # test → fix bugs → balance → test again
./bots.sh content "Add 3 farm customers and a tractor engine item"
./bots.sh chat        # open Claude Code here and talk to any bot
MODEL=qwen3:8b ./bots.sh test
```

First run installs Playwright and a headless Chromium (needs your WSL password once).

### How the playtest works
`npm run playtest` loads the real game in a hidden browser. Three bot players with human-like reaction time play it:
- **careful** uses FINE near targets
- **rusher** never uses FINE
- **greedy** chases the highest-paying jobs

It writes `playtest/report.md` with results per job type, failures, star timing, upgrade timing, errors and stuck events.

## Files
`index.html` · `style.css` · `game.js` (engine) · `data.js` (content) · `sw.js` (offline) · `tools/` (playtest, data check, server) · `vendor/` (three.js)
