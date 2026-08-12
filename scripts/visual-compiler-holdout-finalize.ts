import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  VISUAL_GLYPHS,
  VISUAL_OUTCOME_SIGNALS,
  VISUAL_RELATIONS,
  compileAutoVisualClaim,
  parseAutoVisualClaim,
  validateAutoVisualClaim,
  type AutoVisualClaim,
  type HoldoutStoryInput,
} from '../src/lib/weekly-digest/visual-auto-claim';
import { validateVisualPlan, type VisualPlan } from '../src/lib/weekly-digest/visual-compiler';
import { decideVisualRenderPolicy } from '../src/lib/weekly-digest/visual-render-policy';

const DATA_PATH =
  process.env.VISUAL_HOLDOUT_DATA?.trim() ||
  'experiments/visual-compiler/holdout/holdout-stories.json';
const INPUT_PATH =
  process.env.VISUAL_HOLDOUT_RAW_BATCHES?.trim() ||
  'artifacts/visual-compiler-holdout/partial-batches.json';
const OUT_DIR =
  process.env.VISUAL_HOLDOUT_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout';

interface RawBatch {
  weekStart: string;
  model: string;
  mode: string;
  attempts: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  rawClaims: unknown[];
}

export interface HoldoutPlanRecord {
  weekStart: string;
  weekEnd: string;
  rank: number;
  headline: string;
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaim;
  plan: VisualPlan;
  renderPolicy: ReturnType<typeof decideVisualRenderPolicy>;
  normalizationNotes: string[];
  issues: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function identitySuffix(story: HoldoutStoryInput): string {
  const text = `${story.title} ${story.summary}`.toLowerCase();
  if (/compiler|mlir|lowering|verilog|rtl|xla|triton/.test(text)) return 'compilation pipeline';
  if (/gateway|proxy|router|routing|delegate/.test(text)) return 'routing gateway';
  if (/policy|sandbox|security|credential|isolation/.test(text)) return 'security system';
  if (/notebook|desktop|local|device/.test(text)) return 'local workspace';
  if (/model|gemini|grok|gpt|claude|kimi/.test(text)) return 'model system';
  return 'technical system';
}

function normalizeRawClaim(
  value: unknown,
  story: HoldoutStoryInput,
): { value: Record<string, unknown>; notes: string[] } {
  const raw = { ...record(value) };
  const notes: string[] = [];
  const identity = clean(raw.identity);
  if (identity.length < 8) {
    raw.identity = `${identity || story.title.split(/[—:]/)[0]!.trim()} ${identitySuffix(story)}`
      .replace(/\s+/g, ' ')
      .trim();
    notes.push('identity_expanded_for_visible_anchor');
  }

  const grammar = { ...record(raw.grammar) };
  const glyphKeys = ['context_glyph', 'mechanism_glyph', 'outcome_glyph'] as const;
  for (const key of glyphKeys) {
    const candidate = clean(grammar[key]).toLowerCase().replace(/[\s-]+/g, '_');
    if (candidate && !(VISUAL_GLYPHS as readonly string[]).includes(candidate)) {
      notes.push(`${key}_normalized_from_${candidate}`);
    }
  }
  const relation = clean(grammar.relation).toLowerCase().replace(/[\s-]+/g, '_');
  if (relation && !(VISUAL_RELATIONS as readonly string[]).includes(relation)) {
    notes.push(`relation_normalized_from_${relation}`);
  }
  const signal = clean(grammar.outcome_signal).toLowerCase().replace(/[\s-]+/g, '_');
  if (signal && !(VISUAL_OUTCOME_SIGNALS as readonly string[]).includes(signal)) {
    notes.push(`outcome_signal_normalized_from_${signal}`);
  }

  return { value: raw, notes };
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function distribution(records: HoldoutPlanRecord[], key: (record: HoldoutPlanRecord) => string) {
  const counts = new Map<string, number>();
  for (const item of records) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

export function selectHoldoutRenderSet(records: HoldoutPlanRecord[], perWeek = 4) {
  const selected: HoldoutPlanRecord[] = [];
  const byWeek = new Map<string, HoldoutPlanRecord[]>();
  for (const item of records) {
    const group = byWeek.get(item.weekStart) ?? [];
    group.push(item);
    byWeek.set(item.weekStart, group);
  }

  for (const [week, group] of [...byWeek].sort(([a], [b]) => b.localeCompare(a))) {
    const ordered = [...group].sort((a, b) => a.rank - b.rank);
    const weekSelection: HoldoutPlanRecord[] = [];
    const usedEvidence = new Set<string>();
    for (const item of ordered) {
      const evidence = item.autoClaim.claim.primaryEvidence;
      if (usedEvidence.has(evidence)) continue;
      weekSelection.push(item);
      usedEvidence.add(evidence);
      if (weekSelection.length >= perWeek) break;
    }
    for (const item of ordered) {
      if (weekSelection.includes(item)) continue;
      weekSelection.push(item);
      if (weekSelection.length >= perWeek) break;
    }
    if (weekSelection.length !== Math.min(perWeek, ordered.length)) {
      throw new Error(`Could not select ${perWeek} holdout stories for ${week}.`);
    }
    selected.push(...weekSelection);
  }
  return selected.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.rank - b.rank);
}

function report(
  records: HoldoutPlanRecord[],
  selected: HoldoutPlanRecord[],
  batches: RawBatch[],
): string {
  const totalCost = batches.reduce((sum, batch) => sum + (batch.usage?.cost ?? 0), 0);
  const totalTokens = batches.reduce(
    (sum, batch) => sum + (batch.usage?.total_tokens ?? 0),
    0,
  );
  const normalizationCount = records.filter((item) => item.normalizationNotes.length > 0).length;
  const lines = [
    '# Unseen multi-digest VisualClaim extraction — finalized',
    '',
    `Stories: **${records.length}** across **${new Set(records.map((item) => item.weekStart)).size}** previous digests.`,
    `Valid compiled plans: **${records.filter((item) => item.issues.length === 0).length}/${records.length}**.`,
    `Claims requiring deterministic normalization: **${normalizationCount}/${records.length}**.`,
    `Extraction usage: ${totalTokens} tokens; reported cost $${totalCost.toFixed(4)}.`,
    `Stratified render holdout: **${selected.length}** stories (${selected.length / 3} per digest).`,
    '',
    '| Week | # | Story | Evidence | Format | Render mode | Glyph grammar | Labels | Normalization |',
    '|---|---:|---|---|---|---|---|---|---|',
  ];
  for (const item of records) {
    const grammar = item.autoClaim.grammar;
    lines.push(
      `| ${item.weekStart} | ${item.rank} | ${markdownEscape(item.headline)} | \`${
        item.autoClaim.claim.primaryEvidence
      }\` | \`${item.plan.format}\` | \`${item.renderPolicy.mode}\` | ${markdownEscape(
        `${grammar.contextGlyph} → ${grammar.mechanismGlyph} → ${grammar.outcomeGlyph}`,
      )} | ${markdownEscape(item.plan.overlays.map((overlay) => overlay.text).join(' · ') || 'none')} | ${markdownEscape(
        item.normalizationNotes.join(', ') || 'none',
      )} |`,
    );
  }
  lines.push('', '## Evidence distribution', '');
  for (const [key, count] of distribution(records, (item) => item.autoClaim.claim.primaryEvidence)) {
    lines.push(`- \`${key}\`: ${count}`);
  }
  lines.push('', '## Format distribution', '');
  for (const [key, count] of distribution(records, (item) => item.plan.format)) {
    lines.push(`- \`${key}\`: ${count}`);
  }
  lines.push('', '## Render-mode distribution', '');
  for (const [key, count] of distribution(records, (item) => item.renderPolicy.mode)) {
    lines.push(`- \`${key}\`: ${count}`);
  }
  lines.push('', '## Selected 12-story render holdout', '');
  for (const item of selected) {
    lines.push(
      `- ${item.weekStart} #${item.rank}: ${item.headline} — \`${item.plan.format}\` / \`${item.renderPolicy.mode}\`.`,
    );
  }
  lines.push(
    '',
    'Selection is deterministic: one item per distinct evidence type within each digest first, then lowest editorial rank until four stories are selected.',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const [stories, batches] = await Promise.all([
    readFile(DATA_PATH, 'utf8').then((value) => JSON.parse(value) as HoldoutStoryInput[]),
    readFile(INPUT_PATH, 'utf8').then((value) => JSON.parse(value) as RawBatch[]),
  ]);
  const rawById = new Map<string, unknown>();
  for (const batch of batches) {
    for (const raw of batch.rawClaims) {
      const id = clean(record(raw).story_id);
      if (id && !rawById.has(id)) rawById.set(id, raw);
    }
  }

  const records: HoldoutPlanRecord[] = stories.map((story) => {
    const normalized = normalizeRawClaim(rawById.get(story.revision_item_id) ?? {}, story);
    const autoClaim = parseAutoVisualClaim(normalized.value, story);
    autoClaim.extractionWarnings.push(...normalized.notes);
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
      normalizationNotes: normalized.notes,
      issues,
    };
  });

  const invalid = records.filter((item) => item.issues.length > 0);
  if (invalid.length) {
    throw new Error(
      `Invalid finalized claims: ${invalid
        .map((item) => `${item.story.revision_item_id}:${item.issues.join(',')}`)
        .join(' | ')}`,
    );
  }
  const selected = selectHoldoutRenderSet(records, 4);
  const reportText = report(records, selected, batches);
  await Promise.all([
    writeFile(join(OUT_DIR, 'extracted-claims.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'render-selection.json'), `${JSON.stringify(selected, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'extraction-report.md'), reportText),
  ]);
  console.log(reportText);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'finalization-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
