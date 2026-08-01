import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createWeeklyEditorialDraft } from '@/lib/weekly-digest/editorial-draft';
import {
  buildDigestSelectionContext,
  citationUrlsFromUnknown,
  factCountFromUnknown,
  selectEditorialDigestItems,
  WEEKLY_SELECTION_VERSION,
  type DigestCandidate,
} from '../../../pipeline/weekly-digest';
import { renderSocialAssets } from './assets';
import { socialContentHash } from './content-hash';
import { attachCriticReport } from './critic';
import { findBlindCrossPosts, runQualityGate } from './quality';
import {
  channelRunsOnDate,
  completedWeeklyRangeForTrigger,
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
const WEEKLY_ARTIFACT_QUEUE_VERSION = 'weekly-auto-v2';

interface UntypedRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

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
}

interface SourceArticle {
  id: string;
  source_name: string;
  url: string;
  composite_score: number | null;
  score_authority: number | null;
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
  weeklyDigestId?: string;
}

function blank(value: string | null | undefined) {
  return !value?.trim();
}

function emptyTakeaways(value: Json | null | undefined) {
  return (
    !Array.isArray(value) || value.every((entry) => typeof entry !== 'string' || !entry.trim())
  );
}

function weeklyEditorialDraftFor(items: SourceItem[]) {
  return createWeeklyEditorialDraft(
    items.map((item) => ({
      id: item.id,
      category_slug: item.category_slug,
      title_en: item.title_en,
      title_uk: item.title_uk,
      summary_en: item.summary_en,
      summary_uk: item.summary_uk,
      why_matters_en: item.why_matters_en,
      why_matters_uk: item.why_matters_uk,
      facts_en: item.facts_en,
      facts_uk: item.facts_uk,
    })),
  );
}

/**
 * Revisions and their story rows are append-only. When legacy initialization
 * left editorial fields blank, create a replacement immutable revision rather
 * than mutating it. The RPC returns the current revision unchanged if its
 * editorial payload is already complete.
 */
