// test/useAppStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';
import { cryptoVault } from '../src/services/cryptoVault';

describe('useAppStore multi-vm and workspace tile management', () => {
  beforeEach(() => {
    cryptoVault.resetVault();
    useAppStore.getState().clearAllTiles();
  });

  it('should initialize with default demo machines upon enabling demo mode', async () => {
    const store = useAppStore.getState();
    store.enableDemoMode();
    await store.refreshMachines();

    const machines = useAppStore.getState().machines;
    expect(machines.length).toBeGreaterThanOrEqual(4);
  });

  it('should add, switch tab, and remove workspace tiles', () => {
    const store = useAppStore.getState();

    // 1. 타일 추가
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal');
    let tiles = useAppStore.getState().tiles;
    expect(tiles.length).toBe(1);
    expect(tiles[0].machineId).toBe('m_demo_swiss_web_01');
    expect(tiles[0].activeTab).toBe('terminal');

    // 2. 탭 전환
    const tileId = tiles[0].tileId;
    store.setTileTab(tileId, 'desktop');
    tiles = useAppStore.getState().tiles;
    expect(tiles[0].activeTab).toBe('desktop');

    // 3. 타일 제거
    store.removeTile(tileId);
    tiles = useAppStore.getState().tiles;
    expect(tiles.length).toBe(0);
  });

  it('should enforce grid mode setting', () => {
    const store = useAppStore.getState();
    store.setGridMode('2x2');
    expect(useAppStore.getState().gridMode).toBe('2x2');
  });
});
