'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Json } from '@/lib/database.types';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import { composeDailySocial, composeWeeklySocial } from '@/lib/social/composer';
import { socialContentHash } from '@/lib/social/content-hash';
import { attachCriticReport } from '@/lib/social/critic';
import { generateSocialJson } from '@/lib/social/llm-router';
import { runQualityGate } from '@/lib/social/quality';
import {
  kyivWallClockToUtc,
  resolveCadenceSettings,
  SOCIAL_TIME_ZONE,
} from '@/lib/social/schedule';
import { isSocialChannel, type SocialAsset, type SocialLocale } from '@/lib/social/types';

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function kyivToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isSunday(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

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

function jsonFacts(value: Json | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, Json | undefined>;
    for (const key of ['fact', 'text', 'claim', 'value']) {
      if (typeof row[key] === 'string') return [row[key] as string];
    }
    return [];
  });
}

function hasCurrentCriticAudit(value: Json): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const critic = (value as Record<string, Json | undefined>).critic;
  if (!critic || typeof critic !== 'object' || Array.isArray(critic)) return false;
  const row = critic as Record<string, Json | undefined>;
  return (
    typeof row.auditedAt === 'string' &&
    Boolean(row.auditedAt.trim()) &&
    typeof row.provider === 'string' &&
    typeof row.model === 'string' &&
    typeof row.score === 'number'
  );
}

function parseKyivSchedule(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Schedule must use YYYY-MM-DDTHH:mm.');
  return kyivWallClockToUtc(match[1], Number(match[2]), Number(match[3])).toISOString();
}

