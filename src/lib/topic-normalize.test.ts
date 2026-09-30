import { describe, expect, it } from 'vitest';
import {
  MAX_TOPIC_FILTERS,
  MAX_TOPIC_SLUG_LENGTH,
  normalizeTopic,
  parseTopicParam,
  resolveTopicNames,
  topicKey,
  topicSlugs,
  topicsFromTools,
} from './topic-normalize';

describe('topicKey', () => {
  it('keeps only lowercase letters and digits', () => {
    expect(topicKey('Claude Code')).toBe('claudecode');
    expect(topicKey('  GPT-5.6  Sol ')).toBe('gpt56sol');
    expect(topicKey('llama.cpp')).toBe('llamacpp');
  });

  it('keeps non-latin letters', () => {
    expect(topicKey('Штучний інтелект')).toBe('штучнийінтелект');
  });

  it('does not collapse C++ and C# into C', () => {
    expect(topicKey('C++')).toBe('cplusplus');
    expect(topicKey('C#')).toBe('csharp');
    expect(topicKey('C')).toBe('c');
  });
});

describe('normalizeTopic', () => {
  it('folds "Claude Code", "claude-code" and "ClaudeCode" into one topic', () => {
    const variants = ['Claude Code', 'claude-code', 'ClaudeCode', '  claude   code ', 'CLAUDE_CODE'];
    const slugs = new Set(variants.map((v) => normalizeTopic(v)?.slug));
    expect(slugs).toEqual(new Set(['claudecode']));
  });

  it('keeps the trimmed, space-collapsed spelling as the display name', () => {
    expect(normalizeTopic('  vLLM ')).toEqual({ slug: 'vllm', name: 'vLLM' });
    expect(normalizeTopic('Hugging   Face')).toEqual({ slug: 'huggingface', name: 'Hugging Face' });
  });

  it('maps aliases to one canonical topic', () => {
    expect(normalizeTopic('Model Context Protocol')).toEqual({ slug: 'mcp', name: 'MCP' });
    expect(normalizeTopic('mcp')).toEqual({ slug: 'mcp', name: 'MCP' });
    expect(normalizeTopic('OpenAI Codex')).toEqual({ slug: 'codex', name: 'Codex' });
    expect(normalizeTopic('Opus 4.8')).toEqual({ slug: 'claudeopus48', name: 'Claude Opus 4.8' });
    expect(normalizeTopic('Postgres')).toEqual({ slug: 'postgresql', name: 'PostgreSQL' });
  });

  it('does not merge different products that only share a word', () => {
    const slugs = ['Claude', 'Claude Code', 'Claude Opus 5', 'Codex CLI', 'Copilot', 'GitHub Copilot'].map(
      (v) => normalizeTopic(v)?.slug,
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('rejects non-strings, empty values, punctuation only and absurdly long input', () => {
    expect(normalizeTopic(null)).toBeNull();
    expect(normalizeTopic(undefined)).toBeNull();
    expect(normalizeTopic(42)).toBeNull();
    expect(normalizeTopic({ name: 'Cursor' })).toBeNull();
    expect(normalizeTopic('')).toBeNull();
    expect(normalizeTopic('   ')).toBeNull();
    expect(normalizeTopic('---')).toBeNull();
    expect(normalizeTopic('a'.repeat(MAX_TOPIC_SLUG_LENGTH + 1))).toBeNull();
    expect(normalizeTopic('a'.repeat(MAX_TOPIC_SLUG_LENGTH))).not.toBeNull();
  });
});

describe('topicsFromTools / topicSlugs', () => {
  it('de-duplicates by slug, first spelling wins, order kept', () => {
    expect(topicsFromTools(['Cursor', 'claude-code', 'Claude Code', 'CURSOR'])).toEqual([
      { slug: 'cursor', name: 'Cursor' },
      { slug: 'claudecode', name: 'claude-code' },
    ]);
  });

  it('collapses an alias and its canonical name inside one item', () => {
    expect(topicSlugs(['Codex', 'OpenAI Codex', 'Cursor'])).toEqual(['codex', 'cursor']);
  });

  it('skips unusable entries', () => {
    expect(topicSlugs(['', '   ', '***', 'MCP'])).toEqual(['mcp']);
    expect(topicSlugs([])).toEqual([]);
  });
});

describe('parseTopicParam', () => {
  it('reads comma-separated and repeated values into canonical slugs', () => {
    expect(parseTopicParam(['claude-code,Cursor', 'Model Context Protocol'])).toEqual([
      'claudecode',
      'cursor',
      'mcp',
    ]);
  });

  it('drops empty pieces and duplicates', () => {
    expect(parseTopicParam(['cursor,,Cursor, ', '---'])).toEqual(['cursor']);
    expect(parseTopicParam([])).toEqual([]);
  });

  it('caps the number of values a URL can carry', () => {
    const many = Array.from({ length: MAX_TOPIC_FILTERS + 5 }, (_, i) => `tool${i}`).join(',');
    expect(parseTopicParam([many])).toHaveLength(MAX_TOPIC_FILTERS);
  });
});

describe('resolveTopicNames', () => {
  it('uses the most frequent spelling, first seen on a tie', () => {
    const names = resolveTopicNames([['VLLM'], ['vLLM'], ['vLLM'], ['Cursor'], ['cursor']]);
    expect(names.get('vllm')).toBe('vLLM');
    expect(names.get('cursor')).toBe('Cursor');
  });

  it('gives aliased tools their canonical name', () => {
    const names = resolveTopicNames([['Model Context Protocol'], ['MCP']]);
    expect(names.get('mcp')).toBe('MCP');
  });

  it('counts a spelling once per item', () => {
    const names = resolveTopicNames([['Zed', 'zed', 'zed'], ['Zed']]);
    expect(names.get('zed')).toBe('Zed');
  });

  it('is empty without data', () => {
    expect(resolveTopicNames([]).size).toBe(0);
    expect(resolveTopicNames([[], []]).size).toBe(0);
  });
});
