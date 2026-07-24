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
export const WEEKLY_RATIONALE_VERSION = 'weekly-rationale-v1';

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

export type DigestCandidateSelectionStatus = 'selected' | 'eligible_not_selected' | 'rejected';

export type DigestCandidateExclusionReason =
  DigestRejectionReason | 'event_cluster_covered' | 'category_balance' | 'digest_capacity';

export interface DigestSelectionCandidateSnapshot {
  brief_item_id: string;
  title_en: string;
  title_uk: string;
  brief_date: string;
  daily_rank: number;
  impact_level: string | null;
  category_slug: string | null;
  source_name: string;
  source_url: string;
  cluster_id: string | null;
  citation_count: number;
  status: DigestCandidateSelectionStatus;
  selected_rank: number | null;
  score: number | null;
  breakdown: DigestScoreBreakdown | null;
  selection_reasons: string[];
  exclusion_reasons: DigestCandidateExclusionReason[];
}

export interface DigestRationaleMetrics {
  candidateCount: number;
  eligibleCount: number;
  rejectedCount: number;
  selectedCount: number;
  eligibleNotSelectedCount: number;
  categoryCount: number;
  sourceCount: number;
  briefDayCount: number;
  highImpactCount: number;
  corroboratedCount: number;
  strongEvidenceCount: number;
  averageScore: number;
  selectionFloor: number;
  gateReasonCounts: Partial<Record<DigestRejectionReason, number>>;
}

export interface DigestEditorialRationale {
  version: typeof WEEKLY_RATIONALE_VERSION;
  summary_en: string;
  summary_uk: string;
  decisive_factors_en: string[];
  decisive_factors_uk: string[];
  tradeoffs_en: string;
  tradeoffs_uk: string;
  metrics: DigestRationaleMetrics;
}

