'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import { SITE_URL, type Lang } from '@/lib/site';
import { ShareIcon } from '@/components/icons';

export function ItemShareBar({
  lang,
  pageUrl,
  title,
  postId,
}: {
  lang: Lang;
  title: string;
  pageUrl: string;
  postId: string;
}) {
  const t = getStrings(lang).news;
  const [copied, setCopied] = useState(false);
  const absolute = pageUrl.startsWith('http') ? pageUrl : `${SITE_URL}${pageUrl}`;

  function trackShare(method: 'x' | 'linkedin' | 'copy_link') {
    trackEvent('share', { post_id: postId, method });
  }

  function copyLink() {
    trackShare('copy_link');
    void navigator.clipboard?.writeText(absolute).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-faint inline-flex items-center gap-1.5 text-[0.85rem]">
        <ShareIcon size={15} />
        {t.share}
      </span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(absolute)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare('x')}
        className="rounded-pill border-border text-text hover:border-accent inline-flex border px-3 py-1.5 text-sm font-medium no-underline transition"
      >
        {t.shareOnX}
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absolute)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare('linkedin')}
        className="rounded-pill border-border text-text hover:border-accent inline-flex border px-3 py-1.5 text-sm font-medium no-underline transition"
      >
        {t.shareOnLinkedin}
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-pill border-border text-text hover:border-accent border px-3 py-1.5 text-sm font-medium transition"
      >
        {copied ? t.copied : t.copyLink}
      </button>
    </div>
  );
}
