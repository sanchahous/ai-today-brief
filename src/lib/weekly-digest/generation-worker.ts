import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordGenerationCost } from '@/lib/generation-costs';
import { alertWeeklyDigestIssue } from './alerts';
import {
  classifyGenerationFailure,
  LONG_RUNNING_GENERATION_JOB_TYPES,
  mapWithConcurrency,
  redactGenerationMessage,
  SHORT_RUNNING_GENERATION_JOB_TYPES,
  type GenerationBackend,
} from './generation-control';
import type { WeeklyPdfInput } from './pdf';
import type { WeeklyVisualInput, WeeklyVisualLocale } from './visuals';
import {
  COVER_PROMPT_SLOT,
  produceStoryPrompts,
  resolveWeeklyStoryImageMode,
  storyImageJobPath,
  storyPromptSlot,
} from './story-prompt-job';
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
  editorialQualityRetryGuidance,
  placementForRank,
  REQUIRED_QUALITY_DIMENSIONS,
  resolveWeeklyContentStudioMode,
  sourceNameMatchesDomain,
  WEEKLY_CONTENT_STUDIO_VERSION,
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
  type EditorialGenerationMetadata,
  type WeeklyMasterInputStory,
  type WeeklyMasterProviderStep,
  type WeeklyMasterRetryGuidance,
} from './editorial-llm';
import {
  computeMasterPlanHash,
  reusableMasterRunState,
  runWeeklyMaster,
  type MasterRunState,
  type WeeklyMasterRunOutcome,
} from './master-engine';
import type { UnresolvedIssue } from './master-repair';
import { generateWeeklyVideoScript } from './video-script-llm';
import {
  buildWeeklyResearchPack,
  isWeeklyResearchPack,
  trustedWeeklyResearchSources,
} from './research';
import { adaptWeeklySocialChannel, type WeeklySocialAdaptation } from './social-adapter';
import type { WeeklyImageIterationPreview } from '@/lib/content-sim/adapters/weekly-image';

const PRIVATE_BUCKET = 'weekly-digest-private';
const MAX_JOBS = 10;

// This module backs /api/internal/weekly/generate, polled every 5 minutes,
// 24/7, by a Supabase pg_cron safety dispatcher. A separate database reaper
// runs each minute. On the common case where
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
let promptExportPromise: Promise<typeof import('../../../pipeline/prompt-export')> | null = null;
function lazyPromptExport() {
  return (promptExportPromise ??= import('../../../pipeline/prompt-export'));
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
  execution_backend: GenerationBackend;
  attempt_id: string;
  lease_token: string;
}

interface GenerationWorkerOptions {
  backend?: GenerationBackend;
  jobId?: string;
  dispatchToken?: string;
  externalRunId?: string;
  externalRunUrl?: string;
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
  return redactGenerationMessage(error instanceof Error ? error.message : String(error));
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

function defaultJobTypes(backend: GenerationBackend): string[] {
  return [
    ...(backend === 'github_actions'
      ? LONG_RUNNING_GENERATION_JOB_TYPES
      : SHORT_RUNNING_GENERATION_JOB_TYPES),
  ];
}

async function claimGenerationJobs(
  limit: number,
  jobTypes: string[] | undefined,
  options: GenerationWorkerOptions = {},
): Promise<ClaimedGenerationJob[]> {
  const backend = options.backend ?? 'vercel';
  const requestedJobTypes = jobTypes ?? defaultJobTypes(backend);
  const { data, error } = await rpcClient().rpc('claim_weekly_digest_generation_jobs_v2', {
    p_backend: backend,
    p_job_types: requestedJobTypes,
    p_limit: Math.max(1, Math.min(Math.trunc(limit), MAX_JOBS)),
    ...(options.jobId ? { p_job_id: options.jobId } : {}),
    ...(options.dispatchToken ? { p_dispatch_token: options.dispatchToken } : {}),
    ...(options.externalRunId ? { p_external_run_id: options.externalRunId } : {}),
    ...(options.externalRunUrl ? { p_external_run_url: options.externalRunUrl } : {}),
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
      typeof row.attempts !== 'number' ||
      (row.execution_backend !== 'vercel' && row.execution_backend !== 'github_actions') ||
      typeof row.attempt_id !== 'string' ||
      typeof row.lease_token !== 'string'
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
        execution_backend: row.execution_backend,
        attempt_id: row.attempt_id,
        lease_token: row.lease_token,
      },
    ];
  });
}

async function finishGenerationJob(
  job: ClaimedGenerationJob,
  succeeded: boolean,
  output: Record<string, Json | undefined>,
  errorMessage: string | null,
  failureCode: string | null,
  retryable: boolean,
  artifactId?: string | null,
) {
  const { error } = await rpcClient().rpc('finish_weekly_digest_generation_attempt', {
    p_attempt_id: job.attempt_id,
    p_lease_token: job.lease_token,
    p_succeeded: succeeded,
    p_output: output,
    p_error: errorMessage,
    p_failure_code: failureCode,
    p_retryable: retryable,
    p_artifact_id: artifactId ?? null,
  });
  if (error) throw new Error(`[weekly-generation] finish: ${error.message}`);
}

