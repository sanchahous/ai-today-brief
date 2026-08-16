import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/lib/database.types';
import { contentStudioMasterKey, contentStudioResearchKey } from './content-studio-queue';

const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
  data: {},
  error: null as { message: string } | null,
}));

type QueryResult = { data: unknown; error: { message: string } | null };

const tables: {
  weekly_digests: QueryResult;
  weekly_digest_revision_items: QueryResult;
  weekly_digest_generation_jobs: QueryResult;
} = {
  weekly_digests: { data: null, error: null },
  weekly_digest_revision_items: { data: null, error: null },
  weekly_digest_generation_jobs: { data: [], error: null },
};

function chainFor(table: keyof typeof tables) {
  const result = () => tables[table];
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.in = self;
  chain.order = () => Promise.resolve(result());
  chain.single = () => Promise.resolve(result());
  chain.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return chain;
}

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: (table: keyof typeof tables) => chainFor(table),
  }),
}));

import { retryWeeklyContentStudio, startWeeklyContentStudio } from './orchestrator';

const digestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const featureIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
const retryNonce = '99999999-9999-4999-8999-999999999999';

function sixItems() {
  return [
    ...featureIds.map((id, index) => ({ id, rank: index + 1 })),
    { id: '44444444-4444-4444-8444-444444444444', rank: 4 },
    { id: '55555555-5555-4555-8555-555555555555', rank: 5 },
    { id: '66666666-6666-4666-8666-666666666666', rank: 6 },
  ];
}

function queuedKeys() {
  return rpc.mock.calls.map(([, args]) => String(args?.p_idempotency_key ?? ''));
}

describe('Content Studio queueing', () => {
  beforeEach(() => {
    process.env.WEEKLY_CONTENT_STUDIO_V2 = 'production';
    rpc.mockClear();
    tables.weekly_digests = {
      data: { id: digestId, active_revision_id: revisionId, status: 'in_review' },
      error: null,
    };
    tables.weekly_digest_revision_items = { data: sixItems(), error: null };
    tables.weekly_digest_generation_jobs = { data: [], error: null };
  });

  it('startWeeklyContentStudio uses stable keys so composer stays idempotent', async () => {
    const result = await startWeeklyContentStudio(digestId, revisionId);
    expect(result.queued).toEqual([
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[0] }),
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[1] }),
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[2] }),
      contentStudioMasterKey({ digestId, revisionId }),
    ]);
    expect(queuedKeys().every((key) => !key.includes(':retry:'))).toBe(true);
  });

  it('retry after succeeded research mints unique research keys and leaves waiting master', async () => {
    tables.weekly_digest_generation_jobs = {
      data: [
        ...featureIds.map((id) => ({
          job_type: 'research_pack',
          status: 'succeeded',
          input: { revision_item_id: id } as Json,
        })),
        { job_type: 'editorial_master', status: 'waiting', input: {} as Json },
      ],
      error: null,
    };

    const result = await retryWeeklyContentStudio(digestId, revisionId, retryNonce);
    expect(result.queued).toEqual(
      featureIds.map((itemId) =>
        contentStudioResearchKey({ digestId, revisionId, itemId, retryNonce }),
      ),
    );
    expect(result.skipped).toEqual([contentStudioMasterKey({ digestId, revisionId })]);
    expect(queuedKeys()).toHaveLength(3);
    expect(queuedKeys().every((key) => key.includes(`:retry:${retryNonce}`))).toBe(true);
    expect(queuedKeys().some((key) => key.endsWith(':master'))).toBe(false);
  });

  it('retry skips research slots that are already queued or running', async () => {
    tables.weekly_digest_generation_jobs = {
      data: [
        {
          job_type: 'research_pack',
          status: 'running',
          input: { revision_item_id: featureIds[0] } as Json,
        },
        {
          job_type: 'research_pack',
          status: 'succeeded',
          input: { revision_item_id: featureIds[1] } as Json,
        },
        {
          job_type: 'research_pack',
          status: 'queued',
          input: { revision_item_id: featureIds[2] } as Json,
        },
        { job_type: 'editorial_master', status: 'waiting', input: {} as Json },
      ],
      error: null,
    };

    const result = await retryWeeklyContentStudio(digestId, revisionId, retryNonce);
    expect(result.queued).toEqual([
      contentStudioResearchKey({
        digestId,
        revisionId,
        itemId: featureIds[1],
        retryNonce,
      }),
    ]);
    expect(result.skipped).toContain(
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[0] }),
    );
    expect(result.skipped).toContain(
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[2] }),
    );
    expect(result.skipped).toContain(contentStudioMasterKey({ digestId, revisionId }));
  });

  it('retry on a fresh revision uses the same stable keys as first start', async () => {
    const result = await retryWeeklyContentStudio(digestId, revisionId, retryNonce);
    expect(result.queued).toEqual([
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[0] }),
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[1] }),
      contentStudioResearchKey({ digestId, revisionId, itemId: featureIds[2] }),
      contentStudioMasterKey({ digestId, revisionId }),
    ]);
    expect(result.queued.some((key) => key.includes(':retry:'))).toBe(false);
  });

  it('does not mint a second master after one already succeeded', async () => {
    tables.weekly_digest_generation_jobs = {
      data: [
        ...featureIds.map((id) => ({
          job_type: 'research_pack',
          status: 'succeeded',
          input: { revision_item_id: id } as Json,
        })),
        { job_type: 'editorial_master', status: 'succeeded', input: {} as Json },
      ],
      error: null,
    };

    const result = await retryWeeklyContentStudio(digestId, revisionId, retryNonce);
    expect(result.queued).toHaveLength(3);
    expect(result.skipped).toContain(contentStudioMasterKey({ digestId, revisionId }));
    expect(queuedKeys().some((key) => key.includes(':master'))).toBe(false);
  });

  it('refuses to start after publication begins', async () => {
    tables.weekly_digests = {
      data: { id: digestId, active_revision_id: revisionId, status: 'published' },
      error: null,
    };
    await expect(retryWeeklyContentStudio(digestId, revisionId, retryNonce)).rejects.toThrow(
      /after publication begins/,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
