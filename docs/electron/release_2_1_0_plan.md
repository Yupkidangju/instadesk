# InstaDesk 2.1.0 다중 아키텍처 릴리스 계약

2026-11-01 · 사용자가 Linux ARM64·AMD64와 Windows x64 릴리스 및 CI/CD 게시를 요청했다. `ARM`은 사용자 확인에 따라 **arm64**, `Windows x86`은 사용자 정정에 따라 **x64**로 확정한다.

## 배포 대상

| 대상 | 실행 환경 | 배포 형식 | 실행 파일 |
|---|---|---|---|
| Windows x64 | `windows-latest` | `InstaDesk-2.1.0-win-x64.zip` | `InstaDesk.exe` |
| Linux AMD64 | `ubuntu-24.04` | `InstaDesk-2.1.0-linux-x64.tar.gz` | `InstaDesk` |
| Linux ARM64 | `ubuntu-24.04-arm` | `InstaDesk-2.1.0-linux-arm64.tar.gz` | `InstaDesk` |

Electron 45.2.1의 공식 사전 빌드 바이너리를 각 **네이티브 runner**에서 설치하고 `resources/app`에 번들된 앱과 `ws`만 넣는다. Linux tarball은 실행 비트를 보존한다. 실행 폴더 밖에 사용자 데이터가 기록되는 기존 계약을 유지한다.

## 게이트와 게시 순서

1. 문서/버전 계약을 먼저 갱신하고 Linux 패키징·스모크 검사를 구현한다.
2. Windows x64 로컬 빌드·기존 실 서비스 흐름, 전체 단위 테스트·타입 검사·의존성 감사 확인.
3. `main`의 세 runner CI에서 타입 검사, 전체 테스트, 감사, 패키징, 바이너리 아키텍처·구조 검사와 headless GUI 로드 스모크가 모두 통과해야 한다.
4. `v2.1.0` 태그를 같은 검증된 커밋에 푸시한다. 태그 CI가 세 아카이브를 다시 빌드하고 모두 성공하면 GitHub Release와 SHA-256 목록을 게시한다. 일부 실패 시 릴리스를 게시하지 않는다.
5. 릴리스 자산·해시·CI 결과를 검증 기록에 남긴다. 이전 감사와 2.0.6 검증 기록은 보존한다.

Linux ARM64는 네이티브 GitHub runner의 가상 화면에서만 스모크한다. 실제 ARM 기기·다른 배포판·코드 서명·전체 실 API 조작 흐름은 검증 범위 밖으로 명시한다. Windows x64는 기존 실 키의 목록·PTY·Desktop 화면 맞춤 확인을 재사용하되 새 2.1.0 바이너리의 최소 로드 스모크를 다시 수행한다.
