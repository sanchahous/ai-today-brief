import type { IconKey } from '@/components/icons';
import type { Lang } from '@/lib/site';

/** Presentation glyph for concept hubs (not stored in DB). */
const ICON_BY_SLUG: Partial<Record<string, IconKey>> = {
  'claude-code': 'agents',
  cursor: 'tools',
  codex: 'tools',
  gemini: 'models',
  'github-copilot': 'tools',
  mcp: 'agents',
  langchain: 'agents',
  rag: 'tutorials',
  'prompt-caching': 'optimization',
  'vibe-coding': 'vibe',
};

export function conceptIcon(slug: string, type: string): IconKey {
  const bySlug = ICON_BY_SLUG[slug];
  if (bySlug) return bySlug;
  if (type === 'protocol' || type === 'pattern') return 'agents';
  if (type === 'model') return 'models';
  return 'tools';
}

/** Shelf labels the concept index and the type badge can show. */
export const SHELF_KIND_ORDER = [
  'concept',
  'pattern',
  'protocol',
  'product',
  'model',
  'library',
  'service',
] as const;

const SHELF_KINDS = new Set<string>(SHELF_KIND_ORDER);

/**
 * Badge / filter kind from the row. A specific category such as `protocol`
 * wins over the coarse `type` (`concept`), because that is the label readers see.
 */
export function shelfKind(type: string, category: string | null): string {
  const cat = (category ?? '').trim().toLowerCase();
  const kind = type.trim().toLowerCase();
  if (SHELF_KINDS.has(cat) && cat !== 'concept') return cat;
  if (SHELF_KINDS.has(kind)) return kind;
  if (cat) return cat;
  return kind || 'concept';
}

export function shelfKindLabel(kind: string, labels: Record<string, string>): string {
  const known = labels[kind];
  if (known) return known;
  if (!kind) return '';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export interface ShelfStats {
  entries: number;
  types: number;
  verified: number;
}

export function shelfStats(
  concepts: readonly { type: string; category: string | null; verification: string | null }[],
): ShelfStats {
  const kinds = new Set<string>();
  let verified = 0;
  for (const concept of concepts) {
    kinds.add(shelfKind(concept.type, concept.category));
    if (concept.verification === 'verified') verified += 1;
  }
  return { entries: concepts.length, types: kinds.size, verified };
}

export function countPhrase(
  count: number,
  lang: Lang,
  forms: { one: string; few: string; many: string; other: string },
): string {
  const category = new Intl.PluralRules(lang === 'uk' ? 'uk-UA' : 'en-US').select(count);
  const word =
    category === 'one'
      ? forms.one
      : category === 'few'
        ? forms.few
        : category === 'many'
          ? forms.many
          : forms.other;
  return `${count} ${word}`;
}

/** http(s) only. Anything else is not rendered as an official-site link. */
export function officialHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Calendar date in the brief's zone. Null when the timestamp is missing or invalid. */
export function formatVerifiedDate(
  iso: string | null,
  lang: Lang,
  month: 'long' | 'short' = 'long',
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const locale = lang === 'uk' ? 'uk-UA' : month === 'short' ? 'en-US' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(date);
}

export interface ConceptStep {
  role?: string;
  title: string;
  detail?: string;
}

export interface ConceptTable {
  headers: string[];
  rows: string[][];
}

export interface ConceptSectionPlan {
  ids: string[];
  steps: ConceptStep[];
  how: string[];
  fit: string[];
  table: ConceptTable | null;
}

const LIST_LINE = /^(?:[-*]|\d+[.)])\s+(\S.*)$/;
const ROLE_LINE = /^([^:]{1,32}):\s+(\S.*)$/;

function parseStepLine(text: string): ConceptStep | null {
  const cleaned = text.replace(/\*\*/g, '').trim();
  if (!cleaned) return null;
  const roleMatch = ROLE_LINE.exec(cleaned);
  const role = roleMatch ? roleMatch[1].trim() : undefined;
  const rest = roleMatch ? roleMatch[2] : cleaned;
  const parts = rest.split(/\s+[—–-]\s+/);
  const title = (parts[0] ?? '').trim();
  if (!title) return null;
  const detail = parts.slice(1).join(' — ').trim();
  return detail ? { role, title, detail } : { role, title };
}

/** Named steps from a markdown list in the concept body. Fewer than two → none. */
export function conceptProcessSteps(body: string): ConceptStep[] {
  const steps: ConceptStep[] = [];
  for (const raw of body.split('\n')) {
    const match = LIST_LINE.exec(raw.trim());
    if (!match) continue;
    const step = parseStepLine(match[1]);
    if (!step) continue;
    steps.push(step);
    if (steps.length === 3) break;
  }
  return steps.length >= 2 ? steps : [];
}

function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const cells = trimmed.split('|').slice(1);
  if (trimmed.endsWith('|')) cells.pop();
  const values = cells.map((cell) => cell.trim());
  if (values.length < 2) return null;
  return values;
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** First markdown table in the body, or null when the concept has no table. */
export function conceptFitTable(body: string): ConceptTable | null {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const headers = splitTableRow(lines[i] ?? '');
    if (!headers || isSeparator(headers)) continue;
    const separator = splitTableRow(lines[i + 1] ?? '');
    if (!separator || !isSeparator(separator)) continue;
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j += 1) {
      const row = splitTableRow(lines[j] ?? '');
      if (!row || isSeparator(row)) break;
      rows.push(padRow(row, headers.length));
    }
    if (rows.length > 0) return { headers, rows };
  }
  return null;
}

function padRow(row: string[], width: number): string[] {
  const padded = row.slice(0, width);
  while (padded.length < width) padded.push('');
  return padded;
}

function proseBlocks(body: string, dropLists: boolean): string[] {
  const kept: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (splitTableRow(line)) continue;
    if (dropLists && LIST_LINE.test(line)) continue;
    kept.push(raw);
  }
  return kept
    .join('\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/**
 * Section order matches the concept desktop mockup.
 * A section is omitted when the concept has no source text for it.
 */
export function planConceptSections(input: {
  description: string;
  body: string;
  faqCount: number;
  verification: string | null;
}): ConceptSectionPlan {
  const steps = conceptProcessSteps(input.body);
  const table = conceptFitTable(input.body);
  const prose = proseBlocks(input.body, steps.length >= 2);
  const how = prose.length > 0 ? prose.slice(0, 1) : [];
  const fit = prose.slice(1);
  const ids: string[] = [];
  if (input.description.trim()) ids.push('overview');
  if (how.length > 0 || steps.length >= 2) ids.push('how');
  if (fit.length > 0 || table) ids.push('fit');
  if (input.faqCount > 0) ids.push('faq');
  if (input.verification === 'verified' || input.verification === 'partial') ids.push('verification');
  return { ids, steps, how, fit, table };
}
