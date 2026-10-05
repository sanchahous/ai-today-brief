'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useId, useState } from 'react';
import type { Lang } from '@/lib/site';
import { SITE_URL } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { trackItemEvent } from '@/lib/analytics-client';
import { CategoryBadge } from '@/components/ui/category-badge';
import { CategoryBanner } from './category-banner';
import {
  ArrowRight,
  Bookmark,
  ClockIcon,
  LinkIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
} from '@/components/icons';
import { useToast } from '@/components/ui/toast';
import styles from './editorial.module.css';

export type StoryCardLayout = 'standard' | 'lead' | 'row' | 'withoutImage';

export interface StoryCardItem {
  id: string;
  href: string;
  title: string;
  summary: string;
  date: string;
  why?: string;
  takeaways?: string[];
  categorySlug?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  hasVideo?: boolean;
  videoUrl?: string | null;
  readMinutes?: number;
  imageUrl?: string | null;
  sourceName?: string | null;
  tools?: string[];
  topics?: string[];
  rank?: number | string;
}

export interface StoryCardProps {
  item: StoryCardItem;
  layout?: StoryCardLayout;
  lang?: Lang;
  rank?: number | string;
  showSave?: boolean;
  className?: string;
  priority?: boolean;
}

const SAVED_KEY = 'atb-saved-items';

function readSavedIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function formatStoryDate(iso: string, lang: Lang): string {
  try {
    const date = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return iso;
  }
}

function useSafeToast() {
  try {
    return useToast();
  } catch {
    return null;
  }
}

/**
 * After Hours StoryCard:
 * - 4 layout variants: standard, lead, row, withoutImage
 * - Block-link: title link stretches across the entire card for single tab-stop navigation
 * - Action buttons placed above the stretch overlay with distinct tab stops
 * - CategoryBadge, meta (<time>, read time, video)
 * - Expandable "Why it matters" and key takeaways
 * - "Copy link" action with toast feedback
 * - Fallback CategoryBanner with deterministic brass grooves when withoutImage or no imageUrl
 */
