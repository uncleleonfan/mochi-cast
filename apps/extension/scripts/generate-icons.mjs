/**
 * Regenerate PNG manifest icons from public/icon.svg.
 * Requires: npm install @resvg/resvg-js (or run from a temp dir with that package).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const require = createRequire(import.meta.url);

let Resvg;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch {
  console.error(
    'Install @resvg/resvg-js first, e.g.:\n' +
      '  cd apps/extension && npm install -D @resvg/resvg-js\n' +
      '  node scripts/generate-icons.mjs',
  );
  process.exit(1);
}

const svg = readFileSync(join(publicDir, 'icon.svg'));
for (const size of [16, 32, 48, 96, 128]) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const out = join(publicDir, `icon${size}.png`);
  writeFileSync(out, resvg.render().asPng());
  console.log('wrote', out);
}
