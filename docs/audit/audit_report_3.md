# InstaBox Deck 독립 재감사 3

작성일: 2026-11-01 (Asia/Seoul)  
대상: `D:\web\instadesk`, `main` = `origin/main` = `089c3134a1d811e374d5d12ae9888bd987d3e44f`  
기준: `AI_AUDIT_DOC_STANDARD.md`, 원본 `audit_report_1.md`의 finding ID  
최종 판정: **HOLD**

## 1. 요약, 범위, 제외

이번 검사는 수정자가 작성한 `audit_report_2.md`의 주장에 의존하지 않고 현재 파일, 새로 실행한 명령, 공개 저장소 상태, 브라우저 화면을 대조한 독립 재감사다. 감사 중 제품 소스·테스트·설정·계약 문서는 수정하지 않았다. 원본 보고서와 수정 기록을 보존하고 이 보고서와 시각 증거만 추가했다. Kanban 할당/역할 실행은 요청되지 않았으므로 독립 감사로 수행했다.

확인한 문서: `spec.md`, `designs.md`, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`, `README.md`, `CHANGELOG.md`, `audit_roadmap.md`, `docs/audit/{audit_report_1.md,audit_report_2.md,remediation_plan_1.md}` 및 감사 표준. 확인한 코드/설정: `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/pages.yml`, `vite.config.ts`, `index.html`, `src/services/{cryptoVault.ts,instaboxClient.ts}`, `src/store/useAppStore.ts`, `src/App.tsx`, 관련 `src/components/`와 `test/`의 회귀 경로, `extension/` 및 새 `dist/index.html`. 나머지 1차 코드/테스트는 파일 목록과 교차 검색으로 범위를 파악했다. `node_modules/`, 백업 의존성, 생성된 `dist/assets` 코드, `.git` 내부, 타사 서비스 내부 구현은 범위 밖이다.

실행 증거:

| 검사 | 결과 |
| --- | --- |
| Git | `main...origin/main` 동기화, 처음에는 작업 트리 깨끗함; 공개 저장소 `Yupkidangju/instadesk`, `has_pages=false` |
| 의존성 | Node v24.22.1/npm 11.19.1에서 `npm ci --no-fund` 성공, 199개 설치, 취약점 0 |
| 코드 품질 | `npm run typecheck` 성공, `npm test` 7파일/24테스트 성공, `npm run build` 성공, `npm audit --json` 0건 |
| 빌드 | `dist/index.html`은 `/instadesk/assets/...` 두 파일을 참조; 로컬 preview의 HTML·JS·CSS 모두 HTTP 200; 532.84 kB JS 청크 경고 |
| 브라우저 | Chromium에서 `/instadesk/` 첫 화면, 데모 4대, 데모 터미널 및 Exec 종료 코드 0 확인; 콘솔에는 `favicon.ico` 404만 관찰 |
| 원격 CI | [실행 41216493568](https://github.com/Yupkidangju/instadesk/actions/runs/41216493568): build 성공, deploy 건너뜀 (`workflow_dispatch` 전용) |
| Pages | `gh api repos/Yupkidangju/instadesk/pages` 404; `https://yupkidangju.github.io/instadesk/` HTTP 404 “Site not found” |
| CORS 표본 | `OPTIONS /v1/machines`에 `Origin: https://yupkidangju.github.io` → 404, ACAO 없음; `https://dashboard.instabox.sh` → 204, ACAO 있음 |

브라우저 시각 증거: [768px 화면](evidence_3/tablet_768.png), [390px 화면](evidence_3/mobile_390.png). 기존 `.playwright-cli/`는 Git에서 무시되는 임시 브라우저 산출물이다.

**검사 제외:** 실제 InstaBox API 키, 실제 VM 생성·변경·삭제, 운영 프록시, 발급된 PTY 티켓·실 WebSocket, 실제 SSE, Desktop iframe/외부 탭, 서비스 계정의 실제 8세션 제한, Pages 배포 후 URL, Safari/Firefox, 보조 기술 접근성. 자격 증명과 게시된 Pages 사이트가 없으므로 이 항목은 PASS로 간주하지 않는다. 실제 운영 서비스를 변경하는 호출은 하지 않았다.

