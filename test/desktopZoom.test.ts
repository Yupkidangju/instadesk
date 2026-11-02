import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const { setZoomFactor, setVisible, setBounds, handlers } = vi.hoisted(() => ({
  setZoomFactor: vi.fn(), setVisible: vi.fn(), setBounds: vi.fn(),
  handlers: new Map<string, (...args: unknown[]) => void>(),
}));
vi.mock('electron', () => ({
  WebContentsView: class {
    webContents = {
      setZoomFactor,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => { handlers.set(event, handler); }),
      setWindowOpenHandler: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
    };
    setBackgroundColor() {}
    setBounds = setBounds;
    setVisible = setVisible;
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
    setZoomFactor.mockClear();
    handlers.get('did-finish-load')?.();
    expect(setZoomFactor).toHaveBeenCalledWith(1);
  });

  it('hides an offscreen native view without closing it and forwards workspace wheel input', () => {
    setVisible.mockClear();
    const emit = vi.fn();
    const window = {
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      isDestroyed: () => false,
    } as unknown as BrowserWindow;
    const gateway = new DesktopViewGateway(window, emit);
    gateway.open({ id: 'view2', profileId: 'profile1',
      url: 'https://dashboard.instabox.sh/desktop/m_1#signed-test',
      bounds: { x: 1010, y: 0, width: 400, height: 620 },
      options: { visible: false, routeWheelToWorkspace: true },
    });
    expect(setVisible).toHaveBeenCalledWith(false);
    const preventDefault = vi.fn();
    handlers.get('before-mouse-event')?.({ preventDefault }, { type: 'mouseWheel', deltaY: 120, modifiers: [] });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ id: 'view2', type: 'wheel', deltaY: 120 });
    preventDefault.mockClear();
    handlers.get('before-mouse-event')?.({ preventDefault }, { type: 'mouseWheel', deltaY: 120, modifiers: ['alt'] });
    expect(preventDefault).not.toHaveBeenCalled();
    gateway.update('view2', { x: 1010, y: 250, width: 400, height: 620 },
      { visible: true, routeWheelToWorkspace: false });
    expect(setVisible).toHaveBeenLastCalledWith(true);
    preventDefault.mockClear();
    handlers.get('before-mouse-event')?.({ preventDefault }, { type: 'mouseWheel', deltaY: 120, modifiers: [] });
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
