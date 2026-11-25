# D3D Audit Report — InstaDesk v2.2.0 전체 감사 및 Audit 7 재감사 (Audit 8)

- **작성일:** 2026-11-25 (Asia/Seoul)
- **프로젝트 경로:** `D:\web\instadesk`
- **대상 리비전:** `main` / `origin/main` `42f3148` (`feat: add multi-session control, status indicators, and vault wipe guard`), 공개 태그 `v2.2.0`
- **감사 기준:** `AI_AUDIT_DOC_STANDARD.md` (3-Pass 전체감사 및 §16 Re-audit Rules), `AGENTS.md`, `spec.md` (v2.2.0), `designs.md` (v1.1.0), `DESIGN_DECISIONS.md` (v1.1.0), `audit_roadmap.md`
- **대상 범위:**
  1. `v2.2.0` 공개 릴리스(`42f3148`) 및 3개 아키텍처 CI/자산 정합성 검증
  2. 직전 감사(`docs/audit/audit_report_7.md`) 잔여 finding(`SEC-F010`, `SEC-F012`) 재감사
  3. 전체 코드베이스(`src/`, `electron/`, `scripts/`, `.github/workflows/`, 문서)에 대한 3-Pass 감사
- **Final Decision:** **`PASS WITH KNOWN RISKS`** (`Critical` 0건, `Major` 0건; `Minor` 7건: `IMP-F015`, `DBG-F020`~`DBG-F023`, `SEC-F012`, `SEC-F013` 후속 개선 대상 기록)

---

## 1. Audit Scope

### 1.1 프로젝트 및 환경 인벤토리
- **프로젝트 유형:** Electron Desktop Application (`Electron 45.2.1` + `React 18.3.1` + `TypeScript 5.6.3` + `Vite 8.3.5` + `Zustand 5.0.0` + `@xterm/xterm 5.5.0`)
- **Git 상태:** 작업 트리 깨끗함(`main` = `origin/main` = `42f3148`, 태그 `v2.2.0` 일치)
- **확인한 문서:**
  - `spec.md` (v2.2.0), `designs.md` (v1.1.0), `README.md` (v2.2.0), `CHANGELOG.md` (2.2.0), `DESIGN_DECISIONS.md` (v1.1.0), `IMPLEMENTATION_SUMMARY.md`, `BUILD_GUIDE.md`, `LINUX_SETUP.md`, `audit_roadmap.md`, `docs/releases/v2.2.0.md`, `docs/audit/audit_report_6.md`, `docs/audit/audit_report_7.md`
- **확인한 소스·스크립트·CI·테스트 파일:**
  - Renderer (`src/`): `App.tsx`, `index.css`, `types/{instabox.ts,vault.ts}`, `store/useAppStore.ts`, `services/{cryptoVault.ts,instaboxClient.ts}`, `components/{HeaderBar.tsx,SidebarVmList.tsx,WorkspaceGrid.tsx,VmTilePane.tsx,SplitWorkspaceView.tsx,SessionCommandBar.tsx}`, `components/desktop/DesktopScreenView.tsx`, `components/terminal/{TerminalView.tsx,ExecRunnerView.tsx,sessionActivity.ts,terminalRegistry.ts,terminalHistoryCache.ts}`, `components/telemetry/{MetricsLogsView.tsx,ProcessListView.tsx}`, `components/modals/{ApiKeyModal.tsx,MasterUnlockModal.tsx,BroadcastExecModal.tsx,CreateVmModal.tsx}`
  - Electron (`electron/`): `main.ts`, `preload.ts`, `apiGateway.ts`, `appProtocol.ts`, `terminalGateway.ts`, `desktopViewGateway.ts`, `desktopViewPolicy.ts`, `userDataPath.ts`
  - Build/Release/CI: `package.json`, `package-lock.json`, `vite.config.ts`, `scripts/{build-electron.mjs,package-win.mjs,package-linux.mjs,render-linux-setup.mjs,verify-release-assets.mjs}`, `.github/workflows/desktop.yml`
  - Tests (`test/`): 전체 31개 테스트 파일 (121개 테스트)

### 1.2 실행한 검증 명령 및 결과

