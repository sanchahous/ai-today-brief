/**
 * Minimal Telegram Bot API client (network IO — excluded from coverage).
 * Used by the notify stage to deliver per-item review cards. Returns are kept
 * narrow (message id / boolean) so callers don't depend on the raw payload.
 */

import { logError, logEvent } from './log';
import type { InlineKeyboard } from './review-format';

const API = 'https://api.telegram.org';

async function tgRequest(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

/** Send an HTML message; returns the new message_id, or null on failure. */
export async function sendMessage(
  token: string,
  chatId: string,
  html: string,
  replyMarkup?: InlineKeyboard,
): Promise<number | null> {
  try {
    const json = await tgRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    if (!json.ok) {
      logEvent('warn', 'notify', 'Telegram sendMessage rejected', { description: json.description });
      return null;
    }
    const result = json.result as { message_id?: number } | undefined;
    return result?.message_id ?? null;
  } catch (e) {
    logError('notify', 'Telegram sendMessage failed', e);
    return null;
  }
}
