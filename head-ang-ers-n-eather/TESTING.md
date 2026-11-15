# Soundboard — device test protocols

Nothing in this file has been run yet. Every result table is blank on
purpose: fill it in from a real phone/browser, never from a guess. These
protocols cover the VEX tester fixes (score 4.5/10, grade D) that cannot be
proven from code alone.

## 1. Mic recorder (grant / deny / save / replay)

Run on each of: Android Chrome, iOS Safari, desktop Chrome.

| Step | Android Chrome | iOS Safari | Desktop Chrome |
| --- | --- | --- | --- |
| Recorder button enabled (or disabled with a plain explanation) | ☐ | ☐ | ☐ |
| Grant permission → record 5 s → stop → new pad appears | ☐ | ☐ | ☐ |
| Replay the recording, reload the page, replay again | ☐ | ☐ | ☐ |
| Deny permission → clear message, board still works | ☐ | ☐ | ☐ |
| Record past 60 s → auto-stops, recording is saved | ☐ | ☐ | ☐ |

**Gate (milestone 3):** if recording fails on iOS Safari but works
elsewhere, hide the recorder on iOS only; if it fails everywhere, remove it
from the headline features. Do not ship a claim it works until a row above
is ticked from a real device.

## 2. Hit loop — rapid taps, overlap, stop-all, latency

| Check | Result |
| --- | --- |
| 10 rapid taps on one pad: every tap sounds, no stuck "playing" state | ☐ |
| Two different pads tapped together: both sound (overlap) | ☐ |
| Stop All while a saved clip/recording is playing: sound stops | ☐ |
| Stop All while a preview is playing: sound stops | ☐ |
| Worst tap-to-sound delay seen on the latency readout (ms) | ___ ms |
| Keyboard: 1–0 / Q–Y play pads, Esc stops all | ☐ |

## 3. Search-to-save — five timed runs

Start the clock at typing the term, stop it when the saved pad plays.
Count taps from the search box to the playable pad.

| # | Term | Taps | Seconds | Saved pad plays? |
| --- | --- | --- | --- | --- |
| 1 | airhorn | | | ☐ |
| 2 | laugh | | | ☐ |
| 3 | drum roll | | | ☐ |
| 4 | applause | | | ☐ |
| 5 | laser | | | ☐ |

If any run takes more than ~30 s or more than ~6 taps, cut or shorten the
slow step before calling this fixed.

## 4. Routing — one verified real use

**OBS browser source (verify first):**

| Check | Result |
| --- | --- |
| Board added as OBS browser source, "Control audio via OBS" ticked | ☐ |
| Pad tap moves the OBS audio meter | ☐ |
| Stream recording contains the pad sound (not just speakers) | ☐ |

**Discord / virtual cable (desktop):**

| Check | Result |
| --- | --- |
| Virtual cable set as browser output + Discord mic input | ☐ |
| Listener in the call hears the pad | ☐ |

Until one table is fully ticked, the app's speaker-only label stays.

## 5. Distribution — PWA install + APK

| Check | Result |
| --- | --- |
| Android Chrome: Add to Home screen installs, icon shows, opens standalone | ☐ |
| iOS Safari: Share → Add to Home Screen installs, opens standalone | ☐ |
| Offline: board + starter pack load with no network (service worker) | ☐ |
| APK built in Android Studio from `capacitor.config.json` | ☐ |

## 6. Regression pass

| Check | Result |
| --- | --- |
| Rename / delete / download a pad | ☐ |
| Macro (max 8 steps) plays its pads in order; delete removes it | ☐ |
| Saved pads + recordings survive reload | ☐ |
| Reset restores the 16-sound starter pack | ☐ |