## 2. Pass 1 — 문서·구현 적합성

| 원본 ID | 재감사 상태 | 독립 근거 |
| --- | --- | --- |
| IMP-F001 | **Hold** | 정적 데모와 실 API의 조건부 계약은 `spec.md:11-27`, `README.md:9`에서 명확해졌으나 Pages Origin CORS 표본은 불허이고 실제 연결 경로/운영 프록시는 없다. 실제 API 제품 기능은 미검증. |
| IMP-F002 | **Verified, 앱 소유 PTY 범위** | `useAppStore.ts:119-134`, `TerminalView.tsx:131-153`, `HeaderBar.tsx:38-43`이 타일 대신 프로필별 연결 예약/상태를 사용하고 8→9 회귀 테스트가 통과. Desktop·외부·실 서버 세션 포함 여부는 계약에서 제외됨. |
| IMP-F003 | **Verified, 단위 경로** | `instaboxClient.ts:190-219`가 cursor를 인코딩해 최대 100페이지 순회하고 반복 cursor를 거부; 두 페이지 테스트 통과. 실 API 응답 형식은 미확인. |
| IMP-F004 | **Needs Fix** | 과장된 배포 주장은 고쳤지만 `spec.md:53-75`의 저장 스키마(`encryptedKey`, `verifier`)와 실제 `src/types/vault.ts:6-26`(`encryptedData`, `verifierCiphertext`, `verifierIv`)가 다르다. `designs.md:62`는 여전히 “E2EE ACTIVE”라고 기술하지만 `spec.md:11`은 로컬 저장 암호화라고 바로잡았다. |

### IMP-F005 — 좁은 화면에서 핵심 작업 패널이 잘림

- **심각도/상태:** Major / Needs Fix. 데스크톱 전용 최소 폭을 의도했다면 지원 폭을 먼저 명세해야 한다.
- **증거:** [768px](evidence_3/tablet_768.png)에서는 320px 사이드바와 `md:grid-cols-2`로 남은 작업 영역의 절반만 단일 타일에 할당되어 Exec 입력/탭이 잘린다. [390px](evidence_3/mobile_390.png)에서는 사이드바가 대부분을 차지해 작업 패널에 거의 접근할 수 없다. `src/App.tsx:33-40`은 전체 화면 `overflow-hidden`, `SidebarVmList.tsx:104`는 `w-80 flex-shrink-0`, `WorkspaceGrid.tsx:15-18`은 768px부터 2열, `HeaderBar.tsx:45-190`은 한 줄 고정이다. 기본 `2x1`의 단일 타일은 1280px에서도 절반 폭만 쓴다.
- **기대/실제:** 최소한 지원된 화면 폭에서 터미널·Exec·탭·전역 버튼을 조작할 수 있어야 한다. 실제로 헤더와 콘텐츠가 뷰포트 밖에서 잘리며 가로 스크롤도 없다.
- **수정/재감사:** 지원 최소 폭을 정하고 사이드바 접기/전환, 헤더 액션 축약, 단일 타일 전폭, 좁은 폭의 그리드 전환을 설계·구현한다. 390/768/1280px에서 모든 주요 조작을 브라우저로 재확인한다.

### IMP-F006 — 프록시를 통한 PTY 티켓 경로가 설계 문서와 반대

- **심각도/상태:** Major / Needs Spec Clarification.
- **증거:** `DESIGN_DECISIONS.md` Decision 03은 티켓 URL이 다른 호스트면 임의로 프록시로 바꾸지 않는다고 한다. 그러나 `src/services/instaboxClient.ts:397-423`은 발급 URL이 `connect.instabox.sh`여도 `trustedProxyOrigin`의 `wss:` 호스트로 재작성한다. `test/auditRemediation.test.ts:78-91`은 그 재작성을 기대한다.
- **기대/실제:** 문서, 코드, 테스트의 연결 경로가 일치해야 한다. 현재는 실제 프록시가 `/v1/terminal`을 어디로 중계해야 하는지도 불명확하다.
- **수정/재감사:** 티켓 호스트별 라우팅 계약을 확정하고 문서·코드·테스트를 동기화한 뒤, 허가된 실 티켓과 운영 프록시에서 PTY 핸드셰이크를 검증한다.

