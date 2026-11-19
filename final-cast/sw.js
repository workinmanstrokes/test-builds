// Offline cache for the web/PWA build (not used inside the Android app).
var CACHE='final-cast-v5';
// Every game on the arcade site shares one cache storage, so only clear this game's own old caches.
var OWN=CACHE.slice(0,CACHE.lastIndexOf('-')+1);
var FILES=['./','index.html','portal.js','telemetry.js','privacy.html','manifest.webmanifest','fonts/pixelify.woff2','fonts/atkinson-400.woff2','fonts/atkinson-700.woff2','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES.map(function(u){return new Request(u,{cache:'reload'})}))}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n.indexOf(OWN)===0&&n!==CACHE}).map(function(n){return caches.delete(n)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request)}))});
