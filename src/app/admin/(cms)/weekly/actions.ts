'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import sharp from 'sharp';
import type { Json } from '@/lib/database.types';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordGenerationCost } from '@/lib/generation-costs';
import { revalidateSiteSurfaces } from '@/lib/revalidate-site';
import {
  encodeSiteWebp,
  SITE_IMAGE_CONTENT_TYPE,
  SITE_IMAGE_EXTENSION,
} from '@/lib/encode-site-image';
import { storageBlob } from '@/lib/storage/binary';
import { getSupabaseServer } from '@/lib/supabase/server';
import { updateVariantAction } from '@/app/admin/actions';
import { composeWeeklySocial } from '@/lib/social/composer';
import { parseChannelSocialSave } from '@/lib/social/parse-social-save';
import { socialApprovalBlockers } from '@/lib/social/quality';
import { isSocialChannel, type QualityReport } from '@/lib/social/types';
import {
  completedWeeklyRangeForTrigger,
  kyivWallClockToUtc,
  SOCIAL_TIME_ZONE,
  weeklyDigestTriggerDateForManualCreate,
} from '@/lib/social/schedule';
import { weeklyRevisionContentErrorMessage } from '@/lib/weekly-digest/editorial-validation';
import {
  weeklyVisualDirection,
  weeklyVisualDirectionErrorMessage,
} from '@/lib/weekly-digest/visual-direction';
import {
  contentStudioVideoManifestKey,
  queuePostMasterJobs,
} from '@/lib/weekly-digest/content-studio-queue';
import { videoScriptFromArtifactContent } from '@/lib/weekly-digest/video-script-content';
import { backendForGenerationJob } from '@/lib/weekly-digest/generation-control';
import {
  dispatchQueuedWeeklyGenerationJob,
  isRetryableGithubDispatchError,
} from '@/lib/weekly-digest/github-dispatch';
import {
  WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES,
} from '@/lib/weekly-digest/admin-upload-limits';
import {
  weeklyWorkspaceTabForArtifactType,
  weeklyWorkspaceTabForJobType,
  weeklyWorkspaceTabFromFormValue,
  type WeeklyWorkspaceErrorTab,
} from '@/lib/weekly-digest/workspace-tab';
import {
  retryWeeklyContentStudio,
  weeklyContentStudioMode,
} from '@/lib/weekly-digest/orchestrator';
import {
  fetchYouTubeDurationSeconds,
  normalizeYouTubeVideo,
  validateWeeklyVideoResultManifest,
} from '@/lib/weekly-digest/video';
import {
  ignorePostUploadQa,
  parsePostUploadQa,
  POST_UPLOAD_QA_PENDING,
  type PostUploadQa,
} from '@/lib/weekly-digest/post-upload-qa';
import { rebuildWeeklySelection } from '@/lib/weekly-digest/rebuild-selection';
import {
  reviewUploadedImage,
  type PostUploadQaStoryContext,
} from '@/lib/weekly-digest/run-post-upload-qa';
import { parseStoryPromptSetContent } from '@/lib/weekly-digest/story-prompt-set';
import {
  applyOwnerFeedbackToImageMetadata,
  applyOwnerFeedbackToPromptSet,
  mergeOwnerFeedbackOntoImageMetadata,
  ownerFeedbackFromPromptSet,
  recordOwnerConceptFeedback,
  type OwnerConceptFeedback,
} from '@/lib/weekly-digest/owner-feedback';
import { COVER_PROMPT_SLOT } from '@/lib/weekly-digest/story-prompt-job';
import {
  isWeeklyVisualRefreshPromptJobType,
  isWeeklyVisualRefreshRevision,
  weeklyVisualRefreshDirectionHref,
} from '@/lib/weekly-digest/visual-refresh';
import { USE_LATEST_REVISION_REASON } from '@/lib/weekly-digest/master-persist';
import { carryOverOrphanedQualityReport } from '@/lib/weekly-digest/quality-report-carryover';
import {
  canApproveQualityOrArticle,
  canMachineAttest,
  qualityReportForbidsApprove,
} from '@/lib/weekly-digest/machine-attest';
import { buildHallucinationBoard } from '@/lib/weekly-digest/hallucination-board';
import {
  VISUAL_REFRESH_PUBLIC_ASSET_BUCKET,
  weeklyVisualRefreshPublicAssetPath,
} from '@/lib/weekly-digest/visual-refresh-public-path';

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function trimmedOrUndefined(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Any saved editorial segment is worth resuming (master-engine.ts writes the
 * run state after every one), so this no longer demands a complete EN+UK
 * pair — nine of fourteen segments is exactly the case where resuming saves
 * the most. The worker re-validates the state against the current research
 * packs before reusing a single word of it.
 */
function hasResumableMasterState(value: Json | null | undefined) {
  const state = jsonRecord(jsonRecord(value).master_run_state);
  return Object.keys(jsonRecord(state.segments)).length > 0;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${key} must be a number.`);
  return number;
}

function parseJson(value: string, label: string): Json {
  try {
    return JSON.parse(value) as Json;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function jsonArray(value: string, label: string): Json[] {
  if (!value.trim()) return [];
  const parsed = parseJson(value, label);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}

function takeaways(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [] as string[];
  if (trimmed.startsWith('[')) {
    const parsed = jsonArray(trimmed, 'Key takeaways');
    if (parsed.some((entry) => typeof entry !== 'string')) {
      throw new Error('Every key takeaway must be text.');
    }
    return parsed as string[];
  }
  return trimmed
    .split(/\r?\n/)
    .map((entry) => entry.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}

function alignedStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function changedOr(current: string | null, value: string | undefined) {
  return value === undefined ? (current ?? '') : value;
}

function jsonRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function revalidateWeeklyAdmin(weeklyDigestId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/weekly');
  revalidatePath(`/admin/weekly/${weeklyDigestId}`);
}

/**
 * Release RPCs embed the preflight blocker list as a JSON array in the error
 * text ("Ship blocked by preflight: [{...}]"). Show the messages, not raw JSON.
 */
function formatPreflightError(message: string): string {
  const start = message.indexOf('[{');
  const end = message.lastIndexOf('}]');
  if (start < 0 || end <= start) return message;
  try {
    const blockers = JSON.parse(message.slice(start, end + 1)) as Array<{
      code?: unknown;
      message?: unknown;
    }>;
    const parts = blockers
      .map((blocker) =>
        typeof blocker.message === 'string' && blocker.message.trim()
          ? blocker.message.trim()
          : String(blocker.code ?? 'unknown blocker'),
      )
      .slice(0, 5);
    return parts.length ? `${message.slice(0, start).trim()} — ${parts.join('; ')}` : message;
  } catch {
    return message;
  }
}

/**
 * A read-then-blind-UPDATE on a shared jsonb column can lose a concurrent
 * writer's change (post-upload QA landing while an owner saves feedback,
 * two feedback saves on different concept lenses back-to-back). This isn't
 * a new artifact VERSION -- save_weekly_digest_artifact is the wrong tool
 * for an in-place annotation -- so this closes the race with a plain
 * optimistic-concurrency retry instead (R3.2 / F13): the UPDATE is
 * conditioned on `updated_at` still matching what was just read, and a
 * miss (0 rows affected) means someone else won the race, so a fresh read
 * and merge is retried rather than silently overwriting their write.
 */
const OPTIMISTIC_UPDATE_MAX_ATTEMPTS = 3;

async function persistPostUploadQa(artifactId: string, weeklyDigestId: string, qa: PostUploadQa) {
  const admin = getSupabaseAdmin();
  for (let attempt = 0; attempt < OPTIMISTIC_UPDATE_MAX_ATTEMPTS; attempt++) {
    const { data, error } = await admin
      .from('weekly_digest_artifacts')
      .select('metadata, updated_at, artifact_type')
      .eq('id', artifactId)
      .maybeSingle();
    if (error) {
      console.error('[weekly-upload-qa] load metadata failed', error.message);
      return;
    }
    if (!data) return;
    const metadata = {
      ...jsonRecord(data.metadata),
      post_upload_qa: qa as unknown as Json, // JSONB: PostUploadQa is a JSON object, not a Json union member.
    } as Json;
    const { data: updatedRows, error: updateError } = await admin
      .from('weekly_digest_artifacts')
      .update({ metadata })
      .eq('id', artifactId)
      .eq('updated_at', data.updated_at)
      .select('id');
    if (updateError) {
      console.error('[weekly-upload-qa] write metadata failed', updateError.message);
      return;
    }
    if (updatedRows && updatedRows.length > 0) {
      if (
        canMachineAttest({
          artifactType: data.artifact_type,
          metadata: metadata,
        })
      ) {
        const attested = await admin.rpc('machine_attest_weekly_digest_artifact', {
          p_artifact_id: artifactId,
        });
        if (attested.error) {
          console.error('[weekly-upload-qa] machine attest failed', attested.error.message);
          // The artifact is now stuck in `in_review` with no visible reason —
          // surface it on the release timeline the owner actually reads.
          await admin.from('weekly_digest_release_events').insert({
            weekly_digest_id: weeklyDigestId,
            revision_id: null,
            event_type: 'attest_failed',
            payload: {
              artifact_id: artifactId,
              error: attested.error.message,
            } as Json,
          });
        }
      }
      break;
    }
    if (attempt === OPTIMISTIC_UPDATE_MAX_ATTEMPTS - 1) {
      console.error('[weekly-upload-qa] write metadata failed', 'optimistic update conflict');
      return;
    }
  }
  if (qa.model || qa.cost_usd > 0) {
    await recordGenerationCost({
      scope: 'weekly',
      kind: 'llm',
      provider: 'vision',
      model: qa.model ?? 'weekly.image_critic',
      costUsd: qa.cost_usd,
      costSource: 'estimated',
      weeklyDigestId,
      artifactId,
      stepKey: 'post_upload_qa',
    });
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

async function loadPromptSetOwnerFeedback(input: {
  weeklyDigestId: string;
  revisionId: string;
  artifactType: string;
  revisionItemId: string | null;
}) {
  if (input.artifactType === 'cover') {
    return fetchPromptSetOwnerFeedback({
      weeklyDigestId: input.weeklyDigestId,
      revisionId: input.revisionId,
      slotKey: COVER_PROMPT_SLOT,
    });
  }
  if (input.artifactType === 'story_image' && input.revisionItemId) {
    return fetchPromptSetOwnerFeedback({
      weeklyDigestId: input.weeklyDigestId,
      revisionId: input.revisionId,
      revisionItemId: input.revisionItemId,
    });
  }
  return {};
}

async function fetchPromptSetOwnerFeedback(input: {
  weeklyDigestId: string;
  revisionId: string;
  slotKey?: string;
  revisionItemId?: string;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('weekly_digest_artifacts')
    .select('content')
    .eq('weekly_digest_id', input.weeklyDigestId)
    .eq('revision_id', input.revisionId)
    .eq('artifact_type', 'story_prompt_set');
  if (input.slotKey) query = query.eq('slot_key', input.slotKey);
  if (input.revisionItemId) query = query.eq('revision_item_id', input.revisionItemId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[weekly-owner-feedback] load prompt set failed', error.message);
    return {};
  }
  return ownerFeedbackFromPromptSet(data?.content);
}

async function loadPostUploadQaStoryContext(input: {
  weeklyDigestId: string;
  revisionId: string;
  revisionItemId: string | null;
  artifactType: string;
}): Promise<PostUploadQaStoryContext | undefined> {
  // A cover explains the issue as a whole; the precise three-second semantic
  // check belongs to a story image, where one primary direction has one
  // authoritative source story. Covers keep the existing pixel-only QA.
  if (input.artifactType !== 'story_image') return undefined;
  if (!input.revisionItemId) {
    throw new Error('Story-aware QA requires a revision item.');
  }
  const admin = getSupabaseAdmin();
  const [itemResult, promptResult] = await Promise.all([
    admin
      .from('weekly_digest_revision_items')
      .select('title_en,summary_en,why_en,practical_en,takeaway_en,source_snapshot')
      .eq('id', input.revisionItemId)
      .eq('revision_id', input.revisionId)
      .maybeSingle(),
    admin
      .from('weekly_digest_artifacts')
      .select('content')
      .eq('weekly_digest_id', input.weeklyDigestId)
      .eq('revision_id', input.revisionId)
      .eq('revision_item_id', input.revisionItemId)
      .eq('artifact_type', 'story_prompt_set')
      .eq('is_current', true)
      .maybeSingle(),
  ]);
  if (itemResult.error || !itemResult.data) {
    const reason = itemResult.error?.message ?? 'story revision item was not found';
    console.error('[weekly-upload-qa] load story context failed', reason);
    throw new Error(`Story-aware QA context unavailable: ${reason}`);
  }
  if (promptResult.error) {
    console.error('[weekly-upload-qa] load prompt context failed', promptResult.error.message);
  }
  const promptSet = parseStoryPromptSetContent(promptResult.data?.content);
  const primary = promptSet?.prompts[0];
  const contract = promptSet?.semanticContract;
  const contentStudio = jsonRecord(jsonRecord(itemResult.data.source_snapshot).content_studio);
  return {
    headline: itemResult.data.title_en,
    summary: trimmedOrUndefined(itemResult.data.summary_en),
    why: trimmedOrUndefined(itemResult.data.why_en),
    practical: trimmedOrUndefined(itemResult.data.practical_en),
    limitation:
      typeof contentStudio.limitation_en === 'string'
        ? trimmedOrUndefined(contentStudio.limitation_en)
        : undefined,
    takeaway: trimmedOrUndefined(itemResult.data.takeaway_en),
    storyContext: contract?.storyContext,
    meaning: contract?.meaning,
    essence: contract?.essence,
    mechanism: contract?.mechanism,
    consequence: contract?.consequence,
    visualThesis: contract?.visualThesis,
    readerTest: contract?.readerTest,
    scene: primary?.scene ?? primary?.canonical,
    policyId: promptSet?.policy ?? 'weekly-semantic-story-v6',
  };
}

function schedulePostUploadQa(input: {
  artifactId: string;
  weeklyDigestId: string;
  revisionId: string;
  revisionItemId: string | null;
  artifactType: string;
  bytes: Buffer;
  mimeType: string;
}) {
  after(async () => {
    try {
      const storyContext = await loadPostUploadQaStoryContext(input);
      const qa = await reviewUploadedImage({
        bytes: input.bytes,
        mimeType: input.mimeType,
        storyContext,
      });
      await persistPostUploadQa(input.artifactId, input.weeklyDigestId, qa);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await persistPostUploadQa(input.artifactId, input.weeklyDigestId, {
        blockers: [],
        scores: {},
        model: null,
        cost_usd: 0,
        checked_at: new Date().toISOString(),
        error: message.slice(0, 240),
      });
    }
  });
}

function weeklyRevisionTab(formData: FormData) {
  return optionalString(formData, 'edit_scope') === 'article' ? 'article' : 'stories';
}

function redirectWeeklyRevisionContentError(
  weeklyDigestId: string,
  formData: FormData,
  message: string,
): never {
  const tab = weeklyRevisionTab(formData);
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=${tab}&save_error=${encodeURIComponent(message)}`,
  );
}

function redirectWeeklyVisualsError(weeklyDigestId: string, message: string): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=visuals&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function redirectWeeklyWorkspaceError(
  weeklyDigestId: string,
  tab: WeeklyWorkspaceErrorTab,
  message: string,
): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=${tab}&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

