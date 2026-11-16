type WheelInput = Pick<WheelEvent, 'shiftKey' | 'deltaY' | 'deltaMode'>;

export function workspaceWheelDelta(event: WheelInput, workspaceHeight: number): number | null {
  if (!event.shiftKey || !Number.isFinite(event.deltaY)) return null;
  const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? Math.max(1, workspaceHeight) : 1;
  return event.deltaY * unit;
}
