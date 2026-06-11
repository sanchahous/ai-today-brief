import { describe, expect, it } from 'vitest';
import { looksUkrainian, ukQualityFlags } from './lang-check';

describe('looksUkrainian', () => {
  it('accepts natural Ukrainian tech copy with Latin product names', () => {
    expect(looksUkrainian('OpenRouter збільшує безкоштовний ліміт до 1000 запитів')).toBe(true);
    expect(looksUkrainian('Claude Code 2.0 вийшов')).toBe(true);
    expect(looksUkrainian('Анонс нової моделі')).toBe(true);
  });

  it('rejects English, empty and Russian-specific text', () => {
    expect(looksUkrainian('OpenRouter raises the free tier limit')).toBe(false);
    expect(looksUkrainian('')).toBe(false);
    expect(looksUkrainian('   ')).toBe(false);
    expect(looksUkrainian('Эта новость вышла сегодня')).toBe(false);
  });

  it('rejects mostly-Latin text with a token Cyrillic word', () => {
    expect(
      looksUkrainian('Anthropic ships a brand new developer-focused агент'),
    ).toBe(false);
  });

  it('accepts product-heavy short titles in presence-only mode', () => {
    expect(looksUkrainian('OpenAI Codex CLI 2.0 вийшов', { minShare: 0 })).toBe(true);
    expect(looksUkrainian('OpenAI Codex CLI 2.0 ships', { minShare: 0 })).toBe(false);
  });
});

describe('ukQualityFlags', () => {
  const base = {
    title_en: 'Claude Code ships hooks',
    title_uk: 'Claude Code отримує хуки',
    summary_en: 'A new hooks system landed.',
    summary_uk: 'Зʼявилась нова система хуків для автоматизації.',
    deep_dive_en: 'Hooks let you run scripts on lifecycle events.',
    deep_dive_uk: 'Хуки дозволяють запускати скрипти на події життєвого циклу.',
  };

  it('returns no flags for a fully Ukrainian item', () => {
    expect(ukQualityFlags(base)).toEqual([]);
  });

  it('flags fields that fell back to English', () => {
    expect(
      ukQualityFlags({ ...base, title_uk: base.title_en, deep_dive_uk: base.deep_dive_en }),
    ).toEqual(['title_uk', 'deep_dive_uk']);
  });

  it('skips fields whose EN counterpart is empty too', () => {
    expect(ukQualityFlags({ ...base, deep_dive_en: '', deep_dive_uk: '' })).toEqual([]);
  });
});
