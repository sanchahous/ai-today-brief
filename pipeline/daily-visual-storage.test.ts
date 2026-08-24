import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  DAILY_VISUAL_MASTER_HEIGHT,
  DAILY_VISUAL_MASTER_WIDTH,
  normalizeDailyVisualMaster,
  renderBrandedDailyVisualFallback,
} from './daily-visual-storage';

describe('daily visual master storage shape', () => {
  it('pads a non-16:9 provider result instead of cropping the visual evidence', async () => {
    const source = await sharp({
      create: { width: 1536, height: 1024, channels: 3, background: '#47e4d3' },
    })
      .webp()
      .toBuffer();
    const master = await normalizeDailyVisualMaster(source);
    const metadata = await sharp(master).metadata();
    expect(metadata.width).toBe(DAILY_VISUAL_MASTER_WIDTH);
    expect(metadata.height).toBe(DAILY_VISUAL_MASTER_HEIGHT);
    expect(metadata.format).toBe('webp');
  });

  it('renders a bounded zero-cost fallback for explicit owner choice', async () => {
    const fallback = await renderBrandedDailyVisualFallback();
    const metadata = await sharp(fallback).metadata();
    expect(metadata.width).toBe(DAILY_VISUAL_MASTER_WIDTH);
    expect(metadata.height).toBe(DAILY_VISUAL_MASTER_HEIGHT);
  });
});
