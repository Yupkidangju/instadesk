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
import { Terminal, Monitor, Columns2, Play, FileText, Cpu, X } from 'lucide-react';

interface VmTilePaneProps {
  tile: WorkspaceTile;
  index: number;
}

export const VmTilePane: React.FC<VmTilePaneProps> = ({ tile, index }) => {
  const { machines, isVaultUnlocked, setTileTab, setTileSessionName, setTileDesktopViewOnly, removeTile } = useAppStore();

  const machine = machines.find((m) => m.id === tile.machineId && m.profileId === tile.profileId);
  const title = machine ? machine.name : tile.machineId;

  const tabs: Array<{ id: WorkspacePanelType; label: string; icon: React.ReactNode }> = [
    { id: 'terminal', label: 'TERMINAL', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'desktop', label: 'DESKTOP', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'split', label: 'SPLIT', icon: <Columns2 className="w-3.5 h-3.5" /> },
    { id: 'exec', label: 'EXEC', icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'logs', label: 'LOGS', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'processes', label: 'PROCS', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 border border-zinc-800 overflow-hidden shadow-lg select-none">
      {/* 1. 타일 상단 바 (네오스위스 스타일) */}
      <div className="min-h-10 bg-zinc-950 border-b border-zinc-800 px-2 py-1 flex flex-wrap items-center justify-between gap-1 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span className="font-mono text-xs font-black text-swiss-red">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-zinc-600 font-mono text-xs">//</span>
          <span className="font-mono font-bold text-xs text-zinc-100 truncate max-w-[140px] sm:max-w-[200px]">
            {title}
          </span>
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

        {/* 타일 닫기 */}
        <button
          onClick={() => removeTile(tile.tileId)}
          title="Close Workspace Pane"
          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
