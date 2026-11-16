# InstaDesk 2.1.2 독립 감사 5 — 보안 제안과 다중·개별 스크롤

작성일: 2026-11-17 (Asia/Seoul)  
대상: `D:\web\instadesk`, `main`/`origin/main` `133cffa`, 공개 태그 `v2.1.2` `48853a3`  
기준: `AI_AUDIT_DOC_STANDARD.md`, 현행 `spec.md`·`docs/electron/desktop_scroll_2_1_2.md`, 사용자가 전달한 Gemini Carbon 감사 의견, 현재 소스·테스트·브라우저 관찰  
**최종 판정: HOLD** (확인된 Major 스크롤/설치 안내 문제; 다른 출시 범위의 기존 성공을 취소하는 뜻은 아님)

## 1. 감사 범위와 실행 증거

Gemini 의견은 소스 본문에 접근하지 못한 상태에서 작성됐다고 명시돼 있다. 이번 감사는 현재 `README.md`, `LINUX_SETUP.md`, `BUILD_GUIDE.md`, `package.json`, `scripts/{package-linux.mjs,package-win.mjs}`, `electron/{main.ts,preload.ts,apiGateway.ts,terminalGateway.ts,desktopViewGateway.ts,desktopViewPolicy.ts}`, `src/{App.tsx,index.css,services/cryptoVault.ts,components/WorkspaceGrid.tsx,components/VmTilePane.tsx,components/terminal/TerminalView.tsx,components/desktop/DesktopScreenView.tsx,components/desktop/nativeDesktopPlacement.ts}`와 관련 테스트를 직접 읽었다. `spec.md`, `designs.md`, `DESIGN_DECISIONS.md`, `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`, 이전 감사 및 2.1.2 스크롤 계약/릴리스 기록도 대조했다.

