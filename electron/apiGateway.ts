const prefix = '/instabox-api';
const allowedMethods = new Set(['GET', 'POST', 'DELETE']);
const forwardedHeaders = ['Authorization', 'Accept', 'Content-Type', 'Idempotency-Key', 'X-Confirm-Delete'];

export async function proxyApiRequest(
  request: Request,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  let incoming: URL;
  try {
    incoming = new URL(request.url);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (incoming.protocol !== 'app:' || incoming.hostname !== 'instadesk' ||
      !incoming.pathname.startsWith(`${prefix}/v1/`)) {
    return new Response('Not found', { status: 404 });
  }
  if (!allowedMethods.has(request.method)) return new Response('Method not allowed', { status: 405 });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ibk_') || authorization.length > 256) {
    return new Response('API key required', { status: 401 });
  }

  const headers = new Headers();
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const target = `https://api.instabox.sh${incoming.pathname.slice(prefix.length)}${incoming.search}`;
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: request.signal,
  };
  if (request.method !== 'GET' && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const response = await fetchUpstream(target, init);
    if (response.status >= 300 && response.status < 400) {
      return new Response('Upstream redirect refused', { status: 502 });
    }
    const outgoing = new Headers(response.headers);
    outgoing.delete('Set-Cookie');
    outgoing.delete('Access-Control-Allow-Origin');
    outgoing.delete('Access-Control-Allow-Credentials');
    outgoing.set('Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    });
  } catch {
    return new Response('API network unavailable', { status: 502 });
  }
}
