import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { renderSocialAssets } from './assets';
import { socialContentHash } from './content-hash';
import { attachCriticReport } from './critic';
import { findBlindCrossPosts, runQualityGate } from './quality';
import {
  channelRunsOnDate,
  nextScheduledForChannel,
  nextWeeklyScheduledForChannel,
  resolveCadenceSettings,
  type ChannelCadence,
} from './schedule';
import type {
  PackageKind,
  QualityReport,
  RiskLevel,
  SocialAsset,
  SocialChannel,
  SocialDraft,
  SocialLocale,
} from './types';

export const SOCIAL_GENERATION_VERSION = 'social-v1';

interface SourceBrief {
  id: string;
  date: string;
  edition: number;
  slug: string;
  title_en: string;
  title_uk: string;
}

interface SourceItem {
  id: string;
  brief_id: string;
  rank: number;
  slug: string;
  impact_level: string | null;
  category_slug: string | null;
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string;
  why_matters_uk: string;
  social_hook_en: string;
  social_hook_uk: string;
  facts_en: Json | null;
  facts_uk: Json | null;
  card_image_url: string | null;
  review_status: string;
}

interface LoadedDay {
  briefs: SourceBrief[];
  items: SourceItem[];
}

interface VariantSeed {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  firstComment?: string | null;
  trackingToken: string;
  sourceUrl: string;
  scheduledFor: string;
}

function text(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function truncate(value: string, max: number) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s,;:–—-]+$/, '')}…`;
}

function factStrings(value: Json | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, Json | undefined>;
        for (const key of ['fact', 'text', 'claim', 'value']) {
          if (typeof record[key] === 'string') return record[key] as string;
        }
      }
      return '';
    })
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function approvedFacts(item: SourceItem, locale: SocialLocale) {
  const title = locale === 'uk' ? item.title_uk : item.title_en;
  const summary = locale === 'uk' ? item.summary_uk : item.summary_en;
  const why = locale === 'uk' ? item.why_matters_uk : item.why_matters_en;
  const extracted = factStrings(locale === 'uk' ? item.facts_uk : item.facts_en);
  return [title, summary, why, ...extracted].map(text).filter(Boolean);
}

function publicStoryUrl(
  brief: SourceBrief,
  item: SourceItem,
  locale: SocialLocale,
  channel: SocialChannel,
) {
  const url = new URL(`/${locale}/${brief.slug}/${item.slug}`, SITE_URL);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'daily_news');
  url.searchParams.set('utm_content', item.id);
  return url.toString();
}

function dailyBriefUrl(brief: SourceBrief, channel: SocialChannel) {
  const url = new URL(`/uk/${brief.slug}`, SITE_URL);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'daily_digest');
  return url.toString();
}

function topStorySeeds(
  brief: SourceBrief,
  item: SourceItem,
  sourceDate: string,
  now: Date,
  trackingUrls: Record<SocialChannel, string>,
  cadence: Record<SocialChannel, ChannelCadence>,
): VariantSeed[] {
  const title = text(item.title_en) || text(item.summary_en);
  const hook = text(item.social_hook_en) || text(item.summary_en);
  const why = text(item.why_matters_en) || text(item.summary_en);
  const ukTitle = text(item.title_uk) || text(item.summary_uk);
  const ukWhy = text(item.why_matters_uk) || text(item.summary_uk);
  const seeds: VariantSeed[] = [];

  if (channelRunsOnDate('x', sourceDate, cadence.x)) {
    const xText = truncate(`${title}\n\n${why}`, 278);
    seeds.push({
      channel: 'x',
      locale: 'en',
      format: 'link_free_hook',
      text: xText,
      firstComment: `Read the full brief: ${trackingUrls.x}`,
      trackingToken: trackingUrls.x.split('/').at(-1)!,
      sourceUrl: publicStoryUrl(brief, item, 'en', 'x'),
      scheduledFor: nextScheduledForChannel('x', sourceDate, now, cadence.x),
    });
  }

  if (channelRunsOnDate('threads', sourceDate, cadence.threads)) {
    seeds.push({
      channel: 'threads',
      locale: 'en',
      format: 'conversation',
      text: truncate(
        `${title}\n\n${hook}\n\nWhy it matters: ${why}\n\nWhat changes for builders in practice? ${trackingUrls.threads}`,
        498,
      ),
      trackingToken: trackingUrls.threads.split('/').at(-1)!,
      sourceUrl: publicStoryUrl(brief, item, 'en', 'threads'),
      scheduledFor: nextScheduledForChannel('threads', sourceDate, now, cadence.threads),
    });
  }

  if (channelRunsOnDate('linkedin', sourceDate, cadence.linkedin)) {
    const facts = approvedFacts(item, 'en').slice(3, 6);
    const linkedin = [
      title,
      '',
      `What happened: ${text(item.summary_en)}`,
      '',
      `What changes: ${why}`,
      ...(facts.length > 0
        ? ['', 'The approved details:', ...facts.map((fact) => `• ${fact}`)]
        : []),
      '',
      `Practical takeaway: teams should verify where this changes cost, reliability, or delivery speed before changing a production workflow.`,
      '',
      `Full analysis: ${trackingUrls.linkedin}`,
      '',
      '#AI #Engineering',
    ].join('\n');
    seeds.push({
      channel: 'linkedin',
      locale: 'en',
      format: 'company_insight',
      text: truncate(linkedin, 1200),
      trackingToken: trackingUrls.linkedin.split('/').at(-1)!,
      sourceUrl: publicStoryUrl(brief, item, 'en', 'linkedin'),
      scheduledFor: nextScheduledForChannel('linkedin', sourceDate, now, cadence.linkedin),
    });
  }

  if (channelRunsOnDate('instagram', sourceDate, cadence.instagram)) {
    seeds.push({
      channel: 'instagram',
      locale: 'en',
      format: 'carousel_4x5',
      text: truncate(
        `${title}\n\n${text(item.summary_en)}\n\nWhy it matters: ${why}\n\nSave this for your next AI engineering review. Full brief via the link in bio.\n\n#AI #AITools #Engineering`,
        1500,
      ),
      trackingToken: trackingUrls.instagram.split('/').at(-1)!,
      sourceUrl: publicStoryUrl(brief, item, 'en', 'instagram'),
      scheduledFor: nextScheduledForChannel('instagram', sourceDate, now, cadence.instagram),
    });
  }

  if (channelRunsOnDate('facebook', sourceDate, cadence.facebook)) {
    seeds.push({
      channel: 'facebook',
      locale: 'uk',
      format: 'top_story',
      text: truncate(
        `${ukTitle}\n\nЩо сталося: ${text(item.summary_uk)}\n\nЧому це важливо: ${ukWhy}\n\nПовний розбір: ${trackingUrls.facebook}`,
        1400,
      ),
      trackingToken: trackingUrls.facebook.split('/').at(-1)!,
      sourceUrl: publicStoryUrl(brief, item, 'uk', 'facebook'),
      scheduledFor: nextScheduledForChannel('facebook', sourceDate, now, cadence.facebook),
    });
  }

  return seeds;
}

