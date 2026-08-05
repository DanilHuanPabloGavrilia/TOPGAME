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
  { from: 'assets-source/images/items', to: 'src/assets/images/items', size: 128 }
];

const QUALITY = 82;

async function optimizeDir({ from, to, size }) {
  const srcDir = join(ROOT, from);
  const outDir = join(ROOT, to);
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(srcDir)).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  let before = 0;
  let after = 0;

  for (const file of files) {
    const srcPath = join(srcDir, file);
    const outPath = join(outDir, `${parse(file).name}.webp`);

    const buffer = await sharp(srcPath)
      .resize(size, size, { fit: 'cover' })
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
