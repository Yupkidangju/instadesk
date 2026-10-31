import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cryptoVault } from '../src/services/cryptoVault';
import { getApiBaseUrl, instaboxClient } from '../src/services/instaboxClient';
import { useAppStore } from '../src/store/useAppStore';

let profileId: string;

beforeEach(async () => {
  cryptoVault.resetVault();
  await cryptoVault.initializeVault('test-password');
  profileId = await cryptoVault.addProfile('Test', 'ibk_test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  cryptoVault.resetVault();
});

describe('Audit 1 network and session regressions', () => {
  it('combines paginated machine inventory and rejects a repeated cursor', async () => {
    const machine = (id: string) => ({ id, name: id });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ machines: [machine('a')], nextCursor: 'page 2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ machines: [machine('b')], nextCursor: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await instaboxClient.listMachines(profileId, 'Test');
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    expect(fetchMock.mock.calls[1][0]).toContain('cursor=page%202');
    fetchMock.mockReset().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ machines: [], nextCursor: 'same' }), { status: 200 })
    ));
    await expect(instaboxClient.listMachines(profileId)).rejects.toThrow('repeated machine cursor');
  });

  it('parses fragmented CRLF and multiline SSE and reports EOF without exit', async () => {
    const encoder = new TextEncoder();
    const response = (chunks: string[]) => new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }), { status: 200 });
    const stdout: string[] = [];
    const errors: string[] = [];
    const exits: number[] = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([
      'event: stdout\r\ndata: {"data":"first"}\r',
      '\n\r\nevent: stdout\r\ndata: second\r\ndata: line\r\n\r\n',
      'event: exit\r\ndata: {"exitCode":0,"stdout":"","stderr":"","timedOut":false,"truncated":false}\r\n',
    ])).mockResolvedValueOnce(response(['event: stdout\ndata: tail'])));
    const run = () => instaboxClient.streamExec(profileId, 'm_1', { cmd: 'echo' },
      (value) => stdout.push(value), () => {}, (value) => exits.push(value.exitCode), (error) => errors.push(error.message));
    await run();
    expect(stdout).toEqual(['first', 'second\nline']);
    expect(exits).toEqual([0]);
    await run();
    expect(stdout.at(-1)).toBe('tail');
    expect(errors).toEqual(['Exec stream ended without an exit event']);
  });

  it('reports a malformed SSE exit event as an error', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: exit\ndata: {"exitCode":"bad"}\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const exits: number[] = [];
    const errors: string[] = [];
    await instaboxClient.streamExec(profileId, 'm_1', { cmd: 'echo' }, () => {}, () => {},
      (result) => exits.push(result.exitCode), (error) => errors.push(error.message));
    expect(exits).toEqual([]);
    expect(errors).toEqual(['Malformed exec exit event']);
  });

  it('routes REST through the Electron app origin and retains the fixed PTY ticket host', async () => {
    expect(getApiBaseUrl()).toBe('/instabox-api');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: 'wss://connect.instabox.sh/v1/terminal', token: 'abc', protocol: 'instabox-terminal.v1',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const ticket = await instaboxClient.getTerminalWebSocketUrl(profileId, 'm_1');
    expect(fetchMock.mock.calls[0][0]).toBe('/instabox-api/v1/machines/m_1/access');
    expect(ticket.url).toBe('wss://connect.instabox.sh/v1/terminal?session=main');
  });

  it('accepts an API-host PTY ticket and rejects unknown hosts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: 'wss://api.instabox.sh/v1/terminal', token: 'ok',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: 'wss://unexpected.example/v1/terminal', token: 'bad',
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await instaboxClient.getTerminalWebSocketUrl(profileId, 'm_1')).url)
      .toBe('wss://api.instabox.sh/v1/terminal?session=main');
    await expect(instaboxClient.getTerminalWebSocketUrl(profileId, 'm_1'))
      .rejects.toThrow('unexpected WebSocket destination');
  });

  it('passes the selected PTY session without putting the ticket in the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: 'wss://api.instabox.sh/v1/machines/m_1/terminal',
      token: 'iba_part.one.two', protocol: 'instabox.terminal.v2',
    }), { status: 200 })));
    const ticket = await instaboxClient.getTerminalWebSocketUrl(profileId, 'm_1', 'agent');
    expect(ticket.url).toBe('wss://api.instabox.sh/v1/machines/m_1/terminal?session=agent');
    expect(ticket.protocols).toEqual(['instabox.terminal.v2', 'instabox-access-token.iba_part.one.two']);
  });

  it('counts connection reservations, frees closed sessions, and clears real tiles on lock', () => {
    const store = useAppStore.getState();
    store.clearAllTiles();
    for (let index = 0; index < 8; index++) expect(store.reserveSession(`tile-${index}`, profileId)).toBe(true);
    expect(store.reserveSession('tile-8', profileId)).toBe(false);
    expect(store.reserveSession('other-key', 'another-profile')).toBe(true);
    store.releaseSession('tile-0');
    expect(store.reserveSession('tile-8', profileId)).toBe(true);
    store.addTile('m_1', profileId, 'terminal');
    expect(useAppStore.getState().tiles).toHaveLength(1);
    cryptoVault.lock();
    expect(useAppStore.getState().tiles).toHaveLength(0);
    expect(Object.keys(useAppStore.getState().sessionStates)).toHaveLength(0);
  });

  it('aborts in-flight fetches when locked', async () => {
    const aborted: boolean[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        aborted.push(true);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })));
    const pending = instaboxClient.listMachines(profileId).catch((error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    cryptoVault.lock();
    expect(aborted).toEqual([true]);
    expect((await pending).name).toBe('AbortError');
  });

  it('removes real tiles on automatic vault lock', async () => {
    cryptoVault.resetVault();
    await cryptoVault.initializeVault('test-password', 0.001);
    const id = await cryptoVault.addProfile('Timed', 'ibk_test');
    useAppStore.getState().addTile('m_1', id, 'terminal');
    await vi.waitFor(() => expect(cryptoVault.isUnlocked()).toBe(false));
    expect(useAppStore.getState().tiles).toHaveLength(0);
  });

  it('ends a cancelled demo exec without a late exit event', async () => {
    const controller = new AbortController();
    const exit = vi.fn();
    const error = vi.fn();
    const pending = instaboxClient.streamExec('demo-default', 'm_demo', { cmd: 'sleep' },
      () => {}, () => {}, exit, error, controller.signal);
    controller.abort();
    await pending;
    expect(exit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0].name).toBe('AbortError');
  });
});
