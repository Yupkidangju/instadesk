// src/components/telemetry/MetricsLogsView.tsx
import React, { useState, useEffect } from 'react';
import { instaboxClient } from '../../services/instaboxClient';
import { MachineLogsResponse, MachineMetricsResponse } from '../../types/instabox';
import { RefreshCw, FileText, Activity } from 'lucide-react';

interface MetricsLogsViewProps {
  machineId: string;
  profileId: string;
}

export const MetricsLogsView: React.FC<MetricsLogsViewProps> = ({ machineId, profileId }) => {
  const [logs, setLogs] = useState<MachineLogsResponse | null>(null);
  const [metrics, setMetrics] = useState<MachineMetricsResponse | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'metrics'>('console');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [l, m] = await Promise.all([
        instaboxClient.getLogs(profileId, machineId, 150),
        instaboxClient.getMetrics(profileId, machineId),
      ]);
      setLogs(l);
      setMetrics(m);
    } catch (err: unknown) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, [machineId, profileId]);

  return (
    <div className="flex flex-col h-full bg-[#09090b] font-mono text-xs overflow-hidden select-text">
      {/* 서브 탭 바 */}
      <div className="h-8 bg-zinc-950 border-b border-zinc-800 px-3 flex items-center justify-between select-none flex-shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-bold transition-colors ${
              activeSubTab === 'console'
                ? 'border-swiss-red bg-swiss-red/20 text-white'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3 h-3 mr-1" />
            SERIAL CONSOLE LOGS
          </button>
          <button
            onClick={() => setActiveSubTab('metrics')}
            className={`flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-bold transition-colors ${
              activeSubTab === 'metrics'
                ? 'border-swiss-red bg-swiss-red/20 text-white'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3 h-3 mr-1" />
            30S METRICS SAMPLES
          </button>
        </div>

        <button
          onClick={loadData}
          title="Refresh Logs & Metrics"
          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSubTab === 'console' ? (
          <div>
            <div className="text-[10px] text-zinc-500 mb-2 font-bold uppercase tracking-wider">
              KERNEL BOOT & SYSTEMD JOURNAL STREAM (TAIL 150 LINES)
            </div>
            <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-zinc-950 p-2.5 border border-zinc-800">
              {logs?.console || 'No console log output available.'}
            </pre>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              CPU & MEMORY CONSUMPTION SAMPLES (LAST 5 MINUTES)
            </div>

            {metrics?.metrics && metrics.metrics.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-zinc-400 border-b border-zinc-800 pb-1">
                  <span>TIMESTAMP</span>
                  <span>CPU USAGE %</span>
                  <span>MEMORY USED</span>
                  <span>NETWORK I/O</span>
                </div>
                {metrics.metrics.map((s, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-4 gap-2 text-[11px] font-mono py-1 border-b border-zinc-900 text-zinc-300"
                  >
                    <span className="text-zinc-500">{new Date(s.timestamp).toLocaleTimeString()}</span>
                    <span className="flex items-center space-x-1">
                      <span className="font-bold text-emerald-400">{s.cpuUsedPct}%</span>
                      <div className="flex-1 bg-zinc-900 h-1.5 ml-2 border border-zinc-800 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${Math.min(100, s.cpuUsedPct)}%` }}
                        />
                      </div>
                    </span>
                    <span>
                      {(s.memUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} / {(s.memTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GiB
                    </span>
                    <span className="text-zinc-400">
                      ↓{Math.round((s.netRxBytesSec || 0) / 1024)} KB/s ↑{Math.round((s.netTxBytesSec || 0) / 1024)} KB/s
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-600 py-6 text-center">
                No metric samples recorded in the last window. Machine must be running.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
