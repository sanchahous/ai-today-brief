import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  compileAutoVisualClaimV5,
  parseAutoVisualClaimV5,
  selectVisualRenderModeV5,
  validateAutoVisualClaimV5,
  visualClaimV5ExtractionPrompt,
  type AutoVisualClaimV5,
} from '../src/lib/weekly-digest/visual-auto-claim-v5';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import { validateVisualPlan, type VisualPlan } from '../src/lib/weekly-digest/visual-compiler';

const DATA_PATH =
  process.env.VISUAL_V5_HOLDOUT_DATA?.trim() ||
  'experiments/visual-compiler-v5/fresh-holdout/stories.json';
const OUT_DIR =
  process.env.VISUAL_V5_OUT_DIR?.trim() || 'artifacts/visual-compiler-v5-fresh';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const EXTRACT_MODEL =
  process.env.VISUAL_V5_EXTRACT_MODEL?.trim() || 'google/gemini-2.5-flash';
const AUDIT_MODEL =
  process.env.VISUAL_V5_AUDIT_MODEL?.trim() || 'google/gemini-2.5-flash';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}

interface UsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

interface ClaimAudit {
  storyId: string;
  roleSupported: boolean;
  claimSupported: boolean;
  visualDriverSupported: boolean;
  outcomeSupported: boolean;
  certaintyPreserved: boolean;
  metricExact: boolean;
  comparisonTargetPreserved: boolean;
  noInventedMechanism: boolean;
  oneCoreClaim: boolean;
  visuallyTestable: boolean;
  passed: boolean;
  issues: string[];
  repairInstruction: string;
  rationale: string;
}

interface V5ClaimRecord {
  story: HoldoutStoryInput;
  initialRaw: unknown;
  finalRaw: unknown;
  autoClaim: AutoVisualClaimV5;
  plan: VisualPlan;
  renderMode: ReturnType<typeof selectVisualRenderModeV5>;
  initialAudit: ClaimAudit;
  finalAudit: ClaimAudit;
  deterministicIssues: string[];
  repaired: boolean;
  eligible: boolean;
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function emptyUsage(): UsageTotals {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, calls: 0 };
}

function addUsage(total: UsageTotals, usage: OpenRouterResponse['usage']) {
  total.promptTokens += usage?.prompt_tokens ?? 0;
  total.completionTokens += usage?.completion_tokens ?? 0;
  total.totalTokens += usage?.total_tokens ?? 0;
  total.costUsd += usage?.cost ?? 0;
  total.calls += 1;
}

function sleep(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return typeof content === 'string' ? content : '';
}

function parseJson<T>(value: string): T {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as T;
    throw new Error(`Invalid JSON response: ${clean.slice(0, 600)}`);
  }
}

