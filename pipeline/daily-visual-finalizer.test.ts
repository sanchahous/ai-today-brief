import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineDb } from './db';

const storage = vi.hoisted(() => ({
  find: vi.fn(),
  load: vi.fn(),
  persist: vi.fn(),
  promote: vi.fn(),
  recordQa: vi.fn(),
  renderFallback: vi.fn(),
}));

const providers = vi.hoisted(() => ({
  direction: vi.fn(),
  vision: vi.fn(),
}));

vi.mock('./daily-visual-storage', () => ({
  DAILY_VISUAL_MASTER_HEIGHT: 900,
  DAILY_VISUAL_MASTER_WIDTH: 1600,
  findPrivateDailyVisualCandidate: storage.find,
  loadPrivateDailyVisualCandidateBytes: storage.load,
  persistPrivateDailyVisualCandidate: storage.persist,
  promoteDailyVisualCandidate: storage.promote,
  recordDailyVisualQa: storage.recordQa,
  renderBrandedDailyVisualFallback: storage.renderFallback,
}));

vi.mock('./daily-visual-direction-provider', () => ({
  generateDailyVisualDirectionSingleAttempt: providers.direction,
}));

vi.mock('./providers/vision', () => ({
  generateWithVisionSingleAttempt: providers.vision,
}));

import { buildDailyVisualSnapshot, finalizeDailyVisual } from './daily-visual-finalizer';

beforeEach(() => {
  vi.clearAllMocks();
});

const brief = {
  id: 'brief-1',
  date: '2026-08-24',
  edition: 1,
  slug: 'ai-daily-2026-08-24',
  title_en: 'Daily AI brief',
  title_uk: 'Щоденний AI-дайджест',
  intro_en: 'A concise daily introduction.',
  intro_uk: 'Короткий щоденний вступ.',
  status: 'published',
};

describe('buildDailyVisualSnapshot', () => {
  it('uses the lead daily page while sorting all approved day stories deterministically', () => {
    const snapshot = buildDailyVisualSnapshot(
      '2026-08-24',
      [brief, { ...brief, id: 'brief-2', edition: 2, slug: 'ai-daily-2026-08-24-2' }],
      [
        {
          id: 'second',
          brief_id: 'brief-2',
          rank: 1,
          title_en: 'Second edition story',
          title_uk: 'Історія другого випуску',
          summary_en: 'A later approved change.',
          summary_uk: 'Пізніша затверджена зміна.',
          why_matters_en: 'It affects builders.',
          why_matters_uk: 'Це впливає на розробників.',
          review_status: 'approved',
        },
        {
          id: 'first',
          brief_id: 'brief-1',
          rank: 2,
          title_en: 'Lead edition story',
          title_uk: 'Історія головного випуску',
          summary_en: 'The main approved change.',
          summary_uk: 'Головна затверджена зміна.',
          why_matters_en: 'It changes an engineering choice.',
          why_matters_uk: 'Це змінює інженерний вибір.',
          review_status: 'approved',
        },
        {
          id: 'rejected',
          brief_id: 'brief-1',
          rank: 1,
          title_en: 'Rejected story',
          title_uk: 'Відхилена історія',
          summary_en: 'No.',
          summary_uk: 'Ні.',
          why_matters_en: 'No.',
          why_matters_uk: 'Ні.',
          review_status: 'rejected',
        },
      ],
    );
    expect(snapshot?.canonicalSlug).toBe('ai-daily-2026-08-24');
    expect(snapshot?.stories.map((story) => story.id)).toEqual(['first', 'second']);
  });

  it('does not construct a paid render request without a published lead slug and an approved story', () => {
    expect(buildDailyVisualSnapshot('2026-08-24', [{ ...brief, slug: null }], [])).toBeNull();
  });
});

function readonlyQuery(data: unknown) {
  const result = { data, error: null };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => result,
  };
  return query;
}

