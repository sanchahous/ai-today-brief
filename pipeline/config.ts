/**
 * Pipeline runtime config, read once from the environment.
 *
 * The pipeline holds the Supabase **service role** key (bypasses RLS) and the
 * Gemini key. Env-var names mirror `src/lib/supabase.ts` so one `.env.local`
 * serves both the app and the pipeline. Never `NEXT_PUBLIC_` the service key;
 * this module is never imported from `src/`.
 */

export interface PipelineConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  geminiApiKey: string;
  /** Max items the editor may keep in one brief (schema caps `rank` at 10). */
  maxItems: number;
  /** Candidate pool size handed to the editor after deterministic filters. */
  poolSize: number;
  /** Max pooled candidates sharing one fine-grained topic. */
  perTopicCap: number;
  /** Max zero-engagement single-source non-first-party entries in the pool. */
  maxColdSingletons: number;
  /** Minimum composite rank score (0..1) to enter the pool. */
  minScore: number;
  /** How many recently-published item titles to show the editor for dedup. */
  recentTitles: number;
  /** Max pool candidates to embed per run (keeps us under the Gemini quota). */
  embedLimit: number;
  /** Top pool candidates whose source pages are fetched for the summarizer (0 disables). */
  enrichLimit: number;
  /** Run the post-summarize fact-check pass against fetched source texts. */
  verifyClaims: boolean;
  /** Cosine distance ceiling: candidates closer than this to a published item are dropped. */
  maxEmbedDistance: number;
  /**
   * OpenRouter API key (optional — OpenRouter fallback is skipped when unset).
   * Reads OPEN_ROUTER_API_KEY or OPENROUTER_API_KEY from env.
   */
  openRouterApiKey?: string;
  /** Cloudflare account id + Workers AI token for card-image generation (optional). */
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  /** Bot token for pushing review cards (optional — notify is skipped if unset). */
  telegramBotToken?: string;
  /** Private chat id that receives the per-item review cards (optional). */
  telegramReviewChatId?: string;
  /** Stop before any Supabase write — assemble + print only. */
  dryRun: boolean;
}

function firstNonEmpty(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

function resolveSupabaseUrl(env: Record<string, string | undefined>): string | undefined {
  return firstNonEmpty(env.SCRAPPER_BASE_URL, env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL);
}

function resolveServiceKey(env: Record<string, string | undefined>): string | undefined {
  return firstNonEmpty(
    env.SCRAPPER_SERVICE_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.SUPABASE_SERVICE_KEY,
  );
}

function intIn(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function floatIn(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function loadPipelineConfig(
  env: Record<string, string | undefined> = process.env,
  argv: string[] = process.argv,
): PipelineConfig {
  const supabaseUrl = resolveSupabaseUrl(env);
  const supabaseServiceKey = resolveServiceKey(env);
  const geminiApiKey = env.GEMINI_API_KEY?.trim();

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SCRAPPER_BASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
  if (!supabaseServiceKey) missing.push('SCRAPPER_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  if (!geminiApiKey) missing.push('GEMINI_API_KEY');
  if (missing.length > 0) {
    throw new Error(`[config] Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl: supabaseUrl!,
    supabaseServiceKey: supabaseServiceKey!,
    geminiApiKey: geminiApiKey!,
    maxItems: intIn(env.MAX_ITEMS, 8, 1, 10),
    poolSize: intIn(env.POOL_SIZE, 16, 4, 40),
    // 3 (not 2): agents/mcp/optimisation are the reader's CORE topics, and a cap
    // of 2 starved the pool — only ~8 of ~26 ranked clusters reached the editor
    // while 15+ genuinely practical items aged out unpublished. 3 widens the pool
    // without letting any single product wall it.
    perTopicCap: intIn(env.PER_TOPIC_CAP, 3, 1, 5),
    // Practical tools/optimisations from GitHub etc. ARE cold singletons (zero
    // engagement, single source); the rank-stage genre demotion keeps RSS
    // business-churn out, so give the usable singletons real room — 12, because
    // on a busy dev day there are well more than 8 distinct tools worth shipping.
    maxColdSingletons: intIn(env.MAX_COLD_SINGLETONS, 12, 0, 40),
    minScore: floatIn(env.MIN_SCORE, 0.15, 0, 1),
    recentTitles: intIn(env.RECENT_TITLES, 60, 0, 200),
    embedLimit: intIn(env.EMBED_LIMIT, 20, 1, 50),
    enrichLimit: intIn(env.ENRICH_LIMIT, 8, 0, 16),
    verifyClaims: env.VERIFY_CLAIMS !== '0',
    maxEmbedDistance: floatIn(env.MAX_EMBED_DISTANCE, 0.20, 0.05, 1),
    openRouterApiKey: firstNonEmpty(env.OPEN_ROUTER_API_KEY, env.OPENROUTER_API_KEY),
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN?.trim() || undefined,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
    telegramReviewChatId: env.TELEGRAM_REVIEW_CHAT_ID?.trim() || undefined,
    dryRun: argv.includes('--dry-run') || env.DRY_RUN === '1',
  };
}
