/* Laugh Pad shell. Audio files are cache-first so taps stay local. */
const CACHE_NAME = 'laughpad-v4';
// Every game on the arcade site shares one cache storage, so only clear this game's own old caches (this app used to be 'soundboard-').
const OWN = [CACHE_NAME.slice(0, CACHE_NAME.lastIndexOf('-') + 1), 'soundboard-'];
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'telemetry.js',
  'telemetry-config.js',
  'lib/telemetry.js',
  'manifest.webmanifest',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'fonts/outfit-500.woff2',
  'fonts/outfit-600.woff2',
  'fonts/outfit-700.woff2',
  'fonts/outfit-800.woff2',
  'lib/archive.js',
  'lib/clip-store.js',
  'lib/color.js',
  'lib/engine.js',
  'lib/licenses.js',
  'lib/marks.js',
  'lib/voices.js',
  'data/starter-pack.json',
  'audio/airhorn.wav',
  'audio/rimshot.wav',
  'audio/sad-trombone.wav',
  'audio/boing.wav',
  'audio/laser.wav',
  'audio/whistle.wav',
  'audio/applause.wav',
  'audio/drum-roll.wav',
  'audio/quack.wav',
  'audio/moo.wav',
  'audio/ding.wav',
  'audio/buzzer.wav',
  'audio/coin.wav',
  'audio/fart.wav',
  'audio/tada.wav',
  'audio/crickets.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => OWN.some((p) => k.startsWith(p)) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const audio = url.pathname.endsWith('.wav');
  event.respondWith((async () => {
    if (audio) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    } catch (_) {
      return (await caches.match(event.request)) || (await caches.match('index.html'));
    }
  })());
});