async function ensureWeeklyEditorialDraftRevision(
  weeklyDigestId: string,
  revisionId: string,
  sourceItems: SourceItem[],
) {
  const db = getSupabaseAdmin();
  const draft = weeklyEditorialDraftFor(sourceItems);
  const [revisionResult, itemsResult] = await Promise.all([
    db.from('weekly_digest_revisions').select('*').eq('id', revisionId).single(),
    db.from('weekly_digest_revision_items').select('*').eq('revision_id', revisionId).order('rank'),
  ]);
  if (revisionResult.error || !revisionResult.data) {
    throw new Error(
      `[social-composer] editorial draft revision: ${revisionResult.error?.message ?? 'missing'}`,
    );
  }
  if (itemsResult.error || !itemsResult.data) {
    throw new Error(
      `[social-composer] editorial draft stories: ${itemsResult.error?.message ?? 'missing'}`,
    );
  }

  const revision = revisionResult.data;
  const draftsBySourceId = new Map(draft.stories.map((story) => [story.id, story]));
  const nextItems = itemsResult.data.map((item) => {
    const story = item.brief_item_id ? draftsBySourceId.get(item.brief_item_id) : undefined;
    if (!story) {
      throw new Error(
        `[social-composer] editorial draft is missing source ${item.brief_item_id ?? item.id}`,
      );
    }
    return {
      brief_item_id: item.brief_item_id,
      rank: item.rank,
      title_en: item.title_en,
      title_uk: item.title_uk,
      summary_en: item.summary_en,
      summary_uk: item.summary_uk,
      body_en:
        blank(item.body_en) || item.body_en.trim() === item.summary_en.trim()
          ? story.body_en
          : item.body_en,
      body_uk:
        blank(item.body_uk) || item.body_uk.trim() === item.summary_uk.trim()
          ? story.body_uk
          : item.body_uk,
      why_en: item.why_en,
      why_uk: item.why_uk,
      practical_en: blank(item.practical_en) ? story.practical_en : item.practical_en,
      practical_uk: blank(item.practical_uk) ? story.practical_uk : item.practical_uk,
      takeaway_en: blank(item.takeaway_en) ? story.takeaway_en : item.takeaway_en,
      takeaway_uk: blank(item.takeaway_uk) ? story.takeaway_uk : item.takeaway_uk,
      event_date: item.event_date,
      sources: item.sources,
      source_snapshot: item.source_snapshot,
    };
  });
  const editorNoteEn = blank(revision.editor_note_en)
    ? draft.editor_note_en
    : revision.editor_note_en;
  const editorNoteUk = blank(revision.editor_note_uk)
    ? draft.editor_note_uk
    : revision.editor_note_uk;
  const takeawaysEn = emptyTakeaways(revision.key_takeaways_en)
    ? draft.key_takeaways_en
    : revision.key_takeaways_en;
  const takeawaysUk = emptyTakeaways(revision.key_takeaways_uk)
    ? draft.key_takeaways_uk
    : revision.key_takeaways_uk;
  const needsRevision =
    editorNoteEn !== revision.editor_note_en ||
    editorNoteUk !== revision.editor_note_uk ||
    takeawaysEn !== revision.key_takeaways_en ||
    takeawaysUk !== revision.key_takeaways_uk ||
    nextItems.some((item, index) => {
      const current = itemsResult.data[index];
      return (
        item.body_en !== current.body_en ||
        item.body_uk !== current.body_uk ||
        item.practical_en !== current.practical_en ||
        item.practical_uk !== current.practical_uk ||
        item.takeaway_en !== current.takeaway_en ||
        item.takeaway_uk !== current.takeaway_uk
      );
    });
  if (!needsRevision) return revisionId;

  const rpc = db as unknown as UntypedRpcClient;
  const { data, error } = await rpc.rpc('create_service_weekly_digest_revision', {
    p_weekly_digest_id: weeklyDigestId,
    p_title_en: revision.title_en,
    p_title_uk: revision.title_uk,
    p_intro_en: revision.intro_en ?? '',
    p_intro_uk: revision.intro_uk ?? '',
    p_editor_note_en: editorNoteEn,
    p_editor_note_uk: editorNoteUk,
    p_key_takeaways_en: takeawaysEn,
    p_key_takeaways_uk: takeawaysUk,
    p_items: nextItems,
    p_reason: 'composer_editorial_draft',
  });
  if (error || typeof data !== 'string') {
    throw new Error(
      `[social-composer] editorial revision: ${error?.message ?? 'replacement revision was not returned'}`,
    );
  }
  return data;
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
  if (briefs.length === 0) {
    return { briefs, items: [] as SourceItem[], articles: [] as SourceArticle[] };
  }
  const { data: itemRows, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id,brief_id,article_id,canonical_item_id,rank,slug,impact_level,category_slug,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,social_hook_en,social_hook_uk,facts_en,facts_uk,citations,card_image_url,review_status',
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
      'id,source_name,url,composite_score,score_authority,score_cross_source,score_breadth,score_version,cluster_id,mentions_count',
    )
    .in('id', articleIds);
  if (articleError) throw new Error(`[social-composer] weekly articles: ${articleError.message}`);
  return {
    briefs,
    items,
    articles: (articleRows ?? []) as SourceArticle[],
  };
}

function weeklyCandidates(
  items: SourceItem[],
  briefs: SourceBrief[],
  articles: SourceArticle[],
): DigestCandidate[] {
  const dateByBrief = new Map(briefs.map((brief) => [brief.id, brief.date]));
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const articleById = new Map(articles.map((article) => [article.id, article]));
  return items.flatMap((item) => {
    const article = item.article_id ? articleById.get(item.article_id) : undefined;
    const brief = briefById.get(item.brief_id);
    if (!article || !brief || !item.slug || !item.article_id) return [];
    return [
      {
        id: item.id,
        articleId: item.article_id,
        canonicalItemId: item.canonical_item_id ?? null,
        title_en: text(item.title_en),
        title_uk: text(item.title_uk),
        summary_en: text(item.summary_en),
        summary_uk: text(item.summary_uk),
        why_matters_en: text(item.why_matters_en),
        why_matters_uk: text(item.why_matters_uk),
        impact_level: item.impact_level,
        category_slug: item.category_slug,
        itemSlug: item.slug,
        date: dateByBrief.get(item.brief_id) ?? '',
        rank: item.rank,
        citationUrls: citationUrlsFromUnknown(item.citations),
        factsEnCount: factCountFromUnknown(item.facts_en),
        factsUkCount: factCountFromUnknown(item.facts_uk),
        sourceName: article.source_name,
        sourceUrl: article.url,
        compositeScore: article.composite_score,
        authorityScore: article.score_authority,
        crossSourceScore: article.score_cross_source,
        breadthScore: article.score_breadth,
        scoreVersion: article.score_version,
        clusterId: article.cluster_id,
        mentionsCount: article.mentions_count ?? 1,
      },
    ];
  });
}

