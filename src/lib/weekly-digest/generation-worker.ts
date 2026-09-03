import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { weeklyTrackedUrl } from '@/lib/social/tracked-url';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertDailyGenerationBudget, recordGenerationCost } from '@/lib/generation-costs';
import { alertWeeklyDigestIssue } from './alerts';
import { localizedWeeklyDisplayTitle } from './display-title';
import {
  MASTER_REVISION_RPC,
  MASTER_VISUAL_DIRECTION_REVISION_RPC,
  masterPersistDecision,
} from './master-persist';
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
import { isWeeklyVisualRefreshPromptJob } from './visual-refresh';
import { weeklyVisualDirectionFromArticles } from './visual-direction';
import { parseStoryPromptSetContent } from './story-prompt-set';
import type { SiblingMetaphorHint } from '../../../pipeline/card-image';
import { storageBlob } from '@/lib/storage/binary';
import {
  selectInstagramCarouselSources,
  selectedImageToAssetRef,
  selectWeeklyChannelImage,
  type SocialSelectableArtifact,
} from '@/lib/social/channel-assets';
import { socialContentHash } from '@/lib/social/content-hash';
import type { InstagramCarouselSpec } from '@/lib/social/instagram-carousel';
import { findBlindCrossPosts } from '@/lib/social/quality';
import {
  SOCIAL_CHANNELS,
  type QualityReport,
  type SocialAsset,
  type SocialChannel,
  type SocialLocale,
} from '@/lib/social/types';
import { masterBundleFromArtifacts } from './master-bundle';
import { canMachineAttest, socialCopyHasUseBlock } from './machine-attest';
import {
  canonicalSourceName,
  contentFingerprint,
  editorialQualityRetryGuidance,
  placementForRank,
  REQUIRED_QUALITY_DIMENSIONS,
  resolveWeeklyContentStudioMode,
  sourceNameMatchesDomain,
  WEEKLY_CONTENT_STUDIO_VERSION,
  WEEKLY_MASTER_SPEC_VERSION,
  WEEKLY_VIDEO_MANIFEST_VERSION,
  WEEKLY_VIDEO_SCRIPT_SCHEMA_VERSION,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyQualityDimension,
  type WeeklyResearchPack,
  type WeeklyVideoScript,
} from './content-studio';
import { videoScriptFromArtifactContent } from './video-script-content';
import {
  type EditorialGenerationMetadata,
  type EditorialModelRef,
  type WeeklyMasterInputStory,
  type WeeklyMasterProviderStep,
  type WeeklyMasterRetryGuidance,
} from './editorial-llm';
import {
  computeMasterPlanHash,
  reusableMasterRunState,
  runWeeklyMaster,
  seedMasterRunStateFromBundle,
  type MasterRunState,
  type WeeklyMasterRunOutcome,
} from './master-engine';
import type { UnresolvedIssue } from './master-repair';
import {
  contentStudioVideoManifestKey,
  queuePostMasterJobs,
} from './content-studio-queue';
import { nextWeeklyScheduledForChannel } from '@/lib/social/schedule';
import { generateWeeklyVideoScript, requireVideoScriptArticle } from './video-script-llm';
import {
  buildWeeklyResearchPack,
  isWeeklyResearchPack,
  RESEARCH_CORPUS_MAX_PAGES,
  RESEARCH_CORPUS_PAGE_SIZE,
  trustedWeeklyResearchSources,
} from './research';
import { corroborationWindow, type CorpusArticle } from '../../../pipeline/story-identity';
import {
  adaptWeeklySocialChannel,
  releaseSocialCopyForReview,
  type WeeklySocialAdaptation,
} from './social-adapter';
import { buildWeeklySocialFactSnapshot } from './social-facts';
import { renderWeeklyInstagramCarousel } from './instagram-carousel-render';
import {
  SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
  socialCopyCheckpointFromOutput,
  socialCopyCheckpointOutput,
  socialCopyCheckpointScore,
  type SocialAssetCheckpoint,
  type SocialCopyCheckpoint,
} from './social-checkpoint';
import type { WeeklyImageIterationPreview } from '@/lib/content-sim/adapters/weekly-image';

const PRIVATE_BUCKET = 'weekly-digest-private';
const MAX_JOBS = 10;
/** One explanation first; a rejected render gets a repaired retry, not a choice set. */
export const WEEKLY_STORY_RENDER_VARIANT_COUNT = 1;

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

/**
 * Social slots anchor to the release instant. A silent "now" fallback here
 * scheduled posts for the generation day while the digest was still
 * unscheduled, and release preflight then failed on `scheduled_for <
 * release_at` — fail loudly at generation time instead.
 */
