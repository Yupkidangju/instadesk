import path from 'node:path';

export function resolveAppAsset(requestUrl: string, rendererRoot: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'app:' || url.hostname !== 'instadesk') return null;
  if (/%(?:2f|5c|00)/i.test(url.pathname)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null;

  const parts = decoded.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) return null;
  const root = path.resolve(rendererRoot);
  const target = path.resolve(root, ...(parts.length ? parts : ['index.html']));
  return target.startsWith(root + path.sep) ? target : null;
}
