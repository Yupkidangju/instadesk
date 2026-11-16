import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkspaceGrid } from '../src/components/WorkspaceGrid';
import { instaboxClient } from '../src/services/instaboxClient';
import { terminalHistoryCache } from '../src/components/terminal/terminalHistoryCache';
import { useAppStore } from '../src/store/useAppStore';

const probe = vi.hoisted(() => ({ terminals: [] as Array<{ writes: string[]; scrollLines: (amount: number) => void; scrollAmounts: number[] }> }));
vi.mock('@xterm/xterm', () => ({ Terminal: class {
  cols = 80;
  rows = 24;
  buffer = { active: { baseY: 30, viewportY: 12 } };
  writes: string[] = [];
  scrollAmounts: number[] = [];
  constructor(options: { cols: number; rows: number }) {
    if (!Number.isFinite(options.cols) || !Number.isFinite(options.rows)) throw new Error('Invalid terminal dimensions');
    this.cols = options.cols;
    this.rows = options.rows;
    probe.terminals.push(this);
  }
  loadAddon(addon: { activate?: (term: { writes: string[] }) => void }) { addon.activate?.(this); }
  open() {}
  writeln(value: string) { this.writes.push(`${value}\n`); }
  write(value: string, callback?: () => void) { this.writes.push(value); callback?.(); }
  clear() { this.writes = []; }
  dispose() {}
  onData() {}
  onResize() {}
  scrollLines(amount: number) { this.scrollAmounts.push(amount); }
} }));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }));
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: class {
  terminal?: { writes: string[] };
  activate(terminal: { writes: string[] }) { this.terminal = terminal; }
  serialize() { return this.terminal?.writes.join('') ?? ''; }
} }));
vi.mock('../src/components/terminal/ExecRunnerView', () => ({ ExecRunnerView: () => 'Exec pane' }));

afterEach(() => {
  cleanup();
  terminalHistoryCache.clear();
  probe.terminals.length = 0;
  useAppStore.setState({ tiles: [], machines: [], gridMode: '2x1', isDemoMode: false });
  vi.unstubAllGlobals();
});

it('restores the same terminal scrollback and reading offset after 1x1 focus and TERM/EXEC round trips', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const machines = (await instaboxClient.listMachines('demo-default')).slice(0, 2);
  const tiles = machines.map((machine, index) => ({
    tileId: `tile-${index}`, machineId: machine.id, profileId: 'demo-default',
    activeTab: 'terminal' as const, terminalSessionName: 'main', desktopViewOnly: true,
  }));
  useAppStore.setState({ tiles, machines, gridMode: '1x1', isDemoMode: true });
  render(React.createElement(WorkspaceGrid));
  expect(probe.terminals).toHaveLength(1);
  const firstHistory = probe.terminals[0].writes.join('');

  const navigation = screen.getByRole('navigation', { name: 'Focused workspace' });
  fireEvent.click(within(navigation).getByRole('button', { name: machines[1].name }));
  expect(terminalHistoryCache.get('tile-0', 'main')?.data).toBe(firstHistory);
  fireEvent.click(within(navigation).getByRole('button', { name: machines[0].name }));
  expect(probe.terminals[2].writes[0]).toBe(firstHistory);
  expect(probe.terminals[2].scrollAmounts).toContain(-18);

  fireEvent.click(screen.getByRole('button', { name: 'EXEC' }));
  expect(screen.getByText('Exec pane')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'TERMINAL' }));
  expect(probe.terminals[3].writes[0]).toContain('Initializing terminal PTY session');
  expect(probe.terminals[3].scrollAmounts).toContain(-18);

  useAppStore.getState().removeTile('tile-0');
  expect(terminalHistoryCache.get('tile-0', 'main')).toBeNull();
});
