import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { withSocialClickToken } from '@/lib/social/tracked-url';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { socialContentHash } from './content-hash';
import {
  renderDailyVisualSocialAssets,
  type DailyVisualAssetDependencies,
} from './daily-visual-assets';
import {
  readableDailyVisualInstagramParts,
  type DailyVisualInstagramCarouselSpec,
} from './daily-visual-carousel';
import { findBlindCrossPosts, runQualityGate } from './quality';
import { CHANNEL_CADENCE, nextScheduledForChannel } from './schedule';
import type { SocialAsset, SocialChannel, SocialDraft, SocialLocale } from './types';

export const DAILY_VISUAL_SOCIAL_GENERATION_PREFIX = 'daily-visual-v1:';

const DAILY_VISUAL_CHANNEL_MATRIX = [
  { channel: 'telegram', locale: 'uk' },
  { channel: 'facebook', locale: 'uk' },
  { channel: 'threads', locale: 'uk' },
  { channel: 'x', locale: 'en' },
  { channel: 'linkedin', locale: 'en' },
  { channel: 'instagram', locale: 'en' },
] as const satisfies ReadonlyArray<{ channel: SocialChannel; locale: SocialLocale }>;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MUTABLE_DRAFT_STATUSES = ['draft', 'in_review', 'approved', 'scheduled', 'failed'];
const PRESERVED_STATUSES = new Set(['publishing', 'posted', 'needs_reconciliation']);

export type DailyVisualLocalizedText = {
  en: string;
  uk: string;
};

export type DailyVisualApprovedStory = {
  id: string;
  approved: boolean;
  title: DailyVisualLocalizedText;
  whatChanged: DailyVisualLocalizedText;
  whyItMatters: DailyVisualLocalizedText;
};

export type DailyVisualSocialInput = {
  sourceDate: string;
  visualSetId: string;
  selectedPublicMasterUrl: string;
  displayTitle: DailyVisualLocalizedText;
  visualThesis: DailyVisualLocalizedText;
  stories: DailyVisualApprovedStory[];
  lead: {
    briefId: string;
    slug: string;
    briefItemId?: string | null;
  };
};

export type DailyVisualSocialDraft = SocialDraft & {
  trackingToken: string;
};

export type DailyVisualSocialComposeResult = {
  packageId: string;
  postIds: string[];
  reused: boolean;
  supersededPackageIds: string[];
};

export interface DailyVisualSocialComposeOptions {
  now?: Date;
  assetDependencies?: DailyVisualAssetDependencies;
}

type DailyVisualPostSeed = {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  contentParts?: string[];
  firstComment?: string | null;
  instagramCarousel?: DailyVisualInstagramCarouselSpec | null;
};

type PersistedPost = {
  id: string;
  channel: string;
  content_version: number;
  content_hash: string | null;
};

export type DailyVisualSupersessionPackage = {
  id: string;
  status: string;
  generation_version: string;
};

export type DailyVisualSupersessionPost = {
  id: string;
  package_id: string | null;
  status: string;
  channel: string;
  content_version: number;
  content_hash: string | null;
  scheduled_for: string | null;
};

export type DailyVisualPackageRecovery =
  | { action: 'reuse'; postIds: string[] }
  | { action: 'rebuild'; cancellablePostIds: string[] }
  | { action: 'blocked'; reason: string };

function canRebuildIncompletePackage(posts: DailyVisualSupersessionPost[]) {
  // This is intentionally stricter than a normal visual supersession. A
  // same-version package that never finished must either be wholly disposable
  // or be escalated; otherwise a retry could make two drafts for one channel.
  return posts.every((post) => !PRESERVED_STATUSES.has(post.status));
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function jsonValue(value: unknown): Json {
  // All values here are plain editorial data. Normalize once at the JSONB
  // boundary instead of treating structurally typed application objects as DB JSON.
  return JSON.parse(JSON.stringify(value)) as Json;
}

function localized(value: DailyVisualLocalizedText, locale: SocialLocale) {
  return clean(value[locale]);
}

/**
 * A package must be bound to the selected immutable master, not merely to its
 * editorial set. Editors can select a different candidate in the same set;
 * using only the set ID here would then incorrectly reuse derivatives made
 * from the old candidate. The public master path is content-addressed on
 * promotion, and the short hash keeps the database key compact without
 * putting an infrastructure URL into package metadata.
 */
export function dailyVisualPackageGenerationVersion(
  input: Pick<DailyVisualSocialInput, 'visualSetId' | 'selectedPublicMasterUrl'>,
) {
  const masterFingerprint = createHash('sha256')
    .update(input.selectedPublicMasterUrl)
    .digest('hex')
    .slice(0, 20);
  return `${DAILY_VISUAL_SOCIAL_GENERATION_PREFIX}${input.visualSetId}:${masterFingerprint}`;
}

function packageTitle(input: DailyVisualSocialInput) {
  return `Daily visual · ${input.sourceDate} · ${localized(input.displayTitle, 'en')}`;
}

function sourceUrl(input: DailyVisualSocialInput, locale: SocialLocale, channel: SocialChannel) {
  const url = new URL(`/${locale}/${input.lead.slug}`, SITE_URL);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'daily_visual');
  url.searchParams.set('utm_content', input.visualSetId);
  return url.toString();
}

