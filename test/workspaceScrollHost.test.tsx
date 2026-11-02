import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WorkspaceGrid } from '../src/components/WorkspaceGrid';
import { useAppStore } from '../src/store/useAppStore';
import type { WorkspaceTile } from '../src/types/instabox';

vi.mock('../src/components/VmTilePane', () => ({ VmTilePane: () => 'tile' }));
afterEach(() => { cleanup(); useAppStore.setState({ tiles: [] }); });

it('marks the scrolling workspace containing five two-column tiles for native Desktop positioning', () => {
  const tiles: WorkspaceTile[] = Array.from({ length: 5 }, (_, index) => ({
    tileId: `tile-${index}`, machineId: `m_${index}`, profileId: 'p1',
    activeTab: 'desktop', terminalSessionName: 'main', desktopViewOnly: true,
  }));
  useAppStore.setState({ tiles, gridMode: '2x2' });
  const view = render(React.createElement(WorkspaceGrid));
  const scrollHost = view.container.querySelector('main[data-workspace-scroll]');
  expect(scrollHost).not.toBeNull();
  expect(scrollHost?.className).toContain('overflow-y-auto');
  expect(view.container.querySelector('.grid')?.textContent).toBe('tile'.repeat(5));
});
