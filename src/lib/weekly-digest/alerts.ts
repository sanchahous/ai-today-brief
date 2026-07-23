import 'server-only';

import { SITE_URL } from '@/lib/site';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function alertWeeklyDigestIssue(input: {
  weeklyDigestId: string;
  phase: 'generation' | 'preflight' | 'release';
  message: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_REVIEW_CHAT_ID?.trim();
  if (!token || !chatId) return;
  const adminUrl = new URL(`/admin/weekly/${input.weeklyDigestId}`, SITE_URL).toString();
  const message = input.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 1200);

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          `<b>Weekly Digest ${escapeHtml(input.phase)} needs attention</b>\n` +
          `${escapeHtml(message)}\n<a href="${adminUrl}">Open edition</a>`,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // The primary failure remains recorded in PostgreSQL. A secondary alert
    // channel must never change the worker outcome or retry semantics.
  }
}
