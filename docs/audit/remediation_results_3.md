# Audit 3 수정 및 재검증 기록

2026-11-01 (Asia/Seoul) · 역할: 코딩 세션의 수정자 자체 검증 · 기준: `audit_report_3.md`. **독립 재감사 PASS가 아니다. 제품/배포 판정은 HOLD.** `audit_report_1.md`, `audit_report_2.md`, `audit_report_3.md`와 `evidence_3/`은 변경하지 않았다.

## 계약과 변경

구현 전에 `remediation_plan_3.md`, `spec.md`, `designs.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`에 최소 390px, 노드 서랍, SPLIT 뷰, 화면비 맞춤, 프로필별 부분 동기화·삭제, API/Connect 프록시 경로를 명시했다. 이후 `README.md`, `IMPLEMENTATION_SUMMARY.md`, `CHANGELOG.md`, `audit_roadmap.md`를 동기화했다.

| Finding ID | 이번 수정·검증 | 아직 확인할 사항 |
| --- | --- | --- |
| IMP-F001 | 정적 데모와 실 API의 조건부 계약 유지. | Pages Origin 및 허가된 실 API 연결은 HOLD. |
| IMP-F002 | 프로필별 PTY 예약/해제 경로를 기존 회귀 테스트로 재확인. | 실제 서버 8→9 및 외부/데스크톱 세션은 미검증. |
| IMP-F003 | 페이지 커서 순회·반복 방지를 기존 회귀 테스트로 재확인. | 실 API 응답 형식 미검증. |
| IMP-F004 | `spec.md`의 `encryptedData`, `verifierCiphertext`, `verifierIv`를 실제 타입/저장 형식에 일치시키고 `designs.md`의 E2EE 표시를 로컬 볼트로 수정. | 실 브라우저 저장소 접근 범위는 origin 단위임을 문서화했으며 추가 격리는 제공하지 않음. |
| IMP-F005 | 390px 이상에서 NODES 서랍, 헤더 줄바꿈, 단일 타일 전폭, 좁은 타일 세로 배치를 구현. 390px Exec 입력/RUN, 390/768/1280px SPLIT 및 화면 가로 넘침 없음 확인. | Safari/Firefox, 키보드/스크린리더 전수 검사는 미실행. |
| IMP-F006 | 프록시 REST/SSE/티켓은 `/instabox-api`, API 호스트 WS는 `/instabox-api`, Connect 호스트 WS는 `/instabox-connect`로 명시·구현·테스트. 알 수 없는 티켓 호스트는 거부. | 허가된 실 티켓과 운영 프록시의 WebSocket 업그레이드 미검증. |
| DBG-F001 | `/instadesk/` 빌드 자산 경로 및 로컬 preview HTTP 200 재확인. | 실제 Pages URL은 404. |
| DBG-F002 | 기존 Git/Actions 설정은 유지하고 소스·감사 증거를 검토. | 이 문서의 검사 범위는 로컬이며, 이번 변경의 원격 CI 결과는 푸시 뒤 별도 확인해야 함. |
| DBG-F003 | 깨끗한 설치 후 전체 `npm audit` 0건. | 없음(이번 잠금 파일 기준). |
| DBG-F004 | 모의 SSE CRLF·EOF·오류 회귀 테스트 재통과. | 실 서비스 장시간 스트림 미검증. |
| DBG-F005 | Create VM 대상 선택 회귀 테스트 재통과. | 실 VM 생성 미실행. |
| DBG-F006 | 같은 세션 재연결 시 새 소켓 생성 회귀 테스트 재통과. | 실 PTY 재연결 미검증. |
| DBG-F007 | GitHub Pages API와 예상 사이트 URL이 현재 404임을 읽기 전용으로 재확인. | 사용자가 Pages 설정/수동 배포를 시도하기로 한 이전 지시를 유지. 실제 URL 검증 전 HOLD. |
| DBG-F008 | `127.0.0.1`과 `localhost`를 같은 개발 프록시로 판정. 두 주소의 브라우저에서 모의 API 키·모의 응답으로 GET 목적지가 각각 `http://<host>:5173/instabox-api/v1/machines`임을 확인. | 실제 InstaBox 인증/CORS 동작은 검증하지 않음. |
| DBG-F009 | `Promise.allSettled`로 프로필별 성공·실패와 데모를 합치고 실패 프로필의 오래된 목록은 제거. 프로필 오류를 노드 목록에 표시하며 갱신 세대로 늦은 응답을 거부. 부분 실패·역순 완료 테스트. | 실제 네트워크 장애/다중 계정 운영 검증 미실행. |
| DBG-F010 | 삭제 전 이름·ID·복구 불가를 보여주는 확인/취소 UI와 잠금 해제 요구. 취소 후 보존, 선택한 대상만 삭제하는 테스트. | 로컬 키 삭제는 의도대로 복구 불가. |
| SEC-F001 | 수동·자동 잠금 시 Broadcast 실행 abort, 명령·출력 초기화, 모달 닫기; 재열기 테스트. 기존 실 타일/PTY 종료 테스트도 재통과. | 외부 탭/서버 티켓의 원격 무효화는 보장하지 않음. |
| SEC-F002 | HTTPS origin 동의 경계 유지, 프록시의 두 WS 호스트별 경로와 거부 테스트 추가. | 실제 프록시 소유권·전송·핸드셰이크 미검증. |
| SEC-F003 | 비활성 확장 규칙·권한 계약 유지. | 확장은 지원 경로가 아님. |
| SEC-F004 | 삭제 대상 프로필의 요청·소켓·타일·예약만 종료하고 다른 프로필은 유지. 선택적 abort/소켓 종료 테스트. | 서버 발급 티켓과 외부 탭 취소 가능 여부 미확인. |

