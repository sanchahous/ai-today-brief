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
  formatWeeklyDigest,
  selectDigestItems,
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
    .select('id, slug, date')
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
    .select('brief_id, slug, rank, title_en, title_uk, summary_uk, impact_level, category_slug')
    .eq('review_status', 'approved')
    .in('brief_id', [...briefById.keys()]);
  if (iErr) throw new Error(`weekly-digest items: ${iErr.message}`);

  const candidates: DigestCandidate[] = [];
  for (const it of items ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief?.slug || !it.slug || !it.title_en) continue;
    candidates.push({
      title_uk: it.title_uk ?? it.title_en,
      title_en: it.title_en,
      summary_uk: it.summary_uk ?? '',
      impact_level: it.impact_level,
      category_slug: it.category_slug,
      briefSlug: brief.slug,
      itemSlug: it.slug,
      date: brief.date,
      rank: it.rank,
    });
  }

  const selected = selectDigestItems(candidates);
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
    meta: { kind: 'weekly_digest', items: selected.length, since: sinceDate },
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
