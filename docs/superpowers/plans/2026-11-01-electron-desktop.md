# InstaBox Deck Electron Desktop Implementation Plan

> **For agentic workers:** 구현자는 `superpowers:executing-plans`를 사용해 순서대로 진행한다. 사용자가 이미 Electron 전환을 명시 승인했으므로 같은 설계 승인을 다시 요구하지 않는다.

**Goal:** Windows x64에서 마스터 암호와 InstaBox API 키를 로컬 암호화 저장해 Worker 없이 VM/터미널/데스크톱을 사용하는 포터블 Electron 앱을 만든다.

**Architecture:** 기존 React 렌더러를 `app://instadesk` Origin에 묶고 Electron 메인에서 고정 InstaBox REST/SSE와 PTY WebSocket을 처리한다. 키는 전용 Origin의 암호화 볼트에 저장하며 요청 시에만 메인으로 전달한다. preload는 작업별 제한 API만 노출한다.

**Tech Stack:** Electron 45, Vite 8, React 18, TypeScript 5, Node fetch, `ws`, `esbuild`, Vitest 5. Electron 공식 수동 포터블 패키징.

**Spec:** `spec.md` v2 draft, `docs/electron/architecture.md`, `DESIGN_DECISIONS.md` Decision 07.

## Global Constraints

- 첫 검증/패키징 대상은 Windows x64; 포터블 ZIP, 서명 없음.
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`를 유지한다.
- 메인은 `api.instabox.sh` HTTPS 및 허용된 `api/connect.instabox.sh` WSS 외 목적지로 키를 보내지 않는다.
- 기존 감사 보고서와 사용자 파일은 보존한다. Pages 볼트는 자동 이전하지 않는다.
- Pages/Worker는 데스크톱 패키지와 네이티브 검증을 끝내고 삭제한다.

## Review Focus

- `../`나 인코딩된 경로를 통한 앱 자산 디렉터리 탈출 → 거부 테스트(작업 1).
- 비허용 API 경로·호스트·리다이렉트에 키가 전송됨 → 거부 테스트(작업 2).
- PTY 티켓의 악성 URL, 잠금 후 늦게 열린 소켓, 두 프로필 혼동 → 종료/거부 테스트(작업 3).
- 앱 재시작 후 볼트는 잠겨 있고 키 평문은 디스크에 없음 → 네이티브/저장 테스트(작업 4).
- 포터블 ZIP을 다른 경로에서 열었을 때 자산/브리지/데모가 동작함 → 패키지 스모크(작업 5).

---

### Task 1: Electron 창, 전용 Origin, 빌드

**Files:** `electron/main.ts`, `electron/preload.ts`, `electron/appProtocol.ts`, `electron/bridge.d.ts`, `vite.config.ts`, `package.json`, `scripts/build-electron.mjs`, `index.html`, `test/appProtocol.test.ts`.

**Interfaces:** `registerAppProtocol(distPath: string): void`는 `app://instadesk/`를 로컬 빌드 파일에만 매핑한다. preload는 `window.instadeskDesktop`에 작업별 API를 제공한다.

- [ ] 경로 탈출·미존재 자산·정상 JS/CSS에 대한 실패 테스트를 먼저 작성하고 실행한다.
- [ ] 보안 BrowserWindow 옵션과 제한된 자산 핸들러, `base: './'` 빌드를 구현한다.
- [ ] `npm run typecheck`, 관련 테스트, `npm run build:desktop`으로 빌드 자산 경로를 확인한다.

### Task 2: 메인 프로세스 REST/SSE

**Files:** `electron/apiGateway.ts`, `src/services/instaboxClient.ts`, `test/electronApiGateway.test.ts`, 기존 클라이언트 회귀 테스트.

**Interfaces:** `proxyApiRequest(request: Request, fetchUpstream: typeof fetch): Promise<Response>`는 `/instabox-api/v1/*`만 `https://api.instabox.sh/v1/*`로 전달한다. 렌더러 `getApiBaseUrl()`은 `/instabox-api`를 반환한다.

