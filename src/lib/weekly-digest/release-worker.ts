import 'server-only';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { alertWeeklyDigestIssue } from './alerts';
import { isWeeklyDigestReleaseDue } from './period';
import { promoteWeeklyDigestPublicAssets } from './publication-assets';
import { revalidatePathsForPublish, revalidatePublicContentTag } from '@/lib/revalidate-site';
import { syncWeeklySocialUrlsAfterPublish } from './rewrite-social-urls';

export interface ClaimedWeeklyDigest {
  id: string;
  slug: string;
  release_at: string | null;
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

export interface WeeklyReleaseDependencies {
  claimDue(limit: number): Promise<ClaimedWeeklyDigest[]>;
  preflight(weeklyDigestId: string): Promise<unknown>;
  promote(weeklyDigestId: string): Promise<unknown>;
  finish(weeklyDigestId: string, succeeded: boolean, error?: string | null): Promise<string | null>;
  revalidate(path: string): void;
  revalidateData?(): void;
  syncSocialUrls?(
    weeklyDigestId: string,
    claimedSlug: string,
    publishedSlug: string,
  ): Promise<void>;
  alert(input: {
    weeklyDigestId: string;
    phase: 'generation' | 'preflight' | 'release';
    message: string;
  }): Promise<void>;
}

export interface WeeklyReleaseWorkerOptions {
  now?: Date;
  dependencies?: WeeklyReleaseDependencies;
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 1500);
}

function rpcClient() {
  return getSupabaseAdmin() as unknown as UntypedRpcClient;
}

