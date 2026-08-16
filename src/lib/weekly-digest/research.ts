import 'server-only';

import type { Json } from '@/lib/database.types';
import { extractMainText, extractOgImage, isGenericOgImage } from '../../../pipeline/enrich';
import { fetchWithRetry } from '../../../pipeline/sources/http';
import {
  type CorpusArticle,
  researchCorroborationCandidates,
} from '../../../pipeline/story-identity';
import { canonicalPageUrl } from '../../../pipeline/page-url';
import {
  canonicalSourceName,
  placementForRank,
  sourceNameMatchesDomain,
  WEEKLY_RESEARCH_EXCERPT_MAX_CHARS,
  WEEKLY_RESEARCH_SCHEMA_VERSION,
  type ResearchClaim,
  type ResearchEvidence,
  type WeeklyResearchPack,
} from './content-studio';

const FETCH_HEADERS = {
  'User-Agent': 'ai-today-brief/2.0 (weekly editorial research; contact: hello@aitodaybrief.com)',
  Accept: 'text/html,application/xhtml+xml',
};
const MAX_HTML_CHARS = 600_000;

interface ResearchItem {
  id: string;
  rank: number;
  title_en: string;
  summary_en: string;
  why_en: string | null;
  sources: Json;
  source_snapshot: Json;
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function cleanUrl(value: string) {
  const canonical = canonicalPageUrl(value);
  if (!canonical?.startsWith('https://')) {
    throw new Error('Research sources must use a credential-free HTTPS URL.');
  }
  return canonical;
}

function sourceRows(value: Json): Array<{ name: string; url: string }> {
  if (!Array.isArray(value)) return [];
  const sources: Array<{ name: string; url: string }> = [];
  for (const entry of value) {
    const row = asRecord(entry);
    const rawUrl =
      typeof row.url === 'string'
        ? row.url
        : typeof row.source_url === 'string'
          ? row.source_url
          : null;
    if (!rawUrl) continue;
    try {
      const url = cleanUrl(rawUrl);
      const suppliedName =
        typeof row.name === 'string'
          ? row.name.trim()
          : typeof row.source_name === 'string'
            ? row.source_name.trim()
            : '';
      if (suppliedName && !sourceNameMatchesDomain(suppliedName, url)) {
        throw new Error(
          `Source label "${suppliedName}" does not match ${new URL(url).hostname}. Correct the source or move this story to Radar.`,
        );
      }
      sources.push({ name: canonicalSourceName(url), url });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Source label')) throw error;
    }
  }
  return sources;
}

/**
 * Rebuilds immutable revision sources from the approved brief-item/article
 * lineage. Legacy weekly revisions sometimes preserved the feed label (for
 * example Hacker News) next to the canonical article URL, or no sources at
 * all. The article relation is the trusted primary pointer; labels are always
 * derived from the URL so the downstream anti-spoofing check remains strict.
 */
export function trustedWeeklyResearchSources(input: {
  articleUrl: string;
  revisionSources: Json;
  citations: Json | null;
}) {
  const candidates: string[] = [input.articleUrl];
  for (const value of [input.revisionSources, input.citations]) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      const row = asRecord(entry);
      const rawUrl =
        typeof entry === 'string'
          ? entry
          : typeof row.url === 'string'
            ? row.url
            : typeof row.source_url === 'string'
              ? row.source_url
              : null;
      if (rawUrl) candidates.push(rawUrl);
    }
  }
  const urls = candidates.flatMap((candidate) => {
    try {
      return [cleanUrl(candidate)];
    } catch {
      return [];
    }
  });
  return urls
    .filter((url, index, all) => all.indexOf(url) === index)
    .map((url) => ({ name: canonicalSourceName(url), url }));
}

function snapshotCitationUrls(value: Json) {
  const editorial = asRecord(asRecord(value).editorial_selection);
  const citations = editorial.citation_urls;
  if (!Array.isArray(citations)) return [];
  return citations.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    try {
      return [cleanUrl(entry)];
    } catch {
      return [];
    }
  });
}

function factStrings(value: Json | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return entry.trim() ? [entry.trim()] : [];
    const row = asRecord(entry);
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const factValue = typeof row.value === 'string' ? row.value.trim() : '';
    if (label && factValue) return [`${label}: ${factValue}`];
    for (const key of ['fact', 'text', 'claim']) {
      if (typeof row[key] === 'string' && row[key]!.trim()) return [row[key]!.trim()];
    }
    return [];
  });
}

