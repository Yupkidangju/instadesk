import type { SessionActivityInfo, SessionActivityStatus } from '../../types/instabox';

const MAX_TAIL_CHARS = 4096;

// ANSI CSI, OSC, 및 단일 ESC 시퀀스 제거
const ANSI_PATTERN =
  /[\u001b\u009b](?:\[[0-9;?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[PX^_][^\u001b]*\u001b\\|[@-Z\\-_])/g;

export function stripAnsiAndControl(raw: string): string {
  // 커서 우측 이동(CSI nC)은 단어 구분 공백으로 복원해 TUI 문장이 붙는 현상을 방지한다.
  const spaced = raw.replace(/[\u001b\u009b]\[(\d*)C/g, (_, count: string) =>
    ' '.repeat(Math.min(8, Math.max(1, Number(count) || 1)))
  );
  const noAnsi = spaced.replace(ANSI_PATTERN, '').replace(/\u0007/g, '');
  const lines = noAnsi.split('\n');
  const resolved = lines.map((line) => {
    const segments = line.split('\r');
    const last = segments[segments.length - 1];
    // 줄 맨 앞 \r 뒤에 비어있으면 직전 세그먼트(프롬프트 등)를 유지한다.
    if (last === '' && segments.length > 1) {
      for (let i = segments.length - 2; i >= 0; i -= 1) {
        if (segments[i] !== '') return segments[i];
      }
    }
    return last;
  });
  return resolved.join('\n');
}

const PROMPT_PATTERNS: RegExp[] = [
  /\[[yYnN]\/[yYnN]\]/,
  /\([yYnN]\/[yYnN]\)/,
  /[\[(]yes\/no(?:\/\[?fingerprint\]?)?[\])]/i,
  /\b(?:do you want to continue|are you sure|want to proceed|proceed anyway|overwrite\b.*\?|replace\b.*\?)\s*\??\s*$/i,
  /\bpress\s+(?:enter|return|any key)\s+to\s+continue\b/i,
  /\b(?:password|passphrase|pin|otp|verification code)(?:\s+for\s+[^\n:]{1,80})?:\s*$/i,
  /\b(?:enter|input)\s+(?:your\s+)?(?:password|passphrase|token|key|choice|selection|number)[^:\n]*:\s*$/i,
  // AI 에이전트 & CLI 도구 승인/선택 프롬프트
  /\b(?:allow|approve|permit|confirm|trust|grant)\s+(?:this\s+)?(?:tool|command|action|edit|write|file|bash|shell|exec|workspace|folder|access)[^?\n]*\??/i,
  /\b(?:do you want to|would you like to)\s+(?:make this edit|apply|create|delete|remove|run|execute|proceed|allow|continue|install|overwrite)[^?\n]*\??/i,
  /\b(?:yes,\s*allow|allow once|allow always|approve and run|always allow)\b/i,
  /\b(?:enter to (?:select|confirm)|space to select|arrow keys to|esc to cancel|↑\/↓)\b/i,
  /^\s*[?❯›]\s+.+\?\s*(?:\([^)]+\))?\s*$/m,
  /\[\d+-\d+\]\s*:\s*$/,
];

const NUMBERED_CHOICE_LINE = /^\s*(?:[❯›>*]\s*)?(?:\d{1,2}[.)]\s+|\[[ xX*✓✔]?\d*\])\S/;

const SHELL_PROMPT_PATTERNS: RegExp[] = [
  // user@host:path$ / root@host:~#
  /^(?:\([^)]+\)\s*)?[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^$#%>\n]*[$#%]\s*$/,
  // [user@host dir]$
  /^\[[^\]]+@[^\]]+\]\s*[$#%]\s*$/,
  // bash-5.2$ / sh-5.2# / zsh%
  /^(?:bash|sh|zsh|fish|ash|dash)(?:-[\d.]+)?\s*[$#%]\s*$/,
  // Python / Node / generic prompt
  /^(?:>>>|\.\.\.)\s*$/,
  /^(?:[❯➜λ]|PS [^>\n]+>)\s*$/,
  // 경로 + 프롬프트 기호 (예: ~/project $ 또는 /data/home >)
  /^(?:\([^)]+\)\s*)?(?:~|\/[A-Za-z0-9._/@-]+)\s*[$#%❯]\s*$/,
  // 에이전트 TUI 대기 입력 줄
  /^[│|]?\s*[>❯]\s*(?:Type a message|Ask anything|Send a message)?\s*$/i,
];

const RUNNING_HINTS: RegExp[] = [
  /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,
  /\b(?:esc to interrupt|ctrl\+c to cancel|thinking\.{2,}|working\.{2,})\b/i,
];

const SENSITIVE_PROMPT_PATTERN =
  /(?:\b(?:password|passphrase|pin|otp|verification code|secret|api[_ ]?key)(?:\s+for\s+[^\n:]{1,80})?:|\b(?:enter|input)\s+(?:your\s+)?(?:password|passphrase|pin|otp|token|secret|api[_ ]?key)\b)/i;

export interface ActivityDetectionResult {
  status: SessionActivityStatus;
  summary?: string;
  isSensitive?: boolean;
}

/**
 * 누적된 터미널 텍스트 꼬리를 분석해 현재 세션 상태(🔴/🟡/🟢)를 판별한다.
 */
export function detectSessionActivityFromTail(cleanText: string): ActivityDetectionResult {
  const trimmed = cleanText.replace(/\s+$/g, '');
  if (!trimmed) return { status: 'idle' };

  const allLines = cleanText.split('\n');
  const rawLastLine = allLines[allLines.length - 1] ?? '';
  const nonEmptyLines = allLines.map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const tailLines = nonEmptyLines.slice(-6);
  const lastLine = tailLines[tailLines.length - 1] ?? '';
  const tailBlock = tailLines.join('\n');

  // 1. 진행 중 스피너·중단 안내가 명시되어 있고 아직 질문이 아니면 실행 중 우선
  // (단, 선택 프롬프트가 동시에 보이면 질문 우선)
  const hasRunningHint = RUNNING_HINTS.some((re) => re.test(tailBlock));
  const lastLineForPrompt = rawLastLine.trimStart();
  const isLastLineShellPrompt =
    SHELL_PROMPT_PATTERNS.some((re) => re.test(lastLineForPrompt)) ||
    SHELL_PROMPT_PATTERNS.some((re) => re.test(lastLine.trim()));

  // 마지막 줄 자체가 쉘/REPL/TUI 입력 프롬프트로 복귀한 경우 이전 줄의 과거 질문보다 우선해 idle로 판정
  if (isLastLineShellPrompt) {
    return { status: 'idle' };
  }

  // 2. 질문 / 선택 / 승인 프롬프트 판별 (🟡)
  for (const line of [...tailLines].reverse()) {
    const candidate = line.trim();
    if (!candidate) continue;
    if (PROMPT_PATTERNS.some((re) => re.test(candidate))) {
      const isSensitive = SENSITIVE_PROMPT_PATTERN.test(candidate);
      return {
        status: 'prompt',
        summary: truncateSummary(candidate),
        ...(isSensitive ? { isSensitive: true } : {}),
      };
    }
  }
  if (PROMPT_PATTERNS.some((re) => re.test(tailBlock))) {
    const summaryLine = [...tailLines].reverse().find((l) => l.trim().length > 0)?.trim() ?? '';
    const isSensitive = SENSITIVE_PROMPT_PATTERN.test(tailBlock);
    return {
      status: 'prompt',
      summary: truncateSummary(summaryLine),
      ...(isSensitive ? { isSensitive: true } : {}),
    };
  }

  // 번호/커서 선택지 2줄 이상이 꼬리에 나타난 경우 (TUI 메뉴)
  const choiceMatches = tailLines.filter((l) => NUMBERED_CHOICE_LINE.test(l));
  if (choiceMatches.length >= 2) {
    const questionLine =
      [...tailLines].reverse().find((l) => l.includes('?') || l.trim().endsWith(':')) ?? choiceMatches[0];
    return { status: 'prompt', summary: truncateSummary(questionLine.trim()) };
  }

  if (hasRunningHint) {
    return { status: 'running' };
  }

  // 일반 출력이 진행 중이면 running 유지
  return { status: 'running' };
}

function truncateSummary(text: string, maxLen = 72): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen - 1)}…`;
}

/**
 * 단일 터미널 타일의 입출력 이벤트를 누적 추적하는 경량 상태 머신.
 */
export class SessionActivityTracker {
  private tail = '';
  private decoder = new TextDecoder();
  private state: SessionActivityInfo = {
    status: 'disconnected',
    updatedAt: Date.now(),
  };

  getState(): SessionActivityInfo {
    return this.state;
  }

  markConnected(): SessionActivityInfo {
    // 연결 직후 쉘 프롬프트를 기다리며 idle 또는 running 전 준비 상태
    this.state = { status: 'idle', updatedAt: Date.now() };
    return this.state;
  }

  markDisconnected(): SessionActivityInfo {
    this.tail = '';
    this.state = { status: 'disconnected', updatedAt: Date.now() };
    return this.state;
  }

  reset(): SessionActivityInfo {
    this.tail = '';
    this.state = { status: 'idle', updatedAt: Date.now() };
    return this.state;
  }

  recordInput(data: string): SessionActivityInfo | null {
    // Enter 제출 또는 Ctrl+C 시 이전 프롬프트 꼬리를 비우고 즉시 실행 중 상태로 전환
    if (data.includes('\r') || data.includes('\n')) {
      this.tail = '';
      this.state = { status: 'running', updatedAt: Date.now() };
      return this.state;
    }
    if (data === '\u0003' && this.state.status === 'prompt') {
      this.tail = '';
      this.state = { status: 'running', updatedAt: Date.now() };
      return this.state;
    }
    return null;
  }

  recordOutput(chunk: string | Uint8Array): SessionActivityInfo {
    const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    const cleaned = stripAnsiAndControl(text);
    this.tail = (this.tail + cleaned).slice(-MAX_TAIL_CHARS);
    const detected = detectSessionActivityFromTail(this.tail);
    this.state = {
      status: detected.status,
      summary: detected.summary,
      ...(detected.isSensitive ? { isSensitive: true } : {}),
      updatedAt: Date.now(),
    };
    return this.state;
  }
}
