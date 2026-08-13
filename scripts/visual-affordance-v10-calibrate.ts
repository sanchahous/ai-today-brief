import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  VISUAL_AFFORDANCES_V10,
  chooseVisualRepairModeV10,
  type VisualAffordanceV10,
  type VisualIntegrityFailureV10,
  type VisualRepairModeV10,
} from '../src/lib/weekly-digest/visual-affordance-v10';

const INPUT_PATH =
  process.env.VISUAL_V10_OWNER_CALIBRATION?.trim() ||
  'experiments/visual-affordance-v10/owner-calibration-v1.json';
const OUT_DIR =
  process.env.VISUAL_V10_CALIBRATION_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10';

interface CandidateReview {
  verdict: string;
  reason_tags: string[];
  owner_note: string;
}

interface CalibrationExample {
  id: string;
  story_title: string;
  owner_preference: string;
  preferred_affordance: VisualAffordanceV10;
  overall_verdict: string;
  candidates: Record<string, CandidateReview>;
  expected_repair: VisualRepairModeV10;
  target_core_claim?: string;
}

interface CalibrationFile {
  calibration_id: string;
  source: string;
  weights: Record<string, number>;
  acceptance_policy: Record<string, unknown>;
  reason_tags: string[];
  examples: CalibrationExample[];
}

const TAG_TO_FAILURE: Partial<Record<string, VisualIntegrityFailureV10>> = {
  broken_arrow: 'broken_arrow',
  disconnected_prop: 'disconnected_prop',
  anatomy_error: 'unowned_hand',
  unclear_causal_source: 'beam_without_visible_source',
  weak_visual_thesis: 'weak_visual_thesis',
  uninterpretable_chart: 'uninterpretable_chart',
  labels_help_but_do_not_rescue: 'labels_carry_the_claim',
  generic_diagram: 'uninterpretable_chart',
  opaque_metaphor: 'mapping_not_one_to_one',
  weak_context: 'missing_context',
};

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function candidateTags(example: CalibrationExample): string[] {
  return unique(
    Object.values(example.candidates).flatMap((candidate) => candidate.reason_tags),
  );
}

function inferredFailures(example: CalibrationExample): VisualIntegrityFailureV10[] {
  const tags = candidateTags(example);
  return unique(
    tags
      .map((tag) => TAG_TO_FAILURE[tag])
      .filter((failure): failure is VisualIntegrityFailureV10 => Boolean(failure)),
  );
}

