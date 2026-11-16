import { describe, expect, it } from 'vitest';
import { workspaceWheelDelta } from '../src/components/terminal/terminalWheelPolicy';

describe('terminal and workspace wheel ownership', () => {
  it('keeps ordinary wheel input in terminal history, including at its boundary', () => {
    expect(workspaceWheelDelta({ shiftKey: false, deltaY: 200, deltaMode: 0 }, 600)).toBeNull();
  });

  it('routes intentional Shift+wheel to the workspace using pixel, line and page units', () => {
    expect(workspaceWheelDelta({ shiftKey: true, deltaY: 200, deltaMode: 0 }, 600)).toBe(200);
    expect(workspaceWheelDelta({ shiftKey: true, deltaY: -3, deltaMode: 1 }, 600)).toBe(-54);
    expect(workspaceWheelDelta({ shiftKey: true, deltaY: 1, deltaMode: 2 }, 600)).toBe(600);
  });
});
