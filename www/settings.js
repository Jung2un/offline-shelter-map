function initMapSettings(){
 const dialog=$('#about'),allIds=OfflineMap.transit.map(l=>l.id);
 const saved=readLocal('transit-lines',null);
 OfflineMap.selectedLines=Array.isArray(saved)?new Set(saved.filter(id=>allIds.includes(id))):null;
 let draft=new Set();
 function paint(){
  $('#transit-lines').innerHTML=OfflineMap.transit.map(l=>`<button class="line-choice ${draft.has(l.id)?'selected':''}" data-line="${esc(l.id)}" aria-pressed="${draft.has(l.id)}"><i style="background:${l.color}"></i><span>${esc(l.name)}</span><b aria-hidden="true">${draft.has(l.id)?'✓':''}</b></button>`).join('');
  $('#line-count').textContent=draft.size===allIds.length?'전체 노선':draft.size?`${draft.size}개 노선 선택`:'지하철 숨김';
  $('#lines-all').textContent=draft.size===allIds.length?'전체 해제':'전체 선택';
 }
 $('#info').onclick=()=>{draft=new Set(OfflineMap.selectedLines===null?allIds:OfflineMap.selectedLines);paint();dialog.showModal()};
 $('#transit-lines').onclick=e=>{const b=e.target.closest('[data-line]');if(!b)return;draft.has(b.dataset.line)?draft.delete(b.dataset.line):draft.add(b.dataset.line);paint()};
 $('#lines-all').onclick=()=>{draft=new Set(draft.size===allIds.length?[]:allIds);paint()};
 $('#lines-save').onclick=()=>{if(!persist('transit-lines',[...draft]))return;OfflineMap.selectedLines=new Set(draft);OfflineMap.draw();dialog.close();toast('지도 설정을 저장했습니다.')};
 $('#location-retry').onclick=requestCurrentLocation;
 OfflineMap.draw();
}
