import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AutoVisualClaimV5 } from '../src/lib/weekly-digest/visual-auto-claim-v5';
import {
  selectVisualPipelineV7,
  summarizeVisualRouterV7,
  type VisualRouterDecisionV7,
} from '../src/lib/weekly-digest/visual-role-router-v7';

const INPUT_PATH =
  process.env.VISUAL_V7_CLAIMS?.trim() ||
  'artifacts/visual-compiler-v7-fresh-claims/v5-claims.json';
const OUT_DIR =
  process.env.VISUAL_V7_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-fresh';

interface SourceClaimRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  repaired: boolean;
  eligible: boolean;
  deterministicIssues: string[];
  initialAudit: { passed: boolean; issues: string[] };
  finalAudit: { passed: boolean; issues: string[] };
}

export interface RoutedClaimRecordV7 extends SourceClaimRecord {
  router: VisualRouterDecisionV7;
}

function report(records: RoutedClaimRecordV7[]): string {
  const summary = summarizeVisualRouterV7(records.map((record) => record.autoClaim));
  const eligible = records.filter((record) => record.eligible).length;
  const lines = [
    '# Visual Compiler v7 — fresh pre-render routing gate',
    '',
    `Stories: **${records.length}**.`,
    `Source-eligible claims: **${eligible}/${records.length}**.`,
    `Current art-director routes: **${summary.currentStories}**.`,
    `Deterministic compiler routes: **${summary.deterministicStories}**.`,
    `Expected image calls: **${summary.expectedImageCalls}**.`,
    `Estimated image cost at $0.015/call: **$${(summary.expectedImageCalls * 0.015).toFixed(3)}**.`,
    '',
    '| # | Story | Role | Certainty | Pipeline | Image calls | Eligible | Reason |',
    '|---:|---|---|---|---|---:|---:|---|',
  ];
  for (const record of records.sort((left, right) => left.story.rank - right.story.rank)) {
    lines.push(
      `| ${record.story.rank} | ${record.story.title.replace(/\|/g, '\\|')} | ` +
        `\`${record.router.role}\` | \`${record.autoClaim.semantics.certainty}\` | ` +
        `\`${record.router.pipeline}\` | ${record.router.expectedImageCalls} | ` +
        `${record.eligible ? '✓' : '✕'} | ${record.router.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const source = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as SourceClaimRecord[];
  if (source.length !== 7) {
    throw new Error(`Expected seven source claims; received ${source.length}.`);
  }
  const records: RoutedClaimRecordV7[] = source.map((record) => {
    if (!record.eligible) {
      throw new Error(`Source claim is not eligible: ${record.story.revision_item_id}`);
    }
    return {
      ...record,
      router: selectVisualPipelineV7(record.autoClaim),
    };
  });
  const reportText = report(records);
  await Promise.all([
    writeFile(join(OUT_DIR, 'v7-routed-claims.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(join(OUT_DIR, 'v7-routing-report.md'), reportText),
  ]);
  console.log(reportText);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
