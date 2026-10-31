// src/components/modals/BroadcastExecModal.tsx
import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { instaboxClient } from '../../services/instaboxClient';
import {
  Terminal,
  Play,
  CheckSquare,
  SquareDashed,
  X,
  Server,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ExecResult } from '../../types/instabox';

interface NodeExecState {
  machineId: string;
  name: string;
  profileId: string;
  isRunning: boolean;
  output: string;
  result: ExecResult | null;
}

export const BroadcastExecModal: React.FC = () => {
  const { isBroadcastModalOpen, closeBroadcastModal, machines } = useAppStore();

  const runningMachines = machines.filter((m) => m.state === 'running');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(runningMachines.map((m) => m.id))
  );
  const [cmd, setCmd] = useState('uptime && free -h');
  const [nodeStates, setNodeStates] = useState<Record<string, NodeExecState>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isBroadcastModalOpen) return null;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(runningMachines.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBroadcast = async () => {
    if (!cmd.trim() || selectedIds.size === 0 || isExecuting) return;

    setIsExecuting(true);
    const initialStates: Record<string, NodeExecState> = {};

    selectedIds.forEach((id) => {
      const machine = machines.find((m) => m.id === id);
      initialStates[id] = {
        machineId: id,
        name: machine?.name || id,
        profileId: machine?.profileId || 'demo-default',
        isRunning: true,
        output: '',
        result: null,
      };
    });

    setNodeStates(initialStates);

    const promises = Array.from(selectedIds).map(async (id) => {
      const machine = machines.find((m) => m.id === id);
      if (!machine) return;

      await instaboxClient.streamExec(
        machine.profileId,
        machine.id,
        { cmd: cmd.trim() },
        (stdout) => {
          setNodeStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], output: (prev[id]?.output || '') + stdout },
          }));
        },
        (stderr) => {
          setNodeStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], output: (prev[id]?.output || '') + stderr },
          }));
        },
        (result) => {
          setNodeStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], isRunning: false, result },
          }));
        },
        (err) => {
          setNodeStates((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              isRunning: false,
              output: (prev[id]?.output || '') + `\n[Error: ${err.message}]`,
            },
          }));
        }
      );
    });

    await Promise.allSettled(promises);
    setIsExecuting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="max-w-4xl w-full bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-swiss-red" />
            <span className="font-extrabold text-sm text-zinc-100 tracking-tight">
              PARALLEL BROADCAST EXECUTION // MULTI-NODE DISPATCH
            </span>
          </div>
          <button
            onClick={closeBroadcastModal}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. 대상 노드 선택 바 */}
          <div className="p-3 border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200">
                TARGET NODES ({selectedIds.size} / {runningMachines.length} RUNNING)
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[10px] text-zinc-400 hover:text-white underline"
                >
                  SELECT ALL
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[10px] text-zinc-400 hover:text-white underline"
                >
                  DESELECT ALL
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {runningMachines.length === 0 ? (
                <div className="col-span-full py-4 text-center text-zinc-500">
                  No running machines available. Start or resume nodes first.
                </div>
              ) : (
                runningMachines.map((m) => {
                  const isChecked = selectedIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSelect(m.id)}
                      className={`p-2 border text-left flex items-center space-x-2 transition-colors ${
                        isChecked
                          ? 'border-swiss-red bg-swiss-red/10 text-zinc-100'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-swiss-red flex-shrink-0" />
                      ) : (
                        <SquareDashed className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                      )}
                      <span className="truncate text-xs font-bold">{m.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. 명령 입력 및 브로드캐스트 버튼 */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
              placeholder="ENTER COMMAND TO BROADCAST..."
              disabled={isExecuting}
              className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleBroadcast}
              disabled={isExecuting || selectedIds.size === 0}
              className="neo-btn-primary px-5 py-2 flex items-center space-x-1"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isExecuting ? 'BROADCASTING...' : 'DISPATCH ALL'}</span>
            </button>
          </div>

          {/* 3. 노드별 병렬 스트림 결과 카드들 */}
          {Object.keys(nodeStates).length > 0 && (
            <div className="space-y-3">
              <span className="font-bold text-zinc-400 text-[11px] uppercase tracking-wider">
                LIVE OUTPUT STREAMS ({Object.keys(nodeStates).length})
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(nodeStates).map((node) => (
                  <div
                    key={node.machineId}
                    className="border border-zinc-800 bg-zinc-950 p-3 space-y-2 flex flex-col h-56"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-shrink-0">
                      <div className="flex items-center space-x-1.5">
                        <Server className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-bold text-zinc-200">{node.name}</span>
                      </div>
                      <div>
                        {node.isRunning ? (
                          <span className="text-cyan-400 animate-pulse text-[10px] font-bold">
                            RUNNING...
                          </span>
                        ) : node.result?.exitCode === 0 ? (
                          <span className="flex items-center text-emerald-400 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            EXIT: 0
                          </span>
                        ) : (
                          <span className="flex items-center text-red-400 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            EXIT: {node.result?.exitCode ?? 'FAIL'}
                          </span>
                        )}
                      </div>
                    </div>

                    <pre className="flex-1 overflow-y-auto text-[11px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap select-text bg-[#050507] p-2 border border-zinc-900">
                      {node.output || (node.isRunning ? 'Streaming output...' : 'No output')}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
          <span className="text-zinc-500 text-[10px]">
            Server-Sent Events (SSE) Parallel Runner // Non-Quoted Stream
          </span>
          <button onClick={closeBroadcastModal} className="neo-btn px-4 py-1">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
