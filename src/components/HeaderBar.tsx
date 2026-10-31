// src/components/HeaderBar.tsx
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Grid,
  Plus,
  Key,
  Radio,
  Lock,
  Menu,
} from 'lucide-react';
import { GridMode } from '../types/instabox';

interface HeaderBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ sidebarOpen, onToggleSidebar }) => {
  const {
    isVaultInitialized,
    isVaultUnlocked,
    sessionStates,
    maxSessionsQuota,
    gridMode,
    setGridMode,
    refreshMachines,
    isLoadingMachines,
    syncError,
    lastSyncedAt,
    autoRefreshInterval,
    setAutoRefreshInterval,
    openApiKeyModal,
    openUnlockModal,
    openBroadcastModal,
    openCreateVmModal,
    lockVault,
  } = useAppStore();

  const activeCount = Object.keys(sessionStates).length;
  const profileCounts = Object.values(sessionStates).reduce<Record<string, number>>((counts, entry) => {
    counts[entry.profileId] = (counts[entry.profileId] ?? 0) + 1;
    return counts;
  }, {});
  const highestProfileCount = Math.max(0, ...Object.values(profileCounts));
  const isNearQuota = highestProfileCount >= 6;
  const isAtQuota = highestProfileCount >= maxSessionsQuota;

  const gridModes: GridMode[] = ['1x1', '2x1', '2x2', 'auto'];

  return (
    <header className="min-h-14 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 px-3 py-2 select-none flex-shrink-0 z-20">
      {/* 1. 로고 & 시스템 인덱스 */}
      <div className="flex w-full lg:w-auto items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-4 bg-swiss-red flex items-center justify-center font-mono font-black text-[10px] text-white">
            +
          </div>
          <span className="font-extrabold text-base tracking-tighter text-zinc-100 font-sans">
            INSTABOX
          </span>
          <span className="font-black text-base text-swiss-red font-mono">
            //DECK
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-zinc-800">
          <span className="neo-tag text-zinc-400">
            01_SYS_GRID
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            SWISS_REST_WS_V1
          </span>
        </div>
        <button type="button" onClick={onToggleSidebar} aria-expanded={sidebarOpen} aria-controls="node-inventory" className="neo-btn lg:hidden gap-1" title="Toggle node inventory">
          <Menu className="w-4 h-4" /> NODES
        </button>
      </div>

      {/* 2. 세션 쿼터와 로컬 볼트 상태 */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* 세션 쿼터 게이지 */}
        <div className="hidden lg:flex items-center space-x-2 font-mono text-xs px-2.5 py-1 border border-zinc-800 bg-zinc-900/80">
          <Radio className={`w-3.5 h-3.5 ${isAtQuota ? 'text-red-500 animate-pulse' : isNearQuota ? 'text-amber-400' : 'text-emerald-400'}`} />
          <span className="text-zinc-400">PTY:</span>
          <span className={`font-bold ${isAtQuota ? 'text-red-400' : isNearQuota ? 'text-amber-300' : 'text-zinc-200'}`}>
            {activeCount} TOTAL · MAX {highestProfileCount} / {maxSessionsQuota} PER KEY
          </span>
        </div>

        {/* 로컬 볼트 인디케이터 */}
        {isVaultInitialized ? (
          isVaultUnlocked ? (
            <div className="flex items-center space-x-1 border border-emerald-900/60 bg-emerald-950/30 px-2 py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-xs font-semibold text-emerald-400 tracking-wider">
                VAULT UNLOCKED
              </span>
              <button
                onClick={lockVault}
                title="Lock Vault Now"
                className="ml-1 p-0.5 hover:bg-emerald-900/50 text-emerald-300 transition-colors"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={openUnlockModal}
              className="flex items-center space-x-1.5 border border-amber-800/80 bg-amber-950/40 px-2 py-1 hover:bg-amber-900/50 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-amber-400 tracking-wider">
                VAULT LOCKED
              </span>
            </button>
          )
        ) : (
          <button
            onClick={openApiKeyModal}
            className="flex items-center space-x-1.5 border border-zinc-700 bg-zinc-900 px-2 py-1 hover:border-zinc-500 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono text-xs font-bold text-zinc-300">
              SET MASTER KEY
            </span>
          </button>
        )}

        {/* 자동 동기화 & 새로고침 */}
        <div className="flex items-center border border-zinc-800 bg-zinc-900">
          <button
            onClick={() => refreshMachines()}
            disabled={isLoadingMachines}
            title={`Last synced: ${lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : 'Never'}`}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMachines ? 'animate-spin text-swiss-red' : ''}`} />
          </button>
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="bg-transparent text-[11px] font-mono text-zinc-400 px-1 py-1 focus:outline-none cursor-pointer border-l border-zinc-800"
          >
            <option value={5} className="bg-zinc-900 text-zinc-100">5s</option>
            <option value={10} className="bg-zinc-900 text-zinc-100">10s</option>
            <option value={30} className="bg-zinc-900 text-zinc-100">30s</option>
            <option value={0} className="bg-zinc-900 text-zinc-100">OFF</option>
          </select>
        </div>
        {syncError && <button type="button" role="status" title={syncError}
          onClick={() => { if (!sidebarOpen) onToggleSidebar(); }}
          className="border border-amber-800 bg-amber-950/50 px-2 py-1 font-mono text-[10px] text-amber-200">
          SYNC ISSUE · VIEW NODES
        </button>}

        {/* 그리드 모드 전환기 */}
        <div className="hidden sm:flex items-center border border-zinc-800 bg-zinc-900 p-0.5">
          <Grid className="w-3.5 h-3.5 text-zinc-500 ml-1.5 mr-1" />
          {gridModes.map((mode) => (
            <button
              key={mode}
              onClick={() => setGridMode(mode)}
              className={`px-2 py-0.5 font-mono text-xs transition-colors ${
                gridMode === mode
                  ? 'bg-zinc-100 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 우측 액션 버튼들 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={openBroadcastModal}
          className="neo-btn flex items-center space-x-1.5 text-zinc-300 hover:text-white"
          title="Broadcast command to multiple running VMs"
        >
          <Terminal className="w-3.5 h-3.5 text-swiss-red" />
          <span>BROADCAST</span>
        </button>

        <button
          onClick={openCreateVmModal}
          className="neo-btn flex items-center space-x-1.5 text-zinc-200 hover:text-white"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>NEW VM</span>
        </button>

        <button
          onClick={openApiKeyModal}
          className="neo-btn-primary flex items-center space-x-1.5"
        >
          <Key className="w-3.5 h-3.5" />
          <span>KEY VAULT</span>
        </button>
      </div>
    </header>
  );
};
