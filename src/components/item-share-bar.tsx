'use client';

import { trackItemEvent } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import { SITE_URL, type Lang } from '@/lib/site';
import { LinkIcon, LinkedInIcon, ShareIcon, XIcon } from '@/components/icons';
import { useToast } from '@/components/ui/toast';

/** Shared look for the three share controls (two links + copy button). */
const SHARE_CONTROL_CLASS =
  'rounded-pill border-line text-text hover:border-accent inline-flex min-h-[var(--touch-target-min)] items-center justify-start gap-2 border px-3 py-1.5 text-sm font-medium no-underline transition lg:w-full';

const SHARE_ICON_CLASS = 'shrink-0';
const SHARE_ICON_SIZE = 16;

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
  const { toast } = useToast();
  const absolute = pageUrl.startsWith('http') ? pageUrl : `${SITE_URL}${pageUrl}`;

  function trackShare(method: 'x' | 'linkedin' | 'copy_link') {
    trackItemEvent('share', { id: postId, lang }, { method });
  }

  function copyLink() {
    trackShare('copy_link');
    if (navigator.clipboard) {
      void navigator.clipboard
        .writeText(absolute)
        .then(() => {
          toast({ message: t.copied ?? 'Link copied to clipboard', tone: 'success' });
        })
        .catch(() => {
          toast({
            message: lang === 'uk' ? 'Не вдалося скопіювати посилання' : 'Failed to copy link',
            tone: 'error',
          });
        });
    } else {
      toast({
        message: lang === 'uk' ? 'Буфер обміну недоступний' : 'Clipboard unavailable',
        tone: 'info',
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
      <span className="text-faint inline-flex items-center gap-1.5 text-[0.85rem]">
        <ShareIcon size={15} />
        {t.share}
      </span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(absolute)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare('x')}
        className={SHARE_CONTROL_CLASS}
      >
        <XIcon size={SHARE_ICON_SIZE} className={SHARE_ICON_CLASS} />
        {t.shareOnX}
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absolute)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare('linkedin')}
        className={SHARE_CONTROL_CLASS}
      >
        <LinkedInIcon size={SHARE_ICON_SIZE} className={SHARE_ICON_CLASS} />
        {t.shareOnLinkedin}
      </a>
      <button type="button" onClick={copyLink} className={SHARE_CONTROL_CLASS}>
        <LinkIcon size={SHARE_ICON_SIZE} className={SHARE_ICON_CLASS} />
        {t.copyLink}
      </button>
    </div>
  );
}
