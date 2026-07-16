/**
 * Daily top-story repost → public Telegram channel + X.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/social-repost.ts [--dry-run] [--date YYYY-MM-DD]
 *
 * Picks the strongest PUBLISHED, human-approved item of the day (impact →
 * freshness → editor rank) and posts it once per channel:
 *   - Telegram: HTML card to TELEGRAM_CHANNEL_ID (skipped when unset);
 *   - X: native hook post + link in a self-reply (skipped when the four
 *     X_API_* secrets are unset). OAuth 1.0a user-context — app-owner tokens
 *     never expire, no refresh dance.
 * Every post lands in `social_posts` (meta.kind = 'top_story'), which is also
 * the idempotency guard: one top-story per channel per day, re-runs are no-ops.
 * Pure selection/formatting/signing lives in `pipeline/social-repost.ts`.
 */

/* v8 ignore start -- thin orchestration over live network + DB */
import { randomBytes } from 'node:crypto';
import { loadPipelineConfig } from '../config';
import { createServiceClient, type PipelineDb } from '../db';
import { logError, logEvent } from '../log';
import {
  buildOAuth1Header,
  formatTelegramPost,
  formatThreadsPost,
  formatXPost,
  selectTopStory,
  type OAuth1Credentials,
  type RepostCandidate,
} from '../social-repost';
import { sendMessage } from '../telegram';
import { publishThreadsText } from '../threads';

const SITE_URL = 'https://aitodaybrief.com';
const X_TWEETS_ENDPOINT = 'https://api.x.com/2/tweets';

function readXCredentials(env: Record<string, string | undefined>): OAuth1Credentials | null {
  const consumerKey = env.X_API_KEY?.trim();
  const consumerSecret = env.X_API_SECRET?.trim();
  const accessToken = env.X_ACCESS_TOKEN?.trim();
  const accessSecret = env.X_ACCESS_SECRET?.trim();
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) return null;
  return { consumerKey, consumerSecret, accessToken, accessSecret };
}

async function postTweet(
  creds: OAuth1Credentials,
  text: string,
  replyToId?: string,
): Promise<string> {
  const auth = buildOAuth1Header(
    'POST',
    X_TWEETS_ENDPOINT,
    creds,
    randomBytes(16).toString('hex'),
    String(Math.floor(Date.now() / 1000)),
  );
  const res = await fetch(X_TWEETS_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      ...(replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { id?: string } };
  const id = json.data?.id;
  if (!id) throw new Error('X API returned no tweet id');
  return id;
}

async function loadDayCandidates(db: PipelineDb, date: string): Promise<RepostCandidate[]> {
  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .eq('date', date);
  if (bErr) throw new Error(`social-repost briefs: ${bErr.message}`);
  const briefById = new Map((briefs ?? []).map((b) => [b.id, b]));
  if (briefById.size === 0) return [];

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select(
      'id, brief_id, slug, rank, title_en, title_uk, summary_en, summary_uk, social_hook_en, social_hook_uk, impact_level',
    )
    .eq('review_status', 'approved')
    .in('brief_id', [...briefById.keys()]);
  if (iErr) throw new Error(`social-repost items: ${iErr.message}`);

  const candidates: RepostCandidate[] = [];
  for (const it of items ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief?.slug || !it.slug || !it.title_en) continue;
    candidates.push({
      id: it.id,
      title_en: it.title_en,
      title_uk: it.title_uk ?? it.title_en,
      summary_en: it.summary_en ?? '',
      summary_uk: it.summary_uk ?? '',
      social_hook_en: it.social_hook_en,
      social_hook_uk: it.social_hook_uk,
      impact_level: it.impact_level,
      briefSlug: brief.slug,
      itemSlug: it.slug,
      date: brief.date,
      rank: it.rank,
    });
  }
  return candidates;
}

/** Channels that already carried a top-story today → hard skip (idempotency). */
async function postedChannelsToday(db: PipelineDb, date: string): Promise<Set<string>> {
  const { data, error } = await db
    .from('social_posts')
    .select('channel, meta, posted_at')
    .gte('posted_at', `${date}T00:00:00Z`)
    .lte('posted_at', `${date}T23:59:59Z`);
  if (error) throw new Error(`social-repost posted check: ${error.message}`);
  const channels = new Set<string>();
  for (const row of data ?? []) {
    const kind = (row.meta as { kind?: string } | null)?.kind;
    if (kind === 'top_story') channels.add(row.channel);
  }
  return channels;
}

