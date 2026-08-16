/**
 * Stage 2 — Rank (public / topical-authority tuned, not audience-of-one).
 *
 * Same-event coverage is clustered (fuzzy title match, story-identity keys, or
 * daily-tool ownership with two shared entities), then each cluster gets
 * a composite score in [0, 1] from six normalized signals (weights sum to 1):
 *
 *   0.30 · velocity      — engagement per hour since publication (what's hot now)
 *   0.22 · cross_source  — how much coverage the story drew (mentions)
 *   0.18 · authority     — source trust (first-party labs / high-signal feeds)
 *   0.15 · recency       — pure time decay, 12h half-life
 *   0.10 · inbrief        — InBrief editorial importance (0–100)
 *   0.05 · breadth       — how many DISTINCT sources covered it
 *
 * Each signal is squashed to [0, 1] so the weights are truly proportional and the
 * `minScore` floor downstream is interpretable. Clickbait / pure-punditry AND
 * off-niche "news genre" stories (funding, personnel, legal, celebrity) are demoted
 * — the loudest AI stories on HN/X are business drama, which wins on velocity and
 * crowds out the practical tools the reader actually wants. Ownership changes of
 * the reader's daily tools (Cursor, Claude Code, Codex, …) are exempt: those
 * change next week's workflow, so they must not fall under the M&A floor.
 * Topic + category are attached for the diversity cap and storage; the LLM
 * editor curates after.
 */

import { createHash } from 'node:crypto';
import { isReaderToolOwnershipChange, sameOwnershipEvent } from './reader-tools';
import { sourceTrust } from './source-authority';
import { identitiesOverlap, storyIdentityKeys } from './story-identity';
import { titlesSimilar } from './text';
import { categoryForTitle, detectTopic, type CategorySlug } from './topics';

export interface Candidate {
  /** Stable id for clustering / source-cap bookkeeping (the url works). */
  id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string;
  hn_score: number | null;
  hn_comments: number | null;
  reddit_score: number | null;
  reddit_comments: number | null;
  inbrief_score: number | null;
  /** Coverage weight of this row (1 per fetched article; clustering sums them). */
  mentions_count: number;
}

export interface ScoreComponents {
  velocity: number;
  crossSource: number;
  authority: number;
  recency: number;
  inbrief: number;
  breadth: number;
}

export interface RankedEntry {
  lead: Candidate;
  score: number;
  components: ScoreComponents;
  /** Total coverage across the cluster (summed mentions_count). */
  mentions: number;
  /** Distinct source_name count in the cluster. */
  breadth: number;
  topic: string;
  category: CategorySlug;
  clusterSize: number;
  /** Every member article's url — the score telemetry is written to all of them, not just the lead. */
  memberUrls: string[];
  /** Stable id of the cluster (sha1 of its sorted member urls) so non-lead rows share one group key. */
  clusterId: string;
}

export interface RankResult {
  ranked: RankedEntry[];
  /**
   * Every scored cluster, sorted, BEFORE the per-source cap — the full telemetry
   * surface. `ranked` is this list with `MAX_PER_SOURCE` applied for the editor.
   */
  scored: RankedEntry[];
  clusters: number;
  dropped: number;
}

// ─── Weights (sum to 1.0) ────────────────────────────────────────────────────

export const WEIGHTS = {
  velocity: 0.3,
  crossSource: 0.22,
  authority: 0.18,
  recency: 0.15,
  inbrief: 0.1,
  breadth: 0.05,
} as const;

/**
 * Rank-formula generation stamped onto every persisted score. Bump on ANY change
 * to WEIGHTS or the normalization, so a mixed-generation dataset stays separable
 * (v1 = pre-normalization rows whose scores can exceed 1 — excluded from training;
 * v2 = the current normalized [0,1] scale).
 */
export const SCORE_VERSION = 2;

/** Engagement/hour that maps to a 0.5 velocity component. */
const VELOCITY_HALF = 15;
/** Extra mentions beyond the first that map to a 0.5 cross-source component. */
const CROSS_SOURCE_HALF = 1.5;
/** Extra distinct sources beyond the first that map to a 0.5 breadth component. */
const BREADTH_HALF = 1.5;
/** Recency half-life (hours). */
const RECENCY_HALF_LIFE_HOURS = 12;
/** Floor on cluster age so a just-published item can't divide by ~0. */
const MIN_AGE_HOURS = 0.5;
/**
 * First-party lab/vendor blogs carry no HN/Reddit engagement, so their velocity
 * is 0 at exactly the moment an announcement IS the news — a fresh Anthropic
 * release post would lose to any noisy thread. Sources at the top trust tier
 * get a velocity floor instead; recency decay still ages them out naturally.
 */
const OFFICIAL_TRUST = 1;
const OFFICIAL_VELOCITY_FLOOR = 0.5;

