import { describe, expect, it } from 'vitest';
import imageLoader, { isSupabasePublicObject } from './image-loader';

const SUPABASE_CARD =
  'https://mdiqfatpqczwqghwttpm.supabase.co/storage/v1/object/public/card-images/alibaba-open-sources-qwen3-8.png?v=93ed3afb5c';
const SUPABASE_CARD_JPEG =
  'https://mdiqfatpqczwqghwttpm.supabase.co/storage/v1/object/public/card-images/alibaba-open-sources-qwen3-8.jpg?v=93ed3afb5c';

describe('imageLoader', () => {
  it('routes Supabase public objects through the Storage transform endpoint', () => {
    const out = imageLoader({ src: SUPABASE_CARD, width: 184, quality: 75 });
    expect(out).toContain('/storage/v1/render/image/public/card-images/');
    expect(out).not.toContain('/storage/v1/object/public/');
    expect(out).toContain('width=184');
    expect(out).toContain('quality=75');
    expect(out).toContain('format=webp');
  });

  it('transforms JPEG card origins the same way as legacy PNG paths', () => {
    const out = imageLoader({ src: SUPABASE_CARD_JPEG, width: 184, quality: 75 });
    expect(out).toContain('/storage/v1/render/image/public/card-images/');
    expect(out).toContain('.jpg');
    expect(out).toContain('width=184');
    expect(out).toContain('format=webp');
  });

  it('preserves the cache-busting query already on the stored URL', () => {
    const out = imageLoader({ src: SUPABASE_CARD, width: 640 });
    expect(out).toContain('v=93ed3afb5c');
  });

  it('defaults quality when Next does not supply one', () => {
    expect(imageLoader({ src: SUPABASE_CARD, width: 96 })).toContain('quality=75');
    expect(imageLoader({ src: SUPABASE_CARD, width: 96 })).toContain('format=webp');
  });

  it('never rewrites publisher hero images', () => {
    const publisher = 'https://techcrunch.com/wp-content/uploads/2026/08/hero.jpg';
    expect(imageLoader({ src: publisher, width: 1200, quality: 75 })).toBe(publisher);
  });

  it('serves the origin file above the transform ceiling', () => {
    expect(imageLoader({ src: SUPABASE_CARD, width: 3840 })).toBe(SUPABASE_CARD);
  });

  it('returns the input unchanged when it is not a parseable absolute URL', () => {
    expect(imageLoader({ src: '/local/logo.png', width: 96 })).toBe('/local/logo.png');
  });

  it('does not send anything to the Vercel optimizer', () => {
    for (const src of [SUPABASE_CARD, 'https://example.com/a.jpg', '/local/b.png']) {
      expect(imageLoader({ src, width: 640, quality: 75 })).not.toContain('/_next/image');
    }
  });

  describe('isSupabasePublicObject', () => {
    it('matches structurally, not against a hardcoded project ref', () => {
      expect(
        isSupabasePublicObject('https://otherref.supabase.co/storage/v1/object/public/x/y.png'),
      ).toBe(true);
    });

    it('rejects non-Supabase hosts and signed/private paths', () => {
      expect(isSupabasePublicObject('https://cdn.example.com/x.png')).toBe(false);
      expect(
        isSupabasePublicObject('https://ref.supabase.co/storage/v1/object/sign/private/x.jpg'),
      ).toBe(false);
    });
  });
});
