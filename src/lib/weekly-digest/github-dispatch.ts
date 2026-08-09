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

interface DispatchLease {
  job_id: string;
  weekly_digest_id: string;
  dispatch_token: string;
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
    dispatch_token: row.dispatch_token,
  };
}

export async function dispatchWeeklyMasterCliWorker(options: {
  jobId: string;
  dispatchToken: string;
  weeklyDigestId: string;
  ref?: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  const token = process.env.GH_ACTIONS_DISPATCH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'GH_ACTIONS_DISPATCH_TOKEN is not set. Add it in Vercel to enable this action.',
    );
  }
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(
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
        },
      }),
    },
  );
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `[github-dispatch] workflow dispatch failed: HTTP ${response.status}: ${raw.slice(0, 500)}`,
    );
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
  await dispatchWeeklyMasterCliWorker({
    jobId: lease.job_id,
    dispatchToken: lease.dispatch_token,
    weeklyDigestId: lease.weekly_digest_id,
  });
  return true;
}
