/** Shared string helpers for prompt assembly. No card-image imports. */

const PLANNING_MARKERS = [
  'the story-specific anchor is',
  'the visible cause is',
  'the visible result is',
  'the literal story context is',
  'show the physical causal process clearly:',
  'make its grounded result unmistakable:',
  'one causal moment showing',
] as const;

export function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function takeWords(text: string, max: number): string {
  const words = collapseWs(text).split(' ').filter(Boolean);
  return words.slice(0, max).join(' ');
}

/**
 * Word-budget cut that lands on the last complete clause (comma / semicolon)
 * within the budget instead of a hard mid-thought stop.
 */
export function clauseSafeTake(text: string, maxWords: number): string {
  const words = collapseWs(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  const hardCut = words.slice(0, maxWords).join(' ');
  const lastSeparator = Math.max(hardCut.lastIndexOf(', '), hardCut.lastIndexOf('; '));
  return lastSeparator > hardCut.length * 0.4 ? hardCut.slice(0, lastSeparator) : hardCut;
}

/** Drop planning-field clauses that used to leak into copy-ready prompts. */
export function stripPlanningPhrases(scene: string): string {
  const collapsed = collapseWs(scene);
  if (!collapsed) return '';
  const parts = collapsed.split(',').map((part) => part.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    const isPlanning = PLANNING_MARKERS.some((marker) => lower.startsWith(marker));
    if (!isPlanning) kept.push(part);
  }
  return kept.join(', ');
}

const HEAD_NOUN_STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'from',
  'into',
  'over',
  'under',
  'vs',
  'versus',
]);

function stripSimplePlural(token: string): string {
  if (token.length >= 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/** Last significant lexeme of a phrase; simple -s/-es plural fold, no stemming. */
export function headNoun(phrase: string): string {
  const tokens = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !HEAD_NOUN_STOP.has(token));
  const last = tokens[tokens.length - 1] ?? '';
  return last ? stripSimplePlural(last) : '';
}
