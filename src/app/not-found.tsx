import type { Metadata } from 'next';
import { NotFoundShell } from '@/components/not-found-shell';
import { getStrings } from '@/lib/i18n';
import { DEFAULT_LANG } from '@/lib/site';

const t = getStrings(DEFAULT_LANG);

export const metadata: Metadata = {
  title: t.notFoundMetaTitle,
  description: t.notFoundBody,
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  return <NotFoundShell lang={DEFAULT_LANG} />;
}