function telegramSeed(
  brief: SourceBrief,
  items: SourceItem[],
  sourceDate: string,
  now: Date,
  trackingUrl: string,
  cadence: ChannelCadence,
): VariantSeed {
  const lines = ['AI Today Brief — головне за день', ''];
  for (const [index, item] of items.slice(0, 5).entries()) {
    lines.push(
      `${index + 1}. ${text(item.title_uk) || text(item.title_en)}`,
      truncate(text(item.summary_uk), 190),
      '',
    );
  }
  lines.push(`Повний щоденний бриф: ${trackingUrl}`);
  return {
    channel: 'telegram',
    locale: 'uk',
    format: 'daily_digest',
    text: lines.join('\n'),
    trackingToken: trackingUrl.split('/').at(-1)!,
    sourceUrl: dailyBriefUrl(brief, 'telegram'),
    scheduledFor: nextScheduledForChannel('telegram', sourceDate, now, cadence),
  };
}

async function loadCadence() {
  const { data, error } = await getSupabaseAdmin()
    .from('social_settings')
    .select('cadence')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(`[social-composer] load cadence: ${error.message}`);
  return resolveCadenceSettings(data?.cadence);
}

function rankItems(items: SourceItem[]) {
  const impact: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return [...items].sort((a, b) => {
    const byImpact = (impact[b.impact_level ?? ''] ?? 0) - (impact[a.impact_level ?? ''] ?? 0);
    return byImpact || a.rank - b.rank;
  });
}

