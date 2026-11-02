# InstaDesk 2.1.1 구현 요약

2026-11-01 · Windows x64·Linux x64·Linux arm64 Electron 포터블 앱. 기존 웹 구현 요약은 [보존본](docs/legacy/IMPLEMENTATION_SUMMARY.web-2026-11-01.md)에 있다.

## 구조

```text
InstaDesk.exe (Windows) / InstaDesk (Linux)
└─ resources/app/
   ├─ dist/                  React, xterm, 스타일 번들
   ├─ dist-electron/         Electron main/preload 번들
   ├─ node_modules/ws/       PTY WebSocket 클라이언트
   └─ package.json
```

- `src/`: React UI, 로컬 Web Crypto 볼트, 머신 상태·REST/SSE 클라이언트. `src/services/instaboxClient.ts`는 `/instabox-api` 상대 경로만 사용한다.
- `electron/appProtocol.ts`: `app://instadesk` 정적 자산 경로 제한.
- `electron/userDataPath.ts`·`electron/main.ts`: Electron `userData`·`sessionData`를 버전 없는 `InstaDesk` 사용자 경로로 고정한다.
- `electron/apiGateway.ts`: `/instabox-api/v1/*`를 고정 `https://api.instabox.sh/v1/*`로 중계. 메서드·Bearer 형식·리다이렉트를 제한하고 SSE 본문을 스트리밍한다.
- `electron/terminalGateway.ts`: 허용 InstaBox WSS 티켓만 연결하고 서버 `session` 준비·거절·close code를 분류한다. 준비 전 입력을 거부하고 PTY 입출력·프로필/전체 종료를 관리한다.
- `electron/preload.ts`와 `electron/main.ts`: 격리된 BrowserWindow 및 제한 IPC 브리지. 렌더러에 Node를 노출하지 않는다.
- `scripts/build-electron.mjs`, `scripts/package-win.mjs`, `scripts/package-linux.mjs`: 타입 검사·Vite/esbuild 번들, 각 네이티브 아키텍처의 Electron 공식 바이너리 포터블 패키지 생성.
- `.github/workflows/desktop.yml`: 세 아키텍처 타입·테스트·감사·패키지 로드 게이트와 버전 태그 Release 게시.

## 데이터 흐름

마스터 암호 → 렌더러 Web Crypto 세션 키 → 앱 Origin localStorage의 암호화 프로필 → 요청 중 복호화 → app 프로토콜의 메인 HTTPS 호출. PTY는 REST 티켓 발급 후 제한 IPC로 메인 WebSocket을 열고 이벤트만 렌더러에 보낸다. 데스크톱은 발급된 URL을 격리된 최상위 `WebContentsView`에 열며 메인 프로세스가 URL과 좌표를 검증한다.

빌드·검증은 [BUILD_GUIDE.md](BUILD_GUIDE.md)와 [Electron 검증 기록](docs/electron/verification.md)을 참조한다. 실 키의 목록·PTY·Desktop 화면 맞춤을 확인했다. 변경 API·SSE·Desktop 입력은 미검증이다.

감사 4의 변경은 [수정 계약](docs/electron/audit_4_remediation.md)과 [finding별 결과](docs/audit/audit_report_4_remediation.md)를 기준으로 한다. `cryptoVault.ts`는 v1→v2 이행·암호문구 변경·사용자 입력 기준 잠금을 담당한다. `TerminalView.tsx`는 준비 신호 뒤 LIVE 표시와 한정 재시도를 담당한다. `ApiKeyModal.tsx`와 `MasterUnlockModal.tsx`는 비밀 입력을 닫기·잠금·실패 후 지운다.
자동 조회의 `lastUsedAt` 쓰기는 최신 볼트 레코드에 병합해 새 프로필을 잃는 경합을 막는다. v1→v2 및 v2의 키 프로필 5개 보존을 회귀 테스트로 확인한다.
