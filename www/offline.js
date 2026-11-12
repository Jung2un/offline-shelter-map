(async function(){
 const native=!!(window.Android||window.webkit?.messageHandlers?.location);
 window.isNativeOfflineApp=native;
 const q=s=>document.querySelector(s),status=q('#download-status'),note=q('#download-note'),start=q('#download-start'),pause=q('#download-pause'),verify=q('#download-verify'),progress=q('#download-progress');
 const setStatus=s=>{status.textContent=s;q('#offline-state').textContent=s};
 if(native){q('#offline-download').hidden=true;setStatus('오프라인 사용 가능');return}
 q('#offline-help-text').textContent='아이폰은 Safari 공유 → 홈 화면에 추가 후, 추가한 앱에서 전체 지도를 저장하세요. 처음 다운로드할 때 인터넷이 필요합니다.';
 let busy=false,controller=null,manifest=null;
 const base=new URL('./',location.href),size=n=>(n/1024/1024).toFixed(0)+' MB';
 function controls(running,verifyOnly=false){busy=running;start.disabled=running;verify.disabled=running;pause.hidden=!running||verifyOnly;q('#verify-pause').hidden=!running||!verifyOnly}
 function update(done,bytes,m,verifyOnly,reused,downloaded,progress,note){progress.max=m.files.length;progress.value=done;note.textContent=verifyOnly?`인터넷 사용 없이 저장된 파일 확인 중 · ${done.toLocaleString()} / ${m.files.length.toLocaleString()}개 확인. 파일을 다운로드하거나 수정하지 않습니다.`:`${done.toLocaleString()} / ${m.files.length.toLocaleString()}개 준비 · 기존 파일 ${reused.toLocaleString()}개 재사용 · 새로 받은 파일 ${downloaded.toLocaleString()}개 (${size(bytes)}). 화면을 열어 두세요.`}
 async function getManifest(network=true){
  let r;
  if(network)try{r=await fetch(new URL('offline-manifest.json?offline-network=1',base),{cache:'no-store',signal:controller?.signal})}catch(e){if(e.name==='AbortError')throw e}
  if(!r?.ok)r=await fetch(new URL('offline-manifest.json',base));
  if(!r.ok)throw Error('다운로드 목록을 불러오지 못했습니다. 인터넷을 확인하세요.');
  return OfflineCore.validateManifest(await r.json());
 }
 async function inspect(){
  const a=await OfflineCore.active();
  if(!a){setStatus('오프라인 지도 저장 필요');note.textContent='전체 지도 약 730MB · Wi-Fi에서 다운로드하세요. 중단해도 이어받을 수 있습니다.';return}
  const c=await caches.open(OfflineCore.cacheName(a.version));
  const mr=await c.match(new URL('offline-manifest.json',base));
  if(!mr){setStatus('저장 상태 확인 필요');return}
  const m=OfflineCore.validateManifest(await mr.json());const keys=new Set((await c.keys()).map(r=>r.url));
  const complete=m.files.every(f=>keys.has(new URL(f.path,base).href));
  setStatus(complete?'오프라인 준비 완료':'일부 파일 누락 · 이어받기 필요');
  progress.hidden=complete;progress.max=m.files.length;progress.value=m.files.filter(f=>keys.has(new URL(f.path,base).href)).length;
  note.textContent=complete?`${m.files.length.toLocaleString()}개 저장 · ${size(m.totalBytes)}. 추가 검사 없이 사용할 수 있습니다. 지도가 보이지 않을 때 아래 ‘저장된 지도 확인’을 이용하세요.`:'다운로드를 누르면 빠진 파일을 다시 받습니다.';
  start.textContent='이어받기 / 업데이트 확인';
 }
 async function run(verifyOnly){
  if(busy)return;
  const progress=q(verifyOnly?'#verify-progress':'#download-progress'),note=q(verifyOnly?'#verify-note':'#download-note');
  const setStatus=verifyOnly?s=>{q('#verify-status').textContent=s}:s=>{status.textContent=s;q('#offline-state').textContent=s};
  controls(true,verifyOnly);controller=new AbortController();progress.hidden=false;progress.value=0;progress.setAttribute('aria-label',verifyOnly?'저장된 지도 확인 진행률':'지도 저장 진행률');pause.textContent=verifyOnly?'검사 중지':'일시중지';
  try{
   await navigator.serviceWorker.ready;
   const action=async()=>{
    setStatus(verifyOnly?'저장 파일 검사 중':'다운로드 준비 중');
    if(verifyOnly){const a=await OfflineCore.active();if(!a)throw Error('먼저 지도 다운로드를 완료하세요.');const r=await(await caches.open(OfflineCore.cacheName(a.version))).match(new URL('offline-manifest.json',base));if(!r)throw Error('저장 목록이 없습니다. 이어받기를 실행하세요.');manifest=OfflineCore.validateManifest(await r.json())}
    else manifest=await getManifest();
    const m=manifest,c=await caches.open(OfflineCore.cacheName(m.version)),sources=verifyOnly?[]:await OfflineCore.reuseSources(m.version);
    if(!verifyOnly){
     if(navigator.storage?.persist)await navigator.storage.persist();
     const estimate=await navigator.storage?.estimate?.();const keys=new Set((await c.keys()).map(r=>r.url));
     const needed=m.files.filter(f=>!keys.has(new URL(f.path,base).href)).reduce((n,f)=>n+f.bytes,0);
     if(estimate?.quota&&estimate.quota-estimate.usage<needed*1.1)throw Error('저장 공간이 부족합니다. 여유 공간을 확보한 뒤 다시 시도하세요.');
    }
    setStatus(verifyOnly?'저장된 지도 확인 중 · 다운로드 아님':'기존 파일 확인 및 지도 저장 중');
    let done=0,bytes=0,cursor=0,reused=0,downloaded=0;const failures=[];
    async function worker(){while(cursor<m.files.length&&!controller.signal.aborted){const f=m.files[cursor++],url=new URL(f.path,base);try{
     if(verifyOnly){if(!await OfflineCore.valid(await c.match(url),f))throw Error('파일 검사 실패: '+f.path)}
     else{
      const result=await OfflineCore.prepareFile(c,sources,url,f,()=>{const u=new URL(url);u.searchParams.set('offline-network','1');return fetch(u,{cache:'no-store',signal:controller.signal})});
      if(result==='reused')reused++;else{downloaded++;bytes+=f.bytes}
     }
     done++;update(done,bytes,m,verifyOnly,reused,downloaded,progress,note);
    }catch(e){if(e.name==='AbortError')break;if(e.name==='QuotaExceededError'){controller.abort();throw Error('저장 공간이 부족합니다. 공간 확보 후 이어받아 주세요.')}failures.push(f.path)}}}
    const results=await Promise.allSettled([worker(),worker(),worker()]);
    const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
    if(controller.signal.aborted){setStatus(verifyOnly?'검사 중지':'다운로드 일시중지');note.textContent=verifyOnly?'저장된 지도는 변경하지 않았습니다. 필요할 때 다시 검사할 수 있습니다.':'완료한 파일은 보관됩니다. 다운로드를 눌러 이어받으세요.';return}
    if(failures.length)throw Error(`${failures.length}개 파일이 누락되었거나 확인되지 않았습니다. 인터넷 연결 후 ‘이어받기 / 업데이트 확인’을 누르면 정상 파일은 재사용하고 필요한 파일만 받습니다.`);
    if(verifyOnly){progress.hidden=true;setStatus('검사 완료 · 저장된 지도 정상');note.textContent=`${m.files.length.toLocaleString()}개 파일을 확인했습니다. 다운로드하거나 변경한 파일은 없습니다. 오프라인으로 사용할 수 있습니다.`;return}
    await c.put(new URL('offline-manifest.json',base),new Response(JSON.stringify(m),{headers:{'Content-Type':'application/json'}}));
    await OfflineCore.activate(m);
    window.dispatchEvent(new Event('offline-map-ready'));
    progress.hidden=true;setStatus('지도 저장 완료 · 오프라인 사용 가능');note.textContent=`기존 파일 ${reused.toLocaleString()}개 재사용 · 새로 받은 파일 ${downloaded.toLocaleString()}개 (${size(bytes)}). 저장하면서 파일 확인까지 마쳤으므로 추가 검사 없이 사용할 수 있습니다. 비행기 모드에서 앱을 다시 열어 확인해 보세요.`;
    start.textContent='이어받기 / 업데이트 확인';
    // Retain the previous complete snapshot until a future explicit storage cleanup.
   };
   if(navigator.locks)await navigator.locks.request(OfflineCore.prefix+'download',{ifAvailable:true},async lock=>{if(!lock)throw Error('다른 창에서 다운로드 중입니다. 해당 창에서 진행해 주세요.');await action()});else await action();
  }catch(e){setStatus(controller?.signal.aborted&&e.name==='AbortError'?'다운로드 일시중지':'저장 확인 필요');note.textContent=e.message||'다시 시도해 주세요.'}
  finally{controls(false);controller=null}
 }
 start.onclick=()=>run(false);verify.onclick=()=>run(true);pause.onclick=q('#verify-pause').onclick=()=>controller?.abort();
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
 if(!isSecureContext||!('serviceWorker'in navigator)||!('caches'in window)){setStatus('HTTPS 주소로 접속해 주세요');note.textContent='이 브라우저에서는 오프라인 저장을 사용할 수 없습니다.';start.disabled=true;verify.disabled=true;return}
 start.disabled=true;verify.disabled=true;
 try{await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname});await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('저장 기능 준비 시간이 초과되었습니다.')),90000))]);start.disabled=false;verify.disabled=false;await inspect()}
 catch(e){setStatus('오프라인 준비 실패');note.textContent='인터넷 연결 후 앱을 다시 열어 주세요. '+e.message}
})();
