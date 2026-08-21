import { clipToMaxChars } from './clip-text';

export interface WeeklyGeoItem {
  rank: number;
  title: string;
  summary: string;
  why: string;
  takeaway: string;
  discussionQuestion: string;
}

export interface WeeklyGeoDigest {
  title: string;
  metaDescription: string;
  standfirst: string | null;
  intro: string | null;
  items: WeeklyGeoItem[];
}

export interface WeeklyFaqEntry {
  question: string;
  answer: string;
}

export interface WeeklyMetricRow {
  label: string;
  value: string;
  storyTitle: string;
}

const METRIC_PATTERN =
  /\b(\d+(?:[.,]\d+)?\s*(?:B|T|%|x|×|billion|trillion|млрд|млн)|0\s+of\s+\d+|\d+\s+of\s+\d+|\d+–\d+%|\d+×)\b/giu;

export function weeklyMetaDescription(digest: WeeklyGeoDigest): string {
  const raw =
    digest.metaDescription ||
    digest.standfirst ||
    digest.intro ||
    digest.items[0]?.summary ||
    digest.title;
  return clipToMaxChars(raw, 160);
}

export function weeklyFaqFromDigest(digest: WeeklyGeoDigest): WeeklyFaqEntry[] {
  const entries: WeeklyFaqEntry[] = [];
  for (const item of digest.items) {
    if (item.rank > 3) continue;
    const question = item.discussionQuestion.trim();
    if (!question) continue;
    const answer = (item.takeaway || item.summary || item.why).trim();
    if (!answer) continue;
    entries.push({ question, answer });
  }
  return entries.slice(0, 5);
}

function metricLabel(raw: string): string {
  if (/%/.test(raw)) return 'Share / change';
  if (/of/i.test(raw)) return 'Count';
  if (/[x×]/i.test(raw)) return 'Multiple';
  if (/B|billion|млрд/i.test(raw)) return 'Active parameters / scale';
  if (/T|trillion/i.test(raw)) return 'Headline parameter count';
  return 'Figure';
}

export function weeklyMetricsFromItems(items: WeeklyGeoItem[]): WeeklyMetricRow[] {
  const rows: WeeklyMetricRow[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const haystack = [item.summary, item.why, item.takeaway].join(' ');
    const matches = haystack.match(METRIC_PATTERN) ?? [];
    for (const match of matches) {
      const value = match.trim();
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        label: metricLabel(value),
        value,
        storyTitle: item.title,
      });
      if (rows.length >= 8) return rows;
    }
  }
  return rows;
}