export function StoryCard(
  propsOrItem: StoryCardProps | StoryCardItem,
  maybeLayout?: StoryCardLayout,
) {
  const props: StoryCardProps =
    'item' in propsOrItem && Boolean((propsOrItem as StoryCardProps).item)
      ? (propsOrItem as StoryCardProps)
      : { item: propsOrItem as StoryCardItem, layout: maybeLayout };

  const {
    item,
    layout = 'standard',
    lang = 'en',
    rank = item.rank,
    showSave = false,
    className = '',
    priority = false,
  } = props;

  const whyId = useId();
  const t = getStrings(lang).news;
  const toastApi = useSafeToast();

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readSavedIds().includes(item.id);
  });

  const pageUrl = item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`;

  const toggleExpanded = useCallback(() => {
    setExpanded((was) => {
      if (!was) {
        trackItemEvent(
          'post_expand',
          { id: item.id, lang },
          { category: item.categorySlug ?? '' },
        );
      }
      return !was;
    });
  }, [item.id, item.categorySlug, lang]);

  const copyLink = useCallback(() => {
    trackItemEvent('share', { id: item.id, lang }, { method: 'copy_link' });
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(pageUrl).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    if (toastApi) {
      toastApi.toast({
        message: lang === 'uk' ? 'Посилання скопійовано' : 'Link copied to clipboard',
        tone: 'success',
      });
    }
  }, [item.id, lang, pageUrl, toastApi]);

  const toggleSave = useCallback(() => {
    const ids = readSavedIds();
    const nextSaved = !ids.includes(item.id);
    const next = nextSaved ? [...ids, item.id] : ids.filter((id) => id !== item.id);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable or quota exceeded
    }
    setSaved(nextSaved);
    trackItemEvent(
      'save_toggle',
      { id: item.id, lang },
      { saved: nextSaved, value: nextSaved ? 1 : 0 },
    );
  }, [item.id, lang]);

  const layoutClass =
    layout === 'lead'
      ? styles.storyCardLead
      : layout === 'row'
        ? styles.storyCardRow
        : layout === 'withoutImage'
          ? styles.storyCardWithoutImage
          : '';

  const HeadingTag = layout === 'row' ? 'h3' : 'h2';

  const actionBtnClass =
    'relative z-10 inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]';

  const hasMedia = layout !== 'withoutImage';

  return (
    <article
      data-testid="story-card"
      data-layout={layout}
      className={`story-card ${styles.storyCard} ${layoutClass} ${className}`}
    >
      {hasMedia && (
        <div className={`story-card-media ${styles.storyCardMedia}`} aria-hidden="true" tabIndex={-1}>
          {item.imageUrl ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--raised)]">
              <Image
                src={item.imageUrl}
                alt=""
                width={layout === 'lead' ? 800 : layout === 'row' ? 180 : 440}
                height={layout === 'lead' ? 450 : layout === 'row' ? 180 : 330}
                sizes={
                  layout === 'lead'
                    ? '(max-width: 960px) 100vw, 50vw'
                    : layout === 'row'
                      ? '92px'
                      : '(max-width: 960px) 100vw, 220px'
                }
                priority={priority}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <CategoryBanner
              id={item.id}
              slug={item.categorySlug}
              name={item.categoryName}
              color={item.categoryColor}
              hasVideo={item.hasVideo}
              videoLabel={lang === 'uk' ? 'Відео' : 'Video'}
              variant={layout === 'lead' ? 'hero' : layout === 'row' ? 'thumb' : 'card'}
              ariaHidden
            />
          )}
        </div>
      )}

      <div className={`story-card-body ${styles.storyCardBody}`}>
        <div className={`story-card-top ${styles.storyCardTop}`}>
          {rank !== undefined && rank !== null && (
            <span className={styles.rankBadge} aria-label={`Rank ${rank}`}>
              {String(rank).padStart(2, '0')}
            </span>
          )}
          <CategoryBadge
            slug={item.categorySlug}
            name={item.categoryName}
            color={item.categoryColor}
            size={layout === 'lead' ? 'md' : 'sm'}
          />
          <p className={`card-meta ${styles.cardMeta}`}>
            <time dateTime={item.date}>{formatStoryDate(item.date, lang)}</time>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon size={12} />
              <span>
                {item.readMinutes ?? 5} {t.readMin}
              </span>
            </span>
            {item.hasVideo && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`has-video ${styles.hasVideo}`}>
                  <PlayIcon size={13} />
                  <span>{lang === 'uk' ? 'Відео' : 'Video'}</span>
                </span>
              </>
            )}
          </p>
        </div>

        <HeadingTag className={`story-card-title ${styles.storyCardTitle}`}>
          <Link href={item.href} className={`story-card-link ${styles.storyCardLink}`}>
            {item.title}
          </Link>
        </HeadingTag>

        {layout !== 'row' && item.summary && (
          <p className={`story-card-summary ${styles.storyCardSummary}`}>{item.summary}</p>
        )}

        <div className={`story-card-actions ${styles.storyCardActions}`}>
          {item.why && (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={whyId}
              className={actionBtnClass}
            >
              {expanded ? <MinusIcon size={14} /> : <PlusIcon size={14} />}
              <span>
                {expanded
                  ? (lang === 'uk' ? 'Сховати аналіз' : 'Hide analysis')
                  : (lang === 'uk' ? 'Чому це важливо' : 'Why it matters')}
              </span>
            </button>
          )}

          {showSave && (
            <button
              type="button"
              onClick={toggleSave}
              aria-pressed={saved}
              className={actionBtnClass}
            >
              <Bookmark size={14} filled={saved} />
              <span>
                {saved
                  ? (t.saved ?? (lang === 'uk' ? 'Збережено' : 'Saved'))
                  : (t.save ?? (lang === 'uk' ? 'Зберегти' : 'Save'))}
              </span>
            </button>
          )}

          <button type="button" onClick={copyLink} className={actionBtnClass}>
            <LinkIcon size={14} />
            <span>
              {copied
                ? (t.copied ?? (lang === 'uk' ? 'Скопійовано ✓' : 'Copied ✓'))
                : (t.copyLink ?? (lang === 'uk' ? 'Скопіювати лінк' : 'Copy link'))}
            </span>
          </button>
        </div>

        {item.why && (
          <div
            id={whyId}
            className={`story-card-why ${styles.storyCardWhy}`}
            hidden={!expanded}
          >
            <p className="eyebrow">{lang === 'uk' ? 'Чому це важливо' : 'Why it matters'}</p>
            <p>{item.why}</p>
            {item.takeaways && item.takeaways.length > 0 && (
              <>
                <p className="eyebrow">{lang === 'uk' ? 'Ключові висновки' : 'Key takeaways'}</p>
                <ul>
                  {item.takeaways.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </>
            )}
            <Link
              href={item.href}
              className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              <span>{lang === 'uk' ? 'Відкрити повний матеріал' : 'Open the full story'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
