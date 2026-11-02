import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { TerminalView } from '../src/components/terminal/TerminalView';
import { useAppStore } from '../src/store/useAppStore';
import type { DesktopBridge } from '../src/types/desktopBridge';

vi.mock('@xterm/xterm', () => ({ Terminal: class {
  cols = 80;
  rows = 24;
  loadAddon() {}
  open() {}
  writeln() {}
  write() {}
  clear() {}
  dispose() {}
  onData() {}
  onResize() {}
} }));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cryptoVault.resetVault();
  delete window.instadeskDesktop;
});

describe('PTY retry', () => {
  it('opens a new desktop PTY when retry is clicked with the same session name', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_test');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    const closeTerminal = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = {
      isDesktop: true, openTerminal, closeTerminal,
      closeAll: vi.fn(), closeProfile: vi.fn(), sendTerminal: vi.fn(), resizeTerminal: vi.fn().mockResolvedValue(undefined),
      onTerminalEvent: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopBridge;
    vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://api.instabox.sh/v1/terminal',
      protocols: ['instabox-terminal.v1', 'instabox-access-token.ok'],
    });
    render(React.createElement(TerminalView, {
      tileId: 'tile-retry', machineId: 'm_1', profileId, sessionName: 'main', onSessionChange: vi.fn(),
    }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Reconnect Terminal Session'));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(2));
    expect(closeTerminal).toHaveBeenCalledWith('tile-retry');
  });

  it('opens the desktop bridge and closes its PTY when the vault locks', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_test');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    const closeTerminal = vi.fn().mockResolvedValue(undefined);
    const closeAll = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = {
      isDesktop: true,
      openTerminal,
      closeTerminal,
      closeAll,
      sendTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
      closeProfile: vi.fn(),
      onTerminalEvent: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopBridge;
    vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://connect.instabox.sh/v1/terminal?ticket=ok',
      protocols: ['instabox-terminal.v1', 'instabox-access-token.ok'],
    });
    render(React.createElement(TerminalView, {
      tileId: 'tile-desktop', machineId: 'm_1', profileId, sessionName: 'main', onSessionChange: vi.fn(),
    }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tile-desktop', profileId, sessionName: 'main',
    })));
    useAppStore.getState().lockVault();
    await waitFor(() => expect(closeAll).toHaveBeenCalled());
  });

  it('marks PTY live only after session and retries 429 once with a fresh ticket', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_test');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    let onEvent: (event: Parameters<Parameters<DesktopBridge['onTerminalEvent']>[0]>[0]) => void = () => {};
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = { isDesktop: true, openTerminal, closeTerminal: vi.fn().mockResolvedValue(undefined),
      closeAll: vi.fn(), closeProfile: vi.fn(), sendTerminal: vi.fn(), resizeTerminal: vi.fn().mockResolvedValue(undefined),
      onTerminalEvent: vi.fn((callback) => { onEvent = callback; return () => {}; }) } as unknown as DesktopBridge;
    const ticket = vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://connect.instabox.sh/v1/terminal', protocols: ['instabox-terminal.v1', 'instabox-access-token.ok'],
    });
    render(React.createElement(TerminalView, { tileId: 'retry-429', machineId: 'm_1', profileId,
      sessionName: 'main', onSessionChange: vi.fn() }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(1));
    act(() => onEvent({ id: 'retry-429', type: 'open' }));
    expect(screen.queryByText('PTY LIVE')).toBeNull();
    vi.useFakeTimers();
    act(() => onEvent({ id: 'retry-429', type: 'error', category: 'rate_limit', httpStatus: 429, retryAfterMs: 2000 }));
    expect(screen.getByText(/HTTP 429/)).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(openTerminal).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(openTerminal).toHaveBeenCalledTimes(2);
    expect(ticket).toHaveBeenCalledTimes(2);
    act(() => onEvent({ id: 'retry-429', type: 'ready' }));
    expect(screen.getByText('PTY LIVE')).toBeDefined();
  });

  it('cancels a scheduled transient retry when the vault locks', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_test');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    let onEvent: (event: Parameters<Parameters<DesktopBridge['onTerminalEvent']>[0]>[0]) => void = () => {};
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = { isDesktop: true, openTerminal, closeTerminal: vi.fn().mockResolvedValue(undefined),
      closeAll: vi.fn().mockResolvedValue(undefined), closeProfile: vi.fn(), sendTerminal: vi.fn(),
      resizeTerminal: vi.fn().mockResolvedValue(undefined),
      onTerminalEvent: vi.fn((callback) => { onEvent = callback; return () => {}; }) } as unknown as DesktopBridge;
    vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://connect.instabox.sh/v1/terminal', protocols: ['instabox-terminal.v1', 'instabox-access-token.ok'],
    });
    render(React.createElement(TerminalView, { tileId: 'lock-retry', machineId: 'm_1', profileId,
      sessionName: 'main', onSessionChange: vi.fn() }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => onEvent({ id: 'lock-retry', type: 'error', category: 'unavailable', httpStatus: 503 }));
    act(() => useAppStore.getState().lockVault());
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(openTerminal).toHaveBeenCalledTimes(1);
  });

  it('recovers three transient failures across five same-profile PTYs without a local quota gate', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Five', 'ibk_fixture');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    type Event = Parameters<Parameters<DesktopBridge['onTerminalEvent']>[0]>[0];
    const listeners = new Set<(event: Event) => void>();
    const emit = (event: Event) => { for (const listener of [...listeners]) listener(event); };
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = { isDesktop: true, openTerminal,
      closeTerminal: vi.fn().mockResolvedValue(undefined), closeAll: vi.fn().mockResolvedValue(undefined),
      closeProfile: vi.fn().mockResolvedValue(undefined), sendTerminal: vi.fn().mockResolvedValue(undefined),
      resizeTerminal: vi.fn().mockResolvedValue(undefined),
      onTerminalEvent: vi.fn((callback) => { listeners.add(callback); return () => listeners.delete(callback); }),
    } as unknown as DesktopBridge;
    const ticket = vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://connect.instabox.sh/v1/terminal', protocols: ['instabox-terminal.v1', 'instabox-access-token.fixture'],
    });
    render(React.createElement('div', null, ...Array.from({ length: 5 }, (_, index) =>
      React.createElement(TerminalView, { key: index, tileId: `five-${index}`, machineId: `m_${index}`,
        profileId, sessionName: 'main', onSessionChange: vi.fn() }))));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(5));
    vi.useFakeTimers();
    act(() => {
      for (let index = 0; index < 5; index++) emit({ id: `five-${index}`, type: 'open' });
      emit({ id: 'five-0', type: 'ready' }); emit({ id: 'five-1', type: 'ready' });
      emit({ id: 'five-2', type: 'error', category: 'rate_limit', httpStatus: 429, retryAfterMs: 2000 });
      emit({ id: 'five-3', type: 'error', category: 'unavailable', httpStatus: 503 });
      emit({ id: 'five-4', type: 'error', category: 'network', closeCode: 1006 });
    });
    expect(screen.getAllByText('PTY LIVE')).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(openTerminal).toHaveBeenCalledTimes(8);
    expect(ticket).toHaveBeenCalledTimes(8);
    act(() => { for (let index = 2; index < 5; index++) emit({ id: `five-${index}`, type: 'ready' }); });
    expect(screen.getAllByText('PTY LIVE')).toHaveLength(5);
  });

  it('cancels pending retries after tile close and profile deletion', async () => {
    await cryptoVault.initializeVault('test-password-long');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_fixture');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    type Event = Parameters<Parameters<DesktopBridge['onTerminalEvent']>[0]>[0];
    const listeners = new Set<(event: Event) => void>();
    const openTerminal = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = { isDesktop: true, openTerminal,
      closeTerminal: vi.fn().mockResolvedValue(undefined), closeAll: vi.fn().mockResolvedValue(undefined),
      closeProfile: vi.fn().mockResolvedValue(undefined), sendTerminal: vi.fn().mockResolvedValue(undefined),
      resizeTerminal: vi.fn().mockResolvedValue(undefined),
      onTerminalEvent: vi.fn((callback) => { listeners.add(callback); return () => listeners.delete(callback); }),
    } as unknown as DesktopBridge;
    vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({
      url: 'wss://connect.instabox.sh/v1/terminal', protocols: ['instabox-terminal.v1', 'instabox-access-token.fixture'],
    });
    const tile = (id: string) => React.createElement(TerminalView, { key: id, tileId: id,
      machineId: id, profileId, sessionName: 'main', onSessionChange: vi.fn() });
    const mounted = render(React.createElement('div', null, tile('close-me'), tile('delete-profile')));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(2));
    vi.useFakeTimers();
    act(() => { for (const listener of [...listeners]) {
      listener({ id: 'close-me', type: 'error', category: 'unavailable', httpStatus: 503 });
      listener({ id: 'delete-profile', type: 'error', category: 'unavailable', httpStatus: 503 });
    } });
    mounted.rerender(React.createElement('div', null, tile('delete-profile')));
    act(() => useAppStore.getState().removeProfile(profileId));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(openTerminal).toHaveBeenCalledTimes(2);
  });
});
