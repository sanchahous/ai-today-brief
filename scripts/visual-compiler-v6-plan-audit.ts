import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AutoVisualClaimV5 } from '../src/lib/weekly-digest/visual-auto-claim-v5';
import {
  analogyAuditPromptV6,
  analogyPlannerPromptV6,
  buildHybridTreatmentV6,
  validateAnalogyPlanV6,
  type AnalogyAuditV6,
  type AnalogyPlanV6,
  type HybridTreatmentV6,
} from '../src/lib/weekly-digest/visual-hybrid-v6';

const INPUT_PATH =
  process.env.VISUAL_V6_CLAIMS?.trim() ||
  'experiments/visual-compiler-v5/fresh-holdout/output/v5-claims.json';
const OUT_DIR =
  process.env.VISUAL_V6_OUT_DIR?.trim() || 'artifacts/visual-compiler-v6-hybrid';
const API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const PLANNER_MODEL =
  process.env.VISUAL_V6_PLANNER_MODEL?.trim() || 'google/gemini-2.5-flash';
const AUDIT_MODEL =
  process.env.VISUAL_V6_AUDIT_MODEL?.trim() || 'google/gemini-2.5-flash';

interface ClaimRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
}

interface ModelUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

interface TreatmentRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  treatment: HybridTreatmentV6;
  deterministicIssues: string[];
  planningAttempts: number;
  auditAttempts: number;
}

const usage: ModelUsage = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costUsd: 0,
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function strings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => text(entry, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

function parseJson(value: string): unknown {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error(`Invalid JSON response: ${candidate.slice(0, 300)}`);
  }
}

