import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordGenerationCost } from '@/lib/generation-costs';
import { alertWeeklyDigestIssue } from './alerts';
import type { WeeklyPdfInput } from './pdf';
import type { WeeklyVisualInput, WeeklyVisualLocale } from './visuals';
import { storageBlob } from '@/lib/storage/binary';
import { socialContentHash } from '@/lib/social/content-hash';
import { findBlindCrossPosts } from '@/lib/social/quality';
import {
  SOCIAL_CHANNELS,
  type QualityReport,
  type SocialAsset,
  type SocialChannel,
  type SocialLocale,
} from '@/lib/social/types';
import { nextWeeklyScheduledForChannel } from '@/lib/social/schedule';
import {
  canonicalSourceName,
  contentFingerprint,
  editorialQualityFailures,
  editorialQualityRetryGuidance,
  placementForRank,
  REQUIRED_QUALITY_DIMENSIONS,
  resolveWeeklyContentStudioMode,
  sourceNameMatchesDomain,
  WEEKLY_CONTENT_STUDIO_VERSION,
  WEEKLY_MASTER_SPEC_VERSION,
  WEEKLY_VIDEO_MANIFEST_VERSION,
  WEEKLY_VIDEO_SCRIPT_SCHEMA_VERSION,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyQualityDimension,
  type WeeklyResearchPack,
  type WeeklyVideoScript,
} from './content-studio';
import {
  generateWeeklyMaster,
  splitMasterRetryGuidance,
  type WeeklyMasterCheckpoint,
  type WeeklyMasterEnglishResult,
  type WeeklyMasterInputStory,
  type WeeklyMasterRetryGuidance,
  type WeeklyMasterUkrainianResult,
} from './editorial-llm';
import { generateWeeklyVideoScript } from './video-script-llm';
import {
  buildWeeklyResearchPack,
  isWeeklyResearchPack,
  trustedWeeklyResearchSources,
} from './research';
import { adaptWeeklySocialChannel, type WeeklySocialAdaptation } from './social-adapter';

const PRIVATE_BUCKET = 'weekly-digest-private';
const MAX_JOBS = 10;

// This module backs /api/internal/weekly/generate, polled every 5 minutes,
// 24/7, by a Supabase pg_cron job. On the common case where
// claimGenerationJobs() below finds nothing to do, eagerly loading native/
// heavy deps (sharp, @napi-rs/canvas via ./visuals, pdfkit/pdfjs-dist via
// ./pdf, ./pdf-preview and ./linkedin-document) at module scope would pay
// that cost on every empty poll. Load them lazily, only inside the handler
// that actually needs them, and cache the import so a warm instance that
// processes several jobs of the same type doesn't reload it each time.
let sharpPromise: Promise<typeof import('sharp')> | null = null;
async function lazySharp() {
  sharpPromise ??= import('sharp');
  return (await sharpPromise).default;
}
let pdfPromise: Promise<typeof import('./pdf')> | null = null;
function lazyPdf() {
  return (pdfPromise ??= import('./pdf'));
}
let pdfPreviewPromise: Promise<typeof import('./pdf-preview')> | null = null;
function lazyPdfPreview() {
  return (pdfPreviewPromise ??= import('./pdf-preview'));
}
let visualsPromise: Promise<typeof import('./visuals')> | null = null;
function lazyVisuals() {
  return (visualsPromise ??= import('./visuals'));
}
let cardImagePromise: Promise<typeof import('../../../pipeline/card-image')> | null = null;
function lazyCardImage() {
  return (cardImagePromise ??= import('../../../pipeline/card-image'));
}
let linkedinDocumentPromise: Promise<typeof import('./linkedin-document')> | null = null;
function lazyLinkedinDocument() {
  return (linkedinDocumentPromise ??= import('./linkedin-document'));
}

interface RpcError {
  message: string;
}

interface UntypedRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
}

interface ClaimedGenerationJob {
  id: string;
  weekly_digest_id: string;
  revision_id: string;
  job_type: string;
  attempts: number;
  input: Json;
}

function rpcClient() {
  return getSupabaseAdmin() as unknown as UntypedRpcClient;
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: Json | null | undefined) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 1800);
}

function retryableGenerationFailure(message: string) {
  return /\b(?:429|5\d\d)\b|timed? out|timeout|fetch failed|network|econnreset|eai_again|temporar(?:y|ily)|rate limit|connection reset/i.test(
    message,
  );
}

function contentStudioJobMode(job: ClaimedGenerationJob) {
  const activeMode = resolveWeeklyContentStudioMode(process.env.WEEKLY_CONTENT_STUDIO_V2);
  if (activeMode === 'off') {
    throw new Error('WEEKLY_CONTENT_STUDIO_V2 is off. Content Studio jobs are paused.');
  }
  const requestedMode = text(asRecord(job.input).mode);
  if (requestedMode !== 'shadow' && requestedMode !== 'production') {
    throw new Error('Content Studio job is missing an explicit shadow or production mode.');
  }
  if (requestedMode !== activeMode) {
    throw new Error(
      `Content Studio job mode ${requestedMode} does not match active mode ${activeMode}.`,
    );
  }
  return requestedMode;
}

const ALL_GENERATION_JOB_TYPES: string[] = [
  'research_pack',
  'editorial_master',
  'story_image',
  'cover',
  'social_copy',
  'video_script',
  'video_manifest',
  'pdf',
  'social_asset',
];

async function claimGenerationJobs(
  limit: number,
  jobTypes: string[] = ALL_GENERATION_JOB_TYPES,
): Promise<ClaimedGenerationJob[]> {
  const { data, error } = await rpcClient().rpc('claim_weekly_digest_generation_jobs', {
    p_job_types: jobTypes,
    p_limit: Math.max(1, Math.min(Math.trunc(limit), MAX_JOBS)),
  });
  if (error) throw new Error(`[weekly-generation] claim: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.weekly_digest_id !== 'string' ||
      typeof row.revision_id !== 'string' ||
      typeof row.job_type !== 'string' ||
      typeof row.attempts !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        weekly_digest_id: row.weekly_digest_id,
        revision_id: row.revision_id,
        job_type: row.job_type,
        attempts: row.attempts,
        input: (row.input ?? {}) as Json,
      },
    ];
  });
}

async function finishGenerationJob(
  jobId: string,
  succeeded: boolean,
  output: Record<string, Json | undefined>,
  errorMessage: string | null,
  artifactId?: string | null,
) {
  const { error } = await rpcClient().rpc('finish_weekly_digest_generation_job', {
    p_job_id: jobId,
    p_succeeded: succeeded,
    p_output: output,
    p_error: errorMessage,
    p_artifact_id: artifactId ?? null,
  });
  if (error) throw new Error(`[weekly-generation] finish: ${error.message}`);
}

async function uploadPrivate(
  path: string,
  bytes: Buffer,
  contentType: string,
  cacheControl = '31536000, immutable',
) {
  const db = getSupabaseAdmin();
  const { error } = await db.storage
    .from(PRIVATE_BUCKET)
    .upload(path, storageBlob(bytes, contentType), {
      contentType,
      cacheControl,
      upsert: false,
    });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`[weekly-generation] upload: ${error.message}`);
  }
  const { data: stored, error: verifyError } = await db.storage.from(PRIVATE_BUCKET).download(path);
  if (verifyError || !stored) {
    throw new Error(
      `[weekly-generation] upload verification: ${verifyError?.message ?? 'empty file'}`,
    );
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
    throw new Error('[weekly-generation] upload verification: stored bytes do not match source.');
  }
}

async function saveGeneratedArtifact(input: {
  weeklyDigestId: string;
  revisionId: string;
  revisionItemId?: string | null;
  artifactType: string;
  locale: 'neutral' | 'en' | 'uk';
  slotKey: string;
  content?: Record<string, Json | undefined>;
  storagePath?: string | null;
  externalUrl?: string | null;
  provider?: string | null;
  providerId?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  byteSize?: number | null;
  metadata?: Record<string, Json | undefined>;
}) {
  const { data, error } = await rpcClient().rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: input.weeklyDigestId,
    p_revision_id: input.revisionId,
    p_revision_item_id: input.revisionItemId ?? null,
    p_artifact_type: input.artifactType,
    p_locale: input.locale,
    p_slot_key: input.slotKey,
    p_generation_status: 'ready',
    p_review_status: 'in_review',
    p_content: input.content ?? {},
    p_storage_bucket: input.storagePath ? PRIVATE_BUCKET : null,
    p_storage_path: input.storagePath ?? null,
    p_external_url: input.externalUrl ?? null,
    p_provider: input.provider ?? null,
    p_provider_id: input.providerId ?? null,
    p_mime_type: input.mimeType ?? null,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_byte_size: input.byteSize ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`[weekly-generation] save artifact: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Artifact RPC did not return an ID.');
  return data;
}

async function signedArtifactUrl(
  artifact: {
    external_url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
  },
  expiresIn = 180,
) {
  if (artifact.external_url?.startsWith('http')) return artifact.external_url;
  if (!artifact.storage_bucket || !artifact.storage_path) return null;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(artifact.storage_bucket)
    .createSignedUrl(artifact.storage_path, expiresIn);
  return error ? null : data.signedUrl;
}

async function loadGenerationContext(job: ClaimedGenerationJob) {
  const db = getSupabaseAdmin();
  const [digestResult, revisionResult, itemsResult, artifactsResult] = await Promise.all([
    db
      .from('weekly_digests')
      .select('*')
      .eq('id', job.weekly_digest_id)
      .eq('active_revision_id', job.revision_id)
      .single(),
    db.from('weekly_digest_revisions').select('*').eq('id', job.revision_id).single(),
    db
      .from('weekly_digest_revision_items')
      .select('*')
      .eq('revision_id', job.revision_id)
      .order('rank'),
    db
      .from('weekly_digest_artifacts')
      .select('*')
      .eq('revision_id', job.revision_id)
      .eq('is_current', true),
  ]);
  if (digestResult.error || !digestResult.data) throw new Error('Active digest was not found.');
  if (revisionResult.error || !revisionResult.data) throw new Error('Revision was not found.');
  if (itemsResult.error || !itemsResult.data) throw new Error('Revision stories were not found.');
  if (artifactsResult.error || !artifactsResult.data) throw new Error('Artifacts were not found.');
  const briefItemIds = itemsResult.data
    .map((item) => item.brief_item_id)
    .filter((briefItemId): briefItemId is string => Boolean(briefItemId));
  const { data: briefItems, error: briefItemsError } = await db
    .from('brief_items')
    .select('id,article_id,citations,facts_en')
    .in('id', briefItemIds);
  if (briefItemsError || !briefItems) {
    throw new Error('Approved brief-item source lineage was not found.');
  }
  const articleIds = briefItems
    .map((item) => item.article_id)
    .filter((articleId): articleId is string => Boolean(articleId));
  const { data: articles, error: articlesError } = await db
    .from('articles')
    .select('id,url')
    .in('id', articleIds);
  if (articlesError || !articles) {
    throw new Error('Approved article source lineage was not found.');
  }
  const briefItemById = new Map(briefItems.map((item) => [item.id, item]));
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const items = itemsResult.data.map((item) => {
    const briefItem = item.brief_item_id ? briefItemById.get(item.brief_item_id) : null;
    const article = briefItem?.article_id ? articleById.get(briefItem.article_id) : null;
    if (!briefItem || !article?.url) return item;
    const sources = trustedWeeklyResearchSources({
      articleUrl: article.url,
      revisionSources: item.sources,
      citations: briefItem.citations,
    });
    const snapshot = asRecord(item.source_snapshot);
    return {
      ...item,
      sources: sources.length ? sources : item.sources,
      source_snapshot: {
        ...snapshot,
        facts_en: snapshot.facts_en ?? briefItem.facts_en ?? [],
      },
    };
  });
  return {
    digest: digestResult.data,
    revision: revisionResult.data,
    items,
    artifacts: artifactsResult.data,
  };
}

function jsonSources(value: Json): Array<{ name: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const url = text(row.url) ?? text(row.source_url);
    if (!url?.startsWith('https://')) return [];
    return [{ name: canonicalSourceName(url), url }];
  });
}

