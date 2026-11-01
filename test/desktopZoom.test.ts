import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const { setZoomFactor } = vi.hoisted(() => ({ setZoomFactor: vi.fn() }));
vi.mock('electron', () => ({
  WebContentsView: class {
    webContents = {
      setZoomFactor,
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
    };
    setBackgroundColor() {}
    setBounds() {}
  },
}));

import { DesktopViewGateway } from '../electron/desktopViewGateway';

describe('native dashboard scale', () => {
  it('resets inherited host zoom before opening a signed viewer', () => {
    const window = {
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      isDestroyed: () => false,
    } as unknown as BrowserWindow;
    new DesktopViewGateway(window, vi.fn()).open({
      id: 'view1', profileId: 'profile1',
      url: 'https://dashboard.instabox.sh/desktop/m_1#signed-test',
      bounds: { x: 300, y: 200, width: 560, height: 350 },
    });
    expect(setZoomFactor).toHaveBeenCalledWith(1);
  });
});
