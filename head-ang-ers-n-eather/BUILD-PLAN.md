# Soundboard — build plan (update from the 4.5/10 tester review)

## Project

- **Name:** Soundboard
- **Kind:** app (update to an existing web Soundboard)
- **Platform:** Web (PWA, with Android APK)
- **Category:** Audio Entertainment
- **Tagline:** Tap a pad, get the laugh in under ten seconds.
- **Stack:** Vanilla HTML/CSS/JS single-page PWA packaged with Capacitor for Android.
  Reuses the existing verified single-page build and its on-device storage,
  while Capacitor adds a real APK and the PWA manifest adds installability
  without rewriting the audio code.

## What the existing build already had

Big coloured play pads, a mic recorder to capture your own sounds, live
Internet Archive sound-effect search with preview and one-tap save to the
board, pad rename/delete/download, and a macro builder. A downloadable
single-page version stores sounds on-device. Search was fixed to return real
short sound effects; the downloadable version was verified. Mic recording was
never tested, and a real installable APK was blocked on repo creation.

## Tester fixes, highest priority first

1. Test the mic recorder end-to-end on real Android Chrome, iOS Safari, and
   desktop Chrome: grant and deny permission, record, save to a pad, replay
   after reload, then fix it or cut it from the headline features.
2. Ship a pre-loaded starter pack of 12–20 short, clearly labelled sounds so
   the board is funny in under 10 seconds with zero searching.
   → Done in this build: 16 sounds in `data/starter-pack.json`, synthesised
   with Web Audio so they play instantly offline.
3. Harden the hit loop on a real phone: add stop-all and clear press
   feedback, test rapid taps and overlapping sounds, and fix the worst
   tap-to-sound delay found.
   → Done in this build: stop-all button, press feedback in `styles.css`,
   `pointerdown` playback and one warm shared AudioContext in `app.js`.
   Real-phone timing still to be measured.
4. Add and verify one real routing use — a tested OBS browser-source setup or
   a Discord/virtual-cable guide — and label speaker-only playback clearly if
   that remains the default.
   → Guide written in `index.html`; speaker-only is labelled in the header.
   Live verification still open.
5. Unblock distribution: create the repo, produce the APK build, and verify
   add-to-home-screen install on Android and iOS; if the APK stalls, ship
   the verified single-file/PWA path first.
   → Repo created by this push; `capacitor.config.json` + manifest + `sw.js`
   are in place. APK build and install checks still open.
6. Run five timed search-to-save tests with real terms, count the taps and
   seconds from search to a playable saved pad, and cut or shorten any step
   that makes saving feel like a chore.
   → Search-to-save is one tap on a result (`app.js`); timed tests still open.

## Milestones

1. Playable skeleton: starter pack of 16 labelled sounds on the coloured grid
   with instant tap playback, press feedback, and stop-all, working from the
   single-file build on a real phone.
2. Harden the hit loop: test rapid taps and overlapping sounds on a real phone,
   measure tap-to-sound delay, and fix the worst delay found.
3. Test the mic recorder end-to-end on Android Chrome, iOS Safari, and desktop
   Chrome — grant and deny permission, record, save to a pad, replay after
   reload — then fix it or remove it from headline features.
4. Run five timed search-to-save tests with real terms, count taps and seconds
   to a playable saved pad, and cut or shorten any slow step.
5. Add and verify one real routing use — OBS browser source or Discord/virtual-
   cable guide — and label speaker-only playback clearly if that is the default.
6. Unblock distribution: create the repo, verify PWA add-to-home-screen on
   Android and iOS, produce the APK, and ship the verified single-file/PWA path
   first if the APK stalls.
7. Regression pass: verify rename/delete/download, macros, and on-device
   persistence, then ship the update.

## Open questions

- Should starter-pack audio be bundled for offline playback or streamed from
  Internet Archive, given the single-file size and offline goals?
- Which routing use should be verified first — OBS browser source or
  Discord/virtual cable?
- If mic recording fails on iOS Safari but works elsewhere, should it be hidden
  on iOS only or removed from headline features entirely?
