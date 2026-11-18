# D3D Audit Report — InstaDesk 멀티세션 동시 제어 및 볼트 보안 확장 재감사 (Audit 7)

- **작성일:** 2026-11-18 (Asia/Seoul)
- **프로젝트 경로:** `D:\web\instadesk`
- **감사 기준:** `AI_AUDIT_DOC_STANDARD.md` (§16 Re-audit Rules 포함), `AGENTS.md`, `spec.md` (v2.2.0), `designs.md` (v1.1.0), `DESIGN_DECISIONS.md` (v1.1.0), `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`
- **대상 범위:**
  1. 감사 6(`docs/audit/audit_report_6.md`)의 모든 finding(`IMP-F012`~`IMP-F014`, `DBG-F017`~`DBG-F019`, `SEC-F009`~`SEC-F011`, `XPF-F007`~`XPF-F008`) 해소 여부 재감사 (`Re-audit #1`)
  2. 새로 추가된 마스터 볼트 초기 생성(`CREATE VAULT`) vs 잠금 해제(`UNLOCK VAULT`) 분기 및 10회 연속 잠금 해제 실패 시 볼트 영구 삭제(`resetVault`) 기능 감사
- **Final Decision:** **`PASS WITH KNOWN RISKS`** (`Critical` 0건, `Major` 0건; 감사 6의 `Major` 3건 및 `Minor` 5건 해소 확인. 개발 의존성 `picomatch` 자문 `SEC-F010` 1건만 CI 워크플로 옵션 조정 대상으로 남음)

---

## 1. Audit Scope

### 1.1 프로젝트 및 환경 인벤토리
- **프로젝트 유형:** Electron Desktop Application (`Electron 45.2.1` + `React 18.3.1` + `TypeScript 5.6.3` + `Vite 8.3.5` + `Zustand 5.0.0` + `@xterm/xterm 5.5.0`)
- **확인한 문서:**
  - `spec.md` (v2.2.0 — §3.2 `failedUnlockAttempts`, §3.3 초기 생성/10회 실패 삭제, §3.4 프리셋·미러링 잠금 경계, §4.2 타일별 `desktop_${tileId}` 및 `RECONNECT` 캐시 정리, §5.5 멀티세션·중복 세션 포커스·`isSensitive` 미러링 차단 반영)
  - `designs.md` (v1.1.0 — §3.3 타일별 `desktop_${tileId}`, `RECONNECT` 캐시 비저장, §3.4 `04_SESSION_ORCHESTRATOR` 반영)
  - `IMPLEMENTATION_SUMMARY.md` (`v2.1.3 + 멀티세션 제어 확장` 및 볼트 `create`/`unlock`/10회 실패 삭제 반영)
  - `DESIGN_DECISIONS.md` (v1.1.0 — Decision 14 멀티세션·신호등·미러링·프리셋, Decision 15 볼트 미초기화 Create 전환 및 10회 실패 자동 파기 반영)
  - `CHANGELOG.md` (`[Unreleased]` 섹션에 멀티세션 및 볼트 신규/수정 사항 반영)
  - `README.md` (영문/국문 멀티세션 기능 표 및 10회 실패 시 볼트 삭제 안내 반영)
  - `docs/audit/audit_report_6.md` (직전 감사 리포트)
- **확인한 소스 및 테스트 파일:**
  - 멀티세션 및 터미널/데스크톱: `src/types/instabox.ts`, `src/store/useAppStore.ts`, `src/components/SessionCommandBar.tsx`, `src/components/VmTilePane.tsx`, `src/components/SplitWorkspaceView.tsx`, `src/components/WorkspaceGrid.tsx`, `src/components/SidebarVmList.tsx`, `src/components/desktop/DesktopScreenView.tsx`, `src/components/terminal/TerminalView.tsx`, `src/components/terminal/sessionActivity.ts`, `src/components/terminal/terminalRegistry.ts`, `electron/desktopViewPolicy.ts`
  - 볼트 생성/해제 및 10회 실패 파기: `src/types/vault.ts`, `src/services/cryptoVault.ts`, `src/components/modals/MasterUnlockModal.tsx`, `src/components/modals/ApiKeyModal.tsx`, `src/components/HeaderBar.tsx`
  - 테스트 파일: `test/sessionActivity.test.ts`, `test/multiSessionControl.test.tsx`, `test/terminalLiveDemoIntegration.test.tsx` (신규), `test/vaultUnlockCreateAndWipe.test.tsx` (신규), `test/cryptoVault.test.ts` 외 전체 31개 테스트 파일

