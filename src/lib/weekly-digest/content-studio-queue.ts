import { WEEKLY_CONTENT_STUDIO_VERSION } from './content-studio';

/**
 * Statuses that mean a generation job is still the live occupant of a slot.
 * Matches the control-plane lease set used by claim/retry RPCs.
 */
export const WEEKLY_GENERATION_IN_FLIGHT_STATUSES = [
  'waiting',
  'queued',
  'dispatching',
  'running',
  'retry_scheduled',
] as const;

export type WeeklyGenerationInFlightStatus =
  (typeof WEEKLY_GENERATION_IN_FLIGHT_STATUSES)[number];

export function isWeeklyGenerationInFlight(status: string): boolean {
  return (WEEKLY_GENERATION_IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export function contentStudioResearchKey(params: {
  digestId: string;
  revisionId: string;
  itemId: string;
  retryNonce?: string;
}): string {
  const base = `${WEEKLY_CONTENT_STUDIO_VERSION}:${params.digestId}:${params.revisionId}:research:${params.itemId}`;
  return params.retryNonce ? `${base}:retry:${params.retryNonce}` : base;
}

export function contentStudioMasterKey(params: {
  digestId: string;
  revisionId: string;
}): string {
  return `${WEEKLY_CONTENT_STUDIO_VERSION}:${params.digestId}:${params.revisionId}:master`;
}

/** Stable companion key from queuePostMasterJobs / video_script success. */
export function contentStudioVideoManifestKey(params: {
  digestId: string;
  revisionId: string;
}): string {
  return `${WEEKLY_CONTENT_STUDIO_VERSION}:${params.digestId}:${params.revisionId}:video-manifest:en`;
}

export function revisionItemIdFromJobInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = (input as { revision_item_id?: unknown }).revision_item_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Owner "Start / retry" for a Top 3 research pack: skip while one is already
 * generating; otherwise mint a new row (stable key on first start, unique
 * `:retry:` key once any prior job exists).
 */
export function shouldEnqueueContentStudioResearch(statuses: string[]): boolean {
  return !statuses.some(isWeeklyGenerationInFlight);
}

/**
 * First-start uses the stable research key so composer and the admin button
 * share one row. Any later click (succeeded, failed, cancelled) needs a unique
 * key because `queue_weekly_digest_generation_job` only resets failed/cancelled
 * on conflict — succeeded/waiting/queued are returned unchanged.
 */
export function contentStudioResearchRetryNonce(
  statuses: string[],
  retryNonce: string,
): string | undefined {
  return statuses.length === 0 ? undefined : retryNonce;
}

/**
 * Leave a waiting/running master in place (it still waits for 3 approved packs).
 * Do not mint another master after one already succeeded — that path is
 * "Regenerate master". Re-queue only when none exists, or every existing row
 * is failed/cancelled.
 */
export function shouldEnqueueContentStudioMaster(statuses: string[]): boolean {
  if (statuses.some(isWeeklyGenerationInFlight)) return false;
  if (statuses.some((status) => status === 'succeeded')) return false;
  return true;
}

type PostMasterItem = { id: string; title_en: string | null; title_uk: string | null };

/**
 * Visuals, social, PDF and video jobs that follow a finished editorial_master.
 * Idempotent: duplicate queue keys are ignored so Approve can safely re-call.
 */
export async function queuePostMasterJobs(
  weeklyDigestId: string,
  revisionId: string,
  items: PostMasterItem[],
): Promise<void> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
  const db = getSupabaseAdmin();
  const jobs: Array<{
    type: string;
    key: string;
    input: Record<string, string>;
    idempotencyKey?: string;
  }> = [
    ...items.map((item) => ({
      type: 'story_image',
      key: `story-image:${item.id}`,
      input: {
        revision_item_id: item.id,
        alt_text: item.title_en ?? '',
        alt_text_uk: item.title_uk ?? '',
      },
    })),
    { type: 'cover', key: 'cover:neutral', input: { locale: 'en', slot_key: 'cover:neutral' } },
    { type: 'social_copy', key: 'social-copy', input: { locale_map: 'database' } },
    {
      type: 'video_script',
      key: 'video-script:en',
      input: { locale: 'en', slot_key: 'video-script:en' },
    },
    {
      type: 'video_manifest',
      key: 'video-manifest:en',
      idempotencyKey: contentStudioVideoManifestKey({
        digestId: weeklyDigestId,
        revisionId,
      }),
      input: { locale: 'en', slot_key: 'video-manifest:en' },
    },
    { type: 'pdf', key: 'pdf:en', input: { locale: 'en', slot_key: 'pdf:en' } },
    { type: 'pdf', key: 'pdf:uk', input: { locale: 'uk', slot_key: 'pdf:uk' } },
  ];
  const results = await Promise.all(
    jobs.map((queued) =>
      db.rpc('queue_weekly_digest_generation_job', {
        p_weekly_digest_id: weeklyDigestId,
        p_revision_id: revisionId,
        p_job_type: queued.type,
        p_idempotency_key:
          queued.idempotencyKey ??
          `${WEEKLY_CONTENT_STUDIO_VERSION}:${weeklyDigestId}:${revisionId}:${queued.key}`,
        p_input: queued.input,
      }),
    ),
  );
  for (const { error } of results) {
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`[weekly-generation] queue post-master: ${error.message}`);
    }
  }
}