function assertRadarSourceSanity(items: Array<{ id: string; rank: number; sources: Json }>) {
  for (const item of items.filter((candidate) => candidate.rank > 3)) {
    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      throw new Error(`Radar story ${item.id} has no approved HTTPS source.`);
    }
    for (const entry of item.sources) {
      const row = asRecord(entry);
      const url = text(row.url) ?? text(row.source_url);
      const name = text(row.name) ?? text(row.source_name);
      if (!url?.startsWith('https://')) {
        throw new Error(`Radar story ${item.id} contains an invalid source URL.`);
      }
      if (name && !sourceNameMatchesDomain(name, url)) {
        throw new Error(
          `Radar story ${item.id} source label "${name}" does not match ${new URL(url).hostname}.`,
        );
      }
    }
  }
}

function approvedFactsForItem(item: {
  rank: number;
  summary_en: string;
  why_en: string | null;
  source_snapshot: Json;
}) {
  const snapshot = asRecord(item.source_snapshot);
  const facts = Array.isArray(snapshot.facts_en)
    ? snapshot.facts_en.flatMap((entry) => {
        if (typeof entry === 'string') return [entry];
        const row = asRecord(entry);
        return [text(row.fact), text(row.text), text(row.claim), text(row.value)]
          .filter((value): value is string => Boolean(value))
          .slice(0, 1);
      })
    : [];
  return [item.summary_en, item.why_en ?? '', ...facts]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(
      (value, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
    )
    .slice(0, 10)
    .map((claim, index) => ({
      id: `W${item.rank}-C${index + 1}`,
      text: claim,
      evidenceUrls: [] as string[],
    }));
}

async function generateResearchPack(job: ClaimedGenerationJob) {
  contentStudioJobMode(job);
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const revisionItemId = text(input.revision_item_id);
  const item = context.items.find((candidate) => candidate.id === revisionItemId);
  if (!item || item.rank > 3) {
    throw new Error('Research jobs are reserved for the Top 3 feature stories.');
  }
  const pack = await buildWeeklyResearchPack({
    digestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    item,
  });
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    revisionItemId: item.id,
    artifactType: 'research_pack',
    locale: 'neutral',
    slotKey: `research:${item.id}`,
    content: pack as unknown as Record<string, Json | undefined>,
    provider: 'source-enrichment',
    providerId: WEEKLY_CONTENT_STUDIO_VERSION,
    metadata: {
      schema_version: pack.schemaVersion,
      placement: pack.placement,
      primary_domain: pack.primarySource.domain,
      source_label_verified: true,
      independent_source_count: pack.corroboratingSources.length,
      risk_flags: pack.risks,
      excerpt_policy: 'max-12000-chars-per-source',
    },
  });
  return {
    artifactId,
    output: {
      revision_item_id: item.id,
      claim_count: pack.claims.length,
      corroborating_source_count: pack.corroboratingSources.length,
      risk_flags: pack.risks,
    },
  };
}

function researchPacksFromContext(context: Awaited<ReturnType<typeof loadGenerationContext>>) {
  return context.artifacts.flatMap((artifact) => {
    if (
      artifact.artifact_type !== 'research_pack' ||
      !artifact.is_current ||
      artifact.generation_status !== 'ready' ||
      artifact.review_status !== 'approved' ||
      !isWeeklyResearchPack(artifact.content)
    ) {
      return [];
    }
    return [{ artifact, pack: artifact.content as unknown as WeeklyResearchPack }];
  });
}

/**
 * Owner-set editorial angle per story (PR4, editorial quality overhaul),
 * keyed by brief_item_id so it survives the revision churn a Save mints
 * (#177/#187 fragility history). Missing/errored lookups degrade to "no
 * angle" rather than failing the job -- an angle is a quality booster the
 * writer treats as binding *when present*, never a hard requirement.
 */
async function loadStoryDirections(weeklyDigestId: string): Promise<Map<string, string>> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_story_directions')
    .select('brief_item_id,angle')
    .eq('weekly_digest_id', weeklyDigestId);
  if (error || !data) return new Map();
  return new Map(
    data.flatMap((row) => (row.brief_item_id && row.angle ? [[row.brief_item_id, row.angle]] : [])),
  );
}

export function masterInputStories(
  context: Awaited<ReturnType<typeof loadGenerationContext>>,
  approvedResearch: ReturnType<typeof researchPacksFromContext>,
  directionsByBriefItemId: Map<string, string> = new Map(),
) {
  const researchByItem = new Map(
    approvedResearch.map(({ artifact, pack }) => [artifact.revision_item_id!, pack]),
  );
  return context.items.map((item): WeeklyMasterInputStory => {
    const research = researchByItem.get(item.id);
    const sources = jsonSources(item.sources);
    const claims = research?.claims ?? approvedFactsForItem(item);
    const angle = item.brief_item_id ? directionsByBriefItemId.get(item.brief_item_id) : undefined;
    return {
      revisionItemId: item.id,
      rank: item.rank,
      placement: placementForRank(item.rank),
      titleEn: item.title_en,
      titleUk: item.title_uk,
      summaryEn: item.summary_en,
      summaryUk: item.summary_uk,
      whyEn: item.why_en,
      whyUk: item.why_uk,
      sources,
      claims: claims.map((claim) => ({
        id: claim.id,
        text: claim.text,
        evidenceUrls:
          'evidenceUrls' in claim && Array.isArray(claim.evidenceUrls)
            ? claim.evidenceUrls
            : sources.map((source) => source.url),
      })),
      ...(research ? { research } : {}),
      ...(angle ? { angle } : {}),
    };
  });
}

function blockerGuidanceFromReport(
  report: { content: Json } | undefined,
): WeeklyMasterRetryGuidance[] {
  const issues = asRecord(report?.content).issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((entry) => {
    const row = asRecord(entry);
    const code = text(row.code);
    const message = text(row.message);
    if (row.blocker !== true || !code || !message) return [];
    const locale = text(row.locale);
    return [
      {
        code,
        message,
        ...(text(row.suggestedFix) ? { suggestedFix: text(row.suggestedFix)! } : {}),
        ...(locale === 'en' || locale === 'uk' ? { locale } : {}),
        ...(text(row.revisionItemId)
          ? { revisionItemId: text(row.revisionItemId)! }
          : {}),
        ...(text(row.field) ? { field: text(row.field)! } : {}),
      },
    ];
  });
}

/**
 * A low dimension score (e.g. naturalness/parity below their floor) is not a
 * `blocker` issue, so `blockerGuidanceFromReport` never sees it -- a retry
 * after that kind of failure had no instruction to act on and just re-rolled
 * the same prompt. Mirrors `editorialQualityRetryGuidance` (content-studio.ts)
 * but parses the loosely-typed JSON `content` column the way
 * `blockerGuidanceFromReport` does, instead of assuming a validated report.
 */
function dimensionGuidanceFromReport(
  report: { content: Json } | undefined,
): WeeklyMasterRetryGuidance[] {
  const known = new Set<string>(REQUIRED_QUALITY_DIMENSIONS);
  const rawDimensions = asRecord(report?.content).dimensions;
  if (!Array.isArray(rawDimensions)) return [];
  const dimensions = rawDimensions.flatMap((entry) => {
    const row = asRecord(entry);
    const name = text(row.name);
    const score = Number(row.score);
    if (!name || !known.has(name) || !Number.isFinite(score)) return [];
    return [
      { name, score, note: text(row.note) ?? '' } as WeeklyQualityDimension,
    ];
  });
  return editorialQualityRetryGuidance({ dimensions });
}

/**
 * PR3 (2026-08-06) narrowed this from "every past critic verdict, merged and
 * de-duped" to just the latest one. The accumulate-forever version had a
 * one-way ratchet bug: a code, once it appeared for a given revisionItemId+
 * field, was echoed on every subsequent retry prompt forever, even after the
 * writer fixed it -- nothing ever *removed* an entry once a later report
 * stopped reproducing it, because the merge only ever added/overwrote. Each
 * retry's prompt monotonically grew and its latitude monotonically shrank,
 * which is the documented mechanism behind "retries get blander." The
 * latest critic verdict is a complete, self-consistent picture of what's
 * currently wrong -- that's the only guidance a fresh attempt needs.
 */
async function priorMasterRetryGuidance(
  revisionId: string,
): Promise<WeeklyMasterRetryGuidance[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_artifacts')
    .select('content,created_at')
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'content_quality_report')
    .eq('slot_key', 'content-quality:master')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`[weekly-generation] retry guidance lookup: ${error.message}`);

  const latest = data?.[0];
  if (!latest) return [];
  return [...blockerGuidanceFromReport(latest), ...dimensionGuidanceFromReport(latest)];
}

