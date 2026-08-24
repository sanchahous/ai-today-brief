'use server';

import { revalidatePath } from 'next/cache';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { dispatchDailyVisualFinalizer } from '@/lib/daily-visual/github-dispatch';
import { isDispatchableQueuedDailyVisualRecovery } from '@/lib/daily-visual/retry-state';
import { composeDailyVisualSocialPackage } from '@/lib/social/daily-visual-composer';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  dailyVisualAltText,
  parseDailyVisualDirection,
} from '../../../../../pipeline/daily-visual-contract';
import { dailyVisualSocialInputFromStored } from '../../../../../pipeline/daily-visual-input';
import {
  persistPrivateDailyVisualCandidate,
  promoteDailyVisualCandidate,
  type StoredDailyVisualCandidate,
} from '../../../../../pipeline/daily-visual-storage';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function httpsUrl(value: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`${label} must be a safe HTTPS URL.`);
  }
  return parsed.toString();
}

type LoadedSet = {
  id: string;
  editorial_date: string;
  source_snapshot: unknown;
  direction: unknown;
};

type LoadedCandidate = StoredDailyVisualCandidate & {
  daily_visual_set_id: string;
  candidate_kind: string;
};

async function loadSet(
  db: ReturnType<typeof getSupabaseAdmin>,
  visualSetId: string,
): Promise<LoadedSet> {
  const { data, error } = await db
    .from('daily_visual_sets')
    .select('id,editorial_date,source_snapshot,direction')
    .eq('id', visualSetId)
    .maybeSingle();
  if (error) throw new Error(`Could not load visual set: ${error.message}`);
  if (!data) throw new Error('Daily visual set was not found.');
  return data;
}

async function loadCandidate(
  db: ReturnType<typeof getSupabaseAdmin>,
  visualSetId: string,
  candidateId: string,
): Promise<LoadedCandidate> {
  const { data, error } = await db
    .from('daily_visual_candidates')
    .select(
      'id,daily_visual_set_id,candidate_kind,storage_bucket,storage_path,sha256,width,height,byte_size',
    )
    .eq('id', candidateId)
    .eq('daily_visual_set_id', visualSetId)
    .maybeSingle();
  if (error) throw new Error(`Could not load visual candidate: ${error.message}`);
  if (!data) throw new Error('The selected candidate does not belong to this daily visual set.');
  return {
    id: data.id,
    daily_visual_set_id: data.daily_visual_set_id,
    candidate_kind: data.candidate_kind,
    kind: data.candidate_kind,
    storageBucket: data.storage_bucket,
    storagePath: data.storage_path,
    sha256: data.sha256,
    width: data.width,
    height: data.height,
    bytes: data.byte_size,
  };
}

async function activateManualCandidate(input: {
  visualSetId: string;
  candidate: LoadedCandidate;
  reason: string;
  selectionKind: 'manual_select' | 'manual_replace';
  actor: { userId: string; role: 'owner' | 'editor' | 'analyst' };
}) {
  const db = getSupabaseAdmin();
  const set = await loadSet(db, input.visualSetId);
  // Validate the frozen editorial inputs before creating a public object. A
  // malformed historical set must fail privately; it must not leave an
  // unreferenced public image behind merely because someone opened the admin
  // picker.
  const socialInput = dailyVisualSocialInputFromStored({
    sourceSnapshot: set.source_snapshot,
    direction: set.direction,
    visualSetId: set.id,
    publicUrl: 'https://pending.invalid/daily-visual',
  });
  const serializedDirection = JSON.stringify(set.direction);
  const direction = serializedDirection ? parseDailyVisualDirection(serializedDirection) : null;
  if (!direction) {
    throw new Error('This visual set has an incomplete private editorial direction.');
  }
  const promoted = await promoteDailyVisualCandidate(db, {
    editorialDate: set.editorial_date,
    candidate: input.candidate,
  });
  const socialInputWithPublicAsset = {
    ...socialInput,
    selectedPublicMasterUrl: promoted.publicUrl,
  };
  const { data, error } = await db.rpc('activate_daily_visual_candidate', {
    p_daily_visual_set_id: set.id,
    p_candidate_id: input.candidate.id,
    p_public_url: promoted.publicUrl,
    p_width: promoted.width,
    p_height: promoted.height,
    p_alt_en: dailyVisualAltText(direction, 'en'),
    p_alt_uk: dailyVisualAltText(direction, 'uk'),
    p_selection_kind: input.selectionKind,
    p_reason: input.reason || 'Explicit editor selection.',
    p_actor_id: input.actor.userId,
    p_actor_kind: input.actor.role,
  });
  if (error || !data)
    throw new Error(`Could not activate daily visual: ${error?.message ?? 'rejected'}`);

  // A package is candidate-bound. The composer preserves any post already
  // publishing/posted and only replaces drafts, so selecting an image cannot
  // mutate a live social delivery.
  await composeDailyVisualSocialPackage(socialInputWithPublicAsset);
  revalidatePath('/admin/daily-visuals');
  revalidatePath(`/en/${socialInputWithPublicAsset.lead.slug}`);
  revalidatePath(`/uk/${socialInputWithPublicAsset.lead.slug}`);
  revalidatePath('/en/digests');
  revalidatePath('/uk/digests');
}

