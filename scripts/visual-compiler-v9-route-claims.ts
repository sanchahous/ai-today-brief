import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AutoVisualClaimV5 } from '../src/lib/weekly-digest/visual-auto-claim-v5';
import {
  assertVisualRouteDecisionV9,
  routeVisualStoryV9,
  type VisualRouteDecisionV9,
} from '../src/lib/weekly-digest/visual-router-v9';

const INPUT_PATH =
  process.env.VISUAL_V9_CLAIMS?.trim() ||
  'artifacts/visual-compiler-v9-generalization-claims/v5-claims.json';
const OUT_DIR =
  process.env.VISUAL_V9_OUT_DIR?.trim() ||
  'artifacts/visual-compiler-v9-generalization';

interface SourceClaimRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  repaired: boolean;
  eligible: boolean;
  deterministicIssues: string[];
  initialAudit: { passed: boolean; issues: string[] };
  finalAudit: { passed: boolean; issues: string[] };
}

export interface RoutedClaimRecordV9 extends SourceClaimRecord {
  router: VisualRouteDecisionV9;
}

function ineligibilityReasons(record: SourceClaimRecord): string[] {
  return Array.from(
    new Set([
      ...record.deterministicIssues,
      ...record.finalAudit.issues,
    ]),
  )
    .map((reason) => reason.trim())
    .filter(Boolean);
}

function report(records: RoutedClaimRecordV9[]): string {
  const counts = records.reduce<Record<string, number>>((summary, record) => {
    summary[record.router.pipeline] =
      (summary[record.router.pipeline] ?? 0) + 1;
    return summary;
  }, {});
  const eligible = records.filter((record) => record.eligible).length;
  const specialized = records.filter(
    (record) => record.router.specializedTreatment,
  ).length;
  const expectedImageCalls = records.reduce(
    (sum, record) => sum + record.router.expectedImageCalls,
    0,
  );
  const lines = [
    '# Visual Compiler v9 — frozen generalization pre-render gate',
    '',
    `Stories: **${records.length}**.`,
    `Source-eligible generic claims: **${eligible}/${records.length}**.`,
    `Pre-registered specialized matches: **${specialized}**.`,
    `Current art-director routes: **${counts.current_art_director ?? 0}**.`,
    `Deterministic compiler routes: **${counts.deterministic_compiler ?? 0}**.`,
    `Specialized deterministic routes: **${counts.specialized_deterministic ?? 0}**.`,
    `Specialized source-cinematic routes: **${counts.specialized_source_cinematic ?? 0}**.`,
    `Source-led fallback routes: **${counts.source_led_fallback ?? 0}**.`,
    `Expected production image calls: **${expectedImageCalls}**.`,
    `Estimated image cost at $0.015/call: **$${(expectedImageCalls * 0.015).toFixed(3)}**.`,
    '',
    'Routing rules were frozen before this holdout was evaluated. The output is diagnostic and must not be used to add story-specific exceptions after images are viewed.',
    '',
    '| # | Story | Generic role | Certainty | Pipeline | Specialized kind | Calls | Generic claim | Reason |',
    '|---:|---|---|---|---|---|---:|---:|---|',
  ];
  for (const record of [...records].sort(
    (left, right) => left.story.rank - right.story.rank,
  )) {
    lines.push(
      `| ${record.story.rank} | ${record.story.title.replace(/\|/g, '\\|')} | ` +
        `\`${record.autoClaim.semantics.explanatoryRole}\` | ` +
        `\`${record.autoClaim.semantics.certainty}\` | ` +
        `\`${record.router.pipeline}\` | ` +
        `${record.router.specializedTreatment ? `\`${record.router.specializedTreatment.kind}\`` : '—'} | ` +
        `${record.router.expectedImageCalls} | ` +
        `${record.eligible ? '✓' : '✕'} | ` +
        `${record.router.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  const ineligible = records.filter((record) => !record.eligible);
  if (ineligible.length > 0) {
    lines.push('', '## Generic claim failures retained in the audit record', '');
    for (const record of ineligible) {
      lines.push(
        `- #${record.story.rank} **${record.story.title}**: ${
          ineligibilityReasons(record).join('; ') || 'generic source audit did not pass'
        }. Selected route: \`${record.router.pipeline}\`.`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const source = JSON.parse(
    await readFile(INPUT_PATH, 'utf8'),
  ) as SourceClaimRecord[];
  if (source.length !== 7) {
    throw new Error(`Expected seven source claims; received ${source.length}.`);
  }
  const records: RoutedClaimRecordV9[] = source.map((record) => {
    const router = routeVisualStoryV9({
      story: record.story,
      autoClaim: record.autoClaim,
      eligible: record.eligible,
    });
    assertVisualRouteDecisionV9(
      {
        story: record.story,
        autoClaim: record.autoClaim,
        eligible: record.eligible,
      },
      router,
    );
    return { ...record, router };
  });
  const reportText = report(records);
  await Promise.all([
    writeFile(
      join(OUT_DIR, 'v9-routed-claims.json'),
      `${JSON.stringify(records, null, 2)}\n`,
    ),
    writeFile(join(OUT_DIR, 'v9-routing-report.md'), reportText),
  ]);
  console.log(reportText);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
