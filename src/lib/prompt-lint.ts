import {
  PROMPT_LINT_RULES,
  type PromptModel,
  type PromptSeverity,
  type PromptSurface,
} from './prompt-lint-rules';

export type { PromptModel, PromptSeverity, PromptSurface } from './prompt-lint-rules';

export interface PromptLintInput {
  prompt: string;
  surface: PromptSurface;
  model: PromptModel;
}

export interface PromptFinding {
  ruleId: string;
  severity: PromptSeverity;
  evidence?: {
    /** Counts only; never return prompt text. */
    count?: number;
    approximatePosition?: 'start' | 'middle' | 'end';
  };
}

export interface PromptModelRecommendation {
  model: PromptModel;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  reasonIds: string[];
}

export interface PromptLintResult {
  findings: PromptFinding[];
  counts: Record<PromptSeverity, number>;
  recommendation: PromptModelRecommendation;
}

type RuleDetector = (input: PromptLintInput, normalized: string) => PromptFinding | undefined;

const SECTION_MARKERS = /(^|\n)\s*(#{1,6}\s|<\/?(?:context|task|output_format|instructions|document)\b|(?:context|task|output|format|контекст|завдання|вивід|формат)\s*:)/iu;
const EXAMPLE_MARKERS = /<example\b|examples?\s*:|наприклад|приклад\s*:/iu;
const FORMAT_SENSITIVE = /\b(json|csv|table|schema|classif(?:y|ication)|extract|parse|format)\b|таблиц|схем|класиф|витяг|формат|парс/iu;
const OUTPUT_FORMAT = /\b(format|output|return|respond with|json|markdown|table|schema|csv|yaml|xml|bullets?)\b|формат|вивід|відповід|поверни|таблиц|спис(?:ок|ком)/iu;
const NEGATIVE_DIRECTIVES = /\b(?:don't|do not|never|avoid)\b|не роби|ніколи|не треба|уникай/giu;
const ABSOLUTE_DIRECTIVES = /\b(?:always|never|must)\b|обов[ʼ']?язково|завжди|ніколи/iu;
const ABSOLUTE_DIRECTIVES_GLOBAL = /\b(?:always|never|must)\b|обов[ʼ']?язково|завжди|ніколи/giu;
const RATIONALE_MARKERS = /\b(?:because|so that|why|so the|so it)\b|для того|тому що|щоб|бо/iu;
const VAGUE_TERMS = /\b(?:better|professional|good|high-quality|improve|polish)\b|якісн|краще|професійно|покращ|гарно/iu;
const MEASURABLE_TERMS = /\d|\b(?:rubric|criteria|metric|measure|under|at least|exactly)\b|критер|оцін|метрик|не більш|щонаймен/iu;
const CONTEXT_INTENT = /\b(?:for|audience|user|goal|because|purpose|so that|client|customer|investor|reader)\b|для|аудитор|користувач|мета|щоб|клієнт|читач|засновник/iu;
const REASONING_ECHO = /show your chain of thought|reveal your hidden reasoning|transcribe your reasoning|reproduce (?:your )?(?:chain of thought|reasoning)|відтвори хід міркувань|покажи chain of thought|розкрий (?:свої )?приховані міркування/iu;
const CAPS_EMPHASIS = /\b(?:CRITICAL|IMPORTANT|MUST|NEVER|ALWAYS|URGENT|ОБОВ[ʼ']?ЯЗКОВО|ВАЖЛИВО|КРИТИЧНО|НІКОЛИ|ЗАВЖДИ)\b/gu;
const ROUTINE_TASK = /\b(?:classify|extract|rewrite|summari[sz]e|translate|convert|parse)\b|класиф|витяг|перепиши|підсум|переклади/iu;
const COMPLEX_TASK = /\b(?:complex|multi-step|agentic|autonomous|workflow|tools?|long context|plan|architecture|debug|codebase|validation|retries)\b|складн|багатоетап|агент|інструмент|довг(?:ий|ого) контекст|архітект|валідац/iu;
const OPUS_TASK = /\b(?:strongest model|cyber|bio|biology|refusal|safety|fallback|incident)\b|кібер|біо|відмов|безпек/iu;

function severityFor(ruleId: string): PromptSeverity {
  const rule = PROMPT_LINT_RULES.find((item) => item.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown prompt lint rule: ${ruleId}`);
  }
  return rule.severity;
}

function finding(ruleId: string, evidence?: PromptFinding['evidence']): PromptFinding {
  return { ruleId, severity: severityFor(ruleId), ...(evidence ? { evidence } : {}) };
}

function countMatches(prompt: string, pattern: RegExp): number {
  return Array.from(prompt.matchAll(pattern)).length;
}

function applies(ruleId: string, input: PromptLintInput): boolean {
  const rule = PROMPT_LINT_RULES.find((item) => item.id === ruleId);
  if (!rule) return false;
  if (rule.appliesTo.surfaces && !rule.appliesTo.surfaces.includes(input.surface)) return false;
  if (rule.appliesTo.models && !rule.appliesTo.models.includes(input.model)) return false;
  return true;
}

function promptHasLargeEndBlob(prompt: string): boolean {
  const thresholdIndex = Math.floor(prompt.length * 0.35);
  const tail = prompt.slice(thresholdIndex);
  return tail.split(/\r?\n/).some((line) => line.length > 500) || /```[\s\S]{500,}$|<document\b[\s\S]{500,}<\/document>/iu.test(tail);
}

function repeatedBoilerplateScore(normalized: string): number {
  const words = normalized.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  if (words.length < 300) return 0;
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

const detectors: Record<string, RuleDetector> = {
  'structure-sections': (input) =>
    input.prompt.length >= 700 && !SECTION_MARKERS.test(input.prompt) ? finding('structure-sections') : undefined,

  'multishot-examples': (input) =>
    FORMAT_SENSITIVE.test(input.prompt) && !EXAMPLE_MARKERS.test(input.prompt) ? finding('multishot-examples') : undefined,

  'long-context-ordering': (input) => {
    const startsWithInstruction = /^\s*(?:please|summari[sz]e|analy[sz]e|review|rewrite|extract|classify|tell|identify|підсум|проаналіз|перепиши|витяг|класифікуй)/iu.test(
      input.prompt,
    );
    return startsWithInstruction && promptHasLargeEndBlob(input.prompt)
      ? finding('long-context-ordering', { approximatePosition: 'end' })
      : undefined;
  },

  'negative-instructions': (input) => {
    const count = countMatches(input.prompt, NEGATIVE_DIRECTIVES);
    const density = count / Math.max(input.prompt.length / 1000, 0.2);
    return count >= 3 && density >= 1.5 ? finding('negative-instructions', { count }) : undefined;
  },

  'constraint-without-rationale': (input) =>
    ABSOLUTE_DIRECTIVES.test(input.prompt) && !RATIONALE_MARKERS.test(input.prompt)
      ? finding('constraint-without-rationale', { count: countMatches(input.prompt, ABSOLUTE_DIRECTIVES_GLOBAL) })
      : undefined,

  'missing-output-format': (input) =>
    input.prompt.length >= 120 && !OUTPUT_FORMAT.test(input.prompt) ? finding('missing-output-format') : undefined,

  'vague-qualifiers': (input) =>
    VAGUE_TERMS.test(input.prompt) && !MEASURABLE_TERMS.test(input.prompt) ? finding('vague-qualifiers') : undefined,

  'missing-context-intent': (input) => {
    const words = input.prompt.trim().split(/\s+/u).filter(Boolean).length;
    return words >= 2 && !CONTEXT_INTENT.test(input.prompt) ? finding('missing-context-intent') : undefined;
  },

  'reasoning-echo': (input) =>
    applies('reasoning-echo', input) && REASONING_ECHO.test(input.prompt) ? finding('reasoning-echo') : undefined,

  'fable-overprescription': (input) => {
    const count = countMatches(input.prompt, /\b(?:always|never|must)\b|завжди|ніколи|обов[ʼ']?язково/giu);
    return applies('fable-overprescription', input) && count >= 3
      ? finding('fable-overprescription', { count })
      : undefined;
  },

  'caps-emphasis': (input) => {
    const matches = [...input.prompt.matchAll(CAPS_EMPHASIS)].map((match) => match[0]);
    const repeated = matches.some((token) => matches.filter((candidate) => candidate === token).length >= 2);
    return matches.length >= 3 || repeated ? finding('caps-emphasis', { count: matches.length }) : undefined;
  },

  'fable-effort-guidance': (input) =>
    applies('fable-effort-guidance', input) && COMPLEX_TASK.test(input.prompt)
      ? finding('fable-effort-guidance')
      : undefined,

  'prompt-bloat': (_input, normalized) => {
    const tokenRange = estimatePromptTokenRange(normalized);
    return tokenRange.max >= 2500 || repeatedBoilerplateScore(normalized) >= 120
      ? finding('prompt-bloat', { count: tokenRange.max })
      : undefined;
  },
};

export function lintPrompt(input: PromptLintInput): PromptLintResult {
  const normalized = input.prompt.normalize('NFC').trim();
  const findings = PROMPT_LINT_RULES.flatMap((ruleItem) => {
    if (!applies(ruleItem.id, input)) return [];
    const detected = detectors[ruleItem.id]?.({ ...input, prompt: normalized }, normalized);
    return detected ? [detected] : [];
  });

  return {
    findings,
    counts: findings.reduce<Record<PromptSeverity, number>>(
      (counts, item) => ({ ...counts, [item.severity]: counts[item.severity] + 1 }),
      { issue: 0, suggestion: 0, info: 0 },
    ),
    recommendation: recommendPromptModel({ ...input, prompt: normalized }),
  };
}

export function recommendPromptModel(input: PromptLintInput): PromptModelRecommendation {
  const prompt = input.prompt.trim();
  const tokenRange = estimatePromptTokenRange(prompt);
  const reasonIds: string[] = [];
  let model: PromptModel = 'sonnet-4-6';

  if (OPUS_TASK.test(prompt)) {
    model = 'opus-4-8';
    reasonIds.push('high-stakes-or-strongest-model');
  } else if (COMPLEX_TASK.test(prompt) || tokenRange.max >= 1000) {
    model = 'fable-5';
    reasonIds.push('complex-agentic-work');
  } else if (ROUTINE_TASK.test(prompt) && tokenRange.max < 250) {
    model = 'haiku-4-5';
    reasonIds.push('routine-transform');
  } else {
    reasonIds.push('balanced-general-work');
  }

  const recommendation: PromptModelRecommendation = { model, reasonIds };
  if (model !== 'haiku-4-5' && input.surface !== 'claude-ai') {
    if (model === 'fable-5' && (tokenRange.max >= 1800 || /\b(?:autonomous|agentic|multi-step|codebase)\b/iu.test(prompt))) {
      recommendation.effort = 'max';
    } else if (model === 'fable-5' || model === 'sonnet-4-6' || model === 'opus-4-8') {
      recommendation.effort = 'high';
    }
  }

  return recommendation;
}

export function estimatePromptTokenRange(prompt: string): { min: number; max: number } {
  const normalized = prompt.trim();
  if (!normalized) return { min: 0, max: 0 };
  const words = normalized.split(/\s+/u).filter(Boolean).length;
  const byChars = Math.ceil(normalized.length / 4);
  const midpoint = Math.max(words, byChars);
  return {
    min: Math.max(1, Math.floor(midpoint * 0.75)),
    max: Math.max(1, Math.ceil(midpoint * 1.2)),
  };
}
