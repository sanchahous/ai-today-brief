/**
 * Daily brief fixture capture + quality replay for content-sim.
 * Capture is read-only against Supabase; run writes only under artifacts/_local.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentSimQualityReport } from '@/lib/content-sim';
import { buildEscalationPackage, toContentSimArtifactMeta } from '@/lib/content-sim';

export interface DailyBriefFixtureItem {
  id: string;
  title_en: string;
  summary_en?: string | null;
  body_md_en?: string | null;
  review_comment?: string | null;
  review_status?: string | null;
  card_image_url?: string | null;
  article_id?: string | null;
}

export interface DailyBriefFixture {
  capturedAt: string;
  briefId: string;
  slug?: string;
  date?: string;
  items: DailyBriefFixtureItem[];
}

export async function captureDailyBriefFixture(briefIdOrSlug: string): Promise<DailyBriefFixture> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
  const db = getSupabaseAdmin();
  const byId = await db
    .from('briefs')
    .select('id,slug,date,status')
    .eq('id', briefIdOrSlug)
    .maybeSingle();
  const brief =
    byId.data ??
    (
      await db.from('briefs').select('id,slug,date,status').eq('slug', briefIdOrSlug).maybeSingle()
    ).data;
  if (!brief) throw new Error(`Brief not found: ${briefIdOrSlug}`);

  const { data: items, error } = await db
    .from('brief_items')
    .select(
      'id,title_en,summary_en,body_md_en,review_comment,review_status,card_image_url,article_id',
    )
    .eq('brief_id', brief.id)
    .order('rank', { ascending: true });
  if (error) throw new Error(error.message);

  return {
    capturedAt: new Date().toISOString(),
    briefId: brief.id,
    slug: brief.slug ?? undefined,
    date: brief.date ?? undefined,
    items: (items ?? []).map((item) => ({
      id: item.id,
      title_en: item.title_en ?? '',
      summary_en: item.summary_en,
      body_md_en: item.body_md_en,
      review_comment: item.review_comment,
      review_status: item.review_status,
      card_image_url: item.card_image_url,
      article_id: item.article_id,
    })),
  };
}

/**
 * Offline quality gate over a captured daily fixture: flags items whose
 * review_comment still carries fact-check / UK quality markers.
 */
export async function runDailyBriefSim(
  fixturePath: string,
  outDir: string,
): Promise<ContentSimQualityReport> {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as DailyBriefFixture;
  mkdirSync(outDir, { recursive: true });

  const blockers = fixture.items.flatMap((item) => {
    const out: ContentSimQualityReport['blockers'] = [];
    const comment = (item.review_comment ?? '').toLowerCase();
    if (comment.includes('джерело не підтверджує') || comment.includes('unsupported')) {
      out.push({
        code: 'unsupported_claim',
        message: `${item.id}: review_comment flags unsupported claims`,
        blocker: true,
        region: item.id,
      });
    }
    if (comment.includes('uk_quality') || comment.includes('ukrainian')) {
      out.push({
        code: 'uk_quality_flag',
        message: `${item.id}: review_comment flags UK quality issues`,
        blocker: true,
        region: item.id,
      });
    }
    if (item.review_status === 'rejected') {
      out.push({
        code: 'item_rejected',
        message: `${item.id}: review_status is rejected`,
        blocker: true,
        region: item.id,
      });
    }
    return out;
  });

  const passed = blockers.length === 0;
  const report: ContentSimQualityReport = {
    adapter: 'daily-brief',
    outcome: passed ? 'passed' : 'needs_human_review',
    passed,
    attempts: 1,
    maxAttempts: 1,
    finalScores: { overall: passed ? 100 : Math.max(0, 100 - blockers.length * 10) },
    blockers,
    iterations: [
      {
        attempt: 1,
        critique: {
          passed,
          scores: { overall: passed ? 100 : Math.max(0, 100 - blockers.length * 10) },
          blockers,
        },
        promptSummary: `daily-brief:${fixture.slug ?? fixture.briefId}`,
      },
    ],
    totalCostUsd: 0,
    escalation: passed
      ? undefined
      : buildEscalationPackage({
          reason: 'attempts_exhausted',
          iterations: [
            {
              attempt: 1,
              critique: {
                passed: false,
                scores: { overall: 40 },
                blockers,
                repairDirective: {
                  suggestedActions: [
                    'Re-run pipeline verify/revise on flagged items before publish.',
                    'Tighten summarize prompt for recurring UK quality flags.',
                  ],
                },
              },
            },
          ],
        }),
  };

  writeFileSync(
    join(outDir, 'meta.json'),
    `${JSON.stringify(toContentSimArtifactMeta(report), null, 2)}\n`,
  );
  return report;
}
