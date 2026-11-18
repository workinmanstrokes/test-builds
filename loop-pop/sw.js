// Loop Pop service worker.
// The game page is fetched network-first so new versions reach installed phones; everything else
// (icons, fonts) is served from cache and refreshed in the background. Works fully offline after one visit.
const C='looppop-v3';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('looppop')&&n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp)).catch(()=>{});}return res;};
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const page=req.mode==='navigate'||req.destination==='document';
  if(page){e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));return;}
  e.respondWith(caches.match(req).then(hit=>{const net=fetch(req).then(r=>put(req,r)).catch(()=>hit);return hit||net;}));
});
