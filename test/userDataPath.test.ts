import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveUserDataPath } from '../electron/userDataPath';

describe('Electron vault userData location', () => {
  it('uses a versionless per-user location independent of a package directory', () => {
    const appData = path.join('home', 'person', 'AppData');
    const expected = path.join(appData, 'InstaDesk');
    expect(resolveUserDataPath(appData)).toBe(expected);
    expect(resolveUserDataPath(appData)).not.toContain('2.1.0');
    expect(resolveUserDataPath(appData)).not.toContain('2.1.1');
  });
});
