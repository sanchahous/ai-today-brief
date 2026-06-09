/**
 * One-shot: push pending review cards for an existing brief to Telegram.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/notify-brief.ts <brief-id> [--resend]
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { notifyReview } from '../notify';
import { logEvent, logError } from '../log';

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--resend');
  const resend = process.argv.includes('--resend');
  const briefId = args[0];
  if (!briefId) {
    console.error('Usage: notify-brief.ts <brief-id> [--resend]');
    process.exit(1);
  }

  const config = loadPipelineConfig();
  if (!config.telegramBotToken || !config.telegramReviewChatId) {
    console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_REVIEW_CHAT_ID must be set');
    process.exit(1);
  }

  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  logEvent('info', 'notify', resend ? 'Re-sending all pending review cards' : 'Sending pending review cards', {
    brief_id: briefId,
    resend,
  });
  const result = await notifyReview(
    db,
    config.telegramBotToken,
    config.telegramReviewChatId,
    briefId,
    { resend },
  );
  logEvent('info', 'notify', 'Done', { ...result });
}

main().catch((e) => { logError('notify', 'Failed', e); process.exit(1); });
