/**
 * Telegram webhook — handles per-item review decisions from the founder's
 * private chat. Two update types are processed:
 *
 *   callback_query  → button press (✅ approve / ❌ reject / 🚀 publish)
 *   message         → /custom editor hand-pick, or force-reply rejection reason
 *
 * Security:
 *   • X-Telegram-Bot-Api-Secret-Token header (TELEGRAM_WEBHOOK_SECRET)
 *   • Only the configured admin user id may trigger actions (TELEGRAM_ADMIN_USER_ID)
 *
 * Idempotent: Telegram may re-deliver updates — item and brief status updates
 * use explicit `where review_status = 'pending'` / `where status = 'draft'` guards.
 *
 * Perf note: answerCallbackQuery is ALWAYS called first (before any DB or Telegram
 * API calls). This dismisses Telegram's loading spinner immediately. Side-effects
 * (card edit, summary send) run after — slower, but the user already has feedback.
 */

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { formatCustomNewsError, parseCustomCommand } from '@/lib/telegram-custom';
import { LANGS, SITE_URL } from '@/lib/site';
import { indexNowConfigured, submitToIndexNow } from '@/lib/indexnow';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  approvedBanner,
  buildRejectPrompt,
  buildTakePrompt,
  decorateCard,
  extractItemIdFromPrompt,
  formatBriefSummary,
  parseCallbackData,
  publishedBanner,
  publishKeyboard,
  redoneBanner,
  rejectedBanner,
  replyActionFromPrompt,
} from '@/lib/telegram-webhook';

// ─── Telegram Bot API ─────────────────────────────────────────────────────────

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/** Calls Telegram Bot API. Never throws — returns { ok: false } on any error. */
async function tg(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${TG}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error(`[tg/${method}] network error:`, err instanceof Error ? err.message : String(err));
    return { ok: false };
  }
}

/** Acknowledges a callback query — call THIS FIRST to dismiss the loading spinner. */
async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await tg('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: false } : {}),
  });
}

/** Edit an existing message text + keyboard. Logs on Telegram error, never throws. */
async function editText(
  chatId: string,
  messageId: number,
  html: string,
  replyMarkup?: object,
): Promise<void> {
  const r = await tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : { reply_markup: { inline_keyboard: [] } }),
  });
  if (!r.ok) {
    console.error(`[editText] msg=${messageId} error:`, r.description ?? r.error_code ?? 'unknown');
  }
}

