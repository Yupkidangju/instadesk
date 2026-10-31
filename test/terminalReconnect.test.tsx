import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { TerminalView } from '../src/components/terminal/TerminalView';

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
});
