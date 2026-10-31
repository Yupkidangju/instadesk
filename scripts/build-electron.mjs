import { build } from 'esbuild';

for (const [entryPoint, outfile] of [
  ['electron/main.ts', 'dist-electron/main.cjs'],
  ['electron/preload.ts', 'dist-electron/preload.cjs'],
]) {
  await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron', 'ws'],
    sourcemap: false,
  });
}
