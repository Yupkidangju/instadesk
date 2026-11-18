# InstaBox Multi-VM Web Console Design System (Neo-Swiss Style)

**Document Version:** 1.1.0  
**Design Philosophy:** Neo-Swiss International Typographic Style, Functional Cybernetic Control Room  

---

## 1. 디자인 철학 (Design Philosophy)

**Neo-Swiss Style (신국제주의 타이포그래피 양식)**:
- **기능이 형태를 결정한다 (Form follows function)**: 불필요한 장식, 3D 엠보싱, 과도한 그라디언트를 배제하고 오직 데이터와 제어 기능에 집중합니다.
- **엄격한 모듈러 그리드와 1px 라인**: 정보 블록들은 칼로 자른 듯한 1px 고대비 보더(`border-zinc-800` / `border-zinc-700`)와 직각 모서리(`rounded-none` 또는 정밀한 `rounded-sm`)로 명확히 구획됩니다.
- **볼드하고 정제된 타이포그래피 계층**:
  - 강렬한 대문자 산세리프 헤딩 (`font-sans font-bold tracking-wider uppercase`).
  - 마이크로 테크니컬 인덱스 레이블 (`01 // ROOT`, `02 // NODES`, `ACTIVE_SESSION_COUNT`).
  - 숫자와 데이터는 정밀한 모노스페이스(`font-mono`)로 등폭 정렬.
- **스위스 레드 액센트 포인트**:
  - 기본 배경은 칠흑 같은 딥 차콜/블랙(`#09090B`)과 슬레이트 징크.
  - 주의를 집중시켜야 하는 핵심 상태, 볼트 잠금 아이콘, 비상 제어 버튼, 핵심 활성 탭에 스위스 국기의 상징적인 **스위스 레드 (`#E53935` / `#DC2626`)**를 강렬한 단일 액센트로 배치.

---

## 2. 화면 레이아웃 구조 (ASCII Architecture)

아래는 넓은 화면의 개념도다. 좁은 화면은 §3의 반응형 규칙을 따른다.

```
+-------------------------------------------------------------------------------------------------------+
|  [+] INSTABOX // DECK  01_TERMINAL_GRID     | [LOCK: UNLOCKED] | QUOTA: 2/8 | [BROADCAST] [VAULT] [+] |
+------------------------------------+------------------------------------------------------------------+
| 02_NODE_INVENTORY (4)              | 03_WORKSPACE_GRID [1x1] [2x1] [2x2] [AUTO]        [+] ADD TILE   |
|                                    |------------------------------------------------------------------|
|                                    | [●2 IDLE] [●1 RUN] [▲1 PROMPT] | [box-01:main 🟢] [box-01:agent 🟡] |
|                                    | SYNC(2) [MIRROR] [CMD INPUT_______] [SEND] | [Y][N][↵][1][2][^C] |
| +--------------------------------+ +--------------------------------+--------------------------------+
| | [RUN] box-prod-web-01          | | TILE_01 // box-prod-web-01     | TILE_01b // box-prod-web-01    |
| | [TERM] [DESK] [+SESS]          | | [🟢 IDLE] [SYNC] [+SESS] [x]   | [🟡 PROMPT: Allow edit? [Y/n]]   |
| | 4 vCPU · 8 GB · dev-user       | | [TERM] [DESK] [EXEC] [LOG] [x] | [TERM] [DESK] [EXEC] [LOG] [x] |
| | CPU: 12% | MEM: 44%           | |--------------------------------|--------------------------------|
| | [TERM] [DESK] [PAUSE] [STOP]   | | user@instabox:~$ htop          | +----------------------------+ |
| +--------------------------------+ | PID  USER  CPU% MEM%  TIME     | | [IFRAME DESKTOP STREAM]    | |
| | [RUN] box-worker-gpu           | | 1204 user  1.2  0.5   0:12.4   | | 1280 x 800 (Live Stream)   | |
| | 8 vCPU · 16 GB · Chromium GUI  | | 1245 root  0.0  0.1   0:00.1   | | [Takeover Control: Human]  | |
| | [TERM] [DESK] [PAUSE] [STOP]   | |                                | +----------------------------+ |
| +--------------------------------+ +--------------------------------+--------------------------------+
| | [PAU] box-backup-db            | | TILE_03 // box-backup-db       | TILE_04 // box-eval-agent      |
| | 2 vCPU · 4 GB · idle-suspend   | | [TERM] [DESK] [EXEC] [LOG] [x] | [TERM] [DESK] [EXEC] [LOG] [x] |
| | [RESUME] [DELETE]              | |--------------------------------|--------------------------------|
| +--------------------------------+ | [SUSPENDED] Click to Resume    | $ python3 run_agent.py --eval  |
| | [+] REGISTER NEW API KEY       | | Machine state is in memory.    | [STDOUT] Epoch 1/10 loss: 0.12 |
| | [>] PROFILES: 2 WORKSPACES     | |                                | [STDOUT] Epoch 2/10 loss: 0.08 |
+------------------------------------+--------------------------------+--------------------------------+
| STATUS: READY // LAST SYNC: 14:35:22 UTC // LOCAL VAULT: AES-GCM-256 (UNLOCKED)                     |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. 컴포넌트별 디자인 및 인터랙션 사양

### 3.1 헤더 바 (01_SYSTEM_BAR)
- **높이**: 최소 56px. 화면 폭에 따라 제어 버튼이 여러 줄로 접히며 `border-b border-zinc-800 bg-zinc-950`을 유지한다.
- **로고/타이틀**:
  - `INSTABOX` (굵은 볼드 800, 흰색) + `// DECK` (레드 `#E53935` 폰트).
  - 넓은 화면의 서브 인덱스: `01_SYS_GRID`, `SWISS_REST_WS_V1`.
