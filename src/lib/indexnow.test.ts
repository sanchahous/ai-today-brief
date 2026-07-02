import { describe, expect, it, vi } from 'vitest';
import {
  buildIndexNowPayload,
  INDEXNOW_ENDPOINT,
  sanitizeUrls,
  siteHost,
  submitToIndexNow,
} from '@/lib/indexnow';

const SITE = 'https://aitodaybrief.com';

describe('siteHost', () => {
  it('returns the host of a valid URL', () => {
    expect(siteHost(SITE)).toBe('aitodaybrief.com');
  });

  it('returns empty string for an unparsable URL', () => {
    expect(siteHost('not a url')).toBe('');
  });
});

describe('sanitizeUrls', () => {
  it('keeps same-host absolute URLs and preserves order', () => {
    expect(sanitizeUrls([`${SITE}/en`, `${SITE}/uk`], SITE)).toEqual([
      `${SITE}/en`,
      `${SITE}/uk`,
    ]);
  });

  it('dedupes and drops cross-host, relative and blank URLs', () => {
    const out = sanitizeUrls(
      [`${SITE}/en`, `${SITE}/en`, 'https://evil.com/x', '/relative', '', '   '],
      SITE,
    );
    expect(out).toEqual([`${SITE}/en`]);
  });

  it('returns [] when the site URL itself is invalid', () => {
    expect(sanitizeUrls([`${SITE}/en`], 'garbage')).toEqual([]);
  });
});

describe('buildIndexNowPayload', () => {
  it('returns null without a key', () => {
    expect(buildIndexNowPayload([`${SITE}/en`], { key: '', siteUrl: SITE })).toBeNull();
  });

  it('returns null when no URL survives sanitisation', () => {
    expect(buildIndexNowPayload(['https://evil.com/x'], { key: 'k', siteUrl: SITE })).toBeNull();
  });

  it('builds host, key, keyLocation and urlList', () => {
    const payload = buildIndexNowPayload([`${SITE}/en`, `${SITE}/uk`], {
      key: 'abc123',
      siteUrl: SITE,
    });
    expect(payload).toEqual({
      host: 'aitodaybrief.com',
      key: 'abc123',
      keyLocation: `${SITE}/indexnow-key.txt`,
      urlList: [`${SITE}/en`, `${SITE}/uk`],
    });
  });
});

describe('submitToIndexNow', () => {
  it('skips (no request) when there is no key', async () => {
    const fetchImpl = vi.fn();
    const result = await submitToIndexNow([`${SITE}/en`], { key: '', siteUrl: SITE, fetchImpl });
    expect(result).toEqual({ ok: false, skipped: true, submitted: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs the payload to the aggregator and reports success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    const result = await submitToIndexNow([`${SITE}/en`, `${SITE}/uk`], {
      key: 'abc123',
      siteUrl: SITE,
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, status: 200, submitted: 2 });
    expect(fetchImpl).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.urlList).toEqual([`${SITE}/en`, `${SITE}/uk`]);
  });

  it('reports the non-ok status without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response);
    const result = await submitToIndexNow([`${SITE}/en`], { key: 'k', siteUrl: SITE, fetchImpl });
    expect(result).toEqual({ ok: false, status: 422, submitted: 1 });
  });

  it('swallows network errors and returns ok:false', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await submitToIndexNow([`${SITE}/en`], { key: 'k', siteUrl: SITE, fetchImpl });
    expect(result).toEqual({ ok: false, submitted: 0 });
  });
});
