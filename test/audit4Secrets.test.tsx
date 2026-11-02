import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiKeyModal } from '../src/components/modals/ApiKeyModal';
import { MasterUnlockModal } from '../src/components/modals/MasterUnlockModal';
import { cryptoVault } from '../src/services/cryptoVault';
import { useAppStore } from '../src/store/useAppStore';

beforeEach(() => { cryptoVault.resetVault(); useAppStore.getState().syncVaultState(); });
afterEach(() => { cleanup(); cryptoVault.resetVault(); });

describe('audit 4 secret input lifetime', () => {
  it('clears unsubmitted master and API key values on close and lock', async () => {
    act(() => useAppStore.getState().openApiKeyModal());
    render(React.createElement(ApiKeyModal));
    fireEvent.change(screen.getByPlaceholderText('MASTER PASSPHRASE (MIN 15 CHARS)'), { target: { value: 'unsubmitted-secret' } });
    fireEvent.click(screen.getByText('CLOSE'));
    act(() => useAppStore.getState().openApiKeyModal());
    expect((screen.getByPlaceholderText('MASTER PASSPHRASE (MIN 15 CHARS)') as HTMLInputElement).value).toBe('');
    await act(async () => { await cryptoVault.initializeVault('long-test-passphrase-2026'); });
    fireEvent.change(screen.getByPlaceholderText('INSTABOX API KEY (ibk_...)'), { target: { value: 'ibk_unsubmitted' } });
    act(() => useAppStore.getState().lockVault());
    expect(screen.queryByPlaceholderText('INSTABOX API KEY (ibk_...)')).toBeNull();
    await act(async () => { await cryptoVault.unlock('long-test-passphrase-2026'); });
    expect((screen.getByPlaceholderText('INSTABOX API KEY (ibk_...)') as HTMLInputElement).value).toBe('');
  });

  it('clears an incorrect unlock passphrase after failure and cancel', async () => {
    await act(async () => { await cryptoVault.initializeVault('long-test-passphrase-2026'); });
    act(() => cryptoVault.lock());
    act(() => useAppStore.getState().openUnlockModal());
    render(React.createElement(MasterUnlockModal));
    fireEvent.change(screen.getByPlaceholderText('ENTER MASTER PASSWORD...'), { target: { value: 'wrong-passphrase' } });
    fireEvent.click(screen.getByText('UNLOCK VAULT'));
    await waitFor(() => expect(screen.getByText(/Invalid master password/)).toBeDefined());
    expect((screen.getByPlaceholderText('ENTER MASTER PASSWORD...') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByText('CANCEL'));
    act(() => useAppStore.getState().openUnlockModal());
    expect((screen.getByPlaceholderText('ENTER MASTER PASSWORD...') as HTMLInputElement).value).toBe('');
  });
});