async function loadApprovedDay(sourceDate: string): Promise<LoadedDay> {
  const supabase = getSupabaseAdmin();
  const { data: briefRows, error: briefError } = await supabase
    .from('briefs')
    .select('id,date,edition,slug,title_en,title_uk')
    .eq('date', sourceDate)
    .eq('status', 'published')
    .order('edition');
  if (briefError) throw new Error(`[social-composer] ${briefError.message}`);
  const briefs = (briefRows ?? []).filter((brief) => brief.slug) as SourceBrief[];
  if (briefs.length === 0) return { briefs: [], items: [] };

  const { data: itemRows, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id,brief_id,rank,slug,impact_level,category_slug,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,social_hook_en,social_hook_uk,facts_en,facts_uk,card_image_url,review_status',
    )
    .in(
      'brief_id',
      briefs.map((brief) => brief.id),
    )
    .eq('review_status', 'approved');
  if (itemError) throw new Error(`[social-composer] ${itemError.message}`);
  const items = (itemRows ?? []).filter((item) => item.slug) as SourceItem[];
  return { briefs, items: rankItems(items) };
}

async function existingPackage(kind: PackageKind, sourceDate: string) {
  const { data } = await getSupabaseAdmin()
    .from('social_packages')
    .select('id')
    .eq('kind', kind)
    .eq('source_date', sourceDate)
    .eq('generation_version', SOCIAL_GENERATION_VERSION)
    .neq('status', 'cancelled')
    .maybeSingle();
  return data?.id ?? null;
}

async function previouslyPackagedTopStoryIds() {
  const { data } = await getSupabaseAdmin()
    .from('social_packages')
    .select('source_item_ids')
    .eq('kind', 'top_story')
    .not('status', 'in', '(failed,cancelled)');
  return new Set((data ?? []).flatMap((item) => item.source_item_ids));
}

async function createPackage(
  kind: PackageKind,
  riskLevel: RiskLevel,
  sourceDate: string,
  title: string,
  sourceBriefId: string,
  sourceItemId?: string,
  weeklyDigestId?: string,
  sourceItemIds: string[] = sourceItemId ? [sourceItemId] : [],
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_packages')
    .insert({
      kind,
      risk_level: riskLevel,
      source_date: sourceDate,
      source_brief_id: sourceBriefId,
      source_brief_item_id: sourceItemId ?? null,
      source_item_ids: sourceItemIds,
      weekly_digest_id: weeklyDigestId ?? null,
      title,
      status: 'in_review',
      generation_version: SOCIAL_GENERATION_VERSION,
    })
    .select('id')
    .single();
  if (error) throw new Error(`[social-composer] create package: ${error.message}`);
  return data.id;
}

