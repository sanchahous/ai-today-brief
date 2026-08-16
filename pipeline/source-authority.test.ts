import { describe, expect, it } from 'vitest';
import {
  hostOf,
  hostTrust,
  isAggregatorFeed,
  isDiscussionHost,
  publisherAuthority,
  sourceTrust,
} from './source-authority';

describe('sourceTrust', () => {
  it('keeps the feed-level table the daily composite depends on', () => {
    expect(sourceTrust('Anthropic')).toBe(1);
    expect(sourceTrust('Hacker News')).toBe(0.9);
    expect(sourceTrust('Lobsters')).toBe(0.85);
    expect(sourceTrust('Mastodon')).toBe(0.55);
    expect(sourceTrust('Some Random Blog')).toBe(0.6);
  });
});

describe('isAggregatorFeed', () => {
  it('separates feeds that link out from feeds that publish', () => {
    expect(isAggregatorFeed('Hacker News')).toBe(true);
    expect(isAggregatorFeed('Lobsters')).toBe(true);
    expect(isAggregatorFeed('X (Twitter)')).toBe(true);
    expect(isAggregatorFeed('Hugging Face Blog')).toBe(false);
    expect(isAggregatorFeed('Simon Willison')).toBe(false);
  });
});

describe('hostOf / isDiscussionHost', () => {
  it('normalises hosts and flags discussion venues', () => {
    expect(hostOf('https://WWW.Example.com/path')).toBe('example.com');
    expect(hostOf('not a url')).toBeNull();
    expect(isDiscussionHost('news.ycombinator.com')).toBe(true);
    expect(isDiscussionHost('mastodon.social')).toBe(true);
    expect(isDiscussionHost('huggingface.co')).toBe(false);
  });
});

describe('publisherAuthority', () => {
  it('judges the destination when the feed is an aggregator', () => {
    // The bug this module exists for: both of these arrived as "Hacker News"
    // and both inherited 0.9.
    expect(publisherAuthority('Hacker News', 'https://openai.com/index/ultrafast')).toBe(1);
    expect(publisherAuthority('Hacker News', 'https://sankalp.bearblog.dev/232x/')).toBe(0.45);
    expect(publisherAuthority('Hacker News', 'https://pssah4.github.io/vault/')).toBe(0.45);
    expect(publisherAuthority('Hacker News', 'https://twitter.com/dev/status/1')).toBe(0.35);
  });

  it('falls back to the neutral tier for an unknown destination', () => {
    expect(publisherAuthority('Hacker News', 'https://pillar.security/blog/deadbugz')).toBe(0.6);
  });

  it('trusts the feed name when the feed is the publisher', () => {
    expect(publisherAuthority('NVIDIA Blog', 'https://developer.nvidia.com/blog/qwen')).toBe(1);
    expect(publisherAuthority('Simon Willison', 'https://simonwillison.net/2026/llm')).toBe(0.9);
    expect(publisherAuthority('TechCrunch', 'https://techcrunch.com/2026/writer')).toBe(0.75);
  });

  it('reads code hosting as the primary artifact of a tool release', () => {
    expect(hostTrust('github.com')).toBe(0.85);
    expect(publisherAuthority('Hacker News', 'https://github.com/org/privaite')).toBe(0.85);
  });
});
