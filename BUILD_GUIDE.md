# InstaBox Deck Build & Execution Guide

**Document Version:** 1.1.0 (Audit 1 remediation)  
**Target Environment:** Node.js 22.12+ (Vite 8 requirement)  

---

## 1. 사전 요구사항 (Prerequisites)

- **Node.js**: v22.12.0 이상
- **패키지 매니저**: `npm` v9+ 또는 `pnpm` / `bun`
- **브라우저**: Chrome, Edge, Brave, Firefox, Safari (Web Crypto API를 지원하는 모든 최신 브라우저)

---

## 2. 의존성 설치 및 로컬 개발 서버 실행

```bash
# 1. 작업 디렉터리로 이동
cd D:\web\instadesk

# 2. 패키지 설치
npm ci

# 3. 개발 서버 실행 (Vite 로컬 CORS 프록시 자동 가동)
npm run dev
```
개발 서버는 `http://127.0.0.1:5173/instadesk/`를 표시합니다. `localhost:5173`에서도 앱을 열면 같은 `/instabox-api/*` 및 `/instabox-connect/*` 개발 프록시를 선택합니다. 이는 개발 편의 경로이며 실제 인증/PTY/Desktop 호환성은 허가된 키로 별도 확인해야 합니다.

---

## 3. 프로덕션 정적 빌드 및 배포

정적 호스팅만으로 데모 모드가 동작합니다. 실제 API 기능은 배포 Origin에 대한 서비스의 CORS 허용 또는 사용자가 신뢰하는 HTTPS 역방향 프록시가 필요합니다. 프록시는 평문 Bearer 키, 명령 및 응답을 볼 수 있습니다. 대상은 `Yupkidangju/instadesk` 프로젝트 사이트입니다.

```bash
# 타입 체크 및 프로덕션 빌드
npm run build

# 빌드 결과물 미리보기
npm run preview
```
GitHub Pages는 저장소의 Pages 설정에서 GitHub Actions를 소스로 선택합니다. `.github/workflows/pages.yml`은 push 때 빌드와 검사를 실행하며, 실제 배포는 사용자가 수동 실행(`workflow_dispatch`)할 때만 시도합니다. Vite 자산 경로는 `/instadesk/`입니다. `dist/`에 확장 프로그램은 포함되지 않습니다. 실제 URL에서 자산과 네트워크 요청을 다시 확인해야 합니다.

2026-11-01에 Pages 게시 소스를 `main /` 직접 게시에서 GitHub Actions(`build_type: workflow`)로 바꾸고 수동 배포 [실행 41224589610](https://github.com/Yupkidangju/instadesk/actions/runs/41224589610)을 완료했습니다. 현재 [공개 URL](https://yupkidangju.github.io/instadesk/)의 빌드 JS/CSS와 데모 화면이 확인됐습니다. 브라우저가 이전 소스 HTML을 최대 10분 캐시했을 수 있으므로 빈 화면이 계속 보이면 강력 새로고침(Ctrl+Shift+R) 또는 시크릿 창에서 열어 보세요. 배포 증거는 `docs/audit/pages_deployment_2026-11-01.md`에 있습니다.

---

## 4. 실제 API 연결 조건

현재 `extension/`의 전역 헤더 변조 규칙은 보안상 비활성화했습니다. 설치해도 API 연결 기능을 제공하지 않습니다. 실제 연결에는 upstream Origin 허용 또는 신뢰하는 HTTPS 프록시가 필요합니다. 프록시는 `/instabox-api/*`를 `https://api.instabox.sh/*`로, `/instabox-connect/*`를 `https://connect.instabox.sh/*`로 중계하고 두 경로의 WebSocket 업그레이드를 지원해야 합니다. 운영 프록시의 실 동작은 아직 검증되지 않았습니다.

공개 사이트 방문자는 각자 [개인 Worker 배포 가이드](worker/README.md)에 따라 **자기 Cloudflare 계정**에 프록시를 배포하고, 앱의 KEY VAULT에서 그 Worker의 HTTPS origin을 적용합니다. 앱에는 공용 Worker 주소가 없습니다. API 키는 Worker에 설정하지 않습니다. Worker 운영자는 요청 중 평문 키를 처리하므로 자신이 운영하거나 명시적으로 신뢰하는 Worker만 사용하세요. 네트워크 오류가 나더라도 암호화된 키는 자동 삭제되지 않으며, 프록시 적용 후 새로고침으로 다시 확인할 수 있습니다.

최종 Pages URL에서 허가된 테스트 키로 REST GET/변경, SSE, PTY WebSocket, Desktop 및 잠금/재연결을 별도로 검증해야 합니다. 외부 탭에서 연 Desktop은 앱에서 원격으로 취소할 수 없습니다.

---

## 5. 테스트 실행

```bash
# 전체 단위 및 통합 테스트 실행 (Vitest)
npm run test

# 감시 모드로 테스트 실행
npm run test:watch
```

---

## 6. 사용 시작 가이드 (Getting Started)

1. 앱에 처음 접속하면 **[CREATE MASTER PASSWORD]** 안내가 나타납니다.
2. API 키를 암호화하여 로컬에 보관할 강력한 마스터 비밀번호(최소 6자)를 입력합니다.
3. **[KEY VAULT]** 모달에서 `instabox.sh` API 키(`ibk_...`)를 등록하거나, **[ACTIVATE DEMO MODE]**를 눌러 시뮬레이션 머신 4대로 즉시 기능을 체험할 수 있습니다.
4. 사이드바에서 원하는 VM의 **[TERM]** 또는 **[DESK]** 버튼을 누르면 워크스페이스 타일에 실시간 터미널과 데스크톱 화면이 즉시 열립니다.
5. 상단 바에서 `[1x1]`, `[2x1]`, `[2x2]` 버튼을 눌러 멀티 관제 뷰로 화면을 자유롭게 분할할 수 있습니다.
