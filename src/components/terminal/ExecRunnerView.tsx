// src/components/terminal/ExecRunnerView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { instaboxClient } from '../../services/instaboxClient';
import { Play, Square, Trash2, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { ExecResult } from '../../types/instabox';

interface ExecRunnerViewProps {
  machineId: string;
  profileId: string;
}

export const ExecRunnerView: React.FC<ExecRunnerViewProps> = ({ machineId, profileId }) => {
  const [cmd, setCmd] = useState('uname -a && free -h');
  const [cwd, setCwd] = useState('/data/home');
  const [isRunning, setIsRunning] = useState(false);
  const [outputLines, setOutputLines] = useState<Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>>([]);
  const [lastResult, setLastResult] = useState<ExecResult | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleRun = async () => {
    if (!cmd.trim() || isRunning) return;

    setIsRunning(true);
    setLastResult(null);
    setOutputLines((prev) => [
      ...prev,
      { type: 'info', text: `\n$ ${cmd.trim()} (cwd: ${cwd})` },
    ]);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    try { await instaboxClient.streamExec(
      profileId,
      machineId,
      { cmd: cmd.trim(), cwd: cwd.trim() || '/data/home' },
      (stdout) => {
        setOutputLines((prev) => [...prev, { type: 'stdout', text: stdout }]);
      },
      (stderr) => {
        setOutputLines((prev) => [...prev, { type: 'stderr', text: stderr }]);
      },
      (res) => {
        setIsRunning(false);
        setLastResult(res);
        setOutputLines((prev) => [
          ...prev,
          { type: 'info', text: `[Exit Code: ${res.exitCode}]` },
        ]);
      },
      (err) => {
        if (err.name === 'AbortError') return;
        setOutputLines((prev) => [
          ...prev,
          { type: 'stderr', text: `[Error: ${err.message}]` },
        ]);
      },
      ac.signal
    ); } finally {
      if (abortControllerRef.current === ac) abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setOutputLines((prev) => [...prev, { type: 'info', text: '[Execution cancelled by user]' }]);
    }
  };

  const handleClear = () => {
    setOutputLines([]);
    setLastResult(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] overflow-hidden select-text font-mono">
      {/* 명령 입력 컨트롤 바 */}
      <div className="p-2.5 bg-zinc-950 border-b border-zinc-800 space-y-2 select-none flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-swiss-red flex-shrink-0" />
          <input
            type="text"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRun()}
            placeholder="ENTER COMMAND (e.g., git status, docker ps)..."
            disabled={isRunning}
            className="flex-1 bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          {isRunning ? (
            <button
              onClick={handleStop}
              className="neo-btn bg-red-950/60 border-red-800 text-red-300 hover:bg-red-900"
            >
              <Square className="w-3.5 h-3.5 mr-1 fill-current" />
              STOP
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="neo-btn-primary"
            >
              <Play className="w-3.5 h-3.5 mr-1 fill-current" />
              RUN
            </button>
          )}
          <button
            onClick={handleClear}
            title="Clear output"
            className="p-1.5 neo-btn text-zinc-400 hover:text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center space-x-1">
            <span>CWD:</span>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              className="bg-transparent border-b border-zinc-800 text-zinc-400 px-1 focus:outline-none focus:border-zinc-500 w-36"
            />
          </div>
          {lastResult && (
            <div className="flex items-center space-x-1">
              {lastResult.exitCode === 0 ? (
                <span className="flex items-center text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  EXIT: 0
                </span>
              ) : (
                <span className="flex items-center text-red-400">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  EXIT: {lastResult.exitCode}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 출력 콘솔 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed space-y-1 font-mono bg-[#09090b]"
      >
        {outputLines.length === 0 ? (
          <div className="text-zinc-600 py-8 text-center">
            Ready to execute. SSE event stream will render output in real-time.
          </div>
        ) : (
          outputLines.map((line, idx) => (
            <pre
              key={idx}
              className={`whitespace-pre-wrap font-mono ${
                line.type === 'stdout'
                  ? 'text-zinc-200'
                  : line.type === 'stderr'
                  ? 'text-red-400'
                  : 'text-zinc-500 font-bold'
              }`}
            >
              {line.text}
            </pre>
          ))
        )}
      </div>
    </div>
  );
};
