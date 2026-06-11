import { describe, expect, it } from 'vitest';
import { canonicalSourceName } from './source-names';

describe('canonicalSourceName', () => {
  it('maps every production variant onto its canonical name', () => {
    expect(canonicalSourceName('HackerNews')).toBe('Hacker News');
    expect(canonicalSourceName('x.com')).toBe('X (Twitter)');
    expect(canonicalSourceName('X.com')).toBe('X (Twitter)');
    expect(canonicalSourceName('Youtube')).toBe('YouTube');
    expect(canonicalSourceName('Github')).toBe('GitHub');
    expect(canonicalSourceName('Nvidia Blog')).toBe('NVIDIA Blog');
    expect(canonicalSourceName('NVIDIA Blog')).toBe('NVIDIA Blog');
    expect(canonicalSourceName('HuggingFace')).toBe('Hugging Face Blog');
    expect(canonicalSourceName('Hugging Face')).toBe('Hugging Face Blog');
    expect(canonicalSourceName('TheVerge AI')).toBe('The Verge');
    expect(canonicalSourceName('TechReview')).toBe('MIT Technology Review');
    expect(canonicalSourceName('Google Deepmind Blog')).toBe('DeepMind Blog');
    expect(canonicalSourceName('artificialintelligence-news.com')).toBe('AI News');
  });

  it('keeps already-canonical and unknown names as-is', () => {
    expect(canonicalSourceName('Hacker News')).toBe('Hacker News');
    expect(canonicalSourceName('Reddit · r/LocalLLaMA')).toBe('Reddit · r/LocalLLaMA');
    expect(canonicalSourceName('OpenRouter Documentation')).toBe('OpenRouter Documentation');
    expect(canonicalSourceName('Some Random Blog')).toBe('Some Random Blog');
  });

  it('normalizes whitespace and falls back for empty input', () => {
    expect(canonicalSourceName('  Hacker   News ')).toBe('Hacker News');
    expect(canonicalSourceName('   ')).toBe('Unknown');
  });
});
