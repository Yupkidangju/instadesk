import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Linux archive installation guide', () => {
  it.each(['x64', 'arm64'])('renders the exact package name for %s', (arch) => {
    const version = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')).version as string;
    const name = `InstaDesk-${version}-linux-${arch}`;
    const result = spawnSync(process.execPath, ['scripts/render-linux-setup.mjs', name], {
      cwd: path.resolve('.'), encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`name="${name}"`);
    expect(result.stdout).toContain('sha256sum -c -');
    expect(result.stdout).not.toContain('2.1.0');
    expect(result.stdout).not.toContain('{{PACKAGE_NAME}}');
  });
});
