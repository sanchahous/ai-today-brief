/**
 * Renders PNG exports from artifacts/brand-kit/*.svg at platform-native sizes.
 * Run after editing brand-kit SVGs: npm run brand-kit:export
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const KIT_DIR = join(process.cwd(), 'artifacts', 'brand-kit');

const EXPORTS: { svg: string; png: string; width: number; height: number }[] = [
  { svg: 'avatar.svg', png: 'avatar-1024.png', width: 1024, height: 1024 },
  { svg: 'banner-x.svg', png: 'banner-x.png', width: 1500, height: 500 },
  { svg: 'banner-linkedin.svg', png: 'banner-linkedin.png', width: 4200, height: 700 },
  { svg: 'banner-youtube.svg', png: 'banner-youtube.png', width: 2560, height: 1440 },
  { svg: 'banner-facebook.svg', png: 'banner-facebook.png', width: 851, height: 315 },
];

async function main() {
  for (const { svg, png, width, height } of EXPORTS) {
    const svgPath = join(KIT_DIR, svg);
    const pngPath = join(KIT_DIR, png);
    const svgBuffer = readFileSync(svgPath);
    const density = Math.max(72, Math.ceil((96 * Math.max(width, height)) / 2560));
    const out = await sharp(svgBuffer, { density })
      .resize(width, height, { fit: 'fill' })
      .png()
      .toBuffer();
    writeFileSync(pngPath, out);
    console.log(`wrote ${pngPath} (${width}x${height})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
