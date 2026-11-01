import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const assetDir = path.resolve(process.argv[2] || path.join(root, 'release-assets'));
const expected = [
  `InstaDesk-${version}-linux-arm64.tar.gz`,
  `InstaDesk-${version}-linux-x64.tar.gz`,
  `InstaDesk-${version}-win-x64.zip`,
].sort();
const actual = fs.readdirSync(assetDir).filter((entry) => fs.statSync(path.join(assetDir, entry)).isFile()).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Release asset set mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`);
}
for (const name of actual) {
  const archive = path.join(assetDir, name);
  if (fs.statSync(archive).size < 1_000_000) throw new Error(`Release asset too small: ${name}`);
  const fd = fs.openSync(archive, 'r');
  const magic = Buffer.alloc(4);
  try { fs.readSync(fd, magic, 0, 4, 0); } finally { fs.closeSync(fd); }
  const valid = name.endsWith('.zip')
    ? magic.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    : magic.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]));
  if (!valid) throw new Error(`Release archive signature mismatch: ${name}`);
}
console.log(`Verified ${actual.length} release archives for ${version}`);
