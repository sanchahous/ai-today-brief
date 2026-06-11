import { describe, expect, it } from 'vitest';
import { blueskyPostToArticle, blueskyPostUrl } from './bluesky';

const post = (over: Record<string, unknown> = {}) => ({
  uri: 'at://did:plc:abc/app.bsky.feed.post/3kxyz',
  author: { handle: 'dev.bsky.social' },
  record: { createdAt: '2026-06-11T08:00:00Z', text: 'Great writeup on MCP servers' },
  embed: {
    $type: 'app.bsky.embed.external#view',
    external: { uri: 'https://example.com/mcp-guide', title: 'MCP servers in production' },
  },
  likeCount: 42,
  repostCount: 8,
  replyCount: 5,
  ...over,
});

describe('blueskyPostUrl', () => {
  it('builds the bsky.app permalink from the AT uri', () => {
    expect(blueskyPostUrl('at://did:plc:abc/app.bsky.feed.post/3kxyz', 'dev.bsky.social')).toBe(
      'https://bsky.app/profile/dev.bsky.social/post/3kxyz',
    );
    expect(blueskyPostUrl('at://did:plc:abc/app.bsky.feed.like/3kxyz', 'dev')).toBeNull();
  });
});

describe('blueskyPostToArticle', () => {
  it('maps a linking post onto the engagement lane', () => {
    const a = blueskyPostToArticle(post())!;
    expect(a.source_name).toBe('Bluesky');
    expect(a.url).toBe('https://example.com/mcp-guide');
    expect(a.title).toBe('MCP servers in production');
    expect(a.source_url).toBe('https://bsky.app/profile/dev.bsky.social/post/3kxyz');
    expect(a.reddit_score).toBe(50); // likes + reposts
    expect(a.reddit_comments).toBe(5);
    expect(a.published_at).toBe('2026-06-11T08:00:00.000Z');
  });

  it('falls back to the post text when the link card has no title', () => {
    const a = blueskyPostToArticle(
      post({
        embed: { external: { uri: 'https://example.com/x', title: '' } },
      }),
    )!;
    expect(a.title).toBe('Great writeup on MCP servers');
  });

  it('rejects chatter without an external link and malformed posts', () => {
    expect(blueskyPostToArticle(post({ embed: {} }))).toBeNull();
    expect(
      blueskyPostToArticle(post({ embed: { external: { uri: 'https://bsky.app/profile/x' } } })),
    ).toBeNull();
    expect(blueskyPostToArticle(post({ record: { createdAt: 'nope' } }))).toBeNull();
    expect(blueskyPostToArticle(null)).toBeNull();
  });
});
