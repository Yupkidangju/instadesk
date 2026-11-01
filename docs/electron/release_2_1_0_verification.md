# InstaDesk 2.1.0 릴리스 검증

2026-11-01 · 대상: Windows x64, Linux x64, Linux arm64. 이전 Windows 실 서비스 결과는 [2.0.6 검증](verification.md)을 참조한다. 원본 감사 보고서는 변경하지 않는다.

| 게이트 | 현재 결과 |
|---|---|
| 로컬 타입·회귀 | `npm run typecheck`, `npm test`: 16 파일 54 테스트 통과 |
| 의존성 | `npm install --package-lock-only --ignore-scripts`: 214 패키지, 취약점 0 |
| Windows x64 로컬 패키지 | `npm run package:win` 성공. ZIP 158,395,397 bytes, SHA-256 `77a6bb671d1d2a7e885debbeab212be94dcc6eba086036ea889f94b70518f36f` |
| Linux x64 네이티브 CI | [CI 41282227718](https://github.com/Yupkidangju/instadesk/actions/runs/41282227718)에서 x86-64 ELF, tar.gz 압축 해제, root 소유·4755 sandbox helper, 가상 화면 로드·렌더러 마운트 통과 |
| Linux arm64 네이티브 CI | 같은 CI의 ARM64 네이티브 runner에서 AArch64 ELF, tar.gz 압축 해제, sandbox helper, 가상 화면 로드·렌더러 마운트 통과 |
| Windows x64 패키지 로드 CI | 같은 CI에서 ZIP 압축 해제, 앱 로드·렌더러 마운트 통과 |
| `v2.1.0` 태그·GitHub Release | 세 패키지 게이트 통과. 태그 CI와 자산 게시 대기 |

첫 [CI 41281841471](https://github.com/Yupkidangju/instadesk/actions/runs/41281841471)에서는 Linux 패키징까지 성공했지만 sandbox helper 권한이 없어 로드가 중단됐다. 보안을 끄지 않고 `/opt/instadesk` root 소유·4755 설치 절차를 적용해 세 아키텍처 모두 통과했다.

Linux의 가상 화면 로드 스모크는 앱 시작·렌더러 마운트를 확인한다. 실 ARM 기기·다른 배포판·실 키의 Linux PTY/Desktop·코드 서명은 검증하지 않는다. 세 아키텍처의 CI 성공만으로 기존 [실 서비스 미검증 범위](verification.md)를 전체 PASS로 올리지 않는다.
