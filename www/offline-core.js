/* Shared by the page and worker. Cache names are scoped to this app URL. */
(function(root){
 const prefix='shelter-'+new URL('.',root.location.href).pathname.replace(/[^a-z0-9]/gi,'_')+'-';
 const meta=prefix+'meta',pointer=new URL('__offline_active__',new URL('.',root.location.href)).href;
 const cacheName=v=>prefix+'data-'+v;
 async function digest(buffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('')}
 async function valid(response,file){if(!response||!response.ok)return false;const b=await response.clone().arrayBuffer();return b.byteLength===file.bytes&&await digest(b)===file.sha256}
 async function active(){const r=await(await caches.open(meta)).match(pointer);return r?await r.json():null}
 async function activate(manifest){await(await caches.open(meta)).put(pointer,new Response(JSON.stringify({version:manifest.version,totalBytes:manifest.totalBytes,count:manifest.files.length}),{headers:{'Content-Type':'application/json'}}))}
 // Read the completed snapshot directly, including before a worker controls the page.
 async function saved(url){const a=await active();if(!a)return null;return (await caches.open(cacheName(a.version))).match(url)}
 // Reuse only this app's snapshots, including interrupted downloads.
 async function reuseSources(version){
  const target=cacheName(version),names=await caches.keys();
  return Promise.all(names.filter(n=>n!==target&&n.startsWith(prefix+'data-')&&/^v[0-9a-f]{16}$/.test(n.slice((prefix+'data-').length))).map(n=>caches.open(n)));
 }
 async function prepareFile(cache,sources,url,file,download){
  if(await valid(await cache.match(url),file))return 'reused';
  for(const source of sources){
   const r=await source.match(url);
   if(await valid(r,file)){await cache.put(url,r);if(!await valid(await cache.match(url),file))throw Error('저장 파일 확인 실패: '+file.path);return 'reused'}
  }
  const r=await download();
  if(!await valid(r,file))throw Error('파일 검사 실패: '+file.path);
  await cache.put(url,r);
  if(!await valid(await cache.match(url),file))throw Error('저장 파일 확인 실패: '+file.path);
  return 'downloaded';
 }
 function validateManifest(m){if(!m||!/^v[0-9a-f]{16}$/.test(m.version)||!Array.isArray(m.files)||!m.files.length)throw Error('다운로드 목록이 올바르지 않습니다.');const seen=new Set();for(const f of m.files){if(!/^[a-zA-Z0-9_./-]+$/.test(f.path)||f.path.startsWith('/')||f.path.split('/').includes('..')||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error('잘못된 자산 목록');seen.add(f.path)}if(!seen.has('index.html'))throw Error('첫 화면 파일 누락');return m}
 root.OfflineCore={prefix,meta,pointer,cacheName,digest,valid,active,activate,saved,reuseSources,prepareFile,validateManifest};
})(globalThis);
