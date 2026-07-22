/**
 * Weekly "Best of" digest — pure selection + formatting (unit-tested).
 *
 * Compiles the week's PUBLISHED, human-approved items into one Telegram-ready
 * post: the cheapest high-leverage distribution format from the portal plan.
 * No LLM call and no new content — only already-curated material — which is
 * why auto-posting it to the public channel is safe.
 */

import { escapeHtml } from './review-format';

export interface DigestCandidate {
  id: string;
  articleId: string;
  canonicalItemId: string | null;
  title_uk: string;
  title_en: string;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string;
  why_matters_uk: string;
  impact_level: string | null;
  category_slug: string | null;
  briefSlug: string;
  itemSlug: string;
  /** Brief date (ISO) — newer wins inside the same impact tier. */
  date: string;
  rank: number;
  citationUrls: string[];
  factsEnCount: number;
  factsUkCount: number;
  sourceName: string;
  sourceUrl: string;
  compositeScore: number | null;
  authorityScore: number | null;
  crossSourceScore: number | null;
  breadthScore: number | null;
  scoreVersion: number | null;
  clusterId: string | null;
  mentionsCount: number;
}

export const WEEKLY_SELECTION_VERSION = 'weekly-editorial-v2';

export type DigestRejectionReason =
  | 'duplicate_story'
  | 'missing_bilingual_copy'
  | 'missing_citations'
  | 'missing_bilingual_facts'
  | 'missing_source_url'
  | 'missing_impact_assessment'
  | 'stale_score_telemetry';

export interface DigestScoreBreakdown {
  editorialImpact: number;
  evidence: number;
  corroboration: number;
  upstreamRank: number;
  audienceFit: number;
  dailyPriority: number;
  recency: number;
}

export interface ScoredDigestCandidate {
  candidate: DigestCandidate;
  score: number;
  breakdown: DigestScoreBreakdown;
  reasons: string[];
}

export interface EditorialDigestSelection {
  version: typeof WEEKLY_SELECTION_VERSION;
  selected: ScoredDigestCandidate[];
  eligible: ScoredDigestCandidate[];
  rejected: Array<{ candidate: DigestCandidate; reasons: DigestRejectionReason[] }>;
}

export interface EditorialSelectionOptions {
  max?: number;
  perCategoryCap?: number;
  perSourceCap?: number;
  perDayCap?: number;
}

const CURRENT_SCORE_VERSION = 2;
const IMPACT_POINTS: Record<'high' | 'medium' | 'low', number> = {
  high: 35,
  medium: 23,
  low: 8,
};
const AUDIENCE_FIT_POINTS: Record<string, number> = {
  'agents-and-mcp': 10,
  'tools-and-releases': 10,
  'models-and-research': 9,
  optimization: 9,
  'local-llms': 8,
  'vibe-coding': 7,
  'creative-ai': 6,
  'career-and-money': 5,
};

function clamp01(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function citationUrlsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls = value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'url' in entry) {
        const url = (entry as { url?: unknown }).url;
        return typeof url === 'string' ? url : '';
      }
      return '';
    })
    .map((url) => url.trim())
    .filter(isHttpsUrl);
  return [...new Set(urls)];
}

export function factCountFromUnknown(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0;
    if (!entry || typeof entry !== 'object') return false;
    const record = entry as Record<string, unknown>;
    return ['fact', 'text', 'claim', 'value'].some(
      (key) => typeof record[key] === 'string' && record[key].trim().length > 0,
    );
  }).length;
}