async function recordPost(
  db: PipelineDb,
  channel: 'telegram' | 'threads' | 'x',
  item: RepostCandidate,
  externalId: string,
  url: string | null,
): Promise<void> {
  const { error } = await db.from('social_posts').insert({
    channel,
    brief_item_id: item.id,
    status: 'posted',
    external_id: externalId,
    url,
    posted_at: new Date().toISOString(),
    meta: { kind: 'top_story', date: item.date },
  });
  if (error) logError('publish', 'social-repost insert failed (non-fatal)', error, { channel });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const dateArg = process.argv.indexOf('--date');
  const date =
    dateArg >= 0 && process.argv[dateArg + 1]
      ? process.argv[dateArg + 1]!
      : new Date().toISOString().slice(0, 10);

  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  const xCreds = readXCredentials(process.env);

  const candidates = await loadDayCandidates(db, date);
  if (candidates.length === 0) {
    logEvent('info', 'publish', 'Social repost: nothing published for the date — skipping', {
      date,
    });
    return;
  }
  const top = selectTopStory(candidates);
  if (!top) return;

  const posted = dryRun ? new Set<string>() : await postedChannelsToday(db, date);

  if (dryRun) {
    console.log(`--- telegram\n${formatTelegramPost(top, SITE_URL)}\n`);
    console.log(`--- threads\n${formatThreadsPost(top, SITE_URL)}\n`);
    const x = formatXPost(top, SITE_URL);
    console.log(`--- x\n${x.text}\n↳ ${x.reply}`);
    return;
  }

  // Telegram channel
  if (!config.socialChannels.includes('telegram')) {
    logEvent('info', 'publish', 'Social repost: Telegram disabled by SOCIAL_CHANNELS');
  } else if (!config.telegramBotToken || !channelId) {
    logEvent('warn', 'publish', 'Social repost: Telegram channel not configured — skipped');
  } else if (posted.has('telegram')) {
    logEvent('info', 'publish', 'Social repost: Telegram already posted today — skipped');
  } else {
    const msgId = await sendMessage(
      config.telegramBotToken,
      channelId,
      formatTelegramPost(top, SITE_URL),
    );
    if (msgId === null) {
      logError('publish', 'Social repost: Telegram send failed', new Error('sendMessage null'));
    } else {
      await recordPost(db, 'telegram', top, String(msgId), null);
      logEvent('info', 'publish', 'Social repost: Telegram posted', { item: top.itemSlug, msgId });
    }
  }

  // Threads — opt-in only. A token on its own never starts a new public channel.
  if (!config.socialChannels.includes('threads')) {
    logEvent('info', 'publish', 'Social repost: Threads disabled by SOCIAL_CHANNELS');
  } else if (!config.threadsAccessToken) {
    logEvent('warn', 'publish', 'Social repost: Threads token not configured — skipped');
  } else if (posted.has('threads')) {
    logEvent('info', 'publish', 'Social repost: Threads already posted today — skipped');
  } else {
    try {
      const thread = await publishThreadsText({
        accessToken: config.threadsAccessToken,
        text: formatThreadsPost(top, SITE_URL),
      });
      await recordPost(db, 'threads', top, thread.id, null);
      logEvent('info', 'publish', 'Social repost: Threads posted', {
        item: top.itemSlug,
        thread_id: thread.id,
      });
    } catch (e) {
      logError('publish', 'Social repost: Threads post failed', e);
    }
  }

  // X
  if (!config.socialChannels.includes('x')) {
    logEvent('info', 'publish', 'Social repost: X disabled by SOCIAL_CHANNELS');
  } else if (!xCreds) {
    logEvent('warn', 'publish', 'Social repost: X credentials not set — skipped');
  } else if (posted.has('x')) {
    logEvent('info', 'publish', 'Social repost: X already posted today — skipped');
  } else {
    try {
      const x = formatXPost(top, SITE_URL);
      const tweetId = await postTweet(xCreds, x.text);
      // Link lives in the self-reply: dodges link-reach suppression and the
      // 13x pay-per-use surcharge on URL-bearing root posts.
      await postTweet(xCreds, x.reply, tweetId);
      await recordPost(db, 'x', top, tweetId, `https://x.com/i/web/status/${tweetId}`);
      logEvent('info', 'publish', 'Social repost: X posted', { item: top.itemSlug, tweetId });
    } catch (e) {
      logError('publish', 'Social repost: X post failed', e);
    }
  }
}

main().catch((e) => {
  logError('publish', 'Social repost failed', e);
  process.exit(1);
});
/* v8 ignore end */
