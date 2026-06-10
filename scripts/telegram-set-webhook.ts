/**
 * Register Telegram webhook with message + callback_query updates.
 * Usage: npx tsx --env-file=.env.local scripts/telegram-set-webhook.ts
 *
 * Required env: TELEGRAM_BOT_TOKEN, SITE_URL (or pass WEBHOOK_URL), TELEGRAM_WEBHOOK_SECRET (optional)
 */

export {};

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const siteUrl = process.env.SITE_URL?.trim() ?? process.env.NEXT_PUBLIC_SITE_URL?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const webhookUrl = process.env.WEBHOOK_URL?.trim() ?? (siteUrl ? `${siteUrl.replace(/\/$/, '')}/api/telegram` : '');
if (!webhookUrl.startsWith('https://')) {
  console.error('Set SITE_URL or WEBHOOK_URL to your production /api/telegram URL');
  process.exit(1);
}

const body: Record<string, unknown> = {
  url: webhookUrl,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false,
};
if (secret) body.secret_token = secret;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };

if (!json.ok) {
  console.error('setWebhook failed:', json.description ?? json);
  process.exit(1);
}

console.log('Webhook set:', webhookUrl);
console.log('allowed_updates: message, callback_query');

const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const info = (await infoRes.json()) as { result?: { url?: string; allowed_updates?: string[] } };
console.log('Current:', info.result?.url, info.result?.allowed_updates);
