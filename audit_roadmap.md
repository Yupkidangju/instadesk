# InstaBox Deck Audit Roadmap & Checkpoints

**Document Version:** 1.0.0  
**Audit Standard:** AI_AUDIT_DOC_STANDARD.md & D3D Protocol  

---

## 1. 감사 단계 및 체크포인트 (Audit Phases)

### Phase 1: 보안 및 로컬 암호화 볼트 감사
- [ ] Web Crypto API (`window.crypto.subtle`)의 `AES-256-GCM` 및 `PBKDF2` 정상 작동 여부.
- [ ] `localStorage` 검사 시 평문 키가 남지 않고 `salt`, `verifierCiphertext`, `verifierIv`, 프로필별 `encryptedData`가 저장되는지 검증. 동일 origin의 다른 경로도 저장소에 접근할 수 있음을 고려한다.
- [ ] On-demand 소비 함수(`withDecryptedKey`)가 호출 시점에만 복호화하고 비활성 시 안전하게 잠금 처리되는지 검증.
- [ ] 마스터 비밀번호 불일치 시 복호화 실패 및 무결성 에러(`GCM tag verification failure`) 처리 검증.

### Phase 2: InstaBox API 및 신뢰 프록시 통신 감사
- [ ] `Authorization: Bearer <key>` 헤더 정상 전송 검증.
- [ ] 머신 생성, 전원 제어, 삭제 시 `Idempotency-Key` 및 `X-Confirm-Delete` 헤더 정상 주입 검증.
- [ ] SSE 스트리밍 명령 실행(`POST /v1/machines/{id}/exec`)의 chunk 파싱 및 exit code 반환 검증.
- [ ] `POST /v1/machines/{id}/desktop/stream` 서명 링크의 `iframe` 렌더링 호환성 검증.
- [ ] 8개 동시 세션 쿼터 카운터 및 `429 quota_exceeded` 방지 로직 검증.
- [ ] 오프라인/데모 모드(`ibk_demo_...`) 가상 microVM 4대 정상 시뮬레이션 검증.
- [ ] API/Connect 호스트별 프록시 경로, 프로필별 부분 실패, 중복 갱신 순서 및 프로필 삭제 시 선택적 요청·PTY 종료 검증.

### Phase 3: 네오스위스 디자인 시스템 및 멀티 뷰 워크스페이스 감사 (UI/UX Audit)
- [ ] 네오스위스 스타일의 엄격한 모듈러 그리드, 1px 보더, 산세리프 대문자 트래킹 및 스위스 레드(`#E53935`) 포인트 컬러 적용 검증.
- [ ] 타일 분할 모드(`1x1`, `2x1`, `2x2`, `AUTO`) 전환 시 레이아웃 깨짐 없이 모든 패널(터미널, 데스크톱, 텔레메트리)이 정상 크기 조정(`FitAddon`)되는지 검증.
- [ ] 390/768/1280px에서 NODES 서랍, 단일 타일 전폭, Exec 입력, SPLIT 구분선 및 화면비 맞춤 확인. 허가된 실 스트림 iframe의 입력/배율은 별도 확인.

---

## 2. 잔여 위험 요소 (Residual Risks)
- **브라우저 확장 프로그램 미설치 시 외부 도메인 CORS**:
  - 정적 외부 도메인에서 실 API 사용에는 서비스의 Origin 허용 또는 사용자가 신뢰하는 HTTPS 프록시가 필요하다. 동봉 MV3 규칙은 비활성화됐다.
  - 조건: 최종 Pages URL에서 허가된 키와 운영 프록시로 REST/SSE/PTY/Desktop을 검증한다. 로컬 개발 프록시는 배포 대안이 아니다.
- **Pages 배포**: 2026-11-01 GitHub Actions 빌드·배포와 실제 URL의 JS/CSS·데모 흐름을 확인했다. 실 API/PTY/Desktop 게이트는 별도로 HOLD다. 증거: `docs/audit/pages_deployment_2026-11-01.md`.
- **개인 Worker**: 각 방문자가 자기 Cloudflare 계정에 배포해야 한다. `/health`·Pages Origin·고정 업스트림·키 미저장·SSE/WS 검증을 `docs/audit/api_connectivity_results_2026-11-01.md`에 추적한다. 모의/로컬 Worker 성공은 운영 Worker 실 연결 PASS가 아니다.
