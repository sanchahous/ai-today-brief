/**
 * Stage 5 (optional) — Notify for review. Pushes each still-pending brief item
 * to the founder's private Telegram chat as its own card with ✅/❌ buttons.
 * Stores the Telegram message id so a re-run won't double-send and the webhook
 * can edit the card after a decision.
 */

import { getBriefMeta, getPendingReviewItems, setReviewMsgId, type PipelineDb } from './db';
import { sendMessage } from './telegram';
import { formatBatchHeader, formatItemMessage, reviewKeyboard } from './review-format';
import { logEvent } from './log';

export interface NotifyResult {
  sent: number;
  failed: number;
}

export interface NotifyReviewOptions {
  /** Optional progón label for the batch header (e.g. "08:00–10:30"). */
  cycleLabel?: string;
}

export async function notifyReview(
  db: PipelineDb,
  token: string,
  chatId: string,
  briefId: string,
  options: NotifyReviewOptions = {},
): Promise<NotifyResult> {
  const items = await getPendingReviewItems(db, briefId);
  if (items.length === 0) {
    logEvent('info', 'notify', 'No pending items to push for review', { brief_id: briefId });
    return { sent: 0, failed: 0 };
  }

  const meta = await getBriefMeta(db, briefId);
  if (meta) {
    await sendMessage(
      token,
      chatId,
      formatBatchHeader({
        date: meta.date,
        total: items.length,
        title: meta.title,
        cycleLabel: options.cycleLabel,
      }),
    );
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const text = formatItemMessage(item, i + 1, items.length);
    const msgId = await sendMessage(token, chatId, text, reviewKeyboard(item.id));
    if (msgId === null) {
      failed++;
      continue;
    }
    await setReviewMsgId(db, item.id, msgId);
    sent++;
  }

  logEvent('info', 'notify', 'Review cards pushed to Telegram', {
    brief_id: briefId,
    sent,
    failed,
    total: items.length,
  });
  return { sent, failed };
}