function weeklyTargetUrl(locale: SocialLocale, slug: string, channel: SocialChannel) {
  const url = new URL(`/${locale}/weekly/${slug}`, SITE_URL);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'weekly_digest');
  return url.toString();
}

function weeklyTitleList(
  items: SourceItem[],
  locale: SocialLocale,
  options: { separator?: string; maxTitleChars?: number } = {},
) {
  const separator = options.separator ?? '\n';
  const maxTitleChars = options.maxTitleChars ?? 160;
  return items
    .map((item, index) => {
      const title = locale === 'uk' ? text(item.title_uk) : text(item.title_en);
      return `${index + 1}. ${truncate(title, maxTitleChars)}`;
    })
    .join(separator);
}

function weeklySeeds(
  slug: string,
  items: SourceItem[],
  anchorDate: string,
  now: Date,
  urls: Record<SocialChannel, string>,
): VariantSeed[] {
  const ukList = weeklyTitleList(items, 'uk');
  const enList = weeklyTitleList(items, 'en');
  const xList = weeklyTitleList(items, 'en', {
    separator: '; ',
    maxTitleChars: Math.max(20, Math.floor(150 / items.length)),
  });
  const threadsList = weeklyTitleList(items, 'en', {
    separator: '; ',
    maxTitleChars: 24,
  });
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
      channel: 'x',
      locale: 'en',
      format: 'weekly_digest',
      text: truncate(
        `This week in AI: ${xList}. ${items.length} evidence-backed developments, with the practical context in the full digest. Link in the reply.`,
        280,
      ),
      firstComment: `Read the full weekly digest: ${urls.x}`,
      trackingToken: urls.x.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('en', slug, 'x'),
      scheduledFor: nextWeeklyScheduledForChannel('x', anchorDate, now),
    },
    {
      channel: 'threads',
      locale: 'en',
      format: 'weekly_conversation',
      text: `This week’s AI engineering shifts: ${threadsList}. We reviewed the evidence and practical implications across all ${items.length} stories. Which change will affect your work first? ${urls.threads}`,
      trackingToken: urls.threads.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('en', slug, 'threads'),
      scheduledFor: nextWeeklyScheduledForChannel('threads', anchorDate, now),
    },
    {
      channel: 'linkedin',
      locale: 'en',
      format: 'weekly_insight',
      text: `The week in AI engineering: ${items.length} developments worth acting on.\n\n${enList}\n\nWe selected these stories for evidence quality, industry impact, and practical value—not headline volume. The full edition explains what changed, why it matters, and what builders, technical leaders, and product teams can do next.\n\nRead the complete Weekly Digest: ${urls.linkedin}\n\n#AI #Engineering #AITools`,
      trackingToken: urls.linkedin.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('en', slug, 'linkedin'),
      scheduledFor: nextWeeklyScheduledForChannel('linkedin', anchorDate, now),
    },
    {
      channel: 'instagram',
      locale: 'en',
      format: 'weekly_carousel_4x5',
      text: `The week in AI engineering — ${items.length} stories worth your time.\n\n${enList}\n\nSwipe for the practical context, then save this roundup for your next planning session. Full edition via the link in bio.\n\n#AI #Engineering #AITools`,
      trackingToken: urls.instagram.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('en', slug, 'instagram'),
      scheduledFor: nextWeeklyScheduledForChannel('instagram', anchorDate, now),
    },
    {
      channel: 'facebook',
      locale: 'uk',
      format: 'weekly_roundup',
      text: `Підсумки тижня в AI для розробників\n\n${ukList}\n\nМи перевірили джерела та зібрали контекст, значення й практичні висновки до кожної новини в одному випуску: ${urls.facebook}`,
      trackingToken: urls.facebook.split('/').at(-1)!,
      sourceUrl: weeklyTargetUrl('uk', slug, 'facebook'),
      scheduledFor: nextWeeklyScheduledForChannel('facebook', anchorDate, now),
    },
  ];
}

