import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
  data: true,
  error: null as { message: string } | null,
}));
const publicationMaybeSingle = vi.fn(async () => ({
  data: { editorial_date: '2026-08-24' } as { editorial_date: string } | null,
  error: null,
}));
const briefMaybeSingle = vi.fn(async () => ({
  data: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  error: null,
}));
const activeSetMaybeSingle = vi.fn(async () => ({
  data: { editorial_date: '2026-08-24' } as { editorial_date: string } | null,
  error: null,
}));
const publicationQuery = {
  select: vi.fn(() => publicationQuery),
  eq: vi.fn(() => publicationQuery),
  maybeSingle: publicationMaybeSingle,
};
const briefQuery = {
  select: vi.fn(() => briefQuery),
  eq: vi.fn(() => briefQuery),
  limit: vi.fn(() => briefQuery),
  maybeSingle: briefMaybeSingle,
};
const activeSetQuery = {
  select: vi.fn(() => activeSetQuery),
  eq: vi.fn(() => activeSetQuery),
  maybeSingle: activeSetMaybeSingle,
};
const from = vi.fn((table: string) => {
  if (table === 'daily_visual_publications') return publicationQuery;
  if (table === 'daily_visual_sets') return activeSetQuery;
  if (table === 'briefs') return briefQuery;
  throw new Error(`Unexpected direct table access: ${table}`);
});

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ from, rpc }) }));

const validBody = {
  eventType: 'visual_impression',
  dailyVisualSetId: '11111111-1111-4111-8111-111111111111',
  candidateId: '22222222-2222-4222-8222-222222222222',
  entrySource: 'entry_hero',
  lang: 'en',
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://aitodaybrief.com/api/daily/visual-engagement', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://aitodaybrief.com',
      'user-agent': 'Mozilla/5.0 private browser',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/daily/visual-engagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicationMaybeSingle.mockResolvedValue({
      data: { editorial_date: '2026-08-24' },
      error: null,
    });
    activeSetMaybeSingle.mockResolvedValue({
      data: { editorial_date: '2026-08-24' },
      error: null,
    });
    briefMaybeSingle.mockResolvedValue({ data: { id: validBody.dailyVisualSetId }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('records an approved active-pair outcome only through the atomic server gate', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      request({ ...validBody, eventType: 'story_open' }, { 'x-forwarded-for': '1.2.3.4' }),
    );

    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith('record_daily_visual_engagement', {
      p_daily_visual_set_id: validBody.dailyVisualSetId,
      p_candidate_id: validBody.candidateId,
      p_event_type: 'story_open',
      p_entry_source: 'entry_hero',
      p_lang: 'en',
      p_session_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const rpcArgs = rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(JSON.stringify(rpcArgs)).not.toContain('1.2.3.4');
    expect(JSON.stringify(rpcArgs)).not.toContain('private browser');
  });

  it('conservatively drops an outcome when the server gate finds no prior same-session impression', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const { POST } = await import('./route');
    const response = await POST(request({ ...validBody, eventType: 'scroll_50' }));

    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith(
      'record_daily_visual_engagement',
      expect.objectContaining({
        p_event_type: 'scroll_50',
        p_daily_visual_set_id: validBody.dailyVisualSetId,
        p_candidate_id: validBody.candidateId,
        p_lang: validBody.lang,
      }),
    );
  });

  it('rejects unapproved fields, event names, and malformed IDs before reaching the database', async () => {
    const { POST } = await import('./route');
    expect(
      (await POST(request({ ...validBody, url: 'https://should-not-be-accepted.example' }))).status,
    ).toBe(400);
    expect((await POST(request({ ...validBody, eventType: 'scroll_position' }))).status).toBe(400);
    expect((await POST(request({ ...validBody, candidateId: 'not-a-uuid' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an inactive or non-public candidate pair and drops bots without inserting', async () => {
    publicationMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { POST } = await import('./route');
    expect((await POST(request(validBody))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();

    activeSetMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(request(validBody))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();

    expect((await POST(request(validBody, { 'user-agent': 'Googlebot/2.1' }))).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enforces the same-site origin boundary', async () => {
    const { POST } = await import('./route');
    expect((await POST(request(validBody, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