- **볼트 보안 인디케이터**:
  - 잠금 상태: `[■ LOCKED]` (Zinc 600 버튼, 마스터 패스워드 입력 유도).
  - 잠금 해제 상태: `[● VAULT UNLOCKED]` (로컬 저장 암호화, 에메랄드 도트).
- **세션 쿼터 미터**:
  - `PTY: {localCount} LOCAL · 8 / USER SERVER LIMIT`는 이 앱의 시도/열린 PTY만 보여준다. 외부 세션·서로 다른 프로필의 동일 user 여부는 알 수 없고 서버 오류가 최종 판정이다. 데스크톱/SSE는 이 숫자에 합산하지 않는다.
  - PTY 상태는 CONNECTING(티켓/소켓), NEGOTIATING(`open` 뒤 `session` 전), LIVE(`session` 뒤), DISCONNECTED로 구분한다. 오류 바에는 비밀 없는 상태 범주·코드·시각을 표시하고 재시도 예정/횟수와 수동 재연결을 제공한다.
  - KEY VAULT의 입력 비밀은 닫기·실패·잠금 후 빈 값이다. 기존 약한 암호는 긴 암호문구로 변경하는 UI를 제공한다. 좁은 화면에서도 문구와 오류를 읽을 수 있게 줄바꿈한다.
- **그리드 레이아웃 선택기**:
  - `[1x1]`, `[2x1]`, `[2x2]`, `[AUTO]` 토글 버튼 세트 (활성 탭은 `bg-zinc-100 text-zinc-950 font-bold`).
- **전역 액션**:
  - `[BROADCAST CMD]`: 복수 실행 중인 VM에 동시 명령 전송 모달 트리거.
  - `[KEY VAULT]`: API 키 관리 및 마스터 패스워드 설정 모달 트리거.
  - KEY VAULT에서는 앱이 InstaBox API에 직접 연결함을 안내한다. 검증 실패는 키를 삭제하지 않고 `SAVED · CONNECTION UNVERIFIED` 상태와 네트워크·키 권한 확인 동선을 표시한다.

### 3.2 노드 인벤토리 사이드바 (02_NODE_INVENTORY)
- **폭**: 넓은 화면에서는 288px 고정. 1024px 미만에서는 헤더의 `NODES` 버튼으로 여는 320px 이하의 서랍이며, 오버레이·닫기 버튼·Esc로 닫는다. 작업 패널을 덮지 않을 때는 전체 화면 폭을 사용한다.
- **상단 섹션**:
  - `INDEX // 02_NODES (TOTAL: {count})` 테크니컬 헤더.
  - 검색창 (`border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono`).
  - 상태 필터 칩: `[ALL]`, `[RUNNING]`, `[PAUSED]`, `[STOPPED]`.