export async function selectDailyVisualCandidateAction(formData: FormData) {
  const session = await requireSocialAdmin({ aal2: true, roles: ['owner', 'editor'] });
  const visualSetId = requiredString(formData, 'daily_visual_set_id');
  const candidateId = requiredString(formData, 'candidate_id');
  const db = getSupabaseAdmin();
  const candidate = await loadCandidate(db, visualSetId, candidateId);
  await activateManualCandidate({
    visualSetId,
    candidate,
    reason: optionalString(formData, 'reason'),
    selectionKind: 'manual_select',
    actor: session,
  });
}

/**
 * Recover only the narrow “direction failed before any AI candidate existed”
 * state. The database function is the authority for the one-shot budget and
 * ownership checks; this action repeats the session check before it asks the
 * authenticated RPC and dispatches the exact frozen editorial date.
 */
export async function retryDailyVisualDirectionAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const visualSetId = requiredString(formData, 'daily_visual_set_id');
  const db = await getSupabaseServer();
  const { data: editorialDate, error } = await db.rpc('request_daily_visual_direction_retry', {
    p_daily_visual_set_id: visualSetId,
  });
  if (error) throw new Error(`Could not queue daily visual recovery: ${error.message}`);
  if (!editorialDate) {
    throw new Error('This daily visual is no longer eligible for a bounded direction recovery.');
  }

  // The queue transaction is intentionally already durable. If GitHub cannot
  // be reached, do not try to undo it or touch its held first reservation;
  // surface a clear recovery path while the owner can manually dispatch the
  // same date from Actions.
  try {
    await dispatchDailyVisualFinalizer({ editorialDate });
  } catch (dispatchError) {
    revalidatePath('/admin/daily-visuals');
    const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
    throw new Error(`Daily visual recovery is queued, but worker dispatch failed: ${message}`);
  }
  revalidatePath('/admin/daily-visuals');
}

/**
 * The first dispatch may fail after the recovery queue transaction commits.
 * This is deliberately dispatch-only: it cannot create another retry mode,
 * touch an existing reservation, or consume a second paid attempt.
 */
export async function dispatchQueuedDailyVisualRecoveryAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const visualSetId = requiredString(formData, 'daily_visual_set_id');
  const db = getSupabaseAdmin();
  const { data: job, error: jobError } = await db
    .from('daily_visual_jobs')
    .select('status,retry_mode,retry_count')
    .eq('daily_visual_set_id', visualSetId)
    .maybeSingle();
  if (jobError) throw new Error(`Could not read queued daily visual recovery: ${jobError.message}`);
  if (
    !isDispatchableQueuedDailyVisualRecovery(
      job
        ? {
            status: job.status,
            retryMode: job.retry_mode,
            retryCount: job.retry_count,
          }
        : null,
    )
  ) {
    throw new Error('There is no queued bounded daily visual recovery to dispatch.');
  }
  const set = await loadSet(db, visualSetId);
  try {
    await dispatchDailyVisualFinalizer({ editorialDate: set.editorial_date });
  } catch (dispatchError) {
    revalidatePath('/admin/daily-visuals');
    const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
    throw new Error(`Daily visual recovery remains queued, but worker dispatch failed: ${message}`);
  }
  revalidatePath('/admin/daily-visuals');
}

export async function uploadDailyVisualReplacementAction(formData: FormData) {
  const session = await requireSocialAdmin({ aal2: true, roles: ['owner', 'editor'] });
  const visualSetId = requiredString(formData, 'daily_visual_set_id');
  const sourceKind = requiredString(formData, 'source_kind');
  if (sourceKind !== 'official_source' && sourceKind !== 'editor_upload') {
    throw new Error('Choose either an official source asset or an editor-uploaded asset.');
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a replacement image.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Replacement images are limited to 10 MB.');
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.');
  const rightsNote = requiredString(formData, 'rights_note');
  const sourceUrl = optionalString(formData, 'source_url');
  if (sourceKind === 'official_source' && !sourceUrl) {
    throw new Error('An official source asset requires its official HTTPS source URL.');
  }
  const normalizedSourceUrl = sourceUrl ? httpsUrl(sourceUrl, 'Source URL') : null;
  const db = getSupabaseAdmin();
  const set = await loadSet(db, visualSetId);
  const { data: priorCandidates, error: priorError } = await db
    .from('daily_visual_candidates')
    .select('attempt_number')
    .eq('daily_visual_set_id', set.id)
    .eq('candidate_kind', sourceKind);
  if (priorError) throw new Error(`Could not inspect replacement slots: ${priorError.message}`);
  const attemptNumber =
    Math.max(-1, ...(priorCandidates ?? []).map((candidate) => candidate.attempt_number)) + 1;
  if (attemptNumber > 9)
    throw new Error('All immutable upload slots for this source type are already used.');

  const candidate = await persistPrivateDailyVisualCandidate(db, {
    editorialDate: set.editorial_date,
    dailyVisualSetId: set.id,
    kind: sourceKind,
    attemptNumber,
    bytes: Buffer.from(await file.arrayBuffer()),
    provider: sourceKind === 'official_source' ? 'official_source' : 'editor_upload',
    model: null,
    prompt: null,
    promptHash: null,
    sourceUrl: normalizedSourceUrl,
    rightsNote,
  });
  await activateManualCandidate({
    visualSetId: set.id,
    candidate: { ...candidate, daily_visual_set_id: set.id, candidate_kind: sourceKind },
    reason: optionalString(formData, 'reason') || `Manual ${sourceKind} replacement.`,
    selectionKind: 'manual_replace',
    actor: session,
  });
}
