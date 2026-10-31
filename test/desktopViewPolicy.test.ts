import { describe, expect, it } from 'vitest';
import { validateDesktopViewRequest } from '../electron/desktopViewPolicy';

const valid = () => ({
  id: 'desktop-p1-m1', profileId: 'p1',
  url: 'https://dashboard.instabox.sh/desktop/view#signed-token',
  bounds: { x: 400, y: 220, width: 640, height: 400 },
  zoom: 0.5,
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
    expect(() => validateDesktopViewRequest({ ...valid(), zoom: 0 })).toThrow();
  });
});
