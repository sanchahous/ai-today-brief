import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CONTENT_TAG } from '@/lib/public-content-tag';
import {
  revalidatePathsForPublish,
  revalidatePublicContentTag,
  revalidateSiteSurfaces,
} from '@/lib/revalidate-site';

beforeEach(() => {
  vi.mocked(revalidatePath).mockReset();
  vi.mocked(revalidateTag).mockReset();
});

describe('revalidateSiteSurfaces', () => {
  it('revalidates hubs and the given paths without a site-wide tag purge', () => {
    revalidateSiteSurfaces(['/en/news/models/demo']);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/uk/news');
    expect(revalidatePath).toHaveBeenCalledWith('/en/news/models/demo');
  });

  it('keeps revalidating the remaining paths when one fails', () => {
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    expect(() => revalidateSiteSurfaces()).not.toThrow();
    expect(revalidatePath).toHaveBeenCalledTimes(revalidatePathsForPublish().length);
  });
});

describe('revalidatePathsForPublish', () => {
  it('dedupes caller paths against the shared surfaces', () => {
    const paths = revalidatePathsForPublish(['/en', '/en/news/models/demo']);
    expect(paths.filter((p) => p === '/en')).toHaveLength(1);
    expect(paths).toContain('/en/news/models/demo');
  });
});

describe('revalidatePublicContentTag', () => {
  it('marks the public-content tag stale', () => {
    revalidatePublicContentTag();
    expect(revalidateTag).toHaveBeenCalledWith(PUBLIC_CONTENT_TAG, 'max');
  });

  it('swallows tag failures so publish still proceeds', () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    expect(() => revalidatePublicContentTag()).not.toThrow();
  });
});
