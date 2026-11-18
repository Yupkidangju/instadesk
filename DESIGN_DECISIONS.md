# InstaBox Deck Technical Design Decisions

**Document Version:** 1.1.0  
**Last Updated:** 2026-11-18  

---

## 1. Decision 01: 로컬 저장 암호화 볼트 및 On-demand 소비 모델

### 1.1 배경 및 맥락
사용자의 `instabox.sh` API 키(`ibk_...`)는 클라우드 가상 머신 생성, 파일 접근, 임의 셸 명령 실행(`exec`), 데스크톱 제어 등 강력한 권한을 가집니다. 로컬스토리지에는 평문 키를 저장하지 않고, API 요청 때만 복호화하는 로컬 저장 암호화 체계를 사용합니다. 전송 대상 서버나 신뢰 프록시는 평문 키를 받습니다.

### 1.2 채택된 결정
- 브라우저 표준 **Web Crypto API** (`window.crypto.subtle`) 사용 (외부 라이브러리 의존 없음).
- **당시 알고리즘(v1)**: `AES-256-GCM` (무결성 인증 태그 포함) + `PBKDF2` (SHA-256, 100,000 iterations, 16바이트 랜덤 솔트). 2.1.1의 신규·이행 볼트는 Decision 10을 따른다.
- **On-demand 소비(Decryption-on-Consumption)** 패턴:
  - `localStorage`에는 암호화된 스트링만 저장.
  - 마스터 비밀번호로 파생된 `CryptoKey`는 런타임 세션 동안만 휘발성 메모리에 보관.
  - API 호출이나 WebSocket 연결이 필요한 순간에만 `withDecryptedKey(profileId, (key) => ...)`를 통해 복호화하여 일회성 전달 후 폐기.
  - 15분 비활성 시 자동 잠금(Auto-Lock).

### 1.3 기각된 대안
- **평문 localStorage / sessionStorage 저장**: 브라우저 XSS 공격 또는 공용 PC 환경에서 API 키 유출 위험으로 완전 기각.
- **서버 측 KMS 및 운영자가 제공하는 프록시**: 이 프로젝트에는 포함하지 않는다. 사용자가 별도 소유한 신뢰 프록시를 설정할 수 있지만 해당 운영자에게 평문 키가 공개된다.

---

## 2. Decision 02: 네오스위스(Neo-Swiss) 인터페이스 시스템

### 2.1 배경 및 맥락
사용자의 명시적 요청: "인터페이스는 네오스위스 스타일로 디자인해서 구성".

### 2.2 채택된 결정
- **국제주의 타이포그래피 양식(International Typographic Style)**의 현대적 계승:
  - 비대칭 모듈러 그리드: 칼로 자른 듯한 1px 고대비 테두리(`border-zinc-800`), 각진 모서리(`rounded-none` / `rounded-sm`).
  - 산세리프(Inter) + 고정폭 모노스페이스(JetBrains Mono)의 엄격한 위계.
  - 스위스 레드 포인트(`bg-[#E53935]` / `text-[#E53935]`): 전체 UI는 미드나잇 블랙과 슬레이트 모노톤으로 유지하되, 중요한 상태 전환, 잠금 아이콘, 비상 제어 버튼에만 강렬한 스위스 레드를 사용하여 가독성과 기능적 집중도 극대화.
  - 기술적 마이크로 넘버링(`01_SYSTEM`, `02_NODES`, `03_WORKSPACE`).

### 2.3 기각된 대안
- **글래스모피즘 / 뉴모피즘**: 시각적 피로감이 높고 많은 VM의 콘솔 텍스트를 감시해야 하는 전문 관제 화면에 부적합하여 기각.

---

## 3. Decision 03: 정적 배포와 실제 API 연결 경계 (Electron Decision 07로 대체)

### 3.1 배경 및 맥락
실제 `https://api.instabox.sh` 서버의 CORS 응답 검증 결과, API 서버는 `Origin: https://dashboard.instabox.sh`에 대해서만 `Access-Control-Allow-Origin`을 허용합니다.

