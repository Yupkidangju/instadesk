# Electron 2.0.2 검증 기록

2026-11-01 · Windows x64. [2.0.0](verification_2_0_0.md)·[2.0.1](verification_2_0_1.md) 검증 기록을 보존한다. 이전 감사 보고서는 `docs/audit/`에 그대로 있다.

| 대상 | 실행·관찰 | 결과 |
|---|---|---|
| 실 서비스 첫 확인 | 사용자 실 키로 VM `sleipnir-01` 목록 표시 | API 목록 성공. 2.0.0 PTY는 `Invalid terminal ticket protocols`, Desktop iframe은 검은 화면. 사용자 스크린샷 증거, 키·티켓 값은 보고서에 기록하지 않음 |
| 원인 대조 | [InstaBox OpenAPI](https://api.instabox.sh/v1/openapi.json) 및 dashboard HTTP 헤더 | 서비스 반환 `protocol`과 `instabox-access-token.<token>` 전달 필요. `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`가 iframe을 거부 |
| 수정 회귀 | PTY 목적지·서브프로토콜·점 포함 티켓·세션 쿼리; Desktop URL/좌표 제한·네이티브 뷰·모달 종료·VM 일시 중단 안내 | `npm test`: 15 파일 53 테스트 통과. `npm run typecheck` 통과 |
| 네이티브 뷰 스모크 | Electron `WebContentsView`에 dashboard의 잘못된 시험 링크를 최상위로 로드 | iframe 오류 대신 대시보드 자체의 `This desktop link is invalid` 화면이 앱 안에 표시됨. 유효한 링크는 아직 재검증 전 |
| 새 빌드 | `npm run package:win` | `release/InstaDesk-2.0.2-win-x64/` 및 ZIP 생성. ZIP 158,395,070 bytes, SHA-256 `557e916bc0f7469557c89eb392fc82a7a37eb79018acffabd3a55dbc082e7c26` |
| 중복 실행 | 2.0.2 EXE를 열린 상태에서 다시 실행 | 전후 메인 프로세스 수 1→1, 기존 창으로 복귀. 두 번째 프로세스가 닫히기 전 일시적 Chromium 캐시 잠금 메시지는 관찰됨 |
| 저장소 감사 | `npm install --package-lock-only --ignore-scripts` | 214 패키지, 취약점 0 |

## 진행 중인 실 서비스 검증

- 2.0.1에서 기존 2.0.0 볼트 프로필이 표시되지 않았고, 2.0.0 단독 재실행에서도 기록이 보이지 않았다. 병행 실행 중 저장소 충돌 가능성이 있으나 원인을 확정할 복구 자료가 없다. 사용자가 2.0.2에 키를 직접 등록한 뒤 재시작 보존을 확인한다. 키와 마스터 암호는 요청하거나 기록하지 않는다.
- 2.0.1 패키지와 개발 앱의 병행 실행에서 Chromium 캐시 잠금 오류가 관찰됐다. 이후 단일 인스턴스 잠금을 코드에 추가했으며 최종 새 패키지에 포함하고 네이티브로 확인한다.
- 사용자가 2.0.1 볼트를 등록·해제하면 실제 VM의 PTY 출력/입력과 Desktop 화면/상호작용을 확인한다. 일시 중단된 VM은 앱이 링크를 열지 않고 재개를 안내한다.
- Pages·Worker 게시 중단 및 오래된 빌드 정리는 새 앱의 실 서비스 수용 후 실행한다.

현재 판정: **PTY·Desktop 실 서비스 재검증 중. 최종 수용 HOLD.**
