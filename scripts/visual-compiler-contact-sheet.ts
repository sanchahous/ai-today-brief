import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow';

interface RenderedRecord {
  rank: number;
  headline: string;
  pixelOnlyPath: string;
  finalPath: string;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapHeadline(value: string, maxChars = 76): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

async function main() {
  const records = JSON.parse(
    await readFile(join(ROOT, 'render-manifest.json'), 'utf8'),
  ) as RenderedRecord[];
  const thumbWidth = 720;
  const thumbHeight = 405;
  const margin = 28;
  const titleHeight = 92;
  const rowHeight = titleHeight + thumbHeight + 34;
  const width = margin * 3 + thumbWidth * 2;
  const height = margin + rowHeight * records.length;
  const imageLayers: OverlayOptions[] = [];
  const textSvg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];

  for (const [rowIndex, record] of records.entries()) {
    const y = margin + rowIndex * rowHeight;
    const lines = wrapHeadline(`${record.rank}. ${record.headline}`);
    lines.forEach((line, lineIndex) => {
      textSvg.push(
        `<text x="${margin}" y="${y + 30 + lineIndex * 27}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="800" fill="#ECFEFF">${xml(
          line,
        )}</text>`,
      );
    });
    textSvg.push(
      `<text x="${margin}" y="${y + 82}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#67E8F9">PIXELS + STRUCTURE</text>`,
      `<text x="${margin * 2 + thumbWidth}" y="${y + 82}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#67E8F9">FINAL + APPROVED OVERLAYS</text>`,
    );

    for (const [column, path] of [record.pixelOnlyPath, record.finalPath].entries()) {
      const x = margin + column * (thumbWidth + margin);
      const thumbnail = await sharp(path)
        .resize(thumbWidth, thumbHeight, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      imageLayers.push({ input: thumbnail, left: x, top: y + titleHeight });
    }
  }
  textSvg.push('</svg>');

  const output = await sharp({
    create: { width, height, channels: 3, background: '#050B12' },
  })
    .composite([
      ...imageLayers,
      { input: Buffer.from(textSvg.join('')), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  await writeFile(join(ROOT, 'contact-sheet.png'), output);
  console.log(join(ROOT, 'contact-sheet.png'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
