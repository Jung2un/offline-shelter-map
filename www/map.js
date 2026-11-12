/* Local data only. No remote tile server or map SDK is used. */
const DATA_ROOT='data/';
async function readJSON(path){
 // Cache Storage is also available to the page when Safari has no controlling worker yet.
 if(globalThis.OfflineCore&&'caches'in globalThis){
  try{const saved=await OfflineCore.saved(new URL(path,location.href).href);if(saved?.ok)return await saved.json()}catch(e){console.warn('저장 파일 읽기 실패:',path,e)}
 }
 const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('파일을 읽지 못했습니다: '+path);return r.json();
}
const OfflineMap={
 async init(){
  this.map=L.map('map',{zoomControl:false,attributionControl:true,minZoom:6,maxZoom:18,preferCanvas:true,maxBounds:[[32.7,123.8],[39,132.2]],maxBoundsViscosity:.8}).setView([37.5665,126.978],15);
  this.map.attributionControl.setPrefix(false);this.map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>');
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(this.map);
  const [land,index,labels,stations,transit]=await Promise.all([readJSON(DATA_ROOT+'land.geojson'),readJSON(DATA_ROOT+'tile-index.json'),readJSON(DATA_ROOT+'labels.json'),readJSON(DATA_ROOT+'stations.json'),readJSON(DATA_ROOT+'transit.json')]);this.stations=stations;this.transit=transit.lines;this.lineColors=Object.fromEntries(this.transit.map(l=>[l.id,l.color]));this.selectedLines=null;
  L.geoJSON(land,{interactive:false,style:f=>({color:'#a0bec6',weight:1,fillColor:f.properties.code==='KOR'?'#eceeea':'#e2e7df',fillOpacity:1})}).addTo(this.map);
  this.index=index;this.hasDetail=Object.keys(index).some(k=>k.startsWith('13/'));this.labels=labels;this.cache=new Map();this.pending=new Map();this.layer=L.layerGroup().addTo(this.map);
  this.map.createPane('localCanvas');this.map.getPane('localCanvas').style.zIndex='450';this.map.getPane('localCanvas').style.pointerEvents='none';
  this.canvas=L.DomUtil.create('canvas','offline-canvas',this.map.getPane('localCanvas'));this.canvas.style.position='absolute';
  this.notice=L.DomUtil.create('div','map-load-status',document.querySelector('#map-wrap'));this.notice.hidden=true;this.notice.setAttribute('role','status');
  const retry=()=>this.draw();window.addEventListener('offline-map-ready',retry);window.addEventListener('online',retry);
  navigator.serviceWorker?.addEventListener('controllerchange',retry);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')retry()});
  this.map.on('moveend resize',()=>this.draw());this.map.on('zoomstart',()=>{this.canvas.style.visibility='hidden'});
  this.map.on('zoomend',()=>{this.canvas.style.visibility='visible'});await this.draw();setTimeout(()=>this.map.attributionControl.getContainer().classList.add('credit-collapsed'),5000);return this.map;
 },
 async tile(key){
  if(this.cache.has(key))return this.cache.get(key);
  if(!this.index[key])return [];
  if(!this.pending.has(key))this.pending.set(key,readJSON(DATA_ROOT+'tiles/'+key+'.json').then(a=>{for(const f of a){if(!f[3]){let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;for(const [lon,lat] of f[2]){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat)}f[3]=[west,south,east,north]}}this.cache.set(key,a);while(this.cache.size>180)this.cache.delete(this.cache.keys().next().value);return a}).finally(()=>this.pending.delete(key)));
  return this.pending.get(key);
 },
 async draw(){
  const generation=(this.generation||0)+1;this.generation=generation;
  const m=this.map,z=m.getZoom(),base=z<12?7:(this.hasDetail?13:10),b=m.getBounds(),size=m.getSize(),dpr=Math.min(devicePixelRatio||1,2);
  const nw=m.project(b.getNorthWest(),base).divideBy(256).floor(),se=m.project(b.getSouthEast(),base).divideBy(256).floor();
  const keys=[];for(let x=nw.x;x<=se.x;x++)for(let y=nw.y;y<=se.y;y++)keys.push(`${base}/${x}/${y}`);
  try{
   const results=await Promise.allSettled(keys.map(k=>this.tile(k)));if(this.generation!==generation)return;
   const parts=results.filter(r=>r.status==='fulfilled').map(r=>r.value),missing=results.filter(r=>r.status==='rejected').length;
   this.notice.hidden=!missing;
   this.notice.textContent=missing?'일부 배경지도를 불러오지 못했습니다. 인터넷 연결 후 설정 → 이어받기 / 업데이트 확인을 실행하세요.':'';
   // Draw the available area even if one tile is missing; never discard every tile.

   const c=this.canvas;c.width=size.x*dpr;c.height=size.y*dpr;c.style.width=size.x+'px';c.style.height=size.y+'px';L.DomUtil.setPosition(c,m.containerPointToLayerPoint([0,0]));
   const ctx=c.getContext('2d');ctx.scale(dpr,dpr);ctx.lineCap='round';ctx.lineJoin='round';
   const features=parts.flat().filter(f=>{const q=f[3];return !q||(!(q[2]<b.getWest()||q[0]>b.getEast()||q[3]<b.getSouth()||q[1]>b.getNorth())&&(z>=12||Math.max(q[2]-q[0],(q[3]-q[1])*1.3)*256*2**z/360>1.5))}),order={park:0,lake:1,water:2,coast:3,road:4,major:5,rail:6};features.sort((a,b)=>order[a[0]]-order[b[0]]);
   const seen=new Set(),roadLabels=[];
   for(const [kind,name,coords] of features){
    const id=kind+coords[0]+coords[coords.length-1]+coords.length;if(seen.has(id))continue;seen.add(id);
    if(z<12&&kind==='road')continue;if(z<13&&kind==='rail')continue;
    const pts=coords.map(([lon,lat])=>m.latLngToContainerPoint([lat,lon]));ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    const widths={road:z>=16?3:z>=14?1.9:1,major:z>=15?6:z>=12?3:1.6,water:z>=14?3:1.8,coast:1,rail:1,park:1,lake:1};
    const colors={road:'#ffffff',major:'#ffe6a2',water:'#91c9de',coast:'#91becd',rail:'#839cb2',park:'#bed9ac',lake:'#9acfe2'};
    if(kind==='road'||kind==='major'){ctx.setLineDash([]);ctx.strokeStyle=kind==='major'?'#d6bb78':'#d3d8d2';ctx.lineWidth=widths[kind]+(z>=14?1.7:1);ctx.stroke();}
    ctx.strokeStyle=colors[kind];ctx.lineWidth=widths[kind]||1;ctx.setLineDash(kind==='rail'?[4,4]:[]);
    if(kind==='lake'||kind==='park'){ctx.fillStyle=colors[kind];if(coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1])ctx.fill();}ctx.stroke();
    if(name&&!/^\d+$/.test(name)&&z>=15&&['major','road'].includes(kind)&&pts.length>1)roadLabels.push([name,pts[Math.floor(pts.length/2)]]);
   }
   ctx.setLineDash([]);
   if(z>=10)for(const line of this.transit){if(this.selectedLines&&!this.selectedLines.has(line.id))continue;for(const [q,coords] of line.paths){if(q[2]<b.getWest()||q[0]>b.getEast()||q[3]<b.getSouth()||q[1]>b.getNorth())continue;ctx.beginPath();coords.forEach(([lon,lat],i)=>{const p=m.latLngToContainerPoint([lat,lon]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.strokeStyle='#ffffffdd';ctx.lineWidth=z>=14?6:4;ctx.stroke();ctx.strokeStyle=line.color;ctx.lineWidth=z>=14?3.5:2.5;ctx.stroke()}}
   const boxes=[];
   const label=(text,p,font,color)=>{ctx.font=font;const w=ctx.measureText(text).width;const box=[p.x-w/2-7,p.y-10,w+14,22];if(p.x<20||p.x>size.x-20||p.y<10||p.y>size.y-10||boxes.some(b=>box[0]<b[0]+b[2]&&box[0]+box[2]>b[0]&&box[1]<b[1]+b[3]&&box[1]+box[3]>b[1]))return;boxes.push(box);ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#f5f5eedd';ctx.strokeText(text,p.x,p.y);ctx.fillStyle=color;ctx.fillText(text,p.x,p.y)};
   if(z>=14)for(const [name,lon,lat,kind,network,members=[]] of this.stations){
    if(!b.contains([lat,lon])||(this.selectedLines&&!members.some(id=>this.selectedLines.has(id))))continue;
    const p=m.latLngToContainerPoint([lat,lon]),colors=members.length?members.map(id=>this.lineColors[id]||'#3877a6'):['#8394a0'];
    ctx.beginPath();ctx.arc(p.x,p.y,members.length>1?6:5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    colors.forEach((color,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,members.length>1?6:5,Math.PI*2*i/colors.length,Math.PI*2*(i+1)/colors.length);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke()});
    const title=(name.endsWith('역')?name:name+'역')+(members.length?' · '+members.join('·'):'');
    label(title,{x:p.x,y:p.y-13},'650 12px Pretendard',members.length===1?colors[0]:'#304d60');
   }
   for(const [name,lon,lat,kind] of this.labels){if(!b.contains([lat,lon])||(z<9&&kind!=='city')||(z<12&&kind==='village'))continue;label(name,m.latLngToContainerPoint([lat,lon]),`${kind==='city'?650:500} ${z<10?13:12}px Pretendard`,'#576a58')}
   for(const [name,p] of roadLabels)label(name,p,'11px Pretendard','#747464');
   if(window.isNativeOfflineApp)document.querySelector('#offline-state').textContent='오프라인 사용 가능';
  }catch(e){this.notice.hidden=false;this.notice.textContent='배경지도를 표시하지 못했습니다. 설정에서 저장된 지도 확인을 실행해 주세요.';console.error(e)}
 }
};