async function saveQualityReport(input: {
  weeklyDigestId: string;
  revisionId: string;
  report: WeeklyContentQualityReport;
  generation: Awaited<ReturnType<typeof generateWeeklyMaster>>['generation'];
  passed: boolean;
  jobId?: string;
  /**
   * The gate-failure path saves this same report a second time, against a
   * draft revision, purely so the draft carries its own visible explanation
   * in the admin UI — the LLM spend it describes was already recorded once,
   * against `job.revision_id`, so that second save must not record it again.
   */
  recordCost?: boolean;
}) {
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: input.weeklyDigestId,
    revisionId: input.revisionId,
    artifactType: 'content_quality_report',
    locale: 'neutral',
    slotKey: 'content-quality:master',
    content: input.report as unknown as Record<string, Json | undefined>,
    provider: input.generation.critic.provider,
    providerId: input.generation.critic.model,
    metadata: {
      passed: input.passed,
      score: input.report.score,
      prompt_version: input.generation.critic.promptVersion,
      generation: input.generation as unknown as Json,
      estimated_cost_usd: Object.values(input.generation).reduce(
        (sum, generation) => sum + generation.estimatedCostUsd,
        0,
      ),
      cost_source: Object.values(input.generation).every(
        (generation) => generation.costSource === 'reported',
      )
        ? 'reported'
        : 'estimated',
    },
  });
  if (input.recordCost ?? true) {
    for (const [step, meta] of Object.entries(input.generation)) {
      await recordGenerationCost({
        scope: 'weekly',
        kind: 'llm',
        provider: meta.provider,
        model: meta.model,
        costUsd: meta.estimatedCostUsd,
        costSource: meta.costSource,
        promptTokens: meta.promptTokens,
        outputTokens: meta.outputTokens,
        weeklyDigestId: input.weeklyDigestId,
        revisionId: input.revisionId,
        jobId: input.jobId ?? null,
        artifactId,
        metadata: { step, prompt_version: meta.promptVersion },
      });
    }
  }
  return artifactId;
}

async function queuePostMasterJobs(
  weeklyDigestId: string,
  revisionId: string,
  items: Array<{ id: string; title_en: string; title_uk: string }>,
) {
  const jobs: Array<{ type: string; key: string; input: Record<string, Json | undefined> }> = [
    ...items.map((item) => ({
      type: 'story_image',
      key: `story-image:${item.id}`,
      input: {
        revision_item_id: item.id,
        alt_text: item.title_en,
        alt_text_uk: item.title_uk,
      },
    })),
    { type: 'cover', key: 'cover:neutral', input: { locale: 'en', slot_key: 'cover:neutral' } },
    { type: 'social_copy', key: 'social-copy', input: { locale_map: 'database' } },
    { type: 'video_script', key: 'video-script:en', input: { locale: 'en' } },
    { type: 'video_manifest', key: 'video-manifest:en', input: { locale: 'en' } },
    { type: 'pdf', key: 'pdf:en', input: { locale: 'en', slot_key: 'pdf:en' } },
    { type: 'pdf', key: 'pdf:uk', input: { locale: 'uk', slot_key: 'pdf:uk' } },
  ];
  for (const queued of jobs) {
    const { error } = await rpcClient().rpc('queue_weekly_digest_generation_job', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: revisionId,
      p_job_type: queued.type,
      p_idempotency_key: `${WEEKLY_CONTENT_STUDIO_VERSION}:${weeklyDigestId}:${revisionId}:${queued.key}`,
      p_input: queued.input,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`[weekly-generation] queue ${queued.key}: ${error.message}`);
    }
  }
}

// Target is $3/digest; $4 is the hard stop enforced below.
const DEFAULT_WEEKLY_MASTER_MAX_SPEND_USD = 4;

/** Sum of estimated_cost_usd across every artifact ever generated for a revision. */
async function revisionSpendSoFarUsd(revisionId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_artifacts')
    .select('metadata')
    .eq('revision_id', revisionId);
  if (error) throw new Error(`[weekly-generation] revision spend lookup: ${error.message}`);
  return (data ?? []).reduce((sum, row) => {
    const cost = asRecord(row.metadata).estimated_cost_usd;
    return sum + (typeof cost === 'number' && Number.isFinite(cost) ? cost : 0);
  }, 0);
}

async function assertWithinMasterBudget(revisionId: string) {
  const maxSpend = Number(process.env.WEEKLY_MASTER_MAX_SPEND_USD ?? DEFAULT_WEEKLY_MASTER_MAX_SPEND_USD);
  const cap = Number.isFinite(maxSpend) ? maxSpend : DEFAULT_WEEKLY_MASTER_MAX_SPEND_USD;
  const spent = await revisionSpendSoFarUsd(revisionId);
  if (spent >= cap) {
    throw new Error(
      `[weekly-generation] Digest revision ${revisionId} has already spent $${spent.toFixed(2)}, at or over the $${cap.toFixed(2)} cap. Refusing further master generation.`,
    );
  }
}

/**
 * Identifies whether a prior attempt's English write (article+video+social
 * angles) is still valid to reuse: changes iff the research packs or the
 * English-relevant slice of retry guidance change. Takes the *full*,
 * unsplit guidance list and filters internally (via
 * `splitMasterRetryGuidance`, the same split `generateWeeklyMaster` uses for
 * the prompts themselves) rather than trusting the caller to pre-filter --
 * a caller that accidentally passed unfiltered guidance would otherwise
 * silently defeat the whole point of the split with no type error to catch
 * it. `naturalness`/`parity` guidance is Ukrainian-only, so a retry that
 * only needs to fix the Ukrainian translation leaves this hash — and
 * therefore the already-paid English/video write — untouched.
 */
export function computeEnglishCheckpointHash(
  researchPacks: WeeklyResearchPack[],
  retryGuidance: WeeklyMasterRetryGuidance[],
): string {
  const { english: englishGuidance } = splitMasterRetryGuidance(retryGuidance);
  return createHash('sha256')
    .update(
      JSON.stringify({ researchPacks, englishGuidance, promptVersion: WEEKLY_MASTER_SPEC_VERSION }),
    )
    .digest('hex');
}

/**
 * Ukrainian write is valid to reuse only if the research packs, the
 * Ukrainian-relevant guidance, AND the English checkpoint it was translated
 * from are all unchanged — a fresh English pass always invalidates the
 * existing Ukrainian translation, even without new Ukrainian-tagged guidance.
 * Same full-list-in, filter-internally contract as computeEnglishCheckpointHash.
 */
export function computeUkrainianCheckpointHash(
  researchPacks: WeeklyResearchPack[],
  englishCheckpointHash: string,
  retryGuidance: WeeklyMasterRetryGuidance[],
): string {
  const { ukrainian: ukrainianGuidance } = splitMasterRetryGuidance(retryGuidance);
  return createHash('sha256')
    .update(
      JSON.stringify({
        researchPacks,
        englishCheckpointHash,
        ukrainianGuidance,
        promptVersion: WEEKLY_MASTER_SPEC_VERSION,
      }),
    )
    .digest('hex');
}

type MasterCheckpointOutput = {
  englishCheckpointHash?: string;
  ukrainianCheckpointHash?: string;
  english?: WeeklyMasterEnglishResult;
  ukrainian?: WeeklyMasterUkrainianResult;
};

async function loadMasterCheckpoint(
  jobId: string,
  expectedEnglishHash: string,
  expectedUkrainianHash: string,
): Promise<WeeklyMasterCheckpoint | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_generation_jobs')
    .select('output')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(`[weekly-generation] checkpoint lookup: ${error.message}`);
  const output = asRecord(data?.output as Json | undefined) as MasterCheckpointOutput;
  const english = output.englishCheckpointHash === expectedEnglishHash ? output.english : undefined;
  const ukrainian =
    output.ukrainianCheckpointHash === expectedUkrainianHash ? output.ukrainian : undefined;
  if (!english && !ukrainian) return null;
  return { english, ukrainian };
}

async function saveMasterCheckpoint(
  jobId: string,
  englishCheckpointHash: string,
  ukrainianCheckpointHash: string,
  checkpoint: WeeklyMasterCheckpoint,
) {
  const output: MasterCheckpointOutput = {
    englishCheckpointHash,
    ukrainianCheckpointHash,
    ...checkpoint,
  };
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('weekly_digest_generation_jobs')
    .update({ output: output as unknown as Json })
    .eq('id', jobId);
  if (error) throw new Error(`[weekly-generation] checkpoint save: ${error.message}`);
}

async function generateEditorialMaster(job: ClaimedGenerationJob) {
  const requestedMode = contentStudioJobMode(job);
  await assertWithinMasterBudget(job.revision_id);
  const context = await loadGenerationContext(job);
  assertRadarSourceSanity(context.items);
  const approvedResearch = researchPacksFromContext(context);
  const featureIds = context.items.filter((item) => item.rank <= 3).map((item) => item.id);
  if (
    approvedResearch.length !== 3 ||
    featureIds.some(
      (id) => !approvedResearch.some(({ artifact }) => artifact.revision_item_id === id),
    )
  ) {
    throw new Error('Approve all three current Top 3 research packs before master generation.');
  }
  const directionsByBriefItemId = await loadStoryDirections(job.weekly_digest_id);
  const sourceStories = masterInputStories(context, approvedResearch, directionsByBriefItemId);
  const researchPacks = approvedResearch.map(({ pack }) => pack);
  const retryGuidance = await priorMasterRetryGuidance(job.revision_id);
  const englishCheckpointHash = computeEnglishCheckpointHash(researchPacks, retryGuidance);
  const ukrainianCheckpointHash = computeUkrainianCheckpointHash(
    researchPacks,
    englishCheckpointHash,
    retryGuidance,
  );
  const checkpoint = await loadMasterCheckpoint(job.id, englishCheckpointHash, ukrainianCheckpointHash);
  // Accumulates across both onStepComplete calls so the ukrainian save doesn't
  // clobber the english step just persisted moments earlier in this same run.
  let runningCheckpoint = checkpoint;
  const result = await generateWeeklyMaster(sourceStories, researchPacks, retryGuidance, {
    checkpoint,
    onStepComplete: async (step, stepResult) => {
      runningCheckpoint = {
        english: step === 'english' ? (stepResult as WeeklyMasterEnglishResult) : runningCheckpoint!.english,
        ukrainian:
          step === 'ukrainian' ? (stepResult as WeeklyMasterUkrainianResult) : runningCheckpoint?.ukrainian,
      };
      await saveMasterCheckpoint(job.id, englishCheckpointHash, ukrainianCheckpointHash, runningCheckpoint);
    },
  });
  const failures = editorialQualityFailures(result.quality);
  if (failures.length > 0) {
    const qualityArtifactId = await saveQualityReport({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      report: result.quality,
      generation: result.generation,
      passed: false,
      jobId: job.id,
    });
    // Everything the LLM produced (article EN/UK) is real,
    // paid-for content -- discarding it because one dimension missed its
    // floor is what stranded it in a job's internal checkpoint last time,
    // invisible outside a raw DB query. Save it as an inactive draft
    // revision instead: it shows up in Overview -> Editorial versions next
    // to the still-untouched active revision, and the owner decides whether
    // to restore it, same as any other version.
    const draft = await createMasterRevision({
      job,
      context,
      result,
      requestedMode,
      approvedResearch,
      rpcName: 'create_service_weekly_digest_revision_draft',
      // Truncated to 120 chars by the RPC and shown as-is on the revision
      // card (weekly-workspace.tsx) -- keep it short enough to read there
      // without opening the linked quality report artifact.
      reason: `Quality gate: ${result.quality.score}/100, ${failures.length} check(s) failed`,
    });
    await saveQualityReport({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: draft.revisionId,
      report: result.quality,
      generation: result.generation,
      passed: false,
      jobId: job.id,
      recordCost: false,
    });
    throw new Error(
      `Master quality gate failed (${result.quality.score}/100): ${failures.join('; ')}. Review artifact ${qualityArtifactId}. Draft revision ${draft.revisionId} was saved for review under Overview -> Editorial versions -- it did not become active.`,
    );
  }

  const created = await createMasterRevision({
    job,
    context,
    result,
    requestedMode,
    approvedResearch,
    rpcName: 'create_service_weekly_digest_revision',
    reason: 'weekly_content_studio_v2_master',
  });
  const qualityArtifactId = await saveQualityReport({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: created.revisionId,
    report: result.quality,
    generation: result.generation,
    passed: true,
    jobId: job.id,
  });
  await queuePostMasterJobs(job.weekly_digest_id, created.revisionId, created.newItems);
  return {
    artifactId: null,
    output: {
      new_revision_id: created.revisionId,
      article_artifact_ids: created.articleArtifactIds,
      quality_artifact_id: qualityArtifactId,
      quality_score: result.quality.score,
    },
  };
}

