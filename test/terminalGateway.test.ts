import { describe, expect, it, vi } from 'vitest';
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
});
