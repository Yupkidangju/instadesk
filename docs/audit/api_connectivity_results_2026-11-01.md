# 공개 Pages API 연결 오류 수정 검증

2026-11-01 (Asia/Seoul) · 대상: `https://yupkidangju.github.io/instadesk/` · 사용자 결정: 각 방문자가 자기 Cloudflare Worker와 자기 InstaBox 키를 사용. 이전 감사 1~3과 Pages 배포 검증 기록은 보존한다. 이 기록은 코딩 세션의 검증이며 독립 제품 PASS가 아니다.

## 재현과 원인

Pages의 앱은 실제 키를 등록할 때 `https://api.instabox.sh/v1/machines`로 브라우저 요청을 보낸다. `Origin: https://yupkidangju.github.io`와 `Authorization`을 포함한 사전 OPTIONS 요청은 404이고 `Access-Control-Allow-Origin`이 없다. 따라서 브라우저의 `Failed to fetch`만으로 키 유효성을 판정할 수 없다. 기존 KEY VAULT는 암호화 저장 후 연결이 실패하면 프로필을 자동 삭제해 사용자가 다시 키를 입력해야 했다.

## 수정

- 공개 사이트에 공용 프록시 주소를 내장하지 않았다. `worker/`에 방문자 본인 계정용 Cloudflare Worker 템플릿과 배포 가이드를 추가했다. `/instabox-api/v1/*`와 `/instabox-connect/*`를 고정 업스트림으로만 전달하고 정확한 Pages Origin의 CORS를 허용한다. API 키 저장·로그·임의 목적지·업스트림 리다이렉트를 구현하지 않았다.
- Worker origin 적용 전에 인증 헤더 없는 `/health`를 요청해 템플릿 식별자와 허용 Origin을 확인한다. 실패하면 새 목적지를 활성화하지 않는다. 사용자의 신뢰 확인 체크박스는 계속 필요하다.
- 키 등록 중 네트워크/API 오류는 `SAVED ENCRYPTED · CONNECTION UNVERIFIED`로 안내하고 암호화된 프로필을 보존한다. 새 프로필은 검증 단계에서 한 번 목록 조회하고 성공 후 인벤토리를 갱신한다. 실패 시 키를 자동 삭제하지 않는다.
- `spec.md`, `DESIGN_DECISIONS.md`, `designs.md`, `BUILD_GUIDE.md`, `README.md`, `IMPLEMENTATION_SUMMARY.md`, `audit_roadmap.md`, `CHANGELOG.md`를 개인별 Worker 운영 모델과 맞췄다.

## 실행한 검증

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm test` | 11파일, 44테스트 통과. Worker preflight·Origin·고정 라우팅·SSE 스트림·WS 업그레이드·리다이렉트·health와 키 보존/Worker 확인 테스트 포함 |
| `npm run build` | 통과, Vite 8.3.5. JS 약 542.64 kB 청크 경고 유지 |
| `npm audit --json` | 0건 |
| `wrangler deploy --dry-run` | 번들 성공, 약 5.24 KiB. 키 바인딩 없음; `ALLOWED_ORIGIN`만 있음 |
| `wrangler dev --local` | 호환 날짜를 런타임이 지원하는 `2026-10-30`으로 조정한 뒤 실행. `/health` 200/정확한 Origin, Pages Origin preflight 204, 다른 Origin 403 |
| 가짜 키의 로컬 Worker GET | 업스트림 `api.instabox.sh`까지 전달돼 401 `malformed_key`와 Pages용 CORS 헤더 반환. 실제 사용자 키는 사용하지 않음 |

## 운영 배포 상태와 남은 조건

로컬 `wrangler whoami`는 사용자 Cloudflare 계정의 OAuth 로그인을 확인했다. 첫 게시 시 Cloudflare API가 **계정 이메일 인증 필요**(10034)로 거절했으나, 사용자가 인증을 완료한 뒤 `wrangler deploy --config worker/wrangler.jsonc`가 종료 코드 0으로 성공했다. Worker의 workers.dev URL은 방문자가 오용하지 않도록 공개 저장소 문서에는 기록하지 않았다. 첫 원격 `/health` 검사는 새 workers.dev 하위 도메인에서 TLS handshake 실패로 끝났으므로 **원격 Worker가 브라우저에서 사용 가능하다고 아직 판정하지 않는다.** DNS/인증서 상태를 재확인한 뒤 Pages 브라우저에서 프록시를 적용해야 한다.

허가된 실제 InstaBox 키가 없어 운영 Worker의 인증 GET, 변경 요청, SSE, PTY WebSocket, Desktop iframe은 미검증이다. Worker가 정상 배포되어도 각 방문자는 자기 Worker를 명시적으로 적용해야 한다. Cloudflare 계정의 Free/Paid 플랜과 사용량은 각 운영자가 확인한다. [Cloudflare Workers 가격 안내](https://developers.cloudflare.com/workers/platform/pricing/), [WebSocket 프록시 동작](https://developers.cloudflare.com/workers/runtime-apis/response/).
