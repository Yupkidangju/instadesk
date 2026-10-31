# InstaBox Multi-VM Web Console Design System (Neo-Swiss Style)

**Document Version:** 1.0.0  
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

```
+-------------------------------------------------------------------------------------------------------+
|  [+] INSTABOX // DECK  01_TERMINAL_GRID     | [LOCK: UNLOCKED] | QUOTA: 2/8 | [BROADCAST] [VAULT] [+] |
+------------------------------------+------------------------------------------------------------------+
| 02_NODE_INVENTORY (4)              | 03_WORKSPACE_GRID [1x1] [2x1] [2x2] [AUTO]        [+] ADD TILE   |
| +--------------------------------+ +--------------------------------+--------------------------------+
| | [RUN] box-prod-web-01          | | TILE_01 // box-prod-web-01     | TILE_02 // box-worker-gpu      |
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
| STATUS: ALL SYSTEMS OPERATIONAL // LAST SYNC: 14:35:22 UTC // E2EE VAULT: AES-GCM-256 (ACTIVE)        |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. 컴포넌트별 디자인 및 인터랙션 사양

### 3.1 헤더 바 (01_SYSTEM_BAR)
- **높이**: `h-14` (56px), `border-b border-zinc-800 bg-zinc-950/90 backdrop-blur`.
- **로고/타이틀**:
  - `INSTABOX` (굵은 볼드 800, 흰색) + `// DECK` (레드 `#E53935` 폰트).
  - 서브 타이틀: `[v1.0.0_NEO_SWISS]`.
- **볼트 보안 인디케이터**:
  - 잠금 상태: `[■ LOCKED]` (Zinc 600 버튼, 마스터 패스워드 입력 유도).
  - 잠금 해제 상태: `[● E2EE ACTIVE]` (스위스 레드/에메랄드 도트 + 15분 타이머 표시).
- **세션 쿼터 미터**:
  - `PTY: {total} TOTAL · MAX {profileCount} / 8 PER KEY` (프로필별 최대 6개 이상 시 노란색, 8개 시 붉은색 경고). 데스크톱 iframe과 외부 세션은 포함되지 않는다.
- **그리드 레이아웃 선택기**:
  - `[1x1]`, `[2x1]`, `[2x2]`, `[AUTO]` 토글 버튼 세트 (활성 탭은 `bg-zinc-100 text-zinc-950 font-bold`).
- **전역 액션**:
  - `[BROADCAST CMD]`: 복수 실행 중인 VM에 동시 명령 전송 모달 트리거.
  - `[KEY VAULT]`: API 키 관리 및 마스터 패스워드 설정 모달 트리거.

### 3.2 노드 인벤토리 사이드바 (02_NODE_INVENTORY)
- **폭**: `w-80` (320px), 스크롤 가능 영역, `border-r border-zinc-800 bg-zinc-900/60`.
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
  - 메타 스펙: `4 vCPU · 8192 MB · Linux 6.x · user`.
  - 실시간 메트릭 미니 게이지 (CPU %, RAM %).
  - 하단 빠른 제어 버튼 세트:
    - `[+ TILE]` (타일 그리드에 즉시 추가)
    - `[TERM]` (터미널 타일 열기)
    - `[DESK]` (화면 스트림 타일 열기)
    - 전원 드롭다운 (`PAUSE`, `RESUME`, `RESTART`, `STOP`, `TERMINATE`).

### 3.3 워크스페이스 타일 그리드 (03_WORKSPACE_GRID)
- **그리드 구성**:
  - `1x1`: 단일 VM 전체 화면 집중 모드. 여러 타일이 저장돼 있으면 선택 줄에서 표시할 타일을 고른다. 표시되지 않는 타일의 PTY/iframe은 언마운트된다.
  - `2x1`: 좌우 2분할 듀얼 모니터링 (예: 좌측 터미널, 우측 데스크톱 화면).
  - `2x2`: 4분할 쿼드 관제실 모드.
- **개별 타일 헤더 (Tile Header)**:
  - 타일 인덱스: `TILE_01 // box-prod-web-01`.
  - 탭 스위처: `[TERMINAL (PTY)]` | `[DESKTOP (VNC/STREAM)]` | `[EXEC (SSE)]` | `[LOGS]` | `[PROCESSES]`.
  - 우측 액션: `[EXPAND]`, `[RELOAD]`, `[CLOSE (x)]`.
- **터미널 패널 (Terminal Pane)**:
  - `@xterm/xterm` 기반 캔버스/DOM 렌더러.
  - 다크 테마: 배경 `#09090B`, 텍스트 `#E4E4E7`, 커서 스위스 레드 `#E53935`.
  - WebSocket PTY 직접 연결 또는 SSE 인터랙티브 실행기 연동.
- **데스크톱 화면 패널 (Desktop Screen Pane)**:
  - **Live Stream Iframe**: `https://dashboard.instabox.sh/desktop/{id}#token=...` 서명 링크를 `iframe`으로 임베딩.
  - 상단 컨트롤 바:
    - 화면 해상도: `1280x800` / `1920x1080`.
    - 모드 전환: `[WATCH ONLY]` vs `[CONTROL TAKEOVER]` (마우스/키보드 실시간 조작).
    - 수동 스크린샷 캡처 및 새로고침 버튼.
- **하단 푸터 바**:
  - `STATUS: CONNECTED // VAULT ENCRYPTION: AES-256-GCM // WORKSPACE LATENCY: 28ms`.
