'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/site';
import { Bookmark } from '@/components/icons';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, LinkIcon } from './guide-icons';

const SAVED_STORAGE_KEY = 'atb-saved';

function readSavedSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeSavedSlugs(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // Best-effort storage
  }
}

export function GuideToolsAside({
  lang,
  slug,
  readMinutes,
  sectionsCount,
}: {
  lang: Lang;
  slug: string;
  readMinutes: number;
  sectionsCount: number;
}) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  const itemKey = `guide-${slug}`;

  useEffect(() => {
    setMounted(true);
    const slugs = readSavedSlugs();
    setSaved(slugs.includes(itemKey));
  }, [itemKey]);

  const toggleSave = useCallback(() => {
    const slugs = readSavedSlugs();
    const nextSaved = !slugs.includes(itemKey);
    const next = nextSaved ? [...slugs, itemKey] : slugs.filter((id) => id !== itemKey);
    writeSavedSlugs(next);
    setSaved(nextSaved);

    toast({
      message: nextSaved
        ? lang === 'uk'
          ? 'Збережено'
          : 'Saved'
        : lang === 'uk'
          ? 'Вилучено зі збережених'
          : 'Removed from saved',
      tone: 'info',
    });
  }, [itemKey, lang, toast]);

  const copyLink = useCallback(() => {
    if (typeof window !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast({
            message: lang === 'uk' ? 'Посилання скопійовано' : 'Link copied to clipboard',
            tone: 'success',
          });
        })
        .catch(() => {
          toast({
            message: lang === 'uk' ? 'Не вдалося скопіювати' : 'Failed to copy link',
            tone: 'error',
          });
        });
    } else {
      toast({
        message: lang === 'uk' ? 'Буфер обміну недоступний' : 'Clipboard unavailable',
        tone: 'info',
      });
    }
  }, [lang, toast]);

  return (
    <div className="flex flex-col gap-3">
      {/* Format note */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-2xs font-semibold uppercase tracking-wider text-accent mb-1">
          {lang === 'uk' ? 'Гайд' : 'Guide'}
        </div>
        <p className="text-sm text-text font-medium m-0">
          {readMinutes} {lang === 'uk' ? 'хв' : 'min'} · {sectionsCount}{' '}
          {lang === 'uk' ? 'розділів' : 'sections'}
        </p>
      </div>

      {/* Save button (D6 bookmark storage) */}
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={mounted ? saved : false}
        className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-accent hover:text-accent transition-colors"
      >
        <Bookmark size={16} filled={mounted ? saved : false} />
        <span>
          {mounted && saved
            ? lang === 'uk'
              ? 'Збережено'
              : 'Saved'
            : lang === 'uk'
              ? 'Зберегти'
              : 'Save'}
        </span>
      </button>

      {/* Copy link button */}
      <button
        type="button"
        onClick={copyLink}
        className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-accent hover:text-accent transition-colors"
      >
        <LinkIcon size={16} />
        <span>{lang === 'uk' ? 'Копіювати' : 'Copy link'}</span>
      </button>

      {/* All guides link */}
      <div className="pt-2">
        <Link
          href={`/${lang}/guides`}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft size={16} />
          <span>{lang === 'uk' ? 'Усі гайди' : 'All guides'}</span>
        </Link>
      </div>
    </div>
  );
}
