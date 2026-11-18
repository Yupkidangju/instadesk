import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { cryptoVault } from '../services/cryptoVault';
import { terminalRegistry } from './terminal/terminalRegistry';
import type { SessionActivityStatus } from '../types/instabox';
import {
  Activity,
  Bookmark,
  Check,
  CornerDownLeft,
  Link2,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';

type DispatchScope = 'synced' | 'all' | 'prompts';

const STATUS_META: Record<
  SessionActivityStatus,
  { label: string; dotClass: string; chipClass: string; badgeClass: string }
> = {
  running: {
    label: 'RUN',
    dotClass: 'bg-red-500 animate-pulse',
    chipClass: 'border-red-800/80 bg-red-950/30 text-red-200',
    badgeClass: 'text-red-400 border-red-900/70 bg-red-950/40',
  },
  prompt: {
    label: 'PROMPT',
    dotClass: 'bg-amber-400 animate-pulse',
    chipClass: 'border-amber-600 bg-amber-950/50 text-amber-100',
    badgeClass: 'text-amber-300 border-amber-700 bg-amber-950/50',
  },
  idle: {
    label: 'IDLE',
    dotClass: 'bg-emerald-500',
    chipClass: 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200',
    badgeClass: 'text-emerald-400 border-emerald-900/70 bg-emerald-950/30',
  },
  disconnected: {
    label: 'OFF',
    dotClass: 'bg-zinc-600',
    chipClass: 'border-zinc-800 bg-zinc-900/70 text-zinc-400',
    badgeClass: 'text-zinc-400 border-zinc-800 bg-zinc-900',
  },
};

export const SessionCommandBar: React.FC = () => {
  const {
    tiles,
    machines,
    focusedTileId,
    setFocusedTileId,
    sessionActivities,
    syncedTileIds,
    syncAllTiles,
    clearSyncedTiles,
    isKeystrokeMirroring,
    setKeystrokeMirroring,
    setAllTilesTab,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
  } = useAppStore();

  const [scope, setScope] = useState<DispatchScope>('all');
  const [command, setCommand] = useState('');
  const [lastDispatchInfo, setLastDispatchInfo] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const prevSyncedCountRef = useRef(syncedTileIds.length);
  const pendingJumpFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = cryptoVault.subscribe(() => {
      if (!cryptoVault.isUnlocked()) {
        setCommand('');
        setPresetName('');
        setLastDispatchInfo(null);
        setPresetsOpen(false);
        pendingJumpFocusRef.current = null;
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // 동기화 타일이 0개->1개 이상 또는 1개 이상->0개로 전이될 때만 스코프를 자동 전환한다.
  useEffect(() => {
    const prev = prevSyncedCountRef.current;
    const next = syncedTileIds.length;
    prevSyncedCountRef.current = next;
    if (prev === 0 && next > 0 && scope === 'all') {
      setScope('synced');
    } else if (prev > 0 && next === 0 && scope === 'synced') {
      setScope('all');
    }
  }, [syncedTileIds.length, scope]);

  // 1x1 모드 등에서 비포커스 타일 칩 클릭 시 마운트 완료 후 터미널 포커스를 보장한다.
  useEffect(() => {
    const target = pendingJumpFocusRef.current;
    if (!target || target !== focusedTileId) return;
    const focusNow = () => {
      const element = document.querySelector<HTMLElement>(`[data-tile-id="${target}"]`);
      element?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      if (terminalRegistry.focusTile(target)) {
        pendingJumpFocusRef.current = null;
      }
    };
    focusNow();
    if (pendingJumpFocusRef.current === target) {
      const raf = requestAnimationFrame(focusNow);
      return () => cancelAnimationFrame(raf);
    }
  }, [focusedTileId, tiles]);

  if (tiles.length === 0) return null;

  const getActivity = (tileId: string) =>
    sessionActivities[tileId] ?? { status: 'disconnected' as const, updatedAt: 0 };

  const counts = tiles.reduce(
    (acc, tile) => {
      const status = getActivity(tile.tileId).status;
      acc[status] += 1;
      return acc;
    },
    { running: 0, prompt: 0, idle: 0, disconnected: 0 }
  );

  const terminalCapableTiles = tiles.filter(
    (t) => t.activeTab === 'terminal' || t.activeTab === 'split'
  );
  const syncedSet = new Set(syncedTileIds);
  const syncedTerminalTiles = terminalCapableTiles.filter((t) => syncedSet.has(t.tileId));
  const promptTiles = terminalCapableTiles.filter((t) => getActivity(t.tileId).status === 'prompt');

  const resolveTargetIds = (): string[] => {
    if (scope === 'prompts') return promptTiles.map((t) => t.tileId);
    if (scope === 'synced') return syncedTerminalTiles.map((t) => t.tileId);
    return terminalCapableTiles.map((t) => t.tileId);
  };

  const targetIds = resolveTargetIds();

  const sendPayload = (payload: string, clearInput = false) => {
    if (targetIds.length === 0) {
      setLastDispatchInfo('NO ACTIVE PTY TARGETS');
      return;
    }
    const sent = terminalRegistry.sendToTiles(targetIds, payload);
    if (sent === 0) {
      setLastDispatchInfo(`0/${targetIds.length} PTY READY (INPUT KEPT)`);
      return;
    }
    setLastDispatchInfo(`SENT TO ${sent}/${targetIds.length} PTY`);
    if (clearInput) setCommand('');
  };

  const handleSendCommand = () => {
    if (!command.trim()) return;
    sendPayload(`${command}\r`, true);
  };

  const handleJumpToTile = (tileId: string) => {
    pendingJumpFocusRef.current = tileId;
    setFocusedTileId(tileId);
    const element = document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`);
    element?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    if (terminalRegistry.focusTile(tileId)) {
      pendingJumpFocusRef.current = null;
    }
  };

  const handleSavePreset = () => {
    const saved = savePreset(presetName || `CLUSTER_${presets.length + 1}`);
    if (saved) {
      setPresetName('');
      setLastDispatchInfo(`SAVED PRESET: ${saved.name}`);
    }
  };

  return (
    <section
      aria-label="Session status indicator and live control"
      className="bg-zinc-950 border-b border-zinc-800 px-3 py-2 space-y-2 font-mono text-xs select-none flex-shrink-0 z-10"
    >
      {/* 1. 전역 세션 신호등 인디케이터 바 & 배치/프리셋 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <span className="flex items-center space-x-1 text-[10px] font-bold text-zinc-400 mr-1">
            <Activity className="w-3.5 h-3.5 text-swiss-red" />
            <span>SESSIONS</span>
          </span>

          {/* 요약 카운터 */}
          <span className={`neo-tag ${STATUS_META.running.badgeClass}`}>
            ● {counts.running} RUN
          </span>
          <span className={`neo-tag ${STATUS_META.prompt.badgeClass}`}>
            ▲ {counts.prompt} PROMPT
          </span>
          <span className={`neo-tag ${STATUS_META.idle.badgeClass}`}>
            ● {counts.idle} IDLE
          </span>

          <span className="text-zinc-800 hidden sm:inline">|</span>

          {/* 개별 타일 상태 칩 리스트 */}
          <div
            role="region"
            aria-label="Session status indicator"
            className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5"
          >
            {tiles.map((tile) => {
              const machine = machines.find(
                (m) => m.id === tile.machineId && m.profileId === tile.profileId
              );
              const activity = getActivity(tile.tileId);
              const meta = STATUS_META[activity.status];
              const isFocused = focusedTileId === tile.tileId;
              const isSynced = syncedTileIds.includes(tile.tileId);
              const shortName = machine?.name ?? tile.machineId;

              return (
                <button
                  key={tile.tileId}
                  type="button"
                  onClick={() => handleJumpToTile(tile.tileId)}
                  title={
                    activity.summary
                      ? `${shortName}:${tile.terminalSessionName} — ${activity.summary}`
                      : `${shortName}:${tile.terminalSessionName} (${meta.label})`
                  }
                  className={`flex items-center space-x-1.5 px-2 py-0.5 border text-[10px] whitespace-nowrap transition-colors ${
                    meta.chipClass
                  } ${isFocused ? 'ring-1 ring-white' : 'hover:border-zinc-500'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                  <span className="font-bold">
                    {shortName}:{tile.terminalSessionName}
                  </span>
                  {isSynced && (
                    <span className="text-[9px] px-1 bg-swiss-red/30 border border-swiss-red/60 text-red-200">
                      SYNC
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 일괄 관리 & 프리셋 버튼 */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setAllTilesTab('terminal')}
            title="Switch all tiles to Terminal tab"
            className="neo-btn px-2 py-0.5 text-[10px] text-zinc-300"
          >
            ALL TERM
          </button>
          <button
            type="button"
            onClick={() => setAllTilesTab('split')}
            title="Switch all tiles to Split tab"
            className="neo-btn px-2 py-0.5 text-[10px] text-zinc-300"
          >
            ALL SPLIT
          </button>
          <button
            type="button"
            onClick={() => terminalRegistry.reconnectAll()}
            title="Reconnect all mounted terminals"
            className="neo-btn px-2 py-0.5 text-[10px] text-zinc-300 gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">RECONNECT</span>
          </button>
          <button
            type="button"
            onClick={() => terminalRegistry.clearAll()}
            title="Clear all terminal screens"
            className="neo-btn px-2 py-0.5 text-[10px] text-zinc-300 gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">CLEAR</span>
          </button>
          <button
            type="button"
            onClick={() => setPresetsOpen((open) => !open)}
            aria-expanded={presetsOpen}
            className={`neo-btn px-2 py-0.5 text-[10px] gap-1 ${
              presetsOpen ? 'border-swiss-red text-white bg-swiss-red/20' : 'text-zinc-200'
            }`}
          >
            <Bookmark className="w-3 h-3 text-swiss-red" />
            <span>PRESETS ({presets.length})</span>
          </button>
        </div>
      </div>

      {/* 프리셋 관리 서랍 */}
      {presetsOpen && (
        <div className="border border-zinc-800 bg-zinc-900/70 p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              placeholder="PRESET NAME (e.g. AGENT_TRIO)..."
              className="flex-1 min-w-[180px] bg-zinc-950 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={handleSavePreset}
              className="neo-btn-primary px-3 py-1 text-[10px] gap-1"
            >
              <Check className="w-3 h-3" />
              <span>SAVE CURRENT LAYOUT</span>
            </button>
            <button
              type="button"
              onClick={() => setPresetsOpen(false)}
              className="p-1 text-zinc-400 hover:text-white"
              aria-label="Close presets"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {presets.length === 0 ? (
            <div className="text-[10px] text-zinc-500">
              No saved presets yet. Save your active multi-session layout to restore it later.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center border border-zinc-700 bg-zinc-950 text-[10px]"
                >
                  <button
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="px-2 py-1 text-zinc-200 hover:text-white hover:bg-zinc-800 font-bold"
                    title={`Apply ${preset.name} (${preset.tiles.length} tiles, ${preset.gridMode})`}
                  >
                    {preset.name} ({preset.tiles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(preset.id)}
                    aria-label={`Delete preset ${preset.name}`}
                    className="px-1.5 py-1 text-zinc-500 hover:text-red-400 border-l border-zinc-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. 라이브 PTY 동시 명령 입력 & 빠른 응답 바 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 전송 대상 스코프 */}
        <div className="flex items-center border border-zinc-800 bg-zinc-900 p-0.5">
          {(
            [
              { id: 'all', label: `ALL (${terminalCapableTiles.length})` },
              { id: 'synced', label: `SYNCED (${syncedTerminalTiles.length})` },
              { id: 'prompts', label: `PROMPTS (${promptTiles.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={`px-2 py-0.5 text-[10px] font-bold transition-colors ${
                scope === item.id
                  ? item.id === 'prompts'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-100 text-zinc-950'
                  : item.id === 'prompts' && promptTiles.length > 0
                    ? 'text-amber-300 hover:bg-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 전체 동기화 / 키스트로크 미러링 토글 */}
        <button
          type="button"
          onClick={() =>
            syncedTileIds.length === tiles.length ? clearSyncedTiles() : syncAllTiles()
          }
          className="neo-btn px-2 py-1 text-[10px] text-zinc-300"
          title="Select or deselect all tiles for sync"
        >
          {syncedTileIds.length === tiles.length ? 'UNSYNC ALL' : 'SYNC ALL'}
        </button>

        <button
          type="button"
          onClick={() => setKeystrokeMirroring(!isKeystrokeMirroring)}
          aria-pressed={isKeystrokeMirroring}
          title="Mirror live keystrokes typed in any synced terminal to all other synced terminals"
          className={`neo-btn px-2 py-1 text-[10px] gap-1 ${
            isKeystrokeMirroring
              ? 'border-swiss-red bg-swiss-red/20 text-white'
              : 'text-zinc-400'
          }`}
        >
          <Link2 className="w-3 h-3" />
          <span>MIRROR {isKeystrokeMirroring ? 'ON' : 'OFF'}</span>
        </button>

        {/* 라이브 명령 입력창 */}
        <div className="flex flex-1 min-w-[200px] items-center gap-1">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendCommand();
            }}
            placeholder="LIVE PTY COMMAND (ENTER TO SEND TO TARGETS)..."
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
          />
          <button
            type="button"
            onClick={handleSendCommand}
            disabled={!command.trim() || targetIds.length === 0}
            className="neo-btn-primary px-3 py-1 text-[10px] gap-1"
          >
            <Send className="w-3 h-3" />
            <span>SEND</span>
          </button>
        </div>

        {/* 질문/선택 빠른 응답 버튼 */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => sendPayload('y\r')}
            disabled={targetIds.length === 0}
            title="Send 'y' + Enter"
            className="neo-btn px-2 py-1 text-[10px] text-emerald-300 border-emerald-900/70"
          >
            Y
          </button>
          <button
            type="button"
            onClick={() => sendPayload('n\r')}
            disabled={targetIds.length === 0}
            title="Send 'n' + Enter"
            className="neo-btn px-2 py-1 text-[10px] text-red-300 border-red-900/70"
          >
            N
          </button>
          <button
            type="button"
            onClick={() => sendPayload('\r')}
            disabled={targetIds.length === 0}
            title="Send Enter"
            className="neo-btn px-2 py-1 text-[10px] text-zinc-200"
            aria-label="Send Enter"
          >
            <CornerDownLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => sendPayload('1\r')}
            disabled={targetIds.length === 0}
            title="Send '1' + Enter"
            className="neo-btn px-2 py-1 text-[10px] text-amber-300"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => sendPayload('2\r')}
            disabled={targetIds.length === 0}
            title="Send '2' + Enter"
            className="neo-btn px-2 py-1 text-[10px] text-amber-300"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => sendPayload('\u001b')}
            disabled={targetIds.length === 0}
            title="Send Escape"
            className="neo-btn px-2 py-1 text-[10px] text-zinc-300"
          >
            ESC
          </button>
          <button
            type="button"
            onClick={() => sendPayload('\u0003')}
            disabled={targetIds.length === 0}
            title="Send Ctrl+C (SIGINT)"
            className="neo-btn px-2 py-1 text-[10px] text-red-400 border-red-900/70"
          >
            ^C
          </button>
        </div>

        {lastDispatchInfo && (
          <span className="text-[10px] text-zinc-500 ml-auto">{lastDispatchInfo}</span>
        )}
      </div>
    </section>
  );
};
