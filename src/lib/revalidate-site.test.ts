import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CONTENT_TAG } from '@/lib/public-content-tag';
import { revalidatePublicContentTag, revalidateSiteSurfaces } from '@/lib/revalidate-site';

describe('revalidateSiteSurfaces', () => {
  it('busts the public-content Data Cache tag before paths', () => {
    revalidateSiteSurfaces(['/en/news/models/demo']);
    expect(revalidateTag).toHaveBeenCalledWith(PUBLIC_CONTENT_TAG, 'max');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/en/news/models/demo');
  });

  it('swallows tag failures so publish still proceeds', () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    expect(() => revalidatePublicContentTag()).not.toThrow();
  });
});