| 명령 | CWD | Exit Code | 결과 요약 |
| --- | --- | :---: | --- |
| `git status --short; git log -n 10 --oneline` | `D:\web\instadesk` | `0` | 작업 트리 깨끗함, `HEAD` = `42f3148` (`v2.2.0`) |
| `npm run typecheck` | `D:\web\instadesk` | `0` | `tsc --noEmit` 오류 0건 |
| `npm test` | `D:\web\instadesk` | `0` | **31개 테스트 파일, 121개 테스트 전체 통과** |
| `npm run build` | `D:\web\instadesk` | `0` | 렌더러(`dist/`, 단일 JS 청크 609.69 kB 경고 존재) 및 Electron(`dist-electron/`) 번들 성공 |
| `npm audit --omit=dev` | `D:\web\instadesk` | `0` | 배포 런타임 의존성 취약점 **0건** |
| `npm audit --audit-level=high` | `D:\web\instadesk` | `0` | 전체 의존성 High 이상 취약점 **0건** |
| 정적 보안 패턴 스캔 (`innerHTML`, `dangerouslySetInnerHTML`, `eval(`, `new Function`, `process.env`) | `D:\web\instadesk` | `0` | `src/`, `electron/` 내 매치 **0건** |
| `gh run list --limit 5` | `D:\web\instadesk` | `0` | `main` CI `44217222185` (`completed/success`), `v2.2.0` 태그 CI `44217221914` (`completed/success`) 확인 |
| `gh release view v2.2.0` | `D:\web\instadesk` | `0` | `isDraft: false`, `isPrerelease: false`; 4개 자산 업로드 및 SHA-256 다이제스트 확인 |

### 1.3 공개 `v2.2.0` 릴리스 자산 증거

| 자산 | 크기 (bytes) | SHA-256 Digest |
| --- | ---: | --- |
| `InstaDesk-2.2.0-win-x64.zip` | 158,414,834 | `4a46fa0bb3010cd895c142763bce810a4b00be9776eef031a3612d0ba5dc2a8c` |
| `InstaDesk-2.2.0-linux-x64.tar.gz` | 124,064,227 | `4c61dc229cb825af8cc90e00b21a155b024436353582a9582d4582143ef0106b` |
| `InstaDesk-2.2.0-linux-arm64.tar.gz` | 125,143,728 | `82cc1fe419b26c0583b44fce3e28cee76c17613930dda6fe1e846beefde2b9d1` |
| `SHA256SUMS.txt` | 294 | `5093c5407e21b318984ff55d95901500918ebc76624dbb7f127dd3c4ccba48b8` |

---

## 2. Excluded Scope

- `node_modules/`, `node_modules.audit1-backup/`, `node_modules.audit3-interrupted/`, `dist/`, `dist-electron/`, `release/`, `.git/`: 벤더·빌드 산출물 디렉터리이므로 직접 소스 감사는 제외하고 매니페스트·스크립트·CI 증거 기준으로 검증했다.
- 실 `instabox.sh` 유료 API 키를 사용한 라이브 서버 변경 API(`start`/`stop`/`suspend`/`resume`/`delete`), 실 원격 `WebContentsView` 다중 입력/Alt+휠, 물리 Linux x64/arm64 기기 설치는 로컬 감사 환경 범위 밖이므로 제외했다(`audit_roadmap.md` 기준에 따라 실 서비스 수용은 별도 유지).

---

## 3. Pass 1: Implementation Compliance Findings

### 3.1 직전 감사(Audit 7) 재감사 요약
- Audit 6/7의 멀티세션·볼트 기능(`IMP-F012`~`IMP-F014`, `DBG-F017`~`DBG-F019`, `SEC-F009`, `SEC-F011`, Decision 14~15)은 `42f3148`에 회귀 없이 반영되어 있으며 121개 테스트가 모두 통과했다.
- `SEC-F010 (Re-audit #2)`: **Verified** (`.github/workflows/desktop.yml:39`가 `npm audit --omit=dev --audit-level=high`로 수정되었으며, 로컬 기준 `npm audit --omit=dev` 및 `npm audit --audit-level=high` 모두 취약점 0건 확인).

### [IMP-F015] `v2.2.0` 릴리스 이후 `BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md` 버전 및 증거 미동기화

