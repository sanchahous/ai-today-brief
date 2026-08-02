import { describe, expect, it } from 'vitest';
import { approvedWeeklyClaimText, trustedWeeklyResearchSources } from './research';

describe('trustedWeeklyResearchSources', () => {
  it('uses the approved article URL as primary and derives a non-spoofable label', () => {
    expect(
      trustedWeeklyResearchSources({
        articleUrl: 'https://blog.google/example?utm_source=feed',
        revisionSources: [
          { name: 'Hacker News', url: 'https://blog.google/example?utm_source=feed' },
        ],
        citations: [{ title: 'Independent', url: 'https://example.org/context#section' }],
      }),
    ).toEqual([
      { name: 'Google', url: 'https://blog.google/example' },
      { name: 'Example', url: 'https://example.org/context' },
    ]);
  });

  it('recovers legacy revisions with an empty sources array from article lineage', () => {
    expect(
      trustedWeeklyResearchSources({
        articleUrl: 'https://github.com/openai/codex',
        revisionSources: [],
        citations: [],
      }),
    ).toEqual([{ name: 'GitHub', url: 'https://github.com/openai/codex' }]);
  });

  it('drops unsafe or non-HTTPS citation candidates', () => {
    expect(
      trustedWeeklyResearchSources({
        articleUrl: 'https://openai.com/research/example',
        revisionSources: [{ url: 'http://example.com/insecure' }],
        citations: [{ url: 'https://user:secret@example.org/private' }],
      }),
    ).toEqual([{ name: 'OpenAI', url: 'https://openai.com/research/example' }]);
  });
});

describe('approvedWeeklyClaimText', () => {
  it('keeps factual summary and structured facts but excludes editorial why copy', () => {
    expect(
      approvedWeeklyClaimText({
        summary_en: 'The product added a local transcription mode.',
        source_snapshot: {
          facts_en: [{ label: 'License', value: 'MIT' }],
          why_en: 'This completely eliminates every security risk.',
        },
      }),
    ).toEqual(['The product added a local transcription mode.', 'License: MIT']);
  });
});
