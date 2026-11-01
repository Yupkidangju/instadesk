# Changelog

All notable changes to the InstaBox Deck project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.4] - 2026-11-01

### Fixed
- 이전 대시보드 호스트 배율을 상속한 SPLIT 스트림을 열 때 원격 뷰의 zoom factor를 1로 초기화합니다.

## [2.0.3] - 2026-11-01

### Fixed
- SPLIT의 실제 Desktop 스트림이 두 번 축소되지 않도록 네이티브 뷰의 zoom factor를 기본값으로 유지합니다.

## [2.0.2] - 2026-11-01

### Fixed
- 포터블 앱의 중복 인스턴스를 차단해 Chromium 볼트 저장소에 동시 접근하지 않도록 했습니다.
- Desktop 뷰 종료 시 창이 이미 파괴된 경우를 처리하고 포터블 패키지의 출력 디렉터리 링크를 거부합니다.

## [2.0.1] - 2026-11-01

### Fixed
- 실제 PTY 티켓의 서비스 서브프로토콜과 점이 포함된 토큰을 허용하고 선택한 세션을 URL 쿼리로 전달합니다.
- 대시보드가 iframe을 차단하는 Desktop 링크를 격리된 Electron `WebContentsView`의 최상위 문서로 표시합니다. 실행 중이 아닌 VM에는 재개 안내를 표시합니다.

## [2.0.0] - 2026-11-01

### Added
- Windows x64 Electron 포터블 앱과 `app://instadesk` 전용 Origin, 직접 InstaBox REST/SSE·PTY 연결, 제한된 preload 브리지를 추가했습니다.
- `InstaDesk.exe` 폴더와 ZIP을 만드는 패키징 명령을 추가했습니다.

### Changed
- 공개 웹 앱 계약을 데스크톱 앱 계약으로 변경하고, 키 볼트와 PTY 화면에서 Worker 설정을 제거했습니다.
- API 키는 전용 앱 Origin의 암호화 볼트에 저장하고 요청 때 Electron 메인 프로세스를 통해 고정 InstaBox 호스트로 전달합니다.

### Removed
- GitHub Pages 게시와 개인 Cloudflare Worker 경로를 종료합니다. 이전 감사·웹 빌드 기록은 보존합니다.

### Known limitations
- Windows 코드 서명·자동 업데이트와 유효한 실제 키의 REST/PTY/Desktop 통합 확인은 아직 없습니다.

## Web transition history (not separately released) - 2026-11-01

### Added
- 공개 사이트 방문자가 각자 배포할 수 있는 제한된 Cloudflare Worker 프록시 템플릿을 추가합니다. 공용 프록시는 제공하지 않습니다.
- 390px 이상 화면용 노드 서랍과 한 VM의 터미널·데스크톱 동시 SPLIT 화면을 추가했습니다. 구분선은 포인터·키보드로 조절하고 스트림은 화면비를 유지하며 맞춰 표시합니다.

### Changed
- 키 등록 중 네트워크/CORS 검증이 실패해도 암호화된 키를 자동 삭제하지 않고 연결 미검증으로 안내합니다.
- GitHub Pages 게시 소스를 GitHub Actions로 전환하고 빌드된 `dist/`를 배포했습니다. 공개 URL의 데모 화면과 자산 로드를 확인했습니다.
- 감사 3의 저장 스키마·프록시 PTY 경로·부분 동기화 계약을 맞추고 단일 타일을 전폭으로 표시합니다.
- 볼트 잠금 시 Broadcast 명령/출력을 지우고, 프로필 제거 전에 대상 확인을 요구하며 해당 프로필의 제어 채널만 종료합니다.
- 감사 1의 정적 배포 계약을 명확히 하고 Vite 자산 경로를 `/instadesk/`로 고정했습니다. 실제 API에는 허용된 Origin 또는 신뢰하는 HTTPS 프록시가 필요합니다.
- 로컬 볼트 잠금이 앱 소유 요청/PTY 연결을 종료하고 민감한 타일을 제거하도록 변경했습니다. PTY 예약 수는 프로필별로 계산합니다.
- 머신 페이지네이션, SSE 종료 처리, 터미널 재연결, 새 VM 대상 기본값을 수정했습니다.
- 신뢰 프록시 입력을 HTTPS origin으로 제한하고 키 공개 동의를 요구합니다. 전역 CORS를 수정하던 확장 규칙은 비활성화했습니다.
- Vite, Vitest와 React 플러그인을 보안 권고가 없는 호환 버전으로 갱신하고, GitHub Pages 빌드 워크플로와 Apache-2.0 라이선스를 추가했습니다.

### Known limitations
- 최종 Pages URL 및 허가된 실 API/PTY/SSE/Desktop 동작은 아직 검증되지 않았습니다. 외부 탭의 데스크톱 세션은 앱 잠금으로 취소할 수 없습니다.

## [1.0.0] - 2026-10-31

### Added
- **Core Architecture**: 100% Client-side Web App for managing multiple InstaBox microVMs with zero backend server.
- **E2EE Vault**: Web Crypto API based `AES-256-GCM` encryption and `PBKDF2` key derivation (100,000 iterations). Keys stored encrypted in `localStorage` and decrypted strictly on-demand during API consumption.
- **Neo-Swiss UI**: High-contrast modular grid layout, 1px sharp borders, Swiss Red (`#E53935`) functional accent, technical micro-indexing (`01_SYSTEM`, `02_NODES`, `03_WORKSPACE`).
- **Terminal Control**: `@xterm/xterm` PTY WebSocket dual connection with SSE streaming execution (`/v1/machines/{id}/exec`).
- **Desktop Stream & Control**: Embedded live desktop stream viewer (`POST /v1/machines/{id}/desktop/stream` iframe) with interactive takeover/handback mode.
- **Multi-View Workspace**: `1x1`, `2x1`, `2x2`, and Auto-Grid split workspace supporting simultaneous terminal and desktop panels.
- **Broadcast Execution**: Parallel command execution across selected active VMs with live stdout/stderr streams.
- **Zero-Server CORS Adapter**: Static Manifest V3 browser extension (`declarativeNetRequest`) and Vite development proxy for seamless `instabox.sh` API connectivity.
- **Demo Mode**: Built-in 4-node simulation environment for instant testing without real API credentials.
