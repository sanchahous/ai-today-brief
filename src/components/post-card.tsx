'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useId, useState, type CSSProperties } from 'react';
import type { HomeItem } from '@/lib/home';
import { categoryMeta } from '@/lib/category-meta';
import { getStrings } from '@/lib/i18n';
import { SITE_URL, type Lang } from '@/lib/site';
import { CategoryBadge } from '@/components/home/category-badge';
import { CategoryThumb } from '@/components/category-thumb';
import { trackEvent } from '@/lib/analytics-client';
import {
  ArrowRight,
  Bookmark,
  ClockIcon,
  CommentIcon,
  PlayIcon,
  ShareIcon,
} from '@/components/icons';

const SAVED_KEY = 'atb-saved-items';

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

export function PostCard({ lang, item }: { lang: Lang; item: HomeItem }) {
  const t = getStrings(lang).news;
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readSaved().includes(item.id);
  });
  const bodyId = useId();

  const color = item.categoryColor ?? '#888888';
  const meta = categoryMeta(item.categorySlug);
  const pageUrl = `${SITE_URL}${item.href}`;

  const toggleSaved = useCallback(() => {
    const ids = readSaved();
    const nextSaved = !ids.includes(item.id);
    const next = nextSaved ? [...ids, item.id] : ids.filter((id) => id !== item.id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(nextSaved);
    trackEvent('save_toggle', { post_id: item.id, saved: nextSaved });
  }, [item.id]);

  function toggleExpanded() {
    setExpanded((was) => {
      if (!was) {
        trackEvent('post_expand', { post_id: item.id, category: item.categorySlug ?? '' });
      }
      return !was;
    });
  }

  function trackShare(method: 'x' | 'linkedin' | 'copy_link') {
    trackEvent('share', { post_id: item.id, method });
  }

  function copyLink() {
    trackShare('copy_link');
    void navigator.clipboard?.writeText(pageUrl).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const iconBtn =
    'inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1.5 text-[0.8rem] font-medium text-muted transition hover:border-accent hover:text-text';

  return (
    <article
      data-testid="post-card"
      className="card-hover elevation-card rounded-card border-border bg-surface border p-4"
    >
      <div className="post-grid">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={item.title}
          className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        >
          {item.imageUrl ? (
            <span className="border-border relative block h-[92px] w-[92px] overflow-hidden rounded-lg border">
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="92px"
                className="object-cover"
              />
            </span>
          ) : (
            <CategoryThumb
              name={item.categoryName ?? 'AI'}
              color={color}
              icon={meta.icon}
              size={92}
            />
          )}
        </button>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <CategoryBadge name={item.categoryName} color={item.categoryColor} />
            {item.sourceName && (
              <span className="text-faint text-[0.74rem]">
                {item.sourceName} · {formatDate(item.date, lang)}
              </span>
            )}
            {!item.sourceName && (
              <span className="text-faint text-[0.74rem]">{formatDate(item.date, lang)}</span>
            )}
            <span className="text-faint inline-flex items-center gap-1 text-[0.74rem]">
              <ClockIcon size={13} /> {item.readMinutes} {t.readMin}
            </span>
            {item.hasVideo && (
              <span
                className="cat-fg inline-flex items-center gap-1 text-[0.72rem] font-semibold"
                style={{ '--cat-color': color } as CSSProperties}
              >
                <PlayIcon size={14} /> {getStrings(lang).landing.watchVideo}
              </span>
            )}
          </div>

          <h3 className="mb-2 cursor-pointer text-[1.18rem] leading-snug">
            <Link href={item.href} className="hover:text-accent transition-colors">
              {item.title}
            </Link>
          </h3>

          <p className="text-muted mb-3 text-[0.92rem] leading-relaxed">{item.summary}</p>

          <div className="relative flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={bodyId}
              className={`${iconBtn} text-text`}
            >
              {expanded ? t.readLess : t.readMore}
              <ArrowRight
                size={15}
                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={toggleSaved}
              aria-pressed={saved}
              className={iconBtn}
              style={
                saved
                  ? { color, borderColor: `${color}88` }
                  : undefined
              }
            >
              <Bookmark size={15} filled={saved} />
              {saved ? t.saved : t.save}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShareOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={shareOpen}
                className={iconBtn}
              >
                <ShareIcon size={15} />
                {t.share}
              </button>
              {shareOpen && (
                <div
                  role="menu"
                  className="border-border bg-bg shadow-pop absolute bottom-full left-0 z-30 mb-2 min-w-[190px] rounded-[10px] border p-1"
                >
                  <a
                    role="menuitem"
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(item.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text block rounded-md px-2.5 py-2 text-[0.85rem] no-underline hover:bg-surface-2"
                    onClick={() => {
                      trackShare('x');
                      setShareOpen(false);
                    }}
                  >
                    {t.shareOnX}
                  </a>
                  <a
                    role="menuitem"
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text block rounded-md px-2.5 py-2 text-[0.85rem] no-underline hover:bg-surface-2"
                    onClick={() => {
                      trackShare('linkedin');
                      setShareOpen(false);
                    }}
                  >
                    {t.shareOnLinkedin}
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copyLink();
                      setShareOpen(false);
                    }}
                    className="text-accent w-full rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-[0.85rem] hover:bg-surface-2"
                  >
                    {copied ? t.copied : t.copyLink}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t.soon}
              className={`${iconBtn} cursor-not-allowed opacity-70`}
            >
              <CommentIcon size={15} />
              {t.comments}
              <span className="text-faint text-[0.66rem]">({t.soon})</span>
            </button>
          </div>

          <div
            id={bodyId}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              expanded ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className="rounded-card border-border border-t pt-4"
                style={{ borderTopColor: `${color}44` }}
              >
                <p className="text-accent mb-2 text-[0.72rem] font-bold tracking-[0.1em] uppercase">
                  {t.whyMatters}
                </p>
                <p className="text-muted mb-4 text-[0.92rem] leading-relaxed">{item.why}</p>
                <Link
                  href={item.href}
                  className="text-accent inline-flex items-center gap-1 text-sm font-semibold no-underline hover:underline"
                >
                  {t.openFull}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
