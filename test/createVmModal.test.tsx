import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';
import { CreateVmModal } from '../src/components/modals/CreateVmModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.getState().closeCreateVmModal();
  useAppStore.getState().clearAllTiles();
  cryptoVault.resetVault();
});

describe('Create VM target selection', () => {
  it('defaults to a registered real profile when opened after registration', async () => {
    cryptoVault.resetVault();
    await cryptoVault.initializeVault('test-password-long');
    const id = await cryptoVault.addProfile('Production', 'ibk_test');
    useAppStore.getState().openCreateVmModal();
    render(React.createElement(CreateVmModal));
    const select = screen.getByLabelText('TARGET WORKSPACE:') as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(id));
    expect(screen.queryByText('00 // DEMO_SWISS_CLUSTER (SIMULATION)')).toBeNull();
  });

  it('clears machine name after successful creation and on modal reopen (DBG-F022)', async () => {
    useAppStore.setState({ isDemoMode: true });
    vi.spyOn(instaboxClient, 'createMachine').mockResolvedValue({ machineId: 'm_new', operationId: 'op_1' });
    vi.spyOn(useAppStore.getState(), 'refreshMachines').mockResolvedValue(undefined);

    useAppStore.getState().openCreateVmModal();
    const view = render(React.createElement(CreateVmModal));

    const nameInput = screen.getByPlaceholderText('e.g. box-agent-eval-01 (1-63 chars)') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'box-custom-01' } });
    expect(nameInput.value).toBe('box-custom-01');

    fireEvent.click(screen.getByRole('button', { name: /CREATE INSTANCE/i }));
    await waitFor(() => expect(useAppStore.getState().isCreateVmModalOpen).toBe(false));

    useAppStore.getState().openCreateVmModal();
    view.rerender(React.createElement(CreateVmModal));
    const reopenedInput = screen.getByPlaceholderText('e.g. box-agent-eval-01 (1-63 chars)') as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });
});
