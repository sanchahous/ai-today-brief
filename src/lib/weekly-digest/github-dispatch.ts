/**
 * Triggers the weekly-master-cli-worker GitHub Actions workflow on demand.
 * That workflow runs on a real GitHub Actions runner, the only place the
 * `claude` binary and CLAUDE_CODE_OAUTH_TOKEN are available — Vercel's
 * serverless functions can never run it directly (see pipeline/claude-cli.ts).
 */
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

const REPO_OWNER = 'sanchahous';
const REPO_NAME = 'ai-today-brief';
const WORKFLOW_FILE = 'weekly-master-cli-worker.yml';
const TRANSIENT_DISPATCH_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DISPATCH_MAX_ATTEMPTS = 3;
const DISPATCH_RETRY_DELAYS_MS = [300, 900] as const;

interface DispatchLease {
  job_id: string;
  weekly_digest_id: string;
  job_type?: string;
  dispatch_token: string;
}

export interface DispatchBatchResult {
  dispatched: number;
  error: string | null;
}

export function isRetryableGithubDispatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /^\[github-dispatch\] workflow dispatch failed: HTTP (408|429|5\d\d):/.test(error.message) ||
    error.message.startsWith('[github-dispatch] network dispatch failed:')
  );
}

interface RpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function dispatchRpc() {
  return getSupabaseAdmin() as unknown as RpcClient;
}

function dispatchLeaseFrom(value: unknown): DispatchLease | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.job_id !== 'string' ||
    typeof row.weekly_digest_id !== 'string' ||
    typeof row.dispatch_token !== 'string'
  ) {
    return null;
  }
  return {
    job_id: row.job_id,
    weekly_digest_id: row.weekly_digest_id,
    ...(typeof row.job_type === 'string' ? { job_type: row.job_type } : {}),
    dispatch_token: row.dispatch_token,
  };
}

export async function dispatchWeeklyMasterCliWorker(options: {
  jobId: string;
  dispatchToken: string;
  weeklyDigestId: string;
  jobType?: string;
  ref?: string;
  fetchFn?: typeof fetch;
  waitFn?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const token = process.env.GH_ACTIONS_DISPATCH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'GH_ACTIONS_DISPATCH_TOKEN is not set. Add it in Vercel to enable this action.',
    );
  }
  const fetchFn = options.fetchFn ?? fetch;
  const waitFn = options.waitFn ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 1; attempt <= DISPATCH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchFn(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: options.ref ?? 'main',
            inputs: {
              job_id: options.jobId,
              dispatch_token: options.dispatchToken,
              weekly_digest_id: options.weeklyDigestId,
              // Optional in the workflow for zero-downtime rollout: the previously
              // deployed dispatcher does not send it, and all of its jobs are the
              // serialized editorial types.
              job_type: options.jobType ?? 'editorial_master',
            },
          }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown network error';
      const dispatchError = new Error(`[github-dispatch] network dispatch failed: ${message}`);
      if (attempt === DISPATCH_MAX_ATTEMPTS) throw dispatchError;
      await waitFn(DISPATCH_RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }

    if (response.ok) return;

    const raw = await response.text();
    const dispatchError = new Error(
      `[github-dispatch] workflow dispatch failed: HTTP ${response.status}: ${raw.slice(0, 500)}`,
    );
    if (!TRANSIENT_DISPATCH_STATUS.has(response.status) || attempt === DISPATCH_MAX_ATTEMPTS) {
      throw dispatchError;
    }
    await waitFn(DISPATCH_RETRY_DELAYS_MS[attempt - 1]!);
  }
}

/**
 * Atomically reserves one long job for a dedicated GitHub Actions run, then
 * dispatches that exact id/token pair. A runner cannot claim another digest.
 */
export async function dispatchQueuedWeeklyGenerationJob(jobId?: string): Promise<boolean> {
  const { data, error } = await dispatchRpc().rpc('prepare_weekly_digest_github_dispatch', {
    p_job_id: jobId ?? null,
  });
  if (error) throw new Error(`[github-dispatch] prepare: ${error.message}`);
  const lease = Array.isArray(data) ? dispatchLeaseFrom(data[0]) : dispatchLeaseFrom(data);
  if (!lease) return false;
  try {
    await dispatchWeeklyMasterCliWorker({
      jobId: lease.job_id,
      dispatchToken: lease.dispatch_token,
      weeklyDigestId: lease.weekly_digest_id,
      jobType: lease.job_type,
    });
  } catch (error) {
    // A 5xx/transport error does not tell us whether GitHub accepted the
    // workflow request. Keep the lease fenced until the database reaper can
    // safely recover it instead of making the editor repeat a write or
    // presenting the opaque RSC error boundary.
    if (isRetryableGithubDispatchError(error)) {
      console.error('[github-dispatch] transient dispatch deferred', {
        jobId: lease.job_id,
        error: error instanceof Error ? error.message : 'unknown dispatch error',
      });
      return false;
    }
    throw error;
  }
  return true;
}

/**
 * Dispatches independent ready jobs without waiting for the five-minute
 * safety poll between each one. A failed external dispatch leaves its fenced
 * row in `dispatching`; the database reaper returns it to the queue.
 */
export async function dispatchQueuedWeeklyGenerationJobs(limit = 10): Promise<DispatchBatchResult> {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
  let dispatched = 0;
  try {
    for (let index = 0; index < boundedLimit; index += 1) {
      if (!(await dispatchQueuedWeeklyGenerationJob())) break;
      dispatched += 1;
    }
    return { dispatched, error: null };
  } catch (error) {
    return {
      dispatched,
      error: error instanceof Error ? error.message.slice(0, 500) : 'github_dispatch_failed',
    };
  }
}
