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
  type: 'open' | 'data' | 'error' | 'close';
  data?: string | Uint8Array;
}

const allowedHosts = new Set(['api.instabox.sh', 'connect.instabox.sh']);
const sessions = new Set(['main', 'agent', 'aux']);
const wsProtocolToken = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

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
  private sockets = new Map<string, { profileId: string; socket: WebSocket }>();

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
    this.sockets.set(request.id, { profileId: request.profileId, socket });
    const current = () => this.sockets.get(request.id)?.socket === socket;
    socket.on('open', () => { if (current()) this.emit({ id: request.id, type: 'open' }); else socket.terminate(); });
    socket.on('message', (data, isBinary) => {
      if (!current()) return;
      this.emit({ id: request.id, type: 'data', data: isBinary ? new Uint8Array(data as Buffer) : data.toString() });
    });
    socket.on('error', () => { if (current()) this.emit({ id: request.id, type: 'error' }); });
    socket.on('close', () => {
      if (!current()) return;
      this.sockets.delete(request.id);
      this.emit({ id: request.id, type: 'close' });
    });
  }

  send(id: string, data: string): void {
    if (typeof data !== 'string' || data.length > 65536) throw new Error('Invalid terminal input');
    const socket = this.sockets.get(id)?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Terminal is not connected');
    socket.send(Buffer.from(data));
  }

  resize(id: string, cols: number, rows: number): void {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 500 || rows > 300) {
      throw new Error('Invalid terminal size');
    }
    const socket = this.sockets.get(id)?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Terminal is not connected');
    socket.send(JSON.stringify({ type: 'resize', cols, rows }));
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
