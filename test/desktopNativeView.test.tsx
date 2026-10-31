import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { DesktopScreenView } from '../src/components/desktop/DesktopScreenView';
import { instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';
import type { DesktopBridge } from '../src/types/desktopBridge';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.instadeskDesktop;
  useAppStore.setState({ isApiKeyModalOpen: false, machines: [] });
});

describe('native desktop view', () => {
  it('does not open a signed view while the VM is suspended', async () => {
    const [demo] = await instaboxClient.listMachines('demo-default');
    useAppStore.setState({ machines: [{ ...demo, id: 'm_1', profileId: 'p1', state: 'suspended' }] });
    const desktopAction = vi.spyOn(instaboxClient, 'desktopAction');
    render(React.createElement(DesktopScreenView, {
      machineId: 'm_1', profileId: 'p1', viewOnly: true, onViewOnlyChange: vi.fn(),
    }));
    await waitFor(() => expect(screen.getByText('VM IS SUSPENDED')).toBeDefined());
    expect(desktopAction).not.toHaveBeenCalled();
  });

  it('opens the signed link as a separate view, updates bounds and closes behind a modal', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() { this.callback([{ contentRect: { width: 640, height: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 300, y: 200, left: 300, top: 200, right: 940, bottom: 600,
      width: 640, height: 400, toJSON: () => ({}),
    });
    vi.spyOn(instaboxClient, 'desktopAction').mockResolvedValue({ installed: true, running: true, width: 1280, height: 800 });
    const signedUrl = 'https://dashboard.instabox.sh/desktop/m_1#signed-test';
    vi.spyOn(instaboxClient, 'createDesktopStreamLink').mockResolvedValue({ url: signedUrl, expiresAt: new Date().toISOString() });
    const openDesktopView = vi.fn().mockResolvedValue(undefined);
    const updateDesktopView = vi.fn().mockResolvedValue(undefined);
    const closeDesktopView = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = {
      isDesktop: true, openDesktopView, updateDesktopView, closeDesktopView,
      onDesktopEvent: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopBridge;
    render(React.createElement(DesktopScreenView, {
      machineId: 'm_1', profileId: 'p1', viewOnly: true, onViewOnlyChange: vi.fn(),
    }));
    await waitFor(() => expect(openDesktopView).toHaveBeenCalledWith(expect.objectContaining({
      url: signedUrl, bounds: { x: 300, y: 200, width: 640, height: 400 }, zoom: 0.5,
    })));
    expect(screen.queryByTitle('Desktop Stream m_1')).toBeNull();
    expect(updateDesktopView).toHaveBeenCalled();
    act(() => useAppStore.getState().openApiKeyModal());
    await waitFor(() => expect(closeDesktopView).toHaveBeenCalledWith('desktop_p1_m_1'));
  });
});
