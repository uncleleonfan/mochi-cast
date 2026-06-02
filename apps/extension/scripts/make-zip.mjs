import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sourceDir = join(root, '.output', 'chrome-mv3');
const outDir = join(root, '.output');
const outZip = join(outDir, 'mochi-cast-0.1.0-chrome.zip');

if (!existsSync(sourceDir)) {
  console.error('Build output not found:', sourceDir);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(outZip)) rmSync(outZip);

if (platform() === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${outZip.replace(/'/g, "''")}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd "${sourceDir}" && zip -r "${outZip}" .`, { stdio: 'inherit' });
}

console.log('Created', outZip);
