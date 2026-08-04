import sharp from 'sharp';
import { BRAND_MARK_SVG } from '@/lib/brand-mark';
import { MARK_COLOR_CORE } from '@/lib/site';

export const dynamic = 'force-static';

const SIZE = 512;
const MARK_SIZE = 400; // centered, leaves a safe-zone margin for maskable use

/**
 * Square brand logo for schema.org publisher.logo (NewsArticle rich results
 * require one) and the PWA manifest icon — rasterizes the same brand mark
 * used for the favicon, so all icon surfaces stay visually identical.
 */
export async function GET() {
  const svg = Buffer.from(BRAND_MARK_SVG);
  const mark = await sharp(svg, { density: (96 * MARK_SIZE) / 64 })
    .resize(MARK_SIZE, MARK_SIZE)
    .png()
    .toBuffer();
  const png = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: MARK_COLOR_CORE },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
