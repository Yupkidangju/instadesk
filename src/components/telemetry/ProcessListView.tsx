// src/components/telemetry/ProcessListView.tsx
import React, { useState, useEffect } from 'react';
import { instaboxClient } from '../../services/instaboxClient';
import { ProcessListResponse } from '../../types/instabox';
import { RefreshCw, Cpu } from 'lucide-react';

interface ProcessListViewProps {
  machineId: string;
  profileId: string;
}

export const ProcessListView: React.FC<ProcessListViewProps> = ({ machineId, profileId }) => {
  const [data, setData] = useState<ProcessListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProcesses = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await instaboxClient.getProcesses(profileId, machineId);
      setData(res);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to list processes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, [machineId, profileId]);

  return (
    <div className="flex flex-col h-full bg-[#09090b] font-mono text-xs overflow-hidden select-text">
      {/* 툴바 */}
      <div className="h-8 bg-zinc-950 border-b border-zinc-800 px-3 flex items-center justify-between select-none flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-[11px] text-zinc-200 uppercase tracking-wider">
            GUEST PROCESS TABLE (ps -e)
          </span>
          {data?.capturedAt && (
            <span className="text-zinc-500 text-[10px]">
              Captured: {new Date(data.capturedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <button
          onClick={loadProcesses}
          title="Refresh Process List"
          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-950/60 border-b border-red-800 text-red-300 text-xs font-mono px-3 py-1">
          {errorMessage}
        </div>
      )}

      {/* 프로세스 테이블 */}
      <div className="flex-1 overflow-y-auto p-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
              <th className="py-1 px-2">PID</th>
              <th className="py-1 px-2">USER</th>
              <th className="py-1 px-2">CPU%</th>
              <th className="py-1 px-2">MEM%</th>
              <th className="py-1 px-2">TIME</th>
              <th className="py-1 px-2">COMMAND</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-[11px]">
            {data?.processes && data.processes.length > 0 ? (
              data.processes.map((p) => (
                <tr key={p.pid} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                  <td className="py-1 px-2 font-bold text-zinc-200">{p.pid}</td>
                  <td className="py-1 px-2 text-zinc-400">{p.user}</td>
                  <td className="py-1 px-2 text-emerald-400">{p.cpuPct.toFixed(1)}</td>
                  <td className="py-1 px-2 text-cyan-400">{p.memPct.toFixed(1)}</td>
                  <td className="py-1 px-2 text-zinc-500">{p.elapsedSec}s</td>
                  <td className="py-1 px-2 text-zinc-200 truncate max-w-xs" title={p.args}>
                    {p.args}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-600">
                  {isLoading ? 'Scanning processes...' : 'No active processes returned.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
