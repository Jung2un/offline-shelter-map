function initSearchDrawer(){
 const dialog=$('#search-drawer'),input=$('#drawer-query'),list=$('#search-suggestions');
 let kind='all',rows=[],timer,composing=false,limit=40;
 let recent=readLocal('recent-searches',[]);if(!Array.isArray(recent))recent=[];recent=recent.filter(x=>typeof x==='string').slice(0,6);
 const normalize=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
 const regions=[...new Set(state.places.filter(p=>p.kind!=='custom').map(p=>p.region+' '+p.district))].filter(s=>!s.includes('미기재'));
 const stations=(OfflineMap.stations||[]).map((s,i)=>({id:'station-'+i,name:s[0].endsWith('역')?s[0]:s[0]+'역',lon:s[1],lat:s[2],kind:'station',address:(s[5]?.length?s[5].map(id=>/^\d$/.test(id)?id+'호선':id).join(' · '):'철도·지하철역')}));
 const candidates=()=>[...state.places,...stations].map(p=>({p,key:normalize(p.name+' '+p.address+' '+p.district),name:normalize(p.name)}));
 function remember(q){if(!q)return;recent=[q,...recent.filter(x=>x!==q)].slice(0,6);persist('recent-searches',recent)}
 function paint(){
  const q=input.value.trim(),needle=normalize(q);$('#drawer-clear').hidden=!q;
  if(!needle){
   rows=[];$('#search-summary').textContent='';
   list.innerHTML=(recent.length?'<div class="suggestion-heading"><strong>최근 검색</strong><button id="clear-recent" class="quiet">전체 지우기</button></div><div class="recent-chips">'+recent.map((r,i)=>`<button data-recent="${i}">↶ ${esc(r)}</button>`).join('')+'</div>':'')+'<div class="suggestion-heading"><strong>지역으로 이동</strong></div><div class="quick-regions"><button data-region="서울특별시">서울<span>25개 구 →</span></button><button data-region="경기도">경기<span>31개 시·군 →</span></button></div><p class="search-hint">장소명이나 주소 일부만 입력해도 찾을 수 있어요.</p>';
   const clear=$('#clear-recent');if(clear)clear.onclick=()=>{recent=[];persist('recent-searches',[]);paint()};return;
  }
  const regional=kind==='all'?regions.filter(s=>normalize(s).includes(needle)).map(name=>({type:'region',name})):[];
  const matches=candidates().filter(x=>(kind==='all'||x.p.kind===kind)&&x.key.includes(needle));
  matches.sort((a,b)=>(b.name===needle)-(a.name===needle)||(b.name.startsWith(needle))-(a.name.startsWith(needle)));
  rows=[...regional,...matches.slice(0,limit).map(x=>({type:'place',...x.p}))];
  $('#search-summary').textContent=`${(regional.length+matches.length).toLocaleString()}개 결과${matches.length>limit?' · '+limit+'개씩 보기':''}`;
  list.innerHTML=rows.map((p,i)=>`<button class="suggestion" data-result="${i}"><span class="suggestion-symbol ${p.kind||'region'}">${p.type==='region'?'⌖':p.kind==='station'?'▣':p.kind==='mart'?cartIcon:p.kind==='custom'?'★':'⌂'}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.type==='region'?'이 지역 지도로 이동':p.address||'주소 미등록')}</small><em>${p.type==='region'?'지역':p.kind==='station'?'역':p.kind==='mart'?'마트':p.kind==='custom'?'내 장소':'대피소'}</em></span><span class="suggestion-arrow">↗</span></button>`).join('')||'<div class="search-empty"><b>검색 결과가 없어요</b><p>지역명이나 도로명으로 다시 찾아보세요.</p></div>';
  if(matches.length>limit)list.insertAdjacentHTML('beforeend','<button class="search-more" data-more="true">검색 결과 더 보기</button>');
 }
 function resetFilters(){state.query='';state.region='';$('#search').value='';$('#region').value='';$('#region-label').textContent='서울·경기 전체';state.limit=40}
 function choose(row){
  remember(input.value.trim());dialog.close();input.blur();resetFilters();window.setPlaceDrawer?.(false);
  if(row.type==='region'){
   const points=state.places.filter(p=>(p.region+' '+p.district===row.name||p.region===row.name)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
   if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[25,25],maxZoom:14});render();return;
  }
  if(row.kind==='station'){map.setView([row.lat,row.lon],16);render();toast(row.name);return}
  state.filter=row.kind==='custom'?'saved':row.kind;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===state.filter));render();showPlace(row.id);
 }
 function open(){input.value=$('#search').value;kind='all';document.querySelectorAll('[data-search-kind]').forEach(b=>{const on=b.dataset.searchKind===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});paint();dialog.showModal();input.focus()}
 $('#search').onclick=open;$('#search').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
 input.oncompositionstart=()=>composing=true;input.oncompositionend=()=>{composing=false;paint()};
 input.oninput=()=>{limit=40;if(composing)return;clearTimeout(timer);timer=setTimeout(paint,140)};
 input.onkeydown=e=>{if(e.isComposing||composing)return;if(e.key==='Enter'){e.preventDefault();clearTimeout(timer);paint();if(rows[0])choose(rows[0])}if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button')?.focus()}};
 $('#drawer-clear').onclick=()=>{input.value='';paint();input.focus()};
 document.querySelectorAll('[data-search-kind]').forEach(b=>b.onclick=()=>{limit=40;kind=b.dataset.searchKind;document.querySelectorAll('[data-search-kind]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});paint()});
 list.onclick=e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.more){limit+=40;paint();return}if(button.dataset.result!==undefined)choose(rows[+button.dataset.result]);if(button.dataset.recent!==undefined){input.value=recent[+button.dataset.recent];paint();input.focus()}if(button.dataset.region){input.value=button.dataset.region;paint();input.focus()}};
 list.onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);e.preventDefault();if(e.key==='ArrowUp'&&i<=0)input.focus();else buttons[Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus()};
 dialog.addEventListener('close',()=>{clearTimeout(timer);if(!document.querySelector('dialog[open]'))$('#search').focus()});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
}
