# Soundboard

> **Tap a pad, get the laugh in under ten seconds.**

A web soundboard app: big coloured play pads, a mic recorder to capture your
own sounds, live Internet Archive sound-effect search with preview and
one-tap save to the board, pad rename/delete/download, and a macro builder.
A downloadable single-page version stores sounds on-device. Installable as a
PWA, with an Android APK build via Capacitor.

## Tester review fixes (score 4.5/10, grade D — highest priority first)

1. **Mic recorder** — test end-to-end on real Android Chrome, iOS Safari, and
   desktop Chrome: grant and deny permission, record, save to a pad, replay
   after reload. Fix it or cut it from the headline features. (This update:
   feature detection disables the recorder with a plain explanation where
   mic recording is unsupported, the best supported MIME type is picked, and
   recordings auto-stop at a 60 s cap so they fit on-device storage instead
   of being discarded after the fact. Real-device testing is still pending —
   see TESTING.md; nothing here claims a device test has passed.)
2. **Starter pack** — a pre-loaded pack of 16 short, clearly labelled sounds
   so the board is funny in under 10 seconds with zero searching. (This
   build: the 16 sounds are synthesised with Web Audio, so they play
   instantly offline with no download; real recordings come from search.)
3. **Hit loop** — stop-all button and clear press feedback, tested rapid taps
   and overlapping sounds on a real phone; fix the worst tap-to-sound delay.
   (This update: Stop All now also stops saved search clips, recordings, and
   previews — previously it only stopped built-in synth sounds. Added
   keyboard hotkeys (1–0, Q–Y play pads 1–16, Esc stops all) and a live
   tap-to-sound latency readout under the grid. Rapid-tap testing on a real
   phone is still pending — see TESTING.md.)
4. **Routing** — one real routing use: a tested OBS browser-source setup or a
   Discord/virtual-cable guide. Speaker-only playback is the default and is
   labelled as such in the app until a routing use is verified. (Still
   unverified — no live-stream test has been run. TESTING.md now holds the
   OBS and Discord verification checklists to run on a real stream.)
5. **Distribution** — repo created, APK build produced, add-to-home-screen
   verified on Android and iOS; if the APK stalls, the verified
   single-file/PWA path ships first. (This update: the manifest pointed at
   `icon-192.png` / `icon-512.png`, which did not exist in the repo, so the
   PWA install metadata was broken — replaced with a real `icon.svg` that
   ships in the repo and is cached by the service worker (cache v2). The
   APK itself is still not built — it needs Android Studio (`npx cap open
   android`); add-to-home-screen verification on Android/iOS is still
   pending — see TESTING.md.)
6. **Search-to-save** — five timed search-to-save tests with real terms;
   count taps and seconds from search to a playable saved pad, and cut or
   shorten any step that makes saving feel like a chore. (This update: the
   per-item Internet Archive metadata calls now run in parallel instead of
   one by one, which was the slowest step. The five timed runs themselves
   are still to be done on a real phone — protocol and blank results table
   in TESTING.md.)

## Features

- Grid of big coloured pads with instant tap playback, visible press
  feedback, and a stop-all button
- Pre-loaded starter pack of 16 short, clearly labelled sounds, playable
  with zero searching
- Mic recorder that records, saves to a pad, and replays after reload (kept
  only if it passes device testing)
- Live Internet Archive sound-effect search with preview and one-tap save
- Pad rename, delete, and download
- Macro builder to chain up to 8 pads into one tap (explicit chain-building mode, per-macro delete)
- On-device storage for saved and recorded sounds so the board survives reload
- Verified OBS browser-source routing guide, with speaker-only playback
  clearly labelled when applicable
- Installable PWA with add-to-home-screen support and an Android APK build

## Screens

Soundboard grid (main board) · Search results with preview and save ·
Recorder sheet · Pad editor (rename / delete / download) · Macro builder ·
Routing guide (OBS / Discord) · Install & settings

## Stack

Vanilla HTML/CSS/JS single-page PWA packaged with Capacitor for Android.

It reuses the existing verified single-page build and its on-device storage,
while Capacitor adds a real APK and the PWA manifest adds installability
without rewriting the audio code.

## Run it

Serve the folder over HTTP (service workers and mic access need a secure
context) and open `index.html`:

