# 감사 4 수정·검증 기록 — InstaDesk 2.1.1

작성일: 2026-11-02 (Asia/Seoul). 기준 소스: `main`의 `da221a0`에서 시작한 2.1.1 변경. 이 문서는 **구현자의 재검증 기록**이며 독립 감사 PASS를 대신하지 않는다. 원본 `docs/audit/audit_report_4.md`(SHA-256 `a6ea9f6d13a0f81d768ec2bff1f465e190ea0990786d419083082f5b4a359bd0`)와 이전 보고서는 수정하지 않았다.

## 범위와 계약

[수정 계약](../electron/audit_4_remediation.md), `spec.md`, `designs.md`, `DESIGN_DECISIONS.md`를 코드 전에 갱신했다. InstaBox [terminal OpenAPI](https://api.instabox.sh/v1/openapi.json)는 서버의 user당 열린 PTY 최대 8개와 `session`/`taken`/`error`/`exit` 프레임을 명시한다. [Limits](https://instabox.sh/docs/limits)의 SSE `exec` 동시 한도는 별도다. PBKDF2 작업량 비교에는 [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)의 600,000회 권고를 사용했다. Electron의 버전 없는 `userData`·`sessionData` 경로는 [공식 app API](https://www.electronjs.org/docs/latest/api/app)를 확인했다.

사용자는 후속 지시에서 **실 동일 키 5대 PTY·SSE 검증을 자동 작업에서 제외하고 직접 확인**하기로 했다. 아래 표의 “모의 통과”는 자동 검증 범위를 뜻한다. 2026-11-02 후속 사용자 보고는 표 아래에 별도로 연결한다.

| 원본 finding | 수정·현재 판정 | 재현/검증 증거 | 남은 조건 |
| --- | --- | --- | --- |
| IMP-F007 | 계약·화면 수정, 모의 통과 | `spec.md` 5.2, `HeaderBar.tsx`, `useAppStore.ts`; 로컬 프로필별 8개 차단 제거, user당 서버 한도·로컬 관측치 분리. `auditRemediation.test.ts` | 여러 키가 동일 user인지, 외부 PTY 수, 실제 8→9·429는 실 서버 미검증 |
| IMP-F008 / SEC-F005 | 자동 잠금 수정, 모의 통과 | `cryptoVault.ts`의 키 소비는 타이머를 연장하지 않는다. `App.tsx` 사용자 입력과 `DesktopScreenView.tsx` 네이티브 입력만 연장. `audit4AutoLock.test.tsx`: 10초 조회 중 15분 잠금·입력 후 연장; `cryptoVault.test.ts`: 타이머 지연 뒤 재활성 방지. 잠금/요청 취소는 `auditRemediation.test.ts`, PTY 종료는 `terminalReconnect.test.tsx` | 실제 15분 장시간 앱 사용은 사용자 수용 검사 |
| IMP-F009 | UI·가이드 수정, 모의 통과·사용자 실환경 성공 보고 | `BroadcastExecModal.tsx`, `README.md`, `BUILD_GUIDE.md`에 PTY 독립 SSE 명시. `audit3Ui.test.tsx`: 열린 PTY 0개에서 5대 중 4개 성공·1개 실패를 별도 표시 | 실 서버의 대상별 HTTP·exit code는 수집하지 않음 |
| DBG-F011 | 준비 판정 수정, 모의 통과·사용자 실환경 성공 보고 | `terminalGateway.ts`는 `open`과 `ready(session)`을 분리하고 준비 전 입력을 거부한다. 15초 준비 타임아웃, `taken`/`error`/`exit` 분류. `terminalGateway.test.ts`, `terminalReconnect.test.tsx` | 실 연결의 제어 프레임·점유 순서 로그는 수집하지 않음 |
| DBG-F012 | 진단·제한 회복 수정, 모의 통과·사용자 첫 연결 성공 보고 | HTTP 401/403/409/429/503, `Retry-After`, WebSocket close code/시간을 허용된 범주로 전달. 서버 임의 본문·서브프로토콜 토큰·URL은 이벤트에 넣지 않음. `terminalRetryPolicy.test.ts` 최대 3회·지연, `terminalReconnect.test.tsx` 5개 중 3개 일시 실패 회복·잠금/타일 닫기/프로필 삭제 시 중단, `terminalGateway.test.ts` 오류 순서 | 이번 성공에서는 재시도/429/503이 관찰되지 않아 그 실경로와 과거 3개 실패 원인은 미확정 |
| DBG-F013 | 기존 모의 판정 확대·사용자 실환경 Broadcast 성공 보고 | `audit3Ui.test.tsx`의 5대 독립 SSE 결과 및 원본 보고서의 브라우저 모의 5대 EXIT 0 | 사용자 성공 보고의 개별 HTTP·exit code는 수집하지 않음 |
| SEC-F006 | 입력 수명 수정, 모의 통과 | `ApiKeyModal.tsx`, `MasterUnlockModal.tsx`에서 닫기·잠금·실패 후 비밀 입력 상태를 지움. `audit4Secrets.test.tsx` 재열기 DOM 검사 | JS 문자열의 물리적 메모리 소거는 보장하지 않음 |
| SEC-F007 | v1→v2 이행 구현, 모의 통과 | `cryptoVault.ts` 신규 600,000회·15자, v1 읽기 후 전 프로필 재암호화·단일 저장, 암호문구 변경. `cryptoVault.test.ts` v1 5개 보존, 저장 실패 시 원본 불변·잠금 유지, v2 5개 재해제·평문 부재 | 실제 사용자 v1 볼트는 잠겨 있어 마스터 암호 기반 이행을 실행하지 않음. 오래된 약한 암호는 사용자가 변경해야 함 |

## 추가 발견 REM-F001 — 볼트 프로필 덮어쓰기 경합

원본 보고서의 직접 finding은 아니지만 SEC-F007 데이터 보존과 SEC-F005 자동 조회에 연결된다. `withDecryptedKey()`가 조회 시작 시 읽은 볼트 전체를 복호화 이후 `lastUsedAt`과 함께 다시 저장했다. 그 사이 새 프로필을 추가하면 오래된 스냅샷이 새 키를 지웠다. `cryptoVault.test.ts`의 “polling decrypt finishes later”를 먼저 추가해 **수정 전 `['First']`, 기대 `['First','Second']` 실패**를 확인했다. 저장 직전 최신 레코드를 재조회·병합하도록 바꾼 뒤 통과했다. 이는 실제 사용자 5개 프로필이 보이지 않는 사건의 **가능한 원인**이지만, 서버/사용자 로그 없이 그 사건의 직접 원인으로 단정하지 않는다.

## 버전별 볼트 보존

Electron `userData`와 `sessionData`를 OS 사용자별 버전 없는 `InstaDesk` 경로로 명시하고, localStorage 키 `instabox_deck_vault_v1`을 v2에서도 유지한다. `userDataPath.test.ts`는 패키지 버전에 무관한 경로를 검사한다. Windows GUI에서 2.1.0과 최종 2.1.1 모두 같은 기존 암호화 프로필 **1개가 잠긴 상태로 표시**됐다. 이 검사는 실제 저장된 1개의 존재만 확인한다. 사용자가 오늘 등록했다고 보고한 **5개 키 프로필은 현재 접근 가능한 Electron 저장 기록에서 발견하지 못했다**. 새 볼트를 초기화하거나 기존 레코드를 삭제하지 않았다. 사용자 직접 확인 때 다른 OS 계정·실행 위치와 재등록 후 재실행 결과를 비교해야 한다.

## 2026-11-02 사용자 실환경 수용 결과

사용자는 2.1.1 릴리스 후 “한방에 다 되는군요. 브로드캐스트도 성공”이라고 보고했다. 앞선 대화의 대상은 VM 5대이므로 **5대 PTY 최초 연결과 Broadcast 성공에 대한 사용자 보고**로 IMP-F009·DBG-F011·DBG-F012·DBG-F013에 연결한다. 이는 앱 내부 로그나 서버 응답을 독립 수집한 결과가 아니다. 각 연결의 `session` 프레임, HTTP/WS 코드, 재시도 횟수와 Broadcast의 개별 exit code는 전달받지 않았다. 이번 성공은 과거 3개 PTY 실패의 직접 원인이나 429/503 폴백의 실동작을 증명하지 않는다. 비밀 값과 명령 출력은 수집하지 않았다.

## 실행 검증

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 성공 |
| `npm test` | 20파일 82테스트 통과 |
| `npm audit --audit-level=high` | 알려진 권고 0건 |
| `git diff --check` | 성공 (Windows 줄끝 변환 경고만 출력) |
| `npm run package:win` | Windows x64 최종 패키지 성공; 로컬 ZIP 158,397,920 bytes, SHA-256 `e40140ce2921f5bfb2594aa624818e025fd3a28bfeda77decad7a46a0e87ba67` |
| 패키지 `--smoke-test` | 최종 Windows x64 EXE 실행/렌더러 마운트 exit 0 |
| `main` CI | [41419285177](https://github.com/Yupkidangju/instadesk/actions/runs/41419285177): Windows x64·Linux x64·Linux arm64 패키지/로드 3/3 성공 |
| Linux x64·arm64·Windows x64 태그 CI | [41419547837](https://github.com/Yupkidangju/instadesk/actions/runs/41419547837): 세 패키지와 release 작업 4/4 성공 |
| 2.1.1 공개 자산 | [공개 릴리스](https://github.com/Yupkidangju/instadesk/releases/tag/v2.1.1): draft/prerelease 아님. 세 아카이브 `uploaded`, 공개 URL HEAD 200, `SHA256SUMS.txt`의 세 항목과 GitHub 자산 digest 일치 |

첫 `main` CI [41419061749](https://github.com/Yupkidangju/instadesk/actions/runs/41419061749)의 Linux arm64에서 `audit4AutoLock.test.tsx`가 폴링 호출 수를 10회 초과로 고정해 실패했다. 해당 실행에서는 6회 호출 후 15분 잠금 검사가 수행됐다. 시간 기반 잠금 결과를 유지하고 횟수 조건을 반복 호출(`>1`)로 좁혀 재실행한다. 첫 CI 실패를 성공으로 기록하지 않는다.

공개 자산 확인 (2026-11-02):

| 자산 | 크기(bytes) | SHA-256 |
| --- | ---: | --- |
| `InstaDesk-2.1.1-linux-arm64.tar.gz` | 125,131,815 | `a521f19091abbc004120d9beafbad99bdd2f42318b907a62fc4714d7f697e98c` |
| `InstaDesk-2.1.1-linux-x64.tar.gz` | 124,048,101 | `afd346aacfddfb34c73cb87091bfb5742aaab97654e13f948e9ebebb6cfa427c` |
| `InstaDesk-2.1.1-win-x64.zip` | 158,397,936 | `1a47ef5917f4a27d26afb79a510ed6eb2eeebcff2d3833efb36cbe7e296f3f80` |
| `SHA256SUMS.txt` | 294 | `664c399542ca5af147ae5c8a3e4fa63e7efcb2e34fba19e025d58bbbd4e6c3ca` |

로컬 ZIP과 CI의 공개 ZIP은 크기·해시가 다르다. 아카이브의 바이트 재현성을 주장하지 않으며 공개 다운로드 검증에는 위 공개 해시를 사용한다. 태그 `v2.1.1`은 `5f4fbb8a240f787673b4be8da77607b01108e048`을 가리킨다.

**판정:** 수정 범위의 자체 회귀와 사용자 보고 기준 5대 PTY·Broadcast 주요 흐름은 성공했다. 독립 재감사, 오류 시 실제 429/503 폴백, 기존 사용자의 5개 키 프로필 보존·복원은 **HOLD/미검증**이다. 다음 재감사는 타일별 비밀 없는 `session`/HTTP·WS 범주·재시도 횟수와 Broadcast의 대상별 exit code를 확인한다. 비밀·명령 출력은 보고서에 적지 않는다.
