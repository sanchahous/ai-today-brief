/**
 * Telegram webhook — handles per-item review decisions from the founder's
 * private chat. Two update types are processed:
 *
 *   callback_query  → button press (✅ approve / ❌ reject / 🚀 publish)
 *   message         → text reply to a force-reply rejection prompt (reason)
 *
 * Security:
 *   • X-Telegram-Bot-Api-Secret-Token header (TELEGRAM_WEBHOOK_SECRET)
 *   • Only the configured admin user id may trigger actions (TELEGRAM_ADMIN_USER_ID)
 *
 * Idempotent: Telegram may re-deliver updates — item and brief status updates
 * use explicit `where review_status = 'pending'` / `where status = 'draft'` guards.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  approvedBanner,
  buildRejectPrompt,
  decorateCard,
  extractItemIdFromPrompt,
  formatBriefSummary,
  parseCallbackData,
  publishedBanner,
  publishKeyboard,
  rejectedBanner,
} from '@/lib/telegram-webhook';

// ─── Telegram Bot API ─────────────────────────────────────────────────────────

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function tg(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  return res.json();
}

async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await tg('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: false } : {}),
  });
}

async function editText(
  chatId: string,
  messageId: number,
  html: string,
  replyMarkup?: object,
): Promise<void> {
  await tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : { reply_markup: { inline_keyboard: [] } }),
  });
}

async function sendMsg(
  chatId: string,
  html: string,
  extra: Record<string, unknown> = {},
): Promise<number | null> {
  const r = (await tg('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  })) as { ok?: boolean; result?: { message_id?: number } };
  return r?.result?.message_id ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** After all items are decided, send the summary + optional 🚀 button. */
async function maybeSendSummary(
  db: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
  chatId: string,
): Promise<void> {
  // Any pending items left?
  const { count } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'pending');
  if ((count ?? 1) > 0) return;

  const { data: brief } = await db
    .from('briefs')
    .select('title_en, title_uk')
    .eq('id', briefId)
    .single();

  const { count: approved } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'approved');

  const { count: rejected } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'rejected');

  const approvedN = approved ?? 0;
  const title = brief?.title_uk ?? brief?.title_en ?? '–';

  const text = formatBriefSummary({ approved: approvedN, rejected: rejected ?? 0, title });
  const keyboard = publishKeyboard(briefId, approvedN);
  await sendMsg(chatId, text, Object.keys(keyboard).length ? { reply_markup: keyboard } : {});
}

/** Revalidate the public site after publish. */
async function revalidateSite(): Promise<void> {
  const paths = ['/', '/en', '/uk', '/en/news', '/uk/news', '/sitemap.xml', '/rss.xml', '/news-sitemap.xml'];
  for (const p of paths) revalidatePath(p);
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleApprove(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  reviewerStr: string,
  chatId: string,
): Promise<string> {
  // 1. Update item state (idempotent guard: only if still pending)
  const { data: item, error } = await db
    .from('brief_items')
    .update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewerStr })
    .eq('id', itemId)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, review_msg_id, category_slug')
    .single();

  if (error || !item) return 'Вже опрацьовано або не знайдено.';

  // 2. Log to item_reviews dataset
  await db.from('item_reviews').insert({
    brief_id: item.brief_id,
    brief_item_id: itemId,
    action: 'approved',
    reviewer: reviewerStr,
    category_slug: item.category_slug,
    title_en: item.title_en,
    summary_en: item.summary_en,
  });

  // 3. Edit the Telegram card (add ✅ banner, remove buttons)
  if (item.review_msg_id) {
    const original = buildCardText(item);
    await editText(chatId, item.review_msg_id, decorateCard(original, approvedBanner()));
  }

  // 4. Check if all items reviewed
  await maybeSendSummary(db, item.brief_id, chatId);
  return '✅ Схвалено';
}

async function handleRejectInit(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  chatId: string,
  callbackQueryId: string,
): Promise<void> {
  const { data: item } = await db
    .from('brief_items')
    .select('title_uk, title_en')
    .eq('id', itemId)
    .single();

  const title = item?.title_uk ?? item?.title_en ?? 'item';
  const promptText = buildRejectPrompt(title, itemId);
  await sendMsg(chatId, promptText, { reply_markup: { force_reply: true, selective: true } });
  await answerCallback(callbackQueryId, 'Напиши причину відхилення 👇');
}

