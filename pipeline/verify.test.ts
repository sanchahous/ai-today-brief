import { describe, expect, it } from 'vitest';
import type { EnrichedSource } from './enrich';
import type { DraftItem } from './summarize';
import { buildRevisePrompt, buildVerifyPrompt, parseVerifyResults, verifiableItems } from './verify';

function draftItem(over: Partial<DraftItem> = {}): DraftItem {
  return {
    ref: 1,
    url: 'https://ex.com/a',
    source: 'Hacker News',
    category_slug: 'tools-and-releases',
    slug: 'story-a',
    title_en: 'Claude Code ships hooks',
    title_uk: 'Claude Code отримує хуки',
    summary_en: 'Hooks landed with lifecycle events.',
    summary_uk: 'Зʼявились хуки з подіями життєвого циклу.',
    why_matters_en: '',
    why_matters_uk: '',
    deep_dive_en: '',
    deep_dive_uk: '',
    body_md_en: '### What shipped\nHooks run scripts on lifecycle events.',
    body_md_uk: '### Що вийшло\nХуки запускають скрипти на події.',
    facts_en: [{ label: 'Price', value: '$5 / 1M tokens' }],
    facts_uk: [{ label: 'Ціна', value: '$5 / 1M токенів' }],
    code_snippet: null,
    when_to_use_en: [],
    when_to_use_uk: [],
    when_not_to_use_en: [],
    when_not_to_use_uk: [],
    community_reactions: [],
    citations: [],
    image_url: null,
    takeaways_en: [],
    takeaways_uk: [],
    tools_mentioned: [],
    action_items_en: [],
    action_items_uk: [],
    impact_level: null,
    social_hook_en: '',
    social_hook_uk: '',
    uk_quality_flags: [],
    unsupported_claims: [],
    ...over,
  };
}

const enriched = (ref: number, text: string | null): EnrichedSource => ({
  ref,
  url: `https://ex.com/${ref}`,
  text,
  ogImage: null,
  comments: [],
});

describe('verifiableItems', () => {
  it('pairs items with their source text and skips refs without text', () => {
    const items = [draftItem({ ref: 1 }), draftItem({ ref: 2 })];
    const pairs = verifiableItems(items, [enriched(1, 'Full source text'), enriched(2, null)]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.item.ref).toBe(1);
    expect(pairs[0]!.sourceText).toBe('Full source text');
  });
});

describe('buildVerifyPrompt', () => {
  it('lists item claims and source texts by ref', () => {
    const prompt = buildVerifyPrompt([
      { item: draftItem({ ref: 3 }), sourceText: 'The hooks system runs scripts.' },
    ]);
    expect(prompt).toContain('[3] TITLE: Claude Code ships hooks');
    expect(prompt).toContain('FACTS: Price = $5 / 1M tokens');
    expect(prompt).toContain('--- [3] ---');
    expect(prompt).toContain('The hooks system runs scripts.');
  });
});

describe('buildRevisePrompt', () => {
  it('lists the unsupported claims per item next to its source', () => {
    const prompt = buildRevisePrompt([
      {
        item: draftItem({
          ref: 2,
          unsupported_claims: ['costs $5/1M tokens', 'blocks all biology queries'],
        }),
        sourceText: 'The hooks system runs scripts.',
      },
    ]);
    expect(prompt).toContain('[2] TITLE_EN: Claude Code ships hooks');
    expect(prompt).toContain('- costs $5/1M tokens');
    expect(prompt).toContain('- blocks all biology queries');
    expect(prompt).toContain('--- [2] ---');
    expect(prompt).toContain('empty summary_en (that drops it)');
  });
});

describe('parseVerifyResults', () => {
  it('maps refs to trimmed claims and drops hallucinated refs', () => {
    const out = parseVerifyResults(
      JSON.stringify({
        results: [
          { ref: 1, unsupported_claims: ['  invented price  ', ''] },
          { ref: 9, unsupported_claims: ['ghost'] },
        ],
      }),
      new Set([1, 2]),
    );
    expect(out.get(1)).toEqual(['invented price']);
    expect(out.has(9)).toBe(false);
  });

  it('treats malformed results as empty', () => {
    expect(parseVerifyResults('{}', new Set([1])).size).toBe(0);
  });
});
