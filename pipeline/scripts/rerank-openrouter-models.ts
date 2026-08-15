/**
 * Daily OpenRouter quality/$ rerank. Fetches the catalog once, writes one
 * audit row per role, and replaces llm_provider_models for `openrouter` only
 * when weekly.master_writer does not drop quality.
 *
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/rerank-openrouter-models.ts [--dry-run]
 *
 * Requires migration 20260815160000. Pure plan lives in model-rerank.ts.
 */

/* v8 ignore start -- network IO + DB writes */
import { createServiceClient, type PipelineDb } from '../db';
import { logError, logEvent } from '../log';
import { fetchOpenRouterModels } from '../openrouter-models';
import { OPENROUTER_HTTP_DEFAULTS } from '../providers/http-provider';
import {
  OPENROUTER_PROVIDER_ID,
  RANK_APPLY_ROLE,
  planOpenRouterRerank,
  type CurrentApplyPick,
  type RoleRankAudit,
} from '../providers/model-rerank';

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

function resolveOpenRouterKey(env: Record<string, string | undefined>): string | undefined {
  return firstNonEmpty(env.OPEN_ROUTER_API_KEY, env.OPENROUTER_API_KEY);
}

async function loadCurrentApply(db: PipelineDb): Promise<CurrentApplyPick | null> {
  const { data, error } = await db
    .from('llm_model_rank_audit')
    .select('model_id, quality_index')
    .eq('role', RANK_APPLY_ROLE)
    .eq('applied', true)
    .order('ranked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.model_id) return null;
  return { modelId: data.model_id, qualityIndex: data.quality_index };
}

async function ensureOpenRouterProvider(db: PipelineDb): Promise<void> {
  const { data, error } = await db
    .from('llm_providers')
    .select('id')
    .eq('id', OPENROUTER_PROVIDER_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { error: insertError } = await db.from('llm_providers').insert({
    id: OPENROUTER_PROVIDER_ID,
    kind: 'http',
    enabled: true,
    base_url: OPENROUTER_HTTP_DEFAULTS.baseUrl,
    extra_headers: { ...OPENROUTER_HTTP_DEFAULTS.extraHeaders },
    reports_cost: OPENROUTER_HTTP_DEFAULTS.reportsCost,
    notes: 'Inserted by the daily OpenRouter rerank job. API key stays in env, not Vault.',
  });
  if (insertError) throw new Error(insertError.message);
}

async function persistAudits(db: PipelineDb, audits: RoleRankAudit[]): Promise<void> {
  const { error } = await db.from('llm_model_rank_audit').insert(
    audits.map((row) => ({
      role: row.role,
      model_id: row.modelId,
      score: row.score,
      price_per_m: row.pricePerM,
      quality_index: row.qualityIndex,
      axis: row.axis,
      applied: row.applied,
      skip_reason: row.skipReason,
      previous_model_id: row.previousModelId,
      previous_quality_index: row.previousQualityIndex,
    })),
  );
  if (error) throw new Error(error.message);
}

async function applyOpenRouterQueue(db: PipelineDb, modelIds: string[]): Promise<void> {
  await ensureOpenRouterProvider(db);
  const { error } = await db.rpc('replace_llm_provider_models', {
    p_provider_id: OPENROUTER_PROVIDER_ID,
    p_model_ids: modelIds,
  });
  if (error) throw new Error(error.message);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const env = process.env;
  const supabaseUrl = resolveSupabaseUrl(env);
  const supabaseServiceKey = resolveServiceKey(env);
  const openRouterKey = resolveOpenRouterKey(env);
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[rerank] Missing SCRAPPER_BASE_URL / SCRAPPER_SERVICE_KEY');
  }
  if (!openRouterKey) {
    throw new Error('[rerank] Missing OPEN_ROUTER_API_KEY');
  }

  const db = createServiceClient(supabaseUrl, supabaseServiceKey);
  const catalog = await fetchOpenRouterModels(openRouterKey);
  const currentApply = await loadCurrentApply(db);
  const plan = planOpenRouterRerank({ catalog, currentApply });
  const writer = plan.audits.find((row) => row.role === RANK_APPLY_ROLE);

  logEvent('info', 'rank', 'OpenRouter model rerank planned', {
    catalog_size: catalog.length,
    apply: plan.apply,
    skip_reason: writer?.skipReason ?? null,
    winner: writer?.modelId ?? null,
    quality_index: writer?.qualityIndex ?? null,
    score: writer?.score ?? null,
    price_per_m: writer?.pricePerM ?? null,
    queue: plan.openRouterModelIds,
    dry_run: dryRun,
  });

  if (dryRun) return;

  await persistAudits(db, plan.audits);
  if (plan.apply) {
    await applyOpenRouterQueue(db, plan.openRouterModelIds);
  }
}

main().catch((error) => {
  logError('rank', 'OpenRouter model rerank failed', error);
  process.exit(1);
});
/* v8 ignore end */
