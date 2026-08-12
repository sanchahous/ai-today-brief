import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AutoVisualClaim } from '../src/lib/weekly-digest/visual-auto-claim';

const SELECTION_PATH =
  process.env.VISUAL_HOLDOUT_SELECTION?.trim() ||
  'artifacts/visual-compiler-holdout/render-selection.json';
const OUT_DIR =
  process.env.VISUAL_HOLDOUT_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout-ab';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_HOLDOUT_CLAIM_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

interface SelectionRow {
  weekStart: string;
  rank: number;
  headline: string;
  story: {
    revision_item_id: string;
    title: string;
    summary: string;
    why: string | null;
    practical: string | null;
    takeaway: string | null;
  };
  autoClaim: AutoVisualClaim;
}

export interface ClaimFidelityVerdict {
  storyId: string;
  supportedBySource: boolean;
  mechanismCentral: boolean;
  outcomeSupported: boolean;
  certaintyPreserved: boolean;
  quantitativeFactsExact: boolean;
  oneCoreClaim: boolean;
  visuallyTestable: boolean;
  passed: boolean;
  issues: string[];
  correctedCoreClaim: string;
  rationale: string;
}

interface BatchResponse {
  audits?: unknown;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return typeof content === 'string' ? content : '';
}

function parseJson<T>(text: string): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as T;
    throw new Error(`Invalid claim-audit JSON: ${clean.slice(0, 500)}`);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boolean(value: unknown): boolean {
  return value === true;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normalizeAudit(value: unknown, storyId: string): ClaimFidelityVerdict {
  const row = record(value);
  const supportedBySource = boolean(row.supported_by_source);
  const mechanismCentral = boolean(row.mechanism_central);
  const outcomeSupported = boolean(row.outcome_supported);
  const certaintyPreserved = boolean(row.certainty_preserved);
  const quantitativeFactsExact = boolean(row.quantitative_facts_exact);
  const oneCoreClaim = boolean(row.one_core_claim);
  const visuallyTestable = boolean(row.visually_testable);
  const passed =
    supportedBySource &&
    mechanismCentral &&
    outcomeSupported &&
    certaintyPreserved &&
    quantitativeFactsExact &&
    oneCoreClaim &&
    visuallyTestable;
  return {
    storyId,
    supportedBySource,
    mechanismCentral,
    outcomeSupported,
    certaintyPreserved,
    quantitativeFactsExact,
    oneCoreClaim,
    visuallyTestable,
    passed,
    issues: stringArray(row.issues, 6, 180),
    correctedCoreClaim: text(row.corrected_core_claim, 260),
    rationale: text(row.rationale, 360),
  };
}

function prompt(rows: SelectionRow[]): string {
  return [
    'You are a strict source-fidelity editor for AI Today Brief.',
    'Audit each automatically extracted VisualClaim against the original approved story. Do not assess image beauty and do not assume the extracted claim is correct.',
    'Definitions:',
    '- supported_by_source: the core claim is directly supported by the supplied story text;',
    '- mechanism_central: the mechanism is an important causal process in the story rather than an invented implementation detail;',
    '- outcome_supported: the claimed benefit, harm, trade-off or result is explicitly supported;',
    '- certainty_preserved: planned/expected/reported/possible claims have not been upgraded to available/proven/guaranteed facts;',
    '- quantitative_facts_exact: every number, ratio, price and comparison is copied accurately and retains its comparison target; true when no quantitative claim is used;',
    '- one_core_claim: the claim expresses one coherent causal proposition rather than several unrelated benefits;',
    '- visually_testable: mechanism and outcome can be depicted as visible evidence rather than vague topic mood.',
    'Fail certainty_preserved when the source says prepares, expected, aims, reports, may, or claims but the VisualClaim states availability or certainty.',
    'Fail quantitative_facts_exact when a relative comparison such as half the cost loses the comparison target, or when 2–3 trillion becomes a single exact value.',
    'corrected_core_claim must remain one sentence and use only supplied facts. It is diagnostic only; do not silently repair the evaluated claim.',
    'Return JSON only: {"audits":[{"story_id":"...","supported_by_source":boolean,"mechanism_central":boolean,"outcome_supported":boolean,"certainty_preserved":boolean,"quantitative_facts_exact":boolean,"one_core_claim":boolean,"visually_testable":boolean,"issues":[string],"corrected_core_claim":string,"rationale":string}]}.',
    `INPUT=${JSON.stringify(
      rows.map((row) => ({
        story_id: row.story.revision_item_id,
        headline: row.story.title,
        summary: row.story.summary,
        why: row.story.why,
        practical: row.story.practical,
        takeaway: row.story.takeaway,
        extracted_visual_claim: {
          identity: row.autoClaim.claim.identity,
          change: row.autoClaim.claim.change,
          mechanism: row.autoClaim.claim.mechanism,
          primary_outcome: row.autoClaim.claim.primaryOutcome,
          core_claim: row.autoClaim.claim.coreClaim,
          quantitative_facts: row.autoClaim.claim.quantitativeFacts ?? [],
          approved_labels: row.autoClaim.claim.approvedLabels ?? [],
          evidence_type: row.autoClaim.claim.primaryEvidence,
        },
      })),
    )}`,
  ].join('\n');
}

async function callJudge(rows: SelectionRow[]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief unseen VisualClaim fidelity audit',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt(rows) }],
          temperature: 0,
          max_tokens: 7_000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      const parsed = parseJson<BatchResponse>(responseText(payload));
      const rawAudits = Array.isArray(parsed.audits) ? parsed.audits : [];
      const rawById = new Map<string, unknown>();
      for (const raw of rawAudits) {
        const id = text(record(raw).story_id, 80);
        if (id) rawById.set(id, raw);
      }
      const audits = rows.map((row) =>
        normalizeAudit(rawById.get(row.story.revision_item_id), row.story.revision_item_id),
      );
      if (audits.some((audit) => !rawById.has(audit.storyId))) {
        throw new Error('Claim-audit response omitted one or more story IDs.');
      }
      return { audits, usage: payload.usage, attempts: attempt };
    } catch (error) {
      lastError = error;
      console.warn(`[claim-audit] attempt ${attempt} failed`, error);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function mark(value: boolean): string {
  return value ? '✓' : '✕';
}

function report(rows: SelectionRow[], audits: ClaimFidelityVerdict[], usage?: OpenRouterResponse['usage']) {
  const byId = new Map(audits.map((audit) => [audit.storyId, audit] as const));
  const passed = audits.filter((audit) => audit.passed).length;
  const lines = [
    '# Unseen VisualClaim source-fidelity audit',
    '',
    `Pass: **${passed}/${audits.length}**.`,
    `Judge: \`${MODEL}\`; reported cost $${(usage?.cost ?? 0).toFixed(4)}.`,
    '',
    '| Week | # | Story | Source | Mechanism | Outcome | Certainty | Numbers | One claim | Visual | Final | Issues |',
    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const row of rows) {
    const audit = byId.get(row.story.revision_item_id)!;
    lines.push(
      `| ${row.weekStart} | ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | ${mark(audit.supportedBySource)} | ${mark(audit.mechanismCentral)} | ${mark(audit.outcomeSupported)} | ${mark(audit.certaintyPreserved)} | ${mark(audit.quantitativeFactsExact)} | ${mark(audit.oneCoreClaim)} | ${mark(audit.visuallyTestable)} | **${mark(audit.passed)}** | ${audit.issues.join('; ').replace(/\|/g, '\\|') || 'none'} |`,
    );
  }
  lines.push('', '## Corrected claims for diagnosis only', '');
  for (const row of rows) {
    const audit = byId.get(row.story.revision_item_id)!;
    if (!audit.passed) {
      lines.push(`- ${row.weekStart} #${row.rank}: ${audit.correctedCoreClaim || 'No correction returned.'}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEnvironment();
  await mkdir(OUT_DIR, { recursive: true });
  const rows = JSON.parse(await readFile(SELECTION_PATH, 'utf8')) as SelectionRow[];
  if (rows.length !== 12) throw new Error(`Expected 12 selected stories; received ${rows.length}.`);
  const result = await callJudge(rows);
  const reportText = report(rows, result.audits, result.usage);
  await Promise.all([
    writeFile(
      join(OUT_DIR, 'claim-fidelity.json'),
      `${JSON.stringify({ ...result, model: MODEL }, null, 2)}\n`,
    ),
    writeFile(join(OUT_DIR, 'claim-fidelity-report.md'), reportText),
  ]);
  console.log(reportText);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'claim-fidelity-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