| 독립 검사 | 결과 |
| --- | --- |
| Git | 시작 시 `main...origin/main` 깨끗함. `git diff --name-only v2.1.2 HEAD -- src electron scripts package.json package-lock.json README.md LINUX_SETUP.md`는 공백: 보고서 findings가 공개 v2.1.2 소스에도 적용됨 |
| 설치·품질 | `npm ls --depth=0` 정상, `npm run typecheck` 성공, `npm test` **22파일 90테스트 통과**, `npm run build` 성공, 전체 `npm audit --json` 0건. JS 청크 547.65 kB 경고는 남음 |
| 공개 릴리스 | [태그 CI 41442274079](https://github.com/Yupkidangju/instadesk/actions/runs/41442274079) Windows x64·Linux x64·Linux arm64 패키지/로드와 release 작업 성공; [v2.1.2](https://github.com/Yupkidangju/instadesk/releases/tag/v2.1.2) 공개, 세 아카이브와 `SHA256SUMS.txt` 업로드 |
| 브라우저 재현 | 격리된 Chromium 로컬 preview(1280×720)에서 데모 VM 3대 추가 후 5개 타일·2열, xterm 두 개의 출력 기록 생성. `main[data-workspace-scroll]`과 `.xterm-viewport` 스크롤 수치 및 휠 반응 측정 |

`node_modules/`, `dist/`, `release/`, `.git/`의 내부 구현은 생성/벤더 범위라 제외했다. 실제 2.1.2 Linux 아카이브의 파일 모드는 독립 추출하지 않았다. 실 키의 원격 Desktop과 실제 `WebContentsView` 휠·Alt+휠, 물리 Linux/ARM, 변경 API·SSE·Desktop 입력은 이번 세션에서 실행하지 않았다. 2.1.2 문서에 있는 사용자의 5대/2열 스크롤 수용 결과는 기존 증거로 인용하되 이번 독립 재현으로 바꾸지 않는다. 제품 코드·테스트·구성은 수정하지 않았다.

## 2. Pass 1 — 문서와 구현

### IMP-F010 — 2.1.2에 동봉되는 Linux 설치 문서가 2.1.0 파일명을 사용

- **심각도/상태:** Major / Needs Fix.
- **증거:** `LINUX_SETUP.md:6-7`의 `name=InstaDesk-2.1.0-linux-...`는 현재 `package.json:3`의 `2.1.2`, `README.md:18,68`, `BUILD_GUIDE.md:36` 및 실제 공개 자산명과 다르다. `scripts/package-linux.mjs:48`은 이 파일을 새 아카이브에 그대로 복사한다. CI는 파일 존재만 검사하고 안내된 명령 실행은 검사하지 않는다.
- **기대/실제/영향:** 2.1.2 아카이브에 포함된 가이드를 그대로 따르면 현재 아카이브 이름과 체크섬 항목을 찾고 설치해야 한다. 실제 명령은 2.1.0을 찾아 검증/압축 해제 단계가 실패한다.
- **수정/재감사:** 패키지 버전에서 이름을 유도하거나 생성되는 가이드로 만들고, 추출한 2.1.2 아카이브의 안내 명령을 실제 파일명·`SHA256SUMS.txt`로 실행해 확인한다.

### IMP-F011 — 개별 터미널 스크롤·기록 보존 계약이 빠짐

- **심각도/상태:** Major / Needs Spec Clarification.
- **증거:** `spec.md:120-123`, `README.md:49,99`, `docs/electron/desktop_scroll_2_1_2.md:19-21`은 작업 영역과 원격 Desktop 휠 정책을 설명한다. 터미널 출력 스크롤을 작업 영역 휠과 어떻게 분리하는지, 1×1 포커스/TERM↔EXEC 탭 전환 뒤 로컬 터미널 기록을 유지할지에 대한 계약은 없다. 실제 동작은 DBG-F014/015와 같다.
- **기대/실제/영향:** 사용자가 여러 VM의 명령 출력을 읽고 다시 돌아올 때 스크롤 우선순위와 기록 보존 범위를 예측할 수 있어야 한다. 현재 사용자가 요청한 복수/개별 스크롤 범위가 문서에서 정해지지 않았다.
- **수정/재감사:** 타일별 스크롤 소유, 경계 도달 시 작업 영역으로 넘기는 규칙, 숨긴 세션의 연결·출력·스크롤 보존 정책을 정해 spec/design/가이드와 테스트에 반영한다.

## 3. Pass 2 — 스크롤·동작 품질

### DBG-F014 — 터미널 스크롤 끝에서 한 휠 입력이 두 영역을 모두 움직임

- **심각도/상태:** Major / Needs Fix.
- **증거:** 5개 타일의 2열 로컬 Chromium 재현에서 작업 영역 `clientHeight=613`, `scrollHeight=1838`; 첫 xterm `clientHeight=520`, `scrollHeight=1726`이었다. 두 터미널은 여유가 있을 때 독립적이었다: 둘째 터미널 휠 `-200`에서 둘째 `846→646`, 첫째 `1206` 유지, 작업 영역 `0` 유지. 그러나 첫째 터미널을 스크롤 끝에 가까이 둔 뒤 작업 영역 `200`, 터미널 `1106/1206` 상태에서 **휠 `+200` 한 번**을 주자 터미널은 `1206`에 도달하고 작업 영역도 `200→400`으로 이동했다. `WorkspaceGrid.tsx:98-109`는 세로 스크롤을, `TerminalView.tsx:72-76,320-321`은 중첩 xterm 뷰포트를 만든다. 해당 경계 동작 테스트는 없다.
- **기대/실제/영향:** 한 입력이 터미널 기록과 VM 타일 위치를 동시에 크게 바꾸지 않도록 사용자 의도가 정해져야 한다. 현재는 로그 끝을 읽으려다가 작업 대상 타일도 이동한다.
- **수정/재감사:** 터미널 휠의 소유/경계 전달 규칙을 명시하고 중복 전체 델타 전달을 막는다. 실제 휠과 트랙패드에서 위 수치를 회귀 테스트하며, 390/768/1280px과 1×1/2열을 확인한다.

### DBG-F015 — 1×1 포커스 및 탭 전환 시 터미널 기록·스크롤이 사라짐

- **심각도/상태:** Major / Needs Fix 또는 명시적 정책 결정.
- **증거:** `WorkspaceGrid.tsx:94-111`은 1×1에서 선택 타일만 렌더한다. `VmTilePane.tsx:78-129`도 활성 탭 컴포넌트만 렌더한다. `TerminalView.tsx`의 xterm은 컴포넌트 마운트 때 생성, 언마운트 때 dispose된다. 실제 브라우저 데모에서 첫 터미널 기록 높이 `1726px`과 스크롤 위치가 있었지만, 1×1에서 다른 타일로 이동했다 돌아오자 `scrollHeight=clientHeight=484`, `scrollTop=0`이었다. 같은 타일에서 30개 명령 후 `scrollHeight=1186`, `scrollTop=702`였으나 TERM→EXEC→TERM 뒤 `484/0`으로 초기화됐다.
- **기대/실제/영향:** 세션 창을 임시로 보거나 포커스를 옮긴 사용자는 그 VM의 읽던 위치와 출력 기록이 남는다고 기대할 수 있다. 현재 로컬 xterm 기록이 즉시 사라지며 실제 PTY도 닫혔다 다시 열린다. 서버의 최근 출력 재전송은 전체 로컬 기록 보존을 보장하지 않는다. EXEC 등 다른 패널도 탭 전환 시 로컬 상태/진행 요청이 정리되는지 범위를 명확히 해야 한다.
- **수정/재감사:** 세션별 출력·스크롤 위치를 유지할지 정책을 정한다. 유지한다면 연결 수 제한과 메모리 상한을 고려해 안전한 보존/복원 방식을 설계하고, 포커스 왕복·탭 왕복·잠금/프로필 삭제의 초기화 경계를 테스트한다. 보존하지 않는 정책이면 UI에 명확히 알린다.

### DBG-F016 — 네이티브 Desktop 스크롤은 설계대로 구현됐으나 전 범위 실측은 남음

- **심각도/상태:** Minor / Verified (모의·소스 범위), 실제 사용 잔여 위험.
- **증거:** `nativeDesktopPlacement.ts:17-31`은 스크롤 영역 밖/부분 가시 상태에서 뷰를 숨긴다. `DesktopScreenView.tsx:108-152`는 작업 영역 스크롤·창 크기·타일 수 변화에 맞춰 네이티브 좌표/가시성을 갱신한다. `desktopViewGateway.ts:38-52,74-82`는 스크롤 가능한 작업 영역 위 일반 휠을 렌더러로 보내고 Alt+휠을 원격 뷰에 남긴다. `desktopPlacement.test.ts`, `desktopNativeView.test.tsx`, `desktopZoom.test.ts`가 모의 경로를 검사했고 90개 전체 테스트가 통과했다. `desktop_scroll_2_1_2.md:34`에는 사용자 5대/2열 수용 결과가 있다.
- **기대/실제/영향:** 헤더/다른 타일을 가리던 과거 문제는 소스·모의 테스트·기존 사용자 수용으로 완화됐다. 부분 가시일 때 화면 전체를 숨기는 제한은 문서화됐고, 실제 여러 원격 뷰의 동시 스크롤·Alt+휠은 이번 감사에서 독립 실측하지 못했다. `DesktopScreenView.tsx:237-239`의 짧은 휠 안내는 `xl` 미만에서 숨겨져 작은 화면에서는 단축 동작을 발견하기 어렵다.
- **수정/재감사:** 390/768/1280px의 실제 네이티브 Desktop 2개 이상에서 일반 휠·Alt+휠, 화면 밖/재진입, 모달·잠금·타일 제거를 관찰한다. 작은 화면 안내는 접근 가능한 위치로 제공한다.

## 4. Pass 3 — Gemini 보안 지적의 현재 판정

| 항목 | 판정과 근거 | 조치 성격 |
| --- | --- | --- |
| **Linux 메인 바이너리 4755** | **Rejected as False Positive (현행 소스/안내).** `README.md:22,72`, `BUILD_GUIDE.md:40`, `LINUX_SETUP.md:11`, `.github/workflows/desktop.yml`은 `chrome-sandbox`에만 4755를 지정한다. `scripts/package-linux.mjs:41`은 메인 바이너리에 실행 비트만 추가한다. 릴리스 Linux tar 내부 모드를 이번 세션에서 직접 추출해 확인하지는 않았다. | 실제 아카이브 검증 때 메인 파일의 SUID 비트가 없는지 CI에서 명시 검사하면 더 견고하다. |
| **서명·자동 업데이트·체크섬** | **Confirmed Known Limitation + Needs Fix (설치 안내).** README는 미서명/수동 업데이트를 밝히고 `SHA256SUMS.txt` 존재를 안내하지만 Windows `Get-FileHash`와 Linux README 설치 직전 검증 명령이 없다. 동봉 `LINUX_SETUP.md`에는 검증 명령이 있으나 버전 2.1.0을 참조한다(IMP-F010). | 설치 가이드 보완이 우선. 해시 파일도 같은 릴리스에서 받으면 손상 탐지에는 도움이 되지만 게시자 신원 증명은 코드 서명과 별개다. 서명·업데이트 도입은 배포 정책 결정이 필요하다. |
| **볼트의 Web Crypto** | **Verified, 현행 v2 범위.** `cryptoVault.ts:6-8,115-140,395-417`은 새 볼트에 15자 이상, PBKDF2-HMAC-SHA256 600,000회, 무작위 16바이트 salt/12바이트 IV, `extractable: false`를 사용한다. v1 잠금 해제 후 v2 재암호화/암호문구 변경 경로와 테스트가 있다. | Electron `safeStorage`는 현재 필수 결함 수정이 아니라 대안 설계다. [공식 문서](https://www.electronjs.org/docs/latest/api/safe-storage)에 따르면 동기 API는 Electron 46에서 제거 예정이고 Linux 비밀 저장소가 없으면 `basic_text` 폴백 문제가 있으므로 플랫폼별 계약이 필요하다. 실행 중 렌더러 악성 코드에 대한 완전 방어를 주장하지 않는다. |
| **원격 Desktop 격리** | **Verified, 소스 범위.** `desktopViewGateway.ts:23-66`은 Node 차단, contextIsolation, sandbox, webSecurity, 허용 dashboard HTTPS 탐색/리다이렉트, 새 창 차단을 적용한다. `electron/main.ts:154`는 현재 뷰가 사용하는 default session의 권한 요청을 거부한다. 별도 partition은 없지만 [Electron 기본 세션 계약](https://www.electronjs.org/docs/latest/api/structures/web-preferences)상 요청 거부가 적용된다. | 별도 partition은 쿠키/캐시 분리 강화 선택지다. 변경 API·실 SSE·Desktop 입력 및 다중 네이티브 뷰 휠은 아직 실 E2E 미검증. |
| **ASAR·Fuses** | **Confirmed packaging choice, not a proven remote exploit.** `scripts/package-win.mjs`와 `package-linux.mjs`는 `resources/app/` 일반 디렉터리를 복사하며 ASAR/Fuses 단계가 없다. Windows 포터블 폴더는 사용자 쓰기 권한일 수 있다. | ASAR 자체는 암호화/서명이 아니다. [Electron ASAR 무결성](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)은 현재 Windows/macOS에서 지원하며 `EnableEmbeddedAsarIntegrityValidation`과 `OnlyLoadAppFromAsar`를 함께 고려해야 한다. Linux에 같은 무결성 기능이 적용된다고 주장하지 않는다. `RunAsNode`/검사 플래그 비활성화도 패키지·디버깅·서명 계획과 함께 검증한다. |
| **PTY 준비 확인** | **Verified in current 2.1.2.** Gemini의 긍정적 진술은 `terminalGateway.ts:81-152`, `TerminalView.tsx`의 준비 상태 경로와 모의 테스트로 뒷받침된다. 과거 감사 4의 준비 신호 결함은 수정됐다. | 실제 서비스의 재시도/429/503 및 장시간 안정성은 별도 실 검증이다. |

**SEC-F008 — 배포 무결성의 남은 신뢰 경계.** 미서명 ZIP/tar.gz와 수정 가능한 Windows 포터블 `resources/app`의 조합은 배포물 변조 탐지/게시자 확인을 어렵게 한다. 이는 현재 소스의 인증 우회가 확인됐다는 뜻은 아니다. README·가이드에 플랫폼별 공개 SHA-256 확인을 실행 가능한 절차로 적고, 코드 서명/ASAR/Fuses 채택 여부에 책임자·검토 시점·호환성 시험을 기록해야 `Accepted Risk`로 분류할 수 있다. 이번 감사에서 위험 수용 승인은 하지 않았다.

## 5. 교차 충돌, 남은 위험, 재감사 조건

- `XPF-F004`: 사용자 요청의 “복수/개별 스크롤”은 Desktop 위 휠만 문서화되어 있다. 브라우저에서 확인된 터미널 경계 휠 중복과 포커스/탭 왕복 기록 소실은 DBG-F014/015이며 현재 제품 계약을 결정해야 한다.
- `XPF-F005`: 릴리스 2.1.2 README는 설치 이름이 맞지만 같은 릴리스에 동봉하는 `LINUX_SETUP.md`는 2.1.0을 가리킨다. 문서 대조만으로는 CI가 잡지 못한 배포 안내 결함을 확인할 수 있다.
- `XPF-F006`: Gemini의 소스 접근 제한과 “메인 파일 4755” 주장은 이번 소스 접근·교차 확인 결과와 맞지 않는다. 나머지 강화 제안은 실제 상태/플랫폼 한계별로 위 표에서 판정했다.

**Accepted Risk:** 이번 감사에서 새로 수용한 위험 없음. 문서가 명시한 “부분 가시 Desktop 숨김”, 코드 서명·자동 업데이트 부재, Linux 물리 기기/실 Desktop 입력 미검증은 알려진 제한으로 유지하되 전체 보안/사용성 PASS를 의미하지 않는다.  
**Needs Spec Clarification:** 터미널 기록/스크롤 위치를 숨김·탭 전환 뒤 보존할지, 휠 경계에서 작업 영역으로 넘길 조건, 원격 Desktop 단축 휠을 작은 화면에 어떻게 안내할지, 서명·ASAR/Fuses의 배포 보안 목표와 책임자.  
**남은 위험:** 브라우저 데모는 네이티브 `WebContentsView`를 열지 않으므로 실제 원격 화면의 휠과 복수 네이티브 뷰 중첩은 독립 검증되지 않았다. 사용자 2.1.2 수용 결과와 CI 로드 성공은 해당 좁은 범위의 증거다. 미서명 배포의 실제 변조 여부를 조사한 것은 아니다.

재감사: (1) 스크롤 소유/기록 보존 계약 수립, (2) 5타일에서 내부 터미널·작업 영역 휠의 끝 경계와 1×1/탭 왕복을 실제 브라우저·네이티브에서 검증, (3) 복수 실제 Desktop에서 일반/Alt+휠과 부분 가시/복귀 확인, (4) v2.1.2 이상 패키지에 포함된 Linux 설치 명령과 Windows/Linux 체크섬 절차를 아카이브에서 실행, (5) 타입·전체 테스트·빌드·감사와 관련 플랫폼 CI 재검증. 기존 `audit_report_1.md`~`audit_report_4.md`는 보존한다.

## 6. 최종 결정과 코더 인계

**HOLD.** 90개 테스트·빌드·의존성 감사와 기존 v2.1.2 공개 릴리스는 확인됐다. 현재 독립 스크롤 재현에서 두 영역의 중복 휠 이동과 터미널 기록 초기화가 확인됐고, 동봉 Linux 설치 안내가 실제 릴리스와 어긋난다. Gemini의 메인 SUID 주장과 현재 볼트 파라미터 미확인 주장은 소스 증거로 바로잡았다.

```text
D:\web\instadesk\docs\audit\audit_report_5.md를 읽고 각 finding을 현행 spec/design/결정 문서와 소스·테스트에 대조하세요.
터미널/작업 영역 휠 경계와 타일 포커스·탭 전환의 기록 보존 정책을 문서에 먼저 정한 뒤 구현과 회귀 테스트를 수정하세요.
동봉 Linux 설치 가이드의 버전과 배포 해시 확인 절차를 맞추고, 보안 강화 제안은 Windows/Linux 지원 범위를 구분해 검토하세요.
기존 감사 보고서를 보존하고 수정 후 브라우저·네이티브 스크롤, 타입, 전체 테스트, 빌드, 의존성 감사를 기록하세요.
```