async function queueInitialWeeklyArtifacts(
  weeklyDigestId: string,
  revisionId: string,
  items: SourceItem[],
) {
  const db = getSupabaseAdmin();
  const [revisionResult, itemResult, articleResult] = await Promise.all([
    db.from('weekly_digest_revisions').select('*').eq('id', revisionId).single(),
    db
      .from('weekly_digest_revision_items')
      .select('id,brief_item_id,rank,title_en,title_uk')
      .eq('revision_id', revisionId)
      .order('rank'),
    db
      .from('weekly_digest_artifacts')
      .select('slot_key')
      .eq('revision_id', revisionId)
      .eq('is_current', true)
      .in('slot_key', ['article:en', 'article:uk']),
  ]);
  if (revisionResult.error || !revisionResult.data) {
    throw new Error(
      `[social-composer] weekly artifact queue: ${
        revisionResult.error?.message ?? 'revision missing'
      }`,
    );
  }
  const revision = revisionResult.data;
  const revisionItems = itemResult.data;
  if (itemResult.error || !revisionItems) {
    throw new Error(
      `[social-composer] weekly artifact queue: ${
        itemResult.error?.message ?? 'revision items missing'
      }`,
    );
  }
  if (articleResult.error) {
    throw new Error(`[social-composer] weekly article artifacts: ${articleResult.error.message}`);
  }
  const currentArticleSlots = new Set(
    (articleResult.data ?? []).map((artifact) => artifact.slot_key),
  );
  for (const locale of ['en', 'uk'] as const) {
    if (currentArticleSlots.has(`article:${locale}`)) continue;
    const { error } = await db.rpc('save_weekly_digest_artifact', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: revisionId,
      p_artifact_type: 'article',
      p_locale: locale,
      p_slot_key: `article:${locale}`,
      p_generation_status: 'ready',
      p_review_status: 'in_review',
      p_content: {
        title: locale === 'uk' ? revision.title_uk : revision.title_en,
        intro: locale === 'uk' ? revision.intro_uk : revision.intro_en,
        editor_note: locale === 'uk' ? revision.editor_note_uk : revision.editor_note_en,
        key_takeaways: locale === 'uk' ? revision.key_takeaways_uk : revision.key_takeaways_en,
        story_count: revisionItems.length,
      } as Json,
      p_metadata: { format: 'weekly-landing-v2', source: 'initial_revision' } as Json,
    });
    if (error) throw new Error(`[social-composer] initialize article ${locale}: ${error.message}`);
  }
  const sourceById = new Map(items.map((item) => [item.id, item]));
  const jobs: Array<{
    type: 'story_image' | 'cover' | 'pdf';
    key: string;
    input: Json;
  }> = [
    ...revisionItems.map((item) => {
      const source = item.brief_item_id ? sourceById.get(item.brief_item_id) : null;
      return {
        type: 'story_image' as const,
        key: `story-image:${item.id}`,
        input: {
          revision_item_id: item.id,
          alt_text: item.title_en,
          alt_text_uk: item.title_uk,
          source_url: null,
          source_card_image_url: source?.card_image_url ?? null,
        } as Json,
      };
    }),
    {
      type: 'cover',
      key: 'cover:neutral',
      input: { locale: 'neutral', slot_key: 'cover:neutral' } as Json,
    },
    {
      type: 'pdf',
      key: 'pdf:en',
      input: { locale: 'en', slot_key: 'pdf:en' } as Json,
    },
    {
      type: 'pdf',
      key: 'pdf:uk',
      input: { locale: 'uk', slot_key: 'pdf:uk' } as Json,
    },
  ];

  for (const job of jobs) {
    const { error } = await db.rpc('queue_weekly_digest_generation_job', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: revisionId,
      p_job_type: job.type,
      p_idempotency_key: `${WEEKLY_ARTIFACT_QUEUE_VERSION}:${weeklyDigestId}:${revisionId}:${job.key}`,
      p_input: job.input,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`[social-composer] queue ${job.key}: ${error.message}`);
    }
  }
}