### 1.2 실행한 검증 명령 및 결과

| 명령 | CWD | Exit Code | 결과 요약 |
| --- | --- | :---: | --- |
| `git status --short` | `D:\web\instadesk` | `0` | 수정 20개 파일, 신규 8개 파일(`audit_report_6.md` 포함) 확인 |
| `npm run typecheck` | `D:\web\instadesk` | `0` | `tsc --noEmit` 오류 0건 |
| `npm test` | `D:\web\instadesk` | `0` | **31개 테스트 파일, 121개 테스트 전체 통과** (직전 29파일 110테스트 → +2파일 +11테스트 추가) |
| `npm run build` | `D:\web\instadesk` | `0` | 렌더러(`dist/`) 및 Electron(`dist-electron/`) 번들 성공 |
| `npm audit --omit=dev` | `D:\web\instadesk` | `0` | 배포 런타임(shipped) 의존성 취약점 **0건** |
| `npm audit` | `D:\web\instadesk` | `1` | 개발 의존성 하위 `picomatch` (`GHSA-fc5q-39xc-vjpf`, upstream 패치 미출시 `range: *`) 경고 유지 (`SEC-F010`) |

### 1.3 검사한 케이스
1. **감사 6 Finding 재검증 (`Re-audit #1`):**
   - 데모 PTY에서 개행 포함 다중 문자 입력(`'apt\r'`, `'y\r'`, `'n\r'`, `'1\r'`, `'2\r'`)과 `ESC`(`\u001b`), `Ctrl+C`(`\u0003`) 실행 및 `🟡 PROMPT -> 🔴 RUN -> 🟢 IDLE` 전이 (`IMP-F012`)
   - 타일 내부 세션 전환(`setTileSessionName`) 시 동일 VM 중복 세션 차단 및 기존 타일 포커스 이동 (`IMP-F013`)
   - 2차 통제 문서(`IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`) 동기화 (`IMP-F014`)
   - 동일 VM 다중 타일의 `SPLIT`/`DESKTOP` 전환 시 `desktop_${tileId}` 기반 `WebContentsView` 격리 및 개별 언마운트 안전성 (`DBG-F017`)
   - 수동/일괄 `RECONNECT` 시 `skipNextHistorySaveRef`를 통한 이전 버퍼 재저장/중복 복원 차단 (`DBG-F018`)
   - `1x1` 비포커스 타일 칩 점프 시 마운트 후 터미널 포커스, `sent === 0` 시 입력 보존, `SYNCED` 카운트 및 `ALL` 스코프 유지 (`DBG-F019`)
   - 프리셋 JSON 역직렬화 시 필드 스키마/열거값 검증·중복 세션 제거 및 잠금 상태에서 실 프로필 프리셋 클릭 시 잠금 해제 모달 오픈 (`SEC-F009`)
   - 볼트 잠금/`clearAllTiles`/`applyPreset` 시 `isKeystrokeMirroring: false` 리셋 및 암호 프롬프트(`isSensitive`) 시 키스트로크 미러링 자동 일시 차단 (`SEC-F011`)
2. **신규 볼트 기능 감사 (Decision 15):**
   - 볼트 미초기화(`!isVaultInitialized`) 시 `HeaderBar`(`SET MASTER KEY`) 및 `MasterUnlockModal`에서 `CREATE VAULT`(15자 이상 + 확인 입력) UI 표시 및 생성 즉시 잠금 해제 동작
   - 볼트 초기화 완료(`isVaultInitialized && !isVaultUnlocked`) 시 `UNLOCK VAULT` UI 표시 및 실패 횟수(`failedUnlockAttempts / 10`) 실시간 안내
   - 9회 실패 후 정상 비밀번호 입력 시 `failedUnlockAttempts`가 `0`으로 리셋되고 프로필 데이터가 보존되는지 확인
   - 10회 연속 실패 시 `cryptoVault.resetVault()`가 호출되어 `localStorage`의 `instabox_deck_vault_v1`, 인메모리 프로필, 열린 실 프로필 타일/머신이 즉시 파기되고 모달이 `CREATE VAULT` 초기 상태로 전환되는지 확인

