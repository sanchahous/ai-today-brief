import { describe, expect, it, vi } from 'vitest';
import {
  buildCustomEditorPrompt,
  buildPrompt,
  buildReaderProfileBlock,
  generateWithModelQueue,
  isGeminiRateLimitError,
  isRetryableGeminiError,
  parseBrief,
  parseImpactLevel,
} from './summarize';
import type { PoolItem } from './select';

const pool: PoolItem[] = [
  {
    ref: 1,
    title: 'Claude Opus 4.8 released',
    url: 'https://ex.com/claude',
    source: 'Anthropic',
    topic: 'claude',
    category: 'tools-and-releases',
  },
  {
    ref: 2,
    title: 'New MCP server for Postgres',
    url: 'https://ex.com/mcp',
    source: 'Hacker News',
    topic: 'mcp',
    category: 'agents-and-mcp',
  },
];

describe('parseImpactLevel', () => {
  it('accepts low, medium, high only', () => {
    expect(parseImpactLevel('high')).toBe('high');
    expect(parseImpactLevel('critical')).toBeNull();
  });
});

describe('buildReaderProfileBlock', () => {
  it('mentions key reader interests', () => {
    const block = buildReaderProfileBlock();
    expect(block).toContain('READER PROFILE');
    expect(block).toContain('Claude Code');
    expect(block).toContain('MCP');
    expect(block).toContain('Does NOT want');
  });
});

describe('buildPrompt', () => {
  it('lists candidates, recent titles and the category vocabulary', () => {
    const p = buildPrompt(pool, ['Older published story'], 6);
    expect(p).toContain('[1] (Anthropic) Claude Opus 4.8 released');
    expect(p).toContain('[2] (Hacker News) New MCP server for Postgres');
    expect(p).toContain('Older published story');
    expect(p).toContain('AT MOST 6');
    expect(p).toContain('agents-and-mcp');
  });
  it('notes when nothing has been published yet', () => {
    expect(buildPrompt(pool, [], 6)).toContain('(nothing published yet)');
  });
  it('embeds reader profile block', () => {
    const p = buildPrompt(pool, [], 6);
    expect(p).toContain('READER PROFILE');
    expect(p).toContain('Does NOT want');
  });
  it('references reader profile in the filtering instructions', () => {
    const p = buildPrompt(pool, [], 6);
    expect(p).toContain('READER PROFILE above');
  });
});

describe('buildCustomEditorPrompt', () => {
  it('requires multi-source original copy and keeps ref 1', () => {
    const p = buildCustomEditorPrompt(pool.slice(0, 1), [], {
      synthesis_notes: 'Cross-source facts here.',
      sources: [
        {
          title: 'Official post',
          url: 'https://ex.com/a',
          source_name: 'Vendor',
          excerpt: 'Shipped today.',
        },
        {
          title: 'Press coverage',
          url: 'https://ex.com/b',
          source_name: 'Tech Press',
          excerpt: 'Benchmark numbers.',
        },
      ],
    });
    expect(p).toContain('MULTI-SOURCE ORIGINAL COPY');
    expect(p).toContain('Cross-source facts here.');
    expect(p).toContain('Vendor');
    expect(p).toContain('Tech Press');
    expect(p).toContain('Keep ref 1');
    expect(p).toContain('do NOT copy phrases');
  });
});

