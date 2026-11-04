const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=readFileSync(resolve(__dirname,'../www/app.js'),'utf8').split('(async()=>{')[0];
const storage=new Map();const context=vm.createContext({console,setTimeout,clearTimeout,window:{},document:{querySelector:()=>({style:{}})},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
vm.runInContext(code,context);
vm.runInContext('map={getCenter:()=>({lat:37.5665,lng:126.978})}',context);
const api=vm.runInContext('({state,distance,fmt,esc,queryPlaces,persist})',context);
const {state,distance,fmt,esc,queryPlaces}=api;
assert.equal(distance({lat:37,lon:127},{lat:37,lon:127}),0);
assert.equal(distance({lat:37,lon:127},{lat:null,lon:null}),Infinity);
assert.equal(fmt(Infinity),'좌표 없음');
assert.ok(Math.abs(distance({lat:0,lon:0},{lat:0,lon:1})-111195)<20);
assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
state.places=[
 {id:'a',kind:'shelter',region:'서울특별시',district:'중구',name:'시청 지하',address:'서울 중구',lat:37.5665,lon:126.978},
 {id:'b',kind:'shelter',region:'경기도',district:'수원시',name:'수원 대피소',address:'경기도 수원시',lat:37.27,lon:127.01},
 {id:'c',kind:'shelter',region:'서울특별시',district:'중구',name:'좌표 없는 시설',address:'서울 중구',lat:null,lon:null},
 {id:'d',kind:'mart',region:'서울특별시',district:'중구',name:'동네마트',address:'서울 중구',lat:37.565,lon:126.977}
];
assert.equal(queryPlaces()[0].id,'a');assert.equal(queryPlaces().at(-1).id,'c');
state.query='수원';assert.equal(queryPlaces().length,1);assert.equal(queryPlaces()[0].id,'b');
state.query='';state.region='서울특별시';assert.equal(queryPlaces().length,2);
state.filter='mart';assert.equal(queryPlaces()[0].id,'d');
state.saved.add('b');state.region='';state.filter='saved';assert.equal(queryPlaces().length,1);
assert.equal(queryPlaces()[0].id,'b');
state.filter='shelter';state.location={lat:37.27,lon:127.01};assert.equal(queryPlaces()[0].id,'b');
state.query='없는검색어';assert.equal(queryPlaces().length,0);
assert.ok(api.persist('saved',['b']));assert.equal(storage.get('saved'),'["b"]');
vm.runInContext('map.getBounds=()=>({contains:([lat,lon])=>lat>37.55&&lat<37.58&&lon>126.96&&lon<126.99})',context);
state.query='';state.region='';state.filter='shelter';
assert.deepEqual(Array.from(queryPlaces(true),p=>p.id),['a']);
assert.equal(queryPlaces(false).length,3);
vm.runInContext('map.getBounds=()=>({contains:([lat])=>lat>37.26&&lat<37.28})',context);
assert.deepEqual(Array.from(queryPlaces(true),p=>p.id),['b']);
console.log('PASS: missing coordinates, distance, text escaping, region/search filters, favorites, GPS sorting, local persistence.');
