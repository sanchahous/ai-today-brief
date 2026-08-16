import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  startWeeklyContentStudio,
  weeklyContentStudioMode,
} from '@/lib/weekly-digest/orchestrator';
import {
  weeklyCandidates,
  weeklyStorySnapshot,
} from '@/lib/weekly-digest/selection-snapshot';
import {
  buildDigestSelectionContext,
  selectEditorialDigestItems,
} from '../../../pipeline/weekly-digest';
import { renderSocialAssets } from './assets';
import { socialContentHash } from './content-hash';
import { attachCriticReport } from './critic';
import { findBlindCrossPosts, runQualityGate } from './quality';
import {
  channelRunsOnDate,
  completedWeeklyRangeForTrigger,
  nextScheduledForChannel,
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
  article_id?: string;
  canonical_item_id?: string | null;
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
  citations?: Json | null;
  card_image_url: string | null;
  review_status: string;
  // Long-form daily copy — only loaded for the weekly range, where it seeds the
  // story body / practical example / takeaway (see `seedStoryContent`).
  body_md_en?: string | null;
  body_md_uk?: string | null;
  deep_dive_en?: string | null;
  deep_dive_uk?: string | null;
  takeaways_en?: Json | null;
  takeaways_uk?: Json | null;
  action_items_en?: Json | null;
  action_items_uk?: Json | null;
  when_to_use_en?: Json | null;
  when_to_use_uk?: Json | null;
}

