# InstaDesk 2.0 구현 요약

2026-11-01 · Windows x64 Electron 포터블 앱. 기존 웹 구현 요약은 [보존본](docs/legacy/IMPLEMENTATION_SUMMARY.web-2026-11-01.md)에 있다.

## 구조

```text
InstaDesk.exe
└─ resources/app/
   ├─ dist/                  React, xterm, 스타일 번들
   ├─ dist-electron/         Electron main/preload 번들
   ├─ node_modules/ws/       PTY WebSocket 클라이언트
   └─ package.json
```

- `src/`: React UI, 로컬 Web Crypto 볼트, 머신 상태·REST/SSE 클라이언트. `src/services/instaboxClient.ts`는 `/instabox-api` 상대 경로만 사용한다.
- `electron/appProtocol.ts`: `app://instadesk` 정적 자산 경로 제한.
- `electron/apiGateway.ts`: `/instabox-api/v1/*`를 고정 `https://api.instabox.sh/v1/*`로 중계. 메서드·Bearer 형식·리다이렉트를 제한하고 SSE 본문을 스트리밍한다.
- `electron/terminalGateway.ts`: 허용 InstaBox WSS 티켓만 연결하고 PTY 입출력·크기 변경·프로필/전체 종료를 관리한다.
- `electron/preload.ts`와 `electron/main.ts`: 격리된 BrowserWindow 및 제한 IPC 브리지. 렌더러에 Node를 노출하지 않는다.
- `scripts/build-electron.mjs`, `scripts/package-win.mjs`: 타입 검사·Vite/esbuild 번들, Electron 공식 바이너리 포터블 패키지 생성.

## 데이터 흐름

마스터 암호 → 렌더러 Web Crypto 세션 키 → 앱 Origin localStorage의 암호화 프로필 → 요청 중 복호화 → app 프로토콜의 메인 HTTPS 호출. PTY는 REST 티켓 발급 후 제한 IPC로 메인 WebSocket을 열고 이벤트만 렌더러에 보낸다. 데스크톱 iframe은 발급된 URL을 사용하며 원격 프레임 정책은 별도 검증 대상이다.

빌드·검증은 [BUILD_GUIDE.md](BUILD_GUIDE.md)와 [Electron 검증 기록](docs/electron/verification.md)을 참조한다. 유효한 실 키 연결은 아직 HOLD다.