function trackedDestination(
  input: DailyVisualSocialInput,
  locale: SocialLocale,
  channel: SocialChannel,
  token: string,
) {
  return withSocialClickToken(sourceUrl(input, locale, channel), token);
}

function visibleDestination(
  input: DailyVisualSocialInput,
  locale: SocialLocale,
  channel: SocialChannel,
  token: string,
) {
  if (channel === 'x' || channel === 'linkedin') {
    return withSocialClickToken(new URL(`/${locale}/${input.lead.slug}`, SITE_URL).toString(), token);
  }
  return trackedDestination(input, locale, channel, token);
}

function withinLimit(value: string, limit: number) {
  const words = clean(value).split(' ').filter(Boolean);
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > limit) break;
    result = candidate;
  }
  return result || clean(value).slice(0, limit);
}

function storyLine(story: DailyVisualApprovedStory, locale: SocialLocale, numbered?: number) {
  const prefix = numbered ? `${numbered}. ` : '• ';
  const title = localized(story.title, locale);
  const changed = localized(story.whatChanged, locale);
  const why = localized(story.whyItMatters, locale);
  return locale === 'uk'
    ? `${prefix}${title}: ${changed} Чому це важливо: ${why}`
    : `${prefix}${title}: ${changed} Why it matters: ${why}`;
}

function storyAt(input: DailyVisualSocialInput, index: number) {
  return input.stories[index] ?? input.stories[0]!;
}

/**
 * `visualThesis` is an internal direction/QA field. Public social copy gets
 * its explanatory sentence from approved story facts instead of serializing
 * that private instruction verbatim to a reader.
 */
function publicNarrative(input: DailyVisualSocialInput, locale: SocialLocale) {
  const lead = storyAt(input, 0);
  const changed = localized(lead.whatChanged, locale);
  const why = localized(lead.whyItMatters, locale);
  return locale === 'uk'
    ? withinLimit(`${changed} Це важливо, бо ${why}`, 420)
    : withinLimit(`${changed} This matters because ${why}`, 420);
}

function socialFacts(input: DailyVisualSocialInput, locale: SocialLocale) {
  return [
    localized(input.displayTitle, locale),
    publicNarrative(input, locale),
    ...input.stories.flatMap((story) => [
      localized(story.title, locale),
      localized(story.whatChanged, locale),
      localized(story.whyItMatters, locale),
    ]),
  ];
}

function dailySchedule(channel: SocialChannel, sourceDate: string, now: Date) {
  const cadence = { ...CHANNEL_CADENCE[channel], days: EVERY_DAY };
  return nextScheduledForChannel(channel, sourceDate, now, cadence);
}

function englishInstagramSpec(input: DailyVisualSocialInput): DailyVisualInstagramCarouselSpec {
  const stories = input.stories.slice(0, 3);
  const publicLead = publicNarrative(input, 'en');
  const insightSlides = Array.from({ length: 3 }, (_, index) => {
    const story = stories[index];
    if (!story) {
      return {
        kind: 'thesis' as const,
        headline: index === 1 ? 'Why it matters' : 'The day in one idea',
        body: publicLead,
      };
    }
    return {
      kind: 'story' as const,
      storyId: story.id,
      headline: localized(story.title, 'en'),
      body: withinLimit(
        `What changed: ${localized(story.whatChanged, 'en')} Why it matters: ${localized(story.whyItMatters, 'en')}`,
        360,
      ),
    };
  });
  const caption = [
    `Today in AI: ${localized(input.displayTitle, 'en')}`,
    publicLead,
    ...stories.map((story) => withinLimit(storyLine(story, 'en'), 430)),
    'Read the full daily brief through the link in bio. Save this for the next product, research, or engineering discussion.',
    '#AI #Engineering',
  ].join('\n\n');
  return {
    kind: 'daily_visual',
    version: 1,
    caption,
    slides: [
      {
        kind: 'cover',
        headline: localized(input.displayTitle, 'en'),
        // First-contact slide: title only. It deliberately avoids a model
        // generated sentence or a dense paragraph over the image.
        body: null,
      },
      insightSlides[0]!,
      insightSlides[1]!,
      insightSlides[2]!,
      {
        kind: 'cta',
        headline: 'Read the daily brief',
        body: 'Follow AI Today Brief for the signal behind the headlines.',
      },
    ],
  };
}

function telegramSeed(input: DailyVisualSocialInput, url: string): DailyVisualPostSeed {
  return {
    channel: 'telegram',
    locale: 'uk',
    format: 'daily_visual_brief',
    text: [
      `Головний сигнал дня: ${localized(input.displayTitle, 'uk')}`,
      publicNarrative(input, 'uk'),
      ...input.stories.map((story, index) => storyLine(story, 'uk', index + 1)),
      `Повний щоденний бриф: ${url}`,
    ].join('\n\n'),
  };
}

