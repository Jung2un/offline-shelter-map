importScripts('./offline-core.js');
const BASE=new URL('./',self.location),SHELL=OfflineCore.prefix+'shell-1';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch(new URL('offline-manifest.json',BASE),{cache:'no-store'});
 if(!response.ok)throw Error('Manifest unavailable');
 const m=OfflineCore.validateManifest(await response.json()),cache=await caches.open(SHELL);
 for(const f of m.files.filter(f=>!f.path.startsWith('data/tiles/'))){const url=new URL(f.path,BASE);const r=await fetch(url,{cache:'no-store'});if(!await OfflineCore.valid(r,f))throw Error('Invalid shell: '+f.path);await cache.put(url,r)}
 await cache.put(new URL('offline-manifest.json',BASE),new Response(JSON.stringify(m),{headers:{'Content-Type':'application/json'}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname))return;
 // The page explicitly bypasses cached versions when checking a new release.
 if(u.searchParams.has('offline-network'))return;
 event.respondWith((async()=>{
  const active=await OfflineCore.active();
  const key=event.request.mode==='navigate'?new URL('index.html',BASE).href:u.origin+u.pathname;
  if(active){const cached=await(await caches.open(OfflineCore.cacheName(active.version))).match(key);if(cached)return cached}
  const shell=await(await caches.open(SHELL)).match(key);if(shell)return shell;
  try{return await fetch(event.request)}catch{return new Response('저장하지 않은 파일입니다. 인터넷 연결 후 지도 다운로드를 완료하세요.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})}
 })());
});
