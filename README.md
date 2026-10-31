# InstaBox Deck

여러 InstaBox VM을 한 화면에서 살펴보고 터미널, 명령 실행, 데스크톱을 여는 Vite/React 앱입니다. API 키는 브라우저의 암호화된 로컬 볼트에 저장합니다.

## 실행

Node.js 22.12 이상에서 `npm ci`, `npm run dev`를 실행합니다. 검증 명령과 GitHub Pages 준비 절차는 [BUILD_GUIDE.md](BUILD_GUIDE.md)에 있습니다.

정적 사이트에서는 API 키 없이 데모 모드를 사용할 수 있습니다. 실제 VM 기능은 InstaBox가 배포 Origin을 허용하거나, 사용자가 명시적으로 신뢰하는 HTTPS 역방향 프록시가 있어야 합니다. 프록시 운영자는 평문 API 키와 명령/응답을 볼 수 있습니다. 동봉된 브라우저 확장 프로그램의 CORS 규칙은 비활성화돼 있습니다. 실 API와 최종 Pages URL은 아직 검증되지 않았습니다.

390px 이상 화면을 지원합니다. 좁은 화면에서는 **NODES**로 머신 목록을 열고, 타일의 **SPLIT** 탭에서 터미널과 데스크톱을 동시에 볼 수 있습니다. 넓은 화면에서는 두 화면 사이 구분선을 끌거나 화살표 키로 크기를 조절합니다. 데스크톱은 화면비를 유지하며 남은 공간에 맞게 표시합니다.

## 상태

감사 원본은 [audit_report_1.md](docs/audit/audit_report_1.md)에 보존합니다. 수정 증거와 남은 출시 조건은 후속 재감사 보고서에 기록합니다. 데모/로컬 테스트 통과만으로 실 서비스 호환성을 주장하지 않습니다.

## 라이선스

Apache License 2.0. Copyright 2026 Yupkidangju <yupkidangju@gmail.com>. [LICENSE](LICENSE)를 참조하세요.
