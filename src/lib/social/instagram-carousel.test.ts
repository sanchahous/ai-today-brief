import { describe, expect, it } from 'vitest';
import {
  assembleInstagramCarouselSpec,
  instagramCarouselIssues,
  parseInstagramWriterCandidate,
  type InstagramCarouselSpec,
} from './instagram-carousel';

const CAPTION =
  'Anthropic shipped a concrete evaluation workflow. The practical question is how teams use that approved signal before deployment, where smaller and testable decisions matter more than broad claims about the market.';

function sampleInstagramSpec(): InstagramCarouselSpec {
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
  if (!parsed) throw new Error('fixture writer candidate must parse');
  return assembleInstagramCarouselSpec({
    angle: 'Eval before deploy',
    hookCandidates: ['A', 'B', 'C'],
    parsed,
    storyRevisionItemIds: ['item-1', 'item-2', 'item-3'],
  });
}

describe('Instagram carousel spec', () => {
  it('accepts a valid 7-slide hybrid contract', () => {
    const spec = sampleInstagramSpec();
    expect(instagramCarouselIssues(spec, ['item-1', 'item-2', 'item-3'])).toEqual([]);
  });

  it('blocks count, order, IDs, text limits and caption URLs', () => {
    const spec = sampleInstagramSpec();
    spec.slides[1] = { ...spec.slides[1], kind: 'story', revisionItemId: 'item-1' };
    spec.slides[2] = { ...spec.slides[2], kind: 'story', revisionItemId: 'item-1' };
    spec.caption = 'Too short. https://example.com #one #two #three #four #five #six';
    spec.slides[0] = { kind: 'cover', headline: 'x'.repeat(80) };
    const codes = instagramCarouselIssues(spec, ['item-1', 'item-2']).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'instagram_story_ids',
        'instagram_story_revision',
        'instagram_caption_length',
        'instagram_caption_url',
        'instagram_caption_hashtags',
        'instagram_cover_headline',
      ]),
    );
  });

  it('parses the tagged writer candidate used in generation', () => {
    const parsed = parseInstagramWriterCandidate(
      `<COVER>Headline<STORY>One||Body one<STORY>Two||Body two<STORY>Three||Body three<COMPARISON>Cmp||Cmp body<CAVEAT>Caveat||Caveat body<TAKEAWAY>Take||Take body<CAPTION>${CAPTION}`,
    );
    expect(parsed?.coverHeadline).toBe('Headline');
    expect(parsed?.stories[2].headline).toBe('Three');
    expect(parsed?.caption.startsWith('Anthropic')).toBe(true);
  });
});
