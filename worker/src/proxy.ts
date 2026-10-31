interface WorkerEnv {
  ALLOWED_ORIGIN: string;
}

const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const allowedRequestHeaders = new Set([
  'authorization', 'accept', 'content-type', 'idempotency-key',
  'x-confirm-delete', 'sec-websocket-protocol',
]);

function responseHeaders(origin: string): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type, Idempotency-Key, X-Confirm-Delete',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
}

function targetUrl(incoming: URL): { url: string; route: 'api' | 'connect' } | null {
  if (incoming.pathname.startsWith('/instabox-api/v1/')) {
    return { url: `https://api.instabox.sh${incoming.pathname.slice('/instabox-api'.length)}${incoming.search}`, route: 'api' };
  }
  if (incoming.pathname.startsWith('/instabox-connect/')) {
    return { url: `https://connect.instabox.sh${incoming.pathname.slice('/instabox-connect'.length)}${incoming.search}`, route: 'connect' };
  }
  return null;
}

export async function handleProxyRequest(
  request: Request,
  env: WorkerEnv,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  const incoming = new URL(request.url);
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(env.ALLOWED_ORIGIN).origin;
    if (env.ALLOWED_ORIGIN !== allowedOrigin || !allowedOrigin.startsWith('https://')) throw new Error();
  } catch {
    return new Response('Worker origin is not configured', { status: 503 });
  }

  if (incoming.pathname === '/health' && request.method === 'GET') {
    const requestOrigin = request.headers.get('Origin');
    if (requestOrigin && requestOrigin !== allowedOrigin) return new Response('Origin denied', { status: 403 });
    const headers = requestOrigin ? responseHeaders(allowedOrigin) : new Headers({ 'Cache-Control': 'no-store' });
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({ ok: true, service: 'instadesk-personal-bridge', allowedOrigin }), { headers });
  }

  const target = targetUrl(incoming);
  if (!target) return new Response('Not found', { status: 404 });
  if (request.headers.get('Origin') !== allowedOrigin) return new Response('Origin denied', { status: 403 });

  const cors = responseHeaders(allowedOrigin);
  if (request.method === 'OPTIONS') {
    const requestedMethod = request.headers.get('Access-Control-Request-Method')?.toUpperCase();
    const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
      .split(',').map((header) => header.trim().toLowerCase()).filter(Boolean);
    if (!requestedMethod || !methods.has(requestedMethod) || requestedHeaders.some((header) => !allowedRequestHeaders.has(header))) {
      return new Response('Preflight denied', { status: 403, headers: cors });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  const upgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
  if (!methods.has(request.method) || (upgrade && request.method !== 'GET') || (target.route === 'connect' && !upgrade)) {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }
  if (upgrade && !request.headers.get('Sec-WebSocket-Protocol')) {
    return new Response('WebSocket protocol required', { status: 400, headers: cors });
  }
  if (!upgrade && !request.headers.get('Authorization')?.startsWith('Bearer ')) {
    return new Response('Bearer key required', { status: 401, headers: cors });
  }

  const headers = new Headers();
  for (const name of allowedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (upgrade) headers.set('Upgrade', 'websocket');

  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (!upgrade && !['GET', 'HEAD'].includes(request.method) && request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }
    const upstream = await fetchUpstream(target.url, init);
    if (upgrade) {
      const socketResponse = upstream as Response & { webSocket?: WebSocket };
      if (upstream.status === 101 && socketResponse.webSocket) return upstream;
      return new Response('WebSocket upstream rejected', { status: 502, headers: cors });
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response('Upstream redirect refused', { status: 502, headers: cors });
    }
    const outgoing = new Headers(upstream.headers);
    outgoing.delete('Set-Cookie');
    outgoing.delete('Access-Control-Allow-Origin');
    outgoing.delete('Access-Control-Allow-Credentials');
    for (const [name, value] of cors) outgoing.set(name, value);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoing,
    });
  } catch {
    return new Response('Upstream unavailable', { status: 502, headers: cors });
  }
}