function validate(data: CalibrationFile): string[] {
  const issues: string[] = [];
  if (!data.calibration_id.trim()) issues.push('missing calibration_id');
  if (data.examples.length < 9) issues.push('expected at least nine owner-reviewed stories');
  const ids = data.examples.map((example) => example.id);
  if (new Set(ids).size !== ids.length) issues.push('duplicate example id');
  for (const example of data.examples) {
    if (!VISUAL_AFFORDANCES_V10.includes(example.preferred_affordance)) {
      issues.push(`${example.id}: unsupported preferred_affordance`);
    }
    if (!example.story_title.trim()) issues.push(`${example.id}: missing story title`);
    if (!Object.keys(example.candidates).length) {
      issues.push(`${example.id}: no candidate reviews`);
    }
    for (const [name, candidate] of Object.entries(example.candidates)) {
      if (!candidate.owner_note.trim()) {
        issues.push(`${example.id}/${name}: missing owner note`);
      }
      for (const tag of candidate.reason_tags) {
        if (!data.reason_tags.includes(tag)) {
          issues.push(`${example.id}/${name}: unregistered reason tag ${tag}`);
        }
      }
    }
  }
  const totalWeight = Object.values(data.weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight !== 100) issues.push(`owner weights total ${totalWeight}, expected 100`);
  if (data.acceptance_policy.automated_production_pass !== false) {
    issues.push('automated production pass must stay disabled');
  }
  if (data.acceptance_policy.owner_review_required !== true) {
    issues.push('owner review must remain required');
  }
  return issues;
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function markdown(data: CalibrationFile): string {
  const affordanceCounts = countBy(
    data.examples.map((example) => example.preferred_affordance),
  );
  const verdictCounts = countBy(
    data.examples.map((example) => example.overall_verdict),
  );
  const repairCounts = countBy(
    data.examples.map((example) => example.expected_repair),
  );
  const strongReferences = data.examples.filter(
    (example) => example.overall_verdict === 'production_ready',
  );
  const localRepairs = data.examples.filter(
    (example) => example.overall_verdict === 'local_repair',
  );
  const fullReplans = data.examples.filter(
    (example) => example.expected_repair === 'replan_proposition',
  );
  const rows = data.examples.map((example) => {
    const failures = inferredFailures(example);
    const inferredRepair = chooseVisualRepairModeV10(failures, 1);
    return {
      example,
      failures,
      inferredRepair,
      repairMatches:
        example.expected_repair === 'none' ||
        inferredRepair === example.expected_repair,
    };
  });

  const lines = [
    '# Visual Affordance v10 — owner calibration report',
    '',
    `Calibration: \`${data.calibration_id}\`.`,
    `Owner-reviewed stories: **${data.examples.length}**.`,
    `Strong production references: **${strongReferences.length}**.`,
    `Local-repair references: **${localRepairs.length}**.`,
    `Full proposition replans: **${fullReplans.length}**.`,
    '',
    '## Owner policy',
    '',
    '- Automated production acceptance is disabled.',
    '- Pairwise vision criticism is ranking support only.',
    '- Labels cannot carry required visual evidence.',
    '- Owner acceptance remains mandatory.',
    '',
    '## Preferred affordances',
    '',
    ...Object.entries(affordanceCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `- \`${name}\`: ${count}`),
    '',
    '## Overall owner verdicts',
    '',
    ...Object.entries(verdictCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `- \`${name}\`: ${count}`),
    '',
    '## Repair classes',
    '',
    ...Object.entries(repairCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `- \`${name}\`: ${count}`),
    '',
    '## Gold examples',
    '',
    '| Story | Preferred affordance | Owner verdict | Expected repair | Tag-derived repair | Match |',
    '|---|---|---|---|---|---:|',
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.example.story_title.replace(/\|/g, '\\|')} | ` +
        `\`${row.example.preferred_affordance}\` | ` +
        `\`${row.example.overall_verdict}\` | ` +
        `\`${row.example.expected_repair}\` | ` +
        `\`${row.inferredRepair}\` | ` +
        `${row.repairMatches ? '✓' : 'diagnostic'} |`,
    );
  }

  lines.push('', '## Positive references', '');
  for (const example of strongReferences) {
    lines.push(
      `- **${example.story_title}** → \`${example.preferred_affordance}\`.`,
    );
  }
  lines.push('', '## Local repair references', '');
  for (const example of localRepairs) {
    lines.push(
      `- **${example.story_title}** → \`${example.expected_repair}\`; preserve the concept and repair only the defect.`,
    );
  }
  lines.push('', '## Replan references', '');
  for (const example of fullReplans) {
    lines.push(
      `- **${example.story_title}** → ${example.target_core_claim ?? 'replace the weak visual thesis before rendering again'}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const data = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as CalibrationFile;
  const issues = validate(data);
  if (issues.length) {
    throw new Error(`Owner calibration validation failed:\n- ${issues.join('\n- ')}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const report = markdown(data);
  await Promise.all([
    writeFile(join(OUT_DIR, 'calibration-report.md'), report),
    writeFile(
      join(OUT_DIR, 'calibration-normalized.json'),
      `${JSON.stringify(
        {
          ...data,
          examples: data.examples.map((example) => ({
            ...example,
            inferred_failures: inferredFailures(example),
            tag_derived_repair: chooseVisualRepairModeV10(
              inferredFailures(example),
              1,
            ),
          })),
        },
        null,
        2,
      )}\n`,
    ),
  ]);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
