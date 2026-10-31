# 공개 사이트 API 연결 방식 검토 (Electron 전환으로 종료)

2026-11-01 · 사용자가 요구한 흐름: GitHub Pages에서 마스터 암호와 InstaBox API 키를 입력해 사용. 현재 공개 Pages Origin의 `OPTIONS https://api.instabox.sh/v1/machines`는 404이고 CORS 허용 헤더가 없다. 마스터 암호/로컬 암호화는 저장 시 키를 보호하지만 이 브라우저 네트워크 제약을 바꾸지 않는다. [GitHub Pages는 정적 게시](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)이며 서버 측 프록시를 실행하지 않는다.

| 방식 | 방문자 흐름 | 키를 볼 수 있는 곳 | 현재 막힘 |
| --- | --- | --- | --- |
| InstaBox가 Pages Origin을 CORS 허용 | 마스터 암호 + 키만 입력 | 브라우저와 InstaBox | InstaBox 운영자가 허용해야 함. 현재 사전 요청은 404. |
| 사이트 운영자의 공통 Worker | 마스터 암호 + 키 + 신뢰 고지 확인 | 브라우저, 사이트 운영자의 Cloudflare Worker, InstaBox | 모든 방문자의 평문 키·명령·응답이 운영자 계정을 통과하고 사용량이 한 계정에 집중. Worker 코드를 공개하고 로그/캐시를 끄더라도 운영자 신뢰는 필요. |
| 방문자별 Worker 설정을 볼트에 기억 | 첫 방문에 자기 Worker 설정, 다음부터 마스터 암호 + 키 | 브라우저, 방문자 자신의 Worker, InstaBox | 각 방문자에게 Cloudflare 계정과 최초 설정이 필요. 저장된 목적지의 변조 방지와 잠금 해제 후 확인 설계 필요. |

공통 Worker를 택하면 현재 배포된 Worker의 URL을 사이트 기본 연결로 설정하고, 첫 키 등록 전에 운영자에게 평문 키가 전달됨을 명확히 고지해야 한다. 동일 Worker에 임의의 클라이언트가 가짜 키 요청을 반복해 사용량을 소모할 수 있으므로 Cloudflare 계정의 사용량/제한도 관리해야 한다. [Cloudflare Workers 가격/한도](https://developers.cloudflare.com/workers/platform/pricing/).

저장소 안전성도 별개다. 현재 암호화된 볼트는 `localStorage`에 있고, [브라우저 저장소는 URL 경로가 아니라 origin에 속한다](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). 여러 GitHub Pages 프로젝트가 같은 `https://yupkidangju.github.io` origin 아래 경로로 제공될 수 있다. 따라서 마스터 암호화는 저장 기록을 보호하지만 다른 동일 origin 스크립트나 실행 중인 페이지의 악성 코드까지 완전히 격리하지 않는다. 민감한 키를 다루는 공개 제품이라면 전용 도메인으로 origin을 분리하는 방안이 더 적합하다.

**최종 결정:** 사용자는 2026-11-01에 공개 Pages API 앱 대신 Electron 데스크톱 앱을 선택했다. 공통 Worker 기본값은 구현하지 않는다. `docs/electron/architecture.md`와 `DESIGN_DECISIONS.md` Decision 07이 현재 계약이다.
