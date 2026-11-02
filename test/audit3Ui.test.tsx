import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiKeyModal } from '../src/components/modals/ApiKeyModal';
import { BroadcastExecModal } from '../src/components/modals/BroadcastExecModal';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';

beforeEach(async () => {
  cryptoVault.resetVault();
  await cryptoVault.initializeVault('test-password-long');
  useAppStore.setState({ isDemoMode: false, machines: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAppStore.getState().closeApiKeyModal();
  useAppStore.getState().closeBroadcastModal();
  cryptoVault.resetVault();
  vi.useRealTimers();
});

describe('Audit 3 security UI', () => {
  it('requires target-specific confirmation and allows cancellation before profile deletion', async () => {
    await cryptoVault.addProfile('First', 'ibk_first');
    const secondId = await cryptoVault.addProfile('Second', 'ibk_second');
    vi.spyOn(instaboxClient, 'listMachines').mockResolvedValue([]);
    useAppStore.getState().openApiKeyModal();
    render(React.createElement(ApiKeyModal));
    fireEvent.click(screen.getAllByTitle('Remove Profile')[0]);
    expect(screen.getByRole('alertdialog').textContent).toContain('First');
    fireEvent.click(screen.getByText('CANCEL'));
    expect(cryptoVault.listProfiles()).toHaveLength(2);
    fireEvent.click(screen.getAllByTitle('Remove Profile')[1]);
    expect(screen.getByRole('alertdialog').textContent).toContain(secondId);
    fireEvent.click(screen.getByText('DELETE PROFILE'));
    await waitFor(() => expect(cryptoVault.listProfiles().map((profile) => profile.label)).toEqual(['First']));
  });

  it('keeps the encrypted key when the desktop connection check fails', async () => {
    const listMachines = vi.spyOn(instaboxClient, 'listMachines').mockRejectedValue(new TypeError('Failed to fetch'));
    useAppStore.getState().openApiKeyModal();
    render(React.createElement(ApiKeyModal));
    fireEvent.change(screen.getByPlaceholderText('PROFILE LABEL (e.g., Personal Org, Production Agent)'), { target: { value: 'Personal' } });
    fireEvent.change(screen.getByPlaceholderText('INSTABOX API KEY (ibk_...)'), { target: { value: 'ibk_test_only' } });
    fireEvent.click(screen.getByText('ENCRYPT, SAVE & CHECK CONNECTION'));
    await waitFor(() => expect(screen.getByText(/SAVED ENCRYPTED · CONNECTION UNVERIFIED/)).toBeDefined());
    expect(listMachines).toHaveBeenCalledTimes(1);
    expect(cryptoVault.listProfiles().map((profile) => profile.label)).toEqual(['Personal']);
    expect(localStorage.getItem('instabox_deck_vault_v1')).not.toContain('ibk_test_only');
  });

  it('presents direct desktop connection guidance without a Worker control', () => {
    useAppStore.getState().openApiKeyModal();
    render(React.createElement(ApiKeyModal));
    expect(screen.getByRole('note').textContent).toContain('connects directly to InstaBox');
    expect(screen.queryByPlaceholderText('https://your-cors-proxy.workers.dev (optional)')).toBeNull();
  });

  it('clears broadcast command and output on vault lock, including after reopening', async () => {
    const demo = await instaboxClient.listMachines('demo-default');
    useAppStore.setState({ machines: [demo[0]], isDemoMode: true });
    useAppStore.getState().openBroadcastModal();
    render(React.createElement(BroadcastExecModal));
    const command = screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...') as HTMLInputElement;
    fireEvent.change(command, { target: { value: 'sensitive command' } });
    fireEvent.click(screen.getByText('DISPATCH ALL'));
    await waitFor(() => expect(screen.getByText(/LIVE OUTPUT STREAMS/)).toBeDefined());
    cryptoVault.lock();
    await waitFor(() => expect(screen.queryByText(/PARALLEL BROADCAST EXECUTION/)).toBeNull());
    useAppStore.getState().openBroadcastModal();
    await waitFor(() => expect(screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...')).toBeDefined());
    expect((screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/LIVE OUTPUT STREAMS/)).toBeNull();
  });

  it('aborts an in-progress demo broadcast when the vault auto-locks', async () => {
    cryptoVault.resetVault();
    vi.useFakeTimers();
    await cryptoVault.initializeVault('test-password-long', 0.001);
    const demo = await instaboxClient.listMachines('demo-default');
    useAppStore.setState({ machines: [demo[0]], isDemoMode: true });
    useAppStore.getState().openBroadcastModal();
    render(React.createElement(BroadcastExecModal));
    fireEvent.change(screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...'), { target: { value: 'private output' } });
    fireEvent.click(screen.getByText('DISPATCH ALL'));
    act(() => { vi.advanceTimersByTime(100); });
    expect(cryptoVault.isUnlocked()).toBe(false);
    expect(screen.queryByText(/PARALLEL BROADCAST EXECUTION/)).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    useAppStore.getState().openBroadcastModal();
    expect(screen.queryByText(/LIVE OUTPUT STREAMS/)).toBeNull();
  });

  it('treats equal machine IDs in different profiles as separate broadcast targets', async () => {
    const [template] = await instaboxClient.listMachines('demo-default');
    useAppStore.setState({ machines: [
      { ...template, id: 'shared', name: 'First VM', profileId: 'first', profileLabel: 'First' },
      { ...template, id: 'shared', name: 'Second VM', profileId: 'second', profileLabel: 'Second' },
    ] });
    const stream = vi.spyOn(instaboxClient, 'streamExec').mockImplementation(async (profileId, _machineId, _request, onStdout, _onStderr, onExit) => {
      onStdout(profileId);
      onExit({ stdout: '', stderr: '', exitCode: 0, timedOut: false, truncated: false });
    });
    useAppStore.getState().openBroadcastModal();
    render(React.createElement(BroadcastExecModal));
    fireEvent.change(screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...'), { target: { value: 'echo test' } });
    fireEvent.click(screen.getByText('DISPATCH ALL'));
    await waitFor(() => expect(stream).toHaveBeenCalledTimes(2));
    expect(stream.mock.calls.map((call) => call[0])).toEqual(['first', 'second']);
    expect(screen.getAllByText('First VM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Second VM').length).toBeGreaterThan(0);
  });

  it('dispatches five independent SSE targets without requiring any PTY session', async () => {
    const [template] = await instaboxClient.listMachines('demo-default');
    const machines = [];
    for (let index = 0; index < 5; index++) {
      machines.push({ ...template, id: `m_${index}`, name: `VM ${index + 1}`,
        profileId: await cryptoVault.addProfile(`Key ${index + 1}`, `ibk_fixture_${index + 1}`),
        profileLabel: `Key ${index + 1}` });
    }
    useAppStore.setState({ machines, sessionStates: {} });
    const stream = vi.spyOn(instaboxClient, 'streamExec').mockImplementation(async (_profileId, machineId, _request,
      _onStdout, _onStderr, onExit, onError) => {
      if (machineId === 'm_4') onError(new Error('temporary failure'));
      else onExit({ stdout: '', stderr: '', exitCode: 0, timedOut: false, truncated: false });
    });
    useAppStore.getState().openBroadcastModal();
    render(React.createElement(BroadcastExecModal));
    fireEvent.change(screen.getByPlaceholderText('ENTER COMMAND TO BROADCAST...'), { target: { value: 'uptime' } });
    fireEvent.click(screen.getByText('DISPATCH ALL'));
    await waitFor(() => expect(stream).toHaveBeenCalledTimes(5));
    expect(stream.mock.calls.map(call => call[1]).sort()).toEqual(['m_0', 'm_1', 'm_2', 'm_3', 'm_4']);
    expect(useAppStore.getState().sessionStates).toEqual({});
    expect(screen.getAllByText('EXIT: 0')).toHaveLength(4);
    expect(screen.getByText('EXIT: FAIL')).toBeDefined();
  });
});
