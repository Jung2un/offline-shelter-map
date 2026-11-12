const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const base='https://example.test/map/';
async function harness(){
 const stores=new Map(),elements=new Map(),requests=[];let writes=0,manifest;
 const caches={keys:async()=>[...stores.keys()],open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);
  return {match:async key=>data.get(String(key))?.clone(),put:async(key,r)=>{writes++;data.set(String(key),r.clone())},keys:async()=>[...data.keys()].map(url=>({url}))};
 }};
 const document={querySelector:key=>{if(!elements.has(key))elements.set(key,{setAttribute(){}});return elements.get(key)}};
 const bodies=new Map();
 const context=vm.createContext({URL,Response,Event,AbortController,crypto:webcrypto,caches,document,location:{href:base+'index.html'},isSecureContext:true,setTimeout:()=>{},navigator:{serviceWorker:{ready:Promise.resolve(),register:async()=>{}},storage:{persist:async()=>true}},window:{caches,addEventListener(){},dispatchEvent(){}},fetch:async url=>{
  const u=new URL(url);requests.push(u.pathname);
  if(u.pathname.endsWith('offline-manifest.json'))return new Response(JSON.stringify(manifest));
  return bodies.has(u.pathname)?new Response(bodies.get(u.pathname)):new Response('missing',{status:404});
 }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../www/offline-core.js'),'utf8'),context);
 const core=context.OfflineCore;
 async function file(name,body){return {path:name,bytes:Buffer.byteLength(body),sha256:await core.digest(Buffer.from(body))}}
 async function seed(version,entries,activate=false){
  const files=[];const cache=await caches.open(core.cacheName(version));
  for(const [name,body] of entries){files.push(await file(name,body));await cache.put(base+name,new Response(body))}
  const m={version,files,totalBytes:files.reduce((n,f)=>n+f.bytes,0)};
  await cache.put(base+'offline-manifest.json',new Response(JSON.stringify(m)));
  if(activate)await core.activate(m);
  return m;
 }
 return {core,caches,stores,elements,requests,bodies,file,seed,get writes(){return writes},setManifest:m=>manifest=m,start:()=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../www/offline.js'),'utf8'),context)};
}

test('update reuses completed and interrupted snapshots; only changed/missing files use network',async()=>{
 const h=await harness();
 await h.seed('v1111111111111111',[['index.html','old'],['data/unchanged.json','same'],['data/corrupt.json','good']],true);
 await(await h.caches.open(h.core.cacheName('v1111111111111111'))).put(base+'data/corrupt.json',new Response('bad!'));
 await h.seed('v2222222222222222',[['data/resumed.json','resume']]);
 const entries=[['index.html','new'],['data/unchanged.json','same'],['data/corrupt.json','good'],['data/resumed.json','resume'],['data/missing.json','added']];
 const files=await Promise.all(entries.map(([n,b])=>h.file(n,b)));
 const m={version:'v3333333333333333',files,totalBytes:files.reduce((n,f)=>n+f.bytes,0)};
 for(const [n,b] of entries)h.bodies.set('/map/'+n,b);
 h.setManifest(m);await h.start();
 await h.elements.get('#download-start').onclick();
 assert.deepEqual(h.requests.sort(),['/map/offline-manifest.json','/map/index.html','/map/data/corrupt.json','/map/data/missing.json'].sort());
 assert.equal((await h.core.active()).version,m.version);
 const cache=await h.caches.open(h.core.cacheName(m.version));
 for(const f of files)assert.equal(await h.core.valid(await cache.match(base+f.path),f),true);
 assert.match(h.elements.get('#download-note').textContent,/기존 파일 2개 재사용 · 새로 받은 파일 3개/);
 assert.equal(h.elements.get('#download-progress').hidden,true);
 // A repeated click verifies the existing target and downloads no file again.
 h.requests.length=0;await h.elements.get('#download-start').onclick();
 assert.deepEqual(h.requests,['/map/offline-manifest.json']);
});

test('verification uses no network, writes no files, and clearly reports completion',async()=>{
 const h=await harness();await h.seed('v1111111111111111',[['index.html','ok']],true);await h.start();
 const before=h.writes;await h.elements.get('#download-verify').onclick();
 assert.equal(h.writes,before);assert.deepEqual(h.requests,[]);
 assert.match(h.elements.get('#verify-status').textContent,/검사 완료/);
 assert.match(h.elements.get('#verify-note').textContent,/다운로드하거나 변경한 파일은 없습니다/);
 assert.equal(h.elements.get('#verify-progress').hidden,true);
});

test('verification reports missing files without trying to repair them',async()=>{
 const h=await harness();await h.seed('v1111111111111111',[['index.html','ok'],['data/missing.json','ok']],true);
 h.stores.get(h.core.cacheName('v1111111111111111')).delete(base+'data/missing.json');await h.start();
 const before=h.writes;await h.elements.get('#download-verify').onclick();
 assert.equal(h.writes,before);assert.deepEqual(h.requests,[]);
 assert.match(h.elements.get('#verify-note').textContent,/1개 파일이 누락/);
});

test('failed update keeps the prior complete map active and resumes valid target files',async()=>{
 const h=await harness();await h.seed('v1111111111111111',[['index.html','old']],true);
 const files=[await h.file('index.html','new'),await h.file('data/missing.json','tile')];
 h.setManifest({version:'v2222222222222222',files,totalBytes:7});h.bodies.set('/map/index.html','new');await h.start();
 await h.elements.get('#download-start').onclick();
 assert.equal((await h.core.active()).version,'v1111111111111111');
 h.bodies.set('/map/data/missing.json','tile');h.requests.length=0;
 await h.elements.get('#download-start').onclick();
 assert.deepEqual(h.requests,['/map/offline-manifest.json','/map/data/missing.json']);
 assert.equal((await h.core.active()).version,'v2222222222222222');
});
