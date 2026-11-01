# InstaDesk 2.1.0 릴리스 검증

2026-11-01 · 대상: Windows x64, Linux x64, Linux arm64. 이전 Windows 실 서비스 결과는 [2.0.6 검증](verification.md)을 참조한다. 원본 감사 보고서는 변경하지 않는다.

| 게이트 | 현재 결과 |
|---|---|
| 로컬 타입·회귀 | `npm run typecheck`, `npm test`: 16 파일 54 테스트 통과 |
| 의존성 | `npm install --package-lock-only --ignore-scripts`: 214 패키지, 취약점 0 |
| Windows x64 로컬 패키지 | `npm run package:win` 성공. ZIP 158,395,397 bytes, SHA-256 `77a6bb671d1d2a7e885debbeab212be94dcc6eba086036ea889f94b70518f36f` |
| Linux x64 네이티브 CI | 대기 |
| Linux arm64 네이티브 CI | 대기 |
| Windows x64 패키지 로드 CI | 대기 |
| `v2.1.0` 태그·GitHub Release | 세 패키지 게이트 후 대기 |

Linux의 가상 화면 로드 스모크는 앱 시작·렌더러 마운트를 확인한다. 실 ARM 기기·다른 배포판·실 키의 Linux PTY/Desktop·코드 서명은 검증하지 않는다. 세 아키텍처의 CI 성공만으로 기존 [실 서비스 미검증 범위](verification.md)를 전체 PASS로 올리지 않는다.