- **VM 카드 디자인**:
  - 직사각형 샤프 카드 (`border border-zinc-800 bg-zinc-950 hover:border-zinc-600 transition-colors`).
  - 좌측 상단 상태 뱃지:
    - `● RUNNING` (`text-emerald-400 bg-emerald-950/40 border border-emerald-800/60`)
    - `▲ SUSPENDED` (`text-amber-400 bg-amber-950/40 border border-amber-800/60`)
    - `■ STOPPED` (`text-zinc-400 bg-zinc-900 border border-zinc-700`)
  - VM 이름: `font-mono font-bold text-sm tracking-tight text-zinc-100`.
  - 메타 스펙: vCPU, 메모리 GiB, 영구 디스크 GiB. 카드 내부 실시간 CPU/RAM 게이지는 제공하지 않는다.
  - 하단 빠른 제어 버튼 세트:
    - `[TERM]` (터미널 타일 열기)
    - `[DESK]` (화면 스트림 타일 열기)
    - 머신 상태에 맞는 일시정지·재개·시작·정지 아이콘과 삭제 아이콘. 삭제는 확인 대화상자를 거친다.

### 3.3 워크스페이스 타일 그리드 (03_WORKSPACE_GRID)
- **그리드 구성**:
  - `1x1`: 단일 VM 전체 화면 집중 모드. 여러 타일이 저장돼 있으면 선택 줄에서 표시할 타일을 고른다. 표시되지 않는 타일의 PTY/데스크톱 뷰는 종료된다.
  - `2x1`: 좌우 2분할 듀얼 모니터링 (예: 좌측 터미널, 우측 데스크톱 화면).
  - `2x2`: 4분할 쿼드 관제실 모드.
  - 한 타일은 항상 작업 영역 전폭. 1280px 미만에서 여러 타일은 한 열과 세로 스크롤로 전환한다. 390px에서 주요 작업 탭·명령 입력·전역 버튼이 잘리지 않아야 한다.
- **개별 타일 헤더 (Tile Header)**:
  - 타일 인덱스: `TILE_01 // box-prod-web-01`, 세션 배지(`MAIN`/`AGENT`/`AUX`), 상태 신호등 바/뱃지(🔴 `RUNNING`, 🟡 `PROMPT`, 🟢 `IDLE`, ⚪ `OFFLINE`).
  - 상태에 따라 타일 상단 2px 액센트 바 색상 점등(빨강 `#EF4444`, 노랑 `#F59E0B`, 초록 `#10B981`). 🟡 `PROMPT` 상태에서는 감지된 마지막 질문/선택 요약을 노출한다.
  - 우측 액션: `[SYNC]` (동시 제어 그룹 토글), `[+ SESS]` (같은 VM의 다음 미오픈 세션 `main`/`agent`/`aux`를 새 타일로 추가), `[CLOSE (x)]`.
  - 탭 스위처: `[TERMINAL (PTY)]` | `[DESKTOP (VNC/STREAM)]` | `[SPLIT]` | `[EXEC (SSE)]` | `[LOGS]` | `[PROCESSES]`. 좁은 폭에서는 탭 줄을 별도 행에 배치한다.
  - SPLIT: 타일 폭 700px 이상은 좌측 터미널/우측 데스크톱, 25~75% 드래그 구분선과 키보드 화살표 조절. 좁은 타일은 상하 배치. 실제 Desktop 네이티브 뷰는 타일별 ID(`desktop_${tileId}`)로 독립 마운트하며 가용 패널 전체에 배치하고 원격 뷰어가 실제 화면비로 영상을 맞춘다. 데모 미리보기는 논리 해상도로 맞춘다.
  - 5개 이상 등 여러 행을 스크롤할 때 Desktop 네이티브 뷰는 작업 영역 안에 완전히 보이는 타일에서만 표시한다. 부분 가시 구간은 앱 배경이 보이고, 타일이 다시 들어오면 스트림을 재발급하지 않고 표시한다. 작업 영역에 스크롤이 있을 때 Desktop 위 휠은 타일 스크롤, `Alt+휠`은 원격 화면 입력이다. 작은 화면의 세로 타일에도 같은 규칙을 적용한다.