/**
 * Shared by the success path (activates immediately, via
 * create_service_weekly_digest_revision) and the gate-failure path
 * (create_service_weekly_digest_revision_draft, never touches
 * active_revision_id): builds the revision-items payload, creates the
 * revision, rebases the generated bundle onto the new item IDs, and saves
 * the article artifacts against it (video_script is generated separately,
 * as its own job -- see generateVideoScript below). Callers still handle
 * their own quality-report save (the two paths use different revisionId/
 * passed/recordCost combinations) and, on success, queuePostMasterJobs.
 */
async function createMasterRevision(params: {
  job: ClaimedGenerationJob;
  context: Awaited<ReturnType<typeof loadGenerationContext>>;
  result: Awaited<ReturnType<typeof generateWeeklyMaster>>;
  requestedMode: ReturnType<typeof contentStudioJobMode>;
  approvedResearch: ReturnType<typeof researchPacksFromContext>;
  rpcName: 'create_service_weekly_digest_revision' | 'create_service_weekly_digest_revision_draft';
  reason: string;
}) {
  const { job, context, result, requestedMode, approvedResearch, rpcName, reason } = params;
  const enById = new Map(result.bundle.en.stories.map((story) => [story.revisionItemId, story]));
  const ukById = new Map(result.bundle.uk.stories.map((story) => [story.revisionItemId, story]));
  const researchById = new Map(
    approvedResearch.map(({ artifact, pack }) => [artifact.revision_item_id!, { artifact, pack }]),
  );
  const nextItems = context.items.map((item) => {
    const en = enById.get(item.id);
    const uk = ukById.get(item.id);
    if (!en || !uk) throw new Error(`Master omitted revision item ${item.id}.`);
    const research = researchById.get(item.id);
    const snapshot = asRecord(item.source_snapshot);
    return {
      brief_item_id: item.brief_item_id,
      rank: item.rank,
      title_en: en.headline,
      title_uk: uk.headline,
      summary_en: en.summary,
      summary_uk: uk.summary,
      body_en: en.body,
      body_uk: uk.body,
      why_en: en.why,
      why_uk: uk.why,
      practical_en: en.practical,
      practical_uk: uk.practical,
      takeaway_en: en.takeaway,
      takeaway_uk: uk.takeaway,
      event_date: item.event_date,
      sources: jsonSources(item.sources),
      source_snapshot: {
        ...snapshot,
        content_studio: {
          version: WEEKLY_CONTENT_STUDIO_VERSION,
          mode: requestedMode,
          placement: placementForRank(item.rank),
          limitation_en: en.limitation,
          limitation_uk: uk.limitation,
          hook_en: en.hook,
          hook_uk: uk.hook,
          editors_view_en: en.editorsView,
          editors_view_uk: uk.editorsView,
          discussion_en: en.discussionQuestion,
          discussion_uk: uk.discussionQuestion,
          claim_ids: en.claimIds,
          research_artifact_id: research?.artifact.id ?? null,
          research_input_hash: research?.artifact.input_hash ?? null,
        },
      },
    };
  });
  const { data: newRevisionId, error } = await rpcClient().rpc(rpcName, {
    p_weekly_digest_id: job.weekly_digest_id,
    p_title_en: result.bundle.en.title,
    p_title_uk: result.bundle.uk.title,
    p_intro_en: result.bundle.en.intro,
    p_intro_uk: result.bundle.uk.intro,
    p_editor_note_en: result.bundle.en.editorNote,
    p_editor_note_uk: result.bundle.uk.editorNote,
    p_key_takeaways_en: result.bundle.en.keyTakeaways,
    p_key_takeaways_uk: result.bundle.uk.keyTakeaways,
    p_items: nextItems,
    p_reason: reason,
  });
  if (error || typeof newRevisionId !== 'string') {
    throw new Error(
      `[weekly-generation] create master revision: ${error?.message ?? 'missing revision ID'}`,
    );
  }
  const db = getSupabaseAdmin();
  const { data: newItems, error: newItemsError } = await db
    .from('weekly_digest_revision_items')
    .select('id,brief_item_id,title_en,title_uk')
    .eq('revision_id', newRevisionId)
    .order('rank');
  if (newItemsError || !newItems)
    throw new Error('The generated master revision items could not be loaded.');
  const newByBriefId = new Map(newItems.map((item) => [item.brief_item_id, item.id]));
  const oldById = new Map(context.items.map((item) => [item.id, item]));
  const rebaseArticle = (article: typeof result.bundle.en) => ({
    ...article,
    stories: article.stories.map((story) => {
      const old = oldById.get(story.revisionItemId);
      const rebasedId = old ? newByBriefId.get(old.brief_item_id) : null;
      if (!rebasedId) throw new Error('Could not rebase generated master story IDs.');
      return { ...story, revisionItemId: rebasedId };
    }),
  });
  const bundle: WeeklyMasterBundle = {
    ...result.bundle,
    en: rebaseArticle(result.bundle.en),
    uk: rebaseArticle(result.bundle.uk),
  };
  const articleArtifactIds: string[] = [];
  for (const [locale, article] of [
    ['en', bundle.en],
    ['uk', bundle.uk],
  ] as const) {
    articleArtifactIds.push(
      await saveGeneratedArtifact({
        weeklyDigestId: job.weekly_digest_id,
        revisionId: newRevisionId,
        artifactType: 'article',
        locale,
        slotKey: `article:${locale}`,
        content: {
          ...article,
          // Only stored on the English article -- video_script generation
          // (its sole consumer) always reads the English side, and social
          // copy generation only needs one canonical set of angles, not a
          // per-locale duplicate. See masterBundleFromArtifacts below.
          ...(locale === 'en' ? { socialAngles: bundle.socialAngles } : {}),
          provenance: {
            research_artifact_ids: approvedResearch.map(({ artifact }) => artifact.id),
            research_input_hashes: approvedResearch.map(({ artifact }) => artifact.input_hash),
            generated_at: new Date().toISOString(),
          },
        } as unknown as Record<string, Json | undefined>,
        provider:
          locale === 'en'
            ? result.generation.english.provider
            : result.generation.ukrainian.provider,
        providerId:
          locale === 'en' ? result.generation.english.model : result.generation.ukrainian.model,
        metadata: {
          schema_version: 'article-v4',
          target_audience: 'software builders, AI practitioners and the technically curious',
          estimated_cost_usd:
            locale === 'en'
              ? result.generation.english.estimatedCostUsd
              : result.generation.ukrainian.estimatedCostUsd,
          cost_source:
            locale === 'en'
              ? result.generation.english.costSource
              : result.generation.ukrainian.costSource,
          token_usage:
            locale === 'en'
              ? {
                  prompt: result.generation.english.promptTokens,
                  output: result.generation.english.outputTokens,
                }
              : {
                  prompt: result.generation.ukrainian.promptTokens,
                  output: result.generation.ukrainian.outputTokens,
                },
          prompt_version:
            locale === 'en'
              ? result.generation.english.promptVersion
              : result.generation.ukrainian.promptVersion,
          provenance: {
            research_artifact_ids: approvedResearch.map(({ artifact }) => artifact.id),
            research_input_hashes: approvedResearch.map(({ artifact }) => artifact.input_hash),
          },
        },
      }),
    );
  }
  return { revisionId: newRevisionId, articleArtifactIds, newItems };
}

async function localeMap() {
  const { data, error } = await getSupabaseAdmin()
    .from('weekly_locale_map')
    .select('channel,locale')
    .eq('enabled', true)
    .eq('is_default', true);
  if (error || !data)
    throw new Error(`[weekly-generation] locale map: ${error?.message ?? 'missing'}`);
  const map = new Map(data.map((entry) => [entry.channel, entry.locale]));
  for (const channel of SOCIAL_CHANNELS) {
    if (!map.has(channel)) throw new Error(`Weekly locale map has no default for ${channel}.`);
  }
  return map as Map<SocialChannel, SocialLocale>;
}

/**
 * Reads the approved bilingual article pair. No longer requires a
 * video_script artifact to exist -- video generation moved to its own job
 * (PR6), and generateSocialCopy (the other caller) never needed it in the
 * first place, so the old hard dependency just meant social copy silently
 * couldn't run until the video job happened to finish first.
 */
function masterBundleFromArtifacts(context: Awaited<ReturnType<typeof loadGenerationContext>>) {
  const articleEn = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'article' && artifact.locale === 'en' && artifact.is_current,
  );
  const articleUk = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'article' && artifact.locale === 'uk' && artifact.is_current,
  );
  if (!articleEn || !articleUk) {
    throw new Error('Approved master article artifacts are required.');
  }
  const socialAngles = asRecord(articleEn.content).socialAngles;
  return {
    en: articleEn.content,
    uk: articleUk.content,
    socialAngles: Array.isArray(socialAngles) ? socialAngles : [],
  } as unknown as WeeklyMasterBundle;
}

