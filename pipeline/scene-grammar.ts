/**
 * Prompt grammar for weekly illustration briefs. Reads the editorial claim
 * (essence + title/summary), never practical/takeaway advice (C5.2) and never
 * the experimental V10 autoClaim cluster.
 *
 * Grammar (diagram vs scene) is this module. Visual language (`templateId`)
 * is `routeTemplate` — keep the two coupled via {@link templateIdForSceneGrammar}.
 */
import type { MetaphorLens, SceneGrammar } from './card-image';
import { routeTemplate } from './image-prompt-library/route';
import type { ImagePromptTemplateId } from './image-prompt-library/templates';

/** Claim-side essence only — advice fields live on the story, not here. */
export interface SceneGrammarEssence {
  storyContext?: string;
  meaning?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
}

export interface SceneGrammarInput {
  title: string;
  summary: string;
  /** Ignored for metric/process signals (C5.2). */
  why?: string;
  /** Ignored for metric/process signals (C5.2). */
  practical?: string;
  /** Ignored for metric/process signals (C5.2). */
  takeaway?: string;
  /** Jury/provider id, or `fallback` when source audit failed. */
  source?: string;
  essence?: SceneGrammarEssence;
  /**
   * Which of the story's three concepts this decision is for. The diagram
   * grammar is capped to `mechanism` (R2.1 / F6): a metric anywhere in the
   * claim used to push ALL THREE concepts to `deterministic_technical_hybrid`,
   * leaving no cinematic option even though the owner explicitly wants
   * variety across the three seats ("sometimes scene, sometimes diagram").
   */
  lens?: MetaphorLens | 'owner_direction';
}

export interface SceneGrammarSignals {
  hasExactMetric: boolean;
  requiresProcessGrammar: boolean;
}

/** Exact quantities in the claim. `%` cannot use a trailing `\b` (it is not a word char). */
const METRIC_RE =
  /(?:[$€£]\s*\d|\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*[x×]\b|\b\d+(?:\.\d+)?\s*(?:tokens?|milliseconds?|ms|seconds?|minutes?|hours?|million|billion|trillion)\b)/i;

const PROCESS_TOKEN_RE =
  /\b(crash|resume|restart|checkpoint|cach(?:e|ing)|split|monitor|fuzz(?:ing)?|failure|repair|retest|retry|interruption|continuation)\b/gi;

export function metricSourceText(input: SceneGrammarInput): string {
  return collapseWs(`${input.title} ${input.summary}`);
}

export function uniqueProcessTokens(text: string): string[] {
  const hits = text.match(PROCESS_TOKEN_RE) ?? [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const hit of hits) {
    const key = hit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

export function requiresProcessGrammar(text: string): boolean {
  return uniqueProcessTokens(text).length >= 2;
}

export function sceneGrammarSignals(input: SceneGrammarInput): SceneGrammarSignals {
  const metricText = metricSourceText(input);
  return {
    hasExactMetric: hasExactMetric(input, metricText),
    requiresProcessGrammar: requiresProcessGrammar(metricText),
  };
}

export function selectSceneGrammar(input: SceneGrammarInput): SceneGrammar {
  if (input.source === 'fallback') return 'source_led_fallback';
  if (input.lens !== 'mechanism') return 'cinematic_domain_scene';
  const signals = sceneGrammarSignals(input);
  // Both signals route to the diagram grammar -- an exact metric (a
  // comparison a diagram states directly) or a multi-step process (a
  // sequence a diagram's arrows are naturally suited to). `requiresProcessGrammar`
  // was computed but never consulted before this fix (C5.3 / F7).
  if (signals.hasExactMetric || signals.requiresProcessGrammar) {
    return 'deterministic_technical_hybrid';
  }
  return 'cinematic_domain_scene';
}

/** Map grammar + lens onto a Prompt-as-Code template (unique vs `occupied`). */
export function templateIdForSceneGrammar(
  input: SceneGrammarInput,
  occupied: readonly ImagePromptTemplateId[] = [],
): ImagePromptTemplateId {
  const grammar = selectSceneGrammar(input);
  return routeTemplate({
    lens: input.lens ?? 'literal_context',
    grammar,
    source: input.source,
    headline: input.title,
    summary: input.summary,
    occupied,
  });
}

function hasExactMetric(input: SceneGrammarInput, metricText: string): boolean {
  if (METRIC_RE.test(metricText)) return true;
  return METRIC_RE.test(claimText(input.essence));
}

function claimText(essence: SceneGrammarEssence | undefined): string {
  if (!essence) return '';
  return collapseWs(
    [
      essence.storyContext,
      essence.meaning,
      essence.mechanism,
      essence.consequence,
      essence.visualThesis,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
