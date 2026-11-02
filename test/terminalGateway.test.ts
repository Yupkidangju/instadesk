import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { TerminalGateway } from '../electron/terminalGateway';

class FakeSocket extends EventEmitter {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Array<string | Buffer> = [];
  closed = false;
  constructor(public url: string, public protocols: string[]) {
    super();
    FakeSocket.instances.push(this);
  }
  send(value: string | Buffer) { this.sent.push(value); }
  close() { this.closed = true; this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
}

const valid = (id = 'one', profileId = 'p1') => ({
  id, profileId, sessionName: 'main',
  url: 'wss://connect.instabox.sh/v1/machines/m_1/terminal?session=main',
  protocols: ['instabox-terminal.v1', 'instabox-access-token.abc'],
});

function setup() {
  FakeSocket.instances = [];
  const emit = vi.fn();
  const gateway = new TerminalGateway(emit, FakeSocket as unknown as typeof WebSocket);
  return { gateway, emit };
}

describe('Electron terminal gateway', () => {
  afterEach(() => vi.useRealTimers());
  it('restricts ticket destination and protocols before constructing a socket', () => {
    const { gateway } = setup();
    for (const url of [
      'ws://connect.instabox.sh/v1/terminal',
      'wss://evil.example/v1/terminal',
      'wss://connect.instabox.sh.evil.example/v1/terminal',
      'wss://user@connect.instabox.sh/v1/terminal',
      'wss://connect.instabox.sh:444/v1/terminal',
      'wss://connect.instabox.sh/other',
    ]) expect(() => gateway.open({ ...valid(), url })).toThrow();
    expect(() => gateway.open({ ...valid(), protocols: ['instabox-terminal.v1', 'bad'] })).toThrow();
    expect(() => gateway.open({ ...valid(), sessionName: 'unknown' })).toThrow();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('accepts the service-selected protocol and dotted short-lived access token', () => {
    const { gateway } = setup();
    gateway.open({ ...valid(), protocols: ['instabox.terminal.v2', 'instabox-access-token.iba_part.one.two'] });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].protocols[1]).toBe('instabox-access-token.iba_part.one.two');
  });

  it('forwards open, output, input, resize and close for the owning id', () => {
    const { gateway, emit } = setup();
    gateway.open(valid());
    const socket = FakeSocket.instances[0];
    socket.readyState = 1;
    socket.emit('open');
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session', session: 'main', persistent: true })), false);
    socket.emit('message', Buffer.from('hello'), true);
    gateway.send('one', 'ls\r');
    gateway.resize('one', 100, 30);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', type: 'open' }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', type: 'data', data: expect.any(Uint8Array) }));
    expect(socket.sent[0]).toEqual(Buffer.from('ls\r'));
    expect(socket.sent[1]).toBe(JSON.stringify({ type: 'resize', cols: 100, rows: 30 }));
    gateway.close('one');
    expect(socket.closed).toBe(true);
    expect(() => gateway.resize('one', 80, 24)).toThrow();
  });

  it('closes only the removed profile and rejects late events after lock', () => {
    const { gateway, emit } = setup();
    gateway.open(valid('one', 'p1'));
    gateway.open(valid('two', 'p2'));
    const [first, second] = FakeSocket.instances;
    gateway.closeProfile('p1');
    expect(first.closed).toBe(true);
    expect(second.closed).toBe(false);
    emit.mockClear();
    first.emit('open');
    first.emit('message', Buffer.from('late'), true);
    expect(emit).not.toHaveBeenCalled();
    gateway.closeAll();
    expect(second.closed).toBe(true);
  });

  it('waits for a session control before ready and forwards safe refusal details', () => {
    const { gateway, emit } = setup();
    gateway.open(valid());
    const socket = FakeSocket.instances[0];
    socket.readyState = 1;
    socket.emit('open');
    expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }));
    expect(() => gateway.send('one', 'early')).toThrow('not ready');
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'session', session: 'main', persistent: true })), false);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', type: 'ready' }));
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'taken' })), false);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', type: 'error', category: 'taken' }));
    expect(JSON.stringify(emit.mock.calls)).not.toContain('instabox-access-token');
  });

  it('classifies HTTP 429 with Retry-After without exposing response bodies', () => {
    const { gateway, emit } = setup();
    gateway.open(valid());
    const socket = FakeSocket.instances[0];
    socket.emit('unexpected-response', {}, { statusCode: 429, headers: { 'retry-after': '2' } });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category: 'rate_limit', httpStatus: 429, retryAfterMs: 2000 }));
    socket.emit('error', new Error('Unexpected server response: 429'));
    expect(emit.mock.calls.filter((call) => call[0].type === 'error')).toHaveLength(1);
  });

  it.each([[401, 'auth'], [403, 'auth'], [409, 'machine'], [503, 'unavailable']] as const)(
    'classifies HTTP %i as %s', (statusCode, category) => {
      const { gateway, emit } = setup();
      gateway.open(valid());
      FakeSocket.instances[0].emit('unexpected-response', {}, { statusCode, headers: {} });
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category, httpStatus: statusCode }));
    }
  );

  it('forwards server error and exit as safe categories and retains close code', () => {
    const { gateway, emit } = setup();
    gateway.open(valid());
    const socket = FakeSocket.instances[0];
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'error', message: 'secret server body' })), false);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category: 'server' }));
    expect(JSON.stringify(emit.mock.calls)).not.toContain('secret server body');
    socket.emit('close', 1011, Buffer.from('secret close reason'));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'close', closeCode: 1011 }));
    expect(JSON.stringify(emit.mock.calls)).not.toContain('secret close reason');
    gateway.open(valid());
    FakeSocket.instances[1].emit('message', Buffer.from(JSON.stringify({ type: 'exit', code: 0 })), false);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'exit', exitCode: 0 }));
  });

  it('times out a socket that opens but never receives its session signal', () => {
    vi.useFakeTimers();
    const { gateway, emit } = setup();
    gateway.open(valid());
    const socket = FakeSocket.instances[0];
    socket.readyState = 1;
    socket.emit('open');
    vi.advanceTimersByTime(15_000);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category: 'network' }));
    expect(socket.closed).toBe(true);
  });
});
