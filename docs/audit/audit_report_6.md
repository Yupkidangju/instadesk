# D3D Audit Report — InstaDesk 멀티세션 동시 제어·상태 인디케이터 감사 (Audit 6)

- **작성일:** 2026-11-18 (Asia/Seoul)
- **프로젝트 경로:** `D:\web\instadesk`
- **감사 기준:** `AI_AUDIT_DOC_STANDARD.md`, `AGENTS.md`, `spec.md` (v2.2.0), `designs.md` (v1.1.0), `audit_roadmap.md`
- **대상 범위:** `c58f93f` (`v2.1.3` 감사 5 수정 기록) 이후 작업 트리에 추가·수정된 멀티세션 동시 제어, 실시간 세션 상태 인디케이터(🔴/🟡/🟢), 라이브 PTY 동기화/키스트로크 미러링, 워크스페이스 프리셋 기능 및 감사 5 수정 사항 재검증
- **Final Decision:** **`HOLD`** (`Major` finding 3건: `IMP-F012`, `IMP-F013`, `DBG-F017` 및 `Minor` finding 6건 해소 필요)

---

## 1. Audit Scope

### 1.1 프로젝트 및 환경 인벤토리
- **프로젝트 유형:** Electron Desktop Application (`Electron 45.2.1` + `React 18.3.1` + `TypeScript 5.6.3` + `Vite 8.3.5` + `Zustand 5.0.0` + `@xterm/xterm 5.5.0`)
- ** 확인한 문서:**
  - `spec.md` (v2.2.0, 멀티세션 동시 제어·상태 인디케이터 규격 반영)
  - `designs.md` (v1.1.0, `04_SESSION_ORCHESTRATOR` 및 타일 헤더 규격 반영)
  - `README.md` (영문/국문 멀티세션 기능 표 반영)
  - `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`, `BUILD_GUIDE.md`, `LINUX_SETUP.md`, `audit_roadmap.md`
  - `docs/audit/audit_report_5.md`, `docs/audit/audit_report_5_remediation.md`, `docs/electron/audit_5_remediation.md`, `docs/electron/desktop_scroll_2_1_2.md`
- **확인한 소스·설정·CI 파일:**
  - 신규 소스: `src/components/SessionCommandBar.tsx`, `src/components/terminal/sessionActivity.ts`, `src/components/terminal/terminalRegistry.ts`
  - 수정된 소스: `src/types/instabox.ts`, `src/store/useAppStore.ts`, `src/components/SidebarVmList.tsx`, `src/components/VmTilePane.tsx`, `src/components/WorkspaceGrid.tsx`, `src/components/terminal/TerminalView.tsx`
  - 연관 소스: `src/App.tsx`, `src/components/HeaderBar.tsx`, `src/components/SplitWorkspaceView.tsx`, `src/components/desktop/DesktopScreenView.tsx`, `src/components/terminal/terminalHistoryCache.ts`, `src/components/modals/BroadcastExecModal.tsx`, `src/services/instaboxClient.ts`, `src/services/cryptoVault.ts`, `electron/{main.ts,preload.ts,terminalGateway.ts,desktopViewGateway.ts,desktopViewPolicy.ts,apiGateway.ts}`
  - 신규·연관 테스트: `test/sessionActivity.test.ts`, `test/multiSessionControl.test.tsx`, `test/terminalHistoryCache.test.ts`, `test/terminalHistoryLifecycle.test.tsx`, `test/desktopNativeView.test.tsx`, `test/useAppStore.test.ts` 외 전체 `test/*.test.{ts,tsx}` (29파일)
  - 매니페스트 및 CI: `package.json`, `package-lock.json`, `.github/workflows/desktop.yml`

### 1.2 실행한 검증 명령 및 결과

| 명령 | CWD | Exit Code | 결과 요약 |
| --- | --- | :---: | --- |
| `git status --short; git diff --stat` | `D:\web\instadesk` | `0` | 수정 9개 파일, 신규(Untracked) 5개 파일 확인 |
| `npm run typecheck` | `D:\web\instadesk` | `0` | `tsc --noEmit` 오류 0건 |
| `npm test` | `D:\web\instadesk` | `0` | **29개 테스트 파일, 110개 테스트 전체 통과** (`sessionActivity.test.ts` 5건, `multiSessionControl.test.tsx` 5건 포함) |
| `npm run build` | `D:\web\instadesk` | `0` | 렌더러(`dist/`) 및 Electron(`dist-electron/`) 번들 성공 (단일 JS 청크 602.62 kB 경고 존재) |
| `npm audit --omit=dev` | `D:\web\instadesk` | `0` | 배포 런타임(shipped) 의존성 취약점 **0건** |
| `npm audit` | `D:\web\instadesk` | `1` | 개발 의존성(`vite`, `vitest`, `tailwindcss` 하위 `picomatch`) `GHSA-fc5q-39xc-vjpf` High 13건 보고 (`SEC-F010`) |

### 1.3 검사한 케이스
1. 동일 VM에 대한 다중 세션(`main`, `agent`, `aux`) 타일 생성(`addTile`, `addNextSessionTile`), 타일 내 세션 전환(`setTileSessionName`), 프리셋 복원(`applyPreset`) 시 세션 중복 제어 여부
2. `SessionActivityTracker` 및 `detectSessionActivityFromTail`의 ANSI 제어문자 제거, `running`(🔴) / `prompt`(🟡) / `idle`(🟢) / `disconnected`(⚪) 상태 전이 정확도
3. `SessionCommandBar`와 `VmTilePane` 인라인 프롬프트 배너에서 실제 `TerminalView`(데모 PTY 및 Electron IPC PTY)로의 명령/빠른 응답 전달 및 후속 상태 전이 연결 여부
4. 키스트로크 미러링(`isKeystrokeMirroring`)과 타일 동기화(`syncedTileIds`) 동작, 볼트 잠금/프로필 삭제/타일 닫기 시 정리 경계
5. 동일 VM 다중 세션 타일에서 `ALL SPLIT` 또는 개별 `DESKTOP`/`SPLIT` 전환 시 Electron 네이티브 `WebContentsView` 생명주기·ID 충돌 여부
6. `localStorage` 기반 워크스페이스 프리셋(`instabox_deck_presets_v1`)의 스키마 검증, 비밀정보 비포함 여부, 볼트 잠금 상태 복원 차단 동작
7. 이전 감사 5(`audit_report_5.md`) finding(`IMP-F010`, `IMP-F011`, `DBG-F014`, `DBG-F015`, `DBG-F016`, `SEC-F008`)의 회귀 여부

---

## 2. Excluded Scope