async function saveVariants(
  packageId: string,
  item: SourceItem,
  seeds: VariantSeed[],
  now: Date,
  factItems: SourceItem[] = [item],
) {
  const supabase = getSupabaseAdmin();
  const drafts = await Promise.all(
    seeds.map(async (seed): Promise<SocialDraft> => {
      const facts = factItems.flatMap((sourceItem) => approvedFacts(sourceItem, seed.locale));
      let assets: SocialAsset[] = [];
      try {
        assets = await renderSocialAssets({
          packageId,
          generationVersion: SOCIAL_GENERATION_VERSION,
          channel: seed.channel,
          title: seed.locale === 'uk' ? item.title_uk : item.title_en,
          summary: seed.locale === 'uk' ? item.summary_uk : item.summary_en,
          why: seed.locale === 'uk' ? item.why_matters_uk : item.why_matters_en,
          facts,
          sourceImageUrl: item.card_image_url,
        });
      } catch {
        // Missing media blocks Instagram through the rules engine; other
        // channels can still be reviewed and published without an image.
      }
      const altText = assets.length
        ? `${seed.locale === 'uk' ? 'Ілюстрація до новини' : 'Editorial illustration'}: ${
            seed.locale === 'uk' ? item.title_uk : item.title_en
          }`
        : null;
      const draft: SocialDraft = {
        channel: seed.channel,
        locale: seed.locale,
        format: seed.format,
        text: seed.text,
        firstComment: seed.firstComment ?? null,
        assets,
        altText,
        scheduledFor: seed.scheduledFor,
        sourceApproved: item.review_status === 'approved',
        sourceFacts: facts,
        sourceUrl: seed.sourceUrl,
      };
      const rules = runQualityGate(draft, now);
      return { ...draft, qualityReport: await attachCriticReport(draft, rules) };
    }),
  );

  const duplicates = findBlindCrossPosts(drafts);
  const rows = drafts.map((draft) => {
    const contentVersion = 1;
    const report: QualityReport = {
      ...draft.qualityReport!,
      blocking: [...draft.qualityReport!.blocking, ...(duplicates.get(draft.channel) ?? [])],
    };
    const contentHash = socialContentHash({
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      text: draft.text,
      firstComment: draft.firstComment,
      assets: draft.assets,
      altText: draft.altText,
      scheduledFor: draft.scheduledFor,
      contentVersion,
    });
    const seed = seeds.find((value) => value.channel === draft.channel)!;
    return {
      package_id: packageId,
      brief_item_id: item.id,
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      status: 'in_review',
      post_text: draft.text,
      first_comment: draft.firstComment ?? null,
      asset_urls: draft.assets as unknown as Json,
      alt_text: draft.altText ?? null,
      quality_report: report as unknown as Json,
      content_hash: contentHash,
      content_version: contentVersion,
      scheduled_for: draft.scheduledFor,
      idempotency_key: `${packageId}:${draft.channel}:${contentHash.slice(0, 16)}`,
      tracking_token: seed.trackingToken,
      utm_url: seed.sourceUrl,
    };
  });

  const { data: posts, error } = await supabase.from('social_posts').insert(rows).select('*');
  if (error) throw new Error(`[social-composer] save variants: ${error.message}`);

  const reviews = (posts ?? []).map((post) => ({
    social_post_id: post.id,
    package_id: packageId,
    action: 'generated',
    content_version: post.content_version,
    content_hash: post.content_hash,
    snapshot: {
      channel: post.channel,
      locale: post.locale,
      format: post.format,
      post_text: post.post_text,
      first_comment: post.first_comment,
      asset_urls: post.asset_urls,
      alt_text: post.alt_text,
      scheduled_for: post.scheduled_for,
      quality_report: post.quality_report,
    },
  }));
  if (reviews.length > 0) await supabase.from('social_post_reviews').insert(reviews);
}

function trackingUrls(tokens: Record<SocialChannel, string>) {
  return Object.fromEntries(
    Object.entries(tokens).map(([channel, token]) => [
      channel,
      new URL(`/r/s/${token}`, SITE_URL).toString(),
    ]),
  ) as Record<SocialChannel, string>;
}

function freshTrackingTokens() {
  return {
    telegram: randomUUID(),
    x: randomUUID(),
    threads: randomUUID(),
    linkedin: randomUUID(),
    instagram: randomUUID(),
    facebook: randomUUID(),
  } satisfies Record<SocialChannel, string>;
}

export interface ComposeResult {
  createdPackageIds: string[];
  skipped: string[];
}

