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
   after reload. Fix it or cut it from the headline features.
2. **Starter pack** — a pre-loaded pack of 16 short, clearly labelled sounds
   so the board is funny in under 10 seconds with zero searching. (This
   build: the 16 sounds are synthesised with Web Audio, so they play
   instantly offline with no download; real recordings come from search.)
3. **Hit loop** — stop-all button and clear press feedback, tested rapid taps
   and overlapping sounds on a real phone; fix the worst tap-to-sound delay.
4. **Routing** — one real routing use: a tested OBS browser-source setup or a
   Discord/virtual-cable guide. Speaker-only playback is the default and is
   labelled as such in the app until a routing use is verified.
5. **Distribution** — repo created, APK build produced, add-to-home-screen
   verified on Android and iOS; if the APK stalls, the verified
   single-file/PWA path ships first.
6. **Search-to-save** — five timed search-to-save tests with real terms;
   count taps and seconds from search to a playable saved pad, and cut or
   shorten any step that makes saving feel like a chore.

## Features

- Grid of big coloured pads with instant tap playback, visible press
  feedback, and a stop-all button
- Pre-loaded starter pack of 16 short, clearly labelled sounds, playable
  with zero searching
- Mic recorder that records, saves to a pad, and replays after reload (kept
  only if it passes device testing)
- Live Internet Archive sound-effect search with preview and one-tap save
- Pad rename, delete, and download
- Macro builder to chain multiple pads into one tap
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

## Device test matrix

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
