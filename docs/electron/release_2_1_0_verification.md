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
| `v2.1.0` 태그·GitHub Release | 태그가 검증 커밋 `6212329`를 가리킴. [태그 CI 41282601993](https://github.com/Yupkidangju/instadesk/actions/runs/41282601993)의 세 패키지·release 작업 4/4 성공. [공개 릴리스](https://github.com/Yupkidangju/instadesk/releases/tag/v2.1.0)는 draft/prerelease 아님 |

첫 [CI 41281841471](https://github.com/Yupkidangju/instadesk/actions/runs/41281841471)에서는 Linux 패키징까지 성공했지만 sandbox helper 권한이 없어 로드가 중단됐다. 보안을 끄지 않고 `/opt/instadesk` root 소유·4755 설치 절차를 적용해 세 아키텍처 모두 통과했다.

## 공개 자산 검증

세 아카이브의 공개 다운로드 URL은 HEAD `200`, GitHub API의 상태는 모두 `uploaded`다. `SHA256SUMS.txt`의 값과 GitHub가 보고한 digest가 일치한다.

| 자산 | 크기(bytes) | SHA-256 |
|---|---:|---|
| `InstaDesk-2.1.0-linux-arm64.tar.gz` | 125,127,920 | `97db6afdfe7464d30f87e74e87534b9911ec63e90a84d4942d6962f832b53a18` |
| `InstaDesk-2.1.0-linux-x64.tar.gz` | 124,048,237 | `2c85132ac19ab0661706bf9b7294ff8a99d0f5aceb958561049f3e9482592b75` |
| `InstaDesk-2.1.0-win-x64.zip` | 158,395,413 | `8e00ba2da96ee29c70fa14fb61bbfcda316a01063d52c89e5fc1a64721ecec70` |
| `SHA256SUMS.txt` | 294 | `aaf4be56083f8eb863654f47da13f165ca2929fb496ed53f88c9e36fb9d1f165` |

로컬 Windows ZIP의 해시는 CI에서 새로 생성한 공개 ZIP과 다르다. 아카이브는 바이트 단위 재현성을 보장하지 않으므로 **공개 자산 확인에는 위 릴리스 해시**를 사용한다.

판정: **요청된 세 아키텍처 CI/CD와 공개 릴리스 범위 통과.** Linux 물리 ARM 기기, 다른 배포판, 실 키의 Linux PTY/Desktop, 코드 서명·자동 업데이트와 기존 실 서비스 미검증 흐름은 별도 조건이다.

Linux의 가상 화면 로드 스모크는 앱 시작·렌더러 마운트를 확인한다. 실 ARM 기기·다른 배포판·실 키의 Linux PTY/Desktop·코드 서명은 검증하지 않는다. 세 아키텍처의 CI 성공만으로 기존 [실 서비스 미검증 범위](verification.md)를 전체 PASS로 올리지 않는다.