async function claimDue(limit: number): Promise<ClaimedWeeklyDigest[]> {
  const { data, error } = await rpcClient().rpc('claim_due_weekly_digests', {
    p_limit: limit,
  });
  if (error) throw new Error(`[weekly-release] claim failed: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.slug !== 'string') return [];
    return [
      {
        id: row.id,
        slug: row.slug,
        release_at: typeof row.release_at === 'string' ? row.release_at : null,
      },
    ];
  });
}

async function runPreflight(weeklyDigestId: string) {
  const { data, error } = await rpcClient().rpc('weekly_digest_preflight', {
    p_weekly_digest_id: weeklyDigestId,
  });
  if (error) throw new Error(`[weekly-release] preflight failed: ${error.message}`);
  return data;
}

function slugFromFinishRpc(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const slug = (data as { slug?: unknown }).slug;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

async function finishRelease(
  weeklyDigestId: string,
  succeeded: boolean,
  errorMessage?: string | null,
): Promise<string | null> {
  const { data, error } = await rpcClient().rpc('finish_weekly_digest_release', {
    p_weekly_digest_id: weeklyDigestId,
    p_succeeded: succeeded,
    p_error: errorMessage ?? null,
  });
  if (error) throw new Error(`[weekly-release] finish failed: ${error.message}`);
  return slugFromFinishRpc(data);
}

export async function runDueWeeklyDigestPreflights(limit = 10) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 25)) : 10;
  const { data, error } = await rpcClient().rpc('run_due_weekly_digest_preflights', {
    p_limit: safeLimit,
  });
  if (error) throw new Error(`[weekly-release] scheduled preflight failed: ${error.message}`);
  const digests = Array.isArray(data)
    ? data.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        return typeof row.id === 'string'
          ? [{ id: row.id, status: typeof row.status === 'string' ? row.status : null }]
          : [];
      })
    : [];
  await Promise.all(
    digests
      .filter((digest) => digest.status === 'failed')
      .map((digest) =>
        alertWeeklyDigestIssue({
          weeklyDigestId: digest.id,
          phase: 'preflight',
          message: 'The automatic Monday 15:45 preflight found release blockers.',
        }),
      ),
  );
  return { checked: digests.length, digests };
}

const DATABASE_DEPENDENCIES: WeeklyReleaseDependencies = {
  claimDue,
  preflight: runPreflight,
  promote: promoteWeeklyDigestPublicAssets,
  finish: finishRelease,
  revalidate: revalidatePath,
  revalidateData: revalidatePublicContentTag,
  syncSocialUrls: syncWeeklySocialUrlsAfterPublish,
  alert: alertWeeklyDigestIssue,
};

export function preflightBlockersFromRpc(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') {
    return [{ code: 'invalid_preflight_response', message: 'Preflight returned no result.' }];
  }
  const result = value as Record<string, unknown>;
  if (Array.isArray(result.blockers)) {
    if (result.blockers.length > 0) return result.blockers;
    if (result.ready === false || result.ok === false) {
      return [
        {
          code: 'preflight_not_ready',
          message: 'Preflight explicitly reported that the digest is not ready.',
        },
      ];
    }
    if (result.ready === true || result.ok === true) return [];
  }
  if (result.ready === true || result.ok === true) return [];
  return [
    {
      code: 'invalid_preflight_response',
      message: 'Preflight response did not contain an explicit result.',
    },
  ];
}

function weeklyPublicPaths(...slugs: Array<string | null>) {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const safeSlug = encodeURIComponent(slug);
    paths.push(`/en/weekly/${safeSlug}`, `/uk/weekly/${safeSlug}`);
  }
  return revalidatePathsForPublish(paths);
}

async function finishFailure(
  dependencies: WeeklyReleaseDependencies,
  weeklyDigestId: string,
  message: string,
) {
  try {
    await dependencies.finish(weeklyDigestId, false, message);
    return null;
  } catch (error) {
    return safeMessage(error);
  }
}

export async function releaseDueWeeklyDigests(
  limit = 10,
  options: WeeklyReleaseWorkerOptions = {},
) {
  const dependencies = options.dependencies ?? DATABASE_DEPENDENCIES;
  const now = options.now ?? new Date();
  const claimLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 25)) : 10;
  const digests = await dependencies.claimDue(claimLimit);
  const results: Array<{
    id: string;
    outcome: 'published' | 'blocked' | 'not_due' | 'failed';
    error?: string;
    blockerCount?: number;
    revalidationError?: string;
  }> = [];

  // Claims are atomic in PostgreSQL. Sequential finishing keeps status changes
  // and cache invalidation deterministic while preserving worker idempotency.
  for (const digest of digests) {
    if (!digest.release_at || !isWeeklyDigestReleaseDue(digest.release_at, now)) {
      const message = 'Claimed digest has no due release_at; publication refused.';
      const finishError = await finishFailure(dependencies, digest.id, message);
      results.push({
        id: digest.id,
        outcome: 'not_due',
        error: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      await dependencies.alert({
        weeklyDigestId: digest.id,
        phase: 'release',
        message: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      continue;
    }

    let preflight: unknown;
    try {
      preflight = await dependencies.preflight(digest.id);
    } catch (error) {
      const message = safeMessage(error);
      const finishError = await finishFailure(dependencies, digest.id, message);
      results.push({
        id: digest.id,
        outcome: 'failed',
        error: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      await dependencies.alert({
        weeklyDigestId: digest.id,
        phase: 'preflight',
        message: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      continue;
    }

    const blockers = preflightBlockersFromRpc(preflight);
    if (blockers.length > 0) {
      const message = `Release preflight blocked: ${JSON.stringify(blockers)}`.slice(0, 1500);
      const finishError = await finishFailure(dependencies, digest.id, message);
      results.push({
        id: digest.id,
        outcome: 'blocked',
        blockerCount: blockers.length,
        ...(finishError ? { error: finishError } : {}),
      });
      await dependencies.alert({
        weeklyDigestId: digest.id,
        phase: 'preflight',
        message: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      continue;
    }

    try {
      await dependencies.promote(digest.id);
    } catch (error) {
      const message = safeMessage(error);
      const finishError = await finishFailure(dependencies, digest.id, message);
      results.push({
        id: digest.id,
        outcome: 'failed',
        error: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      await dependencies.alert({
        weeklyDigestId: digest.id,
        phase: 'release',
        message: finishError ? `${message} Finish error: ${finishError}` : message,
      });
      continue;
    }

    let publishedSlug: string;
    try {
      publishedSlug = (await dependencies.finish(digest.id, true, null)) ?? digest.slug;
    } catch (error) {
      const message = safeMessage(error);
      results.push({ id: digest.id, outcome: 'failed', error: message });
      await dependencies.alert({
        weeklyDigestId: digest.id,
        phase: 'release',
        message,
      });
      continue;
    }

    const revalidationErrors: string[] = [];
    try {
      dependencies.revalidateData?.();
    } catch (error) {
      revalidationErrors.push(`public-content: ${safeMessage(error)}`);
    }
    for (const path of weeklyPublicPaths(digest.slug, publishedSlug)) {
      try {
        dependencies.revalidate(path);
      } catch (error) {
        // Publication is already committed. Never roll it back because cache
        // invalidation failed; still attempt every remaining public surface.
        revalidationErrors.push(`${path}: ${safeMessage(error)}`);
      }
    }
    try {
      await dependencies.syncSocialUrls?.(digest.id, digest.slug, publishedSlug);
      dependencies.revalidate(`/admin/weekly/${digest.id}`);
    } catch (error) {
      revalidationErrors.push(`social-urls: ${safeMessage(error)}`);
    }
    const revalidationError = revalidationErrors.length
      ? revalidationErrors.join('; ').slice(0, 1500)
      : undefined;
    results.push({
      id: digest.id,
      outcome: 'published',
      ...(revalidationError ? { revalidationError } : {}),
    });
  }

  return { claimed: digests.length, results };
}