- **Pass:** Implementation
- **Pattern:** `IMP-004`, `BUILD-001`
- **Area:** 2차 운영·빌드·감사 문서 동기화 (`BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `package.json`(2.2.0), `README.md`, `CHANGELOG.md`, `docs/releases/v2.2.0.md` 및 GitHub Release `v2.2.0`은 모두 `2.2.0`으로 갱신되었으나, `BUILD_GUIDE.md`의 공개 파일 검증/패키지 설치 명령은 여전히 `2.1.3` 파일명을 사용하고 있고 `audit_roadmap.md`와 `IMPLEMENTATION_SUMMARY.md` 헤더도 `2.1.3` 기준에 머물러 있다.
- **Evidence:**
  - `BUILD_GUIDE.md:19, 22, 35, 47, 62, 74`: `InstaDesk-2.1.3-win-x64.zip`, `InstaDesk-2.1.3-linux-x64`, `release/InstaDesk-2.1.3-win-x64/`, `v2.1.3`이 그대로 남아 있다.
  - `audit_roadmap.md:12`: 마지막 릴리스 항목이 `감사 5 수정·2.1.3`이며 `v2.2.0` 릴리스(CI `44217221914`, `audit_report_6.md`·`audit_report_7.md`) 행이 없다.
  - `IMPLEMENTATION_SUMMARY.md:1, 46`: 제목이 `# InstaDesk 구현 요약 (v2.1.3 + 멀티세션 제어 확장)`으로 남아 있고, 검증 테스트 목록에 `test/terminalLiveDemoIntegration.test.tsx`와 `test/vaultUnlockCreateAndWipe.test.tsx`가 누락되어 있다.
- **Expected:** `BUILD_GUIDE.md`의 예시 파일명·태그가 현행 `package.json` 버전(`2.2.0`)과 일치해야 하며, `audit_roadmap.md`와 `IMPLEMENTATION_SUMMARY.md`가 `v2.2.0` 릴리스 증거와 테스트 책임표를 반영해야 한다.
- **Actual:** `BUILD_GUIDE.md` 명령을 `v2.2.0` 다운로드 폴더나 로컬 `package:linux` 산출물에 그대로 실행하면 `2.1.3` 파일을 찾아 실패한다.
- **Impact:** 사용자가 `BUILD_GUIDE.md`의 체크섬/설치 명령을 그대로 복사·실행할 때 파일 불일치가 발생하며 2차 문서와 현행 릴리스 버전이 어긋난다.
- **Suggested Fix:** `BUILD_GUIDE.md`의 `2.1.3` 참조를 `2.2.0`(또는 `package.json`에서 버전을 읽는 표현)으로 갱신하고, `audit_roadmap.md`에 `v2.2.0` 릴리스·CI·감사 6~8 증거 행을 추가하며 `IMPLEMENTATION_SUMMARY.md` 제목과 테스트 목록을 동기화한다.
- **Re-audit Method:** `BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md`와 `package.json` 버전(`2.2.0`) 및 테스트 파일 목록 대조.
- **Owner:** Coder

---

## 4. Pass 2: Debug / Engineering Quality Findings

### [DBG-F020] 텔레메트리 패널(`MetricsLogsView`, `ProcessListView`)의 비동기 요청 취소 누락, 오류 침묵 및 `Promise.all` 부분 실패 결합

- **Pass:** Debug
- **Pattern:** `DBG-002`
- **Area:** 텔레메트리 UI (`src/components/telemetry/MetricsLogsView.tsx`, `src/components/telemetry/ProcessListView.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `MetricsLogsView`는 API 실패 시 `console.error`만 남기고 화면에 오류를 표시하지 않으며 `Promise.all`로 로그와 메트릭을 묶어 한쪽 실패 시 다른 쪽 정상 응답도 버린다. 또한 `MetricsLogsView`와 `ProcessListView` 모두 언마운트/대상 변경 시 늦게 도착한 응답을 무시하는 세대(generation)·취소 가드가 없다.
- **Evidence:**
  - `src/components/telemetry/MetricsLogsView.tsx:18-38`: `Promise.all([getLogs, getMetrics])` 사용, `catch` 블록에서 UI 상태 갱신 없이 `console.error('Failed to load telemetry:', err)`만 호출, `setInterval(loadData, 15000)`에 중복 실행 방지 및 언마운트 가드 부재.
  - `src/components/telemetry/ProcessListView.tsx:17-32`: `useEffect` cleanup에서 언마운트 또는 `(machineId, profileId)` 변경 후 도착한 이전 `getProcesses` 응답을 무시하는 가드가 없다.
- **Expected:** 로그와 메트릭을 `Promise.allSettled` 등으로 독립 반영하고 실패 시 사용자에게 오류 배너를 표시해야 하며, 언마운트/대상 변경 시 이전 비동기 응답이 상태를 덮지 않아야 한다.
- **Actual:** 메트릭 조회 실패 시 콘솔 로그까지 비어 보이고 오류가 UI에 드러나지 않으며, 탭 전환·머신 변경 시 늦은 응답 경합 가능성이 있다.
- **Impact:** 정지/일시정지 상태나 부분 API 오류 시 사용자가 원인을 파악하기 어렵고 불필요한 상태 갱신이 발생할 수 있다.
- **Suggested Fix:** `MetricsLogsView`에 오류 상태 배너와 `Promise.allSettled` 부분 성공 처리를 추가하고, 두 컴포넌트에 요청 세대(`requestIdRef`) 또는 `AbortController` 기반 취소 가드를 적용한다.
- **Re-audit Method:** 부분 API 실패 및 탭 전환 중 늦은 응답 시나리오 단위 테스트 추가 및 통과 확인.
- **Owner:** Coder

### [DBG-F021] `DesktopScreenView`의 `loadDesktop` 비동기 세대 가드 부재로 인한 스트림 URL 경합 가능성

- **Pass:** Debug
- **Pattern:** `DBG-002`
- **Area:** 데스크톱 스트림 로더 (`src/components/desktop/DesktopScreenView.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `DesktopScreenView.tsx`의 `loadDesktop()`은 요청 세대(generation)나 언마운트/취소 확인 없이 `desktopAction`과 `createDesktopStreamLink` 결과를 상태에 반영하므로, `viewOnly` 토글·새로고침 연타·VM 상태 전환(`running -> suspended`) 중 먼저 시작한 요청의 늦은 응답이 최신 상태를 덮어쓸 수 있다.
- **Evidence:**
  - `src/components/desktop/DesktopScreenView.tsx:80-109`: `useEffect`가 `[machineId, profileId, viewOnly, machineReady]` 변경마다 `loadDesktop()`을 호출하지만 이전 호출의 무효화 토큰이 없다.
- **Expected:** 마지막으로 시작된 `loadDesktop` 호출만 `desktopStatus`, `streamUrl`, `errorMessage`, `isLoading`을 갱신해야 한다.
- **Actual:** 두 요청이 겹칠 경우 먼저 시작한 요청이 늦게 완료되면 `streamUrl`과 `desktopStatus`를 과거 값으로 덮어쓴다.
- **Impact:** `INTERACTIVE`/`VIEW-ONLY` 빠른 전환이나 VM 중지 직후 잘못된 스트림 URL이 열리거나 로딩 상태가 어긋날 수 있다.
- **Suggested Fix:** `loadGenerationRef`를 증가시켜 최신 세대이면서 컴포넌트가 마운트 상태일 때만 상태를 갱신한다.
- **Re-audit Method:** `viewOnly` 전환 또는 `machineReady` 변경 중 지연된 이전 `createDesktopStreamLink` 응답이 무시되는지 회귀 테스트로 확인한다.
- **Owner:** Coder

### [DBG-F022] `CreateVmModal`의 생성 성공/재오픈 시 이전 VM 이름 입력값 미초기화

- **Pass:** Debug
- **Pattern:** `DBG-002`
- **Area:** VM 생성 모달 (`src/components/modals/CreateVmModal.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `CreateVmModal`이 VM 생성 성공 후 또는 모달을 다시 열 때 `name` 상태를 초기화하지 않아, 연속으로 새 VM을 생성할 때 직전에 만든 VM 이름이 그대로 남아 있다.
- **Evidence:**
  - `src/components/modals/CreateVmModal.tsx:26-31, 45-55`: `useEffect`에서 `profileId`와 `errorMsg`만 초기화하고 `setName('')`을 호출하지 않는다. `handleCreate` 성공 후에도 `closeCreateVmModal()`만 호출한다.
- **Expected:** VM 생성 완료 후 또는 모달이 새로 열릴 때 `name` 입력값이 빈 문자열로 초기화되어야 한다.
- **Actual:** 이전 VM 이름이 입력창에 그대로 남아 있어 사용자가 지우지 않고 제출하면 중복 이름 충돌(409)이 발생할 수 있다.
- **Impact:** 연속 VM 프로비저닝 시 불필요한 오류 및 사용자 실수 유발.
- **Suggested Fix:** `useEffect`의 모달 오픈 분기 및 `handleCreate` 성공 시 `setName('')`을 추가한다.
- **Re-audit Method:** `test/createVmModal.test.tsx`에 연속 생성/재오픈 시 `name` 초기화 확인 추가.
- **Owner:** Coder

### [DBG-F023] `SidebarVmList`의 VM 전원 제어·삭제 액션 오류 미처리 및 중복 클릭 방지 부재

- **Pass:** Debug
- **Pattern:** `DBG-002`
- **Area:** 사이드바 머신 제어 (`src/components/SidebarVmList.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `SidebarVmList.tsx`의 `handleAction`(start/stop/suspend/resume)과 `handleDelete`에 `try/catch` 오류 처리와 진행 중 비활성화 가드가 없어, API 실패 시 미처리 Promise 거부(unhandled rejection)가 발생하고 사용자에게 실패 원인이 표시되지 않으며 더블클릭 시 새 `Idempotency-Key`로 중복 변경 요청이 전송된다.
- **Evidence:**
  - `src/components/SidebarVmList.tsx:101-111`:
    ```tsx
    const handleAction = async (e: React.MouseEvent, m: InstaboxMachine, action: 'start' | 'stop' | 'suspend' | 'resume') => {
      e.stopPropagation();
      await controlMachine(m.id, m.profileId, action);
    };
    ```
  - `src/services/instaboxClient.ts:280, 299`: 호출마다 `crypto.randomUUID()`로 새 `Idempotency-Key`를 생성하므로 UI에서 중복 클릭을 막지 않으면 서버 측 멱등성 보호가 적용되지 않는다.
- **Expected:** 머신 제어/삭제 중에는 해당 머신의 액션 버튼을 비활성화(또는 단일 실행 잠금)하고, 실패 시 예외를 잡아 사이드바 상태 영역에 오류 메시지를 표시해야 한다.
- **Actual:** 실패 시 무응답(콘솔 unhandled rejection)이며 연속 클릭 시 중복 제어 요청이 발사된다.
- **Impact:** 실 API 환경에서 전원 제어/삭제 실패 원인을 알 수 없고 더블클릭으로 인한 불필요한 API 오류(409 등)가 발생할 수 있다.
- **Suggested Fix:** `pendingMachineKeys` 상태와 `actionError` 배너를 추가하고 `handleAction`/`handleDelete`를 `try/catch/finally`로 감싼다.
- **Re-audit Method:** 실패하는 `controlMachine`/`deleteMachine` 모킹 시 UI 오류 표시 및 진행 중 중복 클릭 차단 단위 테스트로 확인한다.
- **Owner:** Coder

---

## 5. Pass 3: Security Findings

### 5.1 직전 감사(Audit 7) `SEC-F010` 재감사 결과
- **`[SEC-F010]` (Re-audit #2): `Verified`** — `.github/workflows/desktop.yml:39`가 `npm audit --omit=dev --audit-level=high`로 갱신되었고, 현재 `npm audit --omit=dev`와 `npm audit --audit-level=high` 모두 `found 0 vulnerabilities`를 반환한다.

### [SEC-F012] (Re-audit #1 — `Info` → `Minor` 상향) `ApiKeyModal` 잠금 해제 중복 제출 미차단 및 `cryptoVault.unlock()` 실패 카운터 경합

- **Pass:** Security
- **Pattern:** `SEC-001`
- **Area:** 볼트 잠금 해제 실패 카운터 (`src/components/modals/ApiKeyModal.tsx`, `src/services/cryptoVault.ts`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `MasterUnlockModal`은 `isSubmitting`으로 중복 제출을 막지만 `ApiKeyModal`의 `handleUnlock`에는 제출 중 잠금(`disabled`)이 없다. 동시에 `cryptoVault.unlock()`의 `catch` 블록이 PBKDF2 파생 전 스냅샷(`raw`)을 기준으로 `failedUnlockAttempts`를 계산하고 `localStorage.getItem(STORAGE_KEY) !== raw`이면 카운트 증가를 건너뛰므로, `ApiKeyModal`에서 `UNLOCK`을 빠르게 연타하면 동시 실패 시도가 10회 카운터에 누락될 수 있다. 또한 10회 도달 시 `resetVault()` 호출 직전에는 `localStorage.getItem(STORAGE_KEY) === raw` 확인이 없다.
- **Evidence:**
  - `src/components/modals/ApiKeyModal.tsx:105-118, 267-270`: `handleUnlock`에 진행 중 플래그가 없고 `<button type="submit">`에 `disabled` 속성이 없다(`handleInitVault`, `handleChangePassword`도 동일).
  - `src/services/cryptoVault.ts:169, 177, 195-216`: `raw`를 `await this.deriveKey(...)` 전에 읽고, 실패 시 `vaultData.failedUnlockAttempts` 스냅샷에 `+ 1`을 계산한다. 동시 호출이 겹치면 첫 번째 호출이 저장소를 갱신한 뒤 나머지 호출은 `210행`의 `localStorage.getItem(STORAGE_KEY) === raw`가 거짓이 되어 실패 횟수를 기록하지 않는다.
- **Expected:** `ApiKeyModal`의 볼트 생성/해제/암호 변경 폼도 제출 중 중복 요청을 차단해야 하며, `cryptoVault.unlock()` 실패 시에는 최신 `localStorage`의 동일 볼트(`salt`·`verifierCiphertext` 일치)를 다시 읽어 최신 `failedUnlockAttempts`를 기준으로 누적하고 10회 도달 시에만 `resetVault()`를 실행해야 한다.
- **Actual:** `ApiKeyModal`에서 빠른 연타로 동시 `unlock()`이 실행될 수 있고, 겹친 실패 시도가 카운터에 누적되지 않는다.
- **Impact:** 10회 실패 자동 파기(Decision 15)의 카운터 정확도가 동시 호출 상황에서 약화된다.
- **Suggested Fix:**
  1. `ApiKeyModal.tsx`에 `isVaultSubmitting` 상태를 추가해 `handleInitVault`, `handleUnlock`, `handleChangePassword` 실행 중 중복 제출을 차단한다.
  2. `cryptoVault.ts`의 `unlock()` `catch` 블록에서 최신 저장소 레코드를 다시 읽고(`latest.salt === vaultData.salt && latest.verifierCiphertext === vaultData.verifierCiphertext`), 최신 `failedUnlockAttempts + 1` 기준으로 갱신 또는 `resetVault()`를 수행한다.
- **Re-audit Method:** `cryptoVault.unlock()` 2회 이상 병렬 실패 호출 시 `failedUnlockAttempts`가 정확히 호출 수만큼 누적되는지 단위 테스트로 검증한다.
- **Owner:** Coder

### [SEC-F013] API 게이트웨이(`/instabox-api/v1/*`) 및 `instaboxClient`의 `machineId` 경로 인코딩·경로 순회 방어 보강 필요

- **Pass:** Security
- **Pattern:** `SEC-004`
- **Area:** 메인 프로세스 API 프록시 및 클라이언트 경로 조합 (`electron/apiGateway.ts`, `src/services/instaboxClient.ts`, `src/store/useAppStore.ts`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `electron/appProtocol.ts`와 `electron/terminalGateway.ts`는 인코딩된 경로 구분자(`/%(?:2f|5c|00)/i`)와 허용 식별자 형식을 엄격히 차단하는 반면, `electron/apiGateway.ts`는 `/instabox-api/v1/` 접두사만 검사하고 `src/services/instaboxClient.ts`는 `machineId`를 검증·인코딩 없이 URL 경로에 직접 삽입한다. `useAppStore.ts`의 `sanitizePresetTile`도 `localStorage`에서 읽은 `machineId`의 문자 집합을 제한하지 않는다.
- **Evidence:**
  - `electron/apiGateway.ts:15-18, 30`: `incoming.pathname.startsWith('/instabox-api/v1/')`만 확인하며 `/%(?:2f|5c|00)/i` 거부나 `/v1/machines` 경로 범위 제한이 없다.
  - `src/services/instaboxClient.ts:219, 277, 296, 326, 348, 371, 472, 595, 615, 638`: `/v1/machines/${machineId}/...`에 `encodeURIComponent`나 ID 패턴 검사가 없다.
  - `src/store/useAppStore.ts:23-35`: `sanitizePresetTile`이 `machineId` 길이(`<= 128`)만 확인하고 `/`, `?`, `#`, `..` 포함 문자열을 허용한다.
- **Expected:** `machineId`는 경로 세그먼트 안전한 형식(`/^[A-Za-z0-9_-]{1,128}$/` 또는 `encodeURIComponent`)으로 강제되고, `electron/apiGateway.ts`도 `appProtocol.ts`/`terminalGateway.ts`와 동일한 수준으로 인코딩된 구분자(`/%(?:2f|5c|00)/i`) 및 허용 API 경로(`/v1/machines` 하위)를 검증해야 한다.
- **Actual:** 손상되거나 변조된 `localStorage` 프리셋의 `machineId`(예: `../other-endpoint`)가 `instaboxClient`를 거쳐 `/v1/` 내 의도치 않은 엔드포인트로 정규화·전달될 수 있다.
- **Impact:** 로컬 저장소 변조 시 `api.instabox.sh/v1/*` 범위 내 비의도 경로 호출 가능성(단, 호스트 고정 및 Bearer 인증 범위 내로 국한).
- **Suggested Fix:**
  1. `electron/apiGateway.ts`에서 `/%(?:2f|5c|00)/i`를 거부하고 허용 경로를 `/v1/machines` (및 하위 경로)로 제한한다.
  2. `src/services/instaboxClient.ts`에서 `machineId`를 검증/인코딩(`encodeURIComponent`)하고 `useAppStore.ts`의 `sanitizePresetTile`에서 `machineId`·`profileId` 문자 집합(`/^[A-Za-z0-9_-]{1,128}$/`)을 검증한다.
- **Re-audit Method:** `test/electronApiGateway.test.ts`와 `test/multiSessionControl.test.tsx`에 `../` 및 `%2f` 포함 `machineId`/URL 거부 테스트를 추가해 검증한다.
- **Owner:** Coder

---

## 6. Cross-Pass Conflicts

- 이번 감사에서 Pass 간 상충하는 `Critical`/`Major` 충돌은 없다.
- 보안 경계와 빌드/운영 문서 간 경미한 정합성 보완 항목(`IMP-F015`, `SEC-F012`, `SEC-F013`)은 각각 해당 Pass finding으로 분리 기록되었다.

---

## 7. Required Fixes Before PASS

- `Critical` / `Major` 차단급 finding은 **0건**이다.
- 다음 마이너/패치 릴리스(`v2.2.1`) 전 권장 수정 목록 (`Minor` 7건):
  1. **`[IMP-F015]`:** `BUILD_GUIDE.md`의 `2.1.3` 파일명/태그를 `2.2.0`으로 갱신하고 `audit_roadmap.md` 및 `IMPLEMENTATION_SUMMARY.md`에 `v2.2.0` 증거·테스트 목록 반영.
  2. **`[SEC-F012]`:** `ApiKeyModal.tsx` 볼트 폼 중복 제출 방지 및 `cryptoVault.unlock()` 실패 카운터 최신 저장소 재확인·누적 보강.
  3. **`[SEC-F013]`:** `electron/apiGateway.ts` 경로 검증(`/v1/machines` 범위 및 `%2f`/`%5c`/`%00` 차단) 및 `instaboxClient.ts`·`sanitizePresetTile`의 `machineId` 검증/인코딩 추가.
  4. **`[DBG-F020]`:** `MetricsLogsView.tsx` 오류 UI 표시·`Promise.allSettled` 분리 및 `MetricsLogsView`/`ProcessListView` 언마운트/세대 가드 추가.
  5. **`[DBG-F021]`:** `DesktopScreenView.tsx` `loadDesktop` 요청 세대 가드 추가.
  6. **`[DBG-F022]`:** `CreateVmModal.tsx` 생성 후/재오픈 시 `name` 입력 초기화.
  7. **`[DBG-F023]`:** `SidebarVmList.tsx` `handleAction`/`handleDelete` 오류 처리 및 머신별 진행 중 중복 클릭 방지.

---

## 8. Accepted Risks / Known Limitations

- 이번 감사에서 새로 수용한 `Accepted Risk`는 없다.
- 기존 `audit_roadmap.md` 및 `DESIGN_DECISIONS.md` Decision 11~13에 명시된 알려진 제한 사항(미서명 포터블 아카이브와 SHA-256 절차, ASAR/Fuses 및 `safeStorage` 후속 마일스톤 검토, 부분 가시 영역의 네이티브 Desktop 뷰 숨김, 실 API 키를 통한 원격 서버 변경 API/Desktop 입력 수동 수용 미완료)은 기존 정책대로 유지한다.
- Vite 프로덕션 번들 단일 JS 청크 크기 경고(`609.69 kB > 500 kB`)는 기능·보안 결함은 아니며 추후 코드 스플리팅 최적화 후보(`Info`)로 기록한다.

---

## 9. Needs Spec Clarification

- 없음.

---

## 10. Re-audit Checklist

- [x] `SEC-F010` (Re-audit #2): `.github/workflows/desktop.yml:39` `--omit=dev --audit-level=high` 적용 및 `npm audit --omit=dev`·`npm audit --audit-level=high` 취약점 0건 확인
- [x] `v2.2.0` 공개 릴리스 및 CI: `main` CI (`44217222185`), `v2.2.0` 태그 CI (`44217221914`), 4개 공개 자산·SHA-256 확인
- [ ] `IMP-F015`: `BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md`의 `2.2.0` 동기화 확인
- [ ] `SEC-F012`: `ApiKeyModal` 중복 제출 차단 및 `cryptoVault.unlock()` 병렬 실패 카운트 누적 테스트 확인
- [ ] `SEC-F013`: `apiGateway.ts` `/v1/machines` 범위·인코딩 구분자 거부 및 `machineId` 검증/인코딩 테스트 확인
- [ ] `DBG-F020`~`DBG-F023`: 텔레메트리/데스크톱/VM 생성 모달/사이드바 액션 오류 처리 및 경합 방지 회귀 테스트 확인
- [ ] 수정 후 `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high` 재실행 확인

---

## 11. Final Decision

**`PASS WITH KNOWN RISKS`**

`v2.2.0` (`42f3148`)의 핵심 멀티세션 제어, 신호등 상태 인디케이터, 프리셋, 볼트 초기 생성/10회 실패 자동 파기 기능, 3개 플랫폼 CI 빌드·스모크, 공개 GitHub Release 자산, 31개 테스트 파일 121개 테스트 및 의존성 취약점 감사(0건)가 모두 통과했고 `Critical`/`Major` 결함은 발견되지 않았다. `BUILD_GUIDE.md`/`audit_roadmap.md` 버전 동기화 누락(`IMP-F015`), `ApiKeyModal`·`cryptoVault.unlock()` 동시 제출 카운터 경합(`SEC-F012`), `apiGateway`·`machineId` 경로 방어 보강(`SEC-F013`), 그리고 텔레메트리·데스크톱·사이드바·모달의 비동기 경합/오류 처리 미흡(`DBG-F020`~`DBG-F023`)은 모두 `Minor` 수준으로 다음 패치(`v2.2.1`)에서 정리하는 것을 권장한다.

---

## 12. Coder Handoff

```text
`D:\web\instadesk\docs\audit\audit_report_8.md`의 최신 전체 감사 결과를 확인하고,
각 Minor finding(`IMP-F015`, `DBG-F020`~`DBG-F023`, `SEC-F012`, `SEC-F013`)을 관련 프로젝트 문서와 실제 코드에 대조하여 검토한 후 필요한 수정을 수행하세요.
계약 변경이나 보완이 필요한 경우 관련 문서를 먼저 갱신하고, 수정 후 `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`를 실행하여 결과를 기록하세요. 원본 감사 리포트(`docs/audit/audit_report_1.md`~`audit_report_8.md`)는 수정하지 말고 보존하세요.
```
