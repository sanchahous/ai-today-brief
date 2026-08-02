import 'server-only';

import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSocialPublisher } from './providers';
import { assessWeeklySocialSource } from './weekly-source-gate';
import {
  isSocialChannel,
  SocialPublishError,
  type SocialAsset,
  type SocialPostForDelivery,
} from './types';

// One initial provider call plus the three explicitly configured retry windows.
const MAX_DELIVERY_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

type ClaimedPost = Awaited<ReturnType<typeof claimPosts>>[number];

function parseAssets(value: Json): SocialAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, Json | undefined>;
    if (typeof row.url !== 'string') return [];
    return [
      {
        url: row.url,
        ...(typeof row.width === 'number' ? { width: row.width } : {}),
        ...(typeof row.height === 'number' ? { height: row.height } : {}),
        ...(typeof row.bytes === 'number' ? { bytes: row.bytes } : {}),
        ...(row.mimeType === 'image/jpeg' ||
        row.mimeType === 'image/png' ||
        row.mimeType === 'image/webp'
          ? { mimeType: row.mimeType }
          : {}),
      },
    ];
  });
}

function parseContentParts(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function asDelivery(post: ClaimedPost): SocialPostForDelivery {
  if (!isSocialChannel(post.channel)) {
    throw new SocialPublishError(
      `Unsupported channel: ${post.channel}`,
      'permanent',
      'unsupported_channel',
    );
  }
  return {
    id: post.id,
    channel: post.channel,
    text: post.post_text?.trim() ?? '',
    contentParts: parseContentParts(post.content_parts),
    firstComment: post.first_comment,
    assets: parseAssets(post.asset_urls),
    altText: post.alt_text,
    idempotencyKey: post.idempotency_key ?? `${post.id}:${post.content_hash ?? 'unversioned'}`,
    attempt: post.attempts,
    providerMeta: post.provider_meta,
  };
}

async function claimPosts(limit: number) {
  const supabase = getSupabaseAdmin();
  await supabase.rpc('reconcile_stale_social_posts');
  const { data, error } = await supabase.rpc('claim_due_social_posts', { p_limit: limit });
  if (error) throw new Error(`[social-worker] claim failed: ${error.message}`);
  return data ?? [];
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 700);
}

function errorDetails(error: unknown) {
  if (error instanceof SocialPublishError) {
    return {
      kind: error.kind,
      code: error.code,
      message: safeMessage(error),
      providerMeta: error.providerMeta,
    };
  }
  return {
    kind: 'ambiguous' as const,
    code: 'unexpected_error',
    message: safeMessage(error),
    providerMeta: undefined,
  };
}

async function startAttempt(post: ClaimedPost) {
  const { error } = await getSupabaseAdmin()
    .from('social_delivery_attempts')
    .insert({
      social_post_id: post.id,
      attempt_number: post.attempts,
      idempotency_key: post.idempotency_key,
      request_summary: {
        channel: post.channel,
        text_characters: post.post_text?.length ?? 0,
        has_first_comment: Boolean(post.first_comment),
        asset_count: Array.isArray(post.asset_urls) ? post.asset_urls.length : 0,
        content_hash: post.content_hash,
      },
    });
  if (error) throw new Error(`[social-worker] attempt audit failed: ${error.message}`);
}

