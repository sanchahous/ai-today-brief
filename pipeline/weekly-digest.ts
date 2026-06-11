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
  title_uk: string;
  title_en: string;
  summary_uk: string;
  impact_level: string | null;
  category_slug: string | null;
  briefSlug: string;
  itemSlug: string;
  /** Brief date (ISO) — newer wins inside the same impact tier. */
  date: string;
  rank: number;
}

const IMPACT_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Top items of the week: impact first, fresh first, ≤2 per category. */
export function selectDigestItems(
  candidates: DigestCandidate[],
  max = 7,
  perCategoryCap = 2,
): DigestCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const ia = IMPACT_SCORE[a.impact_level ?? ''] ?? 1;
    const ib = IMPACT_SCORE[b.impact_level ?? ''] ?? 1;
    if (ia !== ib) return ib - ia;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.rank - b.rank;
  });

  const perCategory: Record<string, number> = {};
  const out: DigestCandidate[] = [];
  for (const c of sorted) {
    const cat = c.category_slug ?? 'other';
    if ((perCategory[cat] ?? 0) >= perCategoryCap) continue;
    perCategory[cat] = (perCategory[cat] ?? 0) + 1;
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** One-sentence cut of the summary for the digest line. */
export function digestLineSummary(summary: string, maxChars = 160): string {
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  const cut = firstSentence.length > maxChars ? `${firstSentence.slice(0, maxChars - 1)}…` : firstSentence;
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
