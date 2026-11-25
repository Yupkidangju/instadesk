# InstaDesk 2.2.1 구현 요약

2026-11-25 · Windows x64·Linux x64·Linux arm64 Electron 포터블 앱. 기존 웹 구현 요약은 [보존본](docs/legacy/IMPLEMENTATION_SUMMARY.web-2026-11-01.md)에 있다.

## 구조

```text
InstaDesk.exe (Windows) / InstaDesk (Linux)
└─ resources/app/
   ├─ dist/                  React, xterm, 스타일 번들
   ├─ dist-electron/         Electron main/preload 번들
   ├─ node_modules/ws/       PTY WebSocket 클라이언트
   └─ package.json
```

- `src/`: React UI, 로컬 Web Crypto 볼트, 머신 상태·REST/SSE 클라이언트. `src/services/instaboxClient.ts`는 `/instabox-api` 상대 경로만 사용한다.
- `electron/appProtocol.ts`: `app://instadesk` 정적 자산 경로 제한.
- `electron/userDataPath.ts`·`electron/main.ts`: Electron `userData`·`sessionData`를 버전 없는 `InstaDesk` 사용자 경로로 고정한다.
- `electron/apiGateway.ts`: `/instabox-api/v1/machines` 및 하위 경로를 고정 `https://api.instabox.sh/v1/machines*`로 중계. 인코딩된 경로 구분자/널 바이트(`%2f`/`%5c`/`%00`), 메서드·Bearer 형식·리다이렉트를 제한하고 SSE 본문을 스트리밍한다.
- `electron/terminalGateway.ts`: 허용 InstaBox WSS 티켓만 연결하고 서버 `session` 준비·거절·close code를 분류한다. 준비 전 입력을 거부하고 PTY 입출력·프로필/전체 종료를 관리한다.
- `electron/preload.ts`와 `electron/main.ts`: 격리된 BrowserWindow 및 제한 IPC 브리지. 렌더러에 Node를 노출하지 않는다.
- `scripts/build-electron.mjs`, `scripts/package-win.mjs`, `scripts/package-linux.mjs`: 타입 검사·Vite/esbuild 번들, 각 네이티브 아키텍처의 Electron 공식 바이너리 포터블 패키지 생성.
- `.github/workflows/desktop.yml`: 세 아키텍처 타입·테스트·감사·패키지 로드 게이트와 버전 태그 Release 게시.

## 데이터 흐름

마스터 암호 → 렌더러 Web Crypto 세션 키 → 앱 Origin localStorage의 암호화 프로필 → 요청 중 복호화 → app 프로토콜의 메인 HTTPS 호출. PTY는 REST 티켓 발급 후 제한 IPC로 메인 WebSocket을 열고 이벤트만 렌더러에 보낸다. 데스크톱은 발급된 URL을 격리된 최상위 `WebContentsView`에 열며 메인 프로세스가 URL과 좌표를 검증한다.

빌드·검증은 [BUILD_GUIDE.md](BUILD_GUIDE.md)와 [Electron 검증 기록](docs/electron/verification.md)을 참조한다. 실 키의 목록·PTY·Desktop 화면 맞춤을 확인했다. 변경 API·SSE·Desktop 입력은 미검증이다.

감사 4의 변경은 [수정 계약](docs/electron/audit_4_remediation.md)과 [finding별 결과](docs/audit/audit_report_4_remediation.md)를 기준으로 한다. `cryptoVault.ts`는 v1→v2 이행·암호문구 변경·사용자 입력 기준 잠금·해제 10회 이상 실패 시 볼트 데이터 영구 삭제(`resetVault`)를 담당한다. `TerminalView.tsx`는 준비 신호 뒤 LIVE 표시와 한정 재시도를 담당한다. `ApiKeyModal.tsx`와 `MasterUnlockModal.tsx`는 비밀 입력을 닫기·잠금·실패 후 지우며, `MasterUnlockModal.tsx`는 볼트 미초기화 시 생성(`create`) 화면을, 초기화 이후에는 잠금 해제(`unlock`) 화면을 표시한다.
자동 조회의 `lastUsedAt` 쓰기는 최신 볼트 레코드에 병합해 새 프로필을 잃는 경합을 막는다. v1→v2 및 v2의 키 프로필 5개 보존을 회귀 테스트로 확인한다.

2.1.2 스크롤 수정은 `WorkspaceGrid.tsx`의 작업 영역 식별, `DesktopScreenView.tsx`의 자리·가시성 계산, `electron/desktopViewGateway.ts`의 네이티브 가시성·휠 전달을 연결한다. 목표와 검증 순서는 `docs/electron/desktop_scroll_2_1_2.md`에 있다.