/**
 * Reads the current, owner-approved video_script artifact for the video
 * manifest job. Kept separate from masterBundleFromArtifacts because only
 * video_manifest needs it -- see the claim_weekly_digest_generation_jobs
 * migration, which already gates video_manifest on this artifact's
 * review_status being 'approved'.
 */
function videoScriptFromArtifacts(
  context: Awaited<ReturnType<typeof loadGenerationContext>>,
): WeeklyVideoScript {
  const videoScript = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'video_script' && artifact.locale === 'en' && artifact.is_current,
  );
  if (!videoScript) throw new Error('Approved video-script artifact is required.');
  const narrationPlan = asRecord(videoScript.content).narration_plan;
  if (!narrationPlan || typeof narrationPlan !== 'object' || Array.isArray(narrationPlan)) {
    throw new Error('Video script artifact does not contain the v3 script.');
  }
  return narrationPlan as unknown as WeeklyVideoScript;
}

async function socialAssetsForChannel(
  context: Awaited<ReturnType<typeof loadGenerationContext>>,
  channel: SocialChannel,
): Promise<SocialAsset[]> {
  const preferred =
    context.artifacts.find((artifact) => {
      if (!artifact.is_current || artifact.generation_status !== 'ready') return false;
      if (channel === 'instagram') {
        return (
          artifact.artifact_type === 'social_asset' && /instagram|4x5/i.test(artifact.slot_key)
        );
      }
      return (
        artifact.artifact_type === 'social_asset' &&
        /landscape|open.graph|linkedin|facebook|x/i.test(artifact.slot_key)
      );
    }) ??
    context.artifacts.find(
      (artifact) =>
        artifact.artifact_type === 'cover' &&
        artifact.is_current &&
        artifact.generation_status === 'ready',
    );
  if (!preferred) return [];
  const url = await signedArtifactUrl(preferred, 7 * 24 * 60 * 60);
  if (!url) return [];
  return [
    {
      url,
      ...(preferred.width ? { width: preferred.width } : {}),
      ...(preferred.height ? { height: preferred.height } : {}),
      ...(preferred.byte_size ? { bytes: preferred.byte_size } : {}),
      ...(preferred.mime_type === 'image/jpeg' ||
      preferred.mime_type === 'image/png' ||
      preferred.mime_type === 'image/webp'
        ? { mimeType: preferred.mime_type }
        : {}),
    },
  ];
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function slideLines(value: string, maxCharacters = 27) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 10);
}

