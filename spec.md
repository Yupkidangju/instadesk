# InstaDesk 데스크톱 명세

**Document Version:** 2.0.5
**Status:** Windows x64 패키지·가짜 키 검증 완료; 유효한 실 API/PTY/Desktop 재검증 진행 중
**Last Updated:** 2026-11-01  

---

## 1. 개요 및 목표 (Overview & Objectives)

본 프로젝트는 Windows x64를 우선 대상으로 하는 Electron 데스크톱 앱이다. 기존 React 화면은 앱에 번들해 전용 `app://instadesk` Origin에서 실행한다. 사용자가 입력한 `instabox.sh` API 키(`ibk_...`)는 Web Crypto AES-256-GCM + PBKDF2로 앱 Origin의 localStorage에 암호화해 보관하고, 요청 때만 복호화한다. 실제 API와 PTY 연결은 Electron 메인 프로세스에서 고정 InstaBox 호스트로 직접 수행한다. 공용 Worker나 GitHub Pages는 런타임에 필요하지 않다.

사용자는 **네오스위스(Neo-Swiss) 인터내셔널 타이포그래피 스타일**의 정밀하고 대담한 그리드 인터페이스를 통해 복수의 Linux microVM 상태를 실시간 관제하고, 멀티 타일 분할 뷰를 통해 **실시간 인터랙티브 터미널(PTY WebSocket & SSE Exec)** 및 **그래픽 데스크톱 화면(Stream Iframe & VNC)**을 즉시 확인하고 원격 제어할 수 있습니다.

### 핵심 성공 기준 (Success Criteria)
1. **설치형 데스크톱 구동**: Windows x64의 로컬 실행 및 포터블 배포. 사용자는 앱에서 마스터 암호와 자기 API 키를 입력한다. 브라우저 CORS 우회 설정이나 Worker 설치는 요구하지 않는다. 데모 모드는 오프라인에서도 동작한다.
2. **소비 시점 복호화(On-demand Decryption) 보안 아키텍처**:
   - 전용 `app://instadesk` Origin의 `localStorage`에는 오직 암호화된 볼트 레코드(`ciphertext`, `salt`, `iv`)만 영구 저장.
   - 평문 키는 영구 상태로 메모리에 장기 보관되지 않고, 사용자가 입력한 마스터 비밀번호로 파생된 세션 키를 통해서만 API 호출 시점에 즉시 복호화되어 소비 후 가비지 컬렉션(GC).
   - 세션 잠금(Lock) / 해제(Unlock), 비활성 타임아웃(기본 15분) 자동 잠금 지원. 잠금 시 앱이 소유한 PTY 소켓과 진행 중 요청을 종료하고 데스크톱 뷰 및 출력물을 화면에서 제거한다. 이미 외부 탭에 연 뷰어는 앱이 원격으로 취소할 수 없다.
3. **네오스위스 디자인 시스템(Neo-Swiss Design System)**:
   - 엄격한 비대칭 모듈러 그리드, 1px 고대비 샤프 보더, 세리프가 없는 강렬한 인터내셔널 산세리프 타이포그래피(Inter), 모노스페이스 기술 폰트(JetBrains Mono).
   - 스위스 국기에서 유래한 정밀한 스위스 레드(`#E53935` / `#DC2626`) 및 인터내셔널 클라인 블루 액센트, 고대비 모노크롬(미드나잇 블랙, 쿨 그레이) 바탕.
   - 기술적 마이크로 인덱싱(01_INDEX, 02_MACHINES, 03_WORKSPACE) 및 기능주의적 정보 계층.
4. **멀티 VM 실시간 관제 및 듀얼 터미널/화면 제어**:
   - 다중 API 키(여러 개인/조직 워크스페이스) 동시 연결 및 통합 모니터링.
   - 분할 타일 그리드(1x1, 2x1, 2x2, Auto-Grid)로 여러 VM 동시 렌더링.
   - WebSocket PTY 기반 `xterm.js` 풀 인터랙티브 셸 및 SSE 스트리밍 Exec 지원.
   - 액세스 응답의 `protocol`과 `instabox-access-token.<token>`을 WebSocket 서브프로토콜로 전달한다. 티켓 문자열은 URL에 추가하지 않는다. 선택한 세션 이름은 `session` 쿼리로 전달한다.
   - 서비스가 발급한 링크를 Electron의 격리된 `WebContentsView`에 최상위 페이지로 열어 데스크톱을 표시하고 Takeover/Handback을 제어한다. 링크는 고정 dashboard HTTPS Origin만 허용한다.
   - 복수 VM 일괄 명령 전송(Broadcast Command Execution).

