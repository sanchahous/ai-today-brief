/**
 * Pure helpers for the Telegram webhook (no IO, unit-tested).
 *
 * Mirrors the callback_data contract from pipeline/review-format.ts — must stay
 * in sync. pipeline/ is never imported from src/, so the ~10-line contract is
 * intentionally duplicated here (it's a string prefix, not logic).
 */

export type ReviewAction = 'approve' | 'reject';
export type WebhookAction = ReviewAction | 'publish';

// ─── Callback data ────────────────────────────────────────────────────────────

const APPROVE_PREFIX = 'ap:';
const REJECT_PREFIX  = 'rj:';
const PUBLISH_PREFIX = 'pub:';

export function parseCallbackData(
  data: string,
): { action: WebhookAction; id: string } | null {
  if (data.startsWith(APPROVE_PREFIX)) return { action: 'approve', id: data.slice(APPROVE_PREFIX.length) };
  if (data.startsWith(REJECT_PREFIX))  return { action: 'reject',  id: data.slice(REJECT_PREFIX.length) };
  if (data.startsWith(PUBLISH_PREFIX)) return { action: 'publish', id: data.slice(PUBLISH_PREFIX.length) };
  return null;
}

export function publishCallbackData(briefId: string): string {
  return PUBLISH_PREFIX + briefId;
}

// ─── Force-reply prompt (encodes item id so it can be parsed from the reply) ──

const ITEM_ID_MARKER = '🔑';

/**
 * The message that asks for a rejection reason. The item id is embedded on its
 * own line so `extractItemIdFromPrompt` can recover it from `reply_to_message`.
 */
export function buildRejectPrompt(title: string, itemId: string): string {
  return `❌ Причина відхилення:\n«${title}»\n${ITEM_ID_MARKER} ${itemId}`;
}

/** Extract the item id from the text of the force-reply prompt message. */
export function extractItemIdFromPrompt(text: string): string | null {
  const line = text.split('\n').find((l) => l.startsWith(ITEM_ID_MARKER));
  if (!line) return null;
  const candidate = line.slice(ITEM_ID_MARKER.length).trim();
  // Validate uuid4 shape (loose)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

// ─── Edited card decorators ───────────────────────────────────────────────────

export function approvedBanner(): string {
  return '✅ ▔▔▔▔▔ <b>СХВАЛЕНО</b> ▔▔▔▔▔';
}

export function rejectedBanner(comment: string): string {
  return `❌ ▔▔▔▔▔ <b>ВІДХИЛЕНО</b> ▔▔▔▔▔\n💬 ${escHtml(comment)}`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function decorateCard(originalHtml: string, banner: string): string {
  return `${banner}\n\n${originalHtml}`;
}

// ─── Brief summary message + 🚀 publish keyboard ─────────────────────────────

export interface BriefSummary {
  approved: number;
  rejected: number;
  title: string;
}

export function formatBriefSummary(s: BriefSummary): string {
  return (
    '━━━━━━━━━━━━━━━━━\n' +
    `📋 <b>Рев'ю завершено</b>\n` +
    `🗞 «${escHtml(s.title)}»\n` +
    '━━━━━━━━━━━━━━━━━\n\n' +
    `✅ Схвалено: <b>${s.approved}</b>\n` +
    `❌ Відхилено: <b>${s.rejected}</b>\n\n` +
    (s.approved > 0
      ? 'Натисни 🚀 щоб опублікувати схвалені матеріали.'
      : '⚠️ Жодного схваленого матеріалу — брифінг не публікується.')
  );
}

export function publishKeyboard(briefId: string, approvedCount: number): object {
  if (approvedCount === 0) return {};
  return {
    inline_keyboard: [[
      { text: `🚀 Опублікувати (${approvedCount})`, callback_data: publishCallbackData(briefId) },
    ]],
  };
}

export function publishedBanner(title: string, approvedCount: number): string {
  return `🚀 <b>Опубліковано: «${escHtml(title)}»</b>\n✅ ${approvedCount} матеріалів на сайті.`;
}