class GenerationAttemptTracker {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly job: ClaimedGenerationJob) {}

  start() {
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat().catch(() => undefined);
    }, 15_000);
  }

  async stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async heartbeat(
    input: {
      step?: string;
      progressCurrent?: number;
      progressTotal?: number;
      provider?: string;
      model?: string;
    } = {},
  ) {
    const { error } = await rpcClient().rpc('heartbeat_weekly_digest_generation_attempt', {
      p_attempt_id: this.job.attempt_id,
      p_lease_token: this.job.lease_token,
      p_step: input.step ?? null,
      p_progress_current: input.progressCurrent ?? null,
      p_progress_total: input.progressTotal ?? null,
      p_provider: input.provider ?? null,
      p_model: input.model ?? null,
    });
    if (error) throw new Error(`[weekly-generation] heartbeat: ${error.message}`);
  }

  async event(input: {
    type: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    step?: string;
    provider?: string;
    model?: string;
    progressCurrent?: number;
    progressTotal?: number;
    message?: string;
    metadata?: Record<string, Json | undefined>;
  }) {
    const { error } = await rpcClient().rpc('record_weekly_digest_generation_event', {
      p_attempt_id: this.job.attempt_id,
      p_lease_token: this.job.lease_token,
      p_event_type: input.type,
      p_level: input.level ?? 'info',
      p_step: input.step ?? null,
      p_provider: input.provider ?? null,
      p_model: input.model ?? null,
      p_progress_current: input.progressCurrent ?? null,
      p_progress_total: input.progressTotal ?? null,
      p_message: input.message ? redactGenerationMessage(input.message, 2000) : null,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(`[weekly-generation] event: ${error.message}`);
  }

  async checkpoint(
    output: Record<string, Json | undefined>,
    step: string,
    progressCurrent: number,
  ) {
    const { data, error } = await rpcClient().rpc('checkpoint_weekly_digest_generation_attempt', {
      p_attempt_id: this.job.attempt_id,
      p_lease_token: this.job.lease_token,
      p_output: output,
      p_step: step,
      p_progress_current: progressCurrent,
      p_progress_total: 100,
    });
    if (error) throw new Error(`[weekly-generation] checkpoint: ${error.message}`);
    if (data !== true)
      throw new Error('[weekly-generation] checkpoint lease is no longer current.');
  }
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

async function loadGenerationContext(
  job: Pick<ClaimedGenerationJob, 'weekly_digest_id' | 'revision_id'>,
) {
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
        ...(text(row.revisionItemId) ? { revisionItemId: text(row.revisionItemId)! } : {}),
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
    return [{ name, score, note: text(row.note) ?? '' } as WeeklyQualityDimension];
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
async function priorMasterRetryGuidance(revisionId: string): Promise<WeeklyMasterRetryGuidance[]> {
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

/**
 * Read-only assembly of exactly what `generateEditorialMaster` feeds the LLM,
 * without claiming a job, opening a lease, writing an event or touching the
 * cost ledger. Exists so `pipeline/scripts/weekly-master-sandbox.ts` can
 * capture real production input and replay a prompt/provider change against
 * it off-production — see wiki/ops/weekly-sandbox.md.
 *
 * It deliberately reuses the worker's own loaders instead of re-querying:
 * a fixture built by a parallel code path would drift from what the worker
 * actually sends and would be worse than having no fixture at all.
 */
export async function loadMasterGenerationInput(input: {
  weeklyDigestId: string;
  revisionId: string;
}): Promise<{
  stories: WeeklyMasterInputStory[];
  researchPacks: WeeklyResearchPack[];
  retryGuidance: WeeklyMasterRetryGuidance[];
}> {
  const context = await loadGenerationContext({
    weekly_digest_id: input.weeklyDigestId,
    revision_id: input.revisionId,
  });
  assertRadarSourceSanity(context.items);
  const approvedResearch = researchPacksFromContext(context);
  const directions = await loadStoryDirections(input.weeklyDigestId);
  return {
    stories: masterInputStories(context, approvedResearch, directions),
    researchPacks: approvedResearch.map(({ pack }) => pack),
    retryGuidance: await priorMasterRetryGuidance(input.revisionId),
  };
}

async function saveQualityReport(input: {
  weeklyDigestId: string;
  revisionId: string;
  report: WeeklyContentQualityReport;
  generation: Extract<WeeklyMasterRunOutcome, { status: 'complete' }>['generation'];
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
  await mapWithConcurrency(jobs, jobs.length, async (queued) => {
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
  });
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
  const maxSpend = Number(
    process.env.WEEKLY_MASTER_MAX_SPEND_USD ?? DEFAULT_WEEKLY_MASTER_MAX_SPEND_USD,
  );
  const cap = Number.isFinite(maxSpend) ? maxSpend : DEFAULT_WEEKLY_MASTER_MAX_SPEND_USD;
  const spent = await revisionSpendSoFarUsd(revisionId);
  if (spent >= cap) {
    throw new Error(
      `[weekly-generation] Digest revision ${revisionId} has already spent $${spent.toFixed(2)}, at or over the $${cap.toFixed(2)} cap. Refusing further master generation.`,
    );
  }
}

/**
 * The durable run state lives under one output key, so a checkpoint merges
 * over the previous one instead of accumulating (both the checkpoint and the
 * finish RPC do `output = output || p_output`).
 */
const MASTER_STATE_KEY = 'master_run_state';

export function masterRunStateFromOutput(
  value: Json | null | undefined,
  planHash: string,
): MasterRunState | null {
  return reusableMasterRunState(asRecord(value)[MASTER_STATE_KEY], planHash);
}

/**
 * State this job already wrote (an in-place retry of the same job) takes
 * precedence over an explicitly requested resume source, because it is by
 * definition at least as far along.
 */
async function loadOwnMasterRunState(jobId: string, planHash: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_generation_jobs')
    .select('output')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(`[weekly-generation] run state lookup: ${error.message}`);
  return masterRunStateFromOutput(data?.output as Json | undefined, planHash);
}

/**
 * "Resume saved master": continue a previous job's saved segments rather than
 * paying for them again.
 *
 * Accepts any terminal prior state, not just `failed`. A run that stopped
 * short on unresolved quality items now finishes as `succeeded` (see
 * generateEditorialMaster below), and that is precisely the case an owner
 * most wants to resume from.
 */
async function loadMasterResumeState(
  job: ClaimedGenerationJob,
  planHash: string,
): Promise<{ state: MasterRunState; sourceJobId: string } | null> {
  const sourceJobId = text(asRecord(job.input).resume_from_job_id);
  if (!sourceJobId) return null;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_generation_jobs')
    .select('id,weekly_digest_id,revision_id,job_type,status,output')
    .eq('id', sourceJobId)
    .maybeSingle();
  if (error) throw new Error(`[weekly-generation] master resume lookup: ${error.message}`);
  if (
    !data ||
    data.job_type !== 'editorial_master' ||
    data.weekly_digest_id !== job.weekly_digest_id ||
    data.revision_id !== job.revision_id ||
    !['failed', 'cancelled', 'succeeded'].includes(data.status)
  ) {
    throw new Error('Master resume source must be a finished master job for this digest revision.');
  }
  const state = masterRunStateFromOutput(data.output, planHash);
  if (!state) {
    throw new Error(
      'Master resume source has no saved state for the current research packs — start a fresh master instead.',
    );
  }
  // An explicit owner-triggered resume buys a fresh critic/repair budget for
  // the copy that was already paid for. Without this reset a resume of a run
  // that used up its rounds would re-report the same verdict and change
  // nothing, which is the "retry does nothing" trap this refactor exists to
  // remove.
  return {
    state: { ...state, criticRounds: 0, repairAttempts: {}, unresolved: [] },
    sourceJobId,
  };
}

/**
 * Wall-clock budget for one master run. The GitHub Actions job allows 120
 * minutes; stopping short of that leaves room to persist the state and finish
 * the job cleanly, so an over-running edition resumes from its last segment
 * instead of starting over.
 */
function masterRunDeadline(): number {
  const configured = Number(process.env.WEEKLY_MASTER_DEADLINE_MS);
  const budget = Number.isFinite(configured) && configured > 0 ? configured : 95 * 60_000;
  return Date.now() + budget;
}

function unresolvedSummary(unresolved: UnresolvedIssue[]): string {
  if (!unresolved.length) return 'none';
  return unresolved
    .slice(0, 6)
    .map(
      (entry) =>
        `${entry.code}${entry.locale ? `/${entry.locale}` : ''}${entry.field ? `.${entry.field}` : ''} (${entry.reason})`,
    )
    .join('; ');
}

async function recordMasterProviderCall(input: {
  job: ClaimedGenerationJob;
  tracker: GenerationAttemptTracker;
  step: WeeklyMasterProviderStep;
  metadata: EditorialGenerationMetadata;
  label: string;
  progress: number;
  durationMs?: number;
}) {
  await input.tracker.event({
    type: 'provider_call_completed',
    step: input.step,
    provider: input.metadata.provider,
    model: input.metadata.model,
    progressCurrent: input.progress,
    progressTotal: 100,
    message: `${input.label} — ${input.metadata.provider}/${input.metadata.model}`,
    metadata: {
      role: input.step === 'critic' ? 'weekly.master_critic' : 'weekly.master_writer',
      segment: input.label,
      prompt_version: input.metadata.promptVersion,
      prompt_tokens: input.metadata.promptTokens,
      output_tokens: input.metadata.outputTokens,
      cost_source: input.metadata.costSource,
      estimated_cost_usd: input.metadata.estimatedCostUsd,
      duration_ms: input.durationMs ?? null,
    },
  });
  await recordGenerationCost({
    scope: 'weekly',
    kind: 'llm',
    provider: input.metadata.provider,
    model: input.metadata.model,
    costUsd: input.metadata.estimatedCostUsd,
    costSource: input.metadata.costSource,
    promptTokens: input.metadata.promptTokens,
    outputTokens: input.metadata.outputTokens,
    weeklyDigestId: input.job.weekly_digest_id,
    revisionId: input.job.revision_id,
    jobId: input.job.id,
    attemptId: input.job.attempt_id,
    stepKey: input.step,
    metadata: { prompt_version: input.metadata.promptVersion, segment: input.label },
  });
}

async function generateEditorialMaster(
  job: ClaimedGenerationJob,
  tracker: GenerationAttemptTracker,
) {
  await tracker.event({
    type: 'step_started',
    step: 'prepare',
    progressCurrent: 0,
    progressTotal: 100,
    message: 'Loading approved research packs',
  });
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
  const planHash = computeMasterPlanHash(researchPacks, retryGuidance);

  const resume = await loadMasterResumeState(job, planHash);
  const state = (await loadOwnMasterRunState(job.id, planHash)) ?? resume?.state ?? null;
  if (state) {
    await tracker.event({
      type: 'checkpoint_reused',
      step: 'prepare',
      progressCurrent: 4,
      progressTotal: 100,
      message: `Reusing ${Object.keys(state.segments).length} saved editorial segment(s)`,
      ...(resume ? { metadata: { resume_source_job_id: resume.sourceJobId } } : {}),
    });
  }

  const outcome = await runWeeklyMaster({
    stories: sourceStories,
    researchPacks,
    retryGuidance,
    state,
    deadlineAt: masterRunDeadline(),
    // Lets an owner-configured /admin/providers chain for weekly.master_writer
    // / weekly.master_critic override the default value-ranked OpenRouter step.
    db: getSupabaseAdmin(),
    hooks: {
      onState: async (runState, progress) => {
        await tracker.checkpoint(
          { [MASTER_STATE_KEY]: runState as unknown as Json },
          progress.step,
          progress.percent,
        );
        await tracker.event({
          type: 'step_progress',
          step: progress.step,
          progressCurrent: progress.percent,
          progressTotal: 100,
          message: progress.message,
        });
      },
      onProviderCallStarted: async (step, { label, percent }) => {
        await tracker.event({
          type: 'provider_call_started',
          step,
          progressCurrent: percent,
          progressTotal: 100,
          message: `Starting ${label}`,
          metadata: {
            role: step === 'critic' ? 'weekly.master_critic' : 'weekly.master_writer',
            segment: label,
          },
        });
      },
      onProviderCallCompleted: async (step, metadata, { label, percent, durationMs }) => {
        await recordMasterProviderCall({
          job,
          tracker,
          step,
          metadata,
          label,
          progress: percent,
          durationMs,
        });
      },
      onNote: async (entry) => {
        await tracker.event({
          type: 'worker_note',
          level: entry.level,
          step: entry.step,
          message: entry.message,
          ...(entry.metadata ? { metadata: entry.metadata as Record<string, Json> } : {}),
        });
      },
    },
  });

  if (outcome.status === 'incomplete') {
    // Not an editorial failure and not lost work: every finished segment is
    // on the job row, so the linked retry picks up here. Retryable on purpose.
    throw new Error(
      `Master run paused with ${outcome.completedSegments}/${outcome.totalSegments} segments saved — a retry resumes from the saved state. Reason: ${outcome.reason}`,
    );
  }

  const { bundle: _bundle, quality, converged, unresolved } = outcome;
  await tracker.event({
    type: 'step_completed',
    step: 'critic',
    provider: outcome.generation.critic.provider,
    model: outcome.generation.critic.model,
    progressCurrent: 94,
    progressTotal: 100,
    message: `Editorial critic finished at ${quality.score}/100`,
  });

  if (!converged) {
    // The edition is imperfect, not lost. Everything the models produced is
    // real, paid-for copy that the repair loop already improved as far as it
    // could; the remaining items are judgment calls for the owner. Saving it
    // as an inactive draft and finishing the job as *succeeded* is the whole
    // point of this path: an unresolved quality item is a review task, not an
    // infrastructure failure, and it must never again burn a 30-minute run
    // and leave nothing behind.
    const qualityArtifactId = await saveQualityReport({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      report: quality,
      generation: outcome.generation,
      passed: false,
      jobId: job.id,
      recordCost: false,
    });
    const draft = await createMasterRevision({
      job,
      context,
      result: outcome,
      requestedMode,
      approvedResearch,
      rpcName: 'create_service_weekly_digest_revision_draft',
      persistArticleArtifacts: false,
      // Truncated to 120 chars by the RPC and shown as-is on the revision
      // card (weekly-workspace.tsx).
      reason: `Needs review: ${quality.score}/100, ${unresolved.length} unresolved check(s)`,
    });
    await tracker.event({
      type: 'quality_review_required',
      level: 'warning',
      step: 'persist',
      progressCurrent: 98,
      progressTotal: 100,
      message: `Saved for owner review: ${unresolved.length} unresolved check(s) — ${unresolvedSummary(unresolved)}`,
      metadata: {
        draft_revision_id: draft.revisionId,
        quality_artifact_id: qualityArtifactId,
        unresolved: unresolved as unknown as Json,
      },
    });
    await alertWeeklyDigestIssue({
      weeklyDigestId: job.weekly_digest_id,
      phase: 'generation',
      message: `Weekly master saved as a draft revision for review: ${quality.score}/100 with ${unresolved.length} unresolved check(s).`,
    });
    return {
      artifactId: null,
      output: {
        [MASTER_STATE_KEY]: outcome.state as unknown as Json,
        master_draft_revision_id: draft.revisionId,
        quality_artifact_id: qualityArtifactId,
        quality_score: quality.score,
        quality_passed: false,
        needs_owner_review: true,
        unresolved_issues: unresolved as unknown as Json,
      },
    };
  }

  const created = await createMasterRevision({
    job,
    context,
    result: outcome,
    requestedMode,
    approvedResearch,
    rpcName: 'create_service_weekly_digest_revision',
    persistArticleArtifacts: true,
    reason: 'weekly_content_studio_v2_master',
  });
  const qualityArtifactId = await saveQualityReport({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: created.revisionId,
    report: quality,
    generation: outcome.generation,
    passed: true,
    jobId: job.id,
    recordCost: false,
  });
  await tracker.event({
    type: 'step_completed',
    step: 'persist',
    progressCurrent: 98,
    progressTotal: 100,
    message: 'Revision and quality report saved',
  });
  await queuePostMasterJobs(job.weekly_digest_id, created.revisionId, created.newItems);
  return {
    artifactId: null,
    output: {
      [MASTER_STATE_KEY]: outcome.state as unknown as Json,
      new_revision_id: created.revisionId,
      article_artifact_ids: created.articleArtifactIds,
      quality_artifact_id: qualityArtifactId,
      quality_score: quality.score,
      quality_passed: true,
      needs_owner_review: false,
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
  result: Extract<WeeklyMasterRunOutcome, { status: 'complete' }>;
  requestedMode: ReturnType<typeof contentStudioJobMode>;
  approvedResearch: ReturnType<typeof researchPacksFromContext>;
  rpcName: 'create_service_weekly_digest_revision' | 'create_service_weekly_digest_revision_draft';
  persistArticleArtifacts: boolean;
  reason: string;
}) {
  const {
    job,
    context,
    result,
    requestedMode,
    approvedResearch,
    rpcName,
    persistArticleArtifacts,
    reason,
  } = params;
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
  // Artifacts are deliberately active-revision-only. A quality-rejected
  // revision remains inactive for owner review, so attaching EN/UK artifacts
  // here would turn an editorial rejection into an infrastructure failure.
  if (!persistArticleArtifacts) {
    return { revisionId: newRevisionId, articleArtifactIds: [], newItems: [] };
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
  return {
    en: articleEn.content,
    uk: articleUk.content,
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
  tracker: GenerationAttemptTracker,
  checkpointHash: string,
  checkpoint: SocialCopyCheckpoint,
  progressCurrent: number,
) {
  const output: SocialCopyCheckpointOutput = {
    socialCopyCheckpointHash: checkpointHash,
    tokens: checkpoint.tokens,
    adaptations: checkpoint.adaptations,
  };
  await tracker.checkpoint(
    output as unknown as Record<string, Json | undefined>,
    'channels',
    progressCurrent,
  );
}

async function generateSocialCopy(job: ClaimedGenerationJob, tracker: GenerationAttemptTracker) {
  await tracker.event({
    type: 'step_started',
    step: 'prepare',
    progressCurrent: 0,
    progressTotal: 100,
    message: 'Loading approved articles and cover for social copy',
  });
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
    const completedChannels = adaptations.length;
    const channelProgress = Math.round(5 + ((completedChannels + 1) / SOCIAL_CHANNELS.length) * 85);
    await tracker.event({
      type: 'provider_call_started',
      step: 'channels',
      provider: 'router',
      model: 'auto',
      progressCurrent: Math.round(5 + (completedChannels / SOCIAL_CHANNELS.length) * 85),
      progressTotal: 100,
      message: `Starting ${channel} social writer and critic`,
      metadata: { channel, role: 'weekly.social_writer', selection: 'provider_chain' },
    });
    const providerPipelineStartedAt = Date.now();
    const trackedUrl = new URL(`/r/s/${tokens[channel]}`, SITE_URL).toString();
    const assets = await socialAssetsForChannel(context, channel);
    const adaptation = await adaptWeeklySocialChannel({
      channel,
      locale,
      bundle,
      trackedUrl,
      scheduledFor: nextWeeklyScheduledForChannel(channel, context.digest.week_end, new Date()),
      sourceFacts,
      assets,
      altText:
        locale === 'uk'
          ? `Обкладинка тижневого дайджесту: ${bundle.uk.title}`
          : `Weekly Digest cover: ${bundle.en.title}`,
      db: getSupabaseAdmin(),
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
      attemptId: job.attempt_id,
      stepKey: `social:${channel}:writer`,
      metadata: { channel, role: 'writer' },
    });
    await tracker.event({
      type: 'provider_call_completed',
      step: 'channels',
      provider: adaptation.writer.provider,
      model: adaptation.writer.model,
      progressCurrent: channelProgress,
      progressTotal: 100,
      message: `${channel} social writer completed`,
      metadata: {
        channel,
        role: 'weekly.social_writer',
        prompt_tokens: adaptation.writer.usage.promptTokens,
        output_tokens: adaptation.writer.usage.outputTokens,
        estimated_cost_usd: adaptation.writer.usage.estimatedCostUsd,
        duration_ms: Date.now() - providerPipelineStartedAt,
      },
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
        attemptId: job.attempt_id,
        stepKey: `social:${channel}:critic`,
        metadata: { channel, role: 'critic' },
      });
      await tracker.event({
        type: 'provider_call_completed',
        step: 'channels',
        provider: adaptation.qualityReport.critic.provider ?? 'unknown',
        model: adaptation.qualityReport.critic.model ?? 'unknown',
        progressCurrent: channelProgress,
        progressTotal: 100,
        message: `${channel} social critic completed`,
        metadata: {
          channel,
          role: 'weekly.social_critic',
          prompt_tokens: criticUsage.promptTokens,
          output_tokens: criticUsage.outputTokens,
          estimated_cost_usd: criticUsage.estimatedCostUsd,
        },
      });
    }
    adaptations.push(adaptation);
    checkpointAdaptations[channel] = adaptation;
    await saveSocialCopyCheckpoint(
      tracker,
      checkpointHash,
      { tokens, adaptations: checkpointAdaptations },
      channelProgress,
    );
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
  await tracker.event({
    type: 'step_completed',
    step: 'persist',
    progressCurrent: 95,
    progressTotal: 100,
    message: 'Social package and review records saved',
  });
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
async function generateVideoScript(job: ClaimedGenerationJob, tracker: GenerationAttemptTracker) {
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
  const startedAt = Date.now();
  await tracker.event({
    type: 'provider_call_started',
    step: 'script',
    provider: 'router',
    model: 'auto',
    progressCurrent: 10,
    progressTotal: 100,
    message: 'Starting video script provider call',
    metadata: { role: 'weekly.video_script', selection: 'provider_chain' },
  });
  const { script, generation, issues } = await generateWeeklyVideoScript(article);
  await tracker.event({
    type: 'provider_call_completed',
    step: 'script',
    provider: generation.provider,
    model: generation.model,
    progressCurrent: 90,
    progressTotal: 100,
    message: 'Video script provider call completed',
    metadata: {
      role: 'weekly.video_script',
      prompt_version: generation.promptVersion,
      prompt_tokens: generation.promptTokens,
      output_tokens: generation.outputTokens,
      estimated_cost_usd: generation.estimatedCostUsd,
      duration_ms: Date.now() - startedAt,
    },
  });
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
    attemptId: job.attempt_id,
    stepKey: 'video_script',
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

function weeklyCardImageConfig() {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL?.trim(),
    geminiModel: process.env.GEMINI_MODEL?.trim(),
    openRouterApiKey:
      process.env.OPEN_ROUTER_API_KEY?.trim() ?? process.env.OPENROUTER_API_KEY?.trim(),
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim(),
    cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL?.trim(),
    db: getSupabaseAdmin(),
  };
}

type GenerationContext = Awaited<ReturnType<typeof loadGenerationContext>>;
type GenerationItem = GenerationContext['items'][number];

async function storyImageSceneInput(
  job: ClaimedGenerationJob,
  item: GenerationItem,
  context: GenerationContext,
) {
  const contentStudio = asRecord(asRecord(item.source_snapshot).content_studio);
  const directions = await loadStoryDirections(job.weekly_digest_id);
  const editorialAngle = item.brief_item_id ? directions.get(item.brief_item_id) : undefined;
  const researchPack = researchPacksFromContext(context).find(
    ({ artifact }) => artifact.revision_item_id === item.id,
  )?.pack;
  const claimsExcerpt =
    (
      researchPack?.claims.map((claim) => claim.text) ??
      approvedFactsForItem(item).map((claim) => claim.text)
    )
      .slice(0, 6)
      .join(' · ')
      .slice(0, 800) || undefined;
  const siblingMetaphors = context.artifacts
    .filter(
      (artifact) =>
        artifact.artifact_type === 'story_image' &&
        artifact.revision_item_id &&
        artifact.revision_item_id !== item.id,
    )
    .flatMap((artifact) => {
      const meta = asRecord(artifact.metadata);
      const scene = text(meta.scene) ?? text(meta.metaphor_title) ?? undefined;
      if (!scene) return [];
      const compositionRaw = text(meta.composition);
      const composition: 'single' | 'dual_contrast' | undefined =
        compositionRaw === 'dual_contrast' || compositionRaw === 'single'
          ? compositionRaw
          : undefined;
      return [
        {
          motifClass: text(meta.motif_class) ?? undefined,
          subjectKind: text(meta.subject_kind) ?? undefined,
          composition,
          sceneSummary: scene.slice(0, 180),
        },
      ];
    })
    .slice(0, 6);
  const siblingScenes = siblingMetaphors.map((hint) => hint.sceneSummary);
  return {
    headline: item.title_en,
    summary: item.summary_en,
    bodyExcerpt: item.body_en?.slice(0, 600),
    editorsView: text(contentStudio.editors_view_en) ?? undefined,
    editorialAngle,
    why: item.why_en ?? undefined,
    practical: item.practical_en ?? undefined,
    limitation: text(contentStudio.limitation_en) ?? undefined,
    takeaway: item.takeaway_en ?? undefined,
    claimsExcerpt,
    researchContext: researchPack?.context.slice(0, 4).join(' · ').slice(0, 600) || undefined,
    researchLimitations:
      [...(researchPack?.limitations ?? []), ...(researchPack?.contradictions ?? [])]
        .slice(0, 4)
        .join(' · ')
        .slice(0, 500) || undefined,
    researchRisks: researchPack?.risks.slice(0, 4).join(' · ').slice(0, 400) || undefined,
    avoidSubjects: siblingScenes.length ? siblingScenes : undefined,
    siblingMetaphors: siblingMetaphors.length ? siblingMetaphors : undefined,
  };
}

async function writeStoryImagePromptSet(
  job: ClaimedGenerationJob,
  tracker: GenerationAttemptTracker,
  item: GenerationItem,
  context: GenerationContext,
) {
  await tracker.event({
    type: 'stage_started',
    step: 'prompts',
    progressCurrent: 20,
    progressTotal: 100,
    message: 'Building copy-ready illustration prompts',
  });
  const { weeklyReportageSceneBriefs, WEEKLY_PROMPT_POLICY } = await lazyCardImage();
  const { exportManualImagePrompts } = await lazyPromptExport();
  const sceneInput = await storyImageSceneInput(job, item, context);
  const produced = await produceStoryPrompts({
    headline: item.title_en,
    sceneBriefs: weeklyReportageSceneBriefs,
    exportPrompts: exportManualImagePrompts,
    sceneInput,
    cfg: weeklyCardImageConfig(),
    policy: WEEKLY_PROMPT_POLICY,
  });
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    revisionItemId: item.id,
    artifactType: 'story_prompt_set',
    locale: 'neutral',
    slotKey: storyPromptSlot(item.id),
    content: {
      // JSONB column: ManualImagePrompt[] is a JSON array, not a Json union member.
      prompts: produced.content.prompts as unknown as Json,
      policy: produced.content.policy,
      generated_at: produced.content.generated_at,
    },
    metadata: {
      source_kind: 'prompt_only',
      prompt_policy: produced.content.policy,
    },
  });
  return {
    artifactId,
    output: {
      ...produced.output,
      artifact_type: 'story_prompt_set',
      slot_key: storyPromptSlot(item.id),
    },
  };
}

async function writeCoverPromptSet(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const headline = context.revision.title_en?.trim() || 'Weekly AI Digest';
  const topTitles = context.items
    .slice(0, 3)
    .map((item) => item.title_en)
    .filter(Boolean)
    .join(' · ');
  const { weeklyReportageSceneBriefs, WEEKLY_PROMPT_POLICY } = await lazyCardImage();
  const { exportManualImagePrompts } = await lazyPromptExport();
  const produced = await produceStoryPrompts({
    headline,
    sceneBriefs: weeklyReportageSceneBriefs,
    exportPrompts: exportManualImagePrompts,
    sceneInput: {
      headline,
      summary: topTitles || context.revision.intro_en || headline,
      why: context.revision.intro_en ?? undefined,
    },
    cfg: weeklyCardImageConfig(),
    policy: WEEKLY_PROMPT_POLICY,
    count: 1,
  });
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'story_prompt_set',
    locale: 'neutral',
    slotKey: COVER_PROMPT_SLOT,
    content: {
      // JSONB column: ManualImagePrompt[] is a JSON array, not a Json union member.
      prompts: produced.content.prompts as unknown as Json,
      policy: produced.content.policy,
      generated_at: produced.content.generated_at,
    },
    metadata: {
      source_kind: 'prompt_only',
      prompt_policy: produced.content.policy,
      cover: true,
    },
  });
  return {
    artifactId,
    output: {
      ...produced.output,
      artifact_type: 'story_prompt_set',
      slot_key: COVER_PROMPT_SLOT,
    },
  };
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

async function generateStoryImage(job: ClaimedGenerationJob, tracker: GenerationAttemptTracker) {
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
  let promptPolicy = 'weekly-semantic-story-v5.1';
  let imageMeta: {
    provider: string;
    model: string;
    estimatedCostUsd: number;
    costSource: 'reported' | 'estimated' | 'subscription';
    scene?: string;
    positivePrompt?: string;
    negativePrompt?: string;
    sceneSource?: string;
    storyContext?: string;
    meaning?: string;
    essence?: string;
    mechanism?: string;
    consequence?: string;
    visualThesis?: string;
    readerTest?: string;
    metaphorTitle?: string;
    whyItFits?: string;
    storyAnchor?: string;
    visibleMechanism?: string;
    visibleConsequence?: string;
    motifClass?: string;
    subjectKind?: string;
    composition?: string;
    conceptLens?: string;
    variantConcepts?: Array<{
      conceptLens?: string;
      scene: string;
      sceneSource: string;
      positivePrompt: string;
      negativePrompt: string;
      metaphorTitle?: string;
      motifClass?: string;
      subjectKind?: string;
      composition?: string;
    }>;
    variantScores?: Array<{
      index: number;
      overall: number;
      blockers: string[];
      passed: boolean;
      news_legibility?: number;
      craft?: number;
      context_fidelity?: number;
      mechanism_legibility?: number;
      consequence_legibility?: number;
      instant_comprehension?: number;
      semantic_min?: number;
    }>;
    pickSource?: 'auto' | 'owner';
    iterationPreviews?: WeeklyImageIterationPreview[];
  } | null = null;
  /** Additional variant renders (sharp-processed, not yet uploaded) beyond the primary. */
  let alternateBuffers: Buffer[] = [];
  let contentSimMeta: import('@/lib/content-sim').ContentSimArtifactMeta | null = null;
  let needsHumanReview = false;

  if (requestedSourceUrl?.startsWith('http')) {
    const response = await fetch(requestedSourceUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Story image source returned ${response.status}.`);
    source = Buffer.from(await response.arrayBuffer());
    sourceUrl = requestedSourceUrl;
    sourceKind = 'editor_url';
  } else if (storyImageJobPath(null, resolveWeeklyStoryImageMode()) === 'prompt_only') {
    return writeStoryImagePromptSet(job, tracker, item, context);
  } else {
    await tracker.event({
      type: 'stage_started',
      step: 'generate',
      progressCurrent: 5,
      progressTotal: 100,
      message: 'Building the semantic contract, rendering variants and running vision review',
    });
    const { generateWeeklyReportageIllustrations, WEEKLY_PROMPT_POLICY } = await lazyCardImage();
    const { runWeeklyImageSimLoop } = await import('@/lib/content-sim/adapters/weekly-image');
    promptPolicy = WEEKLY_PROMPT_POLICY;
    const contentStudio = asRecord(asRecord(item.source_snapshot).content_studio);
    const directions = await loadStoryDirections(job.weekly_digest_id);
    const editorialAngle = item.brief_item_id ? directions.get(item.brief_item_id) : undefined;
    const researchPack = researchPacksFromContext(context).find(
      ({ artifact }) => artifact.revision_item_id === item.id,
    )?.pack;
    const claimsExcerpt =
      (
        researchPack?.claims.map((claim) => claim.text) ??
        approvedFactsForItem(item).map((claim) => claim.text)
      )
        .slice(0, 6)
        .join(' · ')
        .slice(0, 800) || undefined;
    const researchContext = researchPack?.context.slice(0, 4).join(' · ').slice(0, 600);
    const researchLimitations = [
      ...(researchPack?.limitations ?? []),
      ...(researchPack?.contradictions ?? []),
    ]
      .slice(0, 4)
      .join(' · ')
      .slice(0, 500);
    const researchRisks = researchPack?.risks.slice(0, 4).join(' · ').slice(0, 400);
    const siblingMetaphors: Array<{
      motifClass?: string;
      subjectKind?: string;
      composition?: 'single' | 'dual_contrast';
      sceneSummary: string;
    }> = context.artifacts
      .filter(
        (artifact) =>
          artifact.artifact_type === 'story_image' &&
          artifact.revision_item_id &&
          artifact.revision_item_id !== item.id,
      )
      .flatMap((artifact) => {
        const meta = asRecord(artifact.metadata);
        const scene = text(meta.scene) ?? text(meta.metaphor_title) ?? undefined;
        if (!scene) return [];
        const compositionRaw = text(meta.composition);
        const composition: 'single' | 'dual_contrast' | undefined =
          compositionRaw === 'dual_contrast' || compositionRaw === 'single'
            ? compositionRaw
            : undefined;
        return [
          {
            motifClass: text(meta.motif_class) ?? undefined,
            subjectKind: text(meta.subject_kind) ?? undefined,
            composition,
            sceneSummary: scene.slice(0, 180),
          },
        ];
      })
      .slice(0, 6);
    const siblingScenes = siblingMetaphors.map((s) => s.sceneSummary);

    const sim = await runWeeklyImageSimLoop({
      ctx: {
        headline: item.title_en,
        summary: item.summary_en ?? undefined,
        why: item.why_en ?? undefined,
        practical: item.practical_en ?? undefined,
        limitation: text(contentStudio.limitation_en) ?? undefined,
        takeaway: item.takeaway_en ?? undefined,
        claimsExcerpt,
        editorialAngle,
        policyId: WEEKLY_PROMPT_POLICY,
        siblingScenes: siblingScenes.length ? siblingScenes : undefined,
      },
      seedBase: `${job.weekly_digest_id}:${job.revision_id}:${item.id}`,
      sceneOverride: sceneOverride ?? undefined,
      generate: async ({
        attempt,
        sceneOverride: override,
        seedBase,
        promptSuffix,
        rejectedScene,
        planningFeedback,
      }) => {
        const sceneForGen = override || undefined;
        const illustrations = await generateWeeklyReportageIllustrations(
          {
            headline: item.title_en,
            summary: item.summary_en,
            bodyExcerpt: item.body_en?.slice(0, 600),
            editorsView: text(contentStudio.editors_view_en) ?? undefined,
            editorialAngle,
            why: item.why_en ?? undefined,
            practical: item.practical_en ?? undefined,
            limitation: text(contentStudio.limitation_en) ?? undefined,
            takeaway: item.takeaway_en ?? undefined,
            claimsExcerpt,
            researchContext: researchContext || undefined,
            researchLimitations: researchLimitations || undefined,
            researchRisks: researchRisks || undefined,
            avoidSubjects: siblingScenes.length ? siblingScenes : undefined,
            siblingMetaphors: siblingMetaphors.length ? siblingMetaphors : undefined,
            seedBase,
            sceneOverride: sceneForGen,
            sceneOverrideSource: 'owner',
            rejectedScenes: rejectedScene ? [rejectedScene] : undefined,
            repairFeedback: planningFeedback.length ? planningFeedback : undefined,
            renderDirective: promptSuffix || undefined,
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
            db: getSupabaseAdmin(),
            onImageGenerated: async (result, variant) => {
              if (result.provider === 'local') return;
              await recordGenerationCost({
                scope: 'weekly',
                kind: 'image',
                provider: result.provider,
                model: result.model,
                costUsd: result.estimatedCostUsd,
                costSource: result.costSource,
                weeklyDigestId: job.weekly_digest_id,
                revisionId: job.revision_id,
                jobId: job.id,
                attemptId: job.attempt_id,
                stepKey: `story_image.round.${attempt}.render.${variant?.variantIndex ?? 0}`,
                metadata: {
                  revision_item_id: item.id,
                  round: attempt,
                  variant_index: variant?.variantIndex ?? null,
                  cost_granularity: 'provider_call',
                },
              });
            },
          },
        );
        if (!illustrations?.variants.length) return null;
        const [primary, ...alternates] = illustrations.variants;
        return {
          bytes: primary!.bytes,
          width: primary!.width,
          height: primary!.height,
          provider: primary!.provider,
          model: primary!.model,
          estimatedCostUsd: illustrations.variants.reduce((sum, v) => sum + v.estimatedCostUsd, 0),
          costSource: primary!.costSource,
          scene: illustrations.scene,
          positivePrompt: primary!.positivePrompt ?? '',
          negativePrompt: primary!.negativePrompt ?? '',
          sceneSource: illustrations.sceneSource,
          conceptLens: primary!.conceptLens,
          storyContext: illustrations.storyContext,
          meaning: illustrations.meaning,
          essence: illustrations.essence,
          mechanism: illustrations.mechanism,
          consequence: illustrations.consequence,
          visualThesis: illustrations.visualThesis,
          readerTest: illustrations.readerTest,
          metaphorTitle: illustrations.metaphorTitle,
          whyItFits: illustrations.whyItFits,
          storyAnchor: illustrations.storyAnchor,
          visibleMechanism: illustrations.visibleMechanism,
          visibleConsequence: illustrations.visibleConsequence,
          motifClass: illustrations.motifClass,
          subjectKind: illustrations.subjectKind,
          composition: illustrations.composition,
          alternateBuffers: alternates.map((variant) => variant.bytes),
          variantConcepts: illustrations.variants.map((variant) => ({
            conceptLens: variant.conceptLens,
            scene: variant.scene,
            sceneSource: variant.sceneSource,
            positivePrompt: variant.positivePrompt,
            negativePrompt: variant.negativePrompt,
            storyContext: variant.storyContext,
            meaning: variant.meaning,
            essence: variant.essence,
            mechanism: variant.mechanism,
            consequence: variant.consequence,
            visualThesis: variant.visualThesis,
            readerTest: variant.readerTest,
            metaphorTitle: variant.metaphorTitle,
            whyItFits: variant.whyItFits,
            storyAnchor: variant.storyAnchor,
            visibleMechanism: variant.visibleMechanism,
            visibleConsequence: variant.visibleConsequence,
            motifClass: variant.motifClass,
            subjectKind: variant.subjectKind,
            composition: variant.composition,
          })),
        };
      },
      onCostEvent: async (event) => {
        await recordGenerationCost({
          scope: 'weekly',
          kind: event.kind,
          provider: event.provider,
          model: event.model,
          costUsd: event.costUsd,
          costSource: event.costSource,
          promptTokens: event.promptTokens,
          outputTokens: event.outputTokens,
          weeklyDigestId: job.weekly_digest_id,
          revisionId: job.revision_id,
          jobId: job.id,
          attemptId: job.attempt_id,
          stepKey: `story_image.round.${event.attempt}.vision.${event.variantIndex + 1}`,
          metadata: {
            revision_item_id: item.id,
            round: event.attempt,
            variant_index: event.variantIndex + 1,
            cost_granularity: 'provider_call',
          },
        });
      },
    });

    contentSimMeta = sim.meta;
    needsHumanReview = !sim.report.passed;
    if (sim.candidate && sim.candidate.bytes.length > 0) {
      source = sim.candidate.bytes;
      imageMeta = {
        provider: sim.candidate.provider,
        model: sim.candidate.model,
        estimatedCostUsd: sim.report.totalCostUsd || sim.candidate.estimatedCostUsd,
        costSource: sim.candidate.costSource,
        scene: sim.candidate.scene,
        positivePrompt: sim.candidate.positivePrompt,
        negativePrompt: sim.candidate.negativePrompt,
        sceneSource: sim.candidate.sceneSource,
        storyContext: sim.candidate.storyContext,
        meaning: sim.candidate.meaning,
        essence: sim.candidate.essence,
        mechanism: sim.candidate.mechanism,
        consequence: sim.candidate.consequence,
        visualThesis: sim.candidate.visualThesis,
        readerTest: sim.candidate.readerTest,
        metaphorTitle: sim.candidate.metaphorTitle,
        whyItFits: sim.candidate.whyItFits,
        storyAnchor: sim.candidate.storyAnchor,
        visibleMechanism: sim.candidate.visibleMechanism,
        visibleConsequence: sim.candidate.visibleConsequence,
        motifClass: sim.candidate.motifClass,
        subjectKind: sim.candidate.subjectKind,
        composition: sim.candidate.composition,
        conceptLens: sim.candidate.conceptLens,
        variantConcepts: sim.candidate.variantConcepts,
        variantScores: sim.candidate.variantScores,
        pickSource: sim.candidate.pickSource ?? 'auto',
        iterationPreviews: sim.iterationPreviews,
      };
      alternateBuffers = sim.candidate.alternateBuffers;
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
      needsHumanReview = true;
    }
  }

  if (source.length > 15 * 1024 * 1024) throw new Error('Story image source exceeds 15 MB.');
  await tracker.event({
    type: 'stage_started',
    step: 'persist',
    provider: imageMeta?.provider,
    model: imageMeta?.model,
    progressCurrent: 90,
    progressTotal: 100,
    message: 'Saving the selected illustration and alternate variants',
  });
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

  const previewPaths: string[] = [];
  for (const [index, buffer] of alternateBuffers.entries()) {
    const processed = await processImage(buffer);
    const altHash = createHash('sha256').update(processed).digest('hex');
    const altPath = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${altHash}-${job.id}-alt${index + 1}.jpg`;
    await uploadPrivate(altPath, processed, 'image/jpeg');
    previewPaths.push(altPath);
  }

  const iterationPreviews: Array<Record<string, Json | undefined>> = [];
  for (const preview of imageMeta?.iterationPreviews ?? []) {
    if (!preview.bytes?.length) continue;
    const processed = await processImage(preview.bytes);
    const previewHash = createHash('sha256').update(processed).digest('hex');
    const previewPath =
      `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/` +
      `${previewHash}-${job.id}-attempt${preview.attempt}-v${preview.variantIndex + 1}.jpg`;
    await uploadPrivate(previewPath, processed, 'image/jpeg');
    iterationPreviews.push({
      path: previewPath,
      attempt: preview.attempt,
      variant_index: preview.variantIndex,
      label:
        preview.concept.metaphorTitle ||
        preview.concept.conceptLens ||
        `Attempt ${preview.attempt} · variant ${preview.variantIndex + 1}`,
      concept_lens: preview.concept.conceptLens,
      metaphor_title: preview.concept.metaphorTitle,
      motif_class: preview.concept.motifClass,
      subject_kind: preview.concept.subjectKind,
      scene: preview.concept.scene,
      scene_source: preview.concept.sceneSource,
      score: preview.score as unknown as Json,
      critique_passed: preview.critiquePassed,
      attempt_cost_usd: preview.attemptCostUsd,
    });
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
      ...(iterationPreviews.length
        ? { iteration_previews: iterationPreviews as unknown as Json }
        : {}),
    },
    metadata: {
      source_kind: sourceKind,
      source_url: sourceUrl,
      focal_point: text(input.focal_point) ?? 'attention',
      prompt_policy: promptPolicy,
      ...(contentSimMeta
        ? { content_sim: contentSimMeta as unknown as import('@/lib/database.types').Json }
        : {}),
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
                  ...(imageMeta.storyContext ? { story_context: imageMeta.storyContext } : {}),
                  ...(imageMeta.meaning ? { meaning: imageMeta.meaning } : {}),
                  ...(imageMeta.essence ? { essence: imageMeta.essence } : {}),
                  ...(imageMeta.mechanism ? { mechanism: imageMeta.mechanism } : {}),
                  ...(imageMeta.consequence ? { consequence: imageMeta.consequence } : {}),
                  ...(imageMeta.visualThesis ? { visual_thesis: imageMeta.visualThesis } : {}),
                  ...(imageMeta.readerTest ? { reader_test: imageMeta.readerTest } : {}),
                  ...(imageMeta.metaphorTitle ? { metaphor_title: imageMeta.metaphorTitle } : {}),
                  ...(imageMeta.whyItFits ? { why_it_fits: imageMeta.whyItFits } : {}),
                  ...(imageMeta.storyAnchor ? { story_anchor: imageMeta.storyAnchor } : {}),
                  ...(imageMeta.visibleMechanism
                    ? { visible_mechanism: imageMeta.visibleMechanism }
                    : {}),
                  ...(imageMeta.visibleConsequence
                    ? { visible_consequence: imageMeta.visibleConsequence }
                    : {}),
                  ...(imageMeta.motifClass ? { motif_class: imageMeta.motifClass } : {}),
                  ...(imageMeta.subjectKind ? { subject_kind: imageMeta.subjectKind } : {}),
                  ...(imageMeta.composition ? { composition: imageMeta.composition } : {}),
                  ...(imageMeta.conceptLens ? { concept_lens: imageMeta.conceptLens } : {}),
                  ...(imageMeta.variantConcepts?.length
                    ? {
                        variant_concepts: imageMeta.variantConcepts.map((concept, index) => ({
                          index,
                          concept_lens: concept.conceptLens,
                          scene: concept.scene,
                          scene_source: concept.sceneSource,
                          positive_prompt: concept.positivePrompt,
                          negative_prompt: concept.negativePrompt,
                          metaphor_title: concept.metaphorTitle,
                          motif_class: concept.motifClass,
                          subject_kind: concept.subjectKind,
                          composition: concept.composition,
                        })),
                      }
                    : {}),
                  ...(imageMeta.variantScores?.length
                    ? {
                        variant_scores: imageMeta.variantScores.map((row) => ({
                          index: row.index,
                          overall: row.overall,
                          blockers: row.blockers,
                          passed: row.passed,
                          ...(typeof row.news_legibility === 'number'
                            ? { news_legibility: row.news_legibility }
                            : {}),
                          ...(typeof row.craft === 'number' ? { craft: row.craft } : {}),
                          ...(typeof row.context_fidelity === 'number'
                            ? { context_fidelity: row.context_fidelity }
                            : {}),
                          ...(typeof row.mechanism_legibility === 'number'
                            ? { mechanism_legibility: row.mechanism_legibility }
                            : {}),
                          ...(typeof row.consequence_legibility === 'number'
                            ? { consequence_legibility: row.consequence_legibility }
                            : {}),
                          ...(typeof row.instant_comprehension === 'number'
                            ? { instant_comprehension: row.instant_comprehension }
                            : {}),
                          ...(typeof row.semantic_min === 'number'
                            ? { semantic_min: row.semantic_min }
                            : {}),
                        })),
                      }
                    : {}),
                  ...(imageMeta.pickSource ? { pick_source: imageMeta.pickSource } : {}),
                }
              : {}),
          }
        : {}),
    },
  });
  return {
    artifactId,
    output: {
      path,
      byte_size: image.length,
      sha256: hash,
      variants: 1 + alternateBuffers.length,
      ...(needsHumanReview
        ? {
            needs_owner_review: true,
            content_sim_outcome: contentSimMeta?.outcome ?? 'needs_human_review',
          }
        : { content_sim_outcome: contentSimMeta?.outcome ?? 'passed' }),
    },
  };
}

