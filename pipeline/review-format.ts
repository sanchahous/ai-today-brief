/**
 * Pure helpers for the Telegram per-item review: the message text, the inline
 * keyboard, and the `callback_data` contract shared with the webhook handler.
 * No IO here — unit-tested.
 */

export interface ReviewItem {
  id: string;
  rank: number;
  category_slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  why_matters_en: string | null;
  source_name: string | null;
  url: string | null;
}

export interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

export type ReviewAction = 'approve' | 'reject';

const APPROVE_PREFIX = 'ap:';
const REJECT_PREFIX = 'rj:';

/** Telegram caps callback_data at 64 bytes; `<prefix><uuid>` is 39 — safe. */
export function callbackData(action: ReviewAction, itemId: string): string {
  return (action === 'approve' ? APPROVE_PREFIX : REJECT_PREFIX) + itemId;
}

export function parseCallbackData(data: string): { action: ReviewAction; itemId: string } | null {
  if (data.startsWith(APPROVE_PREFIX)) return { action: 'approve', itemId: data.slice(APPROVE_PREFIX.length) };
  if (data.startsWith(REJECT_PREFIX)) return { action: 'reject', itemId: data.slice(REJECT_PREFIX.length) };
  return null;
}

export function reviewKeyboard(itemId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: callbackData('approve', itemId) },
        { text: '❌ Reject', callback_data: callbackData('reject', itemId) },
      ],
    ],
  };
}

/** Escape the five characters Telegram's HTML parse mode treats specially. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One review card (Telegram HTML parse mode). `position`/`total` are 1-based. */
export function formatItemMessage(item: ReviewItem, position: number, total: number): string {
  const titleEn = escapeHtml(item.title_en ?? '(untitled)');
  const titleUk = escapeHtml(item.title_uk ?? titleEn);
  const category = escapeHtml(item.category_slug ?? 'uncategorized');
  const summary = escapeHtml(item.summary_en);
  const lines = [
    `<b>[${position}/${total}] · ${category}</b>`,
    `🇬🇧 ${titleEn}`,
    `🇺🇦 ${titleUk}`,
    '',
    summary,
  ];
  if (item.why_matters_en) lines.push('', `<i>Why it matters:</i> ${escapeHtml(item.why_matters_en)}`);
  if (item.url) {
    const src = escapeHtml(item.source_name ?? 'source');
    lines.push('', `🔗 <a href="${escapeHtml(item.url)}">${src}</a>`);
  }
  return lines.join('\n');
}

/** The message text after a decision — original card with a status line, no buttons. */
export function decoratedAfterDecision(
  original: string,
  action: ReviewAction,
  comment?: string,
): string {
  const head = action === 'approve' ? '✅ <b>APPROVED</b>' : '❌ <b>REJECTED</b>';
  const reason = action === 'reject' && comment ? `\n💬 ${escapeHtml(comment)}` : '';
  return `${head}${reason}\n\n${original}`;
}
