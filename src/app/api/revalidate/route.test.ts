import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CONTENT_TAG } from '@/lib/public-content-tag';
import { POST } from './route';

function post(body: unknown, auth = 'Bearer s3cret'): Request {
  return new Request('https://aitodaybrief.com/api/revalidate', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    vi.mocked(revalidatePath).mockReset();
    vi.mocked(revalidateTag).mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a wrong secret', async () => {
    const res = await POST(post({ paths: ['/en'] }, 'Bearer nope'));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    const res = await POST(post('{'));
    expect(res.status).toBe(400);
  });

  it('revalidates caller paths plus hubs without a site-wide purge', async () => {
    const res = await POST(post({ paths: ['/en/some-brief'] }));
    const json = (await res.json()) as { paths: string[]; purgedAll: boolean };
    expect(res.status).toBe(200);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/en/some-brief');
    expect(revalidatePath).toHaveBeenCalledWith('/uk/news');
    expect(json.paths).toContain('/en/some-brief');
    expect(json.purgedAll).toBe(false);
  });

  it('purges the public-content tag only when asked', async () => {
    const res = await POST(post({ purgeAll: true }));
    const json = (await res.json()) as { purgedAll: boolean };
    expect(revalidateTag).toHaveBeenCalledWith(PUBLIC_CONTENT_TAG, 'max');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(json.purgedAll).toBe(true);
  });
});
