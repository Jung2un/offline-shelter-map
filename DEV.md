# 개발·설치 안내

[← 프로젝트 소개와 화면 미리보기](README.md)

README는 기능 소개를, 이 문서는 실행·설치·배포 및 검증 범위를 설명합니다.

## 목차

- [검증한 내용](#검증한-내용)
- [바로 실행하기 (Windows)](#바로-실행하기-windows)
- [구조](#구조)
- [지도 타일 공유 / 새 PC 복원](#지도-타일-공유--새-pc-복원)
- [Android APK 빌드·추출·설치 (Windows)](#android-apk-빌드추출설치-windows)
- [iOS](#ios)
- [iPhone 오프라인 웹앱 사용·배포](#iphone-오프라인-웹앱-사용배포)
- [테스트](#테스트)
- [현재 제한사항](#현재-제한사항)
- [GitHub에 올리기](#github에-올리기)
- [데이터 / 라이선스](#데이터--라이선스)

## 검증한 내용


- 전체 7,993개 파일, 약 715MiB 저장 및 SHA-256 검사 완료
- 다운로드 도중 일시중지 후 이어받기 확인
- 로컬 서버를 종료한 상태에서 앱 재실행 → 수원역 검색 → 처음 방문한 지역의 지도 표시 확인
- 공개 HTTPS 페이지의 지도 로딩·다운로드 시작·일시중지 확인
- 손상 파일 거부, 경로 검증, 완료 전 버전 유지, 네트워크 없는 캐시 응답 자동 테스트 통과

이는 데스크톱 브라우저 검증이며 **iPhone 실기기 비행기 모드 검증은 별도로 필요합니다.**

## 바로 실행하기 (Windows)

필수: Python 3.10 이상. 테스트에는 Node.js 18 이상이 필요합니다. npm 설치는 필요 없습니다.

```powershell
cd D:\p\offline-shelter-map
python scripts/check_assets.py
powershell -File scripts/preview.ps1
```

브라우저에서 <http://127.0.0.1:8766/>을 엽니다. 기존 작업 미리보기(8765)와 충돌하지 않도록 8766을 사용합니다. PC 서버는 개발용입니다. 설치된 네이티브 앱에는 이 서버가 필요 없습니다. 파일을 더블클릭해 `file://`로 실행하면 데이터 로딩이 제한될 수 있습니다.

**이 PC에 만든 프로젝트에는 전체 지도 타일이 들어 있습니다. Git clone만 한 경우 아래 데이터 복원이 먼저 필요합니다.**

## 구조

```text
www/                     앱 화면 및 오프라인 자산
  app.js                 장소 목록·필터·마커·상세 화면
  map.js                 로컬 벡터 타일과 지하철 Canvas 렌더링
  drawer.js              목록 펼침/닫기/드래그
  search.js, region.js   검색과 지역 선택
  pins.js                사용자 지정 장소 저장
  settings.js            복수 노선 선택과 설정
  guide.js               상황 선택·준비물 체크 저장
  location.js            브라우저 위치 요청·진단
  style.css, panel.css   기본 스타일과 현재 UI 스타일
  data/                  정제 장소/역/노선/지도 인덱스
    tiles/               대용량 지도 타일 (Git 제외)
  fonts/, vendor/        내장 글꼴·라이브러리와 라이선스
android/                 Android 네이티브 소스와 빌드 스크립트
ios/                     SwiftUI 소스와 Xcode 프로젝트
tests/                   Node 기본 테스트
scripts/                 미리보기·자산 검사·타일 묶음 도구
docs/                    데이터 및 개발 인수인계
artifacts/               별도 배포할 타일 ZIP (Git 제외)
build/, dist/            빌드 중간 파일·APK (Git 제외)
```

## 지도 타일 공유 / 새 PC 복원

소스와 작은 정제 데이터는 Git으로 관리합니다. 대용량 `www/data/tiles/`는 Git에 넣지 않고 별도 배포합니다. 타일이 없는 저장소만으로는 오프라인 지도가 완성되지 않습니다.

```powershell
# 전체 타일이 있는 이 PC에서 생성
python scripts/tile_bundle.py pack
# 생성: artifacts/korea-tiles.zip, artifacts/korea-tiles.zip.sha256
```

두 파일을 GitHub Release 첨부파일 또는 별도 파일 저장소로 공유하세요. 현재 배포용 Release 태그는 `map-data-2026-11-02`입니다. 다른 PC에서는 두 파일을 같은 폴더에 내려받고:

```powershell
python scripts/tile_bundle.py restore artifacts/korea-tiles.zip
python scripts/check_assets.py
```

복원은 SHA-256과 저장소의 타일 인덱스 일치를 검사합니다. 데이터 업데이트 시 타일 ZIP·체크섬·`tile-index.json`을 같은 버전으로 배포해야 합니다. 원본 OSM PBF와 수집 실험 파일은 이 저장소에 포함하지 않습니다. 자동 원본 수집 파이프라인은 아직 정리되지 않았으며, 현재 정제 스냅샷을 사용합니다.

## Android APK 빌드·추출·설치 (Windows)

여기서 추출은 소스에서 설치 파일을 새로 만드는 작업입니다. Android 폰 없이도 Windows에서 APK를 만들 수 있습니다. APK는 iPhone에 설치할 수 없습니다.

### 1. 준비

- Python 3.10 이상, JDK 21 설치. Android Studio의 `jbr`를 사용할 경우 실제 버전이 맞는지 확인합니다.
- Android Studio → SDK Manager에서 Android SDK Platform 34, SDK Build-Tools 35.0.0 설치. 세부 버전은 Show Package Details에서 선택합니다.
- USB 설치를 하려면 Android SDK Platform-Tools도 설치합니다.
- 이 프로젝트는 Gradle 프로젝트가 아닙니다. Android Studio의 Build APK 메뉴 대신 아래 PowerShell 스크립트를 사용합니다.
- Git clone한 PC라면 먼저 위의 지도 타일 복원을 수행합니다. 전체 지도 때문에 빌드 중간 복사본·APK를 위한 여유 공간 수 GB가 필요합니다.

### 2. 빌드

프로젝트 루트에서 실행합니다. SDK/JDK 경로는 본인의 설치 위치에 맞춥니다.

```powershell
cd D:\p\offline-shelter-map
python scripts/check_assets.py
# PASS 확인 후 실행
powershell -File android/build.ps1

# 기본 경로가 다를 때만 사용
powershell -File android/build.ps1 -Sdk 'D:/Android/Sdk' -Java 'C:/Program Files/Android/Android Studio/jbr'
```

기본 SDK는 `%LOCALAPPDATA%/Android/Sdk`, JDK는 `C:/Program Files/Android/Android Studio/jbr`입니다. 스크립트가 지도 포함 → Java 컴파일 → DEX 생성 → APK 정렬 → 개발 서명 → 서명 검증을 수행합니다. 마지막 `APK:` 출력까지 성공했는지 확인하세요. 실패 후 남아 있는 이전 APK를 새 결과로 착각하지 않도록 수정 시각도 확인합니다.

### 3. 결과 파일 꺼내기

- 설치·공유할 최종 파일: `D:\p\offline-shelter-map\dist\gyeot-android-preview.apk`
- 중간 파일: `build/android/` (`base.apk`, `unsigned.apk` 등은 배포하지 않음)
- 개발 서명 키: `build/android/development-signing.p12`

```powershell
Get-Item .\dist\gyeot-android-preview.apk | Select-Object FullName,Length,LastWriteTime
Get-FileHash .\dist\gyeot-android-preview.apk -Algorithm SHA256
explorer.exe .\dist
```

`dist`의 APK를 USB로 복사하거나 파일 저장소/Release 첨부파일로 전달하면 됩니다. APK와 서명 키는 Git에서 제외되며, 키 파일은 공유하지 않습니다.

### 4. Android에 설치·확인

Android 8.0 이상 기기에서 APK를 열어 설치합니다. 파일을 여는 앱의 ‘알 수 없는 앱 설치’ 허용이 필요할 수 있습니다. 개발용 USB 설치는 기기의 개발자 옵션에서 USB 디버깅을 켜고 PC 연결을 승인한 뒤 다음을 실행합니다.

```powershell
$androidSdkPath = "$env:LOCALAPPDATA/Android/Sdk"
& "$androidSdkPath/platform-tools/adb.exe" devices
& "$androidSdkPath/platform-tools/adb.exe" install -r .\dist\gyeot-android-preview.apk
```

`-r`은 기존 앱을 업데이트하며 데이터를 유지하는 설치 옵션입니다. 패키지와 서명이 맞아야 합니다. 서명 불일치 시 앱을 바로 삭제하지 말고 기존 키를 확인하세요. 앱 삭제는 저장한 장소와 체크 기록을 잃게 할 수 있습니다. 배포 버전은 `android/AndroidManifest.xml`의 versionCode를 증가시키고 versionName도 갱신합니다.

설치 후 비행기 모드에서 앱을 종료·재실행하고 지도 이동/확대, 검색, 저장한 곳, 준비물 체크를 확인합니다. Manifest에 INTERNET 권한이 없으며 지도 데이터는 APK에 내장됩니다. 외부 네이버·카카오·출처 링크는 별도 앱/브라우저와 인터넷이 필요합니다.

### 5. 키 관리 및 문제 해결

- SDK 파일을 못 찾음: Platform 34 / Build Tools 35.0.0 설치와 `-Sdk` 경로 확인.
- `javac`/`keytool` 오류: `-Java`가 `bin`의 상위 JDK 폴더인지, JDK 21인지 확인.
- 자산 검사 실패: 타일 ZIP 복원 후 다시 검사.
- 기존 앱과 서명 불일치: 동일한 개발 키를 사용해야 합니다. 기존 작업 폴더의 키는 이 저장소에 복사하지 않았습니다.
- 삭제된 웹 파일이 재빌드에도 남음: 현재 스크립트는 자산 폴더에 덮어쓰기하므로 깨끗한 새 `-BuildDir`을 지정합니다. 이때 기존 개발 키를 새 빌드 폴더에 안전하게 복사해 동일 서명을 유지합니다.

현재 스크립트는 고정된 개발용 암호로 개발 키를 생성합니다. 개인 테스트용이며 공개 배포 전 별도 릴리스 키·비밀 관리·서명 절차가 필요합니다. 서명 후 APK를 수정하면 서명이 깨집니다. 참고: [ADB 공식 안내](https://developer.android.com/tools/adb), [APK 서명·검증](https://developer.android.com/tools/apksigner).

## iOS

네이티브 iOS 설치에는 Apple 계정과 서명·프로비저닝이 필요합니다. 무료 Personal Team으로 개인 기기 테스트는 가능하지만 프로비저닝의 유효기간 등 제한이 있습니다. 일반 배포에는 Apple Developer Program 등 배포 방식에 맞는 자격이 필요하므로, 이 프로젝트는 사용자가 개발자 등록·서명 갱신 없이 접근할 수 있는 **iPhone용 PWA**를 공개 제공합니다. [Apple 계정 안내](https://developer.apple.com/help/account/basics/about-your-developer-account)

Mac에서 `ios/Gyeot.xcodeproj`를 열고 Team과 Bundle Identifier를 설정한 뒤 빌드합니다. `../www`가 앱 리소스에 포함됩니다. iOS 16 이상 대상입니다. 실제 설치에는 Apple 서명·프로비저닝이 필요합니다. Windows에서는 iOS 빌드와 실기기 검증을 하지 않았으며 서명된 IPA는 없습니다.

## iPhone 오프라인 웹앱 사용·배포

공개 웹앱: https://Jung2un.github.io/offline-shelter-map/

1. iPhone Safari에서 위 주소를 열고 공유 → 홈 화면에 추가합니다.
2. 홈 화면 아이콘으로 앱을 열어 왼쪽 위 설정 → **전체 지도 다운로드**를 누릅니다.
3. 약 715MiB(파일 버전에 따라 변동)를 저장합니다. 다운로드 중에는 화면을 열어 두세요. 중단되면 같은 버튼으로 이어받습니다.
4. 모든 파일의 크기·SHA-256 검사를 통과하면 **지도 저장 완료 · 오프라인 사용 가능**이 표시됩니다. 저장 중 자동 검증하므로 추가 검사는 필수가 아닙니다.
5. 비행기 모드를 켜고 Wi-Fi도 끈 뒤 앱을 완전히 닫았다 다시 실행합니다. 이전에 열지 않은 지역의 지도·검색·대피요령까지 확인하세요.

`manifest.webmanifest`는 홈 화면 설치 정보, `sw.js`는 오프라인 응답, `offline-core.js`는 검증·활성 버전 관리, `offline.js`는 다운로드·진행률·중단·이어받기·검사 UI를 담당합니다. `scripts/build_offline_manifest.py`가 실제 파일 크기와 해시 목록을 생성합니다. 업데이트는 현재 버전과 이전·중단된 다운로드의 파일을 크기·SHA-256으로 확인하고, 정상 파일은 새 버전 캐시에 복사해 재사용합니다. 누락·변경·손상된 파일만 내려받으며 새 버전 검사가 끝나기 전에는 기존 완료 버전을 전환하지 않습니다. 이전 버전 캐시는 자동 삭제하지 않으므로 업데이트할 추가 공간이 필요합니다.

웹 저장소는 기기의 저장 공간 정리나 사용자 데이터 삭제로 없어질 수 있습니다. 홈 화면 앱에서 직접 다운로드하고 비행기 모드로 재실행해 확인하세요. 지도가 보이지 않으면 설정 → ‘지도가 보이지 않나요?’ → ‘저장된 지도 확인’을 선택할 수 있습니다. 이 선택 검사는 인터넷 사용·파일 수정 없이 저장된 파일의 누락·손상을 확인합니다. 문제가 발견되면 인터넷에 연결해 ‘이어받기 / 업데이트 확인’으로 필요한 파일만 다시 받으세요. 체크 기록·사용자 장소는 기기 로컬 저장이며 동기화되지 않습니다. 외부 지도·출처 링크는 인터넷이 필요합니다. iPhone 실기기 검증은 별도 진행이 필요합니다.

### GitHub Pages 재배포

`.github/workflows/pages.yml`은 main push 또는 수동 실행 시 아래 과정을 수행합니다.

1. 소스를 체크아웃합니다.
2. `map-data-2026-11-02` Release에서 `korea-tiles.zip`과 SHA-256 파일을 내려받습니다.
3. `scripts/tile_bundle.py restore`로 타일을 복원하고 자산·테스트를 검사합니다.
4. 새 오프라인 manifest를 생성하고 `www/`만 GitHub Pages에 배포합니다.

Release 파일과 체크섬을 먼저 업로드해야 합니다. 지도 데이터 변경 시 Release 태그·타일 인덱스·체크섬을 함께 갱신합니다. Git에 타일을 넣지 않는 이유는 대용량 데이터와 소스를 분리하기 위해서입니다. Pages 저장량·전송량 제한이 있으므로 사용량이 늘면 별도 자산 호스팅을 검토하세요. 참고: [Pages 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [WebKit 저장 정책](https://webkit.org/blog/14403/updates-to-storage-policy/).

로컬 PWA 검증 시 `python scripts/build_offline_manifest.py`를 먼저 실행합니다. `localhost`는 개발 예외로 Service Worker가 동작하지만 iPhone 배포에는 HTTPS가 필요합니다. iPhone의 `127.0.0.1`은 개발 PC 주소가 아닙니다.

## 테스트

```powershell
node --test tests/*.test.cjs
python scripts/check_assets.py
node --check www/app.js
```

브라우저 수동 확인: 세 장소 탭 및 대피요령 버튼 전환, 목록 전체 펼치기, 장소 선택 후 지도 이동, 핀 생성/이름 변경/새로고침 후 복원, 노선 여러 개 저장, 설정 모달 스크롤 중 저장 버튼 유지.

실기기에서는 비행기 모드에서 최초 실행·지도 이동·검색·저장과 위치 권한 허용/거부를 별도 검증해야 합니다. 브라우저 테스트가 Android/iOS 실기기 검증을 대신하지 않습니다.

## 현재 제한사항

- PC 미리보기에서 위치 요청은 수신 시간 초과가 확인되었습니다. 실패 안내·재시도는 구현했지만 실제 좌표 수신 문제는 해결 확인되지 않았습니다. 기기와 브라우저의 위치 서비스가 필요합니다.
- Android는 GPS provider를 사용합니다. 정확한 위치 권한과 실제 수신 환경을 확인해야 합니다. iOS 위치 기능도 실기기 미검증입니다.
- 지도는 OSM 기반 자체 렌더링입니다. 네이버/카카오 지도 SDK나 타일을 사용하지 않습니다. 건물 상세·실내 지도·경로 탐색은 없습니다.
- 거리 표시는 직선거리이며 안전한 이동 경로나 도보 거리가 아닙니다.
- 시설 개방 여부·영업·재고·지하철 운행 상태는 실시간 정보가 아닙니다. 민방위 대피소가 핵 방호 성능을 보장하는 것은 아닙니다.
- 즐겨찾기·사용자 핀은 이 기기/브라우저의 localStorage에 저장합니다. 앱 데이터 삭제·앱 제거·브라우저 사이트 데이터 삭제 시 사라지며 계정 동기화/백업 기능은 없습니다.
- CSS에는 기존 스타일과 후속 덮어쓰기 규칙이 함께 있습니다. 현재 UI는 `panel.css`가 마지막에 적용됩니다.

## GitHub에 올리기

공개 저장소: https://github.com/Jung2un/offline-shelter-map . 후속 변경은 아래처럼 반영합니다.

```powershell
cd D:\p\offline-shelter-map
git status --short
git add .
git diff --cached --stat
git commit -m "Update offline shelter map"
git push origin main
```

 타일·APK·서명 키는 `.gitignore`로 제외됩니다. 타일 ZIP과 체크섬은 필요하면 저장소의 Release에 별도로 업로드합니다.

## 데이터 / 라이선스

2026-11-02 수집 기준: 대피소 6,947개, 마트 1,034개. 출처별 날짜·URL은 `www/data/manifest.json`, 상세 범위와 한계는 `docs/DATA.md` 참고.

자체 코드 MIT (`LICENSE`). OSM 파생 데이터 ODbL 1.0, Natural Earth Public Domain, Pretendard SIL OFL 1.1, Leaflet BSD-2-Clause. 공공 장소 자료는 원본별 이용조건·출처표시를 따릅니다. 앱 코드의 MIT가 지도/글꼴/공공데이터 라이선스를 대체하지 않습니다. 타일을 별도 파일로 배포하더라도 출처와 데이터 라이선스를 유지해야 합니다.

