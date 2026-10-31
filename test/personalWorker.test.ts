import { describe, expect, it, vi } from 'vitest';
import { handleProxyRequest } from '../worker/src/proxy';

const env = { ALLOWED_ORIGIN: 'https://yupkidangju.github.io' };
const worker = 'https://my-bridge.example';
const origin = env.ALLOWED_ORIGIN;

describe('personal Worker proxy boundary', () => {
  it('exposes an unauthenticated health check only to the configured browser origin', async () => {
    const response = await handleProxyRequest(new Request(`${worker}/health`, { headers: { Origin: origin } }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(await response.json()).toEqual({ ok: true, service: 'instadesk-personal-bridge', allowedOrigin: origin });
    const foreign = await handleProxyRequest(new Request(`${worker}/health`, { headers: { Origin: 'https://other.example' } }), env);
    expect(foreign.status).toBe(403);
  });

  it('answers only the allowed browser preflight and never forwards it', async () => {
    const fetchUpstream = vi.fn();
    const allowed = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    }), env, fetchUpstream);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(fetchUpstream).not.toHaveBeenCalled();

    const denied = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://other.example', 'Access-Control-Request-Method': 'GET' },
    }), env, fetchUpstream);
    expect(denied.status).toBe(403);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('forwards bearer REST only to the fixed API host and does not cache or follow redirects', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ machines: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=bad', 'Access-Control-Allow-Origin': 'https://dashboard.instabox.sh' },
    }));
    const response = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines?cursor=next`, {
      headers: { Origin: origin, Authorization: 'Bearer ibk_test' },
    }), env, fetchUpstream);
    expect(fetchUpstream.mock.calls[0][0]).toBe('https://api.instabox.sh/v1/machines?cursor=next');
    expect(fetchUpstream.mock.calls[0][1].redirect).toBe('manual');
    expect((fetchUpstream.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer ibk_test');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    fetchUpstream.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }));
    const redirected = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines`, {
      headers: { Origin: origin, Authorization: 'Bearer ibk_test' },
    }), env, fetchUpstream);
    expect(redirected.status).toBe(502);
  });

  it('rejects open-proxy paths and unauthenticated REST before upstream fetch', async () => {
    const fetchUpstream = vi.fn();
    const wrongPath = await handleProxyRequest(new Request(`${worker}/https://attacker.example/secret`, {
      headers: { Origin: origin, Authorization: 'Bearer ibk_test' },
    }), env, fetchUpstream);
    expect(wrongPath.status).toBe(404);
    const missingKey = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines`, {
      headers: { Origin: origin },
    }), env, fetchUpstream);
    expect(missingKey.status).toBe(401);
    const connectHttp = await handleProxyRequest(new Request(`${worker}/instabox-connect/v1/terminal`, {
      headers: { Origin: origin, Authorization: 'Bearer ibk_test' },
    }), env, fetchUpstream);
    expect(connectHttp.status).toBe(405);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('passes SSE bodies through as a stream and routes WebSocket upgrades by prefix', async () => {
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('event: stdout\ndata: ok\n\n')); controller.close(); },
    });
    const fetchUpstream = vi.fn().mockResolvedValueOnce(new Response(stream, {
      status: 200, headers: { 'Content-Type': 'text/event-stream' },
    }));
    const sse = await handleProxyRequest(new Request(`${worker}/instabox-api/v1/machines/m_1/exec`, {
      method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ibk_test', 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ cmd: 'echo ok' }),
    }), env, fetchUpstream);
    expect(sse.headers.get('Content-Type')).toBe('text/event-stream');
    expect(await sse.text()).toContain('event: stdout');

    const wsResponse = { status: 101, webSocket: {}, headers: new Headers() } as unknown as Response;
    fetchUpstream.mockResolvedValueOnce(wsResponse);
    const ws = await handleProxyRequest(new Request(`${worker}/instabox-connect/v1/terminal?ticket=abc`, {
      headers: { Origin: origin, Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'instabox-terminal.v1, instabox-access-token.abc' },
    }), env, fetchUpstream);
    expect(ws).toBe(wsResponse);
    expect(fetchUpstream.mock.calls[1][0]).toBe('https://connect.instabox.sh/v1/terminal?ticket=abc');
    expect((fetchUpstream.mock.calls[1][1].headers as Headers).get('Upgrade')).toBe('websocket');
  });
});
