import { describe, expect, it } from 'vitest';
import {
  approvedBanner,
  buildRejectPrompt,
  buildTakePrompt,
  decorateCard,
  extractItemIdFromPrompt,
  formatBriefSummary,
  parseCallbackData,
  publishCallbackData,
  publishedBanner,
  rejectedBanner,
  replyActionFromPrompt,
} from './telegram-webhook';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('parseCallbackData', () => {
  it('parses all five action prefixes', () => {
    expect(parseCallbackData(`ap:${UUID}`)).toEqual({ action: 'approve', id: UUID });
    expect(parseCallbackData(`rj:${UUID}`)).toEqual({ action: 'reject',  id: UUID });
    expect(parseCallbackData(`rd:${UUID}`)).toEqual({ action: 'redo',    id: UUID });
    expect(parseCallbackData(`tk:${UUID}`)).toEqual({ action: 'take',    id: UUID });
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

describe('buildTakePrompt / replyActionFromPrompt', () => {
  it('round-trips the item id and is recognized as a take prompt', () => {
    const prompt = buildTakePrompt('Заголовок', UUID);
    expect(extractItemIdFromPrompt(prompt)).toBe(UUID);
    expect(replyActionFromPrompt(prompt)).toBe('take');
  });
  it('classifies reject prompts and ignores foreign messages', () => {
    expect(replyActionFromPrompt(buildRejectPrompt('Т', UUID))).toBe('reject');
    expect(replyActionFromPrompt('random message')).toBeNull();
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

  it('includes pack edition and read link when provided', () => {
    const text = formatBriefSummary({
      approved: 2,
      rejected: 0,
      title: 'Afternoon',
      edition: 2,
      readUrl: 'https://aitodaybrief.com/uk/lead-topic',
    });
    expect(text).toContain('Пак <b>2</b>');
    expect(text).toContain('Читати бриф на сайті');
    expect(text).toContain('lead-topic');
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
