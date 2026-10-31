# 개인 Cloudflare Worker 연결 가이드

이 Worker는 공개 InstaBox Deck 사이트에서 **자기 API 키를 쓰려는 방문자가 자기 Cloudflare 계정에 배포**하는 템플릿이다. 공개 사이트에 공용 Worker는 설정되어 있지 않다. Worker 코드는 키를 저장하거나 로그로 출력하지 않지만, 요청을 중계하는 동안 평문 Bearer 키와 명령·응답을 처리한다. 자기 계정 또는 명시적으로 신뢰하는 운영자만 사용한다.

## 배포

1. [Cloudflare 계정](https://dash.cloudflare.com/)을 준비하고 Workers 플랜·사용량 조건을 확인한다. [공식 가격/한도](https://developers.cloudflare.com/workers/platform/pricing/)에 따르면 기본 Free 플랜에 일일 요청 한도가 있고 Paid 플랜에는 초과 사용료가 생길 수 있다.
2. 이 저장소를 다운로드하거나 클론한 다음 루트에서 `npx --yes wrangler@4.156.0 login`을 실행해 **자기 계정**으로 로그인한다. 계정 토큰이나 InstaBox 키를 이 프로젝트에 적거나 다른 사람에게 보내지 않는다.
3. `worker/wrangler.jsonc`의 `name`을 자기 계정에서 고유한 이름으로 바꾸고, 사이트 주소가 다르면 `ALLOWED_ORIGIN`을 해당 사이트의 HTTPS **origin**으로 바꾼다. 기본값은 `https://yupkidangju.github.io`이다. Origin에는 `/instadesk/` 경로가 포함되지 않는다.
4. `npx --yes wrangler@4.156.0 deploy --config worker/wrangler.jsonc`를 실행한다. 출력된 `https://...workers.dev` 주소의 **origin만** 복사한다.
5. `https://<내-worker>.workers.dev/health`에서 `{"ok":true,"service":"instadesk-personal-bridge",...}`를 확인한다. 공개 앱의 **KEY VAULT → PERSONAL WORKER**에서 Worker origin을 입력하고 키 공개 경계를 확인해 적용한다. 앱은 키를 보내기 전에 `/health`와 허용 Origin을 검사한다. 그다음 자기 InstaBox 키를 등록하거나 저장된 키 목록을 새로고침한다. Worker URL은 현재 페이지 세션에만 적용되므로 새로 연 탭에서는 다시 확인한다.

## 경로와 보안 경계

- `/instabox-api/v1/*`는 `https://api.instabox.sh/v1/*`로, `/instabox-connect/*`의 WebSocket은 `https://connect.instabox.sh/*`로만 보낸다. 다른 업스트림 주소를 입력받지 않는다.
- 브라우저 CORS는 `ALLOWED_ORIGIN`과 정확히 일치할 때만 허용한다. 이 값은 **계정 origin**이므로 같은 `yupkidangju.github.io`의 다른 경로에서도 브라우저 요청을 보낼 수 있다. 경로 단위 격리가 필요하면 전용 도메인을 사용한다. Origin 검사는 비브라우저 호출의 인증 장치가 아니며 InstaBox 키가 실제 권한을 결정한다.
- Worker는 `Authorization` 헤더를 InstaBox API로 전달한다. 리다이렉트는 따르지 않으며 응답을 캐시하지 않는다. SSE 응답 본문은 버퍼링하지 않고 전달한다. 실제 PTY/Connect 티켓, Desktop iframe 및 서비스가 요구하는 WebSocket Origin 정책은 허가된 키로 별도 검증해야 한다.
- 다른 사용자에게 **내 Worker URL**을 앱 기본값으로 제공하지 않는다. 각 방문자는 자기 Worker와 키를 관리한다.

Cloudflare CLI가 인증되지 않았거나 계정 선택이 필요한 경우, 각 사용자가 위 로그인 단계를 직접 완료해야 한다. 이 저장소의 작성자는 방문자 계정에 Worker를 자동 배포하지 않는다.
