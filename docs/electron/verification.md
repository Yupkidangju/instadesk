# Electron 2.0.0 검증 기록

2026-11-01 · Windows x64 · `D:\web\instadesk` · `feat/electron-desktop` 작업 기준. 유효한 실제 InstaBox 키는 사용하지 않았다.

| 대상 | 실행·관찰 | 결과 |
|---|---|---|
| 타입·회귀 | `npm run typecheck`, `npm test` | 성공, 14 파일 52 테스트 |
| 렌더러·메인 빌드 | `npm run build:desktop` | 성공, Vite JS/CSS 및 Electron CJS 생성. JS 청크 500 kB 경고 있음 |
| 의존성 | `npm install --package-lock-only --ignore-scripts` | 감사 214 패키지, 취약점 0 |
| 보안 경계 | 자산 경로 탈출, 고정 API 호스트·메서드·리다이렉트 거부, PTY 티켓 목적지·서브프로토콜·잠금 종료 | 해당 단위·통합 테스트 통과 |
| 네이티브 실행 | `npx electron . --remote-debugging-port=9333` | `app://instadesk` UI, 제한 브리지 API, KEY VAULT의 Worker 입력 제거 확인 |
| 네이티브 API | 앱 렌더러에서 가짜 `ibk_invalid_probe_only`로 `GET /instabox-api/v1/machines` | InstaBox 서버 `401 malformed_key`; 브라우저 CORS 오류 없음 |
| 패키징 | `npm run package:win` | `release/InstaDesk-2.0.0-win-x64/` 및 ZIP 생성. ZIP 158,393,462 bytes, SHA-256 `3980c28122b033b38d4cf59f36d291af78929fccc7f1755f72902bbd66dec528` |
| 포터블 폴더 | `release/InstaDesk-2.0.0-win-x64/InstaDesk.exe --remote-debugging-port=9334` | 앱 Origin·브리지·Worker UI 제거·가짜 키 401 확인 |
| ZIP 추출 | ZIP을 `release/smoke-extracted-2.0.0/`에 풀고 EXE 실행(9335) | 앱 Origin·렌더러·브리지 표시 확인. 임시 추출 폴더의 자동 삭제는 승인 검토에서 차단되어 남아 있음 |
| 데모 | 포터블 앱에서 `TRY DEMO MODE` | 가상 VM 4대 표시 |

## 미검증 조건

- 유효한 실제 키로 VM 목록·생성·전원 제어·삭제, SSE exec, PTY 소켓, Desktop 서명 iframe과 takeover/handback은 실행하지 않았다. API 키 권한과 원격 서비스의 프레임 정책이 필요하다.
- 네이티브 볼트의 앱 재시작 후 복호화는 단위 테스트의 잠금/해제까지만 확인했다. 장시간 사용·다른 PC·SmartScreen·코드 서명은 확인하지 않았다.
- 개인 Cloudflare Worker와 Pages 게시 종료 결과는 배포 종료 절차 후 이 문서에 추가한다.

판정: **Windows x64 포터블 앱·데모·가짜 키 API 경로는 검증됨. 실 API 전체 수용은 HOLD.**
