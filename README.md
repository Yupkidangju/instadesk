# InstaDesk

> [v2.1.1 릴리스](https://github.com/Yupkidangju/instadesk/releases/tag/v2.1.1): Windows x64, Linux x64, Linux arm64. 감사 4의 수정 범위는 [수정 계약](docs/electron/audit_4_remediation.md)과 [finding별 결과](docs/audit/audit_report_4_remediation.md)에 있습니다.

Windows x64와 Linux x64·arm64에서 InstaBox VM을 여러 화면으로 관리하는 Electron 앱입니다. VM 목록, PTY 터미널, 명령 실행, 데스크톱 스트림, 데모 모드를 제공합니다. 터미널과 스트림의 구분선을 드래그하거나 화살표 키로 조절할 수 있으며 스트림은 화면비를 유지합니다.

## 다운로드 및 실행

Windows는 `InstaDesk-2.1.1-win-x64.zip`을 압축 해제해 `InstaDesk.exe`를 실행합니다. Linux는 해당 아키텍처의 `InstaDesk-2.1.1-linux-{x64|arm64}.tar.gz`를 설치하고 `chrome-sandbox`를 root 소유·4755로 설정한 뒤 일반 사용자로 `InstaDesk`를 실행합니다. 서명·자동 업데이트는 없습니다. 정확한 설치 과정은 [BUILD_GUIDE.md](BUILD_GUIDE.md)를 따르세요.

[GitHub Release v2.1.1](https://github.com/Yupkidangju/instadesk/releases/tag/v2.1.1)에 세 아카이브와 `SHA256SUMS.txt`를 게시합니다. [GitHub Actions 빌드](https://github.com/Yupkidangju/instadesk/actions/workflows/desktop.yml) 아티팩트는 릴리스와 별도의 CI 산출물입니다.

## 키와 연결

KEY VAULT에서 마스터 암호를 만들고 각자의 InstaBox API 키(`ibk_...`)를 등록합니다. 키는 앱 전용 `app://instadesk` 저장소에 AES-256-GCM으로 암호화되어 저장되고, 마스터 암호는 저장하지 않습니다. API 요청 시에만 복호화해 Electron 메인 프로세스가 `api.instabox.sh`로 직접 전달합니다. Cloudflare Worker나 GitHub Pages가 필요하지 않습니다. 키 검증에 실패해도 암호화된 프로필은 보존됩니다.

2.1.0에서 2.1.1로 업그레이드할 때 같은 암호화 프로필은 유지됩니다. 잠금 해제하면 기존 볼트가 새 KDF로 이행됩니다. 약한 기존 마스터 암호를 썼다면 KEY VAULT에서 15자 이상의 긴 암호문구로 변경하세요. 앱에서 사람이 입력하지 않으면 15분 후 잠기며 자동 조회는 시간을 연장하지 않습니다. PTY는 서버가 세션을 확인한 뒤 LIVE로 표시되고 일시 오류만 최대 3번 재연결합니다. Broadcast는 PTY 연결과 무관한 별도 SSE 실행입니다.

사용자 볼트는 설치/압축 해제 폴더가 아니라 OS 사용자별 `InstaDesk` 앱 데이터에 저장됩니다. 같은 사용자로 다른 버전의 ZIP을 열어도 등록된 키 프로필을 다시 입력할 필요가 없습니다. 다른 OS 계정이나 이전 GitHub Pages 저장소는 별도 공간입니다. 기존 볼트가 보이지 않으면 새 볼트를 초기화하기 전에 사용한 OS 계정과 실행 파일을 확인하세요.

이전 Pages 사이트의 볼트는 자동으로 옮기지 않습니다. 앱에서 키를 새로 등록하세요. 테스트용 데모는 키 없이 이용할 수 있습니다. 실 키로 VM 목록·PTY·데스크톱 스트림과 2.0.6 SPLIT 화면 맞춤을 확인했습니다. 검증 범위와 남은 조건은 아래 기록에 있습니다.

## 상태와 라이선스

전환 설계와 검증 범위는 [Electron 아키텍처](docs/electron/architecture.md)와 [검증 기록](docs/electron/verification.md)에 있습니다. 기존 감사 원본은 `docs/audit/`에 보존합니다. 이전 웹 빌드 안내는 [docs/legacy/](docs/legacy/)에 보관합니다.

Apache License 2.0. Copyright 2026 Yupkidangju <yupkidangju@gmail.com>. [LICENSE](LICENSE).
