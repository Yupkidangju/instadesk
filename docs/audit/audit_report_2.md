# InstaBox Deck Audit 1 수정 재검증 기록

2026-11-01 (Asia/Seoul) · 기준: `audit_report_1.md` · 작성 범위: 코더의 수정 및 로컬 재검증. **독립 감사 PASS가 아니다. 최종 판정은 HOLD.** 원본 보고서는 변경하지 않았다.

## 범위와 계약

`spec.md`, `DESIGN_DECISIONS.md`, `designs.md`, `BUILD_GUIDE.md`의 배포·잠금·세션·프록시 계약을 구현 전에 수정하고 `README.md`, `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`를 동기화했다. 정적 사이트는 데모 기능을 제공한다. 실제 API 기능은 서비스의 배포 Origin 허용 또는 사용자가 신뢰하는 HTTPS 프록시가 필요하다. 프록시가 받는 평문 Bearer 키를 UI에 명시했다. 전역 CORS 확장 규칙은 비활성화했다.

## 원본 finding ID별 결과

| ID | 로컬 결과 | 증거와 남은 확인 |
| --- | --- | --- |
| IMP-F001 | 계약 수정, 실 API HOLD | `spec.md`, `BUILD_GUIDE.md`, `README.md`에 CORS 경계를 명시. 허가된 키와 최종 Pages URL이 없어 REST/PTY/Desktop 실 연결 미검증. |
| IMP-F002 | 앱 소유 PTY 계수 수정 | `useAppStore.ts`, `TerminalView.tsx`, `HeaderBar.tsx`: 프로필별 연결 예약/열림/닫힘, 8→9 차단, 타일과 비연결 탭 제외. `auditRemediation.test.ts`의 예약/해제/잠금 테스트. 외부/데스크톱 서버 세션과 실제 429는 미검증. |
| IMP-F003 | 수정 확인 | `instaboxClient.ts`: 최대 100페이지, URL 인코딩, 반복/잘못된 커서 거부. 2페이지 및 반복 커서 테스트. |
| IMP-F004 | 문서 복구 | React 18, 없는 스크린샷 파일, 작업 경로, 확장·정적 배포 주장과 iframe 미검증 상태를 문서에서 바로잡음. |
| DBG-F001 | 로컬 경로 확인 | `vite.config.ts`의 `/instadesk/` base. 빌드 HTML이 `/instadesk/assets/`를 참조하고 로컬 preview에서 HTML/JS/CSS 모두 HTTP 200. 실제 Pages URL은 미확인. |
| DBG-F002 | 로컬 준비 | Git `main` 초기화, `.gitignore`, Pages Actions 워크플로, README/라이선스 추가. 워크플로는 push 때 검사·빌드하며 배포는 수동 실행으로 제한. 원격 Actions 및 Pages 설정은 아직 미검증. |
| DBG-F003 | 수정 확인 | Vite 8.3.5, Vitest 5.0.5, React 플러그인 6.1.2로 잠금 파일 갱신. 깨끗한 `npm ci`와 `npm audit` 개발·프로덕션 모두 0건. |
| DBG-F004 | 수정 확인 | SSE CRLF, 청크 분할, 여러 data 줄, EOF, 잘못된 exit, abort 처리. `auditRemediation.test.ts`; 데모 exec 취소도 검증. 실 서비스 SSE는 미검증. |
| DBG-F005 | 수정 확인 | `CreateVmModal.tsx`는 열릴 때 등록된 실제 프로필을 기본 대상으로 선택하고 데모는 활성화 시에만 노출. 컴포넌트 테스트. |
| DBG-F006 | 수정 확인 | 재연결 세대 증가로 같은 세션 이름에서도 새 WebSocket 생성. `terminalReconnect.test.tsx`. |
| SEC-F001 | 앱 경계 수정, 실 서비스 HOLD | 잠금 구독에서 요청 abort, PTY 소켓 close, 실제 프로필 타일과 출력/iframe 언마운트. 수동·자동 잠금 테스트. 외부 탭 뷰어와 서버 측 세션 취소는 앱에서 보장할 수 없고 실 연결 검증이 남음. |
| SEC-F002 | 로컬 경계 수정 | HTTPS origin만 허용하고 경로·계정정보·쿼리·fragment 거부. UI에서 프록시 운영자에게 키가 공개됨을 알리고 동의 확인. REST 및 티켓 WS 라우팅 테스트. 실제 프록시 신뢰/호환성은 미검증. |
| SEC-F003 | 광역 규칙 제거 | `extension/rules.json`은 `[]`, manifest에는 권한과 DNR 등록이 없음. 확장 자체는 지원되는 연결 수단으로 주장하지 않음. |

교차 finding: XPF-F001은 정적 데모/조건부 실 API 계약과 Pages base·워크플로로 정리했으나 실제 연결은 HOLD. XPF-F002는 앱 소유 채널의 잠금 종료로 수정했으나 외부 탭/서버 취소는 HOLD. XPF-F003의 서비스 API·iframe·브라우저 호환성은 여전히 실증이 필요하다.

## 실행한 검증

- `npm ci --no-fund`: 종료 코드 0, 199개 패키지 설치, 권고 0건.
- `npm run typecheck`: 종료 코드 0.
- `npm test`: 종료 코드 0, 7개 파일/24개 테스트 통과. jsdom Canvas 기능 감지 경고는 테스트 설정에서 제거했다.
- `npm run build`: 종료 코드 0, Vite 8.3.5, JS 약 532.84 kB. 500 kB 청크 크기 경고는 남는다.
- `npm audit --json` 및 `npm audit --omit=dev --json`: 각각 0건.
- `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`: `/instadesk/` HTML 200, JS/CSS 자산 각각 200. 로컬 프리뷰만 확인했으며 Pages 배포 증거가 아니다.
- `extension/manifest.json`과 `extension/rules.json`을 다시 읽어 권한·활성 규칙이 없음을 확인.

## 제외와 출고 조건

허가된 실 API 키, 운영 프록시, 최종 GitHub Pages URL이 없어 인증 GET/변경, SSE, 실제 PTY/데스크톱, 다른 Origin과의 비교, 모바일/접근성, 실제 서버 429를 실행하지 못했다. GitHub Actions 원격 실행 결과도 아직 없다. 최종 Pages Origin에서 자산 네트워크와 허가된 키를 사용한 실 기능 및 잠금/외부 탭 시나리오를 확인하기 전에는 제품 PASS로 판정하지 않는다.

공식 배포 근거: [Vite 정적 배포 안내](https://v6.vite.dev/guide/static-deploy), [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Chrome DNR initiator 조건](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
