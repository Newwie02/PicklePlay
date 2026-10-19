/**
 * Bakes the SVG logo masters in `assets/logo/` into every PNG the app config
 * expects (see app.json): app icon, Android adaptive icon layers, splash mark
 * and the web favicon.
 *
 *   npm install   (once, to pull in `sharp`)
 *   npm run icons
 *
 * Edit the SVGs, re-run this, and every size stays perfectly in sync.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('✖ `sharp` is not installed yet. Run:  npm install');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fromLogo = (file) => path.join(root, 'assets', 'logo', file);
const toAssets = (file) => path.join(root, 'assets', file);

/** Render an SVG master to a PNG at the requested size. */
async function render(input, output, size, { density = 288 } = {}) {
  await sharp(fromLogo(input), { density })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(toAssets(output));
  console.log(`  ✔ ${output}  ${size}×${size}`);
}

const jobs = [
  // [master SVG, output PNG, size]
  ['icon.svg', 'icon.png', 1024],
  ['foreground.svg', 'android-icon-foreground.png', 1024],
  ['background.svg', 'android-icon-background.png', 1024],
  ['monochrome.svg', 'android-icon-monochrome.png', 1024],
  ['mark.svg', 'splash-icon.png', 1024],
];

console.log('Rendering PicklePlay icon set…');
for (const [input, output, size] of jobs) {
  await render(input, output, size);
}

// Favicon: a downscaled copy of the full icon reads best at small sizes.
await sharp(toAssets('icon.png'))
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(toAssets('favicon.png'));
console.log('  ✔ favicon.png  64×64');

console.log('\nDone. Restart Metro (`npx expo start -c`) — or re-run `npx expo prebuild` — to pick them up.');