/** Send a new message. Returns the Telegram message_id or null on failure. */
async function sendMsg(
  chatId: string,
  html: string,
  extra: Record<string, unknown> = {},
): Promise<number | null> {
  const r = await tg('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
  if (!r.ok) {
    console.error('[sendMsg] error:', r.description ?? r.error_code ?? 'unknown');
    return null;
  }
  return (r.result as Record<string, unknown> | undefined)?.message_id as number ?? null;
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
    .select('title_en, title_uk, edition, date')
    .eq('id', briefId)
    .single();

  const { data: lead } = await db
    .from('briefs')
    .select('slug')
    .eq('date', brief?.date ?? '')
    .eq('edition', 1)
    .maybeSingle();

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

  const readUrl = lead?.slug ? `${SITE_URL}/uk/${lead.slug}` : undefined;
  const text = formatBriefSummary({
    approved: approvedN,
    rejected: rejected ?? 0,
    title,
    edition: brief?.edition,
    readUrl,
  });
  const keyboard = publishKeyboard(briefId, approvedN);
  await sendMsg(chatId, text, Object.keys(keyboard).length ? { reply_markup: keyboard } : {});
}

/** Revalidate the public site after publish. */
async function revalidateSite(): Promise<void> {
  const paths = ['/', '/en', '/uk', '/en/news', '/uk/news', '/sitemap.xml', '/rss.xml', '/news-sitemap.xml'];
  for (const p of paths) revalidatePath(p);
}

/**
 * Best-effort IndexNow ping for a freshly published brief. Submits the brief +
 * its approved item pages (both languages) and the feeds that just changed, so
 * Bing/Yandex — and via Bing, ChatGPT Search / Copilot (AEO) — recrawl within
 * minutes instead of waiting for the next sitemap sweep. No-op without a key;
 * never throws (submitToIndexNow swallows errors).
 */
async function pingIndexNow(
  db: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
  briefSlug: string | null,
): Promise<void> {
  if (!indexNowConfigured || !briefSlug) return;

  const { data: items } = await db
    .from('brief_items')
    .select('slug')
    .eq('brief_id', briefId)
    .eq('review_status', 'approved')
    .is('canonical_item_id', null);

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/news-sitemap.xml`,
    ...LANGS.flatMap((lang) => [
      `${SITE_URL}/${lang}`,
      `${SITE_URL}/${lang}/news`,
      `${SITE_URL}/${lang}/${briefSlug}`,
    ]),
  ];
  for (const item of items ?? []) {
    if (!item.slug) continue;
    for (const lang of LANGS) urls.push(`${SITE_URL}/${lang}/${briefSlug}/${item.slug}`);
  }

  const result = await submitToIndexNow(urls);
  if (!result.ok && !result.skipped) {
    console.warn(
      `[indexnow] brief=${briefId} ping not ok — status=${result.status ?? '-'}, submitted=${result.submitted}`,
    );
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleApprove(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  reviewerStr: string,
  chatId: string,
): Promise<void> {
  // 1. Update item state (idempotent guard: only if still pending)
  const { data: item, error } = await db
    .from('brief_items')
    .update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewerStr })
    .eq('id', itemId)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, review_msg_id, category_slug')
    .single();

  if (error || !item) {
    console.log('[approve] already processed or not found:', itemId);
    return;
  }

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

  // 4. Check if all items reviewed → send summary
  await maybeSendSummary(db, item.brief_id, chatId);
}

/** Send force-reply prompt asking for rejection reason. */
async function handleRejectInit(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  chatId: string,
): Promise<void> {
  const { data: item } = await db
    .from('brief_items')
    .select('title_uk, title_en')
    .eq('id', itemId)
    .single();

  const title = item?.title_uk ?? item?.title_en ?? 'item';
  const promptText = buildRejectPrompt(title, itemId);
  // force_reply opens the reply bar automatically in the Telegram app
  await sendMsg(chatId, promptText, { reply_markup: { force_reply: true } });
}

/** Send force-reply prompt asking for the editor's take. */
async function handleTakeInit(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  chatId: string,
): Promise<void> {
  const { data: item } = await db
    .from('brief_items')
    .select('title_uk, title_en')
    .eq('id', itemId)
    .single();

  const title = item?.title_uk ?? item?.title_en ?? 'item';
  await sendMsg(chatId, buildTakePrompt(title, itemId), {
    reply_markup: { force_reply: true },
  });
}

/**
 * Save the editor's take. Allowed at any review state — the take is the
 * human-verdict paragraph on the article page, not a review decision — and a
 * later reply simply replaces the previous take.
 */
async function handleEditorTake(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  take: string,
  chatId: string,
): Promise<void> {
  const { data: item, error } = await db
    .from('brief_items')
    .update({ editor_take: take })
    .eq('id', itemId)
    .select('brief_id, slug, title_uk, title_en')
    .single();

  if (error || !item) {
    await sendMsg(chatId, '⚠️ Матеріал не знайдено — тейк не збережено.');
    return;
  }

  // If the brief is already live, refresh the item pages so the take shows up.
  const { data: brief } = await db
    .from('briefs')
    .select('slug, status')
    .eq('id', item.brief_id)
    .maybeSingle();
  if (brief?.status === 'published' && brief.slug && item.slug) {
    revalidatePath(`/en/${brief.slug}/${item.slug}`);
    revalidatePath(`/uk/${brief.slug}/${item.slug}`);
  }

  const title = item.title_uk ?? item.title_en ?? '–';
  await sendMsg(chatId, `✍️ <b>Тейк збережено</b>\n«${escHtml(title)}»`);
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

  // Edit original card with ❌ banner
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

/**
 * 🔁 "redo rendition": hard-delete the still-pending row. The embedding row
 * cascades away (020), the title leaves today's "do not repeat" context and
 * the slug/article match disappears — so the next progón re-proposes the
 * story as a brand-new pending card with a fresh write-up. Rejection, by
 * contrast, keeps the row and suppresses the story for the rest of the day.
 */
async function handleRedo(
  db: ReturnType<typeof getSupabaseAdmin>,
  itemId: string,
  chatId: string,
): Promise<void> {
  const { data: item, error } = await db
    .from('brief_items')
    .delete()
    .eq('id', itemId)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, category_slug, review_msg_id')
    .single();

  if (error || !item) {
    console.log('[redo] already processed or not found:', itemId);
    return;
  }

  if (item.review_msg_id) {
    await editText(chatId, item.review_msg_id, decorateCard(buildCardText(item), redoneBanner()));
  }

  await maybeSendSummary(db, item.brief_id, chatId);
}

async function handlePublish(
  db: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
  chatId: string,
  msgId: number,
): Promise<void> {
  const { data: brief, error } = await db
    .from('briefs')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', briefId)
    .eq('status', 'draft')
    .select('slug, title_en, title_uk, edition')
    .single();

  if (error || !brief) {
    const { data: existing } = await db
      .from('briefs')
      .select('status, edition, title_uk, title_en')
      .eq('id', briefId)
      .maybeSingle();
    if (existing?.status === 'published') {
      const title = existing.title_uk ?? existing.title_en ?? '–';
      const packNote = existing.edition > 1 ? ` (пак ${existing.edition})` : '';
      await editText(
        chatId,
        msgId,
        `ℹ️ <b>Вже опубліковано</b>${packNote}: «${escHtml(title)}»`,
      );
    } else {
      console.log('[publish] not found or not draft:', briefId);
    }
    return;
  }

  const { count: approved } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'approved');

  const title = brief.title_uk ?? brief.title_en ?? '–';
  await editText(chatId, msgId, publishedBanner(title, approved ?? 0));
  await revalidateSite();
  // Defer the recrawl ping until after the response is flushed to Telegram.
  after(() => pingIndexNow(db, briefId, brief.slug));
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
  const lines = [`🗂 <b>${cat}</b>`, '', `📰 <b>${titleUk}</b>`, `<i>${titleEn}</i>`, '', summary];
  if (why) lines.push('', `💡 <b>Навіщо:</b> ${escHtml(why)}`);
  return lines.join('\n');
}

// ─── /custom command (editor hand-pick from Telegram) ───────────────────────

async function handleCustomCommand(text: string, chatId: string): Promise<void> {
  const parsed = parseCustomCommand(text);
  if (!parsed) {
    await sendMsg(
      chatId,
      [
        '✏️ <b>Персональна новина</b>',
        '',
        '<code>/custom назва новини</code>',
        '<code>/custom https://url назва</code>',
        '',
        'Досліджує кілька джерел і пише оригінальний текст (~1–2 хв).',
      ].join('\n'),
    );
    return;
  }

  const topicLine = escHtml(parsed.topic);
  const urlLine = parsed.url ? `\n🔗 ${escHtml(parsed.url)}` : '';
  await sendMsg(
    chatId,
    `✏️ <b>Досліджую…</b>\n${topicLine}${urlLine}\n\n<i>Кілька джерел → оригінальний текст. Картка з’явиться тут.</i>`,
  );

  after(async () => {
    try {
      const { loadPipelineConfig } = await import('../../../../pipeline/config');
      const { runCustomNews } = await import('../../../../pipeline/custom-news');
      const config = loadPipelineConfig();
      const result = await runCustomNews(
        { topic: parsed.topic, url: parsed.url, notify: true },
        { config },
      );
      const n = result.research.sources.length;
      await sendMsg(
        chatId,
        `✅ <b>Чернетка готова</b>\nПак ${result.edition} · ${n} джерел\nПеревір картку вище 👆`,
      );
    } catch (err) {
      console.error('[telegram/custom]', err);
      await sendMsg(chatId, `❌ <b>Помилка custom news</b>\n${formatCustomNewsError(err)}`);
    }
  });
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
      const from   = cq.from as Record<string, unknown> | undefined;
      const userId = String(from?.id ?? '');

      if (adminUserId && userId !== adminUserId) {
        await answerCallback(String(cq.id), '⛔ Not authorised');
        return NextResponse.json({ ok: true });
      }

      const data     = String(cq.data ?? '');
      const msgId    = (cq.message as Record<string, unknown> | undefined)?.message_id as number | undefined;
      const parsed   = parseCallbackData(data);
      const reviewer = `tg:${userId}`;

      // ★ Answer IMMEDIATELY — dismisses the Telegram loading spinner right away.
      //   Side-effects (DB writes, card edits) run after this line.
      await answerCallback(String(cq.id));

      if (!parsed) return NextResponse.json({ ok: true });

      if (parsed.action === 'approve') {
        await handleApprove(db, parsed.id, reviewer, chatId);
      } else if (parsed.action === 'reject') {
        await handleRejectInit(db, parsed.id, chatId);
      } else if (parsed.action === 'redo') {
        await handleRedo(db, parsed.id, chatId);
      } else if (parsed.action === 'take') {
        await handleTakeInit(db, parsed.id, chatId);
      } else if (parsed.action === 'publish' && msgId) {
        await handlePublish(db, parsed.id, chatId, msgId);
      }

      return NextResponse.json({ ok: true });
    }

    // ── message (/custom command or force_reply rejection reason) ───────────
    const msg = update.message as Record<string, unknown> | undefined;
    if (msg) {
      const from   = msg.from as Record<string, unknown> | undefined;
      const userId = String(from?.id ?? '');

      const msgChatId = String((msg.chat as Record<string, unknown> | undefined)?.id ?? '');
      const text = String((msg.text as string | undefined) ?? '').trim();

      if (text.startsWith('/custom')) {
        if (adminUserId && userId !== adminUserId) {
          await sendMsg(msgChatId, '⛔ Not authorised');
          return NextResponse.json({ ok: true });
        }
        await handleCustomCommand(text, msgChatId);
        return NextResponse.json({ ok: true });
      }

      if (adminUserId && userId !== adminUserId) return NextResponse.json({ ok: true });
      if (msgChatId !== chatId) return NextResponse.json({ ok: true });

      const replyTo = msg.reply_to_message as Record<string, unknown> | undefined;
      if (!replyTo) return NextResponse.json({ ok: true });

      const promptText = String((replyTo.text as string | undefined) ?? '');
      const itemId     = extractItemIdFromPrompt(promptText);
      if (!itemId) return NextResponse.json({ ok: true });

      const replyText = String((msg.text as string | undefined) ?? '').trim();
      if (!replyText) return NextResponse.json({ ok: true });

      const replyAction = replyActionFromPrompt(promptText);
      if (replyAction === 'take') {
        await handleEditorTake(db, itemId, replyText, chatId);
      } else if (replyAction === 'reject') {
        await handleRejectReason(db, itemId, replyText, `tg:${userId}`, chatId);
      }
    }
  } catch (err) {
    // Always return 200 so Telegram doesn't retry indefinitely
    console.error('[telegram/webhook] unhandled error:', err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true });
}
