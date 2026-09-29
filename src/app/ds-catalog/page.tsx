import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogClient } from './catalog-client';

/**
 * Internal component catalog (G20). Not part of the product: it 404s unless the server is started
 * with DS_CATALOG=1 (local dev + Playwright). Never set that flag on Vercel.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Design system catalog', robots: { index: false, follow: false } };

export default function CatalogPage() {
  if (process.env.DS_CATALOG !== '1') notFound();
  return <CatalogClient />;
}
