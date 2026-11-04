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
