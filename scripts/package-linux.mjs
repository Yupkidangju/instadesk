import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) {
  throw new Error('Linux packaging must run on native x64 or arm64 Linux');
}

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const releaseRoot = path.join(root, 'release');
const name = `InstaDesk-${manifest.version}-linux-${process.arch}`;
const packageDir = path.join(releaseRoot, name);
const archivePath = path.join(releaseRoot, `${name}.tar.gz`);

if (fs.existsSync(releaseRoot) && fs.lstatSync(releaseRoot).isSymbolicLink()) {
  throw new Error('Release directory must not be a symlink');
}
for (const required of [
  path.join(electronDist, 'electron'),
  path.join(electronDist, 'version'),
  path.join(root, 'dist', 'index.html'),
  path.join(root, 'dist-electron', 'main.cjs'),
  path.join(root, 'dist-electron', 'preload.cjs'),
  path.join(root, 'node_modules', 'ws', 'package.json'),
]) if (!fs.existsSync(required)) throw new Error(`Missing build input: ${required}`);

const installedElectron = fs.readFileSync(path.join(electronDist, 'version'), 'utf8').trim().replace(/^v/, '');
const packageElectron = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
if (installedElectron !== packageElectron) throw new Error('Electron binary does not match installed package');
if (fs.existsSync(packageDir) || fs.existsSync(archivePath)) {
  throw new Error(`Release output already exists: ${name}; preserve it and choose a new version`);
}

fs.mkdirSync(releaseRoot, { recursive: true });
fs.cpSync(electronDist, packageDir, { recursive: true, errorOnExist: true });
fs.renameSync(path.join(packageDir, 'electron'), path.join(packageDir, 'InstaDesk'));
fs.chmodSync(path.join(packageDir, 'InstaDesk'), fs.statSync(path.join(packageDir, 'InstaDesk')).mode | 0o111);

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

const packed = spawnSync('tar', ['-czf', archivePath, '-C', releaseRoot, name], { stdio: 'inherit' });
if (packed.status !== 0) throw new Error(`tar packaging failed: ${packed.status}`);

const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
console.log(JSON.stringify({ folder: packageDir, archive: archivePath, bytes: fs.statSync(archivePath).size, sha256 }, null, 2));
