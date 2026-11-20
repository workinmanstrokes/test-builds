// Network-first app shell. A failed script or style must not be replaced with
// index.html — that parse error pins a broken copy of the app. Only a
// navigation falls back to the cached shell. caches from older builds
// (including dirttrack-<sha>) are dropped on activate.
const C = 'dirttrack-c4fc5d0390';
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then((c) => c.addAll(['./', './index.html', './icon.svg', './manifest.webmanifest'])));
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (r.ok) {
        const cp = r.clone();
        caches.open(C).then((c) => c.put(e.request, cp)).catch(() => {});
      }
      return r;
    } catch {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      if (e.request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
    }
  })());
});
