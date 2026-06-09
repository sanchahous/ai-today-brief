import { describe, expect, it } from 'vitest';
import {
  callbackData,
  cardDivider,
  decoratedAfterDecision,
  escapeHtml,
  formatBatchHeader,
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
    // strong card-start divider with N/M counter
    expect(msg).toContain('🟡');
    expect(msg).toContain('<b>3/6</b>');
    expect(msg).toContain('🗂 <b>agents-and-mcp</b>');
    expect(msg).toContain('📰 <b>Новий MCP-сервер для Postgres</b>');
    expect(msg).toContain('<i>New MCP server for Postgres</i>');
    expect(msg).toContain('Сервер, що підключає агентів до бази даних.');
    expect(msg).toContain('💡 <b>Навіщо:</b> Підключи агента до продакшн-бази.');
    expect(msg).toContain('<a href="https://ex.com/mcp">Hacker News</a>');
  });
  it('starts with the divider line so cards never blur together', () => {
    const msg = formatItemMessage(item, 1, 7);
    expect(msg.startsWith('🟡')).toBe(true);
  });
  it('falls back to EN content when UK fields are absent', () => {
    const msg = formatItemMessage(
      { ...item, summary_uk: null, why_matters_uk: null },
      1, 1,
    );
    expect(msg).toContain('A server that connects agents to a database.');
    expect(msg).toContain('💡 <b>Навіщо:</b> Wire your agent to prod data.');
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

describe('cardDivider', () => {
  it('embeds the position/total counter', () => {
    expect(cardDivider(2, 7)).toContain('<b>2/7</b>');
    expect(cardDivider(2, 7)).toContain('🟡');
  });
});

describe('formatBatchHeader', () => {
  it('announces the brief with date, title and card count', () => {
    const h = formatBatchHeader({ date: '2026-06-05', total: 7, title: 'AI Today' });
    expect(h).toContain("РЕВ'Ю БРИФУ");
    expect(h).toContain('2026-06-05');
    expect(h).toContain('AI Today');
    expect(h).toContain('7 карток');
  });
  it('uses correct Ukrainian plural for 1 / 2 / 5 cards', () => {
    expect(formatBatchHeader({ date: 'd', total: 1 })).toContain('1 картка');
    expect(formatBatchHeader({ date: 'd', total: 3 })).toContain('3 картки');
    expect(formatBatchHeader({ date: 'd', total: 5 })).toContain('5 карток');
  });
  it('omits the title line when no title is given', () => {
    const h = formatBatchHeader({ date: 'd', total: 2 });
    expect(h).not.toContain('🗞');
  });

  it('includes the progón label when provided', () => {
    const h = formatBatchHeader({ date: '2026-06-09', total: 3, cycleLabel: '08:00–10:30' });
    expect(h).toContain('Прогін 08:00–10:30');
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
