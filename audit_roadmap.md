# InstaDesk 2.0 감사 로드맵

2026-11-01 · 기존 웹 감사 로드맵은 [보존본](docs/legacy/audit_roadmap.web-2026-11-01.md)에 있다. 원본 감사 보고서와 finding ID는 `docs/audit/`에서 유지한다.

| 단계 | 기준 | 현재 증거 |
|---|---|---|
| 로컬 보안 경계 | 앱 자산 경로 제한, sandbox/contextIsolation, 제한 IPC, 고정 API/WSS 목적지, 리다이렉트 거부, 저장 키 암호화·잠금 | [검증 기록](docs/electron/verification.md)의 단위·네이티브 스모크. 실 키 미사용 |
| Windows 패키지 | x64 ZIP·EXE, 별도 위치 실행, 코드·의존성·라이선스 포함, 원본 Pages 데이터 자동 이전 없음 | ZIP 추출·실행 확인. 서명·다른 PC 미검증 |
| 실 서비스 기능 | 유효한 키로 REST 목록/변경, SSE exec, PTY, Desktop 뷰·제어 및 잠금/재연결 | 목록은 확인. PTY·Desktop 2.0.2 재검증 중. 변경·SSE는 미검증 |
| 게시 종료 | Pages 워크플로/게시 사이트 및 사용자 개인 Worker 제거, 감사 원본·GitHub 저장소 보존 | Pages API 404, Worker `/health` 404. 원격 Git 푸시/CI 확인 대기 |

전환의 범위 수용과 실제 서비스 수용은 별도로 판정한다. 유효한 실 키를 가진 사람이 주요 사용 흐름을 실행하기 전까지 전체 릴리스 PASS로 표시하지 않는다.