export async function composeWeeklySocial(
  triggerDate: string,
  options: { now?: Date; testMode?: boolean; manual?: boolean } = {},
): Promise<ComposeResult> {
  const now = options.now ?? new Date();
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
    const sourceItems = existingSources;
    const revisionId = await ensureWeeklyEditorialDraftRevision(
      existingTest.id,
      existingTest.active_revision_id,
      sourceItems,
    );
    await queueInitialWeeklyArtifacts(existingTest.id, revisionId, sourceItems);

    const { data: existingPackage, error: existingPackageError } = await supabase
      .from('social_packages')
      .select('id')
      .eq('weekly_digest_id', existingTest.id)
      .eq('weekly_digest_revision_id', revisionId)
      .neq('status', 'cancelled')
      .maybeSingle();
    if (existingPackageError) {
      throw new Error(`[social-composer] existing test package: ${existingPackageError.message}`);
    }
    if (existingPackage) {
      return {
        weeklyDigestId: existingTest.id,
        createdPackageIds: [],
        skipped: ['test_weekly_digest_resumed'],
      };
    }

    const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
    const lead = sourceItems[0];
    const leadBrief = briefById.get(lead.brief_id) ?? briefs[0];
    const packageId = await createPackage(
      'weekly_digest',
      'yellow',
      endDate,
      `Test weekly digest · ${startDate}`,
      leadBrief.id,
      lead.id,
      existingTest.id,
      sourceItems.map((item) => item.id),
      revisionId,
      generationVersion,
    );
    const urls = trackingUrls(freshTrackingTokens());
    await saveVariants(
      packageId,
      lead,
      weeklySeeds(slug, sourceItems, endDate, now, urls),
      now,
      sourceItems,
    );
    await notifyPackagesReady([packageId], `Test Weekly Digest · ${startDate}`);
    return {
      weeklyDigestId: existingTest.id,
      createdPackageIds: [packageId],
      skipped: ['test_weekly_digest_resumed'],
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
  const dateByBrief = new Map(briefs.map((brief) => [brief.id, brief.date]));
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const scoreByItemId = new Map(selection.selected.map((scored) => [scored.candidate.id, scored]));
  const editorialDraft = weeklyEditorialDraftFor(selected);
  const storyDraftsById = new Map(editorialDraft.stories.map((story) => [story.id, story]));
  const { error: itemError } = await supabase.from('weekly_digest_items').insert(
    selected.map((item, index) => {
      const scored = scoreByItemId.get(item.id);
      const storyDraft = storyDraftsById.get(item.id);
      const snapshot = {
        title_en: item.title_en,
        title_uk: item.title_uk,
        summary_en: item.summary_en,
        summary_uk: item.summary_uk,
        why_en: item.why_matters_en,
        why_uk: item.why_matters_uk,
        body_en: storyDraft?.body_en ?? item.summary_en,
        body_uk: storyDraft?.body_uk ?? item.summary_uk,
        practical_en: storyDraft?.practical_en ?? null,
        practical_uk: storyDraft?.practical_uk ?? null,
        takeaway_en: storyDraft?.takeaway_en ?? item.why_matters_en,
        takeaway_uk: storyDraft?.takeaway_uk ?? item.why_matters_uk,
        item_slug: item.slug,
        brief_slug: briefById.get(item.brief_id)?.slug ?? null,
        brief_date: dateByBrief.get(item.brief_id) ?? null,
        card_image_url: item.card_image_url,
        editorial_selection: scored
          ? {
              version: WEEKLY_SELECTION_VERSION,
              score: scored.score,
              breakdown: scored.breakdown,
              reasons: scored.reasons,
              source_name: scored.candidate.sourceName,
              source_url: scored.candidate.sourceUrl,
              cluster_id: scored.candidate.clusterId,
              impact_level: scored.candidate.impact_level,
              category_slug: scored.candidate.category_slug,
              citation_urls: scored.candidate.citationUrls,
            }
          : null,
      } as unknown as Json;
      return {
        weekly_digest_id: digest.id,
        brief_item_id: item.id,
        rank: index + 1,
        snapshot,
      };
    }),
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
  const editorialRevisionId = await ensureWeeklyEditorialDraftRevision(
    digest.id,
    revisionId,
    selected,
  );
  await queueInitialWeeklyArtifacts(digest.id, editorialRevisionId, selected);

  const lead = selected[0];
  const leadBrief = briefById.get(lead.brief_id) ?? briefs[0];
  const packageId = await createPackage(
    'weekly_digest',
    'yellow',
    endDate,
    `${testMode ? 'Test weekly digest' : 'Weekly digest'} · ${startDate}`,
    leadBrief.id,
    lead.id,
    digest.id,
    selected.map((item) => item.id),
    editorialRevisionId,
    generationVersion,
  );
  const urls = trackingUrls(freshTrackingTokens());
  await saveVariants(
    packageId,
    lead,
    weeklySeeds(slug, selected, endDate, now, urls),
    now,
    selected,
  );
  await notifyPackagesReady(
    [packageId],
    `${testMode ? 'Test Weekly Digest' : 'Weekly digest'} · ${startDate}`,
  );
  return { weeklyDigestId: digest.id, createdPackageIds: [packageId], skipped: [] };
}
