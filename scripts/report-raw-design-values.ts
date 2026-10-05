import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CSS_VAR_BY_ROLE, SEMANTIC_TOKENS } from '../src/lib/design-system/tokens';

export type FindingKind = 'color' | 'font-size' | 'z-index' | 'shadow';
export interface Finding {
  path: string;
  line: number;
  kind: FindingKind;
  value: string;
  suggestion: string;
}
export interface BaselineEntry {
  path: string;
  kind: FindingKind;
  value: string;
  count: number;
}
interface Baseline {
  version: 1;
  entries: BaselineEntry[];
}

const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts/raw-design-values.baseline.json');
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

/** Renderer exceptions preserve the approved OG/PDF palette; Admin is outside this epic. */
export function isExcludedPath(path: string): boolean {
  return (
    path.startsWith('src/app/admin/') ||
    path.startsWith('src/components/admin/') ||
    ['src/lib/social/', 'src/lib/weekly-digest/', 'src/lib/card/'].some((dir) =>
      path.startsWith(dir),
    ) ||
    path.endsWith('/brand-mark.ts') ||
    path.startsWith('src/components/brand/') ||
    /(?:^|\/)(?:opengraph-image|twitter-image)\.[cm]?[jt]sx?$/.test(path) ||
    /\.(?:test|spec)\.[jt]sx?$/.test(path)
  );
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function colorSuggestion(value: string): string {
  for (const theme of ['night', 'day'] as const) {
    for (const [role, color] of Object.entries(SEMANTIC_TOKENS[theme])) {
      if (color.toLowerCase() === value) {
        return `var(${CSS_VAR_BY_ROLE[role as keyof typeof CSS_VAR_BY_ROLE]}) (звірити роль)`;
      }
    }
  }
  return 'var(--text), var(--accent), var(--border) або --cat-* за роллю';
}

function isTokenReference(value: string): boolean {
  return /^var\(--[\w-]+\)$/.test(value.trim());
}

type AddFinding = (kind: FindingKind, value: string, suggestion: string) => void;

function scanColors(line: string, add: AddFinding): void {
  for (const match of line.matchAll(/#[\da-f]{3,8}\b|(?:rgba?|hsla?)\(\s*[-+.\d][^)\n]*\)/gi)) {
    add('color', match[0], colorSuggestion(normalizeValue(match[0])));
  }
}

function scanFonts(line: string, add: AddFinding): void {
  for (const match of line.matchAll(/(?:text-\[|font-size:\s*)(\d*\.?\d+)(px|rem)\]?/g)) {
    const sizePx = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
    if (sizePx < 12) add('font-size', match[0], 'text-2xs (12px) або більша роль');
  }
}

function scanUtilities(line: string, add: AddFinding): void {
  for (const match of line.matchAll(/(?:z|shadow)-\[([^\]]+)\]/g)) {
    if (isTokenReference(match[1])) continue;
    const kind = match[0].startsWith('z-') ? 'z-index' : 'shadow';
    add(
      kind,
      match[0],
      kind === 'z-index'
        ? 'var(--z-dropdown), var(--z-overlay), var(--z-dialog), var(--z-toast) або var(--z-modal)'
        : 'var(--shadow-card) або var(--shadow-pop)',
    );
  }
}

function scanShadows(line: string, add: AddFinding): void {
  for (const match of line.matchAll(
    /(?:box-shadow|text-shadow)\s*:\s*([^;\n}]+)|(?:boxShadow|textShadow)\s*:\s*['"]([^'"\n]+)['"]/g,
  )) {
    const value = (match[1] ?? match[2]).trim();
    if (
      !isTokenReference(value) &&
      !['none', 'inherit', 'initial', 'unset', 'revert'].includes(value)
    ) {
      add('shadow', match[0], 'var(--shadow-card) або var(--shadow-pop)');
    }
  }
}

/** Lexical report: declarations of CSS tokens are allowed; their consumers are checked. */
export function scanDesignValues(path: string, text: string): Finding[] {
  if (isExcludedPath(path)) return [];
  const findings: Finding[] = [];
  // Preserve newlines so reports still point at the source line.
  const source = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  source.split('\n').forEach((line, index) => {
    if (line.trimStart().startsWith('//')) return;
    const tokenDeclaration = path === 'src/app/globals.css' && /^\s*--[\w-]+\s*:/.test(line);
    const add = (kind: FindingKind, value: string, suggestion: string) => {
      findings.push({ path, line: index + 1, kind, value: normalizeValue(value), suggestion });
    };
    if (!tokenDeclaration) {
      scanColors(line, add);
      scanShadows(line, add);
    }
    scanFonts(line, add);
    scanUtilities(line, add);
  });
  return findings;
}