## 3. Pass 2 — 재현성·엔지니어링

| 원본 ID | 재감사 상태 | 독립 근거 |
| --- | --- | --- |
| DBG-F001 | **Verified, 로컬 빌드** | `vite.config.ts:5`의 `base: '/instadesk/'`; 새 `dist/index.html` 및 preview HTTP 200 확인. 실제 Pages 서비스는 별도 Hold. |
| DBG-F002 | **부분 해결** | Git/공개 원격/무시 규칙/Actions build는 존재하고 CI 성공. 배포 job은 건너뛰었고 Pages 사이트는 없다. 아래 DBG-F007. |
| DBG-F003 | **Verified** | 새 `npm ci`와 전체 `npm audit --json` 0건; 잠금 파일 기준 빌드 성공. |
| DBG-F004 | **Verified, 모의 SSE** | `instaboxClient.ts:521-595`가 CRLF·분할·EOF·오류를 처리하고 회귀 테스트가 통과. 실 서비스 형식/장시간 스트림은 미검증. |
| DBG-F005 | **Verified** | `CreateVmModal.tsx:26-39,89-105`가 열릴 때 실제 프로필을 선택하고 데모 선택을 활성화 상태로 제한; 컴포넌트 테스트 통과. |
| DBG-F006 | **Verified** | `TerminalView.tsx:228-235`의 재시도 세대 변경과 새 소켓 테스트 통과. |

### DBG-F007 — GitHub Pages는 아직 게시되지 않음

- **심각도/상태:** Major / Hold (배포 게이트; 코드 결함 판정과 분리).
- **증거:** 공개 저장소는 존재하지만 GitHub 저장소 API `has_pages=false`, Pages API 404, 예상 사이트 URL 404. `.github/workflows/pages.yml:24-40`은 수동 실행에서만 deploy하며, 확인한 두 push 실행은 build 성공·deploy skipped였다.
- **기대/실제:** 사용자 목표인 무료 GitHub 서빙의 공개 URL에서 앱이 열려야 한다. 현재는 로컬/CI 빌드만 확인되고 외부 URL은 열리지 않는다.
- **수정/재감사:** Pages 설정에서 소스를 GitHub Actions로 구성하고 승인된 수동 배포를 실행한 후 실제 URL, HTML/JS/CSS, 데모 흐름을 확인한다. 이번 감사 요청 자체는 배포 승인으로 해석하지 않았다.

### DBG-F008 — 개발 서버가 표시하는 127.0.0.1에서는 API 프록시 선택이 빗나감

- **심각도/상태:** Major / Needs Fix.
- **증거:** `vite.config.ts:8-9`는 서버를 `127.0.0.1:5173`에 바인딩한다. `src/services/instaboxClient.ts:34-40`은 `window.location.hostname === 'localhost'`일 때만 `/instabox-api`를 선택한다. `BUILD_GUIDE.md:28-29`는 localhost 기반 프록시 사용을 안내한다.
- **기대/실제:** 개발 서버가 출력하는 주소를 열면 로컬 프록시가 사용되어야 한다. `127.0.0.1:5173`에서는 직접 `https://api.instabox.sh`로 향해 CORS에 걸리는 경로다.
- **수정/재감사:** loopback 호스트 판정을 통일하거나 서버 바인딩/안내를 한 주소로 맞춘다. 127.0.0.1과 localhost 양쪽에서 요청 목적지를 브라우저 네트워크로 검증한다.

### DBG-F009 — 한 프로필의 동기화 실패가 전체 목록·데모 갱신을 막음