- **터미널 패널 (Terminal Pane)**:
  - `@xterm/xterm` 기반 캔버스/DOM 렌더러.
  - 일반 휠은 터미널 기록 전용이며 위·아래 끝에서 바깥 타일로 같은 델타를 넘기지 않는다. `Shift+휠`은 작업 영역을 스크롤한다. 타일 포커스/탭 왕복 시 최근 기록과 읽던 위치를 복원하지만 숨긴 PTY는 닫고, 수동/일괄 `RECONNECT` 시에는 직전 캐시를 비우고 재저장하지 않는다. 상한/정리 경계는 `docs/electron/audit_5_remediation.md`를 따른다.
  - 다크 테마: 배경 `#09090B`, 텍스트 `#E4E4E7`, 커서 스위스 레드 `#E53935`.
  - 제한된 Electron IPC를 통한 WebSocket PTY 또는 SSE 인터랙티브 실행기 연동.
- **데스크톱 화면 패널 (Desktop Screen Pane)**:
  - **Live Stream View**: `https://dashboard.instabox.sh/desktop/{id}#token=...` 서명 링크를 격리된 Electron `WebContentsView`에 최상위 문서로 표시. 프레임 정책을 우회하지 않는다.
  - 상단 컨트롤 바:
    - 화면 해상도: `1280x800` / `1920x1080`.
    - 모드 전환: `[WATCH ONLY]` vs `[CONTROL TAKEOVER]` (마우스/키보드 실시간 조작).
    - 스트림 새로고침 버튼. 별도의 스크린샷 캡처는 현재 제공하지 않는다.
- **하단 푸터 바**:
  - 넓은 화면에서 데모/연결 조건, 볼트 암호화 정보와 버전을 표시한다. 좁은 화면에서는 푸터를 숨기고 상단 주요 제어를 유지한다.

### 3.4 통합 세션 인디케이터 & 라이브 동기화 제어 바 (04_SESSION_ORCHESTRATOR)
- 워크스페이스 상단(스크롤 영역 위)에 고정 배치되어 타일이 많거나 `1x1` 집중 모드·스크롤 상태에서도 전체 세션 상태를 일관되게 관제한다.
- **세션 인디케이터 스트립**:
  - 상태 요약 카운터(`RUN`, `PROMPT`, `IDLE`) 및 열린 모든 타일의 상태 칩(`VM명:세션` + 🔴/🟡/🟢 도트) 나열.
  - 칩 클릭 시 해당 타일로 포커스/스크롤 이동(`1x1` 모드에서는 마운트 완료 후 터미널 포커스 보장).
- **라이브 PTY 동시 입력 바**:
  - 타겟 선택기: `[SYNCED]` (동기화 그룹 내 터미널/스플릿 타일 수) | `[ALL]` (열린 전체 터미널) | `[PROMPTS]` (현재 🟡 질문 대기 중인 타일만).
  - `[MIRROR]` 토글: 켜져 있으면 동기화 그룹 내 한 터미널의 키 입력을 나머지 동기화 타일로 실시간 미러링(단, 암호/패스프레이즈 프롬프트 감지 시 평문 누출 방지를 위해 일시 차단).
  - 실시간 명령 입력창 + `[SEND]` 버튼 + 원클릭 빠른 응답 버튼(`[Y]`, `[N]`, `[↵]`, `[1]`, `[2]`, `[ESC]`, `[^C]`). 실제 전송 대상이 `0`건이면 입력창을 비우지 않고 보존한다.
- **워크스페이스 프리셋 & 일괄 관리**:
  - 현재 열린 타일 배치·그리드·세션 구성을 이름 붙여 저장/불러오기/삭제하는 프리셋 드로어/메뉴.
  - 열린 타일 일괄 제어: `[ALL TERM]`, `[ALL SPLIT]`, `[RECONNECT]`, `[CLEAR]`.
