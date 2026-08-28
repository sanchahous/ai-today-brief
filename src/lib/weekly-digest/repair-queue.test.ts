import { describe, expect, it } from 'vitest';
import {
  isWeeklyMachineRepairAction,
  resolveWeeklyRepairQueue,
  type WeeklyRepairArtifact,
  type WeeklyRepairItem,
  type WeeklyRepairJob,
} from './repair-queue';

const ITEM_A = 'item-a';
const ITEM_B = 'item-b';
const ITEM_C = 'item-c';

const items: WeeklyRepairItem[] = [
  { id: ITEM_A, rank: 1, title_en: 'One' },
  { id: ITEM_B, rank: 2, title_en: 'Two' },
  { id: ITEM_C, rank: 3, title_en: 'Three' },
];

function job(partial: Partial<WeeklyRepairJob> & Pick<WeeklyRepairJob, 'id' | 'job_type'>): WeeklyRepairJob {
  return {
    created_at: '2026-08-28T10:00:00.000Z',
    status: 'succeeded',
    failure_code: null,
    last_error: null,
    output: {},
    ...partial,
  };
}

function warningQuality(reviewStatus = 'in_review'): WeeklyRepairArtifact {
  return {
    artifact_type: 'content_quality_report',
    locale: 'neutral',
    is_current: true,
    review_status: reviewStatus,
    generation_status: 'ready',
    revision_item_id: null,
    content: {
      score: 78,
      issues: [
        {
          code: 'story_length',
          message: 'feature story is 379 words; target is 400–650.',
          blocker: false,
        },
        {
          code: 'trust_attribution',
          message: '150 million downstream downloads is missing an inline source.',
          blocker: false,
        },
      ],
    },
  };
}

function blockerQuality(): WeeklyRepairArtifact {
  return {
    ...warningQuality(),
    content: {
      score: 70,
      issues: [{ code: 'language_mechanics', message: 'UK grammar', blocker: true }],
    },
  };
}

function approvedPacks(): WeeklyRepairArtifact[] {
  return [ITEM_A, ITEM_B, ITEM_C].map((id) => ({
    artifact_type: 'research_pack',
    locale: 'neutral',
    is_current: true,
    review_status: 'approved',
    generation_status: 'ready',
    revision_item_id: id,
    content: {},
  }));
}