async function notifyPackagesReady(packageIds: string[], label: string) {
  if (process.env.SOCIAL_SHADOW_MODE === '1') return;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_REVIEW_CHAT_ID?.trim();
  if (!token || !chatId || packageIds.length === 0) return;
  const links = packageIds
    .map(
      (id, index) =>
        `<a href="${new URL(`/admin/packages/${id}`, SITE_URL)}">Package ${index + 1}</a>`,
    )
    .join(' · ');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>Social review ready</b>\n${label}\n${links}`,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Review data is already persisted; alerts are a best-effort convenience.
  }
}

export async function composeDailySocial(
  sourceDate: string,
  options: { now?: Date } = {},
): Promise<ComposeResult> {
  const now = options.now ?? new Date();
  const cadence = await loadCadence();
  const { briefs, items } = await loadApprovedDay(sourceDate);
  if (briefs.length === 0) return { createdPackageIds: [], skipped: ['no_published_brief'] };
  if (items.length === 0) return { createdPackageIds: [], skipped: ['no_approved_items'] };
  const leadBrief = briefs[0];
  const digestLeadItem = items[0];
  const priorTopStories = await previouslyPackagedTopStoryIds();
  const topItem = items.find((item) => !priorTopStories.has(item.id)) ?? null;
  const itemBrief = topItem
    ? (briefs.find((brief) => brief.id === topItem.brief_id) ?? leadBrief)
    : leadBrief;
  const createdPackageIds: string[] = [];
  const skipped: string[] = [];

  if (await existingPackage('daily_digest', sourceDate)) {
    skipped.push('daily_digest_exists');
  } else {
    const packageId = await createPackage(
      'daily_digest',
      'yellow',
      sourceDate,
      `Daily digest · ${sourceDate}`,
      leadBrief.id,
      undefined,
      undefined,
      items.slice(0, 5).map((item) => item.id),
    );
    const tokens = freshTrackingTokens();
    const urls = trackingUrls(tokens);
    await saveVariants(
      packageId,
      digestLeadItem,
      [
        telegramSeed(
          leadBrief,
          items.slice(0, 5),
          sourceDate,
          now,
          urls.telegram,
          cadence.telegram,
        ),
      ],
      now,
      items.slice(0, 5),
    );
    createdPackageIds.push(packageId);
  }

  if (await existingPackage('top_story', sourceDate)) {
    skipped.push('top_story_exists');
  } else if (!topItem) {
    skipped.push('top_story_already_used');
  } else {
    const packageId = await createPackage(
      'top_story',
      'yellow',
      sourceDate,
      text(topItem.title_en) || text(topItem.title_uk),
      itemBrief.id,
      topItem.id,
      undefined,
      [topItem.id],
    );
    const tokens = freshTrackingTokens();
    const urls = trackingUrls(tokens);
    const seeds = topStorySeeds(itemBrief, topItem, sourceDate, now, urls, cadence);
    if (seeds.length > 0) await saveVariants(packageId, topItem, seeds, now);
    createdPackageIds.push(packageId);
  }

  await notifyPackagesReady(createdPackageIds, `Daily content · ${sourceDate}`);
  return { createdPackageIds, skipped };
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function loadApprovedRange(startDate: string, endDate: string) {
  const supabase = getSupabaseAdmin();
  const { data: briefRows, error: briefError } = await supabase
    .from('briefs')
    .select('id,date,edition,slug,title_en,title_uk')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('status', 'published')
    .order('date');
  if (briefError) throw new Error(`[social-composer] ${briefError.message}`);
  const briefs = (briefRows ?? []).filter((brief) => brief.slug) as SourceBrief[];
  if (briefs.length === 0) return { briefs, items: [] as SourceItem[] };
  const { data: itemRows, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id,brief_id,rank,slug,impact_level,category_slug,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,social_hook_en,social_hook_uk,facts_en,facts_uk,card_image_url,review_status',
    )
    .in(
      'brief_id',
      briefs.map((brief) => brief.id),
    )
    .eq('review_status', 'approved');
  if (itemError) throw new Error(`[social-composer] ${itemError.message}`);
  return {
    briefs,
    items: (itemRows ?? []).filter((item) => item.slug) as SourceItem[],
  };
}

function selectWeeklyItems(items: SourceItem[], briefs: SourceBrief[]) {
  const dateByBrief = new Map(briefs.map((brief) => [brief.id, brief.date]));
  const impact: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const candidates = [...items].sort((a, b) => {
    const byImpact = (impact[b.impact_level ?? ''] ?? 0) - (impact[a.impact_level ?? ''] ?? 0);
    if (byImpact) return byImpact;
    const dateA = dateByBrief.get(a.brief_id) ?? '';
    const dateB = dateByBrief.get(b.brief_id) ?? '';
    return dateA === dateB ? a.rank - b.rank : dateA < dateB ? 1 : -1;
  });
  const categoryCount = new Map<string, number>();
  const selected: SourceItem[] = [];
  for (const item of candidates) {
    const category = item.category_slug ?? 'other';
    if ((categoryCount.get(category) ?? 0) >= 2) continue;
    categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
    selected.push(item);
    if (selected.length === 7) break;
  }
  return selected;
}

function weeklyTargetUrl(locale: SocialLocale, slug: string, channel: SocialChannel) {
  const url = new URL(`/${locale}/weekly/${slug}`, SITE_URL);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'weekly_digest');
  return url.toString();
}

function weeklySeeds(
  slug: string,
  items: SourceItem[],
  anchorDate: string,
  now: Date,
  urls: Record<SocialChannel, string>,
  cadence: Record<SocialChannel, ChannelCadence>,
): VariantSeed[] {
  const ukList = items
    .map((item, index) => `${index + 1}. ${text(item.title_uk) || text(item.title_en)}`)
    .join('\n');
  const enList = items
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${text(item.title_en) || text(item.title_uk)}`)
    .join('\n');
  return [
    {
      channel: 'telegram',
      locale: 'uk',
      format: 'weekly_digest',
      text: `Тиждень в AI — ${items.length} головних новин\n\n${ukList}\n\nПовний тижневий дайджест: ${urls.telegram}`,
      trackingToken: urls.telegram.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('uk', slug, 'telegram'),
      scheduledFor: nextWeeklyScheduledForChannel('telegram', anchorDate, now),
    },
    {
      channel: 'instagram',
      locale: 'en',
      format: 'weekly_carousel_4x5',
      text: truncate(
        `The week in AI engineering — ${items.length} stories worth your time.\n\n${enList}\n\nSwipe for the practical context, then save this roundup for your next planning session. Full edition via the link in bio.\n\n#AI #Engineering #AITools`,
        1800,
      ),
      trackingToken: urls.instagram.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('en', slug, 'instagram'),
      scheduledFor: nextWeeklyScheduledForChannel('instagram', anchorDate, now, cadence.instagram),
    },
    {
      channel: 'facebook',
      locale: 'uk',
      format: 'weekly_roundup',
      text: truncate(
        `Підсумки тижня в AI для розробників\n\n${ukList}\n\nМи зібрали контекст і практичні висновки в одному випуску: ${urls.facebook}`,
        1800,
      ),
      trackingToken: urls.facebook.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('uk', slug, 'facebook'),
      scheduledFor: nextWeeklyScheduledForChannel('facebook', anchorDate, now, cadence.facebook),
    },
  ];
}

