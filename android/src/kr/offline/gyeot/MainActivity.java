package kr.offline.gyeot;
import android.app.Activity;
import android.os.Bundle;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.*;
import android.net.Uri;
import android.webkit.*;
import android.os.Handler;
import android.os.Looper;
import java.io.*;
import java.util.*;

public class MainActivity extends Activity {
 private WebView web;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private LocationManager locations;
 private LocationListener listener;
 private static final String ORIGIN="appassets.androidplatform.net";
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);getWindow().setStatusBarColor(Color.rgb(255,255,255));getWindow().setNavigationBarColor(Color.rgb(247,248,244));
  getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  web=new WebView(this);setContentView(web);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.addJavascriptInterface(new Bridge(),"Android");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();if(!"https".equals(u.getScheme())||!ORIGIN.equals(u.getHost()))return error(403,"Forbidden");
    String p=u.getPath();if(p==null||p.contains("..")||p.contains("\\"))return error(403,"Forbidden");
    p=p.equals("/")?"index.html":p.substring(1);
    String mime=p.endsWith(".js")?"application/javascript":p.endsWith(".css")?"text/css":p.endsWith(".json")||p.endsWith(".geojson")?"application/json":p.endsWith(".woff2")?"font/woff2":p.endsWith(".png")?"image/png":p.endsWith(".svg")?"image/svg+xml":"text/html";
    try{Map<String,String> headers=new HashMap<>();headers.put("Access-Control-Allow-Origin","https://"+ORIGIN);headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("www/"+p));}catch(IOException e){return error(404,"Not Found");}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !ORIGIN.equals(r.getUrl().getHost());}
  });
  web.loadUrl("https://"+ORIGIN+"/index.html");
 }
 private WebResourceResponse error(int status,String reason){return new WebResourceResponse("text/plain","UTF-8",status,reason,Collections.emptyMap(),new ByteArrayInputStream(reason.getBytes()));}
 private void js(String s){handler.post(()->web.evaluateJavascript(s,null));}
 public class Bridge {
  @JavascriptInterface public void requestLocation(){handler.post(()->{
   if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED&&checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},7);else locate();
  });}
  @JavascriptInterface public void openExternal(String url){handler.post(()->{Uri u=Uri.parse(url);String host=u.getHost();if(!"https".equals(u.getScheme())||host==null||!(host.equals("map.naver.com")||host.equals("map.kakao.com")||host.equals("www.openstreetmap.org")||host.equals("download.geofabrik.de")||host.equals("data.seoul.go.kr")||host.equals("data.gg.go.kr")||host.equals("www.data.go.kr")||host.equals("github.com")||host.equals("www.naturalearthdata.com")||host.equals("www.cdc.gov")||host.equals("home.army.mil")||host.equals("www.dobong.go.kr")||host.equals("m.yeosu.go.kr")))return;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){js("locationFailed('연결할 외부 앱이 없습니다.');");}});}
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==7){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED)locate();else js("locationFailed('위치 권한 없이도 지역 검색과 지도를 사용할 수 있습니다.');");}}
 @SuppressWarnings("MissingPermission") private void locate(){
  if(locations==null)locations=(LocationManager)getSystemService(LOCATION_SERVICE);stopLocation();
  if(!locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){js("locationFailed('기기의 GPS 위치 기능을 켜 주세요. 지도를 움직여 검색할 수도 있습니다.');");return;}
  listener=new LocationListener(){public void onLocationChanged(Location p){js("receiveLocation("+p.getLatitude()+","+p.getLongitude()+","+p.getAccuracy()+");");stopLocation();}public void onStatusChanged(String p,int s,Bundle b){}public void onProviderEnabled(String p){}public void onProviderDisabled(String p){stopLocation();js("locationFailed('GPS 기능이 꺼졌습니다.');");}};
  try{locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000,0,listener,Looper.getMainLooper());handler.postDelayed(timeout,30000);}catch(SecurityException e){stopLocation();js("locationFailed('정확한 GPS 위치 권한이 필요합니다. 지역 검색을 이용해 주세요.');");}
 }
 private final Runnable timeout=()->{stopLocation();js("locationFailed('GPS 신호를 찾지 못했습니다. 실외에서 다시 시도하거나 지역을 직접 선택해 주세요.');");};
 private void stopLocation(){handler.removeCallbacks(timeout);if(locations!=null&&listener!=null){locations.removeUpdates(listener);listener=null;}}
 @Override protected void onDestroy(){stopLocation();if(web!=null){web.removeJavascriptInterface("Android");web.destroy();}super.onDestroy();}
 @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()",v->{if(!"true".equals(v))super.onBackPressed();});}
}
