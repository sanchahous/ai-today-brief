import { describe, expect, it } from 'vitest';
import { shouldPromotePublicImage } from './publication-assets';

describe('shouldPromotePublicImage', () => {
  it('promotes cover, story, carousel and thumbnail images without a public URL', () => {
    expect(
      shouldPromotePublicImage({
        artifact_type: 'cover',
        mime_type: 'image/jpeg',
        external_url: null,
      }),
    ).toBe(true);
    expect(
      shouldPromotePublicImage({
        artifact_type: 'story_image',
        mime_type: 'image/webp',
        external_url: '',
      }),
    ).toBe(true);
    expect(
      shouldPromotePublicImage({
        artifact_type: 'social_asset',
        mime_type: 'image/jpeg',
        external_url: null,
      }),
    ).toBe(true);
    expect(
      shouldPromotePublicImage({
        artifact_type: 'thumbnail',
        mime_type: 'image/png',
        external_url: null,
      }),
    ).toBe(true);
  });

  it('skips LinkedIn native PDFs and other non-image social_asset rows', () => {
    expect(
      shouldPromotePublicImage({
        artifact_type: 'social_asset',
        mime_type: 'application/pdf',
        external_url: null,
      }),
    ).toBe(false);
  });

  it('skips copy artifacts, site PDFs, and anything that already has a public URL', () => {
    expect(
      shouldPromotePublicImage({
        artifact_type: 'pdf',
        mime_type: 'application/pdf',
        external_url: null,
      }),
    ).toBe(false);
    expect(
      shouldPromotePublicImage({
        artifact_type: 'article',
        mime_type: null,
        external_url: null,
      }),
    ).toBe(false);
    expect(
      shouldPromotePublicImage({
        artifact_type: 'cover',
        mime_type: 'image/jpeg',
        external_url: 'https://cdn.example/cover.jpg',
      }),
    ).toBe(false);
  });
});
