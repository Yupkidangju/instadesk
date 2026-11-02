import { describe, expect, it } from 'vitest';
import { validateDesktopViewOptions, validateDesktopViewRequest } from '../electron/desktopViewPolicy';

const valid = () => ({
  id: 'desktop-p1-m1', profileId: 'p1',
  url: 'https://dashboard.instabox.sh/desktop/view#signed-token',
  bounds: { x: 400, y: 220, width: 640, height: 400 },
});

describe('desktop view boundary', () => {
  it('accepts a signed dashboard URL without changing its fragment', () => {
    expect(validateDesktopViewRequest(valid()).url).toBe(valid().url);
  });

  it('rejects non-dashboard URLs and invalid geometry', () => {
    for (const url of [
      'http://dashboard.instabox.sh/desktop/view',
      'https://dashboard.instabox.sh.evil.example/desktop/view',
      'https://user@dashboard.instabox.sh/desktop/view',
      'https://dashboard.instabox.sh:444/desktop/view',
    ]) expect(() => validateDesktopViewRequest({ ...valid(), url })).toThrow();
    expect(() => validateDesktopViewRequest({ ...valid(), bounds: { x: -1, y: 0, width: 640, height: 400 } })).toThrow();
    expect(() => validateDesktopViewRequest({ ...valid(), bounds: { x: 0, y: 0, width: Number.NaN, height: 400 } })).toThrow();
  });

  it('accepts only boolean native visibility and wheel routing flags', () => {
    expect(() => validateDesktopViewOptions({ visible: false, routeWheelToWorkspace: true })).not.toThrow();
    expect(() => validateDesktopViewOptions({ visible: 'false', routeWheelToWorkspace: true } as never)).toThrow();
    expect(() => validateDesktopViewOptions({ visible: true, routeWheelToWorkspace: 'true' } as never)).toThrow();
  });
});
