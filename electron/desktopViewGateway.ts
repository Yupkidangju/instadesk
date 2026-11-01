import { BrowserWindow, WebContentsView } from 'electron';
import {
  isDashboardUrl,
  validateDesktopBounds,
  validateDesktopViewRequest,
  type DesktopViewBounds,
  type DesktopViewRequest,
} from './desktopViewPolicy';

export interface DesktopViewEvent {
  id: string;
  type: 'loaded' | 'error';
}

export class DesktopViewGateway {
  private views = new Map<string, { profileId: string; view: WebContentsView }>();

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
    view.webContents.setZoomFactor(1);
    view.webContents.on('will-navigate', (event, url) => {
      if (!isDashboardUrl(url)) event.preventDefault();
    });
    view.webContents.on('will-redirect', (event, url) => {
      if (!isDashboardUrl(url)) event.preventDefault();
    });
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('did-finish-load', () => this.emitIfCurrent(request.id, view, 'loaded'));
    view.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.emitIfCurrent(request.id, view, 'error');
    });
    this.window.contentView.addChildView(view);
    this.views.set(request.id, { profileId: request.profileId, view });
    void view.webContents.loadURL(request.url).catch(() => this.emitIfCurrent(request.id, view, 'error'));
  }

  update(id: string, bounds: DesktopViewBounds): void {
    validateDesktopBounds(bounds);
    const view = this.views.get(id)?.view;
    if (!view) return;
    view.setBounds(this.roundBounds(bounds));
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
