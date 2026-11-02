import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cryptoVault } from '../src/services/cryptoVault';
import { useAppStore } from '../src/store/useAppStore';
import { CreateVmModal } from '../src/components/modals/CreateVmModal';

afterEach(() => {
  cleanup();
  useAppStore.getState().closeCreateVmModal();
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
});
