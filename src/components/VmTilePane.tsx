// src/components/VmTilePane.tsx
import React from 'react';
import { WorkspaceTile, WorkspacePanelType } from '../types/instabox';
import { useAppStore } from '../store/useAppStore';
import { TerminalView } from './terminal/TerminalView';
import { ExecRunnerView } from './terminal/ExecRunnerView';
import { DesktopScreenView } from './desktop/DesktopScreenView';
import { SplitWorkspaceView } from './SplitWorkspaceView';
import { MetricsLogsView } from './telemetry/MetricsLogsView';
import { ProcessListView } from './telemetry/ProcessListView';
import { terminalRegistry } from './terminal/terminalRegistry';
import { Terminal, Monitor, Columns2, Play, FileText, Cpu, X, Link2, Plus } from 'lucide-react';

interface VmTilePaneProps {
  tile: WorkspaceTile;
  index: number;
}

export const VmTilePane: React.FC<VmTilePaneProps> = ({ tile, index }) => {
  const {
    machines,
    isVaultUnlocked,
    setTileTab,
    setTileSessionName,
    setTileDesktopViewOnly,
    removeTile,
    sessionActivities,
    syncedTileIds,
    toggleTileSync,
    addNextSessionTile,
    focusedTileId,
    setFocusedTileId,
  } = useAppStore();

  const machine = machines.find((m) => m.id === tile.machineId && m.profileId === tile.profileId);
  const title = machine ? machine.name : tile.machineId;
  const activity = sessionActivities[tile.tileId] ?? { status: 'disconnected' as const, updatedAt: 0 };
  const isSynced = syncedTileIds.includes(tile.tileId);
  const isFocused = focusedTileId === tile.tileId;

  const statusBorderClass =
    activity.status === 'running'
      ? 'border-t-2 border-t-red-500'
      : activity.status === 'prompt'
        ? 'border-t-2 border-t-amber-400'
        : activity.status === 'idle'
          ? 'border-t-2 border-t-emerald-500'
          : 'border-t-2 border-t-zinc-700';

  const statusBadge =
    activity.status === 'running' ? (
      <span className="neo-tag text-red-400 border-red-900/80 bg-red-950/50 animate-pulse">
        ● RUN
      </span>
    ) : activity.status === 'prompt' ? (
      <span className="neo-tag text-amber-300 border-amber-700 bg-amber-950/60 animate-pulse">
        ▲ PROMPT
      </span>
    ) : activity.status === 'idle' ? (
      <span className="neo-tag text-emerald-400 border-emerald-900/80 bg-emerald-950/40">
        ● IDLE
      </span>
    ) : (
      <span className="neo-tag text-zinc-500 border-zinc-800 bg-zinc-900">
        ○ OFF
      </span>
    );

  const tabs: Array<{ id: WorkspacePanelType; label: string; icon: React.ReactNode }> = [
    { id: 'terminal', label: 'TERMINAL', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'desktop', label: 'DESKTOP', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'split', label: 'SPLIT', icon: <Columns2 className="w-3.5 h-3.5" /> },
    { id: 'exec', label: 'EXEC', icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'logs', label: 'LOGS', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'processes', label: 'PROCS', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      data-tile-id={tile.tileId}
      onMouseDown={() => setFocusedTileId(tile.tileId)}
      className={`flex flex-col h-full w-full bg-zinc-950 border ${
        isFocused ? 'border-zinc-600' : 'border-zinc-800'
      } ${statusBorderClass} overflow-hidden shadow-lg select-none`}
    >
      {/* 1. 타일 상단 바 (네오스위스 스타일) */}
      <div className="min-h-10 bg-zinc-950 border-b border-zinc-800 px-2 py-1 flex flex-wrap items-center justify-between gap-1 flex-shrink-0">
        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
          <span className="font-mono text-xs font-black text-swiss-red">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-zinc-600 font-mono text-xs">//</span>
          <span className="font-mono font-bold text-xs text-zinc-100 truncate max-w-[120px] sm:max-w-[180px]">
            {title}
          </span>
          <span className="neo-tag text-zinc-300 border-zinc-700">
            {tile.terminalSessionName}
          </span>
          {statusBadge}
        </div>

        {/* 탭 네비게이션 */}
        <div className="order-3 w-full lg:order-none lg:w-auto flex items-center space-x-0.5 border border-zinc-800 bg-zinc-900/60 p-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tile.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTileTab(tile.tileId, tab.id)}
                className={`flex flex-shrink-0 items-center space-x-1 px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 동기화, 추가 세션 및 타일 닫기 */}
        <div className="flex items-center space-x-1 ml-1">
          <button
            type="button"
            onClick={() => toggleTileSync(tile.tileId)}
            aria-pressed={isSynced}
            title="Include this tile in synchronized live PTY control"
            className={`px-1.5 py-0.5 font-mono text-[10px] font-bold border transition-colors flex items-center space-x-1 ${
              isSynced
                ? 'border-swiss-red bg-swiss-red/20 text-white'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link2 className="w-3 h-3" />
            <span>SYNC</span>
          </button>
          <button
            type="button"
            onClick={() => addNextSessionTile(tile.machineId, tile.profileId, 'terminal')}
            title="Open another session (main/agent/aux) for this VM as a new tile"
            className="px-1.5 py-0.5 font-mono text-[10px] font-bold border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center space-x-0.5"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>SESS</span>
          </button>
          <button
            onClick={() => removeTile(tile.tileId)}
            title="Close Workspace Pane"
            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 질문/선택 대기 인라인 알림 바 */}
      {activity.status === 'prompt' && (
        <div
          role="status"
          className="bg-amber-950/60 border-b border-amber-700/80 px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-amber-200 flex-shrink-0"
        >
          <span className="truncate flex-1 min-w-0">
            <strong className="text-amber-400 mr-1.5">INPUT REQUIRED:</strong>
            {activity.summary || 'Session is waiting for confirmation or selection'}
          </span>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => terminalRegistry.sendToTile(tile.tileId, 'y\r')}
              className="px-1.5 py-0.5 border border-emerald-700 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 text-[10px] font-bold"
            >
              Y
            </button>
            <button
              type="button"
              onClick={() => terminalRegistry.sendToTile(tile.tileId, 'n\r')}
              className="px-1.5 py-0.5 border border-red-800 bg-red-950/60 text-red-300 hover:bg-red-900 text-[10px] font-bold"
            >
              N
            </button>
            <button
              type="button"
              onClick={() => terminalRegistry.sendToTile(tile.tileId, '1\r')}
              className="px-1.5 py-0.5 border border-amber-700 bg-amber-950/60 text-amber-200 hover:bg-amber-900 text-[10px] font-bold"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => terminalRegistry.sendToTile(tile.tileId, '\r')}
              className="px-1.5 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-[10px] font-bold"
            >
              ENTER
            </button>
          </div>
        </div>
      )}

      {/* 2. 타일 뷰포트 영역 */}
      <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden relative">
        {!isVaultUnlocked && !tile.profileId.startsWith('demo-') ? (
          <div className="p-4 text-zinc-400">Vault locked. Unlock to open this workspace.</div>
        ) : <>
        {tile.activeTab === 'terminal' && (
          <TerminalView
            tileId={tile.tileId}
            machineId={tile.machineId}
            profileId={tile.profileId}
            sessionName={tile.terminalSessionName}
            onSessionChange={(s) => setTileSessionName(tile.tileId, s)}
          />
        )}

        {tile.activeTab === 'desktop' && (
          <DesktopScreenView
            tileId={tile.tileId}
            machineId={tile.machineId}
            profileId={tile.profileId}
            viewOnly={tile.desktopViewOnly}
            onViewOnlyChange={(vo) => setTileDesktopViewOnly(tile.tileId, vo)}
          />
        )}

        {tile.activeTab === 'split' && (
          <SplitWorkspaceView tileId={tile.tileId} machineId={tile.machineId} profileId={tile.profileId}
            sessionName={tile.terminalSessionName} viewOnly={tile.desktopViewOnly}
            onSessionChange={(session) => setTileSessionName(tile.tileId, session)}
            onViewOnlyChange={(viewOnly) => setTileDesktopViewOnly(tile.tileId, viewOnly)} />
        )}

        {tile.activeTab === 'exec' && (
          <ExecRunnerView
            machineId={tile.machineId}
            profileId={tile.profileId}
          />
        )}

        {tile.activeTab === 'logs' && (
          <MetricsLogsView
            machineId={tile.machineId}
            profileId={tile.profileId}
          />
        )}

        {tile.activeTab === 'processes' && (
          <ProcessListView
            machineId={tile.machineId}
            profileId={tile.profileId}
          />
        )}
        </>}
      </div>
    </div>
  );
};
