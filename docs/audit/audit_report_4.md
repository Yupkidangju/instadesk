# InstaDesk 2.1.0 독립 감사 4 — PTY 연결, 브로드캐스트, 볼트 보안

작성일: 2026-11-02 (Asia/Seoul)  
대상: `D:\web\instadesk`, `main`/`origin/main` `da221a0`; 소스·설정은 공개 태그 `v2.1.0` 이후 변경 없음(`git diff v2.1.0 HEAD -- src electron package.json package-lock.json vite.config.ts` 공백)  
감사 기준: `AI_AUDIT_DOC_STANDARD.md`, `spec.md`, 현재 소스·테스트, InstaBox 공식 [OpenAPI](https://api.instabox.sh/v1/openapi.json)와 [Limits](https://instabox.sh/docs/limits)  
**최종 판정: HOLD** (이미 게시된 릴리스의 존재와 품질 판정은 별개)

## 1. 범위와 검증 증거

사용자 보고: 같은 InstaBox 키로 **TERM만 5대**를 열었을 때 약 2대가 연결되지 않았고, 수동 재연결하면 회복됐다. 오류 문구·시각·서버 로그는 확보되지 않았다. 브로드캐스트는 그 뒤에 시도했다. 이 증언은 재현 조건이며 서버 원인의 증명으로 취급하지 않는다.

확인한 입력: `AGENTS.md`, 감사 표준, `spec.md`, `designs.md`, `DESIGN_DECISIONS.md`, `README.md`, `BUILD_GUIDE.md`, `IMPLEMENTATION_SUMMARY.md`, `audit_roadmap.md`, `CHANGELOG.md`, `docs/electron/{architecture.md,verification.md,release_2_1_0_verification.md}`, 이전 `docs/audit/` 기록, `package.json`/lock, `src/services/{cryptoVault.ts,instaboxClient.ts}`, `src/store/useAppStore.ts`, `src/App.tsx`, `src/components/{terminal/TerminalView.tsx,modals/BroadcastExecModal.tsx,modals/ApiKeyModal.tsx,modals/MasterUnlockModal.tsx,desktop/DesktopScreenView.tsx}`, `electron/{main.ts,preload.ts,apiGateway.ts,terminalGateway.ts,desktopViewGateway.ts,desktopViewPolicy.ts,appProtocol.ts}` 및 해당 테스트. 나머지 소스/테스트는 파일 목록과 교차 검색으로 확인했다.

실행 증거:

| 검사 | 결과 |
| --- | --- |
| 저장소 | `main...origin/main` 깨끗함, 공개 릴리스 `v2.1.0`은 draft/prerelease 아님; HEAD의 제품 소스는 태그와 동일 |
| 설치 상태 | `npm ls --depth=0` 정상; Node/npm 현재 설치판 사용 |
| 타입·테스트 | `npm run typecheck` 성공; `npm test` **16파일 54테스트 통과** |
| 빌드·권고 | `npm run build` 성공; JS 540.06 kB 청크 경고; `npm audit --json` 전체 권고 0건 |
| 5대 모의 실행 | Chromium 로컬 preview에서 데모 실행 머신 5대를 구성, `TARGET NODES (5 / 5 RUNNING)` 확인, `echo audit-five` 브로드캐스트 5대 모두 `EXIT: 0`. 이는 실 API/PTY 검증이 아님 |
| 키 입력 수명 | 같은 preview에서 제출하지 않은 시험용 마스터 암호를 KEY VAULT에 입력 → 모달 닫기 → 다시 열기: 입력값이 그대로 남음. 실제 사용자 비밀은 사용하지 않음 |
| 공개 계약 | 실 OpenAPI의 terminal 항목은 **사용자당 열린 터미널 최대 8개**, WebSocket 수립 뒤 `session` 신호와 `taken`/`error` 메시지, 429 응답을 명시. 공식 Limits는 별도 `exec` 동시 요청 기본 32개를 설명 |

제외: 실제 사용자 키/마스터 암호, 사용자 VM에 대한 추가 로그인·명령 실행, 서버의 연결 로그, 실제 동일 키 PTY 5대 반복/장시간 테스트, 실제 브로드캐스트 SSE 5대, Linux 물리 ARM·다른 PC/배포판, 전체 보조 기술 검사. 감사 중 제품 소스·테스트·계약 문서는 수정하지 않았고 외부 서비스 변경 호출을 하지 않았다. 현재 자료만으로 **실패의 서버 측 직접 원인**은 확정할 수 없다.

## 2. Pass 1 — 문서·구현 정합성

### IMP-F007 — 세션 한도 계약과 계수 단위가 공식 API와 다름

- **심각도/상태:** Major / Needs Fix.
- **증거:** `spec.md:144-146`은 계정당 터미널·데스크톱 합산 8개라고 쓰고, 클라이언트는 프로필별로 계수한다. `src/store/useAppStore.ts:129-134`도 `profileId`별 8개 예약을 검사하며 `HeaderBar.tsx:45-50`은 `PER KEY`를 표시한다. 현재 공식 [OpenAPI terminal 설명](https://api.instabox.sh/v1/openapi.json)은 **user당 최대 8개 열린 terminal**이라고 명시하고, `exec`는 [별도 32개 동시 요청 한도](https://instabox.sh/docs/limits)를 갖는다. Desktop을 같은 8개에 합산한다는 근거는 현재 공식 계약에서 확인되지 않았다.
- **기대/실제/영향:** 서버 한도 단위와 화면 설명이 일치해야 한다. 같은 사용자의 여러 키/프로필이 각각 8개를 열면 앱은 허용해도 서버가 거부할 수 있다. 다만 **같은 키 TERM 5개**만으로 이 앱의 자체 8개 게이트에 걸리는 것은 아니다.
- **수정/재감사:** 문서를 현행 서비스 계약으로 수정하고 user/account 식별·외부 세션 가시성의 한계를 명시한다. 서버 거절을 실제 상태로 받아 표시한다. 동일 user의 복수 키, 8→9 연결 및 실제 429를 허가된 계정에서 확인한다.

### IMP-F008 — 비활성 잠금 계약은 현재 실행 경로에서 성립하지 않음

- **심각도/상태:** Critical / Needs Fix. SEC-F005와 교차.
- **증거:** `spec.md:20`, `DESIGN_DECISIONS.md:20`은 15분 **비활성** 자동 잠금을 약속한다. 실제로는 아래 SEC-F005처럼 자동 목록 조회가 타이머를 매번 갱신한다.
- **기대/실제/영향:** 사람의 입력이 없는 시간이 기준이어야 한다. 현재는 네트워크 폴링이 사용자 활동으로 오인된다.
- **수정/재감사:** 잠금 기준을 사용자 활동으로 정의하고 문서·구현·타이머 테스트를 함께 수정한다.

### IMP-F009 — Broadcast와 PTY의 관계가 사용자 흐름에 불명확

- **심각도/상태:** Minor / Needs Documentation Recovery.
- **증거:** `BroadcastExecModal.tsx:29-35,94-145`는 실행 중인 머신을 대상으로 각각 `streamExec` SSE를 보낸다. PTY가 `LIVE`인지 검사하지 않는다. 모달은 `TARGET NODES (... RUNNING)`을 표시하지만 `README.md`와 `BUILD_GUIDE.md`는 “터미널 연결 없이도 브로드캐스트할 수 있다”는 차이를 설명하지 않는다.
- **기대/실제/영향:** 사용자가 브로드캐스트 실패와 열린 터미널 실패를 구분할 수 있어야 한다. 현재 두 경로가 별개라는 설명이 부족하다.
- **수정/재감사:** UI/가이드에 Broadcast는 독립적인 `exec` 요청이며 PTY 연결을 요구하지 않는다고 명시하고, 각각의 실패 상태를 별도 표시한다.

## 3. Pass 2 — 연결 정확성·복원력

### DBG-F011 — WebSocket 수립을 PTY 준비 완료로 잘못 표시하고 서버 신호를 버림

- **심각도/상태:** Major / Needs Fix.
- **증거:** `electron/terminalGateway.ts:58-68`은 WebSocket `open`을 전달한다. `TerminalView.tsx:146-169`는 이때 곧바로 `PTY LIVE`로 전환하고, 서버의 JSON 제어 메시지 중 `exit`만 처리한다. 공식 [terminal 프로토콜](https://api.instabox.sh/v1/openapi.json)은 첫 출력 전에 `session` 신호를 보내며, 세션을 다른 곳에서 열면 `taken`, 서버 오류는 `error`를 보낸 뒤 닫는다고 설명한다. 두 거절 메시지는 현재 UI에서 무시된다.
- **기대/실제/영향:** `LIVE`는 실제 셸 세션 입장 확인 후에 표시하고, 점유/서버 오류는 별도 사유로 보여야 한다. 현재 핸드셰이크만 성공해도 잠시 `LIVE`가 될 수 있으며 핵심 실패 단서가 사라진다. 사용자의 “다시 연결하면 된다”는 경험과 양립하지만 실제 원인을 증명하지는 않는다.
- **수정/재감사:** `session` 제어 메시지 수신을 준비 완료 조건으로 하고, `taken`/`error`/`exit` 상태를 명시적으로 처리한다. 각각의 제어 프레임과 close 순서를 모의 테스트한 뒤 실제 5 PTY에서 비교한다.

### DBG-F012 — PTY 거절 상태·종료 사유가 게이트웨이에서 소실되고 자동 회복이 없음

- **심각도/상태:** Major / Needs Fix.
- **증거:** `electron/terminalGateway.ts:63-68`의 `error`·`close` 이벤트는 예외, HTTP 핸드셰이크 상태, WebSocket close code/reason을 전달하지 않는다. `TerminalView.tsx:165-168`은 모든 오류를 “Check the key and machine state”로 통합한다. `ws` 현재 설치판은 예상 밖 HTTP 응답의 상태(예: `Unexpected server response: 429`)를 내부 오류로 만들지만 이 앱이 폐기한다. `TerminalView.tsx:204-209`에는 수동 Retry만 있다. 테스트에는 5개 실제/모의 연결의 일시 실패·복구·429/409/503 분류가 없다.
- **기대/실제/영향:** 사용자와 감사자가 401/403 키 문제, 409 머신 상태, 429 한도, 503/타임아웃, `taken`을 구별해야 한다. 현재 두 연결이 실패해도 서버 문제와 클라이언트 문제를 판별할 자료가 없다. 일시 장애 뒤 수동 재연결이 필요하다.
- **수정/재감사:** 토큰·키·서명 URL을 로깅하지 않으면서 허용된 상태 코드/오류 범주/close code와 시각·타일 ID를 전달한다. 재시도 가능한 429(`Retry-After`가 있으면 준수), 503, 일시 네트워크 오류만 지수 지연·지터·최대 시도로 재연결하고, 인증 오류/`taken`은 자동 재시도하지 않는다. 잠금·타일 닫기·프로필 삭제 후 재시도 중단을 테스트한다. 진단 가능한 버전으로 사용자 사례를 다시 재현해야 서버 원인을 판정할 수 있다.

### DBG-F013 — 5개 Broadcast 분기는 모의 환경에서 동작하지만 실 결과는 미확인

- **심각도/상태:** Info / Verified (모의 범위만).
- **증거:** `BroadcastExecModal.tsx:94-145`는 5개 선택 대상을 병렬 `streamExec`로 보낸다. 별도의 로컬 데모 UI 실행에서 5개 모두 `EXIT: 0`을 확인했다. 공식 [Limits](https://instabox.sh/docs/limits)의 `exec` 기본 동시 한도 32는 PTY 8과 다른 제한이다.
- **기대/실제/영향:** 현재 자료는 브로드캐스트의 5개 대상 선택/결과 표시가 동작함을 보여준다. 실 서버의 SSE 5개 동시 실행 또는 실패 시 재시도는 검증하지 못했다. 사용자가 본 두 터미널의 불연결과 브로드캐스트 요청 실패를 같은 사건으로 합치면 안 된다.
- **수정/재감사:** 실제 PTY 연결과 독립적으로 허가된 읽기 전용 명령의 5대 SSE 실행 결과·HTTP 코드·exit code를 기록한다.

## 4. Pass 3 — 키·세션 보안

### SEC-F005 — 자동 조회가 볼트 자동 잠금을 계속 연장함

- **심각도/상태:** Critical / Hold.
- **증거:** `src/App.tsx:24-31`은 기본 10초(`useAppStore.ts:122`)마다 `refreshMachines()`를 호출한다. 잠금 해제된 프로필은 `useAppStore.ts:226-245`에서 `listMachines()`로 조회된다. 모든 실 키 소비는 `cryptoVault.withDecryptedKey()`를 거치고, `cryptoVault.ts:254-255`가 호출 시작에 `touch()`한다. `cryptoVault.ts:47-55`는 이때 15분 타이머를 처음부터 재설정한다. 반대로 폴링을 끄고 사용자가 PTY 키보드만 조작할 때는 `touch()` 호출이 없어 실제 사용 중에도 잠길 수 있다.
- **기대/실제/영향:** 사용자 비활성 15분 후 마스터 키와 앱 소유 채널이 잠겨야 한다. 기본 자동 조회가 정상 반복되는 한 사용자 입력이 없어도 잠금이 계속 연장되어 열린 API 키 세션이 무기한 유지될 수 있다. 기존 볼트 테스트는 주기 폴링과 사용자 활동을 함께 재현하지 않는다.
- **수정/재감사:** 자동 네트워크 요청과 실제 사용자 활동을 분리한다. 비활성 기준 및 활성 PTY 처리 정책을 명세하고, fake timer로 폴링 중 15분 잠금·사용자 입력 시 연장·잠금 후 요청/PTY/데스크톱 종료를 검증한다.

### SEC-F006 — 닫힌 키 모달이 입력 중 비밀을 계속 보관함

- **심각도/상태:** Major / Needs Fix.
- **증거:** `ApiKeyModal.tsx:31-38,45-48`은 `masterPassword`, `confirmPassword`, `newApiKey`를 React 상태로 가지지만 닫기에서 `pendingDelete`만 초기화한다. `App.tsx`는 모달 컴포넌트를 항상 마운트한다. 시험용 비밀번호를 입력하고 닫았다 다시 연 브라우저 검사에서 같은 값이 재표시됐다. `MasterUnlockModal.tsx:7-34,36-72`도 취소/닫기나 실패 때 `password`를 지우지 않는다. 잠금은 키 모달 입력 상태도 지우지 않는다.
- **기대/실제/영향:** 닫기·잠금·실패 후 비밀번호/미제출 키가 UI 상태에 남지 않아야 한다. 현재 영구 디스크 저장 증거는 없지만 렌더러 메모리와 재열린 입력에 평문이 남는다. `spec.md:18-20,78-90`의 평문 수명·잠금 기대와 불일치한다.
- **수정/재감사:** 모달 닫기/취소/잠금에서 비밀 입력 상태를 지우고, 실패 후 유지가 필요하면 명시적으로 정책을 결정한다. 재열기 DOM/상태 테스트를 추가한다.

### SEC-F007 — 6자 마스터 암호와 PBKDF2 10만 회는 오프라인 공격에 약함

- **심각도/상태:** Major / Needs Fix (기존 볼트 호환 이행 필요).
- **증거:** `cryptoVault.ts:6,97-103,315-337`은 PBKDF2-HMAC-SHA256 100,000회, 최소 6자를 강제한다. 암호화된 저장 레코드에는 salt와 알려진 검증 토큰이 있어 저장 파일을 얻은 공격자는 오프라인 추측을 시도할 수 있다. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)는 PBKDF2-HMAC-SHA256의 현재 권고 작업량을 600,000회로 제시한다. 이 권고는 웹 인증 암호 저장 지침이므로 로컬 암호화 볼트에 직접 법적 의무로 적용한 것은 아니며, 위협 모델 비교 근거로 사용했다.
- **기대/실제/영향:** 사용자가 약한 6자 암호를 선택해도 “AES-256” 표시만으로 충분히 안전하다고 오인하지 않아야 한다. 저장 파일 유출 시 암호 강도는 입력 비밀번호와 KDF 비용에 의존한다.
- **수정/재감사:** 강한 긴 암호문구를 요구/유도하고 기기에서 허용되는 KDF 비용을 측정한다. 기존 볼트를 잃지 않도록 버전·재암호화/마이그레이션 계약을 먼저 설계해 검증한다. 이미 유출 가능성이 있는 키는 암호 변경만으로 보호되지 않으므로 별도 회전 정책을 둔다.

### 확인된 방어 경계와 한계

- `electron/main.ts:36-42,103-112,148-169`: 격리·sandbox·Node 차단·CSP·임의 탐색/창/권한 요청 거부를 확인했다.
- `electron/apiGateway.ts:15-56`: 고정 HTTPS 업스트림, 메서드/경로/Bearer 검사, 리다이렉트 거부, 응답 `no-store`와 `Set-Cookie` 제거를 확인했다. 정상 요청의 평문 Bearer는 설계상 메인/업스트림에 전달된다.
- `electron/terminalGateway.ts:21-35` 및 `desktopViewPolicy.ts:15-36`: 티켓 WSS/대시보드 URL allowlist와 형식 검사를 확인했다. PTY 토큰은 URL이 아니라 서브프로토콜로 전달한다.
- `src/store/useAppStore.ts:89-109,192-210`은 잠금/프로필 삭제 시 앱 소유 요청과 네이티브 채널 종료를 호출한다. 단, 실제 서버 티켓 취소, 외부 창 및 동시성 조건은 실 서비스로 검증하지 않았다.
- 현재 추적 대상 검색에서 긴 `ibk_` 패턴은 데모/테스트/명세 파일에만 확인됐고 실제 사용자 키의 Git 반영 증거는 없었다. 2.0.6 검증 문서에는 과거 캡처에 키 형태의 문자열이 보였다는 기록이 있으므로 **실 키였다면 폐기·교체 여부를 확인**해야 한다. 그 값을 다시 읽거나 이 보고서에 적지 않았다.
- `npm audit` 0건은 알려진 의존성 권고만 뜻한다. 제품 보안/실 서비스 동작 PASS가 아니다.

## 5. 교차 판단, 필요한 조치, 재감사 조건

**서버 문제인가, 앱 문제인가:** 5개 TERM 중 2개 실패의 원격 원인은 현재 증거로 **미확정**이다. 공식 계약상 최대 8개 열린 PTY는 사용자 단위이며, 5개만으로 한도가 설명되지 않는다. 다른 앱/대시보드의 세션, 일시적 429/503/409, `taken`, 네트워크 또는 로컬 경합이 가능하다. 반면 앱이 준비 신호·서버 오류·핸드셰이크 상태를 버리고 회복 전략이 없는 것은 **확인된 프로그램 문제**다. 수동 재연결 성공은 일시 실패 가능성을 지지하지만 서버 결함의 증거는 아니다.

우선순위: (1) 자동 잠금과 비밀 입력 수명 수정, (2) PTY `session` 준비 확인/`taken`·`error`·HTTP 상태 진단, (3) 재시도 가능한 실패에만 제한된 재연결, (4) 세션 한도 문서·user 단위 정책 정렬, (5) 볼트 KDF/암호 정책과 기존 데이터 이행, (6) 실제 동일 키 5대 재현 및 별도 5대 SSE 검증. 네이티브 로그에는 키·토큰·서명 URL·명령 본문을 남기지 않는다.

**Accepted Risk:** 없음. **Needs Spec Clarification:** 공개 API가 보고하지 않는 현재 서버 PTY 사용량의 표시 방식, 외부 세션과 `taken` 처리 정책, 비활성 기준(사용자 입력/시스템 요청), 재연결 최대 횟수와 429 재시도 지연, 기존 볼트 KDF 이행 방식. **남은 위험:** 실제 키의 서버 상태/실패 응답·다섯 PTY/실 브로드캐스트·장시간 사용과 다른 기기에서의 수용은 미검증이다.

재감사 방법: 실패한 VM의 비밀 없는 시간/요청 ID/상태 범주를 수집하고, 허가된 계정으로 TERM 1→5 순차/동시, 다른 대시보드가 같은 세션을 차지한 경우, 429/409/503과 `taken`/`error`, 네트워크 단절·재연결, 잠금/삭제 중 재시도 중단을 검증한다. 자동 폴링 중 15분 잠금과 모달 닫기 후 비밀 제거도 회귀 테스트로 확인한다. 실제 5대 Broadcast는 독립된 읽기 전용 명령의 SSE 결과로 확인한다. 원본 감사 1~3과 이 보고서를 보존한다.

## 6. 최종 판정과 코더 인계

**HOLD.** 설치된 의존성, 타입 검사, 54개 기존 테스트, 빌드 및 모의 5대 Broadcast는 통과했다. 그러나 자동 잠금 계약 실패가 보안 출고 게이트를 막고, 실 PTY 실패의 원인을 확인할 진단 정보가 현 구현에서 소실된다. 릴리스의 다른 검증 범위까지 소급해 PASS 또는 전체 실패로 단정하지 않는다.

```text
D:\web\instadesk\docs\audit\audit_report_4.md의 finding을 현재 spec/design/결정 문서와 소스·테스트에 대조하세요.
계약이 달라지면 문서를 먼저 갱신하고, 자동 잠금·PTY 준비/오류/재시도·비밀 입력 수명·볼트 이행을 별도 수정 단위로 처리하세요.
수정 후 타입 검사, 전체 테스트, 빌드, 의존성 감사와 허가된 동일 키 5대 실 연결/브로드캐스트를 검증해 finding ID별 증거를 남기세요.
원본 감사 보고서와 이번 보고서를 보존하세요.
```
