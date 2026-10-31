// src/services/instaboxClient.ts
import { cryptoVault } from './cryptoVault';
import {
  InstaboxMachine,
  DesktopStatus,
  DesktopStreamLink,
  AccessTicket,
  ExecRequest,
  ExecResult,
  MachineMetricsResponse,
  MachineLogsResponse,
  ProcessListResponse,
} from '../types/instabox';

let trustedProxyOrigin: string | null = null;

export function getTrustedProxyOrigin(): string | null {
  return trustedProxyOrigin;
}

export function setTrustedProxyOrigin(value: string): string | null {
  if (!value.trim()) {
    trustedProxyOrigin = null;
    return null;
  }
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Proxy must be an HTTPS origin without a path, credentials, query or fragment.');
  }
  trustedProxyOrigin = url.origin;
  return trustedProxyOrigin;
}

export function isLocalDevOrigin(hostname: string, port: string): boolean {
  return ['localhost', '127.0.0.1'].includes(hostname) && port === '5173';
}

export function getApiBaseUrl(): string {
  if (trustedProxyOrigin) return `${trustedProxyOrigin}/instabox-api`;
  if (typeof window !== 'undefined' && isLocalDevOrigin(window.location.hostname, window.location.port)) {
    return '/instabox-api';
  }
  return 'https://api.instabox.sh';
}

