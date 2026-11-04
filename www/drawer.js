function initDrawerMotion(){
 const panel=$('#panel'),handle=$('#drawer-handle'),dialog=$('#search-drawer'),head=dialog.querySelector('.search-drawer-head');
 const launcher=$('#map-footer');
 window.setPlaceDrawer=(open,expanded=false)=>{panel.inert=!open;panel.setAttribute('aria-hidden',!open);panel.classList.toggle('drawer-hidden',!open);launcher.setAttribute('aria-expanded',open);panel.style.transform='';panel.style.height='';if(open){snapPanel(expanded);handle.focus({preventScroll:true})}else launcher.querySelector('.active')?.focus({preventScroll:true})};

 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();window.setPlaceDrawer(false)}});
 const duration=()=>matchMedia('(prefers-reduced-motion:reduce)').matches?0:280;
 let panelTimer,closing=false;
 function snapPanel(expanded){
  panel.classList.toggle('expanded',expanded);panel.style.height='';
  handle.setAttribute('aria-expanded',expanded);handle.setAttribute('aria-label',expanded?'장소 목록 줄이기':'장소 목록 펼치기');

  clearTimeout(panelTimer);panelTimer=setTimeout(()=>map.invalidateSize({pan:false}),duration()+30);
 }
 handle.onclick=()=>snapPanel(!panel.classList.contains('expanded'));

 function dragHeader(target,start,move,end){
  let gesture=null,suppressUntil=0;
  target.addEventListener('pointerdown',e=>{
   if(e.button!==0||!e.isPrimary||e.target.closest('input,a')||(target!==handle&&e.target.closest('button')))return;
   const data=start();if(!data)return;
   gesture={id:e.pointerId,y:e.clientY,lastY:e.clientY,lastTime:performance.now(),velocity:0,dy:0,moved:false,data};
   target.setPointerCapture(e.pointerId);
  });
  target.addEventListener('pointermove',e=>{
   const g=gesture;if(!g||g.id!==e.pointerId)return;
   const now=performance.now();g.dy=e.clientY-g.y;
   if(Math.abs(g.dy)>5)g.moved=true;
   if(g.moved){e.preventDefault();g.velocity=(e.clientY-g.lastY)/Math.max(1,now-g.lastTime);move(g.dy,g.data);}
   g.lastY=e.clientY;g.lastTime=now;
  });
  const finish=(e,cancelled)=>{
   const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;
   if(target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);
   if(g.moved)suppressUntil=performance.now()+400;
   end(g.dy,performance.now()-g.lastTime<100?g.velocity:0,g.data,cancelled,g.moved);
  };
  target.addEventListener('pointerup',e=>finish(e,false));
  target.addEventListener('pointercancel',e=>finish(e,true));
  target.addEventListener('lostpointercapture',e=>{if(gesture)finish(e,true)});
  target.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 }
 dragHeader(handle,()=>{
  if(panel.inert)return null;
  return {height:panel.getBoundingClientRect().height,expanded:panel.classList.contains('expanded'),min:Math.max(Math.min(425,innerHeight*.85),innerHeight*.52),max:innerHeight};
 },(dy,g)=>{panel.classList.add('is-dragging');if(dy>0){panel.style.height=g.height+'px';panel.style.transform=`translateY(${dy}px)`}else{panel.style.transform='';panel.style.height=Math.max(g.min,Math.min(g.max,g.height-dy))+'px'}},(dy,v,g,cancelled,moved)=>{
  panel.classList.remove('is-dragging');if(!moved)return;
  if(!cancelled&&(dy>80||(dy>25&&v>.65))){void panel.offsetHeight;window.setPlaceDrawer(false);return}
  panel.style.transform='';
  const expanded=cancelled?g.expanded:Math.abs(v)>.45?v<0:Math.abs(dy)>45?dy<0:panel.getBoundingClientRect().height>(g.min+g.max)/2;
  // Keep the measured drag height for one frame, then animate to a snap point.
  void panel.offsetHeight;snapPanel(expanded);
 });
 function dismiss(){
  if(closing||!dialog.open)return;closing=true;dialog.classList.remove('is-dragging');
  const from=getComputedStyle(dialog).transform;
  const animation=dialog.animate([{transform:from==='none'?'translateY(0)':from,opacity:1},{transform:`translateY(${innerHeight-dialog.getBoundingClientRect().top+30}px)`,opacity:0}],{duration:duration(),easing:'cubic-bezier(.32,0,.67,0)',fill:'forwards'});
  animation.finished.then(()=>{dialog.close();animation.cancel()}).catch(()=>{}).finally(()=>closing=false);
 }
 dragHeader(head,()=>{
  if(closing)return null;inputBlur();return {height:dialog.getBoundingClientRect().height,full:dialog.classList.contains('drawer-full')};
 },(dy,g)=>{
  dialog.classList.add('is-dragging');
  if(dy>=0){dialog.style.height=g.height+'px';dialog.style.transform=`translateY(${dy}px)`}
  else {dialog.style.transform='translateY(0)';dialog.style.height=Math.min(innerHeight*.96,g.height-dy)+'px'}
 },(dy,v,g,cancelled,moved)=>{
  dialog.classList.remove('is-dragging');if(!moved)return;
  if(!cancelled&&(dy>Math.min(130,g.height*.22)||(dy>25&&v>.65))){dismiss();return}
  dialog.classList.toggle('drawer-full',cancelled?g.full:dy < -40?true:g.full);
  void dialog.offsetHeight;dialog.style.transform='';dialog.style.height='';
 });
 function inputBlur(){if(dialog.contains(document.activeElement))document.activeElement.blur()}

 dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss()});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){e.stopImmediatePropagation();dismiss()}},true);
 dialog.addEventListener('close',()=>{dialog.style.transform='';dialog.style.height='';dialog.classList.remove('is-dragging','drawer-full')});
}