async function finishAttempt(
  post: ClaimedPost,
  result:
    | { outcome: 'posted'; externalId: string; url?: string | null; providerMeta?: Json }
    | {
        outcome: 'retryable_error' | 'permanent_error' | 'ambiguous';
        code: string;
        message: string;
        providerMeta?: Json;
      },
) {
  const supabase = getSupabaseAdmin();
  const finishedAt = new Date().toISOString();
  await supabase
    .from('social_delivery_attempts')
    .update(
      result.outcome === 'posted'
        ? {
            outcome: result.outcome,
            finished_at: finishedAt,
            response_summary: {
              external_id: result.externalId,
              url: result.url ?? null,
              provider_meta: result.providerMeta ?? {},
            },
          }
        : {
            outcome: result.outcome,
            finished_at: finishedAt,
            error_code: result.code,
            error_message: result.message,
            response_summary: result.providerMeta
              ? { provider_meta: result.providerMeta }
              : undefined,
          },
    )
    .eq('social_post_id', post.id)
    .eq('attempt_number', post.attempts);

  if (result.outcome === 'posted') {
    await supabase
      .from('social_posts')
      .update({
        status: 'posted',
        external_id: result.externalId,
        url: result.url ?? null,
        provider_meta: result.providerMeta ?? {},
        posted_at: finishedAt,
        publishing_started_at: null,
        last_error: null,
        retry_after: null,
      })
      .eq('id', post.id)
      .eq('status', 'publishing');
    return;
  }

  if (result.outcome === 'ambiguous') {
    await supabase
      .from('social_posts')
      .update({
        status: 'needs_reconciliation',
        last_error: result.message,
        publishing_started_at: null,
        retry_after: null,
        provider_meta: result.providerMeta ?? {},
      })
      .eq('id', post.id);
    return;
  }

  const canRetry = result.outcome === 'retryable_error' && post.attempts < MAX_DELIVERY_ATTEMPTS;
  const retryAt = canRetry
    ? new Date(
        Date.now() + RETRY_DELAYS_MS[Math.min(post.attempts - 1, RETRY_DELAYS_MS.length - 1)],
      ).toISOString()
    : null;
  await supabase
    .from('social_posts')
    .update({
      status: 'failed',
      last_error: result.message,
      publishing_started_at: null,
      retry_after: retryAt,
    })
    .eq('id', post.id);
}

async function reserveXBudget() {
  const raw = Number.parseFloat(process.env.X_POST_ESTIMATED_COST_EUR ?? '0.40');
  const estimate = Number.isFinite(raw) && raw > 0 ? raw : 0.4;
  const { data, error } = await getSupabaseAdmin().rpc('reserve_x_budget', { p_amount: estimate });
  if (error) throw new Error(`[social-worker] X budget reservation failed: ${error.message}`);
  if (!data) {
    throw new SocialPublishError('Monthly X API hard cap reached.', 'permanent', 'x_budget_cap');
  }
}

async function assertSourcesStillApproved(post: ClaimedPost) {
  if (!post.package_id) return;
  const supabase = getSupabaseAdmin();
  const { data: socialPackage } = await supabase
    .from('social_packages')
    .select('kind,source_item_ids,weekly_digest_id,weekly_digest_revision_id')
    .eq('id', post.package_id)
    .maybeSingle();
  const { data: digest } =
    socialPackage?.kind === 'weekly_digest' && socialPackage.weekly_digest_id
      ? await supabase
          .from('weekly_digests')
          .select('status,published_revision_id')
          .eq('id', socialPackage.weekly_digest_id)
          .maybeSingle()
      : { data: null };
  const weeklyGate = assessWeeklySocialSource(socialPackage, digest);
  if (!weeklyGate.ready) {
    const sourceMissing = weeklyGate.code === 'weekly_digest_source_missing';
    throw new SocialPublishError(
      sourceMissing
        ? 'Weekly package has no revision-bound digest source.'
        : 'The Weekly Digest web edition is not published yet.',
      sourceMissing ? 'permanent' : 'retryable',
      weeklyGate.code,
    );
  }
  const sourceIds = socialPackage?.source_item_ids ?? [];
  if (sourceIds.length === 0) {
    throw new SocialPublishError(
      'Package has no approved source snapshot.',
      'permanent',
      'source_missing',
    );
  }
  const { data: items } = await supabase
    .from('brief_items')
    .select('id,brief_id,review_status')
    .in('id', sourceIds);
  if (
    (items ?? []).length !== sourceIds.length ||
    (items ?? []).some((item) => item.review_status !== 'approved')
  ) {
    throw new SocialPublishError(
      'A source story is no longer approved.',
      'permanent',
      'source_revoked',
    );
  }
  const briefIds = [...new Set((items ?? []).map((item) => item.brief_id))];
  const { data: briefs } = await supabase.from('briefs').select('id,status').in('id', briefIds);
  if (
    (briefs ?? []).length !== briefIds.length ||
    (briefs ?? []).some((brief) => brief.status !== 'published')
  ) {
    throw new SocialPublishError(
      'A source brief is no longer published.',
      'permanent',
      'brief_unpublished',
    );
  }
}

