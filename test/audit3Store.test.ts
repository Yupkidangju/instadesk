import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cryptoVault, VaultLockedError } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';
import { InstaboxMachine } from '../src/types/instabox';

let firstId: string;
let secondId: string;
let demo: InstaboxMachine[];

beforeEach(async () => {
  cryptoVault.resetVault();
  await cryptoVault.initializeVault('test-password');
  firstId = await cryptoVault.addProfile('First', 'ibk_first');
  secondId = await cryptoVault.addProfile('Second', 'ibk_second');
  demo = await instaboxClient.listMachines('demo-default');
  useAppStore.getState().clearAllTiles();
  useAppStore.setState({ isDemoMode: false, machines: [], profileErrors: {}, syncError: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cryptoVault.resetVault();
});

const machine = (id: string, profileId: string): InstaboxMachine => ({
  ...demo[0], id, name: id, profileId, profileLabel: profileId,
});

describe('Audit 3 profile lifecycle', () => {
  it('keeps successful profiles and demo while removing stale machines from a failed profile', async () => {
    useAppStore.setState({ isDemoMode: true, machines: [machine('stale', secondId)] });
    vi.spyOn(instaboxClient, 'listMachines').mockImplementation(async (id) => {
      if (id === firstId) return [machine('fresh', firstId)];
      if (id === secondId) throw new Error('Network unavailable');
      return demo;
    });
    await useAppStore.getState().refreshMachines();
    const state = useAppStore.getState();
    expect(state.machines.map((item) => item.id)).toContain('fresh');
    expect(state.machines.map((item) => item.id)).toContain(demo[0].id);
    expect(state.machines.map((item) => item.id)).not.toContain('stale');
    expect(state.profileErrors[secondId]).toBe('Network unavailable');
    expect(state.syncError).toContain('Second');
  });

  it('ignores an older refresh that finishes after the newer refresh', async () => {
    let resolveOld!: (machines: InstaboxMachine[]) => void;
    const old = new Promise<InstaboxMachine[]>((resolve) => { resolveOld = resolve; });
    useAppStore.setState({ profiles: cryptoVault.listProfiles().filter((profile) => profile.id === firstId) });
    vi.spyOn(instaboxClient, 'listMachines')
      .mockImplementationOnce(() => old)
      .mockResolvedValueOnce([machine('latest', firstId)]);
    const first = useAppStore.getState().refreshMachines();
    const second = useAppStore.getState().refreshMachines();
    await second;
    resolveOld([machine('obsolete', firstId)]);
    await first;
    expect(useAppStore.getState().machines.map((item) => item.id)).toEqual(['latest']);
  });

  it('removes only the deleted profile tiles, reservations and socket', () => {
    vi.spyOn(instaboxClient, 'listMachines').mockResolvedValue([]);
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    instaboxClient.registerControlSocket({ close: firstClose } as unknown as WebSocket, firstId);
    instaboxClient.registerControlSocket({ close: secondClose } as unknown as WebSocket, secondId);
    const store = useAppStore.getState();
    store.addTile('first-machine', firstId);
    store.addTile('second-machine', secondId);
    const [firstTile, secondTile] = useAppStore.getState().tiles;
    store.reserveSession(firstTile.tileId, firstId);
    store.reserveSession(secondTile.tileId, secondId);
    store.removeProfile(firstId);
    expect(firstClose).toHaveBeenCalledOnce();
    expect(secondClose).not.toHaveBeenCalled();
    expect(useAppStore.getState().tiles.map((tile) => tile.profileId)).toEqual([secondId]);
    expect(Object.values(useAppStore.getState().sessionStates).map((entry) => entry.profileId)).toEqual([secondId]);
    expect(cryptoVault.listProfiles().map((profile) => profile.id)).toEqual([secondId]);
  });

  it('aborts only the removed profile request and requires unlock to delete', async () => {
    const aborted: string[] = [];
    let resolveSecond!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      const authorization = (init.headers as Headers).get('Authorization') ?? '';
      if (authorization.includes('second')) resolveSecond = resolve;
      init.signal?.addEventListener('abort', () => {
        aborted.push(authorization);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })));
    const first = instaboxClient.listMachines(firstId).catch((error) => error);
    const second = instaboxClient.listMachines(secondId);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    instaboxClient.cancelProfile(firstId);
    expect((await first).name).toBe('AbortError');
    expect(aborted).toEqual(['Bearer ibk_first']);
    resolveSecond(new Response(JSON.stringify({ machines: [], nextCursor: null }), { status: 200 }));
    await expect(second).resolves.toEqual([]);
    cryptoVault.lock();
    expect(() => cryptoVault.removeProfile(secondId)).toThrow(VaultLockedError);
  });
});