- **심각도/상태:** Major / Needs Fix.
- **증거:** `src/store/useAppStore.ts:202-239`는 모든 실 프로필을 `Promise.all`로 조회하고, 하나라도 실패하면 데모 목록을 더하기 전에 catch로 빠진다. catch는 `syncError`만 설정하고 이전 `machines`를 보존한다.
- **기대/실제:** 여러 프로필 중 정상 프로필과 활성 데모는 계속 표시되고, 실패한 프로필은 구분돼야 한다. 실제로 하나의 CORS/네트워크/키 오류가 전체 새로고침을 무효화하고 과거 목록을 남긴다.
- **수정/재감사:** 프로필별 결과를 분리하고 실패를 표시하며 최신 성공 상태만 합친다. 한 프로필 실패+한 프로필 성공+데모 활성 케이스와 순서가 뒤바뀐 중복 새로고침을 테스트한다.

### DBG-F010 — 저장된 API 키 프로필을 확인 없이 영구 삭제

- **심각도/상태:** Major / Needs Fix.
- **증거:** `ApiKeyModal.tsx:321-338`의 삭제 아이콘은 곧바로 `removeProfile(p.id)`를 호출하고, `cryptoVault.ts:236-243`은 암호화 레코드를 즉시 localStorage에서 제거한다. 앱 안에 복구/취소 경로가 없다.
- **기대/실제:** 복구 불가능한 로컬 키 삭제 전에 대상과 영향을 명확히 확인해야 한다. 현재 한 번의 클릭으로 영구 삭제된다.
- **수정/재감사:** 프로필 명칭을 포함한 확인 단계와 복구 정책을 정하고, 취소/삭제/잘못된 프로필 선택을 테스트한다.

## 4. Pass 3 — 보안 경계

| 원본 ID | 재감사 상태 | 독립 근거 |
| --- | --- | --- |
| SEC-F001 | **부분 해결, Needs Fix** | 수동·자동 잠금에서 등록 PTY 소켓 종료/요청 abort/실 타일 언마운트는 코드·회귀 테스트로 확인. 그러나 전역 Broadcast 모달의 명령/출력 상태는 잠금 시 지워지지 않는다(아래). 서버 취소·외부 탭은 미검증/비보장. |
| SEC-F002 | **Verified, 로컬 입력 경계** | `setTrustedProxyOrigin`이 HTTPS origin만 허용하고 UI가 키 공개 동의를 요구하며 URL 변경 시 동의를 해제한다. 실제 프록시 소유권·전송·PTY 호환성은 미검증. |
| SEC-F003 | **Verified** | 확장 manifest는 권한을 요청하지 않고 `rules.json`은 `[]`; 사용 가능한 연결 수단으로 문서도 주장하지 않는다. |

### SEC-F001 재감사 #1 — 잠금 후 Broadcast 출력이 남음

- **심각도/상태:** Major / Needs Fix. 원본 finding ID 유지.
- **증거:** `spec.md:18-22`는 잠금 시 출력물을 화면에서 제거한다고 한다. `useAppStore.ts:87-100`의 잠금 리스너는 실 타일·머신·세션 상태만 지우고 `isBroadcastModalOpen`을 유지한다. `BroadcastExecModal.tsx:30-37,54-114`는 `cmd`/`nodeStates.output`을 모달 컴포넌트의 React 상태에 보관하며 잠금 상태를 구독하지 않는다. 자동 잠금이 모달이 열린 동안 발생하거나, 잠금 뒤 모달을 다시 열면 이전 출력이 남는다.
- **기대/실제:** 잠금 시 앱이 보유한 명령/출력도 가려져야 한다. 현재 타일 출력만 제거된다.
- **수정/재감사:** 잠금 세대에 맞춰 Broadcast 실행 중단과 상태 초기화/모달 닫기를 구현하고, 자동 잠금 중·완료 후 재열기 테스트를 추가한다.

### SEC-F004 — 프로필 삭제가 해당 프로필의 열린 제어 채널을 닫지 않음