감사 5 수정은 xterm 휠 경계와 타일/세션별 제한 메모리 기록 복원, 동봉 Linux 안내의 패키지명 생성 및 플랫폼별 SHA-256 설치 절차다. `docs/electron/audit_5_remediation.md`의 계약·검증 순서를 따른다.

`terminalWheelPolicy.ts`·`TerminalView.tsx`·`src/index.css`는 일반 휠의 xterm 소유와 Shift+휠의 작업 영역 이동을 담당한다. `terminalHistoryCache.ts`와 xterm SerializeAddon은 포커스·탭 왕복 시 출력/위치를 복원하고 `useAppStore.ts`는 잠금·삭제 때 정리하며 수동/일괄 `RECONNECT` 시에는 중복 복원을 막는다. `render-linux-setup.mjs`와 `package-linux.mjs`는 현재 패키지 이름을 동봉 안내에 넣으며 CI는 안내/해시와 Linux 파일 권한을 검사한다. [finding별 자체 검증](docs/audit/audit_report_5_remediation.md)에 실행 결과와 남은 범위를 기록한다.

## 멀티세션 동시 제어·상태 인디케이터 아키텍처 (Audit 6 반영)

- **다중 세션 타일 및 네이티브 뷰 격리**: `useAppStore.ts`는 `(profileId, machineId, terminalSessionName)` 조합별로 `main`/`agent`/`aux` 세션을 독립 타일로 열고, `setTileSessionName`·`applyPreset`에서도 중복 세션 생성 대신 기존 타일 포커스로 전환해 서버 `taken` 충돌을 방지한다. `DesktopScreenView.tsx`는 `tileId`가 전달되면 `desktop_${tileId}`로 네이티브 `WebContentsView`를 격리해 동일 VM 다중 타일의 `SPLIT`/`DESKTOP` 전환과 닫기를 독립 처리한다.
- **세션 상태 판별기 (`src/components/terminal/sessionActivity.ts`)**: `SessionActivityTracker`와 `detectSessionActivityFromTail`이 ANSI/커서 제어 시퀀스를 정리한 뒤 입출력 꼬리를 분석해 `running`(🔴)·`prompt`(🟡 + 질문 요약 및 `isSensitive` 비밀 입력 플래그)·`idle`(🟢)·`disconnected`(⚪) 상태를 산출한다.
- **라이브 PTY 레지스트리 및 키스트로크 미러링 (`src/components/terminal/terminalRegistry.ts`)**: 마운트된 각 `TerminalView`가 `sendInput`/`focus`/`clear`/`reconnect` 컨트롤러를 등록하며, `SessionCommandBar.tsx`와 `VmTilePane.tsx` 인라인 프롬프트 배너가 `ALL` / `SYNCED` / `PROMPTS` 대상에 실시간 명령과 빠른 응답(`Y`, `N`, `Enter`, `1`, `2`, `Esc`, `Ctrl+C`)을 전달한다. 데모 PTY 핸들러(`handleDemoData`)도 개행 포함 다중 문자 입력과 `Esc`/`Ctrl+C`를 문자 단위로 처리한다. `isKeystrokeMirroring` 활성 시에는 동기화 그룹 내 입력을 나머지 타일로 미러링하되 `isSensitive` 프롬프트에서는 평문 누출을 막기 위해 일시 차단한다.
- **워크스페이스 프리셋 (`instabox_deck_presets_v1`)**: `useAppStore.ts`가 비밀정보 없이 타일 배치·그리드 구성만 저장하며 로드/적용 시 하위 타일 스키마·열거값 검증 및 중복 세션 제거를 수행한다. 볼트 잠금 시 실 프로필 타일·실시간 입력값·`isKeystrokeMirroring`을 초기화하고, 잠긴 상태에서 실 프로필 전용 프리셋을 선택하면 잠금 해제 모달을 연다.
- **검증 테스트**: `test/sessionActivity.test.ts`, `test/multiSessionControl.test.tsx`, `test/terminalLiveDemoIntegration.test.tsx`, `test/vaultUnlockCreateAndWipe.test.tsx`, `test/audit8Remediation.test.tsx`에서 상태 전이, 다중 세션 중복 방지, 실제 `TerminalView` 결합 데모 명령/빠른 응답, 키스트로크 미러링·암호 프롬프트 차단, 타일별 Desktop 뷰 ID 격리, 프리셋 검증·잠금 경계, 볼트 Create/Unlock 분기·10회 실패 파기, 경로/비동기 경합 방어를 검증한다.
