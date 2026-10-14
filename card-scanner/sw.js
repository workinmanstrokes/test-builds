const C = 'cs-v7', SHELL = ['./', 'net.js', 'identify.js', 'ai.js', 'vendor/capacitor.js', 'idcore.js', 'data/ygo-names.json', 'index.html', 'styles.css', 'app.js', 'pricing.js', 'ocr.js', 'centering.js', 'icon.svg', 'privacy.html', 'manifest.webmanifest',
  'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js', 'vendor/tesseract/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract/tesseract-core-lstm.wasm.js', 'vendor/tesseract/eng.traineddata.gz', 'vendor/ort/ort.wasm.min.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  else e.respondWith(fetch(e.request).then(r => { if (r.ok && /tcgdex|scryfall|ygoprodeck|lorcast/.test(u.host) && !/\.(png|jpg|webp|avif)/.test(u.pathname)) { const cl = r.clone(); caches.open(C + '-api').then(c => c.put(e.request, cl)); } return r; }).catch(() => caches.match(e.request))); });
