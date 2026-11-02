import { BrowserWindow, WebContentsView } from 'electron';
import {
  isDashboardUrl,
  validateDesktopBounds,
  validateDesktopViewOptions,
  validateDesktopViewRequest,
  type DesktopViewBounds,
  type DesktopViewOptions,
  type DesktopViewRequest,
} from './desktopViewPolicy';

export interface DesktopViewEvent {
  id: string;
  type: 'loaded' | 'error' | 'activity' | 'wheel';
  deltaY?: number;
}

export class DesktopViewGateway {
  private views = new Map<string, { profileId: string; view: WebContentsView; routeWheelToWorkspace: boolean }>();

  constructor(private window: BrowserWindow, private emit: (event: DesktopViewEvent) => void) {}

  open(request: DesktopViewRequest): void {
    validateDesktopViewRequest(request);
    this.close(request.id);
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    view.setBackgroundColor('#050507');
    view.setBounds(this.roundBounds(request.bounds));
    view.setVisible(request.options?.visible !== false);
    view.webContents.setZoomFactor(1);
    view.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown') this.emitIfCurrent(request.id, view, 'activity');
    });
    view.webContents.on('before-mouse-event', (event, mouse) => {
      if (mouse.type === 'mouseDown' || mouse.type === 'mouseWheel') this.emitIfCurrent(request.id, view, 'activity');
      const entry = this.views.get(request.id);
      if (mouse.type !== 'mouseWheel' || mouse.modifiers?.includes('alt') ||
          entry?.view !== view || !entry.routeWheelToWorkspace) return;
      const wheel = mouse as Electron.MouseWheelInputEvent;
      const deltaY = Number.isFinite(wheel.deltaY) ? wheel.deltaY! :
        Number.isFinite(wheel.wheelTicksY) ? -wheel.wheelTicksY! * 100 : 0;
      if (!deltaY) return;
      event.preventDefault();
      this.emit({ id: request.id, type: 'wheel', deltaY: Math.max(-1200, Math.min(1200, deltaY)) });
    });
    view.webContents.on('will-navigate', (event, url) => {
      if (!isDashboardUrl(url)) event.preventDefault();
    });
    view.webContents.on('will-redirect', (event, url) => {
      if (!isDashboardUrl(url)) event.preventDefault();
    });
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('did-finish-load', () => {
      if (this.views.get(request.id)?.view !== view) return;
      view.webContents.setZoomFactor(1);
      this.emitIfCurrent(request.id, view, 'loaded');
    });
    view.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.emitIfCurrent(request.id, view, 'error');
    });
    this.window.contentView.addChildView(view);
    this.views.set(request.id, { profileId: request.profileId, view,
      routeWheelToWorkspace: request.options?.routeWheelToWorkspace ?? false });
    void view.webContents.loadURL(request.url).catch(() => this.emitIfCurrent(request.id, view, 'error'));
  }

  update(id: string, bounds: DesktopViewBounds, options?: DesktopViewOptions): void {
    validateDesktopBounds(bounds);
    validateDesktopViewOptions(options);
    const entry = this.views.get(id);
    if (!entry) return;
    entry.routeWheelToWorkspace = options?.routeWheelToWorkspace ?? false;
    if (options?.visible === false) entry.view.setVisible(false);
    entry.view.setBounds(this.roundBounds(bounds));
    if (options?.visible !== false) entry.view.setVisible(true);
  }

  close(id: string): void {
    const entry = this.views.get(id);
    if (!entry) return;
    this.views.delete(id);
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(entry.view);
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close();
  }

  closeProfile(profileId: string): void {
    for (const [id, entry] of this.views) if (entry.profileId === profileId) this.close(id);
  }

  closeAll(): void {
    for (const id of this.views.keys()) this.close(id);
  }

  private emitIfCurrent(id: string, view: WebContentsView, type: DesktopViewEvent['type']): void {
    if (this.views.get(id)?.view === view && !this.window.isDestroyed()) this.emit({ id, type });
  }

  private roundBounds(bounds: DesktopViewBounds): DesktopViewBounds {
    return {
      x: Math.round(bounds.x), y: Math.round(bounds.y),
      width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)),
    };
  }
}
