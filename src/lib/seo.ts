import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

interface SocialMetaOptions {
  title: string;
  description: string;
  /** Site-absolute path, e.g. "/en/news". */
  path: string;
  lang: Lang;
  type?: 'article' | 'website';
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * Shared Open Graph + Twitter block for pages that inherit the segment-level
 * branded share card ([lang]/opengraph-image.tsx). Next fills og:image /
 * twitter:image from that file whenever the page itself does not define
 * `images` — pages with real cover art (weekly digests) keep theirs.
 */
export function socialMeta({
  title,
  description,
  path,
  lang,
  type = 'website',
  publishedTime,
  modifiedTime,
}: SocialMetaOptions): Pick<Metadata, 'openGraph' | 'twitter'> {
  const url = `${SITE_URL}${path}`;
  return {
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: SITE_NAME,
      locale: lang === 'uk' ? 'uk_UA' : 'en_US',
      alternateLocale: lang === 'uk' ? ['en_US'] : ['uk_UA'],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
