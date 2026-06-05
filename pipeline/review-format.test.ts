import { describe, expect, it } from 'vitest';
import {
  callbackData,
  decoratedAfterDecision,
  escapeHtml,
  formatItemMessage,
  parseCallbackData,
  reviewKeyboard,
  type ReviewItem,
} from './review-format';

const item: ReviewItem = {
  id: 'abc-123',
  rank: 3,
  category_slug: 'agents-and-mcp',
  title_en: 'New MCP server for Postgres',
  title_uk: 'Новий MCP-сервер для Postgres',
  summary_en: 'A server that connects agents to a database.',
  summary_uk: 'Сервер, що підключає агентів до бази даних.',
  why_matters_en: 'Wire your agent to prod data.',
  why_matters_uk: 'Підключи агента до продакшн-бази.',
  source_name: 'Hacker News',
  url: 'https://ex.com/mcp',
};

describe('callback data contract', () => {
  it('round-trips approve/reject with the item id', () => {
    expect(parseCallbackData(callbackData('approve', 'abc-123'))).toEqual({
      action: 'approve',
      itemId: 'abc-123',
    });
    expect(parseCallbackData(callbackData('reject', 'abc-123'))).toEqual({
      action: 'reject',
      itemId: 'abc-123',
    });
  });
  it('stays within Telegram’s 64-byte cap for a uuid', () => {
    expect(callbackData('reject', '123e4567-e89b-12d3-a456-426614174000').length).toBeLessThanOrEqual(64);
  });
  it('rejects unknown callback payloads', () => {
    expect(parseCallbackData('nonsense')).toBeNull();
  });
});

describe('reviewKeyboard', () => {
  it('has one row with approve + reject buttons', () => {
    const kb = reviewKeyboard('abc-123');
    expect(kb.inline_keyboard).toHaveLength(1);
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    expect(kb.inline_keyboard[0]![0]!.callback_data).toBe('ap:abc-123');
  });
});

describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('formatItemMessage', () => {
  it('shows Ukrainian content as primary: UK title bold, EN title italic', () => {
    const msg = formatItemMessage(item, 3, 6);
    expect(msg).toContain('[3/6] · agents-and-mcp');
    expect(msg).toContain('<b>Новий MCP-сервер для Postgres</b>');
    expect(msg).toContain('<i>New MCP server for Postgres</i>');
    expect(msg).toContain('Сервер, що підключає агентів до бази даних.');
    expect(msg).toContain('💡 Підключи агента до продакшн-бази.');
    expect(msg).toContain('<a href="https://ex.com/mcp">Hacker News</a>');
  });
  it('falls back to EN content when UK fields are absent', () => {
    const msg = formatItemMessage(
      { ...item, summary_uk: null, why_matters_uk: null },
      1, 1,
    );
    expect(msg).toContain('A server that connects agents to a database.');
    expect(msg).toContain('💡 Wire your agent to prod data.');
  });
  it('omits why/link lines when those fields are absent', () => {
    const msg = formatItemMessage(
      { ...item, why_matters_en: null, why_matters_uk: null, url: null },
      1, 1,
    );
    expect(msg).not.toContain('💡');
    expect(msg).not.toContain('🔗');
  });
});

describe('decoratedAfterDecision', () => {
  it('prefixes an approved banner', () => {
    expect(decoratedAfterDecision('CARD', 'approve')).toContain('✅ <b>APPROVED</b>');
  });
  it('prefixes a rejected banner with the reason', () => {
    const out = decoratedAfterDecision('CARD', 'reject', 'too thin');
    expect(out).toContain('❌ <b>REJECTED</b>');
    expect(out).toContain('💬 too thin');
  });
});
