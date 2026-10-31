import { app, BrowserWindow, net, protocol, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAppAsset } from './appProtocol';

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

const rendererRoot = path.join(app.getAppPath(), 'dist');
const appOrigin = 'app://instadesk';

function createWindow(): void {
  const window = new BrowserWindow({
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
    },
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
  void window.loadURL(`${appOrigin}/index.html`);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  protocol.handle('app', async (request) => {
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
        'frame-src https://dashboard.instabox.sh',
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
