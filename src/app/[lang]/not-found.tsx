import type { Metadata } from 'next';
import { NotFoundContentClient } from '@/components/not-found-content-client';

export const metadata: Metadata = {
  title: '404',
  robots: { index: false, follow: true },
};

export default function LangNotFound() {
  return <NotFoundContentClient />;
}
