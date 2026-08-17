import { describe, expect, it } from 'vitest';
import {
  isEmbedFalsePositive,
  isReaderToolOwnershipChange,
  isStaleNewsUrl,
  newsUrlPathYear,
  sameOwnershipEvent,
  storyShape,
  titleEntityIds,
} from './reader-tools';

const CURSOR_BLOG = 'Cursor is now a part of SpaceX';
const TECHCRUNCH_CLOSE = 'SpaceX just bought Cursor for $60 billion';
const ENGADGET_CLOSE = 'SpaceX has acquired coding AI startup Cursor';
const REUTERS_ANNOUNCE = 'SpaceX to buy Cursor for $60B';
const GROK_BOT = 'Cursor and SpaceXAI launch Grok Bot for work beyond coding';
const CURSOR_0DAY = 'Cursor 0day Executes Arbitrary Code via Workspace git.exe';
const CONTINUE_DEAL = 'Cursor acquires Continue, an open-source Copilot alternative';
const FUNDING = 'Anysphere raises $60M as Cursor clarifies plans';
const RUMOR_ITEM = 'Anysphere Secures 60 Million Dollars as Cursor Editor Clarifies Acquisition Rumors';

describe('isReaderToolOwnershipChange', () => {
  it('keeps Cursor/SpaceX ownership headlines', () => {
    expect(isReaderToolOwnershipChange(CURSOR_BLOG)).toBe(true);
    expect(isReaderToolOwnershipChange(TECHCRUNCH_CLOSE)).toBe(true);
    expect(isReaderToolOwnershipChange(ENGADGET_CLOSE)).toBe(true);
    expect(isReaderToolOwnershipChange(REUTERS_ANNOUNCE)).toBe(true);
    expect(isReaderToolOwnershipChange('SpaceX officially closes its Cursor acquisition')).toBe(
      true,
    );
  });

  it('does not treat funding, rumors, launches or 0days as ownership', () => {
    expect(isReaderToolOwnershipChange(FUNDING)).toBe(false);
    expect(isReaderToolOwnershipChange(RUMOR_ITEM)).toBe(false);
    expect(isReaderToolOwnershipChange(GROK_BOT)).toBe(false);
    expect(isReaderToolOwnershipChange(CURSOR_0DAY)).toBe(false);
    expect(isReaderToolOwnershipChange('Anthropic files confidential S-1 for IPO')).toBe(false);
    expect(isReaderToolOwnershipChange('OpenAI is losing billions of dollars a year')).toBe(false);
  });
});

describe('sameOwnershipEvent', () => {
  it('clusters the August 2026 Cursor close across verbs', () => {
    expect(sameOwnershipEvent(CURSOR_BLOG, TECHCRUNCH_CLOSE)).toBe(true);
    expect(sameOwnershipEvent(CURSOR_BLOG, ENGADGET_CLOSE)).toBe(true);
    expect(sameOwnershipEvent(REUTERS_ANNOUNCE, TECHCRUNCH_CLOSE)).toBe(true);
  });

  it('does not merge a different Cursor deal or a Cursor+SpaceX launch', () => {
    expect(sameOwnershipEvent(CURSOR_BLOG, CONTINUE_DEAL)).toBe(false);
    expect(sameOwnershipEvent(CURSOR_BLOG, GROK_BOT)).toBe(false);
    expect(sameOwnershipEvent(CURSOR_BLOG, CURSOR_0DAY)).toBe(false);
  });

  it('requires two shared entities', () => {
    expect([...titleEntityIds(CURSOR_BLOG)]).toEqual(expect.arrayContaining(['cursor', 'spacex']));
    expect(sameOwnershipEvent('Cursor has been acquired', 'SpaceX bought an AI startup')).toBe(
      false,
    );
  });
});

describe('storyShape', () => {
  it('labels the Cursor deal, 0day and Grok launch as different shapes', () => {
    expect(storyShape(CURSOR_BLOG)).toBe('ownership');
    expect(storyShape(RUMOR_ITEM)).toBe('rumor');
    expect(storyShape(CURSOR_0DAY)).toBe('security');
    expect(storyShape(GROK_BOT)).toBe('release');
    expect(storyShape(FUNDING)).toBe('funding');
  });
});

describe('isEmbedFalsePositive', () => {
  it('keeps a close after a rumor-denial item', () => {
    expect(
      isEmbedFalsePositive({
        candidateTitle: CURSOR_BLOG,
        publishedTitle: RUMOR_ITEM,
        publishedDate: '2026-06-16',
        candidateDate: '2026-08-14',
      }),
    ).toBe(true);
  });

  it('keeps an August close after a June announce', () => {
    expect(
      isEmbedFalsePositive({
        candidateTitle: CURSOR_BLOG,
        publishedTitle: REUTERS_ANNOUNCE,
        publishedDate: '2026-06-16',
        candidateDate: '2026-08-14',
      }),
    ).toBe(true);
  });

  it('keeps a 0day that cosine-matched an acquisition', () => {
    expect(
      isEmbedFalsePositive({
        candidateTitle: CURSOR_BLOG,
        publishedTitle: CURSOR_0DAY,
        publishedDate: '2026-07-15',
        candidateDate: '2026-08-14',
      }),
    ).toBe(true);
  });

  it('still treats two close-window ownership rewrites as the same event', () => {
    expect(
      isEmbedFalsePositive({
        candidateTitle: TECHCRUNCH_CLOSE,
        publishedTitle: CURSOR_BLOG,
        publishedDate: '2026-08-14',
        candidateDate: '2026-08-15',
      }),
    ).toBe(false);
  });
});

describe('stale news URLs', () => {
  it('reads a year from a TechCrunch path and flags 2024 in 2026', () => {
    const url =
      'https://techcrunch.com/2024/08/23/cursor-the-ai-powered-code-editor-raises-60m-series-a-at-400m-valuation/';
    expect(newsUrlPathYear(url)).toBe(2024);
    expect(isStaleNewsUrl(url, new Date('2026-08-16T00:00:00Z'))).toBe(true);
    expect(
      isStaleNewsUrl(
        'https://techcrunch.com/2026/08/15/spacex-officially-closes-its-cursor-acquisition/',
        new Date('2026-08-16T00:00:00Z'),
      ),
    ).toBe(false);
  });
});
