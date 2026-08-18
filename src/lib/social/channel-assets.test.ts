import { describe, expect, it } from 'vitest';
import {
  selectInstagramCarouselSources,
  selectWeeklyChannelImage,
  type SocialSelectableArtifact,
} from './channel-assets';

function artifact(overrides: Partial<SocialSelectableArtifact>): SocialSelectableArtifact {
  return {
    id: 'artifact',
    artifact_type: 'social_asset',
    slot_key: 'social-landscape:en',
    is_current: true,
    generation_status: 'ready',
    review_status: 'approved',
    mime_type: 'image/jpeg',
    width: 1200,
    height: 630,
    byte_size: 80_000,
    revision_item_id: null,
    ...overrides,
  };
}

describe('selectWeeklyChannelImage', () => {
  it('excludes a LinkedIn PDF even when the slot key contains linkedin', () => {
    const selected = selectWeeklyChannelImage(
      [
        artifact({
          id: 'pdf',
          slot_key: 'linkedin-document:en',
          mime_type: 'application/pdf',
          width: null,
          height: null,
          byte_size: 240_000,
        }),
        artifact({ id: 'cover', artifact_type: 'cover', slot_key: 'cover:neutral', width: 1600, height: 900 }),
      ],
      'linkedin',
    );
    expect(selected?.artifactId).toBe('cover');
    expect(selected?.mimeType).toBe('image/jpeg');
  });

  it('prefers an approved social-landscape image over cover fallback', () => {
    const selected = selectWeeklyChannelImage(
      [
        artifact({ id: 'landscape', slot_key: 'social-landscape:en' }),
        artifact({
          id: 'cover',
          artifact_type: 'cover',
          slot_key: 'cover:neutral',
          width: 1600,
          height: 900,
        }),
        artifact({
          id: 'pdf',
          slot_key: 'linkedin-document:en',
          mime_type: 'application/pdf',
        }),
      ],
      'telegram',
    );
    expect(selected?.artifactId).toBe('landscape');
  });

  it('falls back to an approved cover:neutral when landscape is missing', () => {
    const selected = selectWeeklyChannelImage(
      [
        artifact({
          id: 'cover',
          artifact_type: 'cover',
          slot_key: 'cover:neutral',
          width: 1600,
          height: 900,
        }),
      ],
      'x',
    );
    expect(selected?.artifactId).toBe('cover');
  });
});

describe('selectInstagramCarouselSources', () => {
  it('requires an approved cover and three distinct story images', () => {
    const missing = selectInstagramCarouselSources([
      artifact({ id: 'cover', artifact_type: 'cover', slot_key: 'cover:main', width: 1600, height: 900 }),
      artifact({
        id: 'story-1',
        artifact_type: 'story_image',
        slot_key: 'story:1',
        revision_item_id: 'item-1',
        width: 1600,
        height: 900,
      }),
    ]);
    expect(missing.ok).toBe(false);

    const duplicateItem = selectInstagramCarouselSources([
      artifact({ id: 'cover', artifact_type: 'cover', slot_key: 'cover:neutral', width: 1600, height: 900 }),
      artifact({
        id: 'story-1',
        artifact_type: 'story_image',
        slot_key: 'story:1',
        revision_item_id: 'item-1',
        width: 1600,
        height: 900,
      }),
      artifact({
        id: 'story-1b',
        artifact_type: 'story_image',
        slot_key: 'story:1b',
        revision_item_id: 'item-1',
        width: 1600,
        height: 900,
      }),
      artifact({
        id: 'story-2',
        artifact_type: 'story_image',
        slot_key: 'story:2',
        revision_item_id: 'item-2',
        width: 1600,
        height: 900,
      }),
    ]);
    expect(duplicateItem.ok).toBe(false);

    const ok = selectInstagramCarouselSources([
      artifact({ id: 'cover', artifact_type: 'cover', slot_key: 'cover:neutral', width: 1600, height: 900 }),
      artifact({
        id: 'story-1',
        artifact_type: 'story_image',
        slot_key: 'story:1',
        revision_item_id: 'item-1',
        width: 1600,
        height: 900,
      }),
      artifact({
        id: 'story-2',
        artifact_type: 'story_image',
        slot_key: 'story:2',
        revision_item_id: 'item-2',
        width: 1600,
        height: 900,
      }),
      artifact({
        id: 'story-3',
        artifact_type: 'story_image',
        slot_key: 'story:3',
        revision_item_id: 'item-3',
        width: 1600,
        height: 900,
      }),
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.stories.map((story) => story.revisionItemId)).toEqual(['item-1', 'item-2', 'item-3']);
    }
  });
});
