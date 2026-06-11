import { SITE_URL, SITE_NAME, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';
import { getNewsList } from '@/lib/news';

export const revalidate = 1800;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const lang = DEFAULT_LANG;
  const items = await getNewsList(lang, 40);

  const body = items
    .map((it) => {
      const link = `${SITE_URL}${it.href}`;
      const pubDate = new Date(`${it.date}T09:00:00Z`).toUTCString();
      const media = it.imageUrl
        ? `\n      <media:content url="${escapeXml(it.imageUrl)}" medium="image" />`
        : '';
      return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(it.summary)}</description>
      <pubDate>${pubDate}</pubDate>${media}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}/${lang}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_TAGLINE[lang])}</description>
    <language>${lang}</language>
${body}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