async function callModel<T>(input: {
  model: string;
  title: string;
  prompt: string;
  maxTokens: number;
  usage: UsageTotals;
}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': input.title,
        },
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: 'user', content: input.prompt }],
          temperature: 0,
          max_tokens: input.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      addUsage(input.usage, payload.usage);
      const text = responseText(payload);
      if (!text) throw new Error('Model returned no content.');
      return parseJson<T>(text);
    } catch (error) {
      lastError = error;
      console.warn(`[v5-model] ${input.title} attempt ${attempt} failed`, error);
      await sleep(attempt * 1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function bool(value: unknown): boolean {
  return value === true;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function sourcePayload(story: HoldoutStoryInput) {
  return {
    story_id: story.revision_item_id,
    headline: story.title,
    summary: story.summary,
    why: story.why,
    practical: story.practical,
    takeaway: story.takeaway,
  };
}

function uuidCharacterDistance(left: string, right: string): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

function verifyRawClaimSet(rawClaims: unknown[], stories: HoldoutStoryInput[]) {
  const expected = new Set(stories.map((story) => story.revision_item_id));
  const received = new Set<string>();
  for (const value of rawClaims) {
    const id = clean(record(value).story_id, 100);
    if (id) received.add(id);
  }
  const missing = [...expected].filter((id) => !received.has(id));
  const unexpected = [...received].filter((id) => !expected.has(id));
  if (rawClaims.length !== stories.length || missing.length || unexpected.length) {
    throw new Error(
      `VisualClaim set mismatch: expected=${stories.length}, received=${rawClaims.length}, missing=${missing.join(',') || 'none'}, unexpected=${unexpected.join(',') || 'none'}.`,
    );
  }
}

function canonicalizeRawClaimSet(
  rawClaims: unknown[],
  stories: HoldoutStoryInput[],
): unknown[] {
  const expectedIds = stories.map((story) => story.revision_item_id);
  const expected = new Set(expectedIds);
  const exactIds = new Set(
    rawClaims
      .map((value) => clean(record(value).story_id, 100))
      .filter((id) => expected.has(id)),
  );
  const missingIds = expectedIds.filter((id) => !exactIds.has(id));
  const unexpectedRows = rawClaims
    .map((value, index) => ({
      value,
      index,
      id: clean(record(value).story_id, 100),
    }))
    .filter((row) => row.id && !expected.has(row.id));
  const mapping = new Map<number, string>();
  const usedExpectedIds = new Set<string>();

  for (const row of unexpectedRows) {
    const candidates = missingIds.filter(
      (candidate) =>
        !usedExpectedIds.has(candidate) &&
        uuidCharacterDistance(row.id, candidate) <= 2,
    );
    if (candidates.length !== 1) continue;
    const candidate = candidates[0]!;
    const competingRows = unexpectedRows.filter(
      (other) =>
        !mapping.has(other.index) &&
        uuidCharacterDistance(other.id, candidate) <= 2,
    );
    if (competingRows.length !== 1) continue;
    mapping.set(row.index, candidate);
    usedExpectedIds.add(candidate);
  }

  const normalized = rawClaims.map((value, index) => {
    const canonicalId = mapping.get(index);
    if (!canonicalId) return value;
    const suppliedId = clean(record(value).story_id, 100);
    console.warn(
      `[v5-extract] canonicalized near-match story_id ${suppliedId} -> ${canonicalId}`,
    );
    return { ...record(value), story_id: canonicalId };
  });
  verifyRawClaimSet(normalized, stories);
  return normalized;
}

async function extractBatch(stories: HoldoutStoryInput[], usage: UsageTotals): Promise<unknown[]> {
  const response = await callModel<{ claims?: unknown }>({
    model: EXTRACT_MODEL,
    title: 'AI Today Brief VisualClaim v5 fresh holdout extraction',
    prompt: visualClaimV5ExtractionPrompt(stories),
    maxTokens: 12_000,
    usage,
  });
  const rawClaims = Array.isArray(response.claims) ? response.claims : [];
  return canonicalizeRawClaimSet(rawClaims, stories);
}

function auditPrompt(
  rows: Array<{ story: HoldoutStoryInput; raw: unknown; claim: AutoVisualClaimV5 }>,
): string {
  return [
    'You are the independent source-fidelity gate for AI Today Brief VisualClaim v5.',
    'The original approved story is the only ground truth. Audit each claim without rewarding persuasive wording.',
    '',
    'Role-aware rules:',
    '- causal_mechanism: visual_driver must be an explicit causal process in the source;',
    '- quantitative_result: visual_driver is the measured baseline/result comparison; do not demand or invent a cause;',
    '- benchmark_comparison: the benchmark/evaluation is comparison context, not a cause; preserve the named target;',
    '- capability_access: the release/access path and resulting bounded capability must be supported;',
    '- policy_control: the external policy boundary must visibly allow or block before execution;',
    '- architecture_transformation: the stated layers or stages must be supported;',
    '- state_transition: all states and required visible delta must be source-grounded;',
    '- uncertainty_announcement: planned/expected/reported/claimed language must remain explicit and no current availability may be implied.',
    '',
    'Evaluate: role_supported, claim_supported, visual_driver_supported, outcome_supported, certainty_preserved, metric_exact, comparison_target_preserved, no_invented_mechanism, one_core_claim, visually_testable.',
    'metric_exact is true when there is no metric, or every value/direction is exact. comparison_target_preserved is true when no target exists or the target is retained.',
    'no_invented_mechanism is especially important: benchmark score, model size, price, latency, pass rate or reported reduction does not reveal why it happened unless the source says why.',
    'repair_instruction must be specific enough to revise only the failed semantic fields while retaining exact source facts.',
    'Return JSON only: {"audits":[{"story_id":"...","role_supported":boolean,"claim_supported":boolean,"visual_driver_supported":boolean,"outcome_supported":boolean,"certainty_preserved":boolean,"metric_exact":boolean,"comparison_target_preserved":boolean,"no_invented_mechanism":boolean,"one_core_claim":boolean,"visually_testable":boolean,"issues":[string],"repair_instruction":string,"rationale":string}]}.',
    `INPUT=${JSON.stringify(
      rows.map(({ story, raw, claim }) => ({
        source: sourcePayload(story),
        raw_claim: raw,
        normalized_claim: {
          explanatory_role: claim.semantics.explanatoryRole,
          certainty: claim.semantics.certainty,
          mapping_mode: claim.semantics.mappingMode,
          identity: claim.claim.identity,
          change: claim.claim.change,
          visual_driver: claim.semantics.visualDriver,
          visible_outcome: claim.claim.primaryOutcome,
          core_claim: claim.claim.coreClaim,
          metric: claim.semantics.metric,
          labels: claim.claim.approvedLabels ?? [],
          quantitative_facts: claim.claim.quantitativeFacts ?? [],
          states: claim.claim.states ?? [],
          comparison: claim.claim.comparison ?? null,
          layers: claim.claim.layers ?? [],
          required_visible_delta: claim.semantics.requiredVisibleDelta,
          forbidden_contradictions: claim.claim.forbiddenContradictions ?? [],
        },
      })),
    )}`,
  ].join('\n');
}

function normalizeAudit(value: unknown, storyId: string): ClaimAudit {
  const row = record(value);
  const audit: ClaimAudit = {
    storyId,
    roleSupported: bool(row.role_supported),
    claimSupported: bool(row.claim_supported),
    visualDriverSupported: bool(row.visual_driver_supported),
    outcomeSupported: bool(row.outcome_supported),
    certaintyPreserved: bool(row.certainty_preserved),
    metricExact: bool(row.metric_exact),
    comparisonTargetPreserved: bool(row.comparison_target_preserved),
    noInventedMechanism: bool(row.no_invented_mechanism),
    oneCoreClaim: bool(row.one_core_claim),
    visuallyTestable: bool(row.visually_testable),
    passed: false,
    issues: stringArray(row.issues, 8, 180),
    repairInstruction: clean(row.repair_instruction, 500),
    rationale: clean(row.rationale, 500),
  };
  audit.passed =
    audit.roleSupported &&
    audit.claimSupported &&
    audit.visualDriverSupported &&
    audit.outcomeSupported &&
    audit.certaintyPreserved &&
    audit.metricExact &&
    audit.comparisonTargetPreserved &&
    audit.noInventedMechanism &&
    audit.oneCoreClaim &&
    audit.visuallyTestable;
  return audit;
}

async function auditClaims(
  rows: Array<{ story: HoldoutStoryInput; raw: unknown; claim: AutoVisualClaimV5 }>,
  usage: UsageTotals,
): Promise<ClaimAudit[]> {
  const response = await callModel<{ audits?: unknown }>({
    model: AUDIT_MODEL,
    title: 'AI Today Brief VisualClaim v5 role-aware source audit',
    prompt: auditPrompt(rows),
    maxTokens: 7_000,
    usage,
  });
  const rawAudits = Array.isArray(response.audits) ? response.audits : [];
  const byId = new Map<string, unknown>();
  for (const value of rawAudits) {
    const id = clean(record(value).story_id, 100);
    if (id) byId.set(id, value);
  }
  const audits = rows.map(({ story }) =>
    normalizeAudit(byId.get(story.revision_item_id), story.revision_item_id),
  );
  if (audits.some((audit) => !byId.has(audit.storyId))) {
    throw new Error('Source audit omitted one or more story IDs.');
  }
  return audits;
}

function repairPrompt(input: {
  story: HoldoutStoryInput;
  previousRaw: unknown;
  normalizedClaim: AutoVisualClaimV5;
  deterministicIssues: string[];
  audit: ClaimAudit;
}): string {
  return [
    'Repair one AI Today Brief VisualClaim v5. Return the full claim object, not a patch.',
    'Use only the original approved story. Preserve exact metrics, comparison targets and uncertainty. Do not invent a mechanism for a benchmark, capability claim or measured result.',
    'The repaired claim must satisfy the role definitions and every failed issue below. Keep one core claim and at most three deterministic labels.',
    `SOURCE=${JSON.stringify(sourcePayload(input.story))}`,
    `PREVIOUS_RAW=${JSON.stringify(input.previousRaw)}`,
    `NORMALIZED=${JSON.stringify({
      semantics: input.normalizedClaim.semantics,
      claim: input.normalizedClaim.claim,
      grammar: input.normalizedClaim.grammar,
    })}`,
    `DETERMINISTIC_ISSUES=${JSON.stringify(input.deterministicIssues)}`,
    `AUDIT_ISSUES=${JSON.stringify(input.audit.issues)}`,
    `REPAIR_INSTRUCTION=${input.audit.repairInstruction}`,
    'Return JSON only as {"claim":{story_id,explanatory_role,certainty,mapping_mode,identity,change,visual_driver,visible_outcome,core_claim,metric,labels,quantitative_facts,states,comparison,layers,routing,required_visible_delta,forbidden_contradictions,grammar}}.',
  ].join('\n');
}

async function repairClaim(input: {
  story: HoldoutStoryInput;
  previousRaw: unknown;
  normalizedClaim: AutoVisualClaimV5;
  deterministicIssues: string[];
  audit: ClaimAudit;
  usage: UsageTotals;
}): Promise<unknown> {
  const response = await callModel<{ claim?: unknown }>({
    model: EXTRACT_MODEL,
    title: 'AI Today Brief VisualClaim v5 semantic repair',
    prompt: repairPrompt(input),
    maxTokens: 3_500,
    usage: input.usage,
  });
  if (!response.claim || typeof response.claim !== 'object') {
    throw new Error(`VisualClaim repair returned no claim for ${input.story.revision_item_id}.`);
  }
  return response.claim;
}

function compileRecord(
  story: HoldoutStoryInput,
  raw: unknown,
): { claim: AutoVisualClaimV5; plan: VisualPlan; issues: string[] } {
  const claim = parseAutoVisualClaimV5(raw, story);
  const semanticIssues = validateAutoVisualClaimV5(claim);
  let plan: VisualPlan;
  try {
    plan = compileAutoVisualClaimV5(claim);
  } catch {
    // Preserve a serializable plan for the repair prompt while reporting every issue.
    plan = {
      policyId: 'weekly-visual-compiler-v0',
      claim: claim.claim,
      format: 'cinematic_single',
      renderStrategy: 'one_asset',
      regions: [],
      transitions: [],
      overlays: [],
      renderUnits: [],
      pixelAssertions: [],
      forbiddenContradictions: claim.claim.forbiddenContradictions ?? [],
      execution: {
        candidateCount: 0,
        imageCalls: 0,
        visionCalls: 0,
        fullRegenerations: 0,
        estimatedUsd: 0,
        estimatedDurationMs: 0,
        withinPolicy: false,
      },
    };
  }
  const planIssues = plan.regions.length ? validateVisualPlan(plan) : ['plan_compile_failed'];
  return { claim, plan, issues: [...new Set([...semanticIssues, ...planIssues])] };
}

function report(records: V5ClaimRecord[], usage: UsageTotals): string {
  const initialPass = records.filter(
    (record) => record.initialAudit.passed && record.deterministicIssues.length === 0 && !record.repaired,
  ).length;
  const finalPass = records.filter((record) => record.eligible).length;
  const repaired = records.filter((record) => record.repaired).length;
  const roles = new Map<string, number>();
  for (const record of records) {
    const role = record.autoClaim.semantics.explanatoryRole;
    roles.set(role, (roles.get(role) ?? 0) + 1);
  }
  const lines = [
    '# Visual Compiler v5 fresh-holdout claim gate',
    '',
    `Stories: **${records.length}**.`,
    `Initial clean pass: **${initialPass}/${records.length}**.`,
    `Claims repaired once: **${repaired}/${records.length}**.`,
    `Final eligible claims: **${finalPass}/${records.length}**.`,
    `LLM calls: ${usage.calls}; tokens: ${usage.totalTokens}; reported cost: $${usage.costUsd.toFixed(4)}.`,
    '',
    '| # | Story | Role | Certainty | Direction/target | Mapping | Render mode | Initial | Final | Repair/issues |',
    '|---:|---|---|---|---|---|---|---:|---:|---|',
  ];
  for (const record of records) {
    const metric = record.autoClaim.semantics.metric;
    lines.push(
      `| ${record.story.rank} | ${record.story.title.replace(/\|/g, '\\|')} | \`${record.autoClaim.semantics.explanatoryRole}\` | \`${record.autoClaim.semantics.certainty}\` | ${metric ? `${metric.direction}${metric.comparisonTarget ? ` / ${metric.comparisonTarget}` : ''}` : 'n/a'} | \`${record.autoClaim.semantics.mappingMode}\` | \`${record.renderMode}\` | ${record.initialAudit.passed ? '✓' : '✕'} | ${record.eligible ? '✓' : '✕'} | ${[
        ...record.deterministicIssues,
        ...record.finalAudit.issues,
      ]
        .join('; ')
        .replace(/\|/g, '\\|') || 'none'} |`,
    );
  }
  lines.push('', '## Role distribution', '');
  for (const [role, count] of [...roles].sort()) lines.push(`- \`${role}\`: ${count}`);
  lines.push('', '## Ineligible fallback', '');
  lines.push(
    'A claim that still fails after one repair must not be rendered as a factual compiler visual. Production behavior is a branded source-led fallback with the approved headline and no explanatory assertion.',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEnvironment();
  await mkdir(OUT_DIR, { recursive: true });
  const stories = JSON.parse(await readFile(DATA_PATH, 'utf8')) as HoldoutStoryInput[];
  if (stories.length !== 7) throw new Error(`Expected 7 fresh stories; received ${stories.length}.`);
  const usage = emptyUsage();
  const initialRawClaims = await extractBatch(stories, usage);
  const rawById = new Map<string, unknown>();
  for (const value of initialRawClaims) {
    const id = clean(record(value).story_id, 100);
    if (id) rawById.set(id, value);
  }
  const initialCompiled = stories.map((story) => ({
    story,
    raw: rawById.get(story.revision_item_id) ?? {},
    ...compileRecord(story, rawById.get(story.revision_item_id) ?? {}),
  }));
  const initialAudits = await auditClaims(
    initialCompiled.map(({ story, raw, claim }) => ({ story, raw, claim })),
    usage,
  );
  const initialAuditById = new Map(initialAudits.map((audit) => [audit.storyId, audit] as const));
  const records: V5ClaimRecord[] = [];

  for (const initial of initialCompiled) {
    const initialAudit = initialAuditById.get(initial.story.revision_item_id)!;
    const needsRepair = initial.issues.length > 0 || !initialAudit.passed;
    if (!needsRepair) {
      records.push({
        story: initial.story,
        initialRaw: initial.raw,
        finalRaw: initial.raw,
        autoClaim: initial.claim,
        plan: initial.plan,
        renderMode: selectVisualRenderModeV5(initial.claim),
        initialAudit,
        finalAudit: initialAudit,
        deterministicIssues: [],
        repaired: false,
        eligible: true,
      });
      continue;
    }

    console.log(`[v5-repair] #${initial.story.rank} ${initial.story.title}`);
    const repairedRaw = await repairClaim({
      story: initial.story,
      previousRaw: initial.raw,
      normalizedClaim: initial.claim,
      deterministicIssues: initial.issues,
      audit: initialAudit,
      usage,
    });
    const repaired = compileRecord(initial.story, repairedRaw);
    const [repairedAudit] = await auditClaims(
      [{ story: initial.story, raw: repairedRaw, claim: repaired.claim }],
      usage,
    );
    const eligible = repaired.issues.length === 0 && repairedAudit.passed;
    records.push({
      story: initial.story,
      initialRaw: initial.raw,
      finalRaw: repairedRaw,
      autoClaim: repaired.claim,
      plan: repaired.plan,
      renderMode: selectVisualRenderModeV5(repaired.claim),
      initialAudit,
      finalAudit: repairedAudit,
      deterministicIssues: repaired.issues,
      repaired: true,
      eligible,
    });
  }

  const reportText = report(records, usage);
  await Promise.all([
    writeFile(join(OUT_DIR, 'v5-claims.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'v5-claim-report.md'), reportText),
    writeFile(join(OUT_DIR, 'v5-usage.json'), `${JSON.stringify(usage, null, 2)}\n`),
  ]);
  console.log(reportText);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'v5-extraction-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