interface SourceArticle {
  id: string;
  source_name: string;
  url: string;
  composite_score: number | null;
  score_cross_source: number | null;
  score_breadth: number | null;
  score_version: number | null;
  cluster_id: string | null;
  mentions_count: number | null;
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

function publicStoryUrl(item: SourceItem, locale: SocialLocale, channel: SocialChannel) {
  const path = item.category_slug
    ? `/${locale}/news/${item.category_slug}/${item.slug}`
    : `/${locale}/news`;
  const url = new URL(path, SITE_URL);
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
      sourceUrl: publicStoryUrl(item, 'en', 'x'),
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
      sourceUrl: publicStoryUrl(item, 'en', 'threads'),
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
      sourceUrl: publicStoryUrl(item, 'en', 'linkedin'),
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
      sourceUrl: publicStoryUrl(item, 'en', 'instagram'),
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
      sourceUrl: publicStoryUrl(item, 'uk', 'facebook'),
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

async function existingPackage(
  kind: PackageKind,
  sourceDate: string,
  generationVersion = SOCIAL_GENERATION_VERSION,
) {
  const { data } = await getSupabaseAdmin()
    .from('social_packages')
    .select('id')
    .eq('kind', kind)
    .eq('source_date', sourceDate)
    .eq('generation_version', generationVersion)
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
  weeklyDigestRevisionId?: string,
  generationVersion = SOCIAL_GENERATION_VERSION,
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
      weekly_digest_revision_id: weeklyDigestRevisionId ?? null,
      title,
      status: 'in_review',
      generation_version: generationVersion,
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
          sourceImageUrls: factItems.map((sourceItem) => sourceItem.card_image_url),
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
      return { ...draft, qualityReport: await attachCriticReport(draft, rules, getSupabaseAdmin()) };
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
  weeklyDigestId?: string;
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
    const seeds = topStorySeeds(topItem, sourceDate, now, urls, cadence);
    if (seeds.length > 0) await saveVariants(packageId, topItem, seeds, now);
    createdPackageIds.push(packageId);
  }

  await notifyPackagesReady(createdPackageIds, `Daily content · ${sourceDate}`);
  return { createdPackageIds, skipped };
}

/**
 * The week's approved daily items plus their article telemetry — the single
 * input of weekly selection. Exported so the admin "rebuild selection" action
 * reads exactly what the scheduled composer reads.
 */
export async function loadApprovedRange(startDate: string, endDate: string) {
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
  if (briefs.length === 0) {
    return { briefs, items: [] as SourceItem[], articles: [] as SourceArticle[] };
  }
  const { data: itemRows, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id,brief_id,article_id,canonical_item_id,rank,slug,impact_level,category_slug,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,social_hook_en,social_hook_uk,facts_en,facts_uk,citations,card_image_url,review_status,body_md_en,body_md_uk,deep_dive_en,deep_dive_uk,takeaways_en,takeaways_uk,action_items_en,action_items_uk,when_to_use_en,when_to_use_uk',
    )
    .in(
      'brief_id',
      briefs.map((brief) => brief.id),
    )
    .eq('review_status', 'approved');
  if (itemError) throw new Error(`[social-composer] ${itemError.message}`);
  const items = (itemRows ?? []).filter((item) => item.slug) as SourceItem[];
  if (items.length === 0) return { briefs, items, articles: [] as SourceArticle[] };
  const articleIds = items.flatMap((item) => (item.article_id ? [item.article_id] : []));
  if (articleIds.length === 0) return { briefs, items, articles: [] as SourceArticle[] };
  const { data: articleRows, error: articleError } = await supabase
    .from('articles')
    .select(
      'id,source_name,url,composite_score,score_cross_source,score_breadth,score_version,cluster_id,mentions_count',
    )
    .in('id', articleIds);
  if (articleError) throw new Error(`[social-composer] weekly articles: ${articleError.message}`);
  return {
    briefs,
    items,
    articles: (articleRows ?? []) as SourceArticle[],
  };
}


export async function composeWeeklySocial(
  triggerDate: string,
  options: { now?: Date; testMode?: boolean; manual?: boolean } = {},
): Promise<ComposeResult> {
  const testMode = options.testMode === true;
  const manual = options.manual === true;
  const { weekStart: startDate, weekEnd: endDate } = completedWeeklyRangeForTrigger(triggerDate);
  const generationVersion = testMode
    ? `${SOCIAL_GENERATION_VERSION}-test`
    : SOCIAL_GENERATION_VERSION;
  const supabase = getSupabaseAdmin();
  let existingTest: { id: string; slug: string; active_revision_id: string | null } | null = null;
  if (testMode) {
    const { data, error } = await supabase
      .from('weekly_digests')
      .select('id,slug,active_revision_id')
      .eq('week_start', startDate)
      .eq('is_test', true)
      .maybeSingle();
    if (error) throw new Error(`[social-composer] existing test weekly digest: ${error.message}`);
    existingTest = data;
  }
  if (!testMode && !manual) {
    const { data, error } = await supabase
      .from('weekly_digests')
      .select('id')
      .eq('week_start', startDate)
      .eq('is_test', false)
      .eq('is_manually_created', true)
      .maybeSingle();
    if (error) throw new Error(`[social-composer] existing manual weekly digest: ${error.message}`);
    if (data) {
      return {
        weeklyDigestId: data.id,
        createdPackageIds: [],
        skipped: ['manual_weekly_digest_exists'],
      };
    }
  }
  const { briefs, items, articles } = await loadApprovedRange(startDate, endDate);
  const selection = selectEditorialDigestItems(weeklyCandidates(items, briefs, articles));
  const selectionContext = buildDigestSelectionContext(selection);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const selected = selection.selected.flatMap(({ candidate }) => {
    const item = itemById.get(candidate.id);
    return item ? [item] : [];
  });
  if (selected.length < 3)
    return {
      createdPackageIds: [],
      skipped: [
        `fewer_than_three_editorially_eligible_weekly_items:${selection.eligible.length}/${items.length}`,
      ],
    };

  const slug =
    existingTest?.slug ?? (testMode ? `ai-weekly-test-${endDate}` : `ai-weekly-${startDate}`);
  if (existingTest?.active_revision_id) {
    const { data: existingRevisionItems, error: existingItemsError } = await supabase
      .from('weekly_digest_revision_items')
      .select('brief_item_id')
      .eq('revision_id', existingTest.active_revision_id)
      .order('rank');
    if (existingItemsError) {
      throw new Error(`[social-composer] existing test stories: ${existingItemsError.message}`);
    }
    const selectedById = new Map(selected.map((item) => [item.id, item]));
    const existingSources = (existingRevisionItems ?? []).flatMap((item) =>
      item.brief_item_id && selectedById.get(item.brief_item_id)
        ? [selectedById.get(item.brief_item_id)!]
        : [],
    );
    if (existingSources.length !== existingRevisionItems.length) {
      throw new Error(
        '[social-composer] test Weekly Digest sources changed; its saved story set cannot be resumed safely.',
      );
    }
    const revisionId = existingTest.active_revision_id;
    const studioMode = weeklyContentStudioMode();
    if (studioMode !== 'off') {
      await startWeeklyContentStudio(existingTest.id, revisionId);
    }
    return {
      weeklyDigestId: existingTest.id,
      createdPackageIds: [],
      skipped: [
        studioMode === 'off'
          ? 'weekly_content_studio_v2_off'
          : 'test_weekly_digest_research_queued',
      ],
    };
  }

  if (await existingPackage('weekly_digest', endDate, generationVersion)) {
    return { createdPackageIds: [], skipped: ['weekly_digest_exists'] };
  }

  const { data: digest, error: digestError } = await supabase
    .from('weekly_digests')
    .upsert(
      {
        week_start: startDate,
        week_end: endDate,
        period_model: 'rolling_7d',
        is_manually_created: manual,
        is_test: testMode,
        slug,
        status: 'in_review',
        title_en: `The week in AI engineering · ${startDate}`,
        title_uk: `Тиждень в AI-інженерії · ${startDate}`,
        intro_en: `${selected.length} evidence-backed stories selected for impact, corroboration, and practical value.`,
        intro_uk: `${selected.length} доказових новин, відібраних за впливом, підтвердженням і практичною цінністю.`,
      },
      { onConflict: 'week_start,is_test' },
    )
    .select('id')
    .single();
  if (digestError) throw new Error(`[social-composer] weekly digest: ${digestError.message}`);

  const { error: selectionRunError } = await supabase.from('weekly_digest_selection_runs').insert({
    weekly_digest_id: digest.id,
    algorithm_version: selection.version,
    rationale_version: selectionContext.rationale.version,
    week_start: startDate,
    week_end: endDate,
    candidate_count: selectionContext.rationale.metrics.candidateCount,
    eligible_count: selectionContext.rationale.metrics.eligibleCount,
    rejected_count: selectionContext.rationale.metrics.rejectedCount,
    selected_count: selectionContext.rationale.metrics.selectedCount,
    rationale: selectionContext.rationale as unknown as Json,
    candidate_pool: selectionContext.candidates as unknown as Json,
  });
  if (selectionRunError) {
    throw new Error(`[social-composer] weekly selection run: ${selectionRunError.message}`);
  }

  await supabase.from('weekly_digest_items').delete().eq('weekly_digest_id', digest.id);
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const scoreByItemId = new Map(selection.selected.map((scored) => [scored.candidate.id, scored]));
  const { error: itemError } = await supabase.from('weekly_digest_items').insert(
    selected.map((item, index) => ({
      weekly_digest_id: digest.id,
      brief_item_id: item.id,
      rank: index + 1,
      snapshot: weeklyStorySnapshot({
        item,
        scored: scoreByItemId.get(item.id),
        rank: index + 1,
        briefSlug: briefById.get(item.brief_id)?.slug ?? null,
        briefDate: briefById.get(item.brief_id)?.date ?? null,
      }),
    })),
  );
  if (itemError) throw new Error(`[social-composer] weekly items: ${itemError.message}`);
  const { data: revisionId, error: revisionError } = await supabase.rpc(
    'initialize_weekly_digest_revision_from_legacy',
    { p_weekly_digest_id: digest.id },
  );
  if (revisionError || typeof revisionId !== 'string') {
    throw new Error(
      `[social-composer] weekly revision: ${revisionError?.message ?? 'initializer returned no revision'}`,
    );
  }
  const studioMode = weeklyContentStudioMode();
  if (studioMode !== 'off') {
    await startWeeklyContentStudio(digest.id, revisionId);
  }
  return {
    weeklyDigestId: digest.id,
    createdPackageIds: [],
    skipped: [
      studioMode === 'off' ? 'weekly_content_studio_v2_off' : 'weekly_digest_research_queued',
    ],
  };
}