async function generateCover(job: ClaimedGenerationJob) {
  if (resolveWeeklyStoryImageMode() === 'prompt_only') {
    return writeCoverPromptSet(job);
  }
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

async function runGenerationJob(job: ClaimedGenerationJob, tracker: GenerationAttemptTracker) {
  if (job.job_type === 'research_pack') return generateResearchPack(job);
  if (job.job_type === 'editorial_master') return generateEditorialMaster(job, tracker);
  if (job.job_type === 'social_copy') return generateSocialCopy(job, tracker);
  if (job.job_type === 'video_script') return generateVideoScript(job, tracker);
  if (job.job_type === 'video_manifest') return generateVideoManifest(job);
  if (job.job_type === 'pdf') return generatePdf(job);
  if (job.job_type === 'story_image') return generateStoryImage(job, tracker);
  if (job.job_type === 'cover') return generateCover(job);
  if (job.job_type === 'social_asset') return generateCoverDerivatives(job);
  throw new Error(`Unsupported generation job type: ${job.job_type}`);
}

async function runClaimedGenerationJob(job: ClaimedGenerationJob) {
  const tracker = new GenerationAttemptTracker(job);
  tracker.start();
  try {
    await tracker.event({
      type: 'worker_ready',
      step: 'prepare',
      progressCurrent: 0,
      progressTotal: 100,
      message: `Worker claimed by ${job.execution_backend}`,
      metadata: { backend: job.execution_backend, attempt: job.attempts },
    });
    const result = await runGenerationJob(job, tracker);
    await finishGenerationJob(job, true, result.output, null, null, false, result.artifactId);
    return {
      id: job.id,
      jobType: job.job_type,
      outcome: 'succeeded' as const,
      artifactId: result.artifactId,
    };
  } catch (error) {
    const message = safeMessage(error);
    const failure = classifyGenerationFailure(message);
    try {
      await finishGenerationJob(
        job,
        false,
        { retryable: failure.retryable, failure_code: failure.code },
        message,
        failure.code,
        failure.retryable,
        null,
      );
    } catch (finishError) {
      await alertWeeklyDigestIssue({
        weeklyDigestId: job.weekly_digest_id,
        phase: 'generation',
        message:
          `${job.job_type} attempt ${job.attempts} on ${job.execution_backend}: ${message}; ${safeMessage(finishError)}`.slice(
            0,
            1800,
          ),
      });
      return {
        id: job.id,
        jobType: job.job_type,
        outcome: 'failed' as const,
        error: `${message}; ${safeMessage(finishError)}`.slice(0, 1800),
      };
    }
    if (!failure.retryable || job.attempts >= 3) {
      await alertWeeklyDigestIssue({
        weeklyDigestId: job.weekly_digest_id,
        phase: 'generation',
        message: `${job.job_type} attempt ${job.attempts} on ${job.execution_backend}: ${message}. ${failure.nextAction}`,
      });
    }
    return { id: job.id, jobType: job.job_type, outcome: 'failed' as const, error: message };
  } finally {
    await tracker.stop();
  }
}

export async function runWeeklyDigestGenerationJobs(
  limit = 5,
  jobTypes?: string[],
  options: GenerationWorkerOptions = {},
) {
  const jobs = await claimGenerationJobs(limit, jobTypes, options);
  const results = await mapWithConcurrency(jobs, jobs.length, runClaimedGenerationJob);
  return { claimed: jobs.length, results };
}