/** Saturating 0→1 curve: `value` half-saturates at `half`, never reaches 1. */
function saturate(value: number, half: number): number {
  if (value <= 0) return 0;
  return 1 - 0.5 ** (value / half);
}

// ─── Source trust ────────────────────────────────────────────────────────────
// The table itself lives in `source-authority.ts`, shared with the weekly
// digest's publisher-level read. Re-exported so `rank`'s public surface (and
// its tests) stay unchanged.

export { sourceTrust } from './source-authority';

// ─── Clickbait / punditry demotion ───────────────────────────────────────────

const CLICKBAIT_PATTERNS: Array<[RegExp, number]> = [
  [/\b(you (won['’]?t|wont) believe|shocking|mind[- ]blowing|this one (trick|secret)|will change everything|the end of)\b/i, 0.5],
  [/\b(hot take|unpopular opinion|\brant\b|i think|my thoughts on)\b/i, 0.4],
  [/\b\w+ (says|claims|thinks|believes|warns|predicts|reveals|slams)\b/i, 0.3],
];

/** Multiplicative penalty in [0, 0.5] — opinion dressed as news scores lower. */
export function clickbaitDemotion(title: string): number {
  let demotion = 0;
  for (const [re, d] of CLICKBAIT_PATTERNS) if (re.test(title)) demotion = Math.max(demotion, d);
  return demotion;
}

// ─── Off-niche "news genre" demotion ─────────────────────────────────────────
// The reader wants PRACTICAL dev intel, but the loudest AI stories on HN/Reddit/X
// are business / personnel / legal / celebrity drama — they win on velocity +
// cross-source and bury the usable tools. Demote that genre so practical items
// rise in the pool (the LLM editor still makes the final keep/drop call). Tuned
// for PRECISION: tool/model RELEASES and personal-monetisation items must NOT
// match — only the "be aware this happened" newswire shape. Patterns are anchored
// (e.g. money must read in billions, funding needs a funding word) to avoid
// demoting wanted content; the editor's deny-list catches whatever slips through.
const NEWS_GENRE_PATTERNS: Array<[RegExp, number]> = [
  // Company finance: IPO / valuation / funding round / M&A / earnings.
  [/\b(ipo|s-1|valuation|funding round|series [a-f] (round|funding)|venture funding|acquir(es|ed|ing|ition)|\bmerger\b|quarterly (earnings|revenue)|losing billions)\b/i, 0.5],
  // Big-money sums ($60M, $1.5bn) — company-scale, NOT personal $k monetisation.
  [/\$\d[\d,.]*\s?(m|bn|b|million|billion|trillion)\b/i, 0.5],
  // Executive / personnel moves.
  [/\b(joins|leaving|leaves|departs?|stepping down|steps down|resign(s|ed)?|ousted|named (ceo|cto|president|head of))\b/i, 0.5],
  // Legal / regulatory / policy / geopolitics.
  [/\b(sues?|lawsuit|antitrust|subpoena|sec filing|regulators?|congress|senate|white house|export (ban|control|restrict)|sanctions?|tariffs?)\b/i, 0.5],
  // Entertainment / celebrity PR.
  [/\b(biopic|hollywood|box[- ]office)\b/i, 0.5],
];

/** Multiplicative penalty in [0, 0.5] for off-niche business/personnel/legal/celebrity news. */
export function newsGenreDemotion(title: string): number {
  // Cursor/Claude Code/Codex ownership changes are playbook, not newswire.
  if (isReaderToolOwnershipChange(title)) return 0;
  let demotion = 0;
  for (const [re, d] of NEWS_GENRE_PATTERNS) if (re.test(title)) demotion = Math.max(demotion, d);
  return demotion;
}

/**
 * True when genre/clickbait demotion pushed a cluster under `minScore` that
 * would otherwise have made the pool. Logged so M&A floors are visible.
 */
export function wasHeldDownByGenre(title: string, score: number, minScore: number): boolean {
  const demotion = Math.max(clickbaitDemotion(title), newsGenreDemotion(title));
  if (demotion <= 0 || demotion >= 1) return false;
  const base = score / (1 - demotion);
  return score < minScore && base >= minScore;
}

// ─── Cluster scoring ─────────────────────────────────────────────────────────

function articleEngagement(a: Candidate): number {
  return (a.hn_score ?? 0) + (a.reddit_score ?? 0);
}

function pickClusterLead(cluster: Candidate[]): Candidate {
  let best = cluster[0];
  if (!best) throw new Error('[rank] pickClusterLead received an empty cluster');
  for (let i = 1; i < cluster.length; i++) {
    const candidate = cluster[i];
    if (candidate && articleEngagement(candidate) > articleEngagement(best)) best = candidate;
  }
  return best;
}

function clusterAgeHours(cluster: Candidate[], nowMs: number): number {
  const freshestMs = cluster.reduce((mx, a) => {
    const ts = Date.parse(a.published_at);
    return Number.isNaN(ts) ? mx : Math.max(mx, ts);
  }, 0);
  if (freshestMs === 0) return MIN_AGE_HOURS;
  return Math.max(MIN_AGE_HOURS, (nowMs - freshestMs) / 3_600_000);
}

export function scoreComponents(cluster: Candidate[], nowMs: number): ScoreComponents {
  const totalEngagement = cluster.reduce((s, a) => s + articleEngagement(a), 0);
  const mentions = cluster.reduce((s, a) => s + a.mentions_count, 0);
  const distinctSources = new Set(cluster.map((a) => a.source_name)).size;
  const maxInbrief = cluster.reduce((mx, a) => Math.max(mx, a.inbrief_score ?? 0), 0);
  const ageHours = clusterAgeHours(cluster, nowMs);
  const authority = cluster.reduce((mx, a) => Math.max(mx, sourceTrust(a.source_name)), 0);
  const rawVelocity = saturate(totalEngagement / ageHours, VELOCITY_HALF);

  return {
    velocity:
      authority >= OFFICIAL_TRUST ? Math.max(rawVelocity, OFFICIAL_VELOCITY_FLOOR) : rawVelocity,
    crossSource: saturate(mentions - 1, CROSS_SOURCE_HALF),
    authority,
    recency: 0.5 ** (ageHours / RECENCY_HALF_LIFE_HOURS),
    inbrief: Math.min(1, maxInbrief / 100),
    breadth: saturate(distinctSources - 1, BREADTH_HALF),
  };
}

export function compositeScore(c: ScoreComponents): number {
  return (
    WEIGHTS.velocity * c.velocity +
    WEIGHTS.crossSource * c.crossSource +
    WEIGHTS.authority * c.authority +
    WEIGHTS.recency * c.recency +
    WEIGHTS.inbrief * c.inbrief +
    WEIGHTS.breadth * c.breadth
  );
}

/** Stable 12-hex id for a cluster, derived from its sorted member urls. */
export function clusterIdFor(memberUrls: string[]): string {
  return createHash('sha1').update([...memberUrls].sort().join('|')).digest('hex').slice(0, 12);
}

function scoreCluster(cluster: Candidate[], nowMs: number): RankedEntry {
  const lead = pickClusterLead(cluster);
  const components = scoreComponents(cluster, nowMs);
  const base = compositeScore(components);
  const demotion = Math.max(clickbaitDemotion(lead.title), newsGenreDemotion(lead.title));
  const score = base * (1 - demotion);
  const memberUrls = cluster.map((a) => a.url);
  return {
    lead,
    score,
    components,
    mentions: cluster.reduce((s, a) => s + a.mentions_count, 0),
    breadth: new Set(cluster.map((a) => a.source_name)).size,
    topic: detectTopic(lead.title),
    category: categoryForTitle(lead.title),
    clusterSize: cluster.length,
    memberUrls,
    clusterId: clusterIdFor(memberUrls),
  };
}

// ─── Clustering + source diversity ───────────────────────────────────────────

function sameEventCoverage(a: Candidate, b: Candidate): boolean {
  if (titlesSimilar(a.title, b.title)) return true;
  if (sameOwnershipEvent(a.title, b.title)) return true;
  return identitiesOverlap(
    storyIdentityKeys(a.title, a.url),
    storyIdentityKeys(b.title, b.url),
  );
}

function clusterByTitleSimilarity(items: Candidate[]): Candidate[][] {
  const clusters: Candidate[][] = [];
  const assigned = new Set<string>();

  for (const a of items) {
    if (assigned.has(a.id)) continue;
    const cluster = [a];
    assigned.add(a.id);
    for (const b of items) {
      if (assigned.has(b.id)) continue;
      if (!sameEventCoverage(a, b)) continue;
      cluster.push(b);
      assigned.add(b.id);
    }
    clusters.push(cluster);
  }
  return clusters;
}

const MAX_PER_SOURCE = 3;

function capPerSource(entries: RankedEntry[], maxPerSource: number): RankedEntry[] {
  const counts: Record<string, number> = {};
  const kept: RankedEntry[] = [];
  for (const entry of entries) {
    const src = entry.lead.source_name;
    const n = counts[src] ?? 0;
    if (n >= maxPerSource) continue;
    counts[src] = n + 1;
    kept.push(entry);
  }
  return kept;
}

/**
 * Cluster, score, sort, and cap per source. `minScore` drops weak items here so
 * the cluster count reported as `dropped` is meaningful; the pool stage applies
 * its own floor + topic cap on what survives.
 */
export function rankCandidates(
  items: Candidate[],
  minScore = 0,
  nowMs = Date.now(),
): RankResult {
  const clusters = clusterByTitleSimilarity(items);
  const scored = clusters
    .map((c) => scoreCluster(c, nowMs))
    .filter((e) => e.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return {
    ranked: capPerSource(scored, MAX_PER_SOURCE),
    scored,
    clusters: clusters.length,
    dropped: clusters.length - scored.length,
  };
}