### 3.2 채택된 결정
- 정적 GitHub Pages 배포는 데모 기능만 자체적으로 제공한다. 실제 API는 서비스의 Origin 허용 또는 사용자가 소유하고 신뢰하는 HTTPS 역방향 프록시를 전제로 한다. 프록시는 전체 권한의 평문 Bearer 키와 명령/출력을 볼 수 있으므로 URL 입력만으로 신뢰가 성립하지 않는다.
- `extension/`의 전역 Origin 변조 규칙은 사용하지 않는다. 확장 프로그램의 호환성 및 배포는 실브라우저 검증 전까지 지원 범위 밖이다.
- **로컬 개발용 Vite Dev Proxy 내장**:
  - `vite.config.ts`에 `/instabox-api`와 `/instabox-connect` 프록시를 설정한다. 로컬 개발에서 브라우저는 동일 origin으로 요청하지만 실 서비스의 인증·PTY/Desktop 호환성은 아직 검증되지 않았다.
- 사용자 정의 프록시는 HTTPS origin만 허용하고, 적용 전 키 공개 범위를 명시적으로 확인한다. REST/SSE/티켓은 `{origin}/instabox-api/*`로 보낸다. 허용된 티켓 URL의 호스트가 `api.instabox.sh`이면 `wss://{proxy}/instabox-api/*`, `connect.instabox.sh`이면 `wss://{proxy}/instabox-connect/*`로 경로와 쿼리를 보존해 연결한다. 프록시 운영자가 두 업스트림과 WebSocket 업그레이드를 별도 중계해야 한다. 임의의 티켓 호스트는 거부한다.
- 공개 배포는 사용자별 Worker를 전제로 한다. Worker는 정확한 Pages Origin만 CORS 허용하고 두 고정 업스트림만 전달하며 키를 저장하지 않는다. 공용 Worker를 앱 기본값으로 제공하면 방문자 키가 한 운영자에게 모이므로 채택하지 않는다. 브라우저 Origin 제한은 비브라우저 클라이언트의 인증 수단이 아니며, 실제 API 권한은 방문자 키에 달려 있다.
- 키 등록 시 연결 실패를 키 오류로 간주해 암호화 기록을 삭제하지 않는다. 오류를 미검증으로 표시하고 사용자에게 프록시 적용/재시도를 안내한다.
- Worker URL을 적용하기 전에 인증 헤더 없는 `/health` 확인으로 템플릿과 허용 Origin을 검사한다. URL 입력만으로 키를 전송하지 않는다. 이 검사는 운영자 신뢰를 대신하지 않으며 사용자가 소유·신뢰 확인하는 절차를 계속 요구한다.

---

## 4. Decision 04: 화면(Desktop) 및 터미널(Terminal) 듀얼 통합 방식

### 4.1 데스크톱 화면
- `POST /v1/machines/{id}/desktop/stream`의 iframe 방식은 실 키 검증에서 거부됨을 확인했다. Decision 08이 현행 방식이다.
- 초기 구현은 서비스가 발급한 뷰어를 `iframe`으로 임베딩했다. 실 키 검증에서 프레임 정책으로 실패해 Decision 08의 격리된 최상위 뷰로 변경했다.
- Workspace Key용 주기적 스크린샷 뷰어 폴백은 현재 구현되지 않았다. 실 서비스 계약을 확인한 뒤 별도 범위로 결정한다.

### 4.2 터미널
- 실시간 양방향 세션: `@xterm/xterm` + WebSocket PTY (`/v1/machines/{id}/access` `kind: "terminal"`).
- 일괄 브로드캐스트/비동기 실행: `POST /v1/machines/{id}/exec` SSE 스트리밍.
- 현행 서비스의 user당 PTY 8개 한도와 별도 `exec` 한도를 고려한다. 구체적 화면·재시도 계약은 Decision 10을 따른다.

## 5. Decision 05: 부분 갱신과 권한 제거 (Audit 3 수정)

한 프로필의 네트워크 실패가 다른 프로필이나 데모를 숨기지 않도록 조회 결과를 개별 수집한다. 갱신 시작 순서로 세대를 부여하고 최신 세대만 화면 상태를 변경한다. 삭제된 프로필의 진행 중 요청과 앱 소유 PTY만 선택적으로 종료한다. 볼트 잠금은 모든 실 프로필 요청과 Broadcast 실행을 종료한다. 서버가 발급한 티켓의 원격 무효화는 서비스 계약이 확인되기 전까지 주장하지 않는다.

## 6. Decision 06: 조절 가능한 터미널·데스크톱 화면

같은 VM의 PTY와 데스크톱을 동시에 사용할 때 단일 타일의 SPLIT 탭을 사용한다. 타일 가용 폭 700px부터 좌우 분할을 제공하고, 더 좁으면 상하 분할로 바꾼다. 구분선은 포인터와 키보드로 25~75%를 조절한다. 데스크톱 뷰는 서비스가 보고한 해상도 또는 선택한 기본 해상도를 논리 크기로 두고 `min(가용폭/원본폭, 가용높이/원본높이)` 배율로 맞춘다. 데모 화면은 같은 화면비 안에서 글자를 읽을 수 있게 재배치한다. 실제 스트림 내부 렌더링은 허가된 실 계정에서 검증한다.

