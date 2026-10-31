export interface DesktopViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopViewRequest {
  id: string;
  profileId: string;
  url: string;
  bounds: DesktopViewBounds;
  zoom: number;
}

export function isDashboardUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'dashboard.instabox.sh' &&
      !url.port && !url.username && !url.password && value.length <= 8192;
  } catch { return false; }
}

export function validateDesktopBounds(bounds: DesktopViewBounds, zoom: number): void {
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height, zoom].every(Number.isFinite) ||
      bounds.x < 0 || bounds.y < 0 || bounds.width < 1 || bounds.height < 1 ||
      bounds.x > 10000 || bounds.y > 10000 || bounds.width > 10000 || bounds.height > 10000 ||
      zoom < 0.25 || zoom > 5) throw new Error('Invalid desktop view bounds');
}

export function validateDesktopViewRequest(request: DesktopViewRequest): DesktopViewRequest {
  if (!request || !/^[A-Za-z0-9_-]{1,256}$/.test(request.id) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(request.profileId) ||
      !isDashboardUrl(request.url)) throw new Error('Desktop destination denied');
  validateDesktopBounds(request.bounds, request.zoom);
  return request;
}
