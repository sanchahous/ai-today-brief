/** Google News sitemap: only the last 48 hours (per Google News sitemap guidelines). */
export const NEWS_SITEMAP_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function toNewsPublicationDate(publishedAt: string | null, briefDate: string): string {
  const raw = publishedAt ?? `${briefDate}T09:00:00.000Z`;
  const d = new Date(raw.includes('T') ? raw : `${briefDate}T09:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return `${briefDate}T09:00:00Z`;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function isWithinNewsSitemapWindow(publicationDate: string, now = Date.now()): boolean {
  return new Date(publicationDate).getTime() >= now - NEWS_SITEMAP_MAX_AGE_MS;
}