function rejectionReasons(candidate: DigestCandidate): DigestRejectionReason[] {
  const reasons: DigestRejectionReason[] = [];
  if (candidate.canonicalItemId) reasons.push('duplicate_story');
  if (
    ![
      candidate.title_en,
      candidate.title_uk,
      candidate.summary_en,
      candidate.summary_uk,
      candidate.why_matters_en,
      candidate.why_matters_uk,
    ].every(hasText)
  ) {
    reasons.push('missing_bilingual_copy');
  }
  if (!candidate.citationUrls.some(isHttpsUrl)) reasons.push('missing_citations');
  if (candidate.factsEnCount < 1 || candidate.factsUkCount < 1) {
    reasons.push('missing_bilingual_facts');
  }
  if (!isHttpsUrl(candidate.sourceUrl)) reasons.push('missing_source_url');
  if (!(candidate.impact_level && candidate.impact_level in IMPACT_POINTS)) {
    reasons.push('missing_impact_assessment');
  }
  if (candidate.scoreVersion !== CURRENT_SCORE_VERSION) reasons.push('stale_score_telemetry');
  return reasons;
}

function sourceKey(candidate: DigestCandidate): string {
  try {
    return new URL(candidate.sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return candidate.sourceName.trim().toLowerCase() || 'unknown';
  }
}

function scoreCandidate(candidate: DigestCandidate, weekEnd: string): ScoredDigestCandidate {
  const impact = candidate.impact_level as keyof typeof IMPACT_POINTS;
  const editorialImpact = IMPACT_POINTS[impact] ?? 0;
  const citationPoints = Math.min(8, 5 + candidate.citationUrls.length);
  const bilingualFactCount = Math.min(candidate.factsEnCount, candidate.factsUkCount);
  const factPoints = Math.min(4, bilingualFactCount + 1);
  const evidence = citationPoints + factPoints + clamp01(candidate.authorityScore) * 8;
  const corroboration =
    clamp01(candidate.crossSourceScore) * 10 + clamp01(candidate.breadthScore) * 5;
  const upstreamRank = clamp01(candidate.compositeScore) * 10;
  const audienceFit = AUDIENCE_FIT_POINTS[candidate.category_slug ?? ''] ?? 6;
  const dailyPriority = clamp01((11 - candidate.rank) / 10) * 5;
  const ageDays = Math.max(
    0,
    (Date.parse(`${weekEnd}T00:00:00Z`) - Date.parse(`${candidate.date}T00:00:00Z`)) / 86_400_000,
  );
  const recency = clamp01(1 - ageDays / 7) * 5;
  const breakdown = {
    editorialImpact,
    evidence,
    corroboration,
    upstreamRank,
    audienceFit,
    dailyPriority,
    recency,
  } satisfies DigestScoreBreakdown;
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const reasons = [
    impact === 'high' ? 'high editorial impact' : null,
    (candidate.authorityScore ?? 0) >= 0.9 ? 'high-authority source' : null,
    (candidate.crossSourceScore ?? 0) > 0 || candidate.mentionsCount > 1
      ? 'corroborated across sources'
      : null,
    bilingualFactCount >= 3 && candidate.citationUrls.length >= 1
      ? 'strong evidence package'
      : null,
    candidate.rank <= 2 ? 'top daily editorial rank' : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    candidate,
    score: Math.round(score * 10) / 10,
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([key, value]) => [key, Math.round(value * 10) / 10]),
    ) as unknown as DigestScoreBreakdown,
    reasons,
  };
}

function compareScored(a: ScoredDigestCandidate, b: ScoredDigestCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.candidate.date !== b.candidate.date) return a.candidate.date < b.candidate.date ? 1 : -1;
  if (a.candidate.rank !== b.candidate.rank) return a.candidate.rank - b.candidate.rank;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/**
 * Editorial weekly selection: trust gates first, explainable scoring second,
 * diversity constraints last. Source/day caps are soft so a sparse week can
 * still ship; event and category caps stay hard to prevent repetitive digests.
 */
