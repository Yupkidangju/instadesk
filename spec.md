# InstaDesk 데스크톱 명세

**Document Version:** 2.2.0 (멀티세션 동시 제어·상태 인디케이터·볼트 보호 확장)
**Status:** `v2.2.0` 릴리스 준비. 멀티세션 타일(동일 VM 내 `main`/`agent`/`aux` 동시 오픈), 실시간 세션 상태 인디케이터(🔴/🟡/🟢), 라이브 PTY 동시 입력·미러링, 워크스페이스 프리셋, 볼트 미초기화 생성/10회 실패 삭제 반영. 물리 트랙패드·복수 실제 Desktop·실 API 키 원격 수용·Linux 물리 기기 설치·서명/무결성은 별도 검증 대상
**Last Updated:** 2026-11-18

---

## 1. 개요 및 목표 (Overview & Objectives)

본 프로젝트는 Windows x64, Linux x64(AMD64), Linux arm64를 대상으로 하는 Electron 데스크톱 앱이다. 기존 React 화면은 앱에 번들해 전용 `app://instadesk` Origin에서 실행한다. 사용자가 입력한 `instabox.sh` API 키(`ibk_...`)는 Web Crypto AES-256-GCM + PBKDF2로 앱 Origin의 localStorage에 암호화해 보관하고, 요청 때만 복호화한다. 실제 API와 PTY 연결은 Electron 메인 프로세스에서 고정 InstaBox 호스트로 직접 수행한다. 공용 Worker나 GitHub Pages는 런타임에 필요하지 않다.

사용자는 **네오스위스(Neo-Swiss) 인터내셔널 타이포그래피 스타일**의 정밀하고 대담한 그리드 인터페이스를 통해 복수의 Linux microVM 상태를 실시간 관제하고, 멀티 타일 분할 뷰를 통해 **실시간 인터랙티브 터미널(PTY WebSocket & SSE Exec)** 및 **그래픽 데스크톱 화면(격리된 뷰어)**을 즉시 확인하고 원격 제어할 수 있습니다.

### 핵심 성공 기준 (Success Criteria)
1. **데스크톱 구동과 배포**: Windows x64 ZIP은 포터블로, Linux x64·arm64 tar.gz는 Chromium sandbox helper의 root 소유·4755 설정을 포함한 설치 방식으로 배포한다. 사용자는 앱에서 마스터 암호와 자기 API 키를 입력한다. 브라우저 CORS 우회 설정이나 Worker 설치는 요구하지 않는다. 데모 모드는 오프라인에서도 동작한다. 세 아키텍처의 CI 패키지 로드 스모크와 GitHub Release 자산·해시를 확인한다.
2. **소비 시점 복호화(On-demand Decryption) 보안 아키텍처**:
   - 전용 `app://instadesk` Origin의 `localStorage`에는 오직 암호화된 볼트 레코드(`ciphertext`, `salt`, `iv`)만 영구 저장.
   - 평문 키는 영구 상태로 메모리에 장기 보관되지 않고, 사용자가 입력한 마스터 비밀번호로 파생된 세션 키를 통해서만 API 호출 시점에 즉시 복호화되어 소비 후 가비지 컬렉션(GC).
   - 세션 잠금(Lock) / 해제(Unlock), 사용자 입력 기준 비활성 타임아웃(기본 15분) 자동 잠금 지원. 자동 폴링·응답은 타이머를 연장하지 않는다. 잠금 시 앱이 소유한 PTY 소켓과 진행 중 요청을 종료하고 데스크톱 뷰 및 출력물을 화면에서 제거한다. 이미 외부 탭에 연 뷰어는 앱이 원격으로 취소할 수 없다.
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
   - **멀티세션 동시 관제 및 오케스트레이션**:
     - 동일 VM의 `main` / `agent` / `aux` 세션도 각각 독립된 워크스페이스 타일로 동시에 열어 병렬 제어한다.
     - 각 터미널 타일의 PTY 입출력과 쉘/AI 에이전트 프롬프트 패턴을 분석해 `running`(🔴 명령 수행 중) / `prompt`(🟡 질문·선택·승인 대기) / `idle`(🟢 완료·대기) / `disconnected`(⚪ 미연결) 상태를 산출하고, **상단 통합 세션 인디케이터 바**와 **개별 타일 상태 바**에 일관되게 표시한다.
     - 라이브 PTY 동시 제어 바를 통해 동기화(`[SYNC]`) 대상 타일(전체 / 선택 / 🟡 질문 대기 세션)에 실시간 명령 입력, 키스트로크 미러링, 원클릭 빠른 응답(`Y`, `N`, `Enter`, `1`, `2`, `Ctrl+C`, `Esc`)을 전송한다.
     - 열린 멀티세션 타일·그리드·탭 구성을 **워크스페이스 프리셋**으로 로컬 저장(비밀정보 제외) 및 복원하고, 일괄 탭 전환·재연결·클리어를 제공한다.

