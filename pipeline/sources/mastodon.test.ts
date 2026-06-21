import { describe, expect, it } from 'vitest';
import { mastodonStatusToArticle, stripHtml } from './mastodon';

const status = (over: Record<string, unknown> = {}) => ({
  url: 'https://fosstodon.org/@dev/123',
  created_at: '2026-06-21T08:00:00.000Z',
  content: '<p>New MCP server for Postgres, give it a try</p>',
  card: { url: 'https://example.com/mcp-postgres', title: 'mcp-postgres v0.5' },
  favourites_count: 30,
  reblogs_count: 12,
  replies_count: 4,
  reblog: null,
  ...over,
});

describe('stripHtml', () => {
  it('removes tags and entities and collapses whitespace', () => {
    expect(stripHtml('<p>Hello&nbsp;&amp; <strong>world</strong></p>')).toBe('Hello & world');
  });
});

describe('mastodonStatusToArticle', () => {
  it('maps a status with a link card onto the engagement lane', () => {
    const a = mastodonStatusToArticle(status())!;
    expect(a.source_name).toBe('Mastodon');
    expect(a.url).toBe('https://example.com/mcp-postgres');
    expect(a.title).toBe('mcp-postgres v0.5');
    expect(a.source_url).toBe('https://fosstodon.org/@dev/123');
    expect(a.reddit_score).toBe(42); // favourites + reblogs → velocity lane
    expect(a.reddit_comments).toBe(4);
    expect(a.published_at).toBe('2026-06-21T08:00:00.000Z');
  });

  it('falls back to stripped post text when the card has no title', () => {
    const a = mastodonStatusToArticle(status({ card: { url: 'https://example.com/x', title: '' } }))!;
    expect(a.title).toBe('New MCP server for Postgres, give it a try');
  });

  it('skips boosts, cardless chatter, and malformed rows', () => {
    expect(mastodonStatusToArticle(status({ reblog: { id: '9' } }))).toBeNull();
    expect(mastodonStatusToArticle(status({ card: null }))).toBeNull();
    expect(mastodonStatusToArticle(status({ card: { url: 'not-a-url' } }))).toBeNull();
    expect(mastodonStatusToArticle(status({ created_at: 'nope' }))).toBeNull();
    expect(mastodonStatusToArticle(null)).toBeNull();
  });
});
