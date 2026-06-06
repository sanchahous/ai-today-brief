import { describe, expect, it, vi } from 'vitest';
import {
  buildPrompt,
  generateWithRetry,
  isRetryableGeminiError,
  parseBrief,
  resolveGeminiModel,
  resolveGeminiModelFallback,
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

describe('model resolution + retry', () => {
  it('resolves model + fallback from env', () => {
    expect(resolveGeminiModel({})).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel({ GEMINI_MODEL: 'gemini-3-flash' })).toBe('gemini-3-flash');
    expect(resolveGeminiModelFallback({})).toBeNull();
    expect(resolveGeminiModelFallback({ GEMINI_MODEL_FALLBACK: 'gemini-2.0-flash' })).toBe(
      'gemini-2.0-flash',
    );
  });

  it('classifies retryable vs fatal errors', () => {
    expect(isRetryableGeminiError(new Error('got a 429 rate limit'))).toBe(true);
    expect(isRetryableGeminiError(new Error('400 invalid argument'))).toBe(false);
    expect(isRetryableGeminiError('nope')).toBe(false);
  });

  it('retries a transient failure then succeeds, without real sleeping', async () => {
    const gen = vi
      .fn<(p: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('503 temporarily unavailable'))
      .mockResolvedValueOnce('{"ok":true}');
    const out = await generateWithRetry('prompt', 'key', 3, gen, async () => {});
    expect(out).toBe('{"ok":true}');
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-retryable error immediately', async () => {
    const gen = vi
      .fn<(p: string) => Promise<string>>()
      .mockRejectedValue(new Error('400 bad request'));
    await expect(generateWithRetry('p', 'key', 3, gen, async () => {})).rejects.toThrow(/400/);
    expect(gen).toHaveBeenCalledTimes(1);
  });
});
