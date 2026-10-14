/* F1 Universe PWA 61.000. Saves remain in browser storage and are never cached or posted here. */
const STATIC_CACHE = 'f1-universe-static-61000-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('f1-universe-static-') && k !== STATIC_CACHE).map(k => caches.delete(k)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
 const req=event.request; const url=new URL(req.url);
 if(req.method!=='GET' || url.origin!==location.origin) return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>response).catch(()=>caches.match('/index.html')));return;
 }
 // Cache only static game resources, never arbitrary requests, game data or saves.
 if(!/\.(?:js|css|glb|webp|png|jpg|jpeg|svg|woff2?)$/i.test(url.pathname))return;
 if(/\.(?:js|css)$/i.test(url.pathname)){
  // Stable bundle URLs must receive new code online; keep cached code for offline play.
  event.respondWith(fetch(req).then(resp=>{
   if(resp.ok){const copy=resp.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(req,copy));}
   return resp;
  }).catch(()=>caches.match(req).then(hit=>hit || Response.error())));
  return;
 }
 event.respondWith(caches.match(req).then(hit=>{
  const fresh=fetch(req).then(resp=>{
   if(resp.ok) {const copy=resp.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(req,copy));}
   return resp;
  }).catch(()=>hit || Response.error());
  return hit || fresh;
 }));
});