function isoToKyivInput(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function parseWriterResponse(raw: string) {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new SyntaxError('Writer returned no JSON object.');
  const parsed = JSON.parse(json) as { text?: unknown; firstComment?: unknown };
  if (typeof parsed.text !== 'string' || !parsed.text.trim()) {
    throw new SyntaxError('Writer returned no copy.');
  }
  if (parsed.firstComment !== undefined && typeof parsed.firstComment !== 'string') {
    throw new SyntaxError('Writer returned an invalid first comment.');
  }
  return {
    text: parsed.text.trim(),
    firstComment: typeof parsed.firstComment === 'string' ? parsed.firstComment.trim() : undefined,
  };
}

export async function generateTodayAction() {
  await requireSocialAdmin();
  const date = kyivToday();
  await composeDailySocial(date);
  if (isSunday(date)) await composeWeeklySocial(date);
  revalidatePath('/admin');
  revalidatePath('/admin/calendar');
}

export async function updateVariantAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const id = requiredString(formData, 'id');
  const postText = requiredString(formData, 'post_text');
  const firstComment = optionalString(formData, 'first_comment');
  const altText = optionalString(formData, 'alt_text');
  const scheduledFor = parseKyivSchedule(requiredString(formData, 'scheduled_for'));
  const admin = getSupabaseAdmin();
  const { data: post, error: postError } = await admin
    .from('social_posts')
    .select('*')
    .eq('id', id)
    .single();
  if (postError || !post) throw new Error('Social variant was not found.');
  if (
    !isSocialChannel(post.channel) ||
    (post.locale !== 'uk' && post.locale !== 'en') ||
    !post.format
  ) {
    throw new Error('Social variant has invalid channel metadata.');
  }

  const { data: item } = post.brief_item_id
    ? await admin
        .from('brief_items')
        .select(
          'brief_id,review_status,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,facts_en,facts_uk',
        )
        .eq('id', post.brief_item_id)
        .maybeSingle()
    : { data: null };
  const { data: brief } = item
    ? await admin.from('briefs').select('status').eq('id', item.brief_id).maybeSingle()
    : { data: null };
  const locale = post.locale as SocialLocale;
  const sourceFacts = item
    ? [
        locale === 'uk' ? item.title_uk : item.title_en,
        locale === 'uk' ? item.summary_uk : item.summary_en,
        locale === 'uk' ? item.why_matters_uk : item.why_matters_en,
        ...jsonFacts(locale === 'uk' ? item.facts_uk : item.facts_en),
      ]
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        .map((value) => value.trim())
    : [];
  const draft = {
    channel: post.channel,
    locale,
    format: post.format,
    text: postText,
    firstComment,
    assets: parseAssets(post.asset_urls),
    altText,
    scheduledFor,
    sourceApproved: item?.review_status === 'approved' && brief?.status === 'published',
    sourceFacts,
    sourceUrl: post.utm_url ?? '',
  };
  const report = await attachCriticReport(draft, runQualityGate(draft));
  const nextVersion = post.content_version + 1;
  const contentHash = socialContentHash({
    channel: draft.channel,
    locale: draft.locale,
    format: draft.format,
    text: draft.text,
    firstComment: draft.firstComment,
    assets: draft.assets,
    altText: draft.altText,
    scheduledFor: draft.scheduledFor,
    contentVersion: nextVersion,
  });
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('edit_social_post', {
    p_social_post_id: id,
    p_expected_version: post.content_version,
    p_post_text: postText,
    p_first_comment: firstComment,
    p_alt_text: altText,
    p_scheduled_for: scheduledFor,
    p_quality_report: report as unknown as Json,
    p_content_hash: contentHash,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/packages/${post.package_id}`);
  revalidatePath('/admin');
  revalidatePath('/admin/calendar');
}

export async function regenerateVariantAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const id = requiredString(formData, 'id');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin.from('social_posts').select('*').eq('id', id).single();
  if (
    !post ||
    !post.package_id ||
    !isSocialChannel(post.channel) ||
    (post.locale !== 'en' && post.locale !== 'uk')
  ) {
    throw new Error('Variant metadata is invalid.');
  }
  const { data: socialPackage } = await admin
    .from('social_packages')
    .select('kind,risk_level,source_item_ids')
    .eq('id', post.package_id)
    .single();
  const { data: items } = socialPackage?.source_item_ids.length
    ? await admin
        .from('brief_items')
        .select(
          'title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,facts_en,facts_uk,review_status',
        )
        .in('id', socialPackage.source_item_ids)
    : { data: [] };
  if (!(items ?? []).length || (items ?? []).some((item) => item.review_status !== 'approved')) {
    throw new Error('Approved source facts are unavailable.');
  }
  const facts = (items ?? [])
    .flatMap((item) => [
      post.locale === 'uk' ? item.title_uk : item.title_en,
      post.locale === 'uk' ? item.summary_uk : item.summary_en,
      post.locale === 'uk' ? item.why_matters_uk : item.why_matters_en,
      ...jsonFacts(post.locale === 'uk' ? item.facts_uk : item.facts_en),
    ])
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const trackingUrl = new URL(`/r/s/${post.tracking_token}`, SITE_URL).toString();
  const channelInstruction: Record<string, string> = {
    telegram:
      'Ukrainian daily or weekly digest, 3–5 numbered stories, 80–1800 characters, exactly one tracking URL.',
    x: 'English link-free root post, 40–280 characters. Put the tracking URL only in firstComment, under 280 characters.',
    threads:
      'English conversational post, 300–500 characters, context + implication + a genuine question, at most one URL.',
    linkedin:
      'English company insight, 600–1200 characters: what happened, what changes, practical takeaway, at most 3 hashtags.',
    instagram:
      'English carousel caption, 180–1500 characters, no URL, clear save/share CTA, at most 5 hashtags.',
    facebook: 'Ukrainian top story or roundup, 120–1400 characters, one tracking URL.',
  };
  const prompt = `Create a platform-native ${post.channel} variant for AI Today Brief. Use ONLY the approved facts. Never invent a number, name, quote, or causal claim. ${channelInstruction[post.channel]} Risk level: ${socialPackage?.risk_level}. Package: ${socialPackage?.kind}. Return strict JSON only: {"text":"...","firstComment":"..."}. Tracking URL (include only when the channel rule asks): ${trackingUrl}\n\nAPPROVED FACTS:\n${facts.map((fact) => `- ${fact}`).join('\n')}\n\nCURRENT COPY TO IMPROVE:\n${post.post_text ?? ''}`;
  const { value: parsed } = await generateSocialJson('writer', prompt, parseWriterResponse);
  const next = new FormData();
  next.set('id', id);
  next.set('post_text', parsed.text);
  next.set('first_comment', parsed.firstComment ?? post.first_comment ?? '');
  next.set('alt_text', post.alt_text ?? '');
  next.set(
    'scheduled_for',
    isoToKyivInput(post.scheduled_for ?? new Date(Date.now() + 3_600_000).toISOString()),
  );
  await updateVariantAction(next);
}

export async function approvePostAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const id = requiredString(formData, 'id');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from('social_posts')
    .select('quality_report')
    .eq('id', id)
    .maybeSingle();
  if (!post || !hasCurrentCriticAudit(post.quality_report)) {
    throw new Error('A successful current-generation critic audit is required before approval.');
  }
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('approve_social_post', { p_social_post_id: id });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/admin/calendar');
}

export async function approvePackageAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const id = requiredString(formData, 'id');
  const admin = getSupabaseAdmin();
  const { data: posts } = await admin
    .from('social_posts')
    .select('quality_report')
    .eq('package_id', id);
  if (
    !(posts ?? []).length ||
    (posts ?? []).some((post) => !hasCurrentCriticAudit(post.quality_report))
  ) {
    throw new Error('Every variant needs a successful current-generation critic audit.');
  }
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('approve_social_package', { p_package_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/packages/${id}`);
  revalidatePath('/admin');
  revalidatePath('/admin/calendar');
  revalidatePath('/en/digests');
  revalidatePath('/uk/digests');
}

export async function cancelPackageAction(formData: FormData) {
  const session = await requireSocialAdmin({ aal2: true });
  const id = requiredString(formData, 'id');
  const admin = getSupabaseAdmin();
  const { data: posts } = await admin
    .from('social_posts')
    .select('*')
    .eq('package_id', id)
    .not('status', 'in', '(posted,publishing)');
  await admin
    .from('social_posts')
    .update({ status: 'cancelled', retry_after: null })
    .eq('package_id', id)
    .not('status', 'in', '(posted,publishing)');
  await admin.from('social_packages').update({ status: 'cancelled' }).eq('id', id);
  if (posts?.length) {
    await admin.from('social_post_reviews').insert(
      posts.map((post) => ({
        social_post_id: post.id,
        package_id: id,
        reviewer_id: session.userId,
        action: 'cancelled',
        content_version: post.content_version,
        content_hash: post.content_hash,
        snapshot: { status: post.status, channel: post.channel, scheduled_for: post.scheduled_for },
      })),
    );
  }
  revalidatePath('/admin');
  revalidatePath('/admin/calendar');
}

export async function updateSettingsAction(formData: FormData) {
  const session = await requireSocialAdmin({ aal2: true });
  const channels = ['telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'] as const;
  const channelEnabled = Object.fromEntries(
    channels.map((channel) => [channel, formData.get(`channel_${channel}`) === 'on']),
  );
  const requestedBudget = Number.parseFloat(optionalString(formData, 'x_monthly_budget_eur'));
  const xBudget = Number.isFinite(requestedBudget)
    ? Math.max(0, Math.min(10, requestedBudget))
    : 10;
  const admin = getSupabaseAdmin();
  const { data: currentSettings } = await admin
    .from('social_settings')
    .select('cadence')
    .eq('id', true)
    .maybeSingle();
  const currentCadence = resolveCadenceSettings(currentSettings?.cadence);
  const cadence = Object.fromEntries(
    channels.map((channel) => {
      const rawTime = optionalString(formData, `cadence_${channel}_time`);
      const match = /^(\d{2}):(\d{2})$/.exec(rawTime);
      const hour = match ? Number(match[1]) : currentCadence[channel].hour;
      const minute = match ? Number(match[2]) : currentCadence[channel].minute;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error(`Invalid ${channel} cadence time.`);
      }
      const days = Array.from({ length: 7 }, (_, day) => day).filter(
        (day) => formData.get(`cadence_${channel}_day_${day}`) === 'on',
      );
      if (days.length === 0) throw new Error(`${channel} must have at least one publishing day.`);
      return [channel, { days, hour, minute }];
    }),
  );
  const { error } = await admin
    .from('social_settings')
    .update({
      global_kill_switch: formData.get('global_kill_switch') === 'on',
      auto_publish_green: formData.get('auto_publish_green') === 'on',
      channel_enabled: channelEnabled,
      cadence,
      x_monthly_budget_eur: xBudget,
      updated_by: session.userId,
    })
    .eq('id', true);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/admin/settings');
}

