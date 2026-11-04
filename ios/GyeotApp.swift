import SwiftUI
import WebKit
import CoreLocation

@main struct GyeotApp: App {
    var body: some Scene { WindowGroup { OfflineView().ignoresSafeArea(.container, edges: .bottom) } }
}
struct OfflineView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(context.coordinator, forURLScheme: "gyeot")
        config.userContentController.add(context.coordinator, name: "location")
        config.userContentController.add(context.coordinator, name: "external")
        let web = WKWebView(frame: .zero, configuration: config)
        context.coordinator.web = web
        web.navigationDelegate = context.coordinator
        web.scrollView.bounces = false
        web.load(URLRequest(url: URL(string: "gyeot://local/index.html")!))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    final class Coordinator: NSObject, WKURLSchemeHandler, WKScriptMessageHandler, WKNavigationDelegate, CLLocationManagerDelegate {
        weak var web: WKWebView?
        let manager = CLLocationManager()
        var waitingForPermission = false
        override init() { super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyBest }
        func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
            guard let url = urlSchemeTask.request.url, url.host == "local", let root = Bundle.main.url(forResource: "www", withExtension: nil) else { urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return }
            let path = url.path == "/" ? "index.html" : String(url.path.dropFirst())
            guard !path.contains(".."), !path.contains("\\") else { urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile)); return }
            do {
                let file = root.appendingPathComponent(path)
                let data = try Data(contentsOf: file)
                let mime = ["html":"text/html", "js":"application/javascript", "css":"text/css", "json":"application/json", "geojson":"application/json", "woff2":"font/woff2", "png":"image/png", "svg":"image/svg+xml"][file.pathExtension] ?? "application/octet-stream"
                let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": mime + (mime.hasPrefix("text/") ? "; charset=utf-8" : ""), "Access-Control-Allow-Origin":"gyeot://local", "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'"])!
                urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
            } catch { urlSchemeTask.didFailWithError(error) }
        }
        func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(navigationAction.request.url?.scheme == "gyeot" ? .allow : .cancel) }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == "gyeot" else { return }
            if message.name == "external", let text = message.body as? String, let url = URL(string: text), url.scheme == "https", let host = url.host,
               ["map.naver.com","map.kakao.com","www.openstreetmap.org","download.geofabrik.de","data.seoul.go.kr","data.gg.go.kr","www.data.go.kr","github.com","www.naturalearthdata.com","www.cdc.gov","home.army.mil","www.dobong.go.kr","m.yeosu.go.kr"].contains(host) { UIApplication.shared.open(url) }
            if message.name == "location" {
                if manager.authorizationStatus == .notDetermined { waitingForPermission = true; manager.requestWhenInUseAuthorization() }
                else if [.authorizedWhenInUse, .authorizedAlways].contains(manager.authorizationStatus) { manager.requestLocation() }
                else { fail() }
            }
        }
        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            guard waitingForPermission else { return }
            if [.authorizedWhenInUse, .authorizedAlways].contains(manager.authorizationStatus) { waitingForPermission = false; manager.requestLocation() }
            else if manager.authorizationStatus != .notDetermined { waitingForPermission = false; fail() }
        }
        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { guard let p = locations.last else { fail(); return }; web?.evaluateJavaScript("receiveLocation(\(p.coordinate.latitude),\(p.coordinate.longitude),\(p.horizontalAccuracy));") }
        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { fail() }
        func fail() { web?.evaluateJavaScript("locationFailed('위치를 확인하지 못했습니다. 지역 검색을 이용해 주세요.');") }
    }
}
