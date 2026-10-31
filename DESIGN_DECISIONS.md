# InstaBox Deck Technical Design Decisions

**Document Version:** 1.0.0  
**Last Updated:** 2026-10-31  

---

## 1. Decision 01: 로컬 저장 암호화 볼트 및 On-demand 소비 모델

### 1.1 배경 및 맥락
사용자의 `instabox.sh` API 키(`ibk_...`)는 클라우드 가상 머신 생성, 파일 접근, 임의 셸 명령 실행(`exec`), 데스크톱 제어 등 강력한 권한을 가집니다. 로컬스토리지에는 평문 키를 저장하지 않고, API 요청 때만 복호화하는 로컬 저장 암호화 체계를 사용합니다. 전송 대상 서버나 신뢰 프록시는 평문 키를 받습니다.

### 1.2 채택된 결정
- 브라우저 표준 **Web Crypto API** (`window.crypto.subtle`) 사용 (외부 라이브러리 의존 없음).
- **알고리즘**: `AES-256-GCM` (무결성 인증 태그 포함) + `PBKDF2` (SHA-256, 100,000 iterations, 16바이트 랜덤 솔트).
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

## 3. Decision 03: 정적 배포와 실제 API 연결 경계 (Audit 1 수정)

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
- `POST /v1/machines/{id}/desktop/stream`의 iframe 정책은 최종 배포 Origin에서 아직 재검증되지 않았다.
- 복잡한 WebRTC/noVNC 캔버스 렌더러 대신 서비스가 발급한 뷰어를 `iframe`으로 임베딩한다. 성능, 브라우저 정책과 키보드/마우스 제어는 최종 Origin에서 확인해야 한다.
- Workspace Key용 주기적 스크린샷 뷰어 폴백은 현재 구현되지 않았다. 실 서비스 계약을 확인한 뒤 별도 범위로 결정한다.

### 4.2 터미널
- 실시간 양방향 세션: `@xterm/xterm` + WebSocket PTY (`/v1/machines/{id}/access` `kind: "terminal"`).
- 일괄 브로드캐스트/비동기 실행: `POST /v1/machines/{id}/exec` SSE 스트리밍.
- 8개 동시 세션 쿼터 제한을 고려하여 두 모드를 상황에 맞게 융합.

## 5. Decision 05: 부분 갱신과 권한 제거 (Audit 3 수정)

한 프로필의 네트워크 실패가 다른 프로필이나 데모를 숨기지 않도록 조회 결과를 개별 수집한다. 갱신 시작 순서로 세대를 부여하고 최신 세대만 화면 상태를 변경한다. 삭제된 프로필의 진행 중 요청과 앱 소유 PTY만 선택적으로 종료한다. 볼트 잠금은 모든 실 프로필 요청과 Broadcast 실행을 종료한다. 서버가 발급한 티켓의 원격 무효화는 서비스 계약이 확인되기 전까지 주장하지 않는다.

## 6. Decision 06: 조절 가능한 터미널·데스크톱 화면

같은 VM의 PTY와 데스크톱을 동시에 사용할 때 단일 타일의 SPLIT 탭을 사용한다. 타일 가용 폭 700px부터 좌우 분할을 제공하고, 더 좁으면 상하 분할로 바꾼다. 구분선은 포인터와 키보드로 25~75%를 조절한다. 데스크톱 iframe은 서비스가 보고한 해상도 또는 선택한 기본 해상도를 논리 크기로 두고 `min(가용폭/원본폭, 가용높이/원본높이)` 배율로 맞춘다. 데모 화면은 같은 화면비 안에서 글자를 읽을 수 있게 재배치한다. 외부 iframe의 실제 내부 렌더링은 허가된 실 계정에서 검증해야 한다.
