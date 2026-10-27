// Fishing Almanac service worker.
// - App shell: network-first, cached copy when offline.
// - Map tiles (Esri imagery/labels): cache-first from any cache, so tiles of
//   saved offline spots (fishing-almanac-spots-v1, written by the page) and
//   tiles you've viewed load instantly and with no signal.
// - Michigan DNR depth (ArcGIS) and USGS gauges: network-first with
//   an opportunistic cache for offline fallback.
const CACHE = 'fishing-almanac-03a265206e';
const DATA = "fishing-almanac-data-v1";
const SPOTS = "fishing-almanac-spots-v1"; // owned by src/lib/offlineSpots.js; never trimmed here
const DATA_MAX = 1500; // entries; tiles are ~20-60 KB each
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./privacy.html", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./ios.js"];
const TILE_HOSTS = /(^|\.)arcgisonline\.com$/;
const DATA_HOSTS = /^services3\.arcgis\.com$|^waterservices\.usgs\.gov$/;
// Open-Meteo is not cached here: lib/weather.js keeps the last forecast with its real age.

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE, DATA, SPOTS].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - DATA_MAX; i++) await cache.delete(keys[i]);
}
function keep(request, res) {
  // Opaque responses (no-cors) are kept too, but CORS tiles are preferred: they're readable by the page.
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(DATA).then((c) => c.put(request, copy).then(() => trim(c))).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (TILE_HOSTS.test(url.hostname)) {
    event.respondWith(caches.match(request.url, { ignoreVary: true }).then((hit) => hit || fetch(request).then((res) => keep(request, res))).catch(() => Response.error()));
    return;
  }
  if (DATA_HOSTS.test(url.hostname)) {
    event.respondWith(fetch(request).then((res) => keep(request, res)).catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit || Response.error())));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))));
});
