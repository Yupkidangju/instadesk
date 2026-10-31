import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAppAsset } from '../electron/appProtocol';

const root = path.resolve('test-renderer-dist');

describe('app://instadesk asset boundary', () => {
  it('resolves only local app assets under the renderer build directory', () => {
    expect(resolveAppAsset('app://instadesk/', root)).toBe(path.join(root, 'index.html'));
    expect(resolveAppAsset('app://instadesk/assets/app.js?v=1', root)).toBe(path.join(root, 'assets', 'app.js'));
    expect(resolveAppAsset('app://other-host/assets/app.js', root)).toBeNull();
    expect(resolveAppAsset('https://instadesk/assets/app.js', root)).toBeNull();
  });

  it('rejects encoded separators, NUL and malformed paths', () => {
    expect(resolveAppAsset('app://instadesk/%2fsecret', root)).toBeNull();
    expect(resolveAppAsset('app://instadesk/%5csecret', root)).toBeNull();
    expect(resolveAppAsset('app://instadesk/%00secret', root)).toBeNull();
    expect(resolveAppAsset('not a URL', root)).toBeNull();
  });
});