---

## 2. 비목표 (Non-Goals)
- 백엔드 중앙 집중형 사용자 DB 구축 (100% 클라이언트 로컬 저장 원칙).
- GitHub Pages·Cloudflare Worker 기반 브라우저 실 API 배포. 기존 Pages 사이트와 개인 Worker 게시를 Electron 대체물이 검증된 뒤 제거한다.
- macOS, Linux 32비트 ARMv7, Windows 32비트 x86 패키지와 코드 서명·자동 업데이트. Linux x64·arm64 및 Windows x64만 2.1.0 배포 대상이다.
- `instabox.sh` 서비스 자체의 인프라 변경 (공식 API 및 WebSocket 규격을 그대로 수용).
- 화려한 그라데이션, 스큐어모피즘, 불필요한 라운딩 등 네오스위스 디자인 철학에 어긋나는 장식적 요소 배제.

---

## 3. 보안 아키텍처: 로컬 저장 암호화 볼트

### 3.1 암호화 알고리즘 및 키 파생
- **암호화 표준**: `AES-GCM` (Advanced Encryption Standard in Galois/Counter Mode), 키 길이 256-bit.
- **키 파생 함수(KDF)**: `PBKDF2` (Password-Based Key Derivation Function 2)
  - 해시 함수: `SHA-256`
  - 신규 v2 반복 횟수(Iterations): `600,000`회. 기존 v1은 `100,000`회로만 읽고 성공적으로 전체 재암호화한 뒤 v2로 이행한다. 신규 마스터 암호문구는 15자 이상이다.
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
  version: 1 | 2;   // v1 읽기 호환, 신규 저장은 v2
  salt: string;        // 마스터 KDF salt (Base64)
  verifierCiphertext: string; // 암호화된 검증 토큰 (Base64)
  verifierIv: string;  // 검증 토큰 IV (Base64)
  profiles: EncryptedProfileRecord[];
  autoLockMinutes: number; // default: 15
  failedUnlockAttempts?: number; // 누적 해제 실패 횟수 (10회 이상 실패 시 볼트 자동 삭제)
}
```

기존 v1은 현재 암호로 검증하고 모든 프로필의 복호화·재암호화가 끝난 뒤 원자적 저장소 쓰기로 v2가 된다. 실패하면 원본을 보존한다. 약한 기존 암호가 강화되는 것은 아니므로 잠금 해제 후 긴 암호문구로 변경할 수 있어야 한다. 입력 중 비밀번호·키는 모달 닫기·잠금·실패 후 UI 상태에서 지운다. 자세한 순서와 검증 기준은 `docs/electron/audit_4_remediation.md`를 따른다.

볼트는 전용 `app://instadesk` Origin의 localStorage를 사용한다. 기존 GitHub Pages Origin의 저장소는 자동으로 이전하지 않으며, 사용자가 Electron 앱에 키를 다시 등록한다. 전용 Origin만으로 XSS 위험이 사라지는 것은 아니다.

Electron의 `userData`와 `sessionData`는 버전이 들어가지 않는 OS 사용자별 `InstaDesk` 앱 데이터 경로로 고정한다. 2.1.1의 v2에서도 기존 localStorage 키 `instabox_deck_vault_v1`을 유지한다. 같은 OS 사용자와 앱 Origin이라면 패키지 버전·폴더를 바꿔도 암호화 프로필이 유지된다. 기존 저장소를 발견하면 신규 볼트 초기화로 덮어쓰지 않는다.

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
3. **잠금 상태 처리 및 초기 생성/10회 실패 삭제**:
   - 볼트가 잠겨 있을 때 소비 함수 호출 시 `VaultLockedError`를 던지며 네오스위스 스타일의 마스터 패스워드 입력 모달(`MasterUnlockModal`)을 트리거.
   - 볼트에 아직 마스터 암호가 없는 초기화 상태(`!isVaultInitialized`)에서 해제 모달이 열리면 unlock 대신 **create(마스터 암호문구 생성)** 화면을 표시하고, 이미 설정된 경우(`isVaultInitialized`)에는 **unlock(잠금 해제)** 화면을 표시한다.
   - `unlock()` 시 마스터 암호가 **10회 이상** 연속 실패하면 `localStorage`의 암호화 볼트(`instabox_deck_vault_v1`)와 저장된 프로필 데이터를 즉시 영구 삭제(`resetVault`)하고 초기화 상태(`!isVaultInitialized`)로 되돌린다. 성공적으로 잠금 해제되면 실패 횟수는 `0`으로 초기화한다.