async function renderInstagramCarousel(
  job: ClaimedGenerationJob,
  draft: WeeklySocialAdaptation,
): Promise<SocialAsset[]> {
  const parts = draft.contentParts ?? [];
  if (parts.length < 7 || parts.length > 9 || !draft.assets[0]?.url) return draft.assets;
  const response = await fetch(draft.assets[0].url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Instagram carousel source returned ${response.status}.`);
  const source = Buffer.from(await response.arrayBuffer());
  const sharp = await lazySharp();
  const background = await sharp(source)
    .resize(1080, 1350, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.3, saturation: 0.75 })
    .blur(5)
    .jpeg({ quality: 88 })
    .toBuffer();
  const assets: SocialAsset[] = [];
  const db = getSupabaseAdmin();
  for (const [index, part] of parts.entries()) {
    const lines = slideLines(part);
    const lineHeight = lines.length > 7 ? 76 : 88;
    const fontSize = lines.length > 7 ? 61 : 72;
    const startY = Math.max(360, 690 - (lines.length * lineHeight) / 2);
    const textSvg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="1080" height="1350" fill="rgba(6,12,15,.35)"/>
      <text x="76" y="104" fill="#f5f5f2" font-family="serif" font-size="44" font-weight="700">AI Today <tspan fill="#47e4d3">Brief</tspan></text>
      <text x="1004" y="104" text-anchor="end" fill="#47e4d3" font-family="sans-serif" font-size="26" font-weight="800">${index + 1} / ${parts.length}</text>
      <rect x="76" y="${startY - 78}" width="96" height="8" rx="4" fill="#47e4d3"/>
      <text x="76" y="${startY}" fill="#f5f5f2" font-family="sans-serif" font-size="${fontSize}" font-weight="700">
        ${lines.map((line, lineIndex) => `<tspan x="76" dy="${lineIndex === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}
      </text>
      <text x="76" y="1265" fill="#9ba5aa" font-family="sans-serif" font-size="25">Weekly Digest · aitodaybrief.com</text>
    </svg>`;
    const image = await sharp(background)
      .composite([{ input: Buffer.from(textSvg) }])
      .jpeg({ quality: 91, progressive: true })
      .toBuffer();
    const hash = createHash('sha256').update(image).digest('hex');
    const path =
      `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/social/instagram/` +
      `${hash}-${job.id}/slide-${index + 1}.jpg`;
    await uploadPrivate(path, image, 'image/jpeg');
    await saveGeneratedArtifact({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      artifactType: 'social_asset',
      locale: 'en',
      slotKey: `instagram-carousel:${index + 1}:en`,
      storagePath: path,
      mimeType: 'image/jpeg',
      width: 1080,
      height: 1350,
      byteSize: image.length,
      content: { alt: `Weekly Digest carousel slide ${index + 1}: ${part}` },
      metadata: {
        channel: 'instagram',
        slide_index: index + 1,
        slide_count: parts.length,
        source_job_id: job.id,
        sha256: hash,
      },
    });
    const { data: signed, error } = await db.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, 7 * 24 * 60 * 60);
    if (error || !signed?.signedUrl) {
      throw new Error(`Instagram carousel slide ${index + 1} could not be signed.`);
    }
    assets.push({
      url: signed.signedUrl,
      width: 1080,
      height: 1350,
      bytes: image.length,
      mimeType: 'image/jpeg',
    });
  }
  return assets;
}

const SOCIAL_COPY_CHECKPOINT_VERSION = 1;

type SocialCopyCheckpoint = {
  tokens: Record<SocialChannel, string>;
  adaptations: Partial<Record<SocialChannel, WeeklySocialAdaptation>>;
};

type SocialCopyCheckpointOutput = {
  socialCopyCheckpointHash?: string;
  tokens?: Record<SocialChannel, string>;
  adaptations?: Partial<Record<SocialChannel, WeeklySocialAdaptation>>;
};

/**
 * Six channels each pay for an independent writer+critic pass, and today
 * every one of them is forced onto slow OpenRouter streaming (Gemini's
 * free-tier quota is exhausted, confirmed via the API's own 429 response).
 * That reliably outruns Vercel's 300s ceiling on this plan mid-loop -- the
 * platform kills the function outright, with no chance for a catch block to
 * run. Checkpointing per channel (same pattern as editorial_master's EN/UK
 * write) means a retry resumes from the next unfinished channel instead of
 * redoing already-completed ones.
 */
export function computeSocialCopyCheckpointHash(input: {
  bundle: WeeklyMasterBundle;
  sourceFacts: string[];
  locales: Map<SocialChannel, SocialLocale>;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        en: input.bundle.en,
        uk: input.bundle.uk,
        socialAngles: input.bundle.socialAngles,
        sourceFacts: input.sourceFacts,
        locales: [...input.locales.entries()],
        version: SOCIAL_COPY_CHECKPOINT_VERSION,
      }),
    )
    .digest('hex');
}

async function loadSocialCopyCheckpoint(
  jobId: string,
  expectedHash: string,
): Promise<SocialCopyCheckpoint | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_generation_jobs')
    .select('output')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(`[weekly-generation] social copy checkpoint lookup: ${error.message}`);
  const output = asRecord(data?.output as Json | undefined) as SocialCopyCheckpointOutput;
  if (output.socialCopyCheckpointHash !== expectedHash || !output.tokens) return null;
  return { tokens: output.tokens, adaptations: output.adaptations ?? {} };
}

async function saveSocialCopyCheckpoint(
  jobId: string,
  checkpointHash: string,
  checkpoint: SocialCopyCheckpoint,
) {
  const output: SocialCopyCheckpointOutput = {
    socialCopyCheckpointHash: checkpointHash,
    tokens: checkpoint.tokens,
    adaptations: checkpoint.adaptations,
  };
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('weekly_digest_generation_jobs')
    .update({ output: output as unknown as Json })
    .eq('id', jobId);
  if (error) throw new Error(`[weekly-generation] social copy checkpoint save: ${error.message}`);
}

async function generateSocialCopy(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const bundle = masterBundleFromArtifacts(context);
  const locales = await localeMap();
  const sourceFacts = context.items
    .flatMap((item) => [
      item.title_en,
      item.summary_en,
      item.why_en ?? '',
      ...approvedFactsForItem(item).map((claim) => claim.text),
    ])
    .filter(Boolean);
  const checkpointHash = computeSocialCopyCheckpointHash({ bundle, sourceFacts, locales });
  const existingCheckpoint = await loadSocialCopyCheckpoint(job.id, checkpointHash);
  const tokens =
    existingCheckpoint?.tokens ??
    (Object.fromEntries(SOCIAL_CHANNELS.map((channel) => [channel, randomUUID()])) as Record<
      SocialChannel,
      string
    >);
  const checkpointAdaptations: Partial<Record<SocialChannel, WeeklySocialAdaptation>> = {
    ...existingCheckpoint?.adaptations,
  };
  const adaptations: WeeklySocialAdaptation[] = [];
  for (const channel of SOCIAL_CHANNELS) {
    const cached = checkpointAdaptations[channel];
    if (cached) {
      adaptations.push(cached);
      continue;
    }
    const locale = locales.get(channel)!;
    const trackedUrl = new URL(`/r/s/${tokens[channel]}`, SITE_URL).toString();
    const angle = bundle.socialAngles.find((candidate) => candidate.channel === channel);
    const assets = await socialAssetsForChannel(context, channel);
    const adaptation = await adaptWeeklySocialChannel({
      channel,
      locale,
      bundle,
      hookAngle: angle?.hookAngle ?? (locale === 'uk' ? bundle.uk.theme : bundle.en.theme),
      trackedUrl,
      scheduledFor: nextWeeklyScheduledForChannel(channel, context.digest.week_end, new Date()),
      sourceFacts,
      assets,
      altText:
        locale === 'uk'
          ? `Обкладинка тижневого дайджесту: ${bundle.uk.title}`
          : `Weekly Digest cover: ${bundle.en.title}`,
    });
    await recordGenerationCost({
      scope: 'social',
      kind: 'llm',
      provider: adaptation.writer.provider,
      model: adaptation.writer.model,
      costUsd: adaptation.writer.usage.estimatedCostUsd,
      costSource: 'estimated',
      promptTokens: adaptation.writer.usage.promptTokens,
      outputTokens: adaptation.writer.usage.outputTokens,
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      jobId: job.id,
      metadata: { channel, role: 'writer' },
    });
    const criticUsage = adaptation.qualityReport?.critic?.usage;
    if (criticUsage && adaptation.qualityReport?.critic) {
      await recordGenerationCost({
        scope: 'social',
        kind: 'llm',
        provider: adaptation.qualityReport.critic.provider ?? 'unknown',
        model: adaptation.qualityReport.critic.model ?? 'unknown',
        costUsd: criticUsage.estimatedCostUsd,
        costSource: 'estimated',
        promptTokens: criticUsage.promptTokens,
        outputTokens: criticUsage.outputTokens,
        weeklyDigestId: job.weekly_digest_id,
        revisionId: job.revision_id,
        jobId: job.id,
        metadata: { channel, role: 'critic' },
      });
    }
    adaptations.push(adaptation);
    checkpointAdaptations[channel] = adaptation;
    await saveSocialCopyCheckpoint(job.id, checkpointHash, {
      tokens,
      adaptations: checkpointAdaptations,
    });
  }
  const instagram = adaptations.find((draft) => draft.channel === 'instagram');
  if (instagram) {
    instagram.assets = await renderInstagramCarousel(job, instagram);
    if (instagram.assets.length !== (instagram.contentParts?.length ?? 0)) {
      instagram.qualityReport = {
        ...instagram.qualityReport!,
        blocking: [
          ...instagram.qualityReport!.blocking,
          {
            code: 'instagram_carousel_assets',
            message: 'Every approved Instagram slide needs a matching 1080×1350 asset.',
            suggestedFix: 'Regenerate the social package after the cover is approved.',
          },
        ],
      };
    }
  }
  const { renderWeeklyLinkedInDocument } = await lazyLinkedinDocument();
  const linkedinDocument = await renderWeeklyLinkedInDocument({
    title: bundle.en.title,
    theme: bundle.en.theme,
    standfirst: bundle.en.standfirst,
    conclusion: bundle.en.conclusion,
    webUrl: `${SITE_URL}/en/weekly/${context.digest.slug}`,
    keyTakeaways: bundle.en.keyTakeaways,
    stories: bundle.en.stories.map((story, index) => ({
      rank: index + 1,
      placement: story.placement,
      headline: story.headline,
      hook: story.hook,
      summary: story.summary,
      why: story.why,
      takeaway: story.takeaway,
      sourceUrl: jsonSources(context.items[index]?.sources ?? [])[0]?.url ?? SITE_URL,
    })),
  });
  const linkedinDocumentHash = createHash('sha256').update(linkedinDocument).digest('hex');
  const linkedinDocumentPath =
    `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/social/linkedin/` +
    `${linkedinDocumentHash}-${job.id}.pdf`;
  await uploadPrivate(linkedinDocumentPath, linkedinDocument, 'application/pdf');
  const linkedinDocumentArtifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'social_asset',
    locale: 'en',
    slotKey: 'linkedin-document:en',
    storagePath: linkedinDocumentPath,
    mimeType: 'application/pdf',
    byteSize: linkedinDocument.length,
    content: { title: bundle.en.title, page_count: 7 },
    metadata: {
      channel: 'linkedin',
      format: 'native-document',
      page_count: 7,
      sha256: linkedinDocumentHash,
      manual_upload: true,
    },
  });
  const duplicates = findBlindCrossPosts(adaptations);
  const db = getSupabaseAdmin();
  const generationVersion = `social-v2:${job.revision_id}`;
  const { data: socialPackage, error: packageError } = await db
    .from('social_packages')
    .insert({
      kind: 'weekly_digest',
      risk_level: 'yellow',
      status: 'in_review',
      source_date: context.digest.week_end,
      source_brief_item_id: context.items[0]?.brief_item_id ?? null,
      source_item_ids: context.items.flatMap((item) =>
        item.brief_item_id ? [item.brief_item_id] : [],
      ),
      weekly_digest_id: job.weekly_digest_id,
      weekly_digest_revision_id: job.revision_id,
      title: bundle.en.title,
      generation_version: generationVersion,
    })
    .select('id')
    .single();
  if (packageError || !socialPackage) {
    throw new Error(`[weekly-generation] social package: ${packageError?.message ?? 'missing'}`);
  }
  const rows = adaptations.map((draft) => {
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
      contentParts: draft.contentParts,
      firstComment: draft.firstComment,
      assets: draft.assets,
      altText: draft.altText,
      scheduledFor: draft.scheduledFor,
      contentVersion,
    });
    const destinationUrl = new URL(`/${draft.locale}/weekly/${context.digest.slug}`, SITE_URL);
    const publicUrl = new URL(destinationUrl.toString());
    publicUrl.searchParams.set('utm_source', draft.channel);
    publicUrl.searchParams.set('utm_medium', 'social');
    publicUrl.searchParams.set('utm_campaign', 'weekly_digest');
    publicUrl.searchParams.set('utm_content', draft.hookAngle.slice(0, 80));
    return {
      package_id: socialPackage.id,
      brief_item_id: context.items[0]?.brief_item_id ?? null,
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      status: 'in_review',
      post_text: draft.text,
      content_parts: draft.contentParts as Json,
      first_comment: draft.firstComment ?? null,
      asset_urls: draft.assets as unknown as Json,
      alt_text: draft.altText ?? null,
      quality_report: report as unknown as Json,
      content_hash: contentHash,
      content_version: contentVersion,
      scheduled_for: draft.scheduledFor,
      idempotency_key: `${socialPackage.id}:${draft.channel}:${contentHash.slice(0, 16)}`,
      tracking_token: tokens[draft.channel],
      url: destinationUrl.toString(),
      utm_url: publicUrl.toString(),
      meta: {
        hook_angle: draft.hookAngle,
        hook_candidates: draft.hookCandidates,
        writer: draft.writer,
        source_revision_id: job.revision_id,
        ...(draft.channel === 'linkedin'
          ? {
              document_status: 'draft_ready',
              document_artifact_id: linkedinDocumentArtifactId,
              document_note: 'Seven-page native document generated from the approved master.',
            }
          : {}),
      } as Json,
    };
  });
  const { data: posts, error: postsError } = await db.from('social_posts').insert(rows).select('*');
  if (postsError || !posts)
    throw new Error(`[weekly-generation] social variants: ${postsError?.message ?? 'missing'}`);
  const { error: reviewError } = await db.from('social_post_reviews').insert(
    posts.map((post) => ({
      social_post_id: post.id,
      package_id: socialPackage.id,
      action: 'generated',
      content_version: post.content_version,
      content_hash: post.content_hash,
      snapshot: {
        channel: post.channel,
        locale: post.locale,
        format: post.format,
        post_text: post.post_text,
        content_parts: post.content_parts,
        first_comment: post.first_comment,
        quality_report: post.quality_report,
      } as Json,
    })),
  );
  if (reviewError) throw new Error(`[weekly-generation] social reviews: ${reviewError.message}`);
  return {
    artifactId: null,
    output: {
      social_package_id: socialPackage.id,
      post_ids: posts.map((post) => post.id),
      blocked_channels: posts
        .filter((post) => {
          const report = asRecord(post.quality_report);
          return Array.isArray(report.blocking) && report.blocking.length > 0;
        })
        .map((post) => post.channel),
    },
  };
}

/**
 * Dramatizes the approved English master article into a TV-news-format
 * script (cold open, anchor, one b-roll segment per Top 3 story, radar
 * quick-hits, discussion outro) plus three Ukrainian Shorts. Runs as its own
 * job, after the article is approved -- see wiki/pipeline/video-boundary.md
 * for why this moved out of the master mega-call in PR6.
 */
async function generateVideoScript(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const articleEn = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'article' &&
      artifact.locale === 'en' &&
      artifact.is_current &&
      artifact.review_status === 'approved',
  );
  if (!articleEn) {
    throw new Error('Approve the current English article before generating the video script.');
  }
  const article = articleEn.content as unknown as WeeklyArticleMaster;
  const { script, generation, issues } = await generateWeeklyVideoScript(article);
  await recordGenerationCost({
    scope: 'weekly',
    kind: 'llm',
    provider: generation.provider,
    model: generation.model,
    costUsd: generation.estimatedCostUsd,
    costSource: generation.costSource,
    promptTokens: generation.promptTokens,
    outputTokens: generation.outputTokens,
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    jobId: job.id,
    metadata: { step: 'video_script', prompt_version: generation.promptVersion },
  });
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'video_script',
    locale: 'en',
    slotKey: 'video-script:en',
    content: {
      script: script.narration,
      narration_plan: script as unknown as Json,
    },
    provider: generation.provider,
    providerId: generation.model,
    metadata: {
      schema_version: WEEKLY_VIDEO_SCRIPT_SCHEMA_VERSION,
      target_duration_seconds: script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
      shorts_count: script.shorts.length,
      prompt_version: generation.promptVersion,
      estimated_cost_usd: generation.estimatedCostUsd,
      cost_source: generation.costSource,
      non_blocking_issues: issues.filter((issue) => !issue.blocker).length,
    },
  });
  return { artifactId, output: { video_script_artifact_id: artifactId } };
}

async function generateVideoManifest(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const bundle = masterBundleFromArtifacts(context);
  const script = videoScriptFromArtifacts(context);
  const featureIds = new Set(script.shorts.map((short) => short.revisionItemId));
  const imageArtifacts = context.artifacts.filter(
    (artifact) =>
      artifact.artifact_type === 'story_image' &&
      artifact.is_current &&
      artifact.generation_status === 'ready' &&
      artifact.review_status === 'approved' &&
      Boolean(artifact.revision_item_id && featureIds.has(artifact.revision_item_id)),
  );
  if (imageArtifacts.length !== 3) {
    throw new Error('Approve one current story image for each Top 3 story before video handoff.');
  }
  const assets = await Promise.all(
    imageArtifacts.map(async (artifact) => {
      const url = await signedArtifactUrl(artifact, 7 * 24 * 60 * 60);
      if (!url) throw new Error(`Approved story image ${artifact.id} has no readable URL.`);
      return {
        artifactId: artifact.id,
        revisionItemId: artifact.revision_item_id,
        url,
        altText: text(asRecord(artifact.content).alt_en) ?? 'Weekly Digest story illustration',
        attribution: text(asRecord(artifact.metadata).source_url),
      };
    }),
  );
  const dependencies = {
    digestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    script,
    articleInputHashes: context.artifacts
      .filter((artifact) => artifact.artifact_type === 'article' && artifact.is_current)
      .map((artifact) => artifact.input_hash),
    imageInputHashes: imageArtifacts.map((artifact) => artifact.input_hash),
  };
  const inputHash = contentFingerprint(dependencies);
  const manifest = {
    schemaVersion: WEEKLY_VIDEO_MANIFEST_VERSION,
    digestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    inputHash,
    title: bundle.en.title,
    theme: text(bundle.en.theme) ?? bundle.en.title,
    sourceUrls: context.items.flatMap((item) =>
      jsonSources(item.sources).map((source) => source.url),
    ),
    longForm: {
      locale: 'en',
      targetDurationSeconds: 420,
      narration: script.narration,
      // Each scene carries its own revisionItemId (null for non-story
      // scenes) -- the video repo maps a broll scene to `assets` by that ID
      // instead of the old `index % assets.length`, which could show one
      // story's image during another story's narration. See
      // wiki/pipeline/video-boundary.md.
      scenes: script.scenes,
    },
    shorts: script.shorts,
    assets,
    captions: {
      required: ['en', 'uk'],
      format: 'vtt',
    },
    attributionRequired: true,
  };
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'video_manifest',
    locale: 'en',
    slotKey: 'video-manifest:en',
    content: manifest as unknown as Record<string, Json | undefined>,
    provider: 'ai-today-brief',
    providerId: WEEKLY_VIDEO_MANIFEST_VERSION,
    metadata: {
      schema_version: WEEKLY_VIDEO_MANIFEST_VERSION,
      input_hash: inputHash,
      manual_heygen_import: true,
      manual_youtube_upload: true,
    },
  });
  return { artifactId, output: { manifest_artifact_id: artifactId, input_hash: inputHash } };
}

function sourceFromJson(value: Json) {
  if (!Array.isArray(value)) return { name: 'Source', url: SITE_URL };
  for (const entry of value) {
    const row = asRecord(entry);
    const url = text(row.url) ?? text(row.source_url);
    if (url?.startsWith('http')) {
      return { name: text(row.name) ?? text(row.source_name) ?? 'Source', url };
    }
  }
  return { name: 'Source', url: SITE_URL };
}

function snapshotImage(value: Json) {
  const row = asRecord(value);
  const editorial = asRecord(row.editorial_selection);
  return (
    text(row.card_image_url) ??
    text(row.image_url) ??
    text(row.og_image_url) ??
    text(editorial.image_url)
  );
}

async function generatePdf(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const locale = text(input.locale);
  if (locale !== 'en' && locale !== 'uk') throw new Error('PDF locale must be en or uk.');
  const localized = (en: string | null, uk: string | null) =>
    locale === 'uk' ? (uk ?? '') : (en ?? '');
  const artifactByStory = new Map(
    context.artifacts
      .filter((artifact) => artifact.artifact_type === 'story_image' && artifact.revision_item_id)
      .map((artifact) => [artifact.revision_item_id!, artifact]),
  );
  const coverArtifact =
    context.artifacts.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.locale === locale,
    ) ?? context.artifacts.find((artifact) => artifact.artifact_type === 'cover');
  const videoArtifact = context.artifacts.find(
    (artifact) => artifact.artifact_type === 'video_final',
  );
  const [coverImageUrl, storyImageUrls] = await Promise.all([
    coverArtifact ? signedArtifactUrl(coverArtifact) : null,
    Promise.all(
      context.items.map(async (item) => {
        const artifact = artifactByStory.get(item.id);
        return artifact ? signedArtifactUrl(artifact) : snapshotImage(item.source_snapshot);
      }),
    ),
  ]);
  const pdfInput: WeeklyPdfInput = {
    locale,
    issueLabel:
      locale === 'uk'
        ? `Випуск ${context.revision.revision_number}`
        : `Issue ${context.revision.revision_number}`,
    title: localized(context.revision.title_en, context.revision.title_uk),
    intro: localized(context.revision.intro_en, context.revision.intro_uk),
    editorNote: localized(context.revision.editor_note_en, context.revision.editor_note_uk),
    weekStart: context.digest.week_start,
    weekEnd: context.digest.week_end,
    webUrl: `${SITE_URL}/${locale}/weekly/${context.digest.slug}`,
    videoUrl: videoArtifact?.external_url ?? null,
    coverImageUrl,
    keyTakeaways: stringArray(
      locale === 'uk' ? context.revision.key_takeaways_uk : context.revision.key_takeaways_en,
    ),
    stories: context.items.map((item, index) => {
      const source = sourceFromJson(item.sources);
      const studio = asRecord(asRecord(item.source_snapshot).content_studio);
      return {
        rank: item.rank,
        title: localized(item.title_en, item.title_uk),
        summary: localized(item.summary_en, item.summary_uk),
        body: localized(item.body_en, item.body_uk),
        why: localized(item.why_en, item.why_uk),
        practical: localized(item.practical_en, item.practical_uk),
        takeaway: localized(item.takeaway_en, item.takeaway_uk),
        limitation: localized(text(studio.limitation_en), text(studio.limitation_uk)),
        sourceName: source.name,
        sourceUrl: source.url,
        eventDate: item.event_date,
        imageUrl: storyImageUrls[index],
        imageAlt: localized(item.title_en, item.title_uk),
      };
    }),
  };
  const { renderWeeklyDigestPdf } = await lazyPdf();
  const pdf = await renderWeeklyDigestPdf(pdfInput);
  const hash = createHash('sha256').update(pdf).digest('hex');
  // Do not reuse a path written by an earlier job. A previously corrupted
  // immutable upload must never be mistaken for this job's verified output.
  const outputKey = `${hash}-${job.id}`;
  const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/pdf/${locale}/${outputKey}.pdf`;
  const previewPaths: string[] = [];
  const { openWeeklyPdfPreview } = await lazyPdfPreview();
  const document = await openWeeklyPdfPreview(pdf, 1.15);
  try {
    const contentStudioPdf = context.items.some(
      (item) =>
        text(asRecord(asRecord(item.source_snapshot).content_studio).version) ===
        WEEKLY_CONTENT_STUDIO_VERSION,
    );
    if (contentStudioPdf && (document.length < 10 || document.length > 16)) {
      throw new Error(
        `Content Studio PDF is ${document.length} pages; the approved A4 contract is 10–16 pages.`,
      );
    }
    if (document.length > 40) {
      throw new Error(`PDF preview safety limit exceeded (${document.length} pages).`);
    }
    await uploadPrivate(path, pdf, 'application/pdf');
    const sharp = await lazySharp();
    for (let pageNumber = 1; pageNumber <= document.length; pageNumber += 1) {
      const png = await document.getPage(pageNumber);
      const preview = await sharp(png).webp({ quality: 82, effort: 4 }).toBuffer();
      const previewPath =
        `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/pdf/` +
        `${locale}/previews/${outputKey}/page-${String(pageNumber).padStart(3, '0')}.webp`;
      await uploadPrivate(previewPath, preview, 'image/webp');
      previewPaths.push(previewPath);
    }
  } finally {
    await document.destroy();
  }
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'pdf',
    locale,
    slotKey: `pdf:${locale}`,
    storagePath: path,
    mimeType: 'application/pdf',
    byteSize: pdf.length,
    content: {
      title: pdfInput.title,
      web_url: pdfInput.webUrl,
      preview_paths: previewPaths,
    },
    metadata: {
      format: 'A4',
      renderer: 'pdfkit-weekly-v2',
      sha256: hash,
      story_count: context.items.length,
      page_count: previewPaths.length,
    },
  });
  return { artifactId, output: { locale, path, byte_size: pdf.length, sha256: hash } };
}

