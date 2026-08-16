/**
 * Weekly "Best of" digest → public Telegram channel.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/weekly-digest.ts [--dry-run]
 *
 * Compiles the last 7 days of PUBLISHED, human-approved items (already through
 * the editorial gate — no new content, safe to auto-post) and sends one digest
 * message to TELEGRAM_CHANNEL_ID. Recorded in `social_posts`.
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { logError, logEvent } from '../log';
import { sendMessage } from '../telegram';
import {
  citationUrlsFromUnknown,
  factCountFromUnknown,
  formatWeeklyDigest,
  selectEditorialDigestItems,
  weekLabelUk,
  type DigestCandidate,
} from '../weekly-digest';

const SITE_URL = 'https://aitodaybrief.com';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadPipelineConfig();
  const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!dryRun && (!config.telegramBotToken || !channelId)) {
    console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set');
    process.exit(1);
  }

  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id, date')
    .eq('status', 'published')
    .gte('date', sinceDate);
  if (bErr) throw new Error(`weekly-digest briefs: ${bErr.message}`);
  const briefById = new Map((briefs ?? []).map((b) => [b.id, b]));
  if (briefById.size === 0) {
    logEvent('info', 'publish', 'Weekly digest: nothing published this week — skipping');
    return;
  }

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select(
      'id,brief_id,article_id,canonical_item_id,slug,rank,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,impact_level,category_slug,citations,facts_en,facts_uk',
    )
    .eq('review_status', 'approved')
    .in('brief_id', [...briefById.keys()]);
  if (iErr) throw new Error(`weekly-digest items: ${iErr.message}`);
  const articleIds = [...new Set((items ?? []).map((item) => item.article_id))];
  const articleById = new Map<
    string,
    {
      id: string;
      source_name: string;
      url: string;
      composite_score: number | null;
      score_cross_source: number | null;
      score_breadth: number | null;
      score_version: number | null;
      cluster_id: string | null;
      mentions_count: number | null;
    }
  >();
  if (articleIds.length > 0) {
    const { data: articles, error: aErr } = await db
      .from('articles')
      .select(
        'id,source_name,url,composite_score,score_cross_source,score_breadth,score_version,cluster_id,mentions_count',
      )
      .in('id', articleIds);
    if (aErr) throw new Error(`weekly-digest articles: ${aErr.message}`);
    for (const article of articles ?? []) articleById.set(article.id, article);
  }

  const candidates: DigestCandidate[] = [];
  for (const it of items ?? []) {
    const brief = briefById.get(it.brief_id);
    const article = articleById.get(it.article_id);
    if (!brief || !it.slug || !it.title_en || !article) continue;
    candidates.push({
      id: it.id,
      articleId: it.article_id,
      canonicalItemId: it.canonical_item_id,
      title_uk: it.title_uk ?? it.title_en,
      title_en: it.title_en,
      summary_en: it.summary_en ?? '',
      summary_uk: it.summary_uk ?? '',
      why_matters_en: it.why_matters_en ?? '',
      why_matters_uk: it.why_matters_uk ?? '',
      impact_level: it.impact_level,
      category_slug: it.category_slug,
      itemSlug: it.slug,
      date: brief.date,
      rank: it.rank,
      citationUrls: citationUrlsFromUnknown(it.citations),
      factsEnCount: factCountFromUnknown(it.facts_en),
      factsUkCount: factCountFromUnknown(it.facts_uk),
      sourceName: article.source_name,
      sourceUrl: article.url,
      compositeScore: article.composite_score,
      crossSourceScore: article.score_cross_source,
      breadthScore: article.score_breadth,
      scoreVersion: article.score_version,
      clusterId: article.cluster_id,
      mentionsCount: article.mentions_count ?? 1,
    });
  }

  const selection = selectEditorialDigestItems(candidates);
  const selected = selection.selected.map(({ candidate }) => candidate);
  if (selected.length < 3) {
    logEvent('info', 'publish', 'Weekly digest: fewer than 3 items — skipping', {
      candidates: candidates.length,
    });
    return;
  }

  const text = formatWeeklyDigest(selected, {
    siteUrl: SITE_URL,
    weekLabel: weekLabelUk(new Date()),
  });

  if (dryRun) {
    console.log(
      [
        `Selection: ${selection.version}`,
        `Eligible: ${selection.eligible.length}/${candidates.length}`,
        ...selection.selected.map(
          ({ candidate, score, reasons }, index) =>
            `${index + 1}. ${score.toFixed(1)} · ${candidate.title_en} · ${reasons.join(', ') || 'passed gates'}`,
        ),
        '',
      ].join('\n'),
    );
    console.log(text);
    return;
  }

  const msgId = await sendMessage(config.telegramBotToken!, channelId!, text);
  if (msgId === null) throw new Error('weekly-digest: Telegram send failed');

  const { error: spErr } = await db.from('social_posts').insert({
    channel: 'telegram',
    status: 'posted',
    external_id: String(msgId),
    posted_at: new Date().toISOString(),
    meta: {
      kind: 'weekly_digest',
      items: selected.length,
      since: sinceDate,
      selection_version: selection.version,
      eligible_candidates: selection.eligible.length,
      rejected_candidates: selection.rejected.length,
    },
  });
  if (spErr) logError('publish', 'weekly-digest social_posts insert failed (non-fatal)', spErr);

  logEvent('info', 'publish', 'Weekly digest posted', {
    items: selected.length,
    message_id: msgId,
  });
}

main().catch((e) => {
  logError('publish', 'Weekly digest failed', e);
  process.exit(1);
});
