/**
 * One-time backfill of per-article ranking telemetry (the migration-032 columns).
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-scores.ts [--limit N] [--dry-run]
 *
 * Re-scores every stored article with the CURRENT rank.ts formula and writes the
 * six components + composite + score_version + cluster_id + scored_as_of. This is
 * how score-telemetry coverage jumps from ~8% to ~100% without waiting weeks of
 * forward runs (the method is proven in docs/TREND-ENGINE-BACKTEST-FINDINGS.md).
 *
 * recency/velocity are computed AS-OF the corpus's freshest fetched_at, NOT now() —
 * otherwise every old row collapses to recency ≈ 0. Idempotent: re-runs overwrite
 * the same columns and never touch title/raw/etc. Pure scoring lives in rank.ts;
 * this runner only pages, maps, scores and writes.
 *
 * Requires migration 032 applied first (the columns must exist).
 */

/* v8 ignore start -- thin orchestration over the live DB */
import { loadPipelineConfig } from '../config';
import {
  articleScoreColumns,
  createServiceClient,
  type ArticleScores,
  type PipelineDb,
} from '../db';
import { logError, logEvent } from '../log';
import { rankCandidates, SCORE_VERSION, type Candidate } from '../rank';

const PAGE = 1000;

interface ArticleRow {
  id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string | null;
  fetched_at: string | null;
  hn_score: number | null;
  hn_comments: number | null;
  reddit_score: number | null;
  reddit_comments: number | null;
  inbrief_score: number | null;
  mentions_count: number | null;
}

const SELECT_COLS =
  'id, title, url, source_name, published_at, fetched_at, hn_score, hn_comments, reddit_score, reddit_comments, inbrief_score, mentions_count';

async function loadAllArticles(db: PipelineDb, limit: number): Promise<ArticleRow[]> {
  const rows: ArticleRow[] = [];
  for (let offset = 0; offset < limit; offset += PAGE) {
    const end = Math.min(offset + PAGE, limit) - 1;
    const { data, error } = await db.from('articles').select(SELECT_COLS).order('id').range(offset, end);
    if (error) throw new Error(`load articles: ${error.message}`);
    const batch = (data ?? []) as unknown as ArticleRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function toCandidate(r: ArticleRow): Candidate {
  return {
    id: r.url,
    title: r.title,
    url: r.url,
    source_name: r.source_name,
    published_at: r.published_at ?? new Date(0).toISOString(),
    hn_score: r.hn_score,
    hn_comments: r.hn_comments,
    reddit_score: r.reddit_score,
    reddit_comments: r.reddit_comments,
    inbrief_score: r.inbrief_score,
    mentions_count: r.mentions_count ?? 1,
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 100_000 : 100_000;

  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const articles = await loadAllArticles(db, limit);
  if (articles.length === 0) {
    logEvent('info', 'rank', 'Backfill: no articles found');
    return;
  }

  // As-of the corpus's freshest fetch, so recency/velocity are not uniformly ~0.
  const asOfMs =
    articles.reduce((mx, a) => {
      const ts = a.fetched_at ? Date.parse(a.fetched_at) : NaN;
      return Number.isNaN(ts) ? mx : Math.max(mx, ts);
    }, 0) || Date.now();
  const scoredAsOf = new Date(asOfMs).toISOString();

  const ranking = rankCandidates(articles.map(toCandidate), 0, asOfMs);
  const scoresByUrl: ArticleScores = new Map();
  for (const e of ranking.scored) {
    for (const url of e.memberUrls) {
      scoresByUrl.set(url, {
        score: e.score,
        mentions: e.mentions,
        components: e.components,
        clusterId: e.clusterId,
        version: SCORE_VERSION,
        scoredAsOf,
      });
    }
  }

  const scores = [...scoresByUrl.values()].map((s) => s.score);
  const covered = articles.filter((a) => scoresByUrl.has(a.url)).length;
  logEvent('info', 'rank', 'Backfill scored', {
    articles: articles.length,
    covered,
    coverage: Number((covered / articles.length).toFixed(4)),
    score_min: scores.length ? Math.min(...scores) : null,
    score_max: scores.length ? Math.max(...scores) : null,
    as_of: scoredAsOf,
    dry_run: dryRun,
  });

  if (dryRun) {
    logEvent('info', 'rank', 'Dry run — no writes');
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const a of articles) {
    const s = scoresByUrl.get(a.url);
    if (!s) continue;
    // Update only the telemetry columns. Cast through unknown: the 032 columns
    // are not in the generated Database type until it is regenerated post-migration.
    const updater = db.from('articles') as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await updater.update(articleScoreColumns(s)).eq('id', a.id);
    if (error) {
      failed++;
      logError('rank', 'Backfill update failed', error, { id: a.id });
    } else {
      updated++;
    }
  }

  logEvent('info', 'rank', 'Backfill complete', { updated, failed, dry_run: dryRun });
}

main().catch((e) => {
  logError('rank', 'Score backfill failed', e);
  process.exit(1);
});
/* v8 ignore end */
