import { beforeEach, describe, expect, it } from 'vitest';
import { terminalHistoryCache } from '../src/components/terminal/terminalHistoryCache';
import { cryptoVault } from '../src/services/cryptoVault';
import { useAppStore } from '../src/store/useAppStore';

beforeEach(() => terminalHistoryCache.clear());

describe('bounded terminal history across focus and tab switches', () => {
  it('keeps separate tile and session transcripts with their scroll offset', () => {
    terminalHistoryCache.save('tile-1', 'p1', 'main', 'first output', 12, 120, 35);
    terminalHistoryCache.save('tile-1', 'p1', 'agent', 'agent output', 3);
    terminalHistoryCache.save('tile-2', 'p2', 'main', 'second output', 0);
    expect(terminalHistoryCache.get('tile-1', 'main')).toMatchObject({ data: 'first output', scrollOffset: 12, cols: 120, rows: 35 });
    expect(terminalHistoryCache.get('tile-1', 'agent')?.data).toBe('agent output');
    expect(terminalHistoryCache.get('tile-2', 'main')?.data).toBe('second output');
  });

  it('drops a closed tile, a removed profile, and all entries on vault lock', () => {
    terminalHistoryCache.save('tile-1', 'p1', 'main', 'private one', 1);
    terminalHistoryCache.save('tile-2', 'p1', 'main', 'private two', 1);
    terminalHistoryCache.save('tile-3', 'p2', 'main', 'other', 1);
    terminalHistoryCache.clearTile('tile-1');
    expect(terminalHistoryCache.get('tile-1', 'main')).toBeNull();
    terminalHistoryCache.clearProfile('p1');
    expect(terminalHistoryCache.get('tile-2', 'main')).toBeNull();
    expect(terminalHistoryCache.get('tile-3', 'main')?.data).toBe('other');
    terminalHistoryCache.clearSession('tile-3', 'main');
    expect(terminalHistoryCache.get('tile-3', 'main')).toBeNull();
    terminalHistoryCache.save('tile-3', 'p2', 'main', 'other', 0);
    terminalHistoryCache.clear();
    expect(terminalHistoryCache.get('tile-3', 'main')).toBeNull();
  });

  it('rejects oversized output and evicts the least recently used entry after sixteen sessions', () => {
    expect(terminalHistoryCache.save('too-big', 'p1', 'main', 'x'.repeat(256 * 1024 + 1), 0)).toBe(false);
    for (let index = 0; index < 16; index++) {
      expect(terminalHistoryCache.save(`tile-${index}`, 'p1', 'main', `${index}`, 0)).toBe(true);
    }
    terminalHistoryCache.get('tile-0', 'main');
    terminalHistoryCache.save('tile-16', 'p1', 'main', '16', 0);
    expect(terminalHistoryCache.get('tile-0', 'main')?.data).toBe('0');
    expect(terminalHistoryCache.get('tile-1', 'main')).toBeNull();
  });

  it('clears real terminal output when the vault locks or its key profile is removed', async () => {
    cryptoVault.resetVault();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_fixture');
    terminalHistoryCache.save('tile-real', profileId, 'main', 'private output', 8);
    useAppStore.getState().lockVault();
    expect(terminalHistoryCache.get('tile-real', 'main')).toBeNull();
    await useAppStore.getState().unlockVault('long-test-passphrase-2026');
    terminalHistoryCache.save('tile-real', profileId, 'main', 'more private output', 3);
    useAppStore.getState().removeProfile(profileId);
    expect(terminalHistoryCache.get('tile-real', 'main')).toBeNull();
    cryptoVault.resetVault();
  });
});
