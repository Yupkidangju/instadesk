// src/store/useAppStore.ts
import { create } from 'zustand';
import {
  InstaboxMachine,
  WorkspaceTile,
  GridMode,
  WorkspacePanelType,
  TerminalSessionName,
  SessionActivityInfo,
  WorkspacePreset,
  WorkspaceTilePresetItem,
} from '../types/instabox';
import { cryptoVault } from '../services/cryptoVault';
import { instaboxClient } from '../services/instaboxClient';
import { terminalHistoryCache } from '../components/terminal/terminalHistoryCache';

const PRESETS_STORAGE_KEY = 'instabox_deck_presets_v1';
const SESSION_SEQUENCE: TerminalSessionName[] = ['main', 'agent', 'aux'];
const VALID_GRID_MODES = new Set<GridMode>(['1x1', '2x1', '2x2', 'auto']);
const VALID_PANEL_TABS = new Set<WorkspacePanelType>(['terminal', 'desktop', 'split', 'exec', 'logs', 'processes']);
const VALID_SESSIONS = new Set<TerminalSessionName>(SESSION_SEQUENCE);

function sanitizePresetTile(raw: unknown): WorkspaceTilePresetItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.machineId !== 'string' ||
    typeof candidate.profileId !== 'string' ||
    !candidate.machineId.trim() ||
    !candidate.profileId.trim() ||
    candidate.machineId.length > 128 ||
    candidate.profileId.length > 128
  ) {
    return null;
  }
  const activeTab =
    typeof candidate.activeTab === 'string' && VALID_PANEL_TABS.has(candidate.activeTab as WorkspacePanelType)
      ? (candidate.activeTab as WorkspacePanelType)
      : 'terminal';
  const terminalSessionName =
    typeof candidate.terminalSessionName === 'string' &&
    VALID_SESSIONS.has(candidate.terminalSessionName as TerminalSessionName)
      ? (candidate.terminalSessionName as TerminalSessionName)
      : 'main';
  return {
    machineId: candidate.machineId,
    profileId: candidate.profileId,
    activeTab,
    terminalSessionName,
    desktopViewOnly: typeof candidate.desktopViewOnly === 'boolean' ? candidate.desktopViewOnly : false,
  };
}