async function refreshPackage(packageId: string | null) {
  if (!packageId) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('social_posts').select('status').eq('package_id', packageId);
  const statuses = (data ?? []).map((post) => post.status);
  if (statuses.length === 0) return;
  let status = 'scheduled';
  if (statuses.every((value) => value === 'posted')) status = 'posted';
  else if (statuses.some((value) => value === 'needs_reconciliation'))
    status = 'needs_reconciliation';
  else if (statuses.some((value) => value === 'publishing')) status = 'publishing';
  else if (statuses.some((value) => value === 'failed')) status = 'failed';
  else if (statuses.some((value) => value === 'in_review' || value === 'draft'))
    status = 'in_review';
  else if (statuses.every((value) => value === 'cancelled')) status = 'cancelled';
  await supabase.from('social_packages').update({ status }).eq('id', packageId);
  if (status === 'posted') {
    await supabase.rpc('record_green_delivery_success', { p_package_id: packageId });
  }
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function alertOwner(post: ClaimedPost, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_REVIEW_CHAT_ID?.trim();
  if (!token || !chatId) return;
  const link = post.package_id
    ? new URL(`/admin/packages/${post.package_id}`, SITE_URL).toString()
    : SITE_URL;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>Social delivery needs attention</b>\n${escapeHtml(post.channel)} · ${escapeHtml(message)}\n<a href="${link}">Open package</a>`,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Delivery auditing must not fail because the secondary alert channel did.
  }
}

async function alertCredentialWarnings() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_REVIEW_CHAT_ID?.trim();
  if (!token || !chatId) return;
  const admin = getSupabaseAdmin();
  const threshold = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const staleAlert = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: accounts } = await admin
    .from('social_accounts')
    .select('id,channel,token_expires_at,last_alerted_at')
    .eq('enabled', true)
    .lte('token_expires_at', threshold);
  for (const account of accounts ?? []) {
    if (account.last_alerted_at && account.last_alerted_at > staleAlert) continue;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `<b>Social token warning</b>\n${escapeHtml(account.channel)} expires ${escapeHtml(account.token_expires_at ?? 'now')}\n<a href="${new URL('/admin/settings', SITE_URL)}">Open settings</a>`,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      await admin
        .from('social_accounts')
        .update({ connection_health: 'warning', last_alerted_at: new Date().toISOString() })
        .eq('id', account.id);
    } catch {
      // Best effort. The account remains visible as a warning in Today.
    }
  }
}

async function deliverOne(post: ClaimedPost) {
  await startAttempt(post);
  try {
    const delivery = asDelivery(post);
    await assertSourcesStillApproved(post);
    if (delivery.channel === 'x') await reserveXBudget();
    const publisher = getSocialPublisher(delivery.channel);
    await publisher.refreshCredentials?.();
    await publisher.validate(delivery);
    const receipt = await publisher.publish(delivery);
    await finishAttempt(post, {
      outcome: 'posted',
      externalId: receipt.externalId,
      url: receipt.url,
      providerMeta: receipt.providerMeta,
    });
    return { id: post.id, channel: post.channel, outcome: 'posted' as const };
  } catch (error) {
    const detail = errorDetails(error);
    await finishAttempt(post, {
      outcome:
        detail.kind === 'ambiguous'
          ? 'ambiguous'
          : detail.kind === 'retryable'
            ? 'retryable_error'
            : 'permanent_error',
      code: detail.code,
      message: detail.message,
      providerMeta: detail.providerMeta,
    });
    if (detail.kind !== 'retryable' || post.attempts >= MAX_DELIVERY_ATTEMPTS) {
      await alertOwner(post, detail.message);
    }
    return { id: post.id, channel: post.channel, outcome: detail.kind };
  } finally {
    await refreshPackage(post.package_id);
  }
}

export async function publishDueSocialPosts(limit = 10) {
  await alertCredentialWarnings();
  const posts = await claimPosts(Math.max(1, Math.min(limit, 10)));
  const results = [];
  // Sequential delivery keeps provider rate limits predictable and makes the
  // X budget reservation exact even when several X variants become due.
  for (const post of posts) results.push(await deliverOne(post));
  return { claimed: posts.length, results };
}
