/**
 * Custom Next.js image loader — keeps every request off Vercel's image
 * optimizer.
 *
 * Why: the optimizer quota ran out and `/_next/image` began answering
 * `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`, so every image on the site
 * broke at once while the underlying files in Supabase were healthy (verified
 * 2026-08-14: origin object 200 / 487 KB, optimizer 402).
 *
 * Two kinds of image are involved and they need different handling:
 *
 *   1. Our own card images in the public Supabase bucket. Supabase Storage can
 *      resize these itself via `render/image/public/...`, which returns a
 *      width-appropriate WebP — far smaller than the JPEG/PNG origin for a
 *      184 px slot. That is the right transform for a 92 px thumbnail and it
 *      costs no Vercel quota. Origins may still be JPEG (news cards / weekly
 *      cover) so OG crawlers and Satori can read the file without a transform.
 *   2. Hero images taken from the source articles' `og:image`. Those live on
 *      arbitrary publisher hosts (see `remotePatterns` in next.config.ts) and
 *      cannot be transformed by us, so they pass through untouched.
 *
 * Keeping this as a loader rather than `images.unoptimized` matters: the flag
 * would ship the 488 KB PNGs to a 92 px slot, which is exactly the page-weight
 * problem that makes the optimizer look necessary in the first place.
 */

const SUPABASE_PUBLIC_OBJECT = '/storage/v1/object/public/';
const SUPABASE_PUBLIC_RENDER = '/storage/v1/render/image/public/';

/** Widths Supabase is asked for. Anything larger is served as the origin file. */
const MAX_TRANSFORM_WIDTH = 2560;

export interface ImageLoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

/**
 * True when the URL points at a public object in our own Supabase Storage.
 * Matched structurally rather than against a hardcoded project ref so a project
 * move does not silently fall back to unresized originals.
 */
export function isSupabasePublicObject(src: string): boolean {
  return src.includes('.supabase.co') && src.includes(SUPABASE_PUBLIC_OBJECT);
}

export default function imageLoader({ src, width, quality }: ImageLoaderArgs): string {
  if (!isSupabasePublicObject(src) || width > MAX_TRANSFORM_WIDTH) return src;

  // The stored URL carries a `?v=<hash>` cache-buster that must survive, so
  // rebuild the query rather than string-concatenating a second `?`.
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  url.pathname = url.pathname.replace(SUPABASE_PUBLIC_OBJECT, SUPABASE_PUBLIC_RENDER);
  url.searchParams.set('width', String(Math.round(width)));
  url.searchParams.set('quality', String(quality ?? 75));
  url.searchParams.set('format', 'webp');
  return url.toString();
}
