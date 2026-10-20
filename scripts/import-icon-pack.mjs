/**
 * Bakes the ready-made icon pack in `assets/branding/` into every PNG the app
 * config expects (see app.json): the app icon, the Android adaptive-icon
 * layers (foreground / background / monochrome) and the web favicon.
 *
 * Source files (from the easyappicon pack):
 *   assets/branding/icon-source.png        1024×1024 full-colour icon (iOS)
 *   assets/branding/android-foreground.png transparent adaptive-icon layer
 *
 *   npm install   (once, to pull in `sharp`)
 *   npm run icons:pack
 *
 * NOTE: `npm run icons` renders a different, older SVG-based set from
 * `assets/logo/` and would overwrite the files this script produces.
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

const SIZE = 1024;
/** Matches the pack's `ic_launcher_background.xml` (#3EAC7D). */
const BACKGROUND = '#3EAC7D';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fromBrand = (file) => path.join(root, 'assets', 'branding', file);
const toAssets = (file) => path.join(root, 'assets', file);

/** App icon: full-bleed 1024×1024, flattened so no transparency reaches iOS. */
await sharp(fromBrand('icon-source.png'))
  .resize(SIZE, SIZE, { fit: 'fill' })
  .flatten({ background: BACKGROUND })
  .png({ compressionLevel: 9 })
  .toFile(toAssets('icon.png'));
console.log(`  ✔ icon.png  ${SIZE}×${SIZE}`);

/** Android adaptive-icon foreground layer: transparent, padded to a square. */
const foreground = await sharp(fromBrand('android-foreground.png'))
  .resize(SIZE, SIZE, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile(toAssets('android-icon-foreground.png'));
console.log(`  ✔ android-icon-foreground.png  ${foreground.width}×${foreground.height}`);

/** Android adaptive-icon background layer: a flat colour square. */
await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: BACKGROUND },
})
  .png({ compressionLevel: 9 })
  .toFile(toAssets('android-icon-background.png'));
console.log(`  ✔ android-icon-background.png  ${SIZE}×${SIZE}  ${BACKGROUND}`);

/**
 * Android 13+ monochrome ("themed") icon: white line art on transparency.
 * Alpha combines the layer's own transparency with the luminance of the
 * artwork, so only the dark outlines and lettering stay opaque and the icon
 * survives being tinted a single flat colour by the launcher.
 *
 * `ensureAlpha().raw()` yields 4 bytes per pixel — reading it as one byte per
 * pixel would treat transparent corners (luminance 0) as fully opaque.
 */
const { data, info } = await sharp(fromBrand('android-foreground.png'))
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const count = info.width * info.height;
const mono = Buffer.alloc(count * 4);
for (let i = 0; i < count; i += 1) {
  const r = data[i * 4];
  const g = data[i * 4 + 1];
  const b = data[i * 4 + 2];
  const alpha = data[i * 4 + 3];
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  mono[i * 4] = 255;
  mono[i * 4 + 1] = 255;
  mono[i * 4 + 2] = 255;
  mono[i * 4 + 3] = Math.round(alpha * (1 - luminance / 255));
}
await sharp(mono, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(toAssets('android-icon-monochrome.png'));
console.log(`  ✔ android-icon-monochrome.png  ${info.width}×${info.height}`);

/** Favicon: a downscaled copy of the full icon reads best at small sizes. */
await sharp(toAssets('icon.png'))
  .resize(64, 64, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(toAssets('favicon.png'));
console.log('  ✔ favicon.png  64×64');

console.log('\nDone. Restart Metro (`npx expo start -c`) — or re-run `npx expo prebuild` — to pick them up.');
