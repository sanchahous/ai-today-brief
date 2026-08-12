import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  VISUAL_GLYPHS,
  VISUAL_OUTCOME_SIGNALS,
  VISUAL_RELATIONS,
  compileAutoVisualClaim,
  parseAutoVisualClaim,
  validateAutoVisualClaim,
  visualClaimExtractionPrompt,
  type AutoVisualClaim,
  type HoldoutStoryInput,
} from '../src/lib/weekly-digest/visual-auto-claim';
import { validateVisualPlan, type VisualPlan } from '../src/lib/weekly-digest/visual-compiler';
import { decideVisualRenderPolicy } from '../src/lib/weekly-digest/visual-render-policy';

const DATA_PATH =
  process.env.VISUAL_HOLDOUT_DATA?.trim() ||
  'experiments/visual-compiler/holdout/holdout-stories.json';
const OUT_DIR =
  process.env.VISUAL_HOLDOUT_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_HOLDOUT_EXTRACT_MODEL?.trim() || 'google/gemini-2.5-flash';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}

interface ExtractionBatchResult {
  weekStart: string;
  model: string;
  mode: 'batch' | 'per_story_fallback';
  attempts: number;
  usage: NonNullable<OpenRouterResponse['usage']>;
  rawClaims: unknown[];
}

interface HoldoutPlanRecord {
  weekStart: string;
  weekEnd: string;
  rank: number;
  headline: string;
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaim;
  plan: VisualPlan;
  renderPolicy: ReturnType<typeof decideVisualRenderPolicy>;
  issues: string[];
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function emptyUsage(): NonNullable<OpenRouterResponse['usage']> {
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 };
}

function addUsage(
  left: NonNullable<OpenRouterResponse['usage']>,
  right: OpenRouterResponse['usage'],
): NonNullable<OpenRouterResponse['usage']> {
  return {
    prompt_tokens: (left.prompt_tokens ?? 0) + (right?.prompt_tokens ?? 0),
    completion_tokens: (left.completion_tokens ?? 0) + (right?.completion_tokens ?? 0),
    total_tokens: (left.total_tokens ?? 0) + (right?.total_tokens ?? 0),
    cost: (left.cost ?? 0) + (right?.cost ?? 0),
  };
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return typeof content === 'string' ? content : '';
}

function parseJson(text: string): Record<string, unknown> {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error(`Invalid extraction JSON: ${clean.slice(0, 500)}`);
  }
}

function extractionPrompt(stories: readonly HoldoutStoryInput[]): string {
  const template = {
    claims: [
      {
        story_id: 'copy an input story_id exactly',
        identity: 'visible subject or system anchor',
        change: 'one factual change',
        mechanism: 'one visible causal process',
        primary_outcome: 'one visible grounded result',
        core_claim: 'one cause-to-effect proposition',
        primary_evidence: 'physical_action',
        outcome_kind: 'benefit',
        labels: ['MAX THREE SHORT LABELS'],
        quantitative_facts: [{ label: 'EXACT FACT LABEL', value: 'EXACT SOURCE VALUE' }],
        states: [],
        comparison: null,
        layers: [],
        routing: null,
        forbidden_contradictions: ['one concrete visual contradiction to avoid'],
        grammar: {
          context_glyph: 'model_chip',
          mechanism_glyph: 'workflow',
          outcome_glyph: 'checkmark',
          branch_glyphs: null,
          relation: 'flow',
          outcome_signal: 'success',
          human_behavior: false,
        },
      },
    ],
  };
  return [
    visualClaimExtractionPrompt(stories),
    '',
    'JSON MODE CONTRACT: return one object with a claims array and every key shown below for every story.',
    'Use null for comparison, routing, and branch_glyphs when not applicable. Use [] for non-applicable arrays.',
    `Allowed primary_evidence: physical_action, temporal_change, architecture_change, counterfactual_comparison, quantitative_difference, task_routing.`,
    `Allowed outcome_kind: benefit, harm, tradeoff, uncertainty.`,
    `Allowed glyphs: ${VISUAL_GLYPHS.join(', ')}.`,
    `Allowed relations: ${VISUAL_RELATIONS.join(', ')}.`,
    `Allowed outcome signals: ${VISUAL_OUTCOME_SIGNALS.join(', ')}.`,
    'For routing, use {"source":"...","branches":[{"label":"...","destination":"...","visibleOutcome":"..."},{...}]}.',
    'For comparison, use {"left":"...","right":"..."}.',
    'Do not add markdown or commentary.',
    `OUTPUT_TEMPLATE=${JSON.stringify(template)}`,
  ].join('\n');
}

