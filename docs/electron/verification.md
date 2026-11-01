# InstaDesk 2.0.6 검증 기록

2026-11-01 · Windows x64. 이전 단계 기록: [2.0.0](verification_2_0_0.md), [2.0.1](verification_2_0_1.md), [2.0.2](verification_2_0_2.md), [2.0.3](verification_2_0_3.md), [2.0.4](verification_2_0_4.md), [2.0.5](verification_2_0_5.md). 원본 감사 보고서와 finding ID는 `docs/audit/`에 보존한다.

| 영역 | 2.0.6 결과 |
|---|---|
| 자동 검사 | `npm test`: 16 파일 54 테스트 통과. `npm run typecheck`, `npm run package:win`, npm audit(214 패키지, 취약점 0) 통과. |
| 포터블 빌드 | `release/InstaDesk-2.0.6-win-x64/`와 ZIP 생성. ZIP 158,395,066 bytes, SHA-256 `f2f15123ec82b094d4829866ce22a79d361406beeffb6242bceca62bfb0bdd9f`. |
| GitHub | `main` 커밋 `de0562a` 푸시. [Windows CI 41280584703](https://github.com/Yupkidangju/instadesk/actions/runs/41280584703): 타입·54개 테스트·감사·패키징·아티팩트 모두 성공. |
| 실 키 API | 저장된 실 키로 `sleipnir-01` 목록 조회 성공. 앱의 직접 API 경로에서 가짜 키 요청도 서버 `401 malformed_key`로 돌아왔으며 CORS 오류는 없었다. |
| 실 PTY | 2.0.2 이상에서 `PTY LIVE` 연결과 읽기 전용 `pwd`의 `/data/home` 응답 확인. 2.0.6 SPLIT에서도 PTY LIVE 확인. |
| 실 Desktop | 대시보드 링크를 격리된 최상위 `WebContentsView`로 열어 실제 영상 표시. 2.0.6 SPLIT에서 원격 뷰 `devicePixelRatio=1`, 패널/뷰포트 551×638, 실제 framebuffer 1073×1038, 표시 canvas 551×533. 패널 폭이 491px가 된 상태에서는 canvas가 491×475로 변하고 화면비가 유지됨. 서버 상태의 1280×800 보고 값으로 뷰를 제한하지 않는다. |
| 볼트 | 2.0.2~2.0.6 재시작 사이 암호화 프로필 1개 보존, 앱 시작 시 잠김. 평문 키·마스터 암호를 읽거나 저장하지 않음. |
| 웹 게시 종료 | GitHub Pages 삭제 후 API `404`, 개인 Cloudflare Worker 삭제 후 `/health` `404`. GitHub 저장소와 원본 감사 보고서 보존. |
| 로컬 정리 | 자동 승인 검토가 영구 삭제 명령을 `blocked by policy`로 거부했다. 경로·내용·실행 프로세스를 확인한 뒤 이전 2.0.0~2.0.5 빌드 폴더/ZIP과 임시 추출 폴더를 Windows 휴지통으로 옮김. `release/`에는 2.0.6 폴더와 ZIP만 남음. 사용자 볼트 데이터는 건드리지 않음. |

## 남은 조건과 보안 메모

- VM 생성·전원 제어·삭제, 실 SSE exec, Desktop 마우스/키보드 입력과 takeover/handback, 장시간 사용, 다른 PC, 코드 서명은 이번 실 검증 범위 밖이다. 따라서 해당 기능을 전체 PASS로 표시하지 않는다.
- 실 PTY 화면과 이 대화의 캡처에 API 키 형식의 문자열이 표시됐다. **실제 키였다면 노출된 것으로 간주하고 InstaBox에서 폐기·교체해야 한다.** 값은 프로젝트 문서·커밋에 기록하지 않았다. 원격 셸 기록에 남았는지도 사용자 확인이 필요하다.
- 2.0.0에서 등록했던 볼트 기록은 종료·재실행 뒤 보이지 않았다. 당시 동시 인스턴스의 Chromium 캐시 잠금 오류가 관찰됐지만 직접 원인은 확정하지 못했다. 이후 단일 인스턴스 잠금을 추가했고, 새로 등록한 프로필의 2.0.2~2.0.6 보존을 확인했다.

판정: **요청된 Windows Electron 전환, 실 VM 목록·PTY·Desktop 표시와 SPLIT 화면 맞춤은 범위 내 검증 통과. 위 미검증 기능의 전체 릴리스 판정은 HOLD.**
