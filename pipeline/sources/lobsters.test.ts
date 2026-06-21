import { describe, expect, it } from 'vitest';
import { lobstersStoryToArticle } from './lobsters';

const story = (over: Record<string, unknown> = {}) => ({
  short_id: 'abc123',
  title: 'ZML: compile a model straight to metal',
  url: 'https://example.com/zml',
  comments_url: 'https://lobste.rs/s/abc123',
  created_at: '2026-06-21T08:00:00.000-04:00',
  score: 42,
  comment_count: 13,
  tags: ['ai'],
  ...over,
});

describe('lobstersStoryToArticle', () => {
  it('maps a linking story onto the engagement lane', () => {
    const a = lobstersStoryToArticle(story())!;
    expect(a.source_name).toBe('Lobsters');
    expect(a.url).toBe('https://example.com/zml');
    expect(a.title).toBe('ZML: compile a model straight to metal');
    expect(a.source_url).toBe('https://lobste.rs/s/abc123');
    expect(a.reddit_score).toBe(42); // upvotes → velocity lane
    expect(a.reddit_comments).toBe(13);
    expect(a.published_at).toBe('2026-06-21T12:00:00.000Z'); // -04:00 normalised to UTC
  });

  it('falls back to the story url when comments_url is absent', () => {
    const a = lobstersStoryToArticle(story({ comments_url: undefined }))!;
    expect(a.source_url).toBe('https://example.com/zml');
  });

  it('skips text-only posts (no external url) and malformed rows', () => {
    expect(lobstersStoryToArticle(story({ url: '' }))).toBeNull();
    expect(lobstersStoryToArticle(story({ url: undefined }))).toBeNull();
    expect(lobstersStoryToArticle(story({ title: '' }))).toBeNull();
    expect(lobstersStoryToArticle(story({ created_at: 'nope' }))).toBeNull();
    expect(lobstersStoryToArticle(null)).toBeNull();
  });

  it('defaults missing engagement counts to zero', () => {
    const a = lobstersStoryToArticle(story({ score: undefined, comment_count: undefined }))!;
    expect(a.reddit_score).toBe(0);
    expect(a.reddit_comments).toBe(0);
  });
});
