# InstaBox Deck Implementation Summary

**Document Version:** 1.0.0  
**Target:** Static client app with encrypted local vault and Neo-Swiss UI; real API connectivity requires an approved CORS path  

---

## 1. 시스템 구조 및 디렉터리 맵

```
D:/web/instadesk/
├── spec.md                          # 마스터 명세서
├── designs.md                       # 네오스위스 디자인 시스템
├── IMPLEMENTATION_SUMMARY.md        # 본 구현 요약서
├── DESIGN_DECISIONS.md              # 설계 결정 및 대안 비교
├── BUILD_GUIDE.md                   # 빌드 및 실행 가이드
├── audit_roadmap.md                 # 단계별 검증 및 감사 체크포인트
├── CHANGELOG.md                     # 변경 이력
├── package.json                     # 의존성 및 스크립트
├── vite.config.ts                   # Vite 빌드 및 로컬 프록시 설정
├── tsconfig.json                    # TS 엄격 모드 설정
├── tailwind.config.js               # 네오스위스 스타일 토큰 설정
├── postcss.config.js                # Tailwind PostCSS
├── index.html                       # SPA 진입점
├── extension/                       # 비활성 참고용 MV3 패키지
│   ├── manifest.json                # 요청 규칙 비활성
│   ├── rules.json                   # 빈 규칙 목록
│   └── README.md                    # 브라우저 확장 로드 설명서
├── src/
│   ├── main.tsx                     # React 18 진입점
│   ├── App.tsx                      # 메인 레이아웃 및 볼트 상태 가드
│   ├── index.css                    # 네오스위스 글로벌 스타일 및 폰트
│   ├── types/
│   │   ├── instabox.ts              # InstaBox 머신, 연산, 데스크톱, 터미널 타입
│   │   └── vault.ts                 # 로컬 암호화 볼트 스키마 및 프로필 타입
│   ├── services/
│   │   ├── cryptoVault.ts           # Web Crypto AES-256-GCM + PBKDF2 암호화 엔진
│   │   └── instaboxClient.ts        # InstaBox REST, SSE, WS PTY, Iframe 클라이언트
│   ├── store/
│   │   └── useAppStore.ts           # 볼트, 머신, 타일, 쿼터 전역 상태 (Zustand)
│   └── components/
│       ├── HeaderBar.tsx            # 네오스위스 상단 바 (시스템, 볼트, 쿼터, 레이아웃)
│       ├── SidebarVmList.tsx        # 노드 인벤토리 사이드바 및 필터/전원 제어
│       ├── WorkspaceGrid.tsx        # 멀티 타일 분할 그리드 컨테이너
│       ├── VmTilePane.tsx           # 개별 타일 헤더 및 탭 스위처
│       ├── SplitWorkspaceView.tsx   # 터미널/데스크톱 조절 구분선
│       ├── terminal/
│       │   ├── TerminalView.tsx     # xterm.js PTY WebSocket 인터랙티브 셸
│       │   └── ExecRunnerView.tsx   # SSE 스트리밍 명령 실행 뷰
│       ├── desktop/
│       │   ├── DesktopScreenView.tsx # Stream Iframe 뷰어 및 Takeover/Handback 제어
│       │   └── fitDesktop.ts        # 화면비 유지 맞춤 계산
│       ├── telemetry/
│       │   ├── MetricsLogsView.tsx  # 시리얼 콘솔 로그 및 30초 메트릭 뷰
│       │   └── ProcessListView.tsx  # ps -e 프로세스 테이블
│       └── modals/
│           ├── ApiKeyModal.tsx      # 마스터 패스워드 설정 및 암호화 키 프로필 관리
│           ├── MasterUnlockModal.tsx # 소비 시점 볼트 잠금 해제 팝업
│           ├── BroadcastExecModal.tsx # 복수 VM 일괄 명령 전송 모달
│           └── CreateVmModal.tsx    # 신규 VM 프로비저닝 모달
└── test/
    ├── cryptoVault.test.ts          # 로컬 암호화/복호화 및 패스워드 검증 테스트
    ├── instaboxClient.test.ts       # API 클라이언트 및 SSE 파서 단위 테스트
    ├── audit3Store.test.ts          # 부분 동기화·프로필 삭제 회귀
    ├── audit3Ui.test.tsx            # Broadcast 잠금·삭제 확인 회귀
    ├── splitWorkspace.test.tsx      # 구분선·화면비 계산 회귀
    └── useAppStore.test.ts          # 스토어 상태 전이 및 쿼터 계산 테스트
```

