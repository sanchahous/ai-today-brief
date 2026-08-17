import { describe, expect, it } from 'vitest';
import {
  approvedWeeklyClaimText,
  corroboratingExcerptFromHtml,
  RESEARCH_CORPUS_MAX_PAGES,
  RESEARCH_CORPUS_PAGE_SIZE,
  trustedWeeklyResearchSources,
} from './research';

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

  it('strips a trailing slash so slash-variants of the same page collapse', () => {
    expect(
      trustedWeeklyResearchSources({
        articleUrl: 'https://openai.com/index/previewing-ultrafast/',
        revisionSources: [{ url: 'https://www.openai.com/index/previewing-ultrafast?utm_source=hn' }],
        citations: [],
      }),
    ).toEqual([{ name: 'OpenAI', url: 'https://openai.com/index/previewing-ultrafast' }]);
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

describe('corroboratingExcerptFromHtml', () => {
  it('falls back to title and meta description when a model card has no prose lines', () => {
    const html = `<!doctype html><html><head>
      <title>Qwen/Qwen3.8-2.4T-A95B · Hugging Face</title>
      <meta name="description" content="Qwen3.8-2.4T-A95B is a 2.4T MoE checkpoint with 95B active parameters.">
      </head><body><div id="root"></div></body></html>`;
    expect(corroboratingExcerptFromHtml(html, 12_000)).toBe(
      'Qwen/Qwen3.8-2.4T-A95B · Hugging Face\n\nQwen3.8-2.4T-A95B is a 2.4T MoE checkpoint with 95B active parameters.',
    );
  });

  it('prefers extracted article prose when it is long enough', () => {
    const line =
      'this sentence is intentionally long enough to pass the prose-line threshold of the extractor.';
    const html = `<html><body><article><p>Lead: ${line}</p><p>Next: ${line}</p></article></body></html>`;
    const excerpt = corroboratingExcerptFromHtml(html, 12_000);
    expect(excerpt).toContain('Lead:');
    expect(excerpt).toContain('Next:');
    expect((excerpt?.length ?? 0) >= 160).toBe(true);
  });

  it('returns null when the shell has neither title nor description', () => {
    expect(corroboratingExcerptFromHtml('<html><body><div id="root"></div></body></html>', 200)).toBe(
      null,
    );
  });
});

describe('research corpus paging', () => {
  it('pages past the PostgREST 1000-row default so a 2440-row week window fits', () => {
    expect(RESEARCH_CORPUS_PAGE_SIZE).toBe(1000);
    expect(RESEARCH_CORPUS_MAX_PAGES * RESEARCH_CORPUS_PAGE_SIZE).toBeGreaterThanOrEqual(2440);
  });
});