export function approvedWeeklyClaimText(
  item: Pick<ResearchItem, 'summary_en' | 'source_snapshot'>,
) {
  const snapshot = asRecord(item.source_snapshot);
  return [item.summary_en, ...factStrings(snapshot.facts_en)]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(
      (value, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
    )
    .slice(0, 12);
}

function claimKind(text: string): ResearchClaim['kind'] {
  if (/\b\d[\d,.%]*\b/.test(text)) return 'number';
  if (/\b(?:said|reported|announced|found|claims?|according to)\b/i.test(text))
    return 'named_claim';
  return 'fact';
}

async function fetchEvidence(url: string, primary: boolean): Promise<ResearchEvidence> {
  const response = await fetchWithRetry(
    url,
    { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) },
    2,
  );
  if (!response?.ok)
    throw new Error(
      `Research source returned HTTP ${response?.status ?? 'network failure'}: ${url}`,
    );
  const contentType = response.headers.get('content-type') ?? '';
  if (!/html|text\//i.test(contentType)) {
    throw new Error(`Research source is not readable text: ${url}`);
  }
  const html = (await response.text()).slice(0, MAX_HTML_CHARS);
  const extracted = extractMainText(html, WEEKLY_RESEARCH_EXCERPT_MAX_CHARS);
  if (!extracted || extracted.length < 160) {
    throw new Error(`Research source did not expose enough article text: ${url}`);
  }
  const candidateImage = extractOgImage(html);
  const ogImage = candidateImage && !isGenericOgImage(candidateImage) ? candidateImage : null;
  const parsed = new URL(url);
  return {
    url,
    sourceName: canonicalSourceName(url),
    domain: parsed.hostname.toLowerCase().replace(/^www\./, ''),
    primary,
    extractedText: extracted,
    ogImage,
  };
}

export async function buildWeeklyResearchPack(input: {
  digestId: string;
  revisionId: string;
  item: ResearchItem;
  corpus?: readonly CorpusArticle[];
}): Promise<WeeklyResearchPack> {
  const selectedSources = sourceRows(input.item.sources);
  const primary = selectedSources[0];
  if (!primary) throw new Error('Top 3 research requires a valid primary HTTPS source.');
  const primaryEvidence = await fetchEvidence(primary.url, true);
  const snapshot = asRecord(input.item.source_snapshot);
  const editorial = asRecord(snapshot.editorial_selection);
  const clusterId = typeof editorial.cluster_id === 'string' ? editorial.cluster_id : null;
  const independent = researchCorroborationCandidates({
    primaryUrl: primary.url,
    primaryTitle: input.item.title_en,
    primaryClusterId: clusterId,
    listedUrls: [
      ...selectedSources.slice(1).map((source) => source.url),
      ...snapshotCitationUrls(input.item.source_snapshot),
    ],
    corpus: input.corpus ?? [],
  });
  const settled = await Promise.allSettled(
    independent.slice(0, 4).map((url) => fetchEvidence(url, false)),
  );
  const corroboratingSources = settled
    .flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    .slice(0, 2);
  const evidenceUrls = [primaryEvidence.url, ...corroboratingSources.map((source) => source.url)];
  const claims = approvedWeeklyClaimText(input.item).map((claim, index): ResearchClaim => ({
    id: `W${input.item.rank}-C${index + 1}`,
    text: claim,
    kind: claimKind(claim),
    evidenceUrls,
  }));
  if (claims.length === 0)
    throw new Error('Research pack has no approved claims to ground the story.');

  const risks = [
    ...(corroboratingSources.length === 0 ? ['no_independent_corroboration'] : []),
    ...(claims.some((claim) => claim.kind === 'number') ? ['verify_numbers_against_primary'] : []),
  ];
  return {
    schemaVersion: WEEKLY_RESEARCH_SCHEMA_VERSION,
    digestId: input.digestId,
    revisionId: input.revisionId,
    revisionItemId: input.item.id,
    placement: placementForRank(input.item.rank),
    primarySource: primaryEvidence,
    corroboratingSources,
    claims,
    context: [input.item.title_en, input.item.summary_en].filter(Boolean),
    contradictions: [],
    limitations: corroboratingSources.length
      ? [
          'Corroborating pages provide context; claims remain anchored to the approved primary source.',
          'Extra pages may come from the ingest corpus, not only from the daily citation list.',
        ]
      : [
          'No independent corroborating page was available in the approved citation set or the ingest corpus.',
        ],
    risks,
    researchedAt: new Date().toISOString(),
  };
}

export function isWeeklyResearchPack(value: unknown): value is WeeklyResearchPack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const pack = value as Partial<WeeklyResearchPack>;
  return (
    (pack.schemaVersion === WEEKLY_RESEARCH_SCHEMA_VERSION ||
      pack.schemaVersion === 'weekly-research-v2') &&
    typeof pack.revisionItemId === 'string' &&
    (pack.placement === 'feature' || pack.placement === 'radar') &&
    Boolean(pack.primarySource?.url) &&
    Array.isArray(pack.claims) &&
    pack.claims.length > 0
  );
}
