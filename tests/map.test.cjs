const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/map.js'),'utf8');

function setup(extra={}){
 const context=vm.createContext({URL,Response,console,devicePixelRatio:1,location:{href:'https://example.test/map/'},...extra});
 vm.runInContext(source,context);
 return {context,map:vm.runInContext('OfflineMap',context),read:vm.runInContext('readJSON',context)};
}

test('map reads saved JSON without a controlling service worker or network',async()=>{
 let requested;
 const {read}=setup({caches:{},OfflineCore:{saved:async url=>{requested=url;return new Response('[1,2]')}},fetch:async()=>{throw Error('network must not be used')}});
 assert.deepEqual(Array.from(await read('data/tiles/13/1/2.json')),[1,2]);
 assert.equal(requested,'https://example.test/map/data/tiles/13/1/2.json');
});

test('missing cached JSON falls back to fetch and rejects failed responses',async()=>{
 const {read}=setup({caches:{},OfflineCore:{saved:async()=>undefined},fetch:async()=>new Response('missing',{status:503})});
 await assert.rejects(read('data/tiles/missing.json'),/파일을 읽지 못했습니다/);
});

test('one failed tile still draws available geometry, and retry clears the notice',async()=>{
 let strokes=0,fail=true;
 const ctx=new Proxy({stroke:()=>strokes++},{get:(o,k)=>o[k]||(()=>{})});
 const {map}=setup({window:{},L:{DomUtil:{setPosition:()=>{}}}});
 const bounds={getNorthWest:()=>0,getSouthEast:()=>1,getWest:()=>0,getEast:()=>2,getSouth:()=>0,getNorth:()=>2};
 map.map={getZoom:()=>15,getBounds:()=>bounds,getSize:()=>({x:300,y:600}),project:corner=>({divideBy:()=>({floor:()=>({x:corner,y:0})})}),containerPointToLayerPoint:()=>({}),latLngToContainerPoint:([y,x])=>({x,y})};
 map.hasDetail=true;map.canvas={style:{},getContext:()=>ctx};map.notice={};map.transit=[];map.stations=[];map.labels=[];
 map.tile=async key=>{if(key==='13/1/0'&&fail)throw Error('offline');return [['road','',[[0,0],[1,1]],[0,0,1,1]]]};
 await map.draw();
 assert.ok(strokes>0,'available roads must render');
 assert.equal(map.notice.hidden,false);
 assert.match(map.notice.textContent,/배경지도/);
 fail=false;
 await map.draw();
 assert.equal(map.notice.hidden,true);
});

test('failed tile requests are not retained, allowing download completion to retry',async()=>{
 let calls=0;
 const {map}=setup({fetch:async()=>{if(++calls===1)throw Error('offline');return new Response('[]')}});
 map.cache=new Map();map.pending=new Map();map.index={'13/1/2':true};
 await assert.rejects(map.tile('13/1/2'));
 assert.equal(map.pending.size,0);
 assert.equal((await map.tile('13/1/2')).length,0);
 assert.equal(calls,2);
});
