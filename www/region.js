function initRegionPicker(){
 const dialog=$('#region-dialog'),query=$('#region-query'),options=$('#region-options');
 const districts=[...new Set(state.places.filter(p=>p.kind!=='custom').map(p=>p.region+' '+p.district))].filter(d=>!d.includes('미기재')).sort();
 const entries=[['','서울·경기 전체'],['서울특별시','서울 전체'],['경기도','경기 전체'],...districts.map(d=>[d,d.replace('서울특별시 ','서울 · ').replace('경기도 ','경기 · ')])];
 function paint(){
  const term=query.value.replace(/\s/g,'').toLowerCase();
  options.innerHTML=entries.filter(([value,label])=>(value+label).replace(/\s/g,'').toLowerCase().includes(term)).map(([value,label])=>`<button type="button" class="region-option ${$('#region').value===value?'selected':''}" data-region-value="${esc(value)}" aria-pressed="${$('#region').value===value}"><span>${esc(label)}</span><span aria-hidden="true">${$('#region').value===value?'✓':''}</span></button>`).join('')||'<p class="region-empty">일치하는 지역이 없습니다.</p>';
  options.scrollTop=0;
 }
 $('#region-picker').onclick=()=>{query.value='';paint();dialog.showModal();query.focus()};
 query.oninput=paint;
 query.onkeydown=e=>{if(e.isComposing)return;if(e.key==='ArrowDown'){e.preventDefault();options.querySelector('button')?.focus()}if(e.key==='Enter'){e.preventDefault();options.querySelector('button')?.click()}};
 options.onclick=e=>{const b=e.target.closest('[data-region-value]');if(!b)return;$('#region').value=b.dataset.regionValue;$('#region').onchange();dialog.close()};
 options.onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const buttons=[...options.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),next=i+(e.key==='ArrowDown'?1:-1);if(next<0)query.focus();else buttons[Math.min(next,buttons.length-1)]?.focus()};
 $('#region-done').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>$('#region-picker').focus({preventScroll:true}));
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
}
