import { describe, expect, it } from 'vitest';
import {
  dedupeSlugs,
  jaccard,
  jaro,
  normaliseTitle,
  slugify,
  titleTokens,
  titlesSimilar,
} from './text';

describe('normaliseTitle', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normaliseTitle('  Claude 3.5: NEW!!  Sonnet  ')).toBe('claude 3 5 new sonnet');
  });
});

describe('jaro', () => {
  it('is 1 for identical strings and 0 for empty', () => {
    expect(jaro('cursor', 'cursor')).toBe(1);
    expect(jaro('', 'x')).toBe(0);
  });
  it('is high for near-identical and low for unrelated', () => {
    expect(jaro('martha', 'marhta')).toBeGreaterThan(0.9);
    expect(jaro('cursor', 'banana')).toBeLessThan(0.6);
  });
});

describe('titleTokens / jaccard', () => {
  it('drops stopwords and short tokens', () => {
    expect(titleTokens('The new Claude is on GitHub')).toEqual(new Set(['claude', 'github']));
  });
  it('jaccard overlap of token sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('titlesSimilar', () => {
  it('matches reworded same-event headlines via tokens', () => {
    expect(
      titlesSimilar(
        'Anthropic releases Claude Opus 4.8 with faster output',
        'Claude Opus 4.8 released by Anthropic, output is faster',
      ),
    ).toBe(true);
  });
  it('separates unrelated stories', () => {
    expect(titlesSimilar('Cursor 2.0 ships agent mode', 'Mistral raises a funding round')).toBe(
      false,
    );
  });
});

describe('slugify', () => {
  it('ascii-folds, dashes, lowercases and trims', () => {
    expect(slugify('Cursor 2.0 & Token Tactics!')).toBe('cursor-2-0-token-tactics');
  });
  it('truncates to 80 chars without a trailing dash', () => {
    const slug = slugify('a'.repeat(50) + ' ' + 'b'.repeat(50));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('falls back when nothing ascii survives (e.g. Cyrillic title)', () => {
    expect(slugify('Новини штучного інтелекту', 'brief')).toBe('brief');
  });
});

describe('dedupeSlugs', () => {
  it('suffixes collisions and preserves order', () => {
    expect(dedupeSlugs(['a', 'b', 'a', 'a', 'c'])).toEqual(['a', 'b', 'a-2', 'a-3', 'c']);
  });
});
