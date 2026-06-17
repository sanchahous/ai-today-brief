import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null as { message: string } | null }));
const from = vi.fn((_table: string) => ({ insert }));

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from }),
}));

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://aitodaybrief.com/api/ev', {
    method: 'POST',
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function lastRow(): Record<string, unknown> {
  return insert.mock.calls[insert.mock.calls.length - 1]![0];
}

describe('POST /api/ev', () => {
  beforeEach(() => {
    insert.mockClear();
    from.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects invalid JSON without inserting', async () => {
    const { POST } = await import('./route');
    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an unknown event_type', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({ slug: 'x', type: 'definitely-not-allowed' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects when neither id nor slug is present', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({ type: 'view' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('accepts a valid event and stores a PII-free row', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      post({ slug: 'my-item', type: 'post_expand', lang: 'en' }, { 'x-forwarded-for': '1.2.3.4' }),
    );
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledTimes(1);
    const row = lastRow();
    expect(row.event_type).toBe('post_expand');
    expect(row.slug).toBe('my-item');
    expect(row.lang).toBe('en');
    expect(row.ua_class).toBe('human');
    expect(row.session_hash).toHaveLength(64); // sha256 hex
    // raw ip/ua must never be persisted
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('1.2.3.4');
    expect(serialized).not.toContain('Mozilla');
  });

  it('maps a uuid id to brief_item_id', async () => {
    const { POST } = await import('./route');
    const uuid = '11111111-2222-3333-4444-555555555555';
    await POST(post({ id: uuid, slug: 's', type: 'view' }));
    expect(lastRow().brief_item_id).toBe(uuid);
  });

  it('ignores a non-uuid id (brief_item_id stays null, slug carries it)', async () => {
    const { POST } = await import('./route');
    await POST(post({ id: 'not-a-uuid', slug: 's', type: 'view' }));
    expect(lastRow().brief_item_id).toBeNull();
    expect(lastRow().slug).toBe('s');
  });

  it('drops obvious bots without inserting', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({ slug: 'x', type: 'view' }, { 'user-agent': 'Googlebot/2.1' }));
    expect(res.status).toBe(204);
    expect(insert).not.toHaveBeenCalled();
  });

  it('session_hash changes with the salt (rotation)', async () => {
    const { POST } = await import('./route');
    await POST(post({ slug: 'x', type: 'view' }, { 'x-forwarded-for': '9.9.9.9' }));
    const h1 = lastRow().session_hash;
    vi.stubEnv('EVENT_SALT', 'a-different-salt');
    insert.mockClear();
    await POST(post({ slug: 'x', type: 'view' }, { 'x-forwarded-for': '9.9.9.9' }));
    expect(lastRow().session_hash).not.toBe(h1);
  });
});
