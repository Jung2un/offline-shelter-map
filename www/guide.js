function initSafetyGuide(){
 const dialog=$('#safety-guide');
 const groups=[
  ['집에 보관','우선 3일분부터 준비하고, 보관 공간과 가족 사정에 맞춰 늘리세요. 국내 비상대비 안내는 장기 비축도 권고합니다.',[
   ['water','생수','1인 하루 약 4L × 최소 3일 (음용·기본 위생용). 1명 약 12L, 2명 약 24L. 더위·수유·건강 상태에 따라 추가.'],
   ['food','불 없이 먹는 식품','통조림, 견과류, 에너지바, 상온 보관 식품. 가족이 평소 먹는 음식으로 최소 3일분. 수동 캔따개도 준비.'],
   ['hygiene','위생용품','비누, 물티슈, 휴지, 생리용품, 쓰레기봉투와 여벌 옷.'],
   ['family','가족별 필수품','분유·기저귀, 안경, 보조기기, 반려동물의 물·사료·이동장.']]],
  ['바로 들고 나갈 가방','집의 비축품 전체를 넣지 말고 실제로 메고 걸을 수 있는 무게로 준비하세요.',[
   ['carry','휴대할 물과 간편식','생수와 바로 먹을 식품을 휴대 가능한 만큼 따로 담기.'],
   ['medicine','평소 복용약·구급용품','처방약과 복용 목록, 밴드·거즈·붕대. 필요한 약의 여분과 보관법은 의료진·약사에게 확인.'],
   ['light','손전등·라디오','건전지식 손전등 또는 헤드램프, 휴대용 라디오, 여분 건전지.'],
   ['power','충전 수단','충전된 보조배터리와 휴대전화 케이블.'],
   ['clothes','보온·보호용품','계절에 맞는 겉옷, 우비, 튼튼한 신발, 장갑, 방진 마스크.'],
   ['papers','연락처·서류·현금','종이에 적은 가족 연락처·만날 장소, 신분증 사본과 소액 현금. 방수 봉투에 보관.']]],
  ['준비 후 점검','한꺼번에 사재기하기보다 평소 쓰는 물품을 조금씩 준비하세요.',[
   ['rotate','유통기한·충전 상태 확인','평소 먹고 쓰면서 교체하고, 가족 모두 가방 보관 위치를 알아두기.'],
   ['meeting','대피 장소와 연락 계획','가까운 대피소를 미리 확인하고 가족이 헤어졌을 때 만날 장소를 정하기.']]]
 ];
 const raw=readLocal('emergency-kit-v1',[]),checked=new Set(Array.isArray(raw)?raw:[]);
 const briefs={water:'1인 약 12L · 3일분',food:'최소 3일분 · 수동 캔따개',hygiene:'비누 · 휴지 · 생리용품',family:'아기 · 반려동물 용품 등',carry:'들고 걸을 수 있는 만큼',medicine:'복용약 · 밴드 · 거즈',light:'손전등 · 라디오 · 건전지',power:'보조배터리 · 케이블',clothes:'겉옷 · 장갑 · 방진 마스크',papers:'가족 연락처 · 신분증 사본',rotate:'유통기한 · 배터리 확인',meeting:'대피소 · 만날 장소 정하기'};
 $('#kit-list').innerHTML=groups.map(([title,note,items])=>`<section class="guide-group"><h3>${title}</h3>${items.map(([id,title,note])=>`<div class="kit-row"><label class="kit-item"><input type="checkbox" data-kit="${id}" ${checked.has(id)?'checked':''}><span><b>${title}</b><small>${briefs[id]}</small></span></label><details class="kit-detail"><summary aria-label="${title} 자세히">자세히</summary><p>${note}</p></details></div>`).join('')}</section>`).join('');
 const count=()=>$('#kit-progress').textContent=`준비 ${document.querySelectorAll('[data-kit]:checked').length} / ${document.querySelectorAll('[data-kit]').length}`;count();
 $('#kit-list').onchange=e=>{const id=e.target.dataset.kit;if(!id)return;const next=new Set(checked);e.target.checked?next.add(id):next.delete(id);if(persist('emergency-kit-v1',[...next])){checked.clear();next.forEach(v=>checked.add(v))}else e.target.checked=checked.has(id);count()};
 const resetDanger=()=>{$('#danger-menu').hidden=false;$('#danger-back').hidden=true;document.querySelectorAll('[data-danger-detail]').forEach(x=>x.hidden=true);$('#guide-scroll').scrollTop=0};
 const selectTab=kit=>{$('#guide-actions').hidden=kit;$('#guide-kit').hidden=!kit;document.querySelectorAll('[data-guide-tab]').forEach(x=>x.setAttribute('aria-pressed',(x.dataset.guideTab==='kit')===kit));if(!kit)resetDanger();$('#guide-scroll').scrollTop=0};
 $('#guide-open').onclick=()=>{selectTab(false);dialog.showModal()};
 document.querySelectorAll('[data-guide-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.guideTab==='kit'));
 document.querySelectorAll('[data-danger]').forEach(b=>b.onclick=()=>{$('#danger-menu').hidden=true;$('#danger-back').hidden=false;document.querySelectorAll('[data-danger-detail]').forEach(x=>x.hidden=x.dataset.dangerDetail!==b.dataset.danger);$('#guide-scroll').scrollTop=0;$('#danger-back').focus({preventScroll:true})});
 $('#danger-back').onclick=()=>{resetDanger();document.querySelector('[data-danger]').focus({preventScroll:true})};
 $('#guide-shelters').onclick=()=>{dialog.close();document.querySelector('[data-filter="shelter"]').click()};
 document.querySelectorAll('[data-guide-source]').forEach(b=>b.onclick=()=>external(b.dataset.guideSource));
}
