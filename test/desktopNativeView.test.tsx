import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DesktopScreenView } from '../src/components/desktop/DesktopScreenView';
import { instaboxClient } from '../src/services/instaboxClient';
import { cryptoVault } from '../src/services/cryptoVault';
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
      observe() { this.callback([{ contentRect: { width: 640, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 300, y: 200, left: 300, top: 200, right: 940, bottom: 800,
      width: 640, height: 600, toJSON: () => ({}),
    });
    vi.spyOn(instaboxClient, 'desktopAction').mockResolvedValue({ installed: true, running: true, width: 1280, height: 800 });
    const signedUrl = 'https://dashboard.instabox.sh/desktop/m_1#signed-test';
    vi.spyOn(instaboxClient, 'createDesktopStreamLink').mockResolvedValue({ url: signedUrl, expiresAt: new Date().toISOString() });
    const openDesktopView = vi.fn().mockResolvedValue(undefined);
    const updateDesktopView = vi.fn().mockResolvedValue(undefined);
    const closeDesktopView = vi.fn().mockResolvedValue(undefined);
    let onDesktopEvent: (event: { id: string; type: 'activity' | 'loaded' | 'error' }) => void = () => {};
    const activity = vi.spyOn(cryptoVault, 'touch');
    window.instadeskDesktop = {
      isDesktop: true, openDesktopView, updateDesktopView, closeDesktopView,
      onDesktopEvent: vi.fn((callback) => { onDesktopEvent = callback; return () => {}; }),
    } as unknown as DesktopBridge;
    render(React.createElement(DesktopScreenView, {
      machineId: 'm_1', profileId: 'p1', viewOnly: true, onViewOnlyChange: vi.fn(),
    }));
    await waitFor(() => expect(openDesktopView).toHaveBeenCalledWith(expect.objectContaining({
      url: signedUrl, bounds: { x: 300, y: 200, width: 640, height: 600 },
    })));
    expect(screen.queryByTitle('Desktop Stream m_1')).toBeNull();
    expect(updateDesktopView).toHaveBeenCalled();
    act(() => onDesktopEvent({ id: 'desktop_p1_m_1', type: 'activity' }));
    expect(activity).toHaveBeenCalledTimes(1);
    act(() => useAppStore.getState().openApiKeyModal());
    await waitFor(() => expect(closeDesktopView).toHaveBeenCalledWith('desktop_p1_m_1'));
  });

  it('hides a right-column native desktop while its tile scrolls out and restores it without reopening', async () => {
    let top = 190;
    const rect = (left: number, y: number, width: number, height: number) => ({
      x: left, y, left, top: y, right: left + width, bottom: y + height,
      width, height, toJSON: () => ({}),
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 620 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-workspace-scroll') ? rect(288, 110, 1140, 850) : rect(1010, top, 400, 620);
    });
    vi.spyOn(instaboxClient, 'desktopAction').mockResolvedValue({ installed: true, running: true, width: 1280, height: 800 });
    vi.spyOn(instaboxClient, 'createDesktopStreamLink').mockResolvedValue({
      url: 'https://dashboard.instabox.sh/desktop/m_1#signed-test', expiresAt: new Date().toISOString(),
    });
    const openDesktopView = vi.fn().mockResolvedValue(undefined);
    const updateDesktopView = vi.fn().mockResolvedValue(undefined);
    let onDesktopEvent: (event: { id: string; type: 'wheel'; deltaY: number }) => void = () => {};
    window.instadeskDesktop = { isDesktop: true, openDesktopView, updateDesktopView,
      closeDesktopView: vi.fn().mockResolvedValue(undefined),
      onDesktopEvent: vi.fn((callback) => { onDesktopEvent = callback; return () => {}; }),
    } as unknown as DesktopBridge;
    const mounted = render(React.createElement('main', { 'data-workspace-scroll': true },
      React.createElement(DesktopScreenView, { machineId: 'm_1', profileId: 'p1', viewOnly: true,
        onViewOnlyChange: vi.fn() })));
    const scrollHost = mounted.container.querySelector('main')!;
    const scrollBy = vi.fn();
    scrollHost.scrollBy = scrollBy;
    Object.defineProperty(scrollHost, 'scrollHeight', { value: 2000 });
    Object.defineProperty(scrollHost, 'clientHeight', { value: 850 });
    await waitFor(() => expect(openDesktopView).toHaveBeenCalledTimes(1));
    act(() => onDesktopEvent({ id: 'desktop_p1_m_1', type: 'wheel', deltaY: 120 }));
    expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: 'auto' });
    top = -120;
    fireEvent.scroll(scrollHost);
    await waitFor(() => expect(updateDesktopView).toHaveBeenLastCalledWith('desktop_p1_m_1',
      { x: 1010, y: 0, width: 400, height: 620 }, { visible: false, routeWheelToWorkspace: true }));
    top = 250;
    fireEvent.scroll(scrollHost);
    await waitFor(() => expect(updateDesktopView).toHaveBeenLastCalledWith('desktop_p1_m_1',
      { x: 1010, y: 250, width: 400, height: 620 }, { visible: true, routeWheelToWorkspace: true }));
    expect(openDesktopView).toHaveBeenCalledTimes(1);
  });
});