- **심각도/상태:** Major / Needs Fix.
- **증거:** `useAppStore.ts:183-187`의 `removeProfile`은 암호화 레코드 제거, 목록 갱신만 수행한다. 잠금 때 쓰는 `instaboxClient.cancelActiveRequests()`와 타일/세션 제거가 없다. `cryptoVault.ts:236-243`의 `removeProfile` 알림은 볼트가 여전히 잠금 해제된 상태이므로 `useAppStore.ts:89-100`의 종료 분기를 실행하지 않는다. 등록된 PTY 소켓과 Desktop iframe은 타일 제거 시에만 정리된다.
- **기대/실제:** 권한 프로필 제거 시 해당 프로필의 열린 PTY/데스크톱·진행 중 명령도 앱에서 종료해야 한다. 현재 삭제된 키로 발급받은 세션이 로컬에서 계속 남을 수 있다.
- **수정/재감사:** 삭제 대상 프로필의 타일·소켓·요청을 개별 종료하고 출력/서명 URL을 제거한다. 다른 프로필은 유지하는 회귀 테스트를 추가한다. 서버 측 티켓 무효화 가능 여부는 실제 서비스 계약으로 확인한다.

## 5. 교차 판단, 남은 위험, 재감사 조건

- `XPF-F001`: GitHub Pages 자산 경로와 CI 빌드는 해결됐으나 Pages 배포가 없고 실제 API CORS 표본은 불허다. 정적 **데모** 제품과 실제 VM 콘솔을 별도 출고 게이트로 취급해야 한다.
- `XPF-F002`: 볼트 잠금은 새 복호화와 앱 소유 PTY를 종료하지만 모든 앱 상태 및 프로필 제거 경로까지 정리하지 않는다. SEC-F001/SEC-F004가 남는다.
- `XPF-F003`: 문서·테스트가 프록시 PTY 재작성 경로에서 서로 다르다. 실제 운영 프록시와 서비스 티켓으로 계약을 확정하기 전에는 동작 확인이 아니다.

**Accepted Risk:** 이번 감사에서 새로 수용한 위험 없음. `audit_report_2.md`의 HOLD를 PASS로 승격하지 않는다.  
**Needs Spec Clarification:** 지원할 최소 화면 폭과 모바일/태블릿 목표; 프록시의 API/Connect WebSocket 호스트별 라우팅; 계정/키별 8세션 실제 정책; 서버 측 티켓·외부 탭 취소 가능 여부.  
**남은 위험:** 실제 InstaBox 키와 운영 프록시가 없어 실제 REST/SSE/PTY/Desktop/429 검증 불가. LocalStorage는 GitHub Pages의 경로가 아닌 origin 단위로 공유되므로 다른 동일 origin 사이트의 스크립트 접근 범위도 보안 설계에서 명시해야 한다. 로컬 빌드와 모의 테스트는 이를 검증하지 않는다. 모바일 시각·키보드/스크린리더 검사는 이번 스크린샷/수동 탐색 범위 밖이다.

재감사 조건: (1) 정식 Pages 설정·수동 배포 후 실제 URL에서 HTML/자산/데모 확인, (2) 위 신규 finding과 SEC-F001 잔여 사항 수정 후 회귀 테스트, (3) 지원 폭 시각 재검증, (4) 허가된 별도 테스트 키와 신뢰 프록시로 실 API GET/변경, SSE, PTY, Desktop, 잠금/삭제 및 8→9 제한 확인, (5) 현재 문서 계약과 소스 재대조. 수정 시 원본 `audit_report_1.md`와 이 보고서를 보존하고 finding ID를 추적한다.

## 6. 최종 판정 및 코더 인계

**HOLD.** 현재 코드는 깨끗하게 설치·검사·빌드되고 로컬 데모의 주요 흐름도 작동한다. 그러나 GitHub Pages는 아직 404이고 실제 VM 연결은 CORS/프록시 조건과 자격 증명 부족으로 입증되지 않았다. 또한 반응형 작업 화면, 잠금 뒤 Broadcast 출력, 프로필 삭제 후 세션 정리 등 실제 사용을 막거나 보안 경계를 흐리는 문제를 확인했다.

```text
D:\web\instadesk\docs\audit\audit_report_3.md의 독립 재감사 결과를 읽으세요.
각 finding을 현재 spec/design/결정 문서와 코드·테스트에 대조한 뒤 필요한 수정을 수행하세요.
계약이 달라지면 문서를 먼저 갱신하고, 회귀 테스트와 로컬 검증을 기록하세요.
원본 audit_report_1.md와 이번 보고서를 보존하고 finding ID에 재감사 증거를 연결하세요.
```