function weeklyScheduleAnchor(releaseAt: Json | undefined): string {
  if (typeof releaseAt === 'string' && releaseAt.trim()) return releaseAt;
  throw new Error(
    '[weekly-generation] release_at is not set; schedule the weekly release before generating social copy.',
  );
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

/**
 * A failed machine attestation leaves the artifact in `in_review` forever —
 * the autopilot's silent failure mode. Record it on the job timeline so the
 * owner sees "why is this still waiting for me" instead of a green run.
 */
async function recordAttestFailure(
  tracker: GenerationAttemptTracker | null,
  subject: string,
  message: string,
) {
  console.error(`[weekly-generation] ${subject} machine attest failed`, message);
  if (!tracker) return;
  try {
    await tracker.event({
      type: 'attest_failed',
      level: 'warning',
      message: `Machine attest failed for ${subject}: ${message}`.slice(0, 2000),
    });
  } catch (error) {
    console.error(
      '[weekly-generation] attest failure event not recorded',
      error instanceof Error ? error.message : String(error),
    );
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
  /**
   * Published visual-refresh drafts can persist only prompt text through the
   * narrow RPC below. This is intentionally separate from the generic writer,
   * whose normal lifecycle side effects would reopen a published digest.
   */
  visualRefreshPromptOnly?: boolean;
  /** Immutable content hash from the queued refresh job; fences stale workers. */
  visualRefreshRevisionHash?: string | null;
}) {
  const visualRefreshPromptOnly = input.visualRefreshPromptOnly === true;
  if (
    visualRefreshPromptOnly &&
    (input.artifactType !== 'story_prompt_set' ||
      input.locale !== 'neutral' ||
      input.storagePath != null ||
      input.externalUrl != null ||
      input.provider != null ||
      input.providerId != null ||
      input.mimeType != null ||
      input.width != null ||
      input.height != null ||
      input.byteSize != null)
  ) {
    throw new Error('A visual refresh may persist only a neutral text prompt set.');
  }
  if (visualRefreshPromptOnly && !input.visualRefreshRevisionHash?.trim()) {
    throw new Error('A visual refresh prompt job is missing its revision hash.');
  }
  const result = visualRefreshPromptOnly
    ? await rpcClient().rpc('save_weekly_visual_refresh_prompt_artifact_with_direction_hash', {
        p_weekly_digest_id: input.weeklyDigestId,
        p_revision_id: input.revisionId,
        p_revision_item_id: input.revisionItemId ?? null,
        p_slot_key: input.slotKey,
        p_visual_refresh_revision_hash: input.visualRefreshRevisionHash,
        p_content: (input.content ?? {}) as Json,
        p_metadata: (input.metadata ?? {}) as Json,
      })
    : await rpcClient().rpc('save_weekly_digest_artifact', {
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
  if (result.error) {
    throw new Error(
      `[weekly-generation] save ${visualRefreshPromptOnly ? 'visual refresh prompt' : 'artifact'}: ${result.error.message}`,
    );
  }
  const { data } = result;
  if (typeof data !== 'string') throw new Error('Artifact RPC did not return an ID.');
  if (
    canMachineAttest({
      artifactType: input.artifactType,
      content: input.content,
      metadata: input.metadata,
    })
  ) {
    const attested = await rpcClient().rpc('machine_attest_weekly_digest_artifact', {
      p_artifact_id: data,
    });
    if (attested.error) {
      await recordAttestFailure(
        null,
        `${input.artifactType} ${input.slotKey}`,
        attested.error.message,
      );
    }
  }
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

async function loadResearchCorpus(
  weekStart: string | null | undefined,
  weekEnd: string | null | undefined,
): Promise<CorpusArticle[]> {
  if (!weekStart || !weekEnd) return [];
  const window = corroborationWindow(weekStart, weekEnd);
  const corpus: CorpusArticle[] = [];
  const db = getSupabaseAdmin();
  for (let page = 0; page < RESEARCH_CORPUS_MAX_PAGES; page += 1) {
    const from = page * RESEARCH_CORPUS_PAGE_SIZE;
    const to = from + RESEARCH_CORPUS_PAGE_SIZE - 1;
    const { data, error } = await db
      .from('articles')
      .select('url, title, cluster_id')
      .gte('published_at', window.from)
      .lt('published_at', window.toExclusive)
      .order('published_at', { ascending: false })
      .range(from, to);
    if (error) {
      console.warn(`[weekly-research] ingest corpus lookup failed: ${error.message}`);
      return corpus;
    }
    const rows = data ?? [];
    for (const row of rows) {
      if (!row.url || !row.title) continue;
      corpus.push({ url: row.url, title: row.title, clusterId: row.cluster_id });
    }
    if (rows.length < RESEARCH_CORPUS_PAGE_SIZE) break;
  }
  return corpus;
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
    corpus: await loadResearchCorpus(context.digest.week_start, context.digest.week_end),
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

/**
 * Every coded critic issue on the latest report, including non-blocking
 * warnings. Blockers-only used to starve regenerate of `story_length` /
 * `trust_attribution` instructions — the owner-facing Fix remaining issues
 * CTA is that regenerate.
 */
function issueGuidanceFromReport(
  report: { content: Json } | undefined,
): WeeklyMasterRetryGuidance[] {
  const issues = asRecord(report?.content).issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((entry) => {
    const row = asRecord(entry);
    const code = text(row.code);
    const message = text(row.message);
    if (!code || !message) return [];
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
 * coded `issues[]` row, so `issueGuidanceFromReport` never sees it -- a retry
 * after that kind of failure had no instruction to act on and just re-rolled
 * the same prompt. Mirrors `editorialQualityRetryGuidance` (content-studio.ts)
 * but parses the loosely-typed JSON `content` column the way
 * `issueGuidanceFromReport` does, instead of assuming a validated report.
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
 *
 * `beforeCreatedAt` (set only when this attempt is resuming from a saved
 * checkpoint) excludes reports written at or after that moment. Without it,
 * resuming a `succeeded`/`needs_owner_review` job -- the case this feature
 * exists for -- picks up the report that job *itself* just wrote about its
 * own draft, changes the plan hash relative to what that job started with,
 * and makes the checkpoint permanently unresumable the instant it finishes:
 * confirmed live 2026-08-22 on weekly_digest_id
 * 71af784b-3c89-47f8-bc38-e3eae4def2a7 (job 411aba45's own report, incl. a
 * below-floor `naturalness` dimension, invalidated resuming 411aba45 itself).
 * Bounding by the source job's `created_at` recovers whatever guidance was
 * actually active when that job computed its own plan hash, since only one
 * master job runs per revision at a time.
 */
export async function priorMasterRetryGuidance(
  revisionId: string,
  beforeCreatedAt?: string,
): Promise<WeeklyMasterRetryGuidance[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from('weekly_digest_artifacts')
    .select('content,created_at')
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'content_quality_report')
    .eq('slot_key', 'content-quality:master');
  if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1);
  if (error) throw new Error(`[weekly-generation] retry guidance lookup: ${error.message}`);

  const latest = data?.[0];
  if (!latest) return [];
  // Warnings (blocker !== true) used to be dropped, so a regenerate after
  // story_length / trust_attribution notes had no instruction to expand or
  // name the source. The owner-facing "Fix remaining issues" CTA is that
  // regenerate: the latest report is a complete picture, so non-blocking
  // issues belong in guidance too. Resume still bounds by beforeCreatedAt,
  // so including warnings does not invalidate a checkpoint that never saw them.
  return [...issueGuidanceFromReport(latest), ...dimensionGuidanceFromReport(latest)];
}

const PRIOR_CRITIC_HISTORY_LIMIT = 40;

function isEditorialProvider(value: string): value is EditorialModelRef['provider'] {
  return value === 'openrouter' || value === 'claude-cli' || value === 'gemini';
}

/**
 * Models that already scored this digest as `weekly.master_critic`. Used so a
 * later revision (Fix remaining issues / regenerate) starts on a different
 * critic than the ones that already stamped naturalness/trust on this copy.
 * Cost-ledger rows survive cancelled jobs; quality artifacts only exist after
 * persist, so the ledger is the complete history.
 */
export async function priorMasterCritics(weeklyDigestId: string): Promise<EditorialModelRef[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('generation_cost_events')
    .select('provider, model')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('kind', 'llm')
    .eq('step_key', 'critic')
    .order('created_at', { ascending: false })
    .limit(PRIOR_CRITIC_HISTORY_LIMIT);
  if (error) throw new Error(`[weekly-generation] prior critic lookup: ${error.message}`);

  const seen = new Set<string>();
  const critics: EditorialModelRef[] = [];
  for (const row of data ?? []) {
    const provider = typeof row.provider === 'string' ? row.provider.trim() : '';
    const model = typeof row.model === 'string' ? row.model.trim() : '';
    if (!provider || !model) continue;
    const key = `${provider.toLowerCase()}:${model.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    critics.push({
      provider: isEditorialProvider(provider) ? provider : 'openrouter',
      model,
    });
  }
  return critics;
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
  priorCritics: EditorialModelRef[];
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
    priorCritics: await priorMasterCritics(input.weeklyDigestId),
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
   * Master persist already recorded critic spend against the run; a second
   * save (historical draft carry-over, or a re-attach) must not double-count.
   */
  recordCost?: boolean;
  languageFixes?: Array<{ locale: string; span: string; replacement: string; field?: string }>;
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
      language_fixes: (input.languageFixes ?? []) as unknown as Json,
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

type QueuedGenerationJob = {
  type: string;
  key: string;
  input: Record<string, Json | undefined>;
  idempotencyKey?: string;
};

async function queueGenerationJob(
  weeklyDigestId: string,
  revisionId: string,
  queued: QueuedGenerationJob,
) {
  const { error } = await rpcClient().rpc('queue_weekly_digest_generation_job', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_job_type: queued.type,
    p_idempotency_key:
      queued.idempotencyKey ??
      `${WEEKLY_CONTENT_STUDIO_VERSION}:${weeklyDigestId}:${revisionId}:${queued.key}`,
    p_input: queued.input,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(`[weekly-generation] queue ${queued.key}: ${error.message}`);
  }
}

async function queueVideoManifestCompanion(weeklyDigestId: string, revisionId: string) {
  await queueGenerationJob(weeklyDigestId, revisionId, {
    type: 'video_manifest',
    key: 'video-manifest:en',
    idempotencyKey: contentStudioVideoManifestKey({
      digestId: weeklyDigestId,
      revisionId,
    }),
    input: { locale: 'en', slot_key: 'video-manifest:en' },
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

function revisionHasMasterArticles(
  artifacts: Array<{ artifact_type: string; locale: string | null; is_current?: boolean }>,
) {
  const current = (locale: 'en' | 'uk') =>
    artifacts.some(
      (artifact) =>
        artifact.artifact_type === 'article' &&
        artifact.locale === locale &&
        artifact.is_current !== false,
    );
  return current('en') && current('uk');
}

function workingCopyWriterMetadata(
  artifacts: Array<{
    artifact_type: string;
    locale: string | null;
    provider?: string | null;
    provider_id?: string | null;
  }>,
): EditorialGenerationMetadata {
  const article = artifacts.find((row) => row.artifact_type === 'article' && row.locale === 'en');
  const providerRaw = article?.provider?.trim() ?? '';
  const provider =
    providerRaw === 'claude-cli' || providerRaw === 'gemini' || providerRaw === 'openrouter'
      ? providerRaw
      : 'openrouter';
  return {
    provider,
    model: article?.provider_id?.trim() || 'working-copy',
    promptTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    costSource: 'estimated',
    promptVersion: WEEKLY_MASTER_SPEC_VERSION,
  };
}

function tryWorkingCopyMasterBundle(
  context: Awaited<ReturnType<typeof loadGenerationContext>>,
): WeeklyMasterBundle | null {
  if (!revisionHasMasterArticles(context.artifacts)) return null;
  try {
    return masterBundleFromArtifacts(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[weekly-generation] working copy could not be loaded as master segments: ${message}`,
    );
    return null;
  }
}

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
 * most wants to resume from -- so this fetch happens *before* retry guidance
 * is computed: `createdAt`/`input` let the caller exclude the source job's
 * own quality report from that guidance (see `priorMasterRetryGuidance` and
 * `masterResumeGuidanceBoundary`), which is what makes resuming a
 * `needs_owner_review` job -- the primary reason this button exists --
 * actually reusable instead of self-invalidating.
 */
async function fetchMasterResumeSource(
  job: ClaimedGenerationJob,
): Promise<{ id: string; createdAt: string; input: Json | null; output: Json | null } | null> {
  const sourceJobId = text(asRecord(job.input).resume_from_job_id);
  if (!sourceJobId) return null;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('weekly_digest_generation_jobs')
    .select('id,weekly_digest_id,revision_id,job_type,status,output,input,created_at')
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
  return { id: data.id, createdAt: data.created_at, input: data.input, output: data.output };
}

/**
 * A resume only ever carries its segments forward unchanged from whoever
 * originally *wrote* them -- a fresh (non-resume) master run -- even across
 * a chain of several resume attempts. So the retry-guidance boundary must
 * stay pinned to that original writer's `created_at`, not to the immediate
 * resume source's, or a second resume (resuming a job that was itself a
 * resume) recomputes guidance the segments' actual writer never saw and
 * self-invalidates exactly like the unbounded query did.
 *
 * Confirmed live 2026-08-22 on weekly_digest_id
 * 71af784b-3c89-47f8-bc38-e3eae4def2a7: resuming job 411aba45 (a fresh run)
 * from job 7bf3974d worked once this boundary shipped -- but resuming
 * 7bf3974d itself (which had `resume_from_job_id: 411aba45`) immediately
 * failed again with `resume_source_stale`, because bounding by 7bf3974d's
 * own `created_at` included a report 411aba45 never saw. Walking to the
 * root (411aba45) fixes it.
 */
export async function masterResumeGuidanceBoundary(source: {
  createdAt: string;
  input: Json | null;
}): Promise<string> {
  let parentId = text(asRecord(source.input).resume_from_job_id);
  if (!parentId) return source.createdAt;
  const db = getSupabaseAdmin();
  for (let hop = 0; hop < 10; hop++) {
    const { data, error } = await db
      .from('weekly_digest_generation_jobs')
      .select('input,created_at')
      .eq('id', parentId)
      .maybeSingle();
    if (error) throw new Error(`[weekly-generation] resume chain lookup: ${error.message}`);
    if (!data) return source.createdAt;
    const grandparentId = text(asRecord(data.input).resume_from_job_id);
    if (!grandparentId) return data.created_at;
    parentId = grandparentId;
  }
  throw new Error('[weekly-generation] master resume chain is too deep (possible cycle)');
}

/**
 * Checks the resume source's saved state against the plan the current
 * attempt actually computed (research packs + bounded retry guidance -- see
 * `fetchMasterResumeSource` and `priorMasterRetryGuidance`).
 */
export function resolveMasterResumeState(
  source: { id: string; output: Json | null },
  planHash: string,
): { state: MasterRunState; sourceJobId: string } {
  const state = masterRunStateFromOutput(source.output, planHash);
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
    sourceJobId: source.id,
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
  const resumeSource = await fetchMasterResumeSource(job);
  const guidanceBoundary = resumeSource
    ? await masterResumeGuidanceBoundary(resumeSource)
    : undefined;
  const retryGuidance = await priorMasterRetryGuidance(job.revision_id, guidanceBoundary);
  const priorCritics = await priorMasterCritics(job.weekly_digest_id);
  const planHash = computeMasterPlanHash(researchPacks, retryGuidance);

  const resume = resumeSource ? resolveMasterResumeState(resumeSource, planHash) : null;
  let state = (await loadOwnMasterRunState(job.id, planHash)) ?? resume?.state ?? null;
  let reuseSource: 'checkpoint' | 'working_copy' | null = state ? 'checkpoint' : null;
  if (!state) {
    const workingCopy = tryWorkingCopyMasterBundle(context);
    if (workingCopy) {
      state = seedMasterRunStateFromBundle({
        bundle: workingCopy,
        stories: sourceStories.map((story) => ({
          revisionItemId: story.revisionItemId,
          placement: story.placement,
          rank: story.rank,
        })),
        planHash,
        metadata: workingCopyWriterMetadata(context.artifacts),
      });
      reuseSource = 'working_copy';
    }
  }
  if (state) {
    await tracker.event({
      type: 'checkpoint_reused',
      step: 'prepare',
      progressCurrent: 4,
      progressTotal: 100,
      message:
        reuseSource === 'working_copy'
          ? `Reusing working copy (${Object.keys(state.segments).length} segments) — not rewriting the edition`
          : `Reusing ${Object.keys(state.segments).length} saved editorial segment(s)`,
      ...(resume
        ? { metadata: { resume_source_job_id: resume.sourceJobId } }
        : reuseSource === 'working_copy'
          ? { metadata: { source: 'working_copy' } }
          : {}),
    });
  }

  const outcome = await runWeeklyMaster({
    stories: sourceStories,
    researchPacks,
    retryGuidance,
    priorCritics,
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

  // Remaining quality items are a review task, not a reason to hide the
  // copy or hold Social/Visuals/PDF. Coded `blocker: true` issues still
  // hold the post-master queue; warnings and below-floor scores do not.
  // Ship stays blocked until coded blockers clear or the owner Approves.
  const persist = masterPersistDecision({
    converged,
    score: quality.score,
    unresolvedCount: unresolved.length,
    hasBlockingIssues: quality.issues.some((issue) => issue.blocker),
  });
  const created = await createMasterRevision({
    job,
    context,
    result: outcome,
    requestedMode,
    approvedResearch,
    reason: persist.reason,
  });
  const qualityArtifactId = await saveQualityReport({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: created.revisionId,
    report: quality,
    generation: outcome.generation,
    passed: persist.qualityPassed,
    jobId: job.id,
    recordCost: false,
    languageFixes: outcome.languageFixes,
  });
  if (persist.needsOwnerReview) {
    await tracker.event({
      type: 'quality_review_required',
      level: 'warning',
      step: 'persist',
      progressCurrent: 98,
      progressTotal: 100,
      message: `Saved as the working version: ${unresolved.length} unresolved check(s) — ${unresolvedSummary(unresolved)}`,
      metadata: {
        new_revision_id: created.revisionId,
        quality_artifact_id: qualityArtifactId,
        unresolved: unresolved as unknown as Json,
      },
    });
    await alertWeeklyDigestIssue({
      weeklyDigestId: job.weekly_digest_id,
      phase: 'generation',
      message: `Weekly master is the working version and needs review: ${quality.score}/100 with ${unresolved.length} unresolved check(s).`,
    });
  } else {
    await tracker.event({
      type: 'step_completed',
      step: 'persist',
      progressCurrent: 98,
      progressTotal: 100,
      message: 'Revision and quality report saved',
    });
  }
  if (persist.queuePostMasterJobs) {
    await queuePostMasterJobs(job.weekly_digest_id, created.revisionId, created.newItems);
  }
  return {
    artifactId: null,
    output: {
      [MASTER_STATE_KEY]: outcome.state as unknown as Json,
      new_revision_id: created.revisionId,
      article_artifact_ids: created.articleArtifactIds,
      quality_artifact_id: qualityArtifactId,
      quality_score: quality.score,
      quality_passed: persist.qualityPassed,
      needs_owner_review: persist.needsOwnerReview,
      ...(persist.needsOwnerReview ? { unresolved_issues: unresolved as unknown as Json } : {}),
    },
  };
}

/**
 * Mints an immutable revision from the generated bundle and makes it the
 * working copy (`create_service_weekly_digest_revision`). Article artifacts
 * are saved on that new active revision; video_script is a separate job.
 */
async function createMasterRevision(params: {
  job: ClaimedGenerationJob;
  context: Awaited<ReturnType<typeof loadGenerationContext>>;
  result: Extract<WeeklyMasterRunOutcome, { status: 'complete' }>;
  requestedMode: ReturnType<typeof contentStudioJobMode>;
  approvedResearch: ReturnType<typeof researchPacksFromContext>;
  reason: string;
}) {
  const { job, context, result, requestedMode, approvedResearch, reason } = params;
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
  const visualDirection = weeklyVisualDirectionFromArticles(result.bundle);
  const masterRevisionArgs = {
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
  };
  const { data: newRevisionId, error } = visualDirection
    ? await rpcClient().rpc(MASTER_VISUAL_DIRECTION_REVISION_RPC, {
        ...masterRevisionArgs,
        p_display_title_en: visualDirection.displayTitleEn,
        p_display_title_uk: visualDirection.displayTitleUk,
        p_visual_thesis_en: visualDirection.visualThesisEn,
        p_visual_thesis_uk: visualDirection.visualThesisUk,
      })
    : await rpcClient().rpc(MASTER_REVISION_RPC, masterRevisionArgs);
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

export { masterBundleFromArtifacts } from './master-bundle';

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
  const parsed = videoScriptFromArtifactContent(videoScript.content);
  if (!parsed) {
    throw new Error('Video script artifact does not contain the v3 script.');
  }
  return parsed;
}

async function socialAssetsForChannel(
  context: Awaited<ReturnType<typeof loadGenerationContext>>,
  channel: SocialChannel,
): Promise<SocialAsset[]> {
  if (channel === 'instagram') return [];
  const selected = selectWeeklyChannelImage(
    context.artifacts as SocialSelectableArtifact[],
    channel,
  );
  if (!selected) return [];
  return [selectedImageToAssetRef(selected)];
}

async function downloadArtifactBytes(artifact: {
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
}): Promise<Buffer | null> {
  if (artifact.storage_bucket && artifact.storage_path) {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(artifact.storage_bucket)
      .download(artifact.storage_path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (!artifact.external_url?.startsWith('http')) return null;
  try {
    const response = await fetch(artifact.external_url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function persistInstagramSlide(input: {
  job: ClaimedGenerationJob;
  inputHash: string;
  index: number;
  jpeg: Buffer;
  alt: string;
}): Promise<{ asset: SocialAsset; checkpoint: SocialAssetCheckpoint }> {
  const hash = createHash('sha256').update(input.jpeg).digest('hex');
  const path =
    `digests/${input.job.weekly_digest_id}/revisions/${input.job.revision_id}/social/instagram/` +
    `${hash}-${input.job.id}/slide-${input.index}.jpg`;
  await uploadPrivate(path, input.jpeg, 'image/jpeg');
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: input.job.weekly_digest_id,
    revisionId: input.job.revision_id,
    artifactType: 'social_asset',
    locale: 'en',
    slotKey: `instagram-carousel:${input.index}:en`,
    storagePath: path,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    byteSize: input.jpeg.length,
    content: { alt: input.alt },
    metadata: {
      channel: 'instagram',
      slide_index: input.index,
      slide_count: 7,
      source_job_id: input.job.id,
      social_copy_input_hash: input.inputHash,
      sha256: hash,
    },
  });
  return {
    asset: {
      artifactId,
      width: 1080,
      height: 1350,
      bytes: input.jpeg.length,
      mimeType: 'image/jpeg',
    },
    checkpoint: {
      artifactId,
      storagePath: path,
      slideIndex: input.index,
      width: 1080,
      height: 1350,
      bytes: input.jpeg.length,
      mimeType: 'image/jpeg',
    },
  };
}

function isWeeklyInstagramCarouselSpec(
  spec: NonNullable<WeeklySocialAdaptation['instagramCarousel']>,
): spec is InstagramCarouselSpec {
  return !('kind' in spec && spec.kind === 'daily_visual');
}

async function renderInstagramCarousel(
  job: ClaimedGenerationJob,
  draft: WeeklySocialAdaptation,
  inputHash: string,
  sourceJobIds: string[],
  savedCheckpoints: SocialAssetCheckpoint[],
  onCheckpoint: (assets: SocialAssetCheckpoint[]) => Promise<void>,
  artifacts: SocialSelectableArtifact[],
): Promise<{ assets: SocialAsset[]; checkpoints: SocialAssetCheckpoint[] }> {
  const spec = draft.instagramCarousel;
  if (!spec) return { assets: draft.assets, checkpoints: savedCheckpoints };
  if (!isWeeklyInstagramCarouselSpec(spec)) {
    throw new Error('A daily visual carousel cannot enter the weekly social rendering workflow.');
  }

  const db = getSupabaseAdmin();
  const { data: artifactRows, error: artifactsError } = await db
    .from('weekly_digest_artifacts')
    .select(
      'id,slot_key,external_url,storage_bucket,storage_path,mime_type,width,height,byte_size,metadata',
    )
    .eq('revision_id', job.revision_id)
    .eq('artifact_type', 'social_asset')
    .eq('generation_status', 'ready')
    .eq('is_current', true);
  if (artifactsError) {
    throw new Error(`[weekly-generation] Instagram checkpoint assets: ${artifactsError.message}`);
  }
  const savedByArtifactId = new Map(savedCheckpoints.map((asset) => [asset.artifactId, asset]));
  const recovered = new Map<number, { asset: SocialAsset; checkpoint: SocialAssetCheckpoint }>();
  for (const artifact of artifactRows ?? []) {
    const slideIndex = Number(artifact.slot_key.match(/^instagram-carousel:(\d+):en$/)?.[1]);
    if (!Number.isInteger(slideIndex) || slideIndex < 1 || slideIndex > 7) continue;
    const metadata = asRecord(artifact.metadata);
    const saved = savedByArtifactId.get(artifact.id);
    const belongsToCheckpoint = Boolean(saved && saved.slideIndex === slideIndex);
    const belongsToInput = text(metadata.social_copy_input_hash) === inputHash;
    const belongsToSource = sourceJobIds.includes(text(metadata.source_job_id) ?? '');
    if (!belongsToCheckpoint && !belongsToInput && !belongsToSource) continue;
    if (
      artifact.storage_bucket !== PRIVATE_BUCKET ||
      !artifact.storage_path ||
      !artifact.width ||
      !artifact.height ||
      !artifact.byte_size ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(artifact.mime_type ?? '')
    ) {
      continue;
    }
    const mimeType = artifact.mime_type as SocialAssetCheckpoint['mimeType'];
    recovered.set(slideIndex, {
      asset: {
        artifactId: artifact.id,
        width: artifact.width,
        height: artifact.height,
        bytes: artifact.byte_size,
        mimeType,
      },
      checkpoint: {
        artifactId: artifact.id,
        storagePath: artifact.storage_path,
        slideIndex,
        width: artifact.width,
        height: artifact.height,
        bytes: artifact.byte_size,
        mimeType,
      },
    });
  }
  if (recovered.size !== savedCheckpoints.length) {
    await onCheckpoint(
      [...recovered.values()]
        .map(({ checkpoint }) => checkpoint)
        .sort((left, right) => left.slideIndex - right.slideIndex),
    );
  }
  if (recovered.size === 7) {
    return {
      assets: [...recovered.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value.asset),
      checkpoints: [...recovered.values()]
        .map(({ checkpoint }) => checkpoint)
        .sort((left, right) => left.slideIndex - right.slideIndex),
    };
  }

  const sources = selectInstagramCarouselSources(artifacts);
  if (!sources.ok) {
    draft.qualityReport = {
      ...draft.qualityReport!,
      blocking: [...(draft.qualityReport?.blocking ?? []), sources.blocker],
    };
    return { assets: draft.assets, checkpoints: savedCheckpoints };
  }
  const coverRow = await db
    .from('weekly_digest_artifacts')
    .select('storage_bucket,storage_path,external_url')
    .eq('id', sources.cover.artifactId)
    .maybeSingle();
  const coverBytes = coverRow.data ? await downloadArtifactBytes(coverRow.data) : null;
  if (!coverBytes) return { assets: draft.assets, checkpoints: savedCheckpoints };
  const storyImages: Array<{ revisionItemId: string; image: Buffer }> = [];
  for (const story of sources.stories) {
    const storyRow = await db
      .from('weekly_digest_artifacts')
      .select('storage_bucket,storage_path,external_url')
      .eq('id', story.artifactId)
      .maybeSingle();
    const image = storyRow.data ? await downloadArtifactBytes(storyRow.data) : null;
    if (!image || !story.revisionItemId) {
      return { assets: draft.assets, checkpoints: savedCheckpoints };
    }
    storyImages.push({ revisionItemId: story.revisionItemId, image });
  }

  const rendered = await renderWeeklyInstagramCarousel({
    spec,
    cover: coverBytes,
    stories: storyImages,
  });
  if (!rendered.ok) {
    draft.qualityReport = {
      ...draft.qualityReport!,
      blocking: [...(draft.qualityReport?.blocking ?? []), ...rendered.blockers],
    };
    return { assets: draft.assets, checkpoints: savedCheckpoints };
  }

  for (const slide of rendered.slides) {
    if (recovered.has(slide.index)) continue;
    const persisted = await persistInstagramSlide({
      job,
      inputHash,
      index: slide.index,
      jpeg: slide.jpeg,
      alt: `Weekly Digest carousel slide ${slide.index}: ${spec.slides[slide.index - 1]?.headline ?? 'carousel'}`,
    });
    recovered.set(slide.index, persisted);
    await onCheckpoint(
      [...recovered.values()]
        .map(({ checkpoint: saved }) => saved)
        .sort((left, right) => left.slideIndex - right.slideIndex),
    );
  }
  return {
    assets: [...recovered.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, value]) => value.asset),
    checkpoints: [...recovered.values()]
      .map(({ checkpoint }) => checkpoint)
      .sort((left, right) => left.slideIndex - right.slideIndex),
  };
}

// This is deliberately still v1. It fingerprints the approved source and
// channel locale contract, not the storage schema. Keeping it stable lets the
// v2 state reader recover channel adaptations saved by already failed v1 jobs.
const SOCIAL_COPY_INPUT_VERSION = 1;

/**
 * Six channels each pay for an independent writer+critic pass. The approved
 * source hash fences those expensive results to one bilingual revision and
 * locale contract, so an in-place or linked retry can resume without splicing
 * stale copy into a changed edition.
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
        version: SOCIAL_COPY_INPUT_VERSION,
      }),
    )
    .digest('hex');
}

async function loadSocialCopyCheckpoint(
  job: ClaimedGenerationJob,
  expectedHash: string,
): Promise<{
  checkpoint: SocialCopyCheckpoint;
  sourceJobId: string;
  sourceJobIds: string[];
} | null> {
  const db = getSupabaseAdmin();
  let candidateJobId: string | null = job.id;
  let best: { checkpoint: SocialCopyCheckpoint; sourceJobId: string } | null = null;
  const sourceJobIds: string[] = [];
  const visited = new Set<string>();

  while (candidateJobId && visited.size < 25 && !visited.has(candidateJobId)) {
    visited.add(candidateJobId);
    const checkpointLookup = await db
      .from('weekly_digest_generation_jobs')
      .select('id,weekly_digest_id,revision_id,job_type,retry_of_job_id,output')
      .eq('id', candidateJobId)
      .maybeSingle();
    const data = checkpointLookup.data as {
      id: string;
      weekly_digest_id: string;
      revision_id: string;
      job_type: string;
      retry_of_job_id: string | null;
      output: Json;
    } | null;
    const { error } = checkpointLookup;
    if (error) {
      throw new Error(`[weekly-generation] social copy checkpoint lookup: ${error.message}`);
    }
    if (
      !data ||
      data.weekly_digest_id !== job.weekly_digest_id ||
      data.revision_id !== job.revision_id ||
      data.job_type !== 'social_copy'
    ) {
      break;
    }
    sourceJobIds.push(data.id);
    const checkpoint = socialCopyCheckpointFromOutput(data.output, expectedHash);
    if (
      checkpoint &&
      (!best || socialCopyCheckpointScore(checkpoint) > socialCopyCheckpointScore(best.checkpoint))
    ) {
      best = { checkpoint, sourceJobId: data.id };
    }
    candidateJobId = data.retry_of_job_id;
  }
  return best ? { ...best, sourceJobIds } : null;
}

async function saveSocialCopyCheckpoint(
  tracker: GenerationAttemptTracker,
  checkpoint: SocialCopyCheckpoint,
  step: string,
  progressCurrent: number,
) {
  await tracker.checkpoint(socialCopyCheckpointOutput(checkpoint), step, progressCurrent);
}

async function reusableLinkedinDocumentArtifact(input: {
  job: ClaimedGenerationJob;
  inputHash: string;
  sourceJobIds: string[];
  checkpointArtifactId: string | null;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('weekly_digest_artifacts')
    .select('id,storage_bucket,storage_path,metadata')
    .eq('revision_id', input.job.revision_id)
    .eq('artifact_type', 'social_asset')
    .eq('slot_key', 'linkedin-document:en')
    .eq('generation_status', 'ready')
    .eq('is_current', true)
    .order('version', { ascending: false })
    .limit(10);
  if (error) {
    throw new Error(`[weekly-generation] LinkedIn checkpoint artifact: ${error.message}`);
  }
  const artifact = (data ?? []).find((candidate) => {
    const metadata = asRecord(candidate.metadata);
    return (
      candidate.id === input.checkpointArtifactId ||
      text(metadata.social_copy_input_hash) === input.inputHash ||
      input.sourceJobIds.includes(text(metadata.source_job_id) ?? '')
    );
  });
  return artifact?.storage_bucket === PRIVATE_BUCKET && artifact.storage_path ? artifact.id : null;
}

export async function resolveSocialPostForRepair<T>(input: {
  checkpointPostId?: string;
  findCheckpointPost: (id: string) => Promise<T | null>;
  findExistingPost: () => Promise<T | null>;
}): Promise<T | null> {
  if (input.checkpointPostId) {
    const checkpointPost = await input.findCheckpointPost(input.checkpointPostId);
    if (checkpointPost) return checkpointPost;
  }
  return input.findExistingPost();
}

/**
 * A social package or post in one of these statuses may still be rewritten.
 * Anything else (approved, scheduled, published) is owner-blessed output that
 * generation must never overwrite.
 */
const EDITABLE_SOCIAL_STATUSES = new Set(['draft', 'in_review', 'changes_requested', 'failed']);

/**
 * The package this job would write into, or null when none exists yet. Shared
 * by the pre-flight guard and the persist phase so the two can never disagree
 * about which package a job targets.
 */
async function findSocialPackageForJob(input: {
  weeklyDigestId: string;
  revisionId: string;
  generationVersion: string;
  weekEnd: string;
  sourceBriefItemId: string | null;
  checkpointPackageId: string | null;
}): Promise<{ id: string; status: string } | null> {
  const db = getSupabaseAdmin();
  if (input.checkpointPackageId) {
    const { data, error } = await db
      .from('social_packages')
      .select('id,status')
      .eq('id', input.checkpointPackageId)
      .eq('weekly_digest_id', input.weeklyDigestId)
      .eq('weekly_digest_revision_id', input.revisionId)
      .eq('generation_version', input.generationVersion)
      .neq('status', 'cancelled')
      .maybeSingle();
    if (error) throw new Error(`[weekly-generation] social package checkpoint: ${error.message}`);
    if (data) return data;
  }
  let query = db
    .from('social_packages')
    .select('id,status')
    .eq('kind', 'weekly_digest')
    .eq('source_date', input.weekEnd)
    .eq('generation_version', input.generationVersion)
    .neq('status', 'cancelled');
  query = input.sourceBriefItemId
    ? query.eq('source_brief_item_id', input.sourceBriefItemId)
    : query.is('source_brief_item_id', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`[weekly-generation] social package lookup: ${error.message}`);
  return data;
}

/** Package/post statuses that block a rewrite, formatted for one error line. */
export function blockingSocialStatuses(
  socialPackage: { id: string; status: string } | null,
  posts: ReadonlyArray<{ id: string; channel: string; status: string }>,
): string | null {
  if (!socialPackage) return null;
  if (!EDITABLE_SOCIAL_STATUSES.has(socialPackage.status)) {
    return `${socialPackage.status} social package ${socialPackage.id}`;
  }
  const blocked = posts.filter((post) => !EDITABLE_SOCIAL_STATUSES.has(post.status));
  if (blocked.length === 0) return null;
  // Name every blocker at once -- reporting them one job at a time would make
  // the owner rerun this whole diagnosis per channel.
  return blocked.map((post) => `${post.status} ${post.channel} post ${post.id}`).join(', ');
}

/**
 * Refuse a social_copy job whose output could never be persisted -- BEFORE the
 * first model call.
 *
 * The same guards already existed, but only in the persist phase, i.e. after
 * all six channels had been written and paid for. Job 52f06dfc (2026-08-28)
 * burned 49 OpenRouter calls / $1.82 across three attempts and died every time
 * on `refusing to replace approved telegram post` -- a condition that was
 * already true before the job started, because two earlier runs had approved
 * that post. Reading it up front costs two queries.
 */
async function assertSocialCopyCanPersist(input: {
  weeklyDigestId: string;
  revisionId: string;
  weekEnd: string;
  sourceBriefItemId: string | null;
}): Promise<void> {
  const socialPackage = await findSocialPackageForJob({
    ...input,
    generationVersion: `social-v3:${input.revisionId}`,
    checkpointPackageId: null,
  });
  if (!socialPackage) return;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('social_posts')
    .select('id,channel,status')
    .eq('package_id', socialPackage.id);
  if (error) throw new Error(`[weekly-generation] social post preflight: ${error.message}`);
  const blocker = blockingSocialStatuses(socialPackage, data ?? []);
  if (blocker) throw new Error(`[weekly-generation] refusing to replace ${blocker}`);
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
  await assertSocialCopyCanPersist({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    weekEnd: context.digest.week_end,
    sourceBriefItemId: context.items[0]?.brief_item_id ?? null,
  });
  const bundle = masterBundleFromArtifacts(context);
  const locales = await localeMap();
  const sourceFactsByLocale: Record<SocialLocale, string[]> = {
    en: buildWeeklySocialFactSnapshot({ locale: 'en', bundle, items: context.items }),
    uk: buildWeeklySocialFactSnapshot({ locale: 'uk', bundle, items: context.items }),
  };
  const sourceFacts = [...new Set([...sourceFactsByLocale.en, ...sourceFactsByLocale.uk])];
  const checkpointHash = computeSocialCopyCheckpointHash({ bundle, sourceFacts, locales });
  const restored = await loadSocialCopyCheckpoint(job, checkpointHash);
  const checkpointSourceJobIds = [...new Set([job.id, ...(restored?.sourceJobIds ?? [])])];
  const checkpoint: SocialCopyCheckpoint = restored?.checkpoint ?? {
    schemaVersion: SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
    inputHash: checkpointHash,
    tokens: Object.fromEntries(SOCIAL_CHANNELS.map((channel) => [channel, randomUUID()])) as Record<
      SocialChannel,
      string
    >,
    adaptations: {},
    instagramAssets: [],
    linkedinDocumentArtifactId: null,
    socialPackageId: null,
    postIds: {},
    reviewedPostIds: [],
  };
  const restoredChannelCount = Object.keys(checkpoint.adaptations).length;
  const initialProgress = Math.round(5 + (restoredChannelCount / SOCIAL_CHANNELS.length) * 60);
  if (restored) {
    await tracker.event({
      type: 'checkpoint_restored',
      step: 'prepare',
      progressCurrent: initialProgress,
      progressTotal: 100,
      message:
        restored.sourceJobId === job.id
          ? `Resuming ${restoredChannelCount}/${SOCIAL_CHANNELS.length} saved social channels`
          : `Resuming durable social state from linked job ${restored.sourceJobId}`,
      metadata: {
        source_job_id: restored.sourceJobId,
        linked_retry: restored.sourceJobId !== job.id,
        completed_channels: restoredChannelCount,
        completed_posts: Object.keys(checkpoint.postIds).length,
      },
    });
  }
  // Persist generated tokens and any inherited parent state onto this job
  // before the first provider call. A second linked retry can then resume
  // directly from this child even if it fails before completing a new step.
  await saveSocialCopyCheckpoint(tracker, checkpoint, 'prepare', initialProgress);
  const adaptations: WeeklySocialAdaptation[] = [];
  for (const channel of SOCIAL_CHANNELS) {
    const cached = checkpoint.adaptations[channel];
    if (cached) {
      const duplicateIssues = findBlindCrossPosts([...adaptations, cached]).get(channel) ?? [];
      if (duplicateIssues.length === 0) {
        adaptations.push(cached);
        continue;
      }
      // Preserve clean earlier channels and regenerate only the later copy
      // that violates channel differentiation.
      delete checkpoint.adaptations[channel];
      if (channel === 'instagram') checkpoint.instagramAssets = [];
    }
    const locale = locales.get(channel)!;
    const completedChannels = adaptations.length;
    const channelProgress = Math.round(5 + ((completedChannels + 1) / SOCIAL_CHANNELS.length) * 60);
    await tracker.event({
      type: 'provider_call_started',
      step: 'channels',
      provider: 'router',
      model: 'auto',
      progressCurrent: Math.round(5 + (completedChannels / SOCIAL_CHANNELS.length) * 60),
      progressTotal: 100,
      message: `Starting ${channel} social writer and critic`,
      metadata: { channel, role: 'weekly.social_writer', selection: 'provider_chain' },
    });
    const providerPipelineStartedAt = Date.now();
    const trackedUrl = weeklyTrackedUrl(locale, context.digest.slug, checkpoint.tokens[channel], {
      source: channel,
    });
    const instagramSources = selectInstagramCarouselSources(
      context.artifacts as SocialSelectableArtifact[],
    );
    if (channel === 'instagram' && !instagramSources.ok) {
      await tracker.event({
        type: 'step_started',
        step: 'channels',
        level: 'warning',
        progressCurrent: channelProgress,
        progressTotal: 100,
        message: `Skipping Instagram: ${instagramSources.blocker.message}`,
        metadata: { channel, skipped: true, reason: instagramSources.blocker.code },
      });
      continue;
    }
    const assets = await socialAssetsForChannel(context, channel);
    const adaptation = await adaptWeeklySocialChannel({
      channel,
      locale,
      bundle,
      trackedUrl,
      scheduledFor: nextWeeklyScheduledForChannel(
        channel,
        weeklyScheduleAnchor(context.digest.release_at),
        new Date(),
      ),
      sourceFacts: sourceFactsByLocale[locale],
      assets,
      altText:
        locale === 'uk'
          ? `Обкладинка тижневого дайджесту: ${bundle.uk.title}`
          : `Weekly Digest cover: ${bundle.en.title}`,
      db: getSupabaseAdmin(),
      avoidCopies: adaptations.filter((draft) => draft.locale === locale),
      currentRevisionItemIds: context.items.map((item) => item.id),
      ...(channel === 'instagram' && instagramSources.ok
        ? {
            instagramStoryIds: [
              instagramSources.stories[0].revisionItemId ?? '',
              instagramSources.stories[1].revisionItemId ?? '',
              instagramSources.stories[2].revisionItemId ?? '',
            ] as [string, string, string],
          }
        : {}),
    });
    adaptations.push(adaptation);
    checkpoint.adaptations[channel] = adaptation;
    // The LLM result is the expensive, non-reconstructable value. Save it
    // before observability writes so a transient event/ledger problem cannot
    // force another writer+critic call.
    await saveSocialCopyCheckpoint(tracker, checkpoint, 'channels', channelProgress);
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
  }
  for (const adaptation of adaptations) {
    if (!adaptation.qualityReport) continue;
    const duplicates = findBlindCrossPosts(adaptations).get(adaptation.channel) ?? [];
    adaptation.qualityReport = releaseSocialCopyForReview(adaptation.qualityReport, duplicates);
  }
  // Signed URLs are intentionally not the durable part of a channel
  // checkpoint. Refresh them from current artifacts before persistence so a
  // retry days later does not publish expired URLs from the saved LLM draft.
  for (const adaptation of adaptations) {
    if (adaptation.channel === 'instagram') continue;
    adaptation.assets = await socialAssetsForChannel(context, adaptation.channel);
  }
  const instagram = adaptations.find((draft) => draft.channel === 'instagram');
  if (instagram) {
    await tracker.event({
      type: 'step_started',
      step: 'instagram',
      progressCurrent: 65,
      progressTotal: 100,
      message: 'Rendering or restoring Instagram carousel slides',
    });
    const rendered = await renderInstagramCarousel(
      job,
      instagram,
      checkpointHash,
      checkpointSourceJobIds,
      checkpoint.instagramAssets,
      async (assets) => {
        checkpoint.instagramAssets = assets;
        const progress = Math.round(65 + (assets.length / 7) * 12);
        await saveSocialCopyCheckpoint(tracker, checkpoint, 'instagram', progress);
      },
      context.artifacts as SocialSelectableArtifact[],
    );
    instagram.assets = rendered.assets;
    checkpoint.instagramAssets = rendered.checkpoints;
    await saveSocialCopyCheckpoint(tracker, checkpoint, 'instagram', 77);
    if (instagram.assets.length !== 7) {
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
  await tracker.event({
    type: 'step_started',
    step: 'linkedin',
    progressCurrent: 77,
    progressTotal: 100,
    message: 'Rendering or restoring LinkedIn native document',
  });
  let linkedinDocumentArtifactId = await reusableLinkedinDocumentArtifact({
    job,
    inputHash: checkpointHash,
    sourceJobIds: checkpointSourceJobIds,
    checkpointArtifactId: checkpoint.linkedinDocumentArtifactId,
  });
  if (!linkedinDocumentArtifactId) {
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
    linkedinDocumentArtifactId = await saveGeneratedArtifact({
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
        source_job_id: job.id,
        social_copy_input_hash: checkpointHash,
      },
    });
  }
  checkpoint.linkedinDocumentArtifactId = linkedinDocumentArtifactId;
  await saveSocialCopyCheckpoint(tracker, checkpoint, 'linkedin', 85);
  const duplicates = findBlindCrossPosts(adaptations);
  const db = getSupabaseAdmin();
  const generationVersion = `social-v3:${job.revision_id}`;
  const sourceBriefItemId = context.items[0]?.brief_item_id ?? null;
  let socialPackage = await findSocialPackageForJob({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    generationVersion,
    weekEnd: context.digest.week_end,
    sourceBriefItemId,
    checkpointPackageId: checkpoint.socialPackageId,
  });
  if (!socialPackage) {
    const { data, error } = await db
      .from('social_packages')
      .insert({
        kind: 'weekly_digest',
        risk_level: 'yellow',
        status: 'draft',
        source_date: context.digest.week_end,
        source_brief_item_id: sourceBriefItemId,
        source_item_ids: context.items.flatMap((item) =>
          item.brief_item_id ? [item.brief_item_id] : [],
        ),
        weekly_digest_id: job.weekly_digest_id,
        weekly_digest_revision_id: job.revision_id,
        title: bundle.en.title,
        generation_version: generationVersion,
      })
      .select('id,status')
      .single();
    if (error || !data) {
      throw new Error(`[weekly-generation] social package: ${error?.message ?? 'missing'}`);
    }
    socialPackage = data;
  }
  if (!EDITABLE_SOCIAL_STATUSES.has(socialPackage.status)) {
    throw new Error(
      `[weekly-generation] refusing to replace ${socialPackage.status} social package ${socialPackage.id}`,
    );
  }
  if (socialPackage.status !== 'draft') {
    const { error } = await db
      .from('social_packages')
      .update({ status: 'draft' })
      .eq('id', socialPackage.id)
      .eq('status', socialPackage.status);
    if (error) throw new Error(`[weekly-generation] social package reopen: ${error.message}`);
    socialPackage.status = 'draft';
  }
  checkpoint.socialPackageId = socialPackage.id;
  await saveSocialCopyCheckpoint(tracker, checkpoint, 'package', 90);
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
      instagramCarousel: draft.instagramCarousel,
    });
    const destinationUrl = new URL(`/${draft.locale}/weekly/${context.digest.slug}`, SITE_URL);
    const publicUrl = weeklyTrackedUrl(
      draft.locale,
      context.digest.slug,
      checkpoint.tokens[draft.channel],
      { source: draft.channel, content: draft.hookAngle },
    );
    return {
      package_id: socialPackage.id,
      brief_item_id: context.items[0]?.brief_item_id ?? null,
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      status: 'draft',
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
      tracking_token: checkpoint.tokens[draft.channel],
      url: destinationUrl.toString(),
      utm_url: publicUrl,
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
        ...(draft.channel === 'instagram' && draft.instagramCarousel
          ? { instagram_carousel: draft.instagramCarousel }
          : {}),
      } as Json,
    };
  });
  type PersistedPost = {
    id: string;
    channel: string;
    status: string;
    locale: string | null;
    format: string | null;
    post_text: string | null;
    content_parts: Json;
    first_comment: string | null;
    quality_report: Json;
    content_hash: string | null;
    content_version: number;
  };
  const postSelection =
    'id,channel,status,locale,format,post_text,content_parts,first_comment,quality_report,content_hash,content_version';
  const editablePostStatuses = EDITABLE_SOCIAL_STATUSES;
  const rowAtVersion = (
    row: (typeof rows)[number],
    draft: WeeklySocialAdaptation,
    contentVersion: number,
  ) => {
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
      ...row,
      content_version: contentVersion,
      content_hash: contentHash,
      idempotency_key: `${socialPackage.id}:${draft.channel}:${contentHash.slice(0, 16)}`,
    };
  };
  const posts: PersistedPost[] = [];
  for (const [index, initialRow] of rows.entries()) {
    const draft = adaptations[index]!;
    let row = initialRow;
    const checkpointPostId = checkpoint.postIds[row.channel];
    let post = await resolveSocialPostForRepair<PersistedPost>({
      checkpointPostId,
      findCheckpointPost: async (id) => {
        const { data, error } = await db
          .from('social_posts')
          .select(postSelection)
          .eq('id', id)
          .eq('package_id', socialPackage.id)
          .eq('channel', row.channel)
          .maybeSingle();
        if (error) {
          throw new Error(`[weekly-generation] ${row.channel} post checkpoint: ${error.message}`);
        }
        return data as PersistedPost | null;
      },
      findExistingPost: async () => {
        const { data, error } = await db
          .from('social_posts')
          .select(postSelection)
          .eq('package_id', socialPackage.id)
          .eq('channel', row.channel)
          .maybeSingle();
        if (error) {
          throw new Error(`[weekly-generation] ${row.channel} post lookup: ${error.message}`);
        }
        return data as PersistedPost | null;
      },
    });
    // Both checkpoint-addressed and legacy package/channel posts must pass
    // through the same repair/update branch. Previously the fallback lookup
    // happened after this block, so every legacy blocker-filled post escaped
    // the clean replacement and failed the final approval guard.
    if (post) {
      if (!editablePostStatuses.has(post.status)) {
        throw new Error(
          `[weekly-generation] refusing to replace ${post.status} ${row.channel} post ${post.id}`,
        );
      }
      const currentVersion = Math.max(1, post.content_version ?? 1);
      const sameVersionRow = rowAtVersion(row, draft, currentVersion);
      const reportChanged =
        JSON.stringify(post.quality_report) !== JSON.stringify(sameVersionRow.quality_report);
      const contentChanged = post.content_hash !== sameVersionRow.content_hash;
      if (contentChanged || reportChanged) {
        row = rowAtVersion(row, draft, currentVersion + 1);
        const { data, error } = await db
          .from('social_posts')
          .update(row)
          .eq('id', post.id)
          .eq('package_id', socialPackage.id)
          .select(postSelection)
          .single();
        if (error || !data) {
          throw new Error(
            `[weekly-generation] ${row.channel} social repair: ${error?.message ?? 'missing'}`,
          );
        }
        post = data as PersistedPost;
        checkpoint.reviewedPostIds = checkpoint.reviewedPostIds.filter((id) => id !== post!.id);
      } else if (post.status !== 'draft' && post.status !== 'in_review') {
        const { data, error } = await db
          .from('social_posts')
          .update({ status: 'draft' })
          .eq('id', post.id)
          .select(postSelection)
          .single();
        if (error || !data) {
          throw new Error(
            `[weekly-generation] ${row.channel} social reopen: ${error?.message ?? 'missing'}`,
          );
        }
        post = data as PersistedPost;
      }
    }
    if (!post) {
      const { data, error } = await db
        .from('social_posts')
        .insert(row)
        .select(postSelection)
        .single();
      if (error || !data) {
        throw new Error(
          `[weekly-generation] ${row.channel} social variant: ${error?.message ?? 'missing'}`,
        );
      }
      post = data as PersistedPost;
    }

    checkpoint.postIds[row.channel] = post.id;
    let generatedReviewQuery = db
      .from('social_post_reviews')
      .select('id')
      .eq('social_post_id', post.id)
      .eq('action', 'generated')
      .eq('content_version', post.content_version);
    generatedReviewQuery = post.content_hash
      ? generatedReviewQuery.eq('content_hash', post.content_hash)
      : generatedReviewQuery.is('content_hash', null);
    const { data: generatedReview, error: generatedReviewError } = await generatedReviewQuery
      .limit(1)
      .maybeSingle();
    if (generatedReviewError) {
      throw new Error(
        `[weekly-generation] ${row.channel} review lookup: ${generatedReviewError.message}`,
      );
    }
    const generatedReviewExists = Boolean(generatedReview);
    if (!generatedReviewExists) {
      const { error } = await db.from('social_post_reviews').insert({
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
      });
      if (error) throw new Error(`[weekly-generation] ${row.channel} review: ${error.message}`);
    }
    if (!checkpoint.reviewedPostIds.includes(post.id)) checkpoint.reviewedPostIds.push(post.id);
    posts.push(post);
    await saveSocialCopyCheckpoint(
      tracker,
      checkpoint,
      'posts',
      Math.round(90 + ((index + 1) / rows.length) * 9),
    );
  }
  const unreadyPosts = posts.filter((post) => {
    const report = asRecord(post.quality_report);
    return !Array.isArray(report.blocking) || report.blocking.length > 0;
  });
  if (unreadyPosts.length > 0) {
    throw new Error(
      `[weekly-generation] refusing to expose blocker-filled social review: ${unreadyPosts
        .map((post) => post.channel)
        .join(', ')}`,
    );
  }
  const [{ error: postsReadyError }, { error: packageReadyError }] = await Promise.all([
    db
      .from('social_posts')
      .update({ status: 'in_review' })
      .eq('package_id', socialPackage.id)
      .eq('status', 'draft'),
    db
      .from('social_packages')
      .update({ status: 'in_review' })
      .eq('id', socialPackage.id)
      .eq('status', 'draft'),
  ]);
  if (postsReadyError) {
    throw new Error(`[weekly-generation] social variants ready: ${postsReadyError.message}`);
  }
  if (packageReadyError) {
    throw new Error(`[weekly-generation] social package ready: ${packageReadyError.message}`);
  }
  for (const post of posts) {
    const report = asRecord(post.quality_report);
    const critic = asRecord(report.critic);
    const score = typeof critic.score === 'number' ? critic.score : 0;
    if (score < 85) continue;
    if (!socialCopyHasUseBlock(typeof post.post_text === 'string' ? post.post_text : '')) continue;
    const attested = await rpcClient().rpc('machine_attest_weekly_social_post', {
      p_social_post_id: post.id,
    });
    if (attested.error) {
      await recordAttestFailure(tracker, `${post.channel} post`, attested.error.message);
    }
  }
  await saveSocialCopyCheckpoint(tracker, checkpoint, 'posts', 100);
  await tracker.event({
    type: 'step_completed',
    step: 'posts',
    progressCurrent: 100,
    progressTotal: 100,
    message: 'All social posts and immutable generated reviews saved',
  });
  return {
    artifactId: null,
    output: {
      social_package_id: socialPackage.id,
      post_ids: posts.map((post) => post.id),
      blocked_channels: [],
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
  // Approved article artifacts are often the normalized revision shape
  // (editor_note / key_takeaways, no stories). Casting content as
  // WeeklyArticleMaster then calling stories.map is the 2026-08-18
  // production TypeError. Rehydrate and validate before the provider timer.
  const article = masterBundleFromArtifacts(context).en;
  requireVideoScriptArticle(article);
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
  // Post-master queue can miss this companion (partial batch, or a later
  // linked retry of video_script on a revision that never got the row).
  // Stable key: waiting/queued stays put; failed resets; succeeded is reused.
  await queueVideoManifestCompanion(job.weekly_digest_id, job.revision_id);
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

/** `story_image` metadata predates M1; still written by the `render`-mode escape hatch. */
function siblingHintFromStoryImageMetadata(metadata: Json | null): SiblingMetaphorHint[] {
  const meta = asRecord(metadata);
  const scene = text(meta.scene) ?? text(meta.metaphor_title) ?? undefined;
  if (!scene) return [];
  const compositionRaw = text(meta.composition);
  const composition: 'single' | 'dual_contrast' | undefined =
    compositionRaw === 'dual_contrast' || compositionRaw === 'single' ? compositionRaw : undefined;
  return [
    {
      motifClass: text(meta.motif_class) ?? undefined,
      subjectKind: text(meta.subject_kind) ?? undefined,
      composition,
      sceneSummary: scene.slice(0, 180),
    },
  ];
}

/**
 * In `prompt_only` mode (the default since M1) the worker never writes
 * `story_image` metadata -- the concept/motif data lives on `story_prompt_set`
 * instead. Reading only `story_image` here silently emptied cross-story
 * diversification for every digest (R1.1 / F1).
 */
function siblingHintsFromPromptSet(content: Json | null): SiblingMetaphorHint[] {
  const parsed = parseStoryPromptSetContent(content);
  if (!parsed) return [];
  return parsed.prompts.flatMap((prompt) => {
    const sceneSummary = (prompt.scene || prompt.canonical || prompt.title || '').slice(0, 180);
    if (!sceneSummary) return [];
    const composition: 'single' | 'dual_contrast' | undefined =
      prompt.composition === 'dual_contrast' || prompt.composition === 'single'
        ? prompt.composition
        : undefined;
    return [
      {
        motifClass: prompt.motifClass ?? undefined,
        subjectKind: prompt.subjectKind ?? undefined,
        composition,
        sceneSummary,
        // R2.3 / F9: without these, motifFamilyKey falls back to
        // `sceneSummary` as the subject and `''` as the setting for every
        // cross-story sibling, which almost never overlaps a fresh pitch's
        // own subject/setting head nouns -- family matching silently never
        // fired across stories. Threaded through from the accepted pitch.
        subject: prompt.subject ?? undefined,
        setting: prompt.setting ?? undefined,
        action: prompt.action ?? undefined,
        templateId: prompt.templateId ?? undefined,
      },
    ];
  });
}

/**
 * Sibling hint for one other story's artifact -- `story_prompt_set` when the
 * digest ran prompt_only (the default since M1), `story_image` metadata when
 * it ran the `render` escape hatch. Exported so R1.1's fix (siblings must not
 * silently go empty once prompt_only stopped writing story_image metadata)
 * has direct unit coverage without standing up the full worker/DB context.
 */
export function siblingHintsFromStorySiblingArtifact(artifact: {
  artifact_type: string;
  content: Json | null;
  metadata: Json | null;
}): SiblingMetaphorHint[] {
  return artifact.artifact_type === 'story_prompt_set'
    ? siblingHintsFromPromptSet(artifact.content)
    : siblingHintFromStoryImageMetadata(artifact.metadata);
}

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
  const otherStoryArtifacts = context.artifacts.filter(
    (artifact) =>
      (artifact.artifact_type === 'story_image' || artifact.artifact_type === 'story_prompt_set') &&
      artifact.revision_item_id &&
      artifact.revision_item_id !== item.id,
  );
  const siblingMetaphors = otherStoryArtifacts
    .flatMap((artifact) => siblingHintsFromStorySiblingArtifact(artifact))
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
    // R2.5 / F5: the "Edit direction" form (Visuals) always submits
    // scene_override on a story_image job regardless of render mode; before
    // this, prompt_only mode read it into a local and then never used it --
    // produceStoryPrompts only calls weeklyReportageConcepts (which honors
    // it) when it's present here.
    sceneOverride: text(asRecord(job.input).scene_override) ?? undefined,
    sceneOverrideSource: 'owner' as const,
  };
}

async function writeStoryImagePromptSet(
  job: ClaimedGenerationJob,
  tracker: GenerationAttemptTracker,
  item: GenerationItem,
  context: GenerationContext,
) {
  const visualRefreshPromptOnly = isWeeklyVisualRefreshPromptJob(job.input);
  const visualRefreshRevisionHash = visualRefreshPromptOnly
    ? text(asRecord(job.input).visual_refresh_revision_hash)
    : null;
  await tracker.event({
    type: 'stage_started',
    step: 'prompts',
    progressCurrent: 20,
    progressTotal: 100,
    message: 'Building copy-ready illustration prompts',
  });
  const { weeklyReportageSceneBriefs, weeklyReportageConcepts, WEEKLY_PROMPT_POLICY } =
    await lazyCardImage();
  const { exportManualImagePrompts } = await lazyPromptExport();
  const sceneInput = await storyImageSceneInput(job, item, context);
  const produced = await produceStoryPrompts({
    headline: item.title_en,
    sceneBriefs: weeklyReportageSceneBriefs,
    buildConcepts: weeklyReportageConcepts,
    exportPrompts: exportManualImagePrompts,
    sceneInput,
    cfg: weeklyCardImageConfig(),
    policy: WEEKLY_PROMPT_POLICY,
    // Every production path starts with one primary direction. Render mode
    // feeds a vision rejection into a repaired retry instead of producing a
    // hidden three-card lottery for automatic selection.
    count: 1,
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
      mapping_gate_issues: produced.content.mapping_gate_issues,
      semantic_contract: produced.content.semantic_contract as unknown as Json,
    },
    metadata: {
      source_kind: visualRefreshPromptOnly ? 'visual_refresh_prompt_only' : 'prompt_only',
      prompt_policy: produced.content.policy,
      ...(visualRefreshPromptOnly ? { visual_refresh: true, prompt_only: true } : {}),
    },
    visualRefreshPromptOnly,
    visualRefreshRevisionHash,
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
  const visualRefreshPromptOnly = isWeeklyVisualRefreshPromptJob(job.input);
  const visualRefreshRevisionHash = visualRefreshPromptOnly
    ? text(asRecord(job.input).visual_refresh_revision_hash)
    : null;
  const headline =
    context.revision.display_title_en?.trim() ||
    context.revision.title_en?.trim() ||
    'Weekly AI Digest';
  const visualThesis = context.revision.visual_thesis_en?.trim() || undefined;
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
      summary: visualThesis || topTitles || context.revision.intro_en || headline,
      why: visualThesis || context.revision.intro_en || undefined,
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
      mapping_gate_issues: produced.content.mapping_gate_issues,
      semantic_contract: produced.content.semantic_contract as unknown as Json,
    },
    metadata: {
      source_kind: visualRefreshPromptOnly ? 'visual_refresh_prompt_only' : 'prompt_only',
      prompt_policy: produced.content.policy,
      cover: true,
      ...(visualRefreshPromptOnly ? { visual_refresh: true, prompt_only: true } : {}),
    },
    visualRefreshPromptOnly,
    visualRefreshRevisionHash,
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
  const article = masterBundleFromArtifacts(context)[locale];
  const pdfInput: WeeklyPdfInput = {
    locale,
    issueLabel:
      locale === 'uk'
        ? `Випуск ${context.revision.revision_number}`
        : `Issue ${context.revision.revision_number}`,
    title: localizedWeeklyDisplayTitle(locale, context.revision),
    intro: article.intro,
    editorNote: article.editorNote,
    weekStart: context.digest.week_start,
    weekEnd: context.digest.week_end,
    webUrl: `${SITE_URL}/${locale}/weekly/${context.digest.slug}`,
    videoUrl: videoArtifact?.external_url ?? null,
    coverImageUrl,
    keyTakeaways: article.keyTakeaways,
    stories: article.stories.map((story, index) => {
      const item =
        context.items.find((row) => row.id === story.revisionItemId) ?? context.items[index];
      const source = sourceFromJson(item?.sources);
      return {
        rank: item?.rank ?? index + 1,
        title: story.headline,
        summary: story.summary,
        body: story.body,
        why: story.why,
        practical: story.practical,
        takeaway: story.takeaway,
        limitation: story.limitation,
        sourceName: source.name,
        sourceUrl: source.url,
        eventDate: item?.event_date ?? null,
        imageUrl: storyImageUrls[index],
        imageAlt: story.headline,
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
    // Cover, contents, one page per top-3 feature, one shared radar page, close.
    // Six when an edition has no radar items, seven otherwise; the extra page of
    // slack keeps the guard from failing on a layout tweak rather than on a
    // regression. Editions used to run 14-21 pages, which readers do not finish.
    if (contentStudioPdf && (document.length < 6 || document.length > 8)) {
      throw new Error(
        `Content Studio PDF is ${document.length} pages; the approved A4 contract is 6–8 pages.`,
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
  let promptPolicy = 'weekly-semantic-story-v6';
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

  // A visual-refresh job is a hard prompt-only fence even when an unexpected
  // source_url or a globally enabled render mode reaches the worker.
  if (isWeeklyVisualRefreshPromptJob(job.input)) {
    return writeStoryImagePromptSet(job, tracker, item, context);
  }
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
      message:
        'Building the semantic contract, rendering the primary candidate and running vision review',
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
            // Production optimizes for one semantically correct editorial image.
            // Rejection feeds a repaired retry, rather than making the owner
            // compare three weakly different candidates from the same brief.
            variantCount: WEEKLY_STORY_RENDER_VARIANT_COUNT,
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
    message: 'Saving the primary illustration and retained review history',
  });
  const {
    encodeSiteWebp,
    SITE_IMAGE_CONTENT_TYPE,
    SITE_IMAGE_EXTENSION,
    STORY_IMAGE_HEIGHT,
    STORY_IMAGE_WIDTH,
  } = await import('@/lib/encode-site-image');
  const processImage = (buffer: Buffer) =>
    encodeSiteWebp(buffer, {
      width: STORY_IMAGE_WIDTH,
      height: STORY_IMAGE_HEIGHT,
      position: 'attention',
    });
  const image = await processImage(source);
  const hash = createHash('sha256').update(image).digest('hex');
  const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${hash}-${job.id}.${SITE_IMAGE_EXTENSION}`;
  await uploadPrivate(path, image, SITE_IMAGE_CONTENT_TYPE);

  const previewPaths: string[] = [];
  for (const [index, buffer] of alternateBuffers.entries()) {
    const processed = await processImage(buffer);
    const altHash = createHash('sha256').update(processed).digest('hex');
    const altPath = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${altHash}-${job.id}-alt${index + 1}.${SITE_IMAGE_EXTENSION}`;
    await uploadPrivate(altPath, processed, SITE_IMAGE_CONTENT_TYPE);
    previewPaths.push(altPath);
  }

  const iterationPreviews: Array<Record<string, Json | undefined>> = [];
  for (const preview of imageMeta?.iterationPreviews ?? []) {
    if (!preview.bytes?.length) continue;
    const processed = await processImage(preview.bytes);
    const previewHash = createHash('sha256').update(processed).digest('hex');
    const previewPath =
      `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/` +
      `${previewHash}-${job.id}-attempt${preview.attempt}-v${preview.variantIndex + 1}.${SITE_IMAGE_EXTENSION}`;
    await uploadPrivate(previewPath, processed, SITE_IMAGE_CONTENT_TYPE);
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
    mimeType: SITE_IMAGE_CONTENT_TYPE,
    width: STORY_IMAGE_WIDTH,
    height: STORY_IMAGE_HEIGHT,
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
  if (
    isWeeklyVisualRefreshPromptJob(job.input) ||
    resolveWeeklyStoryImageMode() === 'prompt_only'
  ) {
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

/**
 * Job types that call a metered provider. `pdf`, `video_manifest` and
 * `social_asset` only assemble artifacts that already exist, so a spend
 * ceiling must not block them — a half-finished digest should still be able
 * to render what it has.
 */
const METERED_JOB_TYPES = new Set([
  'research_pack',
  'editorial_master',
  'social_copy',
  'video_script',
  'story_image',
  'cover',
]);

async function runGenerationJob(job: ClaimedGenerationJob, tracker: GenerationAttemptTracker) {
  if (METERED_JOB_TYPES.has(job.job_type)) {
    await assertDailyGenerationBudget(job.job_type);
  }
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