2.0.3에서는 Electron 뷰의 외곽만 위 배율로 맞추고 원격 페이지의 zoom factor는 기본값으로 유지한다. 2.0.2에서 외곽과 페이지 양쪽에 배율을 적용해 실제 영상이 두 번 축소되는 현상을 확인했다.

실 VM 재검증에서 2.0.3의 새 뷰도 이전 호스트 배율을 상속해 `devicePixelRatio`가 약 0.65였다. 따라서 기본값에 맡기는 방식은 불충분하며, 뷰를 열 때 `setZoomFactor(1)`로 초기화한다.

2.0.4 실 검증에서 생성 직후의 설정이 대시보드 탐색 시 다시 덮이는 것을 확인했다. `did-finish-load` 후 zoom factor를 1로 맞추는 시점이 필요하다.

2.0.5 실 검증에서는 zoom factor가 1이 됐지만 상태 해상도 1280×800과 실제 framebuffer 1073×1038이 달랐다. 상태 해상도로 외곽을 551×344에 고정하면 실제 영상이 356×344로 작아진다. 원격 네이티브 뷰는 가용 패널 전체를 쓰고 대시보드가 실제 framebuffer를 맞추게 한다. 데모 화면의 `fitDesktop` 계약은 유지한다.

## 7. Decision 07: Electron 데스크톱 전환

사용자가 공개 웹의 CORS/공용 프록시 신뢰 경계를 제거하고 설치형 Electron 앱으로 전면 전환하기로 결정했다. Windows x64를 첫 대상(가정)으로 삼고 기존 React UI와 로컬 암호화 볼트를 `app://instadesk`에 묶는다. REST/SSE는 Electron 메인의 고정 API 라우트, PTY는 메인의 WSS 연결과 제한된 IPC로 처리한다. 렌더러의 `webSecurity`를 끄거나 Node 통합을 켜는 방식은 채택하지 않는다. Desktop 표시 방식은 Decision 08로 보완했다. 기술 경계와 검증은 `docs/electron/architecture.md`에 기록한다. 검증된 데스크톱 대체물이 준비되면 Pages 사이트와 사용자 계정의 개인 Worker 게시를 제거한다.

## 8. Decision 08: 서명 Desktop 링크의 최상위 뷰

실 키로 발급된 Desktop 링크가 iframe에서 검게 표시됐다. 대시보드 응답은 `X-Frame-Options: DENY`와 `Content-Security-Policy: frame-ancestors 'none'`이므로 앱 프레임에 삽입할 수 없다. 보안 정책을 무력화하지 않고 Electron `WebContentsView`를 앱 안의 화면 영역에 배치해 서명 링크를 최상위 문서로 연다. 메인에서 URL·좌표를 제한하고, 격리된 뷰에는 preload와 Node 통합을 주지 않는다. 모달/볼트 잠금/프로필 삭제 시 닫는다. 실 스트림 영상과 화면 맞춤은 확인했으며 입력 제어는 별도 검증 대상이다.

## 9. Decision 09: 세 아키텍처 네이티브 CI와 태그 릴리스

사용자가 Linux ARM64·AMD64와 Windows x64 릴리스를 요청했다. Electron 45.2.1의 각 사전 빌드 바이너리를 해당 아키텍처의 GitHub runner에서 설치하고 수동 `resources/app` 배포 구조를 유지한다. Linux는 실행 권한을 보존하는 tar.gz, Windows는 기존 ZIP을 사용한다. `main` CI의 세 결과를 확인한 커밋에 `v2.1.0` 태그를 붙이고, 태그 CI가 세 빌드/스모크를 다시 통과한 경우에만 Release 자산과 해시를 게시한다. 단일 x64 러너의 교차 컴파일만으로 ARM64를 통과 처리하지 않는다. 실제 ARM 기기 검증·코드 서명은 별도 범위다.

Ubuntu 24.04 네이티브 CI에서 일반 사용자 소유의 `chrome-sandbox`가 거부됨을 확인했다. Chromium sandbox를 끄는 방식은 채택하지 않는다. Linux 설치 경로 전체를 root 소유로 두고 helper에 4755를 설정해 일반 사용자로 앱을 실행한다. CI 스모크는 압축 해제한 아카이브에 같은 조건을 적용한다.

