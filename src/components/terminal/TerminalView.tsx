// src/components/terminal/TerminalView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { instaboxClient } from '../../services/instaboxClient';
import { RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { describeTerminalFailure, retryDelayMs, type TerminalFailure } from './terminalRetry';
import { workspaceWheelDelta } from './terminalWheelPolicy';
import { terminalHistoryCache } from './terminalHistoryCache';
import { SessionActivityTracker } from './sessionActivity';
import { terminalRegistry } from './terminalRegistry';

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
  const reconnectRef = useRef<() => void>(() => {});
  const clearRef = useRef<() => void>(() => {});
  const skipNextHistorySaveRef = useRef(false);
  const tileCount = useAppStore((state) => state.tiles.length);
  const isMirrored = useAppStore((state) => state.isKeystrokeMirroring && state.syncedTileIds.includes(tileId));
  const isSensitiveMirrorPaused = useAppStore((state) =>
    Boolean(
      state.sessionActivities[tileId]?.isSensitive ||
        state.syncedTileIds.some((id) => state.sessionActivities[id]?.isSensitive)
    )
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const workspace = element.closest<HTMLElement>('[data-workspace-scroll]');
      if (!workspace) return;
      const delta = workspaceWheelDelta(event, workspace.clientHeight);
      event.preventDefault();
      if (delta === null) return;
      event.stopPropagation();
      workspace.scrollTop += delta;
    };
    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => element.removeEventListener('wheel', onWheel, true);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    skipNextHistorySaveRef.current = false;
    const restored = terminalHistoryCache.get(tileId, sessionName);
    let restoreComplete = !restored;

    // 1. xterm 인스턴스 초기화 (네오스위스 다크 팔레트)
    const term = new Terminal({
      cols: restored?.cols ?? 80,
      rows: restored?.rows ?? 24,
      scrollback: 1000,
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
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(serializeAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let isDisposed = false;
    let failed = false;
    let ready = false;
    let unregisterDesktop: (() => void) | null = null;
    const bridge = window.instadeskDesktop;
    const tracker = new SessionActivityTracker();
    const demoTimers = new Set<ReturnType<typeof setTimeout>>();
    let sendLocalInput: (data: string) => boolean = () => false;

    const publishActivity = (info: ReturnType<SessionActivityTracker['getState']>) => {
      if (!isDisposed) useAppStore.getState().setSessionActivity(tileId, info);
    };

    const unregisterRegistry = terminalRegistry.register({
      tileId,
      sendInput: (data) => sendLocalInput(data),
      focus: () => {
        (term as unknown as { focus?: () => void }).focus?.();
        containerRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      },
      clear: () => clearRef.current(),
      reconnect: () => reconnectRef.current(),
    });

    const fail = (failure: TerminalFailure) => {
      if (isDisposed || failed) return;
      failed = true;
      ready = false;
      useAppStore.getState().releaseSession(tileId);
      publishActivity(tracker.markDisconnected());
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

    const shouldMirrorInput = () => {
      const { isKeystrokeMirroring, syncedTileIds, sessionActivities } = useAppStore.getState();
      if (!isKeystrokeMirroring || !syncedTileIds.includes(tileId)) return false;
      const sensitiveActive =
        tracker.getState().isSensitive ||
        syncedTileIds.some((id) => sessionActivities[id]?.isSensitive);
      return !sensitiveActive;
    };

    const mirrorIfAllowed = (data: string, allowed: boolean) => {
      if (!allowed) return;
      const { isKeystrokeMirroring, syncedTileIds } = useAppStore.getState();
      if (isKeystrokeMirroring && syncedTileIds.includes(tileId)) {
        terminalRegistry.mirrorInput(tileId, data, syncedTileIds);
      }
    };

    // 2. 터미널 연결 시작
    const connectTerminal = async () => {
      setStatus('connecting');
      setErrorMessage(null);
      setRetryInfo(null);
      publishActivity({ status: 'disconnected', updatedAt: Date.now() });

      term.writeln('\x1b[38;5;244m[INSTABOX DECK] Initializing terminal PTY session...\x1b[0m');

      // 데모 모드 가상 PTY 시뮬레이터
      if (profileId.startsWith('demo-')) {
        const promptLine = '\x1b[1;31muser@instabox-node\x1b[0m:\x1b[1;34m/data/home\x1b[0m$ ';
        const writeDemoOutput = (text: string) => {
          if (isDisposed) return;
          term.write(text);
          publishActivity(tracker.recordOutput(text));
        };
        const scheduleDemo = (fn: () => void, ms: number) => {
          const timer = setTimeout(() => {
            demoTimers.delete(timer);
            if (!isDisposed) fn();
          }, ms);
          demoTimers.add(timer);
        };

        let demoReady = false;
        let currentInput = '';
        let awaitingConfirm: 'shell' | 'agent' | 'password' | null = null;

        const clearDemoTimers = () => {
          for (const timer of demoTimers) clearTimeout(timer);
          demoTimers.clear();
        };

        const submitDemoCommand = (cmd: string) => {
          if (cmd === 'clear') {
            term.clear();
            publishActivity(tracker.reset());
            writeDemoOutput(promptLine);
          } else if (cmd === 'uname -a') {
            writeDemoOutput('Linux instabox-demo-node 6.6.0 #1 SMP PREEMPT x86_64 GNU/Linux\r\n' + promptLine);
          } else if (cmd === 'htop' || cmd === 'top') {
            writeDemoOutput(
              '\x1b[7m  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND \x1b[0m\r\n' +
              '  812 user      20   0  342.1M  84.2M  32.1M S   2.4   1.0   0:14.23 xfce4-session\r\n' +
              '  920 user      20   0  1240.2M 240.1M  64.2M S   4.8   2.9   0:32.10 chromium\r\n' +
              ' 1204 user      20   0   14.2M   4.1M   2.8M R   0.0   0.1   0:00.08 htop\r\n' +
              promptLine
            );
          } else if (cmd === 'build' || cmd === 'sleep' || cmd === 'deploy') {
            writeDemoOutput(`[${sessionName}] Running ${cmd} pipeline...\r\n`);
            scheduleDemo(() => writeDemoOutput('[1/2] Compiling artifacts...\r\n'), 500);
            scheduleDemo(() => writeDemoOutput('[2/2] Done.\r\n' + promptLine), 1200);
          } else if (cmd === 'apt' || cmd === 'confirm') {
            awaitingConfirm = 'shell';
            writeDemoOutput('After this operation, 42.1 MB of additional disk space will be used.\r\nDo you want to continue? [Y/n] ');
          } else if (cmd === 'agent' || cmd === 'ask') {
            awaitingConfirm = 'agent';
            writeDemoOutput('Agent wants to run: npm test\r\nAllow this command execution? (1. Yes / 2. Always / 3. No) [1-3]: ');
          } else if (cmd === 'sudo' || cmd.startsWith('sudo ')) {
            awaitingConfirm = 'password';
            writeDemoOutput('[sudo] password for user: ');
          } else if (cmd) {
            writeDemoOutput(`instabox: ${cmd}: command executed in demo microVM\r\n` + promptLine);
          } else {
            writeDemoOutput(promptLine);
          }
        };

        const handleDemoChar = (ch: string) => {
          if (ch === '\u0003') {
            clearDemoTimers();
            currentInput = '';
            awaitingConfirm = null;
            const act = tracker.recordInput('\u0003');
            if (act) publishActivity(act);
            writeDemoOutput('^C\r\n' + promptLine);
            return;
          }

          if (ch === '\u001b') {
            if (awaitingConfirm) {
              clearDemoTimers();
              currentInput = '';
              awaitingConfirm = null;
              const act = tracker.recordInput('\r');
              if (act) publishActivity(act);
              writeDemoOutput('^[\r\nCancelled.\r\n' + promptLine);
            }
            return;
          }

          if (ch === '\r' || ch === '\n') {
            if (awaitingConfirm) {
              const mode = awaitingConfirm;
              const answer = mode === 'password' ? '***' : (currentInput.trim().toLowerCase() || 'y');
              currentInput = '';
              awaitingConfirm = null;
              const act = tracker.recordInput('\r');
              if (act) publishActivity(act);
              writeDemoOutput('\r\n');
              if (mode === 'agent') {
                writeDemoOutput(answer === 'n' || answer === '3' ? 'Action cancelled by user.\r\n' : 'Tool approved. Applying changes...\r\n');
              } else if (mode === 'password') {
                writeDemoOutput('Authentication succeeded.\r\n');
              } else {
                writeDemoOutput(answer === 'n' ? 'Aborted.\r\n' : 'Continuing operation...\r\n');
              }
              scheduleDemo(() => {
                writeDemoOutput(`Completed (${answer}).\r\n` + promptLine);
              }, 350);
              return;
            }

            writeDemoOutput('\r\n');
            const cmd = currentInput.trim();
            currentInput = '';
            const act = tracker.recordInput('\r');
            if (act) publishActivity(act);
            submitDemoCommand(cmd);
            return;
          }

          if (ch === '\u007F' || ch === '\b') {
            if (currentInput.length > 0) {
              currentInput = currentInput.slice(0, -1);
              if (awaitingConfirm !== 'password') term.write('\b \b');
            }
            return;
          }

          currentInput += ch;
          if (awaitingConfirm !== 'password') term.write(ch);
        };

        const handleDemoData = (data: string): boolean => {
          if (!demoReady || isDisposed) return false;
          // 방향키 등 ANSI 이스케이프 시퀀스는 데모 줄 버퍼를 오염시키지 않도록 무시한다.
          if (data.length > 1 && data.startsWith('\u001b[')) return true;

          for (let i = 0; i < data.length; i += 1) {
            const ch = data[i];
            if (ch === '\r' && data[i + 1] === '\n') {
              handleDemoChar('\r');
              i += 1;
              continue;
            }
            handleDemoChar(ch);
          }
          return true;
        };

        sendLocalInput = handleDemoData;

        scheduleDemo(() => {
          if (isDisposed) return;
          demoReady = true;
          setStatus('connected');
          term.writeln('\x1b[1;32m● CONNECTED TO DEMO MICROVM GATEWAY (xterm-256color)\x1b[0m');
          term.writeln('\x1b[90mSession: ' + sessionName + ' | Host: instabox-' + machineId + '\x1b[0m\n');
          writeDemoOutput(promptLine);
          term.onData((data) => {
            const allowMirror = shouldMirrorInput();
            handleDemoData(data);
            mirrorIfAllowed(data, allowMirror);
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
          sendLocalInput = (data: string) => {
            if (!ready || failed || isDisposed) return false;
            const act = tracker.recordInput(data);
            if (act) publishActivity(act);
            void bridge.sendTerminal(tileId, data).catch(() => {});
            return true;
          };
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
              publishActivity(tracker.markConnected());
              term.writeln('\x1b[1;32m● CONNECTED TO INSTABOX PTY GATEWAY\x1b[0m\r\n');
              void bridge.resizeTerminal(tileId, term.cols, term.rows).catch(() => {});
            } else if (event.type === 'data') {
              if (!failed && event.data) {
                term.write(event.data);
                publishActivity(tracker.recordOutput(event.data));
              }
            } else if (event.type === 'exit') {
              failed = true;
              useAppStore.getState().releaseSession(tileId);
              publishActivity(tracker.markDisconnected());
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
          term.onData((data) => {
            const allowMirror = shouldMirrorInput();
            if (sendLocalInput(data)) mirrorIfAllowed(data, allowMirror);
          });
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

    if (restored) {
      term.write(restored.data, () => {
        if (isDisposed) return;
        restoreComplete = true;
        term.scrollLines(-restored.scrollOffset);
        void connectTerminal();
      });
    } else void connectTerminal();

    // 윈도우/컨테이너 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      for (const timer of demoTimers) clearTimeout(timer);
      demoTimers.clear();
      unregisterRegistry();
      const state = useAppStore.getState();
      const skipSave = skipNextHistorySaveRef.current;
      skipNextHistorySaveRef.current = false;
      const keepHistory = state.tiles.some((tile) => tile.tileId === tileId) &&
        (profileId.startsWith('demo-') || state.isVaultUnlocked);
      if (skipSave) {
        terminalHistoryCache.clearSession(tileId, sessionName);
      } else if (keepHistory && restoreComplete) {
        try {
          const buffer = term.buffer.active;
          terminalHistoryCache.save(tileId, profileId, sessionName,
            serializeAddon.serialize({ scrollback: 1000, excludeAltBuffer: true }),
            buffer.baseY - buffer.viewportY, term.cols, term.rows);
        } catch { terminalHistoryCache.clearSession(tileId, sessionName); }
      } else if (!keepHistory) terminalHistoryCache.clearTile(tileId);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      resizeObserver.disconnect();
      unregisterDesktop?.();
      if (bridge) void bridge.closeTerminal(tileId);
      useAppStore.getState().releaseSession(tileId);
      useAppStore.getState().clearSessionActivity(tileId);
      term.dispose();
      if (termRef.current === term) termRef.current = null;
      if (fitAddonRef.current === fitAddon) fitAddonRef.current = null;
    };
  }, [tileId, machineId, profileId, sessionName, retryGeneration]);

  const handleReconnect = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryAttemptRef.current = 0;
    setRetryInfo(null);
    skipNextHistorySaveRef.current = true;
    terminalHistoryCache.clearSession(tileId, sessionName);
    const term = termRef.current as (Terminal & { reset?: () => void }) | null;
    if (term) {
      if (typeof term.reset === 'function') term.reset();
      else term.clear();
    }
    setRetryGeneration((value) => value + 1);
  };

  const handleClear = () => {
    terminalHistoryCache.clearSession(tileId, sessionName);
    termRef.current?.clear();
  };

  reconnectRef.current = handleReconnect;
  clearRef.current = handleClear;

  return (
    <div data-terminal-panel className="flex flex-col h-full bg-[#09090b] overflow-hidden select-text">
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

          {tileCount > 1 && <span className="text-zinc-500 text-[10px]" title="Wheel scrolls terminal history; Shift+wheel scrolls VM tiles">
            WHEEL: TERM · SHIFT+WHEEL: TILES
          </span>}

          {isMirrored && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                isSensitiveMirrorPaused
                  ? 'border-amber-600 bg-amber-950/50 text-amber-200'
                  : 'border-swiss-red bg-swiss-red/20 text-red-300'
              }`}
            >
              {isSensitiveMirrorPaused ? 'MIRROR PAUSED (SECRET)' : 'SYNC MIRROR'}
            </span>
          )}

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
