import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  OWNER_VISUAL_CALIBRATION_V10,
  summarizeOwnerCalibrationV10,
} from '../src/lib/weekly-digest/visual-owner-calibration-v10';

const OUT_DIR =
  process.env.VISUAL_V10_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10-calibration';

function markdown(): string {
  const summary = summarizeOwnerCalibrationV10();
  const lines = [
    '# Visual Affordance Router v10 — owner calibration',
    '',
    `Owner-reviewed pairs: **${summary.total}**.`,
    `Strong approves: **${summary.strongApprove}**; acceptable: **${summary.acceptable}**; local repairs: **${summary.localRepair}**; major rework: **${summary.majorRework}**; rejected: **${summary.rejected}**.`,
    `Positive references retained: **${summary.positiveReferences}**.`,
    '',
    'The automated critic remains a pairwise ranker only. Production acceptance requires explicit owner approval.',
    '',
    '| Case | Expected grammar | Preferred | Readiness | Positive reference | Owner reason tags |',
    '|---|---|---|---|---:|---|',
  ];
  for (const entry of OWNER_VISUAL_CALIBRATION_V10) {
    lines.push(
      `| ${entry.headline.replace(/\|/g, '\\|')} | \`${entry.expectedGrammar}\` | \`${entry.preferred}\` | \`${entry.readiness}\` | ${entry.positiveReference ? '✓' : '✕'} | ${entry.reasonTags.map((tag) => `\`${tag}\``).join(', ')} |`,
    );
  }
  lines.push(
    '',
    '## Promotion policy',
    '',
    '- Hide all labels during the first semantic test.',
    '- Generated scenes must pass anatomy, object-integrity and physical-causality gates.',
    '- Diagrams must pass geometry, invariant and arrow-validity gates.',
    '- Physical analogies must pass a one-to-one source mapping gate.',
    '- A weighted score never overrides a hard blocker.',
    '- Owner review is the only production acceptance source until calibration expands.',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const report = markdown();
  await Promise.all([
    writeFile(join(OUT_DIR, 'owner-calibration-report.md'), report),
    writeFile(
      join(OUT_DIR, 'owner-calibration.json'),
      `${JSON.stringify(OWNER_VISUAL_CALIBRATION_V10, null, 2)}\n`,
    ),
  ]);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