async function callModel(model: string, prompt: string): Promise<unknown> {
  if (!API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief Visual Compiler v6',
        },
        body: JSON.stringify({
          model,
          temperature: attempt === 1 ? 0.15 : 0,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost?: number;
        };
      };
      const content = payload.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) throw new Error('OpenRouter returned empty content.');
      usage.calls += 1;
      usage.promptTokens += payload.usage?.prompt_tokens ?? 0;
      usage.completionTokens += payload.usage?.completion_tokens ?? 0;
      usage.totalTokens +=
        payload.usage?.total_tokens ??
        (payload.usage?.prompt_tokens ?? 0) + (payload.usage?.completion_tokens ?? 0);
      usage.costUsd += payload.usage?.cost ?? 0;
      return parseJson(content);
    } catch (error) {
      lastError = error;
      console.warn(`[v6-plan] ${model} attempt ${attempt} failed`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function normalizePlan(value: unknown, storyId: string): AnalogyPlanV6 {
  const row = object(value);
  const rawMappings = Array.isArray(row.mappings) ? row.mappings : [];
  return {
    storyId: text(row.story_id, 100) || storyId,
    title: text(row.title, 80),
    subject: text(row.subject, 180),
    action: text(row.action, 260),
    setting: text(row.setting, 180),
    props: strings(row.props, 4, 120),
    sourceAnchor: text(row.source_anchor, 180),
    visibleMechanism: text(row.visible_mechanism, 220),
    visibleOutcome: text(row.visible_outcome, 220),
    mappings: rawMappings.slice(0, 3).map((entry) => {
      const mapping = object(entry);
      return {
        sourceElement: text(mapping.source_element, 140),
        physicalElement: text(mapping.physical_element, 140),
      };
    }),
    whyItFits: text(row.why_it_fits, 360),
    unsupportedAssertions: strings(row.unsupported_assertions, 6, 180),
    forbiddenVisuals: strings(row.forbidden_visuals, 8, 120),
  };
}

function normalizeAudit(value: unknown, storyId: string): AnalogyAuditV6 {
  const row = object(value);
  const checks = {
    sourceAnchorPreserved: row.source_anchor_preserved === true,
    mechanismPreserved: row.mechanism_preserved === true,
    outcomePreserved: row.outcome_preserved === true,
    certaintyPreserved: row.certainty_preserved === true,
    oneToOneMapping: row.one_to_one_mapping === true,
    visuallyTestable: row.visually_testable === true,
    unsupportedSpecifics: row.unsupported_specifics === true,
  };
  const passed =
    row.passed === true &&
    checks.sourceAnchorPreserved &&
    checks.mechanismPreserved &&
    checks.outcomePreserved &&
    checks.certaintyPreserved &&
    checks.oneToOneMapping &&
    checks.visuallyTestable &&
    !checks.unsupportedSpecifics;
  return {
    storyId: text(row.story_id, 100) || storyId,
    passed,
    ...checks,
    issues: strings(row.issues, 10, 100),
    rationale: text(row.rationale, 500),
  };
}

async function planAndAudit(
  story: HoldoutStoryInput,
  autoClaim: AutoVisualClaimV5,
): Promise<{
  plan: AnalogyPlanV6 | null;
  audit: AnalogyAuditV6 | null;
  deterministicIssues: string[];
  planningAttempts: number;
  auditAttempts: number;
}> {
  let plan: AnalogyPlanV6 | null = null;
  let audit: AnalogyAuditV6 | null = null;
  let deterministicIssues: string[] = [];
  let planningAttempts = 0;
  let auditAttempts = 0;
  let priorIssues: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    planningAttempts += 1;
    plan = normalizePlan(
      await callModel(PLANNER_MODEL, analogyPlannerPromptV6(story, autoClaim, priorIssues)),
      story.revision_item_id,
    );
    deterministicIssues = validateAnalogyPlanV6(plan, autoClaim);
    if (deterministicIssues.length > 0) {
      priorIssues = deterministicIssues;
      continue;
    }

    auditAttempts += 1;
    audit = normalizeAudit(
      await callModel(AUDIT_MODEL, analogyAuditPromptV6(story, autoClaim, plan)),
      story.revision_item_id,
    );
    if (audit.passed) break;
    priorIssues = audit.issues.length ? audit.issues : ['independent_source_audit_failed'];
  }

  return { plan, audit, deterministicIssues, planningAttempts, auditAttempts };
}

function markdown(records: TreatmentRecord[]): string {
  const generated = records.filter(
    (record) => record.treatment.mode === 'generated_audited_analogy',
  ).length;
  const lines = [
    '# Visual Compiler v6 hybrid treatment gate',
    '',
    `Stories: **${records.length}**.`,
    `Generated audited analogies: **${generated}**.`,
    `Deterministic treatments: **${records.length - generated}**.`,
    `Planner/audit calls: **${usage.calls}**; tokens: **${usage.totalTokens}**; reported cost: **$${usage.costUsd.toFixed(4)}**.`,
    '',
    '| # | Story | Role | Mode | Eligible | Plan tries | Audit tries | Issues |',
    '|---:|---|---|---|---:|---:|---:|---|',
  ];
  for (const record of records) {
    const issues = [
      ...record.deterministicIssues,
      ...(record.treatment.analogyAudit?.issues ?? []),
    ];
    lines.push(
      `| ${record.story.rank} | ${record.story.title.replace(/\|/g, '\\|')} | ` +
        `\`${record.treatment.role}\` | \`${record.treatment.mode}\` | ` +
        `${record.treatment.eligible ? '✓' : '✕'} | ${record.planningAttempts} | ` +
        `${record.auditAttempts} | ${issues.join(', ') || 'none'} |`,
    );
  }
  lines.push('', '## Approved physical analogies', '');
  for (const record of records.filter((entry) => entry.treatment.analogy)) {
    const plan = record.treatment.analogy!;
    lines.push(
      `### ${record.story.rank}. ${record.story.title}`,
      '',
      `- **Subject:** ${plan.subject}`,
      `- **Action:** ${plan.action}`,
      `- **Setting:** ${plan.setting}`,
      `- **Anchor:** ${plan.sourceAnchor}`,
      `- **Mechanism:** ${plan.visibleMechanism}`,
      `- **Outcome:** ${plan.visibleOutcome}`,
      `- **Audit:** ${record.treatment.analogyAudit?.rationale || 'passed'}`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const records = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as ClaimRecord[];
  const outputs: TreatmentRecord[] = [];

  for (const record of records.sort((left, right) => left.story.rank - right.story.rank)) {
    if (!record.eligible) {
      throw new Error(`Input claim is not eligible: ${record.story.revision_item_id}`);
    }
    if (record.autoClaim.semantics.explanatoryRole !== 'causal_mechanism') {
      outputs.push({
        story: record.story,
        autoClaim: record.autoClaim,
        treatment: buildHybridTreatmentV6(record.autoClaim, record.story, null, null),
        deterministicIssues: [],
        planningAttempts: 0,
        auditAttempts: 0,
      });
      continue;
    }
    console.log(`[v6-plan] ${record.story.rank}/7 ${record.story.title}`);
    const result = await planAndAudit(record.story, record.autoClaim);
    outputs.push({
      story: record.story,
      autoClaim: record.autoClaim,
      treatment: buildHybridTreatmentV6(
        record.autoClaim,
        record.story,
        result.plan,
        result.audit,
      ),
      deterministicIssues: result.deterministicIssues,
      planningAttempts: result.planningAttempts,
      auditAttempts: result.auditAttempts,
    });
  }

  await writeFile(join(OUT_DIR, 'v6-treatments.json'), `${JSON.stringify(outputs, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'v6-treatment-report.md'), markdown(outputs));
  await writeFile(join(OUT_DIR, 'v6-usage.json'), `${JSON.stringify(usage, null, 2)}\n`);
  console.log(markdown(outputs));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
