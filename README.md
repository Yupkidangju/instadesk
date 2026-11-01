# InstaDesk

Windows x64에서 InstaBox VM을 여러 화면으로 관리하는 Electron 앱입니다. VM 목록, PTY 터미널, 명령 실행, 데스크톱 스트림, 데모 모드를 제공합니다. 터미널과 스트림의 구분선을 드래그하거나 화살표 키로 조절할 수 있으며 스트림은 화면비를 유지합니다.

## 다운로드 및 실행

`npm run package:win`으로 생성한 `release/InstaDesk-2.0.4-win-x64.zip`을 원하는 폴더에 압축 해제하고 `InstaDesk.exe`를 실행합니다. Windows x64용 포터블 패키지이며 서명·자동 업데이트는 없습니다. 자세한 과정은 [BUILD_GUIDE.md](BUILD_GUIDE.md)를 따르세요.

[GitHub Actions Windows 빌드](https://github.com/Yupkidangju/instadesk/actions/workflows/desktop.yml)의 최신 `InstaDesk-win-x64` 아티팩트에서도 ZIP을 받을 수 있습니다.

## 키와 연결

KEY VAULT에서 마스터 암호를 만들고 각자의 InstaBox API 키(`ibk_...`)를 등록합니다. 키는 앱 전용 `app://instadesk` 저장소에 AES-256-GCM으로 암호화되어 저장되고, 마스터 암호는 저장하지 않습니다. API 요청 시에만 복호화해 Electron 메인 프로세스가 `api.instabox.sh`로 직접 전달합니다. Cloudflare Worker나 GitHub Pages가 필요하지 않습니다. 키 검증에 실패해도 암호화된 프로필은 보존됩니다.

이전 Pages 사이트의 볼트는 자동으로 옮기지 않습니다. 앱에서 키를 새로 등록하세요. 테스트용 데모는 키 없이 이용할 수 있습니다. 실 키로 VM 목록·PTY·데스크톱 스트림을 확인했고, 2.0.4의 SPLIT 화면 확대는 재검증 중입니다.

## 상태와 라이선스

전환 설계와 검증 범위는 [Electron 아키텍처](docs/electron/architecture.md)와 [검증 기록](docs/electron/verification.md)에 있습니다. 기존 감사 원본은 `docs/audit/`에 보존합니다. 이전 웹 빌드 안내는 [docs/legacy/](docs/legacy/)에 보관합니다.

Apache License 2.0. Copyright 2026 Yupkidangju <yupkidangju@gmail.com>. [LICENSE](LICENSE).