function failWeeklyWorkspace(
  weeklyDigestId: string,
  tab: WeeklyWorkspaceErrorTab,
  error: unknown,
): never {
  if (isNextRedirectError(error)) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (!weeklyDigestId) {
    throw error instanceof Error ? error : new Error(message);
  }
  redirectWeeklyWorkspaceError(weeklyDigestId, tab, message);
}

async function queuePostMasterJobsForRevision(weeklyDigestId: string, revisionId: string) {
  const admin = getSupabaseAdmin();
  const { data: items, error } = await admin
    .from('weekly_digest_revision_items')
    .select('id,title_en,title_uk')
    .eq('revision_id', revisionId)
    .order('rank');
  if (error) throw new Error(error.message);
  await queuePostMasterJobs(weeklyDigestId, revisionId, items ?? []);
}

async function isVisualRefreshAssetRevision(weeklyDigestId: string, revisionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('weekly_digest_revisions')
    .select('visual_refresh_source_revision_id')
    .eq('id', revisionId)
    .eq('weekly_digest_id', weeklyDigestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The selected Weekly Digest revision was not found.');
  return isWeeklyVisualRefreshRevision(data);
}

/**
 * Most asset mutations still cannot target a private visual-refresh draft:
 * the sole exception is the dedicated upload/apply path below, which stages
 * image bytes privately and never edits the published revision in place.
 */
async function rejectVisualRefreshAssetMutation(weeklyDigestId: string, revisionId: string) {
  if (await isVisualRefreshAssetRevision(weeklyDigestId, revisionId)) {
    throw new Error(
      'Use the staged visual-refresh upload and apply controls for this private revision.',
    );
  }
}

function kyivDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Test editions use the full editorial and generation pipeline but carry a
 * database-enforced publication lock. One test exists per seven-day window so
 * repeated clicks safely reopen the same evidence set.
 */
export async function createTestWeeklyDigestAction() {
  await requireSocialAdmin({ roles: ['owner'] });
  const now = new Date();
  let result;
  try {
    result = await composeWeeklySocial(kyivDate(now), { now, testMode: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown preparation error.';
    redirect(`/admin/weekly?test_error=${encodeURIComponent(message.slice(0, 300))}`);
  }
  if (!result.weeklyDigestId) {
    redirect(
      `/admin/weekly?test_error=${encodeURIComponent(
        'The test Weekly Digest could not be prepared for this seven-day window.',
      )}`,
    );
  }
  revalidateWeeklyAdmin(result.weeklyDigestId);
  redirect(`/admin/weekly/${result.weeklyDigestId}`);
}

/**
 * Creates the production edition for the Sunday that closes the current
 * editorial week. The scheduled Sunday job uses the identical trigger date,
 * so composeWeeklySocial's package idempotency makes that later job a no-op.
 */
export async function createWeeklyDigestAction() {
  await requireSocialAdmin({ roles: ['owner'] });
  const now = new Date();
  const triggerDate = weeklyDigestTriggerDateForManualCreate(kyivDate(now));
  let result;
  try {
    result = await composeWeeklySocial(triggerDate, { now, manual: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown preparation error.';
    redirect(`/admin/weekly?create_error=${encodeURIComponent(message.slice(0, 300))}`);
  }

  let weeklyDigestId = result.weeklyDigestId;
  if (!weeklyDigestId) {
    const { weekStart } = completedWeeklyRangeForTrigger(triggerDate);
    const { data, error } = await getSupabaseAdmin()
      .from('weekly_digests')
      .select('id')
      .eq('week_start', weekStart)
      .eq('is_test', false)
      .maybeSingle();
    if (error) {
      redirect(`/admin/weekly?create_error=${encodeURIComponent(error.message.slice(0, 300))}`);
    }
    weeklyDigestId = data?.id;
  }
  if (!weeklyDigestId) {
    redirect(
      `/admin/weekly?create_error=${encodeURIComponent(
        'The Weekly Digest could not be prepared for this editorial week.',
      )}`,
    );
  }
  revalidateWeeklyAdmin(weeklyDigestId);
  redirect(`/admin/weekly/${weeklyDigestId}`);
}

async function editableWorkspace(weeklyDigestId: string, revisionId: string) {
  const db = getSupabaseAdmin();
  const [{ data: digest, error: digestError }, { data: revision, error: revisionError }] =
    await Promise.all([
      db
        .from('weekly_digests')
        .select('*')
        .eq('id', weeklyDigestId)
        .eq('active_revision_id', revisionId)
        .single(),
      db.from('weekly_digest_revisions').select('*').eq('id', revisionId).single(),
    ]);
  if (digestError || !digest) throw new Error('The active Weekly Digest was not found.');
  if (revisionError || !revision) throw new Error('The active revision was not found.');
  const { data: items, error: itemError } = await db
    .from('weekly_digest_revision_items')
    .select('*')
    .eq('revision_id', revisionId)
    .order('rank');
  if (itemError || !items) throw new Error('The revision stories could not be loaded.');
  return { digest, revision, items };
}

export async function saveWeeklyRevisionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const { revision, items } = await editableWorkspace(weeklyDigestId, revisionId);
  const { data: currentArticleArtifacts } = await getSupabaseAdmin()
    .from('weekly_digest_artifacts')
    .select('locale,content,metadata')
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'article')
    .eq('is_current', true);
  const currentArticle = (locale: 'en' | 'uk') => {
    const artifact = (currentArticleArtifacts ?? []).find(
      (candidate) => candidate.locale === locale,
    );
    const content =
      artifact?.content && typeof artifact.content === 'object' && !Array.isArray(artifact.content)
        ? (artifact.content as Record<string, Json | undefined>)
        : {};
    return { content, metadata: artifact?.metadata ?? ({} as Json) };
  };
  const itemIds = alignedStrings(formData, 'item_id');
  const includedIds = new Set(alignedStrings(formData, 'included_item_id'));
  const submitted = {
    rank: alignedStrings(formData, 'item_rank'),
    titleEn: alignedStrings(formData, 'item_title_en'),
    titleUk: alignedStrings(formData, 'item_title_uk'),
    summaryEn: alignedStrings(formData, 'item_summary_en'),
    summaryUk: alignedStrings(formData, 'item_summary_uk'),
    bodyEn: alignedStrings(formData, 'item_body_en'),
    bodyUk: alignedStrings(formData, 'item_body_uk'),
    whyEn: alignedStrings(formData, 'item_why_en'),
    whyUk: alignedStrings(formData, 'item_why_uk'),
    practicalEn: alignedStrings(formData, 'item_practical_en'),
    practicalUk: alignedStrings(formData, 'item_practical_uk'),
    takeawayEn: alignedStrings(formData, 'item_takeaway_en'),
    takeawayUk: alignedStrings(formData, 'item_takeaway_uk'),
    eventDate: alignedStrings(formData, 'item_event_date'),
    sources: alignedStrings(formData, 'item_sources_json'),
  };
  const byId = new Map(items.map((item) => [item.id, item]));
  const nextItems =
    itemIds.length > 0
      ? itemIds
          .flatMap((itemId, index) => {
            const current = byId.get(itemId);
            if (!current || (includedIds.size > 0 && !includedIds.has(itemId))) return [];
            return [
              {
                brief_item_id: current.brief_item_id,
                rank: Number(submitted.rank[index] || current.rank),
                title_en: changedOr(current.title_en, submitted.titleEn[index]),
                title_uk: changedOr(current.title_uk, submitted.titleUk[index]),
                summary_en: changedOr(current.summary_en, submitted.summaryEn[index]),
                summary_uk: changedOr(current.summary_uk, submitted.summaryUk[index]),
                body_en: changedOr(current.body_en, submitted.bodyEn[index]),
                body_uk: changedOr(current.body_uk, submitted.bodyUk[index]),
                why_en: changedOr(current.why_en, submitted.whyEn[index]),
                why_uk: changedOr(current.why_uk, submitted.whyUk[index]),
                practical_en: changedOr(current.practical_en, submitted.practicalEn[index]),
                practical_uk: changedOr(current.practical_uk, submitted.practicalUk[index]),
                takeaway_en: changedOr(current.takeaway_en, submitted.takeawayEn[index]),
                takeaway_uk: changedOr(current.takeaway_uk, submitted.takeawayUk[index]),
                event_date: changedOr(current.event_date, submitted.eventDate[index]) || null,
                sources:
                  submitted.sources[index] === undefined
                    ? current.sources
                    : jsonArray(submitted.sources[index], `Sources for story ${index + 1}`),
                source_snapshot: current.source_snapshot,
              },
            ];
          })
          .sort((a, b) => a.rank - b.rank)
          .map((item, index) => ({ ...item, rank: index + 1 }))
      : items.map((item) => ({
          brief_item_id: item.brief_item_id,
          rank: item.rank,
          title_en: item.title_en,
          title_uk: item.title_uk,
          summary_en: item.summary_en,
          summary_uk: item.summary_uk,
          body_en: item.body_en,
          body_uk: item.body_uk,
          why_en: item.why_en,
          why_uk: item.why_uk,
          practical_en: item.practical_en,
          practical_uk: item.practical_uk,
          takeaway_en: item.takeaway_en,
          takeaway_uk: item.takeaway_uk,
          event_date: item.event_date,
          sources: item.sources,
          source_snapshot: item.source_snapshot,
        }));
  if (nextItems.length < 3 || nextItems.length > 7) {
    throw new Error('A Weekly Digest revision must contain 3 to 7 stories.');
  }

  const titleEn = formData.has('title_en')
    ? optionalString(formData, 'title_en')
    : revision.title_en;
  const titleUk = formData.has('title_uk')
    ? optionalString(formData, 'title_uk')
    : revision.title_uk;
  const introEn = formData.has('intro_en')
    ? optionalString(formData, 'intro_en')
    : (revision.intro_en ?? '');
  const introUk = formData.has('intro_uk')
    ? optionalString(formData, 'intro_uk')
    : (revision.intro_uk ?? '');
  const editorNoteEn = formData.has('editor_note_en')
    ? optionalString(formData, 'editor_note_en')
    : (revision.editor_note_en ?? '');
  const editorNoteUk = formData.has('editor_note_uk')
    ? optionalString(formData, 'editor_note_uk')
    : (revision.editor_note_uk ?? '');
  const takeawaysEn = formData.has('key_takeaways_en')
    ? takeaways(optionalString(formData, 'key_takeaways_en'))
    : revision.key_takeaways_en;
  const takeawaysUk = formData.has('key_takeaways_uk')
    ? takeaways(optionalString(formData, 'key_takeaways_uk'))
    : revision.key_takeaways_uk;
  const visualDirectionInput = {
    displayTitleEn: formData.has('display_title_en')
      ? optionalString(formData, 'display_title_en')
      : revision.display_title_en,
    displayTitleUk: formData.has('display_title_uk')
      ? optionalString(formData, 'display_title_uk')
      : revision.display_title_uk,
    visualThesisEn: formData.has('visual_thesis_en')
      ? optionalString(formData, 'visual_thesis_en')
      : revision.visual_thesis_en,
    visualThesisUk: formData.has('visual_thesis_uk')
      ? optionalString(formData, 'visual_thesis_uk')
      : revision.visual_thesis_uk,
  };
  const visualDirectionError = weeklyVisualDirectionErrorMessage(visualDirectionInput);
  if (visualDirectionError) {
    redirectWeeklyRevisionContentError(weeklyDigestId, formData, visualDirectionError);
  }
  const visualDirection = weeklyVisualDirection(visualDirectionInput);
  const articleExtras = (locale: 'en' | 'uk') => {
    const existing = currentArticle(locale);
    const value = (field: string, fallback = '') =>
      formData.has(`${field}_${locale}`)
        ? optionalString(formData, `${field}_${locale}`)
        : typeof existing.content[field] === 'string'
          ? (existing.content[field] as string)
          : fallback;
    const list = (field: string) =>
      formData.has(`${field}_${locale}`)
        ? takeaways(optionalString(formData, `${field}_${locale}`))
        : Array.isArray(existing.content[field])
          ? existing.content[field]
          : [];
    const links = formData.has(`internal_links_${locale}`)
      ? jsonArray(
          optionalString(formData, `internal_links_${locale}`),
          `${locale.toUpperCase()} internal links`,
        )
      : Array.isArray(existing.content.internalLinks)
        ? existing.content.internalLinks
        : [];
    return {
      seoTitle: value('seo_title', locale === 'en' ? titleEn : titleUk),
      metaDescription: value('meta_description', locale === 'en' ? introEn : introUk),
      ogTitle: value('og_title', value('seo_title', locale === 'en' ? titleEn : titleUk)),
      ogDescription: value(
        'og_description',
        value('meta_description', locale === 'en' ? introEn : introUk),
      ),
      standfirst: value('standfirst', locale === 'en' ? introEn : introUk),
      theme: value('theme', locale === 'en' ? titleEn : titleUk),
      topics: list('topics'),
      entities: list('entities'),
      internalLinks: links,
      provenance: existing.content.provenance ?? null,
      metadata: existing.metadata,
    };
  };
  const extrasEn = articleExtras('en');
  const extrasUk = articleExtras('uk');

  const validationError = weeklyRevisionContentErrorMessage({
    title_en: titleEn,
    title_uk: titleUk,
    intro_en: introEn,
    intro_uk: introUk,
    editor_note_en: editorNoteEn,
    editor_note_uk: editorNoteUk,
    key_takeaways_en: takeawaysEn,
    key_takeaways_uk: takeawaysUk,
    items: nextItems,
  });
  if (validationError) {
    redirectWeeklyRevisionContentError(weeklyDigestId, formData, validationError);
  }

  const db = await getSupabaseServer();
  const revisionArgs = {
    p_weekly_digest_id: weeklyDigestId,
    p_title_en: titleEn,
    p_title_uk: titleUk,
    p_intro_en: introEn,
    p_intro_uk: introUk,
    p_editor_note_en: editorNoteEn,
    p_editor_note_uk: editorNoteUk,
    p_key_takeaways_en: takeawaysEn as Json,
    p_key_takeaways_uk: takeawaysUk as Json,
    p_items: nextItems as unknown as Json,
  };
  const { data: newRevisionId, error } = visualDirection
    ? await db.rpc('create_weekly_digest_revision_with_visual_direction', {
        ...revisionArgs,
        p_display_title_en: visualDirection.displayTitleEn,
        p_display_title_uk: visualDirection.displayTitleUk,
        p_visual_thesis_en: visualDirection.visualThesisEn,
        p_visual_thesis_uk: visualDirection.visualThesisUk,
      })
    : await db.rpc('create_weekly_digest_revision', revisionArgs);
  if (error) throw new Error(error.message);
  if (typeof newRevisionId !== 'string') {
    throw new Error('The new Weekly Digest revision ID was not returned.');
  }
  for (const [locale, title, intro, editorNote, localeTakeaways, extras] of [
    ['en', titleEn, introEn, editorNoteEn, takeawaysEn, extrasEn],
    ['uk', titleUk, introUk, editorNoteUk, takeawaysUk, extrasUk],
  ] as const) {
    const { error: articleError } = await db.rpc('save_weekly_digest_artifact', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: newRevisionId,
      p_artifact_type: 'article',
      p_locale: locale,
      p_slot_key: `article:${locale}`,
      p_content: {
        title,
        intro,
        editor_note: editorNote,
        key_takeaways: localeTakeaways,
        seoTitle: extras.seoTitle,
        metaDescription: extras.metaDescription,
        ogTitle: extras.ogTitle,
        ogDescription: extras.ogDescription,
        standfirst: extras.standfirst,
        theme: extras.theme,
        topics: extras.topics,
        entities: extras.entities,
        internalLinks: extras.internalLinks,
        provenance: extras.provenance,
      } as Json,
      p_metadata: {
        format: 'weekly-landing-v3',
        schema_version: 'article-v3',
        story_count: nextItems.length,
        inherited_metadata: extras.metadata,
      } as Json,
    });
    if (articleError) throw new Error(articleError.message);
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Published weekly text remains immutable. This is the sole editor action
 * that may alter direction on its active private visual-refresh draft; the
 * RPC re-checks AAL2 ownership, published provenance, and queues fresh
 * prompt-only jobs in one transaction.
 */
export async function saveWeeklyVisualRefreshDirectionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'], aal2: true });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const input = {
    displayTitleEn: optionalString(formData, 'display_title_en'),
    displayTitleUk: optionalString(formData, 'display_title_uk'),
    visualThesisEn: optionalString(formData, 'visual_thesis_en'),
    visualThesisUk: optionalString(formData, 'visual_thesis_uk'),
  };
  const validationError = weeklyVisualDirectionErrorMessage(input);
  const direction = weeklyVisualDirection(input);
  if (validationError || !direction) {
    redirectWeeklyRevisionContentError(
      weeklyDigestId,
      formData,
      validationError ?? 'A visual refresh needs all four localized direction fields.',
    );
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('update_weekly_visual_refresh_direction', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_display_title_en: direction.displayTitleEn,
    p_display_title_uk: direction.displayTitleUk,
    p_visual_thesis_en: direction.visualThesisEn,
    p_visual_thesis_uk: direction.visualThesisUk,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Once an owner approves a story image, keep its selected primary file and
 * discard the review-only render gallery from private storage. The artifact
 * row and review ledger remain the audit trail; only the extra image bytes
 * stop being available as selectable versions.
 */
async function pruneApprovedStoryImagePreviews(artifactId: string) {
  const admin = getSupabaseAdmin();
  const { data: artifact, error: artifactError } = await admin
    .from('weekly_digest_artifacts')
    .select('id,storage_bucket,storage_path,content,metadata')
    .eq('id', artifactId)
    .maybeSingle();
  if (artifactError) throw new Error(artifactError.message);
  if (!artifact || artifact.storage_bucket === null) return;

  const content = jsonRecord(artifact.content);
  const paths = new Set<string>();
  const previewPaths = Array.isArray(content.preview_paths)
    ? content.preview_paths.filter((value): value is string => typeof value === 'string')
    : [];
  for (const path of previewPaths) paths.add(path);
  const iterationPreviews = Array.isArray(content.iteration_previews)
    ? content.iteration_previews
        .filter(
          (value): value is Record<string, Json | undefined> =>
            Boolean(value) && typeof value === 'object' && !Array.isArray(value),
        )
        .map((value) => value.path)
        .filter((value): value is string => typeof value === 'string')
    : [];
  for (const path of iterationPreviews) paths.add(path);

  const removable = [...paths].filter((path) => path !== artifact.storage_path);
  if (removable.length > 0) {
    const { error: removeError } = await admin.storage
      .from(artifact.storage_bucket)
      .remove(removable);
    if (removeError) throw new Error(removeError.message);
  }

  const {
    preview_paths: _previewPaths,
    iteration_previews: _iterationPreviews,
    ...keptContent
  } = content;
  const metadata = jsonRecord(artifact.metadata);
  const selectedConcept = Array.isArray(metadata.variant_concepts)
    ? metadata.variant_concepts.find((value) => jsonRecord(value).index === 0)
    : undefined;
  const selectedScore = Array.isArray(metadata.variant_scores)
    ? metadata.variant_scores.find((value) => jsonRecord(value).index === 0)
    : undefined;
  const {
    variant_concepts: _variantConcepts,
    variant_scores: _variantScores,
    ...keptMetadata
  } = metadata;
  if (selectedConcept) {
    keptMetadata.variant_concepts = [{ ...jsonRecord(selectedConcept), index: 0 }];
  }
  if (selectedScore) {
    keptMetadata.variant_scores = [{ ...jsonRecord(selectedScore), index: 0 }];
  }
  const { error: contentError } = await admin
    .from('weekly_digest_artifacts')
    .update({ content: keptContent as Json, metadata: keptMetadata as Json })
    .eq('id', artifactId);
  if (contentError) throw new Error(contentError.message);
}

export async function reviewWeeklyArtifactAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab'));
  try {
    await reviewWeeklyArtifact(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function reviewWeeklyArtifact(formData: FormData) {
  const decision = requiredString(formData, 'decision');
  const roles = decision === 'approved' ? (['owner'] as const) : (['owner', 'editor'] as const);
  await requireSocialAdmin({ roles });
  if (decision !== 'approved' && decision !== 'changes_requested') {
    throw new Error('Invalid artifact review decision.');
  }
  const artifactId = requiredString(formData, 'artifact_id');
  const expectedVersion = Number(requiredString(formData, 'artifact_version'));
  const expectedHash = requiredString(formData, 'artifact_input_hash');
  const note = optionalString(formData, 'note');
  if (decision === 'changes_requested' && (note.length < 10 || note.length > 2000)) {
    throw new Error('A change request note must contain 10 to 2000 characters.');
  }
  const admin = getSupabaseAdmin();
  const { data: artifact } = await admin
    .from('weekly_digest_artifacts')
    .select(
      'weekly_digest_id,revision_id,version,input_hash,is_current,artifact_type,metadata,content',
    )
    .eq('id', artifactId)
    .maybeSingle();
  if (
    !artifact?.is_current ||
    artifact.version !== expectedVersion ||
    artifact.input_hash !== expectedHash
  ) {
    throw new Error('This artifact changed while it was being reviewed. Reload before approval.');
  }
  if (await isVisualRefreshAssetRevision(artifact.weekly_digest_id, artifact.revision_id)) {
    // The normal review RPC is intentionally reusable, but a private visual
    // refresh is a publication-adjacent capability: both approval *and*
    // requests for changes require the same AAL2 owner session as staging and
    // applying pixels. The database repeats this check before changing state.
    await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  }
  if (decision === 'approved') {
    let qualityReportContent: unknown;
    if (artifact.artifact_type === 'article') {
      const { data: quality } = await admin
        .from('weekly_digest_artifacts')
        .select('content')
        .eq('revision_id', artifact.revision_id)
        .eq('artifact_type', 'content_quality_report')
        .eq('is_current', true)
        .maybeSingle();
      qualityReportContent = quality?.content;
    }
    const gate = canApproveQualityOrArticle({
      artifactType: artifact.artifact_type,
      artifactContent: artifact.content,
      qualityReportContent,
    });
    if (!gate.ok) throw new Error(gate.reason);
  }
  // Approving a failed content-sim image records an explicit human override so
  // release preflight can clear simulation_not_passed.
  if (
    decision === 'approved' &&
    (artifact.artifact_type === 'story_image' || artifact.artifact_type === 'cover')
  ) {
    const meta =
      artifact.metadata &&
      typeof artifact.metadata === 'object' &&
      !Array.isArray(artifact.metadata)
        ? { ...(artifact.metadata as Record<string, unknown>) }
        : {};
    const simRaw = meta.content_sim;
    if (simRaw && typeof simRaw === 'object' && !Array.isArray(simRaw)) {
      const sim = { ...(simRaw as Record<string, unknown>) };
      if (sim.passed !== true && sim.human_override !== true) {
        meta.content_sim = {
          ...sim,
          human_override: true,
          human_override_at: new Date().toISOString(),
          human_override_note: note || 'Owner approved after content-sim escalation review.',
          passed: true,
          outcome: 'passed',
        };
        const { error: metaError } = await admin
          .from('weekly_digest_artifacts')
          .update({ metadata: meta as import('@/lib/database.types').Json })
          .eq('id', artifactId);
        if (metaError) throw new Error(metaError.message);
      }
    }
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('review_weekly_digest_artifact', {
    p_artifact_id: artifactId,
    p_action: decision,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  // Approval can make a durable `waiting` job runnable. Wake the control
  // plane immediately instead of making the editor wait for the five-minute
  // safety cron. A dispatch failure is non-destructive: the job stays queued
  // and the cron dispatcher will try again.
  if (decision === 'approved') {
    if (artifact.artifact_type === 'content_quality_report') {
      try {
        await queuePostMasterJobsForRevision(artifact.weekly_digest_id, artifact.revision_id);
      } catch (queueError) {
        console.error(
          '[weekly-generation] post-master queue after quality approve failed',
          queueError instanceof Error ? queueError.message : String(queueError),
        );
      }
    }
    const controlDb = admin as unknown as {
      rpc: (name: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const refreshed = await controlDb.rpc('refresh_weekly_digest_generation_waiting_states');
    if (refreshed.error) {
      console.error('[weekly-generation] dependency refresh failed', refreshed.error.message);
    } else {
      try {
        await dispatchQueuedWeeklyGenerationJob();
      } catch (dispatchError) {
        console.error(
          '[weekly-generation] immediate GitHub dispatch failed',
          dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        );
      }
    }
    if (artifact.artifact_type === 'story_image') {
      await pruneApprovedStoryImagePreviews(artifactId);
    }
  }
  revalidateWeeklyAdmin(artifact.weekly_digest_id);
}

export async function commentWeeklyArtifactAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab'));
  try {
    await commentWeeklyArtifact(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function commentWeeklyArtifact(formData: FormData) {
  await requireSocialAdmin();
  const artifactId = requiredString(formData, 'artifact_id');
  const note = requiredString(formData, 'note');
  if (note.length > 2000) throw new Error('A comment may contain at most 2000 characters.');
  const admin = getSupabaseAdmin();
  const { data: artifact } = await admin
    .from('weekly_digest_artifacts')
    .select('weekly_digest_id')
    .eq('id', artifactId)
    .maybeSingle();
  if (!artifact) throw new Error('Weekly Digest artifact was not found.');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('comment_weekly_digest_artifact', {
    p_artifact_id: artifactId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(artifact.weekly_digest_id);
}

/**
 * Owner-set editorial angle per Top-3 story (PR4, editorial quality
 * overhaul) -- a plain upsert, not an RPC, because unlike revisions/
 * artifacts this table isn't append-only: one row per (weekly_digest_id,
 * brief_item_id), keyed by brief_item_id specifically so it survives a
 * Save minting a new revision underneath it (see the migration's comment).
 * An empty angle deletes the row rather than storing an empty string, so
 * "no direction set" and "direction cleared" both read the same way to
 * masterInputStories (generation-worker.ts).
 */
export async function saveWeeklyStoryDirectionAction(formData: FormData) {
  const session = await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const briefItemId = requiredString(formData, 'brief_item_id');
  const angle = optionalString(formData, 'angle');
  const fail = (message: string): never =>
    redirectWeeklyRevisionContentError(weeklyDigestId, formData, message);
  if (angle.length > 600) {
    fail('An editorial angle may contain at most 600 characters.');
  }
  const admin = getSupabaseAdmin();
  if (!angle) {
    const { error } = await admin
      .from('weekly_digest_story_directions')
      .delete()
      .eq('weekly_digest_id', weeklyDigestId)
      .eq('brief_item_id', briefItemId);
    if (error) fail(error.message);
    revalidateWeeklyAdmin(weeklyDigestId);
    return;
  }
  const { error } = await admin.from('weekly_digest_story_directions').upsert(
    {
      weekly_digest_id: weeklyDigestId,
      brief_item_id: briefItemId,
      angle,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'weekly_digest_id,brief_item_id' },
  );
  if (error) fail(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

async function saveArtifact(
  formData: FormData,
  artifact: {
    type: string;
    locale: 'neutral' | 'en' | 'uk';
    slot: string;
    content?: Record<string, Json | undefined>;
    externalUrl?: string;
    provider?: string;
    providerId?: string;
    mimeType?: string;
    durationSeconds?: number | null;
    metadata?: Record<string, Json | undefined>;
  },
) {
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_artifact_type: artifact.type,
    p_locale: artifact.locale,
    p_slot_key: artifact.slot,
    p_content: (artifact.content ?? {}) as Json,
    p_external_url: artifact.externalUrl || null,
    p_provider: artifact.provider || null,
    p_provider_id: artifact.providerId || null,
    p_mime_type: artifact.mimeType || null,
    p_duration_seconds: artifact.durationSeconds ?? null,
    p_metadata: (artifact.metadata ?? {}) as Json,
  });
  if (error) throw new Error(error.message);
  return weeklyDigestId;
}

function localKyivToIso(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Schedule must use YYYY-MM-DDTHH:mm in Europe/Kyiv.');
  return kyivWallClockToUtc(match[1], Number(match[2]), Number(match[3])).toISOString();
}

/**
 * Video tab Save posts scenes JSON (an array). Persist that array as
 * narration_plan and the worker cannot read shorts. Merge onto the current
 * generated plan so a phrase edit does not drop the v3 object.
 */
async function videoScriptPlanFromSave(formData: FormData, script: string, scenes: string) {
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('weekly_digest_artifacts')
    .select('content')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'video_script')
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const parsedScenes = scenes ? parseJson(scenes, 'Scene structure') : undefined;
  const merged = videoScriptFromArtifactContent(
    {
      ...(script ? { script } : {}),
      ...(parsedScenes === undefined ? {} : { narration_plan: parsedScenes }),
    },
    jsonRecord(data?.content).narration_plan,
  );
  if (!merged) {
    throw new Error(
      'Scene structure must keep title, hook, scenes and shorts from the generated script. Saving scenes-only JSON drops the Ukrainian Shorts and blocks the video manifest.',
    );
  }
  return merged;
}

export async function saveWeeklyVideoAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  try {
    await saveWeeklyVideo(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, 'video', error);
  }
}

async function saveWeeklyVideo(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const script = optionalString(formData, 'script_en');
  const scenes = optionalString(formData, 'scenes_json');
  const captionsEn = optionalString(formData, 'captions_en');
  const captionsUk = optionalString(formData, 'captions_uk');
  const heygenProjectUrl = optionalString(formData, 'heygen_project_url');
  const heygenPreviewUrl = optionalString(formData, 'heygen_preview_url');
  const graphicsPreviewUrl = optionalString(formData, 'graphics_preview_url');
  const youtubeUrl = optionalString(formData, 'youtube_url');
  const suppliedVideoId = optionalString(formData, 'youtube_video_id');
  const thumbnailUrl = optionalString(formData, 'thumbnail_url');
  const durationSeconds = optionalNumber(formData, 'duration_seconds');
  const workflowStatus = optionalString(formData, 'workflow_status') || 'draft';
  const resultManifestJson = optionalString(formData, 'result_manifest_json');
  let savedDigestId: string | null = null;
  let saved = false;
  const persist = async (artifact: Parameters<typeof saveArtifact>[1]) => {
    savedDigestId = await saveArtifact(formData, artifact);
    saved = true;
  };

  if (resultManifestJson) {
    const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
    const revisionId = requiredString(formData, 'revision_id');
    const admin = getSupabaseAdmin();
    const { data: manifestArtifact, error: manifestError } = await admin
      .from('weekly_digest_artifacts')
      .select('content,review_status,is_current')
      .eq('weekly_digest_id', weeklyDigestId)
      .eq('revision_id', revisionId)
      .eq('artifact_type', 'video_manifest')
      .eq('slot_key', 'video-manifest:en')
      .eq('is_current', true)
      .maybeSingle();
    if (manifestError || !manifestArtifact || manifestArtifact.review_status !== 'approved') {
      throw new Error('Approve the current weekly-video-v3 manifest before importing a result.');
    }
    const manifestContent =
      manifestArtifact.content &&
      typeof manifestArtifact.content === 'object' &&
      !Array.isArray(manifestArtifact.content)
        ? (manifestArtifact.content as Record<string, Json | undefined>)
        : {};
    const expectedInputHash =
      typeof manifestContent.inputHash === 'string' ? manifestContent.inputHash : '';
    const result = validateWeeklyVideoResultManifest(
      parseJson(resultManifestJson, 'Video result manifest'),
      { digestId: weeklyDigestId, revisionId, inputHash: expectedInputHash },
    );
    await persist({
      type: 'video_final',
      locale: 'en',
      slot: 'video-final:en',
      externalUrl: result.youtube.url,
      provider: 'youtube',
      providerId: result.youtube.id,
      mimeType: 'text/html',
      durationSeconds: result.youtube.durationSeconds,
      metadata: {
        thumbnail_url: result.youtube.thumbnailUrl,
        published_at: result.youtube.publishedAt,
        workflow_status: 'published',
        audio_locale: 'en',
        manifest_input_hash: result.inputHash,
      },
    });
    for (const caption of result.captions) {
      await persist({
        type: 'captions',
        locale: caption.locale,
        slot: `captions:${caption.locale}`,
        content: { vtt: caption.vtt ?? null, url: caption.url ?? null },
        externalUrl: caption.url,
        mimeType: 'text/vtt',
        metadata: { manifest_input_hash: result.inputHash },
      });
    }
    await persist({
      type: 'thumbnail',
      locale: 'neutral',
      slot: 'video-thumbnail',
      externalUrl: result.youtube.thumbnailUrl,
      provider: 'youtube',
      providerId: result.youtube.id,
      mimeType: 'image/jpeg',
      metadata: { manifest_input_hash: result.inputHash },
    });
    revalidateWeeklyAdmin(weeklyDigestId);
    return;
  }

  if (youtubeUrl || suppliedVideoId || thumbnailUrl || captionsEn || captionsUk) {
    const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
    const revisionId = requiredString(formData, 'revision_id');
    const admin = getSupabaseAdmin();
    const { data: manifestArtifact, error: manifestError } = await admin
      .from('weekly_digest_artifacts')
      .select('content,review_status,is_current')
      .eq('weekly_digest_id', weeklyDigestId)
      .eq('revision_id', revisionId)
      .eq('artifact_type', 'video_manifest')
      .eq('slot_key', 'video-manifest:en')
      .eq('is_current', true)
      .maybeSingle();
    if (manifestError || !manifestArtifact || manifestArtifact.review_status !== 'approved') {
      throw new Error(
        'Approve the current weekly-video-v3 manifest before saving the final video.',
      );
    }
    const manifestContent =
      manifestArtifact.content &&
      typeof manifestArtifact.content === 'object' &&
      !Array.isArray(manifestArtifact.content)
        ? (manifestArtifact.content as Record<string, Json | undefined>)
        : {};
    const manifestInputHash =
      typeof manifestContent.inputHash === 'string' ? manifestContent.inputHash : null;
    const hashMeta = manifestInputHash ? { manifest_input_hash: manifestInputHash } : {};

    if (youtubeUrl || suppliedVideoId) {
      const normalized = normalizeYouTubeVideo(youtubeUrl || suppliedVideoId || '');
      if (!normalized) {
        throw new Error('Enter a valid YouTube URL or an 11-character video ID.');
      }
      const durationWasEntered = durationSeconds !== null;
      const resolvedDuration = durationWasEntered
        ? durationSeconds
        : await fetchYouTubeDurationSeconds(normalized.videoId);
      if (
        !resolvedDuration ||
        !Number.isInteger(resolvedDuration) ||
        resolvedDuration < 200 ||
        resolvedDuration > 1200
      ) {
        throw new Error(
          durationWasEntered
            ? 'Weekly YouTube duration must be an integer between 200 and 1200 seconds.'
            : "Couldn't auto-detect this video's duration from YouTube — enter it manually in the Duration (seconds) field.",
        );
      }
      const resolvedThumbnail =
        thumbnailUrl && thumbnailUrl.startsWith('https://')
          ? thumbnailUrl
          : normalized.thumbnailUrl;
      await persist({
        type: 'video_final',
        locale: 'en',
        slot: 'video-final:en',
        externalUrl: normalized.watchUrl,
        provider: 'youtube',
        providerId: normalized.videoId,
        mimeType: 'text/html',
        durationSeconds: resolvedDuration,
        metadata: {
          thumbnail_url: resolvedThumbnail,
          published_at: new Date().toISOString(),
          workflow_status: 'published',
          audio_locale: 'en',
          ...hashMeta,
        },
      });
      await persist({
        type: 'thumbnail',
        locale: 'neutral',
        slot: 'video-thumbnail',
        externalUrl: resolvedThumbnail,
        provider: 'youtube',
        providerId: normalized.videoId,
        mimeType: 'image/jpeg',
        metadata: hashMeta,
      });
    } else if (thumbnailUrl) {
      await persist({
        type: 'thumbnail',
        locale: 'neutral',
        slot: 'video-thumbnail',
        externalUrl: thumbnailUrl,
        metadata: hashMeta,
      });
    }

    for (const [locale, text] of [
      ['en', captionsEn],
      ['uk', captionsUk],
    ] as const) {
      if (!text) continue;
      await persist({
        type: 'captions',
        locale,
        slot: `captions:${locale}`,
        content: { vtt: text, url: null },
        mimeType: 'text/vtt',
        metadata: hashMeta,
      });
    }

    revalidateWeeklyAdmin(weeklyDigestId);
    return;
  }

  if (script || scenes) {
    const plan = await videoScriptPlanFromSave(formData, script, scenes);
    await persist({
      type: 'video_script',
      locale: 'en',
      slot: 'video-script:en',
      content: {
        script: plan.narration,
        // WeeklyVideoScript is the JSONB plan the worker already persisted.
        narration_plan: plan as unknown as Json,
      },
      metadata: { workflow_status: workflowStatus },
    });
  }
  if (heygenProjectUrl || heygenPreviewUrl) {
    await persist({
      type: 'heygen_preview',
      locale: 'en',
      slot: 'heygen-preview:en',
      externalUrl: heygenPreviewUrl || heygenProjectUrl,
      provider: 'heygen',
      metadata: { project_url: heygenProjectUrl || null, workflow_status: workflowStatus },
    });
  }
  if (graphicsPreviewUrl) {
    await persist({
      type: 'graphics_preview',
      locale: 'en',
      slot: 'graphics-preview:en',
      externalUrl: graphicsPreviewUrl,
      metadata: { workflow_status: workflowStatus },
    });
  }
  if (!saved || !savedDigestId) throw new Error('Enter at least one video field to save.');
  revalidateWeeklyAdmin(savedDigestId);
}

function redirectWeeklySocialError(weeklyDigestId: string, message: string): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=social&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

export async function saveWeeklySocialAction(formData: FormData) {
  const intent = optionalString(formData, 'intent') || 'save';
  const session = await requireSocialAdmin({
    roles: intent === 'approved' ? ['owner'] : ['owner', 'editor'],
  });
  const postId = requiredString(formData, 'social_post_id');
  const weeklyDigestIdHint = optionalString(formData, 'weekly_digest_id');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from('social_posts')
    .select(
      'package_id,channel,locale,meta,quality_report,publish_enabled,content_hash,content_parts',
    )
    .eq('id', postId)
    .maybeSingle();
  if (
    !post ||
    post.channel !== requiredString(formData, 'channel') ||
    post.locale !== requiredString(formData, 'locale')
  ) {
    throw new Error('The weekly social variant changed. Reload before saving.');
  }
  const { data: socialPackage } = post.package_id
    ? await admin
        .from('social_packages')
        .select('weekly_digest_id')
        .eq('id', post.package_id)
        .maybeSingle()
    : { data: null };
  const weeklyDigestId = socialPackage?.weekly_digest_id || weeklyDigestIdHint;
  if (!weeklyDigestId) {
    throw new Error('Weekly social package was not found.');
  }

  const fail = (message: string): never => redirectWeeklySocialError(weeklyDigestId, message);

  const channel = post.channel;
  if (!isSocialChannel(channel)) {
    fail('Unsupported social channel.');
    return;
  }
  const threadParts = [
    'content_part_1',
    'content_part_2',
    'content_part_3',
    'content_part_4',
    'content_part_5',
  ]
    .map((name) => optionalString(formData, name))
    .filter(Boolean);
  const parsed = parseChannelSocialSave({
    channel,
    postText: optionalString(formData, 'post_text'),
    firstComment: optionalString(formData, 'first_comment'),
    threadParts,
    existingCarousel:
      post.meta && typeof post.meta === 'object' && !Array.isArray(post.meta)
        ? (post.meta as Record<string, unknown>).instagram_carousel
        : null,
    existingParts: Array.isArray(post.content_parts)
      ? post.content_parts.filter((part): part is string => typeof part === 'string')
      : [],
  });
  if (!parsed.ok) fail(parsed.message);
  if (!parsed.ok) return;
  const saved = parsed.fields;

  const url = optionalString(formData, 'url');
  const utmUrl = optionalString(formData, 'utm_url');
  const currentMeta =
    post.meta && typeof post.meta === 'object' && !Array.isArray(post.meta)
      ? (post.meta as Record<string, Json | undefined>)
      : {};
  const priorQuality =
    post.quality_report &&
    typeof post.quality_report === 'object' &&
    !Array.isArray(post.quality_report)
      ? (post.quality_report as Record<string, Json | undefined>)
      : {};
  const linkedinDocumentStatus = optionalString(formData, 'linkedin_document_status');
  const linkedinDocumentNote = optionalString(formData, 'linkedin_document_note');
  if (
    post.channel === 'linkedin' &&
    !['not_started', 'draft_ready', 'ready', 'completed'].includes(linkedinDocumentStatus)
  ) {
    fail('Select a valid LinkedIn document checklist status.');
  }
  if (
    intent === 'approved' &&
    post.channel === 'linkedin' &&
    !['ready', 'completed'].includes(linkedinDocumentStatus)
  ) {
    fail('Prepare the manual LinkedIn PDF/document post before approval.');
  }
  for (const [label, value] of [
    ['URL', url],
    ['UTM URL', utmUrl],
  ] as const) {
    if (value && !/^https:\/\//i.test(value)) fail(`${label} must use HTTPS.`);
  }
  const userDb = await getSupabaseServer();
  const hookAngle =
    (typeof currentMeta.hook_angle === 'string' && currentMeta.hook_angle) ||
    (typeof priorQuality.hookAngle === 'string' && priorQuality.hookAngle) ||
    null;
  const hookCandidates = Array.isArray(currentMeta.hook_candidates)
    ? currentMeta.hook_candidates
    : Array.isArray(priorQuality.hookCandidates)
      ? priorQuality.hookCandidates
      : null;
  const writerMeta =
    (currentMeta.writer && typeof currentMeta.writer === 'object' ? currentMeta.writer : null) ??
    (priorQuality.writer && typeof priorQuality.writer === 'object' ? priorQuality.writer : null);
  // Authenticated UPDATEs on an already-approved row trip
  // guard_social_v2_owner_actions ("workflow RPC required") even when only
  // meta/url change. Service-role writes are the same path workers use.
  const { error: metadataError } = await admin
    .from('social_posts')
    .update({
      ...(url ? { url } : {}),
      ...(utmUrl ? { utm_url: utmUrl } : {}),
      meta: {
        ...currentMeta,
        ...(hookAngle ? { hook_angle: hookAngle } : {}),
        ...(hookCandidates ? { hook_candidates: hookCandidates } : {}),
        ...(writerMeta ? { writer: writerMeta } : {}),
        ...(post.channel === 'linkedin'
          ? {
              document_status: linkedinDocumentStatus,
              document_note: linkedinDocumentNote || null,
            }
          : {}),
        ...(post.channel === 'instagram' && saved.instagramCarousel
          ? { instagram_carousel: saved.instagramCarousel }
          : {}),
      } as Json,
    })
    .eq('id', postId);
  if (metadataError) fail(metadataError.message);

  const mapped = new FormData();
  mapped.set('id', postId);
  mapped.set('post_text', saved.postText);
  mapped.set('first_comment', saved.firstComment ?? '');
  mapped.set('content_parts_json', JSON.stringify(saved.contentParts));
  mapped.set('alt_text', optionalString(formData, 'alt_text'));
  // updateVariantAction performs the single DST-aware Europe/Kyiv → UTC conversion.
  mapped.set('scheduled_for', requiredString(formData, 'scheduled_for_local'));
  try {
    await updateVariantAction(mapped);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : 'Could not save the social variant.');
  }

  if (intent === 'approved') {
    const { data: refreshed } = await admin
      .from('social_posts')
      .select('quality_report,publish_enabled,content_hash')
      .eq('id', postId)
      .maybeSingle();
    const blockers = socialApprovalBlockers(
      refreshed?.quality_report &&
        typeof refreshed.quality_report === 'object' &&
        !Array.isArray(refreshed.quality_report)
        ? (refreshed.quality_report as unknown as QualityReport)
        : { blocking: [], warnings: [], checkedAt: new Date().toISOString() },
    ).map((issue) => issue.message);
    if (blockers.length > 0) {
      fail(`Cannot approve yet — fix quality blockers first: ${blockers.slice(0, 3).join(' · ')}`);
    }
    if (!refreshed?.publish_enabled) {
      fail('This channel is paused. Enable publishing before approving.');
    }
    if (!refreshed?.content_hash) {
      fail('Save the draft successfully before approving — content hash is missing.');
    }
    const { error } = await userDb.rpc('approve_social_post', {
      p_social_post_id: postId,
    });
    if (error) fail(error.message);
  }
  if (intent === 'changes_requested') {
    const note = requiredString(formData, 'review_note');
    if (note.length < 10 || note.length > 2000) {
      fail('A review note must contain 10 to 2000 characters.');
    }
    const { data: reviewedPost, error: reviewedPostError } = await admin
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single();
    if (reviewedPostError || !reviewedPost) {
      redirectWeeklySocialError(
        weeklyDigestId,
        'The updated social variant could not be loaded for review.',
      );
    }
    const { error } = await userDb.from('social_post_reviews').insert({
      social_post_id: reviewedPost.id,
      package_id: reviewedPost.package_id,
      reviewer_id: session.userId,
      action: 'rejected',
      content_version: reviewedPost.content_version,
      content_hash: reviewedPost.content_hash,
      snapshot: {
        channel: reviewedPost.channel,
        locale: reviewedPost.locale,
        post_text: reviewedPost.post_text,
        scheduled_for: reviewedPost.scheduled_for,
      } as Json,
      note,
    });
    if (error) fail(error.message);
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function commentWeeklySocialAction(formData: FormData) {
  await requireSocialAdmin();
  const postId = requiredString(formData, 'social_post_id');
  const note = requiredString(formData, 'note');
  if (note.length > 2000) throw new Error('A comment may contain at most 2000 characters.');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from('social_posts')
    .select('package_id')
    .eq('id', postId)
    .maybeSingle();
  if (!post?.package_id) throw new Error('Weekly social variant was not found.');
  const { data: socialPackage } = await admin
    .from('social_packages')
    .select('weekly_digest_id')
    .eq('id', post.package_id)
    .eq('kind', 'weekly_digest')
    .maybeSingle();
  if (!socialPackage?.weekly_digest_id) throw new Error('Weekly social package was not found.');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('comment_weekly_social_post', {
    p_social_post_id: postId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
}

export async function resumeWeeklyThreadsSequenceAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'], aal2: true });
  const postId = requiredString(formData, 'social_post_id');
  const db = await getSupabaseServer();
  const { data, error } = await db.rpc('resume_weekly_threads_sequence', {
    p_social_post_id: postId,
  });
  if (error) throw new Error(error.message);
  if (!data.package_id) throw new Error('The resumed Threads post has no social package.');
  const admin = getSupabaseAdmin();
  const { data: socialPackage } = await admin
    .from('social_packages')
    .select('weekly_digest_id')
    .eq('id', data.package_id)
    .maybeSingle();
  if (socialPackage?.weekly_digest_id) revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
}

export async function toggleWeeklySocialAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const postId = requiredString(formData, 'social_post_id');
  const enabled = requiredString(formData, 'publish_enabled') === 'true';
  const reason = optionalString(formData, 'disabled_reason');
  const db = await getSupabaseServer();
  const { data, error } = await db.rpc('set_weekly_social_publish_enabled', {
    p_social_post_id: postId,
    p_enabled: enabled,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  const post = Array.isArray(data) ? data[0] : data;
  const packageId =
    post && typeof post === 'object' && 'package_id' in post ? post.package_id : null;
  if (typeof packageId === 'string') {
    const admin = getSupabaseAdmin();
    const { data: socialPackage } = await admin
      .from('social_packages')
      .select('weekly_digest_id')
      .eq('id', packageId)
      .maybeSingle();
    if (socialPackage?.weekly_digest_id) revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
  }
}

/**
 * Promotes an alternate illustration render to primary (PR5, editorial
 * quality overhaul). `generateStoryImage` (generation-worker.ts) uploads
 * story_image's alternates into `content.preview_paths` -- the same generic
 * mechanism the PDF job already uses for page previews -- rather than as
 * separate artifact rows, since `weekly_digest_artifacts` only supports one
 * `is_current` row per slot_key and every downstream reader (digests.ts,
 * pdf.ts) looks up `story_image` by revision_item_id expecting exactly one
 * match. Promoting just swaps which already-uploaded file is primary; no new
 * render, no new upload.
 */
export async function selectWeeklyArtifactVariantAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const artifactId = requiredString(formData, 'artifact_id');
  const variantPath = requiredString(formData, 'variant_path');
  const fail = (message: string): never => redirectWeeklyVisualsError(weeklyDigestId, message);

  await rejectVisualRefreshAssetMutation(weeklyDigestId, revisionId);

  const admin = getSupabaseAdmin();
  const { data: artifact } = await admin
    .from('weekly_digest_artifacts')
    .select('*')
    .eq('id', artifactId)
    .maybeSingle();
  if (!artifact || artifact.artifact_type !== 'story_image') {
    return fail('Story image artifact was not found.');
  }
  const content = jsonRecord(artifact.content);
  const previewPaths = Array.isArray(content.preview_paths)
    ? content.preview_paths.filter((value): value is string => typeof value === 'string')
    : [];
  if (!artifact.storage_path || !previewPaths.includes(variantPath)) {
    return fail('The selected variant is no longer available -- reload and try again.');
  }
  const nextPreviewPaths = [
    artifact.storage_path,
    ...previewPaths.filter((path) => path !== variantPath),
  ];

  const priorMeta = jsonRecord(artifact.metadata);
  const priorScores = Array.isArray(priorMeta.variant_scores) ? priorMeta.variant_scores : [];
  const priorConcepts = Array.isArray(priorMeta.variant_concepts) ? priorMeta.variant_concepts : [];
  // Promote selected alternate: score and concept rows must move with its bytes.
  const promotedAltIndex = previewPaths.indexOf(variantPath);
  const promoteRows = (entries: Json[]) => {
    if (entries.length === 0 || promotedAltIndex < 0) return entries;
    const fromIndex = promotedAltIndex + 1; // 0 = old primary
    const rows = entries.map((entry) => jsonRecord(entry));
    const promoted = rows[fromIndex] ?? rows[0];
    const demotedPrimary = rows[0];
    const rest = rows.filter((_, i) => i !== 0 && i !== fromIndex);
    return [promoted, demotedPrimary, ...rest]
      .filter(Boolean)
      .map((row, index) => ({ ...row, index }));
  };
  const nextScores = promoteRows(priorScores);
  const nextConcepts = promoteRows(priorConcepts);
  const primaryConcept = jsonRecord(nextConcepts[0]);

  const db = await getSupabaseServer();
  const { error } = await db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_revision_item_id: artifact.revision_item_id,
    p_artifact_type: 'story_image',
    p_locale: artifact.locale,
    p_slot_key: artifact.slot_key,
    p_content: { ...content, preview_paths: nextPreviewPaths } as Json,
    p_storage_bucket: artifact.storage_bucket,
    p_storage_path: variantPath,
    p_mime_type: artifact.mime_type,
    p_width: artifact.width,
    p_height: artifact.height,
    // byte_size can drift slightly from the promoted file's true size -- it
    // is copied from the prior artifact rather than re-fetched from storage.
    p_byte_size: artifact.byte_size,
    p_metadata: {
      ...priorMeta,
      pick_source: 'owner',
      ...(typeof primaryConcept.scene === 'string' ? { scene: primaryConcept.scene } : {}),
      ...(typeof primaryConcept.scene_source === 'string'
        ? { scene_source: primaryConcept.scene_source }
        : {}),
      ...(typeof primaryConcept.positive_prompt === 'string'
        ? { positive_prompt: primaryConcept.positive_prompt }
        : {}),
      ...(typeof primaryConcept.negative_prompt === 'string'
        ? { negative_prompt: primaryConcept.negative_prompt }
        : {}),
      ...(typeof primaryConcept.concept_lens === 'string'
        ? { concept_lens: primaryConcept.concept_lens }
        : {}),
      ...(typeof primaryConcept.metaphor_title === 'string'
        ? { metaphor_title: primaryConcept.metaphor_title }
        : {}),
      ...(typeof primaryConcept.motif_class === 'string'
        ? { motif_class: primaryConcept.motif_class }
        : {}),
      ...(typeof primaryConcept.subject_kind === 'string'
        ? { subject_kind: primaryConcept.subject_kind }
        : {}),
      ...(typeof primaryConcept.composition === 'string'
        ? { composition: primaryConcept.composition }
        : {}),
      ...(nextScores.length ? { variant_scores: nextScores } : {}),
      ...(nextConcepts.length ? { variant_concepts: nextConcepts } : {}),
    } as Json,
  });
  if (error) fail(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function enqueueWeeklyGenerationAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabForJobType(optionalString(formData, 'job_type'));
  try {
    await enqueueWeeklyGeneration(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function enqueueWeeklyGeneration(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const jobType = requiredString(formData, 'job_type');
  const allowed = new Set([
    'research_pack',
    'editorial_master',
    'social_copy',
    'video_script',
    'video_manifest',
    'pdf',
    'cover',
    'story_image',
    'social_asset',
  ]);
  if (!allowed.has(jobType)) throw new Error('Unsupported Weekly Digest generation job.');
  const slotKey = optionalString(formData, 'slot_key');
  const locale = optionalString(formData, 'locale') || 'neutral';
  const revisionItemId = optionalString(formData, 'revision_item_id');
  const requestKey = optionalString(formData, 'request_key') || randomUUID();
  const admin = getSupabaseAdmin();
  const { data: targetRevision, error: targetRevisionError } = await admin
    .from('weekly_digest_revisions')
    .select('visual_refresh_source_revision_id')
    .eq('id', revisionId)
    .eq('weekly_digest_id', weeklyDigestId)
    .maybeSingle();
  if (targetRevisionError) throw new Error(targetRevisionError.message);
  if (targetRevision && isWeeklyVisualRefreshRevision(targetRevision)) {
    await requireSocialAdmin({ roles: ['owner'], aal2: true });
    if (!isWeeklyVisualRefreshPromptJobType(jobType)) {
      throw new Error('A visual refresh draft can queue only cover or story prompt jobs.');
    }
    const db = await getSupabaseServer();
    const { data: queuedJob, error } = await db.rpc('queue_weekly_visual_refresh_prompt_job', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: revisionId,
      p_job_type: jobType,
      p_revision_item_id: jobType === 'story_image' ? revisionItemId || null : null,
      p_idempotency_key: `weekly:visual-refresh:${weeklyDigestId}:${revisionId}:${jobType}:${revisionItemId || 'cover'}:${requestKey}`,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    if (backendForGenerationJob(jobType) === 'github_actions' && queuedJob?.id) {
      await dispatchQueuedWeeklyGenerationJob(queuedJob.id);
    }
    revalidateWeeklyAdmin(weeklyDigestId);
    return;
  }
  const contentStudioMode = ['research_pack', 'editorial_master'].includes(jobType)
    ? weeklyContentStudioMode()
    : null;
  if (contentStudioMode === 'off') {
    throw new Error('WEEKLY_CONTENT_STUDIO_V2 is off. Enable shadow or production mode first.');
  }
  const input = {
    slot_key: slotKey || null,
    locale,
    revision_item_id: revisionItemId || null,
    source_url: optionalString(formData, 'source_url') || null,
    alt_text: optionalString(formData, 'alt_text') || null,
    // Owner-edited direction (Visuals tab): kept as concept #1 while the art
    // director proposes two structurally different alternatives.
    scene_override: optionalString(formData, 'scene_override') || null,
    ...(contentStudioMode ? { mode: contentStudioMode } : {}),
  };
  const db = await getSupabaseServer();
  const { data: queuedJob, error } = await db.rpc('queue_weekly_digest_generation_job', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_job_type: jobType,
    p_idempotency_key: `weekly:${weeklyDigestId}:${revisionId}:${jobType}:${slotKey}:${requestKey}`,
    p_input: input as Json,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  if (jobType === 'video_script') {
    await ensureVideoManifestCompanionJob(db, weeklyDigestId, revisionId);
  }
  if (backendForGenerationJob(jobType) === 'github_actions' && queuedJob?.id) {
    try {
      await dispatchQueuedWeeklyGenerationJob(queuedJob.id);
    } catch (dispatchError) {
      if (isRetryableGithubDispatchError(dispatchError)) {
        console.error(
          '[weekly-generation] GitHub dispatch deferred after enqueue',
          dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        );
      } else {
        throw dispatchError;
      }
    }
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * A published Weekly Digest is never edited in place. This RPC creates and
 * activates a private, prompt-only working revision; public readers keep the
 * immutable `published_revision_id` until a future explicit release flow.
 */
export async function createWeeklyVisualRefreshDraftAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'], aal2: true });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const db = await getSupabaseServer();
  const { data: revisionId, error } = await db.rpc('create_weekly_visual_refresh_draft', {
    p_weekly_digest_id: weeklyDigestId,
  });
  if (error) throw new Error(error.message);
  if (typeof revisionId !== 'string' || !revisionId) {
    throw new Error('Visual refresh draft RPC did not return a revision ID.');
  }

  // story_image uses the dedicated GitHub worker. Cover is a short Vercel
  // prompt job; it remains queued for the normal worker poll.
  const { data: storyJobs, error: storyJobsError } = await getSupabaseAdmin()
    .from('weekly_digest_generation_jobs')
    .select('id')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', revisionId)
    .eq('job_type', 'story_image')
    .eq('status', 'queued');
  if (storyJobsError) throw new Error(storyJobsError.message);
  for (const job of storyJobs ?? []) {
    await dispatchQueuedWeeklyGenerationJob(job.id);
  }

  revalidateWeeklyAdmin(weeklyDigestId);
  redirect(weeklyVisualRefreshDirectionHref({ weeklyDigestId, revisionId }));
}

/**
 * video_manifest is supposed to sit in `waiting` from post-master queue.
 * Linked retry / Generate script does not recreate that row, so enqueueing
 * the script also upserts the stable companion key.
 */
async function ensureVideoManifestCompanionJob(
  db: Awaited<ReturnType<typeof getSupabaseServer>>,
  weeklyDigestId: string,
  revisionId: string,
) {
  const { error } = await db.rpc('queue_weekly_digest_generation_job', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_job_type: 'video_manifest',
    p_idempotency_key: contentStudioVideoManifestKey({
      digestId: weeklyDigestId,
      revisionId,
    }),
    p_input: { locale: 'en', slot_key: 'video-manifest:en' } as Json,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

/**
 * Re-runs the writer/critic loop for the active revision without re-doing
 * research from scratch. A successful editorial_master job always mints and
 * activates a *new* revision (createMasterRevision in generation-worker.ts),
 * so approved research_pack artifacts -- scoped to the revision they were
 * approved under -- never carry forward to that new revision on their own.
 * Without this copy step, editorial_master's dependency gate
 * (weekly_generation_waiting_reason) would stay unmet forever and the job
 * would sit in `waiting`. Copies each Top 3 story's most recently approved
 * research_pack (matched by brief_item_id, since revision_item IDs are
 * reissued per revision) onto the current active revision, owner-approved
 * in the same write -- save_weekly_digest_artifact only allows
 * review_status='approved' for a real owner session, never service_role.
 */
export async function regenerateWeeklyMasterAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab') || 'fixes');
  try {
    await regenerateWeeklyMaster(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function regenerateWeeklyMaster(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const contentStudioMode = weeklyContentStudioMode();
  if (contentStudioMode === 'off') {
    throw new Error('WEEKLY_CONTENT_STUDIO_V2 is off. Enable shadow or production mode first.');
  }
  const db = await getSupabaseServer();
  const { data: approvedQuality, error: qualityError } = await db
    .from('weekly_digest_artifacts')
    .select('id')
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'content_quality_report')
    .eq('is_current', true)
    .eq('review_status', 'approved')
    .maybeSingle();
  if (qualityError) throw new Error(qualityError.message);
  if (approvedQuality) {
    throw new Error(
      'Master quality is already approved. That decision stands. Warnings do not require another writer/critic pass. Open Fixes & blockers to start visuals, social and PDF if they never queued.',
    );
  }

  const { data: items, error: itemsError } = await db
    .from('weekly_digest_revision_items')
    .select('id,brief_item_id,rank')
    .eq('revision_id', revisionId)
    .order('rank');
  if (itemsError) throw new Error(itemsError.message);
  const featureItems = (items ?? []).filter(
    (item): item is typeof item & { brief_item_id: string } =>
      item.rank <= 3 && Boolean(item.brief_item_id),
  );
  if (featureItems.length !== 3) {
    throw new Error('The active revision needs exactly three Top 3 feature stories.');
  }

  const { data: approvedResearch, error: researchError } = await db
    .from('weekly_digest_artifacts')
    .select('revision_item_id,content,metadata,provider,provider_id,created_at')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('artifact_type', 'research_pack')
    .eq('is_current', true)
    .eq('review_status', 'approved')
    .eq('generation_status', 'ready')
    .order('created_at', { ascending: false });
  if (researchError) throw new Error(researchError.message);

  const researchRevisionItemIds = [
    ...new Set((approvedResearch ?? []).map((artifact) => artifact.revision_item_id)),
  ].filter((id): id is string => Boolean(id));
  const { data: researchItems, error: researchItemsError } =
    researchRevisionItemIds.length > 0
      ? await db
          .from('weekly_digest_revision_items')
          .select('id,brief_item_id')
          .in('id', researchRevisionItemIds)
      : { data: [], error: null };
  if (researchItemsError) throw new Error(researchItemsError.message);
  const briefItemIdByResearchItem = new Map(
    (researchItems ?? []).map((item) => [item.id, item.brief_item_id]),
  );

  // approvedResearch is already sorted newest-first, so the first hit per
  // brief_item_id is the most recently approved one.
  const latestResearchByBriefItemId = new Map<string, (typeof approvedResearch)[number]>();
  for (const artifact of approvedResearch ?? []) {
    const briefItemId = artifact.revision_item_id
      ? briefItemIdByResearchItem.get(artifact.revision_item_id)
      : null;
    if (!briefItemId || latestResearchByBriefItemId.has(briefItemId)) continue;
    latestResearchByBriefItemId.set(briefItemId, artifact);
  }

  const missing = featureItems.filter(
    (item) => !latestResearchByBriefItemId.has(item.brief_item_id),
  );
  if (missing.length > 0) {
    throw new Error(
      `No previously approved research found for ${missing.length} of 3 Top stories. Use "Start / retry Content Studio" to generate and approve research for this revision first.`,
    );
  }

  for (const item of featureItems) {
    const research = latestResearchByBriefItemId.get(item.brief_item_id)!;
    const { error: copyError } = await db.rpc('save_weekly_digest_artifact', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: revisionId,
      p_artifact_type: 'research_pack',
      p_locale: 'neutral',
      p_slot_key: `research:${item.id}`,
      p_revision_item_id: item.id,
      p_generation_status: 'ready',
      p_review_status: 'approved',
      p_content: research.content as Json,
      p_provider: research.provider,
      p_provider_id: research.provider_id,
      p_metadata: research.metadata as Json,
    });
    if (copyError) throw new Error(copyError.message);
  }

  // Reuse a non-terminal editorial_master job already sitting on this
  // revision instead of piling up a duplicate -- most commonly a job stuck
  // in `waiting` from an earlier click before research was copied.
  const { data: existingJobs, error: existingJobsError } = await db
    .from('weekly_digest_generation_jobs')
    .select('id,status')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', revisionId)
    .eq('job_type', 'editorial_master')
    .in('status', ['queued', 'waiting', 'dispatching', 'running', 'retry_scheduled'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingJobsError) throw new Error(existingJobsError.message);
  const existingJob = existingJobs?.[0] ?? null;

  let jobIdToDispatch: string | null;
  if (existingJob) {
    if (existingJob.status === 'waiting') {
      // The dependency gate normally re-evaluates on the next periodic sweep
      // (reap_stale_weekly_digest_generation_attempts, invoked every 5
      // minutes by /api/internal/weekly/generate) -- nudge it now instead of
      // waiting. Only service_role may call this, hence the admin client.
      // Cast needed: this control-plane RPC postdates the last
      // `database.types.ts` generation (same pattern as generation-worker.ts's
      // UntypedRpcClient).
      const untypedAdmin = getSupabaseAdmin() as unknown as {
        rpc(name: string): Promise<{ error: { message: string } | null }>;
      };
      const { error: refreshError } = await untypedAdmin.rpc(
        'refresh_weekly_digest_generation_waiting_states',
      );
      if (refreshError) throw new Error(refreshError.message);
    }
    jobIdToDispatch = existingJob.id;
  } else {
    const requestKey = randomUUID();
    const { data: queuedJob, error: queueError } = await db.rpc(
      'queue_weekly_digest_generation_job',
      {
        p_weekly_digest_id: weeklyDigestId,
        p_revision_id: revisionId,
        p_job_type: 'editorial_master',
        p_idempotency_key: `weekly:${weeklyDigestId}:${revisionId}:editorial_master:regenerate:${requestKey}`,
        p_input: { mode: contentStudioMode } as Json,
      },
    );
    if (queueError && !/duplicate|unique/i.test(queueError.message)) {
      throw new Error(queueError.message);
    }
    jobIdToDispatch = queuedJob?.id ?? null;
  }
  if (jobIdToDispatch) await dispatchQueuedWeeklyGenerationJob(jobIdToDispatch);
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Starts a new, explicitly linked master job from a failed job's durable
 * bilingual checkpoint. This is intentionally not the generic job retry:
 * retrying a failed quality gate with new guidance can invalidate hashes and
 * otherwise re-run the expensive EN and UK writers.
 */
export async function resumeWeeklyMasterFromCheckpointAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab') || 'fixes');
  try {
    await resumeWeeklyMasterFromCheckpoint(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function resumeWeeklyMasterFromCheckpoint(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const sourceJobId = requiredString(formData, 'source_job_id');
  const contentStudioMode = weeklyContentStudioMode();
  if (contentStudioMode === 'off') {
    throw new Error('WEEKLY_CONTENT_STUDIO_V2 is off. Enable shadow or production mode first.');
  }
  const db = await getSupabaseServer();
  const [{ data: digest, error: digestError }, { data: source, error: sourceError }] =
    await Promise.all([
      db
        .from('weekly_digests')
        .select('id,active_revision_id')
        .eq('id', weeklyDigestId)
        .maybeSingle(),
      db
        .from('weekly_digest_generation_jobs')
        .select('id,weekly_digest_id,revision_id,job_type,status,output')
        .eq('id', sourceJobId)
        .maybeSingle(),
    ]);
  if (digestError) throw new Error(digestError.message);
  if (sourceError) throw new Error(sourceError.message);
  if (!digest?.active_revision_id) throw new Error('Weekly Digest has no active revision.');
  const revisionId = digest.active_revision_id;
  if (
    !source ||
    source.job_type !== 'editorial_master' ||
    // A run that stopped on unresolved quality items now finishes as
    // `succeeded`, and that is the case an owner most often wants to resume.
    !['failed', 'cancelled', 'succeeded'].includes(source.status) ||
    source.weekly_digest_id !== weeklyDigestId ||
    source.revision_id !== revisionId ||
    !hasResumableMasterState(source.output)
  ) {
    throw new Error(
      'This job is not a finished master with saved editorial segments for the active revision.',
    );
  }

  const activeStatuses = ['queued', 'waiting', 'dispatching', 'running', 'retry_scheduled'];
  const { data: activeJobs, error: activeJobsError } = await db
    .from('weekly_digest_generation_jobs')
    .select('id,status,input')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', revisionId)
    .eq('job_type', 'editorial_master')
    .in('status', activeStatuses)
    .order('created_at', { ascending: false })
    .limit(1);
  if (activeJobsError) throw new Error(activeJobsError.message);
  const activeJob = activeJobs?.[0] ?? null;
  const activeResumeSource = activeJob ? jsonRecord(activeJob.input)?.resume_from_job_id : null;
  if (activeJob && activeResumeSource !== sourceJobId) {
    throw new Error(
      'Another master generation is already active for this revision. Wait for it to finish.',
    );
  }

  let jobIdToDispatch: string | null = activeJob?.id ?? null;
  if (!jobIdToDispatch) {
    const { data: queuedJob, error: queueError } = await db.rpc(
      'queue_weekly_digest_generation_job',
      {
        p_weekly_digest_id: weeklyDigestId,
        p_revision_id: revisionId,
        p_job_type: 'editorial_master',
        p_idempotency_key: `weekly:${weeklyDigestId}:${revisionId}:editorial_master:resume:${sourceJobId}:${randomUUID()}`,
        p_input: { mode: contentStudioMode, resume_from_job_id: sourceJobId } as Json,
      },
    );
    if (queueError && !/duplicate|unique/i.test(queueError.message)) {
      throw new Error(queueError.message);
    }
    jobIdToDispatch = queuedJob?.id ?? null;
  }
  if (!jobIdToDispatch) throw new Error('Could not queue the master recovery job.');
  await dispatchQueuedWeeklyGenerationJob(jobIdToDispatch);
  revalidateWeeklyAdmin(weeklyDigestId);
}

function redirectWeeklyRevisionRestoreError(weeklyDigestId: string, message: string): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=overview&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

async function revertWeeklyDigestRevision(input: {
  weeklyDigestId: string;
  targetRevisionId: string;
  reason: string;
}) {
  const db = await getSupabaseServer();
  const { error } = await db.rpc('revert_weekly_digest_revision', {
    p_weekly_digest_id: input.weeklyDigestId,
    p_target_revision_id: input.targetRevisionId,
    p_reason: input.reason,
  });
  if (error) redirectWeeklyRevisionRestoreError(input.weeklyDigestId, error.message);
  // Best-effort: historical inactive drafts left content_quality_report on
  // the revision that just went inactive (quality-report-carryover.ts).
  // New master runs attach the report to the activated revision themselves.
  try {
    await carryOverOrphanedQualityReport(db, input.weeklyDigestId);
  } catch (carryOverError) {
    console.error('[revertWeeklyDigestRevision] quality report carry-over', carryOverError);
  }
  revalidateWeeklyAdmin(input.weeklyDigestId);
}

/**
 * One-click switch to the newest unused revision. No typed reason: this is
 * the expected "make the latest work the working copy" action, not an undo.
 * Errors redirect with `save_error` rather than throwing — a bare throw
 * from a Server Action renders as Minified React error #441 (live 2026-08-10).
 */
export async function useLatestWeeklyDigestRevisionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const targetRevisionId = requiredString(formData, 'target_revision_id');
  await revertWeeklyDigestRevision({
    weeklyDigestId,
    targetRevisionId,
    reason: USE_LATEST_REVISION_REASON,
  });
}

// Go back to an earlier revision. Requires a reason because this is an undo,
// not the default "use latest" path.
export async function restoreWeeklyDigestRevisionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const targetRevisionId = requiredString(formData, 'target_revision_id');
  const reason = requiredString(formData, 'reason');
  if (reason.length < 10 || reason.length > 500) {
    redirectWeeklyRevisionRestoreError(
      weeklyDigestId,
      'A 10 to 500 character reason is required to go back to an earlier version.',
    );
  }
  await revertWeeklyDigestRevision({
    weeklyDigestId,
    targetRevisionId,
    reason,
  });
}

function redirectWeeklyQualityCarryOverError(weeklyDigestId: string, message: string): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=research&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

/**
 * Manual fallback for the same healing carryOverOrphanedQualityReport does
 * automatically inside restoreWeeklyDigestRevisionAction — needed for any
 * digest that was already restored before that automatic call existed, and
 * as a visible recovery path if the automatic one ever silently no-ops.
 * Surfaced only on the Research tab's "Master quality" panel, and only when
 * workspace.orphanedQualityReport shows there is actually something to
 * attach.
 */
export async function carryOverWeeklyQualityReportAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const db = await getSupabaseServer();
  // redirect() throws internally, so it must never fire from inside this
  // try -- a surrounding catch here would swallow that throw as if it were
  // a real failure and redirect a second time with a useless message.
  let result: Awaited<ReturnType<typeof carryOverOrphanedQualityReport>> | null = null;
  let failureMessage: string | null = null;
  try {
    result = await carryOverOrphanedQualityReport(db, weeklyDigestId);
  } catch (error) {
    failureMessage =
      error instanceof Error ? error.message : 'The quality report could not be attached.';
  }
  if (failureMessage) redirectWeeklyQualityCarryOverError(weeklyDigestId, failureMessage);
  if (result?.status === 'nothing_to_carry') {
    redirectWeeklyQualityCarryOverError(
      weeklyDigestId,
      'No earlier Master quality report was found to attach.',
    );
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Re-runs story selection for this digest against the current selector and
 * mints a new active revision. Owner-only and destructive by design: the
 * digest returns to `in_review` and every downstream approval is cleared,
 * because a different story set invalidates the research, article and images
 * attached to the previous revision.
 */
export async function rebuildWeeklySelectionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  let result;
  try {
    result = await rebuildWeeklySelection(weeklyDigestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The selection could not be rebuilt.';
    redirectWeeklyRevisionRestoreError(weeklyDigestId, message);
  }
  revalidateWeeklyAdmin(weeklyDigestId);
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=overview&rebuilt=${encodeURIComponent(
      `${result.selectedCount}:${result.addedCount}:${result.removedCount}`,
    )}`,
  );
}

export async function startWeeklyContentStudioAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  // Owner retry after succeeded packs must mint new jobs; the composer path
  // (`startWeeklyContentStudio`) keeps the stable idempotency key.
  await retryWeeklyContentStudio(weeklyDigestId, revisionId);
  revalidateWeeklyAdmin(weeklyDigestId);
}

// Long LLM jobs are dispatched one-at-a-time to GitHub Actions. PostgreSQL
// creates a dispatch token first, so this action never drains an unrelated job.
export async function dispatchWeeklyMasterCliAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  await dispatchQueuedWeeklyGenerationJob();
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function retryWeeklyGenerationJobAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab') || 'fixes');
  try {
    await retryWeeklyGenerationJob(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function retryWeeklyGenerationJob(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const jobId = requiredString(formData, 'job_id');
  const db = await getSupabaseServer();
  const { data: retryJob, error } = await db.rpc('retry_weekly_digest_generation_job', {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
  if (retryJob.execution_backend === 'github_actions') {
    await dispatchQueuedWeeklyGenerationJob(retryJob.id);
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function ensureWeeklyPostMasterJobsAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const tab = weeklyWorkspaceTabFromFormValue(optionalString(formData, 'workspace_tab') || 'fixes');
  try {
    await ensureWeeklyPostMasterJobs(formData);
  } catch (error) {
    failWeeklyWorkspace(weeklyDigestId, tab, error);
  }
}

async function ensureWeeklyPostMasterJobs(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const admin = getSupabaseAdmin();
  const { data: quality, error: qualityError } = await admin
    .from('weekly_digest_artifacts')
    .select('content,review_status')
    .eq('revision_id', revisionId)
    .eq('artifact_type', 'content_quality_report')
    .eq('is_current', true)
    .maybeSingle();
  if (qualityError) throw new Error(qualityError.message);
  const approved = quality?.review_status === 'approved';
  if (!approved && qualityReportForbidsApprove(quality?.content)) {
    throw new Error(
      'Coded quality blockers remain. Approve Master quality to proceed, or open Fixes & blockers for a writer/critic pass. Warnings never block this queue.',
    );
  }
  await queuePostMasterJobsForRevision(weeklyDigestId, revisionId);
  try {
    await dispatchQueuedWeeklyGenerationJob();
  } catch (dispatchError) {
    console.error(
      '[weekly-generation] immediate GitHub dispatch failed',
      dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
    );
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function uploadWeeklyArtifactAction(formData: FormData) {
  const weeklyDigestId = optionalString(formData, 'weekly_digest_id');
  const artifactTypeHint = optionalString(formData, 'artifact_type');
  try {
    await uploadWeeklyArtifact(formData);
  } catch (error) {
    failWeeklyWorkspace(
      weeklyDigestId,
      weeklyWorkspaceTabForArtifactType(artifactTypeHint || 'story_image'),
      error,
    );
  }
}

async function uploadWeeklyArtifact(formData: FormData) {
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const isVisualRefresh = await isVisualRefreshAssetRevision(weeklyDigestId, revisionId);
  if (isVisualRefresh) {
    await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  } else {
    await requireSocialAdmin({ roles: ['owner', 'editor'] });
  }
  const artifactType = requiredString(formData, 'artifact_type');
  const slotKey = requiredString(formData, 'slot_key');
  const localeValue = optionalString(formData, 'locale') || 'neutral';
  if (!['neutral', 'en', 'uk'].includes(localeValue)) throw new Error('Invalid artifact locale.');
  const locale = localeValue as 'neutral' | 'en' | 'uk';
  const revisionItemId = optionalString(formData, 'revision_item_id');
  const fileValue = formData.get('file');
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    throw new Error('Select a replacement file.');
  }
  if (fileValue.size > WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES) {
    throw new Error('Replacement files are limited to 12 MB.');
  }
  if (!['cover', 'story_image', 'social_asset', 'thumbnail', 'pdf'].includes(artifactType)) {
    throw new Error('This artifact type cannot be uploaded. Final video remains on YouTube.');
  }
  if (
    isVisualRefresh &&
    (artifactType !== 'cover' || revisionItemId || locale !== 'neutral') &&
    (artifactType !== 'story_image' || !revisionItemId || locale !== 'neutral')
  ) {
    throw new Error(
      'A visual refresh may stage only a neutral cover or one neutral story illustration.',
    );
  }

  let bytes: Buffer = Buffer.from(await fileValue.arrayBuffer());
  let mimeType: string;
  let width: number | null = null;
  let height: number | null = null;
  let extension: string;
  if (artifactType === 'pdf') {
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('The file is not a PDF.');
    if (locale === 'neutral') throw new Error('A replacement PDF requires an EN or UK locale.');
    mimeType = 'application/pdf';
    extension = 'pdf';
  } else {
    const focalPoint = optionalString(formData, 'focal_point') || 'attention';
    const dimensions =
      artifactType === 'thumbnail'
        ? { width: 1280, height: 720 }
        : artifactType === 'social_asset'
          ? {
              width: Math.max(320, Math.min(optionalNumber(formData, 'width') ?? 1200, 1920)),
              height: Math.max(320, Math.min(optionalNumber(formData, 'height') ?? 630, 1920)),
            }
          : { width: 1600, height: 900 };
    try {
      if (artifactType === 'story_image') {
        bytes = await encodeSiteWebp(bytes, {
          width: dimensions.width,
          height: dimensions.height,
          position: focalPoint,
        });
        mimeType = SITE_IMAGE_CONTENT_TYPE;
        extension = SITE_IMAGE_EXTENSION;
      } else {
        bytes = await sharp(bytes)
          .rotate()
          .resize(dimensions.width, dimensions.height, {
            // Covers may arrive in a source aspect ratio that does not match
            // the public 16:9 hero. Preserve the editorial subject on a
            // branded canvas rather than silently crop it during upload.
            fit: artifactType === 'cover' ? 'contain' : 'cover',
            position: focalPoint,
            background: { r: 16, g: 20, b: 24 },
          })
          .flatten({ background: { r: 16, g: 20, b: 24 } })
          .jpeg({ quality: 91, progressive: true })
          .toBuffer();
        mimeType = 'image/jpeg';
        extension = 'jpg';
      }
    } catch {
      throw new Error('The replacement is not a supported image.');
    }
    width = dimensions.width;
    height = dimensions.height;
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const path = `digests/${weeklyDigestId}/revisions/${revisionId}/uploads/binary-v2/${artifactType}/${sha256}.${extension}`;
  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage
    .from('weekly-digest-private')
    .upload(path, storageBlob(bytes, mimeType), {
      contentType: mimeType,
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(uploadError.message);
  }
  const { data: stored, error: verifyError } = await admin.storage
    .from('weekly-digest-private')
    .download(path);
  if (verifyError || !stored) {
    throw new Error(`Upload verification failed: ${verifyError?.message ?? 'empty file'}`);
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
    throw new Error('Upload verification failed: stored bytes do not match the selected file.');
  }
  const uploadMetadata = mergeOwnerFeedbackOntoImageMetadata(
    {
      source: 'manual_upload',
      original_name: fileValue.name,
      focal_point: optionalString(formData, 'focal_point') || null,
      sha256,
      ...(artifactType === 'story_image' || artifactType === 'cover'
        ? { post_upload_qa: POST_UPLOAD_QA_PENDING }
        : {}),
    },
    await loadPromptSetOwnerFeedback({
      weeklyDigestId,
      revisionId,
      artifactType,
      revisionItemId: revisionItemId || null,
    }),
  );
  const db = await getSupabaseServer();
  const content = {
    alt: optionalString(formData, 'alt_text') || null,
    alt_en: optionalString(formData, 'alt_text_en') || null,
    alt_uk: optionalString(formData, 'alt_text_uk') || null,
  } as Json;
  const { data: artifactId, error } = isVisualRefresh
    ? await db.rpc('save_weekly_visual_refresh_staged_asset', {
        p_weekly_digest_id: weeklyDigestId,
        p_revision_id: revisionId,
        p_revision_item_id: revisionItemId || null,
        p_artifact_type: artifactType,
        p_locale: locale,
        p_slot_key: slotKey,
        p_content: content,
        p_storage_bucket: 'weekly-digest-private',
        p_storage_path: path,
        p_mime_type: mimeType,
        p_width: width ?? 0,
        p_height: height ?? 0,
        p_byte_size: bytes.length,
        p_metadata: uploadMetadata as unknown as Json,
      })
    : await db.rpc('save_weekly_digest_artifact', {
        p_weekly_digest_id: weeklyDigestId,
        p_revision_id: revisionId,
        p_revision_item_id: revisionItemId || null,
        p_artifact_type: artifactType,
        p_locale: locale,
        p_slot_key: slotKey,
        p_generation_status: 'ready',
        p_review_status: 'in_review',
        p_content: content,
        p_storage_bucket: 'weekly-digest-private',
        p_storage_path: path,
        p_mime_type: mimeType,
        p_width: width,
        p_height: height,
        p_byte_size: bytes.length,
        p_metadata: uploadMetadata as unknown as Json, // JSONB: upload meta + optional owner_feedback map.
      });
  if (error) throw new Error(error.message);
  if (
    (artifactType === 'story_image' || artifactType === 'cover') &&
    typeof artifactId === 'string'
  ) {
    schedulePostUploadQa({
      artifactId,
      weeklyDigestId,
      revisionId,
      revisionItemId: revisionItemId || null,
      artifactType,
      bytes,
      mimeType,
    });
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function selectedStagedArtifactIds(formData: FormData) {
  const ids = formData
    .getAll('staged_artifact_id')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new Error('Select at least one approved staged image to apply.');
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error('A selected staged image identifier is invalid. Reload and try again.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('A staged image may be selected only once. Reload and try again.');
  }
  return ids;
}

type VisualRefreshStagedCopy = {
  id: string;
  artifact_type: string;
  locale: string;
  slot_key: string;
  version: number;
  input_hash: string;
  is_current: boolean;
  generation_status: string;
  review_status: string;
  revision_item_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  metadata: Json | null;
};

/**
 * Avoid creating an otherwise harmless, but public, immutable orphan before
 * the promotion RPC has a chance to reject an invalid selection. The RPC
 * repeats every one of these checks under row locks; this is deliberately a
 * pre-copy reduction of public surface, not the authorization boundary.
 */
function assertVisualRefreshStagedCopyEligible(
  weeklyDigestId: string,
  refreshRevisionId: string,
  artifact: VisualRefreshStagedCopy,
) {
  const metadata = jsonRecord(artifact.metadata);
  const expectedSlot =
    artifact.artifact_type === 'cover'
      ? artifact.revision_item_id === null
        ? 'cover:neutral'
        : null
      : artifact.artifact_type === 'story_image' && artifact.revision_item_id
        ? `story-image:${artifact.revision_item_id}`
        : null;
  const expectedPrivatePrefix = `digests/${weeklyDigestId}/revisions/${refreshRevisionId}/uploads/binary-v2/${artifact.artifact_type}/`;
  if (
    (artifact.artifact_type !== 'cover' && artifact.artifact_type !== 'story_image') ||
    artifact.locale !== 'neutral' ||
    !artifact.is_current ||
    artifact.generation_status !== 'ready' ||
    artifact.review_status !== 'approved' ||
    !expectedSlot ||
    artifact.slot_key !== expectedSlot ||
    metadata.visual_refresh_asset_staged !== true ||
    typeof metadata.visual_refresh_direction_hash !== 'string' ||
    !metadata.visual_refresh_direction_hash.trim() ||
    artifact.storage_bucket !== 'weekly-digest-private' ||
    !artifact.storage_path?.startsWith(expectedPrivatePrefix) ||
    !artifact.mime_type ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(artifact.mime_type) ||
    !Number.isSafeInteger(artifact.version) ||
    artifact.version < 1 ||
    !/^[0-9a-f]{32}$/i.test(artifact.input_hash) ||
    typeof artifact.byte_size !== 'number' ||
    !Number.isSafeInteger(artifact.byte_size) ||
    artifact.byte_size < 1
  ) {
    throw new Error(
      'A selected image is no longer an approved staged visual-refresh asset. Reload and review it again.',
    );
  }
}

async function copyVerifiedVisualRefreshStagedAsset(
  weeklyDigestId: string,
  refreshRevisionId: string,
  artifact: VisualRefreshStagedCopy,
) {
  assertVisualRefreshStagedCopyEligible(weeklyDigestId, refreshRevisionId, artifact);
  if (
    artifact.storage_bucket !== 'weekly-digest-private' ||
    !artifact.storage_path ||
    !artifact.mime_type ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(artifact.mime_type)
  ) {
    throw new Error(
      'A selected staged image has no valid private source. Reload and review it again.',
    );
  }
  const admin = getSupabaseAdmin();
  const { data: source, error: downloadError } = await admin.storage
    .from(artifact.storage_bucket)
    .download(artifact.storage_path);
  if (downloadError || !source) {
    throw new Error(
      `Could not read staged image ${artifact.id}: ${downloadError?.message ?? 'empty file'}`,
    );
  }
  const bytes = Buffer.from(await source.arrayBuffer());
  if (artifact.byte_size !== null && artifact.byte_size !== bytes.length) {
    throw new Error('The staged image size changed after review. Upload and review it again.');
  }
  const byteSha256 = createHash('sha256').update(bytes).digest('hex');
  const metadataSha256 = jsonRecord(artifact.metadata).sha256;
  if (typeof metadataSha256 !== 'string' || metadataSha256.toLowerCase() !== byteSha256) {
    throw new Error(
      'The staged image bytes no longer match their reviewed checksum. Upload it again.',
    );
  }
  const publicPath = weeklyVisualRefreshPublicAssetPath({
    weeklyDigestId,
    refreshRevisionId,
    stagedArtifactId: artifact.id,
    stagedVersion: artifact.version,
    stagedInputHash: artifact.input_hash,
    byteSha256,
    sourcePath: artifact.storage_path,
    mimeType: artifact.mime_type,
  });
  const { error: uploadError } = await admin.storage
    .from(VISUAL_REFRESH_PUBLIC_ASSET_BUCKET)
    .upload(publicPath, storageBlob(bytes, artifact.mime_type), {
      contentType: artifact.mime_type,
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(
      `Could not stage immutable public image ${artifact.id}: ${uploadError.message}`,
    );
  }
  const { data: stored, error: verifyError } = await admin.storage
    .from(VISUAL_REFRESH_PUBLIC_ASSET_BUCKET)
    .download(publicPath);
  if (verifyError || !stored) {
    throw new Error(
      `Could not verify immutable public image ${artifact.id}: ${verifyError?.message ?? 'empty file'}`,
    );
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
    throw new Error(`Immutable public image ${artifact.id} failed byte verification.`);
  }
  return {
    staged_artifact_id: artifact.id,
    storage_bucket: VISUAL_REFRESH_PUBLIC_ASSET_BUCKET,
    storage_path: publicPath,
    byte_sha256: byteSha256,
  };
}

/**
 * Apply selected private visual-refresh pixels without ever mutating the
 * published revision itself. Public Storage copy/verification happens before
 * the RPC because Storage cannot join PostgreSQL's transaction; the RPC then
 * rechecks every staged ID, hash and public object and atomically versions the
 * actual published cover/story slots.
 */
export async function applyWeeklyVisualRefreshAssetsAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const stagedArtifactIds = selectedStagedArtifactIds(formData);
  const admin = getSupabaseAdmin();
  const [{ data: digest, error: digestError }, { data: artifacts, error: artifactError }] =
    await Promise.all([
      admin
        .from('weekly_digests')
        .select('slug,status,active_revision_id,published_revision_id')
        .eq('id', weeklyDigestId)
        .maybeSingle(),
      admin
        .from('weekly_digest_artifacts')
        .select(
          'id,artifact_type,locale,slot_key,version,input_hash,is_current,generation_status,review_status,revision_item_id,storage_bucket,storage_path,mime_type,byte_size,metadata',
        )
        .eq('weekly_digest_id', weeklyDigestId)
        .eq('revision_id', revisionId)
        .in('id', stagedArtifactIds),
    ]);
  if (digestError) throw new Error(digestError.message);
  if (
    !digest ||
    digest.status !== 'published' ||
    digest.active_revision_id !== revisionId ||
    !digest.published_revision_id
  ) {
    throw new Error(
      'This private visual refresh is no longer the active draft for a published Weekly.',
    );
  }
  if (artifactError) throw new Error(artifactError.message);
  if (!artifacts || artifacts.length !== stagedArtifactIds.length) {
    throw new Error(
      'One or more selected staged images no longer belong to this refresh. Reload first.',
    );
  }

  const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const orderedArtifacts = stagedArtifactIds.map((id) => artifactsById.get(id));
  if (orderedArtifacts.some((artifact) => !artifact)) {
    throw new Error('One or more selected staged images could not be loaded. Reload first.');
  }
  const publicAssets = [] as Array<{
    staged_artifact_id: string;
    storage_bucket: string;
    storage_path: string;
    byte_sha256: string;
  }>;
  for (const artifact of orderedArtifacts) {
    publicAssets.push(
      await copyVerifiedVisualRefreshStagedAsset(
        weeklyDigestId,
        revisionId,
        artifact as VisualRefreshStagedCopy,
      ),
    );
  }

  const db = await getSupabaseServer();
  const { error } = await db.rpc('promote_weekly_visual_refresh_assets', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_staged_artifact_ids: stagedArtifactIds,
    p_public_assets: publicAssets as unknown as Json,
  });
  if (error) throw new Error(error.message);

  revalidateWeeklyAdmin(weeklyDigestId);
  const safeSlug = encodeURIComponent(digest.slug);
  revalidateSiteSurfaces([`/en/weekly/${safeSlug}`, `/uk/weekly/${safeSlug}`]);
}

export async function ignorePostUploadQaAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const artifactId = requiredString(formData, 'artifact_id');
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('weekly_digest_artifacts')
    .select('metadata, artifact_type, revision_id')
    .eq('id', artifactId)
    // R3.1 / F14: the digest id is a hidden form field, not re-derived from
    // the artifact row -- without this filter a mismatched pair (stale form
    // after switching digests, tampered request) would silently mutate an
    // artifact on a DIFFERENT digest than the one the caller believes it's
    // editing, and revalidate the wrong admin page.
    .eq('weekly_digest_id', weeklyDigestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Artifact not found for this digest.');
  if (data.artifact_type !== 'story_image' && data.artifact_type !== 'cover') {
    throw new Error('Post-upload QA only applies to story images and covers.');
  }
  if (await isVisualRefreshAssetRevision(weeklyDigestId, data.revision_id)) {
    // Ignoring an automated finding on a staged replacement is part of the
    // same publication-adjacent review decision as approval/apply. The
    // service-role QA writer may persist evidence, but an editor cannot waive
    // it on a private visual refresh.
    await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  }
  const current = parsePostUploadQa(data.metadata);
  if (!current) throw new Error('No post-upload QA to ignore.');
  await persistPostUploadQa(artifactId, weeklyDigestId, ignorePostUploadQa(current));
}

/**
 * Re-runs post-upload QA on the file already in Storage (R4.2 / F18). The
 * `after()` call scheduled at upload time has no retry affordance -- if it
 * never lands (function timeout, transient provider failure), the metadata
 * stays `{pending: true}` forever with no way to ask again short of
 * re-uploading the same file. This re-downloads the stored bytes and
 * schedules a fresh check without touching the artifact content itself.
 */
export async function recheckPostUploadQaAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const artifactId = requiredString(formData, 'artifact_id');
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('weekly_digest_artifacts')
    .select('storage_bucket, storage_path, mime_type, artifact_type, revision_id, revision_item_id')
    .eq('id', artifactId)
    .eq('weekly_digest_id', weeklyDigestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Artifact not found for this digest.');
  if (data.artifact_type !== 'story_image' && data.artifact_type !== 'cover') {
    throw new Error('Post-upload QA only applies to story images and covers.');
  }
  if (await isVisualRefreshAssetRevision(weeklyDigestId, data.revision_id)) {
    await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  }
  if (!data.storage_bucket || !data.storage_path) {
    throw new Error('No stored file to re-check.');
  }
  const { data: stored, error: downloadError } = await admin.storage
    .from(data.storage_bucket)
    .download(data.storage_path);
  if (downloadError || !stored) {
    throw new Error(downloadError?.message ?? 'Could not download the stored file to re-check.');
  }
  const bytes = Buffer.from(await stored.arrayBuffer());
  // Marks pending again immediately (same shape uploadWeeklyArtifactAction
  // writes) so Visuals shows "QA перевіряє…" right away instead of the old,
  // possibly-stuck state until the async check completes.
  await persistPostUploadQa(artifactId, weeklyDigestId, {
    pending: true,
    blockers: [],
    scores: {},
    model: null,
    cost_usd: 0,
    checked_at: null,
  });
  schedulePostUploadQa({
    artifactId,
    weeklyDigestId,
    revisionId: data.revision_id,
    revisionItemId: data.revision_item_id,
    artifactType: data.artifact_type,
    bytes,
    mimeType: data.mime_type ?? 'image/jpeg',
  });
}

export async function saveWeeklyOwnerFeedbackAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const promptSetArtifactId = requiredString(formData, 'prompt_set_artifact_id');
  const imageArtifactId = optionalString(formData, 'image_artifact_id');
  const conceptLens = requiredString(formData, 'concept_lens');
  const entry = recordOwnerConceptFeedback({
    verdict: requiredString(formData, 'verdict'),
    reasonTags: alignedStrings(formData, 'reason_tag').filter(Boolean),
    promptTitle: optionalString(formData, 'prompt_title'),
    canonical: optionalString(formData, 'canonical'),
  });
  if (!entry) throw new Error('Choose used, used with edits, or rejected.');
  await persistOwnerFeedbackArtifacts({
    weeklyDigestId,
    promptSetArtifactId,
    imageArtifactId,
    conceptLens,
    entry,
  });
  revalidateWeeklyAdmin(weeklyDigestId);
}

async function persistOwnerFeedbackArtifacts(input: {
  weeklyDigestId: string;
  promptSetArtifactId: string;
  imageArtifactId: string;
  conceptLens: string;
  entry: OwnerConceptFeedback;
}) {
  const admin = getSupabaseAdmin();
  // R3.2 / F13: two concept-lens verdicts saved back-to-back on the same
  // prompt set is the realistic race here (three "Зберегти вердикт" clicks
  // across a story's three cards); the retry keeps the second save from
  // clobbering the first's owner_feedback entry.
  let promptWritten = false;
  for (let attempt = 0; attempt < OPTIMISTIC_UPDATE_MAX_ATTEMPTS; attempt++) {
    const { data: promptRow, error: promptError } = await admin
      .from('weekly_digest_artifacts')
      .select('content, artifact_type, updated_at')
      .eq('id', input.promptSetArtifactId)
      // R3.1 / F14: same cross-digest guard as ignorePostUploadQaAction.
      .eq('weekly_digest_id', input.weeklyDigestId)
      .maybeSingle();
    if (promptError) throw new Error(promptError.message);
    if (!promptRow || promptRow.artifact_type !== 'story_prompt_set') {
      throw new Error('Prompt set not found for this digest.');
    }
    const nextContent = applyOwnerFeedbackToPromptSet(
      promptRow.content,
      input.conceptLens,
      input.entry,
    );
    const { data: updatedRows, error: contentError } = await admin
      .from('weekly_digest_artifacts')
      .update({
        // JSONB: owner_feedback map is a JSON object, not a Json union member.
        content: nextContent as unknown as Json,
      })
      .eq('id', input.promptSetArtifactId)
      .eq('updated_at', promptRow.updated_at)
      .select('id');
    if (contentError) throw new Error(contentError.message);
    if (updatedRows && updatedRows.length > 0) {
      promptWritten = true;
      break;
    }
  }
  if (!promptWritten) {
    throw new Error('Prompt set changed while saving; reload and try again.');
  }
  if (!input.imageArtifactId) return;
  for (let attempt = 0; attempt < OPTIMISTIC_UPDATE_MAX_ATTEMPTS; attempt++) {
    const { data: imageRow, error: imageError } = await admin
      .from('weekly_digest_artifacts')
      .select('metadata, artifact_type, updated_at')
      .eq('id', input.imageArtifactId)
      .eq('weekly_digest_id', input.weeklyDigestId)
      .maybeSingle();
    if (imageError) throw new Error(imageError.message);
    if (
      !imageRow ||
      (imageRow.artifact_type !== 'story_image' && imageRow.artifact_type !== 'cover')
    ) {
      return;
    }
    const nextMetadata = applyOwnerFeedbackToImageMetadata(
      imageRow.metadata,
      input.conceptLens,
      input.entry,
    );
    const { data: updatedRows, error: metaError } = await admin
      .from('weekly_digest_artifacts')
      .update({
        // JSONB: owner_feedback sits beside post_upload_qa.
        metadata: nextMetadata as unknown as Json,
      })
      .eq('id', input.imageArtifactId)
      .eq('updated_at', imageRow.updated_at)
      .select('id');
    if (metaError) throw new Error(metaError.message);
    if (updatedRows && updatedRows.length > 0) return;
  }
  throw new Error('Uploaded image changed while saving; reload and try again.');
}

// Kept as a separate export so the Release tab contract stays stable while
// approval and scheduling remain distinct server-side decisions.
export async function approveWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const overrideReason = optionalString(formData, 'override_reason');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('approve_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_override_reason: overrideReason || null,
  });
  if (error) {
    redirectWeeklyReleaseError(weeklyDigestId, formatPreflightError(error.message));
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Single human gate after the hallucination board: approve + schedule
 * release_at = now + 15 minutes (preflight is the same instant).
 */
export async function shipWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const admin = getSupabaseAdmin();
  const { data: digest, error: digestError } = await admin
    .from('weekly_digests')
    .select('id,active_revision_id,status')
    .eq('id', weeklyDigestId)
    .maybeSingle();
  if (digestError) redirectWeeklyReleaseError(weeklyDigestId, digestError.message);
  if (!digest?.active_revision_id) {
    redirectWeeklyReleaseError(weeklyDigestId, 'The digest has no active revision.');
  }
  const { data: quality } = await admin
    .from('weekly_digest_artifacts')
    .select('content')
    .eq('revision_id', digest.active_revision_id)
    .eq('artifact_type', 'content_quality_report')
    .eq('is_current', true)
    .maybeSingle();
  if (qualityReportForbidsApprove(quality?.content)) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      'Cannot ship while the quality report still has blocking issues.',
    );
  }
  const { data: items } = await admin
    .from('weekly_digest_revision_items')
    .select('id,rank,title_en,title_uk')
    .eq('revision_id', digest.active_revision_id)
    .order('rank');
  const { data: artifacts } = await admin
    .from('weekly_digest_artifacts')
    .select(
      'artifact_type,locale,is_current,review_status,generation_status,storage_path,external_url,provider_id,content,metadata,revision_item_id',
    )
    .eq('revision_id', digest.active_revision_id)
    .eq('is_current', true);
  const board = buildHallucinationBoard({
    items: items ?? [],
    artifacts: artifacts ?? [],
  });
  if (!board.canShip) {
    const waiting = board.waitingOnOwner
      .map((item) => item.label)
      .slice(0, 5)
      .join('; ');
    redirectWeeklyReleaseError(
      weeklyDigestId,
      `Cannot ship while the hallucination board still has unresolved blockers: ${waiting}`,
    );
  }
  // Approve + schedule in one transaction: the two-RPC version left the
  // digest in `approved` limbo when the schedule call failed, and surfaced
  // the override-reason message instead of the real preflight blockers.
  const db = await getSupabaseServer();
  const { error: shipError } = await db.rpc('ship_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
  });
  if (shipError) {
    redirectWeeklyReleaseError(weeklyDigestId, formatPreflightError(shipError.message));
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function scheduleWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const releaseAt = localKyivToIso(requiredString(formData, 'release_at_local'));
  const preflightAt = localKyivToIso(requiredString(formData, 'preflight_at_local'));
  if (new Date(releaseAt).getTime() - new Date(preflightAt).getTime() !== 15 * 60_000) {
    redirectWeeklyReleaseError(weeklyDigestId, 'Preflight must be exactly 15 minutes before release.');
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('schedule_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_release_at: releaseAt,
  });
  if (error) redirectWeeklyReleaseError(weeklyDigestId, formatPreflightError(error.message));
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function pauseWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const intent = requiredString(formData, 'intent');
  const reason = requiredString(formData, 'reason');
  if (reason.length < 10 || reason.length > 500) {
    redirectWeeklyReleaseError(weeklyDigestId, 'Pause/resume reason must contain 10 to 500 characters.');
  }
  if (intent !== 'pause' && intent !== 'resume') {
    redirectWeeklyReleaseError(weeklyDigestId, 'Invalid release control.');
  }
  const db = await getSupabaseServer();
  const { error } =
    intent === 'pause'
      ? await db.rpc('pause_weekly_digest', {
          p_weekly_digest_id: weeklyDigestId,
          p_reason: reason,
        })
      : await db.rpc('approve_weekly_digest', {
          p_weekly_digest_id: weeklyDigestId,
          p_override_reason: null,
        });
  if (error) redirectWeeklyReleaseError(weeklyDigestId, formatPreflightError(error.message));
  revalidateWeeklyAdmin(weeklyDigestId);
}

/**
 * Surface the real RPC/preflight text on the Release tab. A bare throw from a
 * Server Action renders as Minified React error #441 (live 2026-08-28).
 */
function redirectWeeklyReleaseError(weeklyDigestId: string, message: string): never {
  redirect(
    `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=release&save_error=${encodeURIComponent(message.slice(0, 500))}`,
  );
}

/**
 * `schedule_weekly_digest` accepts any future release time, but only from
 * `status = 'approved'` -- there is no direct "move the date" RPC, by design
 * (a scheduled edition is meant to require the same owner sign-off a fresh
 * schedule does). Postpone specifically shifts by whole weeks to keep the
 * result on the same weekday/time, calculated in the Kyiv calendar so DST
 * transitions can never shift the wall-clock hour; an owner who needs an
 * arbitrary date/time instead uses Schedule release directly.
 */
function addKyivWeeks(releaseAt: Date, weeks: number): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(releaseAt);
  const [year, month, day] = ymd.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + weeks * 7));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

/**
 * One click for "I won't make it this Monday" -- pause, re-approve against
 * the current content (this re-runs the full preflight check, exactly as a
 * fresh approval would), then reschedule to the same time N weeks later.
 * Composed from the three existing RPCs rather than a new one: no new grants
 * to get wrong, and every intermediate state (`paused`, `approved`) is
 * already a state the rest of the UI understands and can recover from if a
 * later step fails.
 */
export async function postponeWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const weeks = Number.parseInt(requiredString(formData, 'weeks'), 10);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 8) {
    redirectWeeklyReleaseError(weeklyDigestId, 'Postpone by 1 to 8 weeks at a time.');
  }
  const reason = requiredString(formData, 'reason');
  if (reason.length < 10 || reason.length > 500) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      'Postpone reason must contain 10 to 500 characters.',
    );
  }

  const db = await getSupabaseServer();
  const { data: digest, error: readError } = await db
    .from('weekly_digests')
    .select('status,release_at')
    .eq('id', weeklyDigestId)
    .maybeSingle();
  if (readError) redirectWeeklyReleaseError(weeklyDigestId, readError.message);
  if (!digest) redirectWeeklyReleaseError(weeklyDigestId, 'Weekly digest was not found.');
  if (digest.status !== 'scheduled' || !digest.release_at) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      'Only an already-scheduled edition can be postponed. Approve it and use Schedule directly to pick a first release date.',
    );
  }

  const newReleaseAt = kyivWallClockToUtc(
    addKyivWeeks(new Date(digest.release_at), weeks),
    16,
    0,
  ).toISOString();

  const { error: pauseError } = await db.rpc('pause_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_reason: `Postponed ${weeks} week(s): ${reason}`,
  });
  if (pauseError) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      `Could not pause before postponing: ${pauseError.message}`,
    );
  }

  const { error: approveError } = await db.rpc('approve_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_override_reason: null,
  });
  if (approveError) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      `Paused, but could not re-approve to reschedule: ${approveError.message}. The edition is now paused -- resolve the blocker, then use Resume and Schedule.`,
    );
  }

  const { error: scheduleError } = await db.rpc('schedule_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_release_at: newReleaseAt,
  });
  if (scheduleError) {
    redirectWeeklyReleaseError(
      weeklyDigestId,
      `Paused and re-approved, but could not schedule the new date: ${scheduleError.message}. The edition is now approved -- use Schedule directly.`,
    );
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}