function identity(entry: Pick<BaselineEntry, 'path' | 'kind' | 'value'>): string {
  return JSON.stringify([entry.path, entry.kind, entry.value]);
}

export function summarizeFindings(findings: Finding[]): BaselineEntry[] {
  const entries = new Map<string, BaselineEntry>();
  for (const finding of findings) {
    const key = identity(finding);
    const entry = entries.get(key);
    if (entry) entry.count++;
    else
      entries.set(key, { path: finding.path, kind: finding.kind, value: finding.value, count: 1 });
  }
  return [...entries.values()].sort((a, b) => identity(a).localeCompare(identity(b)));
}

/** Counts stop a second copy of an existing literal slipping through; line moves are harmless. */
export function compareBaseline(current: BaselineEntry[], baseline: BaselineEntry[]) {
  const expected = new Map(baseline.map((entry) => [identity(entry), entry.count]));
  const actual = new Map(current.map((entry) => [identity(entry), entry.count]));
  const added = current.filter((entry) => entry.count > (expected.get(identity(entry)) ?? 0));
  const removed = baseline.filter((entry) => entry.count > (actual.get(identity(entry)) ?? 0));
  return { added, removed };
}

function collectFiles(dir: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const path = relative(ROOT, full).replaceAll('\\', '/');
    if (isExcludedPath(`${path}${entry.isDirectory() ? '/' : ''}`)) continue;
    if (entry.isDirectory()) paths.push(...collectFiles(full));
    else if (EXTENSIONS.has(full.slice(full.lastIndexOf('.')))) paths.push(full);
  }
  return paths;
}

function saveBaseline(entries: BaselineEntry[]): void {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ version: 1, entries } satisfies Baseline, null, 2)}\n`,
  );
}

function readBaseline(): BaselineEntry[] {
  const data: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (
    !data ||
    typeof data !== 'object' ||
    !('version' in data) ||
    data.version !== 1 ||
    !('entries' in data) ||
    !Array.isArray(data.entries)
  ) {
    throw new Error('Invalid raw design values baseline');
  }
  const kinds: string[] = ['color', 'font-size', 'z-index', 'shadow'];
  const entries: BaselineEntry[] = [];
  for (const entry of data.entries) {
    if (
      !entry ||
      typeof entry.path !== 'string' ||
      !kinds.includes(entry.kind) ||
      typeof entry.value !== 'string' ||
      !Number.isInteger(entry.count) ||
      entry.count < 1
    ) {
      throw new Error('Invalid raw design values baseline entry');
    }
    entries.push(entry);
  }
  if (new Set(entries.map(identity)).size !== entries.length)
    throw new Error('Duplicate baseline entry');
  return entries;
}

function main(): void {
  const mode = process.argv[2] ?? '--check';
  if (!['--check', '--report', '--init', '--prune'].includes(mode))
    throw new Error(`Unknown mode: ${mode}`);
  const files = ['src/app', 'src/components'].flatMap((dir) => collectFiles(join(ROOT, dir)));
  const findings = files.flatMap((full) =>
    scanDesignValues(relative(ROOT, full).replaceAll('\\', '/'), readFileSync(full, 'utf8')),
  );
  const current = summarizeFindings(findings);
  for (const finding of findings) {
    process.stdout.write(
      `${finding.path}:${finding.line} [${finding.kind}] ${finding.value} → ${finding.suggestion}\n`,
    );
  }
  for (const kind of ['color', 'font-size', 'z-index', 'shadow'] as const) {
    process.stdout.write(
      `${kind}: ${findings.filter((finding) => finding.kind === kind).length}\n`,
    );
  }
  if (mode === '--report') return;
  if (mode === '--init') {
    if (existsSync(BASELINE_PATH))
      throw new Error('Baseline exists; use --prune to reduce it. New allowances require review.');
    saveBaseline(current);
    return;
  }
  const delta = compareBaseline(current, readBaseline());
  if (delta.added.length) {
    for (const entry of delta.added)
      process.stderr.write(
        `NEW ${entry.path} [${entry.kind}] ${entry.value} (count ${entry.count})\n`,
      );
    process.exitCode = 1;
    return;
  }
  if (mode === '--prune') saveBaseline(current);
  else if (delta.removed.length) {
    process.stderr.write(
      'Removed raw values: run npm run design:raw:prune and commit the reduced baseline.\n',
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Raw design values ratchet: PASS\n');
}

if (process.argv[1]?.endsWith('report-raw-design-values.ts')) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