function verifyClaimSet(rawClaims: unknown[], stories: readonly HoldoutStoryInput[]) {
  const expected = new Set(stories.map((story) => story.revision_item_id));
  const received = new Set<string>();
  for (const raw of rawClaims) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = (raw as Record<string, unknown>).story_id;
    if (typeof id === 'string') received.add(id);
  }
  const missing = [...expected].filter((id) => !received.has(id));
  const unexpected = [...received].filter((id) => !expected.has(id));
  if (rawClaims.length !== stories.length || missing.length || unexpected.length) {
    throw new Error(
      `Claim set mismatch: expected=${stories.length}, received=${rawClaims.length}, missing=${missing.join(',') || 'none'}, unexpected=${unexpected.join(',') || 'none'}.`,
    );
  }
}

async function callExtractor(
  stories: HoldoutStoryInput[],
  maxAttempts: number,
): Promise<{ attempts: number; usage: NonNullable<OpenRouterResponse['usage']>; rawClaims: unknown[] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief unseen visual holdout extraction',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: extractionPrompt(stories) }],
          temperature: 0,
          max_tokens: stories.length === 1 ? 2_500 : 12_000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      const parsed = parseJson(responseText(payload));
      const rawClaims = Array.isArray(parsed.claims) ? parsed.claims : [];
      verifyClaimSet(rawClaims, stories);
      return { attempts: attempt, usage: payload.usage ?? emptyUsage(), rawClaims };
    } catch (error) {
      lastError = error;
      console.warn(
        `[holdout-extract] ${stories[0]?.week_start}/${stories.length} attempt ${attempt} failed`,
        error,
      );
      await sleep(attempt * 1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function extractBatch(stories: HoldoutStoryInput[]): Promise<ExtractionBatchResult> {
  try {
    const batch = await callExtractor(stories, 3);
    return {
      weekStart: stories[0]?.week_start ?? 'unknown',
      model: MODEL,
      mode: 'batch',
      ...batch,
    };
  } catch (batchError) {
    console.warn('[holdout-extract] batch failed; falling back to one story per request', batchError);
    const rawClaims: unknown[] = [];
    let usage = emptyUsage();
    let attempts = 3;
    for (const story of stories) {
      const single = await callExtractor([story], 3);
      rawClaims.push(...single.rawClaims);
      usage = addUsage(usage, single.usage);
      attempts += single.attempts;
    }
    verifyClaimSet(rawClaims, stories);
    return {
      weekStart: stories[0]?.week_start ?? 'unknown',
      model: MODEL,
      mode: 'per_story_fallback',
      attempts,
      usage,
      rawClaims,
    };
  }
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function report(records: HoldoutPlanRecord[], batches: ExtractionBatchResult[]): string {
  const valid = records.filter((record) => record.issues.length === 0).length;
  const formats = new Map<string, number>();
  const renderModes = new Map<string, number>();
  for (const record of records) {
    formats.set(record.plan.format, (formats.get(record.plan.format) ?? 0) + 1);
    renderModes.set(
      record.renderPolicy.mode,
      (renderModes.get(record.renderPolicy.mode) ?? 0) + 1,
    );
  }
  const promptTokens = batches.reduce(
    (sum, batch) => sum + (batch.usage.prompt_tokens ?? 0),
    0,
  );
  const completionTokens = batches.reduce(
    (sum, batch) => sum + (batch.usage.completion_tokens ?? 0),
    0,
  );
  const reportedCost = batches.reduce((sum, batch) => sum + (batch.usage.cost ?? 0), 0);
  const lines = [
    '# Unseen multi-digest VisualClaim extraction',
    '',
    `Stories: **${records.length}** across **${batches.length}** previous digests.`,
    `Valid compiled plans: **${valid}/${records.length}**.`,
    `Extractor: \`${MODEL}\`.`,
    `Reported extraction usage: ${promptTokens} prompt + ${completionTokens} completion tokens; cost $${reportedCost.toFixed(4)}.`,
    '',
    'No story-specific VisualClaim, format, glyph, label, or contradiction rule was supplied for these stories.',
    '',
    '| Week | # | Story | Evidence | Format | Render mode | Labels | Warnings / issues |',
    '|---|---:|---|---|---|---|---|---|',
  ];
  for (const record of records) {
    lines.push(
      `| ${record.weekStart} | ${record.rank} | ${markdownEscape(record.headline)} | \`${
        record.autoClaim.claim.primaryEvidence
      }\` | \`${record.plan.format}\` | \`${record.renderPolicy.mode}\` | ${markdownEscape(
        record.plan.overlays.map((overlay) => overlay.text).join(' · ') || 'none',
      )} | ${markdownEscape(
        [...record.autoClaim.extractionWarnings, ...record.issues].join(', ') || 'none',
      )} |`,
    );
  }
  lines.push('', '## Format distribution', '');
  for (const [format, count] of [...formats].sort()) lines.push(`- \`${format}\`: ${count}`);
  lines.push('', '## Render-mode distribution', '');
  for (const [mode, count] of [...renderModes].sort()) lines.push(`- \`${mode}\`: ${count}`);
  lines.push('', '## Batch diagnostics', '');
  for (const batch of batches) {
    lines.push(
      `- ${batch.weekStart}: ${batch.mode}, ${batch.attempts} total attempt(s), ${batch.usage.total_tokens ?? 'unknown'} tokens.`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  assertEnvironment();
  const stories = JSON.parse(await readFile(DATA_PATH, 'utf8')) as HoldoutStoryInput[];
  if (stories.length !== 21) {
    throw new Error(`Expected 21 unseen stories; received ${stories.length}.`);
  }
  const groups = new Map<string, HoldoutStoryInput[]>();
  for (const story of stories) {
    const group = groups.get(story.week_start) ?? [];
    group.push(story);
    groups.set(story.week_start, group);
  }
  for (const group of groups.values()) group.sort((a, b) => a.rank - b.rank);
  const batches: ExtractionBatchResult[] = [];
  for (const [weekStart, group] of [...groups].sort(([a], [b]) => b.localeCompare(a))) {
    console.log(`[holdout-extract] ${weekStart}: ${group.length} stories`);
    batches.push(await extractBatch(group));
    await writeFile(join(OUT_DIR, 'partial-batches.json'), `${JSON.stringify(batches, null, 2)}\n`);
  }

  const rawById = new Map<string, unknown>();
  for (const batch of batches) {
    for (const raw of batch.rawClaims) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const storyId = (raw as Record<string, unknown>).story_id;
      if (typeof storyId === 'string' && !rawById.has(storyId)) rawById.set(storyId, raw);
    }
  }

  const records: HoldoutPlanRecord[] = stories.map((story) => {
    const autoClaim = parseAutoVisualClaim(rawById.get(story.revision_item_id) ?? {}, story);
    const plan = compileAutoVisualClaim(autoClaim);
    const issues = [...validateAutoVisualClaim(autoClaim), ...validateVisualPlan(plan)];
    return {
      weekStart: story.week_start,
      weekEnd: story.week_end,
      rank: story.rank,
      headline: story.title,
      story,
      autoClaim,
      plan,
      renderPolicy: decideVisualRenderPolicy(plan),
      issues,
    };
  });

  const invalid = records.filter((record) => record.issues.length > 0);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid holdout plans: ${invalid
        .map((record) => `${record.story.revision_item_id}:${record.issues.join(',')}`)
        .join(' | ')}`,
    );
  }

  await Promise.all([
    writeFile(join(OUT_DIR, 'extracted-claims.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'extraction-batches.json'), `${JSON.stringify(batches, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'extraction-report.md'), report(records, batches)),
  ]);
  console.log(report(records, batches));
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'extraction-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
