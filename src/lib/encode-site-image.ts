/**
 * Website raster origin: WebP. Used for weekly story figures that the public
 * site renders through `next/image`. Not used for OG-facing files (news cards,
 * weekly cover) or social posts — `@vercel/og` / Satori cannot decode WebP,
 * Instagram's publishing API wants JPEG, and weekly `og:image` is the cover URL.
 */
import sharp from 'sharp';

export const SITE_IMAGE_CONTENT_TYPE = 'image/webp';
export const SITE_IMAGE_EXTENSION = 'webp';
export const SITE_IMAGE_QUALITY = 82;
export const STORY_IMAGE_WIDTH = 1600;
export const STORY_IMAGE_HEIGHT = 900;

/** Flatten alpha onto the same backdrop as news-card origins (`#071019`). */
const SITE_IMAGE_FLAT_BG = { r: 7, g: 16, b: 25 };

export async function encodeSiteWebp(
  bytes: Buffer,
  options: {
    width: number;
    height: number;
    position?: string;
  },
): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize(options.width, options.height, {
      fit: 'cover',
      position: options.position ?? 'attention',
    })
    .flatten({ background: SITE_IMAGE_FLAT_BG })
    .webp({ quality: SITE_IMAGE_QUALITY, effort: 4 })
    .toBuffer();
}