```sh
python3 -m http.server 8080
```

Or open the PWA from any static host. Add to home screen from the browser
menu on Android (Chrome) or iOS (Safari → Share → Add to Home Screen).

## Android APK (Capacitor)

```sh
npm install @capacitor/core @capacitor/cli
npx cap init Soundboard com.soundboard.app --web-dir=.
npx cap add android
npx cap sync
npx cap open android   # build the APK in Android Studio
```

`capacitor.config.json` in this repo holds the app ID, name, and web dir.
No APK is checked into the repo yet — building one needs Android Studio;
until then the verified single-file/PWA path is the distribution path.

## Milestones

1. Playable skeleton: starter pack of 16 labelled sounds on the coloured
   grid with instant tap playback, press feedback, and stop-all, working
   from the single-file build on a real phone.
2. Harden the hit loop: test rapid taps and overlapping sounds on a real
   phone, measure tap-to-sound delay, and fix the worst delay found.
3. Test the mic recorder end-to-end on Android Chrome, iOS Safari, and
   desktop Chrome — grant and deny permission, record, save to a pad,
   replay after reload — then fix it or remove it from headline features.
4. Run five timed search-to-save tests with real terms, count taps and
   seconds to a playable saved pad, and cut or shorten any slow step.
5. Add and verify one real routing use — OBS browser source or
   Discord/virtual-cable guide — and label speaker-only playback clearly
   if that is the default.
6. Unblock distribution: create the repo, verify PWA add-to-home-screen on
   Android and iOS, produce the APK, and ship the verified single-file/PWA
   path first if the APK stalls.
7. Regression pass: verify rename/delete/download, macros, and on-device
   persistence, then ship the update.

## Tester update notes (VEX 4.5/10, suggestions 548–564)

- **Scope call:** the core is the tap loop + starter pack. Recorder, live
  search, and macros stay, but none of them is presented as verified until
  TESTING.md says so — the recorder stays a headline feature only because
  its failure modes are now handled in-app (unsupported browser, denied
  permission, 60 s cap); if it fails device testing it comes off the
  headline list per milestone 3.
- **Single-source risk:** the board no longer depends on search to be fun —
  the 16-sound starter pack is synthesised on-device and plays offline, so
  an Internet Archive outage leaves a full board, just no new sounds.

## Device test matrix

Full test protocols (mic grant/deny, five timed search-to-save runs,
OBS/Discord verification, tap latency, PWA install) and blank results
tables live in TESTING.md — nothing in this repo claims a device test has
passed until it is filled in there.

| Test | Android Chrome | iOS Safari | Desktop Chrome |
| --- | --- | --- | --- |
| Starter pack plays, <10 s to first laugh | ☐ | ☐ | ☐ |
| Rapid taps / overlapping sounds | ☐ | ☐ | ☐ |
| Stop-all stops everything | ☐ | ☐ | ☐ |
| Mic: permission granted → record → save → replay after reload | ☐ | ☐ | ☐ |
| Mic: permission denied → clear message, no crash | ☐ | ☐ | ☐ |
| Search → preview → save → playable pad (timed, 5 terms) | ☐ | ☐ | ☐ |
| Rename / delete / download a pad | ☐ | ☐ | ☐ |
| Macro plays its pads in order | ☐ | ☐ | ☐ |
| Add to home screen installs the PWA | ☐ | ☐ | ☐ |
| OBS browser-source routing verified | ☐ | ☐ | ☐ |

## Open questions

- Should starter-pack audio be bundled for offline playback or streamed
  from Internet Archive, given the single-file size and offline goals?
  (Current answer: synthesised offline; revisit if real recordings are wanted.)
- Which routing use should be verified first — OBS browser source or
  Discord/virtual cable?
- If mic recording fails on iOS Safari but works elsewhere, should it be
  hidden on iOS only or removed from headline features entirely?

## Data model

- **Pad** — label, colour, position, linked sound
- **SoundClip** — audio data/URL, source, duration, label
- **StarterPackSound** — bundled/streamed clip, label, colour
- **Recording** — mic audio, created date, pad link
- **Macro** — name, ordered pad steps
- **AppSettings** — volume, speaker-only routing label, install state
