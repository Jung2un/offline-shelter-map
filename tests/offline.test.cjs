const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const stores=new Map();
const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const s=stores.get(name);return {match:async k=>s.get(String(k))?.clone(),put:async(k,r)=>s.set(String(k),r.clone())}}};
const ctx={location:{href:'https://example.test/offline-shelter-map/index.html'},URL,Response,caches,crypto:webcrypto};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../www/offline-core.js'),'utf8'),ctx);
const c=ctx.OfflineCore;
test('download verification rejects truncated and corrupted responses',async()=>{
 const body=new TextEncoder().encode('offline map');const f={bytes:body.length,sha256:await c.digest(body)};
 assert.equal(await c.valid(new Response(body),f),true);
 assert.equal(await c.valid(new Response('offline ma'),f),false);
 assert.equal(await c.valid(new Response('offline mop'),f),false);
 assert.equal(await c.valid(new Response(body,{status:404}),f),false);
});
test('manifest rejects traversal and duplicate paths',()=>{
 const f={path:'index.html',bytes:0,sha256:'0'.repeat(64)};
 assert.equal(c.validateManifest({version:'v0123456789abcdef',files:[f]}).files.length,1);
 for(const files of [[f,f],[f,{...f,path:'../private'}],[f,{...f,path:'https://other.test/a'}]])assert.throws(()=>c.validateManifest({version:'v0123456789abcdef',files}));
});
test('active snapshot remains unchanged until explicit activation',async()=>{
 assert.equal(await c.active(),null);
 await c.activate({version:'v0123456789abcdef',totalBytes:10,files:[{}]});
 await (await caches.open(c.cacheName('v1111111111111111'))).put('partial',new Response('unfinished'));
 assert.equal((await c.active()).version,'v0123456789abcdef');
 assert.equal((await c.active()).count,1);
});
test('worker serves saved navigation and unseen tiles without network',async()=>{
 const events={};const base='https://example.test/offline-shelter-map/';
 const stored={version:'v2222222222222222',totalBytes:20,files:[{},{}]};
 await c.activate(stored);
 const snapshot=await caches.open(c.cacheName(stored.version));
 await snapshot.put(base+'index.html',new Response('<h1>offline</h1>'));
 await snapshot.put(base+'data/tiles/13/1/2.json',new Response('{"tile":true}'));
 let networkCalls=0;
 const context={URL,Response,caches,OfflineCore:c,importScripts:()=>{},fetch:async()=>{networkCalls++;throw Error('Offline')},self:{location:base+'sw.js',addEventListener:(type,fn)=>events[type]=fn}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../www/sw.js'),'utf8'),context);
 async function request(url,mode='cors'){let result;events.fetch({request:{method:'GET',url,mode},respondWith:p=>result=p});return result}
 assert.match(await(await request(base,'navigate')).text(),/offline/);
 assert.equal(await(await request(base+'data/tiles/13/1/2.json?v=1')).text(),'{"tile":true}');
 assert.equal(networkCalls,0);
 assert.equal((await request(base+'data/tiles/13/missing.json')).status,503);
});

test('page can read saved tiles directly from the completed snapshot',async()=>{
 const version='v3333333333333333',url='https://example.test/offline-shelter-map/data/tiles/13/1/2.json';
 await c.activate({version,totalBytes:2,files:[{}]});
 await(await caches.open(c.cacheName(version))).put(url,new Response('[]'));
 assert.equal(await(await c.saved(url)).text(),'[]');
 assert.equal(await c.saved(url+'missing'),undefined);
});

test('worker updates app code while keeping previously downloaded map data',async()=>{
 const events={},base='https://example.test/offline-shelter-map/',version='v4444444444444444';
 await c.activate({version,totalBytes:2,files:[{}]});
 const snapshot=await caches.open(c.cacheName(version)),shell=await caches.open(c.prefix+'shell-2');
 for(const file of ['index.html','map.js','data/tile-index.json']){
  await snapshot.put(base+file,new Response('old '+file));
  await shell.put(base+file,new Response('new '+file));
 }
 const context={URL,Response,caches,OfflineCore:c,importScripts:()=>{},fetch:async()=>{throw Error('offline')},self:{location:base+'sw.js',addEventListener:(type,fn)=>events[type]=fn}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../www/sw.js'),'utf8'),context);
 async function request(file,mode='cors'){let result;events.fetch({request:{method:'GET',url:base+file,mode},respondWith:p=>result=p});return (await result).text()}
 assert.equal(await request('','navigate'),'new index.html');
 assert.equal(await request('map.js?v=31'),'new map.js');
 assert.equal(await request('data/tile-index.json'),'old data/tile-index.json');
});
