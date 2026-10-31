import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fitDesktop } from '../src/components/desktop/fitDesktop';
import { SplitWorkspaceView } from '../src/components/SplitWorkspaceView';

vi.mock('../src/components/terminal/TerminalView', () => ({ TerminalView: () => 'Terminal pane' }));
vi.mock('../src/components/desktop/DesktopScreenView', () => ({ DesktopScreenView: () => 'Desktop pane' }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('resizable terminal and desktop', () => {
  it('keeps source aspect ratio while fitting either narrow or wide space', () => {
    const wide = fitDesktop(1280, 800, 600, 400);
    expect(wide).toEqual({ scale: 0.46875, width: 600, height: 375 });
    const narrow = fitDesktop(1280, 800, 300, 500);
    expect(narrow.width / narrow.height).toBe(1280 / 800);
    expect(narrow.width).toBe(300);
  });

  it('adjusts the divider by keyboard and clamps it within 25–75 percent', async () => {
    vi.stubGlobal('ResizeObserver', class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) { this.callback = callback; }
      observe() { this.callback([{ contentRect: { width: 800, height: 500 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    render(React.createElement(SplitWorkspaceView, {
      tileId: 'tile', machineId: 'm_demo', profileId: 'demo-default', sessionName: 'main', viewOnly: true,
      onSessionChange: vi.fn(), onViewOnlyChange: vi.fn(),
    }));
    const divider = screen.getByRole('separator', { name: 'Resize terminal and desktop' });
    await waitFor(() => expect(divider.getAttribute('aria-orientation')).toBe('vertical'));
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider.getAttribute('aria-valuenow')).toBe('55');
    fireEvent.keyDown(divider, { key: 'End' });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider.getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByText('Terminal pane')).toBeDefined();
    expect(screen.getByText('Desktop pane')).toBeDefined();
  });
});