function facebookSeed(input: DailyVisualSocialInput, url: string): DailyVisualPostSeed {
  const focus = storyAt(input, 0);
  return {
    channel: 'facebook',
    locale: 'uk',
    format: 'daily_visual_roundup',
    text: [
      `${localized(input.displayTitle, 'uk')} — не просто добірка заголовків, а зміна, яку варто помітити.`,
      publicNarrative(input, 'uk'),
      `Один конкретний приклад: ${storyLine(focus, 'uk')}`,
      'Для команди це привід перевірити не гучність релізу, а чи змінює він реальну ціну, швидкість або доступність роботи.',
      `Деталі та контекст у щоденному брифі: ${url}`,
    ].join('\n\n'),
  };
}

function threadsSeed(input: DailyVisualSocialInput, url: string): DailyVisualPostSeed {
  const focus = storyAt(input, 1);
  const parts = [
    withinLimit(
      `Питання дня для AI-команди: ${localized(input.displayTitle, 'uk')}. ${publicNarrative(input, 'uk')}`,
      460,
    ),
    withinLimit(`Один показовий зсув: ${storyLine(focus, 'uk')}`, 460),
    'Якщо менший контекст або відкритіші компоненти зберігають якість, планування системи змінюється раніше, ніж змінюється заголовок на ринку.',
    `Що з цього змінить ваш наступний технічний вибір? Повний бриф: ${url}`,
  ];
  return {
    channel: 'threads',
    locale: 'uk',
    format: 'daily_visual_thread',
    text: parts[0]!,
    contentParts: parts,
  };
}

function xSeed(input: DailyVisualSocialInput, url: string): DailyVisualPostSeed {
  const lead = storyAt(input, 0);
  const root = withinLimit(
    `Today’s AI signal: ${localized(input.displayTitle, 'en')}. ${localized(lead.whatChanged, 'en')} The practical question is whether it changes the constraint your team is optimizing next.`,
    270,
  );
  const reply = `Read the full daily brief: ${url}`;
  return {
    channel: 'x',
    locale: 'en',
    format: 'daily_visual_signal',
    text: root,
    contentParts: [root, reply],
    firstComment: reply,
  };
}

function linkedInSeed(input: DailyVisualSocialInput, url: string): DailyVisualPostSeed {
  const focus = storyAt(input, 2);
  return {
    channel: 'linkedin',
    locale: 'en',
    format: 'daily_visual_explainer',
    text: [
      `The AI development worth carrying into tomorrow is ${localized(input.displayTitle, 'en')}.`,
      publicNarrative(input, 'en'),
      `One decision-relevant example: ${storyLine(focus, 'en')}`,
      'The useful habit is to test whether this changes a real decision, workflow, or constraint before treating it as another headline. The complete daily brief is in the first comment.',
    ].join('\n\n'),
    firstComment: `Read the full daily brief: ${url}`,
  };
}

function instagramSeed(input: DailyVisualSocialInput): DailyVisualPostSeed {
  const carousel = englishInstagramSpec(input);
  return {
    channel: 'instagram',
    locale: 'en',
    format: 'daily_visual_carousel_5',
    text: carousel.caption,
    contentParts: readableDailyVisualInstagramParts(carousel),
    instagramCarousel: carousel,
  };
}

function seeds(input: DailyVisualSocialInput, urls: Record<SocialChannel, string>) {
  return [
    telegramSeed(input, urls.telegram),
    facebookSeed(input, urls.facebook),
    threadsSeed(input, urls.threads),
    xSeed(input, urls.x),
    linkedInSeed(input, urls.linkedin),
    instagramSeed(input),
  ];
}

function assetAltText(input: DailyVisualSocialInput, locale: SocialLocale) {
  const label = locale === 'uk' ? 'Візуальний підсумок дня' : 'Visual summary of the day';
  return `${label}: ${localized(input.displayTitle, locale)}.`;
}

