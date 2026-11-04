function setLocationStatus(text){const el=document.querySelector('#location-status');if(el)el.textContent=text}
let locationRequestId=0;
async function requestCurrentLocation(){
 const id=++locationRequestId;locationBusy(true);setLocationStatus('위치 권한과 수신 상태를 확인하고 있습니다.');
 if(window.Android){Android.requestLocation();return}
 if(window.webkit?.messageHandlers?.location){window.webkit.messageHandlers.location.postMessage('locate');return}
 if(!window.isSecureContext||!navigator.geolocation){locationFailed('이 브라우저에서는 위치 기능을 사용할 수 없습니다. 위치를 지원하는 브라우저 또는 설치 앱을 이용해 주세요.');return}
 try{const permission=await navigator.permissions?.query({name:'geolocation'});if(permission?.state==='denied'){locationFailed('위치 권한이 차단되어 있습니다. 브라우저의 사이트 설정과 기기 위치 권한을 허용해 주세요.');return}}catch{}
 let done=false;
 const guard=setTimeout(()=>{if(done||id!==locationRequestId)return;done=true;locationFailed('위치 응답이 없습니다. 위치 권한 요청이 떠 있는지 확인하고, 기기의 위치 서비스를 켠 뒤 다시 시도해 주세요.');},35000);
 const finish=(p,error)=>{if(done||id!==locationRequestId)return;done=true;clearTimeout(guard);if(p)receiveLocation(p.coords.latitude,p.coords.longitude,p.coords.accuracy);else locationFailed(error)};
 const fail=e=>finish(null,e.code===1?'위치 접근이 거부되었습니다. 브라우저와 기기의 위치 권한을 허용해 주세요.':e.code===3?'위치 수신 시간이 초과됐습니다. 현재 브라우저에서 위치를 받지 못했습니다. 기기 위치 서비스를 확인하거나 휴대폰 설치 앱에서 다시 시도해 주세요.':'기기에서 위치를 제공하지 못했습니다. 위치 서비스를 켜고 실외에서 다시 시도해 주세요.');
 navigator.geolocation.getCurrentPosition(p=>finish(p),e=>{if(done||id!==locationRequestId)return;if(e.code===1){fail(e);return}setLocationStatus('정확한 위치 수신 지연 · 일반 위치로 다시 확인 중');navigator.geolocation.getCurrentPosition(p=>finish(p),fail,{enableHighAccuracy:false,timeout:12000,maximumAge:0})},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
