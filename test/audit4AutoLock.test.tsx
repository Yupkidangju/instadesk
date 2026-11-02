import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { App } from '../src/App';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';

afterEach(() => { cleanup(); cryptoVault.resetVault(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('audit 4 user inactivity lock', () => {
  it('locks during 10 second API polling and extends only after a key press', async () => {
    vi.useFakeTimers();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    await cryptoVault.addProfile('test', 'ibk_test');
    const request = vi.spyOn(instaboxClient, 'listMachines').mockImplementation(async (id) => {
      await cryptoVault.withDecryptedKey(id, async () => undefined);
      return [];
    });
    render(React.createElement(App));
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(cryptoVault.isUnlocked()).toBe(true);
    fireEvent.keyDown(window, { key: 'a' });
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(cryptoVault.isUnlocked()).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(cryptoVault.isUnlocked()).toBe(false);
    expect(request.mock.calls.length).toBeGreaterThan(10);
    expect(useAppStore.getState().sessionStates).toEqual({});
  });
});