### 3.4 잠금과 프로필 삭제
- 수동/자동 잠금은 앱이 소유한 실 프로필 요청·PTY·데스크톱 타일과 Broadcast 실행·라이브 동기화 입력 바 내용·키스트로크 미러링(`isKeystrokeMirroring`)을 중단·초기화하고 해당 명령·출력을 지운다. 이후 잠금 해제 전 재연결하지 않는다.
- 워크스페이스 프리셋(`instabox_deck_presets_v1`)은 타일 배치 메타데이터(`machineId`, `profileId`, `activeTab`, `terminalSessionName`, `desktopViewOnly`, `gridMode`)만 보관하며 API 키·암호·명령 입력값·터미널 출력은 저장하지 않는다. 로드·적용 시 각 타일 필드 스키마와 열거값을 검증·정규화하고 중복 세션을 제거한다. 잠금 상태에서 실 프로필 전용 프리셋을 적용하려 할 때는 잠금 해제 모달을 열어 잠금 해제를 유도하며, 혼합 프리셋이면 데모 타일만 복원한다.
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
- 실제 Desktop 뷰는 가용 패널 전체를 차지하고 대시보드가 실제 framebuffer의 화면비를 유지하며 영상을 맞춘다. 서버 상태가 보고한 해상도와 실제 framebuffer가 다를 수 있으므로 앱은 보고 해상도로 네이티브 뷰 높이를 제한하지 않는다. 데모 미리보기는 논리 크기를 `fitDesktop`으로 맞춘다.
- 여러 타일로 작업 영역이 스크롤되면 실제 Desktop 네이티브 뷰는 해당 타일을 따라 이동한다. 타일의 Desktop 자리가 스크롤 영역 밖 또는 일부만 보일 때는 네이티브 뷰를 숨겨 다른 타일·헤더를 덮지 않고, 다시 완전히 보이면 같은 스트림을 표시한다. 이때 Desktop 위 일반 휠은 작업 영역, `Alt+휠`은 원격 Desktop을 스크롤한다. 작업 영역에 스크롤이 없으면 일반 휠은 원격 Desktop으로 전달한다. 상세 계약은 `docs/electron/desktop_scroll_2_1_2.md`를 따른다.
- 터미널 위 일반 휠/트랙패드는 xterm 기록만 스크롤하고 끝 경계에서 작업 영역으로 연쇄 전달하지 않는다. `Shift+휠`은 작업 영역을 움직인다. 1×1 포커스나 TERM↔다른 탭/SPLIT 왕복에서는 같은 타일·세션의 최근 기록과 읽던 위치를 제한된 메모리 안에서 복원하고 PTY는 숨김 때 닫는다. 수동/일괄 `RECONNECT` 시에는 해당 세션의 직전 캐시를 비우고 재저장하지 않아 중복 배너/프롬프트 누적을 방지한다. 타일 닫기·프로필 삭제·볼트 잠금에서는 기록을 지운다. 구체적 상한·비목표는 `docs/electron/audit_5_remediation.md`를 따른다.
- 동일 VM의 여러 세션 타일이 동시에 `DESKTOP` 또는 `SPLIT`을 열 때는 각 타일의 `tileId` 기반 독립 네이티브 뷰 ID(`desktop_${tileId}`)를 사용하여 좌표·가시성·종료 생명주기가 타일 간 충돌하지 않게 격리한다.

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
- 현행 InstaBox OpenAPI는 **user당 열린 PTY 최대 8개**를 명시한다 (`429 quota_exceeded`). Desktop과 SSE `exec`를 이 PTY 한도에 합산한다는 근거는 없다.
- 앱은 자신이 시도하거나 연 PTY 수만 표시한다. 여러 프로필이 같은 user 소속인지 및 외부 클라이언트의 PTY 수는 알 수 없으므로 로컬 카운트로 서버 한도를 강제하지 않는다. 최종 거절은 서버 응답을 진단 가능하게 표시한다.