- `node_modules/`, `node_modules.audit1-backup/`, `node_modules.audit3-interrupted/`, `dist/`, `dist-electron/`, `release/`, `.git/`: 외부 벤더 및 빌드 산출물 디렉터리이므로 직접 코드 감사는 제외하고 매니페스트·빌드 스크립트 기준으로 검증했다.
- 실 `instabox.sh` 유료 API 키를 사용한 라이브 서버 원격 PTY 3세션 동시 접속 및 실 원격 `WebContentsView` 스트림 렌더링은 로컬 감사 환경에 실 API 키가 없으므로 정적 코드 경로·IPC 게이트웨이 계약·단위/통합 테스트로 검증했다(`audit_roadmap.md` 정책에 따라 실 키 수동 검증 전까지 실 서비스 수용을 PASS로 간주하지 않음).
- 물리 Linux x64/arm64 기기에서의 아카이브 설치 실행은 제외했다.

---

## 3. Pass 1: Implementation Compliance Findings

### 3.0 감사 5 (`audit_report_5.md`) 재감사 요약

| 원 Finding ID | 재감사 상태 | 확인 증거 및 비고 |
| --- | --- | --- |
| `IMP-F010` (Re-audit #1) | `Verified` | `scripts/render-linux-setup.mjs`, `scripts/package-linux.mjs`, `test/linuxSetupGuide.test.ts` 및 `.github/workflows/desktop.yml:67-68`로 버전·아키텍처 치환 검증 완료 |
| `IMP-F011` (Re-audit #1) | `Verified` | `spec.md:130`, `designs.md:128`, `DESIGN_DECISIONS.md:118-120`, `docs/electron/audit_5_remediation.md`에 휠 소유·기록 보존 상한 명시 완료 |
| `DBG-F014` (Re-audit #1) | `Verified` | `src/components/terminal/terminalWheelPolicy.ts`, `TerminalView.tsx:46-60`, `test/terminalWheelPolicy.test.ts`로 경계 연쇄 스크롤 차단 확인 |
| `DBG-F015` (Re-audit #1) | `Verified` | `src/components/terminal/terminalHistoryCache.ts`, `TerminalView.tsx:64,375-405`, `test/terminalHistoryCache.test.ts`, `test/terminalHistoryLifecycle.test.tsx` 통과 (단, 수동 `RECONNECT` 시 중복 복원 세부 이슈는 신규 `DBG-F018`로 분리) |
| `DBG-F016` (Re-audit #1) | `Verified` (소스/모의 범위) | `DesktopScreenView.tsx:237-239`에서 작은 화면 안내 숨김(`hidden xl:inline`) 제거 확인. 단, 멀티세션 도입으로 인한 동일 VM 복수 Desktop 뷰 ID 충돌은 신규 `DBG-F017`로 기록 |
| `SEC-F008` (Re-audit #1) | `Verified` (문서/체크섬 범위) | `README.md:13-38, 79-104`, `DESIGN_DECISIONS.md:122-124`, `.github/workflows/desktop.yml:60,69-71` 반영 확인 (코드 서명·ASAR는 알려진 제한으로 유지) |

---

### [IMP-F012] 데모 모드 터미널에서 라이브 PTY 동시 명령 및 빠른 응답(`Y`/`N`/`1`/`2`)이 실행되지 않고 프롬프트 상태가 고착됨

- **Pass:** Implementation
- **Pattern:** `IMP-001`
- **Area:** 라이브 PTY 동시 제어(`SessionCommandBar`, `VmTilePane`) ↔ 데모 터미널 실행기(`TerminalView`) 및 상태 추적(`SessionActivityTracker`)
- **Severity:** `Major`
- **Status:** `Needs Fix`
- **Summary:** `SessionCommandBar` 및 `VmTilePane` 인라인 배너는 명령어와 빠른 응답을 `'pwd\r'`, `'y\r'`, `'n\r'`, `'1\r'`, `'2\r'`와 같이 개행(`\r`)이 결합된 다중 문자 문자열로 한 번에 전송하지만, `TerminalView.tsx`의 데모 PTY 핸들러(`handleDemoData`)는 `data === '\r' || data === '\n'`(단일 문자 일치)만 검사하여 명령 실행과 확인 응답이 전혀 작동하지 않는다. 또한 확인 프롬프트 응답 시 `tracker.recordInput` 호출이 누락되어 상태가 🟡 `PROMPT`에서 🔴 `RUN`으로 전이되지 않는다.
- **Evidence:**
  - `spec.md:35, 179-185` 및 `README.md:60, 126`: 라이브 PTY 제어 바 및 타일 배너에서 실시간 명령 입력과 원클릭 빠른 응답(`Y`, `N`, `Enter`, `1`, `2`, `Ctrl+C`, `Esc`)을 전송하며, 데모 모드에서도 모든 기능을 즉시 테스트할 수 있어야 한다.
  - `src/components/SessionCommandBar.tsx:140, 426, 435, 454, 463` 및 `src/components/VmTilePane.tsx:171, 178, 185`: `sendPayload(`${command}\r`, true)`, `sendPayload('y\r')`, `sendPayload('n\r')`, `sendPayload('1\r')`, `sendPayload('2\r')`를 통해 `terminalRegistry`로 다중 문자 문자열을 전달한다.
  - `src/components/terminal/TerminalView.tsx:207, 235`: `handleDemoData(data: string)`가 `if (data === '\r' || data === '\n')`로만 엔터 입력을 판별한다. `data`가 `'apt\r'`, `'pwd\r'`, `'y\r'`, `'n\r'`, `'1\r'`, `'2\r'`일 때 조건이 거짓이 되어 `230-232행` 또는 `282-284행`의 `currentInput += data; term.write(data); return true;`로 빠진다.
  - `src/components/terminal/TerminalView.tsx:199-223`: 데모 모드의 `awaitingConfirm` 분기(`207-222행`)와 `\u0003` 분기(`199-204행`)에서 `tracker.recordInput(...)`을 호출하지 않는다. 이 때문에 `SessionActivityTracker.tail`에 직전 질문(`Do you want to continue? [Y/n]`)이 지워지지 않고 남아, `Continuing operation...` 출력 중에도 `detectSessionActivityFromTail`이 마지막 6줄 내 질문 패턴을 다시 감지하여 `prompt`(🟡) 상태를 그대로 반환한다.
  - 또한 `awaitingConfirm` 상태에서 `ESC`(`\u001b`) 빠른 응답 전송 시 취소 처리 없이 `currentInput += '\u001b'`로 제어문자가 입력 버퍼에 누적된다.
  - `test/multiSessionControl.test.tsx:10-14`는 `TerminalView`를 `vi.mock`으로 대체하여 `SessionCommandBar` ↔ `TerminalView` 간 실제 입력 소비 경로를 검증하지 않았다.
- **Expected:** `SessionCommandBar`, `VmTilePane` 인라인 배너, 키스트로크 미러링, 터미널 붙여넣기 등 어떤 경로로 다중 문자/개행 포함 문자열이 전달되더라도 데모 PTY와 실제 PTY 모두에서 명령 실행과 확인 프롬프트 응답이 정상 처리되고, `prompt`(🟡) → `running`(🔴) → `idle`(🟢) 상태 전이가 즉시 반영되어야 한다.
- **Actual:** 데모 모드에서 라이브 명령 전송과 `Y`/`N`/`1`/`2` 버튼 클릭 시 명령이 실행되지 않고 터미널 줄 앞부분만 덮어쓰며, 확인 프롬프트 상태에서 빠져나오지 못한다.
- **Impact:** 오프라인/데모 모드에서 핵심 신규 기능인 라이브 PTY 동시 명령 전송, 프롬프트 원클릭 응답(`Y`/`N`/`1`/`2`), 키스트로크 미러링 후 일괄 실행이 동작하지 않는다.
- **Suggested Fix:**
  1. `TerminalView.tsx`의 `handleDemoData`에서 입력 문자열 `data`를 문자 단위로 순회(또는 `\r\n`/`\r`/`\n` 기준으로 분할 처리)하여 `'y\r'`, `'pwd\r'` 등 복합 문자열도 개별 키 입력과 동일하게 줄 제출이 실행되도록 수정한다.
  2. 데모 모드의 `awaitingConfirm` 응답 제출 시 `const act = tracker.recordInput('\r'); if (act) publishActivity(act);`를 호출하고, `\u0003`(`Ctrl+C`) 및 `\u001b`(`Esc`) 입력 시에도 `awaitingConfirm` 해제 및 `tracker` 상태/버퍼 초기화를 수행한다.
  3. `TerminalView`를 mock하지 않고 실제 마운트한 상태에서 `SessionCommandBar`로 `'apt\r'` 전송 → `🟡 PROMPT` 전환 → `'Y'` 버튼 클릭 → `🔴 RUN` → `🟢 IDLE` 복귀까지 검증하는 통합 회귀 테스트를 추가한다.
- **Re-audit Method:** 단위/통합 테스트 재실행 및 데모 모드에서 `SessionCommandBar`의 `LIVE PTY COMMAND`와 `Y`/`N`/`1`/`2`/`ESC`/`^C` 버튼 동작 확인.
- **Owner:** Coder

---

### [IMP-F013] 타일 내부 세션 전환(`SESSION: MAIN/AGENT/AUX`) 시 동일 VM 중복 세션 방지 계약 미적용

- **Pass:** Implementation
- **Pattern:** `IMP-001`
- **Area:** 멀티세션 타일 상태 관리 (`src/store/useAppStore.ts`, `src/components/terminal/TerminalView.tsx`)
- **Severity:** `Major`
- **Status:** `Needs Fix`
- **Summary:** `spec.md:177`은 동일 `(profileId, machineId, terminalSessionName)` 조합에 대해 중복 WebSocket 충돌(`taken`)을 막기 위해 기존 타일을 포커스/전환하도록 규정하지만, 타일 내부 세션 선택 버튼(`setTileSessionName`)은 중복 검사를 수행하지 않아 같은 VM의 같은 세션을 여러 타일에서 동시에 열 수 있다.
- **Evidence:**
  - `spec.md:177`: "동일 `(profileId, machineId, terminalSessionName)` 조합은 중복 WebSocket 충돌(`taken`)을 막기 위해 기존 타일을 포커스/전환한다."
  - `src/store/useAppStore.ts:463-469`:
    ```ts
    setTileSessionName: (tileId: string, sessionName: string) => {
      set({
        tiles: get().tiles.map((t) =>
          t.tileId === tileId ? { ...t, terminalSessionName: sessionName } : t
        ),
      });
    },
    ```
  - `src/components/terminal/TerminalView.tsx:470-482`: 각 타일 툴바에서 `MAIN`, `AGENT`, `AUX` 버튼을 모두 활성화 상태로 렌더링하고 클릭 시 `onSessionChange(s)` → `setTileSessionName(tile.tileId, s)`를 호출한다.
  - 동일 VM에 대해 타일 1(`main`)과 타일 2(`agent`)가 열린 상태에서 타일 2의 `MAIN` 버튼을 누르면 두 타일 모두 `(profileId, machineId, 'main')`이 되어 `TerminalView`의 `useEffect`가 동일 세션으로 중복 WebSocket 연결을 시도한다.
- **Expected:** 다른 타일에 이미 열려 있는 `(profileId, machineId, sessionName)`으로 전환을 시도할 경우, 새 중복 연결을 만들지 않고 이미 해당 세션을 보유한 타일로 포커스를 이동하거나(또는 타일 내 세션 버튼에서 다른 타일이 점유 중인 세션을 구분/차단), `spec.md:177` 계약을 일관되게 준수해야 한다.
- **Actual:** `setTileSessionName`이 중복 세션을 허용하여 동일 VM·동일 세션 타일이 복수로 존재하게 된다.
- **Impact:** 실 서버 환경에서 동일 세션에 대한 중복 PTY WebSocket 접속이 발생해 서버가 `taken` 오류로 연결을 거부하거나 세션 제어권이 충돌한다.
- **Suggested Fix:** `useAppStore.ts`의 `setTileSessionName`에서 같은 `(profileId, machineId)`의 다른 타일이 이미 `sessionName`을 사용 중인지 확인하고, 존재할 경우 현재 타일의 세션을 덮어쓰지 않고 기존 타일을 `focusedTileId`로 포커스(또는 필요한 경우 현재 중복 타일 정리/세션 스왑 정책 적용)하도록 수정한다.
- **Re-audit Method:** 동일 VM의 `main`과 `agent` 타일을 연 뒤 두 번째 타일에서 `main`으로 세션 변경 시 중복 `(profileId, machineId, 'main')` 타일이 생성되지 않는지 단위 테스트로 검증한다.
- **Owner:** Coder

---

### [IMP-F014] 멀티세션 기능 추가에 따른 2차 통제 문서(`IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`) 미동기화

- **Pass:** Implementation
- **Pattern:** `IMP-003`, `IMP-004`
- **Area:** 문서 동기화 (`IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `spec.md`(v2.2.0), `designs.md`(v1.1.0), `README.md`에는 멀티세션 동시 제어·상태 인디케이터·프리셋이 반영되었으나, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`는 `2.1.3` 시점에 머물러 있다.
- **Evidence:**
  - `IMPLEMENTATION_SUMMARY.md:1`: `# InstaDesk 2.1.3 구현 요약`으로 되어 있으며 신규 모듈(`SessionCommandBar.tsx`, `sessionActivity.ts`, `terminalRegistry.ts`)의 책임과 데이터 흐름이 누락되어 있다.
  - `DESIGN_DECISIONS.md:118-124`: Decision 13까지만 기록되어 있고, 멀티세션 타일 분리, 휴리스틱 기반 터미널 상태 감지(`SessionActivityTracker`), 라이브 PTY 미러링(`terminalRegistry`)과 기존 SSE Broadcast(`BroadcastExecModal`)의 역할 분리, 프리셋 로컬 저장소(`instabox_deck_presets_v1`) 결정이 기록되지 않았다.
  - `CHANGELOG.md:8`: `## [2.1.3] - 2026-11-17`이 최신 항목이며 멀티세션 관련 변경 이력이 없다.
- **Expected:** `AGENTS.md` §6.5, §9 및 `AI_AUDIT_DOC_STANDARD.md` `IMP-003`/`IMP-004`에 따라 아키텍처·기능 추가 시 `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`를 함께 갱신해야 한다.
- **Actual:** 2차 요약 및 의사결정·변경이력 문서가 소스와 동기화되지 않았다.
- **Impact:** 인수인계 및 후속 감사 시 2차 요약 문서만 참조하면 멀티세션 아키텍처와 파일 책임을 파악할 수 없다.
- **Suggested Fix:** `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`에 멀티세션 동시 제어, 상태 인디케이터, 프리셋 관련 구조·결정·변경 내역과 검증 테스트 책임을 반영한다.
- **Re-audit Method:** 문서 갱신 내용과 실제 파일/테스트 목록 대조.
- **Owner:** Coder

---

## 4. Pass 2: Debug / Engineering Quality Findings

### [DBG-F017] 동일 VM 다중 세션 타일에서 `DESKTOP` / `SPLIT` 활성화 시 네이티브 `WebContentsView` ID 충돌 및 스트림 파괴

- **Pass:** Debug
- **Pattern:** `DBG-002`, `ARCH-002`
- **Area:** 네이티브 데스크톱 뷰 관리 (`src/components/desktop/DesktopScreenView.tsx`, `electron/desktopViewGateway.ts`, `src/components/SessionCommandBar.tsx`)
- **Severity:** `Major`
- **Status:** `Needs Fix`
- **Summary:** 동일 VM의 여러 세션 타일(`main`, `agent`, `aux`)을 동시에 열 수 있게 되었고 `SessionCommandBar`에 `ALL SPLIT` 일괄 전환 버튼이 추가되었으나, `DesktopScreenView.tsx`의 네이티브 뷰 ID가 `tileId` 구분 없이 `desktop_${profileId}_${machineId}`로 고정되어 있어 동일 VM의 두 타일이 동시에 `SPLIT` 또는 `DESKTOP`을 열면 네이티브 뷰가 충돌하고 한 타일 종료 시 다른 타일의 화면까지 닫힌다.
- **Evidence:**
  - `src/components/SessionCommandBar.tsx:240-245`: `ALL SPLIT` 버튼이 열린 모든 타일의 `activeTab`을 `'split'`으로 일괄 변경한다(`setAllTilesTab('split')`).
  - `src/components/desktop/DesktopScreenView.tsx:52`: `const viewId = \`desktop_${profileId}_${machineId}\`;`로 정의되어 있다.
  - `electron/desktopViewGateway.ts:23-25, 69, 85-91`: `DesktopViewGateway`는 `request.id`(`viewId`)를 키로 단일 `WebContentsView`만 유지하며 `open(request)` 시 기존 `this.close(request.id)`를 호출한다.
  - 따라서 동일 VM의 `main` 타일과 `agent` 타일이 모두 `SPLIT`(또는 `DESKTOP`) 상태가 되면:
    1. 나중 타일의 `openDesktopView`가 먼저 열린 타일의 `WebContentsView`를 파괴한다.
    2. 두 타일의 `scroll`/`resize` 이펙트(`DesktopScreenView.tsx:136-152`)가 동일한 `viewId`에 대해 각자의 DOM 좌표(`bounds`)와 가시성(`visible`)으로 `updateDesktopView`를 경쟁 호출하여, 한 타일이 화면 밖으로 나가면 다른 보이는 타일의 네이티브 뷰까지 숨겨지거나 위치가 어긋난다.
    3. 두 타일 중 하나만 `TERMINAL` 탭으로 전환하거나 닫아도 cleanup(`DesktopScreenView.tsx:132`)이 `bridge.closeDesktopView(viewId)`를 호출하여 남아 있는 타일의 Desktop 뷰를 닫아버린다.
- **Expected:** 동일 VM의 다중 세션 타일에서 `ALL SPLIT` 또는 개별 `DESKTOP`/`SPLIT`을 사용할 때 네이티브 `WebContentsView`가 서로 덮어쓰거나 다른 타일의 스트림을 파괴하지 않아야 한다.
- **Actual:** `viewId`에 `tileId`가 포함되지 않거나 동일 VM 다중 타일 간 Desktop 뷰 소유권 조율이 없어 네이티브 뷰 충돌 및 조기 종료가 발생한다.
- **Impact:** 멀티세션 사용 중 `ALL SPLIT` 클릭 또는 같은 VM의 두 타일에서 Desktop/Split 조회 시 화면이 깨지거나 사라진다.
- **Suggested Fix:**
  - 방안 A (타일별 독립 뷰): `DesktopScreenView`에 `tileId` prop을 전달하고 `viewId = \`desktop_${tileId}\``(또는 `desktop_${profileId}_${machineId}_${tileId}`)를 사용하여 타일별 `WebContentsView` 생명주기와 좌표를 독립 관리한다.
  - 방안 B (VM당 단일 Desktop 뷰 제한): InstaBox 서버/대시보드가 동일 VM에 단일 Desktop 스트림만 허용하는 경우, `setAllTilesTab('split')` 등에서 동일 `(profileId, machineId)`의 첫 번째 타일만 `split`/`desktop`을 열고 나머지 세션 타일은 `terminal`을 유지하거나 단일 소유권을 관리하도록 구현·문서화한다.
- **Re-audit Method:** 동일 VM의 `main`·`agent` 두 타일을 연 상태에서 `ALL SPLIT` 전환 후 한 타일을 `TERMINAL`로 되돌리거나 닫을 때 다른 타일의 Desktop 뷰가 파괴되지 않는지 단위 테스트(`desktopNativeView.test.tsx` 또는 `multiSessionControl.test.tsx`)로 검증한다.
- **Owner:** Coder

---

### [DBG-F018] 터미널 수동/일괄 `RECONNECT` 실행 시 `terminalHistoryCache`가 초기화되지 않아 이전 출력이 중복 복원됨

- **Pass:** Debug
- **Pattern:** `DBG-002`, `TEST-001`
- **Area:** 터미널 재연결 및 기록 복원 (`src/components/terminal/TerminalView.tsx`, `src/components/SessionCommandBar.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** 개별 타일의 재연결 버튼 또는 `SessionCommandBar`의 일괄 `RECONNECT` 버튼 클릭 시 `handleReconnect`가 `terminalHistoryCache`를 비우지 않고, 직후 실행되는 `useEffect` cleanup이 현재 버퍼를 다시 캐시에 저장하여 재연결 후 이전 출력과 초기화 배너가 중복 출력된다.
- **Evidence:**
  - `src/components/terminal/TerminalView.tsx:419-428`:
    ```ts
    const handleReconnect = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      retryAttemptRef.current = 0;
      setRetryInfo(null);
      if (termRef.current) {
        termRef.current.clear();
      }
      setRetryGeneration((value) => value + 1);
    };
    ```
  - `term.clear()`는 xterm의 현재 커서 줄(활성 프롬프트 줄)을 지우지 않으며, `terminalHistoryCache.clearSession(tileId, sessionName)`도 호출하지 않는다.
  - `setRetryGeneration`으로 인해 `useEffect` cleanup(`395-405행`)이 실행되면 `keepHistory && restoreComplete`가 참이므로 남아 있는 버퍼가 `terminalHistoryCache.save(...)`로 저장되고, 새 `useEffect`(`64, 375-381행`)에서 `restored`로 다시 복원된다.
- **Expected:** 수동/일괄 `RECONNECT`가 새 터미널 세션을 깨끗이 다시 연결할 때 이전 캐시 때문에 배너나 프롬프트 줄이 중복 누적되지 않아야 한다(또는 의도적으로 캐시를 비운 뒤 재연결해야 한다).
- **Actual:** `handleReconnect` 시 cleanup이 캐시를 재저장하고 새 이펙트가 이를 복원한다.
- **Impact:** `RECONNECT`를 반복 누르면 이전 프롬프트 줄이나 출력이 새 초기화 배너 위에 남아 누적된다.
- **Suggested Fix:** `handleReconnect`에서 `terminalHistoryCache.clearSession(tileId, sessionName)`을 호출하고, 재연결로 인한 이펙트 재실행 시 cleanup이 직전 버퍼를 다시 캐시에 저장하지 않도록 플래그(`skipHistorySaveRef`)를 두거나 버퍼를 완전히 리셋(`term.reset()`)한다.
- **Re-audit Method:** `RECONNECT` 클릭 전후 `terminalHistoryCache` 및 터미널 초기 출력 줄이 중복되지 않는지 테스트로 확인한다.
- **Owner:** Coder

---

### [DBG-F019] `SessionCommandBar`의 `1x1` 비포커스 타일 점프 포커스 누락, 미전송(`0 sent`) 시 명령어 소실, `SYNCED` 카운트 불일치

- **Pass:** Debug
- **Pattern:** `DBG-002`
- **Area:** 세션 오케스트레이터 UI 상태 (`src/components/SessionCommandBar.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:**
  1. `1x1` 모드에서 비포커스 타일 칩을 클릭할 때 타일이 마운트되기 전에 `terminalRegistry.focusTile`을 동기 호출해 터미널 포커스가 실패한다.
  2. 연결 준비 전이거나 마운트된 타겟이 없어 실제 전송 수(`sent`)가 `0`일 때도 `handleSendCommand`가 사용자의 명령어 입력창을 비워버린다.
  3. `SYNCED` 스코프 버튼의 숫자는 비터미널 탭(`desktop`, `logs` 등) 타일까지 포함하는 반면 실제 전송 대상은 `terminal`/`split` 탭만 포함하며, `syncedTileIds.length`가 바뀔 때마다 사용자가 선택한 `ALL` 스코프가 강제로 `'synced'`로 덮어써진다.
- **Evidence:**
  - `src/components/SessionCommandBar.tsx:143-148`: `handleJumpToTile`이 `setFocusedTileId(tileId)` 직후 동기적으로 `document.querySelector` 및 `terminalRegistry.focusTile(tileId)`를 호출한다. `WorkspaceGrid.tsx:127`에서 `1x1` 모드는 `focusedTile` 하나만 렌더링하므로 클릭 시점에는 대상 타일의 DOM과 `terminalRegistry` 컨트롤러가 아직 마운트되지 않은 상태다.
  - `src/components/SessionCommandBar.tsx:128-141`: `const sent = terminalRegistry.sendToTiles(targetIds, payload);`에서 모든 타일이 아직 연결 중(`sendInput`이 `false` 반환)이거나 `1x1` 모드에서 비포커스 타일만 타겟이어서 `sent === 0`이 되어도 `if (clearInput) setCommand('');`가 실행되어 사용자가 입력한 명령어가 사라진다.
  - `src/components/SessionCommandBar.tsx:119-123` vs `349`: `resolveTargetIds()`는 `terminalCapableTiles.filter((t) => syncedSet.has(t.tileId))`를 반환하지만 버튼 라벨은 `SYNCED (${syncedTileIds.length})`를 사용한다.
  - `src/components/SessionCommandBar.tsx:90-96`: `useEffect`가 `syncedTileIds.length`를 의존성으로 감시하여, 이미 동기화 타일이 1개 있는 상태에서 사용자가 `ALL` 스코프를 직접 선택한 뒤 다른 타일의 `SYNC`를 토글하면 다시 `'synced'`로 강제 전환된다.
- **Expected:**
  1. `1x1` 모드에서 타일 칩 클릭 시 마운트 이후(`requestAnimationFrame` 또는 이펙트) 해당 타일 터미널로 포커스가 이동해야 한다.
  2. `sent > 0`일 때만 명령어 입력창을 비우고, `sent === 0`이면 입력값을 보존해 재전송할 수 있게 해야 한다.
  3. `SYNCED` 카운트 기준을 일관되게 맞추고, 스코프 자동 전환은 동기화 타일이 `0개 → 1개 이상`이 될 때와 `1개 이상 → 0개`가 될 때만 수행해야 한다.
- **Actual:** `1x1` 점프 포커스 미동작, `0/N` 전송 시 명령어 증발, `SYNCED` 카운트 및 스코프 강제 전환 불일치가 존재한다.
- **Impact:** 다중 세션 제어 시 입력 유실 및 포커스/스코프 조작 혼선이 발생한다.
- **Suggested Fix:**
  1. `handleJumpToTile`에서 즉시 호출이 실패하면 다음 프레임(`requestAnimationFrame`/`setTimeout(0)`)에 `scrollIntoView`와 `terminalRegistry.focusTile`을 재시도한다.
  2. `sendPayload`에서 `if (clearInput && sent > 0) setCommand('');`로 변경한다.
  3. `prevSyncedCountRef`로 `0 -> >0` 전이 시에만 `scope`를 `'synced'`로 자동 전환하고, `SYNCED` 타겟 카운트를 `syncedTerminalTiles.length`와 일치시킨다.
- **Re-audit Method:** `multiSessionControl.test.tsx`에 `sent === 0` 시 입력 보존, `1x1` 모드 칩 클릭 시 포커스 이동, `ALL` 수동 선택 후 추가 타일 `SYNC` 시 스코프 유지 테스트를 추가해 확인한다.
- **Owner:** Coder

---

## 5. Pass 3: Security Findings

### [SEC-F009] `localStorage` 워크스페이스 프리셋(`instabox_deck_presets_v1`) 로드·적용 시 하위 타일 스키마 및 세션 유효성 검증 부족

- **Pass:** Security
- **Pattern:** `SEC-001`, `SEC-004`
- **Area:** 프리셋 저장소 역직렬화 및 적용 (`src/store/useAppStore.ts`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** `loadPresets()`가 `localStorage`의 `instabox_deck_presets_v1` JSON을 읽을 때 최상위 `id`, `name`, `Array.isArray(tiles)`만 확인하고 `gridMode`와 개별 타일 항목(`profileId`, `machineId`, `activeTab`, `terminalSessionName`, `desktopViewOnly`)의 타입·허용 열거값·중복 세션을 검증하지 않는다. 또한 볼트 잠금 상태에서 실 프로필 전용 프리셋을 클릭했을 때 사용자에게 잠금 해제 안내나 모달을 띄우지 않고 침묵한다.
- **Evidence:**
  - `src/store/useAppStore.ts:19-33`:
    ```ts
    return parsed.filter(
      (item): item is WorkspacePreset =>
        Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.tiles))
    );
    ```
  - `src/store/useAppStore.ts:541-561`: `applyPreset`에서 `item.profileId.startsWith('demo-')`를 바로 호출하므로 `localStorage` 내 프리셋 데이터가 손상되었거나 비정상 객체(`profileId: null` 또는 `terminalSessionName: undefined` / 허용되지 않은 문자열)를 포함하면 즉시 런타임 예외(`TypeError`)가 발생하거나 허용되지 않은 `terminalSessionName`/`activeTab`/`gridMode`가 스토어에 주입된다.
  - 또한 `applyPreset`은 프리셋 내부의 중복 `(profileId, machineId, terminalSessionName)` 항목을 제거하지 않는다.
  - `spec.md:100`: "잠금 상태에서 실 프로필 프리셋을 적용하면 잠금 해제 후 열 수 있도록 차단하거나 데모 타일만 복원한다." 현재 실 프로필만 담긴 프리셋을 잠금 상태에서 클릭하면 `allowedItems.length === 0`으로 조용히 반환하여(`WorkspaceGrid.tsx:113`, `SessionCommandBar.tsx:321`), 사용자는 왜 프리셋이 열리지 않는지 알 수 없고 `openUnlockModal()`도 호출되지 않는다.
- **Expected:** `loadPresets` 및 `applyPreset`에서 `gridMode`(`1x1`/`2x1`/`2x2`/`auto`), `activeTab`(6종 허용 탭), `terminalSessionName`(`main`/`agent`/`aux`), `profileId`/`machineId` 문자열 여부를 엄격히 검증·정규화하고 중복 `(profileId, machineId, terminalSessionName)`을 제거해야 한다. 잠금 상태에서 실 프로필 타일이 포함된 프리셋을 적용하려 할 때 복원 가능한 타일이 없으면 잠금 해제 모달(`isUnlockModalOpen: true`)을 열거나 상태를 안내해야 한다.
- **Actual:** 하위 필드 무검증으로 손상된 로컬 데이터에 의해 렌더러 예외가 발생할 수 있으며, 잠금 상태에서 실 프로필 프리셋 클릭 시 무반응이다.
- **Impact:** 로컬 저장소 오염/손상 시 앱 크래시 가능성 및 잠금 상태에서의 UX 단절.
- **Suggested Fix:** `loadPresets`에 타일 항목별 스키마 가드 및 중복 세션 필터링을 추가하고, `applyPreset`에서 `!unlocked`로 인해 실 프로필 타일이 제외되어 `allowedItems.length === 0`이 된 경우 `set({ isUnlockModalOpen: true })`를 트리거한다.
- **Re-audit Method:** 손상된 `instabox_deck_presets_v1` JSON 주입 및 잠금 상태 실 프로필 프리셋 클릭 단위 테스트로 확인한다.
- **Owner:** Coder

---

### [SEC-F010] 개발 의존성 `picomatch` 취약점(`GHSA-fc5q-39xc-vjpf`)으로 인한 CI `npm audit --audit-level=high` 게이트 실패

- **Pass:** Security
- **Pattern:** `SEC-006`, `BUILD-001`
- **Area:** 의존성 매니페스트 및 CI 파이프라인 (`package.json`, `package-lock.json`, `.github/workflows/desktop.yml`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** 배포 산출물 범위(`npm audit --omit=dev`)는 취약점이 0건이나, 개발 의존성(`tailwindcss`, `vite`, `vitest`)이 참조하는 `picomatch` (`2.3.2`, `4.0.7`)에서 High 등급 ReDoS 권고(`GHSA-fc5q-39xc-vjpf`)가 발생하여 `.github/workflows/desktop.yml:39`의 `npm audit --audit-level=high` 단계가 종료 코드 `1`로 실패한다.
- **Evidence:**
  - `npm audit --omit=dev` 실행 결과: `found 0 vulnerabilities` (배포 런타임 안전).
  - `npm audit` (`--audit-level=high`) 실행 결과: `picomatch` (`GHSA-fc5q-39xc-vjpf`, Severity: `high`)로 인해 13건의 하위 경로가 보고되며 Exit Code `1` 반환.
  - `.github/workflows/desktop.yml:39`: `- run: npm audit --audit-level=high`가 모든 플랫폼 패키지 잡의 필수 선행 단계로 설정되어 있다.
- **Expected:** CI 파이프라인의 보안 감사 게이트(`npm audit --audit-level=high`)가 통과하거나, 패치된 `picomatch` 버전이 `overrides`/잠금 파일에 반영되어야 한다.
- **Actual:** 로컬 및 CI에서 `npm audit --audit-level=high`가 실패한다.
- **Impact:** 배포 런타임에는 포함되지 않으나 GitHub Actions CI 빌드 및 릴리스 워크플로가 차단된다.
- **Suggested Fix:** `package.json`의 `overrides` 또는 `package-lock.json` 갱신을 통해 패치된 `picomatch` 버전을 고정하거나(패치 버전 가용 여부 확인), 빌드/테스트 호환성을 검증한 뒤 `npm audit --audit-level=high` 통과를 확인한다.
- **Re-audit Method:** `npm audit --audit-level=high`, `npm test`, `npm run build` 재실행.
- **Owner:** Coder

---

### [SEC-F011] 볼트 잠금 시 키스트로크 미러링(`isKeystrokeMirroring`) 미해제 및 암호 프롬프트(`password:`) 미러링 주의 부재

- **Pass:** Security
- **Pattern:** `SEC-001`
- **Area:** 키스트로크 미러링 및 잠금 경계 (`src/store/useAppStore.ts`, `src/components/terminal/TerminalView.tsx`)
- **Severity:** `Minor`
- **Status:** `Needs Fix`
- **Summary:** 볼트 잠금 시 `isKeystrokeMirroring` 상태가 `false`로 초기화되지 않으며, 특정 동기화 타일이 `[sudo] password:` / `passphrase:` 입력 대기 상태일 때도 키스트로크 미러링이 그대로 다른 타일(일반 쉘 프롬프트 등)로 평문 키 입력을 복제 전송할 수 있다.
- **Evidence:**
  - `src/store/useAppStore.ts:169-183`: 볼트 잠금 리스너에서 `tiles`, `sessionStates`, `sessionActivities`, `syncedTileIds`는 정리하지만 `isKeystrokeMirroring: false` 초기화를 누락했다.
  - `src/components/terminal/TerminalView.tsx:160-165`: `maybeMirrorInput`은 `isKeystrokeMirroring && syncedTileIds.includes(tileId)`이면 무조건 입력 데이터를 다른 모든 `syncedTileIds`로 전송한다.
  - `src/components/terminal/sessionActivity.ts:36`: `password:` / `passphrase:` / `pin:` / `otp:` 프롬프트를 감지하지만, 한 타일만 암호 입력 프롬프트이고 다른 동기화 타일은 일반 쉘 프롬프트(`$ `)일 때 사용자가 암호를 타이핑하면 다른 타일의 쉘 화면과 히스토리에 평문 암호가 그대로 노출된다.
- **Expected:** 볼트 잠금 및 `clearAllTiles` 시 `isKeystrokeMirroring`을 `false`로 초기화해야 하며, 암호/패스프레이즈 프롬프트가 감지된 타일에서 입력할 때는 미러링을 일시 중지하거나 경고를 표시하는 보호 장치가 있어야 한다.
- **Actual:** 잠금 후에도 `isKeystrokeMirroring`이 켜진 채로 유지되고 암호 프롬프트에서도 무차별 미러링된다.
- **Impact:** 비활성 자동 잠금 해제 후 또는 다중 타일 작업 중 `sudo` 암호·패스프레이즈가 다른 VM 타일 쉘에 평문 노출될 위험이 있다.
- **Suggested Fix:**
  1. `useAppStore.ts`의 볼트 잠금 핸들러(`170-183행`)와 `clearAllTiles`(`487-490행`)에서 `isKeystrokeMirroring: false`를 함께 리셋한다.
  2. `sessionActivity.ts` 또는 `TerminalView.tsx`에서 현재 타일(또는 동기화 그룹 내 일부 타일 불일치 상태)이 암호 입력 프롬프트(`password`/`passphrase`/`pin`/`otp`)인 경우 키스트로크 미러링을 차단하거나 명확히 표시한다.
- **Re-audit Method:** 볼트 잠금 시 `isKeystrokeMirroring === false` 전환 및 암호 프롬프트 상태에서 타일 간 평문 미러링 차단 여부를 단위 테스트로 검증한다.
- **Owner:** Coder

---

## 6. Cross-Pass Conflicts

### [XPF-F007] 데모 시뮬레이션 모드의 모의 테스트 통과 vs 실제 `TerminalView` 결합 경로 단절

- **Related Findings:** `IMP-F012`, `DBG-F019`
- **Conflict:** `test/multiSessionControl.test.tsx`에서는 `SessionCommandBar`와 `VmTilePane`의 명령/빠른 응답 전송이 통과(`Verified`처럼 보임)했으나, 실제로는 `TerminalView`를 mock으로 치환한 결과였으며 실제 `TerminalView.tsx`의 데모 PTY 핸들러(`handleDemoData`)와 결합하면 `'cmd\r'`, `'y\r'` 등 다중 문자 입력이 전혀 실행되지 않는다.
- **Resolution:** `AI_AUDIT_DOC_STANDARD.md` §10("구현된 기능·상태·데이터·이벤트는 생성·호출 존재만으로 PASS하지 않는다. 실제 소비 경로와 후속 상태·출력·행동 변화까지 역추적하여 시스템 안에서 유효하게 연결되는지 확인한다")에 따라 `Needs Fix`(`Major`)로 판정한다.
- **Gate Impact:** `HOLD` (차단)
- **Required Fix Before PASS:** `TerminalView.tsx`의 데모 입력 파서 및 상태 추적기 연동을 수정하고, 실제 `TerminalView`가 마운트된 통합 테스트로 검증해야 한다.

### [XPF-F008] 멀티세션 일괄 `ALL SPLIT` 기능 제공 vs 단일 VM 네이티브 Desktop `viewId` 설계 충돌

- **Related Findings:** `IMP-F013`, `DBG-F017`
- **Conflict:** Pass 1 관점에서 `SessionCommandBar`의 `ALL SPLIT` 버튼과 동일 VM 다중 세션 타일은 `spec.md:33-36` 및 `designs.md:122`의 요구사항을 구현한 것이지만, Pass 2 엔지니어링 관점에서 `DesktopScreenView.tsx`는 여전히 단일 VM당 1개 타일만 존재하던 시절의 `viewId = desktop_${profileId}_${machineId}`를 사용하여 동일 VM 타일들이 서로의 Electron `WebContentsView`를 덮어쓰고 파괴한다.
- **Resolution:** 멀티세션 타일과 네이티브 Desktop 뷰가 안전하게 공존하도록 `DesktopScreenView`의 `viewId`를 타일 단위로 분리하거나 동일 VM 내 Desktop 뷰 소유 규칙을 정합성 있게 수정해야 한다.
- **Gate Impact:** `HOLD` (차단)
- **Required Fix Before PASS:** `DBG-F017` 수정 및 동일 VM 다중 타일 `SPLIT` 회귀 테스트 통과.

---

## 7. Required Fixes Before PASS

1. **`[IMP-F012]` (Major):** `src/components/terminal/TerminalView.tsx`의 데모 모드 `handleDemoData`에서 다중 문자/개행 포함 입력(`'pwd\r'`, `'y\r'`, `'n\r'`, `'1\r'`, `'2\r'`)을 정상 파싱·실행하고, 확인 프롬프트 응답 및 `Ctrl+C`/`Esc` 처리 시 `SessionActivityTracker` 상태를 동기화할 것. 실제 `TerminalView` 결합 테스트 추가.
2. **`[IMP-F013]` (Major):** `src/store/useAppStore.ts`의 `setTileSessionName`에서 동일 `(profileId, machineId, sessionName)` 중복 타일 생성을 방지하고 `spec.md:177` 계약을 일관되게 적용할 것.
3. **`[DBG-F017]` (Major):** `src/components/desktop/DesktopScreenView.tsx`에서 동일 VM의 다중 세션 타일이 동시에 `SPLIT`/`DESKTOP`을 열 때 네이티브 `WebContentsView` ID(`viewId`) 충돌 및 타일 언마운트 시 다른 타일의 Desktop 뷰를 닫는 버그를 수정할 것.
4. **`[DBG-F018]` (Minor):** `TerminalView.tsx`의 `handleReconnect` 실행 시 `terminalHistoryCache` 재저장/중복 복원을 방지할 것.
5. **`[DBG-F019]` (Minor):** `SessionCommandBar.tsx`에서 `1x1` 모드 타일 점프 시 마운트 후 터미널 포커스 보장, `sent === 0`일 때 명령어 입력값 유지, `SYNCED` 카운트 및 스코프 자동 전환 조건을 보정할 것.
6. **`[SEC-F009]` (Minor):** `useAppStore.ts`의 `loadPresets`/`applyPreset`에 하위 타일 필드 스키마·열거값·중복 세션 검증을 추가하고, 잠금 상태에서 실 프로필 전용 프리셋 클릭 시 잠금 해제 모달/안내를 연결할 것.
7. **`[SEC-F010]` (Minor):** `picomatch` (`GHSA-fc5q-39xc-vjpf`) 개발 의존성 취약점을 해결하여 `.github/workflows/desktop.yml`의 `npm audit --audit-level=high` 게이트가 통과되도록 할 것.
8. **`[SEC-F011]` (Minor):** 볼트 잠금 및 전체 타일 초기화 시 `isKeystrokeMirroring: false`로 리셋하고, 암호/패스프레이즈 프롬프트 감지 시 미러링 보호를 추가할 것.
9. **`[IMP-F014]` (Minor):** `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`를 현행 멀티세션 구현과 동기화할 것.

---

## 8. Accepted Risks

- 이번 감사에서 새로 승인한 `Accepted Risk`는 없다.
- 기존 `audit_roadmap.md` 및 `DESIGN_DECISIONS.md` Decision 11~13에 기록된 제한 사항(부분 가시 상태에서의 네이티브 Desktop 뷰 숨김, 미서명 배포 아카이브의 SHA-256 절차 제공 및 코드 서명/ASAR 후속 검토, 숨긴 PTY 재접속 시 서버 최근 출력 재전송 가능성)은 기존 범위대로 유지한다.

---

## 9. Needs Spec Clarification

- 현재 `Needs Spec Clarification`으로 판정 보류된 항목은 없다(`spec.md` v2.2.0에 멀티세션, 신호등 상태 인디케이터, 동기화/미러링, 프리셋 계약이 명시되어 있음). 단, `DBG-F017` 수정 시 동일 VM의 두 타일에서 동시에 네이티브 `WebContentsView`를 각각 열지(타일별 `viewId`), 아니면 한 VM당 하나의 Desktop 스트림 뷰만 허용할지는 구현 시 `spec.md`/`designs.md`에 한 줄로 명시하는 것을 권장한다.

---

## 10. Re-audit Checklist

- [ ] `IMP-F012`: 데모 모드에서 `SessionCommandBar`의 `LIVE PTY COMMAND` 입력 후 `SEND`/`Enter` 및 `Y`/`N`/`1`/`2`/`ESC`/`^C` 클릭 시 실제 `TerminalView`에서 명령이 실행되고 `🟡 PROMPT -> 🔴 RUN -> 🟢 IDLE` 전이가 일어나는지 확인
- [ ] `IMP-F013`: 동일 VM의 `main`, `agent` 타일이 열린 상태에서 타일 내 `SESSION` 버튼으로 이미 열린 세션을 클릭할 때 중복 세션 타일이 생기지 않는지 확인
- [ ] `DBG-F017`: 동일 VM 다중 세션 타일에서 `ALL SPLIT` 실행 후 한 타일만 탭 전환/종료해도 다른 타일의 네이티브 Desktop 뷰가 닫히지 않고 좌표가 충돌하지 않는지 확인
- [ ] `DBG-F018`: 터미널 `RECONNECT` 및 `SessionCommandBar` 일괄 `RECONNECT` 시 이전 버퍼가 중복 복원되지 않는지 확인
- [ ] `DBG-F019`: `1x1` 모드 세션 칩 점프 포커스, `sent === 0` 시 명령어 입력 보존, `SYNCED` 카운트 및 스코프 유지 확인
- [ ] `SEC-F009`: 비정상 `localStorage` 프리셋 데이터 방어 및 볼트 잠금 상태에서 실 프로필 프리셋 클릭 시 잠금 해제 유도 확인
- [ ] `SEC-F010`: `npm audit --audit-level=high` 종료 코드 `0` 확인
- [ ] `SEC-F011`: 볼트 잠금 시 `isKeystrokeMirroring` 해제 및 암호 프롬프트 미러링 보호 확인
- [ ] `IMP-F014`: `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md` 동기화 확인
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=high` 전체 통과 확인

---

## 11. Final Decision

**`HOLD`**

멀티세션 타일 분리(`main`/`agent`/`aux`), ANSI 제거 및 신호등 상태 판별기(`SessionActivityTracker`), 상단 통합 오케스트레이터 바(`SessionCommandBar`), 프리셋 저장소의 비밀정보 분리 등 핵심 구조와 문서(`spec.md`, `designs.md`, `README.md`)는 체계적으로 설계되었으며 기존 감사 5의 수정 사항도 모두 유지되고 있다. 그러나 (1) 데모 PTY 핸들러가 다중 문자 명령/빠른 응답(`'cmd\r'`, `'y\r'`)을 실행하지 못하고 프롬프트 상태가 고착되는 문제(`IMP-F012`), (2) 타일 내 세션 변경 시 중복 세션 방지 계약이 누락된 문제(`IMP-F013`), (3) 동일 VM 다중 타일에서 `SPLIT`/`DESKTOP` 사용 시 네이티브 `WebContentsView` ID(`desktop_${profileId}_${machineId}`)가 충돌·파괴되는 문제(`DBG-F017`)가 확인되어 해당 `Major` finding과 동반 `Minor` finding 수정 후 재감사가 필요하다.

---

## 12. Coder Handoff

```text
`D:\web\instadesk\docs\audit\audit_report_6.md`의 최신 감사 결과를 확인하고,
각 finding(`IMP-F012`~`IMP-F014`, `DBG-F017`~`DBG-F019`, `SEC-F009`~`SEC-F011`, `XPF-F007`~`XPF-F008`)을 관련 프로젝트 문서(`spec.md`, `designs.md`, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`)와 실제 코드에 대조하여 검토한 후 필요한 수정을 수행하세요.
계약 변경이나 보완이 필요한 경우 관련 문서를 먼저 갱신하고, 수정 후 `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=high`를 실행하여 결과를 기록하세요. 원본 감사 리포트(`docs/audit/audit_report_1.md`~`audit_report_6.md`)는 수정하지 말고 보존하세요.
```
