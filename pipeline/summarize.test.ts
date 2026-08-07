import { describe, expect, it, vi } from 'vitest';
import {
  buildCustomEditorPrompt,
  buildPrompt,
  buildReaderProfileBlock,
  generateWithModelQueue,
  isGeminiRateLimitError,
  isRetryableGeminiError,
  llmUsageFromProviderUsage,
  normalizeEscapedNewlines,
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

describe('normalizeEscapedNewlines', () => {
  it('converts literal \\n sequences when there are no real newlines', () => {
    expect(normalizeEscapedNewlines('### Head\\nLine one.\\n\\n### Two\\nMore.')).toBe(
      '### Head\nLine one.\n\n### Two\nMore.',
    );
  });
  it('leaves mixed content and plain text untouched', () => {
    expect(normalizeEscapedNewlines('Real\nnewline with literal \\n inside code')).toBe(
      'Real\nnewline with literal \\n inside code',
    );
    expect(normalizeEscapedNewlines('plain text')).toBe('plain text');
  });
  it('applies to body/deep-dive via parseBrief (the Gemini double-escape case)', () => {
    const json = JSON.stringify({
      title_en: 'Brief',
      title_uk: 'Бриф',
      intro_en: '',
      intro_uk: '',
      items: [
        {
          ref: 1,
          category_slug: 'tools-and-releases',
          title_en: 'Broken newlines story',
          title_uk: 'Історія з битими переносами',
          summary_en: 'Summary.',
          summary_uk: 'Резюме історії з переносами рядків.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: 'First line.\\nSecond line.',
          deep_dive_uk: 'Перший рядок тексту.\\nДругий рядок тексту.',
          body_md_en: '### Head\\nBody line.\\n\\n### Second\\nMore.',
          body_md_uk: '### Заголовок\\nПерший рядок тексту статті.',
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: '',
          social_hook_uk: '',
        },
      ],
    });
    const item = parseBrief(json, pool).items[0]!;
    expect(item.body_md_en).toBe('### Head\nBody line.\n\n### Second\nMore.');
    expect(item.deep_dive_uk).toBe('Перший рядок тексту.\nДругий рядок тексту.');
  });
});

describe('parseBrief — rich content fields (v2)', () => {
  it('parses body, facts, code, when-to-use, reactions and citations with guards', () => {
    const json = JSON.stringify({
      title_en: 'Brief',
      title_uk: 'Бриф',
      intro_en: '',
      intro_uk: '',
      items: [
        {
          ref: 1,
          category_slug: 'tools-and-releases',
          title_en: 'Claude Opus 4.8 released',
          title_uk: 'Вийшов Claude Opus 4.8',
          summary_en: 'New model ships.',
          summary_uk: 'Вийшла нова модель з кращим кодом.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: '',
          deep_dive_uk: '',
          body_md_en: '### Pricing\n$5 per 1M input tokens.',
          body_md_uk: '### Ціни\n$5 за 1M вхідних токенів.',
          facts_en: [
            { label: 'Input price', value: '$5 / 1M' },
            { label: '', value: 'dropped' },
          ],
          facts_uk: [{ label: 'Ціна входу', value: '$5 / 1M' }],
          code_snippet: { language: 'bash', code: 'npm i -g claude' },
          when_to_use_en: ['Long agentic tasks'],
          when_to_use_uk: ['Довгі агентні задачі'],
          when_not_to_use_en: ['Bulk classification'],
          when_not_to_use_uk: ['Масова класифікація'],
          community_reactions: [
            { author: 'dev1', quote: 'Huge jump on SWE-bench.', url: 'https://news.ycombinator.com/item?id=1' },
            { author: 'bad', quote: 'no url', url: '' },
          ],
          citations: [
            { title: 'Official post', url: 'https://anthropic.com/news' },
            { title: 'no url', url: '' },
          ],
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: '',
          social_hook_uk: '',
        },
      ],
    });
    const item = parseBrief(json, pool).items[0]!;
    expect(item.body_md_en).toContain('### Pricing');
    expect(item.facts_en).toEqual([{ label: 'Input price', value: '$5 / 1M' }]);
    expect(item.code_snippet).toEqual({ language: 'bash', code: 'npm i -g claude' });
    expect(item.when_not_to_use_en).toEqual(['Bulk classification']);
    expect(item.community_reactions).toHaveLength(1);
    expect(item.citations).toEqual([{ title: 'Official post', url: 'https://anthropic.com/news' }]);
    expect(item.image_url).toBeNull();
    expect(item.unsupported_claims).toEqual([]);
  });

  it('defaults rich fields when the model omits them', () => {
    const json = JSON.stringify({
      title_en: 'Brief',
      title_uk: 'Бриф',
      intro_en: '',
      intro_uk: '',
      items: [
        {
          ref: 2,
          category_slug: 'agents-and-mcp',
          title_en: 'New MCP server for Postgres',
          title_uk: 'Новий MCP-сервер для Postgres',
          summary_en: 'A server landed.',
          summary_uk: 'Зʼявився новий сервер для агентів.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: '',
          deep_dive_uk: '',
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: '',
          social_hook_uk: '',
        },
      ],
    });
    const item = parseBrief(json, pool).items[0]!;
    expect(item.body_md_en).toBe('');
    expect(item.facts_en).toEqual([]);
    expect(item.code_snippet).toBeNull();
    expect(item.community_reactions).toEqual([]);
    expect(item.citations).toEqual([]);
  });
});

describe('buildSourceMaterialBlock + buildPrompt with enrichment', () => {
  it('includes fetched text and HN comments keyed by ref', () => {
    const p = buildPrompt(pool, [], 6, [
      {
        ref: 1,
        url: 'https://ex.com/claude',
        text: 'Anthropic priced the model at $5 per million input tokens.',
        ogImage: null,
        comments: [
          { author: 'dev1', text: 'Tried it, solid.', url: 'https://news.ycombinator.com/item?id=7' },
        ],
      },
      { ref: 2, url: 'https://ex.com/mcp', text: null, ogImage: null, comments: [] },
    ]);
    expect(p).toContain('SOURCE MATERIAL (fetched from');
    expect(p).toContain('--- [1] https://ex.com/claude ---');
    expect(p).toContain('$5 per million input tokens');
    expect(p).toContain('dev1 (https://news.ycombinator.com/item?id=7): Tried it, solid.');
    expect(p).not.toContain('--- [2]');
  });

  it('omits the block entirely without enrichment', () => {
    expect(buildPrompt(pool, [], 6)).not.toContain('SOURCE MATERIAL (fetched from');
  });
});

describe('parseBrief — Ukrainian quality flags', () => {
  it('flags items whose _uk fields are English fallbacks', () => {
    const json = JSON.stringify({
      title_en: 'Brief',
      title_uk: 'Бриф',
      intro_en: '',
      intro_uk: '',
      items: [
        {
          ref: 1,
          category_slug: 'tools-and-releases',
          title_en: 'Claude Opus 4.8 released',
          // title_uk missing → falls back to EN → must be flagged
          summary_en: 'Anthropic shipped a new model.',
          summary_uk: 'Anthropic випустив нову модель із покращеним кодом.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: 'Long analysis of the release.',
          deep_dive_uk: 'Детальний розбір релізу та його можливостей.',
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: '',
          social_hook_uk: '',
        },
      ],
    });
    const brief = parseBrief(json, pool);
    expect(brief.items[0]!.uk_quality_flags).toEqual(['title_uk']);
  });

  it('keeps flags empty for natural Ukrainian items', () => {
    const json = JSON.stringify({
      title_en: 'Brief',
      title_uk: 'Бриф',
      intro_en: '',
      intro_uk: '',
      items: [
        {
          ref: 2,
          category_slug: 'agents-and-mcp',
          title_en: 'New MCP server for Postgres',
          title_uk: 'Новий MCP-сервер для Postgres',
          summary_en: 'A new server landed.',
          summary_uk: 'Зʼявився новий сервер для роботи агентів із базами даних.',
          why_matters_en: '',
          why_matters_uk: '',
          deep_dive_en: '',
          deep_dive_uk: '',
          takeaways_en: [],
          takeaways_uk: [],
          tools_mentioned: [],
          social_hook_en: '',
          social_hook_uk: '',
        },
      ],
    });
    const brief = parseBrief(json, pool);
    expect(brief.items[0]!.uk_quality_flags).toEqual([]);
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
    expect(out.usage).toBeNull(); // plain-string doubles carry no usage
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('threads token usage through when the model call reports it', async () => {
    const gen = vi.fn().mockResolvedValue({
      text: '{"ok":true}',
      usage: { promptTokens: 1200, outputTokens: 800, estimated: false },
    });
    const out = await generateWithModelQueue('p', 'key', ['gemini-3.5-flash'], 1, gen, async () => {});
    expect(out.usage).toEqual({ promptTokens: 1200, outputTokens: 800, estimated: false });
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

// --- Phase 6a: registry migration (runOpenRouter's transport swap + DB-driven override) ---

describe('llmUsageFromProviderUsage', () => {
  it('uses the provider-reported token counts when both are present', () => {
    expect(
      llmUsageFromProviderUsage(
        { promptTokens: 120, outputTokens: 340, costSource: 'reported' },
        999,
        999,
      ),
    ).toEqual({ promptTokens: 120, outputTokens: 340, estimated: false });
  });

  it('marks the result estimated when costSource is not "reported", even with real token counts', () => {
    expect(
      llmUsageFromProviderUsage(
        { promptTokens: 50, outputTokens: 20, costSource: 'estimated' },
        999,
        999,
      ),
    ).toEqual({ promptTokens: 50, outputTokens: 20, estimated: true });
  });

  it('falls back to char-count estimation when the provider reports no usage (e.g. the streaming client)', () => {
    const result = llmUsageFromProviderUsage(
      { promptTokens: null, outputTokens: null, costSource: 'estimated' },
      400,
      200,
    );
    expect(result.estimated).toBe(true);
    expect(result.promptTokens).toBe(100); // 400 chars / 4
    expect(result.outputTokens).toBe(50); // 200 chars / 4
  });
});
