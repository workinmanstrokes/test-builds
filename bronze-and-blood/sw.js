// Bronze & Blood playtest service worker.
// The game page is fetched network-first so updates reach installed phones; other files are served
// from cache and refreshed in the background. On update it removes only this game's own old caches.
const PREFIX='bronze-blood-playtest-';
const CACHE=PREFIX+'v2';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','../icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Clone before the response goes back to the page, so the body is still unread when it is cached.
const put=(req,res)=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}return res;};
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const page=req.mode==='navigate'||req.destination==='document';
  if(page){e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req).then(hit=>hit||caches.match('./'))));return;}
  e.respondWith(caches.match(req).then(hit=>{const net=fetch(req).then(r=>put(req,r)).catch(()=>hit||Response.error());return hit||net;}));
});