교차 finding: XPF-F001은 정적 데모와 실 API의 배포 게이트를 분리했지만 Pages/실 API는 HOLD다. XPF-F002의 앱 소유 잠금·삭제 경계는 회귀 테스트로 확인했지만 서버/외부 탭은 미확인이다. XPF-F003의 프록시 경로 계약은 문서·모의 테스트에서 일치하지만 실 서비스 계약 확인이 필요하다.

## 사용자 추가 요청: 터미널·스트림 구분선

`SPLIT` 탭에서 한 VM의 터미널과 데스크톱을 동시에 열 수 있다. 타일 가용 폭 700px 이상에서는 좌우 25~75% 구분선을 포인터 또는 화살표 키로 조절하고, 좁은 타일은 상하로 전환한다. 실제 iframe은 원본 논리 해상도를 유지한 채 가용 공간에 맞게 축소/확대하고 데모 화면은 같은 비율 안에서 읽을 수 있게 배치했다. 단위 테스트는 1280×800 원본의 600×400/300×500 맞춤과 구분선 경계를 검증한다. 실제 서비스 iframe 내부의 반응은 미검증이다.

## 실행 증거

- `npm ci --no-fund` 및 `npm ci --offline --no-audit --no-fund` 첫 두 시도는 npm 11.19.1의 `idealTree buildDeps`에서 진행 없이 정지해 중단했다. 일부만 남은 `node_modules`를 `node_modules.audit3-interrupted`로 이름을 바꿔 보존하고, 빈 설치 경로에서 `npm ci --offline --no-audit --no-fund --loglevel verbose`를 실행해 199개 설치/종료 코드 0을 확인했다. 백업 폴더는 Git에서 제외한다.
- 이후 `npm run typecheck`: 종료 코드 0. `npm test`: 10파일/36테스트 통과. `npm run build`: 종료 코드 0, Vite 8.3.5, JS 541.03 kB(500 kB 청크 경고). `npm audit --json`: 전체 권고 0건.
- 최종 빌드의 로컬 preview `http://127.0.0.1:4173/instadesk/`: HTML, JS, CSS, favicon 모두 HTTP 200. 브라우저 preview 로드 콘솔 오류 0건.
- Chromium 390px: [Exec 입력](evidence_4/mobile_390_exec.png), [SPLIT 세로 배치](evidence_4/mobile_390_split.png), NODES 서랍/닫기/Esc 확인. 문서 전체 폭 390px.
- Chromium 768px: [기본 50%](evidence_4/tablet_768_split.png)에서 [65% 드래그](evidence_4/tablet_768_split_dragged.png) 후 데스크톱 배율이 0.287→0.196으로 변경. 문서 전체 폭 768px.
- Chromium 1280px: [단일 타일 전폭](evidence_4/desktop_1280_split.png), 작업 영역 992px 중 타일 976px. 문서 전체 폭 1280px.
- 개발 서버에서 Playwright 네트워크 route로 `/instabox-api/v1/machines`에 모의 JSON을 반환했다. 가짜 `ibk_mock_browser` 키로 UI를 통과시킨 GET은 `localhost:5173`과 `127.0.0.1:5173`에서 모두 각 호스트의 `/instabox-api/v1/machines`로 향했고 HTTP 200이었다. 실 API로 보내지 않았다.
- 읽기 전용 확인: `gh api repos/Yupkidangju/instadesk/pages` 404, 예상 Pages URL도 HTTP 404. Pages 배포 job은 실행하지 않았다.

## 남은 HOLD 조건

허가된 실 InstaBox 키와 운영 프록시가 없어 REST 변경, SSE, 실제 PTY/Connect 티켓, Desktop iframe, 서버 429, 삭제 후 서버 세션 무효화를 확인하지 못했다. Pages는 아직 게시되지 않았으며 사용자가 직접 설정/수동 배포하기로 한 지시를 유지했다. 이 보고서의 검증 범위에는 이번 변경의 원격 CI 실행이 포함되지 않는다. 최종 배포 Origin과 실 서비스 동작을 별도 독립 감사자가 검증하기 전까지 전체 제품 PASS를 주장하지 않는다.
