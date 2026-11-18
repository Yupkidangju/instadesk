import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MasterUnlockModal } from '../src/components/modals/MasterUnlockModal';
import { HeaderBar } from '../src/components/HeaderBar';
import { cryptoVault } from '../src/services/cryptoVault';
import { useAppStore } from '../src/store/useAppStore';

beforeEach(() => {
  cryptoVault.resetVault();
  useAppStore.getState().clearAllTiles();
  useAppStore.getState().syncVaultState();
  useAppStore.getState().closeUnlockModal();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.getState().closeUnlockModal();
  useAppStore.getState().clearAllTiles();
  cryptoVault.resetVault();
});

describe('MasterUnlockModal create vs unlock and 10-attempt wipe', () => {
  it('shows create flow when vault has no master password yet and unlocks after creation', async () => {
    expect(cryptoVault.isInitialized()).toBe(false);

    render(
      <>
        <HeaderBar sidebarOpen={false} onToggleSidebar={vi.fn()} />
        <MasterUnlockModal />
      </>
    );

    fireEvent.click(screen.getByText('SET MASTER KEY'));
    expect(screen.getByText(/VAULT INITIALIZATION \/\/ CREATE MASTER KEY/i)).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('CREATE MASTER PASSPHRASE (MIN 15 CHARS)'), {
      target: { value: 'brand-new-master-passphrase-2026' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRM MASTER PASSPHRASE'), {
      target: { value: 'brand-new-master-passphrase-2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /CREATE VAULT/i }));

    await waitFor(() => expect(cryptoVault.isInitialized()).toBe(true));
    expect(cryptoVault.isUnlocked()).toBe(true);
    expect(useAppStore.getState().isUnlockModalOpen).toBe(false);
  });

  it('shows unlock flow when initialized, wipes stored data on 10th wrong attempt, and switches to create flow', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const profileId = await cryptoVault.addProfile('Prod', 'ibk_secret_prod');
    useAppStore.getState().addTile('m_real_1', profileId, 'terminal');
    cryptoVault.lock();

    act(() => useAppStore.getState().openUnlockModal());
    render(<MasterUnlockModal />);

    expect(screen.getByText(/VAULT LOCKED \/\/ AUTH REQUIRED/i)).toBeDefined();

    for (let i = 1; i <= 9; i += 1) {
      fireEvent.change(screen.getByPlaceholderText('ENTER MASTER PASSWORD...'), {
        target: { value: `wrong-attempt-${i}` },
      });
      fireEvent.click(screen.getByRole('button', { name: /UNLOCK VAULT/i }));
      await waitFor(() =>
        expect(screen.getByText(new RegExp(`Failed unlock attempts: ${i} / 10`))).toBeDefined()
      );
      expect(localStorage.getItem('instabox_deck_vault_v1')).not.toBeNull();
    }

    fireEvent.change(screen.getByPlaceholderText('ENTER MASTER PASSWORD...'), {
      target: { value: 'wrong-attempt-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /UNLOCK VAULT/i }));

    await waitFor(() =>
      expect(screen.getByText(/Maximum failed attempts \(10\) reached/i)).toBeDefined()
    );
    expect(localStorage.getItem('instabox_deck_vault_v1')).toBeNull();
    expect(cryptoVault.isInitialized()).toBe(false);
    expect(useAppStore.getState().profiles).toEqual([]);
    expect(useAppStore.getState().tiles).toEqual([]);
    // 볼트 초기화 상태로 전환되어 CREATE 화면이 표시되어야 함
    expect(screen.getByText(/VAULT INITIALIZATION \/\/ CREATE MASTER KEY/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /CREATE VAULT/i })).toBeDefined();
  });
});
