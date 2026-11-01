# InstaDesk 빌드 및 실행

대상: Windows x64, Node.js 22.12 이상, npm. 저장소 루트에서 실행합니다.

```powershell
npm ci
npm run desktop:install
npm test
npm run typecheck
npm run desktop:dev
```

`desktop:dev`는 React·Electron을 빌드하고 네이티브 창을 엽니다. Vite 웹 개발 서버나 Cloudflare Worker는 사용하지 않습니다. `npm ci` 후 Electron 바이너리가 없으면 `desktop:install`로 공식 사전 빌드 바이너리를 받습니다.

## 포터블 ZIP

```powershell
npm run package:win
```

`release/InstaDesk-2.0.6-win-x64/`와 같은 이름의 ZIP이 생깁니다. 스크립트는 기존 같은 이름의 산출물을 덮어쓰지 않습니다. 버전을 변경하거나 기존 산출물을 별도로 보관한 뒤 다시 실행하세요. ZIP을 압축 해제해 `InstaDesk.exe`를 실행합니다. 사용자 볼트는 실행 폴더가 아닌 Windows의 앱 사용자 데이터 영역에 저장됩니다. 설치 프로그램, 코드 서명, 자동 업데이트는 포함되지 않습니다.

패키지는 Electron 공식 Windows x64 바이너리, `resources/app`의 번들된 렌더러·메인·preload, `ws`, 라이선스만 담습니다. `electron.exe`와 `electron_wer.dll`은 각각 `InstaDesk.exe`, `InstaDesk_wer.dll`로 이름을 맞춥니다. ZIP의 SHA-256 및 네이티브 스모크 결과는 [검증 기록](docs/electron/verification.md)을 참조하세요.

GitHub Actions의 `desktop.yml`은 `main` push 및 수동 실행 때 Windows x64에서 검사·패키징하고 ZIP을 실행 아티팩트로 업로드합니다. 아티팩트는 각 CI 실행에 속하며 코드 서명이나 공식 릴리스를 의미하지 않습니다.

## 사용

1. `InstaDesk.exe`를 열고 KEY VAULT에서 마스터 암호를 설정합니다.
2. InstaBox API 키를 등록합니다. 연결 확인이 실패해도 암호화된 키는 남습니다.
3. 머신 목록에서 TERM 또는 DESK를 엽니다. 데모는 키 없이 사용할 수 있습니다.
4. 종료 후 재실행하면 볼트는 잠긴 상태이며 마스터 암호를 다시 입력해야 합니다.

이전 웹 빌드와 Pages 절차는 [과거 가이드](docs/legacy/BUILD_GUIDE.web-2026-11-01.md)에 보관합니다. 이 버전은 Pages/Worker를 배포하지 않습니다.
