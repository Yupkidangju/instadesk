import { app, BrowserWindow, ipcMain, net, protocol, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAppAsset } from './appProtocol';
import { proxyApiRequest } from './apiGateway';
import { TerminalGateway, type TerminalOpenRequest } from './terminalGateway';
import { DesktopViewGateway } from './desktopViewGateway';
import type { DesktopViewBounds, DesktopViewRequest } from './desktopViewPolicy';

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

const rendererRoot = path.join(app.getAppPath(), 'dist');
const appOrigin = 'app://instadesk';
const smokeMode = process.argv.includes('--smoke-test');
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  const existing = BrowserWindow.getAllWindows()[0];
  if (existing?.isMinimized()) existing.restore();
  existing?.focus();
});

function createWindow(): void {
  const window = new BrowserWindow({
    show: !smokeMode,
    width: 1440,
    height: 900,
    minWidth: 390,
    minHeight: 600,
    backgroundColor: '#09090b',
    title: 'InstaBox Deck',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !smokeMode,
    },
  });

  const terminals = new TerminalGateway((event) => {
    if (!window.isDestroyed()) window.webContents.send('terminal:event', event);
  });
  const desktops = new DesktopViewGateway(window, (event) => {
    if (!window.isDestroyed()) window.webContents.send('desktop:event', event);
  });
  const ownRenderer = (event: Electron.IpcMainInvokeEvent): void => {
    if (event.sender !== window.webContents || !event.senderFrame?.url.startsWith(`${appOrigin}/`)) {
      throw new Error('Untrusted terminal caller');
    }
  };
  ipcMain.handle('terminal:open', (event, request: TerminalOpenRequest) => {
    ownRenderer(event);
    terminals.open(request);
  });
  ipcMain.handle('terminal:send', (event, id: string, data: string) => {
    ownRenderer(event);
    terminals.send(id, data);
  });
  ipcMain.handle('terminal:resize', (event, id: string, cols: number, rows: number) => {
    ownRenderer(event);
    terminals.resize(id, cols, rows);
  });
  ipcMain.handle('terminal:close', (event, id: string) => {
    ownRenderer(event);
    terminals.close(id);
  });
  ipcMain.handle('terminal:closeProfile', (event, profileId: string) => {
    ownRenderer(event);
    terminals.closeProfile(profileId);
    desktops.closeProfile(profileId);
  });
  ipcMain.handle('terminal:closeAll', (event) => {
    ownRenderer(event);
    terminals.closeAll();
    desktops.closeAll();
  });
  ipcMain.handle('desktop:open', (event, request: DesktopViewRequest) => {
    ownRenderer(event);
    desktops.open(request);
  });
  ipcMain.handle('desktop:update', (event, id: string, bounds: DesktopViewBounds) => {
    ownRenderer(event);
    desktops.update(id, bounds);
  });
  ipcMain.handle('desktop:close', (event, id: string) => {
    ownRenderer(event);
    desktops.close(id);
  });
  window.on('closed', () => {
    terminals.closeAll();
    desktops.closeAll();
    for (const channel of ['terminal:open', 'terminal:send', 'terminal:resize', 'terminal:close', 'terminal:closeProfile', 'terminal:closeAll', 'desktop:open', 'desktop:update', 'desktop:close']) {
      ipcMain.removeHandler(channel);
    }
  });

  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== appOrigin) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === 'https://dashboard.instabox.sh') void shell.openExternal(url);
    } catch {
      // 잘못된 외부 URL은 열지 않는다.
    }
    return { action: 'deny' };
  });
  const loading = window.loadURL(`${appOrigin}/index.html`);
  if (!smokeMode) {
    void loading;
    return;
  }
  const watchdog = setTimeout(() => {
    console.error('Desktop smoke timed out');
    app.exit(1);
  }, 20000);
  void loading.then(async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rendered = await window.webContents.executeJavaScript(
        "document.querySelector('#root')?.textContent?.includes('INSTABOX') === true",
      );
      if (rendered) {
        clearTimeout(watchdog);
        console.log('Desktop smoke passed');
        app.exit(0);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    clearTimeout(watchdog);
    console.error('Desktop renderer did not mount');
    app.exit(1);
  }).catch(() => {
    clearTimeout(watchdog);
    console.error('Desktop failed to load');
    app.exit(1);
  });
}

app.whenReady().then(() => {
  if (!ownsInstance) return;
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  protocol.handle('app', async (request) => {
    if (new URL(request.url).pathname.startsWith('/instabox-api/')) return proxyApiRequest(request);
    const asset = resolveAppAsset(request.url, rendererRoot);
    if (!asset || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) {
      return new Response('Not found', { status: 404 });
    }
    const file = await net.fetch(pathToFileURL(asset).toString());
    const headers = new Headers(file.headers);
    if (asset === path.join(rendererRoot, 'index.html')) {
      headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '));
    }
    return new Response(file.body, { status: file.status, headers });
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