export function getWsBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith('http://')) {
    return base.replace('http://', 'ws://');
  }
  if (base.startsWith('https://')) {
    return base.replace('https://', 'wss://');
  }
  if (base.startsWith('/')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${base}`;
  }
  return 'wss://api.instabox.sh';
}

// --- 데모 시뮬레이션 인메모리 상태 ---
const demoMachines: InstaboxMachine[] = [
  {
    id: 'm_demo_swiss_web_01',
    name: 'box-swiss-web-01',
    state: 'running',
    operationId: null,
    guestUser: 'user',
    template: { id: 'agent-browser', version: 'latest' },
    spec: { vcpus: 4, memMiB: 8192, persistentDiskGiB: 20 },
    runtime: { ready: true },
    autoSuspendAfterSeconds: 1800,
    metadata: { env: 'production', cluster: 'zurich-01', purpose: 'web-frontend' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    profileId: 'demo-default',
    profileLabel: '00 // DEMO_SWISS_CLUSTER',
  },
  {
    id: 'm_demo_swiss_agent_gpu',
    name: 'box-agent-computer-use',
    state: 'running',
    operationId: null,
    guestUser: 'user',
    template: { id: 'agent-browser', version: 'latest' },
    spec: { vcpus: 8, memMiB: 16384, persistentDiskGiB: 40 },
    runtime: { ready: true },
    autoSuspendAfterSeconds: 1800,
    metadata: { env: 'staging', role: 'gui-browser-agent' },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    profileId: 'demo-default',
    profileLabel: '00 // DEMO_SWISS_CLUSTER',
  },
  {
    id: 'm_demo_swiss_db_backup',
    name: 'box-db-pg-replica',
    state: 'suspended',
    operationId: null,
    guestUser: 'user',
    template: { id: 'ci', version: 'latest' },
    spec: { vcpus: 2, memMiB: 4096, persistentDiskGiB: 50 },
    runtime: { ready: false },
    autoSuspendAfterSeconds: 1800,
    metadata: { env: 'backup', schedule: 'daily-utc-02' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    profileId: 'demo-default',
    profileLabel: '00 // DEMO_SWISS_CLUSTER',
  },
  {
    id: 'm_demo_swiss_builder',
    name: 'box-ci-kernel-builder',
    state: 'stopped',
    operationId: null,
    guestUser: 'dev',
    template: { id: 'ci', version: 'latest' },
    spec: { vcpus: 4, memMiB: 8192, persistentDiskGiB: 20 },
    runtime: { ready: false },
    autoSuspendAfterSeconds: null,
    metadata: { pipeline: 'rust-x86-cross' },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    profileId: 'demo-default',
    profileLabel: '00 // DEMO_SWISS_CLUSTER',
  },
];

class InstaboxClientService {
  private activeRequests = new AbortController();
  private requestEpoch = 0;
  private profileRequests = new Map<string, AbortController>();
  private controlSockets = new Map<WebSocket, string>();

  private profileSignal(profileId: string): AbortSignal {
    let controller = this.profileRequests.get(profileId);
    if (!controller) {
      controller = new AbortController();
      this.profileRequests.set(profileId, controller);
    }
    return controller.signal;
  }

  public registerControlSocket(socket: WebSocket, profileId: string): () => void {
    this.controlSockets.set(socket, profileId);
    return () => this.controlSockets.delete(socket);
  }

  public cancelProfile(profileId: string): void {
    this.profileRequests.get(profileId)?.abort();
    this.profileRequests.delete(profileId);
    for (const [socket, owner] of this.controlSockets) {
      if (owner === profileId) {
        socket.close();
        this.controlSockets.delete(socket);
      }
    }
  }

  public cancelActiveRequests(): void {
    this.requestEpoch += 1;
    this.activeRequests.abort();
    this.activeRequests = new AbortController();
    for (const controller of this.profileRequests.values()) controller.abort();
    this.profileRequests.clear();
    for (const socket of this.controlSockets.keys()) socket.close();
    this.controlSockets.clear();
  }

  /**
   * 온디맨드 복호화로 API 요청을 감싸는 내부 공통 호출기
   */
  private async request<T>(
    profileId: string,
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const epoch = this.requestEpoch;
    const ownerSignal = this.profileSignal(profileId);
    return await cryptoVault.withDecryptedKey(profileId, async (apiKey) => {
      if (epoch !== this.requestEpoch) throw new DOMException('Vault locked', 'AbortError');
      ownerSignal.throwIfAborted();
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${apiKey}`);
      if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const signal = AbortSignal.any([
        this.activeRequests.signal,
        ownerSignal,
        ...(init.signal ? [init.signal] : []),
      ]);
      signal.throwIfAborted();
      const res = await fetch(url, { ...init, headers, signal });

      if (!res.ok) {
        let errBody: { error?: { message?: string; code?: string } } = {};
        try {
          errBody = await res.json();
        } catch {
          // non-json body
        }
        const errorMsg = errBody.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err = new Error(errorMsg);
        (err as unknown as { status: number; code?: string }).status = res.status;
        (err as unknown as { status: number; code?: string }).code = errBody.error?.code;
        throw err;
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    });
  }

  /**
   * VM 목록 조회
   */
  public async listMachines(profileId: string, profileLabel = 'Workspace'): Promise<InstaboxMachine[]> {
    if (profileId.startsWith('demo-')) {
      return [...demoMachines];
    }

    interface ListRes {
      machines: Array<Omit<InstaboxMachine, 'profileId' | 'profileLabel'>>;
      nextCursor: string | null;
    }
    const machines: ListRes['machines'] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
      const endpoint: string = cursor ? `/v1/machines?cursor=${encodeURIComponent(cursor)}` : '/v1/machines';
      const data: ListRes = await this.request<ListRes>(profileId, endpoint);
      if (!Array.isArray(data.machines)) throw new Error('Invalid machine list response');
      machines.push(...data.machines);
      if (data.nextCursor == null) break;
      if (typeof data.nextCursor !== 'string' || !data.nextCursor || seen.has(data.nextCursor)) {
        throw new Error('Invalid or repeated machine cursor');
      }
      seen.add(data.nextCursor);
      cursor = data.nextCursor;
      if (page === 99) throw new Error('Machine list exceeded 100 pages');
    }
    return machines.map((m) => ({
      ...m,
      profileId,
      profileLabel,
    }));
  }

  /**
   * 특정 VM 상세 조회
   */
  public async getMachine(profileId: string, machineId: string): Promise<InstaboxMachine> {
    if (profileId.startsWith('demo-')) {
      const found = demoMachines.find((m) => m.id === machineId);
      if (!found) throw new Error('Machine not found');
      return { ...found };
    }

    return await this.request<InstaboxMachine>(profileId, `/v1/machines/${machineId}`);
  }

  /**
   * 신규 VM 생성 (POST /v1/machines)
   */
  public async createMachine(
    profileId: string,
    req: { name?: string; templateId?: string; vcpus?: number; memMiB?: number }
  ): Promise<{ machineId: string; operationId: string }> {
    if (profileId.startsWith('demo-')) {
      const id = `m_demo_${Math.random().toString(36).substring(2, 9)}`;
      const newM: InstaboxMachine = {
        id,
        name: req.name || `box-demo-${Math.floor(Math.random() * 900 + 100)}`,
        state: 'running',
        operationId: null,
        guestUser: 'user',
        template: { id: req.templateId || 'agent-browser', version: 'latest' },
        spec: { vcpus: req.vcpus || 4, memMiB: req.memMiB || 8192, persistentDiskGiB: 20 },
        runtime: { ready: true },
        autoSuspendAfterSeconds: 1800,
        metadata: {},
        createdAt: new Date().toISOString(),
        profileId,
        profileLabel: '00 // DEMO_SWISS_CLUSTER',
      };
      demoMachines.unshift(newM);
      return { machineId: id, operationId: `op_demo_${id}` };
    }

    return await this.request<{ machineId: string; operationId: string }>(profileId, '/v1/machines', {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(req),
    });
  }

  /**
   * VM 생명주기 제어 (start, stop, suspend, resume)
   */
  public async controlMachine(
    profileId: string,
    machineId: string,
    action: 'start' | 'stop' | 'suspend' | 'resume'
  ): Promise<{ operationId?: string }> {
    if (profileId.startsWith('demo-')) {
      const found = demoMachines.find((m) => m.id === machineId);
      if (found) {
        if (action === 'start' || action === 'resume') found.state = 'running';
        if (action === 'stop') found.state = 'stopped';
        if (action === 'suspend') found.state = 'suspended';
      }
      return { operationId: `op_${action}_${machineId}` };
    }

    return await this.request<{ operationId?: string }>(profileId, `/v1/machines/${machineId}/${action}`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    });
  }

  /**
   * VM 삭제 (DELETE /v1/machines/{id})
   */
  public async deleteMachine(profileId: string, machineId: string, machineName: string): Promise<void> {
    if (profileId.startsWith('demo-')) {
      const idx = demoMachines.findIndex((m) => m.id === machineId);
      if (idx !== -1) demoMachines.splice(idx, 1);
      return;
    }

    await this.request(profileId, `/v1/machines/${machineId}`, {
      method: 'DELETE',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'X-Confirm-Delete': machineName || machineId,
      },
    });
  }

  /**
   * 데스크톱 상태 제어 및 조회 (POST /v1/machines/{id}/desktop)
   */
  public async desktopAction(
    profileId: string,
    machineId: string,
    action: 'status' | 'start' | 'install' | 'takeover' | 'handback' = 'status',
    width = 1280,
    height = 800
  ): Promise<DesktopStatus> {
    if (profileId.startsWith('demo-')) {
      return {
        installed: true,
        running: true,
        width,
        height,
        controller: action === 'takeover' ? 'human' : 'agent',
        yours: true,
      };
    }

    return await this.request<DesktopStatus>(profileId, `/v1/machines/${machineId}/desktop`, {
      method: 'POST',
      body: JSON.stringify({ action, width, height }),
    });
  }

  /**
   * 데스크톱 스트림 링크 발급 (POST /v1/machines/{id}/desktop/stream)
   */
  public async createDesktopStreamLink(
    profileId: string,
    machineId: string,
    viewOnly = false,
    ttlSeconds = 3600
  ): Promise<DesktopStreamLink> {
    if (profileId.startsWith('demo-')) {
      return {
        url: 'https://instabox.sh',
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
    }

    return await this.request<DesktopStreamLink>(profileId, `/v1/machines/${machineId}/desktop/stream`, {
      method: 'POST',
      body: JSON.stringify({ viewOnly, ttlSeconds }),
    });
  }

  /**
   * 터미널 / VNC 접속 티켓 발급 (POST /v1/machines/{id}/access)
   */
  public async createAccessTicket(
    profileId: string,
    machineId: string,
    kind: 'terminal' | 'vnc'
  ): Promise<AccessTicket> {
    if (profileId.startsWith('demo-')) {
      return {
        url: `${getWsBaseUrl()}/v1/machines/${machineId}/${kind}`,
        token: 'demo-ticket-token-ok',
        protocol: `instabox-${kind}.v1`,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
    }

    return await this.request<AccessTicket>(profileId, `/v1/machines/${machineId}/access`, {
      method: 'POST',
      body: JSON.stringify({ kind, requireTicket: true }),
    });
  }

  /**
   * 터미널 WebSocket URL 생성
   */
  public async getTerminalWebSocketUrl(
    profileId: string,
    machineId: string
  ): Promise<{ url: string; protocols?: string[] }> {
    try {
      const ticket = await this.createAccessTicket(profileId, machineId, 'terminal');
      if (ticket.token && ticket.url) {
        let wsUrl = ticket.url;
        const parsed = new URL(wsUrl);
        const allowedHosts = ['api.instabox.sh', 'connect.instabox.sh'];
        if (parsed.protocol !== 'wss:' || !allowedHosts.includes(parsed.hostname)) {
          throw new Error('Access ticket returned an unexpected WebSocket destination');
        }
        const route = parsed.hostname === 'connect.instabox.sh' ? '/instabox-connect' : '/instabox-api';
        if (trustedProxyOrigin) {
          wsUrl = `${trustedProxyOrigin.replace(/^https:/, 'wss:')}${route}${parsed.pathname}${parsed.search}`;
        }
        // 로컬 개발에서는 업스트림 호스트별 Vite WebSocket 프록시를 사용한다.
        if (!trustedProxyOrigin && typeof window !== 'undefined' && isLocalDevOrigin(window.location.hostname, window.location.port)) {
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${window.location.host}${route}${parsed.pathname}${parsed.search}`;
        }
        return {
          url: wsUrl,
          protocols: [ticket.protocol || 'instabox-terminal.v1', `instabox-access-token.${ticket.token}`],
        };
      }
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('Unable to create terminal access ticket');
    }
    throw new Error('Access ticket has no WebSocket URL or token');
  }

  /**
   * SSE 스트리밍 명령 실행 (POST /v1/machines/{id}/exec)
   */
  public async streamExec(
    profileId: string,
    machineId: string,
    execReq: ExecRequest,
    onStdout: (text: string) => void,
    onStderr: (text: string) => void,
    onExit: (result: ExecResult) => void,
    onError: (err: Error) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (profileId.startsWith('demo-')) {
      // 데모 모드 가상 명령 실행기
      const cmd = execReq.cmd || (execReq.argv ? execReq.argv.join(' ') : 'echo');
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return false;
          settled = true;
          signal?.removeEventListener('abort', abort);
          resolve();
          return true;
        };
        const first = setTimeout(() => {
          if (!settled) onStdout(`[demo@${machineId} ~]$ ${cmd}\n`);
        }, 50);
        const second = setTimeout(() => {
          if (!finish()) return;
        if (cmd.includes('uname')) {
          onStdout('Linux instabox-demo 6.6.0-x86_64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n');
        } else if (cmd.includes('htop') || cmd.includes('top')) {
          onStdout('Tasks: 24 total, 1 running, 23 sleeping\n%Cpu(s):  3.2 us,  1.1 sy,  0.0 ni, 95.7 id\nMiB Mem :   8192.0 total,   4210.5 free,   1820.2 used\n');
        } else if (cmd.includes('docker') || cmd.includes('ps')) {
          onStdout('CONTAINER ID   IMAGE          COMMAND       STATUS         PORTS\n9f8a12e4b10c   agent-worker   "/entry.sh"   Up 2 hours     0.0.0.0:8080->80/tcp\n');
        } else {
          onStdout(`Command completed successfully. (${cmd})\n`);
        }
        onExit({
          stdout: '',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          truncated: false,
        });
        }, 400);
        const abort = () => {
          clearTimeout(first);
          clearTimeout(second);
          if (finish()) onError(new DOMException('Execution aborted', 'AbortError'));
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      });
      return;
    }

    try {
      const epoch = this.requestEpoch;
      const ownerSignal = this.profileSignal(profileId);
      await cryptoVault.withDecryptedKey(profileId, async (apiKey) => {
        if (epoch !== this.requestEpoch) throw new DOMException('Vault locked', 'AbortError');
        ownerSignal.throwIfAborted();
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}/v1/machines/${machineId}/exec`;

        const combinedSignal = AbortSignal.any([
          this.activeRequests.signal,
          ownerSignal,
          ...(signal ? [signal] : []),
        ]);
        combinedSignal.throwIfAborted();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(execReq),
          signal: combinedSignal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Exec failed (${res.status}): ${body}`);
        }

        if (!res.body) {
          throw new Error('Response body is null');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let line = '';
        let skipLf = false;
        let event = 'message';
        let dataLines: string[] = [];
        let settled = false;
        const dispatch = () => {
          if (!dataLines.length || settled) {
            event = 'message';
            dataLines = [];
            return;
          }
          const data = dataLines.join('\n');
          const type = event;
          event = 'message';
          dataLines = [];
          let parsed: unknown;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          const payload = parsed as { data?: string; message?: string };
          if (type === 'stdout') onStdout(typeof parsed === 'string' ? parsed : payload.data ?? '');
          if (type === 'stderr') onStderr(typeof parsed === 'string' ? parsed : payload.data ?? '');
          if (type === 'exit') {
            if (typeof parsed !== 'object' || parsed === null || typeof (parsed as ExecResult).exitCode !== 'number') {
              throw new Error('Malformed exec exit event');
            }
            settled = true;
            onExit(parsed as ExecResult);
          }
          if (type === 'error') {
            settled = true;
            onError(new Error(payload.message || 'Exec execution error'));
          }
        };
        const consumeLine = () => {
          if (!line) dispatch();
          else if (!line.startsWith(':')) {
            const colon = line.indexOf(':');
            const field = colon < 0 ? line : line.slice(0, colon);
            let value = colon < 0 ? '' : line.slice(colon + 1);
            if (value.startsWith(' ')) value = value.slice(1);
            if (field === 'event') event = value;
            if (field === 'data') dataLines.push(value);
          }
          line = '';
        };
        const consume = (chunk: string) => {
          for (const char of chunk) {
            if (skipLf) {
              skipLf = false;
              if (char === '\n') continue;
            }
            if (char === '\r') {
              consumeLine();
              skipLf = true;
            } else if (char === '\n') consumeLine();
            else line += char;
          }
        };
        try {
          while (!settled) {
            const { done, value } = await reader.read();
            if (done) break;
            consume(decoder.decode(value, { stream: true }));
          }
          consume(decoder.decode());
          if (line) consumeLine();
          dispatch();
          if (!settled) throw new Error('Exec stream ended without an exit event');
        } finally {
          await reader.cancel().catch(() => {});
        }
      });
    } catch (err: unknown) {
      onError(err as Error);
    }
  }

  /**
   * 텔레메트리 메트릭 샘플 조회 (GET /v1/machines/{id}/metrics)
   */
  public async getMetrics(profileId: string, machineId: string): Promise<MachineMetricsResponse> {
    if (profileId.startsWith('demo-')) {
      const now = Date.now();
      const samples = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(now - (9 - i) * 30000).toISOString(),
        cpuUsedPct: Math.floor(10 + Math.sin(i) * 8 + Math.random() * 5),
        memUsedBytes: (3.2 + Math.random() * 0.4) * 1024 * 1024 * 1024,
        memTotalBytes: 8 * 1024 * 1024 * 1024,
        netRxBytesSec: 12000 + Math.random() * 5000,
        netTxBytesSec: 8000 + Math.random() * 4000,
      }));
      return { metrics: samples };
    }

    return await this.request<MachineMetricsResponse>(profileId, `/v1/machines/${machineId}/metrics`);
  }

  /**
   * 시리얼 콘솔 로그 및 작업 이력 조회 (GET /v1/machines/{id}/logs)
   */
  public async getLogs(profileId: string, machineId: string, tail = 100): Promise<MachineLogsResponse> {
    if (profileId.startsWith('demo-')) {
      return {
        machineId,
        state: 'running',
        console: `[    0.000000] Linux version 6.6.0-instabox-microvm (build@instabox) #1 SMP PREEMPT\n[    0.012450] Firecracker microVM initializing memory: 8192 MB\n[    0.145890] systemd[1]: Reached target System Initialization.\n[    0.450120] systemd[1]: Started InstaBox Agent Daemon (v2.4.1).\n[    0.512000] cloud-init[412]: MicroVM guest initialized successfully as 'user'.\n`,
        cursor: 1204,
        operations: [
          { id: 'op_01', type: 'create', state: 'succeeded', createdAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 'op_02', type: 'start', state: 'succeeded', createdAt: new Date(Date.now() - 3590000).toISOString() },
        ],
      };
    }

    return await this.request<MachineLogsResponse>(profileId, `/v1/machines/${machineId}/logs?tail=${tail}`);
  }

  /**
   * 프로세스 목록 조회 (GET /v1/machines/{id}/processes)
   */
  public async getProcesses(profileId: string, machineId: string): Promise<ProcessListResponse> {
    if (profileId.startsWith('demo-')) {
      return {
        machineId,
        state: 'running',
        live: true,
        capturedAt: new Date().toISOString(),
        processes: [
          { pid: 1, ppid: 0, user: 'root', cpuPct: 0.0, memPct: 0.1, elapsedSec: 3600, args: '/sbin/init' },
          { pid: 240, ppid: 1, user: 'root', cpuPct: 0.1, memPct: 0.3, elapsedSec: 3590, args: '/usr/lib/systemd/systemd-journald' },
          { pid: 812, ppid: 1, user: 'user', cpuPct: 1.2, memPct: 4.8, elapsedSec: 3550, args: '/usr/bin/Xvfb :0 -screen 0 1280x800x24' },
          { pid: 815, ppid: 812, user: 'user', cpuPct: 0.4, memPct: 2.1, elapsedSec: 3549, args: 'xfce4-session' },
          { pid: 920, ppid: 815, user: 'user', cpuPct: 3.5, memPct: 8.4, elapsedSec: 3500, args: '/usr/lib/chromium/chromium --no-sandbox' },
        ],
      };
    }

    return await this.request<ProcessListResponse>(profileId, `/v1/machines/${machineId}/processes`);
  }
}

export const instaboxClient = new InstaboxClientService();
