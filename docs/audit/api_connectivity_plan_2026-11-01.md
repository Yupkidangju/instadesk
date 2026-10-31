# 공개 Pages 실 API 연결 수정 계획

2026-11-01 · 현상: `https://yupkidangju.github.io/instadesk/`에서 실제 키 등록 시 `Failed to fetch`. 허가되지 않은 Pages Origin의 `OPTIONS https://api.instabox.sh/v1/machines`는 404/ACAO 없음. 키의 유효성은 이 오류만으로 판단할 수 없다.

## 선택한 운영 모델

사용자 결정: 공개 사이트의 방문자는 **각자 소유하고 신뢰하는 Cloudflare Worker**를 설정한다. 공용 Worker URL을 앱에 내장하거나 방문자 키를 한 운영자에게 모으지 않는다. 정적 데모는 Worker 없이 계속 동작한다. Worker는 API 키를 저장하거나 로그로 출력하지 않지만, 요청을 전달하는 동안 평문 Bearer 키와 명령·응답을 처리하므로 운영자를 신뢰해야 한다.

## 구현 순서와 확인

1. `spec.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`에 개인별 프록시와 키 보관/검증 실패 계약을 먼저 명시한다.
2. `/instabox-api/*`와 `/instabox-connect/*`만 고정 업스트림으로 전달하는 Worker 템플릿을 작성한다. Pages Origin을 정확히 허용하고, preflight·REST·SSE·WebSocket을 구분하며 리다이렉트와 임의 목적지를 거부한다. Worker에는 API 키를 환경 변수로 넣지 않는다.
3. 키 등록은 암호화 저장 후 한 번만 조회한다. 연결/CORS 실패는 **미검증**으로 표시하고 암호화된 키를 보존한다. API 응답 오류도 이유를 표시하고 자동 삭제하지 않는다. Worker URL은 인증 헤더 없는 `/health`에서 템플릿과 허용 Origin을 확인하고 사용자가 명시적으로 신뢰 확인한 뒤 페이지 세션에 적용한다.
4. Worker 라우팅·CORS·스트리밍·WebSocket 모의 테스트, 키 등록 오류/재시도 테스트, 타입 검사·전체 테스트·빌드를 실행한다. Cloudflare 계정 로그인과 실제 Worker 배포, 허가된 InstaBox 키를 이용한 실 REST/SSE/PTY/Desktop 검증은 별도 증거로 남긴다.

## 남은 운영 의존성

현재 로컬 `wrangler whoami`는 인증되지 않았다. 각 사용자가 자기 Cloudflare 계정으로 템플릿을 배포하고 Worker origin을 앱에 입력해야 한다. 계정/키를 이 저장소나 감사 기록에 적지 않는다. 무료 플랜 여부와 사용량은 각 사용자 계정에서 확인한다.
