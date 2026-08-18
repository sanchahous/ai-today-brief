import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { assembleInstagramCarouselSpec, parseInstagramWriterCandidate } from '@/lib/social/instagram-carousel';
import { approximateInstagramMeasurer } from '@/lib/social/instagram-layout';
import { renderWeeklyInstagramCarousel } from './instagram-carousel-render';

const CAPTION =
  'Anthropic shipped a concrete evaluation workflow. The practical question is how teams use that approved signal before deployment, where smaller and testable decisions matter more than broad claims about the market.';

async function jpegStub() {
  return sharp({
    create: { width: 1600, height: 900, channels: 3, background: '#203040' },
  })
    .jpeg()
    .toBuffer();
}

describe('renderWeeklyInstagramCarousel', () => {
  it('renders seven 1080×1350 JPEGs', async () => {
    const parsed = parseInstagramWriterCandidate(
      [
        '<COVER>Inspect agents before they ship',
        '<STORY>Shipped eval||The approved report shows a concrete eval workflow.',
        '<STORY>Narrower gate||Teams can test traces before a production rollout.',
        '<STORY>Fewer assumptions||Demos no longer stand in for a measurable check.',
        '<COMPARISON>Before vs after||Old reviews were narrative; the new eval is checkable.',
        '<CAVEAT>Not automatic||It does not replace human review of high-risk agents.',
        '<TAKEAWAY>Use the eval||Adopt the shipped eval before the next agent rollout.',
        `<CAPTION>${CAPTION}`,
      ].join(''),
    );
    if (!parsed) throw new Error('writer fixture must parse');
    const spec = assembleInstagramCarouselSpec({
      angle: 'Eval before deploy',
      hookCandidates: ['A', 'B', 'C'],
      parsed,
      storyRevisionItemIds: ['item-1', 'item-2', 'item-3'],
    });
    const photo = await jpegStub();
    const rendered = await renderWeeklyInstagramCarousel({
      spec,
      cover: photo,
      stories: [
        { revisionItemId: 'item-1', image: photo },
        { revisionItemId: 'item-2', image: photo },
        { revisionItemId: 'item-3', image: photo },
      ],
      measurer: approximateInstagramMeasurer(0.5),
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.slides).toHaveLength(7);
    for (const slide of rendered.slides) {
      const info = await sharp(slide.jpeg).metadata();
      expect(info.format).toBe('jpeg');
      expect(info.width).toBe(1080);
      expect(info.height).toBe(1350);
    }
  });
});
