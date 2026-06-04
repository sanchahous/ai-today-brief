import { SITE_NAME, SITE_URL } from '@/lib/site';
import { getPublishedNewsSitemapEntries } from '@/lib/items';

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Google News sitemap — published brief items only (last 2 days preferred; we emit all published). */
export async function GET() {
  const entries = await getPublishedNewsSitemapEntries();

  const urls = entries
    .map((e) => {
      const loc = `${SITE_URL}/${e.lang}/${e.brief}/${e.item}`;
      const pub = escapeXml(e.publicationDate);
      const title = escapeXml(e.title);
      const language = e.lang === 'uk' ? 'uk' : 'en';
      return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>${language}</news:language>
      </news:publication>
      <news:publication_date>${pub}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