describe('finalizeDailyVisual lease fencing', () => {
  it('stops without finishing or activating when the worker-state RPC rejects its claim', async () => {
    storage.renderFallback.mockResolvedValue(Buffer.from('fallback'));
    storage.persist.mockResolvedValue({ id: 'fallback-candidate' });
    const rpc = vi.fn(async (name: string) => {
      if (name === 'begin_daily_visual_finalization') {
        return {
          data: [
            {
              should_run: true,
              daily_visual_set_id: 'visual-set',
              daily_visual_job_id: 'visual-job',
              claim_token: 'live-claim',
              reason: 'claimed',
            },
          ],
          error: null,
        };
      }
      if (name === 'write_daily_visual_worker_set_state') {
        return { data: false, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const db = {
      from(table: string) {
        if (table === 'briefs') return readonlyQuery([brief]);
        if (table === 'brief_items') {
          return readonlyQuery([
            {
              id: 'approved-story',
              brief_id: brief.id,
              rank: 1,
              title_en: 'Approved story',
              title_uk: 'Затверджена історія',
              summary_en: 'A material change.',
              summary_uk: 'Суттєва зміна.',
              why_matters_en: 'It changes a technical choice.',
              why_matters_uk: 'Це змінює технічний вибір.',
              review_status: 'approved',
            },
          ]);
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    };

    // The production client has many table methods; this fixture reaches only
    // the two read chains and RPC calls above.
    const result = await finalizeDailyVisual(db as unknown as PipelineDb, '2026-08-24');

    expect(result).toMatchObject({ status: 'skipped', reason: 'claim_lost_or_expired' });
    expect(rpc).toHaveBeenCalledWith(
      'write_daily_visual_worker_set_state',
      expect.objectContaining({
        p_daily_visual_set_id: 'visual-set',
        p_job_id: 'visual-job',
        p_claim_token: 'live-claim',
        p_mutation: 'fallback_candidate',
      }),
    );
    expect(rpc).not.toHaveBeenCalledWith('finish_daily_visual_job', expect.anything());
    expect(rpc).not.toHaveBeenCalledWith('activate_daily_visual_candidate', expect.anything());
  });
});

const FROZEN_DIRECTION = {
  displayTitleEn: 'Frozen direction A explains the change',
  displayTitleUk: 'Зафіксований напрям A пояснює зміну',
  visualThesisEn: 'A selective pathway turns a complex AI system into a practical result.',
  visualThesisUk: 'Вибірковий шлях перетворює складну AI-систему на практичний результат.',
  overlayStatEn: null,
  overlayStatUk: null,
  subject: 'a modular technical engine with one chosen active route',
  action: 'the chosen route carries one completed result to a practical endpoint',
  setting: 'a calm, materially grounded engineering workspace at dusk',
  mechanism: 'one narrow pathway activates only the needed modules while the rest stay quiet',
  consequence: 'a compact usable output reaches a real technical destination with less waste',
  scene:
    'A modular technical engine occupies a calm, materially grounded engineering workspace at dusk. One narrow active route carries a completed result from selected modules to a compact practical endpoint while the inactive structure stays quiet, with premium editorial lighting and no visible words or screens.',
};

const PRIMARY_CANDIDATE = {
  id: 'primary-from-direction-a',
  kind: 'ai_primary' as const,
  storageBucket: 'daily-visual-private',
  storagePath: '2026-08-24/visual-set/primary-a.webp',
  sha256: 'a'.repeat(64),
  width: 1600,
  height: 900,
  bytes: 100,
};

function maybeSingleQuery(data: unknown) {
  const result = Promise.resolve({ data, error: null });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => result,
  };
  return query;
}

describe('finalizeDailyVisual immutable direction retry', () => {
  it('reuses the stored direction with its immutable image instead of generating a new direction', async () => {
    storage.renderFallback.mockResolvedValue(Buffer.from('fallback'));
    storage.persist.mockResolvedValue({
      id: 'fallback-candidate',
      kind: 'branded_fallback',
      storageBucket: 'daily-visual-private',
      storagePath: '2026-08-24/visual-set/fallback.webp',
      sha256: 'f'.repeat(64),
      width: 1600,
      height: 900,
      bytes: 100,
    });
    storage.find.mockResolvedValue(PRIMARY_CANDIDATE);
    storage.load.mockResolvedValue(Buffer.from('primary-image-from-direction-a'));
    storage.promote.mockResolvedValue({
      publicUrl: 'https://cdn.example.test/daily/a.webp',
      width: 1600,
      height: 900,
    });

    const rpc = vi.fn(async (name: string) => {
      if (name === 'begin_daily_visual_finalization') {
        return {
          data: [
            {
              should_run: true,
              daily_visual_set_id: 'visual-set',
              daily_visual_job_id: 'visual-job',
              claim_token: 'live-claim',
              reason: 'claimed',
            },
          ],
          error: null,
        };
      }
      if (
        name === 'write_daily_visual_worker_set_state' ||
        name === 'activate_daily_visual_candidate'
      ) {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const db = {
      from(table: string) {
        if (table === 'briefs') return readonlyQuery([brief]);
        if (table === 'brief_items') {
          return readonlyQuery([
            {
              id: 'approved-story',
              brief_id: brief.id,
              rank: 1,
              title_en: 'Approved story',
              title_uk: 'Затверджена історія',
              summary_en: 'A material change.',
              summary_uk: 'Суттєва зміна.',
              why_matters_en: 'It changes a technical choice.',
              why_matters_uk: 'Це змінює технічний вибір.',
              review_status: 'approved',
            },
          ]);
        }
        if (table === 'daily_visual_sets') {
          return maybeSingleQuery({
            direction: { ...FROZEN_DIRECTION, daily_visual_direction_source: 'generated' },
          });
        }
        if (table === 'daily_visual_publications') return maybeSingleQuery(null);
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    };
    const generateDirection = vi.fn(async () => ({
      text: JSON.stringify({
        ...FROZEN_DIRECTION,
        displayTitleEn: 'Unsafe new direction B',
        displayTitleUk: 'Небезпечний новий напрям B',
      }),
      provider: 'test',
      model: 'test',
      usage: { promptTokens: 0, outputTokens: 0, costUsd: 0, costSource: 'reported' as const },
    }));
    const generateImage = vi.fn();

    const result = await finalizeDailyVisual(db as unknown as PipelineDb, '2026-08-24', {
      generateDirection,
      generateImage,
      critique: async () => ({
        passed: true,
        critique: {
          passed: true,
          scores: { overall: 100, news_legibility: 100 },
          blockers: [],
          repairDirective: { changeSeed: false, suggestedActions: [] },
        },
        stages: [],
        repairPatches: [],
      }),
      composeSocial: async () => undefined,
      revalidate: async () => undefined,
    });

    expect(result).toMatchObject({
      status: 'activated',
      activeCandidateId: PRIMARY_CANDIDATE.id,
      reason: 'reused_primary_passed',
    });
    expect(generateDirection).not.toHaveBeenCalled();
    expect(generateImage).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'activate_daily_visual_candidate',
      expect.objectContaining({
        p_candidate_id: PRIMARY_CANDIDATE.id,
        p_alt_en: expect.stringContaining(FROZEN_DIRECTION.displayTitleEn),
      }),
    );
  });

  it('uses only the bounded attempt-one direction and primary slots after a fallback direction', async () => {
    const renderedBytes = Buffer.alloc(80_000, 1);
    const retryCandidate = { ...PRIMARY_CANDIDATE, id: 'retry-primary-candidate' };
    storage.renderFallback.mockResolvedValue(Buffer.from('fallback'));
    storage.persist.mockImplementation(async (input: { kind: string }) =>
      input.kind === 'branded_fallback'
        ? {
            id: 'fallback-candidate',
            kind: 'branded_fallback',
            storageBucket: 'daily-visual-private',
            storagePath: '2026-08-24/visual-set/fallback.webp',
            sha256: 'f'.repeat(64),
            width: 1600,
            height: 900,
            bytes: 100,
          }
        : retryCandidate,
    );
    storage.find.mockResolvedValue(null);
    storage.load.mockResolvedValue(renderedBytes);
    storage.promote.mockResolvedValue({
      publicUrl: 'https://cdn.example.test/daily/retry.webp',
      width: 1600,
      height: 900,
    });

    const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'begin_daily_visual_finalization') {
        return {
          data: [
            {
              should_run: true,
              daily_visual_set_id: 'visual-set',
              daily_visual_job_id: 'visual-job',
              claim_token: 'live-claim',
              reason: 'claimed',
              retry_mode: 'direction_once',
            },
          ],
          error: null,
        };
      }
      if (name === 'reserve_daily_visual_budget') {
        return {
          data: [
            {
              reservation_id: `${args?.p_candidate_kind}-${args?.p_attempt_number}`,
              granted: true,
              reason: 'reserved',
            },
          ],
          error: null,
        };
      }
      if (name === 'settle_daily_visual_budget') return { data: true, error: null };
      if (
        name === 'write_daily_visual_worker_set_state' ||
        name === 'activate_daily_visual_candidate'
      ) {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const db = {
      from(table: string) {
        if (table === 'briefs') return readonlyQuery([brief]);
        if (table === 'brief_items') {
          return readonlyQuery([
            {
              id: 'approved-story',
              brief_id: brief.id,
              rank: 1,
              title_en: 'Approved story',
              title_uk: 'Затверджена історія',
              summary_en: 'A material change.',
              summary_uk: 'Суттєва зміна.',
              why_matters_en: 'It changes a technical choice.',
              why_matters_uk: 'Це змінює технічний вибір.',
              review_status: 'approved',
            },
          ]);
        }
        if (table === 'daily_visual_sets') {
          return maybeSingleQuery({
            direction: { ...FROZEN_DIRECTION, daily_visual_direction_source: 'fallback' },
          });
        }
        if (table === 'daily_visual_publications') return maybeSingleQuery(null);
        if (table === 'generation_cost_events') return { insert: async () => ({ error: null }) };
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    };

    const result = await finalizeDailyVisual(db as unknown as PipelineDb, '2026-08-24', {
      generateDirection: async () => ({
        text: JSON.stringify(FROZEN_DIRECTION),
        provider: 'test',
        model: 'test',
        usage: { promptTokens: 1, outputTokens: 1, costUsd: 0.001, costSource: 'reported' },
      }),
      generateImage: async () => ({
        bytes: renderedBytes,
        mimeType: 'image/webp',
        provider: 'openai',
        model: 'gpt-image-2',
      }),
      critique: async () => ({
        passed: true,
        critique: {
          passed: true,
          scores: { overall: 100, news_legibility: 100 },
          blockers: [],
          repairDirective: { changeSeed: false, suggestedActions: [] },
        },
        stages: [],
        repairPatches: [],
      }),
      composeSocial: async () => undefined,
      revalidate: async () => undefined,
    });

    expect(result).toMatchObject({
      status: 'activated',
      activeCandidateId: retryCandidate.id,
      reason: 'direction_retry_primary_passed',
    });
    expect(rpc).toHaveBeenCalledWith(
      'reserve_daily_visual_budget',
      expect.objectContaining({ p_candidate_kind: 'direction', p_attempt_number: 1 }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'reserve_daily_visual_budget',
      expect.objectContaining({ p_candidate_kind: 'ai_primary', p_attempt_number: 1 }),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      'reserve_daily_visual_budget',
      expect.objectContaining({ p_candidate_kind: 'ai_repair' }),
    );
    expect(storage.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'ai_primary', attemptNumber: 1 }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'activate_daily_visual_candidate',
      expect.objectContaining({ p_candidate_id: retryCandidate.id }),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      'activate_daily_visual_candidate',
      expect.objectContaining({ p_candidate_id: 'fallback-candidate' }),
    );
  });
});

describe('finalizeDailyVisual paid-call budget fencing', () => {
  it('reserves each direction, render, and QA stage before its one provider call', async () => {
    const order: string[] = [];
    const renderedBytes = Buffer.alloc(80_000, 1);
    const generatedCandidate = { ...PRIMARY_CANDIDATE, id: 'new-primary-candidate' };
    storage.renderFallback.mockResolvedValue(Buffer.from('fallback'));
    storage.persist.mockImplementation(async (input: { kind: string }) => {
      if (input.kind === 'branded_fallback') {
        return {
          id: 'fallback-candidate',
          kind: 'branded_fallback',
          storageBucket: 'daily-visual-private',
          storagePath: '2026-08-24/visual-set/fallback.webp',
          sha256: 'f'.repeat(64),
          width: 1600,
          height: 900,
          bytes: 100,
        };
      }
      return generatedCandidate;
    });
    storage.find.mockResolvedValue(null);
    storage.load.mockResolvedValue(renderedBytes);
    storage.promote.mockResolvedValue({
      publicUrl: 'https://cdn.example.test/daily/generated.webp',
      width: 1600,
      height: 900,
    });

    providers.direction.mockImplementation(async () => {
      order.push('direction');
      return {
        text: JSON.stringify(FROZEN_DIRECTION),
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        usage: { promptTokens: 1, outputTokens: 1, costUsd: 0.001, costSource: 'reported' },
      };
    });
    const visionResponses = [
      JSON.stringify({
        overall: 92,
        dimensions: { no_text: 95, craft: 90, brand_safe: 92, news_legibility: 90 },
        blockers: [],
        notes: 'Clean single scene.',
      }),
      JSON.stringify({
        overall: 91,
        dimensions: {
          no_text: 95,
          craft: 90,
          brand_safe: 92,
          news_legibility: 90,
          context_fidelity: 89,
          mechanism_legibility: 88,
          consequence_legibility: 87,
          instant_comprehension: 89,
        },
        blockers: [],
        pixel_evidence: {
          context: 'A modular technical engine is visible.',
          mechanism: 'One narrow active route visibly selects the needed modules.',
          consequence: 'The active route reaches a compact practical endpoint.',
          headline_pairing: 'The selected route makes the thesis visible.',
        },
        notes: 'Causal path is readable.',
      }),
    ];
    providers.vision.mockImplementation(async () => {
      order.push('vision');
      return {
        text: visionResponses.shift() ?? '',
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        usage: { promptTokens: 1, outputTokens: 1, costUsd: 0.001, costSource: 'reported' },
      };
    });

    const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'begin_daily_visual_finalization') {
        return {
          data: [
            {
              should_run: true,
              daily_visual_set_id: 'visual-set',
              daily_visual_job_id: 'visual-job',
              claim_token: 'live-claim',
              reason: 'claimed',
            },
          ],
          error: null,
        };
      }
      if (name === 'reserve_daily_visual_budget') {
        const step = String(args?.p_candidate_kind);
        order.push(`reserve:${step}`);
        return {
          data: [
            {
              reservation_id: `${step}-${args?.p_attempt_number ?? 0}`,
              granted: true,
              reason: 'reserved',
            },
          ],
          error: null,
        };
      }
      if (name === 'settle_daily_visual_budget') {
        order.push(`settle:${String(args?.p_status)}`);
        return { data: true, error: null };
      }
      if (
        name === 'write_daily_visual_worker_set_state' ||
        name === 'activate_daily_visual_candidate'
      ) {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const db = {
      from(table: string) {
        if (table === 'briefs') return readonlyQuery([brief]);
        if (table === 'brief_items') {
          return readonlyQuery([
            {
              id: 'approved-story',
              brief_id: brief.id,
              rank: 1,
              title_en: 'Approved story',
              title_uk: 'Затверджена історія',
              summary_en: 'A material change.',
              summary_uk: 'Суттєва зміна.',
              why_matters_en: 'It changes a technical choice.',
              why_matters_uk: 'Це змінює технічний вибір.',
              review_status: 'approved',
            },
          ]);
        }
        if (table === 'daily_visual_sets') return maybeSingleQuery({ direction: null });
        if (table === 'daily_visual_publications') return maybeSingleQuery(null);
        if (table === 'generation_cost_events') {
          return { insert: async () => ({ error: null }) };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    };
    const generateImage = vi.fn(async () => {
      order.push('image');
      return {
        bytes: renderedBytes,
        mimeType: 'image/webp' as const,
        provider: 'openai' as const,
        model: 'gpt-image-2' as const,
      };
    });

    const result = await finalizeDailyVisual(db as unknown as PipelineDb, '2026-08-24', {
      generateImage,
      composeSocial: async () => undefined,
      revalidate: async () => undefined,
    });

    expect(result).toMatchObject({ status: 'activated', activeCandidateId: generatedCandidate.id });
    expect(order.indexOf('reserve:direction')).toBeLessThan(order.indexOf('direction'));
    expect(order.indexOf('reserve:ai_primary')).toBeLessThan(order.indexOf('image'));
    expect(order.indexOf('reserve:qa_image_only')).toBeLessThan(order.indexOf('vision'));
    expect(order.indexOf('reserve:qa_story_semantic')).toBeLessThan(order.lastIndexOf('vision'));
    expect(rpc).toHaveBeenCalledWith(
      'settle_daily_visual_budget',
      expect.objectContaining({ p_status: 'held_for_reconcile' }),
    );
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(providers.direction).toHaveBeenCalledTimes(1);
    expect(providers.vision).toHaveBeenCalledTimes(2);
  });
});