---

## 2. 비목표 (Non-Goals)
- 백엔드 중앙 집중형 사용자 DB 구축 (100% 클라이언트 로컬 저장 원칙).
- GitHub Pages·Cloudflare Worker 기반 브라우저 실 API 배포. 기존 Pages 사이트와 개인 Worker 게시를 Electron 대체물이 검증된 뒤 제거한다.
- 첫 배포의 macOS/Linux 패키지와 코드 서명. Windows x64 동작과 포터블 패키지가 우선이며 서명/타 OS는 별도 범위다.
- `instabox.sh` 서비스 자체의 인프라 변경 (공식 API 및 WebSocket 규격을 그대로 수용).
- 화려한 그라데이션, 스큐어모피즘, 불필요한 라운딩 등 네오스위스 디자인 철학에 어긋나는 장식적 요소 배제.

---

## 3. 보안 아키텍처: 로컬 저장 암호화 볼트

### 3.1 암호화 알고리즘 및 키 파생
- **암호화 표준**: `AES-GCM` (Advanced Encryption Standard in Galois/Counter Mode), 키 길이 256-bit.
- **키 파생 함수(KDF)**: `PBKDF2` (Password-Based Key Derivation Function 2)
  - 해시 함수: `SHA-256`
  - 반복 횟수(Iterations): `100,000`회 이상
  - 솔트(Salt): `crypto.getRandomValues(new Uint8Array(16))`로 생성된 암호학적으로 안전한 16바이트 무작위 바이트.
- **초기화 벡터(IV)**: 암호화 1회당 무작위 12바이트(`crypto.getRandomValues(new Uint8Array(12))`).

### 3.2 저장소 스키마 (`localStorage`)
```typescript
export interface EncryptedProfileRecord {
  id: string;          // UUID
  label: string;       // e.g. "01_PROD_WORKSPACE"
  encryptedData: string; // Base64(iv):Base64(ciphertext + auth tag)
  keyHint?: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface LocalVaultStorage {
  version: 1;
  salt: string;        // 마스터 KDF salt (Base64)
  verifierCiphertext: string; // 암호화된 검증 토큰 (Base64)
  verifierIv: string;  // 검증 토큰 IV (Base64)
  profiles: EncryptedProfileRecord[];
  autoLockMinutes: number; // default: 15
}
```

볼트는 전용 `app://instadesk` Origin의 localStorage를 사용한다. 기존 GitHub Pages Origin의 저장소는 자동으로 이전하지 않으며, 사용자가 Electron 앱에 키를 다시 등록한다. 전용 Origin만으로 XSS 위험이 사라지는 것은 아니다.

### 3.3 On-demand 소비 수명주기 (Decryption-on-Consumption)
1. **평문 상시 보관 금지**: 스토어(State)에는 마스터 비밀번호나 평문 API 키 배열을 유지하지 않고, 파생된 `CryptoKey` 객체(또는 세션 런타임 언락 메모리 캐시)만 일시 보관.
2. **소비 래퍼 패턴**:
   ```typescript
   async function withDecryptedKey<T>(
     profileId: string,
     consumer: (apiKey: string) => Promise<T>
   ): Promise<T>
   ```
   API 호출이 필요할 때만 복호화된 키를 콜백에 전달하고, 콜백 완료 후 스코프를 벗어나면 메모리에서 즉시 해제.
3. **잠금 상태 처리**: 볼트가 잠겨 있을 때 소비 함수 호출 시 `VaultLockedError`를 던지며 네오스위스 스타일의 마스터 패스워드 입력 모달을 트리거.