---

## 2. 모듈별 책임 및 인터페이스 계약

| 모듈 | 파일 | 핵심 책임 |
|---|---|---|
| **Crypto Vault** | `src/services/cryptoVault.ts` | 마스터 비밀번호 PBKDF2(100,000 iterations) 키 파생, AES-256-GCM 암호화/복호화, `localStorage` 안전 저장, `withDecryptedKey`를 통한 소비 시점 복호화 보장 |
| **InstaBox Client** | `src/services/instaboxClient.ts` | `https://api.instabox.sh` REST API 통신, `Idempotency-Key` 및 `X-Confirm-Delete` 자동 주입, `POST /v1/machines/{id}/exec` SSE 스트림 처리, `desktop/stream` Iframe URL 획득, 시뮬레이션 Mock 모드 |
| **App Store** | `src/store/useAppStore.ts` | 볼트·타일, 프로필별 부분 갱신과 최신 세대 적용, 프로필별 PTY 예약 최대 8개 감시 |
| **Terminal View** | `src/components/terminal/TerminalView.tsx` | `@xterm/xterm` 초기화, WebSocket 연결 및 binary/JSON 프레임 송수신, 리사이즈 이벤트 동기화 |
| **Desktop View** | `src/components/desktop/DesktopScreenView.tsx` | `POST /v1/machines/{id}/desktop/stream` 서명 링크 생성, `iframe` 임베딩, `viewOnly: false` + `takeover` 제어권 획득 |
| **API 연결 경계** | `src/services/instaboxClient.ts` | 서비스의 CORS 허용 또는 사용자가 신뢰하는 HTTPS 프록시 필요; 확장 프로그램 규칙 비활성 |
| **Split View** | `src/components/SplitWorkspaceView.tsx`, `src/components/desktop/fitDesktop.ts` | PTY와 Desktop 동시 배치, 포인터/키보드 비율 조절, iframe 화면비 맞춤 |

## Audit 3 수정 상태 (2026-11-01)

- 저장소 스키마를 실제 `src/types/vault.ts`와 일치시켰다. 390px 이상 반응형 화면은 1024px 미만 노드 서랍, 1280px 미만 여러 타일 세로 배치, 단일 타일 전폭을 사용한다.
- 프로필별 네트워크 중단과 부분 머신 갱신, 중복 갱신 세대 처리, 삭제 대상 확인, 잠금 시 Broadcast 초기화를 추가했다. 서로 다른 프로필의 동일 머신 ID는 Broadcast에서 복합키로 식별한다.
- 개발 루프백과 신뢰 프록시의 API/Connect 경로를 분리했다. 허가된 실제 프록시·WebSocket 핸드셰이크는 미검증이다.
- SPLIT 뷰의 조절 구분선과 Desktop 화면비 맞춤을 추가했다. 사용한 회귀·브라우저 증거와 잔여 HOLD 조건은 `docs/audit/remediation_results_3.md`에 기록한다.

## Pages 배포 확인 (2026-11-01)

Pages가 `main /`의 개발용 HTML을 직접 제공해 빈 화면이 나왔다. GitHub Pages 게시 소스를 Actions로 변경하고 기존 수동 배포 워크플로가 생성한 `dist/` artifact를 배포했다. 공개 URL의 빌드 자산과 데모 VM 4대 렌더링을 확인했다. 상세 증거는 `docs/audit/pages_deployment_2026-11-01.md`; 실 API 연결은 미검증이다.

## 개인 Worker 연결 경로 (2026-11-01)

