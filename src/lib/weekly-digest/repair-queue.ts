import {
  isWeeklyGenerationInFlight,
  revisionItemIdFromJobInput,
} from './content-studio-queue';
import { partitionGenerationJobsForDisplay } from './generation-job-visibility';
import { qualityReportBlockingIssues } from './machine-attest';

export const WEEKLY_REPAIR_PIPELINE_JOB_TYPES = [
  'research_pack',
  'editorial_master',
  'cover',
  'story_image',
  'social_copy',
  'pdf',
  'video_script',
  'video_manifest',
] as const;

/** Jobs table on Fixes shows every studio type, including optional assets. */
export const WEEKLY_FIXES_JOB_TYPES = [
  ...WEEKLY_REPAIR_PIPELINE_JOB_TYPES,
  'social_asset',
] as const;

const POST_MASTER_JOB_TYPES = new Set([
  'cover',
  'story_image',
  'social_copy',
  'pdf',
  'video_script',
  'video_manifest',
]);

export type WeeklyRepairActionKind =
  | 'wait'
  | 'regenerate_master'
  | 'resume_master'
  | 'retry_job'
  | 'queue_post_master';

export type WeeklyRepairHrefTab =
  | 'research'
  | 'article'
  | 'visuals'
  | 'social'
  | 'pdf'
  | 'video'
  | 'release';

export type WeeklyMachineRepair = {
  kind: WeeklyRepairActionKind;
  title: string;
  detail: string;
  jobId?: string;
  sourceJobId?: string;
  jobType?: string;
  failureCode?: string | null;
};

export type WeeklyHumanWait = {
  label: string;
  tab: WeeklyRepairHrefTab;
};

export type WeeklyRepairQueue = {
  current: WeeklyMachineRepair | null;
  queued: WeeklyMachineRepair[];
  human: WeeklyHumanWait[];
};

export type WeeklyRepairJob = {
  id: string;
  created_at: string;
  job_type: string;
  status: string;
  failure_code: string | null;
  last_error: string | null;
  output: unknown;
  input?: unknown;
};

export type WeeklyRepairArtifact = {
  artifact_type: string;
  locale: string | null;
  is_current: boolean;
  review_status: string | null;
  generation_status: string | null;
  content: unknown;
  revision_item_id: string | null;
};

