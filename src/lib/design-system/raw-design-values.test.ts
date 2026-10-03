import { describe, expect, it } from 'vitest';
import {
  compareBaseline,
  isExcludedPath,
  scanDesignValues,
  summarizeFindings,
} from '../../../scripts/report-raw-design-values';

const path = 'src/components/example.tsx';

describe('raw design values ratchet', () => {
  it('finds colors, sub-floor sizes, raw layers and shadows with source lines', () => {
    const source = `const color = '#abcdef';
const classes = 'text-[0.5rem] z-[70] shadow-[0_4px_8px_#000]';
const style = { color: 'rgb(1, 2, 3)', boxShadow: '0 2px 4px black' };`;
    const findings = scanDesignValues(path, source);
    expect(findings.filter((finding) => finding.kind === 'color')).toHaveLength(3);
    expect(findings.find((finding) => finding.kind === 'font-size')?.line).toBe(2);
    expect(findings.find((finding) => finding.kind === 'z-index')?.value).toBe('z-[70]');
    expect(findings.filter((finding) => finding.kind === 'shadow')).toHaveLength(2);
    expect(findings.every((finding) => finding.suggestion.length > 0)).toBe(true);
  });

  it('allows token references, readable sizes, and reset shadows', () => {
    expect(
      scanDesignValues(
        path,
        `const classes = 'text-[12px] text-[0.75rem] z-[var(--z-dialog)] shadow-[var(--shadow-pop)]';
const style = { color: 'rgb(var(--rgb))', boxShadow: 'none' };`,
      ),
    ).toEqual([]);
    expect(
      scanDesignValues('src/app/example.css', '.a { box-shadow: var(--shadow-pop); }'),
    ).toEqual([]);
  });

  it('skips token declarations and comments without shifting source locations', () => {
    const source = `/* first line
#abcdef */
  --accent: #d4b483;
.a { color: #abcdef; }
// #abcdef`;
    expect(scanDesignValues('src/app/globals.css', source)).toMatchObject([
      { kind: 'color', line: 4, value: '#abcdef' },
    ]);
  });

  it('has explicit renderer/admin/illustration exceptions, not a blanket SVG exception', () => {
    for (const excluded of [
      'src/app/admin/page.tsx',
      'src/components/admin/form.tsx',
      'src/app/[lang]/opengraph-image.tsx',
      'src/app/twitter-image.tsx',
      'src/lib/card/image.tsx',
      'src/lib/social/render.tsx',
      'src/lib/weekly-digest/pdf.ts',
      'src/lib/brand-mark.ts',
      'src/components/example.test.tsx',
    ])
      expect(isExcludedPath(excluded)).toBe(true);
    expect(scanDesignValues(path, '<svg><rect fill="#abcdef" /></svg>')).toHaveLength(1);
  });

  it('ignores line movement but blocks added copies, replacements and moves to another file', () => {
    const baseline = summarizeFindings(scanDesignValues(path, "const a = '#abcdef';"));
    expect(
      compareBaseline(
        summarizeFindings(scanDesignValues(path, "\n\nconst a = '#abcdef';")),
        baseline,
      ),
    ).toEqual({ added: [], removed: [] });
    const copied = summarizeFindings(
      scanDesignValues(path, "const a = '#abcdef'; const b = '#abcdef';"),
    );
    expect(compareBaseline(copied, baseline).added).toMatchObject([{ count: 2 }]);
    expect(
      compareBaseline(summarizeFindings(scanDesignValues(path, "const a = '#fedcba';")), baseline)
        .added,
    ).toHaveLength(1);
    expect(
      compareBaseline(
        summarizeFindings(scanDesignValues('src/components/other.tsx', "const a = '#abcdef';")),
        baseline,
      ).added,
    ).toHaveLength(1);
  });

  it('identifies removed debt so pruning cannot re-allow a deleted occurrence', () => {
    const baseline = summarizeFindings(
      scanDesignValues(path, "const a = '#abcdef'; const b = '#abcdef';"),
    );
    const reduced = summarizeFindings(scanDesignValues(path, "const a = '#abcdef';"));
    expect(compareBaseline(reduced, baseline)).toMatchObject({
      added: [],
      removed: [{ count: 2 }],
    });
    expect(compareBaseline(baseline, reduced).added).toHaveLength(1);
    expect(compareBaseline([], baseline).removed).toHaveLength(1);
  });
});
