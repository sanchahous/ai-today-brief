import { describe, expect, it } from 'vitest';
import {
  buildOAuth1Header,
  formatTelegramPost,
  formatXPost,
  percentEncode,
  selectTopStory,
  type RepostCandidate,
} from './social-repost';

const candidate = (over: Partial<RepostCandidate> = {}): RepostCandidate => ({
  id: 'a',
  title_en: 'Claude Code 3.0 ships subagent orchestration',
  title_uk: 'Claude Code 3.0 отримав оркестрацію сабагентів',
  social_hook_en: 'Claude Code 3.0 just shipped subagent orchestration — here is what changes for your workflow.',
  social_hook_uk: 'Claude Code 3.0 отримав оркестрацію сабагентів — ось що зміниться у вашому workflow.',
  summary_en: 'Anthropic released Claude Code 3.0. It adds orchestration.',
  summary_uk: 'Anthropic випустила Claude Code 3.0. Додано оркестрацію.',
  impact_level: 'medium',
  briefSlug: 'brief-2026-06-11',
  itemSlug: 'claude-code-3',
  date: '2026-06-11',
  rank: 2,
  ...over,
});

describe('selectTopStory', () => {
  it('prefers impact, then freshness, then editor rank', () => {
    const low = candidate({ id: 'low', impact_level: 'low', rank: 1 });
    const highOld = candidate({ id: 'high-old', impact_level: 'high', date: '2026-06-10' });
    const highNewR2 = candidate({ id: 'high-new-2', impact_level: 'high', rank: 2 });
    const highNewR1 = candidate({ id: 'high-new-1', impact_level: 'high', rank: 1 });
    expect(selectTopStory([low, highOld, highNewR2, highNewR1])?.id).toBe('high-new-1');
  });

  it('excludes already-posted ids and returns null when empty', () => {
    const a = candidate({ id: 'a' });
    const b = candidate({ id: 'b', rank: 5 });
    expect(selectTopStory([a, b], new Set(['a']))?.id).toBe('b');
    expect(selectTopStory([a], new Set(['a']))).toBeNull();
    expect(selectTopStory([])).toBeNull();
  });
});

describe('formatXPost', () => {
  it('uses the hook link-free and puts the URL in the reply', () => {
    const { text, reply } = formatXPost(candidate(), 'https://aitodaybrief.com');
    expect(text).toContain('subagent orchestration');
    expect(text).not.toContain('http');
    expect(reply).toBe('Full brief → https://aitodaybrief.com/en/brief-2026-06-11/claude-code-3');
  });

  it('falls back to the title and trims to 280 chars', () => {
    const long = candidate({ social_hook_en: 'x'.repeat(300) });
    expect(formatXPost(long, 'https://s.com').text).toHaveLength(280);
    const noHook = candidate({ social_hook_en: null });
    expect(formatXPost(noHook, 'https://s.com').text).toBe(noHook.title_en);
  });
});

describe('formatTelegramPost', () => {
  it('builds UK-first HTML with the item link and escaped text', () => {
    const html = formatTelegramPost(
      candidate({ title_uk: 'Реліз <Fable> & агенти', social_hook_uk: null }),
      'https://aitodaybrief.com',
    );
    expect(html).toContain('https://aitodaybrief.com/uk/brief-2026-06-11/claude-code-3');
    expect(html).toContain('Реліз &lt;Fable&gt; &amp; агенти');
    expect(html).toContain('Anthropic випустила Claude Code 3.0.');
    expect(html).not.toContain('<Fable>');
  });
});

describe('percentEncode', () => {
  it('applies strict RFC 3986 encoding', () => {
    expect(percentEncode("Hello Ladies + Gentlemen, a signed OAuth request!")).toBe(
      'Hello%20Ladies%20%2B%20Gentlemen%2C%20a%20signed%20OAuth%20request%21',
    );
  });
});

describe('buildOAuth1Header', () => {
  // The canonical worked example from X's "Creating a signature" docs
  // (docs.x.com → OAuth 1.0a → Creating a signature, api.x.com variant).
  it('reproduces the documented X API example signature', () => {
    const header = buildOAuth1Header(
      'POST',
      'https://api.x.com/1.1/statuses/update.json',
      {
        consumerKey: 'xvz1evFS4wEEPTGEFPHBog',
        consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
        accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
        accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
      },
      'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
      '1318622958',
      {
        status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
        include_entities: 'true',
      },
    );
    expect(header).toContain('oauth_signature="Ls93hJiZbQ3akF3HF3x1Bz8%2FzU4%3D"');
    expect(header.startsWith('OAuth ')).toBe(true);
    expect(header).toContain('oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog"');
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
  });

  it('signs JSON-body requests with oauth params only', () => {
    const header = buildOAuth1Header(
      'POST',
      'https://api.x.com/2/tweets',
      {
        consumerKey: 'ck',
        consumerSecret: 'cs',
        accessToken: 'at',
        accessSecret: 'as',
      },
      'nonce',
      '1700000000',
    );
    expect(header).toMatch(/^OAuth oauth_consumer_key="ck", oauth_nonce="nonce", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1700000000", oauth_token="at", oauth_version="1\.0"$/);
  });
});
