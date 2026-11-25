# InstaDesk 감사 보고서 9 (Audit 8 수정사항 재감사)

- **감사 일시:** 2026-11-25
- **기준 커밋:** `42f3148` (`main` 브랜치 + 미커밋 작업 트리 수정분)
- **이전 감사 보고서:** [audit_report_8.md](file:///d:/web/instadesk/docs/audit/audit_report_8.md)
- **감사 모드:** Read-only 3-Pass 재감사 (Pass 1: Implementation & Documentation / Pass 2: Debugging & Resilience / Pass 3: Security & Privacy)
- **최종 판정:** **`PASS WITH KNOWN RISKS`**
  - Audit 8 수정 범위(**7개 Minor Finding**) **전원 `Verified` (`7/7`), 오픈 Finding 0건**.
  - 단, [audit_roadmap.md](file:///d:/web/instadesk/audit_roadmap.md#L17) 정책에 따라 실 InstaBox API 키를 통한 수동 수용·코드 서명/공증·ASAR/Fuses 미적용은 기존 릴리스 제약(Known Risks)으로 유지함.

---

## 1. 감사 범위 및 실행 검증

### 1.1 대상 범위
- **재감사 대상 Finding (총 7건):** `IMP-F015`, `DBG-F020`, `DBG-F021`, `DBG-F022`, `DBG-F023`, `SEC-F012` (`Re-audit #2`), `SEC-F013`
- **작업 트리 변경 범위 (총 20개 변경: 수정 19개 + 신규 테스트 1개):**
  - 문서: [BUILD_GUIDE.md](file:///d:/web/instadesk/BUILD_GUIDE.md), [CHANGELOG.md](file:///d:/web/instadesk/CHANGELOG.md), [IMPLEMENTATION_SUMMARY.md](file:///d:/web/instadesk/IMPLEMENTATION_SUMMARY.md), [audit_roadmap.md](file:///d:/web/instadesk/audit_roadmap.md), [spec.md](file:///d:/web/instadesk/spec.md)
  - 소스: [electron/apiGateway.ts](file:///d:/web/instadesk/electron/apiGateway.ts), [src/components/SidebarVmList.tsx](file:///d:/web/instadesk/src/components/SidebarVmList.tsx), [src/components/desktop/DesktopScreenView.tsx](file:///d:/web/instadesk/src/components/desktop/DesktopScreenView.tsx), [src/components/modals/ApiKeyModal.tsx](file:///d:/web/instadesk/src/components/modals/ApiKeyModal.tsx), [src/components/modals/CreateVmModal.tsx](file:///d:/web/instadesk/src/components/modals/CreateVmModal.tsx), [src/components/telemetry/MetricsLogsView.tsx](file:///d:/web/instadesk/src/components/telemetry/MetricsLogsView.tsx), [src/components/telemetry/ProcessListView.tsx](file:///d:/web/instadesk/src/components/telemetry/ProcessListView.tsx), [src/services/cryptoVault.ts](file:///d:/web/instadesk/src/services/cryptoVault.ts), [src/services/instaboxClient.ts](file:///d:/web/instadesk/src/services/instaboxClient.ts), [src/store/useAppStore.ts](file:///d:/web/instadesk/src/store/useAppStore.ts)
  - 테스트: [test/createVmModal.test.tsx](file:///d:/web/instadesk/test/createVmModal.test.tsx), [test/cryptoVault.test.ts](file:///d:/web/instadesk/test/cryptoVault.test.ts), [test/electronApiGateway.test.ts](file:///d:/web/instadesk/test/electronApiGateway.test.ts), [test/multiSessionControl.test.tsx](file:///d:/web/instadesk/test/multiSessionControl.test.tsx), [test/audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx) (신규)
  - 보존 확인: 기존 미추적 보고서 [audit_report_8.md](file:///d:/web/instadesk/docs/audit/audit_report_8.md) 및 `audit_report_1.md`~`audit_report_7.md` 무수정 보존.

### 1.2 실행한 검증 명령 및 결과 (`d:\web\instadesk`)
| 명령 | 종료 코드 | 관찰 결과 |
| --- | --- | --- |
| `git status --short; git diff --stat; git log -n 3 --oneline` | `0` | 기준 커밋 `42f3148`, 수정 19개 + 신규 테스트 `test/audit8Remediation.test.tsx` + 기존 `docs/audit/audit_report_8.md` 확인 |
| `npm run typecheck` (`tsc --noEmit`) | `0` | 타입 오류 `0`건 |
| `npm test` (`vitest run`) | `0` | **32 test files, 130 tests passed** (Audit 8 대비 `+1 file / +9 tests`) |
| `npm run build` (`vite build && tsc -p tsconfig.electron.json`) | `0` | Renderer(`dist/assets/index-Cy1SMGuF.js` 612.95 kB) 및 Electron(`dist-electron/`) 빌드 성공 (기존 Vite >500 kB 청크 경고 유지) |
| `npm audit --omit=dev --audit-level=high` | `0` | `found 0 vulnerabilities` |

### 1.3 제외·미검증 범위 (Excluded Scope)
- 유효한 실 InstaBox API 키를 사용한 라이브 REST/SSE/PTY/Desktop 종단 간 수동 수용 검증 (로컬 환경에 실 API 키 미보유)
- macOS/Linux 실기 패키징·설치 및 코드 서명/공증, Electron ASAR/Fuses 적용 검증

---

## 2. 재감사 요약표 (Audit 8 → Audit 9)

| ID | Pass | 심각도 | 재감사 차수 | 대상 요약 | 판정 |
| --- | --- | --- | --- | --- | --- |
| `IMP-F015` | Pass 1 | Minor | Re-audit #1 | 2.2.0 릴리스 문서(`BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`, `spec.md`) 동기화 | **`Verified`** |
| `DBG-F020` | Pass 2 | Minor | Re-audit #1 | `MetricsLogsView`/`ProcessListView` 부분 실패 격리, `role="alert"` 오류 배너, `requestIdRef`/`mountedRef`/`inFlightRef` 가드 | **`Verified`** |
| `DBG-F021` | Pass 2 | Minor | Re-audit #1 | `DesktopScreenView` `loadGenerationRef`/`mountedRef`/`isCurrent()`로 지연 응답 덮어쓰기 차단 | **`Verified`** |
| `DBG-F022` | Pass 2 | Minor | Re-audit #1 | `CreateVmModal` 모달 열기 및 생성 성공 후 이름 입력값(`setName('')`) 초기화 | **`Verified`** |
| `DBG-F023` | Pass 2 | Minor | Re-audit #1 | `SidebarVmList` VM별 `pendingKeys`/`pendingKeysRef` 재진입 차단, 버튼 비활성화, `actionError` 배너 및 `try/catch/finally` 보장 | **`Verified`** |
| `SEC-F012` | Pass 3 | Minor | Re-audit #2 | `ApiKeyModal` `vaultSubmittingRef`/`isVaultSubmitting` 락 + `cryptoVault.ts` `latestRaw` 재조회 및 `salt`/`verifierCiphertext` 대조 후 실패 카운터 갱신·자동 초기화 | **`Verified`** |
| `SEC-F013` | Pass 3 | Minor | Re-audit #1 | `apiGateway.ts` `/v1/machines` 경로 제한·인코딩 우회 차단 + `instaboxClient.ts` `SAFE_MACHINE_ID`/`machinePath()`/`tail` 클램프 + `useAppStore.ts` 프리셋 ID 검증 | **`Verified`** |

---

## 3. Pass별 상세 재감사 증적

### Pass 1: 구현·문서 동기화 (`IMP-F015`)
- **`IMP-F015` (`Re-audit #1`, `Verified`):**
  - [BUILD_GUIDE.md](file:///d:/web/instadesk/BUILD_GUIDE.md#L19-L74) (L19, L22, L35, L47, L62, L74): 릴리스 산출물 예시 버전을 `2.1.3`에서 `2.2.0`으로 일괄 동기화함.
  - [audit_roadmap.md](file:///d:/web/instadesk/audit_roadmap.md#L13): `감사 6~8·2.2.0` 이력 행을 추가하여 Audit 6/7/8 보고서 경로, 태그 CI 실행(`44217221914`), `v2.2.0` 릴리스 링크를 기록함.
  - [IMPLEMENTATION_SUMMARY.md](file:///d:/web/instadesk/IMPLEMENTATION_SUMMARY.md#L1-L46) (L1, L19, L46): 문서 제목을 `InstaDesk 2.2.0 구현 요약`으로 갱신하고 `electron/apiGateway.ts`의 `/v1/machines` 경로 제한 및 `test/audit8Remediation.test.tsx` 포함 회귀 테스트 파일 5종을 반영함.
  - [CHANGELOG.md](file:///d:/web/instadesk/CHANGELOG.md#L8-L15): `[Unreleased]` 섹션에 Audit 8 보안·안정성 수정 내역을 기록함.
  - [spec.md](file:///d:/web/instadesk/spec.md#L104) 및 [spec.md](file:///d:/web/instadesk/spec.md#L139): 워크스페이스 프리셋 `machineId`/`profileId` 정규식(`/^[A-Za-z0-9_-]{1,128}$/`) 및 메인 게이트웨이 경로 검증(`/instabox-api/v1/machines` 및 하위 경로, `/%(?:2f|5c|00)/i` 차단) 계약을 동기화함.

### Pass 2: 디버깅·동시성·UI 복원력 (`DBG-F020` ~ `DBG-F023`)
- **`DBG-F020` (`Re-audit #1`, `Verified`):**
  - [MetricsLogsView.tsx](file:///d:/web/instadesk/src/components/telemetry/MetricsLogsView.tsx#L17-L71) 및 [L111-L115](file:///d:/web/instadesk/src/components/telemetry/MetricsLogsView.tsx#L111-L115): `Promise.allSettled`로 메트릭과 로그 실패를 분리 처리하여 부분 성공 데이터를 유지하고 `errorMessage` 상태 및 `role="alert"` 경고 배너를 노출함. 또한 `requestIdRef`, `mountedRef`, `inFlightRef`로 언마운트 후 상태 갱신, 중복 폴링, 지연 응답(stale response) 덮어쓰기를 차단함.
  - [ProcessListView.tsx](file:///d:/web/instadesk/src/components/telemetry/ProcessListView.tsx#L16-L46): `requestIdRef`와 `mountedRef` 가드를 추가함.
  - 회귀 테스트: [audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx#L38-L103) (부분 실패 시 UI 경고 표시와 성공 데이터 보존, 오래된 요청 응답 무시 검증).
- **`DBG-F021` (`Re-audit #1`, `Verified`):**
  - [DesktopScreenView.tsx](file:///d:/web/instadesk/src/components/desktop/DesktopScreenView.tsx#L45-L120) (L45–L46, L81–L87, L90–L120): `loadGenerationRef`, `mountedRef`, `isCurrent()` 헬퍼를 도입해 VM/프로필 전환 또는 재시도 중 지연 완료된 이전 `getDesktopUrl` 응답이 최신 데스크톱 URL과 오류 상태를 덮어쓰지 않도록 차단함.
  - 회귀 테스트: [audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx#L105-L140).
- **`DBG-F022` (`Re-audit #1`, `Verified`):**
  - [CreateVmModal.tsx](file:///d:/web/instadesk/src/components/modals/CreateVmModal.tsx#L29-L55) (L29, L55): 모달 오픈 시와 VM 생성 성공 직후 `setName('')`을 호출해 이전 VM 이름이 남지 않도록 수정함.
  - 회귀 테스트: [createVmModal.test.tsx](file:///d:/web/instadesk/test/createVmModal.test.tsx#L29-L48).
- **`DBG-F023` (`Re-audit #1`, `Verified`):**
  - [SidebarVmList.tsx](file:///d:/web/instadesk/src/components/SidebarVmList.tsx#L42-L50), [L111-L178](file:///d:/web/instadesk/src/components/SidebarVmList.tsx#L111-L178), [L241](file:///d:/web/instadesk/src/components/SidebarVmList.tsx#L241), [L349-L393](file:///d:/web/instadesk/src/components/SidebarVmList.tsx#L349-L393): `pendingKeys`/`pendingKeysRef`로 VM별 중복 액션 재진입을 막고 작업 중 전원·삭제 버튼에 `disabled={isBusy}`를 적용함. `handleAction`/`handleDelete`를 `try/catch/finally`로 감싸 실패 시 닫기 가능한 `actionError` alert 배너를 표시하고 pending 상태를 해제함.
  - 회귀 테스트: [audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx#L142-L165).

### Pass 3: 보안·프라이버시·경계 검증 (`SEC-F012` ~ `SEC-F013`)
- **`SEC-F012` (`Re-audit #2`, `Verified`):**
  - [ApiKeyModal.tsx](file:///d:/web/instadesk/src/components/modals/ApiKeyModal.tsx#L45-L195) 및 [L266-L319](file:///d:/web/instadesk/src/components/modals/ApiKeyModal.tsx#L266-L319): `vaultSubmittingRef` 동기 락과 `isVaultSubmitting` 상태를 통해 볼트 생성·잠금 해제·마스터 암호 변경 폼의 중복 제출을 차단하고 제출 버튼을 비활성화함.
  - [cryptoVault.ts](file:///d:/web/instadesk/src/services/cryptoVault.ts#L195-L259): PBKDF2 파생·검증 완료 직후 `localStorage`에서 `latestRaw`를 다시 읽고 `salt` 및 `verifierCiphertext` 일치를 확인한 뒤에만 `failedUnlockAttempts` 누적, 10회 실패 시 `resetVault()`, 또는 유효 잠금 해제 시 `failedUnlockAttempts: 0` 저장을 수행해 병렬 오입력 경합 시 카운터 유실이나 구형 볼트 덮어쓰기를 방지함.
  - 회귀 테스트: [cryptoVault.test.ts](file:///d:/web/instadesk/test/cryptoVault.test.ts#L234-L247) (동시 2회 오입력 시 누적 횟수 `2` 보존), [audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx#L167-L193) (UI 동시 제출 차단).
- **`SEC-F013` (`Re-audit #1`, `Verified`):**
  - [electron/apiGateway.ts](file:///d:/web/instadesk/electron/apiGateway.ts#L15-L24): 허용 API 경로를 `apiPath === '/v1/machines' || apiPath.startsWith('/v1/machines/')`로 제한하고, 인코딩된 경로 구분자/널 바이트 패턴(`/%(?:2f|5c|00)/i`)을 거부함.
  - [src/services/instaboxClient.ts](file:///d:/web/instadesk/src/services/instaboxClient.ts#L88-L98) 및 [L219-L648](file:///d:/web/instadesk/src/services/instaboxClient.ts#L219-L648): `SAFE_MACHINE_ID = /^[A-Za-z0-9_-]{1,128}$/`와 `machinePath()`(`encodeURIComponent`)를 모든 machine API 호출에 적용하고, 로그 조회 `tail` 값을 `1..5000`으로 클램프함.
  - [src/store/useAppStore.ts](file:///d:/web/instadesk/src/store/useAppStore.ts#L19-L31): `sanitizePresetTile`에서 `machineId`와 `profileId`에 `SAFE_IDENTIFIER` 검증을 추가함.
  - 회귀 테스트: [electronApiGateway.test.ts](file:///d:/web/instadesk/test/electronApiGateway.test.ts#L35-L51), [multiSessionControl.test.tsx](file:///d:/web/instadesk/test/multiSessionControl.test.tsx#L340-L342), [audit8Remediation.test.tsx](file:///d:/web/instadesk/test/audit8Remediation.test.tsx#L195-L217).

---

## 4. 교차 Pass 충돌 및 회귀 점검
- **교차 Pass 충돌:** 0건 (문서 계약·UI 동시성 가드·Electron 메인 게이트웨이·클라이언트 식별자 검증 간 일관성 확인).
- **신규 Finding / 회귀:** 0건 (`Critical` 0, `Major` 0, `Minor` 0, `Info` 0).

---

## 5. PASS 전 필수 수정 항목 (Required Fixes Before PASS)
- **0건** (Audit 8에서 도출된 7개 Finding 모두 수정 및 회귀 테스트 검증 완료).

---

## 6. 수용된 위험 및 알려진 제약 (Accepted Risks / Known Limitations)
- **`KR-001` 실 InstaBox API 키 수동 수용 미실행:** [audit_roadmap.md](file:///d:/web/instadesk/audit_roadmap.md#L17) 정책상 유효한 실 키를 보유한 사용자가 라이브 REST/SSE/PTY/Desktop 주요 흐름을 직접 검증하기 전까지 전체 라이브 서비스 `PASS`로 간주하지 않음.
- **`KR-002` 배포 아카이브 서명 및 ASAR/Fuses 미적용:** 기존 릴리스 제약으로 macOS/Windows 코드 서명·공증 및 Electron ASAR/Fuses 하드닝이 적용되어 있지 않음.
- **`KR-003` Vite 렌더러 단일 번들 청크 경고:** `dist/assets/index-Cy1SMGuF.js` (`612.95 kB`)가 기본 `500 kB` 경고를 초과함 (기능·보안 차단이 아닌 기존 성능 관찰 항목).

---

## 7. 재감사 체크리스트 (Re-audit Checklist)
- [x] `IMP-F015`: 2.2.0 릴리스 문서 및 계약(`BUILD_GUIDE.md`, `audit_roadmap.md`, `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`, `spec.md`) 동기화 확인
- [x] `DBG-F020`: `MetricsLogsView`·`ProcessListView` 부분 실패 격리, 오류 배너 및 stale 응답 가드 확인
- [x] `DBG-F021`: `DesktopScreenView` 세대 토큰·언마운트 가드 확인
- [x] `DBG-F022`: `CreateVmModal` 모달 오픈 및 생성 성공 시 입력값 초기화 확인
- [x] `DBG-F023`: `SidebarVmList` VM별 중복 액션 방지, 비활성화 및 오류 배너 표시 확인
- [x] `SEC-F012` (`Re-audit #2`): `ApiKeyModal` 제출 락 및 `cryptoVault.ts` 최신 상태 대조 카운터 갱신 확인
- [x] `SEC-F013`: `apiGateway.ts`, `instaboxClient.ts`, `useAppStore.ts` 경로·식별자 경계 검증 확인
- [x] 전체 검증: `npm run typecheck`, `npm test` (32 files / 130 tests), `npm run build`, `npm audit --omit=dev --audit-level=high` (0 vulnerabilities) 통과
- [x] 감사자 읽기 전용 경계 준수 (소스·테스트·설정·기존 감사 보고서 무수정)

---

## 8. 최종 판정 및 Coder Handoff

- **최종 판정:** **`PASS WITH KNOWN RISKS`**
  - **Audit 8 수정·재감사 범위(코드·문서·테스트·로컬 보안 경계):** **7/7 `Verified`**, 미해결 `Critical`/`Major`/`Minor` Finding **0건**.
  - **유지 제약:** 실 InstaBox API 키 기반 수동 수용(`KR-001`), 코드 서명/공증·ASAR/Fuses(`KR-002`), Vite 청크 크기 경고(`KR-003`).

### Coder / Release Handoff
Audit 8의 7건 Finding은 모두 코드·문서·회귀 테스트 차원에서 검증 완료되었습니다. 다음 단계로 사용자 승인 하에 작업 트리 변경 사항을 검토·커밋하고, 실 InstaBox API 키를 통한 수동 수용 테스트(`KR-001`)를 진행하면 됩니다.