## 10. Decision 10: 감사 4의 잠금·PTY·볼트 이행

자동 요청은 사람의 활동으로 보지 않는다. 앱 창의 실제 키·포인터·터치 입력만 15분 비활성 타이머를 연장하고, 잠금은 모든 앱 소유 채널과 입력 중 비밀을 정리한다. WebSocket 수립과 셸 세션 준비를 구분하고 서버 `session` 신호 후에만 PTY LIVE를 표시한다. 한도는 서비스의 user 단위 PTY 8개가 권위이며 로컬 관측 수를 강제 게이트로 사용하지 않는다. 429/503/일시 네트워크만 제한 재시도하고 인증·`taken`·409는 사람이 해결하도록 남긴다. Broadcast는 PTY와 독립된 SSE `exec`다.

기존 100,000회 볼트 v1을 삭제하거나 약한 암호를 임의로 바꾸지 않는다. 정상 암호 검증 후 전 프로필을 600,000회 v2로 한 번에 재암호화하고, 신규 암호문구 최소 15자를 요구한다. 기존 약한 암호는 사용자가 변경해야 하므로 변경 경로를 제공한다. 구체적 상태·회귀·실 검증은 `docs/electron/audit_4_remediation.md`를 따른다.

버전별 패키지 폴더를 `userData`에 사용하지 않는다. 제품명 기반의 버전 없는 사용자 경로와 기존 localStorage 키를 명시적으로 유지한다. 자동 조회의 `lastUsedAt` 쓰기가 새 프로필을 덮는 경합은 최신 저장 레코드에만 병합한다. 프로필 5개 저장·재해제·이행 회귀를 출고 게이트로 둔다.

## 11. Decision 11: 스크롤되는 타일의 네이티브 Desktop 뷰

`WebContentsView`는 HTML 스크롤과 자동으로 함께 움직이거나 DOM 경계에 잘리지 않는다. 스크롤 자리의 실제 좌표를 갱신하되 음수 좌표를 0에 고정한 상태로 표시하지 않는다. 작업 영역 안에 완전히 보이지 않을 때는 네이티브 뷰만 숨겨 다른 타일/헤더를 덮지 않으며 같은 뷰를 재표시한다. 여러 행에서 휠의 기본 대상은 작업 영역, `Alt+휠`은 원격 화면이다. 스트림을 스크롤마다 닫고 재발급하는 방식은 연결/화면 점프를 유발하므로 채택하지 않는다. 구체적 동작과 제한은 `docs/electron/desktop_scroll_2_1_2.md`를 따른다.

## 12. Decision 12: 감사 5의 터미널 기록과 휠 소유

터미널 위 일반 휠은 xterm 기록 전용으로 두고 끝 경계에서 작업 영역으로 자동 전파하지 않는다. 한 입력으로 두 영역이 움직이는 기존 동작을 없애며 작업 영역을 의도적으로 움직일 때는 `Shift+휠`을 사용한다. Desktop의 일반/Alt 휠 계약은 유지한다.

1×1 포커스·탭 전환 때 PTY를 계속 열어 두면 서버의 user당 8개 한도를 숨은 타일이 소모한다. 따라서 숨김 시 연결은 닫고, 최근 출력/읽던 위치만 제한된 렌더러 메모리 캐시에 직렬화해 복원한다. 키·명령 출력은 디스크에 쓰지 않으며 잠금·타일 닫기·프로필 삭제에서 지운다. EXEC 진행은 탭 이탈 시 취소하고 LOGS/PROCS는 재방문 시 다시 읽는다. 상한과 회귀 조건은 `docs/electron/audit_5_remediation.md`를 따른다.

## 13. Decision 13: 배포 체크섬과 후속 무결성 검토

현재 Windows ZIP·Linux tar.gz는 미서명 포터블 아카이브다. 이번 수정은 설치 전 같은 릴리스의 SHA-256 비교를 실행 가능한 절차로 제공하고 동봉 Linux 안내가 실제 패키지명을 가리키게 한다. 체크섬은 게시자 신원 인증을 대신하지 않으며, 이 위험을 새로 수용한다는 뜻도 아니다. 제품 유지관리자는 다음 서명/배포 보안 마일스톤 전에 Windows 코드 서명과 ASAR 무결성/Fuses의 패키징·디버깅 호환성을 검토한다. Linux에서는 Windows용 ASAR 무결성 기능을 같은 보호로 주장하지 않고, Linux 서명/배포 수단을 별도로 결정한다. `safeStorage` 도입은 기존 마스터 암호·버전 이행 및 Linux 비밀 저장소 부재 폴백을 평가하는 별도 설계 과제다.

