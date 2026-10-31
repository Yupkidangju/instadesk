// src/store/useAppStore.ts
import { create } from 'zustand';
import { InstaboxMachine, WorkspaceTile, GridMode, WorkspacePanelType } from '../types/instabox';
import { cryptoVault } from '../services/cryptoVault';
import { instaboxClient } from '../services/instaboxClient';

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
  maxSessionsQuota: number; // 8
  sessionStates: Record<string, { profileId: string; status: 'connecting' | 'connected' }>;
  reserveSession: (tileId: string, profileId: string) => boolean;
  activateSession: (tileId: string) => void;
  releaseSession: (tileId: string) => void;

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
  addProfile: (label: string, apiKey: string) => Promise<string>;
  removeProfile: (id: string) => void;

  refreshMachines: () => Promise<void>;
  setAutoRefreshInterval: (interval: number) => void;
  enableDemoMode: () => void;
  disableDemoMode: () => void;

  addTile: (machineId: string, profileId: string, initialTab?: WorkspacePanelType) => void;
  removeTile: (tileId: string) => void;
  setTileTab: (tileId: string, tab: WorkspacePanelType) => void;
  setTileSessionName: (tileId: string, sessionName: string) => void;
  setTileDesktopViewOnly: (tileId: string, viewOnly: boolean) => void;
  setGridMode: (mode: GridMode) => void;
  clearAllTiles: () => void;

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
      refreshGeneration += 1;
      instaboxClient.cancelActiveRequests();
    }
    set({
      isVaultInitialized: cryptoVault.isInitialized(),
      isVaultUnlocked: unlocked,
      profiles: cryptoVault.listProfiles(),
      ...(!unlocked ? {
        tiles: get().tiles.filter((tile) => tile.profileId.startsWith('demo-')),
        machines: get().machines.filter((machine) => machine.profileId.startsWith('demo-')),
        sessionStates: {},
        profileErrors: {},
        isLoadingMachines: false,
        isBroadcastModalOpen: false,
      } : {}),
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
    maxSessionsQuota: 8,
    sessionStates: {},
    reserveSession: (tileId, profileId) => {
      const { sessionStates, maxSessionsQuota } = get();
      if (sessionStates[tileId]) return true;
      if (Object.values(sessionStates).filter((entry) => entry.profileId === profileId).length >= maxSessionsQuota) return false;
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

    addProfile: async (label: string, apiKey: string) => {
      const id = await cryptoVault.addProfile(label, apiKey);
      set({ profiles: cryptoVault.listProfiles() });
      await get().refreshMachines();
      return id;
    },

    removeProfile: (id: string) => {
      if (!cryptoVault.isUnlocked()) throw new Error('Unlock the vault before removing a profile.');
      if (!get().profiles.some((profile) => profile.id === id)) return;
      refreshGeneration += 1;
      instaboxClient.cancelProfile(id);
      const sessionStates = Object.fromEntries(
        Object.entries(get().sessionStates).filter(([, entry]) => entry.profileId !== id)
      );
      set({
        tiles: get().tiles.filter((tile) => tile.profileId !== id),
        machines: get().machines.filter((machine) => machine.profileId !== id),
        sessionStates,
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
      set({
        isDemoMode: false,
        tiles: get().tiles.filter((t) => !t.profileId.startsWith('demo-')),
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

    addTile: (machineId: string, profileId: string, initialTab: WorkspacePanelType = 'terminal') => {
      const { tiles } = get();

      // 이미 열려있는 타일이 있는지 확인
      const existing = tiles.find((t) => t.machineId === machineId && t.profileId === profileId);
      if (existing) {
        // 이미 있으면 해당 타일의 탭을 전환
        set({
          tiles: tiles.map((t) =>
            t.tileId === existing.tileId ? { ...t, activeTab: initialTab } : t
          ),
        });
        return;
      }

      const newTile: WorkspaceTile = {
        tileId: `tile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        machineId,
        profileId,
        activeTab: initialTab,
        terminalSessionName: 'main',
        desktopViewOnly: false,
      };

      set({ tiles: [...tiles, newTile] });
    },

    removeTile: (tileId: string) => {
      get().releaseSession(tileId);
      set({ tiles: get().tiles.filter((t) => t.tileId !== tileId) });
    },

    setTileTab: (tileId: string, tab: WorkspacePanelType) => {
      set({
        tiles: get().tiles.map((t) => (t.tileId === tileId ? { ...t, activeTab: tab } : t)),
      });
    },

    setTileSessionName: (tileId: string, sessionName: string) => {
      set({
        tiles: get().tiles.map((t) =>
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

    clearAllTiles: () => {
      set({ tiles: [], sessionStates: {} });
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
      set({
        tiles: get().tiles.filter((t) => !(t.machineId === machineId && t.profileId === profileId)),
      });
      await get().refreshMachines();
    },
  };
});