describe('resolveWeeklyRepairQueue', () => {
  it('waits while a job is in-flight, including waiting', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality()],
      jobs: [
        job({
          id: 'master-1',
          job_type: 'editorial_master',
          status: 'waiting',
        }),
      ],
    });
    expect(queue.current?.kind).toBe('wait');
    expect(isWeeklyMachineRepairAction(queue.current?.kind)).toBe(false);
  });

  it('regenerates a stale master checkpoint instead of linked retry', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: approvedPacks(),
      jobs: [
        job({
          id: 'master-stale',
          job_type: 'editorial_master',
          status: 'failed',
          failure_code: 'resume_source_stale',
          last_error: 'Master resume source has no saved state',
        }),
      ],
    });
    expect(queue.current).toMatchObject({
      kind: 'regenerate_master',
      failureCode: 'resume_source_stale',
    });
  });

  it('resumes a failed master that still has saved segments', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: approvedPacks(),
      jobs: [
        job({
          id: 'master-partial',
          job_type: 'editorial_master',
          status: 'failed',
          failure_code: 'resumable',
          output: { master_run_state: { segments: { 'en:lede': {}, 'uk:lede': {} } } },
        }),
      ],
    });
    expect(queue.current).toMatchObject({
      kind: 'resume_master',
      sourceJobId: 'master-partial',
    });
  });

  it('does not treat leftover warnings as a required regenerate', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality('in_review')],
      jobs: [job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' })],
    });
    expect(queue.current?.kind).toBe('queue_post_master');
    expect(queue.current?.kind).not.toBe('regenerate_master');
  });

  it('does not regenerate after quality is already approved', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality('approved')],
      jobs: [job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' })],
    });
    expect(queue.current?.kind).toBe('queue_post_master');
    expect(queue.current?.detail).toMatch(/approved/i);
  });

  it('still regenerates coded blockers when the owner has not approved', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), blockerQuality()],
      jobs: [job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' })],
    });
    expect(queue.current?.kind).toBe('regenerate_master');
  });

  it('treats owner approval as final even if blockers remain on the report', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), { ...blockerQuality(), review_status: 'approved' }],
      jobs: [job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' })],
    });
    expect(queue.current?.kind).toBe('queue_post_master');
  });

  it('retries the current failed social_copy after a green master', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality('approved')],
      jobs: [
        job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' }),
        job({
          id: 'social-fail',
          job_type: 'social_copy',
          status: 'failed',
          last_error: 'quality_gate',
          created_at: '2026-08-28T12:00:00.000Z',
        }),
      ],
    });
    expect(queue.current).toMatchObject({
      kind: 'retry_job',
      jobId: 'social-fail',
      jobType: 'social_copy',
    });
  });

  it('retries the earliest failed story_image by story rank', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality('approved')],
      jobs: [
        job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' }),
        job({
          id: 'img-2',
          job_type: 'story_image',
          status: 'failed',
          input: { revision_item_id: ITEM_B },
          created_at: '2026-08-28T11:00:00.000Z',
        }),
        job({
          id: 'img-1',
          job_type: 'story_image',
          status: 'failed',
          input: { revision_item_id: ITEM_A },
          created_at: '2026-08-28T12:00:00.000Z',
        }),
      ],
    });
    expect(queue.current).toMatchObject({ kind: 'retry_job', jobId: 'img-1', jobType: 'story_image' });
  });

  it('ignores an old failed social_copy once a newer current run exists', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [...approvedPacks(), warningQuality('approved')],
      jobs: [
        job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' }),
        job({
          id: 'social-old',
          job_type: 'social_copy',
          status: 'failed',
          created_at: '2026-08-27T10:00:00.000Z',
        }),
        job({
          id: 'social-now',
          job_type: 'social_copy',
          status: 'succeeded',
          created_at: '2026-08-28T12:00:00.000Z',
        }),
        job({
          id: 'pdf-fail',
          job_type: 'pdf',
          status: 'failed',
          created_at: '2026-08-28T13:00:00.000Z',
        }),
      ],
    });
    expect(queue.current).toMatchObject({ kind: 'retry_job', jobType: 'pdf', jobId: 'pdf-fail' });
  });

  it('lists human upload gaps without turning them into the Fix button', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [
        ...approvedPacks(),
        warningQuality('approved'),
        {
          artifact_type: 'story_image',
          locale: 'neutral',
          is_current: true,
          review_status: 'approved',
          generation_status: 'ready',
          revision_item_id: ITEM_A,
          content: {},
        },
      ],
      jobs: [
        job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' }),
        job({ id: 'social-ok', job_type: 'social_copy', status: 'succeeded' }),
      ],
    });
    expect(queue.current).toBeNull();
    expect(queue.human.some((item) => item.tab === 'visuals')).toBe(true);
    expect(queue.human.some((item) => item.tab === 'video')).toBe(true);
    expect(queue.human.every((item) => item.tab !== 'social')).toBe(true);
  });

  it('does not offer regenerate when only dimension scores are low', () => {
    const queue = resolveWeeklyRepairQueue({
      items,
      artifacts: [
        ...approvedPacks(),
        {
          artifact_type: 'content_quality_report',
          locale: 'neutral',
          is_current: true,
          review_status: 'in_review',
          generation_status: 'ready',
          revision_item_id: null,
          content: { score: 55, issues: [], dimensions: [{ name: 'naturalness', score: 55 }] },
        },
      ],
      jobs: [job({ id: 'master-ok', job_type: 'editorial_master', status: 'succeeded' })],
    });
    expect(queue.current?.kind).toBe('queue_post_master');
  });
});
