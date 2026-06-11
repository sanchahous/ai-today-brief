/**
 * Canonical source names, applied once at the fetch boundary.
 *
 * InBrief passes upstream feed labels through verbatim, so the same outlet
 * arrives under several spellings ("HackerNews" vs "Hacker News", "x.com" vs
 * "X.com", "Nvidia Blog" vs "NVIDIA Blog"). Both `rank.ts` SOURCE_TRUST and the
 * site's source filter match on the name, so every variant fragments trust
 * scoring and facet counts. The alias table covers every variant observed in
 * production (see migration 025, which fixes the stored rows the same way).
 */

const CANONICAL_BY_ALIAS: Record<string, string> = {
  'hackernews': 'Hacker News',
  'x.com': 'X (Twitter)',
  'twitter': 'X (Twitter)',
  'twitter.com': 'X (Twitter)',
  'youtube': 'YouTube',
  'youtube.com': 'YouTube',
  'github': 'GitHub',
  'github.com': 'GitHub',
  'nvidia': 'NVIDIA Blog',
  'nvidia blog': 'NVIDIA Blog',
  'huggingface': 'Hugging Face Blog',
  'hugging face': 'Hugging Face Blog',
  'theverge ai': 'The Verge',
  'the verge ai': 'The Verge',
  'techcrunch ai': 'TechCrunch',
  'venturebeat ai': 'VentureBeat',
  'techreview': 'MIT Technology Review',
  'mit tech review ai': 'MIT Technology Review',
  'google deepmind blog': 'DeepMind Blog',
  'artificialintelligence-news.com': 'AI News',
};

/** Collapse whitespace and map known variants onto one display name. */
export function canonicalSourceName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Unknown';
  return CANONICAL_BY_ALIAS[cleaned.toLowerCase()] ?? cleaned;
}