### 3.4 잠금과 프로필 삭제
- 수동/자동 잠금은 앱이 소유한 실 프로필 요청·PTY·데스크톱 타일과 Broadcast 실행을 중단하고 해당 명령·출력을 지운다. 이후 잠금 해제 전 재연결하지 않는다.
- 프로필 삭제는 볼트 잠금 해제와 대상 이름·ID 확인을 요구한다. 로컬 암호화 키 기록의 삭제는 복구할 수 없다. 대상 프로필의 요청·PTY·데스크톱·명령 출력은 앱에서 닫되 다른 프로필의 연결은 유지한다. 서버 티켓과 이미 연 외부 탭의 원격 취소는 보장하지 않는다.

---

## 4. 네오스위스 인터페이스 시스템 규격 (Neo-Swiss UI System)

### 4.1 그리드 및 레이아웃 철학
- **구조적 모듈러 그리드**: 4px/8px 기준의 엄격한 선형 격자 구조.
- **보더**: `1px solid #27272A` (Zinc 800) 또는 고대비 샤프 보더, 모서리 라운딩은 최소(`rounded-none` 또는 미세한 `rounded-sm`).
- **타이포그래피**:
  - Primary Sans: `Inter`, `Helvetica Neue`, Arial (굵기 400, 600, 800, 대문자 트래킹 +0.05em~+0.1em).
  - Monospace Data: `JetBrains Mono`, `ui-monospace`, `Courier New` (상태 코드, IP, 스펙, 터미널).
  - 테크니컬 마이크로 인덱싱: 섹션과 타일마다 `01 // SYSTEM`, `02 // WORKSPACE`, `03 // RUNNING` 접두사 표기.
- **컬러 팔레트**:
  - Background: `#09090B` (Zinc 950), `#121215` (Deep Charcoal)
  - Surface: `#18181B` (Zinc 900), `#27272A` (Zinc 800)
  - Text Primary: `#FAFAFA` (Zinc 50), Text Secondary: `#A1A1AA` (Zinc 400), Text Muted: `#71717A` (Zinc 500)
  - Swiss Red Accent: `#E53935` (Accent), `#EF4444` (Red 500)
  - Status Colors:
    - Running: `#10B981` (Emerald 500 / Signal Green)
    - Suspended/Paused: `#F59E0B` (Amber 500 / Warning Yellow)
    - Stopped: `#71717A` (Zinc 500)
    - Error/Quota: `#EF4444` (Signal Red)

### 4.2 지원 화면과 분할 뷰
- 최소 지원 폭: 390 CSS px. 1024px 미만에서는 노드 목록을 열고 닫는 서랍을 사용한다. 1280px 미만에서는 여러 타일을 세로로 쌓고 스크롤한다. 단일 타일은 그리드 설정과 관계없이 작업 영역 전폭을 쓴다.
- 한 VM의 `SPLIT` 탭은 PTY 터미널과 Desktop 뷰어를 동시에 마운트한다. 타일의 가용 폭이 700px 이상이면 구분선을 좌우로 25~75% 범위에서 드래그·키보드 조절한다. 더 좁은 타일은 상하 배치한다.
- Desktop 뷰어는 서버가 보고한 화면 크기 또는 선택한 기본 해상도를 논리 크기로 사용하고, 가용 영역의 너비·높이에 맞춰 원본 화면비를 유지하며 확대/축소한다. 외부 뷰 내부 렌더링은 실 서비스에서 별도 검증한다.

### 4.3 Electron 보안·통신 경계
- 렌더러는 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`로 로컬 번들만 로드한다. 메인 프로세스는 고정 `https://api.instabox.sh` REST/SSE와 허용된 `wss://api.instabox.sh` 또는 `wss://connect.instabox.sh` PTY만 연결한다.
- 렌더러는 API 키를 요청 직전에 복호화해 로컬 메인 프로세스로 전달한다. 메인 프로세스는 키를 디스크에 기록하거나 로그로 출력하지 않고, 목적지/메서드/경로를 검증한다. 잠금·프로필 삭제 시 진행 중 요청과 PTY를 종료한다.
- 좁게 정의한 preload IPC만 렌더러에 노출한다. 원격 Desktop 콘텐츠와 외부 링크는 Node/Electron 권한을 받지 않는다. Desktop 서명 링크와 PTY 티켓 규격은 허가된 실제 키로 검증해야 한다.

---

## 5. API 계약 및 기능 규격 (API Contracts)