## 14. Decision 14: 멀티세션 타일 분리·신호등 상태 추적·라이브 PTY 미러링

### 14.1 채택된 결정
- **동일 VM 다중 세션 타일과 네이티브 Desktop 뷰 분리**: 동일 VM의 `main`/`agent`/`aux` 세션을 별도 타일로 열되 동일 `(profileId, machineId, terminalSessionName)` 중복은 `addTile`·`setTileSessionName`·`applyPreset`에서 모두 기존 타일 포커스로 수렴시켜 WebSocket `taken` 충돌을 막는다. 네이티브 `WebContentsView`는 `desktop_${tileId}`를 ID로 사용해 동일 VM 다중 타일이 동시에 `SPLIT`/`DESKTOP`을 열어도 생명주기와 좌표가 충돌하지 않게 한다.
- **휴리스틱 기반 신호등 상태 추적(`SessionActivityTracker`)**: 서버 측 셸 상태 API가 없으므로 터미널 입출력과 ANSI 정리된 꼬리 텍스트를 기반으로 `running`(🔴)/`prompt`(🟡)/`idle`(🟢)/`disconnected`(⚪)를 보수적으로 판정한다. 셸 프롬프트 복귀를 최우선으로 판별하고, `Enter` 제출 시 직전 프롬프트 꼬리를 비워 완료 후에도 노란색이 고착되지 않게 한다.
- **라이브 PTY 제어(`terminalRegistry`)와 SSE Broadcast(`BroadcastExecModal`)의 역할 분리**: 단발성 비대화형 일괄 실행은 기존 SSE `POST /exec` 기반 `BroadcastExecModal`을 유지하고, 열려 있는 대화형 셸·AI 에이전트 제어(`Y`/`N`/`1`/`2`/`Esc`/`Ctrl+C` 및 키스트로크 미러링)는 `terminalRegistry`를 통해 활성 PTY로 직접 전달한다. 암호/패스프레이즈 프롬프트(`isSensitive`)가 감지된 경우 미러링을 차단하고 볼트 잠금 시 미러링을 해제해 평문 비밀 확산을 방지한다.
- **워크스페이스 프리셋 분리 저장**: `instabox_deck_presets_v1`에 타일 배치 구조와 `gridMode`만 JSON 저장하고 비밀·명령·출력은 제외한다. 로드·적용 시 스키마와 열거값을 엄격히 검증하며 잠긴 상태에서 실 프로필 프리셋을 누르면 잠금 해제 모달을 연다.

### 14.2 기각된 대안
- **단순 비활성 타이머 기반 `idle` 전환**: 조용한 빌드(`cargo build`, `sleep`)가 수 초간 무출력일 때 완료(`idle`)로 오판하므로 채택하지 않았다.
- **프리셋을 볼트 암호화 파일 안에만 묶어 두는 방식**: 데모 모드·잠금 전 빠른 레이아웃 확인과 독립시키기 위해 비밀이 없는 배치 메타데이터만 분리 저장하되 실 프로필 복원은 볼트 잠금 해제로 게이트한다.

## 15. Decision 15: 볼트 미초기화 시 Create 전환 및 10회 실패 자동 파기

### 15.1 채택된 결정
- **초기 상태 Create / 설정 후 Unlock 분기**: `MasterUnlockModal`이 `isVaultInitialized` 상태를 기준으로 마스터 암호가 없는 초기 상태에서는 `CREATE VAULT`(15자 이상 암호문구 생성 및 확인) 흐름을, 이미 볼트가 설정된 상태에서는 `UNLOCK VAULT` 흐름을 제공한다.
- **10회 이상 잠금 해제 실패 시 볼트 데이터 영구 삭제**: `LocalVaultStorage.failedUnlockAttempts`를 `localStorage`에 영구 카운트해 앱 재시작 후에도 횟수가 초기화되지 않도록 한다. 연속 실패 횟수가 `10`회에 도달하면 `cryptoVault.resetVault()`로 `instabox_deck_vault_v1`과 메모리의 모든 실 프로필 상태를 즉시 삭제해 오프라인 무차별 대입을 차단한다. 해제 성공 시 카운터는 `0`으로 초기화된다.

### 15.2 기각된 대안
- **메모리 카운터만 유지하는 방식**: 앱을 재실행하면 실패 횟수가 초기화되어 10회 제한을 우회할 수 있으므로 기각했다.
