/**
 * One-shot: push pending review cards for an existing brief to Telegram.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/notify-brief.ts <brief-id>
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { notifyReview } from '../notify';
import { logEvent, logError } from '../log';

async function main(): Promise<void> {
  const briefId = process.argv[2];
  if (!briefId) {
    console.error('Usage: notify-brief.ts <brief-id>');
    process.exit(1);
  }

  const config = loadPipelineConfig();
  if (!config.telegramBotToken || !config.telegramReviewChatId) {
    console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_REVIEW_CHAT_ID must be set');
    process.exit(1);
  }

  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  logEvent('info', 'notify', 'Re-sending review cards', { brief_id: briefId });
  const result = await notifyReview(db, config.telegramBotToken, config.telegramReviewChatId, briefId);
  logEvent('info', 'notify', 'Done', result);
}

main().catch((e) => { logError('notify', 'Failed', e); process.exit(1); });
