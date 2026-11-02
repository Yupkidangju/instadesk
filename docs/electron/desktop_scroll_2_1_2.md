# Desktop 네이티브 뷰 스크롤 수정 계약 (2.1.2)

작성일: 2026-11-02. 사용자 재현: VM 5개를 2열로 열고 오른쪽 열을 Desktop으로 전환하면, 작업 영역 스크롤 시 오른쪽 Desktop 네이티브 뷰가 화면에 남는다.

## 목표·범위

```text
앱 창
├─ 고정 헤더
└─ 스크롤 가능한 작업 영역
   └─ 2열 타일 그리드 (5개면 여러 행)
      └─ Desktop 타일: HTML 자리 + Electron WebContentsView
```

Electron `WebContentsView`는 HTML 스크롤 컨테이너의 자식이 아니다. 현재 위치 계산은 음수 `top`을 0으로 고정하고, 네이티브 뷰를 작업 영역 밖에서 숨기지 않는다. 따라서 스크롤 시 뷰가 헤더/다른 타일 위에 남을 수 있다. 네이티브 뷰의 URL·세션·대시보드 배율은 유지하고 위치·가시성·휠 전달만 고친다.

## 동작 계약

1. Desktop 자리의 실제 `getBoundingClientRect()`를 매 스크롤·창 크기·타일 배치 변경 때 읽는다. 스크롤 영역 안에 **완전히 보일 때만** 네이티브 뷰를 표시하고 정확한 좌표로 이동한다. 부분/전체가 영역 밖이면 뷰를 숨겨 헤더·다른 타일을 가리지 않는다. 숨김은 연결을 닫거나 새 티켓을 발급하지 않는다. 다시 완전히 보이면 같은 뷰를 표시한다. 부분 가시 구간은 앱 배경을 보이는 제한을 명시한다.
2. 작업 영역에 세로 스크롤이 있으면 Desktop 위의 일반 마우스 휠은 작업 영역을 스크롤한다. `Alt+휠`은 원격 Desktop으로 전달한다. 작업 영역이 스크롤되지 않으면 일반 휠도 원격 Desktop으로 전달한다. 타일 뷰에 짧은 안내를 제공한다. 휠 값과 가시성은 허용된 Electron IPC 이벤트/배치 속성만 사용한다.
3. 왼쪽/오른쪽 열, 1x1·2x1·2x2·Auto, SPLIT, 창 크기 변경, 모달·잠금·타일 닫기에서 기존 네이티브 뷰 소유·종료 규칙을 지킨다. Desktop 내부 프레임/서명 URL은 로그·문서·테스트 출력에 남기지 않는다.

## 순서·검증

1. 문서 계약을 반영하고 오른쪽 열 스크롤/영역 이탈을 재현하는 배치·IPC 테스트를 먼저 실패시킨다.
2. 스크롤 자리 계산, WebContentsView 가시성/휠 전달, 구분된 작업 영역 이벤트를 구현한다.
3. 타입 검사, 관련 회귀, 전체 테스트, Windows 패키지 로드, 네이티브 CI를 확인한다. 실 키의 5대 재현은 가능한 경우 사용자 수용 결과와 별도로 기록한다.

## 구현·검증 기록

- 재현: `desktopNativeView.test.tsx`에 오른쪽 열 뷰가 스크롤 위로 벗어나는 사례를 추가했다. 수정 전에는 `y=0` 좌표만 전달되고 숨김 정보가 없어 실패했다. `desktopPlacement.test.ts`와 `desktopZoom.test.ts`는 가시성/휠 계약을 분리해 검사한다.
- 수정: `WorkspaceGrid.tsx`가 스크롤 영역을 표시하고 `DesktopScreenView.tsx`는 실제 자리·영역 교차·스크롤 가능 여부를 계산한다. `desktopViewGateway.ts`는 `setVisible`로 뷰를 숨기고 재표시하며, 스크롤 영역이 있는 경우 일반 휠을 작업 영역으로 전달한다. 기존 뷰를 닫거나 스트림 URL을 새로 발급하지 않는다.
- 로컬: `npm run typecheck` 성공, `npm test` 22파일 90테스트 통과, `npm audit --audit-level=high` 0건. `npm run package:win` 성공(로컬 ZIP 158,398,571 bytes, SHA-256 `7b68bdfd7b77329ea7c7f69dac37b0f50c868c8131fa3864556256dd7fb994b9`), 패키지 `--smoke-test` exit 0.
- 실 화면: 사용자가 열린 2.1.2 Windows 앱에서 VM 5대·2열·오른쪽 Desktop 스크롤을 직접 확인하고 “통과. 해결됨”이라고 보고했다. 이는 사용자 수용 결과이며 별도 화면 캡처·좌표 추적·개별 휠 모드 측정은 하지 않았다.
- 네이티브 CI/공개 자산: 진행 중. 모의 배치·IPC 테스트와 패키지 시작만으로 독립 재감사 PASS를 주장하지 않는다.

Electron의 [View.setVisible](https://www.electronjs.org/docs/latest/api/view)과 [webContents `before-mouse-event`](https://www.electronjs.org/docs/latest/api/web-contents/) 계약을 확인했다. `WebContentsView`는 앱 창의 별도 네이티브 자식 뷰이며 HTML 스크롤 컨테이너의 `overflow`가 자동으로 적용된다는 근거는 없다.