- `worker/src/proxy.ts`는 `/instabox-api/v1/*`와 `/instabox-connect/*`를 두 고정 업스트림으로만 전달한다. Pages Origin, preflight, Bearer 헤더, 리다이렉트 거부, SSE 본문 스트리밍 및 WebSocket 업그레이드를 분리한다. Worker에는 키 저장소가 없다.
- `worker/wrangler.jsonc`는 사용자별 Cloudflare 계정 배포용 템플릿이다. 앱에 공용 Worker URL을 내장하지 않는다. `GET /health`의 템플릿 식별자와 Origin을 키 전송 전에 확인한다.
- KEY VAULT는 연결 확인 실패 때 암호화된 프로필을 보존하고 미검증 상태를 안내한다. 개인 Worker 배포와 공개 Pages 브라우저의 `/health`·가짜 키 401 경로는 확인했다. 유효한 키로 REST·SSE·PTY·Desktop을 검증하기 전에는 기능 완료를 주장하지 않는다. 상세 증거는 `docs/audit/api_connectivity_results_2026-11-01.md`에 기록한다.

## Audit 1 수정 상태 (2026-11-01)

- `spec.md`와 `DESIGN_DECISIONS.md`의 정적 배포/보안 계약을 우선 수정했다. `BUILD_GUIDE.md`와 `README.md`에 `/instadesk/` 프로젝트 사이트, 수동 Pages 배포, 실 API 검증 필요성을 기록했다.
- `useAppStore`는 프로필별 PTY 연결 예약을 관리한다. 볼트 잠금은 진행 중 API 요청과 앱 소유 PTY 소켓을 중단하고 실제 프로필 타일을 제거한다. `TerminalView`는 명시적 재시도 때 소켓을 다시 만든다.
- `instaboxClient`는 머신 커서를 최대 100페이지까지 따라가며 반복 커서를 거부한다. SSE 파서는 CRLF/청크 경계/여러 data 줄/EOF를 처리한다. 임의 WebSocket 티켓 호스트는 거부한다.
- 프록시 설정은 HTTPS origin만 수락하고 사용자의 신뢰 확인을 요구한다. 비활성 확장 규칙은 `extension/rules.json`에 빈 목록으로 남겼다.
- 실 서비스와 외부 탭 Desktop 세션에 대한 서버 측 취소는 구현·검증되지 않았다. 최종 Pages URL과 허가된 키가 준비되면 별도 검증이 필요하다. 상세 실행 결과는 `docs/audit/audit_report_2.md`에 기록한다.

---

## 3. 권장 구현 순서

1. **Step 1: 환경 설정 및 문서 세트 확정**
   - `spec.md`, `designs.md`, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`, `audit_roadmap.md`, `CHANGELOG.md` 완료.
   - `package.json`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` 구성 및 의존성 설치.
2. **Step 2: 로컬 암호화 보안 볼트 (`cryptoVault.ts`) 구현 및 단위 테스트**
   - Web Crypto 기반 암호화, 복호화, 로컬스토리지 저장/불러오기, 소비 시점 래퍼 구현 및 vitest 테스트 통과.
3. **Step 3: InstaBox API 클라이언트 및 Mock 시뮬레이터 (`instaboxClient.ts`) 구현**
   - 머신 목록, 전원 제어, SSE Exec 스트리밍, 데스크톱 스트림 링크 발급, WebSocket URL 생성 및 테스트.
4. **Step 4: 전역 스토어 (`useAppStore.ts`) 및 네오스위스 스타일 기본 골격 구축**
   - 볼트 잠금/해제 상태, 멀티 타일 그리드 레이아웃, 머신 목록 동기화.
5. **Step 5: 네오스위스 UI 컴포넌트 구현**
   - `HeaderBar`, `SidebarVmList`, `WorkspaceGrid`, `VmTilePane`, `TerminalView`, `DesktopScreenView`, `ApiKeyModal`, `BroadcastExecModal`.
6. **Step 6: 배포 연결 경계 검증**
   - 최종 Pages Origin에서 허가된 테스트 키로 REST/SSE/PTY/Desktop 검증 필요. 확장 프로그램은 미지원.
7. **Step 7: 자동화 테스트 및 프로덕션 빌드 검증**
   - `npm run test`, `npm run typecheck`, `npm run build`.