### 5.3 여러 프로필의 머신 동기화
- 프로필별 조회 성공과 실패를 분리한다. 정상 응답한 프로필과 활성 데모의 최신 머신만 합쳐 표시하고, 실패한 프로필의 오래된 머신은 남기지 않는다. 실패는 프로필 이름과 함께 표시한다.
- 겹쳐 실행된 새로고침 중 먼저 시작한 요청의 늦은 결과는 나중에 시작한 요청의 상태를 덮지 않는다. 잠금·프로필 삭제도 이전 결과를 무효화한다.
- Broadcast 대상은 `(profileId, machineId)` 쌍으로 식별한다. 다른 프로필에서 같은 머신 ID가 나와도 서로 다른 대상과 출력으로 처리한다.

### 5.4 키 등록과 연결 확인
- 사용자가 키 등록을 제출하면 먼저 로컬 볼트에 암호화해 저장하고 목록 조회를 한 번 시도한다. 네트워크 또는 API 오류는 **연결 미검증** 상태로 알리되 암호화 기록을 자동 삭제하지 않는다. 사용자가 삭제 확인을 통해 직접 제거할 수 있다.
- Electron 앱은 메인 프로세스에서 InstaBox로 직접 연결한다. 키 입력 화면에서 Worker/프록시 설정을 요구하지 않는다. 연결 실패 시 암호화된 키는 보존하되 오류 종류를 표시한다.

### 5.5 멀티세션 동시 제어 및 세션 상태 인디케이터 규격
- **세션 상태 분류(휴리스틱 기반, 보수적 판정)**:
  - `running` (🔴 빨강): 명령 실행 입력(`\r`/`\n`) 직후 또는 진행 중 출력(프롬프트 미복귀, 스피너, `Thinking`/`Running`) 상태.
  - `prompt` (🟡 노랑): 쉘 확인 프롬프트(`[y/N]`, `(y/n)`, `password:`, `Press Enter`) 또는 AI 에이전트/TUI 승인·선택 프롬프트(`Allow`, `Approve`, 번호 선택 목록 등) 감지 시 전환하며 감지된 마지막 프롬프트 줄 요약을 함께 보관한다.
  - `idle` (🟢 초록): 쉘 프롬프트(`user@host:...$`, `#`, `❯`, `>>>` 등) 또는 대기 입력 프롬프트가 출력 끝에서 확인될 때 전환한다.
  - `disconnected` (⚪ 회색): PTY 미연결/종료/오류 상태.
- **동일 VM 다중 세션 타일**:
  - `addTile`에 `sessionName`을 명시하거나 `addNextSessionTile`을 호출하면 같은 `(profileId, machineId)`라도 서로 다른 세션(`main`, `agent`, `aux`) 타일을 동시에 생성한다.
  - 동일 `(profileId, machineId, terminalSessionName)` 조합은 타일 추가 시뿐만 아니라 타일 내부 세션 전환(`setTileSessionName`) 및 프리셋 복원에서도 중복 WebSocket 충돌(`taken`)을 막기 위해 이미 열린 타일로 포커스를 이동한다.
- **라이브 PTY 동기화 입력 및 미러링**:
  - 사용자는 타일 단위 `[SYNC]` 토글 또는 전역 선택(`ALL`, `SYNCED`, `PROMPTS`)을 통해 라이브 PTY 입력을 다수 타일에 동시 전송한다. 단일 키 입력뿐 아니라 개행(`\r`/`\n`)이 포함된 명령·빠른 응답 문자열도 데모/실제 PTY 모두에서 순차 실행되며, 전송된 대상이 0건(`0/N`)일 때는 입력창 내용을 유지한다.
  - 키스트로크 미러링(`MIRROR`)이 켜져 있을 때, 동기화 그룹에 속한 한 터미널에 직접 입력한 데이터는 자기 자신을 제외한 나머지 동기화 타일의 PTY로 실시간 전달된다. 단, 동기화 타일 중 하나라도 암호/패스프레이즈/PIN/OTP 입력 프롬프트(`isSensitive`) 상태이면 평문 비밀이 다른 타일로 복제되지 않도록 미러링을 일시 차단한다.

---

## 6. 오프라인/시뮬레이션 모드 (Demo Simulation)
실제 API 키 없이도 누구나 모든 기능을 즉각 테스트할 수 있도록 `ibk_demo_swiss_dev_0123456789abcdef` 데모 키 프로필을 지원하며, 4개의 가상 microVM(Web Server, AI Agent, DB Cluster, Build Worker)과 가상 터미널 셸 응답, 가상 메트릭 차트, 가상 데스크톱 뷰를 제공합니다.
