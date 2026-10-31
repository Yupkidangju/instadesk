# GitHub Pages 빈 화면 수정 및 배포 검증

2026-11-01 (Asia/Seoul) · 대상: `https://yupkidangju.github.io/instadesk/` · 원본 감사 1~3과 코더 재검증 기록은 변경하지 않았다.

## 원인

Pages 설정은 `build_type: legacy`, source `main /`였다. 따라서 빌드 산출물 대신 저장소 루트의 개발용 `index.html`을 공개했다. HTML은 `/src/main.tsx`와 `/node_modules/@xterm/xterm/css/xterm.css`를 요청했고, 공개 브라우저에서 두 요청이 404였다. 앱 코드가 실행되지 않아 빈 화면이 나타났다. GitHub의 [게시 소스 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)는 Vite 같은 빌드가 필요한 사이트에 GitHub Actions 배포를 안내한다.

## 조치

1. GitHub Pages API로 `build_type`을 `workflow`로 변경하고 다시 읽어 확인했다. 저장소 소스 파일과 기존 Actions 워크플로 코드는 변경하지 않았다.
2. `pages.yml`을 `workflow_dispatch`로 실행했다. [실행 41224589610](https://github.com/Yupkidangju/instadesk/actions/runs/41224589610)의 `npm ci`, 타입 검사, 36개 테스트, 빌드, Pages artifact 업로드, `deploy-pages@v4`가 모두 성공했다. 대상 커밋은 `8541fa0`이다.

## 공개 URL 검증

- 기본 URL과 캐시 무효화 쿼리 URL의 HTML은 HTTP 200이며 `/instadesk/assets/...` JS/CSS를 참조한다. 개발용 `/src/main.tsx` 참조는 없다. JS와 CSS는 각각 HTTP 200.
- 새 Chromium 세션에서 기본 URL의 첫 화면이 렌더링됐고 콘솔 오류 0건. `TRY DEMO MODE` 클릭 후 데모 VM 4대가 보였으며 콘솔 오류 0건. [화면 증거](evidence_pages_2026-11-01/live_demo.png).
- 기존 브라우저 세션은 캐시된 옛 HTML을 계속 제공했다. 서버의 기본 HTML은 `Cache-Control: max-age=600`으로 확인됐다. 기존 탭은 강력 새로고침(Ctrl+Shift+R) 또는 시크릿 창이 필요할 수 있다.

## 범위와 남은 조건

정적 데모 사이트의 공개 배포와 기본 렌더링은 확인했다. 허가된 InstaBox 키와 운영 프록시가 없어 실제 REST/SSE/PTY/Desktop, 서버 세션 제한, 외부 탭 취소는 검증하지 않았다. 이 배포 성공은 제품 전체 PASS를 뜻하지 않는다.
