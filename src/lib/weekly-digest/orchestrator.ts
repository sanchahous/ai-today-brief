import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/database.types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  resolveWeeklyContentStudioMode,
  type WeeklyContentStudioMode,
} from './content-studio';
import {
  contentStudioMasterKey,
  contentStudioResearchKey,
  contentStudioResearchRetryNonce,
  revisionItemIdFromJobInput,
  shouldEnqueueContentStudioMaster,
  shouldEnqueueContentStudioResearch,
} from './content-studio-queue';

interface RpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

type StudioJobRow = {
  job_type: string;
  status: string;
  input: Json;
};

type FeatureItem = { id: string; rank: number };

interface ContentStudioContext {
  db: ReturnType<typeof getSupabaseAdmin>;
  mode: Exclude<WeeklyContentStudioMode, 'off'>;
  featureItems: FeatureItem[];
}

export function weeklyContentStudioMode(): WeeklyContentStudioMode {
  return resolveWeeklyContentStudioMode(process.env.WEEKLY_CONTENT_STUDIO_V2);
}

function researchInput(itemId: string, mode: Exclude<WeeklyContentStudioMode, 'off'>): Json {
  return {
    revision_item_id: itemId,
    placement: 'feature',
    mode,
  };
}

function masterInput(mode: Exclude<WeeklyContentStudioMode, 'off'>): Json {
  return {
    structure: 'top3_radar',
    premium_only: true,
    human_research_gate: true,
    mode,
  };
}

async function queueGenerationJob(
  rpc: RpcClient,
  args: {
    weeklyDigestId: string;
    revisionId: string;
    jobType: 'research_pack' | 'editorial_master';
    key: string;
    input: Json;
  },
) {
  const { error } = await rpc.rpc('queue_weekly_digest_generation_job', {
    p_weekly_digest_id: args.weeklyDigestId,
    p_revision_id: args.revisionId,
    p_job_type: args.jobType,
    p_idempotency_key: args.key,
    p_input: args.input,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

async function loadContentStudioContext(
  weeklyDigestId: string,
  revisionId: string,
): Promise<ContentStudioContext> {
  const mode = weeklyContentStudioMode();
  if (mode === 'off') {
    throw new Error('WEEKLY_CONTENT_STUDIO_V2 is off. Enable shadow or production mode first.');
  }
  const db = getSupabaseAdmin();
  const [{ data: digest, error: digestError }, { data: items, error: itemsError }] =
    await Promise.all([
      db
        .from('weekly_digests')
        .select('id,active_revision_id,status')
        .eq('id', weeklyDigestId)
        .eq('active_revision_id', revisionId)
        .single(),
      db
        .from('weekly_digest_revision_items')
        .select('id,rank')
        .eq('revision_id', revisionId)
        .order('rank'),
    ]);
  if (digestError || !digest) throw new Error('An editable active Weekly Digest is required.');
  if (['publishing', 'published', 'cancelled'].includes(digest.status)) {
    throw new Error('Content Studio cannot start after publication begins.');
  }
  if (itemsError || !items || items.length < 6 || items.length > 7) {
    throw new Error('Content Studio requires Top 3 plus 3–4 Radar stories (6–7 total).');
  }
  const featureItems = items.filter((candidate) => candidate.rank <= 3);
  return { db, mode, featureItems };
}

function groupStudioJobStatuses(jobs: StudioJobRow[] | null) {
  const researchByItem = new Map<string, string[]>();
  const masterStatuses: string[] = [];
  for (const job of jobs ?? []) {
    if (job.job_type === 'editorial_master') {
      masterStatuses.push(job.status);
      continue;
    }
    if (job.job_type !== 'research_pack') continue;
    const itemId = revisionItemIdFromJobInput(job.input);
    if (!itemId) continue;
    const statuses = researchByItem.get(itemId) ?? [];
    statuses.push(job.status);
    researchByItem.set(itemId, statuses);
  }
  return { researchByItem, masterStatuses };
}

/**
 * Starts only research and the dependency-blocked master job. Derivatives are
 * queued by the master worker on the new immutable revision.
 *
 * Uses a stable idempotency key per digest+revision+item so the scheduled
 * composer can call this twice without duplicating work. Owner retry after a
 * succeeded pack must go through `retryWeeklyContentStudio`.
 */
export async function startWeeklyContentStudio(weeklyDigestId: string, revisionId: string) {
  const { db, mode, featureItems } = await loadContentStudioContext(weeklyDigestId, revisionId);
  const rpc = db as unknown as RpcClient;
  const queued: string[] = [];
  for (const item of featureItems) {
    const key = contentStudioResearchKey({
      digestId: weeklyDigestId,
      revisionId,
      itemId: item.id,
    });
    await queueGenerationJob(rpc, {
      weeklyDigestId,
      revisionId,
      jobType: 'research_pack',
      key,
      input: researchInput(item.id, mode),
    });
    queued.push(key);
  }
  const masterKey = contentStudioMasterKey({ digestId: weeklyDigestId, revisionId });
  await queueGenerationJob(rpc, {
    weeklyDigestId,
    revisionId,
    jobType: 'editorial_master',
    key: masterKey,
    input: masterInput(mode),
  });
  queued.push(masterKey);
  return { queued, mode };
}

/**
 * Admin "Start / retry Content Studio": mint new `research_pack` rows when the
 * previous jobs already succeeded (or failed), skip slots that are already in
 * flight, and leave a waiting master on this revision in place.
 */
export async function retryWeeklyContentStudio(
  weeklyDigestId: string,
  revisionId: string,
  retryNonce = randomUUID(),
) {
  const { db, mode, featureItems } = await loadContentStudioContext(weeklyDigestId, revisionId);
  const { data: jobs, error: jobsError } = await db
    .from('weekly_digest_generation_jobs')
    .select('job_type,status,input')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', revisionId)
    .in('job_type', ['research_pack', 'editorial_master']);
  if (jobsError) throw new Error(jobsError.message);

  const { researchByItem, masterStatuses } = groupStudioJobStatuses(jobs);
  const rpc = db as unknown as RpcClient;
  const queued: string[] = [];
  const skipped: string[] = [];

  for (const item of featureItems) {
    const statuses = researchByItem.get(item.id) ?? [];
    const stableKey = contentStudioResearchKey({
      digestId: weeklyDigestId,
      revisionId,
      itemId: item.id,
    });
    if (!shouldEnqueueContentStudioResearch(statuses)) {
      skipped.push(stableKey);
      continue;
    }
    const key = contentStudioResearchKey({
      digestId: weeklyDigestId,
      revisionId,
      itemId: item.id,
      retryNonce: contentStudioResearchRetryNonce(statuses, retryNonce),
    });
    await queueGenerationJob(rpc, {
      weeklyDigestId,
      revisionId,
      jobType: 'research_pack',
      key,
      input: researchInput(item.id, mode),
    });
    queued.push(key);
  }

  const masterKey = contentStudioMasterKey({ digestId: weeklyDigestId, revisionId });
  if (!shouldEnqueueContentStudioMaster(masterStatuses)) {
    skipped.push(masterKey);
    return { queued, skipped, mode };
  }
  await queueGenerationJob(rpc, {
    weeklyDigestId,
    revisionId,
    jobType: 'editorial_master',
    key: masterKey,
    input: masterInput(mode),
  });
  queued.push(masterKey);
  return { queued, skipped, mode };
}
