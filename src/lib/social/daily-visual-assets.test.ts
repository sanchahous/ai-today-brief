import { describe, expect, it } from 'vitest';
import {
  DAILY_VISUAL_INSTAGRAM,
  dailyVisualAssetPlan,
  renderDailyVisualSocialAssets,
} from './daily-visual-assets';
import type { DailyVisualInstagramCarouselSpec } from './daily-visual-carousel';

const INSTAGRAM_SPEC: DailyVisualInstagramCarouselSpec = {
  kind: 'daily_visual',
  version: 1,
  caption:
    'A practical daily AI briefing that explains the important shift, the verified changes behind it, and why a builder should care before the next technical decision. Save this post for your next planning session. #AI #Engineering',
  slides: [
    { kind: 'cover', headline: 'Efficiency, not raw scale', body: 'The day’s visual thesis.' },
    { kind: 'story', storyId: 'story-1', headline: 'A concrete change', body: 'An approved fact.' },
    { kind: 'thesis', headline: 'Why it matters', body: 'A practical consequence.' },
    { kind: 'thesis', headline: 'Use the signal', body: 'Check the real workflow impact.' },
    { kind: 'cta', headline: 'Read the daily brief', body: 'Follow AI Today Brief.' },
  ],
};

describe('daily visual social assets', () => {
  it('uses one contained master for every immutable Instagram derivative', async () => {
    const master = Buffer.from('master-image');
    const rendered: Array<{
      background: Buffer | Buffer[] | null;
      fit?: string;
      title: string;
      body?: string;
    }> = [];
    const paths: string[] = [];
    const assets = await renderDailyVisualSocialAssets(
      {
        packageId: 'package-123',
        visualSetId: 'candidate-123',
        masterImageUrl: 'https://cdn.example/master.jpg',
        channel: 'instagram',
        locale: 'en',
        displayTitle: 'Efficiency, not raw scale',
        visualThesis: 'The selected visual explains the day’s thesis.',
        instagramCarousel: INSTAGRAM_SPEC,
      },
      {
        loadMaster: async () => master,
        renderImage: async (_width, _height, title, _eyebrow, background, options) => {
          rendered.push({ background, fit: options?.backgroundFit, title, body: options?.body });
          return Buffer.from(`jpeg-${title}`);
        },
        uploadImage: async (path, jpeg, width, height) => {
          paths.push(path);
          return {
            url: `https://cdn.example/${path}`,
            mimeType: 'image/jpeg',
            width,
            height,
            bytes: jpeg.length,
          };
        },
      },
    );

    expect(assets).toHaveLength(DAILY_VISUAL_INSTAGRAM.slideCount);
    expect(assets.every((asset) => asset.width === 1080 && asset.height === 1350)).toBe(true);
    expect(rendered).toHaveLength(5);
    expect(rendered.every((entry) => entry.background === master)).toBe(true);
    expect(rendered.every((entry) => entry.fit === 'contain')).toBe(true);
    expect(rendered[0]?.title).toBe(INSTAGRAM_SPEC.slides[0].headline);
    expect(rendered[0]?.body).toBe(INSTAGRAM_SPEC.slides[0].body);
    expect(rendered[1]?.body).toBe(INSTAGRAM_SPEC.slides[1].body);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.includes('/daily-visual/'))).toBe(true);
  });

  it('plans a single contained derivative for every non-Instagram channel', () => {
    for (const channel of ['telegram', 'facebook', 'threads', 'x', 'linkedin'] as const) {
      const plan = dailyVisualAssetPlan(channel);
      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({ fit: 'contain', masterSourceCount: 1 });
    }
  });
});
