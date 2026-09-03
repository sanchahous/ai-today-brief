import { describe, expect, it } from 'vitest';
import { compactLinkedInComment, linkedInArticleContent } from './linkedin-article';

const UTM =
  'https://aitodaybrief.com/en/weekly/multiverse-s-4-bit-model-beats-16-bit-nvidia-grades-its-own-2026-08-23?utm_source=linkedin&utm_medium=social&utm_campaign=weekly_digest&utm_content=Benchmarking+AI+Infrastructure+in+Agent+Era&s=16812e70-18a5-4d17-bf01-93d3a366a026';
const COMPACT =
  'https://aitodaybrief.com/en/weekly/multiverse-s-4-bit-model-beats-16-bit-nvidia-grades-its-own-2026-08-23?s=16812e70-18a5-4d17-bf01-93d3a366a026';

describe('compactLinkedInComment', () => {
  it('puts a compact click URL on its own line and drops UTM', () => {
    expect(
      compactLinkedInComment(`Full technical breakdown of this week's claims: ${UTM}`),
    ).toBe(`Full technical breakdown of this week's claims\n\n${COMPACT}`);
  });
});

describe('linkedInArticleContent', () => {
  it('builds a Posts API article from the compact page URL, not the UTM string', () => {
    const content = linkedInArticleContent({
      text: 'NVIDIA graded its own stack.\n\nQuantization healing is the real claim.',
      firstComment: `Read the breakdown: ${UTM}`,
      thumbnail: 'urn:li:image:thumb',
    });
    expect(content).toEqual({
      article: {
        source: COMPACT,
        title: 'NVIDIA graded its own stack.',
        description: 'NVIDIA graded its own stack. Quantization healing is the real claim.',
        thumbnail: 'urn:li:image:thumb',
      },
    });
  });

  it('returns null when the first comment has no URL', () => {
    expect(linkedInArticleContent({ text: 'No link here.', firstComment: 'See the post.' })).toBe(
      null,
    );
  });
});
