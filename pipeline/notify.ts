/**
 * Stage 5 (optional) — Notify for review. Pushes each still-pending brief item
 * to the founder's private Telegram chat as its own card with ✅/❌ buttons, one
 * at a time (some items get approved, some rejected). Stores the Telegram
 * message id so a re-run won't double-send and the webhook can edit the card
 * after a decision. The decisions themselves are handled by the webhook (Phase 2).
 *
 * Network IO — excluded from coverage; the message/keyboard builders in
 * `review-format.ts` are unit-tested.
 */

import { getBriefMeta, getPendingReviewItems, setReviewMsgId, type PipelineDb } from './db';
import { sendMessage } from './telegram';
import { formatBatchHeader, formatItemMessage, reviewKeyboard } from './review-format';
import { logEvent } from './log';

export interface NotifyResult {
  sent: number;
  failed: number;
}

export async function notifyReview(
  db: PipelineDb,
  token: string,
  chatId: string,
  briefId: string,
): Promise<NotifyResult> {
  const items = await getPendingReviewItems(db, briefId);
  if (items.length === 0) {
    logEvent('info', 'notify', 'No pending items to push for review', { brief_id: briefId });
    return { sent: 0, failed: 0 };
  }

  // Batch header: a single announce message so the reviewer sees a NEW review
  // stream is starting (and how many cards to expect) — breaks the chat clutter.
  const meta = await getBriefMeta(db, briefId);
  if (meta) {
    await sendMessage(
      token,
      chatId,
      formatBatchHeader({ date: meta.date, total: items.length, title: meta.title }),
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
