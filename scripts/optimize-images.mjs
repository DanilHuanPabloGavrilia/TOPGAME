// Downscales the 1024x1024 art masters into the sizes the game actually renders.
// Masters live in assets-source/ (git-ignored); the webp output in src/assets/ is what ships.
//
//   npm run assets

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath, not URL.pathname — the latter percent-encodes non-ASCII path segments.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Rendered at 80x80 in the dossier modal and 24x24 on the world map; 256 covers 2x DPI.
// Item icons render at 42x42, so 128 covers them with room to spare.
const TARGETS = [
  { from: 'assets-source/images/bosses', to: 'src/assets/images/bosses', size: 256 },
  { from: 'assets-source/images/items', to: 'src/assets/images/items', size: 128 },
  // Shot effects are drawn onto the FX canvas additively, so the black around the glow adds
  // nothing to the picture and is pure archive weight — trim it off (two thirds of the burst
  // master was empty). 'inside' rather than 'cover' because these are not square: the beam is
  // a wide strip and a centre crop would cut its tip off.
  { from: 'assets-source/images/fx', to: 'src/assets/images/fx', size: 512, glow: true }
];

const QUALITY = 82;

async function optimizeDir({ from, to, size, glow }) {
  const srcDir = join(ROOT, from);
  const outDir = join(ROOT, to);
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(srcDir)).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  let before = 0;
  let after = 0;

  for (const file of files) {
    const srcPath = join(srcDir, file);
    const outPath = join(outDir, `${parse(file).name}.webp`);

    const pipeline = sharp(srcPath);
    // The threshold has to clear the vignette the generator leaves around the glow, which is
    // near-black but not black. Too low and nothing is trimmed; too high and the faint outer
    // halo goes with it, which is the part that makes the effect read as light rather than a
    // decal. 12 was measured against the burst master: 1024x1024 -> 608x605, halo intact.
    if (glow) pipeline.trim({ background: '#000000', threshold: 12 });

    const buffer = await pipeline
      .resize(size, size, { fit: glow ? 'inside' : 'cover', withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer();

    await writeFile(outPath, buffer);

    before += (await stat(srcPath)).size;
    after += buffer.length;
  }

  return { dir: to, count: files.length, before, after };
}

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

let totalBefore = 0;
let totalAfter = 0;

for (const target of TARGETS) {
  const r = await optimizeDir(target);
  totalBefore += r.before;
  totalAfter += r.after;
  console.log(`${r.dir}: ${r.count} files, ${mb(r.before)} -> ${mb(r.after)}`);
}

console.log(`\ntotal: ${mb(totalBefore)} -> ${mb(totalAfter)} (${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}% smaller)`);
