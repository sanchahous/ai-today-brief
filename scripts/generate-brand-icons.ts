/**
 * Regenerates the static icon artifacts from the canonical BRAND_MARK_SVG:
 *   - src/app/icon.svg       (verbatim copy — the crisp favicon Next serves)
 *   - src/app/favicon.ico    (16/32/48 PNG-in-ICO, for the literal /favicon.ico request)
 *   - src/app/apple-icon.png (180×180, opaque tile — iOS ignores transparency)
 *
 * Run after editing src/lib/brand-mark.ts: npx tsx scripts/generate-brand-icons.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { BRAND_MARK_SVG } from '../src/lib/brand-mark';
import { MARK_COLOR_CORE } from '../src/lib/site';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'src', 'app');
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;
const APPLE_MARK_SIZE = 140; // mark scaled down + centered so it isn't edge-to-edge

function buildIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries: Buffer[] = [];
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // color count (0 = not palette-indexed)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function main() {
  const svgPath = join(APP_DIR, 'icon.svg');
  writeFileSync(svgPath, BRAND_MARK_SVG, 'utf8');
  console.log(`wrote ${svgPath}`);

  const svgBuffer = Buffer.from(BRAND_MARK_SVG);
  const pngs = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      data: await sharp(svgBuffer, { density: (96 * size) / 64 })
        .resize(size, size)
        .png()
        .toBuffer(),
    })),
  );
  const icoPath = join(APP_DIR, 'favicon.ico');
  writeFileSync(icoPath, buildIco(pngs));
  console.log(`wrote ${icoPath} (${ICO_SIZES.join('/')})`);

  const markPng = await sharp(svgBuffer, { density: (96 * APPLE_MARK_SIZE) / 64 })
    .resize(APPLE_MARK_SIZE, APPLE_MARK_SIZE)
    .png()
    .toBuffer();
  const applePng = await sharp({
    create: {
      width: APPLE_SIZE,
      height: APPLE_SIZE,
      channels: 4,
      background: MARK_COLOR_CORE,
    },
  })
    .composite([{ input: markPng, gravity: 'center' }])
    .png()
    .toBuffer();
  const applePath = join(APP_DIR, 'apple-icon.png');
  writeFileSync(applePath, applePng);
  console.log(`wrote ${applePath} (${APPLE_SIZE}x${APPLE_SIZE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
