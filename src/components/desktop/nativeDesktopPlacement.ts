type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export interface NativeDesktopPlacement {
  bounds: { x: number; y: number; width: number; height: number };
  visible: boolean;
  routeWheelToWorkspace: boolean;
}

export function nativeDesktopPlacement(
  view: Rect | null,
  scrollport: Rect | null,
  scrollable: boolean,
): NativeDesktopPlacement | null {
  if (!view || ![view.left, view.top, view.right, view.bottom, view.width, view.height].every(Number.isFinite) ||
      view.width < 1 || view.height < 1) return null;

  // WebContentsView는 DOM 스크롤에 의해 잘리지 않으므로 부분 가시 구간에서는 숨긴다.
  const visible = !scrollport || (
    view.left >= scrollport.left - 1 && view.top >= scrollport.top - 1 &&
    view.right <= scrollport.right + 1 && view.bottom <= scrollport.bottom + 1
  );
  return {
    bounds: {
      x: Math.max(0, Math.min(10_000, Math.round(view.left))),
      y: Math.max(0, Math.min(10_000, Math.round(view.top))),
      width: Math.max(1, Math.round(view.width)),
      height: Math.max(1, Math.round(view.height)),
    },
    visible,
    routeWheelToWorkspace: Boolean(scrollport && scrollable),
  };
}
