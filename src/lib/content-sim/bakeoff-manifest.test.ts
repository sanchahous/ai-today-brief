import { describe, expect, it } from 'vitest';

import { criticHeadlineFromManifestRow } from './bakeoff-manifest';

describe('criticHeadlineFromManifestRow', () => {
  it('uses top-level headline when story is missing', () => {
    expect(
      criticHeadlineFromManifestRow({
        rank: 2,
        headline: 'Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations',
      }),
    ).toBe('Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations');
  });

  it('falls back to story.title when headline is absent', () => {
    expect(
      criticHeadlineFromManifestRow({
        rank: 1,
        story: { title: 'Nested title from a legacy package' },
      }),
    ).toBe('Nested title from a legacy package');
  });

  it('returns null when neither headline nor story.title is present', () => {
    expect(criticHeadlineFromManifestRow({ rank: 4, story: { summary: 'no title' } })).toBeNull();
  });
});