- [ ] 고정 업스트림, 인증 헤더, 리다이렉트 거부, SSE 본문/abort의 실패 테스트를 작성한다.
- [ ] Node 메인에서 API를 직접 호출하고 렌더러의 프록시/Origin 리라이트를 제거한다.
- [ ] 가짜 키의 API 401이 브라우저 CORS 오류 없이 앱에서 처리되는지 확인한다.

### Task 3: 메인 프로세스 PTY와 제한 IPC

**Files:** `electron/terminalGateway.ts`, `electron/preload.ts`, `electron/bridge.d.ts`, `src/components/terminal/TerminalView.tsx`, `src/services/instaboxClient.ts`, `test/terminalGateway.test.ts`, 기존 재연결 테스트.

**Interfaces:** preload는 `openTerminal`, `sendTerminal`, `resizeTerminal`, `closeTerminal`, `closeProfile`, `closeAll`, `onTerminalEvent`만 노출한다. 메인은 티켓 URL 호스트·프로토콜·행/열/세션을 검증한다.

- [ ] 허용·비허용 티켓, 출력/리사이즈, 늦은 연결, 잠금/프로필 삭제 테스트를 작성한다.
- [ ] 메인에서 `ws`로 연결하고 ID로 필터링된 이벤트만 렌더러에 전달한다.
- [ ] 데모 PTY와 실제 티켓 모의 경로, 종료·재연결을 검증한다.

### Task 4: 볼트와 UI 전환

**Files:** `src/services/cryptoVault.ts`, `src/store/useAppStore.ts`, `src/components/modals/ApiKeyModal.tsx`, `src/App.tsx`, `src/components/desktop/DesktopScreenView.tsx`, `test/cryptoVault.test.ts`, `test/App.test.tsx`.

**Interfaces:** 기존 볼트의 AES-GCM/PBKDF2·프로필 CRUD는 유지하되 전용 앱 Origin에서만 사용한다. Worker URL 입력·확인 UI와 브라우저 전용 API 경로를 제거한다.

- [ ] 키 평문 비저장, 잠금/프로필 삭제, 재시작 후 재해제 테스트를 보존·확장한다.
- [ ] KEY VAULT를 마스터 암호·키 중심으로 정리하고 앱/외부 콘텐츠 경계를 반영한다.
- [ ] 로컬 앱에서 데모/키 입력·오류 표시와 볼트 저장을 확인한다.

### Task 5: Windows x64 포터블 패키지

**Files:** `scripts/package-win.mjs`, `package.json`, `.gitignore`, `BUILD_GUIDE.md`, `README.md`, `CHANGELOG.md`, `IMPLEMENTATION_SUMMARY.md`.

- [ ] Electron main/preload/renderer만 포함한 스테이징 구성을 작성한다.
- [ ] Electron 사전 빌드 Windows x64 바이너리와 필요한 앱 파일만 복사해 포터블 폴더·ZIP을 만들고 파일 목록/크기를 확인한다. `@electron/packager`의 알려진 개발 의존성 권고를 피한다.
- [ ] 네이티브 EXE 실행, devtools 오류, 데모, 볼트 재시작, 가짜 키 401을 확인한다. 코드 서명과 실제 키는 별도 게이트로 기록한다.

### Task 6: 웹 게시 종료와 검증 인계

**Files:** `.github/workflows/pages.yml`, `worker/`, `extension/`, `docs/electron/verification.md`, 사용자 문서 및 원본 감사 보고서(읽기 전용).

- [ ] 앱 대체물이 검증되면 Pages 워크플로와 Worker 소스를 메인 브랜치에서 제거하고 이유/재사용 방법을 기록한다.
- [ ] 허가된 `gh api`로 정확한 `Yupkidangju/instadesk` Pages 사이트, `wrangler`로 정확한 `instadesk-personal-bridge` 게시만 삭제한다. GitHub 저장소와 감사 기록은 보존한다.
- [ ] 원격 게시 종료와 로컬/CI/패키지 결과를 기록한다. 실 API/PTY/Desktop 미검증을 전체 PASS로 올리지 않는다.
