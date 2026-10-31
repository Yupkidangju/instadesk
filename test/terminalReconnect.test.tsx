import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  binaryType = '';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  constructor() { FakeSocket.instances.push(this); }
  send() {}
  close() { this.readyState = 3; this.onclose?.(); }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cryptoVault.resetVault();
  FakeSocket.instances = [];
  delete window.instadeskDesktop;
});

describe('PTY retry', () => {
  it('opens a new WebSocket when retry is clicked with the same session name', async () => {
    await cryptoVault.initializeVault('test-password');
    const profileId = await cryptoVault.addProfile('Test', 'ibk_test');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(instaboxClient, 'getTerminalWebSocketUrl').mockResolvedValue({ url: 'wss://api.instabox.sh/terminal', protocols: [] });
    render(React.createElement(TerminalView, {
      tileId: 'tile-retry', machineId: 'm_1', profileId, sessionName: 'main', onSessionChange: vi.fn(),
    }));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    fireEvent.click(screen.getByTitle('Reconnect Terminal Session'));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    expect(FakeSocket.instances[0].readyState).toBe(3);
  });

  it('opens the desktop bridge and closes its PTY when the vault locks', async () => {
    await cryptoVault.initializeVault('test-password');
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
    } as DesktopBridge;
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
});