describe('parseBrief', () => {
  it('maps items by ref, derives + dedupes slugs, validates category', () => {
    const json = JSON.stringify({
      title_en: 'Models and Tools Move Fast',
      title_uk: 'Моделі та інструменти',
      intro_en: 'A busy day.',
      intro_uk: 'Насичений день.',
      items: [
        {
          ref: 2,
          category_slug: 'agents-and-mcp',
          title_en: 'MCP server for Postgres lands',
          title_uk: 'Вийшов MCP-сервер для Postgres',
          summary_en: 'A new server.',
          summary_uk: 'Новий сервер.',
          why_matters_en: 'Connect agents to your DB.',
          why_matters_uk: 'Підключи агентів до БД.',
          deep_dive_en: 'Long form.',
          deep_dive_uk: 'Розгорнуто.',
          takeaways_en: ['Point A', ''],
          takeaways_uk: ['Пункт А'],
          tools_mentioned: ['Postgres', 'MCP'],
          social_hook_en: 'New MCP server bridges Postgres and AI agents — open source, one command to run.',
          social_hook_uk: 'Новий MCP-сервер поєднує Postgres з AI-агентами — відкритий код, одна команда.',
        },
        {
          ref: 1,
          category_slug: 'not-a-real-category',
          title_en: 'Claude Opus 4.8 released',
          title_uk: 'Випущено Claude Opus 4.8',
          summary_en: 'Anthropic shipped it.',
          summary_uk: 'Anthropic випустив.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: '',
          deep_dive_uk: '',
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: 'Anthropic ships Claude Opus 4.8 with major code and reasoning upgrades.',
          social_hook_uk: '',
        },
      ],
    });

    const brief = parseBrief(json, pool);
    expect(brief.title_en).toBe('Models and Tools Move Fast');
    expect(brief.slug).toBe('models-and-tools-move-fast');
    expect(brief.items).toHaveLength(2);

    const [first, second] = brief.items;
    expect(first!.ref).toBe(2);
    expect(first!.url).toBe('https://ex.com/mcp');
    expect(first!.slug).toBe('mcp-server-for-postgres-lands');
    expect(first!.takeaways_en).toEqual(['Point A']); // empty bullet dropped
    expect(first!.social_hook_en).toBe('New MCP server bridges Postgres and AI agents — open source, one command to run.');
    expect(first!.social_hook_uk).toBe('Новий MCP-сервер поєднує Postgres з AI-агентами — відкритий код, одна команда.');

    // invalid category falls back to the candidate's deterministic category
    expect(second!.category_slug).toBe('tools-and-releases');
    // social_hook_uk falls back to _en when uk is empty
    expect(second!.social_hook_uk).toBe('Anthropic ships Claude Opus 4.8 with major code and reasoning upgrades.');
  });

  it('parses social_hook_en/uk and falls back uk→en when uk is missing', () => {
    const json = JSON.stringify({
      title_en: 'Brief', title_uk: 'Бриф', intro_en: '', intro_uk: '',
      items: [{
        ref: 1, category_slug: 'tools-and-releases',
        title_en: 'Claude released', title_uk: 'Вийшов Claude',
        summary_en: 'New model.', summary_uk: 'Нова модель.',
        why_matters_en: '', why_matters_uk: '',
        deep_dive_en: '', deep_dive_uk: '',
        takeaways_en: [], takeaways_uk: [], tools_mentioned: [],
        social_hook_en: 'Claude 5 drops with 2M context.',
        // social_hook_uk intentionally missing → should fall back to en
      }],
    });
    const brief = parseBrief(json, pool);
    const item = brief.items[0]!;
    expect(item.social_hook_en).toBe('Claude 5 drops with 2M context.');
    expect(item.social_hook_uk).toBe('Claude 5 drops with 2M context.'); // fallback
  });

  it('skips hallucinated refs and items with no summary; empty list is valid', () => {
    const json = JSON.stringify({
      title_en: 'Quiet day',
      title_uk: 'Тихий день',
      intro_en: '',
      intro_uk: '',
      items: [
        { ref: 99, category_slug: 'optimization', title_en: 'Ghost', summary_en: 'x' },
        { ref: 1, category_slug: 'optimization', title_en: 'No summary', summary_en: '' },
      ],
    });
    const brief = parseBrief(json, pool);
    expect(brief.items).toHaveLength(0);
    expect(brief.slug).toBe('quiet-day');
  });
});

describe('generateWithModelQueue + Gemini errors', () => {
  it('isGeminiRateLimitError detects quota/429 errors', () => {
    expect(isGeminiRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isGeminiRateLimitError(new Error('rate limit exceeded'))).toBe(true);
    expect(isGeminiRateLimitError(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe(true);
    expect(isGeminiRateLimitError(new Error('503 temporarily unavailable'))).toBe(false);
    expect(isGeminiRateLimitError('not an Error')).toBe(false);
  });

  it('isRetryableGeminiError: 429/rate-limit is NOT retryable (escalates to OpenRouter)', () => {
    expect(isRetryableGeminiError(new Error('429 rate limit'))).toBe(false);
    expect(isRetryableGeminiError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe(false);
    // transient errors ARE retryable
    expect(isRetryableGeminiError(new Error('503 temporarily unavailable'))).toBe(true);
    expect(isRetryableGeminiError(new Error('500 internal server error'))).toBe(true);
    expect(isRetryableGeminiError(new Error('network error'))).toBe(true);
    // non-retryable
    expect(isRetryableGeminiError(new Error('400 invalid argument'))).toBe(false);
    expect(isRetryableGeminiError('nope')).toBe(false);
  });

  it('retries a transient 503 on the same model then succeeds', async () => {
    const gen = vi
      .fn<(modelId: string, p: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('503 temporarily unavailable'))
      .mockResolvedValueOnce('{"ok":true}');
    const out = await generateWithModelQueue('prompt', 'key', ['gemini-3.5-flash'], 3, gen, async () => {});
    expect(out.text).toBe('{"ok":true}');
    expect(out.model).toBe('gemini-3.5-flash');
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('advances to the next model after rate-limit on the first', async () => {
    const gen = vi
      .fn<(modelId: string, p: string) => Promise<string>>()
      .mockImplementation(async (modelId) => {
        if (modelId === 'gemini-3.5-flash') throw new Error('429 rate limit exceeded');
        return '{"ok":true}';
      });
    const out = await generateWithModelQueue(
      'p',
      'key',
      ['gemini-3.5-flash', 'gemini-2.5-flash'],
      2,
      gen,
      async () => {},
    );
    expect(out.model).toBe('gemini-2.5-flash');
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('rethrows when every model in the queue fails', async () => {
    const gen = vi
      .fn<(modelId: string, p: string) => Promise<string>>()
      .mockRejectedValue(new Error('400 bad request'));
    await expect(
      generateWithModelQueue('p', 'key', ['gemini-3.5-flash', 'gemini-2.5-flash'], 1, gen, async () => {}),
    ).rejects.toThrow(/400/);
    expect(gen).toHaveBeenCalledTimes(2);
  });
});
