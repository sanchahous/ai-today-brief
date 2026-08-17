import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  encodeSiteWebp,
  SITE_IMAGE_CONTENT_TYPE,
  SITE_IMAGE_EXTENSION,
  SITE_IMAGE_QUALITY,
  STORY_IMAGE_HEIGHT,
  STORY_IMAGE_WIDTH,
} from './encode-site-image';

async function photographicPng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = 90 + Math.round(Math.sin(x / 18) * 40 + Math.sin(y / 27) * 30);
      raw[i + 1] = 70 + Math.round(Math.sin((x + y) / 22) * 35);
      raw[i + 2] = 50 + Math.round(Math.cos(x / 31) * 25 + Math.sin(y / 14) * 20);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('encodeSiteWebp', () => {
  it('stores weekly story origins as WebP at the 16:9 site size', () => {
    expect(SITE_IMAGE_CONTENT_TYPE).toBe('image/webp');
    expect(SITE_IMAGE_EXTENSION).toBe('webp');
    expect(SITE_IMAGE_QUALITY).toBe(82);
    expect(STORY_IMAGE_WIDTH).toBe(1600);
    expect(STORY_IMAGE_HEIGHT).toBe(900);
  });

  it('encodes a raster as WebP at the requested cover size', async () => {
    const png = await photographicPng(1920, 1080);
    const webp = await encodeSiteWebp(png, {
      width: STORY_IMAGE_WIDTH,
      height: STORY_IMAGE_HEIGHT,
    });
    expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');
    await expect(sharp(webp).metadata()).resolves.toMatchObject({
      format: 'webp',
      width: STORY_IMAGE_WIDTH,
      height: STORY_IMAGE_HEIGHT,
    });
    expect(webp.length).toBeLessThan(png.length);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(
      encodeSiteWebp(Buffer.from('not-an-image'), {
        width: STORY_IMAGE_WIDTH,
        height: STORY_IMAGE_HEIGHT,
      }),
    ).rejects.toThrow();
  });
});
