const cartIcon='<svg class="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h3l2.2 11h11.9l2-8H6M8 14l-1 3h12"/><circle cx="9" cy="21" r="1.2"/><circle cx="18" cy="21" r="1.2"/></svg>';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={places:[],filter:'shelter',query:'',region:'',saved:new Set(),limit:40,location:null,selected:null};
function readLocal(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function persist(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{toast('저장 공간에 기록하지 못했습니다.');return false}}
state.saved=new Set(readLocal('saved',[]));
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4500)}
function distance(a,b){if(!Number.isFinite(b.lat)||!Number.isFinite(b.lon))return Infinity;const rad=Math.PI/180;const dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;const x=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function fmt(d){if(!Number.isFinite(d))return '좌표 없음';return d<1000?Math.round(d/10)*10+'m':(d/1000).toFixed(1)+'km'}
function external(url){if(window.Android)Android.openExternal(url);else if(window.webkit?.messageHandlers?.external)window.webkit.messageHandlers.external.postMessage(url);else window.open(url,'_blank','noopener')}
function queryPlaces(visibleOnly=false){const center=state.location||{lat:map.getCenter().lat,lon:map.getCenter().lng};return state.places.filter(p=>(!visibleOnly||(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&map.getBounds().contains([p.lat,p.lon])))&&(state.filter==='saved'?state.saved.has(p.id):p.kind===state.filter)&&(!state.region||p.region===state.region)&&(!state.query||`${p.name} ${p.address} ${p.district}`.toLowerCase().includes(state.query))).map(p=>({...p,d:distance(center,p)})).sort((a,b)=>a.d-b.d)}
function render(){
 $('.panel-controls').hidden=state.filter==='saved';
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===state.filter);b.setAttribute('aria-pressed',b.dataset.filter===state.filter)});
 const items=queryPlaces(true);$('#result-count').textContent=`${state.filter==='saved'?'저장':state.filter==='mart'?'마트':'대피소'} ${items.length.toLocaleString()}곳`;
 $('#sort-label').textContent=state.location?'GPS 기준 · 직선거리':'지도 중심 기준 · 직선거리';
 $('#results').innerHTML=items.slice(0,state.limit).map(p=>`<button class="place" data-id="${esc(p.id)}" role="listitem"><span class="place-icon ${p.kind}">${p.kind==='mart'?cartIcon:p.kind==='custom'?'★':'⌂'}</span><span class="place-content"><strong>${esc(p.name)} ${state.saved.has(p.id)?'★':''}</strong><p>${esc(p.address||'주소 미등록')}</p><small>${esc(p.district)} · ${p.kind==='shelter'?'민방위 대피시설':p.kind==='custom'?'내가 추가한 장소':'마트'}${p.underground===true?' · 지하 확인':''}</small></span><span class="distance">${fmt(p.d)}</span></button>`).join('')||'<div class="empty">이 지도 안에는 해당 장소가 없습니다.<br>지도를 움직이거나 확대해 보세요.</div>';
 $('#more').hidden=items.length<=state.limit;drawMarkers(items);
}
function drawMarkers(items){
 markerLayer.clearLayers();const b=map.getBounds().pad(.05),z=map.getZoom(),groups=new Map();
 for(const p of items){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||!b.contains([p.lat,p.lon]))continue;const xy=map.project([p.lat,p.lon],z),cell=z<=12?180:z<=14?140:z<=16?100:48,key=Math.floor(xy.x/cell)+','+Math.floor(xy.y/cell);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 for(const group of groups.values()){
  const p=group[0],many=group.length>1,lat=group.reduce((s,a)=>s+a.lat,0)/group.length,lon=group.reduce((s,a)=>s+a.lon,0)/group.length;
  const marker=L.marker([lat,lon],{icon:L.divIcon({className:many?'cluster '+p.kind:'pin '+p.kind,html:many?(p.kind==='mart'?cartIcon+'<b>'+group.length+'</b>':group.length):(p.kind==='shelter'?'⌂':p.kind==='custom'?'★':cartIcon),iconSize:p.kind==='mart'?(many?[48,36]:[36,36]):many?[34,34]:[28,28],iconAnchor:p.kind==='mart'?(many?[24,18]:[18,18]):many?[17,17]:[14,14]}),title:many?`${group.length}개 장소`:p.name}).addTo(markerLayer);
  if(!many&&p.kind==='mart'&&z>=15)marker.bindTooltip(p.name,{permanent:true,direction:'bottom',offset:[0,15],className:'mart-map-label'});
  marker.on('click',()=>{if(many&&z<18)map.setView([lat,lon],Math.min(z+2,18));else if(many){state.query='';$('#search').value='';state.limit=100;window.setPlaceDrawer?.(true,true);map.panTo([lat,lon]);toast('겹친 장소는 가까운 순 목록에서 선택하세요.');render()}else showPlace(p.id)});
 }
}
function showPlace(id){
 const p=state.places.find(p=>p.id===id);if(!p)return;state.selected=p;
 window.setPlaceDrawer?.(false);
 if(selectedPlaceLayer){map.removeLayer(selectedPlaceLayer);selectedPlaceLayer=null}
 if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)){
  map.stop();map.setView([p.lat,p.lon],Math.max(17,map.getZoom()),{animate:true,duration:.45});
  selectedPlaceLayer=L.circleMarker([p.lat,p.lon],{radius:23,color:'#e32636',weight:4,fillColor:'#ff4655',fillOpacity:.2,interactive:false}).addTo(map);
  selectedPlaceLayer.bindTooltip(esc(p.name),{permanent:true,direction:'top',offset:[0,-24],className:'selected-place-label'});
 }
 if(p.kind==='custom'){showCustomPlace(p);return}
 $('#detail-kind').textContent=p.kind==='shelter'?'서울·경기 민방위 대피시설':'서울 마트';
 $('#detail-body').innerHTML=`<h2>${esc(p.name)}</h2><p class="detail-address">${esc(p.address||'주소 미등록')}</p><p class="detail-meta">${p.kind==='shelter'?(p.underground?'지하층 표기 있음':'지하층 정보 없음'):'마트·슈퍼'} · ${esc(p.updated||'자료 날짜 없음')}</p><div class="actions"><button id="save-place" class="primary">${state.saved.has(p.id)?'★ 저장 해제':'☆ 저장'}</button></div><div class="actions"><button id="naver">네이버 ↗</button><button id="kakao">카카오 ↗</button></div><p class="muted">외부 지도 연결은 인터넷이 필요합니다.</p><details><summary>출처·시설 정보</summary><dl class="facts"><dt>출처</dt><dd>${esc(p.source)}</dd><dt>원본 상태</dt><dd>${esc(p.status)}</dd><dt>좌표</dt><dd>${p.lat?.toFixed(6)??'미등록'}, ${p.lon?.toFixed(6)??'미등록'}</dd></dl><p class="muted">개방·통행 여부는 실시간으로 확인되지 않습니다. 거리는 직선거리입니다.${p.kind==='shelter'?' 핵 방호 성능을 보장하지 않습니다.':''}</p></details>`;
 $('#save-place').onclick=()=>{const next=new Set(state.saved);next.has(id)?next.delete(id):next.add(id);if(persist('saved',[...next])){state.saved=next;$('#save-place').textContent=next.has(id)?'★ 저장 해제':'☆ 저장';render()}};
 $('#naver').onclick=()=>external('https://map.naver.com/p/search/'+encodeURIComponent(p.name+' '+p.district));$('#kakao').onclick=()=>external(`https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lon}`);
 if(!Number.isFinite(p.lat)){ $('#kakao').disabled=true;$('#kakao').textContent='좌표 미등록'; } if(!$('#detail').open)$('#detail').showModal();
}
function locationBusy(busy){const button=$('#locate');button.disabled=busy;button.querySelector('span').textContent=busy?'확인 중':'내 위치'}
window.receiveLocation=(lat,lon,accuracy)=>{
 locationBusy(false);setLocationStatus(`위치 확인 완료 · 오차 약 ${Math.round(accuracy||0)}m`);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)){toast('위치를 확인하지 못했습니다. 지도를 움직여 주변을 찾을 수 있습니다.');return}
 state.location={lat,lon};if(locationLayer)map.removeLayer(locationLayer);locationLayer=L.layerGroup([L.circle([lat,lon],{radius:Math.max(accuracy||10,5),color:'#4a7cbb',fillOpacity:.1,weight:1}),L.circleMarker([lat,lon],{radius:7,color:'#fff',weight:3,fillColor:'#407ac6',fillOpacity:1})]).addTo(map);
 map.setView([lat,lon],15);render();toast(`현재 위치 확인 · 오차 약 ${Math.round(accuracy||0)}m`);
};
window.locationFailed=message=>{locationBusy(false);const text=message||'GPS 위치를 확인하지 못했습니다. 지도 중심으로 검색할 수 있습니다.';$('#locate').title=text;setLocationStatus(text);toast(text)};
let map,markerLayer,locationLayer,selectedPlaceLayer;
(async()=>{
 try{
  const result=await Promise.all([OfflineMap.init(),readJSON('data/places.json'),readJSON('data/manifest.json')]);map=result[0];state.places=result[1];const meta=result[2];markerLayer=L.layerGroup().addTo(map);
  $('#region').onchange=()=>{const v=$('#region').value;$('#region-label').textContent=v||'서울·경기 전체';state.region=v.split(' ')[0];if(v.includes(' ')){state.query=v.split(' ').slice(1).join(' ');$('#search').value=state.query}else{state.query='';$('#search').value=''}state.limit=40;const points=queryPlaces().filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[40,40],maxZoom:14});render()};
  initSearchDrawer();
  $('#clear').onclick=()=>{$('#search').value='';state.query='';render()};
  document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{state.filter=el.dataset.filter;state.limit=40;if(state.filter==='saved'){state.query='';state.region='';$('#search').value='';$('#region').value='';$('#region-label').textContent='서울·경기 전체'}window.setPlaceDrawer(true,!$('#panel').inert&&$('#panel').classList.contains('expanded'));document.querySelectorAll('[data-filter]').forEach(e=>e.classList.toggle('active',e===el));render()});
  $('#results').onclick=e=>{const el=e.target.closest('[data-id]');if(el)showPlace(el.dataset.id)};
  $('#more').onclick=()=>{state.limit+=40;render()};map.on('moveend',()=>{clearTimeout(state.moveTimer);state.moveTimer=setTimeout(()=>{state.limit=40;render()},120)});
  $('#zoom-in').onclick=()=>map.zoomIn();$('#zoom-out').onclick=()=>map.zoomOut();
  $('#locate').onclick=requestCurrentLocation;

  $('#coverage').innerHTML=`<div class="summary-grid"><div><b>${meta.counts.shelter.toLocaleString()}</b>대피시설 · 서울/경기</div><div><b>${meta.counts.mart.toLocaleString()}</b>마트 · 서울</div></div><p class="muted">수집일 ${esc(meta.collected)}<br>${esc(meta.coverageNote)}</p>`;
  $('#sources').innerHTML='<h3>데이터 출처·라이선스</h3>'+meta.sources.map(s=>`<p>${esc(s.name)} · ${esc(s.license)}<br><button class="quiet source-button" data-url="${esc(s.url)}">원본 사이트 ↗ (인터넷 필요)</button></p>`).join('');
  document.querySelectorAll('.source-button').forEach(b=>b.onclick=()=>external(b.dataset.url));
  $('#sources').insertAdjacentHTML('beforeend','<p>지도: © OpenStreetMap contributors · ODbL<br>https://www.openstreetmap.org/copyright<br>지형: Natural Earth · Public domain<br>역 위치: OpenStreetMap 수록 철도·지하철역. 누락된 역이 있을 수 있습니다.</p>');$('#info').onclick=()=>$('#about').showModal();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#start').onclick=()=>{persist('welcomed',true);$('#welcome').close()};
  initMapSettings();initCustomPins();initSafetyGuide();
  initRegionPicker();initDrawerMotion();render();document.fonts.ready.then(()=>OfflineMap.draw());
 }catch(e){console.error(e);$('#result-count').textContent='내장 파일을 불러오지 못했습니다';$('#results').innerHTML='<div class="empty">설치 파일이 손상되었을 수 있습니다. 앱을 다시 설치해 주세요. '+esc(e.message)+'</div>'}
})();