async function handleRejectReason(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  reason: string,
  reviewerStr: string,
  chatId: string,
): Promise<void> {
  const { data: item, error } = await db
    .from('brief_items')
    .update({
      review_status: 'rejected',
      review_comment: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerStr,
    })
    .eq('id', itemId)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, summary_en, category_slug, review_msg_id')
    .single();

  if (error || !item) return;

  await db.from('item_reviews').insert({
    brief_id: item.brief_id,
    brief_item_id: itemId,
    action: 'rejected',
    comment: reason,
    reviewer: reviewerStr,
    category_slug: item.category_slug,
    title_en: item.title_en,
    summary_en: item.summary_en,
  });

  // Edit original card
  if (item.review_msg_id) {
    const { data: full } = await db
      .from('brief_items')
      .select('title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, category_slug')
      .eq('id', itemId)
      .single();
    if (full) {
      await editText(chatId, item.review_msg_id, decorateCard(buildCardText(full), rejectedBanner(reason)));
    }
  }

  await maybeSendSummary(db, item.brief_id, chatId);
}

async function handlePublish(
  db: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
  chatId: string,
  msgId: number,
): Promise<string> {
  const { data: brief, error } = await db
    .from('briefs')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', briefId)
    .eq('status', 'draft')
    .select('title_en, title_uk')
    .single();

  if (error || !brief) return 'Брифінг вже опублікований або не знайдено.';

  const { count: approved } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'approved');

  const title = brief.title_uk ?? brief.title_en ?? '–';
  await editText(chatId, msgId, publishedBanner(title, approved ?? 0));
  await revalidateSite();
  return '🚀 Опубліковано!';
}

// ─── Card text builder (must match pipeline/review-format.ts output shape) ────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildCardText(item: {
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string | null;
  why_matters_en: string | null;
  why_matters_uk: string | null;
  category_slug: string | null;
}): string {
  const titleUk = escHtml(item.title_uk ?? item.title_en ?? '(untitled)');
  const titleEn = escHtml(item.title_en ?? '');
  const summary  = escHtml(item.summary_uk ?? item.summary_en);
  const why      = item.why_matters_uk ?? item.why_matters_en;
  const cat      = escHtml(item.category_slug ?? 'uncategorized');
  const lines = [`<b>${cat}</b>`, `<b>${titleUk}</b>`, `<i>${titleEn}</i>`, '', summary];
  if (why) lines.push('', `💡 ${escHtml(why)}`);
  return lines.join('\n');
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // Security: verify webhook secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== webhookSecret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  let update: Record<string, unknown>;
  try {
    update = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID?.trim();
  const chatId = process.env.TELEGRAM_REVIEW_CHAT_ID?.trim();
  if (!chatId) return NextResponse.json({ ok: true }); // not configured

  const db = getSupabaseAdmin();

  try {
    // ── callback_query (button press) ────────────────────────────────────────
    const cq = update.callback_query as Record<string, unknown> | undefined;
    if (cq) {
      const from = cq.from as Record<string, unknown> | undefined;
      const userId = String(from?.id ?? '');
      if (adminUserId && userId !== adminUserId) {
        await answerCallback(String(cq.id), '⛔ Not authorised');
        return NextResponse.json({ ok: true });
      }

      const data    = String(cq.data ?? '');
      const msgId   = (cq.message as Record<string, unknown> | undefined)?.message_id as number | undefined;
      const parsed  = parseCallbackData(data);
      const reviewer = `tg:${userId}`;

      if (!parsed) {
        await answerCallback(String(cq.id));
        return NextResponse.json({ ok: true });
      }

      if (parsed.action === 'approve') {
        const msg = await handleApprove(db, parsed.id, reviewer, chatId);
        await answerCallback(String(cq.id), msg);
      } else if (parsed.action === 'reject') {
        await handleRejectInit(db, parsed.id, chatId, String(cq.id));
      } else if (parsed.action === 'publish' && msgId) {
        const msg = await handlePublish(db, parsed.id, chatId, msgId);
        await answerCallback(String(cq.id), msg);
      }
      return NextResponse.json({ ok: true });
    }

    // ── message (force_reply reply = rejection reason) ────────────────────────
    const msg = update.message as Record<string, unknown> | undefined;
    if (msg) {
      const from   = msg.from as Record<string, unknown> | undefined;
      const userId = String(from?.id ?? '');
      if (adminUserId && userId !== adminUserId) return NextResponse.json({ ok: true });

      const replyTo = msg.reply_to_message as Record<string, unknown> | undefined;
      if (!replyTo) return NextResponse.json({ ok: true });

      const promptText = String((replyTo.text as string | undefined) ?? '');
      const itemId     = extractItemIdFromPrompt(promptText);
      if (!itemId) return NextResponse.json({ ok: true });

      const reason   = String((msg.text as string | undefined) ?? '').trim();
      if (!reason) return NextResponse.json({ ok: true });
      const reviewer = `tg:${userId}`;
      await handleRejectReason(db, itemId, reason, reviewer, chatId);
    }
  } catch (err) {
    // Log but always return 200 so Telegram doesn't retry indefinitely
    console.error('[telegram/webhook]', err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true });
}