### 5.1 InstaBox REST API 엔드포인트
- `GET /v1/machines`: 머신 목록 조회 (`Authorization: Bearer <key>`)
- `GET /v1/machines/{id}`: 특정 머신 상태 조회
- `POST /v1/machines/{id}/start`: 머신 시작 (`Idempotency-Key` 필수)
- `POST /v1/machines/{id}/stop`: 머신 정지 (`Idempotency-Key` 필수)
- `POST /v1/machines/{id}/suspend`: 머신 일시정지 (`Idempotency-Key` 필수)
- `POST /v1/machines/{id}/resume`: 머신 재개 (`Idempotency-Key` 필수)
- `DELETE /v1/machines/{id}`: 머신 영구 삭제 (`X-Confirm-Delete: <id>`, `Idempotency-Key` 필수)
- `POST /v1/machines/{id}/exec`: 명령 실행 (SSE 스트리밍 `Accept: text/event-stream` 지원)
- `POST /v1/machines/{id}/desktop`: 데스크톱 설치/시작/상태 조회
- `POST /v1/machines/{id}/desktop/stream`: 데스크톱 스트림 링크 발급 (`https://dashboard.instabox.sh/desktop/{id}#token=...`)
- `POST /v1/machines/{id}/access`: 터미널/VNC WebSocket 단기 티켓 발급
- `GET /v1/machines/{id}/metrics`: 30초 단위 메트릭 조회
- `GET /v1/machines/{id}/logs`: 시리얼 콘솔 로그 및 최근 작업 조회

### 5.2 동시 세션 쿼터 제어
- `instabox.sh` 정책상 계정당 최대 8개의 동시 터미널/데스크톱 WebSocket 세션 허용 (`429 quota_exceeded`).
- 클라이언트는 앱이 소유한 실제 PTY WebSocket의 연결 시도 및 열린 연결을 프로필별로 예약/계수한다. 타일, 비연결 탭, 숨겨진 타일은 세션이 아니다. 한 프로필에서 8개 예약/연결 중에는 새 PTY 연결을 차단한다. 헤더는 전체 연결 수와 프로필별 최대치를 표시한다. 데스크톱 뷰와 외부 탭의 서버측 세션 수는 신뢰성 있게 알 수 없으므로 이 게이지에 포함하지 않으며 서버 429 응답도 처리한다.

### 5.3 여러 프로필의 머신 동기화
- 프로필별 조회 성공과 실패를 분리한다. 정상 응답한 프로필과 활성 데모의 최신 머신만 합쳐 표시하고, 실패한 프로필의 오래된 머신은 남기지 않는다. 실패는 프로필 이름과 함께 표시한다.
- 겹쳐 실행된 새로고침 중 먼저 시작한 요청의 늦은 결과는 나중에 시작한 요청의 상태를 덮지 않는다. 잠금·프로필 삭제도 이전 결과를 무효화한다.
- Broadcast 대상은 `(profileId, machineId)` 쌍으로 식별한다. 다른 프로필에서 같은 머신 ID가 나와도 서로 다른 대상과 출력으로 처리한다.

### 5.4 키 등록과 연결 확인
- 사용자가 키 등록을 제출하면 먼저 로컬 볼트에 암호화해 저장하고 목록 조회를 한 번 시도한다. 네트워크 또는 API 오류는 **연결 미검증** 상태로 알리되 암호화 기록을 자동 삭제하지 않는다. 사용자가 삭제 확인을 통해 직접 제거할 수 있다.
- Electron 앱은 메인 프로세스에서 InstaBox로 직접 연결한다. 키 입력 화면에서 Worker/프록시 설정을 요구하지 않는다. 연결 실패 시 암호화된 키는 보존하되 오류 종류를 표시한다.

---

## 6. 오프라인/시뮬레이션 모드 (Demo Simulation)
실제 API 키 없이도 누구나 모든 기능을 즉각 테스트할 수 있도록 `ibk_demo_swiss_dev_0123456789abcdef` 데모 키 프로필을 지원하며, 4개의 가상 microVM(Web Server, AI Agent, DB Cluster, Build Worker)과 가상 터미널 셸 응답, 가상 메트릭 차트, 가상 데스크톱 뷰를 제공합니다.
