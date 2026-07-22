import { describe, expect, it, vi } from 'vitest';
import { fetchWithRetry, retryAfterMs } from './http';

describe('retryAfterMs', () => {
  it('parses seconds, dates, invalid values, and caps excessive waits', () => {
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': '12' } }))).toBe(12_000);
    expect(
      retryAfterMs(
        new Response(null, { headers: { 'retry-after': 'Wed, 22 Jul 2026 12:00:10 GMT' } }),
        Date.parse('2026-07-22T12:00:00Z'),
      ),
    ).toBe(10_000);
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': '300' } }))).toBe(60_000);
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': 'later' } }))).toBeNull();
  });
});

describe('fetchWithRetry', () => {
  it('honours Retry-After before retrying a transient response', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const sleepFn = vi.fn(async () => undefined);

    const response = await fetchWithRetry('https://example.test', {}, 2, fetchFn, sleepFn);

    expect(response?.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(3000);
  });
});
