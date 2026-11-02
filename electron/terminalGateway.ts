import WebSocket from 'ws';

export interface TerminalOpenRequest {
  id: string;
  profileId: string;
  sessionName: string;
  url: string;
  protocols: string[];
}

export interface TerminalEvent {
  id: string;
  type: 'open' | 'ready' | 'data' | 'error' | 'close' | 'exit';
  data?: string | Uint8Array;
  category?: 'auth' | 'machine' | 'rate_limit' | 'unavailable' | 'network' | 'taken' | 'server' | 'protocol';
  httpStatus?: number;
  retryAfterMs?: number;
  closeCode?: number;
  exitCode?: number;
  at?: string;
}

const allowedHosts = new Set(['api.instabox.sh', 'connect.instabox.sh']);
const sessions = new Set(['main', 'agent', 'aux']);
const wsProtocolToken = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function httpCategory(status: number): TerminalEvent['category'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 409) return 'machine';
  if (status === 429) return 'rate_limit';
  if (status === 503) return 'unavailable';
  return 'server';
}

function retryAfterMs(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const seconds = Number(raw);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - Date.now();
  return Number.isFinite(delay) && delay >= 0 ? delay : undefined;
}

function validate(request: TerminalOpenRequest): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(request.id) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(request.profileId) ||
      !sessions.has(request.sessionName)) throw new Error('Invalid terminal identity or session');
  let url: URL;
  try { url = new URL(request.url); } catch { throw new Error('Invalid terminal URL'); }
  if (url.protocol !== 'wss:' || !allowedHosts.has(url.hostname) || url.port ||
      url.username || url.password || url.hash || !url.pathname.startsWith('/v1/') ||
      /%(?:2f|5c|00)/i.test(url.pathname)) throw new Error('Terminal destination denied');
  if (!Array.isArray(request.protocols) || request.protocols.length !== 2 ||
      typeof request.protocols[0] !== 'string' || !request.protocols[0] ||
      request.protocols[0].length > 128 || !wsProtocolToken.test(request.protocols[0]) ||
      typeof request.protocols[1] !== 'string' || request.protocols[1].length > 2048 ||
      !request.protocols[1].startsWith('instabox-access-token.') ||
      !wsProtocolToken.test(request.protocols[1])) {
    throw new Error('Invalid terminal ticket protocols');
  }
}

export class TerminalGateway {
  private sockets = new Map<string, { profileId: string; socket: WebSocket; ready: boolean }>();

  constructor(
    private emit: (event: TerminalEvent) => void,
    private Socket: typeof WebSocket = WebSocket,
  ) {}

  open(request: TerminalOpenRequest): void {
    validate(request);
    this.close(request.id);
    const socket = new this.Socket(request.url, request.protocols, {
      followRedirects: false,
      handshakeTimeout: 15000,
      perMessageDeflate: false,
    });
    this.sockets.set(request.id, { profileId: request.profileId, socket, ready: false });
    const current = () => this.sockets.get(request.id)?.socket === socket;
    const report = (event: Omit<TerminalEvent, 'id' | 'at'>) => this.emit({ id: request.id, at: new Date().toISOString(), ...event });
    let refused = false;
    let ready = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    const clearReadyTimer = () => { if (readyTimer) clearTimeout(readyTimer); readyTimer = null; };
    const revokeReady = () => {
      ready = false;
      const entry = this.sockets.get(request.id);
      if (entry?.socket === socket) entry.ready = false;
      clearReadyTimer();
    };
    socket.on('open', () => {
      if (!current()) { socket.terminate(); return; }
      report({ type: 'open' });
      readyTimer = setTimeout(() => {
        if (!current() || ready || refused) return;
        refused = true;
        report({ type: 'error', category: 'network' });
        socket.terminate();
      }, 15_000);
    });
    socket.on('message', (data, isBinary) => {
      if (!current()) return;
      if (isBinary) {
        if (ready) report({ type: 'data', data: new Uint8Array(data as Buffer) });
        return;
      }
      let control: { type?: unknown; session?: unknown; code?: unknown };
      try { control = JSON.parse(data.toString()); } catch { return; }
      if (control.type === 'session' && control.session === request.sessionName && !refused) {
        ready = true;
        clearReadyTimer();
        const entry = this.sockets.get(request.id);
        if (entry?.socket === socket) entry.ready = true;
        report({ type: 'ready' });
      } else if (control.type === 'taken') {
        refused = true;
        revokeReady();
        report({ type: 'error', category: 'taken' });
      } else if (control.type === 'error') {
        refused = true;
        revokeReady();
        report({ type: 'error', category: 'server' });
      } else if (control.type === 'exit') {
        refused = true;
        revokeReady();
        report({ type: 'exit', exitCode: Number.isInteger(control.code) ? control.code as number : undefined });
      } else if (control.type === 'session') {
        refused = true;
        revokeReady();
        report({ type: 'error', category: 'protocol' });
      }
    });
    socket.on('unexpected-response', (_request, response) => {
      if (!current() || refused) return;
      refused = true;
      revokeReady();
      const status = response.statusCode ?? 0;
      report({ type: 'error', category: httpCategory(status), httpStatus: status || undefined,
        retryAfterMs: status === 429 ? retryAfterMs(response.headers['retry-after']) : undefined });
      socket.terminate();
    });
    socket.on('error', (error: Error) => {
      if (!current() || refused) return;
      refused = true;
      revokeReady();
      const match = /^Unexpected server response: (\d{3})$/.exec(error.message);
      const status = match ? Number(match[1]) : undefined;
      report({ type: 'error', category: status ? httpCategory(status) : 'network', httpStatus: status });
    });
    socket.on('close', (code: number) => {
      revokeReady();
      if (!current()) return;
      this.sockets.delete(request.id);
      report({ type: 'close', closeCode: Number.isInteger(code) ? code : undefined });
    });
  }

  send(id: string, data: string): void {
    if (typeof data !== 'string' || data.length > 65536) throw new Error('Invalid terminal input');
    const entry = this.sockets.get(id);
    if (!entry?.ready || entry.socket.readyState !== WebSocket.OPEN) throw new Error('Terminal session is not ready');
    entry.socket.send(Buffer.from(data));
  }

  resize(id: string, cols: number, rows: number): void {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 500 || rows > 300) {
      throw new Error('Invalid terminal size');
    }
    const entry = this.sockets.get(id);
    if (!entry?.ready || entry.socket.readyState !== WebSocket.OPEN) throw new Error('Terminal session is not ready');
    entry.socket.send(JSON.stringify({ type: 'resize', cols, rows }));
  }

  close(id: string): void {
    const entry = this.sockets.get(id);
    if (!entry) return;
    this.sockets.delete(id);
    entry.socket.close();
  }

  closeProfile(profileId: string): void {
    for (const [id, entry] of this.sockets) if (entry.profileId === profileId) this.close(id);
  }

  closeAll(): void {
    for (const id of this.sockets.keys()) this.close(id);
  }
}