export async function composeWeeklySocial(
  endDate: string,
  options: { now?: Date } = {},
): Promise<ComposeResult> {
  const now = options.now ?? new Date();
  const cadence = await loadCadence();
  const startDate = shiftDate(endDate, -6);
  const { briefs, items } = await loadApprovedRange(startDate, endDate);
  const selected = selectWeeklyItems(items, briefs);
  if (selected.length < 3)
    return { createdPackageIds: [], skipped: ['fewer_than_three_weekly_items'] };
  if (await existingPackage('weekly_digest', endDate)) {
    return { createdPackageIds: [], skipped: ['weekly_digest_exists'] };
  }

  const supabase = getSupabaseAdmin();
  const slug = `ai-weekly-${startDate}`;
  const { data: digest, error: digestError } = await supabase
    .from('weekly_digests')
    .upsert(
      {
        week_start: startDate,
        slug,
        status: 'in_review',
        title_en: `The week in AI engineering · ${startDate}`,
        title_uk: `Тиждень в AI-інженерії · ${startDate}`,
        intro_en: `${selected.length} approved stories with practical context for builders.`,
        intro_uk: `${selected.length} погоджених новин із практичним контекстом для розробників.`,
      },
      { onConflict: 'week_start' },
    )
    .select('id')
    .single();
  if (digestError) throw new Error(`[social-composer] weekly digest: ${digestError.message}`);

  await supabase.from('weekly_digest_items').delete().eq('weekly_digest_id', digest.id);
  const dateByBrief = new Map(briefs.map((brief) => [brief.id, brief.date]));
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const { error: itemError } = await supabase.from('weekly_digest_items').insert(
    selected.map((item, index) => ({
      weekly_digest_id: digest.id,
      brief_item_id: item.id,
      rank: index + 1,
      snapshot: {
        title_en: item.title_en,
        title_uk: item.title_uk,
        summary_en: item.summary_en,
        summary_uk: item.summary_uk,
        why_en: item.why_matters_en,
        why_uk: item.why_matters_uk,
        item_slug: item.slug,
        brief_slug: briefById.get(item.brief_id)?.slug ?? null,
        brief_date: dateByBrief.get(item.brief_id) ?? null,
      },
    })),
  );
  if (itemError) throw new Error(`[social-composer] weekly items: ${itemError.message}`);

  const lead = selected[0];
  const leadBrief = briefById.get(lead.brief_id) ?? briefs[0];
  const packageId = await createPackage(
    'weekly_digest',
    'green',
    endDate,
    `Weekly digest · ${startDate}`,
    leadBrief.id,
    lead.id,
    digest.id,
    selected.map((item) => item.id),
  );
  const urls = trackingUrls(freshTrackingTokens());
  await saveVariants(
    packageId,
    lead,
    weeklySeeds(slug, selected, endDate, now, urls, cadence),
    now,
    selected,
  );
  await supabase.rpc('auto_approve_green_package', { p_package_id: packageId });
  await notifyPackagesReady([packageId], `Weekly digest · ${startDate}`);
  return { createdPackageIds: [packageId], skipped: [] };
}
