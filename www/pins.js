let customPlaces=[],pinDraft=null,pinEditing=null;
function initCustomPins(){
 const stored=readLocal('custom-places',[]);
 customPlaces=(Array.isArray(stored)?stored:[]).filter(p=>p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>({...p,kind:'custom'}));
 state.places.push(...customPlaces);customPlaces.forEach(p=>state.saved.add(p.id));
 const start=()=>{window.setPlaceDrawer(false);document.body.classList.add('placing-pin');$('#pin-crosshair').hidden=false;$('#pin-toolbar').hidden=false;pinEditing=null;};
 const stop=()=>{document.body.classList.remove('placing-pin');$('#pin-crosshair').hidden=true;$('#pin-toolbar').hidden=true;};
 $('#add-pin').onclick=start;
 $('#pin-cancel').onclick=stop;
 $('#pin-confirm').onclick=()=>{const center=map.getCenter();pinDraft={lat:center.lat,lon:center.lng};openPinName()};
 $('#pin-name-form').onsubmit=e=>{
  e.preventDefault();const name=$('#pin-name').value.trim();if(!name){$('#pin-name').setCustomValidity('장소 이름을 입력해 주세요.');$('#pin-name').reportValidity();return}
  const p={id:pinEditing||'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),kind:'custom',name,lat:pinDraft.lat,lon:pinDraft.lon,region:'',district:'내 장소',address:'지도에서 직접 지정한 위치'};
  const next=[...customPlaces.filter(x=>x.id!==p.id),p];if(!persist('custom-places',next))return;
  customPlaces=next;state.places=state.places.filter(x=>x.id!==p.id);state.places.push(p);state.saved.add(p.id);
  $('#pin-name-dialog').close();stop();state.filter='saved';state.query='';state.region='';$('#search').value='';$('#region').value='';$('#region-label').textContent='서울·경기 전체';
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='saved'));render();showPlace(p.id);toast('내 장소를 저장했습니다.');
 };
 $('#pin-name').oninput=()=>$('#pin-name').setCustomValidity('');
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))stop()});
}
function openPinName(p){
 pinEditing=p?.id||null;if(p)pinDraft={lat:p.lat,lon:p.lon};
 $('#pin-name').value=p?.name||'';$('#pin-name').setCustomValidity('');$('#pin-name-title').textContent=p?'장소 이름 수정':'내 장소 저장';
 $('#pin-position').textContent=`위도 ${pinDraft.lat.toFixed(5)} · 경도 ${pinDraft.lon.toFixed(5)}`;
 $('#pin-name-dialog').showModal();$('#pin-name').focus();
}
function showCustomPlace(p){
 $('#detail-kind').textContent='내가 저장한 장소';
 $('#detail-body').innerHTML=`<h2>${esc(p.name)}</h2><p class="detail-address">지도에서 직접 지정한 위치</p><p class="muted">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</p><div class="actions"><button id="rename-pin" class="primary">이름 수정</button><button id="delete-pin">저장 삭제</button></div>`;
 $('#rename-pin').onclick=()=>{$('#detail').close();openPinName(p)};
 $('#delete-pin').onclick=()=>{const next=customPlaces.filter(x=>x.id!==p.id);if(!persist('custom-places',next))return;customPlaces=next;state.places=state.places.filter(x=>x.id!==p.id);state.saved.delete(p.id);if(selectedPlaceLayer){map.removeLayer(selectedPlaceLayer);selectedPlaceLayer=null}$('#detail').close();render();toast('저장한 장소를 삭제했습니다.')};
 if(!$('#detail').open)$('#detail').showModal();
}