export interface DigestSelectionContext {
  rationale: DigestEditorialRationale;
  candidates: DigestSelectionCandidateSnapshot[];
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

function roundedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function exclusionReasonsForEligibleCandidate(
  scored: ScoredDigestCandidate,
  selected: ScoredDigestCandidate[],
): DigestCandidateExclusionReason[] {
  const candidate = scored.candidate;
  const cluster = candidate.clusterId ?? `article:${candidate.articleId}`;
  if (
    selected.some(
      ({ candidate: selectedCandidate }) =>
        (selectedCandidate.clusterId ?? `article:${selectedCandidate.articleId}`) === cluster,
    )
  ) {
    return ['event_cluster_covered'];
  }
  const category = candidate.category_slug ?? 'other';
  if (
    selected.filter(
      ({ candidate: selectedCandidate }) =>
        (selectedCandidate.category_slug ?? 'other') === category,
    ).length >= 2
  ) {
    return ['category_balance'];
  }
  return ['digest_capacity'];
}

/**
 * Builds the compact, review-facing explanation and the reproducible candidate
 * pool for one selection run. This is summarized rationale, not hidden model
 * reasoning: every statement is derived from persisted inputs and scores.
 */
export function buildDigestSelectionContext(
  selection: EditorialDigestSelection,
): DigestSelectionContext {
  const selectedRank = new Map(
    selection.selected.map(({ candidate }, index) => [candidate.id, index + 1]),
  );
  const eligibleById = new Map(selection.eligible.map((scored) => [scored.candidate.id, scored]));
  const rejectedById = new Map(
    selection.rejected.map(({ candidate, reasons }) => [candidate.id, reasons]),
  );
  const allCandidates = [
    ...selection.eligible.map(({ candidate }) => candidate),
    ...selection.rejected.map(({ candidate }) => candidate),
  ];
  const candidateSnapshots = allCandidates.map((candidate) => {
    const scored = eligibleById.get(candidate.id);
    const gateReasons = rejectedById.get(candidate.id) ?? [];
    const rank = selectedRank.get(candidate.id) ?? null;
    const status: DigestCandidateSelectionStatus =
      gateReasons.length > 0 ? 'rejected' : rank ? 'selected' : 'eligible_not_selected';
    return {
      brief_item_id: candidate.id,
      title_en: candidate.title_en,
      title_uk: candidate.title_uk,
      brief_date: candidate.date,
      daily_rank: candidate.rank,
      impact_level: candidate.impact_level,
      category_slug: candidate.category_slug,
      source_name: candidate.sourceName,
      source_url: candidate.sourceUrl,
      cluster_id: candidate.clusterId,
      citation_count: candidate.citationUrls.length,
      status,
      selected_rank: rank,
      score: scored?.score ?? null,
      breakdown: scored?.breakdown ?? null,
      selection_reasons: scored?.reasons ?? [],
      exclusion_reasons:
        gateReasons.length > 0
          ? gateReasons
          : rank || !scored
            ? []
            : exclusionReasonsForEligibleCandidate(scored, selection.selected),
    } satisfies DigestSelectionCandidateSnapshot;
  });

  const selectedCandidates = selection.selected.map(({ candidate }) => candidate);
  const gateReasonCounts: DigestRationaleMetrics['gateReasonCounts'] = {};
  for (const { reasons } of selection.rejected) {
    for (const reason of reasons) gateReasonCounts[reason] = (gateReasonCounts[reason] ?? 0) + 1;
  }
  const metrics = {
    candidateCount: candidateSnapshots.length,
    eligibleCount: selection.eligible.length,
    rejectedCount: selection.rejected.length,
    selectedCount: selection.selected.length,
    eligibleNotSelectedCount: Math.max(0, selection.eligible.length - selection.selected.length),
    categoryCount: new Set(
      selectedCandidates.map((candidate) => candidate.category_slug ?? 'other'),
    ).size,
    sourceCount: new Set(selectedCandidates.map(sourceKey)).size,
    briefDayCount: new Set(selectedCandidates.map((candidate) => candidate.date)).size,
    highImpactCount: selectedCandidates.filter((candidate) => candidate.impact_level === 'high')
      .length,
    corroboratedCount: selectedCandidates.filter(
      (candidate) => (candidate.crossSourceScore ?? 0) > 0 || candidate.mentionsCount > 1,
    ).length,
    strongEvidenceCount: selectedCandidates.filter(
      (candidate) =>
        Math.min(candidate.factsEnCount, candidate.factsUkCount) >= 3 &&
        candidate.citationUrls.length >= 1,
    ).length,
    averageScore: roundedAverage(selection.selected.map(({ score }) => score)),
    selectionFloor: selection.selected.at(-1)?.score ?? 0,
    gateReasonCounts,
  } satisfies DigestRationaleMetrics;

  const summary_en =
    `Selected ${metrics.selectedCount} of ${metrics.candidateCount} approved stories from the week: ` +
    `${metrics.eligibleCount} passed the evidence gates and ${metrics.rejectedCount} were excluded before scoring. ` +
    `Editorial impact, evidence quality, independent corroboration, and practical builder value determined the final mix; diversity rules kept repeated events and categories from dominating.`;
  const summary_uk =
    `Відібрано ${metrics.selectedCount} із ${metrics.candidateCount} затверджених новин тижня: ` +
    `${metrics.eligibleCount} пройшли перевірки доказовості, а ${metrics.rejectedCount} були відсіяні до оцінювання. ` +
    `Фінальний склад визначили редакційний вплив, якість доказів, незалежне підтвердження та практична цінність; правила різноманітності не дали одній події чи темі домінувати.`;
  const decisive_factors_en = [
    `${metrics.highImpactCount} high-impact stories`,
    `${metrics.strongEvidenceCount} stories with strong evidence packages`,
    `${metrics.corroboratedCount} stories corroborated across sources or signals`,
    `${metrics.categoryCount} categories across ${metrics.sourceCount} source domains`,
  ];
  const decisive_factors_uk = [
    `${metrics.highImpactCount} новин із високим впливом`,
    `${metrics.strongEvidenceCount} новин із сильним пакетом доказів`,
    `${metrics.corroboratedCount} новин із підтвердженням кількома джерелами або сигналами`,
    `${metrics.categoryCount} категорій із ${metrics.sourceCount} доменів джерел`,
  ];
  const tradeoffs_en =
    `${metrics.eligibleNotSelectedCount} eligible stories remained outside the digest because of ` +
    `the seven-story limit, event deduplication, or category balance.`;
  const tradeoffs_uk =
    `Поза дайджестом залишилося придатних новин: ${metrics.eligibleNotSelectedCount}. Причини: ліміт у сім позицій, ` +
    `дедуплікацію подій або баланс категорій.`;

  return {
    rationale: {
      version: WEEKLY_RATIONALE_VERSION,
      summary_en,
      summary_uk,
      decisive_factors_en,
      decisive_factors_uk,
      tradeoffs_en,
      tradeoffs_uk,
      metrics,
    },
    candidates: candidateSnapshots.sort((a, b) => {
      if (a.status !== b.status) {
        const order: Record<DigestCandidateSelectionStatus, number> = {
          selected: 0,
          eligible_not_selected: 1,
          rejected: 2,
        };
        return order[a.status] - order[b.status];
      }
      if (a.selected_rank !== null || b.selected_rank !== null) {
        return (
          (a.selected_rank ?? Number.POSITIVE_INFINITY) -
          (b.selected_rank ?? Number.POSITIVE_INFINITY)
        );
      }
      return (b.score ?? -1) - (a.score ?? -1);
    }),
  };
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
    const url = item.category_slug
      ? `${opts.siteUrl}/uk/news/${item.category_slug}/${item.itemSlug}`
      : `${opts.siteUrl}/uk/news`;
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
