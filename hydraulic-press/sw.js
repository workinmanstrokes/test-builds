// Hydraulic Press & Foundry offline cache. Bump VERSION whenever you change game files.
// This game shares its web address with the other arcade games, so it only ever touches its own
// caches (names starting "hpf-") and never deletes another game's offline files.
const VERSION = 'hpf-v2';
const FILES = ['./', './index.html', './style.css', './game.js', './data.js', './manifest.webmanifest',
  './vendor/three.module.min.js', './vendor/RoomEnvironment.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hpf-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Network first so updates show up; fall back to the cache when offline.
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
