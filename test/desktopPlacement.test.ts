import { describe, expect, it } from 'vitest';
import { nativeDesktopPlacement } from '../src/components/desktop/nativeDesktopPlacement';

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, right: left + width, bottom: top + height, width, height,
});

describe('native Desktop placement in a scrolling two-column grid', () => {
  const scrollport = rect(288, 110, 1140, 850);

  it('keeps a fully visible right-column view at its actual coordinates', () => {
    expect(nativeDesktopPlacement(rect(1010, 190, 400, 620), scrollport, true)).toEqual({
      bounds: { x: 1010, y: 190, width: 400, height: 620 },
      visible: true,
      routeWheelToWorkspace: true,
    });
  });

  it('hides the same view instead of pinning it when scrolling moves it above the workspace', () => {
    expect(nativeDesktopPlacement(rect(1010, -120, 400, 620), scrollport, true)).toEqual({
      bounds: { x: 1010, y: 0, width: 400, height: 620 },
      visible: false,
      routeWheelToWorkspace: true,
    });
  });

  it('hides partial views and restores visibility when they return to the scrollport', () => {
    expect(nativeDesktopPlacement(rect(1010, 80, 400, 620), scrollport, true)?.visible).toBe(false);
    expect(nativeDesktopPlacement(rect(1010, 250, 400, 620), scrollport, true)?.visible).toBe(true);
    expect(nativeDesktopPlacement(rect(1010, 1050, 400, 620), scrollport, true)?.visible).toBe(false);
  });

  it('keeps wheel input on the remote desktop when the workspace does not scroll', () => {
    expect(nativeDesktopPlacement(rect(300, 190, 400, 620), scrollport, false)?.routeWheelToWorkspace).toBe(false);
  });
});
