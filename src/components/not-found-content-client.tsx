'use client';

import { usePathname } from 'next/navigation';
import { NotFoundContent } from '@/components/not-found-content';
import { DEFAULT_LANG, isLang } from '@/lib/site';

/** Lang from URL — `not-found` has no route params during SSG/prerender. */
export function NotFoundContentClient() {
  const pathname = usePathname();
  const segment = pathname?.split('/').filter(Boolean)[0];
  const lang = isLang(segment) ? segment : DEFAULT_LANG;
  return <NotFoundContent lang={lang} />;
}