export type WeeklyRepairItem = {
  id: string;
  rank: number;
  title_en: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isWeeklyMachineRepairAction(kind: WeeklyRepairActionKind | undefined): boolean {
  return (
    kind === 'regenerate_master' ||
    kind === 'resume_master' ||
    kind === 'retry_job' ||
    kind === 'queue_post_master'
  );
}

export function savedMasterSegmentCount(job: WeeklyRepairJob): number {
  if (job.job_type !== 'editorial_master') return 0;
  if (!['failed', 'cancelled', 'succeeded'].includes(job.status)) return 0;
  const state = asRecord(job.output).master_run_state;
  return Object.keys(asRecord(asRecord(state).segments)).length;
}

function qualityArtifact(artifacts: WeeklyRepairArtifact[]) {
  return artifacts.find(
    (artifact) => artifact.artifact_type === 'content_quality_report' && artifact.is_current,
  );
}

function qualityIsApproved(artifacts: WeeklyRepairArtifact[]) {
  return qualityArtifact(artifacts)?.review_status === 'approved';
}

function qualityHasBlockers(artifacts: WeeklyRepairArtifact[]) {
  const quality = qualityArtifact(artifacts);
  return qualityReportBlockingIssues(quality?.content).length > 0;
}

function latestJob(jobs: WeeklyRepairJob[], jobType: string): WeeklyRepairJob | null {
  const matches = jobs.filter((job) => job.job_type === jobType);
  if (matches.length === 0) return null;
  let best = matches[0]!;
  for (let i = 1; i < matches.length; i += 1) {
    const job = matches[i]!;
    if (new Date(job.created_at).getTime() > new Date(best.created_at).getTime()) best = job;
  }
  return best;
}

function currentSocialJob(jobs: WeeklyRepairJob[]): WeeklyRepairJob | null {
  const { current } = partitionGenerationJobsForDisplay(jobs, ['social_copy']);
  return current[0] ?? null;
}

function failedStoryImageByRank(
  jobs: WeeklyRepairJob[],
  items: WeeklyRepairItem[],
): WeeklyRepairJob | null {
  const rankById = new Map(items.map((item) => [item.id, item.rank]));
  const failed = jobs.filter((job) => job.job_type === 'story_image' && job.status === 'failed');
  if (failed.length === 0) return null;
  let best = failed[0]!;
  let bestRank = rankById.get(revisionItemIdFromJobInput(best.input) ?? '') ?? 999;
  for (let i = 1; i < failed.length; i += 1) {
    const job = failed[i]!;
    const rank = rankById.get(revisionItemIdFromJobInput(job.input) ?? '') ?? 999;
    if (rank < bestRank) {
      best = job;
      bestRank = rank;
    }
  }
  return best;
}

function currentFailedForType(
  jobs: WeeklyRepairJob[],
  jobType: string,
  items: WeeklyRepairItem[],
): WeeklyRepairJob | null {
  if (jobType === 'social_copy') {
    const social = currentSocialJob(jobs);
    return social?.status === 'failed' ? social : null;
  }
  if (jobType === 'story_image') return failedStoryImageByRank(jobs, items);
  const latest = latestJob(jobs, jobType);
  return latest?.status === 'failed' ? latest : null;
}

function postMasterJobsExist(jobs: WeeklyRepairJob[]) {
  return jobs.some(
    (job) => POST_MASTER_JOB_TYPES.has(job.job_type) && job.status !== 'cancelled',
  );
}

function inFlightJob(jobs: WeeklyRepairJob[]): WeeklyRepairJob | null {
  for (const jobType of WEEKLY_REPAIR_PIPELINE_JOB_TYPES) {
    const matches = jobs.filter(
      (job) => job.job_type === jobType && isWeeklyGenerationInFlight(job.status),
    );
    if (matches.length === 0) continue;
    let best = matches[0]!;
    for (let i = 1; i < matches.length; i += 1) {
      const job = matches[i]!;
      if (new Date(job.created_at).getTime() > new Date(best.created_at).getTime()) best = job;
    }
    return best;
  }
  return null;
}

function retryRepair(job: WeeklyRepairJob): WeeklyMachineRepair {
  return {
    kind: 'retry_job',
    title: `${job.job_type} failed`,
    detail: job.last_error?.trim() || job.failure_code || 'The latest run of this job failed.',
    jobId: job.id,
    jobType: job.job_type,
    failureCode: job.failure_code,
  };
}

function collectHumanWaits(
  items: WeeklyRepairItem[],
  artifacts: WeeklyRepairArtifact[],
): WeeklyHumanWait[] {
  const human: WeeklyHumanWait[] = [];
  const features = items.filter((item) => item.rank <= 3);
  const approvedPacks = features.filter((item) =>
    artifacts.some(
      (artifact) =>
        artifact.artifact_type === 'research_pack' &&
        artifact.is_current &&
        artifact.revision_item_id === item.id &&
        artifact.review_status === 'approved',
    ),
  ).length;
  if (features.length === 3 && approvedPacks < 3) {
    human.push({
      label: `Approve remaining research packs (${approvedPacks}/3)`,
      tab: 'research',
    });
  }
  for (const item of items) {
    const image = artifacts.find(
      (artifact) =>
        artifact.artifact_type === 'story_image' &&
        artifact.is_current &&
        artifact.revision_item_id === item.id &&
        artifact.review_status === 'approved' &&
        artifact.generation_status === 'ready',
    );
    if (image) continue;
    human.push({
      label: `Upload and approve story ${item.rank} image`,
      tab: 'visuals',
    });
  }
  const video = artifacts.find(
    (artifact) => artifact.artifact_type === 'video_final' && artifact.is_current,
  );
  if (!video || video.review_status !== 'approved' || video.generation_status !== 'ready') {
    human.push({
      label: 'Paste the YouTube id and approve the weekly video',
      tab: 'video',
    });
  }
  return human;
}

function unapprovedMasterRepair(
  master: WeeklyRepairJob | null,
  blockers: boolean,
): WeeklyMachineRepair | null {
  if (master?.failure_code === 'resume_source_stale') {
    return {
      kind: 'regenerate_master',
      title: 'Saved master checkpoint is stale',
      detail: 'Resume cannot reuse this checkpoint. Start a fresh writer/critic pass.',
      jobId: master.id,
      jobType: 'editorial_master',
      failureCode: master.failure_code,
    };
  }
  const segments = master ? savedMasterSegmentCount(master) : 0;
  if (master && segments > 0 && master.status !== 'succeeded') {
    return {
      kind: 'resume_master',
      title: 'Resume saved master',
      detail: `Continue from ${segments} saved segment(s). Already-written stories are not paid for again.`,
      sourceJobId: master.id,
      jobType: 'editorial_master',
      failureCode: master.failure_code,
    };
  }
  if (blockers) {
    return {
      kind: 'regenerate_master',
      title: 'Quality blockers remain',
      detail:
        'Coded blockers still need a writer/critic pass. Warnings alone never reach this step.',
      jobType: 'editorial_master',
    };
  }
  return null;
}

/**
 * One current machine repair for the Fixes tab. Warnings and an already
 * approved quality report never become "regenerate master".
 */
export function resolveWeeklyRepairQueue(input: {
  items: WeeklyRepairItem[];
  artifacts: WeeklyRepairArtifact[];
  jobs: WeeklyRepairJob[];
}): WeeklyRepairQueue {
  const queued: WeeklyMachineRepair[] = [];
  const human = collectHumanWaits(input.items, input.artifacts);
  const flying = inFlightJob(input.jobs);
  if (flying) {
    return {
      current: {
        kind: 'wait',
        title: `${flying.job_type} is still running`,
        detail: 'Wait for the current job to finish. A second click would duplicate work.',
        jobId: flying.id,
        jobType: flying.job_type,
      },
      queued,
      human,
    };
  }

  const approved = qualityIsApproved(input.artifacts);
  const blockers = qualityHasBlockers(input.artifacts);
  const master = latestJob(input.jobs, 'editorial_master');
  if (!approved) {
    const repair = unapprovedMasterRepair(master, blockers);
    if (repair) return { current: repair, queued, human };
  }

  if (master?.status === 'succeeded' && !postMasterJobsExist(input.jobs) && (!blockers || approved)) {
    return {
      current: {
        kind: 'queue_post_master',
        title: 'Start visuals, social and PDF',
        detail: approved
          ? 'Quality is approved. Queue the rest of the studio against this working copy.'
          : 'Warnings and leftover scores do not hold socials. Queue the rest of the studio.',
        jobType: 'social_copy',
      },
      queued,
      human,
    };
  }

  for (const jobType of WEEKLY_REPAIR_PIPELINE_JOB_TYPES) {
    const failed = currentFailedForType(input.jobs, jobType, input.items);
    if (!failed) continue;
    if (jobType === 'editorial_master' && approved) continue;
    return { current: retryRepair(failed), queued, human };
  }

  return { current: null, queued, human };
}

export function resolveWeeklyRepairQueueFromWorkspace(workspace: {
  items: WeeklyRepairItem[];
  artifacts: WeeklyRepairArtifact[];
  generationJobs: WeeklyRepairJob[];
}): WeeklyRepairQueue {
  return resolveWeeklyRepairQueue({
    items: workspace.items,
    artifacts: workspace.artifacts,
    jobs: workspace.generationJobs,
  });
}
