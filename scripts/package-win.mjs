import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 packaging must run on Windows x64');
}

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const releaseRoot = path.join(root, 'release');
const name = `InstaDesk-${manifest.version}-win-x64`;
const packageDir = path.join(releaseRoot, name);
const zipPath = path.join(releaseRoot, `${name}.zip`);

if (fs.existsSync(releaseRoot) && fs.lstatSync(releaseRoot).isSymbolicLink()) {
  throw new Error('Release directory must not be a symlink');
}

for (const required of [
  path.join(electronDist, 'electron.exe'),
  path.join(electronDist, 'electron_wer.dll'),
  path.join(root, 'dist', 'index.html'),
  path.join(root, 'dist-electron', 'main.cjs'),
  path.join(root, 'dist-electron', 'preload.cjs'),
  path.join(root, 'node_modules', 'ws', 'package.json'),
]) if (!fs.existsSync(required)) throw new Error(`Missing build input: ${required}`);

if (fs.existsSync(packageDir) || fs.existsSync(zipPath)) {
  throw new Error(`Release output already exists: ${name}; preserve it and choose a new version`);
}
fs.mkdirSync(releaseRoot, { recursive: true });
fs.cpSync(electronDist, packageDir, { recursive: true, errorOnExist: true });
fs.renameSync(path.join(packageDir, 'electron.exe'), path.join(packageDir, 'InstaDesk.exe'));
fs.renameSync(path.join(packageDir, 'electron_wer.dll'), path.join(packageDir, 'InstaDesk_wer.dll'));

const appDir = path.join(packageDir, 'resources', 'app');
fs.mkdirSync(path.join(appDir, 'node_modules'), { recursive: true });
for (const directory of ['dist', 'dist-electron']) {
  fs.cpSync(path.join(root, directory), path.join(appDir, directory), { recursive: true, errorOnExist: true });
}
fs.cpSync(path.join(root, 'node_modules', 'ws'), path.join(appDir, 'node_modules', 'ws'), {
  recursive: true, errorOnExist: true,
});
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(appDir, 'LICENSE'));
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
  name: manifest.name,
  productName: manifest.productName,
  version: manifest.version,
  author: manifest.author,
  license: manifest.license,
  main: manifest.main,
}, null, 2));

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const command = `Compress-Archive -LiteralPath ${quote(packageDir)} -DestinationPath ${quote(zipPath)} -CompressionLevel Optimal`;
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
if (result.status !== 0) throw new Error(`Compress-Archive failed: ${result.status}`);

const zipBytes = fs.readFileSync(zipPath);
const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
console.log(JSON.stringify({ folder: packageDir, zip: zipPath, bytes: zipBytes.length, sha256 }, null, 2));
