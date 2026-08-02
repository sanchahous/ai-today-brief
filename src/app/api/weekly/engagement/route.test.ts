import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn(async (_row: Record<string, unknown>) => ({
  error: null as { message: string } | null,
}));
const maybeSingle = vi.fn(async () => ({
  data: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  error: null,
}));
const digestQuery = {
  select: vi.fn(() => digestQuery),
  eq: vi.fn(() => digestQuery),
  maybeSingle,
};
const from = vi.fn((table: string) => (table === 'weekly_digests' ? digestQuery : { insert }));

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ from }) }));

const validBody = {
  eventType: 'digest_view',
  digestId: '11111111-1111-4111-8111-111111111111',
  revisionId: '22222222-2222-4222-8222-222222222222',
  locale: 'en',
  sessionKey: 'browser-session-key',
  channel: 'linkedin',
  hookAngle: 'Reliability became the product',
};

function request(body: unknown) {
  return new Request('https://aitodaybrief.com/api/weekly/engagement', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://aitodaybrief.com',
      'x-forwarded-for': '1.2.3.4',
      'user-agent': 'private browser value',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/weekly/engagement', () => {
  beforeEach(() => {
    insert.mockClear();
    maybeSingle.mockResolvedValue({ data: { id: validBody.digestId }, error: null });
  });

  it('stores a published digest event without raw IP or user-agent', async () => {
    const { POST } = await import('./route');
    const response = await POST(request(validBody));
    expect(response.status).toBe(204);
    const row = insert.mock.calls[0]![0];
    expect(row).toMatchObject({
      weekly_digest_id: validBody.digestId,
      revision_id: validBody.revisionId,
      event_type: 'digest_view',
      channel: 'linkedin',
      hook_angle: validBody.hookAngle,
    });
    expect(row.session_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain('1.2.3.4');
    expect(JSON.stringify(row)).not.toContain('private browser value');
  });

  it('rejects unknown events before inserting', async () => {
    const { POST } = await import('./route');
    const response = await POST(request({ ...validBody, eventType: 'email_address' }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects malformed origins and UUIDs before touching the database', async () => {
    const { POST } = await import('./route');
    const malformedOrigin = request(validBody);
    malformedOrigin.headers.set('origin', 'not a URL');
    expect((await POST(malformedOrigin)).status).toBe(403);
    expect((await POST(request({ ...validBody, revisionId: 'not-a-uuid' }))).status).toBe(400);
    expect((await POST(request({ ...validBody, storyId: 'not-a-uuid' }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('records a completed subscription as a conversion, not a click', async () => {
    const { POST } = await import('./route');
    const response = await POST(request({ ...validBody, eventType: 'signup_complete' }));
    expect(response.status).toBe(204);
    expect(insert.mock.calls[0]![0]).toMatchObject({ event_type: 'signup_complete' });
  });

  it('does not record an unpublished revision', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { POST } = await import('./route');
    const response = await POST(request(validBody));
    expect(response.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
});
