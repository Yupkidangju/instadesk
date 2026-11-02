// src/components/terminal/TerminalView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { instaboxClient } from '../../services/instaboxClient';
import { RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { describeTerminalFailure, retryDelayMs, type TerminalFailure } from './terminalRetry';

interface TerminalViewProps {
  tileId: string;
  machineId: string;
  profileId: string;
  sessionName: string;
  onSessionChange: (session: string) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  tileId,
  machineId,
  profileId,
  sessionName,
  onSessionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [status, setStatus] = useState<'connecting' | 'negotiating' | 'connected' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. xterm 인스턴스 초기화 (네오스위스 다크 팔레트)
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#e53935', // Swiss Red cursor
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(229, 57, 53, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#ec4899',
        cyan: '#06b6d4',
        white: '#fafafa',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#f472b6',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let isDisposed = false;
    let failed = false;
    let ready = false;
    let unregisterDesktop: (() => void) | null = null;
    const bridge = window.instadeskDesktop;

    const fail = (failure: TerminalFailure) => {
      if (isDisposed || failed) return;
      failed = true;
      ready = false;
      useAppStore.getState().releaseSession(tileId);
      setStatus('disconnected');
      setErrorMessage(describeTerminalFailure(failure));
      const nextAttempt = retryAttemptRef.current + 1;
      const delay = retryDelayMs(failure, nextAttempt);
      if (delay !== null && useAppStore.getState().isVaultUnlocked) {
        setRetryInfo(`Retry ${nextAttempt}/3 in ${Math.ceil(delay / 1000)}s`);
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (isDisposed || !useAppStore.getState().isVaultUnlocked ||
              !useAppStore.getState().profiles.some((profile) => profile.id === profileId)) return;
          retryAttemptRef.current = nextAttempt;
          setRetryGeneration((value) => value + 1);
        }, delay);
      } else setRetryInfo(null);
    };

    // 2. 터미널 연결 시작
    const connectTerminal = async () => {
      setStatus('connecting');
      setErrorMessage(null);
      setRetryInfo(null);

      term.writeln('\x1b[38;5;244m[INSTABOX DECK] Initializing terminal PTY session...\x1b[0m');

      // 데모 모드 가상 PTY 시뮬레이터
      if (profileId.startsWith('demo-')) {
        setTimeout(() => {
          if (isDisposed) return;
          setStatus('connected');
          term.writeln('\x1b[1;32m● CONNECTED TO DEMO MICROVM GATEWAY (xterm-256color)\x1b[0m');
          term.writeln('\x1b[90mSession: ' + sessionName + ' | Host: instabox-' + machineId + '\x1b[0m\n');
          term.write('\x1b[1;31muser@instabox-node\x1b[0m:\x1b[1;34m/data/home\x1b[0m$ ');

          let currentInput = '';
          term.onData((data) => {
            if (data === '\r') {
              term.write('\r\n');
              const cmd = currentInput.trim();
              if (cmd === 'clear') {
                term.clear();
              } else if (cmd === 'uname -a') {
                term.writeln('Linux instabox-demo-node 6.6.0 #1 SMP PREEMPT x86_64 GNU/Linux');
              } else if (cmd === 'htop' || cmd === 'top') {
                term.writeln('\x1b[7m  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND \x1b[0m');
                term.writeln('  812 user      20   0  342.1M  84.2M  32.1M S   2.4   1.0   0:14.23 xfce4-session');
                term.writeln('  920 user      20   0  1240.2M 240.1M  64.2M S   4.8   2.9   0:32.10 chromium');
                term.writeln(' 1204 user      20   0   14.2M   4.1M   2.8M R   0.0   0.1   0:00.08 htop');
              } else if (cmd) {
                term.writeln(`instabox: ${cmd}: command executed in demo microVM`);
              }
              currentInput = '';
              term.write('\x1b[1;31muser@instabox-node\x1b[0m:\x1b[1;34m/data/home\x1b[0m$ ');
            } else if (data === '\u007F') { // Backspace
              if (currentInput.length > 0) {
                currentInput = currentInput.slice(0, -1);
                term.write('\b \b');
              }
            } else {
              currentInput += data;
              term.write(data);
            }
          });
        }, 300);
        return;
      }

      // 실제 PTY 소켓은 Electron 메인 프로세스가 소유한다.
      try {
        useAppStore.getState().reserveSession(tileId, profileId);
        const { url, protocols } = await instaboxClient.getTerminalWebSocketUrl(
          profileId,
          machineId,
          sessionName
        );
        if (isDisposed || !useAppStore.getState().isVaultUnlocked || !useAppStore.getState().profiles.some((p) => p.id === profileId)) {
          useAppStore.getState().releaseSession(tileId);
          return;
        }

        if (bridge) {
          unregisterDesktop = bridge.onTerminalEvent((event) => {
            if (isDisposed || event.id !== tileId) return;
            if (event.type === 'open') {
              setStatus('negotiating');
            } else if (event.type === 'ready') {
              if (failed) return;
              ready = true;
              setStatus('connected');
              retryAttemptRef.current = 0;
              useAppStore.getState().activateSession(tileId);
              term.writeln('\x1b[1;32m● CONNECTED TO INSTABOX PTY GATEWAY\x1b[0m\r\n');
              void bridge.resizeTerminal(tileId, term.cols, term.rows).catch(() => {});
            } else if (event.type === 'data') {
              if (!failed && event.data) term.write(event.data);
            } else if (event.type === 'exit') {
              failed = true;
              useAppStore.getState().releaseSession(tileId);
              setStatus('disconnected');
              term.writeln(`\r\n\x1b[33m[Session exited with code ${event.exitCode ?? 'unknown'}]\x1b[0m`);
              void bridge.closeTerminal(tileId);
            } else if (event.type === 'error') {
              fail(event);
            } else if (event.type === 'close' && !failed) {
              if (event.closeCode === 1000) fail({ category: 'server', closeCode: 1000, at: event.at });
              else fail({ category: 'network', closeCode: event.closeCode, at: event.at });
            }
          });
          await bridge.openTerminal({ id: tileId, profileId, sessionName, url, protocols: protocols ?? [] });
          if (isDisposed) { void bridge.closeTerminal(tileId); return; }
          term.onData((data) => { if (ready && !failed) void bridge.sendTerminal(tileId, data).catch(() => {}); });
          term.onResize(({ cols, rows }) => { void bridge.resizeTerminal(tileId, cols, rows).catch(() => {}); });
          return;
        }
        throw new Error('Electron desktop bridge unavailable');
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        const category = status === 401 || status === 403 ? 'auth' : status === 409 ? 'machine' :
          status === 429 ? 'rate_limit' : status === 503 ? 'unavailable' : status ? 'server' : 'network';
        fail({ category, httpStatus: status, retryAfterMs: (err as { retryAfterMs?: number }).retryAfterMs,
          at: new Date().toISOString() });
      }
    };

    connectTerminal();

    // 윈도우/컨테이너 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      resizeObserver.disconnect();
      unregisterDesktop?.();
      if (bridge) void bridge.closeTerminal(tileId);
      useAppStore.getState().releaseSession(tileId);
      term.dispose();
    };
  }, [tileId, machineId, profileId, sessionName, retryGeneration]);

  const handleReconnect = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryAttemptRef.current = 0;
    setRetryInfo(null);
    if (termRef.current) {
      termRef.current.clear();
    }
    setRetryGeneration((value) => value + 1);
  };

  const handleClear = () => {
    termRef.current?.clear();
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] overflow-hidden select-text">
      {/* 서브 툴바 */}
      <div className="min-h-8 bg-zinc-950 border-b border-zinc-800 px-2 py-1 flex flex-wrap items-center justify-between gap-1 text-xs font-mono select-none flex-shrink-0">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {status === 'connected' ? (
            <span className="flex items-center text-emerald-400 space-x-1">
              <Wifi className="w-3 h-3" />
              <span className="text-[10px] font-bold">PTY LIVE</span>
            </span>
          ) : (
            <span className="flex items-center text-amber-400 space-x-1">
              <WifiOff className="w-3 h-3" />
              <span className="text-[10px] font-bold">{status.toUpperCase()}</span>
            </span>
          )}

          <span className="text-zinc-600">|</span>

          {/* 세션 선택 */}
          <div className="flex items-center space-x-1">
            <span className="text-zinc-500 text-[10px]">SESSION:</span>
            {(['main', 'agent', 'aux'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onSessionChange(s)}
                className={`px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
                  sessionName === s
                    ? 'border-swiss-red bg-swiss-red/20 text-white'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleClear}
            title="Clear Terminal Output"
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleReconnect}
            title="Reconnect Terminal Session"
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 에러 바 */}
      {errorMessage && (
        <div className="bg-red-950/60 border-b border-red-800 text-red-300 text-xs font-mono px-3 py-1.5 flex items-center justify-between">
          <span>{errorMessage}{retryInfo ? ` · ${retryInfo}` : ''}</span>
          <button
            onClick={handleReconnect}
            className="underline hover:text-white ml-2 text-[10px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* xterm DOM 렌더러 영역 */}
      <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden p-1" />
    </div>
  );
};