async function generateStoryImage(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const revisionItemId = text(input.revision_item_id);
  const item = context.items.find((candidate) => candidate.id === revisionItemId);
  if (!item) throw new Error('Story image job requires a valid revision_item_id.');
  const requestedSourceUrl = text(input.source_url);
  const sceneOverride = text(input.scene_override);
  let source: Buffer;
  let sourceKind = 'generated';
  let sourceUrl: string | null = null;
  let imageMeta: {
    provider: string;
    model: string;
    estimatedCostUsd: number;
    costSource: 'reported' | 'estimated' | 'subscription';
    scene?: string;
    positivePrompt?: string;
    negativePrompt?: string;
    sceneSource?: string;
  } | null = null;
  /** Additional variant renders (sharp-processed, not yet uploaded) beyond the primary. */
  let alternateBuffers: Buffer[] = [];

  if (requestedSourceUrl?.startsWith('http')) {
    const response = await fetch(requestedSourceUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Story image source returned ${response.status}.`);
    source = Buffer.from(await response.arrayBuffer());
    sourceUrl = requestedSourceUrl;
    sourceKind = 'editor_url';
  } else {
    const { generateWeeklyReportageIllustrations } = await lazyCardImage();
    const contentStudio = asRecord(asRecord(item.source_snapshot).content_studio);
    const illustrations = await generateWeeklyReportageIllustrations(
      {
        headline: item.title_en,
        summary: item.summary_en,
        bodyExcerpt: item.body_en?.slice(0, 600),
        editorsView: text(contentStudio.editors_view_en) ?? undefined,
        seedBase: `${job.weekly_digest_id}:${job.revision_id}:${item.id}`,
        sceneOverride: sceneOverride ?? undefined,
        variantCount: 3,
      },
      {
        geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
        geminiImageModel: process.env.GEMINI_IMAGE_MODEL?.trim(),
        geminiModel: process.env.GEMINI_MODEL?.trim(),
        openRouterApiKey:
          process.env.OPEN_ROUTER_API_KEY?.trim() ?? process.env.OPENROUTER_API_KEY?.trim(),
        cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
        cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim(),
        cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL?.trim(),
      },
    );

    if (illustrations?.variants.length) {
      const [primary, ...alternates] = illustrations.variants;
      source = primary!.bytes;
      imageMeta = {
        provider: primary!.provider,
        model: primary!.model,
        estimatedCostUsd: illustrations.variants.reduce((sum, v) => sum + v.estimatedCostUsd, 0),
        costSource: primary!.costSource,
        scene: illustrations.scene,
        positivePrompt: primary!.positivePrompt,
        negativePrompt: primary!.negativePrompt,
        sceneSource: illustrations.sceneSource,
      };
      alternateBuffers = alternates.map((variant) => variant.bytes);
    } else {
      const fallbackUrl = snapshotImage(item.source_snapshot);
      if (!fallbackUrl?.startsWith('http')) {
        throw new Error(
          'Illustration generation failed and the story has no reviewed source image fallback.',
        );
      }
      const response = await fetch(fallbackUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Story image fallback returned ${response.status}.`);
      source = Buffer.from(await response.arrayBuffer());
      sourceUrl = fallbackUrl;
      sourceKind = 'source_fallback';
    }
  }

  if (source.length > 15 * 1024 * 1024) throw new Error('Story image source exceeds 15 MB.');
  const sharp = await lazySharp();
  const processImage = (buffer: Buffer) =>
    sharp(buffer)
      .rotate()
      .resize(1600, 900, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();
  const image = await processImage(source);
  const hash = createHash('sha256').update(image).digest('hex');
  const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${hash}-${job.id}.jpg`;
  await uploadPrivate(path, image, 'image/jpeg');

  // Upload the alternate variants alongside the primary (same generic
  // preview_paths mechanism the PDF job already uses for page previews --
  // admin-data.ts's withPrivatePreviewUrls signs these into preview_urls
  // with no additional plumbing needed).
  const previewPaths: string[] = [];
  for (const [index, buffer] of alternateBuffers.entries()) {
    const processed = await processImage(buffer);
    const altHash = createHash('sha256').update(processed).digest('hex');
    const altPath = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${altHash}-${job.id}-alt${index + 1}.jpg`;
    await uploadPrivate(altPath, processed, 'image/jpeg');
    previewPaths.push(altPath);
  }

  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    revisionItemId: item.id,
    artifactType: 'story_image',
    locale: 'neutral',
    slotKey: `story-image:${item.id}`,
    storagePath: path,
    mimeType: 'image/jpeg',
    width: 1600,
    height: 900,
    byteSize: image.length,
    content: {
      alt_en: text(input.alt_text) ?? item.title_en,
      alt_uk: text(input.alt_text_uk) ?? item.title_uk,
      ...(previewPaths.length ? { preview_paths: previewPaths } : {}),
    },
    metadata: {
      source_kind: sourceKind,
      source_url: sourceUrl,
      focal_point: text(input.focal_point) ?? 'attention',
      prompt_policy: 'weekly-reportage-v1',
      ...(imageMeta
        ? {
            provider: imageMeta.provider,
            model: imageMeta.model,
            estimated_cost_usd: imageMeta.estimatedCostUsd,
            cost_source: imageMeta.costSource,
            ...(imageMeta.scene
              ? {
                  scene: imageMeta.scene,
                  positive_prompt: imageMeta.positivePrompt,
                  negative_prompt: imageMeta.negativePrompt,
                  scene_source: imageMeta.sceneSource,
                }
              : {}),
          }
        : {}),
    },
  });
  if (imageMeta && imageMeta.provider !== 'local') {
    await recordGenerationCost({
      scope: 'weekly',
      kind: 'image',
      provider: imageMeta.provider,
      model: imageMeta.model,
      costUsd: imageMeta.estimatedCostUsd,
      costSource: imageMeta.costSource,
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      jobId: job.id,
      artifactId,
      metadata: { revision_item_id: item.id, source_kind: sourceKind, variant_count: 1 + alternateBuffers.length },
    });
  }
  return { artifactId, output: { path, byte_size: image.length, sha256: hash, variants: 1 + alternateBuffers.length } };
}

