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
  /** Minimum composite rank score (0..1) to enter the pool. */
  minScore: number;
  /** How many recently-published item titles to show the editor for dedup. */
  recentTitles: number;
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
    perTopicCap: intIn(env.PER_TOPIC_CAP, 2, 1, 5),
    minScore: floatIn(env.MIN_SCORE, 0.15, 0, 1),
    recentTitles: intIn(env.RECENT_TITLES, 60, 0, 200),
    dryRun: argv.includes('--dry-run') || env.DRY_RUN === '1',
  };
}
