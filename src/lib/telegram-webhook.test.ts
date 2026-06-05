import { describe, expect, it } from 'vitest';
import {
  approvedBanner,
  buildRejectPrompt,
  decorateCard,
  extractItemIdFromPrompt,
  formatBriefSummary,
  parseCallbackData,
  publishCallbackData,
  publishedBanner,
  rejectedBanner,
} from './telegram-webhook';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('parseCallbackData', () => {
  it('parses all three action prefixes', () => {
    expect(parseCallbackData(`ap:${UUID}`)).toEqual({ action: 'approve', id: UUID });
    expect(parseCallbackData(`rj:${UUID}`)).toEqual({ action: 'reject',  id: UUID });
    expect(parseCallbackData(`pub:${UUID}`)).toEqual({ action: 'publish', id: UUID });
  });
  it('returns null for unknown payloads', () => {
    expect(parseCallbackData('garbage')).toBeNull();
  });
});

describe('publishCallbackData', () => {
  it('produces a parseable publish payload', () => {
    expect(parseCallbackData(publishCallbackData(UUID))).toEqual({ action: 'publish', id: UUID });
  });
});

describe('buildRejectPrompt / extractItemIdFromPrompt', () => {
  it('round-trips the item id through the prompt text', () => {
    const prompt = buildRejectPrompt('Заголовок', UUID);
    expect(extractItemIdFromPrompt(prompt)).toBe(UUID);
  });
  it('returns null when there is no marker line', () => {
    expect(extractItemIdFromPrompt('Just some text')).toBeNull();
  });
  it('returns null when the id does not match uuid format', () => {
    expect(extractItemIdFromPrompt('🔑 not-a-uuid')).toBeNull();
  });
});

describe('card decorators', () => {
  it('approvedBanner wraps content with approved header', () => {
    const out = decorateCard('ORIGINAL', approvedBanner());
    expect(out).toContain('✅');
    expect(out).toContain('СХВАЛЕНО');
    expect(out).toContain('ORIGINAL');
  });
  it('rejectedBanner includes the reason and escapes HTML', () => {
    const banner = rejectedBanner('<script>');
    expect(banner).toContain('ВІДХИЛЕНО');
    expect(banner).toContain('&lt;script&gt;');
  });
});

describe('formatBriefSummary', () => {
  it('shows counts and title', () => {
    const text = formatBriefSummary({ approved: 5, rejected: 2, title: 'AI Today' });
    expect(text).toContain('5');
    expect(text).toContain('2');
    expect(text).toContain('AI Today');
    expect(text).toContain('🚀');
  });
  it('shows a warning when nothing is approved', () => {
    const text = formatBriefSummary({ approved: 0, rejected: 3, title: 'X' });
    expect(text).toContain('⚠️');
    expect(text).not.toContain('🚀');
  });
});

describe('publishedBanner', () => {
  it('includes the title and count', () => {
    const text = publishedBanner('AI Today', 4);
    expect(text).toContain('Опубліковано');
    expect(text).toContain('AI Today');
    expect(text).toContain('4');
  });
});
