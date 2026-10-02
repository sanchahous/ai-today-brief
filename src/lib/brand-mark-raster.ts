import 'server-only';

import sharp from 'sharp';
import { brandMarkSvg, type BrandMarkSvgOptions } from '@/lib/brand-mark';

/** Rasterize the shared mark SVG for PDFKit / sharp composites. */
export async function rasterizeBrandMark(
  size: number,
  options?: Omit<BrandMarkSvgOptions, 'size'>,
): Promise<Buffer> {
  return sharp(Buffer.from(brandMarkSvg({ ...options, size }))).png().toBuffer();
}