async function generateCover(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const localeValue = text(input.locale);
  const locale: WeeklyVisualLocale = localeValue === 'uk' ? 'uk' : 'en';
  const storyArtifacts = new Map(
    context.artifacts
      .filter((artifact) => artifact.artifact_type === 'story_image' && artifact.revision_item_id)
      .map((artifact) => [artifact.revision_item_id!, artifact]),
  );
  const stories = await Promise.all(
    context.items.map(async (item) => {
      const artifact = storyArtifacts.get(item.id);
      return {
        id: item.id,
        title: locale === 'uk' ? item.title_uk : item.title_en,
        imageUrl:
          (artifact ? await signedArtifactUrl(artifact) : null) ??
          snapshotImage(item.source_snapshot),
      };
    }),
  );
  const visualInput: WeeklyVisualInput = {
    digestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    locale,
    issueLabel:
      locale === 'uk'
        ? `Випуск ${context.revision.revision_number}`
        : `Issue ${context.revision.revision_number}`,
    title: locale === 'uk' ? context.revision.title_uk : context.revision.title_en,
    altText:
      text(input.alt_text) ??
      (locale === 'uk'
        ? 'Композиція головних новин тижневого AI-дайджесту.'
        : 'A composition of the Weekly AI Digest lead stories.'),
    stories,
  };
  const { renderWeeklyVisualSet } = await lazyVisuals();
  const variants = await renderWeeklyVisualSet(visualInput);
  let primaryArtifactId: string | null = null;
  const artifactIds: string[] = [];
  for (const variant of variants) {
    const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/visuals/${locale}/${variant.contentHash}-${job.id}/${variant.slot}.jpg`;
    await uploadPrivate(path, variant.bytes, variant.mimeType);
    const primary = variant.slot === 'web_hero';
    const artifactId = await saveGeneratedArtifact({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      artifactType: primary ? 'cover' : 'social_asset',
      locale: primary ? 'neutral' : locale,
      slotKey: primary ? 'cover:main' : `cover:${variant.slot}:${locale}`,
      storagePath: path,
      mimeType: variant.mimeType,
      width: variant.width,
      height: variant.height,
      byteSize: variant.bytes.length,
      content: {
        alt: variant.altText,
        alt_en: locale === 'en' ? variant.altText : null,
        alt_uk: locale === 'uk' ? variant.altText : null,
      },
      metadata: {
        visual_slot: variant.slot,
        source_story_ids: variant.sourceStoryIds,
        warnings: variant.warnings,
        checks: variant.checks,
        sha256: variant.contentHash,
      },
    });
    if (primary) primaryArtifactId = artifactId;
    artifactIds.push(artifactId);
  }
  return {
    artifactId: primaryArtifactId,
    output: { locale, artifact_ids: artifactIds, variant_count: variants.length },
  };
}

async function generateCoverDerivatives(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const cover = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'cover' &&
      artifact.is_current &&
      artifact.generation_status === 'ready' &&
      artifact.review_status === 'approved',
  );
  if (!cover) throw new Error('Approve the current master cover before generating derivatives.');
  const coverUrl = await signedArtifactUrl(cover);
  if (!coverUrl) throw new Error('The approved master cover has no readable source.');
  const response = await fetch(coverUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Master cover returned ${response.status}.`);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 20 * 1024 * 1024) throw new Error('Master cover exceeds 20 MB.');

  const variants = [
    { slot: 'open-graph', width: 1200, height: 630 },
    { slot: 'social-landscape', width: 1200, height: 630 },
    { slot: 'instagram-post', width: 1080, height: 1350 },
    { slot: 'stories', width: 1080, height: 1920 },
  ] as const;
  const artifactIds: string[] = [];
  const sharp = await lazySharp();
  for (const variant of variants) {
    const portrait = variant.height > variant.width;
    const background = portrait
      ? await sharp(source)
          .resize(variant.width, variant.height, { fit: 'cover', position: 'attention' })
          .blur(22)
          .modulate({ brightness: 0.48, saturation: 0.8 })
          .toBuffer()
      : source;
    const foreground = portrait
      ? await sharp(source)
          .resize(variant.width, variant.height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer()
      : null;
    const image = await sharp(background)
      .resize(variant.width, variant.height, {
        fit: portrait ? 'fill' : 'cover',
        position: 'attention',
      })
      .composite(foreground ? [{ input: foreground, left: 0, top: 0 }] : [])
      .jpeg({ quality: 89, progressive: true })
      .toBuffer();
    const hash = createHash('sha256').update(image).digest('hex');
    const path =
      `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/visuals/` +
      `derivatives/${hash}-${job.id}/${variant.slot}.jpg`;
    await uploadPrivate(path, image, 'image/jpeg');
    artifactIds.push(
      await saveGeneratedArtifact({
        weeklyDigestId: job.weekly_digest_id,
        revisionId: job.revision_id,
        artifactType: 'social_asset',
        locale: 'neutral',
        slotKey: `cover:${variant.slot}:neutral`,
        storagePath: path,
        mimeType: 'image/jpeg',
        width: variant.width,
        height: variant.height,
        byteSize: image.length,
        content: {
          alt: text(asRecord(cover.content).alt) ?? 'Weekly Digest cover',
        },
        metadata: {
          source_cover_artifact_id: cover.id,
          derivative_slot: variant.slot,
          sha256: hash,
        },
      }),
    );
  }
  return {
    artifactId: artifactIds[0] ?? null,
    output: { source_cover_artifact_id: cover.id, artifact_ids: artifactIds },
  };
}

async function runGenerationJob(job: ClaimedGenerationJob) {
  if (job.job_type === 'research_pack') return generateResearchPack(job);
  if (job.job_type === 'editorial_master') return generateEditorialMaster(job);
  if (job.job_type === 'social_copy') return generateSocialCopy(job);
  if (job.job_type === 'video_script') return generateVideoScript(job);
  if (job.job_type === 'video_manifest') return generateVideoManifest(job);
  if (job.job_type === 'pdf') return generatePdf(job);
  if (job.job_type === 'story_image') return generateStoryImage(job);
  if (job.job_type === 'cover') return generateCover(job);
  if (job.job_type === 'social_asset') return generateCoverDerivatives(job);
  throw new Error(`Unsupported generation job type: ${job.job_type}`);
}

export async function runWeeklyDigestGenerationJobs(limit = 5, jobTypes?: string[]) {
  const jobs = await claimGenerationJobs(limit, jobTypes);
  const results: Array<{
    id: string;
    jobType: string;
    outcome: 'succeeded' | 'failed';
    artifactId?: string | null;
    error?: string;
  }> = [];
  for (const job of jobs) {
    try {
      const result = await runGenerationJob(job);
      await finishGenerationJob(job.id, true, result.output, null, result.artifactId);
      results.push({
        id: job.id,
        jobType: job.job_type,
        outcome: 'succeeded',
        artifactId: result.artifactId,
      });
    } catch (error) {
      const message = safeMessage(error);
      const retryable = retryableGenerationFailure(message);
      try {
        await finishGenerationJob(job.id, false, { retryable }, message, null);
      } catch (finishError) {
        await alertWeeklyDigestIssue({
          weeklyDigestId: job.weekly_digest_id,
          phase: 'generation',
          message: `${message}; ${safeMessage(finishError)}`.slice(0, 1800),
        });
        results.push({
          id: job.id,
          jobType: job.job_type,
          outcome: 'failed',
          error: `${message}; ${safeMessage(finishError)}`.slice(0, 1800),
        });
        continue;
      }
      if (!retryable || job.attempts >= 5) {
        await alertWeeklyDigestIssue({
          weeklyDigestId: job.weekly_digest_id,
          phase: 'generation',
          message,
        });
      }
      results.push({ id: job.id, jobType: job.job_type, outcome: 'failed', error: message });
    }
  }
  return { claimed: jobs.length, results };
}