export function selectEditorialDigestItems(
  candidates: DigestCandidate[],
  options: EditorialSelectionOptions = {},
): EditorialDigestSelection {
  const max = options.max ?? 7;
  const perCategoryCap = options.perCategoryCap ?? 2;
  const perSourceCap = options.perSourceCap ?? 2;
  const perDayCap = options.perDayCap ?? 2;
  const rejected: EditorialDigestSelection['rejected'] = [];
  const accepted: DigestCandidate[] = [];
  for (const candidate of candidates) {
    const reasons = rejectionReasons(candidate);
    if (reasons.length > 0) rejected.push({ candidate, reasons });
    else accepted.push(candidate);
  }

  const weekEnd =
    accepted
      .map((candidate) => candidate.date)
      .sort()
      .at(-1) ?? '1970-01-01';
  const eligible = accepted
    .map((candidate) => scoreCandidate(candidate, weekEnd))
    .sort(compareScored);
  const selected: ScoredDigestCandidate[] = [];
  const selectedIds = new Set<string>();
  const clusterIds = new Set<string>();
  const categoryCount = new Map<string, number>();
  const sourceCount = new Map<string, number>();
  const dayCount = new Map<string, number>();

  const passes = [
    { sourceCap: perSourceCap, dayCap: perDayCap },
    { sourceCap: perSourceCap, dayCap: Number.POSITIVE_INFINITY },
    { sourceCap: Number.POSITIVE_INFINITY, dayCap: Number.POSITIVE_INFINITY },
  ];
  for (const pass of passes) {
    for (const scored of eligible) {
      const candidate = scored.candidate;
      if (selectedIds.has(candidate.id)) continue;
      const cluster = candidate.clusterId ?? `article:${candidate.articleId}`;
      const category = candidate.category_slug ?? 'other';
      const source = sourceKey(candidate);
      if (clusterIds.has(cluster)) continue;
      if ((categoryCount.get(category) ?? 0) >= perCategoryCap) continue;
      if ((sourceCount.get(source) ?? 0) >= pass.sourceCap) continue;
      if ((dayCount.get(candidate.date) ?? 0) >= pass.dayCap) continue;
      selected.push(scored);
      selectedIds.add(candidate.id);
      clusterIds.add(cluster);
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
      sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
      dayCount.set(candidate.date, (dayCount.get(candidate.date) ?? 0) + 1);
      if (selected.length >= max) break;
    }
    if (selected.length >= max) break;
  }

  return { version: WEEKLY_SELECTION_VERSION, selected, eligible, rejected };
}

/** Compatibility wrapper for the legacy Telegram formatter. */
export function selectDigestItems(
  candidates: DigestCandidate[],
  max = 7,
  perCategoryCap = 2,
): DigestCandidate[] {
  return selectEditorialDigestItems(candidates, { max, perCategoryCap }).selected.map(
    ({ candidate }) => candidate,
  );
}

/** One-sentence cut of the summary for the digest line. */
export function digestLineSummary(summary: string, maxChars = 160): string {
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  const cut =
    firstSentence.length > maxChars ? `${firstSentence.slice(0, maxChars - 1)}…` : firstSentence;
  return cut.trim();
}

/** Telegram-HTML digest post. `weekLabel` e.g. "2–8 червня". */
export function formatWeeklyDigest(
  items: DigestCandidate[],
  opts: { siteUrl: string; weekLabel: string },
): string {
  const lines: string[] = [
    `🗞 <b>Тиждень в AI — найважливіше</b> (${escapeHtml(opts.weekLabel)})`,
    '',
  ];
  items.forEach((item, i) => {
    const url = `${opts.siteUrl}/uk/${item.briefSlug}/${item.itemSlug}`;
    lines.push(
      `${i + 1}. <a href="${escapeHtml(url)}"><b>${escapeHtml(item.title_uk || item.title_en)}</b></a>`,
      `   ${escapeHtml(digestLineSummary(item.summary_uk))}`,
      '',
    );
  });
  lines.push(`Повний архів і щоденний бриф → ${opts.siteUrl}/uk/news`);
  return lines.join('\n');
}

/** Human week range label in Ukrainian, e.g. "2–8 червня" (genitive via Intl). */
export function weekLabelUk(endDate: Date): string {
  const start = new Date(endDate);
  start.setDate(start.getDate() - 6);
  const dayMonth = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });
  if (start.getMonth() === endDate.getMonth()) {
    return `${start.getDate()}–${dayMonth.format(endDate)}`;
  }
  return `${dayMonth.format(start)} – ${dayMonth.format(endDate)}`;
}
