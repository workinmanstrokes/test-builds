// Diddlers Arcade service worker.
// Pages are fetched network-first so arcade and game updates reach installed phones; other files
// are served from cache and refreshed in the background. On update it removes only this arcade's
// own old caches, never the caches of the other games and apps on this site.
const PREFIX='diddlers-arcade-';
const CACHE=PREFIX+'v2';
const FILES=['./','./index.html','./manifest.webmanifest','./icon.svg','./loop-pop/','./loop-pop/index.html','./bronze-and-blood/','./bronze-and-blood/index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const put=(req,res)=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}return res;};
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const page=req.mode==='navigate'||req.destination==='document';
  if(page){e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req).then(hit=>hit||caches.match('./'))));return;}
  e.respondWith(caches.match(req).then(hit=>{const net=fetch(req).then(r=>put(req,r)).catch(()=>hit||Response.error());return hit||net;}));
});