function deduplicatePresetTiles(items: WorkspaceTilePresetItem[]): WorkspaceTilePresetItem[] {
  const seen = new Set<string>();
  const result: WorkspaceTilePresetItem[] = [];
  for (const item of items) {
    const key = `${item.profileId}\u0000${item.machineId}\u0000${item.terminalSessionName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function loadPresets(): WorkspacePreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const presets: WorkspacePreset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      if (typeof obj.id !== 'string' || !obj.id || typeof obj.name !== 'string' || !obj.name.trim() || !Array.isArray(obj.tiles)) {
        continue;
      }
      const gridMode =
        typeof obj.gridMode === 'string' && VALID_GRID_MODES.has(obj.gridMode as GridMode)
          ? (obj.gridMode as GridMode)
          : '2x1';
      const sanitizedTiles = deduplicatePresetTiles(
        obj.tiles.map(sanitizePresetTile).filter((t): t is WorkspaceTilePresetItem => t !== null)
      );
      if (sanitizedTiles.length === 0) continue;
      presets.push({
        id: obj.id,
        name: obj.name.trim().slice(0, 48),
        gridMode,
        tiles: sanitizedTiles,
        createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date(0).toISOString(),
      });
    }
    return presets.slice(0, 20);
  } catch {
    return [];
  }
}

function persistPresets(presets: WorkspacePreset[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }
  } catch {
    // localStorage quota or unavailable in test environment
  }
}

function filterRecordByTiles<T>(record: Record<string, T>, tiles: WorkspaceTile[]): Record<string, T> {
  const validIds = new Set(tiles.map((t) => t.tileId));
  const next: Record<string, T> = {};
  for (const [id, value] of Object.entries(record)) {
    if (validIds.has(id)) next[id] = value;
  }
  return next;
}

interface AppStoreState {
  // --- 볼트 상태 ---
  isVaultInitialized: boolean;
  isVaultUnlocked: boolean;
  profiles: Array<{ id: string; label: string; createdAt: string; lastUsedAt: string | null }>;

  // --- 머신 상태 ---
  machines: InstaboxMachine[];
  isLoadingMachines: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  profileErrors: Record<string, string>;
  autoRefreshInterval: number; // 0: disabled, 5: 5s, 10: 10s, 30: 30s

  isDemoMode: boolean;

  // --- 워크스페이스 타일 상태 ---
  tiles: WorkspaceTile[];
  gridMode: GridMode;
  focusedTileId: string | null;
  sessionStates: Record<string, { profileId: string; status: 'connecting' | 'connected' }>;
  sessionActivities: Record<string, SessionActivityInfo>;
  syncedTileIds: string[];
  isKeystrokeMirroring: boolean;
  presets: WorkspacePreset[];
  reserveSession: (tileId: string, profileId: string) => boolean;
  activateSession: (tileId: string) => void;
  releaseSession: (tileId: string) => void;
  setSessionActivity: (tileId: string, info: SessionActivityInfo) => void;
  clearSessionActivity: (tileId: string) => void;

  // --- 필터 상태 ---
  searchQuery: string;
  stateFilter: 'all' | 'running' | 'suspended' | 'stopped';
  profileFilter: string; // 'all' or profileId

  // --- 모달 상태 ---
  isApiKeyModalOpen: boolean;
  isUnlockModalOpen: boolean;
  isBroadcastModalOpen: boolean;
  isCreateVmModalOpen: boolean;

  // --- 액션 메서드 ---
  syncVaultState: () => void;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  initializeVault: (password: string) => Promise<void>;
  changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  addProfile: (label: string, apiKey: string) => Promise<string>;
  removeProfile: (id: string) => void;

  refreshMachines: () => Promise<void>;
  setAutoRefreshInterval: (interval: number) => void;
  enableDemoMode: () => void;
  disableDemoMode: () => void;

  addTile: (machineId: string, profileId: string, initialTab?: WorkspacePanelType, sessionName?: TerminalSessionName) => void;
  addNextSessionTile: (machineId: string, profileId: string, initialTab?: WorkspacePanelType) => string | null;
  removeTile: (tileId: string) => void;
  setTileTab: (tileId: string, tab: WorkspacePanelType) => void;
  setAllTilesTab: (tab: WorkspacePanelType) => void;
  setTileSessionName: (tileId: string, sessionName: string) => void;
  setTileDesktopViewOnly: (tileId: string, viewOnly: boolean) => void;
  setGridMode: (mode: GridMode) => void;
  setFocusedTileId: (tileId: string | null) => void;
  clearAllTiles: () => void;

  toggleTileSync: (tileId: string) => void;
  setSyncedTiles: (tileIds: string[]) => void;
  syncAllTiles: () => void;
  clearSyncedTiles: () => void;
  setKeystrokeMirroring: (enabled: boolean) => void;

  savePreset: (name: string) => WorkspacePreset | null;
  applyPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;

  setSearchQuery: (query: string) => void;
  setStateFilter: (filter: 'all' | 'running' | 'suspended' | 'stopped') => void;
  setProfileFilter: (profileId: string) => void;

  openApiKeyModal: () => void;
  closeApiKeyModal: () => void;
  openUnlockModal: () => void;
  closeUnlockModal: () => void;
  openBroadcastModal: () => void;
  closeBroadcastModal: () => void;
  openCreateVmModal: () => void;
  closeCreateVmModal: () => void;

  // 머신 제어
  controlMachine: (machineId: string, profileId: string, action: 'start' | 'stop' | 'suspend' | 'resume') => Promise<void>;
  deleteMachine: (machineId: string, profileId: string, machineName: string) => Promise<void>;
}

export const useAppStore = create<AppStoreState>((set, get) => {
  let refreshGeneration = 0;
  // 초기 볼트 상태 반영
  const isVaultInitialized = cryptoVault.isInitialized();
  const isVaultUnlocked = cryptoVault.isUnlocked();
  const profiles = cryptoVault.listProfiles();

  // 리스너 등록
  cryptoVault.subscribe(() => {
    const unlocked = cryptoVault.isUnlocked();
    if (!unlocked) {
      terminalHistoryCache.clear();
      refreshGeneration += 1;
      instaboxClient.cancelActiveRequests();
      void window.instadeskDesktop?.closeAll();
    }
    set({
      isVaultInitialized: cryptoVault.isInitialized(),
      isVaultUnlocked: unlocked,
      profiles: cryptoVault.listProfiles(),
      ...(!unlocked ? (() => {
        const remainingTiles = get().tiles.filter((tile) => tile.profileId.startsWith('demo-'));
        const validIds = new Set(remainingTiles.map((tile) => tile.tileId));
        return {
          tiles: remainingTiles,
          machines: get().machines.filter((machine) => machine.profileId.startsWith('demo-')),
          sessionStates: {},
          sessionActivities: filterRecordByTiles(get().sessionActivities, remainingTiles),
          syncedTileIds: get().syncedTileIds.filter((id) => validIds.has(id)),
          isKeystrokeMirroring: false,
          focusedTileId: get().focusedTileId && validIds.has(get().focusedTileId!) ? get().focusedTileId : (remainingTiles[0]?.tileId ?? null),
          profileErrors: {},
          isLoadingMachines: false,
          isBroadcastModalOpen: false,
        };
      })() : {}),
    });
  });

  return {
    isVaultInitialized,
    isVaultUnlocked,
    profiles,

    machines: [],
    isLoadingMachines: false,
    lastSyncedAt: null,
    syncError: null,
    profileErrors: {},
    autoRefreshInterval: 10,
    isDemoMode: false,

    tiles: [],
    gridMode: '2x1',
    focusedTileId: null,
    sessionStates: {},
    sessionActivities: {},
    syncedTileIds: [],
    isKeystrokeMirroring: false,
    presets: loadPresets(),
    reserveSession: (tileId, profileId) => {
      const { sessionStates } = get();
      if (sessionStates[tileId]) return true;
      set({ sessionStates: { ...sessionStates, [tileId]: { profileId, status: 'connecting' } } });
      return true;
    },
    activateSession: (tileId) => {
      const states = get().sessionStates;
      if (states[tileId]) set({ sessionStates: { ...states, [tileId]: { ...states[tileId], status: 'connected' } } });
    },
    releaseSession: (tileId) => {
      const states = { ...get().sessionStates };
      delete states[tileId];
      set({ sessionStates: states });
    },
    setSessionActivity: (tileId, info) => {
      const current = get().sessionActivities[tileId];
      if (
        current &&
        current.status === info.status &&
        current.summary === info.summary &&
        Boolean(current.isSensitive) === Boolean(info.isSensitive)
      ) {
        return;
      }
      set({ sessionActivities: { ...get().sessionActivities, [tileId]: info } });
    },
    clearSessionActivity: (tileId) => {
      if (!(tileId in get().sessionActivities)) return;
      const next = { ...get().sessionActivities };
      delete next[tileId];
      set({ sessionActivities: next });
    },

    searchQuery: '',
    stateFilter: 'all',
    profileFilter: 'all',

    isApiKeyModalOpen: false,
    isUnlockModalOpen: false,
    isBroadcastModalOpen: false,
    isCreateVmModalOpen: false,

    syncVaultState: () => {
      set({
        isVaultInitialized: cryptoVault.isInitialized(),
        isVaultUnlocked: cryptoVault.isUnlocked(),
        profiles: cryptoVault.listProfiles(),
      });
    },

    unlockVault: async (password: string) => {
      const ok = await cryptoVault.unlock(password);
      if (ok) {
        set({ isVaultUnlocked: true, isUnlockModalOpen: false });
        await get().refreshMachines();
      }
      return ok;
    },

    lockVault: () => {
      cryptoVault.lock();
      set({ isVaultUnlocked: false });
    },

    initializeVault: async (password: string) => {
      await cryptoVault.initializeVault(password);
      set({
        isVaultInitialized: true,
        isVaultUnlocked: true,
        isUnlockModalOpen: false,
      });
    },

    changeMasterPassword: async (currentPassword: string, newPassword: string) => {
      await cryptoVault.changeMasterPassword(currentPassword, newPassword);
    },

    addProfile: async (label: string, apiKey: string) => {
      const id = await cryptoVault.addProfile(label, apiKey);
      set({ profiles: cryptoVault.listProfiles() });
      return id;
    },

    removeProfile: (id: string) => {
      if (!cryptoVault.isUnlocked()) throw new Error('Unlock the vault before removing a profile.');
      if (!get().profiles.some((profile) => profile.id === id)) return;
      refreshGeneration += 1;
      instaboxClient.cancelProfile(id);
      terminalHistoryCache.clearProfile(id);
      void window.instadeskDesktop?.closeProfile(id);
      const sessionStates = Object.fromEntries(
        Object.entries(get().sessionStates).filter(([, entry]) => entry.profileId !== id)
      );
      const remainingTiles = get().tiles.filter((tile) => tile.profileId !== id);
      const validIds = new Set(remainingTiles.map((tile) => tile.tileId));
      set({
        tiles: remainingTiles,
        machines: get().machines.filter((machine) => machine.profileId !== id),
        sessionStates,
        sessionActivities: filterRecordByTiles(get().sessionActivities, remainingTiles),
        syncedTileIds: get().syncedTileIds.filter((tileId) => validIds.has(tileId)),
        focusedTileId: get().focusedTileId && validIds.has(get().focusedTileId!) ? get().focusedTileId : (remainingTiles[0]?.tileId ?? null),
        isBroadcastModalOpen: false,
        profileFilter: get().profileFilter === id ? 'all' : get().profileFilter,
      });
      cryptoVault.removeProfile(id);
      set({ profiles: cryptoVault.listProfiles() });
      void get().refreshMachines();
    },

    enableDemoMode: () => {
      set({ isDemoMode: true });
      get().refreshMachines();
    },

    disableDemoMode: () => {
      for (const tile of get().tiles) if (tile.profileId.startsWith('demo-')) terminalHistoryCache.clearTile(tile.tileId);
      const remainingTiles = get().tiles.filter((t) => !t.profileId.startsWith('demo-'));
      const validIds = new Set(remainingTiles.map((tile) => tile.tileId));
      set({
        isDemoMode: false,
        tiles: remainingTiles,
        sessionActivities: filterRecordByTiles(get().sessionActivities, remainingTiles),
        syncedTileIds: get().syncedTileIds.filter((id) => validIds.has(id)),
        focusedTileId: get().focusedTileId && validIds.has(get().focusedTileId!) ? get().focusedTileId : (remainingTiles[0]?.tileId ?? null),
      });
      get().refreshMachines();
    },

    refreshMachines: async () => {
      const generation = ++refreshGeneration;
      set({ isLoadingMachines: true, syncError: null });
      try {
        const { profiles, isVaultUnlocked, isDemoMode } = get();
        const queriedProfiles = isVaultUnlocked ? profiles : [];
        const results = await Promise.allSettled(
          queriedProfiles.map((profile) => instaboxClient.listMachines(profile.id, profile.label))
        );
        if (generation !== refreshGeneration) return;
        const allMachines: InstaboxMachine[] = [];
        const profileErrors: Record<string, string> = {};
        results.forEach((result, index) => {
          const profile = queriedProfiles[index];
          if (result.status === 'fulfilled') allMachines.push(...result.value);
          else profileErrors[profile.id] = result.reason instanceof Error ? result.reason.message : 'Connection failed';
        });

        if (isDemoMode) {
          const demoList = await instaboxClient.listMachines('demo-default', '00 // DEMO_SWISS_CLUSTER');
          allMachines.push(...demoList);
        }
        if (generation !== refreshGeneration) return;
        const failedLabels = queriedProfiles.filter((profile) => profileErrors[profile.id]).map((profile) => profile.label);
        set({
          machines: cryptoVault.isUnlocked() ? allMachines : allMachines.filter((m) => m.profileId.startsWith('demo-')),
          isLoadingMachines: false,
          lastSyncedAt: new Date(),
          profileErrors,
          syncError: failedLabels.length ? `Sync failed: ${failedLabels.join(', ')}` : null,
        });
      } catch (err: unknown) {
        if (generation !== refreshGeneration) return;
        set({
          isLoadingMachines: false,
          syncError: (err as Error).message || 'Failed to sync machines',
          profileErrors: {},
        });
      }
    },

    setAutoRefreshInterval: (interval: number) => {
      set({ autoRefreshInterval: interval });
    },

    addTile: (
      machineId: string,
      profileId: string,
      initialTab: WorkspacePanelType = 'terminal',
      sessionName?: TerminalSessionName
    ) => {
      const { tiles } = get();

      const existing = sessionName
        ? tiles.find((t) => t.machineId === machineId && t.profileId === profileId && t.terminalSessionName === sessionName)
        : tiles.find((t) => t.machineId === machineId && t.profileId === profileId);

      if (existing) {
        set({
          tiles: tiles.map((t) =>
            t.tileId === existing.tileId ? { ...t, activeTab: initialTab } : t
          ),
          focusedTileId: existing.tileId,
        });
        return;
      }

      const newTile: WorkspaceTile = {
        tileId: `tile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        machineId,
        profileId,
        activeTab: initialTab,
        terminalSessionName: sessionName ?? 'main',
        desktopViewOnly: false,
      };

      set({ tiles: [...tiles, newTile], focusedTileId: newTile.tileId });
    },

    addNextSessionTile: (
      machineId: string,
      profileId: string,
      initialTab: WorkspacePanelType = 'terminal'
    ) => {
      const { tiles } = get();
      const machineTiles = tiles.filter((t) => t.machineId === machineId && t.profileId === profileId);
      const usedSessions = new Set(machineTiles.map((t) => t.terminalSessionName));
      const nextSession = SESSION_SEQUENCE.find((s) => !usedSessions.has(s));
      if (!nextSession) {
        const lastTile = machineTiles[machineTiles.length - 1];
        if (lastTile) set({ focusedTileId: lastTile.tileId });
        return null;
      }

      const newTile: WorkspaceTile = {
        tileId: `tile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        machineId,
        profileId,
        activeTab: initialTab,
        terminalSessionName: nextSession,
        desktopViewOnly: false,
      };
      set({ tiles: [...tiles, newTile], focusedTileId: newTile.tileId });
      return newTile.tileId;
    },

    removeTile: (tileId: string) => {
      get().releaseSession(tileId);
      get().clearSessionActivity(tileId);
      const remaining = get().tiles.filter((t) => t.tileId !== tileId);
      const nextFocused =
        get().focusedTileId === tileId ? (remaining[0]?.tileId ?? null) : get().focusedTileId;
      set({
        tiles: remaining,
        syncedTileIds: get().syncedTileIds.filter((id) => id !== tileId),
        focusedTileId: nextFocused,
      });
      terminalHistoryCache.clearTile(tileId);
    },

    setTileTab: (tileId: string, tab: WorkspacePanelType) => {
      set({
        tiles: get().tiles.map((t) => (t.tileId === tileId ? { ...t, activeTab: tab } : t)),
      });
    },

    setAllTilesTab: (tab: WorkspacePanelType) => {
      set({
        tiles: get().tiles.map((t) => ({ ...t, activeTab: tab })),
      });
    },

    setTileSessionName: (tileId: string, sessionName: string) => {
      if (!VALID_SESSIONS.has(sessionName as TerminalSessionName)) return;
      const { tiles } = get();
      const target = tiles.find((t) => t.tileId === tileId);
      if (!target || target.terminalSessionName === sessionName) return;
      const conflict = tiles.find(
        (t) =>
          t.tileId !== tileId &&
          t.machineId === target.machineId &&
          t.profileId === target.profileId &&
          t.terminalSessionName === sessionName
      );
      if (conflict) {
        set({ focusedTileId: conflict.tileId });
        return;
      }
      set({
        tiles: tiles.map((t) =>
          t.tileId === tileId ? { ...t, terminalSessionName: sessionName } : t
        ),
      });
    },

    setTileDesktopViewOnly: (tileId: string, viewOnly: boolean) => {
      set({
        tiles: get().tiles.map((t) =>
          t.tileId === tileId ? { ...t, desktopViewOnly: viewOnly } : t
        ),
      });
    },

    setGridMode: (mode: GridMode) => {
      set({ gridMode: mode });
    },

    setFocusedTileId: (tileId: string | null) => {
      set({ focusedTileId: tileId });
    },

    clearAllTiles: () => {
      set({
        tiles: [],
        sessionStates: {},
        sessionActivities: {},
        syncedTileIds: [],
        isKeystrokeMirroring: false,
        focusedTileId: null,
      });
      terminalHistoryCache.clear();
    },

    toggleTileSync: (tileId: string) => {
      const current = get().syncedTileIds;
      if (current.includes(tileId)) {
        set({ syncedTileIds: current.filter((id) => id !== tileId) });
      } else {
        set({ syncedTileIds: [...current, tileId] });
      }
    },

    setSyncedTiles: (tileIds: string[]) => {
      const validIds = new Set(get().tiles.map((t) => t.tileId));
      set({ syncedTileIds: tileIds.filter((id) => validIds.has(id)) });
    },

    syncAllTiles: () => {
      set({ syncedTileIds: get().tiles.map((t) => t.tileId) });
    },

    clearSyncedTiles: () => {
      set({ syncedTileIds: [] });
    },

    setKeystrokeMirroring: (enabled: boolean) => {
      set({ isKeystrokeMirroring: enabled });
    },

    savePreset: (name: string) => {
      const trimmed = name.trim();
      const { tiles, gridMode, presets } = get();
      if (!trimmed || tiles.length === 0) return null;
      const preset: WorkspacePreset = {
        id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed.slice(0, 48),
        gridMode,
        tiles: tiles.map((t) => ({
          machineId: t.machineId,
          profileId: t.profileId,
          activeTab: t.activeTab,
          terminalSessionName: t.terminalSessionName,
          desktopViewOnly: t.desktopViewOnly,
        })),
        createdAt: new Date().toISOString(),
      };
      const next = [preset, ...presets.filter((p) => p.name !== preset.name)].slice(0, 20);
      persistPresets(next);
      set({ presets: next });
      return preset;
    },

    applyPreset: (presetId: string) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return;
      const unlocked = cryptoVault.isUnlocked();
      const validProfiles = new Set(get().profiles.map((p) => p.id));
      const sanitizedTiles = deduplicatePresetTiles(
        preset.tiles.map(sanitizePresetTile).filter((t): t is WorkspaceTilePresetItem => t !== null)
      );
      const allowedItems = sanitizedTiles.filter((item) =>
        item.profileId.startsWith('demo-')
          ? get().isDemoMode || item.profileId === 'demo-default'
          : unlocked && validProfiles.has(item.profileId)
      );
      if (allowedItems.length === 0) {
        const hasRealProfile = sanitizedTiles.some((item) => !item.profileId.startsWith('demo-'));
        if (!unlocked && hasRealProfile) {
          set({ isUnlockModalOpen: true });
        }
        return;
      }

      terminalHistoryCache.clear();
      const nextGridMode = VALID_GRID_MODES.has(preset.gridMode) ? preset.gridMode : '2x1';
      const nextTiles: WorkspaceTile[] = allowedItems.map((item, idx) => ({
        tileId: `tile_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        machineId: item.machineId,
        profileId: item.profileId,
        activeTab: item.activeTab,
        terminalSessionName: item.terminalSessionName,
        desktopViewOnly: item.desktopViewOnly,
      }));
      const enableDemo = nextTiles.some((t) => t.profileId.startsWith('demo-'));
      set({
        tiles: nextTiles,
        gridMode: nextGridMode,
        focusedTileId: nextTiles[0]?.tileId ?? null,
        sessionStates: {},
        sessionActivities: {},
        syncedTileIds: [],
        isKeystrokeMirroring: false,
        ...(enableDemo && !get().isDemoMode ? { isDemoMode: true } : {}),
      });
      if (enableDemo && get().machines.length === 0) {
        void get().refreshMachines();
      }
    },

    deletePreset: (presetId: string) => {
      const next = get().presets.filter((p) => p.id !== presetId);
      persistPresets(next);
      set({ presets: next });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    setStateFilter: (filter: 'all' | 'running' | 'suspended' | 'stopped') => {
      set({ stateFilter: filter });
    },

    setProfileFilter: (profileId: string) => {
      set({ profileFilter: profileId });
    },

    openApiKeyModal: () => set({ isApiKeyModalOpen: true }),
    closeApiKeyModal: () => set({ isApiKeyModalOpen: false }),
    openUnlockModal: () => set({ isUnlockModalOpen: true }),
    closeUnlockModal: () => set({ isUnlockModalOpen: false }),
    openBroadcastModal: () => set({ isBroadcastModalOpen: true }),
    closeBroadcastModal: () => set({ isBroadcastModalOpen: false }),
    openCreateVmModal: () => set({ isCreateVmModalOpen: true }),
    closeCreateVmModal: () => set({ isCreateVmModalOpen: false }),

    controlMachine: async (machineId: string, profileId: string, action: 'start' | 'stop' | 'suspend' | 'resume') => {
      await instaboxClient.controlMachine(profileId, machineId, action);
      await get().refreshMachines();
    },

    deleteMachine: async (machineId: string, profileId: string, machineName: string) => {
      await instaboxClient.deleteMachine(profileId, machineId, machineName);
      const removedTiles = get().tiles.filter((t) => t.machineId === machineId && t.profileId === profileId);
      const remainingTiles = get().tiles.filter((t) => !(t.machineId === machineId && t.profileId === profileId));
      const validIds = new Set(remainingTiles.map((tile) => tile.tileId));
      set({
        tiles: remainingTiles,
        sessionActivities: filterRecordByTiles(get().sessionActivities, remainingTiles),
        syncedTileIds: get().syncedTileIds.filter((id) => validIds.has(id)),
        focusedTileId: get().focusedTileId && validIds.has(get().focusedTileId!) ? get().focusedTileId : (remainingTiles[0]?.tileId ?? null),
      });
      for (const tile of removedTiles) terminalHistoryCache.clearTile(tile.tileId);
      await get().refreshMachines();
    },
  };
});