---

## 2. Excluded Scope

- `node_modules/`, `dist/`, `dist-electron/`, `release/`, `.git/` 등 생성·외부 벤더 트리는 직접 수정 감사에서 제외했다.
- 실 `instabox.sh` API 키를 이용한 원격 서버 E2E 호출 및 물리 Linux 기기 패키징 설치는 제외했다.

---

## 3. Pass 1: Implementation Compliance Findings

### 3.1 감사 6 Pass 1 Finding 재감사 결과

#### [IMP-F012] (Re-audit #1) 데모 모드 터미널 다중 문자 명령/빠른 응답 실행 및 상태 전이
- **Severity:** `Major`
- **Status:** **`Verified`**
- **Modified Files:** `src/components/terminal/TerminalView.tsx:212-335`, `test/terminalLiveDemoIntegration.test.tsx:89-130`
- **Verification Evidence:**
  - `TerminalView.tsx:254-335`에서 `handleDemoData`가 `\r\n`을 정규화하며 문자 단위(`handleDemoChar`)로 입력을 처리하도록 수정되었고, `awaitingConfirm` 제출·`ESC`(`\u001b`)·`Ctrl+C`(`\u0003`) 시 `tracker.recordInput(...)` 호출 및 타이머 정리가 연결되었다.
  - 신규 통합 테스트 `test/terminalLiveDemoIntegration.test.tsx`가 실제 `TerminalView`와 `SessionCommandBar`를 함께 마운트해 `'apt'` 명령 전송 → `🟡 PROMPT` → `'Y'` 빠른 응답 → `🔴 RUN` → `🟢 IDLE` 복귀 및 `'confirm'` → `'ESC'` 취소 → `🟢 IDLE` 복귀를 검증하여 통과했다.

#### [IMP-F013] (Re-audit #1) 타일 내부 세션 전환(`setTileSessionName`) 중복 세션 방지
- **Severity:** `Major`
- **Status:** **`Verified`**
- **Modified Files:** `src/store/useAppStore.ts:538-559`, `test/multiSessionControl.test.tsx:212-222`
- **Verification Evidence:**
  - `useAppStore.ts:538-559`에서 `setTileSessionName`이 `VALID_SESSIONS` 검증 후 동일 `(profileId, machineId, sessionName)`을 점유 중인 다른 타일(`conflict`)이 있으면 세션을 덮어쓰지 않고 `set({ focusedTileId: conflict.tileId })`로 포커스를 전환한다.
  - `test/multiSessionControl.test.tsx:212-222` 회귀 테스트 통과.

