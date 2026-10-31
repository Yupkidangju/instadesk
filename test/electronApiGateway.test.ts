import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '../electron/apiGateway';
import { getApiBaseUrl } from '../src/services/instaboxClient';

const appUrl = 'app://instadesk/instabox-api/v1/machines';

describe('Electron main API gateway', () => {
  it('selects the local app route in the Electron renderer', () => {
    window.instadeskDesktop = { isDesktop: true };
    expect(getApiBaseUrl()).toBe('/instabox-api');
    delete window.instadeskDesktop;
  });

  it('forwards a fixed-host GET with bearer key and no redirects or cache', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ machines: [] }), { status: 200 }));
    const response = await proxyApiRequest(new Request(`${appUrl}?cursor=next`, {
      headers: { Authorization: 'Bearer ibk_test_only', Accept: 'application/json' },
    }), upstream);
    expect(upstream.mock.calls[0][0]).toBe('https://api.instabox.sh/v1/machines?cursor=next');
    expect(upstream.mock.calls[0][1].redirect).toBe('manual');
    expect((upstream.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer ibk_test_only');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses non-app, non-API and missing-key requests before sending anything', async () => {
    const upstream = vi.fn();
    expect((await proxyApiRequest(new Request('app://other/instabox-api/v1/machines'), upstream)).status).toBe(404);
    expect((await proxyApiRequest(new Request('app://instadesk/other'), upstream)).status).toBe(404);
    expect((await proxyApiRequest(new Request(appUrl), upstream)).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('streams SSE unchanged and rejects upstream redirects', async () => {
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('event: stdout\ndata: ok\n\n')); controller.close(); },
    });
    const upstream = vi.fn().mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }));
    const request = () => new Request('app://instadesk/instabox-api/v1/machines/m_1/exec', {
      method: 'POST', headers: { Authorization: 'Bearer ibk_test_only', 'Content-Type': 'application/json' }, body: '{}',
    });
    const response = await proxyApiRequest(request(), upstream);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(await response.text()).toContain('event: stdout');
    expect((await proxyApiRequest(request(), upstream)).status).toBe(502);
  });
});
