import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function renderLinuxSetup(template, packageName) {
  if (!/^InstaDesk-\d+\.\d+\.\d+-linux-(?:x64|arm64)$/.test(packageName)) {
    throw new Error('Invalid Linux package name');
  }
  const marker = '{{PACKAGE_NAME}}';
  if (!template.includes(`name="${marker}"`)) throw new Error('Linux setup name marker missing');
  return template.replaceAll(marker, packageName);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const template = fs.readFileSync(path.resolve('LINUX_SETUP.md'), 'utf8');
  process.stdout.write(renderLinuxSetup(template, process.argv[2] || ''));
}