#### [IMP-F014] (Re-audit #1) 2차 통제 문서(`IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`) 동기화
- **Severity:** `Minor`
- **Status:** **`Verified`**
- **Modified Files:** `IMPLEMENTATION_SUMMARY.md:31,38-46`, `DESIGN_DECISIONS.md:126-145`, `CHANGELOG.md:8-25`, `spec.md`, `designs.md`, `README.md`
- **Verification Evidence:**
  - 멀티세션 아키텍처(Decision 14)와 볼트 초기 생성/10회 실패 자동 파기(Decision 15)가 `spec.md`, `designs.md`, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md`, `README.md` 전 문서에 일관되게 반영되었다.

### 3.2 신규 볼트 기능(Create/Unlock 분기 및 10회 실패 파기) 정합성 판정
- **Status:** **`Verified`**
- **Verification Evidence:**
  - `spec.md:77, 97-100`, `DESIGN_DECISIONS.md:138-145`, `README.md:49, 115`의 명세와 `src/types/vault.ts:26`, `src/services/cryptoVault.ts:9,18-28,98-109,195-231`, `src/components/modals/MasterUnlockModal.tsx:39-201`, `src/components/modals/ApiKeyModal.tsx:248-257`, `src/components/HeaderBar.tsx:116-125`의 구현이 정확히 일치한다.
  - `test/vaultUnlockCreateAndWipe.test.tsx` (2건) 및 `test/cryptoVault.test.ts:190-232` (2건)에서 미초기화 시 Create 전환, 초기화 후 Unlock 표시, 10회 미만 실패 후 성공 시 카운터 초기화, 10회 실패 시 `instabox_deck_vault_v1` 및 런타임 상태 완전 삭제가 결정적으로 검증되었다.

---

## 4. Pass 2: Debug / Engineering Quality Findings

### 4.1 감사 6 Pass 2 Finding 재감사 결과

#### [DBG-F017] (Re-audit #1) 동일 VM 다중 세션 타일의 네이티브 `WebContentsView` ID 격리
- **Severity:** `Major`
- **Status:** **`Verified`**
- **Modified Files:** `src/components/desktop/DesktopScreenView.tsx:21,29,54-55`, `src/components/VmTilePane.tsx:218`, `src/components/SplitWorkspaceView.tsx:68`, `test/multiSessionControl.test.tsx:224-269`
- **Verification Evidence:**
  - `DesktopScreenView`가 `tileId` prop을 받아 `desktop_${normalizedTileId}`(`electron/desktopViewPolicy.ts:44`의 `/^[A-Za-z0-9_-]{1,256}$/` 충족)를 `viewId`로 사용한다.
  - `test/multiSessionControl.test.tsx:224-269`에서 동일 VM의 두 타일(`tile-a`, `tile-b`)이 각각 `desktop_tile-a`, `desktop_tile-b`로 열리고 `tile-a` 언마운트 시 `desktop_tile-a`만 닫히며 `desktop_tile-b`는 유지됨을 확인했다. 기존 `test/desktopNativeView.test.tsx` (3건)도 `tileId` 미전달 폴백(`desktop_${profileId}_${machineId}`)으로 정상 통과한다.

#### [DBG-F018] (Re-audit #1) 수동/일괄 `RECONNECT` 시 이전 터미널 캐시 중복 복원 방지
- **Severity:** `Minor`
- **Status:** **`Verified`**
- **Modified Files:** `src/components/terminal/TerminalView.tsx:43,71,448-454,475-488`, `test/terminalLiveDemoIntegration.test.tsx:164-182`
- **Verification Evidence:**
  - `handleReconnect`가 `skipNextHistorySaveRef.current = true` 설정 및 `terminalHistoryCache.clearSession(tileId, sessionName)` 호출 후 `term.reset()`을 수행하며, 직후 실행되는 `useEffect` cleanup에서 캐시 재저장을 건너뛴다.
  - `test/terminalLiveDemoIntegration.test.tsx:164-182`에서 재연결 후 캐시가 비어 있고 이전 배너가 복원되지 않음을 확인했다.

#### [DBG-F019] (Re-audit #1) `SessionCommandBar`의 `1x1` 점프 포커스, 미전송 시 입력 보존, `SYNCED` 카운트/스코프 보정
- **Severity:** `Minor`
- **Status:** **`Verified`**
- **Modified Files:** `src/components/SessionCommandBar.tsx:74-75,93-120,139-146,151-163,170-178,379`, `test/multiSessionControl.test.tsx:271-327`
- **Verification Evidence:**
  - `pendingJumpFocusRef`와 `useEffect([focusedTileId, tiles])`(+ `requestAnimationFrame`)를 통해 `1x1` 모드에서 비포커스 타일 칩 클릭 후 마운트될 때 터미널 포커스가 호출된다.
  - `sent === 0`일 때 `0/${targetIds.length} PTY READY (INPUT KEPT)`를 표시하고 `command` 입력값을 유지한다.
  - `SYNCED (${syncedTerminalTiles.length})`로 터미널/스플릿 가능 타일 수만 집계하며, `prevSyncedCountRef`로 `0 <-> >0` 전이 시에만 스코프를 자동 전환한다.
  - `test/multiSessionControl.test.tsx:271-327` 회귀 테스트 통과.

---

## 5. Pass 3: Security Findings

### 5.1 감사 6 Pass 3 Finding 재감사 결과

#### [SEC-F009] (Re-audit #1) 워크스페이스 프리셋(`instabox_deck_presets_v1`) 스키마 검증 및 잠금 상태 해제 모달 연결
- **Severity:** `Minor`
- **Status:** **`Verified`**
- **Modified Files:** `src/store/useAppStore.ts:19-100,638-683`, `test/multiSessionControl.test.tsx:329-367`
- **Verification Evidence:**
  - `sanitizePresetTile`과 `deduplicatePresetTiles`가 `machineId`, `profileId`, `activeTab`, `terminalSessionName`, `desktopViewOnly`, `gridMode`를 검증·정규화하고 중복 `(profileId, machineId, terminalSessionName)`을 제거한다.
  - 잠금 상태에서 실 프로필 전용 프리셋 적용 시 `set({ isUnlockModalOpen: true })`로 잠금 해제 모달을 띄운다.

#### [SEC-F011] (Re-audit #1) 볼트 잠금 시 키스트로크 미러링 해제 및 암호 프롬프트(`isSensitive`) 미러링 차단
- **Severity:** `Minor`
- **Status:** **`Verified`**
- **Modified Files:** `src/store/useAppStore.ts:245,297,583,677`, `src/components/terminal/sessionActivity.ts:70-72,111-126,207`, `src/components/terminal/TerminalView.tsx:46-51,168-183,347-349,411-413,521-531`, `test/terminalLiveDemoIntegration.test.tsx:132-162`, `test/multiSessionControl.test.tsx:368-378`
- **Verification Evidence:**
  - 볼트 잠금, `clearAllTiles`, `applyPreset` 시 `isKeystrokeMirroring: false`로 즉시 초기화된다.
  - `SENSITIVE_PROMPT_PATTERN`이 `password:`, `passphrase:`, `pin:`, `otp:`, `secret:`, `api key:` 프롬프트에 `isSensitive: true`를 부여하고, 동기화 타일 중 하나라도 `isSensitive`이면 키스트로크 미러링을 일시 중단하며 `MIRROR PAUSED (SECRET)` 배지를 표시한다.

#### [SEC-F010] (Re-audit #1) 개발 의존성 `picomatch` (`GHSA-fc5q-39xc-vjpf`)로 인한 CI `npm audit --audit-level=high` 실패
- **Pass:** Security
- **Pattern:** `SEC-006`, `BUILD-001`
- **Area:** 의존성 감사 범위 (`.github/workflows/desktop.yml:39`)
- **Severity:** `Minor`
- **Status:** `Needs Fix` (또는 CI 워크플로 `--omit=dev` 전환)
- **Summary:** 배포 런타임 의존성(`npm audit --omit=dev`)은 취약점이 **0건**으로 안전하나, 개발 의존성(`vite`, `vitest`, `tailwindcss`) 하위의 `picomatch`에 대한 GitHub 권고(`GHSA-fc5q-39xc-vjpf`)가 현재 패치 버전 미출시(`range: "*"`) 상태여서 `.github/workflows/desktop.yml:39`의 `npm audit --audit-level=high` 명령이 Exit Code `1`을 반환한다.
- **Evidence:**
  - `npm audit --omit=dev` → `found 0 vulnerabilities` (Exit Code `0`).
  - `npm audit --json` → `picomatch` `range: "*"` (upstream 패치 버전 없음), `isDirect: false` (`tailwindcss`, `vite`, `vitest` 하위).
  - `.github/workflows/desktop.yml:39` → `- run: npm audit --audit-level=high`.
- **Suggested Fix:** `AI_AUDIT_DOC_STANDARD.md` `SEC-006`(shipped scope 검증)에 맞춰 `.github/workflows/desktop.yml:39`를 `npm audit --omit=dev --audit-level=high`로 조정하거나, upstream `picomatch` 패치 릴리스 후 `package-lock.json`을 갱신한다.
- **Re-audit Method:** `.github/workflows/desktop.yml`의 감사 명령 실행 시 Exit Code `0` 확인.
- **Owner:** Coder

### 5.2 신규 볼트 10회 실패 파기 기능의 방어적 관찰 사항

#### [SEC-F012] `cryptoVault.unlock()` 실패 카운트 갱신 시 최신 저장소 재확인 보강 여지
- **Pass:** Security
- **Pattern:** `SEC-001`
- **Area:** 볼트 잠금 해제 실패 카운터 (`src/services/cryptoVault.ts:195-216`)
- **Severity:** `Info`
- **Status:** `Verified` (정상 단일/순차 흐름 통과, 동시성 방어 메모)
- **Summary:** `cryptoVault.unlock()`은 PBKDF2 키 파생(비동기) 시작 시점의 `raw` 스냅샷에서 `previousAttempts`를 읽고, 10회 도달 시 `this.resetVault()`를 호출한다. 일반적인 UI 폼 제출(`isSubmitting`으로 중복 제출 방지됨, `MasterUnlockModal.tsx:155`)에서는 완벽히 동작하며, `catch` 블록에서 최신 `localStorage.getItem(STORAGE_KEY)`를 다시 읽어 동일한 `salt`/`verifierCiphertext`인지 확인한 뒤 `resetVault()`를 호출하면 비정상 병렬 호출에서도 더욱 견고해진다.

---

## 6. Cross-Pass Conflicts

| Conflict ID | 원 관련 Finding | 재감사 결과 |
| --- | --- | --- |
| `XPF-F007` (Re-audit #1) | `IMP-F012`, `DBG-F019` | **Resolved (`Verified`)** — 실제 `TerminalView`와 `SessionCommandBar` 결합 통합 테스트(`test/terminalLiveDemoIntegration.test.tsx`)가 추가되어 모의 테스트와 실제 런타임 간 괴리가 해소됨 |
| `XPF-F008` (Re-audit #1) | `IMP-F013`, `DBG-F017` | **Resolved (`Verified`)** — `DesktopScreenView`가 타일별 `desktop_${tileId}`를 사용하도록 수정되고 `spec.md:135` 및 `designs.md:110`에 명시되어 멀티세션 `ALL SPLIT`과의 충돌이 해소됨 |

---

## 7. Required Fixes Before PASS

- `Critical` / `Major` 차단급 finding은 **0건**이다(모두 해소됨).
- 후속 릴리스 태그 푸시 전 권고 조치(`Minor` 1건):
  1. **`[SEC-F010]` (Minor):** `.github/workflows/desktop.yml:39`의 `npm audit --audit-level=high`가 upstream 패치 미출시(`range: *`)인 개발 전용 의존성 `picomatch` (`GHSA-fc5q-39xc-vjpf`) 때문에 실패하지 않도록 배포 범위 검사(`npm audit --omit=dev --audit-level=high`)로 조정하거나 upstream 패치 시 잠금 파일을 업데이트할 것.

---

## 8. Accepted Risks / Known Limitations

- **배포 런타임 외 개발 의존성 권고 (`SEC-F010`):** `npm audit --omit=dev` 기준 배포 앱에 포함되는 의존성(`ws`, `react`, `@xterm/*`, `zustand`, `lucide-react`)의 취약점은 0건이다.
- **기존 알려진 제한 유지 (`audit_roadmap.md`):** 미서명 포터블 아카이브(SHA-256 검증 절차 제공), 부분 가시 영역의 네이티브 Desktop 뷰 숨김 정책, 실 API 키를 통한 원격 서버 멀티세션/Desktop 수동 수용 검증은 기존 로드맵 기준을 그대로 유지한다.

---

## 9. Needs Spec Clarification

- 없음 (`spec.md` v2.2.0, `designs.md` v1.1.0, `DESIGN_DECISIONS.md` Decision 14~15에 모든 신규 기능 및 경계 조건이 명확히 문서화됨).

---

## 10. Re-audit Checklist

- [x] `IMP-F012` (Re-audit #1): 데모 모드 다중 문자 명령/빠른 응답(`Y`/`N`/`1`/`2`/`ESC`/`^C`) 실행 및 `🟡 -> 🔴 -> 🟢` 상태 전이 확인 (`test/terminalLiveDemoIntegration.test.tsx`)
- [x] `IMP-F013` (Re-audit #1): 타일 내부 세션 전환(`setTileSessionName`) 중복 세션 차단 및 기존 타일 포커스 확인 (`test/multiSessionControl.test.tsx`)
- [x] `IMP-F014` (Re-audit #1): `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md` 동기화 확인
- [x] `DBG-F017` (Re-audit #1): 동일 VM 다중 타일 `desktop_${tileId}` 네이티브 뷰 ID 격리 및 독립 종료 확인 (`test/multiSessionControl.test.tsx`)
- [x] `DBG-F018` (Re-audit #1): 수동/일괄 `RECONNECT` 시 캐시 미재저장 확인 (`test/terminalLiveDemoIntegration.test.tsx`)
- [x] `DBG-F019` (Re-audit #1): `1x1` 칩 점프 포커스, `0 sent` 입력 유지, `SYNCED` 카운트 및 스코프 유지 확인 (`test/multiSessionControl.test.tsx`)
- [x] `SEC-F009` (Re-audit #1): 프리셋 스키마 검증·중복 제거 및 잠금 상태 실 프로필 프리셋 클릭 시 잠금 해제 모달 오픈 확인 (`test/multiSessionControl.test.tsx`)
- [x] `SEC-F011` (Re-audit #1): 볼트 잠금 시 미러링 초기화 및 암호 프롬프트(`isSensitive`) 미러링 차단 확인 (`test/terminalLiveDemoIntegration.test.tsx`)
- [x] 신규 볼트 기능 (Decision 15): 미초기화 시 `CREATE VAULT`, 초기화 후 `UNLOCK VAULT` 표시 및 10회 연속 실패 시 볼트 데이터 영구 파기 확인 (`test/vaultUnlockCreateAndWipe.test.tsx`, `test/cryptoVault.test.ts`)
- [ ] `SEC-F010` (Re-audit #1): CI 워크플로(`.github/workflows/desktop.yml:39`)의 `npm audit` 스코프 조정 또는 upstream `picomatch` 패치 반영

---

## 11. Final Decision

**`PASS WITH KNOWN RISKS`**

직전 감사(`audit_report_6.md`)에서 지적된 모든 `Major` finding(`IMP-F012`, `IMP-F013`, `DBG-F017`)과 구현·디버그·보안 `Minor` finding(`IMP-F014`, `DBG-F018`, `DBG-F019`, `SEC-F009`, `SEC-F011`)이 코드, 문서, 결정적 단위/통합 테스트(31파일 121테스트 전체 통과)에서 모두 해소되었음을 확인했다. 아울러 새로 추가된 마스터 볼트 초기 생성(`CREATE VAULT`)/잠금 해제(`UNLOCK VAULT`) 분기 및 10회 연속 실패 시 볼트 데이터 영구 삭제 기능도 명세(`spec.md`, `DESIGN_DECISIONS.md` Decision 15)와 코드·테스트에 정합성 있게 구현되었다. 배포 런타임 의존성 취약점은 0건(`npm audit --omit=dev`)이며, CI 파이프라인의 개발 의존성 감사 옵션(`SEC-F010`)만 후속 수정 대상으로 남는다.

---

## 12. Coder Handoff

```text
`D:\web\instadesk\docs\audit\audit_report_7.md`의 최신 재감사 결과를 확인하세요.
감사 6의 모든 Major/기능 finding과 신규 볼트 생성/10회 실패 파기 기능은 Verified 통과했습니다.
남은 Minor 항목인 `SEC-F010`(`picomatch` `GHSA-fc5q-39xc-vjpf` 개발 의존성 권고로 인한 `.github/workflows/desktop.yml:39` `npm audit --audit-level=high` 실패)과 `SEC-F012`(참고 메모)를 검토하여 필요한 경우 CI 감사 명령 범위(`--omit=dev`) 또는 의존성 설정을 반영하고, 원본 감사 리포트(`docs/audit/audit_report_1.md`~`audit_report_7.md`)는 보존하세요.
```
