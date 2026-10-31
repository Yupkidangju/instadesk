# InstaBox Deck Audit Roadmap & Checkpoints

**Document Version:** 1.0.0  
**Audit Standard:** AI_AUDIT_DOC_STANDARD.md & D3D Protocol  

---

## 1. 감사 단계 및 체크포인트 (Audit Phases)

### Phase 1: 보안 및 암호화 볼트 감사 (Security & E2EE Vault Audit)
- [ ] Web Crypto API (`window.crypto.subtle`)의 `AES-256-GCM` 및 `PBKDF2` 정상 작동 여부.
- [ ] `localStorage` 검사 시 평문 키가 단 한 글자도 남아있지 않고 암호화된 레코드(`salt`, `iv`, `ciphertext`)만 보관되는지 검증.
- [ ] On-demand 소비 함수(`withDecryptedKey`)가 호출 시점에만 복호화하고 비활성 시 안전하게 잠금 처리되는지 검증.
- [ ] 마스터 비밀번호 불일치 시 복호화 실패 및 무결성 에러(`GCM tag verification failure`) 처리 검증.

### Phase 2: InstaBox API 및 Zero-Server 통신 감사 (API & Zero-Server Audit)
- [ ] `Authorization: Bearer <key>` 헤더 정상 전송 검증.
- [ ] 머신 생성, 전원 제어, 삭제 시 `Idempotency-Key` 및 `X-Confirm-Delete` 헤더 정상 주입 검증.
- [ ] SSE 스트리밍 명령 실행(`POST /v1/machines/{id}/exec`)의 chunk 파싱 및 exit code 반환 검증.
- [ ] `POST /v1/machines/{id}/desktop/stream` 서명 링크의 `iframe` 렌더링 호환성 검증.
- [ ] 8개 동시 세션 쿼터 카운터 및 `429 quota_exceeded` 방지 로직 검증.
- [ ] 오프라인/데모 모드(`ibk_demo_...`) 가상 microVM 4대 정상 시뮬레이션 검증.

### Phase 3: 네오스위스 디자인 시스템 및 멀티 뷰 워크스페이스 감사 (UI/UX Audit)
- [ ] 네오스위스 스타일의 엄격한 모듈러 그리드, 1px 보더, 산세리프 대문자 트래킹 및 스위스 레드(`#E53935`) 포인트 컬러 적용 검증.
- [ ] 타일 분할 모드(`1x1`, `2x1`, `2x2`, `AUTO`) 전환 시 레이아웃 깨짐 없이 모든 패널(터미널, 데스크톱, 텔레메트리)이 정상 크기 조정(`FitAddon`)되는지 검증.
- [ ] 반응형 브레이크포인트(데스크톱 와이드, 태블릿) 동작 확인.

---

## 2. 잔여 위험 요소 (Residual Risks)
- **브라우저 확장 프로그램 미설치 시 외부 도메인 CORS**:
  - 정적 외부 도메인에서 실 API 사용에는 서비스의 Origin 허용 또는 사용자가 신뢰하는 HTTPS 프록시가 필요하다. 동봉 MV3 규칙은 비활성화됐다.
  - 완화책: 앱 내부에 MV3 확장팩 원클릭 다운로드/설치 안내 및 Vite 개발 서버 프록시 기본 번들링.
