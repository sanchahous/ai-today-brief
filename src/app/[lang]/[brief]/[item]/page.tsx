import { notFound, permanentRedirect } from 'next/navigation';
import { isLang } from '@/lib/site';
import { resolveLegacyItemPath } from '@/lib/items';

// Legacy pack-scoped item URL (pre-2026-07-24) — every hit 308s to the
// current category-scoped URL (see `src/app/[lang]/news/[category]/[item]`).
// No generateStaticParams: these paths only exist to catch inbound links /
// stale search results, so resolving them on demand is enough.

type Params = { lang: string; brief: string; item: string };

export default async function LegacyItemRedirect({ params }: { params: Promise<Params> }) {
  const { lang: raw, brief, item } = await params;
  if (!isLang(raw)) notFound();

  const path = await resolveLegacyItemPath(brief, item);
  if (!path) notFound();
  permanentRedirect(`/${raw}${path}`);
}