export async function updateAccountAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const channel = requiredString(formData, 'channel');
  if (!isSocialChannel(channel)) throw new Error('Invalid channel.');
  const { error } = await getSupabaseAdmin()
    .from('social_accounts')
    .upsert(
      {
        channel,
        handle: optionalString(formData, 'handle') || null,
        provider_account_id: optionalString(formData, 'provider_account_id') || null,
        enabled: formData.get('enabled') === 'on',
      },
      { onConflict: 'channel' },
    );
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
}

export async function completeEngagementAction(formData: FormData) {
  await requireSocialAdmin();
  const id = requiredString(formData, 'id');
  const status = formData.get('decision') === 'dismiss' ? 'dismissed' : 'completed';
  await getSupabaseAdmin()
    .from('engagement_tasks')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  revalidatePath('/admin/engagement');
}

export async function createEngagementTaskAction(formData: FormData) {
  await requireSocialAdmin();
  const channel = requiredString(formData, 'channel');
  const action = requiredString(formData, 'engagement_action');
  const nativeUrl = requiredString(formData, 'native_url');
  if (!isSocialChannel(channel)) throw new Error('Invalid engagement channel.');
  if (!['review_profile', 'follow', 'comment', 'reshare', 'invite_connection'].includes(action)) {
    throw new Error('Invalid engagement action.');
  }
  const parsed = new URL(nativeUrl);
  if (parsed.protocol !== 'https:') throw new Error('Native URL must use HTTPS.');
  const { error } = await getSupabaseAdmin()
    .from('engagement_tasks')
    .insert({
      channel,
      action,
      native_url: parsed.toString(),
      rationale: optionalString(formData, 'rationale') || null,
      suggested_text: optionalString(formData, 'suggested_text') || null,
      status: 'open',
    });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/engagement');
}

export async function signOutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