function assertInputText(value: string, label: string, maximum: number) {
  const normalized = clean(value);
  if (normalized.length < 3 || normalized.length > maximum) {
    throw new Error(`${label} must contain 3–${maximum} characters.`);
  }
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function assertDailyVisualInput(input: DailyVisualSocialInput) {
  if (!isCalendarDate(input.sourceDate)) {
    throw new Error('Daily visual sourceDate must be YYYY-MM-DD.');
  }
  if (!clean(input.visualSetId) || input.visualSetId.length > 160) {
    throw new Error('Daily visual visualSetId must contain 1–160 characters.');
  }
  if (!clean(input.lead.briefId) || !/^[a-z0-9-]+$/i.test(input.lead.slug)) {
    throw new Error('Daily visual lead requires a brief ID and a safe slug.');
  }
  let master: URL;
  try {
    master = new URL(input.selectedPublicMasterUrl);
  } catch {
    throw new Error('Daily visual selectedPublicMasterUrl must be a public HTTPS URL.');
  }
  if (master.protocol !== 'https:') {
    throw new Error('Daily visual selectedPublicMasterUrl must use HTTPS.');
  }
  for (const locale of ['uk', 'en'] as const) {
    assertInputText(input.displayTitle[locale], `displayTitle.${locale}`, 160);
    assertInputText(input.visualThesis[locale], `visualThesis.${locale}`, 360);
  }
  if (input.stories.length < 1 || input.stories.length > 3) {
    throw new Error('Daily visual requires one to three approved stories.');
  }
  for (const story of input.stories) {
    if (!clean(story.id) || !story.approved) {
      throw new Error('Daily visual stories must have an ID and explicit approved=true.');
    }
    for (const locale of ['uk', 'en'] as const) {
      assertInputText(story.title[locale], `story.title.${locale}`, 180);
      assertInputText(story.whatChanged[locale], `story.whatChanged.${locale}`, 420);
      assertInputText(story.whyItMatters[locale], `story.whyItMatters.${locale}`, 420);
    }
  }
}

function newTrackingUrls(input: DailyVisualSocialInput) {
  const tokens = Object.fromEntries(
    DAILY_VISUAL_CHANNEL_MATRIX.map(({ channel }) => [channel, randomUUID()]),
  ) as Record<SocialChannel, string>;
  const urls = Object.fromEntries(
    DAILY_VISUAL_CHANNEL_MATRIX.map(({ channel, locale }) => [
      channel,
      visibleDestination(input, locale, channel, tokens[channel]),
    ]),
  ) as Record<SocialChannel, string>;
  return { tokens, urls };
}

/**
 * Build all six variants regardless of per-channel cadence. This is deliberately
 * pure aside from the injected derivative renderer, so the finalizer supplies
 * the approved daily snapshot instead of re-querying editorial state here.
 */
export async function buildDailyVisualSocialDrafts(
  input: DailyVisualSocialInput,
  options: {
    packageId: string;
    now?: Date;
    tracking?: { tokens: Record<SocialChannel, string>; urls: Record<SocialChannel, string> };
    renderAssets?: (request: {
      channel: SocialChannel;
      locale: SocialLocale;
      displayTitle: string;
      visualThesis: string;
      instagramCarousel?: DailyVisualInstagramCarouselSpec | null;
    }) => Promise<SocialAsset[]>;
    assetDependencies?: DailyVisualAssetDependencies;
  },
): Promise<DailyVisualSocialDraft[]> {
  assertDailyVisualInput(input);
  const now = options.now ?? new Date();
  const tracking = options.tracking ?? newTrackingUrls(input);
  const draftSeeds = seeds(input, tracking.urls);
  const drafts = await Promise.all(
    draftSeeds.map(async (seed) => {
      const assets = options.renderAssets
        ? await options.renderAssets({
            channel: seed.channel,
            locale: seed.locale,
            displayTitle: localized(input.displayTitle, seed.locale),
            visualThesis: localized(input.visualThesis, seed.locale),
            instagramCarousel: seed.instagramCarousel,
          })
        : await renderDailyVisualSocialAssets(
            {
              packageId: options.packageId,
              visualSetId: input.visualSetId,
              masterImageUrl: input.selectedPublicMasterUrl,
              channel: seed.channel,
              locale: seed.locale,
              displayTitle: localized(input.displayTitle, seed.locale),
              visualThesis: localized(input.visualThesis, seed.locale),
              instagramCarousel: seed.instagramCarousel,
            },
            options.assetDependencies,
          );
      const draft: DailyVisualSocialDraft = {
        channel: seed.channel,
        locale: seed.locale,
        format: seed.format,
        text: seed.text,
        contentParts: seed.contentParts,
        firstComment: seed.firstComment ?? null,
        assets,
        altText: assetAltText(input, seed.locale),
        scheduledFor: dailySchedule(seed.channel, input.sourceDate, now),
        sourceApproved: true,
        sourceFacts: socialFacts(input, seed.locale),
        sourceUrl: sourceUrl(input, seed.locale, seed.channel),
        instagramCarousel: seed.instagramCarousel ?? null,
        trackingToken: tracking.tokens[seed.channel],
      };
      return { ...draft, qualityReport: runQualityGate(draft, now) };
    }),
  );
  const duplicateIssues = findBlindCrossPosts(drafts);
  return drafts.map((draft) => ({
    ...draft,
    qualityReport: {
      ...draft.qualityReport!,
      blocking: [...draft.qualityReport!.blocking, ...(duplicateIssues.get(draft.channel) ?? [])],
    },
  }));
}

function blockingDrafts(drafts: DailyVisualSocialDraft[]) {
  return drafts.filter((draft) => (draft.qualityReport?.blocking.length ?? 0) > 0);
}

function composeError(drafts: DailyVisualSocialDraft[]) {
  const messages = blockingDrafts(drafts).flatMap((draft) =>
    (draft.qualityReport?.blocking ?? []).map((issue) => `${draft.channel}:${issue.code}`),
  );
  return new Error(
    `Daily visual social quality gate blocked the package (${messages.join(', ')}).`,
  );
}

type ExistingDailyVisualPackage = {
  id: string;
  status: string;
  posts: DailyVisualSupersessionPost[];
  generatedReviewPostIds: string[];
};

/**
 * A same-candidate invocation is idempotent only after all six drafts and
 * their immutable generation reviews exist. A partially written package is
 * neither a usable result nor safe to silently reuse: it is rebuilt only when
 * every persisted post is still mutable. Publishing/posted/reconciliation
 * states deliberately require a human instead.
 */
export function planDailyVisualPackageRecovery(input: {
  posts: DailyVisualSupersessionPost[];
  generatedReviewPostIds: string[];
}): DailyVisualPackageRecovery {
  const expectedChannels = new Set(DAILY_VISUAL_CHANNEL_MATRIX.map(({ channel }) => channel));
  const seenChannels = new Set(input.posts.map((post) => post.channel));
  const reviewed = new Set(input.generatedReviewPostIds);
  const complete =
    input.posts.length === DAILY_VISUAL_CHANNEL_MATRIX.length &&
    seenChannels.size === DAILY_VISUAL_CHANNEL_MATRIX.length &&
    [...expectedChannels].every((channel) => seenChannels.has(channel)) &&
    input.posts.every(
      (post) =>
        post.status !== 'cancelled' &&
        !PRESERVED_STATUSES.has(post.status) &&
        reviewed.has(post.id),
    );

  if (complete) return { action: 'reuse', postIds: input.posts.map((post) => post.id) };
  if (!canRebuildIncompletePackage(input.posts)) {
    return {
      action: 'blocked',
      reason:
        'A previous daily social package is incomplete but has publishing, posted, or reconciliation state; review it manually before rebuilding.',
    };
  }
  return {
    action: 'rebuild',
    cancellablePostIds: input.posts
      .filter((post) => MUTABLE_DRAFT_STATUSES.includes(post.status))
      .map((post) => post.id),
  };
}

async function existingDailyVisualPackage(
  sourceDate: string,
  version: string,
): Promise<ExistingDailyVisualPackage | null> {
  const supabase = getSupabaseAdmin();
  const { data: packageRow, error: packageError } = await supabase
    .from('social_packages')
    .select('id,status')
    .eq('kind', 'daily_digest')
    .eq('source_date', sourceDate)
    .eq('generation_version', version)
    .neq('status', 'cancelled')
    .maybeSingle();
  if (packageError)
    throw new Error(`[daily-visual-social] existing package: ${packageError.message}`);
  if (!packageRow) return null;

  const { data: posts, error: postsError } = await supabase
    .from('social_posts')
    .select('id,package_id,status,channel,content_version,content_hash,scheduled_for')
    .eq('package_id', packageRow.id);
  if (postsError) throw new Error(`[daily-visual-social] existing posts: ${postsError.message}`);
  const typedPosts = (posts ?? []) as DailyVisualSupersessionPost[];
  const { data: reviews, error: reviewsError } = await supabase
    .from('social_post_reviews')
    .select('social_post_id')
    .eq('package_id', packageRow.id)
    .eq('action', 'generated');
  if (reviewsError)
    throw new Error(`[daily-visual-social] existing reviews: ${reviewsError.message}`);
  return {
    id: packageRow.id,
    status: packageRow.status,
    posts: typedPosts,
    generatedReviewPostIds: (reviews ?? [])
      .map((review) => review.social_post_id)
      .filter((id): id is string => typeof id === 'string'),
  };
}

function asPostRows(
  input: DailyVisualSocialInput,
  packageId: string,
  drafts: DailyVisualSocialDraft[],
) {
  return drafts.map((draft) => {
    const contentVersion = 1;
    const contentHash = socialContentHash({
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      text: draft.text,
      contentParts: draft.contentParts,
      firstComment: draft.firstComment,
      assets: draft.assets,
      altText: draft.altText,
      scheduledFor: draft.scheduledFor,
      contentVersion,
      instagramCarousel: draft.instagramCarousel,
    });
    return {
      package_id: packageId,
      brief_id: input.lead.briefId,
      brief_item_id: input.lead.briefItemId ?? null,
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      status: 'in_review',
      post_text: draft.text,
      content_parts: draft.contentParts ?? [],
      first_comment: draft.firstComment ?? null,
      asset_urls: jsonValue(draft.assets),
      alt_text: draft.altText ?? null,
      quality_report: jsonValue(draft.qualityReport),
      content_hash: contentHash,
      content_version: contentVersion,
      scheduled_for: draft.scheduledFor,
      idempotency_key: `${packageId}:${draft.channel}:${contentHash.slice(0, 16)}`,
      tracking_token: draft.trackingToken,
      utm_url: withSocialClickToken(draft.sourceUrl, draft.trackingToken),
      meta: jsonValue({
        daily_visual: {
          version: 1,
          visual_set_id: input.visualSetId,
          source_date: input.sourceDate,
          master_image_url: input.selectedPublicMasterUrl,
          derivative_fit: 'contain',
          display_title: localized(input.displayTitle, draft.locale),
          visual_thesis: localized(input.visualThesis, draft.locale),
        },
      }),
    };
  });
}

function generatedReviewRows(
  input: DailyVisualSocialInput,
  packageId: string,
  posts: PersistedPost[],
  drafts: DailyVisualSocialDraft[],
) {
  return posts.map((post) => {
    const draft = drafts.find((candidate) => candidate.channel === post.channel);
    if (!draft) throw new Error(`Daily social post ${post.id} has no matching generated draft.`);
    return {
      social_post_id: post.id,
      package_id: packageId,
      action: 'generated',
      content_version: post.content_version,
      content_hash: post.content_hash,
      snapshot: jsonValue({
        channel: draft.channel,
        locale: draft.locale,
        format: draft.format,
        post_text: draft.text,
        content_parts: draft.contentParts ?? [],
        first_comment: draft.firstComment ?? null,
        asset_urls: draft.assets,
        alt_text: draft.altText ?? null,
        scheduled_for: draft.scheduledFor,
        quality_report: draft.qualityReport,
        daily_visual: { visual_set_id: input.visualSetId },
      }),
    };
  });
}

async function persistDailyVisualPackage(
  input: DailyVisualSocialInput,
  packageId: string,
  version: string,
  drafts: DailyVisualSocialDraft[],
) {
  const supabase = getSupabaseAdmin();
  const { error: packageError } = await supabase.from('social_packages').insert({
    id: packageId,
    kind: 'daily_digest',
    risk_level: 'yellow',
    status: 'in_review',
    source_date: input.sourceDate,
    source_brief_id: input.lead.briefId,
    // Candidate-bound daily packages are one visual thesis, not a top-story
    // package. Keep this null so the active-generation uniqueness key is
    // stable even when the selected lead story is re-ranked.
    source_brief_item_id: null,
    source_item_ids: input.stories.map((story) => story.id),
    title: packageTitle(input),
    generation_version: version,
  });
  if (packageError)
    throw new Error(`[daily-visual-social] create package: ${packageError.message}`);

  const { data: posts, error: postsError } = await supabase
    .from('social_posts')
    .insert(asPostRows(input, packageId, drafts))
    .select('id,channel,content_version,content_hash');
  if (postsError) throw new Error(`[daily-visual-social] create posts: ${postsError.message}`);
  if ((posts ?? []).length !== DAILY_VISUAL_CHANNEL_MATRIX.length) {
    throw new Error('Daily visual social package did not persist all six channel drafts.');
  }
  const typedPosts = posts as PersistedPost[];
  const { error: reviewError } = await supabase
    .from('social_post_reviews')
    .insert(generatedReviewRows(input, packageId, typedPosts, drafts));
  if (reviewError)
    throw new Error(`[daily-visual-social] audit generated drafts: ${reviewError.message}`);
  return typedPosts;
}

/**
 * Replacing a visual operates at post granularity. A package can legitimately
 * be mixed: a Telegram post may already be published while the other five
 * channel drafts are still editable. Preserve the protected post exactly as
 * it is, and cancel only sibling drafts that are still mutable. The database
 * update repeats the status condition to stay safe if a publisher claims a
 * post between planning and mutation.
 */
export function planDailyVisualSupersession(input: {
  packages: DailyVisualSupersessionPackage[];
  posts: DailyVisualSupersessionPost[];
}) {
  const postsByPackage = new Map<string, DailyVisualSupersessionPost[]>();
  for (const post of input.posts) {
    if (!post.package_id) continue;
    postsByPackage.set(post.package_id, [...(postsByPackage.get(post.package_id) ?? []), post]);
  }
  const eligiblePackageIds = input.packages
    .filter((item) =>
      (postsByPackage.get(item.id) ?? []).some((post) =>
        MUTABLE_DRAFT_STATUSES.includes(post.status),
      ),
    )
    .map((item) => item.id);
  const eligible = new Set(eligiblePackageIds);
  return {
    eligiblePackageIds,
    preservedPackageIds: input.packages
      .filter((item) =>
        (postsByPackage.get(item.id) ?? []).some((post) => PRESERVED_STATUSES.has(post.status)),
      )
      .map((item) => item.id),
    cancellablePostIds: input.posts
      .filter((post) => post.package_id && eligible.has(post.package_id))
      .filter((post) => MUTABLE_DRAFT_STATUSES.includes(post.status))
      .map((post) => post.id),
  };
}

function cancellableReviewRows(
  posts: DailyVisualSupersessionPost[],
  replacementPackageId: string,
  visualSetId: string,
) {
  return posts.map((post) => ({
    social_post_id: post.id,
    package_id: post.package_id,
    action: 'cancelled',
    content_version: post.content_version,
    content_hash: post.content_hash,
    snapshot: jsonValue({
      prior_status: post.status,
      channel: post.channel,
      scheduled_for: post.scheduled_for,
      replacement_package_id: replacementPackageId,
      replacement_visual_set_id: visualSetId,
    }),
    note: `Superseded by daily visual candidate ${visualSetId}.`,
  }));
}

function incompletePackageCancellationReviewRows(
  packageId: string,
  visualSetId: string,
  posts: DailyVisualSupersessionPost[],
) {
  return posts.map((post) => ({
    social_post_id: post.id,
    package_id: packageId,
    action: 'cancelled',
    content_version: post.content_version,
    content_hash: post.content_hash,
    snapshot: jsonValue({
      prior_status: post.status,
      channel: post.channel,
      scheduled_for: post.scheduled_for,
      reason: 'incomplete_daily_visual_package',
      visual_set_id: visualSetId,
    }),
    note: 'Incomplete daily visual package cancelled before a safe finalizer retry.',
  }));
}

async function resolveExistingDailyVisualPackage(
  input: DailyVisualSocialInput,
  version: string,
): Promise<DailyVisualSocialComposeResult | null> {
  const existing = await existingDailyVisualPackage(input.sourceDate, version);
  if (!existing) return null;
  const plan = planDailyVisualPackageRecovery(existing);
  if (plan.action === 'reuse') {
    return {
      packageId: existing.id,
      postIds: plan.postIds,
      reused: true,
      supersededPackageIds: [],
    };
  }
  if (plan.action === 'blocked') {
    throw new Error(`[daily-visual-social] ${plan.reason}`);
  }

  const supabase = getSupabaseAdmin();
  const priorPosts = existing.posts.filter((post) => plan.cancellablePostIds.includes(post.id));
  if (plan.cancellablePostIds.length > 0) {
    const { data: cancelled, error: cancelPostsError } = await supabase
      .from('social_posts')
      .update({ status: 'cancelled', retry_after: null })
      .in('id', plan.cancellablePostIds)
      .in('status', MUTABLE_DRAFT_STATUSES)
      .select('id');
    if (cancelPostsError) {
      throw new Error(`[daily-visual-social] cancel incomplete posts: ${cancelPostsError.message}`);
    }
    const cancelledIds = new Set((cancelled ?? []).map((post) => post.id));
    const cancelledPosts = priorPosts.filter((post) => cancelledIds.has(post.id));
    if (cancelledPosts.length > 0) {
      const { error: reviewError } = await supabase
        .from('social_post_reviews')
        .insert(
          incompletePackageCancellationReviewRows(existing.id, input.visualSetId, cancelledPosts),
        );
      if (reviewError) {
        throw new Error(
          `[daily-visual-social] audit incomplete cancellation: ${reviewError.message}`,
        );
      }
    }
  }

  const { data: finalPosts, error: finalPostsError } = await supabase
    .from('social_posts')
    .select('id,status')
    .eq('package_id', existing.id);
  if (finalPostsError) {
    throw new Error(`[daily-visual-social] verify incomplete package: ${finalPostsError.message}`);
  }
  if ((finalPosts ?? []).some((post) => post.status !== 'cancelled')) {
    throw new Error(
      '[daily-visual-social] incomplete package changed concurrently and was not cancelled; review it manually.',
    );
  }
  const { data: cancelledPackage, error: packageError } = await supabase
    .from('social_packages')
    .update({ status: 'cancelled' })
    .eq('id', existing.id)
    .not('status', 'in', '(publishing,posted,needs_reconciliation,cancelled)')
    .select('id')
    .maybeSingle();
  if (packageError) {
    throw new Error(`[daily-visual-social] cancel incomplete package: ${packageError.message}`);
  }
  if (!cancelledPackage) {
    throw new Error(
      '[daily-visual-social] incomplete package entered a protected state and was not cancelled; review it manually.',
    );
  }
  return null;
}

async function supersedePriorDailyVisualDrafts(
  input: DailyVisualSocialInput,
  replacementPackageId: string,
) {
  const supabase = getSupabaseAdmin();
  const { data: packages, error: packageLoadError } = await supabase
    .from('social_packages')
    .select('id,status,generation_version')
    .eq('kind', 'daily_digest')
    .eq('source_date', input.sourceDate)
    .like('generation_version', `${DAILY_VISUAL_SOCIAL_GENERATION_PREFIX}%`)
    .neq('id', replacementPackageId)
    .neq('status', 'cancelled');
  if (packageLoadError) {
    throw new Error(`[daily-visual-social] load prior packages: ${packageLoadError.message}`);
  }
  const priorPackages = (packages ?? []) as DailyVisualSupersessionPackage[];
  if (priorPackages.length === 0) return [];

  const priorIds = priorPackages.map((item) => item.id);
  const { data: posts, error: postLoadError } = await supabase
    .from('social_posts')
    .select('id,package_id,status,channel,content_version,content_hash,scheduled_for')
    .in('package_id', priorIds);
  if (postLoadError)
    throw new Error(`[daily-visual-social] load prior posts: ${postLoadError.message}`);
  const priorPosts = (posts ?? []) as DailyVisualSupersessionPost[];
  const supersession = planDailyVisualSupersession({
    packages: priorPackages,
    posts: priorPosts,
  });
  const eligiblePackageIds = supersession.eligiblePackageIds;
  if (eligiblePackageIds.length === 0) return [];

  const candidateIds = supersession.cancellablePostIds;
  const candidateSet = new Set(candidateIds);
  const candidates = priorPosts.filter((post) => candidateSet.has(post.id));
  if (candidateIds.length > 0) {
    const { data: updated, error: postUpdateError } = await supabase
      .from('social_posts')
      .update({ status: 'cancelled', retry_after: null })
      .in('id', candidateIds)
      .in('status', MUTABLE_DRAFT_STATUSES)
      .select('id,package_id,status,channel,content_version,content_hash,scheduled_for');
    if (postUpdateError) {
      throw new Error(`[daily-visual-social] cancel prior posts: ${postUpdateError.message}`);
    }
    const updatedIds = new Set((updated ?? []).map((post) => post.id));
    const cancelledPosts = candidates.filter((post) => updatedIds.has(post.id));
    if (cancelledPosts.length > 0) {
      const { error: reviewError } = await supabase
        .from('social_post_reviews')
        .insert(cancellableReviewRows(cancelledPosts, replacementPackageId, input.visualSetId));
      if (reviewError) {
        throw new Error(`[daily-visual-social] audit cancelled drafts: ${reviewError.message}`);
      }
    }
  }

  const { data: finalPosts, error: finalLoadError } = await supabase
    .from('social_posts')
    .select('package_id,status')
    .in('package_id', eligiblePackageIds);
  if (finalLoadError)
    throw new Error(`[daily-visual-social] verify prior posts: ${finalLoadError.message}`);
  const finalByPackage = new Map<string, string[]>();
  for (const post of finalPosts ?? []) {
    if (!post.package_id) continue;
    finalByPackage.set(post.package_id, [
      ...(finalByPackage.get(post.package_id) ?? []),
      post.status,
    ]);
  }
  const fullyCancelled = eligiblePackageIds.filter((id) =>
    (finalByPackage.get(id) ?? []).every((status) => status === 'cancelled'),
  );
  if (fullyCancelled.length > 0) {
    const { error: packageUpdateError } = await supabase
      .from('social_packages')
      .update({ status: 'cancelled' })
      .in('id', fullyCancelled)
      .not('status', 'in', '(publishing,posted,needs_reconciliation,cancelled)');
    if (packageUpdateError) {
      throw new Error(`[daily-visual-social] cancel prior packages: ${packageUpdateError.message}`);
    }
  }
  return fullyCancelled;
}

function isDuplicateInsert(error: unknown) {
  return error instanceof Error && /duplicate key|unique constraint/i.test(error.message);
}

/**
 * Persist one candidate-bound daily social package. A same-candidate rerun is
 * idempotent. A new candidate gets a new immutable package; old drafts are
 * only cancelled through post-level conditions that preserve live delivery.
 */
export async function composeDailyVisualSocialPackage(
  input: DailyVisualSocialInput,
  options: DailyVisualSocialComposeOptions = {},
): Promise<DailyVisualSocialComposeResult> {
  assertDailyVisualInput(input);
  const version = dailyVisualPackageGenerationVersion(input);
  // A duplicate may be our own partially persisted candidate after a worker
  // retry, or another worker winning the same candidate race. Resolve that
  // state before generating new derivatives, then make one bounded retry.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reused = await resolveExistingDailyVisualPackage(input, version);
    if (reused) return reused;

    const packageId = randomUUID();
    const drafts = await buildDailyVisualSocialDrafts(input, {
      packageId,
      now: options.now,
      assetDependencies: options.assetDependencies,
    });
    if (blockingDrafts(drafts).length > 0) throw composeError(drafts);

    try {
      const posts = await persistDailyVisualPackage(input, packageId, version, drafts);
      const supersededPackageIds = await supersedePriorDailyVisualDrafts(input, packageId);
      return {
        packageId,
        postIds: posts.map((post) => post.id),
        reused: false,
        supersededPackageIds,
      };
    } catch (error) {
      if (!isDuplicateInsert(error) || attempt === 1) throw error;
    }
  }
  throw new Error('[daily-visual-social] candidate package could not be persisted after retry.');
}

/** A stable non-sensitive fingerprint suitable for a visual-finalizer audit record. */
export function dailyVisualSocialInputHash(input: DailyVisualSocialInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceDate: input.sourceDate,
        visualSetId: input.visualSetId,
        master: input.selectedPublicMasterUrl,
        displayTitle: input.displayTitle,
        visualThesis: input.visualThesis,
        stories: input.stories.map((story) => story.id),
        lead: input.lead,
      }),
    )
    .digest('hex');
}

export function dailyVisualSocialMatrix() {
  return DAILY_VISUAL_CHANNEL_MATRIX.map((item) => ({ ...item }));
}
