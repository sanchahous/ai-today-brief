import { describe, expect, it } from 'vitest';
import {
  CATEGORY_SLUGS,
  categoryForTitle,
  DEFAULT_CATEGORY,
  detectTopic,
  GENERAL_TOPIC,
  isCategorySlug,
} from './topics';

describe('detectTopic', () => {
  it('tags by the first specific product match', () => {
    expect(detectTopic('Claude Code adds subagents')).toBe('claude');
    expect(detectTopic('Cursor 2.0 released')).toBe('cursor');
    expect(detectTopic('New MCP server for Postgres')).toBe('mcp');
  });
  it('falls back to general', () => {
    expect(detectTopic('A quiet day in software')).toBe(GENERAL_TOPIC);
  });
});

describe('categoryForTitle', () => {
  it('maps headlines onto product categories', () => {
    expect(categoryForTitle('A practical guide to prompt caching')).toBe('tutorials-and-guides');
    expect(categoryForTitle('Vibe coding a SaaS in a weekend')).toBe('vibe-coding');
    expect(categoryForTitle('New MCP server connects agents to Slack')).toBe('agents-and-mcp');
    expect(categoryForTitle('Cut token costs with prompt caching')).toBe('optimization');
    expect(categoryForTitle('Run Llama locally with Ollama')).toBe('local-llms');
    expect(categoryForTitle('Sora generates video from text')).toBe('creative-ai');
    expect(categoryForTitle('How to monetize your AI side hustle')).toBe('career-and-money');
    expect(categoryForTitle('New benchmark paper on fine-tuning')).toBe('models-and-research');
  });
  it('defaults to tools-and-releases', () => {
    expect(categoryForTitle('Anthropic announces a new API')).toBe(DEFAULT_CATEGORY);
    expect(DEFAULT_CATEGORY).toBe('tools-and-releases');
  });
  it('returns only known slugs', () => {
    for (const t of ['random', 'Claude ships', 'guide to agents', 'cheap tokens']) {
      expect(CATEGORY_SLUGS).toContain(categoryForTitle(t));
    }
  });
});

describe('isCategorySlug', () => {
  it('narrows known slugs and rejects others', () => {
    expect(isCategorySlug('optimization')).toBe(true);
    expect(isCategorySlug('not-a-category')).toBe(false);
    expect(isCategorySlug(42)).toBe(false);
    expect(isCategorySlug(null)).toBe(false);
  });
});
